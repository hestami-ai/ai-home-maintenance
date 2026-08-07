# Codebase Semantic Analysis and Assurance Architecture

## Tool-neutral capability architecture, responsibility boundaries, flows, trust boundaries, and degraded operation

**Document ID:** `JAN-CSAA-001`

**Canonical title:** Codebase Semantic Analysis and Assurance Architecture

**Version:** `0.3.1`

**Status:** Draft

**Settledness:** HYPOTHESIS

**Classification:** Prepared controlled-CSAA member candidate; non-authoritative Draft. `JAN-CSAA-000@0.3.0` remains the adopted authority and manifest baseline, while `JAN-CSAA-WORKING-STATUS-001` carries non-authoritative construction state. No interim README carriage or sponsor response is a continuation or promotion predicate

**Governing status:** Documentation preparation was activated by `JPWB-REG-005 REG-D-018` and is continued for every documentation subphase by `REG-D-021` as corrected by `REG-D-022`; this document has no member authority

**Role:** Tool-neutral logical architecture for converting an identified repository subject into revision-bound semantic and execution evidence without allowing tools, topology, or derived results to acquire authority

**Authority:** None. `REG-D-018`, as extended by `REG-D-021` and corrected by `REG-D-022`, authorizes documentation-only preparation, reconciliation, objective gate closure, Draft-to-Proposed promotion, and post-Proposed review and validation. Only an individual exact-member `JPWB-REG-005` conferral within the final exact-corpus transaction can make a revision Normative

**Scope:** Logical responsibilities, end-to-end information flows, trust boundaries, degraded behavior, observability obligations, quality objectives, and unresolved architecture alternatives for CSAA

**Applicability:** The manifest-resolved TypeScript, JavaScript, and TypeScript-bearing Svelte subject defined by `JAN-CSAA-000`, plus later subjects only when separately commissioned

**Governs:** While Draft, nothing with program authority. Candidate concern allocation: CSAA logical system context, responsibility allocation, end-to-end flows, trust boundaries, degraded behavior, observability, quality objectives, and provider-neutral architecture alternatives

**Does not govern:** Semantic-object meanings or exact identities; current repository facts; extraction, query, or change-impact algorithms; analysis-rule or repository-gate meaning; provider qualification; exact schemas or APIs; fixture judgments; executable conformance; physical persistence, migration, or operations; coding-agent employment procedure; concrete providers, deployment, or topology; implementation permission

**Parent and inherited authorities:** `JAN-CSAA-000@0.3.0`, `JPWB-CON-000@1.3.0`, `JPWB-DOC-001@1.1.0`, `JPWB-DOC-002@1.2.0`, `JPWB-DOC-003@1.3.0`, `JPWB-DOC-004@1.3.0`, and `JPWB-REG-005@1.0.0 REG-D-018`, `REG-D-021`, and `REG-D-022`, each only for its owned concern

**Precedence and conflict routing:** Canon and recognized enforced reference artifacts retain concern ownership. The `JAN-CSAA-002@0.3.1` Draft candidate owns provider-independent code-semantic identity prospectively; the `JAN-CSAA-003@0.1.1` Draft candidate owns analysis and query semantics prospectively; the `JAN-CSAA-004@0.1.1` Draft candidate owns technical rule, finding, provider, and repository-gate semantics prospectively; the `JAN-CSAA-005@0.3.1` Draft candidate owns current JPWB facts prospectively and only through its declared evidence/currentness boundary. Apparent conflicts are recorded and routed to `JPWB-REG-005`; these non-authoritative Draft candidates do not silently resolve them

**Requirement ledger:** [JAN-CSAA-001 Requirement Ledger](<records/JAN-CSAA-001 - Requirement Ledger.md>)

**Verification owner:** The author/integrator owns extraction, ledger-closure evidence, and author self-review. A distinct adversarial reviewer owns Proposed-candidate semantic review, and a distinct integrity/provenance validator owns exact-identity and evidence-continuity validation. The final decision authority and ministerial recorder are also distinct identities. None except the final decision authority can confer Normative status, and the recorder cannot supply or reinterpret judgment

**Change authority and procedure:** Authors may revise this Draft under `REG-D-018` as extended by `REG-D-021` and corrected by `REG-D-022`. Advancement to Proposed requires requirement-ledger closure, completed author self-review, resolution of blocking findings, and an exact candidate freeze. Proposed status is followed by independent adversarial review and distinct integrity/provenance validation. Every candidate-byte change after an exact review freeze triggers affected re-review except an exact pre-frozen administrative substitution set that names its operations and source/result digests, causes no semantic or judgment change, and is independently replayed, independently result-validated, and ministerially recorded against exact predicates. Normative status requires an individual exact-member `JPWB-REG-005` sponsor conferral in the one final itemized corpus transaction

**Review and evidence companions:** Requirement ledger above; historical [JAN-CSAA-005-EVIDENCE-004@0.1.0](<records/JAN-CSAA-005 - Current Subject Rebinding Record.md>) — 5,735 bytes / `534ddd0cd3146fdf7b4b7e823a84b0a3b7409c0f04efadf1a1d156a54e59ecd1` — supplies no current-use claim; dated-only [JAN-CSAA-005-EVIDENCE-007@0.1.0](<records/JAN-CSAA-005 - Current Subject Rebinding Record 004.md>) — 11,582 bytes / `63b1e06287dcaf993bffecc20164227567c5248a8616650f3a5cc5e2538f95a7` — supplies only the OBS-035/036 authoring baseline; [JAN-CSAA-005-EVIDENCE-008@0.1.0](<records/JAN-CSAA-005 - Non-Blocking External Drift and Authoring Baseline Record.md>) — 6,952 bytes / `d2cba1614aea77a720cac597ed9f6faeda266a854022b6f3c1fa956dae869532` — controls intermediate documentation authoring only, and the consolidated final implementation refresh remains open; exact historical predecessor evidence consists of [VERIFICATION-001](<records/JAN-CSAA-001 - Objective Author Verification Record.md>) — 8,499 bytes / `3ea9ca194b0902ad693b4f6d157443db50c195aa291fcdf39ee2552c4c948a09`, [VERIFICATION-002](<records/JAN-CSAA-001 - Objective Author Verification Record 002.md>) — 9,298 bytes / `934bafa753153a7f2528f5bee97f535954918eb9a72342c0405fc3282e785d88`, [Wave 1 reconciliation 002](<records/JAN-CSAA-W1 - Wave 1 Cross-Package Objective Reconciliation Record 002.md>) — 10,321 bytes / `1a7f970353db9dd70faf23c1de05193b348459458b6438303e82250692fc2515`, and [Wave 1 ledger closure](<records/JAN-CSAA-W1 - Synchronized Ledger Closure and Integrity Record.md>) — 10,112 bytes / `fd00ccd99cc59f71e6d485f3fc2176960f350dd037e808f49180c283dced0ccf`; the [preliminary author self-review](<records/JAN-CSAA-001 - Author Self Review.md>) — 12,799 bytes / `d3d78dc0891f54a27b0b4bf35e61bedbed1976017a5b4c212f1d573b91381696` — records `JAN-CSAA-001-SR-001 / MAJOR` and `JAN-CSAA-001-SR-002 / MINOR` as nonpasses against the exact 0.3.0 predecessor; corrective objective verification, affected cross-package reconciliation, corrective author self-review, consolidated final implementation refresh, exact Proposed freeze, Proposed-candidate review, and integrity/provenance validation remain separate open acts

**Companion enforced artifacts:** None created or selected by this Draft. Existing repository configuration and tests are revision-bound evidence cataloged by `JAN-CSAA-005`, not CSAA implementation

**Conformance-test references:** The documentation subphases for `JAN-CSAA-006` through `JAN-CSAA-008` are commissioned by `REG-D-021`; executable fixtures, oracle judgments, schemas, types, tests, conformance suites, and results remain unperformed and separately unauthorized under `REG-D-022`

**Audience:** Coding-agent designers, software architects, assurance engineers, security reviewers, tool integrators, implementers, and maintainers

**Background:** [JAN-CSAA-000](<README.md>); [Initial Chat](<Initial Chat.md>)

**Structural exemplar:** [Recursive Professional Harness document-set README](<../Recursive Professional Harness/README.md>)

**Supersedes:** `JAN-CSAA-001@0.3.0 / Draft`, 109,420 bytes, SHA-256 `cda7defe7fa310f912bceb8b355952e1159bebc05528fc51c310578ede26237b`; preservation target `records/archive/JAN-CSAA-001@0.3.0.Draft.PRE-SR-001-SR-002-CORRECTION.snapshot`

**Version-classification rationale:** The exact `JAN-CSAA-000@0.3.0` charter §9.1 requires `MAJOR.MINOR.PATCH` form but assigns no content-to-bump classification, while exact `JAN-CSAA-W3-SEMANTIC-READINESS-001@0.1.0` §8 step 2 expressly commissions bounded versioned corrections and affected reruns for 001–006. `PATCH` is compatible because `CSAA-001-FLW-025` atomizes and makes testable an existing mandatory partiality and dynamic-reachability safeguard rather than adding semantic policy: `FLW-008` requires every perimeter region to remain explicitly partial or otherwise bounded, `FLW-017` requires an explicitly partial or non-current publication when completeness is unavailable, `DEG-002` prohibits partial or incomplete regions from collapsing into an empty finding set, and `DEG-021`/`DEG-022` prohibit those regions from producing a passing or unqualified-green result. `SR-002` identified that the zero-static-callers case was not explicit enough, so `FLW-025` makes that already-required no-false-green consequence independently dispositionable and testable without adding a concern, capability, provider, authority, implementation permission, algorithm selection, execution state, or permitted behavior. This successor remains a non-authoritative Draft, and the exact Normative charter contains no `FLW-025` consumer. `CSAA-001-CTL-002` changes only its controlled self-version literal from `0.3.0` to `0.3.1`. The exact W3 readiness record is 32,042 bytes / SHA-256 `a7ba3d47c912bc737267f9f70998587fd16b34e541772cfd2ad4bddbadaaff49`; if any cited predecessor predicate, Normative-consumer check, or readiness identity fails to reproduce, candidate construction fails closed.

**Affected-readiness binding:** [`JAN-CSAA-W4-AUTHORITY-READINESS-INPUT-DRIFT-RECONCILIATION-002@0.1.0`](<records/JAN-CSAA-W4 - Affected Authority Readiness Input Drift Reconciliation Record 002.md>) — 16,087 bytes / SHA-256 `2478ffc8e6971e2c82c9a1ca455142b672fb5edb60335599907544e6eea4c83c` — is the exact generation anchor consumed from `.codex_tmp_JAN-CSAA-W4-AUTHORITY-READINESS-INPUT-DRIFT-RECONCILIATION-002@0.1.0.section-hardened.candidate.md`; its prospective stable path is `records/JAN-CSAA-W4 - Affected Authority Readiness Input Drift Reconciliation Record 002.md`. It records `PASS_BOUNDED_FOR_CSAA_STANDING_AUTHORITY_ONLY` on branch `SECOND_KNOWN_POST_W3_EXTERNAL_DRIFT_BOUNDED_FOR_CSAA_AUTHORITY` against current `JPWB-REG-005` at 140,469 bytes / SHA-256 `f19d1e22161a05a42cb55c195b8dbb507b0dda4f4f0fe4eacf334165fa97042e`, including the exact D021/D022/D023 section guards and all twelve `W4-ADR2-P-001` through `W4-ADR2-P-012` standing-authority and no-expansion predicates rechecked before construction and immediately before candidate write or exact reuse. This exact 002 record remains the generation anchor. A later numbered authority-readiness successor may continue this publication-time binding only when both the publisher and an independent validator exact-bind that successor, the then-current whole-register byte count and SHA-256, these same exact D021/D022/D023 section byte counts and SHA-256 digests, and all twelve W4-ADR2 predicates, while proving that the successor has no generated-content, requirement-population, arithmetic, correction-objective, ledger-transition, lifecycle, or assurance-conclusion effect; every other later register identity or failed predicate SHALL block publication.

**Superseded by:** None

**Normative keywords:** SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY. Their meanings and the non-normative treatment of examples are inherited from `JAN-CSAA-000@0.3.0` §5

---

## 1. Purpose

This Draft defines the logical architecture of a future CSAA capability. It answers one architectural question:

> What responsibilities and trust boundaries are required to turn an exact repository subject into inspectable semantic and execution evidence without hiding partiality, changing the subject, or allowing a provider result to become authority?

The architecture is intentionally independent of a storage engine, graph database, compiler wrapper, analyzer portfolio, workflow engine, daemon, service boundary, IDE, or user interface. Those choices are not authorized in Wave 1.

The intended consumers are coding agents and human engineers who need evidence for design, planning, implementation, verification, and validation. The capability informs those activities; it does not perform governance, approve exceptions, promote baselines, or mutate source.

---

## 2. Concern ownership and document boundary

