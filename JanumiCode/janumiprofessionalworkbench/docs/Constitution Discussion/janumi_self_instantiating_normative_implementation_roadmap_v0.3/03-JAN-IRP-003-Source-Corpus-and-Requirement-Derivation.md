# JAN-IRP-003 — Source Corpus and Requirement Derivation

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Purpose:** Establish the controlled source corpus and the method by which implementation obligations are extracted, identified, audited, changed, and consumed.

## 1. Foundational rule

The implementation program shall not rely on conversational memory, filenames, document titles, or informal summaries as sufficient normative authority.

Every governing source shall be materialized, identified, versioned, assigned a status, placed in an authority tier, and made traceable to its derived implementation requirements.

## 2. Source record

Every source document shall possess:

```text
documentId
title
version
status
authorityTier
owner
approvalAuthority
applicability
effectiveDate
supersedes
supersededBy
dependsOn
sourceLocation
contentHash
```

Unknown owner or authority may be recorded provisionally during `P0`, but unresolved authority that affects implementation meaning shall block downstream acceptance.

## 3. Source statuses

```text
DRAFT
PROPOSED
PROPOSED_NORMATIVE
APPROVED_NORMATIVE
DOCTRINAL
REFERENCE
WORKING_CONTROL_RECORD
DEPRECATED
SUPERSEDED
WITHDRAWN
```

Status and authority tier are separate. A recently edited draft does not outrank an approved normative document merely because it is newer.

## 4. Default authority hierarchy

| Tier | Source family | Governing effect |
|---:|---|---|
| 0 | Janumi Constitution | Highest semantic and architectural authority. |
| 1 | Foundations, laws, PCLC, CPCO, approved CONOP and CONEMP | Universal theory, semantics, and doctrine. |
| 2 | PWU, RPH, Projection, JSDL, JEM, Shape Engineering, PWA profiles | Normative architecture and specialization. |
| 3 | Compiler, runtime, interaction, workspace, and UI profiles | Concrete realization profiles. |
| 4 | Implementation program, requirement register, roadmap instance, gate decisions | Implementation governance and evidence. |
| 5 | Operating plan, backlog, estimates, and assignments | Mutable logistics. |

Observed implementation and operational evidence do not occupy a normative tier. They establish current reality and may demonstrate that a normative source requires correction.

## 5. Corpus materialization procedure

During `P0`, the corpus steward shall:

1. locate every document cited by another material document;
2. assign or confirm stable document IDs;
3. consolidate duplicate or conversationally evolved versions without erasing history;
4. record missing or unavailable sources;
5. identify inconsistent terminology and potential contradictions;
6. calculate content hashes;
7. record dependencies and supersession;
8. classify each source's normative effect;
9. obtain or identify required approval;
10. freeze a baseline for requirement extraction.

## 6. Missing source handling

A missing source shall receive a record containing:

```text
expectedDocumentId
expectedTitle
reasonExpected
availability
impact
resolutionOwner
requiredByPhase
provisionalRule
```

A missing document shall not be silently reconstructed from memory when its exact wording materially governs implementation.

Where work may proceed provisionally, the program shall record the temporary interpretation and the gate at which the source must be supplied or the interpretation approved.

## 7. Requirement extraction scope

The requirement register shall include:

- every `SHALL` and `SHALL NOT` affecting implementation, operation, validation, security, authority, experience, or evidence;
- implementation-critical `SHOULD` and `SHOULD NOT` clauses;
- explicit invariants;
- mandatory state transitions and prohibitions;
- required relationships and semantic distinctions;
- required acceptance scenarios;
- required runtime and recovery guarantees;
- required agent constraints;
- required UI disclosures and interaction rules.

Pure explanation, motivation, examples, and non-binding recommendations need not become individual requirements unless they establish an acceptance criterion or necessary interpretation.

## 8. Requirement record

Each requirement shall contain:

```text
requirementId
normativeStatement
sourceDocumentId
sourceVersion
sourceClause
sourceTextHash
requirementFamily
strength
criticality
applicabilityRule
canonicalCapability
verificationMethod
currentStatus
implementationReferences
testReferences
evidenceReferences
discrepancyReferences
deviationReferences
acceptanceReferences
```

## 9. Stable requirement IDs

Requirement IDs shall remain stable across editorial changes that preserve meaning.

Example families:

```text
JAN-REQ-GOV-###
JAN-REQ-SEM-###
JAN-REQ-PWU-###
JAN-REQ-RPH-###
JAN-REQ-PROJ-###
JAN-REQ-JSDL-###
JAN-REQ-JEM-###
JAN-REQ-OPS-###
JAN-REQ-JCODE-###
```

