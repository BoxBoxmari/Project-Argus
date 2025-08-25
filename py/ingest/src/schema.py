import json
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime

# Review schema fields based on libs/js-core/src/dataset.ts
REVIEW_FIELDS = {
    "place_id", "place_url", "review_id", "author", "rating", "text", 
    "relative_time", "time_unix", "lang", "owner_response", "crawl_meta"
}

REQUIRED_FIELDS = {
    "place_id", "place_url", "review_id", "author", "rating", "text", 
    "relative_time", "time_unix"
}

def validate(obj: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate review object against schema"""
    missing = REQUIRED_FIELDS - obj.keys()
    errors = []
    
    if missing:
        errors.append(f"Missing required fields: {list(missing)}")
    
    # Validate rating
    if 'rating' in obj:
        rating = obj['rating']
        if rating is not None and (not isinstance(rating, (int, float)) or rating < 1 or rating > 5):
            errors.append(f"Invalid rating: {rating} (must be 1-5 or None)")
    
    # Validate time_unix
    if 'time_unix' in obj:
        time_unix = obj['time_unix']
        if not isinstance(time_unix, (int, float)) or time_unix <= 0:
            errors.append(f"Invalid time_unix: {time_unix} (must be positive number)")
    
    # Validate crawl_meta structure
    if 'crawl_meta' in obj:
        crawl_meta = obj['crawl_meta']
        if not isinstance(crawl_meta, dict):
            errors.append("crawl_meta must be a dictionary")
        else:
            required_meta = {'run_id', 'session', 'ts', 'source'}
            missing_meta = required_meta - crawl_meta.keys()
            if missing_meta:
                errors.append(f"Missing crawl_meta fields: {list(missing_meta)}")
    
    return len(errors) == 0, errors

def validate_batch(objs: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Validate a batch of review objects, return valid and invalid"""
    valid = []
    invalid = []
    
    for i, obj in enumerate(objs):
        is_valid, errors = validate(obj)
        if is_valid:
            valid.append(obj)
        else:
            obj['_validation_errors'] = errors
            obj['_line_number'] = i + 1
            invalid.append(obj)
    
    return valid, invalid

def normalize_review(raw: Dict[str, Any], meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Normalize raw review data to schema format"""
    if meta is None:
        meta = {}
    
    # Extract place_id from URL if not present
    if 'place_id' not in raw and 'place_url' in raw:
        import re
        match = re.search(r'place_id:([^&]+)', raw['place_url'])
        if match:
            raw['place_id'] = match.group(1)
    
    # Generate review_id if not present
    if 'review_id' not in raw:
        author = raw.get('author', 'unknown')
        time_str = str(raw.get('time_unix', raw.get('date', '')))
        raw['review_id'] = f"{raw.get('place_id', 'unknown')}_{author}_{time_str}"
    
    # Normalize timestamp
    if 'time_unix' not in raw and 'date' in raw:
        try:
            if isinstance(raw['date'], str):
                # Try to parse various date formats
                for fmt in ['%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S']:
                    try:
                        dt = datetime.strptime(raw['date'], fmt)
                        raw['time_unix'] = int(dt.timestamp())
                        break
                    except ValueError:
                        continue
                else:
                    # If no format matches, use current time
                    raw['time_unix'] = int(datetime.now().timestamp())
            else:
                raw['time_unix'] = int(raw['date'])
        except:
            raw['time_unix'] = int(datetime.now().timestamp())
    
    # Ensure required fields have defaults
    defaults = {
        'lang': 'en',
        'rating': None,
        'text': '',
        'relative_time': '',
        'owner_response': None
    }
    
    for field, default in defaults.items():
        if field not in raw:
            raw[field] = default
    
    # Add crawl_meta if not present
    if 'crawl_meta' not in raw:
        raw['crawl_meta'] = {
            'run_id': meta.get('run_id', 'unknown'),
            'session': meta.get('session', 'default'),
            'ts': int(datetime.now().timestamp()),
            'source': meta.get('source', 'python'),
            'url': meta.get('url', ''),
            'user_agent': meta.get('user_agent', ''),
            'viewport': meta.get('viewport', {'width': 1280, 'height': 900})
        }
    
    return raw

def get_schema_stats(objs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Get statistics about schema compliance"""
    valid, invalid = validate_batch(objs)
    
    field_counts = {}
    for field in REVIEW_FIELDS:
        field_counts[field] = sum(1 for obj in objs if field in obj and obj[field] is not None)
    
    return {
        'total': len(objs),
        'valid': len(valid),
        'invalid': len(invalid),
        'compliance_rate': len(valid) / len(objs) if objs else 0,
        'field_coverage': field_counts,
        'validation_errors': [obj['_validation_errors'] for obj in invalid if '_validation_errors' in obj]
    }
