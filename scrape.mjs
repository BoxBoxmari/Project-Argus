import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import Bottleneck from 'bottleneck';
import pLimit from 'p-limit';
import dayjs from 'dayjs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = process.env.ARGUS_OUTPUT_DIR || path.join(__dirname,'out');
const LOG_DIR = process.env.ARGUS_LOG_DIR || path.join(OUT_DIR,'logs');
await fse.ensureDir(OUT_DIR); await fse.ensureDir(LOG_DIR);

const RUN_ID = 'node-' + new Date().toISOString();
const ajv = new Ajv({allErrors:true});
addFormats(ajv);
const reviewSchema = JSON.parse(fs.readFileSync(path.join(__dirname,'configs/schema/review.schema.json'),'utf8'));
const validateReview = ajv.compile(reviewSchema);

// Simple proxy loader
function loadProxies(file){
  try { return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean); }
  catch { return []; }
}
const PROXIES = loadProxies(process.env.PROXY_LIST || path.join(__dirname,'configs/proxies/pool.txt'));
let proxyIdx = 0; const nextProxy = () => PROXIES.length ? PROXIES[(proxyIdx++)%PROXIES.length] : null;

// Limiter & concurrency
const limiter = new Bottleneck({ minTime: Math.ceil(1000/(process.env.ARGUS_RATE_LIMIT_PER_SEC||1)) });
const limit = pLimit(Number(process.env.ARGUS_CONCURRENCY||4));

// TODO: replace with Playwright/Puppeteer fetchers
async function fetchReviewsForPlace(place){
  // placeholder: implement navigator via Playwright with nextProxy()
  return []; // Array of review objects
}

function toRecord(raw){
  const rec = {
    run_id: RUN_ID,
    place_id: raw.place_id,
    review_id: raw.review_id,
    user_id: raw.user_id ?? null,
    rating: raw.rating,
    text: raw.text ?? '',
    lang: raw.lang ?? 'und',
    likes: raw.likes ?? null,
    published_at: raw.published_at,
    fetched_at: new Date().toISOString(),
    source: 'node',
    meta: raw.meta || {}
  };
  if(!validateReview(rec)){
    const err = validateReview.errors?.map(e=>`${e.instancePath} ${e.message}`).join('; ');
    throw new Error('SchemaError: '+err);
  }
  return rec;
}

async function main(){
  const inputFile = process.argv[2] || path.join(__dirname,'data/places.ndjson');
  const outFile = path.join(OUT_DIR, `raw_${dayjs().format('YYYYMMDD_HHmmss')}.ndjson`);
  const logFile = path.join(LOG_DIR, `run_${dayjs().format('YYYYMMDD_HHmmss')}.ndjson`);

  const places = fs.readFileSync(inputFile,'utf8').trim().split(/\r?\n/).map(JSON.parse);
  const out = fs.createWriteStream(outFile, {flags:'a'});
  const log = fs.createWriteStream(logFile, {flags:'a'});

  const writeLog = (o)=>log.write(JSON.stringify(o)+'\n');

  let processed = 0;
  await Promise.all(places.map(pl => limit(() => limiter.schedule(async ()=>{
    const proxy = nextProxy();
    for (let attempt=1; attempt<= (Number(process.env.ARGUS_RETRY_MAX)||5); attempt++){
      try{
        const raws = await fetchReviewsForPlace({...pl, proxy});
        for(const r of raws){
          const rec = toRecord(r);
          out.write(JSON.stringify(rec)+'\n');
        }
        processed++;
        writeLog({ts:new Date().toISOString(), run_id: RUN_ID, type:'place_done', place_id: pl.place_id, count: raws.length});
        return;
      }catch(err){
        writeLog({ts:new Date().toISOString(), run_id: RUN_ID, type:'error', place_id: pl.place_id, attempt, msg: String(err)});
        await new Promise(rs => setTimeout(rs, Math.min(30000, 500 * attempt + Math.random()*500)));
      }
    }
  }))));

  out.end(); log.end();
  console.log('DONE', {processed, outFile, logFile});
}
main().catch(e=>{ console.error(e); process.exit(1); });
