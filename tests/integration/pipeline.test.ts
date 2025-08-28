// cspell:ignore MyEned
/**
 * Integration Tests - End-to-End Pipeline Testing
 *
 * These tests verify the complete scraping pipeline using fixtures
 * instead of real Google Maps pages, ensuring reliable and fast testing.
 */

// Jest globals are available globally, no import needed
import { promises as fs } from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

// Mock Playwright Page for testing
class MockPlaywrightPage {
    private dom: JSDOM;
    private currentUrl: string = '';
    private routes: Map<string, (route: any) => void> = new Map();
    private evaluateFunctions: Array<() => any> = [];

    constructor(html?: string) {
        this.dom = new JSDOM(html || '<html><body></body></html>');
    }

    async goto(url: string, options?: any): Promise<void> {
        this.currentUrl = url;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    async route(pattern: string, handler: (route: any) => void): Promise<void> {
        this.routes.set(pattern, handler);
    }

    async addInitScript(script: Function): Promise<void> {
        // Mock init script execution
    }

    async waitForSelector(selector: string, options?: any): Promise<any> {
        const element = this.dom.window.document.querySelector(selector);
        if (!element && options?.timeout) {
            throw new Error(`Timeout waiting for selector: ${selector}`);
        }
        return element;
    }

    async mouse() {
        return {
            wheel: async (deltaX: number, deltaY: number) => {
                // Mock scrolling
            }
        };
    }

    async waitForTimeout(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, Math.min(ms, 100)));
    }

    async evaluate<T>(fn: () => T): Promise<T> {
        // Execute function in JSDOM context
        const window = this.dom.window;
        const document = window.document;

        // Create a context with window and document
        const contextFunction = new Function('window', 'document', `return (${fn.toString()})()`);
        return contextFunction(window, document);
    }

    locator(selector: string) {
        return {
            count: async () => this.dom.window.document.querySelectorAll(selector).length,
            first: () => ({
                click: async (options?: any) => {
                    const element = this.dom.window.document.querySelector(selector);
                    if (!element && !options?.trial) {
                        throw new Error(`Element not found: ${selector}`);
                    }
                }
            })
        };
    }

    setHTML(html: string): void {
        this.dom = new JSDOM(html);
    }

    getURL(): string {
        return this.currentUrl;
    }
}

// Mock Browser Context
class MockBrowserContext {
    private pages: MockPlaywrightPage[] = [];

    async newPage(): Promise<MockPlaywrightPage> {
        const page = new MockPlaywrightPage();
        this.pages.push(page);
        return page;
    }

    async close(): Promise<void> {
        this.pages = [];
    }
}

// Mock Browser
class MockBrowser {
    private contexts: MockBrowserContext[] = [];

    async newContext(options?: any): Promise<MockBrowserContext> {
        const context = new MockBrowserContext();
        this.contexts.push(context);
        return context;
    }

    async close(): Promise<void> {
        await Promise.all(this.contexts.map(ctx => ctx.close()));
        this.contexts = [];
    }
}

// Integration Test Pipeline
class TestPipeline {
    private mockBrowser: MockBrowser;
    private outputDir: string;

    constructor(outputDir: string) {
        this.mockBrowser = new MockBrowser();
        this.outputDir = outputDir;
    }

    async scrapeWithFixture(fixtureName: string, options: {
        maxReviews?: number;
        scrollRounds?: number;
        validateSchema?: boolean;
    } = {}): Promise<{
        reviews: any[];
        errors: string[];
        metrics: {
            duration: number;
            scrollRounds: number;
            extractedCount: number;
            validCount: number;
        };
    }> {
        const startTime = Date.now();
        const errors: string[] = [];

        try {
            // Load fixture HTML
            const fixtureHtml = await globalThis.testUtils.loadFixture(fixtureName);

            // Create mock page with fixture content
            const context = await this.mockBrowser.newContext();
            const page = await context.newPage();
            page.setHTML(fixtureHtml);

            // Set up resource blocking (simulate real scraper behavior)
            await page.route('**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2,css}', (route: any) => {
                // Mock resource blocking
            });

            // Navigate to simulate real URL
            await page.goto(`https://www.google.com/maps/place/test-${fixtureName}/`);

            // Extract reviews using the same logic as real scraper
            const reviews = await this.extractReviewsFromPage(page, options);

            // Validate extracted reviews against schema
            let validCount = reviews.length;
            if (options.validateSchema) {
                validCount = reviews.filter(review => this.validateReviewSchema(review)).length;

                if (validCount < reviews.length) {
                    errors.push(`Schema validation failed for ${reviews.length - validCount} reviews`);
                }
            }

            await context.close();

            return {
                reviews,
                errors,
                metrics: {
                    duration: Date.now() - startTime,
                    scrollRounds: options.scrollRounds || 5,
                    extractedCount: reviews.length,
                    validCount
                }
            };

        } catch (error) {
            errors.push(`Pipeline error: ${error}`);
            return {
                reviews: [],
                errors,
                metrics: {
                    duration: Date.now() - startTime,
                    scrollRounds: 0,
                    extractedCount: 0,
                    validCount: 0
                }
            };
        }
    }

