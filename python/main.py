# Project Argus - Python Orchestrator (fully rebuilt)
# Path: processor-python/main.py
# Python 3.10+

import argparse
import json
import os
import random
import re
import subprocess
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

RUN_ID = os.environ.get("ARGUS_RUN_ID") or datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

PLACEHOLDER_MARKERS = ("REPLACE_ME", "YOUR_PLACE_ID_HERE")

def _is_bad_url(u: str) -> bool:
    if not u: return True
    s = u.strip()
    if any(m in s for m in PLACEHOLDER_MARKERS): return True
    return not s.startswith("http")

LOG_DIR = Path.cwd() / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / f"processor-{RUN_ID}.log"

def jlog(level: str, msg: str, **kwargs):
    rec = {"ts": datetime.now(timezone.utc).isoformat(), "level": level, "run_id": RUN_ID,
           "module": "processor-python", "msg": msg}
    rec.update(kwargs or {})
    line = json.dumps(rec, ensure_ascii=False)
    try:
        with LOG_FILE.open("a", encoding="utf-8") as fp:
            fp.write(line + "\n")
    except Exception:
        pass
    print(line)

def read_lines(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8") as fp:
        return [ln.strip() for ln in fp if ln.strip() and not ln.strip().startswith("#")]

def sanitize_name(url: str) -> str:
    # Use place_id if present; otherwise slug the url
    m = re.search(r"place_id:([^&]+)", url)
    if m:
        return m.group(1)[:64]
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", url).strip("-")
    return slug[:64] or "output"

def run_worker(node_script: Path, url: str, out_dir: Path) -> tuple[bool, Path, dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{sanitize_name(url)}.json"

    cmd = ["node", str(node_script), url, str(out_path)]
    jlog("INFO", "spawn_worker", url=url, out=str(out_path))
    try:
        # stream logs in real-time to console
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, universal_newlines=True)
        for line in proc.stdout:
            line = line.rstrip("\n")
            print(line)  # let user see worker logs
            try:
                obj = json.loads(line)
                if isinstance(obj, dict) and obj.get("msg") == "payload_written":
                    pass
            except Exception:
                pass
        proc.wait()
        code = proc.returncode
    except FileNotFoundError:
        jlog("CRITICAL", "node_not_found", suggestion="Install Node.js 18+ and ensure 'node' is in PATH")
        return False, out_path, {}
    except Exception as e:
        jlog("ERROR", "worker_spawn_error", error=str(e))
        return False, out_path, {}

    if not out_path.exists():
        jlog("ERROR", "worker_no_output", out=str(out_path), code=code)
        return False, out_path, {}

    try:
        payload = json.loads(out_path.read_text(encoding="utf-8"))
    except Exception as e:
        jlog("ERROR", "payload_parse_error", out=str(out_path), error=str(e))
        return False, out_path, {}

    ok = payload.get("status") == "SUCCESS"
    rows = len(payload.get("review_data", []) or [])
    jlog("INFO", "worker_done", ok=ok, rows=rows, out=str(out_path))
    return ok, out_path, payload

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Argus Orchestrator")
    # Back-compat: --url (single) and newer --url-file for batch
    p.add_argument("--url", help="Single Google Maps URL (kept for backwards compatibility)")
    p.add_argument("--url-file", help="Path to a text file containing URLs (one per line)")
    p.add_argument("--max-workers", type=int, default=1, help="(Reserved) Parallel workers; currently runs sequentially")
    p.add_argument("--node-script", default=str(Path(__file__).resolve().parents[1] / "node" / "puppeteer_engine" / "scraper.js"),
                   help="Path to scraper.js node worker (env ARGUS_NODE_SCRIPT overrides)")
    p.add_argument("--outdir", default=str(Path.cwd() / "outputs"), help="Output directory")
    return p.parse_args(argv)

def main(argv=None):
    args = parse_args(argv)

    # --- Determine URL list
    urls: list[str] = []
    if args.url:
        urls.append(args.url.strip())
    if args.url_file:
        try:
            urls.extend(read_lines(Path(args.url_file)))
        except FileNotFoundError:
            jlog("CRITICAL", "url_file_missing", path=args.url_file)
            sys.exit(2)

    # chuẩn hóa & lọc
    urls = [u.strip() for u in urls if u and u.strip()]
    # bỏ trùng
    seen = set(); urls = [u for u in urls if not (u in seen or seen.add(u))]
    # chặn placeholder
    bads = [u for u in urls if _is_bad_url(u)]
    if bads:
        jlog("CRITICAL", "bad_input_urls", count=len(bads), examples=bads[:3])
        print("Remove placeholder URLs (e.g. place_id:REPLACE_ME) and rerun.")
        sys.exit(2)

    if not urls:
        print("usage: main.py --url <URL>  OR  --url-file <file.txt>")
        sys.exit(2)

    node_script = Path(args.node_script)
    if not node_script.exists():
        jlog("CRITICAL", "node_script_missing", path=str(node_script))
        sys.exit(2)

    out_dir = Path(args.outdir)
    jlog("INFO", "orchestrator_start", url_count=len(urls), outdir=str(out_dir), node=str(node_script))

    succ = 0; fail = 0; total_reviews = 0
    for i, url in enumerate(urls, 1):
        jlog("INFO", "progress", current=i, total=len(urls), succ=succ, fail=fail)
        ok, out_path, payload = run_worker(node_script, url, out_dir)
        if ok:
            succ += 1
        else:
            fail += 1

        rows = len((payload or {}).get("review_data") or [])
        total_reviews += rows
        if ok and rows == 0:
            jlog("WARN", "success_but_zero_reviews", url=url)

        # friendly pacing to be gentle
        delay = random.uniform(2.0, 4.0)
        jlog("INFO", "sleep_between", seconds=round(delay,2))
        time.sleep(delay)

    jlog("INFO", "summary", success=succ, fail=fail, total_reviews=total_reviews)
    if succ == 0 and total_reviews == 0:
        jlog("WARN", "no_reviews_collected_exit")

if __name__ == "__main__":
    main()
