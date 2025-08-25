// SessionPool: rotate on 403/429/nav-fail; attach UA/locale; simple score decay
export type Session = {
  id: string;
  ua: string;
  score: number;
  used: number;
  proxy?: string;
  failures: number;
  backoffUntil: number;
};

export class SessionPool {
  private pool: Session[] = [];
  
  constructor(private opt = { size: 6, minScore: 0.3 }) { 
    for (let i = 0; i < this.opt.size; i++) this.pool.push(newSession()); 
  }
  
  borrow() {
    const now = Date.now();
    const available = this.pool
      .filter(s => now >= s.backoffUntil)
      .sort((a, b) => b.score - a.score);
    if (available.length) return available[0];
    return this.pool.sort((a, b) => a.backoffUntil - b.backoffUntil)[0];
  }
  
  penalize(s: Session, amt = 0.15) {
    s.score = Math.max(0, s.score - amt);
    s.used++;
    s.failures++;
    const delay = Math.min(30000, 1000 * 2 ** s.failures);
    s.backoffUntil = Date.now() + delay;
    if (s.score < this.opt.minScore) Object.assign(s, newSession());
  }
  
  reward(s: Session, amt = 0.02) {
    s.score = Math.min(1, s.score + amt);
    s.used++;
    s.failures = 0;
    s.backoffUntil = 0;
  }
}

function newSession(): Session {
  return {
    id: Math.random().toString(36).slice(2),
    ua: randUA(),
    score: 0.7,
    used: 0,
    failures: 0,
    backoffUntil: 0
  };
}

function randUA() { 
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36"; 
}
