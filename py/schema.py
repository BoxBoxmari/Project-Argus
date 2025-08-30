"""
Legacy schema validation functions
"""

from typing import Any, Dict, List, Tuple

REQUIRED_FIELDS = ["place_id", "review_id"]


def validate(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate review data using legacy validation logic"""
    errors = []

    # Check required fields
    missing_fields = [field for field in REQUIRED_FIELDS if field not in data or data[field] is None]
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


def validate_batch(batch_data: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Validate a batch of review data"""
    valid = []
    invalid = []

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


def normalize_review(data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize review data"""
    normalized = data.copy()

    # Basic normalization
    if "text" in normalized and normalized["text"]:
        normalized["text"] = str(normalized["text"]).strip()

    return normalized
