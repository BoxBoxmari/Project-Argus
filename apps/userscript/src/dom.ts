/**
 * DOM utilities for review extraction
 */

import { L } from './locators';

export interface ReviewElement {
  reviewId: string;
  element: HTMLElement;
}

export interface ReviewSelectors {
  reviewContainer: string;
  reviewId: string;
  author: string;
  rating: string;
  text: string;
  timestamp: string;
}

const DEFAULT_SELECTORS: ReviewSelectors = {
  reviewContainer: L.pane,
  reviewId: '[data-review-id]',
  author: L.author,
  rating: L.rating,
  text: L.text,
  timestamp: 'span[title], .review-time, time'
};

/**
 * Find review elements using progressive selector strategy
 */
export function findReviewElements(selectors = DEFAULT_SELECTORS): ReviewElement[] {
  const elements: ReviewElement[] = [];

  // Try primary selectors first
  const containers = document.querySelectorAll(selectors.reviewContainer);

  for (const container of containers) {
    const element = container as HTMLElement;
    const reviewId = generateReviewId(element);

    if (reviewId) {
      elements.push({ reviewId, element });
    }
  }

  return elements;
}

/**
 * Generate review ID from element or create synthetic one
 */
function generateReviewId(element: HTMLElement): string | null {
  // Try to get existing review ID
  const existingId = element.getAttribute('data-review-id') ||
                    element.getAttribute('data-review-key') ||
                    element.id;

  if (existingId) return existingId;

  // Generate synthetic ID
  const author = element.querySelector('a')?.textContent?.trim();
  const timestamp = element.querySelector('time')?.getAttribute('datetime') ||
                   (element.querySelector('span[title]') as HTMLElement | null)?.title;

  if (author && timestamp) {
    return `${author}_${timestamp}`.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  }

  return null;
}

/**
 * Extract text content with fallbacks
 */
export function extractText(element: HTMLElement, selectors: string[]): string | null {
  for (const selector of selectors) {
    const target = element.querySelector(selector);
    if (target?.textContent?.trim()) {
      return target.textContent.trim();
    }
  }
  return null;
}

/**
 * Extract rating from element
 */
export function extractRating(element: HTMLElement, selectors = DEFAULT_SELECTORS): number | null {
  const ratingElement = element.querySelector(selectors.rating);

  if (ratingElement) {
    const ariaLabel = ratingElement.getAttribute('aria-label');
    if (ariaLabel) {
      const match = ariaLabel.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : null;
    }
  }

  return null;
}

/**
 * Extract place ID from current URL
 */
export function extractPlaceId(): string | null {
  const url = new URL(window.location.href);

  // Try different URL patterns
  const patterns = [
    /\/place\/([^\/\?]+)/,
    /place_id=([^&]+)/,
    /data=([^&]+)/
  ];

  for (const pattern of patterns) {
    const match = url.pathname.match(pattern) || url.search.match(pattern);
    if (match) return match[1];
  }

  return null;
}
