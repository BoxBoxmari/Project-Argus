// AutoscaledPool with CPU + memory monitoring
import { performance } from 'perf_hooks';

export class AutoscaledPool {
  constructor(
    private run: (slot: number) => Promise<void>, 
    private opt = { min: 1, max: 4, lagMs: 120, rssMB: 2200 }
  ) {}
  
  async start() {
    let conc = this.opt.min; 
    const running = new Set<Promise<void>>();
    
    const spawn = () => { 
      while (running.size < conc) { 
        const p = this.run(running.size).finally(() => running.delete(p)); 
        running.add(p);
      } 
    };
    
    const tick = async () => {
      const lag = await measureLag(); 
      const rss = process.memoryUsage().rss / 1e6;
      if (lag < this.opt.lagMs && rss < this.opt.rssMB && conc < this.opt.max) conc++;
      if (lag > this.opt.lagMs * 1.3 || rss > this.opt.rssMB * 1.1) conc = Math.max(this.opt.min, conc - 1);
      spawn(); 
      setTimeout(tick, 1000);
    };
    
    spawn(); 
    setTimeout(tick, 1000); 
    await Promise.all(running);
  }
}

async function measureLag() { 
  const t = Date.now(); 
  await new Promise(r => setImmediate(r)); 
  return Date.now() - t; 
}
