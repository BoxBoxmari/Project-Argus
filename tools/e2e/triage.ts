import fs from 'node:fs'; import path from 'node:path';

type Entry = { title:string; status:'passed'|'failed'|'skipped'|'timedOut'|'interrupted' };
const HISTORY = 'apps/e2e/reports/history.json';
const RESULTS = 'apps/e2e/reports/results.json';

function loadJSON(f:string){
  if (!fs.existsSync(f)) return null;
  try {
    const content = fs.readFileSync(f, 'utf8');
    return content ? JSON.parse(content) : null;
  } catch (e) {
    console.error(`Error parsing JSON file ${f}:`, e);
    return null;
  }
}

function saveJSON(f:string, data:any){
  fs.mkdirSync(path.dirname(f), {recursive:true});
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}

function flatten(results:any): Entry[] {
  const out:Entry[] = [];
  // Navigate through the structure to find test specs
  if (results?.suites) {
    for (const suite of results.suites) {
      if (suite.suites) {
        for (const subSuite of suite.suites) {
          if (subSuite.specs) {
            for (const spec of subSuite.specs) {
              // Check if the spec has tests with results
              if (spec.tests && spec.tests.length > 0) {
                // Get the overall status from the first test's first result
                const firstTest = spec.tests[0];
                if (firstTest.results && firstTest.results.length > 0) {
                  const firstResult = firstTest.results[0];
                  out.push({
                    title: spec.title,
                    status: firstResult.status === 'passed' ? 'passed' : 'failed'
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  return out;
}

function idFromTitle(title:string){
  const m = title.match(/^(SIM|REAL)#(\d+)/);
  return m ? `${m[1]}#${m[2]}` : title;
}

const hist = loadJSON(HISTORY) ?? {};
const res = loadJSON(RESULTS);
if (!res) {
  console.error('No results found');
  process.exit(0);
}

const entries = flatten(res);
console.log(`Found ${entries.length} test entries`);

for (const e of entries) {
  const id = idFromTitle(e.title);
  if (!hist[id]) hist[id] = [];
  hist[id].push(e.status);
  if (hist[id].length > 10) hist[id] = hist[id].slice(-10);
  console.log(`Updated history for ${id}: ${hist[id].length} entries`);
}

saveJSON(HISTORY, hist);

// Quyết định thăng/giáng
type Decision = { id:string; action:'promote'|'demote'|null };
const decisions:Decision[] = [];

for (const [id, arr] of Object.entries<any>(hist)) {
  const last3 = arr.slice(-3);
  const passCount = arr.filter((s:string) => s === 'passed').length;
  const passRate = arr.length > 0 ? passCount / arr.length : 0;

  console.log(`Test ${id}: ${passCount}/${arr.length} passed (${(passRate * 100).toFixed(1)}%)`);

  if (arr.length >= 10 && passRate >= 0.98) {
    decisions.push({ id, action: 'promote' });
    console.log(`  -> Promote (≥98% pass rate in last 10 runs)`);
  } else if (last3.length === 3 && last3.filter((x:string) => x !== 'passed').length >= 2) {
    decisions.push({ id, action: 'demote' });
    console.log(`  -> Demote (≥2 fails in last 3 runs)`);
  } else {
    decisions.push({ id, action: null });
    console.log(`  -> No change`);
  }
}

// Áp dụng vào tiêu đề test
function patchFile(file:string, decs:Decision[]){
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return false;
  }

  let src = fs.readFileSync(file, 'utf8');
  let changed = false;

  for (const d of decs) {
    if (!d.action) continue;

    // More precise regex to match test titles with tags
    const re = new RegExp(`(test\\(\\\`(${d.id})[^\\\`]*?)\\s\\[(stable|quarantine)\\]`, 'g');
    src = src.replace(re, (_m, head, _id, curTag) => {
      const next = d.action === 'promote' ? 'stable' : 'quarantine';
      if (curTag === next) return _m;
      changed = true;
      console.log(`Updating ${d.id} from [${curTag}] to [${next}]`);
      return `${head} [${next}]`;
    });
  }

  if (changed) {
    fs.writeFileSync(file, src);
    console.log(`Updated file: ${file}`);
  }
  return changed;
}

const files = [
  'apps/e2e/tests/sim.matrix.spec.ts',
  'apps/e2e/tests/real.matrix.spec.ts'
].filter(fs.existsSync);

console.log(`Processing ${files.length} test files`);

let any = false;
for (const f of files) {
  any = patchFile(f, decisions) || any;
}

if (any) {
  console.log('Triage applied, tags updated');
  process.exit(2); // exit 2 => có thay đổi
}

console.log('Triage noop');
