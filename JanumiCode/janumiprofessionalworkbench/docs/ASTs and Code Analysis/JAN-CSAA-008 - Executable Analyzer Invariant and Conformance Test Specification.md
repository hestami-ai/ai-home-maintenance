# Executable Analyzer Invariant and Conformance Test Specification

**Document ID:** `JAN-CSAA-008`

**Version:** `0.3.0`

**Status:** `Draft`

**Settledness:** `HYPOTHESIS`

**Classification:** Substantive controlled-CSAA member candidate; non-authoritative, documentation-only executable-conformance and verification-and-validation specification. This `0.3.0` successor adds exhaustive and mutation-resistant tests for the exact `JAN-CSAA-003@0.2.0` four-valued query algebra and `JAN-CSAA-007@1.1.0` query-expression contracts while carrying the operational test closure required by `JAN-CSAA-009@0.1.0`; no physical fixture, conferred oracle, generated schema, provider qualification, persistence mechanism, topology, or gate effect is created by this Draft

**Governing status:** Documentation-only Wave 3 entry under `JAN-CSAA-W2-SEMANTIC-READINESS-001@0.1.0`, `JPWB-REG-005 REG-D-021`, and the correction at `REG-D-022`

**Role:** Define the stable test-catalog semantics, coverage obligations, result-eligibility rules, hostile and degraded cases, tests-of-tests, and no-false-green acceptance method by which a separately authorized implementation can later be judged

**Authority:** None. Authorship specifies later executable obligations but cannot create or execute a test, confer an oracle, qualify or select a provider, instantiate or evaluate a Repository Gate Profile, approve an exception, or confer any member or implementation state

**Candidate concern allocation:** Analyzer conformance and V&V method only

**Requirement ledger:** [JAN-CSAA-008 Requirement Ledger](<records/JAN-CSAA-008 - Requirement Ledger.md>). The linked controlled successor, not this Draft's embedded initial-publication state table, controls current author-side ledger and objective-verification state

**Companion enforced artifacts:** None

**Executable state:** `SPECIFIED_IN_DOCUMENTATION / NOT_AUTHORED_AS_CODE / NOT_EXECUTED`

**Oracle state:** Every inherited `JAN-CSAA-006@0.1.0` expected judgment remains `PROPOSED / NOT_CONFERRED / NOT_EXECUTED`

**Affected reconciliation state:** Exact `JAN-CSAA-003@0.2.0` query semantics, exact `JAN-CSAA-007@1.1.0` wire contracts, and exact `JAN-CSAA-009@0.1.0` operational semantics are consumed by this successor without transfer of ownership. Dedicated conformance-catalog wire records remain allocated to a later executable-contract increment

**Exact historical pre-review evidence:** [`JAN-CSAA-008-LEDGER-001@0.2.3`](<records/archive/JAN-CSAA-008-LEDGER@0.2.3.Closed.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>), 3,971,581 bytes, SHA-256 `3ac616c21f159ea072f83c44079012430decaa2467c00f4d0f5e07c36daab02d`; [`JAN-CSAA-008-VERIFICATION-001@0.2.1`](<records/archive/JAN-CSAA-008-VERIFICATION@0.2.1.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>), 32,424 bytes, SHA-256 `b080e0fc0e62e2bb77501ba29bc665dc434aa8b6c275a7e2c367a599aba08242`; [`JAN-CSAA-008-LEDGER-CLOSURE-INTEGRITY-001@0.2.0`](<records/archive/JAN-CSAA-008-LEDGER-CLOSURE-INTEGRITY@0.2.0.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>), 9,028 bytes, SHA-256 `cc98ed25bf5c25fd2ac05c257551760136d895f77ca26e7b71b56b80613d4e02`; [`JAN-CSAA-W3-TRIPLET-RECONCILIATION-001@0.1.0`](<records/JAN-CSAA-W3 - Wave 3 Exact Triplet Reconciliation and Synchronized Ledger State Record.md>), 22,856 bytes, SHA-256 `6031e1e7d4f7cfca027957a7c4a25c5b28333637e393054bec2403e7663696b7`; [`JAN-CSAA-008-SELF-REVIEW-001@0.1.0`](<records/archive/JAN-CSAA-008-SELF-REVIEW@0.1.0.PRELIMINARY.snapshot>), 17,022 bytes, SHA-256 `4bc970980fbbca956b00e84cc7953d7fe1a6f0154956001e3ccbb05716f35278`; and [`JAN-CSAA-WORKING-STATUS-001@0.10.0`](<records/JAN-CSAA - Working Corpus Authoring Status 010.md>), 14,133 bytes, SHA-256 `56d48fc90cff8d37b5ab151eb1fd2f067d46b7f85ebfe5e0cafd5f0c52dc2531`

**Successor evidence boundary:** Earlier objective records are historical and do not establish query-algebra conformance. In particular, the earlier query-method PASS tested the presence of a typed AST but not the semantics of conjunction or disjunction. This successor contains 1,016 local requirements and requires direct executable truth-table, property, provenance, applicability, short-circuit, and mutation evidence before any query-algebra PASS

**Prepared time:** `2026-08-10T14:32:08-04:00`

**Supersedes:** `JAN-CSAA-008@0.2.2 / Draft`; 261,544 bytes; SHA-256 `f4bbe60c8edc67ac70ddf89e7c3963725252c8915dfceefd5e9d46bd70ef082a`. No new archive or process record is created by this implementation-readiness correction; predecessor recovery relies on repository history

**Superseded by:** None

---

## 1. Purpose

This specification converts the adopted semantic and assurance obligations into a testable acceptance contract while preserving the difference between a specification and an execution. It defines what the later conformance suite must test, how every test is identified and traced, what evidence makes a result eligible, how the suite demonstrates that its own controls are effective, and why missing, empty, stale, partial, failed, unsupported, conflicting, mismatched, bypassed, or unexecuted evidence can never become green.

The protected question is:

> What exact executable tests, independent oracle conditions, negative controls, mutation kills, differential comparisons, subject bindings, evidence checks, and result-eligibility predicates are required before an analyzer result may be represented as conformant for one declared scope?

The answer is deliberately bounded. Conformance can support a claim only for the exact subject, capability, provider or implementation, configuration, artifact set, fixture, conferred oracle, and execution recorded by the test result. It does not prove arbitrary implementation correctness, confer assurance authority, approve a change, or create a gate transition.

## 2. Concern ownership and exclusions

`JAN-CSAA-008` owns analyzer-conformance and V&V method. It does not own the meanings it tests. `JAN-CSAA-002` owns semantic objects, relations, invariants, truth, and epistemic state; `JAN-CSAA-003` owns capabilities, queries, slices, comparisons, deltas, and impact; `JAN-CSAA-004` owns rules, results, findings, treatments, provider obligations, and gate semantics; `JAN-CSAA-005` owns dated JPWB description; `JAN-CSAA-006` owns fixture-case and proposed expected-judgment strategy; and `JAN-CSAA-007` owns candidate serialization and adapter shape.

Operational persistence, publication, invalidation, recovery, and isolation semantics remain with `JAN-CSAA-009`. Coding-agent employment semantics remain with `JAN-CSAA-010`. Concrete provider selection, qualification, licensing, installation, configuration, and removal remain with `JAN-CSAA-011`. Canon retains professional assurance, decision, waiver, baseline, and governance meaning.

This Draft may specialize each concern into an executable test obligation only by reference. It shall not silently redefine a semantic value, add authority to a derived result, select a physical test runner or storage topology, or overload an existing `JAN-CSAA-007` record with a new meaning.

## 3. Exact source baseline and lifecycle evidence

### 3.1 Controlled semantic inputs
| Exact input | Identity | Standing in this Draft |
| --- | --- | --- |
| [JAN-CSAA-000@0.3.0](<README.md>) | 102,164 bytes; SHA-256 `833b97d9fe12ae5e245b6c2920216ec3271e59f68dc24c54d0efd9a1efdf32a1` | Adopted program authority; reserved filename and §10.8 commission |
| [JAN-CSAA-001@0.3.0](<JAN-CSAA-001 - Codebase Semantic Analysis and Assurance Architecture.md>) | 109,420 bytes; SHA-256 `cda7defe7fa310f912bceb8b355952e1159bebc05528fc51c310578ede26237b` | Provisional architecture and trust-boundary input |
| [JAN-CSAA-002@0.3.0](<JAN-CSAA-002 - TypeScript Semantic Model and Invariant Catalog.md>) | 162,179 bytes; SHA-256 `9bcaa9f9a2212d66ae7c417af84c4f0e14672d282c04e73d719f7f9cceda1911` | Provisional semantic and invariant input |
| [JAN-CSAA-003@0.2.0](<JAN-CSAA-003 - Analysis Enrichment Query and Change Impact Specification.md>) | 186,716 bytes; SHA-256 `7112228c65a8f36953bc24b56fbc434aaab09f26fad7817ea44dc4010f3d7c9e` | Provisional capability, exact four-valued query algebra, and impact input |
| [JAN-CSAA-004@0.1.0](<JAN-CSAA-004 - Code Analysis Rule Gate and Analyzer Provider Contract.md>) | 176,071 bytes; SHA-256 `8812dc55c05167223341b08d3d5bc85b8b1e5ad085c9a0e198a13512af69dc89` | Provisional rule, finding, treatment, gate, and provider-obligation input |
| [JAN-CSAA-005@0.3.0](<JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md>) | 119,118 bytes; SHA-256 `3a9f49a492ca0b73cb50413bf694cf90e0608d73d6248db9df7cb45804b80625` | Provisional dated repository-description input |
| [JAN-CSAA-006@0.1.0](<JAN-CSAA-006 - Golden Repository and Change Scenario Fixture.md>) | 138,584 bytes; SHA-256 `7d6804b0198ba19285903f53ac5053971310b0278bd5a6c7f6946e3265814361` | Provisional fixture and non-conferred expected-judgment input |
| [JAN-CSAA-007@1.1.0](<JAN-CSAA-007 - Semantic Snapshot Graph Query Analysis Record and Adapter Contract Package.md>) | 1,349,212 bytes; SHA-256 `60618b2da0b0ee1b103f3d72404d7de4419f69630848a59ff835e8185d6ad49d` | Exact provisional candidate shape, query-expression algebra carrier, operational wire, health, phase-identity, digest-preimage, and adapter-contract input |
| [JAN-CSAA-009@0.1.0](<records/archive/JAN-CSAA-009@0.1.0.Draft.PRE-AFFECTED-008.snapshot>) | 372,913 bytes; SHA-256 `13c61cf36920b4d5cd804a9a0be09e32013b810f12ebd2a09708bb1c1562447d` | Exact historical provisional operational-semantic and required affected-test input under the finite cutoff |

### 3.2 Objective and sequencing evidence
| Evidence | Exact identity | Use |
| --- | --- | --- |
| [JAN-CSAA-W2-SEMANTIC-READINESS-001@0.1.0](<records/JAN-CSAA-W2 - Documentation Semantic Readiness and Wave 3 Entry Record.md>) | 15,435 bytes; SHA-256 `4966e308024fd451bcc7f2378810389fda0d4446e0738f2b9663e4974c46ba18` | Authorizes this documentation-only Draft under explicit provisional constraints |
| [JAN-CSAA-W2-OBJECTIVE-RECONCILIATION-001@0.1.0](<records/JAN-CSAA-W2 - Wave 2 Cross-Package Objective Reconciliation Record.md>) | 13,879 bytes; SHA-256 `755459221a65f9fada7541953bd9aa7ba8976592fdc803801a1838ce1dfef46b` | Wave 2 objective reconciliation only |
| [JAN-CSAA-W2-LEDGER-CLOSURE-INTEGRITY-001@0.1.0](<records/JAN-CSAA-W2 - Synchronized Ledger Closure and Integrity Record.md>) | 12,436 bytes; SHA-256 `5f2f5d095354dc90b4525e9dec84c0f07fefdcd612a6b39c11097bdae6e4f643` | Wave 2 author-side objective closure only |
| [JAN-CSAA-WORKING-STATUS-001@0.9.0](<records/JAN-CSAA - Working Corpus Authoring Status 009.md>) | 11,687 bytes; SHA-256 `b55816d7f897185a80c1ed59f3b7a8a36787fe2a65f111fa896eb00466d2fb51` | Exact pre-Wave-3 preliminary-review state |
| [JAN-CSAA-003-LEDGER-001@0.1.1](<records/JAN-CSAA-003 - Requirement Ledger.md>) | 431,651 bytes; SHA-256 `2046b87e27f8b7e7a553e6d0038b32de04f3be287b93b0ee8db37d99cb3bb8a7` | Closed author-side objective ledger; self-review remains open |
| [JAN-CSAA-003-VERIFICATION-001@0.1.2](<records/JAN-CSAA-003 - Objective Author Verification Record.md>) | 15,156 bytes; SHA-256 `51f31b775b831fa77dba5439f862454450e964f6447e97212512702faab95c96` | Objective documentation verification |
| [JAN-CSAA-004-LEDGER-001@0.1.1](<records/JAN-CSAA-004 - Requirement Ledger.md>) | 498,116 bytes; SHA-256 `368e3c4537d0ceb493df5bb534d992c54cc5a1a6a5798bb5172d63bd6a9cef63` | Closed author-side objective ledger; self-review remains open |
| [JAN-CSAA-004-VERIFICATION-001@0.1.2](<records/JAN-CSAA-004 - Objective Author Verification Record.md>) | 15,019 bytes; SHA-256 `944f15c504f8a78f12ae27d88dfe3e07eee0f377ecb65d075d763c3beb686812` | Objective documentation verification |
| [JAN-CSAA-006-LEDGER-001@0.1.1](<records/JAN-CSAA-006 - Requirement Ledger.md>) | 619,593 bytes; SHA-256 `f389203f91c575ec85acf14250dd3e2a9d897669868281b59cf6732874062fc7` | Closed author-side objective ledger; self-review remains open |
| [JAN-CSAA-006-VERIFICATION-001@0.1.2](<records/JAN-CSAA-006 - Objective Author Verification Record.md>) | 16,592 bytes; SHA-256 `ef129375fad100e64ab5569469d9e2ac6cf29017bb7cb1e07c578dac20eb81cb` | Objective documentation verification |
| [JAN-CSAA-007-LEDGER-001@1.0.1](<records/archive/JAN-CSAA-007-LEDGER@1.0.1.Closed.PRE-W3-TRIPLET-RECONCILIATION.snapshot>) | 3,217,506 bytes; SHA-256 `54f21dd4e25a1f447627e4f3fd8355480a4d76f759cdae64b48d407782b536fb` | Exact historical affected 007 closed ledger and 637-row local-source registry |
| [JAN-CSAA-007-VERIFICATION-001@0.2.0](<records/archive/JAN-CSAA-007-VERIFICATION@0.2.0.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>) | 17,264 bytes; SHA-256 `49fe0cc99332daf9be61583e0eb5e720243b8d7d34c1b317e3b5a6cb5cd5618e` | Exact historical 007 affected-source objective documentation verification |
| [JAN-CSAA-007-LEDGER-CLOSURE-INTEGRITY-001@0.2.0](<records/archive/JAN-CSAA-007-LEDGER-CLOSURE-INTEGRITY@0.2.0.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>) | 8,054 bytes; SHA-256 `07d0c90a67f83d74fbb6982b16dab1d8a624b5119ce7db145cad693ef12d946d` | Noncircular exact historical 007 closed-ledger integrity evidence |
| [JAN-CSAA-009-LEDGER-001@0.1.1](<records/archive/JAN-CSAA-009-LEDGER@0.1.1.Closed.PRE-AFFECTED-008.snapshot>) | 2,861,853 bytes; SHA-256 `31b9232f012df5950cb0ce3851e1b2e84cd71a237477b88c93aaed8b741f36ec` | Exact historical closed 009 requirement source and 1,100-row registry under the finite cutoff |
| [JAN-CSAA-009-VERIFICATION-001@0.1.0](<records/archive/JAN-CSAA-009-VERIFICATION@0.1.0.PRE-AFFECTED-008.snapshot>) | 23,690 bytes; SHA-256 `87da6aa9dbdd19b7621f4f6f8cfa6eea268620d17df11d2296b19c225aa0b1a5` | Exact historical 009 objective documentation verification |
| [JAN-CSAA-009-LEDGER-CLOSURE-INTEGRITY-001@0.1.0](<records/archive/JAN-CSAA-009-LEDGER-CLOSURE-INTEGRITY@0.1.0.PRE-AFFECTED-008.snapshot>) | 12,471 bytes; SHA-256 `bc39fd4c20cca59f78b2e8931734fa1211b8a645f6bb72e6d622887e2da4ff18` | Noncircular exact historical 009 closed-ledger integrity evidence |
| [JAN-CSAA-008@0.1.1 archive](<records/archive/JAN-CSAA-008@0.1.1.Draft.PRE-AFFECTED-009.snapshot>) | 206,705 bytes; SHA-256 `a15488930e16769d3ed63d1ca8e9f89c0531b4e43c1b80065a9a0d034e345663` | Immutable predecessor subject |
| [JAN-CSAA-008 predecessor closed-ledger archive](<records/archive/JAN-CSAA-008-LEDGER@0.1.4.Closed.PRE-AFFECTED-009.snapshot>) | 2,010,342 bytes; SHA-256 `da450aa690022d7aaf3ba84440dff9921c2fa6733d98c45338a687add876085a` | Exact predecessor allocation and lifecycle evidence |

The affected successor carries exactly 2,568 unaffected inherited rows, consumes all 652 local rows from exact current `JAN-CSAA-007@1.1.0` and all 1,100 local rows from exact historical `JAN-CSAA-009@0.1.0` under the finite cutoff, and replaces rather than silently reuses the superseded 007 and predecessor-local populations. Earlier ledgers and objective records remain historical and do not confer a current result. The exact current 003 and 007 sources, exact historical 009 intake, byte counts, SHA-256 digests, controlled identities, and semantic invariants are the authoring evidence surface. A final implementation refresh and executable conformance run remain mandatory before a current implementation claim.

### 3.3 Mandatory provisional constraints

1. The ordered labels `F01` through `F28`, not punctuation splitting, define the exact Capability Profile facet boundaries in `JAN-CSAA-003@0.2.0`.
2. A negative test shall reject a missing, duplicate, reordered, or ambiguously parsed capability-facet label without representing that test specification as resolution of `JAN-CSAA-003-SR-002`.
3. Every inherited `JAN-CSAA-006` expected judgment remains proposed, non-conferred, and non-executed. It may define a planned case but cannot make an execution pass.
4. All seventeen Analysis Rule Profiles retain `UNASSIGNED` binding authority and both definitive and interim ARP transition carriers retain `N/A — no instantiated RGP or protected transition`; all twelve Repository Gate Templates remain `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no Repository Gate Profile exists.
5. Provider disagreement, raw provenance, limitations, failure, timeout, unsupported, partial, conflict, and stale state remain visible and non-green.
6. Recovery, persistence, publication, cache, concurrency, migration, retention, health, and operational tests bind exact `JAN-CSAA-009@0.1.0` semantics and exact `JAN-CSAA-007@1.1.0` representations; every physical case remains unexecuted.
7. Agent-trajectory tests remain abstract allocations pending `JAN-CSAA-010`; concrete provider qualification tests remain abstract allocations pending `JAN-CSAA-011`.
8. Candidate machine shapes in `JAN-CSAA-007@1.1.0` are documentation, not enforced schemas or generated types. Their executable validation requires implemented artifacts and tests.
9. The exact 31 operational roles, 37-row/40-name identity registry, P01–P12 projections, H01–H14 dimensions, 77 typed errors, and six phase/digest cases are closed test populations; their presence in documentation is not execution.
10. This Draft creates no executable file, physical fixture, test runner, provider invocation, failure injection, database, service, topology, gate, or result.

## 4. Foundational non-equivalences
| Left concept | Prohibited equivalence | Required treatment |
| --- | --- | --- |
| Test specification | Executable test | A specification defines a future obligation; only separately authorized code can execute it |
| Test execution | Passing conformance | Execution can fail eligibility through subject, oracle, health, coverage, or evidence defects |
| Proposed expected judgment | Admissible oracle | Only exact independently conferred current judgment can support a green semantic comparison |
| Passing assertion | Conformant analyzer | All required cases, partitions, stages, negative controls, and eligibility predicates must close |
| Empty result | Supported absence | Population, closure, health, and non-vacuity controls must establish that emptiness is meaningful |
| High coverage percentage | Behavior preservation | Coverage is an observation over an exact denominator and cannot replace a governed behavior oracle |
| Provider agreement | Truth | Agreement can corroborate but does not confer semantic authority |
| Provider disagreement | Test failure to hide | The conflict and both raw lineages remain visible; a policy may route but not erase them |
| Incremental/full matching counts or hashes | Semantic equivalence | All eight comparison dimensions must be evaluated over exact populations |
| Health | Correctness or qualification | Health dimensions are prerequisites and observations, not semantic truth or provider qualification |
| RGT reference | Repository Gate Profile | An inert template cannot be instantiated, evaluated, or used for transition effect |
| Negative test case | Permission or safety | A bounded countercase demonstrates only the exact declared technical condition |
| Dated JPWB result | Current repository truth | The result remains bound to its exact cutoff and observation window |
| Mutation score | Suite adequacy by itself | Critical obligations require exact applicable mutant kills and surviving-mutant analysis |
| Deterministic repeat | Correctness | Reproducibility is necessary where required but can reproduce a wrong result |
| Conformance evidence | Canonical assurance decision | Canonical admissibility and decision remain outside CSAA technical records |

## 5. Conformance package topology

A later executable realization shall separate definition, execution, result, and assurance use:

```text
governing requirements and semantic invariants
    → conformance test-catalog definition
    → independently governed fixture and conferred oracle
    → exact executable test artifact and harness identity
    → exact subject/provider/configuration/environment binding
    → run, attempt, assertion, raw evidence, diagnostics, and health
    → evidence-eligibility derivation
    → bounded technical conformance disposition
    → separately governed assurance or gate consumption, if any
```

The following logical artifacts are distinct:

| Logical artifact | Owner of meaning | Required role |
| --- | --- | --- |
| `ConformanceCatalogDefinition` | `JAN-CSAA-008` | Versioned manifest of every required test obligation and closed coverage coordinate |
| `ConformanceTestSpecification` | `JAN-CSAA-008` | One immutable 24-facet test definition |
| `ConformanceCaseDefinition` | `JAN-CSAA-008` for case and test-method structure only | One fully bound case, parameter partition, negative control, mutation, or fault; the cited semantic document retains ownership of tested meaning and the independent oracle authority retains judgment standing and conferral |
| Test source, runner configuration, and executable harness | Later implementation authority | Physical realization with content identities |
| `TestRunRecord`, `TestAttemptRecord`, `TestResultRecord`, and `AssertionOutcomeRecord` | Candidate shape in `JAN-CSAA-007` | Execution observations; never the test-specification authority |
| `ConformanceEligibilityAssessment` | `JAN-CSAA-008` | Mechanical derivation of whether exact execution evidence can support a bounded result |
| Provider qualification record | `JAN-CSAA-011` | Concrete provider standing; not created by conformance alone |
| Canonical Assurance Policy, Assessment, Evidence, Observation, Decision, waiver, or Baseline | Canon owner | Separate admissibility and decision surface |

The ownership column never creates joint ownership of one concern. `JAN-CSAA-008` controls conformance case structure and method; the cited semantic document controls the meaning under test; the independently authorized oracle owner controls judgment standing and conferral. A case binds these three distinct references without allowing any one to overwrite another.

`JAN-CSAA-007@1.1.0` defines the exact affected wire family consumed by this specification but still does not define explicit wire records for `ConformanceCatalogDefinition`, `ConformanceTestSpecification`, `ConformanceCaseDefinition`, or `ConformanceEligibilityAssessment`. This Draft owns their conformance semantics and allocates any future serialization to an executable-contract increment. Existing source-level `TestRecord`, operational records, and execution-result records shall not be silently overloaded.

## 6. Twenty-four-facet conformance test specification

Every `ConformanceTestSpecification` resolves exactly one value for each ordered facet `T01` through `T24`. Missing, blank, silently defaulted, duplicate, reordered, or merged facets are invalid. An inapplicable facet carries an exact reasoned not-applicable value.
| Facet | Required meaning |
| --- | --- |
| `T01` | Permanent test ID, semantic version, immutable definition identity, predecessor, lifecycle |
| `T02` | Test-family ID, case kind, execution lane, and catalog coordinates |
| `T03` | Protected technical claim, source-derived applicability and criticality, governing owner/version, and explicit non-authority boundary |
| `T04` | Exact governing requirement, invariant, rule, contract, and concern-owner references |
| `T05` | Candidate or enforced schema, generated artifact, adapter, harness, and implementation identities |
| `T06` | Fixture Manifest, Scenario Profile, expected judgment, oracle state, and independent-review references |
| `T07` | Exact repository, revision, worktree, snapshot, change set, and before/after subject bindings |
| `T08` | Project, compiler, resolver, framework, generator, build, instrumentation, and variant contexts |
| `T09` | Provider, adapter, capability, method, rule set, model, database/feed, configuration, and qualification coordinates |
| `T10` | Runtime, platform, environment, sandbox, information-control, authorization, and isolation context |
| `T11` | Required preconditions and explicit precondition-failure outcome |
| `T12` | Setup, immutable initial state, reset, seed, clock, randomness, and isolation procedure |
| `T13` | Exact action, stimulus, query, mutation, fault, schedule, or agent trajectory |
| `T14` | Input population, denominator, partitions, include/exclude rules, bounds, and closure basis |
| `T15` | Expected semantic objects, relations, results, truth projection, epistemic state, witnesses, and frontiers |
| `T16` | Expected raw evidence, normalized evidence, diagnostics, explanations, and retained disagreement |
| `T17` | Expected health, freshness, completeness, partiality, conflict, and result-eligibility states |
| `T18` | Positive control, negative control, non-vacuity sentinel, and false-green prevention |
| `T19` | Determinism, ordering, repeat, replay, seed, clock, concurrency, and allowed-difference policy |
| `T20` | Performance and resource budget reference, measurement method, environment, and refusal behavior |
| `T21` | Threat treatment, path/process/network/secret controls, redaction, retention, and non-disclosure expectations |
| `T22` | Cleanup, reset, cancellation, recovery, residual-state checks, and last-known-good treatment |
| `T23` | Failure meaning, affected claim, severity, routing owner, stop condition, and remediation evidence |
| `T24` | Source-to-spec-to-case trace, result lineage, invalidation dependencies, supersession, and later-owner allocation |

Applicability and criticality are governed inputs, not implementer-selected conveniences. Each classification derives from an exact governing requirement, invariant, rule, contract, or semantic-owner policy; binds its owner, version, rationale, and review evidence; and remains immutable for one case-definition version. `unknown`, `unassigned`, unreviewed, stale, or owner-incompatible classification is non-green. An implementation author, provider author, test author, executor, or result renderer cannot downgrade applicability or criticality. A reasoned `not-applicable` value is valid only when the exact owner permits it, and it cannot discharge an unconditional mandatory coordinate. Any classification change invalidates affected specifications, selections, results, coverage, and eligibility assessments and requires a reviewed successor.

### 6.1 Stable identity grammar

Permanent identifiers use these logical forms:

```text
JAN-CSAA-008-CATALOG-<semantic-version>
JAN-CSAA-008-TF-<three-digit-family>
JAN-CSAA-008-TS-<family-token>-<permanent-ordinal>@<semantic-version>
JAN-CSAA-008-TC-<family-token>-<closed-coordinate>@<semantic-version>
JAN-CSAA-008-RUN-<content-bound-run-coordinate>
```

`family-token` and every `closed-coordinate` are drawn only from the registries in this specification and the exact cited predecessor registries. Display names, file paths, test-runner names, array order, or provider-native IDs never substitute for permanent identity. Retirement preserves the ID as a tombstone and creates a successor; an ID is never reused for another meaning.

One case definition may be physically parameterized only when every parameter value has a stable closed coordinate and the run reports each coordinate independently. A single aggregated pass cannot hide a failed, missing, skipped, unsupported, or unexecuted member.

### 6.2 Case kinds

| Kind | Required purpose |
| --- | --- |
| `positive` | Demonstrate the exact supported condition against an admissible oracle |
| `negative` | Demonstrate rejection or bounded negative semantics without treating failure as success |
| `boundary` | Exercise minimum, maximum, empty-allowed, cardinality, budget, and closure edges |
| `invalid` | Demonstrate inert rejection of malformed or semantically invalid material |
| `metamorphic` | Compare source and transformed cases under one declared relation |
| `property` | Quantify a property over generated cases, retained seeds, and shrink lineage |
| `subject-mutation` | Introduce one controlled target defect or change in the analyzed subject |
| `harness-mutation` | Corrupt one suite, assertion, oracle, eligibility, or reporting control and require a kill |
| `differential` | Compare overlapping providers without majority-vote truth creation |
| `incremental-equivalence` | Compare incremental and clean-full outcomes over all eight dimensions |
| `hostile` | Exercise repository, path, process, network, secret, parser, or resource attack classes |
| `fault-recovery` | Inject interruption, corruption, concurrency, or restart behavior under later operational semantics |
| `performance` | Measure an exact workload against an owner-supplied budget |
| `trajectory` | Exercise coding-agent invocation, evidence use, stopping, escalation, and no-self-approval |
| `non-vacuity` | Prove required populations, assertions, rules, variants, and results cannot disappear and still pass |

## 7. Closed test-family registry

The test family is the top-level catalog partition. Every applicable inherited requirement maps to at least one family and at least one stable case coordinate. Family membership does not replace requirement-level traceability.
| Family ID / token | Surface | Minimum controlled population |
| --- | --- | --- |
| `JAN-CSAA-008-TF-001` / `PKG` | Package and schema-source conformance | 19 future schema sources; meta-schema, dependency DAG, closed fields, recursion and entry-point rules |
| `JAN-CSAA-008-TF-002` / `GEN` | Generated derivative fidelity | 5 generated derivatives; deterministic regeneration and schema/type/validator/registry/export parity |
| `JAN-CSAA-008-TF-003` / `COM` | Common identity, digest, reference, envelope, collection, and finalization | All registered common projections, typed references, envelope assignments, collection keys, and acyclic finalization |
| `JAN-CSAA-008-TF-004` / `SUB` | Subject, snapshot, change, publication, freshness, and invalidation | Exact subject identity, mixed-revision rejection, publication completeness, currentness and invalidation |
| `JAN-CSAA-008-TF-005` / `ART` | Artifact, origin, build, instrumentation, and source mapping | Authored/generated/virtual/declaration roles, complete provenance chain, bidirectional mapping, build and execution identities |
| `JAN-CSAA-008-TF-006` / `OBJ` | Semantic object variants | 127 exact object variants, profile assignments, required fields, subject policies, discriminators |
| `JAN-CSAA-008-TF-007` / `REL` | Semantic relation variants and graph closure | 137 exact relation variants, endpoint roles/cardinalities, metadata, graph node/edge closure |
| `JAN-CSAA-008-TF-008` / `INV` | Semantic invariants and cross-graph identity | `INV-001` through `INV-014` plus 9 graph layers × 3 case modes, positive and hostile invalid cases |
| `JAN-CSAA-008-TF-009` / `CAP` | Capability profiles and dependency plan | 32 profiles × 28 ordered facets, 896 cells, dependency DAG, prerequisites, support and limitation truth |
| `JAN-CSAA-008-TF-010` / `QRY` | Query, slice, comparison, delta, impact, and reachability | Full-AST expression budgets; exhaustive four-valued evidence-pair algebra; N/A and evaluation-disposition separation; node-total explanation; lawful short-circuiting; paging, witnesses/frontiers, and 12 entry mechanisms |
| `JAN-CSAA-008-TF-011` / `EXE` | Test, coverage, build, runtime, and trace evidence | Run/attempt/assertion states, denominator and granularity, build/environment/workload/collector/schema binding |
| `JAN-CSAA-008-TF-012` / `RUL` | Rules, application results, findings, and treatments | 17 ARPs, exact N/A carrier state, non-bypassability, five-dimensional result state, immutable evidence and treatment history |
| `JAN-CSAA-008-TF-013` / `GAT` | Gate-template inertness and misuse rejection | 12 inert RGTs × 2 modes = 24 cells; zero invented RGPs or transition effects |
| `JAN-CSAA-008-TF-014` / `ORC` | Fixture, scenario, expected judgment, oracle, and coverage matrices | 30 facets; 20 families/40 cases; 9 ZSC; 256 CAP, 187 ARP, and 24 RGT cells |
| `JAN-CSAA-008-TF-015` / `PRP` | Property and metamorphic conformance | Closed 30-relation metamorphic registry; generator/shrinker/replay and applicability controls |
| `JAN-CSAA-008-TF-016` / `MUT` | Subject mutation, harness mutation, and tests-of-tests | 18 inherited subject-mutation classes plus 43 closed suite-mutation operators and critical kills |
| `JAN-CSAA-008-TF-017` / `DIF` | Provider-adapter contract and differential behavior | Mapping fidelity, raw/model lineage, health, loss, disagreement, substitution and removal |
| `JAN-CSAA-008-TF-018` / `INC` | Incremental invalidation, dependency-observation, cache correctness, and clean-full equivalence | 18 mutation classes and all 8 equivalence dimensions; resolved-dependency, lockfile-delta, advisory-correlation, vulnerability-observation, cold/warm, and cache-poison controls |
| `JAN-CSAA-008-TF-019` / `OPS` | Logical operations, errors, partiality, cancellation, and response envelopes | 17 valid operation-policy pairs, 272 invalid cross-pairs, 77 typed errors, V01–V07, success-empty and non-disclosure cases |
| `JAN-CSAA-008-TF-020` / `CMP` | Compatibility, versioning, unknown fields, deprecation, and migration | Compatible/incompatible/unknown claims, maps, unknown-field behavior, logical migration |
| `JAN-CSAA-008-TF-021` / `SEC` | Hostile repository and analyzer security | Path, process, network, secret, parser, output, cache, race, sandbox, resource, and redaction classes |
| `JAN-CSAA-008-TF-022` / `DEG` | Degradation, fault, recovery, and containment | 20 degradation classes × 8 surfaces, 16 exact topology-neutral recovery coordinates, publication/currentness, and last-known-good obligations bound to exact 009 |
| `JAN-CSAA-008-TF-023` / `REP` | Deterministic replay and reproducibility | Content-bound inputs, seeds, clocks, ordering, raw retention, repeat and cross-environment classification |
| `JAN-CSAA-008-TF-024` / `PER` | Performance and resource budgets | Cold/warm indexing, incremental work, query, memory, CPU, disk, I/O, output, timeout and refusal |
| `JAN-CSAA-008-TF-025` / `DAT` | Dated JPWB observation conformance | Exact cutoff, supply-chain lane, selected realistic concerns, final-refresh rebinding, no floating currentness |
| `JAN-CSAA-008-TF-026` / `AGT` | Coding-agent trajectory | Mandatory analysis use, exact subject, evidence citation, stop/escalate, no bypass or self-approval pending 010 |
| `JAN-CSAA-008-TF-027` / `NFG` | Cross-cutting no-false-green | Required-population sentinels, eligibility lattice, false empty, stale/mixed/partial/failed/conflicting/unexecuted rejection |

## 8. Evidence-priority and authority ordering

Every later suite and every result report preserves this order:

```text
semantic invariants
    → independent golden fixture
    → executable conformance and mutation oracles
    → provider differential evidence
    → incremental/full equivalence
    → agent employment and no-false-green behavior
    → operational recovery and degraded modes
