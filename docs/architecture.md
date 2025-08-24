# Project Argus Architecture

## Overview

Project Argus is a monorepo designed for extracting, processing, and analyzing Google Maps review data. The architecture follows a modular approach with clear separation of concerns.

## Core Components

### 1. Data Extraction Layer

#### Userscript (`apps/userscript/`)

- **Purpose**: Browser-based data extraction using Tampermonkey
- **Technology**: TypeScript, esbuild
- **Output**: JSON files with review data
- **Use Case**: Manual data collection, small-scale extraction

#### Playwright Scraper (`apps/scraper-playwright/`)

- **Purpose**: Automated data extraction using Playwright
- **Technology**: TypeScript, Playwright
- **Output**: JSON files with review data
- **Use Case**: Large-scale automated extraction

### 2. Data Processing Layer

#### Python Ingest (`py/ingest/`)

- **Purpose**: Data normalization, validation, and transformation
- **Technology**: Python, pandas, pydantic
- **Input**: Raw JSON from extraction layer
- **Output**: Cleaned Parquet/CSV files
- **Features**: Schema validation, deduplication, quality control

#### Python Analysis (`py/analysis/`)

- **Purpose**: Exploratory data analysis and visualization
- **Technology**: Python, Jupyter, matplotlib, seaborn
- **Input**: Processed data from ingest layer
- **Output**: Analysis reports, visualizations

### 3. Shared Libraries

#### JavaScript Core (`libs/js-core/`)

- **Purpose**: Common utilities for JavaScript/TypeScript applications
- **Technology**: TypeScript
- **Features**: Text processing, data validation, utility functions

## Data Flow

```text
[Google Maps] → [Extraction Layer] → [Raw JSON] → [Processing Layer] → [Clean Data] → [Analysis]
```

### Extraction Process

1. Navigate to Google Maps place
2. Open reviews section
3. Scroll to load reviews
4. Extract review elements
5. Parse and structure data
6. Save to JSON format

### Processing Process

1. Load raw JSON data
2. Validate against schema
3. Normalize data structure
4. Remove duplicates
5. Quality control checks
6. Export to target format

## Technology Stack

### Frontend/Extraction

- **TypeScript**: Type-safe JavaScript development
- **esbuild**: Fast bundling for userscript
- **Playwright**: Reliable browser automation

### Backend/Processing

- **Python 3.11+**: Data processing and analysis
- **pandas**: Data manipulation and analysis
- **pydantic**: Data validation and serialization
- **uv**: Fast Python package management

### Development Tools

- **pnpm**: Fast, disk space efficient package manager
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **PowerShell**: Windows automation scripts

## Configuration Management

### Environment Variables

- `ARGUS_BROWSER_CHANNEL`: Browser to use for scraping
- `ARGUS_TEST_URL`: Default test URL
- `ARGUS_MAX_ROUNDS`: Maximum scroll rounds
- `ARGUS_RATE_LIMIT_PER_SEC`: Rate limiting for API calls

### Build Configuration

- **TypeScript**: Strict mode, ES2022 target
- **esbuild**: Bundle optimization for userscript
- **Python**: Virtual environments per module

## Security Considerations

### Data Privacy

- No personal information stored in repository
- Local data storage only
- Respectful of Google Maps ToS

### Rate Limiting

- Configurable delays between requests
- Respectful scraping practices
- Error handling and retry logic

## Scalability

### Horizontal Scaling

- Multiple scraper instances
- Queue-based job processing
- Distributed data processing

### Performance Optimization

- Streaming data processing
- Efficient data formats (Parquet)
- Parallel processing capabilities

## Monitoring and Observability

### Logging

- Structured JSON logging
- Different log levels (INFO, WARN, ERROR)
- Log rotation and management

### Metrics

- Extraction success rates
- Processing performance
- Data quality metrics

## Future Enhancements

### Planned Features

- Real-time data streaming
- Advanced analytics dashboard
- Machine learning insights
- API endpoints for data access

### Technical Improvements

- GraphQL API layer
- Real-time processing with Apache Kafka
- Advanced caching strategies
- Multi-cloud deployment support
