import { URL } from 'url';

/**
 * Extract domain from URL for rate limiting purposes
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    // Fallback for malformed URLs
    const match = url.match(/^(?:https?:\/\/)?([^\/\?#]+)/i);
    return match ? match[1].toLowerCase() : 'unknown';
  }
}

/**
 * Extract subdomain from domain
 */
export function extractSubdomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length <= 2) return 'root';
  return parts.slice(0, -2).join('.');
}

/**
 * Get base domain (without subdomain) for grouping rate limits
 */
export function getBaseDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join('.');
}

/**
 * Check if two domains belong to the same base domain
 */
export function isSameBaseDomain(domain1: string, domain2: string): boolean {
  return getBaseDomain(domain1) === getBaseDomain(domain2);
}

/**
 * Rate limiting configuration per domain
 */
export interface DomainRateLimit {
  requestsPerSecond: number;
  requestsPerMinute: number;
  burstSize: number;
  cooldownMs: number;
}

/**
 * Default rate limits for common domains
 */
export const defaultRateLimits: Record<string, DomainRateLimit> = {
  'google.com': {
    requestsPerSecond: 1,
    requestsPerMinute: 30,
    burstSize: 3,
    cooldownMs: 1000
  },
  'maps.google.com': {
    requestsPerSecond: 0.5,
    requestsPerMinute: 20,
    burstSize: 2,
    cooldownMs: 2000
  },
  'default': {
    requestsPerSecond: 2,
    requestsPerMinute: 60,
    burstSize: 5,
    cooldownMs: 500
  }
};

/**
 * Get rate limit configuration for a domain
 */
export function getRateLimit(domain: string): DomainRateLimit {
  const baseDomain = getBaseDomain(domain);
  
  // Check for exact domain match
  if (defaultRateLimits[domain]) {
    return defaultRateLimits[domain];
  }
  
  // Check for base domain match
  if (defaultRateLimits[baseDomain]) {
    return defaultRateLimits[baseDomain];
  }
  
  // Return default
  return defaultRateLimits.default;
}

/**
 * Calculate delay needed to respect rate limits
 */
export function calculateRateLimitDelay(
  domain: string,
  lastRequestTime: number,
  requestCount: number
): number {
  const rateLimit = getRateLimit(domain);
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  // If we're within burst size, allow immediate request
  if (requestCount < rateLimit.burstSize) {
    return 0;
  }
  
  // Calculate minimum delay between requests
  const minDelayMs = 1000 / rateLimit.requestsPerSecond;
  
  // If we need to wait
  if (timeSinceLastRequest < minDelayMs) {
    return minDelayMs - timeSinceLastRequest;
  }
  
  return 0;
}

/**
 * Check if a domain is currently rate limited
 */
export function isRateLimited(
  domain: string,
  lastRequestTime: number,
  requestCount: number
): boolean {
  return calculateRateLimitDelay(domain, lastRequestTime, requestCount) > 0;
}
