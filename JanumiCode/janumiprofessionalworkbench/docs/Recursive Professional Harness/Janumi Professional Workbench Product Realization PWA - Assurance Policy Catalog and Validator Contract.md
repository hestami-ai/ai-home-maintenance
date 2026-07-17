# Janumi Professional Workbench Product Realization PWA Assurance Policy Catalog and Validator Contract

## Machine-Oriented Assurance Definitions for the Recursive Professional Harness

**Document ID:** `RPH-DOC-004`
**Status:** Initial canonical draft
**Applies to:** Product Realization PWA in the Janumi Professional Workbench
**Runtime:** Recursive Professional Harness
**Primary purpose:** Map legacy validator critique steps to governed, evidence-based Assurance Policies and require each validator to conform as a policy implementation
**Initial scope:** Intent shaping through product baseline promotion

---

# 1. Purpose

This specification defines the initial Assurance Engineering contract for the Product Realization PWA in the Janumi Professional Workbench.

It establishes:

* what an assurance policy is;
* how policies become applicable;
* what claims a validator implementation evaluates;
* what evidence may be considered;
* how validator-implementation independence is enforced;
* how findings and observations are represented;
* how an assessment reaches a disposition;
* which control actions may follow;
* how escalation and waivers work;
* how assurance results affect Professional Work Units, claims, evidence, decisions, and baselines.

The central architectural rule is:

> A validator is an implementation of an Assurance Policy. It evaluates one or more claims under that policy using identified evidence and returns schema-conformant findings and a disposition recommendation; the Assurance Service applies policy and records the authoritative disposition.

Validator implementations must not return only:

* free-form prose;
* generic pass or fail;
* unscoped confidence;
* untyped recommendations;
* hidden state changes.

Every material result must be represented through canonical assurance objects.

---

# 2. Assurance Engineering Objective

Shape Engineering asks:

> What must remain true as professional work is transformed?

Assurance Engineering asks:

> How do we know that it remains true?

Assurance protects the connection between:

```text id="sgm35r"
Originating Intent
        ↓
Professional Work Shape
        ↓
Decomposition
        ↓
Execution
        ↓
Artifacts
        ↓
Claims
        ↓
Evidence
        ↓
Accepted Outcome
```

The assurance layer must detect or expose:

* intent loss;
* intent drift;
* silent scope expansion;
* obligation erosion;
* missing constraints;
* invalid assumptions;
* unsupported claims;
* incomplete decomposition;
* local success that does not satisfy the parent objective;
* inadequate evidence;
* unauthorized decisions;
* invalid baseline promotion.

---

# 3. Assurance Policy Model

## 3.1 Policy definition

```typescript id="myq27q"
interface AssurancePolicyDefinition {
  id: string;
  version: string;
  semanticVersion: number;

  name: string;
  purpose: string;
  rationale: string;

  applicableObjectTypes: ProfessionalWorkObjectType[];
  applicability: ApplicabilityRule;

  evaluatedClaimTypes: ClaimType[];
  defaultClaimTemplates: ClaimTemplate[];

  requiredEvidence: EvidenceRequirement[];
  optionalEvidence?: EvidenceRequirement[];

  criteria: AssessmentCriterion[];

  evaluatorRole: string;
  independenceRequirement: IndependenceRequirement;

  findingDefinitions: FindingDefinition[];
  dispositionRules: DispositionRule[];

  permittedControlActions: ControlAction[];
  remediationRules: RemediationRule[];
  escalationRules: EscalationRule[];
  waiverRules?: WaiverRule[];

  riskProfiles: AssuranceProfileRule[];

  status:
    | 'DRAFT'
    | 'ACTIVE'
    | 'SUSPENDED'
    | 'SUPERSEDED';
}
```

## 3.2 Policy and validator-implementation distinction

The policy defines:

* professional purpose;
* claims;
* evidence;
* criteria;
* authority;
* outcomes.

The validator implementation defines:

* prompts;
* deterministic checks;
* models;
* tools;
* algorithms;
* retrieval behavior;
* output parsers.

Multiple validator implementations may conform to the same policy.

```text id="14fpxq"
Assurance Policy
        ↓
Validator Contract
        ↓
Validator Implementation A
Validator Implementation B
Human Review Procedure
Deterministic Rule Engine
```

A validator implementation may be replaced without changing the policy, provided it remains conformant.

---

# 4. Validator Implementation Contract

## 4.1 Contract definition

`ValidatorContract` is the implementation-level contract for a runtime evaluator of one or more Assurance Policies. It does not define policy semantics or possess disposition authority.

```typescript id="z7617a"
interface ValidatorContract {
  validatorId: string;
  validatorVersion: string;

  supportedPolicyIds: string[];

  implementationType:
    | 'MODEL'
    | 'DETERMINISTIC'
    | 'HYBRID'
    | 'HUMAN'
    | 'EXTERNAL_SERVICE';

  requiredInputSchemas: SchemaReference[];
  outputSchema: SchemaReference;

  requiredCapabilities: CapabilityRequest[];
  contextPolicyId: string;

  producerIndependenceMetadata: IndependenceMetadata;

  executionLimits: {
    timeoutSeconds?: number;
    maximumRetries?: number;
    maximumEvidenceItems?: number;
    maximumContextTokens?: number;
  };

  determinism:
    | 'DETERMINISTIC'
    | 'BOUNDED_NONDETERMINISTIC'
    | 'NONDETERMINISTIC';

  knownLimitations: string[];
}
```

## 4.2 Validator implementation output

```typescript id="9gqjlp"
interface ValidatorResult {
  validatorId: string;
  validatorVersion: string;
  policyId: string;
  policyVersion: string;

  assessmentId: string;
  subjectObjectIds: string[];
  claimResults: ClaimAssessmentResult[];

  evidenceConsideredIds: string[];
  evidenceRejected: RejectedEvidenceReference[];

  observations: ProposedAssuranceObservation[];

  dispositionRecommendation:
    | 'SATISFIED'
    | 'CONDITIONALLY_SATISFIED'
    | 'REJECTED'
    | 'INCONCLUSIVE'
    | 'ESCALATED';

  recommendedControlActions: ControlActionRecommendation[];

  residualUncertainty: string[];
  limitations: string[];

  executionProvenance: ExecutionProvenance;
}
```

The validator implementation's recommendation does not itself mutate assurance state.

The Assurance Service validates the result, enforces policy, and records the authoritative disposition.

---

# 5. Applicability Model

## 5.1 Applicability rule

```typescript id="3sdol1"
interface ApplicabilityRule {
  objectTypeConditions: ObjectTypeCondition[];
  pwuKindConditions?: string[];

  lifecycleTriggers?: string[];
  eventTriggers?: string[];

  riskConditions?: RiskCondition[];
  semanticChangeConditions?: SemanticChangeCondition[];

  requiredTags?: string[];
  excludedTags?: string[];

  expression?: PolicyExpression;
}
```

## 5.2 Applicability outcomes

