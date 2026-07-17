# JanumiCode Professional Work Architecture Profile

## JCPWA Specification v0.1.0

**Document ID:** `JAN-JCPWA-001`
**Version:** `0.1.0`
**Status:** Draft
**Extends:** Canonical Professional Cognition Ontology v0.1
**Conforms to:** Janumi Constitution, Professional Cognition Life Cycle, PWU Specification v0.1, RPH Coordination Specification v0.1, Canonical Projection Model v0.1, Reference Interaction and Workspace Specification v0.1, Janumi Execution Model v0.1
**Runtime target:** Janumi Single-Node Runtime Profile v0.1
**Primary audiences:** JanumiCode architects, coding agents, product managers, systems engineers, software engineers, UX designers, security reviewers, test engineers, DevOps engineers, platform developers

---

# 1. Purpose

The JanumiCode Professional Work Architecture, or JCPWA, specializes Janumi’s domain-independent professional cognition model for software product realization.

JanumiCode governs the full progression from underspecified product intent through:

* discovery;
* requirements;
* user experience;
* architecture;
* implementation;
* verification;
* release;
* operation;
* learning;
* reconciliation.

JanumiCode is not merely a coding-agent interface.

It is a professional cognitive environment for coordinating the complete reasoning system required to realize and sustain software products.

Its purpose is to preserve coherence across:

```text
Intent
Requirements
User Journeys
Domain Models
Architecture
Data
Security
Implementation
Tests
Deployment
Operations
Observed Behavior
Product Outcomes
```

---

# 2. Product-Realization Thesis

Software-product failure frequently does not originate in code generation.

It originates in loss of coherence among:

* stakeholder intent;
* product assumptions;
* user needs;
* requirements;
* architecture;
* implementation;
* test coverage;
* operational conditions;
* business outcomes.

JanumiCode exists to make those relationships explicit, computable, inspectable, and continuously reconcilable.

The coding agent is one Participant within this system.

It SHALL not become the system’s organizing model.

---

# 3. Scope

JCPWA v0.1 covers:

* greenfield product realization;
* brownfield feature development;
* architecture evolution;
* defect remediation;
* technical-debt reduction;
* security and compliance changes;
* release preparation;
* production incidents;
* operational learning;
* cross-functional product Decisions.

It supports:

* solo developers;
* small software teams;
* cross-functional product organizations;
* enterprise product programs;
* AI-assisted and AI-executed development.

---

# 4. Non-Goals

JCPWA v0.1 does not define:

* a universal software-development methodology;
* one mandatory programming language;
* one repository provider;
* one cloud platform;
* one CI/CD system;
* one architecture style;
* one testing framework;
* fully autonomous production deployment;
* replacement of accountable human authority;
* automatic correctness from generated documentation.

It defines the semantic and operational structure within which methods and technologies are selected and governed.

---

# 5. Canonical Product-Realization Outcome

The primary JanumiCode Outcome is:

> A software-enabled capability that produces intended user and organizational value, behaves acceptably within its operating environment, satisfies applicable constraints, and remains continuously reconcilable with changing intent and observed reality.

This Outcome is broader than:

* generated source code;
* a merged pull request;
* a successful build;
* a deployed service;
* completed tickets.

Those are intermediate Artifacts, Actions, or Observations.

---

# 6. Product-Realization Cognitive Loop

JanumiCode specializes the Professional Cognition Life Cycle as follows:

```text
Product Intent
    ↓
Problem and User Understanding
    ↓
Requirements and Experience Representation
    ↓
Architecture and Design Reasoning
    ↓
Product and Engineering Decisions
    ↓
Implementation and Delivery Actions
    ↓
Verification and Operational Observation
    ↓
Product and Technical Reconciliation
    ↺
```

This loop is recursive.

Any requirement, design choice, implementation result, test failure, user observation, production incident, or business change may reopen prior reasoning.

---

# 7. JanumiCode Endeavor Types

Canonical product-realization Endeavor types include:

```text
new_product
new_capability
major_feature
minor_feature
architecture_change
platform_migration
security_remediation
compliance_change
defect_remediation
performance_improvement
technical_debt_reduction
production_incident
operational_improvement
research_spike
product_discovery
release
```

A software product may contain multiple concurrent Endeavors.

---

# 8. JanumiCode Stakeholders

Canonical Stakeholder categories include:

```text
end_user
buyer
customer_administrator
product_owner
business_sponsor
operator
support_team
developer
security_team
legal_team
compliance_team
sales_team
implementation_partner
external_integrator
regulator
affected_non_user
```

Stakeholder impact SHALL remain distinguishable from implementation participation.

---

# 9. JanumiCode Participant Roles

JCPWA defines the following canonical professional roles.

```text
product_sponsor
product_manager
business_analyst
user_researcher
ux_designer
systems_engineer
solution_architect
software_architect
data_architect
security_architect
privacy_reviewer
legal_reviewer
software_engineer
coding_agent
test_engineer
verification_agent
devops_engineer
site_reliability_engineer
release_manager
operations_analyst
incident_commander
technical_writer
professional_validator
rph_coordinator
```

One human or AI Participant may occupy multiple roles where governance permits.

Role conflict policies MAY require separation among:

* author;
* implementer;
* reviewer;
* validator;
* approver;
* production deployer.

---

# 10. AI Participant Classes

Canonical JanumiCode AI Participant classes include:

```text
intent_formalization_agent
requirements_agent
user_journey_agent
research_agent
domain_model_agent
architecture_agent
security_agent
data_model_agent
planning_agent
coding_agent
code_review_agent
test_design_agent
test_execution_agent
verification_agent
documentation_agent
release_agent
operations_analysis_agent
reconciliation_agent
assumption_surfacing_agent
invariant_generation_agent
```

Agent classes describe professional responsibility, not necessarily separate language models or deployed processes.

One agent runtime MAY instantiate several roles.

---

# 11. Product-Realization Intent Model

JanumiCode Intent SHALL capture more than a feature statement.

A material product Intent SHOULD include:

```text
desiredUserChange
desiredOrganizationalChange
businessRationale
targetUsers
targetOperatingContext
successInterpretation
nonGoals
criticalConstraints
riskTolerance
timeHorizon
```

## 11.1 Example

Weak Intent:

```text
Build a field-service management application.
```

Stronger Intent:

```text
Enable small trade-service businesses to coordinate customer intake,
estimation, scheduling, field execution, invoicing, and follow-up with
less administrative effort and fewer missed commitments, while preserving
a simple experience appropriate for owners and field technicians.
```

## 11.2 Intent Ambiguity

Where Intent remains materially ambiguous, JanumiCode SHALL:

* surface ambiguity;
* create Questions;
* establish provisional assumptions;
* request clarification;
* or define an explicitly exploratory Endeavor.

The coding agent SHALL not silently choose a product direction.

---

# 12. JanumiCode Representation Types

JCPWA specializes `Representation` into the following categories.

## 12.1 Product Representations

```text
product_brief
problem_statement
value_proposition
persona
stakeholder_map
user_journey
service_blueprint
use_case
story_map
product_requirement
business_rule
acceptance_criterion
success_metric
roadmap
release_scope
```