| Concern | Semantic owner | Treatment in this document |
| --- | --- | --- |
| Program scope, source-of-truth distinctions, commissions | `JAN-CSAA-000` | Inherited and cited |
| Logical responsibilities, flows, trust boundaries, degraded behavior | `JAN-CSAA-001` candidate | Defined here |
| Code-semantic objects, relationships, identity, provenance, invariants | `JAN-CSAA-002@0.3.1` Draft candidate | Referenced as the non-authoritative semantic contract; no implementation or authority is conferred |
| Extraction, enrichment, query, slicing, change impact | `JAN-CSAA-003@0.1.1` Draft candidate | Logical service boundary; non-authoritative specification exists; execution remains separate |
| Analysis rules, technical findings, providers, repository gates | `JAN-CSAA-004@0.1.1` Draft candidate | Logical boundary; non-authoritative specification exists; provider execution and gate authority remain separate |
| Current JPWB repository facts and observed tooling | `JAN-CSAA-005@0.3.1` Draft candidate | Referenced as revision-bound, non-authoritative evidence; no continuously live-current claim is made |
| Golden fixture judgments | `JAN-CSAA-006@0.1.1` Draft candidate | Non-authoritative fixture/oracle-governance specification exists; no fixture or oracle is conferred or executed |
| Exact schemas, APIs, error shapes, adapters | `JAN-CSAA-007@1.0.1` Draft candidate | Non-authoritative machine-contract specification exists; no executable contract or implementation authority |
| Executable conformance and V&V | `JAN-CSAA-008@0.2.2` Draft candidate | Non-authoritative conformance specification exists; executable validation remains unperformed and separately authorized |
| Persistence, incremental recomputation, recovery, operations | `JAN-CSAA-009@0.2.1` Draft candidate | Non-authoritative design exists; no physical selection, implementation, or operational execution |
| Coding-agent employment procedure | Reserved `JAN-CSAA-010` and `JPWB-DOC-004` by concern | Consumer boundary only |
| Concrete provider qualification and integration | Reserved `JAN-CSAA-011` | Provider boundary only |

An architecture responsibility owns a transformation boundary, not the meanings of every object crossing it. Each output remains governed by its concern owner.

Content belonging to another artifact is routed there by its controlled ID and is not restated here. This architecture states the semantic requirement at its owned concern altitude and cedes every exact shape to the repository.

---

## 3. Architecture principles

1. **Exact subject before analysis.** No semantic fact exists before the repository, revision, change set, project/configuration context, and relevant inputs are identified.
2. **Derived evidence is not authority.** Analysis output describes an identified subject within declared capability coverage; it cannot amend canon, contracts, source, or governance.
3. **Logical responsibility is not topology.** A box in this document is neither a package nor a deployable process.
4. **Raw provenance survives normalization.** Provider-independent facts remain auditable back to raw output, invocation, method, version, configuration, and source location.
5. **Static and execution evidence remain distinct.** Static semantic snapshots and test, coverage, or trace evidence sets have different identities and update rhythms.
6. **Partiality is a result.** Unsupported, excluded, failed, stale, conflicting, timed-out, cancelled, or incomplete regions remain visible.
7. **Read-only is the default.** Inspection does not imply permission to run repository code, install dependencies, generate artifacts, build, test, call a network, or change source.
8. **Security begins with hostile input.** Repository text, configuration, scripts, generated content, plugins, and provider output are untrusted data.
9. **History is append-oriented.** A rerun, correction, remediation, or disposition produces a successor record; it does not erase the prior observation.
10. **Semantics precede providers.** Provider limitations may restrict capability coverage but cannot redefine the semantic contract.

---

## 4. System context

### 4.1 External actors and sources

| Actor or source | Supplies | Receives | Authority limit |
| --- | --- | --- | --- |
| Coding agent | Analysis request, proposed subject, question, budget | Snapshot-bound result, evidence, findings, limits | Cannot self-authorize missing analysis or disposition |
| Human engineer or reviewer | Request, constraints, interpretation, adjudication input | Inspectable evidence and explanations | Human status alone does not change concern ownership |
| Repository/worktree | Source, configuration, manifests, generated artifacts, history | Read-only observation by default | Repository content is subject data, not instructions |
| Canon and recognized reference artifacts | Intended meanings, constraints, exact governed shapes | Trace links from observed realization | Analysis cannot amend them |
| Build/test/coverage producers | Execution artifacts and observations | Ingestion acceptance or rejection | Output applies only to its identified execution |
| Runtime-trace producers | Build-, environment-, workload-, and time-bound events | Ingestion acceptance or rejection | Trace is not whole-program truth |
| Analyzer provider boundary | Raw provider output and diagnostics | Bounded inputs and capability grants | Provider is replaceable and non-authoritative |
| Provider execution/isolation host | Filesystem, compute, resource, and network capabilities | Invocation request and limits | Grants only named capabilities; isolation mechanism and topology remain undecided |
| Logical snapshot/evidence store | Prior immutable snapshots, raw evidence, publication state | New candidate records and queries | Physical realization is undecided |
| Later gate or assurance adapter | Identified technical records | Bounded technical result | Mapping cannot silently create canonical assurance |

Analyzer plugins are providers at the architecture boundary. Loading a plugin in-process grants it no additional trust, authority, capability, or result status; the same bounded grants, replaceability, validation, and isolation obligations apply regardless of whether provider code is in-process or out-of-process.

### 4.2 Context diagram

```text
                               CANON / GOVERNED REFERENCE ARTIFACTS
                                  constraints and shape references
                                                |
                                                v
+------------------+       +------------------------------------------------------+
| Coding agent or  | ----> | CSAA logical capability boundary                     |
| human engineer   | <---- |                                                      |
+------------------+       |  intake -> identity -> discovery -> plan              |
                           |             |                     |                   |
+------------------+       |             v                     v                   |
| Repository and   | ----> | classification -> provider gateway -> raw capture     |
| working tree     |       |                              |                        |
+------------------+       |                              v                        |
                           | execution evidence -> validation/normalization        |
+------------------+       |                              |                        |
| Build, test,     | ----> | semantic snapshot + execution-evidence-set candidate  |
| coverage, traces |       |                              |                        |
+------------------+       |                       publication boundary             |
                           |                              |                        |
+------------------+       |                              v                        |
| Provider         | <---- | snapshot-bound query, impact, evidence and findings   |
| execution edge   | ----> |                                                      |
+------------------+       +------------------------------------------------------+
                                                |
                                                v
                               LATER GATE / ASSURANCE ADAPTERS
```

The outer CSAA box is a logical boundary. It does not state whether responsibilities execute in one process, multiple processes, a local host, a service, or a mixture.

---

## 5. Logical responsibility model

| Logical responsibility | Inputs | Primary outputs | Trust crossing and permitted side effects | Required degraded result | Semantic or later owner |
| --- | --- | --- | --- | --- | --- |
| Request intake | Question, proposed subject, requested capabilities, budget, caller authority | Accepted or refused analysis intent | No repository execution; records request metadata | Explicit refusal with reason | `001`; employment rules later `010` |
| Subject acquisition and identity | Repository locator, VCS/worktree state, change set, requested perimeter | Reproducible subject identity | Read-only by default | No snapshot when identity is insufficient | Identity semantics `002` |
| Workspace/project discovery | Root manifest, package manifests, lockfile, project configs | Workspace/package/project/configuration map | Parse data; do not execute config or lifecycle hooks | Unresolved regions remain partial or unsupported | `001` responsibility; objects `002`; current map `005` |
| Source classification | Discovered files and project membership | Authored/generated/virtual/test/config/vendor/excluded classifications plus generated/virtual-to-authored origin mappings | Read metadata and content; never relabel generated or virtual material as authored | Unclassified inputs and unresolved origin mappings remain visible | Class and origin meanings `002` |
| Capability planning | Subject map, requested questions, provider declarations, budgets | Dependency-aware analysis plan | No analysis side effects | Unscheduled/skipped capabilities recorded | Analysis semantics later `003` |
| Provider execution gateway | Bounded inputs, capability grant, plan step | Invocation record, raw output, diagnostics, health | Capability-bounded execution/isolation boundary; mechanism undecided; bounded output only | Crash, timeout, malformed output, denial, cancellation | Provider contract later `004`/`011` |
| Static semantic extraction | Identified project/artifacts and provider invocation | Raw syntax, binding, type, dependency, call, control/data facts | Provider execution through gateway | Bounded partial result; never invented completeness | Object meanings `002`; algorithms later `003` |
| Test/coverage ingestion | Test/run/result/coverage artifacts and provenance | Execution evidence candidates | Read identified artifacts | Reject/quarantine incompatible provenance | Objects `002`; contracts later `007` |
| Runtime-trace ingestion | Build, environment, workload, schema, collector, trace artifacts | Runtime evidence candidates | No live collection without separate authority | Reject/quarantine incompatible or incomplete trace | Objects `002`; operations later `009` |
| Raw-result capture | Invocation output and diagnostics | Immutable or content-addressed raw reference | Writes only to bounded analysis output | Capture failure blocks normalized provenance claims | Exact shape later `007` |
| Validation and normalization | Raw results, provider declaration, semantic contract | Provider-independent facts, diagnostics, conflicts | No source mutation | Invalid output semantically inert; disagreement preserved | Semantics `002`; provider rules later `004` |
| Graph composition | Normalized facts and typed relations | Revision-consistent logical graph views | Derived analysis state only | Partial graph labeled by capability coverage | Semantics `002`; algorithms later `003` |
| Invalidation planning | Published identities, dependency records, configuration/build/source-origin relations, and observed changes | Explicit affected-set decision, invalidation dependencies, retained uncertainty, and full-or-broadened reanalysis requirement | Derived planning state only; cannot mutate a prior publication | Unresolved dependency broadens the affected set and prevents a currentness claim | `001` responsibility; dependency and freshness semantics `002`; operational recomputation later `009` |
| Snapshot/evidence publication | Validated candidate, health, coverage, provenance | Published snapshot/evidence-set revision or refusal | Atomic logical publication; mechanism undecided | Prior publication remains distinct from failed candidate | Persistence later `009` |
| Technical record normalization | Facts, rule results, evidence references | Engineering Evidence Record and Analyzer Finding Record candidates | Append-oriented logical history | No mutation into green; invalid record rejected | Record meanings later `004` |
| Query/change-impact service | Declared snapshot(s), evidence-set identity, bounded query | Result, explanation, provenance, limits | Read published state | Partial/stale/conflicting result, not an overclaim | Query semantics later `003` |
| Agent/human interface | Results, findings, health, coverage | Inspectable report and references | Presentation only | Cannot confer approval, waiver, or assurance | Employment later `010`; UI not selected |
| Security/confidentiality/retention | Subject classification, grants, policy inputs | Capability decisions, redaction/retention records | Deny by default | Refuse unsafe expansion | `001`; exact controls later |
| Observability/recovery | Run/invocation events, health, publication records | Reconstructable run history and recovery intent | Diagnostic output with redaction | Recovery never relabels or duplicates history | Operations later `009` |

---

## 6. End-to-end data flow

```text
1. analysis request
        |
        v
2. validate request, authority boundary, requested perimeter, and budgets
        |
        v
3. acquire repository read-only and establish exact subject identity
        |
        v
4. discover workspace, packages, projects, configuration closure, and exclusions
        |
        v
5. classify authored, generated, virtual, test, configuration, vendor, and excluded inputs
        |
        v
6. construct a dependency-aware, bounded capability plan
        |
        +-----------------------+-----------------------+
        |                       |                       |
        v                       v                       v
7a. static providers     7b. test/coverage       7c. runtime traces
        |                       |                       |
        +--------- raw, provenance-bearing records ----+
                                |
                                v
8. validate shape, identity, provenance, health, and capability declarations
                                |
                                v
9. normalize facts without erasing raw trace, limits, or disagreement
                                |
                                v
10. compose one revision-consistent semantic-snapshot candidate
    and a separately identified execution-evidence-set candidate
                                |
                                v
11. publish atomically or record an explicit non-publication/degraded outcome
                                |
                                v
12. answer snapshot-bound queries and produce technical evidence/finding candidates
                                |
                                v
13. report subject, coverage, freshness, conflicts, health, limits, and provenance
```

Every material flow edge carries the identities needed by its content: subject snapshot, project/configuration context, tool/rule/provider version, run/invocation, raw-result reference, source location, capability coverage, observation time, and epistemic limits.

Classification and normalization carry source-origin relations as first-class evidence. Facts obtained from generated or virtual material retain their authored-origin mapping when one is established, retain an explicit unresolved mapping when it is not, and remain classified as generated or virtual rather than being represented as authored source.

Static semantic-snapshot publication and execution-evidence-set publication are distinct. New coverage or traces can create a successor evidence set without rewriting the static snapshot.

---

## 7. Subject and publication contract

The subject-intake boundary uses the root workspace manifest rather than filesystem proximity. A clean checkout may be identified by repository and commit plus the analyzed configuration closure. A dirty, synthetic, or candidate-merge subject also needs a reproducible change-set identity or complete digests for analyzed inputs.

Subject acquisition preserves the working tree exactly as received. Read-only observation may derive a subject identity, status record, or content digest, but acquisition does not clean, reset, stage, rewrite, generate into, or otherwise normalize the received working tree.

A logical publication is:

- immutable for its declared subject and content;
- revision-consistent;
- linked to its raw inputs and producer invocations;
- labeled with capability coverage and health;
- either complete within a declared basis or explicitly partial;
- distinct from any last-known-good predecessor;
- incapable of becoming current merely because a provider returned successfully.

The exact storage transaction, schema, and API are deferred to later members.

