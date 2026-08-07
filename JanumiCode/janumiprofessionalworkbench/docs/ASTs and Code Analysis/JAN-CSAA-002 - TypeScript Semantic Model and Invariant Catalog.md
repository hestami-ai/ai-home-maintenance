# TypeScript Semantic Model and Invariant Catalog

## Provider-independent subjects, objects, relationships, provenance, epistemic limits, and cross-graph invariants

**Document ID:** `JAN-CSAA-002`

**Canonical title:** TypeScript Semantic Model and Invariant Catalog

**Version:** `0.3.1`

**Status:** Draft

**Settledness:** HYPOTHESIS

**Classification:** Prepared controlled-CSAA member candidate; non-authoritative Draft. `JAN-CSAA-000@0.3.0` remains the adopted authority and manifest baseline, while `JAN-CSAA-WORKING-STATUS-001` carries non-authoritative construction state. No interim README carriage or sponsor response is a continuation or promotion predicate

**Governing status:** Documentation preparation was activated by `JPWB-REG-005 REG-D-018` and is continued for every documentation subphase by `REG-D-021` as corrected by `REG-D-022`; this document has no member authority

**Role:** Provider-independent semantic contract for repository subjects, TypeScript facts, graph relationships, execution observations, provenance, uncertainty, freshness, and invalidation

**Authority:** None. `REG-D-018`, as extended by `REG-D-021` and corrected by `REG-D-022`, authorizes documentation-only preparation, reconciliation, objective gate closure, Draft-to-Proposed promotion, and post-Proposed review and validation. Only an individual exact-member `JPWB-REG-005` conferral within the final exact-corpus transaction can make a revision Normative

**Scope:** Semantic identity and relationships for the TypeScript, JavaScript, and TypeScript-bearing Svelte analysis subject defined by `JAN-CSAA-000`

**Applicability:** Static semantic snapshots and separately revisioned test, coverage, and runtime evidence associated with the initial JPWB repository subject

**Governs:** While Draft, nothing with program authority. Candidate concern allocation: provider-independent meanings of code-analysis subjects, semantic objects and relationships, provenance and epistemic state, lifecycle and invalidation, and cross-graph invariants

**Does not govern:** Exact schemas, field names, enum spellings, serialization, APIs, error codes, provider output formats, extraction or query algorithms, current JPWB inventory, architecture-rule meaning, technical rule/finding/gate semantics, fixture judgments, persistence mechanics, provider qualification, coding-agent employment, or implementation permission

**Parent and inherited authorities:** `JAN-CSAA-000@0.3.0`, `JPWB-CON-000`, `JPWB-DOC-001`, `JPWB-DOC-002`, `JPWB-DOC-003`, `JPWB-DOC-004`, and `JPWB-REG-005@1.0.0 REG-D-018`, `REG-D-021`, and `REG-D-022`, each only for its owned concern

**Precedence and conflict routing:** `JPWB-DOC-002` retains canonical term meaning; `JPWB-DOC-003` retains professional semantic structure and invariants; enforced repository reference artifacts retain exact governed shapes. This document owns only code-analysis semantics if adopted. Apparent authority conflicts are recorded and routed to `JPWB-REG-005` under `CSAA-002-REQ-097` and `CSAA-002-REQ-473`; apparent semantic conflicts are recorded and routed under `CSAA-002-REQ-558` and `CSAA-002-REQ-559`. They are not silently reconciled

**Requirement ledger:** [JAN-CSAA-002 Requirement Ledger](<records/JAN-CSAA-002 - Requirement Ledger.md>)

**Verification owner:** The author/integrator owns extraction, ledger-closure evidence, and author self-review. A distinct adversarial reviewer owns Proposed-candidate semantic review, and a distinct integrity/provenance validator owns exact-identity and evidence-continuity validation. The final decision authority and ministerial recorder are also distinct identities. None except the final decision authority can confer Normative status, and the recorder cannot supply or reinterpret judgment

**Change authority and procedure:** `REG-D-018`, as extended by `REG-D-021` and corrected by `REG-D-022`, permits authors to revise this Draft. Proposed eligibility is governed by `CSAA-002-REQ-098` and `CSAA-002-REQ-474`: ledger closure and author self-review precede an exact candidate freeze and Proposed promotion. Proposed status is followed by independent adversarial review and distinct integrity/provenance validation. `CSAA-002-REQ-099` requires affected re-review after every candidate-byte change following an exact review freeze except an exact pre-frozen administrative substitution set that names its operations and source/result digests, causes no semantic or judgment change, and is independently replayed, independently result-validated, and ministerially recorded against exact predicates. Normative status requires an individual exact-member `JPWB-REG-005` conferral in the one final itemized corpus transaction

**Review and evidence companions:** Requirement ledger above; deliberately historical examples grounded by their cited `JAN-CSAA-005` predecessor snapshot; historical [JAN-CSAA-005-EVIDENCE-004@0.1.0](<records/JAN-CSAA-005 - Current Subject Rebinding Record.md>) supplies no current-use claim; dated [JAN-CSAA-005-EVIDENCE-007@0.1.0](<records/JAN-CSAA-005 - Current Subject Rebinding Record 004.md>) supplies only the OBS-035/036 authoring baseline; [JAN-CSAA-005-EVIDENCE-008@0.1.0](<records/JAN-CSAA-005 - Non-Blocking External Drift and Authoring Baseline Record.md>) controls intermediate documentation authoring without making that dated baseline continuously current, and the consolidated implementation refresh remains open before exact-corpus freeze; historical [VERIFICATION-001](<records/JAN-CSAA-002 - Objective Author Verification Record.md>), [VERIFICATION-002](<records/JAN-CSAA-002 - Objective Author Verification Record 002.md>), [Wave 1 reconciliation 002](<records/JAN-CSAA-W1 - Wave 1 Cross-Package Objective Reconciliation Record 002.md>), and [Wave 1 ledger closure](<records/JAN-CSAA-W1 - Synchronized Ledger Closure and Integrity Record.md>) remain evidence for their exact predecessor surfaces; the [preliminary author self-review](<records/JAN-CSAA-002 - Author Self Review.md>) records `JAN-CSAA-002-SR-001 / MAJOR` against `0.3.0`; [Working Corpus Authoring Status 013](<records/JAN-CSAA - Working Corpus Authoring Status 013.md>) controls the pre-correction corpus state, with any later exact successor controlling live construction state; corrective objective verification, affected cross-package reconciliation, corrective author self-review, exact Proposed freeze, Proposed-candidate review, and integrity/provenance validation remain separate later evidence-bearing acts

**Companion enforced artifacts:** Existing repository contracts, schemas, configurations, and tests remain exact shape authorities for their own concerns. This Draft creates none

**Conformance-test references:** The documentation subphases for `JAN-CSAA-006` through `JAN-CSAA-008` and the other remaining members are commissioned by `REG-D-021`; executable fixtures, oracle judgments, schemas, types, tests, conformance suites, provider qualification, and results remain unperformed and separately unauthorized under `REG-D-022`

**Audience:** Analyzer architects, TypeScript experts, coding-agent designers, assurance engineers, security reviewers, tool integrators, implementers, and maintainers

**Background:** [JAN-CSAA-000](<README.md>); [JAN-CSAA-001](<JAN-CSAA-001 - Codebase Semantic Analysis and Assurance Architecture.md>); [Initial Chat](<Initial Chat.md>)

**Structural exemplar:** [RPH Canonical Domain Model and Invariant Catalog](<../Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Canonical Domain Model, Invariant Catalog, State Machines, and Event Contract.md>)

**Supersedes:** `JAN-CSAA-002@0.3.0 / Draft`, 162,179 bytes, SHA-256 `9bcaa9f9a2212d66ae7c417af84c4f0e14672d282c04e73d719f7f9cceda1911`; stable publication of this correction SHALL preserve that exact predecessor at `records/archive/JAN-CSAA-002@0.3.0.Draft.PRE-SR-001-CORRECTION.snapshot`

**Superseded by:** None

**Normative keywords:** SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY. Their meanings and the non-normative treatment of examples are inherited from `JAN-CSAA-000@0.3.0` §5

---

## 1. Purpose

This Draft defines the semantic model that providers must eventually populate and consumers must query. It answers:

> What code facts exist, what identifies them, what revision and evidence support them, how do they relate, and what can they honestly claim?

The model is not a provider output union and not a database schema. It is a provider-independent contract that lets multiple extraction, coverage, trace, and analysis capabilities contribute without collapsing their provenance or limitations.

---

## 2. Concern ownership

| Concern | Owner | Treatment here |
| --- | --- | --- |
| Canonical Janumi terms, including Artifact, Evidence, Assessment, Decision, Baseline, and Projection | `JPWB-DOC-002` | Cited; never redefined |
| Professional semantic objects and invariants | `JPWB-DOC-003` | Excluded from this technical semantic universe |
| CSAA program boundary and source-of-truth distinctions | `JAN-CSAA-000` | Inherited |
| Logical responsibilities and flows | `JAN-CSAA-001` candidate | Objects cross its boundaries |
| Code-semantic object and relation meanings | `JAN-CSAA-002` candidate | Defined here |
| Extraction, inference, query, slicing, and change-impact behavior | Reserved `JAN-CSAA-003` | Only reference endpoints modeled |
| Architecture-rule, Analysis Rule Profile, Analyzer Finding Record, exception, and gate behavior | Reserved `JAN-CSAA-004` | Only common identity/provenance references modeled |
| Recorded-snapshot JPWB facts | `JAN-CSAA-005` candidate | Informative examples only |
| Exact machine shapes | Reserved `JAN-CSAA-007` plus enforced repository artifacts by concern | Serialization owner recorded; no shape defined |
| Operational recomputation, persistence, migration, recovery | Reserved `JAN-CSAA-009` | Lifecycle semantics only |

`Query`, `Architecture Rule`, `Analyzer Finding Record`, and exception/suppression references appear in the catalog because facts must link to them. Their behavior and governance remain with their named owners.

The following technical definitions are inherited from `JAN-CSAA-000@0.3.0` §7.1 and are reference vocabulary, not new canonical Janumi terms:

| Reference vocabulary | Inherited meaning and treatment here |
| --- | --- |
| Analysis Capability | Kind of Semantic Fact or Engineering Evidence Record that can be produced; referenced by coverage and provenance records |
| Analyzer Provider | Concrete tool or adapter implementing capabilities; retained only as Provider Invocation provenance |
| Analysis Rule Profile | Versioned executable/declarative checks for a repository scope; behavior remains with `JAN-CSAA-004` |
| Analyzer Finding Record | Subject-bound provider observation or bounded conclusion with provenance, limitations and disposition history; behavior remains with `JAN-CSAA-004` |
| Engineering Evidence Record | Non-canonical technical record binding a result to subject, producer, method, coverage, time and epistemic limits |
| Repository Gate Profile | Versioned technical selection and applicability/evidence/criteria/blocking definition; behavior remains with `JAN-CSAA-004` |
| Repository Gate Evaluation | Revision-bound application result that preserves its profile and underlying inputs/findings; not modeled as authority here |
| Engineering Exception Record | Explicit scoped approved disposition under its concern owner; a configuration suppression alone is not equivalent |

---

## 3. Foundational non-equivalences

The model preserves these inequalities:

```text
Repository ≠ Repository Revision ≠ Repository Snapshot ≠ Working Change Set
Repository Commit ≠ governed Baseline
Workspace ≠ Package ≠ TypeScript Project ≠ Module
Package-manifest dependency ≠ resolved component ≠ import edge ≠ observed runtime load
Authored artifact ≠ generated artifact ≠ virtual artifact ≠ build artifact
Source module ≠ emitted module ≠ runtime-loaded module
Semantic index ≠ authored-source authority
Source text ≠ AST node ≠ declaration ≠ symbol ≠ type
Name match ≠ reference resolution
Call site ≠ confirmed target ≠ candidate target ≠ observed target
AST ≠ control-flow graph ≠ data-flow graph ≠ call graph ≠ dependency graph
Code property graph ≠ complete repository semantic graph
Static semantic snapshot ≠ execution evidence set
Test configured ≠ test selected ≠ test executed ≠ test passed
Test passed ≠ intended behavior preserved
Coverage observation ≠ correctness ≠ behavioral preservation
Trace event ≠ whole-program behavior
Analyzer Provider ≠ Analysis Rule Profile ≠ Assurance Policy
Provider Invocation ≠ Assurance Policy satisfaction ≠ Assessment
Provider Invocation output ≠ semantic authority ≠ canonical Evidence ≠ Decision
Suppression or exception ≠ defect removal ≠ correctness
Tool agreement ≠ correctness
No Analyzer Finding Record ≠ no defect
Absence of observation or Evidence ≠ evidence of absence
Current ≠ last-known-good ≠ stale
Unsupported ≠ empty ≠ passed
```

---

## 4. Common semantic-record contract

Every semantic object and relationship has these conceptual facets. Exact field names and serialization are deferred to `JAN-CSAA-007`.

| Facet | Meaning |
| --- | --- |
| Stable identity | Identity within the scope where stability can be justified; never a display label alone |
| Object or relationship kind | Provider-independent semantic kind |
| Subject identity | Repository snapshot and, where applicable, execution evidence-set identity |
| Project/configuration context | Compiler, resolver, build, framework, instrumentation, or runtime context needed to interpret the record |
| Provenance | Producer, method/capability, version, invocation/run, raw evidence reference, source location, observation time |
| Ownership | Concern-owning document or enforced reference artifact |
| Lifecycle | Creation, correction, supersession, invalidation, staleness, and historical visibility |
| Authority and epistemic limits | What establishes the fact and what the fact cannot claim |
| Required/optional metadata | Conceptual completeness requirements; exact shape deferred |
| Versioning and invalidation | Changes capable of making the record stale or invalid |
| Epistemic dimensions | Support basis, capability coverage, freshness, conflict, and inference |
| Serialization owner | `JAN-CSAA-007`, another identified enforced artifact, or externally owned reference |
| Cross-graph invariants | Constraints that must survive composition |

Provider-native identity may be retained as provenance but cannot substitute for the common subject and semantic identity.

### 4.1 Object semantic profiles

Every object in §14 names exactly one profile and an item-specific identity/required-metadata supplement. The profile plus supplement is the object's complete conceptual contract; neither silently supplies a machine shape. Required and optional metadata are separate: absence of optional metadata does not invalidate an otherwise complete record, and optional metadata cannot silently participate in stable identity. The four state-treatment columns apply to every mapped row; an explicit inapplicable treatment is a treatment, while omission is not.

