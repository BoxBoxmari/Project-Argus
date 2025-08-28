import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

function sha256(p){ const b = readFileSync(p); return createHash('sha256').update(b).digest('hex'); }

function collect(globs){
  const out = [];
  for (const g of globs){
    const [dir, suf] = g.split('**/'); // simple globber for dist files
    if (!existsSync(dir)) continue;
    const walk=(d)=>readdirSync(d).forEach(f=>{
      const p=join(d,f), s=statSync(p);
      if (s.isDirectory()) return walk(p);
      if (!suf || p.endsWith(suf)) out.push(p);
    }); walk(dir);
  }
  return out;
}

const files = [
  'libs/', 'apps/'
].flatMap(d => collect([`${d}**/dist/**.js`]));

if (existsSync('export/reviews.safe.jsonl')) files.push('export/reviews.safe.jsonl');

const list = files.map(f => ({ file: f, sha256: sha256(f) }));

writeFileSync('PROVENANCE.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  git: process.env.GITHUB_SHA || '',
  artifacts: list
}, null, 2));

console.log('PROVENANCE.json written');
