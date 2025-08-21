import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const url = process.env.ARGUS_TEST_URL;
if (!url) { console.error('ARGUS_TEST_URL not set'); process.exit(2); }

const outDir = process.env.ARGUS_OUT_DIR || '.';
const logFile = (n) => path.join(outDir, n);
const append  = (file, obj) => fs.appendFileSync(logFile(file), JSON.stringify(obj)+'\n');

async function launchBrowserWithFallback() {
  const optsList = [
    { channel: 'chrome', headless: true },
    { channel: 'msedge', headless: true },
    { headless: true }
  ];
  for (const opts of optsList) {
    try { const b = await chromium.launch(opts); append('events.jsonl', {type:'launch_ok', opts}); return b; }
    catch(e){ append('events.jsonl', {type:'launch_err', opts, err: String(e)}); }
  }
  throw new Error('No browser available. Run: npx playwright install chromium chromium-headless-shell');
}

(async () => {
  fs.writeFileSync(logFile('events.jsonl'), '');
  append('events.jsonl', {type:'meta', ts_start:new Date().toISOString(), node:process.version, platform:process.platform, url});

  const browser = await launchBrowserWithFallback();
  const context = await browser.newContext({
    recordHar: { path: logFile('network.har'), content: 'embed' },
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
    timezoneId: 'Asia/Ho_Chi_Minh',
    geolocation: { latitude: 10.8018228, longitude: 106.7127545 },
    permissions: ['geolocation']
  });

  // Chặn tài nguyên nặng để giảm noise 40x và tiết kiệm băng thông
  await context.route('**/*', (route) => {
    const t = route.request().resourceType();
    if (['image','media','font','stylesheet'].includes(t)) return route.abort();
    return route.continue();
  });

  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const page = await context.newPage();

  // Logging cơ bản
  page.on('console', (m) => append('events.jsonl', { type:'console', level:m.type(), text:m.text() }));
  page.on('pageerror', (e) => append('events.jsonl', { type:'pageerror', message:String(e) }));
  page.on('requestfailed', (r) => append('events.jsonl', { type:'requestfailed', url:r.url(), method:r.method(), failure:r.failure()?.errorText }));
  page.on('response', (res) => { const s=res.status(); if (s>=400) append('events.jsonl',{type:'bad_response',status:s,url:res.url()}); });

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2000);
  append('events.jsonl', {type:'info', msg:'landed', ms: Date.now()-t0});

  // Mở tab Reviews nếu chưa mở
  async function tryClick(sel, label) {
    try {
      const el = page.locator(sel).first();
      const ok = await el.isVisible({ timeout: 1500 }).catch(()=>false);
      if (ok) { await el.click({ timeout: 5000 }); append('events.jsonl', {type:'click_ok', selector:sel, label}); return true; }
    } catch(e){ append('events.jsonl', {type:'click_err', selector:sel, label, err:String(e)}); }
    return false;
  }
  const reviewTabSelectors = [
    'button[role="tab"][aria-label*="Reviews" i]',
    'a[href*="=reviews"]',
    'div[role="tab"][aria-selected="false"][aria-label*="Reviews" i]'
  ];
  for (const [i, s] of reviewTabSelectors.entries()) { if (await tryClick(s, 'tab_'+i)) break; }
  await page.waitForTimeout(1500);

  // Scroll trong panel review, click "More" khi có
  async function scrollReviews(rounds=40){
    const panelSel = ['[role="feed"][aria-label*="review" i]', '.m6QErb'];
    const moreBtnSel = ['button[jsaction*="more"]','span[role="button"][jsaction*="more"]','button[aria-label*="More"]','button[aria-label*="Xem thêm"]'];
    const q = (sels, root) => { for (const s of sels){ const el=(root||document).querySelector(s); if (el) return el; } return null; };

    return await page.evaluate(async (panelSel, moreBtnSel) => {
      const q = (sels, root) => { for (const s of sels){ const el=(root||document).querySelector(s); if (el) return el; } return null; };
      const panel = q(panelSel, document); if (!panel) return { containers:0, totalScroll:0, before:0, after:0 };
      const countItems = () => document.querySelectorAll('div[data-review-id]').length;

      let total = 0, before = countItems();
      for (let i=0;i<40;i++){
        const more = q(moreBtnSel, panel); try{ more && more.click(); }catch{}
        panel.scrollBy(0, Math.max(200, Math.floor(panel.clientHeight*0.9)));
        total += Math.max(200, Math.floor(panel.clientHeight*0.9));
        await new Promise(r=>setTimeout(r, 220));
      }
      const after = countItems();
      return { containers:1, totalScroll: total, before, after };
    }, panelSel, moreBtnSel);
  }

  const scrolled = await scrollReviews(40);
  append('events.jsonl', {type:'scroll', ...scrolled});
  await page.screenshot({ path: logFile('after_scroll.png'), fullPage: true }).catch(()=>{});

  // Timing + UA
  const navTiming = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return n ? { type:n.entryType, startTime:n.startTime, duration:n.duration, domContentLoaded:n.domContentLoadedEventEnd, loadEventEnd:n.loadEventEnd } : null;
  });
  const ua = await page.evaluate(() => navigator.userAgent);
  append('events.jsonl', {type:'timing', navTiming});
  append('events.jsonl', {type:'ua', ua});

  await context.tracing.stop({ path: logFile('trace.zip') });
  await context.close(); await browser.close();

  // Summary
  const lines = fs.readFileSync(logFile('events.jsonl'),'utf8').trim().split(/\r?\n/).map(l=>JSON.parse(l));
  const summary = {
    url,
    total_events: lines.length,
    console_count: lines.filter(x=>x.type==='console').length,
    pageerror_count: lines.filter(x=>x.type==='pageerror').length,
    requestfailed_count: lines.filter(x=>x.type==='requestfailed').length,
    bad_response_count: lines.filter(x=>x.type==='bad_response').length,
    clicked: lines.filter(x=>x.type==='click_ok').length,
    scrolled: lines.find(x=>x.type==='scroll') || null,
    timing: lines.find(x=>x.type==='timing')?.navTiming || null,
    screenshots: ['after_scroll.png'].filter(f => fs.existsSync(logFile(f)))
  };
  fs.writeFileSync(logFile('summary.json'), JSON.stringify(summary, null, 2));
  console.log('[ARGUS][DONE]', JSON.stringify(summary));
})().catch(err => {
  fs.appendFileSync(logFile('events.jsonl'), JSON.stringify({ type:'fatal', message:String(err) })+'\n');
  console.error(err); process.exit(1);
});
