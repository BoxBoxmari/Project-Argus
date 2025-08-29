import { chromium, BrowserContext } from 'playwright';
import { DEFAULT_CONFIG } from './config/defaults';

type Opts = { block:boolean; locale:string; headful:boolean };
export async function runMcpChrome(url:string, opts:Opts){
  // Fallback: nếu không có MCP server URL, dùng Playwright Chromium với channel=chrome
  const context = await chromium.launchPersistentContext('', {
    headless: !opts.headful, locale: opts.locale,
    channel: process.env.ARGUS_BROWSER_CHANNEL || DEFAULT_CONFIG.browserChannel
  });
  try {
    const page = await context.newPage();
    if (opts.block) {
      await page.route('**/*', route => {
        const r = route.request();
        const type = r.resourceType();
        if (['image','font','media','stylesheet'].includes(type)) return route.abort();
        return route.continue();
      });
    }
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const open_ms = Date.now() - t0;

    // Pane heuristic
    const t1 = Date.now();
    await page.locator('#pane, [aria-label*="Reviews"], [aria-label*="Bài đánh giá"]').first().waitFor({ timeout: 15000 }).catch(()=>{});
    const pane_ms = Date.now() - t1;

    // Metric nhẹ từ CDP
    const cdp = await context.newCDPSession(page);
    const perf = (await cdp.send('Performance.getMetrics')).metrics;
    await context.close();
    return { metrics: { open_ms, pane_ms, perf }, dataset: null };
  } catch (e) {
    await context.close(); throw e;
  }
}
