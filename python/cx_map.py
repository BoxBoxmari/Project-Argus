import argparse, json, os, re
import pandas as pd

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
  ap.add_argument("parquet_in")
  ap.add_argument("--out","-o", default="./out/cx")
  args = ap.parse_args()
  os.makedirs(args.out, exist_ok=True)

  df = pd.read_parquet(args.parquet_in)
  df["stages"] = df["text"].fillna("").apply(lambda t: tag_text(t, STAGES))
  df["touchpoints"] = df["text"].fillna("").apply(lambda t: tag_text(t, TOUCHPOINTS))

  outp = os.path.join(args.out,"reviews_cx.parquet")
  df.to_parquet(outp, index=False)
  print({"cx_parquet": outp, "rows": int(df.shape[0])})

if __name__=="__main__":
  main()
