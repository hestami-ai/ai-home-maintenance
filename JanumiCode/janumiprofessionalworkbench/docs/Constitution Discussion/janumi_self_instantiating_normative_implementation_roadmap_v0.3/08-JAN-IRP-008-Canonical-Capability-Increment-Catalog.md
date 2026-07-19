# JAN-IRP-008 — Canonical Capability Increment Catalog

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Purpose:** Define stable repository-independent capability outcomes and proof obligations from which repository-specific implementation increments are generated.

## 1. Capability principle

A canonical capability describes **what must become professionally and technically true**. It does not prescribe filenames, tasks, dates, or a greenfield implementation sequence.

During P6, each capability is bound to discovered current state and may result in:

```text
PRESERVE
DOCUMENT
ADAPT
WRAP
REFACTOR
MIGRATE
REPLACE
RETIRE
CREATE
DEFER_WITH_AUTHORITY
BLOCKED_BY_UPSTREAM
```

## 2. Dependency graph

```text
C1  Semantic Identity and Contract Foundation
 │
 ▼
C2  Intent, Outcome, Participant, and PWU Semantic Kernel
 │
 ▼
C3  Authoritative Command, Event, and Projection Spine
 │
 ▼
C4  PWU Cognitive Vertical Slice
 │
 ▼
C5  Evidence-Bearing Reasoning and Decision
 │
 ▼
C6  Recursive Decomposition and Recomposition
 │
 ▼
C7  RPH Coordination and Adaptive Tactics
 │
 ▼
C8  Continuous Reconciliation and Professional Attention
 │
 ▼
C9  JanumiCode End-to-End Product Realization
 │                 ▲
 ├────► C10 Governed Agentic Execution
 │                 │
 └─────────────────┘
          │
          ▼
C11 Operational Beta Assurance
```

P6 may authorize partial vertical slices when they do not create competing semantics and their deferred obligations are explicit.

# C1 — Semantic Identity and Contract Foundation

## Outcome

The minimum canonical semantic contract is machine-readable, versioned, deterministic, and shared by implementation surfaces.

## Mandatory capability

- stable globally unique identities;
- explicit entity type and domain subtype;
- mutable entity version;
- provenance, including AI, imported, observed, derived, and reconciled origin;
- temporal and validity state;
- typed references and relationships;
- tenant and organization scope where applicable;
- semantic model version and fingerprint;
- generated or otherwise controlled TypeScript and runtime-validation contracts;
- deterministic build and compatibility detection.

## Proof obligations

- canonical fixtures validate;
- identity survives rename and revision;
- optionality and state are not inferred from missing values;
- generated outputs are reproducible;
- incompatible model changes are detected;
- source mapping identifies normative semantic origin.

## Prohibited shortcuts

- separate incompatible frontend and backend types;
- generic untyped JSON as the only semantic contract;
- entity identity derived from title or path;
- manual generated-file edits as authoritative state;
- null used as workflow state.

## Repository binding questions

- Does a current semantic model already exist?
- Are schemas generated, hand-authored, or inferred from persistence?
- Can current IDs and versions be preserved?
- Does migration require compatibility aliases or upcasters?

# C2 — Intent, Outcome, Participant, and PWU Semantic Kernel

## Outcome

The implementation can represent the smallest coherent Janumi work context and its relationship to professional intent and outcome.

## Mandatory capability

- Intent and Outcome;
- Participant, including human and AI distinction;
- Professional Endeavor or equivalent bounded context;
- PWU identity, type, title, objective, scope, non-goals, owner, participants, parent, root, and history;
- originating Intent and Outcome contribution;
- distinct lifecycle and cognitive state;
- completion conditions and residual uncertainty;
- explicit absent, unknown, not-yet-produced, not-applicable, and intentionally omitted semantics where needed;
- canonical semantic boundary tests.

## Proof obligations

- a PWU cannot become ready without objective, Intent or exploratory purpose, scope, authority, and completion conditions;
- lifecycle and cognitive state persist independently;
- AI Participant identity cannot be attributed to a human;
- a PWU is not modeled as a generic task;
- professional completion is distinguishable from activity completion.

## Prohibited shortcuts

- one generic `status` carrying all state dimensions;
- completion inferred from checked subtasks;
- implicit parent linkage;
- activity-only objective;
- file, ticket, or chat session as the canonical PWU identity.

