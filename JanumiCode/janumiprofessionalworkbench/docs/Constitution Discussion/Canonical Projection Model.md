# Canonical Projection Model

## CPM Specification v0.1.0

**Document ID:** `JAN-CPM-001`
**Version:** `0.1.0`
**Status:** Draft
**Depends on:** Canonical Professional Cognition Ontology v0.1, Professional Work Unit Specification v0.1, Recursive Professional Harness concepts, Professional Cognition Life Cycle, Reference Experience Model
**Applies to:** Living Enterprise Model, Janumi Professional Workbench, all Professional Work Architectures, web, desktop, mobile, VS Code, agent interfaces, reporting, analytics, and external integrations
**Primary audiences:** UX architects, frontend engineers, platform engineers, coding agents, PWA authors, API designers, data engineers, agent developers

---

# 1. Purpose

The Canonical Projection Model defines how Janumi transforms authoritative professional cognition into bounded, purpose-specific views for humans, artificial intelligence, analytics, governance, and external systems.

The projection model operationalizes the principle:

> One authoritative professional cognition model; many purpose-specific projections.

A projection is not an independent module, document store, application database, or semantic source of truth.

It is a governed interpretation of authoritative Janumi state.

This specification defines:

* what a projection is;
* what a projection may contain;
* how projections are created;
* how users navigate among projections;
* how commands arise from projections;
* how projections remain synchronized;
* how the Living Enterprise Model is understood;
* how UI workspaces map to professional cognition;
* how responsive surfaces preserve semantic continuity;
* how projections avoid fragmenting organizational understanding.

---

# 2. Central Architectural Rule

All material Janumi experiences SHALL be derived from:

```text
Authoritative Cognitive State
        +
PWU Aggregate State
        +
RPH Coordination State
        +
Professional Cognition Life Cycle State
        +
Participant Role and Authority
        +
Current Professional Purpose
        =
Purpose-Specific Projection
```

The implementation SHALL NOT begin by defining independent product modules and later attempting to connect them.

The canonical direction is:

```text
Semantic Model
    ↓
Projection Definition
    ↓
Projection Query
    ↓
Interaction Contract
    ↓
Presentation
```

Not:

```text
Page
    ↓
Local View Model
    ↓
Local Data Store
    ↓
Ad Hoc Integration
```

---

# 3. Canonical Definition

A **Projection** is:

> A derived, bounded, role-aware, temporally qualified, purpose-specific representation of authoritative professional cognition that allows a Participant to inspect, reason about, or act upon selected aspects of that cognition without creating an independent semantic truth.

A projection may:

* filter;
* organize;
* aggregate;
* summarize;
* correlate;
* rank;
* visualize;
* compare;
* calculate;
* explain;
* highlight;
* predict.

A projection SHALL NOT silently:

* alter source semantics;
* invent missing professional state;
* convert inference into fact;
* obscure provenance;
* suppress relevant contradictions;
* create authoritative decisions;
* bypass commands and validations.

---

# 4. Projection Layers

Janumi SHALL distinguish four projection layers.

## 4.1 Semantic Projection

Selects and relates CPCO entities according to professional meaning.

Example:

```text
All Claims supporting Decision D,
their Evidence,
their Assumptions,
their Confidence Assessments,
and all contradicting Claims.
```

## 4.2 Cognitive Projection

Organizes semantic entities around a professional question or cognitive activity.

Example:

```text
What remains uncertain before this architecture decision can be approved?
```

## 4.3 Interaction Projection

Defines what the Participant may inspect, manipulate, propose, approve, or execute.

Example:

```text
A security reviewer may challenge Claims,
add Evidence,
request revision,
or perform Validation,
but may not approve the architecture unless assigned approval authority.
```

## 4.4 Presentation Projection

Defines the concrete interface representation.

Examples:

* graph;
* timeline;
* matrix;
* structured document;
* comparison table;
* canvas;
* card;
* inspector;
* dashboard;
* conversational surface.

Presentation SHALL be replaceable without changing the underlying semantic projection.

---

# 5. Projection Identity

Every material named projection SHALL possess:

```text
projectionDefinitionId
name
purpose
projectionType
sourceModel
applicableRoles
applicablePwa
version
status
```

Runtime projection instances SHOULD identify:

```text
projectionInstanceId
projectionDefinitionId
participantId
contextEntityIds
queryParameters
asOfTime
generatedAt
sourceVersionVector
```

## 5.1 Definition Versus Instance

A projection definition describes how a class of views is constructed.

A projection instance is the result generated for a particular:

* Participant;
* PWU;
* endeavor;
* time;
* role;
* question;
* device;
* operating context.

---

# 6. Projection Types

Canonical projection types include:

```text
overview
detail
cognitive_state
relationship
decomposition
dependency
evidence
decision
reasoning
uncertainty
assumption
constraint
execution
observation
reconciliation
history
comparison
governance
coordination
organizational
narrative
analytic
predictive
external_exchange
```

A PWA MAY define specialized projection types while preserving canonical semantics.

---

# 7. Projection Contract

Every projection definition SHALL declare the following.

## 7.1 Professional Purpose

What professional question or cognitive activity does the projection support?

Example:

```text
Determine whether available evidence is sufficient to approve the proposed architecture decision.
```

