# JanumiCode UI Information Architecture and Screen Contract

## JCUX Specification v0.1.0

**Document ID:** `JAN-JCUX-001`
**Version:** `0.1.0`
**Status:** Draft
**Applies to:** Janumi Professional Workbench web application and JanumiCode PWA
**Related surface:** JanumiCode VS Code extension
**Depends on:** JCPWA v0.1, RIWS v0.1, CPM v0.1, PWU Specification v0.1, RPH Specification v0.1
**Primary audience:** Coding agents, frontend engineers, UX designers, backend engineers, test engineers
**Reference frontend:** SvelteKit and Svelte
**Reference interaction model:** Server-authoritative projections with semantic commands

---

# 1. Purpose

This specification defines the concrete information architecture, route hierarchy, screen inventory, workspace composition, screen contracts, and implementation sequence for the JanumiCode user interface.

It is intended to remove ambiguity for the coding agent currently implementing the JanumiCode experience.

The interface SHALL implement JanumiCode as a professional cognition environment.

It SHALL not implement JanumiCode primarily as:

* a chat application;
* a task tracker;
* a document repository;
* a file browser;
* an agent-run dashboard;
* a rigid software-development workflow;
* a collection of disconnected product modules.

The interface SHALL expose one authoritative product-realization model through multiple cognitive projections.

---

# 2. Primary User Experience

A user entering JanumiCode should be able to determine, without reconstructing state from multiple tools:

* what product Outcome is being pursued;
* why current work exists;
* which Professional Work Unit is active;
* what is known;
* what remains uncertain;
* which assumptions are critical;
* what reasoning is underway;
* what decisions require attention;
* what implementation is changing;
* what Evidence supports correctness;
* what is blocked;
* where professional coherence has been lost;
* what action the user is authorized to take next.

---

# 3. Global Information Architecture

The top-level navigation SHALL be:

```text
Home
Outcomes
Endeavors
Work
Product Realization
Decisions
Evidence
Reconciliation
Coordination
Attention
Memory
```

JanumiCode-specific secondary destinations SHALL include:

```text
Requirements
Architecture
Implementation
Verification
Releases
Operations
```

These destinations are named projections over the same semantic model.

They SHALL not own separate truth.

---

# 4. Canonical Route Hierarchy

```text
/{organizationId}/home

/{organizationId}/outcomes
/{organizationId}/outcomes/{outcomeId}

/{organizationId}/endeavors
/{organizationId}/endeavors/{endeavorId}

/{organizationId}/pwus
/{organizationId}/pwus/{pwuId}
/{organizationId}/pwus/{pwuId}/understanding
/{organizationId}/pwus/{pwuId}/reasoning
/{organizationId}/pwus/{pwuId}/evidence
/{organizationId}/pwus/{pwuId}/decisions
/{organizationId}/pwus/{pwuId}/implementation
/{organizationId}/pwus/{pwuId}/verification
/{organizationId}/pwus/{pwuId}/observations
/{organizationId}/pwus/{pwuId}/reconciliation
/{organizationId}/pwus/{pwuId}/decomposition
/{organizationId}/pwus/{pwuId}/history

/{organizationId}/realization
/{organizationId}/realization/{endeavorId}

/{organizationId}/requirements
/{organizationId}/requirements/{requirementId}

/{organizationId}/architecture
/{organizationId}/architecture/{architectureEntityId}
/{organizationId}/architecture/decisions/{decisionId}

/{organizationId}/implementation
/{organizationId}/implementation/changes/{changeId}
/{organizationId}/implementation/agents/{agentExecutionId}

/{organizationId}/verification
/{organizationId}/verification/{verificationId}

/{organizationId}/releases
/{organizationId}/releases/{releaseId}

/{organizationId}/operations
/{organizationId}/operations/incidents/{incidentId}

/{organizationId}/decisions
/{organizationId}/decisions/{decisionId}

/{organizationId}/evidence
/{organizationId}/evidence/{evidenceId}

/{organizationId}/reconciliations
/{organizationId}/reconciliations/{reconciliationId}

/{organizationId}/coordination
/{organizationId}/coordination/{rphId}

/{organizationId}/attention
/{organizationId}/memory
```

---

# 5. Application Shell Contract

Every authenticated JanumiCode route SHALL render within the canonical application shell.

## 5.1 Required Shell Regions

```text
Global Header
Global Navigation Rail
Cognitive Breadcrumb
Workspace Header
Projection Navigation
Primary Workspace
Context Inspector
Command Region
Attention Indicator
```

## 5.2 Global Header

The Global Header SHALL show:

```text
Organization
Active PWA: JanumiCode
Current Endeavor
Current Role
Temporal Mode
Global Search
Attention Count
System Capability Status
Participant Menu
```

## 5.3 Global Navigation Rail

The navigation rail SHALL provide stable access to top-level projections.

The active destination SHALL be visually and semantically identifiable.

## 5.4 Cognitive Breadcrumb

The breadcrumb SHALL represent professional context.

Example:

```text
Janumi
› Field Service Platform
› Scheduling Capability
› Architecture PWU
› Decision: Consistency Model
```

The breadcrumb SHALL not merely repeat URL segments.

## 5.5 Workspace Header

The Workspace Header SHALL show:

```text
Title
Entity Type
Professional Objective
Lifecycle State
Cognitive State
Originating Intent
Current Confidence
Primary Uncertainty
Owner or Coordinator
Last Material Change
```

---

# 6. Shared Screen State Contract

Every screen SHALL distinguish the following state categories:

```text
authoritativeProjectionState
technicalFetchState
localInteractionState
localDraftState
commandState
authorizationState
temporalState
stalenessState
```

