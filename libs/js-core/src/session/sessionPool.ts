// Hardcoded user agents to avoid JSON import issues
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0'
];

export type Session = { id: string; ua: string; proxy?: string; cookies?: string[]; score: number; bornAt: number; uses: number; };
export class SessionPool {
    private pool: Session[] = [];

    constructor(private cfg: { maxAgeMs: number; minScore: number; proxies?: string[] }) { }

    get(): Session {
        let s = this.pool.find(x => Date.now() - x.bornAt < this.cfg.maxAgeMs && x.score >= this.cfg.minScore);
        if (!s) {
            s = this.spawn();
            this.pool.push(s);
        }
        s.uses++;
        return s;
    }

    report(s: Session, ok: boolean) {
        s.score += ok ? +0.5 : -1.0;
    }

    private spawn(): Session {
        const id = Math.random().toString(36).slice(2);
        const proxy = this.cfg.proxies?.length ? this.cfg.proxies[Math.floor(Math.random() * this.cfg.proxies.length)] : undefined;
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? 'Mozilla/5.0';

        return {
            id,
            ua,
            proxy,
            cookies: [],
            score: 1,
            bornAt: Date.now(),
            uses: 0
        };
    }
}