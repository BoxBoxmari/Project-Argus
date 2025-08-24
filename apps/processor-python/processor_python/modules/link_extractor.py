from __future__ import annotations
import re
from typing import List

# Matches href values
_HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)
# Matches Google Maps place_id URLs
_GMAPS_PLACE_RE = re.compile(r'https?://www\.google\.com/maps/place/\?q=place_id:[A-Za-z0-9]+', re.I)

def _dedupe_preserve_order_case_insensitive(items: List[str]) -> List[str]:
    seen_lower: set[str] = set()
    result: List[str] = []
    for s in items:
        key = s.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)
        result.append(s)
    return result

def extract_links(html_or_text: str) -> List[str]:
    """
    Extract href links from HTML/text. Lenient by design for tests.
    """
    if not html_or_text:
        return []
    return _dedupe_preserve_order_case_insensitive(_HREF_RE.findall(html_or_text))

def extract_place_urls(text: str) -> List[str]:
    """
    Extract Google Maps place URLs of the form:
    https://www.google.com/maps/place/?q=place_id:XXXXX
    - Deduplicate case-insensitively while preserving first-seen casing
    - Preserve original order otherwise
    """
    if not text:
        return []
    matches = [m.group(0) for m in _GMAPS_PLACE_RE.finditer(text)]
    return _dedupe_preserve_order_case_insensitive(matches)

__all__ = ["extract_links", "extract_place_urls"]
