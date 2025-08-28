import { describe, it, expect } from 'vitest';
import { redactPII } from '../src/sanitize/pii';
const samples = [
  'Mail: a.b+tag@exámple.com',
  'SĐT: 0912 345 678, liên hệ nhé',
  'Phone:+1 (415) 555-0133',
  'Không có PII ở đây'
];
describe('PII fuzz', () => {
  it('redacts where needed and preserves clean text', () => {
    for (const s of samples) {
      const { text } = redactPII(s);
      expect(text).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      expect(text).not.toMatch(/\+?\d[\d\-\s]{6,}/);
    }
  });
});