These SHALL not be collapsed into one generic loading or status field.

## 6.1 Technical Fetch States

```text
idle
loading
refreshing
loaded
partial
stale
offline
failed
```

## 6.2 Command States

```text
idle
validating
awaiting_confirmation
submitting
accepted
rejected
conflicted
```

## 6.3 Temporal States

```text
current
historical
comparison
predicted
offline_snapshot
```

---

# 7. Shared Screen Invariants

## SCREEN-INV-001 — Intent Access

Every material screen SHALL provide access to originating Intent.

## SCREEN-INV-002 — Objective Access

Every PWU screen SHALL display the professional objective.

## SCREEN-INV-003 — Dual State

Lifecycle state and cognitive state SHALL be shown separately.

## SCREEN-INV-004 — Authority

Available Commands SHALL derive from role and authority.

## SCREEN-INV-005 — Provenance

Claims, Evidence, AI outputs, Decisions, and changes SHALL expose provenance.

## SCREEN-INV-006 — Uncertainty

Material uncertainty SHALL remain visible.

## SCREEN-INV-007 — Contradiction

Relevant contradictions SHALL not be hidden.

## SCREEN-INV-008 — Staleness

Stale or partial projections SHALL be identified.

## SCREEN-INV-009 — No Direct Mutation

UI components SHALL issue semantic Commands.

They SHALL not mutate authoritative state directly.

## SCREEN-INV-010 — Context Preservation

Moving between projections SHALL preserve active professional context.

---

# 8. Home Screen

## Route

```text
/{organizationId}/home
```

## Purpose

Orient the current Participant to the state of product realization and the work requiring professional attention.

## Primary Questions

* What changed materially?
* What requires my attention?
* Which Outcomes are at risk?
* Which Decisions are waiting?
* Where is work blocked?
* What did AI Participants complete?
* Where has coherence degraded?

## Required Sections

```text
Current Professional Attention
Outcome Health
Active Endeavors
Material Changes
Pending Decisions
Blocked PWUs
Reconciliation Required
AI Work Requiring Review
Recent Observations
```

## Required Commands

```text
Open Attention Item
Review Decision
Open PWU
Inspect Change
Start Reconciliation
Delegate Attention
```

## Prohibitions

The Home screen SHALL not become:

* a generic activity feed;
* a notification inbox;
* a collection of vanity metrics;
* a project-status dashboard.

## Acceptance Criteria

* Material changes are prioritized above simple recency.
* Each item links to professional context.
* AI output requiring review is distinguishable from approved work.
* Blocked work explains the blocking condition.
* Stale projections disclose their age.

---

# 9. Outcomes Screen

## Route

```text
/{organizationId}/outcomes
```

## Purpose

Show the desired and observed product Outcomes across Endeavors.

## Required Views

```text
Outcome Portfolio
Outcome Hierarchy
Outcome-to-Endeavor Map
Outcome Risk View
Outcome Observation View
```

## Outcome Card Contract

Each Outcome SHALL show:

```text
Description
Beneficiary
Current Assessment
Success Criteria
Supporting Endeavors
Current Confidence
Threatening Uncertainty
Recent Observations
Outcome Type
```

## Commands

```text
Define Outcome
Revise Outcome
Link Endeavor
Record Assessment
Identify Risk
Open Reconciliation
```

## Acceptance Criteria

* Deliverables are not presented as Outcomes.
* Current assessment and desired state remain distinct.
* Supporting work can be traced to the Outcome.
* Observed adverse Outcomes are visible.

---

# 10. Outcome Detail Screen

## Route

```text
/{organizationId}/outcomes/{outcomeId}
```

## Required Projections

```text
Overview
Intent
Supporting Work
Evidence
Observations
Risks
History
```

## Required Screen Regions

```text
Outcome Definition
Success Criteria
Current Assessment
Confidence
Supporting Intents
Supporting PWUs
Threatening Risks
Observed Variance
Pending Decisions
```

## Acceptance Criteria

* The user can trace from Outcome to implementation and Observation.
* Success criteria identify evaluation methods.
* Outcome confidence identifies its basis.

---

# 11. Endeavors Screen

## Route

```text
/{organizationId}/endeavors
```

## Purpose

Show bounded product-realization undertakings.

## Required Groupings

```text
Active
Framing
Blocked
Awaiting Decision
Reconciling
Completed
Suspended
```

## Endeavor Card Contract

```text
Title
Endeavor Type
Primary Outcome
Primary Intent
Current Phase Regions
Root PWUs
Current Confidence
Primary Uncertainty
Blocking Condition
Coordinator
```

## Acceptance Criteria

* Endeavors are not shown only as project status.
* Multiple active cognitive regions may be represented.
* Each Endeavor links to the Product Realization Map.

---

# 12. Endeavor Detail Screen

## Route

```text
/{organizationId}/endeavors/{endeavorId}
```

## Purpose

Provide the main operating context for one product-realization undertaking.

## Required Tabs

```text
Overview
Product Realization
Outcomes
PWUs
Decisions
Evidence
Releases
Observations
Reconciliation
History
```

## Overview Sections

```text
Intent
Desired Outcomes
Current Understanding
Root PWUs
Major Decisions
Current Risks
Current Assumptions
Recent Material Changes
Completion or Release Readiness
```

## Commands

```text
Revise Intent
Create PWU
Create Decision
Identify Uncertainty
Add Evidence
Start Reconciliation
Create Release
```

---

# 13. Work Screen

## Route

```text
/{organizationId}/pwus
```

## Purpose

Present Professional Work Units by professional condition.

## Canonical Groupings

