// cspell:ignore đánh MyEned émojis spëcial
/**
 * Unit Tests - Review Parsing and Field Extraction
 *
 * These tests focus on testing individual parsing functions in isolation,
 * using mocked DOM elements and fixtures to ensure robust extraction logic.
 */

// Jest globals are available globally, no import needed
import { JSDOM } from 'jsdom';
import { asElement, asHTMLElement, safeTextContent, createTestDocument } from '../utils/dom-guards';

// Mock the browser extraction functions
class ReviewExtractor {
    static extractReviewId(element: Element): string | null {
        return element.getAttribute('data-review-id') ||
            element.getAttribute('data-review-uuid') ||
            element.getAttribute('review-id') ||
            null;
    }

    static extractAuthor(element: Element): { name: string; url?: string; localGuide?: boolean; reviewCount?: number } | null {
        const authorSelectors = [
            'div[data-owner-id] a',
            '[data-author-name]',
            'a[href*="/contrib/"]'
        ];

        let authorElement: Element | null = null;
        let authorName = '';

        for (const selector of authorSelectors) {
            authorElement = element.querySelector(selector);
            if (authorElement) {
                authorName = authorElement.textContent?.trim() ||
                    authorElement.getAttribute('data-author-name') || '';
                if (authorName) break;
            }
        }

        if (!authorName) return null;

        const containerText = element.textContent || '';
        const localGuide = containerText.includes('Local Guide');
        const reviewCountMatch = containerText.match(/(\d+)\s*(?:reviews?|đánh giá)/i);
        const reviewCount = reviewCountMatch ? parseInt(reviewCountMatch[1], 10) : undefined;

        return {
            name: authorName,
            url: authorElement instanceof HTMLAnchorElement ? authorElement.href : undefined,
            localGuide,
            reviewCount
        };
    }

    static extractRating(element: Element): number | null {
        const ratingElement = element.querySelector('[role="img"][aria-label*="stars"], [stars]');
        if (ratingElement) {
            const ariaLabel = ratingElement.getAttribute('aria-label');
            if (ariaLabel) {
                const ratingMatch = ariaLabel.match(/([0-9.]+)/);
                if (ratingMatch) {
                    const rating = parseFloat(ratingMatch[1]);
                    if (rating >= 1 && rating <= 5) return rating;
                }
            }

            const starsAttr = ratingElement.getAttribute('stars');
            if (starsAttr) {
                const rating = parseFloat(starsAttr);
                if (rating >= 1 && rating <= 5) return rating;
            }
        }
        return null;
    }

    static extractReviewText(element: Element): string | null {
        const textSelectors = ['.MyEned', '.new-review-text', '[review-content="true"]'];

        for (const selector of textSelectors) {
            const textElement = element.querySelector(selector);
            if (textElement) {
                const text = textElement.textContent?.trim();
                if (text && text.length > 0) return text;
            }
        }
        return null;
    }

    static normalizeReviewText(text: string | null): string | null {
        if (!text) return null;
        return text.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
    }

    static extractPlaceId(url: string): string | null {
        const placeIdMatch = url.match(/place_id:([^&\s]+)/);
        return placeIdMatch ? placeIdMatch[1] : null;
    }
}

