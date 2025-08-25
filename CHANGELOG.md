# Changelog

All notable changes to Project Argus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Advanced Request Queue & Autoscaling System

### 🔧 Enhanced

- **Python Ingest Pipeline**: Simplified processor.py to remove external dependencies (pandas, pydantic) and standardize the ingest pipeline
- **Go Orchestrator Service**: Added simple Go service for queue processing and metrics export preparation
- **PowerShell Automation**: Updated setup script for streamlined Node.js and pnpm workspace management
- **CI/CD Pipeline**: Simplified GitHub Actions workflow to avoid hashFiles warnings and improve robustness
- **Repository Structure**: Added specs/ directory with JSON schemas for queue items and scraping results
- **Data Directory**: Created datasets/ directory with .gitkeep for local data storage (gitignored)
- **Seed URLs**: Added sample seed URLs file for testing the scraper system

### 🚀 Added

- **Advanced Request Queue System** (`libs/js-core/src/request-queue.ts`)
  - Persistent NDJSON storage for request items
  - Idempotent operations via uniqueKey
  - Priority-based queuing with domain-aware concurrency limits
  - Automatic domain extraction and rate limiting
  - Comprehensive state management (queued, in-progress, handled, failed)
  - Retry mechanism with configurable attempts
  - Real-time statistics and monitoring

- **Intelligent Autoscaling Pool** (`libs/js-core/src/autoscale.ts`)
  - CPU usage monitoring with configurable thresholds
  - Event loop delay detection and optimization
  - Dynamic concurrency adjustment based on system load
  - Configurable min/max concurrency bounds
  - Performance metrics collection and reporting
  - Graceful shutdown and resource cleanup

- **Advanced Retry Mechanism** (`libs/js-core/src/retry.ts`)
  - Exponential backoff with configurable factors
  - Jitter addition to prevent thundering herd
  - Predefined retry strategies for common scenarios:
    - `rateLimit`: 5 retries, 1s base delay, 10s cap
    - `network`: 3 retries, 500ms base delay, 5s cap
    - `serverError`: 3 retries, 2s base delay, 20s cap
    - `aggressive`: 10 retries, 100ms base delay, 1s cap
  - Custom retry logic with `shouldRetry` callbacks
  - Comprehensive error handling with `RetryError` class

- **Domain-Aware Rate Limiting** (`libs/js-core/src/domain-utils.ts`)
  - Intelligent domain extraction from URLs
  - Subdomain and base domain identification
  - Predefined rate limits for Google services:
    - `google.com`: 1 req/sec, 30 req/min, burst size 3
    - `maps.google.com`: 0.5 req/sec, 20 req/min, burst size 2
  - Default rate limits for unknown domains
  - Burst size management and cooldown periods
  - Rate limit delay calculations

- **Integrated Scraper Orchestrator** (`libs/js-core/src/scraper-orchestrator.ts`)
  - Unified interface combining all components
  - Abstract base class for custom scrapers
  - Automatic queue management and autoscaling
  - Comprehensive logging and monitoring
  - Result persistence in NDJSON format
  - Graceful error handling and recovery

- **JSON Schema Contracts** (`specs/`)
  - `queue.schema.json`: Request queue item validation
  - `scraping-result.schema.json`: Scraping result validation
  - Comprehensive property definitions and constraints
  - Conditional validation logic for success/failure states

- **Comprehensive Test Suite** (`libs/js-core/src/__tests__/`)
  - Unit tests for all new components
  - Mock implementations and edge case coverage
  - Performance testing for autoscaling
  - Error scenario validation
  - Integration test examples

- **Example Usage & Documentation** (`libs/js-core/src/example-usage.ts`)
  - Complete working examples of all features
  - Google Maps scraper implementation
  - Queue management demonstrations
  - Autoscaling pool examples
  - Retry mechanism showcases
  - Full orchestrator integration

### 🔧 Enhanced 1

