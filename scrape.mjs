import { chromium } from "playwright";
import fs from "fs";

const PLACE_URL = process.env.PLACE_URL;
const OUT_DIR = process.env.OUT_DIR || "out";

// Primary & fallback
const PRIMARY_CARD_SELECTOR = "[data-review-id]";
const FALLBACK_CARD_SELECTORS = [
  "div.section-review",
  'div:has(span[aria-label*="star"])',
  'div:has([aria-label*="star"])'
];

// Review UI controls
const REVIEW_BTN_SELECTORS = [
  'button[jsaction="pane.rating.moreReviews"]',
  'button[aria-label*="reviews"]',
  'a:has-text("reviews")',
  'button:has-text("All reviews")',
  'button:has-text("Xem tất cả bài đánh giá")',
  'a:has-text("Xem tất cả bài đánh giá")'
];

const CONTAINER_SELECTORS = [
  'div[aria-label*="reviews"]',
  'div[role="feed"]',
  'div:has(div[aria-label*="rating"])'
];

// Heuristic text selectors seen in the wild
const TEXT_SELECTORS = [
  '[class*="section-review-text"]',
  '.wiI7pd',     // common GMaps review text
  '.MyEned',
  '.Jtu6Td',
  '.qjESne'
];

function safeName(u) {
  return u.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

// Helpers
async function clickAny(page, selectors, timeout = 12000) {
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) { await el.click({ delay: 50 }).catch(()=>{}); return true; }
  }
  for (const sel of selectors) {
    try { await page.waitForSelector(sel, { timeout }); await page.click(sel, { delay: 50 }); return true; } catch {}
  }
  return false;
}

async function setSortNewest(page) {
  const triggers = [
    'button[aria-label*="Sort"]',
    'button:has-text("Sort")',
    'button:has-text("Sắp xếp")',
    'div[role="button"]:has-text("Sort")'
  ];
  for (const sel of triggers) { const el = await page.$(sel); if (el) { await el.click().catch(()=>{}); break; } }
  const newest = [
    'div[role="menuitem"]:has-text("Newest")',
    'div[role="menuitem"]:has-text("Mới nhất")'
  ];
  for (const sel of newest) { const n = await page.$(sel); if (n) { await n.click().catch(()=>{}); break; } }
}

async function expandAllMore(page) {
  const sels = [
    'button:has-text("More")',
    'span:has-text("More")',
    'button:has-text("Xem thêm")',
    'span:has-text("Xem thêm")'
  ];
  for (const s of sels) {
    const els = await page.$$(s);
    for (const e of els) { await e.click({ delay: 20 }).catch(()=>{}); }
  }
}

async function findFirst(page, selectors, timeout = 15000) {
  for (const sel of selectors) { const h = await page.$(sel); if (h) return h; }
  for (const sel of selectors) {
    try { await page.waitForSelector(sel, { timeout }); return await page.$(sel); } catch {}
  }
  return null;
}

async function scrollAll(container, page, opts = { step: 1000, maxIdleMs: 15000, backoffMs: 250, maxScrolls: 2500 }) {
  let lastCount = -1, idleSince = Date.now();
  for (let i = 0; i < opts.maxScrolls; i++) {
    await container.evaluate((el, step) => el.scrollBy(0, step), opts.step);
    await page.waitForTimeout(180);
    const count = await page.$$eval(PRIMARY_CARD_SELECTOR, nodes => nodes.length).catch(() => 0);
    if (count > lastCount) { lastCount = count; idleSince = Date.now(); }
    else if (Date.now() - idleSince > opts.maxIdleMs) break;
    await page.waitForTimeout(opts.backoffMs);
  }
  return lastCount;
}

function shash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i); return (h >>> 0).toString(36); }

