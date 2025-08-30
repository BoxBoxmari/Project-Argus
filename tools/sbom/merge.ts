import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type Bom = { bomFormat:string; specVersion:string; version?:number; components?: any[]; metadata?: any };
const dir = 'sbom';
const files = readdirSync(dir).filter(f=>f.endsWith('.cdx.json') && f!=='combined.cdx.json');
const pick = (x:any, k:string, d:any)=> x?.[k] ?? d;

const acc: Bom = { bomFormat: 'CycloneDX', specVersion: '1.5', version: 1, components: [], metadata: { tools: [{ vendor:'argus', name:'sbom-merge', version:'1.0.0' }] } };
const seen = new Set<string>();
for (const f of files) {
  const bom: Bom = JSON.parse(readFileSync(join(dir,f),'utf8'));
  for (const c of (bom.components||[])) {
    const key = c.purl || `${c.group||''}:${c.name}:${c.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    acc.components!.push(c);
  }
}
writeFileSync(join(dir,'combined.cdx.json'), JSON.stringify(acc,null,2));
console.log(`merged ${files.length} → sbom/combined.cdx.json with ${acc.components!.length} components`);
