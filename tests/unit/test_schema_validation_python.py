"""
Schema Contract Tests - Python

These tests validate that data structures conform to expected schemas
and that validation logic correctly identifies valid/invalid data.
"""

import pytest
import json
from datetime import datetime
from typing import Dict, Any, List
import pandas as pd
import os
import sys

# Add py/src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "py", "src"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "py"))

# Import modules under test
from processor_python.schema import ReviewV1
from schema import validate, validate_batch, normalize_review, REQUIRED_FIELDS
import processor_python.etl as etl


class TestReviewV1Schema:
    """Test pydantic ReviewV1 schema validation"""

    def test_valid_complete_review(self, sample_review_data):
        """Test validation of complete valid review data"""
        review = ReviewV1(**sample_review_data)

        assert review.place_id == sample_review_data["place_id"]
        assert review.rating == sample_review_data["rating"]
        assert review.schema_version == "1.0"

    def test_valid_minimal_review(self):
        """Test validation of minimal valid review data"""
        minimal_data = {
            "place_id": "ChIJTest123",
            "review_id": "test_review_001",
        }

        review = ReviewV1(**minimal_data)
        assert review.place_id == "ChIJTest123"
        assert review.review_id == "test_review_001"
        assert review.schema_version == "1.0"

    def test_invalid_schema_version(self):
        """Test that invalid schema version is accepted (default behavior)"""
        data = {
            "schema_version": "2.0",
            "place_id": "test",
            "review_id": "test"
        }

        # Should work - pydantic uses default value
        review = ReviewV1(**data)
        assert review.schema_version == "1.0"  # Default value

    def test_missing_required_fields(self):
        """Test validation failure with missing required fields"""
        with pytest.raises(Exception):  # Pydantic ValidationError
            ReviewV1()

    def test_invalid_rating_type(self):
        """Test validation failure with invalid rating type"""
        data = {
            "place_id": "test",
            "review_id": "test",
            "rating": "invalid_rating"
        }

        with pytest.raises(Exception):
            ReviewV1(**data)

    def test_valid_datetime_handling(self):
        """Test proper datetime handling"""
        data = {
            "place_id": "test",
            "review_id": "test",
            "ts": datetime.now()
        }

        review = ReviewV1(**data)
        assert isinstance(review.ts, datetime)

    def test_none_values_handling(self):
        """Test handling of None values for optional fields"""
        data = {
            "place_id": "test",
            "review_id": "test",
            "rating": None,
            "text": None,
            "user": None
        }

        review = ReviewV1(**data)
        assert review.rating is None
        assert review.text is None
        assert review.user is None


class TestLegacySchemaValidation:
    """Test legacy schema validation functions"""

    def test_validate_complete_review(self, sample_review_data):
        """Test validation of complete review data"""
        is_valid, errors = validate(sample_review_data)

        assert is_valid is True
        assert len(errors) == 0

    def test_validate_missing_required_fields(self):
        """Test validation failure with missing required fields"""
        incomplete_data = {
            "place_id": "test",
            "rating": 4
            # Missing other required fields
        }

        is_valid, errors = validate(incomplete_data)

        assert is_valid is False
        assert len(errors) > 0
        assert any("Missing required fields" in error for error in errors)

    def test_validate_invalid_rating_range(self):
        """Test validation failure with rating out of range"""
        invalid_ratings = [0, 6, -1, 10]

        for rating in invalid_ratings:
            data = {
                "place_id": "test",
                "place_url": "test",
                "review_id": "test",
                "author": "test",
                "rating": rating,
                "text": "test",
                "relative_time": "test",
                "time_unix": 1640995200
            }

            is_valid, errors = validate(data)
            assert is_valid is False
            assert any("Invalid rating" in error for error in errors)

    def test_validate_invalid_time_unix(self):
        """Test validation failure with invalid time_unix"""
        invalid_times = [-1, 0, "invalid"]

        for time_unix in invalid_times:
            data = {
                "place_id": "test",
                "place_url": "test",
                "review_id": "test",
                "author": "test",
                "rating": 4,
                "text": "test",
                "relative_time": "test",
                "time_unix": time_unix
            }

            is_valid, errors = validate(data)
            assert is_valid is False
            assert any("Invalid time_unix" in error for error in errors)

    def test_validate_invalid_crawl_meta(self):
        """Test validation failure with invalid crawl_meta"""
        data = {
            "place_id": "test",
            "place_url": "test",
            "review_id": "test",
            "author": "test",
            "rating": 4,
            "text": "test",
            "relative_time": "test",
            "time_unix": 1640995200,
            "crawl_meta": "invalid"  # Should be dict
        }

        is_valid, errors = validate(data)
        assert is_valid is False
        assert any("crawl_meta must be a dictionary" in error for error in errors)

    def test_validate_missing_crawl_meta_fields(self):
        """Test validation failure with incomplete crawl_meta"""
        data = {
            "place_id": "test",
            "place_url": "test",
            "review_id": "test",
            "author": "test",
            "rating": 4,
            "text": "test",
            "relative_time": "test",
            "time_unix": 1640995200,
            "crawl_meta": {
                "run_id": "test"
                # Missing required fields: session, ts, source
            }
        }

        is_valid, errors = validate(data)
        assert is_valid is False
        assert any("Missing crawl_meta fields" in error for error in errors)


