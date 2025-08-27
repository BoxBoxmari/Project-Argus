import { existsSync } from 'fs';
import { resolve } from 'path';

// Test basic imports
try {
    // Test queue implementation
    const { MemoryQueue } = require('@argus/js-core/queue/memoryQueue');
    const q = new MemoryQueue();
    q.enqueue(['test-url']);
    console.log('MemoryQueue test:', q.size() === 1 ? 'passed' : 'failed');

    // Test session pool implementation
    const { SessionPool } = require('@argus/js-core/session/sessionPool');
    const sp = new SessionPool({ maxAgeMs: 20 * 60 * 1000, minScore: 0.5 });
    const s = sp.get();
    console.log('SessionPool test:', s ? 'passed' : 'failed');

    // Test crawler implementation
    const { ArgusCrawler } = require('@argus/js-core/scraper-playwright/crawler');
    console.log('ArgusCrawler test:', ArgusCrawler ? 'passed' : 'failed');

    console.log('Basic implementation tests completed successfully');
} catch (error) {
    console.error('Implementation test failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
}