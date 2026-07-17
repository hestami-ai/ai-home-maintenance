# Reference Interaction and Workspace Specification

## RIWS Specification v0.1.0

**Document ID:** `JAN-RIWS-001`
**Version:** `0.1.0`
**Status:** Draft
**Depends on:** Canonical Professional Cognition Ontology v0.1, Professional Work Unit Specification v0.1, Recursive Professional Harness Coordination Specification v0.1, Canonical Projection Model v0.1, Professional Cognition Life Cycle, Janumi Constitution
**Applies to:** Janumi Professional Workbench, JanumiCode, future Professional Work Architectures, web, desktop, VS Code, mobile, and conversational surfaces
**Primary audiences:** UX architects, product designers, frontend engineers, coding agents, accessibility engineers, PWA authors, backend API designers

---

# 1. Purpose

This specification defines the canonical interaction model and workspace architecture through which professionals inspect, manipulate, coordinate, and reconcile professional cognition in Janumi.

It converts the Canonical Projection Model into implementable user experience behavior.

This specification defines:

* the Janumi application shell;
* the canonical navigation model;
* cognitive location and zoom;
* the PWU workspace;
* persistent professional context;
* projection switching;
* the decomposition viewer;
* the reasoning workspace;
* the evidence explorer;
* the decision workspace;
* the execution and observation workspace;
* the reconciliation workspace;
* RPH coordination surfaces;
* professional attention management;
* command presentation and validation;
* AI participation patterns;
* loading, stale, partial, and failure states;
* responsive surface profiles;
* accessibility requirements;
* component-level semantic invariants.

The interface SHALL not be designed as a collection of loosely related product pages.

It SHALL operate as a coherent environment over one authoritative professional cognition model.

---

# 2. Foundational Interaction Principle

Every Janumi interaction SHALL preserve the relationship among:

```text
Professional Purpose
+
Current Intent
+
Current Cognitive Object
+
Current Cognitive State
+
Current Lifecycle State
+
Participant Role
+
Participant Authority
+
Temporal Context
+
Professional History
```

The interface SHALL help the professional understand:

* where they are;
* why this work exists;
* what is currently understood;
* what remains uncertain;
* what requires attention;
* what they are permitted to do;
* what professional effect their action will have.

---

# 3. Primary Experience Object

The primary experience object is not:

* a page;
* a file;
* a folder;
* a project;
* a task;
* a chat session;
* a dashboard card.

The primary experience object is a **professionally meaningful cognitive context**.

A cognitive context may be centered on:

* an Endeavor;
* an Outcome;
* an Intent;
* a PWU;
* a Decision;
* a Claim;
* an Evidence item;
* a Reconciliation;
* an RPH;
* an organizational projection.

The UI SHALL make transitions among these contexts explicit and reversible.

---

# 4. Application Shell

The Janumi shell SHALL provide stable global orientation while allowing the primary cognitive workspace to adapt to the active professional purpose.

## 4.1 Canonical Shell Regions

```text
┌─────────────────────────────────────────────────────────────────┐
│ Global Header                                                   │
├───────────────┬─────────────────────────────────┬───────────────┤
│ Global Rail   │ Cognitive Workspace             │ Context Panel │
│               │                                 │               │
├───────────────┴─────────────────────────────────┴───────────────┤
│ Command / Attention / Activity Region                           │
└─────────────────────────────────────────────────────────────────┘
```

Not all regions must remain simultaneously visible on smaller surfaces.

Semantic access SHALL remain available even when presentation changes.

---

# 5. Global Header

The Global Header SHALL communicate the user’s broad operating context.

## 5.1 Required Elements

```text
Organization
Active PWA
Current Endeavor
Current Cognitive Location
Participant Identity
Participant Role
Temporal Mode
Global Attention Indicator
System State Indicator
```

## 5.2 Organization Selector

Where a Participant has access to multiple organizations or tenants, switching organizations SHALL:

* change the authoritative semantic context;
* clear incompatible local selections;
* preserve no unauthorized cross-tenant state;
* visibly identify the newly active organization;
* require revalidation of cached projections.

## 5.3 PWA Selector

The PWA selector identifies the active professional domain environment.

Examples:

```text
JanumiCode
JanumiScience
JanumiLegal
JanumiConstruction
```

Changing the PWA MAY alter:

* domain terminology;
* available projection definitions;
* validators;
* role capabilities;
* specialized entity types;
* workspace composition.

It SHALL NOT change the foundational CPCO semantics.

## 5.4 Temporal Mode Indicator

The header SHALL clearly distinguish:

```text
Current
Historical
Comparison
Predicted
Offline Snapshot
Stale
```

Historical or predicted mode SHALL remain visible while active.

---

# 6. Global Navigation Rail

The global navigation rail provides access to stable organizational projections.

## 6.1 Canonical Destinations

```text
Home
Outcomes
Endeavors
Work
Decisions
Evidence
Reconciliation
Coordination
Memory
Attention
```

PWA-specific destinations MAY be added.

## 6.2 Navigation Meaning

### Home

A role-specific orientation projection showing current professional priorities and significant changes.

### Outcomes

Cross-endeavor desired and observed outcomes.

### Endeavors

Active and historical professional undertakings.

### Work

PWUs organized by professional meaning, not merely by status.

### Decisions

Pending, approved, deferred, reopened, and superseded Decisions.

### Evidence

Evidence assets, gaps, provenance, and evidentiary conflicts.

### Reconciliation

Detected and active coherence-restoration work.

### Coordination

RPH activity, blockages, escalations, tactic health, and synthesis.

### Memory

Narrative and structured organizational memory.

### Attention

Professional conditions requiring the Participant’s involvement.

## 6.3 Rail Prohibition

The rail SHALL NOT become a list of internal technical modules such as:

```text
Entities
Relationships
Events
Schemas
Database
Agent Runs
```