## 7.2 Source Entities

Which CPCO entities and RPH or PWU states are included?

## 7.3 Inclusion Rules

Which entities qualify for inclusion?

## 7.4 Exclusion Rules

Which entities are intentionally omitted?

## 7.5 Relationship Rules

Which semantic relationships are traversed and to what depth?

## 7.6 Ordering and Prioritization

How are results ordered?

Potential criteria:

* professional criticality;
* recency;
* uncertainty impact;
* dependency centrality;
* confidence;
* authority;
* decision urgency;
* outcome risk.

## 7.7 Aggregations

Which values are summarized or calculated?

## 7.8 Temporal Basis

Does the projection represent:

* current state;
* state at a historical time;
* change over time;
* predicted future state;
* comparison of two states?

## 7.9 Role and Authority Rules

Who can access the projection and what actions may they initiate?

## 7.10 Required Disclosures

Which provenance, confidence, staleness, contradiction, or incompleteness indicators must be shown?

## 7.11 Interaction Commands

Which semantic commands may be initiated from the projection?

## 7.12 Refresh Rules

How and when does the projection update?

---

# 8. Projection Invariants

## PROJ-INV-001 — Authoritative Source

Every projection SHALL identify its authoritative source entities and versions.

## PROJ-INV-002 — No Independent Mutation

A projection SHALL NOT mutate professional state directly.

All mutations SHALL occur through validated semantic commands.

## PROJ-INV-003 — Provenance Preservation

A projection SHALL preserve access to material provenance.

## PROJ-INV-004 — Confidence Disclosure

A projection presenting Claims, predictions, assessments, or recommendations SHALL expose applicable Confidence Assessments.

## PROJ-INV-005 — Uncertainty Disclosure

A projection SHALL NOT present incomplete professional understanding as settled merely for interface simplicity.

## PROJ-INV-006 — Contradiction Visibility

Material contradictions relevant to the projection purpose SHALL remain visible or explicitly disclosed.

## PROJ-INV-007 — Temporal Qualification

Historical, stale, or predicted state SHALL be clearly distinguishable from current authoritative state.

## PROJ-INV-008 — AI Attribution

AI-generated summaries, interpretations, recommendations, and predictions SHALL remain attributable.

## PROJ-INV-009 — Role Integrity

Available actions SHALL conform to the Participant’s authority and assigned role.

## PROJ-INV-010 — Semantic Continuity

Equivalent projections across web, desktop, mobile, and IDE surfaces SHALL preserve semantic meaning even when layout differs.

## PROJ-INV-011 — Projection Explainability

A material calculated indicator SHALL provide an explanation of its basis.

## PROJ-INV-012 — Suppression Disclosure

When a projection intentionally omits relevant entities because of filtering, security, scope, or summarization, the omission SHALL be detectable.

## PROJ-INV-013 — State Distinction

Projection loading state, stale state, partial state, and professional lifecycle state SHALL remain separate.

## PROJ-INV-014 — No False Completeness

A projection SHALL not imply full organizational coverage when source data is incomplete.

## PROJ-INV-015 — Command Traceability

Every command initiated through a projection SHALL retain the originating projection context.

---

# 9. The Living Enterprise Model

The Living Enterprise Model is not a single projection.

It is the authoritative, continuously reconciled semantic state from which enterprise-level projections are derived.

The term may refer to two related concepts:

## 9.1 Authoritative Living Model

The current governed graph of:

* endeavors;
* outcomes;
* intents;
* PWUs;
* RPHs;
* participants;
* representations;
* claims;
* evidence;
* decisions;
* capabilities;
* dependencies;
* actions;
* observations;
* reconciliations;
* organizational memory.

## 9.2 Living Enterprise Projections

Views over that authoritative model, including:

* organizational reasoning landscape;
* outcome portfolio;
* coherence map;
* uncertainty landscape;
* decision portfolio;
* dependency network;
* capability map;
* risk and issue landscape;
* reconciliation backlog;
* organizational memory timeline.

The UI SHALL NOT label one narrow visualization as though it were the complete Living Enterprise Model.

---

# 10. Canonical Cognitive Projections

The following projections implement the Professional Cognition Life Cycle.

---

# 10.1 Intent Projection

## Purpose

Allow Participants to understand why work exists and whether current work remains aligned with desired outcomes.

## Primary entities

```text
Intent
Outcome
Stakeholder
Constraint
PWU
Decision
Action
```

## Core questions

* What are we trying to achieve?
* Why does it matter?
* Who is affected?
* Which constraints govern the endeavor?
* What work traces to this Intent?
* Has the Intent changed?
* Where has drift occurred?

## Required disclosures

* active Intent version;
* superseded Intent;
* rationale;
* non-goals;
* authority;
* downstream impact;
* unresolved interpretation conflicts.

## Permitted commands

```text
ProposeIntent
ReviseIntent
SupersedeIntent
LinkEntityToIntent
IdentifyIntentConflict
RequestIntentClarification
```

---

# 10.2 Understanding Projection

## Purpose

Expose the current state of professional understanding.

## Primary entities

```text
Question
Uncertainty
Claim
Assumption
Constraint
Representation
ConfidenceAssessment
```

## Core questions

