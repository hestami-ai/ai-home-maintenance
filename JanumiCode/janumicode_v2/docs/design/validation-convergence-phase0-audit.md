# Validation Convergence — Phase 0 Reconciliation Audit

Current-state audit of JanumiCode v2's validation, repair, retry, gate, and escalation mechanisms, produced as the Phase 0 deliverable of the Validation Convergence roadmap (`docs/Janumicode_v2 - Validator Subsystem.md`). All findings are grounded in `src/` as of this audit; file paths are relative to `janumicode_v2/`.

---

## 1. Current Validation Flow Map

### 1.1 Per-sub-phase execution path (actual, as implemented)

```text
Sub-Phase starts (StateMachine.setSubPhase)
→ [audit pause hook — auditPauseSync, opt-in via JANUMICODE_AUDIT_PAUSE=1]
→ Phase handler builds context (ContextBuilder / TemplateLoader / dmrHydration)
→ LLMCaller.call (agent_invocation + agent_output records)
   → JSON parse
      → deterministic structural recovery (jsonRecovery.tryParseJson)
      → LLM json_repair fallback: primary → fallback model (jsonRepairLLM.ts)
      → json_repair_record ALWAYS written when repair fires (success or fail)
   → Review Harness hook fires synchronously on every reviewable output
     (llmCaller.setReviewHarnessHook → runReviewHarness)
      → validatorRegistry.selectValidators picks applicable validators
      → sequential dispatch: ~27 deterministic + ~50 LLM validators
      → reasoning_review_harness_record (parent, running → completed via supersession)
      → reasoning_review_finding_record (one per finding per validator)
      → final_synthesis validator sets decision_recommendation
        (ACCEPT / ACCEPT_WITH_NOTES / REVISE / ...)
→ Phase handler persists artifact (phaseUtils: schemaValidator.validate IF schema exists;
   failure is LOGGED as a warning — artifact is still written)
→ ... sub-phases repeat ...
→ Phase handler writes phase_gate_evaluation record directly (heuristic content)
→ eventBus 'phase_gate:pending' → human decision via decisionRouter
   (phase_gate_approved / phase_gate_rejected)
```

### 1.2 Divergences from spec / roadmap assumptions

These are the load-bearing findings of the audit:

1. **`InvariantChecker` is DORMANT.** It is instantiated in `orchestratorEngine.ts` (loading `schemas/invariants/`), but `invariantChecker.check()` is never called from any live code path — only from tests. The spec §8.10 behavior ("invariant failures cause immediate retry with the violation injected into stdin") is documented in the class header but **not implemented anywhere**. `invariant_check_record` and `invariant_violation_record` are declared in `records.ts` but never written.

2. **`PhaseGateEvaluator` is DORMANT.** The class (`phaseGateEvaluator.ts`, 7 ordered criteria with short-circuit per spec §7.11) is instantiated on the engine but `evaluate()` is only invoked from its own unit tests. Instead, every phase handler (`phases/phase05.ts` … `phase10.ts`) writes its `phase_gate_evaluation` record **directly**, with hand-rolled heuristic content (e.g. phase5: `consistency_pass`, `has_unresolved_warnings`, `has_high_severity_flaws` derived from a local consistency check only). Gate content does not enumerate harness findings, schema failures, or repair history.

3. **Verification Ensemble does NOT exist.** `runVerificationEnsemble` is a provider interface on the dormant `PhaseGateEvaluator`; there is no implementation. `verification_ensemble_disagreement` is declared but never written.

4. **`LoopDetectionMonitor` is DORMANT.** Instantiated on the engine; `assess()` is never called in `src/lib`. `loop_detection_record` is never written. The CONVERGING/STALLED/DIVERGING/SCOPE_BLIND classification exists only as tested-but-unwired code.

5. **Harness findings are enforced in exactly ONE place: Phase 9.** `executionScheduler.runLeafAttempt` walks `agent_invocation → agent_output → reasoning_review_harness_record → reasoning_review_finding_record` (via `derived_from_record_ids` LIKE queries) and fails the attempt on any HIGH-severity finding → retry with augmented context → quarantine on budget exhaustion. In phases 0.5–8, harness findings and `decision_recommendation` are **written but never read** — `decision_recommendation` has zero consumers outside the harness itself. Validation output in the planning phases is advisory-only.

6. **Schema validation is non-blocking and partial.** `phaseUtils.ts` validates only when a schema exists (`hasSchema` guard) and logs a warning on failure without preventing the artifact write. Direct `writer.writeRecord` calls in phase handlers bypass schema validation entirely.