These may exist in administrative or developer tools, but they do not constitute the primary professional experience.

---

# 7. Cognitive Breadcrumb

Every bounded workspace SHALL display a cognitive breadcrumb.

Example:

```text
Organization
› Product Realization Endeavor
› Enterprise Authentication
› Architecture PWU
› Decision: Tenant Isolation Strategy
```

## 7.1 Breadcrumb Requirements

The breadcrumb SHALL:

* represent semantic containment or contextual traversal;
* distinguish containment from mere navigation history;
* allow movement to meaningful ancestors;
* preserve the selected entity where possible;
* expose recursive PWU structure;
* identify when the current context is referenced from outside its owning PWU.

## 7.2 Cross-Context Indicator

When viewing an entity through a relationship rather than containment, the UI SHOULD indicate:

```text
Viewed from Decision D
Owned by PWU P
```

---

# 8. Cognitive Zoom

Cognitive zoom is the canonical mechanism for changing semantic scale.

## 8.1 Zoom Levels

A reference implementation SHOULD support:

```text
Organization
Portfolio
Endeavor
Outcome
Intent
PWU
Child PWU
Reasoning Activity
Decision
Claim
Evidence
Observation
Source
```

## 8.2 Zoom Behavior

Zooming in SHALL reveal greater detail without losing broader professional context.

Zooming out SHALL reveal:

* parent purpose;
* cross-PWU dependencies;
* outcome contribution;
* synthesis;
* organizational impact.

## 8.3 Direct Navigation

Search, links, notifications, and external references MAY navigate directly to a deep entity.

When this occurs, the interface SHALL reconstruct enough parent context to prevent disorientation.

---

# 9. Workspace Header

Every local cognitive workspace SHALL contain a workspace header.

## 9.1 Required Information

```text
Title
Entity Type
Professional Objective or Semantic Purpose
Lifecycle State
Cognitive State
Parent Context
Originating Intent
Owner or Steward
Current Confidence
Primary Uncertainty
Pending Reconciliation
Last Material Change
```

## 9.2 State Presentation

Lifecycle and cognitive state SHALL be shown separately.

Example:

```text
Lifecycle: Awaiting Review
Cognitive State: Decision
```

The interface SHALL NOT collapse these into a generic label such as:

```text
Pending
In Progress
Open
```

without preserving their distinct meanings.

## 9.3 State Explanation

Selecting a state SHALL explain:

* what the state means;
* why the object is currently in it;
* which conditions must be satisfied to leave it;
* who possesses authority to act;
* what is blocking advancement.

---

# 10. Persistent Professional Context

The interface SHALL maintain ready access to the context necessary for responsible professional reasoning.

## 10.1 Canonical Context Categories

```text
Intent
Objective
Scope
Participants
Assumptions
Constraints
Dependencies
Confidence
Uncertainty
Validations
Provenance
History
```

## 10.2 Context Panel

On large surfaces, these categories SHOULD appear in a persistent or collapsible context panel.

On smaller surfaces, they MAY appear through:

* contextual drawers;
* focused tabs;
* expandable summaries;
* progressive disclosure.

## 10.3 Materiality Rules

Critical conditions SHALL not be hidden solely because a panel is collapsed.

Examples:

* invalidated critical assumption;
* mandatory validation failure;
* unresolved contradiction;
* mandatory constraint violation;
* stale authoritative data;
* pending reconciliation.

These require persistent visible indicators.

---

# 11. Projection Selector

A cognitive context may support multiple projections.

## 11.1 Canonical PWU Projections

```text
Overview
Understanding
Reasoning
Evidence
Decisions
Execution
Observations
Reconciliation
Decomposition
History
```

## 11.2 Projection State

Switching projections SHALL preserve:

* active PWU;
* selected entity where relevant;
* temporal mode;
* applicable filters;
* navigation origin;
* unsaved local drafting state where safe.

## 11.3 Projection Availability

Projection options MAY be hidden or disabled where semantically inapplicable.

The UI SHOULD explain why a projection is unavailable.

Example:

```text
Observation view becomes available after an Action or external Observation is recorded.
```

---

# 12. PWU Overview Workspace

The PWU Overview is the primary orientation surface for one Professional Work Unit.

## 12.1 Purpose

It answers:

* Why does this PWU exist?
* What is its current professional condition?
* What has changed?
* What remains uncertain?
* What must happen next?
* Is intervention required?

## 12.2 Required Sections

### Professional Objective

The objective SHALL be prominent and expressed as a professionally meaningful result.

### Current State Summary

Displays:

```text
Lifecycle State
Cognitive State
Current Disposition
Current Confidence
Primary Uncertainty
Primary Blocker
Next Required Transition
```

### Intent and Outcome Trace

Shows the PWU’s contribution to active Intent and Outcomes.

### Current Understanding

A concise, attributed synthesis of:

* supported Claims;
* material Assumptions;
* open Questions;
* significant Evidence;
* known contradictions.

### Active Work

Shows active Reasoning Activities, Actions, Reviews, or Validations.

### Required Attention

Shows professional actions requiring intervention.

### Recent Material Changes

Shows changes ranked by professional significance rather than chronology alone.

### Completion Readiness

Shows:

* satisfied conditions;
* unsatisfied conditions;
* failed validations;
* unresolved dependencies;
* residual uncertainty;
* recomposition status.

## 12.3 Overview Prohibition

The overview SHALL NOT be reduced to a generic dashboard of progress percentages and status cards.

---

# 13. Understanding Workspace

## 13.1 Purpose

The Understanding Workspace exposes the current epistemic state of the PWU.

It SHALL distinguish:

```text
Known
Claimed
Assumed
Inferred
Unknown
Contested
Invalidated
```

## 13.2 Canonical Layout