* What do we know?
* What do we think we know?
* What remains unresolved?
* Which assumptions are carrying the reasoning?
* Where is confidence low?
* Which questions most affect outcomes?

## Required visual distinctions

The projection SHALL distinguish:

```text
observed
claimed
assumed
inferred
decided
unknown
contested
```

---

# 10.3 Reasoning Projection

## Purpose

Make professional reasoning inspectable and operable.

## Primary entities

```text
ReasoningActivity
Input Entity
Output Entity
Participant
Method
Alternative
Question
Claim
```

## Core questions

* What reasoning is underway?
* Who or what is performing it?
* Which inputs are being used?
* Which methods are being applied?
* What outputs emerged?
* What limitations remain?
* Where has reasoning failed or stalled?

## Canonical representations

* reasoning graph;
* reasoning activity stream;
* analysis workspace;
* alternative comparison;
* decomposition tree;
* synthesis view.

## Required disclosure

AI internal private chain-of-thought is not required.

The system SHALL provide professional rationale, sources, assumptions, methods, and limitations sufficient for evaluation.

---

# 10.4 Evidence Projection

## Purpose

Evaluate the evidentiary basis of professional Claims, Assumptions, Decisions, and Outcomes.

## Primary entities

```text
Evidence
Claim
Assumption
Observation
ConfidenceAssessment
Validation
Source
```

## Core questions

* What supports this Claim?
* What contradicts it?
* How reliable is the Evidence?
* Is the Evidence current?
* Is the source authoritative?
* Which Claims lack sufficient Evidence?
* Which Evidence supports multiple conclusions?

## Canonical visualizations

* evidence graph;
* claim-evidence matrix;
* evidence quality table;
* provenance chain;
* support-versus-contradiction view;
* evidence gap analysis.

## Prohibition

Attachments SHALL NOT be shown as though attachment alone establishes evidentiary relevance.

---

# 10.5 Decision Projection

## Purpose

Support authorized professional commitment under uncertainty.

## Primary entities

```text
Decision
Question
Alternative
Claim
Evidence
Constraint
Risk
ConfidenceAssessment
Participant
```

## Core questions

* What decision is required?
* Who has authority?
* Which alternatives exist?
* What supports each alternative?
* What trade-offs apply?
* What uncertainty remains?
* What constraints are mandatory?
* What happens if the decision is deferred?

## Canonical presentation

A material Decision projection SHOULD include:

```text
Decision Question
Decision Status
Authority
Alternatives
Evaluation Criteria
Supporting Claims
Supporting Evidence
Contradicting Evidence
Assumptions
Constraints
Risks
Residual Uncertainty
Recommendation
Rationale
Effective Time
```

## Permitted commands

```text
ProposeDecision
RequestDecision
ApproveDecision
RejectDecision
DeferDecision
ReopenDecision
SupersedeDecision
```

Actions SHALL vary by authority.

---

# 10.6 Execution Projection

## Purpose

Show how Decisions are being translated into Actions and changes in reality.

## Primary entities

```text
Action
Decision
Artifact
Participant
Dependency
Constraint
Outcome
```

## Core questions

* What has been authorized?
* What is currently being executed?
* Who or what is executing it?
* Which dependencies apply?
* What intended effect is expected?
* What evidence of execution exists?
* What remains incomplete?

## Prohibition

Execution success SHALL NOT be presented as outcome success without applicable Observation and Validation.

---

# 10.7 Observation Projection

## Purpose

Compare observed reality with expected reality.

## Primary entities

```text
Observation
Action
Expected Observation
Outcome
Claim
Assumption
Representation
Evidence
```

## Core questions

* What happened?
* What was expected?
* What differed?
* Is the variance meaningful?
* Does this invalidate an Assumption or Claim?
* Does this require reconciliation?

## Canonical visualizations

* expected-versus-observed comparison;
* temporal telemetry;
* anomaly view;
* outcome assessment;
* observation provenance;
* operational feedback map.

---

# 10.8 Reconciliation Projection

## Purpose

Expose, analyze, and resolve coherence loss.

## Primary entities

```text
Reconciliation
Contradiction
Affected Entity
Affected PWU
Affected Decision
Affected Outcome
Proposed Revision
Validation
```

## Core questions

* What became incoherent?
* What triggered detection?
* Which entities are affected?
* What prior Decisions depend on the affected state?
* What changes are proposed?
* What downstream consequences follow?
* Who must approve the resolution?
* Which contradictions remain?

## Canonical states

```text
detected
analyzing
proposed
under_review
accepted
rejected
applied
partially_applied
escalated
```

## Critical rule

The prior state SHALL remain inspectable after reconciliation is applied.

---

# 11. Structural Projections

---

# 11.1 PWU Workspace Projection

The PWU Workspace is the canonical local projection of one semantic PWU.

It SHALL integrate, not duplicate, the underlying cognitive projections.

## Required regions

### Context Header

Shows:

* PWU title;
* professional objective;
* lifecycle state;
* cognitive state;
* parent context;
* Intent;
* owner or coordinating harness;
* current disposition.

### Cognitive Summary

Shows:

* current understanding;
* primary uncertainty;
* current confidence;
* active reasoning;
* pending decision;
* material contradiction;
* next professional transition.

### Projection Selector

Allows movement among:

