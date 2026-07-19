# JAN-RMAP-001 — Normative Implementation Roadmap

**Version:** 0.1  
**Status:** Proposed normative draft  
**Governing source:** `JAN-REQ-001`  
**Purpose:** Define the dependency-correct order in which the Janumi implementation shall acquire conformant capabilities.

## 1. Normative effect

This roadmap governs **capability order, prerequisites, prohibited shortcuts, evidence, gate acceptance, deferrals, and deviations**. It does not govern dates, staffing, sprint assignments, or estimates. Those belong in a separate mutable operating plan.

A gate may begin in parallel with another gate only when every hard prerequisite is accepted and the work does not create a competing semantic source of truth.

## 2. Acceptance rule

A gate is accepted only when:

- its entrance conditions were satisfied;
- all mandatory outcomes are implemented;
- every requirement first activated at that gate has a conformant disposition or approved deviation;
- the evidence package is complete;
- no unresolved severity-one semantic, authority, tenant-isolation, data-integrity, or recovery defect remains;
- the acceptance authority records a decision.

Code completion, route rendering, successful compilation, or a passing happy-path demonstration is insufficient by itself.

## 3. Gate dependency graph

```text
G0  Normative Baseline
 │
 ▼
G1  Executable Semantic Contract
 │
 ▼
G2  Command / Event / Projection Spine
 │
 ▼
G3  PWU Cognitive Vertical Slice
 │
 ▼
G4  Evidence-Bearing Reasoning and Decision
 │
 ▼
G5  Recursive Work and RPH Coordination
 │
 ├──────────────► G8  Governed Agentic Execution
 ▼
G6  Continuous Reconciliation and Attention
 │
 ▼
G7  JanumiCode End-to-End Product Realization
 │                  ▲
 └──────────────────┘
          │
          ▼
G9  Operational Beta Conformance
```

## 4. Parallel workstreams

| Workstream | Scope |
|---|---|
| Governance and Assurance | Source control, requirements, deviations, conformance, acceptance. |
| Semantic Model and Compiler | CPCO, PWA, JSDL, IR, generators, compatibility. |
| Runtime and Persistence | Commands, aggregates, events, processes, authority, tenancy. |
| Projections and Experience | Read models, shell, workspaces, accessibility, attention. |
| Recursive Coordination and Agents | PWUs, RPHs, durable coordination, agent and sandbox execution. |
| JanumiCode Product Realization | Intent, requirements, architecture, implementation, verification, release, operation. |
| Security, Recovery, and Operations | Isolation, audit, observability, backup, recovery, resource governance. |

## 5. Bootstrap concessions

A temporary implementation concession MAY be approved only when it records:

`Deviation ID`, `reason`, `scope`, `affected requirements`, `risk`, `compensating controls`, `authority`, `expiration gate`, and `required remediation`.

Example: hand-authored TypeScript contracts may temporarily stand in for generated contracts during G1–G2 only when they conform to the approved semantic model, are identified as bootstrap artifacts, and expire no later than the acceptance of the relevant compiler generator.

## 6. Gates

### G0 — Normative Baseline and Reconciliation Control

**Capability outcome:** The documentation corpus, authority hierarchy, extracted obligations, current implementation, and known discrepancies are governed as one baseline.

**Hard prerequisites:** None  
**Primary workstreams:** Governance, Architecture, Assurance

**Entrance conditions**

- The current doctrine and specifications are available for consolidation.

**Mandatory outcomes**

- Assign permanent document IDs, versions, statuses, and authority tiers.
- Materialize the normative corpus in the repository.
- Approve the requirement register extraction method and semantic authority hierarchy.
- Inventory the current code, data model, routes, UI, tests, integrations, runtime services, and deployment.
- Classify every material code-versus-document discrepancy.
- Create the deviation, deferral, and reconciliation registers.
- Establish the rule that scheduling data resides outside the normative roadmap.

**Prohibited shortcuts**

- Assuming the current code is conformant without inspection.
- Treating conversational documents as approved merely because they exist.
- Silently choosing code or documentation as authority during conflicts.
- Adding implementation dates to redefine gate semantics.

