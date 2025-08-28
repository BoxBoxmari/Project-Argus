/**
 * End-to-End Tests - Data Quality and Real-world Scenarios
 *
 * These tests focus on data quality validation, deduplication,
 * and scenarios that mimic real-world usage patterns.
 */

// Jest globals are available globally, no import needed
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('E2E Tests - Data Quality and Real-world Scenarios', () => {
    const testDataDir = path.join(process.cwd(), '.artifacts', 'e2e-quality-test-data');
    const tempOutputDir = path.join(testDataDir, 'output');

    beforeEach(async () => {
        await fs.mkdir(testDataDir, { recursive: true });
        await fs.mkdir(tempOutputDir, { recursive: true });
    });

    afterEach(async () => {
        if (existsSync(testDataDir)) {
            await fs.rm(testDataDir, { recursive: true, force: true });
        }
    });

    describe('Data Quality Gates and Validation', () => {
        test('should validate data against golden standards', async () => {
            const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_minimal', 'index.html')}`;
            const outputFile = path.join(tempOutputDir, 'quality-validation.ndjson');
            const goldenFile = path.join(process.cwd(), 'tests', 'golden', 'case_minimal.json');

            // Extract reviews
            const { stdout, stderr } = await execAsync(`node apps/scraper-playwright/dist/cli.js --url "${fixtureUrl}" --output "${outputFile}" --headless true`, {
                cwd: process.cwd(),
                timeout: 30000
            });

            expect(existsSync(outputFile)).toBe(true);

            // Load extracted and golden data
            const extractedContent = await fs.readFile(outputFile, 'utf-8');
            const extractedReviews = extractedContent.trim().split('\n').map(line => JSON.parse(line));

            const goldenContent = await fs.readFile(goldenFile, 'utf-8');
            const goldenData = JSON.parse(goldenContent);

            // Validate structure compliance
            for (const review of extractedReviews) {
                validateReviewStructure(review);
            }

            // Compare key metrics with golden data
            expect(extractedReviews.length).toBeGreaterThanOrEqual(goldenData.expected_min_reviews);

            // Validate rating distribution
            const ratingDistribution = calculateRatingDistribution(extractedReviews);
            expect(ratingDistribution[5]).toBeGreaterThan(0); // Should have some 5-star reviews
        });

        test('should enforce schema constraints and data types', async () => {
            const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_complex', 'index.html')}`;
            const outputFile = path.join(tempOutputDir, 'schema-validation.ndjson');

            const { stdout } = await execAsync(`node apps/scraper-playwright/dist/cli.js --url "${fixtureUrl}" --output "${outputFile}" --strict-schema true --headless true`, {
                cwd: process.cwd(),
                timeout: 45000
            });

            const extractedContent = await fs.readFile(outputFile, 'utf-8');
            const reviews = extractedContent.trim().split('\n').map(line => JSON.parse(line));

            for (const review of reviews) {
                // Required fields
                expect(review.place_id).toBeDefined();
                expect(review.review_id).toBeDefined();
                expect(review.rating).toBeDefined();
                expect(review.scraped_at_utc).toBeDefined();

                // Data types
                expect(typeof review.place_id).toBe('string');
                expect(typeof review.review_id).toBe('string');
                expect(typeof review.rating).toBe('number');
                expect(typeof review.scraped_at_utc).toBe('string');

                // Value constraints
                expect(review.rating).toBeGreaterThanOrEqual(1);
                expect(review.rating).toBeLessThanOrEqual(5);
                expect(Number.isInteger(review.rating)).toBe(true);

                // Date format validation
                expect(() => new Date(review.scraped_at_utc)).not.toThrow();
                expect(new Date(review.scraped_at_utc).toISOString()).toBe(review.scraped_at_utc);
            }
        });

        test('should handle data quality issues with appropriate warnings', async () => {
            // Create a fixture with quality issues
            const problematicFixture = `
                <html>
                    <body>
                        <div data-review-id="review1">
                            <span class="rating">3</span>
                            <span class="text"></span> <!-- Empty text -->
                            <span class="author">John Doe</span>
                        </div>
                        <div data-review-id="review2">
                            <span class="rating">5</span>
                            <span class="text">Great place!</span>
                            <span class="author">😀 Emoji User 🌟</span> <!-- Unusual characters -->
                        </div>
                        <div data-review-id="review3">
                            <span class="rating">4</span>
                            <span class="text">${'A'.repeat(5000)}</span> <!-- Very long text -->
                            <span class="author">Long Reviewer</span>
                        </div>
                        <div data-review-id="review4">
                            <span class="rating">2</span>
                            <span class="text">Review with \\x00 null bytes</span>
                            <span class="author">Binary User</span>
                        </div>
                    </body>
                </html>
            `;

            const problematicFixturePath = path.join(tempOutputDir, 'problematic-fixture.html');
            await fs.writeFile(problematicFixturePath, problematicFixture);

            const fixtureUrl = `file://${problematicFixturePath}`;
            const outputFile = path.join(tempOutputDir, 'quality-issues.ndjson');

            const { stdout, stderr } = await execAsync(`node apps/scraper-playwright/dist/cli.js --url "${fixtureUrl}" --output "${outputFile}" --quality-warnings true --headless true`, {
                cwd: process.cwd(),
                timeout: 30000
            });

            // Should warn about quality issues but still process
            expect(stdout).toContain('quality warning');
            expect(stdout).toMatch(/empty.*text|text.*empty/i);
            expect(stdout).toMatch(/long.*text|text.*long/i);

            const extractedContent = await fs.readFile(outputFile, 'utf-8');
            const reviews = extractedContent.trim().split('\n').map(line => JSON.parse(line));

            expect(reviews.length).toBe(4);

            // Check that problematic data was handled
            const emptyTextReview = reviews.find(r => r.review_id === 'review1');
            expect(emptyTextReview?.text || '').toBe('');

            const longTextReview = reviews.find(r => r.review_id === 'review3');
            expect(longTextReview?.text?.length).toBe(5000);
        });
    });

    describe('Deduplication and Idempotency', () => {
        test('should deduplicate identical reviews from multiple runs', async () => {
            const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_minimal', 'index.html')}`;
            const outputFile1 = path.join(tempOutputDir, 'dedup-run1.ndjson');
            const outputFile2 = path.join(tempOutputDir, 'dedup-run2.ndjson');
            const mergedFile = path.join(tempOutputDir, 'merged-deduped.ndjson');

            // Run extraction twice
            await execAsync(`node apps/scraper-playwright/dist/cli.js --url "${fixtureUrl}" --output "${outputFile1}" --headless true`, {
                cwd: process.cwd(),
                timeout: 30000
            });

            await execAsync(`node apps/scraper-playwright/dist/cli.js --url "${fixtureUrl}" --output "${outputFile2}" --headless true`, {
                cwd: process.cwd(),
                timeout: 30000
            });

            // Merge and deduplicate
            await execAsync(`node scripts/merge-and-dedupe.js "${outputFile1}" "${outputFile2}" "${mergedFile}"`, {
                cwd: process.cwd(),
                timeout: 15000
            });

            // Load all files
            const content1 = await fs.readFile(outputFile1, 'utf-8');
            const content2 = await fs.readFile(outputFile2, 'utf-8');
            const mergedContent = await fs.readFile(mergedFile, 'utf-8');

            const reviews1 = content1.trim().split('\n').map(line => JSON.parse(line));
            const reviews2 = content2.trim().split('\n').map(line => JSON.parse(line));
            const mergedReviews = mergedContent.trim().split('\n').map(line => JSON.parse(line));

            // Original files should have the same reviews
            expect(reviews1.length).toBe(reviews2.length);

            // Merged file should not have duplicates
            expect(mergedReviews.length).toBe(reviews1.length);

            // Verify uniqueness by review_id
            const reviewIds = mergedReviews.map(r => r.review_id);
            const uniqueIds = new Set(reviewIds);
            expect(uniqueIds.size).toBe(reviewIds.length);
        });

        test('should maintain idempotency across multiple extraction rounds', async () => {
            const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_complex', 'index.html')}`;
            const outputFile = path.join(tempOutputDir, 'idempotency-test.ndjson');

            // Run extraction 3 times to the same file with append mode
            for (let i = 1; i <= 3; i++) {
                const mode = i === 1 ? 'overwrite' : 'append';
                await execAsync(`node apps/scraper-playwright/dist/cli.js --url "${fixtureUrl}" --output "${outputFile}" --mode "${mode}" --dedupe-in-memory true --headless true`, {
                    cwd: process.cwd(),
                    timeout: 30000
                });
            }

            const finalContent = await fs.readFile(outputFile, 'utf-8');
            const finalReviews = finalContent.trim().split('\n').map(line => JSON.parse(line));

            // Should have unique reviews only (no duplicates from multiple runs)
            const reviewIds = finalReviews.map(r => r.review_id);
            const uniqueIds = new Set(reviewIds);
            expect(uniqueIds.size).toBe(reviewIds.length);

            // Each review should have consistent data across runs
            const groupedByReviewId = finalReviews.reduce((acc: any, review: any) => {
                acc[review.review_id] = review;
                return acc;
            }, {});

            for (const [reviewId, review] of Object.entries(groupedByReviewId)) {
                expect(review).toHaveProperty('rating');
                expect(review).toHaveProperty('text');
                expect(review).toHaveProperty('author');
            }
        });

        test('should detect and handle hash collisions', async () => {
            // Create a fixture designed to test hash collision handling
            const collisionFixture = `
                <html>
                    <body>
                        <div data-review-id="similar1">
                            <span class="rating">4</span>
                            <span class="text">Great place with excellent service</span>
                            <span class="author">User A</span>
                        </div>
                        <div data-review-id="similar2">
                            <span class="rating">4</span>
                            <span class="text">Great place with excellent service</span>
                            <span class="author">User B</span>
                        </div>
                        <div data-review-id="identical1">
                            <span class="rating">5</span>
                            <span class="text">Amazing experience</span>
                            <span class="author">Same User</span>
                        </div>
                        <div data-review-id="identical2">
                            <span class="rating">5</span>
                            <span class="text">Amazing experience</span>
                            <span class="author">Same User</span>
                        </div>
                    </body>
                </html>
            `;

            const collisionFixturePath = path.join(tempOutputDir, 'collision-fixture.html');
            await fs.writeFile(collisionFixturePath, collisionFixture);

            const fixtureUrl = `file://${collisionFixturePath}`;
            const outputFile = path.join(tempOutputDir, 'collision-test.ndjson');

            const { stdout } = await execAsync(`node apps/scraper-playwright/dist/cli.js --url "${fixtureUrl}" --output "${outputFile}" --hash-collision-detection true --headless true`, {
                cwd: process.cwd(),
                timeout: 30000
            });

            const extractedContent = await fs.readFile(outputFile, 'utf-8');
            const reviews = extractedContent.trim().split('\n').map(line => JSON.parse(line));

            // Should keep both similar reviews (different authors) but dedupe identical ones
            expect(reviews.length).toBe(3); // similar1, similar2, and one of the identical ones

            const reviewTexts = reviews.map(r => `${r.text}-${r.author}`);
            const uniqueTexts = new Set(reviewTexts);
            expect(uniqueTexts.size).toBe(3);

            // Should log collision detection
            expect(stdout).toMatch(/collision.*detect|hash.*collision/i);
        });
    });

    describe('Real-world Scenario Simulation', () => {
        test('should handle typical business listing with mixed review patterns', async () => {
            const businessFixture = createBusinessListingFixture({
                businessName: 'Test Restaurant',
                totalReviews: 150,
                averageRating: 4.2,
                hasOwnerResponses: true,
                hasPhotos: true,
                languages: ['en', 'es', 'fr'],
                dateRange: { start: '2023-01-01', end: '2024-12-01' }
            });

            const businessFixturePath = path.join(tempOutputDir, 'business-fixture.html');
            await fs.writeFile(businessFixturePath, businessFixture);

            const fixtureUrl = `file://${businessFixturePath}`;
            const outputFile = path.join(tempOutputDir, 'business-reviews.ndjson');

            const { stdout } = await execAsync(`node apps/scraper-playwright/dist/cli.js --url "${fixtureUrl}" --output "${outputFile}" --max-reviews 100 --extract-all true --headless true`, {
                cwd: process.cwd(),
                timeout: 60000
            });

            const extractedContent = await fs.readFile(outputFile, 'utf-8');
            const reviews = extractedContent.trim().split('\n').map(line => JSON.parse(line));

            expect(reviews.length).toBeGreaterThan(0);
            expect(reviews.length).toBeLessThanOrEqual(100);

            // Should have mixed ratings
            const ratings = reviews.map(r => r.rating);
            const uniqueRatings = new Set(ratings);
            expect(uniqueRatings.size).toBeGreaterThan(2);

            // Should have some owner responses
            const withResponses = reviews.filter(r => r.owner_response_text);
            expect(withResponses.length).toBeGreaterThan(0);

            // Should have multiple languages
            const languages = new Set(reviews.map(r => r.language).filter(Boolean));
            expect(languages.size).toBeGreaterThan(1);

            // Should have recent dates
            const dates = reviews.map(r => new Date(r.review_time_utc));
            const recentDates = dates.filter(d => d.getFullYear() >= 2023);
            expect(recentDates.length).toBeGreaterThan(0);
        });

        test('should handle large venue with pagination', async () => {
            const largeVenueFixture = createLargeVenueFixture({
                totalReviews: 500,
                pagesRequired: 10,
                reviewsPerPage: 50
            });

            const largeVenueFixturePath = path.join(tempOutputDir, 'large-venue-fixture.html');
            await fs.writeFile(largeVenueFixturePath, largeVenueFixture);

            const fixtureUrl = `file://${largeVenueFixturePath}`;
            const outputFile = path.join(tempOutputDir, 'large-venue-reviews.ndjson');

            const { stdout } = await execAsync(`node apps/scraper-playwright/dist/cli.js --url "${fixtureUrl}" --output "${outputFile}" --max-reviews 200 --enable-pagination true --headless true`, {
                cwd: process.cwd(),
                timeout: 120000
            });

            const extractedContent = await fs.readFile(outputFile, 'utf-8');
            const reviews = extractedContent.trim().split('\n').map(line => JSON.parse(line));

            expect(reviews.length).toBeGreaterThan(50); // Should get more than one page
            expect(reviews.length).toBeLessThanOrEqual(200);

            // Should log pagination activity
            expect(stdout).toMatch(/page.*\d+|pagination/i);

            // Reviews should have sequential or time-ordered patterns
            const timestamps = reviews.map(r => new Date(r.review_time_utc).getTime());
            const sorted = [...timestamps].sort((a, b) => b - a); // Descending order

            // Allow some tolerance for timestamp ordering
            let orderMatches = 0;
            for (let i = 0; i < Math.min(timestamps.length, sorted.length); i++) {
                if (Math.abs(timestamps[i] - sorted[i]) < 24 * 60 * 60 * 1000) { // Within 1 day
                    orderMatches++;
                }
            }

            const orderPercentage = orderMatches / timestamps.length;
            expect(orderPercentage).toBeGreaterThan(0.8); // 80% should be in reasonable order
        });

        test('should process multi-location business chain', async () => {
            const locations = [
                { id: 'loc1', name: 'Downtown Branch', reviews: 75 },
                { id: 'loc2', name: 'Mall Branch', reviews: 120 },
                { id: 'loc3', name: 'Airport Branch', reviews: 45 }
            ];

            const urlsFile = path.join(tempOutputDir, 'multi-location-urls.txt');
            const locationUrls = locations.map(loc => {
                const fixture = createLocationFixture(loc);
                const fixturePath = path.join(tempOutputDir, `${loc.id}-fixture.html`);
                return fs.writeFile(fixturePath, fixture).then(() => `file://${fixturePath}`);
            });

            const resolvedUrls = await Promise.all(locationUrls);
            await fs.writeFile(urlsFile, resolvedUrls.join('\n'));

            const outputFile = path.join(tempOutputDir, 'multi-location-reviews.ndjson');

            const { stdout } = await execAsync(`node apps/scraper-playwright/dist/cli.js --urls-file "${urlsFile}" --output "${outputFile}" --concurrency 2 --location-aware true --headless true`, {
                cwd: process.cwd(),
                timeout: 180000
            });

            const extractedContent = await fs.readFile(outputFile, 'utf-8');
            const reviews = extractedContent.trim().split('\n').map(line => JSON.parse(line));

            expect(reviews.length).toBeGreaterThan(0);

            // Should have reviews from multiple locations
            const placeIds = new Set(reviews.map(r => r.place_id));
            expect(placeIds.size).toBe(3);

            // Each location should have some reviews
            for (const location of locations) {
                const locationReviews = reviews.filter(r => r.place_id.includes(location.id));
                expect(locationReviews.length).toBeGreaterThan(0);
            }

            expect(stdout).toContain('Processing 3 URLs');
        });
    });
});