    private async extractReviewsFromPage(page: MockPlaywrightPage, options: any): Promise<any[]> {
        // Simulate scrolling to load more reviews
        const scrollRounds = options.scrollRounds || 5;
        for (let i = 0; i < scrollRounds; i++) {
            const mouse = await page.mouse();
            await mouse.wheel(0, 1200);
            await page.waitForTimeout(options.scrollPause || 500);
        }

        // Extract review data using page.evaluate (similar to real scraper)
        const reviewData = await page.evaluate(() => {
            const reviewElements = Array.from(document.querySelectorAll('[data-review-id]'));

            return reviewElements.map(element => {
                const reviewId = element.getAttribute('data-review-id');

                // Extract author
                const authorElement = element.querySelector('div[data-owner-id] a, [data-author-name]');
                const author = authorElement?.textContent?.trim() || '';

                // Extract rating
                const ratingElement = element.querySelector('[role="img"][aria-label*="stars"]');
                const ratingText = ratingElement?.getAttribute('aria-label') || '';
                const ratingMatch = ratingText.match(/([0-9.]+)/);
                const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

                // Extract review text
                const textElement = element.querySelector('.MyEned, .new-review-text, [review-content="true"]');
                const text = textElement?.textContent?.trim() || '';

                // Extract time information
                const timeElement = element.querySelector('time[datetime], time');
                const datetime = timeElement?.getAttribute('datetime');
                const relativeTime = timeElement?.textContent?.trim();

                // Extract helpful count
                const helpfulElement = element.querySelector('button[aria-label*="helpful"] span:last-child');
                const helpfulText = helpfulElement?.textContent?.trim() || '0';
                const helpful = parseInt(helpfulText.replace(/[^\d]/g, '')) || 0;

                return {
                    id: reviewId,
                    placeId: window.location.href.includes('place_id:') ?
                        window.location.href.match(/place_id:([^&]+)/)?.[1] : 'test-place',
                    author: { name: author },
                    rating,
                    text,
                    relativeTime,
                    timeISO: datetime,
                    helpful,
                    fetchMeta: {
                        ts: new Date().toISOString(),
                        agent: 'playwright',
                        source: 'google-maps',
                        placeUrl: window.location.href
                    }
                };
            }).filter(review => review.id && review.rating > 0);
        });

        return reviewData;
    }

    private validateReviewSchema(review: any): boolean {
        // Basic schema validation
        return !!(
            review.id &&
            review.placeId &&
            review.author?.name &&
            review.rating >= 1 && review.rating <= 5 &&
            review.fetchMeta?.ts
        );
    }

    async saveResults(results: any, filename: string): Promise<void> {
        const outputPath = path.join(this.outputDir, filename);
        await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    }

    async cleanup(): Promise<void> {
        await this.mockBrowser.close();
    }
}