## 12.2 Systems-Engineering Representations

```text
system_context
capability_model
functional_decomposition
logical_architecture
physical_architecture
interface_definition
state_model
sequence_model
constraint_model
risk_model
traceability_model
verification_plan
validation_plan
```

## 12.3 Software-Architecture Representations

```text
architecture_decision_record
component_model
deployment_model
integration_model
security_architecture
identity_architecture
authorization_model
data_flow_model
resilience_model
observability_model
performance_model
```

## 12.4 Data Representations

```text
conceptual_data_model
logical_data_model
physical_data_model
event_schema
api_schema
data_contract
retention_policy
classification_model
migration_plan
```

## 12.5 Implementation Representations

```text
source_code
configuration
infrastructure_code
database_migration
build_definition
deployment_manifest
feature_flag
automation_script
```

## 12.6 Verification Representations

```text
test_strategy
test_case
test_fixture
unit_test
integration_test
contract_test
system_test
performance_test
security_test
accessibility_test
compliance_test
test_result
coverage_model
verification_report
```

## 12.7 Operational Representations

```text
runbook
dashboard_definition
alert_definition
service_level_objective
incident_record
post_incident_review
operational_baseline
capacity_model
recovery_plan
```

---

# 13. Artifact and Representation Distinction

JCPWA SHALL preserve the distinction between software Artifacts and their professional meaning.

Examples:

```text
Git commit                     → Artifact
Source code expressed by it    → Representation

OpenAPI YAML file              → Artifact
API contract expressed by it   → Representation

PNG architecture diagram       → Artifact
Architecture model expressed   → Representation

CI test report file            → Artifact
Verification Evidence          → Evidence and Representation
```

The same Representation may be embodied in multiple Artifacts.

---

# 14. JanumiCode PWU Types

Canonical PWU types include:

## 14.1 Discovery and Framing

```text
product_intent_formalization
problem_discovery
stakeholder_analysis
user_research
market_research
scope_definition
assumption_analysis
constraint_analysis
```

## 14.2 Product Definition

```text
persona_definition
user_journey_generation
use_case_definition
requirements_generation
requirements_refinement
acceptance_criteria_definition
business_rule_definition
success_metric_definition
```

## 14.3 Architecture and Design

```text
system_context_design
domain_model_design
architecture_design
interface_design
data_model_design
security_design
privacy_design
ux_design
observability_design
deployment_design
migration_design
```

## 14.4 Planning

```text
implementation_planning
release_planning
verification_planning
dependency_planning
technical_risk_planning
```

## 14.5 Implementation

```text
implementation_slice
integration_implementation
database_change
infrastructure_change
ui_implementation
api_implementation
automation_implementation
refactoring
```

## 14.6 Verification and Validation

```text
unit_verification
integration_verification
system_verification
security_verification
performance_verification
accessibility_validation
user_validation
release_validation
compliance_validation
```

## 14.7 Release and Operation

```text
release_preparation
deployment
production_observation
incident_response
defect_analysis
operational_reconciliation
post_incident_learning
```

## 14.8 Governance

```text
architecture_review
security_review
legal_review
privacy_review
compliance_review
release_approval
technical_debt_review
```

---

# 15. Product-Realization Lifecycle

A software-product Endeavor SHALL not be represented as one rigid linear workflow.

JanumiCode instead recognizes a set of recursively traversed professional regions:

```text
framing
discovery
definition
architecture
planning
implementation
verification
release
operation
reconciliation
```

An Endeavor may have active PWUs in several regions simultaneously.

## 15.1 Region Semantics

### Framing

Establish Intent, Outcome, scope, Stakeholders, Constraints, and initial uncertainty.

### Discovery

Investigate users, domain, existing systems, risks, and operating context.

### Definition

Produce sufficiently precise product and system requirements.

### Architecture

Select structural approaches and preserve rationale.

### Planning

Define professionally meaningful decomposition, dependencies, validation, and release strategy.

### Implementation

Transform approved Representations into executable software and infrastructure.

### Verification

Determine whether implementation satisfies specified technical obligations.

### Release

Authorize and execute controlled introduction into an operating environment.

### Operation

Observe real behavior, user impact, reliability, cost, and security.

### Reconciliation

Update professional understanding and dependent Representations when reality or Intent changes.

---

# 16. Canonical Root PWU Structure

A substantial product-realization Endeavor SHOULD initially decompose into root PWUs such as:

```text
Product Realization Root PWU
├── Intent and Outcome PWU
├── User and Domain Understanding PWU
├── Requirements PWU
├── Experience Design PWU
├── System Architecture PWU
├── Data Architecture PWU
├── Security and Privacy PWU
├── Implementation Planning PWU
├── Implementation PWUs
├── Verification PWU
├── Release PWU
└── Operational Learning PWU
```

This is a reference structure, not a mandatory fixed template.

The RPH may add, remove, or restructure PWUs according to the Endeavor.

---

# 17. Decomposition Rules

JanumiCode decomposition SHALL follow professional boundaries rather than arbitrary task size.

## 17.1 Valid Decomposition Dimensions

```text
user_outcome
business_capability
domain_boundary
system_capability
architecture_component
end_to_end_slice
risk_area
professional_discipline
independent_decision
independent_validation
integration_boundary
operational_boundary
```

## 17.2 Preferred Implementation Decomposition

Implementation SHOULD usually decompose into vertical or behaviorally complete slices where practical.

A valid implementation slice should connect:

```text
Intent
→ Requirement
→ Architecture
→ Code
→ Test
→ Observable Behavior
```

## 17.3 Invalid Decomposition

Avoid creating PWUs solely such as:

```text
Create database files
Create API files
Create frontend files
Add tests later
```

unless those boundaries are independently meaningful and recomposition obligations are explicit.

## 17.4 Cross-Functional PWUs

A PWU MAY span product, UX, architecture, implementation, and verification when that is the smallest professionally coherent unit.

---

# 18. Recomposition Rules

Parent recomposition SHALL verify more than child completion.

For product realization, recomposition SHOULD evaluate:

```text
crossRequirementConsistency
architectureCompatibility
interfaceAlignment
dataConsistency
securityConsistency
userJourneyContinuity
testCoverage
operationalReadiness
releaseCoherence
intentAlignment
```

## 18.1 Recomposition Outputs

Potential outputs include:

* integrated system Representation;
* cross-child contradiction set;
* integrated confidence assessment;
* release-readiness assessment;
* updated architecture Decision;
* follow-on remediation PWUs;
* accepted residual technical risk.

---

# 19. Requirements Model

A JanumiCode Requirement is a specialized Representation that defines an obligation the product or delivery system is expected to satisfy.

## 19.1 Requirement Categories

```text
business
user
functional
quality_attribute
interface
data
security
privacy
compliance
operational
deployment
supportability
migration
constraint
```

## 19.2 Required Properties

```text
requirementId
statement
requirementType
rationale
originatingIntentIds
stakeholderIds
priority
verificationMethod
acceptanceCriteria
status
```

## 19.3 Requirement Quality

A Requirement SHOULD be:

