# Analysis Enrichment, Query, and Change-Impact Specification

## Provider-neutral capability profiles, unknown-aware queries, semantic comparison, slicing, and bounded impact reasoning

**Document ID:** `JAN-CSAA-003`

**Canonical title:** Analysis Enrichment, Query, and Change-Impact Specification

**Version:** `0.1.1`

**Status:** Draft

**Settledness:** HYPOTHESIS

**Classification:** Correction-only controlled-CSAA member candidate; non-authoritative Draft. This `0.1.1` successor corrects the exact predecessor lifecycle presentation and capability-vector delimiter grammar without inheriting the predecessor objective PASS or claiming a completed author review. `JAN-CSAA-000@0.3.0` remains the adopted authority and manifest baseline; later working-status records carry construction state. No intermediate sponsor response, repository change, provider result, objective record, or authoring assertion promotes this member

**Governing status:** Documentation-only Wave 2 entry is recorded by `JAN-CSAA-W1-SEMANTIC-READINESS-001@0.1.0` under `JPWB-REG-005 REG-D-021` as corrected by `REG-D-022`; this document has no member authority

**Role:** Provider-neutral semantic specification for extracting, enriching, querying, slicing, comparing, and estimating the possible impact of changes over exact code-analysis subjects

**Authority:** None. `REG-D-021` and `REG-D-022` authorize documentation-only preparation, objective verification, Draft-to-Proposed promotion after its gates pass, and later independent review and validation. Only an individual exact-member `JPWB-REG-005` conferral in the final itemized corpus transaction can make a revision Normative

**Scope:** Analysis Capability Profile meaning; capability composition and coverage; parsing, resolution, typing, dependency, call, control-flow, data-flow, taint, graph-composition, framework, test, coverage, runtime-correlation, enrichment, inference, query, slicing, semantic-delta, and change-impact semantics; logical invalidation; result provenance; partiality and failure meaning

**Applicability:** Exact TypeScript, JavaScript, and TypeScript-bearing Svelte subjects permitted by `JAN-CSAA-000`, analyzed through semantic subjects and graph families defined by `JAN-CSAA-002`

**Governs:** While Draft, nothing with program authority. Candidate concern allocation: provider-independent analysis-capability, query, slice, semantic-delta, and change-impact meaning

**Does not govern:** Code-semantic object or graph identity; logical system topology; Analysis Rule Profiles; findings, severity, suppression, exceptions, or gates; current repository facts; exact schemas, APIs, field names, query syntax, enum spellings, or error envelopes; fixture judgments; executable conformance; physical persistence or scheduling; coding-agent employment; concrete provider qualification or selection; implementation permission

**Effective adopted and canonical authorities:** `JAN-CSAA-000@0.3.0`, `JPWB-CON-000@1.3.0`, `JPWB-DOC-001@1.1.0`, `JPWB-DOC-002@1.2.0`, `JPWB-DOC-003@1.3.0`, `JPWB-DOC-004@1.3.0`, and `JPWB-REG-005@1.0.0 REG-D-021` and `REG-D-022`, each only for its owned concern

**Exact provisional non-authoritative inputs:** `JAN-CSAA-001@0.3.1 / Draft`, `JAN-CSAA-002@0.3.1 / Draft`, and `JAN-CSAA-005@0.3.1 / Draft`. These correction-peer inputs supply candidate architecture, semantic-identity, and dated repository-description material only. Their version-only binding carries no peer digest and confers no authority; later affected reconciliation SHALL reverse-bind the exact hashes without circularity, and any change to an exact bound input triggers affected source reconciliation and review

**Precedence and conflict routing:** Canon retains professional-semantic authority and `JAN-CSAA-000` retains program scope. Under the adopted program concern allocation, `JAN-CSAA-001` owns logical architecture, `JAN-CSAA-002` owns code-semantic identity, `JAN-CSAA-004@0.1.1 / Draft` supplies candidate, non-authoritative concern ownership for rule, finding, provider-qualification, and gate meaning, and `JAN-CSAA-005` owns revision-bound repository description. The existence or use of that `JAN-CSAA-004` Draft confers no rule, finding, provider, qualification, gate, enforcement, or Decision authority; the detailed semantics of each Draft member become authoritative only after its individual exact-member conferral. Apparent conflicts SHALL be recorded and routed to the concern owner under `JPWB-DOC-004`; this Draft SHALL NOT resolve them by convenience

**Requirement ledger:** [JAN-CSAA-003 Requirement Ledger](<records/JAN-CSAA-003 - Requirement Ledger.md>)

**Verification owner:** The author/integrator owns requirement extraction, objective verification, ledger closure, and author self-review. A distinct adversarial reviewer owns Proposed-candidate semantic review. A distinct integrity/provenance validator owns exact-identity and evidence-continuity validation. The final decision authority and ministerial recorder are distinct from those roles and from each other

**Change authority and procedure:** Authors MAY revise this Draft under `REG-D-021` and `REG-D-022`. Advancement to Proposed requires complete source reconciliation, closed requirement ledger, completed author self-review, resolved blocking findings, and an exact candidate freeze. Every candidate-byte change after review freeze triggers affected re-review except a pre-frozen administrative substitution set that enumerates exact operations and source/result identities, changes no judgment or semantics, and is independently replayed and validated

**Review and evidence companions:** [Wave 2 Entry Record](<records/JAN-CSAA-W1 - Documentation Semantic Readiness and Wave 2 Entry Record.md>); historical [JAN-CSAA-003-VERIFICATION-001@0.1.2](<records/JAN-CSAA-003 - Objective Author Verification Record.md>), [Wave 2 objective reconciliation](<records/JAN-CSAA-W2 - Wave 2 Cross-Package Objective Reconciliation Record.md>), [Wave 2 synchronized closure](<records/JAN-CSAA-W2 - Synchronized Ledger Closure and Integrity Record.md>), and [Working Corpus Authoring Status 008](<records/JAN-CSAA - Working Corpus Authoring Status 008.md>) bind the exact `0.1.0` post-objective-closure and author-self-review-entry chronology; Status 008 is `JAN-CSAA-WORKING-STATUS-001@0.8.0`, 12,120 bytes, SHA-256 `9187787def76cfdb0c2c9942405610d2fb35d89df3c9ff14584a8092dcb5cfef`, and remains historical; [preliminary author self-review](<records/JAN-CSAA-003 - Author Self Review.md>) records `JAN-CSAA-003-SR-001 / MAJOR` and `JAN-CSAA-003-SR-002 / MINOR` and remains a nonpass; dated [JAN-CSAA-005-EVIDENCE-007@0.1.0](<records/JAN-CSAA-005 - Current Subject Rebinding Record 004.md>) and intermediate-control [JAN-CSAA-005-EVIDENCE-008@0.1.0](<records/JAN-CSAA-005 - Non-Blocking External Drift and Authoring Baseline Record.md>) supply no continuously current implementation claim; corrective objective verification, affected cross-package reconciliation, the final consolidated implementation refresh, completed author self-review, exact freeze, Proposed review, and integrity validation remain later acts

**Affected authority-readiness input:** [JAN-CSAA-W4-AUTHORITY-READINESS-INPUT-DRIFT-RECONCILIATION-002@0.1.0](<records/JAN-CSAA-W4 - Affected Authority Readiness Input Drift Reconciliation Record 002.md>), prospective stable target; generation consumed the exact off-path candidate `.codex_tmp_JAN-CSAA-W4-AUTHORITY-READINESS-INPUT-DRIFT-RECONCILIATION-002@0.1.0.section-hardened.candidate.md` at 16087 bytes; SHA-256 `2478ffc8e6971e2c82c9a1ca455142b672fb5edb60335599907544e6eea4c83c`; generation branch `SECOND_KNOWN_POST_W3_EXTERNAL_DRIFT_BOUNDED_FOR_CSAA_AUTHORITY`. The generating guard exact-bound `JPWB-REG-005` at 140469 bytes and SHA-256 `f19d1e22161a05a42cb55c195b8dbb507b0dda4f4f0fe4eacf334165fa97042e`, all twelve `W4-ADR2-P-001..W4-ADR2-P-012` predicates, and the exact D021 7547/`53652662928e744e131be3fbaa03ff5304288df71208c02d5748775f59db8c4a`, D022 4773/`6e7dfd670c43ad72a0a4a4830f786c020a985924463dceed6c09ff0ae73b416f`, and D023 3911/`dd0b116881a9cd35c18ed9c34ef24fe84490af0d079e5ddc7e3f2daa9f407f00` section identities. This non-authoritative evidence preserves only bounded CSAA standing-authority continuity; it does not perform affected cross-package reconciliation, refresh corpus semantics, close a finding, promote this Draft, or confer authority.

**Publication-time numbered-successor continuation:** A later numbered authority-readiness successor may continue this publication-time binding only when both the publisher and an independent validator exact-bind that successor, the then-current whole-register byte count and SHA-256, these same exact D021/D022/D023 section byte counts and SHA-256 digests, and all twelve W4-ADR2 predicates, while proving that the successor has no generated-content, requirement-population, arithmetic, correction-objective, ledger-transition, lifecycle, or assurance-conclusion effect; every other later register identity or failed predicate SHALL block publication.

**Companion enforced artifacts:** None created or selected by this Draft

**Conformance-test references:** Documentation-only fixture and conformance members `JAN-CSAA-006` and `JAN-CSAA-008` are commissioned but not yet authoritative. Executable fixtures, oracle judgments, schemas, tests, provider qualification, and results remain unperformed and separately unauthorized

**Repository-evidence boundary:** Repository observations cited by predecessor records are dated evidence only. No statement in this Draft asserts continuously current implementation coverage. One consolidated implementation-subject refresh remains mandatory before final corpus freeze

**Audience:** Coding-agent designers, TypeScript engineers, software architects, assurance engineers, security reviewers, analyzer integrators, implementers, and maintainers

**Background:** [JAN-CSAA-000](<README.md>); [JAN-CSAA-001](<JAN-CSAA-001 - Codebase Semantic Analysis and Assurance Architecture.md>); [JAN-CSAA-002](<JAN-CSAA-002 - TypeScript Semantic Model and Invariant Catalog.md>); [JAN-CSAA-005](<JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md>)

**Structural exemplars:** [RPH document-set README](<../Recursive Professional Harness/README.md>); [RPH assurance-policy catalog](<../Recursive Professional Harness/Janumi Professional Workbench Product Realization PWA - Assurance Policy Catalog and Validator Contract.md>); [RPH executable invariant specification](<../Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Executable Invariant and Conformance Test Specification.md>)

**Supersedes:** `JAN-CSAA-003@0.1.0 / Draft`; 169,676 bytes; SHA-256 `65b3a9379dd47a25de1693ed709eafd11f7a9063db1cfd80b5da2bba01b46d10`; immutable archive preservation is a publication predicate and is not claimed by this off-path candidate

**Superseded by:** None

**Normative keywords:** SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY. Their meanings and the non-normative treatment of examples are inherited from `JAN-CSAA-000@0.3.0` §5

---

## 1. Purpose

This Draft answers one bounded question:

> How shall an exact code subject be converted into inspectable semantic analyses, queries, slices, comparisons, and change-impact candidates without turning absence into knowledge, inference into fact, or analysis into authority?

The specification defines meanings independent of a parser library, compiler wrapper, graph engine, query language, database, daemon, or analyzer portfolio. It is intentionally silent about executable shapes and concrete provider selection.

The outputs governed here support design, planning, implementation, verification, and validation. They are technical analysis records. They do not approve a change, establish a professional baseline, waive a violation, or authorize source mutation.

---

## 2. Concern ownership and boundary

| Concern | Owner | Treatment here |
| --- | --- | --- |
| Program scope and commissions | `JAN-CSAA-000` | Inherited |
| Logical responsibilities, flows, trust boundaries, publication | `JAN-CSAA-001` | Used as architecture boundary |
| Semantic subjects, objects, relations, graph families, epistemic states | `JAN-CSAA-002` | Used without redefinition |
| Analysis capabilities, queries, slices, deltas, change impact | `JAN-CSAA-003` candidate | Defined here |
| Rules, findings, severity, exceptions, provider contract, gates | `JAN-CSAA-004` | Explicitly ceded |
| Current repository inventory | `JAN-CSAA-005` | Dated examples only |
| Fixture cases and oracle judgments | `JAN-CSAA-006` | Verification allocation only |
| Exact contracts, schemas, API, query syntax | `JAN-CSAA-007` | Machine-contract allocation only |
| Executable conformance | `JAN-CSAA-008` | Verification allocation only |
| Persistence, scheduling, recomputation, recovery, authorization | `JAN-CSAA-009` | Operational allocation only |
| Coding-agent employment | `JAN-CSAA-010` | Consumer allocation only |
| Provider qualification and selection | `JAN-CSAA-011` | Qualification allocation only |

A query match, inferred architecture boundary, taint path, slice member, semantic delta, impact candidate, or possible dead-code candidate SHALL NOT be represented as canonical Evidence, an Analyzer Finding Record, a gate result, a Decision, a waiver, or authority.

This document defines semantic contracts, not serialized shapes. Any illustrative field name or table column is explanatory and SHALL NOT be treated as repository shape authority.

---

## 3. Foundational rules and non-equivalences

The following distinctions are load-bearing:

```text
Analysis result                  != authoritative semantic state
Successful execution            != assurance
Provider capability             != provider qualification
Query match                     != Analyzer Finding Record
Finding                         != Decision
No observed edge                != supported absence
Zero observed static callers    != dead code
Unchanged semantic graph        != preserved intended behavior
Runtime observation             != exhaustive runtime possibility
High confidence                 != certainty
Incremental completion          != full-analysis equivalence
Textual diff                    != semantic delta
Possible impact                 != required remediation
```

Every analysis is bound to an exact subject and a declared capability basis. If the subject, basis, population, or capability state is not known, the conclusion is not silently widened.

The default semantic stance is open-world. A closed-world conclusion is permitted only for a precisely declared population whose relevant coverage is demonstrably complete under the stated method.

An inference retains the facts and method from which it was derived, the assumptions it used, its confidence meaning, and the conditions under which it becomes invalid. A scalar confidence without an inspectable basis is prohibited.

---

## 4. Analysis Capability Profile

### 4.1 Purpose

An **Analysis Capability Profile** is the versioned provider-neutral semantic contract for one class of analysis. It states what a conforming invocation attempts to establish, over which subjects and constructs, from which inputs, with which outputs, limits, provenance, failure behavior, invalidation dependencies, and independently owned conformance oracle.

A profile describes meaning. A provider declares how much of that meaning it implements under `JAN-CSAA-004`; `JAN-CSAA-011` later qualifies concrete implementations. A provider SHALL NOT weaken or redefine a profile by emitting a smaller output.

### 4.2 Required facets

Every profile SHALL carry each of the following facets or an explicit, justified `not applicable` treatment:

| Facet | Required meaning |
| --- | --- |
| Stable identity | Permanent capability-profile identifier |
| Version and lifecycle | Exact semantic version, status, predecessor, and successor relation |
| Source obligations | Governing and inherited requirement links |
| Purpose | Question answered and protected engineering decision |
| Capability class | Static lane, execution-evidence lane, or explicit correlation |
| Subject perimeter | Included languages, artifacts, project variants, and exclusions |
| Construct coverage | Supported syntax, semantics, framework conventions, and contexts |
| Inputs | Required semantic subjects, facts, graphs, configurations, and evidence |
| Output objects | Produced provider-independent records |
| Output relations | Produced edge and relationship families |
| Dependencies | Required predecessor capabilities and compatibility conditions |
| Soundness objective | Meaning and boundary of supported positive results |
| Completeness objective | Meaning and boundary of supported negative or population-wide results |
| Coverage basis | Population, denominator, dimensions, and closure conditions |
| False-positive classes | Known ways supported positives may be wrong |
| False-negative classes | Known ways relevant results may be missed |
| Unsupported behavior | Constructs or contexts for which no conclusion is made |
| Inference treatment | Confirmed, inferred, candidate, observed, conflicting, and unknown distinctions |
| Confidence treatment | Basis, calibration, granularity, and prohibited interpretations |
| Invalidation dependencies | Logical changes that make the result stale |
| Provenance | Exact run, invocation, method, input, and raw-result lineage |
| Failure behavior | Failure classes and partial-publication consequences |
| Explanation | Minimum path, witness, or derivation needed to inspect a result |
| Resource behavior | Budget, timeout, cancellation, truncation, and deterministic-order treatment |
| Information controls | Access, confidentiality, redaction, and retention meanings |
| Composition | Permitted dependencies and semantic-loss disclosures |
| Oracle allocation | Independently owned fixture and conformance judgment reference |
| Authority limit | Explicit prohibition on approval, mutation, waiver, or false currentness |

A blank facet is not a safe default. Unknown, unsupported, and not applicable are different states and SHALL remain distinguishable.

### 4.3 Capability composition

A composite capability SHALL expose every contributing profile and version, dependency, subject, coverage result, failure, unsupported region, and semantic transformation. It SHALL NOT report a composite success if a required component failed, was stale, or was not run.

Composition MAY enrich a result. It SHALL NOT erase a contributing layer's identity, collapse conflicting results, or convert an unresolved seam into an absent edge.

When two providers or profile versions use incompatible meanings, the outputs are incomparable unless an explicit compatibility mapping exists. A display-level normalization is not semantic compatibility.

Every profile dependency SHALL be typed as either a **required predecessor** or an **optional prior-result enrichment**. Required predecessors participate in the profile's support and completeness predicates. Optional prior-result enrichments MAY add corroboration, conflict, observed material, mapping detail, or a separately labeled interpretation, but their absence SHALL NOT make the base profile fail and their presence SHALL NOT repair an unmet required predecessor.

The required-predecessor graph for one Analysis Invocation SHALL be acyclic. An optional prior-result enrichment may consume only an already completed, immutable result from an earlier invocation or from an earlier position in an explicitly acyclic invocation plan. Reciprocal same-invocation dependency, recursive partial publication, and an implicit fixed-point interpretation are prohibited. A future profile that needs fixed-point composition SHALL define its seed state, monotonicity rule, convergence predicate, iteration bound, non-convergence result, unresolved frontier, and completeness prohibition explicitly before use.

---

## 5. Required capability catalog

The following profile identities are stable candidate semantic identities. Exact machine encodings are deferred to `JAN-CSAA-007`.

### 5.1 Compiler-semantic and graph capabilities

| Profile | Capability | Supported subject and inputs | Produced facts or relations | Soundness, completeness, and critical limit |
| --- | --- | --- | --- | --- |
| `JAN-CSAA-CAP-001` | Parsing and AST extraction | Included source artifacts under an exact language mode and project context | Syntax units, nodes, spans, parent/child relations, parse diagnostics | Complete only for declared artifacts that parsed under the exact mode; a parse failure remains an affected unknown region |
| `JAN-CSAA-CAP-002` | Symbol and reference resolution | Parsed programs plus exact compiler, project, module, and ambient contexts | Declarations, symbols, scopes, references, binding candidates, unresolved references | Textual name equality never substitutes for binding; ambiguity and unresolved references remain visible |
| `JAN-CSAA-CAP-003` | Type analysis | Resolved program and exact checker/project variant | Types, signatures, substitutions, assignability observations, type relations | Checker- and context-bound; display strings are not identities and an error type is not supported absence |
| `JAN-CSAA-CAP-004` | Dependency analysis | Manifests, resolution contexts, source imports, configuration, optional runtime observations | Declared, resolved, imported, generated, inferred-runtime, and observed-runtime dependency relations | Dependency kinds remain distinct; lexical import presence alone is not a compiler-resolved dependency |
| `JAN-CSAA-CAP-005` | Call-graph construction | Symbols, types, callable declarations, dispatch model, optional runtime calls | Confirmed, candidate, inferred, observed, and unresolved-dynamic call relations | Dynamic dispatch, reflection, callbacks, registries, and framework entry remain explicit frontiers |
| `JAN-CSAA-CAP-006` | Control-flow construction | Callable bodies and control semantics | Blocks, branches, merges, exits, exceptional and asynchronous control relations | Unsupported exception, async, generator, cancellation, and framework control semantics remain unknown |
| `JAN-CSAA-CAP-007` | Data-flow analysis | Control flow, symbols, aliases, memory model, declared sensitivity | Definitions, uses, reaching values, aliases, def-use and flow paths | Bounded value flow is not complete information flow; sensitivity and heap limits are explicit |
| `JAN-CSAA-CAP-008` | Taint analysis | Data flow plus externally owned source, sink, sanitizer, and propagation rules | Taint paths, sanitization observations, unresolved propagation frontier | This profile owns propagation semantics only; rule meaning, severity, and disposition belong to `JAN-CSAA-004` |
| `JAN-CSAA-CAP-009` | Code-property-graph or graph composition | Compatible syntax, symbol, type, dependency, call, control-flow, and data-flow layers | Logical cross-layer view and typed cross-links | Composition preserves layer identity, provenance, coverage, conflict, and limitations; materialization is not required |

