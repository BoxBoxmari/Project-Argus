import argparse
import json
import pathlib
import sys

from . import schema


def iter_ndjson(path: str):
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                obj = json.loads(line)
            except Exception as e:
                sys.stderr.write(f'bad_line {e}\n')
                continue
            ok, _ = schema.validate(obj)
            if ok:
                yield obj


def run(infile: str, outdir: str):
    p = pathlib.Path(outdir)
    p.mkdir(parents=True, exist_ok=True)
    with open(p / 'reviews.parsed.ndjson', 'w', encoding='utf-8') as w:
        for obj in iter_ndjson(infile):
            w.write(json.dumps(obj, ensure_ascii=False) + '\n')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('--output-dir', required=True)
    a = ap.parse_args()
    run(a.input, a.output_dir)