| Profile | Identity | Subject binding | Revision binding | Provenance | Owner | Lifecycle | Versioning and invalidation | Required metadata | Optional metadata | Authority and epistemic limits | Supported treatment | Inferred treatment | Unknown treatment | Conflicting treatment | Serialization owner | Cross-graph invariants |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `O-SUB` — repository/VCS subject | Opaque ID plus item content/VCS/change coordinates | Repository identity and analyzed perimeter | Exact revision/snapshot; moving observation also binds target and cutoff | VCS/repository method, producer/version, raw reference, observation time | `JAN-CSAA-002`; VCS/reference artifacts retain exact shapes | Immutable content subjects remain historical; moving observations receive new occurrences | Any identity-coordinate change creates a successor; use beyond cutoff is stale | Item coordinates, repository ID, revision/snapshot ID, provenance, cutoff | Display label, remote aliases, provider-native ID | Reproducible VCS/content evidence establishes the technical subject; it cannot confer Baseline, acceptance, or currentness beyond cutoff | `supported` only when the method covers all required coordinates | `inferred` is inapplicable to immutable identity; inferred lineage uses `O-REL` | `unknown` is explicit when a coordinate or observed target is unavailable | `conflicting` retains incompatible observations or identity claims | `JAN-CSAA-007` or enforced VCS/reference artifact | `INV-001`, `INV-002`, `INV-014` |
| `O-CTX` — workspace/configuration/component context | Snapshot-scoped configuration, membership, component, resolver, or toolchain coordinates | Exact Repository Snapshot and declared perimeter | Exact context revision plus applicable Project/Variant revision | Manifest/configuration/resolver/toolchain source, method, producer/version, raw reference, time | `JAN-CSAA-002`; source/enforced artifacts retain shapes | Each resolved context is immutable and historically visible | Relevant manifest, lockfile, config, resolver, toolchain, generated-context, or advisory change creates a successor | Item coordinates, content/version, perimeter, provenance, limitations | Display label, ecosystem description, cache key, native trace ID | Resolved source/configuration evidence establishes bounded context; it cannot prove runtime load or coverage outside its perimeter | `supported` only when capability resolves the item within perimeter | `inferred` remains labeled with method and limits; otherwise it is inapplicable | `unknown` is explicit when membership, resolution, or version is unavailable | `conflicting` retains incompatible manifests, resolutions, or correlations | `JAN-CSAA-007` or enforced configuration/reference artifact | `INV-001`, `INV-002`, `INV-010`, `INV-014` |
| `O-ART` — artifact/build/origin object | Snapshot-scoped occurrence plus content identity and item coordinates | Exact containing Repository Snapshot or external subject | Exact content revision; build/execution artifacts bind producing build revision | Authorship/generator/build method, inputs, config, producer/version, location/mapping, raw reference | `JAN-CSAA-002`; contract/reference owners retain exact-shape authority | Occurrences are immutable; correction or rebuild adds a successor | Content, generator, input, config, build, or mapping change invalidates dependent use | Item coordinates, class, content identity, origin/producer, inputs/mapping, provenance, limits | Display path, media type, label, cache location, native artifact ID | Content and origin evidence establish the occurrence; it cannot masquerade as another class or claim exact mapping without evidence | `supported` only when identity, class, and required origin metadata are established | `inferred` origin/class remains labeled; authored status is never inferred from path | `unknown` is explicit when origin, class, or mapping is unavailable | `conflicting` retains competing classifications or mappings | `JAN-CSAA-007` or applicable enforced artifact | `INV-001`, `INV-002`, `INV-006`, `INV-012`, `INV-014` |
| `O-SEM` — TypeScript semantic object | Program/checker/parser/project-scoped identity plus item coordinates; never display text alone | Exact Repository Snapshot and Project/Variant | Exact compiler, toolchain, resolver, generated-context, and semantic-snapshot revisions | Parser/compiler/resolver method, producer/version, raw trace, location, time | `JAN-CSAA-002`; TypeScript/enforced shapes retain their own scoped authority | Occurrence is immutable for one semantic snapshot | Source, project, compiler, resolver, or generated-context change invalidates or succeeds it | Item coordinates, kind, project/checker context, location, provenance, support basis, limits | Display name, pretty type, native node/symbol ID, navigation label | Named parser/compiler/checker evidence establishes only its support basis; syntax, name match, and inference cannot impersonate confirmation | `supported` when declared capability covers construct and context | `inferred` remains separate with method and limits; never compiler-confirmed | `unknown` is explicit when binding, type, target, or effect is unavailable | `conflicting` retains incompatible conclusions with exact contexts | `JAN-CSAA-007` | `INV-001`, `INV-002`, `INV-003`, `INV-007`, `INV-012`, `INV-014` |
| `O-GRF` — graph object | Graph-snapshot identity plus graph kind, layer, node, or edge coordinates | Exact Static Semantic Snapshot Identity; dynamic layers also bind an execution subject | Exact graph-input, Project/Variant, provider/capability, and optional execution revisions | Analysis Run/Invocation, capability/method/version, raw trace, locations, coverage basis | `JAN-CSAA-002` | Graph occurrence is immutable; recomposition adds a successor | Input, capability, provider, project, execution, or composition change invalidates it | Graph kind, subject, producer/method, coverage, completeness basis, health, limits; endpoints for edges | Display layout, cached metric, visualization group, native graph ID | Producing run and coverage establish a bounded graph; it cannot prove completeness, correctness, or behavior beyond that basis | `supported` only within declared capability and perimeter | `inferred` nodes/edges retain method and never impersonate confirmed facts | `unknown` and `not-analyzed` remain explicit | `conflicting` preserves incompatible graph facts and provenance | `JAN-CSAA-007` | `INV-001`, `INV-002`, `INV-003`, `INV-007`, `INV-008`, `INV-014` |
| `O-EXE` — test/coverage/runtime object | Execution-set-scoped identity plus run, attempt, or observation coordinates | Exact Repository Snapshot and target execution subject | Exact target build/artifact and Execution Evidence Set Identity | Runner/instrumentation/collector method/version, config, environment, workload/selection, raw output, time | `JAN-CSAA-002`; external runner/schema owns exact shape | Observed occurrence is immutable; retry/rerun/recollection adds another | Rebuild, rerun, reinstrumentation, reselection, remapping, or recollection creates a successor set | Item coordinates, target, config, environment, selection/workload, time, producer, raw reference, limits | Display title, duration, UI group, native run ID, diagnostic attachment | Captured evidence establishes only the identified run; it cannot prove unobserved behavior, correctness, or intended preservation | `supported` when collector capability covers observation and run context is complete | `inferred` execution state is inapplicable; derived interpretation uses `O-ANA` | `unknown` is explicit when outcome, target, mapping, or collection status is unavailable | `conflicting` retains incompatible results or mappings as separate observations | `JAN-CSAA-007` or enforced test/trace artifact | `INV-001`, `INV-002`, `INV-004`, `INV-005`, `INV-006`, `INV-013`, `INV-014` |
| `O-ANA` — analysis/provenance technical record | Run, invocation, fact, or technical-record identity plus item coordinates | Exact static subject and optional dynamic evidence subject | Exact method/capability/provider revision; dynamic use binds execution-set revision | Run, Invocation, method/capability/version, raw trace, location, time | `JAN-CSAA-002`; `JAN-CSAA-003`/`JAN-CSAA-004` own query, rule, finding, and gate behavior | Record is immutable; correction/refresh adds a linked successor | Changed subject, dependency, method, rule, provider, evidence, or correction invalidates/supersedes it | Item coordinates, subject, producer/method, coverage, basis, raw reference, limits, dependencies | Display summary, rank, UI group, native result ID, annotation | Auditable inputs/method establish a bounded technical conclusion; output cannot govern, mutate source, prove correctness, or prove absence | `supported` when capability coverage and provenance support the bounded conclusion | `inferred` remains explicit with inputs, method, uncertainty, and limits | `unknown` represents unable-to-determine or unavailable required evidence | `conflicting` preserves incompatible evidence and conclusions with history | `JAN-CSAA-007` or identified external owner | `INV-001`, `INV-002`, `INV-003`, `INV-008`, `INV-009`, `INV-014` |
| `O-REF` — externally owned reference | External owner, permanent/versioned reference ID, scope, and item coordinates | Exact external subject plus local subject where used | Exact external version plus local semantic-snapshot revision | External authority/source, version, retrieval time, correlation method | Named external owner; `JAN-CSAA-002` owns only reference semantics | Reference occurrence remains historical across external change | Supersession, revocation, expiry, missing target, or local incompatibility invalidates use | Owner, reference/version, scope/applicability, local subject, provenance, limits, expiry/exception | Display title, retrieval cache, external UI URL, annotation | Only external owner establishes the concern; local reference cannot broaden scope, fabricate authority, or equate retrieval with correctness | `supported` when reference resolves and applies to exact local subject | `inferred` applicability remains labeled; authority is never inferred | `unknown` is explicit when owner, version, resolution, or applicability is unavailable | `conflicting` retains incompatible references/applicability and routes owned conflict | External owner or `JAN-CSAA-007` envelope | `INV-001`, `INV-002`, `INV-009`, `INV-011`, `INV-014` |
| `O-ID` — correlation identity | Content-addressed or opaque ID for exact static subject, execution set, or raw trace | Exact snapshot, run, evidence set, or trace identified | Exact member/reference manifest revision and derivation version | Issuer/derivation, producer/version, digest algorithm where applicable, time | `JAN-CSAA-002` | Identity record is immutable and historically visible | Changed member, execution, trace, derivation, or mismatch creates a successor | Coordinates, member/reference manifest, derivation, provenance, consistency evidence | Display abbreviation, transport encoding, lookup alias, native ID | Derivation/member consistency establishes correlation only; equality cannot prove semantic equivalence, correctness, or authority | `supported` when every member and derivation coordinate validates | `inferred` identity is inapplicable; probabilistic correlation uses `O-REL` | `unknown` is explicit when member, digest, or derivation is unavailable | `conflicting` preserves mismatches and competing correlation claims | `JAN-CSAA-007` | `INV-001`, `INV-002`, `INV-003`, `INV-013`, `INV-014` |
| `O-REL` — relation represented as an object | Typed endpoints, relation kind, subject, and occurrence coordinates | Both endpoints and exact relation perimeter | Both endpoint revisions; cross-snapshot relation carries every revision | Producer/method/version, raw trace, locations, time, confidence/limits | `JAN-CSAA-002` unless supplement names external owner | Relation occurrence is immutable; correction adds a successor | Endpoint, kind, method, source, or subject change invalidates sameness | Typed endpoints, kind, subject/revisions, provenance, basis, locations, limits | Display label, traversal hint, native edge ID, visualization metadata | Named method/endpoint evidence establishes only declared state; inferred/observed cannot impersonate confirmation or same-revision fact | `supported` when endpoints, capability, and required relation metadata are complete | `inferred` remains explicit with method, confidence, and limits | `unknown` is explicit when endpoint, target, or state is unavailable | `conflicting` preserves incompatible relation claims and provenance | `JAN-CSAA-007` | `INV-001`, `INV-002`, `INV-003`, `INV-007`, `INV-014` |

### 4.2 Relationship semantic profiles

Every relationship in §15 names exactly one relationship profile and an explicit endpoint/required-metadata supplement. The authority-and-epistemic-limits column identifies both the establishment basis and forbidden claims. Required/optional metadata and all four state-treatment columns apply to every mapped relationship.

