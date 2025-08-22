export const SELS = {
  panel: ['.m6QErb','[role="feed"][aria-label*="review"]','div[aria-label*="All reviews"] .m6QErb'],
  reviewItem: ['div[data-review-id]','div[role="article"][data-review-id]','div[data-review-id][jsaction]'],
  moreBtn: ['button[jsaction*="more"]','span[role="button"][jsaction*="more"]','button[aria-label*="More"]','button[aria-label*="Xem thêm"]']
};

export function qsAny(list: string[], root: Document | Element = document): Element | null {
  for (const s of list) {
    const el = (root as Document).querySelector?.(s) || (root as Element).querySelector?.(s);
    if (el) return el as Element;
  }
  return null;
}

export function qsaCount(list: string[]): { n: number; sel: string } {
  for (const sel of list) {
    const n = document.querySelectorAll(sel).length;
    if (n) return { n, sel };
  }
  return { n: 0, sel: list[0] || '' };
}