```typescript id="k4xpd6"
type ApplicabilityOutcome =
  | 'REQUIRED'
  | 'RECOMMENDED'
  | 'OPTIONAL'
  | 'NOT_APPLICABLE'
  | 'REQUIRES_HUMAN_DETERMINATION';
```

## 5.3 Policy activation

A policy may activate because:

* a PWU reaches a lifecycle boundary;
* a material artifact is produced;
* decomposition is proposed;
* an assumption is detected;
* a claim is asserted;
* intent or a constraint changes;
* execution succeeds;
* baseline promotion is requested;
* risk exceeds a threshold;
* another validator implementation emits a triggering observation.

---

# 6. Evidence Requirements

## 6.1 Evidence requirement

```typescript id="q4jjzo"
interface EvidenceRequirement {
  id: string;
  evidenceType: EvidenceType;

  description: string;
  purpose: string;

  cardinality:
    | 'EXACTLY_ONE'
    | 'AT_LEAST_ONE'
    | 'ZERO_OR_MORE'
    | 'ONE_PER_SUBJECT'
    | 'ONE_PER_OBLIGATION';

  admissibilityRules: AdmissibilityRule[];
  freshnessRule?: FreshnessRule;

  requiredForDispositions:
    | 'ALL'
    | 'SATISFIED_ONLY'
    | 'CONDITIONAL_OR_SATISFIED';

  mayBeWaived: boolean;
}
```

## 6.2 Evidence admissibility

Evidence is admissible only when:

* its identity is stable;
* provenance is present;
* content or reference is available;
* scope is stated;
* limitations are recorded;
* it is not invalidated;
* it is sufficiently current;
* it is relevant to the assessed claim.

## 6.3 Evidence is not proof by existence

Examples:

* A test result does not establish requirements coverage unless its relationship to requirements is shown.
* An architecture document does not prove architectural completeness.
* A citation proves that a source made a statement, not necessarily that the statement is correct.
* A validator implementation's opinion is not independent evidence unless the policy permits professional judgment as evidence.
* A successful execution trace proves execution occurred, not that the outcome satisfies intent.

---

# 7. Assessment Criteria

```typescript id="4fldq3"
interface AssessmentCriterion {
  id: string;
  name: string;
  description: string;

  criterionType:
    | 'BOOLEAN'
    | 'ENUMERATED'
    | 'QUALITATIVE'
    | 'QUANTITATIVE'
    | 'COMPOSITE';

  evaluationMethod:
    | 'DETERMINISTIC'
    | 'MODEL_JUDGMENT'
    | 'HUMAN_JUDGMENT'
    | 'HYBRID';

  requiredEvidenceIds: string[];

  severityIfNotMet:
    | 'INFORMATIONAL'
    | 'ADVISORY'
    | 'MATERIAL'
    | 'BLOCKING'
    | 'CRITICAL';

  mayBeNotApplicable: boolean;
}
```

Every criterion result must be:

* met;
* partially met;
* not met;
* not applicable;
* unable to determine.

“Unable to determine” is not equivalent to “met.”

---

# 8. Validator-Implementation Independence

## 8.1 Independence levels

```typescript id="0hcjjd"
type IndependenceRequirement =
  | 'NONE'
  | 'DIFFERENT_INVOCATION'
  | 'DIFFERENT_CONTEXT_INSTANCE'
  | 'DIFFERENT_AGENT'
  | 'DIFFERENT_MODEL'
  | 'DIFFERENT_PROVIDER'
  | 'HUMAN'
  | 'ORGANIZATIONALLY_INDEPENDENT';
```

## 8.2 Independence rules

A validator implementation is not independent merely because it is called a “Verifier.”

The runtime must compare:

* producer invocation;
* evaluator invocation;
* agent identity;
* model identity;
* provider;
* shared hidden context;
* shared prompt lineage;
* organizational authority.

## 8.3 Default independence profiles

### Lightweight

Different invocation.

### Standard

Different agent role; a different model is preferred for material claims.

### High assurance

Different model or provider, plus human or organizationally independent assessment for critical claims.

## 8.4 Independence violations

If required independence is not satisfied:

* the assessment cannot receive `SATISFIED`;
* an Independence Violation Observation is created;
* another evaluator must be invoked or a waiver obtained.

---

# 9. Findings and Observations

## 9.1 Finding definition

```typescript id="8thsk2"
interface FindingDefinition {
  code: string;
  name: string;
  description: string;

  defaultSeverity:
    | 'INFORMATIONAL'
    | 'ADVISORY'
    | 'MATERIAL'
    | 'BLOCKING'
    | 'CRITICAL';

  affectedClaimTypes: ClaimType[];

  defaultControlActions: ControlAction[];
}
```

## 9.2 Observation requirements

Every material observation must identify:

* subject;
* policy;
* criterion;
* evidence;
* severity;
* statement;
* implications;
* recommended control action.

Observations must avoid vague language such as:

* “could be improved”;
* “looks reasonable”;
* “probably acceptable”;
* “consider reviewing.”

The finding must explain what is deficient and why it matters.

---

# 10. Dispositions

## 10.1 Disposition meanings

### SATISFIED

The available admissible evidence supports the assessed claims under the policy criteria, subject to recorded limitations.

### CONDITIONALLY_SATISFIED

The claims are supportable only if explicit conditions remain true or required follow-up occurs.

### REJECTED

One or more material claims are unsupported, contradicted, or violate a blocking criterion.

### INCONCLUSIVE

The available evidence is insufficient to support or reject the claim.

### WAIVED

An authorized actor accepts proceeding without satisfaction of one or more criteria.

### ESCALATED

The validator implementation or policy-designated authority cannot resolve the issue within its authority or competence.

## 10.2 Disposition rules

```typescript id="g7h5oa"
interface DispositionRule {
  disposition:
    | 'SATISFIED'
    | 'CONDITIONALLY_SATISFIED'
    | 'REJECTED'
    | 'INCONCLUSIVE'
    | 'ESCALATED';

  condition: PolicyExpression;

  requiredEvidenceIds?: string[];
  forbiddenOpenSeverities?: string[];
  requiredIndependence?: IndependenceRequirement;
}
```

## 10.3 Default precedence

Unless a policy overrides it:

```text id="euv1if"
CRITICAL open finding
    → REJECTED or ESCALATED

BLOCKING open finding
    → REJECTED

MATERIAL open finding
    → CONDITIONALLY_SATISFIED, INCONCLUSIVE, or REJECTED

Evidence deficit
    → INCONCLUSIVE

All mandatory criteria met
    → SATISFIED
```

---

# 11. Control Actions

```typescript id="38gtje"
type ControlAction =
  | 'CONTINUE'
  | 'WAIT'
  | 'CLARIFY'
  | 'GATHER_CONTEXT'
  | 'GATHER_EVIDENCE'
  | 'REVISE_PROMPT'
  | 'REVISE_CONTEXT'
  | 'RETRY'
  | 'CHANGE_MODEL'
  | 'CHANGE_TOOL'
  | 'CHANGE_VALIDATOR'
  | 'CHANGE_TACTIC'
  | 'RESHAPE_PWU'
  | 'REVISE_DECOMPOSITION'
  | 'REPLAN_EXECUTION'
  | 'INVALIDATE_DEPENDENTS'
  | 'REQUEST_HUMAN_DECISION'
  | 'REQUEST_WAIVER'
  | 'ESCALATE'
  | 'REJECT'
  | 'ABANDON'
  | 'ACCEPT'
  | 'PROMOTE_BASELINE';
```

