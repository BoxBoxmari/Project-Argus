"""
Argus Data Ingest Module

Process and normalize Google Maps review data from various sources.
"""

from .processor import DataProcessor, ReviewData

__version__ = "1.0.0"
__all__ = ["DataProcessor", "ReviewData"]
