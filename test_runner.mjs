import fs from 'fs';
import path from 'path';

const append = (file, obj) => fs.appendFileSync(file, JSON.stringify(obj) + '\n');

// ===== Config qua env =====
const MAX_ROUNDS   = +(process.env.ARGUS_MAX_ROUNDS   || 500);
const IDLE_LIMIT   = +(process.env.ARGUS_IDLE_LIMIT   || 12);
const SCROLL_PAUSE = +(process.env.ARGUS_SCROLL_PAUSE || 280);

/* === 1) Launcher: ưu tiên BIN / CHANNEL rồi mới bundled === */
async function launchBrowserWithFallback() {
  const { chromium } = await import('playwright');
  const envBin = process.env.ARGUS_BROWSER_BIN?.trim();
  const envChannel = process.env.ARGUS_BROWSER_CHANNEL?.trim();
  const optsList = [];
  if (envBin)      optsList.push({ headless:true, executablePath: envBin });
  if (envChannel)  optsList.push({ headless:true, channel: envChannel });
  optsList.push({ headless:true, channel:'msedge' }, { headless:true, channel:'chrome' }, { headless:true });
  for (const opts of optsList) {
    try { const b = await chromium.launch(opts); append("events.jsonl",{type:"launch_ok",opts}); return b; }
    catch (e) { append("events.jsonl",{type:"launch_err",opts,err:String(e)}); }
  }
  throw new Error("No browser available.");
}

// Dọn overlay/consent
async function tryDismissOverlays(page){
  const sels = [
    'button#L2AG','button:has-text("Accept all")','button:has-text("I agree")','button:has-text("No thanks")','button:has-text("Tôi đồng ý")',
    '[aria-label*="Close"][role="button"]'
  ];
  for(const s of sels){
    const el = page.locator(s).first();
    if (await el.isVisible().catch(()=>false)){ await el.click({timeout:1500}).catch(()=>{}); append("events.jsonl",{type:"dismiss",s}); await page.waitForTimeout(200); }
  }
}

const REVIEW_TAB_CANDIDATES = [
  'button[role="tab"][aria-label*="Reviews" i]',
  'a[href*="/reviews"]',
  'button[jsaction*="pane.rating.moreReviews"]',
  'div[role="tab"] span:has-text("Reviews")'
];
async function openReviews(page, placeUrl) {
  // Nếu đang ở /reviews thì bỏ qua
  if (/\/reviews(\?|$)/i.test(page.url())) return true;
  // Thử click tab
  for (const sel of REVIEW_TAB_CANDIDATES) {
    const el = page.locator(sel);
    if (await el.first().isVisible().catch(()=>false)) {
      await el.first().click({ timeout: 5000 }).catch(()=>{});
      await page.waitForTimeout(800);
      if (/\/reviews(\?|$)/i.test(page.url())) return true;
    }
  }
  // Fallback: điều hướng thẳng sang /reviews
  const reviewsUrl = placeUrl.replace(/\/data\![^?]+/, '/reviews').replace(/(\?|$)/, '?');
  await page.goto(reviewsUrl + 'hl=en&entry=ttu', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  return /\/reviews(\?|$)/i.test(page.url());
}

const REVIEW_SCROLL_CANDIDATES = [
  'div.m6QErb.DxyBCb.kA9KIf.dS8AEf',                       // scrollbox phổ biến
  'div[aria-label*="Google reviews" i]',                    // container có aria-label
  'div[aria-label*="Reviews" i] div.m6QErb.DxyBCb',        // nested
];
const REVIEW_ITEM_CANDIDATES = [
  'div.jftiEf[data-review-id]',
  'div[data-review-id]',
  'div.jftiEf'
];
async function resolveReviewElements(page) {
  let scrollbox;
  for (const sel of REVIEW_SCROLL_CANDIDATES) {
    const box = page.locator(sel).first();
    if (await box.isVisible().catch(()=>false)) { scrollbox = box; break; }
  }
  if (!scrollbox) throw new Error('reviews_scrollbox_not_found');

  let itemSel = null;
  for (const sel of REVIEW_ITEM_CANDIDATES) {
    const c = await page.locator(sel).count().catch(()=>0);
    if (c > 0) { itemSel = sel; break; }
  }
  // Nếu chưa có item ngay, vẫn trả về scrollbox + itemSel (sẽ cuộn để lộ)
  return { scrollbox, itemSel: itemSel || REVIEW_ITEM_CANDIDATES[0] };
}

async function setSort(page, mode='newest') {
  // Optional: nếu không thấy menu thì skip, không throw
  const menuButton = page.locator('[aria-label*="Sort" i], [jsaction*="pane.reviewchart"] button').first();
  if (!(await menuButton.isVisible().catch(()=>false))) return { skipped: true, reason: 'menuitem_not_visible' };
  await menuButton.click().catch(()=>{});
  const newest = page.getByRole('menuitem', { name: /Newest|Most recent/i }).first();
  if (await newest.isVisible().catch(()=>false)) await newest.click().catch(()=>{});
  return { skipped: false };
}

(async () => {
  const url = process.env.ARGUS_TEST_URL || 'https://www.google.com/maps/place/Highlands+Coffee+417+Dien+Bien+Phu/?hl=en';
  
  const browser = await launchBrowserWithFallback();
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.8,vi;q=0.7"
    }
  });

  // 1) context.route: đừng chặn stylesheet
  /* === 2) Đừng chặn stylesheet nữa (đã fix trước) === */
  await context.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (["image","media","font"].includes(t)) return route.abort();
    route.continue();
  });

  const page = await context.newPage();
  
  /* === 7) Điều hướng + mở Reviews === */
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:120000 });
  await page.waitForTimeout(1000);
  
  await tryDismissOverlays(page);

  // 1) Mở reviews
  const opened = await openReviews(page, url);
  append("events.jsonl", { type:'open_reviews', ok: opened });
  if (!opened) throw new Error('open_reviews_failed');

  // 2) Resolve container + items
  const { scrollbox, itemSel } = await resolveReviewElements(page);
  append("events.jsonl", { type:'resolve_container_ok', itemSel });

  // 3) Optional sort
  const sortRes = await setSort(page, 'newest');
  append("events.jsonl", { type: sortRes.skipped ? 'set_sort_skip' : 'set_sort_ok', reason: sortRes.reason });



