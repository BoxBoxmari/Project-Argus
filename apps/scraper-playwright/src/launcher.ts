import { chromium, firefox, webkit, BrowserType, LaunchOptions, BrowserContext, Browser } from 'playwright';

export type Engine = 'chromium' | 'firefox' | 'webkit';

export async function launch(engine: Engine = 'chromium'): Promise<{browser: Browser; context: BrowserContext;}> {
  const map: Record<Engine, BrowserType> = { chromium, firefox, webkit };
  const headful = process.env.ARGUS_HEADFUL === '1';
  const channel = process.env.ARGUS_BROWSER_CHANNEL || 'msedge';
  const tlsBypass = process.env.ARGUS_TLS_BYPASS === '1';

  const options: LaunchOptions = { headless: !headful };
  if (engine === 'chromium' && channel) (options as any).channel = channel;

  const browser = await map[engine].launch(options);
  const context = await browser.newContext({ ignoreHTTPSErrors: tlsBypass });
  return { browser, context };
}
