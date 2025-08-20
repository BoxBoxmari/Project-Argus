# Project Argus - Link Extractor (utility)
# Path: processor-python/link_extractor.py

import re

PLACE_RE = re.compile(r"https?://www\.google\.com/maps/place/\?q=place_id:[\w-]+", re.I)

def extract_place_urls(text: str) -> list[str]:
    """
    Extract likely Google Maps Place URLs (place_id form) from any text blob.
    """
    return list(dict.fromkeys(PLACE_RE.findall(text or "")))

if __name__ == "__main__":
    import sys
    data = sys.stdin.read()
    for u in extract_place_urls(data):
        print(u)
