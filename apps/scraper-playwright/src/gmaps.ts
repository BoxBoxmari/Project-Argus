import { Page } from 'playwright';

const SEL = {
  seeAllReviewsLink: 'a[href*="/lrd"]',
  reviewsButton: [
    'button[aria-label*="reviews"]',
    'button[jsaction*="reviewDialog"]',
    'a:has-text("reviews")',
    'a:has-text("Đánh giá")'
  ].join(','),
  reviewsContainer: [
    'div[aria-label*="review"][role="region"]',
    'div.m6QErb[aria-label*="review"]',
    'div[jscontroller*="LWbA6e"] .m6QErb'
  ].join(','),
  reviewItem: [
    'div[data-review-id]',
    'div.jftiEf[data-review-id]'
  ].join(','),
  // fields
  author: [
    'a[href*="maps/contrib"] .d4r55',
    '.d4r55'
  ].join(','),
  date: [
    'span.rsqaWe',
    'span:has-text("ago")',
    'span:has-text("trước")'
  ].join(','),
  textNodes: [
    '[jsname="bN97Pc"]',
    '.wiI7pd',
    'span[aria-hidden="true"]'
  ].join(','),
  starRole: [
    '[role="img"][aria-label*="star"]',
    '[role="img"][aria-label*="sao"]',
    '[aria-label*="star"]',
    '[aria-label*="sao"]'
  ].join(','),
  name: 'h1.DUwDvf, h1[role="heading"].DUwDvf, h1',
  address: 'button[data-item-id="address"] .Io6YTe, [data-item-id="address"] .Io6YTe, button[aria-label*="Address"] .Io6YTe'
};

function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }
function hash(s:string){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h)^s.charCodeAt(i); return (h>>>0).toString(36); }
function parseStars(label?: string | null){ if(!label) return null; const m = label.match(/([\d]+(?:\.[\d]+)?)/); return m? parseFloat(m[1]) : null; }

export async function acceptConsent(page: Page) {
  const labels = ['Accept all','I agree','Accept','Agree','Got it','Đồng ý','Chấp nhận','Tôi đồng ý'];
  for (const l of labels) {
    const btn = page.locator(`button:has-text("${l}")`).first();
    if (await btn.isVisible().catch(()=>false)) { await btn.click().catch(()=>{}); break; }
  }
}

async function ensureReviewsPage(page: Page) {
  await acceptConsent(page);
  // Ưu tiên click "See all reviews" (/lrd)
  const link = page.locator(SEL.seeAllReviewsLink).first();
  if (await link.isVisible().catch(()=>false)) {
    await link.click().catch(()=>{});
    await page.waitForLoadState('domcontentloaded').catch(()=>{});
  } else {
    // fallback: nút Reviews
    const btn = page.locator(SEL.reviewsButton).first();
    if (await btn.isVisible().catch(()=>false)) await btn.click().catch(()=>{});
  }
  // chờ container reviews
  await page.locator(SEL.reviewsContainer).first().waitFor({ timeout: 30000 }).catch(()=>{});
  return await page.locator(SEL.reviewsContainer).first().isVisible().catch(()=>false);
}

async function expandReadMore(page: Page) {
  const moreBtn = 'button:has-text("More"), button:has-text("Xem thêm"), [aria-label^="More"]';
  const n = await page.locator(moreBtn).count().catch(()=>0);
  for (let i=0;i<n;i++) await page.locator(moreBtn).nth(i).click({ timeout: 50 }).catch(()=>{});
}

