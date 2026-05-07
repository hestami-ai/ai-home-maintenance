# Assessment: technical_spec_agent / data_model_skeleton (Phase 5.1)

**Sample**: `track_c_samples/22_technical_spec_agent__data_model_skeleton.md`
**Reviewed agent**: technical_spec_agent running qwen3.5:9b (NEW role to Track C — first corpus sample for this role)
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle (5 generic validators); Phase 5 NOT in DISPATCH_BUNDLES at cal-26 time
**Harness outcome**: REVISE — 3 MEDIUM + 1 LOW

---

## 1. What this sample reveals

Phase 5.1 tasks the agent with extracting a data model (entities, fields, types, constraints, relationships) for each component, given a bounded input of 9 software domains with named terms and a 28-item backlog component list. The input fully constrains the output shape: there is one correct set of entities per domain and one correct directionality for each cross-domain relationship. This maps squarely to **discovery-class** — not the "requirements-class + synthesis-class" anticipated in `deferred_to_track_d.md` §1. The agent has a finite positive-list of source-attested entities (domain Terms) and relationships (component responsibilities); violations are grounded fabrications or structural reversals, the canonical discovery-class failure modes. Cal-26 evidence **revises the anticipated role mapping** for `technical_spec_agent` at all flat sub-phases to discovery-class.

The three-finding pattern here (reversed relationship + unsupported field + unsupported derived-metric persistence) is lighter than samples 24 and 25 — the agent stays reasonably within domain vocabulary. The main structural defect (reversed FK directionality) is the most consequential: it would break downstream schema generation. Cross-link to sample 18 (architecture_agent / software_domains) where grounding_validator similarly caught domain vocabulary violations; the Phase 5 surface is more dangerous because output feeds implementation artifacts directly.

---

## 1a. Defects in the agent's response

- **(MEDIUM — grounding_validator, contradicted_claim) PropertyRecord→ViolationRecord relationship direction reversed.** The agent declares `property_id` (source) targeting `ViolationRecord.violation_id` (target), implying PropertyRecord holds the FK to ViolationRecord. The source context requires the opposite: a ViolationRecord must reference a specific PropertyRecord (ViolationRecord holds the FK). This is a structural reversal, not an ambiguity. Caught correctly.

- **(LOW — grounding_validator, unsupported_claim) DispatchQueue `priority` field fabricated.** Source context describes queue management and assignment scheduling but does not mandate a `priority` field. The agent inferred prioritization semantics not present in SR-002 or the backlog description. LOW because the field is additive (does not contradict source), but it is unsupported.

- **(MEDIUM — grounding_validator, unsupported_threshold) HealthCheckMetric `uptime_percentage` fabricated as persistent field.** Source (comp-obs-aut) states "Calculates derived metrics (e.g., uptime percentage) from raw data points." Deriving a metric on-read vs persisting it as a schema column is an implementation commitment not mandated by the source. The agent over-committed by materializing it as a column. Same defect class as Phase 4.3's `mandated_threshold_inheritance` findings — here the persistence commitment replaces the algorithm commitment.

- **(MEDIUM — final_synthesis)** Escalated to REVISE. Correct; driven by 2 MEDIUM operational findings.

- **(harness-missed, LOW) `TenantTable` undeclared foreign key target.** Multiple entities reference `FK -> TenantTable.id` but `TenantTable` is not defined in any component model or backlog item. A `broken_reference_validator` parameterized on the known entity set would flag this as LOW (implicit system boundary entity, not necessarily a defect, but worth surfacing as an assumption).

- **(harness-missed, MEDIUM) Component ID self-mapping not grounded.** The agent infers component IDs (`COMP-PROP-REG`, `COMP-FIELD-ENG`, etc.) by converting domain names; these IDs are not explicitly declared in the backlog list, which only names leaf components (e.g., `comp-prop-integrity-gate`). This ID derivation is reasonable but undeclared — the agent should surface it as an assumption.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `contract_schema_validator` | Yes | Clean — data_models schema valid |
| `grounding_validator` | Yes | 2 MEDIUM (contradicted_claim, unsupported_threshold), 1 LOW (unsupported_claim) |
| `reasoning_to_response_faithfulness` | Yes | Clean — thinking chain reasoning matches emitted decisions |
| `reasoning_quality_validator` | Yes (broad scope) | Clean — no misfires |
| `final_synthesis` | Yes | MEDIUM — REVISE correct |
| `relationship_directionality_validator` | NOT dispatched | Would deterministically catch FK reversal (HIGH — structural defect) |
| `broken_reference_validator` | NOT dispatched | Would flag `TenantTable` undeclared target (LOW) |

The placeholder bundle's grounding_validator is doing real work here — three genuine findings caught. The main precision gap is the missing directionality-specific check; `grounding_validator` caught the reversal semantically but a deterministic relationship-direction rule would catch it structurally without LLM cost.

---

## 2. Validator implications (deltas vs current catalog)

**`relationship_directionality_validator`** (deterministic, discovery-class candidate). For each `relationships` entry in the `data_models` output, verify that the declared FK direction is consistent with the cardinality implied by the source context (e.g., if source says "ViolationRecord references a PropertyRecord," then ViolationRecord must hold the FK, not PropertyRecord). Parameterized by the source-attested cardinality descriptions (extracted from domain Terms and SR context). Severity: structurally reversed FK → HIGH (breaks schema generation); ambiguous direction → LOW. Would have promoted the MEDIUM contradicted_claim finding to HIGH, which is more appropriate for a structural FK reversal. Proposed id: `relationship_directionality_validator`.

**`ungrounded_operational_specifics`** (LLM, new family-level candidate). Broad parameterization for Phase 5: verify that schema-level commitments (field persistence, data types, constraint values) trace to an explicit source mandate or are surfaced as assumptions. The `uptime_percentage` persistent-field finding is the Phase 5.1 instantiation of this pattern; the Phase 4.3 `mandated_threshold_inheritance` (algorithm names) and Phase 3.3 `implementation_commitment_grounding` (auth mechanisms) are the prior-phase instantiations. See §2 of sample 25 assessment for the consolidation discussion.

**Role-mapping note.** `deferred_to_track_d.md` §1 anticipated "requirements-class + synthesis-class" for `technical_spec_agent`. Cal-26 sample 22 **revises this to discovery-class** for Phase 5.1: the agent receives a bounded entity list (9 domain terms) and a bounded component list (28 items), and the output is an extraction of those terms into a typed schema. The dominant failure modes (reversed relationships, unsupported fields, over-committed persistence) are all discovery-class failures against a finite positive-list source. No bloom or synthesis character was observed.

**Schema oddity (note for Phase 5).** The data_model_skeleton sub_phase uses `data_models` as the root schema key. Consistent with the sub-phase name — no mismatch here. (Contrast with sample 24 where `error_handling` vs `error_handling_strategies` is mismatched.)