```

Implementation convenience never outranks an executable capability-conformance oracle. A fixture never outranks its governing semantic invariant. A provider result never outranks independently governed expectation. A green presentation never outranks the eligibility evidence from which it is derived.

## 9. Result model and no-false-green eligibility

### 9.1 Independent state axes

One run retains independent axes rather than collapsing them into a Boolean:

| Axis | Exact minimum values |
| --- | --- |
| Specification validity | `valid`, `invalid`, `superseded`, `unknown` |
| Artifact availability | `available`, `missing`, `incompatible`, `not-authorized` |
| Oracle admissibility | `conferred-current`, `proposed`, `not-conferred`, `divergent`, `revoked`, `stale`, `not-applicable`, `missing` |
| Subject compatibility | `exact-match`, `mixed-revision`, `mismatch`, `stale`, `unresolved` |
| Execution | `not-run`, `running`, `completed`, `interrupted`, `cancelled`, `timed-out`, `resource-refused`, `errored` |
| Harness health | `healthy`, `degraded`, `failed`, `unknown`, `not-checked` |
| Provider/adapter health | exact independent `JAN-CSAA-007` provider-execution, contract, resource, and security-boundary dimensions |
| Operational health and readiness | exact H01–H14 observations, each independently scoped and evidenced, plus the closed health-view binding branch |
| Population closure | `closed-complete`, `bounded-partial`, `open`, `unsupported`, `missing`, `unknown` |
| Assertion outcome | `passed`, `failed`, `errored`, `timed-out`, `cancelled`, `skipped-by-declared-policy`, `not-run`, `unknown` |
| Evidence freshness | `current`, `stale`, `invalidated`, `mixed`, `unknown` |
| Differential state | `agree-supported`, `agree-bounded-negative`, `agree-wrong`, `disagree`, `one-sided-supported`, `one-sided-partial-or-stale`, `one-sided-failure`, `both-failed-or-unavailable`, `incompatible-basis`, `not-applicable` |
| Conformance disposition | `conformant-for-declared-scope`, `nonconformant`, `inconclusive`, `unsupported`, `partial`, `conflicting`, `stale`, `invalid-test`, `not-run` |

The following admission table is closed for green derivation:

| Axis | Green-admissible state | Mandatory blocking treatment |
| --- | --- | --- |
| Specification validity | `valid` under the current exact specification identity | `invalid`, `superseded`, or `unknown` adds `invalid-test`; a stale identity is handled by evidence freshness |
| Artifact availability | `available` plus exact content, compatibility, and authorization predicates | `missing` adds `unsupported`; `incompatible` adds `invalid-test`; `not-authorized` adds `unsupported` |
| Oracle admissibility | `conferred-current` for every used semantic judgment; source-governed `not-applicable` only for a genuinely non-oracle coordinate | `proposed`, `not-conferred`, or `missing` adds `invalid-test`; `divergent` adds `conflicting`; `revoked` or `stale` adds `stale`; unauthorized `not-applicable` adds `invalid-test` |
| Subject compatibility | `exact-match` | `mixed-revision` or `mismatch` adds `invalid-test`; `stale` adds `stale`; `unresolved` adds `inconclusive` |
| Execution | `completed` | `not-run` or `running` adds `not-run`; `interrupted`, `cancelled`, `timed-out`, `resource-refused`, or `errored` adds `inconclusive` |
| Harness health | `healthy` | `degraded` adds `partial`; `failed` adds `invalid-test`; `unknown` or `not-checked` adds `inconclusive` |
| Provider/adapter health | `operationalHealth=healthy`; `contractHealth=compatible`; `resourceHealth=within-budget`; `securityBoundaryHealth=within-declared-boundary` | every other exact value maps through the total table below; a missing applicable observation or dimension adds `inconclusive` |
| Operational health and readiness | every applicable H01–H14 observation is present, exact-scope, current at its cutoff, source-supported, and in the source-owned admissible standing; H11 is reasoned `not-applicable` while no effective RGP exists | missing, unknown, unobserved, stale, mismatched, withheld-without-eligible-basis, nonadmissible, or fabricated aggregate standing adds at least `inconclusive` and any stronger applicable blocking reason |
| Population closure | `closed-complete` | `bounded-partial` adds `partial`; `unsupported` adds `unsupported`; `open`, `missing`, or `unknown` adds `inconclusive` |
| Assertion outcome | `passed` for a nonempty applicable population | `failed` adds `nonconformant`; `skipped-by-declared-policy` or `not-run` adds `not-run`; `errored`, `timed-out`, `cancelled`, or `unknown` adds `inconclusive` |
| Evidence freshness | `current` for the exact subject and all applicable invalidation dependencies | `stale`, `invalidated`, or `mixed` adds `stale`; `unknown` adds `inconclusive` |
| Differential state | `agree-supported` or `agree-bounded-negative` when required; exact source-justified `not-applicable` only when comparison is not required | `agree-wrong` adds `nonconformant`; `disagree` adds `conflicting`; `one-sided-supported` or `both-failed-or-unavailable` adds `unsupported`; `one-sided-partial-or-stale` adds `partial` while the independent freshness axis adds `stale` when applicable; `one-sided-failure` adds `inconclusive`; `incompatible-basis` adds `invalid-test` |

The exact `JAN-CSAA-007` provider/adapter-health values map totally:

| Health dimension | Exact value | Blocking reason added |
| --- | --- | --- |
| `operationalHealth` | `healthy` | none |
| `operationalHealth` | `degraded` | `partial` |
| `operationalHealth` | `unavailable` | `unsupported` |
| `operationalHealth` | `failed`, `unknown`, or `not-checked` | `inconclusive` |
| `contractHealth` | `compatible` | none |
| `contractHealth` | `incompatible` | `invalid-test` |
| `contractHealth` | `unknown` or `not-checked` | `inconclusive` |
| `resourceHealth` | `within-budget` | none |
| `resourceHealth` | `degraded` | `partial` |
| `resourceHealth` | `exhausted` | `unsupported` |
| `resourceHealth` | `unknown` or `not-checked` | `inconclusive` |
| `securityBoundaryHealth` | `within-declared-boundary` | none |
| `securityBoundaryHealth` | `violation-observed` | `nonconformant` |
| `securityBoundaryHealth` | `unknown` or `not-checked` | `inconclusive` |

No synonym, provider-native label, generic `insecure`/`unchecked` state, or aggregate `healthy` Boolean may enter this mapping. H01–H14 remain independent; liveness does not imply readiness, provider availability does not imply semantic completeness, freshness does not imply correctness, and health never implies authority. A later successor may change the table only through exact affected owner reconciliation.

`ConformanceEligibilityAssessment` retains the complete set of every triggered blocking reason. The presentation-primary disposition uses this fixed precedence only for display: `invalid-test` → `not-run` → `stale` → `unsupported` → `partial` → `conflicting` → `nonconformant` → `inconclusive`. Precedence never deletes a lower-priority reason or any independent axis. The blocking set is empty only for `conformant-for-declared-scope`; any nonempty blocking set is non-green.

### 9.2 Sole green derivation

`conformant-for-declared-scope` is permitted only when all of the following are true for the same exact case-set identity:

1. every applicable specification is valid and current;
2. every required executable artifact is present, content-bound, compatible, and authorized;
3. every judgment-grain oracle used for expected semantics is independently conferred and current;
4. the subject, revision, build, environment, provider, adapter, configuration, method, model, database/feed, and fixture coordinates match exactly;
5. every mandatory case and partition was selected and completed;
6. no mandatory case was skipped, cancelled, timed out, resource-refused, errored, missing, stale, unsupported, partial, or unresolved;
7. every required validation stage passed;
8. every applicable assertion passed and the assertion population is nonempty;
9. required positive, negative, boundary, invalid, and non-vacuity controls all executed;
10. every critical applicable harness mutant was killed and every surviving mutant was dispositioned as a nonpass;
11. harness health is `healthy`;
12. every applicable provider and adapter health dimension is in its exact owner-defined eligible healthy state;
13. evidence freshness is `current` for the exact subject and every applicable invalidation dependency;
14. when differential comparison is required, its state is `agree-supported` or `agree-bounded-negative` and every compared output is independently eligible;
15. when differential comparison is genuinely not required, `not-applicable` carries exact rationale and does not discharge any required differential coverage;
16. provider disagreement, raw provenance, loss, limitations, and health remain visible;
17. all required populations and denominators are closed for the claimed scope;
18. incremental/full equivalence is demonstrated in every required dimension when incrementality is claimed;
19. security, authorization, redaction, isolation, and non-disclosure predicates passed;
20. no unresolved blocker or critical conformance defect affects the claim; and
21. every applicable H01–H14 observation and health-view binding branch is exact, current, source-supported, independently admissible, and non-collapsed;
22. every operational publication, read, cache, recovery, migration, retention, and replay predicate affecting the claim has an exact eligible result; and
23. the result is mechanically derived and bound to the complete evidence manifest.

Failure of any predicate yields the complete set of triggered blocking reasons, the deterministic presentation-primary disposition above, and every independent axis. A presentation layer may summarize but cannot coerce, suppress, average, relabel, or discard a blocking reason.

### 9.3 Required non-vacuity sentinels

A suite shall fail closed when any required registry, schema source, generated derivative, object variant, relation variant, invariant, capability facet, fixture case, oracle, matrix cell, ARP, RGT, operation, error, assertion, provider comparison, incremental dimension, hostile class, mutation operator, or trajectory case is absent. All-selected-skipped, zero assertions, zero findings where a planted defect requires one, empty graph, empty rule registry, empty provider output, missing raw evidence, or a harness that returns success without invoking the subject are explicit kill targets.

## 10. Schema-package and generated-derivative conformance

### 10.1 Nineteen schema-source coordinates

The `PKG` family binds the exact `SCHEMA-INDEX`, `SCHEMA-PACKAGE`, `SCHEMA-COMMON`, `SCHEMA-SUBJECT`, `SCHEMA-ARTIFACT`, `SCHEMA-SEMANTIC`, `SCHEMA-RELATION`, `SCHEMA-GRAPH`, `SCHEMA-ANALYSIS`, `SCHEMA-QUERY`, `SCHEMA-EXECUTION`, `SCHEMA-RULE`, `SCHEMA-ORACLE`, `SCHEMA-API`, `SCHEMA-DIAGNOSTIC`, `SCHEMA-COMPATIBILITY`, `SCHEMA-ADAPTER`, `SCHEMA-SECURITY`, and `SCHEMA-OPERATIONS` identities from `JAN-CSAA-007@1.1.0` §6.3. All currently remain `NOT_CREATED / NOT_ENFORCED`.

For every applicable schema, later tests shall cover:

- exact Draft 2020-12 meta-schema validity and stable `$id`;
- declared package version, individual contract version, dependency, and lifecycle;
- accepted minimal, accepted populated, and boundary-valid instances;
- missing required fields, extra closed fields, invalid discriminators, invalid enum members, wrong types, invalid cardinalities, invalid formats, and invalid bounds;
- typed digest purpose, identity projection, reference target, subject/scope policy, envelope, collection ordering/key, and finalization-direction parity;
- known-extension and unknown-field policy without open-core leakage;
- invalid local recursion that exceeds the registered bound;
- inter-file dependency-cycle rejection;
- package index entry-point behavior and its non-self-hashing rule; and
- a case proving that prose examples cannot override an enforced source.

The package-level case population includes all nineteen sources even when a check is performed once at the package root. A package pass cannot hide one omitted file.

### 10.2 Five generated derivatives

The `GEN` family binds `GEN-TYPES`, `GEN-IDS`, `GEN-VALIDATORS`, `GEN-MANIFEST`, and `GEN-INDEX` from `JAN-CSAA-007` §6.4. Each remains `NOT_GENERATED / NOT_VERIFIED`.

Later generation tests shall bind the exact schema-source digests, generator implementation digest and version, generator configuration, invocation, environment, output digests, and export manifest. Two clean generations from identical content-bound inputs shall be byte-identical where the generated contract declares deterministic output. The suite shall compare every registered discriminator, enum, required/optional field, cardinality, reference type, identity projection, envelope assignment, collection rule, operation union, error union, and validator branch across schema and generated outputs.

Mutation of one schema source shall either produce the exact affected derivative delta and invalidation set or fail generation visibly. Mutation of a generated output without a source change shall fail fidelity. Hand-edited generated defaults, silent coercions, omitted variants, stale exports, mismatched validators, and a generation manifest that hashes itself are negative cases.

### 10.3 Common identity and finalization

The `COM` family shall test every purpose-specific digest; identity-only, content-bound, material, and opaque reference boundary; all 144 exact legacy envelope assignments plus 32 disjoint operational assignments; collection semantics and canonical keys; null-versus-absence rules; predecessor-only lifecycle; subject/scope assignments; and the combined finalization DAG.

Cycles are tested at three distinct levels: prohibited inter-file schema cycles, prohibited content-finalization cycles, and permitted locally bounded recursive query/expression structures. Passing one level never implies another. A retired reference-registry tombstone cannot become an active consumer and a reverse navigation index cannot become serialized authority.

## 11. Semantic objects, relations, graphs, and invariants

### 11.1 Object and relation populations

The `OBJ` catalog coordinate is the cross-product of the exact 127 permanent object discriminators and these required modes:

```text
valid-minimal
valid-populated
missing-required
wrong-profile-or-envelope
wrong-subject-policy
wrong-discriminator
invalid-reference-or-identity
invalid-collection-or-finalization
```

Applicability may route a mode to a profile-level shared case only when the case manifest names every covered object coordinate and reports each independently. No aggregated pass may conceal an omitted variant.

The `REL` catalog coordinate is the cross-product of the exact 137 permanent relation IDs and:

```text
valid-minimal
valid-populated
endpoint-type-mismatch
endpoint-role-or-order-mismatch
endpoint-cardinality-mismatch
required-metadata-missing
invalid-profile-or-subject
invalid-provenance-or-inference-class
```

Every relation test binds the exact endpoint population, graph kind, revision, profile, inference class, provenance, and applicable invariant set. Graph tests additionally prove that every edge resolves to admitted nodes or an explicitly permitted external descriptor, every layer binds its contributing population, and no graph claims unqualified completeness.

### 11.2 Fourteen invariants

Each `INV-001` through `INV-014` has at least one satisfying case, one isolated violating case, one family-representative cross-graph case where applicable, and one harness mutant that disables or inverts the validator and must be killed.

| Invariant | Required negative focus |
| --- | --- |
| `INV-001` | missing exact subject or provenance |
| `INV-002` | cross-revision endpoint without explicit revision |
| `INV-003` | normalized provider fact with raw lineage erased |
| `INV-004` | coverage missing execution artifact, instrumentation, denominator, granularity, or selection/workload |
| `INV-005` | runtime observation missing artifact, schema/collector, environment, workload, or time |
| `INV-006` | transformed coverage/trace attribution without origin mapping |
| `INV-007` | inferred relation mislabeled as compiler-confirmed |
| `INV-008` | completeness claim without exact coverage basis |
| `INV-009` | finding lifecycle that drops prior Engineering Evidence Records |
| `INV-010` | resolved module relation missing importer, specifier, resolver, conditions, or target class |
| `INV-011` | architecture conformance without recognized rule/version/scope or exception state |
| `INV-012` | generated or virtual object labeled authored |
| `INV-013` | static/dynamic correlation across mismatched snapshot identities |
| `INV-014` | currentness asserted while an applicable invalidation dependency is unresolved |

### 11.3 Closed golden graph-layer and provenance coverage

| Layer coordinate | Required positive case | Required controlled negative and incomplete cases |
| --- | --- | --- |
| `GRAPH-AST` | exact AST objects, containment/occurrence relations, source ranges, and provenance | wrong kind/range plus missing subtree or source occurrence |
| `GRAPH-SYMBOL` | exact symbols, declarations, references, resolution witnesses, and provenance | unresolved or wrong binding plus incomplete reference population |
| `GRAPH-TYPE` | exact type identities, constraints/relations, explanation witnesses, and provenance | incompatible or widened/narrowed wrong type plus unsupported/incomplete region |
| `GRAPH-DEPENDENCY` | exact dependency objects, resolved edges, resolver/configuration witnesses, and provenance | wrong target/condition plus unresolved or incomplete closure |
| `GRAPH-CALL` | exact callable objects, call-site/callee edges, dispatch class, witnesses, and provenance | wrong callee/dispatch plus unresolved dynamic target frontier |
| `GRAPH-CFG` | exact blocks, control edges, entry/exit, branch witnesses, and provenance | impossible/missing edge plus incomplete exceptional control |
| `GRAPH-DFG` | exact definition/use/value-flow objects, edges, path witnesses, and provenance | wrong source/sink plus unresolved alias or incomplete path |
| `GRAPH-TAINT` | exact source/sanitizer/sink facts, flow witnesses, rule identity, and provenance | missed or fabricated path plus unsupported/incomplete sanitizer semantics |
| `GRAPH-CPG` | exact cross-layer node/edge projection, witnesses, contributing populations, and provenance | cross-revision/wrong-layer edge plus incomplete contributing layer |

Each of these nine coordinates receives at least one exact positive, one controlled wrong-result negative, and one controlled incomplete/unsupported case: twenty-seven independently reported minimum graph-layer cases. The expected object, relation, witness, source occurrence, subject, profile, provider, raw evidence, and provenance populations are explicit for every case. No graph layer stands in for another or for the universal semantic model.

Authored Svelte or other framework source to generated/virtual TypeScript tests bind the complete provenance chain:

```text
authored source occurrence
    → generator or transformer identity and invocation
    → generated or virtual source occurrence
    → build or execution artifact and source map
    → diagnostic, coverage, runtime, or trace occurrence
    → reverse-resolved authored occurrence
