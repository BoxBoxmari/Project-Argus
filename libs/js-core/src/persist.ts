import * as fs from "node:fs"; import * as path from "node:path";
export class Persist {
  constructor(private dir="datasets"){ fs.mkdirSync(dir,{recursive:true}); }
  append(name:string, line:any){ fs.appendFileSync(path.join(this.dir,`${name}.ndjson`), JSON.stringify(line)+"\n"); }
  writeJson(name:string, obj:any){ fs.writeFileSync(path.join(this.dir,`${name}.json`), JSON.stringify(obj,null,2)); }
}
