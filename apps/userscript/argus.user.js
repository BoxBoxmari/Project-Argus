// ==UserScript==
// @name         Project Argus Master Scraper
// @namespace    http://tampermonkey.net/
// @version      46.0.0
// @description  The definitive, fully restored, feature-complete, self-healing, and robust hybrid system for Google Maps data collection.
// @author       Koon Wang
// @match        *://*.google.com/maps*
// @match        *://*.google.com.vn/maps*
// @match        *://*.google.com/maps/place/*
// @match        *://*.google.com.vn/maps/place/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_openInTab
// @grant        GM_addStyle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=maps.google.com
// @note         Patch: reset progress early + SERP no-pan + SERP fast-miner + debounced progress handler
// ==/UserScript==

// ------------------------------------------------------------------------------------
// [Argus][Trace] extract: state & KV helpers
// ------------------------------------------------------------------------------------
(function(){
  if (!window.__argusKV) {
    window.__argusKV = {
      get(k, d){ try { return typeof GM_getValue==='function' ? GM_getValue(k, d) : (JSON.parse(localStorage.getItem(k)) ?? d); } catch { return d; } },
      set(k, v){ try { return typeof GM_setValue==='function' ? GM_setValue(k, v) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
    };
  }

  const __argusKV = window.__argusKV;
  const __argusExtract = (window.__argusExtract = window.__argusExtract || {});
  const S = { IDLE:'IDLE', RUNNING:'RUNNING', PAUSED:'PAUSED', STOPPED:'STOPPED', DONE:'DONE' };
  __argusExtract.S = S;

  __argusExtract.getState = () => __argusKV.get('argus.extract.state', S.IDLE);
  __argusExtract.setState = (st) => { __argusKV.set('argus.extract.state', st); console.log('[Argus][Trace] extract:state', st); };

  // Queue persisted: {pending:[], seenKeys:[], total:int}
  __argusExtract.getQ = () => __argusKV.get('argus.extract.queue', { pending:[], seenKeys:[], total:0 });
  __argusExtract.setQ = (q) => __argusKV.set('argus.extract.queue', q);

  // Progress persisted + tween render (đã có ở bundle trước, gọi lại cho chắc)
  window.__argusUI = window.__argusUI || {};
  const __argusUI = window.__argusUI;
  if (typeof __argusUI.renderProgressFromKV !== 'function') {
    let rafId=0, shown={collected:0,total:0};
    __argusUI.renderProgressFromKV = function(){
      const kv = __argusKV.get('argus.progress', { collected:0, total:0 });
      cancelAnimationFrame(rafId);
      const a = { ...shown }, b = { ...kv }, t0 = performance.now(), DUR = 240;
      (function step(ts){
        const k=Math.min(1,(ts-t0)/DUR);
        shown.collected = Math.round(a.collected + (b.collected-a.collected)*k);
        shown.total     = Math.round(a.total     + (b.total    -a.total    )*k);
        try { if (typeof window.renderProgress==='function') window.renderProgress(shown); } catch { /* ignore */ }
        if (k<1) rafId=requestAnimationFrame(step);
      })(performance.now());
    };
  }
})();

/* global GM, GM_getValue, GM_setValue, GM_deleteValue, GM_listValues, GM_openInTab, GM_addStyle, GM_addValueChangeListener, unsafeWindow, Sentinel, ARGUS_BUS */

(function() {
    'use strict';
/* eslint no-undef: 0 */

// ===== Constants Namespaces =====
const CH = {
  START: 'ARGUS_AUTOSTART',
  PROGRESS: 'ARGUS_PROGRESS',
  COORD: 'ARGUS_COORD',
  LOGS: 'ARGUS_LOGS',
  DATA: 'ARGUS_DATA'
};
const KV = {
  URLQ: 'urlQueue',
  PROG: 'argus.progress',
  PROG_LINKS: 'argus.progress.links',
  PROG_REVIEWS: 'argus.progress.reviews',
  TOTAL_EXPECT: 'totalExpectedReviews',
  MAILBOX: 'ARGUS_MAILBOX',
  VALBUS: 'ARGUS_VALBUS'
};

// =================== [Argus][Trace] globals & polyfills ===================
/* eslint-disable no-unused-vars */
window.__ARGUS__ = window.__ARGUS__ || {};
const __gmOpenInTab = (url, opts={active:false, insert:false}) => {
  try { return (typeof GM!=='undefined' && GM.openInTab) ? GM.openInTab(url, opts) : (typeof GM_openInTab==='function' ? GM_openInTab(url, opts) : window.open(url, '_blank', 'noopener,noreferrer')); }
  catch { return window.open(url, '_blank', 'noopener,noreferrer'); }
};
const __gmGet = (k, d) => (typeof GM_getValue === 'function' ? GM_getValue(k, d) : Promise.resolve(d));
const __gmSet = (k, v) => (typeof GM_setValue === 'function' ? GM_setValue(k, v) : Promise.resolve());
const __gmList = () => (typeof GM_listValues === 'function' ? GM_listValues() : Promise.resolve(Object.keys(localStorage)));

// Storage Adapter (for future Go/IndexedDB port)
const Storage = {
  async get(k, def = null) { try { const v = await GM_getValue(k); return (v == null ? def : v); } catch (e) { return def; } },
  async set(k, v) { try { await GM_setValue(k, v); } catch { /* ignore */ } },
  async del(k) { try { await GM_deleteValue(k); } catch { /* ignore */ } },
  async keys() { try { return await GM_listValues(); } catch { return []; } },
};

const ARGUS_CFG = Object.assign({
  PROGRESS_CHUNK_MS: 800,
  BG_SCROLL_STEP: 1200,
  BG_SCROLL_BURST: 2,
  IDLE_BACKOFF_MS_MIN: 1500,
  IDLE_BACKOFF_MS_MAX: 4500,
  CONCURRENCY: 4,
}, (window.ARGUS_CFG||{}));
// =================== [/Argus][Trace] ======================================

// ------------------------------------------------------------------------------------
// [Argus][Trace] extract: controls mount
// ------------------------------------------------------------------------------------
(function ensureControls(){
  function el(tag, attrs){ const n=document.createElement(tag); if(attrs) Object.keys(attrs).forEach(k=>n.setAttribute(k, attrs[k])); return n; }
  function injectCSS(css){ const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s); }
  function $(sel){ return document.querySelector(sel); }

  const host = document.querySelector('#argus-toolbar') || document.body;
  if (!host || document.getElementById('argus-extract-controls')) return;

  const bar = el('div',{class:'argus-toolbar', role:'toolbar','aria-label':'Argus Controls'});
  bar.innerHTML = `
  <div class="grp">
    <button id="argusImport" title="Import Link (I)">Import Link</button>
    <button id="argusStart"  title="Start/Resume (S)">Start/Resume</button>
    <button id="argusPause"  title="Pause (P)">Pause</button>
    <button id="argusStop"   title="Stop (X)">Stop</button>
    <button id="argusFinish" title="Finish (F)">Finish</button>
    <button id="argusNew"    title="New Session (R)">New</button>
  </div>
  <div class="grp">
    <span id="argusState">State: IDLE</span>
    <div class="argus-progress"><div class="bar" id="argusPBar"></div></div>
    <span class="metric" id="argusPText">0 / 0</span>
  </div>`;
  host.appendChild(bar);
  injectCSS(`
.argus-toolbar{position:fixed;top:12px;left:12px;z-index:999999;display:flex;gap:12px;align-items:center;background:#111;color:#fff;padding:8px 12px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);font:500 12px/1.2 Inter,system-ui;}
.argus-toolbar .grp{display:flex;gap:8px;align-items:center}
.argus-toolbar button{background:#1b1b1b;color:#fff;border:1px solid #2a2a2a;border-radius:8px;padding:6px 10px;cursor:pointer}
.argus-toolbar button:hover{border-color:#00338D;box-shadow:0 0 0 2px rgba(0,51,141,.25)}
.argus-progress{width:160px;height:6px;background:#2a2a2a;border-radius:99px;overflow:hidden}
.argus-progress .bar{height:100%;width:0%;background:#00338D;transition:width .25s ease}
.argus-toolbar .metric{opacity:.9}
`);

  function setStateLabel(){
    const el = document.getElementById('argusState'); if (!el) return;
    try { el.textContent = 'State: ' + (window.__argusExtract && window.__argusExtract.getState ? window.__argusExtract.getState() : 'N/A'); } catch { el.textContent = 'State: N/A'; }
  }
  setStateLabel();

  // Bind actions to existing handlers
  $('#argusImport').onclick = importSingleLinkPrompt;
  $('#argusStart').onclick  = extractStart;
  $('#argusPause').onclick  = extractPause;
  $('#argusStop').onclick   = extractStop;
  $('#argusFinish').onclick = extractFinish;

  // New Session button
  const btnNewSession = $('#argusNew');
  btnNewSession.onclick = async () => {
    try {
      if (window.hardResetProgress) {
        await window.hardResetProgress({ includeQueue: true }); // reset cả queue nếu muốn bắt đầu sạch
      }
      console.log('[Argus][Trace] progress:user:hard-reset');
    } catch(e){/*ignore*/}
  };

  // Shortcuts: Ctrl+Alt+[I,S,P,X,F,R]
  window.addEventListener('keydown', function(ev){
    try{
      if (!ev.ctrlKey || !ev.altKey) return;
      var key = (ev.key||'').toLowerCase();
      if (key==='i') { importSingleLinkPrompt(); ev.preventDefault(); }
      if (key==='s') { extractStart(); ev.preventDefault(); }
      if (key==='p') { extractPause(); ev.preventDefault(); }
      if (key==='x') { extractStop(); ev.preventDefault(); }
      if (key==='f') { extractFinish(); ev.preventDefault(); }
      if (key==='r') { btnNewSession.click(); ev.preventDefault(); }
    }catch(e){ /* ignore */ }
  });

  // Render progress from KV into toolbar bar/text
  function renderProgress(ui){
    try{
      const pct = (ui.total>0)? Math.min(100, Math.round((ui.collected/ui.total)*100)) : 0;
      const bar = document.getElementById('argusPBar'); if (bar) bar.style.width = pct+'%';
      const txt = document.getElementById('argusPText'); if (txt) txt.textContent = `${ui.collected} / ${ui.total}`;
    }catch(e){ /* ignore */ }
  }

  try{ if (typeof window.refreshProgressFromKV==='function') window.refreshProgressFromKV(); }catch(e){ /* ignore */ }
})();

// ------------------------------------------------------------------------------------
// [Argus][Trace] import: single link (+normalize + de-dupe)
// ------------------------------------------------------------------------------------
function normalizePlaceKey(href){
  try {
    var u = new URL(href);
    if (u.searchParams.has('q') && String(u.searchParams.get('q')||'').startsWith('place_id:')) {
      return u.searchParams.get('q');
    }
    if (u.pathname.indexOf('/maps/place/') !== -1) {
      var p = u.pathname.split('/data=')[0].replace(/@[^/]+/,'');
      return 'path:' + p;
    }
    return 'url:' + u.origin + u.pathname;
  } catch { return String(href||'').trim(); }
}

function importSingleLinkPrompt(){
  var s = window.prompt('Paste a Google Maps Place URL or place_id:*');
  if (!s) return;
  var href = String(s||'').trim();
  if (/^place_id:/i.test(href)) href = 'https://www.google.com/maps/search/?q=' + encodeURIComponent(href);
  var key = normalizePlaceKey(href);

  var q = (window.__argusExtract && window.__argusExtract.getQ) ? window.__argusExtract.getQ() : { pending:[], seenKeys:[], total:0 };
  var seen = new Set(q.seenKeys||[]);
  if (seen.has(key)) { try{ console.log('[Argus][Trace] import:single dup-skip', { key: key }); }catch(e){ /* ignore */ } return; }

  q.pending.push({ href: href, key: key, t: Date.now() });
  seen.add(key); q.seenKeys = Array.from(seen);
  q.total = (q.total|0) + 1;
  window.__argusExtract && window.__argusExtract.setQ && window.__argusExtract.setQ(q);

  // progress: use links namespace, not reviews
  const linksPg = (window.__argusKV?.get('argus.progress.links', { discovered: 0, total: 0 })) || { discovered: 0, total: 0 };
  linksPg.discovered += 1;
  linksPg.total = Math.max(linksPg.total|0, q.total|0);
  window.__argusKV?.set('argus.progress.links', linksPg);

  // do NOT touch reviews progress here
  // window.__argusKV.set('argus.progress', ...)  // remove this old line
  try { window.__argusUI && typeof window.__argusUI.renderProgressFromKV==='function' && window.__argusUI.renderProgressFromKV(); } catch (e) { /* ignore */ }

  try{ console.log('[Argus][Trace] import:single ok', { key: key, href: href }); }catch{ /* ignore */ }
  try{
    if (window.__argusExtract && window.__argusExtract.getState && window.__argusExtract.S && window.__argusExtract.getState()===window.__argusExtract.S.IDLE) {
      if (typeof extractStart==='function') extractStart();
    }
  }catch(e){ /* ignore */ }
}

// ------------------------------------------------------------------------------------
// [Argus][Trace] extract: controls impl
// ------------------------------------------------------------------------------------
var __argusMiner = { armed:false, mo:null, panel:null };

function extractStart(){
  try{
    if (!window.__argusExtract) return;
    var st = window.__argusExtract.getState();
    if (st===window.__argusExtract.S.DONE || st===window.__argusExtract.S.STOPPED) { console.log('[Argus][Trace] extract:start ignored (terminal state)', st); return; }
    window.__argusExtract.setState(window.__argusExtract.S.RUNNING);
    armLinksMiner();
  }catch(e){ /* ignore */ }
}

function extractPause(){
  try{
    if (!window.__argusExtract) return;
    var st = window.__argusExtract.getState();
    if (st!==window.__argusExtract.S.RUNNING) return;
    window.__argusExtract.setState(window.__argusExtract.S.PAUSED);
    if (__argusMiner.mo) { try{ __argusMiner.mo.disconnect(); }catch(e){ /* ignore */ } __argusMiner.mo=null; }
    console.log('[Argus][Trace] extract:pause');
  }catch(e){ /* ignore */ }
}

function extractFinish(){
  try{
    if (__argusMiner.mo) { try{ __argusMiner.mo.disconnect(); }catch(e){ /* ignore */ } __argusMiner.mo=null; }
    window.__argusExtract && window.__argusExtract.setState && window.__argusExtract.setState(window.__argusExtract.S.DONE);
    console.log('[Argus][Trace] extract:finish (no more mining)');
  }catch(e){ /* ignore */ }
}

function extractStop(){
  try{
    if (__argusMiner.mo) { try{ __argusMiner.mo.disconnect(); }catch(e){ /* ignore */ } __argusMiner.mo=null; }
    window.__argusExtract && window.__argusExtract.setState && window.__argusExtract.setState(window.__argusExtract.S.STOPPED);
    window.__argusExtract && window.__argusExtract.setQ && window.__argusExtract.setQ({ pending:[], seenKeys:[], total:0 });
    window.__argusKV?.set('argus.progress.links', { discovered: 0, total: 0 });
    window.__argusKV?.set('argus.progress.reviews', { collected: 0, expected: 0 });
    try { window.__argusUI && typeof window.__argusUI.renderProgressFromKV==='function' && window.__argusUI.renderProgressFromKV(); } catch (e) { /* ignore */ }
    console.log('[Argus][Trace] extract:stop -> queue cleared & progress 0');
  }catch(e){ /* ignore */ }
}

function armLinksMiner(){
  try{
    if (!window.__argusExtract || window.__argusExtract.getState()!==window.__argusExtract.S.RUNNING) return;
    if (__argusMiner.armed && __argusMiner.mo) return;

    var PANEL_SEL = '[role="feed"], .m6QErb, .DxyBCb, .XiKgde';
    var panel = document.querySelector(PANEL_SEL);
    if (!panel) { console.log('[Argus][Trace] miner:panel-missing');
  // [PATCH][Argus][Trace] links-miner:lite-mode
  (function minerLiteFallback(){
    if (window.__ARGUS_LITE_ARMED__) return;
    window.__ARGUS_LITE_ARMED__ = true;

    const LITE_DEADLINE_MS = 6000; // sau 6s panel chưa sẵn sàng thì chuyển chế độ nhẹ
    setTimeout(() => {
      // 1) Giảm tải hình ảnh để tăng tốc
      const css = `
        .m6QErb img, .DxyBCb img, [role="feed"] img { display:none !important; }
        video, iframe { display:none !important; }`;
      const style = document.createElement('style'); style.textContent = css;
      document.documentElement.appendChild(style);

      // 2) Quét link "place" tối giản
      const scope = document.querySelector('[role="feed"]') || document.body;
      const anchors = [...scope.querySelectorAll('a[href*="/maps/place/"]')];
      const urls = anchors.map(a => a.href.split('?')[0]).filter(Boolean);
      console.log('[Argus][Trace] links-miner:lite-emit', { n: urls.length });

      if (urls.length) {
        window.postMessage({
          type: 'argus:progress',
          sid: window.__ARGUS_SESSION_ID__,
          ids: urls
        }, '*');
      }
    }, LITE_DEADLINE_MS);
  })();
  return; }
    __argusMiner.panel = panel;

    var q0 = window.__argusExtract.getQ();
    var seen = new Set(q0.seenKeys||[]);
    var snapTimer=null;

    function snapshot(){
      if (window.__argusExtract.getState()!==window.__argusExtract.S.RUNNING) return;
      var anchors = panel.querySelectorAll('a[href*="/maps/place/"]');
      var batch = [];
      for (var i=0;i<anchors.length;i++){
        var a = anchors[i];
        var href = String(a.href||'').split('#')[0];
        var key = normalizePlaceKey(href);
        if (!seen.has(key)) { seen.add(key); batch.push({ href:href, key:key }); }
      }
      if (!batch.length) return;

      var q = window.__argusExtract.getQ();
      var curSeen = new Set(q.seenKeys||[]);
      var added = 0;
      for (var j=0;j<batch.length;j++){
        var it = batch[j];
        if (curSeen.has(it.key)) continue;
        q.pending.push({ href:it.href, key:it.key, t:Date.now() });
        curSeen.add(it.key); added++;
      }
      q.seenKeys = Array.from(curSeen);
      q.total = (q.total|0) + added;
      window.__argusExtract.setQ(q);

      var lk = window.__argusKV.get('argus.progress.links', { discovered:0, total:0 });
      lk.discovered += added; lk.total = Math.max(lk.total|0, q.total|0);
      window.__argusKV.set('argus.progress.links', lk);
      try { window.__argusUI && typeof window.__argusUI.renderProgressFromKV==='function' && window.__argusUI.renderProgressFromKV(); } catch (e) { /* ignore */ }

      console.log('[Argus][Trace] collector:chunk (miner)', { added: added, total:q.total });
    }

    function debouncedSnapshot(){ clearTimeout(snapTimer); snapTimer = setTimeout(snapshot, 120); }

    var mo = new MutationObserver(function(){ if (window.__argusExtract.getState()===window.__argusExtract.S.RUNNING) debouncedSnapshot(); });
    mo.observe(panel, { childList:true, subtree:true });
    __argusMiner.mo = mo; __argusMiner.armed = true;

    snapshot();
    console.log('[Argus][Trace] miner:armed');
  }catch(e){ /* ignore */ }
}

    // =================================================================
    // --- I. CONFIGURATION & STATE MANAGEMENT ---
    // =================================================================

    const CONFIG = {
        linkExtractor: {
            scrollablePane: 'div[role="feed"]',
            searchResultItemContainer: 'div[jsaction*="mouseover:pane."][jsaction*="mouseout:pane."]',
            resultLink: 'a[href*="/maps/place/"]',
            reviewCountSelector: 'span.UY7F9',
            endOfResultsKeywords: ["bạn đã xem hết danh sách", "you've reached the end of the list"],
            safetyFuse: 300
        },
        scraper: {
            storeNameSelector: 'h1',
            addressSelector: 'button[data-item-id="address"]',
            reviewsTabSelectors: [
                'button[aria-label*="Reviews"]',
                'button[aria-label*="Đánh giá"]',
                'button[aria-label*="Bài đánh giá"]',
                'button[aria-label*="評價"]',
                'button[aria-label*="Отзывы"]',
                'button[aria-label*="点评"]',
                'button[data-tab-index="1"]',
                'button[data-tab-index="2"]'
            ],
            mainScrollablePanel: 'div[role="main"]',
            reviewItemSelector: 'div[data-review-id]',
            moreButtonSelector: [
              'button[aria-label*="More"]',
              'button.w8nwRe.kyuRq',
              'button[jsname="gxjVle"]',
              '[role="button"][jsaction*="more"]'
            ].join(','),
            authorNameSelector: 'div.d4r55',
            reviewDateSelector: 'span.rsqaWe',
            reviewTextSelector: 'span.wiI7pd',
            starRatingSelector: 'span.kvMYJc',
            detailAttributeContainerSelector: 'div.PBK6be',
            loadingSpinnerSelector: 'div.qjESne.veYFef',
            // ---- Autosave & ETA tuning ----
            partialSaveEvery: 5,
            partialSaveMinDelta: 10,
            etaEwmaAlpha: 0.6
        },
        orchestrator: {
            maxConcurrentWorkers: Math.min(
              4,
              (navigator.hardwareConcurrency ? Math.max(2, Math.floor(navigator.hardwareConcurrency/2)) : 3)
            ),
            taskDelayMinMs: 2000,
            taskDelayMaxMs: 5000,
            heartbeatIntervalMs: 3000,
            // Separate interval for UI updates for real-time feedback
            uiUpdateIntervalMs: 2000
                }
     };

    /************* ARGUS LOGGING CORE *************/
    const ARGUS_LOG = (() => {
      const LEVELS = { trace:10, debug:20, info:30, warn:40, error:50 };
      const DEFAULT_LEVEL = 'info';
      function createRing(cap=5000) {
        const buf = new Array(cap); let head = 0, size = 0, seq = 0;
        return {
          push(rec){ buf[head] = rec; head = (head+1)%cap; size = Math.min(size+1, cap); seq++; },
          dump(){ const out = []; for (let i=0;i<size;i++){ const idx = (head - 1 - i + cap) % cap; out.push(buf[idx]); } return out; },
          size(){ return size; },
          seq(){ return seq; },
          clear(){ head = 0; size = 0; }
        };
      }
      function lineify(rec){ try { return JSON.stringify(rec); } catch(e){ return JSON.stringify({ ts:Date.now(), lvl:'error', msg:'log_json_fail', err:String(e) }); } }
      const ConsoleSink = { name:'console', min:'debug', write(rec){ try{ const {lvl,msg,ctx}=rec; const f=(lvl==='error'?'error':lvl==='warn'?'warn':lvl==='debug'?'debug':'log'); console[f](`[ARGUS][${lvl}] ${msg}`, ctx||{}); }catch(_){ void 0; } } };
      function MemoryRingSink(cap=5000){ const ring=createRing(cap); return { name:'memory', min:'trace', write(rec){ ring.push(rec); }, export(){ return ring.dump().reverse().map(lineify).join('\n'); }, size(){ return ring.size(); }, clear(){ ring.clear(); } }; }
      function GMChunkedSink(opts={}){
        const keyPrefix = opts.keyPrefix || 'argus.logs';
        const maxRowsPerChunk = opts.maxRowsPerChunk || 20000;
        const maxBytesPerChunk = opts.maxBytesPerChunk || 2000000;
        const maxChunks = opts.maxChunks || 20;
        let buf = []; let bytes = 0; let chunkIdx = 0; let initDone = false;
        async function init(){ if (initDone) return; const idx = await GM_getValue(`${keyPrefix}::idx`, 0); chunkIdx = idx; initDone = true; }
        async function rotate(){ const lines = buf.map(lineify).join('\n'); await GM_setValue(`${keyPrefix}::${String(chunkIdx).padStart(4,'0')}`, lines); await GM_setValue(`${keyPrefix}::ts::${String(chunkIdx).padStart(4,'0')}`, Date.now()); chunkIdx = (chunkIdx + 1) % maxChunks; await GM_setValue(`${keyPrefix}::idx`, chunkIdx); buf = []; bytes = 0; }
        return {
          name:'gmchunk', min:'info',
          async write(rec){ try{ if (!initDone) await init(); const s=lineify(rec); buf.push(rec); bytes += s.length + 1; if (buf.length>=maxRowsPerChunk || bytes>=maxBytesPerChunk){ await rotate(); } }catch(_){ /* ignore */ } },
          async flush(){ try{ if (!initDone) await init(); if (!buf.length) return; const lines = buf.map(lineify).join('\n'); await GM_setValue(`${keyPrefix}::${String(chunkIdx).padStart(4,'0')}`, lines); await GM_setValue(`${keyPrefix}::ts::${String(chunkIdx).padStart(4,'0')}`, Date.now()); chunkIdx = (chunkIdx + 1) % maxChunks; await GM_setValue(`${keyPrefix}::idx`, chunkIdx); buf = []; bytes = 0; }catch(_){ /* ignore */ } },
          async exportAll(){ const chunks=[]; const keys=await GM_listValues(); const re=new RegExp(`^${keyPrefix}::\\d{4}$`); for (const k of keys) if (re.test(k)){ const v=await GM_getValue(k,''); if (v) chunks.push(v); } return chunks.join('\n'); },
          async clearAll(){ const keys=await GM_listValues(); const re=new RegExp(`^${keyPrefix}::(\\d{4}|idx|ts::\\d{4})$`); const ops=[]; for (const k of keys) if (re.test(k)) ops.push(GM_deleteValue(k)); await Promise.all(ops); initDone=false; }
        };
      }
      function BCSink(channelName='ARGUS_LOGS'){ let bc=null; try{ bc=new BroadcastChannel(channelName);}catch(_){ void 0; } return { name:'bc', min:'info', write(rec){ try{ bc && bc.postMessage({type:'log', payload:rec}); }catch(_){ void 0; } } }; }
      function createLogger(config={}){
        const level = config.level || DEFAULT_LEVEL; const levelNum = LEVELS[level] ?? LEVELS[DEFAULT_LEVEL];
        const ctxProvider = config.contextProvider || (()=>({ url: location.href }));
        const sinks = config.sinks || [];
        if (config.captureConsole){ ['log','info','warn','error','debug'].forEach(fn=>{ const orig=console[fn]; console[fn]=function(...args){ try{ logger[fn==='log'?'info':fn](String(args[0]||''), { consoleArgs: args.slice(1) }); }catch(_){ /* ignore */ } try{ orig.apply(console,args);}catch(_){ /* ignore */ } }; }); }
        async function write(rec){ for (const s of sinks){ const minNum = LEVELS[s.min||'trace'] ?? 0; if ((LEVELS[rec.lvl] ?? 999) >= minNum){ try{ await s.write(rec);}catch(_){ /* ignore sink error */ } } } }
        const logger = {
          setLevel(l){ logger.level = l; logger.levelNum = LEVELS[l] ?? levelNum; }, level, levelNum,
          async emit(lvl,msg,extra){ if ((LEVELS[lvl] ?? 999) < logger.levelNum) return; const rec = { ts:Date.now(), lvl, msg, ctx:{ ...ctxProvider(), ...(extra||{}) } }; await write(rec); },
          trace(msg,extra){ return logger.emit('trace', msg, extra); }, debug(msg,extra){ return logger.emit('debug', msg, extra); }, info(msg,extra){ return logger.emit('info', msg, extra); }, warn(msg,extra){ return logger.emit('warn', msg, extra); }, error(msg,extra){ return logger.emit('error', msg, extra); }, sinks
        };
        window.addEventListener('error', (e)=>{ logger.error('unhandled_error', { message:e.message, stack:e.error && e.error.stack }); });
        window.addEventListener('unhandledrejection', (e)=>{ logger.error('unhandled_rejection', { reason:String(e.reason) }); });
        return logger;
      }
      return { createLogger, ConsoleSink, MemoryRingSink, GMChunkedSink, BCSink, LEVELS };
    })();

    /************* ARGUS LOGGING INIT *************/
    const _memSink = ARGUS_LOG.MemoryRingSink(5000);
    const _gmSink  = ARGUS_LOG.GMChunkedSink({ keyPrefix:'argus.logs', maxRowsPerChunk: 20000, maxBytesPerChunk: 1800000, maxChunks: 20 });
    const _bcSink  = ARGUS_LOG.BCSink(CH.LOGS);
    const LOG = ARGUS_LOG.createLogger({
      level: 'info',
      sinks: [ _memSink, _gmSink, _bcSink ],
      contextProvider: ()=>({ url: location.href, page: location.pathname, userAgent: navigator.userAgent }),
      captureConsole: false
    });

    // UI handlers for log export/clear
    async function exportLogsNDJSON(){
      try {
        await _gmSink.flush();
        const ndjson = await _gmSink.exportAll();
        const blob = new Blob([ndjson + '\n' + _memSink.export()], { type:'application/x-ndjson' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = `argus_logs_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.ndjson`;
        a.href = url; a.click();
        setTimeout(()=>URL.revokeObjectURL(url), 5000);
        await LOG.info('export_logs_ok', { bytes: ndjson.length });
      } catch(e){ await LOG.error('export_logs_fail', { err: String(e) }); }
    }
    async function clearAllLogs(){
      try { _memSink.clear(); await _gmSink.clearAll(); await LOG.info('clear_logs_ok'); }
      catch(e){ await LOG.error('clear_logs_fail', { err: String(e) }); }
    }

    /************* ARGUS NETWORK TAP *************/
    (function installNetworkTap(){
      const shouldTap = (url) => /google\.[^/]+\/.*(batchexecute|maps|search|place)/i.test(url||'');
      const extractReviewsIfAny = async (url, bodyText) => {
        try {
          let obj = null; try { obj = JSON.parse(bodyText); } catch(_){ /* ignore */ }
          if (obj && (Array.isArray(obj.reviews) || (obj.result && obj.result.reviews))) {
            const arr = obj.reviews || (obj.result && obj.result.reviews) || [];
            if (arr.length) {
              await LOG.debug('nettap_reviews_json', { url, count: arr.length });
              window.dispatchEvent(new CustomEvent('argus:tap_reviews', { detail: { url, reviews: arr, source:'network' } }));
              return;
            }
          }
          if (/author|rating|review/gi.test((bodyText||'').slice(0, 5000))) {
            await LOG.debug('nettap_reviews_text_hit', { url, bytes: (bodyText||'').length });
          }
        } catch(e){ await LOG.warn('nettap_parse_fail', { url, err:String(e) }); }
      };
      const _fetch = window.fetch;
      window.fetch = async function(input, init){ const res = await _fetch.apply(this, arguments); try{ const url = (typeof input==='string')? input : (input && input.url); if (shouldTap(url)){ const clone=res.clone(); const text=await clone.text(); void extractReviewsIfAny(url, text); } }catch(_){ /* ignore */ } return res; };
      const _open = XMLHttpRequest.prototype.open; const _send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url){ this.__argus_url = url; return _open.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function(body){ this.addEventListener('load', function(){ try{ const url=this.__argus_url||''; if(!shouldTap(url)) return; const text=this.responseText||''; void extractReviewsIfAny(url, text); }catch(_){ /* ignore */ } }); return _send.apply(this, arguments); };
    })();

    /************* ARGUS SCROLL ENGINE *************/
    const SCROLL = (() => {
      const S = { WARMUP:'WARMUP', LOAD_BURST:'LOAD_BURST', VALIDATE:'VALIDATE', BACKOFF:'BACKOFF', COMPLETE:'COMPLETE' };
      const DEF = { warmupMs:800, burstMs:1800, backoffMs:700, plateauRounds:3, maxStepPx:1200, minStepPx:200 };
      function hashStr(s){ let h=5381; for (let i=0;i<s.length;i++) h=((h<<5)+h)+s.charCodeAt(i); return (h>>>0).toString(16); }
      function extractFromItem(el){ try{ const author = el.querySelector('[role="link"][aria-label]')?.getAttribute('aria-label') || el.querySelector('.d4r55')?.textContent?.trim() || ''; const text = el.querySelector('.wiI7pd')?.textContent?.trim() || el.querySelector('.MyEned')?.textContent?.trim() || el.textContent?.trim() || ''; const ratingAttr = el.querySelector('[aria-label*="stars"], [aria-label*="sao"]')?.getAttribute('aria-label') || ''; const rating = parseFloat(((ratingAttr.match(/([0-9]+([.,][0-9])?)/)||[])[1]||'').replace(',','.'))||0; const date = el.querySelector('.rsqaWe')?.textContent?.trim() || el.querySelector('.bp9Aid')?.textContent?.trim() || ''; const id = hashStr([author,rating,date,text.slice(0,64)].join('|')); return { id, author, rating, date, text }; }catch(e){ return null; } }
      function createEngine(opts={}){
        const conf = { ...DEF, ...opts }; const seen=new Set(); const batch=[]; let state=S.WARMUP; let lastCount=0; let plateau=0; let startTs=Date.now(); let container=null; let stop=false; let fps=60;
        function installCSS(){ const css = ` [role="main"] img, .TQf0Ie img, .Fh6Lfb img { display:none !important; visibility:hidden !important; } .m6QErb { contain: content; } `; const s=document.createElement('style'); s.textContent=css; document.documentElement.appendChild(s); }
        function findContainer(){ const cand = document.querySelector('.m6QErb[aria-label*="review"], .m6QErb[aria-label*="đánh giá"]') || document.querySelector('div[aria-label*="Reviews"], div[aria-label*="Đánh giá"]') || document.querySelector('.m6QErb .section-scrollbox'); return cand || null; }
        function collectNew(){ const nodes = container?.querySelectorAll('div[jsaction*="pane.review"], .jJc9Ad, .WMbnJf, div[data-review-id]') || []; let added=0; nodes.forEach(el=>{ const rec=extractFromItem(el); if(!rec) return; if(seen.has(rec.id)) return; seen.add(rec.id); batch.push(rec); added++; }); if (added) { window.dispatchEvent(new CustomEvent('argus:dom_reviews', { detail: { count: added } })); } return added; }
        function stepScroll(){ if(!container) return; const max=conf.maxStepPx, min=conf.minStepPx; const jitter=Math.random()*120; const step=Math.floor(min + (max - min) * (fps>=50?1:fps/60)) + jitter; try{ container.scrollBy({ top: step, left: 0, behavior:'auto' }); }catch(_){ /* ignore */ } }
        function recordFPS(){ let last=performance.now(), frames=0; function loop(now){ frames++; if(now-last>=1000){ fps=frames; frames=0; last=now; } if(!stop) requestAnimationFrame(loop);} requestAnimationFrame(loop); }
        async function flushBatch(){ if(!batch.length) return; const copy=batch.splice(0,batch.length); try{ window.dispatchEvent(new CustomEvent('argus:reviews_batch', { detail: { reviews: copy, source:'dom' } })); await LOG.info('reviews_batch_flush', { count: copy.length }); }catch(e){ await LOG.error('reviews_batch_flush_fail', { err:String(e), count: copy.length }); } }
        async function runLoop(){ installCSS(); recordFPS(); startTs=Date.now(); container=findContainer(); if(!container){ await LOG.error('scroll_container_not_found'); return; }
          while(!stop){ switch(state){
            case S.WARMUP: { stepScroll(); collectNew(); if (Date.now()-startTs>conf.warmupMs){ state=S.LOAD_BURST; startTs=Date.now(); } break; }
            case S.LOAD_BURST: { for(let i=0;i<4;i++) stepScroll(); const add1=collectNew(); if (Date.now()-startTs>conf.burstMs) state=S.VALIDATE; if (add1===0) state=S.VALIDATE; break; }
            case S.VALIDATE: { const nowCount=seen.size; if (nowCount===lastCount) plateau++; else plateau=0; lastCount=nowCount; await flushBatch(); if (plateau>=conf.plateauRounds) state=S.BACKOFF; else state=S.LOAD_BURST; break; }
            case S.BACKOFF: { await new Promise(r=>setTimeout(r, conf.backoffMs + Math.random()*300)); const busy=container.getAttribute('aria-busy')==='true'; const endHint=container.textContent && /no more|hết|không còn|end of|đã hiển thị tất cả/i.test(container.textContent); if (!busy && endHint) { state=S.COMPLETE; break; } state=S.LOAD_BURST; break; }
            case S.COMPLETE: await flushBatch(); stop=true; await LOG.info('scroll_complete', { total: seen.size }); break; }
            await new Promise(r=>setTimeout(r, 80 + Math.random()*40)); }
        }
        return { start(){ stop=false; return runLoop(); }, stop(){ stop=true; }, stats(){ return { seen: seen.size, batch: batch.length }; } };
      }
      return { createEngine };
    })();

    // Hook batch & tap events (pipeline integration points)
    window.addEventListener('argus:reviews_batch', (e)=>{ try{ const d=e && e.detail || {}; /* integrate with existing partial-save if needed */ }catch(_){ /* ignore */ } });
    window.addEventListener('argus:tap_reviews', (e)=>{ try{ const d=e && e.detail || {}; /* integrate with existing partial-save if schema compatible */ }catch(_){ /* ignore */ } });

     let state = {
        isDispatching: false,
        dispatchInterval: null,
        uiUpdateInterval: null, // Interval handle for the UI
        activeWorkers: {},
        inflightProgress: {},
        perf: {},
        expectedByUrl: {}
    };

    // Helper: safe clearInterval returning null to chain-assignment
    function safeClearInterval(ref){ if (ref) { try { clearInterval(ref); } catch { /* ignore */ } } return null; }

    // Cross-tab progress channel
    const BC = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('argus') : null;
    if (BC) {
        BC.onmessage = async (ev) => {
            const msg = ev && ev.data;
            if (!msg || typeof msg !== 'object') return;
            if (msg.type === 'worker_progress') {
                const t = typeof msg.ts === 'number' ? msg.ts : Date.now();
                try {
                    state.inflightProgress = state.inflightProgress || {};
                    state.inflightProgress[msg.url] = msg.count || 0;
                    // ETA/RPM calculation (EWMA)
                    state.perf = state.perf || {};
                    const rec = state.perf[msg.url] || { lastT: null, lastC: 0, rpm: 0, etaSec: null };
                    if (rec.lastT !== null && t > rec.lastT && (msg.count||0) >= rec.lastC) {
                        const dtMin = (t - rec.lastT) / 60000;
                        const dC = (msg.count||0) - rec.lastC;
                        const instRpm = dtMin > 0 ? dC / dtMin : 0;
                        const alpha = (CONFIG && CONFIG.scraper && typeof CONFIG.scraper.etaEwmaAlpha === 'number') ? CONFIG.scraper.etaEwmaAlpha : 0.6;
                        rec.rpm = rec.rpm ? (alpha * instRpm + (1 - alpha) * rec.rpm) : instRpm;
                    }
                    rec.lastT = t;
                    rec.lastC = msg.count || 0;
                    const expected = (state.expectedByUrl && state.expectedByUrl[msg.url]) || 0;
                    if (expected > 0 && rec.rpm > 0) {
                        const remaining = Math.max(0, expected - rec.lastC);
                        rec.etaSec = Math.round((remaining / rec.rpm) * 60);
                    } else { rec.etaSec = null; }
                    state.perf[msg.url] = rec;
                } catch (e) {
                    // ignore
                }
                await updateProgress();
                return;
            }
            if (msg.type === 'worker_done') {
                try {
                    if (state.inflightProgress) delete state.inflightProgress[msg.url];
                    if (state.activeWorkers && state.activeWorkers[msg.url]) {
                        try { state.activeWorkers[msg.url].tab.close(); } catch { /* ignore */ }
                        delete state.activeWorkers[msg.url];
                    }
                } catch (e) { /* ignore */ }
                await updateProgress();
                return;
            }
        };
    }

    // =================================================================
    // --- II. ALL FUNCTION DEFINITIONS ---
    // =================================================================

    // --- Helper Functions ---

    // --- Background execution options (anti-throttling) ---
    const ARGUS_BG = {
        useIframes: true,               // Khuyên dùng trên Firefox + Violentmonkey
        iframePoolId: 'argus-iframe-pool'
    };

    function trace(msg, data) {
        try {
            console.log('[Argus][Trace]', {
                t: new Date().toISOString(), lvl: 'log', msg, data, href: location.href
            });
        } catch (e) { /* ignore */ }
    }

    function ensureIframePool() {
        let pool = document.getElementById(ARGUS_BG.iframePoolId);
        if (!pool) {
            pool = document.createElement('div');
            pool.id = ARGUS_BG.iframePoolId;
            pool.style.cssText = 'position:fixed;inset:auto auto 8px 8px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:2147483647;';
            document.body.appendChild(pool);
        }
        return pool;
    }

    function spawnIframeWorker(openUrl) {
        const pool = ensureIframePool();
        const iframe = document.createElement('iframe');
        iframe.src = openUrl;
        iframe.setAttribute('loading', 'eager');
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-popups');
        iframe.style.cssText = 'width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
        pool.appendChild(iframe);
        return iframe;
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

    function isElementVisible(el) {
        if (!el) return false;
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && window.getComputedStyle(el).visibility !== 'hidden';
    }

    async function waitForAnySelector(selectors, timeout) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && isElementVisible(el)) return el;
            }
            await sleep(250);
        }
        return null;
    }

    async function openAllReviewsRobust(timeout = 25000) {
      const deadline = Date.now() + timeout;
      const trySelectors = [
        'button[aria-label*="reviews"]',
        'a[jsaction*="reviewDialog"]',
        'a[href*="/lrd"]',
        'button[jsname="jVYqke"]',
      ];
      while (Date.now() < deadline) {
        for (const sel of trySelectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); await sleep(1200); }
        }
        if (!document.querySelector('div[data-review-id]')) {
          if (!window.__ARGUS_REVIEW_LANG_SWITCHED__) {
            window.__ARGUS_REVIEW_LANG_SWITCHED__ = true;
            const u = new URL(location.href); u.searchParams.set('hl', 'en'); location.replace(u.toString());
            await sleep(2500); continue;
          }
        }
        if (document.querySelector('div[data-review-id]')) return true;
        await sleep(600);
      }
      return false;
    }

    function getExpectedReviews() {
      const cand = document.querySelector('[aria-label*="reviews"], [aria-label*="Đánh giá"]');
      const txt = cand?.getAttribute('aria-label') || cand?.textContent || '';
      const m = txt.replace(/[,.\s]/g, '').match(/(\d{2,})/);
      return m ? Number(m[1]) : 0;
    }

    /* ===================== ARGUS_HD: Adaptive Human-Drive Scrolling Engine ===================== */
    /* id:ARGUS_HD_HELPERS */

    (function(){
      if (window.__ARGUS_HD_LOADED__) return;
      window.__ARGUS_HD_LOADED__ = true;

      function hd_isScrollable(el){
        try{
          const cs = getComputedStyle(el);
          return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 16;
        }catch(e){ return false; }
      }

      function hd_getCandidates(){
        const out = [];
        try{
          const item = document.querySelector('div[data-review-id], .section-review, div.gws-localreviews__google-review');
          if (item){
            let el = item;
            while(el && el !== document.body){
              if(hd_isScrollable(el)){ out.push(el); break; }
              el = el.parentElement;
            }
          }
          document.querySelectorAll('div[role="dialog"] .m6QErb, div[role="dialog"] .section-scrollbox')
            .forEach(e=>{ if(hd_isScrollable(e)) out.push(e); });
          document.querySelectorAll('div.m6QErb.DxyBCb, div[role="region"].m6QErb, div.section-scrollbox')
            .forEach(e=>{ if(hd_isScrollable(e)) out.push(e); });
          const se=document.scrollingElement;
          if(se && se.scrollHeight > se.clientHeight + 16) out.push(se);
        }catch(e){ /* ignore */ }
        return Array.from(new Set(out));
      }

      function hd_activate(el){
        if(!el) return;
        try{ el.setAttribute('tabindex', el.getAttribute('tabindex')||'0'); }catch(e){ /* ignore */ }
        try{ el.focus({preventScroll:true}); }catch(e){ /* ignore */ }
        try{
          const r=el.getBoundingClientRect(), x=r.left+Math.min(40, r.width*0.25), y=r.top+Math.min(40, r.height*0.25);
          el.dispatchEvent(new MouseEvent('mousemove', {clientX:x, clientY:y, bubbles:true}));
          el.dispatchEvent(new MouseEvent('mouseover', {clientX:x, clientY:y, bubbles:true}));
        }catch(e){ /* ignore */ }
      }

      function hd_emitAssist(el, delta, allowKey){
        try{ el.dispatchEvent(new WheelEvent('wheel', {deltaY:delta||53, bubbles:true, cancelable:true})); }catch(e){ /* ignore */ }
        if (allowKey) { try{ el.dispatchEvent(new KeyboardEvent('keydown', {key:'PageDown', bubbles:true})); }catch(e){ /* ignore */ } }
      }

      async function hd_rAF(){ await new Promise(r=>requestAnimationFrame(r)); }
      async function hd_idle(ms){
        try{
          if ('requestIdleCallback' in window){
            let t=Date.now()+ms;
            await new Promise(r=>requestIdleCallback(r,{timeout:ms}));
            const rem = t-Date.now();
            if (rem>0) await new Promise(r=>setTimeout(r, rem));
          } else {
            await new Promise(r=>setTimeout(r, ms));
          }
        }catch(e){ await new Promise(r=>setTimeout(r, ms)); }
      }

      function hd_observeGrowth(selector, root=document){
        let count = 0;
        try{ count = root.querySelectorAll(selector).length; }catch(e){ count=0; }
        let changed = false;
        const mo = new MutationObserver(()=>{ changed = true; });
        try{ mo.observe(root===document ? document.body : root, { childList:true, subtree:true }); }catch(e){ /* ignore */ }
        const get = ()=>{
          try{ return root.querySelectorAll(selector).length; }catch(e){ return count; }
        };
        const waitGrowth = async (timeout=1500)=>{
          changed = false;
          const t0 = Date.now();
          while(Date.now()-t0 < timeout){
            if(changed){
              const n = get();
              if(n > count){ count = n; return n; }
              changed = false;
            }
            await new Promise(r=>setTimeout(r, 60));
          }
          return get();
        };
        const disconnect = ()=>{ try{ mo.disconnect(); }catch(e){ /* ignore */ } };
        return [get, waitGrowth, disconnect];
      }

      function makeAdaptiveWaiter(root = document) {
        let lastG = 0, lastT = Date.now();
        const base = { min: 600, max: 3000 };
        const getNow = () => (root.querySelectorAll('div[data-review-id]') || []).length;
        return async function waitAdaptive() {
          const t1 = Date.now(), n = getNow();
          const dt = Math.max(300, t1 - lastT);
          const g  = Math.max(0, n - lastG);
          const rps = g * 1000 / dt; // reviews per second
          lastG = n; lastT = t1;
          const delay = rps > 50 ? base.min : rps < 10 ? base.max : 1200;
          await new Promise(r => setTimeout(r, delay));
          return n;
        };
      }

      async function hd_scrollBurst(el, px, allowKey){
        const steps = Math.max(3, Math.min(10, Math.round(Math.abs(px)/160)));
        const per = Math.sign(px) * Math.max(60, Math.floor(Math.abs(px)/steps));
        for(let i=0;i<steps;i++){
          el.scrollTop += per;
          hd_emitAssist(el, per, !!allowKey);
          await hd_rAF();
        }
        try{
          const remain = el.scrollHeight - (el.scrollTop + el.clientHeight);
          if (remain < 64) el.scrollTop = el.scrollHeight;
        }catch(e){ /* ignore */ }
      }

      async function ARGUS_HD_RUN(opts={}){
        const spinnerSel = opts.spinnerSel || 'div[role="progressbar"][aria-busy="true"]';
        const reviewSel = opts.reviewSel || 'div[data-review-id]';
        let candidates = hd_getCandidates();
        if (!candidates.length) return { ok:false, reason:'no-scrollable-container' };
        let idx = 0, panel = candidates[idx];
        hd_activate(panel);

        // Warm-up: stabilize CSS and avoid keydown until initial growth
        const prev = {};
        try{
          prev.sb = panel.style.scrollBehavior; panel.style.scrollBehavior = 'auto';
          prev.sn = panel.style.scrollSnapType; panel.style.scrollSnapType = 'none';
          prev.ob = panel.style.overscrollBehavior; panel.style.overscrollBehavior = 'contain';
        }catch(e){ /* ignore */ }

        const [getCount, waitGrowth, disconnect] = hd_observeGrowth(reviewSel, document);
        const waitAdaptive = makeAdaptiveWaiter(document);
        let last = getCount();
        let growths = 0;

        let stepBase = Math.max(320, Math.floor(panel.clientHeight * 0.95));
        let step = stepBase;
        let idle = 0, loops = 0;
        const MAX_IDLE = opts.maxIdle || 16;
        const OSC_EVERY = 8;
        const JITTER = 0.15;
        const SWITCH_EVERY = 4;
        const WARMUP_MS = opts.warmupMs || 700;
        const WARMUP_LIMIT = opts.warmupGrowths || 1;
        const warmupUntil = Date.now() + WARMUP_MS;

        while (idle < MAX_IDLE){
          const inWarmup = (Date.now() < warmupUntil) || (growths < WARMUP_LIMIT);
          if (loops && loops % OSC_EVERY === 0){
            try{ panel.scrollTop = Math.max(0, panel.scrollTop - Math.floor(panel.clientHeight*0.22)); }catch(e){ /* ignore */ }
            await hd_rAF();
          }
          const factor = 1 + ((Math.random()*2 - 1) * (inWarmup ? JITTER*0.6 : JITTER));
          await hd_scrollBurst(panel, step * factor, /*allowKey*/ !inWarmup);
          try{
            const sp = document.querySelector(spinnerSel);
            if (sp) await hd_idle(250); else await hd_idle(120);
          }catch(e){ await hd_idle(150); }
          try{ document.querySelectorAll((opts.moreSel)||'[role="button"][jsaction*="more"]').forEach(b=>b.click()); }catch(e){ /* ignore */ }
          const cur = await waitAdaptive();

          if (cur > last){
            try{ updateLog(`[HD] growth ${last}→${cur} (step≈${step}|panel=${panel.className||panel.tagName})`);}catch(e){ /* ignore */ }
            last = cur; idle = 0; loops++; growths++;
            step = Math.max(Math.floor(panel.clientHeight*0.75), Math.floor(step * 0.9));
          } else {
            idle++; loops++;
            try{ updateLog(`[HD] idle ${idle}/${MAX_IDLE} @${cur} (step≈${step})`);}catch(e){ /* ignore */ }
            step = Math.min(Math.floor(panel.clientHeight*2.2), Math.floor(step * 1.18));
            if (!inWarmup && idle % SWITCH_EVERY === 0){
              candidates = hd_getCandidates();
              if (candidates.length){
                idx = (idx + 1) % candidates.length;
                panel = candidates[idx];
                hd_activate(panel);
                try{ updateLog(`[HD] switch panel → ${panel.className||panel.tagName}`);}catch(e){ /* ignore */ }
              }
            }
          }
        }
        disconnect();
        // Restore CSS
        try{
          if (prev.sb != null) panel.style.scrollBehavior = prev.sb;
          if (prev.sn != null) panel.style.scrollSnapType = prev.sn;
          if (prev.ob != null) panel.style.overscrollBehavior = prev.ob;
        }catch(e){ /* ignore */ }
        return { ok:true, last };
      }

      window.ARGUS_HD_RUN = ARGUS_HD_RUN;
    })();



    /* ===== ARGUS: Probe + Dynamic Review Selector Detection ===== */
    /* id:ARGUS_PROBE_DETECT_HELPERS */

    const ARGUS_PROBE = true;

    function argusLogProbe(msg){
      try { updateLog('[Probe] ' + msg); } catch(e){ console.log('[Argus][Probe]', msg); }
    }

    function argusOutline(el, color='#38bdf8'){
      if(!ARGUS_PROBE || !el) return;
      try{
        let box = document.getElementById('__argus_probe_box__');
        if(!box){
          box = document.createElement('div');
          box.id='__argus_probe_box__';
          Object.assign(box.style, { position:'fixed', zIndex: 2147483647, pointerEvents:'none', border:'2px solid '+color });
          document.body.appendChild(box);
        }
        const r = el.getBoundingClientRect();
        Object.assign(box.style, { left:r.left+'px', top:r.top+'px', width:r.width+'px', height:r.height+'px', borderColor: color, display:'block' });
        setTimeout(()=>{ if(box) box.style.display='none'; }, 1800);
      }catch(e){ /* ignore */ }
    }

    function argusIsScrollableProbe(el){
      try{
        const cs=getComputedStyle(el);
        return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 16;
      }catch(e){ return false; }
    }

    function argusGetScrollableAncestorProbe(node){
      let el = node;
      while(el && el!==document.body){
        if(argusIsScrollableProbe(el)) return el;
        el = el.parentElement;
      }
      return null;
    }

    async function argusEnsureReviewsDialogOpen(timeoutMs=20000){
      const t0=Date.now();
      
      // Always try to open the full reviews overlay first
      const openOverlay = () => {
        const btn =
          document.querySelector('button[aria-label^="See all reviews"]') ||
          document.querySelector('button[jsaction*="pane.reviewChart.moreReviews"]') ||
          document.querySelector('a[href*="/reviews"][aria-label]') ||
          document.querySelector('a[role="button"][href*="/reviews"]') ||
          // last resort: text match (en)
          Array.from(document.querySelectorAll('a,button,span')).find(n => /all reviews/i.test(n.textContent || ''));
        if (btn) btn.click();
      };
      openOverlay();

      // Wait a moment for the overlay, then prefer its scrollbox
      await new Promise(r => setTimeout(r, 800));
      
      // Check if overlay opened successfully
      const dlg = document.querySelector('div[role="dialog"]');
      const any = document.querySelector('div[data-review-id], .section-review, [data-review-id]');
      if(dlg || any) return true;
      
      // If no overlay, try structural selectors as fallback
      const structural = [
        'a[href][aria-label*="reviews"]',
        'a[href][aria-label*="Đánh giá"]',
        'button[aria-label*="All reviews"]',
        'button[aria-label*="Đánh giá"]',
        '[role="tab"][aria-controls*="reviews"]',
      ];
      for(const sel of structural){
        try{ const el=document.querySelector(sel); if(el){ el.click(); argusLogProbe('Clicked '+sel); break; } }catch(e){ /* ignore */ }
      }
      
      // If still no success, try text-based search
      const wanted = ['all reviews','see all reviews','đánh giá','tất cả đánh giá'];
      const nodes = Array.from(document.querySelectorAll('a,button,div,span'));
      for(const el of nodes){
        const t=(el.textContent||'').trim().toLowerCase();
        if(wanted.some(w=>t.includes(w))){ try{ el.click(); argusLogProbe('Clicked text node '+t.slice(0,32)); break; }catch(e){ /* ignore */ } }
      }
      
      // If we landed in the left panel, try one more time after UI settles
      if (!document.querySelector('div[role="dialog"]')) {
        await new Promise(r => setTimeout(r, 700));
        openOverlay();
        await new Promise(r => setTimeout(r, 700));
      }
      
      while(Date.now()-t0<timeoutMs){
        const dlg = document.querySelector('div[role="dialog"]');
        const any = document.querySelector('div[data-review-id], .section-review, [data-review-id]');
        if(dlg || any) return true;
        await new Promise(r=>setTimeout(r, 250));
      }
      return false;
    }

    function argusDetectReviewSelector(scope=document){
      const CANDS = [
        'div[data-review-id]',
        '.section-review',
        'div.gws-localreviews__google-review',
        'div[jscontroller][data-review-id]',
        'div[role="article"][data-review-id]',
        'div[data-review-id][jsaction]',
      ];
      let best = null, bestCount = 0;
      for(const sel of CANDS){
        let n=0; try{ n = scope.querySelectorAll(sel).length; }catch(e){ n=0; }
        argusLogProbe(`Count ${sel} = ${n}`);
        if(n > bestCount){ best = sel; bestCount = n; }
      }
      if(!bestCount){
        try{
          const rate = scope.querySelector('[aria-label$="stars"], [aria-label*="sao"]');
          const anc = rate ? argusGetScrollableAncestorProbe(rate) : null;
          if(anc){
            for(const sel of CANDS){
              const n = anc.querySelectorAll(sel).length;
              if(n>bestCount){ best = sel; bestCount = n; }
            }
          }
        }catch(e){ /* ignore */ }
      }
      if(best){
        argusLogProbe('Using review selector: '+best+' ('+bestCount+')');
        return best;
      }
      try{ if(CONFIG && CONFIG.scraper && CONFIG.scraper.reviewItemSelector) return CONFIG.scraper.reviewItemSelector; }catch(e){ /* ignore */ }
      return 'div[data-review-id]';
    }

    function argusActivate(el){
      if(!el) return;
      try{ el.setAttribute('tabindex', el.getAttribute('tabindex')||'0'); }catch(e){ /* ignore */ }
      try{ el.focus({preventScroll:true}); }catch(e){ /* ignore */ }
      try{ const r=el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('mousemove',{clientX:r.left+10, clientY:r.top+10, bubbles:true})); }catch(e){ /* ignore */ }
    }

    async function argusBurstScroll(el){
      const px = Math.max(320, Math.floor(el.clientHeight*0.95));
      const steps = Math.max(2, Math.min(6, Math.round(px/220)));
      const per = Math.max(100, Math.floor(px/steps));
      for(let i=0;i<steps;i++){
        el.scrollTop += per;
        try{ el.dispatchEvent(new WheelEvent('wheel', {deltaY:per, bubbles:true, cancelable:true})); }catch(e){ /* ignore */ }
        try{ el.dispatchEvent(new KeyboardEvent('keydown', {key:'PageDown', bubbles:true})); }catch(e){ /* ignore */ }
        await new Promise(r=>requestAnimationFrame(r));
      }
    }

    function argusSafeClose(){
      try {
        if (window.frameElement && typeof window.frameElement.remove === 'function') {
          window.frameElement.remove();
        } else if (typeof window.close === 'function') {
          window.close();
        }
      } catch(e){ /* ignore */ }
    }

    // ---- Robust scroll helpers (browser-agnostic) ----
    function getScrollableAncestor(node) {
        let el = node;
        while (el && el !== document.body) {
            try {
                const cs = window.getComputedStyle(el);
                const canScroll = /(auto|scroll)/.test(cs.overflowY);
                if (canScroll && el.scrollHeight > el.clientHeight + 16) return el;
            } catch (e) {
                // Ignore errors when checking computed styles
            }
            el = el.parentElement;
        }
        return null;
    }

    async function getReviewPanel(timeoutMs = 20000) {
        const t0 = Date.now();
        // Prefer ancestor of a review item (works across UI versions)
        while (Date.now() - t0 < timeoutMs) {
            const item = document.querySelector(CONFIG.scraper.reviewItemSelector);
            if (item) {
                const sc = getScrollableAncestor(item);
                if (sc) return sc;
            }
            // Fallback: known containers (multiple eras of Google Maps UI)
            const candidates = [
                'div.m6QErb.DxyBCb', // common scroll container
                'div.section-scrollbox', // legacy
                'div[role="region"].m6QErb', // region scrollable
                'div[aria-label][jscontroller][jsaction]', // generic heavy container
                CONFIG.scraper.mainScrollablePanel // existing config (fallback)
            ].filter(Boolean);
            for (const sel of candidates) {
                try {
                    const el = document.querySelector(sel);
                    if (el && el.scrollHeight > el.clientHeight + 16) return el;
                } catch (e) {
                    // Ignore errors when checking selectors
                }
            }
            await sleep(300);
        }
        return null;
    }

    /** ===================== Firefox-friendly Human-like Scrolling =====================
     * We DO NOT rely on default wheel scrolling (synthetic wheel has no default action).
     * Instead we set scrollTop in small steps and still emit wheel/keydown to trigger
     * any listeners the site may use. We also ensure the correct scrollable element,
     * found by walking up from a real review item ([data-review-id]).
     */
    function argusGetScrollableAncestorCore(node) {
      let el = node;
      while (el && el !== document.body) {
        try {
          const cs = getComputedStyle(el);
          if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 16) return el;
        } catch (e) { /* ignore */ }
        el = el.parentElement;
      }
      return null;
    }

    function argusActivatePane(el) {
      if (!el) return;
      try { el.setAttribute('tabindex', el.getAttribute('tabindex') || '0'); } catch (e) { /* ignore */ }
      try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      try {
        const r = el.getBoundingClientRect();
        const x = Math.max(0, Math.floor(r.left + Math.min(40, r.width * 0.25)));
        const y = Math.max(0, Math.floor(r.top + Math.min(40, r.height * 0.25)));
        el.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseover', { clientX: x, clientY: y, bubbles: true }));
      } catch (e) { /* ignore */ }
    }

    async function argusWaitForGone(selector, timeoutMs=6000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const el = document.querySelector(selector);
        if (!el) return true;
        await new Promise(r => setTimeout(r, 150));
      }
      return false;
    }

    function argusEmitAssistEvents(el, delta=0) {
      try { el.dispatchEvent(new WheelEvent('wheel', { deltaY: delta || el.clientHeight, bubbles: true, cancelable: true })); } catch (e) { /* ignore */ }
      try { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })); } catch (e) { /* ignore */ }
    }

    async function argusHumanLikeScrollStep(el, pixels) {
      const steps = Math.max(1, Math.min(6, Math.round(Math.abs(pixels) / 200)));
      const per = Math.sign(pixels) * Math.max(80, Math.floor(Math.abs(pixels) / steps));
      for (let i=0; i<steps; i++) {
        el.scrollTop += per;
        argusEmitAssistEvents(el, per);
        await new Promise(r => requestAnimationFrame(r));
      }
    }

    async function argusScrollBurst(el) {
      const jitter = (v, p=0.1) => Math.floor(v * (1 + (Math.random()*2-1)*p));
      const px = Math.max(300, Math.floor(el.clientHeight * 0.95));
      await argusHumanLikeScrollStep(el, jitter(px, 0.1));
      try {
        const last = el.querySelector(`${CONFIG.scraper.reviewItemSelector}:last-child`);
        if (last && last.scrollIntoView) last.scrollIntoView({ block: 'end', behavior: 'auto' });
      } catch (e) { /* ignore */ }
      // Optional sparse Home/End nudge
      if (Math.random() < 0.05) {
        try { el.dispatchEvent(new KeyboardEvent('keydown', { key: Math.random()<0.5 ? 'Home' : 'End', bubbles: true })); } catch (e) { /* ignore */ }
      }
    }

    async function argusEnsureReviewsPaneReady(timeoutMs = 20000) {
      const t0 = Date.now();
      const tabSelectors = (CONFIG && CONFIG.scraper && Array.isArray(CONFIG.scraper.reviewsTabSelectors))
        ? CONFIG.scraper.reviewsTabSelectors
        : ['button[aria-label*="Reviews"]','button[aria-label*="Đánh giá"]','button[data-tab-index="1"]','button[data-tab-index="2"]'];
      for (const sel of tabSelectors) {
        try { const btn = document.querySelector(sel); if (btn) { btn.click(); break; } } catch (e) { /* ignore */ }
      }
      while (Date.now() - t0 < timeoutMs) {
        const item = document.querySelector(CONFIG.scraper.reviewItemSelector);
        if (item) return true;
        await new Promise(r => setTimeout(r, 200)); // jitter-able
      }
      return false;
    }

    async function argusFindReviewsScroller(timeout = 20000) {
      const t0 = Date.now();
      const sels = [
        '.m6QErb[role="region"]',       // list classic
        '[role="feed"]',                // layout mới
        '.DxyBCb[role="region"]',       // biến thể
        'div[aria-label*="All reviews"]',
      ];
      while (Date.now() - t0 < timeout) {
        for (const s of sels) {
          try {
            const el = document.querySelector(s);
            if (el && el.scrollHeight > el.clientHeight) return el;
          } catch (e) { /* ignore */ }
        }
        await new Promise(r => setTimeout(r, 200));
      }
      return null;
    }

    // ==== ARGUS: Full Reviews Dialog + Multi-container Scroller (Firefox-friendly) ====
    /* id:ARGUS_MULTICONTAINER_HELPERS */

    function argusText(el){ try { return (el.textContent||'').trim(); } catch (e) { return ''; } }
    function argusCssPath(el){
      try{
        if(!el) return '(null)';
        const p=[];
        while(el && el.nodeType===1 && p.length<6){
          let s=el.nodeName.toLowerCase();
          if(el.id){ s += '#'+el.id; p.unshift(s); break; }
          let cls = (el.className||'').toString().split(/\s+/).filter(Boolean);
          if(cls.length) s += '.'+cls.slice(0,3).join('.');
          p.unshift(s);
          el = el.parentElement;
        }
        return p.join(' > ');
      }catch(e){return '(path)'}
    }

     function argusIsScrollable(el){
       try{
         const cs=getComputedStyle(el);
         return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 16;
       }catch(e){return false}
     }

    function argusGetScrollableAncestorFromReview(){
      try{
        const item = document.querySelector(CONFIG.scraper.reviewItemSelector);
        if(!item) return null;
        let el=item;
        while(el && el!==document.body){
          if(argusIsScrollable(el)) return el;
          el = el.parentElement;
        }
      }catch(e){ /* ignore */ }
      return null;
    }

    async function argusEnsureFullReviewsDialog(timeoutMs=20000){
      const t0=Date.now();
      const structural = [
        'a[href][aria-label*="reviews"]',
        'a[href][aria-label*="Đánh giá"]',
        'button[aria-label*="All reviews"]',
        'button[aria-label*="Đánh giá"]',
        'button[jsaction*="allreviews"]',
        '[role="tab"][aria-controls*="reviews"]',
      ];
      for(const sel of structural){
        try{
          const el=document.querySelector(sel);
          if(el){ el.click(); break; }
        }catch(e){ /* ignore */ }
      }
      const clickables = Array.from(document.querySelectorAll('a,button,div,span')).slice(0,1200);
      const wanted = ['all reviews','see all reviews','đánh giá','tất cả đánh giá','x bài đánh giá','x reviews'];
      outer: for(const el of clickables){
        const t=(el.textContent||'').trim().toLowerCase();
        for(const w of wanted){ if(t.includes(w)){ try{ el.click(); break outer; }catch(e){ /* ignore */ } } }
      }
      while(Date.now()-t0<timeoutMs){
        const dlg = document.querySelector('div[role="dialog"]');
        const item = document.querySelector(CONFIG.scraper.reviewItemSelector);
        if(dlg || item){
          await new Promise(r=>setTimeout(r, 250));
          return true;
        }
        await new Promise(r=>setTimeout(r, 200));
      }
      return false;
    }

    function argusCollectScrollerCandidates(){
      const cands=[];
      const anc = argusGetScrollableAncestorFromReview();
      if(anc) cands.push(anc);
      document.querySelectorAll('div[role="dialog"] .m6QErb, div[role="dialog"] .section-scrollbox').forEach(e=>cands.push(e));
      document.querySelectorAll('div.m6QErb.DxyBCb, div[role="region"].m6QErb, div.section-scrollbox, div[aria-label][jscontroller][jsaction]').forEach(e=>cands.push(e));
      const seen=new Set(); const out=[];
      for(const el of cands){
        if(!el || !argusIsScrollable(el)) continue;
        const key=el.tagName+'|'+el.className+'|'+(el.getAttribute('role')||'')+'|'+(el.getAttribute('aria-label')||'');
        if(seen.has(key)) continue; seen.add(key); out.push(el);
      }
      if(document.scrollingElement && document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight + 16){
        out.push(document.scrollingElement);
      }
      return out;
    }

    // argusActivatePane already exists; reuse it

    function argusEmitAssist(el, delta){
      try{ el.dispatchEvent(new WheelEvent('wheel', {deltaY: delta||el.clientHeight, bubbles:true, cancelable:true})); }catch(e){ /* ignore */ }
      try{ el.dispatchEvent(new KeyboardEvent('keydown', {key:'PageDown', bubbles:true})); }catch(e){ /* ignore */ }
      try{ el.dispatchEvent(new KeyboardEvent('keydown', {key:'End', bubbles:true})); }catch(e){ /* ignore */ }
    }

    async function argusBurst(el){
      const px = Math.max(320, Math.floor(el.clientHeight * 0.95));
      const steps = Math.max(2, Math.min(6, Math.round(px/220)));
      const per = Math.max(100, Math.floor(px/steps));
      for(let i=0;i<steps;i++){
        el.scrollTop += per;
        argusEmitAssist(el, per);
        await new Promise(r=>requestAnimationFrame(r));
      }
      try{
        const last = el.querySelector(`${CONFIG.scraper.reviewItemSelector}:last-child`);
        if(last && last.scrollIntoView) last.scrollIntoView({block:'end', behavior:'auto'});
      }catch(e){ /* ignore */ }
    }

    async function argusWaitGone(sel, ms=6000){
      const t0=Date.now(); while(Date.now()-t0<ms){ if(!document.querySelector(sel)) return true; await new Promise(r=>setTimeout(r,150)); } return false;
    }

    function pokeDOMWhenStalled(panel) {
        if (!panel) return;
        try {
            void panel.offsetHeight;
            panel.style.scrollBehavior = 'auto';
            panel.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
            panel.dispatchEvent(new MouseEvent('wheel', { bubbles: true }));
        } catch (e) { /* ignore */ }
    }

    function ensureActiveScrollingElement(el) {
        if (!el) return;
        try { el.setAttribute('tabindex', el.getAttribute('tabindex') || '0'); } catch (e) { /* ignore */ }
        try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        try {
            const rect = el.getBoundingClientRect();
            const cx = Math.max(0, Math.floor(rect.left + Math.min(32, rect.width/3)));
            const cy = Math.max(0, Math.floor(rect.top + Math.min(32, rect.height/3)));
            el.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseover', { clientX: cx, clientY: cy, bubbles: true }));
        } catch (e) { /* ignore */ }
    }

    async function waitForGone(selector, timeoutMs = 6000) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            const el = document.querySelector(selector);
            if (!el) return true;
            await sleep(150);
        }
        return false;
    }

    // ====== Search results feed scroller (root page) ======
    async function getSearchFeedPanel(timeoutMs = 20000) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            // Prefer role="feed" container variants
            let el = document.querySelector('div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde[role="feed"], div[role="feed"].m6QErb.DxyBCb');
            if (!el) {
                // Derive from any result card by ancestor chain
                try {
                    const oneCard = document.querySelector('.Nv2PK, a.hfpxzc[href*="/maps/place/"]');
                    if (oneCard) el = getScrollableAncestor(oneCard);
                } catch (e) { /* ignore */ }
            }
            if (!el) {
                // Fallback: common scroll containers
                try {
                    const cand = document.querySelector('div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde, div.section-scrollbox, div[role="region"].m6QErb');
                    if (cand && cand.scrollHeight > cand.clientHeight + 16) el = cand;
                } catch (e) { /* ignore */ }
            }
            if (el && el.scrollHeight > el.clientHeight + 16) return el;
            await sleep(250);
        }
        return null;
    }

    async function scrollSearchFeedUntilStable(options = {}) {
        const {
            itemSelector = 'a.hfpxzc[href*="/maps/place/"], .Nv2PK',
            loadingSelector = 'div[role="progressbar"][aria-busy="true"]',
            maxIdle = 14,
            sleepMs = 600
        } = options;

        const panel = await getSearchFeedPanel(20000);
        if (!panel) {
            updateLog('[Extract] Không tìm được vùng cuộn kết quả (feed).');
            return;
        }
        ensureActiveScrollingElement(panel);

        let lastCount = 0;
        let idle = 0;
        const step = () => {
            try { panel.scrollTop = panel.scrollTop + Math.max(220, Math.floor(panel.clientHeight * 0.9)); } catch (e) { /* ignore */ }
            try { panel.dispatchEvent(new WheelEvent('wheel', { deltaY: panel.clientHeight, bubbles: true, cancelable: true })); } catch (e) { /* ignore */ }
            try { panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })); } catch (e) { /* ignore */ }
            try {
                const primarySel = itemSelector.split(',')[0];
                const last = panel.querySelector(`${primarySel}:last-child`);
                if (last && last.scrollIntoView) last.scrollIntoView({ block: 'end', behavior: 'auto' });
            } catch (e) { /* ignore */ }
        };

        while (idle < maxIdle) {
            step();
            try { await waitForGone(loadingSelector, 4000); } catch (e) { /* ignore */ }
            await sleep(sleepMs);
            let cur = 0;
            try { cur = document.querySelectorAll(itemSelector).length; } catch (e) { cur = 0; }
            if (cur > lastCount) {
                updateLog(`[Extract] Feed items: ${cur} (+${cur - lastCount})`);
                lastCount = cur;
                idle = 0;
            } else {
                idle++;
                updateLog(`[Extract] Feed no growth (idle=${idle}/${maxIdle}) @${cur}`);
            }
        }
    }

    // Expose for console/manual triggering and satisfy linter usage
    try { window.__argusScrollSearchFeedUntilStable = scrollSearchFeedUntilStable; } catch (e) { /* ignore */ }

    function normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.origin + urlObj.pathname + urlObj.search;
        } catch (e) {
            return url;
        }
    }


    // --- UI & State Functions ---
    function updateLog(message) {
        const logArea = document.getElementById('argus-log-area');
        if (logArea) logArea.innerHTML = message;
        console.log(`[Argus] ${message.replace(/<br>/g, '\n')}`);
    }

    async function updateProgress() {
  try {
    const links = await GM_getValue('argus.progress.links', { discovered: 0, total: 0 });
    const reviews = await GM_getValue('argus.progress.reviews', { collected: 0, expected: 0 });
    const total = (links.total || reviews.expected || 0);
    const collected = (reviews.collected || 0);
    await GM_setValue('argus.progress', { collected, total });
    const ui = (window.__argus_ui_progress__ ||= { collected: 0, total: 0 });
    ui.collected = collected; ui.total = total;
    if (typeof window.renderProgress === 'function') window.renderProgress(ui);
    console.log('[Argus][Progress] sync', { collected, total });
  } catch(e) { console.warn('[Argus][Progress] sync failed', e); }
}




    async function updateUIState() {
        const urlQueue = await GM_getValue(KV.URLQ, []);
        const startScrapingBtn = document.getElementById('argus-start-scraping-btn');
        if (startScrapingBtn) {
            startScrapingBtn.disabled = urlQueue.length === 0;
            startScrapingBtn.textContent = `2. Bắt đầu Thu thập (${urlQueue.length} links)`;
        }
        await updateProgress();
    }

    // --- Core Module Functions ---
    /**
     * Start SERP link extraction and snapshot expected review counts.
     * Public API: safe to call from UI; updates KV and UI.
     */
    async function runLinkExtraction() {
        updateLog('Bắt đầu trích xuất links...');
        const scrollableElement = document.querySelector(CONFIG.linkExtractor.scrollablePane);
        if (!scrollableElement) {
            alert('Không tìm thấy bảng kết quả để cuộn.');
            updateLog('Lỗi: Không tìm thấy panel kết quả.');
            return;
        }
        let scrollCount = 0;
        const interval = setInterval(() => {
            scrollableElement.scrollTop = scrollableElement.scrollHeight;
            scrollCount++;
            const currentResultCount = document.querySelectorAll(CONFIG.linkExtractor.resultLink).length;
            updateLog(`Đang cuộn... (${currentResultCount}) [${scrollCount}]`);
            const potentialElements = scrollableElement.querySelectorAll('span, div');
            let endSignalFound = false;
            for (const el of potentialElements) {
                if (isElementVisible(el)) {
                    const elText = el.textContent.toLowerCase().trim();
                    if (elText && CONFIG.linkExtractor.endOfResultsKeywords.some(keyword => elText.includes(keyword))) {
                        endSignalFound = true;
                        break;
                    }
                }
            }
            if (endSignalFound || scrollCount >= CONFIG.linkExtractor.safetyFuse) {
                clearInterval(interval);
                if (endSignalFound) updateLog('Đã phát hiện tín hiệu kết thúc.');
                else updateLog('Đã đạt giới hạn cuộn an toàn.');
                finalizeLinkExtraction();
            }
        }, 1000);
    }

    async function finalizeLinkExtraction() {
        updateLog('Đang trích xuất, lọc và tính toán reviews...');
        const resultItems = document.querySelectorAll(CONFIG.linkExtractor.searchResultItemContainer);
        const byNorm = new Map();

        for (const item of resultItems) {
            const linkEl = item.querySelector(CONFIG.linkExtractor.resultLink);
            const reviewCountEl = item.querySelector(CONFIG.linkExtractor.reviewCountSelector);
            if (!linkEl) continue;
            const norm = normalizeUrl(linkEl.href);
            let expectedReviews = 0;
            if (reviewCountEl) {
                const reviewText = reviewCountEl.textContent.replace(/[(),.]/g, '');
                const count = parseInt(reviewText, 10);
                if (!Number.isNaN(count)) expectedReviews = count;
            }
            const prev = byNorm.get(norm);
            if (!prev || expectedReviews > prev.expectedReviews) {
                byNorm.set(norm, { url: norm, expectedReviews });
            }
        }

        const uniqueLinkData = Array.from(byNorm.values());
        const finalTotalExpected = uniqueLinkData.reduce((sum, item) => sum + (item.expectedReviews || 0), 0);

        if (uniqueLinkData.length === 0) {
            updateLog('Lỗi: Không trích xuất được link nào. Có thể cấu trúc trang đã thay đổi.');
            alert('Không thể trích xuất bất kỳ link nào. Vui lòng kiểm tra lại bộ chọn (selector) trong mã nguồn.');
            return;
        }

        await GM_setValue(KV.URLQ, uniqueLinkData);
        await GM_setValue(KV.TOTAL_EXPECT, finalTotalExpected);
        updateLog(`Hoàn tất! Đã lưu ${uniqueLinkData.length} links (tổng số reviews dự kiến: ${finalTotalExpected.toLocaleString()})`);
        await updateUIState();
    }

    /**
     * Worker: robustly opens reviews panel and collects reviews
     * Public API: launched per place; saves payload in KV.
     */
    async function runScrapingWorker() {

// =================== [Argus][Keepalive] muted-video keepalive (singleton) ===================
(function gentleKeepalive(){
  try {
    if (window.__argusKA__ && window.__argusKA__.armed) return;
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const iv = setInterval(()=>{ try{
      const o = ac.createOscillator();
      const g = ac.createGain(); g.gain.value = 0;
      o.connect(g).connect(ac.destination); o.start();
      setTimeout(()=>{ try{ o.stop(); o.disconnect(); g.disconnect(); }catch(err){ /* ignore */ } }, 80);
    }catch(err){ /* ignore */ } }, 2500);
    window.__argusKA__ = { armed: true, ac, iv };
  } catch(err){ /* ignore */ }
})();
// =================== [/Argus][Keepalive] ===================================================



// Khóa nhiệm vụ thống nhất với Orchestrator
const TASK_KEY = new URLSearchParams((location.hash || '').slice(1)).get('argusKey') || location.href;

// Tick progress realtime để Orchestrator cập nhật thanh tiến trình
const _progressTick = setInterval(() => {
  try {
    const sel = CONFIG.scraper.reviewItemSelector;
    const c = document.querySelectorAll(sel).length;
    GM_setValue('progress:' + TASK_KEY, { count: c, ts: Date.now() });
  } catch (e) { /* ignore */ }
}, 1000);

        let payload = {
            storeInfo: { name: 'N/A', address: 'N/A', sourceUrl: window.location.href },
            reviews: [],
            status: 'FAIL',
            timestamp: new Date().toISOString(),
            error_message: 'Process did not complete.'
        };
        if (window.__ARGUS_WORKER_STARTED__) { return; }
        window.__ARGUS_WORKER_STARTED__ = true;
        // Worker control flags (pause/clear/hard_stop)
        let __paused = false, __cleared = false;
        try {
            BC && (BC.onmessage = (ev) => {
                const m = ev && ev.data || {};
                if (m.type === 'pause') __paused = true;
                if (m.type === 'resume') __paused = false;
                if (m.type === 'clear') __cleared = true;
                if (m.type === 'hard_stop') { try { window.close(); } catch (e) { /* ignore */ } }
            });
        } catch (e) { /* ignore */ }
        // --- Worker-side autosave & progress state ---
        let loopCounter = 0;
        const savedIds = new Set();
        let partialReviews = [];
        // Partial save throttling
        const PARTIAL_EVERY = 200;
        let sinceLastSave = 0;

        // Stuck-recovery watchdog
        let noGrowthCycles = 0;
        setInterval(async () => {
          const now = document.querySelectorAll('div[data-review-id]').length;
          window.__ARGUS_GROWTH_CACHE__ = window.__ARGUS_GROWTH_CACHE__ || { n: now };
          if (now <= window.__ARGUS_GROWTH_CACHE__.n) noGrowthCycles++;
          else noGrowthCycles = 0;
          window.__ARGUS_GROWTH_CACHE__.n = now;

          if (noGrowthCycles >= 5) { // ~25s với tick 5s
            const sp = document.querySelector('div[role="progressbar"][aria-busy="true"]');
            if (!sp) { location.reload(); } else {
              const btn = document.querySelector('button[aria-label*="reviews"], a[jsaction*="reviewDialog"]');
              btn?.click();
            }
            noGrowthCycles = 0;
          }
        }, 5000);
        try {
            const checkpoint = await GM_getValue(window.location.href + '::partial', null);
            if (checkpoint && Array.isArray(checkpoint.ids)) {
                checkpoint.ids.forEach(id => savedIds.add(id));
                if (Array.isArray(checkpoint.reviews)) partialReviews = checkpoint.reviews.slice(0, 50000);
            }
        } catch (e) { /* ignore checkpoint load errors */ }

        function collectNewReviews() {
            const items = document.querySelectorAll(CONFIG.scraper.reviewItemSelector);
            let collected = 0;
            for (const el of items) {
                const id = el.getAttribute('data-review-id') || '';
                if (!id || savedIds.has(id)) continue;
                const author = el.querySelector(CONFIG.scraper.authorNameSelector)?.textContent?.trim() || '';
                const date = el.querySelector(CONFIG.scraper.reviewDateSelector)?.textContent?.trim() || '';
                const text = el.querySelector(CONFIG.scraper.reviewTextSelector)?.textContent?.trim() || '';
                const starEl = el.querySelector(CONFIG.scraper.starRatingSelector);
                const star = starEl ? (parseFloat(starEl.getAttribute('aria-label')) || NaN) : NaN;
                partialReviews.push({ id, author, date, text, star });
                savedIds.add(id);
                collected++;
            }
            return collected;
        }

        try {
            const storeNameEl = await waitForAnySelector([CONFIG.scraper.storeNameSelector], 15000);
            if (storeNameEl) payload.storeInfo.name = storeNameEl.textContent.trim();
            const addressEl = await waitForAnySelector([CONFIG.scraper.addressSelector], 10000);
            if (addressEl) payload.storeInfo.address = addressEl.getAttribute('aria-label').replace(/Address:|Địa chỉ:/, '').trim();

                         const reviewsButton = await waitForAnySelector(CONFIG.scraper.reviewsTabSelectors, 20000);
             if (reviewsButton) {
                 reviewsButton.click();
                 await sleep(randomDelay(1500, 2500));
             }

             await argusEnsureReviewsPaneReady(20000);
             await openAllReviewsRobust(25000);
             payload.storeInfo.expected = getExpectedReviews();

             // --- Robust review panel discovery ---
             const mainPanel = await argusFindReviewsScroller(20000);
            if (!mainPanel) {
                payload.status = 'SUCCESS';
                payload.error_message = 'No review scrollable panel found (0 reviews or UI changed).';
            } else {
                argusActivatePane(mainPanel);
                let idle = 0;
                let lastCount = 0;
                const MAX_IDLE = 16;
                const SPINNER_SEL = (CONFIG.scraper.loadingSpinnerSelector || 'div[role="progressbar"][aria-busy="true"]');

                const step = () => {
                    // human-like burst
                    return argusScrollBurst(mainPanel);
                };

                while (idle < MAX_IDLE) {
                    if (__cleared) break;
                    if (__paused) { await sleep(500); continue; }

                    await step();
                    try { await argusWaitForGone(SPINNER_SEL, 5000); } catch (e) { /* ignore */ }
                    await sleep(650 + Math.floor(Math.random()*160) - 80); // jitter ±80ms
                    try { 
                        document.querySelectorAll('button.w8nwRe[data-expandable="1"], button[aria-label^="More"]').forEach(btn => btn.click()); 
                    } catch (e) { /* ignore */ }

                    const curCount = document.querySelectorAll(CONFIG.scraper.reviewItemSelector).length;
                    if (curCount > lastCount) {
                        updateLog(`[Worker] Reviews loaded: ${curCount} (+${curCount - lastCount})`);
// =================== [Argus][Trace] emit CHUNK progress (on growth) ===================
try {
  const TASK_KEY = argusGetTaskKey();
  await GM_setValue('progress:' + TASK_KEY, { count: curCount, ts: Date.now() });
  try {
    window.__argusBC__ = window.__argusBC__ || new BroadcastChannel('argus:progress');
    window.__argusBC__.postMessage({ t: Date.now(), type: 'chunk', key: TASK_KEY, count: curCount });
  } catch (e) { /* ignore */ }
} catch (e) { /* ignore */ }
// =================== [/Argus][Trace] =======================================================
// ---- Argus: emit growth as chunk ----
try { await GM_setValue('progress:' + TASK_KEY, { count: curCount, ts: Date.now() }); } catch (e) { /* ignore */ }
// ---- /Argus ----
trace('worker:growth', { count: curCount, href: location.href });
                        lastCount = curCount;
                        idle = 0;
                    } else {
                        idle++;
                        updateLog(`[Worker] No growth (idle=${idle}/${MAX_IDLE}) at ${curCount}`);
// =================== [Argus][HD] background hard-scroll fallback ===================
try {
  if (document.visibilityState !== 'visible') {
    const container = argusFindScrollableFrom(CONFIG.scraper.reviewItemSelector);
    const FIXED_STEP = 1200;
    const BURST = 2;
    for (let i = 0; i < BURST; i++) container.scrollBy(0, FIXED_STEP);
    const moreBtns = [
      'button[aria-label*="More"]',
      'button[aria-label*="Thêm"]',
      'div[role="button"][jsaction*="pane.reviewList.loadMore"]',
    ];
    for (const sel of moreBtns) {
      const b = document.querySelector(sel);
      if (b) { b.click(); break; }
    }
    console.log('[Argus][HD] background hard-scroll applied');
  }
} catch (e) {
  console.log('[Argus][HD] background hard-scroll error', e);
}
// =================== [/Argus][HD] ==========================================================
                    }

                    // --- Autosave & progress broadcast during scroll ---
                    loopCounter++;
                    const every = CONFIG.scraper.partialSaveEvery ?? 5;
                    const minDelta = CONFIG.scraper.partialSaveMinDelta ?? 10;
                    if (loopCounter % every === 0) {
                        const before = savedIds.size;
                        const newly = collectNewReviews();
                        const delta = savedIds.size - before;
                        sinceLastSave += (newly || delta || 0);

                        // update reviews progress namespace
                        try {
                          const rp = window.__argusKV?.get('argus.progress.reviews', { collected: 0, expected: 0 }) || { collected: 0, expected: 0 };
                          rp.collected += (newly|0);
                          rp.expected = Math.max(rp.expected|0, payload.storeInfo.expected|0);
                          window.__argusKV?.set('argus.progress.reviews', rp);
                          window.dispatchEvent(new CustomEvent('ARGUS:PROGRESS', { detail: { type: 'reviews', add: newly } }));
                        } catch (e) { /* ignore */ }

                        if (delta >= minDelta && sinceLastSave >= PARTIAL_EVERY) {
                            await GM_setValue(window.location.href + '::partial', {
                                ts: Date.now(), ids: Array.from(savedIds).slice(-50000), reviews: partialReviews.slice(-50000)
                            });
                            sinceLastSave = 0;
                        }
                        try { BC && BC.postMessage({ type: 'worker_progress', url: window.location.href, count: savedIds.size, ts: Date.now() }); } catch (e) { /* ignore progress post error */ }
                    }
                }
            }

            // Expand "More" buttons in overlay items
            try { 
                document.querySelectorAll('button.w8nwRe[data-expandable="1"], button[aria-label^="More"]').forEach(button => button.click()); 
            } catch (e) { /* ignore */ }
            await sleep(1500);

            // === ARGUS: Ensure dialog open & detect selectors ===
            try { await argusEnsureReviewsDialogOpen(20000); } catch (e) { /* ignore */ }
            let reviewRoot = document;
            let panelCandidates = [];
            try {
                const sample = document.querySelector('div[data-review-id], .section-review, div.gws-localreviews__google-review');
                const sc = sample ? argusGetScrollableAncestorProbe(sample) : null;
                if (sc) panelCandidates.push(sc);
                
                // Prefer overlay scrollboxes first
                document.querySelectorAll('[role="dialog"] div.m6QErb.DxyBCb, div[aria-label*="Reviews"] div.m6QErb.DxyBCb').forEach(e => { 
                    if (argusIsScrollableProbe(e)) panelCandidates.unshift(e); // Add to front
                });
                
                // Then add other dialog scrollboxes
                document.querySelectorAll('div[role="dialog"] .m6QErb, div[role="dialog"] .section-scrollbox').forEach(e => { 
                    if (argusIsScrollableProbe(e)) panelCandidates.push(e); 
                });
                
                // Finally add left panel fallbacks
                document.querySelectorAll('div.m6QErb.DxyBCb, div[role="region"].m6QErb, div.section-scrollbox').forEach(e => { 
                    if (argusIsScrollableProbe(e)) panelCandidates.push(e); 
                });
            } catch (e) { /* ignore */ }
            panelCandidates = Array.from(new Set(panelCandidates));
            let panel = panelCandidates[0] || null;
            if (panel) { argusActivate(panel); argusOutline(panel, '#22c55e'); }
            const REVIEW_SEL = argusDetectReviewSelector(document);
            const SPINNER_SEL = (CONFIG.scraper.loadingSpinnerSelector || 'div[role="progressbar"][aria-busy="true"]');
            let lastCount = 0, idle = 0, rounds = 0;

            function getExpectedFromPage(){
              try {
                const wanted = [
                  'button[aria-label*="review"]','a[aria-label*="review"]',
                  'button[aria-label*="Đánh giá"]','a[aria-label*="Đánh giá"]'
                ];
                for (const s of wanted) {
                  const el = document.querySelector(s);
                  const t = (el?.getAttribute('aria-label') || el?.textContent || '').replace(/[.,()]/g,'');
                  const m = t.match(/(\d{1,3}(?:\d{3})*|\d+)\s*(review|đánh giá)/i);
                  if (m) return parseInt(m[1],10);
                }
              } catch(e) { /* ignore */ }
              return 0;
            }
            const EXPECTED_LOCAL = getExpectedFromPage();
            const MAX_IDLE = EXPECTED_LOCAL > 5000 ? 120 : EXPECTED_LOCAL > 2000 ? 80 : EXPECTED_LOCAL > 800 ? 50 : 28;
            const MAX_WALL_MS = Math.min(15*60*1000, Math.max(6*60*1000, (EXPECTED_LOCAL||1000)*250)); // trần 6–15 phút

            async function forceSortNewest(){
              try{
                const btns = Array.from(document.querySelectorAll('button,div,[role="button"]'));
                const sortBtn = btns.find(b=>/sort/i.test(b.textContent||'') || /Sort/.test(b.getAttribute('aria-label')||''));
                if (sortBtn) {
                  sortBtn.click(); await new Promise(r=>setTimeout(r,350));
                  const menu = document.querySelector('[role="menu"],[jscontroller]');
                  const item = Array.from(menu?.querySelectorAll('*')||[]).find(n=>/newest|mới nhất/i.test(n.textContent||''));
                  if (item) item.click();
                }
              }catch(e){/*ignore*/}
            }

            async function ensureAllLanguages(){
              try{
                const btns = Array.from(document.querySelectorAll('button,div,[role="button"]'));
                const filter = btns.find(b=>/language|ngôn ngữ/i.test(b.textContent||'') || /Language/.test(b.getAttribute('aria-label')||''));
                if (filter) {
                  filter.click(); await new Promise(r=>setTimeout(r,350));
                  const menu = document.querySelector('[role="menu"],[jscontroller]');
                  const all = Array.from(menu?.querySelectorAll('*')||[]).find(n=>/all languages|tất cả/i.test(n.textContent||''));
                  if (all) all.click();
                }
              }catch(e){/*ignore*/}
            }

            // Trước vòng tải review chính:
            try { await forceSortNewest(); } catch(e){/*ignore*/}
            try { await ensureAllLanguages(); } catch(e){/*ignore*/}

            const tStart = Date.now();

            while (idle < MAX_IDLE) {
                if (panel) {
                    await argusBurstScroll(panel);
                    await new Promise(r=>setTimeout(r, 100));
                    await new Promise(r=>setTimeout(r, 600));
                    try { 
                        document.querySelectorAll('button.w8nwRe[data-expandable="1"], button[aria-label^="More"]').forEach(b => b.click()); 
                    } catch (e) { /* ignore */ }
                } else {
                    window.scrollBy(0, Math.max(300, Math.floor(window.innerHeight*0.9)));
                    await new Promise(r=>setTimeout(r, 600));
                }

                const cur = document.querySelectorAll(REVIEW_SEL).length;
                if (cur > lastCount) {
                    updateLog(`[Worker] Reviews loaded: ${cur} (+${cur - lastCount}) [sel=${REVIEW_SEL}]`);
                    lastCount = cur; idle = 0; rounds++;
                } else {
                    idle++; rounds++;
                    updateLog(`[Worker] No growth (idle=${idle}/${MAX_IDLE}) at ${cur} [sel=${REVIEW_SEL}]`);
                    if (panelCandidates.length > 1 && rounds % 3 === 0) {
                        panel = panelCandidates[(Math.floor(rounds/3)) % panelCandidates.length];
                        if (panel) { argusActivate(panel); argusOutline(panel, '#f97316'); }
                    }
                    if (idle % 10 === 0) { try { await forceSortNewest(); } catch (e) { /* ignore */ } }
                    if (idle % 12 === 0) { try { await ensureAllLanguages(); } catch (e) { /* ignore */ } }
                    if (idle % 8 === 0) {
                        try {
                            const panel = (() => {
                                const s = ['[role="feed"]', '.m6QErb', '.DxyBCb', '.XiKgde'];
                                for (const q of s) { const el = document.querySelector(q); if (el) return el; }
                                return null;
                            })();
                            if (panel) {
                                panel.scrollTop = Math.max(0, panel.scrollHeight * 0.1);
                                await new Promise(r => requestAnimationFrame(r));
                                panel.scrollTop = panel.scrollHeight;
                            }
                        } catch (e) { /* ignore */ }
                    }
                    if (Date.now() - tStart > MAX_WALL_MS) break; // tường thời gian
                }
            }


            // === ARGUS_HD: Adaptive Human-Drive pass ===
            try {
              (function(){
                try{
                  const t = Array.from(document.querySelectorAll('a,button')).find(el => /all reviews|see all reviews|đánh giá/i.test((el.textContent||'')+(el.getAttribute('aria-label')||'')));
                  if (t) t.click();
                }catch(e){ /* ignore */ }
              })();
              const spinnerSel = (CONFIG && CONFIG.scraper && CONFIG.scraper.loadingSpinnerSelector) ? CONFIG.scraper.loadingSpinnerSelector : 'div[role="progressbar"][aria-busy="true"]';
              const reviewSel = (CONFIG && CONFIG.scraper && CONFIG.scraper.reviewItemSelector) ? CONFIG.scraper.reviewItemSelector : 'div[data-review-id]';
              const moreSel = (CONFIG && CONFIG.scraper && CONFIG.scraper.moreButtonSelector) ? CONFIG.scraper.moreButtonSelector : '[role="button"][jsaction*="more"]';
              const resHD = await window.ARGUS_HD_RUN({ spinnerSel, reviewSel, moreSel, maxIdle: 16, log: true });
              if (resHD && resHD.ok) { updateLog(`[HD] pass complete @${resHD.last}`); }
            } catch (e) { try{ updateLog(`[HD] pass failed: ${e}`); }catch(e2){ /* ignore */ } }
        const reviewElements = document.querySelectorAll(CONFIG.scraper.reviewItemSelector);
// =================== [Argus][HD] resolve scrollable container ===================
function argusGetTaskKey() {
  try { return new URLSearchParams((location.hash||'').replace(/^#/, '')).get('argusKey') || location.href; }
  catch { return location.href; }
}
function argusFindScrollableFrom(itemSel) {
  const el = document.querySelector(itemSel);
  const pickScrollable = (node) => {
    for (let p = node; p && p !== document.documentElement; p = p.parentElement) {
      const sh = p.scrollHeight, ch = p.clientHeight, st = getComputedStyle(p);
      if (sh > ch + 16 && /(auto|scroll)/.test(st.overflowY)) return p;
    }
    return null;
  };
  let sc = el ? pickScrollable(el) : null;
  if (!sc) {
    sc = document.querySelector('div[role="feed"], div[aria-label*="Reviews i"], div[aria-label*="Reviews e"], div[aria-label*="Đánh giá"]');
  }
  return sc || document.scrollingElement || document.body;
}
// =================== [/Argus][HD] ===========================================================

// =================== [Argus][Trace] periodic CHUNK emitter (debounce 800ms) ================
(function startPeriodicChunkEmitter(){
  try {
    const TASK_KEY = argusGetTaskKey();
    let last = 0;
    if (window.__argusChunkIv__) clearInterval(window.__argusChunkIv__);
    window.__argusChunkIv__ = setInterval(async () => {
      try {
        const list = document.querySelectorAll(CONFIG.scraper.reviewItemSelector);
        const n = list ? list.length : 0;
        if (n > last) {
          await GM_setValue('progress:' + TASK_KEY, { count: n, ts: Date.now() });
          try {
            window.__argusBC__ = window.__argusBC__ || new BroadcastChannel('argus:progress');
            window.__argusBC__.postMessage({ t: Date.now(), type: 'chunk', key: TASK_KEY, count: n });
          } catch (e) { /* ignore */ }
          last = n;
        }
      } catch (e) { /* ignore */ }
    }, 800);
    console.log('[Argus][Trace] chunk-emitter armed');
  } catch (e) {
    console.log('[Argus][Trace] chunk-emitter failed', e);
  }
})();
// =================== [/Argus][Trace] =======================================================
await GM_setValue('progress:' + TASK_KEY, { count: reviewElements.length, ts: Date.now() });
            const extractedReviews = [];
            for (const el of reviewElements) {
                try {
                    const singleReviewData = {
                        reviewId: el.getAttribute('data-review-id') || 'N/A',
                        authorName: el.querySelector(CONFIG.scraper.authorNameSelector)?.textContent?.trim() || 'N/A',
                        reviewDate: el.querySelector(CONFIG.scraper.reviewDateSelector)?.textContent?.trim() || 'N/A',
                        reviewText: el.querySelector(CONFIG.scraper.reviewTextSelector)?.textContent?.trim() || 'N/A',
                        starRating: (() => { const ratingEl = el.querySelector(CONFIG.scraper.starRatingSelector); const m = ratingEl ? ratingEl.getAttribute('aria-label')?.match(/\d+/) : null; return m ? parseInt(m[0], 10) : null; })(),
                        details: {}
                    };
                    const detailContainers = el.querySelectorAll(CONFIG.scraper.detailAttributeContainerSelector);
                    detailContainers.forEach(container => {
                        const detailText = container.textContent.trim();
                        if (detailText && detailText.includes(':')) {
                            const parts = detailText.split(':');
                            const key = parts[0].trim();
                            const value = parts[1].trim();
                            if (key) singleReviewData.details[key] = value;
                        }
                    });
                    extractedReviews.push(singleReviewData);
                } catch (e) {
                    console.error(`[Argus Worker] Error parsing a single review:`, e);
                }
            }

            payload.reviews = extractedReviews;
            payload.status = 'SUCCESS';
            payload.error_message = '';
        } catch (error) {
            payload.error_message = error.message;
            console.error(`[Argus Worker] A critical error occurred:`, error);
        } finally {
            // Merge checkpointed partial reviews
            try {
                collectNewReviews();
                if (Array.isArray(partialReviews) && partialReviews.length > 0) {
                    const seen = new Set();
                    const merged = [];
                    (payload.reviews || []).forEach(r => { if (r && r.reviewId) { seen.add(r.reviewId); merged.push(r); } });
                    partialReviews.forEach(r => { if (r && r.id && !seen.has(r.id)) { seen.add(r.id); merged.push({ reviewId: r.id, authorName: r.author, reviewDate: r.date, reviewText: r.text, starRating: r.star, details: {} }); } });
                    payload.reviews = merged;
                }
                await GM_deleteValue(window.location.href + '::partial');
            } catch (e) { /* ignore merge checkpoint errors */ }
            clearInterval(_progressTick);
await GM_setValue(TASK_KEY, payload);
await GM_setValue('progress:' + TASK_KEY, { count: payload.reviews.length, ts: Date.now(), done: true });
            try { BC && BC.postMessage({ type: 'worker_done', url: window.location.href, count: (payload.reviews||[]).length }); } catch (e) { /* ignore */ }
            try { BC && BC.postMessage({ type: 'worker_progress', url: window.location.href, count: 0, ts: Date.now() }); } catch (e) { /* ignore final progress post error */ }
            argusSafeClose();
        }
    }

    function heartbeat() {
        let workersCleaned = 0;
        for (const url in state.activeWorkers) {
            const workerTab = state.activeWorkers[url].tab;
            if (workerTab.closed) {
                delete state.activeWorkers[url];
                workersCleaned++;
            }
        }
        if (workersCleaned > 0) {
            console.log(`[Argus Heartbeat] Cleaned up ${workersCleaned} closed/ghost worker(s).`);
        }
        try {
          window.dispatchEvent(new CustomEvent('argus:heartbeat', { detail: Date.now() }));
          if (document.hidden) { void Promise.resolve(); }
        } catch (e) { /* ignore */ }
    }

    /**
     * Orchestrator: dispatch workers with concurrency control and HUD updates.
     * Public API: toggles dispatch loop and cleans up intervals.
     */
    async function runOrchestrator() {
        if (state.isDispatching) {
            updateLog('Tạm dừng điều phối...');
            state.dispatchInterval = safeClearInterval(state.dispatchInterval);
            state.uiUpdateInterval = safeClearInterval(state.uiUpdateInterval);
            state.isDispatching = false;
            // GIỮ activeWorkers để không mất tracking
            try { BC && BC.postMessage({ type: 'pause' }); } catch (e) { /* ignore broadcast error */ }
            document.getElementById('argus-start-scraping-btn').textContent = 'Tiếp tục Thu thập';
            updateLog('Đã tạm dừng. Nhấn "Tiếp tục" để tiếp tục.');
            return;
        }
        const initialQueue = await GM_getValue(KV.URLQ, []);
        if (initialQueue.length === 0) {
            alert('Hàng đợi rỗng. Vui lòng trích xuất links hoặc import.');
            return;
        }
        if (state.isDispatching) return; // double-guard
        state.isDispatching = true;
        document.getElementById('argus-start-scraping-btn').textContent = 'Dừng Điều phối';
        updateLog(`Bắt đầu điều phối ${initialQueue.length} tasks...`);

        state.uiUpdateInterval = setInterval(()=>{ try { void updateProgress(); } catch(e){ /* ignore */ } }, CONFIG.orchestrator.uiUpdateIntervalMs);

        state.dispatchInterval = setInterval(async () => {
            try {
                heartbeat();
                const urlQueue = await GM_getValue(KV.URLQ, []);
                const activeCount = Object.keys(state.activeWorkers).length;
                updateLog(`Hàng đợi: ${urlQueue.length} | Đang chạy: ${activeCount}`);
// [Argus][AutoClose] Đóng những worker đã lưu payload xong
for (const url of Object.keys(state.activeWorkers)) {
  const payload = await GM_getValue(url);
  if (payload && payload.status === 'SUCCESS') {
    try {
      const w = state.activeWorkers[url];
      if (w.type === 'tab' && w.tab && w.tab.close) w.tab.close();
      if (w.type === 'frame' && w.tab && w.tab.remove) w.tab.remove();
    } catch (e) {
      trace('autoclose:error', { url, e: String(e) });
    }
    delete state.activeWorkers[url];
  }
}

trace('orchestrator:tick', {
  queue: urlQueue.length,
  active: Object.keys(state.activeWorkers).length,
  keys: await GM_listValues()
});
                if (urlQueue.length === 0 && activeCount === 0) {
                    state.dispatchInterval = safeClearInterval(state.dispatchInterval);
                    state.uiUpdateInterval = safeClearInterval(state.uiUpdateInterval);
                    state.isDispatching = false;
                    document.getElementById('argus-start-scraping-btn').textContent = 'Bắt đầu Thu thập';
                    document.getElementById('argus-start-scraping-btn').disabled = true;
                    updateLog('Hoàn tất tất cả các tác vụ!');
                    await updateProgress(); // Final update
                    alert('Project Argus: Quá trình thu thập dữ liệu đã hoàn tất! Bây giờ bạn có thể xuất dữ liệu.');
                    return;
                }
                if (activeCount < CONFIG.orchestrator.maxConcurrentWorkers && urlQueue.length > 0) {
                    const task = urlQueue.shift();
                    await GM_setValue('urlQueue', urlQueue);
                    // Gắn khoá thống nhất cho Worker qua hash
const openUrl = task.url + (task.url.includes('#') ? '&' : '#') + 'argusKey=' + encodeURIComponent(task.url);

// Mở theo mode: iframe (né throttling) hoặc tab (cũ)
let opened;
if (ARGUS_BG.useIframes) {
  opened = spawnIframeWorker(openUrl);
} else {
  opened = (typeof GM !== 'undefined' && typeof GM.openInTab === 'function')
    ? GM.openInTab(openUrl, {active:false, insert:true})
    : (typeof GM_openInTab === 'function'
        ? GM_openInTab(openUrl, {active:false, insert:true})
        : window.open(openUrl, '_blank', 'noopener'));
}
// Track expected reviews for ETA
state.expectedByUrl = state.expectedByUrl || {};
state.expectedByUrl[task.url] = task.expectedReviews || 0;
state.activeWorkers[task.url] = { tab: opened, type: ARGUS_BG.useIframes ? 'frame' : 'tab', timestamp: Date.now() };
                }
            } catch (error) {
                console.error('[Argus Orchestrator] A critical error occurred in the dispatch loop:', error);
                updateLog('Lỗi nghiêm trọng trong bộ điều phối! Kiểm tra console.');
            }
        }, CONFIG.orchestrator.heartbeatIntervalMs);
    }

    /**
     * Export all SUCCESS payloads as JSON file.
     * Public API: gathers per-URL payloads and downloads as file.
     */
    async function runDataExporter() {
        updateLog('Đang tổng hợp dữ liệu...');
        const allKeys = await GM_listValues();
        const reviewKeys = allKeys.filter(k => k.startsWith('https://'));
        if (reviewKeys.length === 0) {
            alert('Không có dữ liệu review nào được lưu trữ.');
            return;
        }
        let allData = [];
        for (const key of reviewKeys) {
            const payload = await GM_getValue(key);
            if (payload && payload.status === 'SUCCESS') {
                allData.push(payload);
            }
        }
        updateLog(`Đã tổng hợp dữ liệu từ ${allData.length} địa điểm.`);
        const jsonString = JSON.stringify(allData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = 'argus_data_export.json';
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
        updateLog('Đã xuất file argus_data_export.json!');
    }

    async function exportLinkList() {
        updateLog('Đang chuẩn bị file export links...');
        const urlQueue = await GM_getValue(KV.URLQ, []);
        if (urlQueue.length === 0) {
            alert('Không có link nào trong hàng đợi để export.');
            return;
        }
        const jsonString = JSON.stringify(urlQueue, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = 'argus_link_list.json';
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
        updateLog('Đã xuất danh sách links!');
    }

    function importLinkList() {
        updateLog('Vui lòng chọn file .json để import...');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.style.display = 'none';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                document.body.removeChild(input);
                return;
            }
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    let importedData = JSON.parse(event.target.result);
                    if (!Array.isArray(importedData)) {
                        throw new Error('Invalid file format. Expected a JSON array.');
                    }
                    let transformedData = [];
                    if (importedData.length > 0) {
                        const firstElement = importedData[0];
                        if (typeof firstElement === 'string') {
                            transformedData = importedData.map(url => ({ url: url, expectedReviews: 0 }));
                        } else if (typeof firstElement === 'object' && firstElement !== null && typeof firstElement.url === 'string') {
                            transformedData = importedData;
                        } else {
                            throw new Error('Invalid array content.');
                        }
                    }
                    const totalExpected = transformedData.reduce((sum, item) => sum + (item.expectedReviews || 0), 0);
                    await GM_setValue('urlQueue', transformedData);
                    await GM_setValue('totalExpectedReviews', totalExpected);
                    if (window.hardResetProgress) { await window.hardResetProgress({ includeQueue: false }); }
                    await updateProgress();
                    updateLog(`Đã import thành công ${transformedData.length} links.`);
                    await updateUIState();
                } catch (error) {
                    alert(`Lỗi khi import file: ${error.message}`);
                    console.error(error);
                } finally {
                    document.body.removeChild(input);
                }
            };
            reader.readAsText(file);
        };
        document.body.appendChild(input);
        input.click();
    }

    async function clearStorage() {
  if (!confirm('Bạn có chắc chắn muốn xóa TẤT CẢ dữ liệu?')) return;
  updateLog('Đang xóa dữ liệu...');
  try {
    const allKeys = await GM_listValues();
    const del = [];
    for (const k of allKeys) {
      const shouldDelete =
        k.startsWith('http://') ||
        k.startsWith('https://') ||
        k.startsWith('progress:') ||
        k.endsWith('::partial') ||
        k === 'urlQueue' ||
        k === 'totalExpectedReviews' ||
        k === 'argus.progress' ||
        k === 'argus.progress.links' ||
        k === 'argus.progress.reviews';

      if (shouldDelete) del.push(GM_deleteValue(k));
    }

    await Promise.all(del);

    // Reset cache aggregator và HUD về 0/0
    window.__argusProg__ = { per: new Map(), total: 0 };
    await GM_setValue('argus.progress.links', { discovered: 0, total: 0 });
    await GM_setValue('argus.progress.reviews', { collected: 0, expected: 0 });
    await GM_setValue('argus.progress', { collected: 0, total: 0 });
    await updateProgress();
    console.log('[Argus][Progress] Reset to 0 (cleared all storages).');
    updateLog('Đã xóa & reset xong, không cần reload trang.');

    // Báo cho worker/tabs khác clear theo
    try { BC && BC.postMessage({ type: 'clear' }); } catch (e) { /* ignore */ }

    // Reset state timers nếu có
    state.dispatchInterval = safeClearInterval(state.dispatchInterval);
    state.uiUpdateInterval = safeClearInterval(state.uiUpdateInterval);
  } catch (e) {
    console.error('[Argus][Clear] Failed:', e);
    updateLog('Lỗi khi xóa dữ liệu. Vui lòng kiểm tra console.');
  }
}

    // =================================================================
    // --- V. INITIALIZATION ---
    // =================================================================

    function addEventListeners() {
        const safe = (fn) => () => { void (async()=>{ try { await fn(); } catch(e){ console.error(e); } })(); };
        document.getElementById('argus-extract-links-btn').addEventListener('click', safe(runLinkExtraction));
        document.getElementById('argus-start-scraping-btn').addEventListener('click', safe(runOrchestrator));
        document.getElementById('argus-export-data-btn').addEventListener('click', safe(runDataExporter));
        document.getElementById('argus-clear-storage-btn').addEventListener('click', safe(clearStorage));
        document.getElementById('argus-export-links-btn').addEventListener('click', safe(exportLinkList));
        document.getElementById('argus-import-links-btn').addEventListener('click', safe(importLinkList));
        const hardBtn = document.getElementById('argus-hard-stop-btn');
        if (hardBtn) hardBtn.addEventListener('click', safe(hardStop));
        const resetBtn = document.getElementById('argus-reset-progress-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => { void (async()=>{
          if (window.hardResetProgress) { await window.hardResetProgress({ includeQueue: false }); }
          await updateProgress();
          console.log('[Argus][Progress] Manual reset via hardResetProgress');
        })().catch(console.error); });
    }

    function injectUI() {
        if (document.getElementById('argus-control-panel')) return;
        const controlPanel = document.createElement('div');
        controlPanel.id = 'argus-control-panel';
        controlPanel.innerHTML = `
            <div class="argus-header">Project Argus Master Scraper</div>
            <div class="argus-body">
                <div class="argus-section">Pipeline</div>
                <div class="argus-grid">
                    <button id="argus-extract-links-btn" class="argus-btn argus-btn-primary">1. Trích xuất Links</button>
                    <button id="argus-start-scraping-btn" class="argus-btn argus-btn-primary" disabled>2. Bắt đầu / Tiếp tục</button>
                    <button id="argus-export-data-btn" class="argus-btn argus-btn-success">3. Xuất Dữ liệu (JSON)</button>
                </div>
                <div class="argus-section">Data IO</div>
                <div class="argus-grid">
                    <button id="argus-export-links-btn" class="argus-btn argus-btn-secondary">Export Links</button>
                    <button id="argus-import-links-btn" class="argus-btn argus-btn-secondary">Import Links</button>
                </div>
                <div class="argus-section">Safety</div>
                <div class="argus-grid">
                    <button id="argus-clear-storage-btn" class="argus-btn argus-btn-danger">Xóa Dữ liệu cũ</button>
                    <button id="argus-hard-stop-btn" class="argus-btn argus-btn-danger">Hard Stop</button>
                </div>
                <div id="argus-log-area">Chờ lệnh...</div>
                <div id="argus-progress-container" style="display: none;">
                    <div id="argus-progress-text"></div>
                    <div id="argus-progress-bar-outer">
                        <div id="argus-progress-bar-inner"></div>
                    </div>
                    <button id="argus-reset-progress-btn" class="argus-btn argus-btn-secondary" style="margin-top:8px;padding:6px 8px;font-size:11px;">Reset Progress</button>
                </div>
                <div id="argus-per-url-container" style="display: none;">
                    <div id="argus-per-url-progress"></div>
                </div>
            </div>
        `;
        document.body.appendChild(controlPanel);
        GM_addStyle(`
            #argus-control-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 350px;
                background: #fff;
                border: 2px solid #007bff;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-height: 80vh;
                overflow-y: auto;
            }
            .argus-header {
                background: linear-gradient(135deg, #007bff, #0056b3);
                color: white;
                padding: 15px;
                text-align: center;
                font-weight: bold;
                font-size: 16px;
                border-radius: 8px 8px 0 0;
            }
            .argus-body {
                padding: 20px;
            }
            .argus-section { font-weight:600; font-size:12px; color:#495057; margin:10px 0 6px; text-transform:uppercase; letter-spacing:.4px; }
            .argus-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
            .argus-grid .argus-btn { width:100%; margin:0; }
            .argus-btn {
                width: 100%;
                padding: 12px;
                margin: 5px 0;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: center;
            }
            .argus-btn-primary {
                background: linear-gradient(135deg, #007bff, #0056b3);
                color: white;
            }
            .argus-btn-primary:hover {
                background: linear-gradient(135deg, #0056b3, #004085);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,123,255,0.3);
            }
            .argus-btn-success {
                background: linear-gradient(135deg, #28a745, #1e7e34);
                color: white;
            }
            .argus-btn-success:hover {
                background: linear-gradient(135deg, #1e7e34, #155724);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(40,167,69,0.3);
            }
            .argus-btn-secondary {
                background: linear-gradient(135deg, #6c757d, #545b62);
                color: white;
            }
            .argus-btn-secondary:hover {
                background: linear-gradient(135deg, #545b62, #3d4449);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(108,117,125,0.3);
            }
            .argus-btn-danger {
                background: linear-gradient(135deg, #dc3545, #c82333);
                color: white;
            }
            .argus-btn-danger:hover {
                background: linear-gradient(135deg, #c82333, #a71e2a);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(220,53,69,0.3);
            }
            #argus-hard-stop-btn { margin-top: 6px; }
            .argus-btn:disabled {
                background: #e9ecef;
                color: #6c757d;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }
            .argus-divider {
                height: 1px;
                background: linear-gradient(90deg, transparent, #dee2e6, transparent);
                margin: 15px 0;
            }
            #argus-log-area {
                margin-top: 15px;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 6px;
                font-size: 12px;
                color: #495057;
                max-height: 150px;
                overflow-y: auto;
                border: 1px solid #dee2e6;
                white-space: pre-wrap;
                line-height: 1.4;
            }
            #argus-progress-container {
                margin-top: 15px;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 6px;
                border: 1px solid #dee2e6;
            }
            #argus-progress-text {
                font-size: 12px;
                color: #495057;
                margin-bottom: 8px;
                text-align: center;
                font-weight: 500;
            }
            #argus-progress-bar-outer {
                width: 100%;
                height: 20px;
                background: #e9ecef;
                border-radius: 10px;
                overflow: hidden;
                position: relative;
            }
            #argus-progress-bar-inner {
                height: 100%;
                background: linear-gradient(90deg, #007bff, #0056b3);
                border-radius: 10px;
                transition: width 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 11px;
                font-weight: bold;
                min-width: 30px;
            }
            #argus-per-url-container {
                margin-top: 10px;
                padding: 8px;
                background: #f8f9fa;
                border-radius: 6px;
                border: 1px solid #dee2e6;
                max-height: 120px;
                overflow-y: auto;
            }
            #argus-per-url-progress {
                font-size: 11px;
                color: #495057;
            }
            .argus-per-row {
                display: grid;
                grid-template-columns: 28px 1fr 80px 80px 70px; /* rank | url | count | rpm | eta */
                gap: 6px;
                align-items: center;
                padding: 4px 6px;
                border-bottom: 1px solid #f1f3f5;
                font-variant-numeric: tabular-nums;
            }
            .argus-per-row:last-child { border-bottom: none; }
            .argus-per-rank { color: #6c757d; text-align: right; }
            .argus-per-url { color: #212529; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .argus-per-count { text-align: right; font-variant-numeric: tabular-nums; }
            .argus-per-rpm { text-align: right; font-variant-numeric: tabular-nums; }
            .argus-per-eta { text-align: right; font-variant-numeric: tabular-nums; }
        `);
    }

    async function hardStop() {
        updateLog('Hard Stop: closing workers & re-queueing...');
        state.isDispatching = false;
        state.dispatchInterval = safeClearInterval(state.dispatchInterval);
        state.uiUpdateInterval = safeClearInterval(state.uiUpdateInterval);
        try { BC && BC.postMessage({ type: 'hard_stop' }); } catch (e) { /* ignore */ }

        let urlQueue = (await GM_getValue('urlQueue', [])) || [];
        const requeued = [];
        for (const url in state.activeWorkers) {
            try { if (state.activeWorkers[url].tab) state.activeWorkers[url].tab.close(); } catch (e) { /* ignore */ }
            requeued.push({ url, expectedReviews: state.expectedByUrl[url] || 0 });
            try { await GM_deleteValue('progress:' + url); } catch (e) { /* ignore */ }
            delete state.activeWorkers[url];
        }
        urlQueue = requeued.concat(urlQueue);
        await GM_setValue(KV.URLQ, urlQueue);
        state.inflightProgress = {};
        await updateUIState(); await updateProgress();
        updateLog(`Hard Stop hoàn tất. Đã re-queue ${requeued.length} liên kết.`);
    }

    (async function main() {
        await sleep(2000);
        if (window.location.href.includes('/search')) {
            injectUI();
            addEventListeners();
            updateUIState();
        } else if (window.location.href.includes('/place/')) {
            await runScrapingWorker();
        }
    })();

    function argusWorkerHeartbeat() {
        try {
            if (document && document.title) {
                const t = document.title;
                if (!argusWorkerHeartbeat._base) argusWorkerHeartbeat._base = t;
                document.title = (document.title.endsWith('•'))
                    ? argusWorkerHeartbeat._base
                    : (argusWorkerHeartbeat._base + ' •');
            }
        } catch (e) { /* ignore */ }
    }
    try { setInterval(argusWorkerHeartbeat, 30000); } catch (e) { /* ignore */ }

