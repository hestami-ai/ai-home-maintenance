# JAN-G0-EVD-001 — G0 Evidence and Exit-Gate Contract

**Version:** 0.1  
**Status:** Proposed normative evidence contract  
**Purpose:** Define the proof required to accept Gate G0 and authorize Gate G1.

## 1. Evidence package

The G0 evidence package shall contain the following.

## 1.1 Execution context

- repository and workspace identifiers;
- branch, commit SHA, dirty state, and submodule revisions;
- assessor and tool versions;
- assessment start and completion timestamps;
- unavailable systems and evidence limitations.

## 1.2 Approved or proposed source baseline

- source catalog;
- authority tiers;
- owner and approval authority assignments or explicit open items;
- materialized document locations;
- supersession map;
- missing-document register;
- authority approval record.

## 1.3 Current implementation inventory

- full inventory in JSON or equivalent structured form;
- human-readable architecture baseline;
- repository evidence index;
- route, schema, service, runtime, integration, and deployment maps;
- explicit inaccessible or unknown areas.

## 1.4 Requirement assessment

- one record for every requirement in `JAN-REQ-001`;
- coverage report;
- P0/P1 exception report;
- first-gate impact summary;
- evidence sufficiency report.

## 1.5 Discrepancy control

- discrepancy register;
- approved deviations;
- proposed and approved reconciliations;
- deferrals;
- G1 blockers;
- ownership and remediation-gate assignments.

## 1.6 Reproducibility evidence

- command log with working directories and exit status;
- build, lint, type-check, test, and generation results where available;
- schema and migration inspection results;
- screenshots or recordings for material UI behavior;
- traces or logs for material runtime claims;
- redaction and secret-handling record.

## 1.7 Integrity

- SHA-256 or equivalent manifest for the evidence package;
- semantic requirement-register version;
- roadmap version;
- repository revision;
- normative corpus revision or manifest.

## 2. Gate-review questions

The gate reviewer shall answer:

1. Are all normative sources identified and status-controlled?
2. Is the current implementation described from evidence rather than aspiration?
3. Has every requirement been assessed?
4. Are conformance claims supported by sufficient evidence?
5. Are all material discrepancies classified?
6. Are P0 and S1 unknowns resolved or explicitly bounded?
7. Is the G1 semantic subset identifiable?
8. Are bootstrap concessions explicit and expiring?
9. Are roadmap semantics separated from scheduling?
10. Can another qualified reviewer reproduce the material findings?

## 3. Exit decision values

## ACCEPTED

All G0 exit conditions are satisfied. G1 may begin within the approved scope.

## CONDITIONALLY_ACCEPTED

G1 may begin only within an explicitly bounded scope while listed conditions are resolved. Conditions shall identify owner, risk, due gate, and revocation trigger.

## REJECTED

G1 may not begin. The decision shall identify blockers and required remediation.

## 4. Minimum G1 authorization statement

A positive decision shall state:

```text
Authorized semantic subset
Authorized repositories and components
Applicable JSDL/CPCO/PWU source versions
Approved bootstrap concessions
Prohibited out-of-scope implementation
Required first G1 evidence
Unresolved but bounded conditions
```

## 5. Gate acceptance prohibitions

G0 shall not be accepted merely because:

- an inventory file exists;
- the repository builds;
- a coding agent reports that the architecture “looks aligned”;
- most requirements are assigned to later gates;
- discrepancies have been found but not classified;
- normative documents have been copied without authority status;
- the current UI renders the expected vocabulary;
- a happy-path demonstration succeeds.

## 6. Acceptance signature block

The decision record shall identify:

```text
Decision ID
Decision status
Decision authority
Review participants
Evidence package manifest
Repository revision
Normative corpus version
Approved deviations
Conditions
G1 authorization
Decision rationale
Recorded date
```
