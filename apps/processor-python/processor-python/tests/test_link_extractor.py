import sys
from pathlib import Path

# Add the parent directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from processor_python.modules import link_extractor
from processor_python.modules.link_extractor import extract_place_urls


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

if __name__ == "__main__":
    test_extracts_place_urls()
    test_deduplicates_and_case_insensitive()
    test_ignores_unrelated_urls()
    print("All tests passed!")
