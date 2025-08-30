import * as crypto from 'node:crypto';
import type { Review } from '../schema/review';

export function reviewId(r: Review): string {
  const key = [
    (r.placeId||'').trim().toLowerCase(),
    r.author.trim().toLowerCase(),
    (r.text||'').trim(),
    String(r.rating ?? ''),
    r.time || ''
  ].join('|');
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
}