---

## 8. Static semantic and execution-evidence lanes

### 8.1 Static lane

The static lane covers project-resolved syntax, declarations, symbols, types, import/export and dependency relations, call candidates, control flow, data flow, and composed graph views. Each fact is bound to one semantic snapshot and the configuration/provider context that established it.

### 8.2 Execution lane

The execution lane covers build identities, test selection and attempts, assertion outcomes, coverage instrumentation and denominator, runtime environment and workload, trace schema and collector, traces, spans, and events.

### 8.3 Correlation boundary

Correlation never collapses the lanes. An execution observation can be related to authored source only through compatible build/artifact and source-origin evidence. Missing or incompatible mapping yields an explicit unresolved or partial relation.

Correlation independently compares source/build identity, configuration identity, instrumentation identity, workload identity, environment identity, and observation-time identity. Every dimension must be compatible for the claimed relation; a missing or incompatible dimension yields an explicit unresolved or partial result rather than an inferred match.

Generated or virtual semantic facts remain classified as generated or virtual across correlation. A source-origin relation may connect them to authored material, but the relation does not change either endpoint's artifact class and cannot be replaced by a same-file or same-symbol assumption.

Zero observed static callers SHALL NOT be treated as proof that code is dead or safe to remove while any applicable dynamic-entry mechanism or reachability-coverage dimension remains unresolved. Framework conventions, reflection, dynamic imports, event dispatch, registration dispatch, external invocation, runtime invocation, generated entrypoints, and configuration-selected entrypoints remain explicit coverage concerns. The architecture preserves the result as partial or unresolved and selects no reachability or dead-code algorithm.

---

## 9. Trust-boundary and threat model

### 9.1 Trust zones

| Zone | Default trust | Assets | Boundary rule |
| --- | --- | --- | --- |
| Repository subject | Untrusted data | Source confidentiality, host integrity | Read-only; do not execute merely to inspect |
| Canon/reference artifacts | Identified authority by concern | Intended meaning and exact shapes | Load by identity; never allow repository text to override |
| CSAA coordinator | Trusted only for its bounded role | Subject identity, plan, publication decision | Least privilege; auditable decisions |
| Provider execution boundary | Untrusted/replaceable computation | Source, raw result, execution host | Bounded input/output, resources, filesystem, compute, process, and network capabilities |
| Raw evidence area | Sensitive, immutable or content-addressed | Source fragments, diagnostics, traces | Access control, retention, integrity, redaction |
| Normalized snapshot | Derived evidence | Facts, relations, coverage basis | Validation before publication; no silent raw-data loss |
| Consumer interface | Untrusted request and presentation boundary | Findings, source excerpts, secrets | Authorization, query budgets, output filtering |
| External network/service | Denied unless separately granted | Source and secret confidentiality | Explicit endpoint, data, purpose, time, and evidence limits |

Every provider invocation receives subject material through read-only input and may write only to a separate bounded output location. Process creation and network access are denied by default; either capability exists only under an explicit bounded grant naming its permitted operation or endpoint, data, purpose, duration, and audit limits.

Each source artifact, raw result, trace, finding, and query result carries its own explicit confidentiality, access, and retention classifications. Analysis caches, temporary files, and persisted analysis state are partitioned by both subject identity and security principal; state from one partition is not implicitly visible or reusable in another.

No row selects a physical isolation mechanism. A later authorized design may compare in-process capability isolation, worker, operating-system process, container, virtual machine, WebAssembly, or other mechanisms against the same logical boundary.

### 9.2 Threat actors

| Actor ID | Threat actor | Capability or failure mode | Protected concern |
| --- | --- | --- | --- |
| `TA-01` | Hostile or compromised repository contributor | Crafts paths, source, configuration, generated artifacts, tests, or instructions to escape the perimeter or trigger execution | Host integrity, source confidentiality, authority separation |
| `TA-02` | Compromised or defective provider/supply chain | Emits fabricated or malformed results, consumes excess resources, or attempts exfiltration | Evidence integrity, confidentiality, availability |
| `TA-03` | Unauthorized or over-broad consumer | Queries or exports unrestricted source, raw evidence, secrets, or cross-subject results | Confidentiality and subject isolation |
| `TA-04` | Misconfigured execution host or external service | Grants excess filesystem, compute, process, credential, or network capability | Least privilege and egress control |
| `TA-05` | Mistaken operator or coding agent | Treats subject text as authority, suppresses partiality, reuses stale evidence, or self-approves a result | Governance separation and no-false-green behavior |

### 9.3 Trust-boundary crossings

| Crossing ID | From → to | Crossing material | Required control |
| --- | --- | --- | --- |
| `TB-01` | Canon/reference artifacts → coordinator | Authority and exact-shape references | Identity, concern ownership, precedence, and integrity validation |
| `TB-02` | Repository subject → discovery/classification | Untrusted paths, bytes, manifests, configuration, and text | Read-only access, path confinement, data-only parsing, explicit classification |
| `TB-03` | Coordinator → provider execution boundary | Bounded subject material, capability grant, configuration, and budgets | Least privilege, redaction, resource and egress limits, invocation identity |
| `TB-04` | Provider execution boundary → raw/normalization boundary | Raw output, diagnostics, health, provenance, and admission context | Structural, provenance, semantic, and authorization validation before normalized admission; quarantine; immutable trace |
| `TB-05` | Test/coverage/runtime producers → execution-evidence ingestion | Results, build/environment/workload identity, traces | Compatibility validation and rejection or quarantine on mismatch |
| `TB-06` | Published snapshot/evidence → consumer interface | Facts, findings, explanations, source excerpts, limits | Authorization, snapshot binding, redaction, budgets, visible partiality |
| `TB-07` | Any execution boundary → external network/service | Explicitly permitted request and response data | Deny by default; endpoint, purpose, data, time, and audit grant |

### 9.4 Threat register

| Threat | Attack or failure path | Required architectural control | Detection/evidence | Residual issue |
| --- | --- | --- | --- | --- |
| Path escape | Symlink, junction, traversal, archive entry leaves perimeter | Canonicalize and validate every resolved path; bounded roots | Refusal event with path class, no secret path disclosure | Platform-specific filesystem behavior needs later tests |
| Repository-triggered execution | Config import, lifecycle hook, generator, plugin, or script runs during discovery | Parse as data; execution only through separate authority and sandbox | Process-spawn and capability audit | Some framework semantics may remain partial without execution |
| Prompt/instruction injection | Comment, string, README, test, or generated file addresses the coding agent | Treat repository text as subject data; preserve authority stack | Input classification and instruction-source trace | Human interpretation remains a social boundary |
| Provider compromise | Analyzer emits malformed, fabricated, or exfiltrating output | Sandbox, schema/provenance validation, raw trace, output limits | Provider health and validation failure | Tool supply-chain qualification deferred |
| Secret leakage | Environment, config, trace, logs, or source sent to provider/network | Minimal environment, secret scanning/redaction boundary, deny network | Redaction and egress audit | Exact secret detector and policy deferred |
| Cross-subject contamination | Cache or index mixes repositories, branches, tenants, or revisions | Subject/security-principal partitioning; explicit snapshot keys | Cross-partition invariant checks | Physical isolation deferred |
| Mixed-revision publication | Files change during analysis or partial cache reused | Change detection, invalidation, atomic logical publication | Subject-before/after identity comparison | Efficient incremental mechanism deferred |
| False green | Failed/unsupported capability omitted from aggregate, or configuration silence is treated as an exception | Coverage/health are mandatory result dimensions; an omitted, absent, or silent configuration entry cannot create an exception | Configuration-to-capability reconciliation and no-false-green validation | Exact gate semantics deferred |
| Agent bypass or self-disposition | A coding agent skips required analysis, ignores a blocking technical record, or treats its own assertion as an exception, waiver, acceptance, or approval | Required analysis and blocking outcomes remain explicit coordinator inputs; publication refuses an unmet blocking predicate; only an externally owned, identified decision or exception record can change the applicable disposition | Plan-to-invocation, finding-to-publication, and decision-authority reconciliation | Exact rule, exception, and repository-gate semantics remain with `004` |
| Disagreement erasure | Normalizer chooses one provider output silently | Preserve raw outputs and explicit conflict | Conflict record and provenance links | Resolution policy deferred |
| Resource exhaustion | Hostile or very large repository consumes CPU/memory/disk/processes | Per-run and per-invocation budgets, backpressure, cancellation | Resource-exhausted outcome and metrics | Numerical budgets need measurement |
| Query exfiltration | Consumer requests unrestricted source or raw evidence | Authorization, redaction, bounded projections | Query audit | User/role model deferred |
| History rewriting | Rerun or remediation mutates a prior record | Append-oriented successors and immutable subject binding | Integrity and lineage checks | Physical retention implementation deferred |

---

## 10. Failure and degraded-operation model

| Condition | Publication consequence | Consumer-visible result | Recovery intent |
| --- | --- | --- | --- |
| Request invalid or unauthorized | No run publication | Refused | Correct request or authority |
| Subject identity insufficient | No semantic snapshot | Failed identity | Reacquire with complete identity |
| Project/configuration missing or stale | Affected regions not compiler-confirmed | Partial or configured-but-unverified | Refresh only under authorization |
| Unsupported construct or perimeter | Supported regions may publish | Partial/unsupported with exact region | Add qualified capability later |
| Provider unavailable or crashes | Its capabilities unavailable | Failed/partial; never green by omission | Retry only under declared policy |
| Provider timeout | Completed work remains bounded evidence | Timed out with affected stage, budget, elapsed work, partial coverage, and publication consequence | Resume/retry mechanism deferred |
| Cancellation | No new work starts; active work receives cancellation | Cancelled, not success | Idempotent restart |
| Malformed/provider-incompatible output | No normalized facts from that output | Provider failure; raw diagnostic retained if permitted | Correct/replace provider |
| Provider disagreement | Facts remain conflicting | Conflict with both provenances | Later adjudication/rule |
| Subject changes during run | Candidate not current | Stale/invalidated | Rebind and reanalyze |
| Coverage/trace build mismatch | Evidence rejected or quarantined | Incompatible evidence | Supply matching build identity |
| Resource limit exceeded | No unqualified complete publication | Resource exhausted with affected stage | Adjust scope/budget under authority |
| Snapshot-store/publication failure | Prior publication remains current and distinct | Publication failed | Recover without duplicating records |
| Query exceeds budget | Snapshot remains valid | Query refused/partial | Narrow query or grant budget |
| Prior result is stale | May remain inspectable as historical | Explicit stale result | Reanalysis required for current claim |

There is no generic “warning but pass” escape. The later rule/gate owner may define outcomes, but architecture always preserves the condition needed to make that decision.

Consumer-visible degraded reporting preserves support status, capability coverage, provider execution health, evidence freshness, conflict state, and inference state as separate dimensions. No dimension is inferred from another, and no missing dimension is collapsed into a passing result.

Unsupported, failed, stale, partially analyzed, excluded, incomplete, timed-out, cancelled, conflicting, and resource-exhausted regions do not collapse into an empty finding set.

Accordingly, zero observed static callers remains a partial or unresolved reachability result whenever any applicable dynamic-entry coverage concern is unresolved; it does not collapse into a dead-code or safe-removal conclusion.

When completion of an external effect is uncertain, recovery reconciles the effect before retry. Uncertainty is not treated as evidence that the effect did not occur.

Every recovery path is idempotent. Repeated recovery does not duplicate facts, Engineering Evidence Records, Analyzer Finding Records, or external effects.

---

## 11. Observability and reconstructability

A material analysis run is reconstructable when an authorized reviewer can determine:

- who or what requested it and under which authority boundary;
- the exact subject, project/configuration closure, and evidence-set identity;
- the plan and capabilities requested, scheduled, skipped, retried, or cancelled;
- every provider/tool invocation, version, configuration, capability grant, resource budget, and health outcome;
- raw-result identities and normalization lineage;
- validation failures, conflicts, unsupported regions, and partial coverage;
- publication, refusal, invalidation, and recovery decisions;
- every query's snapshot/evidence-set identity, scope, result limits, and latency;
- what sensitive data was withheld, redacted, retained, or deleted under policy.

Required logical event classes include request, acquisition, discovery, classification, plan, scheduling, invocation, raw capture, validation, normalization, publication, invalidation, query, cancellation, timeout, failure, recovery, and retention action. Exact event shapes are deferred.

Run identity, invocation identity, subject identity, snapshot identity, and correlation identity each propagate through scheduling, provider calls, normalization, publication, and query.

Every boundary event records a safe input shape, relevant digests and versions, validation result, latency, resource use, coverage, outcome, and error classification. Errors carry a stable classification, safe diagnostic metadata, and a non-misleading remediation indication. Decisions to skip, retry, fall back, invalidate, publish partial results, or refuse green are observable with their recorded reasons.

For every bounded model or agent try, the provider execution gateway treats each initial request, retry, reformat request, and repair request as its own durable exchange. That exchange retains the exact materialized input presented to the model; the returned output before schema coercion or repair; the resolved provider, model, and version actually invoked; declared truncation or omission; the parse, validation, and repair outcome; and a prompt or template fingerprint, subject to recorded redaction. The fingerprint identifies but never substitutes for the exchange record. Non-model analyzer/provider invocations retain the separate invocation and raw-result provenance already defined above; they are not silently represented as model or agent tries.

