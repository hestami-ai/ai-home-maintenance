# JAN-CONF-001 — Conformance and Evidence Matrix

**Version:** 0.1  
**Status:** Working normative control record  
**Purpose:** Map every requirement to implementation, verification, evidence, deviation, and acceptance.

## Status vocabulary

| Status | Meaning |
|---|---|
| `UNASSESSED` | The implementation has not been inspected against the requirement. |
| `NONCONFORMANT` | Evidence shows the requirement is not satisfied. |
| `PARTIAL` | Some required behavior exists, but the obligation is not fully satisfied. |
| `CONFORMANT` | Required implementation and evidence satisfy the obligation. |
| `DEVIATED` | An approved time-bounded deviation governs temporary nonconformance. |
| `NOT_APPLICABLE` | Approved determination that the requirement does not apply to the scoped release. |
| `BLOCKED` | Assessment or implementation cannot proceed because of a named dependency. |
| `RECONCILIATION_REQUIRED` | Source and implementation meaning conflict and require governed resolution. |

## Matrix

| Requirement | First gate | Status | Implementation reference | Verification / test reference | Evidence reference | Deviation / reconciliation | Review authority |
|---|---|---|---|---|---|---|---|
| `JAN-REQ-GOV-001` | `G0` | `UNASSESSED` | TBD | Architecture review; outcome trace audit | TBD | — | TBD |
| `JAN-REQ-GOV-002` | `G1` | `UNASSESSED` | TBD | Traceability query and conformance test | TBD | — | TBD |
| `JAN-REQ-GOV-003` | `G3` | `UNASSESSED` | TBD | UX review; scenario test; semantic model audit | TBD | — | TBD |
| `JAN-REQ-GOV-004` | `G4` | `UNASSESSED` | TBD | Projection contract tests; decision scenario | TBD | — | TBD |
| `JAN-REQ-GOV-005` | `G2` | `UNASSESSED` | TBD | Event/history replay test; provenance audit | TBD | — | TBD |
| `JAN-REQ-GOV-006` | `G1` | `UNASSESSED` | TBD | Schema and model conformance tests | TBD | — | TBD |
| `JAN-REQ-GOV-007` | `G5` | `UNASSESSED` | TBD | Decomposition/recomposition acceptance journey | TBD | — | TBD |
| `JAN-REQ-GOV-008` | `G6` | `UNASSESSED` | TBD | Reconciliation trigger and application tests | TBD | — | TBD |
| `JAN-REQ-GOV-009` | `G6` | `UNASSESSED` | TBD | Narrative/source trace test; history inspection | TBD | — | TBD |
| `JAN-REQ-GOV-010` | `G8` | `UNASSESSED` | TBD | Agent provenance and authority tests | TBD | — | TBD |
| `JAN-REQ-GOV-011` | `G2` | `UNASSESSED` | TBD | OpenTelemetry contract tests; cognitive metric review | TBD | — | TBD |
| `JAN-REQ-GOV-012` | `G0` | `UNASSESSED` | TBD | Document dependency review; model diff policy | TBD | — | TBD |
| `JAN-REQ-GOV-013` | `G0` | `UNASSESSED` | TBD | Baseline discrepancy register and disposition review | TBD | — | TBD |
| `JAN-REQ-GOV-014` | `G0` | `UNASSESSED` | TBD | Roadmap/operating-plan separation review | TBD | — | TBD |
| `JAN-REQ-SEM-001` | `G1` | `UNASSESSED` | TBD | Schema test; identity persistence test | TBD | — | TBD |
| `JAN-REQ-SEM-002` | `G1` | `UNASSESSED` | TBD | Type-system conformance tests | TBD | — | TBD |
| `JAN-REQ-SEM-003` | `G1` | `UNASSESSED` | TBD | Version-history test; replay test | TBD | — | TBD |
| `JAN-REQ-SEM-004` | `G1` | `UNASSESSED` | TBD | Provenance completeness tests | TBD | — | TBD |
| `JAN-REQ-SEM-005` | `G1` | `UNASSESSED` | TBD | Schema and invariant tests | TBD | — | TBD |
| `JAN-REQ-SEM-006` | `G4` | `UNASSESSED` | TBD | Projection and provenance tests | TBD | — | TBD |
| `JAN-REQ-SEM-007` | `G4` | `UNASSESSED` | TBD | Scenario test; query contract test | TBD | — | TBD |
| `JAN-REQ-SEM-008` | `G1` | `UNASSESSED` | TBD | Representation validator test | TBD | — | TBD |
| `JAN-REQ-SEM-009` | `G4` | `UNASSESSED` | TBD | Assumption impact test | TBD | — | TBD |
| `JAN-REQ-SEM-010` | `G4` | `UNASSESSED` | TBD | Authority/constraint integration test | TBD | — | TBD |
| `JAN-REQ-SEM-011` | `G4` | `UNASSESSED` | TBD | Claim-evidence relationship tests | TBD | — | TBD |
| `JAN-REQ-SEM-012` | `G4` | `UNASSESSED` | TBD | Semantic validator and UI test | TBD | — | TBD |
| `JAN-REQ-SEM-013` | `G4` | `UNASSESSED` | TBD | Reasoning completion test | TBD | — | TBD |
| `JAN-REQ-SEM-014` | `G4` | `UNASSESSED` | TBD | Decision history review | TBD | — | TBD |
| `JAN-REQ-SEM-015` | `G4` | `UNASSESSED` | TBD | Semantic distinction test; UI acceptance test | TBD | — | TBD |
| `JAN-REQ-SEM-016` | `G7` | `UNASSESSED` | TBD | Traceability test | TBD | — | TBD |
| `JAN-REQ-SEM-017` | `G4` | `UNASSESSED` | TBD | Observation-evidence conversion test | TBD | — | TBD |
| `JAN-REQ-SEM-018` | `G1` | `UNASSESSED` | TBD | Artifact/representation model test | TBD | — | TBD |
| `JAN-REQ-SEM-019` | `G3` | `UNASSESSED` | TBD | Dependency schema and blocker tests | TBD | — | TBD |
| `JAN-REQ-SEM-020` | `G4` | `UNASSESSED` | TBD | Validation contract tests | TBD | — | TBD |
| `JAN-REQ-SEM-021` | `G6` | `UNASSESSED` | TBD | Before/after history test | TBD | — | TBD |
| `JAN-REQ-SEM-022` | `G6` | `UNASSESSED` | TBD | Narrative grounding test | TBD | — | TBD |
| `JAN-REQ-SEM-023` | `G4` | `UNASSESSED` | TBD | Relationship and contradiction tests | TBD | — | TBD |
| `JAN-REQ-SEM-024` | `G2` | `UNASSESSED` | TBD | Temporal query tests | TBD | — | TBD |
| `JAN-REQ-SEM-025` | `G2` | `UNASSESSED` | TBD | Event contract and trace tests | TBD | — | TBD |
| `JAN-REQ-SEM-026` | `G1` | `UNASSESSED` | TBD | Semantic conformance suite | TBD | — | TBD |
| `JAN-REQ-PWU-001` | `G3` | `UNASSESSED` | TBD | Aggregate invariant test | TBD | — | TBD |
| `JAN-REQ-PWU-002` | `G3` | `UNASSESSED` | TBD | Traceability test | TBD | — | TBD |
| `JAN-REQ-PWU-003` | `G3` | `UNASSESSED` | TBD | Scope-change command test | TBD | — | TBD |
| `JAN-REQ-PWU-004` | `G3` | `UNASSESSED` | TBD | Schema, API, and UI tests | TBD | — | TBD |
| `JAN-REQ-PWU-005` | `G3` | `UNASSESSED` | TBD | Transition conformance suite | TBD | — | TBD |
| `JAN-REQ-PWU-006` | `G3` | `UNASSESSED` | TBD | Ready-state validator tests | TBD | — | TBD |
| `JAN-REQ-PWU-007` | `G3` | `UNASSESSED` | TBD | Role/authority matrix tests | TBD | — | TBD |
| `JAN-REQ-PWU-008` | `G3` | `UNASSESSED` | TBD | Boundary validation tests | TBD | — | TBD |
| `JAN-REQ-PWU-009` | `G3` | `UNASSESSED` | TBD | Output contract tests | TBD | — | TBD |
| `JAN-REQ-PWU-010` | `G4` | `UNASSESSED` | TBD | Residual uncertainty scenario | TBD | — | TBD |
| `JAN-REQ-PWU-011` | `G4` | `UNASSESSED` | TBD | Lifecycle assurance tests | TBD | — | TBD |
| `JAN-REQ-PWU-012` | `G4` | `UNASSESSED` | TBD | Reasoning record contract tests | TBD | — | TBD |
| `JAN-REQ-PWU-013` | `G4` | `UNASSESSED` | TBD | Confidence reassessment test | TBD | — | TBD |
| `JAN-REQ-PWU-014` | `G4` | `UNASSESSED` | TBD | Decision approval acceptance journey | TBD | — | TBD |
| `JAN-REQ-PWU-015` | `G7` | `UNASSESSED` | TBD | Execution/outcome distinction test | TBD | — | TBD |
| `JAN-REQ-PWU-016` | `G6` | `UNASSESSED` | TBD | Observation-triggered reconciliation test | TBD | — | TBD |
| `JAN-REQ-PWU-017` | `G3` | `UNASSESSED` | TBD | Cross-PWU dependency tests | TBD | — | TBD |
| `JAN-REQ-PWU-018` | `G4` | `UNASSESSED` | TBD | Validation plan and inconclusive test | TBD | — | TBD |
| `JAN-REQ-PWU-019` | `G6` | `UNASSESSED` | TBD | Reconciliation case contract tests | TBD | — | TBD |
| `JAN-REQ-PWU-020` | `G5` | `UNASSESSED` | TBD | Child creation and delegation tests | TBD | — | TBD |
| `JAN-REQ-PWU-021` | `G5` | `UNASSESSED` | TBD | Recomposition-required acceptance journey | TBD | — | TBD |
| `JAN-REQ-PWU-022` | `G3` | `UNASSESSED` | TBD | Completion gate suite | TBD | — | TBD |
| `JAN-REQ-PWU-023` | `G5` | `UNASSESSED` | TBD | Failure/tactic/escalation scenarios | TBD | — | TBD |
| `JAN-REQ-PWU-024` | `G2` | `UNASSESSED` | TBD | Command/event integration tests | TBD | — | TBD |
| `JAN-REQ-PWU-025` | `G2` | `UNASSESSED` | TBD | Stale-command test | TBD | — | TBD |
| `JAN-REQ-RPH-001` | `G5` | `UNASSESSED` | TBD | RPH scenario and state tests | TBD | — | TBD |
| `JAN-REQ-RPH-002` | `G5` | `UNASSESSED` | TBD | Architecture boundary test | TBD | — | TBD |
| `JAN-REQ-RPH-003` | `G5` | `UNASSESSED` | TBD | Child RPH contract tests | TBD | — | TBD |
| `JAN-REQ-RPH-004` | `G5` | `UNASSESSED` | TBD | Plan revision and command boundary tests | TBD | — | TBD |
| `JAN-REQ-RPH-005` | `G5` | `UNASSESSED` | TBD | Allocation policy tests | TBD | — | TBD |
| `JAN-REQ-RPH-006` | `G5` | `UNASSESSED` | TBD | Progress metric review | TBD | — | TBD |
| `JAN-REQ-RPH-007` | `G5` | `UNASSESSED` | TBD | Retry/tactic-change tests | TBD | — | TBD |
| `JAN-REQ-RPH-008` | `G5` | `UNASSESSED` | TBD | Escalation package acceptance test | TBD | — | TBD |
| `JAN-REQ-RPH-009` | `G5` | `UNASSESSED` | TBD | Synthesis and parent completion tests | TBD | — | TBD |
| `JAN-REQ-RPH-010` | `G5` | `UNASSESSED` | TBD | Coordination projection and telemetry tests | TBD | — | TBD |
| `JAN-REQ-RPH-011` | `G5` | `UNASSESSED` | TBD | Human-attention scenario | TBD | — | TBD |
| `JAN-REQ-RPH-012` | `G8` | `UNASSESSED` | TBD | Limit and escalation tests | TBD | — | TBD |
| `JAN-REQ-PROJ-001` | `G3` | `UNASSESSED` | TBD | Projection source contract tests | TBD | — | TBD |
| `JAN-REQ-PROJ-002` | `G3` | `UNASSESSED` | TBD | Mutation boundary tests | TBD | — | TBD |
| `JAN-REQ-PROJ-003` | `G4` | `UNASSESSED` | TBD | Projection disclosure tests | TBD | — | TBD |
| `JAN-REQ-PROJ-004` | `G3` | `UNASSESSED` | TBD | State-mode UI tests | TBD | — | TBD |
| `JAN-REQ-PROJ-005` | `G3` | `UNASSESSED` | TBD | Command availability tests | TBD | — | TBD |
| `JAN-REQ-PROJ-006` | `G7` | `UNASSESSED` | TBD | Cross-surface conformance review | TBD | — | TBD |
| `JAN-REQ-PROJ-007` | `G4` | `UNASSESSED` | TBD | Metric explanation tests | TBD | — | TBD |
| `JAN-REQ-PROJ-008` | `G3` | `UNASSESSED` | TBD | Critical navigation journey | TBD | — | TBD |
| `JAN-REQ-PROJ-009` | `G7` | `UNASSESSED` | TBD | Zoom/time acceptance tests | TBD | — | TBD |
| `JAN-REQ-PROJ-010` | `G3` | `UNASSESSED` | TBD | Shell component and route tests | TBD | — | TBD |
| `JAN-REQ-PROJ-011` | `G3` | `UNASSESSED` | TBD | Information architecture review | TBD | — | TBD |
| `JAN-REQ-PROJ-012` | `G3` | `UNASSESSED` | TBD | Component semantic tests | TBD | — | TBD |
| `JAN-REQ-PROJ-013` | `G3` | `UNASSESSED` | TBD | Disabled-command tests | TBD | — | TBD |
| `JAN-REQ-PROJ-014` | `G3` | `UNASSESSED` | TBD | Automated and manual accessibility tests | TBD | — | TBD |
| `JAN-REQ-PROJ-015` | `G3` | `UNASSESSED` | TBD | Completion readiness test | TBD | — | TBD |
| `JAN-REQ-PROJ-016` | `G4` | `UNASSESSED` | TBD | AI contribution acceptance test | TBD | — | TBD |
| `JAN-REQ-PROJ-017` | `G6` | `UNASSESSED` | TBD | Attention lifecycle tests | TBD | — | TBD |
| `JAN-REQ-PROJ-018` | `G3` | `UNASSESSED` | TBD | Route/projection architecture review | TBD | — | TBD |
| `JAN-REQ-JSDL-001` | `G1` | `UNASSESSED` | TBD | Compiler input coverage test | TBD | — | TBD |
| `JAN-REQ-JSDL-002` | `G1` | `UNASSESSED` | TBD | Package dependency and phase tests | TBD | — | TBD |
| `JAN-REQ-JSDL-003` | `G1` | `UNASSESSED` | TBD | Golden and reproducibility tests | TBD | — | TBD |
| `JAN-REQ-JSDL-004` | `G1` | `UNASSESSED` | TBD | Expression sandbox and fuzz tests | TBD | — | TBD |
| `JAN-REQ-JSDL-005` | `G1` | `UNASSESSED` | TBD | Resolution conformance suite | TBD | — | TBD |
| `JAN-REQ-JSDL-006` | `G1` | `UNASSESSED` | TBD | Generator boundary tests | TBD | — | TBD |
| `JAN-REQ-JSDL-007` | `G1` | `UNASSESSED` | TBD | Generated header/manifest tests | TBD | — | TBD |
| `JAN-REQ-JSDL-008` | `G1` | `UNASSESSED` | TBD | Model-diff tests | TBD | — | TBD |
| `JAN-REQ-JSDL-009` | `G7` | `UNASSESSED` | TBD | Extension safety tests | TBD | — | TBD |
| `JAN-REQ-JSDL-010` | `G1` | `UNASSESSED` | TBD | Diagnostic fixture suite | TBD | — | TBD |
| `JAN-REQ-JEM-001` | `G2` | `UNASSESSED` | TBD | Command acceptance integration test | TBD | — | TBD |
| `JAN-REQ-JEM-002` | `G2` | `UNASSESSED` | TBD | Authority execution-time tests | TBD | — | TBD |
| `JAN-REQ-JEM-003` | `G2` | `UNASSESSED` | TBD | Transactional failure-injection tests | TBD | — | TBD |
| `JAN-REQ-JEM-004` | `G2` | `UNASSESSED` | TBD | Event ordering and immutability tests | TBD | — | TBD |
| `JAN-REQ-JEM-005` | `G2` | `UNASSESSED` | TBD | Duplicate-command tests | TBD | — | TBD |
| `JAN-REQ-JEM-006` | `G2` | `UNASSESSED` | TBD | Optimistic concurrency test | TBD | — | TBD |
| `JAN-REQ-JEM-007` | `G2` | `UNASSESSED` | TBD | Validator contract tests | TBD | — | TBD |
| `JAN-REQ-JEM-008` | `G5` | `UNASSESSED` | TBD | Restart recovery tests | TBD | — | TBD |
| `JAN-REQ-JEM-009` | `G8` | `UNASSESSED` | TBD | Agent execution contract tests | TBD | — | TBD |
| `JAN-REQ-JEM-010` | `G8` | `UNASSESSED` | TBD | External operation failure tests | TBD | — | TBD |
| `JAN-REQ-JEM-011` | `G5` | `UNASSESSED` | TBD | Retry/no-progress tests | TBD | — | TBD |
| `JAN-REQ-JEM-012` | `G6` | `UNASSESSED` | TBD | Reconciliation application tests | TBD | — | TBD |
| `JAN-REQ-JEM-013` | `G6` | `UNASSESSED` | TBD | Cross-aggregate scenario tests | TBD | — | TBD |
| `JAN-REQ-JEM-014` | `G2` | `UNASSESSED` | TBD | Model upgrade and event upcast tests | TBD | — | TBD |
| `JAN-REQ-JEM-015` | `G2` | `UNASSESSED` | TBD | Tenant isolation tests | TBD | — | TBD |
| `JAN-REQ-JEM-016` | `G2` | `UNASSESSED` | TBD | Audit chain tests | TBD | — | TBD |
| `JAN-REQ-JEM-017` | `G9` | `UNASSESSED` | TBD | Replay safety tests | TBD | — | TBD |
| `JAN-REQ-JEM-018` | `G8` | `UNASSESSED` | TBD | Saturation, budget, and safe-stop tests | TBD | — | TBD |
| `JAN-REQ-OPS-001` | `G2` | `UNASSESSED` | TBD | Database transaction integration tests | TBD | — | TBD |
| `JAN-REQ-OPS-002` | `G3` | `UNASSESSED` | TBD | Projection rebuild and lag tests | TBD | — | TBD |
| `JAN-REQ-OPS-003` | `G5` | `UNASSESSED` | TBD | Restart and lease recovery tests | TBD | — | TBD |
| `JAN-REQ-OPS-004` | `G2` | `UNASSESSED` | TBD | Cross-tenant access tests | TBD | — | TBD |
| `JAN-REQ-OPS-005` | `G8` | `UNASSESSED` | TBD | Sandbox escape and policy tests | TBD | — | TBD |
| `JAN-REQ-OPS-006` | `G8` | `UNASSESSED` | TBD | Resource saturation tests | TBD | — | TBD |
| `JAN-REQ-OPS-007` | `G9` | `UNASSESSED` | TBD | Degraded-mode and telemetry tests | TBD | — | TBD |
| `JAN-REQ-OPS-008` | `G9` | `UNASSESSED` | TBD | Restore drill evidence | TBD | — | TBD |
| `JAN-REQ-OPS-009` | `G9` | `UNASSESSED` | TBD | Startup compatibility tests | TBD | — | TBD |
| `JAN-REQ-OPS-010` | `G9` | `UNASSESSED` | TBD | Administrative audit tests | TBD | — | TBD |
| `JAN-REQ-OPS-011` | `G9` | `UNASSESSED` | TBD | Deployment documentation review | TBD | — | TBD |
| `JAN-REQ-OPS-012` | `G9` | `UNASSESSED` | TBD | Architecture conformance review | TBD | — | TBD |
| `JAN-REQ-JCODE-001` | `G7` | `UNASSESSED` | TBD | End-to-end outcome trace scenario | TBD | — | TBD |
| `JAN-REQ-JCODE-002` | `G7` | `UNASSESSED` | TBD | Intent formalization scenario | TBD | — | TBD |
| `JAN-REQ-JCODE-003` | `G7` | `UNASSESSED` | TBD | Requirement conformance tests | TBD | — | TBD |
| `JAN-REQ-JCODE-004` | `G7` | `UNASSESSED` | TBD | Requirement quality validator tests | TBD | — | TBD |
| `JAN-REQ-JCODE-005` | `G7` | `UNASSESSED` | TBD | Journey trace test | TBD | — | TBD |
| `JAN-REQ-JCODE-006` | `G7` | `UNASSESSED` | TBD | Architecture decision scenario | TBD | — | TBD |
| `JAN-REQ-JCODE-007` | `G7` | `UNASSESSED` | TBD | Drift detection and disposition test | TBD | — | TBD |
| `JAN-REQ-JCODE-008` | `G7` | `UNASSESSED` | TBD | Data/interface model validators | TBD | — | TBD |
| `JAN-REQ-JCODE-009` | `G7` | `UNASSESSED` | TBD | Security trace and gate tests | TBD | — | TBD |
| `JAN-REQ-JCODE-010` | `G7` | `UNASSESSED` | TBD | Invariant coverage tests | TBD | — | TBD |
| `JAN-REQ-JCODE-011` | `G7` | `UNASSESSED` | TBD | Plan validator and vertical-slice review | TBD | — | TBD |
| `JAN-REQ-JCODE-012` | `G8` | `UNASSESSED` | TBD | Agent input contract tests | TBD | — | TBD |
| `JAN-REQ-JCODE-013` | `G8` | `UNASSESSED` | TBD | Adversarial agent acceptance tests | TBD | — | TBD |
| `JAN-REQ-JCODE-014` | `G7` | `UNASSESSED` | TBD | Brownfield reconciliation scenario | TBD | — | TBD |
| `JAN-REQ-JCODE-015` | `G7` | `UNASSESSED` | TBD | Change traceability tests | TBD | — | TBD |
| `JAN-REQ-JCODE-016` | `G7` | `UNASSESSED` | TBD | Verification matrix and waiver tests | TBD | — | TBD |
| `JAN-REQ-JCODE-017` | `G7` | `UNASSESSED` | TBD | Release gate scenario | TBD | — | TBD |
| `JAN-REQ-JCODE-018` | `G7` | `UNASSESSED` | TBD | Deployment/observation scenario | TBD | — | TBD |
| `JAN-REQ-JCODE-019` | `G7` | `UNASSESSED` | TBD | Incident closure acceptance test | TBD | — | TBD |
| `JAN-REQ-JCODE-020` | `G7` | `UNASSESSED` | TBD | Critical acceptance journey 1 | TBD | — | TBD |
| `JAN-REQ-JCODE-021` | `G7` | `UNASSESSED` | TBD | Information architecture review | TBD | — | TBD |
| `JAN-REQ-JCODE-022` | `G7` | `UNASSESSED` | TBD | CI/CD normalization tests | TBD | — | TBD |

