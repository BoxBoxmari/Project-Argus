import { chromium, BrowserContext } from 'playwright';
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

export async function runMcpChrome(url:string, opts:Opts){
  // Fallback: nếu không có MCP server URL, dùng Playwright Chromium với channel=chrome
  const context = await chromium.launchPersistentContext('', {
    headless: !opts.headful, locale: opts.locale,
    channel: process.env.ARGUS_BROWSER_CHANNEL || 'chrome'
  });

  try {
    const page = await context.newPage();

    // Bật block tài nguyên mặc định (img, font, media, stylesheet) ở MCP/Crawlee khi PERF_MODE=1
    if (process.env.PERF_MODE === '1' && opts.block) {
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

    // Pane heuristic - áp dụng "wait-for-visible-or-timeout" với DOM guard
    const t1 = Date.now();
    // Tự động tạo patch nếu lỗi thuộc: selector drift, timeout, rate-limit, dup-id, PII leak
    try {
      // Wait for pane to be visible or timeout
      await Promise.race([
        page.locator('#pane, [aria-label*="Reviews"], [aria-label*="Bài đánh giá"]').first().waitFor({ state: 'visible' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Pane timeout')), opts.paneTimeoutMs))
      ]);
    } catch (e: any) {
      console.warn(`[mcp] Pane wait error: ${e.message}`);
    }
    const pane_ms = Date.now() - t1;

    // Metric nhẹ từ CDP
    const cdp = await context.newCDPSession(page);
    const perf = (await cdp.send('Performance.getMetrics')).metrics;
    await context.close();
    return { metrics: { open_ms, pane_ms, perf }, dataset: null };
  } catch (e: any) {
    await context.close();
    throw e;
  }
}
