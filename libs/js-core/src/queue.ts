// Minimal RequestQueue + BloomFilter
import * as crypto from "node:crypto";

export type Req = { 
  url: string; 
  key?: string; 
  meta?: any; 
  depth?: number; 
  domain?: string; 
  priority?: number 
};

class Bloom {
  private m: Uint8Array; 
  private n: number;
  
  constructor(n = 1 << 20) { 
    this.n = n; 
    this.m = new Uint8Array(n >> 3); 
  }
  
  private h(s: string, seed: number) { 
    return crypto.createHash("sha1").update(seed + s).digest()[0] % this.n; 
  }
  
  has(s: string) { 
    const a = this.h(s, 17), b = this.h(s, 29); 
    return ((this.m[a >> 3] >> (a & 7)) & 1) && ((this.m[b >> 3] >> (b & 7)) & 1); 
  }
  
  add(s: string) { 
    const a = this.h(s, 17), b = this.h(s, 29); 
    this.m[a >> 3] |= 1 << (a & 7); 
    this.m[b >> 3] |= 1 << (b & 7); 
  }
}

export class RequestQueue {
  private q: Req[] = []; 
  private seen = new Bloom();
  
  enqueue(r: Req) { 
    const k = r.key ?? r.url; 
    if (this.seen.has(k)) return false; 
    this.seen.add(k); 
    if (r.priority == null) r.priority = 0; 
    this.q.push(r); 
    return true; 
  }
  
  dequeue() { 
    return this.q.shift(); 
  }
  
  size() { 
    return this.q.length; 
  }
}