```

Cases verify authored-to-virtual and virtual-to-authored mapping independently. Broken, ambiguous, missing, non-round-tripping, and wrong-artifact maps yield explicit bounded failures and never silently attribute a generated location to authored source.

## 12. Capability, query, slicing, delta, impact, and reachability

### 12.1 Capability profile carrier

The `CAP` structural coordinate set contains exactly `32 × 28 = 896` pairs:

```text
JAN-CSAA-CAP-001/F01 through JAN-CSAA-CAP-032/F28
```

Every pair must resolve exactly once. The conformance parser uses the explicit labels and rejects missing, duplicate, reordered, unknown, concatenated, or ambiguously delimited labels. Semicolon splitting is forbidden. Profile dependency tests reject cycles, missing prerequisites, incompatible versions, and a plan that schedules a dependent capability before its prerequisite. Scheduling order remains distinct from semantic dependency order.

For each capability, semantic cases exercise supported positive, closed-basis negative, unknown, partial, conflicting, stale, dynamic or reasoned not-applicable, and non-vacuity modes through the exact 256-cell `JAN-CSAA-006` matrix. Unsupported or unavailable provider coverage cannot satisfy a required capability.

### 12.2 Query and result semantics

Query tests cover:

- definition/reference/request subject and capability compatibility;
- expression discriminators, type rules, operands, operators, and locally bounded recursion;
- complete normalized-AST validation before evaluation, including every later-skipped branch, for shape plus `ExpressionBudget` depth, nodes, fanout, traversal, path, result, time, and resource refusal;
- truth projection independent from completeness, freshness, support, conflict, and other epistemic dimensions;
- all four negation cases plus the exact sixteen conjunction and sixteen disjunction cells from `JAN-CSAA-003@0.2.0`;
- n-ary fold associativity, commutativity of projected truth, deterministic stored evaluation order, and both De Morgan transformations over every four-valued input pair;
- reasoned not-applicable, excluded, unsupported, and not-evaluated children without Boolean coercion or loss of their owning state, including `NOT(N/A)=N/A`, an all-N/A parent remaining N/A, and the exact `F AND N/A=F`, `T OR N/A=T`, `T AND N/A=U`, `F OR N/A=U`, `C AND N/A=F`, and `C OR N/A=T` cases with conflict retained;
- complete evaluation and decisive short-circuit equivalence for projected truth, with short-circuit permitted only on supported-false conjunction or supported-true disjunction;
- complete-child-evidence, diagnostic-completeness, and provenance-completeness policies that disable short-circuiting and require every applicable child to be evaluated;
- decisive-child, intermediate-truth, skipped-child, conflict, orthogonal-state, and provenance retention in every logical explanation;
- branch-complete verification of the exact support-basis, capability-coverage, execution-health, freshness, conflict, and inference composition algorithms, including both each effective parent value and its ordered child contribution vector;
- deterministic ordering and complete ordering keys;
- cursor identity bound to subject, query, order, page size, and result basis;
- pagination concatenation without duplication, loss, reorder, or cross-revision mixing;
- successful empty only over an executed, supported, healthy, current, closed, non-truncated population;
- explicit partial, unsupported, conflicting, stale, timeout, cancelled, and resource-refused outcomes;
- explanation, witness, raw evidence, limitations, and unresolved frontier retention; and
- query definition and result invalidation after any applicable dependency change.

The algebra suite has independent non-vacuity controls. It SHALL fail if `and` is implemented as `or`, if unknown or conflict is coerced to a Boolean, if not-applicable is used as an identity value, if a decisive result erases conflicting evidence, if short-circuit occurs on any non-decisive state, if a skipped child is represented as evaluated, or if a two-valued implementation passes only the `T/F` subset. Mutation tests SHALL kill each of those defects independently.

### 12.3 Slices, comparisons, deltas, and impact

Forward, backward, and chop slices retain their seeds, direction, relation families, witnesses, frontiers, budgets, and closure basis. Seed expansion may add reachable candidates but shall not remove a previously valid witness under the same compatible basis unless an exact owner-defined allowed-difference policy explains the change.

Comparison and delta tests bind explicit before and after roles, compatible semantic versions, population bases, identity maps, additions, removals, modifications, unresolved matches, conflicts, and direction. Swapping before and after shall invert directional additions/removals and preserve symmetric incompatibility facts; it shall not manufacture compatible comparison.

Impact tests require a witness for every positive affected candidate, preserve direct, transitive, inferred, and runtime paths separately, and retain evidence-needed fields for unresolved candidates. A count-only result or an unexplained candidate set fails.

### 12.4 Twelve entry mechanisms

Every `ReachabilityAssessmentRecord` exercises all twelve registered mechanisms: package/executable; framework; test discovery; dynamic import; dependency injection; event/message/callback/timer/subscription; decorator/metadata; reflection/name lookup; configuration/manifest/script/plugin/extension; generated/virtual source; external API/job/protocol/native; and runtime-observed workload.

`candidate-unreachable-within-closed-surface` is eligible only when every applicable mechanism and entry population is nonempty where required, closed, current, compatible, supported, successfully analyzed, and has no positive entry. Any unregistered observed mechanism, unresolved applicability, open population, unsupported region, analysis failure, stale input, incompatible basis, or positive entry yields `inconclusive` or `reachable` as applicable. No case may output deadness, removal safety, approval, or permission directly.

## 13. Golden fixtures, expected judgments, and coverage matrices

### 13.1 Fixture lanes

The synthetic lane supplies small immutable repositories with controlled changes and reset identities. The dated-JPWB lane supplies exact-cutoff realism. Neither replaces the other. Every physical fixture, when separately authorized, content-binds its exact sources, configurations, generated artifacts, tests, coverage inputs, runtime traces, maps, manifests, lockfiles, scenario definitions, and initial state.

A physical case may not execute green until the judgment grain it uses is independently conferred. Proposed judgments remain useful specifications and red-first targets but produce `oracle-admissibility = proposed` and a nonpass aggregate.

### 13.2 Exact inherited populations

| Surface | Exact required coordinate set | Current state |
| --- | ---: | --- |
| Scenario Profile facets | 30 per profile | `SPECIFIED / NOT_MATERIALIZED` |
| Scenario families | 20 | `DOCUMENTED / NOT_EXECUTED` |
| Paired positive and countercases | 40 | `DOCUMENTED / NOT_EXECUTED` |
| Zero-static-callers cases | 9 | `DOCUMENTED / NOT_EXECUTED` |
| Capability matrix | `32 × 8 = 256` | `PROPOSED / NOT_CONFERRED / NOT_EXECUTED` |
| ARP matrix | `17 × 11 = 187` | `PROPOSED / NOT_CONFERRED / NOT_EXECUTED` |
| RGT inertness matrix | `12 × 2 = 24` | `PROPOSED / NOT_CONFERRED / NOT_EXECUTED` |
| Subject-mutation classes | 18 | `SPECIFIED / NOT_EXECUTED` |
| Degradation classes | 20 | `SPECIFIED / NOT_EXECUTED` |

Every matrix coordinate binds a full Scenario Profile identity and judgment-grain expected result. A requirement-cluster shorthand is not a scenario identity. A missing cell, duplicated coordinate, unexplained not-applicable value, provider-authored expected result, or silently weakened judgment fails oracle and catalog adequacy.

### 13.3 Oracle independence and divergence

The implementation stream may author code, propose cases, and produce observations. The oracle stream authors and reviews expected judgments under separate authority. An implementation, provider, adapter, generator, test, or change author cannot confer or weaken the expectation used to judge the same surface. Provider output cannot become the oracle by copying, majority vote, snapshot update, or acceptance-baseline regeneration.

A suspected wrong oracle creates a visible divergence and stops green aggregation for the affected grain. Correction produces a successor judgment with exact rationale and review; it never rewrites an earlier result or changes the answer solely to make an implementation pass.

## 14. Property and metamorphic testing

### 14.1 Generator and shrinker contract

Every property test binds a permanent property ID, exact applicable contract and semantic versions, generator implementation/version/digest, generation parameters, seed, distribution and exclusion basis, minimum case population or owner-supplied stopping rule, shrinker implementation/version/digest, original failure, complete or bounded shrink lineage, minimal retained counterexample, and replay data.

A generator cannot be the sole oracle for the property it produces. Generated valid instances require an independent predicate; generated invalid instances identify the exact violated rule. Discarded-case rates, exhausted generators, biased unreachable partitions, timeouts, and shrink failures remain visible and non-green where they undermine the declared population.

Every byte-changing shrink step creates a new exact successor subject identity. The shrinker preserves subject class, declared perimeter, target-defect lineage, governing-contract reference, and complete predecessor lineage; it never claims identity preservation across changed bytes. Applicability is re-evaluated against the successor. Provider standing and oracle standing are rebound or independently re-established for the exact successor subject and version. Without exact compatible successor applicability, provider standing, and oracle standing, the shrunken result remains non-green.

### 14.2 Closed metamorphic-relation registry
| Relation ID | Relation | Required property |
| --- | --- | --- |
| `JAN-CSAA-008-MR-001` | Exact replay | Content-identical inputs, seed, clock, configuration, and environment reproduce the declared deterministic result |
| `JAN-CSAA-008-MR-002` | Input enumeration permutation | Permuting an unordered input enumeration preserves semantic result and canonical order |
| `JAN-CSAA-008-MR-003` | Repository path canonicalization | Equivalent accepted path spelling resolves to one canonical identity; non-equivalent escape spelling is rejected |
| `JAN-CSAA-008-MR-004` | Line-ending normalization | Only under an owner-proven line-ending-invariant toolchain context, the new successor subject may be semantically equivalent; artifact, snapshot, occurrence, range, and lineage identities change or remap exactly |
| `JAN-CSAA-008-MR-005` | Owner-proven inert trivia | Only trivia proven inert under the exact compiler, resolver, framework, directive, and generator context may preserve applicable semantic facts; JSDoc, `@ts-check`, triple-slash, pragma/directive, ASI-sensitive, and framework-consumed comments are excluded unless separately proven inert |
| `JAN-CSAA-008-MR-006` | Unrelated-artifact addition | Adding an excluded unrelated artifact does not alter the closed included result and does update perimeter provenance |
| `JAN-CSAA-008-MR-007` | Alpha rename | A capture-safe owner-defined rename preserves applicable structure while identifiers and references change consistently |
| `JAN-CSAA-008-MR-008` | Equivalent resolver form | Owner-declared equivalent resolver configuration preserves resolution and records the changed configuration identity |
| `JAN-CSAA-008-MR-009` | Authored/virtual mapping round trip | Mapped authored and generated ranges round-trip within declared mapping quality and never cross artifact identity |
| `JAN-CSAA-008-MR-010` | Pagination composition | Concatenating all pages equals the bounded unpaged canonical result for the same subject and basis |
| `JAN-CSAA-008-MR-011` | Page-size variation | Changing page size changes segmentation, not member set or canonical order |
| `JAN-CSAA-008-MR-012` | Slice seed monotonicity | Only for a closed nontruncated population under unchanged budgets may adding a compatible seed preserve every existing valid witness; otherwise displacement and frontier evidence remain explicit and monotonicity is not claimed |
| `JAN-CSAA-008-MR-013` | Witness validation | Every reported path replays over admitted typed relations and exact endpoints |
| `JAN-CSAA-008-MR-014` | Graph projection consistency | A graph projection equals its admitted source object/relation population under the declared projection |
| `JAN-CSAA-008-MR-015` | Before/after reversal | Compatible delta direction reverses additions/removals and retains explicit modifications/incompatibilities |
| `JAN-CSAA-008-MR-016` | Incremental/clean-full equivalence | An exact change yields equivalent or owner-permitted outcomes in all eight dimensions |
| `JAN-CSAA-008-MR-017` | Cold/warm cache consistency | Under one compatible exact successor subject, cache warmth preserves the semantic result while run, cache-hit/miss, reuse, recomputation, timing, and resource provenance differ honestly |
| `JAN-CSAA-008-MR-018` | Provider-order invariance | Provider invocation order does not alter retained raw results, conflict membership, or normalized canonical order |
| `JAN-CSAA-008-MR-019` | Raw-lineage retention | Every normalized provider fact continues to resolve to its exact raw result after compatible transformations |
| `JAN-CSAA-008-MR-020` | Redaction noninterference | Authorized redaction changes disclosed representation, not the underlying permitted semantic state or completeness disclosure |
| `JAN-CSAA-008-MR-021` | Budget restriction | A stricter budget cannot increase demonstrated completeness or erase a truncation/partial frontier |
| `JAN-CSAA-008-MR-022` | Unsupported-region monotonicity | Adding an unsupported applicable region cannot improve completeness or a bounded negative conclusion |
| `JAN-CSAA-008-MR-023` | Freshness degradation | Invalidating an applicable dependency cannot preserve a current or green disposition |
| `JAN-CSAA-008-MR-024` | Reset reversibility | Fixture reset restores the exact immutable initial-state identity and removes mutation residue |
| `JAN-CSAA-008-MR-025` | Treatment preservation | Adding exception or suppression changes treatment state but never erases the underlying result, finding, or evidence |
| `JAN-CSAA-008-MR-026` | Double negation | Applying negation twice preserves the original four-valued evidence pair and every separately carried epistemic dimension |
| `JAN-CSAA-008-MR-027` | De Morgan duality | Negating conjunction equals disjoining the negated children, and negating disjunction equals conjoining the negated children, for every four-valued input combination |
| `JAN-CSAA-008-MR-028` | Truth-only commutativity and idempotence | Reordering children or duplicating an identical child preserves projected truth while deterministic trace order and duplicate provenance remain explicit |
| `JAN-CSAA-008-MR-029` | Associative n-ary fold equivalence | Every permitted regrouping and its ordered nonempty n-ary fold produce the same projected truth without losing child identity or provenance |
| `JAN-CSAA-008-MR-030` | Eager and lawful short-circuit equivalence | Complete evaluation and a lawful decisive short-circuit produce the same projected truth over the same available evidence while their attempted, skipped, cost, and explanation evidence remains honestly different |

Each relation is applicable only under its exact cited semantic owner and preconditions. An inapplicable relation carries rationale and does not count as passed coverage. Any permitted difference binds an exact policy ID/version and a difference manifest.

## 15. Mutation and tests-of-tests

### 15.1 Subject mutations

All eighteen `JAN-CSAA-006-MUT-001` through `018` classes receive at least one exact base case, mutation operation, expected affected set, expected invalidation closure, expected semantic delta, required failure or changed result, reset identity, and replayable successor lineage. Rule-target mutations plant the exact defect a rule claims to detect; a compilation failure that prevents the target semantic question from being exercised does not kill that semantic mutant unless the test explicitly owns the build-failure claim.

### 15.2 Harness and oracle mutation operators
| Mutation ID | Injected suite defect |
| --- | --- |
| `JAN-CSAA-008-HMUT-001` | Delete one required test-case coordinate |
| `JAN-CSAA-008-HMUT-002` | Delete or disable one assertion |
| `JAN-CSAA-008-HMUT-003` | Invert one expected comparison |
| `JAN-CSAA-008-HMUT-004` | Mark every selected case skipped |
| `JAN-CSAA-008-HMUT-005` | Return success without invoking the subject |
| `JAN-CSAA-008-HMUT-006` | Return an empty graph or result population |
| `JAN-CSAA-008-HMUT-007` | Delete one object or relation variant from a registry |
| `JAN-CSAA-008-HMUT-008` | Drop or mistype one relation endpoint |
| `JAN-CSAA-008-HMUT-009` | Strip subject, revision, provider, or raw provenance |
| `JAN-CSAA-008-HMUT-010` | Attach evidence from a different revision, build, environment, or cutoff |
| `JAN-CSAA-008-HMUT-011` | Coerce failure, error, timeout, cancellation, or refusal to pass |
| `JAN-CSAA-008-HMUT-012` | Coerce unsupported, partial, stale, conflict, or unknown to empty success |
| `JAN-CSAA-008-HMUT-013` | Erase one side of provider disagreement |
| `JAN-CSAA-008-HMUT-014` | Truncate output without partiality, frontier, or cursor evidence |
| `JAN-CSAA-008-HMUT-015` | Bypass one required validation stage |
| `JAN-CSAA-008-HMUT-016` | Disable one semantic invariant |
| `JAN-CSAA-008-HMUT-017` | Replace a conferred oracle with provider output or an unreviewed snapshot |
| `JAN-CSAA-008-HMUT-018` | Allow the implementation or test author to self-confer or weaken the oracle |
| `JAN-CSAA-008-HMUT-019` | Treat an RGT as an RGP or emit a transition effect |
| `JAN-CSAA-008-HMUT-020` | Erase finding evidence or treatment history |
| `JAN-CSAA-008-HMUT-021` | Skip authorization, path containment, or information-control enforcement |
| `JAN-CSAA-008-HMUT-022` | Leak a secret, path, count, shape, or existence fact through diagnostics |
| `JAN-CSAA-008-HMUT-023` | Omit one invalidation dependency or reuse a poisoned cache entry |
| `JAN-CSAA-008-HMUT-024` | Replace eight-dimensional equivalence with count, aggregate hash, or ID equality |
| `JAN-CSAA-008-HMUT-025` | Ignore an operation error branch, cancellation, or partial result |
| `JAN-CSAA-008-HMUT-026` | Attach coverage or trace evidence to a different execution artifact or selection |
| `JAN-CSAA-008-HMUT-027` | Ignore a required coding-agent analysis invocation or blocking result |
| `JAN-CSAA-008-HMUT-028` | Disable enforcement of an owner-supplied resource or performance budget |
| `JAN-CSAA-008-HMUT-029` | Equate a manifest declaration with the resolved lockfile dependency |
| `JAN-CSAA-008-HMUT-030` | Ignore one added, removed, changed, or transitive lockfile delta |
| `JAN-CSAA-008-HMUT-031` | Correlate an advisory to the wrong component, version, range, cutoff, scope, revision, or subject |
| `JAN-CSAA-008-HMUT-032` | Infer no vulnerability from absent, unavailable, stale, conflicting, unqualified, or incomplete advisory evidence |
| `JAN-CSAA-008-HMUT-033` | Downgrade an applicable case to not-applicable |
| `JAN-CSAA-008-HMUT-034` | Downgrade a critical case or control to noncritical |
| `JAN-CSAA-008-HMUT-035` | Allow an affected author to bypass or fabricate a definitive transition carrier |
| `JAN-CSAA-008-HMUT-036` | Reuse a predecessor subject identity after changed or shrunken bytes |
| `JAN-CSAA-008-HMUT-037` | Hide cache-hit, cache-miss, reused, or recomputed provenance |
| `JAN-CSAA-008-HMUT-038` | Map a diagnostic through the wrong generated, virtual, build, execution, or source-map artifact |
| `JAN-CSAA-008-HMUT-039` | Alter one conjunction or disjunction cell involving unknown or conflict |
| `JAN-CSAA-008-HMUT-040` | Coerce not-applicable into ordinary unknown, binary truth, null, omission, unsupported, or not-run |
| `JAN-CSAA-008-HMUT-041` | Short-circuit conjunction or disjunction on unknown, conflict, or not-applicable |
| `JAN-CSAA-008-HMUT-042` | Drop decisive-child or skipped-node provenance from a short-circuited explanation |
| `JAN-CSAA-008-HMUT-043` | Apply structural, traversal, depth, node, fanout, path, time, or resource validation only to nodes that evaluation visits |

Every critical rule, invariant, no-false-green predicate, oracle-independence control, subject-binding control, and security boundary maps to at least one applicable harness mutant. Every critical applicable mutant must be killed. A survivor, unexecuted mutant, equivalent-mutant claim without proof, flaky kill, or kill caused only by an unrelated harness crash is nonpass. The result retains the mutant implementation digest, changed location, expected detection path, executing case IDs, assertion IDs, actual evidence, and survivor disposition.

Mutation testing never authorizes changing a judgment to improve the score. The suite shall test the tests, the eligibility aggregator, the oracle boundary, the failure-state renderer, and the coverage-accounting logic—not merely the analyzed subject.

## 16. Provider-adapter and differential conformance

### 16.1 Adapter contract

Adapter tests bind exact Provider Declaration, Adapter Descriptor, capability binding, provider method, provider/engine/rule-set/model/database/feed/configuration versions, input contract, raw result, Model Exchange Record when applicable, transformation, validation stages, semantic-loss classification, normalized output, health, and limitations.

Positive mapping tests require exact raw-to-normalized lineage and no undisclosed added, dropped, defaulted, or coerced semantic field. Negative tests exercise malformed raw output, missing raw retention, wrong model response, incompatible format, stale configuration, invalid subject, partial result, timeout, cancellation, security violation, and prohibited semantic loss. Invalid output remains inert.

### 16.2 Differential outcome lattice

| Outcome | Required treatment |
| --- | --- |
| `agree-supported` | Both eligible outputs match the conferred oracle for the exact overlapping scope; retain both raw lineages |
| `agree-bounded-negative` | Both match a conferred closed-basis negative judgment; absence alone is insufficient |
| `agree-wrong` | Both conflict with the conferred oracle; agreement cannot create truth |
| `disagree` | Retain both outputs, exact comparison, conflict dimensions, raw evidence, and non-green result |
| `one-sided-supported` | One provider supports the capability and the other is explicitly unsupported; never count as two-provider corroboration |
| `one-sided-partial-or-stale` | Retain eligible bounded material and non-green comparison state |
| `one-sided-failure` | Retain the successful observation and failed health; no hidden fallback pass |
| `both-failed-or-unavailable` | No technical verdict; explicit failure |
| `incompatible-basis` | Refuse comparison; do not normalize away contract, subject, configuration, or semantic-version incompatibility |
| `not-applicable` | Only when the exact governing source and owner state that differential comparison is not required for this coordinate; bind owner, version, rationale, and review evidence |

These ten outcomes are the complete `Differential state` axis from §9.1. A presentation summary, provider-native status, or generic `one-sided`, `failed`, or `inconclusive` label cannot replace the exact outcome.

Provider shortage never changes applicability. When comparison is required, one eligible provider plus an unsupported peer is `one-sided-supported`; a partial or stale peer is `one-sided-partial-or-stale`; an invocation failure is `one-sided-failure`; two failed or unavailable providers are `both-failed-or-unavailable`; and a noncomparable contract or subject is `incompatible-basis`. Conversely, availability of two providers never makes an owner-declared optional comparison mandatory.

Differential tests never elect truth by majority, score, provider order, or convenience. Provider substitution and removal tests prove that replacing or disabling one provider cannot change semantic ownership, silently discard limitations, weaken the oracle, or make a previously required capability appear green. Concrete qualification and removal standing remain with `JAN-CSAA-011`.

## 17. Incremental invalidation and clean-full equivalence

Every incremental case binds one exact immutable pre-change subject, one exact change/mutation set, the resulting post-change successor identity/content/configuration, dependency and invalidation closure, incremental run, independently clean full run, compatible profiles/providers/methods/configurations, compared populations, reused/recomputed manifests, unsupported/missing regions, and exact oracle standing. Both runs analyze the same exact post-change successor while retaining distinct run, attempt, evidence, cache, reuse, and recomputation identities.

The comparison contains exactly these eight dimensions:

```text
semantic-result-sets
epistemic-states
coverage
provenance
conflicts
failures
explanations
deterministic-ordering
```

Each dimension records `equivalent`, `permitted-difference`, `different`, `not-compared`, or `inconclusive` with exact evidence and a difference manifest. Overall `demonstrated-equivalent` requires every dimension to be equivalent or governed by an exact applicable allowed-difference policy. Matching counts, aggregate hashes, record IDs, green badges, or selected examples do not establish equivalence.

The suite covers cold full build, warm no-change repeat, each of the eighteen mutation classes, dependency-driven transitive invalidation, rename/move/delete, compiler/resolver/framework/generator/configuration change, manifest/lockfile/advisory change, rule/provider/model change, build/instrumentation/test/coverage/trace/workload/environment change, cancellation, crash, stale cache, poisoned cache, and reset. Cache hits and misses remain observable. A cache key omission, result from another worktree or branch, incomplete invalidation, or publication of mixed pre/post-change material is a mandatory failure.

Wrong-successor, partially applied change, same path with different bytes, mixed-revision material, and an incremental/full pair targeting different successors are mandatory negative cases. Matching paths, revision labels, counts, or record IDs cannot repair a content or configuration mismatch.

The `INC` catalog contains four separate mandatory partitions:

- resolved-dependency tests alter exact package, version, resolver, condition, or selected-target inputs and verify the resolved dependency identity, provenance, graph delta, and invalidation closure;
- lockfile-delta tests alter one exact lockfile resolution fact and verify the intended semantic delta without treating manifest text or file presence as proof of the resolved state;
- advisory-correlation tests bind exact advisory/database/feed identity, affected-package/version basis, observation time, match or non-match evidence, and stale or unavailable behavior; and
- vulnerability-observation tests bind an exact Vulnerability Observation object to its dependency, advisory, subject, provider, evidence, freshness, and non-vacuity controls without converting observation into remediation or assurance authority.

A combined supply-chain example cannot satisfy one of these partitions by implication. Each partition has stable cases, its own negative and stale/unsupported controls, and separate coverage accounting.

| Stable case coordinate | Mandatory lanes | Required focus |
| --- | --- | --- |
| `JAN-CSAA-008-TC-INC-MANIFEST-RESOLUTION-DISTINCT@0.1.0` | synthetic and dated-JPWB | Manifest declaration is not lockfile resolution |
| `JAN-CSAA-008-TC-INC-RESOLUTION-RUNTIME-DISTINCT@0.1.0` | synthetic and dated-JPWB | Lockfile resolution is not runtime/import observation |
| `JAN-CSAA-008-TC-INC-LOCKFILE-ADD@0.1.0` | synthetic and dated-JPWB | Added exact direct dependency resolution |
| `JAN-CSAA-008-TC-INC-LOCKFILE-REMOVE@0.1.0` | synthetic and dated-JPWB | Removed exact dependency resolution |
| `JAN-CSAA-008-TC-INC-LOCKFILE-CHANGE@0.1.0` | synthetic and dated-JPWB | Changed version, source, integrity, condition, or target |
| `JAN-CSAA-008-TC-INC-LOCKFILE-TRANSITIVE@0.1.0` | synthetic and dated-JPWB | Transitive-only delta and complete affected closure |
| `JAN-CSAA-008-TC-INC-ADVISORY-MATCH@0.1.0` | synthetic and dated-JPWB | Exact component/version/range/scope match |
| `JAN-CSAA-008-TC-INC-ADVISORY-RANGE-NONMATCH@0.1.0` | synthetic and dated-JPWB | Closed-basis range or scope non-match |
| `JAN-CSAA-008-TC-INC-ADVISORY-STALE@0.1.0` | synthetic and dated-JPWB | Stale database/feed or observation cutoff |
| `JAN-CSAA-008-TC-INC-ADVISORY-CONFLICT@0.1.0` | synthetic and dated-JPWB | Conflicting qualified sources retained without majority truth |
| `JAN-CSAA-008-TC-INC-ADVISORY-SUBJECT-MISMATCH@0.1.0` | synthetic and dated-JPWB | Wrong component, version, scope, revision, or subject |
| `JAN-CSAA-008-TC-INC-ADVISORY-UNAVAILABLE@0.1.0` | synthetic and dated-JPWB | Unavailable, failed, unsupported, or unqualified source remains non-green |
| `JAN-CSAA-008-TC-INC-VULNERABILITY-POSITIVE@0.1.0` | synthetic and dated-JPWB | Revision-bound Vulnerability Observation with complete lineage |
| `JAN-CSAA-008-TC-INC-VULNERABILITY-REVISION-MISMATCH@0.1.0` | synthetic and dated-JPWB | Observation from another revision is inert |
| `JAN-CSAA-008-TC-INC-VULNERABILITY-NO-NEGATIVE-BASIS@0.1.0` | synthetic and dated-JPWB | No “not vulnerable” conclusion without qualified complete closed basis |
| `JAN-CSAA-008-TC-INC-VULNERABILITY-EMPTY-SENTINEL@0.1.0` | synthetic and dated-JPWB | Empty observations cannot pass when a planted affected component requires one |

The minimum supply-chain population is exactly sixteen stable coordinates across two mandatory lanes, or thirty-two independently reported lane-coordinate assignments. Every assignment binds exact manifest, lockfile, resolver, package/component, version, source/integrity, advisory/database/feed, range/scope, observation cutoff, subject/revision, provider, raw evidence, freshness, closure, and oracle standing as applicable.

Exact `JAN-CSAA-009@0.1.0` operational semantics refine the execution coordinates without changing the eight comparison dimensions. The later suite crosses all eighteen mutation classes with all eight dimensions for at least 144 independently reported assessments; binds each cache result to all sixteen `CAC-P01` through `CAC-P16` admission predicates; distinguishes reuse, revalidation, recomputation, invalidation broadening, unresolved dependency, and stale or poisoned cache; and proves that no mixed predecessor/successor population can publish. Matching counts, hashes, paths, revision labels, or cache keys cannot substitute for complete semantic equivalence.

## 18. Test, coverage, runtime, trace, and observation identity

Test evidence binds runner definition and version, source occurrence, selected tests and cases, filters, shards, tags, configuration, target, exact attempt ordinal, every retry, assertion identity, raw output, diagnostics, duration, and outcome. Retry aggregation never discards a prior attempt. `skipped-by-declared-policy`, `not-run`, and `unknown` are not passing evidence.

Coverage evidence binds the exact Test Run or Runtime Execution, target Execution Artifact, producing build, instrumentation configuration and sites, selection or workload, regions, denominator basis, granularity, metric, provider declaration and method/version, source mappings, collection health, and time. A percentage without exact numerator, denominator, compatible target, provider, selection/workload, and mapping fails.

Runtime and trace evidence binds the Runtime Build Identity, Environment Identity, Workload Selection, instrumentation, Trace Schema, Trace Collector Definition and Collection Observation, execution time boundary, clock/context behavior, sampling/capture policy, dropped events, backpressure, redaction, raw output, and observation limits. Lack of one observed path never proves an unobserved path impossible.

Mandatory negative correlations pair otherwise plausible evidence across different:

```text
repository or snapshot
build or execution artifact
compiler/project/resolver/framework configuration
instrumentation configuration or sites
test selection or workload
coverage denominator or granularity
runtime environment
trace schema or collector
source map
observation cutoff
```

Every mismatched coordinate must be detected and must prevent current, comparable, complete, or green aggregation.

## 19. Rules, findings, treatments, and inert gate templates

Every one of the seventeen exact Analysis Rule Profiles receives cases for its fixed claim character, applicability, input prerequisites, positive and negative criterion, inconclusive, partial, stale, disagreement, provider failure, exception, suppression, non-bypass, and zero-static-callers treatment as applicable. Profile binding authority remains `UNASSIGNED`; both definitive and interim ARP transition carriers remain exactly `N/A — no instantiated RGP or protected transition`. A fabricated carrier, binding, protected transition, or bypass path is a mandatory failure.

Rule Application Result tests preserve independently:

- applicability;
- evaluation completion;
- technical outcome;
- evidence sufficiency and freshness;
- conflict or provider disagreement.

A finding appears only when the fixed claim character and criterion require one. Finding lifecycle tests preserve every Engineering Evidence Record, result, remediation, disposition, suppression, exception, and residual limitation in append-only history. Exception and suppression modify treatment only; they do not rewrite the result or create approval. The implementation, test, finding, or change author cannot self-approve an exception.

Each of the twelve exact Repository Gate Templates receives an inert-baseline and misuse-rejection case. The required current population is exactly twelve templates and zero Repository Gate Profiles. Tests reject use of a template as a profile, Gate Evaluation input, permit/block/withhold authority, transition carrier, waiver, or approval. A future real gate test would require exact RGP designation, recognized governing authority, effective profile, an exact definitive non-bypassable transition carrier, provider qualification, conferred oracle, current evidence, no unresolved critical defect, and a separately authorized operation; none exists now.

Aggregation tests prove that one passed child cannot hide a failed, stale, partial, unsupported, conflicting, unexecuted, unqualified, or ineligible child. Threshold, exception, and suppression configuration silence never creates authority.

## 20. Logical operations, typed errors, compatibility, and cancellation

### 20.1 Operation and response coverage

All seventeen permanent logical operation IDs receive:

- a valid operation/subject/input policy case;
- wrong operation-input discriminator and payload cases;
- wrong subject-locator and compatibility-mode cases;
- authorization denied and unsupported-subject cases;
- success, explicit successful-empty where semantically possible, typed failure, partial, cancellation, timeout, stale, conflict, and resource-refusal cases as applicable;
- response state/outcome invariant cases; and
- a case proving the operation creates no implicit repository, oracle, gate, profile, or governance mutation.

The closed operation pairing matrix contains seventeen valid diagonal operation/input pairings and 272 invalid cross-pairings. A parameterized realization may share code but reports every coordinate independently.

### 20.2 Seven validation stages and 77 errors

Every `V01` through `V07` has at least one pass-path and one isolated failure-path case. Failure at one stage makes downstream admission inert unless the contract explicitly records bounded partial continuation. A later stage cannot retroactively make an earlier required failure pass.

Every one of the 77 typed error codes receives:

1. one valid code-specific safe-details payload;
2. one missing-required-details negative;
3. one alien-field or wrong-code-details negative;
4. one redaction and non-disclosure case; and
5. its exact degradation and result-state mapping.

The twelve affected operational additions are exact and independently tested:

| Source gap | Exact stable code | Mandatory negative focus |
| --- | --- | --- |
| `JAN-CSAA-009-A007-ERR-GAP-001` | `CSAA-E-CONFIG-OPERATIONAL-CONTEXT-STALE` | stale operational profile or configuration cannot be coerced current |
| `JAN-CSAA-009-A007-ERR-GAP-002` | `CSAA-E-PROVIDER-QUALIFICATION-NONPASS` | absent, invalid, expired, or incompatible qualification remains nonpass |
| `JAN-CSAA-009-A007-ERR-GAP-003` | `CSAA-E-LIFECYCLE-OPERATIONAL-BASIS-UNRESOLVED` | unresolved dependency, invalidation, or cache basis remains visible |
| `JAN-CSAA-009-A007-ERR-GAP-004` | `CSAA-E-PUBLICATION-GENERATION-CONFLICT` | stale predecessor or generation cannot publish |
| `JAN-CSAA-009-A007-ERR-GAP-005` | `CSAA-E-PUBLICATION-OUTCOME-UNKNOWN` | uncertain commit must reconcile before retry or currentness |
| `JAN-CSAA-009-A007-ERR-GAP-006` | `CSAA-E-INTEGRITY-MATERIAL-NONPASS` | collision, corruption, quarantine, or format incompatibility remains non-green |
| `JAN-CSAA-009-A007-ERR-GAP-007` | `CSAA-E-MIGRATION-EXECUTION-NONPASS` | divergence, backfill, cutover, fallback, or rollback failure remains distinct |
| `JAN-CSAA-009-A007-ERR-GAP-008` | `CSAA-E-MATERIAL-LIFECYCLE-ACTION-NONPASS` | retention, deletion, backup, restore, or residual-copy failure remains distinct |
| `JAN-CSAA-009-A007-ERR-GAP-009` | `CSAA-E-SECURITY-CONTROL-NONPASS` | encryption, key, certificate, secret, or egress failure is safely bounded |
| `JAN-CSAA-009-A007-ERR-GAP-010` | `CSAA-E-AUDIT-DURABILITY-FAILED` | required audit or telemetry durability failure cannot be hidden |
| `JAN-CSAA-009-A007-ERR-GAP-011` | `CSAA-E-EXTERNAL-EFFECT-OUTCOME-UNKNOWN` | uncertain or partial external effect requires reconciliation |
| `JAN-CSAA-009-A007-ERR-GAP-012` | `CSAA-E-ISOLATION-BASIS-MISMATCH` | cross-partition or time-of-check/time-of-use mismatch refuses safely |

Each case validates the exact code-discriminated `safeDetails` fields from `JAN-CSAA-007@1.1.0` Appendix F.8. A source gap identifier, neighboring code, generic internal error, provider-native string, or success outcome cannot replace the registered code when the distinction is known.
An error payload cannot expose source text, secrets, unauthorized paths, raw provider material, counts, shapes, existence, stack data, or identities beyond the exact information-control binding.

Cancellation tests bind request, accepted cancellation identity, target operation, observed point, child attempts, provider/process propagation, retained partial/raw material, cleanup, and final state. Cancellation is never success. A late cancellation after immutable completion remains a separately observed event and does not rewrite the completed record.

### 20.3 Compatibility and migration

Compatibility tests are directional and version-bound. They cover schema/package, registry, discriminator, field, enum, digest, reference, envelope, collection, operation, error, adapter, and generated derivative changes. `compatible`, `incompatible`, `unknown`, `not-evaluated`, and explicit mapped compatibility remain distinct.

Unknown core fields are rejected unless the exact contract says otherwise. Registered namespaced extensions round-trip under their own owner and cannot become core semantics by name similarity. Deprecation preserves current behavior until the exact removal boundary. Logical migration creates a new record and predecessor relation; it never rewrites history or claims a physical storage migration occurred.

## 21. Hostile repository and analyzer-security testing

### 21.1 Closed hostile-class registry
| Class ID | Injected hostile surface |
| --- | --- |
| `JAN-CSAA-008-HST-001` | `..`, alternate separator, normalization, or encoded traversal |
| `JAN-CSAA-008-HST-002` | absolute, drive-change, UNC, device, alternate-data-stream, or reserved path |
| `JAN-CSAA-008-HST-003` | symlink, junction, mount, hard-link, or provider-alias escape |
| `JAN-CSAA-008-HST-004` | archive, generated output, source map, or extraction entry escape |
| `JAN-CSAA-008-HST-005` | case-fold, Unicode-normalization, confusable, or ambiguous-case collision |
| `JAN-CSAA-008-HST-006` | configuration import, package lifecycle, discovery, or workspace hook execution |
| `JAN-CSAA-008-HST-007` | generator, plugin, script, native module, compiler plugin, or child-process trigger |
| `JAN-CSAA-008-HST-008` | repository prompt, comment, filename, diagnostic, or instruction injection |
| `JAN-CSAA-008-HST-009` | malformed, deeply nested, cyclic, oversized, fanout, regex, parser, or decompression bomb |
| `JAN-CSAA-008-HST-010` | poisoned generated/virtual artifact, declaration, source map, trace, or coverage payload |
| `JAN-CSAA-008-HST-011` | spoofed extension, discriminator, provider-native field, media type, or schema identity |
| `JAN-CSAA-008-HST-012` | secret, credential, token, environment, configuration, source, trace, or canary exfiltration |
| `JAN-CSAA-008-HST-013` | network, DNS, loopback, metadata-service, callback, update, or telemetry egress attempt |
| `JAN-CSAA-008-HST-014` | cross-repository, worktree, branch, principal, tenant, evidence-set, or cache contamination |
| `JAN-CSAA-008-HST-015` | mixed-revision, time-of-check/time-of-use, concurrent mutation, or subject substitution |
| `JAN-CSAA-008-HST-016` | CPU, memory, disk, file-count, process-count, output, traversal, or query resource exhaustion |
| `JAN-CSAA-008-HST-017` | unmodeled reflection, framework registration, dynamic import, native, or runtime entry frontier |
| `JAN-CSAA-008-HST-018` | unauthorized raw, source, query, finding, trace, count, path, shape, or existence probing |
| `JAN-CSAA-008-HST-019` | diagnostic, audit, exception, stack, preview, timing, or response-side-channel leakage |
| `JAN-CSAA-008-HST-020` | record collision, digest-purpose confusion, predecessor rewrite, or historical-state substitution |

### 21.2 Required security controls

Repository inspection is data-only unless a separately authorized execution grant explicitly says otherwise. The received working tree is read-only. Process creation and network access are denied by default. Any grant is capability-, purpose-, subject-, principal-, time-, path-, method-, and resource-bounded.

Security cases verify:

1. exact repository/worktree/branch/evidence-set partitioning;
2. least-privilege authorization and refusal on missing, expired, ambiguous, or mismatched grants;
3. separate confidentiality, access, retention, and redaction classifications;
4. conservative record-grain information control for composites;
5. canonical path containment and every registered path-refusal code;
6. no following of an escape through a provider-native alias or map;
7. process, network, plugin, generator, package-script, and native-module denial;
8. secret values never embedded where only `SecretReference` is permitted;
9. redaction cannot fabricate completeness, successful emptiness, or absence;
10. count, path, shape, existence, timing, diagnostic, and raw-preview non-disclosure;
11. audit reconstructability without protected leakage;
12. cancellation and resource enforcement across child activity; and
13. retention or deletion that does not rewrite immutable semantic history.

Hostile content is not materialized or executed by this documentation activity. Later test construction shall use containment appropriate to the attack and shall prove the containment with canaries, denied side effects, resource observations, cleanup, and audit evidence. A harness crash, host escape, secret read, network egress, source mutation, unbounded process tree, or uncontained residue is a critical failure.

## 22. Degradation, fault, restart, and recovery

### 22.1 Twenty degradation classes

Every exact `JAN-CSAA-006-DEG-001` through `020` class is crossed with these eight result surfaces:

```text
capability-and-analysis
query-slice-comparison-impact
semantic-and-graph
rule-finding-treatment
gate-template-or-evaluation
operation-and-health
publication-currentness-and-recovery
fixture-oracle-and-conformance
```

The resulting `20 × 8 = 160` no-false-green coordinates contain an executable allocation or an exact source-justified reasoned not-applicable value. No cell is blank. For every applicable cell the injected condition cannot become successful empty, supported false, complete, current, healthy, satisfied, permitted, conformant, safe, approved, or waived.

### 22.2 Topology-neutral recovery points
| Recovery ID | Abstract fault point |
| --- | --- |
| `JAN-CSAA-008-RCV-001` | before request acceptance |
| `JAN-CSAA-008-RCV-002` | during subject acquisition or identity resolution |
| `JAN-CSAA-008-RCV-003` | during plan construction or capability dependency resolution |
| `JAN-CSAA-008-RCV-004` | after invocation creation and before raw capture |
| `JAN-CSAA-008-RCV-005` | after raw capture and before validation |
| `JAN-CSAA-008-RCV-006` | during V01–V07 validation |
| `JAN-CSAA-008-RCV-007` | during transformation or normalization |
| `JAN-CSAA-008-RCV-008` | after candidate assembly and before publication validation |
| `JAN-CSAA-008-RCV-009` | at the atomic-publication boundary |
| `JAN-CSAA-008-RCV-010` | after publication and before response or audit completion |
| `JAN-CSAA-008-RCV-011` | during cancellation propagation and cleanup |
| `JAN-CSAA-008-RCV-012` | during timeout, resource exhaustion, or backpressure |
| `JAN-CSAA-008-RCV-013` | during stale-cache or interrupted-index detection |
| `JAN-CSAA-008-RCV-014` | during uncertain external-effect reconciliation |
| `JAN-CSAA-008-RCV-015` | during corruption detection, rebuild, migration, or reconciliation |
| `JAN-CSAA-008-RCV-016` | during retry/restart duplicate prevention and last-known-good separation |

Each case requires exact prior publication, candidate successor, operation/invocation identity, injected fault, durable material observed before and after, retry/restart identity, idempotency behavior, duplicates, orphaned material, last-known-good visibility, current-pointer behavior, partial-result treatment, cleanup, and audit/reconciliation evidence.

An incomplete successor never becomes current. Prior valid publication is not relabeled as fresh output from the failed attempt. Uncertain external effect is reconciled before retry. Recovery preserves history, prevents duplicate material records or effects, and either completes one exact successor or remains explicitly non-green.

These behavior obligations now bind exact topology-neutral semantics in `JAN-CSAA-009@0.1.0` and exact candidate representations in `JAN-CSAA-007@1.1.0`. Every future operational profile maps all sixteen recovery coordinates to concrete injection points, durable materials, before/after states, observable probes, cleanup checks, audit evidence, and independently reported cases. This reconciliation chooses no database, graph store, queue, filesystem layout, scheduler, lock, transaction, deployment, or crash mechanism and performs no failure injection.

## 23. Deterministic replay and reproducibility

A replay manifest binds every semantic input and environmental influence required by the declared deterministic scope:

- exact subject and content digests;
- schema, generated artifact, implementation, harness, fixture, and oracle versions;
- compiler, resolver, framework, generator, provider, adapter, model, database/feed, rule-set, and configuration versions;
- operation, plan, query, selection, workload, instrumentation, trace schema, collector, and source map;
- randomness seed, clock policy, locale, timezone, platform, concurrency/scheduling policy, and resource budget;
- raw inputs, raw outputs, diagnostics, attempt order, and allowed-difference policy.

Repeat tests distinguish byte identity, canonical semantic identity, permitted presentation difference, owner-governed semantic difference, and nondeterministic failure. A deterministic output under incomplete or wrong semantics remains wrong. An unexplained difference, missing raw input, unbound environment influence, order-dependent provider winner, unstable ID, or nonreplayable seed is nonpass.

## 24. Performance and resource budgets

### 24.1 Six workload classes

Performance profiles cover:

1. initial full repository analysis;
2. incremental reanalysis;
3. execution-evidence ingestion;
4. complete snapshot publication;
5. interactive query;
6. cross-snapshot comparison.

Every performance case binds exact subject scale, project/artifact/object/relation counts, capability set, provider and configuration, environment, cold/warm state, concurrency, repetitions, statistical summary, setup inclusion, budget source, wall-clock, CPU, memory, disk, I/O, process, network where authorized, output size, coverage, health, cancellation, timeout, and raw measurements.

This Draft sets no numeric threshold. A pass requires a separately versioned owner-authorized budget profile. Missing, unreviewed, floating, host-dependent, or retrospective thresholds yield `inconclusive` or `not-run`, never pass. Resource pressure may cause an explicit refusal, cancellation, timeout, degraded state, or broader safe recomputation; it may not silently lower semantic profiles, omit files, truncate results, change an oracle, disable security, or claim successful empty.

Warm-cache performance is never compared with cold full analysis without explicit classification. Performance measurement does not substitute for semantic equivalence or recovery testing.

## 25. Dated JPWB and coding-agent trajectory tests

### 25.1 Dated JPWB lane

Dated-JPWB tests select the minimum repository evidence needed for named realistic concerns and bind the exact observation cutoff, worktree/change identity, project/compiler/resolver/framework/generator contexts, generated artifacts, tests, coverage, trace, architecture owner reference, gaps, and known unsupported surfaces.

The dated lane tests monorepo/project references, Svelte and generated-contract mappings, architecture boundaries, resolved-dependency, lockfile-delta, advisory-correlation, vulnerability-observation, test/coverage/runtime identity, and representative change impact. It cannot claim continuous currentness or replace the synthetic lane. Any later repository change invalidates only the affected dated result; final corpus freeze still requires the consolidated implementation refresh and rebinding.

### 25.2 Coding-agent trajectory

Until `JAN-CSAA-010` is authored, trajectory cases are provisional abstract obligations derived only from adopted `JAN-CSAA-000`:

- load the applicable governed requirements, current inventory, exact machine contracts, fixtures, work-package ledger, provider qualification/limits, and actual code/configuration/user changes;
- invoke the required analysis operation at the prescribed design, planning, implementation, verification, and validation point;
- bind the exact current subject rather than an older snapshot;
- cite evidence, health, freshness, coverage, limitations, and unresolved findings honestly;
- preserve the evidence-priority order in §8;
- stop or escalate on blocking, stale, partial, unsupported, conflicting, failed, or ineligible evidence;
- never bypass analysis, ignore a blocking finding, self-approve an exception, weaken an oracle, treat an RGT as an RGP, or claim a gate effect;
- distinguish a tool error from a clean result and a successful empty from false empty; and
- leave a reconstructable operation and evidence trajectory.

Trajectory tests use controlled transcripts, operation traces, tool-call records, subject bindings, and planted negative states. A final textual answer that happens to be correct does not compensate for bypassing a mandatory analysis step. Conversely, tool invocation alone does not prove correct use. `JAN-CSAA-010` later owns exact employment points and shall trigger affected reconciliation; this Draft does not establish a general agent procedure.

## 26. Bidirectional traceability and minimum completeness

The complete trace is:

```text
source requirement or invariant
    → concern-owned semantic definition
    → candidate/enforced contract and family
    → ConformanceTestSpecification
    → ConformanceCaseDefinition
    → fixture and actual oracle standing
    → exact implementation/provider/configuration subject
    → run, attempt, assertion
    → raw evidence, diagnostics, health, and limits
    → eligibility assessment
    → bounded conformance disposition