Metrics cover latency, queueing, resource use, cancellation, timeout, failure, partiality, staleness, disagreement, cache/invalidation, publication, and recovery.

Logs and metrics are not authority. They are operational evidence and must not contain unrestricted source, secrets, credentials, or raw provider payloads when a protected reference is sufficient.

Health reporting exposes provider execution health, capability coverage, evidence freshness, finding state, and later gate outcome as separate dimensions. Each dimension remains visible without being collapsed into any of the others.

---

## 12. Scalability and responsiveness objectives

The architecture recognizes at least these workload classes:

| Workload | Measurement dimensions |
| --- | --- |
| Initial full repository analysis | Subject size, project count, artifact count, capabilities, elapsed time, CPU, memory, disk/output, provider health |
| Incremental reanalysis | Change-set size, invalidation closure, reused facts, recomputed facts, equivalence to clean analysis |
| Execution-evidence ingestion | Artifact size/count, validation cost, correlation success, rejected/quarantined observations |
| Snapshot publication | Candidate size, validation time, atomicity, predecessor visibility |
| Interactive query | Snapshot size, traversal breadth/depth, result size, latency, cancellation |
| Cross-snapshot comparison | Both identities, changed fact/edge count, lineage confidence, latency |

Work is bounded by configurable resource and time budgets. Backpressure, fairness, progress, and cancellation are logical obligations and do not imply a distributed scheduler. Numerical targets remain unverified until separately authorized measurement exists.

Topology-neutral backpressure admits new work only while declared queue and resource budgets permit; otherwise scheduling queues, rejects, or sheds work with an explicit reason and without a false completion. Topology-neutral fairness prevents indefinite starvation of a subject, request class, or provider under sustained load through a bounded or policy-declared allocation rule. Neither rule assumes a distributed deployment.

Querying an already-published snapshot operates against that immutable snapshot and never triggers an implicit full-repository reanalysis. Invalidation is conservative: every potentially affected fact remains invalid until safely recomputed or revalidated. When a narrow affected set cannot be proven, reanalysis broadens explicitly, records the broadened scope and reason, and does not silently reuse uncertain facts.

Equivalent inputs and configuration are expected to produce semantically equivalent normalized results independent of safe parallel scheduling order. Exact ordering, canonicalization, and differential-oracle rules belong to later machine contracts and conformance specifications.

---

## 13. Unresolved architecture alternatives

No alternative in this section is selected.

### 13.1 Storage alternative A — immutable snapshot bundles plus transactional catalog

Logical elements:

- content-addressed subject and configuration manifests;
- immutable raw provider and execution-evidence artifacts;
- normalized fact partitions for one snapshot;
- transactional catalog and atomic publication pointer;
- derived indexes for graph, text, or relational queries.

Strengths include revision isolation, exportability, and raw provenance. Risks include index complexity, multi-location atomicity, and compaction accidentally severing lineage.

### 13.2 Storage alternative B — version-partitioned semantic graph plus append-only evidence ledger

Logical elements:

- semantic graph partitions keyed by snapshot identity;
- explicit project, configuration, and evidence nodes;
- separate append-only raw-evidence and finding-history ledger;
- atomic snapshot publication record;
- prohibited implicit cross-partition edges.

Strengths include direct relationship and impact queries. Risks include destructive upserts, provider-shaped semantics, cross-revision leakage, and portability/retention complexity.

### 13.3 Storage alternative C — append-only fact log with rebuildable projections

Logical elements:

- immutable fact and evidence records;
- deterministic normalization records;
- rebuildable graph, relational, or search projections;
- published projection manifest per snapshot.

Strengths include replay and projection flexibility. Risks include rebuild cost, projection lag, schema evolution, and consumers mistaking a projection for authority.

### 13.4 Orchestration alternative A — embedded deterministic DAG coordinator

A host process constructs a dependency DAG and uses bounded isolated workers. It favors local/offline use and lower operational burden. Its unresolved risks are crash durability, long-running recovery, and very large repository elasticity.

### 13.5 Orchestration alternative B — durable job/lease coordinator

Analysis units become idempotent jobs with durable state, leases, heartbeat, retry, cancellation, and backpressure. It favors crash recovery and scale but adds operational complexity and risks allowing workflow machinery to dictate semantic boundaries.

### 13.6 Orchestration alternative C — two-speed foreground/background model

A bounded foreground path produces explicitly provisional edit-time results while a background path produces publishable snapshots. It may improve responsiveness but creates significant stale-result, identity, and dual-truth hazards.

### 13.7 Common comparison criteria

Every alternative is evaluated at the architecture-document grain below. The entries are bounded hypotheses for comparison, not measurements, provider qualifications, selections, or implementation claims.

- exact subject binding and mixed-revision prevention;
- atomic publication and predecessor visibility;
- raw provenance and provider disagreement retention;
- confidentiality, offline use, isolation, and least privilege;
- cancellation, timeout, crash recovery, and deterministic replay;
- full/incremental equivalence and invalidation safety;
- query latency and whole-repository throughput;
- operational complexity, portability, retention, export, and provider removal;
- ability to verify failure paths independently of implementation.

| Alternative | Subject and publication semantics | Provenance and disagreement | Security, confidentiality, and offline use | Recovery and invalidation | Scale and responsiveness | Operability, portability, and removal | Independent failure verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Storage A — immutable bundles plus catalog | Strong revision isolation if the manifest and publication pointer are one logical transaction; multi-location atomicity remains a risk | Strong raw-artifact retention; derived indexes must preserve links and conflicts | Exportable/offline-friendly, but every bundle, catalog, and index needs the same access and retention partition | Failed index/catalog publication can leave the prior bundle current; compaction and index rebuild need lineage checks | Whole-bundle transfer and multi-index rebuild may be costly; read projections can be tuned independently | Portable artifacts but multiple persistence surfaces and compaction duties; provider removal depends on neutral bundle formats | Good when manifests, raw bundles, indexes, and publication pointers can be fault-injected and reconciled separately |
| Storage B — partitioned semantic graph plus evidence ledger | Strong only when partition keys prohibit cross-revision edges and publication is atomic; destructive upsert is a principal hazard | Direct graph provenance is convenient, but normalized graph state must not replace the append-only raw ledger or erase disagreement | Fine-grained authorization is possible but graph traversal can cross security partitions unless explicitly constrained | Partition replacement and ledger replay can support recovery; invalidation and partial partition repair are complex | Relationship queries are favorable; large partitions, cross-snapshot comparison, and retention can stress the store | Operationally specialized and potentially less portable; neutral export and complete provider removal require explicit qualification | Requires independent tests for cross-partition leakage, destructive updates, partial writes, and raw-ledger/graph divergence |
| Storage C — append-only fact log plus projections | Strong temporal history when every projection manifest binds one source offset/set; projection freshness must remain explicit | Strongest raw derivation history if normalization records and conflicts are appended rather than overwritten | Offline use is plausible; replay and projection workers still require bounded access to sensitive history | Replay favors recovery and correction; invalidation becomes successor facts, while rebuild time and schema evolution remain risks | Ingestion scales independently; projection lag and full replay can harm interactive freshness | Projection technologies are replaceable if the log contract stays neutral; migration and long-term retention remain substantial | Good when deterministic rebuild, projection equivalence, lag, corruption, and schema-evolution failures are tested separately |
| Orchestration A — embedded deterministic DAG | One host can bind the complete plan to one subject; crash boundaries and durable publication handoff remain weak | In-process coordination simplifies trace linkage but must retain per-invocation raw output and conflict | Strong local/offline posture with bounded workers; host compromise has a larger shared blast radius | Deterministic scheduling helps replay; process crash, restart, lease recovery, and long-running cancellation need added mechanisms | Low overhead for small and medium repositories; single-host CPU, memory, and disk bound elasticity | Lowest operating burden and high portability if worker contracts stay neutral; host-specific concurrency can leak into behavior | Good for deterministic schedule, cancellation, timeout, and worker-failure tests; crash/restart verification is weaker without durable state |
| Orchestration B — durable job/lease coordinator | Durable jobs can retain exact subject and plan identity, but workflow state must not become semantic authority | Per-job traces can be strong; retries must remain distinct invocations and preserve conflicting outputs | Strong isolation options but larger credential, network, and service surface; offline operation is less natural | Best explicit lease, heartbeat, retry, restart, and backpressure model; duplicate delivery and stale lease hazards must remain visible | Favors large repositories and elasticity; coordination latency and service overhead can impair foreground use | Highest operational complexity and topology dependence; portability and provider removal require neutral job and state contracts | Strong for crash, retry, lease-expiry, duplicate-delivery, and cancellation tests if the coordinator itself is included in the subject |
| Orchestration C — foreground/background | Each lane can be bound exactly, but foreground provisional and background publishable identities must never collapse into one current truth | Both lanes need raw provenance and explicit disagreement/supersession rather than last-writer-wins | Foreground can remain local while background uses broader services; data-flow and authorization boundaries multiply | Background recovery can be durable; foreground invalidation, expiry, and handoff create significant stale-result hazards | Best potential interaction latency with background throughput; duplicated work and promotion delay are costs | Moderate-to-high operating burden because two execution classes and their reconciliation must remain compatible and replaceable | Requires independent tests for stale foreground use, contradictory lane results, promotion races, cancellation, and background failure |

The documentation needed to compare these alternatives may be prepared under the standing commission. A concrete selection, experiment, provider qualification, implementation, or authority-bearing decision remains separately unauthorized; any final authority-bearing disposition is surfaced through the final exact-corpus review or another independently authorized decision path.

---

## 14. Non-goals and deferred decisions

This Draft does not:

- choose TypeScript Compiler API, ts-morph, dependency-cruiser, Semgrep, CodeQL, Joern, Sonar, Tree-sitter, or any provider;
- choose a graph, relational, document, object, or file storage engine;
- choose a CLI, IDE, language-server, daemon, local service, cloud service, microservice, or embedded topology;
- define an extraction algorithm, query language, rule profile, severity, suppression, waiver, or repository gate;
- define final schemas, APIs, error codes, fixtures, golden answers, or executable tests;
- define an installation, build, deployment, licensing, procurement, or production-operations plan;
- run or authorize a feasibility experiment;
- collect production traces or send repository content to a network;
- change application source, tests, configuration, dependencies, generated artifacts, or oracle judgments;
- define canonical professional-work or infrastructure-assurance meaning.

Selection and approval remain distinct authority actions. This Draft selects none of the listed providers, storage engines, workflow engines, graph databases, or deployment topologies, and it approves none of them.

---

## 15. Revision-bound repository examples

The following are informative historical examples from [JAN-CSAA-005@0.1.0](<records/archive/JAN-CSAA-005@0.1.0.Draft.REG-D-020.snapshot>) §§3, 5, 6, 9, 11, and 14. They are bound to parent commit `e673fb5c2e186fb0873d3720036e5e8d7b00038a`, observation time `2026-07-26T11:52:31.6050250-04:00`, and [JAN-CSAA-005-EVIDENCE-001@0.1.0](<records/JAN-CSAA-005 - Preparation Evidence Snapshot.md>). They become stale under that inventory's §3.4 and are not silently upgraded to the successor inventory:

- the root TypeScript configuration is discovery context rather than a complete program because its `files` and `include` sets are empty;
- normal and `tsconfig.build.json` package variants have different inclusion boundaries;
- the Svelte app extends generated `.svelte-kit` project context whose freshness must be qualified;
- repository tests deliberately distinguish source-resolving and built-artifact-resolving modes;
- checked-in dependency rules are governed constraints to ingest by identity, not timeless CSAA architecture;
- existing storage, logging, event, outbox, or recovery seams are implementation facts, not CSAA provider selections.

These examples explain why the responsibilities exist. They do not select their current implementations for CSAA.

---

## 16. Normative requirement catalog

Each row contains one independently reviewable mandatory predicate. A comma-delimited completeness set remains one predicate only when the set has one actor, one action, and one verification decision. The requirement ledger records source intake, substantive fulfillment, and verification state independently.

### 16.1 Control and ownership