* necessary;
* unambiguous within its context;
* feasible;
* verifiable;
* traceable;
* sufficiently scoped;
* non-duplicative;
* internally consistent.

## 19.4 Requirement Status

```text
proposed
analyzing
accepted
rejected
deferred
implemented
verified
validated
superseded
withdrawn
```

Implementation and verification SHALL remain separate statuses.

---

# 20. Requirement Invariants

## JCODE-REQ-INV-001 — Intent Traceability

Every accepted Requirement SHALL trace to Intent or an authorized external obligation.

## JCODE-REQ-INV-002 — Verification Method

Every material accepted Requirement SHALL identify a verification or validation method.

## JCODE-REQ-INV-003 — No Implementation Disguised as Need

A Requirement SHALL distinguish required behavior from prematurely selected implementation unless the implementation itself is constrained.

## JCODE-REQ-INV-004 — Explicit Quality Attributes

Material quality expectations SHALL not remain only as vague adjectives.

Terms such as:

```text
fast
secure
scalable
easy
reliable
intuitive
```

require interpretation or measurable criteria.

## JCODE-REQ-INV-005 — Conflict Visibility

Conflicting Requirements SHALL remain visible until reconciled or explicitly accepted as a trade-off.

---

# 21. User Journey Model

A User Journey is a Representation of how a Stakeholder seeks an outcome across interactions and operational context.

## 21.1 Required Properties

```text
journeyId
personaOrStakeholder
desiredOutcome
entryConditions
stages
touchpoints
decisions
painPoints
failurePaths
recoveryPaths
supportingCapabilities
successSignals
```

## 21.2 Journey Stage

Each stage SHOULD identify:

```text
userGoal
userAction
systemResponse
informationNeeded
uncertainty
emotionalOrOperationalCondition
failurePossibility
evidenceOfSuccess
```

## 21.3 Journey Invariant

A Journey SHALL not be treated as a decorative narrative.

It SHALL trace to:

* Requirements;
* capabilities;
* UX Representations;
* verification;
* operational Observation.

---

# 22. Domain Model

The domain model expresses the core concepts, responsibilities, rules, and relationships of the software-enabled domain.

## 22.1 Domain Model Components

```text
bounded_context
domain_entity
value_object
aggregate
domain_service
domain_event
policy
invariant
business_rule
state_transition
```

## 22.2 Distinction from CPCO Aggregate

A software-domain Aggregate is a Representation within JanumiCode.

It SHALL not be confused with a Janumi transactional Aggregate such as the PWU Aggregate.

## 22.3 Domain Model Validation

The domain model SHOULD be reviewed against:

* Requirements;
* User Journeys;
* business rules;
* data obligations;
* integration boundaries;
* lifecycle behavior.

---

# 23. Architecture Model

JanumiCode Architecture is a set of Representations and Decisions explaining how the intended software capability is structured and operated.

## 23.1 Architecture Concerns

```text
system_context
responsibility_allocation
component_boundaries
data_ownership
integration
security
resilience
performance
deployment
observability
operability
evolution
cost
```

## 23.2 Architecture Decision

Every material architecture Decision SHOULD identify:

```text
decisionQuestion
context
alternatives
criteria
selectedAlternative
supportingEvidence
assumptions
constraints
tradeoffs
risks
consequences
revisitTriggers
```

## 23.3 Architecture Invariant

The current implementation SHALL remain traceable to current architecture Decisions or explicitly identified divergence.

---

# 24. Architecture Drift

Architecture drift occurs when implementation or operation no longer conforms to current Architecture Representations.

## 24.1 Drift Sources

```text
unreviewed_code_change
emergency_remediation
dependency_behavior
configuration_change
infrastructure_change
performance_optimization
team_workaround
obsolete_documentation
```

## 24.2 Drift Disposition

Detected drift SHALL produce one of:

```text
implementation_correction
architecture_revision
authorized_exception
temporary_incoherence
reconciliation
```

The platform SHALL not assume that the document is correct and the code is wrong, or vice versa.

Both are Representations requiring reconciliation with Intent and observed reality.

---

# 25. Data Model

JanumiCode SHALL distinguish:

```text
conceptual_data_model
logical_data_model
physical_data_model
runtime_data_state
```

## 25.1 Data Obligations

Material data entities SHOULD identify:

* ownership;
* source of truth;
* classification;
* retention;
* integrity constraints;
* access rules;
* lifecycle;
* migration strategy;
* downstream consumers.

## 25.2 Data Invariant

A schema change SHALL trace to:

* Requirement;
* Architecture Decision;
* defect;
* migration need;
* or authorized operational change.

---

# 26. Interface Model

Interfaces include:

* APIs;
* events;
* files;
* messages;
* user interfaces;
* database contracts;
* external integrations.

## 26.1 Interface Definition

A material interface SHOULD identify:

```text
provider
consumer
purpose
contract
version
authority
security
error_semantics
compatibility
observability
```

## 26.2 Compatibility

Breaking changes SHALL require:

* affected-consumer analysis;
* version strategy;
* migration plan;
* validation;
* authorized Decision.

---

# 27. Security and Privacy Model

Security and privacy SHALL be integrated into product realization rather than treated as terminal reviews.

## 27.1 Security Representations

```text
threat_model
trust_boundary
identity_model
authorization_model
data_classification
security_requirement
security_control
abuse_case
security_test
incident_response_plan
```

## 27.2 Security Questions

JanumiCode SHOULD continuously ask:

* What is being protected?
* From whom?
* Under which trust assumptions?
* Which identity establishes authority?
* What happens when a control fails?
* How will misuse be detected?
* How will the organization respond?

## 27.3 Privacy Questions

* Which personal information is collected?
* Why is it necessary?
* Where is it processed?
* Who can access it?
* How long is it retained?
* Which rights or obligations apply?
* Can the outcome be achieved with less data?

---

# 28. Invariant Generation

JanumiCode SHALL include an explicit invariant-generation capability.

Invariants are properties that must remain true across:

* requirements;
* domain state;
* architecture;
* data;
* security;
* execution;
* operations.

## 28.1 Invariant Sources

Invariants may derive from:

```text
Intent
business_rules
Requirements
domain_model
architecture
security_policy
legal_obligation
data_integrity
operational_safety
user_expectation
```

## 28.2 Invariant Categories

```text
domain
data
security
privacy
architectural
workflow
authorization
temporal
resource
operational
product
```

## 28.3 Example

```text
A tenant user shall never read or modify another tenant’s protected data.
```

This invariant may derive:

* Requirements;
* authorization model;
* database policy;
* tests;
* runtime telemetry;
* reconciliation triggers.

## 28.4 Invariant Lifecycle

```text
proposed
analyzing
accepted
implemented
verified
observed
violated
superseded
```

---

# 29. Invariant Enforcement

An accepted invariant SHOULD map to one or more enforcement mechanisms.

```text
static_analysis
type_system
schema_constraint
authorization_policy
runtime_guard
test
formal_model
monitor
alert
manual_review
audit
```

## 29.1 Enforcement Coverage

The platform SHOULD expose whether an invariant is:

```text
specified
implemented
verified
operationally_observed
```