An ID shall never be reused for a different obligation. Removed requirements shall remain in history with a superseded or withdrawn status.

## 10. Requirement strength

```text
MUST       derived from SHALL
MUST_NOT   derived from SHALL NOT
SHOULD     strong recommendation requiring rationale to depart
SHOULD_NOT strong discouragement requiring rationale to depart
MAY        optional capability or permitted behavior
```

A `SHOULD` may be treated as mandatory by a PWA, runtime profile, security policy, or release profile.

## 11. Criticality

```text
P0  Failure may invalidate Janumi semantics, authority, tenant isolation, safety, data integrity, or professional completion.
P1  Failure materially weakens conformance, assurance, reconstructability, or operations.
P2  Failure reduces quality, usability, evolvability, or completeness without invalidating the core baseline.
P3  Advisory or future-oriented obligation.
```

Criticality affects review and evidence depth; it does not silently change normative strength.

## 12. Requirement derivation procedure

### Pass A — Mechanical extraction

Locate normative keywords, invariants, state rules, required fields, prohibitions, and acceptance scenarios.

### Pass B — Semantic normalization

Rewrite each obligation into a single implementation-testable statement while preserving source meaning.

### Pass C — De-duplication and relationship analysis

Mark obligations as:

```text
IDENTICAL
REFINEMENT
SPECIALIZATION
DEPENDENT
POTENTIALLY_CONFLICTING
INDEPENDENT
```

Do not merge obligations that appear similar but govern different semantic layers.

### Pass D — Verification assignment

Assign at least one verification method:

```text
schema_validation
static_analysis
unit_test
property_test
integration_test
conformance_test
security_test
accessibility_test
runtime_observation
recovery_drill
professional_review
scenario_test
traceability_audit
```

### Pass E — Capability mapping

Map the obligation to one or more canonical capabilities in `JAN-IRP-008` or to program governance.

### Pass F — Coverage audit

Compare the source corpus against the register clause by clause. Record intentionally excluded clauses and rationale.

## 13. Requirement applicability

Applicability is not determined solely by whether a feature happens to exist.

A requirement may be:

```text
APPLICABLE
CONDITIONALLY_APPLICABLE
NOT_APPLICABLE
APPLICABILITY_UNKNOWN
```

`NOT_APPLICABLE` requires:

- a clear scope or profile reason;
- evidence that the condition does not apply;
- approval by the designated authority;
- a revisit trigger where applicability may change.

## 14. Source contradiction handling

Potential contradiction shall produce a source-reconciliation record containing:

```text
sourceA
sourceB
conflictingClauses
interpretations
implementationImpact
proposedResolution
authority
status
```

Until resolved, affected requirements shall be marked `BLOCKED_BY_SPECIFICATION` or bound to an approved provisional interpretation.

The corpus steward shall not silently edit one document to manufacture agreement.

## 15. Source changes after baseline

When a source changes:

1. classify the change as editorial, clarifying, additive, compatible semantic, or breaking semantic;
2. update content hash and version;
3. identify affected requirements;
4. perform requirement and model diff;
5. identify affected roadmap increments, code, data, tests, projections, and gate decisions;
6. determine whether accepted phases or increments reopen;
7. record migration or reconciliation obligations.

## 16. Provisional 157-requirement register

The incorporated `JAN-REQ-001` register contains 157 implementation-oriented obligations derived from the conversationally produced corpus. It is a valuable baseline, not a substitute for the `P0` clause-by-clause audit.

During `P0`:

- existing requirement IDs shall be preserved where meaning remains valid;
- missing obligations shall receive new IDs;
- duplicates shall be linked rather than reused;
- incorrect derivations shall be superseded with rationale;
- source clauses shall be updated to stable repository locations.

## 17. Machine-readable source and requirement controls

The package shall maintain:

```text
control/source-catalog.json
control/requirement-register.json
control/requirement-register.csv
```

The Markdown register is a human-readable projection. The controlled machine-readable register shall be treated as the operational source for assessments and automation after `P0` acceptance.

## 18. P0 evidence package

At minimum:

- source-catalog JSON and human-readable catalog;
- source hashes;
- authority approval record;
- missing-source register;
- contradiction register;
- requirement register;
- extraction coverage report;
- independent sample audit;
- P1 authorization.

## 19. P0 prohibitions

- Do not infer approval from document existence.
- Do not assign higher authority based only on recency.
- Do not rewrite source meaning while extracting a requirement.
- Do not delete superseded requirements from history.
- Do not classify an obligation as optional because implementation would be difficult.
- Do not use repository behavior to silently redefine the target corpus during P0.
