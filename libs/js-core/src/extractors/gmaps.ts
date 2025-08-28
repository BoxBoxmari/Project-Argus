import type { Page } from 'playwright';
import { ReviewSchema } from '../schema/review.js';
import { reviewId } from '../id/review_id_node.js';
import { maybeRedact } from "../sanitize/pii.js";
import { authorHash as mkAuthorHash } from "../sanitize/pseudo.js";

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

  const enableRedact = process.env.ARGUS_REDACT_PII === '1';
  const valid = items
    .map((r:any) => {
      const red = maybeRedact(r.text || '', enableRedact);
      return { ...r, text: red.text, _pii: red.stats };
    })
    .map((r:any) => ReviewSchema.safeParse(r))
    .filter((p:any) => p.success)
    .map((p:any) => ({ ...p.data, id: reviewId(p.data) }));

  const seen = new Set<string>();
  const withAuth = await Promise.all(valid.map(async (r:any) => {
    if (process.env.ARGUS_PSEUDONYMIZE_AUTHOR === '1') {
      const salt = process.env.ARGUS_PII_SALT || 'argus-default-salt';
      const h = await mkAuthorHash(r.author || '', salt, 32);
      const drop = process.env.ARGUS_DROP_AUTHOR === '1';
      return { ...r, authorHash: h, author: drop ? '[redacted-author]' : r.author };
    }
    return r;
  }));
  return withAuth.filter((r:any)=> { if(seen.has(r.id)) return false; seen.add(r.id); return true; });
}
