/* eslint-env node */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
// Project Argus - Puppeteer Engine (fully rebuilt)
// Path: worker-node/puppeteer_engine/scraper.js
// Node >= 18 recommended

const fs = require('fs');
const path = require('path');
const {
  pageWait, injectInitScript, addInitScriptCompat,
  createIsolatedContext, newPageCompat, newIsolatedPage,
  routeAll, safeEvaluate, bindRoutingCompat,
  shouldBlockRequest, computeBackoffMs
} = require('./lib/compat');

// Helper functions that were removed from compat
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sleepCompat = (page, ms) => pageWait(page, ms);

function resolveHeadlessFlag(raw) {
  if (raw === 'new') return 'new';
  if (raw === '0' || raw === 'false') return false;
  return true;
}



function forceEnLocale(url) {
  try {
    const u = new URL(url);
    if (!u.searchParams.get('hl')) {
      u.searchParams.set('hl', 'en-US');
    }
    return u.toString();
  } catch (e) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}hl=en-US`;
  }
}





// ---------- Helpers
function nowIso() { return new Date().toISOString(); }
function randId(len = 12) {
  const s = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += s[Math.floor(Math.random() * s.length)];
  return out;
}
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }


// Run / job IDs and log setup
const RUN_ID = process.env.ARGUS_RUN_ID || (new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14));
const JOB_ID = randId(12);
const LOG_DIR = path.resolve(process.cwd(), "logs");
ensureDir(LOG_DIR);
const LOG_FILE = process.env.ARGUS_LOG_FILE || path.join(LOG_DIR, `worker-${RUN_ID}.log`);

function jlog(level, msg, extra = {}) {
  const rec = { ts: nowIso(), level, run_id: RUN_ID, job_id: JOB_ID, module: "worker-node", msg, ...extra };
  const line = JSON.stringify(rec);
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch { /* ignore log write errors */ }
  console.log(line);
}

// ---------- Read CLI
const [, , inputUrl, outPath] = process.argv;

if (!inputUrl || !outPath) {
  console.error("Usage: node scraper.js <url> <output.json>");
  process.exit(2);
}

const initialUrl = forceEnLocale(inputUrl);

// ---------- Env
const HEADLESS = resolveHeadlessFlag(process.env.ARGUS_HEADLESS ?? '1');
const LOCALE = process.env.ARGUS_LOCALE || "en-US,en;q=0.9";
const UA = process.env.ARGUS_UA || null;
const NAV_RETRIES = parseInt(process.env.ARGUS_NAV_RETRIES || "2", 10);
const NAV_TIMEOUT = parseInt(process.env.ARGUS_NAV_TIMEOUT_MS || "45000", 10);
const SCROLL_STEPS = parseInt(process.env.ARGUS_MAX_SCROLL_STEPS || "25", 10);
const SCROLL_PAUSE = parseInt(process.env.ARGUS_SCROLL_PAUSE_MS || "500", 10);
const DEBUG_SNAPSHOT = (process.env.ARGUS_DEBUG_SNAPSHOT || "1") !== "0"; // save html/screenshot when failing

// Strategy selection via ENV
const STRATEGY = (process.env.ARGUS_STRATEGY || "userscript").toLowerCase(); // auto|userscript|fallback

// Debug devtools toggle
const OPEN_DEVTOOLS = (process.env.ARGUS_OPEN_DEVTOOLS || "0") === "1";

// Userscript path
const ARGUS_USERSCRIPT_PATH = process.env.ARGUS_USERSCRIPT_PATH || 
  path.join(process.cwd(), 'userscript', 'argus.user.js');

// write-protected output dir
ensureDir(path.dirname(path.resolve(outPath)));

// Result skeleton
const result = {
  status: "ERROR",
  timestamp: nowIso(),
  locationUrl: inputUrl,
  error_message: "",
  error_stack: "",
  screenshot: "",
  html_snapshot: "",
  review_data: []
};

// ---------- Puppeteer boot
async function clickConsentIfPresent(page){
  const SELS = [
    'button[aria-label*="I agree"]',
    'button[aria-label*="Tôi đồng ý"]',
    'button[aria-label*="Accept all"]',
    'button[aria-label*="Chấp nhận"]',
    'form[action*="consent"] button[type="submit"]'
  ];
  for (const s of SELS) {
    const el = await page.$(s);
    if (el) { 
      try { 
        await el.click({delay:40}); 
        await sleep(600); 
      } catch(e) {
        jlog("DEBUG", "consent_click_failed", { selector: s, error: String(e) });
      }
    }
  }
}

async function expandAllMore(page, panelSel){
  await page.evaluate(async (panelSel)=>{
    const panel = document.querySelector(panelSel);
    if (!panel) return;
    const moreBtns = panel.querySelectorAll('button[aria-label*="More"], button[aria-label*="Thêm"], span[role="button"][aria-label*="More"]');
    for (const btn of moreBtns) { 
      try { 
        btn.click(); 
      } catch(e) {
        console.warn('[Argus] More button click failed:', e);
      }
    }
  }, panelSel);
  await sleep(300);
}



async function main() {
  jlog("INFO", "starting", { inputUrl, headless: HEADLESS });
  jlog("INFO", "strategy_selected", { strategy: STRATEGY });
  
  // Khai báo let context, page; ở ngoài try {} để catch dùng lại
  let context, page;

  // Lazy import (avoid throwing if node env missing puppeteer)
  const puppeteer = require('puppeteer');

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--proxy-server=direct://',
    '--proxy-bypass-list=*',
    '--no-first-run',
    '--no-default-browser-check',
    '--lang=' + (LOCALE.split(',')[0] || 'en-US'),
    '--window-size=1366,900'
  ];
  
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: launchArgs,
    defaultViewport: { width: 1366, height: 900 }
  });

  try {
    page = await newPageCompat(browser);
    await page.setBypassCSP(true);
    await bindRoutingCompat(page, shouldBlockRequest);
    
    // stealth-lite
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      const proto = Notification && Notification.prototype;
      if (proto) try { Object.defineProperty(proto, 'permission', { get: () => 'default' }); } catch(_e){ /* ignore */ }
    });

    if (UA) {
      await page.setUserAgent(UA);
    } else {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    }
    await page.setExtraHTTPHeaders({ 'Accept-Language': LOCALE });

    page.on('console', (msg) => {
      const text = msg.text();
      // chỉ log ERROR khi thật sự có Error object
      if (msg.type() === 'error') return jlog("ERROR", "console_error", { text });
      if (/violation/i.test(text)) return; // bỏ
      if (/Failed to load resource/.test(text)) return; // noise của Maps
    });
    page.on('requestfailed', (req) => {
      // hạ thành DEBUG, không coi là lỗi quy trình
      jlog("DEBUG", "requestfailed_ignored", { url: req.url(), err: req.failure()?.errorText });
    });
    page.setDefaultTimeout(Math.max(20000, NAV_TIMEOUT));



    // === NAVIGATION START ===

    // === Unified request routing (Puppeteer-safe) ===
    if (page.__argusRouteBound !== true) {
      page.__argusRouteBound = true;

      // Use new routeAll function with predicate and handler
      await routeAll(page, 
        // Predicate: what to intercept
        (req) => {
          const url = req.url;
          const type = req.resourceType;
          
          // 1) Chặn rác/telemetry/stream + tài nguyên nặng
          if (shouldBlockRequest(url) || ['image','media','font','stylesheet','websocket'].includes(type)) {
            return true; // intercept this request
          }
          
          // 2) Ép hl=en để ổn định UI/ARIA
          if (url.startsWith('https://www.google.com/maps') && !/[?&]hl=en/.test(url)) {
            return true; // intercept this request
          }
          
          return false; // don't intercept
        },
        // Handler: what to do with intercepted requests
        (req) => {
          const url = req.url;
          const type = req.resourceType;
          
          // 1) Chặn rác/telemetry/stream + tài nguyên nặng
          if (shouldBlockRequest(url) || ['image','media','font','stylesheet','websocket'].includes(type)) {
            return req.abort();
          }
          
          // 2) Ép hl=en để ổn định UI/ARIA
          if (url.startsWith('https://www.google.com/maps') && !/[?&]hl=en/.test(url)) {
            const newUrl = url + (url.includes('?') ? '&' : '?') + 'hl=en';
            return req.continue({ url: newUrl });
          }
        }
      );

      // Cleanup khi trang đóng
      page.once('close', async () => {
        page.__argusRouteBound = false;
      });
    }

    // ---- điều hướng + consent + chuyển thẳng Reviews
    let navOk = false; let lastErr = null;
    for (let attempt = 1; attempt <= 3 && !navOk; attempt++) {
      try {
        const url = inputUrl.includes('/reviews') ? inputUrl : inputUrl + (inputUrl.includes('?') ? '&' : '?') + 'hl=en';
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        await sleep(600);

        // cookie consent (nếu có)
        const consentSel = [
          'button[aria-label*="Accept"][jsname]',
          'button[aria-label*="Tôi đồng ý"]',
          'form[action*="consent"] button'
        ];
        for (const sel of consentSel) {
          const b = await page.$(sel);
          if (b) { await b.click().catch(()=>{}); await sleep(400); break; }
        }

        navOk = true;
        jlog("INFO", "nav_ok", { attempt, url: page.url() });
      } catch (e) {
        lastErr = String(e);
        jlog("WARN", "nav_fail", { attempt, error: lastErr, backoff: 1200 + attempt*400 });
        await sleep(1200 + attempt*400);
      }
    }
    if (!navOk) throw new Error("Navigation failed: " + lastErr);

    // Nạp Userscript khi có (tận dụng nền tảng cốt lõi)
    const tryLoadUserscript = async () => {
      // Có đường dẫn hợp lệ?
      if (!fs.existsSync(ARGUS_USERSCRIPT_PATH)) return false;

      // Polyfill tối thiểu GM_* trong bối cảnh trang (trước khi userscript chạy)
      await injectInitScript(page, `
        const kv = '__ARGUS_KV__';
        window[kv] = window[kv] || {};
        function getKV(k, defVal){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : defVal; } catch(e){ return defVal; } }
        function setKV(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ /* ignore */ } }
        // Stub phổ biến
        window.GM_getValue = (k, d) => getKV(k, d);
        window.GM_setValue = (k, v) => setKV(k, v);
        window.GM_listValues = () => { try { return Object.keys(localStorage); } catch(e){ return []; } };
        window.GM_deleteValue = (k) => { try { localStorage.removeItem(k); } catch(e){ /* ignore */ } };
        // Bridge log
        window.updateLog = (msg) => { try { console.log('[Argus][US]', msg); } catch(e){ /* ignore */ } };
      `);

      await page.addScriptTag({ path: ARGUS_USERSCRIPT_PATH });
      return true;
    };

    let userscriptLoaded = false;
    if (STRATEGY === 'userscript' || STRATEGY === 'auto') {
      try {
        userscriptLoaded = await tryLoadUserscript();
        if (userscriptLoaded) {
          jlog("INFO", "userscript_loaded", { path: ARGUS_USERSCRIPT_PATH });
          // tuỳ userscript: có thể khởi động auto nếu hỗ trợ
          await safeEvaluate(page, () => { window.ARGUS_AUTO_ADVANCE_NEXT = false; /* ví dụ */ });
        } else {
          jlog("WARN", "userscript_not_found_or_failed", { path: ARGUS_USERSCRIPT_PATH });
        }
      } catch (e) {
        jlog("WARN", "userscript_inject_error", { error: String(e && e.message || e) });
      }
    }

    // ---------- Try Userscript-first path (unless fallback strategy)
    if (STRATEGY === "fallback") {
      jlog("INFO", "strategy_skip_userscript", { reason: "fallback_only" });
    } else {
      // 2.1 Expose bridge so page can push bus events back to Node
      const bus = { rows: [], lastLoaded: 0, lastTs: Date.now() };
      await page.exposeFunction('ARGUS_NODE_PUSH', (topic, payload) => {
        try {
          if (topic === 'data' && payload && Array.isArray(payload.rows)) {
            for (const r of payload.rows) bus.rows.push(r);
          }
          if (topic === 'progress' && payload && typeof payload.loaded === 'number') {
            bus.lastLoaded = payload.loaded;
            bus.lastTs = Date.now();
          }
        } catch { /* ignore errors */ }
      });
              await safeEvaluate(page, () => {
          function hook(topic){
            window.addEventListener('ARGUS:' + topic.toUpperCase(), ev => {
              try { window.ARGUS_NODE_PUSH(topic, ev.detail || {}); } catch { /* ignore errors */ }
            });
          }
          hook('data'); hook('progress'); hook('coord');
        });

      // 2.2 Inject Userscript code (ổn định)
      if (process.env.ARGUS_USERSCRIPT_PATH) {
        const fs = require('fs');
        const usPath = process.env.ARGUS_USERSCRIPT_PATH;
        const code = fs.readFileSync(usPath, 'utf8');
        // Inject đúng helper đã import
        await injectInitScript(page, code);
      }

      // 2.3 Ask Userscript to open dialog + run high-density scrolling
      try {
        await safeEvaluate(page, async () => {
          if (typeof argusEnsureReviewsDialogOpen === 'function') {
            await argusEnsureReviewsDialogOpen(20000);
          }
          if (window.ARGUS_HD_RUN) {
            await window.ARGUS_HD_RUN(); // robust scroll-driver
          }
        });
      } catch (e) {
        jlog("WARN", "userscript_run_warn", { error: String(e) });
      }

      // 2.4 Wait for plateau of progress or time budget
      const USERSCRIPT_BUDGET_MS = parseInt(process.env.ARGUS_USERSCRIPT_BUDGET_MS || "90000", 10);
      const QUIET_MS = 2500;
      const tStart = Date.now();
      let lastLoaded = 0, lastBump = Date.now();
      
      // Strict time budget enforcement
      function timeLeft() { return Math.max(0, USERSCRIPT_BUDGET_MS - (Date.now() - tStart)); }
      
      while (timeLeft() > 0) {
        await sleepCompat(page, 400);
        if (bus.lastLoaded !== lastLoaded) {
          lastLoaded = bus.lastLoaded;
          lastBump = Date.now();
        }
        if (Date.now() - lastBump >= QUIET_MS) break; // plateau
      }
      
      jlog("INFO", "userscript_time_budget", { 
        elapsed: Date.now() - tStart, 
        budget: USERSCRIPT_BUDGET_MS, 
        remaining: timeLeft() 
      });

      // Userscript plateau snapshot (before fallback)
      jlog("INFO","userscript_plateau",{ loaded: bus.lastLoaded, rows: bus.rows.length });
      if (bus.rows.length === 0 && DEBUG_SNAPSHOT) {
        try {
          const snapName = `us_plateau_${Date.now()}`;
          const screenshotPath = path.join(path.dirname(path.resolve(outPath)), `${snapName}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true }).catch(()=>{});
          jlog("INFO","userscript_plateau_snapshot",{ screenshot: path.relative(process.cwd(), screenshotPath).replace(/\\/g,'/') });
        } catch { /* ignore snapshot errors */ }
      }

      // 2.5 If Userscript produced rows, use them
      if (bus.rows.length > 0) {
        const dedup = new Map();
        for (const r of bus.rows) {
          const id = r.id || r.review_id || '';
          const key = id || `${r.author||r.user||''}|${r.time||r.date||''}|${r.text||''}`;
          if (!dedup.has(key)) dedup.set(key, {
            review_id: id,
            user: r.author || r.user || '',
            rating: r.rating ?? null,
            date: r.time || r.date || '',
            text: r.text || ''
          });
        }
        const review_data = Array.from(dedup.values());
        jlog("INFO", "extracted_userscript", { count: review_data.length });
        result.status = "SUCCESS";
        result.review_data = review_data;
      }
    }

    // Legacy extractor fallback: only run when userscript yields nothing
    if (!result.review_data || result.review_data.length === 0) {
      jlog("WARN", "userscript_fallback_triggered", { reason: "0 rows from userscript" });
      
      try {
        // 1) Try to open reviews overlay
        const openSelectors = [
          'button[aria-label^="See all reviews"]',
          'button[jsaction*="pane.reviewChart.moreReviews"]',
          'a[aria-label^="Reviews"][href*="/reviews"]'
        ];
        for (const sel of openSelectors) {
          const el = await page.$(sel);
          if (el) { 
            await el.click(); 
            await sleepCompat(page, 700); 
            jlog("DEBUG", "legacy_overlay_opened", { selector: sel });
            break; 
          }
        }
        
        // 2) Scroll overlay
        const boxSel = 'div.m6QErb.DxyBCb, div[data-argus-scrollbox="1"]';
        await page.waitForSelector(boxSel, { timeout: 15000 }).catch(()=>{});
        const scrollRuns = 12;
        for (let i=0; i<scrollRuns; i++){
                  await safeEvaluate(page, (sel) => {
          const box = document.querySelector(sel);
          if (box) box.scrollTo(0, box.scrollHeight);
        }, boxSel);
          await sleepCompat(page, 600);
        }
        jlog("DEBUG", "legacy_scroll_complete", { runs: scrollRuns });
        
        // 3) Extract minimal fields
        const legacyResult = await safeEvaluate(page, ()=>{
          const qsa = (s) => Array.from(document.querySelectorAll(s));
          const box = document.querySelector('div.m6QErb.DxyBCb, div[data-argus-scrollbox="1"]') || document;
          const cards = Array.from(box.querySelectorAll('[data-review-id],[jscontroller="e6Mltc"], div[aria-label*="review"]'));
          const rows = cards.map(card => {
            const get = sel => (card.querySelector(sel)?.textContent||'').trim();
            const ratingEl = card.querySelector('[aria-label*="stars"], [role="img"][aria-label*="star"]');
            const rating = ratingEl ? (parseFloat((ratingEl.getAttribute('aria-label')||'').match(/([0-9.]+)/)?.[1]||'') || null) : null;
            return {
              author: get('a[role="link"][href*="contrib"]') || get('.d4r55'),
              date: get('span[class*="rsqaWe"]') || get('span[class*="fTKmHE"]'),
              rating,
              text: get('[class*="MyEned"]') || get('[class*="wiI7pd"]') || get('div[aria-expanded="true"]')
            };
          });
          return { loaded: cards.length, rows };
        });
        
        if (legacyResult && legacyResult.rows && legacyResult.rows.length > 0) {
          jlog("INFO", "legacy_extractor_success", { count: legacyResult.rows.length });
          result.status = "SUCCESS";
          result.review_data = legacyResult.rows;
        } else {
          jlog("WARN", "legacy_extractor_no_results");
        }
      } catch (e) {
        jlog("ERROR", "legacy_extractor_error", { error: String(e) });
      }
    }

    // ---------- Fallback: legacy Puppeteer DOM extraction (kept, but fixed)
    if (result.review_data.length === 0) {
      jlog("INFO", "fallback_legacy_extractor");
      
      // Sometimes the reviews list is on the Overview tab; sometimes behind "See all reviews" or "Reviews" tab.
      // We will attempt, in order: (1) 'See all reviews' CTA, (2) explicit 'Reviews' tab, (3) directly locate the review scroll area.
    async function waitAny(page, selectors, timeoutMs) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        for (const sel of selectors) {
          const handle = await page.$(sel);
          if (handle) return { handle, selector: sel };
        }
        await sleepCompat(page, 200);
      }
      return null;
    }

    // Cards: broaden to cover multiple UI variants; allow override via ENV
    const CARD_SELECTOR_CSV = process.env.ARGUS_CARD_SELECTOR_CSV
      || '[data-review-id], div.jftiEf, div.gZ9Ghe';

    const SEE_ALL_SELECTORS = [
      'button[jsaction*="pane.reviewChart.moreReviews"]',
      'a[jsaction*="pane.reviewChart.moreReviews"]',
      // Fallback by aria-label (en/vi)
      'button[aria-label*="See all reviews"]',
      'button[aria-label*="Tất cả bài đánh giá"]',
      'button[aria-label*="Xem tất cả đánh giá"]'
    ];

    const REVIEWS_TAB_SELECTORS = [
      'button[role="tab"][aria-controls*="reviews"]',
      'button[role="tab"][data-tab-index][aria-selected="false"]',
      'a[href*="/reviews"]',
      'button[aria-label^="Reviews"]',
      'a[aria-label^="Reviews"]',
      'button[aria-label^="Đánh giá"]'
    ];

    const PANEL_SELECTORS = [
      'div.m6QErb.DxyBCb',
      'div[aria-label*="Reviews"][role="region"]',
      'div.section-scrollbox',
      'div[role="tabpanel"] div[aria-label*="review"]'
    ];

    // 1) Try "See all reviews"
    let panelSelUsed = null;
    let candidate = await waitAny(page, SEE_ALL_SELECTORS, 20000);
    if (candidate) {
      jlog("DEBUG", "selector_found", { selector: candidate.selector, timeout: 20000 });
      try { await candidate.handle.click({ delay: 60 }); } catch (_e) { /* ignore click errors */ }
      // Wait panel
      const p = await waitAny(page, PANEL_SELECTORS, 30000);
      if (p) {
        panelSelUsed = await resolveScrollbox(p.selector);
        jlog("INFO", "overlay_opened", { method: "see_all", selector: panelSelUsed });
      }
    }

    // 2) Try "Reviews" tab if not yet
    if (!panelSelUsed) {
      candidate = await waitAny(page, REVIEWS_TAB_SELECTORS, 15000);
      if (candidate) {
        jlog("DEBUG", "selector_found", { selector: candidate.selector, timeout: 15000 });
        try { await candidate.handle.click({ delay: 60 }); } catch (_e) { /* ignore click errors */ }
        const p = await waitAny(page, PANEL_SELECTORS, 30000);
        if (p) {
          panelSelUsed = await resolveScrollbox(p.selector);
          jlog("INFO", "overlay_opened", { method: "reviews_tab", selector: panelSelUsed });
        }
      }
    }

    // 3) Fall back: detect panel directly
    if (!panelSelUsed) {
      const p = await waitAny(page, PANEL_SELECTORS, 15000);
      if (p) {
        panelSelUsed = await resolveScrollbox(p.selector);
        jlog("INFO", "review_panel_found", { selector: panelSelUsed });
      }
    }

    await clickConsentIfPresent(page);
