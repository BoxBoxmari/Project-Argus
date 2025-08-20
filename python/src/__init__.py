"""
Project Argus - Python Data Processor

A robust ETL pipeline for processing Google Maps review data with schema validation,
deduplication, and quality control checks.
"""

from .schema import ReviewV1
from .etl import load_ndjson, normalize, dedup, qc, run

__version__ = "1.0.0"
__all__ = ["ReviewV1", "load_ndjson", "normalize", "dedup", "qc", "run"]