class TestBatchValidation:
    """Test batch validation functionality"""

    def test_validate_batch_all_valid(self, sample_review_data):
        """Test batch validation with all valid records"""
        batch_data = [
            sample_review_data,
            {**sample_review_data, "review_id": "different_id", "rating": 3}
        ]

        valid, invalid = validate_batch(batch_data)

        assert len(valid) == 2
        assert len(invalid) == 0

    def test_validate_batch_mixed_validity(self, sample_review_data):
        """Test batch validation with mix of valid and invalid records"""
        batch_data = [
            sample_review_data,  # Valid
            {"place_id": "test", "rating": 10},  # Invalid - missing fields and bad rating
            {**sample_review_data, "review_id": "another_valid"}  # Valid
        ]

        valid, invalid = validate_batch(batch_data)

        assert len(valid) == 2
        assert len(invalid) == 1
        assert "_validation_errors" in invalid[0]
        assert "_line_number" in invalid[0]
        assert invalid[0]["_line_number"] == 2  # Second item (0-indexed + 1)

    def test_validate_batch_empty(self):
        """Test batch validation with empty input"""
        valid, invalid = validate_batch([])

        assert len(valid) == 0
        assert len(invalid) == 0


class TestDataNormalization:
    """Test data normalization functionality"""

    def test_normalize_review_complete_data(self, sample_review_data):
        """Test normalization of complete review data"""
        meta = {"additional": "metadata"}
        normalized = normalize_review(sample_review_data.copy(), meta)

        # Should preserve original data
        assert normalized["place_id"] == sample_review_data["place_id"]
        assert normalized["rating"] == sample_review_data["rating"]

    def test_normalize_extract_place_id_from_url(self):
        """Test place_id extraction from URL"""
        raw_data = {
            "place_url": "https://www.google.com/maps/place/?q=place_id:ChIJTest123&other=params",
            "author": "test",
            "rating": 4,
            "text": "test"
        }

        normalized = normalize_review(raw_data)
        assert normalized["place_id"] == "ChIJTest123"

    def test_normalize_generate_review_id(self):
        """Test review_id generation when missing"""
        raw_data = {
            "place_id": "test_place",
            "author": "test_author",
            "rating": 4,
            "time_unix": 1640995200
        }

        normalized = normalize_review(raw_data)
        assert "review_id" in normalized
        assert "test_place" in normalized["review_id"]
        assert "test_author" in normalized["review_id"]

    def test_normalize_timestamp_conversion(self):
        """Test timestamp normalization from various formats"""
        test_cases = [
            {"date": "2023-01-01", "expected_year": 2023},
            {"date": "2023-01-01T12:30:00", "expected_year": 2023},
            {"date": "2023-01-01 15:45:00", "expected_year": 2023}
        ]

        for case in test_cases:
            raw_data = {
                "place_id": "test",
                "author": "test",
                "rating": 4,
                "date": case["date"]
            }

            normalized = normalize_review(raw_data)
            assert "time_unix" in normalized
            # Convert back to check year
            dt = datetime.fromtimestamp(normalized["time_unix"])
            assert dt.year == case["expected_year"]

    def test_normalize_invalid_timestamp_fallback(self):
        """Test fallback for invalid timestamp formats"""
        raw_data = {
            "place_id": "test",
            "author": "test",
            "rating": 4,
            "date": "invalid-date-format"
        }

        normalized = normalize_review(raw_data)
        assert "time_unix" in normalized
        # Should use current time as fallback
        assert normalized["time_unix"] > 1640995200  # After 2022