| Requirement ID | Atomic requirement | Substantive fulfillment outside this catalog |
| --- | --- | --- |
| `CSAA-001-CTL-001` | The document SHALL carry the controlled metadata required by `JAN-CSAA-000@0.3.0` §9.3. | Metadata fields; §19 |
| `CSAA-001-CTL-002` | The document SHALL identify this revision's version as `0.3.1`. | Metadata `Version` |
| `CSAA-001-CTL-003` | The document SHALL state that this Draft has no member authority. | Metadata `Governing status` and `Authority` |
| `CSAA-001-CTL-004` | The document SHALL cite `REG-D-018`, `REG-D-021`, and `REG-D-022` according to their prospective commission, correction, and no-expansion boundaries. | Metadata `Governing status`, `Authority`, and `Change authority and procedure` |
| `CSAA-001-CTL-005` | The document SHALL state its candidate `Governs` boundary. | Metadata `Governs` |
| `CSAA-001-CTL-006` | The document SHALL state its `Does not govern` boundary. | Metadata `Does not govern`; §14 |
| `CSAA-001-CTL-007` | The document SHALL route apparent conflicts by concern to the concern owner or `JPWB-REG-005`. | Metadata `Precedence and conflict routing`; §2 |
| `CSAA-001-CTL-008` | The document SHALL NOT silently resolve a conflict owned by another artifact. | Metadata `Precedence and conflict routing`; §2 |
| `CSAA-001-CTL-009` | Every mandatory clause authored by this document SHALL have one stable requirement ID. | Requirement ledger §§2–3 and mechanical ID reconciliation |
| `CSAA-001-CTL-010` | Every mandatory clause authored by this document SHALL have one requirement-ledger binding. | Requirement ledger §§3 and 6 |
| `CSAA-001-CTL-011` | This Wave 1 revision SHALL remain documentation-only. | Metadata `Classification`; §§14 and 19 |
| `CSAA-001-CTL-012` | This Wave 1 revision SHALL NOT authorize implementation. | Metadata `Authority`; §14 |
| `CSAA-001-CTL-013` | This Wave 1 revision SHALL NOT authorize dependency changes. | §14 |
| `CSAA-001-CTL-014` | This Wave 1 revision SHALL NOT authorize experiments. | §14 |
| `CSAA-001-CTL-015` | This Wave 1 revision SHALL NOT authorize source mutation. | §14 |
| `CSAA-001-CTL-016` | This Wave 1 revision SHALL NOT authorize configuration mutation. | §14 |
| `CSAA-001-CTL-017` | This Wave 1 revision SHALL NOT authorize test mutation. | §14 |
| `CSAA-001-CTL-018` | This Wave 1 revision SHALL NOT authorize an oracle change. | §14; requirement ledger §7 |
| `CSAA-001-CTL-019` | This Draft SHALL NOT select a concrete analyzer provider. | §§1, 13, and 14 |
| `CSAA-001-CTL-020` | This Draft SHALL NOT select a concrete storage engine. | §§1, 13, and 14 |
| `CSAA-001-CTL-021` | This Draft SHALL NOT select a concrete workflow engine. | §§1, 13, and 14 |
| `CSAA-001-CTL-022` | This Draft SHALL NOT select a graph database. | §§1, 13, and 14 |
| `CSAA-001-CTL-023` | This Draft SHALL NOT select a deployment topology. | §§1, 4.2, 5, 13, and 14 |
| `CSAA-001-CTL-024` | Current repository facts SHALL be referenced through `JAN-CSAA-005`. | §2 concern table; §15 |
| `CSAA-001-CTL-025` | Current repository facts SHALL NOT be restated as timeless architecture. | §15 |
| `CSAA-001-CTL-026` | This Draft SHALL distinguish the adopted README authority baseline from the separate non-authoritative working-corpus status record. | Metadata `Classification` and `Review and evidence companions`; §19 |
| `CSAA-001-CTL-027` | This Draft SHALL NOT claim that interim README carriage or an intermediate sponsor response is required for continuation or Proposed promotion. | Metadata `Classification`; §19 |
| `CSAA-001-CTL-028` | The document SHALL identify this revision's status as `Draft`. | Metadata `Status` |
| `CSAA-001-CTL-029` | This Draft SHALL NOT approve a concrete analyzer provider. | §§1, 13, and 14 |
| `CSAA-001-CTL-030` | This Draft SHALL NOT approve a concrete storage engine. | §§1, 13, and 14 |
| `CSAA-001-CTL-031` | This Draft SHALL NOT approve a concrete workflow engine. | §§1, 13, and 14 |
| `CSAA-001-CTL-032` | This Draft SHALL NOT approve a graph database. | §§1, 13, and 14 |
| `CSAA-001-CTL-033` | This Draft SHALL NOT approve a deployment topology. | §§1, 4.2, 5, 13, and 14 |
| `CSAA-001-CTL-034` | No intermediate sponsor or concern-owner response SHALL be a continuation predicate for in-scope documentation work. | Metadata `Classification`, `Authority`, and `Change authority and procedure`; §19 |
| `CSAA-001-CTL-035` | Documentation-subphase completion SHALL NOT be represented as satisfaction of a full executable Wave 2, Wave 3, or Wave 4 exit. | Metadata `Conformance-test references`; §§14, 17, and 19 |
| `CSAA-001-CTL-036` | For the same exact judgment surface, the author/integrator, adversarial reviewer, integrity/provenance validator, final decision authority, and ministerial recorder SHALL be distinct identities. | Metadata `Verification owner`; §19 |
| `CSAA-001-CTL-037` | The ministerial recorder SHALL NOT supply or reinterpret judgment. | Metadata `Verification owner`; §19 |

### 16.2 Context and responsibilities

| Requirement ID | Atomic requirement | Substantive fulfillment outside this catalog |
| --- | --- | --- |
| `CSAA-001-ARC-001` | The architecture SHALL define a tool-neutral system context. | §4 |
| `CSAA-001-ARC-002` | The system context SHALL identify external actors. | §4.1 actor/source table |
| `CSAA-001-ARC-003` | The system context SHALL identify external evidence sources. | §4.1 actor/source table |
| `CSAA-001-ARC-004` | The architecture SHALL define repository-acquisition responsibility. | §5 `Subject acquisition and identity` row |
| `CSAA-001-ARC-005` | The architecture SHALL define subject-identification responsibility. | §§5 and 7 |
| `CSAA-001-ARC-006` | The architecture SHALL define workspace-discovery responsibility. | §5 `Workspace/project discovery` row |
| `CSAA-001-ARC-007` | The architecture SHALL define package-discovery responsibility. | §5 `Workspace/project discovery` row |
| `CSAA-001-ARC-008` | The architecture SHALL define TypeScript-project-discovery responsibility. | §5 `Workspace/project discovery` row |
| `CSAA-001-ARC-009` | The architecture SHALL define source-classification responsibility. | §5 `Source classification` row |
| `CSAA-001-ARC-010` | The architecture SHALL define configuration-classification responsibility. | §5 `Source classification` row |
| `CSAA-001-ARC-011` | The architecture SHALL define semantic-extraction responsibility. | §5 `Static semantic extraction` row |
| `CSAA-001-ARC-012` | The semantic-extraction boundary SHALL NOT select an extractor. | §§5, 13, and 14 |
| `CSAA-001-ARC-013` | The architecture SHALL define graph-normalization responsibility. | §5 `Validation and normalization` row |
| `CSAA-001-ARC-014` | The architecture SHALL define graph-composition responsibility. | §5 `Graph composition` row |
| `CSAA-001-ARC-015` | The architecture SHALL NOT redefine semantic meanings owned by `JAN-CSAA-002`. | §2 concern table; §§5, 8, and 10 |
| `CSAA-001-ARC-016` | The architecture SHALL define test-result-ingestion responsibility. | §5 `Test/coverage ingestion` row; §8.2 |
| `CSAA-001-ARC-017` | The architecture SHALL define coverage-ingestion responsibility. | §5 `Test/coverage ingestion` row; §8.2 |
| `CSAA-001-ARC-018` | The architecture SHALL define runtime-trace-ingestion responsibility. | §5 `Runtime-trace ingestion` row; §8.2 |
| `CSAA-001-ARC-019` | The architecture SHALL define bounded scheduling responsibility. | §5 `Capability planning` row; §6 step 6 |
| `CSAA-001-ARC-020` | The architecture SHALL define bounded orchestration responsibility. | §5 `Capability planning` and `Provider execution gateway` rows |
| `CSAA-001-ARC-021` | The orchestration boundary SHALL NOT select a runtime topology. | §§4.2, 5, 13, and 14 |
| `CSAA-001-ARC-022` | The architecture SHALL define Engineering Evidence Record normalization responsibility. | §5 `Technical record normalization` row |
| `CSAA-001-ARC-023` | The architecture SHALL define Analyzer Finding Record normalization responsibility. | §5 `Technical record normalization` row |
| `CSAA-001-ARC-024` | The technical-record boundary SHALL cede record meaning to the concern-owning documents. | §2 concern table; §5 `Technical record normalization` row |
| `CSAA-001-ARC-025` | The architecture SHALL define a snapshot-bound query service responsibility. | §5 `Query/change-impact service` row; §6 step 12 |
| `CSAA-001-ARC-026` | The architecture SHALL define change-impact service responsibility. | §5 `Query/change-impact service` row; §6 step 12 |
| `CSAA-001-ARC-027` | The query boundary SHALL cede query semantics to `JAN-CSAA-003`. | §2 concern table; §5 `Query/change-impact service` row |
| `CSAA-001-ARC-028` | The architecture SHALL define a coding-agent interface responsibility. | §§4.1 and 5 `Agent/human interface` row |
| `CSAA-001-ARC-029` | The architecture SHALL define a human interface responsibility. | §§4.1 and 5 `Agent/human interface` row |
| `CSAA-001-ARC-030` | The interface boundary SHALL NOT define the `JAN-CSAA-010` employment protocol. | §2 concern table; §§5 and 14 |
| `CSAA-001-ARC-031` | The architecture SHALL define a provider/plugin boundary. | §§4.1, 4.2, and 5 `Provider execution gateway` row |
| `CSAA-001-ARC-032` | Provider output SHALL remain derived evidence. | §§3, 5, 6, and 9 |
| `CSAA-001-ARC-033` | Provider output SHALL be treated as untrusted input. | §§3, 5, and 9 |
| `CSAA-001-ARC-034` | The architecture SHALL define security responsibility. | §5 `Security/confidentiality/retention` row; §9 |
| `CSAA-001-ARC-035` | The architecture SHALL define confidentiality responsibility. | §5 `Security/confidentiality/retention` row; §9 |
| `CSAA-001-ARC-036` | The architecture SHALL define retention responsibility. | §5 `Security/confidentiality/retention` row; §§9 and 11 |
| `CSAA-001-ARC-037` | The architecture SHALL define degraded-operation responsibility. | §5; §10 |
| `CSAA-001-ARC-038` | The architecture SHALL define observability responsibility. | §5 `Observability/recovery` row; §11 |
| `CSAA-001-ARC-039` | The architecture SHALL define invalidation responsibility. | §§5, 7, and 10 |
| `CSAA-001-ARC-040` | The architecture SHALL define recovery responsibility. | §5 `Observability/recovery` row; §10 |
| `CSAA-001-ARC-041` | The architecture SHALL distinguish logical responsibilities from deployable processes, services, packages, and databases. | §§3, 4.2, and 5 |
| `CSAA-001-ARC-042` | A diagram box SHALL NOT imply a separately deployable service. | §4.2 paragraph following the diagram |
| `CSAA-001-ARC-043` | The document SHALL include an end-to-end data-flow diagram. | §6 |
| `CSAA-001-ARC-044` | The document SHALL include a responsibility matrix naming inputs, outputs, trust crossings, permitted side effects, degraded results, and concern owners. | §5 responsibility matrix |

### 16.3 Flow and semantic safety

| Requirement ID | Atomic requirement | Substantive fulfillment outside this catalog |
| --- | --- | --- |
| `CSAA-001-FLW-001` | Subject acquisition SHALL use the root manifest to establish the initial workspace perimeter. | §7 |
| `CSAA-001-FLW-002` | Subject acquisition SHALL preserve the received working tree. | §7 |
| `CSAA-001-FLW-003` | A dirty subject SHALL be bound to its parent commit. | §7 |
| `CSAA-001-FLW-004` | A dirty subject SHALL be bound to a reproducible change set or complete analyzed-input digests. | §7 |
| `CSAA-001-FLW-005` | Read-only inspection SHALL be the default. | §§3, 5, 7, and 9 |
| `CSAA-001-FLW-006` | A write-producing analysis action SHALL require separate execution authority. | §§3, 5, 7, and 9 |
| `CSAA-001-FLW-007` | Discovery SHALL keep normal, build, generated-framework, and source-versus-artifact project contexts distinct. | §§5, 6, and 15 |
| `CSAA-001-FLW-008` | Every perimeter region SHALL remain explicitly supported, partial, unsupported, excluded, or not analyzed. | §§3, 7, and 10 |
| `CSAA-001-FLW-009` | Generated or virtual source facts SHALL retain mappings to their authored origins. | §§5, 8.3, and 15 |
| `CSAA-001-FLW-010` | Generated or virtual source facts SHALL NOT be represented as authored source. | §§5 and 8.3 |
| `CSAA-001-FLW-011` | Every material fact and result SHALL retain sufficient subject, run, method, configuration, and provider provenance. | §§6, 7, 8, and 11 |
| `CSAA-001-FLW-012` | Normalization SHALL retain a trace to raw provider output. | §§3, 5, 6, and 11 |
| `CSAA-001-FLW-013` | Normalization SHALL preserve provider disagreement. | §§5, 9.4, and 10 |
| `CSAA-001-FLW-014` | Normalization SHALL preserve provider limitations. | §§3, 5, and 11 |
| `CSAA-001-FLW-015` | Static semantic-snapshot identity SHALL remain distinct from test, coverage, and runtime evidence-set identity. | §§3, 6, and 8 |
| `CSAA-001-FLW-016` | Execution evidence SHALL be correlated only when source/build, configuration, instrumentation, workload, environment, and time identities are compatible. | §§6 and 8.3 |
| `CSAA-001-FLW-017` | Publication SHALL expose one revision-consistent snapshot or an explicitly partial or non-current result. | §§5, 6, 7, and 10 |
| `CSAA-001-FLW-018` | Mixed-revision facts SHALL NOT appear current. | §§7, 9.4, and 10 |
| `CSAA-001-FLW-019` | Analyzer output SHALL remain derived evidence. | §§3, 5, and 6 |
| `CSAA-001-FLW-020` | Analyzer output SHALL NOT become a second source tree. | §§3, 5, and 14 |
| `CSAA-001-FLW-021` | Analyzer output SHALL NOT mutate source. | §§1, 5, and 14 |
| `CSAA-001-FLW-022` | Analyzer output SHALL NOT confer authority. | §§1, 3, 5, and 9 |
| `CSAA-001-FLW-023` | Analyzer output SHALL NOT approve an exception. | §§1, 5, and 14 |
| `CSAA-001-FLW-024` | Analyzer output SHALL NOT imply canonical assurance. | §§2, 5, and 14 |
| `CSAA-001-FLW-025` | Zero observed static callers SHALL NOT be treated as proof that code is dead or safe to remove while any applicable dynamic-entry mechanism or reachability-coverage dimension remains unresolved. | §§8.3 and 10 |

