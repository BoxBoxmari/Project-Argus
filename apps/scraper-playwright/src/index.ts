import { LaunchOptions, Browser, BrowserContext, Page } from "playwright";
import { launchBrowser } from "./playwright";
import fs from "node:fs";
import path from "node:path";

function bool(v?: string) { if (!v) return false; const s = v.toLowerCase(); return s === "1" || s === "true" || s === "yes"; }
function vint(v?: string, d = 2) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : d; }
function splitArgs(v?: string) { return v ? v.split(/\s+/).filter(Boolean) : []; }

const headful = bool(process.env.ARGUS_HEADFUL);
const channel = process.env.ARGUS_BROWSER_CHANNEL || undefined;
const proxyUrl = process.env.ARGUS_PROXY_URL;
const forceBypass = bool(process.env.ARGUS_TLS_BYPASS);
const noSandbox = bool(process.env.ARGUS_NO_SANDBOX);
const extraArgs = splitArgs(process.env.ARGUS_CHROMIUM_ARGS);
const navRetries = vint(process.env.ARGUS_NAV_RETRIES, 2);
const navDebug = bool(process.env.ARGUS_NAV_DEBUG);
const targetUrl = process.env.ARGUS_TEST_URL || "https://www.google.com/maps";
const blockResources = bool(process.env.ARGUS_BLOCK_RESOURCES) ?? true;
const maxReviews = vint(process.env.ARGUS_MAX_REVIEWS, 20);
const maxRounds = vint(process.env.ARGUS_MAX_ROUNDS, 3);
const idleLimit = vint(process.env.ARGUS_IDLE_LIMIT, 3);
const scrollPause = vint(process.env.ARGUS_SCROLL_PAUSE, 2000);

// Ensure output directory exists
const outputDir = path.join(process.cwd(), "datasets");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

type Profile = "secure" | "insecure" | "insecure_no_sandbox";

async function launch(profile: Profile): Promise<{ browser: Browser; context: BrowserContext }> {
  const { browser, context } = await launchBrowser("chromium");
  return { browser, context };
}

async function withPage<T>(profile: Profile, fn: (page: Page) => Promise<T>): Promise<T> {
  const { browser, context } = await launch(profile);
  const page = await context.newPage();

  // Block heavy resources to improve performance (but allow some critical ones)
  if (blockResources) {
    await page.route('**/*', (route) => {
      const req = route.request();
      const resourceType = req.resourceType();
      const url = req.url();

      // Block images but allow critical Google Maps resources
      if (resourceType === 'image' && !url.includes('/maps/api/') && !url.includes('profile')) {
        return route.abort();
      }
      // Block fonts and media
      if (['font', 'media'].includes(resourceType)) {
        return route.abort();
      }
      // Allow stylesheets as they may be needed for proper review rendering
      return route.continue();
    });
  }

  if (navDebug) {
    page.on("requestfailed", r => console.warn("[argus] requestfailed:", r.url(), r.failure()?.errorText));
    page.on("console", msg => console.log("[argus] console:", msg.type(), msg.text()));
    page.on("pageerror", err => console.error("[argus] pageerror:", (err as any)?.message || err));
  }
  try { return await fn(page); }
  finally { await context.close(); await browser.close(); }
}

async function healthCheck(profile: Profile): Promise<void> {
  await withPage(profile, async (page) => {
    try { await page.goto("https://www.gstatic.com/generate_204", { timeout: 30_000, waitUntil: "domcontentloaded" }); }
    catch (e) { console.warn("[argus] https 204 failed:", String((e as any)?.message || e)); }
    try { await page.goto("http://example.com", { timeout: 30_000, waitUntil: "domcontentloaded" }); }
    catch (e) { console.warn("[argus] http example failed:", String((e as any)?.message || e)); }
  });
}

interface ReviewData {
  text: string;
  rating?: number;
  author?: string;
  date?: string;
  helpful?: number;
}