```text
Needs Framing
Ready
Actively Reasoning
Awaiting Evidence
Awaiting Decision
Awaiting Review
Blocked
Reconciling
Ready for Synthesis
Completed
Escalated
```

## Filters

```text
Endeavor
PWU Type
Lifecycle State
Cognitive State
Owner
Participant Type
Outcome
Attention Required
Confidence
Uncertainty Severity
```

## Prohibitions

The default view SHALL not use a generic:

```text
To Do
In Progress
Done
```

Kanban model.

A Kanban presentation MAY exist as an optional projection where semantically justified.

---

# 14. PWU Overview Screen

## Route

```text
/{organizationId}/pwus/{pwuId}
```

## Purpose

Provide the canonical local orientation view for one PWU.

## Required Header

```text
Title
PWU Type
Professional Objective
Lifecycle State
Cognitive State
Parent PWU
Root PWU
Originating Intent
Owner
RPH Coordinator
Current Confidence
Primary Uncertainty
```

## Required Sections

### Objective and Scope

```text
Professional Objective
Included Scope
Excluded Scope
Non-Goals
Completion Conditions
```

### Current Professional State

```text
Current Understanding
Open Questions
Critical Assumptions
Constraints
Current Blocker
Required Attention
```

### Active Work

```text
Reasoning Activities
Agent Executions
Human Reviews
Validations
Actions
```

### Completion Readiness

```text
Completion Conditions
Required Validations
Dependencies
Residual Uncertainty
Recomposition Status
```

### Material Changes

Prioritized by professional impact.

## Primary Commands

```text
Start Work
Identify Uncertainty
Add Assumption
Add Evidence
Start Reasoning
Propose Decision
Block PWU
Request Review
Start Reconciliation
Decompose PWU
Complete PWU
Escalate
```

## Acceptance Criteria

* Completion cannot be requested when mandatory conditions are unsatisfied.
* Disabled Commands explain why.
* AI-originated content remains attributable.
* The active PWU objective remains visible across projections.

---

# 15. PWU Understanding Screen

## Route

```text
/{organizationId}/pwus/{pwuId}/understanding
```

## Required Sections

```text
Open Questions
Known Claims
Contested Claims
Uncertainties
Critical Assumptions
Constraints
Confidence Distribution
Contradictions
```

## Question Card Contract

```text
Question
Question Type
Status
Importance
Decision Impact
Assigned Reasoning
Resolution Criteria
```

## Assumption Card Contract

```text
Statement
Status
Criticality
Basis
Validation Method
Dependent Entities
Failure Consequence
```

## Commands

```text
Open Question
Refine Question
Decompose Question
Identify Uncertainty
Register Assumption
Challenge Assumption
Validate Assumption
Propose Claim
```

---

# 16. PWU Reasoning Screen

## Route

```text
/{organizationId}/pwus/{pwuId}/reasoning
```

## Views

```text
Reasoning Graph
Activity List
Alternatives
Methods
Synthesis
Agent Contributions
```

## Reasoning Activity Contract

```text
Purpose
Reasoning Type
Status
Participant
Inputs
Method
Outputs
Assumptions Introduced
Limitations
Confidence Effect
Validation Status
```

## Commands

```text
Start Reasoning
Assign Reasoner
Request Research
Compare Alternatives
Challenge Claim
Change Tactic
Request Specialist
Escalate
```

## Acceptance Criteria

* Failed and inconclusive reasoning remains visible.
* Agent activity is not displayed as authoritative by default.
* Method, Evidence, assumptions, and limitations can be inspected.
* Hidden chain-of-thought is not required.

---

# 17. PWU Evidence Screen

## Route

```text
/{organizationId}/pwus/{pwuId}/evidence
```

## Views

```text
Evidence Table
Claim–Evidence Matrix
Evidence Graph
Gap Analysis
Contradiction Analysis
Provenance
```

## Evidence Card Contract

```text
Evidence Type
Source
Observed or Published Time
Recorded Time
Reliability
Relevance
Relationship Type
Supported Claims
Contradicted Claims
Validation
Provenance
```

## Commands

```text
Add Evidence
Classify Relationship
Validate Source
Challenge Evidence
Mark Stale
Request Evidence
Link Observation
```

## Acceptance Criteria

* Attachment does not imply evidentiary support.
* Support, contradiction, qualification, and inconclusive relationships are explicit.
* Unsupported material Claims are visible.

---

# 18. PWU Decisions Screen

## Route

```text
/{organizationId}/pwus/{pwuId}/decisions
```

## Purpose

Show Decisions affecting the PWU and their readiness.

## Decision Summary Contract

```text
Decision Question
Status
Authority
Readiness
Alternatives
Evidence Sufficiency
Constraints Checked
Residual Uncertainty
Required Review
```

## Commands

```text
Create Decision
Propose Alternative
Add Evidence
Request Decision
Review Decision
Approve
Reject
Defer
Reopen
```

## Acceptance Criteria

* Decision status remains distinct from truth or validation.
* Approval requires authority.
* Contradicting Evidence remains visible.
* Readiness is explainable by dimension.

---

# 19. Decision Detail Screen

## Route

```text
/{organizationId}/decisions/{decisionId}
```

## Required Layout

```text
Decision Question
Context and Intent
Authority
Alternatives Comparison
Supporting Claims
Supporting Evidence
Contradicting Evidence
Assumptions
Constraints
Risks
Residual Uncertainty
Recommendation
Rationale
Downstream Impact
History
```

## Confirmation Contract

Approval confirmation SHALL summarize:

* selected Alternative;
* material trade-offs;
* mandatory Constraints;
* unresolved uncertainty;
* downstream impact;
* effective time.

