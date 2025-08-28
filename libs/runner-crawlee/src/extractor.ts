import type { Page } from 'playwright';
import { z } from 'zod';

// Copying ReviewSchema directly to avoid import issues
const ReviewSchema = z.object({
  author: z.string().min(1),
  rating: z.number().min(0).max(5),
  text: z.string().default(''),
  time: z.string().optional(),
  likes: z.number().int().nonnegative().optional(),
  url: z.string().url().optional(),
  placeId: z.string().optional(),
  lang: z.string().optional()
});

// Simple selector map - we'll inline this for now to avoid import issues
const selectorMap: Record<string, Record<string, string>> = {
  "base": {
    "card": ".jftiEf",
    "author": ".d4r55,[itemprop='author']",
    "rating": ".kvMYJc,[role='img'][aria-label*='Rated']",
    "text": ".wiI7pd,[jsname='fbQN7e']"
  },
  "vi-VN": {
    "rating": "[aria-label*='điểm'],[aria-label*='sao']",
    "text": ".wiI7pd,[jsname='fbQN7e']"
  }
};

function picks(locale: string) {
  const base = selectorMap["base"];
  const loc = selectorMap[locale] || {};
  return { ...base, ...loc };
}

export async function extractOnPage(page: Page, locale = 'en-US') {
  const S = picks(locale);

  // Define the extraction function as a string to avoid serialization issues
  const extractionFunction = `(function(S) {
    const $ = (sel, root = document) => root.querySelector(sel);
    const cards = document.querySelectorAll(S.card || '.jftiEf');
    const out = [];
    for (const el of cards) {
      const author = ($(S.author, el)?.innerText || '').trim();
      const ratingStr = ($(S.rating, el)?.getAttribute('aria-label') || '').match(/([\\d.]+)/)?.[1] || '0';
      const rating = Number(ratingStr);
      const text = ($(S.text, el)?.innerText || '').trim();
      out.push({ author, rating, text, lang: document.documentElement.lang || undefined });
    }
    return out;
  })`;

  const items: any[] = await page.evaluate(`${extractionFunction}(${JSON.stringify(S)})`);

  return items
    .map((r: any) => ReviewSchema.safeParse(r))
    .filter((p: any) => p.success)
    .map((p: any) => p.data);
}