A validator implementation recommends control actions.

The controller selects and executes them under policy.

---

# 12. Waiver Contract

## 12.1 Waiver definition

```typescript id="fgsv4d"
interface WaiverRule {
  waiverAllowed: boolean;

  eligibleCriteriaIds: string[];
  prohibitedFindingSeverities: string[];

  requiredAuthorityType: string;
  maximumDuration?: string;

  requiredRationaleFields: string[];
  requiredCompensatingControls?: string[];

  revalidationTrigger?: PolicyExpression;
}
```

## 12.2 Waiver invariants

A waiver must record:

* exact policy and criterion;
* exact object and semantic version;
* finding being waived;
* authority;
* rationale;
* duration or expiration;
* compensating controls;
* downstream impact;
* review conditions.

A waiver does not:

* erase a finding;
* transform false evidence into valid evidence;
* declare a rejected claim true;
* apply to future semantic versions unless explicitly renewed.

---

# 13. Escalation Contract

```typescript id="sdv1ep"
interface EscalationRule {
  trigger: PolicyExpression;

  escalationTarget:
    | 'HUMAN_USER'
    | 'PRODUCT_OWNER'
    | 'ARCHITECT'
    | 'SECURITY_REVIEWER'
    | 'LEGAL_REVIEWER'
    | 'SYSTEM_OWNER'
    | 'INDEPENDENT_VALIDATOR';

  requiredPackage: string[];
  timeoutAction?: ControlAction;
}
```

Escalation packages must be synthesized for the authority receiving them.

They should include:

* decision requested;
* subject;
* current state;
* claims;
* evidence;
* findings;
* alternatives;
* consequences;
* residual uncertainty.

---

# 14. Assurance Policy Catalog Overview

The initial Product Realization PWA catalog contains twelve mandatory core policies.

| Policy                 | Primary lifecycle point                  |
| ---------------------- | ---------------------------------------- |
| Intent Fidelity        | Intent formalization                     |
| Intent Completeness    | Before downstream shaping                |
| Assumption Disclosure  | Any model-produced professional artifact |
| Requirement Coverage   | Product behavior definition              |
| Decomposition Coverage | PWU decomposition                        |
| Constraint Propagation | PWU decomposition and change             |
| Architecture Coverage  | Architecture completion                  |
| Historical Consistency | Material decisions and structures        |
| Intent Preservation    | Major transformations                    |
| Test Adequacy          | Test strategy and validation             |
| Fitness for Purpose    | Integrated product validation            |
| Baseline Promotion     | Acceptance into authority                |

Additional recommended policies are included later.

---

# 15. Policy POL-INTENT-FIDELITY

## 15.1 Identity

```text id="v67e1p"
ID: pol_intent_fidelity
Version: 1.0.0
```

## 15.2 Purpose

Determine whether formalized Product Intent faithfully represents:

* the user’s originating expression;
* authorized clarifications;
* accepted constraints;
* explicitly approved scope changes.

## 15.3 Applicability

Required when:

* an Intent Object moves toward `FORMALIZED`;
* a revised intent is proposed;
* the intent baseline is submitted for approval;
* a descendant artifact is suspected of altering intent.

## 15.4 Claims evaluated

1. The formalized objective preserves the user’s desired outcome.
2. The scope does not include unauthorized expansion.
3. Mandatory constraints were not omitted or weakened.
4. Proposed non-goals do not exclude required outcomes.
5. Inferred solutions are distinguished from user needs.
6. Material ambiguities remain explicit.

## 15.5 Required evidence

* originating expression;
* clarification dialogue;
* supplied documents;
* proposed Product Intent;
* constraints;
* recorded user corrections;
* prior intent version where applicable.

## 15.6 Criteria

### IF-01 Objective fidelity

Does the formalized objective represent the need rather than substitute a preferred solution?

### IF-02 Boundary fidelity

Are in-scope and out-of-scope statements consistent with user authority?

### IF-03 Constraint fidelity

Are explicit user constraints preserved?

### IF-04 Interpretation disclosure

Are inferred elements labeled as inferred or proposed?

### IF-05 Ambiguity visibility

Are materially unresolved interpretations explicit?

## 15.7 Findings

* `SOLUTION_SUBSTITUTION`
* `UNAUTHORIZED_SCOPE_EXPANSION`
* `MISSING_USER_CONSTRAINT`
* `FALSELY_CLOSED_AMBIGUITY`
* `INFERRED_NEED_PRESENTED_AS_FACT`
* `OUTCOME_EROSION`
* `NON_GOAL_CONFLICT`

## 15.8 Independence

Standard: different invocation and agent role from the intent synthesizer.

High assurance: different model plus human approval.

## 15.9 Disposition rules

SATISFIED only when:

* no blocking fidelity finding remains;
* all mandatory constraints trace into the intent;
* material ambiguities are disclosed;
* required evidence is admissible.

## 15.10 Permitted control actions

* CLARIFY
* REVISE_CONTEXT
* RESHAPE_PWU
* REQUEST_HUMAN_DECISION
* REJECT

## 15.11 Waiver

Unauthorized intent alteration cannot be waived.

A user may explicitly approve a revised intent, which creates a governed intent revision rather than a waiver.

---

# 16. Policy POL-INTENT-COMPLETENESS

## 16.1 Purpose

Determine whether the current Product Intent contains enough explicit structure for the next authorized professional activity.

Completeness is proportional to:

* risk;
* consequence;
* uncertainty;
* irreversibility.

## 16.2 Applicability

Required before:

* Product Behavior Definition;
* Architecture Definition;
* high-impact implementation planning.

## 16.3 Claims evaluated

1. Desired outcomes are sufficiently explicit.
2. Product boundaries are sufficient for the next activity.
3. known stakeholders and actors are represented proportionally.
4. mandatory constraints are recorded.
5. success conditions exist or the work is explicitly exploratory.
6. major ambiguities have dispositions.

## 16.4 Required evidence

* Product Intent;
* ambiguity catalog;
* constraint catalog;
* stakeholder and actor catalog;
* non-goals;
* risk profile.

## 16.5 Findings

* `MISSING_DESIRED_OUTCOME`
* `UNBOUNDED_PRODUCT_SCOPE`
* `MISSING_MANDATORY_CONSTRAINT`
* `UNRESOLVED_CRITICAL_AMBIGUITY`
* `NO_SUCCESS_CONDITION`
* `PREMATURE_DOWNSTREAM_SHAPING`
* `FALSE_COMPLETENESS`

## 16.6 Dispositions

* SATISFIED
* CONDITIONALLY_SATISFIED
* INCONCLUSIVE
* REJECTED

