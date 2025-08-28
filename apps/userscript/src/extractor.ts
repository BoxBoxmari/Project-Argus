/// <reference types="tampermonkey" />
import { findReviewElements, extractPlaceId } from './dom';
import { toRawReview, RawReview } from './normalize';
import { Transport } from './transport';
import { Scheduler } from './scheduler';
import { Logger, LogLevel } from './log';

export class ArgusExtractor {
    private isInitialized = false;
    private transport: Transport;
    private scheduler: Scheduler;
    private logger: Logger;
    private seenReviews = new Set<string>();
    private observer: MutationObserver | null = null;

    constructor() {
        this.transport = new Transport({
            batchSize: parseInt(this.getEnvVar('ARGUS_BATCH_SIZE', '50')),
            maxRetries: parseInt(this.getEnvVar('ARGUS_MAX_RETRIES', '3'))
        });

        this.scheduler = new Scheduler({
            debounceMs: parseInt(this.getEnvVar('ARGUS_DEBOUNCE_MS', '300')),
            maxConcurrency: parseInt(this.getEnvVar('ARGUS_CONCURRENCY', '2')),
            extractionInterval: parseInt(this.getEnvVar('ARGUS_INTERVAL_MS', '2000'))
        });

        this.logger = Logger.getInstance();
        this.logger.setLevel(
            this.getEnvVar('ARGUS_LOG_LEVEL', 'INFO') === 'DEBUG' ? LogLevel.DEBUG : LogLevel.INFO
        );
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
                newReviews.push(rawReview);
                this.seenReviews.add(reviewId);

                this.logger.debug('ArgusExtractor', 'Extracted review', { reviewId, rawReview });
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

    private getEnvVar(name: string, defaultValue: string): string {
        // Try to get from userscript environment or use default
        if (typeof GM_getValue !== 'undefined') {
            return GM_getValue(name, defaultValue);
        }
        return defaultValue;
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
