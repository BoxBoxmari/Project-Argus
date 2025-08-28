"""
Quality gates for review data validation
"""

from __future__ import annotations
from collections.abc import Sequence
from .types import ValidationError, ReviewLike


def check_schema_compliance(items: Sequence[ReviewLike]) -> list[ValidationError]:
    """Check schema compliance for review items"""
    errors: list[ValidationError] = []
    for r in items:
        # Ensure mandatory fields present
        if not r.place_id or not r.review_id:
            errors.append(ValidationError("MISSING_KEYS", f"{r.place_id}:{r.review_id}"))
    return errors


def check_uniqueness(items: Sequence[ReviewLike]) -> list[ValidationError]:
    """Check for duplicate reviews"""
    errors: list[ValidationError] = []
    seen: set[tuple[str, str]] = set()
    for r in items:
        key = (r.place_id, r.review_id)
        if key in seen:
            errors.append(ValidationError("DUPLICATE", f"{key}"))
        else:
            seen.add(key)
    return errors


def check_data_quality(items: Sequence[ReviewLike]) -> list[ValidationError]:
    """Check data quality constraints"""
    errors: list[ValidationError] = []
    for r in items:
        if r.rating is not None and not (-1_000_000 <= r.rating <= 1_000_000):
            errors.append(ValidationError("RATING_RANGE", f"{r.rating}"))
    return errors
