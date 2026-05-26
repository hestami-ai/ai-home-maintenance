# Contract Harness — Stage 1 Sub-Phase Boundary Enumeration

Status: planning artifact for review before Stage 2 scaffolding
Date: 2026-05-20

Per-sub-phase enumeration of every contract boundary the harness will cover. Each row is a **producer sub-phase**. Its `artifact_kind` is what downstream consumers read; the `consumed by` column lists the sub-phases (or runtime components) that depend on the artifact.

Conventions:
- "phaseN.M" matches the `phaseId/subPhaseId` pair written to the governed_stream.
- Artifact kind is the `content.kind` string on the `artifact_produced` record, or the `record_type` directly when the sub-phase emits non-artifact records (gates, failures, iterations).
- LLM column indicates whether the sub-phase issues an LLM/CLI call (and therefore has a prompt template), or runs purely deterministically.
- Consumers are listed at the granularity at which they consume — e.g. "phase2.fr_bloom_skeleton" or "phase9.packet_synthesis (packetBuilder.findDataModelsForComponent)".
- "→ downstream" without a specific consumer means the artifact is part of the governed stream and any cross-phase consumer can read it; only the *immediate* consumer is listed for contract purposes.

Numbers in parentheses after a sub-phase id (e.g. "1.0b") are the human-readable sub-phase labels surfaced in trace logs; they're not part of the DB schema.

---

## Phase 0 — Workspace Init

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 0.1 | `workspace_classification` | Classify workspace (greenfield/brownfield/etc.) | Y | `workspace_classification` | phase0.brownfield_continuity_check; phase1 entry; phase9 executor (write-scope determination) |
| 0.2 | `vocabulary_collision_check` | Detect vocabulary collisions in workspace | Y | `collision_risk_report` | phase1.canonical_vocabulary_discovery |
| 0.3 | `external_reference_resolution` | Resolve external doc references | mixed | (artifact handling) | phase0.artifact_ingestion |
| 0.4 | `artifact_ingestion` | Ingest attached files into governed stream | N | `attached_file` records | phase1 LLM context assembly |
| 0.5 | `brownfield_continuity_check` | (brownfield only) Validate continuity vs prior runs | Y | `brownfield_continuity_check` | phase0 gating |

## Phase 1 — Intent Capture

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 1.0a | `intent_quality_check` | Validate raw intent is processable | Y | `intent_quality_check` | phase1.intent_lens_classification |
| 1.0b | `product_intent_discovery` | Extract intent statement and product context | Y | `intent_discovery` | phase1.discovery_bundle_compose; phase1.product_description_synthesis |
| 1.0c | `technical_constraints_discovery` | Extract TECH-* constraints | Y | `technical_constraints_discovery` | phase1.discovery_bundle_compose; phase6 packet `active_constraints` lookup |
| 1.0d | `compliance_retention_discovery` | Extract COMP-* compliance items + retention rules | Y | `compliance_retention_discovery` | phase1.discovery_bundle_compose; phase9.packet_synthesis (compliance items) |
| 1.0e | `vv_requirements_discovery` | Extract VV-* requirements | Y | `vv_requirements_discovery` | phase1.discovery_bundle_compose; phase9.packet_synthesis |
| 1.0f | `canonical_vocabulary_discovery` | Extract canonical project vocabulary | Y | `canonical_vocabulary_discovery` | phase1.discovery_bundle_compose; cross-phase prompt rendering |
| 1.1a | `intent_lens_classification` | Classify intent (product/feature/etc.) | Y | `intent_lens_classification` | All downstream prompt-template selection |
| 1.1b | `scope_bounding` | Bound scope (in/out, confirmed/proposed) | Y | `scope_classification` | phase1.discovery_bundle_compose; phase2 prompt context |
| 1.1c | `discovery_bundle_compose` | Aggregate 1.0a-f + scope into bundle | N | `intent_discovery_bundle`, `compliance_context` | phase1.business_domains_bloom; phase1.user_journey_bloom |
| 1.2 | `business_domains_bloom` | Bloom business domains + personas | Y | `business_domains_bloom` | phase1.user_journey_bloom; phase1.system_workflow_bloom; phase4.software_domains; phase1.release_plan |
| 1.3a | `user_journey_bloom` | Bloom user journeys | Y | `user_journey_bloom` | phase1.system_workflow_bloom; phase1.release_plan; phase2.fr_bloom_skeleton |
| 1.3b | `system_workflow_bloom` | Bloom system workflows | Y | `system_workflow_bloom` | phase1.release_plan; phase3.system_boundary; phase2 (workflow refs from US.traces_to) |
| 1.4 | `entities_bloom` | Bloom domain entities | Y | `entities_bloom` | phase2 (entity refs); phase5.data_model_skeleton |
| 1.5 | `integrations_qa_bloom` | Bloom integrations and QA items | Y | `integrations_qa_bloom` | phase3.interface_contracts; phase5.api_definitions; phase9.packet_synthesis (compliance) |
| 1.6 | `product_description_synthesis` | Narrative product description | Y | `product_description_handoff` | Operator review; phase1.product_handoff_gate |
| 1.7 | `intent_statement` (gate prep) | Synthesize intent_statement artifact | Y | `intent_statement` | phase1.product_handoff_gate |
| 1.8 | `product_handoff_gate` | Phase-1 gate | N | (gate record) | phase2 entry |
| 1.9 | `release_plan` | Build Release Plan v2 | Y | `release_plan` | phase6.task_skeleton; phase4.component_skeleton; downstream release ordinal assignment |

