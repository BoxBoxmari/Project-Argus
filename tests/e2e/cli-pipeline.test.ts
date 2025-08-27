/**
 * End-to-End Tests - CLI and Pipeline Integration
 *
 * These tests verify complete system functionality from CLI input to data output,
 * including configuration handling, error scenarios, and real data processing.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

describe('E2E Tests - CLI and Pipeline', () => {
    const testDataDir = path.join(process.cwd(), '.artifacts', 'e2e-test-data');
    const tempConfigDir = path.join(testDataDir, 'config');
    const tempOutputDir = path.join(testDataDir, 'output');

    beforeEach(async () => {
        // Create test directories
        await fs.mkdir(testDataDir, { recursive: true });
        await fs.mkdir(tempConfigDir, { recursive: true });
        await fs.mkdir(tempOutputDir, { recursive: true });
    });

    afterEach(async () => {
        // Cleanup test data
        if (existsSync(testDataDir)) {
            await fs.rm(testDataDir, { recursive: true, force: true });
        }
    });

    describe('CLI Argument Parsing and Configuration', () => {
        test('should handle basic CLI arguments correctly', async () => {
            const testArgs = [
                '--url', 'https://www.google.com/maps/place/test',
                '--output', tempOutputDir,
                '--max-reviews', '50',
                '--headless', 'true'
            ];

            const result = await runCLI(testArgs, { timeout: 10000 });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Configuration loaded');
            expect(result.stdout).toContain('max-reviews: 50');
            expect(result.stdout).toContain('headless: true');
        });

        test('should validate required arguments', async () => {
            const testArgs = ['--output', tempOutputDir]; // Missing --url

            const result = await runCLI(testArgs, { timeout: 5000 });

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('URL is required');
        });

        test('should handle invalid argument values', async () => {
            const testArgs = [
                '--url', 'invalid-url',
                '--max-reviews', 'not-a-number',
                '--output', '/invalid/path/that/does/not/exist'
            ];

            const result = await runCLI(testArgs, { timeout: 5000 });

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toMatch(/invalid.*url|URL.*invalid/i);
        });

        test('should load configuration from .env file', async () => {
            // Create test .env file
            const envContent = `
ARGUS_HEADFUL=false
ARGUS_MAX_REVIEWS=100
ARGUS_BROWSER_CHANNEL=chrome
ARGUS_BLOCK_RESOURCES=true
ARGUS_MAX_ROUNDS=5
`;

            await fs.writeFile(path.join(tempConfigDir, '.env'), envContent);

            const testArgs = [
                '--url', 'https://www.google.com/maps/place/test',
                '--output', tempOutputDir,
                '--config', path.join(tempConfigDir, '.env')
            ];

            const result = await runCLI(testArgs, { timeout: 10000 });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('max-reviews: 100');
            expect(result.stdout).toContain('browser-channel: chrome');
        });
    });

    describe('Pipeline Integration with Fixtures', () => {
        test('should process minimal fixture and produce valid output', async () => {
            const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_minimal', 'index.html')}`;
            const outputFile = path.join(tempOutputDir, 'minimal-reviews.ndjson');

            const testArgs = [
                '--url', fixtureUrl,
                '--output', outputFile,
                '--max-reviews', '10',
                '--headless', 'true',
                '--timeout', '30000'
            ];

            const result = await runCLI(testArgs, { timeout: 45000 });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Processing completed');

            // Verify output file exists and has valid content
            expect(existsSync(outputFile)).toBe(true);

            const outputContent = await fs.readFile(outputFile, 'utf-8');
            const lines = outputContent.trim().split('\n').filter(line => line.trim());

            expect(lines.length).toBeGreaterThan(0);

            // Validate each line is valid NDJSON with required schema
            for (const line of lines) {
                const review = JSON.parse(line);
                expect(review).toHaveProperty('place_id');
                expect(review).toHaveProperty('review_id');
                expect(review).toHaveProperty('rating');
                expect(review).toHaveProperty('scraped_at_utc');
                expect(review.rating).toBeGreaterThanOrEqual(1);
                expect(review.rating).toBeLessThanOrEqual(5);
            }
        });

        test('should process complex fixture with all features', async () => {
            const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_complex', 'index.html')}`;
            const outputFile = path.join(tempOutputDir, 'complex-reviews.ndjson');

            const testArgs = [
                '--url', fixtureUrl,
                '--output', outputFile,
                '--max-reviews', '50',
                '--extract-owner-responses', 'true',
                '--extract-photos', 'true',
                '--headless', 'true'
            ];

            const result = await runCLI(testArgs, { timeout: 60000 });

            expect(result.exitCode).toBe(0);

            const outputContent = await fs.readFile(outputFile, 'utf-8');
            const reviews = outputContent.trim().split('\n').map(line => JSON.parse(line));

            expect(reviews.length).toBeGreaterThan(0);

            // Should have at least one review with owner response
            const reviewsWithResponses = reviews.filter(r => r.owner_response_text);
            expect(reviewsWithResponses.length).toBeGreaterThan(0);

            // Should have reviews with photos
            const reviewsWithPhotos = reviews.filter(r => r.photos && r.photos.length > 0);
            expect(reviewsWithPhotos.length).toBeGreaterThan(0);
        });

        test('should handle multi-language fixture correctly', async () => {
            const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_i18n_mixed', 'index.html')}`;
            const outputFile = path.join(tempOutputDir, 'i18n-reviews.ndjson');

            const testArgs = [
                '--url', fixtureUrl,
                '--output', outputFile,
                '--detect-language', 'true',
                '--normalize-unicode', 'true',
                '--headless', 'true'
            ];

            const result = await runCLI(testArgs, { timeout: 45000 });

            expect(result.exitCode).toBe(0);

            const outputContent = await fs.readFile(outputFile, 'utf-8');
            const reviews = outputContent.trim().split('\n').map(line => JSON.parse(line));

            // Should detect multiple languages
            const languages = new Set(reviews.map(r => r.language).filter(Boolean));
            expect(languages.size).toBeGreaterThan(1);

            // Should include expected languages from fixture
            expect([...languages]).toEqual(expect.arrayContaining(['vi', 'en', 'ja', 'ar']));

            // Should handle RTL text properly
            const arabicReviews = reviews.filter(r => r.language === 'ar');
            expect(arabicReviews.length).toBeGreaterThan(0);
        });
    });

    describe('Data Format and Export Options', () => {
        test('should export to CSV format with proper encoding', async () => {
            const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_minimal', 'index.html')}`;
            const outputFile = path.join(tempOutputDir, 'reviews.csv');

            const testArgs = [
                '--url', fixtureUrl,
                '--output', outputFile,
                '--format', 'csv',
                '--encoding', 'utf-8',
                '--include-headers', 'true'
            ];

            const result = await runCLI(testArgs, { timeout: 30000 });

            expect(result.exitCode).toBe(0);
            expect(existsSync(outputFile)).toBe(true);

            const csvContent = await fs.readFile(outputFile, 'utf-8');
            const lines = csvContent.trim().split('\n');

            // Should have header row
            expect(lines[0]).toContain('place_id');
            expect(lines[0]).toContain('review_id');
            expect(lines[0]).toContain('rating');

            // Should have data rows
            expect(lines.length).toBeGreaterThan(1);
        });

        test('should export to Parquet format with schema validation', async () => {
            const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_minimal', 'index.html')}`;
            const outputFile = path.join(tempOutputDir, 'reviews.parquet');

            const testArgs = [
                '--url', fixtureUrl,
                '--output', outputFile,
                '--format', 'parquet',
                '--validate-schema', 'true'
            ];

            const result = await runCLI(testArgs, { timeout: 30000 });

            expect(result.exitCode).toBe(0);
            expect(existsSync(outputFile)).toBe(true);

            // File should not be empty
            const stats = await fs.stat(outputFile);
            expect(stats.size).toBeGreaterThan(0);
        });

        test('should handle large dataset streaming export', async () => {
            // Generate large fixture on the fly
            const largeFixtureContent = generateLargeFixtureHTML(1000);
            const largeFixturePath = path.join(tempOutputDir, 'large-fixture.html');
            await fs.writeFile(largeFixturePath, largeFixtureContent);

            const fixtureUrl = `file://${largeFixturePath}`;
            const outputFile = path.join(tempOutputDir, 'large-reviews.ndjson');

            const testArgs = [
                '--url', fixtureUrl,
                '--output', outputFile,
                '--stream-output', 'true',
                '--batch-size', '100',
                '--memory-limit', '256MB'
            ];

            const result = await runCLI(testArgs, { timeout: 120000 });

            expect(result.exitCode).toBe(0);
            expect(existsSync(outputFile)).toBe(true);

            // Should handle memory efficiently
            expect(result.stdout).toContain('Streaming mode enabled');
            expect(result.stdout).toMatch(/Memory usage.*MB/);
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle network timeout gracefully', async () => {
            const testArgs = [
                '--url', 'https://httpstat.us/504?sleep=60000', // Simulate slow response
                '--output', path.join(tempOutputDir, 'timeout-test.ndjson'),
                '--timeout', '5000',
                '--retries', '2'
            ];

            const result = await runCLI(testArgs, { timeout: 20000 });

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toMatch(/timeout|failed to load/i);
            expect(result.stdout).toContain('Retrying');
        });

        test('should handle rate limiting with backoff', async () => {
            // This would need a mock server for proper testing
            const testArgs = [
                '--url', 'https://httpstat.us/429',
                '--output', path.join(tempOutputDir, 'rate-limit-test.ndjson'),
                '--handle-rate-limit', 'true',
                '--backoff-strategy', 'exponential'
            ];

            const result = await runCLI(testArgs, { timeout: 30000 });

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toMatch(/rate.?limit|429|backoff/i);
        });

        test('should handle DOM changes gracefully', async () => {
            const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_dom_shift', 'index.html')}`;
            const outputFile = path.join(tempOutputDir, 'dom-shift-test.ndjson');

            const testArgs = [
                '--url', fixtureUrl,
                '--output', outputFile,
                '--fallback-selectors', 'true',
                '--adaptive-parsing', 'true'
            ];

            const result = await runCLI(testArgs, { timeout: 30000 });

            // Should either succeed with fallback selectors or fail gracefully
            if (result.exitCode === 0) {
                expect(result.stdout).toContain('Using fallback selectors');
            } else {
                expect(result.stderr).toContain('DOM structure changed');
                expect(result.stderr).toContain('Unable to extract reviews');
            }
        });

        test('should validate data quality and reject bad data', async () => {
            // Create fixture with intentionally bad data
            const badDataFixture = `
                <html>
                    <body>
                        <div data-review-id="bad1">
                            <span class="rating">invalid-rating</span>
                            <span class="text">This is a review</span>
                        </div>
                        <div data-review-id="">
                            <span class="rating">5</span>
                            <span class="text">Empty review ID</span>
                        </div>
                        <div data-review-id="good1">
                            <span class="rating">4</span>
                            <span class="text">This is a valid review</span>
                        </div>
                    </body>
                </html>
            `;

            const badFixturePath = path.join(tempOutputDir, 'bad-data-fixture.html');
            await fs.writeFile(badFixturePath, badDataFixture);

            const fixtureUrl = `file://${badFixturePath}`;
            const outputFile = path.join(tempOutputDir, 'bad-data-test.ndjson');

            const testArgs = [
                '--url', fixtureUrl,
                '--output', outputFile,
                '--strict-validation', 'true',
                '--reject-invalid', 'true'
            ];

            const result = await runCLI(testArgs, { timeout: 30000 });

            expect(result.exitCode).toBe(0); // Should succeed but filter bad data
            expect(result.stdout).toContain('rejected');
            expect(result.stdout).toContain('validation failed');

            // Should only have valid reviews in output
            const outputContent = await fs.readFile(outputFile, 'utf-8');
            const reviews = outputContent.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));

            expect(reviews.length).toBe(1); // Only the valid review
            expect(reviews[0].review_id).toBe('good1');
        });
    });

    describe('Performance and Concurrency', () => {
        test('should handle multiple URLs concurrently', async () => {
            const urls = [
                `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_minimal', 'index.html')}`,
                `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_complex', 'index.html')}`,
            ];

            const outputFile = path.join(tempOutputDir, 'concurrent-test.ndjson');
            const urlsFile = path.join(tempOutputDir, 'urls.txt');
            await fs.writeFile(urlsFile, urls.join('\n'));

            const testArgs = [
                '--urls-file', urlsFile,
                '--output', outputFile,
                '--concurrency', '2',
                '--merge-results', 'true'
            ];

            const result = await runCLI(testArgs, { timeout: 60000 });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Processing 2 URLs');
            expect(result.stdout).toContain('concurrent workers: 2');

            // Should have results from both URLs
            const outputContent = await fs.readFile(outputFile, 'utf-8');
            const reviews = outputContent.trim().split('\n').map(line => JSON.parse(line));

            expect(reviews.length).toBeGreaterThan(0);

            // Should have unique place_ids from different fixtures
            const placeIds = new Set(reviews.map(r => r.place_id));
            expect(placeIds.size).toBeGreaterThan(1);
        });

        test('should respect memory limits during processing', async () => {
            const testArgs = [
                '--url', `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_minimal', 'index.html')}`,
                '--output', path.join(tempOutputDir, 'memory-test.ndjson'),
                '--memory-limit', '100MB',
                '--enable-gc-monitoring', 'true'
            ];

            const result = await runCLI(testArgs, { timeout: 30000 });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toMatch(/memory.*MB/i);
        });
    });

    describe('Observability and Telemetry', () => {
        test('should generate comprehensive logs', async () => {
            const logFile = path.join(tempOutputDir, 'test.log');
            const testArgs = [
                '--url', `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_minimal', 'index.html')}`,
                '--output', path.join(tempOutputDir, 'log-test.ndjson'),
                '--log-file', logFile,
                '--log-level', 'debug',
                '--correlation-id', 'test-run-123'
            ];

            const result = await runCLI(testArgs, { timeout: 30000 });

            expect(result.exitCode).toBe(0);
            expect(existsSync(logFile)).toBe(true);

            const logContent = await fs.readFile(logFile, 'utf-8');
            expect(logContent).toContain('test-run-123');
            expect(logContent).toContain('Starting extraction');
            expect(logContent).toContain('Extraction completed');
        });

        test('should export metrics and telemetry', async () => {
            const metricsFile = path.join(tempOutputDir, 'metrics.json');
            const testArgs = [
                '--url', `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_minimal', 'index.html')}`,
                '--output', path.join(tempOutputDir, 'metrics-test.ndjson'),
                '--export-metrics', metricsFile,
                '--track-performance', 'true'
            ];

            const result = await runCLI(testArgs, { timeout: 30000 });

            expect(result.exitCode).toBe(0);
            expect(existsSync(metricsFile)).toBe(true);

            const metrics = JSON.parse(await fs.readFile(metricsFile, 'utf-8'));
            expect(metrics).toHaveProperty('extraction_time_ms');
            expect(metrics).toHaveProperty('reviews_extracted');
            expect(metrics).toHaveProperty('reviews_per_second');
            expect(metrics).toHaveProperty('memory_peak_mb');
        });
    });
});

// Helper functions
async function runCLI(args: string[], options: { timeout?: number } = {}): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
}> {
    return new Promise((resolve, reject) => {
        const cliPath = path.join(process.cwd(), 'apps', 'scraper-playwright', 'dist', 'cli.js');
        const child = spawn('node', [cliPath, ...args], {
            stdio: 'pipe',
            env: { ...process.env, NODE_ENV: 'test' }
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        const timeout = options.timeout || 30000;
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`CLI process timed out after ${timeout}ms`));
        }, timeout);

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({
                exitCode: code || 0,
                stdout,
                stderr
            });
        });

        child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

function generateLargeFixtureHTML(reviewCount: number): string {
    const reviews = Array.from({ length: reviewCount }, (_, i) => `
        <div data-review-id="review-${i}">
            <span class="rating">${Math.floor(Math.random() * 5) + 1}</span>
            <span class="author">User ${i}</span>
            <span class="text">This is review number ${i} with some content.</span>
            <time datetime="${new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()}">
                ${Math.floor(Math.random() * 12) + 1} months ago
            </time>
        </div>
    `).join('');

    return `
        <html>
            <head><title>Large Test Fixture</title></head>
            <body>
                <div class="reviews-container">
                    ${reviews}
                </div>
            </body>
        </html>
    `;
}