```

Reverse trace resolves every case and result back to all governing requirements, definitions, and exact owners. Many-to-many mapping is permitted; loss of a source identity is not. Coverage declares a population and status, not correctness.

### 26.1 Exact minimum coverage matrix
| Surface | Required population |
| --- | --- |
| Applicable adopted `JAN-CSAA-000` intake | 302 exact requirement rows |
| Unaffected predecessor local catalogs | 2,160 rows: 240 + 553 + 290 + 401 + 336 + 340 from JAN-CSAA-001 through JAN-CSAA-006 |
| Direct canon intake | 53 exact rows sourced from `JAN-CSAA-004-LEDGER-001@0.1.1` and preserved through the immutable 008 predecessor allocation |
| Wave 3 readiness constraints | 53 exact rows preserved through the immutable 008 predecessor allocation |
| Unaffected inherited subtotal | 2,568 individually retained rows: 302 + 2,160 + 53 + 53 |
| Exact current `JAN-CSAA-007@1.1.0` source | 652 individually reproduced local-catalog rows |
| Exact historical `JAN-CSAA-009@0.1.0` finite-cutoff source | 1,100 individually reproduced local-catalog rows |
| Pre-local affected-ledger total | 4,320 rows: 2,568 + 652 + 1,100 |
| Contract families | 19 of 19 including the operational family |
| Future schema sources | 19 of 19 including `SCHEMA-OPERATIONS` |
| Generated derivatives | 5 of 5 |
| Object variants | 127 valid plus at least 127 variant-specific invalid coordinates |
| Relation variants | 137 valid plus at least 137 variant-specific invalid coordinates |
| Semantic invariants | 14 positive + 14 negative + applicable mutation kills |
| Golden graph layers | 9 layers × 3 case modes = 27 independently reported cases |
| Bidirectional source mapping | complete authored→virtual→artifact→observation→authored chain plus broken, ambiguous, missing, non-round-tripping, and wrong-artifact controls |
| Capability facets | 32 profiles × 28 labels = 896 cells |
| Facet-label hostile controls | missing, duplicate, reordered, and ambiguous/punctuation-derived for every affected parser path |
| Scenario families/cases | 20 families and 40 paired cases |
| Zero-static-callers | 9 cases with unresolved, positive contradiction, and closed-negative controls |
| Reachability mechanisms | 12 of 12 |
| Capability matrix | 256 of 256 |
| ARP matrix | 187 of 187 |
| RGT matrix | 24 of 24; exactly zero current RGPs |
| Subject mutations | 18 of 18 |
| Harness mutations | 43 of 43 applicability-evaluated; every critical applicable mutant killed |
| Metamorphic relations | 30 of 30 applicability-evaluated |
| Degradation/no-green | 20 classes × 8 surfaces = 160 cells |
| Incremental equivalence | 18 subject mutation classes × 8 dimension assessments at minimum |
| Supply-chain dependency/advisory | 16 stable coordinates × 2 mandatory lanes = 32 independently reported assignments |
| Operations | 17 valid operation/input pairs and 272 invalid cross-pairs |
| Validation stages | 7 pass paths and 7 isolated failure paths |
| Typed errors | 77 valid payloads plus code-specific negative and non-disclosure cases |
| Hostile classes | 20 of 20 |
| Recovery points | 16 of 16 bound to exact 009 topology-neutral coordinates; concrete injections remain unrun |
| Operational wire roles | 1 profile definition plus 31 runtime roles, all exact assignments, identities, projections, references, keys, and preimages |
| Operational health | H01–H14 plus four health-view binding branches and preserved five response axes |
| Phase/digest negatives | 6 of 6 independently specified, selected, executed, and reported in a later authorized suite |
| Performance workloads | 6 of 6 under separately supplied budget profiles |
| Agent trajectories | all 010-owned employment points after reconciliation |

Every inherited row receives an individual ledger identity, applicability, local allocation, planned method, execution owner, current nonperformance state, and evidence boundary. Semantic overlap may map multiple rows to one test specification; it never deletes a row.

## 27. Downstream allocations and open safe defaults

### 27.1 Handoff matrix

| Handoff | Later owner | Exact obligation | Current state |
| --- | --- | --- | --- |
| Dedicated conformance-catalog, specification, case, and eligibility wire records | later affected `JAN-CSAA-007` successor | Encode the §5–§9 semantics without overloading source `TestRecord` or the now-closed operational family | `NOT_AUTHORED / REMAINS_ALLOCATED` |
| Enforced schemas, generated types, validators, generator, and adapters | separately authorized 007 artifact executor | Materialize exact shape authority and fidelity evidence | `NOT_AUTHORIZED / NOT_PERFORMED` |
| Physical synthetic and dated fixtures | separately authorized fixture builder | Materialize exact `JAN-CSAA-006` definitions with immutable manifests | `NOT_AUTHORIZED / NOT_PERFORMED` |
| Judgment-grain expected-result review and conferral | independent oracle authority | Confer, reject, diverge, revoke, correct, or supersede exact expectations | `NOT_PERFORMED` |
| Executable harness and tests | separately authorized implementation owner | Implement this catalog without semantic loss | `NOT_AUTHORIZED / NOT_PERFORMED` |
| Test execution and raw capture | authorized executor distinct from oracle changer | Execute exact subject/case set and retain evidence | `NOT_AUTHORIZED / NOT_RUN` |
| Persistence, cache, atomic publication, concurrency, recovery, migration, retention, health, and physical performance semantics | `JAN-CSAA-009@0.1.0` | Exact concern-owned semantics are consumed without co-ownership; concrete realization remains separate | `AFFECTED_DOCUMENTATION_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| Coding-agent employment points | `JAN-CSAA-010` | Define exact invocation and response obligations, then reconcile trajectory tests | `NOT_AUTHORED / PROVISIONAL_HANDOFF` |
| Concrete provider qualification and removal | `JAN-CSAA-011` | Bind exact provider/version/configuration/license/security/execution profile to evidence | `NOT_AUTHORED / NOT_QUALIFIED` |
| Independent Proposed-candidate review and integrity validation | distinct later identities | Review exact frozen bytes and provenance | `NOT_RUN` |
| Final corpus disposition and recording | accountable sponsor and distinct ministerial recorder | Individually dispose exact final surfaces in one corpus-review event | `ABSENT` |

### 27.2 Open alternatives and conservative defaults

| Open surface | Conservative Draft default |
| --- | --- |
| Physical test runner, assertion library, property framework, mutation engine, coverage tool, or CI | No selection |
| Conformance wire-record shapes | Operational shapes from exact 007 are consumed; dedicated catalog/specification/case/eligibility serialization remains allocated to a later affected 007 successor |
| Fixture directory/layout and hostile artifact materialization | No physical files created |
| Oracle reviewer and conferral authority | Every inherited judgment remains proposed/non-conferred/non-executed |
| Provider availability for differential tests | Missing overlap is nonpass or reasoned not-applicable; never passed corroboration |
| Numerical performance thresholds | No invented values; owner-supplied versioned profile required |
| Recovery and crash topology | Exact topology-neutral 009 behavior; no physical mechanism selected and no case executed |
| Agent employment points | Abstract adopted obligations pending 010 |
| Concrete provider, adapter, model, database/feed, installation, update, license, or execution profile | No selection or qualification pending 011 |
| Current JPWB repository state | Dated evidence only; final consolidated refresh remains mandatory |
| Gate integration | All RGTs inert; zero RGPs and zero transition effects |

These unresolved surfaces block their corresponding executable or final claims. They do not justify weakening the specified tests or manufacturing pass evidence.

### 27.3 Exact affected-source and ownership boundary

This successor binds the exact current `JAN-CSAA-007@1.1.0` shape source and the exact historical `JAN-CSAA-009@0.1.0` operational-semantic intake under the finite cutoff below. The 007 package owns candidate serialization; the 009 package owns operational meaning; this 008 package owns only executable conformance method. A test case may bind all three without transferring, merging, or duplicating ownership.

| Surface | Exact source | Test use | Prohibited inference |
| --- | --- | --- | --- |
| Operational machine contracts | `JAN-CSAA-007@1.1.0`; 1,349,212 bytes; SHA-256 `60618b2da0b0ee1b103f3d72404d7de4419f69630848a59ff835e8185d6ad49d` | Shape-valid, shape-invalid, query-algebra, phase, reference, identity, digest, collection, health, and error cases | Enforced schema, generated type, implementation, or runtime instance |
| Operational semantics | `JAN-CSAA-009@0.1.0`; 372,913 bytes; SHA-256 `13c61cf36920b4d5cd804a9a0be09e32013b810f12ebd2a09708bb1c1562447d` | Persistence, publication, invalidation, cache, concurrency, recovery, migration, retention, security, health, and capacity expectations | Selected topology, mechanism, provider, budget, or performed operation |
| Conformance method | `JAN-CSAA-008@0.2.2` | Catalog, cases, coverage, mutations, eligibility, evidence, and no-false-green derivation | Oracle conferral, provider qualification, assurance disposition, or implementation authority |

The immutable `JAN-CSAA-008@0.1.1` package remains the exact pre-affected predecessor. Its statements that 009 was not authored are historical lifecycle facts. They are not current source descriptions, are not edited retroactively, and cannot be used to bypass this affected successor.

### 27.4 Exact operational-wire conformance inventory

The later suite treats each population below as closed and independently accounted:

| Wire surface | Exact population | Minimum conformance treatment |
| --- | ---: | --- |
| Operational Profile Definition | 1 definition with O01–O30 exactly once and in order | valid full profile; missing, duplicate, reordered, merged, defaulted, unresolved, and ownerless-not-applicable negatives |
| Runtime operational records | 31 roles | one valid minimal and one valid maximal case per role; missing required field, alien field, wrong role/identity/state, wrong collection mode, and invalid reference cases |
| Top-level assignments | 32 | OEAR-001 through OEAR-032 exactly once and disjoint from 144 legacy assignments |
| Operational identities | 37 rows / 40 names | stable-role identity, state revision, record identity, and content identity remain distinct |
| Projection coordinates | 12 | P01–P12 exact-value or expressly owner-backed not-applicable; no silent omission or wildcard |
| Derived projections | 5 | security partition, publication channel, candidate subject, operation, and cache projections reproduce exact inputs |
| Digest profiles | 5 | record, projection, candidate, replay basis, and replay completion use the exact registered preimage |
| Target sets | 3 | runtime, profile-definition, and closed union admit no alien target |
| Reference aliases | 5 | exact target eligibility, direction, finalization, and migration-epoch treatment |
| Finalization directions | 6 | predecessor, content, live correlation, publication, binding, and replay edges remain acyclic and phase-correct |
| Canonical keys | 13 | full projected fields, deterministic order, duplicate rejection, and purpose separation |
| Self-excluding preimages | 3 | candidate, replay basis, and replay completion exclude every direct or transitive self/future dependency |
| Health dimensions | 14 | H01–H14 remain separate and source-supported; no aggregate healthy Boolean |
| Operational error additions | 12 | exact code and closed safe payload; total registry is 77 |
| Mandatory phase/digest negatives | 6 | exact independent injection, refusal, retained evidence, and report |

Documentation checks reproduce these registries and their cross-counts. Later executable checks require separately authorized schema sources, generated derivatives, validators, implementation artifacts, fixture material, fault controls, and executions. Absence of those artifacts is an explicit nonpass rather than a documentation defect.

### 27.5 Operational profile, identity, and record binding

Every operational case binds one exact `OperationalProfileDefinitionRecord`, exact implementation and configuration identities, the complete applicable P01–P12 projection, authorization and information-control references, semantic-owner and serialization-owner references, and exact content identities. A profile definition does not prove an instantiation; an instantiation does not prove a record occurrence; a record occurrence does not prove publication, currentness, semantic correctness, or conformance.

For each of the 31 runtime roles, the suite validates the role-specific stable identity, immutable occurrence `recordId`, state revision where applicable, exact predecessor, `recordDigest`, finalization state, complete collection grammar, and every required cross-reference. It also injects role collision, state-revision rollback, wrong predecessor, cross-role aliasing, digest-purpose confusion, unresolved target, wrong reference direction, unfinalized content reference, duplicate canonical key, reordered ordered collection, and invented not-applicable reason.

### 27.6 Publication, read-view, cache, and health conformance

Publication tests exercise all twelve candidate states, every permitted transition, every prohibited transition, and PUB-P01 through PUB-P16 at one declared cutoff. They distinguish candidate lifecycle, sealed candidate content, publication decision, completed legacy Publication Manifest, current physical binding, and acquired read observation. Compare-and-publish conflict, unknown outcome, partial atomicity, stale fencing, audit failure, integrity failure, incompatible migration, and noncurrent predecessor are independently injected and remain non-green.

Read tests acquire one exact immutable `ContentReadViewRecord` over a complete ordered publication vector at a common cutoff. A continuation remains bound to that view, query projection, order, boundary, authorization, policy, cutoff, and expiry. Current-binding and explicitly-historical branches remain distinct; no-current-binding, binding-unavailable, and binding-corrupt health branches contain no content reference and permit no semantic traversal.

Cache tests evaluate CAC-P01 through CAC-P16 independently and in conjunction. A hit with a missing subject, dependency, provenance, qualification, authorization, currentness, health, or complete-key coordinate is a refusal or miss, never a supported result. Cache provenance, admission, reuse, invalidation, quarantine, eviction, and cross-partition denial remain observable.

### 27.7 Incremental, degradation, recovery, migration, and security populations

The exact executable allocation is:

| Population | Exact coordinates | Required later evidence |
| --- | ---: | --- |
| Incremental equivalence | 18 mutation classes × 8 dimensions = 144 | same exact post-change successor, complete reuse/recompute/invalidation manifests, independently clean full run, allowed-difference policy, and per-dimension result |
| Degradation | 20 classes × 8 surfaces = 160 | injected condition, exact affected surface, preserved raw evidence, non-green mapping, cleanup, and independent report |
| Hostile containment | 20 classes | canaries, denied side effects, bounded resources, safe diagnostics, cleanup, audit, and no secret/path/existence leakage |
| Recovery | 16 topology-neutral points | concrete injection point, durable before/after material, restart/retry identity, idempotency, duplicate/orphan checks, current-binding behavior, cleanup, and audit |
| Workloads | 6 classes | exact profile, environment, denominator, owner-supplied budget, resource measures, refusal behavior, and semantic noninterference |
| Phase/digest negatives | 6 cases | exact malformed phase or preimage, required rejection, immutable prior history, no publication, and independent report |

Migration tests cover inventory, compatibility, shadow/dual modes, backfill, reconciliation, cutover, fallback, rollback, current-binding change, residual copies, and decommission. Backup/restore tests cover one exact consistency boundary, encryption, retention, isolated restoration, validation before activation, recovery objectives, and failed-restore nonpublication. Retention and garbage-collection tests preserve policy, holds, reachability roots, grace boundaries, authorization, race prevention, residual evidence, and immutable history.

### 27.8 Six mandatory phase-identity and digest-cycle cases

| Case | Exact injection | Required later outcome |
| --- | --- | --- |
| `JAN-CSAA-009-TST-PHASE-001` | `ABSENT` or `ASSEMBLING` lifecycle revision contains `publicationCandidateId` | phase-invalid rejection; no candidate, decision, Manifest, current binding, or historical rewrite |
| `JAN-CSAA-009-TST-PHASE-002` | post-seal action backfills candidate identity into a pre-seal revision | immutable-history and integrity rejection; original revision retained |
| `JAN-CSAA-009-TST-PHASE-003` | one `candidateLifecycleId` is rebound to different sealed content | lifecycle-collision rejection; original terminal lineage retained |
| `JAN-CSAA-009-TST-PHASE-004` | content identifier is blanked, zeroed, provisionally populated, or included in its own canonical preimage | noncanonical/circular-identity rejection |
| `JAN-CSAA-009-TST-PHASE-005` | replay-basis preimage includes output or later candidate/manifest/decision/completion material | future-dependent/circular-basis rejection |
| `JAN-CSAA-009-TST-PHASE-006` | replay-completion preimage includes material directly or transitively dependent on the same replay identity | cyclic-completion rejection; later correlating records remain outside the preimage |

Each case has its own permanent case identity, fixture or generated invalid instance, setup, injection, expected typed failure, retained raw evidence, cleanup, assertion population, and result. Passing ordinary publication or replay, or passing another phase case, cannot satisfy a missing or failed coordinate.

### 27.9 Affected result-eligibility closure

An operationally affected result remains ineligible unless:

1. the exact 007 and 009 source identities match this successor;
2. every required operational shape and semantic predicate is represented without loss;
3. the exact operational profile and implementation subject are authorized and content-bound;
4. every applicable P01–P12 coordinate and H01–H14 dimension is resolved at the required cutoff;
5. every required publication, cache, incremental, recovery, security, migration, retention, workload, and phase case executed;
6. all required schema, reference, collection, identity, preimage, transition, and error assertions passed;
7. conferred-current oracle standing exists for every semantic expectation that needs one;
8. no stale, partial, unsupported, unknown, conflicting, unqualified, unobserved, or outcome-unknown state remains; and
9. the complete blocking-reason set is empty.

The current documentation state satisfies none of the executable predicates by authorship. It records exact future obligations and exact nonperformance only.

### 27.10 Remaining safe gaps and no-expansion boundary

The affected 007 operational shape gap and the 009 operational-semantic gap are closed only at the documentation-allocation level. Dedicated conformance wire records, enforced schemas, generated derivatives, validators, physical fixtures, conferred oracles, harness code, provider qualification, operational-profile instantiation, physical topology, numeric budgets, failure injection, and results remain absent. `JAN-CSAA-010`, `JAN-CSAA-011`, corrective-successor author-self-review rerun, independent Proposed-candidate review, final implementation refresh, full-corpus sponsor disposition, conferral, and recording remain later lifecycle work.

This successor authorizes no implementation, experiment, dependency, provider, topology, test execution, source mutation, gate, oracle change, assurance decision, or repository operation. It does not reopen or rewrite the predecessor. It changes only the affected documentation contract and its author-side evidence lineage.
## 28. Normative requirement catalog

Requirement identifiers are permanent within `JAN-CSAA-008`. Retirement preserves the prior identifier as a tombstone and creates successor treatment; an identifier is never reused. Every row is an atomic obligation of this test specification, not a claim of present execution.

### 28.1 Control, lifecycle, authority, and nonperformance

| ID | Requirement |
| --- | --- |
| `CSAA-008-CTL-001` | The document SHALL retain permanent ID `JAN-CSAA-008`, exact reserved filename, semantic version, Draft lifecycle, and HYPOTHESIS settledness. |
| `CSAA-008-CTL-002` | The document SHALL remain a documentation-only executable-conformance and V&V specification. |
| `CSAA-008-CTL-003` | Draft authorship SHALL NOT create executable tests, fixtures, schemas, generated derivatives, validators, adapters, providers, databases, services, or results. |
| `CSAA-008-CTL-004` | Draft authorship SHALL NOT confer an oracle judgment, provider qualification, gate effect, assurance decision, member authority, or implementation permission. |
| `CSAA-008-CTL-005` | The adopted `JAN-CSAA-000@0.3.0` source identity SHALL remain exact. |
| `CSAA-008-CTL-006` | The provisional `JAN-CSAA-001` through `JAN-CSAA-007` source identities SHALL remain exact. |
| `CSAA-008-CTL-007` | The Wave 3 entry identity and provisional constraints SHALL remain exact. |
| `CSAA-008-CTL-008` | A source-byte or controlled-identity change SHALL trigger affected traceability and semantic reconciliation. |
| `CSAA-008-CTL-009` | Current-phase evidence SHALL use exact filesystem paths, bytes, SHA-256 digests, controlled identities, links, and document invariants. |
| `CSAA-008-CTL-010` | During the current exclusively owned documentation-authoring subphase, Git status, diff, branch, revision, and repository-wide polling SHALL NOT be used as documentation-subtree concurrency or currentness inputs. |
| `CSAA-008-CTL-011` | The final consolidated implementation refresh SHALL remain mandatory before exact-corpus freeze. |
| `CSAA-008-CTL-012` | Every executable artifact and result in this Draft SHALL remain explicitly not authorized, not authored, or not run as applicable. |
| `CSAA-008-CTL-013` | Every inherited `JAN-CSAA-006` expected judgment SHALL remain proposed, non-conferred, and non-executed. |
| `CSAA-008-CTL-014` | Every RGT SHALL remain `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`. |
| `CSAA-008-CTL-015` | The current Repository Gate Profile population SHALL remain exactly zero. |
| `CSAA-008-CTL-016` | Analysis Rule Profile binding authority SHALL remain `UNASSIGNED`. |
| `CSAA-008-CTL-017` | Definitive and interim ARP transition carriers SHALL remain `N/A — no instantiated RGP or protected transition` while no RGP or protected transition exists. |
| `CSAA-008-CTL-018` | No provider, adapter, model, database/feed, test tool, runner, storage engine, queue, scheduler, topology, or deployment SHALL be selected. |
| `CSAA-008-CTL-019` | Intermediate sponsor authorization SHALL NOT be required for this in-scope documentation subphase. |
| `CSAA-008-CTL-020` | Final sponsor review SHALL remain deferred to the exact completed corpus. |
| `CSAA-008-CTL-021` | No repository file SHALL be staged or committed by this documentation activity. |
| `CSAA-008-CTL-022` | A post-review candidate-byte change SHALL trigger affected re-review unless it satisfies the exact pre-frozen administrative-substitution exception. |
| `CSAA-008-CTL-023` | The document SHALL distinguish documentation-subphase closure from full executable Wave 3 exit. |
| `CSAA-008-CTL-024` | The document SHALL preserve every later executable predicate as an explicit nonpass. |
| `CSAA-008-CTL-025` | Every local requirement ID SHALL be permanent and unique. |
| `CSAA-008-CTL-026` | Every applicable inherited and local obligation SHALL receive an individual requirement-ledger row. |
| `CSAA-008-CTL-027` | No requirement SHALL receive a green verification state without method-bound reproducible evidence. |
| `CSAA-008-CTL-028` | The Initial Chat SHALL remain contextual background rather than normative authority. |
| `CSAA-008-CTL-029` | No prose example SHALL become competing machine-shape or oracle authority. |

### 28.2 Concern ownership and role separation

| ID | Requirement |
| --- | --- |
| `CSAA-008-OWN-001` | `JAN-CSAA-008` SHALL own analyzer-conformance and V&V method. |
| `CSAA-008-OWN-002` | `JAN-CSAA-008` SHALL own Conformance Case structure rather than the tested semantic meaning. |
| `CSAA-008-OWN-003` | The cited semantic document SHALL retain ownership of the meaning tested by each case. |
| `CSAA-008-OWN-004` | Independent oracle authority SHALL retain judgment standing and conferral for each case. |
| `CSAA-008-OWN-005` | `JAN-CSAA-002` SHALL retain semantic-object, relation, invariant, truth, and epistemic meaning. |
| `CSAA-008-OWN-006` | `JAN-CSAA-003` SHALL retain capability, query, slice, comparison, delta, and impact meaning. |
| `CSAA-008-OWN-007` | `JAN-CSAA-004` SHALL retain rule, result, finding, treatment, provider-obligation, and gate meaning. |
| `CSAA-008-OWN-008` | `JAN-CSAA-005` SHALL retain dated JPWB descriptive meaning. |
| `CSAA-008-OWN-009` | `JAN-CSAA-006` SHALL retain fixture-case and proposed expected-judgment strategy. |
| `CSAA-008-OWN-010` | `JAN-CSAA-007` SHALL retain candidate serialization and adapter-shape ownership. |
| `CSAA-008-OWN-011` | `JAN-CSAA-009` SHALL retain persistence, publication, invalidation, recovery, isolation, and operational meaning. |
| `CSAA-008-OWN-012` | `JAN-CSAA-010` SHALL retain coding-agent employment meaning. |
| `CSAA-008-OWN-013` | `JAN-CSAA-011` SHALL retain concrete provider selection, qualification, licensing, configuration, and removal. |
| `CSAA-008-OWN-014` | Canon SHALL retain professional assurance, evidence admissibility, decision, waiver, approval, and baseline meaning. |
| `CSAA-008-OWN-015` | A conformance specialization SHALL cite its semantic owner. |
| `CSAA-008-OWN-016` | A conformance specialization SHALL NOT redefine its cited semantic owner for implementation convenience. |
| `CSAA-008-OWN-017` | A test author SHALL NOT acquire oracle-conferral authority through authorship. |
| `CSAA-008-OWN-018` | An implementation or provider author SHALL NOT acquire oracle-conferral authority through output production. |
| `CSAA-008-OWN-019` | An executor SHALL NOT edit a failing oracle in the same action to obtain green. |
| `CSAA-008-OWN-020` | A provider-conformance result SHALL NOT become provider qualification. |
| `CSAA-008-OWN-021` | A test result SHALL NOT become a canonical assurance decision. |
| `CSAA-008-OWN-022` | A physical mechanism choice SHALL NOT reshape the semantic model. |
| `CSAA-008-OWN-023` | One semantic concern SHALL have one controlling owner and an explicit verification target. |

### 28.3 Exact source intake and allocation

| ID | Requirement |
| --- | --- |
| `CSAA-008-SRC-001` | The requirement ledger SHALL retain all 302 applicable adopted `JAN-CSAA-000` rows individually. |
| `CSAA-008-SRC-002` | The requirement ledger SHALL retain all 2,160 unaffected JAN-CSAA-001 through JAN-CSAA-006 predecessor local-catalog rows individually. |
| `CSAA-008-SRC-003` | The requirement ledger SHALL retain all 53 direct-canon rows individually. |
| `CSAA-008-SRC-004` | The requirement ledger SHALL retain all 53 Wave 3 readiness rows individually. |
| `CSAA-008-SRC-005` | The unaffected inherited subtotal SHALL equal exactly 2,568 before the exact current `JAN-CSAA-007@1.1.0` source, the exact historical `JAN-CSAA-009@0.1.0` finite-cutoff source, and local successor rows. |
| `CSAA-008-SRC-006` | Semantic overlap MAY map multiple source rows to one test specification. |
| `CSAA-008-SRC-007` | Semantic overlap SHALL NOT delete, merge, or renumber inherited source identities. |
| `CSAA-008-SRC-008` | Every source row SHALL map to at least one applicability or later-allocation conclusion. |
| `CSAA-008-SRC-009` | Every source row SHALL map to at least one planned verification method. |
| `CSAA-008-SRC-010` | Every local test requirement SHALL trace back to its governing source or explicit local composition rationale. |
| `CSAA-008-SRC-011` | The 302-row charter selection SHALL parse only requirement rows and exact source/target cells. |
| `CSAA-008-SRC-012` | Evidence prose containing `JAN-CSAA-008` SHALL NOT create a false charter-row intake. |
| `CSAA-008-SRC-013` | `CSAA-000-REQ-469` through `498` SHALL remain individually traceable. |
| `CSAA-008-SRC-014` | The evidence-priority rows `CSAA-000-REQ-606`, `608`, `610`, `612`, `614`, `616`, and `618` SHALL remain individually traceable. |
| `CSAA-008-SRC-015` | The red-first readiness rows `CSAA-000-REQ-704` through `707` SHALL remain individually traceable. |
| `CSAA-008-SRC-016` | `CSAA-000-REQ-577` and `629` SHALL retain their source-text-only `JAN-CSAA-008` handoffs. |
| `CSAA-008-SRC-017` | The exact current `JAN-CSAA-007@1.1.0` 652-row local catalog SHALL replace the archived 637-row predecessor source population without erasing predecessor evidence. |
| `CSAA-008-SRC-018` | Current predecessor objective closure SHALL NOT be interpreted as executable completion. |
| `CSAA-008-SRC-019` | Open predecessor self-review findings SHALL remain visible until affected successor evidence closes them. |
| `CSAA-008-SRC-020` | A changed predecessor SHALL invalidate only the affected allocations and conclusions, not erase prior evidence. |

