# JAN-G0-REG-001 — Discrepancy, Deviation, Deferral, and Reconciliation Control

**Version:** 0.1  
**Status:** Proposed normative control procedure  
**Purpose:** Govern differences among target doctrine, specifications, current code, tests, deployed behavior, and operational evidence.

## 1. Discrepancy record

A discrepancy records a material divergence or ambiguity. Each record shall include:

```text
discrepancyId
title
classification
severity
status
description
sourceDocumentReferences
requirementIds
implementationReferences
evidenceReferences
currentBehavior
targetBehavior
impact
rootCauseHypothesis
owner
dispositionAuthority
proposedDisposition
remediationGate
deviationId
reconciliationId
createdAt
updatedAt
```

## 2. Mandatory classifications

## IMPLEMENTATION_DEFECT

The approved target requirement is sufficiently clear and current implementation violates or omits it.

## SPECIFICATION_DEFECT

The normative source is incorrect, internally inconsistent, non-implementable, unsafe, or fails to express the intended professional meaning.

## DOCUMENTATION_STALENESS

A document purports to describe current state but no longer matches valid implementation behavior. The target semantics may remain unchanged.

## VALID_EXISTING_BEHAVIOR

The implementation contains useful, coherent behavior absent from or underspecified by the corpus. It shall be preserved as evidence while an upstream decision determines whether it becomes normative.

## TEMPORARY_DEVIATION

Nonconformance is knowingly accepted for a bounded period with authority, risk, compensating controls, expiration, and required remediation.

## UNRESOLVED_AMBIGUITY

The governing meaning or authority cannot yet be determined. This classification shall not be used to avoid analysis.

## 3. Severity

```text
S1  Blocks a gate or creates material semantic, authority, tenant-isolation,
    data-integrity, safety, security, or recovery uncertainty.
S2  Material capability or coherence defect with bounded immediate risk.
S3  Localized defect, incomplete evidence, or noncritical inconsistency.
S4  Editorial, naming, or low-impact documentation issue.
```

## 4. Discrepancy lifecycle

```text
OPEN
  ↓
ANALYZING
  ↓
DISPOSITION_PROPOSED
  ↓
APPROVED_FOR_REMEDIATION | APPROVED_DEVIATION | OPEN_RECONCILIATION |
DOCUMENTATION_CORRECTION | NOT_APPLICABLE | REJECTED
  ↓
IN_PROGRESS
  ↓
RESOLVED | SUPERSEDED | EXPIRED
```

## 5. Deviation versus deferral

A **deviation** permits temporary nonconformance with an active requirement.

A **deferral** schedules a requirement that is not yet mandatory at the current gate, or postpones optional scope without violating a current gate.

A requirement already mandatory at G0 or needed to establish safe G1 entry cannot be converted into a mere deferral.

## 6. Temporary deviation contract

Every temporary deviation shall include:

```text
deviationId
affectedRequirementIds
scope
reason
currentNonconformantBehavior
risk
compensatingControls
approvalAuthority
approvedAt
expirationGate
expirationDateOptional
requiredRemediation
remediationOwner
monitoring
revocationConditions
status
```

An expiration gate is mandatory even when a calendar expiration is also supplied.

## 7. Upstream reconciliation

A specification reconciliation shall be opened when:

- implementation evidence reveals a contradiction among normative sources;
- a requirement is non-implementable as written;
- current valid behavior expresses professional meaning omitted by the model;
- a lower-level profile cannot conform without violating a higher-level principle;
- a semantic distinction is missing or incorrectly collapsed;
- the authority hierarchy cannot resolve the conflict.

The reconciliation record shall identify:

```text
reconciliationId
trigger
affectedDocuments
affectedRequirements
affectedImplementation
priorInterpretation
candidateInterpretations
evidence
impactAnalysis
recommendedDecision
authorityRequired
status
```

## 8. Current-state authority and target-state authority

The following rule shall govern:

> Code, tests, deployments, and operational data establish evidence of current behavior. Approved doctrine and normative specifications establish target obligations. Professional judgment determines which representation must change, but the judgment shall be explicit, evidenced, and authorized.

Therefore:

- code may defeat stale descriptive text about current behavior;
- code does not automatically defeat approved target semantics;
- normative prose does not erase valid existing behavior without an impact decision;
- tests may reveal intended behavior but are not automatically higher authority than specifications;
- deployed behavior may expose drift that requires either implementation correction or model revision.

## 9. G0 blocker rule

The following normally block G0 acceptance:

- unresolved S1 authority ambiguity;
- unknown tenant boundary for a multi-tenant implementation;
- unknown authoritative mutation path;
- inability to identify the deployed semantic model or persistence source of truth;
- missing source documents required to define the G1 semantic subset;
- P0 requirements left unassessed without approved exception.

## 10. No-loss rule

A discrepancy shall not be closed by deleting evidence, suppressing a failing test, removing a valid feature, or rewriting history. Resolution shall preserve prior state and rationale.