```text
Open Questions
Material Uncertainties
Current Claims
Critical Assumptions
Constraints
Confidence Distribution
Contradictions
```

## 13.3 Question Interaction

A Question may be:

* opened;
* refined;
* decomposed;
* linked to an Uncertainty;
* assigned to a Reasoning Activity;
* answered by a Claim;
* marked partially resolved;
* reopened.

## 13.4 Uncertainty Presentation

Uncertainty SHOULD be prioritized by:

* outcome impact;
* decision impact;
* reducibility;
* urgency;
* dependency centrality.

It SHALL not be treated merely as an issue severity.

## 13.5 Assumption Presentation

Each material Assumption SHOULD display:

* status;
* basis;
* criticality;
* validation method;
* dependent Claims, Decisions, and PWUs.

---

# 14. Reasoning Workspace

## 14.1 Purpose

The Reasoning Workspace makes active and historical professional reasoning inspectable and governable.

## 14.2 Canonical Views

```text
Reasoning Graph
Activity Stream
Method View
Alternative Comparison
Decomposition View
Synthesis View
Agent Contributions
```

## 14.3 Reasoning Activity Card

A Reasoning Activity presentation SHALL include:

```text
Purpose
Reasoning Type
Status
Performed By
Inputs
Method
Outputs
Assumptions Introduced
Limitations
Confidence Effect
Validation Status
```

## 14.4 AI Reasoning Presentation

AI contributions SHALL show:

* agent role;
* agent identity;
* output type;
* Evidence used;
* Assumptions introduced;
* professional rationale;
* confidence;
* limitations;
* validation status;
* required human review.

The UI SHALL not require or expose private hidden chain-of-thought.

## 14.5 Alternative Comparison

Alternative comparison SHOULD support explicit criteria.

Example:

```text
Alternative
Security
Cost
Complexity
Operational Risk
Compliance
Evidence Quality
Residual Uncertainty
```

Comparison cells SHALL distinguish:

* evidence-backed assessment;
* expert judgment;
* AI inference;
* unknown;
* not applicable.

## 14.6 Reasoning Failure

Failed or inconclusive reasoning SHALL remain visible and useful.

The UI SHOULD show:

* method attempted;
* failure class;
* Evidence gathered;
* assumptions challenged;
* recommended tactic change;
* whether escalation is required.

---

# 15. Evidence Explorer

## 15.1 Purpose

The Evidence Explorer enables professionals to inspect the evidentiary basis of Claims, Decisions, Assumptions, and Outcomes.

## 15.2 Canonical Modes

```text
Evidence Graph
Claim–Evidence Matrix
Evidence Table
Provenance Chain
Gap Analysis
Contradiction Analysis
Source Inspector
```

## 15.3 Evidence Item Presentation

Each Evidence item SHALL expose:

```text
Evidence Type
Source
Observed or Published Time
Recorded Time
Reliability
Relevance
Scope
Supported Claims
Contradicted Claims
Qualification
Validation
Provenance
Access Restrictions
```

## 15.4 Relationship Semantics

The interface SHALL require explicit relationship classification:

```text
Supports
Contradicts
Qualifies
Inconclusive For
```

Dragging or attaching Evidence to a Claim SHALL not automatically imply support without confirmation of the semantic relationship.

## 15.5 Evidence Gap Presentation

The workspace SHOULD identify:

* unsupported material Claims;
* Claims relying on weak Evidence;
* stale Evidence;
* inaccessible Evidence;
* single-source dependency;
* conflicting Evidence;
* unvalidated external sources.

## 15.6 Source Inspection

Where source access is available, the user SHOULD be able to inspect the authoritative source without losing the Evidence context.

---

# 16. Decision Workspace

## 16.1 Purpose

The Decision Workspace supports professional commitment under uncertainty.

It SHALL make decision readiness explicit.

## 16.2 Required Regions

```text
Decision Question
Decision State
Authority
Alternatives
Evaluation Criteria
Supporting Claims
Evidence
Contradicting Evidence
Assumptions
Constraints
Risks
Residual Uncertainty
Recommendation
Rationale
Downstream Impact
```

## 16.3 Decision Readiness Indicator

Decision readiness SHALL be decomposed into explainable dimensions.

Example:

```text
Question Defined: Yes
Authority Confirmed: Yes
Alternatives Evaluated: Partial
Mandatory Constraints Checked: Yes
Evidence Sufficient: No
Residual Uncertainty Characterized: Partial
Required Validation Complete: No
```

A synthetic readiness indicator MAY summarize these dimensions but SHALL not replace them.

## 16.4 Authority Presentation

The workspace SHALL show:

* who may propose;
* who may review;
* who may approve;
* who may grant exceptions;
* whether quorum or multiple approvals are required.

## 16.5 Approval Interaction

Before approval, the UI SHALL present or require acknowledgment of:

* selected Alternative;
* rationale;
* mandatory Constraints;
* material Assumptions;
* contradicting Evidence;
* residual Uncertainty;
* downstream effects;
* effective time.

## 16.6 Decision Reopening

A reopened Decision SHALL display:

* prior approved state;
* reopening trigger;
* changed Evidence or Assumptions;
* affected Actions and PWUs;
* temporary operating status.

---

# 17. Execution Workspace

## 17.1 Purpose

The Execution Workspace shows authorized Actions and their relationship to Decisions and intended Outcomes.

## 17.2 Required Information

Each Action SHALL show:

```text
Intended Effect
Authorizing Decision
Executor
Status
Dependencies
Constraints
Expected Observation
Produced Artifacts
Execution Evidence
Rollback or Recovery
```

## 17.3 Separation of States

The interface SHALL distinguish:

```text
Action Completed
Action Validated
Outcome Achieved
```

These are not interchangeable.

## 17.4 JanumiCode Specialization

In JanumiCode, the Execution Workspace MAY show:

