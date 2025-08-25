import { chromium } from "playwright";
async function main() {
  const headful = process.env.ARGUS_HEADFUL === "1";
  const browser = await chromium.launch({ headless: !headful, channel: process.env.ARGUS_BROWSER_CHANNEL || undefined });
  const context = await browser.newContext();
  const page = await context.newPage();
  const url = process.env.ARGUS_TEST_URL || "https://www.google.com/maps";
  await page.goto(url, { timeout: 120_000 });
  // TODO: implement scraping; keep graceful shutdown.
  await context.close();
  await browser.close();
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
