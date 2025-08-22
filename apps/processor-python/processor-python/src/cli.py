#!/usr/bin/env python3
"""
Command-line interface for Project Argus Python processor.

Usage:
    python -m src.cli process input1.ndjson input2.ndjson output.ndjson
    python -m src.cli validate reviews.ndjson
"""

import argparse
import json
import sys
from pathlib import Path
try:
    from .etl import run as etl_run, load_ndjson
    from .schema import ReviewV1
except ImportError:
    # Fallback for direct execution
    from etl import run as etl_run, load_ndjson
    from schema import ReviewV1

def cmd_process(args):
    """Process NDJSON files through the ETL pipeline."""
    if len(args.inputs) < 1:
        print("Error: At least one input file is required", file=sys.stderr)
        return 1
    
    try:
        etl_run(args.inputs, args.output)
        print(f"✓ Processed {len(args.inputs)} file(s) → {args.output}")
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

def cmd_validate(args):
    """Validate NDJSON file against schema."""
    try:
        errors = 0
        total = 0
        
        with open(args.file, 'r', encoding='utf-8') as f:
            for line_num, record in enumerate(load_ndjson(f), 1):
                total += 1
                try:
                    ReviewV1(**record)
                except Exception as e:
                    errors += 1
                    print(f"Line {line_num}: {e}")
        
        if errors == 0:
            print(f"✓ All {total} records are valid")
            return 0
        else:
            print(f"✗ {errors}/{total} records have validation errors")
            return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

def cmd_stats(args):
    """Show statistics about processed data."""
    try:
        stats = {
            'total_records': 0,
            'places': set(),
            'rating_distribution': {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            'has_text': 0,
            'has_timestamp': 0
        }
        
        with open(args.file, 'r', encoding='utf-8') as f:
            for record in load_ndjson(f):
                stats['total_records'] += 1
                stats['places'].add(record.get('place_id', 'unknown'))
                
                rating = record.get('rating')
                if rating and 1 <= rating <= 5:
                    stats['rating_distribution'][int(rating)] += 1
                
                if record.get('text'):
                    stats['has_text'] += 1
                
                if record.get('ts'):
                    stats['has_timestamp'] += 1
        
        print(f"Total records: {stats['total_records']}")
        print(f"Unique places: {len(stats['places'])}")
        print(f"Records with text: {stats['has_text']}")
        print(f"Records with timestamp: {stats['has_timestamp']}")
        print("Rating distribution:")
        for rating in [1, 2, 3, 4, 5]:
            count = stats['rating_distribution'][rating]
            pct = (count / stats['total_records']) * 100 if stats['total_records'] > 0 else 0
            print(f"  {rating}★: {count} ({pct:.1f}%)")
        
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

def main():
    parser = argparse.ArgumentParser(
        prog="argus-processor",
        description="Project Argus Python data processor"
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Process command
    process_parser = subparsers.add_parser('process', help='Process NDJSON files')
    process_parser.add_argument('inputs', nargs='+', help='Input NDJSON files')
    process_parser.add_argument('output', help='Output NDJSON file')
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate NDJSON file')
    validate_parser.add_argument('file', help='NDJSON file to validate')
    
    # Stats command
    stats_parser = subparsers.add_parser('stats', help='Show data statistics')
    stats_parser.add_argument('file', help='NDJSON file to analyze')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    if args.command == 'process':
        return cmd_process(args)
    elif args.command == 'validate':
        return cmd_validate(args)
    elif args.command == 'stats':
        return cmd_stats(args)
    else:
        print(f"Unknown command: {args.command}", file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