### 28.4 Conformance package and test-specification model

| ID | Requirement |
| --- | --- |
| `CSAA-008-MOD-001` | A future conformance package SHALL separate catalog definition, case definition, executable artifact, run evidence, eligibility, and assurance use. |
| `CSAA-008-MOD-002` | Every `ConformanceCatalogDefinition` SHALL have a permanent ID and semantic version. |
| `CSAA-008-MOD-003` | Every `ConformanceTestSpecification` SHALL have a permanent ID and semantic version. |
| `CSAA-008-MOD-004` | Every `ConformanceCaseDefinition` SHALL have a permanent ID and semantic version. |
| `CSAA-008-MOD-005` | Every `ConformanceEligibilityAssessment` SHALL bind one exact complete evidence manifest. |
| `CSAA-008-MOD-006` | Every test specification SHALL resolve exactly the ordered facets `T01` through `T24`. |
| `CSAA-008-MOD-007` | A missing test-specification facet SHALL make the specification invalid. |
| `CSAA-008-MOD-008` | A blank test-specification facet SHALL make the specification invalid. |
| `CSAA-008-MOD-009` | A silently defaulted material facet SHALL make the specification invalid. |
| `CSAA-008-MOD-010` | A duplicate or merged test-specification facet SHALL make the specification invalid. |
| `CSAA-008-MOD-011` | A reasoned typed not-applicable value MAY satisfy a genuinely inapplicable facet. |
| `CSAA-008-MOD-012` | Every case SHALL bind applicability to its exact governing owner, version, rationale, and review evidence. |
| `CSAA-008-MOD-013` | Every case SHALL bind criticality to its exact governing owner, version, rationale, and review evidence. |
| `CSAA-008-MOD-014` | An unknown, unassigned, unreviewed, stale, or owner-incompatible applicability or criticality classification SHALL make the specification invalid. |
| `CSAA-008-MOD-015` | An implementation author, provider author, test author, executor, or renderer SHALL NOT downgrade applicability or criticality. |
| `CSAA-008-MOD-016` | A not-applicable classification SHALL NOT discharge an unconditional mandatory coordinate. |
| `CSAA-008-MOD-017` | An applicability or criticality change SHALL invalidate affected specifications, selections, results, coverage, and eligibility assessments. |
| `CSAA-008-MOD-018` | Every applicability and criticality classification SHALL receive independent review before green eligibility. |
| `CSAA-008-MOD-019` | A display name, file path, runner-native ID, provider-native ID, or array ordinal SHALL NOT substitute for permanent test identity. |
| `CSAA-008-MOD-020` | Retirement SHALL preserve the permanent test ID as a tombstone. |
| `CSAA-008-MOD-021` | A retired permanent test ID SHALL NOT be reused for another meaning. |
| `CSAA-008-MOD-022` | A parameterized case SHALL use a closed stable coordinate for every parameter member. |
| `CSAA-008-MOD-023` | A parameterized run SHALL report every stable coordinate independently. |
| `CSAA-008-MOD-024` | An aggregated parameterized pass SHALL NOT hide a missing, failed, skipped, unsupported, or unexecuted coordinate. |
| `CSAA-008-MOD-025` | Every case SHALL declare one exact case kind. |
| `CSAA-008-MOD-026` | Every case SHALL declare its execution lane. |
| `CSAA-008-MOD-027` | Every case SHALL declare the protected technical claim and explicit non-authority boundary. |
| `CSAA-008-MOD-028` | Every case SHALL declare exact preconditions and precondition-failure behavior. |
| `CSAA-008-MOD-029` | Every case SHALL declare its exact action. |
| `CSAA-008-MOD-030` | Every case SHALL declare its exact expected semantic result. |
| `CSAA-008-MOD-031` | Every case SHALL declare its exact expected evidence and diagnostics. |
| `CSAA-008-MOD-032` | Every case SHALL declare its exact failure meaning. |
| `CSAA-008-MOD-033` | Every case SHALL declare exact invalidation and re-execution dependencies. |
| `CSAA-008-MOD-034` | Existing source-level `TestRecord` semantics SHALL NOT be overloaded with conformance-specification meaning. |
| `CSAA-008-MOD-035` | Any future conformance-specification serialization SHALL be allocated to an affected `JAN-CSAA-007` successor. |
| `CSAA-008-MOD-036` | A prose-only case definition SHALL remain non-executable until content-bound physical realization exists. |

### 28.5 Evidence eligibility and no-false-green derivation

| ID | Requirement |
| --- | --- |
| `CSAA-008-ELG-001` | Conformance eligibility SHALL retain specification validity as an independent state axis. |
| `CSAA-008-ELG-002` | Conformance eligibility SHALL retain artifact availability as an independent state axis. |
| `CSAA-008-ELG-003` | Conformance eligibility SHALL retain oracle admissibility as an independent state axis. |
| `CSAA-008-ELG-004` | Conformance eligibility SHALL retain subject compatibility as an independent state axis. |
| `CSAA-008-ELG-005` | Conformance eligibility SHALL retain execution state as an independent state axis. |
| `CSAA-008-ELG-006` | Conformance eligibility SHALL retain harness health as an independent state axis. |
| `CSAA-008-ELG-007` | Conformance eligibility SHALL retain provider and adapter health dimensions independently. |
| `CSAA-008-ELG-008` | Conformance eligibility SHALL retain population closure as an independent state axis. |
| `CSAA-008-ELG-009` | Conformance eligibility SHALL retain assertion outcome as an independent state axis. |
| `CSAA-008-ELG-010` | Conformance eligibility SHALL retain evidence freshness as an independent state axis. |
| `CSAA-008-ELG-011` | Conformance eligibility SHALL retain differential state as an independent state axis. |
| `CSAA-008-ELG-012` | Conformance disposition SHALL be mechanically derived from the independent axes. |
| `CSAA-008-ELG-013` | `conformant-for-declared-scope` SHALL require every applicable specification to be valid and current. |
| `CSAA-008-ELG-014` | `conformant-for-declared-scope` SHALL require every required executable artifact to be content-bound, compatible, present, and authorized. |
| `CSAA-008-ELG-015` | `conformant-for-declared-scope` SHALL require every semantic oracle used by the case to be independently conferred and current. |
| `CSAA-008-ELG-016` | `conformant-for-declared-scope` SHALL require exact subject, fixture, implementation, provider, adapter, configuration, method, environment, and contract compatibility. |
| `CSAA-008-ELG-017` | `conformant-for-declared-scope` SHALL require every mandatory case and partition to complete. |
| `CSAA-008-ELG-018` | `conformant-for-declared-scope` SHALL require every required validation stage to pass. |
| `CSAA-008-ELG-019` | `conformant-for-declared-scope` SHALL require a nonempty applicable assertion population. |
| `CSAA-008-ELG-020` | `conformant-for-declared-scope` SHALL require every applicable assertion to pass. |
| `CSAA-008-ELG-021` | `conformant-for-declared-scope` SHALL require all mandatory positive, negative, boundary, invalid, and non-vacuity controls to execute. |
| `CSAA-008-ELG-022` | `conformant-for-declared-scope` SHALL require every critical applicable harness mutant to be killed. |
| `CSAA-008-ELG-023` | `conformant-for-declared-scope` SHALL require harness health to be `healthy`. |
| `CSAA-008-ELG-024` | `conformant-for-declared-scope` SHALL require `operationalHealth=healthy`, `contractHealth=compatible`, `resourceHealth=within-budget`, and `securityBoundaryHealth=within-declared-boundary` for every applicable provider and adapter. |
| `CSAA-008-ELG-025` | `conformant-for-declared-scope` SHALL require evidence freshness to be `current` for the exact subject and every applicable invalidation dependency. |
| `CSAA-008-ELG-026` | Required differential comparison SHALL permit green only for `agree-supported` or `agree-bounded-negative` with independently eligible compared outputs. |
| `CSAA-008-ELG-027` | A required `agree-wrong`, `disagree`, `one-sided-supported`, `one-sided-partial-or-stale`, `one-sided-failure`, `both-failed-or-unavailable`, or `incompatible-basis` differential state SHALL produce a non-green aggregate. |
| `CSAA-008-ELG-028` | Every eligibility assessment SHALL retain the complete set of triggered blocking reasons. |
| `CSAA-008-ELG-029` | The presentation-primary disposition SHALL use the fixed §9.1 precedence. |
| `CSAA-008-ELG-030` | Presentation precedence SHALL NOT delete a blocking reason or independent axis. |
| `CSAA-008-ELG-031` | A degraded, failed, unknown, or not-checked harness-health state SHALL produce a non-green aggregate. |
| `CSAA-008-ELG-032` | `operationalHealth=degraded` SHALL add `partial`. |
| `CSAA-008-ELG-033` | `operationalHealth=unavailable` SHALL add `unsupported`. |
| `CSAA-008-ELG-034` | `operationalHealth=failed`, `unknown`, or `not-checked` SHALL add `inconclusive`. |
| `CSAA-008-ELG-035` | `contractHealth=incompatible` SHALL add `invalid-test`. |
| `CSAA-008-ELG-036` | `contractHealth=unknown` or `not-checked` SHALL add `inconclusive`. |
| `CSAA-008-ELG-037` | `resourceHealth=degraded` SHALL add `partial`. |
| `CSAA-008-ELG-038` | `resourceHealth=exhausted` SHALL add `unsupported`. |
| `CSAA-008-ELG-039` | `resourceHealth=unknown` or `not-checked` SHALL add `inconclusive`. |
| `CSAA-008-ELG-040` | `securityBoundaryHealth=violation-observed` SHALL add `nonconformant`. |
| `CSAA-008-ELG-041` | `securityBoundaryHealth=unknown` or `not-checked` SHALL add `inconclusive`. |
| `CSAA-008-ELG-042` | A missing applicable provider-health observation or required dimension SHALL add `inconclusive`. |
| `CSAA-008-ELG-043` | A provider-native synonym or generic health label SHALL NOT enter the exact health mapping. |
| `CSAA-008-ELG-044` | Differential not-applicable SHALL require source-governed proof that comparison is not required. |
| `CSAA-008-ELG-045` | `conformant-for-declared-scope` SHALL require every applicable population and denominator to be closed for the claim. |
| `CSAA-008-ELG-046` | `conformant-for-declared-scope` SHALL require all applicable security and information-control predicates to pass. |
| `CSAA-008-ELG-047` | A mandatory skipped, cancelled, timed-out, resource-refused, errored, missing, stale, unsupported, partial, conflicting, or unresolved case SHALL produce a non-green aggregate. |
| `CSAA-008-ELG-048` | Missing oracle authority SHALL produce a non-green aggregate. |
| `CSAA-008-ELG-049` | Mixed-revision or subject-mismatched evidence SHALL produce a non-green aggregate. |
| `CSAA-008-ELG-050` | A presentation layer SHALL NOT coerce, average, suppress, or relabel a non-green state as green. |
| `CSAA-008-ELG-051` | A technically passed assertion MAY coexist with an ineligible overall conformance result. |
| `CSAA-008-ELG-052` | No partial-green or pass-with-missing-evidence disposition SHALL exist. |

### 28.6 Bidirectional traceability and coverage

| ID | Requirement |
| --- | --- |
| `CSAA-008-TRC-001` | Every source requirement SHALL trace forward to its concern-owned semantic definition. |
| `CSAA-008-TRC-002` | Every concern-owned semantic definition SHALL trace forward to its applicable contract family. |
| `CSAA-008-TRC-003` | Every applicable contract family SHALL trace forward to a Test Specification. |
| `CSAA-008-TRC-004` | Every Test Specification SHALL trace forward to its stable Case Definitions. |
| `CSAA-008-TRC-005` | Every Case Definition SHALL trace forward to its fixture and actual oracle standing. |
| `CSAA-008-TRC-006` | Every executed case SHALL trace forward to the exact implementation or provider subject. |
| `CSAA-008-TRC-007` | Every executed case SHALL trace forward to run, attempt, and assertion evidence. |
| `CSAA-008-TRC-008` | Every run SHALL trace forward to raw evidence, diagnostics, health, and limitations. |
| `CSAA-008-TRC-009` | Every bounded conformance disposition SHALL trace to one eligibility assessment. |
| `CSAA-008-TRC-010` | Every case and result SHALL trace backward to all governing requirements and owners. |
| `CSAA-008-TRC-011` | Requirement-to-test traceability MAY be many-to-many. |
| `CSAA-008-TRC-012` | Many-to-many traceability SHALL NOT lose a source identity. |
| `CSAA-008-TRC-013` | Coverage SHALL declare the exact eligible population and status. |
| `CSAA-008-TRC-014` | Coverage SHALL NOT be represented as correctness. |
| `CSAA-008-TRC-015` | Every conformance test ID SHALL close the reserved reverse mapping in `SourceToContractTraceRecord` when that shape exists. |
| `CSAA-008-TRC-016` | A missing reverse trace SHALL make the affected conformance claim ineligible. |

### 28.7 Schema package

| ID | Requirement |
| --- | --- |
| `CSAA-008-PKG-001` | The future schema-source test population SHALL contain exactly the nineteen `JAN-CSAA-007@1.1.0` schema-source IDs. |
| `CSAA-008-PKG-002` | Every future schema source SHALL receive an exact meta-schema validity case. |
| `CSAA-008-PKG-003` | Every future schema source SHALL receive accepted minimal and populated instance cases. |
| `CSAA-008-PKG-004` | Every future schema source SHALL receive missing-required-field and extra-closed-field cases. |
| `CSAA-008-PKG-005` | Every future schema source SHALL receive invalid-discriminator, enum, type, cardinality, format, and bound cases as applicable. |
| `CSAA-008-PKG-006` | Schema tests SHALL verify stable `$id`, contract version, dependency, lifecycle, and package membership. |
| `CSAA-008-PKG-007` | Schema tests SHALL verify typed digest-purpose parity. |
| `CSAA-008-PKG-008` | Schema tests SHALL verify identity-projection and reference-target parity. |
| `CSAA-008-PKG-009` | Schema tests SHALL verify envelope-assignment and subject-or-scope parity. |
| `CSAA-008-PKG-010` | Schema tests SHALL verify collection ordering, canonical key, duplicate, and cardinality parity. |
| `CSAA-008-PKG-011` | Schema tests SHALL verify finalization direction and cycle rejection. |
| `CSAA-008-PKG-012` | Schema tests SHALL reject inter-file dependency cycles. |
| `CSAA-008-PKG-013` | Schema tests SHALL enforce registered local recursion budgets. |
| `CSAA-008-PKG-014` | Schema tests SHALL distinguish permitted bounded local recursion from prohibited inter-file and finalization cycles. |
| `CSAA-008-PKG-015` | Package tests SHALL verify that the index is the sole package entry point. |
| `CSAA-008-PKG-016` | Package tests SHALL verify the index non-self-hashing rule. |
| `CSAA-008-PKG-017` | Package tests SHALL fail when one declared schema source is omitted. |
| `CSAA-008-PKG-018` | Package tests SHALL fail when prose and enforced shape disagree. |
| `CSAA-008-PKG-019` | Unknown core fields SHALL be rejected unless an exact contract permits them. |
| `CSAA-008-PKG-020` | Registered extensions SHALL remain semantically subordinate to their owner. |

### 28.8 Generated derivative fidelity

| ID | Requirement |
| --- | --- |
| `CSAA-008-GEN-001` | The generated-derivative test population SHALL contain exactly `GEN-TYPES`, `GEN-IDS`, `GEN-VALIDATORS`, `GEN-MANIFEST`, and `GEN-INDEX`. |
| `CSAA-008-GEN-002` | Generation tests SHALL bind every exact schema-source digest. |
| `CSAA-008-GEN-003` | Generation tests SHALL bind generator implementation digest, version, configuration, invocation, and environment. |
| `CSAA-008-GEN-004` | Two clean generations from identical deterministic inputs SHALL produce byte-identical declared deterministic outputs. |
| `CSAA-008-GEN-005` | Generated types SHALL match every schema discriminator, field, enum, cardinality, and reference type. |
| `CSAA-008-GEN-006` | Generated identities SHALL match every registered permanent discriminator and registry member. |
| `CSAA-008-GEN-007` | Generated validators SHALL match every schema validation branch. |
| `CSAA-008-GEN-008` | Generated exports SHALL include every declared generated derivative. |
| `CSAA-008-GEN-009` | The generation manifest SHALL bind every source and output digest required by `JAN-CSAA-007`. |
| `CSAA-008-GEN-010` | The generation manifest SHALL NOT hash itself. |
| `CSAA-008-GEN-011` | A schema-source mutation SHALL produce an exact affected derivative delta or visible generation failure. |
| `CSAA-008-GEN-012` | A hand-edited generated output without a source change SHALL fail fidelity. |
| `CSAA-008-GEN-013` | A stale generated export SHALL fail fidelity. |
| `CSAA-008-GEN-014` | A generated validator that silently coerces invalid material SHALL fail fidelity. |
| `CSAA-008-GEN-015` | A generated default not present in the shape source SHALL fail fidelity. |
| `CSAA-008-GEN-016` | An omitted generated variant SHALL fail non-vacuity. |
| `CSAA-008-GEN-017` | Generated TypeScript SHALL remain derivative rather than independent shape authority. |
| `CSAA-008-GEN-018` | No generated derivative SHALL be represented as existing in this Draft. |

### 28.9 Common identity, reference, envelope, collection, and finalization

| ID | Requirement |
| --- | --- |
| `CSAA-008-COM-001` | Every purpose-specific digest kind SHALL receive substitution-confusion negative tests. |
| `CSAA-008-COM-002` | A record digest SHALL NOT substitute for a raw-byte, artifact, contract, or subject digest. |
| `CSAA-008-COM-003` | Every identity-only reference SHALL reject a content-bound-only use where the contract forbids it. |
| `CSAA-008-COM-004` | Every content-bound reference SHALL reject an identity-only target where material finality is required. |
| `CSAA-008-COM-005` | All 144 legacy and 32 disjoint operational top-level assignments SHALL receive coverage. |
| `CSAA-008-COM-006` | An object under the wrong envelope SHALL be rejected. |
| `CSAA-008-COM-007` | Every registered collection semantic SHALL receive ordering and duplicate-key cases. |
| `CSAA-008-COM-008` | A canonical-key collision SHALL be rejected rather than silently deduplicated. |
| `CSAA-008-COM-009` | Material array canonicalization SHALL be deterministic. |
| `CSAA-008-COM-010` | Null, omission, unknown, and reasoned not-applicable SHALL remain distinct. |
| `CSAA-008-COM-011` | A predecessor lifecycle edge SHALL point only to an already finalized predecessor. |
| `CSAA-008-COM-012` | Reverse successor navigation SHALL remain derived rather than serialized authority. |
| `CSAA-008-COM-013` | The content-finalization graph SHALL be acyclic. |
| `CSAA-008-COM-014` | A retired reference-registry tombstone SHALL remain inactive. |
| `CSAA-008-COM-015` | A retired reference-registry ID SHALL NOT be reused. |
| `CSAA-008-COM-016` | Embedded helper values SHALL preserve every nested reference target and finalization rule. |
| `CSAA-008-COM-017` | Unknown namespaced extensions MAY round-trip under their exact owner. |
| `CSAA-008-COM-018` | Unknown namespaced extensions SHALL NOT become core semantics by name similarity. |

### 28.10 Subject, snapshot, publication, freshness, and invalidation

| ID | Requirement |
| --- | --- |
| `CSAA-008-SUB-001` | Every test subject SHALL bind exact repository and revision identity. |
| `CSAA-008-SUB-002` | Every worktree subject SHALL bind its exact worktree and change-set identity. |
| `CSAA-008-SUB-003` | Before/after tests SHALL label each subject role explicitly. |
| `CSAA-008-SUB-004` | Mixed-revision facts SHALL be rejected from one current semantic snapshot. |
| `CSAA-008-SUB-005` | A snapshot SHALL bind exact included and excluded perimeter. |
| `CSAA-008-SUB-006` | A publication test SHALL require a complete content-bound member manifest. |
| `CSAA-008-SUB-007` | An incomplete candidate publication SHALL NOT become current. |
| `CSAA-008-SUB-008` | A failed publication SHALL preserve prior-publication identity separately. |
| `CSAA-008-SUB-009` | Freshness tests SHALL bind every applicable invalidation dependency. |
| `CSAA-008-SUB-010` | An unresolved applicable invalidation dependency SHALL make currentness invalid. |
| `CSAA-008-SUB-011` | A changed subject SHALL invalidate every affected test result. |
| `CSAA-008-SUB-012` | A path or display name SHALL NOT substitute for repository subject identity. |
| `CSAA-008-SUB-013` | A content-identical artifact from another unauthorized subject SHALL NOT be silently correlated. |
| `CSAA-008-SUB-014` | A successful empty result SHALL require exact subject-resolution success. |
| `CSAA-008-SUB-015` | A subject mismatch SHALL make normalized output inert. |
| `CSAA-008-SUB-016` | A worktree or branch cache entry SHALL NOT cross its declared isolation boundary. |

### 28.11 Artifact, build, instrumentation, and source mapping

| ID | Requirement |
| --- | --- |
| `CSAA-008-ART-001` | Artifact tests SHALL distinguish authored, generated, virtual, declaration, configuration, test, and external roles. |
| `CSAA-008-ART-002` | A generated or virtual artifact SHALL NOT be classified as authored. |
| `CSAA-008-ART-003` | Every generated artifact SHALL bind exact generator, inputs, configuration, invocation, and origin mapping. |
| `CSAA-008-ART-004` | Every build artifact SHALL bind its producing build execution and content digest. |
| `CSAA-008-ART-005` | Every execution artifact SHALL bind its exact producing build and source mapping. |
| `CSAA-008-ART-006` | Every build execution SHALL bind the effective configuration and toolchain. |
| `CSAA-008-ART-007` | Instrumentation evidence SHALL bind configuration, sites, target artifact, and provider method. |
| `CSAA-008-ART-008` | A source map SHALL bind producer, version, source artifacts, target artifacts, mappings, and quality. |
| `CSAA-008-ART-009` | An authored-to-virtual diagnostic case SHALL verify exact range mapping. |
| `CSAA-008-ART-010` | Every framework-source mapping case SHALL bind the complete authored-to-generator-to-virtual-to-build-or-execution-to-observation provenance chain. |
| `CSAA-008-ART-011` | Every applicable mapping case SHALL verify authored-to-virtual resolution independently. |
| `CSAA-008-ART-012` | Every applicable mapping case SHALL verify virtual-to-authored resolution independently. |
| `CSAA-008-ART-013` | A mapping through the wrong generated, virtual, build, execution, or source-map artifact SHALL be rejected. |
| `CSAA-008-ART-014` | A broken source mapping SHALL produce explicit bounded attribution failure. |
| `CSAA-008-ART-015` | An ambiguous source mapping SHALL NOT silently select an authored location. |
| `CSAA-008-ART-016` | A runtime-to-source correlation SHALL bind build and origin mapping. |
| `CSAA-008-ART-017` | A build identity from another configuration SHALL invalidate coverage and trace correlation. |
| `CSAA-008-ART-018` | An artifact-classification change SHALL trigger affected invalidation. |
| `CSAA-008-ART-019` | A generated-output mutation SHALL preserve its changed content identity and lineage. |
| `CSAA-008-ART-020` | No artifact case SHALL treat a file extension as sufficient role evidence. |

### 28.12 Semantic object variants

| ID | Requirement |
| --- | --- |
| `CSAA-008-OBJ-001` | The semantic-object conformance population SHALL contain all 127 permanent object variants. |
| `CSAA-008-OBJ-002` | Every object variant SHALL receive a valid minimal case. |
| `CSAA-008-OBJ-003` | Every object variant SHALL receive a valid populated case. |
| `CSAA-008-OBJ-004` | Every object variant SHALL receive at least one variant-specific invalid case. |
| `CSAA-008-OBJ-005` | Every object variant SHALL verify its exact discriminator. |
| `CSAA-008-OBJ-006` | Every object variant SHALL verify its assigned profile and envelope. |
| `CSAA-008-OBJ-007` | Every object variant SHALL verify its exact subject-or-scope policy. |
| `CSAA-008-OBJ-008` | Every object variant SHALL verify required and optional field cardinalities. |
| `CSAA-008-OBJ-009` | Every object variant SHALL verify its exact identity projection. |
| `CSAA-008-OBJ-010` | Every object variant SHALL verify applicable reference directions. |
| `CSAA-008-OBJ-011` | Every object variant SHALL verify applicable collection semantics. |
| `CSAA-008-OBJ-012` | Every object variant SHALL verify applicable finalization dependencies. |
| `CSAA-008-OBJ-013` | Every object variant SHALL expose every applicable `INV-*` target. |
| `CSAA-008-OBJ-014` | An omitted object variant SHALL fail catalog non-vacuity. |
| `CSAA-008-OBJ-015` | A duplicate object discriminator SHALL fail package conformance. |
| `CSAA-008-OBJ-016` | A profile mismatch SHALL make the object invalid. |
| `CSAA-008-OBJ-017` | A wrong-subject object SHALL make the object invalid. |
| `CSAA-008-OBJ-018` | A hostile object payload SHALL remain inert after validation failure. |

### 28.13 Semantic relation variants and graphs

| ID | Requirement |
| --- | --- |
| `CSAA-008-REL-001` | The semantic-relation conformance population SHALL contain all 137 permanent relation variants. |
| `CSAA-008-REL-002` | Every relation variant SHALL receive a valid minimal case. |
| `CSAA-008-REL-003` | Every relation variant SHALL receive a valid populated case. |
| `CSAA-008-REL-004` | Every relation variant SHALL receive at least one variant-specific invalid case. |
| `CSAA-008-REL-005` | Every relation variant SHALL verify its exact permanent relation ID and discriminator. |
| `CSAA-008-REL-006` | Every relation variant SHALL verify endpoint roles. |
| `CSAA-008-REL-007` | Every relation variant SHALL verify endpoint order where order is material. |
| `CSAA-008-REL-008` | Every relation variant SHALL verify endpoint cardinality. |
| `CSAA-008-REL-009` | Every relation variant SHALL reject an invalid endpoint type. |
| `CSAA-008-REL-010` | Every relation variant SHALL verify required metadata. |
| `CSAA-008-REL-011` | Every relation variant SHALL verify its structural, semantic, inferred, mapping, execution, external, or lifecycle profile. |
| `CSAA-008-REL-012` | Every inferred relation SHALL retain its inference basis and limitations. |
| `CSAA-008-REL-013` | Every compiler-confirmed relation SHALL reject inferred-only evidence. |
| `CSAA-008-REL-014` | Every cross-revision relation SHALL label each endpoint revision. |
| `CSAA-008-REL-015` | Every graph edge SHALL resolve to admitted nodes or an explicitly permitted external descriptor. |
| `CSAA-008-REL-016` | Every graph layer SHALL bind its contributing object and relation populations. |
| `CSAA-008-REL-017` | A graph completeness claim SHALL bind exact coverage basis. |
| `CSAA-008-REL-018` | An omitted relation variant SHALL fail catalog non-vacuity. |
| `CSAA-008-REL-019` | A duplicate relation discriminator SHALL fail package conformance. |
| `CSAA-008-REL-020` | An invalid relation SHALL remain inert after validation failure. |

### 28.14 Semantic invariants

| ID | Requirement |
| --- | --- |
| `CSAA-008-INV-001` | Every `INV-001` through `INV-014` SHALL receive at least one satisfying case. |
| `CSAA-008-INV-002` | Every `INV-001` through `INV-014` SHALL receive at least one isolated violating case. |
| `CSAA-008-INV-003` | Every applicable invariant SHALL receive a cross-graph case. |
| `CSAA-008-INV-004` | Every critical invariant SHALL receive a harness mutant that disables or inverts its validator. |
| `CSAA-008-INV-005` | `INV-001` tests SHALL reject missing exact subject or provenance. |
| `CSAA-008-INV-006` | `INV-002` tests SHALL reject an unlabeled cross-revision endpoint. |
| `CSAA-008-INV-007` | `INV-003` tests SHALL reject normalized provider facts with erased raw lineage. |
| `CSAA-008-INV-008` | `INV-004` tests SHALL reject incomplete coverage identity. |
| `CSAA-008-INV-009` | `INV-005` tests SHALL reject incomplete runtime-observation identity. |
| `CSAA-008-INV-010` | `INV-006` tests SHALL reject transformed attribution without origin mapping. |
| `CSAA-008-INV-011` | `INV-007` tests SHALL reject inferred relations mislabeled compiler-confirmed. |
| `CSAA-008-INV-012` | `INV-008` tests SHALL reject completeness without coverage basis. |
| `CSAA-008-INV-013` | `INV-009` tests SHALL reject finding lifecycle that erases prior Engineering Evidence Records. |
| `CSAA-008-INV-014` | `INV-010` tests SHALL reject incomplete resolved-module identity. |
| `CSAA-008-INV-015` | `INV-011` tests SHALL reject architecture conformance without recognized rule, version, scope, and exception state. |
| `CSAA-008-INV-016` | `INV-012` tests SHALL reject generated or virtual material labeled authored. |
| `CSAA-008-INV-017` | `INV-013` tests SHALL reject static/dynamic correlation across mismatched snapshots. |
| `CSAA-008-INV-018` | `INV-014` tests SHALL reject currentness with unresolved applicable dependencies. |
| `CSAA-008-INV-019` | Golden cases SHALL keep AST, symbol, type, dependency, call, CFG, DFG, taint, and CPG layers distinguishable. |
| `CSAA-008-INV-020` | Each of the nine registered graph-layer coordinates SHALL receive at least one exact positive case. |
| `CSAA-008-INV-021` | Each of the nine registered graph-layer coordinates SHALL receive at least one controlled wrong-result negative case. |
| `CSAA-008-INV-022` | Each of the nine registered graph-layer coordinates SHALL receive at least one controlled incomplete or unsupported case. |
| `CSAA-008-INV-023` | Every graph-layer case SHALL bind expected objects, relations, witnesses, source occurrences, subjects, profiles, providers, raw evidence, and provenance. |
| `CSAA-008-INV-024` | No one graph SHALL be treated as a universal semantic authority. |

### 28.15 Capability profiles and composition

| ID | Requirement |
| --- | --- |
| `CSAA-008-CAP-001` | The capability structural population SHALL contain exactly 32 permanent profiles. |
| `CSAA-008-CAP-002` | Every capability profile SHALL resolve exactly one value for each `F01` through `F28`. |
| `CSAA-008-CAP-003` | The capability-facet population SHALL equal exactly 896 cells. |
| `CSAA-008-CAP-004` | Capability-facet parsing SHALL use explicit ordered labels rather than punctuation splitting. |
| `CSAA-008-CAP-005` | A missing capability-facet label SHALL be rejected. |
| `CSAA-008-CAP-006` | A duplicate capability-facet label SHALL be rejected. |
| `CSAA-008-CAP-007` | A reordered capability-facet label SHALL be rejected. |
| `CSAA-008-CAP-008` | An ambiguously parsed or punctuation-derived facet boundary SHALL be rejected. |
| `CSAA-008-CAP-009` | Capability dependency tests SHALL reject a cycle. |
| `CSAA-008-CAP-010` | Capability dependency tests SHALL reject a missing prerequisite. |
| `CSAA-008-CAP-011` | Capability dependency tests SHALL reject an incompatible prerequisite version. |
| `CSAA-008-CAP-012` | A materialized plan SHALL respect capability dependency order. |
| `CSAA-008-CAP-013` | Scheduling order SHALL remain distinct from semantic dependency order. |
| `CSAA-008-CAP-014` | Each capability SHALL receive supported positive, closed-basis negative, unknown, partial, conflict, stale, dynamic or reasoned not-applicable, and non-vacuity coverage as applicable. |
| `CSAA-008-CAP-015` | The capability-outcome matrix SHALL contain exactly 256 coordinates. |
| `CSAA-008-CAP-016` | Every capability matrix coordinate SHALL bind a full Scenario Profile identity. |
| `CSAA-008-CAP-017` | Unsupported capability coverage SHALL NOT satisfy a required capability. |
| `CSAA-008-CAP-018` | Unavailable provider coverage SHALL NOT satisfy a required capability. |
| `CSAA-008-CAP-019` | A profile limitation SHALL remain visible in every affected case. |
| `CSAA-008-CAP-020` | Capability conformance SHALL NOT create capability ownership or provider qualification. |