**Required evidence package**

- Approved source baseline
- Current implementation inventory
- Requirement register coverage report
- Discrepancy and deviation register
- Authority hierarchy approval record

**Exit gate**

- Every source document has an ID, version, status, and owner.
- Every mandatory requirement has a stable ID and first gate.
- All current implementation areas are marked conformant, nonconformant, unknown, or not applicable.
- No unresolved authority ambiguity blocks G1.

**Permitted deferrals**

- Editorial polishing that does not alter semantics.

**Requirements first activated:** `JAN-REQ-GOV-001`, `JAN-REQ-GOV-012`, `JAN-REQ-GOV-013`, `JAN-REQ-GOV-014`

### G1 — Executable Semantic Contract

**Capability outcome:** The minimum CPCO, PWU, and JanumiCode semantic contract is machine-readable, versioned, deterministic, and usable by frontend and backend implementations.

**Hard prerequisites:** G0  
**Primary workstreams:** Semantic Model, JSDL Compiler, JanumiCode PWA

**Entrance conditions**

- G0 accepted.
- The initial canonical entity and relationship subset is approved.

**Mandatory outcomes**

- Encode stable identity, type, version, provenance, temporal, validity, and relationship contracts.
- Encode the minimum PWU and JanumiCode semantic types required for the first vertical slice.
- Implement the JSDL parser, module resolver, symbol table, type checker, semantic validation, and canonical IR for the accepted subset.
- Generate deterministic TypeScript and JSON Schema contracts with source mappings.
- Implement semantic-model compatibility and model-fingerprint checks.
- Establish semantic boundary conformance tests.

**Prohibited shortcuts**

- Duplicating incompatible hand-written types across frontend and backend.
- Using null or missing fields to imply professional state.
- Collapsing artifact, representation, claim, evidence, decision, or outcome semantics.
- Allowing generators to bypass validated IR.

**Required evidence package**

- Compiling JSDL module set
- Canonical IR and fingerprint
- Generated TypeScript and JSON Schema
- Golden and deterministic-build tests
- Semantic boundary conformance suite

**Exit gate**

- The accepted semantic subset compiles without error.
- Generated types compile and schemas validate canonical fixtures.
- Breaking model changes are detected.
- All G1 requirements are conformant or covered by approved expiring deviations.

**Permitted deferrals**

- Full OpenAPI, PostgreSQL, and documentation generators.
- Domain modules not required by the initial PWU vertical slice.

**Requirements first activated:** `JAN-REQ-GOV-002`, `JAN-REQ-GOV-006`, `JAN-REQ-SEM-001`, `JAN-REQ-SEM-002`, `JAN-REQ-SEM-003`, `JAN-REQ-SEM-004`, `JAN-REQ-SEM-005`, `JAN-REQ-SEM-008`, `JAN-REQ-SEM-018`, `JAN-REQ-SEM-026`, `JAN-REQ-JSDL-001`, `JAN-REQ-JSDL-002`, `JAN-REQ-JSDL-003`, `JAN-REQ-JSDL-004`, `JAN-REQ-JSDL-005`, `JAN-REQ-JSDL-006`, `JAN-REQ-JSDL-007`, `JAN-REQ-JSDL-008`, `JAN-REQ-JSDL-010`

### G2 — Authoritative Command, Event, and Projection Spine

**Capability outcome:** Material professional state changes are authorized, validated, versioned, committed atomically, evented, and exposed through stale-aware projections.

**Hard prerequisites:** G1  
**Primary workstreams:** Runtime, Persistence, Security, Projection Infrastructure, Observability

**Entrance conditions**

- G1 accepted.
- Generated command, event, aggregate, and permission contracts are available.

**Mandatory outcomes**

- Implement tenant-scoped authoritative persistence and aggregate versioning.
- Implement semantic command dispatch, authority evaluation, invariant and validator execution, idempotency, and optimistic concurrency.
- Commit aggregate state, events, command result, idempotency, and outbox atomically.
- Implement immutable event storage and projection checkpoints.
- Implement projection lag and staleness disclosure.
- Implement provenance, audit, model version, causation, correlation, and OpenTelemetry trace boundaries.

