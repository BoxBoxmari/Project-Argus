// Intercept GMaps XHR to extract review payloads; emits unified Review[]
import { EventEmitter } from 'node:events';
import type { Page } from 'playwright';
import { Review, normalizeReview, Plugin } from '@argus/js-core';

export interface NetworkTapOptions {
  blockHeavyResources?: boolean;
  extractReviews?: boolean;
  saveArtifacts?: boolean;
}

export const tap = (page: Page, bus: EventEmitter) => {
  page.route('**/*', route => {
    const req = route.request();
    if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) return route.abort();
    return route.continue();
  });
  page.on('response', async (resp) => {
    const url = resp.url();
    if (!/googleusercontent|googleapis|maps\.google\.com/i.test(url)) return;
    try {
      const json = await resp.json();
      const items: Review[] = mapPayload(json);
      if (items.length) bus.emit('reviews', items.map(normalizeReview));
    } catch { /* ignore */ }
  });
};

function mapPayload(_payload: any): Review[] {
  // TODO: map thực, tạm thời trả mảng rỗng để build qua
  return [];
}

export function createNetworkTap(page: Page, emitter: EventEmitter) {
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('reviews') && url.includes('googleapis.com')) {
      try {
        const json = await response.json();
        if (json && json.reviews) {
          json.reviews.forEach((review: any) => {
            const normalized = normalizeReview({
              place_id: json.place_id || '',
              place_url: url,
              review_id: review.review_id || review.id || '',
              author: review.author_name || review.author || '',
              rating: review.rating || 0,
              text: review.text || review.review_text || '',
              relative_time: review.relative_time_description || '',
              time_unix: review.time || Date.now(),
              lang: review.language || 'en',
              crawl_meta: {
                run_id: process.env.ARGUS_RUN_ID || Date.now().toString(),
                session: 'playwright',
                ts: Date.now(),
                source: 'playwright',
                url: url
              }
            });
            emitter.emit('review', normalized);
          });
        }
      } catch (e) {
        console.error('Failed to parse review response:', e);
      }
    }
  });
}

export const networkTapPlugin = (bus: EventEmitter): Plugin => ({
  name: 'networkTap',
  init({ page }: { page: Page }) {
    tap(page, bus);
  },
  async run() {},
});