* implementation slices;
* code changes;
* agent runs;
* build results;
* test execution;
* deployment state;
* linked architecture and requirements.

Source code SHALL remain a Representation and Artifact within the broader professional context.

---

# 18. Observation Workspace

## 18.1 Purpose

The Observation Workspace compares expected and observed reality.

## 18.2 Required Modes

```text
Expected vs Observed
Timeline
Anomaly View
Outcome Assessment
Operational Telemetry
Feedback
Field Observation
```

## 18.3 Observation Capture

Observation entry SHALL distinguish:

* raw observation;
* interpretation;
* derived Claim;
* Evidence relationship.

A user SHOULD be able to record an Observation without being forced to immediately interpret it.

## 18.4 Variance Presentation

Variance SHALL be classified as:

```text
Matches Expectation
Within Tolerance
Unexpected Beneficial
Unexpected Adverse
Inconclusive
Measurement Failure
```

## 18.5 Reconciliation Trigger

Where variance materially affects current understanding, the UI SHALL make reconciliation initiation prominent.

---

# 19. Reconciliation Workspace

## 19.1 Purpose

The Reconciliation Workspace exposes and resolves loss of coherence.

## 19.2 Required Regions

```text
Trigger
Detected Incoherence
Affected Entities
Affected PWUs
Affected Decisions
Affected Outcomes
Prior State
Proposed State
Contradictions
Impact Analysis
Required Authority
Validation
Resolution Status
```

## 19.3 Before-and-After Comparison

A reconciliation proposal SHOULD support direct comparison of:

* prior Representation;
* proposed Representation;
* changed Claims;
* changed Confidence;
* invalidated Assumptions;
* reopened Decisions;
* affected downstream work.

## 19.4 Reconciliation Commands

```text
Accept Reconciliation
Reject Reconciliation
Revise Proposal
Request Evidence
Reopen Decision
Reopen PWU
Create Follow-On PWU
Accept Temporary Incoherence
Escalate
```

## 19.5 Temporary Incoherence

Where authorized, the interface SHALL require:

* rationale;
* accepted risk;
* scope;
* responsible authority;
* mitigation;
* review or expiration date.

---

# 20. Decomposition Viewer

## 20.1 Purpose

The Decomposition Viewer presents recursive professional work while preserving the obligation to recompose coherent understanding.

## 20.2 Canonical Presentation Modes

```text
Tree
Graph
Outline
Dependency Matrix
Swimlane
Synthesis Readiness
```

## 20.3 Child PWU Representation

Each child SHALL expose:

```text
Delegated Objective
Relationship Type
Lifecycle State
Cognitive State
Owner or Harness
Current Confidence
Primary Uncertainty
Blocker
Required Output
Completion State
Recomposition Status
```

## 20.4 Parent Context

The parent SHALL expose:

* original objective;
* decomposition rationale;
* cross-child dependencies;
* integration boundaries;
* synthesis obligations;
* unresolved contradictions;
* overall completion conditions.

## 20.5 Completion Semantics

Completed children SHALL not visually imply a completed parent.

The viewer SHOULD represent parent synthesis readiness separately.

Example:

```text
Children Complete: 6 of 6
Cross-Child Coherence: Failed
Synthesis Complete: No
Parent Completion Ready: No
```

## 20.6 Decomposition Interaction

Authorized Participants MAY:

* create child PWU;
* revise delegation;
* add cross-child dependency;
* transfer scope;
* merge child work;
* detach child work;
* request synthesis;
* initiate cross-child reconciliation.

---

# 21. RPH Coordination Workspace

## 21.1 Purpose

The RPH Coordination Workspace enables supervision of professional coordination across PWUs and subordinate RPHs.

## 21.2 Canonical Views

```text
Portfolio
Delegation Tree
Dependency Network
Blockage Analysis
Tactic Health
Escalation Queue
Validation Queue
Synthesis Queue
Reconciliation Queue
Participant Allocation
```

## 21.3 Portfolio View

PWUs SHOULD be grouped by professional condition, such as:

```text
Needs Framing
Ready to Start
Actively Reducing Uncertainty
Awaiting Evidence
Awaiting Decision
Awaiting Review
Blocked
Reconciling
Ready for Synthesis
Escalated
```

This is preferable to generic columns such as:

```text
To Do
Doing
Done
```

## 21.4 Tactic Health

The workspace SHALL expose indicators such as:

* iterations without meaningful progress;
* recurring failure class;
* uncertainty reduction trend;
* repeated validation failure;
* oscillation between Alternatives;
* tool or agent saturation;
* excessive decomposition overhead.

## 21.5 Tactic Change Interaction

Authorized coordinators MAY:

```text
Change Method
Change Agent
Request Specialist
Broaden Search
Narrow Scope
Challenge Assumptions
Decompose Differently
Merge Work
Escalate
```

## 21.6 Escalation Queue

Each escalation SHALL show:

* objective;
* current state;
* blocking condition;
* tactics attempted;
* Evidence;
* authority required;
* recommended options;
* risk of delay;
* risk of proceeding.

---

# 22. Professional Attention Workspace

## 22.1 Purpose

The Attention Workspace identifies professional conditions requiring a Participant’s involvement.

It is not a generic notification center.

## 22.2 Attention Categories

```text
Decision Required
Review Required
Validation Required
Evidence Required
Contradiction Detected
Assumption Invalidated
Dependency Blocked
Intent Changed
Reconciliation Required
Escalation Received
Outcome at Risk
Authority Required
```

## 22.3 Attention Item Contract

Every item SHALL identify:

```text
Why Attention Is Required
Affected Professional Context
Required Role or Authority
Urgency
Outcome Impact
Relevant Evidence
Available Commands
Deferral Consequences
```

## 22.4 Prioritization

Attention SHOULD be ranked by professional consequence, not simply by recency.

## 22.5 Dismissal