describe('Review Parsing Unit Tests', () => {
    let dom: JSDOM;
    let document: Document;

    beforeEach(() => {
        dom = new JSDOM();
        document = dom.window.document;
        (global as any).document = document;
    });

    describe('extractReviewId', () => {
        test('should extract review ID from data-review-id attribute', () => {
            const element = document.createElement('div');
            element.setAttribute('data-review-id', 'ChdDSUhNMG9nS0VJQ0FnSURhcU1ESzF3RRAB');

            const reviewId = ReviewExtractor.extractReviewId(element);
            expect(reviewId).toBe('ChdDSUhNMG9nS0VJQ0FnSURhcU1ESzF3RRAB');
        });

        test('should handle alternative attributes', () => {
            const element = document.createElement('div');
            element.setAttribute('data-review-uuid', 'uuid-123-456');

            const reviewId = ReviewExtractor.extractReviewId(element);
            expect(reviewId).toBe('uuid-123-456');
        });

        test('should return null when no review ID found', () => {
            const element = document.createElement('div');
            const reviewId = ReviewExtractor.extractReviewId(element);
            expect(reviewId).toBeNull();
        });
    });

    describe('extractAuthor', () => {
        test('should extract author name and detect local guide', () => {
            const html = `
        <div data-review-id="test">
          <div data-owner-id="123">
            <div><div><a href="/maps/contrib/123456789">John Smith</a></div></div>
            <div><span>Local Guide</span><span>·</span><span>25 reviews</span></div>
          </div>
        </div>
      `;

            const element = document.createElement('div');
            element.innerHTML = html;

            const author = ReviewExtractor.extractAuthor(element);
            expect(author?.name).toBe('John Smith');
            expect(author?.localGuide).toBe(true);
            expect(author?.reviewCount).toBe(25);
        });

        test('should return null when no author found', () => {
            const element = document.createElement('div');
            const author = ReviewExtractor.extractAuthor(element);
            expect(author).toBeNull();
        });
    });

    describe('extractRating', () => {
        test('should extract rating from aria-label', () => {
            const html = `<div><span role="img" aria-label="4 stars">★★★★☆</span></div>`;
            const element = document.createElement('div');
            element.innerHTML = html;

            const rating = ReviewExtractor.extractRating(element);
            expect(rating).toBe(4);
        });

        test('should extract rating from stars attribute', () => {
            const html = `<div><span stars="3">★★★☆☆</span></div>`;
            const element = document.createElement('div');
            element.innerHTML = html;

            const rating = ReviewExtractor.extractRating(element);
            expect(rating).toBe(3);
        });

        test('should reject invalid ratings', () => {
            const html = `<div><span role="img" aria-label="6 stars">★</span></div>`;
            const element = document.createElement('div');
            element.innerHTML = html;

            const rating = ReviewExtractor.extractRating(element);
            expect(rating).toBeNull();
        });
    });

    describe('extractReviewText', () => {
        test('should extract text from MyEned class', () => {
            const html = `<div><span class="MyEned">Great coffee!</span></div>`;
            const element = document.createElement('div');
            element.innerHTML = html;

            const text = ReviewExtractor.extractReviewText(element);
            expect(text).toBe('Great coffee!');
        });

        test('should handle alternative selectors', () => {
            const html = `<div><span class="new-review-text">New UI text</span></div>`;
            const element = document.createElement('div');
            element.innerHTML = html;

            const text = ReviewExtractor.extractReviewText(element);
            expect(text).toBe('New UI text');
        });

        test('should return null when no text found', () => {
            const element = document.createElement('div');
            const text = ReviewExtractor.extractReviewText(element);
            expect(text).toBeNull();
        });
    });

    describe('normalizeReviewText', () => {
        test('should normalize whitespace', () => {
            const input = '  Great   coffee    and   service!  ';
            const normalized = ReviewExtractor.normalizeReviewText(input);
            expect(normalized).toBe('Great coffee and service!');
        });

        test('should handle null input', () => {
            const normalized = ReviewExtractor.normalizeReviewText(null);
            expect(normalized).toBeNull();
        });

        test('should replace non-breaking spaces', () => {
            const input = 'Great\u00A0coffee';
            const normalized = ReviewExtractor.normalizeReviewText(input);
            expect(normalized).toBe('Great coffee');
        });
    });

    describe('extractPlaceId', () => {
        test('should extract place ID from URL', () => {
            const url = 'https://www.google.com/maps/place/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4';
            const placeId = ReviewExtractor.extractPlaceId(url);
            expect(placeId).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
        });

        test('should return null for URLs without place ID', () => {
            const url = 'https://www.google.com/maps/search/coffee';
            const placeId = ReviewExtractor.extractPlaceId(url);
            expect(placeId).toBeNull();
        });
    });

    describe('Integration Tests', () => {
        test('should extract complete review from minimal fixture', async () => {
            const fixtureHtml = await globalThis.testUtils.loadFixture('case_minimal');
            const dom = new JSDOM(fixtureHtml);
            const reviewElements = dom.window.document.querySelectorAll('[data-review-id]');

            expect(reviewElements.length).toBeGreaterThan(0);

            const firstReview = reviewElements[0];
            const reviewId = ReviewExtractor.extractReviewId(firstReview);
            const author = ReviewExtractor.extractAuthor(firstReview);
            const rating = ReviewExtractor.extractRating(firstReview);
            const text = ReviewExtractor.extractReviewText(firstReview);

            expect(reviewId).toBeTruthy();
            expect(author?.name).toBeTruthy();
            expect(rating).toBeGreaterThanOrEqual(1);
            expect(rating).toBeLessThanOrEqual(5);
            expect(text).toBeTruthy();
        });

        test('should handle DOM changes gracefully', async () => {
            const fixtureHtml = await globalThis.testUtils.loadFixture('case_dom_shift');
            const dom = new JSDOM(fixtureHtml);
            const reviewElements = dom.window.document.querySelectorAll('[data-review-id], [data-review-uuid]');

            expect(reviewElements.length).toBeGreaterThan(0);

            // Should extract some data even with changed DOM structure
            let successfulExtractions = 0;
            reviewElements.forEach(element => {
                const reviewId = ReviewExtractor.extractReviewId(element);
                if (reviewId) successfulExtractions++;
            });

            expect(successfulExtractions).toBeGreaterThan(0);
        });

        test('should validate against golden data', async () => {
            const fixtureHtml = await globalThis.testUtils.loadFixture('case_minimal');
            const goldenData = await globalThis.testUtils.loadGolden('case_minimal');

            const dom = new JSDOM(fixtureHtml);
            const reviewElements = dom.window.document.querySelectorAll('[data-review-id]');

            expect(reviewElements.length).toBe(goldenData.length);

            // Compare extracted data with golden reference
            Array.from(reviewElements).forEach((element, index) => {
                const safeElement = asElement(element);
                const reviewId = ReviewExtractor.extractReviewId(safeElement);
                const author = ReviewExtractor.extractAuthor(safeElement);
                const rating = ReviewExtractor.extractRating(safeElement);

                const golden = goldenData[index];
                expect(reviewId).toBe(golden.review_id);
                expect(author?.name).toBe(golden.author);
                expect(rating).toBe(golden.rating);
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed HTML gracefully', () => {
            const malformedHtml = '<div><span class="MyEned">Unclosed span<div>Nested incorrectly</span></div>';
            const element = document.createElement('div');
            element.innerHTML = malformedHtml;

            // Should not throw errors
            expect(() => {
                ReviewExtractor.extractReviewText(element);
                ReviewExtractor.extractAuthor(element);
                ReviewExtractor.extractRating(element);
            }).not.toThrow();
        });

        test('should handle empty elements', () => {
            const element = document.createElement('div');

            expect(ReviewExtractor.extractReviewId(element)).toBeNull();
            expect(ReviewExtractor.extractAuthor(element)).toBeNull();
            expect(ReviewExtractor.extractRating(element)).toBeNull();
            expect(ReviewExtractor.extractReviewText(element)).toBeNull();
        });

        test('should handle special characters in text', () => {
            const html = `<div><span class="MyEned">Review with émojis 🍕 and spëcial chars ñ</span></div>`;
            const element = document.createElement('div');
            element.innerHTML = html;

            const text = ReviewExtractor.extractReviewText(element);
            expect(text).toContain('émojis');
            expect(text).toContain('🍕');
            expect(text).toContain('ñ');
        });
    });
});