## Phase 2 — Requirements

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 2.1 | `fr_bloom_skeleton` | FR skeleton — user stories + ACs | Y | `functional_requirements` | phase2.fr_saturation; phase3.system_requirements; phase6.task_skeleton (via component traces); phase9.packet_synthesis (US lookup) |
| 2.1a | `fr_saturation` | FR atomic-leaf saturation | Y | `requirement_decomposition_node` (root_kind='fr') | phase3 (atomic FRs); phase6 |
| 2.2 | `nfr_bloom_skeleton` | NFR skeleton + threshold enrichment | Y | `non_functional_requirements` | phase2.nfr_saturation; phase3.system_requirements; phase8 (quality eval); phase9.packet_synthesis (NFR lookup) |
| 2.2a | `nfr_saturation` | NFR atomic-leaf saturation | Y | `requirement_decomposition_node` (root_kind='nfr') | phase3; phase8 |
| 2.3 | `requirement_set_finalize` | Aggregate FR+NFR finalized set | N | `requirement_set` (or finalize record) | phase2.requirements_gate |
| 2.4 | `requirement_set_review_prep` | Prep review materials | N | (review pack) | phase2.requirements_gate |
| 2.5 | `requirements_gate` | Phase-2 gate | N | (gate record) | phase3 entry |

## Phase 3 — System Specification

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 3.1 | `system_boundary` | System boundary definition | Y | `system_boundary` | phase3.system_requirements; phase4.software_domains; phase5 |
| 3.2 | `system_requirements` | SR-* derivation from FR+NFR | Y | `system_requirements` | phase4.component_skeleton (SR allocation invariant); phase6.task_skeleton (task.traces_to SR refs); phase9 (SR resolution from task.traces_to) |
| 3.3 | `interface_contracts` | External interface contracts | Y | `interface_contracts` | phase5.api_definitions; phase9 packet (cross-cutting) |
| 3.4 | `system_spec_finalize` | Aggregate | N | (synthesis record) | phase3.system_spec_gate |
| 3.5 | `system_spec_gate` | Phase-3 gate | N | (gate record) | phase4 entry |