### 5.2 Resolution, generated-source, and framework capabilities

| Profile | Capability | Supported subject and inputs | Produced facts or relations | Soundness, completeness, and critical limit |
| --- | --- | --- | --- | --- |
| `JAN-CSAA-CAP-010` | Project-reference and variant resolution | Workspace/project references, exact configurations, build modes, generated contexts | Project graph, variant contexts, inclusion/exclusion and reference relations | Normal, build, test, generated, and consumer variants remain distinct |
| `JAN-CSAA-CAP-011` | Path-alias and module resolution | Importer, specifier, resolver version/configuration, path aliases, filesystem subject | Resolution attempts, targets, candidates, misses, conditions | Importer and resolver context are mandatory; an unresolved specifier is not an absent dependency |
| `JAN-CSAA-CAP-012` | Conditional-export resolution | Package exports/imports, consumer conditions, module mode, platform context | Chosen branch, candidate branches, excluded branches, unresolved condition state | A branch chosen under one condition set is not universal resolution |
| `JAN-CSAA-CAP-013` | Declaration-file and module-augmentation analysis | Authored/generated declarations, ambient contexts, augmentation and merge inputs | Declaration origins, merged symbols, augmentation relations, ambient effects | Ambient, authored, generated, merged, and augmented meanings remain distinguishable |
| `JAN-CSAA-CAP-014` | Source-map and source-origin correlation | Generated artifacts, maps, transformation chain, authored sources | Generated-to-authored locations, mapping health, ambiguity, broken-chain records | A broken, mismatched, or partial map prohibits silent attribution to authored source |
| `JAN-CSAA-CAP-015` | Decorator analysis | Decorator syntax, compiler mode, metadata settings, supported framework model | Decorator applications and bounded semantic interpretations | Syntax alone does not establish runtime or framework behavior |
| `JAN-CSAA-CAP-016` | JSX and TSX analysis | JSX/TSX syntax, transformation mode, runtime/framework context | Component/use candidates, transformed-origin and reference relations | Transformation and framework assumptions are explicit; tag spelling alone is not component identity |
| `JAN-CSAA-CAP-017` | Framework-generated TypeScript and virtual-source analysis | Authored component, adapter/version/configuration, generated/virtual output and mappings | Authored/generated identities, origin mappings, embedded-language semantic relations | Generated content never impersonates authored content; mapping gaps remain visible |
| `JAN-CSAA-CAP-023` | Generated-code handling | Generated artifacts, generator/input/configuration identity, maps | Generation lineage, classifications, source-origin and derived relations | Generated results carry generator and input lineage and cannot silently govern edits to authored source |
| `JAN-CSAA-CAP-024` | Framework modeling | Exact adapter/version, supported conventions, registrations, generated contexts | Framework entry, ownership, lifecycle, callback, injection, and route candidates | Adapter assumptions are bounded; unmodeled conventions remain unknown |
| `JAN-CSAA-CAP-025` | Reflection and dynamic-entry modeling | Registries, configuration, dynamic imports, events, decorators, external interfaces, runtime observations | Entry-point and target candidates, registration relations, unresolved dynamic seams | No static caller count is meaningful without this reachability surface |

### 5.3 Test, coverage, runtime, and enrichment capabilities

| Profile | Capability | Supported subject and inputs | Produced facts or relations | Soundness, completeness, and critical limit |
| --- | --- | --- | --- | --- |
| `JAN-CSAA-CAP-018` | Test discovery | Exact test configuration, project variant, source inventory, framework adapter | Configured and discovered tests, suites, hooks, selection candidates | Configured or discovered does not imply selected, executed, passed, or mapped |
| `JAN-CSAA-CAP-019` | Test-to-code mapping | Test identities plus static dependencies, coverage, and optional traces | Declared, static, coverage-observed, runtime-observed, and inferred mappings | Mapping kinds remain distinct; no one kind is complete by default |
| `JAN-CSAA-CAP-020` | Coverage ingestion | Exact build, instrumentation, test selection, denominator, report, map, time | Coverage observations at declared granularity and mapping health | Percentages without subject, denominator, selection, and mapping identity are uninterpretable |
| `JAN-CSAA-CAP-021` | Coverage comparison | Two compatible coverage evidence sets or explicit mapping | Added/lost/unchanged/incomparable coverage observations | Compatibility requires target mode, provider, denominator, granularity, selection, and mapping compatibility |
| `JAN-CSAA-CAP-022` | Runtime-trace correlation | Exact build, environment, workload, collector/schema, time, trace and source mapping | Runtime observations correlated to semantic objects and relations | A trace confirms only the observed workload; it does not prune unobserved static possibilities |
| `JAN-CSAA-CAP-026` | Architecture discovery | Declared graph families, clustering/dependency method, constraints and thresholds | Candidate boundaries, layers, responsibilities, coupling regions, alternatives | Output is a candidate technical interpretation, never recognized architecture or a violation |
| `JAN-CSAA-CAP-027` | Semantic enrichment | Source facts, declared transformation, compatible contexts | Derived facts and relations with dependency lineage | Every derived result retains its source facts, method, assumptions, and invalidation dependencies |
| `JAN-CSAA-CAP-028` | Bounded inference | Declared facts, model or heuristic, confidence basis and limits | Candidate or inferred facts and alternatives | Inference never impersonates compiler-confirmed or runtime-observed fact |

### 5.4 Query, slicing, comparison, and impact capabilities

| Profile | Capability | Supported subject and inputs | Produced facts or relations | Soundness, completeness, and critical limit |
| --- | --- | --- | --- | --- |
| `JAN-CSAA-CAP-029` | Semantic query | Exact snapshot, optional exact execution evidence, query definition, population, budgets | Snapshot-bound matches, supported non-matches, unknown/conflict/partial regions and explanation | Unknown, unsupported, stale, incomplete, failed, or excluded is never coerced to empty |
| `JAN-CSAA-CAP-030` | Code slicing | Exact graph snapshot, criterion, direction, edge families, sensitivity and bounds | Included members, witness paths, unresolved frontier, excluded/unsupported regions | Exclusion from a bounded slice is not proof of irrelevance, non-impact, deadness, or safe removal |
| `JAN-CSAA-CAP-031` | Change-impact analysis | Exact change seed, graph snapshot, propagation policy, optional dynamic evidence | Direct, transitive, possible, inferred, observed, unresolved, and bounded-negative impact records | Impact output is an explained candidate set, not safety, approval, severity, or remediation authority |
| `JAN-CSAA-CAP-032` | Before/after semantic and graph comparison | Two exact subjects plus profile/model/provider compatibility evidence | Added, removed, modified, moved, renamed, reclassified, conflicting, unknown, incomparable delta | Cross-revision matching is bounded lineage inference; empty delta is not behavior-preservation proof |

### 5.5 Complete Analysis Capability Profile registry

Sections 5.1 through 5.4 are a navigational summary. This section is the normative, complete profile registry. Every profile below binds every required §4.2 facet. A clause alias is an exact macro, not an invitation to substitute nearby prose. `+` means mandatory conjunction. A blank or omitted facet is prohibited. The audit subject is the fully expanded matrix of thirty-two profile records by twenty-eight facets, or 896 resolved cells.

#### 5.5.1 Facet keys and exact reusable clauses

| Key | Facet |
| --- | --- |
| `F01` | Permanent profile identity |
| `F02` | Version, lifecycle, predecessor, and successor |
| `F03` | Source binding |
| `F04` | Purpose and protected engineering question |
| `F05` | Static, execution-evidence, or correlation lane |
| `F06` | Subject perimeter and exclusions |
| `F07` | Supported constructs, contexts, and conventions |
| `F08` | Required inputs |
| `F09` | Produced object or record meanings |
| `F10` | Produced relation or edge meanings |
| `F11` | Required predecessor capabilities, optional prior-result enrichments, and compatibility |
| `F12` | Soundness objective and boundary |
| `F13` | Completeness objective and boundary |
| `F14` | Coverage population, dimensions, denominator, and closure |
| `F15` | Known false-positive classes |
| `F16` | Known false-negative classes |
| `F17` | Unsupported behavior |
| `F18` | Inference and epistemic treatment |
| `F19` | Confidence meaning and limits |
| `F20` | Logical invalidation dependencies |
| `F21` | Provenance |
| `F22` | Failure and partial-publication behavior |
| `F23` | Explanation or witness |
| `F24` | Resource, timeout, cancellation, truncation, and order behavior |
| `F25` | Access, confidentiality, redaction, and retention |
| `F26` | Composition and semantic-loss disclosure |
| `F27` | Independently owned oracle allocation |
| `F28` | Authority limit |

`ID001` through `ID032` resolve respectively and exactly to the unversioned permanent identities `JAN-CSAA-CAP-001` through `JAN-CSAA-CAP-032`. `CAP001` through `CAP032`, when used as cross-profile references, resolve to the same respective permanent identities. `F01` binds the permanent identity; it does not absorb version or lifecycle.

Within every `F11` cell, a bare capability reference, `source capabilities`, `queried profiles`, `contributing profiles`, or `named capabilities` means the exact materialized set of **required predecessors** for that Analysis Invocation unless the cell expressly says **optional prior-result enrichment**. Parameterized sets SHALL be enumerated in the invocation record before execution. `Optional`, `may consume`, or `already completed` means optional prior-result enrichment under §4.3. No `F08` or `F26` phrase may create an input dependency absent from `F11`: `feeds` names an outbound consumer only, and every actual consumed capability must be typed in `F11`. The materialized required-predecessor graph SHALL be acyclic and SHALL contain no self-reference.

`LIFE` means: `0.1.1 / Draft; predecessor JAN-CSAA-003@0.1.0 / Draft; successor none; semantic change requires a successor version; no profile authority exists before exact enclosing-member conferral`.

`PROV` means: exact static subject; exact dynamic-evidence subject or explicit not-applicable status for a static-only profile; profile version; Analysis Run and Analysis Invocation; provider, method, and configuration; inputs and raw-result references; project, resolver, build, framework, and runtime contexts; locations and mapping health; coverage and epistemic states; times, assumptions, limits, invalidation dependencies, and access treatment.

`FAIL` means: every §14 failure class remains distinct; invalid output is inert; bounded partial publication is permitted only with completed and missing regions and their consequences; failure never becomes an empty or green answer; a last-known-good result remains historical only.

`RES` means: declared CPU, memory, time, depth, and result budgets; timeout, cancellation, pagination, truncation, and deterministic order and tie-break behavior; resource pressure never silently changes the selected profile or its coverage claim.

`INFO` means: explicit access, confidentiality, redaction, and retention treatment; authorization is applied before traversal; neither count, path, shape, nor existence information may leak across the access boundary; redaction cannot fabricate completeness.

`AUTH` means: technical analysis only; no source, configuration, test, fixture, or oracle mutation; no approval, waiver, disposition, gate, conferral, or implementation-currentness effect; and no representation of the result as canonical Evidence, a finding, or a Decision.

`EP-S` means: compiler- or static-supported, candidate or inferred, unknown, and conflicting states remain distinct; observed is not applicable unless separately correlated.

`EP-X` means: execution-observed only for an exact run; absence of observation never becomes absence of behavior; inference remains separate.

`EP-C` means: static supported, candidate or inferred, and execution-observed states remain separate; correlation may corroborate, conflict with, or add to static material but never silently promote or prune it.

`CF-N` means: confidence is explicitly not applicable for deterministic or observed results; uncertainty is carried by epistemic and coverage state; a provider-native score remains raw and cannot substitute.

`CF-B` means: candidate or inferred states disclose method, reference or calibration population, granularity, and limits; an uncalibrated scalar is prohibited and confidence never means certainty.

`ORACLE(nnn)` means: the exact current `JAN-CSAA-006@0.1.1 / Draft` provisional fixture-judgment allocation for `JAN-CSAA-CAP-nnn`, currently `DOCUMENTED / NOT_CONFERRED / NOT_EXECUTED`, plus the exact `JAN-CSAA-008@0.2.2 / Draft` conformance specification, whose executable result remains `NOT_RUN`; authored specifications are not executed evidence, and the provider or implementation author does not own the judgment.

#### 5.5.2 Exact source-binding clauses

`SRC-BASE` means: `JAN-CSAA-000@0.3.0` requirements `CSAA-000-REQ-294` through `CSAA-000-REQ-304`; this document's `CSAA-003-REQ-063` through `CSAA-003-REQ-090`; and the exact applicable `JAN-CSAA-001@0.3.1`, `JAN-CSAA-002@0.3.1`, and canon rows identified for the profile in the `JAN-CSAA-003` requirement ledger. Effective source authorities retain their standing; `JAN-CSAA-001@0.3.1` and `JAN-CSAA-002@0.3.1` remain exact provisional, non-authoritative correction-peer inputs whose version-only binding carries no peer digest, whose later affected reconciliation reverse-binds exact hashes without circularity, and whose change triggers affected review.

| Alias | Exact additional source binding |
| --- | --- |
| `SRC001` | `SRC-BASE` + `CSAA-000-REQ-274` + `CSAA-003-REQ-091` |
| `SRC002` | `SRC-BASE` + `CSAA-000-REQ-275` + `CSAA-003-REQ-092` |
| `SRC003` | `SRC-BASE` + `CSAA-000-REQ-276` + `CSAA-003-REQ-093` |
| `SRC004` | `SRC-BASE` + `CSAA-000-REQ-277` + `CSAA-003-REQ-094` |
| `SRC005` | `SRC-BASE` + `CSAA-000-REQ-278` + `CSAA-003-REQ-095` |
| `SRC006` | `SRC-BASE` + `CSAA-000-REQ-279` + `CSAA-003-REQ-096` |
| `SRC007` | `SRC-BASE` + `CSAA-000-REQ-280` + `CSAA-003-REQ-097` |
| `SRC008` | `SRC-BASE` + `CSAA-000-REQ-280` + `CSAA-003-REQ-098` |
| `SRC009` | `SRC-BASE` + `CSAA-000-REQ-281` + `CSAA-003-REQ-099` |
| `SRC010` | `SRC-BASE` + `CSAA-000-REQ-282` + `CSAA-003-REQ-100` |
| `SRC011` | `SRC-BASE` + `CSAA-000-REQ-282` + `CSAA-003-REQ-101` |
| `SRC012` | `SRC-BASE` + `CSAA-000-REQ-282` + `CSAA-003-REQ-102` |
| `SRC013` | `SRC-BASE` + `CSAA-000-REQ-282` + `CSAA-000-REQ-286` + `CSAA-003-REQ-103` |
| `SRC014` | `SRC-BASE` + `CSAA-000-REQ-282` + `CSAA-003-REQ-104` |
| `SRC015` | `SRC-BASE` + `CSAA-000-REQ-282` + `CSAA-003-REQ-105` |
| `SRC016` | `SRC-BASE` + `CSAA-000-REQ-282` + `CSAA-003-REQ-106` |
| `SRC017` | `SRC-BASE` + `CSAA-000-REQ-282` + `CSAA-003-REQ-107` |
| `SRC018` | `SRC-BASE` + `CSAA-000-REQ-283` + `CSAA-003-REQ-108` |
| `SRC019` | `SRC-BASE` + `CSAA-000-REQ-283` + `CSAA-003-REQ-109` |
| `SRC020` | `SRC-BASE` + `CSAA-000-REQ-284` + `CSAA-003-REQ-110` |
| `SRC021` | `SRC-BASE` + `CSAA-000-REQ-284` + `CSAA-003-REQ-111` |
| `SRC022` | `SRC-BASE` + `CSAA-000-REQ-285` + `CSAA-003-REQ-112` |
| `SRC023` | `SRC-BASE` + `CSAA-000-REQ-286` + `CSAA-003-REQ-113` |
| `SRC024` | `SRC-BASE` + `CSAA-000-REQ-287` + `CSAA-003-REQ-114` |
| `SRC025` | `SRC-BASE` + `CSAA-000-REQ-287` + `CSAA-003-REQ-115` + `CSAA-003-REQ-203` through `CSAA-003-REQ-206` |
| `SRC026` | `SRC-BASE` + `CSAA-000-REQ-288` + `CSAA-003-REQ-116` |
| `SRC027` | `SRC-BASE` + `CSAA-000-REQ-289` + `CSAA-003-REQ-117` |
| `SRC028` | `SRC-BASE` + `CSAA-000-REQ-289` + `CSAA-003-REQ-118` |
| `SRC029` | `SRC-BASE` + `CSAA-000-REQ-290` + `CSAA-000-REQ-305` + `CSAA-003-REQ-119` + `CSAA-003-REQ-123` through `CSAA-003-REQ-154` |
| `SRC030` | `SRC-BASE` + `CSAA-000-REQ-291` + `CSAA-003-REQ-120` + `CSAA-003-REQ-155` through `CSAA-003-REQ-170` |
| `SRC031` | `SRC-BASE` + `CSAA-000-REQ-292` + `CSAA-003-REQ-121` + `CSAA-003-REQ-189` through `CSAA-003-REQ-210` |
| `SRC032` | `SRC-BASE` + `CSAA-000-REQ-293` + `CSAA-003-REQ-122` + `CSAA-003-REQ-171` through `CSAA-003-REQ-188` |

#### 5.5.3 Complete profile vectors

Each semicolon-delimited assignment below binds exactly one facet. An expanded vector SHALL resolve through §§5.5.1 and 5.5.2 without a blank, literal ellipsis, unresolved alias, or unjustified not-applicable value.

##### Compiler-semantic and graph profiles

**`JAN-CSAA-CAP-001` vector**

```text
F01=ID001; F02=LIFE; F03=SRC001; F04=parse exact declared artifacts into inspectable syntax without implying binding, type, or runtime meaning; F05=static; F06=exact TypeScript, JavaScript, or TypeScript-bearing generated or virtual artifacts in a declared project and language mode, excluding unmapped non-TypeScript embedded regions; F07=declared script kinds, grammar, tokens, nodes, trivia, recovery, and diagnostics;
F08=artifact bytes, digest, path, classification, language, compiler or parser mode, project, configuration, and generated context; F09=Program, Source File Context, AST Node, Expression, Statement, Source Location, and parse-diagnostic records; F10=ordered parent-child, containment, span, and origin relations; F11=exact subject identification only; F12=supported syntax records reproduce the exact parser tree, ranges, and diagnostics; F13=complete only for every declared artifact successfully read and parsed under the exact mode, with recovered and failed regions explicit; F14=denominator is the declared artifact-by-region population, with script-kind, project, and parse-health dimensions;
F15=wrong mode or classification, recovery or synthetic-node overclaim, stale bytes, and offset or encoding error; F16=unsupported or new syntax, unreadable, excluded, embedded, or generated regions, and early abort; F17=semantic binding, type, runtime behavior, and undeclared languages; F18=EP-S; F19=CF-N; F20=bytes, path, classification, parser, compiler, mode, project, or generated-context change; F21=PROV+content digest, parser, compiler, script kind, encoding, and recovery coordinates;
F22=FAIL+unreadable, encoding, unsupported-script, parse, or recovery failure; F23=node ancestry, exact range, and diagnostic or recovery witness; F24=RES; F25=INFO; F26=feeds CAP002, CAP003, and CAP006 and other syntax consumers while preserving parse gaps and artifact identity; F27=ORACLE(001); F28=AUTH.
```

**`JAN-CSAA-CAP-002` vector**

