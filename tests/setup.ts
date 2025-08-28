/**
 * Global test setup for Argus Testing Suite
 * This file runs before all tests and sets up global utilities and environment
 */

// Import testing library extensions for Jest DOM matchers
import '@testing-library/jest-dom';
import { promises as fs } from 'fs';
import path from 'path';
import { TextEncoder, TextDecoder } from 'node:util';

// Polyfills for Node.js environment
// Assign Node.js TextEncoder/TextDecoder to global scope
if (typeof global.TextEncoder === 'undefined') {
    (global as any).TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
    (global as any).TextDecoder = TextDecoder;
}

// Add fetch polyfill if needed (jsdom doesn't include it by default)
if (typeof global.fetch === 'undefined') {
    // Note: In real tests, you'd want to use a fetch mock
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
            text: () => Promise.resolve(''),
        })
    ) as jest.Mock;
}

// Global test timeout
jest.setTimeout(60000);

// Test environment configuration
const TEST_ENV = {
    ARGUS_HEADFUL: '0',
    ARGUS_BROWSER_CHANNEL: 'chromium',
    ARGUS_TLS_BYPASS: '1',
    ARGUS_ALLOW_MEDIA: '0',
    ARGUS_MAX_ROUNDS: '5',
    ARGUS_IDLE_LIMIT: '3',
    ARGUS_SCROLL_PAUSE: '500',
    ARGUS_CONCURRENCY: '1',
    NODE_ENV: 'test'
};

// Apply test environment variables
Object.assign(process.env, TEST_ENV);

// Global test utilities
declare global {
    namespace globalThis {
        var testUtils: {
            loadFixture: (name: string) => Promise<string>;
            loadGolden: (name: string) => Promise<any[]>;
            saveArtifact: (name: string, content: string | Buffer) => Promise<void>;
            createRunId: () => string;
            mockTimestamp: () => number;
            cleanup: () => Promise<void>;
        };
    }
}

// Test utilities implementation
globalThis.testUtils = {
    /**
     * Load HTML fixture from tests/fixtures/maps directory
     */
    async loadFixture(name: string): Promise<string> {
        // Try the structured directory first
        let fixturePath = path.join(__dirname, 'fixtures', 'maps', name, 'index.html');
        try {
            return await fs.readFile(fixturePath, 'utf-8');
        } catch (error) {
            // Fall back to simple HTML files
            fixturePath = path.join(__dirname, 'fixtures', 'maps', `${name}.html`);
            try {
                return await fs.readFile(fixturePath, 'utf-8');
            } catch (fallbackError) {
                throw new Error(`Failed to load fixture ${name}: ${error}`);
            }
        }
    },

    /**
     * Load golden reference data from tests/golden directory
     */
    async loadGolden(name: string): Promise<any[]> {
        const goldenPath = path.join(__dirname, 'golden', `${name}.json`);
        try {
            const content = await fs.readFile(goldenPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to load golden data ${name}: ${error}`);
        }
    },

    /**
     * Save test artifacts for debugging
     */
    async saveArtifact(name: string, content: string | Buffer): Promise<void> {
        const runId = process.env.TEST_RUN_ID || 'unknown';
        const artifactDir = path.join(__dirname, '..', '.artifacts', runId);

        await fs.mkdir(artifactDir, { recursive: true });

        const artifactPath = path.join(artifactDir, name);
        await fs.writeFile(artifactPath, content);
    },

    /**
     * Create unique run ID for test artifacts
     */
    createRunId(): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = Math.random().toString(36).substring(2, 8);
        return `test-${timestamp}-${random}`;
    },

    /**
     * Mock consistent timestamp for deterministic tests
     */
    mockTimestamp(): number {
        return 1640995200000; // 2022-01-01T00:00:00.000Z
    },

    /**
     * Cleanup test artifacts and temporary files
     */
    async cleanup(): Promise<void> {
        const tempDirs = [
            path.join(__dirname, '..', '.artifacts', 'temp'),
            path.join(__dirname, '..', 'datasets', 'test')
        ];

        for (const dir of tempDirs) {
            try {
                await fs.rm(dir, { recursive: true, force: true });
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    }
};

// Set TEST_RUN_ID for artifact tracking
if (!process.env.TEST_RUN_ID) {
    process.env.TEST_RUN_ID = globalThis.testUtils.createRunId();
}

// Console interceptor for error tracking
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
    // Track errors for later analysis
    globalThis.testUtils.saveArtifact('console-errors.log',
        `[${new Date().toISOString()}] ERROR: ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
        ).join(' ')}\n`
    ).catch(() => { });
    originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
    // Track warnings for later analysis
    globalThis.testUtils.saveArtifact('console-warnings.log',
        `[${new Date().toISOString()}] WARN: ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
        ).join(' ')}\n`
    ).catch(() => { });
    originalConsoleWarn(...args);
};

// Cleanup after each test
afterEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Clean up any test-specific state
    if (global.gc) {
        global.gc();
    }
});

// Cleanup after all tests
afterAll(async () => {
    await globalThis.testUtils.cleanup();
});

export { };
