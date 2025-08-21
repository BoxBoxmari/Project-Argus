import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({allErrors:true});
addFormats(ajv);
const schema = JSON.parse(fs.readFileSync('configs/schema/review.schema.json','utf8'));
const validate = ajv.compile(schema);

const dir = 'out';
const files = fs.readdirSync(dir).filter(f=>f.endsWith('.ndjson')).map(f=>path.join(dir,f));

let ok=0, bad=0, errors={};
for(const f of files){
  const lines = fs.readFileSync(f,'utf8').trim().split(/\r?\n/);
  for(const ln of lines){
    try{
      const o = JSON.parse(ln);
      if(validate(o)) ok++; else{
        bad++;
        for(const e of validate.errors||[]){
          const k = e.instancePath + ' ' + e.message;
          errors[k] = (errors[k]||0)+1;
        }
      }
    }catch{ bad++; errors['json:parse']= (errors['json:parse']||0)+1; }
  }
}
console.log(JSON.stringify({ok,bad,top_errors:Object.entries(errors).sort((a,b)=>b[1]-a[1]).slice(0,10)},null,2));
