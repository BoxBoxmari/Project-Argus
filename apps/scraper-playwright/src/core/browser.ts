import {
  chromium,
  Browser,
  BrowserContext,
  LaunchOptions,
  devices,
} from "playwright";
import { Env } from "../config/env.js";

type Channel = "chromium" | "msedge" | "chrome";

function pickLauncher(channel?: Channel) {
  switch (channel) {
    case "msedge":
      return chromium;
    case "chrome":
      return chromium;
    default:
      return chromium;
  }
}

export async function newBrowser(): Promise<Browser> {
  const launcher = pickLauncher(Env.BROWSER_CHANNEL as Channel | undefined);
  const launchOpts: LaunchOptions = {
    headless: !Env.HEADFUL,
    channel: Env.BROWSER_CHANNEL,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-features=IsolateOrigins,site-per-process",
      "--ignore-certificate-errors",
    ],
    proxy: Env.PROXY_URL ? { server: Env.PROXY_URL } : undefined,
  };
  return launcher.launch(launchOpts);
}

export async function newContext(b: Browser): Promise<BrowserContext> {
  const device = devices["Desktop Chrome"];
  const context = await b.newContext({
    ...device,
    ignoreHTTPSErrors: Env.IGNORE_HTTPS_ERRORS,
    locale: Env.LOCALE,
    userAgent: Env.USER_AGENT || device.userAgent,
  });
  context.setDefaultNavigationTimeout(Env.NAV_TIMEOUT_MS);
  return context;
}

export async function withPage<T>(
  fn: (ctx: BrowserContext, page: import("playwright").Page) => Promise<T>,
): Promise<T> {
  const browser = await newBrowser();
  try {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    return await fn(ctx, page);
  } finally {
    await browser.close();
  }
}

export async function safeGoto(
  page: import("playwright").Page,
  url: string,
  attempts = 3,
): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  throw lastErr;
}
