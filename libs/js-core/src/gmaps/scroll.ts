/**
 * Google Maps scrolling and expansion utilities
 * Extracted from Project Argus Master Scraper userscript
 */

/**
 * Human-like burst scrolling
 * Based on argusBurstScroll from userscript
 */
export async function humanLikeBurstScroll(page: any, scroller: any, reviewSelector: string): Promise<void> {
    try {
        // Get current review count for progress tracking
        const currentCount = await page.locator(reviewSelector).count();

        // Calculate scroll parameters with randomization (from userscript)
        const scrollHeight = await scroller.evaluate((el: Element) => el.scrollHeight);
        const clientHeight = await scroller.evaluate((el: Element) => el.clientHeight);
        const currentScroll = await scroller.evaluate((el: Element) => el.scrollTop);

        const remainingHeight = scrollHeight - (currentScroll + clientHeight);
        const scrollAmount = Math.max(320, Math.min(remainingHeight * 0.3, clientHeight * 0.95));

        // Burst scrolling with steps (from userscript argusBurstScroll)
        const steps = Math.max(2, Math.min(6, Math.round(scrollAmount / 220)));
        const perStep = Math.max(100, Math.floor(scrollAmount / steps));

        console.log(`[scroll] Burst scrolling ${steps} steps of ${perStep}px each`);

        for (let i = 0; i < steps; i++) {
            // Multiple scroll techniques for robustness (from userscript)
            await scroller.evaluate((el: Element, px: number) => {
                el.scrollTop += px;

                // Dispatch scroll events to trigger listeners
                el.dispatchEvent(new WheelEvent('wheel', {
                    deltaY: px,
                    bubbles: true,
                    cancelable: true
                }));

                // Also dispatch keyboard events
                el.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'PageDown',
                    bubbles: true
                }));
            }, perStep);

            // Small delay between steps for human-like timing
            await page.waitForTimeout(50 + Math.floor(Math.random() * 100));
        }

        // Final check if we reached bottom
        const newScrollTop = await scroller.evaluate((el: Element) => el.scrollTop);
        const maxScroll = await scroller.evaluate((el: Element) => el.scrollHeight - el.clientHeight);

        if (newScrollTop >= maxScroll - 50) {
            console.log('[scroll] Reached bottom of scroller');
        }

    } catch (e) {
        console.warn('[scroll] Error during burst scroll:', e);

        // Fallback to page-level scrolling
        try {
            await page.evaluate(() => {
                window.scrollBy(0, 1000);
            });
        } catch (fallbackError) {
            console.warn('[scroll] Fallback scroll also failed:', fallbackError);
        }
    }
}

/**
 * Expand "More" buttons to reveal full review text
 * Based on userscript expandMoreIfAny logic
 */
export async function expandMoreIfAny(page: any): Promise<number> {
    let expandedCount = 0;

    const moreSelectors = [
        '[role="button"][jsaction*="more"]',
        'button:has-text("More")',
        'button[aria-label*="more"]',
        '[jsaction*="expand"]',
        'span[jsaction*="expand"]',
        '.section-expand-review',
        '[data-expandable-section]',
        'button:has-text("Read more")',
        '[role="button"]:has-text("more")'
    ];

    try {
        for (const selector of moreSelectors) {
            const buttons = page.locator(selector);
            const count = await buttons.count();

            if (count > 0) {
                console.log(`[scroll] Found ${count} "More" buttons with selector: ${selector}`);

                // Click all visible "More" buttons
                for (let i = 0; i < Math.min(count, 20); i++) { // Limit to prevent infinite loops
                    try {
                        const button = buttons.nth(i);
                        if (await button.isVisible({ timeout: 1000 })) {
                            await button.click();
                            expandedCount++;

                            // Small delay between clicks
                            await page.waitForTimeout(100 + Math.floor(Math.random() * 200));
                        }
                    } catch (e) {
                        // Skip individual button errors
                    }
                }

                if (expandedCount > 0) {
                    console.log(`[scroll] Expanded ${expandedCount} reviews`);
                    break; // Stop after first successful selector
                }
            }
        }

        return expandedCount;
    } catch (e) {
        console.warn('[scroll] Error expanding more buttons:', e);
        return expandedCount;
    }
}

/**
 * Adaptive idle detection with growth tracking
 * Based on ARGUS_HD_RUN logic from userscript
 */
export class AdaptiveIdleDetector {
    private lastCount = 0;
    private lastGrowthTime = Date.now();
    private noGrowthRounds = 0;
    private maxIdleRounds: number;

    constructor(maxIdleRounds = 16) {
        this.maxIdleRounds = maxIdleRounds;
    }

    /**
     * Check if we should continue or stop based on growth pattern
     */
    shouldContinue(currentCount: number): boolean {
        const now = Date.now();

        if (currentCount > this.lastCount) {
            // We have growth - reset idle counter
            this.lastCount = currentCount;
            this.lastGrowthTime = now;
            this.noGrowthRounds = 0;
            console.log(`[scroll] Growth detected: ${this.lastCount} → ${currentCount}`);
            return true;
        } else {
            // No growth - increment idle counter
            this.noGrowthRounds++;
            const idleSeconds = Math.floor((now - this.lastGrowthTime) / 1000);

            console.log(`[scroll] No growth round ${this.noGrowthRounds}/${this.maxIdleRounds} (idle ${idleSeconds}s)`);

            if (this.noGrowthRounds >= this.maxIdleRounds) {
                console.log('[scroll] Adaptive idle limit reached - stopping');
                return false;
            }

            return true;
        }
    }

    /**
     * Get current stats for logging
     */
    getStats() {
        return {
            lastCount: this.lastCount,
            noGrowthRounds: this.noGrowthRounds,
            maxIdleRounds: this.maxIdleRounds,
            idleSeconds: Math.floor((Date.now() - this.lastGrowthTime) / 1000)
        };
    }
}

/**
 * Smart scroll wait with adaptive timing
 * Based on userscript waitAdaptive logic
 */
export async function adaptiveScrollWait(baseDelayMs = 1200, currentReviewCount = 0): Promise<void> {
    // Adaptive delay based on review count (more reviews = longer delays)
    const multiplier = currentReviewCount > 1000 ? 2.0 :
        currentReviewCount > 500 ? 1.5 :
            currentReviewCount > 100 ? 1.2 : 1.0;

    const delay = Math.floor(baseDelayMs * multiplier);
    const jitter = Math.floor(Math.random() * 300) - 150; // ±150ms jitter
    const finalDelay = Math.max(300, delay + jitter);

    console.log(`[scroll] Adaptive wait: ${finalDelay}ms (base: ${baseDelayMs}, count: ${currentReviewCount})`);
    await new Promise(resolve => setTimeout(resolve, finalDelay));
}

/**
 * Check if we're near bottom and should stop for small pages
 * Based on ARGUS_SHORT_CIRCUIT_IF_NEAR_BOTTOM from userscript
 */
export async function shouldShortCircuitNearBottom(page: any, scroller: any, reviewCount: number): Promise<boolean> {
    try {
        const scrollInfo = await scroller.evaluate((el: Element) => ({
            scrollTop: el.scrollTop,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight
        }));

        const remainingHeight = scrollInfo.scrollHeight - (scrollInfo.scrollTop + scrollInfo.clientHeight);

        // Short circuit for small pages with few reviews (from userscript logic)
        if (remainingHeight < 48 && reviewCount < 25) {
            console.log(`[scroll] Short circuit: near bottom with ${reviewCount} reviews`);
            return true;
        }

        return false;
    } catch (e) {
        console.warn('[scroll] Error checking bottom:', e);
        return false;
    }
}