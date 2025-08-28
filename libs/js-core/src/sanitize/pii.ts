export type PiiStats = { emails: number; phones: number };
const emailRe = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phoneRe = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g;

export function redactPII(text: string): { text: string; stats: PiiStats } {
  let emails = 0, phones = 0;
  const t1 = text.replace(emailRe, () => { emails++; return '[redacted-email]'; });
  const t2 = t1.replace(phoneRe, (m) => {
    // Heuristic: ignore short sequences that are likely not phone numbers (<7 digits)
    const digits = (m.match(/\d/g) || []).length;
    if (digits < 7) return m;
    phones++; return '[redacted-phone]';
  });
  return { text: t2, stats: { emails, phones } };
}

export function maybeRedact(text: string, enabled: boolean): { text: string; stats: PiiStats } {
  return enabled ? redactPII(text) : { text, stats: { emails: 0, phones: 0 } };
}
