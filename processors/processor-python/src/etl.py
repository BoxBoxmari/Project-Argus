import json
import os
import sys
from .schema import ReviewV1

def load_ndjson(fp):
    for line in fp:
        if line.strip():
            yield json.loads(line)

def normalize(rec, place_id):
    rec["place_id"] = place_id
    if "ts" in rec and isinstance(rec["ts"], str):
        # best-effort ISO parse, leave None if invalid
        try:
            from dateutil.parser import isoparse
            rec["ts"] = isoparse(rec["ts"]).astimezone(None)
        except Exception:
            rec["ts"] = None
    return ReviewV1(**rec).model_dump()

def dedup(records):
    seen = set()
    for r in records:
        key = (r["place_id"], r["review_id"])
        if key in seen: continue
        seen.add(key)
        yield r

def qc(records):
    for r in records:
        if r.get("rating") is not None and not (0 <= r["rating"] <= 5):
            continue
        yield r

def run(in_paths, out_path):
    out = open(out_path, "w", encoding="utf-8")
    try:
        allrecs = []
        for p in in_paths:
            place_id = os.path.splitext(os.path.basename(p))[0]
            with open(p, "r", encoding="utf-8") as f:
                for x in load_ndjson(f):
                    allrecs.append(normalize(x, place_id))
        for r in qc(dedup(allrecs)):
            out.write(json.dumps(r, ensure_ascii=False) + "\n")
    finally:
        out.close()

if __name__ == "__main__":
    run(sys.argv[1:-1], sys.argv[-1])
