/**
 * Data normalization for raw review extraction
 */

import { ReviewElement, extractText, extractRating, extractPlaceId } from './dom';
import { maybeRedact } from '../../../libs/js-core/dist/sanitize/pii.js';
import { gm } from './polyfills/gm.js';

export interface RawReview {
  place_id?: unknown;
  review_id?: unknown;
  schema_version?: unknown;
  rating?: unknown;
  text?: unknown;
  user?: unknown;
  ts?: unknown; // epoch | iso string | null
}

/**
 * Convert DOM element to RawReview format
 */
export function toRawReview(reviewElement: ReviewElement): RawReview {
  const { reviewId, element } = reviewElement;

  return {
    place_id: extractPlaceId(),
    review_id: reviewId,
    schema_version: "v1",
    rating: extractRating(element),
    text: __REDACT__(extractReviewText(element) || ''),
    user: extractAuthor(element), // This will be processed in the extractor with pseudonymization
    ts: extractTimestamp(element)
  };
}

/**
 * Extract review text content
 */
function extractReviewText(element: HTMLElement): string | null {
  const selectors = [
    '[data-review-text]',
    '.review-text',
    '[jsaction*="review"] span',
    'span[lang]',
    'div[data-expandable-section]'
  ];

  return extractText(element, selectors);
}

/**
 * Extract author/user information
 */
function extractAuthor(element: HTMLElement): string | null {
  const selectors = [
    'a[href*="/maps/contrib"]',
    '.review-author',
    'button[data-value*="LocalGuide"]',
    'div[role="button"] span'
  ];

  return extractText(element, selectors);
}

/**
 * Extract timestamp information
 */
function extractTimestamp(element: HTMLElement): string | number | null {
  // Try datetime attribute first
  const timeElement = element.querySelector('time');
  if (timeElement?.dateTime) {
    return timeElement.dateTime;
  }

  // Try title attribute
  const titleElement = element.querySelector('span[title]');
  if (titleElement) {
    const title = getElementTitle(titleElement);
    if (title) {
      return title;
    }
  }

  // Try text content with relative time parsing
  const textSelectors = [
    '.review-time',
    'span[class*="time"]',
    'div[class*="date"]'
  ];

  const timeText = extractText(element, textSelectors);
  if (timeText) {
    return parseRelativeTime(timeText);
  }

  return null;
}

/**
 * Safely get the title attribute from an Element
 */
function getElementTitle(element: Element): string | null {
  if (element instanceof HTMLElement && element.title) {
    return element.title;
  }
  return element.getAttribute ? element.getAttribute('title') : null;
}

/**
 * Parse relative time expressions to approximate timestamp
 */
function parseRelativeTime(timeText: string): number | null {
  const now = Date.now();
  const text = timeText.toLowerCase();

  // Simple relative time parsing
  if (text.includes('minute')) {
    const match = text.match(/(\d+)\s*minute/);
    return match ? now - (parseInt(match[1]) * 60 * 1000) : now;
  }

  if (text.includes('hour')) {
    const match = text.match(/(\d+)\s*hour/);
    return match ? now - (parseInt(match[1]) * 60 * 60 * 1000) : now;
  }

  if (text.includes('day')) {
    const match = text.match(/(\d+)\s*day/);
    return match ? now - (parseInt(match[1]) * 24 * 60 * 60 * 1000) : now;
  }

  if (text.includes('week')) {
    const match = text.match(/(\d+)\s*week/);
    return match ? now - (parseInt(match[1]) * 7 * 24 * 60 * 60 * 1000) : now;
  }

  if (text.includes('month')) {
    const match = text.match(/(\d+)\s*month/);
    return match ? now - (parseInt(match[1]) * 30 * 24 * 60 * 60 * 1000) : now;
  }

  if (text.includes('year')) {
    const match = text.match(/(\d+)\s*year/);
    return match ? now - (parseInt(match[1]) * 365 * 24 * 60 * 60 * 1000) : now;
  }

  return null;
}

const __REDACT__ = (txt: string) => maybeRedact(txt, (gm.get('ARGUS_REDACT_PII', '1') ?? '1') === '1').text;
