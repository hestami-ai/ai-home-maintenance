# Service Provider Scraped Data Processing (DBOS-Orchestrated)

## 1. Objectives
- Normalize and enrich `ServiceProviderScrapedData` records so staff can trust roster recommendations.
- Auto-create or update `ServiceProvider` and related entities from aggregated scrape sources.
- Support "Add Provider to Roster" for both existing providers and new, scraped entries.
- Provide intervention mechanism for ambiguous identity matches requiring manual staff resolution.

## 2. High-Level Flow
1. **Scrape completion** – Scraper writes a `ServiceProviderScrapedData` row with `scrape_status="pending"`, nullable `service_provider` FK, and payloads (@backend/django/hestami_ai_project/services/models/base_models.py#52-109).
2. **Trigger** – A new Celery task scans for `pending` entries (batch size configurable, default 1), marks each `in_progress`, and starts a DBOS workflow (new task to be added in `services/tasks.py`).
3. **DBOS workflow** – Orchestrates HTML extraction via `/extract` endpoint, aggregation, geo normalization, identity resolution, field consolidation, and persistence; updates `scrape_status` to `completed`, `failed`, or `paused_intervention` on each scraped record.
4. **Roster UI** – Modal fetches enriched provider records for selection; onboarding a new provider submits raw data, displays background-processing status, then exposes the canonical provider once the workflow finishes.

## 3. Detailed Components

### 3.1 Celery Task
- **Location**: `services/tasks.py` (new function `process_pending_service_provider_scraped_data`).
- **Responsibilities**:
  - Batch poll `ServiceProviderScrapedData` with `scrape_status="pending"` or `scrape_status="paused_intervention"` (for retry).
  - Lock/prevent duplicate launches, set each record to `in_progress`.
  - Invoke the DBOS workflow using its Python decorator/SDK, passing scraped record IDs.
- **Configuration**:
  - `SERVICE_PROVIDER_BATCH_SIZE` (default: 1) – number of records to process per task invocation.
  - Added to `CELERY_BEAT_SCHEDULE` in `settings.py` for periodic execution.
  - Reuse existing Django `DATABASE_URL` for DBOS state tracking (separate `dbos` schema).

### 3.2 DBOS Workflow
- **Location**: `backend/django/hestami_ai_project/services/workflows/` (new module within Django project).
- **Workflow class**: `ServiceProviderIngestionWorkflow` defined using DBOS Python decorators.
- **Stages / Activities**:
  1. **HTML Extraction** – Call html-chunker `/extract` endpoint with `raw_html` to populate/validate `processed_data` field.
  2. **Load scraped data** – Collect the target `ServiceProviderScrapedData` entries and any prior ones for the same provider/company for context.
  3. **Geo normalization** – Convert service-area labels to counties/states using hardcoded VA city mapping (Alexandria, Fairfax, etc.). Emit structured format: `{"normalized": {"counties": [...], "states": [...], "independent_cities": [...]}, "raw_tags": [...]}`.
  4. **Identity resolution** – Use weighted fuzzy matching (RapidFuzz) with configurable weights (business_name: 40%, phone: 30%, website: 20%, license: 10%). Thresholds:
     - Score ≥ 85%: Auto-link to existing provider
     - Score 70-84%: Set `scrape_status="paused_intervention"` with `intervention_reason` explaining ambiguous matches
     - Score < 70%: Auto-create new provider
  5. **Field consolidation** – Merge `business_info`, services, licenses, reviews, awards, preferring richer data while recording provenance metadata.
  6. **Persistence** – Create/update `ServiceProvider` (@backend/django/hestami_ai_project/services/models/base_models.py#27-50), automatically create `ProviderCategory` links based on scraped services. Track provenance (`enriched_sources`, `enriched_at`, `enrichment_metadata`).
  7. **Status update** – Write back `scrape_status="completed"`, `"failed"`, or `"paused_intervention"` and populate `error_message` or `intervention_reason` when necessary.
- **Failure handling**:
  - Ambiguous identity matches → `scrape_status="paused_intervention"` with detailed `intervention_reason`.
  - Staff resolves by updating Django fields; next Celery beat cycle retries.
  - HTML chunker failures or other errors → `scrape_status="failed"` with `error_message`.

### 3.3 Data Modeling Enhancements
- **ServiceProviderScrapedData**:
  - Make `service_provider` FK nullable to support scraped data without initial provider link.
  - Add `scrape_status` choice: `"paused_intervention"` for workflow intervention state.
  - Add `intervention_reason` TextField for explaining why manual resolution is needed.
  - Add `workflow_id` CharField to store DBOS workflow ID for tracking.
- **ServiceProvider**:
  - Ensure `service_area` JSONField captures normalized geography: `{"normalized": {"counties": [...], "states": [...], "independent_cities": [...]}, "raw_tags": [...]}`.
  - Add provenance fields:
    - `enriched_sources` (JSONField) – array of source URLs/names that contributed to this provider.
    - `enriched_at` (DateTimeField) – last enrichment timestamp.
    - `enrichment_metadata` (JSONField) – additional context (e.g., confidence scores, merge history).
- **ProviderCategory**: Automatically created/linked based on scraped services data.
- Future tables to consider: `GeographicArea` lookup for counties/cities, `ProviderIdentityLink` for mapping scrape sources to canonical provider IDs.

### 3.4 Add Provider to Roster Modal
- **Existing provider mode** – Filterable list using normalized geography, categories, availability, ratings.
- **New provider mode** – Capture raw snippets; submit to create a `ServiceProviderScrapedData` row (`pending`), show background progress, and surface the canonical provider once the DBOS workflow completes.

## 4. External Services & Dependencies
- **HTML Chunker** – `/extract` endpoint called directly from DBOS workflow activities.
- **City↔County data** – Hardcoded VA city mapping as interim solution; defer to future Azure Maps/geocoder integration or curated dataset.
- **Fuzzy matching** – RapidFuzz library with configurable weights (default: business_name 40%, phone 30%, website 20%, license 10%).
- **LLM rate limits** – Celery batch size (default 1) and DBOS concurrency controls to manage external LLM/API quotas.
- **Dependencies**:
  - `dbos==2.3.0` (DBOS Python SDK)
  - `rapidfuzz>=3.0.0` (fuzzy string matching)

## 5. Deployment & Ops
- **Configuration**:
  - `SERVICE_PROVIDER_BATCH_SIZE` (default: 1) – Celery task batch size.
  - `DATABASE_URL` – Reused for DBOS state tracking (separate `dbos` schema).
  - Fuzzy match thresholds defined at function level (configurable in code).
- **Logging/Monitoring**:
  - Mirror logging practices from existing backend tasks.
  - Capture metrics for `pending / in_progress / completed / paused_intervention / failed` counts.
  - Track intervention reasons for staff visibility.
- **Observability**:
  - Staff query Django database for `scrape_status="paused_intervention"` to identify workflows needing manual resolution.
  - DBOS internal state tracked in separate `dbos` schema for workflow execution details.
- **Celery Beat**: New task added to `CELERY_BEAT_SCHEDULE` in `settings.py`.

## 6. Implementation Decisions
- **DBOS Location**: Workflows defined in `backend/django/hestami_ai_project/services/workflows/` within Django project.
- **Intervention UI**: No dedicated UI; staff update Django fields directly via admin or database.
- **Retry Mechanism**: Next Celery beat cycle picks up `paused_intervention` records after staff resolution.
- **ProviderCategory Creation**: Automatic based on scraped services data.

## 7. Open Items / Deferred Decisions
- Authoritative geographic reference data source (currently hardcoded VA cities).
- UI display of provenance/audit details.
- Final approach for handling partially processed providers (deferred per user guidance).
- Dedicated intervention UI/dashboard (currently using Django admin).
