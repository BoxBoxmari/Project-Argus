import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';

type Rule = { from:string, to:string };
const R = JSON.parse(fs.readFileSync('tools/cleanup/rules.json','utf8'));
const DRY = process.env.DRY_RUN === '1';

function ensure(p:string){ fs.mkdirSync(p,{recursive:true}); }
function exists(p:string){ return fs.existsSync(p); }
function mv(src:string, dst:string){
  if (!exists(src)) return;
  ensure(dst);
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src,name); const d = path.join(dst,name);
    if (DRY) { console.log('[DRY] move', s, '->', d); continue; }
    fs.renameSync(s,d);
  }
}
function rmDirSafe(root:string, dir:string){
  const p = path.join(root, dir);
  if (!exists(p)) return;
  if (DRY) { console.log('[DRY] rm -rf', p); return; }
  fs.rmSync(p, { recursive:true, force:true });
}
function rmGlobs(globs:string[]){
  // đơn giản: quét toàn repo và khớp hậu tố/phần tên thường gặp
  const walk=(d:string)=>{
    for (const e of fs.readdirSync(d)) {
      const p = path.join(d,e); const s = fs.statSync(p);
      if (s.isDirectory()) walk(p);
      else {
        for (const g of globs) {
          const star = g.replace(/\*\*/g, ''); // thô sơ cho pattern cơ bản
          if (e.includes(star.replace(/\*/g,''))) {
            if (DRY) console.log('[DRY] rm', p); else fs.rmSync(p, { force:true });
            break;
          }
        }
      }
    }
  };
  walk('.');
}
function rmEmpty(dir:string){
  if (!exists(dir)) return;
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir,e);
    if (fs.statSync(p).isDirectory()) {
      rmEmpty(p);
      if (fs.readdirSync(p).length === 0) {
        if (DRY) console.log('[DRY] rmdir', p); else fs.rmdirSync(p);
      }
    }
  }
}
function gitCleanCheck(){
  try {
    const out = execSync('git status --porcelain').toString().trim();
    return out.length === 0;
  } catch { return false; }
}

const manifest:{ moved:[string,string][], purged:string[], removedEmpty:string[], ts:string } = {
  moved:[], purged:[], removedEmpty:[], ts: new Date().toISOString()
};

// 1) Archive targets
for (const t of R.archiveTargets as any[]) {
  if (exists(t.from)) { mv(t.from, t.to); manifest.moved.push([t.from, t.to]); }
}

// 1.1) Move single files at repo root by pattern
type MapRule={pattern:RegExp,to:string,mode?:'archive'|'relocate'};
const rootMap:MapRule[] = [
  // Báo cáo & tổng kết → docs/reports
  { pattern: /^.*_SUMMARY\.md$/i, to: 'docs/reports', mode:'archive' },
  { pattern: /^.*_REPORT\.md$/i,  to: 'docs/reports', mode:'archive' },
  { pattern: /^(OPS_REPORT|RETENTION_REPORT|FINAL_VERIFICATION_SUMMARY|GA_LAUNCH_SUMMARY)\.md$/i, to:'docs/reports', mode:'archive' },
  // Hợp đồng & chuẩn → docs/contracts
  { pattern: /^DATA_CONTRACT\.md$/i, to:'docs/contracts' },
  // Lịch sử/ghi chú refactor → docs/history
  { pattern: /^REFACTORING_CHANGELOG\.md$/i, to:'docs/history' },
  // Tài liệu release → docs/release
  { pattern: /^(RELEASE_NOTES|RELEASE_PROCESS|RELEASE_COMPLETION_SUMMARY|PATCH_NOTES)\.md$/i, to:'docs/release' },
  // Tồn kho → docs/inventory
  { pattern: /^(INVENTORY\.md|WORKSPACE_INVENTORY\.json)$/i, to:'docs/inventory' },
  // Báo cáo máy sinh ra (giữ dưới archive)
  { pattern: /^(PROVENANCE\.json|problems-report\.json|DEADCODE_REPORT\.json)$/i, to:'archive/reports', mode:'archive' },
  // File tạm/nháp → delete
];

