import type { Page } from 'playwright';
import { ReviewSchema } from '../schema/review.js';
import { reviewId } from '../id/review_id_node.js';

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
  const items = await page.evaluate((S: any) => {
    const $ = (sel: string, root: Element | Document = document) => root.querySelector(sel) as HTMLElement | null;
    const cards = document.querySelectorAll(S.card || '.jftiEf');
    const out: any[] = [];
    for (const el of cards) {
      const author = ($(S.author, el)?.innerText || '').trim();
      const ratingStr = ($(S.rating, el)?.getAttribute('aria-label') || '').match(/([\d.]+)/)?.[1] || '0';
      const rating = Number(ratingStr);
      const text = ($(S.text, el)?.innerText || '').trim();
      out.push({ author, rating, text, lang: document.documentElement.lang || undefined });
    }
    return out;
  }, S);

  const valid = items
    .map((r:any) => ReviewSchema.safeParse(r))
    .filter((p:any) => p.success)
    .map((p:any) => ({ ...p.data, id: reviewId(p.data) }));
  const seen = new Set<string>();
  return valid.filter((r:any)=> { if(seen.has(r.id)) return false; seen.add(r.id); return true; });
}