```text
F01=ID002; F02=LIFE; F03=SRC002; F04=resolve declarations, symbols, scopes, and references under exact compiler, project, module, and ambient context; F05=static; F06=successfully parsed declared programs and project variants, excluding runtime-only lookup; F07=value, type, and namespace scopes, aliases, merges, imports, exports, ambient and module augmentation, and unresolved bindings;
F08=CAP001 outputs and exact project, compiler, checker, module, resolver, ambient, and declaration contexts; F09=Declaration, Symbol, Reference, Scope, and unresolved-descriptor records; F10=declares, binds, references, aliases, merges, contains, candidate-binding, and unresolved-binding relations; F11=required predecessors CAP001, CAP010, CAP011, and CAP012 where their contexts apply; an already completed CAP013 result is optional prior-result enrichment and never a binding prerequisite; F12=confirmed binding only from exact compiler resolution; candidate, ambiguous, and unresolved states are never promoted by name equality; F13=complete only for all declaration and reference sites in completely parsed and bound declared program contexts; F14=declaration, reference, and site population by namespace, project, variant, and bind health;
F15=wrong project or namespace, textual-name coincidence, alias or merge collapse, and stale ambient context; F16=dynamic property, reflection, eval, missing declarations or generated context, and unsupported binding constructs; F17=runtime-only registration or lookup and undeclared or failed regions; F18=EP-S; F19=CF-B; F20=source, program, project, compiler, resolver, module, ambient, declaration, or augmentation change; F21=PROV+reference site, declaration, symbol identities, namespace, scope, and resolution trace;
F22=FAIL+bind, ambient, module, alias, or augmentation failure; F23=reference-to-resolution-attempts-to-declaration or symbol witness; F24=RES; F25=INFO; F26=feeds type, call, and dependency analysis while preserving declaration, symbol, alias, and unresolved-candidate identities; F27=ORACLE(002); F28=AUTH.
```

**`JAN-CSAA-CAP-003` vector**

```text
F01=ID003; F02=LIFE; F03=SRC003; F04=establish checker-bound type, signature, substitution, and assignability meanings; F05=static; F06=exact healthy Program, project, and checker context, excluding runtime value behavior; F07=types, generics, constraints, unions, intersections, overloads, narrowing, and declared type relations supported by the exact checker;
F08=CAP001 and CAP002 outputs plus exact checker, compiler, project, options, libraries, and declarations; F09=Type, Signature, Overload Set, substitution, and type-diagnostic records; F10=type-of, assignable, extends, implements, instantiates, constrains, constituent, and selected-overload relations; F11=CAP001, CAP002, CAP010, and CAP013 as applicable; F12=a supported relation is the exact checker outcome in the named context; display strings, names, and error types are not identity or supported absence; F13=complete only for declared type sites the exact checker evaluated successfully; F14=type-site, signature, and relation population by project, checker, construct, and health;
F15=display-string identity, wrong instantiation, narrowing, project, or overload, and stale libraries or declarations; F16=error, any, or unknown propagation, checker bailout, unsupported conditional or mapped constructs, and generated or ambient gaps; F17=runtime behavior, external-contract satisfaction, and other compiler contexts; F18=EP-S; F19=CF-N; F20=source, project, compiler, options, libraries, declarations, resolver, or generated-context change; F21=PROV+Program, checker, type coordinates, instantiation, narrowing, and overload context;
F22=FAIL+checker, error-type, constraint, or overload-resolution failure; F23=checker-scoped operands, substitutions, and selected-overload evidence; F24=RES; F25=INFO; F26=feeds call, data-flow, and control analyses while preserving type identity distinct from display and error state; F27=ORACLE(003); F28=AUTH.
```

**`JAN-CSAA-CAP-004` vector**

```text
F01=ID004; F02=LIFE; F03=SRC004; F04=identify declared, resolved, imported, generated, inferred-runtime, and observed-runtime dependencies without collapsing kinds; F05=static or explicit correlation when runtime evidence binds; F06=exact packages, manifests, import sites, resolution, configuration, and generated contexts plus an optional exact execution set; F07=manifest, import, export, workspace, generated, dynamic, and observed-load kinds declared by the profile;
F08=manifests, lockfiles, CAP002, CAP010, CAP011, CAP012, CAP013, and CAP023 outputs, configuration, and optional CAP022 observations; F09=Dependency Declaration, Resolved Dependency, External Component, and dependency-observation records; F10=declares, resolves, imports, depends-on, generated-dependency, inferred-load, and observed-load relations; F11=CAP002, CAP010, CAP011, CAP012, CAP013, and CAP023, plus CAP022 only when the observed lane participates; F12=each positive retains exact dependency kind and evidence; lexical import or manifest declaration never impersonates resolution or load; F13=complete only per named layer and population with all declared dynamic seams closed; F14=manifest declarations, import sites, projects, conditions, generated inputs, and workloads per lane;
F15=unresolved lexical import treated as resolved, development, runtime, or type-only collapse, wrong condition or lockfile, and stale trace; F16=dynamic, plugin, configuration, dependency-injection, native, generated, or external loads outside declared mechanisms or workload; F17=undeclared resolver, loader, or runtime mechanisms and incompatible evidence; F18=EP-C; F19=CF-B; F20=source, manifest, lockfile, resolver, condition, configuration, generator, build, workload, or trace change; F21=PROV+requester, specifier, manifest entry, resolution trace, and load event;
F22=FAIL+malformed manifest, lock mismatch, unresolved import, or trace mismatch; F23=manifest or importer to resolution, or runtime-load witness, with dependency kind; F24=RES; F25=INFO; F26=preserves every dependency lane and kind; runtime may add or corroborate but not rewrite static relations; F27=ORACLE(004); F28=AUTH.
```

**`JAN-CSAA-CAP-005` vector**

```text
F01=ID005; F02=LIFE; F03=SRC005; F04=construct bounded call relations with dynamic frontiers visible; F05=static or explicit correlation with exact runtime calls; F06=exact callables, call sites, program, dispatch model, and optional evidence, excluding undeclared entry mechanisms; F07=direct, overload, virtual, interface, callback, async, framework, and reflection mechanisms declared by the profile;
F08=CAP001, CAP002, and CAP003 outputs, callable bodies, dispatch and entry models, and optional already completed CAP014, CAP015, CAP016, CAP017, CAP024, CAP025, or CAP022 results; F09=call-site, callable, target-candidate, and unresolved-frontier records; F10=confirmed, candidate, inferred, observed, and unresolved-dynamic call relations; F11=required predecessors CAP001, CAP002, CAP003, CAP010, CAP011, CAP012, and CAP013 where their contexts apply; CAP014, CAP015, CAP016, CAP017, CAP024, CAP025, and CAP022 are optional prior-result enrichments under §4.3 and never close a mechanism that was not independently covered; F12=confirmed static targets require exact binding and dispatch evidence and observed targets require exact-workload evidence; F13=complete only for the declared call-site population, dispatch policy, and every applicable entry mechanism; F14=call-site-by-dispatch-and-entry-mechanism population with per-mechanism coverage;
F15=imprecise points-to or type dispatch, stale framework or mapping assumptions, and path-infeasible candidates; F16=reflection, dynamic import, callback registry, external or native entry, generated or framework gaps; F17=eval, native mutation, and undeclared or unmodeled entry mechanisms; F18=EP-C; F19=CF-B; F20=source, symbol, type, project, dispatch, framework, entry, build, workload, or trace change; F21=PROV+call-site, target, dispatch context, and runtime-event coordinates;
F22=FAIL+unresolved or unsupported dispatch, mapping, or trace failure; F23=call-site through dispatch or registration to target witness and unresolved alternatives; F24=RES; F25=INFO; F26=static candidates and observations retain separate lanes; an observed target never prunes static possibilities; F27=ORACLE(005); F28=AUTH.
```

**`JAN-CSAA-CAP-006` vector**

```text
F01=ID006; F02=LIFE; F03=SRC006; F04=construct intraprocedural control semantics including declared exceptional and asynchronous paths; F05=static; F06=exact callable bodies under a declared language and control model; F07=branches, loops, merges, return, throw, catch, finally, await, generator, and cancellation constructs explicitly supported;
F08=CAP001, CAP002, and CAP003 callable and body facts plus exact compiler and control-desugaring context; F09=CFG Snapshot, Control-Flow Node, basic-block, entry, and exit records; F10=successor, true, false, merge, return, exception, async, and yield relations; F11=CAP001, CAP002, and CAP003 plus CAP017 for mapped virtual bodies where applicable; F12=each edge is valid in the declared abstract-control semantics; F13=complete only when every construct and exit path in each declared body is supported and evaluated; F14=callable-by-construct-by-normal, exceptional, and async exit population;
F15=incorrect desugaring, finally or exception overapproximation, and stale transform context; F16=unsupported async, generator, cancellation, framework, or native control; F17=interprocedural behavior and unmodeled control constructs; F18=EP-S; F19=CF-N; F20=body, compiler, language, transform, exception, or async-model change; F21=PROV+owning callable, body, block, node, source construct, and control-model coordinates;
F22=FAIL+unsupported construct, CFG-build, exception-modeling, or async-modeling failure; F23=edge or block path linked to the originating source construct and unsupported frontier; F24=RES; F25=INFO; F26=feeds data-flow and slicing while preserving exceptional and async unknowns; F27=ORACLE(006); F28=AUTH.
```

**`JAN-CSAA-CAP-007` vector**

```text
F01=ID007; F02=LIFE; F03=SRC007; F04=derive bounded definitions, uses, aliases, values, and flow paths under a declared sensitivity and memory model; F05=static; F06=exact supported Program and callable population and declared interprocedural and heap perimeter; F07=definition, use, alias, heap, and value-flow constructs plus flow, path, field, object, and context sensitivity dimensions;
F08=CAP002, CAP003, CAP005, and CAP006 outputs plus alias, memory, summary, and sensitivity policy; F09=Definition, Use, Abstract Value, Alias, and Flow Path records; F10=defines, uses, reaches, aliases, flows-to, and def-use relations; F11=CAP002, CAP003, CAP005, and CAP006; F12=an emitted may-path is valid in the declared abstraction, not proof of concrete execution; any must-result requires its own stronger declared basis; F13=complete only within exact sensitivity, heap, interprocedural summaries, and supported constructs; F14=definition, use, location, and call-context population across each declared sensitivity dimension;
F15=alias or heap overapproximation, infeasible paths, and summary imprecision; F16=dynamic, reflection, native, or framework effects, unsupported heap or implicit flow, and missing summaries; F17=whole-program concrete value behavior and undeclared sensitivities; F18=EP-S; F19=CF-B; F20=source, symbol, type, CFG, call graph, alias, memory, summary, or sensitivity change; F21=PROV+definition, use, value locations, path, context, summary, and sensitivity coordinates;
F22=FAIL+alias, summary, fixed-point, or path-budget failure; F23=ordered def-use and alias witness path with abstraction and sensitivity limits; F24=RES; F25=INFO; F26=feeds taint, query, and slice while preserving candidate nature, path frontier, and upstream provenance; F27=ORACLE(007); F28=AUTH.
```

**`JAN-CSAA-CAP-008` vector**

```text
F01=ID008; F02=LIFE; F03=SRC008; F04=propagate externally defined taint meaning without owning source, sink, sanitizer, or rule judgment; F05=static; F06=exact CAP007 flow subject plus an exact externally owned rule profile, excluding undeclared trust boundaries; F07=declared source, sink, sanitizer, propagator, sensitivity, and implicit-flow policy;
F08=CAP005, CAP006, and CAP007 outputs and exact JAN-CSAA-004-owned rule references; F09=Taint Source, Sink, Sanitizer, Propagation, and Path records; F10=taints, propagates-through, sanitized-by, reaches-sink, and unresolved-propagation relations; F11=CAP005, CAP006, and CAP007 plus an exact compatible external rule profile; F12=a path follows the declared abstract-propagation semantics; it is not exploitability, severity, or a finding; F13=complete only for a closed declared source, sink, and sanitizer population and a complete supported propagation model; F14=source-by-sink-by-propagation-and-sanitizer population with sensitivity and frontier dimensions;
F15=overtaint, path infeasibility, and context-insensitive sanitizer or alias interpretation; F16=missing rules, sources, sinks, framework or native propagation, implicit propagation, or unsupported heap behavior; F17=severity, disposition, gate meaning, and undeclared trust boundaries; F18=EP-S; F19=CF-B; F20=flow graph, rule, source, sink, sanitizer, summary, sensitivity, or context change; F21=PROV+external rule identity and version and full path coordinates;
F22=FAIL+missing or incompatible rule, prerequisite-flow failure, or propagation failure; F23=source through propagation or sanitizer to sink witness plus unresolved frontier; F24=RES; F25=INFO; F26=preserves rule-owner authority and cannot erase failed or unknown propagation; F27=ORACLE(008); F28=AUTH.
```

**`JAN-CSAA-CAP-009` vector**

```text
F01=ID009; F02=LIFE; F03=SRC009; F04=compose compatible semantic and graph layers into a logical cross-layer view without semantic collapse; F05=static, or explicit correlation if a named execution layer participates; F06=exact compatible selected snapshots, layers, and subject identities; F07=only named syntax, symbol, type, dependency, call, control-flow, data-flow, taint, and optional execution layers;
F08=selected CAP001, CAP002, CAP003, CAP004, CAP005, CAP006, CAP007, CAP008, and other named graph outputs plus compatibility mappings; F09=Logical Graph View, Layer, Composition, and Cross-link records; F10=typed layer-membership and cross-layer mapping relations; F11=every selected contributing profile and version plus explicit compatibility; F12=each cross-link has compatible exact endpoints and contributing-layer evidence; F13=complete only for named layers and their declared covered populations, never a universal code-property graph; F14=union of selected node and edge populations with layer-specific gaps and conflicts;
F15=identity conflation, lossy normalization, and cross-revision or cross-context mismatch; F16=omitted, failed, or incompatible layers and missing mappings; F17=undeclared layer semantics and forced composition of incompatible inputs; F18=EP-C when lanes are mixed, otherwise EP-S; F19=CF-N; F20=any subject, layer, profile, provider, mapping, or composition-policy change; F21=PROV+all contributing graph, profile, version, and compatibility coordinates;
F22=FAIL+required-layer failure, staleness, non-execution, incompatibility, or cross-link failure; F23=cross-link to endpoint, layer, and compatibility lineage; F24=RES; F25=INFO; F26=retains every contributing identity, provenance, coverage state, and conflict; no required-layer failure can become composite success; F27=ORACLE(009); F28=AUTH.
```

##### Resolution, generated-source, and framework profiles

**`JAN-CSAA-CAP-010` vector**

```text
F01=ID010; F02=LIFE; F03=SRC010; F04=resolve project references and distinct normal, build, test, generated, and consumer variants; F05=static; F06=exact declared workspace, project, and configuration closure, excluding undeclared build-system or runtime membership; F07=configuration extension, project references, file inclusion and exclusion, and supported variant modes;
F08=workspace and configuration artifacts, compiler and toolchain, filesystem snapshot, and declared build or variant purpose; F09=TypeScript Project, Project Variant, and Effective Configuration records; F10=references, includes, excludes, extends-config, and variant-of relations; F11=exact repository and workspace subject identification; F12=positive project or variant membership follows exact effective-configuration closure; F13=complete only for every declared root, reference, and configuration successfully resolved in the workspace perimeter; F14=configuration-root, reference, file-membership, and variant population plus resolution health;
F15=wrong configuration inheritance, root, casing, or mode, stale generated configuration, and path conflation; F16=custom build-tool membership, runtime-generated configurations, and inaccessible references; F17=actual build success and undeclared project systems; F18=EP-S; F19=CF-N; F20=configuration, workspace, filesystem, compiler, reference, build-mode, or generated-context change; F21=PROV+configuration extension and reference chain, effective options, and file set;
F22=FAIL+missing, cyclic, or invalid configuration or reference and inaccessible member; F23=root configuration through extension or reference to effective variant and file-set witness; F24=RES; F25=INFO; F26=provides exact context to resolution and semantic profiles without merging variants; F27=ORACLE(010); F28=AUTH.
```

**`JAN-CSAA-CAP-011` vector**

```text
F01=ID011; F02=LIFE; F03=SRC011; F04=resolve importer and specifier pairs under exact resolver, alias, filesystem, and package context; F05=static; F06=exact importer population and resolution environment, excluding undeclared custom or runtime loaders; F07=relative, bare, path-alias, package, file-extension, index, and declared resolver mechanisms;
F08=importer, specifier, CAP001 and CAP010 contexts, resolver identity and version, configuration, aliases, base paths, filesystem, and package metadata; F09=Module-Resolution Attempt, Target, Candidate, and Miss records; F10=resolves-to, candidate-target, excluded-target, and unresolved relations; F11=CAP001 and CAP010 plus CAP012 when conditional package maps participate; F12=a confirmed target is the exact resolver outcome for the named importer and context; F13=complete only for all declared requests and resolution branches under the exact environment; F14=importer-by-specifier-by-condition, platform, and mode attempt population;
F15=wrong importer, base, case, condition, or cache and textual-path assumption; F16=custom plugin, Plug'n'Play, loader, or runtime resolution and inaccessible filesystem candidates; F17=undeclared resolver and runtime-loader mechanisms; F18=EP-S; F19=CF-B; F20=importer, specifier, source, filesystem, package, resolver, alias, condition, or platform change; F21=PROV+ordered resolution attempts, candidates, conditions, and resolver identity;
F22=FAIL+invalid configuration, alias, package metadata, resolver crash, or unresolved request; F23=importer and specifier through ordered attempts and conditions to target or miss witness; F24=RES; F25=INFO; F26=preserves every attempt, candidate, and exact context; unresolved is not an absent dependency; F27=ORACLE(011); F28=AUTH.
```

**`JAN-CSAA-CAP-012` vector**

```text
F01=ID012; F02=LIFE; F03=SRC012; F04=evaluate conditional package export and import branches for an exact consumer condition set; F05=static; F06=exact package map and consumer mode, platform, and conditions, excluding undeclared loader conditions; F07=exports and imports maps, patterns, condition priority, default, and supported module modes;
F08=package metadata, consumer and importer context, condition set and order, module mode, and platform; F09=Conditional-Branch Decision, Candidate, Excluded, and Miss records; F10=selects-branch, candidate-branch, and excludes-branch relations; F11=CAP010 context and exact package metadata; F12=the selected branch is correct only for the named ordered condition set; F13=complete only for every applicable map branch and pattern under the exact consumer context; F14=package-entry-by-pattern-by-condition-branch population;
F15=wrong condition priority, mode, or platform, fallback or order error, and stale metadata; F16=custom or undocumented loader conditions and runtime mutation; F17=unknown conditions and custom loaders yield unresolved, never a universal target; F18=EP-S; F19=CF-N; F20=package map, version, condition, order, module mode, platform, or consumer change; F21=PROV+matched key and pattern, tested conditions and order, and selected or excluded branch;
F22=FAIL+invalid map, pattern, condition, or absence of a supported branch; F23=package request through pattern and condition-decision trace; F24=RES; F25=INFO; F26=feeds CAP011 while preserving branch and condition specificity; one selection is never universal resolution; F27=ORACLE(012); F28=AUTH.
```

**`JAN-CSAA-CAP-013` vector**

