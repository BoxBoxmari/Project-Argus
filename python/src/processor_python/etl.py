"""
ETL (Extract, Transform, Load) utilities for processor_python
"""

from typing import TextIO, Mapping
from collections.abc import Generator as AbcGenerator, Iterable as AbcIterable
from pathlib import Path
from datetime import datetime
import json
import pandas as pd


def load_ndjson(fp: TextIO) -> AbcGenerator[dict[str, str | int | float | None], None, None]:
    """Load NDJSON data from file pointer, skipping empty lines"""
    for line in fp:
        line = line.strip()
        if line:  # Skip empty lines
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue  # Skip malformed lines


def normalize(raw_record: Mapping[str, str | int | float | None], place_id: str) -> dict[str, str | int | float | datetime | None]:
    """Normalize raw record with proper place_id assignment"""
    normalized: dict[str, str | int | float | datetime | None] = {}
    for key, value in raw_record.items():
        normalized[key] = value
    normalized["place_id"] = place_id

    # Convert timestamp strings to datetime objects
    if "ts" in normalized and isinstance(normalized["ts"], str):
        try:
            normalized["ts"] = datetime.fromisoformat(normalized["ts"].replace('Z', '+00:00'))
        except ValueError:
            normalized["ts"] = None

    return normalized


def dedup(records: AbcIterable[Mapping[str, str | int | float | None | datetime]]) -> AbcGenerator[dict[str, str | int | float | None | datetime], None, None]:
    """Remove duplicate records based on place_id + review_id combination"""
    seen: set[tuple[str, str]] = set()
    for record in records:
        place_id = str(record.get("place_id", ""))
        review_id = str(record.get("review_id", ""))
        key = (place_id, review_id)
        if key not in seen:
            seen.add(key)
            yield record


def qc(records: AbcIterable[Mapping[str, str | int | float | None | datetime]]) -> AbcGenerator[dict[str, str | int | float | None | datetime], None, None]:
    """Quality control filtering - remove records with invalid ratings"""
    for record in records:
        rating = record.get("rating")
        # Allow None rating or valid ratings between 1-5
        if rating is None or (isinstance(rating, (int, float)) and 1 <= rating <= 5):
            yield record


def run(in_paths: list[str | Path], out_path: str | Path) -> None:
    """Run complete ETL pipeline"""
    all_records = []

    for path in in_paths:
        with open(path, 'r', encoding='utf-8') as f:
            all_records.extend(load_ndjson(f))

    # Process through pipeline
    processed = list(qc(dedup(all_records)))

    # Write output
    with open(out_path, 'w', encoding='utf-8') as f:
        for record in processed:
            _ = f.write(json.dumps(record) + '\n')


def process_reviews(reviews: list[Mapping[str, str | int | float | None | datetime]]) -> pd.DataFrame:
    """Process a list of reviews into a DataFrame"""
    if not reviews:
        return pd.DataFrame()

    df = pd.DataFrame(reviews)
    return df


def transform_review_data(data: Mapping[str, str | int | float | None | datetime]) -> dict[str, str | int | float | None | datetime]:
    """Transform review data"""
    transformed = data.copy()

    # Add any transformations here
    if "rating" in transformed and transformed["rating"] is not None:
        rating_val = transformed["rating"]
        if isinstance(rating_val, (int, float)):
            transformed["rating"] = int(rating_val)

    return transformed


__all__ = ["load_ndjson", "normalize", "dedup", "qc", "run", "process_reviews", "transform_review_data"]