### 16.4 Trust and threat requirements

| Requirement ID | Atomic requirement | Substantive fulfillment outside this catalog |
| --- | --- | --- |
| `CSAA-001-TRU-001` | The threat model SHALL identify protected assets, threat actors, trust zones, crossings, abuse cases, controls, detection evidence, and residual risks. | §9.1–§9.4 |
| `CSAA-001-TRU-002` | Repository content, configuration, scripts, plugins, comments, and generated artifacts SHALL be treated as untrusted subject data. | §§3, 4.1, and 9 |
| `CSAA-001-TRU-003` | Acquisition SHALL canonicalize resolved paths. | §9.4 `Path escape` |
| `CSAA-001-TRU-004` | Acquisition SHALL prevent symlink, junction, traversal, and archive-extraction escape beyond the declared perimeter. | §9.4 `Path escape` |
| `CSAA-001-TRU-005` | Provider execution SHALL receive read-only subject access. | §§5 and 9.3 `TB-03` |
| `CSAA-001-TRU-006` | Provider execution SHALL receive a separate bounded output location. | §§5 and 9.3 `TB-03` |
| `CSAA-001-TRU-007` | Discovery SHALL NOT execute repository scripts, lifecycle hooks, configuration code, generators, or plugins merely to inspect them. | §9.4 `Repository-triggered execution` |
| `CSAA-001-TRU-008` | Process creation SHALL be denied by default. | §9.1 and §9.3 `TB-03` |
| `CSAA-001-TRU-009` | Network access SHALL be denied by default. | §9.1 and §9.3 `TB-07` |
| `CSAA-001-TRU-010` | A process capability SHALL require an explicit bounded grant. | §9.1 and §9.3 `TB-03` |
| `CSAA-001-TRU-011` | Provider execution SHALL NOT inherit unrelated credentials, tokens, environment secrets, or host authority. | §9.4 `Secret leakage` |
| `CSAA-001-TRU-012` | Provider output SHALL cross structural validation before normalized admission. | §9.3 `TB-04` |
| `CSAA-001-TRU-013` | Provider output SHALL cross provenance validation before normalized admission. | §9.3 `TB-04` |
| `CSAA-001-TRU-014` | Provider output SHALL cross semantic validation before normalized admission. | §§5 and 9.3 `TB-04` |
| `CSAA-001-TRU-015` | Provider output SHALL cross authorization validation before normalized admission. | §9.3 `TB-04` |
| `CSAA-001-TRU-016` | Malformed or provenance-incompatible provider output SHALL be quarantined. | §§5, 9.3, 9.4, and 10 |
| `CSAA-001-TRU-017` | Malformed or provenance-incompatible provider output SHALL NOT create normalized facts. | §§5 and 10 |
| `CSAA-001-TRU-018` | Source, raw results, traces, findings, and query results SHALL have explicit confidentiality classifications. | §§5 and 9.1 |
| `CSAA-001-TRU-019` | Logs SHALL NOT carry secrets, sensitive raw source, or unrestricted provider payloads. | §§9.4 and 11 |
| `CSAA-001-TRU-020` | Caches SHALL be isolated across subjects and security principals. | §9.4 `Cross-subject contamination` |
| `CSAA-001-TRU-021` | Repository text addressed to an agent SHALL remain subject data. | §9.4 `Prompt/instruction injection` |
| `CSAA-001-TRU-022` | Repository text addressed to an agent SHALL NOT become an instruction. | §9.4 `Prompt/instruction injection` |
| `CSAA-001-TRU-023` | Repository text addressed to an agent SHALL NOT become an authority grant. | §9.4 `Prompt/instruction injection` |
| `CSAA-001-TRU-024` | A coding agent SHALL NOT bypass required analysis. | §§4.1, 5, and 9.4 |
| `CSAA-001-TRU-025` | An analyzer SHALL NOT bypass required analysis. | §§4.1, 5, and 9.4 |
| `CSAA-001-TRU-026` | A coding agent SHALL NOT self-approve a finding disposition. | §§4.1, 5, and 9.4 |
| `CSAA-001-TRU-027` | A coding agent SHALL NOT create an exception through configuration silence. | §§4.1, 5, and 9.4 `False green` |
| `CSAA-001-TRU-028` | A network capability SHALL require an explicit bounded grant. | §9.1 and §9.3 `TB-07` |
| `CSAA-001-TRU-029` | Acquisition SHALL validate that each canonicalized path remains inside the declared perimeter. | §9.4 `Path escape` |
| `CSAA-001-TRU-030` | Source, raw results, traces, findings, and query results SHALL have explicit access classifications. | §§5 and 9.1 |
| `CSAA-001-TRU-031` | Source, raw results, traces, findings, and query results SHALL have explicit retention classifications. | §§5 and 9.1 |
| `CSAA-001-TRU-032` | An analyzer SHALL NOT self-approve a finding disposition. | §§4.1, 5, and 9.4 |
| `CSAA-001-TRU-033` | An analyzer SHALL NOT create an exception through configuration silence. | §§4.1, 5, and 9.4 `False green` |
| `CSAA-001-TRU-034` | Malformed or provenance-incompatible provider output SHALL NOT create normalized findings. | §§5 and 10 |
| `CSAA-001-TRU-035` | Metrics SHALL NOT carry secrets, sensitive raw source, or unrestricted provider payloads. | §§9.4 and 11 |
| `CSAA-001-TRU-036` | Temporary files SHALL be isolated across subjects and security principals. | §9.4 `Cross-subject contamination` |
| `CSAA-001-TRU-037` | Persisted analysis state SHALL be isolated across subjects and security principals. | §9.4 `Cross-subject contamination` |

### 16.5 Failure and degraded operation

| Requirement ID | Atomic requirement | Substantive fulfillment outside this catalog |
| --- | --- | --- |
| `CSAA-001-DEG-001` | The architecture SHALL preserve the orthogonal support, capability-coverage, execution-health, freshness, conflict, and inference dimensions owned by `JAN-CSAA-002`. | §§2, 5, 6, and 10; `JAN-CSAA-002` §12 |
| `CSAA-001-DEG-002` | Unsupported, failed, stale, partially analyzed, excluded, incomplete, timed-out, cancelled, conflicting, and resource-exhausted regions SHALL NOT collapse into an empty finding set. | §§3, 9.4 `False green`, and 10 |
| `CSAA-001-DEG-003` | Acquisition failure SHALL prevent semantic-snapshot publication. | §10 `Subject identity insufficient` |
| `CSAA-001-DEG-004` | Missing project configuration SHALL downgrade affected compiler-confirmed claims to explicit partial or configured-but-unverified status. | §10 `Project/configuration missing or stale`; §15 |
| `CSAA-001-DEG-005` | Failure of one provider SHALL be isolated to that provider's capabilities. | §10 `Provider unavailable or crashes` |
| `CSAA-001-DEG-006` | Failure of one provider SHALL remain visible to consumers. | §§10 and 11 |
| `CSAA-001-DEG-007` | Invalid provider output SHALL be retained diagnostically when policy permits. | §10 `Malformed/provider-incompatible output` |
| `CSAA-001-DEG-008` | Invalid provider output SHALL remain semantically inert. | §§5 and 10 |
| `CSAA-001-DEG-009` | A timeout SHALL record the affected stage, budget, elapsed work, partial coverage, and publication consequence. | §10 `Provider timeout`; §11 |
| `CSAA-001-DEG-010` | Cancellation SHALL stop new work. | §10 `Cancellation` |
| `CSAA-001-DEG-011` | CPU, memory, disk, process, or output-limit exhaustion SHALL produce an explicit resource-exhausted result. | §10 `Resource limit exceeded` |
| `CSAA-001-DEG-012` | Subject mutation detected during analysis SHALL invalidate or restart affected work. | §10 `Subject changes during run` |
| `CSAA-001-DEG-013` | Subject mutation detected during analysis SHALL NOT yield a revision-consistent success claim. | §10 `Subject changes during run` |
| `CSAA-001-DEG-014` | Persistence failure SHALL leave the prior published snapshot distinguishable from the failed candidate. | §§7 and 10 |
| `CSAA-001-DEG-015` | Recovery SHALL be idempotent. | §5 `Observability/recovery`; §10 |
| `CSAA-001-DEG-016` | Recovery SHALL NOT duplicate facts. | §§5 and 10 |
| `CSAA-001-DEG-017` | Coverage evidence with incompatible subject/build provenance SHALL be rejected or quarantined. | §§8.3 and 10 |
| `CSAA-001-DEG-018` | Provider disagreement SHALL remain a conflicting-evidence condition unless a later governed contract defines an applicable resolution. | §§9.4 and 10 |
| `CSAA-001-DEG-019` | An exposed stale result SHALL identify its staleness and bound subject. | §10 `Prior result is stale` |
| `CSAA-001-DEG-020` | A stale result SHALL NOT be presented as current. | §§7 and 10 |
| `CSAA-001-DEG-021` | Unsupported, failed, stale, partially analyzed, excluded, incomplete, timed-out, cancelled, conflicting, and resource-exhausted regions SHALL prevent a passing verdict. | §§3, 9.4 `False green`, and 10 |
| `CSAA-001-DEG-022` | Unsupported, failed, stale, partially analyzed, excluded, incomplete, timed-out, cancelled, conflicting, and resource-exhausted regions SHALL prevent an unqualified green result. | §§3, 9.4 `False green`, and 10 |
| `CSAA-001-DEG-023` | Subject-identity failure SHALL prevent semantic-snapshot publication. | §10 `Subject identity insufficient` |
| `CSAA-001-DEG-024` | Stale project configuration SHALL downgrade affected compiler-confirmed claims to explicit partial or configured-but-unverified status. | §10 `Project/configuration missing or stale`; §15 |
| `CSAA-001-DEG-025` | Missing generated configuration SHALL downgrade affected compiler-confirmed claims to explicit partial or configured-but-unverified status. | §10 `Project/configuration missing or stale`; §15 |
| `CSAA-001-DEG-026` | Stale generated configuration SHALL downgrade affected compiler-confirmed claims to explicit partial or configured-but-unverified status. | §10 `Project/configuration missing or stale`; §15 |
| `CSAA-001-DEG-027` | Cancellation SHALL propagate to active work. | §10 `Cancellation` |
| `CSAA-001-DEG-028` | Cancellation SHALL produce an explicit cancelled result. | §10 `Cancellation`; §11 |
| `CSAA-001-DEG-029` | Recovery SHALL NOT duplicate Engineering Evidence Records. | §§5 and 10 |
| `CSAA-001-DEG-030` | Recovery SHALL NOT duplicate Analyzer Finding Records. | §§5 and 10 |
| `CSAA-001-DEG-031` | Recovery SHALL NOT duplicate external effects. | §§5 and 10 |
| `CSAA-001-DEG-032` | Recovery SHALL reconcile an uncertain external effect before retry. | §10 paragraph following the failure/degraded-operation matrix |
| `CSAA-001-DEG-033` | Publication failure SHALL leave the prior published snapshot distinguishable from the failed candidate. | §§7 and 10 |
| `CSAA-001-DEG-034` | Trace evidence with incompatible subject/build provenance SHALL be rejected or quarantined. | §§8.3 and 10 |

### 16.6 Observability