---

# 20. Product Realization Map

## Route

```text
/{organizationId}/realization/{endeavorId}
```

## Purpose

Show the coherent chain from product Intent to observed operation.

## Canonical Structure

```text
Intent
→ Outcome
→ User Journey
→ Requirement
→ Architecture
→ Implementation Change
→ Verification
→ Release
→ Observation
→ Reconciliation
```

## Required Modes

```text
Trace Graph
Structured Outline
Gap Analysis
Coverage Matrix
Change Impact
Temporal Evolution
```

## Gap Types

```text
RequirementWithoutIntent
RequirementWithoutVerification
ArchitectureWithoutDecision
ChangeWithoutRequirement
ChangeWithoutValidation
TestWithoutRequirementOrInvariant
ReleaseWithoutObservation
ObservationWithoutReconciliation
```

## Commands

```text
Create Missing Link
Open Related Entity
Start Gap Resolution PWU
Open Reconciliation
Inspect Change Impact
```

## Acceptance Criteria

* The graph has an accessible non-graph equivalent.
* Users can move from code or test back to product Intent.
* Gaps are explainable and actionable.
* The map is not rendered as one unreadable universal graph by default.

---

# 21. Requirements Screen

## Route

```text
/{organizationId}/requirements
```

## Views

```text
Requirement Catalog
Hierarchy
Journey Trace
Conflict View
Verification Coverage
Change Impact
```

## Requirement Row Contract

```text
Requirement Statement
Type
Status
Priority
Originating Intent
Journey
Verification Method
Implementation Coverage
Verification Status
Conflict State
```

## Commands

```text
Propose Requirement
Accept Requirement
Reject Requirement
Refine Requirement
Define Acceptance Criteria
Link Journey
Assign Verification Method
Open Conflict
Supersede Requirement
```

---

# 22. Requirement Detail Screen

## Route

```text
/{organizationId}/requirements/{requirementId}
```

## Required Sections

```text
Statement
Rationale
Type
Status
Intent Trace
Stakeholders
User Journeys
Acceptance Criteria
Verification Method
Architecture Trace
Implementation Trace
Test Coverage
Evidence
Conflicts
History
```

## Acceptance Criteria

* Accepted Requirements have verification methods.
* Implementation and verification statuses remain separate.
* Vague quality attributes are flagged.

---

# 23. Architecture Screen

## Route

```text
/{organizationId}/architecture
```

## Canonical Views

```text
System Context
Capabilities
Domain Model
Components
Interfaces
Data
Security
Deployment
Decisions
Invariants
Drift
```

## Architecture Element Contract

```text
Name
Element Type
Responsibility
Owning Decision
Related Requirements
Interfaces
Dependencies
Current Validity
Implementation Coverage
Drift State
```

## Commands

```text
Create Architecture Element
Create Decision
Define Interface
Register Invariant
Open Review
Identify Drift
Start Reconciliation
```

---

# 24. Architecture Decision Screen

## Route

```text
/{organizationId}/architecture/decisions/{decisionId}
```

This route SHALL use the shared Decision Detail contract with architecture-specific criteria.

Additional sections:

```text
Quality Attributes
Affected Components
Affected Interfaces
Evolution Consequences
Revisit Triggers
Implementation Conformance
Operational Evidence
```

---

# 25. Implementation Portfolio Screen

## Route

```text
/{organizationId}/implementation
```

## Purpose

Show implementation work as professional product-realization slices.

## Groupings

```text
Ready to Implement
In Implementation
Awaiting Validation
Blocked
Changes Requested
Ready to Merge
Merged
Deployed
Reconciling
```

## Implementation Slice Card

```text
Professional Objective
PWU
Affected Requirements
Architecture Decisions
Repository
Agent or Human Owner
Current Change
Validation State
Blocker
Completion Readiness
```

## Prohibition

The screen SHALL not default to a repository file list or agent-run list.

---

# 26. Implementation Workspace

## Route

```text
/{organizationId}/pwus/{pwuId}/implementation
```

## Required Regions

```text
Objective and Scope
Requirements
Architecture Decisions
Invariants
Repository Context
Active Change
Agent Execution
Changed Artifacts
Tests
Validation
Assumptions and Deviations
Completion Readiness
```

## Commands

```text
Create Change
Start Coding Agent
Stop Agent
Safe Stop Agent
Request Review
Run Validation
Record Deviation
Open Reconciliation
Submit Change
Complete Implementation PWU
```

## Agent Execution Panel

```text
Agent Role
Operating Mode
Objective
Scope
Current State
Current Step
Tool Calls
Sandbox State
Produced Artifacts
Assumptions
Validation
Escalation
Resource Usage
```

## Acceptance Criteria

* Code changes trace to professional context.
* Agent scope and non-goals are visible.
* Passing build does not imply PWU completion.
* Deviations from architecture are explicit.

---

# 27. Change Detail Screen

## Route

```text
/{organizationId}/implementation/changes/{changeId}
```

## Required Sections

```text
Objective
Affected Artifacts
Affected Representations
Implementation Rationale
Requirements
Architecture
Invariants
Diff Summary
Tests
Review
Validation
Risk
Rollback
Deployment Relationship
History
```

## Commands

```text
Submit for Review
Request Changes
Approve Change
Merge Change
Record Validation
Revert
Open Reconciliation
```

---

# 28. Agent Execution Detail Screen

## Route

```text
/{organizationId}/implementation/agents/{agentExecutionId}
```

## Required Sections

```text
Agent Identity
Model Identity
Professional Role
Objective
Scope
Authority
Context Sources
Current Status
Tool Calls
Sandbox Executions
Outputs
Assumptions
Limitations
Validation
Cost and Resource Use
Failure or Escalation
```