Material attention SHALL not be dismissible without disposition.

Permitted dispositions MAY include:

```text
Resolved
Delegated
Deferred
Accepted Risk
Not Applicable
Duplicate
Escalated
```

---

# 23. AI Participation Interface

## 23.1 AI as Participant

AI SHALL appear as an attributable professional Participant rather than invisible background automation.

## 23.2 AI Contribution Types

```text
Question
Claim
Evidence Retrieval
Representation
Alternative
Recommendation
Validation
Critique
Observation Interpretation
Reconciliation Proposal
Decomposition Proposal
Tactic Change Proposal
```

## 23.3 Contribution Presentation

AI contributions SHALL expose:

* agent role;
* source context;
* Evidence;
* Assumptions;
* confidence;
* limitations;
* validation state;
* review requirement.

## 23.4 Conversational Interaction

Conversation MAY be used to:

* query the model;
* refine an objective;
* inspect reasoning;
* initiate semantic commands;
* contribute professional entities.

Material outputs SHALL be convertible into explicit CPCO entities.

## 23.5 AI Activity Stream

The interface MAY show active AI work.

It SHOULD distinguish:

```text
Queued
Reasoning
Waiting for Tool
Waiting for Evidence
Waiting for Human
Validating
Completed
Failed
Escalated
```

## 23.6 AI Prohibition

The UI SHALL not imply that fluent AI output is authoritative merely because it is complete or confident in tone.

---

# 24. Professional Command Model

## 24.1 Command Semantics

UI controls SHOULD use professional verbs.

Examples:

```text
Identify Uncertainty
Challenge Claim
Add Evidence
Propose Decision
Approve Decision
Authorize Action
Record Observation
Start Reconciliation
Delegate Work
Request Validation
Escalate
Synthesize
Complete PWU
```

## 24.2 Generic Controls

Generic controls such as `Save` MAY be used for local drafts.

They SHALL not obscure the semantic command that changes authoritative professional state.

## 24.3 Command Preconditions

Before enabling a command, the interface SHOULD evaluate:

* role;
* authority;
* current state;
* expected version;
* required inputs;
* mandatory Constraints;
* validation status;
* source staleness;
* PWA policy.

## 24.4 Disabled Commands

A disabled command SHALL provide a meaningful explanation.

Example:

```text
Complete PWU is unavailable because parent recomposition has not been performed and one mandatory validation remains inconclusive.
```

## 24.5 Confirmation

High-impact commands SHOULD use professional confirmation rather than generic confirmation.

The confirmation SHOULD summarize:

* intended effect;
* affected entities;
* unresolved uncertainty;
* downstream impact;
* irreversibility or reopening conditions.

---

# 25. Drafting and Authoritative State

The interface SHALL distinguish local drafting from authoritative professional state.

## 25.1 Draft Types

```text
Personal Draft
Shared Draft
Proposed Entity
Proposed Revision
Authoritative State
```

## 25.2 Draft Indicators

Draft state SHALL be visible.

A draft SHALL not appear in authoritative projections unless explicitly included.

## 25.3 Promotion

Promoting a draft may require:

* semantic validation;
* role authority;
* provenance;
* conflict detection;
* review;
* command execution.

---

# 26. Loading and Data State Model

The interface SHALL distinguish technical loading from professional state.

## 26.1 Technical States

```text
Loading
Refreshing
Offline
Partially Loaded
Failed to Load
Stale
Synchronizing
Conflict Detected
```

## 26.2 Professional States

```text
Blocked
Awaiting Evidence
Awaiting Decision
Awaiting Review
Reconciling
Completed
Failed
```

These SHALL never share ambiguous indicators.

## 26.3 Partial Data

A partial projection SHALL disclose:

* which source classes are missing;
* why they are missing;
* whether interpretation may be materially affected;
* whether commands remain available.

## 26.4 Error Presentation

Errors SHALL distinguish:

```text
Technical Failure
Authorization Failure
Validation Failure
Concurrency Conflict
Professional Invariant Violation
External Dependency Failure
```

---

# 27. Stale and Concurrent State

## 27.1 Stale Projection

When source state has changed since the projection was generated, the UI SHALL:

* identify material changes;
* prevent unsafe mutation;
* offer refresh or comparison;
* preserve local draft work where possible.

## 27.2 Concurrency Conflict

When a command conflicts with newer authoritative state, the UI SHOULD show:

* what changed;
* who or what changed it;
* which local assumptions are affected;
* available reconciliation options.

## 27.3 Silent Overwrite Prohibition

No material professional state SHALL be silently overwritten by last-write-wins behavior.

---

# 28. History and Provenance Interaction

## 28.1 Entity History

Users SHOULD be able to inspect:

* versions;
* revisions;
* supersession;
* state transitions;
* provenance;
* Decision history;
* validation history;
* reconciliation history.

## 28.2 Change Explanation

A change entry SHOULD answer:

* what changed;
* why;
* by whom or what;
* based on which Evidence;
* under which authority;
* what downstream impact occurred.

## 28.3 Historical Commands

Historical state SHALL be read-only.

A user MAY create a proposal derived from historical state, but the proposal SHALL be evaluated against current state.

---

# 29. Search and Retrieval

## 29.1 Semantic Search

Search SHOULD support professional concepts, including:

* Intent;
* Outcome;
* PWU;
* Claim;
* Evidence;
* Decision;
* Assumption;
* Constraint;
* Participant;
* Reconciliation.

## 29.2 Query Examples

```text
Show decisions affected by the new encryption policy.
Find unsupported claims in active architecture PWUs.
Show critical assumptions invalidated this month.
Find work blocked by external legal review.
Show evidence contradicting the selected deployment architecture.
```

## 29.3 Search Result Context

Results SHALL display:

* entity type;
* owning context;
* originating Intent;
* lifecycle or validity state;
* temporal relevance;
* confidence where applicable.