## Phase 4 — Architecture

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 4.1 | `software_domains` | Software domain mapping | Y | `software_domains` | phase4.component_skeleton (input context); phase9 packet (domain_id resolution) |
| 4.2 | `component_skeleton` | Component skeleton w/ responsibilities | Y | `component_model` | phase4.component_saturation; phase5.data_model_skeleton; phase5.api_definitions; phase6.task_skeleton (component allocation); phase7.test_case_skeleton; phase9.packet_synthesis (component lookup) |
| 4.2a | `component_saturation` | Component atomic-leaf saturation | Y | `component_decomposition_node` | phase5; phase6 |
| 4.3 | `adr_capture` | ADR generation | Y | `architectural_decisions` (batch of `adr`) | phase5; phase6 (governing ADRs in task context); phase9 (governing ADRs in stdin) |
| 4.4 | `architecture_synthesis` | Aggregate | N | (synthesis record) | phase4.architecture_gate |
| 4.5 | `architecture_gate` | Phase-4 gate | N | (gate record) | phase5 entry |

## Phase 5 — Technical Specification

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 5.1 | `data_model_skeleton` | Data model skeleton per component | Y | `data_models` (shape: `models[].entities[].fields[]`) | phase5.data_model_saturation; phase6.task_skeleton; phase9.packet_synthesis (`findDataModelsForComponent` — **shape mismatch bug**) |
| 5.1a | `data_model_saturation` | Field-level saturation | Y | `data_model_decomposition_node` | phase6; phase9 |
| 5.2 | `api_definitions` | API endpoints per component | Y | `api_definitions` (shape: `definitions[].endpoints[]`) | phase6.task_skeleton; phase9.packet_synthesis (`findApisForComponent` — **shape mismatch bug**) |
| 5.3 | `error_handling` | Error handling strategies | Y | `error_handling_strategies` | phase6; phase9 (error-handling context) |
| 5.4 | `configuration_parameters` | Config parameters | Y | `configuration_parameters` | phase6; phase9 (config context) |
| 5.5 | `technical_spec_synthesis` | Aggregate | N | (synthesis record) | phase5.technical_spec_gate |
| 5.6 | `technical_spec_gate` | Phase-5 gate | N | (gate record) | phase6 entry |

## Phase 6 — Implementation Planning

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 6.1 | `task_skeleton` | Task skeleton from component model | Y | `implementation_plan` (tasks[]) | phase6.task_saturation; phase7.test_case_skeleton; phase9.packet_synthesis (atomic-task source) |
| 6.1a | `task_saturation` | Task atomic-leaf saturation (Tier C/D) | Y | `task_decomposition_node` (atomic leaves) | phase9.packet_synthesis (atomicTasks input) |
| 6.delta | (cycle re-entry) `task_skeleton` in delta mode | Deterministic per-orphan-US delta task synthesis | N (deterministic) | `implementation_plan` (delta tasks) | phase9.packet_synthesis |
| 6.2 | `implementation_plan_synthesis` | Aggregate skeleton+saturation | N | (synthesis record) | phase6.implementation_plan_gate |
| 6.3 | `implementation_plan_gate` | Phase-6 gate | N | (gate record) | phase7 entry |

## Phase 7 — Test Planning

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 7.1 | `test_case_skeleton` | Test plan skeleton (suites + cases) | Y | `test_plan` (test_suites[].test_cases[]) | phase7.test_case_saturation; phase9.packet_synthesis (`findTestCasesForAcs`) |
| 7.1a | `test_case_saturation` | Test case atomic-leaf saturation | Y | `test_case_decomposition_node` | phase9 |
| 7.delta | (cycle re-entry) | Deterministic per-orphan-AC delta test synthesis | N (deterministic) | `test_plan` (delta suite) | phase9 |
| 7.2 | `test_plan_synthesis` | Aggregate | N | (synthesis record) | phase7.test_plan_gate |
| 7.3 | `test_plan_review_prep` | Review prep | N | (review pack) | phase7.test_plan_gate |
| 7.4 | `test_plan_gate` | Phase-7 gate | N | (gate record) | phase8 entry |

