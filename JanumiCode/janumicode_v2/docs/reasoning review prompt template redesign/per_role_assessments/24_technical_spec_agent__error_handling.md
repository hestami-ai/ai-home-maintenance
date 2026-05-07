# Assessment: technical_spec_agent / error_handling (Phase 5.3)

**Sample**: `track_c_samples/24_technical_spec_agent__error_handling.md`
**Reviewed agent**: technical_spec_agent running qwen3.5:9b (NEW role to Track C)
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle (5 generic validators); Phase 5 NOT in DISPATCH_BUNDLES at cal-26 time
**Harness outcome**: REVISE — 19 findings (H=0/M=19/L=0); highest finding count among Phase 5 flat sub-phases

**Schema field note**: governed_stream `sub_phase_id` is `error_handling`; artifact schema root key is `error_handling_strategies`. This naming inconsistency affects dispatch key matching and should be resolved before Phase 5 bundle promotion.

---

## 1. What this sample reveals

Phase 5.3 tasks the agent with specifying error-handling strategies per component: error_types (classified categories), detection mechanism, response strategy, and surfacing (HTTP codes, logs, alerts). The prompt instructs "Error types must be specific, not generic" — this directive, absent a grounded source for error-type names, drives the agent to invent concrete names. The result is 18 grounding findings, all `unsupported_claim` on `error_types` arrays, across effectively all 28 components. This is the highest single-sample finding count in the Phase 5 corpus.

