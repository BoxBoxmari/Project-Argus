/**
 * Enhanced Playwright scraper using shared libraries
 * Based on Project Argus Master Scraper methodology
 */

import { chromium, devices, LaunchOptions, Browser, BrowserContext, Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

// Import shared libraries
import {
    detectReviewSelector,
    findReviewsScroller,
    ensureReviewsPaneReady,
    forceSortNewest,
    openAllReviewsRobust,
    humanLikeBurstScroll,
    expandMoreIfAny,
    AdaptiveIdleDetector,
    adaptiveScrollWait,
    shouldShortCircuitNearBottom,
    ReviewSchemaV1,
    type ReviewV1,
    FieldExtractors,
    createReviewBatch,
    validateReview,
    progress,
    installEnvironmentBlocklist,
    retryWithBackoff,
    normalizeReviewText,
    extractPlaceId,
    normalizePlaceKey
} from "@argus/js-core";

// Environment configuration (from userscript patterns)
function bool(v?: string) {
    if (!v) return false;
    const s = v.toLowerCase();
    return s === "1" || s === "true" || s === "yes";
}

function vint(v?: string, d = 2) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
}

function splitArgs(v?: string) {
    return v ? v.split(/\s+/).filter(Boolean) : [];
}

// Configuration from environment
const CONFIG = {
    headful: bool(process.env.ARGUS_HEADFUL),
    channel: process.env.ARGUS_BROWSER_CHANNEL || undefined,
    noSandbox: bool(process.env.ARGUS_NO_SANDBOX),
    forceBypass: bool(process.env.ARGUS_TLS_BYPASS),
    proxyUrl: process.env.ARGUS_PROXY_URL ? { server: process.env.ARGUS_PROXY_URL } : undefined,
    extraArgs: splitArgs(process.env.ARGUS_CHROMIUM_ARGS),
    navRetries: vint(process.env.ARGUS_NAV_RETRIES, 2),
    navDebug: bool(process.env.ARGUS_NAV_DEBUG),

    // Scraping configuration (from userscript)
    targetUrl: process.env.ARGUS_TEST_URL || "https://www.google.com/maps",
    maxRounds: vint(process.env.ARGUS_MAX_ROUNDS, 400),
    idleLimit: vint(process.env.ARGUS_IDLE_LIMIT, 16),
    scrollPause: vint(process.env.ARGUS_SCROLL_PAUSE, 650),
    maxReviews: vint(process.env.ARGUS_MAX_REVIEWS, 0),

    // Output configuration
    outputDir: path.join(process.cwd(), "datasets"),
    outputFile: "reviews.ndjson"
};

type Profile = "secure" | "insecure" | "insecure_no_sandbox";

/**
 * Launch browser with profile-specific configuration
 */
async function launch(profile: Profile): Promise<{ browser: Browser; context: BrowserContext }> {
    const args: string[] = [...CONFIG.extraArgs];
    const insecure = profile !== "secure";

    if (insecure) {
        args.push("--ignore-certificate-errors", "--allow-running-insecure-content");
    }

    if (profile === "insecure_no_sandbox" || CONFIG.noSandbox) {
        args.push("--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage");
    }

    const opts: LaunchOptions = {
        headless: !CONFIG.headful,
        channel: CONFIG.channel,
        args,
        proxy: CONFIG.proxyUrl
    };

    const browser = await chromium.launch(opts);
    const context = await browser.newContext({
        ...devices['Desktop Edge'],
        ignoreHTTPSErrors: insecure,
        extraHTTPHeaders: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
        }
    });

    return { browser, context };
}

/**
 * Extract reviews from page elements using userscript methodology
 */
