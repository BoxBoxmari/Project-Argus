import { SELS, qsAny } from '../core/selectors';

export function injectAntiIdleInPage(): void {
  // giữ nguyên triết lý Userscript: synth events + glKick
  if ((window as any).__ARGUS_SYNTH__) return;
  (window as any).__ARGUS_SYNTH__ = true;

  function fireAll(): void {
    try { document.dispatchEvent(new Event('visibilitychange')); } catch { /* ignore */ }
    try { window.dispatchEvent(new Event('focus')); } catch { /* ignore */ }
    try { window.dispatchEvent(new Event('pageshow', { bubbles: true } as any)); } catch { /* ignore */ }
  }

  setInterval(fireAll, 2500);
  setTimeout(fireAll, 400);

  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 2;
  Object.assign(c.style, {
    position: 'fixed',
    width: '2px',
    height: '2px',
    opacity: '0',
    pointerEvents: 'none',
    bottom: '0',
    right: '0'
  });

  const gl = (c.getContext && ((c.getContext('webgl') as any) || (c.getContext('experimental-webgl') as any)));
  if (gl) {
    document.documentElement.appendChild(c);
    setInterval(() => {
      try {
        gl.clearColor(Math.random() % 1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } catch { /* ignore */ }
    }, 1200);
  }
}

export function ensureOpened(): boolean {
  const panel = qsAny(SELS.panel) as HTMLElement | null;
  const hasItems = document.querySelectorAll(SELS.reviewItem.join(',')).length > 0;
  if (panel && hasItems) return true;

  const more = qsAny(['button[role="tab"][aria-label*="Reviews" i]', 'a[href*="=reviews"]', 'div[role="tab"][aria-label*="Reviews" i]']) as HTMLElement | null;
  try {
    more?.scrollIntoView({ block: 'center' } as any);
    more?.click();
  } catch { /* ignore */ }

  try {
    (panel || document.scrollingElement || document.body).dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 320 }));
  } catch { /* ignore */ }

  return false;
}

export function clickMoreIfAny(root: Element | Document = document): void {
  const more = qsAny(['button[jsaction*="more"]', 'span[role="button"][jsaction*="more"]', 'button[aria-label*="More"]', 'button[aria-label*="Xem thêm"]'], root as any) as HTMLElement | null;
  try {
    more?.click();
  } catch { /* ignore */ }
}

export interface ReviewData {
  review_id: string | null;
  author: string | null;
  relative_time: string | null;
  text: string;
  rating: number | null;
  translated: boolean;
  likes: number;
  photos: number;
}

export function collectOnce(): ReviewData[] {
  const items = Array.from(document.querySelectorAll(SELS.reviewItem.join(',')));

  function txt(el: Element | null, sel?: string): string {
    try {
      const n = sel ? el?.querySelector(sel) : el;
      return (n?.textContent || '').trim();
    } catch {
      return '';
    }
  }

  function parseRating(root: Element): number | null {
    const aria = root.querySelector('[aria-label*="star"]') as HTMLElement | null;
    const m = aria?.getAttribute('aria-label')?.match(/[\d.]+/);
    return m ? Number(m[0]) : null;
  }

  return items.map(el => {
    const rid = (el as HTMLElement).getAttribute('data-review-id') || null;
    return {
      review_id: rid,
      author: txt(el, 'a[href*="contrib"], a[aria-label*="Profile"]') || null,
      relative_time: txt(el, 'span[aria-label*="ago"], span[data-original-text], .rsqaWe') || null,
      text: txt(el, 'span[jscontroller], span[class*="wiI7pd"], span[class*="MyEned"]') || '',
      rating: parseRating(el),
      translated: /Translated by Google/i.test(el.textContent || ''),
      likes: Number((txt(el, 'button[aria-label*="like" i], div[aria-label*="like" i]').match(/\d+/) || [0])[0]),
      photos: el.querySelectorAll('img').length
    };
  });
}

export async function runMinerLoop(rounds = 60): Promise<ReviewData[]> {
  injectAntiIdleInPage();
  let total = 0;

  for (let i = 0; i < rounds; i++) {
    ensureOpened();
    clickMoreIfAny(qsAny(SELS.panel) || document);

    const step = Math.max(200, Math.floor(((qsAny(SELS.panel) as HTMLElement)?.clientHeight || 600) * 0.9));
    try {
      (qsAny(SELS.panel) as HTMLElement)?.scrollBy(0, step);
    } catch { /* ignore */ }

    await new Promise(r => setTimeout(r, 240));

    const now = document.querySelectorAll(SELS.reviewItem.join(',')).length;
    if (now > total) {
      total = now;
      (window as any).__ARGUS_EMIT__?.({ type: 'progress', url: location.href, count: total, ts: Date.now() });
    }
  }

  return collectOnce();
}
