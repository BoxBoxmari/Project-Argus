from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent.parent / "src"))

from modules.link_extractor import extract_place_urls


def test_extracts_place_urls():
    text = (
        "Visit https://www.google.com/maps/place/?q=place_id:AAA and "
        "also https://www.google.com/maps/place/?q=place_id:BBB for info."
    )
    expected = [
        "https://www.google.com/maps/place/?q=place_id:AAA",
        "https://www.google.com/maps/place/?q=place_id:BBB",
    ]
    assert extract_place_urls(text) == expected


def test_deduplicates_and_case_insensitive():
    text = (
        "https://www.google.com/maps/place/?q=place_id:AAA "
        "https://www.google.com/maps/place/?q=place_id:AAA "
        "HTTPS://WWW.GOOGLE.COM/MAPS/PLACE/?Q=PLACE_ID:BBB"
    )
    expected = [
        "https://www.google.com/maps/place/?q=place_id:AAA",
        "HTTPS://WWW.GOOGLE.COM/MAPS/PLACE/?Q=PLACE_ID:BBB",
    ]
    assert extract_place_urls(text) == expected


def test_ignores_unrelated_urls():
    text = (
        "Check https://www.example.com and "
        "https://www.google.com/maps/about for other stuff."
    )
    assert extract_place_urls(text) == []