These states SHALL remain distinct.

## 29.2 Invariant Violation

A detected violation SHALL:

* create an Issue or Observation;
* identify affected Intent and Outcomes;
* trigger remediation or reconciliation;
* preserve Evidence;
* assess prior Decisions and assumptions.

---

# 30. Implementation Plan

The Implementation Plan SHALL decompose approved professional understanding into executable work without severing traceability.

## 30.1 Plan Components

```text
implementation_slices
dependencies
affected_representations
repository_locations
required_decisions
required_validations
migration_steps
rollout_strategy
rollback_strategy
observability_changes
```

## 30.2 Plan Quality

An implementation plan SHOULD be:

* outcome-aligned;
* vertically coherent;
* dependency-aware;
* verifiable;
* operationally complete;
* minimal without being incomplete.

## 30.3 Speculative Work

Speculative abstractions SHALL require an explicit rationale.

A coding agent SHALL default to the narrowest implementation satisfying current approved understanding.

---

# 31. Coding-Agent Contract

Every coding-agent execution SHALL receive an explicit contract.

## 31.1 Required Context

```text
professionalObjective
originatingIntent
scope
nonGoals
Requirements
userJourneys
architectureDecisions
domainModel
dataModel
invariants
constraints
repositoryContext
codingStandards
requiredValidations
completionConditions
escalationConditions
```

## 31.2 Required Outputs

```text
codeChanges
configurationChanges
migrationChanges
testChanges
documentationChanges
assumptionsIntroduced
deviations
unresolvedQuestions
validationResults
affectedRepresentations
recommendedReconciliation
provenance
```

## 31.3 Coding-Agent Prohibitions

The coding agent SHALL NOT:

* replace product Intent;
* broaden scope silently;
* invent missing approval;
* treat passing compilation as completion;
* skip required tests;
* modify unrelated architecture without disclosure;
* suppress failing tests;
* remove constraints to achieve success;
* claim deployment or outcome success without Evidence;
* introduce speculative frameworks without justification;
* silently change public contracts;
* attribute AI work to a human.

---

# 32. Coding-Agent Operating Modes

Canonical modes include:

```text
analyze
plan
implement
debug
refactor
review
verify
reconcile
explain
```

The selected mode SHALL constrain permissible actions.

## 32.1 Analyze

May inspect and propose.

Shall not modify authoritative repository state unless explicitly authorized.

## 32.2 Plan

Produces an Implementation Plan and child PWU proposal.

## 32.3 Implement

May modify approved scope and produce implementation Artifacts.

## 32.4 Debug

Investigates a defect hypothesis and produces Evidence, Claims, and corrective proposals.

## 32.5 Refactor

Changes structure while preserving declared behavior and invariants.

## 32.6 Review

Evaluates but does not approve unless separately authorized.

## 32.7 Verify

Executes or analyzes verification methods.

## 32.8 Reconcile

Assesses divergence among Requirements, architecture, code, tests, and operation.

---

# 33. Repository Model

A repository is an external professional system containing software Artifacts and history.

## 33.1 Repository Context

```text
repositoryId
provider
url
defaultBranch
branchPolicy
protectedPaths
codeOwners
buildSystem
testCommands
deploymentRelationship
```

## 33.2 Worktree Isolation

Agent implementation SHOULD occur within:

* a dedicated branch;
* worktree;
* ephemeral clone;
* or sandboxed workspace.

## 33.3 Repository Authority

Repository write access SHALL be scoped to the assigned PWU and policy.

## 33.4 Commit Provenance

A commit created by Janumi SHOULD reference:

```text
pwuId
agentExecutionId
intentId
decisionIds
validationSummary
```

where policy permits.

---

# 34. Change Model

A software Change is a structured set of Artifact modifications associated with a professional purpose.

## 34.1 Change Properties

```text
changeId
pwuId
objective
affectedArtifacts
affectedRepresentations
implementationRationale
assumptions
risk
validationPlan
rollbackPlan
status
```

## 34.2 Change Status

```text
proposed
in_progress
ready_for_review
changes_requested
approved
merged
deployed
observed
reconciled
reverted
```

These states SHALL not be collapsed into PWU lifecycle state.

---

# 35. Code Review Model

Code review is a professional Validation activity.

## 35.1 Review Dimensions

```text
intent_alignment
scope_compliance
correctness
architecture_conformance
security
maintainability
test_adequacy
observability
operability
migration_safety
```

## 35.2 Review Outcome

```text
approve
approve_with_conditions
request_changes
inconclusive
escalate
```

## 35.3 AI Code Review

AI review SHALL remain attributable and SHALL not satisfy independent human review requirements unless policy explicitly permits it.

---

# 36. Verification Model

Verification determines whether software Representations and Actions satisfy specified obligations.

## 36.1 Verification Levels

```text
static
unit
component
integration
contract
system
performance
security
resilience
deployment
operational
```

## 36.2 Verification Trace

Each material Requirement SHOULD trace to:

```text
verificationMethod
testOrAnalysis
result
Evidence
status
```

## 36.3 Verification Status

```text
not_planned
planned
implemented
executed
passed
failed
inconclusive
waived
obsolete
```

## 36.4 Waiver

A waived verification obligation SHALL record:

* authority;
* rationale;
* risk;
* expiration or review condition;
* affected release;
* compensating control.

---

# 37. Validation Model

Validation determines whether the realized product serves intended users and Outcomes.

Validation may include:

* user evaluation;
* usability study;
* pilot operation;
* business metric evaluation;
* acceptance review;
* operational feedback.

Passing all tests does not imply product validation.

---

# 38. Test Strategy

Every substantial Endeavor SHOULD establish a Test Strategy.

## 38.1 Strategy Components

```text
riskModel
testLevels
coverageObjectives
environmentStrategy
dataStrategy
automationStrategy
nonfunctionalTesting
securityTesting
releaseGates
productionValidation
```

## 38.2 Test Value

Test volume SHALL not be treated as equivalent to verification quality.

The strategy SHOULD prioritize tests according to:

* Outcome impact;
* invariant criticality;
* failure likelihood;
* change frequency;
* recovery difficulty.

---

# 39. Traceability Model

JanumiCode SHALL support trace paths such as:

```text
Intent
→ Outcome
→ User Journey
→ Requirement
→ Architecture Decision
→ Implementation Change
→ Test
→ Deployment
→ Observation
→ Reconciliation
```

Not every entity requires a direct relationship to every other entity.

The path SHALL remain reconstructable.

## 39.1 Traceability Gap

Missing required trace relationships SHALL be visible as a validation or coherence issue.

---

# 40. CI/CD Integration

CI/CD systems are external execution and Observation systems.

## 40.1 CI Inputs

Janumi may provide:

* source revision;
* build configuration;
* test plan;
* required gates;
* invariant checks;
* deployment target.

## 40.2 CI Outputs

CI results SHALL be normalized into:

* Actions;
* Artifacts;
* Observations;
* Evidence;
* Validations.

## 40.3 Build Success

Build success SHALL not automatically complete the PWU.

## 40.4 Test Failure

A test failure SHALL retain:

