# Assessment: domain_interpreter / component_saturation (Phase 4.2a)

**Samples**: `track_c_samples/21a_domain_interpreter__component_saturation_depth0.md`, `track_c_samples/21b_domain_interpreter__component_saturation_depth1.md` (depths 0 and 1)
**Reviewed agent**: domain_interpreter running qwen3.5:9b (existing role — confirmed as the saturation executor for Phase 4 component decomposition across all 34 cal-26 invocations; domain_interpreter also serves Phases 1.0b–1.0e)
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle; component_saturation NOT in DISPATCH_BUNDLES at cal-26 time
**Aggregate harness outcome**: 21a ACCEPT (1 LOW), 21b ACCEPT (1 LOW) — both clean at operational level; cal-26 reached depth 1 only, no depth ≥2 evidence available

---

## 1. What this sample reveals

Phase 4.2a tasks domain_interpreter with recursive tier-based decomposition using the three-branch classification rubric (atomic_component / decomposable / invalid_parent) and a four-tier model (A/B/C/D). Both depths are clean ACCEPTs, paralleling fr_saturation at shallow depths (assessments 13a/13b at depths 0 and 4 were also clean; defects emerged at depth 8). Two explanations: (a) shallow depth means no accumulated sibling-context drift; (b) the domain_interpreter may be more resistant to deep-depth drift than requirements_agent because the tier rubric is more mechanically testable than the atomic_leaf mirror contract. Stage 1D at depth ≥3 needed to distinguish.

domain_interpreter is confirmed across all 34 component_saturation invocations — deliberate architectural decoupling: architecture_agent handles flat Phase 4 sub-phases (4.1, 4.2, 4.3); domain_interpreter handles recursive saturation (4.2a). The §5.4 saturation-class family is structurally applicable: decomposition rubric is isomorphic to fr_saturation's. Cross-link to assessment 13 (fr_saturation).

---

## 1a. Defects in the agent's response

### Depth 0 (21a — COMP-PROP-REG, Property Registry Service, root hint)

21a correctly classifies the parent as `decomposable`, tier A, producing three Tier-C children partitioning SR-001's four responsibilities: Property State Orchestrator (DBOS lifecycle), Property Integrity Gate (schema + deduplication), Property Security Handler (RLS via Cerbos). All children have non-empty `traces_to[]`; `active_constraints` narrowing is correct per child.

- **(LOW — final_synthesis annotation only)** No operational findings.

- **(LOW — harness-missed) `comp-prop-integrity-gate` references unknown id `comp-db-store`.** Not in sibling_context or ancestor list; undeclared forward reference. Should be surfaced as an `open_question` assumption. A `broken_reference_validator` parameterized on the known component-id set would flag this.

- **(LOW — harness-missed) `comp-prop-security-handler` RESP-PSH-002 partially expands parent scope.** "Delegate authorization checks to the central identity layer" adds a coordination concern not directly traceable to parent RESP-001-D. `tier_decomposition_validator` would verify children do not expand parent scope.

### Depth 1 (21b — comp-prop-state-orchestrator, Tier-C hint)

21b correctly classifies the parent as `atomic_component`, overriding the Tier-C hint in favor of Tier-D. The atomicity argument is well-grounded: lifecycle transitions and audit persistence are coupled within a single DBOS workflow; splitting them would violate DBOS idempotency and monotonic state transition guarantees. Override is explicitly declared (`agrees_with_hint: false`) with clear structural argument. The Tier-D child mirrors the parent faithfully.

- **(LOW — final_synthesis annotation only)** No operational findings.

- **(LOW — harness-missed) Surfaced assumption borderline-duplicates CA-0004.** "Audit persistence is a co-located side-effect of the workflow" refines but partially overlaps CA-0004 ("relies on async event bus for audit persistence"). `assumption_novelty_validator` would flag as LOW borderline. Refinement is legitimate (co-location specificity is new); human review preferable to automatic suppression.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | 21a result | 21b result |
|---|---|---|---|
| `contract_schema_validator` | Yes | Clean — saturation schema valid | Clean — atomic_component schema valid |
| `grounding_validator` | Yes | Clean | Clean |
| `reasoning_to_response_faithfulness` | Yes | Clean | Clean |
| `reasoning_quality_validator` | Yes (broad scope) | Clean — no misfire on tier labels | Clean |
| `final_synthesis` | Yes | LOW — ACCEPT | LOW — ACCEPT |
| `tier_decomposition_validator` | NOT dispatched | Would verify: classification rationale; responsibility exhaustiveness | Would verify: atomic_component mirror contract compliance |
| `broken_reference_validator` | NOT dispatched | Would catch: `comp-db-store` unknown dep (LOW) | n/a |
| `assumption_novelty_validator` | NOT dispatched | n/a | Would flag: CA-0004 borderline overlap (LOW) |

The placeholder bundle's directional reliability holds at shallow saturation depths: no false positives. The broad-scope `reasoning_quality_validator` did not misfire on tier labels or classification rubric content — consistent with §7: false positives are surface-specific (SQL measurable_condition strings, not JSON classification rubrics).

---

## 2. Validator implications (deltas vs current catalog)

**Existing §5.4 saturation-class family applies without new families.** `tier_decomposition_validator`, `assumption_citation_validator` (full form), and `surfaced_assumption_novelty` are the correct bundle. The decomposition rubric (atomic_component / decomposable / invalid_parent; Tier A/B/C/D) is structurally isomorphic to fr_saturation's rubric; mirror-contract requirements are identical. Add Phase 4.2a dispatch rows to `harness_design.md` §2.1 with component_saturation schema parameterization.

**Depth-stratification note for §5.4 (new).** component_saturation depth ≥2 evidence unavailable at cal-26. Shallow depths (0–1) are materially cleaner than fr_saturation at comparable depths. Two hypotheses: (a) universal shallow-depth cleanliness; (b) domain_interpreter structurally more resistant to deep-depth drift than requirements_agent. Stage 1D sample at depth ≥3 required to distinguish.

**`broken_reference_validator`** (deterministic, cross-role candidate). Checks all `dependencies[].component_id` fields against the known component-id set (sibling_context + emitted children). Severity: unknown reference at depth 0 → LOW; at depth ≥2 → MEDIUM. Would have caught `comp-db-store` in 21a. Proposed id: `broken_reference_validator`.

**`domain_interpreter` role as saturation-pass executor — catalog note warranted.** domain_interpreter now serves two distinct surfaces: (a) Phase 1.0b–1.0e discovery/bloom; (b) Phase 4.2a component_saturation as explicit executor across all 34 invocations. Catalog §0 should note the dual-surface assignment; "saturation-pass-executor" tag would clarify without requiring a new role entry. The same §5.4 family applies with Phase-4.2a parameterization.

**`architecture_agent` role-mapping confirmation.** Deliberate role boundary confirmed: architecture_agent for flat Phase 4 sub-phases (4.1 discovery-class, 4.2 bloom-class, 4.3 hybrid); domain_interpreter for Phase 4.2a recursive saturation. architecture_agent's revised family mapping is unaffected by the component_saturation role assignment.
