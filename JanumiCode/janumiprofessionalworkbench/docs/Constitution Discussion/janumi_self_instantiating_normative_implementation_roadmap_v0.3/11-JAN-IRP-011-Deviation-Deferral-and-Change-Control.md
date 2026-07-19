# JAN-IRP-011 — Deviation, Deferral, and Change Control

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Purpose:** Control temporary nonconformance, authorized scope deferral, bootstrap concessions, emergency changes, roadmap changes, and upstream normative changes without obscuring target intent or current risk.

## 1. Distinctions

### 1.1 Discrepancy

An observed difference requiring classification and disposition.

### 1.2 Deviation

An authorized, time-bounded condition in which an applicable normative requirement is not currently satisfied.

### 1.3 Deferral

An authorized decision that an applicable capability or requirement will not be realized in the current release or increment, without claiming conformance.

### 1.4 Bootstrap concession

A temporary implementation form accepted specifically to unlock construction of the canonical mechanism that will replace it.

### 1.5 Specification change

A proposed alteration to normative meaning, not merely implementation sequencing.

### 1.6 Roadmap-instance change

A change to repository-specific packaging, dependencies, or sequencing that preserves canonical capability meaning.

## 2. Deviation record

```text
deviationId
title
status
requirementIds
sourceClauses
currentNonconformance
reason
professionalRisk
technicalRisk
securityOperationalRisk
scope
compensatingControls
authority
owner
approvedAt
effectiveFrom
expiresAtOrIncrement
remediationIncrement
revisitTriggers
evidenceIds
closureEvidence
```

## 3. Deviation lifecycle

```text
PROPOSED
UNDER_REVIEW
APPROVED
ACTIVE
EXPIRING
EXPIRED
REMEDIATING
CLOSED
REJECTED
REVOKED
SUPERSEDED
```

An expired deviation returns the requirement to unapproved nonconformance and shall block affected gates unless renewed under authority.

## 4. Deviation approval tests

A deviation may be approved only when:

- target requirement remains explicit;
- reason is more than convenience;
- affected scope is bounded;
- risk and downstream impact are assessed;
- compensating controls are credible;
- duration or expiration increment is explicit;
- remediation has an owner and path;
- no higher authority prohibits deviation;
- affected users or operations are not misled about conformance.

## 5. Deferral record

```text
deferralId
requirementOrCapability
releaseProfile
reason
scopeImpact
dependencyImpact
userExperienceImpact
risk
revisitCondition
owner
authority
status
```

A deferred requirement shall remain visible in the conformance matrix as `DEFERRED_APPROVED`, not `CONFORMANT` or `NOT_APPLICABLE`.

## 6. Bootstrap concession rules

A bootstrap concession shall:

- identify the canonical capability it enables;
- comply with all feasible higher-authority semantics;
- avoid becoming a second source of truth;
- have an expiration increment;
- include deletion or migration work;
- be regression-tested during its permitted life;
- be reviewed at every affected gate.

Example:

```text
Hand-authored command payload types may be used before the JSDL TypeScript
generator is accepted, provided they are derived from the controlled semantic
model, marked bootstrap-only, tested for equivalence, and replaced by increment RI-006.
```

## 7. Specification change proposal

```text
changeProposalId
sourceDocumentIds
affectedClauses
problemStatement
newEvidence
currentInterpretation
proposedMeaning
alternatives
rationale
compatibility
requirementImpact
implementationImpact
dataAndEventImpact
uiAndAgentImpact
migrationNeeded
revisitTriggers
proposer
reviewers
approvalAuthority
status
```

A coding agent may propose but shall not approve a breaking semantic change.

## 8. Change classification

```text
EDITORIAL
CLARIFYING
ADDITIVE_COMPATIBLE
REFINEMENT_COMPATIBLE
ROADMAP_PACKAGING
REPOSITORY_BINDING
BREAKING_SEMANTIC
SECURITY_OR_SAFETY_EMERGENCY
```

## 9. Change effect

### Editorial or clarifying

May update prose without requirement-ID change when meaning remains stable.

### Additive compatible

May add new requirement IDs and future increments after impact assessment.

### Roadmap packaging or repository binding

May change exact increment boundaries, paths, or parallelization while preserving canonical outcomes.

### Breaking semantic

Requires upstream approval, requirement/model diff, migration assessment, and downstream reconciliation. Accepted phases or increments may reopen.

## 10. Emergency implementation change

An emergency change may proceed before normal roadmap authorization only when delay creates greater immediate risk.

It shall:

- identify emergency authority;
- preserve pre-change evidence;
- minimize scope;
- record Commands, changes, and observations;
- define rollback or recovery;
- open reconciliation immediately;
- receive retrospective review within a defined period;
- not become permanent silently.

## 11. Deviation versus specification defect

Do not use a deviation when the requirement itself is likely wrong. Open a specification-change proposal.

Do not use a specification defect classification merely to avoid compliance. Evidence and authority shall support it.

## 12. Deviation versus deferral

- Deviation: implemented or exposed area is known to violate an applicable requirement temporarily.
- Deferral: capability is outside the current release scope and is not falsely represented as present.

If a deferred capability's absence causes an implemented surface to violate a mandatory requirement, a deviation is also required.

## 13. No-loss rule

Change control shall preserve:

- original source versions;
- original requirement meaning;
- previous implementation evidence;
- superseded roadmap and gate decisions;
- migration and reconciliation rationale.

## 14. Registers

The program instance shall maintain:

```text
discrepancy-register.json
deviation-register.json
deferral-register.json
specification-change-register.json
bootstrap-concession-register.json
roadmap-change-register.json
```

## 15. Review cadence

Active deviations, deferrals, and concessions shall be reviewed:

- at every affected increment gate;
- at P8 integration review;
- before P9 release acceptance;
- when a revisit trigger occurs;
- before expiration.

## 16. Closure

A deviation closes only when:

- conformance is implemented and evidenced;
- the requirement is validly changed or made not applicable;
- affected data and consumers are reconciled;
- compensating controls can be removed safely;
- closure is approved.

## 17. Prohibitions

- No indefinite deviation without explicit conversion into accepted architecture.
- No hidden deferral through omission from the roadmap.
- No `NOT_APPLICABLE` used as a deferral.
- No emergency change used for planned convenience.
- No semantic change hidden inside implementation refactoring.
- No expired concession accepted as evidence of final conformance.