# C3 — Authoritative Command, Event, and Projection Spine

## Outcome

Material state changes are authenticated, authorized, validated, concurrency-safe, committed atomically, evented, and exposed through consistency-qualified projections.

## Mandatory capability

- semantic command envelope;
- command dispatcher and generated or controlled contracts;
- authority evaluation at execution time;
- aggregate loading and optimistic concurrency;
- payload normalization;
- invariant and validator execution;
- atomic state, version, event, command-result, idempotency, and outbox commit;
- immutable event history and per-aggregate order;
- projection checkpoint, idempotent update, rebuild, staleness, and lag;
- typed professional errors;
- causation, correlation, provenance, audit, and OpenTelemetry trace boundaries;
- tenant-scoped persistence and query.

## Proof obligations

Test accepted, rejected, unauthorized, duplicate, stale, validator-failing, and transaction-failure commands. Rebuild a projection from authoritative state/events. Demonstrate tenant isolation and traceability.

## Prohibited shortcuts

- generic unrestricted PATCH as primary mutation;
- silent last-write-wins;
- projection or client state treated as authoritative;
- broker delivery treated as commit;
- validator directly mutating state;
- unscoped repository access.

# C4 — PWU Cognitive Vertical Slice

## Outcome

A professional can create, frame, activate, inspect, block, await, reopen, reconcile, and assess completion of one PWU through authoritative commands and a coherent workspace.

## Mandatory capability

- PWU lifecycle transitions and explanations;
- professional objective and Intent visibility;
- scope and non-goals;
- participants and authority;
- questions, uncertainty summary, assumptions, constraints, dependencies, validations, and history at the level required by the slice;
- completion-condition assessment;
- role-aware available commands;
- PWU overview projection with source version, completeness, and staleness;
- application shell, cognitive breadcrumb, dual-state header, context inspector, command region, error and conflict behavior;
- accessibility for critical interactions.

## Proof obligations

Critical journey:

```text
create → frame → ready → active → blocked → unblocked → awaiting review
→ completion rejected because a mandatory condition fails → condition resolved
→ completed → reopened by new evidence
```

State, history, projection, UI, authority, and events shall remain coherent throughout.

## Prohibited shortcuts

- task board as the only PWU experience;
- direct status mutation;
- one undifferentiated progress percentage;
- disabled controls without professional explanation;
- UI showing completion when server-side conditions fail.

# C5 — Evidence-Bearing Reasoning and Decision

## Outcome

Professional understanding and commitment are represented through explicit Questions, Uncertainties, Assumptions, Claims, Evidence, Confidence, Alternatives, Reasoning Activities, Validations, and Decisions.

## Mandatory capability

- explicit semantic types and typed relationships;
- separation of Observation, Evidence, Claim, Confidence, Decision, Action, and Outcome;
- evidence support, contradiction, qualification, and inconclusive relationships;
- provenance, reliability, relevance, freshness, and source access;
- reasoning activities with inputs, methods, outputs or no-result disposition, assumptions, limitations, and participant;
- decision readiness, authority, alternatives, constraints, residual uncertainty, rationale, and revisit triggers;
- independent review where policy requires;
- understanding, reasoning, evidence, and decision projections and workspaces.

## Proof obligations

- contradictory evidence changes confidence or readiness without erasing prior state;
- an inconclusive validator does not become pass;
- a decision cannot be approved without authority;
- AI recommendation remains proposed and attributable;
- rejected material alternative retains rationale;
- a Decision is not displayed as truth.

## Prohibited shortcuts

- attachments implying support;
- confidence conflated with approval or completion;
- AI prose treated as authoritative because it is fluent;
- hidden assumptions;
- chat history as the sole reasoning record.

# C6 — Recursive Decomposition and Recomposition

## Outcome

Complex professional work can decompose into child PWUs while preserving delegation, boundaries, dependencies, and mandatory reconstruction of parent coherence.

## Mandatory capability

- parent, root, and child identity;
- semantic child relationship type;
- delegation contract with objective, scope, authority, inputs, outputs, completion, escalation, and recomposition obligation;
- child-independent lifecycle and concurrency;
- cross-child dependencies and contradiction visibility;
- parent synthesis and recomposition model;
- synthesis readiness separate from child completion;
- decomposition projection with accessible non-graph alternative;
- recursion limits and resource governance.