**Prohibited shortcuts**

- Generic unrestricted PATCH as the authoritative mutation contract.
- Client-side authoritative mutation.
- Last-write-wins for material professional state.
- Treating broker delivery or projection update as the authoritative commit.
- Bypassing tenant scope in repositories, events, or projections.

**Required evidence package**

- Accepted, rejected, duplicate, stale, and unauthorized command tests
- Atomic failure-injection tests
- Event immutability and ordering tests
- Projection rebuild and lag tests
- Tenant isolation tests
- Trace and audit evidence

**Exit gate**

- The command/event spine passes the JEM conformance subset.
- Projection state is rebuildable and explicitly consistency-qualified.
- No material mutation bypasses the semantic command boundary.

**Permitted deferrals**

- Distributed broker deployment.
- Multi-region consistency.
- Advanced semantic migrations beyond the active model version.

**Requirements first activated:** `JAN-REQ-GOV-005`, `JAN-REQ-GOV-011`, `JAN-REQ-SEM-024`, `JAN-REQ-SEM-025`, `JAN-REQ-PWU-024`, `JAN-REQ-PWU-025`, `JAN-REQ-JEM-001`, `JAN-REQ-JEM-002`, `JAN-REQ-JEM-003`, `JAN-REQ-JEM-004`, `JAN-REQ-JEM-005`, `JAN-REQ-JEM-006`, `JAN-REQ-JEM-007`, `JAN-REQ-JEM-014`, `JAN-REQ-JEM-015`, `JAN-REQ-JEM-016`, `JAN-REQ-OPS-001`, `JAN-REQ-OPS-004`

### G3 — PWU Cognitive Vertical Slice

**Capability outcome:** A professional can create, frame, activate, inspect, block, reopen, and assess completion of a PWU through an authoritative cognitive workspace.

**Hard prerequisites:** G2  
**Primary workstreams:** PWU, Projection, Web UX, Accessibility, Assurance

**Entrance conditions**

- G2 accepted.
- PWU command and projection contracts are available.

**Mandatory outcomes**

- Implement the canonical application shell and professional context header.
- Implement PWU objective, scope, dual state, roles, dependencies, completion conditions, and history.
- Implement create, frame, ready, activate, block, unblock, suspend, reopen, escalate, and complete commands.
- Implement the PWU overview, context inspector, completion readiness, staleness, historical state, and professional error behavior.
- Implement role- and authority-aware command availability.
- Implement accessible alternatives and semantic component tests.

**Prohibited shortcuts**

- Modeling PWUs as tasks or tickets.
- Generic To Do / Doing / Done as the governing state model.
- A chat-first or file-tree-first application shell.
- A percent-complete indicator without professional basis.
- Enabling Complete while mandatory conditions are unsatisfied.

**Required evidence package**

- PWU lifecycle conformance tests
- Completion rejection scenarios
- Stale-command UI scenario
- Route/projection contract tests
- Accessibility evidence
- Critical PWU orientation journey

**Exit gate**

- A user can understand why the PWU exists, what is known, what blocks it, and what can happen next.
- Completion is condition-based and server-authoritative.
- Dual state and provenance remain explicit through all PWU routes.

**Permitted deferrals**

- Advanced graphs and historical comparison.
- Mobile and VS Code adaptations.
- Full domain-specific workspaces.

**Requirements first activated:** `JAN-REQ-GOV-003`, `JAN-REQ-SEM-019`, `JAN-REQ-PWU-001`, `JAN-REQ-PWU-002`, `JAN-REQ-PWU-003`, `JAN-REQ-PWU-004`, `JAN-REQ-PWU-005`, `JAN-REQ-PWU-006`, `JAN-REQ-PWU-007`, `JAN-REQ-PWU-008`, `JAN-REQ-PWU-009`, `JAN-REQ-PWU-017`, `JAN-REQ-PWU-022`, `JAN-REQ-PROJ-001`, `JAN-REQ-PROJ-002`, `JAN-REQ-PROJ-004`, `JAN-REQ-PROJ-005`, `JAN-REQ-PROJ-008`, `JAN-REQ-PROJ-010`, `JAN-REQ-PROJ-011`, `JAN-REQ-PROJ-012`, `JAN-REQ-PROJ-013`, `JAN-REQ-PROJ-014`, `JAN-REQ-PROJ-015`, `JAN-REQ-PROJ-018`, `JAN-REQ-OPS-002`