| Requirement ID | Atomic requirement | Substantive fulfillment outside this catalog |
| --- | --- | --- |
| `CSAA-001-OBS-001` | Every material analysis run SHALL leave reconstructable structured evidence. | §11 |
| `CSAA-001-OBS-002` | Every material provider or tool invocation SHALL leave reconstructable structured evidence. | §11 |
| `CSAA-001-OBS-003` | Run identity SHALL propagate through scheduling, provider calls, normalization, publication, and query. | §§6 and 11 |
| `CSAA-001-OBS-004` | The architecture SHALL define logical events for request, acquisition, discovery, classification, scheduling, invocation, validation, normalization, publication, invalidation, query, cancellation, timeout, failure, recovery, and retention. | §11 |
| `CSAA-001-OBS-005` | Boundary events SHALL record safe input shape, relevant digests and versions, validation result, latency, resource use, coverage, outcome, and error classification. | §11 |
| `CSAA-001-OBS-006` | Decisions to skip, retry, fall back, invalidate, publish partial results, or refuse green SHALL be observable with reasons. | §11 |
| `CSAA-001-OBS-007` | Errors SHALL have stable classifications. | §11 |
| `CSAA-001-OBS-008` | Errors SHALL have safe diagnostic metadata. | §11 |
| `CSAA-001-OBS-009` | Errors SHALL have a non-misleading remediation indication. | §11 |
| `CSAA-001-OBS-010` | Logs SHALL identify protected raw evidence by reference or fingerprint when the payload is unnecessary. | §11 |
| `CSAA-001-OBS-011` | Health reporting SHALL expose provider execution health without collapsing it into another health-reporting dimension. | §11 paragraph following the reconstructability model |
| `CSAA-001-OBS-012` | Observability SHALL include metrics for latency, queueing, resource use, cancellation, timeout, failure, partiality, staleness, disagreement, cache/invalidation, publication, and recovery. | §11 |
| `CSAA-001-OBS-013` | Observability obligations SHALL receive later executable verification in `JAN-CSAA-008`. | §17.2 allocation matrix |
| `CSAA-001-OBS-014` | Invocation identity SHALL propagate through scheduling, provider calls, normalization, publication, and query. | §§6 and 11 |
| `CSAA-001-OBS-015` | Subject identity SHALL propagate through scheduling, provider calls, normalization, publication, and query. | §§6 and 11 |
| `CSAA-001-OBS-016` | Snapshot identity SHALL propagate through scheduling, provider calls, normalization, publication, and query. | §§6 and 11 |
| `CSAA-001-OBS-017` | Correlation identity SHALL propagate through scheduling, provider calls, normalization, publication, and query. | §§6 and 11 |
| `CSAA-001-OBS-018` | Health reporting SHALL expose capability coverage without collapsing it into another health-reporting dimension. | §11 paragraph following the reconstructability model |
| `CSAA-001-OBS-019` | Health reporting SHALL expose evidence freshness without collapsing it into another health-reporting dimension. | §11 paragraph following the reconstructability model |
| `CSAA-001-OBS-020` | Health reporting SHALL expose finding state without collapsing it into another health-reporting dimension. | §11 paragraph following the reconstructability model |
| `CSAA-001-OBS-021` | Health reporting SHALL expose later gate outcome without collapsing it into another health-reporting dimension. | §11 paragraph following the reconstructability model |

### 16.7 Quality attributes

| Requirement ID | Atomic requirement | Substantive fulfillment outside this catalog |
| --- | --- | --- |
| `CSAA-001-QUA-001` | Equivalent inputs and configuration SHALL produce semantically equivalent normalized results independent of safe parallel scheduling order. | §12 |
| `CSAA-001-QUA-002` | Analysis SHALL operate under configurable CPU, memory, disk, process, time, and output budgets. | §§10 and 12 |
| `CSAA-001-QUA-003` | Scheduling SHALL define backpressure without assuming a distributed deployment. | §12 |
| `CSAA-001-QUA-004` | Querying an already-published snapshot SHALL NOT require an implicit full-repository reanalysis. | §12 |
| `CSAA-001-QUA-005` | Long-running work SHALL report progress. | §12 |
| `CSAA-001-QUA-006` | Long-running work SHALL expose cancellation. | §12 |
| `CSAA-001-QUA-007` | Invalidation SHALL be conservative. | §§10 and 12 |
| `CSAA-001-QUA-008` | Inability to prove a narrow affected set SHALL broaden reanalysis explicitly. | §12 |
| `CSAA-001-QUA-009` | The document SHALL define workload classes for full analysis, incremental analysis, execution-evidence ingestion, publication, query, and cross-snapshot comparison. | §12 |
| `CSAA-001-QUA-010` | Numerical performance claims SHALL be labeled unverified until separately authorized measurement evidence exists. | §12 |
| `CSAA-001-QUA-011` | Scheduling SHALL define fairness without assuming a distributed deployment. | §12 |
| `CSAA-001-QUA-012` | The document SHALL define measurement dimensions for full analysis, incremental analysis, execution-evidence ingestion, publication, query, and cross-snapshot comparison. | §12 |

### 16.8 Alternatives

| Requirement ID | Atomic requirement | Substantive fulfillment outside this catalog |
| --- | --- | --- |
| `CSAA-001-ALT-001` | The document SHALL describe at least two credible provider-neutral storage architectures. | §13.1–§13.3 |
| `CSAA-001-ALT-002` | The document SHALL describe at least two credible provider-neutral orchestration architectures. | §13.4–§13.6 |
| `CSAA-001-ALT-003` | Every alternative SHALL be evaluated against the common semantic, security, recovery, confidentiality, scale, operability, portability, and verification criteria. | §13.7 |
| `CSAA-001-ALT-004` | The storage alternatives SHALL remain undecided in Wave 1. | §13 opening; §17.2 `ALLOC-STORAGE` |
| `CSAA-001-ALT-005` | Each unresolved alternative SHALL name its later decision owner. | §17.2 allocation matrix |
| `CSAA-001-ALT-006` | Each unresolved alternative SHALL name the evidence required for decision. | §17.2 allocation matrix |
| `CSAA-001-ALT-007` | Each unresolved alternative SHALL name its activation gate. | §17.2 allocation matrix |
| `CSAA-001-ALT-008` | Each unresolved alternative SHALL name its safe default. | §17.2 allocation matrix |
| `CSAA-001-ALT-009` | Each unresolved alternative SHALL name its current authority status. | §17.2 allocation matrix |
| `CSAA-001-ALT-010` | The orchestration alternatives SHALL remain undecided in Wave 1. | §13 opening; §17.2 `ALLOC-ORCH` |

### 16.9 Acceptance and allocation completeness

| Requirement ID | Atomic requirement | Substantive fulfillment outside this catalog |
| --- | --- | --- |
| `CSAA-001-ACC-001` | Acceptance SHALL require an end-to-end data-flow diagram. | §6 |
| `CSAA-001-ACC-002` | Acceptance SHALL require a responsibility matrix. | §5 |
| `CSAA-001-ACC-003` | Acceptance SHALL require a trust-boundary and threat model. | §9 |
| `CSAA-001-ACC-004` | Acceptance SHALL require defined failure and degraded modes. | §10 |
| `CSAA-001-ACC-005` | Acceptance SHALL require explicit non-goals. | §14 |
| `CSAA-001-ACC-006` | Acceptance SHALL require at least two credible storage alternatives. | §13.1–§13.3 |
| `CSAA-001-ACC-007` | Final-corpus inclusion SHALL require independent adversarial review of the exact Proposed candidate. | §17.1; §19 outstanding work |
| `CSAA-001-ACC-008` | Independent adversarial review SHALL use the controlled review template. | §17.1 controlled-template paragraph; controlled review template |
| `CSAA-001-ACC-009` | Every later allocation SHALL identify the exact obligation. | §17.2 allocation matrix |
| `CSAA-001-ACC-010` | Every later allocation SHALL identify its owning document or authority. | §17.2 allocation matrix |
| `CSAA-001-ACC-011` | Every later allocation SHALL identify its activation or decision gate. | §17.2 allocation matrix |
| `CSAA-001-ACC-012` | Every later allocation SHALL identify required evidence. | §17.2 allocation matrix |
| `CSAA-001-ACC-013` | Every later allocation SHALL identify its intended verification. | §17.2 allocation matrix |
| `CSAA-001-ACC-014` | Every later allocation SHALL identify its safe default. | §17.2 allocation matrix |
| `CSAA-001-ACC-015` | Every later allocation SHALL identify its current authority status. | §17.2 allocation matrix |
| `CSAA-001-ACC-016` | Acceptance SHALL require at least two credible orchestration alternatives. | §13.4–§13.6 |
| `CSAA-001-ACC-017` | Draft-to-Proposed promotion SHALL require a closed requirement ledger and completed author self-review. | Metadata `Change authority and procedure`; §19 |
| `CSAA-001-ACC-018` | Final-corpus inclusion SHALL require integrity/provenance validation by an identity distinct from the author and adversarial reviewer. | Metadata `Verification owner`; §19 |
| `CSAA-001-ACC-019` | Every candidate-byte change after an exact review freeze SHALL trigger affected re-review unless it satisfies the exact pre-frozen administrative-substitution exception in `REG-D-022`. | Metadata `Change authority and procedure`; §19 |
| `CSAA-001-ACC-020` | The final corpus package SHALL provide an individual sponsor-response field for this member and for every independently contestable material fork, exception, residual-risk acceptance, or amendment affecting it. | §17.2 `ALLOC-CONFERRAL`; §19 |
| `CSAA-001-ACC-021` | An accepted revision SHALL receive its own exact-member `JPWB-REG-005` conferral within the one final corpus transaction. | Metadata `Authority`; §17.2 `ALLOC-CONFERRAL`; §19 |

---

## 17. Verification and later-allocation matrix

### 17.1 Current Draft verification allocation

Independent adversarial review uses the [CSAA Controlled Document Review Template](<templates/CSAA Controlled Document Review Template.md>) as its mandatory starting point and preserves every required field. The methods in the current-Draft table below are author-side adversarial-question and scenario checks; they do not constitute that independent post-Proposed review.

| Verification concern | Current Wave 1 method | Later executable owner | Current state |
| --- | --- | --- | --- |
| Controlled metadata and filename | Structural document inspection | Document-control automation may later supplement | `NOT_RUN` |
| Requirement-ID and ledger reconciliation | Mechanical extraction plus self-review | Document-control automation may later supplement | `NOT_RUN` |
| Ownership and non-duplication | Cross-document semantic review | `JAN-CSAA-008` where executable survivorship applies | `NOT_RUN` |
| End-to-end flow completeness | Scenario walk-through and author-side adversarial-question audit | `JAN-CSAA-006` and `JAN-CSAA-008` | `NOT_RUN` |
| Hostile repository, path escape, process denial, and network denial | Threat-model review | `JAN-CSAA-008` | `NOT_RUN` |
| Mixed revision and no-false-green behavior | Author-side adversarial-question audit | `JAN-CSAA-006` and `JAN-CSAA-008` | `NOT_RUN` |
| Cancellation, timeout, recovery, and determinism | Architecture consistency review | `JAN-CSAA-008` and `JAN-CSAA-009` | `NOT_RUN` |
| Provider removal and disagreement | Boundary review | `JAN-CSAA-008` and `JAN-CSAA-011` | `NOT_RUN` |
| Storage and orchestration choice | Alternatives remain open | Documentation analysis under the standing commission; any experiment, qualification, implementation, or authority-bearing choice remains separately authorized | `NOT_RUN` |

### 17.2 Complete later-allocation matrix

