import { RequestQueue, AutoscaledPool, SessionPool, Persist } from "@argus/js-core";
import { chromium } from "playwright";
import { EventEmitter } from "node:events";

const cfg = {
  startUrls: process.env.ARGUS_URLS?.split(",").map(s=>s.trim()).filter(Boolean) ?? [],
  maxRequests: Number(process.env.ARGUS_MAX_REQUESTS ?? 200),
  idleRounds: Number(process.env.ARGUS_IDLE_LIMIT ?? 12),
  scrollPause: Number(process.env.ARGUS_SCROLL_PAUSE ?? 260),
  headful: process.env.ARGUS_HEADFUL==='1',
  maxConc: Number(process.env.ARGUS_MAX_CONC ?? 4)
};

const rq = new RequestQueue(); cfg.startUrls.forEach(u=>rq.enqueue({url:u, depth:0}));
const sp = new SessionPool({size:Math.min(6, cfg.maxConc*2), minScore: 0});
const persist = new Persist("datasets");
// const bus = new EventEmitter(); // Removed unused variable

const pool = new AutoscaledPool(async (_slot: number) => {
  const sess = sp.borrow();
  const browser = await chromium.launch({ headless: !cfg.headful, args: ["--lang=en-US"] });
  const ctx = await browser.newContext({ userAgent: sess.ua, locale: "en-US", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try{
    let job; while((job=rq.dequeue())){
      await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      // TODO: scroll & network tap plugin
    }
  } catch(_e){ sp.penalize(sess); } // Prefixed with underscore
  finally { await browser.close(); }
}, { min:1, max: cfg.maxConc, lagMs:120, rssMB: Number(process.env.ARGUS_RSS_MB ?? 2200) });

pool.start().then(()=> persist.writeJson("checkpoint", { finishedAt: Date.now() }));
