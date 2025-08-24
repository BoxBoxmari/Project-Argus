import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const url = process.env.ARGUS_TEST_URL;
if (!url) { console.error("ARGUS_TEST_URL not set"); process.exit(2); }

const outDir = process.env.ARGUS_OUT_DIR || ".";
const logFile = (n) => path.join(outDir, n);
const append  = (file, obj) => fs.appendFileSync(logFile(file), JSON.stringify(obj)+"\n");

async function launchBrowserWithFallback() {
  const optsList = [
    { channel:"chrome", headless:true },
    { channel:"msedge", headless:true },
    { headless:true }
  ];
  for (const opts of optsList) {
    try { const b = await chromium.launch(opts); append("events.jsonl",{type:"launch_ok",opts}); return b; }
    catch (e) { append("events.jsonl",{type:"launch_err",opts,err:String(e)}); }
  }
  throw new Error("No browser available. Run: npx playwright install chromium chromium-headless-shell");
}

(async () => {
  fs.writeFileSync(logFile("events.jsonl"), "");
  append("events.jsonl",{type:"meta", ts_start:new Date().toISOString(), node:process.version, platform:process.platform, url});

  let browser, context, page;
  const aborted = new Set();
  try {
    browser = await launchBrowserWithFallback();
    context = await browser.newContext({
      recordHar: { path: logFile("network.har"), content: "embed" },
      viewport: { width: 1366, height: 900 },
      locale: "en-US",
      timezoneId: "Asia/Ho_Chi_Minh",
      geolocation: { latitude: 10.8018228, longitude: 106.7127545 },
      permissions: ["geolocation"]
    });

    // Cắt bớt noise mạng: ảnh/media/font/css
    await context.route("**/*", (route) => {
      const req = route.request();
      const t = req.resourceType();
      if (["image","media","font","stylesheet"].includes(t)) { aborted.add(req.url()); return route.abort(); }
      route.continue();
    });

    await context.tracing.start({ screenshots:true, snapshots:true, sources:false });
    page = await context.newPage();

    // Logging
    page.on("console",      (m)=>append("events.jsonl",{type:"console",level:m.type(), text:m.text()}));
    page.on("pageerror",    (e)=>append("events.jsonl",{type:"pageerror", message:String(e)}));
    page.on("requestfailed",(r)=>{ const u=r.url(); if(!aborted.has(u)) append("events.jsonl",{type:"requestfailed",url:u,method:r.method(),failure:r.failure()?.errorText}); });
    page.on("response",     (res)=>{ const s=res.status(); if(s>=400) append("events.jsonl",{type:"bad_response",status:s,url:res.url()}); });

    // Điều hướng
    const t0 = Date.now();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(1200);
    append("events.jsonl",{type:"info", msg:"landed", ms:Date.now()-t0});

    // Nếu panel review đã mở sẵn, bỏ qua click
    const feedVisible = await page.locator('[role="feed"][aria-label*="review" i], .m6QErb').first().isVisible().catch(()=>false);
    if (!feedVisible) {
      async function tryClick(sel, label){
        try {
          const el = page.locator(sel).first();
          const ok = await el.isVisible({ timeout: 1500 }).catch(()=>false);
          if (ok) { await el.click({ timeout: 5000 }); append("events.jsonl",{type:"click_ok",selector:sel,label}); return true; }
        } catch(e){ append("events.jsonl",{type:"click_err",selector:sel,label,err:String(e)}); }
        return false;
      }
      const reviewTabSelectors = [
        'button[role="tab"][aria-label*="Reviews" i]',
        'a[href*="=reviews"]',
        'div[role="tab"][aria-selected="false"][aria-label*="Reviews" i]'
      ];
      for (const [i, sel] of reviewTabSelectors.entries()) { if (await tryClick(sel, "tab_"+i)) break; }
      await page.waitForTimeout(1000);
    } else {
      append("events.jsonl",{type:"tab_already_open"});
    }

    // Scroll trong panel review + click "More"
    async function scrollReviews(rounds=40){
      const args = {
        rounds,
        panelSel: ['[role="feed"][aria-label*="review" i]', '.m6QErb'],
        moreBtnSel: ['button[jsaction*="more"]','span[role="button"][jsaction*="more"]','button[aria-label*="More"]','button[aria-label*="Xem thêm"]']
      };
      return await page.evaluate(async (args) => {
        const { rounds, panelSel, moreBtnSel } = args;
        const q = (sels, root)=>{ for (const s of sels){ const el=(root||document).querySelector(s); if (el) return el; } return null; };
        const panel = q(panelSel, document); if (!panel) return { containers:0, totalScroll:0, before:0, after:0 };
        const countItems = () => document.querySelectorAll('div[data-review-id]').length;
        let total = 0, before = countItems();
        for (let i=0; i<rounds; i++){
          try { const more = q(moreBtnSel, panel); more && more.click(); } catch {}
          const step = Math.max(200, Math.floor(panel.clientHeight*0.9));
          panel.scrollBy(0, step);
          total += step;
          await new Promise(r=>setTimeout(r, 220));
        }
        const after = countItems();
        return { containers:1, totalScroll: total, before, after };
      }, args);
    }

    const scrolled = await scrollReviews(40);
    append("events.jsonl",{type:"scroll", ...scrolled});
    await page.screenshot({ path: logFile("after_scroll.png"), fullPage:true }).catch(()=>{});

    // Timing + UA
    const navTiming = await page.evaluate(()=> {
      const n = performance.getEntriesByType("navigation")[0];
      return n ? { type:n.entryType, startTime:n.startTime, duration:n.duration, domContentLoaded:n.domContentLoadedEventEnd, loadEventEnd:n.loadEventEnd } : null;
    });
    append("events.jsonl",{type:"timing", navTiming});
    append("events.jsonl",{type:"ua", ua: await page.evaluate(()=>navigator.userAgent)});

  } catch (err) {
    append("events.jsonl",{type:"fatal", message:String(err)});
    console.error(err);
  } finally {
    try { if (context) await context.tracing.stop({ path: logFile("trace.zip") }); } catch {}
    try { if (context) await context.close(); } catch {}
    try { if (browser) await browser.close(); } catch {}

    // Summary (machine-readable cho CI)
    try {
      const lines = fs.existsSync(logFile("events.jsonl")) ? fs.readFileSync(logFile("events.jsonl"),"utf8").trim().split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l)) : [];
      const summary = {
        url,
        total_events: lines.length,
        console_count:      lines.filter(x=>x.type==="console").length,
        pageerror_count:    lines.filter(x=>x.type==="pageerror").length,
        requestfailed_count:lines.filter(x=>x.type==="requestfailed").length,
        bad_response_count: lines.filter(x=>x.type==="bad_response").length,
        clicked:            lines.filter(x=>x.type==="click_ok").length,
        scrolled:           lines.find(x=>x.type==="scroll") || null,
        timing:             lines.find(x=>x.type==="timing")?.navTiming || null,
        screenshots:        ["after_scroll.png"].filter(f=>fs.existsSync(logFile(f)))
      };
      fs.writeFileSync(logFile("summary.json"), JSON.stringify(summary,null,2));
      console.log("[ARGUS][DONE]", JSON.stringify(summary));
    } catch(e) {
      console.log("[ARGUS][NO-SUMMARY]", String(e));
    }
  }
})();