```text
F01=ID013; F02=LIFE; F03=SRC013; F04=analyze declaration artifacts, ambient context, symbol merging, and module augmentation with origins distinct; F05=static; F06=exact authored and generated declaration and consumer Program contexts, excluding runtime implementation; F07=ambient, global, and external-module declarations, namespace and interface merges, and module and global augmentation;
F08=CAP001, CAP010, CAP011, and CAP012 outputs, exact compiler binding observations, declaration artifacts, libraries, package context, project context, and optional already completed CAP023 lineage; F09=Declaration Artifact, Declaration, Symbol, Merge, Augmentation, and Ambient-Effect records; F10=declares, contributes-to, merges-with, augments, and applies-ambient-effect relations; F11=required predecessors CAP001, CAP010, CAP011, and CAP012; an already completed CAP023 result is optional prior-result enrichment and CAP002 is not a predecessor; F12=a confirmed merge or augmentation follows exact compiler declaration context and origin set; F13=complete only for every declaration input loaded into the exact Program and all supported merge and augmentation constructs; F14=declaration-artifact, declaration, symbol, and augmentation population by origin, project, and package;
F15=wrong namespace, context, order, or package version, collapsed duplicate declarations, and generated or authored origin confusion; F16=missing or dynamically loaded declarations, unsupported ambient side effects, and generated gaps; F17=runtime implementation, contract satisfaction, and declarations outside Program closure; F18=EP-S; F19=CF-N; F20=declaration, source, project, compiler, libraries, package, resolver, ambient, or generated-context change; F21=PROV+all declaration origins, consumer Program, and merge or augmentation trace;
F22=FAIL+missing, invalid, or incompatible declaration or merge and augmentation failure; F23=merged symbol to complete declaration-origin set and augmentation trace; F24=RES; F25=INFO; F26=feeds binding and type analysis while never collapsing authored, generated, ambient, merged, or augmented identities; F27=ORACLE(013); F28=AUTH.
```

**`JAN-CSAA-CAP-014` vector**

```text
F01=ID014; F02=LIFE; F03=SRC014; F04=correlate generated and emitted ranges to authored origins through an exact transformation chain; F05=static; F06=exact source and target artifacts, maps, build, and transformation chain, excluding unsupported exact attribution; F07=declared source-map formats, segments, chains, source-root semantics, and range mappings;
F08=authored, generated, and emitted artifacts, maps and digests, producer, build, generator and version, and chain context; F09=Source Map, Source Location, Mapping Health, and Origin Correlation records; F10=generated-to-authored, emitted-to-source, and range-map relations; F11=exact artifact and build identities; F12=exact authored attribution only from a matching map, artifact, segment, and chain; inferred or ambiguous mapping stays labeled; F13=complete only for all declared target regions and every required map-chain segment; F14=target-range-by-map-segment-by-chain population with mapping-health dimensions;
F15=stale or wrong map, build, source root, offset, or encoding and ambiguous chained mapping; F16=missing segments or maps, custom transformations or preprocessors, and excluded sources; F17=a broken, mismatched, or partial map cannot support exact authored attribution; F18=EP-S; F19=CF-B; F20=source, target, map, build, generator, transform, path, or encoding change; F21=PROV+source and target digests, map segments and ranges, producer, and full chain;
F22=FAIL+missing, malformed, mismatched, broken, or ambiguous map chain; F23=target range through map segments to source-range witness and health; F24=RES; F25=INFO; F26=feeds generated, framework, coverage, and trace profiles while preserving each transformation and ambiguity; F27=ORACLE(014); F28=AUTH.
```

**`JAN-CSAA-CAP-015` vector**

```text
F01=ID015; F02=LIFE; F03=SRC015; F04=separate decorator syntax and compiler metadata from bounded framework or runtime-effect candidates; F05=static; F06=exact decorator-enabled Program and compiler mode plus optional declared framework model, excluding unsupported runtime effects; F07=decorator occurrence, factory, application, evaluation-order, and metadata constructs under the declared compiler generation;
F08=CAP001, CAP002, and CAP003 outputs, compiler decorator and metadata options, bindings, and an optional declared framework adapter model that is not a CAP024 result; F09=Decorator Occurrence, Application, Metadata, and Effect-Candidate records; F10=decorates, invokes-factory, emits-metadata, and candidate-framework-effect relations; F11=required predecessors CAP001, CAP002, and CAP003; CAP024 is not a predecessor; F12=syntax, application, and compiler emission may be confirmed; runtime or framework effect remains candidate unless separately evidenced; F13=complete only for the supported decorator mode and constructs and declared adapter-convention population; F14=decorator-occurrence-by-factory, target, metadata, and adapter-rule population;
F15=syntax-as-effect, wrong compiler mode, order, or factory binding, and stale adapter assumption; F16=custom transforms, factory indirection, runtime mutation, and unsupported framework decorators; F17=unmodeled runtime or framework semantics; F18=EP-S; F19=CF-B; F20=source, binding, compiler, decorator mode, metadata, or framework-adapter change; F21=PROV+occurrence, target, factory binding, compiler emission, and adapter-rule coordinates;
F22=FAIL+unsupported mode, factory binding, metadata, or adapter-interpretation failure; F23=occurrence through factory and target to compiler metadata or candidate adapter-rule witness; F24=RES; F25=INFO; F26=preserves syntax, compiler emission, and candidate effect as separate meanings; F27=ORACLE(015); F28=AUTH.
```

**`JAN-CSAA-CAP-016` vector**

```text
F01=ID016; F02=LIFE; F03=SRC016; F04=analyze JSX and TSX syntax, symbol use, and transform or framework candidates without equating tag spelling to identity; F05=static; F06=exact JSX or TSX Program, transform, runtime, and framework context, excluding actual render behavior; F07=elements, fragments, attributes, spreads, components, factories, and automatic-runtime constructs declared supported;
F08=CAP001, CAP002, and CAP003 outputs, JSX compiler mode, import source, runtime, and an optional declared framework adapter model that is not a CAP024 result; F09=JSX Element, Component-Use, Transform-Origin, and Framework-Candidate records; F10=references-component, transforms-via, and candidate-renders-or-owns relations; F11=required predecessors CAP001, CAP002, and CAP003; CAP024 is not a predecessor; F12=compiler binding and transform may be confirmed; component or render meaning remains candidate unless an exact adapter establishes it; F13=complete only for all JSX and TSX constructs under supported transform, runtime, and framework context; F14=JSX-node-by-binding, transform, and adapter-rule population;
F15=capitalization or name heuristic, wrong factory, runtime, or import source, and spread or fragment misinterpretation; F16=dynamic component, factory, plugin, macro, and framework conventions and generated gaps; F17=actual rendering, lifecycle, and unmodeled framework behavior; F18=EP-S; F19=CF-B; F20=source, binding, type, JSX mode, runtime, import source, or framework-adapter change; F21=PROV+tag, node, symbol, transform, runtime, and adapter-rule coordinates;
F22=FAIL+unsupported JSX transform, binding, runtime, or adapter-interpretation failure; F23=JSX node through symbol and transform to candidate framework-meaning witness; F24=RES; F25=INFO; F26=preserves syntax, binding, transform, and candidate-runtime distinctions; F27=ORACLE(016); F28=AUTH.
```

**`JAN-CSAA-CAP-017` vector**

```text
F01=ID017; F02=LIFE; F03=SRC017; F04=map authored framework components to generated or virtual TypeScript without identity impersonation; F05=static; F06=exact authored, generated, virtual, project, and adapter context, excluding runtime behavior and unmapped authored attribution; F07=generated and virtual files, embedded regions, mappings, and compiler semantics under an exact adapter and version;
F08=authored, generated, and virtual artifacts, project variant, adapter, configuration, output, maps, CAP001, CAP002, CAP003, CAP010, CAP011, CAP012, CAP013, CAP014, CAP015, and CAP016; F09=Generated Framework Context, Generated Artifact, Virtual Artifact, Source File Context, Location, Semantic Fact, and Coverage records; F10=origin, embedded-semantic, mapping, and provenance relations; F11=CAP001, CAP002, CAP003, CAP010, CAP011, CAP012, CAP013, CAP014, CAP015, and CAP016, with CAP014 mandatory for authored attribution; F12=a positive origin or semantic relation requires exact identities and mapping evidence; otherwise it remains at generated grain; F13=complete only for a closed authored and generated inventory, fresh complete adapter outputs and maps, and successful parse, bind, and type analysis; F14=component-by-embedded-region-by-generated-or-virtual-artifact population with map, parse, bind, and type health;
F15=stale or wrong adapter, mismatched or ambiguous map, mixed variant, and syntax treated as framework meaning; F16=lazy or unmaterialized virtual output, unsupported embedded constructs or macros, and missing maps or configuration variants; F17=unknown adapter or version and absent or stale generated context; authored attribution is unsupported when map health is inadequate; F18=EP-S; F19=CF-B; F20=authored input, adapter, generator, configuration, output, map, compiler, project, or resolver change; F21=PROV+authored-to-generation-or-virtual-to-generated coordinates and map health;
F22=FAIL+adapter, generation, virtual-source, map, parse, bind, or type failure; F23=authored through generated or virtual artifact to semantic-fact chain with ranges and assumptions; F24=RES; F25=INFO; F26=uses only the required predecessors typed in F11 and never merges authored and generated identities; CAP023 generated-artifact classification and CAP024 framework modeling are downstream consumers, not inputs; F27=ORACLE(017); F28=AUTH.
```

##### Test, coverage, runtime, and enrichment profiles

**`JAN-CSAA-CAP-018` vector**

```text
F01=ID018; F02=LIFE; F03=SRC018; F04=identify configured and discovered suites, tests, cases, hooks, and selection candidates without implying selection, execution, or pass; F05=static; F06=exact test configuration, project, source inventory, and adapter, excluding runs, results, and coverage; F07=configuration patterns, declarations, hooks, and supported parameterization;
F08=static snapshot, test artifacts, configuration, target, project variant, adapter, and source, symbol, and module facts; F09=Test Suite, Test, Test Case, Test Target, discovery, hook, and candidate records, never Test Selection, Test Run, or Test Result; F10=source, configuration, containment, and discovery-candidate relations; F11=CAP001, CAP002, CAP003, CAP004, CAP010, CAP011, CAP012, CAP013, CAP014, CAP015, CAP016, and CAP017 as applicable; F12=a discovered positive requires exact configuration, supported adapter, and source witness; F13=complete only for a closed configuration and source inventory fully evaluated, never selected, executed, or passed completeness; F14=eligible test artifacts, declaration regions, and configuration roots by variant, framework, pattern, and parse health;
F15=helper mistaken for test, wrong configuration or variant, stale adapter, and duplicated parameter cases; F16=dynamic generation, plugins, runtime discovery, excluded roots, and unsupported syntax or macros; F17=unknown runner, adapter, or configuration semantics and runtime-only discovery; F18=EP-S; F19=CF-N; F20=configuration, inventory, source, project, adapter, or framework change; F21=PROV+configuration rule, source declaration, and test identity;
F22=FAIL+invalid configuration, adapter, discovery, or parse failure; F23=configuration rule through source declaration to test-identity witness and exclusions; F24=RES; F25=INFO; F26=feeds CAP019 while keeping configured, discovered, selected, executed, and passed distinct; F27=ORACLE(018); F28=AUTH.
```

**`JAN-CSAA-CAP-019` vector**

```text
F01=ID019; F02=LIFE; F03=SRC019; F04=relate exact tests to code while retaining declared, static, coverage-observed, runtime-observed, and inferred kinds; F05=explicit correlation; F06=exact test population, static snapshot, and named evidence sets, excluding correctness and relevance claims; F07=dependency, coverage, trace, and assertion-target mappings at declared grain;
F08=test identities, static graphs, coverage observations, traces, optional assertion outcomes, and maps; F09=Test-to-Code Mapping and Coverage records; F10=typed test-to-code relations with mapping kind and basis; F11=CAP004, CAP005, CAP014, CAP018, CAP020, and CAP022 as used, with subject, build, and map compatibility; F12=a positive mapping means only that its named basis supports the relation; mapping kinds never collapse; F13=negative or population completeness requires complete discovery and every declared mapping layer and population; F14=declared tests by eligible code targets and mapping kind, grain, build, and map;
F15=transitive-dependency overreach, shared setup, coarse coverage, bad map, and trace miscorrelation; F16=dynamic, reflection, and framework paths, uninstrumented code, missing traces or maps, and undiscovered tests; F17=incompatible subjects or evidence and unsupported mapping method; F18=EP-C; F19=CF-B; F20=test, configuration, static graph, build, selection, coverage, trace, map, or method change; F21=PROV+basis-specific test-to-path-to-code coordinates;
F22=FAIL+prerequisite, evidence, mapping incompatibility, or partiality; F23=test through basis-specific path to code witness with grain and limits; F24=RES; F25=INFO; F26=combines named mappings without collapsing kinds; F27=ORACLE(019); F28=AUTH.
```

**`JAN-CSAA-CAP-020` vector**

```text
F01=ID020; F02=LIFE; F03=SRC020; F04=ingest coverage as exact execution observations with denominator, granularity, and mapping health; F05=execution-evidence; F06=exact build, instrumentation, selection or workload, report, map, and time, excluding behavioral conclusions; F07=declared provider metrics, granularities, and transformed-source mappings;
F08=static and execution identities, Test Run or Runtime Execution, report, instrumentation, target build, selection, workload, denominator, and map; F09=Coverage Observation, Region, Denominator Basis, Measurement Granularity, and Coverage records; F10=covers, observed-in, and mapped-to relations; F11=CAP014 plus exact report, build, instrumentation, and provider compatibility; F12=a positive means the report observed the metric for the exact target and selection; authored attribution requires a valid map; F13=complete only when all report members and segments are ingested, the denominator is closed, and mapping is complete; F14=eligible regions by build, metric, grain, selection, workload, and map;
F15=wrong build or map, duplicate merge, counter-semantic mismatch, and generated content treated as authored; F16=missing shard or file, corrupt or truncated report, unsupported metric, and unmapped generated region; F17=unknown schema or missing target, instrumentation, or denominator; raw material may remain while correlation is unsupported; F18=EP-X with derived mapping state separate; F19=CF-N; F20=build, instrumentation, selection, workload, report, provider, denominator, grain, or map change; F21=PROV+raw counter, run, instrumentation, build, region, denominator, grain, and map;
F22=FAIL+missing, corrupt, truncated, or incompatible report or mapping; F23=observation through run, instrumentation, build, region, denominator, grain, and map chain; F24=RES; F25=INFO; F26=feeds comparison and mapping without implying test-execution quality or behavior; F27=ORACLE(020); F28=AUTH.
```

**`JAN-CSAA-CAP-021` vector**

```text
F01=ID021; F02=LIFE; F03=SRC021; F04=classify added, lost, unchanged, and incomparable coverage without forcing incompatible evidence; F05=execution-evidence comparison; F06=two exact coverage sets and declared compatibility, excluding behavior preservation; F07=metric, grain, denominator, selection, and mapping-compatible comparisons;
F08=two CAP020 outputs plus compatibility policy and evidence; F09=Coverage Comparison Observation and Semantic Comparison records; F10=paired coverage Change and History relations; F11=CAP020 and CAP014 with target, provider, denominator, grain, selection, and map compatibility; F12=a delta exists only for compatible paired regions; F13=complete only when both closed denominators are fully represented and every region is paired or explicitly incomparable; F14=union of both populations with matched, unmatched, and incomparable denominators;
F15=false compatibility, rounding or aggregation, and flaky or contextual changes mislabeled as delta; F16=partial reports, hidden incompatible or unmapped regions, and aggregation masking; F17=incompatible regions are incomparable, never a forced delta; F18=EP-X with lineage and delta inference explicit; F19=CF-N; F20=either evidence set or compatibility, denominator, grain, selection, or map change; F21=PROV+compatibility and paired-region and counter coordinates;
F22=FAIL+incomplete or incompatible evidence and pairing failure; F23=compatibility decision plus paired-region and counter witness; F24=RES; F25=INFO; F26=uses CAP020 and CAP014 and keeps incompatible regions visible; F27=ORACLE(021); F28=AUTH.
```

**`JAN-CSAA-CAP-022` vector**

```text
F01=ID022; F02=LIFE; F03=SRC022; F04=correlate trace events to semantic objects while proving only the observed workload; F05=explicit correlation; F06=exact build, environment, workload, collector, schema, time, and static and execution identities, excluding whole-program behavior; F07=supported event, span, load, and call families and source mapping;
F08=Runtime Execution, Trace, Span, Event, build, environment, workload, collector, schema, maps, and static graphs; F09=correlated runtime Semantic Facts, Graph Observations, and Coverage records; F10=observed-call, observed-load, observed-flow, observed-execution, and provenance relations; F11=CAP005 and CAP014 plus exact build, schema, collector, map, and static compatibility; F12=a positive proves occurrence under the exact workload and window only; F13=complete only for the declared captured event population and window with complete collection and mapping, never all possible behavior by default; F14=events, spans, processes, loads, calls, time, build, workload, schema, and map population;
F15=wrong build or map, clock or context misjoin, schema misread, and sampled-event overgeneralization; F16=dropped or sampled events, uninstrumented or native seams, and broken maps; F17=identity, schema, or collector incompatibility and unresolvable mapping; raw material remains separate; F18=EP-C; F19=CF-B; F20=build, environment, workload, collector, schema, trace, window, instrumentation, map, or static-graph change; F21=PROV+event, span, execution, build, environment, workload, runtime location, and map;
F22=FAIL+dropped, truncated, malformed, or incompatible trace and mapping failure; F23=event or span through execution, build, environment, workload, and map to semantic-object chain; F24=RES; F25=INFO; F26=may corroborate, add, or conflict but never prune static possibilities; F27=ORACLE(022); F28=AUTH.
```

**`JAN-CSAA-CAP-023` vector**

```text
F01=ID023; F02=LIFE; F03=SRC023; F04=classify generated code and preserve generator, input, configuration, and origin lineage without governing authored edits; F05=static; F06=materialized generated artifacts in an exact snapshot and project; virtual framework output belongs to CAP017; F07=generation, emission, bundling, source-origin, and mapping constructs;
F08=Generated Artifacts, generator and version, input, configuration, invocation, maps, and project context; F09=Generated Artifact, Source File Context, Location, Map, and lineage records; F10=generated-from, produced-by, maps-to, and origin relations; F11=CAP001, CAP002, CAP003, and CAP014 with exact generator, project, and map compatibility; F12=generated classification and lineage only from exact producer and input evidence; F13=complete only for a closed generated-output manifest plus every generator input, configuration, and map; F14=declared generated outputs and source regions by generator, project, and map health;
F15=authored or copied code mislabeled generated, stale output, and wrong generator or input; F16=out-of-tree, ignored, or runtime-generated output and missing manifest or map; F17=missing generator, input, or configuration prevents supported lineage; F18=EP-S; F19=CF-B; F20=generator, version, input, configuration, output, project, map, or classification change; F21=PROV+generator, input, and configuration through output to origin and map chain;
F22=FAIL+missing or mismatched generator, input, output, or map evidence; F23=complete generation and origin chain; F24=RES; F25=INFO; F26=uses CAP001, CAP002, CAP003, and CAP014; materialized generated lineage may feed CAP017, while virtual framework output remains CAP017's separate subject and is not consumed by CAP023; F27=ORACLE(023); F28=AUTH.
```

**`JAN-CSAA-CAP-024` vector**

```text
F01=ID024; F02=LIFE; F03=SRC024; F04=model bounded framework entry, ownership, lifecycle, callback, injection, and route candidates under an exact adapter; F05=static; F06=exact framework, adapter, version, configuration, project, and generated context, excluding unmodeled conventions and runtime truth; F07=only declared route, component, action, loader, handler, hook, dependency-injection, callback, and lifecycle conventions;
F08=static facts and graphs, adapter model, configuration, registrations, generated context, and an optional already completed CAP005 result; F09=candidate Framework Semantic Fact and Graph records; F10=typed candidate entry, ownership, lifecycle, callback, injection, and route relations; F11=required predecessors CAP002, CAP003, CAP004, CAP010, CAP011, CAP012, CAP013, CAP014, CAP015, CAP016, CAP017, and CAP023 with exact adapter, framework, and project compatibility; an already completed CAP005 result is optional prior-result enrichment and never a framework-model prerequisite; F12=a positive means the declared convention matched under the exact model, not runtime behavior; F13=complete only for the declared adapter-convention inventory and fully evaluated regions; F14=eligible constructs, configuration, and registrations by adapter convention and project variant;
F15=version mismatch, conventional name mistaken as meaning, stale generated context, and shadowed registration; F16=dynamic, plugin, reflection, configuration, runtime registration, and unsupported convention or version; F17=unknown adapter or version and absent required context; F18=EP-S; F19=CF-B; F20=framework, adapter, model, version, configuration, source, generated-context, or graph change; F21=PROV+adapter rule, matched facts, registration path, and assumptions;
F22=FAIL+missing or incompatible adapter, context, or convention evaluation; F23=model rule plus matched facts and registration or path witness; F24=RES; F25=INFO; F26=uses the required predecessors typed in F11 and may consume an already completed CAP005 result only as optional prior-result enrichment; CAP024 results may feed CAP005 and CAP025, but CAP025 is never an input to CAP024; F27=ORACLE(024); F28=AUTH.
```

