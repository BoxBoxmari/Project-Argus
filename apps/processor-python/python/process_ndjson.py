import argparse, json, sys, csv, pathlib, datetime
from jsonschema import Draft202012Validator
from collections import OrderedDict

def load_schema(p):
    with open(p, 'r', encoding='utf-8') as f:
        return json.load(f)

def iter_ndjson(path):
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            s = line.strip()
            if not s: continue
            yield json.loads(s)

def normalize_row(row):
    # Minimal normalization; extend as needed
    row['text'] = (row.get('text') or '').strip()
    row['author_name'] = (row.get('author_name') or None)
    # enforce ISO date
    def to_iso(s): 
        try:
            return datetime.datetime.fromisoformat(s.replace('Z','+00:00')).isoformat()
        except Exception:
            return datetime.datetime.utcnow().isoformat()
    row['scraped_at'] = to_iso(row.get('scraped_at',''))
    row['posted_at'] = to_iso(row.get('posted_at',''))
    return row

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--schema', required=True)
    ap.add_argument('--out_csv', default='out/reviews.csv')
    ap.add_argument('--out_parquet', default='out/reviews.parquet')
    args = ap.parse_args()

    schema = load_schema(args.schema)
    validator = Draft202012Validator(schema)

    out_dir = pathlib.Path(args.out_csv).parent
    out_dir.mkdir(parents=True, exist_ok=True)

    seen = set()
    errors = 0
    rows = []
    for obj in iter_ndjson(args.input):
        obj = normalize_row(obj)
        key = f"{obj.get('place_id')}:{obj.get('review_id')}"
        if key in seen: 
            continue
        seen.add(key)

        errs = sorted(validator.iter_errors(obj), key=lambda e: e.path)
        if errs:
            errors += 1
            continue
        rows.append(obj)

    # CSV
    fieldnames = ["review_id","place_id","author_name","rating","text","language","posted_at","owner_response","like_count","url","scraped_at","source","extractor_version"]
    with open(args.out_csv, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, '') for k in fieldnames})

    # Parquet (optional)
    try:
        import pandas as pd
        df = pd.DataFrame(rows)
        df.to_parquet(args.out_parquet, compression="snappy")
    except Exception:
        pass

    print(f"Processed: {len(rows)} rows, errors: {errors}")

if __name__ == "__main__":
    main()
