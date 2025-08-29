import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

type Case = { backend:'mcp'|'crawlee'|'userscript'; block:boolean; locale:string; device:'Desktop'|'Mobile'; network:'normal'|'slow3g' };
const url = process.env.ARGUS_TEST_URL || 'https://www.google.com/maps';
const cases: Case[] = [];
const backends: Case['backend'][] = (process.env.AB_BACKENDS || 'mcp,crawlee').split(',') as any;
const blocks = [true,false], locales = ['en-US','vi-VN'], devices = ['Desktop','Mobile'], nets = ['normal','slow3g'];
for (const b of backends) for (const bl of blocks) for (const lo of locales) for (const d of devices) for (const n of nets) cases.push({ backend:b, block:bl, locale:lo, device:d as any, network:n as any });

function runOne(c:Case){
  const env = { ...process.env, ARGUS_BACKEND: c.backend, ARGUS_BLOCK_RESOURCES: c.block?'1':'0', ARGUS_LOCALE:c.locale, ARGUS_TEST_URL:url };
  const r = spawnSync('pnpm', ['-C','libs/runner-hybrid','start'], { env, stdio: 'inherit' });
  return r.status===0;
}

const res:any[] = [];
for (const c of cases) {
  const ok = runOne(c);
  res.push({ ...c, ok, ts: Date.now() });
}
mkdirSync('results/ab', { recursive:true });
writeFileSync(path.join('results/ab','ab.results.json'), JSON.stringify(res,null,2));
console.log('A/B done', res.length);