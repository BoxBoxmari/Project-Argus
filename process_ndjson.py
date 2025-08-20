import json, os
from collections import OrderedDict

IN_DIR  = os.environ.get("OUT_DIR", "out")
FILES   = [
  f for f in os.listdir(IN_DIR)
  if f.endswith(".ndjson") and not (f.startswith("merged_") or f.endswith("_clean.ndjson"))
]
assert FILES, "No NDJSON found in out/"

def shash(s):
    h = 5381
    for ch in s:
        h = ((h << 5) + h) ^ ord(ch)
    return format(h & 0xFFFFFFFF, "x")

def load_ndjson(path):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s: continue
            yield json.loads(s)

def normalize(rec):
    # drop fully empty records
    text = (rec.get("text") or "").strip()
    rating = rec.get("rating")
    rid = rec.get("review_id")
    ts  = rec.get("ts")
    user = rec.get("user")
    if not rid and not text and not ts and (rating is None or rating == ""):
        return None
    r = OrderedDict()
    r["review_id"] = rid
    r["rating"]    = rating
    r["text"]      = text
    r["ts"]        = ts
    r["user"]      = user
    return r

def key_of_default(r):
    rid = r.get("review_id")
    if rid: return rid
    # If 'id' is missing entirely (no user/time/text), return None to skip
    user = r.get('user','')
    ts = r.get('ts','')
    txt = r.get('text','')
    rating = r.get('rating','')
    # If there is truly nothing to construct a key from, skip
    if not (user or ts or txt or rating):
        return None
    return f"{user}|{ts}|{shash(txt)}|{rating}"

def process_ndjson(records, key_of=None):
    """Deduplicate with optional custom key extractor and skip records with no key."""
    make_key = key_of or key_of_default
    seen = set()
    for r in records:
        if r is None: continue
        k = make_key(r)
        if not k:  # skip when key cannot be derived
            continue
        if k in seen: continue
        seen.add(k)
        yield r

def qc(records):
    ok, bad = 0, 0
    for r in records:
        rating = r.get("rating")
        if rating is None:
            ok += 1; yield r; continue
        try:
            val = float(rating)
            if 0 <= val <= 5: ok += 1; yield r
            else: bad += 1
        except Exception:
            bad += 1
    print(json.dumps({"qc_pass": ok, "qc_drop": bad}))
    return

def main():
    merged = []
    for fn in FILES:
        path = os.path.join(IN_DIR, fn)
        for x in load_ndjson(path):
            merged.append(normalize(x))
    # Use process_ndjson with default key function; can be overridden if needed
    unique = list(process_ndjson(merged, key_of=None))
    good = list(qc(unique))
    out = os.path.join(IN_DIR, "merged_clean.ndjson")
    with open(out, "w", encoding="utf-8") as f:
        for r in good:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(json.dumps({"input_files": FILES, "raw": len([x for x in merged if x is not None]) , "unique": len(unique), "clean": len(good), "out": out}))

if __name__ == "__main__":
    main()