---

# 30. Visual Semantics

## 30.1 Color

Color MAY reinforce meaning but SHALL not be the sole carrier of meaning.

## 30.2 State Icons

Icons SHOULD distinguish:

* lifecycle state;
* validity;
* confidence;
* uncertainty;
* contradiction;
* reconciliation;
* AI origin;
* human approval.

## 30.3 Semantic Consistency

The same semantic condition SHALL use consistent treatment across projections and surfaces.

## 30.4 Confidence

Confidence visualization SHALL avoid implying false precision.

Acceptable forms include:

* clearly defined ordinal levels;
* intervals;
* distributions;
* evidence-based assurance categories.

## 30.5 Contradiction

Contradictions SHOULD be visually prominent without implying that one side is automatically wrong.

---

# 31. Accessibility Requirements

The Janumi interface SHALL conform to applicable accessibility standards and support professional use under high cognitive load.

## 31.1 Keyboard Navigation

All material operations SHALL be keyboard accessible.

## 31.2 Screen Reader Semantics

Graphs, matrices, and complex canvases SHALL provide structured textual alternatives.

## 31.3 Color Independence

No state or professional condition SHALL be conveyed by color alone.

## 31.4 Focus Management

Projection changes, drawers, dialogs, and command completion SHALL maintain predictable focus.

## 31.5 Cognitive Accessibility

The interface SHOULD:

* use stable layouts;
* avoid gratuitous animation;
* provide plain-language state explanations;
* support progressive disclosure;
* preserve context during navigation;
* avoid overloading the user with all ontology entities simultaneously.

## 31.6 Motion

Motion MAY indicate:

* relationship traversal;
* zoom;
* state transition;
* reconciliation impact.

It SHALL respect reduced-motion preferences.

---

# 32. Responsive Web and Desktop Profile

## 32.1 Wide Layout

Wide surfaces SHOULD support:

```text
Global Rail
Primary Workspace
Persistent Context Panel
Optional Secondary Projection
Command Region
```

## 32.2 Multi-Projection Comparison

Desktop and web MAY show synchronized projections side by side.

Examples:

* Decision and Evidence;
* Decomposition and Dependency;
* Expected and Observed;
* Prior and Proposed Reconciliation state.

## 32.3 Window Persistence

The system MAY remember workspace composition per:

* PWA;
* Participant role;
* device;
* PWU type.

It SHALL not preserve stale authority assumptions.

---

# 33. VS Code Profile

## 33.1 Purpose

The VS Code profile supports product realization without reducing Janumi to a coding chat interface.

## 33.2 Canonical Regions

```text
Janumi Activity Bar
PWU Explorer
Current Objective Header
Primary Cognitive Panel
Code Editor
Context Inspector
Agent and Validation Activity
```

## 33.3 PWU Explorer

The PWU Explorer SHOULD organize work by:

* objective;
* decomposition;
* lifecycle state;
* cognitive state;
* implementation relationship.

It SHALL not simply mirror the file tree.

## 33.4 Editor Context

When a file or code region is selected, Janumi SHOULD expose:

* owning or related PWUs;
* requirements;
* architecture Decisions;
* Claims;
* Assumptions;
* tests;
* validations;
* unresolved reconciliation.

## 33.5 Agent Execution

Coding-agent execution SHOULD remain bound to:

* PWU objective;
* scope;
* current Decision;
* constraints;
* required validations;
* completion conditions.

## 33.6 Code Change Review

A code change review SHOULD answer:

* Which Intent does this serve?
* Which Representation or Decision authorized it?
* Which tests validate it?
* Which assumptions changed?
* Which downstream artifacts may require reconciliation?

---

# 34. Mobile Profile

## 34.1 Purpose

The mobile profile supports focused professional action, field Observation, review, approval, and situational understanding.

## 34.2 Mobile Priorities

```text
Attention
Review
Approval
Observation Capture
Evidence Capture
Escalation
Concise PWU Understanding
```

## 34.3 Serialized Interaction

Complex projections MAY be presented as a guided sequence.

Example decision review:

```text
1. Decision Question
2. Alternatives
3. Evidence
4. Contradictions
5. Constraints
6. Residual Uncertainty
7. Impact
8. Authorize or Defer
```

## 34.4 Field Observation

Mobile SHALL support, where applicable:

* photo;
* video;
* audio;
* location;
* timestamp;
* sensor reading;
* notes;
* structured classification;
* offline capture.

Captured media are Artifacts. Their interpreted meaning SHALL be represented separately.

## 34.5 Offline Mode

Offline state SHALL clearly identify:

* last synchronization;
* authoritative snapshot time;
* queued commands;
* potential conflicts;
* unavailable validations.

---

# 35. Conversational Profile

## 35.1 Purpose

Conversation provides a natural-language operating surface over authoritative professional cognition.

## 35.2 Grounding

Every material response SHOULD remain anchored to explicit entities.

Example:

```text
This recommendation concerns Decision D-14 in PWU P-103 and relies on Evidence E-22 and E-31.
```

## 35.3 Command Conversion

The system MAY translate natural language into proposed commands.

Before execution, it SHALL present:

* interpreted intent;
* affected entities;
* required authority;
* professional effect;
* unresolved ambiguity.

## 35.4 Conversation Persistence

Material conclusions, Decisions, Claims, Evidence, and Assumptions SHALL not remain only in conversation history.

They SHOULD be promoted into structured entities.

---

# 36. Component-Level Semantic Contracts

## 36.1 Entity Link

An entity link SHALL preserve:

* entity identity;
* entity type;
* owning context;
* temporal mode;
* authorization.

## 36.2 State Badge

A state badge SHALL identify which state dimension it represents.

Example:

```text
Lifecycle: Blocked
Validity: Contested
Confidence: Moderate
```

## 36.3 Confidence Indicator

