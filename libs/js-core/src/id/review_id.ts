import type { Review } from '../schema/review';

export function reviewId(r: Review): string {
  const key = [
    (r.placeId||'').trim().toLowerCase(),
    r.author.trim().toLowerCase(),
    (r.text||'').trim(),
    String(r.rating ?? ''),
    r.time || ''
  ].join('|');

  // Simple hash function for browser compatibility
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 16).padStart(16, '0');
}