**`JAN-CSAA-CAP-025` vector**

```text
F01=ID025; F02=LIFE; F03=SRC025; F04=model reflection and dynamic entry and preserve unresolved seams so zero static callers never implies deadness; F05=static or explicit correlation when runtime evidence binds; F06=declared registries, configuration, dynamic imports, events, decorators, external interfaces, and runtime mechanisms, excluding undeclared eval and native seams; F07=named entry mechanisms only;
F08=registries, configuration, imports, events, decorators, interfaces, dependency facts, and optional already completed call or trace results; F09=Entry, Target Candidate, and Unresolved Frontier records; F10=registration, entry, candidate-target, and observed-target relations with basis; F11=required predecessors CAP004, CAP015, CAP017, and CAP024; already completed CAP005 and CAP022 results are optional prior-result enrichments and never close an independently unresolved entry mechanism; F12=a positive is a labeled static candidate or exact-workload observation; F13=a negative is supported only when every applicable mechanism population is closed and resolved; F14=enumerated-mechanism-by-entry-and-target population with coverage per mechanism;
F15=name-string coincidence, stale configuration or registry, bad runtime map, and framework-model error; F16=eval, native, external, runtime-generated, plugin, and name-transformation seams; F17=uninspectable dynamic code or an unknown mechanism remains an explicit frontier; F18=EP-C; F19=CF-B; F20=mechanism, configuration, registry, framework, trace, map, or graph change; F21=PROV+mechanism through registration, configuration, or event to target coordinates;
F22=FAIL+unsupported or unresolved mechanism and correlation failure; F23=mechanism through registration, configuration, or event to target witness with alternatives; F24=RES; F25=INFO; F26=uses named dependencies and never closes reachability over a frontier; F27=ORACLE(025); F28=AUTH.
```

**`JAN-CSAA-CAP-026` vector**

```text
F01=ID026; F02=LIFE; F03=SRC026; F04=produce candidate technical boundaries, layers, responsibilities, coupling regions, and alternatives, never recognized architecture or a violation; F05=static or explicit correlation if dynamic layers are declared; F06=exact graph snapshot, layers, method, thresholds, seeds, and constraints; F07=declared clustering, dependency, and coupling methods;
F08=compatible facts, graphs, coverage, method, thresholds, seeds, and constraints; F09=Candidate Architecture Fact, Graph Layer, and Alternative records; F10=derived cluster-membership, coupling, and candidate-boundary relations, never an Architecture Rule; F11=CAP009 and contributing graph capabilities, with optional CAP027 and CAP028; F12=a candidate reproducibly follows only the declared method and inputs; F13=complete only for the analyzed graph population and method, never all architectural possibilities; F14=nodes, edges, and layers included, excluded, and unknown under the method;
F15=threshold instability, generated, vendor, or test distortion, and missing context; F16=missing layers, languages, or runtime edges and overaggregation; F17=insufficient or incompatible coverage or an unstated method yields unknown or refusal; F18=candidate and inferred only, with source bases preserved; F19=CF-B+stability and sensitivity basis; F20=graph, fact, method, threshold, seed, constraint, or coverage change; F21=PROV+contributing subgraph, method, threshold, seed, and alternatives;
F22=FAIL+incompatible or partial graph or method failure; F23=contributing subgraph, method, thresholds, seeds, alternatives, and instability; F24=RES; F25=INFO; F26=uses required CAP009 and contributing graph predecessors and may consume already completed CAP027 or CAP028 results only as optional prior-result enrichment under an acyclic invocation plan; F27=ORACLE(026); F28=AUTH+no rule, finding, architecture-recognition, or Decision authority.
```

**`JAN-CSAA-CAP-027` vector**

```text
F01=ID027; F02=LIFE; F03=SRC027; F04=derive facts by a declared transformation while monotonically adding lineage; F05=the input lane is preserved, with explicit correlation if inputs span lanes; F06=compatible exact facts and contexts and a declared transformation, excluding undeclared inference; F07=declared transformation branches only;
F08=source facts, transformation identity and version, configuration, contexts, and coverage; F09=Derived Semantic Fact records; F10=derived typed relations with dependency lineage; F11=required predecessors are the exact source capabilities and compatibility declared by the transformation; CAP028 is not a predecessor; F12=output follows the transformation from supported compatible inputs and never strengthens their basis; F13=complete only over a closed eligible input population and every transformation branch; F14=eligible source facts by branch with missing, conflicting, and unsupported regions explicit;
F15=overbroad or defective transformation, incompatible context, erased conflict, and semantic loss; F16=missing facts, unsupported branch, and partial upstream analysis; F17=an undefined transformation or context or incompatible input yields no derivation; F18=EP-C if lanes are mixed, otherwise EP-S, with support basis, capability coverage, execution health, freshness, conflict, and inference composed separately while retaining every contributing value and composition rule; F19=CF-N for a deterministic transformation and CF-B only when declared inference participates; F20=source-fact, transformation, version, configuration, context, or coverage change; F21=PROV+complete derivation tree;
F22=FAIL+upstream, transformation, or branch failure; F23=every source fact, transformation step, and semantic loss; F24=RES; F25=INFO; F26=uses only the exact source capabilities typed in F11 and never replaces the basis; its completed output may feed CAP028 but CAP028 is not an input; F27=ORACLE(027); F28=AUTH.
```

**`JAN-CSAA-CAP-028` vector**

```text
F01=ID028; F02=LIFE; F03=SRC028; F04=emit bounded candidate and inferred facts and alternatives without impersonating a confirmed or observed fact; F05=the input lane is preserved, with explicit correlation when lanes are mixed; F06=exact facts plus a declared model, heuristic, and domain; F07=declared targets, features, and model contexts;
F08=facts, model or heuristic identity and version, configuration, features, confidence basis, and limits; F09=Candidate, Inference, and Alternative records; F10=candidate and inferred relations; F11=required predecessors are the exact source capabilities declared by the model; an already completed CAP027 result is optional prior-result enrichment under an explicitly acyclic invocation plan; F12=a positive means only that the method produced the candidate under stated assumptions, not that it is true; F13=complete only for the declared eligible population evaluated; non-output is not negative by default; F14=eligible targets, features, domain, and missingness;
F15=model error, spurious correlation, domain drift, and threshold error; F16=recall limits, missing features, unsupported input, and budget pruning; F17=out-of-domain, missing-required-feature, or incompatible context yields unknown or refusal; F18=candidate and inferred only, with confirmed and observed inputs preserved; F19=CF-B+exact model and calibration population; F20=facts, model, version, features, prompt or template, threshold, configuration, or calibration change; F21=PROV+facts, features, model, method, seed, prompt, and configuration coordinates;
F22=FAIL+missing or invalid input, model, or feature and budget failure; F23=contributing facts, features, method, assumptions, and alternatives; an opaque score is insufficient; F24=RES; F25=INFO; F26=uses required source capabilities and may consume an already completed CAP027 result only as optional prior-result enrichment under an acyclic invocation plan, with no epistemic promotion; F27=ORACLE(028); F28=AUTH.
```

##### Query, slicing, comparison, and impact profiles

**`JAN-CSAA-CAP-029` vector**

```text
F01=ID029; F02=LIFE; F03=SRC029; F04=execute an unknown-aware semantic query over an exact subject; F05=static or explicit correlation with bound evidence; F06=one exact Static Semantic Snapshot Identity, zero or one exact Execution Evidence Set Identity, declared population, and access perimeter; F07=§9 predicates, joins, traversal, quantifiers, aggregation, and ordering;
F08=query identity and version, parameters, one subject per Query Reference and Query Result Binding, graphs, capabilities, population, budgets, and access context; cross-snapshot comparison uses CAP032 or independently bound per-snapshot pairs; F09=Query Result and Query Result Binding records; F10=query-reference, match, non-match, and outcome relations; F11=all queried profiles with exact compatibility and coverage under the acyclic composition rule; F12=true only from a supported predicate and false only from a closed complete basis; F13=complete only when the full population is successfully evaluated without unresolved semantic loss; F14=numerator, denominator, exclusions, unknowns, and grouping context;
F15=stale binding, unknown coercion, lossy join, and incompatible evidence; F16=truncation, unresolved join, unsupported relation, and omitted or redacted population; F17=an unsupported predicate, graph, or context yields unsupported or excluded, never empty success; F18=predicate-truth projection preserves supported true, supported false, unknown, and conflicting while support basis, capability coverage, execution health, freshness, conflict, and inference remain orthogonal; F19=CF-N, and ranking never implies severity; F20=query, parameters, subject, evidence, capabilities, population, graph, access, budget, or order change; F21=PROV+materialized query, parameters, population, and every traversal and join coordinate;
F22=FAIL+query, graph, prerequisite, join, access, or truncation failure; F23=a positive witness and, for a negative result, closure and completeness proof; F24=RES; F25=INFO; F26=uses named profiles, composes every orthogonal epistemic dimension separately, retains all contributing values and rules, and exposes every semantic loss; F27=ORACLE(029)+every query truth-table branch; F28=AUTH.
```

**`JAN-CSAA-CAP-030` vector**

```text
F01=ID030; F02=LIFE; F03=SRC030; F04=produce a bounded forward, backward, or chop slice with a visible frontier; F05=static or explicit correlation; F06=exact graph snapshot, criterion, policy, and bounds; F07=named edge families and declared sensitivity, alias, dispatch, async, generated, and runtime treatment;
F08=graph snapshot, criterion, direction, profiles, policies, bounds, and optional evidence; F09=Slice Result, Member, and Frontier records; F10=slice-membership and witness-path relations, never new authoritative graph edges; F11=required predecessors CAP009 and every exact named graph capability; CAP014, CAP017, CAP024, and CAP025 are required only when their mapping, generated-source, framework, or dynamic-entry contexts participate; CAP022 is required only when correlated runtime evidence participates; all materialized predecessors require exact compatibility and an acyclic plan; F12=inclusion requires a named path under the declared policy; F13=exclusion requires a closed complete graph and search with no unresolved frontier or truncation; F14=eligible nodes and edges and every entry and dynamic seam;
F15=alias or dispatch overapproximation, candidate edges, and stale maps; F16=missing graph, dynamic, reflection, framework, map, or bounded-away regions; F17=an unsupported edge or construct remains a frontier; F18=EP-C when evidence participates, otherwise EP-S, and exclusion never means negative relevance; F19=CF-N; F20=graph, criterion, profile, resolver, context, evidence, policy, or bound change; F21=PROV+criterion, path, frontier, and policy coordinates;
F22=FAIL+missing or incompatible graph and bounded or truncated traversal; F23=witness path plus frontier, excluded regions, and unsupported seams; F24=RES; F25=INFO; F26=uses only the materialized required predecessors typed in F11; correlated runtime may add or corroborate paths but never silently prune static possibilities or close an unresolved frontier; F27=ORACLE(030); F28=AUTH.
```

**`JAN-CSAA-CAP-031` vector**

```text
F01=ID031; F02=LIFE; F03=SRC031; F04=produce an explained candidate-impact set from an exact Change Seed, never safety or remediation authority; F05=static or explicit correlation; F06=exact seed, snapshot, optional comparison, propagation policy, and evidence; F07=declared typed propagation over every named change and entry mechanism;
F08=Change Seed, graphs and deltas, policy, profiles, and optional evidence; F09=Change-Impact Result and Impact Candidate records; F10=seed-to-candidate witness paths and typed impact relations; F11=named dependency, call, data, framework, dynamic, query, slice, and comparison profiles; F12=affected means only affected within the method and path basis; F13=not-affected requires a closed, completely analyzed reachability basis; F14=seed plus reachable population, edge families, entry mechanisms, and frontier;
F15=conservative overapproximation and alias, dispatch, configuration, framework, or lineage inference; F16=missing seed, edge, invalidation dependency, or dynamic entry and unsupported or truncated search; F17=unsupported or incompatible regions remain unresolved, never safe; F18=direct, transitive, runtime-observed, inferred, possible, unresolved, not-evaluated, unsupported, stale, incompatible, and bounded-not-affected remain distinct; F19=CF-B; F20=seed, subject, graph, profile, policy, evidence, map, or configuration change; F21=PROV+seed-to-candidate path, basis, and frontier coordinates;
F22=FAIL+seed, graph, profile, propagation, or truncation failure; F23=seed-to-candidate witness, basis, frontier, and next evidence required; F24=RES; F25=INFO; F26=uses named profiles; zero static callers never closes a dynamic frontier; F27=ORACLE(031)+the mandatory zero-static-callers and frontier case; F28=AUTH+no remediation or approval authority.
```

**`JAN-CSAA-CAP-032` vector**

```text
F01=ID032; F02=LIFE; F03=SRC032; F04=produce a compatible before and after semantic delta with bounded lineage; F05=static comparison or explicit correlation with evidence; F06=two exact subjects plus compatibility evidence, excluding behavior-preservation conclusions; F07=object, relation, coverage, health, freshness, and provenance delta classes;
F08=before and after facts, graphs, and evidence, profiles, models, providers, contexts, and matching policy; F09=Semantic Comparison Record; F10=History, Change, and paired-lineage relations; F11=relevant profiles on both sides as exact required predecessors plus explicit compatibility; an already completed CAP021 result is optional prior-result enrichment when coverage comparison participates; F12=a delta exists only in compatible regions using stable identity or labeled lineage; F13=empty or unchanged is supported only over the full comparable population and never as behavior proof; F14=matched, unmatched, ambiguous, and incomparable union population;
F15=forced rename or move, identity collision, and provider or configuration mismatch; F16=refactoring, generated change, partial layer, redaction, and truncation; F17=incompatible regions remain incomparable; F18=EP-C when evidence participates, otherwise EP-S, and lineage stays inferred; F19=CF-B; F20=either subject, input, profile, provider, context, map, evidence, or matching-policy change; F21=PROV+compatibility, pairing, unmatched, and lineage coordinates;
F22=FAIL+incompatible or partial inputs and pairing or lineage failure; F23=compatibility reasoning plus paired, unmatched, and ambiguous witness; F24=RES; F25=INFO; F26=uses the required relevant profiles typed in F11 and may consume an already completed CAP021 result only as optional prior-result enrichment under an acyclic invocation plan; no input forces compatibility; F27=ORACLE(032)+identical, changed, incompatible, ambiguous-lineage, and swapped-subject cases; F28=AUTH.
```

The `JAN-CSAA-003-VER-CPF-001` acceptance predicate SHALL require exactly thirty-two profile vectors; exactly one binding for each `F01` through `F28`; successful resolution of all 896 cells; no blank, literal ellipsis, unresolved alias, or unjustified not-applicable value; unique contiguous `F01` identities; the exact `0.1.1 / Draft` lifecycle with the exact `0.1.0 / Draft` predecessor in every `F02`; `SRC-BASE` plus the profile-specific clause in every `F03`; the exact current capability-specific `JAN-CSAA-006@0.1.1 / Draft` allocation at `DOCUMENTED / NOT_CONFERRED / NOT_EXECUTED` plus the authored `JAN-CSAA-008@0.2.2 / Draft` allocation with executable result `NOT_RUN` in every `F27`; valid cross-profile identities in `F11` and `F26`; and agreement between the §5.1 through §5.4 summaries and the complete purpose, subject, input, output, soundness, completeness, coverage, and limitation facets.

---

## 6. TypeScript, transformation, and entry-point semantics

### 6.1 Project and resolution context

Every compiler-semantic result SHALL identify the project/configuration variant in which it was produced. A source artifact analyzed in normal, build, test, generated, or consumer context MAY have different symbols, types, resolution, and reachability; those variants SHALL NOT be merged without a declared compatibility rule.

Module resolution SHALL retain importer identity, specifier, resolver implementation/version, compiler/module mode, path-alias configuration, condition set, package metadata, resolution attempts, result classification, and unresolved candidates. Conditional exports SHALL be evaluated against an exact consumer condition set.

Project references, declaration outputs, ambient declarations, module augmentation, and declaration merging SHALL retain their distinct roles. A declaration file MAY be authored, generated, vendored, or external; classification is part of its semantic identity.

### 6.2 Generated and transformed source

Generated or virtual source SHALL retain:

- generated artifact identity;
- authored origin where known;
- generator or adapter identity and version;
- generator inputs and relevant configuration;
- transformation and source-map chain;
- mapping health, ambiguity, and unmapped regions; and
- the project variant in which the generated artifact participates.

A result derived from generated source SHALL NOT be attributed to authored source when the mapping is absent, broken, mismatched, ambiguous, or outside its declared granularity. Such results MAY remain useful at generated-source grain if labeled accordingly.

JSX, TSX, decorators, Svelte-generated TypeScript, framework registration, and reflective conventions SHALL be interpreted only under an explicit model and version. Syntax presence alone SHALL NOT establish framework or runtime meaning.

### 6.3 Entry and reachability surfaces

Reachability analysis SHALL declare which entry mechanisms it covers. Applicable mechanisms include:

- package and executable entry points;
- framework routes, components, actions, loaders, handlers, and hooks;
- test runners and configured test discovery;
- dynamic imports and conditional loading;
- dependency-injection and service registries;
- event, message, command, callback, timer, and subscription registration;
- decorator- or metadata-driven discovery;
- reflection and name-based lookup;
- configuration, manifest, script, plugin, and extension entry;
- generated and virtual-source entry;
- externally invoked APIs, jobs, protocols, or native boundaries; and
- runtime-observed entries for an exact workload.

An uncovered or unresolved entry mechanism creates an explicit reachability frontier. It SHALL NOT be interpreted as absence.

---

## 7. Static and runtime evidence correlation

Static relations and runtime observations are different semantic lanes. Correlation SHALL preserve both identities.

Runtime evidence SHALL bind the exact build, source revision and working-change identity where applicable, build configuration, instrumentation, environment, workload, collector and schema versions, observation interval, completeness claim, and source-map health. A mismatched identity prevents silent correlation.

Runtime evidence MAY:

- corroborate a static candidate;
- establish that a path occurred under the observed workload;
- add an observed target or entry candidate;
- contradict a static claim and create a visible conflict; or
- expose an unsupported or missing static model.

Runtime evidence SHALL NOT silently delete an unobserved static possibility, establish whole-program absence, or make an incompatible static result current.

Test discovery, test selection, execution, pass/fail result, test-to-code mapping, coverage observation, and runtime trace are distinct facts. No one implies another.

---

## 8. Architecture discovery and bounded enrichment

Architecture discovery produces candidate technical interpretations over declared facts and graph families. Every candidate SHALL expose:

- the exact input snapshot and graph layers;
- the method, thresholds, constraints, and seed information;
- contributing facts and excluded regions;
- alternative interpretations where material;
- confidence basis and known instability;
- dependency and invalidation conditions; and
- the statement that the result is not recognized architecture authority.

Enrichment and inference SHALL be monotonic with respect to provenance: every derived fact adds a trace to its basis and SHALL NOT replace the basis. When source facts conflict, the enrichment preserves the conflict or refuses the derivation; it SHALL NOT choose a convenient input silently.

Architecture discovery SHALL NOT create an Architecture Rule Profile, Analyzer Finding Record, accepted architecture Decision, or source mutation. Those are separate concern-owner acts.

---

## 9. Semantic query model

### 9.1 Query identity and binding

A semantic query is an immutable, versioned definition. Each execution SHALL create one immutable Query Reference and one Query Result Binding that bind the same exact Static Semantic Snapshot Identity. When dynamic evidence participates, that Query Reference and that Query Result Binding SHALL bind the same exact Execution Evidence Set Identity correlated to that static snapshot; when dynamic evidence does not participate, both SHALL record the evidence-set field as not applicable.

