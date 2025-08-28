// Browser-compatible pseudo functions for userscript
export async function sha256Hex(msg: string): Promise<string> {
  // Browser-only implementation
  // @ts-ignore
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(msg);
    // @ts-ignore
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  // Fallback for environments where crypto is not available
  throw new Error('No crypto implementation available');
}

export async function authorHash(author: string, salt: string, take: number = 32): Promise<string> {
  const hex = await sha256Hex(`${salt}|${author.trim().toLowerCase()}`);
  return hex.slice(0, Math.max(16, Math.min(64, take)));
}