| Allocation ID | Exact obligation allocated | Later owner | Activation or decision gate | Required evidence | Intended verification | Wave 1 safe default | Current authority status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ALLOC-002` | Define provider-independent semantic objects, identity, provenance, lifecycle, relations, cross-graph invariants, and orthogonal support/coverage/health/freshness/conflict/inference dimensions referenced by `ARC-015`, `ARC-024`, and `DEG-001` | `JAN-CSAA-002` | Documentation preparation is commissioned by `REG-D-021`/`REG-D-022`; semantic authority requires its own exact-member conferral in the final corpus transaction | Exact 002 ledger, source trace, semantic cross-review against 000/001/005, independent review record, integrity-validation record, unresolved-findings record | Controlled semantic-catalog review followed by later 008 conformance for machine-enforced portions | 001 names only architectural consequences and preserves every dimension without redefining it | `JAN-CSAA-002@0.3.1 / Draft` specification authored and non-authoritative; no implementation, semantic execution, result, or authority |
| `ALLOC-003` | Define extraction, enrichment, query, slicing, comparison, change-impact, reachability-partiality, and dynamic-entry-coverage semantics referenced by `ARC-011`–`ARC-014`, `ARC-025`–`ARC-027`, and `FLW-025` | `JAN-CSAA-003` | Documentation subphase commissioned by `REG-D-021`/`REG-D-022`; authoring begins on objective predecessor readiness; execution and authority remain separate | Versioned method definitions, soundness/completeness goals, uncertainty limits, explicit dynamic-entry and reachability coverage declarations, fixture bindings, and provider-independent result examples | Independent controlled-document review plus 006 fixtures and 008 executable conformance after separate execution authority | Queries remain snapshot-bound and explicit about partiality; zero static callers never proves dead code while applicable coverage is unresolved; no algorithm is selected | `JAN-CSAA-003@0.1.1 / Draft` specification authored and non-authoritative; no implementation, analysis execution, result, or authority |
| `ALLOC-004` | Define Analysis Rule Profiles, Analyzer Finding Records, provider contracts, Repository Gate Profiles/Evaluations, suppression/disposition meaning, and gate semantics referenced by `ARC-022`–`ARC-024` and `FLW-022`–`FLW-024` | `JAN-CSAA-004` | Documentation subphase commissioned by `REG-D-021`/`REG-D-022`; execution and authority remain separate | Versioned rule/gate semantics, finding lifecycle, authority boundaries, provider declarations, negative no-false-green cases | Independent controlled-document review plus 006 fixtures and 008 executable conformance after separate execution authority | Technical records remain non-authoritative; disagreement and degraded states remain visible; no gate meaning is inferred | `JAN-CSAA-004@0.1.1 / Draft` specification authored and non-authoritative; no analyzer/provider execution, gate result, implementation, or authority |
| `ALLOC-005` | Supply current JPWB repository, project, configuration, tool, test, coverage, and freshness facts used only as revision-bound examples under `CTL-024` and `CTL-025` | `JAN-CSAA-005` | Documentation preparation and inventory review are commissioned by `REG-D-021`/`REG-D-022`; member authority requires its own exact-member conferral in the final corpus transaction | Exact parent/worktree/change-set identity, content/configuration/lockfile digests, observation time, raw inspection evidence, freshness rule | Independent repository/configuration inventory review and integrity validation; later 008 inventory conformance under separate execution authority | Treat 005 as non-authoritative time-bound evidence and preserve the repository-freshness gap | `JAN-CSAA-005@0.3.1 / Draft` inventory authored and non-authoritative; consolidated final implementation refresh remains open; no live-current claim, execution result, or authority |
| `ALLOC-006` | Define known-positive, known-negative, partial, stale, conflict, cancellation, timeout, recovery, path-escape, provider-removal, and zero-static-caller/dead-code false-positive fixture judgments needed by `ACC-001`–`ACC-006`, `ACC-016`, and `FLW-025` | `JAN-CSAA-006` | Documentation specification is commissioned by `REG-D-021`/`REG-D-022`; executable fixtures and oracle judgments require separate authority and independent oracle ownership | Exact fixture subjects, expected outcomes, framework/reflection/dynamic-import/event/registration/external/runtime/generated/configuration entry mechanisms, reachability-coverage limits, provenance, judgment owner, review record, and non-vacuity cases | Independent oracle review followed by 008 executable conformance under separate execution authority | No fixture judgment is invented or treated as passed; unresolved dynamic entry remains explicit | `JAN-CSAA-006@0.1.1 / Draft` specification authored and non-authoritative; no executable fixture, oracle judgment, execution, result, or authority |
| `ALLOC-007` | Define versioned schemas, APIs, envelopes, error shapes, provider adapters, snapshot/publication contracts, and invalidation/freshness contracts needed to realize §§5–11 | `JAN-CSAA-007` | Documentation specification is commissioned by `REG-D-021`/`REG-D-022`; executable schemas, types, generated artifacts, and implementation require separate authority | Contract package, compatibility rules, generated-artifact specifications, change classification, migration effects, and source-to-contract trace | Independent contract review and later 008 executable conformance under separate execution authority | Logical records and errors remain descriptive; no exact wire or persistence shape is presumed | `JAN-CSAA-007@1.0.1 / Draft` specification authored and non-authoritative; no executable contract, generated implementation artifact, execution result, or authority |
| `ALLOC-008` | Specify and later execute requirement-level conformance for trust boundaries, provenance, mixed-revision prevention, no-false-green behavior, degraded modes, observability, determinism, cancellation, provider replacement, and zero-static-caller/dead-code inference under `OBS-013`, `ACC-007`–`ACC-008`, and `FLW-025` | `JAN-CSAA-008` | Documentation specification is commissioned by `REG-D-021`/`REG-D-022`; executable conformance, fixtures, oracle judgments, and results require separate authority | Conferred requirements/contracts/fixtures, exact implementation subject, provider/configuration versions, negative dynamic-entry and reachability-partiality cases, raw results, coverage and limitation declarations | Executable conformance and independent V&V review after separate execution authority | All executable verification remains `NOT_RUN`; architecture review cannot substitute for execution or prove dead code | `JAN-CSAA-008@0.2.2 / Draft` specification authored and non-authoritative; no executable suite, fixture/oracle execution, result, pass claim, or authority |
| `ALLOC-009` | Define physical persistence, incremental recomputation, publication atomicity, invalidation, retention, crash recovery, reconciliation, and operational behavior for §§7, 10, and 12 | `JAN-CSAA-009` | Documentation design is commissioned by `REG-D-021`/`REG-D-022` after objective semantic and contract readiness; implementation and failure-injection execution require separate authority | Failure-injection specifications and later evidence, replay/rebuild proof plan, migration/retention design, idempotency proof plan, load and recovery measurement plan | Independent architecture/operations review plus 008 executable failure-path conformance under separate execution authority | Preserve immutable logical identity and prior-publication distinction; choose no physical mechanism | `JAN-CSAA-009@0.2.1 / Draft` design authored and non-authoritative; no physical selection, persistence implementation, failure-injection execution, result, or authority |
| `ALLOC-010` | Define how coding agents and humans request, consume, challenge, refresh, and act on CSAA evidence without self-authorization, as bounded by `ARC-028`–`ARC-030` | `JAN-CSAA-010` with `JPWB-DOC-004` by concern | Documentation protocol is commissioned by `REG-D-021`/`REG-D-022` after objective input readiness; live-agent execution remains unauthorized | Versioned employment protocol, authority envelopes, stop/escalation conditions, trajectory-evidence specification, current-inventory binding | Independent trajectory review and later 008 conformance where executable under separate authority | Consumers receive evidence and limits only; no approval, waiver, exception, or completion is inferred | Documentation commissioned; artifact unauthored; no live-agent execution or authority |
| `ALLOC-011` | Specify qualification criteria for concrete analyzers and adapters against declared capability, isolation, confidentiality, provenance, failure, licensing, removal, and replacement obligations | `JAN-CSAA-011` | Documentation criteria are commissioned by `REG-D-021`/`REG-D-022`; provider qualification execution, procurement, installation, selection, and approval remain separately unauthorized | Reproducible bake-off specification, exact-version/configuration binding, license/procurement review criteria, threat-assessment criteria, failure/removal test plan, evidence-retention plan | Independent specification review plus later provider-qualification execution and applicable 008 conformance under separate authority | Providers remain replaceable, capability-bounded, untrusted, and non-authoritative; none is selected | Documentation commissioned; artifact unauthored; no qualification execution, provider approval, or authority |
| `ALLOC-STORAGE` | Decide among or revise the three §13.1–§13.3 storage alternatives while preserving every common criterion and `ALT-004`–`ALT-009` | `JAN-CSAA-009` and final decision authority for any authority-bearing selection | Comparative documentation may proceed under `REG-D-021`/`REG-D-022` after objective prerequisites; experiments, implementation, and authority-bearing selection require separate authority or final itemized disposition | Comparative prototype specification or later authorized experiment, failure/recovery evidence plan, confidentiality/retention review, portability and cost evidence, strongest opposing case | Independent architecture decision review and later 008/009 validation | No selection; retain logical immutable snapshot/evidence behavior only | Open fork; no decision, experiment, implementation, or authority |
| `ALLOC-ORCH` | Decide among or revise the three §13.4–§13.6 orchestration alternatives while preserving every common criterion and `ALT-005`–`ALT-010` | `JAN-CSAA-009`, `JAN-CSAA-011`, and final decision authority for any authority-bearing selection | Comparative documentation may proceed under `REG-D-021`/`REG-D-022` after objective prerequisites; experiments, provider execution, implementation, and authority-bearing selection require separate authority or final itemized disposition | Crash/restart/cancellation/backpressure measurement plan and later evidence, deterministic-equivalence evidence, provider-isolation evidence, operational-complexity analysis, strongest opposing case | Independent architecture decision review and later 008/009/011 validation | No selection; retain bounded dependency-aware scheduling semantics only | Open fork; no decision, experiment, implementation, or authority |
| `ALLOC-CONFERRAL` | Present the exact 001 candidate for possible Normative conferral | Final decision authority through `JPWB-REG-005`, with a distinct ministerial recorder | Ledger and author self-review closed; exact Proposed bytes/digest frozen; independent adversarial review and distinct integrity/provenance validation complete; affected re-review complete; final exact-corpus package supplies this member's individual response field and every material fork/exception field | Exact ID/version/SHA-256, closed ledger, review and validator identities/methods, verification evidence, unresolved findings, strongest opposing case, consequence matrix, itemized sponsor response | Exact-corpus compatibility review, individual sponsor disposition, distinct exact-member register decision, and ministerial final carriage in one controlled transaction | Remain Draft or Proposed and non-authoritative | No intermediate conferral requested or presumed; final disposition remains future |

`REG-D-021`/`REG-D-022`, not this table, commission the later documentation subphases. No row creates its allocated artifact or evidence, satisfies objective predecessor readiness, performs executable work, selects an alternative, or confers authority.
---

## 18. Open forks and safe defaults

| Fork | Wave 1 safe default | Later owner or trigger |
| --- | --- | --- |
| Physical storage | No selection; logical immutable snapshot/evidence behavior only | `JAN-CSAA-009` documentation after objective readiness; selection or execution separately authorized |
| Orchestration | No selection; bounded dependency-aware scheduling behavior only | `JAN-CSAA-009` and provider qualification |
| Foreground provisional analysis | Do not equate provisional result with published snapshot | `JAN-CSAA-003`, `009`, `010` |
| Multiple provider resolution | Preserve disagreement; no silent winner | `JAN-CSAA-004` |
| Provider execution | Deny process/network privileges unless explicitly granted | `JAN-CSAA-004`/`011` |
| Generated framework context | Report configured-but-unverified when freshness is not established | `JAN-CSAA-002` identity rules and later adapter contract |
| Last-known-good use | Historical inspection only unless currentness is explicit | `JAN-CSAA-003`/`009` |
| Performance objectives | Record dimensions; no numerical target without measurement | Later implementation/operations commission |
| Gate integration | Produce technical records only; no blocking meaning here | `JAN-CSAA-004`/`010` |

---

## 19. Draft acceptance state

This `0.3.1` revision is a correction-only, non-authoritative Draft successor under `REG-D-018` as extended by `REG-D-021` and corrected by `REG-D-022`. It corrects `JAN-CSAA-001-SR-001` and `JAN-CSAA-001-SR-002` without selecting an analysis algorithm, executing a fixture or conformance suite, refreshing the implementation subject, or creating authority. The adopted `JAN-CSAA-000@0.3.0` README remains the authority and manifest baseline; `JAN-CSAA-WORKING-STATUS-001` carries non-authoritative preparation state without interim README carriage. The exact 0.3.0 objective, reconciliation, ledger-closure, and preliminary-review records remain historical evidence for their own bytes only. This corrective Draft does not self-declare corrective objective closure, cross-package reconciliation, completed author self-review, Proposed standing, Normative authority, or live repository currentness.

The following artifacts are present in this Draft:

- tool-neutral system-context description and diagram;
- end-to-end data-flow diagram;
- logical responsibility matrix;
- trust-boundary and threat model;
- failure and degraded-mode matrix;
- observability and workload models;
- explicit non-goals;
- three storage and three orchestration alternatives;
- stable candidate requirement catalog;
- later-wave verification allocation;
- open-fork safe defaults.

The requirement catalog now contains 241 independently reviewable mandatory predicates with stable IDs, including the singular `CSAA-001-FLW-025` no-false-dead-code safeguard. Every predicate maps to substantive text outside the catalog, and §17.2 allocates later analysis, fixture, and conformance validation without claiming execution. The requirement ledger records the applicable inherited intake separately from the 001-authored catalog. The 0.3.0 objective closure and preliminary self-review remain exact historical evidence; this changed successor requires direct-current objective, cross-package, and author-review reruns.

At this `0.3.1` post-predecessor-ledger, preliminary-review, corrective-authoring state, which is not an exact review freeze or Proposed-candidate freeze, the following work remains before Proposed status. Later exact closure and reconciliation records control live completion state without retroactively rewriting preserved predecessor evidence:

- complete direct-current objective verification against the exact `0.3.1` Draft and its OPEN successor ledger, then close only that named corrective documentation-objective commission while every later-lifecycle and executable allocation remains an explicit nonpass;
- perform affected cross-package reconciliation against the exact corrective identities;
- rerun all eighteen `JAN-CSAA-000` adversarial questions against the reconciled corrective bytes, closing `JAN-CSAA-001-SR-001` and `JAN-CSAA-001-SR-002` only through a separately recorded completed author self-review;
- complete the rest of the planned documentation corpus and then perform the consolidated final implementation refresh required by EVIDENCE-008; EVIDENCE-004 remains historical, EVIDENCE-007 remains dated-only, and EVIDENCE-008 remains an intermediate authoring control;
- rerun every objective, ledger, cross-package, and self-review check affected by that final refresh; and
- freeze the exact candidate version and digest and record the transition to Proposed only after no blocker or major finding remains.

After Proposed and before final-corpus inclusion:

- a distinct adversarial reviewer reviews the exact Proposed bytes;
- a distinct integrity/provenance validator validates exact identity, evidence continuity, and role separation;
- every candidate-byte change after the review freeze receives affected re-review unless it satisfies the exact `REG-D-022` pre-frozen substitution exception; and
- the reviewed candidate, unresolved findings, strongest opposing case, consequences, and individual member/material-fork response fields are assembled into the one final exact-corpus package.

Documentation-subphase completion does not satisfy any full executable Wave 2, Wave 3, or Wave 4 exit. No intermediate sponsor package is required or solicited.

---

## 20. Closing architecture rule

The future CSAA implementation may distribute, embed, persist, cache, or project these responsibilities in many ways. It remains conformant only if every result stays bound to its subject and provenance, every degraded region remains visible, every provider remains replaceable and non-authoritative, and no physical convenience can create a second source of truth.