async function extractReviewsFromElements(page: Page, reviewSelector: string): Promise<ReviewV1[]> {
    const reviews: ReviewV1[] = [];

    // Get all review elements
    const reviewElements = await page.locator(reviewSelector).all();
    console.log(`[extract] Found ${reviewElements.length} review elements`);

    for (let i = 0; i < reviewElements.length; i++) {
        try {
            const element = reviewElements[i];

            // Extract review data using multiple strategies (from userscript)
            const reviewData = await element.evaluate((el: any) => {
                const getText = (selector: any) => {
                    const elem = el.querySelector(selector);
                    return elem?.textContent?.trim() || '';
                };

                const getAttr = (selector: any, attr: any) => {
                    const elem = el.querySelector(selector);
                    return elem?.getAttribute(attr) || '';
                };

                // Core data extraction (based on userscript selectors)
                const id = el.getAttribute('data-review-id') ||
                    el.getAttribute('data-reviewid') ||
                    el.id ||
                    `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Author extraction with multiple fallbacks
                const authorName = getText('.d4r55') ||
                    getText('.section-review-title') ||
                    getText('[data-review-id] button') ||
                    getText('button[data-review-id]') ||
                    'Anonymous';

                // Rating extraction (from userscript patterns)
                let rating = 0;
                const starElement = el.querySelector('span.kvMYJc') ||
                    el.querySelector('[role="img"][aria-label*="star"]') ||
                    el.querySelector('[role="img"][aria-label*="Star"]');

                if (starElement) {
                    const ariaLabel = starElement.getAttribute('aria-label') || '';
                    const match = ariaLabel.match(/(\d+(?:[.,]\d+)?)/);
                    if (match) {
                        rating = Math.max(1, Math.min(5, Math.round(parseFloat(match[1].replace(',', '.')))));
                    }
                }

                // Text extraction with multiple selectors
                const reviewText = getText('span.wiI7pd') ||
                    getText('span.MyEned') ||
                    getText('.section-review-text') ||
                    getText('[data-expandable-section]') ||
                    getText('span[jsaction*="expand"]') ||
                    '';

                // Time extraction
                const relativeTime = getText('span.rsqaWe') ||
                    getText('span.bp9Aid') ||
                    getText('.section-review-publish-date') ||
                    '';

                // Photo extraction
                const photos: string[] = [];
                const photoElements = el.querySelectorAll('img[src*="googleusercontent"], img[src*="gstatic"]');
                photoElements.forEach((img: any) => {
                    const src = img.getAttribute('src');
                    if (src && !src.includes('profile') && !src.includes('avatar')) {
                        photos.push(src);
                    }
                });

                return {
                    id,
                    authorName,
                    rating,
                    reviewText,
                    relativeTime,
                    photos
                };
            });

            // Validate and format the review data
            if (reviewData.id && reviewData.rating > 0) {
                const review: ReviewV1 = {
                    id: reviewData.id,
                    placeId: extractPlaceId(CONFIG.targetUrl),
                    author: {
                        name: reviewData.authorName || 'Anonymous'
                    },
                    rating: reviewData.rating,
                    text: normalizeReviewText(reviewData.reviewText),
                    relativeTime: reviewData.relativeTime,
                    photos: reviewData.photos,
                    fetchMeta: {
                        ts: new Date().toISOString(),
                        agent: 'playwright',
                        source: 'google-maps',
                        placeUrl: CONFIG.targetUrl
                    }
                };

                // Validate schema before adding
                const validation = validateReview(review);
                if (validation.success) {
                    reviews.push(validation.data);
                } else {
                    console.warn(`[extract] Invalid review ${reviewData.id}:`, validation.error);
                }
            }
        } catch (e) {
            console.warn(`[extract] Error extracting review ${i}:`, e);
        }
    }

    console.log(`[extract] Successfully extracted ${reviews.length} valid reviews`);
    return reviews;
}

/**
 * Main scraping function with userscript methodology
 */
async function runScraping(page: Page): Promise<ReviewV1[]> {
    console.log('[scraper] Starting enhanced scraping process...');

    // Phase 1: Ensure reviews pane is ready (from userscript)
    await ensureReviewsPaneReady(page, 20000);
    await page.waitForTimeout(2000);

    // Phase 2: Try to open all reviews and sort newest
    await openAllReviewsRobust(page, 25000);
    await page.waitForTimeout(1000);
    await forceSortNewest(page);
    await page.waitForTimeout(2000);

    // Phase 3: Detect selectors and scroller
    const reviewSelector = await detectReviewSelector(page);
    const scroller = await findReviewsScroller(page, 20000);

    console.log(`[scraper] Using review selector: ${reviewSelector}`);

    // Phase 4: Adaptive scrolling with userscript methodology
    const idleDetector = new AdaptiveIdleDetector(CONFIG.idleLimit);
    let lastReviewCount = 0;
    let extractedReviews: ReviewV1[] = [];

    for (let round = 0; round < CONFIG.maxRounds; round++) {
        console.log(`[scraper] Round ${round + 1}/${CONFIG.maxRounds}`);

        // Human-like burst scrolling
        await humanLikeBurstScroll(page, scroller, reviewSelector);

        // Expand "More" buttons
        const expandedCount = await expandMoreIfAny(page);
        if (expandedCount > 0) {
            console.log(`[scraper] Expanded ${expandedCount} reviews`);
        }

        // Check current review count
        const currentCount = await page.locator(reviewSelector).count();

        // Check for short circuit (small pages)
        if (await shouldShortCircuitNearBottom(page, scroller, currentCount)) {
            console.log('[scraper] Short circuit: near bottom with few reviews');
            break;
        }

        // Progress tracking
        if (currentCount > lastReviewCount) {
            progress.emitChunk(currentCount, { phase: 'scrolling', round: round + 1 });
            lastReviewCount = currentCount;
        }

        // Adaptive idle detection
        if (!idleDetector.shouldContinue(currentCount)) {
            console.log('[scraper] Adaptive idle limit reached');
            break;
        }

        // Check if we reached the target
        if (CONFIG.maxReviews && currentCount >= CONFIG.maxReviews) {
            console.log(`[scraper] Reached target of ${CONFIG.maxReviews} reviews`);
            break;
        }

        // Adaptive wait
        await adaptiveScrollWait(CONFIG.scrollPause, currentCount);
    }

    // Phase 5: Final extraction
    console.log('[scraper] Starting final review extraction...');
    extractedReviews = await extractReviewsFromElements(page, reviewSelector);

    // Progress update
    progress.emitChunk(extractedReviews.length, { phase: 'complete' });

    return extractedReviews;
}

/**
 * Execute scraping with multi-profile retry
 */
async function executeWithRetry(): Promise<ReviewV1[]> {
    const profiles: Profile[] = CONFIG.forceBypass
        ? ["insecure", "insecure_no_sandbox"]
        : ["secure", "insecure", "insecure_no_sandbox"];

    for (const profile of profiles) {
        console.log(`[main] Trying profile: ${profile}`);

        try {
            const { browser, context } = await launch(profile);
            const page = await context.newPage();

            // Install resource blocklist for performance
            await installEnvironmentBlocklist(page);

            // Setup debugging if enabled
            if (CONFIG.navDebug) {
                page.on("requestfailed", r => console.warn("[debug] requestfailed:", r.url(), r.failure()?.errorText));
                page.on("console", msg => console.log("[debug] console:", msg.type(), msg.text()));
            }

            try {
                // Navigate with retries
                await retryWithBackoff(
                    async () => {
                        await page.goto(CONFIG.targetUrl, {
                            timeout: 120_000,
                            waitUntil: "domcontentloaded"
                        });
                        await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
                    },
                    { retries: CONFIG.navRetries, baseMs: 2000, factor: 1.5, maxMs: 10000 }
                );

                const title = await page.title();
                console.log(`[main] Successfully opened: ${title}`);

                // Run scraping
                const reviews = await runScraping(page);

                // Cleanup
                await browser.close();

                return reviews;

            } catch (e) {
                console.error(`[main] Scraping failed with profile ${profile}:`, e);
                await browser.close();

                if (profile === "secure" && /ERR_CERT|ERR_SSL/i.test(String(e))) {
                    console.warn("[main] TLS error detected, trying bypass profiles");
                }
            }
        } catch (e) {
            console.error(`[main] Launch failed with profile ${profile}:`, e);
        }
    }

    throw new Error("All profiles failed");
}

/**
 * Main execution
 */
(async () => {
    try {
        console.log('[main] Starting enhanced Playwright scraper...');
        console.log(`[main] Target: ${CONFIG.targetUrl}`);
        console.log(`[main] Config: maxRounds=${CONFIG.maxRounds}, idleLimit=${CONFIG.idleLimit}, maxReviews=${CONFIG.maxReviews}`);

        // Ensure output directory exists
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });

        // Execute scraping
        const reviews = await executeWithRetry();

        if (reviews.length === 0) {
            console.warn('[main] No reviews extracted');
            process.exitCode = 1;
            return;
        }

        // Create review batch with metadata
        const batch = createReviewBatch(reviews, 'playwright', {
            placeUrl: CONFIG.targetUrl,
            extractionStats: {
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                scrollRounds: CONFIG.maxRounds,
                idleRounds: CONFIG.idleLimit,
                expandedCount: 0 // TODO: track this
            }
        });

        // Write NDJSON output
        const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
        const output = fs.createWriteStream(outputPath, { flags: 'a' });

        // Write each review as separate line
        for (const review of reviews) {
            output.write(JSON.stringify(review) + '\n');
        }

        // Write batch metadata
        const metadataPath = path.join(CONFIG.outputDir, 'batch-metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(batch, null, 2));

        output.end();

        console.log(`[main] Success! Extracted ${reviews.length} reviews`);
        console.log(`[main] Output: ${outputPath}`);
        console.log(`[main] Metadata: ${metadataPath}`);

    } catch (e) {
        console.error("[main] Fatal error:", e);
        process.exitCode = 1;
    }
})();