## Proof obligations

- completed children do not complete an incoherent parent;
- cross-child conflict blocks synthesis;
- child reopening triggers parent impact assessment;
- parent output records integrated confidence and residual uncertainty;
- delegation does not erase parent responsibility.

## Prohibited shortcuts

- arbitrary task fragmentation;
- parent completion calculated from child counts;
- hidden cross-child assumptions;
- infinite recursive expansion;
- source folder hierarchy treated as professional decomposition.

# C7 — RPH Coordination and Adaptive Tactics

## Outcome

A durable Recursive Professional Harness can frame, plan, allocate, observe, validate, coordinate, change tactics, synthesize, wait, resume, and escalate across PWUs and subordinate RPHs.

## Mandatory capability

- durable RPH identity, objective, scope, authority, plan, state, coordinated PWUs, child RPHs, policies, and history;
- continuous plan revision through commands;
- capability-, authority-, risk-, cost-, and independence-aware allocation;
- dependency and bottleneck monitoring;
- professional progress measures, not only computational activity;
- no-progress and oscillation detection;
- distinction between technical retry and professional tactic change;
- durable waiting, timers, leases, restart recovery, and external callbacks;
- escalation package and receiving authority;
- synthesis queue and acceptance;
- coordination projection and professional attention.

## Proof obligations

- RPH survives restart while waiting;
- repeated identical failures trigger tactic evaluation rather than blind retry;
- insufficient authority produces escalation rather than fabricated resolution;
- plan changes preserve rationale;
- RPH issues semantic commands rather than direct domain writes;
- child results are synthesized before RPH completion where required.

## Prohibited shortcuts

- in-memory-only correctness;
- workflow termination treated as professional success;
- retry and tactic change conflated;
- hidden human waiting;
- agent selection without authority or resource policy.

# C8 — Continuous Reconciliation and Professional Attention

## Outcome

Detected loss of coherence becomes an explicit, governed, observable process that can revise representations, reopen work or Decisions, accept bounded temporary incoherence, and direct professional attention.

## Mandatory capability

- contradiction and reconciliation entities;
- triggers from evidence, assumption failure, Intent change, validation failure, dependency change, observation mismatch, concurrency, and manual request;
- affected-entity and downstream impact analysis;
- prior/proposed state comparison;
- required authority and validation;
- application through normal semantic commands;
- partial-application handling;
- temporary incoherence record with risk and expiration;
- durable attention items with required role, authority, impact, actions, and disposition;
- reconciliation, attention, history, and narrative projections.

## Proof obligations

- invalidated critical assumption identifies affected Claims, Decisions, PWUs, and Outcomes;
- reconciliation preserves prior state;
- partial failure leaves remaining incoherence visible;
- material attention cannot be silently dismissed;
- notification failure does not erase the Attention Item;
- historical and current state remain distinguishable.

## Prohibited shortcuts

- silent overwrite;
- newest representation automatically winning;
- generic notification as the only intervention state;
- reconciliation bypassing commands and invariants;
- fluent narrative treated as source of truth.

# C9 — JanumiCode End-to-End Product Realization

## Outcome

JanumiCode represents and operates the coherent chain from underspecified product Intent through Outcomes, user understanding, Requirements, Architecture, Implementation, Verification, Release, Observation, and Reconciliation.

## Mandatory capability

- product Intent formalization, scope, assumptions, constraints, non-goals, and success interpretation;
- user or stakeholder Journey and domain understanding;
- Requirements with rationale, acceptance criteria, status, and verification method;
- Architecture elements and Decisions with alternatives, evidence, trade-offs, risks, and revisit triggers;
- invariants with implementation, verification, and observation strategies;
- implementation plan and vertical-slice PWUs;
- repository changes with professional rationale, provenance, review, tests, rollback, and traceability;
- verification and validation with failures, waivers, and evidence;
- Release, deployment, operational Observation, incident, and Outcome assessment;
- Product Realization Map and gap analysis;
- architecture/code/test/operation drift reconciliation.

## Proof obligations

Trace one material change:

