import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';

type Rule = { from:string, to:string };
const R = JSON.parse(fs.readFileSync('tools/cleanup/rules.json','utf8'));
// Check for both DRY_RUN and DRYRUN environment variables
const DRY = process.env.DRY_RUN === '1' || process.env.DRYRUN === '1' || process.argv.includes('--dry');

function ensure(p:string){ fs.mkdirSync(p,{recursive:true}); }
function exists(p:string){ return fs.existsSync(p); }
function mv(src:string, dst:string){
  if (!exists(src)) return;
  ensure(dst);
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src,name); const d = path.join(dst,name);
    if (DRY) { console.log('[DRY] move', s, '->', d); continue; }
    console.log('Moving', s, '->', d);
    fs.renameSync(s,d);
  }
}
function rmDirSafe(root:string, dir:string){
  const p = path.join(root, dir);
  if (!exists(p)) return;
  if (DRY) { console.log('[DRY] rm -rf', p); return; }
  console.log('Removing directory', p);
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
            if (DRY) console.log('[DRY] rm', p); else { console.log('Removing file', p); fs.rmSync(p, { force:true }); }
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
        if (DRY) console.log('[DRY] rmdir', p); else { console.log('Removing empty directory', p); fs.rmdirSync(p); }
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

try {
  // 1) Archive targets
  console.log('Archiving targets...');
  for (const t of R.archiveTargets as Rule[]) {
    if (exists(t.from)) {
      console.log('Archiving', t.from, 'to', t.to);
      mv(t.from, t.to);
      manifest.moved.push([t.from, t.to]);
    }
  }
  // 2) Purge dirs under known roots
  console.log('Purging directories...');
  for (const root of ['apps','libs','tools','tests','py','scripts']) {
    for (const d of R.purgeDirs as string[]) {
      const p = path.join(root, d);
      if (exists(p)) {
        console.log('Purging', p);
        rmDirSafe(root, d);
        manifest.purged.push(p);
      }
    }
  }
  // 3) Purge globs
  console.log('Removing files matching globs...');
  rmGlobs(R.purgeGlobs);

  // 4) Remove empty folders globally
  console.log('Removing empty directories...');
  rmEmpty('.');

  // 5) Write manifest + TREE
  console.log('Writing manifest and tree...');
  fs.mkdirSync('archive', { recursive:true });
  fs.writeFileSync('CLEANUP_MANIFEST.json', JSON.stringify(manifest,null,2));

  // TREE.md mới
  function tree(dir:string, prefix=''){
    const entries = fs.readdirSync(dir).filter(n=>!['.git','.github','.venv','node_modules'].includes(n)).sort();
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
} catch (error) {
  console.error('Error during cleanup:', error);
  process.exit(1);
}