if (!panelSelUsed) {
  throw new Error(`waitAny timeout after ${Math.max(15000, 20000)}ms for: ${SEE_ALL_SELECTORS.join(' | ')}`);
}

    // Đợi render trong fallback (chống rỗng giả)
    try {
      await page.waitForFunction((panelSel) => {
        const p = document.querySelector(panelSel);
        if (!p) return false;
        const hasCard = p.querySelector('div.gZ9Ghe, div.jftiEf, div[jscontroller][data-review-id], div[data-review-id]');
        const txt = (p.textContent || '').toLowerCase();
        const empty = /no reviews yet|be the first to review|chưa có đánh giá|sem avaliações/.test(txt);
        return !!hasCard || empty;
      }, { timeout: 15000 }, panelSelUsed);
    } catch (_e) { /* ignore render wait errors */ }

    // Refine to the real scrollbox inside the overlay
    async function resolveScrollbox(panelSel) {
      const sel = await safeEvaluate(page, (panelSel, cardSel) => {
        const root = document.querySelector(panelSel);
        if (!root) return panelSel;
        // candidates inside overlay sorted by scrollHeight
        const cand = Array.from(root.querySelectorAll('div.m6QErb.DxyBCb, div.section-scrollbox, div[role="tabpanel"] div'))
          .concat(root)
          .filter(x => x && x.scrollHeight && x.scrollHeight > x.clientHeight);
        cand.sort((a,b) => (b.scrollHeight - a.scrollHeight));
        const cardSelList = cardSel.split(',').map(s=>s.trim()).filter(Boolean).join(',');
        let picked = null;
        for (const c of cand) {
          const hasCards = cardSelList ? c.querySelector(cardSelList) : null;
          if (hasCards) { picked = c; break; }
        }
        if (!picked) picked = cand[0] || root;
        picked.setAttribute('data-argus-scrollbox','1');
        return 'div[data-argus-scrollbox="1"]';
      }, panelSel, CARD_SELECTOR_CSV);
      return sel;
    }

    // ---- Scroll logic: dừng khi không tăng thêm item và không tăng chiều cao
