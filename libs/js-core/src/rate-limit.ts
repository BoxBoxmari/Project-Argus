type Bucket = { capacity:number; tokens:number; refillMs:number; last:number };
export class DomainRateLimiter {
  private buckets = new Map<string,Bucket>();
  constructor(private defaults={capacity:1, refillMs:9000}){} // 1 token/9s mặc định
  configure(host:string, capacity:number, refillMs:number){
    this.buckets.set(host, { capacity, tokens:capacity, refillMs, last:Date.now() });
  }
  private bucket(host:string):Bucket{
    if(!this.buckets.has(host)){
      const {capacity,refillMs}=this.defaults;
      this.buckets.set(host,{capacity,tokens:capacity,refillMs,last:Date.now()});
    }
    return this.buckets.get(host)!;
  }
  async take(host:string){
    const b = this.bucket(host);
    for(;;){
      const now = Date.now();
      const elapsed = now - b.last;
      if(elapsed >= b.refillMs){
        const n = Math.floor(elapsed / b.refillMs);
        b.tokens = Math.min(b.capacity, b.tokens + n);
        b.last = now;
      }
      if(b.tokens > 0){ b.tokens--; return; }
      const wait = b.refillMs - (Date.now() - b.last);
      await new Promise(r=>setTimeout(r, Math.max(50, wait)));
    }
  }
}
