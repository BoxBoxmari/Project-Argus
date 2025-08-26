import { chromium, LaunchOptions, Browser, BrowserContext } from "playwright";
function bool(v?: string){ if(!v) return false; const s=v.toLowerCase(); return s==="1"||s==="true"||s==="yes"; }
function errMsg(e: unknown){ return String((e as {message?: unknown})?.message ?? e); }
const headful = bool(process.env.ARGUS_HEADFUL);
const channel = process.env.ARGUS_BROWSER_CHANNEL || undefined;
const proxyUrl = process.env.ARGUS_PROXY_URL;
const forceBypass = bool(process.env.ARGUS_TLS_BYPASS);
const targetUrl = process.env.ARGUS_TEST_URL || "https://www.google.com/maps";

async function launch(insecure:boolean):Promise<{browser:Browser;context:BrowserContext}>{
  const args:string[]=[]; if(insecure) args.push("--ignore-certificate-errors","--allow-running-insecure-content");
  const opts:LaunchOptions={ headless:!headful, channel, args, proxy: proxyUrl?{server:proxyUrl}:undefined };
  const browser=await chromium.launch(opts);
  const context=await browser.newContext({ ignoreHTTPSErrors: insecure });
  return {browser,context};
}
async function openOnce(insecure:boolean){
  const {browser,context}=await launch(insecure);
  const page=await context.newPage();
  try{
    await page.goto(targetUrl,{timeout:120_000,waitUntil:"domcontentloaded"});
    const title=await page.title();
    console.log("[argus] opened:", title);
  } finally {
    await context.close(); await browser.close();
  }
}
(async()=>{
  if(forceBypass){ console.warn("[argus] TLS bypass forced"); await openOnce(true); return; }
  try{ await openOnce(false); }
  catch(e: unknown){
    const m = errMsg(e);
    if(m.includes("ERR_CERT")||m.includes("ERR_SSL")){
      console.warn("[argus] TLS error, retry with bypass");
      await openOnce(true);
    } else {
      throw e;
    }
  }
})().catch((e)=>{ console.error("[argus] start failed:", errMsg(e)); process.exitCode=1; });

