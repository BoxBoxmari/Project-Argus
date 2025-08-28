import { Page } from '@playwright/test';
export async function lighten(page: Page) {
  if (process.env.ARGUS_BLOCK_RESOURCES === '1') {
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image','font','media','stylesheet'].includes(type)) return route.abort();
      return route.continue();
    });
  }
}
