# End-to-End (E2E) Testing Framework

## Overview

This directory contains the complete end-to-end testing framework for Project Argus, designed to achieve maximum bug detection and root cause identification. The framework tests the entire system from CLI input to data output, ensuring comprehensive validation of the Google Maps review scraping pipeline.

## Framework Structure

```
tests/e2e/
├── README.md                    # This documentation
├── cli-pipeline.test.ts         # CLI and pipeline integration tests
├── data-quality.test.ts         # Data quality validation and real-world scenarios
├── test-utilities.ts            # Test helpers and mock utilities
└── run-e2e-tests.ts            # Test runner script
```

## Test Categories

### 1. CLI and Pipeline Integration (`cli-pipeline.test.ts`)

Tests the complete command-line interface and processing pipeline:

- **CLI Argument Parsing**: Validates command-line argument handling
- **Configuration Loading**: Tests environment variable and config file loading
- **Pipeline Processing**: End-to-end data processing with fixtures
- **Output Formats**: Validates CSV, NDJSON, and Parquet export
- **Error Handling**: Network timeouts, rate limiting, DOM changes
- **Performance**: Concurrent processing and memory management
- **Observability**: Logging, metrics, and telemetry collection

### 2. Data Quality and Real-world Scenarios (`data-quality.test.ts`)

Focuses on data quality validation and realistic usage patterns:

- **Quality Gates**: Schema validation against golden standards
- **Deduplication**: Idempotency testing and hash collision detection
- **Real-world Scenarios**: Business listings, large venues, multi-location chains
- **Data Validation**: Schema compliance and constraint enforcement
- **Quality Metrics**: Completeness, validity, consistency, uniqueness scoring

### 3. Test Utilities (`test-utilities.ts`)

Comprehensive helper functions for test data generation and validation:

- **TestDataGenerator**: Generates realistic review data with various patterns
- **HTMLFixtureGenerator**: Creates Google Maps HTML fixtures for testing
- **CLITestUtilities**: Utilities for CLI interaction and file validation
- **DataValidationUtilities**: Schema validation and quality scoring

## Test Data Strategy

### Fixture-Based Testing

All tests use offline fixtures instead of hitting Google Maps directly:

```typescript
// Example: Using HTML fixtures for consistent testing
const fixtureUrl = `file://${path.join(process.cwd(), 'tests', 'fixtures', 'maps', 'case_minimal', 'index.html')}`;
```

### Golden Data Validation

Tests compare extracted data against golden reference files:

```typescript
// Validate against expected results
const goldenFile = path.join(process.cwd(), 'tests', 'golden', 'case_minimal.json');
```

### Multi-language Support

Tests include fixtures with reviews in multiple languages:
- English, Spanish, French, Arabic, Japanese, Korean, Chinese, Vietnamese

## Running E2E Tests

### Quick Start

```bash
# Run all E2E tests
npm run test:e2e

# Run with verbose output
npm run test:e2e:verbose

# Run specific test pattern
npm run test:e2e -- --pattern "cli-pipeline"

# Run with coverage
npm run test:e2e -- --coverage
```

### Advanced Options

```bash
# Run with custom timeout
npm run test:e2e -- --timeout 120000

# Run in parallel
npm run test:e2e -- --parallel

# Update snapshots
npm run test:e2e -- --update-snapshots

# Fail fast on first error
npm run test:e2e -- --fail-fast
```

## Environment Configuration

### Required Environment Variables

```bash
# Test mode settings
NODE_ENV=test
ARGUS_HEADFUL=false
ARGUS_LOG_LEVEL=error
ARGUS_TEST_MODE=true
ARGUS_TIMEOUT=30000
```

### Optional Test Configuration

```bash
# Browser settings
ARGUS_BROWSER_CHANNEL=chrome
ARGUS_BLOCK_RESOURCES=true

# Performance settings
ARGUS_MAX_REVIEWS=100
ARGUS_MAX_ROUNDS=5
ARGUS_CONCURRENCY=2

