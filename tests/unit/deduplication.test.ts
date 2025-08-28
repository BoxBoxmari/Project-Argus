/**
 * Unit Tests - Deduplication and Idempotency
 *
 * These tests verify that the system correctly identifies and handles
 * duplicate reviews, ensuring idempotent operations and data integrity.
 */

// Jest globals are available globally, no import needed
import crypto from 'crypto';

// Mock deduplication utilities
class DeduplicationEngine {
    /**
     * Generate deterministic hash for review content
     */
    static generateReviewHash(review: {
        place_id: string;
        review_id: string;
        author: string;
        rating: number;
        text: string;
        time_unix: number;
    }): string {
        const hashContent = `${review.place_id}|${review.review_id}|${review.author}|${review.rating}|${review.text}|${review.time_unix}`;
        return crypto.createHash('sha256').update(hashContent, 'utf8').digest('hex');
    }

    /**
     * Generate review fingerprint for fuzzy matching
     */
    static generateFingerprint(review: {
        author: string;
        text: string;
        rating: number;
    }): string {
        const normalizedText = review.text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const content = `${review.author.toLowerCase()}|${normalizedText}|${review.rating}`;
        return crypto.createHash('md5').update(content, 'utf8').digest('hex');
    }

    /**
     * Check if two reviews are exact duplicates
     */
    static areExactDuplicates(review1: any, review2: any): boolean {
        return review1.place_id === review2.place_id &&
            review1.review_id === review2.review_id;
    }

    /**
     * Check if two reviews are likely the same (fuzzy match)
     */
    static areFuzzyDuplicates(review1: any, review2: any, threshold: number = 0.9): boolean {
        if (review1.place_id !== review2.place_id) return false;
        if (review1.author !== review2.author) return false;
        if (Math.abs(review1.rating - review2.rating) > 0) return false;

        // Text similarity check
        const similarity = this.calculateTextSimilarity(review1.text, review2.text);
        return similarity >= threshold;
    }

    /**
     * Calculate text similarity using simple approach
     */
    static calculateTextSimilarity(text1: string, text2: string): number {
        if (!text1 || !text2) return 0;

        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }

    /**
     * Deduplicate array of reviews
     */
    static deduplicateReviews(reviews: any[], strategy: 'exact' | 'fuzzy' = 'exact'): {
        unique: any[];
        duplicates: any[];
        stats: { total: number; unique: number; duplicates: number };
    } {
        const unique: any[] = [];
        const duplicates: any[] = [];
        const seen = new Set<string>();

        for (const review of reviews) {
            let isDuplicate = false;

            if (strategy === 'exact') {
                const key = `${review.place_id}|${review.review_id}`;
                if (seen.has(key)) {
                    isDuplicate = true;
                } else {
                    seen.add(key);
                }
            } else if (strategy === 'fuzzy') {
                const fingerprint = this.generateFingerprint(review);
                if (seen.has(fingerprint)) {
                    isDuplicate = true;
                } else {
                    seen.add(fingerprint);
                }
            }

            if (isDuplicate) {
                duplicates.push(review);
            } else {
                unique.push(review);
            }
        }

        return {
            unique,
            duplicates,
            stats: {
                total: reviews.length,
                unique: unique.length,
                duplicates: duplicates.length
            }
        };
    }

    /**
     * Merge duplicate reviews keeping the most complete one
     */
    static mergeDuplicates(reviews: any[]): any {
        if (reviews.length <= 1) return reviews[0];

        // Sort by completeness score (more complete data first)
        const scored = reviews.map(review => ({
            review,
            score: this.calculateCompletenessScore(review)
        })).sort((a, b) => b.score - a.score);

        const base = { ...scored[0].review };

        // Merge missing fields from other reviews
        for (let i = 1; i < scored.length; i++) {
            const other = scored[i].review;

            // Fill in missing or empty fields
            if (!base.text && other.text) base.text = other.text;
            if (!base.relative_time && other.relative_time) base.relative_time = other.relative_time;
            if (!base.lang && other.lang) base.lang = other.lang;
            if ((!base.likes || base.likes === 0) && other.likes > 0) base.likes = other.likes;
            if (!base.owner_response && other.owner_response) base.owner_response = other.owner_response;
            if (!base.photos || base.photos.length === 0) base.photos = other.photos;
        }

        // Update crawl metadata to indicate merge
        base.crawl_meta = {
            ...base.crawl_meta,
            merged_from: scored.slice(1).map(s => s.review.review_id),
            merge_timestamp: Date.now()
        };

        return base;
    }