Before/after or other cross-snapshot semantics SHALL be expressed through `JAN-CSAA-CAP-032` or an explicit pair of independently bound Query References and Query Result Bindings, one pair for each exact snapshot, plus a separately identified comparison relationship. A single Query Reference or Query Result Binding SHALL NOT float across or contain more than one semantic snapshot.

The query definition SHALL declare:

- stable query identity and version;
- purpose and protected engineering question;
- subject-binding and optional evidence-binding policy; actual per-execution identities reside in the Query Reference and Query Result Binding;
- population and perimeter;
- graph families and relation meanings;
- predicates, joins, traversal directions, and limits;
- project, build, environment, or workload contexts where relevant;
- capability and coverage prerequisites;
- ordering or explicit absence of ordering;
- budgets, timeout, pagination, cancellation, and truncation policy;
- access and redaction context; and
- result explanation and provenance obligations.

Re-executing a query creates a new Query Result bound to a new Analysis Run. It SHALL NOT mutate or retroactively refresh an earlier result.

### 9.2 Outcome semantics

Query evaluation SHALL preserve the orthogonal epistemic dimensions inherited from `JAN-CSAA-002`; they SHALL NOT collapse into one status or outcome:

| Dimension | Representative values retained independently |
| --- | --- |
| Support basis | syntax-observed, resolver-confirmed, compiler-confirmed, runtime-observed, provider-inferred, user or governed-constraint reference |
| Capability coverage | supported, partial, unsupported, excluded, not analyzed |
| Execution health | succeeded, failed, timed out, cancelled, resource exhausted, malformed output |
| Freshness | current for subject, stale, invalidated, unknown |
| Conflict | unopposed, corroborated, conflicting, superseded or corrected |
| Inference | direct, derived, candidate, bounded inference, unknown |

Predicate truth is a projection over those dimensions, never their replacement:

| Predicate-truth projection | Meaning |
| --- | --- |
| Supported true | The predicate is supported within the declared method and basis |
| Supported false | The predicate is false within a declared closed and adequately covered basis |
| Unknown | The available basis cannot support true or false |
| Conflicting | Admissible analysis inputs or results support incompatible truth projections; the conflict dimension retains the contributing results |

Not evaluated, unsupported, stale, incomplete, failed, and excluded describe particular coverage, health, freshness, or perimeter conditions. They SHALL remain explicit in their owning dimensions and SHALL NOT be encoded only as predicate truth.

Exact enum spelling and serialization belong to `JAN-CSAA-007`. Implementations SHALL preserve the distinctions even if their native result model is coarser.

### 9.3 Logical rules

Negation SHALL preserve unknown and conflict. It SHALL NOT convert unknown to true or false.

An existential predicate MAY be supported false only when its search population is closed, relevant capability coverage is complete, and every candidate region was successfully evaluated. Absence of a witness under an open, partial, stale, unsupported, timed-out, truncated, or failed search is unknown.

A universal predicate MAY be supported true only when its population is closed and completely evaluated. One supported counterexample is sufficient for supported false within its basis. An unknown member prevents universal truth.

A missing relation SHALL NOT be treated as a supported negative unless the relation family, source population, target population, and applicable dynamic or generated seams were completely analyzed.

Counts SHALL be labeled as lower bounds unless completeness is established. Every ratio, percentage, or aggregation SHALL expose its numerator, denominator, excluded regions, unknown regions, and grouping context.

Joins SHALL compose predicate truth and every orthogonal epistemic dimension separately. They SHALL NOT replace dimension-specific composition with one scalar "weakest state." A dimension-specific conservative result SHALL retain the contributing values and composition rule. A join that drops unresolved keys or unsupported regions SHALL report that semantic loss.

Timeout, cancellation, pagination cutoff, result cap, traversal bound, or budget exhaustion SHALL prohibit population-wide absence claims unless a separately complete index proves the omitted region irrelevant under the query definition.

Ordering SHALL be deterministic under a declared key or explicitly unordered. Ranking SHALL NOT imply severity, importance, causal responsibility, or authority unless a separately owned rule defines that meaning.

### 9.4 Query result contract

Every Query Result SHALL retain:

- immutable result identity and producing Analysis Run;
- exact query identity/version and materialized parameters;
- one exact Static Semantic Snapshot Identity and zero or one exact Execution Evidence Set Identity;
- capability-profile and provider-invocation references;
- supported matches and supported non-matches;
- predicate-truth projection plus orthogonal support-basis, capability-coverage, execution-health, freshness, conflict, and inference dimensions for every region;
- population, coverage, denominator, budgets, truncation, and ordering;
- witness paths or explanations sufficient to inspect each material result;
- raw-result and transformation provenance;
- observation and record times; and
- logical invalidation dependencies.

An empty supported-match collection SHALL be accompanied by the epistemic and coverage state necessary to distinguish supported absence from inability to determine.

---

## 10. Code-slicing semantics

A slice is a bounded semantic analysis over one exact graph snapshot. It SHALL declare:

- criterion identity and exact code location or semantic-object identity;
- forward, backward, or chop direction;
- included graph and relation families;
- interprocedural and context-sensitivity policy;
- alias, dispatch, exception, asynchronous, generated-source, and runtime-evidence treatment;
- scope, traversal, and resource bounds;
- exact capability-profile versions; and
- the intended interpretation of inclusion and exclusion.

A Slice Result SHALL contain included members, witness paths, the unresolved frontier, unsupported seams, excluded regions, conflicts, truncation state, and coverage basis.

Dynamic calls, reflection, framework registration, unavailable data flow, broken source maps, unsupported constructs, and incompatible runtime evidence create frontier uncertainty. A slice SHALL NOT hide them.

Runtime observations MAY corroborate or add paths. They SHALL NOT silently remove unobserved static possibilities.

Exclusion from a bounded slice SHALL NOT be represented as proof of irrelevance, non-impact, dead code, or safe removal.

Slice invalidation follows every graph input, criterion, profile, resolver, project, generated context, runtime evidence set, and traversal policy on which the result depends.

---

## 11. Before/after semantic comparison

### 11.1 Comparison prerequisites

A Semantic Comparison SHALL bind exact before and after subjects. It SHALL declare compatibility for:

- semantic-model version;
- capability-profile versions;
- graph families and relation meanings;
- provider and method where comparability depends on them;
- project and resolver contexts;
- generated-source and mapping contexts;
- build, instrumentation, environment, workload, and collector where execution evidence participates;
- population and coverage basis; and
- access/redaction context.

Incompatible regions SHALL be reported as incomparable. They SHALL NOT be forced into an apparent delta.

### 11.2 Lineage and delta classes

Cross-revision object matching is bounded lineage inference. A comparison SHALL distinguish stable identity from inferred correspondence and SHALL expose ambiguous matches.

The result SHALL distinguish, as applicable:

- added;
- removed;
- modified;
- moved;
- renamed;
- reclassified;
- relation added or removed;
- coverage changed;
- health or freshness changed;
- provenance or provider changed;
- conflicting;
- unknown; and
- incomparable.

Textual diff and semantic delta are separate inputs. A textual change MAY produce no observable delta under one profile, and an unchanged source file MAY participate in a semantic delta through configuration, dependency, generated-source, environment, or provider changes.

An unchanged graph, unchanged query result, or empty semantic delta SHALL NOT be represented as proof that intended behavior was preserved.

Swapping before and after SHALL produce an inverse delta for symmetric classes where the comparison method promises invertibility. Any non-invertible inference or information loss SHALL be declared.

### 11.3 Comparison record

Every Semantic Comparison Record SHALL retain both exact subjects, compatibility decisions and evidence, lineage method, delta classes, unmatched and ambiguous regions, coverage and health differences, raw inputs, producing run, explanations, and invalidation dependencies.

---

## 12. Change-impact semantics

### 12.1 Seeds and propagation

Change-impact analysis begins with an exact Change Seed. A seed MAY be:

- a source edit, addition, deletion, move, or rename;
- a semantic-object or relation delta;
- a contract, declaration, or generated-source change;
- a dependency, manifest, lockfile, resolver, path-alias, or conditional-export change;
- a project, compiler, framework, generator, or analyzer configuration change;
- a rule/profile/provider/model version change;
- a build, instrumentation, test-selection, environment, collector, schema, workload, or source-map change; or
- an invalidated observation, fact, evidence set, or assumption.

Propagation SHALL occur only over named typed relations and declared capability profiles. Every material Impact Candidate SHALL retain a witness path from seed to candidate.

### 12.2 Impact states

An impact result SHALL distinguish:

- directly affected within the method's basis;
- transitively affected within the method's basis;
- runtime-observed affected for an exact workload;
- inferred or possibly affected;
- unresolved;
- not evaluated;
- unsupported;
- stale or incompatible; and
- not affected only within an explicitly closed and completely analyzed basis.

A Change-Impact Result SHALL include evidence or analysis still required to reduce unresolved impact. It SHALL NOT represent possible impact as certain breakage, or bounded non-impact as universal safety.

### 12.3 Dead-code and reachability boundary

Zero observed static callers never proves dead code or safe removal. It MAY support a bounded dead-code candidate only when the declared reachability surface covers every applicable framework, reflection, dynamic-import, event, registration, external, runtime, generated, and configuration entry mechanism and every applicable entry population is closed and successfully resolved.

Any unresolved, unsupported, stale, failed, excluded, not-evaluated, or incomplete applicable region SHALL remain visible and SHALL prevent the negative reachability conclusion. Visibility of such a region is disclosure, not closure. The deadness result for that region is inconclusive; separately supported positive entry or target candidates remain visible, but neither state establishes deadness or safe removal.

Even when that reachability precondition is met, a dead-code candidate remains an analysis result. A separately owned rule determines whether it is a finding, and an authorized engineering process determines whether removal is permitted.

A test-selection recommendation SHALL NOT be represented as proof that unselected tests are irrelevant. Missing an invalidation or dependency edge SHALL NOT be represented as proof of freshness or non-impact.

### 12.4 Impact record

Every Change-Impact Result SHALL retain:

- exact seed identity;
- exact analyzed subject and optional comparison;
- propagation profiles and relation families;
- direct, transitive, inferred, and runtime-observed paths;
- candidate state and confidence basis;
- unresolved frontier and unsupported seams;
- coverage, budgets, truncation, and failure;
- suggested next evidence without prescribing authority;
- provenance and explanation; and
- invalidation dependencies.

An impact result is not an Analyzer Finding Record, severity assignment, gate result, remediation order, behavior-preservation claim, or approval.

---

## 13. Provenance, explanation, and information controls

Every result governed by this specification SHALL be reconstructable from:

- exact static and dynamic subject identities;
- analysis-capability profile identity and version;
- Analysis Run and provider invocation;
- method, configuration, project variant, and resolver context;
- input facts, graph layers, evidence sets, and raw-result references;
- transformation, enrichment, inference, and comparison chain;
- source and generated locations and mapping health;
- coverage basis and epistemic state;
- observation, occurrence, record, and cutoff times as applicable;
- assumptions, conflicts, exclusions, limitations, and invalidation dependencies; and
- redaction or access treatment.

Explanation SHALL be proportional to the claim. A path result requires a witness path; an absence result requires a closed population and completeness evidence; an inferred match requires contributing facts and method; a comparison requires compatibility reasoning.

Redaction MAY hide protected content from a caller. It SHALL NOT fabricate completeness, erase the existence of a materially interpretation-changing omission, or leak protected existence through counts, paths, graph shape, placeholders, or metadata.

Repository text, configuration, generated output, maps, provider output, traces, and imported analysis are untrusted inputs. They SHALL pass the trust boundary defined by `JAN-CSAA-001` before publication.

---

## 14. Failure and degraded operation

The following failure classes SHALL remain distinguishable where applicable:

- missing, invalid, incompatible, or stale configuration;
- unsupported syntax, semantics, framework convention, or runtime seam;
- parse, bind, type, resolution, graph-construction, or correlation failure;
- provider unavailable, crashed, returned malformed output, or violated its declared contract;
- timeout, cancellation, resource exhaustion, or budget refusal;
- truncated or paginated result;
- mixed revision or subject mismatch;
- generated-source, source-map, build, instrumentation, test-selection, coverage, trace-schema, collector, workload, or environment mismatch;
- comparison incompatibility or ambiguous lineage; and
- authorization, access, confidentiality, or redaction constraint.

Invalid provider output is semantically inert until validated and normalized. It SHALL NOT create a successful result, supported absence, finding, gate outcome, or source mutation.

Failure of one capability SHALL NOT silently become successful emptiness in a dependent capability. A dependent result either fails, publishes an explicitly bounded partial result, or excludes the affected region with consequences stated.

A partial result MAY publish only when its subject, completed work, missing work, affected regions, epistemic consequences, and invalidation dependencies are explicit. A last-known-good result MAY be used for labeled historical inspection; it SHALL NOT be presented as current.

---

## 15. Invalidation and incremental-analysis equivalence

Logical invalidation is part of analysis meaning. Physical scheduling, caching, recomputation, storage, and recovery belong to `JAN-CSAA-009`.

Each result SHALL declare the inputs and semantic dependencies whose change invalidates it. Dependencies include, as applicable:

- repository, revision, working change, artifact content, or classification;
- project, compiler, resolver, condition set, path alias, declaration, or ambient context;
- manifest, lockfile, dependency, generator, adapter, framework, or generated output;
- capability profile, provider, method, model, rule input, or configuration;
- build, instrumentation, test selection, coverage denominator, source map, trace schema, collector, workload, or environment;
- population, traversal, budget, query definition, or access/redaction context; and
- any upstream fact, graph, enrichment, inference, comparison, or evidence set.

An unresolved invalidation dependency prevents a currentness claim. A refresh produces a successor result and preserves the predecessor as historical evidence.

An incremental result SHALL be observationally equivalent, within the declared ordering, approximation, and inference limits, to a clean full analysis of the same exact subject using the same semantic profiles and compatible provider methods.

Equivalence SHALL compare semantic result sets, epistemic states, coverage, provenance, conflicts, failures, and explanations—not merely counts or hashes. Any permitted difference SHALL be declared by the profile and verified by an independently owned oracle.

---

## 16. Security, resource, and mutation boundaries

Analysis is read-only by default. A query, slice, comparison, enrichment, or impact request SHALL NOT:

- execute repository scripts or imported code merely to inspect it;
- install or update dependencies;
- call an undeclared network service;
- generate into the repository;
- modify source, configuration, tests, fixtures, or oracle content;
- change a baseline, decision, exception, or gate; or
- expand its subject or access scope implicitly.

Any authorized execution needed to collect test, coverage, or runtime evidence is a separately identified operation under the execution lane and inherits `JAN-CSAA-001` trust, isolation, resource, and publication controls.

Resource limits SHALL fail honestly. A budget-protecting refusal, timeout, or truncation is a degraded result, not an empty answer. Providers and query engines SHALL NOT use resource pressure to silently lower coverage or switch semantic profiles.

---

## 17. Downstream allocation

| Member | Required allocation from this specification |
| --- | --- |
| `JAN-CSAA-004` | Bind rules to eligible capability profiles and outputs; own finding, severity, exception, suppression, provider-contract, and gate semantics without redefining analysis meaning |
| `JAN-CSAA-006` | Provide independently reviewed positive, negative, unknown, partial, conflict, stale, dynamic-entry, and non-vacuity fixture judgments for every capability and query-algebra branch |
| `JAN-CSAA-007` | Encode versioned capability profiles, queries, results, slices, comparisons, impact records, provenance, explanation, and failure shapes without changing their meaning |
| `JAN-CSAA-008` | Execute requirement-level conformance, property and metamorphic tests, differential tests, mutation/tests-of-tests, and no-false-green scenarios |
| `JAN-CSAA-009` | Own persistence, atomic publication, access enforcement, scheduling, invalidation/recomputation, recovery, and incremental/full-equivalence operational evidence |
| `JAN-CSAA-010` | Define when coding agents invoke capabilities, consume limits, stop or escalate, and report evidence; never redefine semantics or self-approve |
| `JAN-CSAA-011` | Qualify concrete providers against exact coverage, provenance, isolation, failure, replacement, and differential obligations; providers cannot reshape profiles |

---

## 18. Normative requirement catalog

Requirement identifiers are permanent within `JAN-CSAA-003`. Retirement creates a successor treatment; it does not reuse an identifier.

### 18.1 Control, lifecycle, and evidence boundary

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-001` | The document SHALL retain permanent ID `JAN-CSAA-003`, exact semantic version, lifecycle status, settledness, and title. |
| `CSAA-003-REQ-002` | Draft status SHALL remain non-authoritative until an exact-member register conferral. |
| `CSAA-003-REQ-003` | The document SHALL bind the exact adopted `JAN-CSAA-000` authority baseline. |
| `CSAA-003-REQ-004` | The document SHALL bind exact provisional `JAN-CSAA-001` and `JAN-CSAA-002` inputs and treat later changes as affected-review triggers. |
| `CSAA-003-REQ-005` | Documentation-only Wave 2 entry SHALL be traced to `JAN-CSAA-W1-SEMANTIC-READINESS-001` and `REG-D-021`/`022`. |
| `CSAA-003-REQ-006` | No authoring, tool, test, provider, Git, or implementation result SHALL confer authority on this member. |
| `CSAA-003-REQ-007` | The exact scope and applicability perimeter SHALL remain explicit. |
| `CSAA-003-REQ-008` | The document SHALL state what it does and does not govern. |
| `CSAA-003-REQ-009` | Precedence SHALL resolve by concern owner rather than document proximity or convenience. |
| `CSAA-003-REQ-010` | Apparent semantic or authority conflicts SHALL be recorded and routed without silent reconciliation. |
| `CSAA-003-REQ-011` | Change procedure SHALL distinguish Draft revision, Proposed freeze, independent review, validation, conferral, and ministerial recording. |
| `CSAA-003-REQ-012` | Every post-freeze candidate-byte change SHALL trigger affected re-review except a pre-frozen, exact, non-semantic administrative substitution. |
| `CSAA-003-REQ-013` | The author/integrator, adversarial reviewer, integrity validator, decision authority, and recorder roles SHALL remain distinct for the same judgment surface. |
| `CSAA-003-REQ-014` | Exact schemas, fields, APIs, enum spellings, query syntax, and error envelopes SHALL remain deferred to `JAN-CSAA-007`. |
| `CSAA-003-REQ-015` | Executable fixture and conformance results SHALL remain unperformed until their separately authorized lifecycle. |
| `CSAA-003-REQ-016` | Concrete provider qualification, selection, installation, and deployment SHALL remain outside this document. |
| `CSAA-003-REQ-017` | Repository observations SHALL be labeled as dated evidence rather than continuously current implementation facts. |
| `CSAA-003-REQ-018` | A consolidated implementation-subject refresh SHALL precede final corpus freeze. |
| `CSAA-003-REQ-019` | The requirement ledger SHALL account individually for every local and inherited applicable obligation. |
| `CSAA-003-REQ-020` | Requirement identifiers SHALL be permanent and SHALL NOT be reused after retirement. |
| `CSAA-003-REQ-021` | Examples and illustrative names SHALL NOT acquire shape authority. |
| `CSAA-003-REQ-022` | Unsupported implementation claims SHALL NOT be inferred from documentation completeness. |
| `CSAA-003-REQ-023` | The final candidate SHALL identify exact supersession and review companions. |
| `CSAA-003-REQ-024` | No requirement may be declared passed without method-bound evidence sufficient to reproduce the conclusion. |

### 18.2 Concern ownership

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-025` | `JAN-CSAA-003` SHALL own provider-independent Analysis Capability Profile meaning. |
| `CSAA-003-REQ-026` | `JAN-CSAA-003` SHALL own extraction, enrichment, inference, query, slicing, semantic-delta, and change-impact semantics. |
| `CSAA-003-REQ-027` | Semantic objects, relations, graph families, identity, provenance primitives, and epistemic dimensions SHALL remain owned by `JAN-CSAA-002`. |
| `CSAA-003-REQ-028` | Logical responsibilities, trust boundaries, and publication architecture SHALL remain owned by `JAN-CSAA-001`. |
| `CSAA-003-REQ-029` | Rules, findings, severity, suppression, exceptions, provider contracts, and repository gates SHALL remain owned by `JAN-CSAA-004`. |
| `CSAA-003-REQ-030` | Revision-bound JPWB repository facts SHALL remain owned by `JAN-CSAA-005`. |
| `CSAA-003-REQ-031` | Fixture cases, expected judgments, and oracle governance SHALL remain owned by `JAN-CSAA-006`. |
| `CSAA-003-REQ-032` | Executable conformance SHALL remain owned by `JAN-CSAA-008`. |
| `CSAA-003-REQ-033` | Physical persistence, scheduling, recomputation, recovery, and query authorization SHALL remain owned by `JAN-CSAA-009`. |
| `CSAA-003-REQ-034` | Coding-agent employment, stop, and escalation procedure SHALL remain owned by `JAN-CSAA-010` and canon by concern. |
| `CSAA-003-REQ-035` | Concrete provider qualification and selection SHALL remain owned by `JAN-CSAA-011`. |
| `CSAA-003-REQ-036` | An analysis result SHALL NOT be represented as canonical Evidence, a finding, a gate result, a Decision, a waiver, or authority. |
| `CSAA-003-REQ-037` | A downstream member SHALL reference this specification rather than redefine its analysis semantics. |
| `CSAA-003-REQ-038` | This specification SHALL state semantic requirements and cede repository shapes. |

