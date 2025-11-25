# Service Provider Ingestion Pipeline - Implementation Summary

**Date**: November 4, 2025  
**Status**: ✅ Complete - Ready for Testing

---

## Overview

Implemented a complete DBOS-orchestrated pipeline for processing service provider scraped data. The system automatically converts raw HTML scraped data into normalized `ServiceProvider` records with intelligent identity resolution, geographic normalization, and intervention workflows for ambiguous cases.

---

## What Was Implemented

### 1. ✅ Data Model Updates

**Files Modified**:
- `backend/django/hestami_ai_project/services/models/base_models.py`
- `backend/django/hestami_ai_project/services/migrations/0018_add_provider_enrichment_and_intervention_fields.py`

**Changes**:

**ServiceProviderScrapedData**:
- Made `service_provider` FK nullable for new scraped data
- Added `paused_intervention` status choice
- Added `intervention_reason` TextField
- Added `workflow_id` CharField for DBOS tracking
- Removed `unique_together` constraint

**ServiceProvider**:
- Added `enriched_sources` JSONField (provenance tracking)
- Added `enriched_at` DateTimeField
- Added `enrichment_metadata` JSONField
- Updated `service_area` structure for normalized geography

### 2. ✅ DBOS Workflow Implementation

**Files Created**:
- `backend/django/hestami_ai_project/services/workflows/__init__.py`
- `backend/django/hestami_ai_project/services/workflows/provider_ingestion.py`
- `backend/django/hestami_ai_project/services/workflows/geo_utils.py`
- `backend/django/hestami_ai_project/services/workflows/identity_resolution.py`
- `backend/django/hestami_ai_project/services/workflows/README.md`
- `backend/django/hestami_ai_project/services/workflows/TROUBLESHOOTING.md`

**Workflow Stages**:
1. **HTML Extraction** - Calls html-chunker `/extract` endpoint
2. **Load Context** - Aggregates historical scraped data
3. **Geo Normalization** - Normalizes service areas (VA cities → counties)
4. **Identity Resolution** - Weighted fuzzy matching (85%+ auto-link, 70-84% intervene, <70% create)
5. **Field Consolidation** - Merges data with provenance tracking
6. **Persistence** - Creates/updates ServiceProvider and ProviderCategory
7. **Status Update** - Updates scrape_status and workflow metadata

**Key Features**:
- Hardcoded VA city-to-county mapping (Alexandria, Fairfax, etc.)
- Regional alias expansion (Northern Virginia, DMV, etc.)
- Weighted fuzzy matching (business_name: 40%, phone: 30%, website: 20%, license: 10%)
- Automatic ProviderCategory creation based on services offered
- Intervention workflow for ambiguous identity matches

### 3. ✅ DBOS Initialization

**Files Created**:
- `backend/django/hestami_ai_project/services/dbos_init.py`
- `backend/django/hestami_ai_project/dbos-config.yaml`
- `backend/django/hestami_ai_project/services/management/commands/init_dbos_schema.py`

**Files Modified**:
- `backend/django/hestami_ai_project/services/apps.py`

**Implementation**:
- DBOS initializes automatically when Django starts (in `ServicesConfig.ready()`)
- Uses Django's PostgreSQL database with separate `dbos` schema
- Skips initialization for management commands (migrate, makemigrations, etc.)
- Graceful error handling - app starts even if DBOS initialization fails
- Management command to create DBOS schema: `python manage.py init_dbos_schema`

### 4. ✅ Celery Task Integration

**Files Modified**:
- `backend/django/hestami_ai_project/services/tasks.py`
- `backend/django/hestami_ai_project/hestami_ai/settings.py`

**Task**: `process_pending_service_provider_scraped_data`
- Processes records with `scrape_status='pending'` or `'paused_intervention'`
- Configurable batch size (default: 1 via `SERVICE_PROVIDER_BATCH_SIZE`)
- Redis distributed locking to prevent duplicate processing
- Scheduled via Celery Beat (every 60 seconds via `SERVICE_PROVIDER_PROCESSOR_INTERVAL`)