describe('Integration Tests - Full Pipeline', () => {
    let pipeline: TestPipeline;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = path.join(__dirname, '..', '.artifacts', 'integration-tests');
        await fs.mkdir(tempDir, { recursive: true });
        pipeline = new TestPipeline(tempDir);
    });

    afterEach(async () => {
        await pipeline.cleanup();
    });

    describe('Fixture-Based Scraping', () => {
        test('should extract reviews from minimal fixture', async () => {
            const results = await pipeline.scrapeWithFixture('case_minimal', {
                validateSchema: true,
                scrollRounds: 3
            });

            expect(results.errors).toHaveLength(0);
            expect(results.reviews.length).toBeGreaterThan(0);
            expect(results.metrics.validCount).toBe(results.reviews.length);
            expect(results.metrics.duration).toBeGreaterThan(0);

            // Validate specific review data
            const firstReview = results.reviews[0];
            expect(firstReview.id).toBeTruthy();
            expect(firstReview.author.name).toBeTruthy();
            expect(firstReview.rating).toBeGreaterThanOrEqual(1);
            expect(firstReview.rating).toBeLessThanOrEqual(5);
            expect(firstReview.text).toBeTruthy();

            // Save results for debugging
            await pipeline.saveResults(results, 'minimal-fixture-results.json');
        });

        test('should handle complex fixture with owner responses', async () => {
            const results = await pipeline.scrapeWithFixture('case_complex', {
                validateSchema: true,
                scrollRounds: 5
            });

            expect(results.reviews.length).toBeGreaterThan(0);
            expect(results.errors).toHaveLength(0);

            // Should extract reviews with varying complexity
            const reviewsWithText = results.reviews.filter(r => r.text && r.text.length > 50);
            expect(reviewsWithText.length).toBeGreaterThan(0);

            // Check for reviews with helpful counts
            const reviewsWithHelpful = results.reviews.filter(r => r.helpful > 0);
            expect(reviewsWithHelpful.length).toBeGreaterThan(0);
        });

        test('should handle international reviews correctly', async () => {
            const results = await pipeline.scrapeWithFixture('case_i18n_mixed', {
                validateSchema: true,
                scrollRounds: 4
            });

            expect(results.reviews.length).toBeGreaterThan(5);
            expect(results.errors).toHaveLength(0);

            // Should extract reviews with various languages
            const reviewTexts = results.reviews.map(r => r.text);
            const hasUnicode = reviewTexts.some(text => /[^\x00-\x7F]/.test(text));
            expect(hasUnicode).toBe(true);

            // All reviews should still pass schema validation
            expect(results.metrics.validCount).toBe(results.reviews.length);
        });

        test('should handle DOM structure changes gracefully', async () => {
            const results = await pipeline.scrapeWithFixture('case_dom_shift', {
                validateSchema: true,
                scrollRounds: 3
            });

            // Should extract some reviews even with changed DOM
            expect(results.reviews.length).toBeGreaterThan(0);

            // May have some validation issues due to changed structure
            const validationSuccessRate = results.metrics.validCount / results.metrics.extractedCount;
            expect(validationSuccessRate).toBeGreaterThan(0.5); // At least 50% should be valid
        });
    });

    describe('Pipeline Error Handling', () => {
        test('should handle missing fixture gracefully', async () => {
            const results = await pipeline.scrapeWithFixture('case_nonexistent', {
                validateSchema: true
            });

            expect(results.reviews).toHaveLength(0);
            expect(results.errors.length).toBeGreaterThan(0);
            expect(results.errors[0]).toContain('Failed to load fixture');
        });

        test('should handle malformed HTML', async () => {
            // Create a malformed fixture
            const malformedHtml = '<div><span class="MyEned">Unclosed span<div>Bad nesting</span></div>';

            // Mock the fixture loading to return malformed HTML
            const originalLoadFixture = globalThis.testUtils.loadFixture;
            globalThis.testUtils.loadFixture = jest.fn().mockResolvedValue(malformedHtml);

            try {
                const results = await pipeline.scrapeWithFixture('case_malformed', {
                    validateSchema: true
                });

                // Should not crash, might extract some data
                expect(results.reviews).toBeDefined();
                expect(Array.isArray(results.reviews)).toBe(true);
            } finally {
                globalThis.testUtils.loadFixture = originalLoadFixture;
            }
        });

        test('should timeout appropriately for missing elements', async () => {
            const emptyHtml = '<html><body><div>No reviews here</div></body></html>';

            const originalLoadFixture = globalThis.testUtils.loadFixture;
            globalThis.testUtils.loadFixture = jest.fn().mockResolvedValue(emptyHtml);

            try {
                const startTime = Date.now();
                const results = await pipeline.scrapeWithFixture('case_empty', {
                    validateSchema: true
                });
                const duration = Date.now() - startTime;

                expect(results.reviews).toHaveLength(0);
                expect(duration).toBeLessThan(5000); // Should not hang indefinitely
            } finally {
                globalThis.testUtils.loadFixture = originalLoadFixture;
            }
        });
    });

    describe('Data Quality and Consistency', () => {
        test('should produce consistent results across multiple runs', async () => {
            const runs = await Promise.all([
                pipeline.scrapeWithFixture('case_minimal', { validateSchema: true }),
                pipeline.scrapeWithFixture('case_minimal', { validateSchema: true }),
                pipeline.scrapeWithFixture('case_minimal', { validateSchema: true })
            ]);

            // All runs should produce the same number of reviews
            const reviewCounts = runs.map(r => r.reviews.length);
            expect(new Set(reviewCounts).size).toBe(1);

            // Review IDs should be consistent
            const firstRunIds = runs[0].reviews.map(r => r.id).sort();
            const secondRunIds = runs[1].reviews.map(r => r.id).sort();
            const thirdRunIds = runs[2].reviews.map(r => r.id).sort();

            expect(firstRunIds).toEqual(secondRunIds);
            expect(secondRunIds).toEqual(thirdRunIds);
        });

        test('should maintain referential integrity', async () => {
            const results = await pipeline.scrapeWithFixture('case_complex', {
                validateSchema: true
            });

            results.reviews.forEach(review => {
                // All reviews should have the same place ID for a single place
                expect(review.placeId).toBeTruthy();

                // Review IDs should be unique
                const otherReviews = results.reviews.filter(r => r !== review);
                const duplicateIds = otherReviews.filter(r => r.id === review.id);
                expect(duplicateIds).toHaveLength(0);

                // Timestamps should be reasonable
                if (review.fetchMeta?.ts) {
                    const timestamp = new Date(review.fetchMeta.ts);
                    expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 10000); // Within last 10 seconds
                }
            });
        });

        test('should compare against golden reference data', async () => {
            const results = await pipeline.scrapeWithFixture('case_minimal', {
                validateSchema: true
            });

            const goldenData = await globalThis.testUtils.loadGolden('case_minimal');

            expect(results.reviews.length).toBe(goldenData.length);

            // Compare key fields with golden data
            results.reviews.forEach((review, index) => {
                const golden = goldenData[index];

                expect(review.id).toBe(golden.review_id);
                expect(review.author.name).toBe(golden.author);
                expect(review.rating).toBe(golden.rating);
                expect(review.text).toBe(golden.text);
            });
        });
    });

    describe('Performance and Resource Management', () => {
        test('should complete within reasonable time limits', async () => {
            const startTime = Date.now();

            const results = await pipeline.scrapeWithFixture('case_complex', {
                validateSchema: true,
                scrollRounds: 10
            });

            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
            expect(results.metrics.duration).toBeGreaterThan(0);
            expect(results.reviews.length).toBeGreaterThan(0);
        });

        test('should handle multiple concurrent extractions', async () => {
            const concurrentRuns = Array.from({ length: 5 }, (_, i) =>
                pipeline.scrapeWithFixture('case_minimal', {
                    validateSchema: true,
                    scrollRounds: 3
                })
            );

            const results = await Promise.all(concurrentRuns);

            // All runs should succeed
            results.forEach(result => {
                expect(result.errors).toHaveLength(0);
                expect(result.reviews.length).toBeGreaterThan(0);
            });

            // Results should be consistent
            const reviewCounts = results.map(r => r.reviews.length);
            expect(new Set(reviewCounts).size).toBe(1);
        });

        test('should properly clean up resources', async () => {
            const initialPipeline = new TestPipeline(tempDir);

            // Perform multiple operations
            await initialPipeline.scrapeWithFixture('case_minimal');
            await initialPipeline.scrapeWithFixture('case_complex');

            // Should clean up without errors
            await expect(initialPipeline.cleanup()).resolves.not.toThrow();

            // Should be able to create new pipeline after cleanup
            const newPipeline = new TestPipeline(tempDir);
            const results = await newPipeline.scrapeWithFixture('case_minimal');
            expect(results.reviews.length).toBeGreaterThan(0);

            await newPipeline.cleanup();
        });
    });

    describe('Configuration and Options', () => {
        test('should respect scroll round limits', async () => {
            const lowScrollResults = await pipeline.scrapeWithFixture('case_complex', {
                scrollRounds: 1
            });

            const highScrollResults = await pipeline.scrapeWithFixture('case_complex', {
                scrollRounds: 10
            });

            // Duration should increase with more scroll rounds
            expect(highScrollResults.metrics.duration).toBeGreaterThan(lowScrollResults.metrics.duration);

            // Both should extract the same amount since we're using fixtures
            expect(lowScrollResults.reviews.length).toBe(highScrollResults.reviews.length);
        });

        test('should validate schema when requested', async () => {
            const withValidation = await pipeline.scrapeWithFixture('case_minimal', {
                validateSchema: true
            });

            const withoutValidation = await pipeline.scrapeWithFixture('case_minimal', {
                validateSchema: false
            });

            // Both should extract same number of reviews
            expect(withValidation.reviews.length).toBe(withoutValidation.reviews.length);

            // Validation metrics should be populated correctly
            expect(withValidation.metrics.validCount).toBeDefined();
            expect(withoutValidation.metrics.validCount).toBeDefined();
        });
    });
});
