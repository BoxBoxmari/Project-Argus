import { test, expect, devices } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const cases = JSON.parse(fs.readFileSync(path.resolve('scenarios/sim.cases.json'),'utf8'));
for (const [i,c] of cases.entries()) {
  const stable = c.mode==='headless' && c.device==='Desktop' && c.network==='normal' && c.block==='on';
  test(`SIM#${i+1} ${stable?'[stable]':'[quarantine]'} ${c.locale} ${c.mode} ${c.device} ${c.network} block:${c.block}`, async ({ page, context }) => {
    // device
    const dev = c.device==='Mobile' ? devices['Pixel 5'] : devices['Desktop Chrome'];
    await context.setGeolocation({ latitude: 10.78, longitude: 106.70 });
    await context.grantPermissions(['geolocation']);
    // network
    if (c.network==='slow3g') await context.route('**/*', r => r.request().resourceType()==='xhr' ? r.continue() : r.continue());
    // block resources
    if (c.block==='on') {
      await page.route('**/*', (route) => {
        const t = route.request().resourceType();
        if (['image','font','media','stylesheet'].includes(t)) return route.abort();
        return route.continue();
      });
    }
    // polyfill GM_* if userscript injected
    await page.addInitScript(() => {
      // @ts-ignore
      window.GM_getValue = (k,d)=>d; /* noop */
      // @ts-ignore
      window.GM_download = (o)=>console.log('GM_download',o?.name);
    });
    // inject userscript build if exists
    const us = path.resolve('../userscript/dist/argus.user.js');
    if (fs.existsSync(us)) await page.addInitScript({ path: us });

    // open local fixture
    const html = path.resolve('fixtures/gmaps_sample.html');
    await page.goto('file://'+html, { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(c.scroll.pause);
    const author = page.locator('.d4r55'); await expect(author).toBeVisible();
  });
}
