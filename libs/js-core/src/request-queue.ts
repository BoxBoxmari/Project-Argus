import { createWriteStream, promises as fs } from 'fs';
import { createHash } from 'crypto';
import { dirname } from 'path';

export type Req = { url:string; method?:string; userData?:any; uniqueKey?:string; priority?:number };
type State = 'queued'|'in-progress'|'handled'|'failed';
type Item = Req & { id:string; state:State; retries:number; lastError?:string };
export type QueueStats = { total:number; queued:number; inProgress:number; handled:number; failed:number };
type Opts = { resetOnStart?: boolean };

export class RequestQueue {
  private file:string; private w:any; private opts:Opts;
  private mem = new Map<string,Item>();
  constructor(file:string, opts:Opts = {}){ this.file=file; this.opts=opts; }
  async init(){
    await fs.mkdir(dirname(this.file), { recursive:true});
    if (this.opts.resetOnStart) { try{ await fs.writeFile(this.file,''); } catch{} }
    this.w = createWriteStream(this.file, { flags:'a' });
    try {
      const txt = await fs.readFile(this.file,'utf8');
      for (const line of txt.split('\n')) if(line){
        const it:Item = JSON.parse(line); this.mem.set(it.id, it);
      }
    } catch {}
  }
  private static keyOf(r:Req){ return r.uniqueKey ?? createHash('sha1').update(r.url).digest('hex'); }
  async add(r:Req){
    const id = RequestQueue.keyOf(r);
    const existed = this.mem.get(id);
    if(existed){
      if((r.priority??0) > (existed.priority??0)){ existed.priority = r.priority; this.w.write(JSON.stringify(existed)+'\n'); }
      return existed;
    }
    const it:Item = { ...r, id, state:'queued', retries:0 };
    this.mem.set(id,it); this.w.write(JSON.stringify(it)+'\n'); return it;
  }
  async addOrRequeue(r:Req){
    const id = RequestQueue.keyOf(r);
    const existed = this.mem.get(id);
    if(existed){
      existed.state='queued'; existed.retries=0; existed.lastError=undefined;
      if((r.priority??0) > (existed.priority??0)) existed.priority = r.priority;
      this.w.write(JSON.stringify(existed)+'\n'); return existed;
    }
    return this.add(r);
  }
  async fetchNext(){
    const next = [...this.mem.values()].filter(x=>x.state==='queued')
      .sort((a,b)=>(b.priority??0)-(a.priority??0))[0];
    if(!next) return null;
    next.state='in-progress'; this.w.write(JSON.stringify(next)+'\n'); return next;
  }
  async markHandled(id:string){ const it=this.mem.get(id); if(it){ it.state='handled'; this.w.write(JSON.stringify(it)+'\n'); } }
  async markFailed(id:string, err:string){ const it=this.mem.get(id); if(it){ it.state='failed'; it.lastError=err; this.w.write(JSON.stringify(it)+'\n'); } }
  getStats():QueueStats{
    let q=0, ip=0, h=0, f=0;
    for(const it of this.mem.values()){
      if(it.state==='queued') q++;
      else if(it.state==='in-progress') ip++;
      else if(it.state==='handled') h++;
      else if(it.state==='failed') f++;
    }
    return { total:this.mem.size, queued:q, inProgress:ip, handled:h, failed:f };
  }
  async close(){ await new Promise<void>(res=>{ try{ this.w?.end(()=>res()); } catch{ res(); } }); }
}
