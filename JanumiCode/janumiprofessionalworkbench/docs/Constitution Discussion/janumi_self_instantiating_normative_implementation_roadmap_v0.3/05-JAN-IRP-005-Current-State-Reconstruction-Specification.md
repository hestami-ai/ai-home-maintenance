# JAN-IRP-005 — Current-State Reconstruction Specification

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Program phase:** `P2`  
**Purpose:** Define the models and evidence required to understand what the current implementation means, how it behaves, and where understanding remains incomplete.

## 1. Reconstruction outcome

The implementation is represented as an evidence-bearing current-state architecture that can be compared responsibly with Janumi's normative target.

An inventory answers **what files exist**. Current-state reconstruction answers:

- What professional concepts does the implementation represent?
- How does state change?
- What authority and evidence are required?
- How are PWUs, PWAs, RPHs, agents, and users experienced?
- Which components are authoritative?
- What happens on failure, restart, conflict, or observation?

## 2. Observation, interpretation, and conclusion

Every reconstruction statement shall be classified as:

```text
OBSERVATION     Directly visible fact.
INTERPRETATION  Meaning inferred from one or more observations.
CONCLUSION      Reviewed current-state claim accepted for conformance assessment.
UNKNOWN         Material question not resolved by available evidence.
```

Example:

```text
Observation: table work_units contains column status varchar(32).
Interpretation: the implementation appears to use one status dimension.
Conclusion: no separate persisted cognitive-state field was found after code, schema, and UI review.
```

## 3. Evidence-backed model element

Each material current-state model element shall contain:

```text
elementId
name
elementType
description
status
confidence
evidenceIds
sourceLocations
relationships
unknowns
reviewStatus
```

## 4. Required reconstruction views

## 4.1 System context and topology

Model:

- users and external actors;
- client surfaces;
- services and processes;
- repositories and packages;
- databases and storage;
- external integrations;
- model providers and sandboxes;
- deployment and network boundaries.

Output: `current-system-context` and `current-deployment-topology`.

## 4.2 Current semantic model

Identify:

- stable identities;
- entity types and subtypes;
- value objects;
- relationships;
- artifacts and representations;
- status and validity fields;
- version and provenance;
- temporal state;
- tenant and organization scope;
- semantic distinctions that are collapsed or absent.

Do not rename current concepts into CPCO terms without preserving original terminology and mapping confidence.

Output: `current-semantic-model` and `current-to-cpco-candidate-map`.

## 4.3 Current PWU and work model

Determine:

- whether PWUs exist as semantic objects, tasks, records, diagrams, or another form;
- objective, scope, Intent, participants, dependencies, completion, and history;
- lifecycle and cognitive state;
- commands and transitions;
- child relationships and recomposition;
- authoring and operational use;
- validation and completion behavior.

Output: `current-pwu-model`.

## 4.4 Current PWA model

Determine:

- how PWAs are represented and authored;
- what domain vocabulary, PWU types, validators, phases, roles, prompts, diagrams, and UI definitions they contain;
- whether PWA configuration is code, database state, documents, or generated content;
- how PWA versions and releases are handled;
- how PWAs affect runtime and UI behavior.

Output: `current-pwa-model`.

## 4.5 Current RPH and coordination model

Determine:

- orchestrators and workflow engines;
- plan, allocation, recursion, child work, waiting, retry, tactic change, synthesis, and escalation;
- durable versus in-memory state;
- agent and human coordination;
- progress measures;
- failure and recovery.

Output: `current-rph-and-coordination-model`.

## 4.6 Command and mutation model

Catalog every material mutation path:

```text
user or process origin
API or handler
command semantics or CRUD operation
authority check
validation
transaction boundary
state change
events and side effects
projection refresh
error behavior
```

Identify direct table writes, generic patches, hidden workflow mutations, administrative bypasses, and client-side authoritative assumptions.

Output: `current-command-and-mutation-model`.

## 4.7 Event, process, and temporal model

Identify:

- domain events;
- integration events;
- outbox or broker usage;
- event ordering and idempotency;
- workflows and durable processes;
- timers and callbacks;
- restart recovery;
- history and snapshots;
- temporal meaning.

Output: `current-event-and-process-model`.

## 4.8 Projection and query model

Identify:

- authoritative read sources;
- materialized or cached views;
- API query contracts;
- graph projections;
- client-side aggregation;
- staleness and refresh;
- historical views;
- role and tenant filtering;
- mutation paths originating from views.

Output: `current-projection-model`.

## 4.9 UI information architecture and interaction model

Reconstruct:

- application shell;
- route hierarchy;
- navigation and breadcrumb semantics;
- screen inventory;
- PWU/PWA/RPH authoring and operation workflows;
- state badges and semantic labels;
- context persistence;
- commands and disabled-action explanations;
- chat, canvas, file-tree, and dashboard roles;
- error, loading, stale, partial, offline, and historical states;
- accessibility.

Output: `current-ui-information-architecture` and `current-critical-user-journeys`.