**Beat Schedule**:
```python
'process-pending-service-provider-scraped-data': {
    'task': 'services.process_pending_service_provider_scraped_data',
    'schedule': 60.0,  # seconds
}
```

### 5. ✅ Dependencies

**Files Modified**:
- `backend/django/hestami_ai_project/requirements.txt`

**Added**:
- `rapidfuzz>=3.0.0` - Fuzzy string matching
- `dbos==2.3.0` - DBOS Python SDK (already added by user)

### 6. ✅ Documentation

**Files Created**:
- `docs/hestami-ai/docs/service-provider-ingestion-design.md` (updated)
- `docs/hestami-ai/docs/service-provider-ingestion-roadmap.md` (updated)
- `backend/django/hestami_ai_project/services/workflows/README.md`
- `backend/django/hestami_ai_project/services/workflows/TROUBLESHOOTING.md`
- `IMPLEMENTATION_SUMMARY.md` (this file)

---

## Configuration

### Environment Variables

```bash
# Service Provider Processing
SERVICE_PROVIDER_BATCH_SIZE=1  # Records per task invocation
SERVICE_PROVIDER_PROCESSOR_INTERVAL=60  # Seconds between task runs

# HTML Chunker (already configured)
HTML_CHUNKER_URL=http://html-chunker:8000
HTML_CHUNKER_LLM=ollama
HTML_CHUNKER_MODEL=qwen2.5:14b-instruct-q4_1
HTML_CHUNKER_MAX_TOKENS=24048
HTML_CHUNKER_OVERLAP=0.1
HTML_CHUNKER_LOG_LEVEL=INFO

# DBOS (optional)
DBOS_LOG_LEVEL=INFO

# Database (already configured)
SQL_HOST=postgres
SQL_PORT=5432
SQL_USER=postgres
SQL_PASSWORD=<password>
SQL_DATABASE=hestami_ai
```

---

## Deployment Steps

### 1. Install Dependencies

```bash
cd backend/django/hestami_ai_project
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

This creates the `dbos` schema in PostgreSQL for DBOS state tracking.

### 4. Restart Services

```bash
# If using Docker Compose
docker-compose restart django celery celery-beat

# Or restart individual containers
docker restart django-container
docker restart celery-container
docker restart celery-beat-container
```

### 5. Verify Initialization

Check logs for successful DBOS initialization:

```bash
docker logs django-container | grep "DBOS initialized"
# Should see: "DBOS initialized successfully"
```

---

## Testing

### Create Test Scraped Data

```python
from services.models import ServiceProviderScrapedData

# Create a test record
scraped = ServiceProviderScrapedData.objects.create(
    source_name='Yelp',
    source_url='https://www.yelp.com/biz/test-provider',
    raw_html='<html>...</html>',  # Raw HTML from scraping
    scrape_status='pending',
    service_provider=None  # Null for new providers
)

print(f"Created scraped data: {scraped.id}")
```

### Monitor Processing

```python
from services.models import ServiceProviderScrapedData

# Check status
record = ServiceProviderScrapedData.objects.get(id='<uuid>')
print(f"Status: {record.scrape_status}")
print(f"Workflow ID: {record.workflow_id}")

# If paused for intervention
if record.scrape_status == 'paused_intervention':
    print(f"Reason: {record.intervention_reason}")
```

### View Results

```python
from services.models import ServiceProvider

# Check created/updated providers
provider = ServiceProvider.objects.latest('enriched_at')
print(f"Provider: {provider.business_name}")
print(f"Service Area: {provider.service_area}")
print(f"Sources: {provider.enriched_sources}")
print(f"Categories: {provider.providercategory_set.all()}")
```

---

## Workflow Flow

```
1. Scraper creates ServiceProviderScrapedData (scrape_status='pending')
   ↓
2. Celery Beat triggers task every 60 seconds
   ↓
3. Task picks up pending records (batch size: 1)
   ↓
