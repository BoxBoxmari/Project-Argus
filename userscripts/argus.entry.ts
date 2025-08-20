/**
 * Argus Userscript entry.
 * Responsibilities:
 * - Provide UI to collect place URLs and export as txt
 * - Manage progress state with hard reset capability
 * - Avoid double-counting discovered links
 */
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
setInterval(collectPlaceLinks, 1500);