## 4.10 Authority, identity, and tenant model

Determine:

- authentication principals;
- Participant resolution;
- roles and permissions;
- delegation and approval;
- AI authority;
- service accounts;
- tenant and organization boundaries;
- RLS or equivalent controls;
- cross-tenant administrative access;
- audit.

Output: `current-authority-and-tenancy-model`.

## 4.11 Agent execution model

Determine:

- agent identities and roles;
- model selection;
- prompts and context sources;
- scope and non-goals;
- tool permissions;
- sandboxing;
- outputs and provenance;
- validation and human review;
- retry, no-progress detection, and escalation;
- resource governance;
- persistence of agent work.

Output: `current-agent-execution-model`.

## 4.12 Validation and assurance model

Determine:

- structural validators;
- domain or professional validators;
- invariant enforcement;
- code and artifact review;
- verification and tests;
- approval versus validation;
- waivers;
- evidence retention;
- conformance testing.

Output: `current-validation-and-assurance-model`.

## 4.13 Persistence and aggregate model

Determine:

- authoritative tables and stores;
- aggregate or transaction boundaries;
- version and concurrency behavior;
- history and audit;
- JSON or generic entities;
- relationships;
- migrations;
- generated schemas;
- object storage;
- backup and recovery.

Output: `current-persistence-and-aggregate-model`.

## 4.14 JanumiCode product-realization model

Determine whether and how current implementation connects:

```text
Intent
Outcome
Journey or user understanding
Requirement
Architecture
Implementation
Verification
Release
Observation
Reconciliation
```

Identify breaks, separate modules, undocumented links, and repository-only truth.

Output: `current-product-realization-trace`.

## 4.15 Operations and observability model

Determine:

- runtime topology;
- health and degradation;
- logs, metrics, and traces;
- semantic correlation IDs;
- queues and backpressure;
- resource controls;
- backups and restore;
- incident handling;
- operational attention;
- deployment and rollback.

Output: `current-operations-and-observability-model`.

## 5. Current-state architecture report structure

```text
1. Executive current-state summary
2. Scope and evidence limitations
3. System context
4. Semantic model
5. PWU/PWA/RPH and professional work model
6. Command, event, process, and projection architecture
7. User experience and critical journeys
8. Authority, tenancy, security, and audit
9. Agent execution
10. Data and persistence
11. Validation and assurance
12. Deployment, operations, recovery, and observability
13. JanumiCode realization trace
14. Known inconsistencies and technical debt
15. Unknowns and required investigations
16. Candidate normative mappings
```

## 6. Confidence scale

```text
HIGH       Direct and corroborated evidence; behavior reproduced or strongly established.
MEDIUM     Multiple supporting indications but some runtime or boundary behavior unobserved.
LOW        Plausible interpretation from limited evidence.
UNKNOWN    No responsible conclusion possible.
CONFLICTED Evidence sources disagree.
```

Confidence is not conformance.

## 7. Unknown resolution obligations

Every material unknown shall record:

```text
question
whyMaterial
affectedModels
requiredEvidence
proposedInvestigation
owner
requiredByPhase
currentRisk
```

A focused investigation PWU may be created. Unknowns shall not be closed by confident prose.

## 8. Brownfield authority rule

Current source code and deployed behavior may possess greater authority than stale descriptive documentation **for describing current state**.

They do not automatically possess greater authority than approved target Intent.

When code appears more coherent or valuable than the target draft, record it as candidate `VALID_EXISTING_BEHAVIOR` or `SPECIFICATION_DEFECT` for P4.

## 9. Reconstruction quality tests

A current-state model is insufficient if it:

- lists technologies without semantics;
- equates routes with professional capabilities;
- treats class names as proof of behavior;
- omits failure and recovery;
- omits authority and tenant boundaries;
- assumes comments are current;
- ignores generated artifacts or migrations;
- describes only happy paths;
- maps every current object directly to CPCO without uncertainty;
- infers absent behavior from keyword search alone.

## 10. Independent review

The reviewer shall sample or fully review, according to criticality:

- evidence-to-model traceability;
- claims of absence;
- lifecycle and authority reconstruction;
- current mutation paths;
- tenant boundaries;
- agent authority;
- recovery behavior;
- product-realization trace.

## 11. Required P2 outputs

```text
program-instance/current-state/current-state-architecture.md
program-instance/current-state/current-state-model.json
program-instance/current-state/model-elements.json
program-instance/current-state/unknowns.json
program-instance/current-state/current-to-normative-candidate-map.json
program-instance/current-state/critical-journeys.md
program-instance/reviews/P2-independent-review.md
program-instance/decisions/P2-gate-decision.json
```

## 12. P2 exit conditions

- every material current-state claim cites evidence;
- source observations and interpretations remain distinguishable;
- material unknowns have resolution obligations;
- no critical current-state area is represented solely by undocumented assumption;
- the models are sufficient to assess normative requirements in P3.