4. DBOS workflow processes:
   - Extracts HTML via html-chunker
   - Normalizes geography (VA cities → counties)
   - Resolves identity (fuzzy matching)
   ↓
5a. High confidence (≥85%): Auto-link to existing provider
5b. Ambiguous (70-84%): Pause for intervention
5c. Low confidence (<70%): Create new provider
   ↓
6. Consolidates data, creates ProviderCategory links
   ↓
7. Updates scrape_status to 'completed' or 'paused_intervention'
```

---

## Intervention Workflow

When identity resolution is ambiguous (70-84% match):

1. **Workflow pauses** and sets:
   - `scrape_status='paused_intervention'`
   - `intervention_reason` with details of ambiguous matches

2. **Staff reviews** via Django admin or database query:
   ```python
   ServiceProviderScrapedData.objects.filter(scrape_status='paused_intervention')
   ```

3. **Staff resolves** by either:
   - Linking `service_provider` FK to correct provider
   - Leaving `service_provider=None` to create new provider
   - Changing `scrape_status='pending'` to retry

4. **Next Celery beat cycle** picks up and retries the workflow

---

## Monitoring

### Status Distribution

```python
from services.models import ServiceProviderScrapedData
from django.db.models import Count

ServiceProviderScrapedData.objects.values('scrape_status').annotate(
    count=Count('id')
)
```

### Recent Failures

```python
from django.utils import timezone
from datetime import timedelta

ServiceProviderScrapedData.objects.filter(
    scrape_status='failed',
    last_scraped_at__gte=timezone.now() - timedelta(hours=24)
)
```

### Intervention Cases

```python
ServiceProviderScrapedData.objects.filter(
    scrape_status='paused_intervention'
).select_related('service_provider')
```

---

## Known Limitations

1. **Geographic Normalization**: Hardcoded VA cities only. Future: Azure Maps integration.
2. **Phone/Website Matching**: Stubbed in identity resolution (ServiceProvider model doesn't have these fields yet).
3. **Category Mapping**: Simple keyword-based. Future: ML-based classification.
4. **UI Integration**: Deferred (Workstream 5 in roadmap).
5. **Intervention UI**: No dedicated dashboard - staff use Django admin.

---

## Next Steps (Optional Enhancements)

1. **Add Phone/Website Fields** to ServiceProvider model for better identity resolution
2. **Integrate Azure Maps** for authoritative city↔county mapping
3. **Build Intervention UI** for staff to review ambiguous matches
4. **Add ML-based Category Classification** for automatic service categorization
5. **Implement UI Integration** (Add Provider to Roster modal)
6. **Add Metrics Dashboard** for monitoring workflow performance
7. **Create Test Fixtures** for automated validation

---

## Files Changed Summary

### Created (20 files)
- `services/workflows/__init__.py`
- `services/workflows/provider_ingestion.py`
- `services/workflows/geo_utils.py`
- `services/workflows/identity_resolution.py`
- `services/workflows/README.md`
- `services/workflows/TROUBLESHOOTING.md`
- `services/dbos_init.py`
- `services/management/commands/init_dbos_schema.py`
- `services/migrations/0018_add_provider_enrichment_and_intervention_fields.py`
- `dbos-config.yaml`
- `docs/hestami-ai/docs/service-provider-ingestion-design.md` (updated)
- `docs/hestami-ai/docs/service-provider-ingestion-roadmap.md` (updated)
- `IMPLEMENTATION_SUMMARY.md`

### Modified (4 files)
- `services/models/base_models.py`
- `services/tasks.py`
- `services/apps.py`
- `hestami_ai/settings.py`
- `requirements.txt`

---

## Support

For troubleshooting, see:
- `backend/django/hestami_ai_project/services/workflows/TROUBLESHOOTING.md`
- `backend/django/hestami_ai_project/services/workflows/README.md`

For questions about DBOS:
- https://docs.dbos.dev/

---

**Implementation Complete** ✅  
Ready for testing and deployment!
