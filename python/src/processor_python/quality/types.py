"""
Type definitions for quality assurance
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol
from datetime import datetime


@dataclass(frozen=True)
class ValidationError:
    """Immutable validation error"""
    code: str
    message: str


class ReviewLike(Protocol):
    """Protocol for review-like objects"""
    @property
    def place_id(self) -> str:
        ...

    @property
    def review_id(self) -> str:
        ...

    @property
    def schema_version(self) -> str:
        ...

    @property
    def rating(self) -> int | None:
        ...

    @property
    def text(self) -> str | None:
        ...

    @property
    def user(self) -> str | None:
        ...

    @property
    def ts(self) -> datetime | None:
        ...