The defect pattern is distinct from Phase 5.2's protocol flattening or Phase 5.4's endpoint fabrication. Here the agent is **following the prompt rule** ("be specific") but lacks source attestation for the invented names. The source context (SRs + backlog) names what components *do* — serialize events, enforce CorrelationTraceId, apply IntegrityHash — but does not name the specific error identifiers (`serialization_failure`, `ingest_queue_full`, `correlation_trace_missing`). The prompt rule creates a grounding trap: specificity without source grounds forces fabrication. This maps to **discovery-class with a structural grounding tension**: the source constrains error domains (what can fail) but not error type names (what those failures are called). A Phase-5-specific `error_type_source_attestation_validator` would need to distinguish "source-derivable error type" (e.g., `ai_confidence_below_threshold` traceable to SR-011's "validating AI validation confidence scores") from "fully fabricated error type" (e.g., `model_inference_timeout`, `api_service_unavailable` — generic infrastructure failures not named in any SR or backlog item).

Notably, grounding_validator is performing reliably at this surface: 18 genuine findings, no false positives observed. The issue is the **agent**, not the validator. Cross-link to sample 25 where the same validator escalated findings to HIGH for operational-value fabrication; here the fabrications are MEDIUM (specific names, not dangerous defaults).

---

## 1a. Defects in the agent's response

All 18 grounding findings follow a common pattern — grouped by sub-defect:

**Group A: Fully fabricated generic infrastructure error types (12 components).** Errors like `serialization_failure`, `ingest_queue_full` (comp-audit-event-ingestion), `metadata_index_corruption` (comp-dgt-meta-man), `local_data_corruption`, `queue_persistency_failed` (comp-sync-queue), `api_service_unavailable`, `model_inference_timeout` (comp-dgt-ai-proc) are general system failure modes with no source attestation. The backlog descriptions name behaviors (serialize, ingest, enforce) but not error type identifiers. MEDIUM finding correctly rated for each — the values are over-specified, not dangerously wrong.

**Group B: Partially source-derivable error types with fabricated siblings (6 components).** Errors like `ai_confidence_below_threshold` (comp-dgt-ai-proc) are derivable from SR-011 ("validating AI validation confidence scores"). However, the agent pairs them with unsupported siblings (`model_inference_timeout`). The finding correctly identifies the legitimate claim and the unsupported companion. A more precise validator would rate these MEDIUM for the unsupported sibling and LOW for the supported-but-unattested name.

**Single harness-missed defect:**
- **(harness-missed, MEDIUM) `detection` and `response` fields are also fabricated for most components.** The prompt requires these to be "concrete and implementable." Values like `queue_integrity_check`, `corrupt_queue_cleanup`, `workflow_validator`, `rollback_state` have no source grounding — they name internal implementation mechanisms not described in any SR or backlog item. The grounding_validator focused entirely on `error_types`; it did not check `detection` and `response` fields. A parameterized `operational_specifics_grounding_validator` covering all structured fields would catch this.

- **(harness-missed, LOW) Schema field key mismatch.** The `sub_phase_id` is `error_handling` but the artifact root key is `error_handling_strategies`. This inconsistency is in the prompt and schema definition, not the agent's output — the agent correctly used `error_handling_strategies` as the root key. Worth noting for the dispatch key resolution before Track D.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `contract_schema_validator` | Yes | Clean — error_handling_strategies schema valid |
| `grounding_validator` | Yes | 18 MEDIUM (unsupported_claim on error_types across 28 components) |
| `reasoning_to_response_faithfulness` | Yes | Clean — thinking chain is consistent with emitted error types |
| `reasoning_quality_validator` | Yes (broad scope) | Clean — no misfires; the agent's reasoning is internally consistent (it *chose* to be specific per the prompt rule) |
| `final_synthesis` | Yes | MEDIUM — REVISE correct |
| `error_type_source_attestation_validator` | NOT dispatched | Would distinguish source-derivable from fully fabricated error types; would allow `ai_confidence_below_threshold` (derivable) while flagging `model_inference_timeout` (generic) |
| `operational_specifics_grounding_validator` | NOT dispatched | Would extend grounding checks to `detection` and `response` fields |

The placeholder bundle's grounding_validator is the most productive validator in Phase 5 so far — 18 real findings with no observed false positives. The precision gap: it collapses all unsupported error-type names to the same MEDIUM severity regardless of whether the name is derivable or fully fabricated.

---

## 2. Validator implications (deltas vs current catalog)

**`error_type_source_attestation_validator`** (LLM, Phase 5.3 specialized). For each `error_types` array value, assess whether the error type is: (a) directly named in source (ACCEPT); (b) derivable from named source behavior (ACCEPT with LOW note); (c) plausible but unattested infrastructure failure for the component (MEDIUM — the dominant Phase 5.3 case); (d) generic cross-component infrastructure failure unrelated to any named behavior (HIGH — e.g., `api_service_unavailable` for an in-process component). The parameterization requires the source component description from the backlog and the relevant SR text. This validator adds precision over `grounding_validator` while keeping the same signal: it would reclassify Group B findings (partially derivable) and escalate Group A's worst cases to HIGH. Proposed id: `error_type_source_attestation_validator`.

**`ungrounded_operational_specifics`** (LLM, family-level candidate). The `detection` and `response` field fabrications in Phase 5.3 are a second instantiation of the broader operational-specifics fabrication pattern (see sample 25 assessment for the full consolidation argument). The Phase 5.3 form: agent invents concrete implementation mechanism names (`workflow_validator`, `rollback_state`) not grounded in source. Same root cause as Phase 5.4's endpoint URL fabrication and Phase 3.3's auth-mechanism fabrication — agent fills structurally-templated fields with plausible-sounding concrete values.

**Schema naming inconsistency: `error_handling` vs `error_handling_strategies`.** This is a prompt/schema authoring defect, not an agent defect. The `sub_phase_id` in the governed_stream config should match the artifact root key. Before Track D dispatch bundle promotion for Phase 5.3, verify the dispatch key (`error_handling`) correctly maps to the schema field (`error_handling_strategies`). Recommend aligning both to `error_handling_strategies` for consistency with the artifact.

**Role-mapping note.** Sample 24 **confirms discovery-class** for Phase 5.3: the source provides a bounded component list and behavioral descriptions; the agent extracts structured strategy records from that list. The grounding-trap (prompt demands specificity that source cannot ground) is a Phase-5.3-specific prompt authoring concern, not a new defect family — it is a miscalibrated source-vs-requirement balance. The fix is either (a) relax the "specific, not generic" rule to "specific when source-attested, otherwise describe failure domain," or (b) add `error_type_source_attestation_validator` to catch the resulting fabrications at review time.
