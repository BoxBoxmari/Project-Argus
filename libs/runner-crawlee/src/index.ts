import { PlaywrightCrawler, ProxyConfiguration, Dataset, Configuration, log } from "crawlee";
import { extractOnPage } from "./extractor.js";
import { pace, backoff } from "./middleware/rate.js";
import { robotsAllowed } from "./middleware/robots.js";

const startUrls = process.env.ARGUS_START_URLS?.split(",").filter(Boolean)
  ?? [process.env.ARGUS_TEST_URL || "https://www.google.com/maps"];

const proxy = process.env.ARGUS_PROXY_URL
  ? new ProxyConfiguration({ proxyUrls: [process.env.ARGUS_PROXY_URL] })
  : undefined;

Configuration.getGlobalConfig().set('persistStorage', true);

const crawler = new PlaywrightCrawler({
  maxRequestsPerCrawl: Number(process.env.ARGUS_MAX_REQUESTS || 5),
  proxyConfiguration: proxy,
  requestHandlerTimeoutSecs: 120,
  launchContext: {
    launchOptions: {
      channel: process.env.ARGUS_BROWSER_CHANNEL || "msedge",
      headless: process.env.ARGUS_HEADFUL !== "1"
    }
  },
  preNavigationHooks: [async ({ page }) => {
    if (process.env.ARGUS_BLOCK_RESOURCES === "1") {
      await page.route('**/*', (route) => {
        const t = route.request().resourceType();
        if (['image','font','media','stylesheet'].includes(t)) return route.abort();
        return route.continue();
      });
    }
  }],
  requestHandler: async ({ page, request, pushData, log, crawler }) => {
    await pace();
    let attempt = (request.retryCount||0)+1;
    try {
      if (!(await robotsAllowed(request.url))) {
        if (process.env.ARGUS_OVERRIDE==='1') { log.warning('robots disallow ignored by override'); }
        else { log.error('robots disallow, skipping'); return; }
      }
      await page.goto(request.url, { waitUntil: 'domcontentloaded' });
      const locale = process.env.ARGUS_LOCALE || 'en-US';
      const reviews = await extractOnPage(page, locale);
      for (const r of reviews) await pushData(r);
    } catch (e:any) {
      const code = e?.status || 0;
      if ((code===429 || code>=500) && attempt < Number(process.env.ARGUS_MAX_RETRIES||3)) {
        const ms = backoff(attempt);
        log.warning(`Retry ${attempt} after ${ms}ms`);
        await new Promise(r=>setTimeout(r, ms));
        throw e; // Crawlee will retry
      }
      throw e;
    }
  },
  failedRequestHandler: async ({ request }) => {
    log.error('Failed', { url: request.url, retries: request.retryCount });
  }
});

await crawler.run(startUrls);

// Note: Dataset export functionality may vary depending on Crawlee version
// We'll skip this for now to avoid compatibility issues
// await Dataset.getDefault().exportToJSON('reviews.json');
