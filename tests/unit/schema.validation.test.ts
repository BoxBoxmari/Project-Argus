/**
 * Schema Contract Tests - JavaScript/TypeScript
 *
 * These tests validate that data structures conform to expected schemas
 * and that validation logic correctly identifies valid/invalid data.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    ReviewSchemaV1,
    validateReview,
    validateReviewSafe,
    createReviewBatch,
    AuthorSchemaV1,
    OwnerResponseSchemaV1,
    FetchMetaSchemaV1,
    SCHEMA_VERSION
} from '../../libs/js-core/src/gmaps/schema';

describe('Schema Contract Tests - JavaScript', () => {
    let validReviewData: any;
    let validAuthorData: any;
    let validFetchMeta: any;

    beforeEach(() => {
        validAuthorData = {
            name: 'John Smith',
            url: 'https://maps.google.com/contrib/123456789',
            localGuide: true,
            reviewCount: 25,
            profileImage: 'https://lh3.googleusercontent.com/profile123'
        };

        validFetchMeta = {
            ts: new Date().toISOString(),
            agent: 'playwright' as const,
            source: 'google-maps' as const,
            userAgent: 'Mozilla/5.0 Test Browser',
            sessionId: 'session-123',
            placeUrl: 'https://www.google.com/maps/place/Test+Place/'
        };

        validReviewData = {
            id: 'ChdDSUhNMG9nS0VJQ0FnSURhcU1ESzF3RRAB',
            placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
            author: validAuthorData,
            rating: 5,
            text: 'Great place! Highly recommended.',
            language: 'en',
            relativeTime: '2 months ago',
            timeISO: '2023-10-15T10:30:00Z',
            photos: ['https://example.com/photo1.jpg'],
            likes: 15,
            helpful: 12,
            ownerResponse: {
                text: 'Thank you for your review!',
                timeISO: '2023-10-16T09:00:00Z',
                relativeTime: '2 months ago'
            },
            fetchMeta: validFetchMeta
        };
    });

    describe('AuthorSchemaV1 Validation', () => {
        test('should validate complete author data', () => {
            const result = AuthorSchemaV1.safeParse(validAuthorData);
            expect(result.success).toBe(true);
        });

        test('should validate minimal author data', () => {
            const minimalAuthor = { name: 'Jane Doe' };
            const result = AuthorSchemaV1.safeParse(minimalAuthor);
            expect(result.success).toBe(true);
        });

        test('should reject empty author name', () => {
            const invalidAuthor = { name: '' };
            const result = AuthorSchemaV1.safeParse(invalidAuthor);
            expect(result.success).toBe(false);
        });

        test('should reject invalid review count', () => {
            const invalidAuthor = { ...validAuthorData, reviewCount: -5 };
            const result = AuthorSchemaV1.safeParse(invalidAuthor);
            expect(result.success).toBe(false);
        });

        test('should reject invalid URL format', () => {
            const invalidAuthor = { ...validAuthorData, url: 'not-a-url' };
            const result = AuthorSchemaV1.safeParse(invalidAuthor);
            expect(result.success).toBe(false);
        });
    });

    describe('OwnerResponseSchemaV1 Validation', () => {
        test('should validate complete owner response', () => {
            const ownerResponse = {
                text: 'Thank you for your feedback!',
                timeISO: '2023-10-16T09:00:00Z',
                relativeTime: '2 months ago'
            };
            const result = OwnerResponseSchemaV1.safeParse(ownerResponse);
            expect(result.success).toBe(true);
        });

        test('should validate minimal owner response', () => {
            const minimalResponse = { text: 'Thanks!' };
            const result = OwnerResponseSchemaV1.safeParse(minimalResponse);
            expect(result.success).toBe(true);
        });

        test('should reject empty response text', () => {
            const invalidResponse = { text: '' };
            const result = OwnerResponseSchemaV1.safeParse(invalidResponse);
            expect(result.success).toBe(false);
        });

        test('should reject invalid ISO datetime', () => {
            const invalidResponse = {
                text: 'Thanks!',
                timeISO: 'not-a-date'
            };
            const result = OwnerResponseSchemaV1.safeParse(invalidResponse);
            expect(result.success).toBe(false);
        });
    });

    describe('FetchMetaSchemaV1 Validation', () => {
        test('should validate complete fetch metadata', () => {
            const result = FetchMetaSchemaV1.safeParse(validFetchMeta);
            expect(result.success).toBe(true);
        });

        test('should validate minimal fetch metadata', () => {
            const minimalMeta = {
                ts: new Date().toISOString(),
                agent: 'userscript' as const,
                source: 'google-maps' as const
            };
            const result = FetchMetaSchemaV1.safeParse(minimalMeta);
            expect(result.success).toBe(true);
        });

        test('should reject invalid agent type', () => {
            const invalidMeta = { ...validFetchMeta, agent: 'invalid-agent' };
            const result = FetchMetaSchemaV1.safeParse(invalidMeta);
            expect(result.success).toBe(false);
        });

        test('should reject invalid timestamp format', () => {
            const invalidMeta = { ...validFetchMeta, ts: 'not-a-timestamp' };
            const result = FetchMetaSchemaV1.safeParse(invalidMeta);
            expect(result.success).toBe(false);
        });

        test('should reject invalid source', () => {
            const invalidMeta = { ...validFetchMeta, source: 'yelp' };
            const result = FetchMetaSchemaV1.safeParse(invalidMeta);
            expect(result.success).toBe(false);
        });
    });

    describe('ReviewSchemaV1 Validation', () => {
        test('should validate complete review data', () => {
            const result = validateReview(validReviewData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe(validReviewData.id);
                expect(result.data.rating).toBe(5);
                expect(result.data.author.name).toBe('John Smith');
            }
        });

        test('should validate minimal review data', () => {
            const minimalReview = {
                id: 'minimal-review-id',
                placeId: 'minimal-place-id',
                author: { name: 'Minimal Author' },
                rating: 3,
                fetchMeta: {
                    ts: new Date().toISOString(),
                    agent: 'userscript' as const,
                    source: 'google-maps' as const
                }
            };
            const result = validateReview(minimalReview);
            expect(result.success).toBe(true);
        });

        test('should reject missing required fields', () => {
            const invalidReview = { ...validReviewData };
            delete invalidReview.id;
            const result = validateReview(invalidReview);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain('id');
            }
        });

        test('should reject invalid rating values', () => {
            const testCases = [0, 6, -1, 10, 'invalid'];

            testCases.forEach(invalidRating => {
                const invalidReview = { ...validReviewData, rating: invalidRating };
                const result = validateReview(invalidReview);
                expect(result.success).toBe(false);
            });
        });

        test('should validate rating boundary values', () => {
            const validRatings = [1, 2, 3, 4, 5];

            validRatings.forEach(rating => {
                const reviewWithRating = { ...validReviewData, rating };
                const result = validateReview(reviewWithRating);
                expect(result.success).toBe(true);
            });
        });

        test('should handle missing optional fields gracefully', () => {
            const reviewWithoutOptionals = {
                id: 'test-id',
                placeId: 'test-place-id',
                author: { name: 'Test Author' },
                rating: 4,
                fetchMeta: validFetchMeta
            };

            const result = validateReview(reviewWithoutOptionals);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.photos).toEqual([]);
                expect(result.data.text).toBeUndefined();
                expect(result.data.ownerResponse).toBeUndefined();
            }
        });

        test('should validate empty photos array by default', () => {
            const reviewWithoutPhotos = { ...validReviewData };
            delete reviewWithoutPhotos.photos;

            const result = validateReview(reviewWithoutPhotos);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.photos).toEqual([]);
            }
        });

        test('should validate photo URL format', () => {
            const invalidPhotos = ['not-a-url', 'ftp://invalid.com/photo.jpg'];

            invalidPhotos.forEach(invalidPhoto => {
                const reviewWithInvalidPhoto = {
                    ...validReviewData,
                    photos: [invalidPhoto]
                };
                const result = validateReview(reviewWithInvalidPhoto);
                expect(result.success).toBe(false);
            });
        });

        test('should validate nested author data', () => {
            const reviewWithInvalidAuthor = {
                ...validReviewData,
                author: { name: '' }
            };

            const result = validateReview(reviewWithInvalidAuthor);
            expect(result.success).toBe(false);
        });

        test('should validate nested owner response', () => {
            const reviewWithInvalidOwnerResponse = {
                ...validReviewData,
                ownerResponse: { text: '' }
            };

            const result = validateReview(reviewWithInvalidOwnerResponse);
            expect(result.success).toBe(false);
        });
    });

    describe('Validation Helper Functions', () => {
        test('validateReviewSafe should return null for invalid data', () => {
            const invalidReview = { invalid: 'data' };
            const result = validateReviewSafe(invalidReview);
            expect(result).toBeNull();
        });

        test('validateReviewSafe should return parsed data for valid input', () => {
            const result = validateReviewSafe(validReviewData);
            expect(result).not.toBeNull();
            expect(result?.id).toBe(validReviewData.id);
        });
    });

    describe('Review Batch Creation', () => {
        test('should create review batch with correct structure', () => {
            const reviews = [validReviewData];
            const batch = createReviewBatch(reviews, 'playwright', {
                placeUrl: 'https://example.com/place',
                totalExpected: 10
            });

            expect(batch.schemaVersion).toBe(SCHEMA_VERSION);
            expect(batch.reviews).toHaveLength(1);
            expect(batch.metadata.source).toBe('playwright');
            expect(batch.metadata.placeUrl).toBe('https://example.com/place');
            expect(batch.metadata.totalExpected).toBe(10);
            expect(batch.timestamp).toBeDefined();
        });

        test('should handle empty reviews array', () => {
            const batch = createReviewBatch([], 'userscript');
            expect(batch.reviews).toHaveLength(0);
            expect(batch.metadata.source).toBe('userscript');
        });
    });

    describe('Schema Versioning', () => {
        test('should maintain consistent schema version', () => {
            expect(SCHEMA_VERSION).toBe('1.0.0');
        });

        test('should include schema version in batch', () => {
            const batch = createReviewBatch([], 'api');
            expect(batch.schemaVersion).toBe(SCHEMA_VERSION);
        });
    });

    describe('Error Message Quality', () => {
        test('should provide meaningful error messages', () => {
            const invalidReview = {
                id: '',
                placeId: 'valid-place-id',
                author: { name: '' },
                rating: 0,
                fetchMeta: {
                    ts: 'invalid-timestamp',
                    agent: 'invalid-agent',
                    source: 'invalid-source'
                }
            };

            const result = validateReview(invalidReview);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain('id');
                // Should mention multiple validation failures
                const errorCount = (result.error.match(/Expected/g) || []).length;
                expect(errorCount).toBeGreaterThan(1);
            }
        });
    });

    describe('Data Type Coercion', () => {
        test('should handle string numbers for rating', () => {
            const reviewWithStringRating = {
                ...validReviewData,
                rating: '4' as any
            };

            const result = validateReview(reviewWithStringRating);
            // Should fail - we want strict typing
            expect(result.success).toBe(false);
        });

        test('should handle boolean-like values', () => {
            const reviewWithStringBoolean = {
                ...validReviewData,
                author: { ...validAuthorData, localGuide: 'true' as any }
            };

            const result = validateReview(reviewWithStringBoolean);
            // Should fail - we want strict typing
            expect(result.success).toBe(false);
        });
    });

    describe('Unicode and Special Characters', () => {
        test('should handle Unicode text content', () => {
            const unicodeReview = {
                ...validReviewData,
                text: '这是一个很好的咖啡店! ☕️🌟 مقهى رائع جداً! Excellent café! 素晴らしいカフェです！',
                author: { name: '李明 أحمد José Müller' }
            };

            const result = validateReview(unicodeReview);
            expect(result.success).toBe(true);
        });

        test('should handle emoji in review text', () => {
            const emojiReview = {
                ...validReviewData,
                text: 'Great food! 🍕🍔🍟 Highly recommend! 👍⭐⭐⭐⭐⭐'
            };

            const result = validateReview(emojiReview);
            expect(result.success).toBe(true);
        });
    });
});
