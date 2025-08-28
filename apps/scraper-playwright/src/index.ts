import { launch } from './launcher';

async function main() {
  const { browser, context } = await launch('chromium');
  const page = await context.newPage();
  const url = process.env.ARGUS_TEST_URL || 'https://www.google.com/maps';
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Hook: thêm tuỳ biến khi cần
  // await page.locator('#pane, [aria-label*="Reviews"], [aria-label*="Bài đánh giá"]').first().waitFor({ timeout: 20000 }).catch(()=>{});

  await browser.close();
}

main().catch(err => {
  console.error('[scraper-playwright] fatal:', err);
  process.exitCode = 1;
});
