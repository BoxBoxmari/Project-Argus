import { ArgusCrawler } from './crawler.js';
const {
    ARGUS_HEADFUL = '0',
    ARGUS_MAX_CONCURRENCY = '4',
    ARGUS_IDLE_LIMIT = '12',
    ARGUS_SCROLL_PAUSE = '250',
    ARGUS_PROXY_LIST = '',
    ARGUS_OUT = 'datasets/reviews.ndjson',
    ARGUS_TEST_URL
} = process.env;

const proxies = ARGUS_PROXY_LIST ? ARGUS_PROXY_LIST.split(',').map(s => s.trim()).filter(Boolean) : undefined;
const seeds = ARGUS_TEST_URL ? [ARGUS_TEST_URL] : ["https://www.google.com/maps/place/Highlands+Coffee+417+Dien+Bien+Phu/data=!4m7!3m6!1s0x3175292a6362e83f:0x4b2d4efbb1d1a764!8m2!3d10.8018228!4d106.7127545!16s%2Fg%2F11s7xmj488!19sChIJP-hiYyopdTERZKfRsftOLUs?authuser=0&rclk=1"];
(async () => {
    const crawler = new ArgusCrawler({
        headful: ARGUS_HEADFUL === '1',
        maxConcurrency: parseInt(ARGUS_MAX_CONCURRENCY, 10),
        idleLimit: parseInt(ARGUS_IDLE_LIMIT, 10),
        scrollPauseMs: parseInt(ARGUS_SCROLL_PAUSE, 10),
        proxies,
        outPath: ARGUS_OUT
    });
    await crawler.start(seeds);
})();