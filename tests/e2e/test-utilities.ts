// cspell:locale en,es,fr,vi
// cspell:words Experiencia peor lugar Completamente decepcionante debajo expectativas Podría mejor Lugar promedio Nada Buena experiencia Bastante agradable recomendaría Excelente increíble Absolutamente fantástico
// cspell:words Expérience pire endroit Complètement décevant dessous attentes Pourrait être mieux Endroit moyenne Rien spécial Assez agréable recommande incroyable Absolument fantastique
// cspell:words MyEned wiI7pd
/**
 * E2E Test Utilities and Mocks
 *
 * Helper functions and mock implementations for end-to-end testing.
 * These utilities provide consistent test data generation and CLI interaction.
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';

// Test data generators
class TestDataGenerator {
    static generateReviewData(options: {
        count: number;
        placeId?: string;
        language?: string;
        dateRange?: { start: Date; end: Date };
        ratingDistribution?: Record<number, number>;
    }) {
        const { count, placeId = 'test-place-123', language = 'en' } = options;
        const reviews: any[] = [];

        for (let i = 0; i < count; i++) {
            const rating = this.generateRating(options.ratingDistribution);
            const date = this.generateRandomDate(options.dateRange);

            reviews.push({
                place_id: placeId,
                review_id: `review-${i}-${Date.now()}`,
                rating,
                author: `TestUser${i}`,
                text: this.generateReviewText(rating, language),
                language,
                review_time_utc: date.toISOString(),
                scraped_at_utc: new Date().toISOString(),
                hash: this.generateReviewHash(placeId, `review-${i}`, rating, date)
            });
        }

        return reviews;
    }

    static generateRating(distribution?: Record<number, number>): number {
        if (!distribution) {
            return Math.floor(Math.random() * 5) + 1;
        }

        const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        let random = Math.random() * total;

        for (const [rating, count] of Object.entries(distribution)) {
            random -= count;
            if (random <= 0) {
                return parseInt(rating, 10);
            }
        }

        return 5; // fallback
    }

    static generateRandomDate(range?: { start: Date; end: Date }): Date {
        const start = range?.start || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const end = range?.end || new Date();

        const startTime = start.getTime();
        const endTime = end.getTime();

        return new Date(startTime + Math.random() * (endTime - startTime));
    }

    static generateReviewText(rating: number, language: string): string {
        const templates = {
            en: {
                1: ['Terrible experience', 'Worst place ever', 'Completely disappointing'],
                2: ['Not good', 'Below expectations', 'Could be better'],
                3: ['Okay place', 'Average experience', 'Nothing special'],
                4: ['Good experience', 'Quite nice', 'Would recommend'],
                5: ['Excellent!', 'Amazing place!', 'Absolutely fantastic!']
            },
            es: {
                1: ['Experiencia terrible', 'El peor lugar', 'Completamente decepcionante'],
                2: ['No muy bueno', 'Por debajo de las expectativas', 'Podría ser mejor'],
                3: ['Lugar regular', 'Experiencia promedio', 'Nada especial'],
                4: ['Buena experiencia', 'Bastante agradable', 'Lo recomendaría'],
                5: ['¡Excelente!', '¡Lugar increíble!', '¡Absolutamente fantástico!']
            },
            fr: {
                1: ['Expérience terrible', 'Le pire endroit', 'Complètement décevant'],
                2: ['Pas très bon', 'En dessous des attentes', 'Pourrait être mieux'],
                3: ['Endroit correct', 'Expérience moyenne', 'Rien de spécial'],
                4: ['Bonne expérience', 'Assez agréable', 'Je recommande'],
                5: ['Excellent!', 'Endroit incroyable!', 'Absolument fantastique!']
            }
        };

        const langTemplates = templates[language as keyof typeof templates] || templates.en;
        const ratingTemplates = langTemplates[rating as keyof typeof langTemplates];

        return ratingTemplates[Math.floor(Math.random() * ratingTemplates.length)];
    }

    static generateReviewHash(placeId: string, reviewId: string, rating: number, date: Date): string {
        const data = `${placeId}-${reviewId}-${rating}-${date.toISOString()}`;
        return Buffer.from(data).toString('base64').slice(0, 16);
    }
}

// HTML fixture generator
class HTMLFixtureGenerator {
    static generateGoogleMapsPage(options: {
        placeId: string;
        placeName: string;
        reviews: any[];
        includeOwnerResponses?: boolean;
        includePhotos?: boolean;
        includeLoadMore?: boolean;
    }): string {
        const { placeId, placeName, reviews, includeOwnerResponses, includePhotos, includeLoadMore } = options;

        const reviewsHTML = reviews.map((review, index) => {
            const ownerResponse = includeOwnerResponses && Math.random() < 0.3 ? `
                <div class="owner-response" data-owner-response="true">
                    <div class="author">Business Owner</div>
                    <div class="text">Thank you for your feedback!</div>
                    <time datetime="${new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()}">
                        Response
                    </time>
                </div>
            ` : '';

            const photos = includePhotos && Math.random() < 0.2 ? `
                <div class="review-photos">
                    <img src="photo-${index}.jpg" alt="Review photo" data-photo-id="photo-${index}" />
                </div>
            ` : '';

            return `
                <div class="section-review" data-review-id="${review.review_id}">
                    <div class="section-review-stars">
                        <span class="MyEned" aria-label="${review.rating} stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
                    </div>
                    <div class="section-review-review-content">
                        <div class="section-review-text">
                            <span class="MyEned" role="button">${review.text}</span>
                        </div>
                        <div class="section-review-author">
                            <span>${review.author}</span>
                        </div>
                        <div class="section-review-publish-date">
                            <time datetime="${review.review_time_utc}">${this.formatRelativeDate(new Date(review.review_time_utc))}</time>
                        </div>
                        ${photos}
                        ${ownerResponse}
                    </div>
                </div>
            `;
        }).join('');

        const loadMoreButton = includeLoadMore ? `
            <button class="load-more-reviews" onclick="loadMoreReviews()">
                Load more reviews
            </button>
        ` : '';

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${placeName} - Google Maps</title>
                <style>
                    .section-review { margin: 10px 0; padding: 10px; border-bottom: 1px solid #eee; }
                    .section-review-stars { color: #fbbc04; }
                    .section-review-text { margin: 5px 0; }
                    .section-review-author { font-weight: bold; margin: 5px 0; }
                    .section-review-publish-date { color: #666; font-size: 0.9em; }
                    .owner-response { margin-left: 20px; padding: 5px; background: #f5f5f5; }
                    .review-photos img { max-width: 100px; margin: 5px; }
                    .load-more-reviews { padding: 10px 20px; margin: 20px 0; }
                </style>
            </head>
            <body data-place-id="${placeId}">
                <h1>${placeName}</h1>
                <div class="reviews-section">
                    <h2>Reviews</h2>
                    <div class="reviews-container">
                        ${reviewsHTML}
                    </div>
                    ${loadMoreButton}
                </div>

                <script>
                    function loadMoreReviews() {
                        console.log('Loading more reviews...');
                        // Simulate loading more reviews
                        setTimeout(() => {
                            const container = document.querySelector('.reviews-container');
                            const newReview = document.createElement('div');
                            newReview.className = 'section-review';
                            newReview.setAttribute('data-review-id', 'lazy-loaded-' + Date.now());
                            newReview.innerHTML = \`
                                <div class="section-review-stars">
                                    <span class="MyEned" aria-label="4 stars">★★★★☆</span>
                                </div>
                                <div class="section-review-review-content">
                                    <div class="section-review-text">
                                        <span class="MyEned" role="button">Lazy loaded review content</span>
                                    </div>
                                    <div class="section-review-author">
                                        <span>Lazy User</span>
                                    </div>
                                    <div class="section-review-publish-date">
                                        <time datetime="2024-01-15T10:30:00Z">2 months ago</time>
                                    </div>
                                </div>
                            \`;
                            container.appendChild(newReview);
                        }, 1000);
                    }
                </script>
            </body>
            </html>
        `;
    }

    static formatRelativeDate(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffYears > 0) {
            return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
        } else if (diffMonths > 0) {
            return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
        } else if (diffDays > 0) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else {
            return 'Today';
        }
    }

    static generateErrorPage(errorType: 'not-found' | 'access-denied' | 'server-error' | 'rate-limit'): string {
        const errorMessages = {
            'not-found': {
                title: '404 Not Found',
                message: 'The page you are looking for could not be found.',
                code: 404
            },
            'access-denied': {
                title: '403 Access Denied',
                message: 'You do not have permission to access this page.',
                code: 403
            },
            'server-error': {
                title: '500 Internal Server Error',
                message: 'An internal server error occurred.',
                code: 500
            },
            'rate-limit': {
                title: '429 Too Many Requests',
                message: 'You have made too many requests. Please try again later.',
                code: 429
            }
        };

        const error = errorMessages[errorType];

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${error.title}</title>
            </head>
            <body>
                <h1>${error.title}</h1>
                <p>${error.message}</p>
                <p>Error Code: ${error.code}</p>
            </body>
            </html>
        `;
    }
}

// CLI testing utilities
class CLITestUtilities {
    static async runCLICommand(
        command: string,
        args: string[],
        options: {
            timeout?: number;
            cwd?: string;
            env?: Record<string, string>;
            input?: string;
        } = {}
    ): Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
        duration: number;
    }> {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                stdio: 'pipe',
                cwd: options.cwd || process.cwd(),
                env: { ...process.env, ...options.env },
                shell: process.platform === 'win32'
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            if (options.input) {
                child.stdin?.write(options.input);
                child.stdin?.end();
            }

            const timeout = options.timeout || 30000;
            const timer = setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error(`Command timed out after ${timeout}ms`));
            }, timeout);

            child.on('close', (code) => {
                clearTimeout(timer);
                const duration = Date.now() - startTime;
                resolve({
                    exitCode: code || 0,
                    stdout,
                    stderr,
                    duration
                });
            });

            child.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }

    static async createTempFile(content: string, extension: string = '.html'): Promise<string> {
        const tempDir = path.join(process.cwd(), '.artifacts', 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        const filename = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${extension}`;
        const filepath = path.join(tempDir, filename);

        await fs.writeFile(filepath, content, 'utf-8');
        return filepath;
    }

    static async createTempDirectory(): Promise<string> {
        const tempDir = path.join(process.cwd(), '.artifacts', 'temp');
        const uniqueDir = path.join(tempDir, `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

        await fs.mkdir(uniqueDir, { recursive: true });
        return uniqueDir;
    }

    static async verifyFileExists(filepath: string): Promise<boolean> {
        try {
            await fs.access(filepath);
            return true;
        } catch {
            return false;
        }
    }

    static async verifyFileContent(filepath: string, expectedContent?: string): Promise<{
        exists: boolean;
        size: number;
        content?: string;
        lines?: number;
        validJson?: boolean;
    }> {
        try {
            const stats = await fs.stat(filepath);
            const content = await fs.readFile(filepath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim()).length;

            let validJson = false;
            try {
                // Try to parse each line as JSON (NDJSON format)
                const jsonLines = content.split('\n').filter(line => line.trim());
                for (const line of jsonLines) {
                    JSON.parse(line);
                }
                validJson = jsonLines.length > 0;
            } catch {
                // Try parsing as single JSON object
                try {
                    JSON.parse(content);
                    validJson = true;
                } catch {
                    validJson = false;
                }
            }

            return {
                exists: true,
                size: stats.size,
                content,
                lines,
                validJson
            };
        } catch {
            return {
                exists: false,
                size: 0
            };
        }
    }
}

// Data validation utilities
class DataValidationUtilities {
    static validateReviewSchema(review: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Required fields
        const requiredFields = ['place_id', 'review_id', 'rating', 'scraped_at_utc'];
        for (const field of requiredFields) {
            if (!review.hasOwnProperty(field)) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Data type validation
        if (review.place_id && typeof review.place_id !== 'string') {
            errors.push('place_id must be a string');
        }

        if (review.review_id && typeof review.review_id !== 'string') {
            errors.push('review_id must be a string');
        }

        if (review.rating !== undefined) {
            if (typeof review.rating !== 'number') {
                errors.push('rating must be a number');
            } else if (!Number.isInteger(review.rating)) {
                errors.push('rating must be an integer');
            } else if (review.rating < 1 || review.rating > 5) {
                errors.push('rating must be between 1 and 5');
            }
        }

        // Date validation
        if (review.scraped_at_utc) {
            try {
                const date = new Date(review.scraped_at_utc);
                if (isNaN(date.getTime())) {
                    errors.push('scraped_at_utc must be a valid ISO date string');
                }
            } catch {
                errors.push('scraped_at_utc must be a valid date string');
            }
        }

        if (review.review_time_utc) {
            try {
                const date = new Date(review.review_time_utc);
                if (isNaN(date.getTime())) {
                    errors.push('review_time_utc must be a valid ISO date string');
                }
            } catch {
                errors.push('review_time_utc must be a valid date string');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static calculateDataQualityScore(reviews: any[]): {
        score: number;
        metrics: {
            completeness: number;
            validity: number;
            consistency: number;
            uniqueness: number;
        };
        details: {
            totalReviews: number;
            validReviews: number;
            completeReviews: number;
            uniqueReviews: number;
        };
    } {
        const totalReviews = reviews.length;
        let validReviews = 0;
        let completeReviews = 0;
        const uniqueReviewIds = new Set();

        for (const review of reviews) {
            const validation = this.validateReviewSchema(review);
            if (validation.valid) {
                validReviews++;
            }

            // Check completeness (has text and author)
            if (review.text && review.author && review.text.trim() && review.author.trim()) {
                completeReviews++;
            }

            // Track uniqueness
            if (review.review_id) {
                uniqueReviewIds.add(review.review_id);
            }
        }

        const uniqueReviews = uniqueReviewIds.size;

        const completeness = totalReviews > 0 ? completeReviews / totalReviews : 0;
        const validity = totalReviews > 0 ? validReviews / totalReviews : 0;
        const consistency = totalReviews > 0 ? validReviews / totalReviews : 0; // Same as validity for now
        const uniqueness = totalReviews > 0 ? uniqueReviews / totalReviews : 0;

        const score = (completeness + validity + consistency + uniqueness) / 4;

        return {
            score,
            metrics: {
                completeness,
                validity,
                consistency,
                uniqueness
            },
            details: {
                totalReviews,
                validReviews,
                completeReviews,
                uniqueReviews
            }
        };
    }
}

export {
    TestDataGenerator,
    HTMLFixtureGenerator,
    CLITestUtilities,
    DataValidationUtilities
};
