export async function sha256Hex(msg: string): Promise<string> {
  // Browser-first
  // @ts-ignore
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(msg);
    // @ts-ignore
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  // Node fallback - only import if we're in Node.js environment
  // @ts-ignore
  if (typeof window === 'undefined' && typeof require !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createHash } = require('node:crypto');
    return createHash('sha256').update(msg).digest('hex');
  }
  // Fallback for environments where neither is available
  throw new Error('No crypto implementation available');
}

export async function authorHash(author: string, salt: string, take: number = 32): Promise<string> {
  const hex = await sha256Hex(`${salt}|${author.trim().toLowerCase()}`);
  return hex.slice(0, Math.max(16, Math.min(64, take)));
}
