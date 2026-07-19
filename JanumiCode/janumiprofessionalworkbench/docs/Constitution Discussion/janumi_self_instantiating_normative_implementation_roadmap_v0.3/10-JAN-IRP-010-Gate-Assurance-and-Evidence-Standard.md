# JAN-IRP-010 — Gate Assurance and Evidence Standard

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Purpose:** Define what counts as evidence, how phase and increment conformance is reviewed, and how acceptance decisions are made.

## 1. Assurance principle

A conformance claim is a professional Claim. It shall identify its basis, evidence, limitations, reviewer, and authority.

No phase or increment shall pass solely because its producer declares it complete.

## 2. Evidence classes

```text
SOURCE_EVIDENCE       Code, schema, configuration, generated contract, or controlled document.
TEST_EVIDENCE         Automated or manual test result with reproducible context.
RUNTIME_EVIDENCE      Trace, log, metric, state inspection, or observed behavior.
MIGRATION_EVIDENCE    Pre/post validation, conversion report, rollback or restore result.
UI_EVIDENCE           Critical journey, accessibility, state, error, and interaction result.
SECURITY_EVIDENCE     Isolation, authority, secret, sandbox, or vulnerability result.
RECOVERY_EVIDENCE     Restart, replay, backup, restore, failover, or projection rebuild result.
PROFESSIONAL_REVIEW   Domain, architecture, UX, assurance, or governance review.
TRACEABILITY_EVIDENCE Requirement-to-model-to-code-to-test-to-observation linkage.
DECISION_EVIDENCE     Approved rationale, authority, alternatives, and residual uncertainty.
```

## 3. Evidence item contract

```text
evidenceId
title
evidenceClass
claimSupported
sourceOrCommand
repositoryRevision
semanticModelVersion
environment
collectedBy
collectedAt
contentHash
result
reproducibilityInstructions
limitations
accessClassification
retention
```

## 4. Evidence quality dimensions

- **Relevance:** directly addresses the obligation or gate claim.
- **Reliability:** source and method are credible.
- **Reproducibility:** another authorized reviewer can repeat or inspect it.
- **Currency:** applies to the assessed revision and environment.
- **Completeness:** covers required positive, negative, failure, and boundary behavior.
- **Independence:** not solely produced or interpreted by the implementer where independent evidence is required.
- **Traceability:** connects to requirements, implementation, test, and decision.

## 5. Evidence levels

```text
E0  Assertion only; no inspectable evidence.
E1  Single source or test indication.
E2  Direct evidence with reproducible context.
E3  Corroborated evidence across implementation and behavior.
E4  Independently reviewed, adversarial or operationally demonstrated evidence.
```

Default minimums:

- `P0` or `S1` obligations: `E3`, with `E4` where security, tenant, recovery, or authority is involved.
- `P1` obligations: `E2` or `E3` according to risk.
- `P2` obligations: `E1` or higher, with rationale.

## 6. Gate evidence package

Every phase and capability increment shall produce:

```text
1. Identification and scope
2. Governing sources and requirements
3. Entrance-condition evidence
4. Current or prior baseline
5. Implementation or assessment summary
6. Requirement conformance matrix
7. Automated test evidence
8. Negative and failure scenario evidence
9. Migration and compatibility evidence
10. Security, authority, and tenant evidence
11. UI and accessibility evidence where applicable
12. Runtime, observability, and recovery evidence where applicable
13. Deviations, deferrals, unknowns, and residual risk
14. Independent review
15. Acceptance recommendation
16. Integrity manifest
```

## 7. Acceptance decision values

```text
ACCEPTED
CONDITIONALLY_ACCEPTED
REJECTED
SUSPENDED
SUPERSEDED
```

### 7.1 Accepted

All mandatory conditions are satisfied or validly covered; downstream work may proceed within stated authority.

### 7.2 Conditionally accepted

Progression is permitted only under recorded conditions containing:

```text
condition
owner
dueByPhaseOrIncrement
risk
compensatingControl
verification
consequenceIfMissed
```

### 7.3 Rejected

Evidence or implementation is insufficient; downstream authority is withheld.