/* ===================== ARGUS: Autostart + Progress (BroadcastChannel) ===================== */
/* id:ARGUS_AUTOSTART_PROGRESS */

 (function(){
  if (window.__ARGUS_AUTOSTART_PROGRESS__) return;
  window.__ARGUS_AUTOSTART_PROGRESS__ = true;

  const BC_START = CH.START;
  const BC_PROGRESS = CH.PROGRESS;

  // ---------- Child-tab bootstrap: autostart without manual click ----------
  (function childAutostart(){
    let started = false;
    function start(reason){
      if (started) return; started = true;
      setTimeout(()=>{
        try {
          if (typeof runScrapingWorker === 'function') {
            runScrapingWorker();
          } else {
            window.dispatchEvent(new CustomEvent('ARGUS:START'));
          }
        } catch(e){ console.warn('[Argus][Autostart]', e); }
      }, 120);
    }
    try {
      const bc = new BroadcastChannel(BC_START);
      bc.addEventListener('message', ev => {
        if (ev && ev.data && ev.data.type === 'start') start('bc');
      });
    } catch (e) { /* ignore */ }
    if (location.hash.includes('argus_autostart=1') || location.search.includes('argus_autostart=1')) start('url');
    window.addEventListener('pageshow', ()=>{ if (!started) start('pageshow'); }, {once:true});
  })();

  // ---------- Opener-side wrappers: ensure autostart flag when opening tabs ----------
  (function openerWraps(){
    function withAutostartFlag(u){
      try {
        const url = String(u||'');
        const hasHash = url.includes('#');
        const sep = hasHash ? '&' : '#';
        return url + sep + 'argus_autostart=1';
      } catch (e) { return u; }
    }

    function shouldAutostart(url){
      try {
        // only rewrite Google Maps place/search links
        return /https?:\/\/(www\.)?google\.[^/]+\/maps\//.test(url);
      } catch (e) { return false; }
    }

    // GM.openInTab / GM_openInTab
    try {
      if (typeof GM !== 'undefined' && typeof GM.openInTab === 'function'){
        const __orig = GM.openInTab;
        GM.openInTab = function(url, opts){
          const u = (shouldAutostart(url) ? withAutostartFlag(url) : url);
          const ret = __orig.call(this, u, Object.assign({active:false, insert:true}, opts||{}));
          try { const bc = new BroadcastChannel(BC_START); setTimeout(()=>bc.postMessage({type:'start'}), 250); } catch (e) { /* ignore */ }
          return ret;
        };
      }
        } catch (e) { /* ignore */ }

    try {
      if (typeof GM_openInTab === 'function'){
        const __orig2 = GM_openInTab;
        window.GM_openInTab = function(url, opts){
          const u = (shouldAutostart(url) ? withAutostartFlag(url) : url);
          const ret = __orig2.call(null, u, Object.assign({active:false, insert:true}, opts||{}));
          try { const bc = new BroadcastChannel(BC_START); setTimeout(()=>bc.postMessage({type:'start'}), 250); } catch (e) { /* ignore */ }
          return ret;
        };
            }
    } catch (e) { /* ignore */ }

    // window.open fallback
    try {
      const __wopen = window.open;
      window.open = function(url, target, features){
        try {
          const u = (shouldAutostart(url) ? withAutostartFlag(url) : url);
          const w = __wopen.call(window, u, target||'_blank', features);
          if (shouldAutostart(u)) { try { const bc = new BroadcastChannel(BC_START); setTimeout(()=>bc.postMessage({type:'start'}), 250); } catch (e) { /* ignore */ } }
          return w;
        } catch (e) {
          return __wopen.call(window, url, target, features);
        }
      };
    } catch (e) { /* ignore */ }
  })();

  // ---------- Progress channel: workers emit, coordinator aggregates ----------
  (function progressWireup(){
    const isCoordinator = !window.opener; // main dashboard likely has no opener

    // Worker-side: emit progress when logs indicate growth
    try {
      const bc = new BroadcastChannel(BC_PROGRESS);
      const emit = (count, meta)=>{
        try {
          bc.postMessage({ type:'progress', url: location.href, count: Number(count)||0, meta: meta||{}, ts: Date.now() });
        } catch (e) { /* ignore */ }
      };
      // Hook updateLog to parse counts
      const origUpdateLog = window.updateLog;
      window.updateLog = function(){
        try {
          const args = Array.from(arguments);
          const msg = (args && args[0]) ? String(args[0]) : '';
          // Patterns from previous worker logs
          let m = msg.match(/\bReviews loaded:\s*(\d+)\b/);
          if (!m) m = msg.match(/\[HD\]\s*growth\s*\d+\s*→\s*(\d+)/);
          if (!m) m = msg.match(/\[Worker\]\s*Reviews loaded:\s*(\d+)/);
          if (m) emit(parseInt(m[1],10), { source:'log' });
        } catch (e) { /* ignore */ }
        if (typeof origUpdateLog === 'function') return origUpdateLog.apply(this, arguments);
      };
      // Optional explicit event
      window.addEventListener('ARGUS:PROGRESS', (ev)=>{
        if (ev && ev.detail && ev.detail.count != null) emit(ev.detail.count, { source:'event' });
      });
        } catch (e) { /* ignore */ }

     // Coordinator-side: receive & update UI (HUD fallback if no existing UI)
     if (isCoordinator){
      const bc = new BroadcastChannel(BC_PROGRESS);
      const state = new Map(); // url -> count

      function ensureHUD(){
        let hud = document.getElementById('__argus_progress_hud__');
        if (hud) return hud;
        hud = document.createElement('div');
        hud.id = '__argus_progress_hud__';
        Object.assign(hud.style, {
          position:'fixed', right:'12px', bottom:'12px', zIndex: 2147483647,
          background:'rgba(0,0,0,.7)', color:'#fff', padding:'8px 10px',
          font:'12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial',
          borderRadius:'8px', boxShadow:'0 2px 10px rgba(0,0,0,.35)',
          maxWidth:'44vw',
          pointerEvents:'none'
        });
        hud.innerHTML = '<div style="font-weight:600;margin-bottom:4px">Argus Progress</div><div id="__argus_progress_list__"></div>';
        document.body.appendChild(hud);
        return hud;
      }

      function render(){
        // If app has its own function, use it
        if (typeof window.updateProgressUI === 'function'){
          try { window.updateProgressUI(state); return; } catch (e) { /* ignore */ }
        }
        const hud = ensureHUD();
        const list = hud.querySelector('#__argus_progress_list__');
        const arr = Array.from(state.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);
        list.innerHTML = arr.map(([u,c])=>`<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="opacity:.75">${c.toLocaleString()}:</span> ${u}</div>`).join('');
        try { document.title = document.title.replace(/^Argus \[\d+\]\s*/,''); document.title = `Argus [${Array.from(state.values()).reduce((s,n)=>s+Number(n||0),0)}] ` + document.title; } catch (e) { /* ignore */ }
      }

      bc.addEventListener('message', (ev)=>{
        try{
          const d = ev && ev.data || {};
          if (d.type === 'progress' && d.url){
            state.set(d.url, Number(d.count)||0);
            render();
          }
        }catch(e){ /* ignore */ }
      });
    }
  })();

})();