* test identity;
* affected Requirement or invariant;
* environment;
* failure output;
* reproducibility;
* responsible Change;
* resulting attention or reconciliation.

---

# 41. Release Model

A Release is a governed introduction of a selected product state into an operating environment.

## 41.1 Release Properties

```text
releaseId
scope
includedChanges
excludedChanges
targetEnvironment
releaseStrategy
validationStatus
knownRisks
rollbackPlan
approvals
status
```

## 41.2 Release Status

```text
planning
candidate
awaiting_validation
awaiting_approval
approved
deploying
deployed
observing
accepted
failed
rolled_back
reconciled
```

## 41.3 Release Readiness

Release readiness SHOULD evaluate:

```text
scopeCoherence
requiredVerification
securityReview
migrationReadiness
operationalReadiness
observabilityReadiness
supportReadiness
knownRiskAcceptance
rollbackReadiness
```

---

# 42. Deployment Model

Deployment is an Action that changes an operating environment.

It SHALL identify:

* authorizing Release Decision;
* target environment;
* implementation revision;
* configuration revision;
* migration revision;
* executor;
* expected observations;
* rollback conditions.

Deployment completion and Release acceptance SHALL remain distinct.

---

# 43. Operational Observation

Operational systems SHALL provide Observations relevant to:

```text
availability
latency
errorRate
security
resourceUse
userBehavior
businessOutcome
cost
supportDemand
dataQuality
```

## 43.1 Observation Context

Operational telemetry SHALL remain traceable, where practical, to:

* release;
* Change;
* PWU;
* Requirement;
* architecture Decision;
* Outcome.

## 43.2 Monitoring Gap

A material Requirement or invariant lacking operational Observation may create an observability-design gap.

---

# 44. Production Incident Model

A production incident is a PWU centered on an adverse operating condition.

## 44.1 Incident PWU Components

```text
observedCondition
affectedUsers
affectedOutcomes
severity
currentImpact
containmentActions
workingClaims
Evidence
timeline
decisions
remediation
verification
reconciliation
```

## 44.2 Incident Phases

```text
detect
triage
contain
diagnose
remediate
recover
verify
learn
reconcile
```

## 44.3 Incident Prohibition

The incident SHALL not close merely because service is restored.

Closure SHOULD include:

* recovery validated;
* residual risk recorded;
* root or contributing Claims assessed;
* follow-on work created;
* affected Representations reconciled.

---

# 45. Defect Model

A Defect is a Claim that observed software behavior conflicts with expected or required behavior.

## 45.1 Defect Evidence

A Defect SHOULD include:

```text
expectedBehavior
observedBehavior
reproduction
environment
severity
affectedRequirement
affectedOutcome
Evidence
```

## 45.2 Defect Status

```text
reported
triaging
confirmed
not_reproducible
working_as_designed
accepted
in_remediation
fixed
verified
closed
reopened
```

`working_as_designed` may still reveal an invalid Requirement or design Decision and may therefore trigger reconciliation.

---

# 46. Technical Debt Model

Technical debt is a recognized future burden arising from a technical compromise, incomplete work, or accumulated divergence.

## 46.1 Required Properties

```text
debtId
description
origin
rationale
affectedAreas
currentCost
futureRisk
interestSignals
repaymentOptions
status
```

## 46.2 Technical Debt Is Not a Generic Defect

Debt SHALL identify the professional trade-off that produced it where known.

## 46.3 Debt Signals

Potential signals include:

* repeated Change difficulty;
* recurring incidents;
* excessive validation cost;
* architecture drift;
* obsolete dependency;
* unsupported invariant;
* high coordination overhead.

---

# 47. Dependency Model

Software dependencies include:

```text
library
service
database
external_api
platform
runtime
build_tool
organization
team
decision
Requirement
Evidence
```

## 47.1 External Software Dependency

A material dependency SHOULD identify:

* version;
* source;
* license;
* security posture;
* support status;
* compatibility;
* replacement strategy;
* affected capabilities.

## 47.2 Dependency Change

A dependency update SHALL be treated as professional work when it may affect behavior, risk, architecture, or compliance.

---

# 48. Assumption Model

Common JanumiCode Assumption categories include:

```text
user_behavior
market
technical_feasibility
dependency_behavior
performance
security
operational
team_capability
cost
schedule
regulatory
integration
data_quality
```

## 48.1 Assumption Surfacing

JanumiCode SHALL support a dedicated assumption-surfacing role or Validator.

It SHOULD identify assumptions embedded within:

* Intent;
* Requirements;
* architecture;
* plans;
* generated code;
* test strategy;
* deployment;
* operational interpretation.

## 48.2 Assumption Failure

Invalidation of a critical Assumption SHALL trigger impact analysis and potentially:

* reopen Requirement;
* reopen Decision;
* reopen PWU;
* revise architecture;
* create remediation;
* initiate reconciliation.

---

# 49. Risk Model

Canonical software-product Risk categories include:

```text
product
user_adoption
technical
architecture
security
privacy
compliance
delivery
integration
operational
performance
availability
cost
vendor
data
organizational
```

Risk SHALL link to affected Outcomes and mitigation work.

---

# 50. Product-Specific Validators

JCPWA defines the following initial Validator classes.

## 50.1 Intent Validators

```text
ProductIntentClarityValidator
OutcomeOrientationValidator
ScopeBoundaryValidator
NonGoalValidator
StakeholderCoverageValidator
```

## 50.2 User and Requirement Validators

```text
JourneyCompletenessValidator
RequirementNecessityValidator
RequirementAmbiguityValidator
RequirementVerifiabilityValidator
RequirementConflictValidator
AcceptanceCriteriaValidator
TraceabilityValidator
```

## 50.3 Architecture Validators

```text
ArchitectureIntentAlignmentValidator
ResponsibilityAllocationValidator
BoundaryConsistencyValidator
DataOwnershipValidator
InterfaceCompletenessValidator
SecurityArchitectureValidator
OperationalArchitectureValidator
ArchitectureDriftValidator
```

## 50.4 Implementation Validators

```text
ScopeComplianceValidator
DesignConformanceValidator
InvariantImplementationValidator
BoundaryValidationValidator
ErrorHandlingValidator
ObservabilityValidator
MigrationSafetyValidator
DependencyPolicyValidator
```

## 50.5 Verification Validators

```text
RequirementCoverageValidator
InvariantCoverageValidator
RiskCoverageValidator
TestResultValidator
IndependentReviewValidator
ReleaseGateValidator
```

## 50.6 Operational Validators

```text
DeploymentValidationValidator
OperationalReadinessValidator
TelemetryCoverageValidator
OutcomeObservationValidator
RecoveryReadinessValidator
IncidentClosureValidator
```

---

# 51. Professional Wisdom Validators

JanumiCode SHOULD encode accumulated engineering wisdom as explicit Validators.

Examples:

```text
GallLawValidator
LeakyAbstractionRiskValidator
HyrumLawRiskValidator
SecondSystemEffectValidator
PrematureAbstractionValidator
DistributedSystemFallacyValidator
ConwayAlignmentValidator
FailureModeCoverageValidator
ChangeAmplificationValidator
```