### G4 — Evidence-Bearing Reasoning and Decision

**Capability outcome:** Questions, uncertainties, assumptions, reasoning, claims, evidence, confidence, alternatives, validation, and decisions are explicit and operable.

**Hard prerequisites:** G3  
**Primary workstreams:** Professional Cognition, Decision, Evidence, UX, Validation

**Entrance conditions**

- G3 accepted.
- Canonical reasoning and evidence entities are generated and persisted.

**Mandatory outcomes**

- Implement Understanding, Reasoning, Evidence, and Decision projections and workspaces.
- Implement explicit claim-evidence relationship semantics and provenance.
- Implement critical assumption, uncertainty, confidence, contradiction, and validation handling.
- Implement decision readiness, authority, alternatives, constraints, rationale, residual uncertainty, and reopening.
- Implement AI contribution attribution as proposed and reviewable.
- Implement explainable indicators and non-graph accessible alternatives.

**Prohibited shortcuts**

- Treating attachments as supporting evidence by proximity.
- Treating AI fluency or confidence as approval.
- Treating a decision as truth.
- Treating inconclusive validation as pass.
- Hiding contradicting evidence to simplify the interface.

**Required evidence package**

- Contradictory-evidence scenario
- Decision readiness and approval scenario
- Assumption invalidation impact test
- AI recommendation attribution test
- Evidence provenance and source validation tests

**Exit gate**

- A material decision can be reconstructed from intent through alternatives, claims, evidence, constraints, authority, and residual uncertainty.
- Contradictory evidence changes readiness without erasing history.
- All material AI contributions remain attributable and reviewable.

**Permitted deferrals**

- Advanced probabilistic confidence models.
- Automated evidence-quality scoring beyond explainable baseline rules.

**Requirements first activated:** `JAN-REQ-GOV-004`, `JAN-REQ-SEM-006`, `JAN-REQ-SEM-007`, `JAN-REQ-SEM-009`, `JAN-REQ-SEM-010`, `JAN-REQ-SEM-011`, `JAN-REQ-SEM-012`, `JAN-REQ-SEM-013`, `JAN-REQ-SEM-014`, `JAN-REQ-SEM-015`, `JAN-REQ-SEM-017`, `JAN-REQ-SEM-020`, `JAN-REQ-SEM-023`, `JAN-REQ-PWU-010`, `JAN-REQ-PWU-011`, `JAN-REQ-PWU-012`, `JAN-REQ-PWU-013`, `JAN-REQ-PWU-014`, `JAN-REQ-PWU-018`, `JAN-REQ-PROJ-003`, `JAN-REQ-PROJ-007`, `JAN-REQ-PROJ-016`

### G5 — Recursive Work and RPH Coordination

**Capability outcome:** Professional work can decompose, delegate, coordinate, change tactics, synthesize, recompose, and escalate without losing coherence.

**Hard prerequisites:** G4  
**Primary workstreams:** Recursive Work, Durable Process, RPH, Coordination UX

**Entrance conditions**

- G4 accepted.
- Durable process storage and timers are available.

**Mandatory outcomes**

- Implement child PWU delegation contracts and typed parent-child relationships.
- Implement cross-PWU dependencies and impact visibility.
- Implement mandatory parent recomposition and synthesis readiness.
- Implement durable RPH lifecycle, plans, allocations, progress assessment, no-progress detection, tactic change, and escalation.
- Implement restart-safe waiting, timers, leases, and process recovery.
- Implement coordination, tactic health, escalation, and synthesis projections.

**Prohibited shortcuts**

- Treating completed children as a completed parent.
- Creating child PWUs solely because the UI needs smaller cards.
- Blindly retrying a failed reasoning tactic.
- Allowing RPH workers to mutate PWU tables directly.
- Keeping human or external waits only in memory.

**Required evidence package**

