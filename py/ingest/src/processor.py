"""
Argus Data Processor - Ingest and normalize Google Maps review data
"""

import json
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class ReviewData(BaseModel):
    """Review data model with validation"""
    place_id: str
    review_id: str
    author: Optional[str] = None
    rating: Optional[float] = Field(None, ge=1, le=5)
    text: Optional[str] = None
    time: Optional[str] = None
    extracted_at: str
    source: str = "argus"

class DataProcessor:
    """Process and normalize review data"""
    
    def __init__(self, output_dir: str = "datasets"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def process_json_file(self, file_path: str) -> List[ReviewData]:
        """Process a single JSON file and return normalized data"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        reviews = []
        if isinstance(data, dict) and 'reviews' in data:
            # Batch format
            for review in data['reviews']:
                review['place_id'] = data.get('place_id', 'unknown')
                review['source'] = 'argus'
                try:
                    reviews.append(ReviewData(**review))
                except Exception as e:
                    print(f"Warning: Invalid review data: {e}")
        elif isinstance(data, list):
            # List format
            for review in data:
                try:
                    reviews.append(ReviewData(**review))
                except Exception as e:
                    print(f"Warning: Invalid review data: {e}")
        
        return reviews
    
    def process_directory(self, dir_path: str) -> List[ReviewData]:
        """Process all JSON files in a directory"""
        dir_path = Path(dir_path)
        all_reviews = []
        
        for json_file in dir_path.glob("*.json"):
            try:
                reviews = self.process_json_file(str(json_file))
                all_reviews.extend(reviews)
                print(f"Processed {json_file}: {len(reviews)} reviews")
            except Exception as e:
                print(f"Error processing {json_file}: {e}")
        
        return all_reviews
    
    def save_parquet(self, reviews: List[ReviewData], filename: str = "reviews.parquet"):
        """Save reviews to Parquet format"""
        df = pd.DataFrame([review.model_dump() for review in reviews])
        output_path = self.output_dir / filename
        df.to_parquet(output_path, index=False)
        print(f"Saved {len(reviews)} reviews to {output_path}")
        return output_path
    
    def save_csv(self, reviews: List[ReviewData], filename: str = "reviews.csv"):
        """Save reviews to CSV format"""
        df = pd.DataFrame([review.model_dump() for review in reviews])
        output_path = self.output_dir / filename
        df.to_csv(output_path, index=False, encoding='utf-8')
        print(f"Saved {len(reviews)} reviews to {output_path}")
        return output_path
    
    def generate_summary(self, reviews: List[ReviewData]) -> Dict[str, Any]:
        """Generate summary statistics"""
        if not reviews:
            return {"total_reviews": 0}
        
        ratings = [r.rating for r in reviews if r.rating is not None]
        places = set(r.place_id for r in reviews)
        authors = set(r.author for r in reviews if r.author)
        
        summary = {
            "total_reviews": len(reviews),
            "unique_places": len(places),
            "unique_authors": len(authors),
            "reviews_with_rating": len(ratings),
            "reviews_with_text": len([r for r in reviews if r.text]),
            "average_rating": sum(ratings) / len(ratings) if ratings else None,
            "rating_distribution": {
                "1": len([r for r in ratings if r == 1]),
                "2": len([r for r in ratings if r == 2]),
                "3": len([r for r in ratings if r == 3]),
                "4": len([r for r in ratings if r == 4]),
                "5": len([r for r in ratings if r == 5])
            }
        }
        
        return summary

def main():
    """CLI entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Process Argus review data")
    parser.add_argument("input", help="Input file or directory")
    parser.add_argument("--output-dir", default="datasets", help="Output directory")
    parser.add_argument("--format", choices=["parquet", "csv", "both"], default="both", help="Output format")
    
    args = parser.parse_args()
    
    processor = DataProcessor(args.output_dir)
    
    if Path(args.input).is_file():
        reviews = processor.process_json_file(args.input)
    else:
        reviews = processor.process_directory(args.input)
    
    if not reviews:
        print("No valid reviews found")
        return
    
    # Generate summary
    summary = processor.generate_summary(reviews)
    print("\nData Summary:")
    for key, value in summary.items():
        print(f"  {key}: {value}")
    
    # Save data
    if args.format in ["parquet", "both"]:
        processor.save_parquet(reviews)
    
    if args.format in ["csv", "both"]:
        processor.save_csv(reviews)
    
    # Save summary
    summary_path = processor.output_dir / "summary.json"
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, default=str)
    print(f"\nSummary saved to {summary_path}")

if __name__ == "__main__":
    main()