### 28.16 Query, slicing, comparison, impact, and reachability

| ID | Requirement |
| --- | --- |
| `CSAA-008-QRY-001` | Every query case SHALL bind exact subject and compatible capability profiles. |
| `CSAA-008-QRY-002` | Every query expression SHALL use a registered discriminator and typed operands. |
| `CSAA-008-QRY-003` | Query-expression recursion SHALL remain within the registered local bound. |
| `CSAA-008-QRY-004` | Expression-budget tests SHALL cover depth, node, fanout, path, result, time, and resource limits. |
| `CSAA-008-QRY-005` | Budget refusal SHALL remain distinct from semantic empty. |
| `CSAA-008-QRY-006` | Truth projection SHALL remain independent from completeness. |
| `CSAA-008-QRY-007` | Truth projection SHALL remain independent from freshness. |
| `CSAA-008-QRY-008` | Truth projection SHALL remain independent from support and conflict. |
| `CSAA-008-QRY-009` | Unknown and conflict SHALL remain distinct under negation. |
| `CSAA-008-QRY-010` | Every ordered query result SHALL expose a complete deterministic ordering key. |
| `CSAA-008-QRY-011` | Every cursor SHALL bind subject, query, order, page size, and result basis. |
| `CSAA-008-QRY-012` | Concatenated valid pages SHALL equal the compatible bounded unpaged canonical result. |
| `CSAA-008-QRY-013` | Page-size variation SHALL NOT change the compatible member set or canonical order. |
| `CSAA-008-QRY-014` | Cross-revision cursor reuse SHALL be rejected. |
| `CSAA-008-QRY-015` | Successful empty SHALL require executed, supported, healthy, current, closed, non-truncated population evidence. |
| `CSAA-008-QRY-016` | Partial, unsupported, conflict, stale, timeout, cancellation, and resource refusal SHALL remain explicit. |
| `CSAA-008-QRY-017` | Every positive slice member SHALL have a typed witness path. |
| `CSAA-008-QRY-018` | Every unresolved slice member SHALL retain its frontier and needed evidence. |
| `CSAA-008-QRY-019` | Before/after reversal SHALL invert only owner-declared directional delta classes. |
| `CSAA-008-QRY-020` | A comparison SHALL retain unresolved matches and incompatible basis. |
| `CSAA-008-QRY-021` | Every positive impact candidate SHALL have at least one exact witness. |
| `CSAA-008-QRY-022` | A count-only impact result SHALL fail explanation adequacy. |
| `CSAA-008-QRY-023` | Every reachability assessment SHALL evaluate all twelve entry mechanisms. |
| `CSAA-008-QRY-024` | An observed unregistered entry mechanism SHALL create an unsupported frontier. |
| `CSAA-008-QRY-025` | `candidate-unreachable-within-closed-surface` SHALL require every applicable mechanism and population to be closed and successfully resolved. |
| `CSAA-008-QRY-026` | Zero static callers SHALL NOT produce deadness, safe removal, approval, or permission. |
| `CSAA-008-QRY-027` | Query tests SHALL exercise all four negation cases and every one of the sixteen conjunction and sixteen disjunction cells. |
| `CSAA-008-QRY-028` | Query properties SHALL verify associative and commutative projected truth for conjunction and disjunction across all four values. |
| `CSAA-008-QRY-029` | Query properties SHALL verify both De Morgan transformations across all four-valued input pairs. |
| `CSAA-008-QRY-030` | Query validation SHALL reject empty conjunction and disjunction expressions. |
| `CSAA-008-QRY-031` | Query cases SHALL preserve reasoned not-applicable, excluded, unsupported, and not-evaluated child states without Boolean coercion and SHALL verify `NOT(N/A)=N/A`, the all-N/A parent rule, and the exact six mixed N/A outcomes owned by `JAN-CSAA-003@0.2.0`, including retained conflict. |
| `CSAA-008-QRY-032` | Complete and decisive-short-circuit evaluation SHALL produce equivalent projected truth over the same available child evidence. |
| `CSAA-008-QRY-033` | Short-circuit cases SHALL stop only on supported-false conjunction or supported-true disjunction. |
| `CSAA-008-QRY-034` | Every short-circuit case SHALL retain decisive-child, intermediate-truth, skipped-child, and not-evaluated evidence. |
| `CSAA-008-QRY-035` | A decisive projected truth SHALL NOT erase contributing conflict, epistemic state, or provenance. |
| `CSAA-008-QRY-036` | A two-valued or three-valued implementation SHALL fail the four-valued non-vacuity controls. |
| `CSAA-008-QRY-037` | Query-algebra mutation tests SHALL kill operator swap, unknown/conflict collapse, not-applicable coercion, invalid short-circuit, and skipped-child fabrication defects. |
| `CSAA-008-QRY-038` | Query validation SHALL apply structural, depth, node-count, fanout, traversal, path, time, and resource checks to the complete normalized AST before evaluation so that a skipped branch cannot evade any budget or shape constraint. |
| `CSAA-008-QRY-039` | Every normalized AST node SHALL receive exactly one `applicable-result`, `not-applicable`, or `short-circuited` evaluation disposition, with truth prohibited on the latter two dispositions. |
| `CSAA-008-QRY-040` | Root-result tests SHALL independently partition supported-true matches, supported-false nonmatches, applicable unknown regions, predicate-projection conflict regions, not-applicable regions, and omitted-or-unevaluated regions. |
| `CSAA-008-QRY-041` | Branch-complete tests SHALL verify the exact `JAN-CSAA-003@0.2.0` parent-composition algorithm for support basis, capability coverage, execution health, freshness, conflict, and inference, including each effective value and its canonically ordered child contribution vector. |
| `CSAA-008-QRY-042` | Closed, completely evaluated empty populations SHALL yield supported-false for existential quantification and supported-true for universal quantification; absent demonstrated closure and complete evaluation, each SHALL yield unknown. |
| `CSAA-008-QRY-043` | A complete-child-evidence, diagnostic-completeness, or provenance-completeness request SHALL disable short-circuiting and SHALL require every applicable child to receive an attempted evaluation. |

### 28.17 Test, coverage, runtime, and trace evidence

| ID | Requirement |
| --- | --- |
| `CSAA-008-EXE-001` | Every test run SHALL bind exact runner definition, version, configuration, target, and selection. |
| `CSAA-008-EXE-002` | Every test attempt SHALL retain exact ordinal, timing, raw output, diagnostics, and outcome. |
| `CSAA-008-EXE-003` | Retry aggregation SHALL retain every attempt. |
| `CSAA-008-EXE-004` | `skipped-by-declared-policy` SHALL NOT count as passing evidence. |
| `CSAA-008-EXE-005` | `not-run` SHALL NOT count as passing evidence. |
| `CSAA-008-EXE-006` | `unknown` SHALL NOT count as passing evidence. |
| `CSAA-008-EXE-007` | Every coverage observation SHALL bind exact execution artifact and producing build. |
| `CSAA-008-EXE-008` | Every coverage observation SHALL bind instrumentation configuration and sites. |
| `CSAA-008-EXE-009` | Every coverage observation SHALL bind selection or workload, regions, denominator, and granularity. |
| `CSAA-008-EXE-010` | A coverage percentage without numerator and denominator SHALL be invalid. |
| `CSAA-008-EXE-011` | A coverage delta SHALL require compatible subjects, providers, mappings, denominators, and granularities. |
| `CSAA-008-EXE-012` | Every runtime execution SHALL bind exact build, environment, workload, input, instrumentation, authorization, resource limits, and health. |
| `CSAA-008-EXE-013` | Every trace SHALL bind exact execution, schema, collector observation, environment, workload, and time boundary. |
| `CSAA-008-EXE-014` | Dropped events, backpressure, sampling, clock, and ordering limitations SHALL remain visible. |
| `CSAA-008-EXE-015` | A trace from another build or environment SHALL be rejected from correlation. |
| `CSAA-008-EXE-016` | A coverage observation from another selection or cutoff SHALL be rejected from correlation. |
| `CSAA-008-EXE-017` | Runtime observation SHALL NOT prune unobserved static possibilities by absence alone. |
| `CSAA-008-EXE-018` | Coverage SHALL NOT be represented as preserved behavior. |
| `CSAA-008-EXE-019` | A mapping failure SHALL prevent exact authored-source attribution. |
| `CSAA-008-EXE-020` | Observation currentness SHALL expire or invalidate according to exact dependencies. |

### 28.18 Rules, results, findings, and treatments

| ID | Requirement |
| --- | --- |
| `CSAA-008-RUL-001` | All seventeen exact Analysis Rule Profiles SHALL receive conformance coverage. |
| `CSAA-008-RUL-002` | Every ARP test SHALL preserve its fixed claim character. |
| `CSAA-008-RUL-003` | Every ARP test SHALL preserve applicability separately from evaluation completion. |
| `CSAA-008-RUL-004` | Every ARP test SHALL preserve technical outcome separately from evidence sufficiency. |
| `CSAA-008-RUL-005` | Every ARP test SHALL preserve freshness separately from conflict. |
| `CSAA-008-RUL-006` | Every applicable ARP SHALL receive positive and negative criterion cases. |
| `CSAA-008-RUL-007` | Every applicable ARP SHALL receive inconclusive, partial, stale, disagreement, and provider-failure cases. |
| `CSAA-008-RUL-008` | A finding SHALL be emitted only when the exact claim character and criterion require it. |
| `CSAA-008-RUL-009` | Every finding SHALL retain its Engineering Evidence Records. |
| `CSAA-008-RUL-010` | Finding correction SHALL create append-only successor history. |
| `CSAA-008-RUL-011` | Remediation SHALL NOT erase the prior finding or result. |
| `CSAA-008-RUL-012` | Disposition SHALL NOT erase the prior finding or result. |
| `CSAA-008-RUL-013` | Suppression SHALL modify treatment rather than technical outcome. |
| `CSAA-008-RUL-014` | Exception SHALL modify treatment rather than technical outcome. |
| `CSAA-008-RUL-015` | Configuration silence SHALL NOT create an exception. |
| `CSAA-008-RUL-016` | An implementation, test, finding, or change author SHALL NOT self-approve an exception. |
| `CSAA-008-RUL-017` | A rule result contributing to a future positive gate SHALL bind exact conformance, oracle, and provider-qualification evidence. |
| `CSAA-008-RUL-018` | An ineligible child result SHALL prevent a green aggregate. |
| `CSAA-008-RUL-019` | Provider substitution SHALL NOT weaken a rule criterion. |
| `CSAA-008-RUL-020` | Provider substitution SHALL trigger new exact qualification and affected reanalysis before future eligible use. |
| `CSAA-008-RUL-021` | Every ARP SHALL retain definitive and interim transition carriers as `N/A — no instantiated RGP or protected transition` while no RGP or protected transition exists. |
| `CSAA-008-RUL-022` | A fabricated ARP carrier, binding, protected transition, or bypass path SHALL be rejected. |
| `CSAA-008-RUL-023` | Every applicable ARP SHALL receive a non-bypassability case. |
| `CSAA-008-RUL-024` | Rule mutation tests SHALL plant the exact target defect rather than an unrelated compilation failure. |

### 28.19 Gate-template inertness and misuse rejection

| ID | Requirement |
| --- | --- |
| `CSAA-008-GAT-001` | The RGT conformance population SHALL contain exactly twelve inert templates. |
| `CSAA-008-GAT-002` | Every RGT SHALL receive one inert-baseline case. |
| `CSAA-008-GAT-003` | Every RGT SHALL receive one misuse-rejection case. |
| `CSAA-008-GAT-004` | The RGT matrix SHALL contain exactly 24 coordinates. |
| `CSAA-008-GAT-005` | A test SHALL reject use of an RGT as an RGP. |
| `CSAA-008-GAT-006` | A test SHALL reject use of an RGT as a Gate Evaluation input. |
| `CSAA-008-GAT-007` | A test SHALL reject use of an RGT as permit, block, withhold, waiver, or approval authority. |
| `CSAA-008-GAT-008` | A test SHALL reject an RGT-generated transition effect. |
| `CSAA-008-GAT-009` | A test SHALL reject a fabricated permanent RGP identity. |
| `CSAA-008-GAT-010` | A test SHALL reject fabricated designation-supplied fields. |
| `CSAA-008-GAT-011` | The current RGP population SHALL remain exactly zero. |
| `CSAA-008-GAT-012` | A green test presentation SHALL NOT create a gate effect. |
| `CSAA-008-GAT-013` | A future gate test SHALL require exact recognized designation authority. |
| `CSAA-008-GAT-014` | A future positive gate case SHALL require a recognized definitive non-bypassable transition carrier. |
| `CSAA-008-GAT-015` | A future gate test SHALL require exact provider qualification and conferred oracle evidence. |
| `CSAA-008-GAT-016` | No future gate prerequisite SHALL be represented as currently satisfied. |

### 28.20 Fixture, scenario, oracle, and matrix governance

| ID | Requirement |
| --- | --- |
| `CSAA-008-ORC-001` | Every Scenario Profile SHALL resolve exactly the ordered facets `S01` through `S30`. |
| `CSAA-008-ORC-002` | A missing, blank, duplicate, reordered, merged, or silently defaulted Scenario Profile facet SHALL be invalid. |
| `CSAA-008-ORC-003` | The fixture scenario-family population SHALL contain exactly twenty families. |
| `CSAA-008-ORC-004` | The paired scenario population SHALL contain exactly forty positive and controlled-countercase identities. |
| `CSAA-008-ORC-005` | The zero-static-callers population SHALL contain exactly nine identities. |
| `CSAA-008-ORC-006` | Every zero-static-callers case SHALL include unresolved, positive-entry contradiction, and closed-negative controls. |
| `CSAA-008-ORC-007` | The capability matrix SHALL contain exactly 256 cells. |
| `CSAA-008-ORC-008` | The ARP matrix SHALL contain exactly 187 cells. |
| `CSAA-008-ORC-009` | The RGT matrix SHALL contain exactly 24 cells. |
| `CSAA-008-ORC-010` | Every matrix cell SHALL bind a full Scenario Profile identity. |
| `CSAA-008-ORC-011` | A requirement-cluster shorthand SHALL NOT substitute for a Scenario Profile identity. |
| `CSAA-008-ORC-012` | Every expected judgment SHALL preserve proposal, conferral, and execution state independently. |
| `CSAA-008-ORC-013` | A proposed or non-conferred expected judgment SHALL NOT make semantic conformance eligible for pass. |
| `CSAA-008-ORC-014` | A provider output SHALL NOT become an expected judgment by copying or majority vote. |
| `CSAA-008-ORC-015` | The implementation stream SHALL remain distinct from the oracle stream. |
| `CSAA-008-ORC-016` | A suspected oracle error SHALL create a visible divergence. |
| `CSAA-008-ORC-017` | Oracle correction SHALL create a reviewed successor rather than rewrite history. |
| `CSAA-008-ORC-018` | A change author SHALL NOT weaken a pre-existing expected judgment in the same action. |
| `CSAA-008-ORC-019` | Every physical fixture SHALL begin from an immutable declared initial state. |
| `CSAA-008-ORC-020` | Every fixture mutation SHALL bind exact reset identity and residue check. |
| `CSAA-008-ORC-021` | Synthetic and dated-JPWB lanes SHALL retain distinct currentness standing. |
| `CSAA-008-ORC-022` | A dated-JPWB fixture SHALL NOT float to a later repository state. |
| `CSAA-008-ORC-023` | Fixture or oracle authoring SHALL NOT create assurance or gate authority. |
| `CSAA-008-ORC-024` | Oracle adequacy SHALL itself receive mutation and tests-of-tests evidence. |

### 28.21 Property and metamorphic conformance

| ID | Requirement |
| --- | --- |
| `CSAA-008-PRP-001` | Every property test SHALL have a permanent property ID and semantic version. |
| `CSAA-008-PRP-002` | Every property test SHALL bind exact applicable contract and semantic versions. |
| `CSAA-008-PRP-003` | Every property test SHALL bind generator implementation, version, digest, parameters, and seed. |
| `CSAA-008-PRP-004` | Every property test SHALL declare its generated valid and invalid domains. |
| `CSAA-008-PRP-005` | Every invalid generator case SHALL identify one exact intended defect. |
| `CSAA-008-PRP-006` | Every generator SHALL expose discarded-case rates and exhausted-population state. |
| `CSAA-008-PRP-007` | A generator SHALL NOT be the sole oracle for the property it generates. |
| `CSAA-008-PRP-008` | Every property failure SHALL retain the original failing case. |
| `CSAA-008-PRP-009` | Every property failure SHALL retain complete or bounded shrink lineage. |
| `CSAA-008-PRP-010` | Every byte-changing shrink step SHALL assign a new exact successor subject identity. |
| `CSAA-008-PRP-011` | Every shrinker SHALL preserve subject class, perimeter, target-defect lineage, governing-contract reference, and predecessor lineage. |
| `CSAA-008-PRP-012` | Every shrunken successor SHALL receive a fresh applicability evaluation against its exact bytes and version. |
| `CSAA-008-PRP-013` | Every shrunken successor SHALL rebind exact compatible provider standing. |
| `CSAA-008-PRP-014` | Every shrunken successor SHALL re-establish exact compatible oracle standing. |
| `CSAA-008-PRP-015` | Missing exact successor applicability, provider standing, or oracle standing SHALL produce non-green. |
| `CSAA-008-PRP-016` | A shrinker SHALL NOT remove the target defect. |
| `CSAA-008-PRP-017` | A shrink failure SHALL remain visible. |
| `CSAA-008-PRP-018` | Every metamorphic case SHALL bind one permanent relation ID. |
| `CSAA-008-PRP-019` | Every metamorphic case SHALL bind its exact preconditions. |
| `CSAA-008-PRP-020` | Every metamorphic case SHALL bind source and transformed subjects. |
| `CSAA-008-PRP-021` | Every metamorphic case SHALL bind exact expected preserved and changed dimensions. |
| `CSAA-008-PRP-022` | A permitted metamorphic difference SHALL bind an exact owner-governed policy. |
| `CSAA-008-PRP-023` | An inapplicable metamorphic relation SHALL carry exact rationale. |
| `CSAA-008-PRP-024` | An inapplicable metamorphic relation SHALL NOT count as passed coverage. |
| `CSAA-008-PRP-025` | All thirty registered metamorphic relations SHALL receive applicability evaluation. |
| `CSAA-008-PRP-026` | Deterministic replay SHALL retain seed, clock, order, environment, and raw inputs. |
| `CSAA-008-PRP-027` | A generated-case timeout SHALL NOT be silently discarded from the population. |

### 28.22 Mutation and tests-of-tests

| ID | Requirement |
| --- | --- |
| `CSAA-008-MUT-001` | All eighteen inherited subject-mutation classes SHALL receive at least one exact executable allocation. |
| `CSAA-008-MUT-002` | Every subject mutation SHALL bind base subject, operation, target, before/after content identities, and expected semantic effect. |
| `CSAA-008-MUT-003` | Every subject mutation SHALL bind affected facts, graphs, queries, rules, findings, matrices, and judgments as applicable. |
| `CSAA-008-MUT-004` | Every subject mutation SHALL bind expected invalidation closure. |
| `CSAA-008-MUT-005` | Every subject mutation SHALL bind reset identity and replay data. |
| `CSAA-008-MUT-006` | All forty-three harness-mutation operators SHALL receive applicability evaluation. |
| `CSAA-008-MUT-007` | `JAN-CSAA-008-HMUT-029` through `032` SHALL be mandatory killed supply-chain controls. |
| `CSAA-008-MUT-008` | `JAN-CSAA-008-HMUT-033` and `034` SHALL be mandatory killed applicability-and-criticality controls. |
| `CSAA-008-MUT-009` | `JAN-CSAA-008-HMUT-035` SHALL be a mandatory killed affected-author bypass control. |
| `CSAA-008-MUT-010` | `JAN-CSAA-008-HMUT-036` SHALL be a mandatory killed successor-identity control. |
| `CSAA-008-MUT-011` | `JAN-CSAA-008-HMUT-037` SHALL be a mandatory killed cache-provenance control. |
| `CSAA-008-MUT-012` | `JAN-CSAA-008-HMUT-038` SHALL be a mandatory killed source-map artifact control. |
| `CSAA-008-MUT-013` | Every critical rule SHALL map to at least one applicable harness mutant. |
| `CSAA-008-MUT-014` | Every critical invariant SHALL map to at least one applicable harness mutant. |
| `CSAA-008-MUT-015` | Every no-false-green predicate SHALL map to at least one applicable harness mutant. |
| `CSAA-008-MUT-016` | Every oracle-independence control SHALL map to at least one applicable harness mutant. |
| `CSAA-008-MUT-017` | Every subject-binding control SHALL map to at least one applicable harness mutant. |
| `CSAA-008-MUT-018` | Every security boundary SHALL map to at least one applicable harness mutant. |
| `CSAA-008-MUT-019` | Every critical applicable harness mutant SHALL be killed. |
| `CSAA-008-MUT-020` | A surviving critical mutant SHALL produce nonpass. |
| `CSAA-008-MUT-021` | An unexecuted critical mutant SHALL produce nonpass. |
| `CSAA-008-MUT-022` | An equivalent-mutant disposition SHALL require exact proof. |
| `CSAA-008-MUT-023` | A kill caused only by an unrelated harness crash SHALL NOT satisfy the mutation obligation. |
| `CSAA-008-MUT-024` | Mutation evidence SHALL bind mutant digest, location, case IDs, assertions, actual evidence, and disposition. |
| `CSAA-008-MUT-025` | Mutation scoring SHALL NOT authorize weakening an oracle. |
| `CSAA-008-MUT-026` | The suite SHALL test its eligibility aggregator. |
| `CSAA-008-MUT-027` | The suite SHALL test its failure-state renderer. |
| `CSAA-008-MUT-028` | The suite SHALL test its coverage-accounting and non-vacuity sentinels. |

### 28.23 Provider-adapter and differential conformance

| ID | Requirement |
| --- | --- |
| `CSAA-008-DIF-001` | Every adapter test SHALL bind exact provider, adapter, capability, method, and configuration identities. |
| `CSAA-008-DIF-002` | Every adapter test SHALL bind raw result and normalized output lineage. |
| `CSAA-008-DIF-003` | Every applicable model-mediated case SHALL bind the exact Model Exchange Record. |
| `CSAA-008-DIF-004` | Every transformation test SHALL disclose added, dropped, defaulted, and coerced fields. |
| `CSAA-008-DIF-005` | An undisclosed semantic loss SHALL fail adapter conformance. |
| `CSAA-008-DIF-006` | A prohibited semantic loss SHALL make output inert. |
| `CSAA-008-DIF-007` | Malformed raw provider output SHALL remain visible and non-green. |
| `CSAA-008-DIF-008` | Missing raw-provider retention SHALL make normalized provider evidence ineligible. |
| `CSAA-008-DIF-009` | Provider health SHALL remain separate from correctness and qualification. |
| `CSAA-008-DIF-010` | Differential comparison SHALL require two genuinely overlapping declared semantic scopes. |
| `CSAA-008-DIF-011` | `agree-supported` SHALL require both eligible outputs to match a conferred oracle. |
| `CSAA-008-DIF-012` | `agree-bounded-negative` SHALL require a conferred closed-basis negative oracle. |
| `CSAA-008-DIF-013` | Provider agreement SHALL NOT create truth. |
| `CSAA-008-DIF-014` | Provider disagreement SHALL retain both raw and normalized outputs. |
| `CSAA-008-DIF-015` | Provider disagreement SHALL retain explicit conflict dimensions. |
| `CSAA-008-DIF-016` | Provider invocation order SHALL NOT select a winner. |
| `CSAA-008-DIF-017` | A one-sided supported result SHALL NOT count as two-provider corroboration. |
| `CSAA-008-DIF-018` | An unavailable comparison provider SHALL remain visible. |
| `CSAA-008-DIF-019` | An incompatible comparison basis SHALL refuse comparison. |
| `CSAA-008-DIF-020` | Reasoned differential not-applicable SHALL NOT discharge differential coverage. |
| `CSAA-008-DIF-021` | Differential not-applicable SHALL derive only from exact governing-source and owner non-requirement. |
| `CSAA-008-DIF-022` | Insufficient qualified provider overlap SHALL NOT make a required differential comparison not-applicable. |
| `CSAA-008-DIF-023` | Availability of two providers SHALL NOT make an owner-declared optional comparison mandatory. |
| `CSAA-008-DIF-024` | A required comparison with insufficient overlap or availability SHALL use the exact applicable `one-sided-supported`, `one-sided-partial-or-stale`, `one-sided-failure`, `both-failed-or-unavailable`, or `incompatible-basis` outcome. |
| `CSAA-008-DIF-025` | Provider substitution SHALL preserve semantic ownership and oracle standing. |
| `CSAA-008-DIF-026` | Provider removal SHALL preserve limitations, missing coverage, and non-green state. |
| `CSAA-008-DIF-027` | Concrete provider qualification SHALL remain allocated to `JAN-CSAA-011`. |
| `CSAA-008-DIF-028` | An invalid adapter output SHALL remain inert after failed validation. |

### 28.24 Incremental invalidation and clean-full equivalence

| ID | Requirement |
| --- | --- |
| `CSAA-008-INC-001` | Every incremental case SHALL bind one exact pre-change subject. |
| `CSAA-008-INC-002` | Every incremental case SHALL bind one exact change set. |
| `CSAA-008-INC-003` | Every incremental case SHALL bind the resulting exact post-change successor identity, content, and configuration. |
| `CSAA-008-INC-004` | Every incremental case SHALL bind the complete dependency and invalidation closure. |
| `CSAA-008-INC-005` | Every incremental case SHALL bind one incremental run and one independently clean full run. |
| `CSAA-008-INC-006` | The incremental and clean-full runs SHALL target the same exact post-change successor. |
| `CSAA-008-INC-007` | A wrong-successor incremental or clean-full run SHALL be rejected from comparison. |
| `CSAA-008-INC-008` | A partially applied change SHALL be rejected from comparison. |
| `CSAA-008-INC-009` | A same-path but different-content successor SHALL be rejected from comparison. |
| `CSAA-008-INC-010` | A mixed-revision successor SHALL be rejected from comparison. |
| `CSAA-008-INC-011` | Incremental and clean-full runs SHALL use compatible profiles, providers, methods, and configurations. |
| `CSAA-008-INC-012` | Every equivalence record SHALL compare exact object, relation, result, and evidence populations. |
| `CSAA-008-INC-013` | Every equivalence record SHALL include `semantic-result-sets`. |
| `CSAA-008-INC-014` | Every equivalence record SHALL include `epistemic-states`. |
| `CSAA-008-INC-015` | Every equivalence record SHALL include `coverage`. |
| `CSAA-008-INC-016` | Every equivalence record SHALL include `provenance`. |
| `CSAA-008-INC-017` | Every equivalence record SHALL include `conflicts`. |
| `CSAA-008-INC-018` | Every equivalence record SHALL include `failures`. |
| `CSAA-008-INC-019` | Every equivalence record SHALL include `explanations`. |
| `CSAA-008-INC-020` | Every equivalence record SHALL include `deterministic-ordering`. |
| `CSAA-008-INC-021` | A permitted difference SHALL bind an exact owner-governed allowed-difference policy. |
| `CSAA-008-INC-022` | `demonstrated-equivalent` SHALL require every dimension to be equivalent or explicitly permitted. |
| `CSAA-008-INC-023` | Counts, aggregate hashes, and matching record IDs SHALL NOT establish equivalence. |
| `CSAA-008-INC-024` | A not-compared or inconclusive required dimension SHALL prevent demonstrated equivalence. |
| `CSAA-008-INC-025` | Cache-hit and cache-miss behavior SHALL remain observable. |
| `CSAA-008-INC-026` | Cold and warm executions SHALL preserve semantic result under the same compatible basis. |
| `CSAA-008-INC-027` | A cache key omission SHALL be detected. |
| `CSAA-008-INC-028` | A cache entry from another worktree, branch, subject, provider, or configuration SHALL be rejected. |
| `CSAA-008-INC-029` | Incomplete transitive invalidation SHALL be detected by clean-full comparison. |
| `CSAA-008-INC-030` | Mixed pre-change and post-change publication material SHALL be rejected. |
| `CSAA-008-INC-031` | The conformance test catalog SHALL include distinct resolved-dependency tests. |
| `CSAA-008-INC-032` | The conformance test catalog SHALL include distinct lockfile-delta tests. |
| `CSAA-008-INC-033` | The conformance test catalog SHALL include distinct advisory-correlation tests. |
| `CSAA-008-INC-034` | The conformance test catalog SHALL include distinct vulnerability-observation tests. |
| `CSAA-008-INC-035` | The supply-chain coordinate registry SHALL contain exactly sixteen stable coordinates. |
| `CSAA-008-INC-036` | Every supply-chain coordinate SHALL receive one synthetic-lane case. |
| `CSAA-008-INC-037` | Every supply-chain coordinate SHALL receive one dated-JPWB-lane case. |
| `CSAA-008-INC-038` | All thirty-two supply-chain lane-coordinate assignments SHALL report independently. |
| `CSAA-008-INC-039` | A manifest declaration SHALL NOT substitute for a resolved lockfile dependency. |
| `CSAA-008-INC-040` | A resolved lockfile dependency SHALL NOT substitute for runtime or import observation. |
| `CSAA-008-INC-041` | Every lockfile-delta case SHALL classify exact added, removed, changed, or transitive effects. |
| `CSAA-008-INC-042` | Every advisory-correlation case SHALL bind exact source, version, range, cutoff, scope, component, subject, and revision. |
| `CSAA-008-INC-043` | A stale, conflicting, mismatched, unavailable, failed, unsupported, or unqualified advisory state SHALL produce non-green. |
| `CSAA-008-INC-044` | Every Vulnerability Observation case SHALL bind the exact repository revision and dependency identity. |
| `CSAA-008-INC-045` | Absence of a Vulnerability Observation SHALL NOT establish no vulnerability without a qualified complete closed basis. |
| `CSAA-008-INC-046` | An empty Vulnerability Observation population SHALL fail when a planted affected component requires an observation. |
| `CSAA-008-INC-047` | Operational incremental semantics SHALL bind exact `JAN-CSAA-009@0.1.0` behavior and exact `JAN-CSAA-007@1.1.0` representations. |

### 28.25 Operations, validation, typed errors, partiality, and cancellation

| ID | Requirement |
| --- | --- |
| `CSAA-008-OPS-001` | All seventeen permanent logical operation IDs SHALL receive test coverage. |
| `CSAA-008-OPS-002` | Each operation SHALL receive one valid operation/input discriminator pairing. |
| `CSAA-008-OPS-003` | The valid operation/input pairing population SHALL contain exactly seventeen diagonal coordinates. |
| `CSAA-008-OPS-004` | The invalid cross-operation input population SHALL contain exactly 272 coordinates. |
| `CSAA-008-OPS-005` | Every operation SHALL reject a wrong input discriminator. |
| `CSAA-008-OPS-006` | Every operation SHALL reject an incompatible subject locator. |
| `CSAA-008-OPS-007` | Every operation SHALL reject an unauthorized request. |
| `CSAA-008-OPS-008` | Every operation SHALL preserve explicit unsupported-subject behavior. |
| `CSAA-008-OPS-009` | Every operation SHALL preserve success, typed failure, partial, cancellation, timeout, stale, conflict, and resource-refusal outcomes as applicable. |
| `CSAA-008-OPS-010` | Successful empty SHALL be permitted only where the operation and semantic closure predicates allow it. |
| `CSAA-008-OPS-011` | Every response SHALL satisfy the exact operation-state and outcome invariant. |
| `CSAA-008-OPS-012` | A response from another operation SHALL be rejected. |
| `CSAA-008-OPS-013` | An operation SHALL NOT create implicit repository, oracle, gate, profile, or governance mutation. |
| `CSAA-008-OPS-014` | Every `V01` through `V07` stage SHALL receive at least one pass-path case. |
| `CSAA-008-OPS-015` | Every `V01` through `V07` stage SHALL receive at least one isolated failure-path case. |
| `CSAA-008-OPS-016` | Failure of a required validation stage SHALL make downstream admission inert. |
| `CSAA-008-OPS-017` | A later validation stage SHALL NOT retroactively pass an earlier required failure. |
| `CSAA-008-OPS-018` | All 77 typed error codes SHALL receive valid code-specific safe-details cases. |
| `CSAA-008-OPS-019` | Every typed error code SHALL receive missing-required-details and alien-field negative cases. |
| `CSAA-008-OPS-020` | Every typed error code SHALL receive redaction and non-disclosure cases. |
| `CSAA-008-OPS-021` | Every typed error code SHALL map to its exact degradation and result-state treatment. |
| `CSAA-008-OPS-022` | Cancellation SHALL bind target operation, accepted identity, observed point, child attempts, propagation, cleanup, and final state. |
| `CSAA-008-OPS-023` | Cancellation SHALL NOT be represented as success. |
| `CSAA-008-OPS-024` | A late cancellation event SHALL NOT rewrite an already finalized completed operation. |
| `CSAA-008-OPS-025` | Partial results SHALL retain completed and missing regions, frontier, health, and continuation state. |
| `CSAA-008-OPS-026` | A timeout SHALL retain raw evidence and partiality available before termination. |