- **Monorepo Structure**: Added advanced JavaScript core library
- **Type Safety**: Comprehensive TypeScript interfaces and types
- **Error Handling**: Robust error handling with custom error classes
- **Performance**: Optimized algorithms for high-throughput scenarios
- **Monitoring**: Built-in metrics and statistics collection

### 🏗️ Architecture Improvements

- **Queue as Source of Truth**: All components read/write through the persistent queue
- **Domain Isolation**: Rate limiting prevents cross-domain interference
- **Idempotent Operations**: Safe retry and recovery mechanisms
- **Resource Management**: Automatic scaling based on system capacity
- **Data Persistence**: NDJSON format for easy processing and analysis

### 📊 Performance Features

- **Concurrent Processing**: Configurable concurrency with autoscaling
- **Rate Limiting**: Domain-aware rate limiting to prevent blocking
- **Resource Optimization**: CPU and event loop monitoring
- **Efficient Storage**: NDJSON format for streaming and processing
- **Memory Management**: Configurable memory limits and cleanup

### 🛡️ Reliability Features

- **Fault Tolerance**: Comprehensive retry mechanisms
- **Data Integrity**: Idempotent operations and validation
- **Graceful Degradation**: Automatic fallback and recovery
- **Monitoring**: Real-time statistics and health checks
- **Logging**: Comprehensive logging for debugging and audit

### 🔍 Monitoring & Observability

- **Real-time Stats**: Queue status, processing rates, error counts
- **Performance Metrics**: CPU usage, event loop delays, concurrency levels
- **Error Tracking**: Detailed error logging with context
- **Health Checks**: System health monitoring and alerts
- **Audit Trail**: Complete request lifecycle tracking

## [0.2.0] - Monorepo Restructuring

### 🚀 Added 1

- **Clean Monorepo Structure**
  - `apps/userscript/` - Tampermonkey bundle with TypeScript
  - `apps/scraper-playwright/` - Playwright-based scraper
  - `libs/js-core/` - Shared JavaScript utilities
  - `py/ingest/` - Python data processing module
  - `py/analysis/` - Python analysis tools
  - `scripts/ps/` - PowerShell automation scripts
  - `specs/` - JSON schemas and contracts
  - `docs/` - Comprehensive documentation

- **Modern Development Tools**
  - pnpm workspace management
  - TypeScript with strict configuration
  - ESLint and Prettier for code quality
  - GitHub Actions CI/CD pipeline
  - Comprehensive .gitignore and .gitattributes

- **PowerShell Automation**
  - `cleanup.ps1` - Development artifact cleanup
  - `setup.ps1` - Environment setup and dependency installation
  - `repo-hardening.ps1` - Repository health verification

### 🔧 Enhanced 2

- **Repository Organization**: Logical grouping of related functionality
- **Build System**: Standardized build processes across packages
- **Code Quality**: Automated linting and formatting
- **Documentation**: Comprehensive README and architecture docs
- **CI/CD**: Automated testing and validation

## [0.1.0] - Initial Release

### 🚀 Added 2

- Basic Google Maps review extraction
- Simple web scraping capabilities
- Basic data processing pipeline

---

## Development Notes

### Breaking Changes

- **v0.2.0**: Complete repository restructuring - all file paths changed
- **v0.3.0**: New advanced queue system replaces simple scraping logic

### Migration Guide

- See `docs/migration-guide.md` for detailed migration instructions
- Use PowerShell scripts for automated setup and cleanup
- Follow new monorepo structure for development

### Testing

- Run `pnpm -w run test` for JavaScript/TypeScript tests
- Run `uv run pytest` in Python modules for Python tests
- Use `scripts/ps/setup.ps1` for environment setup

### Performance Considerations

- Queue system designed for high-throughput scenarios
- Autoscaling prevents resource exhaustion
- Rate limiting prevents service blocking
- NDJSON format enables streaming processing

### Security Features

- Domain isolation prevents cross-site interference
- Rate limiting prevents abuse
- Input validation via JSON schemas
- Secure error handling without information leakage
