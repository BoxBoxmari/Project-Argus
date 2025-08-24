# Schema definitions for Argus Processor Python
# Provides ReviewV1 compatible with Pydantic if installed, otherwise a minimal fallback

from typing import Any, Dict, Optional

try:
	from pydantic import BaseModel, Field
	from pydantic.config import ConfigDict  # pydantic v2

	class ReviewV1(BaseModel):
		run_id: Optional[str] = None
		place_id: Optional[str] = None
		review_id: Optional[str] = None
		user_id: Optional[str] = None
		rating: Optional[int] = None
		text: Optional[str] = ""
		lang: Optional[str] = None
		likes: Optional[int] = None
		published_at: Optional[str] = None
		fetched_at: Optional[str] = None
		source: Optional[str] = None
		meta: Dict[str, Any] = Field(default_factory=dict)

		# allow unknown fields to pass through normalization
		model_config = ConfigDict(extra="allow")
except Exception:
	# Minimal fallback when Pydantic is not installed
	class ReviewV1:  # type: ignore
		def __init__(self, **data: Any) -> None:
			self._data: Dict[str, Any] = data

		def model_dump(self) -> Dict[str, Any]:
			return dict(self._data)
