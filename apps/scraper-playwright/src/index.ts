import { chromium, LaunchOptions, Browser, BrowserContext, Page } from "playwright";

function bool(v?: string){ if(!v) return false; const s=v.toLowerCase(); return s==="1"||s==="true"||s==="yes"; }
function vint(v?: string, d=2){ const n=Number(v); return Number.isFinite(n)&&n>0 ? Math.floor(n) : d; }
function splitArgs(v?: string){ return v ? v.split(/\s+/).filter(Boolean) : []; }

const headful = bool(process.env.ARGUS_HEADFUL);
const channel = process.env.ARGUS_BROWSER_CHANNEL || undefined;
const proxyUrl = process.env.ARGUS_PROXY_URL;
const forceBypass = bool(process.env.ARGUS_TLS_BYPASS);
const noSandbox = bool(process.env.ARGUS_NO_SANDBOX);
const extraArgs = splitArgs(process.env.ARGUS_CHROMIUM_ARGS);
const navRetries = vint(process.env.ARGUS_NAV_RETRIES, 2);
const navDebug = bool(process.env.ARGUS_NAV_DEBUG);
const targetUrl = process.env.ARGUS_TEST_URL || "https://www.google.com/maps";

type Profile = "secure"|"insecure"|"insecure_no_sandbox";

async function launch(profile: Profile): Promise<{browser:Browser; context:BrowserContext}> {
  const args:string[] = [...extraArgs];
  const insecure = profile !== "secure";
  if (insecure) args.push("--ignore-certificate-errors","--allow-running-insecure-content");
  if (profile === "insecure_no_sandbox" || noSandbox) args.push("--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage");
  const opts: LaunchOptions = { headless: !headful, channel, args, proxy: proxyUrl ? { server: proxyUrl } : undefined };
  const browser = await chromium.launch(opts);
  const context = await browser.newContext({
    ignoreHTTPSErrors: insecure,
    serviceWorkers: "block",
    bypassCSP: true,
    locale: "en-US",
  });
  return { browser, context };
}

async function withPage<T>(profile: Profile, fn: (page:Page)=>Promise<T>): Promise<T> {
  const { browser, context } = await launch(profile);
  const page = await context.newPage();
  if (navDebug) {
    page.on("requestfailed", r => console.warn("[argus] requestfailed:", r.url(), r.failure()?.errorText));
    page.on("console", msg => console.log("[argus] console:", msg.type(), msg.text()));
    page.on("pageerror", err => console.error("[argus] pageerror:", (err as any)?.message || err));
  }
  try { return await fn(page); }
  finally { await context.close(); await browser.close(); }
}

async function healthCheck(profile: Profile): Promise<void> {
  await withPage(profile, async (page)=>{
    try { await page.goto("https://www.gstatic.com/generate_204", { timeout: 30_000, waitUntil: "domcontentloaded" }); }
    catch(e){ console.warn("[argus] https 204 failed:", String((e as any)?.message||e)); }
    try { await page.goto("http://example.com", { timeout: 30_000, waitUntil: "domcontentloaded" }); }
    catch(e){ console.warn("[argus] http example failed:", String((e as any)?.message||e)); }
  });
}

async function tryNavigate(profile: Profile, url: string, attempts: number): Promise<boolean> {
  for (let i=1; i<=attempts; i++){
    try {
      await withPage(profile, async (page)=>{
        await page.goto(url, { timeout: 120_000, waitUntil: "domcontentloaded" });
        await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
        const title = await page.title();
        console.log(`[argus] profile=${profile} attempt=${i} opened: ${title}`);
      });
      return true;
    } catch (e:any) {
      const msg = String(e?.message || e);
      console.warn(`[argus] profile=${profile} attempt=${i} navigation error:`, msg);
      if (i === attempts && navDebug) await healthCheck(profile);
    }
  }
  return false;
}

(async ()=>{
  const profiles: Profile[] = forceBypass ? ["insecure","insecure_no_sandbox"] : ["secure","insecure","insecure_no_sandbox"];
  for (const p of profiles){
    const ok = await tryNavigate(p, targetUrl, navRetries);
    if (ok) return;
    if (p === "secure") {
      if (/ERR_CERT|ERR_SSL/i.test(targetUrl)) console.warn("[argus] TLS suspect on target, proceeding to bypass profiles");
    }
  }
  throw new Error("Protocol error after multi-profile retries");
})().catch(e=>{ console.error("[argus] start failed:", (e as any)?.message || e); process.exitCode = 1; });