```text
Overview
Understanding
Reasoning
Evidence
Decisions
Execution
Observation
Reconciliation
Decomposition
History
```

### Context Inspector

Provides persistent access to:

```text
Scope
Participants
Assumptions
Constraints
Dependencies
Validations
Provenance
```

### Command Region

Displays only commands valid for:

* current lifecycle state;
* current cognitive state;
* user role;
* authority;
* validation condition;
* PWA policy.

---

# 11.2 Decomposition Projection

## Purpose

Represent recursive composition and the obligation to reconstruct coherent understanding.

## Primary entities

```text
Parent PWU
Child PWU
Delegation Contract
Dependency
Recomposition Requirement
RPH
```

## Required information

For each child PWU:

* delegated objective;
* relationship type;
* lifecycle state;
* cognitive state;
* assigned Participants;
* blocking condition;
* required output;
* residual uncertainty;
* recomposition status.

## Required parent indicators

* cross-child contradictions;
* unresolved interfaces;
* missing outputs;
* child confidence distribution;
* synthesis readiness;
* parent completion blockers.

## Prohibition

The decomposition view SHALL NOT imply parent completion merely because all children display completion.

---

# 11.3 Dependency Projection

## Purpose

Expose professional dependency structure and propagation risk.

## Dependency categories

```text
informational
logical
temporal
resource
authority
evidence
validation
implementation
operational
external
```

## Required capabilities

* filter by dependency type;
* identify blockers;
* show upstream and downstream impact;
* identify circular dependencies;
* identify unresolved cross-PWU dependencies;
* trace change propagation;
* initiate impact assessment.

---

# 11.4 History Projection

## Purpose

Preserve reconstructability across time.

## Required capabilities

* view entity evolution;
* compare versions;
* inspect state transitions;
* inspect commands and resulting events;
* inspect provenance;
* view decisions effective at a particular time;
* reconstruct the PWU or endeavor as of a historical point;
* inspect reconciliation history.

## Temporal modes

```text
current
as_of
between_versions
change_since
decision_time
observation_time
recorded_time
```

---

# 12. Coordination Projections

---

# 12.1 RPH Coordination Projection

## Purpose

Allow authorized Participants to supervise professional coordination.

## Primary entities

```text
RPH
PWU
Participant
Dependency
Validation
Reconciliation
Escalation
Tactic
```

## Required views

### Work Portfolio

Shows active, awaiting, blocked, reconciling, completed, and escalated PWUs.

### Coordination Bottlenecks

Shows:

* authority bottlenecks;
* evidence bottlenecks;
* validation bottlenecks;
* expertise bottlenecks;
* dependency bottlenecks;
* synthesis bottlenecks.

### Tactic Health

Shows:

* current strategy;
* iterations attempted;
* uncertainty reduction;
* repeated failures;
* oscillation;
* tactic-change triggers.

### Delegation Tree

Shows recursive RPH and PWU delegation.

### Escalation Queue

Shows:

* escalation reason;
* responsible authority;
* risk of delay;
* risk of proceeding;
* recommended options;
* elapsed wait.

### Synthesis Queue

Shows parent PWUs awaiting recomposition or cross-child synthesis.

---

# 12.2 Organizational Reasoning Landscape

## Purpose

Provide a cross-endeavor view of current organizational cognition.

## Required dimensions

```text
Outcomes
Intents
PWAs
Endeavors
PWUs
Participants
Uncertainty
Decisions
Evidence
Risk
Coherence
Reconciliation
```

## Canonical questions

* Where is the organization least certain?
* Which outcomes are most threatened?
* Which decisions are bottlenecked?
* Where is evidence weakest?
* Which assumptions create systemic exposure?
* Which PWUs are central dependencies?
* Where is organizational reasoning fragmented?
* Which AI Participants are producing material decisions or Claims?
* Where is human review accumulating?

---

# 13. Narrative Projections

Narrative projections convert structured professional cognition into coherent temporal or explanatory accounts.

Examples:

* What changed overnight?
* Why is this PWU blocked?
* How did the architecture reach its current form?
* What decisions led to this production incident?
* What should a new team member understand first?

## 13.1 Narrative Contract

Every generated narrative SHALL identify:

```text
scope
timeRange
purpose
sourceEntityIds
generatedBy
generatedAt
confidence
knownOmissions
validationStatus
```

## 13.2 Narrative Types

```text
status_narrative
decision_history
change_summary
onboarding_narrative
incident_narrative
outcome_progress
reasoning_summary
reconciliation_summary
handoff_narrative
```

## 13.3 Prohibition

Narrative fluency SHALL NOT be treated as evidence of factual completeness.

---

# 14. Analytical Projections

Analytical projections calculate indicators from authoritative state.

## 14.1 Canonical Metrics

Potential metrics include:

```text
uncertainty_reduction_rate
unsupported_claim_count
critical_assumption_exposure
decision_latency
validation_coverage
evidence_quality_distribution
dependency_blockage
reconciliation_backlog
cross_pwu_conflict_count
intent_traceability_coverage
human_review_latency
ai_contribution_ratio
reopening_rate
recomposition_readiness
```

## 14.2 Metric Contract

Every metric SHALL declare:

```text
metricId
name
professionalMeaning
formula
sourceEntities
sourceRelationships
timeWindow
limitations
thresholds
version
```

