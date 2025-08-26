import hashlib
import json
from collections import defaultdict
from typing import Any, Dict, List, Tuple


def create_review_key(review: Dict[str, Any]) -> str:
    """Create a unique key for deduplication"""
    place_id = review.get('place_id', '')
    review_id = review.get('review_id', '')
    
    if place_id and review_id:
        return f"{place_id}:{review_id}"
    
    # Fallback: create hash from content
    content = f"{review.get('author', '')}{review.get('text', '')}{review.get('time_unix', '')}"
    content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()[:8]
    return f"{place_id}:{content_hash}"

def deduplicate_reviews(reviews: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove duplicate reviews based on place_id and review_id"""
    seen = set()
    unique_reviews = []
    
    for review in reviews:
        key = create_review_key(review)
        if key not in seen:
            seen.add(key)
            unique_reviews.append(review)
    
    return unique_reviews

def stable_sort_by_time(reviews: List[Dict[str, Any]], reverse: bool = False) -> List[Dict[str, Any]]:
    """Sort reviews by time_unix with stable sorting (preserves original order for same timestamps)"""
    def get_timestamp(review: Dict[str, Any]) -> int:
        return review.get('time_unix', 0)
    
    # Use enumerate to preserve original order for stable sorting
    indexed_reviews = [(i, review) for i, review in enumerate(reviews)]
    
    if reverse:
        # Newest first
        sorted_reviews = sorted(indexed_reviews, key=lambda x: (get_timestamp(x[1]), -x[0]), reverse=True)
    else:
        # Oldest first
        sorted_reviews = sorted(indexed_reviews, key=lambda x: (get_timestamp(x[1]), x[0]))
    
    return [review for _, review in sorted_reviews]

def group_by_place(reviews: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Group reviews by place_id"""
    grouped = defaultdict(list)
    
    for review in reviews:
        place_id = review.get('place_id', 'unknown')
        grouped[place_id].append(review)
    
    return dict(grouped)

def get_dedup_stats(original: List[Dict[str, Any]], deduplicated: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Get statistics about deduplication process"""
    return {
        'original_count': len(original),
        'deduplicated_count': len(deduplicated),
        'duplicates_removed': len(original) - len(deduplicated),
        'deduplication_rate': (len(original) - len(deduplicated)) / len(original) if original else 0,
        'unique_places': len(set(review.get('place_id') for review in deduplicated if review.get('place_id')))
    }

def process_reviews_pipeline(reviews: List[Dict[str, Any]], 
                           sort_reverse: bool = False) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Complete pipeline: deduplicate then sort"""
    # Step 1: Deduplicate
    unique_reviews = deduplicate_reviews(reviews)
    
    # Step 2: Sort by time
    sorted_reviews = stable_sort_by_time(unique_reviews, reverse=sort_reverse)
    
    # Step 3: Generate statistics
    stats = get_dedup_stats(reviews, sorted_reviews)
    stats['sort_order'] = 'newest_first' if sort_reverse else 'oldest_first'
    
    return sorted_reviews, stats

def save_deduped_reviews(reviews: List[Dict[str, Any]], 
                        output_file: str, 
                        sort_reverse: bool = False) -> Dict[str, Any]:
    """Save deduplicated and sorted reviews to file"""
    processed_reviews, stats = process_reviews_pipeline(reviews, sort_reverse)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        for review in processed_reviews:
            f.write(json.dumps(review, ensure_ascii=False) + '\n')
    
    stats['output_file'] = output_file
    return stats

def load_and_process_ndjson(input_file: str, 
                           output_file: str, 
                           sort_reverse: bool = False) -> Dict[str, Any]:
    """Load NDJSON, process, and save deduplicated results"""
    reviews = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            
            try:
                review = json.loads(line)
                reviews.append(review)
            except json.JSONDecodeError as e:
                print(f"Warning: Invalid JSON at line {line_num}: {e}")
                continue
    
    return save_deduped_reviews(reviews, output_file, sort_reverse)

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python dedup.py <input.ndjson> <output.ndjson> [--reverse]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    sort_reverse = '--reverse' in sys.argv
    
    try:
        stats = load_and_process_ndjson(input_file, output_file, sort_reverse)
        print("Processing complete:")
        print(f"  Original: {stats['original_count']} reviews")
        print(f"  Deduplicated: {stats['deduplicated_count']} reviews")
        print(f"  Removed: {stats['duplicates_removed']} duplicates")
        print(f"  Unique places: {stats['unique_places']}")
        print(f"  Output: {stats['output_file']}")
        print(f"  Sort order: {stats['sort_order']}")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