## Gate acceptance summary

| Gate | Status | Mandatory requirements | Conformant | Partial | Deviated | Nonconformant | Unassessed | Acceptance decision |
|---|---|---:|---:|---:|---:|---:|---:|---|
| `G0` | `NOT_STARTED` | 4 | 0 | 0 | 0 | 0 | 4 | — |
| `G1` | `NOT_STARTED` | 19 | 0 | 0 | 0 | 0 | 19 | — |
| `G2` | `NOT_STARTED` | 18 | 0 | 0 | 0 | 0 | 18 | — |
| `G3` | `NOT_STARTED` | 26 | 0 | 0 | 0 | 0 | 26 | — |
| `G4` | `NOT_STARTED` | 22 | 0 | 0 | 0 | 0 | 22 | — |
| `G5` | `NOT_STARTED` | 18 | 0 | 0 | 0 | 0 | 18 | — |
| `G6` | `NOT_STARTED` | 9 | 0 | 0 | 0 | 0 | 9 | — |
| `G7` | `NOT_STARTED` | 25 | 0 | 0 | 0 | 0 | 25 | — |
| `G8` | `NOT_STARTED` | 9 | 0 | 0 | 0 | 0 | 9 | — |
| `G9` | `NOT_STARTED` | 7 | 0 | 0 | 0 | 0 | 7 | — |

## Required update discipline

- The matrix SHALL be updated in the same change set as implementation and tests.
- `CONFORMANT` requires a specific implementation reference and evidence reference.
- `DEVIATED` requires a valid deviation ID and expiration gate.
- `NOT_APPLICABLE` requires an approval rationale and scope.
- A failed previously accepted conformance test SHALL reopen the affected gate or create reconciliation.
