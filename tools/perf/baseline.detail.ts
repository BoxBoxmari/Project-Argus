import fs from 'node:fs'; import path from 'node:path';
const dir = 'results/hybrid';
if (!fs.existsSync(dir)) { console.error('missing results/hybrid'); process.exit(1); }

function load(){ return fs.readdirSync(dir).filter(f=>/^metrics\.(\w+)\.\d+\.json$/.test(f))
  .map(f=>({ f, j: JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')) })); }
function p(v:number[], q:number){ if(!v.length) return 0; const s=[...v].sort((a,b)=>a-b); const i=Math.floor((s.length-1)*q); return s[i]; }

const data = load();
const by = new Map<string, {open:number[], pane:number[] }>();
for (const {f,j} of data){
  const backend = f.split('.')[1];
  const o = Number(j.open_ms||j.metrics?.open_ms||0);
  const pn = Number(j.pane_ms||j.metrics?.pane_ms||0);
  if (!by.has(backend)) by.set(backend, {open:[], pane:[]});
  by.get(backend)!.open.push(o); by.get(backend)!.pane.push(pn);
}
const out:any = { createdAt: new Date().toISOString(), stats:{} };
for (const [b,arr] of by){
  out.stats[b] = {
    p50_open_ms: p(arr.open,0.5), p95_open_ms: p(arr.open,0.95),
    p50_pane_ms: p(arr.pane,0.5), p95_pane_ms: p(arr.pane,0.95),
    n: arr.open.length
  };
}
fs.mkdirSync('metrics',{recursive:true});
fs.writeFileSync('metrics/perf.baseline.detail.json', JSON.stringify(out,null,2));
console.log('metrics/perf.baseline.detail.json written');