async function expandMore(page, scope) {
  const moreSelectors = [
    'button:has-text("More")',
    'button:has-text("Read more")',
    'span:has-text("More")',
  ];
  for (const sel of moreSelectors) {
    const buttons = scope ? scope.locator(sel) : page.locator(sel);
    const n = await buttons.count().catch(()=>0);
    for (let i=0;i<n;i++) {
      await buttons.nth(i).click({ timeout: 250 }).catch(()=>{});
    }
  }
}

async function scrollAndCollect(page, scrollbox, itemSel, opts) {
  const pause = Number(process.env.ARGUS_SCROLL_PAUSE || opts.pause || 220);
  const idleLimit = Number(process.env.ARGUS_IDLE_LIMIT || opts.idleLimit || 12);
  const maxRounds = Number(process.env.ARGUS_MAX_ROUNDS || opts.maxRounds || 400);

  let idle = 0, rounds = 0, before = 0, after = 0;
  while (rounds < maxRounds && idle < idleLimit) {
    before = await page.locator(itemSel).count().catch(()=>0);
    await scrollbox.evaluate(el => el.scrollBy(0, el.clientHeight * 0.92)).catch(()=>{});
    await page.waitForTimeout(pause);
    await expandMore(page, scrollbox).catch(()=>{});
    after = await page.locator(itemSel).count().catch(()=>0);
    if (after <= before) idle++; else idle = 0;
    rounds++;
  }
  return { rounds, before, after, idle };
}

function safeText(el){ return (el?.innerText || el?.textContent || '').trim(); }
function parseReview(node){
  const id = node.getAttribute('data-review-id') || '';
  const author = safeText(node.querySelector('a[data-review-id] , div a:has(img)'));
  const timeRel = safeText(node.querySelector('span:has(img[aria-label*="clock"]) , span[class*="rsqaWe"]')) || safeText(node.querySelector('span'));
  // rating: nhìn vào aria-label trên sao
  let rating = null;
  const star = node.querySelector('[aria-label*="stars" i],[aria-label*="star rating" i]');
  if (star) {
    const m = (star.getAttribute('aria-label')||'').match(/([0-9.]+)/);
    if (m) rating = Number(m[1]);
  }
  const text = safeText(node.querySelector('[data-review-text] , span[jsname="bN97Pc"] , span[class*="wiI7pd"]'));
  return { review_id: id, author, relative_time: timeRel, rating, text };
}

  // 4) Scroll & collect
  const sc = await scrollAndCollect(page, scrollbox, itemSel, {});
  const nodes = await page.locator(itemSel).elementHandles();
  const raw = [];
  for (const h of nodes) {
    const obj = await h.evaluate(parseReview);
    raw.push(obj);
  }

  // 5) De-dup theo review_id
  const seen = new Set();
  const reviews = raw.filter(r => {
    if (!r.review_id) return true;
    if (seen.has(r.review_id)) return false;
    seen.add(r.review_id);
    return true;
  });

  // 6) Ghi file (tuyệt đối) & summary
  const outReviews = path.resolve(process.cwd(), 'reviews.json');
  const outSummary = path.resolve(process.cwd(), 'summary.json');

  await fs.promises.writeFile(outReviews, JSON.stringify(reviews, null, 2), 'utf8');
  const summary = {
    url,
    timestamp: new Date().toISOString(),
    scrolled: { containers: 1, totalScroll: sc.rounds, before: sc.before, after: sc.after },
    reviews_collected: reviews.length
  };
  await fs.promises.writeFile(outSummary, JSON.stringify(summary, null, 2), 'utf8');

  await browser.close();
})();
