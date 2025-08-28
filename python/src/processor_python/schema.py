"""
Schema definitions for review data using strict typing and factory pattern
"""

from __future__ import annotations
from typing import TypedDict
from collections.abc import Mapping
from datetime import datetime, timezone
from dataclasses import dataclass
from pydantic import BaseModel, Field


class RawReview(TypedDict, total=False):
    """TypedDict for raw review data from userscript"""
    place_id: str | int | None
    review_id: str | int | None
    schema_version: str | None
    rating: int | str | None
    text: str | None
    user: str | None
    ts: int | float | str | datetime | None  # epoch seconds | isoformat str | datetime | None


def _coerce_str(x: str | int | datetime | None, field: str, allow_none: bool = False) -> str | None:
    """Coerce value to string with proper error handling"""
    if x is None:
        return None if allow_none else ""
    if isinstance(x, str):
        return x
    if isinstance(x, int):
        return str(x)
    # reject datetime mistakenly sent to str fields
    if isinstance(x, datetime):
        raise TypeError(f"{field} expects str, got datetime")
    return str(x)


def _coerce_int(x: int | str | None) -> int | None:
    """Coerce value to int with proper error handling"""
    if x is None or x == "":
        return None
    if isinstance(x, int):
        return x
    if isinstance(x, str):
        xs = x.strip()
        if xs == "":
            return None
        if xs.isdigit() or (xs.startswith("-") and xs[1:].isdigit()):
            return int(xs)
        raise TypeError(f"rating expects int|None, got {type(x).__name__}")
    raise TypeError(f"rating expects int|None, got {type(x).__name__}")


def _coerce_ts(x: int | float | str | datetime | None) -> datetime | None:
    """Coerce value to datetime with proper error handling"""
    if x is None or x == "":
        return None
    if isinstance(x, datetime):
        return x.astimezone(timezone.utc)
    if isinstance(x, (int, float)):
        return datetime.fromtimestamp(float(x), tz=timezone.utc)
    if isinstance(x, str):
        return datetime.fromisoformat(x.replace("Z", "+00:00")).astimezone(timezone.utc)
    raise TypeError(f"ts expects datetime|epoch|iso-str|None, got {type(x).__name__}")


@dataclass(frozen=True)
class Review:
    """Immutable Review data structure with strict typing"""
    _place_id: str
    _review_id: str
    _schema_version: str
    _rating: int | None
    _text: str | None
    _user: str | None
    _ts: datetime | None

    @property
    def place_id(self) -> str:
        return self._place_id

    @property
    def review_id(self) -> str:
        return self._review_id

    @property
    def schema_version(self) -> str:
        return self._schema_version

    @property
    def rating(self) -> int | None:
        return self._rating

    @property
    def text(self) -> str | None:
        return self._text

    @property
    def user(self) -> str | None:
        return self._user

    @property
    def ts(self) -> datetime | None:
        return self._ts

    @staticmethod
    def from_raw(raw: Mapping[str, str | int | float | datetime | None]) -> Review:
        """Create Review from raw data with proper type coercion"""
        place_id = _coerce_str(raw.get("place_id"), "place_id")
        review_id = _coerce_str(raw.get("review_id"), "review_id")
        schema_version = _coerce_str(raw.get("schema_version"), "schema_version") or "v1"
        rating = _coerce_int(raw.get("rating"))
        text = _coerce_str(raw.get("text"), "text", allow_none=True)
        user = _coerce_str(raw.get("user"), "user", allow_none=True)
        ts = _coerce_ts(raw.get("ts"))

        if not place_id:
            raise ValueError("place_id is required")
        if not review_id:
            raise ValueError("review_id is required")

        return Review(_place_id=place_id, _review_id=review_id, _schema_version=schema_version, _rating=rating, _text=text, _user=user, _ts=ts)


