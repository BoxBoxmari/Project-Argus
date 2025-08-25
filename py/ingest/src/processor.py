import sys, json, argparse, pathlib, datetime as dt
def valid(item:dict)->bool:
    return isinstance(item.get('url'), str) and isinstance(item.get('reviews'), list)

def run(infile:str, outdir:str):
    p = pathlib.Path(outdir); p.mkdir(parents=True, exist_ok=True)
    with open(infile, 'r', encoding='utf-8') as f, open(p/'reviews.parsed.ndjson','w',encoding='utf-8') as w:
        for line in f:
            try:
                obj = json.loads(line)
                if valid(obj): w.write(json.dumps(obj, ensure_ascii=False)+'\n')
            except Exception as e:
                sys.stderr.write(f'bad_line {e}\n')

if __name__=='__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('input'); ap.add_argument('--output-dir',required=True)
    a = ap.parse_args(); run(a.input, a.output_dir)