/* ===================== ARGUS: Terminal Detection + Auto-Close ===================== */
/* id:ARGUS_TERMINAL_AUTOCLOSE */

(function(){
  if (window.__ARGUS_TERMINAL_AUTOCLOSE__) return;
  window.__ARGUS_TERMINAL_AUTOCLOSE__ = true;

  // Flags (can be overridden before worker starts)
  window.ARGUS_AUTO_CLOSE = (window.ARGUS_AUTO_CLOSE !== false); // default true
  window.ARGUS_CLOSE_DELAY_MS = window.ARGUS_CLOSE_DELAY_MS || 800;
  window.ARGUS_COORD_CHANNEL = window.ARGUS_COORD_CHANNEL || CH.COORD;
  window.ARGUS_PROGRESS_CHANNEL = window.ARGUS_PROGRESS_CHANNEL || CH.PROGRESS;

  let _doneFired = false;

  function postCoord(msg){
    try { new BroadcastChannel(window.ARGUS_COORD_CHANNEL).postMessage(msg); } catch (e) { /* ignore */ }
  }
  function postProgress(count, meta){
    try { new BroadcastChannel(window.ARGUS_PROGRESS_CHANNEL).postMessage({type:'progress', url:location.href, count:Number(count)||0, meta:meta||{}, ts:Date.now()}); } catch (e) { /* ignore */ }
  }

  function tryWindowClose(){
    try { window.close(); } catch (e) { /* ignore */ }
  }

  function markDone(meta){
    if (_doneFired) return;
    _doneFired = true;
    const m = meta || {};
    try { if (m.count != null) postProgress(m.count, Object.assign({final:true}, m)); } catch (e) { /* ignore */ }
    try { postCoord({ type:'worker_done', url: location.href, final: true, meta: m, ts: Date.now() }); } catch (e) { /* ignore */ }

    if (window.ARGUS_AUTO_CLOSE){
      setTimeout(()=>{
        tryWindowClose();
      }, Number(window.ARGUS_CLOSE_DELAY_MS)||600);
    }
  }

  // Expose public API
  window.ARGUS_MARK_DONE = markDone;

  // Hook updateLog to detect terminal conditions:
  //  - "[HD] pass complete @N"
  //  - "No growth (idle=16/16)" or localized equivalent
  //  - "Hoàn tất!" lines in your aggregator
  const _origUpdateLog = window.updateLog;
  window.updateLog = function(){
    try {
      const args = Array.from(arguments);
      const msg = (args && args[0]) ? String(args[0]) : '';
      // Detect counts from patterns
      let cnt = null;
      let m = msg.match(/\bpass complete\s*@\s*(\d+)/i);
      if (!m) m = msg.match(/\bReviews loaded:\s*(\d+)\b/i);
      if (!m) m = msg.match(/\bgrowth\s*\d+\s*[→>-]\s*(\d+)/i);
      if (m) cnt = parseInt(m[1], 10);

      // Terminal triggers
      const isPassComplete = /\bpass complete\b/i.test(msg);
      const isIdleMax = /\b(idle\s*=\s*16\/16|idle\s*16\/16|No growth\s*\(idle=16\/16\))\b/i.test(msg);
      const isHoanTat = /Hoàn tất!/i.test(msg);

      if ((isPassComplete || isIdleMax || isHoanTat) && !_doneFired){
        markDone({ reason: isPassComplete ? 'hd_pass_complete' : isIdleMax ? 'idle_max' : 'final_log', count: cnt });
      }
    } catch (e) { /* ignore */ }
    if (typeof _origUpdateLog === 'function') return _origUpdateLog.apply(this, arguments);
  };

  // Optional: near-bottom watcher to short-circuit on finite lists
  // If ARGUS_HD exposes a panel, you can integrate a bottom detector; here provide a generic helper:
  window.ARGUS_SHORT_CIRCUIT_IF_NEAR_BOTTOM = function(panel, count){
    try {
      if (!panel) return false;
      const remain = panel.scrollHeight - (panel.scrollTop + panel.clientHeight);
      if (remain < 48 && count != null && count < 25) { // small pages like 8, 10, 12 reviews
        markDone({ reason:'near_bottom_finite', count });
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  };

})();

/* ===================== ARGUS: SuperControl (Trace + Autostart + Progress + Collector + Coordinator) ===================== */
/* id:ARGUS_SUPERCONTROL */

(function(){
  if (window.__ARGUS_SUPERCONTROL__) return;
  window.__ARGUS_SUPERCONTROL__ = true;

  /* -------------------- TRACE: structured event logging -------------------- */
  (function trace(){
    const KEY = 'ARGUS_TRACE_RING';
    const MAX = 500;
    const enabled = window.ARGUS_TRACE_ENABLED !== false; // default true
    let ring = [];
    try { const raw = localStorage.getItem(KEY); if (raw) ring = JSON.parse(raw)||[]; } catch (e) { /* ignore */ }
    function persist(){ try { localStorage.setItem(KEY, JSON.stringify(ring.slice(-MAX))); } catch (e) { /* ignore */ } }
    function now(){ return new Date().toISOString(); }
    function log(level, msg, data){
      if (!enabled) return;
      const rec = { t: now(), lvl: level, msg: String(msg||''), data: data||null, href: location.href };
      ring.push(rec); if (ring.length > MAX+50) ring = ring.slice(-MAX);
      persist();
      try { console[level === 'err' ? 'error' : (level === 'warn' ? 'warn' : 'log')]('[Argus][Trace]', rec); } catch (e) { /* ignore */ }
    }
    window.ARGUS_TRACE = Object.assign(function(msg,data){ log('log',msg,data); }, {
      log:(m,d)=>log('log',m,d),
      warn:(m,d)=>log('warn',m,d),
      err:(m,d)=>log('err',m,d),
      get:()=>ring.slice(),
      clear:()=>{ ring = []; persist(); },
      export:()=>ring.slice()
    });
    window.ARGUS_TRACE('trace:init', {size:ring.length});

// [PATCH][Argus][Trace] progress:session-init
(() => {
  const sid = Date.now() + ':' + Math.random().toString(36).slice(2);
  const zero = { sid, collected: 0, total: 0, seen: [] };
  try { GM_setValue('argus.progress', zero); } catch (e) { /* ignore */ }
  window.__ARGUS_SESSION_ID__ = sid;

  // ép UI đọc KV duy nhất
  const kv = (typeof GM_getValue==='function' ? GM_getValue('argus.progress') : zero) || zero;
  window.__ARGUS_PROGRESS_RENDER__ = () => {
    const p = (typeof GM_getValue==='function' ? GM_getValue('argus.progress') : kv) || kv;
    try { if (typeof window.renderProgress==='function') window.renderProgress(p.collected || 0, p.total || 0); } catch(e){ /* ignore */ }
  };

  console.log('[Argus][Trace] progress:reset UI+KV -> 0/0');
  try { window.__ARGUS_PROGRESS_RENDER__(); } catch(e){ /* ignore */ }
})();
// === Argus Core Helpers & Config ===========================================
// Cấu hình người dùng: search grid & UI animation
window.ArgusConfig = Object.assign({
  ui: { tweenMs: 650, tickMsHidden: 250 },
  search: { gridProfile: 'dense' }
}, window.ArgusConfig || {});
console.log('[Argus][Trace] config:init', JSON.parse(JSON.stringify(window.ArgusConfig)));

// [Argus][Trace] progress:session:boot
const ARGUS_PROGRESS_KEY = 'argus.progress';
const sessionId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
try { GM_setValue('argus.sessionId', sessionId); } catch (e) { /* ignore */ }

// Hard reset (UI + KV) vào đầu session
const prevKV = (typeof GM_getValue==='function' ? GM_getValue(ARGUS_PROGRESS_KEY, {collected:0,total:0,seen:[]}) : {collected:0,total:0,seen:[]});
console.log('[Argus][Trace] progress:reset (boot) prevKV ->', prevKV);
try { GM_setValue(ARGUS_PROGRESS_KEY, {sessionId, collected:0, total:0, seen:[]}); } catch (e) { /* ignore */ }
try {
  const ui = (window.__argusUI && window.__argusUI.renderProgressFromKV) ? null : (window.__argus_ui_progress__ ||= { collected:0, total:0 });
  if (ui) { ui.collected = 0; ui.total = 0; }
  if (typeof window.renderProgress==='function') window.renderProgress(0, 0);
} catch (e) { /* ignore */ }
console.log('[Argus][Trace] progress:reset UI+KV -> 0/0', {sessionId});

// Telemetry wrappers
const kv = {
  read(){ const v = (typeof GM_getValue==='function' ? GM_getValue(ARGUS_PROGRESS_KEY, {sessionId, collected:0, total:0, seen:[]}) : {sessionId, collected:0, total:0, seen:[]});
          console.log('[Argus][Trace] progress:kv:read', v); return v; },
  write(p){ try { if (typeof GM_setValue==='function') GM_setValue(ARGUS_PROGRESS_KEY, p); } catch (e) { /* ignore */ } console.log('[Argus][Trace] progress:kv:write', p); },
  del(){ try { if (typeof GM_deleteValue==='function') GM_deleteValue(ARGUS_PROGRESS_KEY); } catch (e) { /* ignore */ } console.log('[Argus][Trace] progress:kv:delete'); }
};
window.__ARGUS_KV__ = kv;

async function hardResetProgress(opts = { includeQueue: false }) {
  const sid = Date.now().toString(36);
  try { if (typeof GM_setValue === 'function') await GM_setValue('argus.sessionId', sid); } catch(e){/*ignore*/}

  const keys = await GM_listValues();
  const dels = [];
  for (const k of keys) {
    if (
      k === 'argus.progress' ||
      k === 'totalExpectedReviews' ||
      k === 'argus.extract.queue' ||
      k === 'argus.extract.state' ||
      k.endsWith('::partial') ||
      k.startsWith('progress:') ||
      (opts.includeQueue && (k === 'urlQueue'))
    ) {
      dels.push(GM_deleteValue(k));
    }
  }
  await Promise.all(dels);

  // Reset phiên progress trong bộ nhớ
  window.__argusProg__ = { per: new Map(), total: 0 };
  // Ghi progress 0/0 (nguồn sự thật duy nhất) - đặt cả 3 keys + gọi updateProgress sau cùng
  try { 
    await GM_setValue('argus.progress.links', { discovered: 0, total: 0 }); 
    await GM_setValue('argus.progress.reviews', { collected: 0, expected: 0 }); 
    await GM_setValue('argus.progress', { sessionId: sid, collected: 0, total: 0, seen: [] }); 
  } catch(e){/*ignore*/}

  // Làm mới UI ngay
  try {
    if (typeof window.renderProgress === 'function') window.renderProgress({ collected: 0, total: 0 });
    if (typeof window.refreshProgressFromKV === 'function') window.refreshProgressFromKV();
    const pc = document.getElementById('argus-progress-container');
    if (pc) {
      const txt = document.getElementById('argus-progress-text');
      const bar = document.getElementById('argus-progress-bar-inner');
      pc.style.display = 'block';
      if (txt) txt.textContent = '0 / 0 Reviews';
      if (bar) { bar.style.width = '0%'; bar.textContent = '0.0%'; }
    }
  } catch(e){/*ignore*/}

  // Gọi updateProgress sau cùng để đảm bảo UI phản ánh đúng trạng thái
  try { await updateProgress(); } catch(e){/*ignore*/}
  console.log('[Argus][Trace] hardResetProgress done', { sessionId: sid, includeQueue: !!opts.includeQueue });
}

// Progress UI refresh strictly from KV
function refreshProgressFromKV(){
  try {
    const p = (window.__ARGUS_KV__||kv).read();
    const ui = (window.__argus_ui_progress__ ||= { collected:0, total:0 });
    ui.collected = p.collected||0;
    ui.total = p.total||0;
    try {
      if (typeof window.renderProgress === 'function') window.renderProgress(ui);
    } catch (e) { /* ignore */ }
    try { console.log('[Argus][Trace] progress:ui:refresh', { collected: ui.collected, total: ui.total }); } catch (e) { /* ignore */ }
  } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------------------------------
// [Argus][Trace] extract: init (manual-map, reset progress)
// ------------------------------------------------------------------------------------
window.cfg = window.cfg || {};
window.cfg.search = Object.assign({ allowPan:false }, window.cfg.search||{});

try {
  // Reset progress về 0 cho phiên Extract link mới
  window.__argusKV?.set('argus.progress.links', { discovered: 0, total: 0 }); 
  window.__argusKV?.set('argus.progress.reviews', { collected: 0, expected: 0 });
  // Đặt cả 3 keys + gọi updateProgress sau cùng
  GM_setValue('argus.progress', { collected: 0, total: 0 });
  // Gọi updateProgress bất đồng bộ để tránh lỗi await
  updateProgress().catch(e => console.log('[Argus][Trace] updateProgress error', e));
  console.log('[Argus][Trace] progress:reset (extract) 0/0');
} catch(e){ console.log('[Argus][Trace] progress:reset error', e); }

// Khởi tạo state nếu chưa có
try {
  if (window.__argusExtract && window.__argusExtract.getState && window.__argusExtract.getState() === window.__argusExtract.S.IDLE) {
    window.__argusExtract.setState(window.__argusExtract.S.IDLE);
    window.__argusExtract.setQ({ pending:[], seenKeys:[], total:0 });
  }
} catch (e) { /* ignore */ }

// [Argus][Trace] config:override (manual-map + links-only)
try {
  const cfg = (window.ArgusConfig || {});
  cfg.search = Object.assign({
    allowPan: false,
    linksOnly: true,
    listReadyTimeoutMs: 2500
  }, cfg.search || {});
  window.ArgusConfig = cfg;
  console.log('[Argus][Trace] config:override', { search: cfg.search });

  // Reset progress persisted + UI tại điểm sạch
  try { 
    GM_setValue('argus.progress.links', { discovered: 0, total: 0 }); 
    GM_setValue('argus.progress.reviews', { collected: 0, expected: 0 }); 
    GM_setValue('argus.progress', { collected: 0, total: 0 }); 
  } catch (e) { /* ignore */ }
  const ui = (window.__argusUI ||= { collected: 0, total: 0 });
  ui.collected = 0; ui.total = 0;
  const renderProgress = (window.__argusUI && typeof window.__argusUI.renderProgress === 'function') ? window.__argusUI.renderProgress : function(){};
  try { renderProgress(ui); } catch (e) { /* ignore */ }
  console.log('[Argus][Trace] progress:reset UI+KV -> 0/0');
} catch (e) {
  console.log('[Argus][Trace] config:override error', e);
}
// --- [Argus][Trace] progress:reset @session-begin --------------------------
const ArgusKV = {
  get(k, d) {
    try { return typeof GM_getValue === 'function' ? GM_getValue(k, d) : JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
  },
  set(k, v) {
    try { return typeof GM_setValue === 'function' ? GM_setValue(k, v) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }
};
if (!window.__argus_session_started__) {
  window.__argus_session_started__ = true;
  const freshLinks = { discovered: 0, total: 0 };
  const freshReviews = { collected: 0, expected: 0 };
  ArgusKV.set('argus.progress.links', freshLinks);
  ArgusKV.set('argus.progress.reviews', freshReviews);
  // Đặt cả 3 keys để đảm bảo single source of truth
  ArgusKV.set('argus.progress', { collected: 0, total: 0 });
  window.__argus_ui_progress__ = { collected: 0, total: 0 };
  console.log('[Argus][Trace] progress:reset UI+KV (links+reviews) -> 0/0');
  try { window.dispatchEvent(new CustomEvent('argus:progress:update', { detail: { ...window.__argus_ui_progress__, reason: 'session-reset' } })); } catch (e) { /* ignore */ }
}
// ---------------------------------------------------------------------------
// --- [Argus][Trace] deterministic search grid (pan & wait list ready) ------
const ArgusSearch = (function(){
  const WARMUP_MS = 500;
  const LIST_READY_HOLD_MS = 500;
  function getResultsContainer(){ return document.querySelector('[role="feed"], [aria-label*="Results"], .DxyBCb, .m6QErb'); }
  function listLength(){ const c=getResultsContainer(); return c? c.querySelectorAll('[jscontroller][data-result-id], a[href*="/place/"]').length : 0; }
  async function waitListReady(){
    await new Promise(r=>setTimeout(r, WARMUP_MS));
    let last=listLength(), t0=performance.now();
    for(;;){
      await new Promise(r=>setTimeout(r,120));
      const cur=listLength();
      if(cur!==last){ last=cur; t0=performance.now(); }
      // Nếu ở links-only mode, đừng chờ "ổn định" quá lâu
      try {
        const cfg = (window.ArgusConfig || {});
        if (cfg.search && cfg.search.linksOnly) {
          const start = (waitListReady._linksOnlyStartTs ||= Date.now());
          if (Date.now() - start > ((cfg.search && cfg.search.listReadyTimeoutMs) || 2500)){
            console.log('[Argus][Trace] list-ready:timeout (links-only) -> finalize snapshot');
            try { if (typeof window.__argusLinksOnlySnapshot === 'function') window.__argusLinksOnlySnapshot(); } catch (e) { /* ignore */ }
            return last;
          }
        }
      } catch (e) { /* ignore */ }
      if(performance.now()-t0>=LIST_READY_HOLD_MS) break;
    }
    console.log('[Argus][Trace] list-ready',{count:last});
    // Manual-map no-advance guard right after list-ready
    try {
      const cfg = (window.ArgusConfig || {});
      if (cfg.search && cfg.search.allowPan === false) {
        console.log('[Argus][Trace] list-ready (manual-map, no-advance)');
        return last;
      }
    } catch (e) { /* ignore */ }
    return last;
  }
  function currentBBoxFromURL(){ const m=location.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z/); if(!m) return null; return { center:{lat:parseFloat(m[1]), lng:parseFloat(m[2])}, zoom: parseInt(m[3],10)}; }
  async function panTo(lat,lng,zoom){
  try {
    const cfg = (window.ArgusConfig || {});
    if (!cfg.search || cfg.search.allowPan === false) {
      console.log('[Argus][Trace] pan-to suppressed (manual-map mode)', {lat,lng,zoom});
      return 0;
    }
  } catch (e) { /* ignore */ }
  try{
    history.replaceState(null,'',location.href.replace(/@-?\d+\.\d+,-?\d+\.\d+,\d+z/, `@${lat},${lng},${zoom}z`));
    window.dispatchEvent(new Event('popstate'));
    console.log('[Argus][Trace] pan-to',{lat,lng,zoom});
  }catch(e){ console.warn('[Argus][Trace] pan-to failed',e);}
  return waitListReady();
}
  async function scanGrid(opts){
  // [PATCH][Argus][Trace] scan-grid:manual-guard
  try{
    if (window.config && window.config.search && window.config.search.manualMap === true) {
      if (!window.__ARGUS_MANUAL_MAP_LOGGED__) {
        window.__ARGUS_MANUAL_MAP_LOGGED__ = true;
        console.log('[Argus][Trace] manual-map: grid scan disabled');
      }
      return;
    }
  }catch(e){ /* ignore */ }
  const bbox=currentBBoxFromURL(); const zoom=(opts&&opts.zoom)||(bbox?.zoom??15); const span=opts?.span||6; const stepDeg=opts?.stepDeg||0.01; const cx=bbox?.center?.lat??10.773, cy=bbox?.center?.lng??106.700; const centers=[]; for(let i=-Math.floor(span/2); i<=Math.floor(span/2); i++){ for(let j=-Math.floor(span/2); j<=Math.floor(span/2); j++){ centers.push([cx+i*stepDeg, cy+j*stepDeg]); } } let totalListed=0; for (const [lat,lng] of centers){ const count=await panTo(lat,lng,zoom); totalListed+=count; window.dispatchEvent(new CustomEvent('argus:scan:cell',{detail:{lat,lng,zoom,count}})); } console.log('[Argus][Trace] scan-grid:done',{cells:centers.length,totalListed}); }
  return { scanGrid };
})();
if (!window.__argus_scan_started__) {
  window.__argus_scan_started__ = true;
  try { ArgusSearch.scanGrid({ span: 6, stepDeg: 0.01, zoom: 15 }); } catch (e) { console.warn('[Argus][Trace] scan-grid:error', e); }
}
// ---------------------------------------------------------------------------
  })();

  /* -------------------- AUTOSTART: child bootstrap + open wrappers -------------------- */
  (function autostart(){
    const BC_START = CH.START;
    // Child bootstrap
    let started = false;
    function start(reason){
      if (started) return; started = true;
      window.ARGUS_TRACE('autostart:start', {reason});
      // [Argus][Trace] links-only miner (armed after autostart)
      try {
        const cfg = (window.ArgusConfig || {});
        if (cfg.search && cfg.search.linksOnly) {
          (function armLinksOnlyMiner(){
            const PANEL_SEL = '[role="feed"], .m6QErb, .DxyBCb, .XiKgde';
            const panel = document.querySelector(PANEL_SEL);
            if (!panel) { try { console.log('[Argus][Trace] links-miner:panel-missing'); } catch (e) { /* ignore */ } return; }

            const seen = new Set();
            function emitChunk(payload){
              try { new BroadcastChannel('ARGUS_DATA').postMessage(payload); } catch (e) { /* ignore */ }
              try { if (window.ARGUS_BUS) ARGUS_BUS.send('data', payload); } catch (e) { /* ignore */ }
            }
            function progressApplyPartial(key, add){
              try {
                (async function(){
                  const lk = (await GM_getValue('argus.progress.links')) || { discovered: 0 };
                  lk.discovered = Math.max(0, (lk.discovered||0) + (Number(add)||0));
                  await GM_setValue('argus.progress.links', lk);
                  const ui = (window.__argus_ui_progress__ ||= { collected:0, total:0 });
                  try { window.dispatchEvent(new CustomEvent('argus:progress:update', { detail: { ...ui, reason: 'links-only-chunk' } })); } catch (e) { /* ignore */ }
                })();
              } catch (e) { /* ignore */ }
            }
            window.__argusLinksOnlySnapshot = function(){
              try {
                const anchors = panel.querySelectorAll('a[href*="/maps/place/"]');
                const batch = [];
                anchors.forEach(function(a){
                  try {
                    const href = String(a.href||'').split('#')[0];
                    if (href && !seen.has(href)) { seen.add(href); batch.push({ href: href }); }
                  } catch (e) { /* ignore */ }
                });
                if (batch.length) {
                  emitChunk({ type: 'places', mode: 'links-only', items: batch });
                  try { console.log('[Argus][Trace] collector:chunk (links-only)', { n: batch.length }); } catch (e) { /* ignore */ }
                  progressApplyPartial(location.href + '::partial', batch.length);
                }
              } catch (e) { /* ignore */ }
            };
            // initial snapshot and observe lightly
            window.__argusLinksOnlySnapshot();
            const mo = new MutationObserver(function(){ try { clearTimeout(mo._t); mo._t = setTimeout(window.__argusLinksOnlySnapshot, 120); } catch (e) { /* ignore */ } });
            try { mo.observe(panel, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
            try { console.log('[Argus][Trace] links-miner:armed'); } catch (e) { /* ignore */ }
            // auto-stop after timeout
            const ms = (cfg.search && cfg.search.listReadyTimeoutMs) || 2500;
            setTimeout(function(){ try { mo.disconnect(); console.log('[Argus][Trace] links-miner:done', { total: seen.size }); } catch (e) { /* ignore */ } }, ms);
          })();
        }
      } catch (e) { /* ignore */ }
      setTimeout(()=>{
        try {
          if (typeof runScrapingWorker === 'function') runScrapingWorker();
          else window.dispatchEvent(new CustomEvent('ARGUS:START'));
        } catch(e){ window.ARGUS_TRACE.err('autostart:error', {e:String(e)}); }
      }, 140);
    }
    try {
      const bc = new BroadcastChannel(BC_START);
      bc.addEventListener('message', ev => {
        const d = ev && ev.data || {};
        if (d.type === 'start') start('bc');
      });
    } catch (e) { /* ignore */ }
    if (location.hash.includes('argus_autostart=1') || location.search.includes('argus_autostart=1')) start('url');
    window.addEventListener('pageshow', ()=>{ if (!started) start('pageshow'); }, {once:true});

    // Opener wrappers
    function withAutostartFlag(u){
      const url = String(u||'');
      const hasHash = url.includes('#');
      const sep = hasHash ? '&' : '#';
      return url + sep + 'argus_autostart=1';
    }
    function shouldAutostart(url){
      return /https?:\/\/(www\.)?google\.[^/]+\/maps\//.test(url);
    }
    // Global tab-handle map for coordinator-close
    window.__ARGUS_TAB_HANDLES__ = window.__ARGUS_TAB_HANDLES__ || new Map();

    function afterOpen(u, handle){
      try {
        const bc = new BroadcastChannel(BC_START);
        setTimeout(()=>bc.postMessage({type:'start'}), 280);
      } catch (e) { /* ignore */ }
      try {
        if (handle && typeof handle.close === 'function'){
          window.__ARGUS_TAB_HANDLES__.set(u, handle);
        }
      } catch (e) { /* ignore */ }
      window.ARGUS_TRACE('autostart:opened', {url:u, hasHandle: !!(handle && typeof handle.close==='function')});
    }

    try {
      if (typeof GM !== 'undefined' && typeof GM.openInTab === 'function'){
        const _o = GM.openInTab;
        GM.openInTab = function(url, opts){
          const u = shouldAutostart(url) ? withAutostartFlag(url) : url;
          const ret = _o.call(this, u, Object.assign({active:false, insert:true}, opts||{}));
          afterOpen(u, ret);
          return ret;
        };
      }
    } catch (e) { /* ignore */ }

    try {
      if (typeof GM_openInTab === 'function'){
        const _o2 = GM_openInTab;
        window.GM_openInTab = function(url, opts){
          const u = shouldAutostart(url) ? withAutostartFlag(url) : url;
          const ret = _o2.call(null, u, Object.assign({active:false, insert:true}, opts||{}));
          afterOpen(u, ret);
          return ret;
        };
      }
    } catch (e) { /* ignore */ }

    try {
      const _wo = window.open;
      window.open = function(url, target, features){
        const u = shouldAutostart(url) ? withAutostartFlag(url) : url;
        const w = _wo.call(window, u, target||'_blank', features);
        afterOpen(u, w);
        return w;
      };
    } catch (e) { /* ignore */ }
  })();

  /* -------------------- PROGRESS: worker emit + coordinator HUD -------------------- */
  (function progress(){
    const BC = CH.PROGRESS;
    const isCoordinator = !window.opener;
    // Worker-side emit by hooking updateLog
    try{
      const bc = new BroadcastChannel(BC);
      const emit = (count, meta)=>{ try{ bc.postMessage({type:'progress', url:location.href, count:Number(count)||0, meta:meta||{}, ts:Date.now()}); }catch(e){ /* ignore */ } };
      const _orig = window.updateLog;
      window.updateLog = function(){
        try{
          const msg = String(arguments[0]||'');
          let m = msg.match(/\bReviews loaded:\s*(\d+)\b/) || msg.match(/\[HD\]\s*growth\s*\d+\s*[→>-]\s*(\d+)/) || msg.match(/\bpass complete\s*@\s*(\d+)/i);
          if (m){ emit(parseInt(m[1],10), {source:'log'}); window.ARGUS_TRACE('progress:emit', {count: parseInt(m[1],10), msg}); }
        }catch(e){ window.ARGUS_TRACE.err('progress:emit:error', {e:String(e)}); }
        if (typeof _orig === 'function') return _orig.apply(this, arguments);
      };
      window.addEventListener('ARGUS:PROGRESS', ev=>{ if (ev && ev.detail && ev.detail.count != null) emit(ev.detail.count, {source:'event'}); });
    }catch (e) { /* ignore */ }

    // Coordinator-side HUD + hook into custom UI

// Gateway cho progress:recv
let pendingIds = new Set();
let progressTimer = null;

function onProgressRecv(payload){
  // payload: {sessionId, newIds:[placeId...], totalInc?:number}
  const cur = (window.__ARGUS_KV__||{read:()=>({sessionId:window.__ARGUS_SESSION_ID__,collected:0,total:0,seen:[]})}).read();

  // Chặn cross-session
  if (payload.sessionId && payload.sessionId !== cur.sessionId){
    console.log('[Argus][Trace] progress:recv:drop(stale-session)', {recv:payload.sessionId, cur:cur.sessionId});
    return;
  }

  // Gom & khử trùng lặp
  (payload.newIds||[]).forEach(id=> pendingIds.add(id));

  if (progressTimer) return;
  progressTimer = setTimeout(()=>{
    const before = (window.__ARGUS_KV__||{read:()=>({sessionId:window.__ARGUS_SESSION_ID__,collected:0,total:0,seen:[]})}).read();
    const add = pendingIds.size;
    pendingIds.clear();
    progressTimer = null;

    if (add<=0){
      console.log('[Argus][Trace] progress:recv:drop(no-delta)');
      return;
    }
              const next = { ...before, collected: Math.max(0,(before.collected||0)+add) };
          (window.__ARGUS_KV__||{write:()=>{}}).write(next);
    // UI render chỉ đọc KV
    try {
      const ui = (window.__argus_ui_progress__ ||= { collected:0, total:0 });
      ui.collected = next.collected; ui.total = next.total||ui.total||0;
      if (typeof window.renderProgress==='function') window.renderProgress(ui.collected, ui.total);
      console.log('[Argus][Trace] progress:ui:render', {collected:ui.collected,total:ui.total});
    } catch (e) { /* ignore */ }
  }, 300);
}

window.addEventListener('message', (ev)=>{
  try {
    const m = ev && ev.data;
    if (!m || m.type !== 'argus:progress') return;
    onProgressRecv({ sessionId: m.sid, newIds: m.ids });
  } catch (e) { /* ignore */ }
}, true);

    if (isCoordinator){
      const bc = new BroadcastChannel(BC);
      const state = new Map(); // url -> {count, ts}
      function ensureHUD(){
        let hud = document.getElementById('__argus_progress_hud__');
        if (hud) return hud;
        hud = document.createElement('div');
        hud.id = '__argus_progress_hud__';
        Object.assign(hud.style, { position:'fixed', right:'12px', bottom:'12px', zIndex:2147483647,
          background:'rgba(0,0,0,.72)', color:'#fff', padding:'10px 12px', borderRadius:'10px',
          font:'12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial', boxShadow:'0 2px 10px rgba(0,0,0,.35)',
          maxWidth:'46vw' });
        hud.innerHTML = '<div style="font-weight:600;margin-bottom:4px">Argus Progress</div><div id="__argus_progress_list__"></div>';
        document.body.appendChild(hud);
        return hud;
      }
      function render(){
        if (typeof window.updateProgressUI === 'function'){
          try{ window.updateProgressUI(state); return; }catch(e){ window.ARGUS_TRACE.warn('progress:customUI:error', {e:String(e)}); }
        }
        const hud = ensureHUD();
        const list = hud.querySelector('#__argus_progress_list__');
        const arr = Array.from(state.entries()).sort((a,b)=>b[1].count - a[1].count).slice(0,12);
        list.innerHTML = arr.map(([u, o])=>`<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="opacity:.75">${o.count.toLocaleString()}:</span> ${u}</div>`).join('');
        try{
          const total = Array.from(state.values()).reduce((s,o)=>s + Number(o.count||0), 0);
          document.title = document.title.replace(/^Argus \[\d+\]\s*/,''); document.title = `Argus [${total}] ` + document.title;
          const meter = document.querySelector('[data-argus-progress]'); if (meter) meter.textContent = String(total);
        }catch (e) { /* ignore */ }
      }
      bc.addEventListener('message', ev=>{
        const d = ev && ev.data || {};
        if (d.type === 'progress' && d.url){
          state.set(d.url, {count:Number(d.count)||0, ts:d.ts||Date.now()});
          window.ARGUS_TRACE('progress:recv', {url:d.url, count:d.count});
          render();
        }
      });
    }
  })();

  /* -------------------- COLLECTOR: extract review data on growth -------------------- */
  (function collector(){
    const BC_DATA = 'ARGUS_DATA';
    const SELS = [
      'div[data-review-id]',
      'div[role="article"][data-review-id]',
      'div[data-review-id][jsaction]'
    ];
    const bc = (function(){ try{ return new BroadcastChannel(BC_DATA); }catch (e) { /* ignore */ } return null; })();
    const seen = new Set();
    function text(el, sel){ try{ const n = sel ? el.querySelector(sel) : el; return (n && (n.textContent||'').trim()) || ''; }catch (e) { return ''; } }
    function num(s){ const m = String(s||'').match(/[\d.,]+/); return m? Number(m[0].replace(/[.,](?=\d{3}\b)/g,'').replace(',','.')): null; }
    function pickRating(el){
      try{
        const a = el.querySelector('[aria-label*="stars"], [aria-label*="sao"], [role="img"][aria-label*="★"]');
        if (a){ const m = a.getAttribute('aria-label').match(/([\d.,]+)/); if (m) return Number(m[1].replace(',','.')); }
      }catch (e) { /* ignore */ }
      return null;
    }
    function parseOne(el){
      try{
        const id = el.getAttribute('data-review-id') || el.getAttribute('data-reviewid') || el.id || null;
        if (!id) return null;
        if (seen.has(id)) return null;
        seen.add(id);
        return {
          id,
          author: text(el, 'a[href*="maps/contrib"], .d4r55, [data-review-id] a[role="link"]'),
          text: text(el, '.wiI7pd, .MyEned, [jsname="fbQN7e"]'),
          rating: pickRating(el),
          time: text(el, '.rsqaWe, .dehysf, .AVvX3'),
        };
      }catch(e){ window.ARGUS_TRACE.err('collector:parse:error', {e:String(e)}); return null; }
    }
    function collectAll(){
      let nodes = [];
      for (const s of SELS){ nodes = document.querySelectorAll(s); if (nodes && nodes.length) break; }
      const out = [];
      nodes.forEach(el=>{ const o = parseOne(el); if (o) out.push(o); });
      if (out.length && bc){ try{ bc.postMessage({type:'chunk', url:location.href, n:out.length, rows: out, ts:Date.now()}); }catch (e) { /* ignore */ } }
      window.ARGUS_TRACE('collector:chunk', {n:out.length, total: seen.size});
      window.dispatchEvent(new CustomEvent('ARGUS:PROGRESS', {detail:{count: seen.size}}));
    }

    // Hook growth logs so we collect right after new nodes appear
    const _orig = window.updateLog;
    window.updateLog = function(){
      try{
        const msg = String(arguments[0]||'');
        if (/\bReviews loaded:\s*\d+\b/.test(msg) || /\[HD\]\s*growth/.test(msg) || /\bpass complete\b/.test(msg)){
          setTimeout(collectAll, 30);
        }
      }catch (e) { /* ignore */ }
      if (typeof _orig === 'function') return _orig.apply(this, arguments);
    };
    // Also periodic (safety net)
    setInterval(()=>{ try{ collectAll(); }catch (e) { /* ignore */ } }, 2000);
  })();

  /* -------------------- COORDINATOR: auto-advance + tab close -------------------- */
  (function coordinator(){
    if (window.opener) return; // only in main coordinator window
    const BC_COORD = CH.COORD;
    const bc = (function(){ try{ return new BroadcastChannel(BC_COORD); }catch (e) { /* ignore */ } return null; })();

    // Config
    window.ARGUS_AUTO_ADVANCE_NEXT = (window.ARGUS_AUTO_ADVANCE_NEXT !== false); // default true
    window.ARGUS_MAX_CONCURRENCY = window.ARGUS_MAX_CONCURRENCY || 4;

    // Queue store (optional): seed via ARGUS_SEED_QUEUE([...])
    window.__ARGUS_QUEUE__ = window.__ARGUS_QUEUE__ || [];
    window.ARGUS_SEED_QUEUE = function(arr){
      try{
        window.__ARGUS_QUEUE__ = Array.from(arr||[]);
        localStorage.setItem('ARGUS_QUEUE', JSON.stringify(window.__ARGUS_QUEUE__));
        window.ARGUS_TRACE('coord:seed', {size: window.__ARGUS_QUEUE__.length});
      }catch(e){ window.ARGUS_TRACE.err('coord:seed:error', {e:String(e)}); }
    };
    (function loadQueue(){
      try{
        const raw = localStorage.getItem('ARGUS_QUEUE'); if (raw && !(window.__ARGUS_QUEUE__ && window.__ARGUS_QUEUE__.length)){
          window.__ARGUS_QUEUE__ = JSON.parse(raw)||[];
        }
      }catch (e) { /* ignore */ }
    })();

    function openHelper(url){
      try{ /* legacy opener not present */ }catch (e) { /* ignore */ }
      try{
        if (typeof GM !== 'undefined' && typeof GM.openInTab === 'function') return GM.openInTab(url, {active:false, insert:true});
      }catch (e) { /* ignore */ }
      try{ return window.open(url, '_blank', 'noopener'); }catch (e) { return null; }
    }

    let AUTO_CONC = window.ARGUS_MAX_CONCURRENCY || 4; // existing default
    let stats = { rpm: [], zeroProbe: 0 };
    setInterval(()=>{
      const rpmNow = (window.__ARGUS_LAST_ADD__||0); window.__ARGUS_LAST_ADD__ = 0;
      stats.rpm.push(rpmNow); if (stats.rpm.length>12) stats.rpm.shift();
      const avg = stats.rpm.reduce((a,b)=>a+b,0) / Math.max(1,stats.rpm.length);
      if (avg > 800 && stats.zeroProbe < 2 && AUTO_CONC < 6) AUTO_CONC++;
      if ((avg < 120 || stats.zeroProbe > 4) && AUTO_CONC > 3) AUTO_CONC--;
      window.ARGUS_MAX_CONCURRENCY = AUTO_CONC;
    }, 5000);

    window.addEventListener('ARGUS:PROGRESS', ev=>{
      const d = ev?.detail||{};
      if (d.type==='reviews' && typeof d.add==='number') {
        window.__ARGUS_LAST_ADD__ = (window.__ARGUS_LAST_ADD__||0) + d.add;
      }
      if (d.type==='probe_zero') stats.zeroProbe++;
    });

    function runningCount(){
      try { return window.__ARGUS_TAB_HANDLES__ ? window.__ARGUS_TAB_HANDLES__.size : 0; } catch (e) { return 0; }
    }

    function openNextIfPossible(){
      if (!window.ARGUS_AUTO_ADVANCE_NEXT) return;
      if (!window.__ARGUS_QUEUE__ || window.__ARGUS_QUEUE__.length === 0) return;
      if (runningCount() >= window.ARGUS_MAX_CONCURRENCY) return;
      const url = window.__ARGUS_QUEUE__.shift();
      try{ localStorage.setItem('ARGUS_QUEUE', JSON.stringify(window.__ARGUS_QUEUE__)); }catch (e) { /* ignore */ }
      const h = openHelper(url);
      window.ARGUS_TRACE('coord:openNext', {url, handle: !!h});
    }

    // Respond to worker done: close its tab (via handle) & open next
    function onWorkerDone(meta){
      const url = meta && meta.url;
      try {
        if (url && window.__ARGUS_TAB_HANDLES__ && window.__ARGUS_TAB_HANDLES__.has(url)){
          const h = window.__ARGUS_TAB_HANDLES__.get(url);
          if (h && typeof h.close === 'function'){ try{ h.close(); }catch (e) { /* ignore */ } }
          window.__ARGUS_TAB_HANDLES__.delete(url);
          window.ARGUS_TRACE('coord:closed', {url});
        }
      } catch (e) { /* ignore */ }
      openNextIfPossible();
    }

    if (bc){
      bc.addEventListener('message', ev=>{
        const d = (ev && ev.data) || {};
        if (d.type === 'worker_done'){ window.ARGUS_TRACE('coord:worker_done', {url:d.url}); onWorkerDone(d); }
      });
    }

    // Bootstrap: kick openings if queue exists
    setInterval(openNextIfPossible, 1200);
  })();

})();

/* -------------------- TERMINAL: detect completion + emit worker_done + safe autoclose -------------------- */
(function terminal(){
  const CH = 'ARGUS_COORD';
  let done = false;
  function post(type, payload){
    try{ new BroadcastChannel(CH).postMessage(Object.assign({type}, payload||{})); }catch (e) { /* ignore */ }
  }
  function tryClose(){
    try{ window.close(); }catch (e) { /* ignore */ }
  }
  function markDone(meta){
    if (done) return; done = true;
    const m = Object.assign({url: location.href, final:true}, meta||{});
    post('worker_done', m);
    try{ window.ARGUS_TRACE('terminal:done', m); }catch (e) { /* ignore */ }
    if (window.ARGUS_AUTO_CLOSE !== false){
      setTimeout(tryClose, Number(window.ARGUS_CLOSE_DELAY_MS||800));
    }
  }
  window.ARGUS_MARK_DONE = markDone;

  const _orig = window.updateLog;
  window.updateLog = function(){
    try{
      const msg = String(arguments[0]||'');
      const isPass = /\bpass complete\b/i.test(msg);
      const isIdleMax = /\bidle\s*=?\s*16\/16\b/i.test(msg) || /No growth\s*\(idle=16\/16\)/i.test(msg);
      const isFinish = /Hoàn tất!/i.test(msg);
      if ((isPass || isIdleMax || isFinish) && !done){
        let cnt = null;
        let m = msg.match(/\bpass complete\s*@\s*(\d+)/i) || msg.match(/\bReviews loaded:\s*(\d+)\b/);
        if (m) cnt = parseInt(m[1],10);
        markDone({reason: isPass ? 'pass_complete' : isIdleMax ? 'idle_max' : 'final_log', count: cnt});
      }
    }catch(e){ try{ window.ARGUS_TRACE.err('terminal:hook:error', {e:String(e)}); }catch (e2) { /* ignore */ } }
    if (typeof _orig === 'function') return _orig.apply(this, arguments);
  };
})();

/* ===================== ARGUS: Bus + KeepAlive (Firefox/Violentmonkey friendly) ===================== */
/* id:ARGUS_BUS_KEEPALIVE */

(function(){
  if (window.__ARGUS_BUS_KEEPALIVE__) return;
  window.__ARGUS_BUS_KEEPALIVE__ = true;

  // -------------------- BUS: multi-transport messaging --------------------
  (function bus(){
    const TOPIC_KEY = 'ARGUS_MAILBOX';
    const VAL_KEY   = 'ARGUS_VALBUS';
    const listeners = new Map(); // topic -> Set(fn)

    function call(topic, data){
      const set = listeners.get(topic);
      if (set) set.forEach(fn=>{ try{ fn(data); }catch(e){ console.error('[Argus][Bus] listener error', e); } });
    }

    function on(topic, fn){
      if (!listeners.has(topic)) listeners.set(topic, new Set());
      listeners.get(topic).add(fn);
      return () => { try{ listeners.get(topic)?.delete(fn); }catch(e){ /* ignore */ } };
    }

    function bcCtor(){
      try { if (typeof unsafeWindow !== 'undefined' && unsafeWindow.BroadcastChannel) return unsafeWindow.BroadcastChannel; } catch(e){ /* ignore */ }
      try { if (typeof BroadcastChannel !== 'undefined') return BroadcastChannel; } catch(e){ /* ignore */ }
      return null;
    }

    const BCC = bcCtor();
    let BC = null;
    if (BCC){
      try{
        BC = new BCC('ARGUS_BUS');
        BC.addEventListener('message', function(ev){ try{ if (ev && ev.data) call(ev.data.topic, ev.data); }catch(e){ /* ignore */ } });
      }catch(e){ /* ignore */ }
    }

    // storage event (same-origin tabs)
    try{
      window.addEventListener('storage', function(ev){
        try{
          if (ev && ev.key === TOPIC_KEY && ev.newValue){
            const msg = JSON.parse(ev.newValue);
            call(msg.topic, msg);
          }
        }catch(e){ /* ignore */ }
      });
    }catch(e){ /* ignore */ }

    // GM value change (userscript cross-tab signal)
    try{
      if (typeof GM_addValueChangeListener === 'function'){
        GM_addValueChangeListener(VAL_KEY, function(name, oldVal, newVal, remote){
          try{
            if (!remote || !newVal) return;
            const msg = JSON.parse(newVal);
            call(msg.topic, msg);
          }catch(e){ /* ignore */ }
        });
      }
    }catch(e){ /* ignore */ }

    // postMessage to opener
    try{
      window.addEventListener('message', function(ev){
        try{
          const d = ev && ev.data || {};
          if (d && d.type === 'ARGUS_BUS') call(d.topic, d);
        }catch(e){ /* ignore */ }
      });
    }catch(e){ /* ignore */ }

    function send(topic, payload){
      const msg = {topic: topic, payload: payload, url: location.href, ts: Date.now()};
      // BroadcastChannel
      try{ BC && BC.postMessage(msg); }catch(e){ /* ignore */ }
      // storage
      try{ localStorage.setItem(TOPIC_KEY, JSON.stringify(msg)); }catch(e){ /* ignore */ }
      // GM value
      try{ if (typeof GM_setValue === 'function') GM_setValue(VAL_KEY, JSON.stringify(msg)); }catch(e){ /* ignore */ }
      // opener postMessage
      try{ if (window.opener && window.opener.postMessage) window.opener.postMessage(Object.assign({type:'ARGUS_BUS'}, msg), '*'); }catch(e){ /* ignore */ }
    }

    try{ window.ARGUS_BUS = { on: on, send: send }; }catch(e){ /* ignore */ }

    // Bridge legacy channels if present
    try{
      const C = (BCC || (typeof BroadcastChannel !== 'undefined' ? BroadcastChannel : null));
      if (C){
        try{ const bcProg = new C('ARGUS_PROGRESS'); bcProg.addEventListener('message', function(ev){ try{ if (ev && ev.data) send('progress', ev.data); }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
        try{ const bcCoord = new C('ARGUS_COORD');    bcCoord.addEventListener('message', function(ev){ try{ if (ev && ev.data) send('coord', ev.data); }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
        try{ const bcData = new C('ARGUS_DATA');      bcData.addEventListener('message', function(ev){ try{ if (ev && ev.data) send('data', ev.data); }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
      }
    }catch(e){ /* ignore */ }

    // Expose helpers for Coordinator
    try{
      window.ARGUS_ON_PROGRESS = function(fn){ return on('progress', function(m){ try{ fn(m); }catch(e){ /* ignore */ } }); };
      window.ARGUS_ON_COORD    = function(fn){ return on('coord',    function(m){ try{ fn(m); }catch(e){ /* ignore */ } }); };
      window.ARGUS_ON_DATA     = function(fn){ return on('data',     function(m){ try{ fn(m); }catch(e){ /* ignore */ } }); };
    }catch(e){ /* ignore */ }
  })();

  // -------------------- KEEPALIVE: fight background throttling --------------------
  (function keepalive(){
    const STEP_MS = 1400; // ≥ 1000ms to avoid aggressive background clamps
    const INPUT_MS = 2500;
    const VIS_MS = 5000;

    function fakeInput(){
      try{
        const el = document.elementFromPoint(24,24) || document.body;
        el.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:24, clientY:24}));
        window.dispatchEvent(new Event('scroll', {bubbles:true}));
      }catch(e){ /* ignore */ }
    }

    function visibilityShim(){
      try{ Object.defineProperty(document, 'hidden', {get: function(){ return false; }}); }catch(e){ /* ignore */ }
      try{ Object.defineProperty(document, 'visibilityState', {get: function(){ return 'visible'; }}); }catch(e){ /* ignore */ }
      try{ document.dispatchEvent(new Event('visibilitychange')); }catch(e){ /* ignore */ }
    }

    function tickleScroll(){
      try{
        const panels = Array.from(document.querySelectorAll('.m6QErb, [jscontroller][jsaction*="rcuQ6b"], [aria-label*="All reviews"]')).filter(Boolean);
        if (panels.length){
          const p = panels[0];
          p.scrollTop = Math.max(0, Math.min(p.scrollTop + 128, (p.scrollHeight - p.clientHeight)));
          p.dispatchEvent(new Event('scroll', {bubbles:true}));
          const sentinel = p.querySelector('[aria-label*="More"], [jsname="i0F6df"], [role="feed"] > *:last-child');
          if (sentinel && sentinel.scrollIntoView) sentinel.scrollIntoView({block:'end'});
        } else {
          window.scrollTo(0, document.scrollingElement ? document.scrollingElement.scrollHeight : 0);
          window.dispatchEvent(new Event('scroll', {bubbles:true}));
        }
      }catch(e){ /* ignore */ }
    }

    try{ setInterval(tickleScroll, STEP_MS); }catch(e){ /* ignore */ }
    try{ setInterval(fakeInput, INPUT_MS); }catch(e){ /* ignore */ }
    try{ setInterval(visibilityShim, VIS_MS); }catch(e){ /* ignore */ }
  })();

  // -------------------- COORDINATOR: consume bus for progress UI --------------------
  (function coordProgressBridge(){
    if (window.opener) return; // only in main
    const state = new Map();
    function render(){
      let hud = document.getElementById('__argus_progress_hud__');
      if (!hud){
        hud = document.createElement('div');
        hud.id = '__argus_progress_hud__';
        Object.assign(hud.style, { position:'fixed', right:'12px', bottom:'12px', zIndex:2147483647,
          background:'rgba(0,0,0,.72)', color:'#fff', padding:'10px 12px', borderRadius:'10px',
          font:'12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial', boxShadow:'0 2px 10px rgba(0,0,0,.35)',
          maxWidth:'46vw' });
        hud.innerHTML = '<div style="font-weight:600;margin-bottom:4px">Argus Progress</div><div id="__argus_progress_list__"></div>';
        document.body.appendChild(hud);
      }
      const list = hud.querySelector('#__argus_progress_list__');
      const arr = Array.from(state.entries()).sort(function(a,b){return b[1].count - a[1].count;}).slice(0,12);
      list.innerHTML = arr.map(function(ent){ var u=ent[0], o=ent[1]; return '<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="opacity:.75">'+(o.count.toLocaleString())+':</span> '+u+'</div>'; }).join('');
      try{
        const total = Array.from(state.values()).reduce(function(s,o){ return s + Number(o.count||0); }, 0);
        document.title = document.title.replace(/^Argus \[\d+\]\s*/,''); document.title = 'Argus ['+total+'] ' + document.title;
        const meter = document.querySelector('[data-argus-progress]'); if (meter) meter.textContent = String(total);
      }catch(e){ /* ignore */ }
    }
    try{
      window.ARGUS_ON_PROGRESS(function(m){
        try{
          const d = (m && (m.payload||m)) || {};
          if (!d || !d.url) return;
          state.set(d.url, {count:Number(d.count)||0, ts:d.ts||Date.now()});
          render();
        }catch(e){ /* ignore */ }
      });
    }catch(e){ /* ignore */ }
  })();

})();

/* ===================== ARGUS: Sentinel Bridge (focus-free + progress-sync) ===================== */
/* id:ARGUS_SENTINEL_BRIDGE */

(function(){
  if (window.__ARGUS_SENTINEL_BRIDGE__) return; window.__ARGUS_SENTINEL_BRIDGE__=true;

  function hasSentinel(){ try{ return (typeof Sentinel !== 'undefined') && !!(Sentinel && Sentinel.config); }catch(e){ return false; } }
  function onReady(fn){
    try{
      if (document.readyState==='complete' || document.readyState==='interactive') fn();
      else document.addEventListener('DOMContentLoaded', fn, {once:true});
    }catch(e){ /* ignore */ }
  }

  // Prefer Sentinel's visibility spoofing if present
  try{ window.ARGUS_USE_SENTINEL_VIS = hasSentinel(); }catch(e){ /* ignore */ }

  // If Sentinel blocks mouse events, avoid synthetic mouse input and rely on programmatic scroll
  try{ window.ARGUS_BLOCK_MOUSE = (hasSentinel() && Sentinel && Sentinel.config && Sentinel.config.blockMouseEvents === true); }catch(e){ /* ignore */ }

  // --- KeepAlive: programmatic scroll of the GMaps reviews panel ---
  function tickPanel(){
    try{
      const p = document.querySelector('.m6QErb') || document.querySelector('[role="feed"][aria-label*="review"]');
      if (!p) return;
      const before = p.scrollTop;
      p.scrollTop = Math.min(p.scrollTop + 256, p.scrollHeight - p.clientHeight);
      if (p.scrollTop === before && p.scrollTop > 0) {
        p.scrollTop = Math.max(0, p.scrollTop - 128);
      }
      p.dispatchEvent(new Event('scroll', {bubbles:true}));
      const tail = p.lastElementChild;
      if (tail && tail.scrollIntoView) tail.scrollIntoView({block:'end'});
    }catch(e){ /* ignore */ }
  }

  // --- Progress sync: MutationObserver + polling to emit growth in real-time ---
  (function(){
    let prev = 0;
    function count(){
      try{
        let n = document.querySelectorAll('div[data-review-id]').length;
        if (!n) n = document.querySelectorAll('div[data-review-id][jsaction], div[role="article"][data-review-id]').length;
        return n;
      }catch(e){ return 0; }
    }
    function emit(n){
      try{ if (window.ARGUS_BUS) ARGUS_BUS.send('progress', {url: location.href, count: n, ts: Date.now()}); }catch(e){ /* ignore */ }
      try{ new BroadcastChannel('ARGUS_PROGRESS').postMessage({type:'progress', url: location.href, count: n, ts: Date.now()}); }catch(e){ /* ignore */ }
      try{ window.dispatchEvent(new CustomEvent('ARGUS:PROGRESS', {detail:{count:n}})); }catch(e){ /* ignore */ }
    }
    onReady(function(){
      try{
        const target = document.querySelector('.m6QErb') || document.body;
        const mo = new MutationObserver(function(){ try{ const n = count(); if (n>prev){ prev=n; emit(n);} }catch(e){ /* ignore */ } });
        mo.observe(target, {childList:true, subtree:true});
      }catch(e){ /* ignore */ }
      prev = count(); if (prev) emit(prev);
      try{ setInterval(function(){ try{ const n = count(); if (n>prev){ prev=n; emit(n);} }catch(e){ /* ignore */ } }, 1500); }catch(e){ /* ignore */ }
    });
  })();

  // Drive keepalive with scroll-only (works even if Sentinel blocks mouse)
  try{ setInterval(tickPanel, 1600); }catch(e){ /* ignore */ }

  // Optional compatibility: if Sentinel exposes domain overrides, relax mouse block on maps
  try{
    if (hasSentinel() && typeof Sentinel !== 'undefined' && Sentinel.Config && typeof Sentinel.Config.setDomainOverride === 'function'){
      Sentinel.Config.setDomainOverride(location.hostname, { blockMouseEvents: false });
    }
  }catch(e){ /* ignore */ }
})();

/* ===================== ARGUS Focus-Free + Progress + Collector ===================== */
/* id:ARGUS_FOCUSFREE_PROGRESS_COLLECTOR */

(function(){
  if (window.__ARGUS_FF_PC__) return; window.__ARGUS_FF_PC__ = true;

  /* -------------------- inject into page-world: visibility/hasFocus shim -------------------- */
  function injectPageShim(){
    try{
      const code = `(function(){
        if (window.__ARGUS_PAGE_SHIM__) return; window.__ARGUS_PAGE_SHIM__=true;
        try {
          const DP = Document.prototype;
          try{ Object.defineProperty(DP, 'hidden', { configurable:true, get(){ return false; } }); }catch(e){}
          try{ Object.defineProperty(DP, 'visibilityState', { configurable:true, get(){ return 'visible'; } }); }catch(e){}
          try{ Document.prototype.hasFocus = function(){ return true; }; }catch(e){}
          try{
            const _add = document.addEventListener;
            document.addEventListener = function(type, listener, opts){
              if (type === 'visibilitychange'){
                try{ listener.call(document, new Event('visibilitychange')); }catch(e){}
                return;
              }
              return _add.call(this, type, listener, opts);
            };
          }catch(e){}
          try{
            const _raf = window.requestAnimationFrame;
            window.requestAnimationFrame = function(cb){ return setTimeout(()=>cb(performance.now()), 16); };
            window.cancelAnimationFrame = function(id){ clearTimeout(id); };
          }catch(e){}
        } catch(e){}
        try{
          const v=document.createElement('video'); v.muted=true; v.loop=true; v.playsInline=true;
          v.width=1; v.height=1; Object.assign(v.style,{position:'fixed',width:'1px',height:'1px',opacity:0, pointerEvents:'none', bottom:'0', right:'0'});
          const src=URL.createObjectURL(new Blob([new Uint8Array([0])],{type:'video/mp4'})); v.src=src;
          document.documentElement.appendChild(v); v.play().catch(()=>{});
        }catch(e){}
      })();`;
      const s = document.createElement('script');
      s.textContent = code;
      (document.head||document.documentElement).appendChild(s);
      s.remove();
    }catch(e){ /* ignore */ }
  }

  /* -------------------- multi-bus send helper -------------------- */
  function busSend(topic, payload){
    const msg = {topic: topic, payload: payload, url: location.href, ts: Date.now()};
    try{ new BroadcastChannel('ARGUS_BUS').postMessage(msg); }catch(e){ /* ignore */ }
    try{ new BroadcastChannel('ARGUS_PROGRESS').postMessage(payload); }catch(e){ /* ignore */ }
    try{ localStorage.setItem('ARGUS_MAILBOX', JSON.stringify(msg)); }catch(e){ /* ignore */ }
    try{ window.opener && window.opener.postMessage(Object.assign({type:'ARGUS_BUS'}, msg), '*'); }catch(e){ /* ignore */ }
    try{ if (typeof GM_setValue==='function') GM_setValue('ARGUS_VALBUS', JSON.stringify(msg)); }catch(e){ /* ignore */ }
    try{ window.dispatchEvent(new CustomEvent('ARGUS:'+String(topic).toUpperCase(), {detail:payload})); }catch(e){ /* ignore */ }
  }

  /* -------------------- robust selectors -------------------- */
  const SELS = {
    panel: ['.m6QErb', '[role="feed"][aria-label*="review"]', 'div[aria-label*="All reviews"] .m6QErb'],
    review: ['div[data-review-id]', 'div[data-review-id][jsaction]', 'div[role="article"][data-review-id]']
  };
  function qsAny(list, root){ for (var i=0;i<list.length;i++){ var sel=list[i]; var el=(root||document).querySelector(sel); if (el) return el; } return null; }
  function qsaCount(list){ for (var i=0;i<list.length;i++){ var sel=list[i]; var n=document.querySelectorAll(sel).length; if (n) return {n:n, sel:sel}; } return {n:0, sel:list[0]}; }

  /* -------------------- focus-free scroll driver -------------------- */
  function tickScroll(){
    const p = qsAny(SELS.panel);
    if (!p) return;
    const before = p.scrollTop;
    p.scrollTop = Math.min(p.scrollTop + 256, p.scrollHeight - p.clientHeight);
    try{ p.dispatchEvent(new Event('scroll', {bubbles:true})); }catch(e){ /* ignore */ }
    const tail = p.lastElementChild;
    try{ if (tail && tail.scrollIntoView) tail.scrollIntoView({block:'end'}); }catch(e){ /* ignore */ }
    if (p.scrollTop === before && p.scrollHeight > p.clientHeight){
      p.scrollTop = Math.max(0, p.scrollTop - 128);
      try{ p.dispatchEvent(new Event('scroll', {bubbles:true})); }catch(e){ /* ignore */ }
    }
    try{ p.dispatchEvent(new KeyboardEvent('keydown', {key:'PageDown', bubbles:true})); }catch(e){ /* ignore */ }
  }

  /* -------------------- progress via MO + polling -------------------- */
  let lastCount = 0;
  let lastSel = SELS.review[0];
  function emitProgress(force){
    const got = qsaCount(SELS.review);
    const n = got.n; lastSel = got.sel || lastSel;
    if (force || n > lastCount){
      lastCount = n;
      busSend('progress', {url: location.href, count: n, sel:lastSel, ts: Date.now()});
    }
  }
  function watchProgress(){
    const target = qsAny(SELS.panel) || document.body;
    try{
      const mo = new MutationObserver(function(){ try{ emitProgress(false); }catch(e){ /* ignore */ } });
      mo.observe(target, {childList:true, subtree:true});
    }catch(e){ /* ignore */ }
    emitProgress(true);
    try{ setInterval(function(){ try{ emitProgress(false); }catch(e){ /* ignore */ } }, 1500); }catch(e){ /* ignore */ }
  }

  /* -------------------- collector: minimal fields + chunk emit -------------------- */
  const seen = new Set();
  function parseOne(el){
    try{
      const id = el.getAttribute('data-review-id') || el.id || '';
      if (!id) return null;
      const ratingEl = el.querySelector('[aria-label*="stars"], [role="img"][aria-label*="star"]');
      const textEl = el.querySelector('[data-review-text], .qdXAlf, .wiI7pd, span[jsname]');
      const authorEl = el.querySelector('a[href*="contrib"], .d4r55, .WKxvr');
      const timeEl = el.querySelector('span[class*="rsqaWe"], .rsqaWe, .dehysf');
      const rating = ratingEl ? (parseFloat((ratingEl.getAttribute('aria-label')||'').replace(/[^0-9.]/g,''))||null) : null;
      const text = textEl ? textEl.textContent.trim() : '';
      const author = authorEl ? authorEl.textContent.trim() : '';
      const time = timeEl ? timeEl.textContent.trim() : '';
      return {id: id, rating: rating, text: text, author: author, time: time};
    }catch(e){ return null; }
  }
  function collectAndEmit(){
    const nodes = Array.from(document.querySelectorAll(lastSel)).filter(Boolean);
    const batch = [];
    for (var i=0;i<nodes.length;i++){
      const el = nodes[i];
      const id = el.getAttribute('data-review-id') || el.id || '';
      if (!id || seen.has(id)) continue;
      const row = parseOne(el);
      if (row){ seen.add(id); batch.push(row); }
      if (batch.length >= 50){
        busSend('data', {url: location.href, rows: batch.slice(0)});
        busSend('progress', {url: location.href, count: seen.size, sel:lastSel, ts: Date.now()});
        batch.length = 0;
      }
    }
    if (batch.length){
      busSend('data', {url: location.href, rows: batch});
      busSend('progress', {url: location.href, count: seen.size, sel:lastSel, ts: Date.now()});
    }
  }
  function watchCollector(){
    try{ setInterval(function(){ try{ collectAndEmit(); }catch(e){ /* ignore */ } }, 2000); }catch(e){ /* ignore */ }
    try{ window.addEventListener('ARGUS:PROGRESS', function(){ try{ collectAndEmit(); }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
  }

  /* -------------------- coordinator aggregator (non-invasive) -------------------- */
  (function setupCoordinator(){
    if (window.opener) return;
    const totals = new Map();
    function render(){
      const total = Array.from(totals.values()).reduce(function(s,v){ return s + v; }, 0);
      try{
        document.title = document.title.replace(/^Argus \[\d+\]\s*/,'');
        document.title = 'Argus ['+total+'] ' + document.title;
        const meter = document.querySelector('[data-argus-progress]');
        if (meter) meter.textContent = String(total);
      }catch(e){ /* ignore */ }
    }
    function onProgress(m){
      const d = (m && m.payload) ? m.payload : m;
      if (!d || !d.url) return;
      totals.set(d.url, Number(d.count)||0);
      render();
    }
    try{ new BroadcastChannel('ARGUS_BUS').addEventListener('message', function(ev){ try{ if (ev && ev.data && ev.data.topic==='progress') onProgress(ev.data); }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
    try{ new BroadcastChannel('ARGUS_PROGRESS').addEventListener('message', function(ev){ try{ onProgress(ev.data); }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
    try{ window.addEventListener('message', function(ev){ try{ const d=ev && ev.data; if(d && d.type==='ARGUS_BUS' && d.topic==='progress') onProgress(d); }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
    try{ window.addEventListener('storage', function(ev){ try{ if(ev && ev.key==='ARGUS_MAILBOX' && ev.newValue){ const m=JSON.parse(ev.newValue); if(m.topic==='progress') onProgress(m); } }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
  })();

  /* -------------------- boot -------------------- */
  function boot(){
    injectPageShim();
    watchProgress();
    watchCollector();
    try{ setInterval(tickScroll, 1600); }catch(e){ /* ignore */ }
  }

  if (document.readyState === 'loading'){
    try{ document.addEventListener('DOMContentLoaded', boot, {once:true}); }catch(e){ /* ignore */ }
  } else {
    boot();
  }
})();

/* ===================== ARGUS Advanced Focus-Free + Sentinel Integration ===================== */
/* id:ARGUS_ADV_FF_SENTINEL */

(function(){
  if (window.__ARGUS_ADV_FF__) return; window.__ARGUS_ADV_FF__=true;

  const CFG = {
    tickMs: 1700,
    pollMs: 1500,
    chunkSize: 50,
    useWheel: true,
    useKeyPageDown: true,
    useWakeLock: true,
    useAudioKeepalive: true,
    logRingSize: 400
  };

  const LOG = (function(){
    const buf = new Array(CFG.logRingSize);
    let idx = 0, filled = 0;
    function push(level, msg, data){
      const item = {ts:Date.now(), level:level, msg:msg, data:data};
      buf[idx] = item; idx = (idx+1) % CFG.logRingSize; filled = Math.min(filled+1, CFG.logRingSize);
      try{ console[level]('[Argus][ADV]', msg, data||''); }catch(e){ /* ignore */ }
    }
    function dump(){ const out=[]; for(var i=0;i<filled;i++){ const j=(idx - filled + i + CFG.logRingSize)%CFG.logRingSize; out.push(buf[j]); } return out; }
    return {push:push, dump:dump};
  })();

  function injectPageShim(){
    try{
      const code = `(function(){
        if (window.__ARGUS_ADV_PAGESHIM__) return; window.__ARGUS_ADV_PAGESHIM__=true;
        try {
          const DP = Document.prototype;
          try{ Object.defineProperty(DP, 'hidden', { configurable:true, get(){ return false; } }); }catch{}
          try{ Object.defineProperty(DP, 'visibilityState', { configurable:true, get(){ return 'visible'; } }); }catch{}
          try{ Document.prototype.hasFocus = function(){ return true; }; }catch{}
          try{
            const _add = document.addEventListener;
            document.addEventListener = function(type, listener, opts){
              if (type === 'visibilitychange'){
                try{ listener.call(document, new Event('visibilitychange')); }catch{}
                return;
              }
              return _add.call(this, type, listener, opts);
            };
          }catch{}
          try{
            const _raf = window.requestAnimationFrame;
            window.requestAnimationFrame = function(cb){ return setTimeout(()=>cb(performance.now()), 16); };
            window.cancelAnimationFrame = function(id){ clearTimeout(id); };
          }catch{}
        } catch(e){}
        try{
          const v=document.createElement('video'); v.muted=true; v.loop=true; v.playsInline=true;
          v.width=1; v.height=1; Object.assign(v.style,{position:'fixed',width:'1px',height:'1px',opacity:0, pointerEvents:'none', bottom:'0', right:'0'});
          const src=URL.createObjectURL(new Blob([new Uint8Array([0])],{type:'video/mp4'})); v.src=src;
          document.documentElement.appendChild(v); v.play().catch(()=>{});
        }catch{}
      })();`;
      const s = document.createElement('script'); s.textContent = code;
      (document.head||document.documentElement).appendChild(s); s.remove();
      LOG.push('log','Page shim injected');
    }catch(e){ LOG.push('warn','Page shim failed', e); }
  }

  function trySentinel(){
    try{
      if (window.Sentinel && Sentinel.config){
        if (Sentinel.config.blockMouseEvents) { Sentinel.config.blockMouseEvents = false; LOG.push('log','Sentinel blockMouseEvents disabled'); }
        if (Sentinel.config.spoofPageVisibility !== true) { Sentinel.config.spoofPageVisibility = true; LOG.push('log','Sentinel spoofPageVisibility enabled'); }
      }
      if (window.Sentinel && Sentinel.Config && typeof Sentinel.Config.setDomainOverride === 'function'){
        try { Sentinel.Config.setDomainOverride(location.hostname, { blockMouseEvents:false, spoofPageVisibility:true }); LOG.push('log','Sentinel domain override set'); } catch(e) { /* ignore */ }
      }
    }catch(e){ LOG.push('warn','Sentinel integration failed', e); }
  }

  let wakeLock = null;
  async function keepWakeLock(){
    if (!CFG.useWakeLock || !('wakeLock' in navigator)) return;
    try{
      if (!wakeLock) wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', function(){ wakeLock=null; });
    }catch(e){ /* ignore */ }
  }
  function keepAudio(){
    if (!CFG.useAudioKeepalive) return;
    try{
      const Ctx = (window.AudioContext||window.webkitAudioContext);
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      gain.gain.value = 0.00001; osc.frequency.value = 20;
      osc.connect(gain); gain.connect(ctx.destination); osc.start();
      LOG.push('log','Audio keepalive started');
    }catch(e){ LOG.push('warn','Audio keepalive failed', e); }
  }

  const SELS = {
    panel: ['.m6QErb', '[role="feed"][aria-label*="review"]', 'div[aria-label*="All reviews"] .m6QErb'],
    review: ['div[data-review-id]', 'div[data-review-id][jsaction]', 'div[role="article"][data-review-id]'],
    moreBtn: ['button[aria-label*="More reviews"]','[jsname="i0F6df"]','button[aria-label*="All reviews"]']
  };
  function qsAny(list, root){ for (var i=0;i<list.length;i++){ var sel=list[i]; var el=(root||document).querySelector(sel); if (el) return el; } return null; }
  function qsaCount(list){ for (var i=0;i<list.length;i++){ var sel=list[i]; var n=document.querySelectorAll(sel).length; if (n) return {n:n, sel:sel}; } return {n:0, sel:list[0]}; }

  function dispatchWheel(el, dy){
    try{ el.dispatchEvent(new WheelEvent('wheel', {bubbles:true, deltaY:dy, clientX:10, clientY:10})); }catch(e){ /* ignore */ }
  }
  function tickScroll(){
    const p = qsAny(SELS.panel);
    if (!p) return;
    var before = p.scrollTop;
    p.scrollTop = Math.min(p.scrollTop + 280, p.scrollHeight - p.clientHeight);
    try{ p.dispatchEvent(new Event('scroll', {bubbles:true})); }catch(e){ /* ignore */ }
    if (CFG.useWheel) dispatchWheel(p, 320);
    if (CFG.useKeyPageDown) { try{ p.dispatchEvent(new KeyboardEvent('keydown', {key:'PageDown', bubbles:true})); }catch(e){ /* ignore */ } }
    var tail = p.lastElementChild; try{ if (tail && tail.scrollIntoView) tail.scrollIntoView({block:'end'}); }catch(e){ /* ignore */ }
    if (p.scrollTop === before && p.scrollHeight > p.clientHeight){
      p.scrollTop = Math.max(0, p.scrollTop - 140);
      try{ p.dispatchEvent(new Event('scroll', {bubbles:true})); }catch(e){ /* ignore */ }
    }
    var more = qsAny(SELS.moreBtn);
    if (more){ try{ more.click(); }catch(e){ /* ignore */ } }
  }

  const seen = new Set();
  let lastCount = 0, lastSel = SELS.review[0];
  function busSend(topic, payload){
    const msg = {topic: topic, payload: payload, url: location.href, ts: Date.now()};
    try{ new BroadcastChannel('ARGUS_BUS').postMessage(msg); }catch(e){ /* ignore */ }
    try{ new BroadcastChannel('ARGUS_PROGRESS').postMessage(payload); }catch(e){ /* ignore */ }
    try{ localStorage.setItem('ARGUS_MAILBOX', JSON.stringify(msg)); }catch(e){ /* ignore */ }
    try{ window.opener && window.opener.postMessage(Object.assign({type:'ARGUS_BUS'}, msg), '*'); }catch(e){ /* ignore */ }
    try{ if (typeof GM_setValue==='function') GM_setValue('ARGUS_VALBUS', JSON.stringify(msg)); }catch(e){ /* ignore */ }
    try{ window.dispatchEvent(new CustomEvent('ARGUS:'+String(topic).toUpperCase(), {detail:payload})); }catch(e){ /* ignore */ }
  }
  function emitLoaded(force){
    const got = qsaCount(SELS.review);
    const n = got.n; lastSel = got.sel || lastSel;
    if (force || n > lastCount){
      lastCount = n;
      busSend('progress', {url: location.href, loaded: n, collected: seen.size, sel:lastSel, ts: Date.now()});
      LOG.push('log','Loaded count', {n:n, sel:lastSel});
    }
  }
  function parseOne(el){
    try{
      const id = el.getAttribute('data-review-id') || el.id || '';
      if (!id) return null;
      const ratingEl = el.querySelector('[aria-label*="stars"], [role="img"][aria-label*="star"]');
      const textEl = el.querySelector('[data-review-text], .qdXAlf, .wiI7pd, span[jsname]');
      const authorEl = el.querySelector('a[href*="contrib"], .d4r55, .WKxvr');
      const timeEl = el.querySelector('span[class*="rsqaWe"], .rsqaWe, .dehysf');
      const rating = ratingEl ? (parseFloat((ratingEl.getAttribute('aria-label')||'').replace(/[^0-9.]/g,''))||null) : null;
      const text = textEl ? textEl.textContent.trim() : '';
      const author = authorEl ? authorEl.textContent.trim() : '';
      const time = timeEl ? timeEl.textContent.trim() : '';
      return {id:id, rating:rating, text:text, author:author, time:time};
    }catch(e){ return null; }
  }
  function collect(){
    const nodes = Array.from(document.querySelectorAll(lastSel));
    const batch = [];
    for (var i=0;i<nodes.length;i++){
      const el = nodes[i];
      const id = el.getAttribute('data-review-id') || el.id || '';
      if (!id || seen.has(id)) continue;
      const row = parseOne(el);
      if (row){ seen.add(id); batch.push(row); }
      if (batch.length >= CFG.chunkSize){
        busSend('data', {url: location.href, rows: batch.slice(0)});
        busSend('progress', {url: location.href, loaded: lastCount, collected: seen.size, sel:lastSel, ts: Date.now()});
        batch.length = 0;
      }
    }
    if (batch.length){
      busSend('data', {url: location.href, rows: batch});
      busSend('progress', {url: location.href, loaded: lastCount, collected: seen.size, sel:lastSel, ts: Date.now()});
    }
  }

  function watchProgress(){
    const target = qsAny(SELS.panel) || document.body;
    try{
      const mo = new MutationObserver(function(){ try{ emitLoaded(false); }catch(e){ /* ignore */ } });
      mo.observe(target, {childList:true, subtree:true});
    }catch(e){ /* ignore */ }
    emitLoaded(true);
    try{ setInterval(function(){ try{ emitLoaded(false); }catch(e){ /* ignore */ } }, CFG.pollMs); }catch(e){ /* ignore */ }
    try{ setInterval(function(){ try{ collect(); }catch(e){ /* ignore */ } }, Math.max(2000, CFG.pollMs*1.2)); }catch(e){ /* ignore */ }
  }

  (function setupCoordinator(){
    if (window.opener) return;
    const map = new Map();
    function render(){
      const totalLoaded = Array.from(map.values()).reduce(function(s,o){ return s + (o.loaded||0); }, 0);
      const totalCollected = Array.from(map.values()).reduce(function(s,o){ return s + (o.collected||0); }, 0);
      try{
        document.title = document.title.replace(/^Argus \[[^\]]+\]\s*/,'');
        document.title = 'Argus [L'+totalLoaded+'|C'+totalCollected+'] ' + document.title;
        const meter = document.querySelector('[data-argus-progress]');
        if (meter) meter.textContent = String(totalCollected);
      }catch(e){ /* ignore */ }
    }
    function onProg(m){
      const d = (m && m.payload) ? m.payload : m;
      if (!d || !d.url) return;
      const cur = map.get(d.url) || {loaded:0, collected:0};
      cur.loaded = Math.max(cur.loaded, Number((d.loaded!=null)?d.loaded:(d.count||0)));
      cur.collected = Math.max(cur.collected, Number((d.collected!=null)?d.collected:(d.count||0)));
      map.set(d.url, cur); render();
    }
    try{ new BroadcastChannel('ARGUS_BUS').addEventListener('message', function(ev){ try{ if (ev && ev.data && ev.data.topic==='progress') onProg(ev.data); }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
    try{ new BroadcastChannel('ARGUS_PROGRESS').addEventListener('message', function(ev){ try{ onProg(ev.data); }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
    try{ window.addEventListener('message', function(ev){ try{ var d=ev && ev.data; if(d && d.type==='ARGUS_BUS' && d.topic==='progress') onProg(d); }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
    try{ window.addEventListener('storage', function(ev){ try{ if(ev && ev.key==='ARGUS_MAILBOX' && ev.newValue){ var m=JSON.parse(ev.newValue); if(m.topic==='progress') onProg(m); } }catch(e){ /* ignore */ } }); }catch(e){ /* ignore */ }
    window.ARGUS_ADV_DUMPLOG = function(){ return LOG.dump(); };
  })();

  function boot(){
    injectPageShim();
    trySentinel();
    keepWakeLock(); try{ setInterval(keepWakeLock, 30000); }catch(e){ /* ignore */ }
    keepAudio();
    try{ setInterval(tickScroll, CFG.tickMs); }catch(e){ /* ignore */ }
    watchProgress();
    LOG.push('log','Advanced focus-free bootstrap complete');
  }

  if (document.readyState === 'loading'){
    try{ document.addEventListener('DOMContentLoaded', boot, {once:true}); }catch(e){ /* ignore */ }
  } else {
    boot();
  }
})();

/* ===================== ARGUS Background Activator + Robust Open ===================== */
/* id:ARGUS_BG_ACTIVATOR_V1 */

(function(){
  if (window.__ARGUS_BG_ACTIVATOR__) return; window.__ARGUS_BG_ACTIVATOR__=true;

  const CFG = {
    glKickMs: 1200,
    synthMs: 2500,
    probeMs: 2000,
    maxOpenAttempts: 30
  };

  function injectSynthShim(){
    try{
      const code = `(function(){
        if (window.__ARGUS_SYNTH__) return; window.__ARGUS_SYNTH__=true;
        function fireAll(){
          try{ document.dispatchEvent(new Event('visibilitychange')); }catch{}
          try{ window.dispatchEvent(new Event('focus')); }catch{}
          try{ window.dispatchEvent(new Event('pageshow', {bubbles:true})); }catch{}
        }
        setInterval(fireAll, ${CFG.synthMs});
        setTimeout(fireAll, 400);
      })();`;
      const s = document.createElement('script'); s.textContent = code;
      (document.head||document.documentElement).appendChild(s); s.remove();
    }catch(e){ /* ignore */ }
  }

  function startGLKick(){
    try{
      const c = document.createElement('canvas'); c.width=2; c.height=2;
      Object.assign(c.style, {position:'fixed', width:'2px', height:'2px', opacity:0, pointerEvents:'none', bottom:'0', right:'0'});
      const gl = (c.getContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
      if (!gl) return;
      document.documentElement.appendChild(c);
      const tick = function(){ try{ gl.clearColor(Math.random()%1,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); }catch(e){ /* ignore */ } };
      setInterval(tick, CFG.glKickMs);
    }catch(e){ /* ignore */ }
  }

  const SELS = {
    panel: ['.m6QErb','[role="feed"][aria-label*="review"]','div[aria-label*="All reviews"] .m6QErb'],
    more: ['button[aria-label*="All reviews"]','button[aria-label*="More reviews"]','[jsname="i0F6df"]','[role="button"][aria-label*="reviews"]']
  };
  function qsAny(list, root){ for (var i=0;i<list.length;i++){ var sel=list[i]; var el=(root||document).querySelector(sel); if (el) return el; } return null; }
  function countReviews(){ try{ return document.querySelectorAll('div[data-review-id],div[data-review-id][jsaction],div[role="article"][data-review-id]').length; }catch(e){ return 0; } }

  let openAttempts = 0;
  function ensureOpened(){
    var panel = qsAny(SELS.panel);
    var n = countReviews();
    if (panel && n>0) return;
    if (openAttempts >= CFG.maxOpenAttempts) return;
    openAttempts++;
    var btn = qsAny(SELS.more);
    if (btn){
      try{ btn.scrollIntoView({block:'center'}); }catch(e){ /* ignore */ }
      try{ btn.click(); }catch(e){ /* ignore */ }
      try{ btn.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true})); }catch(e){ /* ignore */ }
      try{ btn.focus(); btn.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); }catch(e){ /* ignore */ }
    }
    var mainPanel = qsAny(SELS.panel) || document.scrollingElement || document.body;
    try{ mainPanel.dispatchEvent(new WheelEvent('wheel', {bubbles:true, deltaY:320})); }catch(e){ /* ignore */ }
  }

  function boot(){
    injectSynthShim();
    startGLKick();
    ensureOpened();
    try{ setInterval(ensureOpened, CFG.probeMs); }catch(e){ /* ignore */ }
  }

  if (document.readyState === 'loading'){
    try{ document.addEventListener('DOMContentLoaded', boot, {once:true}); }catch(e){ /* ignore */ }
  } else {
    boot();
  }
})();

/* ===================== ARGUS REVIEW EXTRACTION START (hardened) ===================== */
/* id:ARGUS_REVIEW_EXTRACTION_V2 */

(function () {
  const BUDGET_MS = +(window.ARGUS_USERSCRIPT_BUDGET_MS || '45000');
  const t0 = Date.now();

  function qsa(root, sel) { return Array.from(root.querySelectorAll(sel)); }
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

  async function openReviewsTab() {
    const candidates = [
      'button[role="tab"][data-tab-index][aria-selected="false"]', // new Maps
      'button[aria-label^="Reviews"]',
      'a[aria-label^="Reviews"][href*="/reviews"]'
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) { el.click(); await sleep(600); }
    }
  }

  function getScrollBox() {
    // Try new container first:
    let box =
      document.querySelector('div[data-argus-scrollbox="1"]') ||
      document.querySelector('div.m6QErb.DxyBCb') || 
      document.querySelector('div[aria-label="Reviews"] .m6QErb.DxyBCb') ||
      document.querySelector('div[role="region"] .m6QErb.DxyBCb');
    return box;
  }

  async function expandAll(box) {
    const btnSel = [
      'button[aria-label^="More"]',
      'button[jsaction*="pane.review.expandReview"]',
      'span.wiI7pd', // sometimes text toggle
    ];
    for (const sel of btnSel) {
      qsa(box || document, sel).forEach(b => { if (b instanceof HTMLElement) b.click(); });
      await sleep(200);
    }
  }

  function parseOne(root) {
    const get = (sel) => (root.querySelector(sel)?.textContent || '').trim();
    const ratingEl = root.querySelector('[aria-label*="stars"], [role="img"][aria-label*="star"]');
    const rating = ratingEl ? (parseFloat((ratingEl.getAttribute('aria-label')||'').match(/([0-9.]+)/)?.[1]||'') || null) : null;
    return {
      author: get('a[role="link"][href*="contrib"]') || get('.d4r55'),
      date: get('span[class*="rsqaWe"]') || get('span[class*="fTKmHE"]'),
      rating,
      text: get('[class*="MyEned"]') || get('[class*="wiI7pd"]') || get('div[aria-expanded="true"]')
    };
  }

  async function scrollUntilPlateau(box) {
    let prevCount = 0, stagnant = 0;
    while (Date.now() - t0 < BUDGET_MS) {
      box.scrollTo({ top: box.scrollHeight, behavior: 'instant' });
      await sleep(500);
      await expandAll(box);
      const items = qsa(box, '[data-review-id],[jscontroller="e6Mltc"], div[aria-label*="review"]');
      if (items.length > prevCount) { prevCount = items.length; stagnant = 0; }
      else stagnant++;
      if (stagnant >= 4) break;
    }
  }

  async function run() {
    await openReviewsTab();
    await sleep(800);
    const box = getScrollBox();
    if (!box) { window.__ARGUS_RESULT__ = { loaded: 0, rows: [] }; return; }
    await expandAll(box);
    await scrollUntilPlateau(box);
    const cards = qsa(box, '[data-review-id],[jscontroller="e6Mltc"], div[aria-label*="review"]');
    const rows = cards.map(parseOne).filter(r => r.text || r.rating);
    window.__ARGUS_RESULT__ = { loaded: cards.length, rows };
  }

  run();
})();

})();