    /**
     * Calculate completeness score for a review
     */
    static calculateCompletenessScore(review: any): number {
        let score = 0;

        // Required fields
        if (review.place_id) score += 10;
        if (review.review_id) score += 10;
        if (review.author) score += 5;
        if (review.rating && review.rating > 0) score += 5;
        if (review.time_unix && review.time_unix > 0) score += 5;

        // Optional but valuable fields
        if (review.text && review.text.length > 10) score += 3;
        if (review.relative_time) score += 1;
        if (review.lang) score += 1;
        if (review.likes && review.likes > 0) score += 2;
        if (review.owner_response) score += 3;
        if (review.photos && review.photos.length > 0) score += 2;
        if (review.crawl_meta) score += 1;

        return score;
    }
}

describe('Deduplication and Idempotency Tests', () => {
    let sampleReviews: any[];

    beforeEach(() => {
        sampleReviews = [
            {
                place_id: 'place_001',
                review_id: 'review_001',
                author: 'John Smith',
                rating: 5,
                text: 'Great coffee and excellent service!',
                time_unix: 1640995200,
                relative_time: '2 months ago',
                lang: 'en'
            },
            {
                place_id: 'place_001',
                review_id: 'review_002',
                author: 'Jane Doe',
                rating: 4,
                text: 'Good atmosphere but coffee could be better.',
                time_unix: 1641081600,
                relative_time: '2 months ago',
                lang: 'en'
            }
        ];
    });

    describe('Hash Generation', () => {
        test('should generate consistent hashes for same content', () => {
            const review = sampleReviews[0];
            const hash1 = DeduplicationEngine.generateReviewHash(review);
            const hash2 = DeduplicationEngine.generateReviewHash(review);

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
        });

        test('should generate different hashes for different content', () => {
            const hash1 = DeduplicationEngine.generateReviewHash(sampleReviews[0]);
            const hash2 = DeduplicationEngine.generateReviewHash(sampleReviews[1]);

            expect(hash1).not.toBe(hash2);
        });

        test('should be sensitive to all fields', () => {
            const review = { ...sampleReviews[0] };
            const originalHash = DeduplicationEngine.generateReviewHash(review);

            // Change each field and verify hash changes
            const testFields = ['review_id', 'author', 'rating', 'text', 'time_unix'];

            testFields.forEach(field => {
                const modifiedReview = { ...review };
                if (field === 'rating') {
                    modifiedReview[field] = 4;
                } else if (field === 'time_unix') {
                    modifiedReview[field] = 1640995201;
                } else {
                    modifiedReview[field] = 'modified_' + modifiedReview[field];
                }

                const modifiedHash = DeduplicationEngine.generateReviewHash(modifiedReview);
                expect(modifiedHash).not.toBe(originalHash);
            });
        });
    });

    describe('Fingerprint Generation', () => {
        test('should generate consistent fingerprints for similar content', () => {
            const review1 = {
                author: 'John Smith',
                text: 'Great coffee and excellent service!',
                rating: 5
            };

            const review2 = {
                author: 'John Smith',
                text: 'Great coffee and excellent service!', // Same text
                rating: 5
            };

            const fp1 = DeduplicationEngine.generateFingerprint(review1);
            const fp2 = DeduplicationEngine.generateFingerprint(review2);

            expect(fp1).toBe(fp2);
        });

        test('should normalize text differences', () => {
            const review1 = {
                author: 'John Smith',
                text: 'Great coffee and excellent service!',
                rating: 5
            };

            const review2 = {
                author: 'JOHN SMITH',
                text: 'Great  coffee  and   excellent   service!!!',
                rating: 5
            };

            const fp1 = DeduplicationEngine.generateFingerprint(review1);
            const fp2 = DeduplicationEngine.generateFingerprint(review2);

            expect(fp1).toBe(fp2);
        });
    });

    describe('Exact Duplicate Detection', () => {
        test('should identify exact duplicates correctly', () => {
            const review1 = sampleReviews[0];
            const review2 = { ...sampleReviews[0] }; // Exact copy

            expect(DeduplicationEngine.areExactDuplicates(review1, review2)).toBe(true);
        });

        test('should not identify different reviews as duplicates', () => {
            const review1 = sampleReviews[0];
            const review2 = sampleReviews[1];

            expect(DeduplicationEngine.areExactDuplicates(review1, review2)).toBe(false);
        });

        test('should not identify reviews from different places as duplicates', () => {
            const review1 = sampleReviews[0];
            const review2 = { ...sampleReviews[0], place_id: 'different_place' };

            expect(DeduplicationEngine.areExactDuplicates(review1, review2)).toBe(false);
        });
    });

    describe('Fuzzy Duplicate Detection', () => {
        test('should identify similar reviews as fuzzy duplicates', () => {
            const review1 = {
                place_id: 'place_001',
                author: 'John Smith',
                rating: 5,
                text: 'Great coffee and excellent service!'
            };

            const review2 = {
                place_id: 'place_001',
                author: 'John Smith',
                rating: 5,
                text: 'Great coffee and excellent service!!!' // Minor punctuation diff
            };

            expect(DeduplicationEngine.areFuzzyDuplicates(review1, review2)).toBe(true);
        });

        test('should not identify different authors as duplicates', () => {
            const review1 = sampleReviews[0];
            const review2 = { ...sampleReviews[0], author: 'Different Author' };

            expect(DeduplicationEngine.areFuzzyDuplicates(review1, review2)).toBe(false);
        });

        test('should not identify different ratings as duplicates', () => {
            const review1 = sampleReviews[0];
            const review2 = { ...sampleReviews[0], rating: 3 };

            expect(DeduplicationEngine.areFuzzyDuplicates(review1, review2)).toBe(false);
        });

        test('should respect similarity threshold', () => {
            const review1 = {
                place_id: 'place_001',
                author: 'John Smith',
                rating: 5,
                text: 'Great coffee'
            };

            const review2 = {
                place_id: 'place_001',
                author: 'John Smith',
                rating: 5,
                text: 'Terrible experience' // Very different text
            };

            expect(DeduplicationEngine.areFuzzyDuplicates(review1, review2, 0.9)).toBe(false);
            expect(DeduplicationEngine.areFuzzyDuplicates(review1, review2, 0.1)).toBe(false); // Still false due to different content
        });
    });

    describe('Text Similarity Calculation', () => {
        test('should return 1.0 for identical text', () => {
            const text1 = 'Great coffee and service';
            const text2 = 'Great coffee and service';

            const similarity = DeduplicationEngine.calculateTextSimilarity(text1, text2);
            expect(similarity).toBe(1.0);
        });

        test('should return 0.0 for completely different text', () => {
            const text1 = 'Great coffee';
            const text2 = 'Terrible experience horrible place';

            const similarity = DeduplicationEngine.calculateTextSimilarity(text1, text2);
            expect(similarity).toBe(0.0);
        });

        test('should calculate partial similarity correctly', () => {
            const text1 = 'Great coffee and excellent service';
            const text2 = 'Great coffee but poor service';

            const similarity = DeduplicationEngine.calculateTextSimilarity(text1, text2);
            expect(similarity).toBeGreaterThan(0.4);
            expect(similarity).toBeLessThan(0.8);
        });

        test('should handle empty or null text', () => {
            expect(DeduplicationEngine.calculateTextSimilarity('', 'text')).toBe(0);
            expect(DeduplicationEngine.calculateTextSimilarity('text', '')).toBe(0);
            expect(DeduplicationEngine.calculateTextSimilarity(null as any, 'text')).toBe(0);
        });
    });

    describe('Review Deduplication', () => {
        test('should remove exact duplicates', () => {
            const reviews = [
                sampleReviews[0],
                { ...sampleReviews[0] }, // Exact duplicate
                sampleReviews[1]
            ];

            const result = DeduplicationEngine.deduplicateReviews(reviews, 'exact');

            expect(result.unique).toHaveLength(2);
            expect(result.duplicates).toHaveLength(1);
            expect(result.stats.total).toBe(3);
            expect(result.stats.unique).toBe(2);
            expect(result.stats.duplicates).toBe(1);
        });

        test('should handle fuzzy deduplication', () => {
            const reviews = [
                {
                    place_id: 'place_001',
                    review_id: 'review_001',
                    author: 'John Smith',
                    rating: 5,
                    text: 'Great coffee and excellent service!'
                },
                {
                    place_id: 'place_001',
                    review_id: 'review_002',
                    author: 'John Smith',
                    rating: 5,
                    text: 'Great coffee and excellent service!!!' // Similar but different ID
                },
                sampleReviews[1]
            ];

            const result = DeduplicationEngine.deduplicateReviews(reviews, 'fuzzy');

            expect(result.unique).toHaveLength(2);
            expect(result.duplicates).toHaveLength(1);
        });

        test('should handle empty array', () => {
            const result = DeduplicationEngine.deduplicateReviews([], 'exact');

            expect(result.unique).toHaveLength(0);
            expect(result.duplicates).toHaveLength(0);
            expect(result.stats.total).toBe(0);
        });

        test('should preserve order of first occurrence', () => {
            const reviews = [
                { ...sampleReviews[0], additional_field: 'first' },
                sampleReviews[1],
                { ...sampleReviews[0], additional_field: 'duplicate' }
            ];

            const result = DeduplicationEngine.deduplicateReviews(reviews, 'exact');

            expect(result.unique[0].additional_field).toBe('first');
            expect(result.duplicates[0].additional_field).toBe('duplicate');
        });
    });

    describe('Completeness Scoring', () => {
        test('should score complete reviews higher', () => {
            const completeReview = {
                place_id: 'place_001',
                review_id: 'review_001',
                author: 'John Smith',
                rating: 5,
                text: 'Very detailed review with lots of information about the experience.',
                time_unix: 1640995200,
                relative_time: '2 months ago',
                lang: 'en',
                likes: 15,
                owner_response: { text: 'Thank you!', time_unix: 1640995300 },
                photos: ['photo1.jpg', 'photo2.jpg'],
                crawl_meta: { run_id: 'test' }
            };

            const incompleteReview = {
                place_id: 'place_001',
                review_id: 'review_002',
                author: 'Jane Doe',
                rating: 4
            };

            const completeScore = DeduplicationEngine.calculateCompletenessScore(completeReview);
            const incompleteScore = DeduplicationEngine.calculateCompletenessScore(incompleteReview);

            expect(completeScore).toBeGreaterThan(incompleteScore);
            expect(completeScore).toBeGreaterThan(40); // Should have high score
            expect(incompleteScore).toBeLessThan(25); // Should have low score
        });

        test('should weight required fields heavily', () => {
            const reviewWithoutRequired = {
                text: 'Long detailed review text',
                likes: 100,
                photos: ['photo1.jpg']
            };

            const reviewWithRequired = {
                place_id: 'place_001',
                review_id: 'review_001',
                author: 'Author',
                rating: 3,
                time_unix: 1640995200
            };

            const scoreWithoutRequired = DeduplicationEngine.calculateCompletenessScore(reviewWithoutRequired);
            const scoreWithRequired = DeduplicationEngine.calculateCompletenessScore(reviewWithRequired);

            expect(scoreWithRequired).toBeGreaterThan(scoreWithoutRequired);
        });
    });

    describe('Duplicate Merging', () => {
        test('should merge duplicate reviews keeping most complete data', () => {
            const partialReview1 = {
                place_id: 'place_001',
                review_id: 'review_001',
                author: 'John Smith',
                rating: 5,
                text: 'Great coffee!',
                time_unix: 1640995200
            };

            const partialReview2 = {
                place_id: 'place_001',
                review_id: 'review_001',
                author: 'John Smith',
                rating: 5,
                likes: 10,
                owner_response: { text: 'Thank you!' },
                photos: ['photo1.jpg'],
                crawl_meta: { run_id: 'test2' }
            };

            const merged = DeduplicationEngine.mergeDuplicates([partialReview1, partialReview2]);

            expect(merged.text).toBe('Great coffee!'); // From first (more complete base)
            expect(merged.likes).toBe(10); // From second
            expect(merged.owner_response).toEqual({ text: 'Thank you!' }); // From second
            expect(merged.photos).toEqual(['photo1.jpg']); // From second
            expect(merged.crawl_meta.merged_from).toEqual(['review_001']); // Tracking merge
        });

        test('should handle single review', () => {
            const review = sampleReviews[0];
            const merged = DeduplicationEngine.mergeDuplicates([review]);

            expect(merged).toEqual(review);
        });

        test('should handle empty array', () => {
            const merged = DeduplicationEngine.mergeDuplicates([]);
            expect(merged).toBeUndefined();
        });
    });

    describe('Idempotency Tests', () => {
        test('should produce same results when run multiple times', () => {
            const reviews = [
                sampleReviews[0],
                { ...sampleReviews[0] }, // Duplicate
                sampleReviews[1],
                { ...sampleReviews[1] } // Duplicate
            ];

            const result1 = DeduplicationEngine.deduplicateReviews(reviews, 'exact');
            const result2 = DeduplicationEngine.deduplicateReviews(reviews, 'exact');
            const result3 = DeduplicationEngine.deduplicateReviews(reviews, 'exact');

            expect(result1.stats).toEqual(result2.stats);
            expect(result2.stats).toEqual(result3.stats);
            expect(result1.unique).toEqual(result2.unique);
            expect(result2.unique).toEqual(result3.unique);
        });

        test('should handle re-deduplication of already deduplicated data', () => {
            const reviews = [
                sampleReviews[0],
                { ...sampleReviews[0] },
                sampleReviews[1]
            ];

            const firstPass = DeduplicationEngine.deduplicateReviews(reviews, 'exact');
            const secondPass = DeduplicationEngine.deduplicateReviews(firstPass.unique, 'exact');

            expect(secondPass.duplicates).toHaveLength(0);
            expect(secondPass.unique).toEqual(firstPass.unique);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle reviews with missing fields', () => {
            const reviews = [
                { place_id: 'place_001', review_id: 'review_001' },
                { place_id: 'place_001' }, // Missing review_id
                { review_id: 'review_003' } // Missing place_id
            ];

            expect(() => {
                DeduplicationEngine.deduplicateReviews(reviews, 'exact');
            }).not.toThrow();
        });

        test('should handle null and undefined values', () => {
            const reviews = [
                { place_id: null, review_id: 'review_001', author: null, rating: null },
                { place_id: undefined, review_id: 'review_002', text: undefined }
            ];

            expect(() => {
                DeduplicationEngine.deduplicateReviews(reviews, 'exact');
                DeduplicationEngine.deduplicateReviews(reviews, 'fuzzy');
            }).not.toThrow();
        });

        test('should handle extremely large review datasets', () => {
            const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
                place_id: `place_${i % 100}`, // 100 unique places
                review_id: `review_${i}`,
                author: `Author ${i % 1000}`, // 1000 unique authors
                rating: (i % 5) + 1,
                text: `Review text ${i}`,
                time_unix: 1640995200 + i
            }));

            const startTime = Date.now();
            const result = DeduplicationEngine.deduplicateReviews(largeDataset, 'exact');
            const endTime = Date.now();

            expect(result.unique).toHaveLength(10000); // All unique in this case
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        });
    });
});