### 1.3 Where each roadmap "stage" currently lives

| Roadmap stage | Existing hook | Status |
| --- | --- | --- |
| PRE_GENERATION | `ContextBuilder`, `TemplateLoader`, `dmrHydration` | No validation of context sufficiency |
| POST_GENERATION | JSON parse → `jsonRecovery` → `jsonRepairLLM`; `phaseUtils` schema check | Repair active; schema check advisory |
| POST_VALIDATION | Review harness via `LLMCaller` hook | Active, universal, advisory except Phase 9 |
| POST_REPAIR | None — repaired JSON is not revalidated | Gap |
| PRE_GATE | Phase handlers' inline heuristics | `PhaseGateEvaluator` unwired |
| POST_GATE | `decisionRouter` → `phase_gate_approved/rejected`, `wave_gate_decision` | Active |
| CONTINUOUS | AODD event layer, transformation trace, audit pause | Active; `LoopDetectionMonitor` unwired |

---

## 2. Existing Record Inventory

### 2.1 Actively written, validation-adjacent

| Record type | Writer | Notes for convergence |
| --- | --- | --- |
| `reasoning_review_harness_record` | `reviewHarness.ts` | Parent per reviewed output; running→completed via supersession; carries `decision_recommendation` (unconsumed) |
| `reasoning_review_finding_record` | `reviewHarness.ts` | **One per finding per validator — closest existing analog to `validator_finding_record`.** Keyed by record UUID; no deterministic finding id; no lifecycle status |
| `json_repair_record` | `llmCaller.writeJsonRepairRecord` | Always written when repair fires; links to the invocation (`derived_from_record_ids`), NOT to any finding; per-attempt provider/model/duration/success |
| `task_quarantine` | `quarantineLedger.ts` | **Already a durable obligation with lifecycle** (`pending → rescued / terminally_deferred` via supersession + revision); Phase 9 only |
| `phase_gate_evaluation` | Every phase handler (inline) | Heuristic content; certified artifacts = `derived_from_record_ids` (see `orchestratorEngine.certifiedArtifactIds`) |
| `wave_gate_decision` | `waveGate.ts` | Per-wave human/auto decision |
| `scope_prune_decision` | `downstreamGatekeeper.ts`, phase1, phase4 | Kept/dropped ids + per-id rationale; keep-all fallback on LLM failure |
| `coverage_gap` | phase1, phase2 | Deterministic coverage verification output |
| `warning_acknowledged` / `warning_batch_acknowledged` | clientLiaison `workflowControl` | Human authority level 5 |
| `llm_api_failure` / `llm_api_recovery` | `llmCaller.ts` | Infrastructure failures, invocation-bound |
| `transformation_step` | `src/lib/trace/` | Forensic lineage incl. `json_repaired`, `normalized` with `TransformationFieldDiff` (added/removed/renamed/type_changed/size_changed) — **partial building block for the Phase 5 ArtifactDiffService** |
| `reasoning_review_record` | phase2.ts (one legacy call site) | Retired single-pass reviewer shape; one straggler write remains |

### 2.2 Declared but NEVER written (dormant schema)

`invariant_check_record`, `invariant_violation_record`, `verification_ensemble_disagreement`, `loop_detection_record`, `domain_compliance_review_record`, `reasoning_review_ensemble_record`, `quarantine_override` (DecisionType exists; no writer found in lib).

### 2.3 Classification per roadmap buckets

| Bucket | Members |
| --- | --- |
| **Already usable for convergence** | `reasoning_review_finding_record` (add lifecycle + stable id), `task_quarantine` (generalize its lifecycle pattern), `json_repair_record`, `coverage_gap`, `scope_prune_decision` |
| **Needs extension** | `reasoning_review_harness_record` (consume `decision_recommendation`), `phase_gate_evaluation` (attach findings/convergence evidence), `transformation_step` (diff layer) |
| **Should remain separate** | `llm_api_failure/recovery`, audit-pause markers/AODD events, `warning_acknowledged` |
| **Should be deprecated / reconciled** | `reasoning_review_record` (retire last phase2 write), dormant record types above (either wire or remove from union) |

---

## 3. Retry / Repair Mechanism Inventory

