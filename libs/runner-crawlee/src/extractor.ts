import type { Page } from 'playwright';
import { extractOnPage as coreExtractOnPage } from '@argus/js-core/extractors/gmaps';

export async function extractOnPage(page: Page, locale = 'en-US') {
  return await coreExtractOnPage(page, locale);
}