These SHALL not be treated as simplistic pass/fail rules where professional interpretation is required.

They may return:

```text
pass
warning
risk_detected
not_applicable
inconclusive
```

with rationale and Evidence.

---

# 52. Development Contracts

JanumiCode SHALL incorporate the following development contracts.

## 52.1 Intent Contract

Preserve user and system Intent.

Do not substitute an easier or preferred objective.

## 52.2 Scope Contract

Implement the narrowest complete solution satisfying the authorized scope.

Avoid speculative features and abstractions.

## 52.3 Design Contract

Use designs that preserve clarity, composability, testability, and responsibility boundaries.

## 52.4 Boundary Contract

Treat all external, user, model, database, API, and tool outputs as untrusted.

Parse, normalize, validate, and canonicalize them.

## 52.5 State Contract

Model state explicitly.

Do not infer semantic state from null, empty, missing, or undefined values.

## 52.6 Observability Contract

Create traces, logs, and metrics at decision boundaries, external boundaries, state transitions, validation failures, retries, and downstream blocking.

## 52.7 Error Contract

Use typed and classified failures.

Do not swallow or replace errors with ambiguous success.

---

# 53. JanumiCode UI Specialization

JanumiCode specializes the Reference Interaction and Workspace model.

## 53.1 Global Navigation

Recommended destinations:

```text
Product Outcomes
Endeavors
Work Architecture
Requirements
Architecture
Implementation
Verification
Releases
Operations
Decisions
Evidence
Reconciliation
Coordination
```

These remain projections over one cognitive model.

They SHALL not become independent semantic modules.

## 53.2 Product-Realization Breadcrumb

Example:

```text
Organization
› JanumiCode
› Field Service Product
› Scheduling Capability
› Architecture PWU
› Decision: Scheduling Consistency Model
```

---

# 54. Product Outcome Workspace

The Product Outcome Workspace SHOULD show:

* intended user and business change;
* active success metrics;
* supporting capabilities;
* active Endeavors;
* current confidence;
* unresolved product assumptions;
* production observations;
* variance from intended Outcome.

---

# 55. Product Realization Map

The Product Realization Map is a canonical JanumiCode projection connecting:

```text
Intent
→ Outcome
→ Journey
→ Requirement
→ Architecture
→ Implementation
→ Verification
→ Release
→ Observation
```

## 55.1 Purpose

It allows users to inspect whether the product realization chain remains coherent.

## 55.2 Gap Indicators

The map SHOULD identify:

* Requirement without Intent;
* Requirement without verification;
* code without approved professional origin;
* architecture Decision without implementation;
* implementation without tests;
* test without Requirement or invariant;
* deployed Change without Observation;
* observed failure without reconciliation.

---

# 56. Decomposition Viewer Specialization

The JanumiCode Decomposition Viewer SHOULD support multiple synchronized structures.

## 56.1 Professional Decomposition

```text
Outcome
Capability
PWU
Child PWU
```

## 56.2 System Decomposition

```text
System
Subsystem
Component
Interface
```

## 56.3 Implementation Decomposition

```text
Repository
Package
Module
File
Symbol
```

## 56.4 Traceability Rule

These decompositions SHALL remain related but SHALL not be collapsed into one hierarchy.

A source-code folder structure is not the Professional Work Architecture.

---

# 57. Requirements Workspace

The Requirements Workspace SHALL support:

* Requirement hierarchy and relationships;
* Intent trace;
* User Journey trace;
* ambiguity and conflict;
* acceptance criteria;
* verification planning;
* status;
* implementation and test coverage;
* change impact.

It SHOULD emphasize semantic quality over bulk requirement generation.

---

# 58. Architecture Workspace

The Architecture Workspace SHOULD provide synchronized projections for:

```text
Context
Capabilities
Domain Model
Components
Interfaces
Data
Security
Deployment
Decisions
Risks
Invariants
Drift
```

## 58.1 Architecture Decision Interaction

Users SHALL be able to move from:

```text
Architecture element
→ governing Decision
→ Alternatives
→ Evidence
→ Requirement
→ implementation
→ Observation
```

---

# 59. Implementation Workspace

The Implementation Workspace SHALL remain PWU-centered.

It SHOULD display:

* current objective;
* approved scope;
* affected Requirements;
* architecture Decisions;
* invariants;
* repository context;
* active Agent Execution;
* code changes;
* tests;
* validations;
* unresolved questions;
* completion readiness.

The file editor is embedded within this professional context.

---

# 60. Verification Workspace

The Verification Workspace SHOULD provide:

```text
Requirement-to-Test Matrix
Invariant Coverage
Risk-Based Coverage
Test Execution
Failure Analysis
Evidence
Waivers
Release Gates
```

A raw test-count dashboard is insufficient.

---

# 61. Release Workspace

The Release Workspace SHOULD integrate:

* included Changes;
* excluded scope;
* verification state;
* unresolved defects;
* security review;
* migration readiness;
* operational readiness;
* rollback plan;
* approvals;
* release observations.

---

# 62. Operations Workspace

The Operations Workspace SHOULD connect telemetry and incidents to professional context.

It should support:

* current releases;
* service health;
* Outcome indicators;
* invariant monitors;
* significant Observations;
* incidents;
* recurring defects;
* architecture drift;
* reconciliation backlog.

---

# 63. Reconciliation Workspace Specialization

JanumiCode reconciliation SHALL support comparisons such as:

```text
Intent vs Requirement
Requirement vs Architecture
Architecture vs Code
Code vs Test
Expected vs Observed Behavior
Current Model vs Repository
Current Release vs Production
```

## 63.1 Reconciliation Outcomes

```text
revise_requirement
revise_architecture
modify_implementation
add_or_change_test
change_operational_control
reopen_decision
accept_exception
create_follow_on_pwu
```

---

# 64. VS Code Profile

The JanumiCode VS Code extension SHALL function as a professional workspace, not only an agent chat surface.

## 64.1 Primary Regions

```text
Janumi Activity Bar
Product Realization Explorer
PWU Header
Professional Context Panel
Editor
Agent Activity
Validation and Evidence Panel
Reconciliation Indicators
```

## 64.2 Product Realization Explorer

Recommended structure:

```text
Current PWU
├── Objective
├── Requirements
├── Architecture
├── Implementation
├── Verification
├── Decisions
├── Evidence
├── Dependencies
└── Reconciliation

Endeavor
├── Outcomes
├── Active PWUs
├── Decomposition
├── Releases
└── Operations
```

## 64.3 File Selection Context

Selecting source code SHOULD reveal:

* related PWUs;
* Requirements;
* architecture elements;
* Decisions;
* tests;
* invariants;
* Observations;
* outstanding reconciliation.

## 64.4 Agent Control

The extension SHALL expose:

* agent role;
* operating mode;
* scope;
* current step;
* tool use;
* outputs;
* validation;
* escalation;
* stop and safe-stop controls.

---

# 65. Conversational Profile

JanumiCode conversation SHALL be grounded in active professional context.

Material conversation outputs SHOULD become:

