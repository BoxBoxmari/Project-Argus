/**
 * Argus Userscript entry.
 * Responsibilities:
 * - Provide UI to collect place URLs and export as txt
 * - Manage progress state with hard reset capability
 * - Avoid double-counting discovered links
 */

// Argus KV helpers (Tampermonkey)
const NS = 'argus';
const K = (k: string) => `${NS}::${k}`;
const kv = {
  async get(k: string, def: any = null){ const v = await GM_getValue(K(k)); return v ?? def; },
  async set(k: string, v: any){ await GM_setValue(K(k), v); },
  async del(k: string){ await GM_deleteValue(K(k)); },
  async keys(){ return (await GM_listValues()).filter(k => k.startsWith(NS + '::')); }
};
const nowISO = () => new Date().toISOString();
let RUN_ID = `us-${nowISO()}`;

// Enhanced selector configuration with fallbacks
const SELS = {
  panel: [
    '.m6QErb',
    '[role="feed"][aria-label*="review"]',
    'div[aria-label*="All reviews"] .m6QErb',
    'div[aria-label*="Đánh giá"] .m6QErb'
  ],
  review: [
    'div[data-review-id]',
    'div[role="article"][data-review-id]',
    'div[data-review-id][jsaction]'
  ],
  moreBtn: [
    'button[jsaction*="more"]',
    'span[role="button"][jsaction*="more"]',
    'button[aria-label*="More"]',
    'button[aria-label*="Xem thêm"]'
  ]
};

function qsAny(list: string[], root?: Element | Document){ 
  for (let i=0;i<list.length;i++){ 
    const el=(root||document).querySelector(list[i]); 
    if (el) return el; 
  } 
  return null; 
}

function qsaCount(list: string[]){ 
  for (let i=0;i<list.length;i++){ 
    const n=document.querySelectorAll(list[i]).length; 
    if (n) return {n, sel:list[i]}; 
  } 
  return {n:0, sel:list[0]}; 
}

type ArgusState = {
  discovered: Set<string>;
};
const state: ArgusState = { discovered: new Set() };

function resetProgressHard() {
  try {
    // full wipe for any relevant keys
    (typeof GM_listValues === 'function' ? GM_listValues() : []).forEach(k => {
      if (/^argus\.progress|^progress:|^https?:\/\//i.test(k) || /::partial$/.test(k)) {
        GM_deleteValue(k);
      }
    });
  } catch {}
  state.discovered.clear();
}

function addDiscovered(url: string) {
  // no cumulative increments; only add if new
  if (!state.discovered.has(url)) {
    state.discovered.add(url);
    GM_setValue('argus.progress.links.discovered', state.discovered.size);
  }
}

// Enhanced scroll function with controlled scrolling and More button clicking
function tickScroll(){
  const p = qsAny(SELS.panel);
  if (!p) return;

  const before = (p as HTMLElement).scrollTop;
  // cuộn xuống có kiểm soát để trigger lazy load
  (p as HTMLElement).scrollTop = Math.min((p as HTMLElement).scrollTop + 256, (p as HTMLElement).scrollHeight - (p as HTMLElement).clientHeight);
  try{ p.dispatchEvent(new Event('scroll', {bubbles:true})); }catch(e){}

  // luôn thử click các nút "More"
  const more = qsAny(SELS.moreBtn, p as Element);
  if (more) { try{ (more as HTMLElement).click(); }catch(e){} }

  // đảm bảo tail vào viewport
  const tail = (p as HTMLElement).lastElementChild;
  try{ tail && (tail as HTMLElement).scrollIntoView && (tail as HTMLElement).scrollIntoView({block:'end'}); }catch(e){}

  // nếu kẹt, giật ngược nhẹ rồi cuộn tiếp
  if ((p as HTMLElement).scrollTop === before && (p as HTMLElement).scrollHeight > (p as HTMLElement).clientHeight){
    (p as HTMLElement).scrollTop = Math.max(0, (p as HTMLElement).scrollTop - 128);
    try{ p.dispatchEvent(new Event('scroll', {bubbles:true})); }catch(e){}
  }
}

