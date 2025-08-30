/// <reference types="tampermonkey" />
import { findReviewElements, extractPlaceId } from './dom';
import { gm } from './polyfills/gm';
import { toRawReview, RawReview } from './normalize';
import { Transport } from './transport';
import { Scheduler } from './scheduler';
import { Logger, LogLevel } from './log';
import { reviewId } from '@argus/js-core/id/review_id';
import { maybeRedact } from '@argus/js-core/sanitize/pii';
import { authorHash as mkAuthorHash } from './pseudo.js';

// Local copy of ReviewSchema for validation
const ReviewSchema = {
  safeParse: (r: any) => {
    // Basic validation
    if (!r.author || typeof r.author !== 'string' || r.author.length === 0) {
      return { success: false, error: { issues: ['Missing or invalid author'] } };
    }
    if (r.rating === undefined || typeof r.rating !== 'number' || r.rating < 0 || r.rating > 5) {
      return { success: false, error: { issues: ['Missing or invalid rating'] } };
    }
    if (r.text && typeof r.text !== 'string') {
      return { success: false, error: { issues: ['Invalid text type'] } };
    }
    if (r.time && typeof r.time !== 'string') {
      return { success: false, error: { issues: ['Invalid time type'] } };
    }
    if (r.likes && (typeof r.likes !== 'number' || r.likes < 0 || !Number.isInteger(r.likes))) {
      return { success: false, error: { issues: ['Invalid likes type'] } };
    }
    if (r.url && (typeof r.url !== 'string' || !r.url.startsWith('http'))) {
      return { success: false, error: { issues: ['Invalid URL'] } };
    }
    return { success: true, data: r };
  }
};

const __REDACT__ = (txt:string)=> maybeRedact(txt, (gm.get('ARGUS_REDACT_PII','1') ?? '1') === '1').text;

async function __PSEUDO_AUTHOR__(name:string): Promise<{author:string; authorHash?:string}> {
  const pseudo = (typeof GM_getValue === 'function' ? GM_getValue('ARGUS_PSEUDONYMIZE_AUTHOR','1') : '1') === '1';
  if (!pseudo) return { author: name };
  const salt = (typeof GM_getValue === 'function' ? GM_getValue('ARGUS_PII_SALT','argus-default-salt') : 'argus-default-salt');
  const h = await mkAuthorHash(name, salt, 32);
  const drop = (typeof GM_getValue === 'function' ? GM_getValue('ARGUS_DROP_AUTHOR','0') : '0') === '0' ? false : true;
  return { author: drop ? '[redacted-author]' : name, authorHash: h };
}

function validateReview(r: any) {
  const parsed: { success: boolean; data?: any; error?: { issues: string[] } } = ReviewSchema.safeParse(r);
  if (!parsed.success) {
    console.warn('[Argus][schema]', parsed.error?.issues || 'Validation failed');
    return null;
  }
  const d = parsed.data as any; d.id = reviewId(d); return d;
}

export class ArgusExtractor {
    private isInitialized = false;
    private transport: Transport;
    private scheduler: Scheduler;
    private logger: Logger;
    private seenReviews = new Set<string>();
    private observer: MutationObserver | null = null;

    constructor() {
        // Initialize with default values, will be updated in async init
        this.transport = new Transport({
            batchSize: 50,
            maxRetries: 3
        });

        this.scheduler = new Scheduler({
            debounceMs: 300,
            maxConcurrency: 2,
            extractionInterval: 2000
        });

        this.logger = Logger.getInstance();
        this.logger.setLevel(LogLevel.INFO);

        // Initialize with actual values asynchronously
        this.initAsync();
    }

    private async initAsync() {
        this.transport = new Transport({
            batchSize: parseInt(await this.getEnvVar('ARGUS_BATCH_SIZE', '50')),
            maxRetries: parseInt(await this.getEnvVar('ARGUS_MAX_RETRIES', '3'))
        });

        this.scheduler = new Scheduler({
            debounceMs: parseInt(await this.getEnvVar('ARGUS_DEBOUNCE_MS', '300')),
            maxConcurrency: parseInt(await this.getEnvVar('ARGUS_CONCURRENCY', '2')),
            extractionInterval: parseInt(await this.getEnvVar('ARGUS_INTERVAL_MS', '2000'))
        });

        const logLevel = await this.getEnvVar('ARGUS_LOG_LEVEL', 'INFO');
        this.logger.setLevel(logLevel === 'DEBUG' ? LogLevel.DEBUG : LogLevel.INFO);
    }