# Legacy functions for backward compatibility
def validate(data: dict[str, str | int | float | datetime | None]) -> tuple[bool, list[str]]:
    """Validate review data using legacy validation logic"""
    errors: list[str] = []

    # Check required fields
    required_fields = ["place_id", "review_id"]
    missing_fields = [field for field in required_fields if field not in data or data[field] is None]
    if missing_fields:
        errors.append(f"Missing required fields: {', '.join(missing_fields)}")

    # Validate rating if present
    if "rating" in data and data["rating"] is not None:
        rating = data["rating"]
        if not isinstance(rating, (int, float)) or rating < 1 or rating > 5:
            errors.append("Invalid rating: must be between 1 and 5")

    # Validate time_unix if present
    if "time_unix" in data and data["time_unix"] is not None:
        time_unix = data["time_unix"]
        if not isinstance(time_unix, (int, float)) or time_unix <= 0:
            errors.append("Invalid time_unix: must be positive number")

    # Validate crawl_meta if present
    if "crawl_meta" in data and data["crawl_meta"] is not None:
        crawl_meta = data["crawl_meta"]
        if not isinstance(crawl_meta, dict):
            errors.append("crawl_meta must be a dictionary")
        else:
            required_meta_fields = ["run_id", "session", "ts", "source"]
            missing_meta = [field for field in required_meta_fields if field not in crawl_meta]
            if missing_meta:
                errors.append("Missing crawl_meta fields: " + ", ".join(missing_meta))

    return len(errors) == 0, errors


def validate_batch(batch_data: list[dict[str, str | int | float | datetime | None]]) -> tuple[list[dict[str, str | int | float | datetime | None]], list[dict[str, str | int | float | datetime | None]]]:
    """Validate a batch of review data"""
    valid: list[dict[str, str | int | float | datetime | None]] = []
    invalid: list[dict[str, str | int | float | datetime | None]] = []

    for i, item in enumerate(batch_data):
        is_valid, errors = validate(item)
        if is_valid:
            valid.append(item)
        else:
            item_with_errors = item.copy()
            item_with_errors["_validation_errors"] = errors
            item_with_errors["_line_number"] = i + 1
            invalid.append(item_with_errors)

    return valid, invalid


def normalize_review(data: dict[str, str | int | float | datetime | None], meta: dict[str, str | int | float | datetime | None] | None = None) -> dict[str, str | int | float | datetime | None]:
    """Normalize review data"""
    if meta is None:
        meta = {}

    normalized = data.copy()

    # Extract place_id from URL if not present
    if "place_id" not in normalized and "place_url" in normalized:
        import re
        match = re.search(r'place_id:([^&]+)', normalized["place_url"])
        if match:
            normalized["place_id"] = match.group(1)

    # Generate review_id if not present
    if "review_id" not in normalized:
        author = normalized.get("author", "unknown")
        time_str = str(normalized.get("time_unix", normalized.get("date", "")))
        place_id = normalized.get("place_id", "unknown")
        normalized["review_id"] = f"{place_id}_{author}_{time_str}"

    # Normalize timestamp
    if "time_unix" not in normalized and "date" in normalized:
        try:
            if isinstance(normalized["date"], str):
                # Try to parse various date formats
                for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
                    try:
                        dt = datetime.strptime(normalized["date"], fmt)
                        normalized["time_unix"] = int(dt.timestamp())
                        break
                    except ValueError:
                        continue
                else:
                    # If no format matches, use current time
                    normalized["time_unix"] = int(datetime.now().timestamp())
            else:
                normalized["time_unix"] = int(normalized["date"])
        except Exception:
            normalized["time_unix"] = int(datetime.now().timestamp())

    # Basic text normalization
    if "text" in normalized and normalized["text"]:
        normalized["text"] = str(normalized["text"]).strip()

    return normalized


# Legacy compatibility - keep ReviewV1 for backward compatibility


class ReviewV1(BaseModel):
    """Pydantic model for review validation (legacy compatibility)"""

    # Core fields
    place_id: str
    review_id: str
    schema_version: str = Field(default="1.0")

    # Optional fields
    rating: int | None = None
    text: str | None = None
    user: str | None = None
    ts: datetime | None = None

    class Config:
        validate_assignment: bool = True
