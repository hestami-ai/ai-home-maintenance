# JAN-IRP-007 — Transition Architecture Specification

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Program phase:** `P5`  
**Purpose:** Define the controlled architecture by which the accepted current implementation becomes the normative target while preserving valid behavior, data, continuity, evidence, and rollback.

## 1. Transition outcome

Every material current-state component and target obligation has an explicit transition strategy, dependency, compatibility condition, migration control, and completion proof.

The transition architecture is the bridge between gap analysis and implementation increments.

## 2. Inputs

```text
Accepted current-state models
Requirement conformance matrix
Accepted discrepancy and reconciliation decisions
Normative target corpus
Data and operational constraints
Repository and build dependency graph
Release and availability requirements
```

## 3. Transition unit

A transition unit may be:

- semantic type or relationship;
- aggregate or state machine;
- database table or migration lineage;
- API or command contract;
- event or process;
- projection or route;
- UI workspace or component;
- validator or invariant;
- agent role or tool boundary;
- deployment service or operational control;
- documentation or generated contract.

Each unit shall receive a transition record.

## 4. Transition record

```text
transitionId
currentElementIds
targetRequirementIds
targetElement
selectedStrategy
rationale
preservedBehavior
retiredBehavior
dataImpact
apiImpact
uiImpact
runtimeImpact
agentImpact
securityImpact
operationalImpact
dependencies
compatibilityWindow
migrationSteps
rollbackOrRecovery
validationPlan
evidencePlan
bootstrapConcessionIds
owner
status
```

## 5. Transition strategies

## 5.1 Preserve

Use when current implementation already satisfies the target or embodies accepted valid behavior.

Required controls:

- establish normative trace;
- add missing tests or documentation;
- protect behavior from regression;
- identify future revisit triggers.

## 5.2 Document

Use when behavior is valid but current-state documentation, generated metadata, or traceability is stale or absent.

## 5.3 Adapt

Use when current structures can be extended or revised incrementally without unsafe semantic ambiguity.

## 5.4 Wrap

Use when an existing or external subsystem cannot immediately conform internally, but a governed adapter can establish canonical identity, validation, authority, events, or projections.

A wrapper shall not hide unresolved semantic loss.

## 5.5 Refactor

Use when behavior is acceptable but internal structure prevents maintainability, conformance, testing, or future extension.

Refactoring shall have preservation tests.

## 5.6 Migrate

Use when state, contracts, consumers, or semantics must move through controlled coexistence.

Migration shall specify source, target, transformation, validation, cutover, and rollback.

## 5.7 Replace

Use only when adaptation or migration cannot responsibly achieve the target.

Replacement shall preserve required data, contracts, evidence, and operational continuity or explicitly retire them under authority.

## 5.8 Retire

Use when current behavior is obsolete, harmful, duplicated, or outside accepted scope.

Retirement shall identify dependent consumers and historical records.

## 5.9 Create

Use when an applicable target capability is absent.

Creation shall still integrate with existing identity, data, authority, UI, and operations.

## 5.10 Escalate

Use when transition selection requires authority, domain judgment, or risk acceptance outside the current boundary.

## 6. Target-to-current mapping

The transition architecture shall include a matrix:

| Target element or requirement | Current implementation | Conformance | Strategy | Dependencies | Increment binding |
|---|---|---|---|---|---|
| PWU dual state | one `status` field | partial | migrate/adapt | schema, API, UI | unresolved until P6 |
| semantic command boundary | direct CRUD PATCH | nonconformant | wrap then replace | authority, events | unresolved until P6 |

A single current component may map to multiple target elements, and multiple current components may converge into one target element.

## 7. Semantic migration

Semantic migration changes professional meaning or distinctions, not merely storage.

Examples:

- splitting one status into lifecycle and cognitive state;
- separating Claim from Evidence;
- converting task completion into completion-condition assessment;
- distinguishing AI proposal from approved Decision;
- converting chat-only reasoning into explicit entities.

Semantic migration shall define:

```text
oldMeaning
newMeaning
ambiguousCases
defaultMapping
manualReviewRules
historyInterpretation
projectionChanges
consumerImpact
```

Ambiguous historical data shall not be assigned invented precision.

## 8. Data migration

Every data migration shall define:

- source schema and version;
- target schema and version;
- transformation rules;
- null and unknown handling;
- tenant isolation;
- referential integrity;
- forward and backward compatibility;
- validation queries;
- rollback or restore;
- historical event interpretation;
- performance and downtime;
- audit.