// Helper functions
function validateReviewStructure(review: any): void {
    const requiredFields = ['place_id', 'review_id', 'rating', 'scraped_at_utc'];
    for (const field of requiredFields) {
        expect(review).toHaveProperty(field);
    }

    expect(typeof review.place_id).toBe('string');
    expect(typeof review.review_id).toBe('string');
    expect(typeof review.rating).toBe('number');
    expect(review.rating).toBeGreaterThanOrEqual(1);
    expect(review.rating).toBeLessThanOrEqual(5);
    expect(Number.isInteger(review.rating)).toBe(true);
}

function calculateRatingDistribution(reviews: any[]): Record<number, number> {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const review of reviews) {
        if (review.rating >= 1 && review.rating <= 5) {
            distribution[review.rating]++;
        }
    }
    return distribution;
}

function createBusinessListingFixture(options: {
    businessName: string;
    totalReviews: number;
    averageRating: number;
    hasOwnerResponses: boolean;
    hasPhotos: boolean;
    languages: string[];
    dateRange: { start: string; end: string };
}): string {
    const reviews = Array.from({ length: Math.min(options.totalReviews, 50) }, (_, i) => {
        const rating = Math.max(1, Math.min(5, Math.round(options.averageRating + (Math.random() - 0.5) * 2)));
        const lang = options.languages[Math.floor(Math.random() * options.languages.length)];
        const hasResponse = options.hasOwnerResponses && Math.random() < 0.3;
        const hasPhoto = options.hasPhotos && Math.random() < 0.2;

        return `
            <div data-review-id="review-${i}">
                <span class="rating">${rating}</span>
                <span class="author">User ${i}</span>
                <span class="text" lang="${lang}">This is a review in ${lang}. Rating: ${rating} stars.</span>
                <time datetime="${randomDateBetween(options.dateRange.start, options.dateRange.end)}">
                    ${Math.floor(Math.random() * 12) + 1} months ago
                </time>
                ${hasResponse ? `<div class="owner-response">Thank you for your review!</div>` : ''}
                ${hasPhoto ? `<div class="photos"><img src="review-photo-${i}.jpg" alt="Review photo" /></div>` : ''}
            </div>
        `;
    }).join('');

    return `
        <html>
            <head><title>${options.businessName}</title></head>
            <body>
                <h1>${options.businessName}</h1>
                <div class="reviews-container">
                    ${reviews}
                </div>
            </body>
        </html>
    `;
}