## 8. Gate decision record

```text
decisionId
gateType
gateId
subjectVersion
decision
reviewedEvidenceIds
findings
conditions
acceptedResidualUncertainty
activeDeviationIds
activeDeferralIds
nextAuthorizedScope
rationale
reviewers
acceptanceAuthority
decidedAt
```

## 9. Independent review

### 9.1 Required independence

The primary producer shall not be the sole reviewer or acceptance authority.

### 9.2 Review depth

Full review is required for:

- source authority and breaking semantic changes;
- `S1` discrepancies;
- security and tenant isolation;
- authority and AI autonomy;
- destructive or semantic migrations;
- recovery and restore;
- final release conformance.

Risk-based sampling may be used for repetitive lower-criticality records, but the sampling method shall be recorded.

### 9.3 Reviewer actions

The reviewer shall:

- trace a sample from requirement through evidence;
- challenge claims of absence and conformance;
- inspect negative and failure behavior;
- verify current revision and model version;
- identify producer bias or circular evidence;
- confirm deviations and residual uncertainty;
- issue findings with severity and disposition.

## 10. Required negative evidence

Where applicable, prove rejection and safe behavior for:

- unauthorized command;
- stale command;
- invalid transition;
- mandatory validator failure;
- duplicate command or event;
- cross-tenant access;
- agent scope expansion;
- sandbox boundary violation;
- failed migration or restore;
- projection lag or rebuild failure;
- parent completion with unresolved recomposition;
- decision approval with insufficient authority.

Happy-path evidence alone is insufficient.

## 11. Traceability matrix

The conformance matrix shall map:

```text
Requirement
→ Canonical capability
→ Roadmap increment or preserved implementation
→ Code/schema/config reference
→ Test/observation
→ Evidence item
→ Discrepancy/deviation
→ Acceptance decision
```

## 12. Evidence integrity

- Hash files and bundles.
- Record repository and model revisions.
- Preserve raw logs separately from summaries.
- Redact protected data through a traceable derivative process.
- Do not alter failed evidence to improve presentation.
- Record tool and environment versions.

## 13. Gate blocker rule

Unless explicitly permitted by higher authority, a gate shall not be accepted with:

- unresolved `S1` semantic, authority, tenant, data-integrity, safety, or recovery defect;
- missing exact assessed revision;
- untraceable mandatory requirement;
- expired deviation;
- failed mandatory validation;
- unknown migration effect on authoritative data;
- evidence produced against a different model or deployment version;
- producer-only acceptance.

## 14. Evidence expiration and revalidation

Evidence shall be revalidated when:

- source or implementation revision changes materially;
- semantic model changes;
- environment or provider changes;
- migration or deployment changes;
- a critical assumption is invalidated;
- an incident demonstrates contrary behavior;
- the evidence's declared expiration is reached.

## 15. Phase-specific assurance emphasis

| Phase | Assurance emphasis |
|---|---|
| P0 | source completeness, authority, requirement coverage |
| P1 | evidence integrity, reproducibility, non-contamination |
| P2 | evidence-to-model trace, unknowns, semantic accuracy |
| P3 | requirement assessment completeness and confidence |
| P4 | discrepancy classification, authority, impact, no-loss decisions |
| P5 | migration safety, compatibility, rollback, transition completeness |
| P6 | requirement coverage, DAG correctness, bounded increments |
| P7 | capability proof obligations and regression control |
| P8 | integration, security, recovery, operations, end-to-end behavior |
| P9 | residual risk, release profile, conformance declaration |

## 16. Evidence package tooling

Machine-readable gate packages shall validate against `schemas/gate-evidence-package.schema.json`. Human-readable summaries may be generated from them but shall not omit machine-readable findings.

## 17. Prohibitions

- Do not use screenshots as the only proof of server-side semantics.
- Do not use unit tests as the only proof of operational recovery.
- Do not count test quantity as verification adequacy.
- Do not cite generated documentation as independent evidence of the generator's correctness.
- Do not accept inaccessible evidence without a reviewer able to inspect it.
- Do not erase contradictory evidence from the package.