async function extractReviews(page: Page): Promise<ReviewData[]> {
  const reviews: ReviewData[] = [];
  let rounds = 0;
  let idleRounds = 0;
  let lastCount = 0;

  console.log('[argus] Starting review extraction...');

  // Wait for the page to settle and reviews to load
  await page.waitForTimeout(3000);

  // Try to find and click the reviews tab/section
  try {
    // More comprehensive review tab selectors
    const reviewsTabSelectors = [
      '[data-value="Reviews"]',
      '[role="tab"][aria-label*="Reviews"]',
      '[role="tab"][aria-label*="reviews"]',
      'button:has-text("Reviews")',
      'div[data-tab-index="1"]', // Common Google Maps pattern
      '[jsaction*="pane.reviewTab"]',
      '.section-tab[data-tab-index="1"]',
      'button[data-value="Reviews"]'
    ];

    let reviewsTabFound = false;
    for (const selector of reviewsTabSelectors) {
      try {
        const reviewsButton = page.locator(selector).first();
        if (await reviewsButton.isVisible({ timeout: 2000 })) {
          await reviewsButton.click();
          console.log(`[argus] Clicked reviews tab with selector: ${selector}`);
          await page.waitForTimeout(3000);
          reviewsTabFound = true;
          break;
        }
      } catch (e) {
        // Continue with next selector
      }
    }

    if (!reviewsTabFound) {
      console.log('[argus] No reviews tab found, continuing with main page...');
    }
  } catch (e) {
    console.log('[argus] Error finding reviews tab:', e);
  }

  while (rounds < maxRounds && idleRounds < idleLimit) {
    rounds++;
    console.log(`[argus] Review extraction round ${rounds}/${maxRounds}`);

    // Enhanced selector strategies for reviews - covering different Google Maps layouts
    const reviewSelectors = [
      // Current Google Maps review patterns
      '[data-review-id]',
      '[jsaction*="review"]',
      '.section-review',
      '.section-review-content',
      'div[data-review-id]',
      '[role="listitem"][data-review-id]',

      // Alternative patterns
      'div[data-review-id] span[role="button"]',
      '.section-review-review-content',
      '[data-expandable-section]',

      // Generic patterns that might match reviews
      'div:has([role="img"][aria-label*="star"])',
      'div:has([role="img"][aria-label*="Star"])',
      'div:has(span:text-matches("★+"))',
      '[class*="review"]',
      '[class*="Review"]',

      // Broader patterns
      'div[role="listitem"]:has-text("★")',
      'div[jsaction]:has([aria-label*="star"])',
      'div[jsaction]:has([aria-label*="Star"])',
    ];

    let foundReviews = false;

    // Debug: Check what's actually on the page
    const pageText = await page.textContent('body');
    if (pageText && pageText.includes('★')) {
      console.log('[argus] Found star symbols on page - reviews likely present');
    } else {
      console.log('[argus] No star symbols found - may need to navigate to reviews');
    }
    for (const selector of reviewSelectors) {
      try {
        const reviewElements = await page.locator(selector).all();
        if (reviewElements.length > 0) {
          console.log(`[argus] Found ${reviewElements.length} reviews with selector: ${selector}`);

          for (const element of reviewElements) {
            try {
              // Try multiple text extraction strategies
              let reviewText = '';
              const textSelectors = [
                'span[role="button"]',
                '.section-review-text',
                '.section-review-review-content',
                '[data-expandable-section]',
                'span[jsaction*="expand"]',
                'span[data-expandable-section]',
                'span'
              ];

              for (const textSel of textSelectors) {
                try {
                  const textElement = element.locator(textSel).first();
                  const text = await textElement.textContent();
                  if (text && text.trim().length > 10) { // Reasonable review length
                    reviewText = text.trim();
                    break;
                  }
                } catch { }
              }

              // If no specific text selector worked, try the element itself
              if (!reviewText) {
                const elementText = await element.textContent();
                if (elementText && elementText.trim().length > 10) {
                  reviewText = elementText.trim();
                }
              }
              // Extract author name
              let author: string | undefined;
              const authorSelectors = [
                '.section-review-title',
                '[data-review-id] button',
                '.section-review-header',
                'button[data-review-id]',
                'div[role="button"]'
              ];

              for (const authSel of authorSelectors) {
                try {
                  const authorElement = element.locator(authSel).first();
                  const authorText = await authorElement.textContent();
                  if (authorText && authorText.trim().length > 0) {
                    author = authorText.trim();
                    break;
                  }
                } catch { }
              }

              // Try to extract rating
              let rating: number | undefined;
              try {
                const ratingElement = await element.locator('[role="img"][aria-label*="star"], .section-review-stars').first();
                const ariaLabel = await ratingElement.getAttribute('aria-label');
                if (ariaLabel) {
                  const match = ariaLabel.match(/(\d+)/);
                  if (match) rating = parseInt(match[1]);
                }
              } catch { }

              // Try to extract date
              let date: string | undefined;
              try {
                const dateElement = await element.locator('.section-review-publish-date, .section-review-date, [class*="date"]').first();
                date = await dateElement.textContent() || undefined;
              } catch { }

              if (reviewText && reviewText.trim().length > 0) {
                const review: ReviewData = {
                  text: reviewText.trim(),
                  rating,
                  author: author?.trim(),
                  date: date?.trim()
                };

                // Check for duplicates
                const isDuplicate = reviews.some(r => r.text === review.text && r.author === review.author);
                if (!isDuplicate) {
                  reviews.push(review);
                  foundReviews = true;
                }
              }
            } catch (e) {
              // Skip individual review extraction errors
            }
          }

          if (foundReviews) {
            break; // Found reviews with this selector, stop trying others
          }
        }
      } catch (e) {
        // Continue with next selector
        console.log(`[argus] Error with selector ${selector}:`, e);
      }
    }

    if (!foundReviews) {
      console.log('[argus] No reviews found with any selector, trying scroll to load more...');

      // Debug: Try to find any elements that might be reviews
      try {
        const allElements = await page.locator('div:has-text("★")').all();
        console.log(`[argus] Found ${allElements.length} elements containing stars`);

        if (allElements.length > 0) {
          const firstElement = allElements[0];
          const text = await firstElement.textContent();
          console.log(`[argus] Sample star element text: ${text?.substring(0, 100)}...`);
        }
      } catch (e) {
        console.log('[argus] Error debugging star elements:', e);
      }
    }

    // Check if we've reached the desired number of reviews
    if (reviews.length >= maxReviews) {
      console.log(`[argus] Reached target of ${maxReviews} reviews`);
      break;
    }

    // Check if we're making progress
    if (reviews.length === lastCount) {
      idleRounds++;
      console.log(`[argus] No new reviews found (idle round ${idleRounds}/${idleLimit})`);
    } else {
      idleRounds = 0;
      lastCount = reviews.length;
    }

    // Scroll to load more reviews
    try {
      await page.evaluate(() => {
        // Try multiple scroll strategies
        window.scrollBy(0, 1000);

        // Also try scrolling within review containers
        const containers = document.querySelectorAll('[role="main"], .section-scrollbox, .section-layout-scroll-container');
        containers.forEach(container => {
          container.scrollTop += 1000;
        });
      });

      console.log(`[argus] Scrolled page, waiting ${scrollPause}ms...`);
      await page.waitForTimeout(scrollPause);
    } catch (e) {
      console.warn('[argus] Scroll error:', e);
    }
  }

  console.log(`[argus] Extraction complete: ${reviews.length} reviews found`);
  return reviews;
}