Exploratory work may receive conditional satisfaction when uncertainty is explicit and downstream execution remains reversible.

---

# 17. Policy POL-ASSUMPTION-DISCLOSURE

## 17.1 Purpose

Identify premises that materially affect the validity of work but have not been established as facts, constraints, or authorized decisions.

## 17.2 Applicability

Required for:

* model-produced professional artifacts;
* proposed decompositions;
* architecture;
* implementation plans;
* validation reasoning;
* migration and deployment plans.

## 17.3 Claims evaluated

1. Material assumptions have been surfaced.
2. Assumptions are distinguished from facts.
3. Affected objects are identified.
4. Materiality is classified.
5. Verification or acceptance needs are identified.
6. critical assumptions do not silently authorize irreversible work.

## 17.4 Evidence

* artifact under assessment;
* execution rationale;
* prompt and context provenance where relevant;
* known facts;
* constraints;
* decisions;
* external sources.

## 17.5 Findings

* `HIDDEN_MATERIAL_ASSUMPTION`
* `ASSUMPTION_PRESENTED_AS_FACT`
* `UNBOUNDED_ASSUMPTION_SCOPE`
* `MISSING_ASSUMPTION_BASIS`
* `UNASSESSED_CRITICAL_ASSUMPTION`
* `EXPIRED_ASSUMPTION`
* `CONFLICTING_ASSUMPTIONS`

## 17.6 Required output

Every material assumption becomes an Assumption Object with:

* statement;
* basis;
* materiality;
* affected objects;
* status;
* verification method or authority requirement.

## 17.7 Disposition rules

SATISFIED means assumptions have been disclosed, not necessarily verified.

Critical unresolved assumptions may cause:

* CONDITIONALLY_SATISFIED;
* REJECTED;
* ESCALATED.

## 17.8 Control actions

* GATHER_EVIDENCE
* CLARIFY
* RESHAPE_PWU
* INVALIDATE_DEPENDENTS
* REQUEST_HUMAN_DECISION
* ESCALATE

---

# 18. Policy POL-REQUIREMENT-COVERAGE

## 18.1 Purpose

Determine whether approved:

* outcomes;
* capabilities;
* journeys;
* constraints;
* operational needs

are represented by requirements or explicitly excluded.

## 18.2 Applicability

Required when:

* Product Behavior Definition approaches satisfaction;
* architecture begins;
* intent changes;
* major journeys change.

## 18.3 Claims evaluated

1. Each mandatory outcome is represented.
2. Each critical journey has applicable requirements.
3. each mandatory constraint creates enforceable obligations.
4. important failure paths are addressed.
5. requirements without an authoritative source are identified.
6. explicit exclusions are recorded.

## 18.4 Evidence

* approved intent;
* outcome catalog;
* capability map;
* user journeys;
* scenarios;
* constraints;
* requirement catalog;
* traceability matrix.

## 18.5 Findings

* `UNCOVERED_OUTCOME`
* `UNCOVERED_CAPABILITY`
* `UNCOVERED_JOURNEY_STEP`
* `MISSING_FAILURE_REQUIREMENT`
* `ORPHAN_REQUIREMENT`
* `CONSTRAINT_WITHOUT_OBLIGATION`
* `UNAUTHORIZED_REQUIREMENT`
* `DUPLICATE_REQUIREMENT`

## 18.6 Independence

Different role from primary requirement author for Standard and High-Assurance profiles.

## 18.7 Disposition

Blocking when a mandatory user outcome or constraint has no requirement or governed exclusion.

---

# 19. Policy POL-DECOMPOSITION-COVERAGE

## 19.1 Purpose

Determine whether child PWUs collectively preserve and cover the parent PWU’s obligations.

## 19.2 Applicability

Required when:

* a Decomposition Contract is submitted;
* decomposition changes semantically;
* a child is removed;
* a parent obligation changes.

## 19.3 Claims evaluated

1. Every mandatory parent obligation is allocated, retained, satisfied, or waived.
2. each child has a coherent professional purpose.
3. sibling dependencies are explicit.
4. child boundaries are sufficiently distinct.
5. recomposition is feasible.
6. the decomposition preserves intent.

## 19.4 Evidence

* parent PWU;
* parent intent;
* parent obligations;
* constraints;
* assumptions;
* child PWUs;
* allocations;
* dependency graph;
* recomposition contract.

## 19.5 Criteria

### DC-01 Obligation coverage

No mandatory obligation silently disappears.

### DC-02 Constraint preservation

Applicable constraints are propagated or retained.

### DC-03 Cohesion

Each child represents coherent work.

### DC-04 Boundary clarity

Child responsibilities are distinguishable.

### DC-05 Dependency completeness

Material sibling dependencies are explicit.

### DC-06 Recomposition feasibility

A credible parent-level integration strategy exists.

### DC-07 Intent continuity

Child objectives remain subordinate to parent intent.

## 19.6 Findings

* `MISSING_OBLIGATION_ALLOCATION`
* `DROPPED_CONSTRAINT`
* `ORPHAN_CHILD_PWU`
* `OVERLAPPING_CHILD_SCOPE`
* `EXCESSIVE_CHILD_COUPLING`
* `INVALID_GRANULARITY`
* `MISSING_SIBLING_DEPENDENCY`
* `MISSING_RECOMPOSITION_STRATEGY`
* `CHILD_INTENT_DIVERGENCE`
* `FALSE_COMPLETE_COVERAGE`

## 19.7 Disposition

Any missing mandatory obligation or child intent divergence is blocking.

## 19.8 Control actions

* REVISE_DECOMPOSITION
* RESHAPE_PWU
* CLARIFY
* REQUEST_HUMAN_DECISION
* REJECT

---

# 20. Policy POL-CONSTRAINT-PROPAGATION

## 20.1 Purpose

Determine whether constraints remain enforceable as work is decomposed, delegated, transformed, or revised.

## 20.2 Applicability

Required for:

* decomposition;
* intent revision;
* architecture revision;
* plan revision;
* child PWU creation;
* baseline change.

## 20.3 Claims evaluated

1. Every mandatory applicable parent constraint has an explicit disposition.
2. propagated constraints retain authority and strength.
3. inapplicability decisions have rationale.
4. waivers are authorized and scoped.
5. child artifacts do not contradict inherited constraints.

## 20.4 Findings

* `SILENT_CONSTRAINT_DROP`
* `WEAKENED_CONSTRAINT`
* `UNAUTHORIZED_INAPPLICABILITY`
* `EXPIRED_CONSTRAINT_WAIVER`
* `CONSTRAINT_CONTRADICTION`
* `MISSING_CONSTRAINT_TRACE`
* `CONSTRAINT_SCOPE_ERROR`

## 20.5 Blocking conditions

* mandatory applicable constraint omitted;
* mandatory constraint weakened without authority;
* critical artifact violates an active constraint.

---

# 21. Policy POL-ARCHITECTURE-COVERAGE

## 21.1 Purpose

Determine whether the architecture provides a coherent structure for satisfying applicable product obligations.

## 21.2 Applicability