## Acceptance Criteria

* Model and agent identity remain visible.
* Tool calls are traceable.
* Full hidden chain-of-thought is not required.
* Professional rationale and Evidence are available.
* Agent completion is not presented as PWU completion.

---

# 29. Verification Screen

## Route

```text
/{organizationId}/verification
```

## Views

```text
Requirement Coverage
Invariant Coverage
Risk Coverage
Execution Results
Failures
Waivers
Release Gates
```

## Verification Row Contract

```text
Subject
Verification Method
Status
Latest Result
Evidence
Environment
Required for Release
Owner
```

## Commands

```text
Create Verification
Execute Verification
Record Result
Request Evidence
Open Failure Analysis
Grant Waiver
Revoke Waiver
```

---

# 30. Verification Detail Screen

## Route

```text
/{organizationId}/verification/{verificationId}
```

## Required Sections

```text
Subject
Method
Criteria
Environment
Inputs
Execution
Result
Evidence
Failure Details
Affected Requirements
Affected Invariants
Waiver
History
```

## Acceptance Criteria

* Inconclusive is not treated as pass.
* Waivers record authority and risk.
* Failures identify affected product-realization entities.

---

# 31. Releases Screen

## Route

```text
/{organizationId}/releases
```

## Release Card Contract

```text
Release Name
Status
Included Changes
Excluded Scope
Verification Readiness
Security Review
Operational Readiness
Known Risks
Target Environment
Approval State
```

## Commands

```text
Create Release
Add Change
Remove Change
Run Readiness Assessment
Request Approval
Approve Release
Authorize Deployment
Rollback
```

---

# 32. Release Detail Screen

## Route

```text
/{organizationId}/releases/{releaseId}
```

## Required Sections

```text
Scope
Included Changes
Excluded Changes
Verification
Security
Migration
Operational Readiness
Known Defects
Known Risks
Rollback Plan
Approvals
Deployment
Observations
Acceptance
```

## Acceptance Criteria

* Deployment and Release acceptance remain separate.
* Residual risk is explicit.
* Release readiness is decomposed and explainable.

---

# 33. Operations Screen

## Route

```text
/{organizationId}/operations
```

## Required Views

```text
Current Releases
Service Health
Outcome Indicators
Invariant Monitors
Incidents
Operational Observations
Architecture Drift
Reconciliation Backlog
```

## Acceptance Criteria

* Operational telemetry is linked to product context where possible.
* Service health is not treated as equivalent to user or business Outcome success.
* Violated invariants are prominent.

---

# 34. Incident Detail Screen

## Route

```text
/{organizationId}/operations/incidents/{incidentId}
```

## Required Regions

```text
Observed Condition
Affected Users and Outcomes
Severity
Timeline
Working Claims
Evidence
Containment Actions
Decisions
Remediation
Recovery Validation
Residual Risk
Follow-On PWUs
Reconciliation
```

## Commands

```text
Update Severity
Record Observation
Propose Claim
Authorize Containment
Create Remediation PWU
Verify Recovery
Resolve Incident
Open Reconciliation
```

## Acceptance Criteria

* Service restoration alone does not close the incident.
* Incident reasoning and Evidence remain reconstructable.
* Follow-on work is visible.

---

# 35. Reconciliation Portfolio Screen

## Route

```text
/{organizationId}/reconciliations
```

## Groupings

```text
Detected
Analyzing
Proposed
Awaiting Review
Applying
Partially Applied
Escalated
Completed
```

## Reconciliation Card

```text
Trigger
Detected Incoherence
Affected Entities
Affected PWUs
Affected Decisions
Outcome Impact
Required Authority
Status
```

---

# 36. Reconciliation Detail Screen

## Route

```text
/{organizationId}/reconciliations/{reconciliationId}
```

## Required Layout

```text
Trigger
Prior State
Current Conflict
Affected Model
Impact Analysis
Proposed Changes
Before-and-After Comparison
Validation
Required Authority
Application Progress
Remaining Incoherence
History
```

## Commands

```text
Accept Proposal
Reject Proposal
Revise Proposal
Request Evidence
Reopen Decision
Reopen PWU
Create Follow-On PWU
Accept Temporary Incoherence
Escalate
```

---

# 37. Coordination Screen

## Route

```text
/{organizationId}/coordination
```

## Required Views

```text
Work Portfolio
Delegation Tree
Dependency Network
Tactic Health
Escalation Queue
Validation Queue
Synthesis Queue
Agent Capacity
```

## Professional Groupings

```text
Needs Framing
Ready
Reducing Uncertainty
Awaiting Evidence
Awaiting Decision
Awaiting Review
Blocked
Reconciling
Ready for Synthesis
Escalated
```

---

# 38. RPH Detail Screen

## Route

```text
/{organizationId}/coordination/{rphId}
```

## Required Sections

```text
Professional Objective
Scope
Authority
Current State
Current Plan
Coordinated PWUs
Child RPHs
Participants
Dependencies
Active Tactics
Progress Assessment
No-Progress Signals
Validation State
Synthesis State
Escalations
Resource Budget
History
```

## Commands

```text
Revise Plan
Allocate Participant
Create PWU
Create Child RPH
Change Tactic
Request Specialist
Suspend
Resume
Escalate
Start Synthesis
Complete RPH
```

---

# 39. Attention Screen

## Route

```text
/{organizationId}/attention
```

## Required Groupings

```text
Decision Required
Review Required
Validation Required
Evidence Required
Contradiction
Assumption Invalidated
Dependency Blocked
Intent Changed
Reconciliation Required
Escalation
Outcome at Risk
```

