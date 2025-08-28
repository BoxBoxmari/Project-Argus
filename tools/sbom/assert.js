import { existsSync, readFileSync } from 'node:fs';
const p = 'sbom/combined.cdx.json';
if (!existsSync(p)) { console.error('combined SBOM not found'); process.exit(1); }
const j = JSON.parse(readFileSync(p,'utf8'));
const n = (j.components||[]).length||0;
console.log('combined components:', n);
if (n === 0) { console.error('SBOM is empty'); process.exit(2); }
