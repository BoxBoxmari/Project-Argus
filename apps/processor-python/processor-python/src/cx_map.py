import argparse, json, os, re
import pandas as pd
import sys
from pathlib import Path

# Add the src directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

from etl import load_ndjson

STAGES = [
  ("awareness", r"ad|advert|search|google|map|location"),
  ("onsite", r"queue|line|wait|parking|staff|service|cashier|check[- ]?in|room|table|clean|dirty|noise|crowd"),
  ("purchase", r"price|pay|bill|checkout|promotion|discount"),
  ("post_purchase", r"refund|return|warranty|support|complaint|response"),
  ("loyalty", r"member|loyal|points|subscribe|recommend|come back")
]

TOUCHPOINTS = [
  ("staff", r"staff|employee|attitude|rude|friendly|help"),
  ("quality", r"quality|taste|fresh|stale|broken|faulty"),
  ("speed", r"slow|fast|quick|delay|wait"),
  ("ambience", r"clean|dirty|smell|noise|music|decor"),
  ("parking", r"park|parking|car|bike"),
  ("digital", r"app|online|wifi|website|booking|qr")
]

def tag_text(txt, rules):
  tags=set()
  low=txt.lower()
  for name,pat in rules:
    if re.search(pat, low): tags.add(name)
  return list(tags)

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("ndjson_in", help="Input NDJSON file")
  ap.add_argument("--out","-o", default="./out/cx", help="Output directory")
  args = ap.parse_args()
  os.makedirs(args.out, exist_ok=True)

  # Load NDJSON data
  records = []
  with open(args.ndjson_in, 'r', encoding='utf-8') as f:
    for record in load_ndjson(f):
      records.append(record)
  
  # Convert to DataFrame
  df = pd.DataFrame(records)
  
  # Handle empty meta objects that can't be written to Parquet
  if 'meta' in df.columns:
    df['meta'] = df['meta'].fillna({}).apply(lambda x: x if x else {'dummy': None})
  
  # Apply CX mapping
  df["stages"] = df["text"].fillna("").apply(lambda t: tag_text(t, STAGES))
  df["touchpoints"] = df["text"].fillna("").apply(lambda t: tag_text(t, TOUCHPOINTS))

  # Save as parquet
  outp = os.path.join(args.out,"reviews_cx.parquet")
  df.to_parquet(outp, index=False)
  print(json.dumps({"cx_parquet": outp, "rows": int(df.shape[0])}))

if __name__=="__main__":
  main()
