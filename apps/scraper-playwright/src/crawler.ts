import { chromium, Browser, Page } from 'playwright';
import { MemoryQueue } from '@argus/js-core/queue/memoryQueue';
import { SessionPool } from '@argus/js-core/session/sessionPool';
import { writeFileSync } from 'fs';
import { EventBus } from '@argus/js-core/obs/events';

type Review = { placeId: string; reviewId: string; author: string; rating: number; text: string; time: string; lang?: string; helpful?: number; raw?: any };

export class ArgusCrawler {
    private eventBus = new EventBus(process.stderr);
    private queue = new MemoryQueue();
    private sessions: SessionPool;
    private inFlight = 0;
    private done = 0;
    private failed = 0;
    private results: Review[] = [];
    private browser?: Browser;

    constructor(private opts: {
        headful: boolean;
        maxConcurrency: number;
        idleLimit: number;
        scrollPauseMs: number;
        proxies?: string[];
        outPath: string;
    }) {
        this.sessions = new SessionPool({
            maxAgeMs: 20 * 60 * 1000,
            minScore: 0.5,
            proxies: this.opts.proxies
        });
    }

    async start(seedUrls: string[]) {
        this.queue.enqueue(seedUrls, 1);
        this.browser = await chromium.launch({
            headless: !this.opts.headful,
            args: ['--disable-dev-shm-usage']
        });

        this.eventBus.emit({ t: 'metrics', queued: this.queue.size(), inFlight: 0, done: 0, failed: 0, p95: 0 });

        try {
            await this.autoscaledLoop();
            writeFileSync(this.opts.outPath, this.results.map(x => JSON.stringify(x)).join('\n'));
        } finally {
            await this.browser?.close();
        }
    }

    private async autoscaledLoop() {
        const max = this.opts.maxConcurrency;
        let idleRounds = 0;

        while (idleRounds < this.opts.idleLimit) {
            while (this.inFlight < max && this.queue.size() > 0) this.runOne();
            if (this.queue.size() === 0 && this.inFlight === 0) idleRounds++;
            else idleRounds = 0;

            await new Promise(r => setTimeout(r, 200));
            this.eventBus.emit({
                t: 'metrics',
                queued: this.queue.size(),
                inFlight: this.inFlight,
                done: this.done,
                failed: this.failed,
                p95: 0
            });
        }
    }

    private async runOne() {
        const [item] = this.queue.dequeue(1);
        if (!item) return;

        this.inFlight++;
        const s = this.sessions.get();

        const startTime = Date.now();
        this.eventBus.emit({ t: 'task.start', url: item.url });

        try {
            const ctx = await this.browser!.newContext({
                userAgent: s.ua,
                proxy: s.proxy ? { server: s.proxy } : undefined,
                locale: 'en-US'
            });

            const page = await ctx.newPage();
            await this.prepare(page);
            await this.handlePlace(page, item.url);
            await ctx.close();
            this.sessions.report(s, true);
            this.done++;

            this.eventBus.emit({
                t: 'task.done',
                url: item.url,
                ms: Date.now() - startTime
            });
        } catch (e) {
            this.sessions.report(s, false);
            this.failed++;

            this.eventBus.emit({
                t: 'task.fail',
                url: item.url,
                err: e instanceof Error ? e.message : 'Unknown error'
            });
        } finally {
            this.inFlight--;
        }
    }

    private async prepare(page: Page) {
        await page.route('**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2,css}', r => r.abort());
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
    }

    private async handlePlace(page: Page, url: string) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Click "Reviews" tab if not already on it
        const reviewsButton = page.locator('button:has-text("Reviews"), a:has-text("Reviews")');
        if (await reviewsButton.count()) {
            await reviewsButton.first().click({ trial: false }).catch(() => { });
            // Wait for reviews to load
            await page.waitForSelector('[data-review-id]', { timeout: 30000 });
        }

        // Expand and scroll to load reviews
        const container = page.locator('[aria-label*="Reviews"], [data-review-id]');
        for (let i = 0; i < 20; i++) {
            await page.mouse.wheel(0, 1200);
            await page.waitForTimeout(this.opts.scrollPauseMs);
        }

        // Extract review items
        const data = await page.evaluate(() => {
            const nodes = Array.from(document.querySelectorAll('[data-review-id]'));
            return nodes.map(n => {
                const reviewId = n.getAttribute('data-review-id') || '';
                const authorNode = n.querySelector('div[data-owner-id] > div:first-child > div:first-child > a');
                const author = authorNode?.textContent?.trim() || '';

                // Extract rating
                const ratingEl = n.querySelector('[role="img"][aria-label*="stars"]') as HTMLElement | null;
                const ratingText = ratingEl?.getAttribute('aria-label') || '';
                const rating = ratingText ? parseFloat(ratingText.match(/([0-9.]+)/)?.[1] || '0') : 0;

                // Extract review text
                const textNode = n.querySelector('.MyEned');
                const text = textNode?.textContent?.trim() || '';

                // Extract date
                const timeNode = n.querySelector('time');
                const time = timeNode?.getAttribute('datetime') || '';

                // Extract helpful count
                const helpfulNode = n.querySelector('[aria-label*="helpful"], [class*="helpful-count"]');
                const helpfulText = helpfulNode?.textContent || '0';
                const helpful = parseInt(helpfulText.replace(/[^0-9]/g, '')) || 0;

                return {
                    placeId: window.location.href,
                    reviewId,
                    author,
                    rating,
                    text,
                    time,
                    helpful,
                    raw: undefined
                };
            });
        });

        // Add results to the output
        for (const r of data) this.results.push(r);
    }
}