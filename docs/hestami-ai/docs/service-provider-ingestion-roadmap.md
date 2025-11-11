# Service Provider Scraped Data Processing – Implementation Roadmap

## Goal
Deliver the DBOS-orchestrated pipeline that converts `ServiceProviderScrapedData` entries into normalized `ServiceProvider` records and powers the “Add Provider to Roster” workflow. This roadmap mirrors the design in `service-provider-ingestion-design.md` and is structured for execution by an automation-focused engineering agent (no sprint timelines).

## Workstream 1 – Triggering & Orchestration hook
1. Add a Celery task `process_pending_service_provider_scraped_data` in `services/tasks.py` that:
   - Batches `ServiceProviderScrapedData` with `scrape_status="pending"` or `"paused_intervention"`.
   - Batch size configurable via `SERVICE_PROVIDER_BATCH_SIZE` env var (default: 1).
   - Applies locking / idempotency guard and marks rows `in_progress`.
   - Invokes the DBOS workflow with relevant identifiers and metadata.
2. Add task to `CELERY_BEAT_SCHEDULE` in `settings.py` for periodic execution.
3. Add `rapidfuzz>=3.0.0` to `requirements.txt` for fuzzy matching.
4. Document task invocation contract for other services that may seed scraped data.

## Workstream 2 – DBOS Workflow Skeleton
1. Create `backend/django/hestami_ai_project/services/workflows/` module within Django project.
2. Scaffold `ServiceProviderIngestionWorkflow` using DBOS Python decorators.
3. Configure DBOS to use Django's `DATABASE_URL` with separate `dbos` schema for state tracking.
4. Define workflow input/output schema (scraped record IDs, outcome summary, error metadata).
5. Implement high-level state machine: HTML extraction → load context → normalize → resolve identity → consolidate → persist → finalize status.
6. Integrate workflow logging/tracing compatible with DBOS observability stack.

## Workstream 3 – Activity Implementations
1. **HTML Extraction**: call html-chunker `/extract` endpoint with `raw_html` to populate/validate `processed_data` field.
2. **Load Scraped Data**: query Django ORM, aggregate historical entries for same provider.
3. **Geo Normalization**: hardcoded VA city→county mapping (Alexandria, Fairfax, Arlington, etc.); emit structured format: `{"normalized": {"counties": [...], "states": [...], "independent_cities": [...]}, "raw_tags": [...]}`.
4. **Identity Resolution**: integrate RapidFuzz with configurable weights (business_name: 40%, phone: 30%, website: 20%, license: 10%). Thresholds:
   - Score ≥ 85%: Auto-link to existing provider
   - Score 70-84%: Set `scrape_status="paused_intervention"` with `intervention_reason`
   - Score < 70%: Auto-create new provider
5. **Field Consolidation**: merge `business_info`, services, licenses, reviews, awards with provenance tracking (`enriched_sources`, `enriched_at`, `enrichment_metadata`).
6. **Persistence**: upsert `ServiceProvider`, automatically create `ProviderCategory` links based on scraped services; capture audit metadata.
7. **Status Update**: write `scrape_status` (`completed`, `failed`, or `paused_intervention`) + `error_message` or `intervention_reason` back to each processed record.

## Workstream 4 – Data Modeling Adjustments
1. **ServiceProviderScrapedData**:
   - Make `service_provider` FK nullable (`null=True, blank=True`).
   - Add `scrape_status` choice: `"paused_intervention"`.
   - Add `intervention_reason` TextField (`blank=True, null=True`).
   - Add `workflow_id` CharField (`max_length=255, blank=True, null=True`).
2. **ServiceProvider**:
   - Extend `service_area` JSONField structure: `{"normalized": {"counties": [...], "states": [...], "independent_cities": [...]}, "raw_tags": [...]}`.
   - Add provenance fields:
     - `enriched_sources` JSONField (default=list)
     - `enriched_at` DateTimeField (`null=True, blank=True`)
     - `enrichment_metadata` JSONField (default=dict)