async function scrollPanelFully(page: Page, opts: {maxIdleRounds?: number, maxItems?: number, hardTimeoutMs?: number} = {}) {
  const panel = page.locator(SEL.reviewsContainer).first();
  await panel.waitFor({ timeout: 10000 }).catch(()=>{});
  const maxIdleRounds = opts.maxIdleRounds ?? 14;     // số vòng “không tăng” trước khi dừng
  const hardTimeoutMs = opts.hardTimeoutMs ?? 180000; // cứng 3 phút
  const t0 = Date.now();
  let idle = 0;
  let lastCount = await page.locator(SEL.reviewItem).count().catch(()=>0);

  // bảo đảm focus vào panel để wheel/keys tác dụng đúng vùng
  try { await panel.scrollIntoViewIfNeeded(); await panel.hover(); } catch {}

  while (idle < maxIdleRounds && (Date.now()-t0) < hardTimeoutMs) {
    // 1) kéo tới đáy bằng scrollHeight
    await panel.evaluate((el:any)=>{ el.scrollTop = el.scrollHeight; });
    await expandReadMore(page);
    await sleep(350);

    // 2) wheel mạnh vài lần để kích lazy-load
    for (let i=0;i<3;i++) { try { await page.mouse.wheel(0, 2500); } catch {} await sleep(120); }

    // 3) bắn phím End & PageDown (fallback)
    try { await page.keyboard.press('End', { delay: 10 }); await page.keyboard.press('PageDown', { delay: 10 }); } catch {}

    await expandReadMore(page);
    const cur = await page.locator(SEL.reviewItem).count().catch(()=>0);

    if (opts.maxItems && cur >= opts.maxItems) break;

    if (cur > lastCount) { lastCount = cur; idle = 0; }
    else { idle += 1; }

    // throttle nhẹ để tránh 429
    await sleep(250);
  }
  return lastCount;
}

async function getStoreMeta(page: Page) {
  let name = (await page.locator(SEL.name).first().innerText().catch(()=>''))?.trim();
  if (!name) { const t = await page.title().catch(()=> ''); name = t.replace(/\s*[–-]\s*Google Maps.*$/,'').split('·')[0].trim(); }
  let address = (await page.locator(SEL.address).first().innerText().catch(()=>''))?.trim();
  return { name: name || 'N/A', address: address || 'N/A', sourceUrl: page.url() };
}

export async function collectGmapsReviews(page: Page, opts: { maxItems?: number } = {}) {
  // luôn dùng hl=en để selector ổn định hơn
  const u = new URL(page.url()); if (u.searchParams.get('hl') !== 'en') { u.searchParams.set('hl','en'); await page.goto(u.toString(), { waitUntil: 'domcontentloaded' }); }
  const store = await getStoreMeta(page);

  const opened = await ensureReviewsPage(page);
  if (!opened) return { status: 'EMPTY', error_message: 'reviews panel not opened', reviews: [], store };

  await scrollPanelFully(page, { maxIdleRounds: 16, maxItems: opts.maxItems, hardTimeoutMs: 240000 });

  const items = page.locator(SEL.reviewItem);
  const total = await items.count().catch(()=>0);
  const seen = new Set<string>();
  const out:any[] = [];

  for (let i=0; i<total; i++) {
    const el = items.nth(i);
    const id = await el.getAttribute('data-review-id').catch(()=>null);
    const author = (await el.locator(SEL.author).first().innerText().catch(()=> '')).trim();
    const date   = (await el.locator(SEL.date).last().innerText().catch(()=> '')).trim();
    const textParts = await el.locator(SEL.textNodes).allInnerTexts().catch(()=>[]);
    const text = textParts.join(' ').replace(/\s+/g,' ').trim();
    const starLabel = await el.locator(SEL.starRole).first().getAttribute('aria-label').catch(()=>null);
    const star = parseStars(starLabel);

    const key = id || hash(`${author}|${date}|${text}`);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ id: id || null, author, date, text, star });
    if (opts.maxItems && out.length >= opts.maxItems) break;
  }

  return {
    status: out.length ? 'OK' : 'EMPTY',
    error_message: out.length ? '' : `no items after scroll; seen=${seen.size}, domCount=${total}`,
    reviews: out,
    store
  };
}
