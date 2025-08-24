from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ReviewV1(BaseModel):
    schema_version: str = Field(default="1.0")
    place_id: str
    review_id: str
    user: Optional[str] = None
    rating: Optional[float] = None
    text: Optional[str] = None
    ts: Optional[datetime] = None
    likes: Optional[int] = None
    lang: Optional[str] = None