3. Run migrations and update Django admin / serializers for new fields.
4. Defer helper tables (`GeographicArea`, `ProviderIdentityLink`) for future iteration.

## Workstream 5 – Roster UI Integration (Deferred)
1. Backend API: expose enriched provider search endpoint with filters (county/state, categories, availability, rating).
2. Modal Mode A (existing providers): integrate API, render filters, and ensure detail view surfaces provenance cues.
3. Modal Mode B (new provider): create endpoint to submit raw scrape payload, spawn Celery/DBOS trigger, and stream progress status to UI.
4. Add UI feedback states (processing, success, error, paused_intervention) with retry hooks.

**Note**: UI integration deferred until core workflow is stable and validated.

## Workstream 6 – Configuration, Monitoring, and Ops
1. Introduce env vars:
   - `SERVICE_PROVIDER_BATCH_SIZE` (default: 1)
   - `DATABASE_URL` (reused for DBOS state tracking with `dbos` schema)
   - Fuzzy match thresholds defined at function level (configurable in code)
2. Add structured logging around each activity stage; ensure logs capture scraped data IDs, workflow IDs, and intervention reasons.
3. Publish metrics (pending/in_progress/completed/paused_intervention/failed counts) to existing monitoring sink.
4. Staff query Django database for `scrape_status="paused_intervention"` to identify workflows needing manual resolution.
5. Create runbooks/checklists for common failure paths (identity conflicts, geo normalization gaps, HTML chunker timeouts).

## Workstream 7 – Validation & QA Approach
1. Define deterministic fixtures for scraped data covering multi-source merge, ambiguous identity, missing geography.
2. Automate workflow dry-runs using DBOS test harness or mocked activities (even without full pytest coverage per project scope).
3. Provide manual verification checklist for staff acceptance (roster modal flows, provider data accuracy).
4. Capture known limitations (city ↔ county mapping TBD) and document mitigation steps.

## Dependencies & Sequencing
- **Phase 1**: Workstream 4 (data modeling) must complete first to enable workflow development.
- **Phase 2**: Workstreams 1–3 (triggering, workflow skeleton, activities) are foundational and should complete before UI integration.
- **Phase 3**: Workstream 6 (monitoring/ops) should wrap up after core workflow logic is stable.
- **Phase 4**: Workstream 5 (UI integration) deferred until core pipeline is validated.
- **Phase 5**: Workstream 7 (validation/QA) runs continuously throughout implementation.

## Risks & Mitigations
- **Geographic accuracy**: interim normalization may misclassify service areas → flag entries where confidence < threshold and require manual review.
- **Identity collisions**: false positives in fuzzy matching → maintain intervention workflow path and audit trail.
- **External LLM/API quotas**: apply Celery throttling + DBOS concurrency limits; cache results where feasible.
- **Operational visibility**: without clear dashboards, failures could go unnoticed → establish metrics and alert thresholds early.

## Implementation Order
1. Add dependencies to `requirements.txt` (`rapidfuzz>=3.0.0`).
2. Update Django models (`ServiceProviderScrapedData`, `ServiceProvider`) and run migrations.
3. Create DBOS workflow module and scaffold workflow class.
4. Implement workflow activities (HTML extraction, geo normalization, identity resolution, consolidation, persistence).
5. Add Celery task and wire to beat schedule.
6. Add logging, monitoring, and intervention tracking.
7. Validate with test fixtures and manual verification.
8. Document intervention resolution process for staff.

## Out of Scope / Deferred
- Production-grade city↔county mapping via Azure Maps or curated dataset.
- Dedicated intervention UI/dashboard (currently using Django admin).
- Final UI treatment for partially processed providers (Workstream 5).
- Broader analytics/reporting on provider sourcing beyond roster workflow integration.
- Helper tables (`GeographicArea`, `ProviderIdentityLink`) for future iteration.
