"""
Project Argus - Python Data Processor

A robust ETL pipeline for processing Google Maps review data with schema validation,
deduplication, and quality control checks.
"""

from .etl import dedup, load_ndjson, normalize, qc, run
from .schema import ReviewV1

__version__ = "1.0.0"
__all__ = ["ReviewV1", "load_ndjson", "normalize", "dedup", "qc", "run"]