async function tryNavigateAndExtract(profile: Profile, url: string, attempts: number): Promise<{ success: boolean; reviews: ReviewData[] }> {
  for (let i = 1; i <= attempts; i++) {
    try {
      const result = await withPage(profile, async (page) => {
        await page.goto(url, { timeout: 120_000, waitUntil: "domcontentloaded" });
        await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
        const title = await page.title();
        console.log(`[argus] profile=${profile} attempt=${i} opened: ${title}`);

        // Extract reviews
        const reviews = await extractReviews(page);
        return { success: true, reviews };
      });
      return result;
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.warn(`[argus] profile=${profile} attempt=${i} navigation error:`, msg);
      if (i === attempts && navDebug) await healthCheck(profile);
    }
  }
  return { success: false, reviews: [] };
}

async function tryNavigate(profile: Profile, url: string, attempts: number): Promise<boolean> {
  const result = await tryNavigateAndExtract(profile, url, attempts);
  return result.success;
}

// Create safe NDJSON writer
function createNDJSONWriter(outputPath: string) {
  const stream = fs.createWriteStream(outputPath, { flags: 'a' });
  return {
    write: (obj: unknown) => {
      try {
        stream.write(JSON.stringify(obj) + '\n');
      } catch (err) {
        console.error('[argus] JSON serialization error:', err);
      }
    },
    close: () => stream.close()
  };
}

(async () => {
  const outputPath = path.join(outputDir, 'scraper-output.ndjson');
  const reviewsPath = path.join(outputDir, 'reviews.ndjson');
  const writer = createNDJSONWriter(outputPath);
  const reviewsWriter = createNDJSONWriter(reviewsPath);

  try {
    const profiles: Profile[] = forceBypass ? ["insecure", "insecure_no_sandbox"] : ["secure", "insecure", "insecure_no_sandbox"];

    for (const p of profiles) {
      const result = await tryNavigateAndExtract(p, targetUrl, navRetries);
      if (result.success) {
        // Write success result
        writer.write({
          timestamp: new Date().toISOString(),
          status: 'success',
          profile: p,
          url: targetUrl,
          reviewsCount: result.reviews.length,
          message: `Navigation and extraction successful - ${result.reviews.length} reviews found`
        });

        // Write individual reviews
        result.reviews.forEach((review, index) => {
          reviewsWriter.write({
            timestamp: new Date().toISOString(),
            url: targetUrl,
            reviewIndex: index + 1,
            ...review
          });
        });

        console.log(`[argus] Successfully extracted ${result.reviews.length} reviews`);
        return;
      }
      if (p === "secure") {
        if (/ERR_CERT|ERR_SSL/i.test(targetUrl)) {
          console.warn("[argus] TLS suspect on target, proceeding to bypass profiles");
        }
      }
    }

    // Write failure result
    writer.write({
      timestamp: new Date().toISOString(),
      status: 'error',
      url: targetUrl,
      message: 'Protocol error after multi-profile retries'
    });

    throw new Error("Protocol error after multi-profile retries");
  } finally {
    writer.close();
    reviewsWriter.close();
  }
})().catch(e => {
  console.error("[argus] start failed:", (e as any)?.message || e);
  process.exitCode = 1;
});