- Completed-children/incomplete-parent scenario
- Restart during human wait
- No-progress and tactic-change scenario
- Escalation-package scenario
- RPH synthesis and parent completion test

**Exit gate**

- Recursive work survives restart and remains reconstructable.
- Parent completion requires accepted synthesis.
- RPH coordination can responsibly change tactics or escalate.

**Permitted deferrals**

- Advanced allocation optimization.
- Distributed worker topology.
- Predictive coordination analytics.

**Requirements first activated:** `JAN-REQ-GOV-007`, `JAN-REQ-PWU-020`, `JAN-REQ-PWU-021`, `JAN-REQ-PWU-023`, `JAN-REQ-RPH-001`, `JAN-REQ-RPH-002`, `JAN-REQ-RPH-003`, `JAN-REQ-RPH-004`, `JAN-REQ-RPH-005`, `JAN-REQ-RPH-006`, `JAN-REQ-RPH-007`, `JAN-REQ-RPH-008`, `JAN-REQ-RPH-009`, `JAN-REQ-RPH-010`, `JAN-REQ-RPH-011`, `JAN-REQ-JEM-008`, `JAN-REQ-JEM-011`, `JAN-REQ-OPS-003`

### G6 — Continuous Reconciliation and Professional Attention

**Capability outcome:** Coherence loss becomes a first-class, durable, impact-aware, governed process and required human intervention becomes durable professional attention.

**Hard prerequisites:** G5  
**Primary workstreams:** Reconciliation, Attention, Memory, Cross-Aggregate Assurance

**Entrance conditions**

- G5 accepted.
- Contradiction, assumption, validation, and observation events are available.

**Mandatory outcomes**

- Implement reconciliation triggers, cases, impact analysis, before/after state, review, application, partial application, and escalation.
- Apply accepted reconciliation through normal commands and invariants.
- Implement durable attention types, authority, priority, assignment, deferral, and disposition.
- Implement historical reconstruction and source-grounded narrative memory.
- Implement cross-aggregate temporary incoherence controls and expiry.

**Prohibited shortcuts**

- Overwriting conflicting state without reconciliation history.
- Dismissing material attention without disposition.
- Treating narrative summaries as authoritative source data.
- Using timestamp precedence to resolve semantic conflicts.
- Bypassing invariants during reconciliation.

**Required evidence package**

- Critical assumption invalidation scenario
- Observation mismatch reconciliation scenario
- Partial reconciliation application test
- Attention lifecycle and disposition tests
- Narrative grounding and history tests

**Exit gate**

- Material incoherence remains visible until disposition.
- Affected work and decisions are impact-assessed.
- Accepted reconciliation preserves prior state and applies through normal commands.

**Permitted deferrals**

- Advanced automated contradiction inference.
- Cross-enterprise federation reconciliation.

**Requirements first activated:** `JAN-REQ-GOV-008`, `JAN-REQ-GOV-009`, `JAN-REQ-SEM-021`, `JAN-REQ-SEM-022`, `JAN-REQ-PWU-016`, `JAN-REQ-PWU-019`, `JAN-REQ-PROJ-017`, `JAN-REQ-JEM-012`, `JAN-REQ-JEM-013`

### G7 — JanumiCode End-to-End Product Realization

**Capability outcome:** JanumiCode represents and operates the coherent chain from product intent through requirements, architecture, implementation, verification, release, observation, and reconciliation.

**Hard prerequisites:** G6  
**Primary workstreams:** JanumiCode PWA, Domain UX, Repository and CI/CD Integration, Verification

**Entrance conditions**

- G6 accepted.
- JanumiCode JSDL modules and PWA invariants are approved for the target scope.

**Mandatory outcomes**

- Implement product intent, outcomes, journeys, requirements, architecture decisions, invariants, changes, verification, releases, observations, and incidents.
- Implement the Product Realization Map and traceability-gap detection.
- Implement Requirements, Architecture, Implementation, Verification, Release, and Operations workspaces.
- Normalize repository and CI/CD events into CPCO and JanumiCode entities.
- Implement architecture drift and brownfield code-document reconciliation.
- Implement release readiness and production feedback loops.

