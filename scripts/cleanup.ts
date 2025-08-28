import { rmSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const rmPatterns = ['dist','coverage','.playwright','.ms-playwright'];
function walk(dir:string){ for(const e of readdirSync(dir)){ const p=join(dir,e); const s=statSync(p); if(s.isDirectory()){ if(rmPatterns.includes(e)) rmSync(p,{recursive:true,force:true}); else walk(p); } } }
['apps','libs'].forEach(d=> existsSync(d)&&walk(d));
mkdirSync('apps/scraper-playwright/datasets',{recursive:true});
