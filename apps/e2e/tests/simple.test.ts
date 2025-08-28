import { test, expect } from '@playwright/test';

test('simple test', async ({ page }) => {
  await page.setContent('<h1>Hello World</h1>');
  await expect(page.locator('h1')).toHaveText('Hello World');
});
