# Service Provider Scraped Data Processing (DBOS-Orchestrated)

## 1. Objectives
- Normalize and enrich `ServiceProviderScrapedData` records so staff can trust roster recommendations.
- Auto-create or update `ServiceProvider` and related entities from aggregated scrape sources.
- Support "Add Provider to Roster" for both existing providers and new, scraped entries.

## 2. High-Level Flow
1. **Scrape completion** – Scraper writes a `ServiceProviderScrapedData` row with `scrape_status="pending"` and payloads (@backend/django/hestami_ai_project/services/models/base_models.py#52-109).
2. **Trigger** – A new Celery task scans for `pending` entries, marks each `in_progress`, and starts a DBOS workflow (new task to be added in `services/tasks.py`).
3. **DBOS workflow** – Orchestrates aggregation, normalization, identity resolution, field consolidation, and persistence; updates `scrape_status` to `completed` or `failed` on each scraped record.
4. **Roster UI** – Modal fetches enriched provider records for selection; onboarding a new provider submits raw data, displays background-processing status, then exposes the canonical provider once the workflow finishes.

## 3. Detailed Components

### 3.1 Celery Task
- **Location**: `services/tasks.py` (new function).
- **Responsibilities**:
  - Batch poll `ServiceProviderScrapedData` with `scrape_status="pending"`.
  - Lock/prevent duplicate launches, set each record to `in_progress`.
  - Invoke the DBOS workflow using its Python client/SDK, passing scraped record IDs (throttled as needed for external resource limits).
- **Configuration**:
  - Reuse existing env-driven patterns (endpoints, batch sizes) and align with DBOS runtime expectations.

### 3.2 DBOS Workflow
- **Workflow class**: `ServiceProviderIngestionWorkflow` (placeholder name) defined in the DBOS project space.
- **Stages / Activities**:
  1. **Load scraped data** – Collect the target `ServiceProviderScrapedData` entries and any prior ones for the same provider/company for context.
  2. **Geo normalization** – Convert service-area labels to counties/states. Account for independent cities (e.g., Alexandria, VA). Authoritative lookup (Azure Maps or curated dataset) is a future enhancement.
  3. **Identity resolution** – Use weighted fuzzy matching (e.g., RapidFuzz) across company name, phone, website, license IDs; high-confidence matches auto-merge, ambiguous cases raise workflow interventions.
  4. **Field consolidation** – Merge `business_info`, services, reviews, awards, etc., preferring richer data while recording provenance metadata.
  5. **Persistence** – Create/update `ServiceProvider` (@backend/django/hestami_ai_project/services/models/base_models.py#27-50) and related tables such as `ProviderCategory`. Track aggregated provenance and last enrichment timestamp.
  6. **Status update** – Write back `scrape_status="completed"` or `"failed"` and populate `error_message` when necessary.
- **Failure handling**:
  - Leverage DBOS intervention/compensation features for blocking issues (e.g., conflicting matches). Non-critical issues can fall back to staff review later.

### 3.3 Data Modeling Enhancements
- Ensure `ServiceProvider.service_area` captures normalized counties/states alongside free-form tags.
- Future tables to consider: `GeographicArea` lookup for counties/cities, `ProviderIdentityLink` for mapping scrape sources to canonical provider IDs.

### 3.4 Add Provider to Roster Modal
- **Existing provider mode** – Filterable list using normalized geography, categories, availability, ratings.
- **New provider mode** – Capture raw snippets; submit to create a `ServiceProviderScrapedData` row (`pending`), show background progress, and surface the canonical provider once the DBOS workflow completes.

## 4. External Services & Future Considerations
- **City↔County data** – Placeholder step; defer to future Azure Maps/geocoder integration or curated dataset.
- **Fuzzy matching** – Evaluate RapidFuzz or similar, define weighting for name, phone, website, licenses.
- **LLM rate limits** – Celery throttling or DBOS concurrency controls to manage external LLM/API quotas.

## 5. Deployment & Ops
- **Configuration** – New env vars for DBOS workflow endpoints, batch size, concurrency caps.
- **Logging/Monitoring** – Mirror logging practices from existing backend tasks; capture metrics for `pending / in_progress / completed` and intervention counts.
- **Observability** – DBOS dashboards for workflow state, with alerts on repeated failures.

## 6. Open Items / Deferred Decisions
- Authoritative geographic reference data source.
- Precise fuzzy-matching weights and thresholds.
- UI display of provenance/audit details.
- Final approach for handling partially processed providers (deferred per user guidance).