## Attention Item Contract

```text
Why Attention Is Required
Professional Context
Required Role
Required Authority
Urgency
Outcome Impact
Relevant Evidence
Available Commands
Deferral Consequence
```

## Commands

```text
Open Context
Resolve
Delegate
Defer
Accept Risk
Mark Not Applicable
Escalate
```

## Prohibition

Material Attention Items SHALL not be dismissible without disposition.

---

# 40. Memory Screen

## Route

```text
/{organizationId}/memory
```

## Required Views

```text
Change Summaries
Decision Histories
Endeavor Narratives
Incident Narratives
Onboarding Narratives
Handoff Narratives
Reconciliation Narratives
```

## Narrative Contract

```text
Scope
Time Range
Purpose
Source Entities
Generated By
Confidence
Known Omissions
Validation Status
```

## Acceptance Criteria

* Narratives link to source entities.
* Narrative fluency is not presented as proof of completeness.
* Users can inspect structured state beneath the narrative.

---

# 41. Global Search Contract

Search SHALL support semantic queries such as:

```text
Show requirements without verification.
Find decisions affected by the new authentication policy.
Show code changes not linked to architecture decisions.
Find critical assumptions invalidated this month.
Show active PWUs blocked by legal review.
Show evidence contradicting the selected design.
```

## Search Result Contract

```text
Entity Type
Title or Statement
Owning Context
Intent
Lifecycle or Validity State
Temporal Relevance
Confidence
Match Explanation
```

---

# 42. Context Inspector Contract

The Context Inspector SHALL provide stable access to:

