import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const ws = process.argv[2];
const out = process.argv[3] || `sbom/sbom.${ws.replace(/[@/]/g,'_')}.cdx.json`;
if (!ws) { console.error('usage: tsx tools/sbom/from-pnpm.ts <workspace> [outfile]'); process.exit(1); }

function ls(ws:string){
  // Increase maxBuffer to handle large outputs
  const j = execSync(`pnpm --filter ${ws} list --prod --depth 3 --json`, {
    stdio: ['ignore','pipe','ignore'],
    maxBuffer: 1024 * 1024 * 10 // 10MB buffer
  }).toString();
  // Output là một mảng các node; gom tất cả dependencies đệ quy
  const nodes = JSON.parse(j);
  const comps = new Map<string,{name:string,version:string,purl:string}>();

  // The output is an array with one object containing dependencies
  if (nodes.length === 0) return Array.from(comps.values());

  const root = nodes[0];

  function visitDependencies(deps: any) {
    if (!deps) return;

    for (const [name, depInfo] of Object.entries(deps)) {
      const version = (depInfo as any).version;
      if (version) {
        const key = `${name}@${version}`;
        if (!comps.has(key)) {
          comps.set(key, { name, version, purl: `pkg:npm/${name}@${version}` });
        }
      }

      // Recursively visit nested dependencies
      if ((depInfo as any).dependencies) {
        visitDependencies((depInfo as any).dependencies);
      }
    }
  }

  // Visit direct dependencies
  visitDependencies(root.dependencies);

  return Array.from(comps.values());
}

const components = ls(ws);
const bom = { bomFormat:'CycloneDX', specVersion:'1.5', version:1, components };
writeFileSync(out, JSON.stringify(bom,null,2));
console.log(`fallback SBOM written: ${out} (${components.length} components)`);