Required when:

* Architecture PWU completes execution;
* architecture is materially revised;
* implementation planning begins;
* architecture baseline promotion is requested.

## 21.3 Claims evaluated

1. Applicable requirements are allocated.
2. system boundaries are explicit.
3. major components have coherent responsibilities.
4. interfaces are sufficiently defined.
5. data ownership is explicit.
6. security boundaries are represented.
7. operational and deployment concerns are proportionate.
8. mandatory constraints are preserved.
9. known architecture risks and assumptions are explicit.
10. architecture is feasible.

## 21.4 Evidence

* approved intent;
* requirements;
* journeys;
* architecture artifacts;
* decision records;
* interface definitions;
* data model;
* deployment model;
* security analysis;
* traceability;
* assumption catalog.

## 21.5 Findings

* `UNCOVERED_REQUIREMENT`
* `UNCLEAR_SYSTEM_BOUNDARY`
* `UNCLEAR_COMPONENT_RESPONSIBILITY`
* `MISSING_INTERFACE_DEFINITION`
* `AMBIGUOUS_DATA_OWNERSHIP`
* `MISSING_SECURITY_BOUNDARY`
* `MISSING_OPERATIONAL_CONCERN`
* `ARCHITECTURE_CONSTRAINT_VIOLATION`
* `UNRESOLVED_ARCHITECTURE_CONFLICT`
* `UNSUPPORTED_FEASIBILITY_CLAIM`
* `ARCHITECTURE_OVERFIT`
* `ARCHITECTURE_UNDERFIT`

## 21.6 Disposition

Critical security, tenant-isolation, data-integrity, or mandatory-constraint failures are blocking.

---

# 22. Policy POL-HISTORICAL-CONSISTENCY

## 22.1 Purpose

Determine whether current work:

* repeats known failure;
* conflicts with an active decision;
* ignores recorded rationale;
* diverges from precedent without explanation.

## 22.2 Applicability

Recommended for:

* material architecture decisions;
* repeated failure patterns;
* significant refactoring;
* replacement of established structures;
* baseline changes;
* known organizational sensitivities.

## 22.3 Claims evaluated

1. relevant historical records were considered.
2. current work does not unknowingly repeat a known failure.
3. active prior decisions are respected or formally superseded.
4. divergence is intentional and justified.
5. stale or inapplicable precedent is not treated as binding.

## 22.4 Evidence

* prior decisions;
* narrative memories;
* incident records;
* previous assurance findings produced through validator implementations;
* Git or repository history;
* prior baselines;
* design rationale.

## 22.5 Findings

* `KNOWN_FAILURE_RECURRENCE`
* `ACTIVE_DECISION_CONFLICT`
* `UNEXPLAINED_PRECEDENT_DIVERGENCE`
* `STALE_PRECEDENT_APPLIED`
* `MISSING_DESIGN_RATIONALE`
* `HISTORICAL_CONTEXT_INSUFFICIENT`
* `CHESTERTONS_FENCE_RISK`

## 22.6 Disposition

Historical difference is not failure.

The policy may be satisfied when divergence is explicit and adequately justified.

---

# 23. Policy POL-INTENT-PRESERVATION

## 23.1 Purpose

Determine whether a transformation of professional work remains faithful to the authorized intent.

## 23.2 Applicability

Required after:

* decomposition;
* product behavior definition;
* architecture;
* implementation planning;
* implementation;
* integrated validation;
* major semantic revision.

## 23.3 Claims evaluated

1. desired outcomes remain represented.
2. scope has not expanded or contracted without authority.
3. mandatory constraints remain active.
4. descendant work continues to serve the parent objective.
5. implementation choices have not replaced product need.
6. local success contributes to global success.
7. authorized intent revisions are properly recorded.

## 23.4 Evidence

* originating expression;
* approved intent;
* parent and child PWUs;
* constraints;
* transformation artifacts;
* decisions;
* trace links;
* completion claims.

## 23.5 Findings

* `INTENT_EROSION`
* `INTENT_EXPANSION`
* `CHILD_OBJECTIVE_DRIFT`
* `IMPLEMENTATION_SUBSTITUTION`
* `LOCAL_SUCCESS_GLOBAL_FAILURE`
* `LOST_USER_OUTCOME`
* `UNAUTHORIZED_INTENT_REVISION`
* `TRACEABILITY_BREAK`

## 23.6 Blocking conditions

Any material unauthorized divergence from approved intent.

## 23.7 Control actions

* RESHAPE_PWU
* REVISE_DECOMPOSITION
* INVALIDATE_DEPENDENTS
* REQUEST_HUMAN_DECISION
* REJECT
* ABANDON

---

# 24. Policy POL-TEST-ADEQUACY

## 24.1 Purpose

Determine whether the available tests are sufficient to support the claims being made.

## 24.2 Applicability

Required for:

* test strategy approval;
* implementation completion;
* integrated validation;
* baseline promotion.

## 24.3 Claims evaluated

1. tests trace to requirements or risks.
2. critical journeys are covered.
3. failure and alternate paths are proportionately covered.
4. integrations are tested at appropriate boundaries.
5. regression scope is justified.
6. test environments are sufficiently representative.
7. results are current and reproducible where required.
8. passing tests are not overclaimed.

## 24.4 Evidence

* test strategy;
* test inventory;
* trace matrix;
* test results;
* environment description;
* coverage reports;
* defect history;
* risk profile.

## 24.5 Findings

* `UNTESTED_REQUIREMENT`
* `UNTESTED_CRITICAL_JOURNEY`
* `MISSING_FAILURE_PATH_TEST`
* `INADEQUATE_INTEGRATION_TEST`
* `UNJUSTIFIED_REGRESSION_SCOPE`
* `NONREPRESENTATIVE_TEST_ENVIRONMENT`
* `FLAKY_TEST_EVIDENCE`
* `STALE_TEST_RESULT`
* `TEST_CLAIM_OVERREACH`
* `TEST_ORACLE_WEAKNESS`

## 24.6 Important rule

Passing tests do not establish fitness for purpose unless their scope supports that claim.

---

# 25. Policy POL-FITNESS-FOR-PURPOSE

## 25.1 Purpose

Determine whether the completed product is suitable for the actual approved user need.

## 25.2 Applicability

Required during integrated product validation and before product baseline promotion.

## 25.3 Claims evaluated

1. intended actors can achieve critical outcomes.
2. major journeys function coherently.
3. the product addresses the originating problem.
4. technical correctness has not obscured product failure.
5. known limitations are compatible with declared use.
6. residual uncertainty is acceptable.
7. critical operational conditions are represented.

## 25.4 Evidence

* approved intent;
* journeys;
* requirements;
* working product;
* end-to-end evidence;
* user or human review;
* operational evidence;
* limitations;
* open findings.

## 25.5 Findings

* `PRODUCT_OUTCOME_NOT_ACHIEVABLE`
* `CRITICAL_JOURNEY_FAILURE`
* `TECHNICALLY_CORRECT_PRODUCT_FAILURE`
* `MISSING_OPERATIONAL_REALITY`
* `UNACCEPTABLE_LIMITATION`
* `UNRESOLVED_USER_VALUE_GAP`
* `FITNESS_EVIDENCE_INSUFFICIENT`