## 14.3 Synthetic Scores

Synthetic scores MAY be used for orientation.

They SHALL:

* disclose their component measures;
* expose weighting;
* avoid false precision;
* remain navigable to underlying evidence;
* not replace professional judgment.

---

# 15. Predictive Projections

Predictive projections estimate possible future professional or operational states.

Examples:

* likely decision delay;
* likely dependency blockage;
* confidence trajectory;
* expected validation failure;
* probable outcome risk;
* projected reconciliation impact.

## 15.1 Required Disclosures

Every prediction SHALL expose:

* predicted subject;
* prediction horizon;
* method;
* training or evidence basis where applicable;
* Confidence Assessment;
* assumptions;
* limitations;
* last recalculation time.

## 15.2 Authority Rule

A prediction SHALL NOT automatically become a Decision or Action authorization.

---

# 16. Projection Query Model

Projection queries SHALL express semantic intent rather than raw storage structure where possible.

## 16.1 Canonical Query Components

```text
subject
purpose
entityTypes
relationshipPaths
filters
timeContext
roleContext
authorityContext
aggregation
ordering
depth
includeProvenance
includeContradictions
includeConfidence
```

## 16.2 Example Semantic Query

```text
Show all unresolved Questions and material Uncertainties
that block approval of Decision D,
including supporting or contradicting Evidence,
critical Assumptions,
responsible Participants,
and affected downstream PWUs.
```

## 16.3 Query Result Metadata

Every projection response SHOULD include:

```text
generatedAt
asOfTime
sourceVersionVector
resultCompleteness
staleness
appliedFilters
omittedCount
authorizationScope
```

---

# 17. Projection Consistency

Janumi projections may be built from event streams, relational queries, graph queries, search indexes, materialized views, or caches.

The user experience SHALL distinguish:

```text
authoritative_current
current_eventually_consistent
stale
partial
offline_snapshot
historical
predicted
```

## 17.1 Staleness Contract

Where a projection may be stale, it SHALL disclose:

* last successful refresh;
* source version;
* expected update latency;
* whether commands remain permitted.

## 17.2 Command Safety

A stale projection SHALL NOT permit a state-changing command when executing it could violate current invariants without optimistic concurrency or revalidation.

---

# 18. Projection Refresh Model

Projection updates MAY be:

```text
event_driven
query_on_demand
scheduled
streaming
manually_refreshed
offline_synchronized
```

## 18.1 Event-Driven Update

Preferred for active PWU and RPH workspaces.

## 18.2 Query on Demand

Appropriate for expensive, low-frequency analytical views.

## 18.3 Scheduled

Appropriate for periodic organizational summaries.

## 18.4 Offline Synchronization

Appropriate for mobile or disconnected professional work.

Conflicts arising during synchronization SHALL trigger explicit reconciliation or conflict resolution.

---

# 19. Interaction Grammar

The Janumi interface SHALL support a canonical grammar of professional interaction.

## 19.1 Inspect

View an entity or projection without altering state.

## 19.2 Trace

Navigate relationships to understand origin, dependencies, evidence, or consequences.

## 19.3 Compare

Evaluate alternatives, versions, observations, or Claims.

## 19.4 Challenge

Contest a Claim, Assumption, Decision basis, or Representation.

## 19.5 Contribute

Add Evidence, Representation, Observation, Question, or professional analysis.

## 19.6 Propose

Suggest a Decision, reconciliation, decomposition, Action, or state transition.

## 19.7 Validate

Perform a governed evaluation against explicit criteria.

## 19.8 Authorize

Exercise authority to approve a Decision or Action.

## 19.9 Delegate

Create bounded subordinate professional responsibility.

## 19.10 Reconcile

Resolve detected incoherence.

## 19.11 Escalate

Transfer unresolved work to appropriate authority or expertise.

## 19.12 Synthesize

Reconstruct coherent parent understanding from subordinate work.

These verbs SHOULD shape UI labels and API commands.

Generic verbs such as “Save,” “Submit,” or “Update” MAY exist but SHOULD NOT replace the professional meaning of an action.

---

# 20. Cognitive Zoom

Cognitive zoom is the canonical navigation mechanism for moving across levels of professional reasoning.

## 20.1 Zoom Levels

```text
Organization
Portfolio
Endeavor
Outcome
Intent
Program or Capability
PWU
Child PWU
Reasoning Activity
Representation
Claim
Evidence
Observation
Source
```

Not every PWA requires every level.

## 20.2 Zoom In

Reveals:

* greater semantic detail;
* narrower scope;
* more direct provenance;
* more granular reasoning;
* specific professional actions.

## 20.3 Zoom Out

Reveals:

* broader outcome context;
* synthesis;
* dependencies;
* cross-PWU effects;
* organizational coherence.

## 20.4 Zoom Invariant

Changing zoom SHALL preserve visible context regarding:

* current Intent;
* parent relationship;
* professional objective;
* temporal position;
* active filters.

Users SHALL not feel that they entered an unrelated application merely because they changed semantic scale.

---

# 21. Cognitive Time

Janumi SHALL support navigation through the evolution of professional cognition.

## 21.1 Time Modes

```text
Now
At Historical Time
Before and After
Change Since
Decision Effective Time
Observation Time
Predicted Future
```

