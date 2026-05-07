# Assessment: technical_spec_agent / data_model_saturation (Phase 5.x)

**Samples**: `track_c_samples/26a_technical_spec_agent__data_model_saturation_depth0.md` (depth 0), `track_c_samples/26b_technical_spec_agent__data_model_saturation_depth1.md` (depth 1)
**Reviewed agent**: technical_spec_agent running qwen3.5:9b (NEW role to Track C — NOTE: technical_spec_agent runs its own saturation pass, no role decoupling unlike Phase 4 where domain_interpreter handles component_saturation)
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle (5 generic validators); Phase 5 NOT in DISPATCH_BUNDLES at cal-26 time
**Aggregate harness outcome**: 26a REVISE (1 HIGH + 1 MEDIUM), 26b ACCEPT (1 LOW); cal-26 reached depth 1 only; no depth ≥2 evidence available

---

## 1. What this sample reveals

Phase 5.x tasks `technical_spec_agent` with recursive tier-based decomposition of data model entities — using the same three-branch classification rubric (decomposable / atomic_value / invalid_parent) and four-tier model (A/B/C/D) as Phase 4.2a's component_saturation, applied to data entities rather than architectural components. The structural shape is **saturation-class** (catalog §5.4 family), directly analogous to assessment 21 (domain_interpreter / component_saturation).

Key architectural observation: `technical_spec_agent` is its own saturation-pass executor here — no role decoupling. This contrasts with Phase 4 where `architecture_agent` handles flat sub-phases (4.1, 4.2, 4.3) and `domain_interpreter` handles component_saturation (4.2a). Phase 5 collapses both responsibilities into a single role. This has catalog implications: the "saturation-pass-executor" tag in §0 (added for domain_interpreter) would also apply to technical_spec_agent at this surface, making it a dual-surface role (discovery-class for 5.1–5.4, saturation-class for 5.x).

Depth pattern mirrors Phase 4: depth 0 has findings (1 HIGH), depth 1 is cleaner (ACCEPT). This is consistent with the shallow-depth cleanliness hypothesis from assessment 21 — depth-0 failures tend to be structural (FK relationship gaps) while depth-1 benefits from the parent's corrected structure being passed in as context. No depth ≥2 data exists; extrapolation to deep drift is not supported.

---

## 1a. Defects in the agent's response

### Depth 0 (26a — PropertyRecord, Tier A, decomposable)

The agent correctly classifies PropertyRecord as `decomposable` at Tier A (Aggregate Root) and produces three Tier-C children: PropertyIdentity (lifecycle fields), PropertyAddress (geospatial/postal fields), PropertyCompliance (scan status, schema version). The decomposition rationale is well-grounded — address fields as a value object is architecturally sound, and compliance attributes isolation maps to SR-001's media security and schema constraint requirements.

- **(HIGH — reasoning_quality_validator, edge_case_blindness) FK relationships missing for decomposed Value Objects.** PropertyAddress and PropertyCompliance have empty `relationships: []` arrays. In a relational schema, these value objects must reference PropertyRecord's primary key (`property_id`) to prevent orphaned records. The harness correctly identifies this: the structural decomposition is sound but the relational binding is absent. This is a specific-to-saturation structural defect — the agent decomposed correctly but did not close the relationship loop. Fix: add `property_id` FK to both VO's `relationships` and `fields`.

- **(MEDIUM — final_synthesis)** REVISE correctly escalated on 1 HIGH.

- **(harness-missed, LOW) `traces_to: []` across all children.** The agent explicitly noted in its thinking chain that it could not derive `resp-*` IDs from the input context, so it emitted empty arrays. This is the correct conservative choice, but it means the decomposition is not traceable to upstream requirements. The saturation-class family's `traces_to_id_validity` validator (catalog §5.4) would flag `[]` as a LOW annotation where non-empty traces are expected. In this case the harness may need to distinguish "empty by necessity" (no source IDs available) from "empty by omission."

- **(harness-missed, LOW) PropertyIdentity child classified as `value_type` but functions as Aggregate Root.** The agent assigns `kind: "value_type"` to PropertyIdentity (which holds `property_id`, `tenant_id`, and lifecycle timestamps). The entity carrying the aggregate's primary key is the root entity, not a value object. The kind field is used to inform downstream schema generation — misclassifying the PK holder as `value_type` could produce incorrect ownership semantics. A `entity_kind_consistency_validator` parameterized on the `is_identity: true` field signal would catch this.

### Depth 1 (26b — PropertyIdentity, Tier-C child from depth 0, Tier D atomic)

26b presents PropertyIdentity (5 fields: `property_id`, `tenant_id`, `activation_status`, `created_at`, `updated_at`) and correctly classifies it as `atomic_value` — overriding the expected Tier-C hint to Tier D. The override argument is sound: all fields are primitive types or enums with no substructure. The thinking chain is transparent about the override reasoning.

- **(LOW — final_synthesis annotation only)** ACCEPT correct; no operational findings.

- **(harness-missed, LOW) `parent_tier_assessment.tier: "D"` override from Tier-C hint not flagged.** The agent sets `agrees_with_hint: false` (correctly declared) but emits no surfaced assumption explaining the override. Per the saturation rubric, a hint override should be accompanied by a surfaced assumption documenting the disagreement rationale. The agent surfaced two unrelated assumptions but not one for the tier override. A `tier_override_assumption_validator` would require this.