await expandAllMore(page, panelSelUsed);
async function scrollPanelToEnd() {
  let steps = 0, lastCount = 0, lastHeight = 0, stagnant = 0;
  while (steps < SCROLL_STEPS) {
    const info = await safeEvaluate(page, (panelSel) => {
      const panel = document.querySelector(panelSel);
      if (!panel) return { count: 0, height: 0, ok: false };
      const items = panel.querySelectorAll('div.jftiEf, div[jscontroller][data-review-id]');
      panel.scrollTo(0, panel.scrollHeight);
      return { count: items.length, height: panel.scrollHeight, ok: true };
    }, panelSelUsed);

    steps++;
    jlog("DEBUG", "scroll_step", { step: steps, count: info.count, height: info.height });
    await sleepCompat(page, SCROLL_PAUSE);

    if (!info.ok) break;
    if (info.count === lastCount && info.height === lastHeight) stagnant++;
    else stagnant = 0;

    // Dừng nếu 2 vòng không tăng + đã vượt 60% số bước
    if (stagnant >= 2 && steps > Math.max(5, Math.floor(SCROLL_STEPS*0.6))) break;

    lastCount = info.count;
    lastHeight = info.height;
  }
  jlog("INFO", "scroll_complete", { steps, finalItems: lastCount, finalHeight: lastHeight });
}
    await scrollPanelToEnd();

    // Expand truncated "More" reviews where possible
            await safeEvaluate(page, (panelSel) => {
          const panel = document.querySelector(panelSel);
          if (!panel) return;
          const btns = panel.querySelectorAll('button[aria-label^="Full review"], button[aria-label^="More"], button[jsaction*="pane.review.expandReview"]');
          btns.forEach(b => { try { b.click(); } catch (_e) { /* ignore button click errors */ } });
        }, panelSelUsed);
    await sleepCompat(page, 500);

    // ---- Extraction
    const reviews = await safeEvaluate(page, (panelSel) => {
      const panel = document.querySelector(panelSel);
      if (!panel) return [];
      // unified card selectors; include gZ9Ghe-variant
      const cards = Array.from(panel.querySelectorAll('div.gZ9Ghe, div.jftiEf, div[jscontroller][data-review-id], div[data-review-id]'));
      const out = [];
      for (const card of cards) {
        // id
        let id = card.getAttribute('data-review-id')
              || (card.querySelector('[data-review-id]') && card.querySelector('[data-review-id]').getAttribute('data-review-id'))
              || "";
        // user
        let user = "";
        const u1 = card.querySelector('a[href*="contrib"]');
        if (u1 && u1.textContent) user = u1.textContent.trim();
        if (!user) {
          const u2 = card.querySelector('.d4r55'); // frequent class
          if (u2) user = u2.textContent.trim();
        }
        // rating
        let rating = null;
        const rEl = card.querySelector('span[aria-label*="star"]') || card.querySelector('div[aria-label*="star"]');
        if (rEl) {
          const m = (rEl.getAttribute('aria-label') || '').match(/([0-9]+(?:\.[0-9])?)/);
          if (m) rating = parseFloat(m[1]);
        }
        // date
        let date = "";
        const d1 = card.querySelector('span[class*="rsqaWe"], span[class*="dehysf"], span[class*="xRkPPb"]');
        if (d1) date = d1.textContent.trim();
        // text
        let text = "";
        const t1 = card.querySelector('span[class*="wiI7pd"]'); // new UI
        const t2 = card.querySelector('span[jsname="bN97Pc"]');  // full text hidden
        const t3 = card.querySelector('span[jsname="fbQN7e"]');  // short text
        if (t2 && t2.textContent.trim()) text = t2.textContent.trim();
        else if (t1 && t1.textContent.trim()) text = t1.textContent.trim();
        else if (t3 && t3.textContent.trim()) text = t3.textContent.trim();

        out.push({ review_id: id, user, rating, date, text });
      }
      return out;
    }, panelSelUsed);

    const dedup = new Map();
    for (const r of reviews) {
      const key = r.review_id || (r.user + '|' + r.date + '|' + r.text);
      if (!dedup.has(key)) dedup.set(key, r);
    }
    const review_data = Array.from(dedup.values());
    jlog("INFO", "extracted", { count: review_data.length });

    result.status = "SUCCESS";
    result.review_data = review_data;
    } // Close the fallback if block

  } catch (err) {
    result.error_message = String(err?.message || err);
    result.error_stack = String(err?.stack || "");
    jlog("ERROR", "extract_fail", { error: result.error_message });
    if (DEBUG_SNAPSHOT) {
      try {
        const snapName = `debug_${Date.now()}`;
        const screenshotPath = path.join(path.dirname(path.resolve(outPath)), `${snapName}.png`);
        const htmlPath = path.join(path.dirname(path.resolve(outPath)), `${snapName}.html`);
        const p = page || (await (await browser.pages())[0]);
        if (p) {
          await p.screenshot({ path: screenshotPath, fullPage: true }).catch(()=>{});
          const html = await p.content().catch(()=>"<html></html>");
          fs.writeFileSync(htmlPath, html, 'utf8');
          result.screenshot = path.relative(process.cwd(), screenshotPath).replace(/\\/g,'/');
          result.html_snapshot = path.relative(process.cwd(), htmlPath).replace(/\\/g,'/');
        }
      } catch(_e) { /* ignore debug snapshot errors */ }
    }
  } finally {
    // Cleanup route handlers to prevent memory leaks
    try {
      if (page) {
        if (page.__argusRouteBound) {
          // routeAll handles cleanup automatically via WeakSet
          page.__argusRouteBound = false;
        }
        page.removeAllListeners();
      }
    } catch (_e) { /* ignore cleanup errors */ }
    
    try { await browser.close(); } catch (_e) { /* ignore browser close errors */ }
  }

  // Không còn "SUCCESS rỗng" và snapshot khi rỗng
  if ((result.review_data?.length || 0) === 0) {
    result.status = "EMPTY";
    // chụp snapshot ngay cả khi không lỗi
    if (DEBUG_SNAPSHOT) {
      try {
        const snapName = `debug_${Date.now()}`;
        const screenshotPath = path.join(path.dirname(path.resolve(outPath)), `${snapName}.png`);
        const htmlPath = path.join(path.dirname(path.resolve(outPath)), `${snapName}.html`);
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(()=>{});
        const html = await page.content().catch(()=>"<html></html>");
        fs.writeFileSync(htmlPath, html, 'utf8');
        result.screenshot   = path.relative(process.cwd(), screenshotPath).replace(/\\/g,'/');
        result.html_snapshot= path.relative(process.cwd(), htmlPath).replace(/\\/g,'/');
        jlog("INFO","zero_rows_snapshot",{ screenshot: result.screenshot, html: result.html_snapshot });
      } catch (_e) { /* ignore snapshot errors */ }
    }
  }

  // Write payload
  try {
    fs.writeFileSync(path.resolve(outPath), JSON.stringify(result, null, 2), 'utf8');
    jlog("INFO", "payload_written", {
      out: outPath,
      rows: (result.review_data||[]).length,
      screenshot: result.screenshot || "",
      html: result.html_snapshot || ""
    });
  } catch (e) {
    jlog("ERROR", "payload_write_error", { error: String(e) });
    process.exitCode = 1;
  }

  jlog("INFO","final_rows",{ count: (result.review_data||[]).length, status: result.status });

  jlog("INFO", "process_finished");
}

main().catch(err => {
  jlog("CRITICAL", "fatal", { error: String(err) });
  process.exit(1);
});