### 18.3 Foundations and epistemic discipline

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-039` | Every analysis SHALL bind one exact subject before producing a semantic conclusion. |
| `CSAA-003-REQ-040` | A result SHALL bind its declared capability basis and population. |
| `CSAA-003-REQ-041` | The default stance SHALL be open-world unless a closed population and complete relevant coverage are demonstrated. |
| `CSAA-003-REQ-042` | Unknown SHALL NOT be coerced to true, false, empty, passing, or not applicable. |
| `CSAA-003-REQ-043` | Unsupported, excluded, failed, stale, incomplete, conflicting, and not-evaluated states SHALL remain distinguishable. |
| `CSAA-003-REQ-044` | Successful execution SHALL NOT be represented as assurance. |
| `CSAA-003-REQ-045` | Provider capability SHALL NOT be represented as provider qualification. |
| `CSAA-003-REQ-046` | A query match SHALL NOT be represented as a finding. |
| `CSAA-003-REQ-047` | Absence of an observed edge SHALL NOT be represented as supported absence without complete declared coverage. |
| `CSAA-003-REQ-048` | Zero observed static callers SHALL NOT be represented as dead code. |
| `CSAA-003-REQ-049` | An unchanged semantic graph SHALL NOT be represented as preserved intended behavior. |
| `CSAA-003-REQ-050` | A runtime observation SHALL NOT be represented as exhaustive runtime possibility. |
| `CSAA-003-REQ-051` | Confidence SHALL NOT be represented as certainty. |
| `CSAA-003-REQ-052` | Incremental completion SHALL NOT be represented as full-analysis equivalence without comparison evidence. |
| `CSAA-003-REQ-053` | Textual diff and semantic delta SHALL remain distinct. |
| `CSAA-003-REQ-054` | Possible impact SHALL NOT be represented as required remediation or certain breakage. |
| `CSAA-003-REQ-055` | Every inference SHALL retain contributing facts, method, assumptions, and invalidation conditions. |
| `CSAA-003-REQ-056` | A scalar confidence SHALL expose its basis and calibration limits. |
| `CSAA-003-REQ-057` | Conflicting inputs or results SHALL remain visible or block the derivation. |
| `CSAA-003-REQ-058` | A normalized representation SHALL preserve material semantic distinctions from its source. |
| `CSAA-003-REQ-059` | Static facts and execution observations SHALL retain separate identities. |
| `CSAA-003-REQ-060` | A technical analysis record SHALL remain revision-bound and reconstructable. |
| `CSAA-003-REQ-061` | A result SHALL state the scope within which its positive and negative claims are supported. |
| `CSAA-003-REQ-062` | An unresolved population or capability boundary SHALL prevent universal conclusions. |

### 18.4 Analysis Capability Profile contract

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-063` | Every Analysis Capability Profile SHALL have a permanent stable identity. |
| `CSAA-003-REQ-064` | Every profile SHALL carry exact version, lifecycle, predecessor, and successor state. |
| `CSAA-003-REQ-065` | Every profile SHALL cite its governing and inherited source obligations. |
| `CSAA-003-REQ-066` | Every profile SHALL state its purpose and protected engineering question. |
| `CSAA-003-REQ-067` | Every profile SHALL identify its static, execution-evidence, or correlation lane. |
| `CSAA-003-REQ-068` | Every profile SHALL state its supported subject perimeter and exclusions. |
| `CSAA-003-REQ-069` | Every profile SHALL state supported constructs, contexts, and conventions. |
| `CSAA-003-REQ-070` | Every profile SHALL identify required semantic inputs. |
| `CSAA-003-REQ-071` | Every profile SHALL identify produced object or record meanings. |
| `CSAA-003-REQ-072` | Every profile SHALL identify produced relation or edge meanings. |
| `CSAA-003-REQ-073` | Every profile SHALL distinguish required predecessor capabilities from optional prior-result enrichments, declare exact compatibility conditions, and participate in an acyclic required-predecessor graph. |
| `CSAA-003-REQ-074` | Every profile SHALL state its soundness objective and boundary. |
| `CSAA-003-REQ-075` | Every profile SHALL state its completeness objective and boundary. |
| `CSAA-003-REQ-076` | Every profile SHALL declare its coverage population, dimensions, denominator, and closure conditions. |
| `CSAA-003-REQ-077` | Every profile SHALL identify known false-positive classes. |
| `CSAA-003-REQ-078` | Every profile SHALL identify known false-negative classes. |
| `CSAA-003-REQ-079` | Every profile SHALL identify unsupported constructs and contexts. |
| `CSAA-003-REQ-080` | Every profile SHALL distinguish confirmed, candidate, inferred, observed, conflicting, and unknown results where applicable. |
| `CSAA-003-REQ-081` | Every profile SHALL state confidence meaning, basis, granularity, and calibration limits. |
| `CSAA-003-REQ-082` | Every profile SHALL declare logical invalidation dependencies. |
| `CSAA-003-REQ-083` | Every profile SHALL require exact run, invocation, method, input, and raw-result provenance. |
| `CSAA-003-REQ-084` | Every profile SHALL state failure and partial-publication behavior. |
| `CSAA-003-REQ-085` | Every profile SHALL state explanation or witness obligations proportionate to consequence, uncertainty, irreversibility, and exposure, and SHALL retain a universal minimum sufficient to inspect the result. |
| `CSAA-003-REQ-086` | Every profile SHALL state resource, timeout, cancellation, truncation, and ordering behavior. |
| `CSAA-003-REQ-087` | Every profile SHALL state access, confidentiality, redaction, and retention meaning. |
| `CSAA-003-REQ-088` | Every profile SHALL state permitted composition and semantic-loss disclosure. |
| `CSAA-003-REQ-089` | Every profile SHALL reference an independently owned conformance-oracle allocation. |
| `CSAA-003-REQ-090` | Every profile SHALL state that its results cannot mutate, approve, waive, confer, or imply implementation currentness. |

### 18.5 Required capabilities

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-091` | The capability catalog SHALL define parsing and AST extraction profile `JAN-CSAA-CAP-001`. |
| `CSAA-003-REQ-092` | The capability catalog SHALL define symbol and reference resolution profile `JAN-CSAA-CAP-002`. |
| `CSAA-003-REQ-093` | The capability catalog SHALL define type-analysis profile `JAN-CSAA-CAP-003`. |
| `CSAA-003-REQ-094` | The capability catalog SHALL define dependency-analysis profile `JAN-CSAA-CAP-004`. |
| `CSAA-003-REQ-095` | The capability catalog SHALL define call-graph profile `JAN-CSAA-CAP-005`. |
| `CSAA-003-REQ-096` | The capability catalog SHALL define control-flow profile `JAN-CSAA-CAP-006`. |
| `CSAA-003-REQ-097` | The capability catalog SHALL define data-flow profile `JAN-CSAA-CAP-007`. |
| `CSAA-003-REQ-098` | The capability catalog SHALL define taint-analysis profile `JAN-CSAA-CAP-008` without owning source, sink, sanitizer, severity, or disposition rules. |
| `CSAA-003-REQ-099` | The capability catalog SHALL define graph-composition profile `JAN-CSAA-CAP-009`. |
| `CSAA-003-REQ-100` | The capability catalog SHALL define project-reference and variant profile `JAN-CSAA-CAP-010`. |
| `CSAA-003-REQ-101` | The capability catalog SHALL define path-alias and module-resolution profile `JAN-CSAA-CAP-011`. |
| `CSAA-003-REQ-102` | The capability catalog SHALL define conditional-export profile `JAN-CSAA-CAP-012`. |
| `CSAA-003-REQ-103` | The capability catalog SHALL define declaration and module-augmentation profile `JAN-CSAA-CAP-013`. |
| `CSAA-003-REQ-104` | The capability catalog SHALL define source-map and source-origin profile `JAN-CSAA-CAP-014`. |
| `CSAA-003-REQ-105` | The capability catalog SHALL define decorator-analysis profile `JAN-CSAA-CAP-015`. |
| `CSAA-003-REQ-106` | The capability catalog SHALL define JSX/TSX profile `JAN-CSAA-CAP-016`. |
| `CSAA-003-REQ-107` | The capability catalog SHALL define framework-generated and virtual-source profile `JAN-CSAA-CAP-017`. |
| `CSAA-003-REQ-108` | The capability catalog SHALL define test-discovery profile `JAN-CSAA-CAP-018`. |
| `CSAA-003-REQ-109` | The capability catalog SHALL define test-to-code mapping profile `JAN-CSAA-CAP-019`. |
| `CSAA-003-REQ-110` | The capability catalog SHALL define coverage-ingestion profile `JAN-CSAA-CAP-020`. |
| `CSAA-003-REQ-111` | The capability catalog SHALL define coverage-comparison profile `JAN-CSAA-CAP-021`. |
| `CSAA-003-REQ-112` | The capability catalog SHALL define runtime-trace correlation profile `JAN-CSAA-CAP-022`. |
| `CSAA-003-REQ-113` | The capability catalog SHALL define generated-code profile `JAN-CSAA-CAP-023`. |
| `CSAA-003-REQ-114` | The capability catalog SHALL define framework-modeling profile `JAN-CSAA-CAP-024`. |
| `CSAA-003-REQ-115` | The capability catalog SHALL define reflection and dynamic-entry profile `JAN-CSAA-CAP-025`. |
| `CSAA-003-REQ-116` | The capability catalog SHALL define architecture-discovery profile `JAN-CSAA-CAP-026`. |
| `CSAA-003-REQ-117` | The capability catalog SHALL define semantic-enrichment profile `JAN-CSAA-CAP-027`. |
| `CSAA-003-REQ-118` | The capability catalog SHALL define bounded-inference profile `JAN-CSAA-CAP-028`. |
| `CSAA-003-REQ-119` | The capability catalog SHALL define semantic-query profile `JAN-CSAA-CAP-029`. |
| `CSAA-003-REQ-120` | The capability catalog SHALL define code-slicing profile `JAN-CSAA-CAP-030`. |
| `CSAA-003-REQ-121` | The capability catalog SHALL define change-impact profile `JAN-CSAA-CAP-031`. |
| `CSAA-003-REQ-122` | The capability catalog SHALL define before/after semantic-comparison profile `JAN-CSAA-CAP-032`. |

### 18.6 Query semantics

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-123` | Every query SHALL have a stable identity and exact version. |
| `CSAA-003-REQ-124` | Every query execution SHALL create one Query Reference and one Query Result Binding that bind the same exact Static Semantic Snapshot Identity. |
| `CSAA-003-REQ-125` | Dynamic-evidence participation SHALL bind the same exact Execution Evidence Set Identity in the participating Query Reference and Query Result Binding. |
| `CSAA-003-REQ-126` | Cross-snapshot semantics SHALL use `JAN-CSAA-CAP-032` or independently bound per-snapshot Query References and Query Result Bindings plus an exact comparison relationship. |
| `CSAA-003-REQ-127` | Every query SHALL declare its population and perimeter. |
| `CSAA-003-REQ-128` | Every query SHALL declare graph families, relation meanings, predicates, joins, and traversal directions. |
| `CSAA-003-REQ-129` | Every query SHALL declare project, build, environment, and workload contexts where relevant. |
| `CSAA-003-REQ-130` | Every query SHALL declare capability and coverage prerequisites. |
| `CSAA-003-REQ-131` | Every query SHALL declare deterministic ordering or explicit unordered semantics. |
| `CSAA-003-REQ-132` | Every query SHALL declare budgets, timeout, pagination, cancellation, and truncation policy. |
| `CSAA-003-REQ-133` | Every query SHALL declare access, redaction, explanation, and provenance obligations. |
| `CSAA-003-REQ-134` | Re-execution SHALL create a new Query Result and SHALL NOT mutate historical results. |
| `CSAA-003-REQ-135` | Predicate-truth projection SHALL preserve supported true, supported false, unknown, and conflicting meanings without replacing orthogonal epistemic dimensions. |
| `CSAA-003-REQ-136` | Query evaluation SHALL preserve support basis, capability coverage, execution health, freshness, conflict, and inference as orthogonal dimensions, including explicit not-evaluated, unsupported, stale, incomplete, failed, and excluded conditions. |
| `CSAA-003-REQ-137` | Negation SHALL preserve unknown and conflict. |
| `CSAA-003-REQ-138` | Existential supported-false SHALL require a closed population and complete successful evaluation. |
| `CSAA-003-REQ-139` | Universal supported-true SHALL require a closed population and complete successful evaluation. |
| `CSAA-003-REQ-140` | A supported counterexample SHALL be sufficient for universal supported-false within its declared basis. |
| `CSAA-003-REQ-141` | A missing relation SHALL NOT become a supported negative without complete relevant source, target, relation, and dynamic-seam coverage. |
| `CSAA-003-REQ-142` | Counts SHALL be labeled lower bounds unless completeness is established. |
| `CSAA-003-REQ-143` | Ratios and aggregations SHALL expose numerator, denominator, exclusions, unknowns, and grouping context. |
| `CSAA-003-REQ-144` | Joins SHALL compose predicate truth and each orthogonal epistemic dimension separately and SHALL retain the contributing values and composition rule. |
| `CSAA-003-REQ-145` | A lossy join SHALL disclose dropped unresolved keys or unsupported regions. |
| `CSAA-003-REQ-146` | Timeout, cancellation, truncation, result cap, traversal bound, and budget exhaustion SHALL prohibit unsupported population-wide absence claims. |
| `CSAA-003-REQ-147` | Ranking SHALL NOT imply severity, importance, causal responsibility, or authority. |
| `CSAA-003-REQ-148` | Every Query Result SHALL bind its immutable identity and producing Analysis Run. |
| `CSAA-003-REQ-149` | Every Query Result SHALL retain query version, materialized parameters, one exact Static Semantic Snapshot Identity, zero or one exact Execution Evidence Set Identity, profiles, and provider invocations. |
| `CSAA-003-REQ-150` | Every Query Result SHALL expose supported matches and supported non-matches separately. |
| `CSAA-003-REQ-151` | Every Query Result SHALL expose every affected non-success epistemic region. |
| `CSAA-003-REQ-152` | Every Query Result SHALL expose population, coverage, denominator, budgets, truncation, and ordering. |
| `CSAA-003-REQ-153` | Every material Query Result SHALL carry sufficient witness or explanation for inspection. |
| `CSAA-003-REQ-154` | An empty supported-match set SHALL carry evidence distinguishing supported absence from inability to determine. |

### 18.7 Slicing

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-155` | Every slice SHALL bind an exact graph snapshot. |
| `CSAA-003-REQ-156` | Every slice SHALL identify an exact criterion and semantic location. |
| `CSAA-003-REQ-157` | Every slice SHALL declare forward, backward, or chop direction. |
| `CSAA-003-REQ-158` | Every slice SHALL declare included graph and relation families. |
| `CSAA-003-REQ-159` | Every slice SHALL declare interprocedural and context-sensitivity policy. |
| `CSAA-003-REQ-160` | Every slice SHALL declare alias, dispatch, exception, asynchronous, generated-source, and runtime treatment. |
| `CSAA-003-REQ-161` | Every slice SHALL declare scope, traversal, and resource bounds. |
| `CSAA-003-REQ-162` | Every Slice Result SHALL retain included members and witness paths. |
| `CSAA-003-REQ-163` | Every Slice Result SHALL retain unresolved frontiers and unsupported seams. |
| `CSAA-003-REQ-164` | Every Slice Result SHALL retain excluded regions, conflicts, truncation, and coverage basis. |
| `CSAA-003-REQ-165` | Dynamic calls and reflection SHALL create explicit frontier uncertainty when unresolved. |
| `CSAA-003-REQ-166` | Framework registration and generated-source gaps SHALL create explicit frontier uncertainty when unresolved. |
| `CSAA-003-REQ-167` | Runtime evidence MAY corroborate or add paths but SHALL NOT silently remove static possibilities. |
| `CSAA-003-REQ-168` | Slice exclusion SHALL NOT be represented as proof of irrelevance, non-impact, deadness, or safe removal. |
| `CSAA-003-REQ-169` | Slice invalidation SHALL follow every graph, criterion, profile, resolver, context, runtime, and traversal dependency. |
| `CSAA-003-REQ-170` | Slice results SHALL remain analysis records without finding, gate, or decision authority. |

### 18.8 Semantic comparison

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-171` | Every comparison SHALL bind exact before and after subjects. |
| `CSAA-003-REQ-172` | Every comparison SHALL declare semantic-model and capability-profile compatibility. |
| `CSAA-003-REQ-173` | Every comparison SHALL declare provider and method compatibility where material. |
| `CSAA-003-REQ-174` | Every comparison SHALL declare project, resolver, generated-source, and mapping compatibility. |
| `CSAA-003-REQ-175` | Execution-evidence comparison SHALL declare build, instrumentation, environment, workload, collector, and schema compatibility. |
| `CSAA-003-REQ-176` | Incompatible regions SHALL remain incomparable rather than being forced into a delta. |
| `CSAA-003-REQ-177` | Cross-revision matching SHALL distinguish stable identity from inferred lineage. |
| `CSAA-003-REQ-178` | Ambiguous lineage matches SHALL remain visible. |
| `CSAA-003-REQ-179` | Comparisons SHALL distinguish added, removed, modified, moved, renamed, and reclassified objects. |
| `CSAA-003-REQ-180` | Comparisons SHALL distinguish relation, coverage, health, freshness, provenance, and provider changes. |
| `CSAA-003-REQ-181` | Comparisons SHALL expose conflicting, unknown, and incomparable regions. |
| `CSAA-003-REQ-182` | Textual changes and semantic changes SHALL remain separately identifiable. |
| `CSAA-003-REQ-183` | Configuration, dependency, generated-source, environment, and provider changes MAY be semantic-delta inputs without source-text changes. |
| `CSAA-003-REQ-184` | An empty delta SHALL NOT be represented as proof of behavior preservation. |
| `CSAA-003-REQ-185` | Symmetric comparison classes SHALL invert when before and after are swapped if the method promises invertibility. |
| `CSAA-003-REQ-186` | Non-invertible inference and information loss SHALL be declared. |
| `CSAA-003-REQ-187` | Every comparison record SHALL retain compatibility evidence, lineage method, unmatched regions, raw inputs, run, and explanations. |
| `CSAA-003-REQ-188` | Every comparison record SHALL declare logical invalidation dependencies. |