```text
Intent → Outcome → Journey → Requirement → Architecture Decision
→ Invariant → Implementation PWU → Change → Verification → Release
→ Deployment Observation → Outcome Assessment → Reconciliation
```

Demonstrate failed verification, architecture drift, production variance, and incident follow-on behavior.

## Prohibited shortcuts

- code or ticket as the organizing truth;
- generated requirements accepted without validation;
- deployment equated with Outcome achievement;
- rigid waterfall as the only lifecycle;
- test counts used as verification sufficiency;
- separate modules with irreconcilable semantics.

# C10 — Governed Agentic Execution

## Outcome

AI agents contribute bounded, attributable, evidence-bearing professional work through explicit contracts, tools, sandboxes, validation, resource governance, safe stop, and escalation.

## Mandatory capability

- Agent identity, professional role, model, version, policy, delegating Participant, and execution record;
- objective, Intent, scope, non-goals, authority, constraints, context projection, Evidence, outputs, validation, completion, termination, and escalation contract;
- tool-call identity, permissions, inputs, outputs, errors, and provenance;
- sandbox CPU, memory, storage, time, process, network, secret, and artifact controls;
- proposed-state default unless explicit authority permits a command;
- output conversion into explicit CPCO entities;
- context minimization without omission of material constraints;
- queue, fairness, budgets, backpressure, and reserved core capacity;
- technical retry, professional tactic change, no-progress detection, safe stop, and escalation;
- human review and independent validation where required.

## Proof obligations

- agent cannot broaden scope silently;
- tool and sandbox boundaries are enforced;
- model/provider failure does not fabricate professional output;
- agent completion does not complete the PWU;
- resource exhaustion produces governed waiting or escalation;
- outputs retain model, context, tool, assumption, evidence, and validation provenance;
- restart preserves execution state or records safe failure.

## Prohibited shortcuts

- service account authority inherited by agent;
- unrestricted network or host socket;
- private chain-of-thought required as professional evidence;
- prompt text as the sole authority control;
- agent self-approval where independent review is required.

# C11 — Operational Beta Assurance

## Outcome

The selected Janumi implementation baseline can operate within its declared profile with credible tenant isolation, security, observability, recovery, resource governance, administrative controls, and explicit availability limits.

## Mandatory capability

- tenant and organization scope across commands, aggregates, events, processes, projections, artifacts, queues, and caches;
- least-privilege database and workload identities;
- protected secrets and evidence;
- capability-specific health and degradation;
- OpenTelemetry traces, metrics, and structured logs for computational and cognitive boundaries;
- queue, projection, process, agent, sandbox, database, disk, and GPU backpressure;
- off-host backup of PostgreSQL, artifacts, configuration, semantic sources, and protected secrets;
- tested restore and projection rebuild;
- startup semantic model, generated contract, migration, and runtime-profile compatibility checks;
- audited administration, overrides, and dead-letter handling;
- secure ingress, egress, containers, sandbox, and database networks;
- declared single-node or distributed availability profile;
- runbooks and incident response.

## Proof obligations

- cross-tenant access fails without metadata leakage;
- duplicate delivery and process lease recovery are safe;
- host or service restart preserves durable work;
- restore drill recovers authoritative state and reconciles checkpoints;
- projection failure is disclosed without corrupting commands;
- agent/sandbox saturation does not starve core semantic transactions;
- administrative actions are audited;
- deployment declares actual, not implied, availability.

## Prohibited shortcuts

- same-host-only backup;
- Kubernetes presented as host-failure HA on one node;
- projection tables used as recovery authority;
- unbounded agent or sandbox resource use;
- secrets in prompts, logs, events, or JSDL source;
- direct semantic row editing as normal administration.

## 3. Capability acceptance rule

A canonical capability is not accepted abstractly. One or more repository-specific increments collectively satisfy it when:

- all applicable mandatory outcomes are implemented or preserved;
- proof obligations are met;
- requirements are traceable;
- migrations and compatibility obligations are complete;
- no unresolved critical discrepancy remains;
- the independent reviewer and acceptance authority approve the evidence.

## 4. Capability deferral

A release profile may defer a capability or sub-capability only when:

- the baseline scope remains coherent;
- no implemented surface falsely claims the deferred semantics;
- dependencies are adjusted;
- affected requirements receive approved deferral or not-applicable disposition;
- revisit conditions are explicit.
