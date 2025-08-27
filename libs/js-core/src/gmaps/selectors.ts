/**
 * Google Maps selector detection and management
 * Extracted from Project Argus Master Scraper userscript
 */

export interface SelectorCandidate {
    selector: string;
    priority: number;
    description: string;
}

// Review item selector candidates in priority order (from userscript)
export const REVIEW_SELECTORS: SelectorCandidate[] = [
    { selector: 'div[data-review-id]', priority: 100, description: 'Primary review container' },
    { selector: '.section-review', priority: 90, description: 'Legacy review section' },
    { selector: 'div.gws-localreviews__google-review', priority: 80, description: 'SERP review format' },
    { selector: 'div[jscontroller][data-review-id]', priority: 85, description: 'JS-controlled review' },
    { selector: 'div[role="article"][data-review-id]', priority: 75, description: 'Semantic article review' },
    { selector: 'div[data-review-id][jsaction]', priority: 70, description: 'Interactive review container' },
];

// Reviews panel/tab selectors (from userscript)
export const REVIEWS_TAB_SELECTORS: string[] = [
    '[data-value="Reviews"]',
    '[role="tab"][aria-label*="Reviews"]',
    '[role="tab"][aria-label*="reviews"]',
    'button:has-text("Reviews")',
    'div[data-tab-index="1"]',
    '[jsaction*="pane.reviewTab"]',
    '.section-tab[data-tab-index="1"]',
    'button[data-value="Reviews"]',
    'button:text("Reviews")',
    '[role="button"][jsaction*="reviewDialog"]'
];

// Scrollable container selectors (from userscript logic)
export const SCROLLABLE_CONTAINERS: string[] = [
    'div[role="feed"]',
    'div[aria-label*="Reviews"]',
    'div[aria-label*="reviews"]',
    'div[aria-label*="Đánh giá"]',
    '.section-scrollbox',
    '.section-layout-scroll-container',
    '[role="main"]'
];

/**
 * Detect best review selector by testing candidates
 * Based on argusDetectReviewSelector from userscript
 */
export async function detectReviewSelector(page: any): Promise<string> {
    let bestSelector = '';
    let bestCount = 0;

    for (const candidate of REVIEW_SELECTORS) {
        try {
            const count = await page.locator(candidate.selector).count();
            console.log(`[selectors] Testing ${candidate.selector}: ${count} items`);

            if (count > bestCount) {
                bestSelector = candidate.selector;
                bestCount = count;
            }
        } catch (e) {
            console.warn(`[selectors] Failed testing ${candidate.selector}:`, e);
        }
    }

    // Fallback: if no reviews found with specific selectors, try generic patterns
    if (bestCount === 0) {
        const fallbacks = [
            'div:has([aria-label*="star"])',
            'div:has([aria-label*="Star"])',
            'div:has(span:text-matches("★+"))',
            '[class*="review"]',
            '[class*="Review"]'
        ];

        for (const fallback of fallbacks) {
            try {
                const count = await page.locator(fallback).count();
                if (count > bestCount) {
                    bestSelector = fallback;
                    bestCount = count;
                }
            } catch (e) {
                // Continue with next fallback
            }
        }
    }

    console.log(`[selectors] Best selector: ${bestSelector} (${bestCount} items)`);
    return bestSelector || REVIEW_SELECTORS[0].selector;
}

/**
 * Find scrollable container for reviews
 * Based on argusFindScrollableFrom logic from userscript
 */
