import { chromium } from "playwright";

async function main() {
  const headful = process.env.ARGUS_HEADFUL === "1";
  const channel = process.env.ARGUS_BROWSER_CHANNEL || undefined;
  const url = process.env.ARGUS_TEST_URL || "https://www.google.com/maps";

  const browser = await chromium.launch({ headless: !headful, channel });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { timeout: 120_000, waitUntil: "domcontentloaded" });
    // TODO: scraping logic. Hiện tại chỉ xác nhận trang mở được rồi thoát.
    const title = await page.title();
    console.log("[argus] opened:", title);
  } catch (err) {
    console.warn("[argus] navigation failed:", (err as Error)?.message ?? err);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error("[argus] start failed:", e?.message || e);
  process.exitCode = 1;
});
