import { chromium } from 'playwright';
import { extractOnPage } from './extractor.js';

async function testExtractor() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Use a real Google Maps URL with reviews
    await page.goto('https://maps.app.goo.gl/q6Rus1W5HMFsHBb3A', { waitUntil: 'domcontentloaded' });
    console.log('Page loaded');

    // Wait for the reviews to load
    await page.waitForTimeout(10000);

    const reviews = await extractOnPage(page, 'en-US');
    console.log('Extracted reviews:', reviews);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testExtractor().catch(console.error);
