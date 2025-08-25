import {
  extractDomain,
  extractSubdomain,
  getBaseDomain,
  isSameBaseDomain,
  getRateLimit,
  calculateRateLimitDelay,
  isRateLimited,
  defaultRateLimits
} from '../domain-utils';

describe('Domain Utilities', () => {
  describe('extractDomain', () => {
    it('should extract domain from full URLs', () => {
      expect(extractDomain('https://www.example.com/path?query=1')).toBe('www.example.com');
      expect(extractDomain('http://sub.example.com:8080/api')).toBe('sub.example.com');
      expect(extractDomain('https://example.com')).toBe('example.com');
    });

    it('should handle URLs without protocol', () => {
      expect(extractDomain('www.example.com/path')).toBe('www.example.com');
      expect(extractDomain('example.com')).toBe('example.com');
    });

    it('should handle malformed URLs gracefully', () => {
      expect(extractDomain('not-a-url')).toBe('not-a-url');
      expect(extractDomain('')).toBe('unknown');
    });

    it('should return lowercase domains', () => {
      expect(extractDomain('https://WWW.EXAMPLE.COM')).toBe('www.example.com');
      expect(extractDomain('Example.Com')).toBe('example.com');
    });
  });

  describe('extractSubdomain', () => {
    it('should extract subdomain correctly', () => {
      expect(extractSubdomain('www.example.com')).toBe('www');
      expect(extractSubdomain('api.v2.example.com')).toBe('api.v2');
      expect(extractSubdomain('example.com')).toBe('root');
      expect(extractSubdomain('com')).toBe('root');
    });
  });

  describe('getBaseDomain', () => {
    it('should return base domain without subdomain', () => {
      expect(getBaseDomain('www.example.com')).toBe('example.com');
      expect(getBaseDomain('api.v2.example.com')).toBe('example.com');
      expect(getBaseDomain('example.com')).toBe('example.com');
      expect(getBaseDomain('com')).toBe('com');
    });
  });

  describe('isSameBaseDomain', () => {
    it('should identify same base domains', () => {
      expect(isSameBaseDomain('www.example.com', 'api.example.com')).toBe(true);
      expect(isSameBaseDomain('example.com', 'example.com')).toBe(true);
      expect(isSameBaseDomain('v1.api.example.com', 'v2.api.example.com')).toBe(true);
    });

    it('should identify different base domains', () => {
      expect(isSameBaseDomain('example.com', 'different.com')).toBe(false);
      expect(isSameBaseDomain('sub.example.com', 'other.com')).toBe(false);
    });
  });

  describe('getRateLimit', () => {
    it('should return specific domain rate limits', () => {
      const googleLimit = getRateLimit('google.com');
      expect(googleLimit.requestsPerSecond).toBe(1);
      expect(googleLimit.requestsPerMinute).toBe(30);
      expect(googleLimit.burstSize).toBe(3);
    });

    it('should return maps.google.com specific limits', () => {
      const mapsLimit = getRateLimit('maps.google.com');
      expect(mapsLimit.requestsPerSecond).toBe(0.5);
      expect(mapsLimit.requestsPerMinute).toBe(20);
      expect(mapsLimit.burstSize).toBe(2);
    });

    it('should return default limits for unknown domains', () => {
      const defaultLimit = getRateLimit('unknown.com');
      expect(defaultLimit.requestsPerSecond).toBe(2);
      expect(defaultLimit.requestsPerMinute).toBe(60);
      expect(defaultLimit.burstSize).toBe(5);
    });

    it('should match base domain for subdomains', () => {
      const subdomainLimit = getRateLimit('api.google.com');
      expect(subdomainLimit.requestsPerSecond).toBe(1); // Inherits from google.com
    });
  });

  describe('calculateRateLimitDelay', () => {
    it('should return 0 when within burst size', () => {
      const delay = calculateRateLimitDelay('example.com', Date.now(), 2);
      expect(delay).toBe(0);
    });

    it('should calculate delay based on requests per second', () => {
      const now = Date.now();
      const lastRequest = now - 500; // 500ms ago
      const delay = calculateRateLimitDelay('google.com', lastRequest, 5);
      
      // google.com allows 1 req/sec, so we need to wait 500ms
      expect(delay).toBeCloseTo(500, -1);
    });

    it('should respect burst size limits', () => {
      const now = Date.now();
      const lastRequest = now - 100; // 100ms ago
      const delay = calculateRateLimitDelay('maps.google.com', lastRequest, 3);
      
      // maps.google.com allows 0.5 req/sec and has burst size 2
      // With 3 requests, we're over burst size and need to wait
      expect(delay).toBeGreaterThan(0);
    });

    it('should return 0 when enough time has passed', () => {
      const now = Date.now();
      const lastRequest = now - 2000; // 2 seconds ago
      const delay = calculateRateLimitDelay('google.com', lastRequest, 5);
      
      // 2 seconds is enough for 1 req/sec, so no delay needed
      expect(delay).toBe(0);
    });
  });

  describe('isRateLimited', () => {
    it('should return true when rate limited', () => {
      const now = Date.now();
      const lastRequest = now - 100; // 100ms ago
      const isLimited = isRateLimited('google.com', lastRequest, 5);
      
      expect(isLimited).toBe(true);
    });

    it('should return false when not rate limited', () => {
      const now = Date.now();
      const lastRequest = now - 2000; // 2 seconds ago
      const isLimited = isRateLimited('google.com', lastRequest, 5);
      
      expect(isLimited).toBe(false);
    });

    it('should return false when within burst size', () => {
      const now = Date.now();
      const lastRequest = now - 100; // 100ms ago
      const isLimited = isRateLimited('google.com', lastRequest, 2);
      
      expect(isLimited).toBe(false);
    });
  });

  describe('defaultRateLimits', () => {
    it('should have google.com limits', () => {
      expect(defaultRateLimits['google.com']).toBeDefined();
      expect(defaultRateLimits['google.com'].requestsPerSecond).toBe(1);
      expect(defaultRateLimits['google.com'].cooldownMs).toBe(1000);
    });

    it('should have maps.google.com limits', () => {
      expect(defaultRateLimits['maps.google.com']).toBeDefined();
      expect(defaultRateLimits['maps.google.com'].requestsPerSecond).toBe(0.5);
      expect(defaultRateLimits['maps.google.com'].cooldownMs).toBe(2000);
    });

    it('should have default limits', () => {
      expect(defaultRateLimits['default']).toBeDefined();
      expect(defaultRateLimits['default'].requestsPerSecond).toBe(2);
      expect(defaultRateLimits['default'].cooldownMs).toBe(500);
    });
  });

  describe('edge cases', () => {
    it('should handle very recent requests', () => {
      const now = Date.now();
      const lastRequest = now - 1; // 1ms ago
      const delay = calculateRateLimitDelay('google.com', lastRequest, 5);
      
      expect(delay).toBeCloseTo(999, -1); // Should wait almost 1 second
    });

    it('should handle very old requests', () => {
      const now = Date.now();
      const lastRequest = now - 100000; // 100 seconds ago
      const delay = calculateRateLimitDelay('google.com', lastRequest, 5);
      
      expect(delay).toBe(0); // No delay needed
    });

    it('should handle zero request count', () => {
      const delay = calculateRateLimitDelay('google.com', Date.now(), 0);
      expect(delay).toBe(0);
    });
  });
});