| Profile | Identity | Subject binding | Revision binding | Provenance | Owner | Lifecycle | Versioning and invalidation | Required metadata | Optional metadata | Authority and epistemic limits | Supported treatment | Inferred treatment | Unknown treatment | Conflicting treatment | Serialization owner | Cross-graph invariants |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R-STR` — structural/version relation | Kind plus typed endpoints and ordinal/role where applicable | Exact local subject containing both endpoints | Same snapshot unless supplement names every snapshot | VCS/parser/manifest method, producer/version, location/raw reference, time | `JAN-CSAA-002` | Immutable occurrence retained with endpoints | Endpoint, order, role, method, or subject change creates successor | Kind, endpoints, subject/revisions, role/ordinal, provenance, limits | Display label, traversal hint, native relation ID | Cited VCS/parser/manifest evidence establishes structure only; it cannot imply governance, semantic resolution, or cross-revision sameness | `supported` when capability covers construct and required context | `inferred` only where supplement permits lineage; otherwise inapplicable | `unknown` is explicit when endpoint, role, or target is unavailable | `conflicting` retains incompatible observations and provenance | `JAN-CSAA-007` or enforced VCS/reference artifact | `INV-001`, `INV-002`, `INV-014` |
| `R-RES` — declaration/configuration/resolution relation | Kind, requester/source, request coordinate, target/unresolved descriptor, resolver context | Exact requester/configuration subject | Exact Repository Snapshot and Project/Variant revision | Manifest/lockfile/resolver/compiler method, producer/version, conditions, raw trace, location, time | `JAN-CSAA-002` | Resolution occurrence is immutable and historical | Requester, manifest, lockfile, config, condition, resolver, or target change requires successor | Kind, endpoints, request/declaration, resolver/conditions, outcome, provenance, limits | Display specifier, trace summary, cache key, native resolution ID | Declared method/context establishes only that outcome; declaration cannot imply import, runtime load, or universal resolution | `supported` when resolver capability covers request and context | `inferred` resolution uses `R-INF`; it is not a resolved outcome | `unknown` is explicit when resolution or context is unavailable | `conflicting` retains provider/context disagreements | `JAN-CSAA-007` | `INV-001`, `INV-002`, `INV-003`, `INV-010`, `INV-014` |
| `R-SEM` — compiler/parser-confirmed semantic relation | Kind plus program/checker-scoped endpoints and item coordinates | Exact semantic subject and project perimeter | Exact static semantic snapshot and Project/Variant revision | Parser/compiler/checker method, producer/version, raw trace, locations, time | `JAN-CSAA-002` | Confirmed occurrence is immutable for one snapshot | Endpoint, source, project, compiler, resolver, or generated-context change invalidates it | Kind, endpoints, project/checker context, locations, provenance, support basis | Display name, navigation label, native semantic ID | Named basis establishes only declared relation; syntax, name match, and inference cannot impersonate confirmation | `supported` when semantic capability covers construct/context | `inferred` is inapplicable; candidate/inferred relations use `R-INF` | `unknown` is explicit when relation cannot be established | `conflicting` retains incompatible results with exact contexts | `JAN-CSAA-007` | `INV-001`, `INV-002`, `INV-003`, `INV-007`, `INV-014` |
| `R-INF` — candidate/inferred relation | Kind plus endpoints/unresolved descriptor, method, and rank/role | Exact static subject; observed candidates also bind dynamic subject | Exact static revision; observed participation binds execution-set revision | Inference method/version, inputs, raw trace, locations, time, limits | `JAN-CSAA-002` | Inference is immutable and retained across recomputation | Input, method/provider, project, source, or execution change creates successor | Kind, endpoints/descriptor, inference basis, confidence/limits, provenance | Display rank, explanation, heuristic label, native candidate ID | Disclosed method establishes only bounded candidate/inference; it cannot claim confirmation, completeness, correctness, or absence | `supported` means inference capability covers construct, not confirmation | `inferred` is mandatory and retains method, confidence, limits | `unknown` is explicit when no bounded target is available | `conflicting` retains competing candidates and disagreements | `JAN-CSAA-007` | `INV-001`, `INV-002`, `INV-003`, `INV-007`, `INV-008`, `INV-014` |
| `R-MAP` — origin/transformation mapping | Kind plus source/target artifacts and ranges, transformation/build, mapping quality | Exact source and target subjects | Exact source/target snapshot/build revisions | Generator/build/source-map method/version, inputs, raw map, time | `JAN-CSAA-002` | Mapping occurrence is immutable and historical | Source, target, generator/build, map, or method change invalidates it | Kind, ranges, transformation/build, quality, provenance, limits | Display path, visualization segment, native mapping ID, reverse index | Map evidence establishes only recorded mapping/quality; missing or ambiguous provenance cannot support exact authored-source claim | `supported` when capability, identities, and map evidence are present | `inferred` mapping remains labeled and cannot be exact | `unknown` is explicit when origin, range, or quality is unavailable | `conflicting` retains incompatible maps and origin claims | `JAN-CSAA-007` or enforced map artifact | `INV-001`, `INV-002`, `INV-006`, `INV-012`, `INV-014` |
| `R-EXE` — test/coverage/runtime observed relation | Kind plus endpoints and execution/run/observation coordinates | Exact static and execution subjects | Static Semantic Snapshot Identity plus exact Execution Evidence Set Identity | Runner/instrumentation/collector method/version, config, environment, workload/selection, raw evidence, time | `JAN-CSAA-002` | Observed occurrence is immutable | Rerun, rebuild, reinstrumentation, reselection, recollection, or remapping creates successor | Kind, endpoints, execution/build/environment, selection/workload, time, provenance, limits | Display duration, trace label, native observation ID, visualization metadata | Captured evidence establishes only observed relation in named run; it cannot establish unobserved behavior, correctness, or completeness | `supported` when collection capability and execution context cover relation | `inferred` relation uses `R-INF` or derived record, not `R-EXE` | `unknown` is explicit when target, mapping, collection, or outcome is unavailable | `conflicting` retains incompatible run observations separately | `JAN-CSAA-007` or enforced test/trace artifact | `INV-001`, `INV-002`, `INV-004`, `INV-005`, `INV-006`, `INV-013`, `INV-014` |
| `R-EXT` — externally owned reference | Reference kind, local source, external owner/reference/version, scope | Exact local and external subjects | Local revision plus exact external reference revision | External authority/source, retrieval/correlation method, time | Named external owner; `JAN-CSAA-002` owns common link only | Reference relation remains historical | External supersession/revocation/expiry or local change invalidates use | Kind, local source, owner, reference/version, scope, provenance, limits/exception | Display title, external URL, cache key, annotation | Only external owner establishes concern; correlation cannot fabricate applicability, authority, or truth | `supported` when reference resolves and applies to exact subject | `inferred` applicability remains labeled; authority is never inferred | `unknown` is explicit when owner, version, resolution, or applicability is unavailable | `conflicting` retains incompatible references/applicability and routes conflict | External owner or `JAN-CSAA-007` envelope | `INV-001`, `INV-002`, `INV-009`, `INV-011`, `INV-014` |
| `R-LIF` — lifecycle/evidence-history relation | Kind plus predecessor/source, successor/target, reason, effective observation | Each endpoint's exact subject | Each endpoint's exact revision; cross-revision relation retains every revision | Recording actor/method, authority reference where applicable, time, evidence | `JAN-CSAA-002` for technical history; external owner for governed disposition | Append-only; every endpoint remains visible | Correction adds another relation; no change erases prior occurrence | Kind, endpoints, reason, effective time, provenance, authority/reference where applicable | Display rationale, UI grouping, native history ID | Recorded event/evidence establishes technical history only; governed disposition requires named external authority and cannot be inferred from succession | `supported` when endpoint identity, reason, and evidence are complete | `inferred` remains labeled and cannot confer disposition/supersession authority | `unknown` is explicit when reason, endpoint, time, or authority is unavailable | `conflicting` retains disputed or incompatible history | `JAN-CSAA-007` or external owner | `INV-001`, `INV-002`, `INV-009`, `INV-014` |

---

## 5. Repository, revision, snapshot, and change identity

### 5.1 Repository

A Repository is a logical VCS-controlled source collection. A local path and remote URL are observed attributes, not sufficient identity by themselves. A repository receives an opaque stable identity and may have multiple checkouts.

### 5.2 VCS observations

- A Commit is immutable content/history identity in its VCS.
- A Ref or Branch is a moving observation whose target is time-bound.
- Parentage is an explicit relation between revisions.
- A Merge Base identifies the comparison basis for named revisions.
- A Candidate Merge identifies the analyzed synthetic result and both input lineages.
- A Worktree is a checkout context with a base revision plus local state.

### 5.3 Repository Snapshot

A Repository Snapshot is the immutable logical subject of one static analysis. It includes:

- repository identity;
- base revision or synthetic parentage;
- analyzed working change set or complete analyzed-input digests;
- root manifest and resolved workspace perimeter;
- source/configuration/lockfile content identity;
- toolchain and generated-context identity needed to interpret the subject;
- observation time and subject-consistency evidence.

A commit alone is insufficient when the subject is dirty or synthetic.

### 5.4 Working Change Set

A Working Change Set is the reproducible difference applied to a base revision to form a snapshot. It distinguishes tracked modifications, additions, deletions, renames, untracked inputs included in the subject, and explicit exclusions. A status summary without content identity is evidence about state, not a reproducible change set.

### 5.5 Static versus execution identity

A Static Semantic Snapshot Identity identifies one immutable source/configuration-derived semantic snapshot revision. An Execution Evidence Set Identity identifies one immutable manifest revision of test, coverage, build, or trace observations correlated to that static identity. New execution evidence creates a successor Execution Evidence Set Identity, not a mutation of historical static facts or a prior evidence-set revision.

---

## 6. Workspace, package, dependency, and TypeScript-project model

| Object | Meaning and identity basis |
| --- | --- |
| Workspace | Root manifest plus its resolved member declarations and observation snapshot |
| Package | Workspace-scoped package occurrence identified by manifest path/content and package name/version attributes |
| Package Manifest | Configuration artifact whose declared dependencies, scripts, exports, engines, and workspace metadata are observations |
| Lockfile | Snapshot-bound resolution artifact; identity includes content digest and package-manager format/version context |
| External Component | Ecosystem/name/version/integrity occurrence reached through the lockfile or resolver |
| Advisory | Externally sourced vulnerability or quality record with source, version, observed cutoff, and scope |
| Vulnerability Observation | Revision-bound correlation between an external component and one advisory; not a timeless component property |
| TypeScript Project | One effective configuration closure, file set, compiler/toolchain, module-resolution environment, and generated framework context |
| Project Variant | Distinct normal, build, test, source-resolution, artifact-resolution, browser, SSR, or other context |

Declared package dependency, resolved component, import/export edge, inferred runtime dependency, and observed runtime load remain separate relation types.

---

## 7. Technical-artifact classification, contract, build, and source-origin model

### 7.1 Technical-artifact classifications

| Classification | Definition |
| --- | --- |
| Authored Source Artifact | Human- or agent-authored repository input, including TypeScript-bearing framework artifacts |
| Generated Artifact | Materialized output produced from identified inputs by a generator |
| Virtual Artifact | Tool-produced analysis/compile input not necessarily materialized in the repository |
| Declaration Artifact | Type declaration input or build output whose source and authority are explicit |
| Configuration Artifact | Manifest, compiler, build, test, lint, coverage, boundary, analyzer, or runtime configuration |
| Test Artifact | Test definition, fixture, harness, setup, or verification instrument |
| Build Artifact | Emitted, bundled, transformed, or packaged output of an identified build execution |
| External/Vendor Artifact | Third-party material represented primarily by identity, provenance, and boundary metadata |

Classification is snapshot-scoped and can be overlapping only where each role is explicit; for example, a checked-in generated TypeScript file is both repository material and generated, never silently “authored.”

Within this document, **technical-artifact occurrence** is bounded shorthand for an occurrence carrying one or more explicit classifications from this §7.1 table. It is not the canon-owned `Artifact` term, does not create a generic catalog object, and cannot erase the occurrence's exact classification or provenance.

### 7.2 Generation and virtual-source provenance

A generation relation identifies generator source/version, input artifacts, configuration, invocation or recorded generation basis, output digest, and source-origin mapping. Missing provenance makes generated-origin claims partial.

Virtual TypeScript created for a framework artifact retains:

- the originating authored artifact;
- the generator/adapter and version;
- project and framework configuration;
- mapping from virtual/generated ranges to authored ranges;
- mapping quality and unsupported regions.

### 7.3 Contracts and exact shapes

Governed software Contract, Schema, API Boundary, Compatibility Rule, and Generated Contract Artifact are modeled as references to their concern owner and version. This document does not decide whether a prose declaration, TypeScript type, JSON Schema, generator input, generated file, or conformance test is the enforced shape authority; the actual governed chain is recorded.

### 7.4 Build model

Build Configuration, Build Execution, emitted/bundled Build Artifact, Execution Artifact, and Source Map are distinct. Source and emitted modules are separate occurrences linked by emission and mapping relations. Behavioral or shape equivalence between them is a claim requiring evidence.

---

## 8. TypeScript semantic core

### 8.1 Program and source context

A Program is one compiler/checker semantic universe constructed from an exact TypeScript Project configuration closure, root-file set, toolchain and compiler versions, module-resolution environment, conditional-export conditions, generated framework context, and construction health. Rebuilding from a changed member of that identity creates another Program context even when many source bytes remain equal.

A Source File Context is one source-bearing technical-artifact occurrence interpreted within one Program. The occurrence carries one explicit §7.1 classification—Authored Source Artifact, Generated Artifact, Virtual Artifact, Declaration Artifact, or External/Vendor Artifact—plus language version or script kind, parse context, module role, project membership, and parse health. Another explicitly source-bearing §7.1 classification remains permitted only when its classification and provenance are recorded. The same bytes interpreted by another Program, project variant, compiler version, conditional-export condition set, resolver environment, or generated context are a distinct Source File Context.

### 8.2 Syntax

AST Nodes have a syntax kind, parent, ordered child position, source range, source-bearing technical-artifact occurrence, project context, parser/toolchain, and parse health. Cross-revision node matching is a lineage inference, not stable node identity.

Expression, Statement, Declaration, decorator/annotation occurrence, and Control-Flow Node are distinct roles. Syntax alone does not establish a decorator's runtime or framework meaning.

### 8.3 Declarations, symbols, scopes, and references

- A Declaration is a syntax occurrence that introduces or contributes to a binding.
- A Symbol is a checker/program-context binding that may have multiple declarations.
- A Scope contains declarations/references under defined binding rules.
- A Reference is an occurrence with resolved, ambiguous, unresolved, or unsupported binding status.
- Alias, re-export, declaration merging, namespace/module augmentation, and ambient declarations remain explicit.

A textual name match is not symbol identity or reference resolution.

### 8.4 Types and signatures

A Type is an opaque project/checker-context semantic identity with an auditable provider representation. A display string or declared name is informative and cannot serve as universal identity.

Type Relations include versioned meanings for assignability, extension, implementation, alias, union/intersection membership, generic instantiation, parameter constraint, and other qualified relations. An inferred/provider relation remains distinct from compiler-confirmed semantics.

Overload Set, Overload Signature, Implementation Signature, callable target, and call resolution are distinct. A call can have confirmed, candidate, inferred, observed, or unresolved-dynamic targets.

### 8.5 Compiler diagnostics

A Compiler Diagnostic is a version-bound technical observation produced under an exact project/toolchain context. It is not automatically an Analyzer Finding Record or canonical Assurance Observation.

---

## 9. Graph families

| Graph family | Nodes and relations | Mandatory limit |
| --- | --- | --- |
| Syntax/AST | Source files, AST nodes, ordered containment | Parse coverage and errors explicit |
| Symbol/reference | Declarations, symbols, scopes, references, aliases/merges | Text match never substituted for resolution |
| Type graph | Types, type parameters, constraints, signatures, type relations | Checker/project context retained |
| Import graph | Import occurrences, module requests, resolver contexts, resolved/candidate targets, and dynamic imports | Import identity, conditions, and unresolved outcomes retained |
| Export graph | Export occurrences, exported/local names, re-exports, module requests, and resolved/candidate targets | Export and re-export identity never collapsed into import or dependency identity |
| Manifest graph | Workspaces, packages, manifests, dependency declarations, scripts, exports, and engines | Declared metadata is not resolution or execution |
| Lockfile graph | Lockfiles, resolved external components, integrity/version occurrences, and resolution paths | Lockfile resolution is not a declared dependency, import, or runtime load |
| Runtime-dependency graph | Inferred runtime dependencies and observed runtime loads with their source or execution contexts | Inferred and observed relations remain distinct |
| Call graph | Call sites, callable targets, dispatch candidates, observed targets | Dynamic/reflection uncertainty explicit |
| Control-flow graph | Entry/exit and typed transfer edges | Exceptional, async, unsupported constructs explicit |
| Data-flow graph | Definition/use, assignment, call/return, property access, capture, and value-flow relations | Bounded data flow never called complete information flow |
| Taint graph | Data sources, transformations, sanitizers, sinks, rule/profile scope, and taint-flow relations | Analysis-relative roles and bounded coverage remain explicit |
| Change/history graph | Revisions, snapshots, artifact occurrences, changes, lineage inferences | Cross-revision facts never presented as same-revision |
| Test graph | Suites, tests, selections, targets, runs, attempts, results, assertions | Configuration is not execution |
| Coverage graph | Runs, instrumentation, build artifacts, regions, denominator, granularity | Percentage never called correctness |
| Runtime graph | Executions, builds, environments, workloads, collectors, traces, spans, events, loads | Captured execution only |
| CPG/composed graph | Typed references into contributing graph layers | Composition preserves layer provenance and limits |

Program-dependence-graph and static-single-assignment views are optional derivations. They are not core provider-independent facts and cannot substitute for CFG/DFG provenance.

Every graph snapshot declares subject, graph kind, producer/method, capability coverage, completeness basis, limitations, and health. Every edge has typed endpoints, snapshot identity, provenance, epistemic state, and source locations where applicable.

---

## 10. Tests, coverage, and runtime evidence

### 10.1 Test model

Test Suite, Test, Test Case, Test Target, Test Selection, Test Run, retry/attempt, Test Result, and Assertion Outcome are distinct.

A Test Run binds:

- static subject and targeted build/source artifacts;
- runner and version;
- exact configuration;
- source- versus artifact-resolution mode;
- environment;
- selection;
- start/end or observation cutoff;
- every attempt and result.

### 10.2 Coverage model

A Coverage Observation binds:

- test or workload execution;
- instrumentation provider/configuration and relevant sites;
- target build/execution artifact;
- subject and source-origin mapping;
- selection;
- covered region;
- denominator basis;
- measurement granularity and metric;
- provider/method/version;
- observation time and limitations.

Coverage is evidence of identified execution. It is not proof of correctness, requirement satisfaction, or behavioral preservation.

### 10.3 Runtime model

Runtime Build Identity, Runtime Environment Identity, Workload Selection, Runtime Execution, Trace Schema, Trace Collector, Trace, Span, and Event are distinct.

A Runtime Execution binds one subject and execution artifact to its runtime build identity, runtime environment, input/workload selection, instrumentation configuration, start time, end or cutoff condition, and applicable trace collector. Missing or incompatible identity leaves the runtime observation partial or unusable for correlation.

A runtime-to-authored-source relation passes through the execution artifact and source-origin/source-map evidence. A trace without matching build, environment, workload, schema/collector, and time boundary remains incompatible or partial.

---

## 11. Analysis runs, facts, evidence, findings, and queries

### 11.1 Analysis Run and provider invocation

An Analysis Run identifies one plan against one subject. Each provider invocation is a child record with provider, version, capability, configuration, inputs, resource/authority boundary, timing, health, raw output, and diagnostics.

### 11.2 Semantic Fact

A Semantic Fact is a provider-independent technical assertion about an exact subject. It retains:

- producing run/invocation;
- method and capability;
- support basis;
- source locations;
- raw provider trace;
- coverage and limitations;
- freshness and invalidation dependencies;
- conflicts and successor relations.

### 11.3 Engineering Evidence Record

An Engineering Evidence Record is a technical record suitable for later governed mapping. It is not canonical Evidence until the canonical admission process accepts it for an exact scope.

### 11.4 Analyzer Finding Record reference

This model supplies subject, fact, evidence, rule-profile, provider, provenance, and history references needed by an Analyzer Finding Record. `JAN-CSAA-004` owns its state, severity, conflict, exception, and repository-gate semantics.

### 11.5 Architecture Rule reference

An Architecture Rule reference identifies the recognized concern owner, rule/profile identity and version, subject/applicability, and either an applicable exception reference or an explicit no-exception state. The rule's intended architecture meaning is not defined here.

### 11.6 Query reference and result binding

A Query reference identifies the later `JAN-CSAA-003` query definition plus input snapshot(s), evidence-set identity where dynamic evidence participates, parameters, execution identity, result coverage, limitations, and explanation/provenance. This document does not define query behavior.

---

## 12. Epistemic state and completeness

Epistemic state is multi-dimensional:

| Dimension | Representative values |
| --- | --- |
| Support basis | syntax-observed, resolver-confirmed, compiler-confirmed, runtime-observed, provider-inferred, user/governed-constraint reference |
| Capability coverage | supported, partial, unsupported, excluded, not analyzed |
| Execution health | succeeded, failed, timed out, cancelled, resource exhausted, malformed output |
| Freshness | current for subject, stale, invalidated, unknown |
| Conflict | unopposed, corroborated, conflicting, superseded/corrected |
| Inference | direct, derived, candidate, bounded inference, unknown |

Exact wire values are deferred. The conceptual dimensions cannot collapse into one “status.”

The following bounded terms prevent the non-equivalences in §3 from becoming label-only assertions:

| Term | Bounded technical meaning and owner |
| --- | --- |
| Current | The cited evidence satisfies the declared currency predicate for the exact subject at the stated observation time. It is not inferred from file age or missing invalidation links |
| Last-known-good | A separately identified earlier subject/evidence state that satisfied its then-applicable health and verification predicates. It is a fallback reference, never a claim about the current subject |
| Stale | A previously supported conclusion whose declared dependency or currency predicate no longer matches, or whose continued match cannot be established |
| Unsupported | The declared capability does not support the relevant subject, construct, context, or evidence mode; it is not an executed empty result |
| Empty | A supported, healthy, executed method produced zero members within an exact declared population and scope; it is not a pass unless separately owned criteria say zero is acceptable |
| Passed | An externally owned verification or gate evaluation satisfied its exact versioned criteria for its bound subject and evidence. This document models the reference state but does not define or confer those criteria |

No absence-of-finding claim exceeds the declared rule/capability coverage. No graph-completeness claim exists without a basis covering project perimeter, constructs, dynamic seams, failures, exclusions, and unresolved regions.

---

## 13. Lifecycle, invalidation, correction, and history

Semantic snapshots, analysis runs, provider invocations, execution observations, facts, Engineering Evidence Records, and technical finding references are immutable for their subject and observation.

Where this model carries Analyzer Finding Record, disposition, exception, or suppression history, it models only append-oriented external-reference lineage needed by technical facts. `JAN-CSAA-004` retains behavioral, transition, approval, expiry, and governance ownership for those records.

A successor may:

- correct a prior record while retaining the prior record and reason;
- supersede a stale or invalid record;
- add corroborating or conflicting evidence;
- bind a new execution evidence set;
- reanalyze a new snapshot;
- carry a later disposition reference.

Evidence becomes stale or invalid when a change can affect its conclusion, including changes to source/generated content, project configuration, lockfile/resolution, compiler/analyzer/rule/provider version, build or instrumentation configuration, test/workload selection, runtime build/environment, source mapping, or framework adapter/generated context.

The absence of an invalidation relation is not proof of freshness.

---

## 14. Object catalog

The catalog contains 127 objects. Each row inherits every §4.1 profile facet, including required and optional metadata, authority/epistemic limits, all four explicit state treatments, serialization ownership, and invariants. Its supplement adds mandatory item-specific identity/metadata and a narrower limit.

| Object | Family | Profile | Item identity and required metadata supplement | Additional authority/epistemic limit |
| --- | --- | --- | --- | --- |
| Repository | Repository subject | `O-SUB` | Opaque repository ID; observed roots/origins and VCS kind | Path or URL alone is not identity |
| Repository Revision | Repository subject | `O-SUB` | Repository ID plus immutable VCS/content revision coordinates | A moving Ref is not a revision |
| Revision Parentage | Repository subject | `O-REL` | Child revision, parent revision, parent role/order | Cross-repository or synthetic parentage is explicit |
| Commit | Repository subject | `O-SUB` | Repository ID plus immutable commit object/content-history identity | Commit is not a governed Baseline (`INV-011`) |
| Ref | Repository subject | `O-SUB` | Repository ID, ref name, observed target, observation time | Moving observation; never substitutes for target revision |
| Branch | Repository subject | `O-SUB` | Repository ID, branch name, observed head, observation time | Moving observation; branch name alone is insufficient |
| Merge Base | Repository subject | `O-SUB` | Repository ID, ordered compared revisions, computed merge-base revision, method | Bound to the named comparison |
| Candidate Merge | Repository subject | `O-SUB` | Input revisions/change sets, synthetic result identity, merge method | Synthetic result never masquerades as an existing Commit |
| Worktree | Repository subject | `O-SUB` | Repository ID, checkout identity, base revision, local-state observation | Worktree identity is distinct from Commit identity |
| Repository Snapshot | Repository subject | `O-SUB` | Repository ID, base/synthetic parentage, Working Change Set or input digests, perimeter and context manifest | Observation time is provenance, not content identity |
| Working Change Set | Repository subject | `O-SUB` | Base revision plus content-addressed additions, modifications, deletions, renames and included untracked inputs | Status summary alone is not reproducible identity |
| Workspace | Workspace/components | `O-CTX` | Root manifest occurrence, resolved membership declarations, snapshot | Filesystem proximity does not establish membership |
| Package | Workspace/components | `O-CTX` | Workspace occurrence, manifest path/content, package name/version attributes | Package and Workspace remain distinct |
| Package Manifest | Workspace/components | `O-CTX` | Snapshot artifact identity, package occurrence, format, content digest | Declarations are observations, not resolved dependencies |
| Lockfile | Workspace/components | `O-CTX` | Snapshot artifact identity, content digest, package-manager format/version | Resolution is bound to this exact lockfile |
| External Component | Workspace/components | `O-CTX` | Ecosystem, normalized component name, resolved version, integrity/source coordinates | Declared name without resolution is insufficient |
| Resolved Dependency Version | Workspace/components | `O-CTX` | Requester, dependency declaration, lockfile path/entry, component/version/integrity | Does not imply an import or runtime load |
| Advisory | Workspace/components | `O-REF` | Advisory source, advisory ID/version, affected-version expression, observation cutoff, declared scope and limitations | External source retains advisory authority |
| Vulnerability Observation | Workspace/components | `O-ANA` | Exact component/version, Advisory reference/version, correlation method and observation time | Revision-bound correlation; not a timeless property |
| TypeScript Project | Compilation context | `O-CTX` | Configuration artifact, effective options, file set, project references, compiler, resolver and generated context | Project meaning is configuration-closure-bound |
| Project Variant | Compilation context | `O-CTX` | Parent TypeScript Project plus variant purpose, overrides, effective file set and resolver/build mode | Normal/build/test/browser/SSR variants do not collapse |
| Effective Configuration | Compilation context | `O-CTX` | Root configuration, extension chain, overrides, effective options and file perimeter | Raw config text alone is not effective configuration |
| Compiler/Toolchain Identity | Compilation context | `O-CTX` | Compiler/tool names, exact versions/build identities, relevant plugins/adapters | Tool agreement is not correctness |
| Module-Resolution Environment | Compilation context | `O-CTX` | Resolver/version, mode, conditions, platform, aliases, base paths and package context | Different conditions create different resolution contexts |
| Generated Framework Context | Compilation context | `O-CTX` | Framework/adapter/version, generated config/virtual inputs, freshness and origin manifest | Missing or stale context makes affected facts partial |
| Authored Source Artifact | Technical artifacts | `O-ART` | Snapshot path/URI, content digest, authored classification and language/framework role | Generated content is never silently classified as authored |
| Generated Artifact | Technical artifacts | `O-ART` | Output occurrence/digest, generator/version, inputs, configuration, invocation/basis and origin mapping | `INV-006` and `INV-012` apply |
| Virtual Artifact | Technical artifacts | `O-ART` | Tool-scoped virtual URI/ID, content identity, producer/version, authored origin and mapping | Non-materialization remains explicit |
| Declaration Artifact | Technical artifacts | `O-ART` | Declaration Artifact occurrence/digest, declaration role, producer/origin and consumer project | Declaration authority and provenance are explicit |
| Configuration Artifact | Technical artifacts | `O-ART` | Configuration Artifact occurrence/digest, configuration kind, consumer and extension context | Presence does not prove effective use |
| Test Artifact | Technical artifacts | `O-ART` | Test Artifact occurrence/digest, test framework/role and target context | Test source is not a Test Run |
| External/Vendor Artifact | Technical artifacts | `O-ART` | External source/package coordinates, artifact path/digest, licensing/source provenance | External classification and trust boundary remain explicit |
| Contract Reference | Contracts/builds | `O-REF` | Concern owner, permanent/versioned contract identity, scope and local use | Meaning is not redefined here |
| Schema Reference | Contracts/builds | `O-REF` | Concern owner, schema identity/version/digest, governed scope and local use | Enforced schema retains exact-shape authority |
| API Boundary Reference | Contracts/builds | `O-REF` | Concern owner, boundary identity/version, participants, scope | Mere call adjacency is not a governed boundary |
| Compatibility Rule Reference | Contracts/builds | `O-REF` | Concern owner, rule identity/version, scope, direction and local applicability | Rule authority and exception remain external |
| Generated Contract Artifact | Contracts/builds | `O-ART` | Generated Contract Artifact digest, governing source/version, generator/version, generation basis and fidelity evidence | Generated output is a bound derivative, not second authority |
| Build Configuration | Contracts/builds | `O-CTX` | Configuration artifact/digest, tool/version, target, mode, inputs and effective options | Configuration is distinct from Build Execution |
| Build Execution | Contracts/builds | `O-ART` | Build config, tool/version, exact inputs, environment, start/end, result and raw record | Each execution is immutable |
| Build Artifact | Contracts/builds | `O-ART` | Producing Build Execution, output path/URI, digest, artifact class and source inputs | Rebuild creates a new occurrence even at the same path |
| Execution Artifact | Contracts/builds | `O-ART` | Build Artifact occurrence selected for execution plus runtime packaging/bundle identity | Runtime observations bind this occurrence |
| Source Map | Contracts/builds | `O-ART` | Map artifact/digest, producer/version, source/target artifacts, ranges, mapping quality | Missing mapping prevents exact source attribution (`INV-006`) |
| Program | Syntax | `O-SEM` | TypeScript Project/variant, effective configuration and root set, compiler/checker/resolver versions and options, condition set, generated context, construction health | Program identity is not a Source File occurrence or a compiler-native transient handle |
| Source File Context | Syntax | `O-SEM` | Program identity, source-bearing technical-artifact occurrence and §7.1 classification, language version/script kind, parse/module context, project membership and parse health | Same bytes in another Program are another context; no undefined `Source Artifact` umbrella is introduced |
| AST Node | Syntax | `O-SEM` | Program/parser-scoped node identity, kind, parent/ordinal and source range | Cross-revision matching is bounded inference |
| Source Location | Syntax | `O-SEM` | Technical-artifact occurrence, encoding, range, authored/generated/emitted role and mapping | Location role and mapping quality remain explicit |
| Declaration | Syntax | `O-SEM` | Program-scoped AST occurrence, declaration kind, source range and bound Symbol if resolved | Declaration and Symbol remain distinct |
| Expression | Syntax | `O-SEM` | Program-scoped AST occurrence, expression kind and source range | Syntax alone does not establish runtime effect |
| Statement | Syntax | `O-SEM` | Program-scoped AST occurrence, statement kind and source range | Syntax and CFG node remain distinct |
| Control-Flow Node | Syntax | `O-GRF` | CFG snapshot, owning callable/body, node kind, ordinal/source range | Unsupported control remains explicit |
| Decorator/Annotation Occurrence | Syntax | `O-SEM` | AST occurrence, target, syntax form, source range and resolution/effect evidence | Occurrence does not imply semantic effect |
| Module | Binding/types | `O-SEM` | Project/resolver-scoped source/emitted/runtime module occurrence and artifact | Source, emitted and loaded modules remain distinct |
| Symbol | Binding/types | `O-SEM` | Program/checker-scoped opaque identity, flags/kind and complete declaration set | Name alone is not identity |
| Scope | Binding/types | `O-SEM` | Program-scoped owner/boundary, parent scope and declaration membership | Textual nesting alone is insufficient |
| Reference | Binding/types | `O-SEM` | Source occurrence, name/token range, containing scope and resolved/unresolved target | Name match is not resolution |
| Type | Binding/types | `O-SEM` | Project/checker/run-scoped opaque identity, type kind and construction basis | Display string or declared name is informative only |
| Type Relation | Binding/types | `O-REL` | Relation kind, typed endpoint Type identities, checker context and evidence | Assignability, inheritance, alias and constituent kinds do not collapse |
| Type Parameter | Binding/types | `O-SEM` | Declaring semantic object, ordinal/name occurrence and checker identity | Bound to its declaration context |
| Constraint | Binding/types | `O-SEM` | Type Parameter, constraint Type, declaration/checker context | Absence and unresolved constraint remain distinct |
| Overload Set | Binding/types | `O-SEM` | Callable Symbol, ordered Overload Signatures and implementation association | Set does not equal any signature |
| Overload Signature | Binding/types | `O-SEM` | Overload Set, declaration occurrence, ordinal and Signature identity | Never reported as the implementation body |
| Implementation Signature | Binding/types | `O-SEM` | Callable implementation declaration and checker Signature identity | Distinct from exposed overload signatures |
| Namespace/Module Augmentation | Binding/types | `O-SEM` | Augmentation declaration, target Symbol/module, project and resolution state | Unresolved target remains explicit |
| Class | Binding/types | `O-SEM` | Class declaration/Symbol, project/checker context, members and heritage references | Declaration, Symbol, instance Type and constructor Type remain distinct |
| Interface | Binding/types | `O-SEM` | Interface declaration/Symbol, project/checker context, members and heritage references | Declaration merging remains visible |
| Function | Binding/types | `O-SEM` | Function declaration/expression occurrence, Symbol where present, callable Signature set | Function object and call target occurrence remain distinct |
| Method | Binding/types | `O-SEM` | Owning Class/Interface/object Type, declaration, Symbol and Signature set | Static/instance and declaration contexts remain explicit |
| Parameter | Binding/types | `O-SEM` | Owning Signature/declaration, ordinal, declaration occurrence, Symbol and Type | Parameter name alone is insufficient |
| Variable | Binding/types | `O-SEM` | Declaration occurrence, Symbol, scope, binding role and Type | Multiple declarations/assignments remain relations, not identity |
| Property | Binding/types | `O-SEM` | Owning Type/Symbol, declaration(s), key identity, flags and Type | Textual key match does not prove same property |
| Signature | Binding/types | `O-SEM` | Checker-scoped signature identity, declaration/owner, parameters, return Type and type parameters | Display rendering is not identity |
| Import Occurrence | Dependencies/calls | `O-SEM` | Importing module/artifact, syntax occurrence/range, requested specifier and import kind | Occurrence is distinct from resolution and dependency declaration |
| Export Occurrence | Dependencies/calls | `O-SEM` | Exporting module/artifact, syntax occurrence/range, export kind and exported/local names | Occurrence is distinct from resolved target |
| Manifest Dependency | Dependencies/calls | `O-REL` | Package Manifest, dependency section/key, requested range/specifier and target name | Declaration does not imply resolution, import or load |
| Resolved Component Relation | Dependencies/calls | `O-REL` | Requester/declaration, Lockfile, External Component/version/integrity and resolution path | Resolver/lockfile context is mandatory |
| Inferred Runtime Dependency | Dependencies/calls | `O-REL` | Source-bearing technical-artifact occurrence or Execution Artifact, candidate component/module, inference method/input and limitations | Never presented as observed or compiler-confirmed |
| Observed Runtime Load | Dependencies/calls | `O-REL` | Runtime Execution, loader event, loaded module/component/artifact and observation time | Captured load does not establish all possible loads |
| Call Site | Dependencies/calls | `O-SEM` | Program-scoped call/new/tagged occurrence, source range, call kind and resolution context | Distinct from every target |
| Callable Target | Dependencies/calls | `O-SEM` | Callable Symbol/Signature/declaration or runtime target descriptor, target state and context | Confirmed, candidate, inferred, observed and unresolved states remain distinct |
| Data Source | Data/instrumentation | `O-SEM` | DFG/taint snapshot, semantic occurrence, source role/rule reference and scope | Role is analysis-relative, not intrinsic authority |
| Transformation | Data/instrumentation | `O-SEM` | DFG/taint occurrence, input/output semantic objects, transform role and method | Bounded transformation evidence only |
| Sanitizer | Data/instrumentation | `O-SEM` | DFG/taint occurrence, sanitized flow, rule/profile reference and limitations | Syntax label alone does not establish effectiveness |
| Sink | Data/instrumentation | `O-SEM` | DFG/taint occurrence, consumed value/flow, sink role/rule reference and scope | Absence of a path is coverage-bound |
| Instrumentation Configuration | Data/instrumentation | `O-CTX` | Provider/version, configuration digest, target build, include/exclude rules and metric/trace mode | Configuration is distinct from an Instrumentation Site |
| Instrumentation Site | Data/instrumentation | `O-SEM` | Instrumentation Configuration, target artifact/location, inserted/native site identity and mapping | Site presence does not prove execution |
| Test Suite | Tests | `O-EXE` | Runner/framework-scoped suite definition, source occurrence and contained test identities | Suite definition is not a run |
| Test | Tests | `O-EXE` | Runner/framework-scoped test definition, source occurrence and declared identity | Configured is not selected or executed |
| Test Case | Tests | `O-EXE` | Test definition plus parameter/example/case coordinates | Cases remain distinguishable in results |
| Test Target | Tests | `O-EXE` | Target mode, source/build/execution artifact identity and project/runtime context | Source-resolving and artifact-resolving targets remain distinct |
| Test Selection | Tests | `O-EXE` | Runner config, filters/shards/tags/files, resolved selected tests and selection time | Selection is version-bound |
| Test Run | Tests | `O-EXE` | Static Semantic Snapshot Identity, Test Target, runner/config/version, environment, Test Selection, time boundary | Run aggregates but does not erase attempts |
| Test Attempt | Tests | `O-EXE` | Test Run, Test/Test Case, attempt ordinal, start/end and raw result | Retry is a new immutable attempt |
| Test Result | Tests | `O-EXE` | Test Attempt, outcome, diagnostics/output and duration | Passing result supports only its scoped execution |
| Assertion Outcome | Tests | `O-EXE` | Test Attempt, assertion occurrence/identity, target Claim/condition, outcome and diagnostics | Assertion success is not whole-test or behavioral proof |
| Coverage Observation | Coverage | `O-EXE` | Test Run or Runtime Execution, instrumentation, target build, selection/workload, region, denominator, granularity, metric and provider | `INV-004` applies |
| Coverage Region | Coverage | `O-EXE` | Target artifact/source mapping plus provider region coordinates and metric kind | Generated/authored roles remain explicit |
| Denominator Basis | Coverage | `O-EXE` | Provider/metric, eligible region universe, include/exclude rules and target build | Percentages with incompatible denominators do not combine |
| Measurement Granularity | Coverage | `O-EXE` | Metric unit and aggregation level such as statement/branch/function/file | Granularity is required for comparison |
| Runtime Build Identity | Runtime | `O-EXE` | Execution Artifact/build digest, build execution/configuration and deployment/package coordinates | Runtime build never floats to another source snapshot |
| Runtime Environment Identity | Runtime | `O-EXE` | OS/runtime/platform, relevant dependencies/configuration, container/host and environment digest/reference | Secrets are referenced safely, not embedded |
| Workload Selection | Runtime | `O-EXE` | Input/workload identity, selection/filtering, dataset/request references and boundaries | Observed workload is not all possible input |
| Runtime Execution | Runtime | `O-EXE` | Runtime Build Identity, Runtime Environment Identity, Workload Selection/input, time boundary and Instrumentation Configuration | Required binding closes the former `REQ-075` gap |
| Trace Schema | Runtime | `O-REF` | Schema owner, schema identity/version/digest and semantic scope | Exact event/span shape remains external |
| Trace Collector | Runtime | `O-EXE` | Collector identity/version, configuration, clock/context behavior and target Runtime Execution | Collector limits bound trace claims |
| Trace | Runtime | `O-EXE` | Runtime Execution, trace ID within collector/schema context, time boundary, root and completeness limits | Captured trace is not whole-program behavior |
| Span | Runtime | `O-EXE` | Trace, span ID, parent/link context, operation, time interval and attributes reference | Span nesting is observation-bound |
| Event | Runtime | `O-EXE` | Trace/Span or Runtime Execution, event identity/ordinal, time and schema-typed payload reference | Event occurrence alone proves only the captured event |
| History Relation | Change/constraints | `O-REL` | Typed predecessor/successor occurrences, history kind, method and confidence | Cross-revision relation names both snapshots |
| Change Relation | Change/constraints | `O-REL` | Before/after occurrences, change kind, comparison basis and evidence | Rename/move/copy may remain inferred |
| Architecture Rule Reference | Change/constraints | `O-REF` | Recognized owner, rule/profile identity/version, scope/applicability, and either applicable exception reference or explicit no-exception state | `JAN-CSAA-004` owns rule behavior |
| Exception/Suppression Reference | Change/constraints | `O-REF` | Recognized owner, exception/suppression identity/version, exact scope, authority and expiry | Suppression is not defect removal |
| Analysis Run | Analysis | `O-ANA` | Plan identity, exact subject(s), configuration, start/end and child invocation manifest | One immutable run against one declared subject |
| Provider Invocation | Analysis | `O-ANA` | Analysis Run, provider/version/capability/configuration, exact inputs, timing, health and raw output | Provider identity never substitutes for semantic identity |
| Capability Coverage | Analysis | `O-ANA` | Capability/method identity, declared supported/partial/unsupported perimeter, exclusions and observation basis | Distinct from execution health and correctness |
| Graph Snapshot | Analysis | `O-GRF` | Subject, graph kind, project/variant, producer/method, layer manifest, coverage and completeness basis | No unqualified completeness claim (`INV-008`) |
| Graph Layer | Analysis | `O-GRF` | Graph Snapshot, layer kind, source graph/fact manifest and composition role | CPG composition retains every layer's provenance |
| Graph Node | Analysis | `O-GRF` | Graph Snapshot/layer, node role, referenced semantic-object identity or explicitly graph-native identity, revision, provenance, epistemic state and source locations where applicable | A graph-native wrapper never replaces the referenced semantic object's authority or identity |
| Graph Edge | Analysis | `O-GRF` | Graph Snapshot/layer, edge kind, typed endpoints, source locations and support basis | Cross-revision and inferred states remain explicit |
| Semantic Fact | Analysis | `O-ANA` | Exact subject, Analysis Run/Invocation, method/capability, producer/version, source location, raw trace and limitations | `INV-001` and `INV-003` apply |
| Compiler Diagnostic | Analysis | `O-ANA` | Compiler/toolchain, project/configuration, diagnostic code/category/message, source/range and observation time | Technical observation; not automatically a governed finding |
| Query Reference | Analysis | `O-REF` | `JAN-CSAA-003` query identity/version, parameters/schema reference and local subject binding | Query behavior remains externally owned |
| Query Result Binding | Analysis | `O-ANA` | Query reference/version, exact Static Semantic Snapshot Identity, optional Execution Evidence Set Identity, execution identity and result coverage | Result never floats across snapshots |
| Engineering Evidence Record | Analysis | `O-ANA` | Technical record identity, subject, producing facts/run, scope, provenance, limitations and history | Not canonical Evidence without governed admission |
| Analyzer Finding Record Reference | Analysis | `O-REF` | `JAN-CSAA-004` record identity/version, subject, rule profile, status reference and local evidence links | State/severity/gate semantics remain externally owned |
| Static Semantic Snapshot Identity | Evidence identity | `O-ID` | Repository Snapshot plus project/config/toolchain/resolver/generated-context manifest | Static identity excludes later execution observations |
| Execution Evidence Set Identity | Evidence identity | `O-ID` | Static identity plus append-only ordered build/test/coverage/trace observation manifest | New evidence creates a successor set |
| Raw Provider Trace Reference | Evidence identity | `O-ID` | Provider invocation, content digest or durable reference, media/format and retention/availability state | Normalization may not erase this trace (`INV-003`) |

---

## 15. Relationship catalog

The catalog contains 137 relationship kinds. Each row inherits every §4.2 profile facet, including identity, subject and revision binding, provenance, ownership, lifecycle, versioning/invalidation, required and optional metadata, authority/epistemic limits, all four explicit state treatments, serialization ownership, and invariants. The required supplement narrows endpoints and item metadata.

| Relation ID | Relationship kind | Family | Profile | Typed endpoints and required supplement | Specific limit |
| --- | --- | --- | --- | --- | --- |
| `REL-001` | revision-parent | Revision | `R-STR` | child Repository Revision → parent Repository Revision; parent ordinal/role | Both revisions are immutable |
| `REL-002` | ref-target | Revision | `R-STR` | Ref → Repository Revision; observation time | Moving observation |
| `REL-003` | branch-head | Revision | `R-STR` | Branch → Repository Revision; observation time | Moving observation |
| `REL-004` | merge-base | Revision | `R-STR` | ordered revision pair → Merge Base; computation method | Bound to named pair |
| `REL-005` | candidate-merge-input | Revision | `R-STR` | Candidate Merge → input revision/change set; input role | No implicit input |
| `REL-006` | candidate-merge-result | Revision | `R-STR` | Candidate Merge → synthetic Repository Snapshot | Synthetic is explicit |
| `REL-007` | worktree-base | Revision | `R-STR` | Worktree → base Repository Revision | Worktree is not Commit |
| `REL-008` | snapshot-membership | Snapshot/change | `R-STR` | Repository Snapshot → included artifact/context; perimeter role | Exclusions are explicit |
| `REL-009` | change-set-application | Snapshot/change | `R-STR` | base revision + Working Change Set → Repository Snapshot | Reproducible inputs required |
| `REL-010` | before-after-occurrence | Snapshot/change | `R-STR` | before occurrence/snapshot → after occurrence/snapshot; comparison basis | `INV-002` |
| `REL-011` | rename-lineage | Snapshot/change | `R-INF` | before artifact → after artifact; rename method/confidence | Inference remains labeled |
| `REL-012` | move-lineage | Snapshot/change | `R-INF` | before artifact → after artifact; move method/confidence | Inference remains labeled |
| `REL-013` | copy-lineage | Snapshot/change | `R-INF` | source artifact → copied artifact; copy method/confidence | Identity is not reused |
| `REL-014` | workspace-membership | Workspace/package | `R-STR` | Workspace → Package; manifest declaration | Snapshot-bound |
| `REL-015` | package-containment | Workspace/package | `R-STR` | Package → contained technical-artifact occurrence/Project; containment kind | Not filesystem proximity alone |
| `REL-016` | manifest-declaration | Workspace/package | `R-RES` | Package Manifest → declared script/export/dependency/configuration | Declaration only |
| `REL-017` | package-export | Workspace/package | `R-RES` | Package Manifest/export key/conditions → target technical-artifact occurrence | Conditions retained |
| `REL-018` | lockfile-resolution | Resolution | `R-RES` | Manifest Dependency → Resolved Dependency Version; Lockfile/path | Does not imply import/load |
| `REL-019` | external-component-identification | Resolution | `R-RES` | Resolved Dependency Version → External Component; ecosystem/integrity | Exact component/version |
| `REL-020` | advisory-correlation | Resolution | `R-EXT` | External Component/version → Advisory; source/version/cutoff/method | Correlation is time-bound |
| `REL-021` | vulnerability-observation | Resolution | `R-EXT` | Vulnerability Observation → component/version + Advisory | Not timeless truth |
| `REL-022` | configuration-extension | Project/config | `R-RES` | Configuration Artifact → extended Configuration Artifact; resolution context | Cycle/unresolved explicit |
| `REL-023` | effective-config-derivation | Project/config | `R-RES` | config chain/overrides → Effective Configuration | Full chain retained |
| `REL-024` | project-include | Project/config | `R-RES` | TypeScript Project/Variant → included technical-artifact occurrence; rule/basis | Effective file set |
| `REL-025` | project-exclude | Project/config | `R-RES` | TypeScript Project/Variant → excluded technical-artifact occurrence/pattern; rule/basis | Exclusion not absence |
| `REL-026` | project-reference | Project/config | `R-RES` | TypeScript Project → referenced TypeScript Project; reference config | Resolution state explicit |
| `REL-027` | generated-context-use | Project/config | `R-RES` | TypeScript Project/Variant → Generated Framework Context | Freshness bounds facts |
| `REL-028` | artifact-classification | Technical artifact/origin | `R-STR` | technical-artifact occurrence → authored/generated/virtual/declaration/config/test/external class | `INV-012` |
| `REL-029` | generator-input | Technical artifact/origin | `R-MAP` | Generated Artifact/generation → input technical-artifact occurrence; input role | Input version retained |
| `REL-030` | generation | Technical artifact/origin | `R-MAP` | generator/configuration/invocation → Generated Artifact | Producer and basis required |
| `REL-031` | virtual-origin | Technical artifact/origin | `R-MAP` | Virtual Artifact → authored/generated origin | Mapping quality explicit |
| `REL-032` | emission | Technical artifact/origin | `R-MAP` | source/module/build execution → emitted Build Artifact/module | Source and emitted distinct |
| `REL-033` | bundling | Technical artifact/origin | `R-MAP` | input technical-artifact occurrences/modules → bundled Build Artifact | Many-to-one mapping retained |
| `REL-034` | source-map-mapping | Technical artifact/origin | `R-MAP` | generated/emitted range → authored source range; Source Map/quality | `INV-006` |
| `REL-035` | ast-parent | AST | `R-SEM` | AST Node → parent AST Node | Same Program context |
| `REL-036` | ast-ordered-child | AST | `R-SEM` | parent AST Node → child AST Node; ordinal/role | Order retained |
| `REL-037` | ast-source-range | AST | `R-SEM` | AST Node → Source Location | Encoding/role explicit |
| `REL-038` | declaration-symbol | Binding | `R-SEM` | Declaration → Symbol | Unresolved is separate |
| `REL-039` | symbol-declaration | Binding | `R-SEM` | Symbol → Declaration; declaration role | Multiple declarations retained |
| `REL-040` | symbol-alias | Binding | `R-SEM` | alias Symbol/Reference → target Symbol | Alias chain retained |
| `REL-041` | symbol-merge | Binding | `R-SEM` | declarations/symbol parts → merged Symbol | Inputs remain visible |
| `REL-042` | augmentation-target | Binding | `R-SEM` | Namespace/Module Augmentation → target Symbol/Module | Resolution state explicit |
| `REL-043` | scope-containment | Binding | `R-SEM` | Scope → declaration/reference/child Scope | Semantic containment |
| `REL-044` | reference-resolution | Binding | `R-SEM` | Reference → resolved Symbol/Declaration | Name match insufficient |
| `REL-045` | unresolved-reference | Binding | `R-RES` | Reference → unresolved target descriptor; reason/context | Failure is explicit |
| `REL-046` | type-of | Type | `R-SEM` | semantic object/expression/symbol → Type | Checker-context-bound |
| `REL-047` | type-assignability | Type | `R-SEM` | source Type → target Type; checker/rule context | Direction retained |
| `REL-048` | type-extension | Type | `R-SEM` | derived Type/Class/Interface → base Type | Heritage occurrence retained |
| `REL-049` | type-implementation | Type | `R-SEM` | Class/Type → implemented Interface/Type | Distinct from assignability |
| `REL-050` | type-alias | Type | `R-SEM` | alias declaration/Type → aliased Type | Alias is not identity collapse |
| `REL-051` | union-constituent | Type | `R-SEM` | union Type → constituent Type; ordinal | Construction context retained |
| `REL-052` | intersection-constituent | Type | `R-SEM` | intersection Type → constituent Type; ordinal | Construction context retained |
| `REL-053` | generic-instantiation | Type | `R-SEM` | generic target + type arguments → instantiated Type/Signature | Argument order retained |
| `REL-054` | parameter-constraint | Type | `R-SEM` | Type Parameter → constraint Type | Missing/unresolved explicit |
| `REL-055` | overload-membership | Type | `R-SEM` | Overload Set → Overload/Implementation Signature; role/ordinal | Roles do not collapse |
| `REL-056` | import-occurrence | Module | `R-RES` | importing Module/technical-artifact occurrence → Import Occurrence | Syntax occurrence only |
| `REL-057` | export-occurrence | Module | `R-RES` | exporting Module/technical-artifact occurrence → Export Occurrence | Syntax occurrence only |
| `REL-058` | re-export | Module | `R-RES` | Export Occurrence → requested/exported target; names/conditions | Request and target retained |
| `REL-059` | dynamic-import | Module | `R-INF` | dynamic Import Occurrence → candidate/resolved/unresolved Module | Dynamic uncertainty explicit |
| `REL-060` | requested-specifier | Module | `R-RES` | Import/Export Occurrence → literal/computed specifier descriptor | Specifier is not target |
| `REL-061` | resolved-module-target | Module | `R-RES` | importer + specifier → target Module/technical-artifact occurrence | `INV-010` |
| `REL-062` | unresolved-module-target | Module | `R-RES` | importer + specifier → unresolved descriptor/reason | Never dropped |
| `REL-063` | manifest-dependency | Dependency | `R-RES` | Package Manifest/Package → Manifest Dependency | Declaration only |
| `REL-064` | resolved-dependency | Dependency | `R-RES` | Manifest Dependency/requester → Resolved Component Relation/version | Lockfile/resolver retained |
| `REL-065` | inferred-runtime-dependency | Dependency | `R-INF` | source/build artifact → candidate runtime component/module | Inferred, not observed |
| `REL-066` | observed-runtime-load | Dependency | `R-EXE` | Runtime Execution → loaded module/component/artifact | Captured path only |
| `REL-067` | confirmed-call-target | Call | `R-SEM` | Call Site → Callable Target; compiler/checker basis | Confirmed state |
| `REL-068` | candidate-call-target | Call | `R-INF` | Call Site → Callable Target candidate; candidate basis/rank | Candidate state |
| `REL-069` | inferred-call-target | Call | `R-INF` | Call Site → inferred Callable Target; inference method | `INV-007` |
| `REL-070` | observed-call-target | Call | `R-EXE` | Call Site/runtime mapping → observed Callable Target; Runtime Execution | Observed execution only |
| `REL-071` | unresolved-call-target | Call | `R-INF` | Call Site → unresolved dynamic target descriptor/reason | Never implied absent |
| `REL-072` | cfg-entry | Control flow | `R-SEM` | callable/body → entry Control-Flow Node | CFG snapshot retained |
| `REL-073` | cfg-exit | Control flow | `R-SEM` | Control-Flow Node → callable/body exit | Normal/abrupt role |
| `REL-074` | cfg-fallthrough | Control flow | `R-SEM` | Control-Flow Node → successor node | Edge condition/context |
| `REL-075` | cfg-branch | Control flow | `R-SEM` | branch node → successor node; branch condition/role | Alternatives retained |
| `REL-076` | cfg-loop | Control flow | `R-SEM` | loop node → body/back/exit node; role | Cyclic role explicit |
| `REL-077` | cfg-call-return | Control flow | `R-SEM` | call node → continuation/return node; call context | Interprocedural limits explicit |
| `REL-078` | cfg-throw-catch-finally | Control flow | `R-SEM` | throwing node → handler/finally/exit node; exceptional role | Exceptional flow retained |
| `REL-079` | cfg-await-continuation | Control flow | `R-SEM` | await node → suspension/continuation node; async role | Async boundary explicit |
| `REL-080` | cfg-unsupported | Control flow | `R-INF` | source construct/node → unsupported-flow descriptor | Unsupported is not empty |
| `REL-081` | definition-use | Data flow | `R-SEM` | definition occurrence → use occurrence; value/slot context | Bounded DFG basis |
| `REL-082` | assignment-flow | Data flow | `R-SEM` | source value/definition → assigned target | Assignment kind retained |
| `REL-083` | argument-parameter-flow | Data flow | `R-SEM` | argument occurrence → Parameter; call/ordinal context | Target resolution limits apply |
| `REL-084` | return-call-flow | Data flow | `R-SEM` | return value/occurrence → Call Site/result | Interprocedural limits explicit |
| `REL-085` | property-read-write-flow | Data flow | `R-SEM` | write/definition → property read/use; property identity | Dynamic property limits explicit |
| `REL-086` | capture-flow | Data flow | `R-SEM` | captured variable/definition → closure/function use | Scope context retained |
| `REL-087` | source-flow-role | Data flow | `R-SEM` | Data Source → value/flow occurrence | Rule/profile scope retained |
| `REL-088` | transformation-flow-role | Data flow | `R-SEM` | input flow → Transformation → output flow | Bounded transform only |
| `REL-089` | sanitizer-flow-role | Data flow | `R-SEM` | input flow → Sanitizer → output flow | Effectiveness not syntax-assumed |
| `REL-090` | sink-flow-role | Data flow | `R-SEM` | value/flow occurrence → Sink | Absence is coverage-bound |
| `REL-091` | build-configuration-execution | Build | `R-STR` | Build Configuration → Build Execution | Exact effective config |
| `REL-092` | build-execution-artifact | Build | `R-MAP` | Build Execution → Build Artifact or Execution Artifact | Output digest required |
| `REL-093` | build-artifact-map | Build | `R-MAP` | Build Artifact → Source Map | Producer/build retained |
| `REL-094` | map-authored-location | Build | `R-MAP` | Source Map/generated range → authored Source Location | `INV-006` |
| `REL-095` | selection-test | Test | `R-EXE` | Test Selection → Test/Test Case | Selection basis retained |
| `REL-096` | test-run-subject | Test | `R-EXE` | Test Run → Repository Snapshot and Static Semantic Snapshot Identity | Exact subject |
| `REL-097` | test-run-build | Test | `R-EXE` | Test Run → Test Target, Build Artifact, or Execution Artifact | Target mode retained |
| `REL-098` | test-run-environment | Test | `R-EXE` | Test Run → Runtime Environment Identity | Environment retained |
| `REL-099` | test-run-attempt | Test | `R-EXE` | Test Run → Test Attempt; ordinal | Retries remain separate |
| `REL-100` | attempt-result | Test | `R-EXE` | Test Attempt → Test Result | One attempt/result occurrence |
| `REL-101` | result-assertion | Test | `R-EXE` | Test Result/Attempt → Assertion Outcome | All outcomes retained |
| `REL-102` | assertion-target | Test | `R-EXE` | Assertion Outcome → tested target/condition/Claim reference | Scope retained |
| `REL-103` | coverage-observation-run | Coverage | `R-EXE` | Coverage Observation → Test Run or Runtime Execution | `INV-004` |
| `REL-104` | coverage-instrumentation | Coverage | `R-EXE` | Coverage Observation → Instrumentation Configuration/Site | Provider/config retained |
| `REL-105` | coverage-build | Coverage | `R-EXE` | Coverage Observation → target Build Artifact or Execution Artifact | Exact target |
| `REL-106` | coverage-region | Coverage | `R-EXE` | Coverage Observation → Coverage Region | Source mapping retained |
| `REL-107` | coverage-denominator | Coverage | `R-EXE` | Coverage Observation → Denominator Basis | Required for percentage |
| `REL-108` | coverage-granularity | Coverage | `R-EXE` | Coverage Observation → Measurement Granularity | Required for comparison |
| `REL-109` | coverage-selection-workload | Coverage | `R-EXE` | Coverage Observation → Test Selection/Workload Selection | Selection retained |
| `REL-110` | trace-execution | Trace | `R-EXE` | Trace → Runtime Execution | `INV-005` |
| `REL-111` | trace-build | Trace | `R-EXE` | Trace → Runtime Build Identity or Execution Artifact | Exact build |
| `REL-112` | trace-environment | Trace | `R-EXE` | Trace → Runtime Environment Identity | Exact environment |
| `REL-113` | trace-workload | Trace | `R-EXE` | Trace → Workload Selection | Captured input scope |
| `REL-114` | trace-schema | Trace | `R-EXE` | Trace → Trace Schema | Exact schema version |
| `REL-115` | trace-collector | Trace | `R-EXE` | Trace → Trace Collector/configuration | Collector limits |
| `REL-116` | trace-span | Trace | `R-EXE` | Trace → Span; parent/order/link context | Captured structure |
| `REL-117` | trace-event | Trace | `R-EXE` | Trace/Span → Event; ordinal/time | Captured occurrence |
| `REL-118` | runtime-authored-mapping | Trace | `R-MAP` | runtime artifact/location → authored Source Location through build/map | `INV-006` |
| `REL-119` | fact-subject | Analysis/provenance | `R-STR` | Semantic Fact → static/dynamic subject identity | `INV-001` |
| `REL-120` | fact-analysis-run | Analysis/provenance | `R-STR` | Semantic Fact → Analysis Run | Producing run |
| `REL-121` | fact-provider-invocation | Analysis/provenance | `R-STR` | Semantic Fact → Provider Invocation | Producing invocation |
| `REL-122` | fact-method-capability | Analysis/provenance | `R-STR` | Semantic Fact → method/capability/Coverage record | Limits retained |
| `REL-123` | fact-raw-trace | Analysis/provenance | `R-STR` | Semantic Fact → Raw Provider Trace Reference | `INV-003` |
| `REL-124` | fact-source-location | Analysis/provenance | `R-SEM` | Semantic Fact → Source Location | Generated/authored role |
| `REL-125` | graph-composition-source | Analysis/provenance | `R-STR` | Graph Layer/Snapshot → contributing graph/fact set | `INV-008` |
| `REL-126` | analyzer-finding-reference | Technical records | `R-EXT` | local fact/evidence → Analyzer Finding Record Reference | `JAN-CSAA-004` owns behavior |
| `REL-127` | engineering-evidence-reference | Technical records | `R-STR` | Semantic Fact/analysis record → Engineering Evidence Record | Not canonical Evidence |
| `REL-128` | query-reference | Technical records | `R-EXT` | Query Result Binding/local subject → Query Reference | `JAN-CSAA-003` owns behavior |
| `REL-129` | architecture-rule-reference | Technical records | `R-EXT` | fact/query/finding → Architecture Rule Reference | `INV-011` |
| `REL-130` | exception-suppression-reference | Technical records | `R-EXT` | finding/rule context → Exception/Suppression Reference | Scope/authority/expiry retained |
| `REL-131` | invalidates | Lifecycle | `R-LIF` | changed dependency/evidence → affected fact/record | Reason and effective time |
| `REL-132` | stale-because | Lifecycle | `R-LIF` | stale fact/record → changed or unresolved dependency | Absence is not freshness |
| `REL-133` | conflicts-with | Lifecycle | `R-LIF` | fact/evidence/record ↔ conflicting peer | Both remain visible |
| `REL-134` | corroborates | Lifecycle | `R-LIF` | fact/evidence/record → corroborated peer | Does not merge provenance |
| `REL-135` | corrects | Lifecycle | `R-LIF` | correcting successor → prior record; reason | Prior record retained |
| `REL-136` | supersedes | Lifecycle | `R-LIF` | successor → predecessor; effective reason/time | No hard erasure |
| `REL-137` | derived-from | Lifecycle | `R-LIF` | derived object/relation → source object/relation set | Derivation method retained |

---

## 16. Cross-graph invariants

1. `INV-001` — No semantic fact without subject and provenance.
2. `INV-002` — No cross-revision edge presented as a same-revision fact.
3. `INV-003` — No provider-normalized fact that loses its raw provider trace.
4. `INV-004` — No coverage observation detached from execution artifact, instrumentation configuration, denominator basis, measurement granularity, and test/workload selection.
5. `INV-005` — No runtime observation detached from execution artifact, trace schema/collector, environment, workload, and time boundary.
6. `INV-006` — No coverage or trace-to-source relation without source-origin mapping where transformation occurred.
7. `INV-007` — No inferred edge presented as compiler-confirmed.
8. `INV-008` — No graph-completeness claim without a declared coverage basis.
9. `INV-009` — No Analyzer Finding Record state change that erases prior Engineering Evidence Records.
10. `INV-010` — No resolved module edge without importer, request specifier, resolver context, condition set, and target artifact classification.
11. `INV-011` — No architecture-rule conformance claim without recognized rule authority, version, scope, and either an applicable exception reference or an explicit no-exception state.
12. `INV-012` — No generated or virtual node presented as authored.
13. `INV-013` — No static and dynamic evidence combination without both snapshot identities.
14. `INV-014` — No currentness claim when an applicable invalidation dependency is unresolved.

---

## 17. Open forks and safe defaults

| Fork | Draft safe default |
| --- | --- |
| Repository identity | Opaque repository identity plus observed root/origin attributes; neither path nor URL alone |
| Cross-revision artifact identity | New snapshot occurrence; continuity is a separately evidenced lineage relation |
| AST-node identity | Snapshot/parser/project scoped; cross-revision matching is bounded inference |
| Symbol identity | Program/checker-context scoped; never symbol name alone |
| Type identity | Opaque project/checker/run-scoped identity; display text is informative |
| Source-location encoding | Conceptual artifact/range/mapping now; byte/UTF-16/line-column serialization deferred |
| Epistemic representation | Orthogonal support, coverage, health, freshness, conflict, and inference dimensions |
| Source/dist/browser/SSR module identity | Distinct resolved module occurrences linked by build/equivalence evidence |
| Conditional exports and aliases | Retain requester, specifier, importer, conditions, resolver, and target |
| Svelte virtual code | Require authored `.svelte` origin and mapping; stale/missing generated context is partial |
| Graph storage/CPG | Logical typed views only; no physical graph or database selection |
| PDG/SSA | Optional derived views with CFG/DFG provenance |
| Call completeness | Unresolved/candidate dynamic targets remain visible; no default whole-program claim |
| Coverage comparison | No aggregation across incompatible target modes, denominators, providers, granularities, or selections without explicit mapping |
| Advisory correlation | Exact ecosystem/component/version/advisory source and observation cutoff; uncertainty preserved |
| Query/finding ownership | Common subject/provenance references only; behavior remains `003`/`004` |
| Comments/docstrings | Text or annotation occurrences; never executable fact or architecture authority |
| Test retries | Distinct attempt identity; aggregate preserves every attempt |
| Recalculation | Invalidation meaning here; operational recomputation belongs to `009` |

---

## 18. Normative requirement catalog

Every row below is one independently dispositionable candidate predicate over one governed population and one conceptual field, state, relation, or prohibition. Binary non-equivalence is one predicate. Larger distinction sets, metadata bundles, state bundles, trigger bundles, and independently verifiable populations are decomposed into separate stable IDs. The catalog contains 119 retained prior IDs below 131 and 434 continuous, non-reused new IDs from `CSAA-002-REQ-131` through `CSAA-002-REQ-564`. Exact machine shapes remain deferred.

### 18.1 Governance and ownership

| Requirement ID | Atomic requirement |
| --- | --- |
| `CSAA-002-REQ-001` | The document SHALL carry complete controlled metadata. |
| `CSAA-002-REQ-002` | This document SHALL govern semantic meaning only. |
| `CSAA-002-REQ-003` | The model SHALL preserve canon-owned meanings. |
| `CSAA-002-REQ-004` | Exact field definitions SHALL remain owned by `JAN-CSAA-007` or the applicable enforced reference artifact. |
| `CSAA-002-REQ-131` | Exact enum spellings SHALL remain owned by `JAN-CSAA-007` or the applicable enforced reference artifact. |
| `CSAA-002-REQ-132` | Exact identifier shapes SHALL remain owned by `JAN-CSAA-007` or the applicable enforced reference artifact. |
| `CSAA-002-REQ-133` | Exact schemas SHALL remain owned by `JAN-CSAA-007` or the applicable enforced reference artifact. |
| `CSAA-002-REQ-134` | Wire compatibility SHALL remain owned by `JAN-CSAA-007` or the applicable enforced reference artifact. |
| `CSAA-002-REQ-005` | The document SHALL identify one semantic owner for every modeled concern. |
| `CSAA-002-REQ-006` | A Query SHALL be modeled only as an externally owned reference where applicable. |
| `CSAA-002-REQ-135` | An Architecture Rule SHALL be modeled only as an externally owned reference where applicable. |
| `CSAA-002-REQ-136` | An Analyzer Finding Record SHALL be modeled only as an externally owned reference where applicable. |
| `CSAA-002-REQ-137` | An exception SHALL be modeled only as an externally owned reference where applicable. |
| `CSAA-002-REQ-138` | A suppression SHALL be modeled only as an externally owned reference where applicable. |
| `CSAA-002-REQ-007` | The document SHALL identify its Draft state. |
| `CSAA-002-REQ-557` | The document SHALL identify its non-authoritative state. |
| `CSAA-002-REQ-008` | This document SHALL NOT govern machine shapes. |
| `CSAA-002-REQ-139` | This document SHALL NOT govern providers. |
| `CSAA-002-REQ-140` | This document SHALL NOT govern algorithms. |
| `CSAA-002-REQ-141` | This document SHALL NOT govern persistence. |
| `CSAA-002-REQ-142` | This document SHALL NOT govern gates. |
| `CSAA-002-REQ-143` | This document SHALL NOT govern current inventory. |
| `CSAA-002-REQ-144` | This document SHALL NOT govern implementation. |
| `CSAA-002-REQ-009` | The model SHALL NOT locally redefine Artifact. |
| `CSAA-002-REQ-145` | The model SHALL NOT locally redefine Observation. |
| `CSAA-002-REQ-146` | The model SHALL NOT locally redefine Evidence. |
| `CSAA-002-REQ-147` | The model SHALL NOT locally redefine Claim. |
| `CSAA-002-REQ-148` | The model SHALL NOT locally redefine Decision. |
| `CSAA-002-REQ-149` | The model SHALL NOT locally redefine Baseline. |
| `CSAA-002-REQ-150` | The model SHALL NOT locally redefine Assurance Policy. |
| `CSAA-002-REQ-151` | The model SHALL NOT locally redefine Assessment. |
| `CSAA-002-REQ-152` | The model SHALL NOT locally redefine Assurance Observation. |
| `CSAA-002-REQ-153` | The model SHALL NOT locally redefine Projection. |

### 18.2 Subject and revision identity

| Requirement ID | Atomic requirement |
| --- | --- |
| `CSAA-002-REQ-010` | Repository identity SHALL remain independent from a local checkout path. |
| `CSAA-002-REQ-011` | Immutable Commit identity SHALL remain distinct from a moving Ref observation. |
| `CSAA-002-REQ-154` | Immutable Commit identity SHALL remain distinct from a moving Branch observation. |
| `CSAA-002-REQ-012` | Revision parentage SHALL be explicit. |
| `CSAA-002-REQ-155` | Revision-parentage subject roles SHALL be explicit. |
| `CSAA-002-REQ-156` | Merge Base identity SHALL be explicit. |
| `CSAA-002-REQ-157` | Merge Base subject roles SHALL be explicit. |
| `CSAA-002-REQ-158` | Candidate Merge identity SHALL be explicit. |
| `CSAA-002-REQ-159` | Candidate Merge subject roles SHALL be explicit. |
| `CSAA-002-REQ-013` | A Repository Snapshot SHALL bind analyzed content identity. |
| `CSAA-002-REQ-160` | A Repository Snapshot SHALL bind analyzed configuration identity. |
| `CSAA-002-REQ-161` | A Repository Snapshot SHALL be immutable for those bound identities. |
| `CSAA-002-REQ-014` | Worktree identity SHALL remain distinct from Commit identity. |
| `CSAA-002-REQ-015` | A dirty snapshot SHALL include a reproducible Working Change Set or complete analyzed-input digests. |
| `CSAA-002-REQ-162` | A synthetic snapshot SHALL include a reproducible Working Change Set or complete analyzed-input digests. |
| `CSAA-002-REQ-016` | Static Semantic Snapshot Identity SHALL remain distinct from Execution Evidence Set Identity. |
| `CSAA-002-REQ-017` | A cross-snapshot comparison SHALL identify both snapshots. |
| `CSAA-002-REQ-018` | A cross-revision edge SHALL NOT be presented as a same-revision fact. |

### 18.3 Workspace, dependencies, and projects

| Requirement ID | Atomic requirement |
| --- | --- |
| `CSAA-002-REQ-020` | Workspace identity SHALL derive from its root manifest. |
| `CSAA-002-REQ-163` | Workspace identity SHALL derive from resolved membership. |
| `CSAA-002-REQ-164` | Filesystem proximity SHALL NOT establish Workspace identity. |
| `CSAA-002-REQ-021` | Workspace SHALL remain distinct from Package. |
| `CSAA-002-REQ-165` | Workspace SHALL remain distinct from Package Manifest. |
| `CSAA-002-REQ-166` | Workspace SHALL remain distinct from TypeScript Project. |
| `CSAA-002-REQ-167` | Package SHALL remain distinct from Package Manifest. |
| `CSAA-002-REQ-168` | Package SHALL remain distinct from TypeScript Project. |
| `CSAA-002-REQ-169` | Package Manifest SHALL remain distinct from TypeScript Project. |
| `CSAA-002-REQ-022` | TypeScript Project identity SHALL include its configuration artifact. |
| `CSAA-002-REQ-170` | TypeScript Project identity SHALL include inherited options. |
| `CSAA-002-REQ-171` | TypeScript Project identity SHALL include effective options. |
| `CSAA-002-REQ-172` | TypeScript Project identity SHALL include its file set. |
| `CSAA-002-REQ-173` | TypeScript Project identity SHALL include compiler identity. |
| `CSAA-002-REQ-174` | TypeScript Project identity SHALL include toolchain identity. |
| `CSAA-002-REQ-175` | TypeScript Project identity SHALL include module-resolution context. |
| `CSAA-002-REQ-176` | TypeScript Project identity SHALL include generated context. |
| `CSAA-002-REQ-023` | Normal and build project variants SHALL remain distinct analysis contexts. |
| `CSAA-002-REQ-024` | A declared dependency SHALL remain distinct from a lockfile-resolved component. |
| `CSAA-002-REQ-177` | A declared dependency SHALL remain distinct from an import edge. |
| `CSAA-002-REQ-178` | A declared dependency SHALL remain distinct from an inferred runtime dependency. |
| `CSAA-002-REQ-179` | A declared dependency SHALL remain distinct from an observed runtime load. |
| `CSAA-002-REQ-180` | A lockfile-resolved component SHALL remain distinct from an import edge. |
| `CSAA-002-REQ-181` | A lockfile-resolved component SHALL remain distinct from an inferred runtime dependency. |
| `CSAA-002-REQ-182` | A lockfile-resolved component SHALL remain distinct from an observed runtime load. |
| `CSAA-002-REQ-183` | An import edge SHALL remain distinct from an inferred runtime dependency. |
| `CSAA-002-REQ-184` | An import edge SHALL remain distinct from an observed runtime load. |
| `CSAA-002-REQ-185` | An inferred runtime dependency SHALL remain distinct from an observed runtime load. |
| `CSAA-002-REQ-025` | An Advisory SHALL bind its external source. |
| `CSAA-002-REQ-186` | An Advisory SHALL bind its advisory identifier. |
| `CSAA-002-REQ-187` | An Advisory SHALL bind its advisory version. |
| `CSAA-002-REQ-188` | An Advisory SHALL bind its affected-version expression. |
| `CSAA-002-REQ-189` | An Advisory SHALL bind its observation cutoff. |
| `CSAA-002-REQ-190` | An Advisory SHALL bind its declared scope. |
| `CSAA-002-REQ-191` | A Vulnerability Observation SHALL bind component identity. |
| `CSAA-002-REQ-192` | A Vulnerability Observation SHALL bind component version. |
| `CSAA-002-REQ-193` | A Vulnerability Observation SHALL bind its Advisory reference. |
| `CSAA-002-REQ-194` | A Vulnerability Observation SHALL bind advisory version. |
| `CSAA-002-REQ-195` | A Vulnerability Observation SHALL bind observation time. |
| `CSAA-002-REQ-196` | A Vulnerability Observation SHALL bind correlation method. |
| `CSAA-002-REQ-026` | An unresolved resolution outcome SHALL remain explicit. |
| `CSAA-002-REQ-197` | A conditional-export resolution outcome SHALL remain explicit. |
| `CSAA-002-REQ-198` | A subpath-export resolution outcome SHALL remain explicit. |
| `CSAA-002-REQ-199` | An environment-specific resolution outcome SHALL remain explicit. |

### 18.4 Artifacts, contracts, and builds

| Requirement ID | Atomic requirement |
| --- | --- |
| `CSAA-002-REQ-030` | An authored artifact SHALL remain distinct from a generated artifact. |
| `CSAA-002-REQ-200` | An authored artifact SHALL remain distinct from a virtual artifact. |
| `CSAA-002-REQ-201` | An authored artifact SHALL remain distinct from a declaration artifact. |
| `CSAA-002-REQ-202` | An authored artifact SHALL remain distinct from a configuration artifact. |
| `CSAA-002-REQ-203` | An authored artifact SHALL remain distinct from a test artifact. |
| `CSAA-002-REQ-204` | An authored artifact SHALL remain distinct from a build artifact. |
| `CSAA-002-REQ-205` | An authored artifact SHALL remain distinct from an external artifact. |
| `CSAA-002-REQ-206` | A generated artifact SHALL remain distinct from a virtual artifact. |
| `CSAA-002-REQ-207` | A generated artifact SHALL remain distinct from a declaration artifact. |
| `CSAA-002-REQ-208` | A generated artifact SHALL remain distinct from a configuration artifact. |
| `CSAA-002-REQ-209` | A generated artifact SHALL remain distinct from a test artifact. |
| `CSAA-002-REQ-210` | A generated artifact SHALL remain distinct from a build artifact. |
| `CSAA-002-REQ-211` | A generated artifact SHALL remain distinct from an external artifact. |
| `CSAA-002-REQ-212` | A virtual artifact SHALL remain distinct from a declaration artifact. |
| `CSAA-002-REQ-213` | A virtual artifact SHALL remain distinct from a configuration artifact. |
| `CSAA-002-REQ-214` | A virtual artifact SHALL remain distinct from a test artifact. |
| `CSAA-002-REQ-215` | A virtual artifact SHALL remain distinct from a build artifact. |
| `CSAA-002-REQ-216` | A virtual artifact SHALL remain distinct from an external artifact. |
| `CSAA-002-REQ-217` | A declaration artifact SHALL remain distinct from a configuration artifact. |
| `CSAA-002-REQ-218` | A declaration artifact SHALL remain distinct from a test artifact. |
| `CSAA-002-REQ-219` | A declaration artifact SHALL remain distinct from a build artifact. |
| `CSAA-002-REQ-220` | A declaration artifact SHALL remain distinct from an external artifact. |
| `CSAA-002-REQ-221` | A configuration artifact SHALL remain distinct from a test artifact. |
| `CSAA-002-REQ-222` | A configuration artifact SHALL remain distinct from a build artifact. |
| `CSAA-002-REQ-223` | A configuration artifact SHALL remain distinct from an external artifact. |
| `CSAA-002-REQ-224` | A test artifact SHALL remain distinct from a build artifact. |
| `CSAA-002-REQ-225` | A test artifact SHALL remain distinct from an external artifact. |
| `CSAA-002-REQ-226` | A build artifact SHALL remain distinct from an external artifact. |
| `CSAA-002-REQ-031` | A generated artifact SHALL NOT be reported as authored source. |
| `CSAA-002-REQ-227` | A virtual artifact SHALL NOT be reported as authored source. |
| `CSAA-002-REQ-032` | A generated artifact SHALL identify its generator. |
| `CSAA-002-REQ-228` | A generated artifact SHALL identify its generator version. |
| `CSAA-002-REQ-229` | A generated artifact SHALL identify its inputs. |
| `CSAA-002-REQ-230` | A generated artifact SHALL identify its generation configuration. |
| `CSAA-002-REQ-231` | A generated artifact SHALL identify its output identity. |
| `CSAA-002-REQ-232` | A generated artifact SHALL identify its source-origin relation. |
| `CSAA-002-REQ-033` | A transformed artifact SHALL retain generated-to-authored location mapping. |
| `CSAA-002-REQ-233` | A transformed artifact SHALL retain mapping quality. |
| `CSAA-002-REQ-034` | A Contract SHALL use an external authority reference rather than local redefinition. |
| `CSAA-002-REQ-234` | A Schema SHALL use an external authority reference rather than local redefinition. |
| `CSAA-002-REQ-235` | An API Boundary SHALL use an external authority reference rather than local redefinition. |
| `CSAA-002-REQ-236` | A Compatibility Rule SHALL use an external authority reference rather than local redefinition. |
| `CSAA-002-REQ-035` | Build Configuration SHALL remain distinct from Build Execution. |
| `CSAA-002-REQ-237` | Build Configuration SHALL remain distinct from Build Artifact. |
| `CSAA-002-REQ-238` | Build Configuration SHALL remain distinct from Execution Artifact. |
| `CSAA-002-REQ-239` | Build Execution SHALL remain distinct from Build Artifact. |
| `CSAA-002-REQ-240` | Build Execution SHALL remain distinct from Execution Artifact. |
| `CSAA-002-REQ-241` | Build Artifact SHALL remain distinct from Execution Artifact. |
| `CSAA-002-REQ-036` | Source Map identity SHALL remain explicit. |
| `CSAA-002-REQ-242` | Source Map mappings SHALL remain explicit. |
| `CSAA-002-REQ-037` | Source and emitted modules SHALL remain distinct occurrences. |
| `CSAA-002-REQ-243` | Source and emitted modules SHALL be linked by emission. |
| `CSAA-002-REQ-038` | Missing transformation provenance SHALL prevent an exact mapping claim. |
| `CSAA-002-REQ-039` | A source-to-emitted-module equivalence claim SHALL require evidence. |

### 18.5 TypeScript semantic core

| Requirement ID | Atomic requirement |
| --- | --- |
| `CSAA-002-REQ-040` | Source text SHALL remain distinct from AST. |
| `CSAA-002-REQ-244` | Source text SHALL remain distinct from declaration binding. |
| `CSAA-002-REQ-245` | Source text SHALL remain distinct from symbol semantics. |
| `CSAA-002-REQ-246` | Source text SHALL remain distinct from type semantics. |
| `CSAA-002-REQ-247` | AST SHALL remain distinct from declaration binding. |
| `CSAA-002-REQ-248` | AST SHALL remain distinct from symbol semantics. |
| `CSAA-002-REQ-249` | AST SHALL remain distinct from type semantics. |
| `CSAA-002-REQ-250` | Declaration binding SHALL remain distinct from symbol semantics. |
| `CSAA-002-REQ-251` | Declaration binding SHALL remain distinct from type semantics. |
| `CSAA-002-REQ-252` | Symbol semantics SHALL remain distinct from type semantics. |
| `CSAA-002-REQ-041` | Source File Context SHALL be defined. |
| `CSAA-002-REQ-253` | Program SHALL be defined. |
| `CSAA-002-REQ-254` | AST ordered parent-to-child structure SHALL be defined. |
| `CSAA-002-REQ-042` | Declaration identity SHALL be explicit. |
| `CSAA-002-REQ-255` | Declaration-to-symbol binding SHALL be explicit. |
| `CSAA-002-REQ-043` | Symbols with multiple declarations SHALL be representable. |
| `CSAA-002-REQ-256` | Symbol aliases SHALL be representable. |
| `CSAA-002-REQ-257` | Symbol merging SHALL be representable. |
| `CSAA-002-REQ-258` | Namespace augmentation SHALL be representable. |
| `CSAA-002-REQ-259` | Module augmentation SHALL be representable. |
| `CSAA-002-REQ-260` | Unresolved symbol bindings SHALL be representable. |
| `CSAA-002-REQ-044` | Scope containment SHALL remain independent from textual name matches. |
| `CSAA-002-REQ-261` | References SHALL remain independent from textual name matches. |
| `CSAA-002-REQ-045` | Type identity SHALL be project-context-bound. |
| `CSAA-002-REQ-262` | Type identity SHALL be checker-context-bound. |
| `CSAA-002-REQ-046` | Type Relation taxonomy SHALL distinguish assignability. |
| `CSAA-002-REQ-263` | Type Relation taxonomy SHALL distinguish extension. |
| `CSAA-002-REQ-264` | Type Relation taxonomy SHALL distinguish implementation. |
| `CSAA-002-REQ-265` | Type Relation taxonomy SHALL distinguish alias relations. |
| `CSAA-002-REQ-266` | Type Relation taxonomy SHALL distinguish constituent relations. |
| `CSAA-002-REQ-267` | Type Relation taxonomy SHALL distinguish generic instantiation. |
| `CSAA-002-REQ-268` | Type Relation taxonomy SHALL distinguish constraints. |
| `CSAA-002-REQ-047` | Overload Set SHALL remain distinct from Overload Signature. |
| `CSAA-002-REQ-269` | Overload Set SHALL remain distinct from Implementation Signature. |
| `CSAA-002-REQ-270` | Overload Set SHALL remain distinct from Call resolution. |
| `CSAA-002-REQ-271` | Overload Signature SHALL remain distinct from Implementation Signature. |
| `CSAA-002-REQ-272` | Overload Signature SHALL remain distinct from Call resolution. |
| `CSAA-002-REQ-273` | Implementation Signature SHALL remain distinct from Call resolution. |
| `CSAA-002-REQ-048` | A decorator occurrence SHALL NOT imply semantic effect from syntax alone. |
| `CSAA-002-REQ-274` | An annotation occurrence SHALL NOT imply semantic effect from syntax alone. |
| `CSAA-002-REQ-049` | An authored source location SHALL remain distinguishable. |
| `CSAA-002-REQ-275` | A generated source location SHALL remain distinguishable. |
| `CSAA-002-REQ-276` | A virtual source location SHALL remain distinguishable. |
| `CSAA-002-REQ-277` | An emitted source location SHALL remain distinguishable. |
| `CSAA-002-REQ-278` | A mapped source location SHALL remain distinguishable. |
| `CSAA-002-REQ-050` | A compiler-confirmed fact SHALL bind exact source identity. |
| `CSAA-002-REQ-279` | A compiler-confirmed fact SHALL bind exact project identity. |
| `CSAA-002-REQ-280` | A compiler-confirmed fact SHALL bind exact configuration identity. |
| `CSAA-002-REQ-281` | A compiler-confirmed fact SHALL bind exact compiler identity. |
| `CSAA-002-REQ-282` | A compiler-confirmed fact SHALL bind exact toolchain identity. |
| `CSAA-002-REQ-283` | A compiler-confirmed fact SHALL bind the resolver environment. |
| `CSAA-002-REQ-284` | A compiler-confirmed fact SHALL bind generated context. |
| `CSAA-002-REQ-051` | Compiler diagnostics SHALL remain version-bound technical observations. |
| `CSAA-002-REQ-052` | A display string SHALL NOT be Type identity. |
| `CSAA-002-REQ-285` | A declared name SHALL NOT be Type identity. |
| `CSAA-002-REQ-053` | A compiler diagnostic SHALL NOT automatically become a governed finding. |

### 18.6 Graph semantics

| Requirement ID | Atomic requirement |
| --- | --- |
| `CSAA-002-REQ-060` | Every graph snapshot SHALL identify its subject. |
| `CSAA-002-REQ-286` | Every graph snapshot SHALL identify its graph kind. |
| `CSAA-002-REQ-287` | Every graph snapshot SHALL identify its producer. |
| `CSAA-002-REQ-288` | Every graph snapshot SHALL identify its method. |
| `CSAA-002-REQ-289` | Every graph snapshot SHALL identify capability coverage. |
| `CSAA-002-REQ-290` | Every graph snapshot SHALL identify its completeness basis. |
| `CSAA-002-REQ-291` | Every graph snapshot SHALL identify its limitations. |
| `CSAA-002-REQ-061` | Every graph edge SHALL carry typed endpoints. |
| `CSAA-002-REQ-292` | Every graph node SHALL carry revision identity. |
| `CSAA-002-REQ-293` | Every graph edge SHALL carry revision identity. |
| `CSAA-002-REQ-294` | Every graph node SHALL carry provenance. |
| `CSAA-002-REQ-295` | Every graph edge SHALL carry provenance. |
| `CSAA-002-REQ-296` | Every graph node SHALL carry epistemic state. |
| `CSAA-002-REQ-297` | Every graph edge SHALL carry epistemic state. |
| `CSAA-002-REQ-298` | Every graph node SHALL carry source locations where applicable. |
| `CSAA-002-REQ-299` | Every graph edge SHALL carry source locations where applicable. |
| `CSAA-002-REQ-062` | The AST graph family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-300` | The symbol graph family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-301` | The type graph family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-302` | The import graph family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-303` | The export graph family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-304` | The manifest graph family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-305` | The lockfile graph family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-306` | The runtime-dependency graph family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-307` | The call graph family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-308` | The CFG family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-309` | The DFG family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-310` | The taint graph family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-311` | The CPG family SHALL remain distinct from other graph families. |
| `CSAA-002-REQ-063` | An import edge SHALL NOT collapse into the generic dependency edge type. |
| `CSAA-002-REQ-312` | A declared dependency SHALL NOT collapse into the generic dependency edge type. |
| `CSAA-002-REQ-313` | A resolved dependency instance SHALL NOT collapse into the generic dependency edge type. |
| `CSAA-002-REQ-314` | An inferred runtime dependency SHALL NOT collapse into the generic dependency edge type. |
| `CSAA-002-REQ-315` | An observed runtime load SHALL NOT collapse into the generic dependency edge type. |
| `CSAA-002-REQ-064` | A confirmed call target state SHALL remain distinguishable. |
| `CSAA-002-REQ-316` | A candidate call target state SHALL remain distinguishable. |
| `CSAA-002-REQ-317` | An inferred call target state SHALL remain distinguishable. |
| `CSAA-002-REQ-318` | An observed call target state SHALL remain distinguishable. |
| `CSAA-002-REQ-319` | An unresolved-dynamic call target state SHALL remain distinguishable. |
| `CSAA-002-REQ-065` | CFG relations SHALL account explicitly for exceptional control constructs where applicable. |
| `CSAA-002-REQ-320` | CFG relations SHALL account explicitly for asynchronous control constructs where applicable. |
| `CSAA-002-REQ-321` | CFG relations SHALL account explicitly for unsupported control constructs where applicable. |
| `CSAA-002-REQ-066` | A DFG role SHALL NOT equate bounded data flow with complete information flow. |
| `CSAA-002-REQ-322` | A taint role SHALL NOT equate bounded data flow with complete information flow. |
| `CSAA-002-REQ-067` | A CPG SHALL preserve every contributing graph's provenance. |
| `CSAA-002-REQ-323` | A CPG SHALL preserve every contributing graph's limitations. |
| `CSAA-002-REQ-068` | A PDG MAY be an optional derived view. |
| `CSAA-002-REQ-324` | An SSA representation MAY be an optional derived view. |
| `CSAA-002-REQ-069` | A graph completeness claim SHALL require a declared coverage basis. |
| `CSAA-002-REQ-058` | A CPG SHALL NOT imply repository completeness. |
| `CSAA-002-REQ-059` | A PDG SHALL NOT be treated as a core provider-independent fact. |
| `CSAA-002-REQ-325` | An SSA representation SHALL NOT be treated as a core provider-independent fact. |

### 18.7 Tests, coverage, and runtime evidence

| Requirement ID | Atomic requirement |
| --- | --- |
| `CSAA-002-REQ-070` | Test Suite SHALL remain distinct from Test. |
| `CSAA-002-REQ-326` | Test Suite SHALL remain distinct from Test Case. |
| `CSAA-002-REQ-327` | Test Suite SHALL remain distinct from Test Target. |
| `CSAA-002-REQ-328` | Test Suite SHALL remain distinct from Test Selection. |
| `CSAA-002-REQ-329` | Test Suite SHALL remain distinct from Test Run. |
| `CSAA-002-REQ-330` | Test Suite SHALL remain distinct from Test Attempt. |
| `CSAA-002-REQ-331` | Test Suite SHALL remain distinct from Test Result. |
| `CSAA-002-REQ-332` | Test Suite SHALL remain distinct from Assertion Outcome. |
| `CSAA-002-REQ-333` | Test SHALL remain distinct from Test Case. |
| `CSAA-002-REQ-334` | Test SHALL remain distinct from Test Target. |
| `CSAA-002-REQ-335` | Test SHALL remain distinct from Test Selection. |
| `CSAA-002-REQ-336` | Test SHALL remain distinct from Test Run. |
| `CSAA-002-REQ-337` | Test SHALL remain distinct from Test Attempt. |
| `CSAA-002-REQ-338` | Test SHALL remain distinct from Test Result. |
| `CSAA-002-REQ-339` | Test SHALL remain distinct from Assertion Outcome. |
| `CSAA-002-REQ-340` | Test Case SHALL remain distinct from Test Target. |
| `CSAA-002-REQ-341` | Test Case SHALL remain distinct from Test Selection. |
| `CSAA-002-REQ-342` | Test Case SHALL remain distinct from Test Run. |
| `CSAA-002-REQ-343` | Test Case SHALL remain distinct from Test Attempt. |
| `CSAA-002-REQ-344` | Test Case SHALL remain distinct from Test Result. |
| `CSAA-002-REQ-345` | Test Case SHALL remain distinct from Assertion Outcome. |
| `CSAA-002-REQ-346` | Test Target SHALL remain distinct from Test Selection. |
| `CSAA-002-REQ-347` | Test Target SHALL remain distinct from Test Run. |
| `CSAA-002-REQ-348` | Test Target SHALL remain distinct from Test Attempt. |
| `CSAA-002-REQ-349` | Test Target SHALL remain distinct from Test Result. |
| `CSAA-002-REQ-350` | Test Target SHALL remain distinct from Assertion Outcome. |
| `CSAA-002-REQ-351` | Test Selection SHALL remain distinct from Test Run. |
| `CSAA-002-REQ-352` | Test Selection SHALL remain distinct from Test Attempt. |
| `CSAA-002-REQ-353` | Test Selection SHALL remain distinct from Test Result. |
| `CSAA-002-REQ-354` | Test Selection SHALL remain distinct from Assertion Outcome. |
| `CSAA-002-REQ-355` | Test Run SHALL remain distinct from Test Attempt. |
| `CSAA-002-REQ-356` | Test Run SHALL remain distinct from Test Result. |
| `CSAA-002-REQ-357` | Test Run SHALL remain distinct from Assertion Outcome. |
| `CSAA-002-REQ-358` | Test Attempt SHALL remain distinct from Test Result. |
| `CSAA-002-REQ-359` | Test Attempt SHALL remain distinct from Assertion Outcome. |
| `CSAA-002-REQ-360` | Test Result SHALL remain distinct from Assertion Outcome. |
| `CSAA-002-REQ-071` | Each Test Run SHALL bind its subject. |
| `CSAA-002-REQ-361` | Each Test Run SHALL bind its target mode. |
| `CSAA-002-REQ-362` | Each Test Run SHALL bind its target artifact. |
| `CSAA-002-REQ-363` | Each Test Run SHALL bind its runner. |
| `CSAA-002-REQ-364` | Each Test Run SHALL bind its runner configuration. |
| `CSAA-002-REQ-365` | Each Test Run SHALL bind its runner version. |
| `CSAA-002-REQ-366` | Each Test Run SHALL bind its environment. |
| `CSAA-002-REQ-367` | Each Test Run SHALL bind its selection. |
| `CSAA-002-REQ-368` | Each Test Run SHALL bind its attempts. |
| `CSAA-002-REQ-369` | Each Test Run SHALL bind its observation time. |
| `CSAA-002-REQ-072` | Source-resolving and artifact-resolving test evidence SHALL NOT merge into one target identity. |
| `CSAA-002-REQ-370` | Combined source-resolving and artifact-resolving test evidence SHALL retain the source target identity. |
| `CSAA-002-REQ-371` | Combined source-resolving and artifact-resolving test evidence SHALL retain the artifact target identity. |
| `CSAA-002-REQ-073` | A Coverage Observation SHALL bind its Test Run or Runtime Execution. |
| `CSAA-002-REQ-372` | A Coverage Observation SHALL bind its instrumentation. |
| `CSAA-002-REQ-373` | A Coverage Observation SHALL bind its target build. |
| `CSAA-002-REQ-374` | A Coverage Observation SHALL bind its selection. |
| `CSAA-002-REQ-375` | A Coverage Observation SHALL bind its region. |
| `CSAA-002-REQ-376` | A Coverage Observation SHALL bind its denominator. |
| `CSAA-002-REQ-377` | A Coverage Observation SHALL bind its granularity. |
| `CSAA-002-REQ-378` | A Coverage Observation SHALL bind its provider. |
| `CSAA-002-REQ-379` | A Coverage Observation SHALL bind its provider method. |
| `CSAA-002-REQ-074` | Coverage SHALL be treated as evidence of identified execution only. |
| `CSAA-002-REQ-075` | A Runtime Execution SHALL bind its Runtime Build Identity. |
| `CSAA-002-REQ-380` | A Runtime Execution SHALL bind its Runtime Environment Identity. |
| `CSAA-002-REQ-381` | A Runtime Execution SHALL bind its input. |
| `CSAA-002-REQ-382` | A Runtime Execution SHALL bind its Workload Selection. |
| `CSAA-002-REQ-383` | A Runtime Execution SHALL bind its time boundary. |
| `CSAA-002-REQ-384` | A Runtime Execution SHALL bind its Instrumentation Configuration. |
| `CSAA-002-REQ-076` | A Trace SHALL bind its Trace Schema. |
| `CSAA-002-REQ-385` | A Trace SHALL bind its Trace Collector. |
| `CSAA-002-REQ-386` | A Trace SHALL bind its Runtime Execution. |
| `CSAA-002-REQ-387` | A Trace SHALL bind its Runtime Environment Identity. |
| `CSAA-002-REQ-388` | A Trace SHALL bind its Workload Selection. |
| `CSAA-002-REQ-389` | A Trace SHALL bind its observation limits. |
| `CSAA-002-REQ-390` | A Span SHALL bind its Trace Schema. |
| `CSAA-002-REQ-391` | A Span SHALL bind its Trace Collector. |
| `CSAA-002-REQ-392` | A Span SHALL bind its Runtime Execution. |
| `CSAA-002-REQ-393` | A Span SHALL bind its Runtime Environment Identity. |
| `CSAA-002-REQ-394` | A Span SHALL bind its Workload Selection. |
| `CSAA-002-REQ-395` | A Span SHALL bind its observation limits. |
| `CSAA-002-REQ-396` | An Event SHALL bind its Trace Schema. |
| `CSAA-002-REQ-397` | An Event SHALL bind its Trace Collector. |
| `CSAA-002-REQ-398` | An Event SHALL bind its Runtime Execution. |
| `CSAA-002-REQ-399` | An Event SHALL bind its Runtime Environment Identity. |
| `CSAA-002-REQ-400` | An Event SHALL bind its Workload Selection. |
| `CSAA-002-REQ-401` | An Event SHALL bind its observation limits. |
| `CSAA-002-REQ-077` | A runtime-to-authored-source relation SHALL pass through an execution artifact. |
| `CSAA-002-REQ-402` | A runtime-to-authored-source relation SHALL pass through a source-origin relation. |
| `CSAA-002-REQ-403` | A runtime-to-authored-source relation that uses a Source Map SHALL pass through Source Map evidence. |
| `CSAA-002-REQ-078` | A test addition SHALL create a successor Execution Evidence Set Identity. |
| `CSAA-002-REQ-404` | A coverage addition SHALL create a successor Execution Evidence Set Identity. |
| `CSAA-002-REQ-405` | A trace addition SHALL create a successor Execution Evidence Set Identity. |
| `CSAA-002-REQ-079` | Coverage SHALL NOT mean correctness. |
| `CSAA-002-REQ-406` | Coverage SHALL NOT mean behavioral preservation. |

### 18.8 Facts, provenance, epistemics, and lifecycle

| Requirement ID | Atomic requirement |
| --- | --- |
| `CSAA-002-REQ-080` | Every Semantic Fact SHALL bind its subject. |
| `CSAA-002-REQ-407` | Every Semantic Fact SHALL bind its Analysis Run. |
| `CSAA-002-REQ-408` | Every Semantic Fact SHALL bind its method. |
| `CSAA-002-REQ-409` | Every Semantic Fact SHALL bind its capability. |
| `CSAA-002-REQ-410` | Every Semantic Fact SHALL bind its producer. |
| `CSAA-002-REQ-411` | Every Semantic Fact SHALL bind its producer version. |
| `CSAA-002-REQ-412` | Every Semantic Fact SHALL bind its observation time. |
| `CSAA-002-REQ-413` | Every Semantic Fact SHALL bind its source location where applicable. |
| `CSAA-002-REQ-414` | Every Semantic Fact SHALL bind its limitations. |
| `CSAA-002-REQ-081` | A Semantic Fact SHALL preserve its raw provider trace or a content-addressed auditable reference. |
| `CSAA-002-REQ-082` | Normalization SHALL NOT erase source distinctions. |
| `CSAA-002-REQ-415` | Normalization SHALL NOT erase uncertainty. |
| `CSAA-002-REQ-416` | Normalization SHALL NOT erase unsupported regions. |
| `CSAA-002-REQ-417` | Normalization SHALL NOT erase provider disagreement. |
| `CSAA-002-REQ-083` | Direct extraction SHALL remain a distinct support basis. |
| `CSAA-002-REQ-418` | Compiler confirmation SHALL remain a distinct support basis. |
| `CSAA-002-REQ-419` | Runtime observation SHALL remain a distinct support basis. |
| `CSAA-002-REQ-420` | Bounded inference SHALL remain a distinct support basis. |
| `CSAA-002-REQ-084` | Support basis SHALL remain orthogonal to the other epistemic dimensions. |
| `CSAA-002-REQ-421` | Capability coverage SHALL remain orthogonal to the other epistemic dimensions. |
| `CSAA-002-REQ-422` | Execution health SHALL remain orthogonal to the other epistemic dimensions. |
| `CSAA-002-REQ-423` | Freshness SHALL remain orthogonal to the other epistemic dimensions. |
| `CSAA-002-REQ-424` | Conflict SHALL remain orthogonal to the other epistemic dimensions. |
| `CSAA-002-REQ-425` | Inference SHALL remain orthogonal to the other epistemic dimensions. |
| `CSAA-002-REQ-085` | An unsupported region SHALL remain explicit. |
| `CSAA-002-REQ-426` | An incomplete region SHALL remain explicit. |
| `CSAA-002-REQ-427` | A failed region SHALL remain explicit. |
| `CSAA-002-REQ-428` | An excluded region SHALL remain explicit. |
| `CSAA-002-REQ-429` | A stale region SHALL remain explicit. |
| `CSAA-002-REQ-430` | A conflicting region SHALL remain explicit. |
| `CSAA-002-REQ-431` | A not-analyzed region SHALL remain explicit. |
| `CSAA-002-REQ-432` | An unknown region SHALL remain explicit. |
| `CSAA-002-REQ-086` | “No Analyzer Finding Record under declared coverage” SHALL NOT be represented as “no defect.” |
| `CSAA-002-REQ-087` | An Engineering Evidence Record SHALL remain a non-canonical technical record unless governed Evidence admission occurs. |
| `CSAA-002-REQ-088` | Observation history SHALL remain append-oriented. |
| `CSAA-002-REQ-433` | A locally modeled Analyzer Finding Record reference history SHALL remain append-oriented. |
| `CSAA-002-REQ-434` | A locally modeled disposition-reference history SHALL remain append-oriented. |
| `CSAA-002-REQ-435` | A locally modeled suppression-reference history SHALL remain append-oriented. |
| `CSAA-002-REQ-436` | Correction history SHALL remain append-oriented. |
| `CSAA-002-REQ-437` | Supersession history SHALL remain append-oriented. |
| `CSAA-002-REQ-089` | An execution record SHALL be immutable for its subject. |
| `CSAA-002-REQ-438` | An analysis record SHALL be immutable for its subject. |
| `CSAA-002-REQ-090` | A conclusion SHALL become stale or invalid when a relevant source changes. |
| `CSAA-002-REQ-439` | A conclusion SHALL become stale or invalid when a relevant generated artifact changes. |
| `CSAA-002-REQ-440` | A conclusion SHALL become stale or invalid when a relevant configuration changes. |
| `CSAA-002-REQ-441` | A conclusion SHALL become stale or invalid when a relevant resolution changes. |
| `CSAA-002-REQ-442` | A conclusion SHALL become stale or invalid when a relevant provider changes. |
| `CSAA-002-REQ-443` | A conclusion SHALL become stale or invalid when a relevant rule changes. |
| `CSAA-002-REQ-444` | A conclusion SHALL become stale or invalid when relevant instrumentation changes. |
| `CSAA-002-REQ-445` | A conclusion SHALL become stale or invalid when relevant selection changes. |
| `CSAA-002-REQ-446` | A conclusion SHALL become stale or invalid when a relevant build changes. |
| `CSAA-002-REQ-447` | A conclusion SHALL become stale or invalid when a relevant environment changes. |
| `CSAA-002-REQ-448` | A conclusion SHALL become stale or invalid when a relevant mapping changes. |
| `CSAA-002-REQ-449` | A conclusion SHALL become stale or invalid when a relevant adapter changes. |
| `CSAA-002-REQ-091` | Invalidation dependencies SHALL be explicit. |
| `CSAA-002-REQ-092` | Conflicting evidence SHALL remain visible when a successor conclusion is recorded. |
| `CSAA-002-REQ-450` | Prior facts SHALL remain visible when a successor conclusion is recorded. |
| `CSAA-002-REQ-093` | A Query Reference SHALL bind one semantic snapshot. |
| `CSAA-002-REQ-451` | A Query Result Binding SHALL bind one semantic snapshot. |
| `CSAA-002-REQ-452` | A Query Reference that uses dynamic evidence SHALL bind one Execution Evidence Set Identity. |
| `CSAA-002-REQ-453` | A Query Result Binding that uses dynamic evidence SHALL bind one Execution Evidence Set Identity. |
| `CSAA-002-REQ-094` | Provider Invocation output SHALL NOT exercise governance. |
| `CSAA-002-REQ-095` | Refresh of an execution record SHALL create a successor. |
| `CSAA-002-REQ-454` | Refresh of an analysis record SHALL create a successor. |
| `CSAA-002-REQ-096` | Absence of an invalidation dependency SHALL NOT prove freshness. |
| `CSAA-002-REQ-128` | Provider Invocation output SHALL NOT mutate source. |
| `CSAA-002-REQ-129` | Provider Invocation output SHALL NOT become an independent source of authority. |

### 18.9 Cross-graph closure

| Requirement ID | Atomic requirement |
| --- | --- |
| `CSAA-002-REQ-100` | A semantic fact SHALL NOT exist without subject identity. |
| `CSAA-002-REQ-455` | A semantic fact SHALL NOT exist without provenance. |
| `CSAA-002-REQ-101` | A cross-revision edge SHALL NOT be presented as a same-revision fact. |
| `CSAA-002-REQ-102` | A provider-normalized fact SHALL NOT lose its raw-provider trace. |
| `CSAA-002-REQ-103` | A coverage observation SHALL NOT detach from its execution artifact. |
| `CSAA-002-REQ-456` | A coverage observation SHALL NOT detach from its instrumentation. |
| `CSAA-002-REQ-457` | A coverage observation SHALL NOT detach from its denominator. |
| `CSAA-002-REQ-458` | A coverage observation SHALL NOT detach from its granularity. |
| `CSAA-002-REQ-459` | A coverage observation SHALL NOT detach from its selection. |
| `CSAA-002-REQ-104` | A runtime observation SHALL NOT detach from its execution artifact. |
| `CSAA-002-REQ-460` | A runtime observation SHALL NOT detach from its trace schema. |
| `CSAA-002-REQ-461` | A runtime observation SHALL NOT detach from its trace collector. |
| `CSAA-002-REQ-462` | A runtime observation SHALL NOT detach from its environment. |
| `CSAA-002-REQ-463` | A runtime observation SHALL NOT detach from its workload. |
| `CSAA-002-REQ-464` | A runtime observation SHALL NOT detach from its time boundary. |
| `CSAA-002-REQ-105` | A transformed-code coverage mapping SHALL NOT exist without source-origin mapping. |
| `CSAA-002-REQ-465` | A transformed-code trace mapping SHALL NOT exist without source-origin mapping. |
| `CSAA-002-REQ-106` | An inferred edge SHALL NOT be presented as compiler-confirmed. |
| `CSAA-002-REQ-107` | A graph-completeness claim SHALL NOT exist without a declared coverage basis. |
| `CSAA-002-REQ-108` | An Analyzer Finding Record state change SHALL NOT erase prior Engineering Evidence Records. |
| `CSAA-002-REQ-109` | A resolved module edge SHALL NOT omit resolver context. |
| `CSAA-002-REQ-466` | A resolved module edge SHALL NOT omit target artifact class. |
| `CSAA-002-REQ-561` | A resolved module edge SHALL NOT omit importer identity. |
| `CSAA-002-REQ-562` | A resolved module edge SHALL NOT omit the requested specifier. |
| `CSAA-002-REQ-563` | A resolved module edge SHALL NOT omit the resolver condition set. |
| `CSAA-002-REQ-110` | An architecture-rule conformance claim SHALL NOT omit recognized authority. |
| `CSAA-002-REQ-467` | An architecture-rule conformance claim SHALL NOT omit authority version. |
| `CSAA-002-REQ-468` | An architecture-rule conformance claim SHALL NOT omit scope. |
| `CSAA-002-REQ-469` | An architecture-rule conformance claim SHALL NOT omit an applicable exception reference or an explicit no-exception state. |
| `CSAA-002-REQ-111` | A generated node SHALL NOT masquerade as authored. |
| `CSAA-002-REQ-470` | A virtual node SHALL NOT masquerade as authored. |
| `CSAA-002-REQ-112` | A combined static-and-dynamic evidence record SHALL NOT omit Static Semantic Snapshot Identity. |
| `CSAA-002-REQ-471` | A combined static-and-dynamic evidence record SHALL NOT omit Execution Evidence Set Identity. |
| `CSAA-002-REQ-564` | A currentness claim SHALL NOT be made while an applicable invalidation dependency is unresolved. |

### 18.10 Catalog completeness, conflict routing, and controlled lifecycle

| Requirement ID | Atomic requirement |
| --- | --- |
| `CSAA-002-REQ-113` | Every mandatory requirement SHALL receive a ledger row before Proposed status. |
| `CSAA-002-REQ-472` | Every mandatory requirement SHALL receive a verification binding before Proposed status. |
| `CSAA-002-REQ-097` | An apparent authority conflict SHALL be recorded. |
| `CSAA-002-REQ-473` | An apparent authority conflict SHALL be routed to `JPWB-REG-005`. |
| `CSAA-002-REQ-558` | An apparent semantic conflict SHALL be recorded. |
| `CSAA-002-REQ-559` | An apparent semantic conflict SHALL be routed to `JPWB-REG-005`. |
| `CSAA-002-REQ-098` | Draft-to-Proposed advancement SHALL require requirement-ledger closure. |
| `CSAA-002-REQ-474` | Draft-to-Proposed advancement SHALL require completed author self-review. |
| `CSAA-002-REQ-099` | Every candidate-byte change after an exact review freeze SHALL receive affected re-review unless it satisfies the exact pre-frozen administrative-substitution exception in `REG-D-022`. |
| `CSAA-002-REQ-114` | Every cataloged object SHALL define stable identity. |
| `CSAA-002-REQ-475` | Every cataloged relationship SHALL define stable identity. |
| `CSAA-002-REQ-115` | Every cataloged object SHALL define subject binding. |
| `CSAA-002-REQ-476` | Every cataloged object SHALL define revision binding. |
| `CSAA-002-REQ-477` | Every cataloged relationship SHALL define subject binding. |
| `CSAA-002-REQ-478` | Every cataloged relationship SHALL define revision binding. |
| `CSAA-002-REQ-116` | Every cataloged object SHALL define provenance. |
| `CSAA-002-REQ-479` | Every cataloged relationship SHALL define provenance. |
| `CSAA-002-REQ-117` | Every cataloged object SHALL define concern ownership. |
| `CSAA-002-REQ-480` | Every cataloged relationship SHALL define concern ownership. |
| `CSAA-002-REQ-118` | Every cataloged object SHALL define lifecycle. |
| `CSAA-002-REQ-481` | Every cataloged object SHALL define versioning. |
| `CSAA-002-REQ-482` | Every cataloged object SHALL define invalidation. |
| `CSAA-002-REQ-483` | Every cataloged relationship SHALL define lifecycle. |
| `CSAA-002-REQ-484` | Every cataloged relationship SHALL define versioning. |
| `CSAA-002-REQ-485` | Every cataloged relationship SHALL define invalidation. |
| `CSAA-002-REQ-119` | Every cataloged object SHALL define its authority basis. |
| `CSAA-002-REQ-486` | Every cataloged object SHALL define its epistemic limits. |
| `CSAA-002-REQ-487` | Every cataloged relationship SHALL define its authority basis. |
| `CSAA-002-REQ-488` | Every cataloged relationship SHALL define its epistemic limits. |
| `CSAA-002-REQ-120` | Every cataloged object SHALL define required conceptual metadata. |
| `CSAA-002-REQ-489` | Every cataloged object SHALL define optional conceptual metadata. |
| `CSAA-002-REQ-490` | Every cataloged relationship SHALL define required conceptual metadata. |
| `CSAA-002-REQ-491` | Every cataloged relationship SHALL define optional conceptual metadata. |
| `CSAA-002-REQ-121` | Every cataloged object SHALL define supported-state treatment. |
| `CSAA-002-REQ-492` | Every cataloged object SHALL define inferred-state treatment. |
| `CSAA-002-REQ-493` | Every cataloged object SHALL define unknown-state treatment. |
| `CSAA-002-REQ-494` | Every cataloged object SHALL define conflicting-state treatment. |
| `CSAA-002-REQ-495` | Every cataloged relationship SHALL define supported-state treatment. |
| `CSAA-002-REQ-496` | Every cataloged relationship SHALL define inferred-state treatment. |
| `CSAA-002-REQ-497` | Every cataloged relationship SHALL define unknown-state treatment. |
| `CSAA-002-REQ-498` | Every cataloged relationship SHALL define conflicting-state treatment. |
| `CSAA-002-REQ-122` | Every cataloged object SHALL identify its serialization owner. |
| `CSAA-002-REQ-499` | Every cataloged relationship SHALL identify its serialization owner. |
| `CSAA-002-REQ-123` | Every cataloged object SHALL identify applicable cross-graph invariants. |
| `CSAA-002-REQ-500` | Every cataloged relationship SHALL identify applicable cross-graph invariants. |
| `CSAA-002-REQ-124` | Every cataloged object SHALL map explicitly to one complete §4 object profile. |
| `CSAA-002-REQ-501` | Every cataloged object SHALL carry one item supplement. |
| `CSAA-002-REQ-502` | Every cataloged relationship SHALL map explicitly to one complete §4 relationship profile. |
| `CSAA-002-REQ-503` | Every cataloged relationship SHALL carry one item supplement. |
| `CSAA-002-REQ-130` | Repository SHALL remain distinct from Repository Revision. |
| `CSAA-002-REQ-504` | Repository Revision SHALL remain distinct from Repository Snapshot. |
| `CSAA-002-REQ-505` | Repository Snapshot SHALL remain distinct from Working Change Set. |
| `CSAA-002-REQ-506` | Repository Commit SHALL remain distinct from a governed Baseline. |
| `CSAA-002-REQ-507` | Workspace SHALL remain distinct from Package. |
| `CSAA-002-REQ-508` | Package SHALL remain distinct from TypeScript Project. |
| `CSAA-002-REQ-509` | TypeScript Project SHALL remain distinct from Module. |
| `CSAA-002-REQ-510` | Package-manifest dependency SHALL remain distinct from resolved component. |
| `CSAA-002-REQ-511` | Resolved component SHALL remain distinct from import edge. |
| `CSAA-002-REQ-512` | Import edge SHALL remain distinct from observed runtime load. |
| `CSAA-002-REQ-513` | Authored artifact SHALL remain distinct from generated artifact. |
| `CSAA-002-REQ-514` | Generated artifact SHALL remain distinct from virtual artifact. |
| `CSAA-002-REQ-515` | Virtual artifact SHALL remain distinct from build artifact. |
| `CSAA-002-REQ-516` | Source module SHALL remain distinct from emitted module. |
| `CSAA-002-REQ-517` | Emitted module SHALL remain distinct from runtime-loaded module. |
| `CSAA-002-REQ-518` | Semantic index SHALL remain distinct from authored-source authority. |
| `CSAA-002-REQ-519` | Source text SHALL remain distinct from AST node. |
| `CSAA-002-REQ-520` | AST node SHALL remain distinct from declaration. |
| `CSAA-002-REQ-521` | Declaration SHALL remain distinct from symbol. |
| `CSAA-002-REQ-522` | Symbol SHALL remain distinct from type. |
| `CSAA-002-REQ-523` | Name match SHALL remain distinct from reference resolution. |
| `CSAA-002-REQ-524` | Call Site SHALL remain distinct from confirmed target. |
| `CSAA-002-REQ-525` | Confirmed target SHALL remain distinct from candidate target. |
| `CSAA-002-REQ-526` | Candidate target SHALL remain distinct from observed target. |
| `CSAA-002-REQ-527` | AST SHALL remain distinct from control-flow graph. |
| `CSAA-002-REQ-528` | Control-flow graph SHALL remain distinct from data-flow graph. |
| `CSAA-002-REQ-529` | Data-flow graph SHALL remain distinct from call graph. |
| `CSAA-002-REQ-530` | Call graph SHALL remain distinct from dependency graph. |
| `CSAA-002-REQ-531` | Code property graph SHALL remain distinct from a complete repository semantic graph. |
| `CSAA-002-REQ-532` | Static semantic snapshot SHALL remain distinct from execution evidence set. |
| `CSAA-002-REQ-533` | Test configured SHALL remain distinct from test selected. |
| `CSAA-002-REQ-534` | Test selected SHALL remain distinct from test executed. |
| `CSAA-002-REQ-535` | Test executed SHALL remain distinct from test passed. |
| `CSAA-002-REQ-536` | Test passed SHALL remain distinct from intended behavior preserved. |
| `CSAA-002-REQ-537` | Coverage observation SHALL remain distinct from correctness. |
| `CSAA-002-REQ-538` | Correctness SHALL remain distinct from behavioral preservation. |
| `CSAA-002-REQ-539` | Trace event SHALL remain distinct from whole-program behavior. |
| `CSAA-002-REQ-540` | Analyzer Provider SHALL remain distinct from Analysis Rule Profile. |
| `CSAA-002-REQ-541` | Analysis Rule Profile SHALL remain distinct from Assurance Policy. |
| `CSAA-002-REQ-542` | Provider Invocation SHALL remain distinct from Assurance Policy satisfaction. |
| `CSAA-002-REQ-543` | Assurance Policy satisfaction SHALL remain distinct from Assessment. |
| `CSAA-002-REQ-544` | Provider Invocation output SHALL remain distinct from semantic authority. |
| `CSAA-002-REQ-545` | Semantic authority SHALL remain distinct from canonical Evidence. |
| `CSAA-002-REQ-546` | Canonical Evidence SHALL remain distinct from Decision. |
| `CSAA-002-REQ-547` | Suppression SHALL remain distinct from defect removal. |
| `CSAA-002-REQ-560` | Exception SHALL remain distinct from defect removal. |
| `CSAA-002-REQ-548` | Defect removal SHALL remain distinct from correctness. |
| `CSAA-002-REQ-549` | Tool agreement SHALL remain distinct from correctness. |
| `CSAA-002-REQ-550` | “No Analyzer Finding Record” SHALL remain distinct from “no defect.” |
| `CSAA-002-REQ-551` | Absence of observation SHALL remain distinct from evidence of absence. |
| `CSAA-002-REQ-552` | Absence of Evidence SHALL remain distinct from evidence of absence. |
| `CSAA-002-REQ-553` | Current SHALL remain distinct from last-known-good. |
| `CSAA-002-REQ-554` | Last-known-good SHALL remain distinct from stale. |
| `CSAA-002-REQ-555` | Unsupported SHALL remain distinct from empty. |
| `CSAA-002-REQ-556` | Empty SHALL remain distinct from passed. |

---

## 19. Verification allocation

The Wave 1 methods below are author-side adversarial-question, example, and scenario checks. They do not constitute the independent adversarial review that activates only after exact Proposed promotion.

| Verification concern | Wave 1 method | Later executable owner |
| --- | --- | --- |
| Object-catalog coverage | Mechanical count plus source-concept coverage mapping from `JAN-CSAA-000` §10.2 to 127 §14 rows; required source concepts remain distinguishable and legitimate local extensions are labeled rather than forced into artificial one-to-one equality | `JAN-CSAA-008` may enforce schema coverage later |
| Relationship-catalog coverage | Mechanical count and uniqueness check of 137 §15 relation IDs | `JAN-CSAA-008` may enforce schema coverage later |
| Required facets for each object/relation | Profile-column completeness plus one-profile/one-supplement mapping inspection | `JAN-CSAA-007`/`008` |
| Atomic requirement extraction | One independently dispositionable predicate per §18 row; field, state, trigger, population, and non-equivalence decomposition; exact ledger-ID and inherited-source reconciliation | Corpus conformance later |
| Ownership singularity | Cross-document semantic audit | Corpus conformance later |
| Revision and project identity | Author-side adversarial examples using current inventory | Fixture/contracts/tests later `006`–`008` |
| Generated-source mapping | Repository-example review | Adapter and conformance later `007`/`008` |
| Type and graph distinctions | Expert semantic review | Differential/provider tests later `008`/`011` |
| Coverage/trace identity | Evidence-model review | Fixture and conformance later `006`–`008` |
| No-false-green and epistemic dimensions | Author-side adversarial-question audit | `JAN-CSAA-008` |
| Invalidation and history | Scenario review | `JAN-CSAA-008`/`009` |

`REG-D-021`/`REG-D-022`, not this allocation, commission the later documentation subphases. This allocation creates no later artifact, satisfies no objective readiness gate, performs no executable work, and confers no authority.

---

## 20. Revision-bound JPWB examples

[JAN-CSAA-005@0.1.0](<records/archive/JAN-CSAA-005@0.1.0.Draft.REG-D-020.snapshot>) records facts for the exact historical subject bound to parent commit `e673fb5c2e186fb0873d3720036e5e8d7b00038a`, observation time `2026-07-26T11:52:31.6050250-04:00`, and [JAN-CSAA-005-EVIDENCE-001@0.1.0](<records/JAN-CSAA-005 - Preparation Evidence Snapshot.md>). It is non-authoritative and `STALE_FOR_CURRENT_REPOSITORY`. These examples are informative, do not establish current repository facts, are not silently rebound to the successor inventory, and are used only to test the model:

- package exports can resolve a workspace import to source, declarations, or emitted JavaScript under different consumers;
- package source and build project variants include different file sets;
- the Svelte app consumes generated project context and uses a different module-resolution mode;
- dynamic imports and server-only boundaries prevent silent whole-program call/import completeness;
- generated TypeScript, generated JSON Schemas, vocab inputs, and generator scripts form provenance chains;
- artifact-resolving and source-resolving tests are deliberately different executions;
- coverage configuration identifies source selection, exclusions, denominator, provider, and thresholds;
- Playwright deterministic and live/network configurations are distinct evidence contexts.

---

## 21. Draft acceptance state

This `0.3.1` revision is a correction-only, non-authoritative Draft successor under `REG-D-018` as extended by `REG-D-021` and corrected by `REG-D-022`. It corrects `JAN-CSAA-002-SR-001` in the controlled evidence and lifecycle wording without changing the semantic catalog, requirement IDs, provider-independent contract, authority boundary, or later-lifecycle nonpasses. The adopted `JAN-CSAA-000@0.3.0` README remains the authority and manifest baseline; `JAN-CSAA-WORKING-STATUS-001` carries non-authoritative preparation state without interim README carriage. Historical objective closure and preliminary review remain true only for their exact predecessor bytes. This corrective Draft does not self-declare corrective objective closure, author-review completion, Proposed standing, or Normative authority.

Present:

- full controlled metadata and ownership boundary;
- common semantic-record contract;
- repository/revision/change-set identity;
- workspace/package/dependency/project model;
- artifact/generation/build/source-map model;
- TypeScript AST, symbol, type, and signature core;
- graph, test, coverage, runtime, fact, evidence, finding-reference, and query-reference models;
- 127-object and 137-relationship catalogs with explicit complete semantic-profile mappings;
- epistemic dimensions, lifecycle, invalidation, and fourteen cross-graph invariants;
- 553-row independently dispositionable stable candidate requirement catalog comprising 119 retained prior IDs below 131 and 434 continuous, non-reused new IDs from `CSAA-002-REQ-131` through `CSAA-002-REQ-564`, with later verification allocations;
- open-fork safe defaults.

At this `0.3.1` corrective authoring state, which is not an exact review freeze or Proposed-candidate freeze, the following work remains before Proposed. Later exact closure and reconciliation records control live completion state without retroactively rewriting preserved predecessor evidence:

- preserve `JAN-CSAA-005-EVIDENCE-004@0.1.0` as historical evidence only, use `JAN-CSAA-005-EVIDENCE-007@0.1.0` only as the dated OBS-035/036 baseline, and use `JAN-CSAA-005-EVIDENCE-008@0.1.0` only as the intermediate documentation-authoring control;
- perform the consolidated implementation refresh required before exact-corpus freeze; no dated evidence record is silently upgraded to continuously current repository evidence;
- complete corrective objective verification against the exact `0.3.1` Draft and its OPEN successor ledger, close that named objective commission, and preserve all later-lifecycle and later-execution allocations as explicit nonpasses;
- complete affected cross-package reconciliation against the exact corrective identities;
- complete a separately recorded corrective author self-review against the reconciled closed ledger and all eighteen `JAN-CSAA-000` adversarial questions, closing `JAN-CSAA-002-SR-001` only if question 3 and every other required judgment pass without a blocker or major finding; and
- freeze the exact candidate version and digest and record the transition to Proposed only after those predicates are satisfied.

After Proposed and before final-corpus inclusion:

- a distinct adversarial reviewer reviews the exact Proposed bytes;
- a distinct integrity/provenance validator validates exact identity, evidence continuity, and role separation;
- every candidate-byte change after the review freeze receives affected re-review unless it satisfies the exact `REG-D-022` pre-frozen substitution exception; and
- the reviewed candidate, unresolved findings, strongest opposing case, consequences, and individual member/material-fork response fields are assembled into the one final exact-corpus package.

Documentation-subphase completion does not satisfy any full executable Wave 2, Wave 3, or Wave 4 exit. No intermediate sponsor package is required or solicited.

---

## 22. Closing semantic rule

A CSAA graph is trustworthy only to the extent that every fact can answer: which subject, which configuration, which producer and method, which raw evidence, which coverage, which epistemic basis, which time, and which invalidation boundary. A provider that cannot preserve those answers may supply a bounded observation; it cannot redefine the model to hide their absence.
