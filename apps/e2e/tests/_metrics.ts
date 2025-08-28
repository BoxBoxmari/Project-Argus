import fs from 'node:fs';
import path from 'node:path';

export class Metrics {
  private t: Record<string, number> = {};

  start(k:string){
    this.t[k]=performance.now();
  }

  end(k:string){
    this.t[k]=performance.now()-this.t[k];
  }

  write(file:string){
    const p=path.resolve(process.cwd(),'apps/e2e/metrics',file);
    fs.mkdirSync(path.dirname(p),{recursive:true});
    fs.writeFileSync(p, JSON.stringify(this.t,null,2));
  }
}