**Prohibited shortcuts**

- Starting unrestricted coding from ambiguous intent.
- Treating repository, documentation, tests, or CI as automatically authoritative.
- Equating deployment with release acceptance or outcome achievement.
- Treating software phases as a rigid terminal waterfall.
- Closing incidents solely because service was restored.

**Required evidence package**

- Intent-to-production trace journey
- Failed verification propagation journey
- Architecture drift reconciliation scenario
- Release readiness scenario
- Production feedback and incident closure scenarios

**Exit gate**

- A material software change can be traced from intent to production observation.
- Traceability gaps are visible and actionable.
- JanumiCode UI remains cognition-centered rather than module-centered.

**Permitted deferrals**

- All non-core JanumiCode PWU subtypes.
- Advanced market and product analytics.
- Full mobile and VS Code parity.

**Requirements first activated:** `JAN-REQ-SEM-016`, `JAN-REQ-PWU-015`, `JAN-REQ-PROJ-006`, `JAN-REQ-PROJ-009`, `JAN-REQ-JSDL-009`, `JAN-REQ-JCODE-001`, `JAN-REQ-JCODE-002`, `JAN-REQ-JCODE-003`, `JAN-REQ-JCODE-004`, `JAN-REQ-JCODE-005`, `JAN-REQ-JCODE-006`, `JAN-REQ-JCODE-007`, `JAN-REQ-JCODE-008`, `JAN-REQ-JCODE-009`, `JAN-REQ-JCODE-010`, `JAN-REQ-JCODE-011`, `JAN-REQ-JCODE-014`, `JAN-REQ-JCODE-015`, `JAN-REQ-JCODE-016`, `JAN-REQ-JCODE-017`, `JAN-REQ-JCODE-018`, `JAN-REQ-JCODE-019`, `JAN-REQ-JCODE-020`, `JAN-REQ-JCODE-021`, `JAN-REQ-JCODE-022`

### G8 — Governed Agentic Execution

**Capability outcome:** Coding and professional agents operate through bounded contracts, durable execution, isolated tools, explicit authority, validation, provenance, resource governance, and safe escalation.

**Hard prerequisites:** G5  
**Primary workstreams:** Agent Runtime, Sandbox, Model Gateway, AI Governance, JanumiCode

**Entrance conditions**

- G5 accepted.
- Agent contract and tool-permission schemas are approved.

**Mandatory outcomes**

- Implement durable agent executions, model and policy provenance, bounded context projections, tool-call records, resource budgets, safe stop, and escalation.
- Implement coding-agent operating modes, scope, non-goals, required outputs, validations, and completion conditions.
- Implement sandbox isolation, network policy, filesystem policy, artifact extraction, scanning, and cleanup.
- Implement proposal-to-command review boundaries and independent validation where required.
- Implement fair scheduling and resource protection for authoritative services.

**Prohibited shortcuts**

- Granting service-account authority to agents implicitly.
- Persisting material conclusions only in chat transcripts.
- Mounting the host container socket or granting privileged sandbox access.
- Allowing an agent to approve its own work without explicit policy.
- Fabricating success on resource or provider exhaustion.

**Required evidence package**

- Agent contract conformance tests
- Scope-expansion adversarial test
- Tool and sandbox provenance tests
- Sandbox isolation and escape tests
- Resource saturation and safe-stop tests
- AI escalation scenario

**Exit gate**

- Agent output remains proposed unless explicit governed authority applies.
- Agent work is reproducibly attributable to model, context, tools, and validations.
- Sandbox and resource failure cannot corrupt or starve authoritative state.

**Permitted deferrals**

- Multi-provider optimization.
- Advanced GPU sharing.
- Autonomous production deployment.

**Requirements first activated:** `JAN-REQ-GOV-010`, `JAN-REQ-RPH-012`, `JAN-REQ-JEM-009`, `JAN-REQ-JEM-010`, `JAN-REQ-JEM-018`, `JAN-REQ-OPS-005`, `JAN-REQ-OPS-006`, `JAN-REQ-JCODE-012`, `JAN-REQ-JCODE-013`

### G9 — Operational Beta Conformance