function moveRootByMap() {
  const root = '.';
  for (const name of fs.readdirSync(root)) {
    const p = path.join(root,name);
    if (!fs.statSync(p).isFile()) continue;
    if ((R.keepFiles as string[]).includes(name)) continue;
    let matched = false;
    for (const r of rootMap) {
      if (r.pattern.test(name)) {
        ensure(r.to);
        if (DRY) console.log('[DRY] move', name, '->', r.to); else fs.renameSync(p, path.join(r.to, name));
        manifest.moved.push([name, r.to]);
        matched = true; break;
      }
    }
    if (!matched) {
      // ứng viên rác: debug-output, test-report, test.txt, generate-report.js bản tạm, bản JS build của *.ts
      if (/^(debug-output\.txt|test-report\.md|test\.txt)$/i.test(name) || /^(generate-report\.js)$/i.test(name)) {
        if (DRY) console.log('[DRY] rm', p); else fs.rmSync(p,{force:true});
        manifest.purged.push(p);
      }
      if (name.endsWith('.js') && fs.existsSync(name.replace(/\.js$/,'.ts'))) {
        if (DRY) console.log('[DRY] rm build JS from TS', p); else fs.rmSync(p,{force:true});
        manifest.purged.push(p);
      }
    }
  }
}
moveRootByMap();

// 1.2) Hợp nhất cấu hình trùng (.cspell.json ưu tiên). Nếu tồn tại cspell.json -> attic
if (exists('cspell.json') && exists('.cspell.json')) {
  ensure('attic/config');
  if (DRY) console.log('[DRY] move cspell.json -> attic/config'); else fs.renameSync('cspell.json','attic/config/cspell.json');
  manifest.moved.push(['cspell.json','attic/config/cspell.json']);
}

// 2) Purge dirs under known roots
for (const root of ['apps','libs','tools','tests','py','scripts']) {
  for (const d of R.purgeDirs as string[]) {
    const p = path.join(root, d);
    if (exists(p)) {
      rmDirSafe(root, d);
      manifest.purged.push(p);
    }
  }
}
// 3) Purge globs
rmGlobs(R.purgeGlobs);

// 4) Remove empty folders globally
rmEmpty('.');

// 3.5) Re-home misplaced scripts if present
const reloc = [
  { src: 'clean-build-run.ps1', dst:'scripts/ps/clean-build-run.ps1' },
  { src: 'generate-report.js',  dst:'tools/reports/generate-report.js' },
  { src: 'validate-python-tooling.py', dst:'py/tooling/validate-python-tooling.py' },
  { src: 'python-dev-requirements.txt', dst:'py/tooling/python-dev-requirements.txt' },
  { src: 'pyproject.toml', dst:'py/pyproject.toml' },
  { src: 'jest.config.ts', dst:'tests/config/jest.config.ts' }
];
for (const {src,dst} of reloc) {
  if (exists(src)) { ensure(path.dirname(dst)); if (DRY) console.log('[DRY] move',src,'->',dst); else fs.renameSync(src,dst); manifest.moved.push([src,dst]); }
}

// 5) Write manifest + TREE
fs.mkdirSync('archive', { recursive:true });
fs.writeFileSync('CLEANUP_MANIFEST.json', JSON.stringify(manifest,null,2));

// TREE.md mới
function tree(dir:string, prefix=''){
  const entries = fs.readdirSync(dir).filter(n=>!['.git','.github'].includes(n)).sort();
  let lines:string[] = [];
  for (let i=0;i<entries.length;i++){
    const e = entries[i]; const p = path.join(dir,e); const isLast = i===entries.length-1;
    const mark = isLast ? '└─' : '├─';
    lines.push(prefix+mark+e);
    if (fs.statSync(p).isDirectory()) {
      const np = prefix + (isLast ? '  ' : '│ ');
      lines = lines.concat(tree(p, np));
    }
  }
  return lines;
}
fs.writeFileSync('TREE.md', ['# Project Tree (post-cleanup)', '```', ...tree('.'), '```', ''].join('\n'));

console.log('cleanup done. DRY_RUN=', DRY ? '1' : '0', '| git clean =', gitCleanCheck());
