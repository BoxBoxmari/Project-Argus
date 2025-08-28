import { parse } from 'robots-txt-parse';
export async function robotsAllowed(url: string): Promise<boolean> {
  if (process.env.ARGUS_ROBOTS_RESPECT !== '1') return true;
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
    return !disallow.some((p: string) => u.pathname.startsWith(p));
  } catch { return true; }
}