| # | Mechanism | Location | Trigger | Budget | Linked to triggering failure? |
| --- | --- | --- | --- | --- | --- |
| 1 | Deterministic JSON recovery | `jsonRecovery.tryParseJson` | parse failure | 1 | AODD event only |
| 2 | LLM JSON repair (primary → fallback model) | `jsonRepairLLM.ts` via `llmCaller` | recovery failed | 2 sequential | `json_repair_record` → invocation; **not to a finding** |
| 3 | Reasoning-channel extraction | same, `inputIsReasoningChannel` | empty response channel | included in #2 | same |
| 4 | Phase 9 leaf retry | `executionScheduler.runWave` | HIGH harness finding, test failure, write-scope violation, exec error | `leaf_retry_budget` | flaws re-injected as **prompt text** (`buildRetryContext`); no repair record |
| 5 | Quarantine + deferred-batch rescue | `quarantineLedger.ts` | leaf budget exhausted | 1 rescue wave | `task_quarantine.attempts[]` — best structural linkage in the codebase |
| 6 | Persona-id fix retry → fuzzy remap → drop | `phase1.ts` (~3280–3450) | hallucinated persona ids in journeys | 2/journey, 10 total | **Log-only** (`personaRetryLog` in logger); no record; exemplar of identity drift handled ad-hoc |
| 7 | Bloom three-pass retries | `phase2/frBloomThreePass.ts`, `nfrBloomThreePass.ts` | pass-level failures | per-pass | partial, phase-local |
| 8 | Human REJECT / REFRAME | `decisionRouter.ts` | gate decision | n/a | decision records; no repair-event linkage |
| 9 | Scope gatekeeper keep-all fallback | `scopeGatekeeper.ts` | LLM/parse failure | 0 (degrade) | `error` field in result |

**NOT implemented:** invariant-violation retry with stdin injection (documented in `invariantChecker.ts` header, no call site); post-repair revalidation of any kind; MAKER bounds repair (no references found in v2 lib code).

---

## 4. Gap Register

| Capability | Current support | Gap (codebase-grounded) | Recommendation |
| --- | --- | --- | --- |
| Validator findings | Partial | `reasoning_review_finding_record` exists but invariant violations (dormant), coverage gaps, scope prunes, json repairs, write-scope violations are separate shapes; no common projection | Canonical `validator_finding_record` as projection layer + adapters (roadmap Phase 1). Adapter for harness findings is nearly 1:1 |
| Stable finding IDs | Missing | Findings keyed by record UUID; regeneration orphans them (Phase 9 lookup is per-invocation LIKE-walk) | Deterministic `finding_id` hash (roadmap Phase 3 remediation) |
| Finding lifecycle | One island | Only `task_quarantine` has lifecycle state; harness findings have no OPEN/RESOLVED status | **Generalize the QuarantineLedger supersession-revision pattern** — proven, append-only, resume-safe |
| Repair tracking | Partial | `json_repair_record` links to invocation not finding; Phase 9 retries carry flaw context as prompt text only; phase1 persona repair is log-only | `repair_event` record (roadmap Phase 4); wrap mechanisms #2, #4, #6 first |
| Convergence proof | Missing | Nothing verifies findings were resolved before any gate; `decision_recommendation` unconsumed | `validation_convergence_record`, observe-mode first (roadmap Phase 3) |
| Enforcement at gates | Missing (except Phase 9) | `PhaseGateEvaluator` unwired; gate records are handler-local heuristics | Wire evaluator OR retrofit convergence precondition into handlers' gate writes (decide in Phase 6 design; wiring the existing evaluator is the smaller step) |
| Invariant checks | Dormant | Loaded but never executed; record types never written | Wire `invariantChecker.check()` into `phaseUtils.persistArtifact` path as the first POST_GENERATION deterministic validator — cheap, high leverage |
| Loop detection | Dormant | `assess()` never called | Wire into Phase 9 retry loop + future convergence controller |
| Verification ensemble | Missing | Interface only | Defer; treat as Phase 6+ work |
| Targeted revalidation | Missing | Repaired/retried artifacts never revalidated; `transformation_step` field-diff is a partial diff layer | ArtifactDiffService can extend `TransformationFieldDiff` (roadmap Phase 5) |
| Identity convergence | Ad-hoc | phase1 persona remap (retry→fuzzy→drop, log-only); Phase 9 finding lookup by LIKE substring | Entity registry (roadmap Phase 8); persona flow is the motivating exemplar |
| Validator canaries | Missing | Nothing in `src/lib/review/` self-tests validators; `validator_unavailable` failures are recorded (coverage gaps auditable) — partial building block | Roadmap Phase 10 |
| Gate health telemetry | Missing | Gate decisions recorded; no interpretation | Later, non-blocking only |