## 25.6 Independence

Standard: independent validator implementation plus human product decision.

High assurance: independent validation team or organizational authority.

---

# 26. Policy POL-BASELINE-PROMOTION

## 26.1 Purpose

Determine whether candidate work may become an authoritative baseline.

## 26.2 Applicability

Required whenever baseline promotion is requested.

## 26.3 Claims evaluated

1. candidate artifacts are exactly identified.
2. reviewed and promoted versions match.
3. required assessments are complete.
4. blocking findings are resolved or validly waived.
5. evidence remains valid.
6. decision authority is valid.
7. residual risk is disclosed and accepted.
8. rollback or recovery exists where required.
9. the baseline has a declared purpose and scope.

## 26.4 Evidence

* baseline manifest;
* artifact hashes;
* assurance assessments;
* open findings;
* waivers;
* decisions;
* evidence package;
* rollback plan;
* superseded baseline.

## 26.5 Findings

* `CANDIDATE_VERSION_MISMATCH`
* `MISSING_REQUIRED_ASSESSMENT`
* `OPEN_BLOCKING_FINDING`
* `INVALID_OR_EXPIRED_WAIVER`
* `INVALIDATED_EVIDENCE`
* `MISSING_DECISION_AUTHORITY`
* `UNACCEPTED_RESIDUAL_RISK`
* `MISSING_RECOVERY_PLAN`
* `AMBIGUOUS_BASELINE_SCOPE`

## 26.6 Disposition

No conditional baseline promotion for unresolved critical findings.

## 26.7 Waiver

Critical integrity failures cannot be waived by ordinary product authority.

---

# 27. Recommended Additional Policies

The following policies should be implemented after the core twelve.

## 27.1 Requirement Quality

Checks:

* necessity;
* ambiguity;
* atomicity;
* feasibility;
* testability;
* over-specification.

## 27.2 Journey Coverage

Checks:

* actors;
* normal paths;
* alternate paths;
* failure paths;
* permissions;
* interruption and recovery.

## 27.3 Architecture Consistency

Checks:

* internal contradictions;
* incompatible interfaces;
* conflicting identity models;
* inconsistent data ownership;
* deployment contradictions.

## 27.4 Implementation Scope Conformance

Checks:

* unauthorized code changes;
* speculative abstractions;
* unrelated refactoring;
* omitted required changes.

## 27.5 Architecture Conformance

Checks whether implementation satisfies applicable architecture decisions and constraints.

## 27.6 Evidence Sufficiency

Evaluates whether the evidence package is adequate for a specified set of claims.

## 27.7 Recomposition Integrity

Evaluates whether assured child outputs collectively satisfy the parent.

## 27.8 Security Assurance

Evaluates:

* threat assumptions;
* tenant isolation;
* authorization;
* secrets;
* data protection;
* external boundaries.

## 27.9 Migration Assurance

Evaluates:

* source and target integrity;
* transformation correctness;
* reconciliation;
* rollback;
* cutover controls.

## 27.10 Observability Sufficiency

Evaluates whether execution and operation produce enough information to detect, explain, and recover from failure.

---

# 28. Policy Composition

Multiple policies may apply to the same object.

Example:

```text id="qvol42"
Architecture Artifact
├── Assumption Disclosure
├── Architecture Coverage
├── Architecture Consistency
├── Historical Consistency
├── Constraint Propagation
└── Intent Preservation
```

## 28.1 Composition rules

* A satisfied advisory policy does not override a rejected blocking policy.
* A waiver applies only to its specified policy and criterion.
* Policy conflict must be surfaced.
* Policy results remain independently inspectable.
* An aggregate assurance state must preserve the strictest unresolved disposition relevant to the work.

## 28.2 Aggregate assurance disposition

Initial rule:

```text id="7xdnas"
Any critical rejection
    → REJECTED

Any blocking rejection
    → REJECTED

Any required assessment missing
    → EVIDENCE_REQUIRED or UNASSESSED

Any inconclusive required assessment
    → INCONCLUSIVE

Any conditional required assessment
    → CONDITIONALLY_SATISFIED

All required assessments satisfied
    → SATISFIED
```

This must not be reduced to a numerical average.

---

# 29. Validator Implementation Invocation Lifecycle

```text id="4tqtsm"
Policy applicability detected
        ↓
Assessment created
        ↓
Claims instantiated or selected
        ↓
Evidence requirements evaluated
        ↓
Missing evidence requested
        ↓
Validator implementation selected
        ↓
Independence checked
        ↓
Context assembled
        ↓
Validator implementation executes
        ↓
Result schema validated
        ↓
Evidence references validated
        ↓
Observations persisted
        ↓
Disposition determined by Assurance Service
        ↓
Control recommendation sent to Controller
```

---

# 30. Assurance Assessment State Machine

```text id="rreug6"
REQUESTED
    ↓
EVIDENCE_PENDING
    ↓
READY
    ↓
ASSESSING
    ↓
SATISFIED
CONDITIONALLY_SATISFIED
REJECTED
INCONCLUSIVE
ESCALATED
WAIVED
```

Alternate transitions:

```text id="vhqva5"
ASSESSING → VALIDATOR_FAILED
ASSESSING → INDEPENDENCE_VIOLATION
SATISFIED → INVALIDATED
CONDITIONALLY_SATISFIED → INVALIDATED
WAIVED → WAIVER_EXPIRED
ANY ACTIVE → CANCELLED
```

---

# 31. Assurance Events

```text id="yl7ymv"
AssurancePolicyActivated
AssuranceAssessmentRequested
AssuranceEvidenceRequired
AssuranceEvidenceReceived
AssuranceEvaluatorSelected
AssuranceIndependenceVerified
AssuranceIndependenceViolated
AssuranceAssessmentStarted
AssuranceCriterionEvaluated
AssuranceObservationRecorded
AssuranceAssessmentSatisfied
AssuranceAssessmentConditionallySatisfied
AssuranceAssessmentRejected
AssuranceAssessmentInconclusive
AssuranceAssessmentEscalated
AssuranceAssessmentInvalidated

WaiverRequested
WaiverGranted
WaiverDenied
WaiverExpired
```