class TestETLFunctions:
    """Test ETL pipeline functions"""

    def test_load_ndjson(self, temp_ndjson_file):
        """Test NDJSON loading functionality"""
        test_data = [
            {"id": 1, "text": "first"},
            {"id": 2, "text": "second"}
        ]

        ndjson_path = temp_ndjson_file(test_data)

        with open(ndjson_path, 'r', encoding='utf-8') as f:
            loaded_data = list(etl.load_ndjson(f))

        assert len(loaded_data) == 2
        assert loaded_data[0]["id"] == 1
        assert loaded_data[1]["text"] == "second"

    def test_load_ndjson_empty_lines(self, temp_ndjson_file, tmp_path):
        """Test NDJSON loading with empty lines"""
        ndjson_path = tmp_path / "test_with_empty.ndjson"
        with open(ndjson_path, 'w', encoding='utf-8') as f:
            f.write('{"id": 1}\n')
            f.write('\n')  # Empty line
            f.write('{"id": 2}\n')
            f.write('   \n')  # Whitespace only
            f.write('{"id": 3}\n')

        with open(ndjson_path, 'r', encoding='utf-8') as f:
            loaded_data = list(etl.load_ndjson(f))

        assert len(loaded_data) == 3
        assert [item["id"] for item in loaded_data] == [1, 2, 3]

    def test_normalize_etl_function(self):
        """Test ETL normalize function"""
        raw_record = {
            "review_id": "test",
            "rating": 4,
            "text": "good",
            "ts": "2023-01-01T12:00:00Z"
        }

        normalized = etl.normalize(raw_record, "test_place_id")

        assert normalized["place_id"] == "test_place_id"
        assert isinstance(normalized["ts"], datetime) or normalized["ts"] is None

    def test_dedup_function(self):
        """Test deduplication functionality"""
        records = [
            {"place_id": "place1", "review_id": "review1", "rating": 5},
            {"place_id": "place1", "review_id": "review2", "rating": 4},
            {"place_id": "place1", "review_id": "review1", "rating": 3},  # Duplicate
            {"place_id": "place2", "review_id": "review1", "rating": 5}   # Different place
        ]

        deduped = list(etl.dedup(records))

        assert len(deduped) == 3
        # Should keep first occurrence
        review1_place1 = next(r for r in deduped if r["place_id"] == "place1" and r["review_id"] == "review1")
        assert review1_place1["rating"] == 5  # First occurrence

    def test_qc_function(self):
        """Test quality control filtering"""
        records = [
            {"rating": 5, "text": "good"},
            {"rating": None, "text": "no rating"},  # Should pass
            {"rating": 6, "text": "invalid rating"},  # Should be filtered
            {"rating": -1, "text": "negative rating"},  # Should be filtered
            {"rating": 3, "text": "valid"}
        ]

        qc_passed = list(etl.qc(records))

        assert len(qc_passed) == 3
        valid_ratings = [r.get("rating") for r in qc_passed]
        assert 6 not in valid_ratings
        assert -1 not in valid_ratings


