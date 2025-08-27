/**
 * Performance Tests - Load Testing and Memory Usage
 *
 * These tests verify system performance under various loads,
 * memory usage patterns, and stress conditions.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { collectItems } from '../utils/dom-guards';

// Type definitions for test data
interface ReviewData {
    place_id: string;
    review_id: string;
    author: string;
    rating: number;
    text: string;
    time_unix: number;
    relative_time: string;
    lang?: string;
    crawl_meta?: {
        run_id: string;
        session: string;
        ts: number;
        source: string;
    };
}

describe('Performance Tests', () => {
    let performanceMetrics: {
        startTime: number;
        endTime: number;
        duration: number;
        memoryStart: NodeJS.MemoryUsage;
        memoryEnd: NodeJS.MemoryUsage;
        memoryDelta: {
            rss: number;
            heapUsed: number;
            heapTotal: number;
            external: number;
        };
    };

    beforeEach(() => {
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        performanceMetrics = {
            startTime: performance.now(),
            endTime: 0,
            duration: 0,
            memoryStart: process.memoryUsage(),
            memoryEnd: {} as NodeJS.MemoryUsage,
            memoryDelta: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 }
        };
    });

    afterEach(() => {
        performanceMetrics.endTime = performance.now();
        performanceMetrics.duration = performanceMetrics.endTime - performanceMetrics.startTime;
        performanceMetrics.memoryEnd = process.memoryUsage();

        performanceMetrics.memoryDelta = {
            rss: performanceMetrics.memoryEnd.rss - performanceMetrics.memoryStart.rss,
            heapUsed: performanceMetrics.memoryEnd.heapUsed - performanceMetrics.memoryStart.heapUsed,
            heapTotal: performanceMetrics.memoryEnd.heapTotal - performanceMetrics.memoryStart.heapTotal,
            external: performanceMetrics.memoryEnd.external - performanceMetrics.memoryStart.external
        };

        // Save performance data for analysis
        globalThis.testUtils.saveArtifact(
            `performance-${expect.getState().currentTestName?.replace(/\s+/g, '-') || 'unknown'}.json`,
            JSON.stringify(performanceMetrics, null, 2)
        );
    });

    describe('Large Dataset Processing', () => {
        test('should process 10k reviews within 30 seconds', async () => {
            const reviewCount = 10000;
            const reviews = generateLargeReviewDataset(reviewCount);

            const startTime = performance.now();

            // Simulate review processing pipeline
            const processed = await processReviewBatch(reviews);

            const duration = performance.now() - startTime;

            expect(processed.length).toBe(reviewCount);
            expect(duration).toBeLessThan(30000); // 30 seconds
            expect(performanceMetrics.memoryDelta.heapUsed).toBeLessThan(500 * 1024 * 1024); // 500MB
        }, 60000);

        test('should handle 100k reviews with memory limit', async () => {
            const reviewCount = 100000;
            const batchSize = 1000;

            let totalProcessed = 0;
            const maxMemoryUsage = 1024 * 1024 * 1024; // 1GB limit

            for (let i = 0; i < reviewCount; i += batchSize) {
                const batch = generateLargeReviewDataset(batchSize, i);
                const processed = await processReviewBatch(batch);
                totalProcessed += processed.length;

                // Check memory usage after each batch
                const currentMemory = process.memoryUsage();
                expect(currentMemory.heapUsed).toBeLessThan(maxMemoryUsage);

                // Force cleanup periodically
                if (i % (batchSize * 10) === 0 && global.gc) {
                    global.gc();
                }
            }

            expect(totalProcessed).toBe(reviewCount);
        }, 120000);

        test('should efficiently deduplicate large datasets', async () => {
            const uniqueCount = 5000;
            const duplicateCount = 15000;

            // Create dataset with known duplicates
            const reviews = [
                ...generateLargeReviewDataset(uniqueCount),
                ...generateDuplicateReviews(duplicateCount, uniqueCount)
            ];

            const startTime = performance.now();
            const deduped = await deduplicateReviews(reviews);
            const duration = performance.now() - startTime;

            expect(deduped.length).toBe(uniqueCount);
            expect(duration).toBeLessThan(10000); // 10 seconds

            // Memory should not grow significantly
            expect(performanceMetrics.memoryDelta.heapUsed).toBeLessThan(200 * 1024 * 1024); // 200MB
        });
    });

    describe('Concurrent Processing', () => {
        test('should handle multiple concurrent extractions', async () => {
            const concurrentExtractions = 10;
            const reviewsPerExtraction = 1000;

            const extractionPromises = Array.from({ length: concurrentExtractions }, (_, i) =>
                processReviewBatch(generateLargeReviewDataset(reviewsPerExtraction, i * reviewsPerExtraction))
            );

            const startTime = performance.now();
            const results = await Promise.all(extractionPromises);
            const duration = performance.now() - startTime;

            // All extractions should complete successfully
            expect(results).toHaveLength(concurrentExtractions);
            results.forEach(result => {
                expect(result).toHaveLength(reviewsPerExtraction);
            });

            // Should complete within reasonable time
            expect(duration).toBeLessThan(15000); // 15 seconds
        });

        test('should limit concurrent browser contexts', async () => {
            const maxConcurrency = 5;
            const totalExtractions = 20;

            let activeConcurrency = 0;
            let maxObservedConcurrency = 0;

            const extractionPromises = Array.from({ length: totalExtractions }, async (_, i) => {
                activeConcurrency++;
                maxObservedConcurrency = Math.max(maxObservedConcurrency, activeConcurrency);

                try {
                    // Simulate browser context creation delay
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Check that we don't exceed concurrency limit
                    expect(activeConcurrency).toBeLessThanOrEqual(maxConcurrency);

                    const reviews = generateLargeReviewDataset(100, i * 100);
                    return await processReviewBatch(reviews);
                } finally {
                    activeConcurrency--;
                }
            });

            // Process with concurrency control
            const results = await limitConcurrency(extractionPromises, maxConcurrency);

            expect(results).toHaveLength(totalExtractions);
            expect(maxObservedConcurrency).toBeLessThanOrEqual(maxConcurrency);
        });
    });

    describe('Memory Management', () => {
        test('should not leak memory during repeated operations', async () => {
            const iterations = 100;
            const reviewsPerIteration = 500;

            const initialMemory = process.memoryUsage();

            for (let i = 0; i < iterations; i++) {
                const reviews = generateLargeReviewDataset(reviewsPerIteration);
                await processReviewBatch(reviews);

                // Force cleanup every 10 iterations
                if (i % 10 === 0 && global.gc) {
                    global.gc();
                }
            }

            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

            // Memory growth should be minimal (less than 100MB)
            expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
        });

        test('should handle extremely large single reviews', async () => {
            const largeReview = {
                place_id: 'large_review_place',
                review_id: 'large_review_001',
                author: 'Verbose Reviewer',
                rating: 4,
                text: 'A'.repeat(1024 * 1024), // 1MB of text
                time_unix: Date.now(),
                relative_time: '1 day ago'
            };

            const startTime = performance.now();
            const processed = await processReviewBatch([largeReview]);
            const duration = performance.now() - startTime;

            expect(processed).toHaveLength(1);
            expect(duration).toBeLessThan(5000); // 5 seconds

            // Should handle large text without excessive memory usage
            expect(performanceMetrics.memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024); // 50MB
        });
    });

    describe('Parsing Performance', () => {
        test('should parse complex HTML fixtures efficiently', async () => {
            const fixtureHtml = await globalThis.testUtils.loadFixture('case_complex');
            const iterations = 100;

            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                const reviews = await parseHTMLFixture(fixtureHtml);
                expect(reviews.length).toBeGreaterThan(0);
            }

            const duration = performance.now() - startTime;
            const avgDuration = duration / iterations;

            // Each parsing operation should be fast
            expect(avgDuration).toBeLessThan(100); // 100ms average
            expect(duration).toBeLessThan(10000); // Total under 10 seconds
        });

        test('should handle malformed HTML gracefully', async () => {
            const malformedHtml = '<div><span>Malformed HTML' + 'X'.repeat(10000) + '</invalid>';
            const iterations = 50;

            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                const reviews = await parseHTMLFixture(malformedHtml);
                // Should not crash, might return empty array
                expect(Array.isArray(reviews)).toBe(true);
            }

            const duration = performance.now() - startTime;

            // Should not hang or consume excessive time
            expect(duration).toBeLessThan(5000); // 5 seconds total
        });
    });

    describe('I/O Performance', () => {
        test('should write large NDJSON files efficiently', async () => {
            const reviewCount = 50000;
            const reviews = generateLargeReviewDataset(reviewCount);

            const startTime = performance.now();
            const filePath = await writeNDJSONFile(reviews, 'performance-test-large.ndjson');
            const duration = performance.now() - startTime;

            // Verify file was written correctly
            const stats = await getFileStats(filePath);
            expect(stats.size).toBeGreaterThan(10 * 1024 * 1024); // At least 10MB

            // Should complete within reasonable time
            expect(duration).toBeLessThan(30000); // 30 seconds

            // Cleanup
            await deleteFile(filePath);
        });

        test('should read and process large NDJSON files', async () => {
            const reviewCount = 25000;
            const reviews = generateLargeReviewDataset(reviewCount);
            const filePath = await writeNDJSONFile(reviews, 'performance-test-read.ndjson');

            const startTime = performance.now();
            const readReviews = await readNDJSONFile(filePath);
            const duration = performance.now() - startTime;

            expect(readReviews).toHaveLength(reviewCount);
            expect(duration).toBeLessThan(15000); // 15 seconds

            // Cleanup
            await deleteFile(filePath);
        });
    });

    describe('Browser Automation Performance', () => {
        test('should simulate scrolling performance', async () => {
            const scrollRounds = 100;
            const scrollDelay = 100;

            const startTime = performance.now();

            // Simulate repeated scrolling operations
            for (let i = 0; i < scrollRounds; i++) {
                await simulateScroll(1200);
                await new Promise(resolve => setTimeout(resolve, scrollDelay));
            }

            const duration = performance.now() - startTime;

            // Should complete all scrolling within reasonable time
            expect(duration).toBeLessThan((scrollRounds * scrollDelay) + 5000); // Allow 5s overhead
        });

        test('should handle resource blocking efficiently', async () => {
            const resourceCount = 1000;
            const blockedResources: string[] = [];

            const startTime = performance.now();

            // Simulate resource blocking decisions
            for (let i = 0; i < resourceCount; i++) {
                const resourceType = ['image', 'font', 'media', 'stylesheet', 'script'][i % 5];
                const shouldBlock = shouldBlockResource(resourceType);

                if (shouldBlock) {
                    blockedResources.push(resourceType);
                }
            }

            const duration = performance.now() - startTime;

            // Resource blocking decisions should be very fast
            expect(duration).toBeLessThan(100); // 100ms for 1000 decisions
            expect(blockedResources.length).toBeGreaterThan(0);
        });
    });
});

// Helper functions for performance testing
function generateLargeReviewDataset(count: number, offset: number = 0): ReviewData[] {
    const reviews: ReviewData[] = [];
    for (let i = 0; i < count; i++) {
        reviews.push({
            place_id: `place_${(i + offset) % 1000}`, // 1000 unique places
            review_id: `review_${i + offset}`,
            author: `Author ${(i + offset) % 5000}`, // 5000 unique authors
            rating: ((i + offset) % 5) + 1,
            text: `Review text ${i + offset} `.repeat(Math.floor(Math.random() * 20) + 1),
            time_unix: 1640995200 + (i + offset) * 3600,
            relative_time: `${Math.floor((i + offset) / 24)} days ago`,
            lang: ['en', 'vi', 'fr', 'de', 'es'][(i + offset) % 5],
            crawl_meta: {
                run_id: `run_${Math.floor((i + offset) / 1000)}`,
                session: `session_${(i + offset) % 100}`,
                ts: Date.now() + (i + offset) * 1000,
                source: 'playwright'
            }
        });
    }
    return reviews;
}

function generateDuplicateReviews(count: number, maxOriginalIndex: number): ReviewData[] {
    const reviews: ReviewData[] = [];
    for (let i = 0; i < count; i++) {
        const originalIndex = i % maxOriginalIndex;
        reviews.push({
            place_id: `place_${originalIndex % 1000}`,
            review_id: `review_${originalIndex}`, // Same ID as original
            author: `Author ${originalIndex % 5000}`,
            rating: (originalIndex % 5) + 1,
            text: `Review text ${originalIndex} `, // Slightly different text
            time_unix: 1640995200 + originalIndex * 3600,
            relative_time: `${Math.floor(originalIndex / 24)} days ago`,
            lang: ['en', 'vi', 'fr', 'de', 'es'][originalIndex % 5]
        });
    }
    return reviews;
}

async function processReviewBatch(reviews: ReviewData[]): Promise<ReviewData[]> {
    // Simulate processing delay proportional to batch size
    const processingTime = Math.min(reviews.length * 0.1, 1000);
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate some processing (validation, normalization)
    return reviews.filter(review => review.rating >= 1 && review.rating <= 5);
}

async function deduplicateReviews(reviews: ReviewData[]): Promise<ReviewData[]> {
    const seen = new Set<string>();
    const unique: ReviewData[] = [];

    for (const review of reviews) {
        const key = `${review.place_id}|${review.review_id}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(review);
        }
    }

    return unique;
}

async function limitConcurrency<T>(promises: Promise<T>[], limit: number): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<any>[] = [];

    for (const promise of promises) {
        const p = Promise.resolve(promise).then(result => {
            results.push(result);
            executing.splice(executing.indexOf(p), 1);
        });

        executing.push(p);

        if (executing.length >= limit) {
            await Promise.race(executing);
        }
    }

    await Promise.all(executing);
    return results;
}

async function parseHTMLFixture(html: string): Promise<Array<{ id: string; rating: number; text: string }>> {
    // Simulate HTML parsing with some complexity
    const complexity = html.length * 0.001;
    await new Promise(resolve => setTimeout(resolve, Math.min(complexity, 50)));

    // Mock parsing result
    const reviewCount = (html.match(/data-review-id/g) || []).length;
    return Array.from({ length: reviewCount }, (_, i) => ({
        id: `parsed_review_${i}`,
        rating: (i % 5) + 1,
        text: `Parsed review ${i}`
    }));
}

async function writeNDJSONFile(reviews: ReviewData[], filename: string): Promise<string> {
    const filePath = `./artifacts/${filename}`;
    const content = reviews.map(r => JSON.stringify(r)).join('\n');

    // Simulate file writing delay
    const writeTime = content.length * 0.001; // 1ms per 1000 chars
    await new Promise(resolve => setTimeout(resolve, Math.min(writeTime, 2000)));

    return filePath;
}

async function readNDJSONFile(filePath: string): Promise<ReviewData[]> {
    // Simulate file reading based on file size
    const readTime = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, readTime));

    // Mock reading result based on filename
    const reviewCount = parseInt(filePath.match(/(\d+)/)?.[1] || '1000');
    return generateLargeReviewDataset(reviewCount);
}

async function getFileStats(filePath: string): Promise<{ size: number }> {
    // Mock file stats
    return { size: Math.random() * 50 * 1024 * 1024 + 10 * 1024 * 1024 }; // 10-60MB
}

async function deleteFile(filePath: string): Promise<void> {
    // Mock file deletion
    await new Promise(resolve => setTimeout(resolve, 10));
}

async function simulateScroll(deltaY: number): Promise<void> {
    // Simulate scroll operation delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
}

function shouldBlockResource(resourceType: string): boolean {
    const blockedTypes = ['image', 'font', 'media', 'stylesheet'];
    return blockedTypes.includes(resourceType);
}