### 18.9 Change impact and reachability

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-189` | Every impact analysis SHALL begin from an exact Change Seed. |
| `CSAA-003-REQ-190` | Source edit, addition, deletion, move, and rename SHALL be supported seed classes. |
| `CSAA-003-REQ-191` | Semantic-object and relation deltas SHALL be supported seed classes. |
| `CSAA-003-REQ-192` | Contract, declaration, generated-source, dependency, manifest, lockfile, resolver, alias, and conditional-export changes SHALL be supported seed classes. |
| `CSAA-003-REQ-193` | Project, compiler, framework, generator, analyzer, rule, profile, provider, and model changes SHALL be supported seed classes. |
| `CSAA-003-REQ-194` | Build, instrumentation, test-selection, environment, collector, schema, workload, source-map, and evidence invalidation SHALL be supported seed classes. |
| `CSAA-003-REQ-195` | Impact propagation SHALL use named typed relations and declared capability profiles. |
| `CSAA-003-REQ-196` | Every material Impact Candidate SHALL retain a witness path from seed. |
| `CSAA-003-REQ-197` | Impact results SHALL distinguish direct, transitive, runtime-observed, inferred, possible, and unresolved states. |
| `CSAA-003-REQ-198` | Impact results SHALL distinguish not-evaluated, unsupported, stale, and incompatible regions. |
| `CSAA-003-REQ-199` | Not-affected SHALL be asserted only within an explicit closed and completely analyzed basis. |
| `CSAA-003-REQ-200` | Impact results SHALL identify additional evidence or analysis needed to reduce unresolved impact. |
| `CSAA-003-REQ-201` | Possible impact SHALL NOT be represented as certain breakage. |
| `CSAA-003-REQ-202` | Bounded non-impact SHALL NOT be represented as universal safety. |
| `CSAA-003-REQ-203` | Reachability profiles SHALL declare every covered entry mechanism. |
| `CSAA-003-REQ-204` | Uncovered framework, reflection, dynamic-import, event, registration, external, runtime, generated, or configuration entry SHALL remain an explicit frontier. |
| `CSAA-003-REQ-205` | Zero observed static callers SHALL NOT prove dead code or safe removal unless the complete declared reachability precondition is met. |
| `CSAA-003-REQ-206` | Meeting the reachability precondition SHALL produce only a dead-code candidate, not a finding or removal authorization. |
| `CSAA-003-REQ-207` | A test-selection recommendation SHALL NOT prove unselected tests irrelevant. |
| `CSAA-003-REQ-208` | Missing invalidation or dependency edges SHALL NOT prove freshness or non-impact. |
| `CSAA-003-REQ-209` | Every impact result SHALL retain seed, subject, profiles, paths, frontier, coverage, limits, provenance, explanation, and invalidation dependencies. |
| `CSAA-003-REQ-210` | An impact result SHALL NOT be represented as a finding, severity, gate, remediation order, behavior-preservation claim, or approval. |

### 18.10 Provenance, explanation, and information handling

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-211` | Every result SHALL retain exact static and dynamic subject identities. |
| `CSAA-003-REQ-212` | Every result SHALL retain exact capability-profile versions. |
| `CSAA-003-REQ-213` | Every result SHALL retain Analysis Run and provider invocation identity. |
| `CSAA-003-REQ-214` | Every result SHALL retain method, configuration, project variant, and resolver context. |
| `CSAA-003-REQ-215` | Every result SHALL retain input fact, graph, evidence-set, and raw-result references. |
| `CSAA-003-REQ-216` | Every result SHALL retain transformation, enrichment, inference, and comparison lineage. |
| `CSAA-003-REQ-217` | Every result SHALL retain source and generated locations plus mapping health. |
| `CSAA-003-REQ-218` | Every result SHALL retain coverage basis and epistemic state. |
| `CSAA-003-REQ-219` | Every result SHALL retain applicable observation, occurrence, record, and cutoff times. |
| `CSAA-003-REQ-220` | Every result SHALL retain assumptions, conflicts, exclusions, limitations, and invalidation dependencies. |
| `CSAA-003-REQ-221` | A path result SHALL expose a witness path. |
| `CSAA-003-REQ-222` | An absence result SHALL expose closed-population and completeness evidence. |
| `CSAA-003-REQ-223` | An inferred result SHALL expose contributing facts and method. |
| `CSAA-003-REQ-224` | A comparison SHALL expose compatibility reasoning. |
| `CSAA-003-REQ-225` | Redaction SHALL NOT fabricate completeness or hide a materially interpretation-changing omission. |
| `CSAA-003-REQ-226` | Authorization filtering SHALL NOT leak protected existence through counts, paths, graph shape, placeholders, or metadata. |
| `CSAA-003-REQ-227` | Repository and provider material SHALL be treated as untrusted input. |
| `CSAA-003-REQ-228` | Published results SHALL pass the architecture trust boundary before use. |

### 18.11 Failure and degraded operation

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-229` | Missing, invalid, incompatible, and stale configuration SHALL remain distinguishable failure states. |
| `CSAA-003-REQ-230` | Unsupported syntax, semantics, framework convention, and runtime seam SHALL remain distinguishable. |
| `CSAA-003-REQ-231` | Parse, bind, type, resolution, graph, and correlation failures SHALL remain distinguishable. |
| `CSAA-003-REQ-232` | Provider unavailable, crash, malformed output, and contract violation SHALL remain distinguishable. |
| `CSAA-003-REQ-233` | Timeout, cancellation, resource exhaustion, and budget refusal SHALL remain distinguishable. |
| `CSAA-003-REQ-234` | Truncation and pagination cutoff SHALL remain distinguishable from complete evaluation. |
| `CSAA-003-REQ-235` | Mixed-revision and subject mismatch SHALL block silent correlation. |
| `CSAA-003-REQ-236` | Generated-source, map, build, instrumentation, test-selection, coverage, trace, collector, workload, and environment mismatches SHALL remain visible. |
| `CSAA-003-REQ-237` | Comparison incompatibility and ambiguous lineage SHALL remain visible. |
| `CSAA-003-REQ-238` | Authorization, access, confidentiality, and redaction constraints SHALL remain visible without leaking protected content. |
| `CSAA-003-REQ-239` | Invalid provider output SHALL be semantically inert until validated and normalized. |
| `CSAA-003-REQ-240` | Invalid provider output SHALL NOT create success, supported absence, a finding, a gate outcome, or mutation. |
| `CSAA-003-REQ-241` | Failure of a prerequisite capability SHALL NOT become successful emptiness in a dependent capability. |
| `CSAA-003-REQ-242` | A dependent capability SHALL fail, publish a bounded partial result, or exclude the affected region with consequences stated. |
| `CSAA-003-REQ-243` | A partial result SHALL identify completed work, missing work, affected regions, and epistemic consequences. |
| `CSAA-003-REQ-244` | A partial result SHALL identify its invalidation dependencies. |
| `CSAA-003-REQ-245` | A last-known-good result MAY support labeled historical inspection only. |
| `CSAA-003-REQ-246` | A last-known-good result SHALL NOT be presented as current. |

### 18.12 Invalidation and incremental equivalence

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-247` | Every result SHALL declare logical invalidation inputs and dependencies. |
| `CSAA-003-REQ-248` | Repository, revision, working change, content, and artifact-classification changes SHALL invalidate dependent results. |
| `CSAA-003-REQ-249` | Project, compiler, resolver, condition, alias, declaration, and ambient-context changes SHALL invalidate dependent results. |
| `CSAA-003-REQ-250` | Manifest, lockfile, dependency, generator, adapter, framework, and generated-output changes SHALL invalidate dependent results. |
| `CSAA-003-REQ-251` | Capability profile, provider, method, model, rule input, and analysis-configuration changes SHALL invalidate dependent results. |
| `CSAA-003-REQ-252` | Build, instrumentation, test selection, coverage denominator, map, trace schema, collector, workload, and environment changes SHALL invalidate dependent results. |
| `CSAA-003-REQ-253` | Population, traversal, budget, query-definition, access, and redaction changes SHALL invalidate dependent results. |
| `CSAA-003-REQ-254` | Upstream fact, graph, enrichment, inference, comparison, and evidence-set changes SHALL invalidate dependent results. |
| `CSAA-003-REQ-255` | An unresolved invalidation dependency SHALL prevent a currentness claim. |
| `CSAA-003-REQ-256` | Refresh SHALL create a successor and preserve the prior result historically. |
| `CSAA-003-REQ-257` | Logical invalidation semantics SHALL remain separate from physical recomputation and scheduling. |
| `CSAA-003-REQ-258` | Incremental results SHALL be compared with clean full analysis of the same exact subject. |
| `CSAA-003-REQ-259` | Incremental/full comparison SHALL use the same semantic profiles and compatible provider methods. |
| `CSAA-003-REQ-260` | Equivalence SHALL compare semantic result sets and epistemic states. |
| `CSAA-003-REQ-261` | Equivalence SHALL compare coverage, provenance, conflicts, and failures. |
| `CSAA-003-REQ-262` | Equivalence SHALL compare material explanations and witness paths. |
| `CSAA-003-REQ-263` | Any permitted incremental/full difference SHALL be profile-declared. |
| `CSAA-003-REQ-264` | Incremental/full equivalence SHALL be verified against an independently owned oracle. |

### 18.13 Trust, resources, and mutation boundary

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-265` | Analysis SHALL be read-only by default. |
| `CSAA-003-REQ-266` | Inspection SHALL NOT execute repository scripts or imported code implicitly. |
| `CSAA-003-REQ-267` | Inspection SHALL NOT install or update dependencies. |
| `CSAA-003-REQ-268` | Inspection SHALL NOT call undeclared network services. |
| `CSAA-003-REQ-269` | Inspection SHALL NOT generate into or mutate the repository. |
| `CSAA-003-REQ-270` | Analysis SHALL NOT alter source, configuration, tests, fixtures, oracle content, baselines, decisions, exceptions, or gates. |
| `CSAA-003-REQ-271` | Analysis SHALL NOT expand subject or access scope implicitly. |
| `CSAA-003-REQ-272` | Authorized execution-evidence collection SHALL remain a separately identified operation under the execution lane. |
| `CSAA-003-REQ-273` | Resource refusal, timeout, or truncation SHALL be represented as degraded outcome rather than empty answer. |
| `CSAA-003-REQ-274` | Resource pressure SHALL NOT silently lower coverage or switch semantic profiles. |

### 18.14 Verification, downstream allocation, and candidate acceptance

| ID | Requirement |
| --- | --- |
| `CSAA-003-REQ-275` | All thirty-two `JAN-CSAA-000` §10.3 source requirements SHALL be imported and reconciled individually. |
| `CSAA-003-REQ-276` | Applicable canon, `JAN-CSAA-001`, and `JAN-CSAA-002` requirements SHALL be imported individually rather than by aggregate citation. |
| `CSAA-003-REQ-277` | All thirty-two capability profiles SHALL be checked against all twenty-eight required facets. |
| `CSAA-003-REQ-278` | Query semantics SHALL be verified with truth tables covering true, false, unknown, conflict, negation, quantifiers, joins, aggregation, and truncation. |
| `CSAA-003-REQ-279` | Slicing SHALL be verified with forward, backward, and chop cases including dynamic and unsupported frontiers. |
| `CSAA-003-REQ-280` | Comparison SHALL be verified with identical, changed, incompatible, ambiguous-lineage, and swapped-subject cases. |
| `CSAA-003-REQ-281` | Impact SHALL be verified with direct, transitive, configuration, generated, framework, reflection, and runtime cases. |
| `CSAA-003-REQ-282` | Verification SHALL include a zero-static-callers case that remains inconclusive for deadness when any applicable entry mechanism is unresolved. |
| `CSAA-003-REQ-283` | Provenance verification SHALL reconstruct every sampled result to exact inputs and raw provider material. |
| `CSAA-003-REQ-284` | Failure verification SHALL prove that skipped, failed, timed-out, malformed, and partial work cannot become empty or green. |
| `CSAA-003-REQ-285` | Invalidation verification SHALL cover edit, rename, move, configuration, dependency, provider, and evidence changes. |
| `CSAA-003-REQ-286` | Incremental/full equivalence SHALL receive later executable evidence from `JAN-CSAA-008` and operational evidence from `JAN-CSAA-009`. |
| `CSAA-003-REQ-287` | Downstream allocations to `JAN-CSAA-004` and `JAN-CSAA-006` through `JAN-CSAA-011` SHALL be complete and non-overlapping by concern. |
| `CSAA-003-REQ-288` | Author self-review SHALL answer every applicable `JAN-CSAA-000` §17 adversarial question and preserve failures as findings. |
| `CSAA-003-REQ-289` | Proposed eligibility SHALL require a closed ledger, resolved blocking findings, completed self-review, exact freeze, and no false executable claim. |
| `CSAA-003-REQ-290` | Normative eligibility SHALL additionally require independent adversarial review, distinct integrity/provenance validation, final implementation reconciliation, and exact-member conferral. |

---

## 19. Verification and later-allocation matrix

### 19.1 Historical `0.1.0` as-authored method declaration

| Method | Subject | Required evidence | Historical `0.1.0` declared state |
| --- | --- | --- | --- |
| `JAN-CSAA-003-VER-CTL-001` | Metadata, lifecycle, authority, exact inputs, links | Reproducible identity, lifecycle, link, and authority audit | `NOT_RUN` |
| `JAN-CSAA-003-VER-SRC-001` | `JAN-CSAA-000` §10.3 | Bidirectional mapping of `CSAA-000-REQ-274` through `305` | `NOT_RUN` |
| `JAN-CSAA-003-VER-CPF-001` | Capability profiles | Mechanical `32 × 28 = 896` facet-cell completeness matrix | `NOT_RUN` |
| `JAN-CSAA-003-VER-CAP-001` | Capability catalog | Coverage and composite-source mapping review | `NOT_RUN` |
| `JAN-CSAA-003-VER-SEM-001` | Cross-document semantics | Review against `JAN-CSAA-002` graph, epistemic, lifecycle, and invariant meanings | `NOT_RUN` |
| `JAN-CSAA-003-VER-QRY-001` | Query algebra | Truth tables and metamorphic cases | `NOT_RUN` |
| `JAN-CSAA-003-VER-SLC-001` | Slicing | Forward/backward/chop and frontier scenarios | `NOT_RUN` |
| `JAN-CSAA-003-VER-DLT-001` | Comparison | Identical, delta, incompatibility, lineage, and inversion scenarios | `NOT_RUN` |
| `JAN-CSAA-003-VER-IMP-001` | Change impact | Direct/transitive/configuration/generated/dynamic-entry scenarios | `NOT_RUN` |
| `JAN-CSAA-003-VER-PRV-001` | Provenance | Result-to-input and raw-evidence reconstruction | `NOT_RUN` |
| `JAN-CSAA-003-VER-DEG-001` | Failure | No-false-empty/no-false-green matrix | `NOT_RUN` |
| `JAN-CSAA-003-VER-INV-001` | Invalidation/equivalence | Logical dependency review and later full/incremental scenario allocation | `NOT_RUN` |
| `JAN-CSAA-003-VER-XPK-001` | Concern ownership | Cross-package ownership and allocation audit | `NOT_RUN` |
| `JAN-CSAA-003-VER-SELF-001` | Author self-review | All eighteen `JAN-CSAA-000` §17 questions | `NOT_RUN` |
| `JAN-CSAA-003-VER-INTEGRITY-001` | Candidate identity | Exact bytes, digest, requirement counts, links, evidence continuity | `NOT_RUN` |

### 19.2 Later executable evidence

| Evidence need | Owner | Current meaning |
| --- | --- | --- |
| Independently reviewed scenario judgments | `JAN-CSAA-006` | `DOCUMENTED / NOT_CONFERRED / NOT_EXECUTED`; individual expected judgments remain `PROPOSED / NOT_CONFERRED / NOT_EXECUTED` |
| Exact profile, query, result, and error shapes | `JAN-CSAA-007@1.0.1 / Draft` | Documentation specification authored; executable schemas, generated derivatives, and adapters remain unmaterialized and unexecuted |
| Executable requirement and property conformance | `JAN-CSAA-008@0.2.2 / Draft` | Documentation specification authored; executable conformance remains `NOT_RUN` |
| Persistence, recovery, and incremental/full operational evidence | `JAN-CSAA-009@0.2.1 / Draft` | Documentation design authored; mechanism selection, implementation, and operational evidence remain `NOT_RUN` |
| Coding-agent use and stop/escalation evidence | `JAN-CSAA-010` | Not performed |
| Concrete provider differential qualification | `JAN-CSAA-011` | Not performed |

The fifteen `NOT_RUN` values above are preserved as the exact `0.1.0` as-authored declaration; they are not a current-state assertion. The predecessor ledger and `JAN-CSAA-003-VERIFICATION-001@0.1.2` control the bounded predecessor objective result. Changed `0.1.1` bytes inherit no green state: every current objective row and method begins `NOT_RUN` in the corrective OPEN successor ledger until direct-current evidence supports a transition. No `NOT_RUN` row is green, satisfied, waived, or complete.

---

## 20. Open alternatives and safe defaults

| Alternative | Options | Safe default while unresolved |
| --- | --- | --- |
| Query expression | Named catalog; typed traversal algebra; declarative graph patterns | Define conceptual algebra only; exact syntax belongs to `JAN-CSAA-007` |
| World assumption | Open; locally closed | Open-world unless exact population and complete coverage are proven |
| Cross-revision matching | Stable ID; structural match; history-assisted lineage | Bounded lineage inference with ambiguity visible |
| Call-graph sensitivity | Context-insensitive through path-sensitive variants | Profile-declared; unresolved dynamic targets visible |
| Data-flow/taint sensitivity | Flow, path, field, object, context combinations | Declare each dimension separately; never imply whole-program completeness |
| Graph composition | Materialized CPG; virtual composition | Logical view preserving contributing-layer provenance |
| Static/runtime combination | Union; runtime pruning; separate lanes | Runtime may corroborate or add observations; it cannot silently prune static possibilities |
| Slice interpretation | May-slice; must-slice; mixed | Conservative may-slice with unresolved frontier |
| Confidence | Scalar; ordinal; evidence profile | No uncalibrated scalar; confidence never substitutes for evidence |
| Coverage comparison | Strict identity; mapped compatibility | Incomparable until denominator, target, provider, granularity, selection, and mapping compatibility are shown |
| Architecture discovery | Single clustering; competing candidates | Multiple candidate interpretations with evidence and limits |
| Provider/profile comparison | Native normalization; compatibility mapping | Incomparable until semantic compatibility evidence exists |
| Incremental equivalence | Set equality; observational equivalence | Semantic set and epistemic equivalence plus declared ordering/inference limits |
| Last-known-good use | Current fallback; historical reference | Historical inspection only |
| Truncated results | Best effort; local partial result | Local partial result only; no population-wide absence inference |

---

## 21. Draft acceptance state

The exact `0.1.0` predecessor received bounded objective verification and named-commission ledger closure, then its preliminary author self-review found `JAN-CSAA-003-SR-001 / MAJOR` and `JAN-CSAA-003-SR-002 / MINOR`. Those event-time records remain true only for their exact predecessor surfaces.

This correction-only `0.1.1` Draft addresses the mixed lifecycle presentation and the 96 capability-vector delimiter defects while retaining all 290 local requirements and every later executable or lifecycle nonpass. Because its bytes changed, it carries no inherited objective PASS. Before this successor can complete author review or become an exact Proposed candidate:

1. every `JAN-CSAA-000` §10.3 obligation and all 290 local requirements must reproduce bidirectionally;
2. all thirty-two profiles must pass the exact 28-facet, 896-cell, 864-internal-delimiter audit;
3. direct-current corrective objective verification and ledger closure must bind the exact `0.1.1` bytes;
4. affected cross-package reconciliation must bind every changed exact input and downstream consumer without rewriting historical reviewed bytes;
5. the full planned documentation corpus must be authored and internally assured;
6. the one consolidated implementation refresh and affected repository-currentness reconciliation must then be performed;
7. all eighteen author-review questions must be rerun against the resulting exact candidate, with no blocker or MAJOR finding remaining; and
8. only then may an exact Draft freeze and Proposed transition be recorded without claiming executable fixture, oracle, provider, or implementation evidence.

Corrective objective verification, cross-package reconciliation, final implementation refresh, completed author self-review, exact freeze, Proposed standing, independent assurance, implementation, and authority are all unperformed by this off-path candidate.

---

## 22. Closing analysis rule

An analysis is trustworthy only to the extent that its exact subject, method, coverage, provenance, uncertainty, and failure boundary remain inspectable.

No match is a finding by itself. No absence is knowledge without a closed and completely analyzed basis. No inferred impact is authority. No green representation may conceal work that was unsupported, stale, incomplete, failed, or never run.