### 28.26 Compatibility, deprecation, and migration

| ID | Requirement |
| --- | --- |
| `CSAA-008-CMP-001` | Every compatibility claim SHALL be directional and version-bound. |
| `CSAA-008-CMP-002` | Compatibility tests SHALL cover schema, package, registry, discriminator, field, enum, digest, reference, envelope, collection, operation, error, adapter, and generated changes. |
| `CSAA-008-CMP-003` | `compatible`, `incompatible`, `unknown`, `not-evaluated`, and mapped compatibility SHALL remain distinct. |
| `CSAA-008-CMP-004` | A consumer compatibility pass SHALL NOT imply producer compatibility in the reverse direction. |
| `CSAA-008-CMP-005` | Unknown core fields SHALL fail closed unless the exact contract permits them. |
| `CSAA-008-CMP-006` | Known namespaced extensions SHALL round-trip only under their registered owner. |
| `CSAA-008-CMP-007` | An extension SHALL NOT become core semantics by key similarity. |
| `CSAA-008-CMP-008` | Deprecation SHALL preserve current defined behavior until the exact removal boundary. |
| `CSAA-008-CMP-009` | Removal SHALL require an incompatible version boundary unless exact rules say otherwise. |
| `CSAA-008-CMP-010` | A compatibility map SHALL bind source version, target version, direction, transformations, loss, and evidence. |
| `CSAA-008-CMP-011` | Undisclosed compatibility loss SHALL produce nonpass. |
| `CSAA-008-CMP-012` | Logical migration SHALL create a successor record and predecessor relation. |
| `CSAA-008-CMP-013` | Logical migration SHALL NOT rewrite accepted history. |
| `CSAA-008-CMP-014` | Documentation of logical migration SHALL NOT claim physical storage migration. |
| `CSAA-008-CMP-015` | A changed identity projection SHALL trigger explicit compatibility and invalidation review. |
| `CSAA-008-CMP-016` | A changed collection key or order SHALL trigger explicit compatibility review. |
| `CSAA-008-CMP-017` | A changed operation or error union SHALL trigger exhaustive pairing tests. |
| `CSAA-008-CMP-018` | An unknown compatibility state SHALL NOT be coerced to compatible. |

### 28.27 Hostile repository and analyzer security

| ID | Requirement |
| --- | --- |
| `CSAA-008-SEC-001` | The hostile-repository class population SHALL contain all twenty registered hostile classes. |
| `CSAA-008-SEC-002` | Every hostile class SHALL receive an exact containment and non-disclosure allocation. |
| `CSAA-008-SEC-003` | Repository inspection SHALL remain data-only absent an exact execution grant. |
| `CSAA-008-SEC-004` | The received working tree SHALL remain read-only. |
| `CSAA-008-SEC-005` | Process creation SHALL be denied absent an exact grant. |
| `CSAA-008-SEC-006` | Network access SHALL be denied absent an exact grant. |
| `CSAA-008-SEC-007` | Every execution grant SHALL be subject-, principal-, purpose-, capability-, path-, method-, time-, and resource-bounded. |
| `CSAA-008-SEC-008` | Missing, expired, ambiguous, or mismatched authorization SHALL refuse the operation. |
| `CSAA-008-SEC-009` | Repository, worktree, branch, evidence-set, principal, and tenant partitions SHALL remain isolated. |
| `CSAA-008-SEC-010` | Confidentiality, access, retention, and redaction classifications SHALL remain separate. |
| `CSAA-008-SEC-011` | Composite results SHALL use conservative record-grain information control. |
| `CSAA-008-SEC-012` | Every repository path SHALL be canonicalized before containment evaluation. |
| `CSAA-008-SEC-013` | Traversal through alternate separators or encodings SHALL be refused. |
| `CSAA-008-SEC-014` | Absolute, drive-change, UNC, device, and reserved paths SHALL be refused when outside scope. |
| `CSAA-008-SEC-015` | Symlink, junction, mount, hard-link, provider-alias, archive-entry, and source-map escapes SHALL be refused. |
| `CSAA-008-SEC-016` | Case-folding, Unicode-normalization, and confusable collisions SHALL be detected. |
| `CSAA-008-SEC-017` | Package lifecycle, configuration import, plugin, generator, script, native module, and child-process execution SHALL be denied by default. |
| `CSAA-008-SEC-018` | Repository prompt or instruction content SHALL remain untrusted data. |
| `CSAA-008-SEC-019` | Malformed, deeply nested, oversized, cyclic, fanout, parser, regex, and decompression inputs SHALL be resource-bounded. |
| `CSAA-008-SEC-020` | Poisoned generated, virtual, declaration, source-map, trace, and coverage inputs SHALL remain subject to validation. |
| `CSAA-008-SEC-021` | Spoofed extensions or provider-native fields SHALL NOT become core semantics. |
| `CSAA-008-SEC-022` | Secret values SHALL NOT be embedded where only `SecretReference` is permitted. |
| `CSAA-008-SEC-023` | Secret, source, trace, configuration, and credential canaries SHALL remain undisclosed. |
| `CSAA-008-SEC-024` | Network, DNS, loopback, metadata-service, callback, update, and telemetry egress attempts SHALL be denied absent grant. |
| `CSAA-008-SEC-025` | Cross-subject cache contamination SHALL be detected. |
| `CSAA-008-SEC-026` | Mixed-revision and time-of-check/time-of-use substitution SHALL be detected. |
| `CSAA-008-SEC-027` | CPU, memory, disk, file-count, process-count, output, traversal, and query resource limits SHALL be enforced. |
| `CSAA-008-SEC-028` | An unmodeled dynamic-entry frontier SHALL prevent closed negative reachability. |
| `CSAA-008-SEC-029` | Unauthorized raw, query, finding, trace, count, path, shape, or existence probing SHALL be refused without disclosure. |
| `CSAA-008-SEC-030` | Diagnostics, audits, exceptions, stacks, previews, timings, and responses SHALL obey non-disclosure rules. |
| `CSAA-008-SEC-031` | Redaction SHALL NOT fabricate completeness or successful absence. |
| `CSAA-008-SEC-032` | Audit evidence SHALL remain reconstructable without protected leakage. |
| `CSAA-008-SEC-033` | Retention or deletion SHALL NOT rewrite immutable semantic history. |
| `CSAA-008-SEC-034` | A hostile-test harness escape SHALL be a critical failure. |
| `CSAA-008-SEC-035` | A secret read, network egress, source mutation, unbounded process tree, or uncontained residue SHALL be a critical failure. |
| `CSAA-008-SEC-036` | Hostile content SHALL NOT be materialized or executed by this documentation activity. |

### 28.28 Degradation, fault, and recovery

| ID | Requirement |
| --- | --- |
| `CSAA-008-DEG-001` | All twenty inherited degradation classes SHALL receive applicability evaluation. |
| `CSAA-008-DEG-002` | Each degradation class SHALL be crossed with all eight declared result surfaces. |
| `CSAA-008-DEG-003` | The degradation/no-false-green matrix SHALL contain exactly 160 coordinates. |
| `CSAA-008-DEG-004` | Every matrix coordinate SHALL contain an executable allocation or exact reasoned not-applicable state. |
| `CSAA-008-DEG-005` | A degradation matrix cell SHALL NOT be blank. |
| `CSAA-008-DEG-006` | Unsupported material SHALL NOT become successful empty. |
| `CSAA-008-DEG-007` | Excluded or not-analyzed material SHALL NOT become complete. |
| `CSAA-008-DEG-008` | Partial material SHALL NOT become complete or conformant. |
| `CSAA-008-DEG-009` | Provider or analysis failure SHALL NOT become a technical verdict. |
| `CSAA-008-DEG-010` | Timeout, cancellation, or resource refusal SHALL NOT become success. |
| `CSAA-008-DEG-011` | Malformed output SHALL remain invalid and inert. |
| `CSAA-008-DEG-012` | Stale output SHALL NOT become current. |
| `CSAA-008-DEG-013` | Incompatible comparison basis SHALL NOT become a numeric or Boolean result. |
| `CSAA-008-DEG-014` | Conflicting output SHALL retain every admissible side. |
| `CSAA-008-DEG-015` | Redacted or access-denied material SHALL NOT fabricate absence. |
| `CSAA-008-DEG-016` | Truncation or pagination cutoff SHALL retain partiality and frontier. |
| `CSAA-008-DEG-017` | Broken source mapping SHALL prevent exact authored attribution. |
| `CSAA-008-DEG-018` | Unavailable or unqualified provider state SHALL remain visible. |
| `CSAA-008-DEG-019` | Mixed revision or subject mismatch SHALL prevent green. |
| `CSAA-008-DEG-020` | Interrupted index or stale cache SHALL NOT become current. |
| `CSAA-008-DEG-021` | Empty or vacuous output SHALL trigger non-vacuity failure where a required population exists. |
| `CSAA-008-DEG-022` | All sixteen topology-neutral recovery points SHALL receive post-009 applicability evaluation. |
| `CSAA-008-DEG-023` | An incomplete successor SHALL NOT become current. |
| `CSAA-008-DEG-024` | A failed attempt SHALL preserve prior-publication identity separately. |
| `CSAA-008-DEG-025` | Uncertain external effect SHALL be reconciled before retry. |
| `CSAA-008-DEG-026` | Recovery SHALL prevent duplicate material records and effects. |
| `CSAA-008-DEG-027` | Recovery SHALL preserve immutable prior history. |
| `CSAA-008-DEG-028` | Physical recovery mechanisms SHALL remain allocated to `JAN-CSAA-009`. |

### 28.29 Deterministic replay and reproducibility

| ID | Requirement |
| --- | --- |
| `CSAA-008-REP-001` | Every replay manifest SHALL bind exact subject and content digests. |
| `CSAA-008-REP-002` | Every replay manifest SHALL bind schema, generated artifact, implementation, harness, fixture, and oracle versions. |
| `CSAA-008-REP-003` | Every replay manifest SHALL bind compiler, resolver, framework, generator, provider, adapter, model, database/feed, rule-set, and configuration versions. |
| `CSAA-008-REP-004` | Every replay manifest SHALL bind operation, plan, query, selection, workload, instrumentation, trace schema, collector, and source map as applicable. |
| `CSAA-008-REP-005` | Every replay manifest SHALL bind seed, clock, locale, timezone, platform, concurrency, scheduling, and resource policy. |
| `CSAA-008-REP-006` | Every replay manifest SHALL retain raw inputs, raw outputs, diagnostics, and attempt order. |
| `CSAA-008-REP-007` | Exact deterministic inputs SHALL reproduce the declared deterministic result. |
| `CSAA-008-REP-008` | A permitted replay difference SHALL bind an exact allowed-difference policy. |
| `CSAA-008-REP-009` | Provider enumeration order SHALL NOT alter conflict membership or canonical order. |
| `CSAA-008-REP-010` | An unexplained replay difference SHALL produce nonpass. |
| `CSAA-008-REP-011` | A missing raw input or environmental influence SHALL make reproducibility inconclusive. |
| `CSAA-008-REP-012` | A nonreplayable seed SHALL produce nonpass. |
| `CSAA-008-REP-013` | Reproducibility SHALL NOT be represented as correctness. |
| `CSAA-008-REP-014` | A reproducible wrong result SHALL remain wrong. |
| `CSAA-008-REP-015` | Cross-environment variation SHALL be classified rather than silently ignored. |
| `CSAA-008-REP-016` | Replay evidence SHALL bind its own observation time and freshness. |

### 28.30 Performance and resource budgets

| ID | Requirement |
| --- | --- |
| `CSAA-008-PER-001` | Performance profiles SHALL cover all six declared workload classes. |
| `CSAA-008-PER-002` | Every performance case SHALL bind exact subject scale and semantic workload. |
| `CSAA-008-PER-003` | Every performance case SHALL bind project, artifact, object, relation, and result counts as applicable. |
| `CSAA-008-PER-004` | Every performance case SHALL bind provider, configuration, environment, and cold-or-warm state. |
| `CSAA-008-PER-005` | Every performance case SHALL bind concurrency, repetitions, statistical summary, and setup inclusion. |
| `CSAA-008-PER-006` | Every performance case SHALL bind wall-clock, CPU, memory, disk, I/O, process, output, and result-size observations as applicable. |
| `CSAA-008-PER-007` | Every performance case SHALL bind coverage, health, cancellation, timeout, and raw measurements. |
| `CSAA-008-PER-008` | Every performance pass SHALL bind a separately versioned owner-authorized budget profile. |
| `CSAA-008-PER-009` | This Draft SHALL NOT invent numeric performance thresholds. |
| `CSAA-008-PER-010` | A missing, floating, unreviewed, retrospective, or host-ambiguous threshold SHALL NOT produce pass. |
| `CSAA-008-PER-011` | Resource pressure MAY produce explicit refusal, cancellation, timeout, degradation, or broader safe recomputation. |
| `CSAA-008-PER-012` | Resource pressure SHALL NOT silently lower semantic coverage. |
| `CSAA-008-PER-013` | Resource pressure SHALL NOT disable security or change an oracle. |
| `CSAA-008-PER-014` | Warm-cache performance SHALL remain distinct from cold full analysis. |
| `CSAA-008-PER-015` | Performance measurement SHALL NOT substitute for semantic equivalence. |
| `CSAA-008-PER-016` | Performance measurement SHALL NOT substitute for recovery testing. |
| `CSAA-008-PER-017` | A resource-budget breach SHALL retain the exact consumed-resource evidence. |
| `CSAA-008-PER-018` | Backpressure SHALL remain observable. |
| `CSAA-008-PER-019` | Backpressure SHALL NOT silently drop required material. |

### 28.31 Dated JPWB conformance

| ID | Requirement |
| --- | --- |
| `CSAA-008-DAT-001` | Every dated-JPWB test SHALL bind an exact observation cutoff. |
| `CSAA-008-DAT-002` | Every dated-JPWB test SHALL bind exact repository, worktree/change, project, compiler, resolver, framework, generator, and evidence contexts. |
| `CSAA-008-DAT-003` | Every dated-JPWB test SHALL bind known gaps and unsupported surfaces. |
| `CSAA-008-DAT-004` | The dated lane SHALL include representative monorepo and project-reference concerns. |
| `CSAA-008-DAT-005` | The dated lane SHALL include representative Svelte and generated-contract mapping concerns. |
| `CSAA-008-DAT-006` | The dated lane SHALL include representative architecture-boundary concerns. |
| `CSAA-008-DAT-007` | The dated lane SHALL include representative resolved-dependency, lockfile-delta, advisory-correlation, vulnerability-observation, test, coverage, and runtime cases. |
| `CSAA-008-DAT-008` | The dated lane SHALL NOT replace the synthetic lane. |
| `CSAA-008-DAT-009` | A dated result SHALL NOT be represented as continuously current. |
| `CSAA-008-DAT-010` | A repository change SHALL invalidate affected dated results. |
| `CSAA-008-DAT-011` | Final corpus freeze SHALL require the consolidated implementation refresh and affected rebinding. |
| `CSAA-008-DAT-012` | The dated mutation inventory SHALL remain qualification input rather than a normative denominator. |

### 28.32 Coding-agent trajectory

| ID | Requirement |
| --- | --- |
| `CSAA-008-AGT-001` | Trajectory tests SHALL remain provisional until `JAN-CSAA-010` defines exact employment points. |
| `CSAA-008-AGT-002` | A coding-agent trajectory SHALL load applicable governed requirements. |
| `CSAA-008-AGT-003` | A coding-agent trajectory SHALL load the exact current inventory and machine contracts. |
| `CSAA-008-AGT-004` | A coding-agent trajectory SHALL load exact fixtures, ledger, provider qualification, limitations, and actual changed implementation material. |
| `CSAA-008-AGT-005` | A coding-agent trajectory SHALL invoke required analysis at the prescribed lifecycle point. |
| `CSAA-008-AGT-006` | A coding-agent trajectory SHALL bind the exact current subject. |
| `CSAA-008-AGT-007` | A coding-agent trajectory SHALL cite evidence, health, freshness, coverage, limitations, and unresolved findings. |
| `CSAA-008-AGT-008` | A coding-agent trajectory SHALL preserve the evidence-priority order. |
| `CSAA-008-AGT-009` | A coding-agent trajectory SHALL stop or escalate on a blocking non-green state. |
| `CSAA-008-AGT-010` | A coding-agent trajectory SHALL distinguish tool failure from a clean result. |
| `CSAA-008-AGT-011` | A coding-agent trajectory SHALL distinguish successful empty from false empty. |
| `CSAA-008-AGT-012` | A coding-agent trajectory SHALL NOT bypass a mandatory analysis. |
| `CSAA-008-AGT-013` | A coding-agent trajectory SHALL NOT ignore a blocking Analyzer Finding Record. |
| `CSAA-008-AGT-014` | A coding-agent trajectory SHALL NOT self-approve an exception. |
| `CSAA-008-AGT-015` | A coding-agent trajectory SHALL NOT weaken an oracle. |
| `CSAA-008-AGT-016` | A coding-agent trajectory SHALL NOT treat an RGT as an RGP. |
| `CSAA-008-AGT-017` | A coding-agent trajectory SHALL NOT claim a gate effect without exact authority. |
| `CSAA-008-AGT-018` | Tool invocation alone SHALL NOT prove correct agent employment. |
| `CSAA-008-AGT-019` | A correct final answer SHALL NOT compensate for bypassing a mandatory trajectory step. |
| `CSAA-008-AGT-020` | Every trajectory SHALL retain reconstructable operation and evidence records. |
| `CSAA-008-AGT-021` | Trajectory tests SHALL receive affected reconciliation after `JAN-CSAA-010`. |
| `CSAA-008-AGT-022` | This Draft SHALL NOT establish a general coding-agent procedure. |

### 28.33 Cross-package handoffs

| ID | Requirement |
| --- | --- |
| `CSAA-008-XPK-001` | Dedicated conformance-catalog wire records SHALL be allocated to an affected `JAN-CSAA-007` successor. |
| `CSAA-008-XPK-002` | Enforced schema and generated-derivative work SHALL remain separately authorized. |
| `CSAA-008-XPK-003` | Physical fixture materialization SHALL remain separately authorized. |
| `CSAA-008-XPK-004` | Oracle review and conferral SHALL remain with an independent authorized oracle owner. |
| `CSAA-008-XPK-005` | Harness and test implementation SHALL remain separately authorized. |
| `CSAA-008-XPK-006` | Test execution SHALL remain separately authorized. |
| `CSAA-008-XPK-007` | Persistence, cache, publication, concurrency, recovery, and operational performance semantics SHALL remain allocated to `JAN-CSAA-009`. |
| `CSAA-008-XPK-008` | Coding-agent employment semantics SHALL remain allocated to `JAN-CSAA-010`. |
| `CSAA-008-XPK-009` | Concrete provider qualification and removal SHALL remain allocated to `JAN-CSAA-011`. |
| `CSAA-008-XPK-010` | Independent Proposed-candidate adversarial review SHALL remain a later distinct role. |
| `CSAA-008-XPK-011` | Independent Proposed-candidate integrity validation SHALL remain a later distinct role. |
| `CSAA-008-XPK-012` | Final corpus disposition SHALL remain with the accountable sponsor. |
| `CSAA-008-XPK-013` | Final recording SHALL remain with a distinct ministerial recorder. |
| `CSAA-008-XPK-014` | Every later allocation SHALL identify exact activation authority and current nonperformance state. |
| `CSAA-008-XPK-015` | No later allocation SHALL be represented as already performed. |
| `CSAA-008-XPK-016` | Post-009, post-010, and post-011 reconciliation SHALL preserve this document's test-method ownership without inventing co-ownership. |

### 28.34 Verification, review, and acceptance

| ID | Requirement |
| --- | --- |
| `CSAA-008-VFY-001` | Author-side verification SHALL reproduce exact metadata, lifecycle, authority, and no-executable boundaries. |
| `CSAA-008-VFY-002` | Author-side verification SHALL reproduce every exact source byte count and SHA-256 digest. |
| `CSAA-008-VFY-003` | Author-side verification SHALL validate every local and external Markdown link. |
| `CSAA-008-VFY-004` | Author-side verification SHALL reproduce the 302-row adopted-program intake. |
| `CSAA-008-VFY-005` | Author-side verification SHALL reproduce the 2,160-row unaffected predecessor local-catalog intake. |
| `CSAA-008-VFY-006` | Author-side verification SHALL reproduce the 53-row canon and 53-row readiness intakes. |
| `CSAA-008-VFY-007` | Author-side verification SHALL reproduce the exact 2,568 unaffected subtotal and 4,320 pre-local affected total. |
| `CSAA-008-VFY-008` | Author-side verification SHALL reproduce every local requirement ID and family count. |
| `CSAA-008-VFY-009` | Author-side verification SHALL prove every local ID is unique and contiguous within its family. |
| `CSAA-008-VFY-010` | Author-side verification SHALL reproduce all twenty-seven test-family IDs. |
| `CSAA-008-VFY-011` | Author-side verification SHALL reproduce all twenty-four Test Specification facets. |
| `CSAA-008-VFY-012` | Author-side verification SHALL reproduce all thirty metamorphic relations. |
| `CSAA-008-VFY-013` | Author-side verification SHALL reproduce all forty-three harness mutants. |
| `CSAA-008-VFY-014` | Author-side verification SHALL reproduce all twenty hostile classes and sixteen recovery points. |
| `CSAA-008-VFY-015` | Author-side verification SHALL reproduce every exact minimum coverage count in §26.1. |
| `CSAA-008-VFY-016` | Author-side verification SHALL verify no green current execution claim exists. |
| `CSAA-008-VFY-017` | Author-side verification SHALL verify all `JAN-CSAA-006` judgments remain proposed, non-conferred, and non-executed. |
| `CSAA-008-VFY-018` | Author-side verification SHALL verify exactly zero current RGPs and no gate effect. |
| `CSAA-008-VFY-019` | Author-side verification SHALL verify recovery, trajectory, and qualification handoffs remain provisional. |
| `CSAA-008-VFY-020` | Author-side verification SHALL verify all code fences and Markdown tables are structurally closed. |
| `CSAA-008-VFY-021` | Author-side verification SHALL verify UTF-8 without BOM, CRLF-only line endings, and exactly one terminal CRLF. |
| `CSAA-008-VFY-022` | Author-side verification SHALL bind exact candidate byte count and SHA-256 digest. |
| `CSAA-008-VFY-023` | Author-side verification SHALL record every objective method in a separate evidence record. |
| `CSAA-008-VFY-024` | Author self-review SHALL begin only after objective ledger closure. |
| `CSAA-008-VFY-025` | Author self-review SHALL answer all applicable adopted adversarial questions against exact candidate bytes. |
| `CSAA-008-VFY-026` | Draft-to-Proposed promotion SHALL require closed requirement ledger and completed author self-review. |
| `CSAA-008-VFY-027` | Independent adversarial review SHALL use an identity distinct from the author. |
| `CSAA-008-VFY-028` | Independent integrity validation SHALL use an identity distinct from the author and adversarial reviewer. |
| `CSAA-008-VFY-029` | Final sponsor review SHALL use individually dispositionable exact-corpus surfaces. |
| `CSAA-008-VFY-030` | Document-authoring acceptance SHALL NOT imply executable conformance or full wave exit. |

### 28.35 WIR affected reconciliation requirements

| ID | Requirement |
| --- | --- |
| `CSAA-008-WIR-001` | This successor SHALL bind exact `JAN-CSAA-007@1.1.0` bytes and digest as its operational machine-contract source. |
| `CSAA-008-WIR-002` | Operational wire conformance SHALL preserve `JAN-CSAA-007` serialization ownership without transferring operational meaning. |
| `CSAA-008-WIR-003` | The suite SHALL cover the one Operational Profile Definition with O01 through O30 exactly once and in order. |
| `CSAA-008-WIR-004` | The suite SHALL cover all thirty-one runtime operational record roles independently. |
| `CSAA-008-WIR-005` | The suite SHALL cover OEAR-001 through OEAR-032 exactly once and separately from the 144 legacy assignments. |
| `CSAA-008-WIR-006` | The suite SHALL preserve all thirty-seven operational identity rows and all forty registered identity names. |
| `CSAA-008-WIR-007` | The suite SHALL cover P01 through P12 under their exact coordinate meanings and applicability rules. |
| `CSAA-008-WIR-008` | The suite SHALL reproduce all five derived operational projections from their complete exact inputs. |
| `CSAA-008-WIR-009` | The suite SHALL validate all five operational digest profiles against their registered purposes and preimages. |
| `CSAA-008-WIR-010` | The suite SHALL validate all three operational target sets and reject every alien target. |
| `CSAA-008-WIR-011` | The suite SHALL validate all five operational reference aliases under their exact target and direction rules. |
| `CSAA-008-WIR-012` | The suite SHALL validate all six finalization directions and reject a cycle or phase reversal. |
| `CSAA-008-WIR-013` | The suite SHALL validate all thirteen operational canonical keys with deterministic order and duplicate rejection. |
| `CSAA-008-WIR-014` | The suite SHALL validate all three self-excluding content-identifier preimages. |
| `CSAA-008-WIR-015` | The suite SHALL validate H01 through H14 as separate operational health dimensions. |
| `CSAA-008-WIR-016` | The suite SHALL validate the twelve affected operational error codes and their closed safe payloads. |
| `CSAA-008-WIR-017` | The suite SHALL allocate all six phase-identity and digest-cycle negatives independently. |
| `CSAA-008-WIR-018` | Every operational material case SHALL bind the complete OperationalRecordEnvelope required-field set. |
| `CSAA-008-WIR-019` | Every operational collection SHALL use its exact registered mode, key, cardinality, and duplicate rule. |
| `CSAA-008-WIR-020` | OperationalReference cases SHALL exercise all six discriminator branches and reject mixed branches. |
| `CSAA-008-WIR-021` | A conformance case SHALL NOT overload a legacy record or operational role with conformance-catalog meaning. |
| `CSAA-008-WIR-022` | The typed-error population SHALL contain exactly seventy-seven stable codes for this source version. |
| `CSAA-008-WIR-023` | An absent enforced schema or validator SHALL remain a nonpass for executable shape conformance. |
| `CSAA-008-WIR-024` | An absent generated derivative or generation-parity result SHALL remain a nonpass for executable fidelity. |
| `CSAA-008-WIR-025` | A candidate wire record SHALL NOT acquire semantic, operational, oracle, provider, gate, or assurance authority. |
| `CSAA-008-WIR-026` | Compatibility tests SHALL treat the 007 major operational extension as directional and version-bound. |
| `CSAA-008-WIR-027` | Source-to-contract trace tests SHALL reproduce every operational field, discriminator, state, identity, projection, exclusion, key, and count. |
| `CSAA-008-WIR-028` | A changed 007 source identity SHALL trigger affected reconciliation and re-review before later eligible use. |

### 28.36 OPR affected reconciliation requirements

| ID | Requirement |
| --- | --- |
| `CSAA-008-OPR-001` | This successor SHALL bind exact `JAN-CSAA-009@0.1.0` bytes and digest as its operational-semantic source. |
| `CSAA-008-OPR-002` | Operational cases SHALL preserve `JAN-CSAA-009` ownership of physical operational behavior. |
| `CSAA-008-OPR-003` | A later operational realization SHALL bind one exact thirty-facet operational profile. |
| `CSAA-008-OPR-004` | Operational tests SHALL preserve the definition, material, coordination, publication, and consumption planes as distinct responsibilities. |
| `CSAA-008-OPR-005` | Persisted-material tests SHALL distinguish durable bytes, valid records, semantic truth, and current publication. |
| `CSAA-008-OPR-006` | Immutable material tests SHALL reject in-place rewrite, identity rebinding, and history substitution. |
| `CSAA-008-OPR-007` | Publication tests SHALL exercise all twelve candidate states and the closed transition relation. |
| `CSAA-008-OPR-008` | Publication eligibility tests SHALL evaluate PUB-P01 through PUB-P16 at one declared cutoff. |
| `CSAA-008-OPR-009` | Current-binding tests SHALL prove one atomic compare-and-publish result for the complete stable channel. |
| `CSAA-008-OPR-010` | Content-bearing query, page, stream, export, explanation, finding retrieval, publication-bound raw retrieval, and comparison tests SHALL acquire and retain one exact immutable publication-vector-pinned ContentReadView. |
| `CSAA-008-OPR-011` | Invalidation tests SHALL preserve dependency cause, conservative closure, broadening, and unresolved frontier. |
| `CSAA-008-OPR-012` | Incremental tests SHALL report all 144 mutation-by-dimension assessments independently. |
| `CSAA-008-OPR-013` | Cache tests SHALL evaluate CAC-P01 through CAC-P16 without wildcard or silent default. |
| `CSAA-008-OPR-014` | Concurrency tests SHALL exercise claims, fencing, stale-worker refusal, duplicate delivery, and idempotency. |
| `CSAA-008-OPR-015` | Scheduling tests SHALL exercise admission, priority, fairness, backpressure, deadline, and resource refusal. |
| `CSAA-008-OPR-016` | Cancellation tests SHALL distinguish request, propagation, effective boundary, partial material, cleanup, and late ordering. |
| `CSAA-008-OPR-017` | Retry tests SHALL reconcile an uncertain effect before any repeated effect. |
| `CSAA-008-OPR-018` | Recovery tests SHALL map all sixteen abstract recovery coordinates to concrete injection points. |
| `CSAA-008-OPR-019` | Integrity tests SHALL cover validation, collision, corruption, quarantine, blast radius, repair, rebuild, and residual loss. |
| `CSAA-008-OPR-020` | Backup and restore tests SHALL preserve one exact consistency boundary and validate before activation. |
| `CSAA-008-OPR-021` | Migration tests SHALL cover inventory, compatibility, dual modes, reconciliation, cutover, fallback, rollback, and decommission. |
| `CSAA-008-OPR-022` | Retention tests SHALL preserve policy, holds, archival, deletion evidence, derivative inheritance, and immutable history. |
| `CSAA-008-OPR-023` | Garbage-collection tests SHALL preserve roots, reachability proof, grace boundary, authorization, race prevention, and audit. |
| `CSAA-008-OPR-024` | Operational security tests SHALL enforce authentication, authorization, information control, encryption, secret, egress, and disclosure boundaries. |
| `CSAA-008-OPR-025` | Audit tests SHALL cover all eighteen registered operational event classes with safe reconstructable evidence. |
| `CSAA-008-OPR-026` | Health tests SHALL preserve all fourteen independent dimensions and scoped readiness. |
| `CSAA-008-OPR-027` | Performance tests SHALL cover all six workload classes under exact owner-supplied profiles and budgets. |
| `CSAA-008-OPR-028` | Operation tests SHALL preserve all seventeen valid and 272 invalid operation-input pairings under their exact operational behavior. |
| `CSAA-008-OPR-029` | Typed-failure tests SHALL preserve the exact seventy-seven-code distinction and safe detail union. |
| `CSAA-008-OPR-030` | Degradation tests SHALL cover all 160 class-by-surface coordinates as independently non-green. |
| `CSAA-008-OPR-031` | Operational tests SHALL NOT select or imply a storage, orchestration, transaction, queue, scheduler, deployment, or topology mechanism. |
| `CSAA-008-OPR-032` | Documentation closure SHALL NOT imply one operational execution, result, provider standing, or current publication. |

### 28.37 OID affected reconciliation requirements

