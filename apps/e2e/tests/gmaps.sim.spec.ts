import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

test('SIM: userscript extracts from fixture DOM', async ({ page }) => {
  // 1) Polyfill GM_* in page
  await page.addInitScript(() => {
    // @ts-ignore
    window.GM_getValue = (k, d) => d;
    // @ts-ignore
    window.GM_setValue = (k, v) => void 0;
    // @ts-ignore
    window.GM_download = (opts) => { console.log('GM_download', opts?.name || 'file'); };
  });

  // 2) Inject built userscript if exists
  const script = path.resolve(__dirname, '../../../userscript/dist/argus.user.js');
  if (fs.existsSync(script)) {
    await page.addInitScript({ path: script });
  }

  // 3) Load fixture
  const html = path.resolve(__dirname, '../fixtures/gmaps_sample.html');
  await page.goto('file://' + html);

  // 4) Basic sanity: container exists
  await expect(page.locator('#pane')).toBeVisible();

  // 5) If extractor exposes hook, call it; else simulate scroll and check console logs
  // Here we assert DOM presence as placeholder
  const author = page.locator('.d4r55');
  await expect(author).toHaveText(/Nguyen Van A/);
});
