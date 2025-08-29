import { parse } from 'robots-txt-parse';
// đảm bảo soft-fail + cảnh báo rõ ràng
const respect = process.env.ARGUS_ROBOTS_RESPECT !== '0';
const override = process.env.ARGUS_OVERRIDE === '1';
export async function robotsAllowed(url: string): Promise<boolean> {
  if (!respect) return true;
  try {
    const u = new URL(url);
    const robots = `${u.origin}/robots.txt`;
    const res = await fetch(robots, { headers: { 'User-Agent':'ArgusBot/1.0' } });
    if (!res.ok) return true;
    const text = await res.text();
    const { groups } = parse(text);
    const ua = groups.find((g: any) => g.userAgent.includes('*')) || groups[0];
    if (!ua) return true;
    const disallow = ua.rules.filter((r: any) => r.type === 'disallow').map((r: any) => r.path);
    const isDisallowed = disallow.some((p: string) => u.pathname.startsWith(p));
    // nếu bị disallow và !override => skip + warn; nếu override => log WARN và tiếp tục
    if (isDisallowed && !override) {
      console.warn(`[robots] Disallowed by robots.txt: ${url}`);
      return false;
    } else if (isDisallowed && override) {
      console.warn(`[robots] OVERRIDE: Disallowed by robots.txt but proceeding: ${url}`);
      return true;
    }
    return true;
  } catch { return true; }
}