**Capability outcome:** The single-node Janumi deployment satisfies the required security, recovery, observability, runtime, and operational assurance needed for controlled beta use.

**Hard prerequisites:** G6, G7, G8  
**Primary workstreams:** Operations, Security, Recovery, Observability, Conformance

**Entrance conditions**

- G6, G7, and G8 accepted.
- Target deployment and supported beta scenarios are declared.

**Mandatory outcomes**

- Complete JEM and JSRP conformance tests for the beta scope.
- Implement startup model compatibility, migrations, health, degraded-mode, backpressure, and administrative controls.
- Implement off-host backup, WAL or equivalent recovery, object storage recovery, restore verification, and runbooks.
- Complete tenant isolation, audit, secret, sandbox, and protected-data reviews.
- Demonstrate projection rebuild, process recovery, event replay safety, and failure isolation.
- Publish capability-specific availability and single-node limitation statements.

**Prohibited shortcuts**

- Claiming high availability because Kubernetes is present on one node.
- Treating untested backups as recovery capability.
- Using direct database edits as normal semantic administration.
- Suppressing degraded capability or stale projection state.
- Accepting beta operation without evidence packages.

**Required evidence package**

- Full beta conformance matrix
- Restore drill
- Tenant isolation and security test report
- Projection rebuild and process-recovery evidence
- Saturation and degraded-mode tests
- Runbook review and operational acceptance

**Exit gate**

- All beta-mandatory requirements are conformant or covered by approved time-bounded deviations.
- Recovery objectives are demonstrated rather than asserted.
- The supported beta operating profile and limitations are explicit.

**Permitted deferrals**

- Multi-node high availability.
- Multi-region operation.
- Enterprise federation and offline runtime.

**Requirements first activated:** `JAN-REQ-JEM-017`, `JAN-REQ-OPS-007`, `JAN-REQ-OPS-008`, `JAN-REQ-OPS-009`, `JAN-REQ-OPS-010`, `JAN-REQ-OPS-011`, `JAN-REQ-OPS-012`

## 7. Cross-cutting obligations

Once activated, the following obligations remain mandatory for every later gate:

- stable identity and semantic versioning;
- provenance and AI attribution;
- tenant and organization isolation;
- optimistic concurrency and typed errors;
- authority at execution time;
- accessibility and semantic state distinctions;
- OpenTelemetry-compatible computational and cognitive observability;
- historical reconstructability and immutable events;
- no silent scope expansion, failure suppression, or conflict overwrite;
- continuous reconciliation of material divergence.

## 8. Gate evidence package structure

```text
gate-evidence/
├── requirement-trace.md
├── implementation-references.md
├── automated-test-results/
├── scenario-results/
├── schemas-and-contracts/
├── ui-evidence/
├── telemetry-evidence/
├── security-and-accessibility/
├── deviations/
├── reconciliations/
└── acceptance-decision.md
```

## 9. Change control

- A sequencing change that preserves semantic obligations may be approved as a roadmap revision.
- A change to meaning, authority, lifecycle, invariants, completion, or conformance requires an upstream source revision and reconciliation.
- A mandatory requirement shall not be silently changed to optional.
- Requirement IDs shall remain stable; superseded requirements retain their history.
- A gate reopened by new evidence returns to `CONDITIONALLY_ACCEPTED` or `NONCONFORMANT` until reconciliation is complete.

## 10. Coding-agent operating contract

For each gate, the coding agent SHALL:

1. Load the applicable source documents and requirement subset.
2. Assess current conformance before changing code.
3. Produce a dependency-aware increment implementation plan.
4. Identify specification ambiguity, code divergence, and bootstrap concessions.
5. Implement only the authorized capability and necessary prerequisites.
6. Preserve semantic command, event, projection, authority, and provenance boundaries.
7. Add automated conformance and acceptance-scenario tests.
8. Update the conformance matrix and evidence package.
9. Escalate rather than invent authority or silently weaken requirements.
10. Refrain from claiming gate completion until the required evidence exists.

## 11. Roadmap definition of done

`JAN-RMAP-001` becomes effective only after G0 acceptance. Until then it is a proposed normative control document.