## 21.2 Temporal Comparison

Users SHOULD be able to inspect:

* what changed;
* why it changed;
* who or what changed it;
* which Evidence triggered it;
* which Decisions were reopened;
* which downstream entities were affected.

## 21.3 Temporal Warning

Viewing historical state SHALL be visually and semantically unmistakable.

Commands initiated from historical state SHALL be prohibited or explicitly converted into proposals against current state.

---

# 22. Cross-Projection Navigation

Moving from one projection to another SHALL preserve professional context.

Example:

```text
Decision Projection
    → inspect supporting Claim
    → inspect contradicting Evidence
    → inspect source Observation
    → inspect affected Assumption
    → return to Decision
```

The system SHOULD retain:

* originating projection;
* navigation path;
* selected entity;
* filters;
* temporal context;
* unresolved user work.

Browser-style history alone is insufficient when professional context spans multiple projections.

---

# 23. Workspace Composition

A Janumi workspace is a composition of projections, not a monolithic page.

## 23.1 Canonical Workspace Anatomy

```text
┌─────────────────────────────────────────────────────────┐
│ Global Context and Cognitive Location                   │
├─────────────────────────────────────────────────────────┤
│ Local Objective, State, Confidence, Uncertainty         │
├───────────────┬─────────────────────────┬───────────────┤
│ Context Rail  │ Primary Projection      │ Inspector     │
│               │                         │               │
├───────────────┴─────────────────────────┴───────────────┤
│ Professional Commands / Activity / Reconciliation       │
└─────────────────────────────────────────────────────────┘
```

## 23.2 Global Context

Shows:

* organization;
* endeavor;
* PWA;
* current cognitive zoom level;
* current Participant role;
* global notifications requiring professional attention.

## 23.3 Local Objective Region

Shows:

* current Intent;
* professional objective;
* lifecycle state;
* cognitive state;
* current confidence;
* primary uncertainty.

## 23.4 Context Rail

Shows stable local context.

## 23.5 Primary Projection

Shows the active cognitive instrument.

## 23.6 Inspector

Shows details and relationships for the selected entity.

## 23.7 Command Region

Shows valid professional commands and their preconditions.

---

# 24. Responsive Surface Profiles

The same projection may be expressed differently by surface.

---

# 24.1 Web and Desktop Profile

Best suited for:

* multi-projection composition;
* graph exploration;
* complex comparison;
* decomposition;
* evidence analysis;
* decision review;
* RPH supervision.

May display multiple synchronized regions simultaneously.

---

# 24.2 VS Code Profile

Best suited for:

* product-realization PWUs;
* code-linked Representations;
* implementation reasoning;
* test and validation state;
* architecture traceability;
* agent execution;
* local reconciliation.

The VS Code surface SHALL not reduce Janumi to a chat panel.

It SHOULD preserve:

* current PWU objective;
* Intent;
* active reasoning;
* affected code;
* relevant decisions;
* validations;
* reconciliation status.

Source code is one Representation within the PWU, not the organizing model of the entire experience.

---

# 24.3 Mobile Profile

Best suited for:

* review;
* approval;
* evidence capture;
* Observation recording;
* field work;
* escalation response;
* concise organizational understanding.

Mobile presentation MAY serialize complex projections into focused sequences.

It SHALL preserve:

* semantic context;
* authority;
* confidence;
* uncertainty;
* provenance;
* impact.

---

# 24.4 Conversational Profile

Best suited for:

* querying the cognitive model;
* guided exploration;
* professional contribution;
* structured command initiation;
* narrative summaries.

Conversation SHALL remain anchored to authoritative entities.

The system SHOULD convert material conversational outputs into explicit entities rather than leave them trapped in chat history.

---

# 24.5 External System Profile

Used for:

* APIs;
* reports;
* exports;
* regulatory submissions;
* partner exchange;
* enterprise integrations.

Exports SHALL declare:

* source state;
* generation time;
* scope;
* omissions;
* validity;
* authoritative status.

---

# 25. Role-Aware Projection Behavior

Projections SHALL adapt to professional role without fragmenting truth.

## 25.1 Contributor View

Emphasizes:

* assigned objective;
* inputs;
* constraints;
* open Questions;
* active reasoning;
* required outputs;
* validation criteria.

## 25.2 Reviewer View

Emphasizes:

* Claims;
* Evidence;
* Assumptions;
* changes;
* unresolved contradictions;
* review criteria.

## 25.3 Approver View

Emphasizes:

* Decision question;
* authority;
* alternatives;
* Evidence;
* constraints;
* residual uncertainty;
* downstream effects.

## 25.4 Coordinator View

Emphasizes:

* PWU portfolio;
* dependencies;
* blockages;
* tactic health;
* allocation;
* synthesis;
* escalation.

## 25.5 Executive View

Emphasizes:

* outcomes;
* strategic uncertainty;
* decision bottlenecks;
* coherence risks;
* capability limitations;
* cross-organizational dependencies.

## 25.6 AI Participant View

An AI-facing projection SHOULD provide:

* explicit objective;
* scope;
* authoritative context;
* current state;
* inputs;
* constraints;
* required outputs;
* completion and escalation conditions.

AI projections SHOULD minimize irrelevant context without omitting material professional constraints.

---

# 26. Attention Model