A confidence indicator SHALL expose its basis on inspection.

## 36.4 Evidence Chip

An Evidence chip SHALL not imply support unless its relationship type is visible.

## 36.5 Participant Avatar

A Participant indicator SHALL distinguish human, AI, team, external system, or organization.

## 36.6 AI Contribution Marker

AI origin SHALL remain visible after review or acceptance.

Approval does not erase provenance.

## 36.7 Command Button

A command control SHALL be associated with:

* command type;
* authority;
* preconditions;
* expected professional effect.

## 36.8 Timeline Entry

A timeline entry SHALL distinguish:

* event time;
* record time;
* actor;
* semantic effect.

## 36.9 Graph Node

A graph node SHALL expose a non-graph alternative for accessibility and detailed inspection.

## 36.10 Summary Card

A summary card SHALL provide navigation to the underlying entities and calculation basis.

---

# 37. UI Semantic Invariants

## UI-INV-001 — Intent Visibility

Material workspaces SHALL preserve access to originating Intent.

## UI-INV-002 — Objective Visibility

The active professional objective SHALL be visible or immediately accessible.

## UI-INV-003 — State Separation

Lifecycle, cognitive, validity, technical loading, and confidence states SHALL remain distinct.

## UI-INV-004 — AI Attribution

AI contributions SHALL remain attributable.

## UI-INV-005 — Evidence Provenance

Evidence SHALL expose source and provenance.

## UI-INV-006 — Decision Rationale

Approved Decisions SHALL provide access to rationale.

## UI-INV-007 — Uncertainty Visibility

Material uncertainty SHALL not be hidden behind generic progress indicators.

## UI-INV-008 — Contradiction Visibility

Relevant contradictions SHALL remain visible until disposition.

## UI-INV-009 — No Direct Mutation

UI components SHALL issue semantic commands rather than mutate authoritative state directly.

## UI-INV-010 — Role-Aware Commands

Commands SHALL reflect current role and authority.

## UI-INV-011 — Staleness Disclosure

Stale or partial projections SHALL be disclosed.

## UI-INV-012 — Context Preservation

Cross-projection navigation SHALL preserve professional context.

## UI-INV-013 — Historical Distinction

Historical and predicted states SHALL be unmistakable.

## UI-INV-014 — Completion Integrity

The UI SHALL not represent a PWU as complete when professional completion conditions fail.

## UI-INV-015 — Projection Non-Authority

No visual component or local client state SHALL become an independent source of professional truth.

## UI-INV-016 — Accessible Semantics

Complex visualizations SHALL provide accessible equivalents.

## UI-INV-017 — Professional Language

Primary actions SHOULD use domain-meaningful professional verbs.

## UI-INV-018 — No False Precision

Synthetic indicators SHALL disclose basis and limitations.

## UI-INV-019 — Recomposition Visibility

Parent PWU completion SHALL expose recomposition state.

## UI-INV-020 — Failure Explainability

Unavailable actions and failed commands SHALL explain the professional reason.

---

# 38. Minimum Viable Workspace Implementation

The first coherent Janumi UI SHALL include:

## 38.1 Application Shell

```text
Global Header
Global Navigation
Cognitive Breadcrumb
Workspace Header
Primary Projection
Context Panel
Command Region
```

## 38.2 Core Workspaces

```text
Endeavor Overview
PWU Overview
Understanding
Reasoning
Evidence
Decision
Reconciliation
Decomposition
History
RPH Coordination
Attention
```

## 38.3 Core Interactions

```text
Inspect
Trace
Compare
Contribute
Challenge
Propose
Validate
Authorize
Delegate
Reconcile
Escalate
Synthesize
```

## 38.4 Core Cross-Cutting State

```text
Intent
Objective
Lifecycle State
Cognitive State
Confidence
Uncertainty
Provenance
Authority
Temporal Mode
Staleness
```

---

# 39. Reference Route Model

Routes MAY be implemented as follows:

```text
/{org}/home
/{org}/outcomes
/{org}/endeavors
/{org}/endeavors/{endeavorId}
/{org}/pwus
/{org}/pwus/{pwuId}
/{org}/pwus/{pwuId}/understanding
/{org}/pwus/{pwuId}/reasoning
/{org}/pwus/{pwuId}/evidence
/{org}/pwus/{pwuId}/decisions
/{org}/pwus/{pwuId}/execution
/{org}/pwus/{pwuId}/observations
/{org}/pwus/{pwuId}/reconciliation
/{org}/pwus/{pwuId}/decomposition
/{org}/pwus/{pwuId}/history
/{org}/decisions/{decisionId}
/{org}/evidence/{evidenceId}
/{org}/reconciliations/{reconciliationId}
/{org}/coordination/{rphId}
/{org}/attention
```

Routes are addressable projections.

They SHALL not imply separate semantic modules or data ownership.

---

# 40. Reference Frontend State Model

Frontend state SHOULD be separated into:

```text
Authoritative Projection State
Local Interaction State
Local Draft State
Navigation Context
Temporal Context
Authorization Context
Technical Fetch State
Command State
```

## 40.1 Authoritative Projection State

Server-derived and version-qualified.

## 40.2 Local Interaction State

Examples:

* selected node;
* open panel;
* zoom level;
* temporary filter;
* graph layout.

It SHALL not alter professional meaning.

## 40.3 Local Draft State

Uncommitted proposed professional content.

## 40.4 Command State

```text
idle
validating
awaiting_confirmation
submitting
accepted
rejected
conflicted
```

---

# 41. Acceptance Scenarios

## Scenario A — PWU Orientation

Given:

* a Participant opens a PWU through a direct link;

When:

* the workspace loads;

Then:

* the user sees the PWU objective;
* active Intent;
* lifecycle state;
* cognitive state;
* primary uncertainty;
* current confidence;
* parent context;
* material blockers;
* available role-appropriate commands.

