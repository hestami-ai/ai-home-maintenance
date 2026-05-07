# Assessment: technical_spec_agent / configuration_parameters (Phase 5.4)

**Sample**: `track_c_samples/25_technical_spec_agent__configuration_parameters.md`
**Reviewed agent**: technical_spec_agent running qwen3.5:9b (NEW role to Track C)
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle (5 generic validators); Phase 5 NOT in DISPATCH_BUNDLES at cal-26 time
**Harness outcome**: **QUARANTINE** — 16 findings (H=15/M=1/L=0); highest-severity sample in the Phase 5 corpus

---

## 1. What this sample reveals

Phase 5.4 tasks the agent with specifying configuration parameters per component — `name`, `type`, `default`, `required`, `description` — from the bounded component list. The critical failure: the agent populated `default` values for configuration parameters that reference runtime infrastructure — endpoint URLs, bucket names, webhook URLs, API base paths — all of which are operationally specific and not present anywhere in the source context. The result is QUARANTINE, the first QUARANTINE in Phase 5 and the most defect-dense flat sub-phase in the cal-26 corpus.

Phase 5.4 is the clearest manifestation of **operational-specifics fabrication**: the agent is structurally compelled by the schema field `default` to provide a concrete value, and in the absence of source-grounded values, it invents plausible-sounding ones (`https://api.internal/hestami/audit/ingest`, `hestami-assets-default`, `us-east-1`, `https://hooks.internal/compliance/alerts`, `https://api.tax.gov/regulatory/codes`). These fabricated values would flow directly into deployment configurations if passed downstream unchecked — this is precisely the "false assurance" risk the QUARANTINE protocol is designed to catch.

This defect class is structurally related to the Phase 3.3 `implementation_commitment_grounding` outlier (fabricated auth mechanisms and protocols) and the Phase 4.3 `mandated_threshold_inheritance` (fabricated algorithm names and merge strategies). All three involve the agent emitting concrete operational/technical values in structured fields where the source context is silent or provides only category-level guidance. The three are now a confirmed **family** across Phases 3.3, 4.3, and 5.4 — the only question is catalog organization (see §2).

---

## 1a. Defects in the agent's response

The 14 HIGH `unsupported_endpoint` findings break into three sub-groups by fabrication type:

**Group A: Fabricated internal-service endpoint URLs (10 findings).** The agent generates plausible internal URLs for: audit event ingestion (`https://api.internal/hestami/audit/ingest`), AI processing (`https://inference.internal/hestami/ai/extraction`), security scanning (`https://scan.internal/secure/scan`), metrics ingestion (`https://metrics.internal/ingest`), board membership validation (`https://internal-api/gov/board`), violation notice dispatch (`https://delivery.internal/vnm/dispatch`), property RLS enforcement (`https://cerbos.internal/policy`), policy enforcement (`https://policy.internal/enforce`), authentication delegation (`https://auth.internal/session/propagate`). None of these URLs appear in or are derivable from any SR, Interface Contract, backlog item, or platform constraint. The harness correctly rates all HIGH — a fabricated infrastructure endpoint in a configuration default is a concrete operational commitment that could drive misconfigured deployment.

**Group B: Fabricated external-service endpoint URL (1 finding).** `https://api.tax.gov/regulatory/codes` for COMP-FIN-TAX's `tax_registry_api_endpoint`. This is a fabricated external government API URL. The source context mandates tax code validation (SR-012, NFR-TAX-*) but names no external endpoint. Particularly dangerous: a deployment engineer treating this as spec-provided could attempt to contact this URL.

**Group C: Fabricated storage location (1 finding).** `hestami-assets-default` (bucket name) and `us-east-1` (region) for comp-dgt-storage-hand's `object_store_bucket_name` and `object_store_region`. Source specifies SeaweedFS (`TECH-SEAWEEDFS-1`) as the object store — SeaweedFS does not use AWS region conventions, making `us-east-1` architecturally incoherent as a default, not merely unattested.

**Group D: Fabricated numerical thresholds (1 MEDIUM finding).** Values like `60.0` for `quorum_threshold_percent`, `30` for `vote_resolution_timeout_minutes`, `99.9` for `error_threshold_value`, `30` for `better_auth_session_timeout_minutes`, `15s` for `sync_poll_cycle_duration`. These are plausible-sounding operational defaults with no source attestation. MEDIUM (not HIGH) because numerical defaults are less dangerous than URL/bucket defaults — they are more obviously "example values" — but they still represent unsupported commitments.