class TestQualityGate:
    """Test quality gate functionality"""

    def test_schema_compliance_valid_data(self, quality_gate, sample_review_data):
        """Test schema compliance check with valid data"""
        df = pd.DataFrame([sample_review_data])

        report = quality_gate.check_schema_compliance(df)

        assert report["compliant"] is True
        assert len(report["missing_columns"]) == 0
        assert len(report["rating_issues"]) == 0
        assert len(report["time_issues"]) == 0

    def test_schema_compliance_missing_columns(self, quality_gate):
        """Test schema compliance check with missing columns"""
        incomplete_df = pd.DataFrame([{"place_id": "test", "rating": 4}])

        report = quality_gate.check_schema_compliance(incomplete_df)

        assert report["compliant"] is False
        assert len(report["missing_columns"]) > 0
        assert "review_id" in report["missing_columns"]

    def test_schema_compliance_invalid_ratings(self, quality_gate):
        """Test schema compliance check with invalid ratings"""
        df = pd.DataFrame([
            {"place_id": "test", "review_id": "test1", "rating": 6, "time_unix": 123456},
            {"place_id": "test", "review_id": "test2", "rating": 3, "time_unix": 123456},
            {"place_id": "test", "review_id": "test3", "rating": 0, "time_unix": 123456}
        ])

        report = quality_gate.check_schema_compliance(df)

        assert report["compliant"] is False
        assert len(report["rating_issues"]) == 2  # Indices 0 and 2

    def test_uniqueness_check_valid(self, quality_gate, sample_review_data):
        """Test uniqueness check with unique data"""
        df = pd.DataFrame([
            sample_review_data,
            {**sample_review_data, "review_id": "different_id"}
        ])

        report = quality_gate.check_uniqueness(df)

        assert report["unique"] is True
        assert report["duplicate_count"] == 0

    def test_uniqueness_check_duplicates(self, quality_gate, sample_review_data):
        """Test uniqueness check with duplicate data"""
        df = pd.DataFrame([
            sample_review_data,
            sample_review_data,  # Exact duplicate
            {**sample_review_data, "text": "different text"}  # Same IDs, different content
        ])

        report = quality_gate.check_uniqueness(df)

        assert report["unique"] is False
        assert report["duplicate_count"] == 2

    def test_data_quality_comprehensive(self, quality_gate, sample_review_data):
        """Test comprehensive data quality check"""
        test_data = [
            sample_review_data,
            {**sample_review_data, "review_id": "test2", "text": "", "author": ""},
            {**sample_review_data, "review_id": "test3", "text": None, "author": None}
        ]

        df = pd.DataFrame(test_data)
        report = quality_gate.check_data_quality(df)

        assert "schema_compliance" in report
        assert "uniqueness" in report
        assert "empty_text_count" in report
        assert "missing_authors_count" in report
        assert "timestamp" in report

        # Should detect empty/missing text and authors
        assert report["empty_text_count"] >= 1
        assert report["missing_authors_count"] >= 1


class TestUnicodeAndEdgeCases:
    """Test Unicode handling and edge cases"""

    def test_unicode_text_validation(self):
        """Test validation with Unicode characters"""
        unicode_data = {
            "place_id": "test",
            "place_url": "test",
            "review_id": "test",
            "author": "李明 أحمد José",
            "rating": 5,
            "text": "这是一个很好的咖啡店! ☕️🌟 مقهى رائع جداً!",
            "relative_time": "1 month ago",
            "time_unix": 1640995200
        }

        is_valid, errors = validate(unicode_data)
        assert is_valid is True

    def test_emoji_handling(self):
        """Test handling of emoji characters"""
        emoji_data = {
            "place_id": "test",
            "place_url": "test",
            "review_id": "test",
            "author": "User with 😀",
            "rating": 4,
            "text": "Great food! 🍕🍔🍟 👍⭐⭐⭐⭐",
            "relative_time": "2 weeks ago",
            "time_unix": 1640995200
        }

        is_valid, errors = validate(emoji_data)
        assert is_valid is True

        # Test with pydantic model too
        review = ReviewV1(
            place_id=emoji_data["place_id"],
            review_id=emoji_data["review_id"],
            user=emoji_data["author"],
            rating=emoji_data["rating"],
            text=emoji_data["text"]
        )
        assert review.text == emoji_data["text"]

    def test_extremely_long_text(self):
        """Test handling of very long review text"""
        long_text = "This is a very long review. " * 1000  # ~29k characters

        long_text_data = {
            "place_id": "test",
            "place_url": "test",
            "review_id": "test",
            "author": "Verbose Reviewer",
            "rating": 4,
            "text": long_text,
            "relative_time": "1 day ago",
            "time_unix": 1640995200
        }

        is_valid, errors = validate(long_text_data)
        assert is_valid is True

        review = ReviewV1(**long_text_data)
        assert len(review.text) == len(long_text)

    def test_null_and_empty_values(self):
        """Test handling of null and empty values"""
        test_cases = [
            {"text": None},
            {"text": ""},
            {"rating": None},
            {"user": None},
            {"user": ""}
        ]

        for case in test_cases:
            data = {
                "place_id": "test",
                "review_id": "test",
                **case
            }

            # Should not raise exception for optional fields
            review = ReviewV1(**data)
            assert review.place_id == "test"
