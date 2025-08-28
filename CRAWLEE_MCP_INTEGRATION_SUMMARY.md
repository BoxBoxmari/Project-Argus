# Crawlee MCP Integration Summary

## Overview

This document summarizes the implementation of the Crawlee MCP integration for Project Argus, which enhances the project with robust crawling capabilities including autoscaling, retries, proxy support, and dataset storage.

## Implementation Details

### 1. libs/runner-crawlee Workspace

Created a new workspace `@argus/runner-crawlee` with the following components:

- **Package Structure**:
  - `package.json` with dependencies on crawlee, playwright, and zod
  - `tsconfig.json` for TypeScript compilation
  - `src/index.ts` implementing the PlaywrightCrawler
  - `src/extractor.ts` containing shared extraction logic

- **Key Features**:
  - PlaywrightCrawler with autoscaling and robust retries
  - Proxy configuration support via `ARGUS_PROXY_URL`
  - Resource blocking for performance optimization
  - Dataset storage with configurable storage directory
  - Locale-aware selector mapping for internationalization

### 2. Shared Extraction Logic

Implemented shared extraction logic that can be used by both the userscript and Crawlee runner:

- **Selector Mapping**: JSON-based selector mapping with locale support (en-US, vi-VN)
- **Review Schema**: Zod-based validation schema for extracted reviews
- **Page Extraction**: Function to extract reviews from Google Maps pages

### 3. Environment Configuration

Added comprehensive environment variable support:

- `ARGUS_START_URLS` - Comma-separated list of URLs to crawl
- `ARGUS_PROXY_URL` - Proxy URL for requests
- `ARGUS_MAX_REQUESTS` - Maximum number of requests to crawl
- `ARGUS_LOCALE` - Locale for selector mapping
- `ARGUS_BLOCK_RESOURCES` - Block heavy resources for performance
- `CRAWLEE_STORAGE_DIR` - Directory for storing crawl data

### 4. Testing

Created comprehensive tests:

- **E2E Smoke Test**: `apps/e2e/tests/crawlee.smoke.spec.ts` for real-world testing
- **CI Integration**: Added `crawlee-smoke` job to `.github/workflows/ci.yml`

### 5. Documentation

Updated documentation:

- `HOWTO-RUN.md` - Added instructions for running the Crawlee runner
- `DIAGNOSIS.md` - Added information about the Crawlee MCP integration
- `apps/userscript/tools/mcp-selector-audit.md` - Documentation for MCP selector audit

## Technical Architecture

### Data Flow

1. **Input**: URLs from `ARGUS_START_URLS` or default test URL
2. **Processing**: PlaywrightCrawler navigates to URLs with configured settings
3. **Extraction**: Shared extractor function runs in page context to extract reviews
4. **Validation**: Zod schema validates extracted data
5. **Storage**: Valid data stored in Crawlee Dataset

### Key Components

- **PlaywrightCrawler**: Core crawling engine with autoscaling
- **ProxyConfiguration**: Optional proxy support
- **PreNavigationHooks**: Resource blocking for performance
- **RequestHandler**: Page processing and data extraction
- **FailedRequestHandler**: Error handling and retry management

## Benefits

1. **Robustness**: Autoscaling and retry mechanisms for reliable crawling
2. **Performance**: Resource blocking and concurrency control
3. **Flexibility**: Proxy support and configurable parameters
4. **Maintainability**: Shared extraction logic between userscript and Crawlee
5. **Observability**: Dataset storage for data analysis
6. **Internationalization**: Locale-aware selector mapping

## Usage

### Development

```bash
# Run in development mode
pnpm -C libs/runner-crawlee dev

# Build for production
pnpm -C libs/runner-crawlee build

# Run in production mode
pnpm -C libs/runner-crawlee start
```

### Testing

```bash
# Run E2E smoke test
pnpm -C apps/e2e test crawlee
```

## Future Improvements

1. **MCP Chrome Integration**: Full integration with MCP Chrome for DOM audit and selector discovery
2. **Advanced Proxy Support**: Rotating proxies and proxy pool management
3. **Enhanced Error Handling**: More sophisticated error categorization and handling
4. **Performance Monitoring**: Detailed metrics and performance tracking
5. **Data Enrichment**: Additional data extraction and enrichment capabilities
