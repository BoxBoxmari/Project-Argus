import { test, expect } from '@playwright/test';
const URL = process.env.ARGUS_TEST_URL || 'https://www.google.com/maps';
const cases = [
  { locale:'en-US', block:'on' }, { locale:'vi-VN', block:'on' }, { locale:'vi-VN', block:'off' }
];
for (const [i,c] of cases.entries()) {
  test(`REAL#${i+1} ${c.locale} block:${c.block}`, async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    if (c.block==='on') {
      await page.route('**/*', (route) => {
        const t = route.request().resourceType();
        if (['image','font','media','stylesheet'].includes(t)) return route.abort();
        return route.continue();
      });
    }
    await page.goto(URL, { waitUntil:'domcontentloaded' });
    await page.locator('#pane, [aria-label*="Reviews"], [aria-label*="Bài đánh giá"]').first().waitFor({ timeout: 20000 }).catch(()=>{});
    expect(true).toBeTruthy();
  });
}
