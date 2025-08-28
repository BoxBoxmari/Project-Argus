import { describe, it, expect } from 'vitest';
import { redactPII } from '../../src/sanitize/pii';
describe('PII redact', () => {
  it('redacts email and phones', () => {
    const s = 'Email a@b.com and phone +84 912-345-678';
    const { text, stats } = redactPII(s);
    expect(text).not.toContain('a@b.com');
    expect(text).not.toContain('912-345-678');
    expect(stats.emails).toBe(1);
    expect(stats.phones).toBe(1);
  });
});