---

## 5. Exit-Criteria Checklist (roadmap Phase 0)

- **A. Actual code paths documented** — ✅ §1
- **B. Existing validation records mapped** — ✅ §2
- **C. Existing retry/repair mechanisms understood** — ✅ §3
- **D. Minimal schema additions identified** — ✅ `validator_finding_record`, `repair_event`, `validation_convergence_record`; extend (not replace) `reasoning_review_finding_record` and `task_quarantine` patterns
- **E. No duplicated subsystem proposed where existing code can be extended** — ✅ Key reuse decisions:
  1. `reasoning_review_finding_record` is the seed of the canonical finding model — wrap, don't rewrite.
  2. `QuarantineLedger`'s supersession-revision lifecycle is the proven "durable obligation" pattern — generalize it.
  3. `transformation_step` field diffs seed the ArtifactDiffService.
  4. Wire the three dormant components (`InvariantChecker`, `PhaseGateEvaluator`, `LoopDetectionMonitor`) before building replacements — they are spec-complete and unit-tested, just unconnected.

---

## 6. Recommended immediate next steps (Phase 1 entry)

1. Wire `invariantChecker.check()` into the artifact-persist path (observe/log first, no retry yet) so `invariant_check_record`/`invariant_violation_record` start flowing.
2. Define `validator_finding_record` schema with deterministic `finding_id` and lifecycle `status`; build the harness-finding adapter first (near-trivial), then coverage-gap and json-repair adapters.
3. Start consuming `decision_recommendation` in observe mode: record (not enforce) what each sub-phase's harness verdict was at gate time — this is the cheapest convergence signal already being produced and thrown away.

---

## 7. Ontology Coverage Gap Analysis — actual validators vs proposed ontology

The roadmap's ontology consists of: the `validator_finding_record` schema (`stage`, `validator_id`, free-form `validator_family`, `target_type`, `severity`, `failure_mode`), the Phase 7 failure-mode → repair-policy taxonomy (Referential Integrity, Representation, Context, Stale Retrieval, Numeric Infidelity, Goodhart Pressure, Human Judgment Boundary), the Phase 5 impact-matrix validator list, and the Phase 9 process-validator list. The codebase catalog is the ~70-entry `validatorRegistry.ts` plus non-harness validators (invariants, schema, coverage verifier, scope gatekeeper, write-scope check, consistency checkers, loop monitor). Every registry validator exists because a real failure occurred; the mapping below identifies which of those failure classes the ontology cannot express meaningfully.

### 7.1 Well represented (no action)

- **Referential integrity / identity** — `persona_id_continuity`, `journey_id_continuity`, `extraction_id_traceability`, `traces_to_id_validity`, `sr_allocation_completeness` map cleanly to Referential Integrity Failure + the Phase 8 entity registry (missing/duplicate/orphaned/collided identities).
- **Contract/schema** — `contract_schema_validator`, `json_output_discipline_check`, InvariantChecker, SchemaValidator → Contract Violation + Completion/Parse process validator.
- **Human judgment boundary** — `open_question_vs_decided` is a direct implementation of the ontology's Human Judgment Boundary mode.
- **Testability/measurability** — `acceptance_criteria_measurability`, `measurable_condition_executability`, `measurement_method_executability` → `requirement_testability_validator` / `acceptance_criteria_validator`.
- **Interface contracts** — `interface_contract_alignment_validator` → `interface_contract_validator`.

### 7.2 Gaps — real failure classes with no meaningful ontology home