Janumi SHALL distinguish activity from required professional attention.

## 26.1 Attention Types

```text
decision_required
review_required
validation_required
evidence_required
contradiction_detected
assumption_invalidated
dependency_blocked
intent_changed
reconciliation_required
escalation_received
outcome_at_risk
```

## 26.2 Attention Priority

Priority SHOULD derive from:

* outcome impact;
* urgency;
* dependency centrality;
* authority requirement;
* safety or legal implication;
* number of affected PWUs;
* time sensitivity;
* confidence degradation.

## 26.3 No Generic Inbox

Janumi MAY provide an attention queue.

It SHOULD not reduce professional attention to a chronological inbox of messages.

Each attention item SHALL remain connected to:

* professional context;
* required decision or action;
* affected entities;
* relevant evidence;
* authority.

---

# 27. Projection-Derived Commands

A projection enables commands but does not itself change state.

## 27.1 Command Context

Every command initiated from a projection SHOULD include:

```text
originatingProjectionDefinitionId
originatingProjectionInstanceId
selectedEntityIds
visibleSourceVersions
participantRole
temporalContext
```

## 27.2 Preflight Validation

Before enabling a material command, the UI SHOULD query or calculate:

* current authority;
* transition validity;
* mandatory constraints;
* stale data status;
* unresolved validation failure;
* optimistic concurrency version;
* required input completeness.

## 27.3 Failed Command Presentation

A failed command SHALL explain the professional reason.

Preferred:

```text
Cannot approve this decision because the mandatory security validation failed and the approving authority does not possess exception authority.
```

Insufficient:

```text
Error 409.
```

Technical details MAY be available separately.

---

# 28. Projection Security and Information Boundaries

A Participant may possess access to only part of the authoritative model.

## 28.1 Security Trimming

Projections SHALL exclude unauthorized entities and relationships.

## 28.2 Disclosure of Partiality

When security filtering materially affects interpretation, the projection SHOULD disclose that its view is partial without revealing protected information.

## 28.3 Relationship Leakage

A projection SHALL avoid leaking restricted information through:

* counts;
* graph structure;
* titles;
* metadata;
* inferred dependencies;
* omitted-node placeholders.

## 28.4 Command Authority

Visibility SHALL NOT imply mutation authority.

---

# 29. Projection Failure Modes

Implementations SHALL guard against the following.

## 29.1 Module Fragmentation

Requirements, architecture, code, tests, decisions, and evidence become independent product modules with separate truths.

## 29.2 Dashboard Reductionism

Complex professional state is collapsed into simplistic status indicators.

## 29.3 Graph Fetishism

Everything is displayed as a graph even when a table, narrative, comparison, or focused workspace better supports cognition.

## 29.4 Chat Capture

Material professional reasoning remains trapped in conversational history.

## 29.5 False Freshness

Cached or historical information is presented as current.

## 29.6 Unexplained Scoring

Synthetic metrics are presented without derivation.

## 29.7 Context Loss

Navigation to an entity loses its originating Intent, objective, or PWU context.

## 29.8 Role Confusion

Review, validation, and approval actions are presented as interchangeable.

## 29.9 Activity Bias

Recent events receive greater prominence than professionally important state.

## 29.10 AI Authority Inflation

AI-generated recommendations are visually treated as approved Decisions.

---

# 30. Minimum Viable Projection Set

The initial Janumi implementation SHALL support the following named projections.

## 30.1 Endeavor Overview

Shows:

* Intent;
* Outcomes;
* root PWUs;
* current uncertainty;
* pending Decisions;
* blocked work;
* coherence alerts.

## 30.2 PWU Overview

Shows the local professional state of one PWU.

## 30.3 Decomposition Projection

Shows recursive PWU structure and recomposition status.

## 30.4 Reasoning Projection

Shows Questions, Reasoning Activities, Claims, Assumptions, and Alternatives.

## 30.5 Evidence Projection

Shows Claim–Evidence relationships and provenance.

## 30.6 Decision Projection

Shows decision readiness, authority, alternatives, evidence, and uncertainty.

## 30.7 Reconciliation Projection

Shows coherence conflicts and proposed resolution.

## 30.8 History Projection

Shows versions, transitions, provenance, and prior state.

## 30.9 RPH Coordination Projection

Shows active work, blockages, escalation, tactic health, and synthesis.

---

# 31. Reference Projection Definition

```json
{
  "projectionDefinitionId": "projection.pwu.decision",
  "name": "PWU Decision Projection",
  "version": "0.1",
  "purpose": "Support an authorized participant in evaluating and deciding a material professional question.",
  "projectionType": "decision",
  "sourceModel": {
    "rootEntityType": "Decision",
    "includedEntityTypes": [
      "Question",
      "Alternative",
      "Claim",
      "Evidence",
      "Assumption",
      "Constraint",
      "Risk",
      "ConfidenceAssessment",
      "Participant"
    ],
    "relationshipPaths": [
      "CLAIM_JUSTIFIES_DECISION",
      "EVIDENCE_SUPPORTS_CLAIM",
      "EVIDENCE_CONTRADICTS_CLAIM",
      "DECISION_SELECTS_ALTERNATIVE",
      "DECISION_ACCEPTS_RESIDUAL_UNCERTAINTY"
    ]
  },
  "roleRules": {
    "view": [
      "owner",
      "reviewer",
      "validator",
      "approver",
      "observer"
    ],
    "commands": {
      "ProposeDecision": [
        "owner",
        "reasoner"
      ],
      "ApproveDecision": [
        "approver"
      ],
      "RejectDecision": [
        "approver"
      ],
      "AddEvidence": [
        "contributor",
        "reviewer",
        "validator"
      ]
    }
  },
  "requiredDisclosures": [
    "provenance",
    "confidence",
    "residualUncertainty",
    "contradictingEvidence",
    "authority",
    "staleness"
  ],
  "refreshMode": "event_driven"
}
```