```text
Intent
Outcome
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

## Behavior

* It may be pinned or collapsed.
* Selecting an entity updates the Inspector.
* Critical state remains visible even when collapsed.
* Inspector state should persist across related projections.

---

# 43. Command Region Contract

The Command Region SHALL display only professionally valid Commands.

Each Command control SHALL know:

```text
commandType
requiredRole
requiredAuthority
preconditions
expectedEffect
confirmationPolicy
```

## Disabled Command Contract

A disabled Command SHALL state why it is unavailable.

Example:

```text
Approve Release is unavailable because the mandatory security review failed and no exception authority is assigned.
```

---

# 44. Entity Drawer Contract

A lightweight Entity Drawer MAY provide rapid inspection without leaving the current projection.

It SHALL support:

```text
Summary
Relationships
Provenance
Confidence
Validity
History
Open Full Context
```

The drawer SHALL not replace the full workspace for material Decisions or professional work.

---

# 45. Timeline Contract

Timeline entries SHALL distinguish:

```text
Semantic Event
Command
Decision
Observation
Validation
AI Contribution
Administrative Action
Technical Failure
```

Each entry SHALL show:

```text
Occurred Time
Recorded Time
Actor
Professional Effect
Related Entities
```

---

# 46. Graph Contract

Graphs SHALL be used only where relationships are the primary cognitive object.

Every graph SHALL provide:

* textual or tabular equivalent;
* filtering;
* legend;
* relationship semantics;
* selected-node Inspector;
* bounded traversal depth;
* accessible keyboard navigation where practical.

The UI SHALL avoid rendering the entire enterprise graph by default.

---

# 47. Table Contract

Tables SHOULD support:

* semantic column labels;
* sorting by professional importance;
* filtering;
* relationship navigation;
* current-state disclosure;
* accessible row actions;
* saved views.

A row SHALL not contain only identifiers and technical state.

---

# 48. Empty State Contract

Empty states SHALL distinguish:

```text
No Data Yet
Not Applicable
Not Authorized
Filtered Out
Not Loaded
Awaiting Professional Work
```

Example:

```text
No verification method has been defined for this Requirement.
Define one before the Requirement can be accepted.
```

This is preferable to:

```text
No records found.
```

---

# 49. Error State Contract

Errors SHALL distinguish:

```text
Technical Failure
Authorization Failure
Validation Failure
Concurrency Conflict
Invariant Violation
External Dependency Failure
Projection Failure
```

Every material error SHOULD include:

```text
Professional Explanation
Technical Reference
Retryability
Current State
Recommended Disposition
Correlation ID
```

---

# 50. Stale Projection Contract

A stale projection SHALL show:

```text
Last Updated
Source Version
Current Known Version
Material Change Indicator
Refresh Command
Command Safety State
```

Commands from stale projections SHALL revalidate against current authoritative state.

---

# 51. Historical Mode Contract

Historical mode SHALL:

* display a persistent historical banner;
* identify the selected time;
* disable current-state mutation;
* permit comparison with current state;
* preserve historical provenance.

---

# 52. Responsive Web Contract

## Wide Layout

```text
Global Rail
Primary Workspace
Context Inspector
Optional Secondary Projection
Command Region
```

## Medium Layout

* Context Inspector becomes collapsible.
* Secondary projection becomes modal or tabbed.
* Global rail may collapse to icons.

## Narrow Layout

* One primary cognitive region at a time.
* Context appears in a drawer.
* Commands appear in a fixed action region.
* Critical state remains visible.

---

# 53. Mobile Contract

Mobile SHALL prioritize:

```text
Attention
Review
Approval
Observation Capture
Evidence Capture
Incident Response
Concise PWU Understanding
```

Complex Decision review SHOULD use a guided sequence:

```text
Question
Alternatives
Evidence
Contradictions
Constraints
Uncertainty
Impact
Decision
```

---

# 54. VS Code Route and View Contract

The VS Code extension SHALL expose:

```text
Janumi Product Realization Explorer
Current PWU View
Requirements View
Architecture View
Implementation View
Verification View
Agent Activity View
Reconciliation View
```

## Selection Context

Selecting a file or symbol SHOULD show:

```text
Related PWUs
Requirements
Architecture Decisions
Invariants
Tests
Observations
Reconciliation
```

## Prohibition

The VS Code extension SHALL not consist only of:

```text
Chat
Prompt Box
Agent Output
```

---

# 55. Frontend Component Inventory

Initial semantic components:

```text
AppShell
GlobalHeader
GlobalNavigation
CognitiveBreadcrumb
WorkspaceHeader
LifecycleStateBadge
CognitiveStateBadge
ValidityBadge
ConfidenceIndicator
UncertaintyIndicator
IntentTrace
OutcomeTrace
ProjectionTabs
ContextInspector
ProfessionalCommandBar
AttentionIndicator
PwuSummary
CompletionReadiness
QuestionCard
AssumptionCard
ClaimCard
EvidenceCard
DecisionCard
AlternativeComparison
ReasoningActivityCard
AgentExecutionPanel
ValidationCard
DependencyCard
ReconciliationCard
DecompositionTree
ProductRealizationMap
EntityTimeline
ProvenancePanel
StalenessBanner
HistoricalModeBanner
ProfessionalErrorPanel
```

---

# 56. Component Semantic Requirements

## `LifecycleStateBadge`

Must identify the state dimension as lifecycle.

## `CognitiveStateBadge`

Must not reuse the lifecycle state label.

## `ConfidenceIndicator`

Must expose basis and assessment source.

## `EvidenceCard`

Must expose Evidence relationship semantics.

## `DecisionCard`

Must expose authority and residual uncertainty.

## `AgentExecutionPanel`

Must expose agent identity, scope, authority, and validation.

## `CompletionReadiness`

Must show individual completion conditions, not only a percentage.

## `ProfessionalCommandBar`

Must derive Commands from server-authoritative permissions and state.

---

# 57. Backend Projection Requirements

The frontend SHALL not assemble core professional state through numerous unrelated entity requests when a defined projection exists.

Required initial projection endpoints:

```text
GET /projections/home
GET /projections/outcomes
GET /projections/endeavors/{endeavorId}
GET /projections/pwus/{pwuId}/overview
GET /projections/pwus/{pwuId}/understanding
GET /projections/pwus/{pwuId}/reasoning
GET /projections/pwus/{pwuId}/evidence
GET /projections/pwus/{pwuId}/decisions
GET /projections/pwus/{pwuId}/implementation
GET /projections/pwus/{pwuId}/verification
GET /projections/pwus/{pwuId}/decomposition
GET /projections/realization/{endeavorId}
GET /projections/coordination/{rphId}
GET /projections/attention
```

---

# 58. Projection Response Envelope

Every projection response SHOULD include:

```text
projectionId
projectionVersion
generatedAt
asOfTime
consistencyMode
sourceVersionVector
staleness
completeness
appliedFilters
authorizationScope
data
availableCommands
```

---

# 59. Semantic Command API Requirements

The frontend SHALL submit Commands through generated contracts.

Examples:

```text
POST /commands/create-pwu
POST /commands/identify-uncertainty
POST /commands/register-assumption
POST /commands/propose-requirement
POST /commands/approve-architecture-decision
POST /commands/start-agent-execution
POST /commands/record-verification-result
POST /commands/start-reconciliation
POST /commands/complete-pwu
```

---

# 60. Command Response Contract

```text
commandId
status
professionalMessage
aggregateId
priorVersion
newVersion
emittedEvents
resultEntities
validationResults
attentionItems
processIds
projectionRefreshHints
```

---

# 61. Frontend State Architecture

Recommended frontend state separation:

```text
routeContext
authoritativeProjection
selectionState
panelState
draftState
commandState
temporalState
authorizationState
```

## Prohibition

Do not create a single global mutable store containing all professional entities and UI state without boundaries.

---

# 62. SvelteKit Implementation Guidance

## Server Load

Route-level server loads SHOULD retrieve:

* projection data;
* authorization context;
* temporal context;
* available Commands.

## Client State

Client state SHOULD hold:

* current selection;
* visual layout;
* open panels;
* local drafts;
* pending Command state.

## Mutation

Commands SHALL be submitted through server endpoints or generated API clients.

## Refresh

Accepted Commands SHOULD trigger targeted projection invalidation rather than full application reload.

---

# 63. Loading Sequence

A workspace SHOULD render in this order:

1. shell;
2. route and identity context;
3. Workspace Header;
4. critical state;
5. primary projection;
6. secondary details;
7. noncritical history or analytics.

The user SHOULD not wait for the full graph or history before seeing the professional objective and state.

---

# 64. Performance Priorities

Prioritize:

* current objective;
* state;
* attention;
* Commands;
* critical uncertainty;
* blocking conditions.

Defer or lazy-load:

* full history;
* large graphs;
* deep provenance;
* expansive Evidence networks;
* historical comparisons.

---

# 65. Accessibility Contract

All core screens SHALL support:

* keyboard navigation;
* screen-reader labels;
* visible focus;
* color-independent state;
* reduced motion;
* accessible graph alternatives;
* accessible comparison tables;
* logical heading structure;
* sufficient contrast;
* clear error association.

---

# 66. Analytics and Telemetry

UI telemetry MAY record:

```text
projectionOpened
entityInspected
commandInitiated
commandAccepted
commandRejected
attentionResolved
reconciliationOpened
contextLost
searchPerformed
```

Telemetry SHALL not capture protected professional content unnecessarily.

---

# 67. Screen-Level Testing Strategy

Each screen SHALL have:

```text
route test
projection contract test
authorization test
loading-state test
stale-state test
error-state test
keyboard-access test
semantic invariant test
command test
```

Visual snapshot tests alone are insufficient.

---

# 68. Critical Acceptance Journey 1 — From Intent to Implementation

1. User opens an Endeavor.
2. User inspects Product Intent.
3. User opens Product Realization Map.
4. User selects a Requirement.
5. User traces to Architecture Decision.
6. User opens implementation PWU.
7. User inspects active Change and coding agent.
8. User inspects verification Evidence.
9. User returns to the Requirement without context loss.

**Pass condition:** The professional chain remains visible and navigable throughout.

---

# 69. Critical Acceptance Journey 2 — Failed Verification

1. A required test fails.
2. Verification screen records failure.
3. Affected Requirement and invariant are identified.
4. Implementation PWU shows failed completion condition.
5. Release readiness becomes false.
6. Attention Item is created.
7. User opens failure analysis.
8. Remediation or reconciliation is initiated.

**Pass condition:** The UI never presents the work as complete merely because code exists or a prior build passed.

---

# 70. Critical Acceptance Journey 3 — AI Recommendation

1. Architecture agent proposes a Decision.
2. Decision appears as proposed.
3. Agent identity is visible.
4. Evidence, assumptions, and confidence are inspectable.
5. Reviewer adds contradicting Evidence.
6. Readiness decreases.
7. Authorized approver may defer or request more Evidence.
8. AI recommendation is not treated as approved.

---

# 71. Critical Acceptance Journey 4 — Recomposition Failure

1. All child implementation PWUs complete.
2. Decomposition view shows child completion.
3. Cross-child interface contradiction is detected.
4. Parent completion remains unavailable.
5. Synthesis readiness is false.
6. Reconciliation begins.
7. Parent completes only after successful recomposition.

---

# 72. Critical Acceptance Journey 5 — Production Feedback

1. Release deploys.
2. Deployment succeeds.
3. Production Observation shows unexpected user behavior.
4. Outcome assessment changes.
5. A product assumption is invalidated.
6. Reconciliation identifies affected Journey, Requirement, architecture, and implementation.
7. Follow-on PWUs are created.

---

# 73. Initial Implementation Scope

The first usable UI release SHALL include:

```text
Application Shell
Home
Endeavor Detail
PWU Overview
PWU Understanding
PWU Reasoning
PWU Evidence
PWU Decisions
Decomposition Viewer
Product Realization Map
Implementation Workspace
Agent Execution Panel
Verification Screen
Reconciliation Screen
Coordination Screen
Attention Screen
```

Architecture, Release, and Operations views MAY initially use narrower versions of the full contracts.

---

# 74. Implementation Sequence for the Coding Agent

## Milestone 1 — Shell and Professional Context

Implement:

```text
AppShell
GlobalHeader
GlobalNavigation
CognitiveBreadcrumb
WorkspaceHeader
ContextInspector
ProfessionalCommandBar
state badges
staleness and historical banners
```

## Milestone 2 — PWU Core

Implement:

```text
PWU Overview
Objective and Scope
Dual State
Questions
Uncertainty
Assumptions
Constraints
Dependencies
Completion Readiness
```

## Milestone 3 — Reasoning and Evidence

Implement:

```text
Reasoning Activities
Claims
Evidence
Confidence
Contradictions
AI Attribution
```

## Milestone 4 — Decisions

Implement:

```text
Decision Readiness
Alternatives
Authority
Evidence
Residual Uncertainty
Approval Commands
```

## Milestone 5 — Decomposition and Product Realization

Implement:

```text
Child PWUs
Delegation
Recomposition
Product Realization Map
Traceability Gaps
```

## Milestone 6 — Implementation and Verification

Implement:

```text
Implementation Workspace
Agent Execution
Change Detail
Verification Coverage
Validation Failures
```

## Milestone 7 — Reconciliation and Coordination

Implement:

```text
Reconciliation Detail
RPH Coordination
Tactic Health
Escalation
Synthesis Queue
Attention
```

---

# 75. Coding-Agent Build Rules

The coding agent SHALL:

1. Build from screen contracts, not aesthetic intuition alone.
2. Implement shared semantic components before duplicating screen-specific variants.
3. Treat route loaders as projection consumers.
4. Treat Commands as generated semantic operations.
5. Keep lifecycle and cognitive state separate.
6. Keep drafts separate from authoritative state.
7. preserve route and projection context.
8. expose authority and unavailable-action explanations.
9. preserve AI provenance.
10. implement stale and partial states deliberately.
11. avoid generic task-management language.
12. avoid a chat-first layout.
13. avoid file-tree-first navigation.
14. avoid one universal graph.
15. implement non-graph accessible alternatives.
16. ensure completion readiness is condition-based.
17. preserve parent recomposition state.
18. add semantic acceptance tests for every milestone.
19. record unresolved UX ambiguities as explicit design Decisions.
20. reject UI features that cannot identify the professional cognition they support.

---

# 76. Definition of Done

The initial JanumiCode UI is complete when a user can:

* enter an Endeavor;
* understand its Intent and Outcomes;
* inspect PWUs and their cognitive state;
* inspect uncertainty, assumptions, reasoning, Evidence, and Decisions;
* follow product-realization traceability;
* supervise a coding agent within professional context;
* inspect verification;
* understand why work is blocked or incomplete;
* review decomposition and recomposition;
* initiate reconciliation;
* supervise RPH coordination;
* act on professional Attention Items;
* move among these views without losing context.

The implementation is not complete merely because all routes render.

It is complete when the interface makes the product-realization cognition coherent and operable.
