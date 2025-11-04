# Service Provider Scraped Data Processing – Implementation Roadmap

## Goal
Deliver the DBOS-orchestrated pipeline that converts `ServiceProviderScrapedData` entries into normalized `ServiceProvider` records and powers the “Add Provider to Roster” workflow. This roadmap mirrors the design in `service-provider-ingestion-design.md` and is structured for execution by an automation-focused engineering agent (no sprint timelines).

## Workstream 1 – Triggering & Orchestration hook
1. Add a Celery task in `services/tasks.py` that:
   - Batches `ServiceProviderScrapedData` with `scrape_status="pending"`.
   - Applies locking / idempotency guard and marks rows `in_progress`.
   - Invokes the DBOS workflow with relevant identifiers and metadata.
2. Wire task scheduling (Celery beat or existing scheduler) and expose env toggles for batch size + sleep interval.
3. Document task invocation contract for other services that may seed scraped data.

## Workstream 2 – DBOS Workflow Skeleton
1. Scaffold workflow definition within the DBOS project (module, registration, configuration).
2. Define workflow input/output schema (scraped record IDs, outcome summary, error metadata).
3. Implement high-level state machine: load context → normalize → resolve identity → consolidate → persist → finalize status.
4. Integrate workflow logging/tracing compatible with DBOS observability stack.

## Workstream 3 – Activity Implementations
1. **Load Scraped Data**: query Django via REST/ORM facade, aggregate historical entries for same provider.
2. **Geo Normalization**: placeholder normalization logic with TODO for authoritative dataset; emit structured county/state + free-form tags.
3. **Identity Resolution**: integrate weighted fuzzy matching (e.g., RapidFuzz); surface ambiguous matches via workflow intervention path.
4. **Field Consolidation**: merge `business_info`, services, licenses, reviews, awards with provenance tracking.
5. **Persistence**: upsert `ServiceProvider`, `ProviderCategory`, related models; capture audit metadata (sources, timestamps).
6. **Status Update**: write `scrape_status` + `error_message` back to each processed record.

## Workstream 4 – Data Modeling Adjustments
1. Extend `ServiceProvider.service_area` structure to store normalized geography alongside legacy tags.
2. Add optional provenance fields (e.g., `enriched_sources`, `enriched_at`).
3. Evaluate need for helper tables (`GeographicArea`, `ProviderIdentityLink`) and stub models if required for roadmap continuity.
4. Run migrations and update Django admin / serializers if new fields are exposed.

## Workstream 5 – Roster UI Integration
1. Backend API: expose enriched provider search endpoint with filters (county/state, categories, availability, rating).
2. Modal Mode A (existing providers): integrate API, render filters, and ensure detail view surfaces provenance cues.
3. Modal Mode B (new provider): create endpoint to submit raw scrape payload, spawn Celery/DBOS trigger, and stream progress status to UI.
4. Add UI feedback states (processing, success, error) with retry hooks.

## Workstream 6 – Configuration, Monitoring, and Ops
1. Introduce env vars for DBOS endpoints, batch sizes, concurrency caps, fuzzy-match thresholds.
2. Add structured logging around each activity stage; ensure logs capture identifiers for audit.
3. Publish metrics (pending/in_progress/completed, intervention counts) to existing monitoring sink.
4. Create runbooks/checklists for common failure paths (identity conflicts, geo normalization gaps).

## Workstream 7 – Validation & QA Approach
1. Define deterministic fixtures for scraped data covering multi-source merge, ambiguous identity, missing geography.
2. Automate workflow dry-runs using DBOS test harness or mocked activities (even without full pytest coverage per project scope).
3. Provide manual verification checklist for staff acceptance (roster modal flows, provider data accuracy).
4. Capture known limitations (city ↔ county mapping TBD) and document mitigation steps.

## Dependencies & Sequencing
- Workstreams 1–3 are foundational and should complete before UI integration (Workstream 5).
- Data modeling updates (Workstream 4) may proceed in parallel but must land before persistence steps finalize.
- Monitoring (Workstream 6) should wrap up after core workflow logic is stable.

## Risks & Mitigations
- **Geographic accuracy**: interim normalization may misclassify service areas → flag entries where confidence < threshold and require manual review.
- **Identity collisions**: false positives in fuzzy matching → maintain intervention workflow path and audit trail.
- **External LLM/API quotas**: apply Celery throttling + DBOS concurrency limits; cache results where feasible.
- **Operational visibility**: without clear dashboards, failures could go unnoticed → establish metrics and alert thresholds early.

## Out of Scope / Deferred
- Production-grade city↔county mapping via Azure Maps or curated dataset.
- Final UI treatment for partially processed providers (currently deferred per guidance).
- Broader analytics/reporting on provider sourcing beyond roster workflow integration.
