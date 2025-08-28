import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type WS = { name: string; path: string };
function getWorkspaces(): WS[] {
  const out = execSync('pnpm -r list --depth -1 --json', { stdio: ['ignore','pipe','inherit'] }).toString();
  const arr = JSON.parse(out) as any[];
  return arr.map(x => ({ name: x.name, path: x.path }));
}

function compCount(p:string){ try { const j = JSON.parse(readFileSync(p,'utf8')); return (j.components||[]).length||0; } catch { return 0; } }

function run(ws: WS) {
  const outFile = join(resolve('sbom'), `sbom.${ws.name.replace(/[@/]/g,'_')}.cdx.json`);
  console.log(`Generating SBOM for ${ws.name} at ${ws.path}...`);

  // Try multiple approaches
  const approaches = [
    // Approach 1: Direct pnpm exec in workspace directory
    () => {
      execSync(`pnpm exec cyclonedx-npm --output-format JSON --output-file "${outFile}"`, {
        stdio: 'inherit',
        cwd: ws.path
      });
    },
    // Approach 2: Using filter
    () => {
      execSync(`pnpm --filter "${ws.name}" exec cyclonedx-npm --output-format JSON --output-file "${outFile}"`, {
        stdio: 'inherit'
      });
    },
    // Approach 3: Package lock only
    () => {
      execSync(`pnpm exec cyclonedx-npm --package-lock-only --output-format JSON --output-file "${outFile}"`, {
        stdio: 'inherit',
        cwd: ws.path
      });
    },
    // Approach 4: Ignore npm errors
    () => {
      execSync(`pnpm exec cyclonedx-npm --ignore-npm-errors --output-format JSON --output-file "${outFile}"`, {
        stdio: 'inherit',
        cwd: ws.path
      });
    },
    // Approach 5: Try with npm directly
    () => {
      execSync(`npx @cyclonedx/cyclonedx-npm@4.0.0 --output-format JSON --output-file "${outFile}"`, {
        stdio: 'inherit',
        cwd: ws.path
      });
    }
  ];

  for (let i = 0; i < approaches.length; i++) {
    try {
      console.log(`Trying approach ${i + 1} for ${ws.name}...`);
      approaches[i]();
      console.log(`Generated SBOM for ${ws.name} at ${outFile}`);
      // Check if the generated SBOM is empty and use fallback if needed
      if (compCount(outFile)===0) {
        console.warn(`[sbom] empty for ${ws.name}, using pnpm fallback`);
        spawnSync('pnpm',['exec','tsx','tools/sbom/from-pnpm.ts', ws.name, outFile],{stdio:'inherit'});
      }
      return outFile;
    } catch (error: any) {
      console.error(`Approach ${i + 1} failed for ${ws.name}:`, error.message.split('\n')[0]);
      if (i === approaches.length - 1) {
        // All approaches failed, create an empty SBOM file to avoid breaking the merge
        console.log(`All approaches failed for ${ws.name}, creating empty SBOM...`);
        const emptySbom = {
          "bomFormat": "CycloneDX",
          "specVersion": "1.5",
          "version": 1,
          "components": []
        };
        writeFileSync(outFile, JSON.stringify(emptySbom, null, 2));
        return outFile;
      }
    }
  }
}

mkdirSync('sbom', { recursive: true });
const wss = getWorkspaces();
const files = wss.flatMap(ws => {
  try {
    const result = run(ws);
    return result ? [result] : [];
  } catch (error) {
    console.error(error);
    return [];
  }
});
console.log(JSON.stringify({ files }, null, 2));
