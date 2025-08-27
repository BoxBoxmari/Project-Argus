"""
Schema definitions for review data using Pydantic
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class ReviewV1(BaseModel):
    """Pydantic model for review validation"""

    # Core fields
    place_id: str
    review_id: str
    schema_version: str = Field(default="1.0")

    # Optional fields
    rating: Optional[int] = None
    text: Optional[str] = None
    user: Optional[str] = None
    ts: Optional[datetime] = None

    class Config:
        validate_assignment = True
