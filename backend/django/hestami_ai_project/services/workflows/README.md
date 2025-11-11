# Service Provider Ingestion Workflow

This module implements the DBOS-orchestrated pipeline for processing service provider scraped data.

## Overview

The workflow converts `ServiceProviderScrapedData` entries into normalized `ServiceProvider` records through the following stages:

1. **HTML Extraction** - Calls html-chunker `/extract` endpoint to extract structured data
2. **Load Context** - Aggregates historical scraped data for the same provider
3. **Geo Normalization** - Normalizes service areas to structured county/state format
4. **Identity Resolution** - Matches against existing providers using weighted fuzzy matching
5. **Field Consolidation** - Merges data from multiple sources with provenance tracking
6. **Persistence** - Creates/updates `ServiceProvider` and `ProviderCategory` records
7. **Status Update** - Updates `scrape_status` and workflow metadata

## Components

### Workflow (`provider_ingestion.py`)

Main DBOS workflow class `ServiceProviderIngestionWorkflow` with decorated steps:
- `@DBOS.workflow()` - Main entry point `process_scraped_data()`
- `@DBOS.step()` - Individual workflow activities

### Geographic Normalization (`geo_utils.py`)

Utilities for normalizing service area labels:
- Hardcoded VA city-to-county mapping (interim solution)
- Handles independent cities (Alexandria, Fairfax City, etc.)
- Regional alias expansion (Northern Virginia, DMV, etc.)
- Output format: `{"normalized": {"counties": [...], "states": [...], "independent_cities": [...]}, "raw_tags": [...]}`

### Identity Resolution (`identity_resolution.py`)

Weighted fuzzy matching for provider identity:
- **Weights** (configurable at function level):
  - Company name: 40%
  - Phone: 30%
  - Website: 20%
  - License: 10%
- **Thresholds**:
  - Score ≥ 85%: Auto-link to existing provider
  - Score 70-84%: Pause for intervention (`scrape_status='paused_intervention'`)
  - Score < 70%: Auto-create new provider

## Celery Task

**Task**: `services.process_pending_service_provider_scraped_data`
- **Schedule**: Every 60 seconds (configurable via `SERVICE_PROVIDER_PROCESSOR_INTERVAL`)
- **Batch Size**: 1 record at a time (configurable via `SERVICE_PROVIDER_BATCH_SIZE`)
- **Processes**: Records with `scrape_status='pending'` or `'paused_intervention'`
- **Locking**: Uses Redis distributed locks to prevent duplicate processing

## Configuration

### Environment Variables

- `SERVICE_PROVIDER_BATCH_SIZE` (default: 1) - Number of records to process per task invocation
- `SERVICE_PROVIDER_PROCESSOR_INTERVAL` (default: 60) - Seconds between task runs
- `HTML_CHUNKER_URL` (default: http://html-chunker:8000) - HTML chunker API endpoint
- `HTML_CHUNKER_LLM` (default: ollama) - LLM provider
- `HTML_CHUNKER_MODEL` (default: qwen2.5:14b-instruct-q4_1) - LLM model
- `HTML_CHUNKER_MAX_TOKENS` (default: 24048) - Max tokens per chunk
- `HTML_CHUNKER_OVERLAP` (default: 0.1) - Chunk overlap percentage

### DBOS Configuration

DBOS is configured via `dbos-config.yaml` to use Django's PostgreSQL database with a separate `dbos` schema for state tracking.

## Intervention Workflow

When identity resolution is ambiguous (score 70-84%), the workflow:

1. Sets `scrape_status='paused_intervention'`
2. Populates `intervention_reason` with details of ambiguous matches
3. Pauses workflow execution

**Staff Resolution**:
1. Query Django database for records with `scrape_status='paused_intervention'`
2. Review `intervention_reason` field
3. Manually link `service_provider` FK to correct provider OR leave null to create new
4. Next Celery beat cycle will retry the workflow

## Data Model Changes

### ServiceProviderScrapedData

- `service_provider` - FK now nullable (`null=True, blank=True`)
- `scrape_status` - Added `'paused_intervention'` choice
- `intervention_reason` - TextField for intervention details
- `workflow_id` - CharField for DBOS workflow ID tracking

### ServiceProvider

- `service_area` - JSONField with structured geography format
- `enriched_sources` - JSONField array of source URLs/names
- `enriched_at` - DateTimeField for last enrichment timestamp
- `enrichment_metadata` - JSONField for additional context

## Setup & Initialization

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run Migrations

```bash
python manage.py migrate services
```

### 3. Initialize DBOS Schema

```bash
python manage.py init_dbos_schema
```

This creates the `dbos` schema in PostgreSQL for DBOS state tracking. DBOS will automatically create its internal tables on first startup.

### 4. Start Services

DBOS is automatically initialized when Django starts (in `services/apps.py`). The initialization:
- Connects to PostgreSQL using Django's database configuration
- Creates DBOS internal tables in the `dbos` schema
- Registers workflows and activities

**Note**: DBOS initialization is skipped for management commands like `migrate`, `makemigrations`, `collectstatic`, and `shell` to avoid conflicts.

## Usage

### Processing New Scraped Data

1. Create `ServiceProviderScrapedData` record with:
   - `raw_html` - HTML content from scraping
   - `source_name` - Source website name (e.g., 'Yelp', 'Angi')
   - `source_url` - URL of scraped page
   - `scrape_status='pending'`
   - `service_provider=None` (for new providers)

2. Celery task will pick up the record and launch DBOS workflow

3. Workflow processes the data and either:
   - Links to existing provider (high confidence match)
   - Creates new provider (low confidence or no match)
   - Pauses for intervention (ambiguous match)

### Monitoring

Query for workflow states:
```python
# Pending processing
ServiceProviderScrapedData.objects.filter(scrape_status='pending')

# Currently processing
ServiceProviderScrapedData.objects.filter(scrape_status='in_progress')

# Needs intervention
ServiceProviderScrapedData.objects.filter(scrape_status='paused_intervention')

# Failed
ServiceProviderScrapedData.objects.filter(scrape_status='failed')

# Completed
ServiceProviderScrapedData.objects.filter(scrape_status='completed')
```

## Future Enhancements

- Production-grade city↔county mapping via Azure Maps or curated dataset
- Enhanced fuzzy matching with phone and website fields
- Dedicated intervention UI/dashboard
- Automated category classification using ML
- Provenance display in UI
