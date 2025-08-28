export const gm = {
  get<T=unknown>(key: string, def?: T): Promise<T>|T {
    // @ts-ignore
    if (typeof GM_getValue === 'function') return (GM_getValue as any)(key, def);
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : (def as T); } catch { return (def as T); }
  },
  set<T=unknown>(key: string, val: T): Promise<void>|void {
    // @ts-ignore
    if (typeof GM_setValue === 'function') return (GM_setValue as any)(key, val);
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
  download(opts: { url: string; name?: string }) {
    // @ts-ignore
    if (typeof GM_download === 'function') return (GM_download as any)(opts);
    // Fallback: open new tab (Playwright sẽ chặn/ghi log)
    window.open(opts.url, '_blank');
  }
};
