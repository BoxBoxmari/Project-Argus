import fs from 'node:fs';
const histPath = 'apps/e2e/reports/history.json';
if (!fs.existsSync(histPath)) process.exit(0);
const hist = JSON.parse(fs.readFileSync(histPath,'utf8'));
const winners = Object.entries(hist).filter(([id, arr]:any)=> (arr as string[]).slice(-140).every(s=>s==='passed')); // ~10/run * 14 days
function patch(file:string){
  let src = fs.readFileSync(file,'utf8'), changed=false;
  for (const [id] of winners){
    const re = new RegExp(`(test\\(\\\`(${id})[^\\\`]*?)\\s\\[(stable|quarantine)\\]`,'g');
    src = src.replace(re, (_m, head, _id, cur) => { if (cur==='stable') return _m; changed=true; return `${head} [stable]`; });
  }
  if (changed) fs.writeFileSync(file, src);
  return changed;
}
let any=false;
['apps/e2e/tests/sim.matrix.spec.ts','apps/e2e/tests/real.matrix.spec.ts'].forEach(f=>{ if (fs.existsSync(f)) any = patch(f) || any; });
if (any) { console.log('auto-promote applied'); process.exit(2); }