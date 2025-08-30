"""
Argus Python Testing Configuration
Comprehensive test setup for Python components with quality gates
"""

import json
import os
import sys
import pytest
from datetime import datetime
from typing import Any
from pathlib import Path

# Add the project root to the Python path for imports
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Try importing pandas if available
HAS_PANDAS = False
try:
    import pandas as pd  # type: ignore[import-not-found]
    HAS_PANDAS = True
except ImportError:
    pass

# Skip tests if pandas is not available
if not HAS_PANDAS:
    pytest.skip("pandas not available for test environment", allow_module_level=True)

# Test environment setup
TEST_ENV = {
    "PYTHONPATH": ":".join([
        str(project_root / "py" / "ingest" / "src"),
        str(project_root / "py" / "ingest" / "processor_python")
    ]),
    "ARGUS_TEST_MODE": "1",
}

PROJECT_ROOT = project_root

def test_data_dir():
    """Fixture for test data directory"""
    return PROJECT_ROOT / "tests" / "fixtures" / "data"

def golden_data_dir():
    """Fixture for golden reference data directory"""
    return PROJECT_ROOT / "tests" / "golden"

def test_artifacts_dir():
    """Fixture for test artifacts directory"""
    run_id = f"pytest-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    artifacts_path = PROJECT_ROOT / ".artifacts" / run_id
    artifacts_path.mkdir(parents=True, exist_ok=True)
    return artifacts_path


@pytest.fixture
def temp_ndjson_file(tmp_path: Path):
    """Create temporary NDJSON file for testing"""
    def _create_ndjson(data: list[dict[str, Any]]) -> str:
        ndjson_path = tmp_path / "test_data.ndjson"
        with open(ndjson_path, 'w', encoding='utf-8') as f:
            for record in data:
                f.write(json.dumps(record, ensure_ascii=False) + '\n')
        return str(ndjson_path)
    return _create_ndjson


@pytest.fixture
def sample_review_data() -> dict[str, Any]:
    """Sample review data for testing"""
    return {
        "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
        "place_url": "https://www.google.com/maps/place/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4",
        "review_id": "ChdDSUhNMG9nS0VJQ0FnSURhcU1ESzF3RRAB",
        "author": "John Smith",
        "rating": 4,
        "text": "Great coffee and friendly service!",
        "relative_time": "2 months ago",
        "time_unix": 1640995200,
        "lang": "en",
        "crawl_meta": {
            "run_id": "test-run-001",
            "session": "session-001",
            "ts": 1640995200000,
            "source": "playwright"
        }
    }


@pytest.fixture
def invalid_review_data() -> list[dict[str, Any]]:
    """Invalid review data for negative testing"""
    return [
        # Missing required fields
        {"place_id": "test", "rating": 4},
        # Invalid rating
        {"place_id": "test", "review_id": "test", "author": "test", "rating": 6,
         "text": "test", "relative_time": "test", "time_unix": 1640995200},
        # Invalid time_unix
        {"place_id": "test", "review_id": "test", "author": "test", "rating": 4,
         "text": "test", "relative_time": "test", "time_unix": -1},
        # Invalid crawl_meta
        {"place_id": "test", "review_id": "test", "author": "test", "rating": 4,
         "text": "test", "relative_time": "test", "time_unix": 1640995200,
         "crawl_meta": "invalid"}
    ]


@pytest.fixture
def large_dataset():
    """Generate large dataset for performance testing"""
    def _generate(size: int) -> list[dict[str, Any]]:
        reviews = []
        for i in range(size):
            reviews.append({
                "place_id": f"place_{i % 100}",  # 100 unique places
                "place_url": f"https://www.google.com/maps/place/?q=place_id:place_{i % 100}",
                "review_id": f"review_{i}",
                "author": f"Author {i}",
                "rating": (i % 5) + 1,
                "text": f"Review text {i} " * 50,  # Long text
                "relative_time": f"{i} days ago",
                "time_unix": 1640995200 + i * 3600,
                "lang": ["en", "vi", "fr", "de", "es"][i % 5],
                "crawl_meta": {
                    "run_id": f"run_{i // 1000}",
                    "session": f"session_{i % 10}",
                    "ts": 1640995200000 + i * 1000,
                    "source": "playwright"
                }
            })
        return reviews
    return _generate


def pytest_configure(config):
    """Pytest configuration hook"""
    # Add custom markers
    config.addinivalue_line(
        "markers", "unit: Unit tests for individual functions"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests for component interaction"
    )
    config.addinivalue_line(
        "markers", "performance: Performance and load tests"
    )
    config.addinivalue_line(
        "markers", "quality: Data quality and schema validation tests"
    )
    config.addinivalue_line(
        "markers", "slow: Tests that take longer than 30 seconds"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers automatically"""
    for item in items:
        # Mark performance tests
        if "performance" in item.nodeid:
            item.add_marker(pytest.mark.performance)
        elif "quality" in item.nodeid:
            item.add_marker(pytest.mark.quality)
        elif "integration" in item.nodeid:
            item.add_marker(pytest.mark.integration)
        else:
            item.add_marker(pytest.mark.unit)


def pytest_runtest_makereport(item, call):
    """Generate test reports with artifact collection"""
    if call.when == "call":
        # Collect artifacts for failed tests
        if call.excinfo is not None:
            artifacts_dir = Path(".artifacts") / os.environ.get("PYTEST_RUN_ID", "pytest")
            artifacts_dir.mkdir(parents=True, exist_ok=True)

            # Save test failure details
            failure_report = {
                "test_name": item.nodeid,
                "failure_reason": str(call.excinfo.value),
                "timestamp": datetime.now().isoformat()
            }

            with open(artifacts_dir / f"failure-{item.name}.json", 'w') as f:
                json.dump(failure_report, f, indent=2)

# Export pandas for tests that need it
pd = pd if HAS_PANDAS else None
