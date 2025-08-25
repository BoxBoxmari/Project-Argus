$ErrorActionPreference='Stop'
$in = "datasets/reviews.ndjson"
$out = "datasets"
if (Get-Command uv -ErrorAction SilentlyContinue) {
  uv run python py/ingest/src/processor.py $in --output-dir $out
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  py -3 py/ingest/src/processor.py $in --output-dir $out
} else {
  python py/ingest/src/processor.py $in --output-dir $out
}
