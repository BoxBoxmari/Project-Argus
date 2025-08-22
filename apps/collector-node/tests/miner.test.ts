import { SELS, qsAny } from '../src/core/selectors';
import { progressEmit, progressListen, ProgressMsg } from '../src/core/bus';
import { ReviewData } from '../src/miner/reviews';

describe('Core Selectors', () => {
  test('SELS contains required selectors', () => {
    expect(SELS.panel).toBeDefined();
    expect(SELS.reviewItem).toBeDefined();
    expect(SELS.moreBtn).toBeDefined();
    expect(Array.isArray(SELS.panel)).toBe(true);
    expect(SELS.panel.length).toBeGreaterThan(0);
  });

  test('qsAny returns null when no elements found', () => {
    // Mock document
    const mockDocument = {
      querySelector: jest.fn().mockReturnValue(null)
    } as any;

    const result = qsAny(['nonexistent'], mockDocument);
    expect(result).toBeNull();
  });

  test('qsAny returns first found element', () => {
    const mockElement = { id: 'test' };
    const mockDocument = {
      querySelector: jest.fn()
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockElement)
    } as any;

    const result = qsAny(['nonexistent', 'found'], mockDocument);
    expect(result).toBe(mockElement);
  });
});

describe('Progress Bus', () => {
  test('progressEmit handles missing APIs gracefully', () => {
    const msg: ProgressMsg = {
      type: 'progress',
      url: 'test-url',
      count: 5,
      ts: Date.now()
    };

    // Should not throw even if BroadcastChannel is not available
    expect(() => progressEmit(msg)).not.toThrow();
  });

  test('progressListen returns cleanup function', () => {
    const callback = jest.fn();
    const cleanup = progressListen(callback);
    
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });
});

describe('Review Data Types', () => {
  test('ReviewData interface has required fields', () => {
    const review: ReviewData = {
      review_id: 'test-id',
      author: 'Test Author',
      relative_time: '2 days ago',
      text: 'Great place!',
      rating: 5,
      translated: false,
      likes: 10,
      photos: 2
    };

    expect(review.review_id).toBe('test-id');
    expect(review.author).toBe('Test Author');
    expect(review.rating).toBe(5);
    expect(review.translated).toBe(false);
  });
});