- **(harness-missed, LOW) `citations: []` on surfaced assumption "primary key property_id uniquely identifies..."** The identity assumption has no citation, but it is derivable from SR-001's "prevention of duplicate addresses" and the TECH-POSTGRES-1 constraint. An `assumption_citation_validator` (catalog §5.4) would flag uncited assumptions as LOW.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | 26a result | 26b result |
|---|---|---|---|
| `contract_schema_validator` | Yes | Clean — saturation schema valid | Clean — atomic_value schema valid |
| `grounding_validator` | Yes | Clean — no fabricated claims | Clean |
| `reasoning_to_response_faithfulness` | Yes | Clean — decomposition thinking matches children | Clean — atomic override reasoning matches classification |
| `reasoning_quality_validator` | Yes (broad scope) | HIGH — FK gap (real finding) | Clean |
| `final_synthesis` | Yes | MEDIUM — REVISE correct | LOW — ACCEPT correct |
| `tier_decomposition_validator` (§5.4 family) | NOT dispatched | Would verify: Tier A → Tier C step correct; VO field partitioning exhaustive | Would verify: atomic_value mirror contract; single-child requirement |
| `traces_to_id_validity` (§5.4 family) | NOT dispatched | Would flag `traces_to: []` (LOW — empty by necessity) | Would flag `traces_to: []` (LOW) |
| `entity_kind_consistency_validator` | NOT dispatched | Would flag PropertyIdentity `value_type` misclassification (LOW) | n/a |
| `tier_override_assumption_validator` | NOT dispatched | n/a | Would require surfaced assumption for hint override |
| `assumption_citation_validator` (§5.4 family) | NOT dispatched | n/a | Would flag uncited identity assumption |

No false positives at either depth. The placeholder bundle's `reasoning_quality_validator` correctly identified the structural FK gap (HIGH). The saturation-class family validators (§5.4) are not dispatched but would add precision without adding noise — consistent with the shallow-depth pattern in assessment 21.

---

## 2. Validator implications (deltas vs current catalog)

**Existing §5.4 saturation-class family applies without new families.** The applicable validators are:
- `tier_decomposition_validator` — parameterized for data_model_saturation surface (decomposable/atomic_value rubric; Tier A/B/C/D; exhaustive field partitioning for decomposable)
- `traces_to_id_validity` — parameterized by `traces_to[]` field path; empty array → LOW (distinguish necessity from omission via prompt instruction)
- `assumption_citation_validator` — flag uncited surfaced_assumptions as LOW
- Add `tier_override_assumption_validator` — require `surfaced_assumptions` entry when `agrees_with_hint: false` (severity: missing override rationale → LOW)

Add Phase 5.x dispatch rows to `harness_design.md` §2.1 with data_model_saturation schema parameterization.

**`entity_kind_consistency_validator`** (deterministic, data_model_saturation specific). Verify that the child carrying `is_identity: true` (or the field matching the parent PK) is not classified as `kind: "value_type"`. The entity holding the aggregate PK must be the root entity or aggregate root, not a value object. Severity: PK holder classified as `value_type` → MEDIUM (affects downstream ownership semantics). Would have caught the PropertyIdentity misclassification. Proposed id: `entity_kind_consistency_validator`.

**Role-saturation-executor note for catalog §0.** `technical_spec_agent` is the confirmed saturation executor for Phase 5.x data_model_saturation. Unlike Phase 4 where saturation and flat sub-phases use different roles (architecture_agent / domain_interpreter), Phase 5 uses the same role for both. The catalog §0 should note the dual-surface assignment: `technical_spec_agent` dispatches to discovery-class family for Phase 5.1–5.4 (flat sub-phases) and saturation-class family (§5.4) for Phase 5.x. This is a deliberate Phase 5 design choice, not an error.

**Depth-stratification note (§5.4 extension).** Shallow depths (0–1) show the same cleanliness gradient as Phase 4.2a: depth 0 has a structural defect (FK gap), depth 1 is clean. The pattern supports the hypothesis that shallow-depth cleanliness holds across saturation surfaces, not just requirements saturation. No depth ≥2 evidence available — Stage 1D samples at depth ≥3 needed to determine whether data_model_saturation exhibits the deep-depth drift seen in fr_saturation (assessment 13 at depth 8).

**Role-mapping note.** `deferred_to_track_d.md` §1 anticipated "requirements-class + synthesis-class" for `technical_spec_agent`. For the saturation pass, the evidence **revises this to saturation-class** — the decomposition rubric is isomorphic to fr_saturation's and the Phase 4.2a component_saturation's. The saturation-class family (§5.4) applies directly with data_model_saturation schema parameterization. The full revised mapping for `technical_spec_agent` across Phase 5: **discovery-class** (5.1–5.4 flat sub-phases) + **saturation-class** (5.x saturation pass). The originally anticipated "requirements-class" does not cleanly fit any observed sub-phase — Phase 5 outputs are technical-spec extractions from bounded inputs, not requirements proper.