* Question;
* Assumption;
* Requirement;
* Claim;
* Decision proposal;
* PWU proposal;
* implementation plan;
* reconciliation proposal.

The system SHALL not require future agents to reconstruct material decisions from chat transcripts.

---

# 66. Repository Observation

JanumiCode SHOULD continuously observe repository state.

Potential Observations:

```text
commit_added
branch_created
pull_request_opened
pull_request_merged
file_changed
dependency_changed
test_added
test_removed
build_failed
security_alert
release_tagged
```

Observation does not automatically authorize semantic change.

It may trigger:

* impact analysis;
* traceability update;
* architecture drift detection;
* reconciliation.

---

# 67. CI/CD Observation

Potential normalized CI/CD Events:

```text
BuildStarted
BuildSucceeded
BuildFailed
TestExecuted
TestPassed
TestFailed
CoverageChanged
SecurityScanCompleted
ArtifactPublished
DeploymentStarted
DeploymentSucceeded
DeploymentFailed
RollbackStarted
RollbackCompleted
```

These SHALL be linked to Change, PWU, Release, and relevant professional entities where possible.

---

# 68. Production Feedback Loop

Production Observation SHALL feed:

```text
Outcome Assessment
Requirement Validation
Architecture Evaluation
Invariant Monitoring
Defect Detection
Risk Reassessment
Roadmap Decisions
Reconciliation
```

The product-realization process therefore does not terminate at deployment.

---

# 69. JanumiCode Coherence Dimensions

JCPWA SHALL assess at least:

```text
intent_coherence
requirement_coherence
journey_coherence
architecture_coherence
data_coherence
security_coherence
implementation_coherence
verification_coherence
release_coherence
operational_coherence
```

## 69.1 Coherence Explanation

Any summarized score SHALL expose the underlying conflicts, gaps, and stale Representations.

---

# 70. Product-Realization Events

JCPWA defines events including:

```text
ProductIntentFormalized
ProductIntentRevised
JourneyDefined
JourneyRevised
RequirementProposed
RequirementAccepted
RequirementRejected
RequirementImplemented
RequirementVerified
ArchitectureDecisionProposed
ArchitectureDecisionApproved
ArchitectureDriftDetected
InvariantProposed
InvariantAccepted
InvariantViolated
ImplementationPlanApproved
CodeChangeProposed
CodeChangeValidated
CodeChangeMerged
VerificationFailed
ReleaseCandidateCreated
ReleaseApproved
DeploymentObserved
OutcomeVarianceDetected
ProductionIncidentOpened
ProductionIncidentResolved
ProductReconciliationTriggered
```

---

# 71. Product-Realization Commands

Canonical commands include:

```text
FormalizeProductIntent
ReviseProductIntent
DefineOutcome
CreateUserJourney
ProposeRequirement
AcceptRequirement
RejectRequirement
CreateArchitectureDecision
ApproveArchitectureDecision
RegisterInvariant
ApproveImplementationPlan
StartImplementation
ProposeCodeChange
SubmitForReview
RecordVerificationResult
ApproveRelease
AuthorizeDeployment
RecordProductionObservation
OpenIncident
TriggerProductReconciliation
CompleteProductPwu
```

---

# 72. Product-Realization Attention Types

```text
intent_clarification_required
requirement_conflict
architecture_decision_required
security_review_required
implementation_blocked
verification_failed
traceability_gap
invariant_violation
release_approval_required
production_variance
incident_escalation
reconciliation_required
```

---

# 73. JanumiCode Invariants

## JCODE-INV-001 — Intent Traceability

Every material accepted Requirement, Architecture Decision, implementation Change, and Release SHALL trace to Intent or an authorized obligation.

## JCODE-INV-002 — Requirement Verification

Every material accepted Requirement SHALL possess an identified verification or validation method.

## JCODE-INV-003 — Architecture Rationale

Every material Architecture Decision SHALL preserve Alternatives, rationale, Constraints, and consequences.

## JCODE-INV-004 — Implementation Authorization

A material implementation Change SHALL trace to approved scope or an authorized incident action.

## JCODE-INV-005 — AI Attribution

AI-generated product, architecture, implementation, test, and review outputs SHALL remain attributable.

## JCODE-INV-006 — Test Failure Integrity

A failing required test SHALL not be removed, disabled, or weakened solely to obtain passing status without an authorized Decision.

## JCODE-INV-007 — Explicit State

Requirement, Change, verification, Release, and deployment states SHALL be explicit.

## JCODE-INV-008 — Boundary Validation

All external and generated inputs SHALL cross explicit validation boundaries.

## JCODE-INV-009 — Production Completion

Deployment success SHALL not imply Release acceptance or Outcome achievement.

## JCODE-INV-010 — Reconciliation of Drift

Detected material divergence among Intent, Requirement, Architecture, implementation, verification, and operation SHALL receive explicit disposition.

## JCODE-INV-011 — Parent Recomposition

Completion of child implementation PWUs SHALL not complete the parent capability PWU without integration and synthesis.

## JCODE-INV-012 — Invariant Coverage

Critical accepted invariants SHALL possess an identified enforcement and verification strategy.

## JCODE-INV-013 — Error Visibility

Material implementation and operational failures SHALL be typed, preserved, and observable.

## JCODE-INV-014 — No Silent Scope Expansion

Agents and humans SHALL not materially broaden implementation scope without authorized revision.

## JCODE-INV-015 — Independent Validation

Where required by policy or risk, the implementer SHALL not satisfy independent validation alone.

## JCODE-INV-016 — Repository Non-Authority

Repository state alone SHALL not define current professional truth.

## JCODE-INV-017 — Documentation Non-Authority

A design document alone SHALL not override contradictory implementation and Observation without reconciliation.

## JCODE-INV-018 — Observability Obligation

Material operational behaviors and invariants SHALL define how they are observed where feasible.

## JCODE-INV-019 — Residual Risk

Known residual product or technical risk SHALL be explicit at Release Decision time.

## JCODE-INV-020 — Professional Completion

A JanumiCode PWU SHALL not complete merely because code was generated or merged.

---

# 74. Minimum Viable JanumiCode Profile

The initial JanumiCode implementation SHALL support:

## 74.1 Core Entities

```text
ProductIntent
ProductOutcome
UserJourney
Requirement
ArchitectureDecision
DomainModelRepresentation
ImplementationPlan
SoftwareChange
Invariant
TestCase
VerificationResult
Release
DeploymentObservation
ProductionIncident
```

## 74.2 Core PWUs

```text
intent_formalization
user_journey_generation
requirements_generation
architecture_design
implementation_planning
implementation_slice
verification
release_preparation
production_incident
reconciliation
```

## 74.3 Core Validators

```text
ProductIntentClarityValidator
RequirementVerifiabilityValidator
TraceabilityValidator
ArchitectureIntentAlignmentValidator
ScopeComplianceValidator
InvariantCoverageValidator
RequirementCoverageValidator
ReleaseGateValidator
```

## 74.4 Core Workspaces

```text
Product Outcome
Product Realization Map
PWU Overview
Requirements
Architecture
Implementation
Verification
Decomposition
Decision
Reconciliation
Coordination
```