async function extract(page) {
  // Truyền 1 object vào evaluate (Playwright rule)
  const raw = await page.evaluate(({ PRIMARY, FALLBACKS, TEXTS }) => {
    const grab = (el, sel) => el.querySelector(sel);
    const txt = (n) => (n?.textContent || "").trim();
    const getRating = (el) => {
      const a = el.querySelector('[aria-label*="star"], [aria-label*="sao"]');
      if (!a?.ariaLabel) return null;
      const m = a.ariaLabel.match(/([\d.,]+)/);
      return m ? parseFloat(m[1].replace(",", ".")) : null;
    };
    const cards = [];
    document.querySelectorAll(PRIMARY).forEach(n => cards.push(n));
    if (cards.length < 10) { for (const sel of FALLBACKS) document.querySelectorAll(sel).forEach(n => cards.push(n)); }
    const uniqEls = Array.from(new Set(cards));

    const pickText = (el) => {
      // Ưu tiên các selector text “thật”
      const buckets = [];
      for (const s of TEXTS) el.querySelectorAll(s).forEach(n => buckets.push((n.textContent || "").trim()));
      if (!buckets.length) el.querySelectorAll("span,div").forEach(n => buckets.push((n.textContent || "").trim()));
      const cleaned = buckets.map(s => s.replace(/\s+/g, " ").trim()).filter(s => s && s.length >= 5 && !/^More$|^Xem thêm$/i.test(s));
      cleaned.sort((a,b)=>b.length-a.length);
      return cleaned[0] || "";
    };

    const rows = [];
    for (const el of uniqEls) {
      // Lấy id trực tiếp hoặc lặn xuống con
      let id = el.getAttribute("data-review-id");
      if (!id) {
        const child = el.querySelector("[data-review-id]");
        if (child) id = child.getAttribute("data-review-id");
      }
      const text = pickText(el);
      const rating = getRating(el);
      const timeNode = el.querySelector("time");
      const ts = timeNode?.getAttribute("datetime") || timeNode?.getAttribute("aria-label") || null;
      const userNode = el.querySelector('a[href*="/maps/contrib"]') || el.querySelector('a[aria-label][href*="/maps"]');
      const user = txt(userNode);
      if (!id && !text && !ts && (rating === null || rating === undefined)) continue;
      rows.push({ review_id: id || null, rating, text, ts, user });
    }
    return rows;
  }, { PRIMARY: PRIMARY_CARD_SELECTOR, FALLBACKS: FALLBACK_CARD_SELECTORS, TEXTS: TEXT_SELECTORS });

  // Dedup client-side
  const map = new Map();
  let statId = 0, statRating = 0, statTs = 0, statText = 0;
  for (const r of raw) {
    if (r.review_id) statId++;
    if (r.rating !== null && r.rating !== undefined) statRating++;
    if (r.ts) statTs++;
    if (r.text && r.text.length >= 5) statText++;
    const key = r.review_id || `${r.user || ""}|${r.ts || ""}|${shash(r.text || "")}|${r.rating ?? ""}`;
    if (!map.has(key)) map.set(key, r);
  }
  const deduped = Array.from(map.values());
  return { deduped, stats: { total_raw: raw.length, with_id: statId, with_rating: statRating, with_ts: statTs, with_text: statText } };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();

  const name = safeName(PLACE_URL);
  await page.goto(PLACE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await Promise.all([
    (async()=>{ try { await page.click('button:has-text("Reject all")', { timeout: 3000 }); } catch {} })(),
    (async()=>{ try { await page.click('button:has-text("Từ chối tất cả")', { timeout: 3000 }); } catch {} })()
  ]);
  await Promise.any([
    clickAny(page, REVIEW_BTN_SELECTORS, 12000),
    page.waitForSelector(CONTAINER_SELECTORS[0], { timeout: 12000 }).catch(()=>null)
  ]).catch(()=>{});
  await setSortNewest(page).catch(()=>{});

  const container = await findFirst(page, CONTAINER_SELECTORS, 15000);
  if (!container) { console.error("Cannot locate reviews container. Exiting."); process.exit(2); }

  const total = await scrollAll(container, page);
  await expandAllMore(page).catch(()=>{});
  const { deduped, stats } = await extract(page);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = `${OUT_DIR}/${name}.ndjson`;
  fs.writeFileSync(outPath, deduped.map(r => JSON.stringify(r)).join("\n") + "\n", "utf8");

  console.log(JSON.stringify({ outPath, totalDetected: total, exported_after_dedup: deduped.length, stats }));
  await browser.close();
})();