"""
ETL (Extract, Transform, Load) utilities for processor_python
"""

from typing import Dict, List, Any
import pandas as pd


def process_reviews(reviews: List[Dict[str, Any]]) -> pd.DataFrame:
    """Process a list of reviews into a DataFrame"""
    if not reviews:
        return pd.DataFrame()

    df = pd.DataFrame(reviews)
    return df


def transform_review_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Transform review data"""
    transformed = data.copy()

    # Add any transformations here
    if "rating" in transformed and transformed["rating"] is not None:
        transformed["rating"] = int(transformed["rating"])

    return transformed