    public init(): void {
        if (this.isInitialized) return;

        this.logger.info('ArgusExtractor', 'Initializing extractor');

        this.setupEventListeners();
        this.setupPeriodicExtraction();
        this.setupBeforeUnload();

        this.isInitialized = true;
        this.logger.info('ArgusExtractor', 'Extractor initialized successfully');
    }

    private setupEventListeners(): void {
        // Use MutationObserver for incremental updates
        this.observer = new MutationObserver((mutations) => {
            let hasRelevantChanges = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if added nodes contain review elements
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node as Element;
                            if (this.isReviewElement(element)) {
                                hasRelevantChanges = true;
                                break;
                            }
                        }
                    }
                }

                if (hasRelevantChanges) break;
            }

            if (hasRelevantChanges) {
                this.scheduler.recordActivity();
                this.scheduler.scheduleExtraction(() => this.extractReviews());
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributeFilter: ['data-review-id', 'data-review-key']
        });

        // Listen for scroll events (throttled)
        let scrollTimeout: number | null = null;
        window.addEventListener('scroll', () => {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = window.setTimeout(() => {
                this.scheduler.recordActivity();
                this.scheduler.scheduleExtraction(() => this.extractReviews());
            }, 200);
        });
    }

    private setupPeriodicExtraction(): void {
        // Start periodic extraction for missed reviews
        this.scheduler.startPeriodicExtraction(() => this.extractReviews());
    }

    private setupBeforeUnload(): void {
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    private isReviewElement(element: Element): boolean {
        return element.matches('[data-review-id], [jsaction*="review"], .review-item') ||
               element.querySelector('[data-review-id], [jsaction*="review"]') !== null;
    }

    private async extractReviews(): Promise<void> {
        if (!this.isOnReviewsPage()) {
            this.logger.debug('ArgusExtractor', 'Not on reviews page, skipping extraction');
            return;
        }

        this.logger.debug('ArgusExtractor', 'Starting review extraction');

        try {
            const reviewElements = findReviewElements();
            const newReviews: RawReview[] = [];

            for (const reviewElement of reviewElements) {
                const { reviewId } = reviewElement;

                // Skip if already processed
                if (this.seenReviews.has(reviewId)) {
                    continue;
                }

                const rawReview = toRawReview(reviewElement);

                // Apply pseudonymization to the author
                const pseudoAuthor = await __PSEUDO_AUTHOR__(rawReview.user as string || '');
                const processedReview = {
                  ...rawReview,
                  user: pseudoAuthor.author,
                  authorHash: pseudoAuthor.authorHash
                };

                newReviews.push(processedReview);
                this.seenReviews.add(reviewId);

                this.logger.debug('ArgusExtractor', 'Extracted review', { reviewId, processedReview });
            }

            if (newReviews.length > 0) {
                this.logger.info('ArgusExtractor', `Extracted ${newReviews.length} new reviews`);

                // Add to transport for batching
                for (const review of newReviews) {
                    this.transport.add(review);
                }
            }

        } catch (error) {
            this.logger.error('ArgusExtractor', 'Failed to extract reviews', error);
        }
    }

    private isOnReviewsPage(): boolean {
        const url = window.location.href;
        return url.includes('/maps') && (
            url.includes('/reviews') ||
            url.includes('@') ||
            extractPlaceId() !== null
        );
    }

  private async getEnvVar(name: string, defaultValue: string): Promise<string> {
    // Try to get from userscript environment or use default
    const value = gm.get(name, defaultValue);
    if (value instanceof Promise) {
      return await value;
    }
    return value;
  }

    public async flush(): Promise<void> {
        await this.transport.flush();
        await this.transport.processRetryQueue();
    }

    public getStats(): { transport: any; scheduler: any; seenReviews: number } {
        return {
            transport: this.transport.getStats(),
            scheduler: this.scheduler.getStats(),
            seenReviews: this.seenReviews.size
        };
    }

    public cleanup(): void {
        this.logger.info('ArgusExtractor', 'Cleaning up extractor');

        // Flush any remaining data
        this.flush().catch(error => {
            this.logger.error('ArgusExtractor', 'Failed to flush during cleanup', error);
        });

        // Cleanup scheduler
        this.scheduler.cleanup();

        // Cleanup observer
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        this.logger.info('ArgusExtractor', 'Extractor cleanup completed');
    }
}