---

## Scenario B — Invalid Completion

Given:

* a PWU has all Actions completed;
* one mandatory Validation failed;
* parent recomposition is incomplete;

When:

* the owner inspects completion readiness;

Then:

* the UI shows Actions as completed;
* the PWU remains incomplete;
* failed Validation is visible;
* recomposition requirement is visible;
* `Complete PWU` is unavailable;
* the professional reason is explained.

---

## Scenario C — Evidence Challenge

Given:

* a Claim is supported by two Evidence items;
* a reviewer adds contradictory Evidence;

When:

* the Evidence is accepted;

Then:

* the Claim displays a contradiction;
* current confidence is marked for reassessment;
* affected Decisions are identified;
* reconciliation may be proposed;
* prior Evidence remains visible.

---

## Scenario D — AI Architecture Recommendation

Given:

* an AI architecture agent proposes Alternative B;

When:

* the recommendation appears in the Decision Workspace;

Then:

* AI origin is visible;
* Evidence and Assumptions are inspectable;
* limitations and confidence are shown;
* the recommendation remains `proposed`;
* only an authorized approver sees the approval command.

---

## Scenario E — Cross-Child Conflict

Given:

* two child PWUs complete with incompatible interface assumptions;

When:

* the parent Decomposition Viewer is opened;

Then:

* both children show completion;
* the interface contradiction is prominent;
* parent synthesis readiness is false;
* a reconciliation command is available;
* parent completion remains unavailable.

---

## Scenario F — Historical Investigation

Given:

* a user selects a historical date;

When:

* the Decision Workspace renders;

Then:

* historical mode is persistently visible;
* the Decision, Evidence, and Confidence reflect that date;
* current commands are unavailable;
* comparison with current state is available.

---

## Scenario G — Mobile Approval

Given:

* an authorized executive receives a decision-required attention item;

When:

* they open it on mobile;

Then:

* the interaction presents the Decision question;
* Alternatives;
* Evidence;
* contradictions;
* Constraints;
* residual Uncertainty;
* downstream impact;
* approve, defer, or request more Evidence actions.

---

## Scenario H — Command Conflict

Given:

* a user prepares a Decision approval from version 8;
* new contradictory Evidence creates version 10;

When:

* approval is submitted;

Then:

* the command is rejected as stale;
* the UI shows the material change;
* the user may compare versions;
* no state is silently overwritten.

---

# 42. Coding Agent Implementation Contract

A coding agent implementing the Janumi UI SHALL:

1. Build a stable cognitive workspace shell before isolated feature pages.
2. Preserve active Intent, objective, lifecycle state, and cognitive state across projections.
3. Model each route as a projection over authoritative semantic state.
4. Keep local UI state separate from professional state.
5. issue semantic commands rather than generic persistence updates.
6. Validate commands server-side.
7. expose professional reasons for disabled or rejected actions.
8. preserve provenance and AI attribution.
9. disclose confidence, uncertainty, contradiction, and staleness.
10. treat PWUs as cognitive aggregates rather than tasks.
11. implement decomposition and recomposition as distinct concepts.
12. preserve cross-projection navigation context.
13. support current, historical, comparison, and stale modes explicitly.
14. avoid relying on color alone.
15. provide accessible alternatives for graphs and matrices.
16. avoid making chat the primary organizing surface.
17. ensure material conversational outputs become explicit entities.
18. avoid duplicating semantic truth in page-specific stores.
19. implement optimistic concurrency for material commands.
20. instrument professional decision boundaries and state transitions.
21. test UI semantic invariants in addition to visual behavior.
22. reject generic “percent complete” indicators lacking professional meaning.
23. preserve the distinction among review, validation, approval, and authorization.
24. ensure completed child PWUs do not imply completed parent PWUs.
25. implement mobile and VS Code surfaces as semantic adaptations, not separate products.

---

# 43. First Implementation Sequence

The initial implementation SHOULD proceed in this order:

## Phase 1 — Cognitive Shell

Implement:

* organization and PWA context;
* cognitive breadcrumb;
* workspace header;
* projection selector;
* context panel;
* command region;
* temporal mode;
* role and authority state.

## Phase 2 — PWU Overview

Implement:

* objective;
* Intent trace;
* dual state;
* confidence;
* uncertainty;
* blocker;
* completion readiness;
* recent material change.

## Phase 3 — Understanding and Reasoning

Implement:

* Questions;
* Uncertainties;
* Assumptions;
* Claims;
* Reasoning Activities;
* AI attribution.

## Phase 4 — Evidence and Decisions

Implement:

* Evidence relationships;
* provenance;
* decision readiness;
* Alternatives;
* authority;
* residual Uncertainty.

## Phase 5 — Decomposition and Reconciliation

Implement:

* child PWUs;
* delegation;
* recomposition;
* contradiction;
* reconciliation proposals;
* impact comparison.

## Phase 6 — RPH Coordination and Attention

Implement:

* portfolio;
* blockages;
* tactic health;
* escalation;
* synthesis;
* professional attention queue.

## Phase 7 — Specialized Profiles

Implement:

* JanumiCode VS Code profile;
* mobile review and Observation capture;
* conversational projection.

---

# 44. Resulting User Experience

A professional entering Janumi should not feel that they are navigating a database of work records.

They should feel that they have entered a living professional context.

They should immediately understand:

* what outcome is being pursued;
* why the current work exists;
* what the organization presently believes;
* what remains uncertain;
* what Evidence supports those beliefs;
* what Decisions require attention;
* what Actions are changing reality;
* what reality has revealed;
* where coherence has been lost;
* what professional transition should occur next.

The interface therefore functions as a cognitive instrument.

Its purpose is not merely to display Janumi’s data.

Its purpose is to make professional cognition inspectable, navigable, governable, and continuously coherent.