**Additional harness finding:**
- **(HIGH — reasoning_quality_validator, unjustified_leap)** The agent explicitly chose to provide concrete defaults, acknowledging in its thinking that these are "examples" or "reasonable defaults." This is a reasoning-process failure: when source provides no default, the agent should either mark `default: null` with a description of what the value must be, or surface it as an `open_question`. The correct behavior is `required: true` with no default for deployment-specific parameters. Harness correctly rated HIGH.

**Harness-missed defect:**
- **(harness-missed, MEDIUM) `conflict_resolution_strategy` default `"last_write_wins"` over-commits algorithm.** comp-sync-conflict specifies `ConflictResolutionStrategy` as a term but mandates no specific algorithm. `"last_write_wins"` is the same class of algorithmic commitment as the Phase 4.3 `mandated_threshold_inheritance` findings (server-priority merge). This is the Phase 5.4 instantiation of that pattern on a configuration default rather than an ADR. The grounding_validator classified numerical thresholds as MEDIUM but missed this string-algorithm default.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `contract_schema_validator` | Yes | Clean — configuration_parameters schema valid |
| `grounding_validator` | Yes | 13 HIGH (unsupported_endpoint), 1 MEDIUM (unsupported_threshold) |
| `reasoning_to_response_faithfulness` | Yes | Clean — thinking chain's fabrication decision is faithfully reflected in response |
| `reasoning_quality_validator` | Yes (broad scope) | HIGH (unjustified_leap — agent chose to fabricate despite awareness of gap) |
| `final_synthesis` | Yes | HIGH — QUARANTINE correct |
| `ungrounded_operational_specifics` (proposed) | NOT dispatched | Would have structured the endpoint/bucket/algorithm fabrication into a single typed finding family with severity parameterization |

The placeholder bundle delivered QUARANTINE correctly. The grounding_validator is the primary contributor: 13 HIGH findings that individually justify the QUARANTINE threshold. The `reasoning_quality_validator` HIGH adds confirmation (the agent was aware of the fabrication). No false positives observed.

---

## 2. Validator implications (deltas vs current catalog)

**`ungrounded_operational_specifics`** (LLM, **new family-level validator** — the central Phase 5 contribution). Phase 5.4 establishes the third confirmed instance of a cross-phase defect family:

| Phase | Sub-phase | Catalog entry | Fabrication type |
|---|---|---|---|
| 3.3 | interface_contracts | `implementation_commitment_grounding` | Auth mechanisms, protocols, data formats |
| 4.3 | adr_capture | `mandated_threshold_inheritance` | Algorithm names, merge strategies |
| 5.4 | configuration_parameters | (new) | Endpoint URLs, bucket names, webhook URLs, algorithm defaults |

**Consolidation argument:** All three share the same root mechanism — the agent emits a concrete operational/technical value in a schema field whose structural position implies implementation commitment, when the source context provides only category-level guidance or is silent. The three can be consolidated into a **single family-level `ungrounded_operational_specifics` validator** with three parameterizations:
- **Parameterization A (3.3 form):** Schema fields `auth_mechanism`, `protocol`, `data_format` → check claimed value against technical_constraints list in context.
- **Parameterization B (4.3 form):** ADR `decision` and `rationale` fields → check named algorithms/thresholds against upstream TECH-* mandates.
- **Parameterization C (5.4 form):** Configuration `default` field values of type `url`, `string` (infrastructure names), or `float`/`integer` (numeric thresholds) → check claimed value appears in or is derivable from source context; if not, severity = HIGH for URLs/names, MEDIUM for thresholds.

The case for consolidation is strong: one catalog entry prevents three separate Track D implementations of the same reasoning logic with slightly different parameterizations. The case against: the three parameterizations are sufficiently different in their source-vs-claim comparison logic that a single LLM prompt may not generalize cleanly across all three. **Recommended disposition:** Promote to a family-level `ungrounded_operational_specifics` entry in the catalog with a note that Track D implements three sub-variants (3.3-form, 4.3-form, 5.4-form) that may be combined into one or split by surface depending on prompt performance. Proposed id: `ungrounded_operational_specifics`.

**Additional implication for Phase 5.4 prompt.** The prompt should instruct: "Where no default value is grounded in source context, set `default: null` and mark `required: true` with a description stating what value must be provided." This would prevent the fabrication entirely for the URL/bucket category. The numerical threshold category (quorum %, heartbeat timeout) is harder — some defaults are genuinely reasonable engineering choices that should be surfaced as assumptions, not omitted.

**Role-mapping note.** Sample 25 **confirms discovery-class** for Phase 5.4: the agent has a bounded component list and must extract configuration parameters for each. The QUARANTINE arises because the schema demands concrete defaults where the source provides none — this is a prompt-vs-source tension, not a role misclassification. The `deferred_to_track_d.md` §1 mapping is **revised to discovery-class** for Phase 5.4.