## 9. API and command transition

Where generic CRUD or incompatible APIs exist, permitted patterns include:

```text
compatibility facade
semantic command adapter
dual endpoint period
consumer-by-consumer migration
versioned event upcasting
strangler replacement
```

During coexistence, one authoritative mutation path shall be designated. Dual writes require reconciliation and consistency controls.

## 10. Event and process transition

Define:

- existing event identities and ordering;
- new canonical events;
- event translation or upcasting;
- replay behavior;
- process-version compatibility;
- in-flight workflow handling;
- timer and callback migration;
- external side-effect idempotency.

## 11. Projection and UI transition

A UI transition shall identify:

- current routes and workspaces to preserve, adapt, redirect, or retire;
- current data sources;
- target projections;
- command migration;
- draft and authoritative state;
- deep-link compatibility;
- stale and historical behavior;
- accessibility;
- user training or release notes.

A visual redesign shall not conceal unresolved semantic migration.

## 12. Agent and RPH transition

Define:

- current agents, prompts, tools, and workflow behavior;
- target professional roles and contracts;
- context projection migration;
- authority and approval boundaries;
- output conversion into CPCO entities;
- persistence of in-flight work;
- retry versus tactic-change behavior;
- safe stop and escalation;
- resource and sandbox changes.

## 13. Bootstrap concessions

A bootstrap concession is a temporary implementation used to unlock a later canonical capability.

Each concession shall record:

```text
concessionId
reason
scope
affectedRequirements
risk
compensatingControls
permittedFromPhase
expirationIncrement
remediation
owner
authority
```

Examples:

- hand-authored TypeScript types before the accepted JSDL generator exists;
- synchronous projection update before asynchronous workers are extracted;
- a compatibility API while consumers migrate.

A concession without an expiration condition is a de facto architecture and requires normal acceptance.

## 14. Transition waves

The architecture may group work into waves:

```text
Wave A  Establish compatibility and evidence-preserving boundaries
Wave B  Introduce canonical semantic and runtime spine
Wave C  Migrate consumers and data
Wave D  Remove legacy authority and retire compatibility layers
Wave E  Rebuild projections and validate operations
```

Waves express dependency and coexistence, not dates.

## 15. Operational continuity

For each transition, define whether the system is:

```text
OFFLINE_MIGRATION
READ_ONLY_WINDOW
DUAL_READ
DUAL_WRITE
SHADOW_MODE
CANARY
FEATURE_FLAGGED
ROLLING
BLUE_GREEN
FULL_CUTOVER
```

The selected mode shall match actual infrastructure capability.

## 16. Rollback and recovery

Rollback is not always possible after semantic or external side effects.

The plan shall distinguish:

- transactional rollback;
- application rollback;
- data restore;
- compensating action;
- forward repair;
- reconciliation of irreversible effects.

## 17. Transition validation

Required validation may include:

- pre/post data invariants;
- old/new behavior comparison;
- contract tests;
- projection equivalence;
- event replay;
- UI critical journeys;
- tenant-isolation tests;
- performance and capacity;
- recovery drill;
- professional review of semantic mappings.

## 18. Transition completion

A transition is complete only when:

- target behavior is accepted;
- required consumers are migrated;
- data conversion is verified;
- old authority is removed or explicitly retained;
- compatibility layers have an accepted disposition;
- historical state remains interpretable;
- operational and recovery evidence exists;
- requirement and evidence records are updated.

## 19. Required P5 outputs

```text
program-instance/transition/current-to-target-mapping.json
program-instance/transition/transition-architecture.md
program-instance/transition/transition-records.json
program-instance/transition/data-migration-strategy.md
program-instance/transition/api-and-event-compatibility.md
program-instance/transition/ui-transition-strategy.md
program-instance/transition/runtime-agent-transition.md
program-instance/transition/bootstrap-concessions.json
program-instance/transition/deprecation-plan.md
program-instance/transition/rollback-and-recovery.md
program-instance/decisions/P5-gate-decision.json
```

## 20. P5 prohibitions

- Do not prescribe a rewrite without component-by-component justification.
- Do not preserve a legacy path merely because migration is inconvenient.
- Do not dual-write without a reconciliation model.
- Do not assign precise new semantics to ambiguous old data without evidence.
- Do not remove historical events or rationale to simplify migration.
- Do not accept a bootstrap concession without expiration.
- Do not separate UI migration from the authoritative data and command transition it represents.