This is illustrative and does not yet constitute the final machine schema.

---

# 32. Coding Agent Implementation Contract

A coding agent implementing Janumi projections SHALL:

1. Treat projections as derived views over authoritative semantic state.
2. Keep semantic, interaction, and presentation layers distinct.
3. Avoid creating independent local truth per screen.
4. Preserve entity identity across projections.
5. Preserve professional context during navigation.
6. Expose provenance, confidence, uncertainty, and contradiction where relevant.
7. derive available commands from state, role, authority, and policy.
8. perform server-side validation for all commands.
9. disclose stale, partial, historical, and predicted state.
10. retain originating projection context in commands.
11. avoid generic dashboards that conceal professional meaning.
12. avoid designing navigation primarily around file or storage hierarchy.
13. support cognitive zoom and cognitive time.
14. use semantic event updates rather than broad page refreshes where practical.
15. ensure mobile, web, desktop, and IDE surfaces preserve semantic continuity.
16. expose why actions are unavailable rather than merely disabling controls.
17. ensure material AI output becomes explicit professional entities.
18. avoid using conversation history as the sole persistence mechanism.
19. ensure projection calculations are explainable.
20. validate projection conformance through automated tests.

---

# 33. Acceptance Scenarios

## Scenario A — Cross-Projection Context Preservation

Given:

* a user is reviewing Decision D within PWU P;
* the user selects contradicting Evidence E;
* the user navigates to the source Observation O;

When:

* the user returns to the Decision projection;

Then:

* Decision D remains selected;
* PWU P remains the active context;
* prior filters remain;
* temporal mode remains;
* the inspected Evidence path remains available.

---

## Scenario B — Stale Approval Projection

Given:

* an approver opened a Decision projection at version 12;
* new Evidence was added and the Decision advanced to version 14;

When:

* the approver attempts approval from the stale projection;

Then:

* the command is revalidated;
* approval is rejected or refreshed;
* the user is shown what materially changed;
* no state is overwritten.

---

## Scenario C — AI Recommendation Attribution

Given:

* an AI Participant proposes Alternative A;

When:

* Alternative A appears in the Decision projection;

Then:

* AI authorship is visible;
* supporting Evidence is accessible;
* confidence and limitations are shown;
* the recommendation is not styled as approved;
* authorized humans retain the approval command.

---

## Scenario D — Completed Children, Incomplete Parent

Given:

* all child PWUs are completed;
* cross-child contradiction remains;
* parent synthesis is incomplete;

When:

* the decomposition projection is displayed;

Then:

* child completion is visible;
* parent state remains incomplete;
* contradiction is prominent;
* recomposition requirement is shown;
* parent completion command is unavailable.

---

## Scenario E — Historical State

Given:

* the user selects “as of June 30, 2026”;

When:

* the PWU projection renders;

Then:

* all entities reflect the selected historical state;
* a historical-state indicator is persistent;
* current-state commands are unavailable;
* the user may compare historical and current state.

---

## Scenario F — Security-Trimmed Projection

Given:

* a Participant lacks access to legal-review Evidence;

When:

* the Decision projection is rendered;

Then:

* restricted Evidence is not leaked;
* the view indicates that access limitations may affect completeness;
* the Decision cannot be approved if policy requires review of the restricted Evidence.

---

# 34. Resulting Reference Experience

The Canonical Projection Model establishes the following Janumi experience:

A professional enters an endeavor, PWU, or organizational context.

They do not encounter isolated modules.

They encounter the current professional cognition relevant to their purpose.

They may inspect:

* Intent;
* understanding;
* reasoning;
* Evidence;
* Decisions;
* execution;
* Observation;
* reconciliation.

They may zoom outward toward organizational outcomes or inward toward individual Claims and Evidence.

They may move backward through cognitive history or compare expected and observed reality.

They may initiate governed professional commands.

Every projection remains connected to one semantic model.

The result is not merely a consistent UI.

It is a coherent professional cognitive environment.

---

# 35. Next Normative Artifact

The next required document is the **Reference Interaction and Workspace Specification**.

It shall convert this projection model into concrete UI and UX behavior, including:

* application shell;
* navigation model;
* PWU workspace anatomy;
* reasoning canvas;
* decomposition viewer;
* evidence explorer;
* decision workspace;
* reconciliation workspace;
* persistent context;
* command placement;
* attention management;
* responsive behavior;
* VS Code profile;
* mobile profile;
* accessibility;
* loading, stale, partial, and error states;
* component-level semantic invariants.

That specification will be sufficiently concrete for the coding agent to implement the first coherent Janumi UI rather than a collection of conventional application pages.