## Phase 8 — Evaluation Planning

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 8.1 | `evaluation_design` (functional) | Functional eval criteria (per US) | Y | `functional_evaluation_plan` | phase9.packet_synthesis (`findEvalsForUserStoriesAndNfrs`) |
| 8.2 | `evaluation_metrics` (quality) | Quality eval criteria (per NFR) | Y | `quality_evaluation_plan` | phase9.packet_synthesis |
| 8.3 | `evaluation_thresholds` (reasoning) | Reasoning eval criteria | Y | `reasoning_evaluation_plan` | phase9.packet_synthesis |
| 8.delta | (cycle re-entry) | Deterministic per-orphan-target delta eval synthesis | N (deterministic) | functional / quality eval plans | phase9 |
| 8.4 | `evaluation_synthesis` | Aggregate | N | (synthesis record) | phase8.evaluation_gate |
| 8.5 | `evaluation_gate` | Phase-8 gate | N | (gate record) | phase9 entry |

## Phase 9 — Execution

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 9.0 | `packet_synthesis` | Build one implementation_packet per atomic task; verify coherence | N (deterministic) | `implementation_packet` per task; `packet_synthesis_failure` if violations | phase9.implementation_task_execution; phase9.cycle_controller (failure routing) |
| 9.1 | `implementation_task_execution` | Executor CLI invocation per task | Y (CLI) | `execution_summary`, `agent_reasoning_step`, file writes | phase9.test_execution |
| 9.2 | `test_execution` | Run test cases | N (CLI) | `test_results` | phase9.evaluation_execution |
| 9.3 | `evaluation_execution` | Run eval criteria | N (deterministic + CLI mix) | `evaluation_result`, `evaluation_results` | phase9.execution_synthesis |
| 9.4 | `execution_synthesis` | Aggregate run results + quarantine | N | `quarantine_summary`, synthesis record | phase9.execution_gate |
| 9.5 | `execution_gate` | Phase-9 gate | N | (gate record) | phase9.cycle_controller |
| 9.6 | `cycle_controller` | Decide restart-or-terminate; ceiling mirror | mixed (decision_bundle if interactive) | `cycle_iteration` (+ optional `decision_bundle`) | Orchestrator main loop (`cycleRestartTo` signal) |

## Phase 10 — Commit

| # | Sub-phase id | Description | LLM | Artifact kind | Consumed by |
|---|---|---|---|---|---|
| 10.1 | `pre_commit_consistency_check` | Final consistency pass | Y | (check report) | phase10.commit_preparation |
| 10.2 | `commit_preparation` | Prep commit message + diff | N | (commit prep record) | phase10.workflow_run_closure |
| 10.3 | `workflow_run_closure` | Close out the workflow run | N | (closure record) | (terminal) |

---

## Boundary count

- **Phase 0:** 5
- **Phase 1:** 17 (including 1.1c bundle compose)
- **Phase 2:** 7
- **Phase 3:** 5
- **Phase 4:** 6
- **Phase 5:** 7
- **Phase 6:** 5 (including 6.delta)
- **Phase 7:** 5 (including 7.delta)
- **Phase 8:** 6 (including 8.delta)
- **Phase 9:** 7
- **Phase 10:** 3

**Total: 73 sub-phase boundaries** — substantially more than my earlier "~40" estimate. The Phase 1 count alone is 17. Some of these are gates/synthesis/review-prep that may not warrant full contracts (their outputs are mechanical aggregations or boolean signals); a reasonable narrowing brings the count of *interesting* contract boundaries to roughly:

- Phase 0: 2 (workspace_classification, vocabulary_collision_check)
- Phase 1: 13 (drop gate, bundle compose passes through verbatim)
- Phase 2: 4 (drop synthesis, review, gate)
- Phase 3: 3
- Phase 4: 4
- Phase 5: 5
- Phase 6: 3 (incl delta)
- Phase 7: 3 (incl delta)
- Phase 8: 4 (incl delta)
- Phase 9: 4 (packet_synthesis, executor, test_execution, cycle_controller)
- Phase 10: 1 (pre_commit_consistency_check)

