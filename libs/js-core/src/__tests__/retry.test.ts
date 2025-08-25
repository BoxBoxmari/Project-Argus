import { retry, retryWithStrategy, retryStrategies, RetryError } from '../retry';

describe('Retry Mechanism', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('retry function', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const promise = retry(mockFn, {
        retries: 3,
        baseMs: 100,
        capMs: 1000
      });
      
      jest.runAllTimers();
      const result = await promise;
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');
      
      const promise = retry(mockFn, {
        retries: 3,
        baseMs: 100,
        capMs: 1000
      });
      
      // First attempt fails
      jest.advanceTimersByTime(100);
      // Second attempt fails
      jest.advanceTimersByTime(200);
      // Third attempt succeeds
      jest.advanceTimersByTime(400);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw RetryError after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      
      const promise = retry(mockFn, {
        retries: 2,
        baseMs: 100,
        capMs: 1000
      });
      
      // Run all timers
      jest.runAllTimers();
      
      await expect(promise).rejects.toThrow(RetryError);
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should apply exponential backoff', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failure'));
      const onRetry = jest.fn();
      
      const promise = retry(mockFn, {
        retries: 3,
        baseMs: 100,
        capMs: 1000,
        onRetry
      });
      
      // First retry should wait ~100ms
      jest.advanceTimersByTime(100);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
      
      // Second retry should wait ~200ms
      jest.advanceTimersByTime(200);
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number));
      
      // Third retry should wait ~400ms
      jest.advanceTimersByTime(400);
      expect(onRetry).toHaveBeenCalledWith(3, expect.any(Error), expect.any(Number));
      
      jest.runAllTimers();
      await expect(promise).rejects.toThrow(RetryError);
    });

    it('should respect capMs limit', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failure'));
      const onRetry = jest.fn();
      
      const promise = retry(mockFn, {
        retries: 3,
        baseMs: 1000,
        capMs: 1500,
        onRetry
      });
      
      // First retry: 1000ms
      jest.advanceTimersByTime(1000);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
      
      // Second retry: capped at 1500ms instead of 2000ms
      jest.advanceTimersByTime(1500);
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number));
      
      jest.runAllTimers();
      await expect(promise).rejects.toThrow(RetryError);
    });

    it('should add jitter to delays', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failure'));
      const delays: number[] = [];
      
      const promise = retry(mockFn, {
        retries: 2,
        baseMs: 100,
        capMs: 1000,
        jitter: 0.2,
        onRetry: (attempt, error, delay) => {
          delays.push(delay);
        }
      });
      
      jest.runAllTimers();
      await expect(promise).rejects.toThrow(RetryError);
      
      // Delays should have some variation due to jitter
      expect(delays.length).toBe(2);
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(100);
        expect(delay).toBeLessThanOrEqual(120); // 100 + 20% jitter
      });
    });

    it('should use custom factor for backoff', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failure'));
      const delays: number[] = [];
      
      const promise = retry(mockFn, {
        retries: 2,
        baseMs: 100,
        capMs: 1000,
        factor: 1.5,
        onRetry: (attempt, error, delay) => {
          delays.push(delay);
        }
      });
      
      jest.runAllTimers();
      await expect(promise).rejects.toThrow(RetryError);
      
      // With factor 1.5: 100 -> 150 -> 225
      expect(delays[0]).toBeCloseTo(100, 0);
      expect(delays[1]).toBeCloseTo(150, 0);
    });
  });

  describe('retryStrategies', () => {
    it('should have rateLimit strategy', () => {
      expect(retryStrategies.rateLimit).toBeDefined();
      expect(retryStrategies.rateLimit.retries).toBe(5);
      expect(retryStrategies.rateLimit.baseMs).toBe(1000);
      expect(retryStrategies.rateLimit.shouldRetry).toBeDefined();
    });

    it('should have network strategy', () => {
      expect(retryStrategies.network).toBeDefined();
      expect(retryStrategies.network.retries).toBe(3);
      expect(retryStrategies.network.baseMs).toBe(500);
      expect(retryStrategies.network.shouldRetry).toBeDefined();
    });

    it('should have serverError strategy', () => {
      expect(retryStrategies.serverError).toBeDefined();
      expect(retryStrategies.serverError.retries).toBe(3);
      expect(retryStrategies.serverError.baseMs).toBe(2000);
      expect(retryStrategies.serverError.shouldRetry).toBeDefined();
    });

    it('should have aggressive strategy', () => {
      expect(retryStrategies.aggressive).toBeDefined();
      expect(retryStrategies.aggressive.retries).toBe(10);
      expect(retryStrategies.aggressive.baseMs).toBe(100);
      expect(retryStrategies.aggressive.factor).toBe(1.5);
    });
  });

  describe('shouldRetry logic', () => {
    it('should retry rate limit errors', () => {
      const strategy = retryStrategies.rateLimit;
      expect(strategy.shouldRetry!(new Error('429 Too Many Requests'), 1)).toBe(true);
      expect(strategy.shouldRetry!(new Error('Rate limit exceeded'), 1)).toBe(true);
      expect(strategy.shouldRetry!(new Error('Normal error'), 1)).toBe(false);
    });

    it('should retry network errors', () => {
      const strategy = retryStrategies.network;
      expect(strategy.shouldRetry!(new Error('ECONNRESET'), 1)).toBe(true);
      expect(strategy.shouldRetry!(new Error('ETIMEDOUT'), 1)).toBe(true);
      expect(strategy.shouldRetry!(new Error('Normal error'), 1)).toBe(false);
    });

    it('should retry server errors', () => {
      const strategy = retryStrategies.serverError;
      expect(strategy.shouldRetry!(new Error('500 Internal Server Error'), 1)).toBe(true);
      expect(strategy.shouldRetry!(new Error('502 Bad Gateway'), 1)).toBe(true);
      expect(strategy.shouldRetry!(new Error('Normal error'), 1)).toBe(false);
    });
  });

  describe('retryWithStrategy', () => {
    it('should use predefined strategy by name', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Rate limit'));
      
      const promise = retryWithStrategy(mockFn, 'rateLimit');
      
      jest.runAllTimers();
      await expect(promise).rejects.toThrow(RetryError);
      
      expect(mockFn).toHaveBeenCalledTimes(6); // Initial + 5 retries
    });

    it('should use custom strategy object', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failure'));
      
      const promise = retryWithStrategy(mockFn, {
        retries: 1,
        baseMs: 50,
        capMs: 100
      });
      
      jest.runAllTimers();
      await expect(promise).rejects.toThrow(RetryError);
      
      expect(mockFn).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('RetryError', () => {
    it('should contain attempt count and last error', () => {
      const originalError = new Error('Original error');
      const retryError = new RetryError('Retry failed', originalError, 3);
      
      expect(retryError.message).toBe('Retry failed');
      expect(retryError.lastError).toBe(originalError);
      expect(retryError.attempts).toBe(3);
      expect(retryError.name).toBe('RetryError');
    });
  });
});
