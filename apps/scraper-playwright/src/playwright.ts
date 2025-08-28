import { chromium, firefox, webkit, BrowserType, LaunchOptions } from 'playwright';

const channel = process.env.ARGUS_BROWSER_CHANNEL || 'msedge';
const headful = process.env.ARGUS_HEADFUL === '1';
const bypassTls = process.env.ARGUS_TLS_BYPASS === '1';

export async function launchBrowser(kind: 'chromium'|'firefox'|'webkit'='chromium') {
  const map: Record<string, BrowserType> = { chromium, firefox, webkit };
  const browserType = map[kind];
  const opts: LaunchOptions = {
    channel: kind === 'chromium' ? channel : undefined,
    headless: !headful
  };
  const browser = await browserType.launch(opts);
  const context = await browser.newContext({ ignoreHTTPSErrors: !!bypassTls });
  return { browser, context };
}