function createLargeVenueFixture(options: {
    totalReviews: number;
    pagesRequired: number;
    reviewsPerPage: number;
}): string {
    const reviews = Array.from({ length: options.reviewsPerPage }, (_, i) => `
        <div data-review-id="large-venue-review-${i}">
            <span class="rating">${Math.floor(Math.random() * 5) + 1}</span>
            <span class="author">Reviewer ${i}</span>
            <span class="text">Review ${i} for this large venue.</span>
            <time datetime="${new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()}">
                ${Math.floor(Math.random() * 12) + 1} months ago
            </time>
        </div>
    `).join('');

    return `
        <html>
            <body>
                <div class="reviews-container">
                    ${reviews}
                </div>
                <div class="pagination">
                    <span>Page 1 of ${options.pagesRequired}</span>
                    <button class="next-page">Next</button>
                </div>
            </body>
        </html>
    `;
}

function createLocationFixture(location: { id: string; name: string; reviews: number }): string {
    const reviews = Array.from({ length: Math.min(location.reviews, 30) }, (_, i) => `
        <div data-review-id="${location.id}-review-${i}">
            <span class="rating">${Math.floor(Math.random() * 5) + 1}</span>
            <span class="author">Customer ${i}</span>
            <span class="text">Review for ${location.name}. Visit ${i}.</span>
            <time datetime="${new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString()}">
                ${Math.floor(Math.random() * 6) + 1} months ago
            </time>
        </div>
    `).join('');

    return `
        <html>
            <head><title>${location.name}</title></head>
            <body data-place-id="${location.id}">
                <h1>${location.name}</h1>
                <div class="reviews-container">
                    ${reviews}
                </div>
            </body>
        </html>
    `;
}

function randomDateBetween(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    return new Date(randomTime).toISOString();
}
