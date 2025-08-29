import fs from 'node:fs'; import path from 'node:path';
const moveList = [
  ['apps/e2e/fixtures','archive/tests/fixtures'],
  ['apps/e2e/reports','archive/tests/reports'],
  ['apps/e2e/metrics','archive/tests/metrics']
];
function ensure(p:string){ fs.mkdirSync(p,{recursive:true}); }
function mvDir(src:string,dst:string){ if (!fs.existsSync(src)) return; ensure(dst); for (const f of fs.readdirSync(src)) fs.renameSync(path.join(src,f), path.join(dst,f)); }
for (const [s,d] of moveList) mvDir(s,d);
const purge = ['**/dist','**/coverage','**/playwright','**/.cache']; // simple pass: explicit dirs below
['apps','libs'].forEach(root => {
  for (const d of ['dist','coverage','playwright','.cache']) {
    const p = path.join(root, d);
    if (fs.existsSync(p)) fs.rmSync(p,{recursive:true,force:true});
  }
});
function rmEmpty(dir:string){
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir,e);
    if (fs.statSync(p).isDirectory()) { rmEmpty(p); const left = fs.readdirSync(p).length; if (left===0) fs.rmdirSync(p); }
  }
}
rmEmpty('.');
fs.writeFileSync('CLEANUP_MANIFEST.json', JSON.stringify({ moved: moveList, ts: new Date().toISOString() }, null, 2));
console.log('final cleanup done');