## 74.5 Core Integrations

```text
Git repository
Coding-agent runtime
OpenSandbox
Build and test runner
CI/CD results
Artifact storage
OpenTelemetry
```

---

# 75. Reference End-to-End Scenario

A user provides:

```text
Build a SaaS field-service management system for small trade-service
businesses such as plumbers, roofers, landscapers, and deck builders.
```

## 75.1 Intent Formalization

JanumiCode creates an `intent_formalization` PWU.

It identifies:

* target users;
* desired business change;
* product assumptions;
* missing scope;
* success interpretation;
* non-goals;
* constraints.

The system does not immediately start coding.

## 75.2 Understanding and Discovery

Child PWUs investigate:

* business operating model;
* user roles;
* scheduling;
* field execution;
* estimates;
* invoicing;
* customer communication;
* multi-tenancy;
* mobile operation;
* integration needs.

## 75.3 User Journeys

Journeys are created for:

* business owner;
* dispatcher;
* field technician;
* customer;
* administrator.

Failure, recovery, and exception paths are included.

## 75.4 Requirements

Requirements are derived and validated against:

* Intent;
* Journeys;
* business rules;
* quality attributes;
* operating constraints.

Each material Requirement receives a verification method.

## 75.5 Architecture

Architecture PWUs define:

* bounded contexts;
* system responsibilities;
* tenant isolation;
* identity and authorization;
* data ownership;
* mobile and web surfaces;
* integration;
* deployment;
* observability.

Material choices become Architecture Decisions.

## 75.6 Invariants

The invariant-generation process identifies properties such as:

```text
A technician may access only work assigned or otherwise authorized.
A customer invoice total must equal approved billable components.
A tenant may not access another tenant’s operational data.
A scheduled visit may not reference an inactive customer or work order.
```

Enforcement and verification strategies are assigned.

## 75.7 Planning

The RPH decomposes product realization into professionally coherent vertical slices.

Example:

```text
Customer Intake Slice
Scheduling Slice
Technician Work Execution Slice
Estimate and Approval Slice
Invoice and Payment Slice
```

Each slice carries Intent, Requirements, architecture, invariants, and validation.

## 75.8 Implementation

Coding agents receive bounded contracts.

They modify code in isolated workspaces, generate tests, record assumptions, and submit structured Change proposals.

## 75.9 Verification

Tests and analyses produce Evidence linked to Requirements and invariants.

Failures reopen implementation or earlier professional reasoning as necessary.

## 75.10 Release

Release readiness evaluates technical, security, operational, and product conditions.

Authorized participants approve deployment with explicit residual risk.

## 75.11 Operation

Production Observations assess:

* reliability;
* latency;
* workflow completion;
* user behavior;
* business outcomes;
* invariant violations.

## 75.12 Reconciliation

Observed divergence creates reconciliation work.

Examples:

* users bypass the intended scheduling workflow;
* mobile connectivity assumptions prove invalid;
* invoice correction rates exceed expectations;
* the data model does not support a newly discovered business rule.

The affected Intent, Journey, Requirements, architecture, implementation, and tests are updated coherently.

---

# 76. Coding-Agent UI Implementation Priorities

The coding agent currently implementing JanumiCode UI/UX SHALL build in this order:

## Phase 1 — Product-Realization Shell

Implement:

* active organization;
* JanumiCode PWA context;
* active Endeavor;
* cognitive breadcrumb;
* dual PWU state;
* Intent and Outcome visibility;
* projection selector;
* professional command region.

## Phase 2 — PWU and Decomposition

Implement:

* PWU overview;
* professional objective;
* scope;
* assumptions;
* Constraints;
* dependencies;
* child PWUs;
* recomposition readiness.

## Phase 3 — Product Realization Map

Implement relationships among:

```text
Intent
Outcome
Journey
Requirement
Architecture
Implementation
Verification
Release
Observation
```

## Phase 4 — Requirements and Architecture

Implement:

* Requirement workspace;
* architecture Decision workspace;
* traceability;
* evidence;
* assumptions;
* invariant display.

## Phase 5 — Implementation Workspace

Implement:

* active implementation slice;
* repository context;
* coding-agent execution;
* code Changes;
* tests;
* validation;
* completion readiness.

## Phase 6 — Verification and Reconciliation

Implement:

* Requirement coverage;
* invariant coverage;
* failed validation;
* expected versus observed;
* reconciliation proposals;
* impact analysis.

## Phase 7 — Coordination

Implement:

* RPH work portfolio;
* blockages;
* tactic health;
* escalation;
* synthesis;
* release readiness.

---

# 77. UI Prohibitions

The JanumiCode UI SHALL NOT:

* organize the entire experience around chat;
* make the file tree the primary professional structure;
* reduce PWUs to tickets;
* equate code generation with completion;
* present all professional phases as a rigid waterfall;
* hide failed reasoning or tests;
* display one undifferentiated “progress” percentage;
* merge proposed, reviewed, approved, implemented, and verified states;
* imply that generated requirements are authoritative without validation;
* treat architecture diagrams as isolated documents;
* hide reconciliation behind generic change notifications.

---

# 78. JSDL Extension Package

The JanumiCode PWA SHALL be encoded as JSDL extensions.

Reference modules:

```text
janumi.pwa.code.core
janumi.pwa.code.product
janumi.pwa.code.requirements
janumi.pwa.code.architecture
janumi.pwa.code.implementation
janumi.pwa.code.verification
janumi.pwa.code.release
janumi.pwa.code.operations
janumi.pwa.code.projections
janumi.pwa.code.validators
```

The compiler SHALL generate:

* TypeScript types;
* Command contracts;
* Event contracts;
* JSON Schemas;
* Validator interfaces;
* projection metadata;
* documentation;
* frontend semantic metadata.

---

# 79. Conformance Test

A JanumiCode implementation is conformant only if it can answer, for a material software Change:

* Which Intent does it serve?
* Which Outcome does it affect?
* Which Journey or Requirement motivated it?
* Which Architecture Decision governs it?
* Which invariants constrain it?
* Who or what implemented it?
* Which Evidence supports its correctness?
* Which tests verify it?
* Which Release includes it?
* What was observed after deployment?
* What assumptions remain?
* What reconciliation has occurred?
* Can the professional reasoning be reconstructed?

A system that can answer only:

* who committed it;
* which files changed;
* whether CI passed;
* whether the ticket closed

does not yet implement the JanumiCode Professional Work Architecture.

---

# 80. Resulting JanumiCode Experience

JanumiCode makes software product realization visible as one evolving professional cognition system.

Product managers, architects, engineers, coding agents, reviewers, security professionals, testers, operators, and leaders do not work in disconnected modules and then manually reconstruct coherence.

They work through shared, recursively composed PWUs over a common semantic model.

The interface shows:

* why the product exists;
* what users and organizations need;
* what is known and assumed;
* how the system is intended to work;
* what implementation is changing;
* what Evidence supports correctness;
* what operation reveals;
* where coherence has been lost;
* what professional action is required next.

The result is not merely AI-assisted coding.

It is continuously coherent, AI-native software product realization.