> **Relationship to the Canonical Domain Model §26.5 (authored clarification, §0.3 grant, 2026-07-17).**
> This list **refines, and does not contradict,** the assurance events in DOC-002 (Canonical Domain Model,
> Invariant Catalog, State Machines, and Event Contract) §26.5. The two compose by scope, each contributing the
> events in its domain of authority:
>
> * §26.5 is the **cross-domain object-lifecycle** catalog: the claim events (`ClaimAsserted`, `ClaimContested`,
>   `ClaimSupported`, `ClaimRejected`) and the evidence-**object** events (`EvidenceProposed`, `EvidenceAdmitted`,
>   `EvidenceRejected`, `EvidenceInvalidated`, `EvidenceExpired`) — which belong to the domain model, not to this
>   policy catalog, and are therefore absent here.
> * This §31 list adds the **assurance-assessment-internal lifecycle** events — `AssuranceEvidenceRequired`,
>   `AssuranceEvidenceReceived`, `AssuranceEvaluatorSelected`, `AssuranceIndependenceVerified` /
>   `AssuranceIndependenceViolated`, `AssuranceCriterionEvaluated`, `AssuranceAssessmentInvalidated` — the fine
>   steps that drive the §30 state machine (`REQUESTED → EVIDENCE_PENDING → READY → ASSESSING`) and are produced
>   by the §32 commands (`submitEvidenceForAssessment`, `selectAssuranceEvaluator`, `beginAssuranceAssessment`,
>   `recordCriterionResult`). §26.5, being the coarser cross-domain set, spans `AssuranceAssessmentRequested →
>   AssuranceAssessmentStarted` without naming these intermediate steps.
>
> The two lists **share identically** on the assessment-outcome and waiver core (`AssuranceAssessmentRequested`,
> `AssuranceAssessmentStarted`, `AssuranceObservationRecorded`, the five outcome events, the four waiver events) —
> no event appears in both with a different meaning. DOC-002 §26 does not claim its lists are exhaustive ("The
> runtime should use domain events for all material changes."), so the finer events here **compose** with §26.5
> rather than conflicting.
>
> Consequence for the Assurance View (§38, "missing evidence"): that field is **ratified and sourceable in
> principle** — `AssuranceEvidenceRequired` names the required set and `AssuranceEvidenceReceived` /
> `EvidenceAdmitted` name the satisfied set, so "missing evidence" is their difference. Both events are ratified
> **names** here but **schematized nowhere** in the corpus (DOC-007 omits them), and the §32 commands that would
> emit them are **not yet built**. So it is a schema-and-wiring task, **not** a ratification decision. (Same
> composition relationship as the DOC-003/DOC-004 assurance-catalog ruling; recorded so no reader re-derives a
> conflict from a granularity difference.)

---

# 32. Assurance Commands

```text id="w0hmna"
activateAssurancePolicy
requestAssuranceAssessment
submitEvidenceForAssessment
selectAssuranceEvaluator
beginAssuranceAssessment
recordCriterionResult
recordAssuranceObservation
completeAssuranceAssessment
invalidateAssuranceAssessment

requestAssuranceWaiver
grantAssuranceWaiver
denyAssuranceWaiver
expireAssuranceWaiver
```

Every mutation must enforce:

* policy version;
* object semantic version;
* independence;
* authorization;
* expected revision.

---

# 33. Validator Implementation Output Schema Example

```json id="09li70"
{
  "validatorId": "validator.intent-preservation.model-review",
  "validatorVersion": "1.0.0",
  "policyId": "pol_intent_preservation",
  "policyVersion": "1.0.0",
  "assessmentId": "assess_01J...",
  "subjectObjectIds": [
    "pwu_01J...",
    "artifact_01J..."
  ],
  "claimResults": [
    {
      "claimId": "claim_01J...",
      "criterionResults": [
        {
          "criterionId": "IP-01",
          "result": "MET",
          "rationale": "The primary user outcome remains represented.",
          "evidenceIds": [
            "evidence_01J..."
          ]
        },
        {
          "criterionId": "IP-04",
          "result": "NOT_MET",
          "rationale": "The implementation introduces an administrator workflow not authorized by the approved scope.",
          "evidenceIds": [
            "evidence_01J..."
          ]
        }
      ],
      "recommendedStatus": "CONTESTED"
    }
  ],
  "observations": [
    {
      "findingCode": "INTENT_EXPANSION",
      "severity": "MATERIAL",
      "statement": "The implementation adds an enterprise approval hierarchy not present in the approved Product Intent.",
      "subjectObjectIds": [
        "pwu_01J..."
      ],
      "evidenceIds": [
        "evidence_01J..."
      ],
      "recommendedControlActions": [
        "RESHAPE_PWU",
        "REQUEST_HUMAN_DECISION"
      ]
    }
  ],
  "dispositionRecommendation": "CONDITIONALLY_SATISFIED",
  "recommendedControlActions": [
    {
      "action": "REQUEST_HUMAN_DECISION",
      "rationale": "The new workflow may be valuable but constitutes a material scope change."
    }
  ],
  "residualUncertainty": [],
  "limitations": [
    "No direct user interview evidence was available."
  ]
}
```

---

# 34. Error Handling

## 34.1 Validator implementation execution failure

A validator implementation failure is not an assurance rejection.

It produces:

* `VALIDATOR_FAILED`;
* execution error;
* incomplete assessment;
* retry, alternate validator implementation, or escalation action.

## 34.2 Invalid validator implementation output

Malformed or incomplete output must be rejected at the boundary.

Required behavior:

* preserve raw output for diagnostics;
* record schema validation failure;
* do not create authoritative findings from unparsed prose;
* retry or use another validator implementation.

## 34.3 Evidence access failure

If required evidence cannot be retrieved:

* disposition becomes `EVIDENCE_PENDING` or `INCONCLUSIVE`;
* do not infer evidence content.

## 34.4 Conflicting validator implementations

Conflicting assessments remain visible.

The system may:

* invoke a tie-breaking validator implementation;
* gather discriminating evidence;
* escalate;
* permit an authorized human decision.

It must not silently average disagreement.

---

# 35. Validator Implementation Registry

The runtime should maintain a registry:

```typescript id="73sv3m"
interface ValidatorRegistryEntry {
  validatorId: string;
  supportedPolicies: string[];

  roleId: string;
  implementationType: string;

  modelPolicy?: ModelSelectionPolicy;
  requiredCapabilities: CapabilityRequest[];

  independenceAttributes: {
    agentFamily?: string;
    modelFamily?: string;
    provider?: string;
    organization?: string;
  };

  costClass:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH';

  latencyClass:
    | 'INTERACTIVE'
    | 'STANDARD'
    | 'LONG_RUNNING';

  status:
    | 'ACTIVE'
    | 'DEGRADED'
    | 'DISABLED';
}
```

Selection should consider:

* policy;
* independence;
* domain competence;
* evidence types;
* cost;
* latency;
* availability;
* risk profile.

---

# 36. Assurance Profiles

## 36.1 Lightweight assurance

* same model permitted in a separate invocation;
* advisory findings;
* limited evidence package;
* no human approval unless material change emerges.

## 36.2 Standard assurance

* separate agent;
* independent evidence review;
* blocking findings;
* human approval for material scope, architecture, or baseline changes.

## 36.3 High assurance

* different model or provider;
* independent specialist or human;
* stronger evidence;
* explicit residual risk;
* restricted waivers;
* immutable assessment package.

---

# 37. Human Review Package Contract

A governance package should contain:

```typescript id="qdil39"
interface HumanReviewPackage {
  decisionRequested: string;

  subjectObjectIds: string[];
  subjectSemanticVersions: Record<string, number>;

  executiveSummary: string;

  originatingIntentSummary: string;
  changedShapeSummary?: string;

  materialClaims: ClaimSummary[];
  materialAssumptions: AssumptionSummary[];

  assessmentSummaries: AssessmentSummary[];
  openObservations: ObservationSummary[];

  evidenceSummary: EvidenceSummary[];
  residualUncertainty: string[];

  availableOptions: DecisionOption[];
  recommendation?: DecisionRecommendation;
}
```

The user should not need to inspect the full object graph to exercise authority.

---

# 38. Assurance Workbench Requirements

The Assurance View must show:

* applicable policies;
* assessment state;
* validator implementation identity;
* independence status;
* claims evaluated;
* evidence considered;
* missing evidence;
* findings;
* severity;
* disposition;
* open conditions;
* waivers;
* control actions;
* invalidation status.

A green node may be displayed only when:

* required assurance is satisfied;
* no blocking finding remains;
* required conditions are explicit.

Execution success and assurance satisfaction must use different visual indicators.

---

# 39. Core Assurance Invariants

1. Every assessment references an active policy version.

2. Every assessment identifies its subject semantic version.

3. Every satisfied claim references admissible evidence.

4. Every material observation identifies evidence or explicitly states that it is a professional judgment.

5. Every required criterion has a result.

6. “Unable to determine” cannot be treated as “met.”

7. Confidence cannot substitute for evidence.

8. Required independence must be verified.

9. Validator implementation failure cannot become assurance rejection.

10. Invalid validator implementation output cannot mutate authoritative state.

11. Open critical findings block satisfaction.

12. Open blocking findings block baseline promotion.

13. A waiver cannot erase a finding.

14. A waiver applies only to its specified scope and version.

15. Invalidated evidence triggers reassessment of dependent claims.

16. A semantic change to the subject invalidates or reviews prior assessments.

17. Conflicting assessments remain visible.

18. Human approval cannot retroactively alter evidence.

19. Assessment history is append-oriented.

20. A baseline cannot be promoted solely because all execution steps completed.

---

# 40. Conformance Tests

## Test 1: Independent intent validation

Given the same invocation produced intent and evaluated fidelity:

Then the assessment cannot become satisfied when policy requires a different invocation.

## Test 2: Missing evidence

Given a required architecture trace matrix is absent:

Then Architecture Coverage is `EVIDENCE_PENDING` or `INCONCLUSIVE`, not satisfied.

## Test 3: Unsupported pass

Given a validator implementation recommends `SATISFIED` but a mandatory criterion is not met:

Then the Assurance Service rejects the recommendation.

## Test 4: Invalidated evidence

Given a test result supporting a claim is invalidated:

Then the claim and dependent assessments become review-required or invalidated.

## Test 5: Blocking finding

Given a mandatory tenant-isolation constraint is violated:

Then Architecture Coverage is rejected and baseline promotion is blocked.

## Test 6: Material assumption

Given a critical assumption remains unverified:

Then work cannot proceed to irreversible execution without authorized acceptance.

## Test 7: Waiver scope

Given a waiver applies to architecture version 2:

Then it does not apply to architecture version 3.

## Test 8: Validator-implementation disagreement

Given one validator implementation supports a claim and another rejects it:

Then both assessments remain visible and aggregate assurance is contested.

## Test 9: Execution success

Given all execution steps succeed:

Then assurance remains unassessed until required policies complete.

## Test 10: Intent drift

Given implementation adds unauthorized functionality:

Then Intent Preservation emits a material or blocking finding.

## Test 11: Historical divergence

Given architecture differs from precedent with explicit valid rationale:

Then Historical Consistency may be satisfied.

## Test 12: Baseline mismatch

Given the artifact hash differs from the reviewed candidate:

Then Baseline Promotion is rejected.

---

# 41. Initial Implementation Backlog

## Epic A: Assurance policy schema

* Implement `AssurancePolicyDefinition`.
* Implement applicability expressions.
* Implement policy versioning.
* Implement policy registry.
* Seed the twelve core Product Realization PWA policies.

## Epic B: Validator implementation registry

* Implement Validator Contract.
* Register existing Janumi Professional Workbench validator implementations.
* Record producer and evaluator identity.
* Enforce independence requirements.
* Support alternate validator-implementation selection.

## Epic C: Assessment lifecycle

* Implement assessment state machine.
* Implement required evidence resolution.
* Implement criterion results.
* Implement observation persistence.
* Implement authoritative disposition logic.

## Epic D: Claim and evidence integration

* Link claims to assessments.
* Link evidence to claims.
* validate evidence scope and status.
* propagate evidence invalidation.
* support rejected evidence records.

## Epic E: Control integration

* publish assurance recommendations;
* allow controller actions;
* distinguish validator-implementation recommendation from controller decision;
* support reshaping, replanning, and escalation.

## Epic F: Waiver and governance

* implement waiver requests;
* enforce authority;
* enforce scope and expiration;
* preserve findings;
* include waivers in baseline package.

## Epic G: Assurance workbench

* policy list;
* assessment detail;
* evidence inspector;
* finding display;
* independence indicator;
* disposition and conditions;
* human review package.

---

# 42. Migration of Existing Validator Implementations

For each current validator implementation:

1. Identify professional purpose.
2. Identify target objects.
3. Identify claims evaluated.
4. Identify evidence currently used.
5. Identify implicit criteria.
6. Identify possible findings.
7. identify current downstream effects.
8. assign or create an Assurance Policy.
9. create a Validator Contract.
10. wrap current output with schema validation.
11. separate recommendations from authoritative state changes.
12. add independence metadata.
13. create conformance tests.

No existing validator implementation should be migrated merely as the legacy pattern:

```text id="cs1eeg"
Validator node
→ feedback message
→ pass/fail
```

---

# 43. Definition of Done

The initial Assurance Engineering layer is complete when:

* all twelve core policies exist as versioned definitions;
* current validator implementations are mapped to policies;
* validator implementation output conforms to a canonical schema;
* assessments evaluate claims rather than generic outputs;
* evidence requirements are enforceable;
* independence is checked;
* findings are typed and persisted;
* dispositions are determined by policy;
* control recommendations feed the controller;
* waivers require authority and remain traceable;
* semantic changes invalidate relevant prior assessments;
* open blocking findings prevent baseline promotion;
* the Assurance View accurately explains why work is or is not trusted.

---

# 44. Closing Assurance Rule

A trustworthy professional system must distinguish among:

```text id="3jlm4k"
The agent produced an output.

The output satisfies its local instructions.

The output satisfies its Professional Work Unit.

The PWU contributes to its parent obligation.

The combined work preserves the user’s intent.

The available evidence justifies acceptance.

The appropriate authority has accepted it.
```

These are separate claims.

Assurance Engineering exists to ensure that Janumi Professional Workbench does not collapse them into one unexamined notion of completion.

The validator implementation contract defined here turns critique into governed measurement and observations into durable professional objects; the Assurance Policy and Assurance Service ensure that successful execution becomes an outcome that may be accepted only when the evidence justifies confidence that the user’s original need has survived the entire process.