| ID | Requirement |
| --- | --- |
| `CSAA-008-OID-001` | Every operational case SHALL bind P01 administrative namespace, repository trust domain, principal, delegation, tenant, and purpose as the exact security-partition isolation projection. |
| `CSAA-008-OID-002` | Every operational case SHALL bind P02 information-control, confidentiality, access, retention, redaction, disclosure, and egress policies as the exact security-partition protection projection. |
| `CSAA-008-OID-003` | Every applicable operational case SHALL bind P03 repository, worktree-or-synthetic-subject lineage, project variant, and publication class as the first exact publication-channel projection. |
| `CSAA-008-OID-004` | Every applicable operational case SHALL bind P04 currentness scope, capability-or-population purpose, and static-or-execution lane kind as the second exact publication-channel projection. |
| `CSAA-008-OID-005` | Every applicable operational case SHALL bind P05 channel namespace and channel-profile identity as the third exact publication-channel projection. |
| `CSAA-008-OID-006` | Every applicable operational case SHALL bind P06 static semantic snapshot, working change set, merge basis, acquisition boundary, and immutable subject digest as the first exact candidate-subject projection. |
| `CSAA-008-OID-007` | Every applicable operational case SHALL bind P07 as the exact phase-correct candidate or read publication-vector projection, including the registered candidate exclusion of its own future decision and generation. |
| `CSAA-008-OID-008` | Every applicable operational case SHALL bind P08 project and configuration closure, operational-profile instantiation, contracts, semantic owners, rules, adapters, providers, toolchains, and generated contexts as the second exact candidate-subject projection. |
| `CSAA-008-OID-009` | Every applicable operational case SHALL bind P09 migration epoch, physical-format compatibility, integrity state and incident, repair, prepublication replay basis, transforms, and storage profile as the exact material-basis projection while excluding the same candidate's future output-complete `replayManifestId`. |
| `CSAA-008-OID-010` | Every applicable operational case SHALL bind P10 operation identifier and version, query, capability, population, budget, partial-result policy, ordering policy, approximation policy, inference policy, and continuation as the exact operation-key projection. |
| `CSAA-008-OID-011` | Every applicable operational case SHALL bind P11 dependency manifest, transforms, directed compatibility pairs, observed publication vector, authorization decision, and protection policies as the exact cache-key projection. |
| `CSAA-008-OID-012` | Every applicable operational case SHALL bind P12 expected predecessor, expected publication generation, fencing identity, state revision, and acquisition cutoff as the exact mutable concurrency observation excluded from all five stable or immutable derived identities. |
| `CSAA-008-OID-013` | Every whole-coordinate or nested OwnerBackedValue not-applicable branch SHALL be expressly permitted by the exact operation-applicability matrix and carry its exact owner, reason code, explanation, and nonempty basis. |
| `CSAA-008-OID-014` | A projection case SHALL NOT treat omission, blank, wildcard, default, unknown, or empty as not-applicable. |
| `CSAA-008-OID-015` | A stable role identity SHALL remain distinct from immutable `recordId` and content digest. |
| `CSAA-008-OID-016` | A state revision SHALL retain the same stable machine identity and a new immutable occurrence identity. |
| `CSAA-008-OID-017` | A successor state SHALL bind its exact predecessor and monotonically increasing machine revision. |
| `CSAA-008-OID-018` | A content-bound reference SHALL target only finalized content under the registered direction. |
| `CSAA-008-OID-019` | Canonical-key tests SHALL include every registered component in its exact order. |
| `CSAA-008-OID-020` | Canonical-key tests SHALL reject two distinct logical members that project to one duplicate key. |
| `CSAA-008-OID-021` | Candidate lifecycle identity SHALL remain distinct from sealed candidate content identity. |
| `CSAA-008-OID-022` | Publication decision identity SHALL remain absent until authoritative decision finalization. |
| `CSAA-008-OID-023` | A pre-seal lifecycle revision SHALL NOT contain a later publication-candidate identity. |
| `CSAA-008-OID-024` | A sealed candidate content identity SHALL use only its self-excluding canonical preimage. |
| `CSAA-008-OID-025` | A replay-basis identity SHALL exclude every output or later completion dependent on the same attempt. |
| `CSAA-008-OID-026` | A replay-completion identity SHALL exclude every direct or transitive dependency on itself. |
| `CSAA-008-OID-027` | Digest-purpose tests SHALL reject use of one registered digest profile for another purpose. |
| `CSAA-008-OID-028` | Reference-direction tests SHALL reject a consumer finalized before its required content target. |
| `CSAA-008-OID-029` | Finalization-graph tests SHALL detect a direct or transitive cycle across legacy and operational references. |
| `CSAA-008-OID-030` | An identity mismatch SHALL remain visible even when paths, labels, counts, or payload values otherwise match. |

### 28.38 PUB affected reconciliation requirements

| ID | Requirement |
| --- | --- |
| `CSAA-008-PUB-001` | A publication case SHALL bind one exact candidate lifecycle, state revision, and predecessor lineage. |
| `CSAA-008-PUB-002` | A publication case SHALL distinguish `ABSENT`, `ASSEMBLING`, `SEALED`, `INELIGIBLE`, `ELIGIBLE`, `COMMITTING`, `COMMIT_OUTCOME_UNKNOWN`, `PUBLISHED`, `SUPERSEDED`, `REFUSED`, `ABANDONED`, and `QUARANTINED`. |
| `CSAA-008-PUB-003` | A transition case SHALL reject every edge outside the closed publication transition relation. |
| `CSAA-008-PUB-004` | Eligibility SHALL require every applicable PUB-P01 through PUB-P16 predicate to pass at one cutoff. |
| `CSAA-008-PUB-005` | A source-owned not-applicable publication predicate SHALL carry exact owner, reason, and basis. |
| `CSAA-008-PUB-006` | A sealed candidate SHALL precede its publication decision. |
| `CSAA-008-PUB-007` | A finalized publication decision SHALL precede the completed legacy Publication Manifest. |
| `CSAA-008-PUB-008` | A publication case SHALL distinguish the predecision observed-current-binding guard, the one linearization fact that atomically finalizes a published decision and advances the complete physical binding, and every later non-authoritative current-binding projection or acquired-read observation. |
| `CSAA-008-PUB-009` | Before comparison, a publication case SHALL bind exact expected predecessor, expected publication generation, fencing identity, fencing state revision, guard cutoff, byte-equal P12, observed current binding, active fencing right, and predecessor-Manifest mapping. |
| `CSAA-008-PUB-010` | A stale or unequal fencing right, identity, state revision, or acquisition cutoff SHALL NOT permit commit of a current binding. |
| `CSAA-008-PUB-011` | A generation conflict SHALL produce the exact registered typed failure and no partial binding. |
| `CSAA-008-PUB-012` | A `COMMIT_OUTCOME_UNKNOWN` attempt SHALL require reconciliation before retry or currentness. |
| `CSAA-008-PUB-013` | A publication audit failure SHALL remain non-green under the exact durability policy. |
| `CSAA-008-PUB-014` | A partial publication SHALL NOT expose a mixed old/new current binding. |
| `CSAA-008-PUB-015` | A ContentReadView case SHALL bind one complete ordered publication vector at one common acquisition cutoff. |
| `CSAA-008-PUB-016` | A read continuation SHALL retain its exact view, vector digest, query, profile, population, and budget projection, order, page boundary, authorization, policy, cutoff, and expiry. |
| `CSAA-008-PUB-017` | A current-binding read SHALL reproduce every physical binding field from the authoritative lane and decision. |
| `CSAA-008-PUB-018` | An explicitly historical read SHALL remain retained, available, integrity-valid, compatible, and separately authorized. |
| `CSAA-008-PUB-019` | An explicitly historical read SHALL NOT imply currentness. |
| `CSAA-008-PUB-020` | A no-current health branch SHALL carry a source-owned safe reason and no publication or content reference. |
| `CSAA-008-PUB-021` | A binding-unavailable health branch SHALL carry a source-owned safe reason and retry standing and no publication or content reference. |
| `CSAA-008-PUB-022` | A binding-corrupt health branch SHALL carry a source-owned safe reason and the permitted safe IntegrityIncidentRecord reference and no publication or content reference. |
| `CSAA-008-PUB-023` | A non-content health branch SHALL NOT permit semantic traversal. |
| `CSAA-008-PUB-024` | A cache hit SHALL satisfy all sixteen admission predicates for the same exact subject and cutoff. |
| `CSAA-008-PUB-025` | A cache miss or refusal SHALL remain distinguishable from a successful empty semantic result. |
| `CSAA-008-PUB-026` | Cache reuse SHALL retain complete provenance, dependency, authorization, health, and invalidation evidence. |
| `CSAA-008-PUB-027` | A current-binding mismatch SHALL prevent minting a read-view identity. |
| `CSAA-008-PUB-028` | Publication success SHALL NOT imply semantic correctness, conformance, oracle standing, provider qualification, or gate effect. |

### 28.39 RCV affected reconciliation requirements

| ID | Requirement |
| --- | --- |
| `CSAA-008-RCV-001` | Recovery point RCV-001 SHALL test interruption before request acceptance. |
| `CSAA-008-RCV-002` | Recovery point RCV-002 SHALL test interruption during subject acquisition or identity resolution. |
| `CSAA-008-RCV-003` | Recovery point RCV-003 SHALL test interruption during plan construction or capability dependency resolution. |
| `CSAA-008-RCV-004` | Recovery point RCV-004 SHALL test interruption after invocation creation and before raw capture. |
| `CSAA-008-RCV-005` | Recovery point RCV-005 SHALL test interruption after raw capture and before validation. |
| `CSAA-008-RCV-006` | Recovery point RCV-006 SHALL test interruption during V01 through V07 validation. |
| `CSAA-008-RCV-007` | Recovery point RCV-007 SHALL test interruption during transformation or normalization. |
| `CSAA-008-RCV-008` | Recovery point RCV-008 SHALL test interruption after candidate assembly and before publication validation. |
| `CSAA-008-RCV-009` | Recovery point RCV-009 SHALL test interruption at the atomic-publication boundary. |
| `CSAA-008-RCV-010` | Recovery point RCV-010 SHALL test interruption after publication and before response or audit completion. |
| `CSAA-008-RCV-011` | Recovery point RCV-011 SHALL test interruption during cancellation propagation and cleanup. |
| `CSAA-008-RCV-012` | Recovery point RCV-012 SHALL test interruption during timeout, resource exhaustion, or backpressure. |
| `CSAA-008-RCV-013` | Recovery point RCV-013 SHALL test interruption during stale-cache or interrupted-index detection. |
| `CSAA-008-RCV-014` | Recovery point RCV-014 SHALL test interruption during uncertain external-effect reconciliation. |
| `CSAA-008-RCV-015` | Recovery point RCV-015 SHALL test interruption during corruption detection, rebuild, migration, or reconciliation. |
| `CSAA-008-RCV-016` | Recovery point RCV-016 SHALL test interruption during retry or restart duplicate prevention and last-known-good separation. |
| `CSAA-008-RCV-017` | Every recovery case SHALL name one implementation-specific injection point for its abstract coordinate. |
| `CSAA-008-RCV-018` | Every recovery case SHALL bind exact durable material observed before and after injection. |
| `CSAA-008-RCV-019` | Every recovery case SHALL bind restart, retry, attempt, claim, fencing, and idempotency identities as applicable. |
| `CSAA-008-RCV-020` | Every recovery case SHALL detect duplicate records, duplicate effects, orphaned material, and stale claims. |
| `CSAA-008-RCV-021` | Every recovery case SHALL verify prior-publication and current-binding behavior without relabeling freshness. |
| `CSAA-008-RCV-022` | Every recovery case SHALL verify cleanup, residual state, audit, and reconciliation evidence. |
| `CSAA-008-RCV-023` | An incomplete successor SHALL NOT become current during recovery. |
| `CSAA-008-RCV-024` | An uncertain external effect SHALL NOT be repeated before exact reconciliation. |
| `CSAA-008-RCV-025` | A repair case SHALL preserve the original integrity incident, quarantine, action, and residual-loss evidence. |
| `CSAA-008-RCV-026` | A rebuild case SHALL bind exact authoritative inputs and compare the rebuilt result to them. |
| `CSAA-008-RCV-027` | A backup case SHALL bind its complete consistency boundary, encryption, retention, inventory, and verification. |
| `CSAA-008-RCV-028` | A restore case SHALL validate in isolation before any activation or current-binding change. |
| `CSAA-008-RCV-029` | A failed restore SHALL NOT replace a valid current publication. |
| `CSAA-008-RCV-030` | A migration case SHALL preserve source and target profiles, compatibility, checkpoints, comparisons, and rollback. |
| `CSAA-008-RCV-031` | A failed cutover SHALL retain exact fallback or rollback standing and residual material. |
| `CSAA-008-RCV-032` | A retention or deletion case SHALL preserve policy, holds, authorization, immutable history, and residual copies. |
| `CSAA-008-RCV-033` | A garbage-collection case SHALL prove reachability and race safety at the declared cutoff. |
| `CSAA-008-RCV-034` | Recovery completion SHALL NOT imply semantic correctness, current oracle standing, provider qualification, or assurance approval. |

### 28.40 HLT affected reconciliation requirements

| ID | Requirement |
| --- | --- |
| `CSAA-008-HLT-001` | H01 conformance SHALL test scoped process or component liveness without inferring readiness. |
| `CSAA-008-HLT-002` | H02 conformance SHALL test authorized integrity-valid snapshot-pinned read readiness. |
| `CSAA-008-HLT-003` | H03 conformance SHALL test durable work progression and atomic publication readiness. |
| `CSAA-008-HLT-004` | H04 conformance SHALL test reconciliation of incomplete operational actions and evidence gaps. |
| `CSAA-008-HLT-005` | H05 conformance SHALL test immutable material, collection, manifest, and binding integrity. |
| `CSAA-008-HLT-006` | H06 conformance SHALL test enforceable authentication, authorization, information control, encryption, keys, secrets, and audit controls. |
| `CSAA-008-HLT-007` | H07 conformance SHALL test exact dependency and provider execution standing within qualification limits. |
| `CSAA-008-HLT-008` | H08 conformance SHALL preserve supported, partial, unsupported, excluded, and not-analyzed capability regions. |
| `CSAA-008-HLT-009` | H09 conformance SHALL preserve current, stale, invalidated, unknown, and historical evidence standing. |
| `CSAA-008-HLT-010` | H10 conformance SHALL preserve findings, conflicts, disagreements, and unresolved treatments. |
| `CSAA-008-HLT-011` | H11 conformance SHALL retain reasoned not-applicable standing while no effective Repository Gate Profile exists. |
| `CSAA-008-HLT-012` | H12 conformance SHALL preserve admitted, queued, starved-risk, saturation, refusal, and headroom standing. |
| `CSAA-008-HLT-013` | H13 conformance SHALL preserve migration, cutover, backup, restore, hold, deletion, and rollback risk. |
| `CSAA-008-HLT-014` | H14 conformance SHALL test mandatory event, correlation, metric, and safe-diagnostic reconstructability. |
| `CSAA-008-HLT-015` | A HealthResponse SHALL preserve the five existing response axes in addition to H01 through H14. |
| `CSAA-008-HLT-016` | A health result SHALL NOT serialize or derive one aggregate healthy Boolean. |
| `CSAA-008-HLT-017` | An unknown, unobserved, stale, or missing applicable dimension SHALL remain non-green. |
| `CSAA-008-HLT-018` | Health standing SHALL NOT imply semantic truth, conformance, currentness, gate outcome, authority, or approval. |

### 28.41 PHS affected reconciliation requirements

| ID | Requirement |
| --- | --- |
| `CSAA-008-PHS-001` | Case `JAN-CSAA-009-TST-PHASE-001` SHALL reject a premature candidate identity in an ABSENT or ASSEMBLING lifecycle revision. |
| `CSAA-008-PHS-002` | Case `JAN-CSAA-009-TST-PHASE-002` SHALL reject post-seal backfill of candidate identity into immutable pre-seal history. |
| `CSAA-008-PHS-003` | Case `JAN-CSAA-009-TST-PHASE-003` SHALL reject rebinding one candidate lifecycle to different sealed content. |
| `CSAA-008-PHS-004` | Case `JAN-CSAA-009-TST-PHASE-004` SHALL reject a blanked, zeroed, provisional, or self-inclusive content identifier canonical preimage. |
| `CSAA-008-PHS-005` | Case `JAN-CSAA-009-TST-PHASE-005` SHALL reject a replay basis that includes same-attempt output or later completion material. |
| `CSAA-008-PHS-006` | Case `JAN-CSAA-009-TST-PHASE-006` SHALL reject a replay completion preimage with a direct or transitive same-identity dependency. |
| `CSAA-008-PHS-007` | Every phase and digest case SHALL have one permanent conformance-case identity. |
| `CSAA-008-PHS-008` | Every phase and digest case SHALL bind one exact invalid instance or fault injection. |
| `CSAA-008-PHS-009` | Every phase and digest case SHALL preserve the exact expected typed rejection and safe details. |
| `CSAA-008-PHS-010` | Every phase and digest case SHALL preserve raw evidence, diagnostics, cleanup, and immutable prior history. |
| `CSAA-008-PHS-011` | Every phase and digest case SHALL report its assertion population independently. |
| `CSAA-008-PHS-012` | A passing ordinary publication or replay case SHALL NOT satisfy one phase or digest negative. |
| `CSAA-008-PHS-013` | A passing phase or digest case SHALL NOT satisfy another phase or digest case. |
| `CSAA-008-PHS-014` | A missing or unexecuted phase or digest case SHALL block affected operational conformance. |
| `CSAA-008-PHS-015` | Cycle detection SHALL traverse direct and transitive dependencies across every registered preimage edge. |
| `CSAA-008-PHS-016` | Every later response, audit-completion, health-completion, or other record that depends directly or transitively on the replay completion identity SHALL remain outside that identity's self-excluding preimage and follow only the registered later-to-finalized-replay direction. |

---

## 29. Verification and later-execution matrix

### 29.1 Author-side objective methods

The requirement ledger and objective verification record carry mutable execution state. This stable specification defines the methods and required evidence without embedding a future executable pass.
| Method | Subject | Required evidence |
| --- | --- | --- |
| `JAN-CSAA-008-VER-CTL-001` | Control and lifecycle | Metadata, exact status, authority, prohibited-claim, no-executable, and currentness-boundary scans |
| `JAN-CSAA-008-VER-SRC-001` | Exact source intake | Exact bytes/digests/links plus 2,568 unaffected inherited rows, 652 exact current `JAN-CSAA-007@1.1.0` rows, 1,100 exact historical `JAN-CSAA-009@0.1.0` finite-cutoff rows, and exact successor-local extraction |
| `JAN-CSAA-008-VER-OWN-001` | Concern ownership | Single-owner matrix, excluded concerns, five-role separation, and no semantic overwrite |
| `JAN-CSAA-008-VER-MOD-001` | Test model | 27 families, 24 facets, governed applicability/criticality, identity grammar, case kinds, logical artifact separation, consumed operational wires, and remaining dedicated conformance-wire allocation |
| `JAN-CSAA-008-VER-ELG-001` | Eligibility and no false green | Closed total axes, exact provider-health mappings, H01–H14 and health-view admission, complete blocking-reason set, fixed primary precedence, sole green conjunction, prohibited coercions, and non-vacuity sentinels |
| `JAN-CSAA-008-VER-TRC-001` | Traceability | Bidirectional source-to-result chain, reverse mappings, populations, and no lost identity |
| `JAN-CSAA-008-VER-PKG-001` | Schema package | 19 sources including operations, meta-schema modes, dependency/finalization cycles, recursion, and index rules |
| `JAN-CSAA-008-VER-GEN-001` | Generated fidelity | 5 derivatives, deterministic regeneration, schema/type/validator/registry/export parity, and mutations |
| `JAN-CSAA-008-VER-COM-001` | Common contracts | Digest-purpose, reference, 144 legacy plus 32 operational assignments, collection, null/absence, lifecycle, and combined finalization coverage |
| `JAN-CSAA-008-VER-SUB-001` | Subject/publication | Exact subject, mixed revision, complete publication, prior publication, freshness, and invalidation |
| `JAN-CSAA-008-VER-ART-001` | Artifacts and mapping | Role classification, build/instrumentation identity, complete provenance chain, bidirectional source maps, wrong-artifact and diagnostic fidelity |
| `JAN-CSAA-008-VER-OBJ-001` | Object variants | 127 exact variants, valid/invalid modes, profiles, envelopes, subjects, identity, references, and invariants |
| `JAN-CSAA-008-VER-REL-001` | Relation variants and graphs | 137 exact variants, endpoint closure, metadata, inference classes, graph populations, and invariants |
| `JAN-CSAA-008-VER-INV-001` | Semantic invariants | INV-001–014 plus 9 graph layers × 3 modes, isolated negative, incomplete, cross-graph, and mutation coverage |
| `JAN-CSAA-008-VER-CAP-001` | Capability profiles | 32 × 28 = 896 exact labeled cells, negative label parsing, dependency DAG, and 256 outcomes |
| `JAN-CSAA-008-VER-QRY-001` | Query and reachability | Exhaustive four-valued NOT/AND/OR and exact N/A tables, six-dimension composition semantics, complete/short-circuit equivalence and complete-evidence disablement, explanation provenance, mutation controls, full-AST budgets, paging, slices, deltas, impact, witnesses, and 12 mechanisms |
| `JAN-CSAA-008-VER-EXE-001` | Execution evidence | Run/attempt/retry, coverage denominator, build/environment/workload/trace identities, and cutoff negatives |
| `JAN-CSAA-008-VER-RUL-001` | Rules and findings | 17 ARPs, exact N/A carriers, non-bypassability, provider-substitution requalification, five dimensions, findings, immutable treatments, aggregation, and no self approval |
| `JAN-CSAA-008-VER-GAT-001` | Gate-template inertness | 12 RGTs × 2 = 24, zero RGPs, misuse rejection, exact definitive non-bypassable future-carrier prerequisite, and no transition effect |
| `JAN-CSAA-008-VER-ORC-001` | Fixture and oracle | 30 facets, 20/40 scenarios, 9 ZSC, 256/187/24 matrices, independence, divergence, and reset |
| `JAN-CSAA-008-VER-PRP-001` | Property/metamorphic | Generator/shrinker successor identity, owner-proven transformations, bounded monotonicity, honest cache provenance, and all 30 metamorphic relations |
| `JAN-CSAA-008-VER-MUT-001` | Mutation/tests-of-tests | 18 subject classes, 43 harness operators, governed applicability/criticality, kill and survivor rules |
| `JAN-CSAA-008-VER-DIF-001` | Adapter/differential | Raw-to-normalized lineage, Model Exchange, health/loss, closed differential lattice, source-governed not-applicable, shortage outcomes, substitution/removal |
| `JAN-CSAA-008-VER-INC-001` | Incremental equivalence | Exact post-change successor, wrong-successor negatives, 18 × 8 = 144 assessments, 16 × 2 supply-chain assignments, CAC-P01–P16 controls, reuse/recompute/invalidation evidence, allowed differences, and clean-full evidence |
| `JAN-CSAA-008-VER-OPS-001` | Operations and errors | 17 valid and 272 invalid pairings, exact operational behaviors, V01–V07, 77 errors, response invariants, partiality, timeout, cancellation, uncertainty, and isolation |
| `JAN-CSAA-008-VER-CMP-001` | Compatibility | Directional version claims, maps, unknown fields, deprecation, and logical-migration boundary |
| `JAN-CSAA-008-VER-SEC-001` | Security | 20 hostile classes, authorization, path/process/network/secret/resource controls, redaction, and non-disclosure |
| `JAN-CSAA-008-VER-DEG-001` | Degradation/recovery | 20 × 8 = 160 no-green matrix, 16 exact topology-neutral recovery points, implementation-specific injection protocol, duplicate/orphan/current-binding checks, and cleanup |
| `JAN-CSAA-008-VER-REP-001` | Replay | Complete replay influence manifest, separate basis/completion identities, self-excluding preimages, deterministic and allowed differences, phase/cycle negatives, and raw retention |
| `JAN-CSAA-008-VER-PER-001` | Performance | 6 workload classes, measurement validity, budget-source boundary, and semantic/resource noninterference |
| `JAN-CSAA-008-VER-DAT-001` | Dated JPWB | Exact cutoff, all 16 supply-chain coordinates, representative realistic concerns, no floating currentness, and refresh/rebinding |
| `JAN-CSAA-008-VER-AGT-001` | Agent trajectory | Required loading/invocation/evidence/stopping/no-bypass semantics and 010 reconciliation |
| `JAN-CSAA-008-VER-XPK-001` | Handoffs | Exact affected 007/009 consumption, remaining dedicated 007 conformance wires, 010/011, implementation/oracle/execution, authority, and nonperformance |
| `JAN-CSAA-008-VER-REQ-001` | Requirement accounting | 1,016 unique local rows, 41-family contiguity, exact one-modal extraction, 2,568 + 652 + 1,100 + 1,016 population arithmetic, and source reconciliation |
| `JAN-CSAA-008-VER-WIR-001` | Affected 007 wire conformance | Exact profile/role/assignment/identity/projection/digest/target/reference/finalization/key/preimage/health/error populations, closed grammar, source trace, and nonperformance |
| `JAN-CSAA-008-VER-OPR-001` | Affected 009 operational semantics | Five planes, thirty facets, persistence/publication/invalidation/cache/concurrency/recovery/migration/retention/security/audit/capacity populations, ownership, topology neutrality, and nonperformance |
| `JAN-CSAA-008-VER-OID-001` | Operational identity and preimages | P01–P12, role/record/state/content separation, applicability, canonical keys, reference directions, finalization DAG, candidate/replay preimages, and mismatch negatives |
| `JAN-CSAA-008-VER-PUB-001` | Publication, read view, and cache | Twelve states, closed transitions, PUB-P01–P16, candidate/decision/Manifest/binding/read separation, common cutoff, current/historical/no-current branches, CAC-P01–P16, and atomicity |
| `JAN-CSAA-008-VER-RCV-001` | Recovery and physical lifecycle | Sixteen recovery coordinates, concrete-injection protocol, durability, idempotency, duplicate/orphan/current-binding checks, integrity/repair/rebuild, backup/restore, migration, retention, garbage collection, cleanup, and audit |
| `JAN-CSAA-008-VER-HLT-001` | Operational health | H01–H14 meanings, scope/cutoff/source evidence, five-axis preservation, four binding branches, no aggregate healthy Boolean, no-current nontraversal, and no authority inference |
| `JAN-CSAA-008-VER-PHS-001` | Phase identity and digest cycles | All six exact cases, permanent case identities, invalid instances, exact rejections, immutable history, raw evidence, cleanup, independent reporting, cross-case non-substitution, and transitive-cycle detection |
| `JAN-CSAA-008-VER-INTEGRITY-001` | Controlled bytes | Headings, links, tables, fences, UTF-8/CRLF, terminal newline, exact bytes and SHA-256 |
| `JAN-CSAA-008-VER-SELF-001` | Post-ledger author self-review | All applicable adopted adversarial questions against exact candidate bytes |

### 29.2 Later executable evidence

| Evidence family | Required later owner | Current state |
| --- | --- | --- |
| Enforced schema compilation and generation parity | separately authorized 007 artifact executor plus 008 V&V | `NOT_AUTHORIZED / NOT_RUN` |
| Physical golden and hostile fixtures | separately authorized fixture builder plus independent oracle authority | `NOT_AUTHORIZED / NOT_CONFERRED / NOT_RUN` |
| Analyzer and adapter conformance execution | separately authorized executor | `NOT_AUTHORIZED / NOT_RUN` |
| Provider differential and qualification execution | 008 V&V plus 011 qualification owner | `NOT_AUTHORED / NOT_QUALIFIED / NOT_RUN` |
| Incremental, cache, publication, concurrency, recovery, migration, retention, health, and phase/digest execution | 008 V&V plus exact 009 operational owner and separately authorized implementation owner | `SPECIFIED_EXACTLY / NOT_AUTHORIZED / NOT_AUTHORED_AS_CODE / NOT_RUN` |
| Performance budget execution | exact budget owner plus 008 V&V | `THRESHOLD_UNSET / NOT_RUN` |
| Coding-agent trajectory execution | 008 V&V plus 010 employment owner | `PROVISIONAL / NOT_AUTHORED / NOT_RUN` |
| Independent Proposed-candidate review and integrity validation | distinct later reviewers | `NOT_RUN` |
| Final corpus sponsor review and conferral | accountable sponsor and distinct recorder | `ABSENT` |

No author-side documentation method can turn one of these later rows green.

## 30. Draft acceptance state

This Draft is eligible for objective author-side closure only when:

1. every exact source identity and provisional constraint is reproduced;
2. the unaffected inherited population contains exactly 2,568 individually retained source rows;
3. all 652 exact current `JAN-CSAA-007@1.1.0` rows and all 1,100 exact historical `JAN-CSAA-009@0.1.0` finite-cutoff rows are individually reproduced and allocated;
4. all 1,016 local requirement rows are unique, contiguous within forty-one families, and bidirectionally allocated;
5. all twenty-seven test families and twenty-four test-specification facets are complete;
6. every exact affected operational population in §§20, 22, 26, and 27 reconciles;
7. the eligibility conjunction proves that no false empty, false current, false healthy, or false green state can satisfy conformance;
8. every later executable, oracle, provider, operational, trajectory, and authority state remains a nonpass;
9. all forty-two current-phase objective verification methods reproduce against exact candidate bytes while post-ledger self-review remains not required;
10. the requirement ledger closes for the named documentation commission; and
11. corrective-successor author self-review then reruns against the exact closed-ledger candidate before Proposed promotion.

The declaration table below is the immutable `@0.2.0` affected-successor initial-publication preimage, not a mutable current-state register. The predecessor `@0.1.1` declaration remains preserved in its archive. After a ledger successor or objective-verification record is issued, the exact linked ledger and its evidence control current author-side documentation-verification state. Every executable and later-lifecycle predicate remains non-green unless its own authorized evidence exists.

| Predicate | Initial-publication declaration (historical pre-ledger preimage) |
| --- | --- |
| Local atomic requirements | `PRESENT / OBJECTIVE_VERIFICATION_PENDING` |
| Unaffected plus exact affected source rows | `2,568 + 652 + 1,100 SPECIFIED / EXECUTABLE_RECONCILIATION_NOT_RUN` |
| Twenty-seven test families | `DOCUMENTED / NOT_IMPLEMENTED` |
| Twenty-four test-specification facets | `DOCUMENTED / NOT_SERIALIZED` |
| Schemas and generated derivatives | `NOT_CREATED / NOT_ENFORCED / NOT_VERIFIED` |
| Physical fixtures and hostile cases | `NOT_MATERIALIZED / NOT_EXECUTED` |
| Expected judgments | `PROPOSED / NOT_CONFERRED / NOT_EXECUTED` |
| Test harness and test code | `NOT_AUTHORIZED / NOT_AUTHORED` |
| Executable conformance results | `NOT_RUN` |
| Provider qualification | `NOT_AUTHORED / NOT_QUALIFIED` |
| 007/009 affected documentation reconciliation | `DOCUMENTED / OBJECTIVE_VERIFICATION_PENDING / EXECUTION_NOT_RUN` |
| 010/011 reconciliation | `PENDING_LATER_DRAFTS` |
| Author objective verification | `NOT_RUN` |
| Requirement ledger | `NOT_YET_AUTHORED` |
| Author self-review | `NOT_RUN / POST_LEDGER_ONLY` |
| Independent review and integrity validation | `NOT_RUN` |
| Final corpus sponsor disposition | `ABSENT` |

These initial non-green states were accurate lifecycle facts, not defects. A linked ledger successor may record bounded author-side documentation verification without rewriting this historical table, but it cannot turn any executable, oracle, provider, independent-review, sponsor, recording, or full-wave predicate green. Manufacturing such a pass would be the defect.

## 31. Closing rule

An analyzer is conformant only for the exact declared scope whose requirements, contracts, operational profile, fixture, conferred oracle, subject, implementation, provider and adapter versions, configuration, environment, cases, mutations, publication and read binding, cache and incremental standing, recovery and phase identity, health, coverage, raw evidence, and eligibility all close together. A test that did not run cannot pass. An empty population cannot prove absence. A provider cannot author its own answer key. Agreement cannot confer truth. A cache cannot cross a subject boundary. A template cannot become a gate by use. A stale, partial, unsupported, conflicting, failed, timed-out, cancelled, resource-refused, unqualified, bypassed, or ineligible result cannot become green.