(function initUI(){
  const panel = document.createElement('div');
  panel.id = 'argus-panel';
  panel.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;background:#0b3; color:#fff;padding:10px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.2); font: 12px/1.4 system-ui';
  panel.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px">Argus Control</div>
    <button id="argus-reset">Reset Progress</button>
    <button id="argus-export">Export URLs</button>
    <div id="argus-stats" style="margin-top:6px">Discovered: <span id="argus-count">0</span></div>
  `;
  document.body.appendChild(panel);

  document.getElementById('argus-reset')?.addEventListener('click', () => {
    resetProgressHard();
    document.getElementById('argus-count')!.textContent = '0';
  });
  document.getElementById('argus-export')?.addEventListener('click', () => {
    const blob = new Blob([Array.from(state.discovered).join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'places.txt' });
    a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
  });
})();

// Example hook to collect links (fill your own strategy)
function collectPlaceLinks() {
  document.querySelectorAll('a[href*="google.com/maps/place"]').forEach(a => {
    const href = (a as HTMLAnchorElement).href.split('&authuser=')[0];
    addDiscovered(href);
    const el = document.getElementById('argus-count');
    if (el) el.textContent = String(GM_getValue('argus.progress.links.discovered', 0));
  });
}

async function recomputeProgressFromStore(){
  const keys = await kv.keys();
  const urlKeys = keys.filter(k => k.includes('queue:url:'));
  const doneKeys = keys.filter(k => k.includes('done:url:'));
  return {
    links: {
      discovered: urlKeys.length,
      done: doneKeys.length
    }
  };
}

async function updateProgress(partial: any){
  const base = await kv.get('progress', {links:{discovered:0,done:0}});
  const next = {...base, ...partial};
  await kv.set('progress', next);
  renderProgress(next);
}

async function clearStorageAll(){
  // Delete GM_* keys
  const all = await GM_listValues();
  for (const k of all) await GM_deleteValue(k);
  // Browser storages
  try{ localStorage.clear(); }catch(e){}
  try{ sessionStorage.clear(); }catch(e){}
  // IndexedDB (best-effort)
  try{ (indexedDB as any).databases && (await (indexedDB as any).databases()).forEach((db: any) => indexedDB.deleteDatabase(db.name)); }catch(e){}
  await kv.set('progress',{links:{discovered:0,done:0}});
  console.info('[ARGUS] storage cleared at', nowISO());
}

function logEvent(type: string, payload: any){
  const rec = JSON.stringify({ts: nowISO(), run_id: RUN_ID, type, ...payload});
  console.log('[ARGUS]', rec);
}

function renderProgress(progress: any) {
  // Placeholder for progress rendering
  const el = document.getElementById('argus-count');
  if (el) el.textContent = String(progress.links?.discovered || 0);
}

// Enhanced progress tracking with DOM growth monitoring and BroadcastChannel
(function startPeriodicChunkEmitter(){
  try {
    const TASK_KEY = (function(){ try{ return new URLSearchParams((location.hash||'').replace(/^#/,'')).get('argusKey') || location.href; }catch{ return location.href; } })();
    let last = 0;
    if ((window as any).__argusChunkIv__) clearInterval((window as any).__argusChunkIv__);
    (window as any).__argusChunkIv__ = setInterval(async () => {
      try {
        const got = qsaCount(SELS.review);
        const n = got.n;
        if (n > last) {
          try { await GM_setValue('progress:' + TASK_KEY, { count: n, ts: Date.now() }); } catch(e){}
          try {
            (window as any).__argusBC__ = (window as any).__argusBC__ || new BroadcastChannel('argus:progress');
            (window as any).__argusBC__.postMessage({ t: Date.now(), type: 'chunk', key: TASK_KEY, count: n, sel: got.sel });
          } catch (e) {}
          last = n;
        }
      } catch (e) {}
    }, 800);
    console.log('[Argus][Trace] chunk-emitter armed');
  } catch (e) { console.log('[Argus][Trace] chunk-emitter failed', e); }
})();

// Enhanced parser function with robust selectors and translation handling
function parseOne(el: Element){
  try{
    const id = el.getAttribute('data-review-id') || el.id || '';
    if (!id) return null;

    const ratingEl = el.querySelector('[aria-label*="star"] ,[role="img"][aria-label*="star"]');
    const textEl   = el.querySelector('[data-review-text], .qdXAlf, .wiI7pd, span[jsname]');
    const authorEl = el.querySelector('a[href*="contrib"], .d4r55, .WKxvr');
    const timeEl   = el.querySelector('span[class*="rsqaWe"], .rsqaWe, .dehysf');

    // xử lý toggle dịch
    const seeOriginal = el.querySelector('a[href][data-ved][jsname][aria-label*="See original"], a[href][aria-label*="Xem bản gốc"]');
    try{ seeOriginal && (seeOriginal as HTMLElement).click(); }catch(e){}

    const rating = ratingEl ? (parseFloat((ratingEl.getAttribute('aria-label')||'').replace(/[^0-9.]/g,''))||null) : null;
    const text   = textEl ? textEl.textContent?.trim() || '' : '';
    const author = authorEl ? authorEl.textContent?.trim() || '' : '';
    const time   = timeEl ? timeEl.textContent?.trim() || '' : '';

    return { id, rating, text, author, time };
  }catch(e){ return null; }
}

// Start scroll automation
setInterval(tickScroll, 1200);
setInterval(collectPlaceLinks, 1500);
