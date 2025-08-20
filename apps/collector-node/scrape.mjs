import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline/promises';
import pLimit from 'p-limit';
import { z } from 'zod';

// Lazy import playwright for better stability than raw puppeteer
const { chromium } = await import('playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'out');
const CONCURRENCY = Number(process.env.GMAPS_SCRAPE_CONCURRENCY || 2);
const TIMEOUT_MS = Number(process.env.GMAPS_SCRAPE_TIMEOUT_MS || 45000);
const MAX_SCROLL = Number(process.env.GMAPS_SCRAPE_SCROLL_MAX || 120);
const BACKOFF_BASE = Number(process.env.GMAPS_SCRAPE_BACKOFF_BASE_MS || 800);

const Review = z.object({
  review_id: z.string(),
  place_id: z.string(),
  author_name: z.string().optional().nullable(),
  rating: z.number().min(0).max(5),
  text: z.string(),
  language: z.string().optional().nullable(),
  posted_at: z.string(),
  owner_response: z.string().optional().nullable(),
  like_count: z.number().int().nonnegative().optional().nullable(),
  url: z.string().url(),
  scraped_at: z.string(),
  source: z.literal('google_maps'),
  extractor_version: z.string()
});

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function nowISO() { return new Date().toISOString(); }

function makeWriter() {
  ensureDir(OUT_DIR);
  const file = path.join(OUT_DIR, 'reviews.ndjson');
  const stream = fs.createWriteStream(file, { flags: 'a', encoding: 'utf8' });
  return {
    write(obj) { stream.write(JSON.stringify(obj) + '\n'); },
    end() { stream.end(); },
    file
  };
}

// Simple in-memory dedup during run
const seen = new Set();
function dedupKey(r) { return `${r.place_id}:${r.review_id}`; }

async function infiniteScroll(page, maxRounds) {
  let lastHeight = 0;
  for (let i=0; i<maxRounds; i++) {
    await page.mouse.wheel(0, 12000);
    await sleep(350 + i * 15);
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === lastHeight) break;
    lastHeight = height;
  }
}

async function extractReviewsFromPlace(page, placeUrl, extractorVersion) {
  await page.goto(placeUrl, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });
  // Open reviews panel; selector may evolve; keep this robust by searching anchors
  await page.waitForTimeout(1200);
  const reviewsButton = await page.locator('button[aria-label*="reviews"], a[aria-label*="reviews"]').first();
  if (await reviewsButton.count()) await reviewsButton.click();
  await page.waitForTimeout(1200);

  // Scroll the reviews container if present, else fallback to page
  const reviewContainer = page.locator('[role="feed"], div[aria-label*="reviews"]');
  for (let i=0;i<MAX_SCROLL;i++){
    await reviewContainer.evaluateAll(nodes => nodes.forEach(n => n.scrollBy(0, 2000))).catch(()=>{});
    await sleep(150 + (i%10)*10);
  }

  // Parse reviews; selectors simplified; adapt as needed
  const items = await page.locator('[data-review-id]').all();
  const results = [];
  for (const el of items) {
    const review_id = await el.getAttribute('data-review-id') || crypto.randomUUID();
    const text = (await el.locator('[data-review-text]').first().textContent().catch(()=>''))?.trim() || '';
    const ratingAttr = await el.locator('[aria-label*="stars"]').getAttribute('aria-label').catch(()=>null);
    const rating = ratingAttr ? Number((ratingAttr.match(/([0-5](?:[.,]\d)?)/)?.[1] || '0').replace(',','.')) : 0;
    const author_name = (await el.locator('a[aria-label*="Profile"], a').first().textContent().catch(()=>null))?.trim() || null;
    const posted_at = (await el.locator('span').filter({ hasText: /ago|trước|phút|giờ|ngày|tháng|năm/i }).first().textContent().catch(()=>nowISO())) || nowISO();
    const like_count = Number((await el.locator('[aria-label*="like"], [aria-label*="thích"]').first().textContent().catch(()=>0)) || 0);

    const rec = {
      review_id,
      place_id: new URL(placeUrl).searchParams.get('cid') || new URL(placeUrl).pathname,
      author_name,
      rating: isFinite(rating) ? rating : 0,
      text,
      language: null,
      posted_at,
      owner_response: null,
      like_count: isFinite(like_count) ? like_count : 0,
      url: placeUrl,
      scraped_at: nowISO(),
      source: 'google_maps',
      extractor_version: extractorVersion
    };
    results.push(rec);
  }
  return results;
}

async function main() {
  ensureDir(OUT_DIR);
  const writer = makeWriter();
  const urlsPath = process.argv[2] || path.join(__dirname, 'data', 'places.txt');
  const extractorVersion = 'gmaps.0.1.0';

  const input = fs.readFileSync(urlsPath, 'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const limit = pLimit(CONCURRENCY);

  const browser = await chromium.launch({ headless: process.env.GMAPS_SCRAPE_HEADLESS !== 'false' });
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 Argus/0.1" });

  try {
    const jobs = input.map(url => limit(async () => {
      for (let attempt=1; attempt<=Number(process.env.GMAPS_SCRAPE_MAX_RETRIES||3); attempt++) {
        const page = await ctx.newPage();
        try {
          const reviews = await extractReviewsFromPlace(page, url, extractorVersion);
          for (const r of reviews) {
            const key = dedupKey(r);
            if (seen.has(key)) continue;
            Review.parse(r);
            seen.add(key);
            writer.write(r);
          }
          await page.close();
          return;
        } catch (err) {
          await page.close();
          await sleep(BACKOFF_BASE * Math.pow(2, attempt-1));
          if (attempt === Number(process.env.GMAPS_SCRAPE_MAX_RETRIES||3)) throw err;
        }
      }
    }));
    await Promise.allSettled(jobs);
  } finally {
    await ctx.close();
    await browser.close();
    writer.end();
    console.log('Done. Output:', path.join(OUT_DIR,'reviews.ndjson'));
  }
}

main().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});