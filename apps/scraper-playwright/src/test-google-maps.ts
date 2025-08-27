import { ArgusCrawler } from './crawler.js';
import { promises as fs } from 'fs';

// Test configuration
const testOpts = {
    headful: true, // Run in headed mode for debugging
    maxConcurrency: 1, // Limit concurrency for testing
    idleLimit: 12, // Number of idle rounds before stopping
    scrollPauseMs: 500, // Time to wait between scrolls
    outPath: 'datasets/test-reviews.ndjson' // Output file
};

// Google Maps URL to test
const googleMapsUrl = 'https://www.google.com/maps/place/Highlands+Coffee+417+Dien+Bien+Phu/data=!4m7!3m6!1s0x3175292a6362e83f:0x4b2d4efbb1d1a764!8m2!3d10.8018228!4d106.7127545!16s%2Fg%2F11s7xmj488!19sChIJP-hiYyopdTERZKfRsftOLUs?authuser=0&rclk=1';

// Run the test
(async () => {
    console.log('Starting Google Maps review scraper test...');
    console.log('Test URL:', googleMapsUrl);

    const crawler = new ArgusCrawler(testOpts);

    try {
        await crawler.start([googleMapsUrl]);
        console.log('Test completed successfully');
        await fs.writeFile('test-results.json', JSON.stringify({ status: 'success', timestamp: new Date().toISOString() }, null, 2));
    } catch (error) {
        console.error('Test failed:', error instanceof Error ? error.message : 'Unknown error');
        await fs.writeFile('test-results.json', JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() }, null, 2));
        process.exitCode = 1;
    }
})();