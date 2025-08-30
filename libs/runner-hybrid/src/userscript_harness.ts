import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { DEFAULTS } from './config/defaults';

type Opts = {
  block: boolean;
  locale: string;
  headful: boolean;
  delayMs: number;
  jitterMs: number;
  backoffBaseMs: number;
  paneTimeoutMs: number;
};

export async function runUserscriptHarness(url:string, opts:Opts){
  const browser = await chromium.launch({ headless: !opts.headful, channel: process.env.ARGUS_BROWSER_CHANNEL || 'chrome' });
  const context = await browser.newContext({ locale: opts.locale });
  const page = await context.newPage();

  // Bật block tài nguyên mặc định (img, font, media, stylesheet) ở Userscript khi PERF_MODE=1
  if (process.env.PERF_MODE === '1' && opts.block) {
    await page.route('**/*', route => {
      const t = route.request().resourceType();
      if (['image','media','font','stylesheet'].includes(t)) return route.abort();
      return route.continue();
    });
  }

  const us = readFileSync('apps/userscript/dist/argus.user.js','utf8');
  await page.addInitScript(us);
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const open_ms = Date.now() - t0;
  await browser.close();
  return { metrics: { open_ms, pane_ms: 0 }, dataset: null };
}
