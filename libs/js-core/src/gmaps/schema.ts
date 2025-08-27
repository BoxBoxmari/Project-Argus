/**
 * Unified review schema and types
 * Based on Project Argus Master Scraper data structures
 */

import { z } from 'zod';

// Author information schema
export const AuthorSchemaV1 = z.object({
    name: z.string().min(1),
    url: z.string().url().optional(),
    localGuide: z.boolean().optional(),
    reviewCount: z.number().int().nonnegative().optional(),
    profileImage: z.string().url().optional()
});

// Owner response schema
export const OwnerResponseSchemaV1 = z.object({
    text: z.string().min(1),
    timeISO: z.string().datetime().optional(),
    relativeTime: z.string().optional()
});

// Fetch metadata schema
export const FetchMetaSchemaV1 = z.object({
    ts: z.string().datetime(),
    agent: z.enum(['userscript', 'playwright', 'api']),
    source: z.literal('google-maps'),
    userAgent: z.string().optional(),
    sessionId: z.string().optional(),
    placeUrl: z.string().url().optional()
});

// Main review schema V1 (based on userscript data structure)
export const ReviewSchemaV1 = z.object({
    // Core identifiers
    id: z.string().min(1),
    placeId: z.string().min(1),

    // Author information
    author: AuthorSchemaV1,

    // Review content
    rating: z.number().min(1).max(5),
    text: z.string().optional(),
    language: z.string().optional(),

    // Timing information
    relativeTime: z.string().optional(),
    timeISO: z.string().datetime().optional(),

    // Additional content
    photos: z.array(z.string().url()).default([]),
    likes: z.number().int().nonnegative().optional(),
    helpful: z.number().int().nonnegative().optional(),

    // Owner response
    ownerResponse: OwnerResponseSchemaV1.optional(),

    // Metadata
    fetchMeta: FetchMetaSchemaV1
});

// Export types
export type AuthorV1 = z.infer<typeof AuthorSchemaV1>;
export type OwnerResponseV1 = z.infer<typeof OwnerResponseSchemaV1>;
export type FetchMetaV1 = z.infer<typeof FetchMetaSchemaV1>;
export type ReviewV1 = z.infer<typeof ReviewSchemaV1>;

// Validation helpers
export function validateReview(data: unknown): { success: true; data: ReviewV1 } | { success: false; error: string } {
    try {
        const result = ReviewSchemaV1.parse(data);
        return { success: true, data: result };
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        return { success: false, error: errorMsg };
    }
}

export function validateReviewSafe(data: unknown): ReviewV1 | null {
    try {
        return ReviewSchemaV1.parse(data);
    } catch (e) {
        return null;
    }
}

// Schema versioning for future compatibility
export const SCHEMA_VERSION = '1.0.0';

export interface ReviewBatch {
    schemaVersion: string;
    timestamp: string;
    reviews: ReviewV1[];
    metadata: {
        source: 'userscript' | 'playwright' | 'api';
        placeUrl?: string;
        totalExpected?: number;
        extractionStats?: {
            startTime: string;
            endTime: string;
            scrollRounds: number;
            idleRounds: number;
            expandedCount: number;
        };
    };
}

// Utility for creating review batch
export function createReviewBatch(
    reviews: ReviewV1[],
    source: 'userscript' | 'playwright' | 'api',
    metadata: Partial<ReviewBatch['metadata']> = {}
): ReviewBatch {
    return {
        schemaVersion: SCHEMA_VERSION,
        timestamp: new Date().toISOString(),
        reviews,
        metadata: {
            source,
            ...metadata
        }
    };
}

// Common field extractors for different environments
export const FieldExtractors = {
    // Extract rating from various formats
    extractRating(element: any): number {
        try {
            // Try aria-label patterns (from userscript)
            const ariaLabel = element.getAttribute?.('aria-label') || '';
            if (ariaLabel) {
                const match = ariaLabel.match(/(\d+(?:[.,]\d+)?)/);
                if (match) {
                    const rating = parseFloat(match[1].replace(',', '.'));
                    return Math.max(1, Math.min(5, Math.round(rating)));
                }
            }

            // Try star symbol counting
            const text = element.textContent || '';
            const stars = (text.match(/★/g) || []).length;
            if (stars > 0) {
                return Math.max(1, Math.min(5, stars));
            }

            return 0;
        } catch (e) {
            return 0;
        }
    },

    // Normalize review text (from userscript logic)
    normalizeText(text: string): string {
        if (!text) return '';

        return text
            .trim()
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
            .substring(0, 10000); // Reasonable length limit
    },

    // Extract author name safely
    extractAuthorName(element: any): string {
        try {
            const selectors = [
                '.section-review-title',
                '[data-review-id] button',
                '.section-review-header',
                'button[data-review-id]',
                'div[role="button"]',
                '.d4r55' // From userscript
            ];

            for (const selector of selectors) {
                const authorEl = element.querySelector?.(selector);
                if (authorEl?.textContent?.trim()) {
                    return authorEl.textContent.trim();
                }
            }

            return 'Anonymous';
        } catch (e) {
            return 'Anonymous';
        }
    },

    // Extract relative time
    extractRelativeTime(element: any): string {
        try {
            const selectors = [
                '.section-review-publish-date',
                '.section-review-date',
                '[class*="date"]',
                '.rsqaWe', // From userscript
                '.bp9Aid'  // From userscript
            ];

            for (const selector of selectors) {
                const dateEl = element.querySelector?.(selector);
                if (dateEl?.textContent?.trim()) {
                    return dateEl.textContent.trim();
                }
            }

            return '';
        } catch (e) {
            return '';
        }
    }
};