| # | Missing failure mode | Codebase validators that embody it | Why existing modes don't fit |
| --- | --- | --- | --- |
| 1 | **Fabrication / Ungrounded Assertion** (general, non-numeric) | `grounding_validator`, `synthesis_fabrication_check`, `source_attribution_grounding`, `ungrounded_operational_specifics` (URLs, buckets, defaults), `error_type_source_attestation_validator` (4-level attestation ladder), `regime_citation_validity` | Taxonomy covers only Numeric Infidelity and Stale Retrieval. This is the **largest actual validator family** (~10 validators) — invented endpoints, fabricated error types, uncited regulatory regimes are not numbers and not staleness |
| 2 | **Reasoning–Response Divergence** | `reasoning_to_response_faithfulness`, `bloom_completeness_vs_thinking`, jsonRepairLLM's `inputIsReasoningChannel` recovery mode | No ontology concept at all for "final output drops/contradicts content in the model's own reasoning channel" — a documented recurring local-model failure (gemma answer-in-thinking incident) |
| 3 | **Multi-Pass Echo / Handoff Fidelity** (silent drop across pipeline hops) | `enrichment_echo_invariance`, `skeleton_drift_audit`, `compression_fidelity_audit`, `synthesis_coverage_audit`, `handoff_field_completeness`, `source_item_enumeration_completeness` | Representation Failure is about inadequate representation, Context Failure about input assembly. Neither expresses "pass N+1 silently dropped/mutated fields pass N produced" — central to JanumiCode's skeleton→enrichment→saturation design. Impact matrix has no pass-to-pass surface |
| 4 | **Prompt-Exemplar Leakage** | `exemplar_leakage_detector` (Levenshtein vs prompt exemplar block) | Injection Screening covers the inverse direction (untrusted content injecting instructions). The prompt's own scaffolding leaking into authored output is a distinct, occurred failure |
| 5 | **Scope / Pass-Boundary Violation** | `pass_scope_discipline`, `spec_boundary_respect_bloom`, `scope_boundary_adherence_discovery`, `intent_vs_artifact_scope_audit`, Phase 9 write-scope violation check (`executionScheduler`, emits `write_scope_violation` flaws) | Goodhart Pressure and Human Judgment Boundary are adjacent but distinct. "Agent did Pass-3 work at Pass 2" and "executor wrote outside `write_directory_paths`" have no failure mode; the latter is enforcement-relevant TODAY (it already fails leaf attempts) |
| 6 | **Confidence Miscalibration** | `confidence_calibration_lens`, `calibration_rule_consistency_lens`, `threshold_presence_check` (aspirational thresholds), `tier_override_assumption_validator` (undocumented hint override) | No mode for "stated certainty unjustified by evidentiary state." Not Goodhart (no metric gaming), not Representation |
| 7 | **Controlled-Vocabulary Misclassification / Structural Discipline** | `quality_attribute_taxonomy_alignment`, `tier_assignment_audit`, `entity_kind_consistency_validator`, `parent_branch_classification_check`, `decomposition_fanout_discipline` (flat-mapping anti-pattern), `workflow_journey_separation` | These pass schema but violate the *semantics* of a classification system. Contract Violation is too coarse — the repair policy differs (reclassify vs regenerate) |

### 7.3 Secondary gaps

- **Impact matrix surfaces** — the Phase 5 matrix lists 5 diff surfaces; the codebase validates at least 4 more that would need rows: `decomposition_tree_changed` (fanout/tier/branch validators), `release_plan_changed` (`mvp_credibility_check`, `release_balance_audit`, `wave_dependency_topology`, `phasing_dependency_consistency`, `compliance_sequencing_audit`), `handoff_echo_fields_changed` (echo-invariance family), `compliance_items_changed` (compliance family).
- **Loop status `SCOPE_BLIND`** — `LoopDetectionMonitor`'s "has tools it never calls" classification has no process-validator analog; `repair_regression_validator` covers DIVERGING but not SCOPE_BLIND.
- **Degenerate-but-parseable output** — `output_substantiveness_check` sits between Completion/Parse (malformed) and Representation Failure (inadequate); worth an explicit `degenerate_output` failure mode or an extension of Completion/Parse.
- **Bidirectional relational coverage** — the coupling/coverage family (`persona_journey_coupling`, `domain_journey_coupling`, `domain_persona_coherence`, `surface_attribution_completeness`, `source_grouping_coverage`, `coverage_gap` records) generalizes past the entity registry's "orphaned child" rule to arbitrary X↔Y relations; representable but only if `failure_mode` gains a `coverage_gap` value rather than overloading Referential Integrity.

### 7.4 Recommendation

Extend the Phase 7 failure-mode taxonomy BEFORE finalizing the `validator_finding_record` schema, since `failure_mode` drives repair-policy routing. Proposed additions: `ungrounded_assertion`, `reasoning_response_divergence`, `echo_fidelity_violation`, `exemplar_leakage`, `scope_boundary_violation`, `confidence_miscalibration`, `vocabulary_misclassification`, `coverage_gap`, `degenerate_output`. Each carries a distinct disallowed-shallow-repair / required-repair pairing (e.g. echo-fidelity → re-echo from upstream record, never regenerate; exemplar leakage → strip + regenerate field, never accept paraphrase).
