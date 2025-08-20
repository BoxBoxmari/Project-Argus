# Python Data Processor

A robust ETL pipeline for processing Google Maps review data with schema validation,
deduplication, and quality control checks.

## Features

- **Schema Validation**: Pydantic-based data validation and type safety
- **ETL Pipeline**: Extract, Transform, Load operations with NDJSON streaming
- **Data Quality**: Automatic deduplication and quality control checks
- **API Integration**: SerpApi client for Google Maps review extraction
- **CLI Interface**: Command-line tools for data processing and validation
- **Deterministic Processing**: Idempotent operations with observable errors

## Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Data Sources  │    │   ETL Pipeline  │    │   Output Data   │
│                 │    │                 │    │                 │
│ SerpApi         │───▶│ Schema Valid.   │───▶│ Clean NDJSON    │
│ Userscript      │    │ Deduplication   │    │ Statistics      │
│ Manual Files    │    │ Quality Control │    │ Validated Data  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Installation

```bash
cd argus/processors/processor-python
pip install -r requirements.txt
```

## Data Schema

Reviews are validated against the `ReviewV1` schema:

```python
class ReviewV1(BaseModel):
    schema_version: str = "1.0"
    place_id: str          # Google Maps place ID
    review_id: str         # Unique review identifier
    user: Optional[str]    # Review author name
    rating: Optional[float] # 1-5 star rating
    text: Optional[str]    # Review text content
    ts: Optional[datetime] # Review timestamp
    likes: Optional[int]   # Number of likes
    lang: Optional[str]    # Language code
```

## CLI Usage

### Process NDJSON Files

```bash
# Process multiple input files through ETL pipeline
python -m src.cli process input1.ndjson input2.ndjson output.ndjson

# Example with real files
python -m src.cli process \
  data/place_1.ndjson \
  data/place_2.ndjson \
  processed/reviews_clean.ndjson
```

### Validate Data

```bash
# Validate NDJSON file against schema
python -m src.cli validate data/reviews.ndjson

# Example output:
# ✓ All 1,247 records are valid
```

### Generate Statistics

```bash
# Show data statistics
python -m src.cli stats processed/reviews_clean.ndjson

# Example output:
# Total records: 1,247
# Unique places: 3
# Records with text: 1,180
# Records with timestamp: 1,098
# Rating distribution:
#   1★: 45 (3.6%)
#   2★: 89 (7.1%)
#   3★: 201 (16.1%)
#   4★: 456 (36.6%)
#   5★: 456 (36.6%)
```

## API Integration

### SerpApi Client

```python
from src.api_client import SerpApiClient

# Initialize client
client = SerpApiClient(api_key="your_serpapi_key")

# Extract reviews for a place
client.extract_to_ndjson(
    place_id="ChIJN1t_tDeuEmsRUsoyG83frY4",
    output_file="reviews.ndjson",
    max_pages=5
)
```

### Environment Variables

```bash
# Set SerpApi key
export SERPAPI_KEY="your_api_key_here"

# Extract reviews using CLI
python -m src.api_client ChIJN1t_tDeuEmsRUsoyG83frY4 output.ndjson
```

## ETL Pipeline

### Programmatic Usage

```python
from src.etl import run, load_ndjson, normalize, dedup, qc
from src.schema import ReviewV1

# Load and process NDJSON files
input_files = ["place1.ndjson", "place2.ndjson"]
output_file = "processed.ndjson"

run(input_files, output_file)
```

### Pipeline Steps

1. **Load**: Stream NDJSON files line by line
2. **Normalize**: Apply schema validation and data cleaning
3. **Deduplicate**: Remove duplicate reviews by (place_id, review_id)
4. **Quality Control**: Filter invalid ratings and malformed data
5. **Output**: Write clean NDJSON with UTF-8 encoding

### Data Transformation

```python
# Example normalization
def normalize(record, place_id):
    record["place_id"] = place_id
    
    # Parse timestamps
    if "ts" in record and isinstance(record["ts"], str):
        try:
            from dateutil.parser import isoparse
            record["ts"] = isoparse(record["ts"]).astimezone(None)
        except Exception:
            record["ts"] = None
    
    # Validate against schema
    return ReviewV1(**record).model_dump()
```

## Data Quality

### Deduplication Strategy

Reviews are deduplicated using a composite key:

- Primary: `(place_id, review_id)`
- Fallback: `(place_id, user, rating, text_hash)`

### Quality Checks

- **Rating validation**: Must be between 0-5 or None
- **Schema compliance**: All fields match expected types
- **Data consistency**: Required fields are present
- **Encoding validation**: UTF-8 text processing

### Error Handling

```python
# Fail-fast with observable errors
try:
    validated_review = ReviewV1(**raw_data)
except ValidationError as e:
    logger.error(f"Schema validation failed: {e}")
    # Continue processing other records
```

## Integration Examples

### With Worker Node Queue

```python
# Process reviews from worker node output
from src.etl import load_ndjson, normalize

def process_worker_output(input_file, place_id):
    with open(input_file, 'r') as f:
        for record in load_ndjson(f):
            cleaned = normalize(record, place_id)
            # Send to next stage of pipeline
            yield cleaned
```

### With Userscript Data

```python
# Process userscript exported data
from src.cli import cmd_process

class Args:
    inputs = ["userscript_export.ndjson"]
    output = "processed_reviews.ndjson"

cmd_process(Args())
```

## Testing

```bash
# Run unit tests
python -m pytest src/tests/

# Test with sample data
python -m src.cli validate sample_data/reviews.ndjson
python -m src.cli stats sample_data/reviews.ndjson
```

## Development

### Code Quality

```bash
# Format code
ruff format src/

# Lint code
ruff check src/

# Type checking
mypy src/
```

### Adding New Schema Fields

1. Update `ReviewV1` in `schema.py`
2. Modify normalization logic in `etl.py`
3. Update API client if needed
4. Add tests for new functionality

## Production Considerations

### Performance

- **Streaming Processing**: Memory-efficient NDJSON streaming
- **Batch Operations**: Process multiple files efficiently
- **Rate Limiting**: Respect API quotas with built-in delays

### Monitoring

- **Structured Logging**: JSON logs for observability
- **Quality Metrics**: Track validation success rates
- **Error Recovery**: Graceful handling of malformed data

### Deployment

```bash
# Docker container
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY src/ ./src/
CMD ["python", "-m", "src.cli"]
```

## Troubleshooting

### Common Issues

1. **Schema Validation Errors**
   - Check data types match expected schema
   - Verify required fields are present
   - Use `validate` command to identify issues

2. **API Rate Limits**
   - Increase `rate_limit_delay` parameter
   - Use `max_pages` to limit requests
   - Monitor API quota usage

3. **Memory Issues**
   - Use streaming processing for large files
   - Process files in smaller batches
   - Check for memory leaks in long-running processes

### Debug Mode

```bash
# Enable verbose logging
export LOG_LEVEL=DEBUG
python -m src.cli process input.ndjson output.ndjson
```

## Contributing

1. Follow Python PEP 8 style guidelines
2. Add type hints for all functions
3. Include docstrings and examples
4. Write tests for new features
5. Use Pydantic for data validation

## License

MIT License - Project Argus