**~46 high-value contract boundaries** — still meaningfully more than the "~40" estimate, but tractable.

## Known design gaps surfaced by enumeration

These are boundaries where the current artifact shape and the consumer's needs are known to diverge. The contracts will need to take a position on each:

1. **6.1 → 9.0 (`task.traces_to` semantic):** Phase 6 prompt restricts `traces_to` to "responsibility ids / spec ids / component ids"; Phase 9's packetBuilder Pass 1 expects US ids. Contract must declare whether US ids are required, optional, or forbidden.
2. **4.2 → 9.0 (`component.traces_to` field):** Phase 4 emits no `traces_to`; packetBuilder Pass 2 expects it to cite US or responsibility ids. Contract must declare whether the field exists.
3. **2.1 → 4.2 (`US.traces_to` content):** Phase 2 inconsistently includes COMP-* refs (2/17 in ts-17). Contract must declare what id namespaces are valid.
4. **5.1 → 9.0 (data_models shape):** Artifact emits nested `models[].entities[].fields[]`; consumer expects flat `{id, name, component_id, fields}`. Contract must pick a shape.
5. **5.2 → 9.0 (api_definitions shape):** Same pattern as 5.1.
6. **3.2 → 9.0 (`SR.source_requirement_ids`):** Currently traces SR back to NFR, not US. Contract must declare expected upstream id types.
7. **1.3a → 2.1 (`user_journey_bloom` may be empty):** ts-17 had 0 journeys despite UJ ids being referenced throughout the run. Contract must declare non-empty invariant.
8. **1.3b → 4.1 (domain id namespace):** Workflows use `DOM-*` caps; software_domains/components use `domain-*` lower. Contract must reconcile or declare both as valid.

These eight items are exactly the design decisions Path N was sidestepping. Building the contract layer forces us to take a position on each.

## Sub-phases I'm least certain about

These have weak evidence in the source code and may be misclassified — flagging for your review:

- **1.7 `intent_statement`** — I inferred this from the artifact `kind: 'intent_statement'` appearing in the DB, but didn't find a discrete sub-phase write in phase1.ts. May be emitted as part of `product_description_synthesis` instead. **Verify before contract.**
- **1.1c `discovery_bundle_compose`** — exists in phase1.ts (line 937) but the artifacts it emits (`intent_discovery_bundle`, `compliance_context`) may both belong here, or one may belong to 1.0c-e. **Verify.**
- **0.3 `external_reference_resolution`** — listed but I don't know what artifact_kind it emits. **Verify.**
- **Sub-phases without explicit `subPhaseId` writes** (phase4_2a.ts, phase5_1a.ts, phase6_1a.ts, phase7_1a.ts) — I assumed they're called from the parent phase and inherit the sub_phase_id of the saturation pass. **Verify the trace context they use.**
- **Gate sub-phases** — these write gate records, not artifacts. Their "contract" is whether the gate passed and what aggregate signals trigger it. May not warrant the same contract treatment as artifact-producing sub-phases.

## Next step (Stage 2 readiness)

If this enumeration looks right (and after correcting the items above), Stage 2 is scaffolding:

```
src/test/contracts/
  types.ts                       — base ContractClause, ValidationResult, Severity types
  runner.ts                      — runs a list of clauses against an artifact, collects results
  diagnose.ts                    — CLI: --db <path> [--phase N] [--sub-phase X]
  fixtures/                      — empty until Stage 3 populates
  README.md                      — contract-writing conventions
```

No contracts populated yet. Stage 2 build estimate: half a day, no design decisions required.

Stage 3 (populate Phase 9 boundary contracts) is where the eight design-decision items above become unavoidable.
