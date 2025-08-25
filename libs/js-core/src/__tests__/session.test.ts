import { SessionPool } from '../session';

describe('SessionPool backoff', () => {
  test('penalize applies exponential delay', () => {
    const sp = new SessionPool({ size: 1, minScore: 0 });
    const s = sp.borrow();
    sp.penalize(s);
    const firstDelay = s.backoffUntil - Date.now();
    expect(firstDelay).toBeGreaterThanOrEqual(1000);
    sp.penalize(s);
    const secondDelay = s.backoffUntil - Date.now();
    expect(secondDelay).toBeGreaterThan(firstDelay);
  });

  test('borrow skips sessions in backoff', () => {
    const sp = new SessionPool({ size: 2, minScore: 0 });
    const s1 = sp.borrow();
    sp.penalize(s1);
    const s2 = sp.borrow();
    expect(s2.id).not.toBe(s1.id);
  });
});