export async function findReviewsScroller(page: any, timeoutMs = 20000): Promise<any> {
    // First try to find via review item
    const reviewSel = await detectReviewSelector(page);

    try {
        const reviewElement = page.locator(reviewSel).first();
        if (await reviewElement.isVisible({ timeout: 5000 })) {
            // Walk up DOM to find scrollable ancestor
            const scroller = await reviewElement.evaluate((el: Element) => {
                let current = el.parentElement;
                while (current && current !== document.documentElement) {
                    const style = getComputedStyle(current);
                    const isScrollable = /(auto|scroll)/.test(style.overflowY);
                    const hasScrollHeight = current.scrollHeight > current.clientHeight + 16;

                    if (isScrollable && hasScrollHeight) {
                        return current;
                    }
                    current = current.parentElement;
                }
                return null;
            });

            if (scroller) {
                return page.locator('body').evaluateHandle(() => scroller);
            }
        }
    } catch (e) {
        console.warn('[selectors] Could not find scroller via review element:', e);
    }

    // Fallback to known container selectors
    for (const selector of SCROLLABLE_CONTAINERS) {
        try {
            const container = page.locator(selector).first();
            if (await container.isVisible({ timeout: 2000 })) {
                console.log(`[selectors] Found scroller: ${selector}`);
                return container;
            }
        } catch (e) {
            // Continue with next selector
        }
    }

    console.warn('[selectors] No scrollable container found, using body');
    return page.locator('body');
}

/**
 * Ensure reviews panel is ready and visible
 * Based on userscript review tab detection
 */
export async function ensureReviewsPaneReady(page: any, timeoutMs = 20000): Promise<boolean> {
    console.log('[selectors] Ensuring reviews pane is ready...');

    // Wait for page to settle
    await page.waitForTimeout(3000);

    // Try to find and click reviews tab
    for (const selector of REVIEWS_TAB_SELECTORS) {
        try {
            const tab = page.locator(selector).first();
            if (await tab.isVisible({ timeout: 2000 })) {
                console.log(`[selectors] Clicking reviews tab: ${selector}`);
                await tab.click();
                await page.waitForTimeout(3000);
                return true;
            }
        } catch (e) {
            // Continue with next selector
        }
    }

    console.log('[selectors] No reviews tab found or already on reviews');
    return false;
}

/**
 * Force sort to newest reviews (from userscript logic)
 */
export async function forceSortNewest(page: any): Promise<boolean> {
    try {
        const sortSelectors = [
            '[data-sort-id="newestFirst"]',
            '[data-value="Sort"]:has-text("Newest")',
            'button:has-text("Newest")',
            '[role="menuitem"]:has-text("Newest")',
            '[jsaction*="sort"]:has-text("Newest")'
        ];

        for (const selector of sortSelectors) {
            try {
                const sortButton = page.locator(selector).first();
                if (await sortButton.isVisible({ timeout: 2000 })) {
                    console.log(`[selectors] Clicking sort newest: ${selector}`);
                    await sortButton.click();
                    await page.waitForTimeout(2000);
                    return true;
                }
            } catch (e) {
                // Continue with next selector
            }
        }

        console.log('[selectors] Could not find sort newest button');
        return false;
    } catch (e) {
        console.warn('[selectors] Error forcing sort newest:', e);
        return false;
    }
}

/**
 * Open "All reviews" or similar to get full list
 * Based on userscript openAllReviewsRobust logic
 */
export async function openAllReviewsRobust(page: any, timeoutMs = 25000): Promise<boolean> {
    console.log('[selectors] Opening all reviews...');

    const allReviewsSelectors = [
        'button:has-text("All reviews")',
        'button:has-text("See all reviews")',
        'a:has-text("All reviews")',
        'a:has-text("See all reviews")',
        '[jsaction*="reviews"]:has-text("All")',
        '[jsaction*="reviews"]:has-text("See all")',
        'button[data-value*="reviews"]',
        'a[href*="reviews"]'
    ];

    for (const selector of allReviewsSelectors) {
        try {
            const button = page.locator(selector).first();
            if (await button.isVisible({ timeout: 3000 })) {
                console.log(`[selectors] Clicking all reviews: ${selector}`);
                await button.click();
                await page.waitForTimeout(3000);
                return true;
            }
        } catch (e) {
            // Continue with next selector
        }
    }

    console.log('[selectors] Could not find "All reviews" button');
    return false;
}