# Quality gates
ARGUS_STRICT_VALIDATION=true
ARGUS_REJECT_INVALID=true
```

## Test Scenarios

### High-Value Test Cases

1. **Pagination Deep**: Tests extraction of 500+ reviews across multiple pages
2. **I18n Mixed**: Multi-language reviews with Unicode and RTL text
3. **Owner Reply**: Review-response pairs and threading
4. **Dup Spam**: Duplicate detection and deduplication algorithms
5. **DOM Shift**: Robustness against CSS class and structure changes
6. **Rate Limit 429**: Exponential backoff and retry logic
7. **Network Flaky**: Timeout, reset, and resume scenarios
8. **Long Text**: Reviews with 10k+ characters and special encoding
9. **Timezone Mix**: Time normalization from various local times to UTC
10. **Large Dataset**: Performance testing with 10k-100k reviews

### Error Conditions

- Malformed JSON and HTML structures
- Invalid review data fields (ratings, dates, IDs)
- Network and I/O errors (timeouts, permissions, disk space)
- Memory pressure and resource exhaustion
- Browser automation edge cases (missing elements, JavaScript errors)

## Quality Metrics

### Coverage Targets

- **Global Coverage**: ≥80% lines/functions/branches
- **Critical Paths**: ≥90% coverage for parser and crawler components
- **E2E Coverage**: 100% of major user journeys

### Data Quality Scoring

```typescript
interface QualityScore {
    score: number;           // Overall quality score (0-1)
    metrics: {
        completeness: number; // Has required fields
        validity: number;     // Passes schema validation
        consistency: number;  // Data consistency across runs
        uniqueness: number;   // Deduplication effectiveness
    };
}
```

### Performance Targets

- **10k reviews**: < 60 seconds processing time
- **Memory usage**: < 500MB peak RAM on laptop hardware
- **Concurrency**: Support 2-5 parallel browser contexts
- **Throughput**: ≥100 reviews/minute with quality validation

## Artifacts and Reporting

### Test Artifacts

Generated in `.artifacts/e2e-test-data/`:
- Input fixtures and test data
- Output files (NDJSON, CSV, Parquet)
- Performance metrics and memory usage
- Log files with correlation IDs
- Coverage reports and quality scores

### Test Reports

Generated in `.artifacts/test-reports/`:
- HTML test report with detailed results
- JUnit XML for CI integration
- E2E summary with environment details
- Performance benchmarks and trends

## CI/CD Integration

### GitHub Actions

The E2E tests integrate with the existing CI pipeline:

```yaml
- name: Run E2E Tests
  run: npm run test:e2e
  timeout-minutes: 10

- name: Upload Test Artifacts
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: e2e-test-artifacts
    path: .artifacts/
```

### Quality Gates

- All E2E tests must pass for PR approval
- Coverage must meet minimum thresholds
- Performance regression detection
- Data quality score must be ≥0.8

## Troubleshooting

### Common Issues

1. **Browser not found**: Run `npx playwright install`
2. **Timeout errors**: Increase `ARGUS_TIMEOUT` or use `--timeout` flag
3. **Memory issues**: Reduce `ARGUS_CONCURRENCY` or enable garbage collection
4. **Fixture not found**: Ensure fixture files exist in `tests/fixtures/`

### Debug Mode

```bash
# Enable verbose logging
ARGUS_LOG_LEVEL=debug npm run test:e2e

# Show browser UI
ARGUS_HEADFUL=true npm run test:e2e

# Keep test artifacts
ARGUS_KEEP_ARTIFACTS=true npm run test:e2e
```

### Performance Debugging

```bash
# Enable memory monitoring
ARGUS_ENABLE_GC_MONITORING=true npm run test:e2e

# Track performance metrics
ARGUS_TRACK_PERFORMANCE=true npm run test:e2e

# Generate profiling data
node --prof tests/e2e/run-e2e-tests.ts
```

## Contributing

### Adding New Tests

1. Create test fixtures in `tests/fixtures/maps/`
2. Add corresponding golden data in `tests/golden/`
3. Write test cases following the established patterns
4. Update this documentation

### Best Practices

- Use descriptive test names that explain the scenario
- Include both positive and negative test cases
- Test edge cases and error conditions
- Validate both data structure and content quality
- Use realistic test data that mirrors production scenarios

### Code Review Checklist

- [ ] Tests are isolated and idempotent
- [ ] Fixtures don't contain real user data
- [ ] Error scenarios are properly tested
- [ ] Performance implications are considered
- [ ] Documentation is updated

## Related Documentation

- [Testing Blueprint](../../PATCH_NOTES.md#testing-framework)
- [Unit Tests](../unit/README.md)
- [Integration Tests](../integration/README.md)
- [Performance Tests](../performance/README.md)
- [CI/CD Pipeline](../../.github/workflows/comprehensive-testing.yml)

---

**Testing Philosophy**: _"Find maximum bugs and their root causes through comprehensive offline testing that mirrors real-world scenarios while maintaining fast, reliable execution."_