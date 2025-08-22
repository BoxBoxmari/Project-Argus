import { chromium, Browser, Page, BrowserContext } from 'playwright';

export async function launch(): Promise<Browser> {
  return chromium.launch({ headless: false }); // headed giống môi trường người dùng
}

export async function createContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 1366, height: 900 },
    timezoneId: 'Asia/Ho_Chi_Minh',
    locale: 'en-US'
  });
}

export async function openAndMine(url: string, evaluateMiner: (page: Page) => Promise<any[]>): Promise<any[]> {
  const b = await launch();
  const ctx = await createContext(b);
  const p = await ctx.newPage();

  // Inject progress emitter for page context
  await p.addInitScript(() => {
    (window as any).__ARGUS_EMIT__ = (msg: any) => {
      try {
        new BroadcastChannel('argus:progress').postMessage(msg);
      } catch {
        // BroadcastChannel not available
      }
    };
  });

  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const data = await evaluateMiner(p);

  await ctx.close();
  await b.close();
  return data;
}

export interface PlaywrightOptions {
  headless?: boolean;
  viewport?: { width: number; height: number };
  timeout?: number;
  resourceBlocking?: {
    images?: boolean;
    videos?: boolean;
    fonts?: boolean;
  };
}

export async function openAndMineWithOptions(
  url: string,
  evaluateMiner: (page: Page) => Promise<any[]>,
  options: PlaywrightOptions = {}
): Promise<any[]> {
  const browser = await chromium.launch({ 
    headless: options.headless ?? false 
  });

  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1366, height: 900 },
    timezoneId: 'Asia/Ho_Chi_Minh',
    locale: 'en-US'
  });

  const page = await context.newPage();

  // Resource blocking if specified
  if (options.resourceBlocking) {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const shouldBlock = 
        (options.resourceBlocking?.images && resourceType === 'image') ||
        (options.resourceBlocking?.videos && resourceType === 'media') ||
        (options.resourceBlocking?.fonts && resourceType === 'font');

      if (shouldBlock) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  // Inject anti-idle and progress emitter
  await page.addInitScript(() => {
    // Progress emitter
    (window as any).__ARGUS_EMIT__ = (msg: any) => {
      try {
        new BroadcastChannel('argus:progress').postMessage(msg);
      } catch {
        // Fallback to console for debugging
        console.log('[ARGUS_PROGRESS]', msg);
      }
    };
  });

  try {
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: options.timeout ?? 120000 
    });
    
    const data = await evaluateMiner(page);
    return data;
  } finally {
    await context.close();
    await browser.close();
  }
}
