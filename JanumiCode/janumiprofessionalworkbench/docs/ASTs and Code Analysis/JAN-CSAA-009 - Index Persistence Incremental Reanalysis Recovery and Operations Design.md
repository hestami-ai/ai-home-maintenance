# Index Persistence Incremental Reanalysis Recovery and Operations Design

**Document ID:** `JAN-CSAA-009`

**Version:** `0.2.1`

**Status:** `Draft`

**Settledness:** `HYPOTHESIS`

**Classification:** Prepared controlled-CSAA member corrective Draft; non-authoritative, documentation-only operational design preserving the exact semantic cutoff through `JAN-CSAA-007@1.0.0` and `JAN-CSAA-008@0.2.1` and binding exact correction-only source successors `JAN-CSAA-007@1.0.1` and `JAN-CSAA-008@0.2.2`; the correction changes lifecycle-currentness, historical-link continuity, review evidence, and corrective lineage only; no storage engine, graph database, queue, scheduler, transaction facility, lock service, deployment topology, provider, executable schema, generated type, test, fixture, database, service, migration, backup, failure injection, or runtime result is selected, created, executed, or conferred

**Governing status:** Documentation-only Wave 3 entry under `JAN-CSAA-W2-SEMANTIC-READINESS-001@0.1.0`, `JPWB-REG-005 REG-D-021`, and the correction at `REG-D-022`

**Role:** Define topology-neutral persistence, atomic-publication, invalidation, incremental recomputation, cache, concurrency, cancellation, migration, retention, recovery, security, observability, capacity, and operational-verification obligations for later separately authorized realization

**Authority:** None. This Draft may constrain a later implementation but cannot select a mechanism, instantiate an operational profile, execute a migration or recovery, qualify a provider, make a technical result current, create a gate effect, approve an exception, confer an oracle, or grant any member or implementation standing

**Candidate concern allocation:** Persistence, publication, invalidation execution, recomputation, cache, scheduling, concurrency, cancellation, query-authorization/access enforcement, security-control operation, recovery, migration, retention, audit, readiness, capacity, telemetry, and operational behavior only

**Requirement ledger:** [JAN-CSAA-009 Requirement Ledger](<records/JAN-CSAA-009 - Requirement Ledger.md>). The linked controlled successor, not this Draft's embedded initial-publication state table, controls current author-side ledger and objective-verification state

**Exact predecessor and preliminary-review evidence:** [`JAN-CSAA-009@0.2.0`](<records/archive/JAN-CSAA-009@0.2.0.Draft.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>), 381,782 bytes, SHA-256 `a2de3aea34f8f0e014bdcaaa8432786193038a1b8205bf7c55786d224603f24e`; [`JAN-CSAA-009-LEDGER-001@0.2.2`](<records/archive/JAN-CSAA-009-LEDGER@0.2.2.Closed.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>), 4,373,065 bytes, SHA-256 `eb47452472ccbe7c1d4cb8b7edd53e01840a1df9ca559989d8067ed02b195620`; [`JAN-CSAA-009-VERIFICATION-001@0.2.0`](<records/archive/JAN-CSAA-009-VERIFICATION@0.2.0.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>), 42,186 bytes, SHA-256 `2a4bd71ea0fadb8dd691885e86b8da6246efdffbc186358246987aadf061de2f`; [`JAN-CSAA-009-LEDGER-CLOSURE-INTEGRITY-001@0.2.0`](<records/archive/JAN-CSAA-009-LEDGER-CLOSURE-INTEGRITY@0.2.0.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>), 9,951 bytes, SHA-256 `4e688c817e73016f86adf21a52057eb3ae3bcfe7751b532abb3c4ad7181e4ee4`; [`JAN-CSAA-W3-TRIPLET-RECONCILIATION-001@0.1.0`](<records/JAN-CSAA-W3 - Wave 3 Exact Triplet Reconciliation and Synchronized Ledger State Record.md>), 22,856 bytes, SHA-256 `6031e1e7d4f7cfca027957a7c4a25c5b28333637e393054bec2403e7663696b7`; [`JAN-CSAA-009-SELF-REVIEW-001@0.1.0`](<records/archive/JAN-CSAA-009-SELF-REVIEW@0.1.0.PRELIMINARY.snapshot>), 17,179 bytes, SHA-256 `8fc9680929f1e312b9dc1f43168220be7d47d2b3513e01be8f92aa44ae52cb10`; and [`JAN-CSAA-WORKING-STATUS-001@0.10.0`](<records/JAN-CSAA - Working Corpus Authoring Status 010.md>), 14,133 bytes, SHA-256 `56d48fc90cff8d37b5ab151eb1fd2f067d46b7f85ebfe5e0cafd5f0c52dc2531`

**Correction-only source lineage:**

| Correction-only source | Exact identity | Boundary |
| --- | --- | --- |
| [JAN-CSAA-007@1.0.1](<JAN-CSAA-007 - Semantic Snapshot Graph Query Analysis Record and Adapter Contract Package.md>) | 1,343,092 bytes; SHA-256 `b2d034ac20ddca2a3676e152770b28fbccee83ab4a5c882d5a581bd33f1186b6` | Metadata, lifecycle-currentness, self-identity, supersession, and spelling correction only; no semantic or requirement-population change |
| [JAN-CSAA-008@0.2.2](<JAN-CSAA-008 - Executable Analyzer Invariant and Conformance Test Specification.md>) | 261,544 bytes; SHA-256 `f4bbe60c8edc67ac70ddf89e7c3963725252c8915dfceefd5e9d46bd70ef082a` | Historical-link and finite-cutoff correction only; five row texts correct source identity or currentness while all 999 requirement IDs, modalities, semantic obligations, and executable nonpasses are preserved |

No corrective ledger, objective-verification, closure-integrity, triplet-reconciliation, or self-review-rerun identity is asserted here. Those artifacts are derived from the final corrective source bytes and cannot be forward named.

**Companion enforced artifacts:** None

**Operational state:** `DESIGNED_IN_DOCUMENTATION / NO_OPERATIONAL_PROFILE_INSTANTIATED / NOT_IMPLEMENTED / NOT_EXECUTED`

**Provider and topology state:** `UNSELECTED / UNQUALIFIED / UNIMPLEMENTED`

**Affected reconciliation state:** The exact predecessor triplet `JAN-CSAA-007@1.0.0`, `JAN-CSAA-008@0.2.1`, and `JAN-CSAA-009@0.2.0` was reconciled by `JAN-CSAA-W3-TRIPLET-RECONCILIATION-001@0.1.0`. Exact `JAN-CSAA-007@1.0.1` and `JAN-CSAA-008@0.2.2` are correction-only successors and do not change the operational representations, conformance meaning, execution standing, or authority boundary consumed by this design. This `JAN-CSAA-009@0.2.1` successor corrects `JAN-CSAA-009-SR-001` at the Draft-source level; successor ledger, objective closure, closure-integrity, append-only reconciliation, and eighteen-question review remain required. `JAN-CSAA-010` and `JAN-CSAA-011` remain unauthored

**Reciprocal dependency cutoff:** The semantic cutoff remains `JAN-CSAA-009@0.1.0 → JAN-CSAA-007@1.0.0 → JAN-CSAA-008@0.2.1 → JAN-CSAA-009@0.2.0`. The correction lineage consists of three bounded version-successor edges: `JAN-CSAA-007@1.0.0 → JAN-CSAA-007@1.0.1`, `JAN-CSAA-008@0.2.1 → JAN-CSAA-008@0.2.2`, and `JAN-CSAA-009@0.2.0 → JAN-CSAA-009@0.2.1`. The required append-only corrective reconciliation must join their exact source and evidence state after closure, but no correction edge means that one package consumes another correction as new operational semantics or requires reciprocal semantic chasing.

**Prepared time:** `2026-07-30T07:37:49.3078452-04:00`

**Supersedes:** [JAN-CSAA-009@0.2.0 / Draft](<records/archive/JAN-CSAA-009@0.2.0.Draft.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>); 381,782 bytes; SHA-256 `a2de3aea34f8f0e014bdcaaa8432786193038a1b8205bf7c55786d224603f24e`; the exact predecessor, synchronized ledger, objective record, closure-integrity record, W3 reconciliation, and preliminary self-review remain immutable historical evidence; this successor corrects historical link targets, lifecycle-currentness language, review evidence, immediate-supersession provenance, and correction-lineage presentation only; all 1,100 normative requirement rows, operational semantics, registries, allocations, nonperformance states, provider and topology nonselections, and authority boundaries remain unchanged

**Superseded by:** None

---

## 1. Purpose

This design defines how a later Codebase Semantic Analysis and Assurance realization must preserve exact semantic subjects, immutable evidence, revision-consistent publication, conservative invalidation, clean-full equivalence, confidentiality, and reconstructable failure behavior while remaining independent of a database, graph store, filesystem layout, queue, scheduler, process model, or deployment topology.

The protected question is:

> What operational semantics make an index revision safe to persist, reuse, publish, query, invalidate, recompute, migrate, retain, recover, and retire without mixing subjects, rewriting evidence, fabricating freshness, duplicating effects, leaking protected information, or turning operational health into semantic truth?

The answer is a closed behavioral contract rather than a technology choice. A later realization may employ one or several physical mechanisms only if its exact operational profile demonstrates every obligation in this design and passes the separately governed conformance allocations in `JAN-CSAA-008`.

## 2. Concern ownership and exclusions

`JAN-CSAA-009` owns physical operational behavior: persistence, atomic publication, current-binding management, invalidation propagation, recomputation scheduling, cache admission and eviction, concurrency, cancellation effects, crash recovery, corruption response, backup and restore, physical migration, retention action, garbage collection, audit emission, readiness, and capacity behavior.

It does not redefine the records or technical meanings it operates:

- `JAN-CSAA-002` retains semantic-object, relation, lifecycle, freshness-state, provenance, and epistemic meaning;
- `JAN-CSAA-003` retains capability, query, slice, comparison, delta, impact, logical invalidation, and observational-equivalence meaning;
- `JAN-CSAA-004` retains rule, finding, treatment, exception, provider-obligation, and gate meaning;
- `JAN-CSAA-005` retains dated JPWB description only;
- `JAN-CSAA-006` retains fixture-case and proposed expected-judgment strategy;
- `JAN-CSAA-007` retains candidate serialization, operation-envelope, error, compatibility, and adapter shape;
- `JAN-CSAA-008` retains conformance and V&V method;
- `JAN-CSAA-010` retains later coding-agent employment semantics;
- `JAN-CSAA-011` retains later concrete analyzer provider/tool/adapter qualification, bounded-role selection, licensing, installation, provider-specific sandboxing/security review, operation, substitution, and removal; and
- Canon retains professional assurance, admissibility, decision, waiver, approval, and Baseline meaning.

An operational act can make an exact publication the mechanically selected target for one stable publication channel inside one security partition. It cannot make a fact true, an oracle conferred, a provider qualified, a finding disposed, a rule satisfied, a gate effective, or a change approved.

## 3. Exact source baseline and lifecycle evidence

### 3.1 Controlled semantic inputs
| Exact input | Identity | Standing in this Draft |
| --- | --- | --- |
| [JAN-CSAA-000@0.3.0](<README.md>) | 102,164 bytes; SHA-256 `833b97d9fe12ae5e245b6c2920216ec3271e59f68dc24c54d0efd9a1efdf32a1` | Adopted program authority; reserved filename and §10.9 commission |
| [JAN-CSAA-001@0.3.0](<JAN-CSAA-001 - Codebase Semantic Analysis and Assurance Architecture.md>) | 109,420 bytes; SHA-256 `cda7defe7fa310f912bceb8b355952e1159bebc05528fc51c310578ede26237b` | Provisional architecture, trust, failure, alternatives, and operations input |
| [JAN-CSAA-002@0.3.0](<JAN-CSAA-002 - TypeScript Semantic Model and Invariant Catalog.md>) | 162,179 bytes; SHA-256 `9bcaa9f9a2212d66ae7c417af84c4f0e14672d282c04e73d719f7f9cceda1911` | Provisional semantic, lifecycle, freshness, and invariant input |
| [JAN-CSAA-003@0.1.0](<JAN-CSAA-003 - Analysis Enrichment Query and Change Impact Specification.md>) | 169,676 bytes; SHA-256 `65b3a9379dd47a25de1693ed709eafd11f7a9063db1cfd80b5da2bba01b46d10` | Provisional logical invalidation, dependency, query, and clean-full-equivalence input |
| [JAN-CSAA-004@0.1.0](<JAN-CSAA-004 - Code Analysis Rule Gate and Analyzer Provider Contract.md>) | 176,071 bytes; SHA-256 `8812dc55c05167223341b08d3d5bc85b8b1e5ad085c9a0e198a13512af69dc89` | Provisional provider-failure, disagreement, finding-history, and no-false-green input |
| [JAN-CSAA-005@0.3.0](<JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md>) | 119,118 bytes; SHA-256 `3a9f49a492ca0b73cb50413bf694cf90e0608d73d6248db9df7cb45804b80625` | Provisional dated repository-description input only |
| [JAN-CSAA-006@0.1.0](<JAN-CSAA-006 - Golden Repository and Change Scenario Fixture.md>) | 138,584 bytes; SHA-256 `7d6804b0198ba19285903f53ac5053971310b0278bd5a6c7f6946e3265814361` | Provisional recovery and degradation scenario input; expected judgments remain non-conferred |
| [JAN-CSAA-007@1.0.0](<records/archive/JAN-CSAA-007@1.0.0.Draft.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>) | 1,340,805 bytes; SHA-256 `e6f635ca42e5d74cbe0ec942a4f6b7793fa15e54acca1098be62e8086dee8e5e` | Exact affected candidate operational representations, error mappings, health standing, and noncircular lifecycle shapes; no executable artifact or authority |
| [JAN-CSAA-008@0.2.1](<records/archive/JAN-CSAA-008@0.2.1.Draft.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>) | 257,899 bytes; SHA-256 `45df0e0ae04ec0ece60d5f560c90c396de9bd92950029050490317a09b43e45b` | Exact affected conformance, fault, hostile, recovery, incremental, wire, publication, and no-false-green documentation; no executable result |

### 3.2 Objective and sequencing evidence
| Evidence | Exact identity | Use |
| --- | --- | --- |
| [JAN-CSAA-W2-SEMANTIC-READINESS-001@0.1.0](<records/JAN-CSAA-W2 - Documentation Semantic Readiness and Wave 3 Entry Record.md>) | 15,435 bytes; SHA-256 `4966e308024fd451bcc7f2378810389fda0d4446e0738f2b9663e4974c46ba18` | Authorizes this documentation-only operational design under explicit provisional constraints |
| [JAN-CSAA-W2-OBJECTIVE-RECONCILIATION-001@0.1.0](<records/JAN-CSAA-W2 - Wave 2 Cross-Package Objective Reconciliation Record.md>) | 13,879 bytes; SHA-256 `755459221a65f9fada7541953bd9aa7ba8976592fdc803801a1838ce1dfef46b` | Wave 2 objective reconciliation only |
| [JAN-CSAA-W2-LEDGER-CLOSURE-INTEGRITY-001@0.1.0](<records/JAN-CSAA-W2 - Synchronized Ledger Closure and Integrity Record.md>) | 12,436 bytes; SHA-256 `5f2f5d095354dc90b4525e9dec84c0f07fefdcd612a6b39c11097bdae6e4f643` | Wave 2 author-side objective closure only |
| [JAN-CSAA-WORKING-STATUS-001@0.9.0](<records/JAN-CSAA - Working Corpus Authoring Status 009.md>) | 11,687 bytes; SHA-256 `b55816d7f897185a80c1ed59f3b7a8a36787fe2a65f111fa896eb00466d2fb51` | Exact pre-Wave-3 preliminary-review state; historical working evidence |
| [JAN-CSAA-000-LEDGER-001@0.2.0](<records/JAN-CSAA-000 - Requirement Ledger.md>) | 1,235,725 bytes; SHA-256 `4688ef64f4b46f898bf3fff3dfee5a056695a9a167df8adbf7fbaad61ac74013` | Exact source registry for the 31 direct adopted-program rows |
| [JAN-CSAA-004-LEDGER-001@0.1.1](<records/JAN-CSAA-004 - Requirement Ledger.md>) | 498,116 bytes; SHA-256 `368e3c4537d0ceb493df5bb534d992c54cc5a1a6a5798bb5172d63bd6a9cef63` | Exact source registry for the 53 direct Canon rows |
| [JAN-CSAA-007-LEDGER-001@1.0.1](<records/archive/JAN-CSAA-007-LEDGER@1.0.1.Closed.PRE-W3-TRIPLET-RECONCILIATION.snapshot>) | 3,217,506 bytes; SHA-256 `54f21dd4e25a1f447627e4f3fd8355480a4d76f759cdae64b48d407782b536fb` | Exact affected-source closed ledger containing 637 finite-W3 local 007 rows |
| [JAN-CSAA-007-VERIFICATION-001@0.2.0](<records/archive/JAN-CSAA-007-VERIFICATION@0.2.0.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>) | 17,264 bytes; SHA-256 `49fe0cc99332daf9be61583e0eb5e720243b8d7d34c1b317e3b5a6cb5cd5618e` | Exact affected-source objective documentation verification |
| [JAN-CSAA-007-LEDGER-CLOSURE-INTEGRITY-001@0.2.0](<records/archive/JAN-CSAA-007-LEDGER-CLOSURE-INTEGRITY@0.2.0.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>) | 8,054 bytes; SHA-256 `07d0c90a67f83d74fbb6982b16dab1d8a624b5119ce7db145cad693ef12d946d` | Noncircular exact affected-ledger integrity evidence |
| [JAN-CSAA-008-LEDGER-001@0.2.2](<records/archive/JAN-CSAA-008-LEDGER@0.2.2.Closed.PRE-W3-TRIPLET-RECONCILIATION.snapshot>) | 3,968,991 bytes; SHA-256 `03e076fa93444208b5b9b2f4cb9574b9f243d32af219f7a438a606171f213226` | Exact affected-source closed ledger containing 999 finite-W3 local 008 rows; every physical execution remains nonpass |
| [JAN-CSAA-008-VERIFICATION-001@0.2.1](<records/archive/JAN-CSAA-008-VERIFICATION@0.2.1.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>) | 32,424 bytes; SHA-256 `b080e0fc0e62e2bb77501ba29bc665dc434aa8b6c275a7e2c367a599aba08242` | Exact affected-source objective documentation verification |
| [JAN-CSAA-008-LEDGER-CLOSURE-INTEGRITY-001@0.2.0](<records/archive/JAN-CSAA-008-LEDGER-CLOSURE-INTEGRITY@0.2.0.PRE-W3-SELF-REVIEW-CORRECTION.snapshot>) | 9,028 bytes; SHA-256 `cc98ed25bf5c25fd2ac05c257551760136d895f77ca26e7b71b56b80613d4e02` | Noncircular exact affected-ledger integrity evidence |

The exact 001 through 006 sources, ledgers, and objective records remain unchanged inherited inputs. The 454-row historical 007 and 813-row historical 008 catalogs remain archived evidence only; they were replaced in the finite semantic inherited intake consumed by the predecessor reconciliation by the exact 637-row `JAN-CSAA-007@1.0.0` and 999-row `JAN-CSAA-008@0.2.1` local catalogs. The correction-only `JAN-CSAA-007@1.0.1` and `JAN-CSAA-008@0.2.2` sources do not alter those semantic populations. None of those objective closures or corrections makes a Draft authoritative, executable, implemented, or current beyond its exact time-bounded identity.

The affected 007 delta is exactly 454 historical rows to 637 semantic-cutoff rows: 453 unchanged IDs, one revised obligation, 183 additions, and zero removals. The affected 008 delta is exactly 813 historical rows to 999 semantic-cutoff rows: 804 unchanged IDs, nine revised obligations, 186 additions, and zero removals. These are inherited source changes, not new 009-local requirements; the correction-only successors preserve the same row populations and meanings.

The planned pre-local ledger population is exactly **3,933** identity-distinct rows: **31 direct adopted-program rows**, comprising `CSAA-000-REQ-499` through `526` and `CSAA-000-REQ-659` through `661`; **3,796 predecessor local-catalog rows**, decomposed as `240 + 553 + 290 + 401 + 336 + 340 + 637 + 999 = 3,796`; **53 direct Canon rows**; and **53 Wave 3 readiness rows**. Thus `31 + 3,796 + 53 + 53 = 3,933`. None of these four populations overlaps another.

During this exclusively owned documentation-authoring subphase, Git status, diff, branch, revision, and repository-wide polling are not concurrency or currentness inputs for this documentation subtree. This temporary authoring rule does not replace later executable subject/revision binding. A final consolidated implementation refresh remains mandatory before exact-corpus freeze.

### 3.3 Immutable historical affected-input evidence

| Exact historical artifact | Role | Exact identity |
| --- | --- | --- |
| [JAN-CSAA-007@0.1.0](<records/archive/JAN-CSAA-007@0.1.0.Draft.PRE-AFFECTED-009.snapshot>) | Initial 009 authoring-time 007 source | 1,136,266 bytes; SHA-256 `2676b6ce98f6ac224d922a57838106ba0d2361fbcd55a3739de8fb152c281928` |
| [JAN-CSAA-007-LEDGER-001@0.1.2](<records/archive/JAN-CSAA-007-LEDGER@0.1.2.Closed.PRE-AFFECTED-009.snapshot>) | Initial closed 007 ledger | 1,419,338 bytes; SHA-256 `f716e7f218843bef74ab9035d8963866d93453bf06c4a43452967e15870c3934` |
| [JAN-CSAA-007-VERIFICATION-001@0.1.0](<records/archive/JAN-CSAA-007-VERIFICATION@0.1.0.PRE-AFFECTED-009.snapshot>) | Initial 007 objective evidence | 24,208 bytes; SHA-256 `57fbee3a880ee58551e0a68b8fc9ca6ffee3901763a98b44b7feb68bbe774a1d` |
| [JAN-CSAA-007-LEDGER-CLOSURE-INTEGRITY-001@0.1.0](<records/archive/JAN-CSAA-007-LEDGER-CLOSURE-INTEGRITY@0.1.0.PRE-AFFECTED-009.snapshot>) | Initial 007 integrity evidence | 11,318 bytes; SHA-256 `a5de1efea2f3f2266fbdfe8b5028249f5bd3d0ee9fedc9c864c7ded301f4a6d5` |
| [JAN-CSAA-008@0.1.1](<records/archive/JAN-CSAA-008@0.1.1.Draft.PRE-AFFECTED-009.snapshot>) | Initial 009 authoring-time 008 source | 206,705 bytes; SHA-256 `a15488930e16769d3ed63d1ca8e9f89c0531b4e43c1b80065a9a0d034e345663` |
| [JAN-CSAA-008-LEDGER-001@0.1.4](<records/archive/JAN-CSAA-008-LEDGER@0.1.4.Closed.PRE-AFFECTED-009.snapshot>) | Initial closed 008 ledger | 2,010,342 bytes; SHA-256 `da450aa690022d7aaf3ba84440dff9921c2fa6733d98c45338a687add876085a` |
| [JAN-CSAA-008-VERIFICATION-001@0.1.1](<records/archive/JAN-CSAA-008-VERIFICATION@0.1.1.PRE-AFFECTED-009.snapshot>) | Initial 008 objective evidence | 24,862 bytes; SHA-256 `4e3ee9a81a014995505f4b574ca600fdde9a0b7e76f0bf733431eb3182f5b43e` |
| [JAN-CSAA-008-LEDGER-CLOSURE-INTEGRITY-001@0.1.0](<records/archive/JAN-CSAA-008-LEDGER-CLOSURE-INTEGRITY@0.1.0.PRE-AFFECTED-009.snapshot>) | Initial 008 integrity evidence | 13,171 bytes; SHA-256 `4848cee63cf6e39e6a611588f4edfc59442ad4d627c7aad799a8a87effbcbaf1` |
| [JAN-CSAA-009@0.1.0](<records/archive/JAN-CSAA-009@0.1.0.Draft.PRE-AFFECTED-008.snapshot>) | Finite-cutoff operational-semantic source | 372,913 bytes; SHA-256 `13c61cf36920b4d5cd804a9a0be09e32013b810f12ebd2a09708bb1c1562447d` |
| [JAN-CSAA-009-LEDGER-001@0.1.1](<records/archive/JAN-CSAA-009-LEDGER@0.1.1.Closed.PRE-AFFECTED-008.snapshot>) | Finite-cutoff closed-ledger evidence | 2,861,853 bytes; SHA-256 `31b9232f012df5950cb0ce3851e1b2e84cd71a237477b88c93aaed8b741f36ec` |
| [JAN-CSAA-009-VERIFICATION-001@0.1.0](<records/archive/JAN-CSAA-009-VERIFICATION@0.1.0.PRE-AFFECTED-008.snapshot>) | Finite-cutoff objective-verification evidence | 23,690 bytes; SHA-256 `87da6aa9dbdd19b7621f4f6f8cfa6eea268620d17df11d2296b19c225aa0b1a5` |
| [JAN-CSAA-009-LEDGER-CLOSURE-INTEGRITY-001@0.1.0](<records/archive/JAN-CSAA-009-LEDGER-CLOSURE-INTEGRITY@0.1.0.PRE-AFFECTED-008.snapshot>) | Finite-cutoff closure-integrity evidence | 12,471 bytes; SHA-256 `bc39fd4c20cca59f78b2e8931734fa1211b8a645f6bb72e6d622887e2da4ff18` |

The immutable semantic-baseline, sequencing, and historical affected-input links in §§3.1–3.3 identify the exact artifacts consumed by the predecessor reconciliation. The separately identified correction-lineage sources repair document currentness only. Neither set rewrites archived inputs, creates a floating-current semantic dependency, or confers authority.

### 3.4 Mandatory provisional constraints

1. The ordered labels `F01` through `F28`, not punctuation splitting, define exact `JAN-CSAA-003@0.1.0` Capability Profile facets; this Draft does not resolve `JAN-CSAA-003-SR-002`.
2. Every inherited `JAN-CSAA-006@0.1.0` expected judgment remains `PROPOSED / NOT_CONFERRED / NOT_EXECUTED`.
3. All seventeen Analysis Rule Profiles retain `UNASSIGNED` binding authority; both protected transition carriers remain `N/A — no instantiated RGP or protected transition`; all twelve Repository Gate Templates remain `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no Repository Gate Profile exists.
4. Provider disagreement, raw provenance, limitation, failure, timeout, unsupported, partial, conflicting, stale, and unknown state remain visible and non-green.
5. `JAN-CSAA-007@1.0.0` supplies exact affected candidate representations without overloading the historical records; executable schemas, generated derivatives, validators, adapters, and accepted runtime instances remain not created, not authorized, and not enforced.
6. `JAN-CSAA-008@0.2.1` supplies exact affected conformance documentation against the `JAN-CSAA-009@0.1.0` operational baseline but has not created or executed a physical test, fixture, harness, oracle judgment, provider run, or result.
7. No persistence engine, graph database, queue, scheduler, lock, transaction API, filesystem layout, service boundary, deployment model, provider, or numeric service objective is selected.
8. No implementation source, test, configuration, dependency, executable schema, fixture, oracle, gate, provider, service, database, register, or README state is changed by this documentation successor; only the exact controlled 009 source and companion authoring records may advance under their separate bounded procedures.

## 4. Foundational non-equivalences
| Left concept | Prohibited equivalence | Required treatment |
| --- | --- | --- |
| Persisted bytes | Valid semantic record | Integrity, contract, provenance, authorization, and semantic admission remain separately required |
| Content-addressed location | Truth or authenticity | A digest can establish byte equality under a declared profile; it cannot establish semantic truth or signer identity |
| Current operational binding | Current semantic evidence | The publication is mechanically selected for one partition; every freshness and eligibility predicate still applies |
| Database transaction | Complete logical publication | All publication predicates and cross-surface effects must share one observable atomic boundary regardless of mechanism |
| Cache hit | Fresh supported result | Exact key, dependency, provenance, health, authorization, and currentness admission must be re-established |
| Time-to-live not expired | Currentness | Elapsed time cannot replace dependency evidence or a declared currency predicate |
| Incremental completion | Clean-full equivalence | All semantic dimensions must be compared under the same subject and methods; completion alone proves nothing |
| Retry delivery | Permission to repeat an effect | An uncertain effect must be reconciled and an idempotency predicate must hold before repetition |
| Prior publication | Fallback current result | A predecessor remains historical unless a separately valid current-binding decision names it |
| Replica, backup, or projection | Independent source of truth | Every derivative remains bound to its authoritative immutable inputs and exact reconstruction basis |
| Deletion of payload | Correction of history | Physical unavailability cannot rewrite the prior record, identity, lineage, or historical action |
| Encryption | Authorization or redaction | Cryptographic protection does not grant access or define what may be disclosed |
| Operational health | Semantic correctness | Availability, readiness, integrity, freshness, capability, and correctness remain separate axes |
| Provider fallback | Equivalent result | Substitution is visible, version-bound, qualified later, and compared under explicit compatibility rules |
| Successful migration job | Safe cutover | Inventory, compatibility, reconciliation, rollback, current-binding, and post-cutover checks must all close |
| Log or metric | Authority | Operational telemetry is evidence only and cannot approve, waive, confer, or make a gate effective |
| Foreground provisional result | Published snapshot | Provisional edit-time material cannot become current through presentation, reuse, or age |
| Garbage collection reachability | Retention permission | Policy, holds, confidentiality, and historical obligations remain independent predicates |
| Cross-snapshot comparison | Mixed-revision query | A comparison names every exact subject and labels its relation; accidental mixing has no such contract |
| Operational design | Implemented mechanism | This Draft creates behavior obligations and no executable facility |

## 5. Operational model and profile contract

### 5.1 Planes and authority

A later realization separates five logical planes even when one process or one storage technology hosts several of them:
| Plane | Material or action | Boundary |
| --- | --- | --- |
| `definition` | Controlled semantic, shape, verification, operational, provider, and policy definitions | Versioned inputs only; never mutable runtime truth |
| `material` | Immutable source, raw, normalized, graph, evidence, finding, manifest, audit, and result material | Content- and identity-bound records; append-oriented successors |
| `coordination` | Requests, plans, claims, attempts, checkpoints, cancellations, retries, and recovery work | Controls work without owning semantic meaning |
| `publication` | Candidate eligibility, exact predecessor expectation, linearization decision, and current binding | The sole operational current-selection boundary |
| `consumption` | Snapshot-pinned query, export, comparison, health, and authorized retrieval views | Reads exact immutable publications and never silently widens scope |

The planes are logical responsibilities, not prescribed services. A combined implementation still proves their non-conflation; a distributed implementation still preserves their common identities and atomic boundaries.

### 5.2 Thirty-facet operational profile

A later concrete realization must instantiate one immutable `OperationalProfileDefinition` resolving exactly one value for every ordered facet `O01` through `O30`. Missing, duplicate, blank, reordered, silently defaulted, or merged facets are invalid. A reasoned not-applicable value is permitted only where this design explicitly allows it. This definition is semantic only; exact `JAN-CSAA-007@1.0.0` supplies its candidate wire representation, while executable serialization, validation, and accepted instances remain absent.
| Facet | Required meaning |
| --- | --- |
| O01 | Permanent profile identity, version, predecessor, lifecycle, owner, and exact definition digest |
| O02 | Exact governed document, contract-package, semantic-owner, implementation, and configuration identities |
| O03 | Supported repository, worktree, branch, snapshot, evidence-set, principal, tenant, and confidentiality perimeters |
| O04 | Deployment-independent component roles, trust crossings, side effects, and failure containment |
| O05 | Immutable material classes, authoritative source for each class, identity, digest, and finalization rules |
| O06 | Physical durability commitment for request, attempt, raw, normalized, candidate, publication, audit, and recovery material |
| O07 | Security-partition, publication-channel, candidate, operation, cache, read-view, and generation-guard projections with applicability and placement independence |
| O08 | Current-binding model, publication predecessor, fencing/concurrency token, and linearization proof |
| O09 | Candidate assembly, completeness, validation, sealing, refusal, orphan, and cleanup behavior |
| O10 | Read-view acquisition, page/stream continuation, comparison, and mixed-revision prevention |
| O11 | Dependency observation, invalidation event, conservative closure, broadening, and unresolved-dependency treatment |
| O12 | Incremental plan, reuse provenance, recomputation, clean-full equivalence, and allowed-difference policy |
| O13 | Cache and derived-index key, admission, validation, isolation, invalidation, eviction, and miss behavior |
| O14 | Concurrent reader, writer, publisher, invalidator, migrator, retention actor, and recovery interaction |
| O15 | Work claim, attempt, heartbeat or liveness observation, fencing, duplicate delivery, and stale-worker behavior |
| O16 | Admission, priority, fairness, backpressure, deadline, timeout, progress, and resource-budget behavior |
| O17 | Cancellation request, propagation, effective boundary, partial material, cleanup, and late-cancellation behavior |
| O18 | Retry classification, uncertainty reconciliation, idempotency key, attempt limits, delay policy, and terminal outcome |
| O19 | Crash and restart boundaries, durable checkpoints, startup reconciliation, abandoned work, and recovery ownership |
| O20 | Integrity verification, corruption classes, quarantine, blast-radius analysis, repair, rebuild, and residual loss |
| O21 | Backup set, consistency boundary, encryption, retention, restore isolation, validation, activation, and recovery objectives |
| O22 | Storage/contract migration inventory, compatibility, shadow/dual modes, reconciliation, cutover, rollback, and decommission |
| O23 | Retention policy, holds, archival, redaction, deletion, tombstone or unavailability evidence, and derivative inheritance |
| O24 | Garbage-collection roots, reachability proof, grace boundary, deletion authorization, race prevention, and audit |
| O25 | Authentication, authorization, least privilege, secret handling, encryption, key rotation, egress, and disclosure control |
| O26 | Audit event classes, safe payloads, correlation, causation, ordering, integrity, retention, and access |
| O27 | Health, readiness, liveness, freshness, integrity, backlog, capacity, dependency, and degraded-mode dimensions |
| O28 | Metrics, traces, logs, service-objective parameters, workload measurements, cardinality, redaction, and evidence retention |
| O29 | Storage/orchestration alternatives, unresolved decisions, safe defaults, experiment requirements, strongest opposing case, and exit criteria |
| O30 | Requirement trace, 008 conformance allocation, failure-injection matrix, implementation authority, review, and residual risks |

### 5.3 Operational profile standing

`OperationalProfileDefinition` states a candidate physical design. It is definition-plane controlled material: its O01 permanent identity, version, predecessor, lifecycle, owner, and exact definition digest are retained as an exact M01 reference and it is intentionally outside the runtime operational-record and operational-identity closures in §7. `OperationalProfileInstantiation` later binds one exact definition to implementation artifacts, configuration, deployment, security policy, provider set, storage layout, migration state, and separately authorized execution. It is runtime configuration truth and therefore has an independently preserved record role and identity in §7. `OperationalObservation` records what occurred through the closed specialized observation roles in §7.1 and later sections. `OperationalQualificationAssessment` belongs to later qualification and V&V and is not a runtime operational record in this design. None is interchangeable.

No operational-profile instance exists. Within the finite-W3 semantic baseline, exact `JAN-CSAA-007@1.0.0` supplies distinct candidate definition, instantiation, observation, and qualification representations without overloading `AnalysisPlanRecord`, `OperationRequestBase`, `AnalysisStatusRecord`, `PublicationManifestRecord`, `HealthResponse`, or `AuditEventRecord`; executable serialization and accepted instances remain absent. A changed implementation, configuration, deployment, security, provider, storage, or migration binding creates a successor `operationalProfileInstantiationId`; it never mutates or aliases the prior instantiation.

## 6. Operational identity and isolation

### 6.1 Closed partition-coordinate registry

Operational isolation and publication do not share one monolithic key. A later realization derives five distinct projections from the closed coordinates below:

1. `securityPartitionId` is the stable authorization and information-control isolation boundary;
2. `publicationChannelId` is the stable logical current-binding channel across successor candidates and excludes snapshot, evidence revision, request, migration epoch, and generation;
3. `candidateSubjectKey` is the immutable exact subject and analysis basis of one candidate;
4. `operationKey` is the exact request/query/budget/continuation projection; and
5. `cacheKeyDigest` is the complete derivative-reuse projection and includes observed publication generations and compatibility decisions where applicable.

`expectedPublicationGeneration` is mutable compare-and-publish guard state. It is never part of `securityPartitionId`, `publicationChannelId`, or `candidateSubjectKey`. Every coordinate receives either an exact value or an owner-backed `not-applicable(reason)` value under the seventeen-operation applicability matrix; omission and invented placeholder identity are invalid.
| Coordinate | Projection | Required meaning | Protected rule |
| --- | --- | --- | --- |
| `P01` | Security partition | Administrative namespace, repository trust domain, principal, delegation, tenant or owner-backed not-applicable, and purpose | Stable isolation boundary; prevents cross-domain authorization aliasing |
| `P02` | Security partition | Information-control, confidentiality, access, retention, redaction, disclosure, and egress policy identities | Stable protection boundary; prevents reuse under weaker treatment |
| `P03` | Publication channel | Repository plus worktree or synthetic-subject lineage, project/variant, and logical publication class | Stable across successor snapshots; moving refs are observations, not channel identity |
| `P04` | Publication channel | Declared currentness scope, capability/population purpose, and static-versus-execution publication lane | Separates intentionally independent current bindings without using candidate state |
| `P05` | Publication channel | Topology-neutral channel namespace and stable channel-profile identity | Excludes exact contract/provider versions, physical placement, migration epoch, and generation |
| `P06` | Candidate subject | Exact static snapshot, working change set, merge basis, acquisition boundary, and immutable subject digest | Pins every static fact without fragmenting the stable channel |
| `P07` | Candidate/read vector | Candidate projection binds the exact new execution-evidence-set identity and revision, source-owned `staticSemanticSnapshotIdentityRef`, observation cutoff, and every already-committed upstream-lane reference while expressly excluding that lane's own future publication decision and publication generation; read projection binds each committed lane's exact publication decision, Publication Manifest, channel, generation, evidence-set revision, source-owned static-snapshot reference, and observation cutoff | Pins a candidate's dynamic subject without future-state circularity and pins read evidence only through committed publications |
| `P08` | Candidate subject | Project/configuration closure plus exact `operationalProfileInstantiationId`, contract, semantic-owner, rule/profile, adapter, provider/method, toolchain, and generated-context versions | Prevents incompatible semantic-basis or operational-instantiation reuse inside one channel |
| `P09` | Material basis | Migration epoch, physical-format compatibility, integrity state, exact `integrityIncidentId`, `repairExecutionId`, and prepublication `replayBasisManifestId` when applicable, transform, and storage-profile identity; the same candidate's future output-complete `replayManifestId` is excluded | Prevents old/new physical-state, repair, incident, or replay-basis mixing and replay self-circularity without changing channel identity |
| `P10` | Operation key | Operation/version, query, capability, population, budget, partial-result, ordering, approximation, inference, and continuation projection | Prevents request/result-shape aliasing |
| `P11` | Cache key | Complete dependency manifest, transform, compatibility-decision identity, observed publication vector, authorization decision, and protection-policy projection | Prevents derivative reuse from weakening exact subject, compatibility, currentness, or access |
| `P12` | Concurrency observation | Expected predecessor, expected publication generation, fencing identity, state revision, and acquisition cutoff | Mutable guard/read state only; excluded from every stable channel and candidate-subject key |

`P07` is phase-discriminated. While an execution-evidence publication candidate is being constructed, its `candidateSubjectKey` uses the candidate projection: the exact new evidence-set identity and revision, its source-owned `staticSemanticSnapshotIdentityRef`, its observation cutoff, and any exact already-committed upstream-lane publication references. That projection excludes the candidate lane's own not-yet-existing `PublicationDecisionRecord` and `publicationGeneration`; neither may be anticipated, invented, or backfilled into the immutable candidate subject. The sealed candidate and Publication Manifest are carried separately by the publication tuple.

After commit, a content-read projection uses the read form of `P07`: each included lane's exact committed publication decision, Publication Manifest, channel, generation, evidence-set revision, source-owned `staticSemanticSnapshotIdentityRef`, and observation cutoff. Using only upstream bases or owner-backed not-applicable values cannot complete the candidate projection for a new execution-evidence lane, and using a future decision or generation would be circular.

### 6.2 Identity rules

Content equality permits deduplication only when digest profile, purpose projection, information-control treatment, and all identity-bearing metadata are compatible. Deduplication changes storage multiplicity, not logical record multiplicity or provenance.

A mutable locator, branch name, path, queue position, worker ID, database key, timestamp, cache address, or current pointer is never semantic identity. A current binding names a finalized immutable publication in one stable publication channel; it does not absorb the publication's identity.

Cross-security-partition or cross-publication-channel comparison is allowed only by an explicit comparison request that names every exact subject and preserves separate authorization and redaction evaluation for each. Reuse across either boundary is denied unless an exact compatibility and information-control decision proves the permitted direction, scope, evidence, loss treatment, and current validity; convenience, same user, same repository name, or byte similarity is insufficient.

### 6.3 Seventeen-operation coordinate-applicability matrix

The existing 007 operation/input policy controls whether a subject is required, optional, or `not-applicable`. This matrix controls only operational projection:
| Operation | Security/channel applicability | Publication-vector applicability | Operation projection | Required boundary |
| --- | --- | --- | --- | --- |
| `csaa.contract.negotiate` | Security/authorization projection required; subject publication channel is `not-applicable(reason)` | `not-applicable(reason)` | Required compatibility-request key | Preserve `authorityBinding.authorizationContextRef`; no subject, publication channel, snapshot, or evidence identity may be invented |
| `csaa.subject.describe` | Locator/acquisition scope; channel only after exact resolution | `not-applicable` | Required subject-description key | Unresolved or denied locator remains explicit |
| `csaa.snapshot.get` | Exact stable static channel | One committed static publication | Required snapshot-read key | Content read cannot use no-current health view |
| `csaa.analysis.plan` | Exact subject lineage and prospective channel | Optional exact base publication vector | Required plan key | No publication is implied |
| `csaa.analysis.start` | Exact subject lineage and target channel | Optional exact base vector; candidate basis required | Required request-idempotency key | Separate execution authority required |
| `csaa.analysis.status` | Inherited from exact live/final target | Target-observed vector or owner-backed not-applicable | Required live-target key | State revision and concurrency token required |
| `csaa.analysis.cancel` | Inherited from exact live target | Target-observed vector or owner-backed not-applicable | Required cancellation key | No new subject or currentness invented |
| `csaa.query.execute` | Exact channel | Committed static plus every execution lane used | Required query/continuation key | Implicit analysis prohibited |
| `csaa.slice.compute` | Exact channel | Committed static plus every execution lane used | Required slice/continuation key | Implicit analysis prohibited |
| `csaa.comparison.compute` | One exact channel per labeled lane | One committed publication vector per lane | Required comparison key | No lane is silently coalesced |
| `csaa.impact.compute` | Exact channel | Committed static plus every execution lane used | Required impact key | Unresolved frontier remains explicit |
| `csaa.finding.get` | Exact channel | Committed publication vector owning the finding | Required finding key | No treatment or disposition mutation |
| `csaa.finding.list` | Exact channel | Committed publication vector owning the population | Required page/continuation key | No generation mixing |
| `csaa.raw.get` | Exact security partition; channel when material is publication-bound | Exact owning publication or owner-backed not-applicable | Required raw-retrieval key | Authorization precedes existence disclosure |
| `csaa.fixture.describe` | Exact fixture subject; publication channel `not-applicable` | `not-applicable` unless fixture references a committed publication | Required fixture key | No fixture execution or oracle conferral |
| `csaa.gate.evaluate` | Exact gate/profile scope | Exact input publication vector if a future effective RGP exists | Required gate key | Current baseline refuses; no profile invented |
| `csaa.health.get` | Exact observation scope; subject/channel may be `not-applicable` | Committed vector, `no-current-binding`, `binding-unavailable`, or `binding-corrupt` | Required health-observation key | Non-content health view cannot expose semantic content |

## 7. Persisted material and durability

### 7.1 Closed operational-record semantics registry

This registry defines concern-owned conceptual meaning, not a competing wire decomposition. Exact `JAN-CSAA-007@1.0.0` supplies the affected candidate decomposition through distinct records, discriminated branches, and lossless composition while preserving each role as independently addressable, noncircular, and verifiable. Those shapes remain documentation only. Any later accepted instances are immutable, and current operational state is derived at an exact cutoff from their ordered lineage.
| Record semantics | Required role |
| --- | --- |
| `OperationalProfileInstantiationRecord` | One immutable runtime binding from an exact `OperationalProfileDefinition` to implementation artifacts, configuration, deployment, security policy, provider set, storage layout, migration state, and authorized execution basis |
| `OperationTransitionRecord` | Append-only observation of an exact 007 operation-state transition, state revision, cause, and evidence |
| `WorkUnitRecord` | One bounded schedulable unit with exact dependencies, subject, inputs, budget, required/optional class, and expected outputs |
| `WorkAttemptRecord` | One attempt; every retry, restart, repair, or reconciliation receives a new attempt identity |
| `ExecutionClaimRecord` | One independently identified bounded successfully acquired claim lifecycle and right to act against one immutable expected work-state revision, with an independently advancing claim-state revision and opaque fencing identity minted and bound only when activation succeeds |
| `RecoveryEpochRecord` | One restart/recovery pass, discovered state, claims, reconciliation decisions, and outcome |
| `RecoveryCheckpointRecord` | One checkpoint assessment lifecycle from proposed barrier basis through terminal state; content-bound completion evidence exists only after verification, `DURABLE` records the declared commitment, and `REJECTED` preserves noncompletion |
| `IntegrityIncidentRecord` | One detected corruption or integrity-condition lineage with exact affected population, blast radius, containment/quarantine, ordered assessments, closure basis, and explicit residual loss |
| `RepairExecutionRecord` | One exact authorized repair or authoritative-material rebuild action against an integrity incident, including plan, basis, attempts, verification, rollback, outcome, and residual state |
| `ReplayBasisManifestRecord` | One immutable prepublication replay/rebuild input-and-influence manifest that expressly excludes the same attempt's outputs, candidate, Publication Manifest, publication decision, audit completion, and health completion |
| `ReplayManifestRecord` | One immutable complete replay/rebuild influence-and-output manifest, independently identified from the replay attempt and never overloaded into an analysis plan |
| `ExternalEffectIntentRecord` | Exact proposed externally observable effect and idempotency identity recorded before the effect where applicable |
| `ExternalEffectReconciliationRecord` | Evidence deciding whether an uncertain effect occurred before any retry or compensation |
| `InvalidationDecisionRecord` | One append-only invalidation-workflow state revision, preserving the observation phase, later exact binding, changed dependencies, affected closure, unknown frontier, broadening, and operational disposition |
| `RecomputationPlanRecord` | Exact reused, revalidated, recomputed, blocked, new, removed, conflicting, and unresolved populations |
| `CacheEntryDescriptorRecord` | One immutable cache value descriptor bound exactly once when a lifecycle first reaches `CANDIDATE`, whether from construction or descriptorless uncertainty containment, including cache kind, complete key digest, value manifest, dependency manifest, partition, creation basis, and integrity state |
| `CacheDecisionRecord` | One append-only lookup, state, or transition decision with exact key, optional lifecycle identity where one exists, hit, miss, stale, rejected, quarantined, or evicted outcome, reason, and provenance |
| `PublicationCandidateLifecycleRecord` | One pre-seal-through-terminal candidate-control lineage keyed independently from sealed content, binding exact security partition, channel, candidate subject, append-only predicate/state revisions, and an optional `publicationCandidateId` only after seal |
| `PublicationCandidateRecord` | Sealed complete immutable member/dependency/limitation manifest, subject, validation-input basis, canonical aggregates, and content-bound candidate digest; never contains later eligibility/decision state, exists before seal, or becomes current by itself |
| `PublicationDecisionRecord` | One authoritative finalized publication decision identified by `publicationCommitId`, binding candidate lifecycle, sealed candidate, publication channel, expected predecessor/generation, decision, resulting generation where applicable, authorization, and recovery evidence; intent or outcome uncertainty alone creates no such record or identity |
| `ReadViewLifecycleRecord` | One requested-through-terminal acquisition attempt with append-only state revisions; exact lifecycle identity always exists while a type-specific acquired-view identity is absent unless acquisition succeeds |
| `ContentReadViewRecord` | One immutable acquired content publication vector, authorization, policy, query/continuation projection, cutoff, and expiry bound to `readViewId` and its exact read-view lifecycle |
| `RawMaterialReadViewRecord` | One immutable acquired non-publication raw-material vector, authorization, policy, cutoff, expiry, and transfer boundary bound to `rawMaterialReadViewId` and its exact read-view lifecycle |
| `BackupSetRecord` | Immutable backup set and manifest binding one exact consistency boundary, complete included/excluded inventory, per-item and aggregate digests, profile/format/contract/migration/encryption/policy/lineage basis, verification, and limitations |
| `RestoreExecutionRecord` | One isolated restore, validation, later-action reconciliation, and prospective activation attempt with exact source backup, target, outcome, failure, rollback, and residual-loss evidence; every retry is distinct |
| `RetentionActionRecord` | Exact policy, hold evaluation, authority, action kind, target manifest, execution, and verification |
| `TombstoneRecord` | Safe retained identity and deletion/erasure evidence after payload removal; never semantic correction |
| `MigrationExecutionRecord` | One physical-format migration attempt whose exact immutable source/target profile pair is fixed at `PROPOSED`, with later transforms, checkpoints, verification, loss, and rollback basis |
| `MigrationCutoverRecord` | One atomic logical source-to-target routing change or a later separately recorded rollback cutover |
| `CapacityAdmissionRecord` | Budget, workload, priority/fairness class, admission decision, and resource rationale |
| `ProjectionBuildRecord` | Rebuildable index/projection basis, source watermark, transform, integrity result, and currentness limitations |

`PublicationCandidateLifecycleRecord`, `PublicationCandidateRecord`, and `PublicationDecisionRecord` are deliberately distinct. The lifecycle record exists before content seal and never anticipates a content-derived identifier. The content record is minted only when exact members, aggregates, candidate subject, and digest finalize at seal. The decision record binds both identities after seal. The historical `JAN-CSAA-007@0.1.0` Publication Manifest combined logical eligibility and published/refused presentation fields; within the finite-W3 semantic baseline, exact `JAN-CSAA-007@1.0.0` supplies the affected noncircular lifecycle/candidate/decision candidate representation and preserves the legacy Manifest only as a postdecision completed projection. No executable schema or implementation is conferred.

A fresh opaque `candidateLifecycleId` identifies one candidate-control lineage from `ABSENT` through terminal state. A bare `publicationCandidateId` identifies immutable sealed candidate content and may be reused only as that same content identity; it is absent before the `ASSEMBLING` to `SEALED` transition. Candidate lifecycle state is keyed by the exact tuple `(securityPartitionId, publicationChannelId, candidateLifecycleId)`. At seal the lifecycle binds exactly one content-derived `publicationCandidateId` and never rebinds it. The same sealed content used in two channels or two independently initiated assemblies has non-aliasing lifecycle identities and publication decisions.

`ReadViewLifecycleRecord`, `ContentReadViewRecord`, and `RawMaterialReadViewRecord` remain distinct. A fresh `readViewLifecycleId` exists at `REQUESTED` and keys every state revision, including cancellation or unavailability before acquisition. Only the `REQUESTED` to `ACQUIRED` transition mints exactly one type-appropriate `readViewId` or `rawMaterialReadViewId` and binds its immutable vector. Shared lifecycle vocabulary permits common machinery but does not merge lifecycle identity, typed acquired identity, acquisition predicates, material vectors, or authorized effects.

`BackupSetRecord` and `RestoreExecutionRecord` are also deliberately distinct. A generic recovery epoch, external-effect record, migration record, or audit event may compose with either role but cannot replace, merge, or erase the independently addressable immutable backup-set meaning or the per-attempt restore-execution meaning.

`IntegrityIncidentRecord`, `RepairExecutionRecord`, `ReplayBasisManifestRecord`, and `ReplayManifestRecord` are independently addressable technical records. The prepublication replay-basis record contains only finalized inputs/influences and is the only replay manifest permitted in the candidate subject; the output-complete replay record is created later and may reference the sealed candidate without being referenced by that same candidate. Audit events correlate and evidence these actions but cannot own or replace their technical state. A work unit, projection build, recovery epoch, generic external effect, or `AnalysisPlanRecord` may reference these roles but cannot erase the incident lineage, authorized repair execution, or either immutable replay-manifest identity.

### 7.2 Closed coordination-record lifecycle transitions

The names below are operational state semantics, not additions to the 007 operation-response union. Each allowed edge appends the exact machine-owned record's new state revision and a separate causal audit event, advances a monotonic state revision, verifies the stated guard, and preserves the prior state. It does not append or overload the 007 `OperationTransitionRecord` unless the same event is also an exact 007 operation-response transition. An edge not listed for that machine is prohibited. Terminal states may be followed only by a new machine identity.
| Machine | From | Allowed target | Guard and effect |
| --- | --- | --- | --- |
| Work unit | `PLANNED` | `BLOCKED` | A required dependency is nonpass, unavailable, or unresolved |
| Work unit | `PLANNED` | `READY` | Every required dependency and admission prerequisite passes |
| Work unit | `PLANNED` | `CANCELLED` | Authorized cancellation closes unstarted work before dependency or admission assessment |
| Work unit | `BLOCKED` | `READY` | A new exact dependency assessment closes every blocker |
| Work unit | `BLOCKED` | `FAILED` | Authoritative required-dependency or admission evidence establishes terminal nonpass with no authorized retry path |
| Work unit | `BLOCKED` | `CANCELLED` | Authorized cancellation closes unstarted work |
| Work unit | `READY` | `CLAIMED` | A current fenced claim is durably recorded |
| Work unit | `READY` | `BLOCKED` | A new exact dependency or admission assessment becomes nonpass before claim |
| Work unit | `READY` | `CANCELLED` | Authorized cancellation wins before claim |
| Work unit | `CLAIMED` | `RUNNING` | Claim holder starts one distinct attempt |
| Work unit | `CLAIMED` | `READY` | Expired/revoked claim is reconciled with no uncertain effect |
| Work unit | `CLAIMED` | `CANCELLED` | Authorized cancellation wins before run start and claim release/revocation is durably reconciled |
| Work unit | `RUNNING` | `SUCCEEDED` | Required output and terminal evidence close |
| Work unit | `RUNNING` | `FAILED` | Terminal failure or retry exhaustion closes |
| Work unit | `RUNNING` | `CANCELLED` | Effective cancellation and cleanup close |
| Work unit | `RUNNING` | `WAITING_RETRY` | Retryable failure, budget, deadline, and idempotency checks pass |
| Work unit | `RUNNING` | `OUTCOME_UNKNOWN` | An internal or external effect cannot yet be established |
| Work unit | `WAITING_RETRY` | `READY` | Authorized retry schedule opens a new attempt |
| Work unit | `WAITING_RETRY` | `FAILED` | Retry, deadline, resource, attempt, or required-dependency bound becomes terminal before a new admission opens |
| Work unit | `WAITING_RETRY` | `CANCELLED` | Authorized cancellation wins during backoff without asserting a new retry admission |
| Work unit | `OUTCOME_UNKNOWN` | `SUCCEEDED\|FAILED\|WAITING_RETRY\|CANCELLED` | Authoritative effect and cancellation/cleanup reconciliation determines the actual branch |
| Attempt | `CREATED` | `RUNNING` | Exact claim, inputs, authority, and intent are durable |
| Attempt | `CREATED` | `FAILED\|CANCELLED` | Authoritative pre-start guard failure, claim loss, or cancellation closes the unstarted attempt |
| Attempt | `RUNNING` | `SUCCEEDED\|FAILED\|CANCELLED\|OUTCOME_UNKNOWN` | Actual attempt outcome or uncertainty is durably observed |
| Attempt | `OUTCOME_UNKNOWN` | `SUCCEEDED\|FAILED\|CANCELLED` | Authoritative effect and cancellation/cleanup reconciliation closes the attempt; retry uses a new attempt identity |
| Claim | `ABSENT` | `ACTIVE` | The fresh `claimId` atomically binds `expectedWorkStateRevision`, initial `claimRevision`, and fencing token |
| Claim | `ACTIVE` | `ACTIVE` | Renewal advances `claimRevision` under the same current fencing owner without changing `expectedWorkStateRevision`; a changed work-state guard requires a new claim |
| Claim | `ACTIVE` | `RELEASED\|EXPIRED\|REVOKED` | Release, liveness expiry, or newer fencing decision is observed |
| Recovery epoch | `DISCOVERING` | `RECONCILING\|FAILED` | Durable inventory closes or discovery itself fails |
| Recovery epoch | `RECONCILING` | `APPLYING\|VERIFIED\|FAILED` | Every uncertain item receives a planned action, needs none, or blocks |
| Recovery epoch | `APPLYING` | `VERIFIED\|FAILED` | Actions and residual state are checked |
| Recovery epoch | `VERIFIED` | `CLOSED` | Recovery audit and readiness consequences are durable |
| Checkpoint | `PROPOSED` | `VERIFIED\|REJECTED` | Exact barrier evidence validates or fails |
| Checkpoint | `VERIFIED` | `DURABLE\|REJECTED` | Declared durability commitment is acknowledged or disproven |
| Retention action | `PROPOSED` | `AUTHORIZED\|REFUSED` | Policy, holds, authority, target, and expected state close |
| Retention action | `AUTHORIZED` | `EXECUTING\|CANCELLED` | Irreversible boundary starts or valid pre-action cancellation wins |
| Retention action | `EXECUTING` | `VERIFIED\|FAILED\|OUTCOME_UNKNOWN` | Post-action observation establishes or cannot establish effect |
| Retention action | `OUTCOME_UNKNOWN` | `VERIFIED\|FAILED` | Every physical surface is authoritatively reconciled |
| Retention action | `VERIFIED` | `CLOSED` | Residual copies, tombstone/unavailability evidence, and audit close |

### 7.3 Closed operational identities

Exact `JAN-CSAA-007@1.0.0` supplies a candidate representation that preserves every identity below independently, even where its wire shape composes several identities in one record. The registry has 37 rows naming 40 independently preserved identities: `claimId`, `claimRevision`, and `claimTokenDigest` remain distinct, `expectedWorkStateRevision` is a separate immutable acquisition guard, `cacheEntryId` and `cacheKeyDigest` remain distinct, and `expectedRoutingGeneration` and `routingGeneration` remain distinct; companion-row presentation does not merge any pair. Executable serialization and accepted instances remain absent:
| Identity | Required scope |
| --- | --- |
| `operationalProfileInstantiationId` | One immutable definition-to-implementation/configuration/deployment/security/provider/storage/migration binding; any changed binding receives a successor identity |
| `operationExecutionId` | One execution of one exact request; distinct from request identity and every retry attempt |
| `workUnitId` | One bounded schedulable unit inside one exact operation and plan |
| `attemptId` | Unique for every retry, restart, repair, recovery, or reconciliation attempt |
| `recoveryEpochId` | Unique for every startup or explicit recovery pass |
| `checkpointId` | One exact operation/work-unit/attempt/barrier/fault-boundary commitment, invariant across its checkpoint-state revisions and new for every new checkpoint lifecycle |
| `integrityIncidentId` | One detected integrity/corruption-condition lineage and its append-only assessments, affected/blast-radius population, containment, closure, and residual-loss state; a distinct incident never aliases it |
| `repairExecutionId` | One exact authorized repair or authoritative-material rebuild action against one incident; a separately authorized repair, restart, or disaster-recovery action receives a new identity while internal attempts remain separately identified |
| `replayBasisManifestId` | One immutable prepublication input-and-influence manifest for an exact replay or rebuild, excluding that attempt's own outputs, candidate, Publication Manifest, publication decision, audit completion, and health completion |
| `replayManifestId` | One immutable post-output completion manifest for an exact replay or rebuild, binding its `replayBasisManifestId`, attempt, exact outputs, and resulting candidate/manifest observations without becoming that candidate's basis |
| `claimId` | Fresh opaque identity minted only by a successful `ABSENT` to `ACTIVE` acquisition and preserved through terminal claim state; absent from the conceptual prestate and never reused for reassignment or a later claim |
| `expectedWorkStateRevision` | Exact work-unit state revision observed as the compare-and-claim guard and, only on successful acquisition, bound immutably to the new claim; never advanced by renewal |
| `claimRevision` and `claimTokenDigest` | Monotonic claim-lifecycle/state revision plus opaque fencing identity; both remain distinct from the expected work-state guard |
| `requestIdempotencyKey` | Operation/version, exact request semantic digest, caller/security scope, target channel or subject, declared lifetime, and replayable response class |
| `effectIdempotencyKey` | Effect kind, exact subject, operation, work unit, security scope, target system, and intended payload digest |
| `publicationIdempotencyKey` | One channel, candidate lifecycle, sealed candidate, expected predecessor/generation, authorization, and publication-intent digest; never reused for another lifecycle or rebased candidate |
| `candidateLifecycleId` | Fresh opaque identity for one pre-seal-through-terminal candidate-control lineage; stable across its state revisions and permanently bound to at most one sealed `publicationCandidateId` |
| `publicationCandidateId` | Content-bound sealed-candidate identity minted only at seal, independent from channel and current generation; absent before seal and never sufficient alone as lifecycle identity |
| `candidateSubjectKey` | Exact immutable static/evidence/configuration/method basis represented by P06–P09 |
| `publicationChannelId` | Stable P03–P05 logical current-binding channel, excluding candidate snapshot, evidence revision, request, migration epoch, and generation |
| `expectedPublicationGeneration` | Mutable compare-and-publish guard observed before one decision; never a stable partition component |
| `publicationGeneration` | Monotonic committed current-binding generation inside one stable channel |
| `publicationCommitId` | One immutable identity minted only when an authoritative `PublicationDecisionRecord` finalizes against one exact channel, candidate lifecycle, sealed candidate, predecessor, and expected generation; absent from intent, `COMMITTING`, and `COMMIT_OUTCOME_UNKNOWN` without a proven decision |
| `readViewLifecycleId` | Fresh opaque identity for one requested-through-terminal content or raw acquisition attempt, present even when cancellation or unavailability prevents acquisition |
| `readViewId` | One immutable acquired publication vector, authorization decision, policy set, query projection, and cutoff, minted only when its content-read lifecycle reaches `ACQUIRED` |
| `rawMaterialReadViewId` | One immutable non-publication-bound raw-material vector binding exact material identity/digest/type/owner/basis/provenance, authorization, policy, retention, redaction, integrity, availability, cutoff, and expiry, minted only when its raw-read lifecycle reaches `ACQUIRED` |
| `publicationVectorDigest` | Canonical ordered static and execution-lane commit/channel/generation bindings acquired at one cutoff |
| `invalidationWorkflowId` | Fresh opaque lifecycle identity allocated at `OBSERVED` for one exact observation scope and cutoff; exact dependency, prior result/population, and subject bindings are absent until `BOUND`, then immutable; repeated or concurrent observations remain distinct |
| `cacheEntryId` and `cacheKeyDigest` | Fresh opaque lifecycle identity allocated only when exact-key construction or uncertainty containment starts, plus the complete P06–P11 reuse projection; a bare exact-key miss has no cache-entry identity |
| `securityPartitionId` | Stable P01–P02 isolation and information-control boundary |
| `operationKey` | Complete P10 operation/request/query/budget/continuation projection |
| `backupSetId` | One immutable backup-set manifest at one exact consistency boundary, inventory, digest, profile/format/contract/migration/encryption/policy/lineage basis, verification state, and limitations |
| `restoreExecutionId` | Unique for every isolated restore, validation, later-action reconciliation, and prospective activation attempt; retries, restarts, repairs, and disaster-recovery tests never reuse it |
| `migrationExecutionId` | Fresh opaque identity allocated at `PROPOSED` for one exact immutable source/target profile pair; any pair change creates a new migration execution |
| `expectedRoutingGeneration` and `routingGeneration` | Distinct compare-and-cutover guard and committed generation inside one stable topology-neutral `(securityPartitionId, logical service/partition, traffic class)` routing scope; both remain distinct from publication generation unless an exact owner-approved contract proves one atomically governed counter |
| `retentionActionId` | One physical retention, deletion, archival, redaction, or erasure attempt |
| `tombstoneId` | One safe retained deletion/erasure/unavailability evidence identity |

### 7.4 Closed self-excluding content-identifier preimages

Every content-bound identifier uses an exact owner-approved digest profile, domain label, schema/contract version, and canonical representation. The identifier field under construction is absent from—not blanked, zeroed, provisionally populated, or later backfilled into—its own preimage. Referenced content-bound records must already be finalized, and the directed preimage-reference graph must be acyclic.
| Identifier | Canonical self-excluding preimage | Mandatory exclusions |
| --- | --- | --- |
| `publicationCandidateId` | Domain `JAN-CSAA-PUBLICATION-CANDIDATE`; exact Publication Candidate schema/contract version; canonical sealed candidate subject, immutable member/dependency manifests that are finalized independently from the Publication Manifest, aggregate digests, provenance, limitations, and other candidate-content-owned fields | The `publicationCandidateId` field itself; `candidateLifecycleId`; Publication Manifest identity and record; publication channel, predicate/state revisions, eligibility/decision/current-binding fields; response, audit-completion, health-completion, and every later output-complete `replayManifestId` |
| `replayBasisManifestId` | Domain `JAN-CSAA-REPLAY-BASIS`; exact Replay Basis Manifest schema/contract version; canonical operation/work-unit/attempt binding and every already-finalized input, influence, environment, profile, policy, provider/method, omission, and allowed-difference field | The `replayBasisManifestId` field itself; the same attempt's outputs or output-derived observations; candidate lifecycle/content, Publication Manifest, decision, response, audit-completion, health-completion, and output-complete replay-manifest fields |
| `replayManifestId` | Domain `JAN-CSAA-REPLAY-COMPLETION`; exact Replay Manifest schema/contract version; canonical `replayBasisManifestId`, attempt, actual outcomes, finalized output identities/digests, resulting candidate/manifest observations, and only already-finalized audit/health observation identities whose own preimages do not depend directly or transitively on this replay manifest | The `replayManifestId` field itself; any same-output candidate, Publication Manifest, output, audit event, or health observation that directly or transitively includes or depends on this `replayManifestId`; every later correlating response, audit-completion, or health-completion field |

A byte-identical canonical preimage under the same exact digest profile and purpose domain produces the same content identifier. Any unequal canonical preimage, digest profile, purpose domain, schema/contract version, or identity-bearing exclusion treatment produces a distinct identity or an explicit collision/integrity failure. A lifecycle record may bind a finalized content identifier only through its registered transition and cannot rewrite a prior revision to make that identifier appear to have existed earlier.

The operation-facing concurrency token already defined by 007 remains the public primitive. A future shape may bind it to internal claims and generations, but this design does not create an incompatible second client-visible token model.

The same idempotency key with a different governed payload projection, caller/security scope, target, or operation version is a collision and refuses both reinterpretation and effect replay. A matching request key may replay only the exact retained response class or expose its still-running/terminal target. A matching publication key may replay only the authoritative decision for the same candidate and guard. Expired response retention does not grant permission to repeat an uncertain effect; reconciliation remains mandatory.

### 7.5 Closed operational material-class registry
| Class | Material | Persistence semantics | Minimum retention relation |
| --- | --- | --- | --- |
| `M01` | Controlled definition reference | Exact external definition identity and digest; never copied as mutable truth | Retain while any dependent publication or required audit remains retained |
| `M02` | Subject and configuration manifest | Immutable exact analyzed perimeter and context | Retain with every dependent publication |
| `M03` | Raw provider or execution artifact | Immutable or content-addressed sensitive evidence | Policy-bound; deletion preserves recorded unavailability and lineage |
| `M04` | Normalized semantic or graph record | Immutable finalized record | Retain under publication, history, and policy roots |
| `M05` | Execution evidence-set record | Append-oriented immutable revision | Retain independently from static snapshot under policy |
| `M06` | Finding, treatment, exception-reference, and disposition-reference history | Append-oriented technical history with external authority references | Never rewritten by physical compaction |
| `M07` | Analysis plan and dependency closure | Immutable plan for one subject and capability set | Retain for reconstructability and active recovery |
| `M08` | Operation, run, invocation, and attempt observation | Immutable attempt-grain evidence | Every retry remains distinct |
| `M09` | Checkpoint and work-claim observation | Coordination evidence bound to exact attempt and generation | Retain through terminal reconciliation plus policy |
| `M10` | Candidate record-set partition | Immutable once sealed; non-current before publication | Retain until published, refused, quarantined, or safely collected |
| `M11` | Publication manifest | Finalized immutable closure and eligibility record | Retain while referenced historically or currently |
| `M12` | Current binding | Atomically versioned control state for one stable channel; value changes only by fenced decision | Every change produces an immutable Publication Decision and monotonic generation |
| `M13` | Invalidation and freshness observation | Append-oriented cause, closure, and currentness evidence | Retain with affected results and audit requirements |
| `M14` | Cache entry or derived index | Rebuildable derivative with exact basis | Never retained longer or less restrictively than its basis |
| `M15` | Compatibility and physical-migration material | Immutable plan/result/checkpoint/reconciliation evidence | Retain across rollback window and historical compatibility needs |
| `M16` | Access decision, redaction manifest, and audit event | Immutable security and operational evidence | Protected and retained under its own policy |
| `M17` | Backup manifest and restore observation | Immutable consistency, inventory, integrity, and activation evidence | Retain under backup and audit policy |
| `M18` | Deletion, garbage-collection, repair, and residual-loss observation | Immutable proof of physical operational action | Retain long enough to reconstruct the action without restoring protected payload |

### 7.6 Durability commitments

Every operational profile declares a durability commitment separately for acceptance, coordination, raw capture, normalized material, candidate material, publication state, audit, recovery, migration, and retention actions. The allowed commitment labels are semantic, not storage technologies:

| Commitment | Required behavior |
| --- | --- |
| `ephemeral` | Loss on interruption is permitted and explicitly reported; the work cannot produce or alter a durable current publication |
| `recoverable` | Declared checkpoints and immutable completed material survive the stated fault boundary; restart resumes or safely replays from a verified boundary |
| `durable` | Acknowledged state and material survive every declared in-scope fault under the profile's recovery objectives |

An operation capable of changing a current binding must durably record its exact request, authorization decision, `candidateLifecycleId`, sealed `publicationCandidateId`, expected predecessor, idempotency identity, and publication intent before it can acknowledge a commit attempt. An operation may use ephemeral intermediate computation, but loss of that computation produces an explicit retry/rebuild path rather than a fabricated completion.

Write acknowledgment means only that the profile's declared durability predicate is met. It does not establish semantic validation, publication, replication, backup, or conformance unless those are independently recorded.

### 7.7 Abstract durability barriers
| Barrier | Boundary | Required durable fact |
| --- | --- | --- |
| `D0` | Before acceptance | No accepted operation exists |
| `D1` | Before reporting accepted | Request, authority, subject, budget, partition, operation-execution identity, and idempotency identity |
| `D2` | Before an externally observable effect | Work attempt, claim/fencing generation, effect intent, expected prior state, and idempotency identity |
| `D3` | After acknowledged raw capture | Exact bytes/digest, invocation, attempt, subject, information control, and capture result |
| `D4` | After candidate seal | Candidate lifecycle identity, complete member manifest, dependency/cutoff, canonical aggregate digests, and newly bound content-derived candidate identity |
| `D5` | At atomic publication | Publication decision, expected predecessor/generation, candidate binding, resulting generation, and commit fact |
| `D6` | After commit and before response/audit completion | Enough durable evidence to reconstruct response and audit without republishing |
| `D7` | Before irreversible migration/retention action | Authority, policy, exact target, expected state, backup/recovery or rollback basis, and action identity |

Every operational profile binds the sixteen recovery coordinates to these barriers or to a stricter declared barrier set. A topology may add barriers; it cannot weaken the observable recovery result. A `PROPOSED` checkpoint describes the expected barrier and proposed evidence without claiming completion. A `REJECTED` checkpoint preserves noncompletion. Only a `VERIFIED` or `DURABLE` checkpoint revision may state that exact barrier evidence validated, and only `DURABLE` may state that the declared durability commitment was acknowledged. A checkpoint is not a free-form progress marker.

### 7.8 Immutable-write admission

Before immutable material becomes admissible, the realization verifies:

1. exact contract and semantic-owner version;
2. identity projection and digest profile;
3. canonical bytes or registered equivalence representation;
4. subject, project, provider, method, run, invocation, and attempt provenance;
5. information-control binding and authorized write purpose;
6. finalization and content-bound reference ordering;
7. collection key and collision behavior;
8. required validation stages;
9. resource and size bounds; and
10. absence of a conflicting record under the same supposedly immutable identity.

An equal identity with unequal governed bytes or unequal identity-bearing metadata is a critical collision. The new material is quarantined, the existing material is not overwritten, dependent publication is refused, and an integrity/security event is recorded.

## 8. Atomic candidate publication

### 8.1 Candidate-publication state machine
| State | Meaning | Only permitted next action |
| --- | --- | --- |
| `ABSENT` | A fresh candidate lifecycle exists but no assembly material or content-derived candidate identity exists | Begin authorized assembly under the exact subject and operation |
| `ASSEMBLING` | Immutable partitions may be produced but the closure is open and `publicationCandidateId` remains absent | Add only exact operation-owned material |
| `SEALED` | Record populations, counts, canonical aggregate digests, dependencies, inputs, Publication Manifest, and content-derived `publicationCandidateId` are fixed | Run complete publication validation |
| `INELIGIBLE` | At least one applicable predicate is `FAIL` or `UNKNOWN`, or one non-applicable result is not exact, source-owned, and reasoned | Refuse, retain diagnostics, and route rebuild or correction |
| `ELIGIBLE` | Every applicable publication predicate is `PASS` and every non-applicable result is exact, source-owned, and reasoned for one predecessor expectation | Attempt fenced publication |
| `COMMITTING` | A durable publication intent exists and the commit attempt is in progress | Observe the authoritative result; never infer it from response delivery |
| `COMMIT_OUTCOME_UNKNOWN` | The commit attempt returned without authoritative proof of either pre-commit failure or committed successor | Block binding-dependent service and reconcile; never blind-retry |
| `PUBLISHED` | One exact atomic current-binding transition succeeded | Serve through exact read views and retain predecessor history |
| `SUPERSEDED` | A later exact publication replaced this one in the same stable publication channel | Remain immutable and historical |
| `REFUSED` | Publication was intentionally denied before current selection | Retain safe evidence under policy |
| `ABANDONED` | No authorized actor will continue the candidate | Collect only after roots, grace, holds, and races are closed |
| `QUARANTINED` | Integrity, provenance, authorization, or collision concern prevents use | Exclude from publication and authorized ordinary reads |

The state names are design semantics carried by exact `JAN-CSAA-007@1.0.0` candidate publication-control representations. They do not extend the closed `JAN-CSAA-007` Operation Response state union. An operation response maps its actual outcome to the existing 007 state while the distinct candidate publication-control representation carries these operational states. No executable wire contract is enforced.

The transition relation is closed:
| From | Allowed target | Guard and effect |
| --- | --- | --- |
| `ABSENT` | `ASSEMBLING` | Authorized assembly starts under the already fixed `(securityPartitionId, publicationChannelId, candidateLifecycleId)` and exact candidate-subject identity; no content-derived candidate ID exists |
| `ABSENT` | `ABANDONED\|REFUSED\|QUARANTINED` | Before assembly, authorized discontinuation, exact policy/authorization denial, or integrity/provenance/collision concern closes the persisted lifecycle without creating `publicationCandidateId` or `publicationCommitId` |
| `ASSEMBLING` | `SEALED` | Complete immutable member/dependency manifests and aggregate digests close, then exactly one content-derived `publicationCandidateId` and Publication Manifest bind permanently to the lifecycle |
| `ASSEMBLING` | `ABANDONED` | Authorized stop occurs before seal with no uncertain effect |
| `ASSEMBLING` | `QUARANTINED` | Integrity, provenance, authorization, or collision concern appears |
| `SEALED` | `ELIGIBLE` | Every applicable PUB-P01 through PUB-P16 predicate is `PASS` at one cutoff and every non-applicable result is exact, source-owned, and reasoned |
| `SEALED` | `INELIGIBLE` | At least one mandatory predicate is nonpass |
| `SEALED` | `QUARANTINED` | Integrity/security concern requires isolation |
| `INELIGIBLE` | `REFUSED\|ABANDONED\|QUARANTINED` | Terminal disposition records diagnostics; correction uses a new candidate lifecycle identity |
| `ELIGIBLE` | `COMMITTING` | Durable intent, current guard, authorization, fencing, and publication idempotency close |
| `ELIGIBLE` | `INELIGIBLE` | A required predicate becomes nonpass before the linearization point |
| `ELIGIBLE` | `REFUSED\|ABANDONED\|QUARANTINED` | Authorized pre-commit disposition records exact cause |
| `COMMITTING` | `PUBLISHED` | Authoritative current binding proves the exact successor commit |
| `COMMITTING` | `COMMIT_OUTCOME_UNKNOWN` | Neither commit nor pre-commit failure can be established |
| `COMMITTING` | `ELIGIBLE` | Authoritative evidence proves no commit, the same guard, every applicable predicate still `PASS`, and every non-applicable result remains exact/source-owned/reasoned |
| `COMMITTING` | `REFUSED\|QUARANTINED` | Authoritative evidence proves no commit and a terminal conflict or defect |
| `COMMIT_OUTCOME_UNKNOWN` | `PUBLISHED` | Authoritative binding reconciliation proves the exact commit |
| `COMMIT_OUTCOME_UNKNOWN` | `ELIGIBLE` | Reconciliation proves no commit, the original guard, every applicable predicate `PASS`, and every non-applicable result exact/source-owned/reasoned |
| `COMMIT_OUTCOME_UNKNOWN` | `REFUSED\|QUARANTINED` | Reconciliation proves no commit and a terminal conflict or defect |
| `PUBLISHED` | `SUPERSEDED` | A later committed successor advances the same stable channel generation |

`SUPERSEDED`, `REFUSED`, `ABANDONED`, and `QUARANTINED` are terminal for that candidate lifecycle. Every listed edge appends a transition and monotonic state revision keyed by `(securityPartitionId, publicationChannelId, candidateLifecycleId)`; an unlisted edge is invalid. A persisted `ABSENT` lifecycle that cannot begin assembly closes through its registered terminal edge and cannot remain an orphan or invent candidate content. Rebuild, correction, rebase, or quarantine release creates a new lifecycle identity and preserves the old terminal history. `publicationCandidateId` is absent in `ABSENT` and `ASSEMBLING`, is minted only by the sealing edge, and is then immutable.

`publicationCommitId` is not a commit-intent, attempt, lifecycle-state, or outcome-unknown identity. It remains absent until an authoritative `PublicationDecisionRecord` finalizes. A durable intent, entry to `COMMITTING`, provider/storage acknowledgment, response, timeout, or `COMMIT_OUTCOME_UNKNOWN` state cannot anticipate it. Recovery either proves the exact decision and its immutable identity, proves no decision and follows the registered no-commit transition, or preserves the identity as absent while the outcome remains unknown.

### 8.2 Closed publication-predicate registry
| Predicate | Mandatory condition |
| --- | --- |
| `PUB-P01` | Exact static subject identity is resolved and unchanged across the declared acquisition boundary |
| `PUB-P02` | Every execution-evidence candidate binds the exact new evidence-set identity and revision, source-owned `staticSemanticSnapshotIdentityRef`, observation cutoff, and already-committed upstream-lane references while excluding its own future publication decision and publication generation; every read projection binds each included lane through its exact committed publication coordinates |
| `PUB-P03` | Every mandatory family for the declared publication class is complete; policy-permitted missing or unsupported regions are explicit in closure/limitation manifests and excluded from completeness claims |
| `PUB-P04` | Every record and collection validates under the exact contract package and generated-derivative identities |
| `PUB-P05` | Every content-bound reference resolves to an already-finalized digest-valid target without a prohibited cycle |
| `PUB-P06` | Counts, canonical aggregate digests, partition manifests, and the Publication Manifest agree |
| `PUB-P07` | Coverage, execution, freshness, health, conflict, partiality, unsupported, failure, limitation, integrity, security, qualification, and audit dimensions are independently populated and non-coerced |
| `PUB-P08` | Every applicable blocking dependency is positively resolved and equal-current; missing, unresolved, conflicting, incompatible, stale, or explicitly disqualifying observations make the candidate ineligible |
| `PUB-P09` | Authorization and information-control composition permit the exact publication and every derivative |
| `PUB-P10` | No required rule, profile, gate, oracle, provider-qualification, or authority state is fabricated or silently inferred |
| `PUB-P11` | The exact expected predecessor publication and current-binding generation still match |
| `PUB-P12` | The publisher owns a current fenced right for this stable publication channel and no stale worker can commit |
| `PUB-P13` | The publication intent, idempotency identity, candidate, predecessor, and audit correlation are durable |
| `PUB-P14` | Every clean-full, migration, integrity, security, and conformance predicate required for current publication is `PASS`; every nonpass remains visible and blocks eligibility |
| `PUB-P15` | No mixed-revision record, cross-partition leakage, unresolved collision, quarantined input, or unacknowledged corruption is included |
| `PUB-P16` | The candidate remains immutable between sealing and the linearization point |

Every predicate evaluation is exactly `PASS`, `FAIL`, `UNKNOWN`, or source-owned `NOT_APPLICABLE(reason)`. `ELIGIBLE` requires `PASS` for every applicable predicate; `FAIL` and `UNKNOWN` never satisfy eligibility. A policy-permitted partial publication may be selected only under an exact publication class whose closure manifest enumerates every missing region and whose completeness, freshness, health, capability, and downstream claims are explicitly weakened. Eligibility establishes only safe atomic selection for that exact publication class; it does not establish semantic correctness, full completeness, freshness, health, qualification, gate satisfaction, approval, or audit completeness.

### 8.3 Linearization and predecessor behavior

Publication has one logical linearization point per stable `publicationChannelId`. At that point, an observer sees either the complete predecessor current binding or the complete successor current binding. No observer can see a hybrid, a successor manifest with predecessor material, a pointer to unsealed material, or a current candidate whose eligibility is unresolved.

The publication operation is a fenced compare-and-publish over:

```text
security partition
+ stable publication channel
+ expected predecessor publication identity or explicit none
+ expected publication generation
+ candidate lifecycle identity, sealed candidate identity, candidate-subject key, Publication Manifest identity, and digest
+ publisher fencing generation
+ publication idempotency key
```

Mismatch produces a conflict/refusal outcome and no current-binding mutation. A race loser may be retained as an immutable candidate, compared, superseded, or safely collected; it is never silently rebased or published against a different predecessor.

Proven failure before the linearization point leaves the predecessor as the mechanically selected current-binding target. Proven commit makes the successor the mechanically selected target even if response delivery or reconstructable audit emission later fails. When commit outcome is uncertain, no local response may assert either target: binding-dependent service is unavailable or explicitly unknown until authoritative current-binding reconciliation proves the exact channel generation and candidate. Mechanical selection never establishes semantic freshness, eligibility for a new purpose, or correctness; those axes remain independently evaluated.

### 8.4 Publication response and audit ordering

The authoritative current binding is the commit fact. A lost client response after a successful commit does not unpublish the successor. A written response without a successful commit does not publish it. Audit completion may follow the commit only if the durable publication intent and mandatory commit fact make the missing audit deterministically reconstructable. A reconstructable post-commit audit gap degrades audit health and write readiness until reconciliation, but does not reverse proven current-binding selection; an unreconstructable audit or binding gap makes affected service explicitly unavailable or unknown.

Partial publication is permitted only as one complete atomic publication whose manifest explicitly identifies completed and missing regions and whose inherited semantics permit partiality. Publishing some physical partitions now and silently attaching the rest later is prohibited.

## 9. Snapshot-pinned reads and query consistency

### 9.1 Read-view acquisition

Every content or raw acquisition attempt begins with a fresh opaque `readViewLifecycleId` in `REQUESTED`. That identity keys all append-only state revisions even when authorization, material, cancellation, or availability prevents acquisition. No `readViewId` or `rawMaterialReadViewId` exists before `ACQUIRED`.

Every content-bearing query, page, stream, export, explanation, finding retrieval, and publication-bound raw retrieval acquires an immutable `ContentReadView` before semantic traversal. The view binds:

- exact `securityPartitionId`, `publicationChannelId`, and authorization decision;
- one committed static `PublicationDecisionRecord`, Publication Manifest, channel, and generation;
- for every included execution lane, its distinct committed publication decision, Publication Manifest, channel, generation, evidence-set revision, and observation cutoff;
- each included execution evidence set's source-owned `staticSemanticSnapshotIdentityRef`, equal to the pinned static semantic snapshot identity unless the operation is an explicitly labelled, separately authorized cross-snapshot comparison;
- one canonically ordered `publicationVectorDigest` acquired under a common observation cutoff;
- exact successful 007 compatibility decision/claim identities, directions, scopes, semantic-loss treatment, evidence, and validity for every cross-version or cross-lane combination;
- information-control and redaction policy versions;
- query/profile/population/budget identity;
- page or continuation ordering rules; and
- view expiry or explicit no-expiry rule.

Every lane must be authoritatively committed and admissible for the requested current or explicitly historical use at acquisition. A bare evidence-set revision is never a publication binding. A compatibility decision establishes declared contract/version compatibility only; it cannot substitute for equality of an execution evidence set's source-owned `staticSemanticSnapshotIdentityRef` with the pinned static snapshot or for the explicit labels and separately authorized lanes of a cross-snapshot comparison. If any required current binding is absent, unavailable, corrupt, outcome-unknown, or bound to the wrong static snapshot, content traversal does not start. Once acquired, the view never follows a newer current binding during the same logical result. A continuation token or cursor is valid only for the same exact view; expiration, retention loss, authorization change, migration incompatibility, or unavailable material produces an explicit outcome rather than rebinding.

The governed content/raw-read lifecycle is closed:
| State | Meaning | Only permitted action |
| --- | --- | --- |
| `REQUESTED` | One acquisition lifecycle exists; no typed acquired-view identity exists, no semantic material may be traversed, and no raw bytes may be transferred | Validate operation applicability, authorization, policy, requested publication lanes or raw-material binding, and cutoff |
| `ACQUIRED` | Exact committed publication vector or exact non-publication raw-material vector and protection interval are atomically fixed, and exactly one type-appropriate acquired-view identity is minted | Start or refuse authorized traversal/transfer without rebinding |
| `ACTIVE` | Traversal, page, stream, or raw-byte transfer uses only the acquired vector | Advance bounded work or continuation under the same view |
| `COMPLETED` | Declared result and continuation outcome close | Terminal; retain evidence under policy |
| `EXPIRED` | Time, retention, compatibility, or continuation protection ended | Terminal; explicit expired outcome |
| `CANCELLED` | Authorized cancellation became effective | Terminal; preserve actual partial/cleanup state |
| `UNAVAILABLE` | Required binding/material/authorization/compatibility could not be established | Terminal; no implicit fallback or analysis |

| From | Allowed target | Guard and effect |
| --- | --- | --- |
| `REQUESTED` | `ACQUIRED` | Every required publication lane or raw-material binding and guard validates at one acquisition cutoff; exactly one `readViewId` or `rawMaterialReadViewId` is minted and permanently bound to the lifecycle |
| `REQUESTED` | `UNAVAILABLE` | Any required lane, authorization, policy, compatibility, or material predicate is nonpass |
| `REQUESTED` | `CANCELLED` | Cancellation wins before acquisition |
| `ACQUIRED` | `ACTIVE` | First authorized semantic traversal or raw-byte transfer begins under the exact vector |
| `ACQUIRED` | `COMPLETED` | A valid zero-traversal result closes under exact non-vacuity semantics |
| `ACQUIRED` | `EXPIRED\|CANCELLED\|UNAVAILABLE` | Protection or authority ends before traversal |
| `ACTIVE` | `ACTIVE` | A page/stream continuation advances without changing view identity |
| `ACTIVE` | `COMPLETED\|EXPIRED\|CANCELLED\|UNAVAILABLE` | Result, protection, cancellation, or material availability closes the view |

Every edge appends a monotonic state revision keyed by the same `readViewLifecycleId`. `COMPLETED`, `EXPIRED`, `CANCELLED`, and `UNAVAILABLE` are terminal; an unlisted edge is invalid and every new acquisition attempt receives a new lifecycle identity. A lifecycle ending directly in `CANCELLED` or `UNAVAILABLE` has no typed acquired-view ID. A lifecycle reaching `ACQUIRED` retains its one immutable type-appropriate ID through every later state and continuation.

A non-publication-bound `csaa.raw.get` acquires an immutable `RawMaterialReadView`, not a `ContentReadView`. It preserves the exact 007 `RawArtifactResponseRecord` / `raw-artifact-retrieval` boundary and, only at `ACQUIRED`, binds `rawMaterialReadViewId`, exact requested raw-material identity, bytes digest, type, owner, authoritative basis, provenance, `securityPartitionId`, authorization decision, information-control/redaction/retention policy, integrity/availability observation, cutoff, and expiry. Publication channel/vector coordinates are exact when genuinely applicable and otherwise carry owner-backed `not-applicable(reason)`; none may be invented. The raw view uses the same closed lifecycle, whose revisions remain keyed by `readViewLifecycleId`, with `ACQUIRED` binding the raw-material vector rather than a publication vector. It permits only bounded authorized byte retrieval and cannot confer semantic traversal, publication currentness, freshness, health, completeness, or authority.

`csaa.health.get` may instead acquire a non-content `HealthObservationView`. It binds exact observation scope, authorization, policy, health-source identities, observation cutoff, and one binding condition: `committed-publication-vector`, `no-current-binding`, `binding-unavailable`, or `binding-corrupt`. The latter three conditions carry a source-owned reason and no traversable semantic-content reference. A subjectless/system health request may use owner-backed `not-applicable` subject and channel values exactly as 007 permits. A health view reports bootstrap, recovery, corruption, or withdrawal truthfully and cannot be used as a content-read view.

`HealthObservationView` is an immutable response/observation projection for one operation request in this design; it is not assigned a persisted lifecycle or independently addressable operational-record role. A later design that persists it, revises it, or protects work across continuations must add an exact affected-record role and identity rather than overload either read-view record.

### 9.2 Single-snapshot rule

A normal query resolves against exactly one declared semantic snapshot. A cross-snapshot comparison names and labels each exact snapshot independently and preserves distinct provenance, authorization, freshness, compatibility, and redaction treatment. A result combining static and execution evidence declares both identity lanes and never mutates a prior query result when new execution evidence arrives.

Reads are repeatable for immutable retained material under the same exact view, contract, authorization, and redaction inputs. Presentation timing, pagination, or parallel traversal may vary only within documented deterministic ordering and allowed-difference rules; semantic membership and epistemic treatment cannot vary.

### 9.3 Read/write interaction

Readers holding a valid immutable predecessor view may finish after a successor is published. New ordinary reads use the successor current binding after the linearization point. Retention, migration, or garbage collection cannot remove material needed by a valid admitted view until its declared protection interval closes or the read receives an explicit authorized cancellation/failure outcome.

No query triggers an implicit full-repository analysis. A freshness requirement that cannot be satisfied by an existing exact publication produces an explicit stale/unavailable outcome or a separately authorized analysis request; it does not silently change the query's subject.

## 10. Dependency-aware invalidation

### 10.1 Dependency observation and closure

Logical invalidation meaning remains with `JAN-CSAA-002` and `JAN-CSAA-003`. This design owns how a later realization observes those dependencies, persists changes, computes a conservative affected closure, blocks unsafe reuse, and schedules recomputation.

Every persisted or cached result carries a complete declared dependency manifest. At minimum the manifest covers the applicable categories below:
| Category | Dependency surface |
| --- | --- |
| `D01` | Repository, revision, base, candidate merge, working change set, input content, artifact classification, and perimeter |
| `D02` | Workspace, package, manifest, lockfile, dependency resolution, external component, and advisory/feed cutoff |
| `D03` | Project, variant, effective configuration, exact `operationalProfileInstantiationId`, compiler, resolver, condition set, paths, aliases, ambient context, and toolchain |
| `D04` | Framework adapter, generator, generated configuration, generated/virtual artifact, declaration output, origin mapping, and freshness |
| `D05` | Semantic-owner document, invariant, capability profile, query/slice/comparison/impact definition, and rule/profile input |
| `D06` | Schema package, generated derivative, validation registry, contract family, compatibility decision, and migration epoch |
| `D07` | Provider, adapter, analyzer, method, model, version, configuration, capability declaration, qualification, and health basis |
| `D08` | Raw provider result, normalization transform, graph composition, upstream fact, relation, index, projection, and conflict input |
| `D09` | Build configuration, execution artifact, instrumentation, source map, test selection, attempt, coverage denominator, and granularity |
| `D10` | Runtime build, environment, workload, trace schema, collector, sampling, clock, observation window, and cutoff |
| `D11` | Population, traversal, query parameters, ordering, page, budget, approximation, inference, and partial-result policy |
| `D12` | Authorization, principal, delegation, tenant, purpose, information control, redaction, retention, egress, and presentation policy |
| `D13` | Current-binding generation, predecessor publication, read view, concurrent operation, claim, fencing, and cancellation state |
| `D14` | Storage-format version, physical compatibility, migration phase, integrity state, exact `integrityIncidentId`, `repairExecutionId`, and prepublication `replayBasisManifestId` when applicable; `replayManifestId` is permitted only for a downstream derivative that is not a member of its own reported output set; corruption observation, repair, and restore generation |
| `D15` | External reference, registry, advisory source, database/feed, license or policy identity, observation cutoff, and availability |
| `D16` | Environmental influence declared material to deterministic behavior, including locale, platform, line endings, clock, randomness, and concurrency policy |
| `D17` | Upstream invalidation record, freshness assessment, unresolved frontier, conservative broadening decision, and recomputation plan |
| `D18` | Any additional exact dependency introduced by the concern-owning semantic or contract definition |

Each observed dependency receives one of:

| Observation | Operational consequence |
| --- | --- |
| `equal-current` | Reuse may proceed only if every other admission predicate passes |
| `changed` | The dependent result enters affected closure and cannot support a current claim |
| `missing` | Currentness is unknown; affected closure broadens or publication is refused |
| `unresolved` | Currentness is unknown; the unresolved frontier and attempted methods are preserved |
| `conflicting` | Every competing observation is retained; reuse and green publication are blocked until concern-owned resolution permits otherwise |
| `incompatible` | Reuse is rejected; migration, rebuild, or explicit unsupported treatment is required |
| `not-applicable` | A source-owned reason and applicability proof are retained |

Absence of an invalidation event is not evidence that dependencies remain equal. Currentness requires a positive dependency assessment under the declared currency predicate.

### 10.2 Invalidation state machine
| State | Meaning | Consequence |
| --- | --- | --- |
| `OBSERVED` | A potential dependency change or uncertainty is recorded | No reuse decision yet |
| `OBSERVATION_FAILED_UNBOUND` | The observation could not be bound safely to an exact dependency, prior result/population, and subject | Conservatively mark the complete exact observation scope non-current or unavailable; later observation uses a new workflow identity |
| `BOUND` | The observation is bound to exact dependency, prior result populations, and subject | Compute affected closure |
| `CLOSURE_PARTIAL` | Some affected edges, populations, or frontiers remain unresolved | Broaden or retain non-current state |
| `CLOSURE_COMPLETE` | The conservative affected set is closed under declared dependencies | Invalidate and plan recomputation |
| `INVALIDATED` | Every affected persisted/cache/currentness use is blocked or visibly stale | Schedule exact successor work if authorized |
| `RECOMPUTING` | One or more exact successor attempts are active | Prior result remains historical/non-current |
| `REVALIDATED` | The existing material was positively shown equal-current under an authorized method | Record the method; restore reuse eligibility only |
| `SUCCEEDED_BY_SUCCESSOR` | One exact successor publication closes the affected partition | Retain predecessor and invalidation lineage |
| `RECOMPUTATION_FAILED_NONCURRENT` | Recomputation failed, timed out, was cancelled, or remains unsupported | Remain explicitly stale/invalidated/non-green |

The invalidation transition relation is closed:
| From | Allowed target | Guard and effect |
| --- | --- | --- |
| `OBSERVED` | `BOUND\|OBSERVATION_FAILED_UNBOUND` | Bind the exact dependency, prior result/population, and subject exactly once or record terminal unbound observation failure |
| `BOUND` | `CLOSURE_PARTIAL\|CLOSURE_COMPLETE\|RECOMPUTATION_FAILED_NONCURRENT` | Compute conservative closure or retain noncurrent failure |
| `CLOSURE_PARTIAL` | `CLOSURE_PARTIAL\|CLOSURE_COMPLETE\|RECOMPUTATION_FAILED_NONCURRENT` | Append broader/refined evidence; never shrink below proven safe closure |
| `CLOSURE_COMPLETE` | `INVALIDATED\|RECOMPUTATION_FAILED_NONCURRENT` | Block every affected use before successor work |
| `INVALIDATED` | `RECOMPUTING\|REVALIDATED\|RECOMPUTATION_FAILED_NONCURRENT` | Start authorized work, prove equal-current, or retain noncurrent failure |
| `RECOMPUTING` | `SUCCEEDED_BY_SUCCESSOR\|RECOMPUTATION_FAILED_NONCURRENT` | Exact successor commit closes or failure remains noncurrent |
| `RECOMPUTATION_FAILED_NONCURRENT` | `RECOMPUTING\|REVALIDATED` | New authority/evidence starts another attempt or positively revalidates |
| `OBSERVATION_FAILED_UNBOUND\|REVALIDATED\|SUCCEEDED_BY_SUCCESSOR` | `none` — terminal | A later observation or change creates a new `invalidationWorkflowId` |

A fresh opaque `invalidationWorkflowId` is allocated when `OBSERVED` records the exact observation source, observation class, security scope, channel applicability, and assessment cutoff. The exact dependency identity, prior publication/result population, affected subject, and current-binding basis are absent until the `OBSERVED` to `BOUND` edge binds them exactly once. `OBSERVATION_FAILED_UNBOUND` preserves the failed binding attempt without inventing those fields and is terminal; because no narrower affected subject was established safely, the complete exact observation scope remains non-current or unavailable until independently sufficient later evidence starts a new workflow. Every persisted workflow state is keyed by its exact `invalidationWorkflowId`, and every transition appends its monotonic workflow-state revision. An unlisted edge is invalid. A mechanically selected current-binding target affected by invalidation may remain selected for historical retrieval, but its freshness/currentness dimension is stale, invalidated, unknown, or otherwise non-green until positive revalidation or an exact eligible successor closes it.

An invalidation never mutates an immutable semantic record. It changes admissible use through an append-oriented Invalidation Record, Freshness Assessment, operational state, or successor publication. A broad invalidation may be refined by later evidence only through a new assessment that retains why the earlier broadening was necessary.

### 10.3 Conservative broadening

The affected closure begins from every changed, missing, unresolved, conflicting, or incompatible dependency and traverses every declared semantic and operational dependency edge. When an edge, mapping, plugin behavior, dynamic seam, provider effect, or generated context is unknown, the closure broadens to the smallest demonstrably safe parent population. If that parent cannot be proven, the closure broadens to the complete declared subject/capability population.

The realization records:

- original change seeds;
- exact dependency graph/version;
- reached facts, relations, graph layers, profiles, results, evidence sets, caches, indexes, and publications;
- unknown frontiers and why traversal stopped;
- each broadening step, owner, method, and reason;
- reused versus invalidated populations;
- current-binding consequence; and
- planned full or incremental successor.

An optimization may over-invalidate. It cannot under-invalidate, suppress an unresolved dependency, infer currentness from age, or reuse a result because recomputation is expensive.

## 11. Incremental reanalysis and clean-full equivalence

### 11.1 Same-successor rule

Incremental and clean-full analyses are comparable only when both bind the same exact post-change repository snapshot, execution-evidence-set revisions, project/configuration closure, `operationalProfileInstantiationId`, contract package, semantic-owner versions, capability profiles, provider methods or approved compatibility mappings, authorization scope, observation cutoff, and deterministic influence manifest.

A wrong base, wrong successor, wrong worktree, wrong branch observation, wrong project, wrong lockfile, wrong provider method, wrong evidence set, wrong cutoff, wrong policy, or wrong migration epoch cannot be repaired by matching output hashes.

### 11.2 Reuse and recomputation manifest

Every incremental attempt produces an immutable manifest distinguishing:

| Population | Required evidence |
| --- | --- |
| `reused-exact` | Original producing run/invocation, immutable record identity, dependency equality proof, currentness, information-control compatibility, and cache admission |
| `revalidated` | Exact revalidation method, inputs, outcome, cutoff, and limitations |
| `recomputed` | New attempt/invocation, exact changed inputs, outputs, and provenance |
| `invalidated-not-recomputed` | Affected population, reason, operational consequence, and explicit partial/failed/unsupported treatment |
| `newly-discovered` | Discovery basis and proof that it did not exist in the comparable predecessor population |
| `removed` | Predecessor identity, exact removal/change basis, and successor absence semantics |
| `conflicting` | Every retained competing result, method, provenance, and routing state |
| `unresolved` | Requested dependency/result, attempted methods, observed frontier, and currentness consequence |

Reuse preserves original provenance and adds the reuse decision. It never relabels old computation as newly executed, changes its producer, discards a prior limitation, or creates a fresh observation time for the underlying fact.

### 11.3 Eight-dimensional equivalence

The clean-full comparison evaluates all eight dimensions inherited by `JAN-CSAA-003` and `JAN-CSAA-008`:
| ID | Dimension | Compared surface |
| --- | --- | --- |
| `E01` | Semantic result sets | Objects, relations, graphs, findings, query members, slices, deltas, and impact results under exact populations |
| `E02` | Epistemic state | Supported, inferred, unknown, conflicting, unsupported, partial, stale, and related concern-owned states |
| `E03` | Coverage and population closure | Included/excluded regions, denominators, completeness basis, frontiers, and blind spots |
| `E04` | Provenance and lineage | Subject, method, provider, run, invocation, raw material, normalization, mapping, and predecessor/successor references |
| `E05` | Conflict and disagreement | Every competing result and absence of silent winner selection |
| `E06` | Failure and degraded behavior | Unsupported, failed, timed-out, cancelled, resource-refused, incompatible, and partial consequences |
| `E07` | Explanations and witnesses | Paths, bases, assumptions, limitations, invalidation dependencies, and redaction consequences |
| `E08` | Ordering and declared allowed differences | Canonical order, stable tie handling, approximate/inferred tolerances, and source-owned difference policy |

Equality of counts, aggregate digests, serialized byte order, cache keys, or provider exit codes cannot replace the dimension comparison. A digest may accelerate comparison only when its exact projection is proven to cover the dimension and a mismatch still receives full diagnosis.

Every allowed difference is declared before execution by the concern-owning profile, bounded to exact fields/populations, justified semantically, and allocated to an independent oracle. An implementation cannot define a tolerated difference after seeing divergent results.

### 11.4 Mutation and evidence matrix

The later conformance realization crosses the eighteen `JAN-CSAA-006`/`JAN-CSAA-008` incremental mutation classes with all eight dimensions, producing at least `18 × 8 = 144` independently reported assessments. Supply-chain changes also preserve the sixteen stable coordinates across both synthetic and dated-JPWB lanes, or thirty-two independently reported assignments. This design defines how operational evidence is retained; it does not execute or pass any coordinate.

If clean-full execution is unavailable, unauthorized, failed, or ineligible, incremental material may remain useful as explicitly provisional or historical evidence under concern-owned rules. It cannot be represented as equivalence-proven or green.

## 12. Cache and derived-index contract

### 12.1 Cache standing

A cache or derived index is a rebuildable acceleration surface. It is never the sole semantic source, never manufactures provenance, never extends retention or access, never converts uncertainty to freshness, and never becomes current merely because a lookup succeeds.

### 12.2 Closed cache-admission predicate registry
| Predicate | Mandatory cache-hit condition |
| --- | --- |
| `CAC-P01` | Exact repository, subject, snapshot, change-set, and evidence-set identities match |
| `CAC-P02` | Exact project, compiler, resolver, framework, generated context, and configuration closure match |
| `CAC-P03` | Exact semantic-owner, contract, schema, generated-derivative, adapter, provider/method, and rule/profile versions match or an exact successful 007 compatibility decision/claim names direction, scope, evidence, loss treatment, validity, and every differing version |
| `CAC-P04` | Exact query/capability/population, ordering, approximation, inference, budget, and partial-result policy match |
| `CAC-P05` | Every declared dependency is positively equal-current at the required cutoff |
| `CAC-P06` | Original raw and normalized provenance remains resolvable or its authorized retained substitute satisfies the declared reproducibility rule |
| `CAC-P07` | Original and current capability coverage, health, partiality, unsupported, failure, conflict, and limitation states remain compatible |
| `CAC-P08` | Principal, tenant, purpose, authorization, information-control, retention, redaction, egress, and presentation policies permit reuse |
| `CAC-P09` | Cache entry integrity, basis manifest, aggregate digest, collection keys, and physical-format compatibility validate |
| `CAC-P10` | Entry state is admitted-current and not stale, invalidated, quarantined, corrupt, migration-blocked, expired-by-policy, or deletion-pending |
| `CAC-P11` | No subject mutation, TOCTOU event, current-binding race, or unresolved invalidation occurred between validation and use |
| `CAC-P12` | The cache key includes every identity-bearing coordinate and has no ambiguous default, wildcard, path-only, or branch-name-only component |
| `CAC-P13` | A successful-empty or negative entry retains closed-population, supported-execution, health, and non-vacuity evidence |
| `CAC-P14` | A cross-process or cross-node copy preserves exact bytes, integrity, information-control treatment, and basis identity |
| `CAC-P15` | Reuse is recorded as reuse and preserves original producing time, run, invocation, provider, and limitations |
| `CAC-P16` | Admission failure produces an explicit miss/stale/unavailable result; only a separately authorized analysis operation may accept recomputation under a new exact request |

`JAN-CSAA-007-EOT-P-015` defines `CompatibilityDecision` as the constrained content-bound reference to a noninvalidated `CompatibilityClaimRecord`; an inline Boolean, structural similarity, same-major version, or `CompatibilityMapRecord` by itself cannot authorize reuse. Direction is producer-to-consumer. `compatible-with-bounded-loss` is a miss unless the bounded loss is proven irrelevant to every identity, key, digest, dependency, provenance, information-control, authorization, operation/result semantic, and consumed result surface. `incompatible`, `unknown`, `not-applicable`, wrong-direction, out-of-scope, invalidated, or superseded compatibility is a miss. Any required transformation additionally binds the exact `CompatibilityMapRecord`.

### 12.3 Cache states and transitions
| State | Meaning | Treatment |
| --- | --- | --- |
| `ABSENT` | Conceptual exact-key lookup prestate; no cache-entry lifecycle exists | Miss or separately authorized construction |
| `BUILDING` | Derivative construction incomplete | Not readable as a hit |
| `CANDIDATE` | Complete bytes exist but admission not established | Validate |
| `ADMITTED_CURRENT` | Every admission predicate passes at the recorded cutoff | Serve and record reuse |
| `STALE` | A currency predicate no longer matches or cannot be established | Historical/diagnostic use only when authorized |
| `INVALIDATED` | A dependency change or operational decision blocks use | Recompute, revalidate, or evict |
| `INCOMPATIBLE` | Contract, format, method, policy, or migration state does not permit use | Migrate/rebuild or miss |
| `QUARANTINED` | Integrity, collision, provenance, or security concern exists | No ordinary use |
| `EVICTION_PENDING` | Removal authorized but protected readers or grace window remain | Do not admit new readers |
| `EVICTED` | Payload unavailable under recorded action | Miss; history of action remains |
| `UNKNOWN` | Entry state or basis cannot be established; the exact pre-UNKNOWN origin state or conceptual `ABSENT` origin and descriptor-bound flag remain preserved | Treat as miss and non-current; recovery cannot bypass origin-state restrictions |

The cache transition relation is closed:
| From | Allowed target | Guard and effect |
| --- | --- | --- |
| `ABSENT` | `BUILDING` | Separately authorized construction allocates a fresh opaque `cacheEntryId` for one exact `cacheKeyDigest`; no value descriptor is yet bound |
| `ABSENT` | `UNKNOWN` | Discovery of material or lineage with no authoritative lifecycle allocates a fresh opaque containment `cacheEntryId`; no value descriptor is admitted |
| `BUILDING` | `CANDIDATE\|QUARANTINED\|EVICTION_PENDING` | Successful completion binds one immutable `CacheEntryDescriptorRecord` to the lifecycle exactly once; integrity/security failure or authorized abandonment binds no admitted value |
| `CANDIDATE` | `ADMITTED_CURRENT\|STALE\|INVALIDATED\|INCOMPATIBLE\|QUARANTINED\|EVICTION_PENDING` | Every admission predicate and competing event determines the branch |
| `ADMITTED_CURRENT` | `STALE\|INVALIDATED\|INCOMPATIBLE\|QUARANTINED\|EVICTION_PENDING` | Currency, dependency, compatibility, integrity/security, or eviction state changes |
| `STALE` | `CANDIDATE\|INVALIDATED\|INCOMPATIBLE\|QUARANTINED\|EVICTION_PENDING` | New positive validation creates a candidate state revision or a blocking branch |
| `INVALIDATED` | `CANDIDATE\|INCOMPATIBLE\|QUARANTINED\|EVICTION_PENDING` | Only positive revalidation of the unchanged immutable derivative may return this identity to candidate; every rebuild uses a new cache-entry identity |
| `INCOMPATIBLE` | `QUARANTINED\|EVICTION_PENDING` | Unsafe material is isolated or removed; compatible rebuild uses a new entry identity |
| `QUARANTINED` | `EVICTION_PENDING` | Authorized removal begins; release requires a new entry identity |
| `EVICTION_PENDING` | `EVICTED` | Reader/grace/hold checks and physical verification close |
| `BUILDING\|CANDIDATE\|ADMITTED_CURRENT\|STALE\|INVALIDATED\|INCOMPATIBLE\|QUARANTINED\|EVICTION_PENDING` | `UNKNOWN` | Recovery or exact observation finds material or lineage whose authoritative state or basis cannot be established; the same lifecycle identity is retained, ordinary admission is blocked, and the uncertainty event is appended |
| `UNKNOWN` | `CANDIDATE\|INCOMPATIBLE\|QUARANTINED\|EVICTION_PENDING` | Authoritative basis is recovered, unsafe state is classified, or removal begins; `CANDIDATE` is permitted only for conceptual-`ABSENT`, `BUILDING`, `CANDIDATE`, `ADMITTED_CURRENT`, `STALE`, or `INVALIDATED` origins under the exact origin-specific guards below, while `INCOMPATIBLE`, `QUARANTINED`, or `EVICTION_PENDING` origins cannot return to `CANDIDATE` under that identity |
| `EVICTED` | `none` — terminal | A later rebuild receives a new cache-entry identity |

`ABSENT` is a conceptual key-scoped prestate and has no persisted cache-entry revision or `cacheEntryId`; a bare miss decision binds the exact `cacheKeyDigest` only. The `ABSENT` to `BUILDING` or `ABSENT` to `UNKNOWN` edge mints a fresh opaque lifecycle identity. Every later state revision is keyed by `(securityPartitionId, cacheKeyDigest, cacheEntryId)`. `BUILDING` and descriptorless `UNKNOWN` carry construction or containment basis but no admitted value descriptor. The first permitted transition into `CANDIDATE` from either state binds one immutable `CacheEntryDescriptorRecord` and value manifest exactly once; a later `UNKNOWN` to `CANDIDATE` on a lifecycle that already has a descriptor must prove and retain that identical descriptor.

Every `UNKNOWN` revision preserves its exact immediate pre-UNKNOWN state, the conceptual `ABSENT` origin where applicable, and whether a descriptor had already been bound. That origin is a mandatory exit guard: an `INCOMPATIBLE` origin may return only to `INCOMPATIBLE`, `QUARANTINED`, or `EVICTION_PENDING`; a `QUARANTINED` origin may return only to `QUARANTINED` or `EVICTION_PENDING`; and an `EVICTION_PENDING` origin may return only to `EVICTION_PENDING`. None may reach `CANDIDATE` under the same identity. A conceptual-`ABSENT` or `BUILDING` origin reaches `CANDIDATE` only after complete authoritative basis recovery and one-time descriptor binding. A `CANDIDATE`, `ADMITTED_CURRENT`, or `STALE` origin reaches `CANDIDATE` only with the identical descriptor and a fresh complete candidate-level validation; `ADMITTED_CURRENT` is never restored directly. An `INVALIDATED` origin reaches `CANDIDATE` only through positive revalidation of the unchanged immutable derivative. Unequal recovered material is a collision requiring quarantine or a new lifecycle, never rebinding. `EVICTED` is terminal, and every rebuild allocates a new `cacheEntryId`.

Every edge that creates or advances a cache lifecycle appends a monotonic cache-state revision; an unlisted edge is invalid. Query/read operations never convert `ABSENT`, `STALE`, `INVALIDATED`, `INCOMPATIBLE`, `QUARANTINED`, `EVICTED`, or `UNKNOWN` into implicit analysis. They return the exact cache/read outcome or a distinct separately authorized analysis-acceptance response.

TTL, least-recently-used position, memory pressure, storage tier, or worker-locality may influence eviction. None establishes currentness. Cache eviction changes availability and performance only; it cannot invalidate authoritative immutable records. Cache corruption cannot propagate into a publication or response because admission revalidates integrity and basis.

### 12.4 Negative and empty results

A cached empty, absence, unreachable, no-caller, no-vulnerability-observation, or no-finding result is admissible only when the original operation was supported, healthy, completed, population-closed, non-vacuous, subject-exact, current, and authorized, and when every dependency remains equal-current. A failed, unsupported, partial, stale, conflicting, timed-out, cancelled, resource-refused, unexecuted, or redacted-to-empty result is never cached as a successful negative.

## 13. Concurrency, claims, fencing, and idempotency

### 13.1 Concurrency invariants
| Invariant | Required behavior |
| --- | --- |
| `CON-01` | An immutable record identity is written at most once for one governed byte representation; equal retries deduplicate without losing attempt provenance |
| `CON-02` | A current binding changes only through fenced compare-and-publish against an exact expected generation and predecessor |
| `CON-03` | A stale writer, expired claim holder, superseded generation, or cancelled attempt cannot publish |
| `CON-04` | Readers retain one immutable view for a logical result even while writers publish successors |
| `CON-05` | Invalidation concurrent with reuse makes the reuse decision non-current unless ordering and dependency equality are proven |
| `CON-06` | Retention or garbage collection concurrent with an admitted reader preserves the reader or produces an explicit authorized termination |
| `CON-07` | Migration concurrent with reads and writes follows the declared compatibility and cutover mode; no request crosses formats implicitly |
| `CON-08` | Two writers for the same stable publication channel may compute candidates, but at most one wins one current-binding generation |
| `CON-09` | Writers for different partitions cannot share mutable state or publication authority by accidental key collision |
| `CON-10` | Duplicate request or job delivery creates a new attempt observation or deduplicated response without duplicating immutable material or external effects |
| `CON-11` | A claim conveys bounded coordination rights only; it never conveys semantic, security, provider, oracle, gate, or approval authority |
| `CON-12` | Every claim and checkpoint is bound to exact operation, attempt, partition, generation, claim/lifecycle identity, owner, acquisition, immutable expected work-state revision, independently advancing claim revision, expiry/liveness rule, and fencing identity |
| `CON-13` | Clock skew or delayed liveness cannot allow an old owner to commit after a newer fencing generation exists |
| `CON-14` | Cancellation races preserve the actual linearization order: pre-commit cancellation blocks publication, post-commit cancellation cannot rewrite it |
| `CON-15` | Authorization or policy change concurrent with a read/write is resolved at the profile-declared boundary and never widens access |
| `CON-16` | Every concurrency conflict is visible as conflict, retry, refusal, supersession, or cancellation rather than last-writer-wins data loss |

### 13.2 Idempotency identity

The closed idempotency-family registry is:
| ID | Key family | Stable scope |
| --- | --- | --- |
| `IDEM-01` | Request admission | Caller key namespace/value, operation/version, security partition, target channel/subject, and canonical request digest |
| `IDEM-02` | Work unit | Operation execution, plan/version, logical step, exact inputs/dependencies, and expected output class |
| `IDEM-03` | Provider invocation | Work unit, provider/method/version, exact input, capability grant, and intended invocation class |
| `IDEM-04` | External effect | Target domain, effect kind/version, exact subject/payload digest, security scope, and expected prior state |
| `IDEM-05` | Immutable material write | Record family, logical identity, canonical governed bytes, and digest profile |
| `IDEM-06` | Candidate seal | Candidate lifecycle, stable channel, exact candidate subject, and closure/member/dependency/limitation manifest digests |
| `IDEM-07` | Publication commit | Stable channel, candidate lifecycle, sealed candidate, expected predecessor/generation, authorization, and commit-intent version |
| `IDEM-08` | Cache build | Complete cache-key projection, transform version, and exact authoritative publication/dependency basis |
| `IDEM-09` | Migration step | Migration execution, phase, security/channel scope, source/target/checkpoint, expected routing generation, and intended effect |
| `IDEM-10` | Retention or destructive action | Policy/authority, action kind, target manifest, holds/expected state, every physical surface, and intended effect |
| `IDEM-11` | Recovery action | Underlying uncertain intent/target, decision kind, expected state, and intended effect; recovery epoch remains provenance |
| `IDEM-12` | Audit reconstruction | Causal durable-fact identity, event class/schema, and semantic safe-payload digest |

Every key includes key kind and key version. Attempt, claim owner, worker, clock, schedule, queue position, and physical location remain provenance and do not destabilize retry identity. The same key with unequal projected inputs is a conflict and, where integrity is implicated, quarantine; it is not a new request or permission to reinterpret the effect.

A key neither confers authority nor proves that an effect occurred. Uncertain effects require authoritative observation and reconciliation even when a key exists. Key/effect evidence remains retained through the maximum retry, response-loss, recovery, and uncertainty horizon. If that evidence is unavailable, the uncertain effect is not blindly repeated. Without a caller request-admission key, equal request bytes do not prove that the caller intended deduplication.

A retry retains a distinct attempt identity, reason, schedule, and raw outcome while reusing only the applicable stable key. Idempotency suppresses duplicate effects; it does not suppress evidence about duplicate delivery or failed attempts.

### 13.3 Work claims and stale workers

A work claim may be implemented by an in-memory ownership rule, file primitive, transaction, lease, queue visibility rule, scheduler token, or another later-selected mechanism. Regardless of mechanism, the profile must prove exclusive publication rights for one fencing generation, bounded liveness, renewal/expiry observation, cancellation interaction, stale-owner rejection, and crash recovery.

`ABSENT` is a conceptual work-and-guard-scoped prestate, not a persisted claim lifecycle and not an `ExecutionClaimRecord`. Only a successful `ABSENT` to `ACTIVE` acquisition atomically mints a fresh `claimId`, binds the exact observed `expectedWorkStateRevision`, initializes `claimRevision`, and binds a fresh `claimTokenDigest`. Every `ACTIVE` and terminal revision is keyed by that `claimId`. A failed acquisition records its exact operation and audit outcome but creates no `claimId`, `claimRevision`, fencing token, or claim-state transition. Renewal may advance `claimRevision` while the immutable expected work-state guard remains unchanged. If that work-state revision changes or reassignment occurs, the old claim cannot silently retarget it and a new acquisition with a new identity and token is required. Neither revision substitutes for `claimTokenDigest` or its fencing meaning.

Heartbeat absence is evidence only under the declared liveness model. It cannot prove the worker performed no external effect. Recovery reconciles any uncertain effect before reassignment.

## 14. Scheduling, admission, backpressure, and cancellation

### 14.1 Topology-neutral scheduling

The scheduling model is a dependency-aware directed acyclic plan for one exact request except where a concern-owned iteration/fixpoint definition explicitly permits bounded cycles. Scheduling order may vary only when dependencies, isolation, deterministic-equivalence rules, resource budgets, and fairness remain satisfied.

Every work unit declares exact inputs, outputs, dependencies, capability/provider requirements, authorization, partition, resource budget, timeout/deadline, cancellation boundary, retry class, durability commitment, side-effect class, and publication relevance.

### 14.2 Admission and backpressure

Admission evaluates capacity before accepting work that cannot be serviced safely. It may:

- accept immediately;
- accept into a bounded queue with position class and progress semantics;
- defer under a declared fairness rule;
- reject as resource-refused, deadline-infeasible, unauthorized, incompatible, or unavailable;
- shed lower-priority work under an exact policy; or
- narrow scope only with explicit caller agreement and a new exact request identity.

Queueing, shedding, or refusal is never reported as success or empty analysis. A later owner supplies numeric budgets and priorities; this Draft supplies required dimensions and behavior.

### 14.3 Fairness and starvation

The operational profile declares the fairness population, priority classes, reservation or allocation rule, starvation bound or explicit reason why no finite bound is promised, cancellation behavior, and measurement. Repository, tenant, principal, request class, provider, or large-job load cannot silently starve another admitted class indefinitely contrary to that rule.

### 14.4 Cancellation

Cancellation is cooperative at declared boundaries and retains actual produced material. A request carries the target operation/attempt and accepted concurrency token. The implementation records request time, acknowledgment, propagation to each child/provider/process boundary, effective point, work that continued, partial/raw material, publication consequence, cleanup, external-effect uncertainty, and terminal state.

A cancellation request is not proof that work stopped. A late request after immutable publication records a separate cancellation outcome and cannot rewrite the publication. A cancelled candidate never becomes current unless publication linearized earlier; recovery determines that ordering from durable facts.

## 15. Failure, retry, degraded operation, and provider behavior

### 15.1 Failure classification
| Class | Condition | Mandatory consequence |
| --- | --- | --- |
| `OPS-F01` | Invalid or unauthorized request | No run publication; explicit refusal |
| `OPS-F02` | Insufficient or changing subject identity | No current semantic publication; reacquire exact subject |
| `OPS-F03` | Missing, stale, invalid, or incompatible configuration/context | Affected claims partial, unsupported, or failed |
| `OPS-F04` | Provider unavailable, crashed, malformed, unqualified, or contract-violating | Provider capability unavailable; raw diagnostics retained when permitted |
| `OPS-F05` | Timeout, deadline, cancellation, or resource exhaustion | Explicit terminal/degraded state and exact affected work |
| `OPS-F06` | Dependency unknown, invalidation incomplete, or stale cache | No currentness claim; conservative broadening/recompute |
| `OPS-F07` | Publication validation or compare-and-publish failure | Predecessor remains the mechanically selected binding target only when pre-commit failure is proven; freshness stays independent |
| `OPS-F08` | Commit outcome uncertain | Expose binding unavailable/unknown and reconcile authoritative current binding and intent before retry |
| `OPS-F09` | Integrity collision, corruption, or incompatible format | Quarantine; refuse dependent use; repair/rebuild under evidence |
| `OPS-F10` | Migration divergence, backfill gap, or cutover failure | No mixed mode; retain one proven routing state or expose routing unavailable/unknown |
| `OPS-F11` | Retention, deletion, restore, or backup failure | No fabricated availability; preserve exact action and residual risk |
| `OPS-F12` | Authorization, redaction, encryption, key, secret, or egress failure | Deny or safely degrade without existence/path/count/shape leakage |
| `OPS-F13` | Audit or telemetry write failure | Preserve reconstructable durable intent; degrade audit health/readiness; do not reverse a proven commit |
| `OPS-F14` | External effect uncertain or partially completed | Observe the effect under exact identity before repeat or compensation |
| `OPS-F15` | Cross-partition, mixed-revision, or TOCTOU detection | Refuse/quarantine result; never repair by silent rebinding |
| `OPS-F16` | Unexpected internal or unknown failure | Safe typed failure, bounded diagnostics, no green/default success, recovery routing |

### 15.2 Retry classification

Every failure class maps to one of:

| Retry class | Behavior |
| --- | --- |
| `never` | Input, authorization, incompatibility, policy, collision, or semantic defect requires a new corrected request or decision |
| `after-reconciliation` | Outcome may have occurred; observe durable/internal/external state before repeating |
| `after-dependency-change` | Retry only after exact failed dependency version or health state changes |
| `bounded-same-input` | Retry exact immutable input under declared attempt/delay/resource limits |
| `rebuild-from-authoritative-inputs` | Discard/quarantine derivative and deterministically reconstruct |
| `manual-or-external-decision` | Security, authority, retention hold, destructive repair, or unresolved risk requires a separately owned decision |

Retry policy records maximum attempts or an explicit owner-supplied bound, delay/backoff rule, jitter/clock semantics, deadline interaction, budget accounting, cancellation, provider substitution rule, idempotency, and terminal outcome. Exhaustion is explicit failure or degraded state, never successful emptiness.

### 15.3 Provider failure and fallback

Provider execution remains untrusted and replaceable. Failure of one provider can produce an explicitly partial publication only when the governing capability/profile permits it and every missing region and no-false-green consequence is present. A provider's exit success, health, or empty output does not establish semantic completeness.

Fallback to another provider is permitted only under a future exact operational profile and `JAN-CSAA-011` qualification state. It creates a distinct invocation and provenance chain, applies exact compatibility/loss rules, retains prior failure/disagreement, and reruns every affected validation. No silent provider winner, version substitution, configuration substitution, or provider-shaped semantic rewrite is allowed.

Last-known-good material remains separately identified historical evidence. It may support explicitly labeled historical inspection under authorization; it cannot be presented as current output from a failed request.

## 16. Crash, restart, reconciliation, and recovery

### 16.1 Recovery principles

Recovery begins from durable evidence, not process memory or presumed failure. It:

1. establishes the exact `operationalProfileInstantiationId`, partition, migration epoch, and current-binding generation;
2. verifies durable intents, immutable material, claims, attempts, checkpoints, open integrity incidents, incomplete or outcome-unknown repair executions, current bindings, and audit gaps;
3. classifies every incomplete operation as safe to resume, safe to replay, requiring reconciliation, abandoned, quarantined, or terminal;
4. reconciles uncertain internal and external effects;
5. fences stale workers and owners;
6. preserves prior valid publications and historical attempts;
7. prevents duplicate records, findings, evidence, audit events, and effects;
8. completes exactly one admissible successor when the intended recovery outcome requires successor publication, or authoritatively preserves/revalidates the existing publication or completes an already committed result without republishing; any unresolved outcome remains explicitly non-green; and
9. records recovery actions, residual material, cleanup, and unresolved risk.

### 16.2 Sixteen topology-neutral recovery boundaries
| Recovery coordinate | Observable boundary | Required recovery result |
| --- | --- | --- |
| `JAN-CSAA-009-RCV-001` | Before request acceptance | No accepted durable work; a repeated request is new or idempotently recognized |
| `JAN-CSAA-009-RCV-002` | During subject acquisition or identity resolution | Received subject remains unmodified; incomplete identity cannot publish |
| `JAN-CSAA-009-RCV-003` | During plan construction or capability dependency resolution | No missing plan edge is treated as completed; rebuild exact plan |
| `JAN-CSAA-009-RCV-004` | After invocation creation and before raw capture | Attempt remains distinct; reconcile provider/external effect before retry |
| `JAN-CSAA-009-RCV-005` | After raw capture and before validation | Verify raw integrity/provenance; resume validation or quarantine |
| `JAN-CSAA-009-RCV-006` | During V01–V07 validation | Earlier required failures remain failures; resume from verified stage or restart validation |
| `JAN-CSAA-009-RCV-007` | During transformation or normalization | Discard/rebuild incomplete derivatives; retain exact raw basis |
| `JAN-CSAA-009-RCV-008` | After candidate assembly and before publication validation | Verify that pre-seal lifecycle revisions contain `candidateLifecycleId` and every required lifecycle field but no `publicationCandidateId`, that seal finalized the self-excluding content-identity preimage exactly once, and that no earlier revision was backfilled; validate or abandon without current mutation |
| `JAN-CSAA-009-RCV-009` | At the atomic-publication boundary | Reconcile distinct `candidateLifecycleId`, sealed `publicationCandidateId`, intent/idempotency, expected predecessor/generation, and authoritative current binding; reconcile `publicationCommitId` only when an authoritative Publication Decision exists, otherwise preserve its absence and `COMMIT_OUTCOME_UNKNOWN` until commit or no-commit is proved; never rebind lifecycle content |
| `JAN-CSAA-009-RCV-010` | After publication and before response or audit completion | Preserve the committed lifecycle/content/commit identity tuple; reconstruct response, later output-complete replay evidence, and audit without altering the sealed candidate or republishing |
| `JAN-CSAA-009-RCV-011` | During cancellation propagation and cleanup | Determine effective boundary, retain actual material, fence children, finish cleanup |
| `JAN-CSAA-009-RCV-012` | During timeout, resource exhaustion, or backpressure | Preserve actual terminal/degraded state; release or recover bounded resources |
| `JAN-CSAA-009-RCV-013` | During stale-cache or interrupted-index detection | Quarantine/miss derivative; revalidate or rebuild from authoritative material |
| `JAN-CSAA-009-RCV-014` | During uncertain external-effect reconciliation | Observe exact effect; then finish, compensate if authorized, or retry idempotently |
| `JAN-CSAA-009-RCV-015` | During corruption detection, rebuild, migration, or reconciliation | Keep damaged/incompatible material non-current; validate isolated successor |
| `JAN-CSAA-009-RCV-016` | During retry/restart duplicate prevention and last-known-good separation | Preserve every attempt, deduplicate effects, and never relabel predecessor as new output |

These coordinates are the required topology-neutral bindings for the sixteen `JAN-CSAA-008` recovery points. Every future operational profile maps each coordinate to one or more concrete injection points, durable materials, expected before/after states, observable probes, cleanup checks, and independent 008 tests. A topology that has several physical commits for one logical boundary must still prove the same all-or-nothing observable result.

### 16.3 Startup and shutdown reconciliation

Before write readiness, startup reconciles:

- operational-profile and format compatibility;
- current bindings and referenced Publication Manifests;
- incomplete publication intents;
- live/expired claims and stale fencing generations;
- incomplete cancellation, retry, recovery, migration, retention, deletion, and exact `repairExecutionId` actions;
- quarantine, corruption, and every open `integrityIncidentId` state;
- audit gaps that are deterministically reconstructable;
- required encryption/key/secret availability without exposing values; and
- backlog, resource, and dependency readiness.

Read readiness may be separately available for verified immutable publications while write recovery continues, but the response must expose the exact degraded dimensions. Shutdown stops new admission, propagates cancellation or drains under policy, persists required checkpoints/intents, releases claims only after state is durable, and records incomplete work for startup recovery. Forced termination remains an in-scope fault, not a proof of clean shutdown.

## 17. Integrity, corruption detection, repair, and rebuild

### 17.1 Integrity layers

Integrity is verified independently at:

| Layer | Required evidence |
| --- | --- |
| Raw bytes | Exact digest descriptor, size, media/encoding profile, acquisition or production identity |
| Immutable record | Contract version, canonical record digest, identity projection, finalization, required references |
| Collection/partition | Canonical keys, member count, aggregate digest, duplicate/collision check |
| Publication | Partition inventory, aggregate digests, subject/configuration closure, predecessor, eligibility |
| Current binding | Partition, exact Publication Manifest, generation, predecessor expectation, fencing, audit correlation |
| Cache/projection | Authoritative basis, transform/version, dependency manifest, build/checkpoint, admitted state |
| Backup | Consistency boundary, complete inventory, per-item and aggregate integrity, encryption/key references |
| Restore/migration | Source/target inventory, compatibility, transformation, rejected/lost state, reconciliation |
| Audit chain | Event identity, content-bound causation/correlation, safe integrity evidence, gap/recovery treatment |

A digest failure, missing member, impossible reference, collection-key collision, count mismatch, cross-partition edge, broken predecessor, invalid finalization order, or current-binding mismatch is corruption until disproven. The system does not “repair” by dropping the offending item and presenting the remainder as complete.

### 17.2 Corruption classes and treatment
| Class | Defect | Required initial treatment |
| --- | --- | --- |
| `COR-01` | Unreadable or missing persisted bytes | Mark unavailable; determine every dependent publication/cache/backup |
| `COR-02` | Byte digest or size mismatch | Quarantine exact material and refuse dependent admission |
| `COR-03` | Canonical-record or identity-projection mismatch | Quarantine collision/incompatible record; never overwrite |
| `COR-04` | Missing, wrong-kind, wrong-direction, or digest-invalid reference | Invalidate containing record/publication and trace blast radius |
| `COR-05` | Collection count, key, ordering, duplicate, or aggregate-digest mismatch | Invalidate complete collection and dependent manifests |
| `COR-06` | Cross-subject, cross-revision, cross-principal, or cross-tenant member | Security/integrity incident; block exposure and publication |
| `COR-07` | Publication manifest and stored partitions disagree | Keep publication non-current or mark current binding degraded/unavailable |
| `COR-08` | Current binding points to absent/ineligible/incompatible publication | Withdraw write/read readiness; reconcile predecessor and restore safely |
| `COR-09` | Cache/projection basis cannot be proven | Quarantine derivative; rebuild from authoritative inputs |
| `COR-10` | Operation journal, claim, checkpoint, or intent contradiction | Fence affected work; reconstruct from immutable facts; do not blind-retry |
| `COR-11` | Audit gap or impossible event order | Degrade reconstructability/readiness; deterministically recover or retain explicit gap |
| `COR-12` | Backup inventory or restore mismatch | Refuse activation; retain failed restore evidence in isolation |
| `COR-13` | Migration source/target divergence outside declared map | Block cutover or execute authorized rollback without mixed reads |
| `COR-14` | Unauthorized, expired, or weaker information-control state | Deny access; quarantine derivative; record security event |
| `COR-15` | Encryption/key reference unavailable or integrity/authentication failure | Deny decryption/use; preserve safe evidence; route authorized recovery |
| `COR-16` | Unknown integrity defect | Fail closed for current/green use; bound diagnostics; require owner disposition |

Each detected integrity or corruption condition creates or appends to one exact `IntegrityIncidentRecord` lineage keyed by `integrityIncidentId`. Its append-only assessments preserve the defect, affected and blast-radius populations, containment/quarantine, currentness and readiness consequences, evidence, closure basis, and explicit residual loss. A causal audit event references this technical incident but cannot substitute for its authoritative technical state.

### 17.3 Repair and deterministic rebuild

Repair never mutates an immutable governed record in place. The allowed operational patterns are:

- recover exact bytes from another independently integrity-verified retained copy;
- reconstruct a derivative from exact authoritative immutable inputs and transform versions;
- re-run separately authorized analysis against the same exact subject and methods, producing a new attempt and records;
- create an explicit corrected successor under concern-owned semantics;
- restore an isolated verified backup and reconcile every later action before activation; or
- record permanent loss/unavailability with affected populations and residual risk.

Every repair plan binds its exact `integrityIncidentId` and one new `repairExecutionId`, and names defect, blast radius, authoritative basis, transform, subject/partition, information-control state, expected result, verification, rollback, audit, and authority. One repair execution may contain separately identified work attempts, but a separately authorized repair, rebuild, restart, or disaster-recovery action receives a new `repairExecutionId`. Repaired material stays isolated until every ordinary admission predicate passes. An incomplete repair cannot become current or make a degraded dimension healthy.

A reindex or rebuild is semantically inert until its complete candidate is validated and atomically published. `WorkUnitRecord` and `ProjectionBuildRecord` may compose with the exact `RepairExecutionRecord`, but neither substitutes for the authorized repair action or its outcome. A repair or rebuild does not erase the integrity incident, prior publication, lost material, or previous attempt.

## 18. Backup, restore, and disaster recovery

### 18.1 Backup-set contract

Each backup set binds:

- operational profile, storage-format version, contract package, migration epoch, and encryption/key references;
- one declared consistency boundary and capture time/window;
- exact security partitions, publication channels, Publication Manifests, current bindings, immutable material, audit, policies, and exclusions;
- per-item and aggregate digests, sizes, counts, reference closure, and information-control classifications;
- incremental/base backup lineage where applicable;
- retention, hold, replication/copy, location class, access, and destruction policy;
- restore prerequisites and compatibility;
- recovery-point and recovery-time objective parameters supplied by an identified owner; and
- creation, verification, reviewer, test allocation, and known limitations.

One exact `backupSetId` names this immutable backup-set manifest and consistency boundary. A later capture, materially different inventory, changed basis, or corrected manifest receives a new identity rather than mutating or aliasing the prior set.

A copied directory, database snapshot, replicated object, exported graph, or archive is not a valid backup set without this binding. A live replica is not assumed to be an independent backup.

### 18.2 Restore protocol

Restore occurs into an isolated non-current partition. It:

1. authenticates authority and verifies destination isolation;
2. validates backup identity, completeness, integrity, encryption/key access, contract and physical-format compatibility;
3. restores material without overwriting newer authoritative history;
4. reconstructs and validates collections, references, Publication Manifests, current-binding candidates, audit, and policy state;
5. compares the restored cutoff with every later publication, invalidation, revocation, policy, retention, deletion, key, and security action;
6. reapplies or reconciles later actions so deleted, revoked, stale, or superseded material cannot silently become current or disclosed;
7. runs required corruption, migration, authorization, and recovery validation;
8. creates a new restore observation and prospective current-binding generation;
9. atomically activates only an eligible reconciled publication; and
10. retains failure, rollback, residual-loss, and test evidence.

Every restore, validation, reconciliation, prospective activation, retry, restart, repair, or disaster-recovery test receives a new exact `restoreExecutionId`. The restore execution remains distinct from its source `backupSetId`, recovery epoch, migration execution, external-effect intent, publication candidate, and audit events.

Restore never rewinds governance, oracle, finding treatment, provider qualification, authorization, retention hold, or semantic currentness by implication. A backup can restore bytes; it cannot restore expired authority or make old evidence fresh.

### 18.3 Disaster-recovery readiness

The operational profile declares failure domains and the evidence needed to show backup independence, but it selects no geographic, cloud, hardware, or replication topology here. Readiness reports actual last verified backup, last successful isolated restore test, recoverable publication cutoff, unresolved gaps, key availability, and objective status separately. “Backup configured” is not recovery evidence.

## 19. Physical schema evolution, migration, dual-run, cutover, and fallback

### 19.1 Migration distinction

`JAN-CSAA-007` owns logical contract compatibility and `LogicalMigrationPlanRecord` meaning. This design owns physical storage-format, layout, index, projection, engine, and deployment migration behavior. A physical migration cannot claim logical compatibility; it consumes exact compatibility evidence.

### 19.2 Migration state machine
| State | Meaning | Consequence |
| --- | --- | --- |
| `PROPOSED` | One exact immutable source/target profile pair, candidate change, owner, scope, alternatives, and risks are bound to a fresh migration-execution identity | No physical action |
| `PRECONDITIONS_BLOCKED` | Authority, compatibility, inventory, backup, rollback, capacity, or test prerequisite missing | Remain on source mode |
| `PREPARED` | Plan, transforms, checkpoints, observability, rollback, and authorization close for the already fixed source/target pair | Begin isolated shadow/backfill |
| `BACKFILLING` | Historical/current source material copied or rebuilt under exact checkpoints | No target currentness |
| `SHADOWING` | Target receives or derives new activity without serving as ordinary current source | Compare source/target |
| `DUAL_RUNNING` | Both engines/providers execute exact comparable requests under declared ownership | Retain every result and difference |
| `RECONCILING` | Inventory, semantics, performance, security, failure, and residual differences evaluated | Correct/rebuild/abort |
| `CUTOVER_READY` | Every mandatory criterion passes and rollback remains viable | Seek separately authorized cutover |
| `CUTTING_OVER` | One fenced current-routing generation change is actively attempted at the declared atomic boundary | Observe authoritative routing result |
| `CUTOVER_OUTCOME_UNKNOWN` | Neither source nor target routing result can yet be authoritatively established | Block affected routing/write readiness and reconcile; never guess or blind-retry |
| `TARGET_CURRENT` | New profile serves ordinary current reads/writes for exact partitions | Observe and retain source fallback boundary |
| `WITHDRAWN` | An authorized no-go or cancellation closes the attempt before target currentness, after every started side effect and residual target material is reconciled | Keep the exact source mode current; retain cleanup, residual-material, and decision evidence without calling it failure or rollback |
| `ROLLED_BACK` | Authorized current routing returned to a compatible verified source/fallback | Preserve target attempts and post-source changes |
| `FAILED` | Migration cannot safely proceed or recover | Remain on one explicit safe mode; no mixed current state |
| `DECOMMISSION_PENDING` | Rollback/retention/hold/verification windows not yet closed | Prevent destructive source removal |
| `COMPLETE` | Decommission criteria and all history, retention, audit, export, and removal evidence close | Retain immutable migration record |

The migration transition relation is closed:
| From | Allowed target | Guard and effect |
| --- | --- | --- |
| `PROPOSED` | `PRECONDITIONS_BLOCKED\|PREPARED\|WITHDRAWN\|FAILED` | Prerequisite evaluation, authorized no-go, or terminal failure determines the branch |
| `PRECONDITIONS_BLOCKED` | `PREPARED\|WITHDRAWN\|FAILED` | New exact evidence closes all blockers, authority closes the attempt without action, or terminally fails the migration attempt |
| `PREPARED` | `BACKFILLING\|SHADOWING\|DUAL_RUNNING\|RECONCILING\|WITHDRAWN\|FAILED` | Separately authorized declared mode begins, or no-go/terminal treatment closes after safe cleanup |
| `BACKFILLING` | `SHADOWING\|DUAL_RUNNING\|RECONCILING\|WITHDRAWN\|FAILED` | Checkpointed population and concurrent-change treatment determine next mode, or withdrawal/failure closes after cleanup |
| `SHADOWING` | `DUAL_RUNNING\|RECONCILING\|WITHDRAWN\|FAILED` | Comparison evidence advances or blocks, or withdrawal/failure closes after cleanup |
| `DUAL_RUNNING` | `RECONCILING\|WITHDRAWN\|FAILED` | Declared comparison population closes, or withdrawal/failure closes after cleanup |
| `RECONCILING` | `BACKFILLING\|SHADOWING\|DUAL_RUNNING\|CUTOVER_READY\|WITHDRAWN\|FAILED` | Correction loop, every cutover predicate, or no-go/failure disposition closes |
| `CUTOVER_READY` | `CUTTING_OVER\|RECONCILING\|WITHDRAWN\|FAILED` | Authority starts cutover, new evidence reopens/fails readiness, or no-go closes before cutover |
| `CUTTING_OVER` | `TARGET_CURRENT\|WITHDRAWN\|ROLLED_BACK\|CUTOVER_OUTCOME_UNKNOWN\|FAILED` | Authoritative evidence proves target commit, proves no target selection and authorized withdrawal, proves target commit followed by a separately recorded rollback, leaves outcome unresolved, or establishes failure |
| `CUTOVER_OUTCOME_UNKNOWN` | `TARGET_CURRENT\|CUTOVER_READY\|RECONCILING\|WITHDRAWN\|ROLLED_BACK\|FAILED` | Authoritative reconciliation proves target selection, proves no commit with unchanged readiness, proves no commit with reopened evidence, proves no commit plus authorized withdrawal, proves target selection followed by a separately recorded rollback, or establishes unrecoverable failure |
| `TARGET_CURRENT` | `DECOMMISSION_PENDING\|ROLLED_BACK\|FAILED` | Rollback/decommission evidence and target health determine the branch |
| `DECOMMISSION_PENDING` | `COMPLETE\|ROLLED_BACK\|FAILED` | Every rollback, hold, retention, reader, export, secret, backup, and removal predicate closes |
| `WITHDRAWN\|ROLLED_BACK\|FAILED\|COMPLETE` | `none` — terminal | Any later attempt receives a new migration-execution identity |

At `PROPOSED`, a fresh opaque `migrationExecutionId` binds one exact immutable source/target operational-profile pair. A changed source or target profile, implementation, version, configuration, partition scope, or migration direction creates a new migration execution instead of retargeting the existing identity. `PREPARED` closes evidence and authorization for the already fixed pair; it does not complete identity binding. `WITHDRAWN` closes an authorized no-go or cancellation before target currentness only after all started side effects, residual target material, holds, and cleanup are reconciled. It neither asserts technical failure nor masquerades as rollback. Cutover identities and `expectedRoutingGeneration`/`routingGeneration` remain later-phase routing fields and are not anticipated at proposal.

Every edge appends a monotonic migration-state revision; an unlisted edge is invalid. `ROLLED_BACK` means an exact target selection occurred and a later separately recorded routing decision restored a verified source/fallback. Proven pre-cutover failure remains on the source and is not mislabeled rollback.

### 19.3 Migration preconditions

Before backfill, shadow, dual-run, dual-write, cutover, rollback, or decommission, the plan closes:

1. exact source and target operational profiles, implementations, versions, configurations, and partitions;
2. logical contract and semantic-owner compatibility directions;
3. complete material, record-family, current-binding, policy, audit, backup, and retention inventory;
4. transformation, loss, rejection, unknown-field, identity, digest, reference, ordering, and encryption/key behavior;
5. old reader/new writer and new reader/old writer compatibility;
6. backfill checkpoint and duplicate-prevention rules;
7. concurrent change capture or explicit quiescence rule;
8. shadow/dual-run comparison populations and independently governed oracles;
9. resource/capacity budgets and backpressure;
10. security, confidentiality, access, retention, egress, and key controls;
11. cutover linearization, fencing, reader pinning, and uncertain-outcome reconciliation;
12. rollback/fallback point, maximum divergence, forward changes, and data-loss consequence;
13. backup and isolated restore evidence;
14. 008 migration, recovery, security, and performance test allocations; and
15. separately owned authority for every executable or destructive action.

### 19.4 Shadow, dual-run, and dual-write

Shadow and dual-run output remains derived evidence and cannot silently become current. Each lane preserves exact subject, request, provider/engine, configuration, timing, resource, health, raw, normalized, and failure provenance. Comparison evaluates semantic and operational dimensions, not only counts, checksums, latency, or exit status.

Dual-write is neither selected nor presumed. If a future profile selects it, the profile defines authoritative side, ordering, idempotency, conflict, partial-write, retry, reconciliation, read routing, backfill interaction, and cutover behavior. A partial dual-write cannot be hidden by later success, and neither side may destructively upsert immutable history.

### 19.5 Cutover, fallback, and rollback

Cutover changes one exact `routingGeneration` per declared stable routing scope at one observable logical boundary, guarded by the independently preserved `expectedRoutingGeneration`. These routing values remain distinct from `publicationGeneration` and `expectedPublicationGeneration` unless an exact concern-owner contract proves one atomically governed counter and its full semantic equivalence. In-flight reads retain their pinned view. New reads/writes use one declared profile. Mixed source/target material is permitted only inside an explicit comparison result, never in an ordinary query or publication. Exact `JAN-CSAA-007@1.0.0` supplies the candidate representation for the routing guard and resulting generation without overloading publication currentness; enforcement and execution remain absent.

Fallback due to target degradation is not an implicit rollback. It names the exact fallback publication/profile, verifies compatibility and currentness, reconciles target-accepted changes, records missing capability and provider state, and exposes degraded behavior. Rollback cannot discard or duplicate post-cutover accepted work; if exact reconciliation is impossible, the system remains non-green and requires an external decision.

Decommission requires expired rollback need, complete export/reconstruction evidence, closed holds/retention, provider-removal verification, secrets/credentials revocation, backup treatment, deletion/GC authorization, and absence of active references or readers.

## 20. Retention, redaction, archival, deletion, and garbage collection

### 20.1 Policy and immutable history

Every material class has separate confidentiality, access, and retention classifications. A retention action acts on physical availability; it cannot rewrite semantic identity, historical occurrence, predecessor/successor relation, prior query result, finding history, or audit fact.

The operational profile distinguishes:

| Action | Meaning |
| --- | --- |
| `retain-online` | Material remains in ordinary authorized operational storage |
| `archive` | Material moves to a separately controlled slower/offline class while identity and authorized retrieval remain defined |
| `redact-derivative` | A new protected projection omits content under exact policy and records completeness/non-disclosure consequences |
| `tombstone-or-unavailable-record` | Payload becomes unavailable while safe identity/action/lineage evidence remains where policy permits |
| `physical-delete` | Bytes are removed from a declared physical surface under authorization |
| `cryptographic-erasure` | Key destruction renders encrypted bytes inaccessible under an exact verified key scope |
| `compact` | Physical representations are reorganized or deduplicated without changing governed logical history |
| `expire-cache` | Rebuildable derivative is evicted; authoritative material state is unchanged |
| `destroy-backup` | One backup copy is removed after independent retention/hold checks |

### 20.2 Holds, policy changes, and derivative inheritance

A legal, regulatory, contractual, governance, security-incident, oracle-review, investigation, or other recognized hold blocks conflicting deletion and compaction for its exact scope. Holds have owner, authority, start, scope, reason, review, expiry/release, and audit. An absent release is not permission to delete.

Derived material cannot be retained longer, disclosed more broadly, encrypted less strongly, or deleted less completely than the conservative composition of its sources unless an explicit policy with authority permits and justifies the difference. Cache, temporary, diagnostic, search, telemetry, backup, and migration copies are included.

Policy changes create new decisions/actions. They do not retroactively claim that prior handling was compliant or erase earlier classifications. A more restrictive policy invalidates incompatible cache/read views and triggers bounded remediation.

### 20.3 Redaction and non-disclosure

Redaction creates a derivative and a Redaction Manifest under `JAN-CSAA-007`. It never fabricates an empty collection, zero count, absent node/edge/path, supported false, complete flag, healthy state, or successful result. Existence, path, count, graph shape, source excerpt, raw preview, timing, error, stack, identifier, and correlation may each require withholding.

Unauthorized access is evaluated before traversal, aggregation, pagination, raw retrieval, count computation, cache admission, export, backup restore, repair, or existence disclosure. A denial reveals only the safe details authorized for that boundary.

### 20.4 Garbage-collection roots and protocol
| Root | Protected reachability basis |
| --- | --- |
| `G01` | Every current Publication Manifest and transitively required immutable member |
| `G02` | Every retained historical Publication Manifest and predecessor/successor lineage required by policy |
| `G03` | Every admitted read view, continuation, export, or recovery operation within its protection interval |
| `G04` | Every active candidate, durable publication intent, claim, checkpoint, retry, and cancellation/recovery action |
| `G05` | Every retained raw artifact, normalization basis, conflict, explanation, and reproducibility dependency |
| `G06` | Every finding, treatment, exception/disposition reference, oracle, and audit lineage required by its owner/policy |
| `G07` | Every legal/authority/security/investigation hold and retention reference |
| `G08` | Every backup or archive whose policy requires the live material or its independently valid copy |
| `G09` | Every migration, rollback, fallback, shadow/dual-run, repair, corruption, and residual-loss dependency |
| `G10` | Every contract, semantic-owner, compatibility, generated-derivative, provider/method, policy, and key reference required to interpret retained material |
| `G11` | Every fixture/oracle/conformance subject or evidence retained for independent review under its exact standing |
| `G12` | Every explicitly declared external root supplied by a recognized owner and validated under the operational profile |

Garbage collection uses a recorded root set, reference-closure version, observation cutoff, grace boundary, active-reader/candidate/migration check, retention/hold decision, information-control rule, proposed deletion population, authorization, and post-action verification. Unknown reachability, unresolved references, audit gaps, active claims, or policy conflict blocks deletion or broadens retention.

Marking an object unreachable is not deletion authorization. Deletion authorization is not proof that all copies, caches, backups, logs, migrations, or provider outputs were removed. The action records each physical surface and residual copy class.

Compaction or deduplication must preserve every logical identity, content-bound reference, canonical collection, predecessor/successor relation, raw provenance, information-control treatment, audit relation, and reconstruction basis. A lineage-severing compaction is corruption.

## 21. Security, confidentiality, encryption, and operational containment

### 21.1 Least privilege and isolation

Repository content and all analyzer inputs are untrusted data. Subject acquisition is read-only. Provider execution receives only exact authorized input and a separate bounded output location. Process creation and network access are denied unless an explicit grant names operation, subject, principal, purpose, endpoint/path, data, method, time, resource, audit, and revocation boundaries.

Persisted and temporary state is isolated through the applicable security-partition, publication-channel, candidate-subject, operation, cache, and material projections across repository, worktree, branch observation, semantic snapshot, evidence set, principal, tenant, purpose, fixture run, and information-control policy. “Tenant not applicable” requires an exact profile-owned applicability reason; omission is invalid.

### 21.2 Encryption-property contract

This Draft selects no cryptographic algorithm, library, service, key manager, certificate authority, or hardware. Every later profile nevertheless declares:

- protected material classes and threat boundary;
- encryption and integrity/authentication property required at rest, in transit, in backup, in temporary storage, and during migration/export;
- algorithm/profile reference, key/certificate identity reference, owner, issuance, rotation, expiry, revocation, and availability semantics;
- envelope/field/partition scope and metadata leakage treatment;
- authenticated context binding to subject, tenant, purpose, and material class where required;
- plaintext exposure points, memory/temp/log restrictions, and cleanup;
- failure, unavailable key, partial rotation, mixed-key, rollback, restore, and emergency-access behavior;
- audit without key or plaintext disclosure; and
- conformance and independent security-review allocation.

Encryption failure denies use or safely degrades availability; it never falls back to plaintext. Key rotation produces exact versioned treatment and cannot orphan retained material without recorded residual loss and authority.

### 21.3 Secrets and credentials

Only opaque `SecretReferenceRecord`-style references enter controlled records. Secret values are never embedded in manifests, cache keys, logs, metrics, diagnostics, audit payloads, backups without approved encryption, query results, or provider raw material beyond an exact authorized purpose. Workers and providers receive the minimum environment and credential scope and cannot inherit unrelated host authority.

### 21.4 Twenty hostile-condition operational allocations
| Hostile coordinate | Surface | Operational containment |
| --- | --- | --- |
| `JAN-CSAA-008-HST-001` | Traversal/alternate separator/normalization/encoding | Canonicalize within exact root; refuse safely |
| `JAN-CSAA-008-HST-002` | Absolute/drive/UNC/device/ADS/reserved path | Deny outside authorized path class without host-path disclosure |
| `JAN-CSAA-008-HST-003` | Symlink/junction/mount/hard-link/provider-alias escape | Resolve complete chain and deny escape |
| `JAN-CSAA-008-HST-004` | Archive/generated/map/extraction entry escape | Validate every materialized target before write |
| `JAN-CSAA-008-HST-005` | Case-fold/Unicode/confusable/ambiguous collision | Detect identity ambiguity and quarantine |
| `JAN-CSAA-008-HST-006` | Configuration/package lifecycle/discovery/workspace hook execution | Parse as data; process denied by default |
| `JAN-CSAA-008-HST-007` | Generator/plugin/script/native/compiler child-process trigger | Require separate bounded execution grant |
| `JAN-CSAA-008-HST-008` | Repository prompt/comment/filename/diagnostic instruction injection | Treat as subject data; never authority |
| `JAN-CSAA-008-HST-009` | Nested/cyclic/oversized/fanout/regex/parser/decompression bomb | Enforce depth, size, time, memory, output, and expansion budgets |
| `JAN-CSAA-008-HST-010` | Poisoned generated/virtual/map/trace/coverage payload | Validate provenance, contract, mapping, and bounds before admission |
| `JAN-CSAA-008-HST-011` | Spoofed extension/discriminator/provider field/media/schema identity | Reject or quarantine incompatible identity |
| `JAN-CSAA-008-HST-012` | Secret/credential/token/environment/source/trace canary exfiltration | Minimize input, deny egress, detect canary, audit safely |
| `JAN-CSAA-008-HST-013` | Network/DNS/loopback/metadata/callback/update/telemetry egress | Deny by default; exact endpoint and data grant only |
| `JAN-CSAA-008-HST-014` | Cross-repository/worktree/branch/principal/tenant/evidence/cache contamination | Enforce complete applicable identity projections and refusal |
| `JAN-CSAA-008-HST-015` | Mixed revision/TOCTOU/concurrent mutation/subject substitution | Revalidate subject and fence publication |
| `JAN-CSAA-008-HST-016` | CPU/memory/disk/file/process/output/traversal/query exhaustion | Bound, cancel, backpressure, and report non-green |
| `JAN-CSAA-008-HST-017` | Unmodeled reflection/framework/dynamic/native/runtime frontier | Preserve unsupported/unknown frontier |
| `JAN-CSAA-008-HST-018` | Unauthorized raw/source/query/finding/trace/count/path/shape/existence probe | Authorize before observation and disclose safely |
| `JAN-CSAA-008-HST-019` | Diagnostic/audit/exception/stack/preview/timing side channel | Apply record-grain information control and bounded response |
| `JAN-CSAA-008-HST-020` | Record collision/digest-purpose confusion/predecessor rewrite/history substitution | Quarantine, verify purpose projection, and preserve immutable lineage |

No hostile content is executed or materialized by this documentation activity. A later test must prove containment using canaries, denied side effects, resource observations, cleanup, and audit evidence. Host escape, source mutation, unauthorized secret read, network egress, unbounded process tree, or cross-partition disclosure is critical failure.

## 22. Audit, observability, health, readiness, and capacity

### 22.1 Security-relevant and operational event registry
| Class | Required logical events |
| --- | --- |
| `AUD-01` | Request, authentication, authorization allow/deny/redaction, and delegation use |
| `AUD-02` | Subject acquisition, path resolution/refusal, identity observation, and TOCTOU detection |
| `AUD-03` | Plan, scheduling, admission, queue, fairness, backpressure, shedding, and resource refusal |
| `AUD-04` | Claim acquire/renew/expire/reassign, fencing generation, stale-worker refusal, and duplicate delivery |
| `AUD-05` | Provider/tool invocation, capability grant, raw capture, validation, normalization, disagreement, and failure |
| `AUD-06` | Candidate assembly, sealing, eligibility, refusal, quarantine, abandonment, and orphan cleanup correlated by exact `candidateLifecycleId`, optional post-seal `publicationCandidateId`, state revision, and `publicationCommitId` only where that later decision exists |
| `AUD-07` | Publication intent, compare-and-publish, conflict, commit, uncertain outcome, response, and supersession correlated without merging candidate lifecycle, sealed content, or commit identity |
| `AUD-08` | Query/read-view acquisition, continuation, export, raw retrieval, comparison, and non-disclosure |
| `AUD-09` | Dependency observation, invalidation, broadening, revalidation, recomputation, and clean-full comparison |
| `AUD-10` | Cache construction, admission, hit, miss, stale, invalidation, quarantine, eviction, and cross-partition denial |
| `AUD-11` | Cancellation, timeout, retry, external-effect reconciliation, recovery, cleanup, and terminal outcome |
| `AUD-12` | Integrity check, collision, corruption, blast-radius analysis, repair, rebuild, and residual loss |
| `AUD-13` | Backup creation/verification/destruction, restore attempt/validation/activation, and disaster-recovery test |
| `AUD-14` | Migration proposal, backfill, shadow, dual-run/write, reconciliation, cutover, fallback, rollback, and decommission |
| `AUD-15` | Classification/policy/hold change, redaction, archive, deletion, cryptographic erasure, compaction, and garbage collection |
| `AUD-16` | Encryption/key/certificate/secret availability, rotation, revocation, emergency access, and plaintext fallback refusal |
| `AUD-17` | Startup/shutdown readiness transition, dependency loss, capacity state, degraded mode, and recovery completion |
| `AUD-18` | Administrative configuration/profile change, authority reference, reviewer action, and unsupported manual override attempt |

Every event records safe actor/principal/component, exact authority and authorization, subject/partition, operation/run/invocation/attempt, correlation and causation, definition/configuration versions, input/output references, decision/action, times, result, health, resource use, redaction, failure, and diagnostics as applicable. Correlation/causation is acyclic over finalized records. Reverse lookup is derived.

Audit records are immutable operational evidence and protected data. They never carry unrestricted source, secret values, credentials, raw provider payloads, host paths, graph shape, counts, or existence when a protected reference, digest, class, or withheld state suffices. Missing audit evidence cannot be replaced by a log message.

### 22.2 Independent health and readiness dimensions
| Dimension | Name | Question answered |
| --- | --- | --- |
| `H01` | Process/component liveness | Can the bounded component respond under its declared probe? |
| `H02` | Read readiness | Can exact retained publications be served with authorization, integrity, and pinned views? |
| `H03` | Write/publication readiness | Can accepted work durably progress and atomically publish under current profile? |
| `H04` | Recovery readiness | Are incomplete intents, claims, migrations, retention actions, corruption, and audit gaps reconciled? |
| `H05` | Storage/material integrity | Do required immutable materials, collections, manifests, and current bindings validate? |
| `H06` | Security-control readiness | Are authentication, authorization, information control, encryption, keys, secrets, and audit enforceable? |
| `H07` | Dependency/provider execution health | Are exact declared dependencies/providers available within capability and qualification limits? |
| `H08` | Capability coverage | What supported, partial, unsupported, excluded, and not-analyzed regions exist? |
| `H09` | Evidence freshness/currentness | Which exact publications/evidence sets are current, stale, invalidated, unknown, or historical? |
| `H10` | Finding and conflict state | What technical findings, conflicts, disagreements, and unresolved treatments exist? |
| `H11` | Later gate outcome | Separate external gate dimension; currently no RGP exists |
| `H12` | Backlog/fairness/capacity | What admitted, queued, starved-risk, saturated, refused, and headroom states exist? |
| `H13` | Migration/backup/retention state | What cutover, restore, hold, deletion, and rollback risks remain? |
| `H14` | Observability/reconstructability | Are mandatory events, correlations, metrics, and safe diagnostics complete? |

No aggregate healthy Boolean may collapse these dimensions. Liveness cannot imply readiness. Provider availability cannot imply semantic completeness. Freshness cannot imply correctness. A passing gate cannot be inferred from any operational state. Unknown or unobserved is not healthy.

Readiness is scoped to an operation class, security partition or source-owned not-applicable scope, publication channel where applicable, profile, and observation cutoff. A system can be read-ready for one verified historical publication and not write-ready for new analysis; that distinction is exposed.

Health remains conceptually reportable during bootstrap, no-current-binding, binding-unavailable, binding-corrupt, restore, migration, and recovery states through the non-content `HealthObservationView` defined in §9.1. Those states do not select a historical publication as current and do not permit semantic traversal.

The fourteen operational dimensions do not redefine the five preserved `JAN-CSAA-007@1.0.0` `HealthResponse` axes `providerExecutionHealth`, `capabilityCoverage`, `evidenceFreshness`, `findingState`, and `laterGateOutcome`. Within the finite-W3 semantic baseline, the affected candidate adds H01–H14 as independently carried `operationalDimensions` and closes `HealthObservationView.binding` as `committed-publication-vector`, `no-current-binding`, `binding-unavailable`, or `binding-corrupt`, without an aggregate healthy Boolean or a traversable semantic-content reference in a non-content branch. Historical `JAN-CSAA-009-A007-HLT-GAP-001` is reconciled only at candidate documentation level; no schema is enforced and no runtime health result exists. `subjectInput=not-applicable` remains limited to its registered operation-policy reason, and absence of an effective RGP remains reasoned `not-applicable` in `laterGateOutcome`, never pass, fail, healthy, or satisfied.

### 22.3 Metrics, traces, and logs

Metrics cover:

- request, queue, admission, service, publication, query, and end-to-end latency;
- queue depth/age, fairness, shedding, backpressure, retries, cancellation, timeouts, failures, and resource refusal;
- CPU, memory, disk, file/process/output counts, I/O, network when authorized, and temporary material;
- cache hit/miss/admission rejection/invalidation/eviction, invalidation closure, reuse, recompute, and clean-full comparison;
- candidate-lifecycle counts and age, sealed-content counts and size, lifecycle-to-sealed-content correlation, validation time, publication conflicts, uncertain commits, predecessor visibility, and orphan cleanup without exposing protected identifiers;
- current/stale/partial/unsupported/conflicting populations and age;
- integrity checks, corruption, repair, backup, restore, migration, rollback, retention, deletion, GC, and residual loss; and
- read/write/recovery/security readiness and every independent health dimension.

Telemetry binds exact profile, subject/partition class, operation, method/version, time window, sampling/aggregation, units, cardinality, omissions, redaction, retention, and collector health. It cannot contain unrestricted protected data or serve as the only audit/semantic evidence.

### 22.4 Six workload-class measurement contracts
| Class | Workload | Mandatory measurement dimensions |
| --- | --- | --- |
| `W01` | Initial full repository analysis | Subject/project/artifact size; capabilities; elapsed/queue time; CPU/memory/disk/output; provider and publication health |
| `W02` | Incremental reanalysis | Change-set size; dependency/invalidation closure; reused/revalidated/recomputed populations; eight-dimensional equivalence; elapsed/resources |
| `W03` | Execution-evidence ingestion | Artifact size/count; validation/correlation; rejected/quarantined observations; evidence-set publication; resource use |
| `W04` | Snapshot publication | Candidate/partition size; validation/sealing; conflicts; linearization; predecessor visibility; audit completion |
| `W05` | Interactive query | Publication/view size; traversal breadth/depth; result/page size; authorization/redaction; latency; cancellation; resource use |
| `W06` | Cross-snapshot comparison | Every exact identity; changed fact/edge populations; lineage confidence; compatibility; redaction; latency/resources |

Numeric performance, retention, capacity, retry, encryption, recovery-point, and recovery-time thresholds require an identified owner, scope, environment, measurement method, evidence, and later authority. This Draft invents none. A profile with no safe finite resource bound refuses unbounded work rather than assuming infinite capacity.

## 23. Degradation and no-false-green closure

### 23.1 Twenty-by-eight matrix

Each exact `JAN-CSAA-006-DEG-001` through `020` degradation class is evaluated across the eight result surfaces below. The table carries 160 explicit cells. `NFG` means the injected condition must remain visible and must block any unqualified current/complete/healthy/satisfied/conformant/safe/approved/waived representation on that surface. A future source-owned `N/A(reason)` may replace `NFG` only with an exact applicability proof and 008 verification.
| Class | Injected condition | Capability/analysis | Query/slice/comparison/impact | Semantic/graph | Rule/finding/treatment | Gate template/evaluation | Operation/health | Publication/currentness/recovery | Fixture/oracle/conformance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `JAN-CSAA-006-DEG-001` | unsupported construct or semantic context | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-002` | excluded region | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-003` | not-analyzed region | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-004` | partial result | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-005` | provider or analysis failure | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-006` | timeout | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-007` | cancellation | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-008` | resource exhaustion or budget refusal | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-009` | malformed output | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-010` | stale result | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-011` | incompatible comparison basis | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-012` | conflicting result | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-013` | redacted material | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-014` | access denial | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-015` | truncation or pagination cutoff | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-016` | broken source or generated mapping | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-017` | unavailable or unqualified provider | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-018` | mixed revision or subject mismatch | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-019` | interrupted index or stale cache | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |
| `JAN-CSAA-006-DEG-020` | empty or vacuous output | NFG | NFG | NFG | NFG | NFG | NFG | NFG | NFG |

### 23.2 Operational aggregation rule

Failure of a prerequisite cannot become successful emptiness in a dependent capability. Aggregation retains each child's support, health, freshness, partiality, conflict, authorization, qualification, and execution state. One successful child cannot hide one failed or ineligible child. Redaction, omission, timeout, cancellation, resource pressure, provider fallback, or stale cache cannot coerce the aggregate to green.

## 24. Deterministic replay, reconciliation, and reconstructability

### 24.1 Replay manifest

Before replay or deterministic rebuild execution, the realization creates one immutable `ReplayBasisManifestRecord` identified by exact `replayBasisManifestId` from the §7.4 self-excluding canonical preimage. It is distinct from `AnalysisPlanRecord`, `attemptId`, `repairExecutionId`, every output, and any resulting publication candidate. It contains only already-finalized inputs and influences and expressly excludes the same attempt's future outputs, `publicationCandidateId`, Publication Manifest, publication decision, audit completion, health completion, and output-complete `replayManifestId`. Any changed input or influence set creates a new basis identity rather than mutating a prior basis.

The replay-basis manifest binds every semantically material pre-execution influence:

- exact subject, repository/worktree/change-set, content, project, toolchain, framework, generated context, and evidence-set identities;
- contract, schema, generated derivative, semantic-owner, capability, query, rule/profile, fixture/oracle, provider/adapter/method/model, and configuration versions;
- authorization, information-control, redaction, retention, egress, and secret-reference versions;
- exact `operationalProfileInstantiationId`, partition, storage format, migration epoch, current-binding generation, scheduling and concurrency policy;
- raw inputs, normalization transforms, dependency manifest, invalidation closure, reuse/recompute manifest, and checkpoints;
- environment, platform, locale, clock, randomness, ordering, parallelism, resource budgets, timeouts, retry, and cancellation behavior; and
- every predeclared omission, unsupported region, redaction, and allowed-difference policy.

After the exact output set is finalized, one immutable `ReplayManifestRecord` identified by `replayManifestId` from the §7.4 self-excluding canonical preimage binds its exact `replayBasisManifestId`, `attemptId`, actual omissions/failures/conflicts, exact outputs, aggregate digests, resulting `candidateLifecycleId` and `publicationCandidateId` when applicable, Publication Manifest, and only already-finalized audit/health observation identities whose own preimages are independent of this replay manifest. The output-complete record is never referenced by the same candidate, Publication Manifest, replay basis, output, audit event, or health observation whose identity contributes to its own preimage; it may be referenced only by a later acyclic response, audit/health completion, or downstream derivative outside that reported output set. Any changed output or admissible observation set creates a new output-complete manifest identity rather than mutating a prior record.

Replay produces a new attempt and observations. It never overwrites the original or claims the original effect did not occur.

### 24.2 Reconciliation classes

Reconciliation compares:

| Class | Required comparison |
| --- | --- |
| Publication | Durable intent, candidate, expected predecessor, current binding, response, and audit |
| External effect | Stable effect identity, provider/system observation, attempt history, and compensation/retry state |
| Cache/index | Authoritative basis, dependency manifest, transform, admitted state, and stored derivative |
| Backup/restore | Backup cutoff, restored inventory, later actions, prospective current binding, and policy state |
| Migration | Source/target inventory, changes since checkpoint, semantic/operational differences, routing, and rollback |
| Retention/deletion | Authorized population, every physical surface, holds, residual copies, and audit |
| Audit | Durable actions/intents versus recorded events, causation, and safe reconstructable gaps |

Unreconciled uncertainty remains explicit and blocks completion/currentness as applicable. A best-effort guess, newest timestamp, last writer, provider response, or process exit cannot resolve it.

## 25. Storage and orchestration alternatives

### 25.1 Authority boundary

`JAN-CSAA-001` allocates comparison of three storage and three orchestration alternatives to this design, but the current commission prohibits selecting a physical mechanism. This section refines the comparison and preserves all six alternatives as open. Any recommendation is a non-authoritative hypothesis and cannot become a selection without later evidence and an applicable decision.

### 25.2 Six-alternative register
| ID | Alternative | Strongest case | Strongest opposing case | Current disposition |
| --- | --- | --- | --- | --- |
| `STO-A` | Immutable snapshot bundles plus transactional catalog | Revision isolation, exportability, raw provenance | Multi-location atomicity, derived-index closure, compaction lineage | No selection; require atomicity/recovery/integrity experiment |
| `STO-B` | Version-partitioned semantic graph plus append-only evidence ledger | Direct graph traversal and impact queries | Destructive upsert, cross-partition leakage, portability/retention complexity | No selection; require isolation/upsert/raw-ledger divergence experiment |
| `STO-C` | Append-only fact log plus rebuildable projections | Replay, temporal history, replaceable projections | Projection lag, rebuild cost, schema evolution, log retention | No selection; require deterministic rebuild/lag/corruption experiment |
| `ORC-A` | Embedded deterministic DAG coordinator | Local/offline posture, low operational burden, deterministic schedule | Crash durability, long-running recovery, host blast radius, elasticity | No selection; require restart/cancellation/resource experiment |
| `ORC-B` | Durable job/claim coordinator | Explicit retry, liveness, crash recovery, backpressure, elasticity | Duplicate delivery, stale claim, service/credential surface, topology coupling | No selection; require claim/fencing/duplicate/recovery experiment |
| `ORC-C` | Two-speed foreground/background model | Interactive provisional latency plus background publishable analysis | Dual truth, stale foreground, promotion race, duplicated work | No selection; require lane identity/reconciliation/promotion experiment |

### 25.3 Nine common decision criteria
| Criterion | Required comparison surface |
| --- | --- |
| `C01` | Exact subject binding and mixed-revision prevention |
| `C02` | Atomic publication and predecessor visibility |
| `C03` | Raw provenance and provider-disagreement retention |
| `C04` | Confidentiality, offline use, isolation, and least privilege |
| `C05` | Cancellation, timeout, crash recovery, and deterministic replay |
| `C06` | Full/incremental equivalence and invalidation safety |
| `C07` | Query latency and whole-repository throughput |
| `C08` | Operational complexity, portability, retention, export, and provider removal |
| `C09` | Independent verification of failure paths without implementation self-attestation |

The inherited seven grouped comparison columns remain presentation groupings only; the nine criteria above are the complete independently accountable population.

### 25.4 Decision-evidence packet

A future authority-bearing storage or orchestration decision requires:

1. exact alternatives and versions compared, including a reasoned search for a stronger alternative;
2. one operational profile per candidate with every `O01`–`O30` facet;
3. exact workload/subject/security/environment/budget identities;
4. conferred or otherwise admissible test/oracle basis;
5. independently executed publication, mixed-revision, invalidation, clean-full, cache, concurrency, crash, corruption, backup, migration, retention, security, removal, and performance evidence;
6. every `C01`–`C09` result with uncertainty and residual risk;
7. strongest opposing case, failure modes, vendor/provider lock-in, portability, licensing/procurement, cost, and removal treatment;
8. safe default, rollout, cutover, fallback, rollback, and exit criteria;
9. independent architecture, security, operations, V&V, and integrity review; and
10. applicable final decision authority and exact recorded disposition.

No experiment is authorized by this section. A later experiment must separately name tools, dependencies, files, writes, network, credentials, data, cleanup, evidence limits, and authority.

## 26. Logical-operation and executable-verification handoff

### 26.1 Seventeen-operation operational mapping

The operation identities, inputs, outputs, state union, authorization shapes, and typed errors remain owned by `JAN-CSAA-007`; verification method remains owned by `JAN-CSAA-008`. This design supplies only operational behavior:
| Operation | Operational behavior | Prohibited implication | Cache-admission-failure behavior |
| --- | --- | --- | --- |
| `csaa.contract.negotiate` | Read-only compatibility evaluation | No subject; no implicit migration or format change | Evaluate exact offer/package; cache policy cannot select a version |
| `csaa.subject.describe` | Read-only subject resolution with bounded acquisition evidence | No repository mutation, script execution, or invented identity | Perform authorized read-only resolution or exact subject outcome; no analysis |
| `csaa.snapshot.get` | Snapshot-pinned read of exact Publication Manifest | No current-pointer following after view acquisition | Read exact requested publication/current binding or exact non-success; no reanalysis |
| `csaa.analysis.plan` | Immutable plan construction | No analysis execution or publication by implication | Construct plan from authoritative inputs or fail exactly; no execution |
| `csaa.analysis.start` | Separately authorized work admission | Durable acceptance/idempotency/channel binding per profile | Use durable request state; admit new work only under separate request authority |
| `csaa.analysis.status` | Pinned authorized observation of exact live/final target | Concurrency token and state revision enforced | Read exact durable target or lifecycle/unavailable outcome; no new attempt |
| `csaa.analysis.cancel` | Cooperative cancellation request | Actual effect, propagation, cleanup, and late ordering recorded | Resolve exact live target and record cancellation/lifecycle outcome; no new attempt |
| `csaa.query.execute` | Snapshot-pinned bounded query | No implicit reanalysis or mixed-revision continuation | Evaluate pinned authoritative publication or exact non-success; no implicit reanalysis |
| `csaa.slice.compute` | Snapshot-pinned bounded slice | Explicit frontier, partiality, budget, and cancellation | Compute against pinned publication or exact non-success |
| `csaa.comparison.compute` | Explicit multi-subject comparison | Each lane separately authorized, versioned, and labeled | Compare only exact named publication vectors or exact non-success |
| `csaa.impact.compute` | Exact change-seed propagation | Dependency closure, invalidation, and unresolved frontier retained | Compute from exact seed/dependency basis/pinned publication; no implicit refresh |
| `csaa.finding.get` | Authorized immutable finding/history projection | No disposition, suppression, exception, or gate mutation | Retrieve exact authorized finding or not-found/refusal/unavailable; no analysis |
| `csaa.finding.list` | Authorized pinned page over exact finding population | Continuation remains bound to same view and redaction | Query pinned finding population or exact non-success; no analysis |
| `csaa.raw.get` | Authorized retrieval of exact raw material | Information control, retention, integrity, and non-disclosure enforced | Retrieve exact authorized raw material or refusal/unavailable; no regeneration |
| `csaa.fixture.describe` | Read-only fixture/oracle-standing projection | No fixture creation, execution, or oracle conferral | Read exact standing or non-success; no creation, execution, or conferral |
| `csaa.gate.evaluate` | Reserved future operation | Current baseline refuses because no effective RGP exists | Preserve no-effective-RGP refusal; cache state cannot create a gate |
| `csaa.health.get` | Read-only multidimensional health projection | No collapsed healthy Boolean or semantic/gate inference | Return current-version representable health or exact non-success; never invent currentness or wire fields |

The exact 17 valid operation/input pairings and 272 invalid cross-pairings remain as specified by 007/008. Operational dispatch never repairs an invalid pairing, invents a subject, widens authorization, or coerces a typed error into a success result.

### 26.2 Validation and typed-error behavior

All seven `V01` through `V07` stages and all 77 typed errors across their twenty-five exact `JAN-CSAA-007@1.0.0` families remain closed candidate inputs. Operational persistence records each stage outcome and makes downstream material inert after a required stage failure unless a contract explicitly permits bounded partial continuation. Recovery can resume or rerun validation, but cannot retroactively make an earlier required failure pass.

Every error path preserves exact state/outcome compatibility, safe details, redaction/non-disclosure, retry class, affected partition/stage, current-publication consequence, and audit/recovery allocation. An unknown internal failure maps to a safe non-green typed outcome; it never falls through to success.

The operational failure-to-007 registry is exact and closed against the candidate mappings in `JAN-CSAA-007@1.0.0`; every runtime outcome remains unexecuted:
| Operational class | Exact `JAN-CSAA-007@1.0.0` candidate mapping | Documentation closure state |
| --- | --- | --- |
| `OPS-F01` | `CSAA-E-REQUEST-MALFORMED`; `CSAA-E-REQUEST-UNSUPPORTED-OPERATION`; `CSAA-E-REQUEST-UNSUPPORTED-OPERATION-VERSION`; `CSAA-E-REQUEST-INVALID-PARAMETER`; `CSAA-E-AUTH-UNAUTHENTICATED`; `CSAA-E-AUTH-UNAUTHORIZED`; `CSAA-E-AUTH-SCOPE-MISMATCH`; `CSAA-E-AUTH-REDACTION-REFUSED` | Covered only when the exact request or access distinction matches |
| `OPS-F02` | `CSAA-E-SUBJECT-UNIDENTIFIED`; `CSAA-E-SUBJECT-UNAVAILABLE`; `CSAA-E-SUBJECT-STALE`; `CSAA-E-SUBJECT-MIXED-REVISION`; `CSAA-E-SUBJECT-SNAPSHOT-MISMATCH`; `CSAA-E-SUBJECT-EVIDENCE-SET-MISMATCH`; `CSAA-E-SUBJECT-WORKTREE-MISMATCH` | Covered for the exact registered subject distinction |
| `OPS-F03` | The preserved configuration/evidence codes when exact; `CSAA-E-CONFIG-OPERATIONAL-CONTEXT-STALE` for the historical GAP-001 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F04` | The preserved provider codes when exact; `CSAA-E-PROVIDER-QUALIFICATION-NONPASS` for the historical GAP-002 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F05` | `CSAA-E-EXECUTION-TIMED-OUT`; `CSAA-E-EXECUTION-CANCELLED`; `CSAA-E-EXECUTION-RESOURCE-EXHAUSTED`; `CSAA-E-EXECUTION-BUDGET-REFUSED` | Covered for the exact registered execution distinction |
| `OPS-F06` | The preserved lifecycle/capability codes when exact; `CSAA-E-LIFECYCLE-OPERATIONAL-BASIS-UNRESOLVED` for the historical GAP-003 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F07` | The preserved validation/lifecycle codes when exact; `CSAA-E-PUBLICATION-GENERATION-CONFLICT` for the historical GAP-004 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F08` | `CSAA-E-PUBLICATION-OUTCOME-UNKNOWN` for the historical GAP-005 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F09` | The preserved validation/configuration codes when exact; `CSAA-E-INTEGRITY-MATERIAL-NONPASS` for the historical GAP-006 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F10` | The preserved comparison/validation codes when exact; `CSAA-E-MIGRATION-EXECUTION-NONPASS` for the historical GAP-007 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F11` | The preserved subject/result codes when exact; `CSAA-E-MATERIAL-LIFECYCLE-ACTION-NONPASS` for the historical GAP-008 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F12` | The preserved authorization codes when exact; `CSAA-E-SECURITY-CONTROL-NONPASS` for the historical GAP-009 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F13` | `CSAA-E-AUDIT-DURABILITY-FAILED` for the historical GAP-010 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F14` | The preserved result codes when exact; `CSAA-E-EXTERNAL-EFFECT-OUTCOME-UNKNOWN` for the historical GAP-011 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F15` | The preserved authorization/subject codes when exact; `CSAA-E-ISOLATION-BASIS-MISMATCH` for the historical GAP-012 distinction | `CANDIDATE_CODE_AND_SAFE_PAYLOAD_RECONCILED / NOT_IMPLEMENTED / NOT_RUN` |
| `OPS-F16` | `CSAA-E-INTERNAL-UNEXPECTED` | Covered only as opaque safe unexpected failure; it cannot erase a known registered code-specific distinction or safe payload |

Each `JAN-CSAA-009-A007-ERR-GAP-*` identity remains a historical versioning-gap trace identity, never a typed error code and never permission to use an implementation-selected string. Exact `JAN-CSAA-007@1.0.0` supplies all twelve stable codes and code-discriminated safe payloads. A realization must serialize only the exact registered code and payload for the applicable distinction; it cannot serialize a gap identity or coerce it into a neighboring code. `CSAA-E-INTERNAL-UNEXPECTED` remains only its registered opaque fallback and cannot erase a known publication, corruption, migration, retention, security, audit, effect-uncertainty, or isolation distinction.

### 26.3 Exact 008 affected-reconciliation result and remaining nonpasses

Within the immutable predecessor reconciliation, exact `JAN-CSAA-008@0.2.1` and its closed evidence package cover the following affected documentation populations against `JAN-CSAA-009@0.1.0`. The coverage is specification and allocation evidence only; the rightmost column remains nonpass:

The 008 local-catalog transition is exact: 813 historical rows become 999 semantic-cutoff rows through 804 unchanged IDs, nine revised obligation texts, 186 additions, and zero removals. The additions are WIR 28, OPR 32, OID 30, PUB 28, RCV 34, HLT 18, and PHS 16. No added or revised row is an execution result.

| 008 population | Operational binding supplied here | Still nonpass |
| --- | --- | --- |
| 17 operations; 17 valid and 272 invalid pairings | §26.1 operation behavior, pinned views, authorization, idempotency, cancellation | Executable cases not run |
| Seven validation stages and 77 typed errors | §26.2 persistence, recovery, safe error, and retry treatment plus exact 007 affected mappings | Executable fault paths not run |
| 18 incremental mutation classes × 8 dimensions = 144 assessments | §§10–12 dependency, reuse, recomputation, cache, and equivalence | Incremental/full execution not run |
| 20 hostile classes | §21.4 operational containment | Hostile materialization/execution not run |
| 20 degradation classes × 8 surfaces = 160 cells | §23 closed non-green matrix | Failure injection not run |
| 16 recovery points | §16 exact topology-neutral bindings and profile-to-injection protocol | Recovery execution not run |
| Six workload classes | §22.4 measurement contracts and owner-supplied budgets | Performance measurement not run |
| Compatibility and migration | §19 physical migration, dual-run, cutover, fallback, rollback | Migration execution not run |

The archived `JAN-CSAA-008@0.1.1` statements that 009 was not authored remain correct historical lifecycle evidence. Exact `JAN-CSAA-008@0.2.1` is the semantic affected successor against `JAN-CSAA-009@0.1.0`, and predecessor `JAN-CSAA-009@0.2.0` records that finite evidence edge. Exact `JAN-CSAA-W3-TRIPLET-RECONCILIATION-001@0.1.0` subsequently reconciled the predecessor triplet. This `JAN-CSAA-009@0.2.1` correction does not float, reinterpret, or rewrite that exact operational-semantic binding.

### 26.4 Mandatory phase-identity and digest-cycle negative cases
| Case | Negative condition | Injection | Required outcome |
| --- | --- | --- | --- |
| `JAN-CSAA-009-TST-PHASE-001` | Premature candidate identity | An `ABSENT` or `ASSEMBLING` lifecycle revision contains `publicationCandidateId` | Reject as phase-invalid; no publication or historical rewrite |
| `JAN-CSAA-009-TST-PHASE-002` | Backfilled candidate identity | A post-seal action rewrites a pre-seal lifecycle revision to add the later `publicationCandidateId` | Reject as immutable-history and integrity failure |
| `JAN-CSAA-009-TST-PHASE-003` | Lifecycle content rebinding | One `candidateLifecycleId` is rebound from its sealed `publicationCandidateId` to different content | Reject as lifecycle collision; preserve original terminal lineage |
| `JAN-CSAA-009-TST-PHASE-004` | Self-inclusive content digest | A content identifier field is blanked, zeroed, provisionally populated, or included in the canonical preimage used to derive itself | Reject as noncanonical/circular identity construction |
| `JAN-CSAA-009-TST-PHASE-005` | Output-dependent replay basis | A `replayBasisManifestId` preimage includes the same attempt's output, resulting candidate/manifest/decision, completion observation, or output-complete replay manifest | Reject as future-dependent/circular basis |
| `JAN-CSAA-009-TST-PHASE-006` | Same-output replay completion cycle | A `replayManifestId` preimage includes an output, candidate, Publication Manifest, audit event, or health observation that directly or transitively depends on that same `replayManifestId` | Reject as cyclic completion identity; later correlating records remain outside the preimage |

Each case is independently executable and independently reported. Passing one case cannot stand in for another, and ordinary publication/replay success cannot mask a negative-case failure.

## 27. Cross-package handoffs and open gaps

### 27.1 Required handoffs
| Owner | Handoff | Current state |
| --- | --- | --- |
| `JAN-CSAA-002` | Preserve its meanings for identity, current, last-known-good, stale, invalidated, immutable history, epistemic state | No 002 change requested by this Draft |
| `JAN-CSAA-003` | Preserve logical dependency/invalidation and eight-dimensional equivalence; receive operational-evidence design | Actual operational equivalence evidence remains unexecuted |
| `JAN-CSAA-004` | Preserve provider failure/disagreement, immutable finding/treatment history, inert templates, and no false green | No rule/profile/gate/provider standing changes |
| `JAN-CSAA-005` | Treat implementation observations as dated only | Final consolidated implementation refresh remains mandatory |
| `JAN-CSAA-006` | Preserve 18 mutations, 20 degradation classes, fixture isolation, recovery, and non-conferred oracle state | No fixture or oracle execution |
| `JAN-CSAA-007` | Exact `JAN-CSAA-007@1.0.0` supplies the affected candidate representations for operational profile/observation, identity projections, lifecycle transitions, self-excluding content-identifier preimages, noncircular publication/replay references, publication/read vectors, cache basis, claims/checkpoints, recovery, backup/restore, physical migration, retention/GC, H01–H14 and no-current health standing, twelve operational error mappings, repair, and residual loss | Candidate documentation exists; executable schemas, generated derivatives, validators, adapters, accepted instances, and runtime evidence remain absent |
| `JAN-CSAA-008` | Exact `JAN-CSAA-008@0.2.1` supplies affected documentation for incremental, cache, concurrency, recovery, migration, security, capacity, fault coordinates, operational wire bindings, and all six mandatory phase-identity/digest-cycle negative cases against `JAN-CSAA-009@0.1.0` | Documentation reconciliation exists; every physical case, executable artifact, oracle judgment, and result remains not created or not run |
| `JAN-CSAA-010` | Consume exact operational health, currentness, request, cancellation, retry, and stop/escalation surfaces | Later documentation not authored |
| `JAN-CSAA-011` | Qualify concrete analyzer provider/adapter choices, versions, licensing, installation, configuration, substitution, and removal | No provider selected; storage/orchestration/topology remain with applicable architecture/operations authority and security controls remain with applicable security authority |
| Implementation authority | Instantiate one exact operational profile and build only later separately authorized artifacts | Not authorized |
| Independent oracle and V&V owners | Confer exact judgments and execute 008 cases against exact implementation subject | Not conferred / not run |
| Final corpus sponsor and recorder | Review and dispose exact full corpus only after all lifecycle prerequisites | Final review absent |

### 27.2 Open operational gaps

The following are deliberate open states, not implementation selections:

| Gap | Safe current treatment | Closure owner or evidence |
| --- | --- | --- |
| Executable operational wire artifacts absent despite exact 007 candidate shapes | Preserve `JAN-CSAA-007@1.0.0` as non-enforced documentation; do not fabricate schemas, generated types, validators, adapters, or instances | Separate artifact authorization, implementation, validation, and 008 conformance |
| Predecessor and corrective finite-set reconciliation | Exact `JAN-CSAA-W3-TRIPLET-RECONCILIATION-001@0.1.0` is issued and reconciles `JAN-CSAA-007@1.0.0`, `JAN-CSAA-008@0.2.1`, and `JAN-CSAA-009@0.2.0`; preserve it as immutable historical evidence. The three correction-only successors require a new append-only exact reconciliation after their own source, ledger, objective, and closure-integrity evidence closes; do not reinterpret W3, force reciprocal semantic chasing, or treat corrective documentation deltas as execution | Append-only corrective triplet reconciliation and exact successor evidence packages |
| Concrete storage and orchestration | Keep all six alternatives open | Separate evidence and applicable decision authority |
| Concrete provider/adapter set | Preserve failure/partial/unsupported behavior | 011 qualification |
| Concrete deployment topology | Treat planes as logical; select none | Later operational profile and authority |
| Numeric latency/capacity/RPO/RTO/retention/retry limits | Require owner-supplied finite budgets; invent none | Measurement and decision owner |
| Encryption algorithms and key management | Require exact property/profile; select no product | Security design/review and implementation authority |
| Tenant applicability | Require exact applicability decision in profile | Operational/security owner |
| Dual-write use | Do not presume; require explicit design and tests if selected | Migration authority and 008 |
| Physical backup/restore | Specify contract only | Separately authorized implementation and recovery tests |
| Executable failure injection | Specify topology-neutral mapping only | 008 plus separately authorized executor |
| Implementation currentness | Make no claim from dated 005 observations | Final consolidated refresh |
| Full Wave 3 exit | Remain nonpass because no artifacts/tests/execution exist | Separate executable commission and evidence |

## 28. Normative requirement catalog

Requirement identifiers are permanent within `JAN-CSAA-009`. Retirement creates a successor treatment and never reuses an identifier. Every row contains one atomic deontic clause. The requirement ledger preserves bidirectional bindings to all inherited source obligations and every row below.

### 28.1 Control, lifecycle, authority, and nonperformance

| ID | Requirement |
| --- | --- |
| `CSAA-009-CTL-001` | This document SHALL remain a non-authoritative Draft until its exact lifecycle prerequisites and later conferral are satisfied. |
| `CSAA-009-CTL-002` | This document SHALL remain documentation-only under the current commission. |
| `CSAA-009-CTL-003` | This document SHALL NOT select a persistence engine. |
| `CSAA-009-CTL-004` | This document SHALL NOT select a graph database. |
| `CSAA-009-CTL-005` | This document SHALL NOT select a queue or scheduler. |
| `CSAA-009-CTL-006` | This document SHALL NOT select a locking or transaction technology. |
| `CSAA-009-CTL-007` | This document SHALL NOT select a deployment topology. |
| `CSAA-009-CTL-008` | This document SHALL NOT select or qualify an analyzer provider. |
| `CSAA-009-CTL-009` | This document SHALL NOT create a schema, generated type, fixture, test, database, service, migration, backup, or runtime result. |
| `CSAA-009-CTL-010` | This document SHALL NOT instantiate an Analysis Rule Profile binding. |
| `CSAA-009-CTL-011` | This document SHALL NOT instantiate a Repository Gate Profile. |
| `CSAA-009-CTL-012` | This document SHALL NOT confer an oracle, exception, waiver, approval, decision, Baseline, or gate effect. |
| `CSAA-009-CTL-013` | This document SHALL preserve every later executable predicate as nonpass absent its own authorized evidence. |
| `CSAA-009-CTL-014` | This document SHALL distinguish documentation-subphase completion from executable Wave 3 exit. |
| `CSAA-009-CTL-015` | This document SHALL preserve final full-corpus sponsor review as a later exact-corpus action. |
| `CSAA-009-CTL-016` | This document SHALL preserve a final consolidated implementation refresh before exact-corpus freeze. |
| `CSAA-009-CTL-017` | This document SHALL use current filesystem bytes, hashes, links, and invariants as the bounded authoring evidence surface. |
| `CSAA-009-CTL-018` | This document SHALL NOT use Git state as a currentness or concurrency signal for the exclusively owned documentation subtree. |
| `CSAA-009-CTL-019` | A material Draft change SHALL receive affected objective verification and later review. |
| `CSAA-009-CTL-020` | A Proposed-byte change SHALL receive affected re-review under the governing lifecycle. |
| `CSAA-009-CTL-021` | An operational action SHALL NOT create semantic or governance authority. |
| `CSAA-009-CTL-022` | An operational result SHALL retain its exact non-authoritative technical standing. |
| `CSAA-009-CTL-023` | A prohibited scope expansion SHALL invalidate this Draft's objective closure. |
| `CSAA-009-CTL-024` | Every historical initial-state table SHALL remain explicitly distinguishable from a current successor ledger state. |
| `CSAA-009-CTL-025` | Every future implementation action SHALL require separate applicable authority. |

### 28.2 Concern ownership and role separation

| ID | Requirement |
| --- | --- |
| `CSAA-009-OWN-001` | `JAN-CSAA-002` SHALL retain semantic identity, lifecycle, freshness-state, provenance, and epistemic ownership. |
| `CSAA-009-OWN-002` | `JAN-CSAA-003` SHALL retain capability, query, slice, comparison, impact, logical invalidation, and observational-equivalence ownership. |
| `CSAA-009-OWN-003` | `JAN-CSAA-004` SHALL retain rule, result, finding, treatment, exception, provider-obligation, and gate ownership. |
| `CSAA-009-OWN-004` | `JAN-CSAA-005` SHALL retain dated repository-description ownership only. |
| `CSAA-009-OWN-005` | `JAN-CSAA-006` SHALL retain fixture-case and proposed expected-judgment strategy. |
| `CSAA-009-OWN-006` | `JAN-CSAA-007` SHALL retain serialization, operation-envelope, error, compatibility, and adapter-shape ownership. |
| `CSAA-009-OWN-007` | `JAN-CSAA-008` SHALL retain conformance and verification-and-validation method ownership. |
| `CSAA-009-OWN-008` | `JAN-CSAA-009` SHALL own physical persistence, publication, invalidation execution, recomputation, cache, scheduling, concurrency, cancellation, recovery, migration, retention, query-authorization/access enforcement, security-control operation, audit, readiness, capacity, telemetry, and operations behavior. |
| `CSAA-009-OWN-009` | `JAN-CSAA-010` SHALL retain coding-agent employment ownership. |
| `CSAA-009-OWN-010` | `JAN-CSAA-011` SHALL retain concrete analyzer provider, tool, and adapter qualification, bounded-role selection, licensing, installation, provider-specific sandboxing/security review, operation, substitution, and removal ownership. |
| `CSAA-009-OWN-011` | Canon SHALL retain professional assurance, admissibility, decision, waiver, approval, and Baseline ownership. |
| `CSAA-009-OWN-012` | A physical operation SHALL NOT redefine a concern-owned semantic value. |
| `CSAA-009-OWN-013` | A persisted operational status SHALL NOT replace a rule, finding, treatment, exception, or gate state. |
| `CSAA-009-OWN-014` | An implementation SHALL NOT use operational convenience to overwrite shape ownership. |
| `CSAA-009-OWN-015` | A new serialized operational concept SHALL be allocated to an affected `JAN-CSAA-007` successor. |
| `CSAA-009-OWN-016` | An executable operational case SHALL remain allocated to `JAN-CSAA-008`. |
| `CSAA-009-OWN-017` | A provider substitution SHALL remain subject to `JAN-CSAA-011` qualification. |
| `CSAA-009-OWN-018` | An oracle judgment SHALL remain independently owned from implementation and provider execution. |
| `CSAA-009-OWN-019` | A storage or orchestration decision SHALL remain with its later applicable decision authority. |
| `CSAA-009-OWN-020` | Every cross-package handoff SHALL identify owner, exact input, boundary, current nonperformance, and later verification. |

### 28.3 Exact source intake and inherited allocation

| ID | Requirement |
| --- | --- |
| `CSAA-009-SRC-001` | The Draft SHALL bind `JAN-CSAA-000@0.3.0` by exact identity, bytes, and digest. |
| `CSAA-009-SRC-002` | The Draft SHALL bind `JAN-CSAA-001@0.3.0` by exact identity, bytes, and digest. |
| `CSAA-009-SRC-003` | The Draft SHALL bind `JAN-CSAA-002@0.3.0` by exact identity, bytes, and digest. |
| `CSAA-009-SRC-004` | The Draft SHALL bind `JAN-CSAA-003@0.1.0` by exact identity, bytes, and digest. |
| `CSAA-009-SRC-005` | The Draft SHALL bind `JAN-CSAA-004@0.1.0` by exact identity, bytes, and digest. |
| `CSAA-009-SRC-006` | The Draft SHALL bind `JAN-CSAA-005@0.3.0` by exact identity, bytes, and digest. |
| `CSAA-009-SRC-007` | The Draft SHALL bind `JAN-CSAA-006@0.1.0` by exact identity, bytes, and digest. |
| `CSAA-009-SRC-008` | The successor SHALL bind exact affected source `JAN-CSAA-007@1.0.0`, 1,340,805 bytes, and SHA-256 `e6f635ca42e5d74cbe0ec942a4f6b7793fa15e54acca1098be62e8086dee8e5e`. |
| `CSAA-009-SRC-009` | The successor SHALL bind exact affected source `JAN-CSAA-008@0.2.1`, 257,899 bytes, and SHA-256 `45df0e0ae04ec0ece60d5f560c90c396de9bd92950029050490317a09b43e45b`. |
| `CSAA-009-SRC-010` | The Draft SHALL bind the Wave 3 entry record by exact identity, bytes, and digest. |
| `CSAA-009-SRC-011` | The successor SHALL bind exact `JAN-CSAA-007-LEDGER-001@1.0.1`, `JAN-CSAA-007-VERIFICATION-001@0.2.0`, and `JAN-CSAA-007-LEDGER-CLOSURE-INTEGRITY-001@0.2.0` identities, bytes, and digests. |
| `CSAA-009-SRC-012` | The successor SHALL bind exact `JAN-CSAA-008-LEDGER-001@0.2.2`, `JAN-CSAA-008-VERIFICATION-001@0.2.1`, and `JAN-CSAA-008-LEDGER-CLOSURE-INTEGRITY-001@0.2.0` identities, bytes, and digests. |
| `CSAA-009-SRC-013` | The ledger SHALL carry all 28 direct adopted 009 obligations `CSAA-000-REQ-499` through `526`. |
| `CSAA-009-SRC-014` | The ledger SHALL carry Wave 3 rows `CSAA-000-REQ-659` through `661` with executable predicates nonpass. |
| `CSAA-009-SRC-015` | The ledger SHALL carry all 3,796 predecessor local-catalog rows from exact current `JAN-CSAA-001` through `JAN-CSAA-008` sources individually. |
| `CSAA-009-SRC-016` | The ledger SHALL carry all 53 direct Canon rows individually with explicit applicability. |
| `CSAA-009-SRC-017` | The ledger SHALL carry all 53 Wave 3 readiness rows with explicit applicability. |
| `CSAA-009-SRC-018` | The ledger SHALL preserve exactly 3,933 inherited rows decomposed as 31 direct adopted-program rows, 3,796 predecessor local-catalog rows, 53 direct Canon rows, and 53 Wave 3 readiness rows before local 009 requirements. |
| `CSAA-009-SRC-019` | The Draft SHALL treat Status 009 as exact pre-entry historical evidence rather than current authoring state. |
| `CSAA-009-SRC-020` | The Draft SHALL preserve all open predecessor findings and nonpass states until their own successors close them. |
| `CSAA-009-SRC-021` | A source identity change SHALL trigger affected intake and reconciliation before objective closure. |

### 28.4 Operational model and profile facets

| ID | Requirement |
| --- | --- |
| `CSAA-009-MOD-001` | A later operational profile SHALL resolve facet `O01` as Permanent profile identity, version, predecessor, lifecycle, owner, and exact definition digest. |
| `CSAA-009-MOD-002` | A later operational profile SHALL resolve facet `O02` as Exact governed document, contract-package, semantic-owner, implementation, and configuration identities. |
| `CSAA-009-MOD-003` | A later operational profile SHALL resolve facet `O03` as Supported repository, worktree, branch, snapshot, evidence-set, principal, tenant, and confidentiality perimeters. |
| `CSAA-009-MOD-004` | A later operational profile SHALL resolve facet `O04` as Deployment-independent component roles, trust crossings, side effects, and failure containment. |
| `CSAA-009-MOD-005` | A later operational profile SHALL resolve facet `O05` as Immutable material classes, authoritative source for each class, identity, digest, and finalization rules. |
| `CSAA-009-MOD-006` | A later operational profile SHALL resolve facet `O06` as Physical durability commitment for request, attempt, raw, normalized, candidate, publication, audit, and recovery material. |
| `CSAA-009-MOD-007` | A later operational profile SHALL resolve facet `O07` as Security-partition, publication-channel, candidate, operation, cache, read-view, and generation-guard projections with applicability and placement independence. |
| `CSAA-009-MOD-008` | A later operational profile SHALL resolve facet `O08` as Current-binding model, publication predecessor, fencing/concurrency token, and linearization proof. |
| `CSAA-009-MOD-009` | A later operational profile SHALL resolve facet `O09` as Candidate assembly, completeness, validation, sealing, refusal, orphan, and cleanup behavior. |
| `CSAA-009-MOD-010` | A later operational profile SHALL resolve facet `O10` as Read-view acquisition, page/stream continuation, comparison, and mixed-revision prevention. |
| `CSAA-009-MOD-011` | A later operational profile SHALL resolve facet `O11` as Dependency observation, invalidation event, conservative closure, broadening, and unresolved-dependency treatment. |
| `CSAA-009-MOD-012` | A later operational profile SHALL resolve facet `O12` as Incremental plan, reuse provenance, recomputation, clean-full equivalence, and allowed-difference policy. |
| `CSAA-009-MOD-013` | A later operational profile SHALL resolve facet `O13` as Cache and derived-index key, admission, validation, isolation, invalidation, eviction, and miss behavior. |
| `CSAA-009-MOD-014` | A later operational profile SHALL resolve facet `O14` as Concurrent reader, writer, publisher, invalidator, migrator, retention actor, and recovery interaction. |
| `CSAA-009-MOD-015` | A later operational profile SHALL resolve facet `O15` as Work claim, attempt, heartbeat or liveness observation, fencing, duplicate delivery, and stale-worker behavior. |
| `CSAA-009-MOD-016` | A later operational profile SHALL resolve facet `O16` as Admission, priority, fairness, backpressure, deadline, timeout, progress, and resource-budget behavior. |
| `CSAA-009-MOD-017` | A later operational profile SHALL resolve facet `O17` as Cancellation request, propagation, effective boundary, partial material, cleanup, and late-cancellation behavior. |
| `CSAA-009-MOD-018` | A later operational profile SHALL resolve facet `O18` as Retry classification, uncertainty reconciliation, idempotency key, attempt limits, delay policy, and terminal outcome. |
| `CSAA-009-MOD-019` | A later operational profile SHALL resolve facet `O19` as Crash and restart boundaries, durable checkpoints, startup reconciliation, abandoned work, and recovery ownership. |
| `CSAA-009-MOD-020` | A later operational profile SHALL resolve facet `O20` as Integrity verification, corruption classes, quarantine, blast-radius analysis, repair, rebuild, and residual loss. |
| `CSAA-009-MOD-021` | A later operational profile SHALL resolve facet `O21` as Backup set, consistency boundary, encryption, retention, restore isolation, validation, activation, and recovery objectives. |
| `CSAA-009-MOD-022` | A later operational profile SHALL resolve facet `O22` as Storage/contract migration inventory, compatibility, shadow/dual modes, reconciliation, cutover, rollback, and decommission. |
| `CSAA-009-MOD-023` | A later operational profile SHALL resolve facet `O23` as Retention policy, holds, archival, redaction, deletion, tombstone or unavailability evidence, and derivative inheritance. |
| `CSAA-009-MOD-024` | A later operational profile SHALL resolve facet `O24` as Garbage-collection roots, reachability proof, grace boundary, deletion authorization, race prevention, and audit. |
| `CSAA-009-MOD-025` | A later operational profile SHALL resolve facet `O25` as Authentication, authorization, least privilege, secret handling, encryption, key rotation, egress, and disclosure control. |
| `CSAA-009-MOD-026` | A later operational profile SHALL resolve facet `O26` as Audit event classes, safe payloads, correlation, causation, ordering, integrity, retention, and access. |
| `CSAA-009-MOD-027` | A later operational profile SHALL resolve facet `O27` as Health, readiness, liveness, freshness, integrity, backlog, capacity, dependency, and degraded-mode dimensions. |
| `CSAA-009-MOD-028` | A later operational profile SHALL resolve facet `O28` as Metrics, traces, logs, service-objective parameters, workload measurements, cardinality, redaction, and evidence retention. |
| `CSAA-009-MOD-029` | A later operational profile SHALL resolve facet `O29` as Storage/orchestration alternatives, unresolved decisions, safe defaults, experiment requirements, strongest opposing case, and exit criteria. |
| `CSAA-009-MOD-030` | A later operational profile SHALL resolve facet `O30` as Requirement trace, 008 conformance allocation, failure-injection matrix, implementation authority, review, and residual risks. |
| `CSAA-009-MOD-031` | A later realization SHALL preserve the `definition` plane as a distinct logical responsibility. |
| `CSAA-009-MOD-032` | A later realization SHALL preserve the `material` plane as a distinct logical responsibility. |
| `CSAA-009-MOD-033` | A later realization SHALL preserve the `coordination` plane as a distinct logical responsibility. |
| `CSAA-009-MOD-034` | A later realization SHALL preserve the `publication` plane as a distinct logical responsibility. |
| `CSAA-009-MOD-035` | A later realization SHALL preserve the `consumption` plane as a distinct logical responsibility. |
| `CSAA-009-MOD-036` | An `OperationalProfileDefinition` SHALL remain distinct from an `OperationalProfileInstantiation`. |
| `CSAA-009-MOD-037` | An `OperationalProfileInstantiation` SHALL remain distinct from an `OperationalObservation`. |
| `CSAA-009-MOD-038` | An `OperationalObservation` SHALL remain distinct from an `OperationalQualificationAssessment`. |
| `CSAA-009-MOD-039` | A profile facet SHALL NOT be missing, blank, duplicated, reordered, silently defaulted, or merged. |
| `CSAA-009-MOD-040` | A reasoned not-applicable profile facet SHALL cite its applicability owner and basis. |
| `CSAA-009-MOD-041` | A combined deployment SHALL preserve the same logical-plane boundaries as a distributed deployment. |
| `CSAA-009-MOD-042` | A distributed deployment SHALL preserve common identities and atomic boundaries across components. |
| `CSAA-009-MOD-043` | An existing 007 record SHALL NOT be overloaded to carry a missing operational-profile concept. |
| `CSAA-009-MOD-044` | A profile SHALL identify every side effect and trust crossing. |
| `CSAA-009-MOD-045` | A profile SHALL expose every unresolved alternative and residual risk. |

### 28.5 Identity, partitioning, and isolation

| ID | Requirement |
| --- | --- |
| `CSAA-009-IDN-001` | Every governed identity projection SHALL treat `P01` under its registered Security partition meaning: Administrative namespace, repository trust domain, principal, delegation, tenant or owner-backed not-applicable, and purpose. |
| `CSAA-009-IDN-002` | Every governed identity projection SHALL treat `P02` under its registered Security partition meaning: Information-control, confidentiality, access, retention, redaction, disclosure, and egress policy identities. |
| `CSAA-009-IDN-003` | Every governed identity projection SHALL treat `P03` under its registered Publication channel meaning: Repository plus worktree or synthetic-subject lineage, project/variant, and logical publication class. |
| `CSAA-009-IDN-004` | Every governed identity projection SHALL treat `P04` under its registered Publication channel meaning: Declared currentness scope, capability/population purpose, and static-versus-execution publication lane. |
| `CSAA-009-IDN-005` | Every governed identity projection SHALL treat `P05` under its registered Publication channel meaning: Topology-neutral channel namespace and stable channel-profile identity. |
| `CSAA-009-IDN-006` | Every governed identity projection SHALL treat `P06` under its registered Candidate subject meaning: Exact static snapshot, working change set, merge basis, acquisition boundary, and immutable subject digest. |
| `CSAA-009-IDN-007` | Every governed identity projection SHALL treat `P07` under its registered Candidate/read vector meaning: Candidate projection binds the exact new execution-evidence-set identity and revision, source-owned `staticSemanticSnapshotIdentityRef`, observation cutoff, and every already-committed upstream-lane reference while expressly excluding that lane's own future publication decision and publication generation; read projection binds each committed lane's exact publication decision, Publication Manifest, channel, generation, evidence-set revision, source-owned static-snapshot reference, and observation cutoff. |
| `CSAA-009-IDN-008` | Every governed identity projection SHALL treat `P08` under its registered Candidate subject meaning: Project/configuration closure plus exact `operationalProfileInstantiationId`, contract, semantic-owner, rule/profile, adapter, provider/method, toolchain, and generated-context versions. |
| `CSAA-009-IDN-009` | Every governed identity projection SHALL treat `P09` under its registered Material basis meaning: Migration epoch, physical-format compatibility, integrity state, exact `integrityIncidentId`, `repairExecutionId`, and prepublication `replayBasisManifestId` when applicable, transform, and storage-profile identity; the same candidate's future output-complete `replayManifestId` is excluded. |
| `CSAA-009-IDN-010` | Every governed identity projection SHALL treat `P10` under its registered Operation key meaning: Operation/version, query, capability, population, budget, partial-result, ordering, approximation, inference, and continuation projection. |
| `CSAA-009-IDN-011` | Every governed identity projection SHALL treat `P11` under its registered Cache key meaning: Complete dependency manifest, transform, compatibility-decision identity, observed publication vector, authorization decision, and protection-policy projection. |
| `CSAA-009-IDN-012` | Every governed identity projection SHALL treat `P12` under its registered Concurrency observation meaning: Expected predecessor, expected publication generation, fencing identity, state revision, and acquisition cutoff. |
| `CSAA-009-IDN-013` | An affected 007 successor SHALL make `operationalProfileInstantiationId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-014` | An affected 007 successor SHALL make `operationExecutionId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-015` | An affected 007 successor SHALL make `workUnitId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-016` | An affected 007 successor SHALL make `attemptId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-017` | An affected 007 successor SHALL make `recoveryEpochId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-018` | An affected 007 successor SHALL make `checkpointId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-019` | An affected 007 successor SHALL make `integrityIncidentId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-020` | An affected 007 successor SHALL make `repairExecutionId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-021` | An affected 007 successor SHALL make `replayBasisManifestId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-022` | An affected 007 successor SHALL make `replayManifestId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-023` | An affected 007 successor SHALL make `claimId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-024` | An affected 007 successor SHALL make `expectedWorkStateRevision` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-025` | An affected 007 successor SHALL make `claimRevision` and `claimTokenDigest` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-026` | An affected 007 successor SHALL make `requestIdempotencyKey` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-027` | An affected 007 successor SHALL make `effectIdempotencyKey` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-028` | An affected 007 successor SHALL make `publicationIdempotencyKey` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-029` | An affected 007 successor SHALL make `candidateLifecycleId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-030` | An affected 007 successor SHALL make `publicationCandidateId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-031` | An affected 007 successor SHALL make `candidateSubjectKey` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-032` | An affected 007 successor SHALL make `publicationChannelId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-033` | An affected 007 successor SHALL make `expectedPublicationGeneration` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-034` | An affected 007 successor SHALL make `publicationGeneration` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-035` | An affected 007 successor SHALL make `publicationCommitId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-036` | An affected 007 successor SHALL make `readViewLifecycleId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-037` | An affected 007 successor SHALL make `readViewId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-038` | An affected 007 successor SHALL make `rawMaterialReadViewId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-039` | An affected 007 successor SHALL make `publicationVectorDigest` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-040` | An affected 007 successor SHALL make `invalidationWorkflowId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-041` | An affected 007 successor SHALL make `cacheEntryId` and `cacheKeyDigest` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-042` | An affected 007 successor SHALL make `securityPartitionId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-043` | An affected 007 successor SHALL make `operationKey` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-044` | An affected 007 successor SHALL make `backupSetId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-045` | An affected 007 successor SHALL make `restoreExecutionId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-046` | An affected 007 successor SHALL make `migrationExecutionId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-047` | An affected 007 successor SHALL make `expectedRoutingGeneration` and `routingGeneration` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-048` | An affected 007 successor SHALL make `retentionActionId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-049` | An affected 007 successor SHALL make `tombstoneId` independently and losslessly representable under its registered scope. |
| `CSAA-009-IDN-050` | Content-bound identity `publicationCandidateId` SHALL use its registered canonical self-excluding preimage and mandatory exclusions. |
| `CSAA-009-IDN-051` | Content-bound identity `replayBasisManifestId` SHALL use its registered canonical self-excluding preimage and mandatory exclusions. |
| `CSAA-009-IDN-052` | Content-bound identity `replayManifestId` SHALL use its registered canonical self-excluding preimage and mandatory exclusions. |
| `CSAA-009-IDN-053` | `securityPartitionId`, `publicationChannelId`, `candidateSubjectKey`, `operationKey`, and `cacheKeyDigest` SHALL remain distinct projections. |
| `CSAA-009-IDN-054` | `publicationChannelId` SHALL exclude exact snapshot, evidence revision, request, migration epoch, physical placement, and publication generation. |
| `CSAA-009-IDN-055` | `expectedPublicationGeneration` SHALL remain mutable guard state rather than stable channel or candidate-subject identity. |
| `CSAA-009-IDN-056` | Every operation coordinate SHALL carry an exact value or an owner-backed `not-applicable(reason)` value. |
| `CSAA-009-IDN-057` | Every 007 operation SHALL follow the seventeen-operation coordinate-applicability matrix. |
| `CSAA-009-IDN-058` | A subjectless operation SHALL NOT invent repository, snapshot, evidence-set, or publication identity. |
| `CSAA-009-IDN-059` | A branch name SHALL NOT substitute for an immutable revision or snapshot identity. |
| `CSAA-009-IDN-060` | A path SHALL NOT serve as semantic identity without its exact subject binding. |
| `CSAA-009-IDN-061` | A current binding SHALL remain distinct from the immutable publication it names. |
| `CSAA-009-IDN-062` | A mutable locator SHALL NOT become immutable record identity. |
| `CSAA-009-IDN-063` | A cache address SHALL NOT become semantic identity. |
| `CSAA-009-IDN-064` | A content deduplication decision SHALL preserve logical multiplicity and provenance. |
| `CSAA-009-IDN-065` | An equal digest SHALL be interpreted only under its exact digest profile and purpose projection. |
| `CSAA-009-IDN-066` | A cross-snapshot comparison SHALL name every exact subject and relation. |
| `CSAA-009-IDN-067` | An ordinary query SHALL NOT mix security partitions or publication channels. |
| `CSAA-009-IDN-068` | Cross-boundary reuse SHALL require an exact compatibility and information-control decision. |
| `CSAA-009-IDN-069` | A same-user or same-repository-name observation SHALL NOT establish cross-boundary equivalence. |
| `CSAA-009-IDN-070` | An identity-projection collision SHALL be treated as an integrity and isolation failure. |
| `CSAA-009-IDN-071` | Every checkpoint transition and state revision SHALL bind one exact `checkpointId` that remains invariant across that lifecycle and is replaced for a new checkpoint lifecycle. |

### 28.6 Persisted material and durability

| ID | Requirement |
| --- | --- |
| `CSAA-009-PST-001` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `OperationalProfileInstantiationRecord`. |
| `CSAA-009-PST-002` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `OperationTransitionRecord`. |
| `CSAA-009-PST-003` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `WorkUnitRecord`. |
| `CSAA-009-PST-004` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `WorkAttemptRecord`. |
| `CSAA-009-PST-005` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `ExecutionClaimRecord`. |
| `CSAA-009-PST-006` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `RecoveryEpochRecord`. |
| `CSAA-009-PST-007` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `RecoveryCheckpointRecord`. |
| `CSAA-009-PST-008` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `IntegrityIncidentRecord`. |
| `CSAA-009-PST-009` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `RepairExecutionRecord`. |
| `CSAA-009-PST-010` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `ReplayBasisManifestRecord`. |
| `CSAA-009-PST-011` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `ReplayManifestRecord`. |
| `CSAA-009-PST-012` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `ExternalEffectIntentRecord`. |
| `CSAA-009-PST-013` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `ExternalEffectReconciliationRecord`. |
| `CSAA-009-PST-014` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `InvalidationDecisionRecord`. |
| `CSAA-009-PST-015` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `RecomputationPlanRecord`. |
| `CSAA-009-PST-016` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `CacheEntryDescriptorRecord`. |
| `CSAA-009-PST-017` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `CacheDecisionRecord`. |
| `CSAA-009-PST-018` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `PublicationCandidateLifecycleRecord`. |
| `CSAA-009-PST-019` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `PublicationCandidateRecord`. |
| `CSAA-009-PST-020` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `PublicationDecisionRecord`. |
| `CSAA-009-PST-021` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `ReadViewLifecycleRecord`. |
| `CSAA-009-PST-022` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `ContentReadViewRecord`. |
| `CSAA-009-PST-023` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `RawMaterialReadViewRecord`. |
| `CSAA-009-PST-024` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `BackupSetRecord`. |
| `CSAA-009-PST-025` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `RestoreExecutionRecord`. |
| `CSAA-009-PST-026` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `RetentionActionRecord`. |
| `CSAA-009-PST-027` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `TombstoneRecord`. |
| `CSAA-009-PST-028` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `MigrationExecutionRecord`. |
| `CSAA-009-PST-029` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `MigrationCutoverRecord`. |
| `CSAA-009-PST-030` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `CapacityAdmissionRecord`. |
| `CSAA-009-PST-031` | An affected 007 successor SHALL provide lossless noncircular representability for the operational role currently labeled `ProjectionBuildRecord`. |
| `CSAA-009-PST-032` | A later realization SHALL persist `M01` according to its registered semantics. |
| `CSAA-009-PST-033` | A later realization SHALL persist `M02` according to its registered semantics. |
| `CSAA-009-PST-034` | A later realization SHALL persist `M03` according to its registered semantics. |
| `CSAA-009-PST-035` | A later realization SHALL persist `M04` according to its registered semantics. |
| `CSAA-009-PST-036` | A later realization SHALL persist `M05` according to its registered semantics. |
| `CSAA-009-PST-037` | A later realization SHALL persist `M06` according to its registered semantics. |
| `CSAA-009-PST-038` | A later realization SHALL persist `M07` according to its registered semantics. |
| `CSAA-009-PST-039` | A later realization SHALL persist `M08` according to its registered semantics. |
| `CSAA-009-PST-040` | A later realization SHALL persist `M09` according to its registered semantics. |
| `CSAA-009-PST-041` | A later realization SHALL persist `M10` according to its registered semantics. |
| `CSAA-009-PST-042` | A later realization SHALL persist `M11` according to its registered semantics. |
| `CSAA-009-PST-043` | A later realization SHALL persist `M12` according to its registered semantics. |
| `CSAA-009-PST-044` | A later realization SHALL persist `M13` according to its registered semantics. |
| `CSAA-009-PST-045` | A later realization SHALL persist `M14` according to its registered semantics. |
| `CSAA-009-PST-046` | A later realization SHALL persist `M15` according to its registered semantics. |
| `CSAA-009-PST-047` | A later realization SHALL persist `M16` according to its registered semantics. |
| `CSAA-009-PST-048` | A later realization SHALL persist `M17` according to its registered semantics. |
| `CSAA-009-PST-049` | A later realization SHALL persist `M18` according to its registered semantics. |
| `CSAA-009-PST-050` | A later operational profile SHALL preserve durability barrier `D0` with its registered durable fact. |
| `CSAA-009-PST-051` | A later operational profile SHALL preserve durability barrier `D1` with its registered durable fact. |
| `CSAA-009-PST-052` | A later operational profile SHALL preserve durability barrier `D2` with its registered durable fact. |
| `CSAA-009-PST-053` | A later operational profile SHALL preserve durability barrier `D3` with its registered durable fact. |
| `CSAA-009-PST-054` | A later operational profile SHALL preserve durability barrier `D4` with its registered durable fact. |
| `CSAA-009-PST-055` | A later operational profile SHALL preserve durability barrier `D5` with its registered durable fact. |
| `CSAA-009-PST-056` | A later operational profile SHALL preserve durability barrier `D6` with its registered durable fact. |
| `CSAA-009-PST-057` | A later operational profile SHALL preserve durability barrier `D7` with its registered durable fact. |
| `CSAA-009-PST-058` | Every coordination-record lifecycle SHALL permit only the registered source-to-target transitions. |
| `CSAA-009-PST-059` | Every coordination-record transition SHALL append its prior state, new state, monotonic revision, guard, cause, and evidence. |
| `CSAA-009-PST-060` | A terminal coordination-record correction SHALL use a successor identity rather than reopen history. |
| `CSAA-009-PST-061` | A checkpoint lifecycle SHALL preserve proposed and rejected assessment states without implying completion, and bind content-completion evidence only when verification succeeds. |
| `CSAA-009-PST-062` | Every immutable material write SHALL validate exact contract, identity, digest profile, provenance, authorization, and finalization. |
| `CSAA-009-PST-063` | An immutable identity SHALL NOT be overwritten with unequal governed bytes. |
| `CSAA-009-PST-064` | An equal-identity unequal-content observation SHALL be quarantined as a critical collision. |
| `CSAA-009-PST-065` | A durability acknowledgment SHALL state its exact commitment and fault boundary. |
| `CSAA-009-PST-066` | Ephemeral work SHALL NOT alter a durable current publication. |
| `CSAA-009-PST-067` | Recoverable work SHALL preserve every declared checkpoint and completed immutable material across its fault boundary. |
| `CSAA-009-PST-068` | Durable work SHALL preserve every acknowledged in-scope state across its declared fault boundary. |
| `CSAA-009-PST-069` | A publication-capable operation SHALL durably record its request, authorization, candidate lifecycle, sealed candidate, predecessor, idempotency, and intent before commit acknowledgment. |
| `CSAA-009-PST-070` | Loss of ephemeral intermediate computation SHALL produce explicit replay or failure rather than fabricated completion. |
| `CSAA-009-PST-071` | Deduplication SHALL NOT erase distinct attempts or provider invocations. |
| `CSAA-009-PST-072` | A write acknowledgment SHALL NOT imply publication, backup, replication, conformance, or semantic correctness. |
| `CSAA-009-PST-073` | Every persisted derivative SHALL retain its authoritative basis and transform version. |
| `CSAA-009-PST-074` | A persisted execution-evidence set SHALL remain independently revisioned from its static semantic snapshot. |
| `CSAA-009-PST-075` | New execution evidence SHALL create an append-oriented successor rather than mutate a prior query result. |
| `CSAA-009-PST-076` | A persistence failure SHALL leave actual availability and currentness explicit. |

### 28.7 Atomic candidate publication

| ID | Requirement |
| --- | --- |
| `CSAA-009-PUB-001` | A candidate publication SHALL preserve state ``ABSENT`` with the registered meaning and consequence. |
| `CSAA-009-PUB-002` | A candidate publication SHALL preserve state ``ASSEMBLING`` with the registered meaning and consequence. |
| `CSAA-009-PUB-003` | A candidate publication SHALL preserve state ``SEALED`` with the registered meaning and consequence. |
| `CSAA-009-PUB-004` | A candidate publication SHALL preserve state ``INELIGIBLE`` with the registered meaning and consequence. |
| `CSAA-009-PUB-005` | A candidate publication SHALL preserve state ``ELIGIBLE`` with the registered meaning and consequence. |
| `CSAA-009-PUB-006` | A candidate publication SHALL preserve state ``COMMITTING`` with the registered meaning and consequence. |
| `CSAA-009-PUB-007` | A candidate publication SHALL preserve state ``COMMIT_OUTCOME_UNKNOWN`` with the registered meaning and consequence. |
| `CSAA-009-PUB-008` | A candidate publication SHALL preserve state ``PUBLISHED`` with the registered meaning and consequence. |
| `CSAA-009-PUB-009` | A candidate publication SHALL preserve state ``SUPERSEDED`` with the registered meaning and consequence. |
| `CSAA-009-PUB-010` | A candidate publication SHALL preserve state ``REFUSED`` with the registered meaning and consequence. |
| `CSAA-009-PUB-011` | A candidate publication SHALL preserve state ``ABANDONED`` with the registered meaning and consequence. |
| `CSAA-009-PUB-012` | A candidate publication SHALL preserve state ``QUARANTINED`` with the registered meaning and consequence. |
| `CSAA-009-PUB-013` | Publication SHALL satisfy `PUB-P01`: Exact static subject identity is resolved and unchanged across the declared acquisition boundary. |
| `CSAA-009-PUB-014` | Publication SHALL satisfy `PUB-P02`: Every execution-evidence candidate binds the exact new evidence-set identity and revision, source-owned `staticSemanticSnapshotIdentityRef`, observation cutoff, and already-committed upstream-lane references while excluding its own future publication decision and publication generation; every read projection binds each included lane through its exact committed publication coordinates. |
| `CSAA-009-PUB-015` | Publication SHALL satisfy `PUB-P03`: Every mandatory family for the declared publication class is complete; policy-permitted missing or unsupported regions are explicit in closure/limitation manifests and excluded from completeness claims. |
| `CSAA-009-PUB-016` | Publication SHALL satisfy `PUB-P04`: Every record and collection validates under the exact contract package and generated-derivative identities. |
| `CSAA-009-PUB-017` | Publication SHALL satisfy `PUB-P05`: Every content-bound reference resolves to an already-finalized digest-valid target without a prohibited cycle. |
| `CSAA-009-PUB-018` | Publication SHALL satisfy `PUB-P06`: Counts, canonical aggregate digests, partition manifests, and the Publication Manifest agree. |
| `CSAA-009-PUB-019` | Publication SHALL satisfy `PUB-P07`: Coverage, execution, freshness, health, conflict, partiality, unsupported, failure, limitation, integrity, security, qualification, and audit dimensions are independently populated and non-coerced. |
| `CSAA-009-PUB-020` | Publication SHALL satisfy `PUB-P08`: Every applicable blocking dependency is positively resolved and equal-current; missing, unresolved, conflicting, incompatible, stale, or explicitly disqualifying observations make the candidate ineligible. |
| `CSAA-009-PUB-021` | Publication SHALL satisfy `PUB-P09`: Authorization and information-control composition permit the exact publication and every derivative. |
| `CSAA-009-PUB-022` | Publication SHALL satisfy `PUB-P10`: No required rule, profile, gate, oracle, provider-qualification, or authority state is fabricated or silently inferred. |
| `CSAA-009-PUB-023` | Publication SHALL satisfy `PUB-P11`: The exact expected predecessor publication and current-binding generation still match. |
| `CSAA-009-PUB-024` | Publication SHALL satisfy `PUB-P12`: The publisher owns a current fenced right for this stable publication channel and no stale worker can commit. |
| `CSAA-009-PUB-025` | Publication SHALL satisfy `PUB-P13`: The publication intent, idempotency identity, candidate, predecessor, and audit correlation are durable. |
| `CSAA-009-PUB-026` | Publication SHALL satisfy `PUB-P14`: Every clean-full, migration, integrity, security, and conformance predicate required for current publication is `PASS`; every nonpass remains visible and blocks eligibility. |
| `CSAA-009-PUB-027` | Publication SHALL satisfy `PUB-P15`: No mixed-revision record, cross-partition leakage, unresolved collision, quarantined input, or unacknowledged corruption is included. |
| `CSAA-009-PUB-028` | Publication SHALL satisfy `PUB-P16`: The candidate remains immutable between sealing and the linearization point. |
| `CSAA-009-PUB-029` | A candidate-publication lifecycle SHALL permit only the registered source-to-target transitions. |
| `CSAA-009-PUB-030` | A candidate state transition SHALL append a monotonic revision for the exact `(securityPartitionId, publicationChannelId, candidateLifecycleId)` tuple and preserve terminal history. |
| `CSAA-009-PUB-031` | A `publicationCandidateId` SHALL be minted and bound exactly once only when the `ASSEMBLING` to `SEALED` transition finalizes the exact content, manifest, and digest. |
| `CSAA-009-PUB-032` | A `publicationCommitId` SHALL remain absent until an authoritative `PublicationDecisionRecord` finalizes and never be anticipated from intent, `COMMITTING`, `COMMIT_OUTCOME_UNKNOWN`, response, timeout, or lifecycle state alone. |
| `CSAA-009-PUB-033` | Publication eligibility SHALL require `PASS` for every applicable mandatory predicate. |
| `CSAA-009-PUB-034` | A failed, unknown, or explicitly disqualifying mandatory predicate SHALL make the candidate ineligible. |
| `CSAA-009-PUB-035` | Publication SHALL have one observable logical linearization point per stable publication channel. |
| `CSAA-009-PUB-036` | A reader SHALL observe either the complete predecessor or the complete successor at publication. |
| `CSAA-009-PUB-037` | A reader SHALL NOT observe a hybrid publication. |
| `CSAA-009-PUB-038` | A current binding SHALL NOT point to unsealed, ineligible, missing, quarantined, or incompatible material. |
| `CSAA-009-PUB-039` | Compare-and-publish SHALL bind the exact expected predecessor and current-binding generation. |
| `CSAA-009-PUB-040` | A publication race loser SHALL NOT be silently rebased. |
| `CSAA-009-PUB-041` | A publication conflict SHALL leave the current binding unchanged. |
| `CSAA-009-PUB-042` | A failed candidate SHALL NOT relabel the predecessor as output from the failed attempt. |
| `CSAA-009-PUB-043` | An uncertain publication outcome SHALL be reconciled before retry. |
| `CSAA-009-PUB-044` | An uncertain publication outcome SHALL make new binding-dependent service explicitly unavailable or unknown. |
| `CSAA-009-PUB-045` | A proven pre-commit failure SHALL leave the predecessor as the mechanically selected binding target. |
| `CSAA-009-PUB-046` | A proven commit SHALL make the successor the mechanically selected binding target despite later response loss. |
| `CSAA-009-PUB-047` | A lost response after commit SHALL NOT unpublish the committed successor. |
| `CSAA-009-PUB-048` | A response written without commit SHALL NOT publish a successor. |
| `CSAA-009-PUB-049` | A partial publication SHALL be one complete atomic publication with explicit missing regions. |
| `CSAA-009-PUB-050` | A publication SHALL retain coverage, health, freshness, conflict, partiality, unsupported, failure, and limitation dimensions separately. |
| `CSAA-009-PUB-051` | A provider success SHALL NOT make a candidate publication eligible by itself. |
| `CSAA-009-PUB-052` | A publication SHALL preserve immutable predecessor and supersession lineage. |
| `CSAA-009-PUB-053` | A reconstructable post-commit audit gap SHALL degrade audit health and readiness without reversing a proven commit. |
| `CSAA-009-PUB-054` | A sealed content candidate SHALL remain immutable from sealing through the publication decision. |
| `CSAA-009-PUB-055` | A published static snapshot SHALL remain distinct from every execution-evidence-set publication. |
| `CSAA-009-PUB-056` | A publication failure SHALL preserve the prior valid publication as distinguishable historical/current state. |
| `CSAA-009-PUB-057` | An incomplete successor SHALL NOT become current. |

### 28.8 Snapshot-pinned reads and query consistency

| ID | Requirement |
| --- | --- |
| `CSAA-009-QRY-001` | A content or raw-material read-view lifecycle SHALL preserve state ``REQUESTED`` with the registered meaning and action. |
| `CSAA-009-QRY-002` | A content or raw-material read-view lifecycle SHALL preserve state ``ACQUIRED`` with the registered meaning and action. |
| `CSAA-009-QRY-003` | A content or raw-material read-view lifecycle SHALL preserve state ``ACTIVE`` with the registered meaning and action. |
| `CSAA-009-QRY-004` | A content or raw-material read-view lifecycle SHALL preserve state ``COMPLETED`` with the registered meaning and action. |
| `CSAA-009-QRY-005` | A content or raw-material read-view lifecycle SHALL preserve state ``EXPIRED`` with the registered meaning and action. |
| `CSAA-009-QRY-006` | A content or raw-material read-view lifecycle SHALL preserve state ``CANCELLED`` with the registered meaning and action. |
| `CSAA-009-QRY-007` | A content or raw-material read-view lifecycle SHALL preserve state ``UNAVAILABLE`` with the registered meaning and action. |
| `CSAA-009-QRY-008` | A read-view lifecycle SHALL permit only the registered source-to-target transitions. |
| `CSAA-009-QRY-009` | A read-view lifecycle SHALL retain one exact `readViewLifecycleId` from `REQUESTED` through terminal state and mint no type-specific view identity unless it reaches `ACQUIRED`. |
| `CSAA-009-QRY-010` | A mixed read SHALL bind every static and execution lane to its exact committed publication decision, channel, generation, manifest, and cutoff. |
| `CSAA-009-QRY-011` | A mixed read SHALL acquire one canonical publication vector under a common observation cutoff. |
| `CSAA-009-QRY-012` | Every cross-version or cross-lane read SHALL bind an exact successful 007 compatibility decision with direction, scope, evidence, loss treatment, and validity. |
| `CSAA-009-QRY-013` | Each execution lane in a mixed read SHALL bind a source-owned `staticSemanticSnapshotIdentityRef` equal to the pinned static semantic snapshot unless the operation is an explicitly labelled, separately authorized cross-snapshot comparison. |
| `CSAA-009-QRY-014` | A non-publication-bound raw retrieval SHALL acquire an exact `RawMaterialReadView` under the shared closed read lifecycle, binding raw material identity, bytes digest, type, owner, authoritative basis, provenance, security partition, authorization, policy, retention, redaction, integrity, availability, cutoff, and expiry with owner-backed not-applicable publication coordinates and no semantic traversal or currentness conferral. |
| `CSAA-009-QRY-015` | A non-content health observation SHALL remain incapable of semantic traversal. |
| `CSAA-009-QRY-016` | A subjectless health observation SHALL use only owner-backed not-applicable subject and channel values. |
| `CSAA-009-QRY-017` | Every query SHALL acquire an immutable read view before semantic traversal. |
| `CSAA-009-QRY-018` | A read view SHALL bind exact publication, partition, authorization, contract, policy, query, budget, and continuation identities. |
| `CSAA-009-QRY-019` | A logical result SHALL NOT follow a newer current binding after view acquisition. |
| `CSAA-009-QRY-020` | A continuation SHALL remain bound to the exact originating read view. |
| `CSAA-009-QRY-021` | An expired or unavailable continuation SHALL produce an explicit outcome rather than rebinding. |
| `CSAA-009-QRY-022` | An ordinary query SHALL resolve against one declared semantic snapshot. |
| `CSAA-009-QRY-023` | A cross-snapshot comparison SHALL label each exact snapshot independently. |
| `CSAA-009-QRY-024` | A query combining static and execution evidence SHALL declare both identity lanes. |
| `CSAA-009-QRY-025` | New execution evidence SHALL NOT mutate a historical query result. |
| `CSAA-009-QRY-026` | Repeatable reads SHALL preserve semantic membership and epistemic treatment under the same exact inputs. |
| `CSAA-009-QRY-027` | Presentation or traversal parallelism SHALL vary only within declared ordering and allowed-difference rules. |
| `CSAA-009-QRY-028` | An admitted reader SHALL remain protected from concurrent deletion for its declared interval. |
| `CSAA-009-QRY-029` | A query SHALL NOT trigger implicit full-repository reanalysis. |
| `CSAA-009-QRY-030` | An unsatisfied freshness requirement SHALL produce explicit stale, unavailable, or separately requested analysis behavior. |
| `CSAA-009-QRY-031` | Authorization SHALL be checked before traversal, aggregation, pagination, raw retrieval, count computation, or existence disclosure. |
| `CSAA-009-QRY-032` | A redacted query result SHALL preserve every interpretation-changing omission. |
| `CSAA-009-QRY-033` | A page SHALL NOT mix members from different publication generations. |
| `CSAA-009-QRY-034` | A query result SHALL retain exact subject, evidence-set, cutoff, policy, and health dimensions. |
| `CSAA-009-QRY-035` | A last-known-good publication SHALL be returned only as explicitly labeled historical material. |
| `CSAA-009-QRY-036` | A query refusal SHALL NOT disclose protected path, count, graph shape, timing, or existence information. |

### 28.9 Dependency-aware invalidation

| ID | Requirement |
| --- | --- |
| `CSAA-009-INV-001` | Every applicable dependency manifest SHALL include `D01`: Repository, revision, base, candidate merge, working change set, input content, artifact classification, and perimeter. |
| `CSAA-009-INV-002` | Every applicable dependency manifest SHALL include `D02`: Workspace, package, manifest, lockfile, dependency resolution, external component, and advisory/feed cutoff. |
| `CSAA-009-INV-003` | Every applicable dependency manifest SHALL include `D03`: Project, variant, effective configuration, exact `operationalProfileInstantiationId`, compiler, resolver, condition set, paths, aliases, ambient context, and toolchain. |
| `CSAA-009-INV-004` | Every applicable dependency manifest SHALL include `D04`: Framework adapter, generator, generated configuration, generated/virtual artifact, declaration output, origin mapping, and freshness. |
| `CSAA-009-INV-005` | Every applicable dependency manifest SHALL include `D05`: Semantic-owner document, invariant, capability profile, query/slice/comparison/impact definition, and rule/profile input. |
| `CSAA-009-INV-006` | Every applicable dependency manifest SHALL include `D06`: Schema package, generated derivative, validation registry, contract family, compatibility decision, and migration epoch. |
| `CSAA-009-INV-007` | Every applicable dependency manifest SHALL include `D07`: Provider, adapter, analyzer, method, model, version, configuration, capability declaration, qualification, and health basis. |
| `CSAA-009-INV-008` | Every applicable dependency manifest SHALL include `D08`: Raw provider result, normalization transform, graph composition, upstream fact, relation, index, projection, and conflict input. |
| `CSAA-009-INV-009` | Every applicable dependency manifest SHALL include `D09`: Build configuration, execution artifact, instrumentation, source map, test selection, attempt, coverage denominator, and granularity. |
| `CSAA-009-INV-010` | Every applicable dependency manifest SHALL include `D10`: Runtime build, environment, workload, trace schema, collector, sampling, clock, observation window, and cutoff. |
| `CSAA-009-INV-011` | Every applicable dependency manifest SHALL include `D11`: Population, traversal, query parameters, ordering, page, budget, approximation, inference, and partial-result policy. |
| `CSAA-009-INV-012` | Every applicable dependency manifest SHALL include `D12`: Authorization, principal, delegation, tenant, purpose, information control, redaction, retention, egress, and presentation policy. |
| `CSAA-009-INV-013` | Every applicable dependency manifest SHALL include `D13`: Current-binding generation, predecessor publication, read view, concurrent operation, claim, fencing, and cancellation state. |
| `CSAA-009-INV-014` | Every applicable dependency manifest SHALL include `D14`: Storage-format version, physical compatibility, migration phase, integrity state, exact `integrityIncidentId`, `repairExecutionId`, and prepublication `replayBasisManifestId` when applicable; `replayManifestId` is permitted only for a downstream derivative that is not a member of its own reported output set; corruption observation, repair, and restore generation. |
| `CSAA-009-INV-015` | Every applicable dependency manifest SHALL include `D15`: External reference, registry, advisory source, database/feed, license or policy identity, observation cutoff, and availability. |
| `CSAA-009-INV-016` | Every applicable dependency manifest SHALL include `D16`: Environmental influence declared material to deterministic behavior, including locale, platform, line endings, clock, randomness, and concurrency policy. |
| `CSAA-009-INV-017` | Every applicable dependency manifest SHALL include `D17`: Upstream invalidation record, freshness assessment, unresolved frontier, conservative broadening decision, and recomputation plan. |
| `CSAA-009-INV-018` | Every applicable dependency manifest SHALL include `D18`: Any additional exact dependency introduced by the concern-owning semantic or contract definition. |
| `CSAA-009-INV-019` | An invalidation workflow SHALL preserve state ``OBSERVED`` with the registered meaning. |
| `CSAA-009-INV-020` | An invalidation workflow SHALL preserve state ``OBSERVATION_FAILED_UNBOUND`` with the registered meaning. |
| `CSAA-009-INV-021` | An invalidation workflow SHALL preserve state ``BOUND`` with the registered meaning. |
| `CSAA-009-INV-022` | An invalidation workflow SHALL preserve state ``CLOSURE_PARTIAL`` with the registered meaning. |
| `CSAA-009-INV-023` | An invalidation workflow SHALL preserve state ``CLOSURE_COMPLETE`` with the registered meaning. |
| `CSAA-009-INV-024` | An invalidation workflow SHALL preserve state ``INVALIDATED`` with the registered meaning. |
| `CSAA-009-INV-025` | An invalidation workflow SHALL preserve state ``RECOMPUTING`` with the registered meaning. |
| `CSAA-009-INV-026` | An invalidation workflow SHALL preserve state ``REVALIDATED`` with the registered meaning. |
| `CSAA-009-INV-027` | An invalidation workflow SHALL preserve state ``SUCCEEDED_BY_SUCCESSOR`` with the registered meaning. |
| `CSAA-009-INV-028` | An invalidation workflow SHALL preserve state ``RECOMPUTATION_FAILED_NONCURRENT`` with the registered meaning. |
| `CSAA-009-INV-029` | An invalidation lifecycle SHALL permit only the registered source-to-target transitions. |
| `CSAA-009-INV-030` | An invalidation transition SHALL append a monotonic workflow-state revision for one exact `invalidationWorkflowId`. |
| `CSAA-009-INV-031` | An invalidation workflow SHALL allocate a fresh identity at exact observation scope and cutoff, bind exact dependency/prior-population/subject fields only on `BOUND`, and terminate an unbound failure without inventing or later filling those fields while keeping the complete observation scope non-current or unavailable. |
| `CSAA-009-INV-032` | A mechanically selected invalidated binding SHALL remain semantically noncurrent until positive revalidation or successor closure. |
| `CSAA-009-INV-033` | Currentness SHALL require a positive dependency assessment under the declared currency predicate. |
| `CSAA-009-INV-034` | Absence of an invalidation event SHALL NOT prove freshness. |
| `CSAA-009-INV-035` | A changed dependency SHALL block current use of every dependent result in the conservative closure. |
| `CSAA-009-INV-036` | A missing dependency observation SHALL block a currentness claim. |
| `CSAA-009-INV-037` | An unresolved dependency SHALL preserve its frontier, attempts, and observed versions. |
| `CSAA-009-INV-038` | A conflicting dependency SHALL retain every competing observation. |
| `CSAA-009-INV-039` | An incompatible dependency SHALL require rejection, migration, rebuild, or explicit unsupported treatment. |
| `CSAA-009-INV-040` | A not-applicable dependency SHALL cite a source-owned applicability reason. |
| `CSAA-009-INV-041` | Affected-closure traversal SHALL follow every declared semantic and operational dependency edge. |
| `CSAA-009-INV-042` | An unknown dependency edge SHALL broaden invalidation to the smallest demonstrably safe parent population. |
| `CSAA-009-INV-043` | An unprovable safe parent SHALL broaden invalidation to the complete declared subject or capability population. |
| `CSAA-009-INV-044` | An optimization SHALL NOT under-invalidate. |
| `CSAA-009-INV-045` | Recomputation expense SHALL NOT justify uncertain reuse. |
| `CSAA-009-INV-046` | An invalidation SHALL NOT mutate an immutable semantic record. |
| `CSAA-009-INV-047` | A later refinement SHALL retain the original broadening decision and reason. |
| `CSAA-009-INV-048` | An invalidation record SHALL NOT imply recomputation or successor publication. |
| `CSAA-009-INV-049` | A revalidation SHALL record exact method, inputs, cutoff, outcome, and limitations. |
| `CSAA-009-INV-050` | A failed recomputation SHALL leave affected material visibly stale, invalidated, partial, unsupported, or failed. |
| `CSAA-009-INV-051` | An invalidation action SHALL record affected facts, graphs, profiles, evidence, caches, indexes, and publications. |
| `CSAA-009-INV-052` | A dependency-manifest version change SHALL invalidate incompatible closure and reuse evidence. |

### 28.10 Incremental reanalysis and clean-full equivalence

| ID | Requirement |
| --- | --- |
| `CSAA-009-INC-001` | Incremental equivalence SHALL compare `E01`: Semantic result sets. |
| `CSAA-009-INC-002` | Incremental equivalence SHALL compare `E02`: Epistemic state. |
| `CSAA-009-INC-003` | Incremental equivalence SHALL compare `E03`: Coverage and population closure. |
| `CSAA-009-INC-004` | Incremental equivalence SHALL compare `E04`: Provenance and lineage. |
| `CSAA-009-INC-005` | Incremental equivalence SHALL compare `E05`: Conflict and disagreement. |
| `CSAA-009-INC-006` | Incremental equivalence SHALL compare `E06`: Failure and degraded behavior. |
| `CSAA-009-INC-007` | Incremental equivalence SHALL compare `E07`: Explanations and witnesses. |
| `CSAA-009-INC-008` | Incremental equivalence SHALL compare `E08`: Ordering and declared allowed differences. |
| `CSAA-009-INC-009` | Incremental and clean-full runs SHALL bind the same exact post-change successor subject. |
| `CSAA-009-INC-010` | Incremental and clean-full runs SHALL bind compatible semantic profiles and provider methods. |
| `CSAA-009-INC-011` | A wrong base, successor, worktree, branch, project, lockfile, provider, evidence set, cutoff, policy, or migration epoch SHALL invalidate equivalence. |
| `CSAA-009-INC-012` | Matching counts SHALL NOT establish incremental equivalence. |
| `CSAA-009-INC-013` | Matching aggregate digests SHALL NOT establish incremental equivalence unless the digest projection fully covers the governed dimension. |
| `CSAA-009-INC-014` | Every incremental attempt SHALL distinguish reused, revalidated, recomputed, invalidated, new, removed, conflicting, and unresolved populations. |
| `CSAA-009-INC-015` | Reused material SHALL preserve its original producing run, invocation, time, provider, provenance, and limitations. |
| `CSAA-009-INC-016` | Reuse SHALL be recorded as reuse rather than new execution. |
| `CSAA-009-INC-017` | A permitted incremental difference SHALL be declared before execution by the concern-owning profile. |
| `CSAA-009-INC-018` | A permitted incremental difference SHALL bind an independently owned oracle allocation. |
| `CSAA-009-INC-019` | An implementation SHALL NOT define tolerated divergence after observing the result. |
| `CSAA-009-INC-020` | The later suite SHALL report at least 144 mutation-dimension assessments across 18 mutation classes and eight dimensions. |
| `CSAA-009-INC-021` | The later suite SHALL report all thirty-two required supply-chain lane-coordinate assignments. |
| `CSAA-009-INC-022` | Unavailable or ineligible clean-full evidence SHALL prevent an equivalence-proven claim. |
| `CSAA-009-INC-023` | A provisional incremental result SHALL remain explicitly provisional when equivalence cannot be established. |
| `CSAA-009-INC-024` | A removed predecessor member SHALL retain exact removal basis and successor absence semantics. |
| `CSAA-009-INC-025` | A newly discovered successor member SHALL retain discovery basis and predecessor-population treatment. |
| `CSAA-009-INC-026` | A conflict SHALL retain every competing incremental and clean-full provenance. |
| `CSAA-009-INC-027` | A clean-full comparison SHALL preserve every failure and degraded dimension. |
| `CSAA-009-INC-028` | An equivalence result SHALL remain bound to exact ordering, approximation, and inference limits. |

### 28.11 Cache and derived indexes

| ID | Requirement |
| --- | --- |
| `CSAA-009-CAC-001` | A cache hit SHALL satisfy `CAC-P01`: Exact repository, subject, snapshot, change-set, and evidence-set identities match. |
| `CSAA-009-CAC-002` | A cache hit SHALL satisfy `CAC-P02`: Exact project, compiler, resolver, framework, generated context, and configuration closure match. |
| `CSAA-009-CAC-003` | A cache hit SHALL satisfy `CAC-P03`: Exact semantic-owner, contract, schema, generated-derivative, adapter, provider/method, and rule/profile versions match or an exact successful 007 compatibility decision/claim names direction, scope, evidence, loss treatment, validity, and every differing version. |
| `CSAA-009-CAC-004` | A cache hit SHALL satisfy `CAC-P04`: Exact query/capability/population, ordering, approximation, inference, budget, and partial-result policy match. |
| `CSAA-009-CAC-005` | A cache hit SHALL satisfy `CAC-P05`: Every declared dependency is positively equal-current at the required cutoff. |
| `CSAA-009-CAC-006` | A cache hit SHALL satisfy `CAC-P06`: Original raw and normalized provenance remains resolvable or its authorized retained substitute satisfies the declared reproducibility rule. |
| `CSAA-009-CAC-007` | A cache hit SHALL satisfy `CAC-P07`: Original and current capability coverage, health, partiality, unsupported, failure, conflict, and limitation states remain compatible. |
| `CSAA-009-CAC-008` | A cache hit SHALL satisfy `CAC-P08`: Principal, tenant, purpose, authorization, information-control, retention, redaction, egress, and presentation policies permit reuse. |
| `CSAA-009-CAC-009` | A cache hit SHALL satisfy `CAC-P09`: Cache entry integrity, basis manifest, aggregate digest, collection keys, and physical-format compatibility validate. |
| `CSAA-009-CAC-010` | A cache hit SHALL satisfy `CAC-P10`: Entry state is admitted-current and not stale, invalidated, quarantined, corrupt, migration-blocked, expired-by-policy, or deletion-pending. |
| `CSAA-009-CAC-011` | A cache hit SHALL satisfy `CAC-P11`: No subject mutation, TOCTOU event, current-binding race, or unresolved invalidation occurred between validation and use. |
| `CSAA-009-CAC-012` | A cache hit SHALL satisfy `CAC-P12`: The cache key includes every identity-bearing coordinate and has no ambiguous default, wildcard, path-only, or branch-name-only component. |
| `CSAA-009-CAC-013` | A cache hit SHALL satisfy `CAC-P13`: A successful-empty or negative entry retains closed-population, supported-execution, health, and non-vacuity evidence. |
| `CSAA-009-CAC-014` | A cache hit SHALL satisfy `CAC-P14`: A cross-process or cross-node copy preserves exact bytes, integrity, information-control treatment, and basis identity. |
| `CSAA-009-CAC-015` | A cache hit SHALL satisfy `CAC-P15`: Reuse is recorded as reuse and preserves original producing time, run, invocation, provider, and limitations. |
| `CSAA-009-CAC-016` | A cache hit SHALL satisfy `CAC-P16`: Admission failure produces an explicit miss/stale/unavailable result; only a separately authorized analysis operation may accept recomputation under a new exact request. |
| `CSAA-009-CAC-017` | A cache entry SHALL preserve state ``ABSENT`` with the registered treatment. |
| `CSAA-009-CAC-018` | A cache entry SHALL preserve state ``BUILDING`` with the registered treatment. |
| `CSAA-009-CAC-019` | A cache entry SHALL preserve state ``CANDIDATE`` with the registered treatment. |
| `CSAA-009-CAC-020` | A cache entry SHALL preserve state ``ADMITTED_CURRENT`` with the registered treatment. |
| `CSAA-009-CAC-021` | A cache entry SHALL preserve state ``STALE`` with the registered treatment. |
| `CSAA-009-CAC-022` | A cache entry SHALL preserve state ``INVALIDATED`` with the registered treatment. |
| `CSAA-009-CAC-023` | A cache entry SHALL preserve state ``INCOMPATIBLE`` with the registered treatment. |
| `CSAA-009-CAC-024` | A cache entry SHALL preserve state ``QUARANTINED`` with the registered treatment. |
| `CSAA-009-CAC-025` | A cache entry SHALL preserve state ``EVICTION_PENDING`` with the registered treatment. |
| `CSAA-009-CAC-026` | A cache entry SHALL preserve state ``EVICTED`` with the registered treatment. |
| `CSAA-009-CAC-027` | A cache entry SHALL preserve state ``UNKNOWN`` with the registered treatment. |
| `CSAA-009-CAC-028` | A cache-entry lifecycle SHALL permit only the registered source-to-target transitions. |
| `CSAA-009-CAC-029` | A cache transition SHALL append a monotonic cache-state revision, while every rebuild uses a new cache-entry identity. |
| `CSAA-009-CAC-030` | A cache-entry lifecycle SHALL have no identity in conceptual `ABSENT`, mint a fresh `cacheEntryId` when construction or uncertainty containment starts, bind a value descriptor exactly once on first permitted entry to `CANDIDATE`, preserve every pre-`UNKNOWN` origin restriction, and never rebind an unequal recovered descriptor. |
| `CSAA-009-CAC-031` | Cross-version cache reuse SHALL bind the exact successful 007 compatibility decision, direction, scope, evidence, loss treatment, and validity. |
| `CSAA-009-CAC-032` | A compatibility map by itself SHALL NOT authorize cache reuse. |
| `CSAA-009-CAC-033` | A cache key SHALL include every compatibility-decision identity used for admission. |
| `CSAA-009-CAC-034` | A cache SHALL remain a rebuildable derivative rather than semantic authority. |
| `CSAA-009-CAC-035` | A cache hit SHALL NOT establish freshness by itself. |
| `CSAA-009-CAC-036` | A nonexpired time-to-live SHALL NOT establish currentness. |
| `CSAA-009-CAC-037` | A cache key SHALL include every identity-bearing and policy-bearing coordinate. |
| `CSAA-009-CAC-038` | A cache key SHALL NOT use ambiguous wildcard or silently defaulted coordinates. |
| `CSAA-009-CAC-039` | A cache entry SHALL preserve exact authoritative basis and transform version. |
| `CSAA-009-CAC-040` | A cache admission SHALL revalidate integrity, dependency, provenance, health, authorization, and currentness. |
| `CSAA-009-CAC-041` | A stale cache entry SHALL NOT support a current or green result. |
| `CSAA-009-CAC-042` | A quarantined cache entry SHALL NOT support ordinary reads or publication. |
| `CSAA-009-CAC-043` | Cache corruption SHALL NOT propagate into a publication or response. |
| `CSAA-009-CAC-044` | Cache eviction SHALL NOT invalidate authoritative immutable records. |
| `CSAA-009-CAC-045` | A negative cache entry SHALL retain closed-population, supported-execution, health, and non-vacuity evidence. |
| `CSAA-009-CAC-046` | A failed, unsupported, partial, stale, conflicting, timed-out, cancelled, resource-refused, unexecuted, or redacted-to-empty result SHALL NOT be cached as successful absence. |
| `CSAA-009-CAC-047` | Cross-principal cache reuse SHALL require explicit information-control compatibility. |
| `CSAA-009-CAC-048` | A cache miss SHALL follow only the registered operation's authorized authoritative path or exact typed non-success path. |
| `CSAA-009-CAC-049` | Cache reuse SHALL retain the original observation time rather than fabricate a new fact time. |
| `CSAA-009-CAC-050` | Cache invalidation SHALL race safely with reads and publication. |
| `CSAA-009-CAC-051` | A derivative index SHALL be rebuildable from exact authoritative inputs. |
| `CSAA-009-CAC-052` | A cache copy across components SHALL preserve exact bytes, basis, protection, and integrity. |
| `CSAA-009-CAC-053` | An unknown cache state SHALL be treated as a miss and non-current. |

### 28.12 Concurrency, claims, fencing, and idempotency

| ID | Requirement |
| --- | --- |
| `CSAA-009-CON-001` | Concurrency SHALL preserve `CON-01`: An immutable record identity is written at most once for one governed byte representation; equal retries deduplicate without losing attempt provenance. |
| `CSAA-009-CON-002` | Concurrency SHALL preserve `CON-02`: A current binding changes only through fenced compare-and-publish against an exact expected generation and predecessor. |
| `CSAA-009-CON-003` | Concurrency SHALL preserve `CON-03`: A stale writer, expired claim holder, superseded generation, or cancelled attempt cannot publish. |
| `CSAA-009-CON-004` | Concurrency SHALL preserve `CON-04`: Readers retain one immutable view for a logical result even while writers publish successors. |
| `CSAA-009-CON-005` | Concurrency SHALL preserve `CON-05`: Invalidation concurrent with reuse makes the reuse decision non-current unless ordering and dependency equality are proven. |
| `CSAA-009-CON-006` | Concurrency SHALL preserve `CON-06`: Retention or garbage collection concurrent with an admitted reader preserves the reader or produces an explicit authorized termination. |
| `CSAA-009-CON-007` | Concurrency SHALL preserve `CON-07`: Migration concurrent with reads and writes follows the declared compatibility and cutover mode; no request crosses formats implicitly. |
| `CSAA-009-CON-008` | Concurrency SHALL preserve `CON-08`: Two writers for the same stable publication channel may compute candidates, but at most one wins one current-binding generation. |
| `CSAA-009-CON-009` | Concurrency SHALL preserve `CON-09`: Writers for different partitions cannot share mutable state or publication authority by accidental key collision. |
| `CSAA-009-CON-010` | Concurrency SHALL preserve `CON-10`: Duplicate request or job delivery creates a new attempt observation or deduplicated response without duplicating immutable material or external effects. |
| `CSAA-009-CON-011` | Concurrency SHALL preserve `CON-11`: A claim conveys bounded coordination rights only; it never conveys semantic, security, provider, oracle, gate, or approval authority. |
| `CSAA-009-CON-012` | Concurrency SHALL preserve `CON-12`: Every claim and checkpoint is bound to exact operation, attempt, partition, generation, claim/lifecycle identity, owner, acquisition, immutable expected work-state revision, independently advancing claim revision, expiry/liveness rule, and fencing identity. |
| `CSAA-009-CON-013` | Concurrency SHALL preserve `CON-13`: Clock skew or delayed liveness cannot allow an old owner to commit after a newer fencing generation exists. |
| `CSAA-009-CON-014` | Concurrency SHALL preserve `CON-14`: Cancellation races preserve the actual linearization order: pre-commit cancellation blocks publication, post-commit cancellation cannot rewrite it. |
| `CSAA-009-CON-015` | Concurrency SHALL preserve `CON-15`: Authorization or policy change concurrent with a read/write is resolved at the profile-declared boundary and never widens access. |
| `CSAA-009-CON-016` | Concurrency SHALL preserve `CON-16`: Every concurrency conflict is visible as conflict, retry, refusal, supersession, or cancellation rather than last-writer-wins data loss. |
| `CSAA-009-CON-017` | Idempotency family `IDEM-01` SHALL use its registered stable scope. |
| `CSAA-009-CON-018` | Idempotency family `IDEM-02` SHALL use its registered stable scope. |
| `CSAA-009-CON-019` | Idempotency family `IDEM-03` SHALL use its registered stable scope. |
| `CSAA-009-CON-020` | Idempotency family `IDEM-04` SHALL use its registered stable scope. |
| `CSAA-009-CON-021` | Idempotency family `IDEM-05` SHALL use its registered stable scope. |
| `CSAA-009-CON-022` | Idempotency family `IDEM-06` SHALL use its registered stable scope. |
| `CSAA-009-CON-023` | Idempotency family `IDEM-07` SHALL use its registered stable scope. |
| `CSAA-009-CON-024` | Idempotency family `IDEM-08` SHALL use its registered stable scope. |
| `CSAA-009-CON-025` | Idempotency family `IDEM-09` SHALL use its registered stable scope. |
| `CSAA-009-CON-026` | Idempotency family `IDEM-10` SHALL use its registered stable scope. |
| `CSAA-009-CON-027` | Idempotency family `IDEM-11` SHALL use its registered stable scope. |
| `CSAA-009-CON-028` | Idempotency family `IDEM-12` SHALL use its registered stable scope. |
| `CSAA-009-CON-029` | Every idempotency key SHALL include key kind and key version. |
| `CSAA-009-CON-030` | Attempt, worker, schedule, clock, and physical location SHALL remain provenance rather than retry-key identity. |
| `CSAA-009-CON-031` | An equal idempotency key with unequal projected inputs SHALL be a conflict. |
| `CSAA-009-CON-032` | An idempotency key SHALL NOT confer authority or prove an effect occurred. |
| `CSAA-009-CON-033` | An uncertain effect with an idempotency key SHALL still receive authoritative reconciliation. |
| `CSAA-009-CON-034` | Idempotency evidence SHALL remain retained through the maximum retry, response-loss, recovery, and uncertainty horizon. |
| `CSAA-009-CON-035` | Unavailable idempotency evidence SHALL prevent blind repetition of an uncertain effect. |
| `CSAA-009-CON-036` | Equal request bytes without a caller admission key SHALL NOT prove caller-intended deduplication. |
| `CSAA-009-CON-037` | A publication claim SHALL convey only bounded coordination rights. |
| `CSAA-009-CON-038` | A work claim SHALL bind exact operation, attempt, partition, generation, owner, liveness rule, and fencing identity. |
| `CSAA-009-CON-039` | A successful work-claim acquisition SHALL atomically mint a fresh `claimId`, bind exact `expectedWorkStateRevision`, initialize `claimRevision`, and bind a fresh `claimTokenDigest`, while a failed acquisition creates none of them and renewal changes only the claim revision. |
| `CSAA-009-CON-040` | An expired claim holder SHALL NOT publish. |
| `CSAA-009-CON-041` | A newer fencing generation SHALL prevent every older owner from committing. |
| `CSAA-009-CON-042` | Clock skew SHALL NOT restore an old owner's publication right. |
| `CSAA-009-CON-043` | Duplicate delivery SHALL retain distinct attempt evidence. |
| `CSAA-009-CON-044` | Idempotency SHALL suppress duplicate effects without suppressing duplicate-delivery evidence. |
| `CSAA-009-CON-045` | An idempotency identity with incompatible inputs SHALL be a conflict. |
| `CSAA-009-CON-046` | A retry SHALL retain a distinct attempt identity and reason. |
| `CSAA-009-CON-047` | An uncertain external effect SHALL be reconciled before reassignment or retry. |
| `CSAA-009-CON-048` | Concurrent invalidation SHALL make unproven reuse non-current. |
| `CSAA-009-CON-049` | Concurrent migration SHALL preserve one declared compatibility and routing mode. |
| `CSAA-009-CON-050` | Concurrent garbage collection SHALL preserve admitted readers and active recovery roots. |
| `CSAA-009-CON-051` | A cancellation/publication race SHALL preserve actual linearization order. |
| `CSAA-009-CON-052` | A last-writer-wins overwrite SHALL NOT replace fenced publication semantics. |

### 28.13 Scheduling, admission, backpressure, and fairness

| ID | Requirement |
| --- | --- |
| `CSAA-009-SCH-001` | A work-unit lifecycle SHALL permit only the registered source-to-target transitions. |
| `CSAA-009-SCH-002` | Scheduling SHALL follow the declared dependency plan. |
| `CSAA-009-SCH-003` | A scheduling cycle SHALL require an explicitly bounded concern-owned iteration or fixpoint definition. |
| `CSAA-009-SCH-004` | Every work unit SHALL bind exact inputs, outputs, dependencies, partition, authorization, budget, timeout, cancellation, retry, durability, and side-effect class. |
| `CSAA-009-SCH-005` | Scheduling order variation SHALL preserve dependencies, isolation, equivalence, budgets, and fairness. |
| `CSAA-009-SCH-006` | Admission SHALL evaluate safe capacity before accepting bounded work. |
| `CSAA-009-SCH-007` | An accepted queued request SHALL expose its queue class and progress semantics. |
| `CSAA-009-SCH-008` | Backpressure SHALL queue, defer, reject, or shed work with an explicit reason. |
| `CSAA-009-SCH-009` | Backpressure SHALL NOT report refused work as success. |
| `CSAA-009-SCH-010` | Scope narrowing SHALL require explicit caller agreement and a new exact request identity. |
| `CSAA-009-SCH-011` | A fairness rule SHALL define its population, priority classes, allocation, starvation treatment, cancellation, and measurement. |
| `CSAA-009-SCH-012` | An admitted class SHALL NOT starve indefinitely contrary to its declared fairness rule. |
| `CSAA-009-SCH-013` | A resource-refused request SHALL remain non-green. |
| `CSAA-009-SCH-014` | A deadline-infeasible request SHALL receive explicit refusal or bounded admission treatment. |
| `CSAA-009-SCH-015` | A queue position SHALL NOT become semantic priority or authority. |
| `CSAA-009-SCH-016` | A scheduler SHALL NOT assume a distributed topology. |
| `CSAA-009-SCH-017` | A scheduler SHALL NOT allow workflow machinery to redefine semantic boundaries. |
| `CSAA-009-SCH-018` | A provider shortage SHALL preserve unsupported, partial, failed, or queued state explicitly. |
| `CSAA-009-SCH-019` | Progress SHALL be reported for long-running admitted work. |
| `CSAA-009-SCH-020` | Resource budgets SHALL include CPU, memory, disk, file, process, time, output, traversal, and authorized network dimensions as applicable. |
| `CSAA-009-SCH-021` | An unsafe unbounded request SHALL be refused rather than admitted under an implicit infinite budget. |

### 28.14 Cancellation

| ID | Requirement |
| --- | --- |
| `CSAA-009-CAN-001` | A cancellation request SHALL bind the exact target operation, attempt, state revision, and concurrency token. |
| `CSAA-009-CAN-002` | Cancellation SHALL propagate across every declared child, provider, process, and external boundary. |
| `CSAA-009-CAN-003` | Cancellation SHALL record request, acknowledgment, effective point, continuing work, partial material, cleanup, and terminal state. |
| `CSAA-009-CAN-004` | A cancellation request SHALL NOT prove that execution stopped. |
| `CSAA-009-CAN-005` | Material produced before effective cancellation SHALL retain its actual identity, provenance, health, and eligibility. |
| `CSAA-009-CAN-006` | A cancelled candidate SHALL NOT become current unless publication linearized first. |
| `CSAA-009-CAN-007` | A late cancellation SHALL NOT rewrite a completed immutable publication. |
| `CSAA-009-CAN-008` | Cancellation cleanup SHALL preserve evidence needed for reconciliation and audit. |
| `CSAA-009-CAN-009` | Cancellation SHALL fence stale child publication rights. |
| `CSAA-009-CAN-010` | An uncertain external effect during cancellation SHALL be reconciled. |
| `CSAA-009-CAN-011` | A cancellation timeout SHALL produce explicit degraded state. |
| `CSAA-009-CAN-012` | Cancellation SHALL NOT coerce partial output to success. |
| `CSAA-009-CAN-013` | Cancellation retry SHALL preserve distinct attempts and idempotency. |
| `CSAA-009-CAN-014` | Forced termination SHALL remain an in-scope recovery fault. |
| `CSAA-009-CAN-015` | Shutdown cancellation SHALL persist every required checkpoint and incomplete-work record. |

### 28.15 Failure, retry, degradation, and no false green

| ID | Requirement |
| --- | --- |
| `CSAA-009-DEG-001` | A later realization SHALL treat `OPS-F01` according to its registered failure consequence. |
| `CSAA-009-DEG-002` | A later realization SHALL treat `OPS-F02` according to its registered failure consequence. |
| `CSAA-009-DEG-003` | A later realization SHALL treat `OPS-F03` according to its registered failure consequence. |
| `CSAA-009-DEG-004` | A later realization SHALL treat `OPS-F04` according to its registered failure consequence. |
| `CSAA-009-DEG-005` | A later realization SHALL treat `OPS-F05` according to its registered failure consequence. |
| `CSAA-009-DEG-006` | A later realization SHALL treat `OPS-F06` according to its registered failure consequence. |
| `CSAA-009-DEG-007` | A later realization SHALL treat `OPS-F07` according to its registered failure consequence. |
| `CSAA-009-DEG-008` | A later realization SHALL treat `OPS-F08` according to its registered failure consequence. |
| `CSAA-009-DEG-009` | A later realization SHALL treat `OPS-F09` according to its registered failure consequence. |
| `CSAA-009-DEG-010` | A later realization SHALL treat `OPS-F10` according to its registered failure consequence. |
| `CSAA-009-DEG-011` | A later realization SHALL treat `OPS-F11` according to its registered failure consequence. |
| `CSAA-009-DEG-012` | A later realization SHALL treat `OPS-F12` according to its registered failure consequence. |
| `CSAA-009-DEG-013` | A later realization SHALL treat `OPS-F13` according to its registered failure consequence. |
| `CSAA-009-DEG-014` | A later realization SHALL treat `OPS-F14` according to its registered failure consequence. |
| `CSAA-009-DEG-015` | A later realization SHALL treat `OPS-F15` according to its registered failure consequence. |
| `CSAA-009-DEG-016` | A later realization SHALL treat `OPS-F16` according to its registered failure consequence. |
| `CSAA-009-DEG-017` | The injected condition `JAN-CSAA-006-DEG-001` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-018` | The injected condition `JAN-CSAA-006-DEG-002` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-019` | The injected condition `JAN-CSAA-006-DEG-003` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-020` | The injected condition `JAN-CSAA-006-DEG-004` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-021` | The injected condition `JAN-CSAA-006-DEG-005` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-022` | The injected condition `JAN-CSAA-006-DEG-006` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-023` | The injected condition `JAN-CSAA-006-DEG-007` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-024` | The injected condition `JAN-CSAA-006-DEG-008` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-025` | The injected condition `JAN-CSAA-006-DEG-009` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-026` | The injected condition `JAN-CSAA-006-DEG-010` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-027` | The injected condition `JAN-CSAA-006-DEG-011` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-028` | The injected condition `JAN-CSAA-006-DEG-012` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-029` | The injected condition `JAN-CSAA-006-DEG-013` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-030` | The injected condition `JAN-CSAA-006-DEG-014` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-031` | The injected condition `JAN-CSAA-006-DEG-015` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-032` | The injected condition `JAN-CSAA-006-DEG-016` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-033` | The injected condition `JAN-CSAA-006-DEG-017` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-034` | The injected condition `JAN-CSAA-006-DEG-018` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-035` | The injected condition `JAN-CSAA-006-DEG-019` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-036` | The injected condition `JAN-CSAA-006-DEG-020` SHALL remain explicit and non-green across every applicable result surface. |
| `CSAA-009-DEG-037` | Every failure SHALL map to an exact retry class and terminal consequence. |
| `CSAA-009-DEG-038` | A retry policy SHALL record attempt bound, delay, deadline, budget, cancellation, idempotency, and terminal outcome. |
| `CSAA-009-DEG-039` | Retry exhaustion SHALL NOT become successful emptiness. |
| `CSAA-009-DEG-040` | Provider failure SHALL remain visible in every dependent result. |
| `CSAA-009-DEG-041` | A provider fallback SHALL create distinct invocation and provenance evidence. |
| `CSAA-009-DEG-042` | A provider fallback SHALL require later exact qualification and compatibility. |
| `CSAA-009-DEG-043` | A provider result SHALL NOT become semantic truth through agreement or health. |
| `CSAA-009-DEG-044` | A last-known-good result SHALL remain labeled historical. |
| `CSAA-009-DEG-045` | A prerequisite failure SHALL NOT become a successful empty dependent result. |
| `CSAA-009-DEG-046` | One successful child SHALL NOT hide a failed or ineligible child. |
| `CSAA-009-DEG-047` | A redacted or omitted child SHALL preserve its consequence in aggregation. |
| `CSAA-009-DEG-048` | An unknown internal failure SHALL map to a safe non-green outcome. |
| `CSAA-009-DEG-049` | Failure diagnostics SHALL remain bounded and non-disclosing. |
| `CSAA-009-DEG-050` | A manual retry SHALL NOT bypass reconciliation, authorization, or idempotency. |
| `CSAA-009-DEG-051` | A degraded publication SHALL identify every completed and missing region. |

### 28.16 Crash, restart, reconciliation, and recovery

| ID | Requirement |
| --- | --- |
| `CSAA-009-RCV-001` | Recovery at `JAN-CSAA-009-RCV-001` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-002` | Recovery at `JAN-CSAA-009-RCV-002` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-003` | Recovery at `JAN-CSAA-009-RCV-003` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-004` | Recovery at `JAN-CSAA-009-RCV-004` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-005` | Recovery at `JAN-CSAA-009-RCV-005` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-006` | Recovery at `JAN-CSAA-009-RCV-006` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-007` | Recovery at `JAN-CSAA-009-RCV-007` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-008` | Recovery at `JAN-CSAA-009-RCV-008` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-009` | Recovery at `JAN-CSAA-009-RCV-009` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-010` | Recovery at `JAN-CSAA-009-RCV-010` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-011` | Recovery at `JAN-CSAA-009-RCV-011` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-012` | Recovery at `JAN-CSAA-009-RCV-012` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-013` | Recovery at `JAN-CSAA-009-RCV-013` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-014` | Recovery at `JAN-CSAA-009-RCV-014` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-015` | Recovery at `JAN-CSAA-009-RCV-015` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-016` | Recovery at `JAN-CSAA-009-RCV-016` SHALL produce the registered recovery result. |
| `CSAA-009-RCV-017` | A recovery-epoch lifecycle SHALL permit only the registered source-to-target transitions. |
| `CSAA-009-RCV-018` | Recovery SHALL begin from durable evidence rather than process memory. |
| `CSAA-009-RCV-019` | Recovery SHALL establish exact profile, partition, migration epoch, and current-binding generation. |
| `CSAA-009-RCV-020` | Recovery SHALL verify intents, immutable material, claims, attempts, checkpoints, open integrity incidents, incomplete or outcome-unknown repair executions, bindings, and audit gaps. |
| `CSAA-009-RCV-021` | Recovery SHALL classify every incomplete operation before resumption or replay. |
| `CSAA-009-RCV-022` | Recovery SHALL reconcile every uncertain internal or external effect. |
| `CSAA-009-RCV-023` | Recovery SHALL fence stale workers. |
| `CSAA-009-RCV-024` | Recovery SHALL preserve every prior valid publication. |
| `CSAA-009-RCV-025` | Recovery SHALL NOT duplicate immutable facts, Engineering Evidence Records, Analyzer Finding Records, audit events, or external effects. |
| `CSAA-009-RCV-026` | Recovery SHALL complete one exact eligible successor when successor publication is intended, or authoritatively preserve or revalidate the existing publication or complete an already committed result without republishing; every unresolved outcome remains explicitly non-green. |
| `CSAA-009-RCV-027` | Recovery SHALL record actions, residual material, cleanup, and unresolved risk. |
| `CSAA-009-RCV-028` | Startup SHALL reconcile incomplete publication, cancellation, retry, migration, retention, exact integrity-incident, repair-execution, and audit state before write readiness. |
| `CSAA-009-RCV-029` | Read readiness during write recovery SHALL expose every degraded dimension. |
| `CSAA-009-RCV-030` | Shutdown SHALL stop new admission before drain or bounded cancellation. |
| `CSAA-009-RCV-031` | Shutdown SHALL persist required checkpoints and intents before releasing claims. |
| `CSAA-009-RCV-032` | A forced shutdown SHALL NOT imply a clean terminal state. |
| `CSAA-009-RCV-033` | Every operational profile SHALL map all sixteen recovery coordinates to concrete injection points. |
| `CSAA-009-RCV-034` | A multi-commit topology SHALL prove one logical all-or-nothing publication result. |
| `CSAA-009-RCV-035` | A lost response after publication SHALL be reconstructed without republishing. |
| `CSAA-009-RCV-036` | An abandoned candidate SHALL be collected only after roots, grace, holds, and races close. |
| `CSAA-009-RCV-037` | A recovery failure SHALL leave exact currentness and availability explicit. |

### 28.17 Integrity, corruption, repair, and rebuild

| ID | Requirement |
| --- | --- |
| `CSAA-009-INT-001` | Integrity handling SHALL treat `COR-01` according to its registered initial response. |
| `CSAA-009-INT-002` | Integrity handling SHALL treat `COR-02` according to its registered initial response. |
| `CSAA-009-INT-003` | Integrity handling SHALL treat `COR-03` according to its registered initial response. |
| `CSAA-009-INT-004` | Integrity handling SHALL treat `COR-04` according to its registered initial response. |
| `CSAA-009-INT-005` | Integrity handling SHALL treat `COR-05` according to its registered initial response. |
| `CSAA-009-INT-006` | Integrity handling SHALL treat `COR-06` according to its registered initial response. |
| `CSAA-009-INT-007` | Integrity handling SHALL treat `COR-07` according to its registered initial response. |
| `CSAA-009-INT-008` | Integrity handling SHALL treat `COR-08` according to its registered initial response. |
| `CSAA-009-INT-009` | Integrity handling SHALL treat `COR-09` according to its registered initial response. |
| `CSAA-009-INT-010` | Integrity handling SHALL treat `COR-10` according to its registered initial response. |
| `CSAA-009-INT-011` | Integrity handling SHALL treat `COR-11` according to its registered initial response. |
| `CSAA-009-INT-012` | Integrity handling SHALL treat `COR-12` according to its registered initial response. |
| `CSAA-009-INT-013` | Integrity handling SHALL treat `COR-13` according to its registered initial response. |
| `CSAA-009-INT-014` | Integrity handling SHALL treat `COR-14` according to its registered initial response. |
| `CSAA-009-INT-015` | Integrity handling SHALL treat `COR-15` according to its registered initial response. |
| `CSAA-009-INT-016` | Integrity handling SHALL treat `COR-16` according to its registered initial response. |
| `CSAA-009-INT-017` | Integrity SHALL be verified at byte, record, collection, publication, current-binding, derivative, backup, restore/migration, and audit layers. |
| `CSAA-009-INT-018` | A digest failure SHALL block dependent ordinary use. |
| `CSAA-009-INT-019` | A missing collection member SHALL invalidate the complete declared collection. |
| `CSAA-009-INT-020` | A cross-partition member SHALL be treated as an integrity and security incident. |
| `CSAA-009-INT-021` | A broken publication manifest SHALL degrade or withdraw affected readiness. |
| `CSAA-009-INT-022` | Repair SHALL NOT mutate an immutable governed record in place. |
| `CSAA-009-INT-023` | Exact-byte recovery SHALL verify an independently integrity-valid retained copy. |
| `CSAA-009-INT-024` | Derivative rebuild SHALL bind authoritative inputs and transform versions. |
| `CSAA-009-INT-025` | Reanalysis repair SHALL create a new attempt and records. |
| `CSAA-009-INT-026` | Semantic correction SHALL create an explicit successor. |
| `CSAA-009-INT-027` | Backup restore repair SHALL occur in isolation and reconcile later actions. |
| `CSAA-009-INT-028` | Permanent loss SHALL record affected populations and residual risk. |
| `CSAA-009-INT-029` | A repair plan SHALL bind exact `integrityIncidentId` and `repairExecutionId` and name defect, blast radius, basis, transform, authority, verification, rollback, and audit. |
| `CSAA-009-INT-030` | Repaired material SHALL remain isolated until every admission predicate passes. |
| `CSAA-009-INT-031` | An incomplete repair SHALL NOT become current. |
| `CSAA-009-INT-032` | A rebuild SHALL NOT erase the corruption event or prior history. |
| `CSAA-009-INT-033` | An unknown integrity defect SHALL fail closed for current and green use. |
| `CSAA-009-INT-034` | A current-binding mismatch SHALL trigger reconciliation before service readiness. |
| `CSAA-009-INT-035` | An audit integrity gap SHALL remain explicit until deterministically recovered. |
| `CSAA-009-INT-036` | A collision SHALL preserve both observed byte claims without overwriting the existing record. |

### 28.18 Backup, restore, and disaster recovery

| ID | Requirement |
| --- | --- |
| `CSAA-009-BAK-001` | A backup set SHALL bind exact profile, format, contract, migration, encryption, consistency, inventory, integrity, policy, and restore prerequisites. |
| `CSAA-009-BAK-002` | A backup SHALL identify every included and excluded security partition and publication channel. |
| `CSAA-009-BAK-003` | A backup SHALL retain per-item and aggregate integrity evidence. |
| `CSAA-009-BAK-004` | A backup SHALL preserve information-control and retention classifications. |
| `CSAA-009-BAK-005` | A backup SHALL bind owner-supplied recovery-point and recovery-time objectives. |
| `CSAA-009-BAK-006` | A copied directory, replica, snapshot, graph export, or archive SHALL NOT count as a valid backup without the backup-set contract. |
| `CSAA-009-BAK-007` | A live replica SHALL NOT be presumed an independent backup. |
| `CSAA-009-BAK-008` | Restore SHALL occur into an isolated non-current partition. |
| `CSAA-009-BAK-009` | Restore SHALL validate identity, completeness, integrity, encryption, key access, and compatibility. |
| `CSAA-009-BAK-010` | Restore SHALL NOT overwrite newer authoritative history. |
| `CSAA-009-BAK-011` | Restore SHALL reconcile every later publication, invalidation, revocation, policy, retention, deletion, key, and security action. |
| `CSAA-009-BAK-012` | Restore SHALL NOT revive deleted, revoked, stale, superseded, or unauthorized material as current. |
| `CSAA-009-BAK-013` | Restore SHALL run required integrity, migration, authorization, and recovery validation. |
| `CSAA-009-BAK-014` | Restore activation SHALL use a new fenced current-binding generation. |
| `CSAA-009-BAK-015` | A failed or incomplete restore SHALL NOT become current. |
| `CSAA-009-BAK-016` | A backup SHALL NOT restore expired authority or semantic freshness. |
| `CSAA-009-BAK-017` | Disaster-recovery readiness SHALL report actual last verified backup and isolated restore test separately. |
| `CSAA-009-BAK-018` | Backup configuration SHALL NOT count as recovery evidence. |
| `CSAA-009-BAK-019` | Backup destruction SHALL independently check retention and holds. |
| `CSAA-009-BAK-020` | A restore SHALL retain exact failure, rollback, residual-loss, and test evidence. |

### 28.19 Physical migration, dual-run, cutover, and fallback

| ID | Requirement |
| --- | --- |
| `CSAA-009-MIG-001` | A physical migration SHALL preserve state ``PROPOSED`` with the registered consequence. |
| `CSAA-009-MIG-002` | A physical migration SHALL preserve state ``PRECONDITIONS_BLOCKED`` with the registered consequence. |
| `CSAA-009-MIG-003` | A physical migration SHALL preserve state ``PREPARED`` with the registered consequence. |
| `CSAA-009-MIG-004` | A physical migration SHALL preserve state ``BACKFILLING`` with the registered consequence. |
| `CSAA-009-MIG-005` | A physical migration SHALL preserve state ``SHADOWING`` with the registered consequence. |
| `CSAA-009-MIG-006` | A physical migration SHALL preserve state ``DUAL_RUNNING`` with the registered consequence. |
| `CSAA-009-MIG-007` | A physical migration SHALL preserve state ``RECONCILING`` with the registered consequence. |
| `CSAA-009-MIG-008` | A physical migration SHALL preserve state ``CUTOVER_READY`` with the registered consequence. |
| `CSAA-009-MIG-009` | A physical migration SHALL preserve state ``CUTTING_OVER`` with the registered consequence. |
| `CSAA-009-MIG-010` | A physical migration SHALL preserve state ``CUTOVER_OUTCOME_UNKNOWN`` with the registered consequence. |
| `CSAA-009-MIG-011` | A physical migration SHALL preserve state ``TARGET_CURRENT`` with the registered consequence. |
| `CSAA-009-MIG-012` | A physical migration SHALL preserve state ``WITHDRAWN`` with the registered consequence. |
| `CSAA-009-MIG-013` | A physical migration SHALL preserve state ``ROLLED_BACK`` with the registered consequence. |
| `CSAA-009-MIG-014` | A physical migration SHALL preserve state ``FAILED`` with the registered consequence. |
| `CSAA-009-MIG-015` | A physical migration SHALL preserve state ``DECOMMISSION_PENDING`` with the registered consequence. |
| `CSAA-009-MIG-016` | A physical migration SHALL preserve state ``COMPLETE`` with the registered consequence. |
| `CSAA-009-MIG-017` | A migration lifecycle SHALL permit only the registered source-to-target transitions. |
| `CSAA-009-MIG-018` | A migration transition SHALL append a monotonic migration-state revision. |
| `CSAA-009-MIG-019` | A migration execution SHALL allocate a fresh `migrationExecutionId` at `PROPOSED` for one exact immutable source/target profile pair and require a new identity for any pair change. |
| `CSAA-009-MIG-020` | A physical migration SHALL consume exact logical compatibility evidence from `JAN-CSAA-007`. |
| `CSAA-009-MIG-021` | A physical migration SHALL NOT claim logical compatibility by successful copying. |
| `CSAA-009-MIG-022` | Migration SHALL inventory source/target profiles, formats, partitions, material, policies, audit, backup, and retention. |
| `CSAA-009-MIG-023` | Migration SHALL define exact transform, loss, rejection, identity, digest, reference, ordering, and key behavior. |
| `CSAA-009-MIG-024` | Migration SHALL define old-reader/new-writer and new-reader/old-writer treatment. |
| `CSAA-009-MIG-025` | Backfill SHALL preserve checkpoints, duplicates, changes, and exact source basis. |
| `CSAA-009-MIG-026` | Shadow output SHALL remain non-current derived evidence. |
| `CSAA-009-MIG-027` | Dual-run SHALL retain every lane result, provenance, difference, and failure. |
| `CSAA-009-MIG-028` | Dual-run comparison SHALL evaluate semantic and operational dimensions rather than counts or latency alone. |
| `CSAA-009-MIG-029` | Dual-write SHALL NOT be presumed by this design. |
| `CSAA-009-MIG-030` | A future dual-write profile SHALL define authority, ordering, partial-write, retry, reconciliation, and read-routing behavior. |
| `CSAA-009-MIG-031` | A partial dual-write SHALL NOT be hidden by later success. |
| `CSAA-009-MIG-032` | Cutover SHALL have one observable current-routing linearization boundary per partition. |
| `CSAA-009-MIG-033` | In-flight reads SHALL retain pinned views across cutover. |
| `CSAA-009-MIG-034` | Ordinary requests SHALL NOT mix source and target formats. |
| `CSAA-009-MIG-035` | Fallback SHALL name and verify the exact fallback profile and publication. |
| `CSAA-009-MIG-036` | Fallback SHALL NOT become implicit rollback. |
| `CSAA-009-MIG-037` | Rollback SHALL reconcile every accepted post-cutover change. |
| `CSAA-009-MIG-038` | Rollback SHALL NOT discard or duplicate accepted work. |
| `CSAA-009-MIG-039` | An unreconcilable migration SHALL remain non-green and require external decision. |
| `CSAA-009-MIG-040` | Decommission SHALL close rollback, retention, hold, export, removal, secret, backup, and reference predicates. |
| `CSAA-009-MIG-041` | Migration execution SHALL require separate authority. |
| `CSAA-009-MIG-042` | A migration race SHALL preserve fencing, reader pinning, exact `expectedRoutingGeneration`, resulting `routingGeneration`, and their stable routing scope without overloading publication generation. |
| `CSAA-009-MIG-043` | A migration failure SHALL leave one explicit safe current mode. |
| `CSAA-009-MIG-044` | A target engine SHALL NOT become current through shadow success alone. |

### 28.20 Retention, redaction, deletion, and garbage collection

| ID | Requirement |
| --- | --- |
| `CSAA-009-RET-001` | Garbage-collection reachability SHALL include `G01`: Every current Publication Manifest and transitively required immutable member. |
| `CSAA-009-RET-002` | Garbage-collection reachability SHALL include `G02`: Every retained historical Publication Manifest and predecessor/successor lineage required by policy. |
| `CSAA-009-RET-003` | Garbage-collection reachability SHALL include `G03`: Every admitted read view, continuation, export, or recovery operation within its protection interval. |
| `CSAA-009-RET-004` | Garbage-collection reachability SHALL include `G04`: Every active candidate, durable publication intent, claim, checkpoint, retry, and cancellation/recovery action. |
| `CSAA-009-RET-005` | Garbage-collection reachability SHALL include `G05`: Every retained raw artifact, normalization basis, conflict, explanation, and reproducibility dependency. |
| `CSAA-009-RET-006` | Garbage-collection reachability SHALL include `G06`: Every finding, treatment, exception/disposition reference, oracle, and audit lineage required by its owner/policy. |
| `CSAA-009-RET-007` | Garbage-collection reachability SHALL include `G07`: Every legal/authority/security/investigation hold and retention reference. |
| `CSAA-009-RET-008` | Garbage-collection reachability SHALL include `G08`: Every backup or archive whose policy requires the live material or its independently valid copy. |
| `CSAA-009-RET-009` | Garbage-collection reachability SHALL include `G09`: Every migration, rollback, fallback, shadow/dual-run, repair, corruption, and residual-loss dependency. |
| `CSAA-009-RET-010` | Garbage-collection reachability SHALL include `G10`: Every contract, semantic-owner, compatibility, generated-derivative, provider/method, policy, and key reference required to interpret retained material. |
| `CSAA-009-RET-011` | Garbage-collection reachability SHALL include `G11`: Every fixture/oracle/conformance subject or evidence retained for independent review under its exact standing. |
| `CSAA-009-RET-012` | Garbage-collection reachability SHALL include `G12`: Every explicitly declared external root supplied by a recognized owner and validated under the operational profile. |
| `CSAA-009-RET-013` | Every material class SHALL have separate confidentiality, access, and retention classifications. |
| `CSAA-009-RET-014` | A retention action SHALL NOT rewrite semantic identity or historical occurrence. |
| `CSAA-009-RET-015` | Archival SHALL preserve exact identity, integrity, policy, and authorized retrieval semantics. |
| `CSAA-009-RET-016` | Redaction SHALL create a derivative and exact Redaction Manifest. |
| `CSAA-009-RET-017` | Redaction SHALL NOT fabricate emptiness, absence, completeness, safety, health, or success. |
| `CSAA-009-RET-018` | Physical deletion SHALL record exact authority, population, surfaces, time, result, and residual copies. |
| `CSAA-009-RET-019` | Cryptographic erasure SHALL bind the exact key scope and verification. |
| `CSAA-009-RET-020` | Compaction SHALL preserve every logical identity, reference, lineage, provenance, policy, audit relation, and reconstruction basis. |
| `CSAA-009-RET-021` | Cache expiry SHALL NOT alter authoritative material state. |
| `CSAA-009-RET-022` | A recognized hold SHALL block conflicting deletion and compaction. |
| `CSAA-009-RET-023` | A hold SHALL bind owner, authority, scope, reason, review, and release. |
| `CSAA-009-RET-024` | Absence of a hold release SHALL NOT authorize deletion. |
| `CSAA-009-RET-025` | Derived material SHALL NOT receive weaker protection or longer retention than its conservative source composition absent explicit authority. |
| `CSAA-009-RET-026` | A restrictive policy change SHALL invalidate incompatible views, caches, and derivatives. |
| `CSAA-009-RET-027` | A policy change SHALL NOT retroactively erase prior handling evidence. |
| `CSAA-009-RET-028` | Authorization SHALL precede traversal, aggregation, retrieval, count, cache, export, restore, repair, and existence disclosure. |
| `CSAA-009-RET-029` | Garbage collection SHALL record roots, closure version, cutoff, grace, active use, holds, proposed population, authority, and verification. |
| `CSAA-009-RET-030` | Unknown reachability SHALL block deletion or broaden retention. |
| `CSAA-009-RET-031` | Unreachability SHALL NOT equal deletion authority. |
| `CSAA-009-RET-032` | Deletion authority SHALL NOT prove every physical copy was removed. |
| `CSAA-009-RET-033` | Garbage collection SHALL account for caches, backups, logs, migrations, and provider outputs. |
| `CSAA-009-RET-034` | A lineage-severing compaction SHALL be treated as corruption. |
| `CSAA-009-RET-035` | A valid admitted read SHALL be protected from concurrent retention removal. |
| `CSAA-009-RET-036` | A retention failure SHALL preserve exact physical availability and residual risk. |
| `CSAA-009-RET-037` | Finding history SHALL remain append-oriented despite physical retention action. |

### 28.21 Security, confidentiality, encryption, and containment

| ID | Requirement |
| --- | --- |
| `CSAA-009-SEC-001` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-001` with its registered treatment. |
| `CSAA-009-SEC-002` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-002` with its registered treatment. |
| `CSAA-009-SEC-003` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-003` with its registered treatment. |
| `CSAA-009-SEC-004` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-004` with its registered treatment. |
| `CSAA-009-SEC-005` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-005` with its registered treatment. |
| `CSAA-009-SEC-006` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-006` with its registered treatment. |
| `CSAA-009-SEC-007` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-007` with its registered treatment. |
| `CSAA-009-SEC-008` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-008` with its registered treatment. |
| `CSAA-009-SEC-009` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-009` with its registered treatment. |
| `CSAA-009-SEC-010` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-010` with its registered treatment. |
| `CSAA-009-SEC-011` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-011` with its registered treatment. |
| `CSAA-009-SEC-012` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-012` with its registered treatment. |
| `CSAA-009-SEC-013` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-013` with its registered treatment. |
| `CSAA-009-SEC-014` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-014` with its registered treatment. |
| `CSAA-009-SEC-015` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-015` with its registered treatment. |
| `CSAA-009-SEC-016` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-016` with its registered treatment. |
| `CSAA-009-SEC-017` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-017` with its registered treatment. |
| `CSAA-009-SEC-018` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-018` with its registered treatment. |
| `CSAA-009-SEC-019` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-019` with its registered treatment. |
| `CSAA-009-SEC-020` | Operational containment SHALL cover hostile coordinate `JAN-CSAA-008-HST-020` with its registered treatment. |
| `CSAA-009-SEC-021` | Repository content SHALL be treated as untrusted subject data. |
| `CSAA-009-SEC-022` | Subject acquisition SHALL remain read-only. |
| `CSAA-009-SEC-023` | Provider input SHALL be limited to exact authorized material. |
| `CSAA-009-SEC-024` | Provider output SHALL use a separate bounded location. |
| `CSAA-009-SEC-025` | Process creation SHALL be denied by default. |
| `CSAA-009-SEC-026` | Network access SHALL be denied by default. |
| `CSAA-009-SEC-027` | A process or network grant SHALL bind exact operation, subject, principal, purpose, endpoint/path, data, method, time, resource, audit, and revocation. |
| `CSAA-009-SEC-028` | Operational state SHALL be isolated across every applicable subject, evidence, principal, tenant, purpose, and policy coordinate. |
| `CSAA-009-SEC-029` | A tenant-not-applicable value SHALL cite an exact owner and basis. |
| `CSAA-009-SEC-030` | Every operational profile SHALL declare encryption and integrity properties for persisted, transported, backup, temporary, migration, and export material. |
| `CSAA-009-SEC-031` | This Draft SHALL NOT select a cryptographic algorithm, library, service, key manager, certificate authority, or hardware. |
| `CSAA-009-SEC-032` | Encryption failure SHALL deny use or safely degrade availability. |
| `CSAA-009-SEC-033` | Encryption failure SHALL NOT fall back to plaintext. |
| `CSAA-009-SEC-034` | Key rotation SHALL preserve exact versions, coverage, availability, rollback, and residual-loss evidence. |
| `CSAA-009-SEC-035` | Secret values SHALL NOT enter controlled manifests, cache keys, logs, metrics, diagnostics, or audit payloads. |
| `CSAA-009-SEC-036` | Only opaque secret references SHALL enter controlled operational records. |
| `CSAA-009-SEC-037` | Workers and providers SHALL receive minimum credential and environment scope. |
| `CSAA-009-SEC-038` | Unauthorized access SHALL be evaluated before any protected observation. |
| `CSAA-009-SEC-039` | A denial SHALL disclose only safe authorized details. |
| `CSAA-009-SEC-040` | Redaction SHALL preserve count, path, shape, existence, timing, diagnostic, and raw-preview non-disclosure. |
| `CSAA-009-SEC-041` | Hostile test execution SHALL require separate authorization and containment. |
| `CSAA-009-SEC-042` | A host escape, source mutation, secret read, network egress, unbounded process tree, or cross-partition disclosure SHALL be critical failure. |
| `CSAA-009-SEC-043` | An encryption key SHALL NOT confer authorization. |
| `CSAA-009-SEC-044` | Encryption SHALL NOT replace record-grain redaction. |
| `CSAA-009-SEC-045` | A security-control failure SHALL degrade readiness explicitly. |

### 28.22 Audit and reconstructability

| ID | Requirement |
| --- | --- |
| `CSAA-009-AUD-001` | Audit evidence SHALL cover `AUD-01`: Request, authentication, authorization allow/deny/redaction, and delegation use. |
| `CSAA-009-AUD-002` | Audit evidence SHALL cover `AUD-02`: Subject acquisition, path resolution/refusal, identity observation, and TOCTOU detection. |
| `CSAA-009-AUD-003` | Audit evidence SHALL cover `AUD-03`: Plan, scheduling, admission, queue, fairness, backpressure, shedding, and resource refusal. |
| `CSAA-009-AUD-004` | Audit evidence SHALL cover `AUD-04`: Claim acquire/renew/expire/reassign, fencing generation, stale-worker refusal, and duplicate delivery. |
| `CSAA-009-AUD-005` | Audit evidence SHALL cover `AUD-05`: Provider/tool invocation, capability grant, raw capture, validation, normalization, disagreement, and failure. |
| `CSAA-009-AUD-006` | Audit evidence SHALL cover `AUD-06`: Candidate assembly, sealing, eligibility, refusal, quarantine, abandonment, and orphan cleanup correlated by exact `candidateLifecycleId`, optional post-seal `publicationCandidateId`, state revision, and `publicationCommitId` only where that later decision exists. |
| `CSAA-009-AUD-007` | Audit evidence SHALL cover `AUD-07`: Publication intent, compare-and-publish, conflict, commit, uncertain outcome, response, and supersession correlated without merging candidate lifecycle, sealed content, or commit identity. |
| `CSAA-009-AUD-008` | Audit evidence SHALL cover `AUD-08`: Query/read-view acquisition, continuation, export, raw retrieval, comparison, and non-disclosure. |
| `CSAA-009-AUD-009` | Audit evidence SHALL cover `AUD-09`: Dependency observation, invalidation, broadening, revalidation, recomputation, and clean-full comparison. |
| `CSAA-009-AUD-010` | Audit evidence SHALL cover `AUD-10`: Cache construction, admission, hit, miss, stale, invalidation, quarantine, eviction, and cross-partition denial. |
| `CSAA-009-AUD-011` | Audit evidence SHALL cover `AUD-11`: Cancellation, timeout, retry, external-effect reconciliation, recovery, cleanup, and terminal outcome. |
| `CSAA-009-AUD-012` | Audit evidence SHALL cover `AUD-12`: Integrity check, collision, corruption, blast-radius analysis, repair, rebuild, and residual loss. |
| `CSAA-009-AUD-013` | Audit evidence SHALL cover `AUD-13`: Backup creation/verification/destruction, restore attempt/validation/activation, and disaster-recovery test. |
| `CSAA-009-AUD-014` | Audit evidence SHALL cover `AUD-14`: Migration proposal, backfill, shadow, dual-run/write, reconciliation, cutover, fallback, rollback, and decommission. |
| `CSAA-009-AUD-015` | Audit evidence SHALL cover `AUD-15`: Classification/policy/hold change, redaction, archive, deletion, cryptographic erasure, compaction, and garbage collection. |
| `CSAA-009-AUD-016` | Audit evidence SHALL cover `AUD-16`: Encryption/key/certificate/secret availability, rotation, revocation, emergency access, and plaintext fallback refusal. |
| `CSAA-009-AUD-017` | Audit evidence SHALL cover `AUD-17`: Startup/shutdown readiness transition, dependency loss, capacity state, degraded mode, and recovery completion. |
| `CSAA-009-AUD-018` | Audit evidence SHALL cover `AUD-18`: Administrative configuration/profile change, authority reference, reviewer action, and unsupported manual override attempt. |
| `CSAA-009-AUD-019` | Every audit event SHALL bind safe actor, authority, subject, operation, causation, action, result, and time as applicable. |
| `CSAA-009-AUD-020` | Audit causation and correlation SHALL remain acyclic over finalized records. |
| `CSAA-009-AUD-021` | Audit reverse navigation SHALL be derived rather than encoded as a forward cycle. |
| `CSAA-009-AUD-022` | Audit evidence SHALL remain immutable and information-controlled. |
| `CSAA-009-AUD-023` | Audit payloads SHALL NOT carry unrestricted source, secrets, credentials, raw provider payloads, host paths, counts, shape, or existence. |
| `CSAA-009-AUD-024` | A protected reference or digest SHALL be used when the raw payload is unnecessary. |
| `CSAA-009-AUD-025` | A log message SHALL NOT substitute for a mandatory audit event. |
| `CSAA-009-AUD-026` | An audit gap SHALL degrade reconstructability and readiness. |
| `CSAA-009-AUD-027` | A deterministically recoverable audit gap SHALL be reconciled from durable facts. |
| `CSAA-009-AUD-028` | An irrecoverable audit gap SHALL remain explicit with affected scope and residual risk. |
| `CSAA-009-AUD-029` | An administrative override attempt SHALL be audited without granting authority. |
| `CSAA-009-AUD-030` | Every security-relevant denial SHALL retain safe reconstructable evidence. |
| `CSAA-009-AUD-031` | Audit retention SHALL respect its own policy and every applicable hold. |
| `CSAA-009-AUD-032` | Audit access SHALL be authorized before correlation, count, path, or existence disclosure. |
| `CSAA-009-AUD-033` | Telemetry SHALL NOT become audit authority. |

### 28.23 Health and readiness

| ID | Requirement |
| --- | --- |
| `CSAA-009-HLT-001` | Health reporting SHALL expose `H01`: Process/component liveness. |
| `CSAA-009-HLT-002` | Health reporting SHALL expose `H02`: Read readiness. |
| `CSAA-009-HLT-003` | Health reporting SHALL expose `H03`: Write/publication readiness. |
| `CSAA-009-HLT-004` | Health reporting SHALL expose `H04`: Recovery readiness. |
| `CSAA-009-HLT-005` | Health reporting SHALL expose `H05`: Storage/material integrity. |
| `CSAA-009-HLT-006` | Health reporting SHALL expose `H06`: Security-control readiness. |
| `CSAA-009-HLT-007` | Health reporting SHALL expose `H07`: Dependency/provider execution health. |
| `CSAA-009-HLT-008` | Health reporting SHALL expose `H08`: Capability coverage. |
| `CSAA-009-HLT-009` | Health reporting SHALL expose `H09`: Evidence freshness/currentness. |
| `CSAA-009-HLT-010` | Health reporting SHALL expose `H10`: Finding and conflict state. |
| `CSAA-009-HLT-011` | Health reporting SHALL expose `H11`: Later gate outcome. |
| `CSAA-009-HLT-012` | Health reporting SHALL expose `H12`: Backlog/fairness/capacity. |
| `CSAA-009-HLT-013` | Health reporting SHALL expose `H13`: Migration/backup/retention state. |
| `CSAA-009-HLT-014` | Health reporting SHALL expose `H14`: Observability/reconstructability. |
| `CSAA-009-HLT-015` | A successful `HealthResponse` under exact `JAN-CSAA-007@1.0.0` SHALL preserve the five existing response axes, carry H01–H14 through the registered `operationalDimensions` representation, and retain the registered `healthView` binding without an aggregate healthy Boolean. |
| `CSAA-009-HLT-016` | An H01–H14 or no-current success representation SHALL require closure of `JAN-CSAA-009-A007-HLT-GAP-001` by the 007 shape owner. |
| `CSAA-009-HLT-017` | A non-content health view SHALL NOT authorize semantic traversal. |
| `CSAA-009-HLT-018` | Health reporting SHALL NOT collapse independent dimensions into one Boolean. |
| `CSAA-009-HLT-019` | Liveness SHALL NOT imply read or write readiness. |
| `CSAA-009-HLT-020` | Provider availability SHALL NOT imply semantic completeness or correctness. |
| `CSAA-009-HLT-021` | Freshness SHALL NOT imply semantic correctness. |
| `CSAA-009-HLT-022` | Operational readiness SHALL NOT imply a gate outcome. |
| `CSAA-009-HLT-023` | Unknown or unobserved state SHALL NOT be reported as healthy. |
| `CSAA-009-HLT-024` | Readiness SHALL be scoped to operation class, partition, profile, and observation cutoff. |
| `CSAA-009-HLT-025` | Read readiness SHALL be independently reportable from write readiness. |
| `CSAA-009-HLT-026` | Recovery readiness SHALL remain degraded while uncertain intents or audit gaps remain. |
| `CSAA-009-HLT-027` | Security readiness SHALL require enforceable authentication, authorization, information control, encryption, secrets, and audit. |
| `CSAA-009-HLT-028` | Integrity readiness SHALL require valid material, collections, manifests, and current bindings. |
| `CSAA-009-HLT-029` | Backlog health SHALL expose queue age, fairness risk, saturation, refusal, and headroom separately. |
| `CSAA-009-HLT-030` | A health observation SHALL bind its method, cutoff, omitted regions, and diagnostics. |
| `CSAA-009-HLT-031` | A historical health observation SHALL NOT float to a later current claim. |
| `CSAA-009-HLT-032` | A current-version Health Response SHALL represent the no-effective-RGP state as reasoned `not-applicable` in `laterGateOutcome`. |

### 28.24 Capacity, telemetry, and workload measurement

| ID | Requirement |
| --- | --- |
| `CSAA-009-CAP-001` | Performance evidence SHALL cover workload `W01`: Initial full repository analysis. |
| `CSAA-009-CAP-002` | Performance evidence SHALL cover workload `W02`: Incremental reanalysis. |
| `CSAA-009-CAP-003` | Performance evidence SHALL cover workload `W03`: Execution-evidence ingestion. |
| `CSAA-009-CAP-004` | Performance evidence SHALL cover workload `W04`: Snapshot publication. |
| `CSAA-009-CAP-005` | Performance evidence SHALL cover workload `W05`: Interactive query. |
| `CSAA-009-CAP-006` | Performance evidence SHALL cover workload `W06`: Cross-snapshot comparison. |
| `CSAA-009-CAP-007` | Telemetry SHALL bind exact profile, subject class, operation, method, time window, sampling, units, omissions, redaction, retention, and collector health. |
| `CSAA-009-CAP-008` | Metrics SHALL cover latency, queue, resource, cache, invalidation, publication, recovery, integrity, backup, migration, retention, and readiness dimensions. |
| `CSAA-009-CAP-009` | Metrics SHALL NOT contain unrestricted protected source, secrets, credentials, or raw provider payloads. |
| `CSAA-009-CAP-010` | Metrics SHALL NOT become semantic evidence or authority by themselves. |
| `CSAA-009-CAP-011` | A numeric performance threshold SHALL name its owner, scope, environment, measurement method, evidence, and authority. |
| `CSAA-009-CAP-012` | This Draft SHALL NOT invent numeric performance, capacity, retention, retry, encryption, RPO, or RTO thresholds. |
| `CSAA-009-CAP-013` | A profile SHALL refuse unsafe unbounded work rather than assume infinite capacity. |
| `CSAA-009-CAP-014` | Resource measurements SHALL include CPU, memory, disk, process, time, output, and authorized network dimensions as applicable. |
| `CSAA-009-CAP-015` | Queue measurement SHALL preserve priority, fairness, starvation, and shedding context. |
| `CSAA-009-CAP-016` | Cache metrics SHALL distinguish hit, miss, admission rejection, invalidation, stale, quarantine, and eviction. |
| `CSAA-009-CAP-017` | Publication metrics SHALL distinguish validation, conflict, uncertain commit, linearization, response, audit, and cleanup latency. |
| `CSAA-009-CAP-018` | Publication telemetry SHALL correlate candidate lifecycle, sealed-content, and commit phases without merging their identities or disclosing protected identifier values. |
| `CSAA-009-CAP-019` | Recovery metrics SHALL distinguish detection, reconciliation, repair, restore, resumption, and residual loss. |
| `CSAA-009-CAP-020` | A sampled metric SHALL disclose sampling and aggregation limitations. |
| `CSAA-009-CAP-021` | Telemetry collector failure SHALL remain an explicit health degradation. |
| `CSAA-009-CAP-022` | A performance comparison SHALL bind exact subject, environment, profile, provider, configuration, and workload. |

### 28.25 Deterministic replay and reconciliation

| ID | Requirement |
| --- | --- |
| `CSAA-009-REP-001` | An immutable prepublication replay-basis manifest identified by exact `replayBasisManifestId` SHALL bind the exact `operationalProfileInstantiationId` and every other semantically material finalized input/influence while excluding that attempt's own future outputs, candidate, Publication Manifest, decision, audit completion, health completion, and output-complete manifest. |
| `CSAA-009-REP-002` | An immutable output-complete replay manifest identified by exact `replayManifestId` SHALL bind its replay basis, attempt, actual outcomes, and finalized outputs without becoming a dependency of the same candidate, Publication Manifest, or basis whose outputs it reports. |
| `CSAA-009-REP-003` | Replay SHALL create a new attempt and observations. |
| `CSAA-009-REP-004` | Replay SHALL NOT overwrite the original attempt or result. |
| `CSAA-009-REP-005` | Replay SHALL preserve every omission, failure, conflict, redaction, and allowed-difference policy. |
| `CSAA-009-REP-006` | A deterministic replay SHALL NOT establish semantic correctness by itself. |
| `CSAA-009-REP-007` | Publication reconciliation SHALL compare intent, candidate, predecessor, current binding, response, and audit. |
| `CSAA-009-REP-008` | External-effect reconciliation SHALL compare stable effect identity, observed state, attempts, and compensation/retry state. |
| `CSAA-009-REP-009` | Cache reconciliation SHALL compare authoritative basis, dependencies, transform, admission, and stored derivative. |
| `CSAA-009-REP-010` | Restore reconciliation SHALL compare backup cutoff, restored inventory, later actions, policy, and prospective binding. |
| `CSAA-009-REP-011` | Migration reconciliation SHALL compare source/target inventory, changes, semantic/operational differences, routing, and rollback. |
| `CSAA-009-REP-012` | Retention reconciliation SHALL compare authorized population, every physical surface, holds, residual copies, and audit. |
| `CSAA-009-REP-013` | Audit reconciliation SHALL compare durable actions and intents with recorded events and causation. |
| `CSAA-009-REP-014` | Unreconciled uncertainty SHALL block completion or currentness as applicable. |
| `CSAA-009-REP-015` | Newest timestamp SHALL NOT resolve an uncertain effect. |
| `CSAA-009-REP-016` | Last-writer state SHALL NOT resolve an uncertain effect. |
| `CSAA-009-REP-017` | A provider response SHALL NOT resolve an uncertain effect without exact identity and durable evidence. |
| `CSAA-009-REP-018` | A process exit SHALL NOT prove an external effect did not occur. |
| `CSAA-009-REP-019` | A rebuild SHALL preserve exact authoritative inputs and transform versions. |
| `CSAA-009-REP-020` | Allowed nondeterminism SHALL be declared before replay and verified independently. |
| `CSAA-009-REP-021` | A replay result SHALL remain bound to its own exact time, environment, and attempt. |

### 28.26 Storage and orchestration alternatives

| ID | Requirement |
| --- | --- |
| `CSAA-009-ALT-001` | Alternative `STO-A` SHALL remain open under its registered strongest case, opposing case, and evidence need. |
| `CSAA-009-ALT-002` | Alternative `STO-B` SHALL remain open under its registered strongest case, opposing case, and evidence need. |
| `CSAA-009-ALT-003` | Alternative `STO-C` SHALL remain open under its registered strongest case, opposing case, and evidence need. |
| `CSAA-009-ALT-004` | Alternative `ORC-A` SHALL remain open under its registered strongest case, opposing case, and evidence need. |
| `CSAA-009-ALT-005` | Alternative `ORC-B` SHALL remain open under its registered strongest case, opposing case, and evidence need. |
| `CSAA-009-ALT-006` | Alternative `ORC-C` SHALL remain open under its registered strongest case, opposing case, and evidence need. |
| `CSAA-009-ALT-007` | Every alternative comparison SHALL evaluate `C01`: Exact subject binding and mixed-revision prevention. |
| `CSAA-009-ALT-008` | Every alternative comparison SHALL evaluate `C02`: Atomic publication and predecessor visibility. |
| `CSAA-009-ALT-009` | Every alternative comparison SHALL evaluate `C03`: Raw provenance and provider-disagreement retention. |
| `CSAA-009-ALT-010` | Every alternative comparison SHALL evaluate `C04`: Confidentiality, offline use, isolation, and least privilege. |
| `CSAA-009-ALT-011` | Every alternative comparison SHALL evaluate `C05`: Cancellation, timeout, crash recovery, and deterministic replay. |
| `CSAA-009-ALT-012` | Every alternative comparison SHALL evaluate `C06`: Full/incremental equivalence and invalidation safety. |
| `CSAA-009-ALT-013` | Every alternative comparison SHALL evaluate `C07`: Query latency and whole-repository throughput. |
| `CSAA-009-ALT-014` | Every alternative comparison SHALL evaluate `C08`: Operational complexity, portability, retention, export, and provider removal. |
| `CSAA-009-ALT-015` | Every alternative comparison SHALL evaluate `C09`: Independent verification of failure paths without implementation self-attestation. |
| `CSAA-009-ALT-016` | The current commission SHALL NOT select any storage alternative. |
| `CSAA-009-ALT-017` | The current commission SHALL NOT select any orchestration alternative. |
| `CSAA-009-ALT-018` | The nine decision criteria SHALL remain independently accountable despite seven presentation groupings. |
| `CSAA-009-ALT-019` | A future decision SHALL compare exact candidate profiles and versions. |
| `CSAA-009-ALT-020` | A future decision SHALL search for and disposition a materially stronger alternative. |
| `CSAA-009-ALT-021` | A future decision SHALL bind exact workload, subject, security, environment, and budget identities. |
| `CSAA-009-ALT-022` | A future decision SHALL require independently executed failure and recovery evidence. |
| `CSAA-009-ALT-023` | A future decision SHALL retain every uncertainty and residual risk. |
| `CSAA-009-ALT-024` | A future decision SHALL include the strongest opposing case. |
| `CSAA-009-ALT-025` | A future decision SHALL address portability, licensing, procurement, cost, lock-in, and removal. |
| `CSAA-009-ALT-026` | A future decision SHALL define safe default, rollout, cutover, fallback, rollback, and exit criteria. |
| `CSAA-009-ALT-027` | A future decision SHALL receive independent architecture, security, operations, V&V, and integrity review. |
| `CSAA-009-ALT-028` | An authority-bearing selection SHALL require an applicable exact recorded decision. |
| `CSAA-009-ALT-029` | This design SHALL NOT authorize an experiment. |
| `CSAA-009-ALT-030` | A later experiment SHALL name tools, dependencies, writes, network, credentials, data, cleanup, evidence limits, and authority. |

### 28.27 Logical-operation and typed-error behavior

| ID | Requirement |
| --- | --- |
| `CSAA-009-OPS-001` | Operation `csaa.contract.negotiate` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-002` | Operation `csaa.subject.describe` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-003` | Operation `csaa.snapshot.get` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-004` | Operation `csaa.analysis.plan` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-005` | Operation `csaa.analysis.start` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-006` | Operation `csaa.analysis.status` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-007` | Operation `csaa.analysis.cancel` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-008` | Operation `csaa.query.execute` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-009` | Operation `csaa.slice.compute` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-010` | Operation `csaa.comparison.compute` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-011` | Operation `csaa.impact.compute` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-012` | Operation `csaa.finding.get` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-013` | Operation `csaa.finding.list` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-014` | Operation `csaa.raw.get` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-015` | Operation `csaa.fixture.describe` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-016` | Operation `csaa.gate.evaluate` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-017` | Operation `csaa.health.get` SHALL preserve its registered operational behavior, prohibited implication, and cache-admission-failure treatment. |
| `CSAA-009-OPS-018` | Operational failure class `OPS-F01` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-019` | Operational failure class `OPS-F02` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-020` | Operational failure class `OPS-F03` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-021` | Operational failure class `OPS-F04` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-022` | Operational failure class `OPS-F05` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-023` | Operational failure class `OPS-F06` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-024` | Operational failure class `OPS-F07` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-025` | Operational failure class `OPS-F08` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-026` | Operational failure class `OPS-F09` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-027` | Operational failure class `OPS-F10` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-028` | Operational failure class `OPS-F11` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-029` | Operational failure class `OPS-F12` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-030` | Operational failure class `OPS-F13` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-031` | Operational failure class `OPS-F14` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-032` | Operational failure class `OPS-F15` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-033` | Operational failure class `OPS-F16` SHALL use only its exact `JAN-CSAA-007@1.0.0` registered code mapping and code-specific safe payload. |
| `CSAA-009-OPS-034` | The operation registry SHALL retain exactly seventeen permanent operation IDs from exact `JAN-CSAA-007@1.0.0`. |
| `CSAA-009-OPS-035` | Operational dispatch SHALL preserve exactly seventeen valid operation/input pairings. |
| `CSAA-009-OPS-036` | Operational dispatch SHALL reject all 272 invalid cross-pairings. |
| `CSAA-009-OPS-037` | Operational dispatch SHALL NOT invent, widen, substitute, or silently rebind a subject. |
| `CSAA-009-OPS-038` | Operational dispatch SHALL NOT widen authorization. |
| `CSAA-009-OPS-039` | Every seven-stage validation outcome SHALL be durably reconstructable as applicable. |
| `CSAA-009-OPS-040` | A required earlier validation failure SHALL make downstream material inert. |
| `CSAA-009-OPS-041` | Recovery SHALL NOT retroactively turn an earlier required validation failure into pass. |
| `CSAA-009-OPS-042` | All 77 typed errors in exact `JAN-CSAA-007@1.0.0` SHALL preserve exact code-specific safe-details behavior. |
| `CSAA-009-OPS-043` | Every typed error SHALL preserve state/outcome compatibility, redaction, retry, publication consequence, and audit allocation. |
| `CSAA-009-OPS-044` | A genuinely unexpected internal error SHALL map exactly to `CSAA-E-INTERNAL-UNEXPECTED` as a safe non-green outcome. |
| `CSAA-009-OPS-045` | A response error SHALL NOT fall through to an operation-specific success result. |
| `CSAA-009-OPS-046` | A live-target operation SHALL enforce state revision and concurrency token. |
| `CSAA-009-OPS-047` | A gate evaluation SHALL be refused while no exact effective RGP exists. |
| `CSAA-009-OPS-048` | A `HealthResponse` under exact `JAN-CSAA-007@1.0.0` SHALL preserve its five registered response axes in addition to H01–H14 `operationalDimensions`. |
| `CSAA-009-OPS-049` | A finding operation SHALL NOT create disposition or gate effects. |
| `CSAA-009-OPS-050` | A fixture operation SHALL NOT create or confer a fixture or oracle. |
| `CSAA-009-OPS-051` | A plan operation SHALL NOT imply analysis execution. |
| `CSAA-009-OPS-052` | A comparison operation SHALL preserve each subject lane independently. |
| `CSAA-009-OPS-053` | A raw retrieval SHALL enforce information-control, retention, integrity, and non-disclosure. |

### 28.28 Executable-verification handoff

| ID | Requirement |
| --- | --- |
| `CSAA-009-TST-001` | `JAN-CSAA-008` SHALL retain executable operational-conformance ownership. |
| `CSAA-009-TST-002` | The later suite SHALL bind all sixteen recovery coordinates to implementation-specific injection points. |
| `CSAA-009-TST-003` | The later suite SHALL retain before/after durable-material and current-binding observations for every recovery coordinate. |
| `CSAA-009-TST-004` | The later suite SHALL prove duplicate prevention and prior-publication preservation at every applicable recovery coordinate. |
| `CSAA-009-TST-005` | The later suite SHALL execute the 160 degradation-surface coordinates independently. |
| `CSAA-009-TST-006` | The later suite SHALL cover all twenty hostile classes with operational containment. |
| `CSAA-009-TST-007` | The later suite SHALL cover all six workload classes under exact profiles and budgets. |
| `CSAA-009-TST-008` | The later suite SHALL test cache admission, stale rejection, cross-partition denial, corruption fallback, and rejection of `UNKNOWN`-state attempts to revive incompatible, quarantined, or eviction-pending identities. |
| `CSAA-009-TST-009` | The later suite SHALL test reader pinning, mixed-revision prevention, and premature `publicationCommitId` refusal across publication races. |
| `CSAA-009-TST-010` | The later suite SHALL test fencing, stale workers, duplicate delivery, and uncertain effect reconciliation. |
| `CSAA-009-TST-011` | The later suite SHALL test backup validation, isolated restore, later-action reconciliation, and activation refusal. |
| `CSAA-009-TST-012` | The later suite SHALL test migration backfill, shadow/dual comparison, authorized withdrawal/no-go, cutover, fallback, rollback, and decommission. |
| `CSAA-009-TST-013` | The later suite SHALL test retention holds, redaction non-fabrication, GC roots, and lineage preservation. |
| `CSAA-009-TST-014` | The later suite SHALL test encryption failure, key rotation, secret non-disclosure, and plaintext fallback refusal. |
| `CSAA-009-TST-015` | The later suite SHALL test independent health dimensions and no aggregate-Boolean coercion. |
| `CSAA-009-TST-016` | A test specification SHALL NOT count as execution evidence. |
| `CSAA-009-TST-017` | A proposed expected judgment SHALL NOT count as a conferred oracle. |
| `CSAA-009-TST-018` | A documentation verification pass SHALL NOT turn a physical test nonpass green. |
| `CSAA-009-TST-019` | The 008 affected successor SHALL preserve test-method ownership while consuming 009 operational meaning. |
| `CSAA-009-TST-020` | Post-009 reconciliation SHALL update stale current-language without rewriting historical exact candidates. |
| `CSAA-009-TST-021` | The later suite SHALL execute and independently report `JAN-CSAA-009-TST-PHASE-001` with its registered injection and required outcome. |
| `CSAA-009-TST-022` | The later suite SHALL execute and independently report `JAN-CSAA-009-TST-PHASE-002` with its registered injection and required outcome. |
| `CSAA-009-TST-023` | The later suite SHALL execute and independently report `JAN-CSAA-009-TST-PHASE-003` with its registered injection and required outcome. |
| `CSAA-009-TST-024` | The later suite SHALL execute and independently report `JAN-CSAA-009-TST-PHASE-004` with its registered injection and required outcome. |
| `CSAA-009-TST-025` | The later suite SHALL execute and independently report `JAN-CSAA-009-TST-PHASE-005` with its registered injection and required outcome. |
| `CSAA-009-TST-026` | The later suite SHALL execute and independently report `JAN-CSAA-009-TST-PHASE-006` with its registered injection and required outcome. |

### 28.29 Cross-package handoffs

| ID | Requirement |
| --- | --- |
| `CSAA-009-XPK-001` | `JAN-CSAA-003` SHALL receive the operational evidence design without a claim of executed equivalence. |
| `CSAA-009-XPK-002` | `JAN-CSAA-007` SHALL receive every missing operational representability allocation, including self-excluding content-identifier preimages and noncircular publication/replay references, while retaining wire-shape ownership. |
| `CSAA-009-XPK-003` | `JAN-CSAA-008` SHALL receive affected incremental, cache, concurrency, recovery, migration, security, performance, and all six phase-identity/digest-cycle negative-case reconciliations. |
| `CSAA-009-XPK-004` | `JAN-CSAA-010` SHALL receive exact operational currentness, health, request, cancellation, retry, and escalation surfaces. |
| `CSAA-009-XPK-005` | `JAN-CSAA-011` SHALL receive only concrete analyzer provider and adapter qualification, substitution, and removal under its current allocation. |
| `CSAA-009-XPK-006` | The final consolidated refresh SHALL reconcile dated 005 evidence before exact-corpus freeze. |
| `CSAA-009-XPK-007` | A 007 successor SHALL NOT be presumed to exist before its own authoring and objective closure. |
| `CSAA-009-XPK-008` | An 008 successor SHALL preserve every executable nonpass absent actual execution. |
| `CSAA-009-XPK-009` | A later implementation SHALL instantiate one exact operational profile. |
| `CSAA-009-XPK-010` | A later implementation SHALL bind exact artifacts, configuration, deployment, security policy, provider set, storage layout, and migration state. |
| `CSAA-009-XPK-011` | A later implementation SHALL NOT infer authority from this Draft. |
| `CSAA-009-XPK-012` | An independent oracle owner SHALL remain distinct from implementation and provider execution. |
| `CSAA-009-XPK-013` | An independent V&V executor SHALL bind the exact implementation subject and profile. |
| `CSAA-009-XPK-014` | A full Wave 3 reconciliation SHALL cover 007, 008, and 009 exact candidates. |
| `CSAA-009-XPK-015` | Deferred author self-reviews SHALL run only after affected reconciliation stabilizes. |
| `CSAA-009-XPK-016` | Open 003, 004, and 006 execution gaps SHALL remain open until their own evidence exists. |
| `CSAA-009-XPK-017` | A provider qualification SHALL NOT be inferred from operational fallback success. |
| `CSAA-009-XPK-018` | A storage decision SHALL NOT be inferred from a proof-of-concept. |
| `CSAA-009-XPK-019` | A sponsor review SHALL remain deferred to the final exact full-corpus package. |
| `CSAA-009-XPK-020` | Every downstream handoff SHALL preserve nonperformance, owner, exact input, and verification. |

### 28.30 Objective verification and acceptance

| ID | Requirement |
| --- | --- |
| `CSAA-009-VFY-001` | Objective verification SHALL bind exact candidate bytes and SHA-256. |
| `CSAA-009-VFY-002` | Objective verification SHALL validate UTF-8 without BOM, CRLF-only storage, and one terminal CRLF. |
| `CSAA-009-VFY-003` | Objective verification SHALL validate heading, table, fence, link, and anchor integrity. |
| `CSAA-009-VFY-004` | Objective verification SHALL validate every source byte count and digest. |
| `CSAA-009-VFY-005` | Objective verification SHALL reconcile every local requirement ID exactly once. |
| `CSAA-009-VFY-006` | Objective verification SHALL reconcile exactly 3,933 inherited rows as 31 direct adopted-program, 3,796 predecessor local-catalog, 53 direct Canon, and 53 Wave 3 readiness rows. |
| `CSAA-009-VFY-007` | Objective verification SHALL validate family contiguity and non-reuse. |
| `CSAA-009-VFY-008` | Objective verification SHALL validate exactly one deontic modal per local requirement row. |
| `CSAA-009-VFY-009` | Objective verification SHALL validate all thirty operational-profile facets. |
| `CSAA-009-VFY-010` | Objective verification SHALL validate every closed registry population, applicability matrix, identity projection, idempotency family, and count. |
| `CSAA-009-VFY-011` | Objective verification SHALL validate all three self-excluding content-identifier preimages and all six phase-identity/digest-cycle negative-case allocations. |
| `CSAA-009-VFY-012` | Objective verification SHALL validate every closed coordination, publication, read-view, invalidation, cache, and migration transition relation. |
| `CSAA-009-VFY-013` | Objective verification SHALL validate dependency, cache, concurrency, recovery, migration, retention, security, audit, health, currentness, compatibility, and typed-error-gap closure. |
| `CSAA-009-VFY-014` | Objective verification SHALL validate all 144 incremental mutation-dimension allocations. |
| `CSAA-009-VFY-015` | Objective verification SHALL validate all 160 degradation-surface cells. |
| `CSAA-009-VFY-016` | Objective verification SHALL validate all sixteen recovery-coordinate bindings. |
| `CSAA-009-VFY-017` | Objective verification SHALL validate all twenty hostile allocations. |
| `CSAA-009-VFY-018` | Objective verification SHALL validate six workload and six alternative populations. |
| `CSAA-009-VFY-019` | Objective verification SHALL validate the seventeen-operation and 272-invalid-pairing handoff. |
| `CSAA-009-VFY-020` | Objective verification SHALL reject every provider, topology, mechanism, execution, authority, and false-green claim. |
| `CSAA-009-VFY-021` | Author self-review SHALL remain post-ledger and post-reconciliation work. |

---

## 29. Verification and later-execution matrix

### 29.1 Author-side objective methods

The requirement ledger and objective verification record carry mutable execution state. This stable design defines methods and evidence without embedding a future pass.
| Method | Subject | Required evidence |
| --- | --- | --- |
| `JAN-CSAA-009-VER-CTL-001` | Control and authority | Metadata, commission, no-expansion, historical/current lifecycle, and prohibited-claim scans |
| `JAN-CSAA-009-VER-SRC-001` | Exact source intake | Nine member identities, exact immutable semantic-baseline 007/008 packages, exact correction-only 007/008 source successors, no forward-named corrective evidence, immutable historical predecessor evidence, unchanged 001–006 row-source intake, and `31 + 3,796 + 53 + 53 = 3,933` inherited rows |
| `JAN-CSAA-009-VER-OWN-001` | Concern ownership | Single-owner matrix, non-overload, no authority, provider/oracle/shape/test separation |
| `JAN-CSAA-009-VER-MOD-001` | Operational model | Five planes, four distinct operational concepts, and all thirty ordered profile facets |
| `JAN-CSAA-009-VER-IDN-001` | Identity and isolation | Twelve-coordinate projection universe, five distinct key projections, 37 registry rows naming 40 independently preserved operational identities, three self-excluding content-identifier preimages, seventeen-operation applicability, phase separation, digest-purpose, and collision denial |
| `JAN-CSAA-009-VER-PST-001` | Persistence and durability | Thirty-one conceptual roles, closed coordination transitions, phase-safe checkpoint semantics, eighteen material classes, three commitments, eight barriers, immutable admission, and ownership-safe representability |
| `JAN-CSAA-009-VER-PUB-001` | Atomic publication | Twelve states, closed transition relation, self-excluding sealed-content identity, lifecycle/content/decision separation with decision identity absent until authoritative finalization, sixteen predicates with PASS-for-applicable and exact source-owned reasoned N/A treatment, stable-channel compare-and-publish, authoritative uncertainty, audit ordering, and partial atomicity |
| `JAN-CSAA-009-VER-QRY-001` | Read views | Seven shared lifecycle states, closed transitions, pre-acquisition lifecycle identity, typed IDs minted only at acquisition, committed static/execution publication vector, non-publication RawMaterialReadView, health-observation boundary, continuation, retention, and no implicit reanalysis |
| `JAN-CSAA-009-VER-INV-001` | Invalidation | Eighteen dependency categories, seven observation results, ten states, phase-safe observation/binding, closed transitions, conservative closure, broadening, and positive freshness |
| `JAN-CSAA-009-VER-INC-001` | Incrementality | Same-successor rule, eight dimensions, population manifest, 18×8=144 allocation, 32 supply-chain assignments, and allowed differences |
| `JAN-CSAA-009-VER-CAC-001` | Cache | Sixteen admission predicates, eleven states, closed transitions, exact-key prestate and lifecycle minting, descriptor phase binding, origin-preserving UNKNOWN recovery, exact 007 compatibility decisions, operation-specific miss behavior, negative-result non-vacuity, and corruption |
| `JAN-CSAA-009-VER-CON-001` | Concurrency | Sixteen invariants, twelve idempotency families, phase-safe claim acquisition, expected work-state guard separation, fencing, duplicate delivery, collision, retention horizon, races, TOCTOU, and uncertainty |
| `JAN-CSAA-009-VER-SCH-001` | Scheduling | Dependency plan, work-unit facets, admission, backpressure, fairness, starvation, progress, and finite budgets |
| `JAN-CSAA-009-VER-CAN-001` | Cancellation | Target binding, propagation, effective point, late ordering, partial material, cleanup, and shutdown |
| `JAN-CSAA-009-VER-DEG-001` | Degradation | Sixteen failure classes, six retry classes, twenty degradation classes, 160-cell matrix, fallback, and aggregation |
| `JAN-CSAA-009-VER-RCV-001` | Recovery | Nine principles, all sixteen recovery boundaries, startup/shutdown, concrete-injection allocation, and duplicate prevention |
| `JAN-CSAA-009-VER-INT-001` | Integrity | Nine layers, sixteen corruption classes, blast radius, quarantine, repair, deterministic rebuild, and residual loss |
| `JAN-CSAA-009-VER-BAK-001` | Backup/restore | Backup contract, consistency, isolation, integrity, later-action reconciliation, activation, and objective-source boundary |
| `JAN-CSAA-009-VER-MIG-001` | Migration | Sixteen states, closed transitions, proposal-time immutable source/target binding, authorized withdrawal/no-go, fifteen preconditions, backfill, shadow, dual modes, uncertain cutover, fallback, rollback, and decommission |
| `JAN-CSAA-009-VER-RET-001` | Retention/GC | Nine action classes, holds, derivative inheritance, redaction, twelve roots, grace, races, deletion surfaces, and compaction |
| `JAN-CSAA-009-VER-SEC-001` | Security | Twenty hostile classes, least privilege, isolation, encryption properties, secrets, non-disclosure, and critical containment |
| `JAN-CSAA-009-VER-AUD-001` | Audit | Eighteen event classes, safe payload, immutable causation, gaps, retention, and access |
| `JAN-CSAA-009-VER-HLT-001` | Health/readiness | Fourteen design dimensions, five preserved response axes, H01–H14 operational dimensions, four closed binding branches, no aggregate Boolean, scoped readiness, no-RGP state, and candidate-only/no-runtime boundary |
| `JAN-CSAA-009-VER-CAP-001` | Capacity/telemetry | Six workloads, measurement binding, metrics coverage, finite budget rule, and no invented threshold |
| `JAN-CSAA-009-VER-REP-001` | Replay/reconciliation | Self-excluding prepublication basis and output-complete manifest preimages, acyclic observation references, and seven reconciliation classes with explicit uncertainty |
| `JAN-CSAA-009-VER-ALT-001` | Alternatives | Three storage plus three orchestration alternatives, nine criteria, strongest cases, evidence packet, and no selection |
| `JAN-CSAA-009-VER-OPS-001` | Operations/errors | Seventeen operations and cache-miss treatments, seventeen valid/272 invalid pairings, seven stages, 77 errors in twenty-five exact families, sixteen operational mappings, and twelve historical gap-to-code mappings |
| `JAN-CSAA-009-VER-TST-001` | 008 handoff | Exact `JAN-CSAA-008@0.2.1` affected documentation for 144 incremental, 160 degradation, 20 hostile, 16 recovery, six workload, six phase-identity/digest-cycle negative cases, migration, security, and every preserved execution nonpass |
| `JAN-CSAA-009-VER-XPK-001` | Handoffs | Exact immutable predecessor W3 reconciliation, finite `009@0.1.0 → 007@1.0.0 → 008@0.2.1 → 009@0.2.0` semantic cutoff, the three bounded correction-only version-successor edges, required append-only corrective reconciliation, later 010/011, implementation/oracle/V&V separation, refresh, and sponsor boundary |
| `JAN-CSAA-009-VER-REQ-001` | Requirement accounting | 1100 unique local rows, thirty families, contiguous identifiers, one modal each, and complete ledger mapping |
| `JAN-CSAA-009-VER-INTEGRITY-001` | Controlled bytes | UTF-8 no BOM, CRLF-only, one terminal CRLF, headings, tables, fences, links, exact bytes, and SHA-256 |
| `JAN-CSAA-009-VER-SELF-001` | Post-reconciliation author self-review | All applicable adopted adversarial questions against exact candidate and closed-ledger bytes |

### 29.2 Later executable and lifecycle evidence

| Evidence family | Required later owner | Current state |
| --- | --- | --- |
| Operational wire shapes and generated artifacts | exact `JAN-CSAA-007@1.0.0` candidate documentation plus separately authorized artifact executor | `CANDIDATE_DOCUMENTED / NOT_AUTHORIZED / NOT_ENFORCED` |
| Persistence/cache/publication implementation | separately authorized implementation owner | `NOT_AUTHORIZED / NOT_IMPLEMENTED` |
| Incremental/full, concurrency, fault, recovery, migration, retention, security, and performance execution | exact `JAN-CSAA-008@0.2.1` documentation plus separately authorized implementation and V&V owners | `DOCUMENTED / IMPLEMENTATION_NOT_AUTHORIZED / NOT_RUN` |
| Physical fixture and oracle evidence | fixture builder plus independent oracle authority | `NOT_MATERIALIZED / NOT_CONFERRED / NOT_RUN` |
| Concrete provider/adapter qualification | 011 under its current provider allocation | `UNSELECTED / UNQUALIFIED` |
| Concrete storage/orchestration/topology and security-control decisions | applicable architecture, operations, security, implementation, and decision authorities; not 011 by implication | `UNSELECTED / UNQUALIFIED` |
| Numeric performance, capacity, retry, retention, RPO, and RTO objectives | identified owner plus measured evidence | `UNSET / UNMEASURED` |
| Independent Proposed-candidate review and integrity validation | distinct later identities | `NOT_RUN` |
| Final consolidated implementation refresh | authorized corpus integrator | `NOT_RUN` |
| Final corpus sponsor review and exact-member conferral | accountable sponsor and distinct recorder | `ABSENT` |

No author-side documentation method can turn one of these later rows green.

## 30. Draft acceptance state

This Draft is eligible for objective author-side closure only when:

1. every exact source identity and provisional constraint is reproduced;
2. the ledger carries exactly `31 + 3,796 + 53 + 53 = 3,933` inherited rows before local requirements from the exact successor-bound predecessor sources;
3. every local requirement is unique, contiguous within its family, atomic, and bidirectionally mapped;
4. all thirty operational-profile facets and every closed registry reconcile;
5. coordination, publication, pinned-read, invalidation, cache, and migration transitions plus concurrency, cancellation, recovery, integrity, backup, retention, security, audit, health, and capacity state spaces are closed;
6. 144 incremental, 160 degradation, 20 hostile, 16 recovery, six workload, six alternative, seventeen-operation, seven-stage, and 77-error allocations remain exact;
7. no mechanism, provider, topology, threshold, implementation, execution, authority, or false-green claim appears;
8. objective methods other than post-reconciliation author self-review reproduce against exact candidate bytes;
9. the requirement ledger closes for the named documentation commission; and
10. the completed predecessor reconciliation of exact `JAN-CSAA-007@1.0.0`, `JAN-CSAA-008@0.2.1`, and `JAN-CSAA-009@0.2.0` remains immutable, and an append-only successor reconciliation of the exact `JAN-CSAA-007@1.0.1`, `JAN-CSAA-008@0.2.2`, and `JAN-CSAA-009@0.2.1` corrective source and evidence packages stabilizes before the corrective eighteen-question self-review rerun completes.

The declaration table below is the immutable initial-publication preimage, not a mutable current-state register. After a ledger successor or objective-verification record is issued, the exact linked ledger and evidence control current author-side documentation-verification state. Every executable and later-lifecycle predicate remains non-green unless its own authorized evidence exists.

| Predicate | Initial-publication declaration (historical pre-ledger preimage) |
| --- | --- |
| Local atomic requirements | `PRESENT / OBJECTIVE_VERIFICATION_PENDING` |
| Inherited source rows | `PLANNED / LEDGER_NOT_YET_AUTHORED` |
| Thirty operational-profile facets | `DOCUMENTED / NOT_SERIALIZED / NOT_INSTANTIATED` |
| Persistence, cache, publication, and recovery implementation | `NOT_AUTHORIZED / NOT_IMPLEMENTED` |
| Physical database, graph store, queue, scheduler, lock, transaction, or topology | `UNSELECTED` |
| Operational schemas and generated types | `NOT_AUTHORED / NOT_ENFORCED` |
| Physical fixtures and executable tests | `NOT_MATERIALIZED / NOT_AUTHORIZED / NOT_RUN` |
| Expected judgments | `PROPOSED / NOT_CONFERRED / NOT_EXECUTED` |
| Incremental/full, fault, recovery, migration, security, and performance results | `NOT_RUN` |
| Provider and operational-profile qualification | `NOT_AUTHORED / UNQUALIFIED` |
| 007/008 affected reconciliation | `PENDING_AFTER_009_OBJECTIVE_CLOSURE` |
| 010/011 downstream documentation | `NOT_AUTHORED` |
| Author objective verification | `NOT_RUN` |
| Requirement ledger | `NOT_YET_AUTHORED` |
| Author self-review | `NOT_RUN / POST_RECONCILIATION_ONLY` |
| Independent review and integrity validation | `NOT_RUN` |
| Final implementation refresh | `NOT_RUN` |
| Final corpus sponsor disposition | `ABSENT` |

These initial non-green states are accurate lifecycle facts, not defects. A linked ledger successor may record bounded author-side documentation verification without rewriting this historical table, but it cannot turn any executable, oracle, provider, independent-review, sponsor, recording, or full-wave predicate green.

## 31. Closing rule

A CSAA publication is the mechanically selected target only when the authoritative stable-channel binding proves its atomic commit. Semantic freshness, integrity, eligibility for the requested purpose, authorization, information control, audit health, and read-view admissibility remain independent axes. A reconstructable post-commit audit gap degrades audit health/readiness without reversing a proven binding; an uncertain or corrupt binding is explicitly unavailable or unknown until reconciled. Persisted bytes are not truth. A cache hit is not freshness. A transaction name is not atomic evidence. A retry is not permission to duplicate an effect. A backup is not a tested restore. Encryption is not authorization. Health is not correctness. A predecessor is not fresh output from a failed attempt. Redaction is not emptiness. Deletion is not correction. A partial, failed, stale, unsupported, conflicting, timed-out, cancelled, resource-refused, mixed-revision, quarantined, unqualified, unreconciled, or unexecuted state cannot become green.
