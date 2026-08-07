# Golden Repository and Change Scenario Fixture

**Document ID:** `JAN-CSAA-006`

**Version:** `0.1.1`

**Status:** `Draft`

**Settledness:** `HYPOTHESIS`

**Classification:** Prepared controlled-CSAA member candidate; non-authoritative, documentation-only fixture and oracle-governance specification; no executable fixture, conferred oracle, or conformance result

**Governing status:** Documentation-only Wave 2 entry under `JAN-CSAA-W1-SEMANTIC-READINESS-001@0.1.0`, `JPWB-REG-005 REG-D-021`, and `REG-D-022`

**Role:** Define independently governed synthetic and dated-JPWB scenario specifications, proposed expected judgments, coverage matrices, mutations, and no-false-green controls

**Authority:** None. Authorship cannot confer an expected judgment, bind a gate, qualify a provider, execute conformance, or alter repository truth

**Candidate concern allocation:** Fixture-case and proposed expected-judgment strategy only

**Requirement ledger:** [JAN-CSAA-006 Requirement Ledger](<records/JAN-CSAA-006 - Requirement Ledger.md>). The linked controlled successor, rather than this Draft's immutable correction-entry tables, controls current author-side requirement, method, gap, and objective-verification state

**Lifecycle-correction basis:** Exact `JAN-CSAA-006-LEDGER-001@0.1.1` (619,593 bytes; SHA-256 `f389203f91c575ec85acf14250dd3e2a9d897669868281b59cf6732874062fc7`), `JAN-CSAA-006-VERIFICATION-001@0.1.2` (16,592 bytes; SHA-256 `ef129375fad100e64ab5569469d9e2ac6cf29017bb7cb1e07c578dac20eb81cb`), `JAN-CSAA-W2-OBJECTIVE-RECONCILIATION-001@0.1.0` (13,879 bytes; SHA-256 `755459221a65f9fada7541953bd9aa7ba8976592fdc803801a1838ce1dfef46b`), `JAN-CSAA-W2-LEDGER-CLOSURE-INTEGRITY-001@0.1.0` (12,436 bytes; SHA-256 `5f2f5d095354dc90b4525e9dec84c0f07fefdcd612a6b39c11097bdae6e4f643`), historical `JAN-CSAA-WORKING-STATUS-001@0.8.0` (12,120 bytes; SHA-256 `9187787def76cfdb0c2c9942405610d2fb35d89df3c9ff14584a8092dcb5cfef`), `JAN-CSAA-CURRENT-CORPUS-RECONCILIATION-001@0.1.0` (27,932 bytes; SHA-256 `5da6b4cd89dcf1a13c6d3dca3e7c22d4ac532791bcff4a8778587672617b03c3`), `JAN-CSAA-W3-SEMANTIC-READINESS-001@0.1.0` (32,042 bytes; SHA-256 `a7ba3d47c912bc737267f9f70998587fd16b34e541772cfd2ad4bddbadaaff49`), correction-entry `JAN-CSAA-WORKING-STATUS-001@0.13.0` (14,997 bytes; SHA-256 `0e8d5ee79fb2a456fce4e721b70dea81c5e7cf2c771b5410093a48bcff65e22e`), and preliminary `JAN-CSAA-006-SELF-REVIEW-001@0.1.0` (15,437 bytes; SHA-256 `3b867ef6a5fbf83e710566c2098b9dc184d8b0dacade2794be509ef9b9fc0b81`) form the exact correction basis. Status008 and the predecessor evidence remain historical; Status013 controls correction-entry authoring state until synchronized publication creates a separately exact Status014 successor

**Correction state:** `JAN-CSAA-006-SR-001 / MAJOR` identified mixed predecessor and post-closure lifecycle presentation in `JAN-CSAA-006@0.1.0`. This patch corrects that presentation prospectively. Its successor ledger and objective rerun remain separately controlled; no corrective author self-review record is created by this patch

**Companion enforced artifacts:** None

**Oracle state:** Every expected judgment is `PROPOSED / NOT_CONFERRED / NOT_EXECUTED`

**Repository-evidence boundary:** `JAN-CSAA-005-EVIDENCE-007@0.1.0` is a dated OBS-035/036 baseline; `JAN-CSAA-005-EVIDENCE-008@0.1.0` prohibits representing it as continuously current and requires one consolidated refresh before final freeze

**Supersedes:** [JAN-CSAA-006@0.1.0 / Draft](<records/archive/JAN-CSAA-006@0.1.0.Draft.PRE-SR-001-CORRECTION.snapshot>); 138,584 bytes; SHA-256 `7d6804b0198ba19285903f53ac5053971310b0278bd5a6c7f6946e3265814361`; exact predecessor remains immutable historical evidence; patch scope is lifecycle and evidence-currentness correction only

**Superseded by:** None

---

## 1. Purpose

This specification defines the controlled scenario and expected-judgment surface by which the JAN-CSAA semantic model, analysis capabilities, rules, findings, and inert gate-template boundaries can later be tested without copying an analyzer result into its own oracle. It specifies what a fixture and its proposed judgment must mean; it does not create the physical fixture, execute an analyzer, or confer the judgment.

The protected question is:

> What exact synthetic and dated repository cases, changes, degraded states, and independently governed expected judgments are required to expose semantic errors and prevent incomplete, stale, failed, self-authored, or vacuous analyzer behavior from appearing correct?

## 2. Concern ownership and exclusions

This candidate owns fixture-case and proposed expected-judgment strategy only. `JAN-CSAA-003` owns capability and query meaning; `JAN-CSAA-004` owns rule, result, finding, treatment, provider, and gate meaning; `JAN-CSAA-005` owns dated JPWB repository description. Canon retains professional assurance and governance meaning.

Exact schemas belong to `JAN-CSAA-007`; executable conformance belongs to `JAN-CSAA-008`; persistence and operation belong to `JAN-CSAA-009`; coding-agent employment belongs to `JAN-CSAA-010`; concrete provider qualification belongs to `JAN-CSAA-011`. This document SHALL NOT redefine or silently absorb those concerns.

| Exact input | Identity | Standing in this Draft |
| --- | --- | --- |
| [JAN-CSAA-000@0.3.0](<README.md>) | 102,164 bytes; SHA-256 `833b97d9fe12ae5e245b6c2920216ec3271e59f68dc24c54d0efd9a1efdf32a1` | Adopted program authority and §10.6 source |
| [JAN-CSAA-001@0.3.0](<JAN-CSAA-001 - Codebase Semantic Analysis and Assurance Architecture.md>) | 109,420 bytes; SHA-256 `cda7defe7fa310f912bceb8b355952e1159bebc05528fc51c310578ede26237b` | Provisional architecture input |
| [JAN-CSAA-002@0.3.1](<JAN-CSAA-002 - TypeScript Semantic Model and Invariant Catalog.md>) | 163,765 bytes; SHA-256 `961a338cf4b843b9568981d3580b3af5dbb3dc6f22d4426609833bd6b52a09c6` | Corrected provisional semantic-identity input; exact same-package successor binding |
| [JAN-CSAA-003@0.1.0](<JAN-CSAA-003 - Analysis Enrichment Query and Change Impact Specification.md>) | 169,676 bytes; SHA-256 `65b3a9379dd47a25de1693ed709eafd11f7a9063db1cfd80b5da2bba01b46d10` | Provisional capability, query, and result input |
| [JAN-CSAA-004@0.1.1](<JAN-CSAA-004 - Code Analysis Rule Gate and Analyzer Provider Contract.md>) | 182,814 bytes; SHA-256 `b23771ecb8c94906b6b835999a5616d66beed83bf99c3703366e67063c2cf6bd` | Corrected provisional rule, finding, treatment, and gate input; exact same-package successor binding |
| [JAN-CSAA-005@0.3.0](<JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md>) | 119,118 bytes; SHA-256 `3a9f49a492ca0b73cb50413bf694cf90e0608d73d6248db9df7cb45804b80625` | Provisional dated repository-description input |
| [JAN-CSAA-W1-SEMANTIC-READINESS-001@0.1.0](<records/JAN-CSAA-W1 - Documentation Semantic Readiness and Wave 2 Entry Record.md>) | 10,603 bytes; SHA-256 `5947e3d0a8adf6060b57878202388041c4ddf14da94c84f25c28a946fea9cbf7` | Documentation-only Wave 2 entry evidence |
| [JAN-CSAA-005-EVIDENCE-007@0.1.0](<records/JAN-CSAA-005 - Current Subject Rebinding Record 004.md>) | 11,582 bytes; SHA-256 `63b1e06287dcaf993bffecc20164227567c5248a8616650f3a5cc5e2538f95a7` | Dated OBS-035/036 evidence only |
| [JAN-CSAA-005-EVIDENCE-008@0.1.0](<records/JAN-CSAA-005 - Non-Blocking External Drift and Authoring Baseline Record.md>) | 6,952 bytes; SHA-256 `d2cba1614aea77a720cac597ed9f6faeda266a854022b6f3c1fa956dae869532` | Non-blocking intermediate currentness classification |
| [JAN-CSAA-STANDING-DIRECTION-003@0.1.0](<records/JAN-CSAA - External Repository Drift Non-Blocking Authoring Direction.md>) | 5,153 bytes; SHA-256 `3760646744063eae3f678b84961e4d0e3778ec0fabd2e7b45765cb7530df5aae` | Effective authoring procedure; non-conferring |

Intermediate Git movement is not a closure predicate for this Draft. The final implementation refresh is deliberately unperformed and remains a blocking pre-freeze obligation.

## 3. Foundational non-equivalences

| Left concept | Prohibited equivalence | Required treatment |
| --- | --- | --- |
| Proposed expected judgment | Truth or conferred oracle | Retain proposal, reviewer, authority, and conferral state separately |
| Provider output | Expected judgment | Provider material may be retained as untrusted observation only |
| Positive case | Green conformance | Require independent oracle standing and executable evidence later |
| Negative case | Analyzer failure or safety | Treat as a controlled countercase under a declared closed basis |
| Empty output | Supported absence | Expose population, coverage, health, and epistemic state |
| Zero static callers | Dead code | Preserve every dynamic-entry frontier and bounded-candidate meaning |
| RGT | RGP or Gate Evaluation | Preserve `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE` and reject misuse |
| Dated JPWB scenario | Current repository truth | Bind exact cutoff and prohibit floating currentness |
| Exception or suppression | Erased result | Preserve the underlying result, finding, and treatment visibly |

## 4. Fixture and expectation lifecycle

A Scenario Profile is a versioned design record for one controlled subject, change, expected semantic surface, outcome mode, and oracle state. It progresses only through separately recorded proposal, independent review, conferral or rejection, correction, revocation, and supersession events. Documentation authors may create `PROPOSED` content; they cannot create `CONFERRED` content.

An expected judgment is immutable at a semantic version. Correction creates a successor. A later implementation result never rewrites the predecessor. Revocation removes current standing without deleting history. No lifecycle state implies execution.

## 5. Synthetic and dated-JPWB fixture lanes

| Lane | Required content | Current Draft state |
| --- | --- | --- |
| `SYNTHETIC` | Small, self-contained repository with exact manifest, artifacts, configurations, changes, semantic facts, and reviewable boundary | Design specified; repository not created |
| `DATED_JPWB` | Minimal selected evidence bound to exact repository cutoff, monorepo/project context, generated-contract and Svelte mappings, boundaries, tests, coverage, traces, and provenance | Selection rules specified; final refresh not performed |

The lanes may exercise the same semantic question but SHALL NOT share currentness standing. Synthetic closure is bounded by its declared manifest. A dated case remains evidence about its exact cutoff only.

## 6. Thirty-facet Scenario Profile

Every Scenario Profile resolves the following exact facets. Blank fields are prohibited. Unsupported and inapplicable fields carry an exact state and rationale.

| Facet | Required meaning |
| ---: | --- |
| 1 | scenario identity and semantic version |
| 2 | scenario lifecycle and oracle state |
| 3 | fixture lane, family, case, and outcome mode |
| 4 | protected engineering or assurance question |
| 5 | exact pre-change subject |
| 6 | exact post-change subject or explicit not-applicable state |
| 7 | repository cutoff and working-change identity |
| 8 | included and excluded implementation, configuration, and generated perimeter |
| 9 | compiler, project, resolver, framework, generator, and variant contexts |
| 10 | manifest, lockfile, tool, and evidence coordinates |
| 11 | fixture manifest and content digests |
| 12 | exact mutation or change operation |
| 13 | applicable Analysis Capability Profile versions, prerequisites, and coverage |
| 14 | query, slice, comparison, and impact bindings |
| 15 | Analysis Rule Profile version, claim character, applicability, and rule basis |
| 16 | Repository Gate Template inert-design reference or supported not-applicable state |
| 17 | expected semantic objects, facts, and relations |
| 18 | expected truth projection and orthogonal epistemic dimensions |
| 19 | expected slice, delta, impact, witness, and frontier |
| 20 | expected Rule Application Result, finding, disposition, suppression, and exception state |
| 21 | expected gate or template boundary and absence of real transition effect |
| 22 | runtime, test, coverage, and trace coordinates |
| 23 | population, denominator, exclusions, bounds, and closure conditions |
| 24 | positive, negative, unknown, partial, conflict, stale, dynamic, or non-vacuity outcome mode |
| 25 | failure or degradation injection and expected non-green treatment |
| 26 | explanation, witness, derivation, and rationale |
| 27 | oracle author, reviewer, authority, and conferral state |
| 28 | provenance, invalidation, correction, and supersession |
| 29 | verification IDs and downstream executable allocation |
| 30 | security, access, redaction, retention, and isolation |

## 7. Synthetic logical repository design

The synthetic lane SHALL contain exact authored TypeScript and Svelte sources, generated or virtual TypeScript, declarations, project references, manifests and lockfile material, test and coverage inputs, runtime traces, source maps, framework registrations, dynamic-entry seams, rule-owner references, and controlled change pairs sufficient for the scenario families in §9.

The logical fixture is provider-neutral. It describes semantic roles and exact content identity without prescribing a physical directory or wire schema. `JAN-CSAA-007` may encode it only without semantic loss.

Every fixture run begins from an immutable declared state, applies one exact mutation set, and either produces a separately identified successor or records a degraded attempt. Reset, cache, and recovery state cannot leak between cases.

## 8. Dated JPWB scenario-selection rules

A dated scenario selects only the minimum evidence needed to demonstrate a named realistic concern. It binds repository cutoff, working-change identity if any, project/compiler/resolver/framework contexts, generated artifacts and maps, test selection, coverage denominator, trace schema, collector, workload, environment, and known gaps.

The lane SHALL include representative monorepo/project-reference, Svelte/generated-contract, architecture-boundary, test, coverage, and runtime behavior. EVIDENCE-007 is a dated input, not a live-freshness claim. EVIDENCE-008 and the standing direction permit Draft authoring while reserving the single consolidated final refresh.

## 9. Twenty required scenario families

| Family | Positive case | Controlled countercase |
| --- | --- | --- |
| `JAN-CSAA-006-FAM-001` — Symbol aliasing and re-exports | `JAN-CSAA-006-SCN-001-POS`: an alias and re-export chain resolves to the exact declaration identity | `JAN-CSAA-006-SCN-001-NEG`: a same-spelled or deliberately broken chain remains distinct, unresolved, or conflicting |
| `JAN-CSAA-006-FAM-002` — Authored Svelte to generated or virtual TypeScript mapping | `JAN-CSAA-006-SCN-002-POS`: authored and generated identities correlate with exact diagnostic-location fidelity | `JAN-CSAA-006-SCN-002-NEG`: a broken, ambiguous, or mismatched mapping remains visible and cannot attribute silently |
| `JAN-CSAA-006-FAM-003` — Generics and overload resolution | `JAN-CSAA-006-SCN-003-POS`: the exact substitution and overload candidate are supported under the bound checker context | `JAN-CSAA-006-SCN-003-NEG`: an ambiguous, incompatible, or error-type case remains unresolved rather than falsely selected |
| `JAN-CSAA-006-FAM-004` — Inheritance and interface implementation | `JAN-CSAA-006-SCN-004-POS`: the exact implementation and inherited-member relations are supported | `JAN-CSAA-006-SCN-004-NEG`: a structurally similar but non-implementing or incompatible type is not conflated |
| `JAN-CSAA-006-FAM-005` — Dynamic dispatch and unresolved target frontiers | `JAN-CSAA-006-SCN-005-POS`: a bounded target set and its dispatch basis are exposed | `JAN-CSAA-006-SCN-005-NEG`: an unresolved target frontier prevents a universal or closed negative conclusion |
| `JAN-CSAA-006-FAM-006` — Reachable and unreachable branches | `JAN-CSAA-006-SCN-006-POS`: a branch reachability result carries an exact control-flow witness | `JAN-CSAA-006-SCN-006-NEG`: unsupported control semantics prevent a false unreachable conclusion |
| `JAN-CSAA-006-FAM-007` — Async, exceptional, cancellation, and generator control flow | `JAN-CSAA-006-SCN-007-POS`: supported normal and non-normal control edges are represented separately | `JAN-CSAA-006-SCN-007-NEG`: an unsupported async or exceptional seam remains unknown rather than absent |
| `JAN-CSAA-006-FAM-008` — Source through sanitizer to sink flow | `JAN-CSAA-006-SCN-008-POS`: the path, sanitizer effect, rule basis, and remaining frontier are explicit | `JAN-CSAA-006-SCN-008-NEG`: a look-alike sanitizer without the exact rule does not terminate taint |
| `JAN-CSAA-006-FAM-009` — Unsafe source-to-sink flow | `JAN-CSAA-006-SCN-009-POS`: a source-to-sink witness without an effective sanitizer is supported | `JAN-CSAA-006-SCN-009-NEG`: a closed safe countercase is negative only under complete declared source, sink, and propagation coverage |
| `JAN-CSAA-006-FAM-010` — Dependency cycles and forbidden package edges | `JAN-CSAA-006-SCN-010-POS`: the exact cycle or prohibited edge and resolution context are supported | `JAN-CSAA-006-SCN-010-NEG`: an allowed edge or acyclic countercase remains distinct from inability to resolve |
| `JAN-CSAA-006-FAM-011` — Manifest, lockfile, resolved-version, and advisory correlation | `JAN-CSAA-006-SCN-011-POS`: declared, locked, resolved, and advisory identities correlate exactly | `JAN-CSAA-006-SCN-011-NEG`: unknown, stale, conflicting, or mismatched advisory data remains non-green |
| `JAN-CSAA-006-FAM-012` — Dead-code candidates with and without dynamic entry | `JAN-CSAA-006-SCN-012-POS`: a bounded candidate exposes the complete declared entry frontier | `JAN-CSAA-006-SCN-012-NEG`: a dynamic entry contradicts deadness or an unresolved mechanism withholds the conclusion |
| `JAN-CSAA-006-FAM-013` — Contract-compatible and incompatible changes | `JAN-CSAA-006-SCN-013-POS`: compatibility or incompatibility is supported against an exact owner-defined contract | `JAN-CSAA-006-SCN-013-NEG`: missing contract authority or comparison incompatibility prevents a fabricated decision |
| `JAN-CSAA-006-FAM-014` — Coupling increase and decrease | `JAN-CSAA-006-SCN-014-POS`: direction and magnitude are computed over compatible exact graph populations | `JAN-CSAA-006-SCN-014-NEG`: incompatible denominators or candidate architecture cannot produce a governed threshold violation |
| `JAN-CSAA-006-FAM-015` — Test-to-code mapping | `JAN-CSAA-006-SCN-015-POS`: declared, static, coverage-observed, and runtime-observed mapping kinds remain distinct | `JAN-CSAA-006-SCN-015-NEG`: test discovery or passing execution alone does not establish mapped adequacy |
| `JAN-CSAA-006-FAM-016` — Compatible coverage gain and loss | `JAN-CSAA-006-SCN-016-POS`: gain, loss, and unchanged observations use compatible subjects and denominators | `JAN-CSAA-006-SCN-016-NEG`: incompatible coverage sets produce incomparable rather than a numeric delta |
| `JAN-CSAA-006-FAM-017` — Runtime paths corroborating or contradicting static candidates | `JAN-CSAA-006-SCN-017-POS`: an exact workload observation corroborates or contradicts a named static candidate | `JAN-CSAA-006-SCN-017-NEG`: lack of observation never prunes unobserved static possibilities |
| `JAN-CSAA-006-FAM-018` — Matched and mismatched execution-evidence provenance | `JAN-CSAA-006-SCN-018-POS`: build, map, instrumentation, selection, coverage, trace, collector, workload, and environment coordinates match | `JAN-CSAA-006-SCN-018-NEG`: any mismatched coordinate blocks silent correlation |
| `JAN-CSAA-006-FAM-019` — Incremental edit, rename, move, configuration change, and deletion | `JAN-CSAA-006-SCN-019-POS`: affected invalidation and successor lineage are exact for each mutation class | `JAN-CSAA-006-SCN-019-NEG`: an omitted invalidation dependency is detected by full-analysis comparison |
| `JAN-CSAA-006-FAM-020` — Stale cache and interrupted-index recovery | `JAN-CSAA-006-SCN-020-POS`: recovery republishes only an exact complete successor snapshot | `JAN-CSAA-006-SCN-020-NEG`: last-known-good, partial, or interrupted state remains labeled and non-current |

Positive means the declared bounded technical condition is supported. Negative means a controlled countercase under the exact declared basis. Neither term carries approval, safety, permission, or gate effect.

## 10. Nine zero-static-callers cases

Every zero-static-callers case has zero observed static callers, one declared applicable entry mechanism, an unresolved-mechanism subcase yielding inconclusive deadness, a resolved-positive-entry contradiction, and a closed-negative control contributing only to a bounded candidate when every other applicable mechanism is closed and successfully resolved.

| Case | Applicable dynamic-entry mechanism | Required no-false-green judgment |
| --- | --- | --- |
| `JAN-CSAA-006-ZSC-001` | framework route, component, action, loader, handler, or hook entry | `PROPOSED`: zero callers is not deadness; unresolved blocks; positive entry contradicts; closed negative remains candidate only |
| `JAN-CSAA-006-ZSC-002` | reflection or name-based lookup | `PROPOSED`: zero callers is not deadness; unresolved blocks; positive entry contradicts; closed negative remains candidate only |
| `JAN-CSAA-006-ZSC-003` | dynamic import or conditional loading | `PROPOSED`: zero callers is not deadness; unresolved blocks; positive entry contradicts; closed negative remains candidate only |
| `JAN-CSAA-006-ZSC-004` | event, message, command, callback, timer, or subscription entry | `PROPOSED`: zero callers is not deadness; unresolved blocks; positive entry contradicts; closed negative remains candidate only |
| `JAN-CSAA-006-ZSC-005` | dependency-injection or service-registry entry | `PROPOSED`: zero callers is not deadness; unresolved blocks; positive entry contradicts; closed negative remains candidate only |
| `JAN-CSAA-006-ZSC-006` | externally invoked API, job, protocol, or native boundary | `PROPOSED`: zero callers is not deadness; unresolved blocks; positive entry contradicts; closed negative remains candidate only |
| `JAN-CSAA-006-ZSC-007` | runtime-observed entry for one exact workload | `PROPOSED`: zero callers is not deadness; unresolved blocks; positive entry contradicts; closed negative remains candidate only |
| `JAN-CSAA-006-ZSC-008` | generated or virtual-source entry | `PROPOSED`: zero callers is not deadness; unresolved blocks; positive entry contradicts; closed negative remains candidate only |
| `JAN-CSAA-006-ZSC-009` | configuration, manifest, script, plugin, or extension entry | `PROPOSED`: zero callers is not deadness; unresolved blocks; positive entry contradicts; closed negative remains candidate only |

For compact references in §§11–14, `SCN-nnn-POS` and `SCN-nnn-NEG`, for `nnn` from `001` through `020`, resolve exactly to `JAN-CSAA-006-SCN-nnn-POS` and `JAN-CSAA-006-SCN-nnn-NEG`; `ZSC-nnn` resolves exactly to `JAN-CSAA-006-ZSC-nnn`; `ARP-nnn` resolves exactly to `JAN-CSAA-004-ARP-nnn@0.1.0 / Draft`; and `RGT-nnn` resolves exactly to `JAN-CSAA-004-RGT-nnn@0.1.0 / Draft`. In §§11–12, `SCN-050` through `SCN-070` identify the corresponding `CSAA-006-SCN-050` through `CSAA-006-SCN-070` analytical scenario-requirement clusters; they are not permanent Scenario Profile identities and never satisfy a matrix cell's scenario-identity trace by themselves. These local spellings have no independent identity, and an external machine contract must use the full controlling identity.

## 11. Capability-outcome matrix

The eight modes are orthogonal fixture expectations: `POS` supported positive; `NEG` supported negative only over a closed adequate basis; `UNK` unresolved or unsupported; `PAR` bounded partial; `CON` conflicting admissible results; `STA` stale, invalidated, or incompatible; `DYN` dynamic/generated/runtime seam or supported not-applicable; and `NVA` non-vacuity control. Every cell is proposed, non-conferred, and non-executed.

For `CSAA-006-COV-020`, every capability cell's trace tuple is the full capability identity in its row, the outcome mode in its column, at least one full `JAN-CSAA-006-SCN-nnn-POS` or `JAN-CSAA-006-SCN-nnn-NEG` scenario identity resolved from the cell, any separately resolved analytical scenario-requirement clusters, and verification method `JAN-CSAA-006-VER-CAP-001`. A requirement-cluster reference never substitutes for the required scenario identity.

| Capability | POS | NEG | UNK | PAR | CON | STA | DYN | NVA |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `JAN-CSAA-CAP-001` — Parsing and AST extraction | `SCN-002-POS`, `SCN-003-POS` · supported positive within exact CAP basis | `SCN-002-NEG`, `SCN-003-NEG` · closed-basis supported negative only | `SCN-002-NEG`, `SCN-003-NEG` · unresolved frontier remains unknown | `SCN-002-POS`, `SCN-003-POS` · completed and missing regions remain explicit | `SCN-002-POS`, `SCN-003-POS` · conflicting admissible results remain visible | `SCN-002-NEG`, `SCN-003-NEG` · stale or incompatible basis is non-current | `SCN-002-POS`, `SCN-003-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-002-NEG`, `SCN-003-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-002` — Symbol and reference resolution | `SCN-001-POS`, `SCN-003-POS`, `SCN-004-POS` · supported positive within exact CAP basis | `SCN-001-NEG`, `SCN-003-NEG`, `SCN-004-NEG` · closed-basis supported negative only | `SCN-001-NEG`, `SCN-003-NEG`, `SCN-004-NEG` · unresolved frontier remains unknown | `SCN-001-POS`, `SCN-003-POS`, `SCN-004-POS` · completed and missing regions remain explicit | `SCN-001-POS`, `SCN-003-POS`, `SCN-004-POS` · conflicting admissible results remain visible | `SCN-001-NEG`, `SCN-003-NEG`, `SCN-004-NEG` · stale or incompatible basis is non-current | `SCN-001-POS`, `SCN-003-POS`, `SCN-004-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-001-NEG`, `SCN-003-NEG`, `SCN-004-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-003` — Type analysis | `SCN-003-POS`, `SCN-004-POS`, `SCN-013-POS` · supported positive within exact CAP basis | `SCN-003-NEG`, `SCN-004-NEG`, `SCN-013-NEG` · closed-basis supported negative only | `SCN-003-NEG`, `SCN-004-NEG`, `SCN-013-NEG` · unresolved frontier remains unknown | `SCN-003-POS`, `SCN-004-POS`, `SCN-013-POS` · completed and missing regions remain explicit | `SCN-003-POS`, `SCN-004-POS`, `SCN-013-POS` · conflicting admissible results remain visible | `SCN-003-NEG`, `SCN-004-NEG`, `SCN-013-NEG` · stale or incompatible basis is non-current | `SCN-003-POS`, `SCN-004-POS`, `SCN-013-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-003-NEG`, `SCN-004-NEG`, `SCN-013-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-004` — Dependency analysis | `SCN-010-POS`, `SCN-011-POS`, `SCN-019-POS` · supported positive within exact CAP basis | `SCN-010-NEG`, `SCN-011-NEG`, `SCN-019-NEG` · closed-basis supported negative only | `SCN-010-NEG`, `SCN-011-NEG`, `SCN-019-NEG` · unresolved frontier remains unknown | `SCN-010-POS`, `SCN-011-POS`, `SCN-019-POS` · completed and missing regions remain explicit | `SCN-010-POS`, `SCN-011-POS`, `SCN-019-POS` · conflicting admissible results remain visible | `SCN-010-NEG`, `SCN-011-NEG`, `SCN-019-NEG` · stale or incompatible basis is non-current | `SCN-010-POS`, `SCN-011-POS`, `SCN-019-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-010-NEG`, `SCN-011-NEG`, `SCN-019-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-005` — Call-graph construction | `SCN-005-POS`, `SCN-012-POS`, `SCN-017-POS` · supported positive within exact CAP basis | `SCN-005-NEG`, `SCN-012-NEG`, `SCN-017-NEG` · closed-basis supported negative only | `SCN-005-NEG`, `SCN-012-NEG`, `SCN-017-NEG` · unresolved frontier remains unknown | `SCN-005-POS`, `SCN-012-POS`, `SCN-017-POS` · completed and missing regions remain explicit | `SCN-005-POS`, `SCN-012-POS`, `SCN-017-POS` · conflicting admissible results remain visible | `SCN-005-NEG`, `SCN-012-NEG`, `SCN-017-NEG` · stale or incompatible basis is non-current | `SCN-005-POS`, `SCN-012-POS`, `SCN-017-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-005-NEG`, `SCN-012-NEG`, `SCN-017-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-006` — Control-flow construction | `SCN-006-POS`, `SCN-007-POS` · supported positive within exact CAP basis | `SCN-006-NEG`, `SCN-007-NEG` · closed-basis supported negative only | `SCN-006-NEG`, `SCN-007-NEG` · unresolved frontier remains unknown | `SCN-006-POS`, `SCN-007-POS` · completed and missing regions remain explicit | `SCN-006-POS`, `SCN-007-POS` · conflicting admissible results remain visible | `SCN-006-NEG`, `SCN-007-NEG` · stale or incompatible basis is non-current | `SCN-006-POS`, `SCN-007-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-006-NEG`, `SCN-007-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-007` — Data-flow analysis | `SCN-008-POS`, `SCN-009-POS` · supported positive within exact CAP basis | `SCN-008-NEG`, `SCN-009-NEG` · closed-basis supported negative only | `SCN-008-NEG`, `SCN-009-NEG` · unresolved frontier remains unknown | `SCN-008-POS`, `SCN-009-POS` · completed and missing regions remain explicit | `SCN-008-POS`, `SCN-009-POS` · conflicting admissible results remain visible | `SCN-008-NEG`, `SCN-009-NEG` · stale or incompatible basis is non-current | `SCN-008-POS`, `SCN-009-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-008-NEG`, `SCN-009-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-008` — Taint analysis | `SCN-008-POS`, `SCN-009-POS` · supported positive within exact CAP basis | `SCN-008-NEG`, `SCN-009-NEG` · closed-basis supported negative only | `SCN-008-NEG`, `SCN-009-NEG` · unresolved frontier remains unknown | `SCN-008-POS`, `SCN-009-POS` · completed and missing regions remain explicit | `SCN-008-POS`, `SCN-009-POS` · conflicting admissible results remain visible | `SCN-008-NEG`, `SCN-009-NEG` · stale or incompatible basis is non-current | `SCN-008-POS`, `SCN-009-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-008-NEG`, `SCN-009-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-009` — Code-property-graph or graph composition | `SCN-005-POS`, `SCN-006-POS`, `SCN-008-POS`, `SCN-009-POS`, `SCN-010-POS` · supported positive within exact CAP basis | `SCN-005-NEG`, `SCN-006-NEG`, `SCN-008-NEG`, `SCN-009-NEG`, `SCN-010-NEG` · closed-basis supported negative only | `SCN-005-NEG`, `SCN-006-NEG`, `SCN-008-NEG`, `SCN-009-NEG`, `SCN-010-NEG` · unresolved frontier remains unknown | `SCN-005-POS`, `SCN-006-POS`, `SCN-008-POS`, `SCN-009-POS`, `SCN-010-POS` · completed and missing regions remain explicit | `SCN-005-POS`, `SCN-006-POS`, `SCN-008-POS`, `SCN-009-POS`, `SCN-010-POS` · conflicting admissible results remain visible | `SCN-005-NEG`, `SCN-006-NEG`, `SCN-008-NEG`, `SCN-009-NEG`, `SCN-010-NEG` · stale or incompatible basis is non-current | `SCN-005-POS`, `SCN-006-POS`, `SCN-008-POS`, `SCN-009-POS`, `SCN-010-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-005-NEG`, `SCN-006-NEG`, `SCN-008-NEG`, `SCN-009-NEG`, `SCN-010-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-010` — Project-reference and variant resolution | `SCN-010-POS`, `SCN-019-POS` · supported positive within exact CAP basis | `SCN-010-NEG`, `SCN-019-NEG` · closed-basis supported negative only | `SCN-010-NEG`, `SCN-019-NEG` · unresolved frontier remains unknown | `SCN-010-POS`, `SCN-019-POS` · completed and missing regions remain explicit | `SCN-010-POS`, `SCN-019-POS` · conflicting admissible results remain visible | `SCN-010-NEG`, `SCN-019-NEG` · stale or incompatible basis is non-current | `SCN-010-POS`, `SCN-019-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-010-NEG`, `SCN-019-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-011` — Path-alias and module resolution | `SCN-001-POS`, `SCN-010-POS`, `SCN-019-POS` · supported positive within exact CAP basis | `SCN-001-NEG`, `SCN-010-NEG`, `SCN-019-NEG` · closed-basis supported negative only | `SCN-001-NEG`, `SCN-010-NEG`, `SCN-019-NEG` · unresolved frontier remains unknown | `SCN-001-POS`, `SCN-010-POS`, `SCN-019-POS` · completed and missing regions remain explicit | `SCN-001-POS`, `SCN-010-POS`, `SCN-019-POS` · conflicting admissible results remain visible | `SCN-001-NEG`, `SCN-010-NEG`, `SCN-019-NEG` · stale or incompatible basis is non-current | `SCN-001-POS`, `SCN-010-POS`, `SCN-019-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-001-NEG`, `SCN-010-NEG`, `SCN-019-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-012` — Conditional-export resolution | `SCN-001-POS`, `SCN-011-POS` · supported positive within exact CAP basis | `SCN-001-NEG`, `SCN-011-NEG` · closed-basis supported negative only | `SCN-001-NEG`, `SCN-011-NEG` · unresolved frontier remains unknown | `SCN-001-POS`, `SCN-011-POS` · completed and missing regions remain explicit | `SCN-001-POS`, `SCN-011-POS` · conflicting admissible results remain visible | `SCN-001-NEG`, `SCN-011-NEG` · stale or incompatible basis is non-current | `SCN-001-POS`, `SCN-011-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-001-NEG`, `SCN-011-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-013` — Declaration-file and module-augmentation analysis | `SCN-001-POS`, `SCN-004-POS` · supported positive within exact CAP basis | `SCN-001-NEG`, `SCN-004-NEG` · closed-basis supported negative only | `SCN-001-NEG`, `SCN-004-NEG` · unresolved frontier remains unknown | `SCN-001-POS`, `SCN-004-POS` · completed and missing regions remain explicit | `SCN-001-POS`, `SCN-004-POS` · conflicting admissible results remain visible | `SCN-001-NEG`, `SCN-004-NEG` · stale or incompatible basis is non-current | `SCN-001-POS`, `SCN-004-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-001-NEG`, `SCN-004-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-014` — Source-map and source-origin correlation | `SCN-002-POS`, `SCN-018-POS` · supported positive within exact CAP basis | `SCN-002-NEG`, `SCN-018-NEG` · closed-basis supported negative only | `SCN-002-NEG`, `SCN-018-NEG` · unresolved frontier remains unknown | `SCN-002-POS`, `SCN-018-POS` · completed and missing regions remain explicit | `SCN-002-POS`, `SCN-018-POS` · conflicting admissible results remain visible | `SCN-002-NEG`, `SCN-018-NEG` · stale or incompatible basis is non-current | `SCN-002-POS`, `SCN-018-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-002-NEG`, `SCN-018-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-015` — Decorator analysis | `SCN-004-POS`, `SCN-005-POS` · supported positive within exact CAP basis | `SCN-004-NEG`, `SCN-005-NEG` · closed-basis supported negative only | `SCN-004-NEG`, `SCN-005-NEG` · unresolved frontier remains unknown | `SCN-004-POS`, `SCN-005-POS` · completed and missing regions remain explicit | `SCN-004-POS`, `SCN-005-POS` · conflicting admissible results remain visible | `SCN-004-NEG`, `SCN-005-NEG` · stale or incompatible basis is non-current | `SCN-004-POS`, `SCN-005-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-004-NEG`, `SCN-005-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-016` — JSX and TSX analysis | `SCN-002-POS`, `SCN-005-POS` · supported positive within exact CAP basis | `SCN-002-NEG`, `SCN-005-NEG` · closed-basis supported negative only | `SCN-002-NEG`, `SCN-005-NEG` · unresolved frontier remains unknown | `SCN-002-POS`, `SCN-005-POS` · completed and missing regions remain explicit | `SCN-002-POS`, `SCN-005-POS` · conflicting admissible results remain visible | `SCN-002-NEG`, `SCN-005-NEG` · stale or incompatible basis is non-current | `SCN-002-POS`, `SCN-005-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-002-NEG`, `SCN-005-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-017` — Framework-generated TypeScript and virtual-source analysis | `SCN-002-POS` · supported positive within exact CAP basis | `SCN-002-NEG` · closed-basis supported negative only | `SCN-002-NEG` · unresolved frontier remains unknown | `SCN-002-POS` · completed and missing regions remain explicit | `SCN-002-POS` · conflicting admissible results remain visible | `SCN-002-NEG` · stale or incompatible basis is non-current | `SCN-002-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-002-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-018` — Test discovery | `SCN-015-POS` · supported positive within exact CAP basis | `SCN-015-NEG` · closed-basis supported negative only | `SCN-015-NEG` · unresolved frontier remains unknown | `SCN-015-POS` · completed and missing regions remain explicit | `SCN-015-POS` · conflicting admissible results remain visible | `SCN-015-NEG` · stale or incompatible basis is non-current | `SCN-015-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-015-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-019` — Test-to-code mapping | `SCN-015-POS` · supported positive within exact CAP basis | `SCN-015-NEG` · closed-basis supported negative only | `SCN-015-NEG` · unresolved frontier remains unknown | `SCN-015-POS` · completed and missing regions remain explicit | `SCN-015-POS` · conflicting admissible results remain visible | `SCN-015-NEG` · stale or incompatible basis is non-current | `SCN-015-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-015-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-020` — Coverage ingestion | `SCN-016-POS`, `SCN-018-POS` · supported positive within exact CAP basis | `SCN-016-NEG`, `SCN-018-NEG` · closed-basis supported negative only | `SCN-016-NEG`, `SCN-018-NEG` · unresolved frontier remains unknown | `SCN-016-POS`, `SCN-018-POS` · completed and missing regions remain explicit | `SCN-016-POS`, `SCN-018-POS` · conflicting admissible results remain visible | `SCN-016-NEG`, `SCN-018-NEG` · stale or incompatible basis is non-current | `SCN-016-POS`, `SCN-018-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-016-NEG`, `SCN-018-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-021` — Coverage comparison | `SCN-016-POS`, `SCN-018-POS` · supported positive within exact CAP basis | `SCN-016-NEG`, `SCN-018-NEG` · closed-basis supported negative only | `SCN-016-NEG`, `SCN-018-NEG` · unresolved frontier remains unknown | `SCN-016-POS`, `SCN-018-POS` · completed and missing regions remain explicit | `SCN-016-POS`, `SCN-018-POS` · conflicting admissible results remain visible | `SCN-016-NEG`, `SCN-018-NEG` · stale or incompatible basis is non-current | `SCN-016-POS`, `SCN-018-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-016-NEG`, `SCN-018-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-022` — Runtime-trace correlation | `SCN-017-POS`, `SCN-018-POS` · supported positive within exact CAP basis | `SCN-017-NEG`, `SCN-018-NEG` · closed-basis supported negative only | `SCN-017-NEG`, `SCN-018-NEG` · unresolved frontier remains unknown | `SCN-017-POS`, `SCN-018-POS` · completed and missing regions remain explicit | `SCN-017-POS`, `SCN-018-POS` · conflicting admissible results remain visible | `SCN-017-NEG`, `SCN-018-NEG` · stale or incompatible basis is non-current | `SCN-017-POS`, `SCN-018-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-017-NEG`, `SCN-018-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-023` — Generated-code handling | `SCN-002-POS`, `SCN-019-POS` · supported positive within exact CAP basis | `SCN-002-NEG`, `SCN-019-NEG` · closed-basis supported negative only | `SCN-002-NEG`, `SCN-019-NEG` · unresolved frontier remains unknown | `SCN-002-POS`, `SCN-019-POS` · completed and missing regions remain explicit | `SCN-002-POS`, `SCN-019-POS` · conflicting admissible results remain visible | `SCN-002-NEG`, `SCN-019-NEG` · stale or incompatible basis is non-current | `SCN-002-POS`, `SCN-019-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-002-NEG`, `SCN-019-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-024` — Framework modeling | `SCN-002-POS`, `SCN-005-POS`, `SCN-012-POS` · supported positive within exact CAP basis | `SCN-002-NEG`, `SCN-005-NEG`, `SCN-012-NEG` · closed-basis supported negative only | `SCN-002-NEG`, `SCN-005-NEG`, `SCN-012-NEG` · unresolved frontier remains unknown | `SCN-002-POS`, `SCN-005-POS`, `SCN-012-POS` · completed and missing regions remain explicit | `SCN-002-POS`, `SCN-005-POS`, `SCN-012-POS` · conflicting admissible results remain visible | `SCN-002-NEG`, `SCN-005-NEG`, `SCN-012-NEG` · stale or incompatible basis is non-current | `SCN-002-POS`, `SCN-005-POS`, `SCN-012-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-002-NEG`, `SCN-005-NEG`, `SCN-012-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-025` — Reflection and dynamic-entry modeling | `SCN-005-POS`, `SCN-012-POS`, `SCN-017-POS` · supported positive within exact CAP basis | `SCN-005-NEG`, `SCN-012-NEG`, `SCN-017-NEG` · closed-basis supported negative only | `SCN-005-NEG`, `SCN-012-NEG`, `SCN-017-NEG` · unresolved frontier remains unknown | `SCN-005-POS`, `SCN-012-POS`, `SCN-017-POS` · completed and missing regions remain explicit | `SCN-005-POS`, `SCN-012-POS`, `SCN-017-POS` · conflicting admissible results remain visible | `SCN-005-NEG`, `SCN-012-NEG`, `SCN-017-NEG` · stale or incompatible basis is non-current | `SCN-005-POS`, `SCN-012-POS`, `SCN-017-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-005-NEG`, `SCN-012-NEG`, `SCN-017-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-026` — Architecture discovery | `SCN-010-POS`, `SCN-014-POS` · supported positive within exact CAP basis | `SCN-010-NEG`, `SCN-014-NEG` · closed-basis supported negative only | `SCN-010-NEG`, `SCN-014-NEG` · unresolved frontier remains unknown | `SCN-010-POS`, `SCN-014-POS` · completed and missing regions remain explicit | `SCN-010-POS`, `SCN-014-POS` · conflicting admissible results remain visible | `SCN-010-NEG`, `SCN-014-NEG` · stale or incompatible basis is non-current | `SCN-010-POS`, `SCN-014-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-010-NEG`, `SCN-014-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-027` — Semantic enrichment | `SCN-014-POS`, `SCN-019-POS` · supported positive within exact CAP basis | `SCN-014-NEG`, `SCN-019-NEG` · closed-basis supported negative only | `SCN-014-NEG`, `SCN-019-NEG` · unresolved frontier remains unknown | `SCN-014-POS`, `SCN-019-POS` · completed and missing regions remain explicit | `SCN-014-POS`, `SCN-019-POS` · conflicting admissible results remain visible | `SCN-014-NEG`, `SCN-019-NEG` · stale or incompatible basis is non-current | `SCN-014-POS`, `SCN-019-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-014-NEG`, `SCN-019-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-028` — Bounded inference | `SCN-014-POS`, `SCN-017-POS` · supported positive within exact CAP basis | `SCN-014-NEG`, `SCN-017-NEG` · closed-basis supported negative only | `SCN-014-NEG`, `SCN-017-NEG` · unresolved frontier remains unknown | `SCN-014-POS`, `SCN-017-POS` · completed and missing regions remain explicit | `SCN-014-POS`, `SCN-017-POS` · conflicting admissible results remain visible | `SCN-014-NEG`, `SCN-017-NEG` · stale or incompatible basis is non-current | `SCN-014-POS`, `SCN-017-POS` · dynamic seam or exact reasoned N/A remains bounded | `SCN-014-NEG`, `SCN-017-NEG` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-029` — Semantic query | `SCN-013-POS` scenario substrate; `SCN-050`, `SCN-051`, `SCN-052`, `SCN-053`, `SCN-054`, `SCN-055`, `SCN-056`, `SCN-057` · supported positive within exact CAP basis | `SCN-013-NEG` scenario substrate; `SCN-050`, `SCN-051`, `SCN-052`, `SCN-053`, `SCN-054`, `SCN-055`, `SCN-056`, `SCN-057` · closed-basis supported negative only | `SCN-013-NEG` scenario substrate; `SCN-050`, `SCN-051`, `SCN-052`, `SCN-053`, `SCN-054`, `SCN-055`, `SCN-056`, `SCN-057` · unresolved frontier remains unknown | `SCN-013-POS` scenario substrate; `SCN-050`, `SCN-051`, `SCN-052`, `SCN-053`, `SCN-054`, `SCN-055`, `SCN-056`, `SCN-057` · completed and missing regions remain explicit | `SCN-013-POS` scenario substrate; `SCN-050`, `SCN-051`, `SCN-052`, `SCN-053`, `SCN-054`, `SCN-055`, `SCN-056`, `SCN-057` · conflicting admissible results remain visible | `SCN-013-NEG` scenario substrate; `SCN-050`, `SCN-051`, `SCN-052`, `SCN-053`, `SCN-054`, `SCN-055`, `SCN-056`, `SCN-057` · stale or incompatible basis is non-current | `SCN-013-POS` scenario substrate; `SCN-050`, `SCN-051`, `SCN-052`, `SCN-053`, `SCN-054`, `SCN-055`, `SCN-056`, `SCN-057` · dynamic seam or exact reasoned N/A remains bounded | `SCN-013-NEG` scenario substrate; `SCN-050`, `SCN-051`, `SCN-052`, `SCN-053`, `SCN-054`, `SCN-055`, `SCN-056`, `SCN-057` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-030` — Code slicing | `SCN-005-POS` scenario substrate; `SCN-058`, `SCN-059`, `SCN-060` · supported positive within exact CAP basis | `SCN-005-NEG` scenario substrate; `SCN-058`, `SCN-059`, `SCN-060` · closed-basis supported negative only | `SCN-005-NEG` scenario substrate; `SCN-058`, `SCN-059`, `SCN-060` · unresolved frontier remains unknown | `SCN-005-POS` scenario substrate; `SCN-058`, `SCN-059`, `SCN-060` · completed and missing regions remain explicit | `SCN-005-POS` scenario substrate; `SCN-058`, `SCN-059`, `SCN-060` · conflicting admissible results remain visible | `SCN-005-NEG` scenario substrate; `SCN-058`, `SCN-059`, `SCN-060` · stale or incompatible basis is non-current | `SCN-005-POS` scenario substrate; `SCN-058`, `SCN-059`, `SCN-060` · dynamic seam or exact reasoned N/A remains bounded | `SCN-005-NEG` scenario substrate; `SCN-058`, `SCN-059`, `SCN-060` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-031` — Change-impact analysis | `SCN-019-POS` scenario substrate; `SCN-066`, `SCN-067`, `SCN-068`, `SCN-069`, `SCN-070` · supported positive within exact CAP basis | `SCN-019-NEG` scenario substrate; `SCN-066`, `SCN-067`, `SCN-068`, `SCN-069`, `SCN-070` · closed-basis supported negative only | `SCN-019-NEG` scenario substrate; `SCN-066`, `SCN-067`, `SCN-068`, `SCN-069`, `SCN-070` · unresolved frontier remains unknown | `SCN-019-POS` scenario substrate; `SCN-066`, `SCN-067`, `SCN-068`, `SCN-069`, `SCN-070` · completed and missing regions remain explicit | `SCN-019-POS` scenario substrate; `SCN-066`, `SCN-067`, `SCN-068`, `SCN-069`, `SCN-070` · conflicting admissible results remain visible | `SCN-019-NEG` scenario substrate; `SCN-066`, `SCN-067`, `SCN-068`, `SCN-069`, `SCN-070` · stale or incompatible basis is non-current | `SCN-019-POS` scenario substrate; `SCN-066`, `SCN-067`, `SCN-068`, `SCN-069`, `SCN-070` · dynamic seam or exact reasoned N/A remains bounded | `SCN-019-NEG` scenario substrate; `SCN-066`, `SCN-067`, `SCN-068`, `SCN-069`, `SCN-070` · empty output cannot manufacture support |
| `JAN-CSAA-CAP-032` — Before/after semantic and graph comparison | `SCN-013-POS` scenario substrate; `SCN-061`, `SCN-062`, `SCN-063`, `SCN-064`, `SCN-065` · supported positive within exact CAP basis | `SCN-013-NEG` scenario substrate; `SCN-061`, `SCN-062`, `SCN-063`, `SCN-064`, `SCN-065` · closed-basis supported negative only | `SCN-013-NEG` scenario substrate; `SCN-061`, `SCN-062`, `SCN-063`, `SCN-064`, `SCN-065` · unresolved frontier remains unknown | `SCN-013-POS` scenario substrate; `SCN-061`, `SCN-062`, `SCN-063`, `SCN-064`, `SCN-065` · completed and missing regions remain explicit | `SCN-013-POS` scenario substrate; `SCN-061`, `SCN-062`, `SCN-063`, `SCN-064`, `SCN-065` · conflicting admissible results remain visible | `SCN-013-NEG` scenario substrate; `SCN-061`, `SCN-062`, `SCN-063`, `SCN-064`, `SCN-065` · stale or incompatible basis is non-current | `SCN-013-POS` scenario substrate; `SCN-061`, `SCN-062`, `SCN-063`, `SCN-064`, `SCN-065` · dynamic seam or exact reasoned N/A remains bounded | `SCN-013-NEG` scenario substrate; `SCN-061`, `SCN-062`, `SCN-063`, `SCN-064`, `SCN-065` · empty output cannot manufacture support |

## 12. Query, slicing, comparison, and impact matrices

Query cases bind exact snapshots and optional execution evidence without mixing subjects. They preserve truth and six epistemic dimensions separately.

| Query cluster | Required cases | Proposed no-false-green boundary |
| --- | --- | --- |
| `SCN-050` | Same-snapshot reference/result, optional evidence identity, and governed cross-snapshot use | subject or evidence mismatch blocks correlation |
| `SCN-051` | Literal true/false/unknown/conflicting and negation `T→F`, `F→T`, `U→U`, `C→C` | unknown and conflict are not Booleanized |
| `SCN-052` | Existential witness, closed absence, open absence, degraded absence, conflict | no witness is not absence without closure |
| `SCN-053` | Universal closed all-true, counterexample, unknown member, conflict | unknown member prevents universal truth |
| `SCN-054` | Missing relation under closed and open populations | open missing remains unknown |
| `SCN-055` | Joins plus exact/lower-bound counts and aggregations | truth and epistemic dimensions compose separately |
| `SCN-056` | Timeout, cancellation, pagination, truncation, budget, empty matches | degraded or empty cannot become supported absence |
| `SCN-057` | Deterministic or explicit unordered results and ranking | ranking has no authority semantics |

| Surface | Scenario IDs | Required cases |
| --- | --- | --- |
| Slicing | `SCN-058`–`SCN-060` | Forward, backward, and chop with witnesses, exclusions, unsupported regions, and dynamic frontiers |
| Comparison | `SCN-061`–`SCN-065` | Identical, changed, incompatible, ambiguous-lineage, and swapped-subject |
| Impact | `SCN-066`–`SCN-070` | Direct/transitive, configuration/dependency, generated/framework, reflection/dynamic-entry, and runtime corroboration/contradiction |

## 13. Analysis Rule Profile judgment matrix

The eleven columns reproduce `CSAA-004-VFY-031`. Claim character remains fixed. No cell has transition effect because no Repository Gate Profile exists.

For `CSAA-006-COV-020`, every ARP cell's trace tuple is the exact `JAN-CSAA-004-ARP-nnn@0.1.0 / Draft` identity resolved from its row, the judgment mode in its column, the full scenario or ZSC identities resolved from the cell, and verification method `JAN-CSAA-006-VER-ARP-001`.

| ARP | Positive | Negative | Inconclusive | Partial | Stale | Disagreement | Provider failure | Exception | Suppression | Non-bypass | Zero static callers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ARP-001` — Composite implementation readiness; `OWNER_DEFINED_RULE` | `SCN-013-POS`: proposed supported positive under OWNER_DEFINED_RULE | `SCN-013-NEG`: proposed controlled negative under OWNER_DEFINED_RULE | `SCN-013-NEG`: unresolved basis yields inconclusive | `SCN-013-POS`: bounded partial preserves missing work | `SCN-013-NEG`: stale basis is non-current | `SCN-013-POS`: competing admissible judgments remain visible | `SCN-013-NEG`: provider failure yields no technical verdict | `SCN-013-NEG`: exception preserves underlying result | `SCN-013-NEG`: suppression preserves underlying result | `SCN-013-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-013-NEG`: exact N/A — composite readiness evaluates enumerated obligations rather than caller count; no implication |
| `ARP-002` — Syntax and type correctness; `HARD_INVARIANT` | `SCN-002-POS`: proposed supported positive under HARD_INVARIANT | `SCN-002-NEG`: proposed controlled negative under HARD_INVARIANT | `SCN-002-NEG`: unresolved basis yields inconclusive | `SCN-002-POS`: bounded partial preserves missing work | `SCN-002-NEG`: stale basis is non-current | `SCN-002-POS`: competing admissible judgments remain visible | `SCN-002-NEG`: provider failure yields no technical verdict | `SCN-002-NEG`: exception preserves underlying result | `SCN-002-NEG`: suppression preserves underlying result | `SCN-002-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-002-NEG`: exact N/A — syntax and type correctness is not a reachability claim; no implication |
| `ARP-003` — Contract conformance; `OWNER_DEFINED_RULE` | `SCN-013-POS`: proposed supported positive under OWNER_DEFINED_RULE | `SCN-013-NEG`: proposed controlled negative under OWNER_DEFINED_RULE | `SCN-013-NEG`: unresolved basis yields inconclusive | `SCN-013-POS`: bounded partial preserves missing work | `SCN-013-NEG`: stale basis is non-current | `SCN-013-POS`: competing admissible judgments remain visible | `SCN-013-NEG`: provider failure yields no technical verdict | `SCN-013-NEG`: exception preserves underlying result | `SCN-013-NEG`: suppression preserves underlying result | `SCN-013-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-013-NEG`: exact N/A — contract conformance depends on the governed contract rather than caller count; no implication |
| `ARP-004` — Architecture-boundary conformance; `OWNER_DEFINED_RULE` | `SCN-010-POS`: proposed supported positive under OWNER_DEFINED_RULE | `SCN-010-NEG`: proposed controlled negative under OWNER_DEFINED_RULE | `SCN-010-NEG`: unresolved basis yields inconclusive | `SCN-010-POS`: bounded partial preserves missing work | `SCN-010-NEG`: stale basis is non-current | `SCN-010-POS`: competing admissible judgments remain visible | `SCN-010-NEG`: provider failure yields no technical verdict | `SCN-010-NEG`: exception preserves underlying result | `SCN-010-NEG`: suppression preserves underlying result | `SCN-010-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-010-NEG`: exact N/A — architecture-boundary conformance depends on recognized dependency constraints rather than caller count; no implication |
| `ARP-005` — Dependency integrity and cycles; `OWNER_DEFINED_RULE` | `SCN-010-POS`: proposed supported positive under OWNER_DEFINED_RULE | `SCN-010-NEG`: proposed controlled negative under OWNER_DEFINED_RULE | `SCN-010-NEG`: unresolved basis yields inconclusive | `SCN-010-POS`: bounded partial preserves missing work | `SCN-010-NEG`: stale basis is non-current | `SCN-010-POS`: competing admissible judgments remain visible | `SCN-010-NEG`: provider failure yields no technical verdict | `SCN-010-NEG`: exception preserves underlying result | `SCN-010-NEG`: suppression preserves underlying result | `SCN-010-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-010-NEG`: exact N/A — dependency integrity and cycles depend on resolved dependency edges rather than caller count; no implication |
| `ARP-006` — Dead or unreachable code; `HEURISTIC_SMELL` | `SCN-012-POS`: proposed supported positive under HEURISTIC_SMELL | `SCN-012-NEG`: proposed controlled negative under HEURISTIC_SMELL | `SCN-012-NEG`: unresolved basis yields inconclusive | `SCN-012-POS`: bounded partial preserves missing work | `SCN-012-NEG`: stale basis is non-current | `SCN-012-POS`: competing admissible judgments remain visible | `SCN-012-NEG`: provider failure yields no technical verdict | `SCN-012-NEG`: exception preserves underlying result | `SCN-012-NEG`: suppression preserves underlying result | `SCN-012-POS`: only non-bypass semantics are proposed; no carrier exists | `ZSC-001`–`ZSC-009`: bounded candidate or inconclusive; never deadness |
| `ARP-007` — Coupling and change amplification; `METRIC_ADVISORY` | `SCN-014-POS`: proposed supported positive under METRIC_ADVISORY | `SCN-014-NEG`: proposed controlled negative under METRIC_ADVISORY | `SCN-014-NEG`: unresolved basis yields inconclusive | `SCN-014-POS`: bounded partial preserves missing work | `SCN-014-NEG`: stale basis is non-current | `SCN-014-POS`: competing admissible judgments remain visible | `SCN-014-NEG`: provider failure yields no technical verdict | `SCN-014-NEG`: exception preserves underlying result | `SCN-014-NEG`: suppression preserves underlying result | `SCN-014-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-014-NEG`: exact N/A — coupling and change amplification depend on compatible graph populations rather than caller count alone; no implication |
| `ARP-008` — Behavioral preservation; `OWNER_DEFINED_RULE` | `SCN-013-POS`: proposed supported positive under OWNER_DEFINED_RULE | `SCN-013-NEG`: proposed controlled negative under OWNER_DEFINED_RULE | `SCN-013-NEG`: unresolved basis yields inconclusive | `SCN-013-POS`: bounded partial preserves missing work | `SCN-013-NEG`: stale basis is non-current | `SCN-013-POS`: competing admissible judgments remain visible | `SCN-013-NEG`: provider failure yields no technical verdict | `SCN-013-NEG`: exception preserves underlying result | `SCN-013-NEG`: suppression preserves underlying result | `SCN-013-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-013-NEG`: exact N/A — behavioral preservation depends on a governed behavior or contract oracle rather than caller count; no implication |
| `ARP-009` — Test adequacy; `OWNER_DEFINED_RULE` | `SCN-015-POS`: proposed supported positive under OWNER_DEFINED_RULE | `SCN-015-NEG`: proposed controlled negative under OWNER_DEFINED_RULE | `SCN-015-NEG`: unresolved basis yields inconclusive | `SCN-015-POS`: bounded partial preserves missing work | `SCN-015-NEG`: stale basis is non-current | `SCN-015-POS`: competing admissible judgments remain visible | `SCN-015-NEG`: provider failure yields no technical verdict | `SCN-015-NEG`: exception preserves underlying result | `SCN-015-NEG`: suppression preserves underlying result | `SCN-015-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-015-NEG`: exact N/A — test adequacy depends on obligation and test evidence rather than caller count; no implication |
| `ARP-010` — Security weakness and taint flow; `OWNER_DEFINED_RULE` | `SCN-009-POS`: proposed supported positive under OWNER_DEFINED_RULE | `SCN-009-NEG`: proposed controlled negative under OWNER_DEFINED_RULE | `SCN-009-NEG`: unresolved basis yields inconclusive | `SCN-009-POS`: bounded partial preserves missing work | `SCN-009-NEG`: stale basis is non-current | `SCN-009-POS`: competing admissible judgments remain visible | `SCN-009-NEG`: provider failure yields no technical verdict | `SCN-009-NEG`: exception preserves underlying result | `SCN-009-NEG`: suppression preserves underlying result | `SCN-009-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-009-NEG`: exact N/A — security weakness and taint flow depend on rule-bound paths and trust boundaries rather than caller count; no implication |
| `ARP-011` — Third-party and supply-chain exposure; `OWNER_DEFINED_RULE` | `SCN-011-POS`: proposed supported positive under OWNER_DEFINED_RULE | `SCN-011-NEG`: proposed controlled negative under OWNER_DEFINED_RULE | `SCN-011-NEG`: unresolved basis yields inconclusive | `SCN-011-POS`: bounded partial preserves missing work | `SCN-011-NEG`: stale basis is non-current | `SCN-011-POS`: competing admissible judgments remain visible | `SCN-011-NEG`: provider failure yields no technical verdict | `SCN-011-NEG`: exception preserves underlying result | `SCN-011-NEG`: suppression preserves underlying result | `SCN-011-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-011-NEG`: exact N/A — third-party and supply-chain exposure depends on manifest, lockfile, provenance, and advisory evidence rather than caller count; no implication |
| `ARP-012` — Unsafe input/output handling; `OWNER_DEFINED_RULE` | `SCN-008-POS`: proposed supported positive under OWNER_DEFINED_RULE | `SCN-008-NEG`: proposed controlled negative under OWNER_DEFINED_RULE | `SCN-008-NEG`: unresolved basis yields inconclusive | `SCN-008-POS`: bounded partial preserves missing work | `SCN-008-NEG`: stale basis is non-current | `SCN-008-POS`: competing admissible judgments remain visible | `SCN-008-NEG`: provider failure yields no technical verdict | `SCN-008-NEG`: exception preserves underlying result | `SCN-008-NEG`: suppression preserves underlying result | `SCN-008-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-008-NEG`: exact N/A — unsafe input/output handling depends on trust-boundary and data-flow evidence rather than caller count; no implication |
| `ARP-013` — Concurrency and asynchronous-control risk; `HEURISTIC_SMELL` | `SCN-007-POS`: proposed supported positive under HEURISTIC_SMELL | `SCN-007-NEG`: proposed controlled negative under HEURISTIC_SMELL | `SCN-007-NEG`: unresolved basis yields inconclusive | `SCN-007-POS`: bounded partial preserves missing work | `SCN-007-NEG`: stale basis is non-current | `SCN-007-POS`: competing admissible judgments remain visible | `SCN-007-NEG`: provider failure yields no technical verdict | `SCN-007-NEG`: exception preserves underlying result | `SCN-007-NEG`: suppression preserves underlying result | `SCN-007-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-007-NEG`: exact N/A — concurrency and asynchronous-control risk depends on control, ordering, and contract evidence rather than caller count; no implication |
| `ARP-014` — Error and recovery behavior; `HEURISTIC_SMELL` | `SCN-020-POS`: proposed supported positive under HEURISTIC_SMELL | `SCN-020-NEG`: proposed controlled negative under HEURISTIC_SMELL | `SCN-020-NEG`: unresolved basis yields inconclusive | `SCN-020-POS`: bounded partial preserves missing work | `SCN-020-NEG`: stale basis is non-current | `SCN-020-POS`: competing admissible judgments remain visible | `SCN-020-NEG`: provider failure yields no technical verdict | `SCN-020-NEG`: exception preserves underlying result | `SCN-020-NEG`: suppression preserves underlying result | `SCN-020-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-020-NEG`: exact N/A — error and recovery behavior depends on failure-path and recovery evidence rather than caller count; no implication |
| `ARP-015` — Observability sufficiency; `OWNER_DEFINED_RULE` | `SCN-018-POS`: proposed supported positive under OWNER_DEFINED_RULE | `SCN-018-NEG`: proposed controlled negative under OWNER_DEFINED_RULE | `SCN-018-NEG`: unresolved basis yields inconclusive | `SCN-018-POS`: bounded partial preserves missing work | `SCN-018-NEG`: stale basis is non-current | `SCN-018-POS`: competing admissible judgments remain visible | `SCN-018-NEG`: provider failure yields no technical verdict | `SCN-018-NEG`: exception preserves underlying result | `SCN-018-NEG`: suppression preserves underlying result | `SCN-018-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-018-NEG`: exact N/A — observability sufficiency depends on reconstructability evidence rather than caller count; no implication |
| `ARP-016` — Maintainability and complexity; `METRIC_ADVISORY` | `SCN-014-POS`: proposed supported positive under METRIC_ADVISORY | `SCN-014-NEG`: proposed controlled negative under METRIC_ADVISORY | `SCN-014-NEG`: unresolved basis yields inconclusive | `SCN-014-POS`: bounded partial preserves missing work | `SCN-014-NEG`: stale basis is non-current | `SCN-014-POS`: competing admissible judgments remain visible | `SCN-014-NEG`: provider failure yields no technical verdict | `SCN-014-NEG`: exception preserves underlying result | `SCN-014-NEG`: suppression preserves underlying result | `SCN-014-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-014-NEG`: exact N/A — maintainability and complexity depend on declared metrics over an exact subject rather than zero callers alone; no implication |
| `ARP-017` — Semantic-index freshness and completeness; `HARD_INVARIANT` | `SCN-020-POS`: proposed supported positive under HARD_INVARIANT | `SCN-020-NEG`: proposed controlled negative under HARD_INVARIANT | `SCN-020-NEG`: unresolved basis yields inconclusive | `SCN-020-POS`: bounded partial preserves missing work | `SCN-020-NEG`: stale basis is non-current | `SCN-020-POS`: competing admissible judgments remain visible | `SCN-020-NEG`: provider failure yields no technical verdict | `SCN-020-NEG`: exception preserves underlying result | `SCN-020-NEG`: suppression preserves underlying result | `SCN-020-POS`: only non-bypass semantics are proposed; no carrier exists | `SCN-020-NEG`: exact N/A — semantic-index freshness and completeness depend on subject binding, coverage, and invalidation rather than caller count; no implication |

## 14. Repository Gate Template inertness matrix

For `CSAA-006-COV-020`, every RGT cell's trace tuple is the exact `JAN-CSAA-004-RGT-nnn@0.1.0 / Draft` identity resolved from its row, the inertness mode in its column, the full scenario identity resolved from the cell, and verification method `JAN-CSAA-006-VER-RGT-001`. The scenario is a fixture substrate for the proposed template-state judgment; it does not instantiate an RGP or execute a gate.

| RGT | INERT_BASELINE | MISUSE_REJECTION |
| --- | --- | --- |
| `RGT-001` | `SCN-013-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-013-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-002` | `SCN-002-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-002-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-003` | `SCN-013-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-013-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-004` | `SCN-010-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-010-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-005` | `SCN-010-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-010-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-008` | `SCN-013-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-013-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-009` | `SCN-015-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-015-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-010` | `SCN-009-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-009-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-011` | `SCN-011-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-011-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-012` | `SCN-008-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-008-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-016` | `SCN-014-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-014-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |
| `RGT-017` | `SCN-020-POS` · `PROPOSED`: exact `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`; no authority, carrier, evaluation identity, or transition effect | `SCN-020-NEG` · `PROPOSED`: attempted use as an RGP, Gate Evaluation input, or permitting, blocking, or withholding authority is rejected and cannot produce green |

The matrix contains exactly 24 cells. It defines no RGP identity and confers no gate designation.

## 15. Expected semantic, result, and finding records

A scenario may propose expected semantic objects and relations, Query Results, slices, comparisons, impact records, Rule Application Results, findings, treatments, and failure records. Every expected record binds exact scenario, subject, profile, method, provenance, epistemic state, and oracle state.

Expected Rule Application Results retain the five-dimensional outcome product. A finding is created only where the exact fixed claim character and rule criterion say so. Exception and suppression remain separate treatment records. No expected record writes canonical assurance or governance state.

## 16. Two-stream oracle governance

The implementation stream may propose cases and produce observations. The oracle stream defines independently reviewed expected judgments. The identity authoring a change cannot weaken the pre-existing judgment that evaluates that change. Provider output is untrusted input and cannot be copied into the oracle.

Conferral requires a distinct authorized reviewer, exact reviewed bytes, rationale, governing sources, subject/version binding, effective time, and append-only record. No such conferral exists in this Draft. Suspected error creates a divergence; it is never repaired inline merely to make an implementation pass.

## 17. Coverage, completeness, and non-vacuity

| Surface | Exact dimension | Required proof |
| --- | ---: | --- |
| Scenario families | 20 | IDs `FAM-001`–`020`, each with POS and NEG |
| Paired family cases | 40 | No missing or duplicate pair member |
| Zero-static-callers cases | 9 | Every dynamic-entry mechanism receives unresolved, contradiction, and bounded controls |
| Scenario Profile facets | 30 | No blank; explicit state and rationale where unsupported or inapplicable |
| CAP matrix | 256 | `32 × 8`, every cell cites scenario and proposed outcome |
| ARP matrix | 187 | `17 × 11`, fixed claim character and no gate effect |
| RGT matrix | 24 | `12 × 2`, inert baseline and misuse rejection |

Coverage is a declared population statement, not correctness. Missing, duplicate, unexplained `N/A`, or vacuous empty cells fail author-side verification.

## 18. Provenance, explanation, and currentness

Every scenario and expected judgment remains reconstructable to exact inputs, fixture manifest, source and generated mappings, compiler/project/resolver/framework contexts, CAP and ARP versions, mutation, evidence coordinates, witnesses, method, assumptions, limitations, author, reviewer, and oracle state.

Dated evidence never floats. EVIDENCE-007 supports only its observation window. EVIDENCE-008 makes later external drift non-blocking for Draft authoring but blocking for final Proposed freeze. The final consolidated refresh, affected comparison, and rebinding remain visibly unperformed.

## 19. Mutation, invalidation, and successor lineage

| Mutation ID | Required mutation class |
| --- | --- |
| `JAN-CSAA-006-MUT-001` | source edit |
| `JAN-CSAA-006-MUT-002` | source addition |
| `JAN-CSAA-006-MUT-003` | source deletion |
| `JAN-CSAA-006-MUT-004` | rename |
| `JAN-CSAA-006-MUT-005` | move |
| `JAN-CSAA-006-MUT-006` | semantic-relation change |
| `JAN-CSAA-006-MUT-007` | contract, declaration, or generated-source change |
| `JAN-CSAA-006-MUT-008` | manifest change |
| `JAN-CSAA-006-MUT-009` | lockfile or resolved-version change |
| `JAN-CSAA-006-MUT-010` | resolver, path-alias, or condition-set change |
| `JAN-CSAA-006-MUT-011` | project, compiler, framework, or generator change |
| `JAN-CSAA-006-MUT-012` | rule, profile, provider, or model change |
| `JAN-CSAA-006-MUT-013` | build, instrumentation, or test-selection change |
| `JAN-CSAA-006-MUT-014` | coverage, trace, workload, environment, or map change |
| `JAN-CSAA-006-MUT-015` | evidence invalidation |
| `JAN-CSAA-006-MUT-016` | oracle change |
| `JAN-CSAA-006-MUT-017` | dependency-driven transitive invalidation |
| `JAN-CSAA-006-MUT-018` | successor-lineage creation |

Each mutation declares affected facts, graphs, queries, rules, findings, coverage cells, expected judgments, and successor triggers. Incremental output is compared with an exact full-analysis basis before equivalence is claimed.

## 20. Failure and degraded-operation behavior

| Degradation ID | Injected condition | Required proposed treatment |
| --- | --- | --- |
| `JAN-CSAA-006-DEG-001` | unsupported construct or semantic context | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-002` | excluded region | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-003` | not-analyzed region | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-004` | partial result | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-005` | provider or analysis failure | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-006` | timeout | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-007` | cancellation | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-008` | resource exhaustion or budget refusal | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-009` | malformed output | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-010` | stale result | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-011` | incompatible comparison basis | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-012` | conflicting result | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-013` | redacted material | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-014` | access denial | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-015` | truncation or pagination cutoff | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-016` | broken source or generated mapping | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-017` | unavailable or unqualified provider | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-018` | mixed revision or subject mismatch | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-019` | interrupted index or stale cache | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |
| `JAN-CSAA-006-DEG-020` | empty or vacuous output | Explicit non-green state; no coercion to empty, absence, safety, permission, or passing |

Failure of a prerequisite cannot become successful emptiness in a dependent capability. Partial output identifies completed work, missing work, affected region, invalidation dependencies, and epistemic consequences.

## 21. Security, isolation, access, redaction, and retention

Fixture material is untrusted input. Inspection is read-only by default and does not execute imported code, scripts, package lifecycle hooks, or network calls. Scenario workspaces, caches, output, and evidence are isolated. Cross-scenario contamination is a failure.

Access filtering and redaction cannot leak protected existence through counts, paths, graph shape, placeholders, or metadata. Redaction cannot fabricate completeness. Raw material, proposed judgments, reviewer records, and superseded history follow exact retention and access policies.

## 22. Downstream allocations

| Member | Required allocation |
| --- | --- |
| `JAN-CSAA-007` | Encode fixture manifests, scenario profiles, expected records, oracle lifecycle, matrices, mutations, and degraded states without semantic loss |
| `JAN-CSAA-008` | Create executable fixtures and prove exact counts, expected judgments, metamorphic properties, mutations/tests-of-tests, differential behavior, and no-false-green outcomes |
| `JAN-CSAA-009` | Persist immutable fixture/oracle history, isolate runs, schedule execution, recover interrupted work, and bind currentness |
| `JAN-CSAA-010` | Define when coding agents invoke fixtures, consume results, stop, escalate, and report uncertainty without self-approval |
| `JAN-CSAA-011` | Qualify concrete providers against exact independently governed fixture and executable-conformance evidence without reshaping the oracle |

At this correction cutoff, `JAN-CSAA-007@1.0.1 / Draft` (1,343,092 bytes; SHA-256 `b2d034ac20ddca2a3676e152770b28fbccee83ab4a5c882d5a581bd33f1186b6`), `JAN-CSAA-008@0.2.2 / Draft` (261,544 bytes; SHA-256 `f4bbe60c8edc67ac70ddf89e7c3963725252c8915dfceefd5e9d46bd70ef082a`), and `JAN-CSAA-009@0.2.1 / Draft` (386,317 bytes; SHA-256 `963e334aba00a0f1d15500fea34de5ea2bd0f0add3ef2dc5a558db73a2979656`) are authored documentation packages. Their existence closes only the stale “unauthored” description: it does not materialize a fixture, enforce a schema, execute conformance, instantiate an operational topology, qualify a provider, confer an oracle, or satisfy any later lifecycle predicate.

## 23. Normative requirement catalog

Requirement identifiers are permanent within `JAN-CSAA-006`. Retirement preserves history and creates successor treatment; it never reuses an identifier.

### 23.1 Control, lifecycle, and currentness

| ID | Requirement |
| --- | --- |
| `CSAA-006-CTL-001` | The document SHALL retain permanent ID `JAN-CSAA-006`, exact title, semantic version, Draft lifecycle, and HYPOTHESIS settledness. |
| `CSAA-006-CTL-002` | Draft authorship SHALL NOT confer authority, an oracle judgment, fixture acceptance, or executable conformance. |
| `CSAA-006-CTL-003` | The exact adopted `JAN-CSAA-000@0.3.0` authority baseline SHALL remain bound. |
| `CSAA-006-CTL-004` | The exact provisional `JAN-CSAA-001` through `JAN-CSAA-005` inputs SHALL remain bound and byte changes SHALL trigger affected reconciliation. |
| `CSAA-006-CTL-005` | Documentation-only Wave 2 entry SHALL trace to `JAN-CSAA-W1-SEMANTIC-READINESS-001`, `REG-D-021`, and `REG-D-022`. |
| `CSAA-006-CTL-006` | Intermediate live-Git freshness SHALL NOT be a Draft-authoring closure predicate. |
| `CSAA-006-CTL-007` | Repository observations SHALL remain dated evidence coordinates rather than claims of continuous currentness. |
| `CSAA-006-CTL-008` | One consolidated implementation refresh and affected reconciliation SHALL remain mandatory before final corpus freeze. |
| `CSAA-006-CTL-009` | Fixture lanes, scenario identities, expected judgments, coverage, provenance, oracle lifecycle, and degradation SHALL form the exact governed scope. |
| `CSAA-006-CTL-010` | Semantic identity, rule meaning, current repository truth, machine schema, executable conformance, persistence, coding-agent employment, and provider qualification SHALL remain excluded. |
| `CSAA-006-CTL-011` | This Draft SHALL NOT claim that an executable fixture repository, harness, or test result exists. |
| `CSAA-006-CTL-012` | Every expected judgment SHALL remain `PROPOSED / NOT_CONFERRED / NOT_EXECUTED` until separately governed action changes it. |
| `CSAA-006-CTL-013` | This Draft SHALL NOT select or qualify an analyzer provider. |
| `CSAA-006-CTL-014` | This Draft SHALL NOT instantiate a Repository Gate Profile, execute a Gate Evaluation, or create transition effect. |
| `CSAA-006-CTL-015` | A dated JPWB scenario SHALL NOT be represented as a current repository fact after its observation cutoff. |
| `CSAA-006-CTL-016` | Documentation authoring SHALL NOT mutate implementation source, tests, configuration, dependencies, fixtures, schemas, providers, gates, or oracle artifacts. |
| `CSAA-006-CTL-017` | Every local requirement identifier SHALL remain permanent and SHALL NOT be reused. |
| `CSAA-006-CTL-018` | Every applicable inherited and local obligation SHALL receive an individual ledger row. |
| `CSAA-006-CTL-019` | No requirement SHALL receive a green state without reproducible method-bound evidence. |
| `CSAA-006-CTL-020` | A post-freeze semantic byte change SHALL trigger affected re-review and identity rebinding. |
| `CSAA-006-CTL-021` | An author MAY propose a fixture or expectation but SHALL NOT confer its expected judgment. |
| `CSAA-006-CTL-022` | Intermediate sponsor authorization SHALL NOT be required; sponsor review applies to the exact final corpus candidate. |
| `CSAA-006-CTL-023` | No repository file SHALL be staged or committed by this documentation-only activity. |
| `CSAA-006-CTL-024` | Downstream allocation SHALL preserve concern ownership and SHALL NOT create a semantic fork. |

### 23.2 Ownership and concern boundaries

| ID | Requirement |
| --- | --- |
| `CSAA-006-OWN-001` | `JAN-CSAA-006` SHALL own fixture-case and proposed expected-judgment strategy only. |
| `CSAA-006-OWN-002` | `JAN-CSAA-003` SHALL retain ownership of capability, query, slice, comparison, impact, and analysis-result meaning. |
| `CSAA-006-OWN-003` | `JAN-CSAA-004` SHALL retain ownership of rules, Rule Application Results, findings, dispositions, suppressions, exceptions, provider declarations, and gate meaning. |
| `CSAA-006-OWN-004` | `JAN-CSAA-005` SHALL retain ownership of dated JPWB repository description. |
| `CSAA-006-OWN-005` | `JAN-CSAA-007` SHALL own exact fixture, scenario, expected-result, and oracle-record machine shapes. |
| `CSAA-006-OWN-006` | `JAN-CSAA-008` SHALL own executable fixture conformance and no-false-green evidence. |
| `CSAA-006-OWN-007` | `JAN-CSAA-009` SHALL own persistence, scheduling, recovery, isolation, and operational currentness. |
| `CSAA-006-OWN-008` | `JAN-CSAA-010` SHALL own coding-agent employment of fixture and conformance results. |
| `CSAA-006-OWN-009` | `JAN-CSAA-011` SHALL own concrete provider qualification, selection, configuration, and operation. |
| `CSAA-006-OWN-010` | Canon SHALL retain Assurance Policy, Assessment, Evidence, Assurance Observation, Decision, waiver, and Baseline meaning. |
| `CSAA-006-OWN-011` | Synthetic and dated-JPWB fixture lanes SHALL remain distinct and SHALL NOT inherit one another's currentness claims. |
| `CSAA-006-OWN-012` | An authorized independent reviewer SHALL own conferral or change of judgment-grain expected results. |
| `CSAA-006-OWN-013` | A fixture or implementation author SHALL NOT acquire oracle authority by authorship. |
| `CSAA-006-OWN-014` | Provider output SHALL NOT become an expected judgment by copying, majority vote, or unexplained derivation. |
| `CSAA-006-OWN-015` | A change author SHALL NOT weaken a pre-existing expected judgment in the same change merely to obtain conformance. |
| `CSAA-006-OWN-016` | A suspected-wrong expected judgment SHALL create a governed divergence rather than an inline weakening. |
| `CSAA-006-OWN-017` | Every consequential judgment SHALL bind exact subject, version, scope, actor, authority, and effective time. |
| `CSAA-006-OWN-018` | A concern conflict SHALL route to its owner and SHALL NOT be resolved by silent local redefinition. |

### 23.3 Foundations and non-equivalences

| ID | Requirement |
| --- | --- |
| `CSAA-006-FND-001` | A documented expected judgment SHALL NOT be represented as truth about an unexecuted implementation. |
| `CSAA-006-FND-002` | `PROPOSED` SHALL remain distinct from `CONFERRED`. |
| `CSAA-006-FND-003` | `DOCUMENTED` SHALL remain distinct from `EXECUTED`. |
| `CSAA-006-FND-004` | Provider output SHALL remain distinct from an independently governed oracle. |
| `CSAA-006-FND-005` | A supported positive technical condition SHALL NOT by itself create a green conformance or transition result. |
| `CSAA-006-FND-006` | A controlled negative case SHALL NOT mean analyzer failure, safety, or permission. |
| `CSAA-006-FND-007` | An empty result SHALL NOT mean supported absence, adequacy, safety, or passing. |
| `CSAA-006-FND-008` | Zero observed static callers SHALL NOT mean dead code or safe removal. |
| `CSAA-006-FND-009` | A query match SHALL NOT be represented as an Analyzer Finding Record. |
| `CSAA-006-FND-010` | A finding SHALL remain distinct from a Decision, waiver, exception, or Baseline. |
| `CSAA-006-FND-011` | Exception and suppression treatment SHALL preserve the underlying technical result visibly. |
| `CSAA-006-FND-012` | A Repository Gate Template SHALL remain distinct from a Repository Gate Profile and Gate Evaluation. |
| `CSAA-006-FND-013` | A synthetic fixture SHALL NOT be represented as current JPWB repository evidence. |
| `CSAA-006-FND-014` | A dated JPWB scenario SHALL NOT float to a later repository state. |
| `CSAA-006-FND-015` | A runtime observation SHALL support only its exact workload and SHALL NOT establish exhaustive possibility. |
| `CSAA-006-FND-016` | Passing tests SHALL remain verification evidence rather than product validation or approval. |
| `CSAA-006-FND-017` | Coverage percentage SHALL NOT establish test adequacy without exact denominator, selection, mapping, and oracle evidence. |
| `CSAA-006-FND-018` | Confidence SHALL remain distinct from certainty. |
| `CSAA-006-FND-019` | Unknown, unsupported, partial, conflicting, stale, incompatible, and not-evaluated states SHALL remain distinct. |
| `CSAA-006-FND-020` | Assignment, capability, invocation, successful execution, and supported result SHALL remain separate proofs. |
| `CSAA-006-FND-021` | Observation SHALL remain distinct from admitted Evidence. |
| `CSAA-006-FND-022` | A technical gate result SHALL NOT write canonical assurance or governance state. |
| `CSAA-006-FND-023` | `UNASSIGNED`, `UNKNOWN`, `PENDING`, and `N/A` SHALL remain distinct and non-substitutable. |
| `CSAA-006-FND-024` | Unsafe uncertainty SHALL fail closed without manufacturing rejection, satisfaction, or not-applicable. |

### 23.4 Scenario Profile model

| ID | Requirement |
| --- | --- |
| `CSAA-006-MOD-001` | Every Scenario Profile SHALL populate facet 01, scenario identity and semantic version, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-002` | Every Scenario Profile SHALL populate facet 02, scenario lifecycle and oracle state, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-003` | Every Scenario Profile SHALL populate facet 03, fixture lane, family, case, and outcome mode, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-004` | Every Scenario Profile SHALL populate facet 04, protected engineering or assurance question, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-005` | Every Scenario Profile SHALL populate facet 05, exact pre-change subject, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-006` | Every Scenario Profile SHALL populate facet 06, exact post-change subject or explicit not-applicable state, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-007` | Every Scenario Profile SHALL populate facet 07, repository cutoff and working-change identity, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-008` | Every Scenario Profile SHALL populate facet 08, included and excluded implementation, configuration, and generated perimeter, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-009` | Every Scenario Profile SHALL populate facet 09, compiler, project, resolver, framework, generator, and variant contexts, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-010` | Every Scenario Profile SHALL populate facet 10, manifest, lockfile, tool, and evidence coordinates, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-011` | Every Scenario Profile SHALL populate facet 11, fixture manifest and content digests, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-012` | Every Scenario Profile SHALL populate facet 12, exact mutation or change operation, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-013` | Every Scenario Profile SHALL populate facet 13, applicable Analysis Capability Profile versions, prerequisites, and coverage, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-014` | Every Scenario Profile SHALL populate facet 14, query, slice, comparison, and impact bindings, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-015` | Every Scenario Profile SHALL populate facet 15, Analysis Rule Profile version, claim character, applicability, and rule basis, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-016` | Every Scenario Profile SHALL populate facet 16, Repository Gate Template inert-design reference or supported not-applicable state, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-017` | Every Scenario Profile SHALL populate facet 17, expected semantic objects, facts, and relations, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-018` | Every Scenario Profile SHALL populate facet 18, expected truth projection and orthogonal epistemic dimensions, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-019` | Every Scenario Profile SHALL populate facet 19, expected slice, delta, impact, witness, and frontier, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-020` | Every Scenario Profile SHALL populate facet 20, expected Rule Application Result, finding, disposition, suppression, and exception state, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-021` | Every Scenario Profile SHALL populate facet 21, expected gate or template boundary and absence of real transition effect, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-022` | Every Scenario Profile SHALL populate facet 22, runtime, test, coverage, and trace coordinates, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-023` | Every Scenario Profile SHALL populate facet 23, population, denominator, exclusions, bounds, and closure conditions, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-024` | Every Scenario Profile SHALL populate facet 24, positive, negative, unknown, partial, conflict, stale, dynamic, or non-vacuity outcome mode, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-025` | Every Scenario Profile SHALL populate facet 25, failure or degradation injection and expected non-green treatment, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-026` | Every Scenario Profile SHALL populate facet 26, explanation, witness, derivation, and rationale, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-027` | Every Scenario Profile SHALL populate facet 27, oracle author, reviewer, authority, and conferral state, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-028` | Every Scenario Profile SHALL populate facet 28, provenance, invalidation, correction, and supersession, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-029` | Every Scenario Profile SHALL populate facet 29, verification IDs and downstream executable allocation, with an exact value or a supported explicit state plus rationale. |
| `CSAA-006-MOD-030` | Every Scenario Profile SHALL populate facet 30, security, access, redaction, retention, and isolation, with an exact value or a supported explicit state plus rationale. |

### 23.5 Fixture structure

| ID | Requirement |
| --- | --- |
| `CSAA-006-STR-001` | The fixture strategy SHALL contain both a synthetic lane and a dated-JPWB lane. |
| `CSAA-006-STR-002` | The synthetic repository SHALL remain small enough for independent exhaustive review within a declared boundary. |
| `CSAA-006-STR-003` | The synthetic repository SHALL have a versioned fixture manifest enumerating every artifact. |
| `CSAA-006-STR-004` | Every fixture artifact SHALL bind stable identity, content digest, classification, and role. |
| `CSAA-006-STR-005` | Synthetic project, compiler, resolver, framework, generator, and variant configuration SHALL be explicit. |
| `CSAA-006-STR-006` | Fixture inspection SHALL NOT execute repository scripts, install dependencies, or call undeclared networks. |
| `CSAA-006-STR-007` | Ordering SHALL be deterministic or explicitly declared unordered with comparison rules. |
| `CSAA-006-STR-008` | Synthetic inputs SHALL be self-contained or bind exact immutable external evidence coordinates. |
| `CSAA-006-STR-009` | Semantic objects SHALL use stable seeded identities suitable for exact expected relations. |
| `CSAA-006-STR-010` | Expected semantic facts SHALL be enumerated within the declared review boundary. |
| `CSAA-006-STR-011` | Known omissions, unsupported constructs, exclusions, and blind spots SHALL remain explicit. |
| `CSAA-006-STR-012` | Each dated-JPWB scenario SHALL bind an exact dated repository and evidence coordinate. |
| `CSAA-006-STR-013` | A dated-JPWB scenario SHALL be version-pinned and SHALL NOT claim live currentness. |
| `CSAA-006-STR-014` | The dated lane SHALL cover realistic monorepo and project-reference behavior. |
| `CSAA-006-STR-015` | The dated lane SHALL cover authored Svelte, generated contracts, and source-origin mappings. |
| `CSAA-006-STR-016` | The dated lane SHALL cover architecture-boundary and dependency behavior. |
| `CSAA-006-STR-017` | The dated lane SHALL cover tests, coverage, runtime evidence, and provenance compatibility. |
| `CSAA-006-STR-018` | A dated scenario SHALL select the minimum sufficient evidence rather than copy an unbounded repository. |
| `CSAA-006-STR-019` | Access, confidentiality, redaction, and retention SHALL be specified per fixture artifact. |
| `CSAA-006-STR-020` | Scenario workspaces SHALL be logically isolated. |
| `CSAA-006-STR-021` | One scenario SHALL NOT contaminate another scenario's files, caches, evidence, or expected results. |
| `CSAA-006-STR-022` | Reset and recovery behavior SHALL restore a declared exact starting state. |
| `CSAA-006-STR-023` | Pre-change and post-change subjects SHALL be immutable identified fixture states. |
| `CSAA-006-STR-024` | Every change scenario SHALL express an exact mutation operation. |
| `CSAA-006-STR-025` | Raw and external supporting artifacts SHALL remain retained or immutably referenced. |
| `CSAA-006-STR-026` | Exact repository and serialization shape SHALL remain deferred to `JAN-CSAA-007`. |

### 23.6 Scenario requirements

| ID | Requirement |
| --- | --- |
| `CSAA-006-SCN-001` | Scenario family `JAN-CSAA-006-FAM-001` SHALL define `JAN-CSAA-006-SCN-001-POS` as a controlled supported-positive case for Symbol aliasing and re-exports: an alias and re-export chain resolves to the exact declaration identity. |
| `CSAA-006-SCN-002` | Scenario family `JAN-CSAA-006-FAM-001` SHALL define `JAN-CSAA-006-SCN-001-NEG` as a controlled countercase for Symbol aliasing and re-exports: a same-spelled or deliberately broken chain remains distinct, unresolved, or conflicting; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-003` | Scenario family `JAN-CSAA-006-FAM-002` SHALL define `JAN-CSAA-006-SCN-002-POS` as a controlled supported-positive case for Authored Svelte to generated or virtual TypeScript mapping: authored and generated identities correlate with exact diagnostic-location fidelity. |
| `CSAA-006-SCN-004` | Scenario family `JAN-CSAA-006-FAM-002` SHALL define `JAN-CSAA-006-SCN-002-NEG` as a controlled countercase for Authored Svelte to generated or virtual TypeScript mapping: a broken, ambiguous, or mismatched mapping remains visible and cannot attribute silently; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-005` | Scenario family `JAN-CSAA-006-FAM-003` SHALL define `JAN-CSAA-006-SCN-003-POS` as a controlled supported-positive case for Generics and overload resolution: the exact substitution and overload candidate are supported under the bound checker context. |
| `CSAA-006-SCN-006` | Scenario family `JAN-CSAA-006-FAM-003` SHALL define `JAN-CSAA-006-SCN-003-NEG` as a controlled countercase for Generics and overload resolution: an ambiguous, incompatible, or error-type case remains unresolved rather than falsely selected; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-007` | Scenario family `JAN-CSAA-006-FAM-004` SHALL define `JAN-CSAA-006-SCN-004-POS` as a controlled supported-positive case for Inheritance and interface implementation: the exact implementation and inherited-member relations are supported. |
| `CSAA-006-SCN-008` | Scenario family `JAN-CSAA-006-FAM-004` SHALL define `JAN-CSAA-006-SCN-004-NEG` as a controlled countercase for Inheritance and interface implementation: a structurally similar but non-implementing or incompatible type is not conflated; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-009` | Scenario family `JAN-CSAA-006-FAM-005` SHALL define `JAN-CSAA-006-SCN-005-POS` as a controlled supported-positive case for Dynamic dispatch and unresolved target frontiers: a bounded target set and its dispatch basis are exposed. |
| `CSAA-006-SCN-010` | Scenario family `JAN-CSAA-006-FAM-005` SHALL define `JAN-CSAA-006-SCN-005-NEG` as a controlled countercase for Dynamic dispatch and unresolved target frontiers: an unresolved target frontier prevents a universal or closed negative conclusion; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-011` | Scenario family `JAN-CSAA-006-FAM-006` SHALL define `JAN-CSAA-006-SCN-006-POS` as a controlled supported-positive case for Reachable and unreachable branches: a branch reachability result carries an exact control-flow witness. |
| `CSAA-006-SCN-012` | Scenario family `JAN-CSAA-006-FAM-006` SHALL define `JAN-CSAA-006-SCN-006-NEG` as a controlled countercase for Reachable and unreachable branches: unsupported control semantics prevent a false unreachable conclusion; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-013` | Scenario family `JAN-CSAA-006-FAM-007` SHALL define `JAN-CSAA-006-SCN-007-POS` as a controlled supported-positive case for Async, exceptional, cancellation, and generator control flow: supported normal and non-normal control edges are represented separately. |
| `CSAA-006-SCN-014` | Scenario family `JAN-CSAA-006-FAM-007` SHALL define `JAN-CSAA-006-SCN-007-NEG` as a controlled countercase for Async, exceptional, cancellation, and generator control flow: an unsupported async or exceptional seam remains unknown rather than absent; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-015` | Scenario family `JAN-CSAA-006-FAM-008` SHALL define `JAN-CSAA-006-SCN-008-POS` as a controlled supported-positive case for Source through sanitizer to sink flow: the path, sanitizer effect, rule basis, and remaining frontier are explicit. |
| `CSAA-006-SCN-016` | Scenario family `JAN-CSAA-006-FAM-008` SHALL define `JAN-CSAA-006-SCN-008-NEG` as a controlled countercase for Source through sanitizer to sink flow: a look-alike sanitizer without the exact rule does not terminate taint; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-017` | Scenario family `JAN-CSAA-006-FAM-009` SHALL define `JAN-CSAA-006-SCN-009-POS` as a controlled supported-positive case for Unsafe source-to-sink flow: a source-to-sink witness without an effective sanitizer is supported. |
| `CSAA-006-SCN-018` | Scenario family `JAN-CSAA-006-FAM-009` SHALL define `JAN-CSAA-006-SCN-009-NEG` as a controlled countercase for Unsafe source-to-sink flow: a closed safe countercase is negative only under complete declared source, sink, and propagation coverage; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-019` | Scenario family `JAN-CSAA-006-FAM-010` SHALL define `JAN-CSAA-006-SCN-010-POS` as a controlled supported-positive case for Dependency cycles and forbidden package edges: the exact cycle or prohibited edge and resolution context are supported. |
| `CSAA-006-SCN-020` | Scenario family `JAN-CSAA-006-FAM-010` SHALL define `JAN-CSAA-006-SCN-010-NEG` as a controlled countercase for Dependency cycles and forbidden package edges: an allowed edge or acyclic countercase remains distinct from inability to resolve; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-021` | Scenario family `JAN-CSAA-006-FAM-011` SHALL define `JAN-CSAA-006-SCN-011-POS` as a controlled supported-positive case for Manifest, lockfile, resolved-version, and advisory correlation: declared, locked, resolved, and advisory identities correlate exactly. |
| `CSAA-006-SCN-022` | Scenario family `JAN-CSAA-006-FAM-011` SHALL define `JAN-CSAA-006-SCN-011-NEG` as a controlled countercase for Manifest, lockfile, resolved-version, and advisory correlation: unknown, stale, conflicting, or mismatched advisory data remains non-green; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-023` | Scenario family `JAN-CSAA-006-FAM-012` SHALL define `JAN-CSAA-006-SCN-012-POS` as a controlled supported-positive case for Dead-code candidates with and without dynamic entry: a bounded candidate exposes the complete declared entry frontier. |
| `CSAA-006-SCN-024` | Scenario family `JAN-CSAA-006-FAM-012` SHALL define `JAN-CSAA-006-SCN-012-NEG` as a controlled countercase for Dead-code candidates with and without dynamic entry: a dynamic entry contradicts deadness or an unresolved mechanism withholds the conclusion; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-025` | Scenario family `JAN-CSAA-006-FAM-013` SHALL define `JAN-CSAA-006-SCN-013-POS` as a controlled supported-positive case for Contract-compatible and incompatible changes: compatibility or incompatibility is supported against an exact owner-defined contract. |
| `CSAA-006-SCN-026` | Scenario family `JAN-CSAA-006-FAM-013` SHALL define `JAN-CSAA-006-SCN-013-NEG` as a controlled countercase for Contract-compatible and incompatible changes: missing contract authority or comparison incompatibility prevents a fabricated decision; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-027` | Scenario family `JAN-CSAA-006-FAM-014` SHALL define `JAN-CSAA-006-SCN-014-POS` as a controlled supported-positive case for Coupling increase and decrease: direction and magnitude are computed over compatible exact graph populations. |
| `CSAA-006-SCN-028` | Scenario family `JAN-CSAA-006-FAM-014` SHALL define `JAN-CSAA-006-SCN-014-NEG` as a controlled countercase for Coupling increase and decrease: incompatible denominators or candidate architecture cannot produce a governed threshold violation; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-029` | Scenario family `JAN-CSAA-006-FAM-015` SHALL define `JAN-CSAA-006-SCN-015-POS` as a controlled supported-positive case for Test-to-code mapping: declared, static, coverage-observed, and runtime-observed mapping kinds remain distinct. |
| `CSAA-006-SCN-030` | Scenario family `JAN-CSAA-006-FAM-015` SHALL define `JAN-CSAA-006-SCN-015-NEG` as a controlled countercase for Test-to-code mapping: test discovery or passing execution alone does not establish mapped adequacy; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-031` | Scenario family `JAN-CSAA-006-FAM-016` SHALL define `JAN-CSAA-006-SCN-016-POS` as a controlled supported-positive case for Compatible coverage gain and loss: gain, loss, and unchanged observations use compatible subjects and denominators. |
| `CSAA-006-SCN-032` | Scenario family `JAN-CSAA-006-FAM-016` SHALL define `JAN-CSAA-006-SCN-016-NEG` as a controlled countercase for Compatible coverage gain and loss: incompatible coverage sets produce incomparable rather than a numeric delta; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-033` | Scenario family `JAN-CSAA-006-FAM-017` SHALL define `JAN-CSAA-006-SCN-017-POS` as a controlled supported-positive case for Runtime paths corroborating or contradicting static candidates: an exact workload observation corroborates or contradicts a named static candidate. |
| `CSAA-006-SCN-034` | Scenario family `JAN-CSAA-006-FAM-017` SHALL define `JAN-CSAA-006-SCN-017-NEG` as a controlled countercase for Runtime paths corroborating or contradicting static candidates: lack of observation never prunes unobserved static possibilities; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-035` | Scenario family `JAN-CSAA-006-FAM-018` SHALL define `JAN-CSAA-006-SCN-018-POS` as a controlled supported-positive case for Matched and mismatched execution-evidence provenance: build, map, instrumentation, selection, coverage, trace, collector, workload, and environment coordinates match. |
| `CSAA-006-SCN-036` | Scenario family `JAN-CSAA-006-FAM-018` SHALL define `JAN-CSAA-006-SCN-018-NEG` as a controlled countercase for Matched and mismatched execution-evidence provenance: any mismatched coordinate blocks silent correlation; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-037` | Scenario family `JAN-CSAA-006-FAM-019` SHALL define `JAN-CSAA-006-SCN-019-POS` as a controlled supported-positive case for Incremental edit, rename, move, configuration change, and deletion: affected invalidation and successor lineage are exact for each mutation class. |
| `CSAA-006-SCN-038` | Scenario family `JAN-CSAA-006-FAM-019` SHALL define `JAN-CSAA-006-SCN-019-NEG` as a controlled countercase for Incremental edit, rename, move, configuration change, and deletion: an omitted invalidation dependency is detected by full-analysis comparison; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-039` | Scenario family `JAN-CSAA-006-FAM-020` SHALL define `JAN-CSAA-006-SCN-020-POS` as a controlled supported-positive case for Stale cache and interrupted-index recovery: recovery republishes only an exact complete successor snapshot. |
| `CSAA-006-SCN-040` | Scenario family `JAN-CSAA-006-FAM-020` SHALL define `JAN-CSAA-006-SCN-020-NEG` as a controlled countercase for Stale cache and interrupted-index recovery: last-known-good, partial, or interrupted state remains labeled and non-current; negative SHALL NOT mean execution failure or permission. |
| `CSAA-006-SCN-041` | `JAN-CSAA-006-ZSC-001` SHALL exercise zero observed static callers with framework route, component, action, loader, handler, or hook entry, an unresolved-mechanism inconclusive case, a resolved-positive-entry contradiction, and a closed-negative bounded-candidate control. |
| `CSAA-006-SCN-042` | `JAN-CSAA-006-ZSC-002` SHALL exercise zero observed static callers with reflection or name-based lookup, an unresolved-mechanism inconclusive case, a resolved-positive-entry contradiction, and a closed-negative bounded-candidate control. |
| `CSAA-006-SCN-043` | `JAN-CSAA-006-ZSC-003` SHALL exercise zero observed static callers with dynamic import or conditional loading, an unresolved-mechanism inconclusive case, a resolved-positive-entry contradiction, and a closed-negative bounded-candidate control. |
| `CSAA-006-SCN-044` | `JAN-CSAA-006-ZSC-004` SHALL exercise zero observed static callers with event, message, command, callback, timer, or subscription entry, an unresolved-mechanism inconclusive case, a resolved-positive-entry contradiction, and a closed-negative bounded-candidate control. |
| `CSAA-006-SCN-045` | `JAN-CSAA-006-ZSC-005` SHALL exercise zero observed static callers with dependency-injection or service-registry entry, an unresolved-mechanism inconclusive case, a resolved-positive-entry contradiction, and a closed-negative bounded-candidate control. |
| `CSAA-006-SCN-046` | `JAN-CSAA-006-ZSC-006` SHALL exercise zero observed static callers with externally invoked API, job, protocol, or native boundary, an unresolved-mechanism inconclusive case, a resolved-positive-entry contradiction, and a closed-negative bounded-candidate control. |
| `CSAA-006-SCN-047` | `JAN-CSAA-006-ZSC-007` SHALL exercise zero observed static callers with runtime-observed entry for one exact workload, an unresolved-mechanism inconclusive case, a resolved-positive-entry contradiction, and a closed-negative bounded-candidate control. |
| `CSAA-006-SCN-048` | `JAN-CSAA-006-ZSC-008` SHALL exercise zero observed static callers with generated or virtual-source entry, an unresolved-mechanism inconclusive case, a resolved-positive-entry contradiction, and a closed-negative bounded-candidate control. |
| `CSAA-006-SCN-049` | `JAN-CSAA-006-ZSC-009` SHALL exercise zero observed static callers with configuration, manifest, script, plugin, or extension entry, an unresolved-mechanism inconclusive case, a resolved-positive-entry contradiction, and a closed-negative bounded-candidate control. |
| `CSAA-006-SCN-050` | Query scenarios SHALL bind Query Reference and Query Result Binding to the same exact snapshot, bind the same optional Execution Evidence Set or explicit `N/A`, and use CAP-032 or independent pairs for cross-snapshot work. |
| `CSAA-006-SCN-051` | Query scenarios SHALL cover supported true, false, unknown, and conflicting projections and negation mappings `T→F`, `F→T`, `U→U`, and `C→C`. |
| `CSAA-006-SCN-052` | Existential-query scenarios SHALL cover witness, closed supported absence, open absence, degraded absence, and conflict. |
| `CSAA-006-SCN-053` | Universal-query scenarios SHALL cover closed all-true, counterexample, unknown member, and conflict. |
| `CSAA-006-SCN-054` | Missing-relation scenarios SHALL distinguish closed supported absence from open, incomplete, failed, or excluded populations. |
| `CSAA-006-SCN-055` | Join, count, and aggregation scenarios SHALL compose truth and six epistemic dimensions separately and distinguish exact counts from lower bounds. |
| `CSAA-006-SCN-056` | Timeout, cancellation, pagination, truncation, budget exhaustion, and empty-match scenarios SHALL remain distinct and non-vacuous. |
| `CSAA-006-SCN-057` | Ordering scenarios SHALL prove deterministic order or explicit unorderedness and SHALL NOT give ranking authority meaning. |
| `CSAA-006-SCN-058` | Forward-slice scenarios SHALL expose included members, witness paths, and unresolved frontiers. |
| `CSAA-006-SCN-059` | Backward-slice scenarios SHALL expose included members, witness paths, and unresolved frontiers. |
| `CSAA-006-SCN-060` | Chop scenarios SHALL expose the bounded intersection, witness paths, exclusions, and unresolved frontiers. |
| `CSAA-006-SCN-061` | Comparison scenarios SHALL cover identical exact subjects without inferring behavior preservation. |
| `CSAA-006-SCN-062` | Comparison scenarios SHALL cover added, removed, modified, moved, renamed, and reclassified semantics. |
| `CSAA-006-SCN-063` | Comparison scenarios SHALL produce incomparable for incompatible profile, model, provider, or subject bases. |
| `CSAA-006-SCN-064` | Comparison scenarios SHALL preserve ambiguous lineage and competing matches. |
| `CSAA-006-SCN-065` | Comparison scenarios SHALL reject or visibly identify swapped before and after subjects. |
| `CSAA-006-SCN-066` | Impact scenarios SHALL cover direct and transitive propagation separately. |
| `CSAA-006-SCN-067` | Impact scenarios SHALL cover configuration and dependency changes. |
| `CSAA-006-SCN-068` | Impact scenarios SHALL cover generated and framework-mediated effects. |
| `CSAA-006-SCN-069` | Impact scenarios SHALL cover reflection, registration, and dynamic-entry effects. |
| `CSAA-006-SCN-070` | Impact scenarios SHALL cover runtime corroboration and contradiction without treating unobserved paths as impossible. |

### 23.7 Oracle governance and expected judgments

| ID | Requirement |
| --- | --- |
| `CSAA-006-ORC-001` | Every expected judgment SHALL have a permanent identity and semantic version. |
| `CSAA-006-ORC-002` | Every expected judgment SHALL have explicit lifecycle, predecessor, successor, and oracle state. |
| `CSAA-006-ORC-003` | Every authored expected judgment SHALL begin `PROPOSED / NOT_CONFERRED / NOT_EXECUTED`. |
| `CSAA-006-ORC-004` | Every expected judgment SHALL identify its author. |
| `CSAA-006-ORC-005` | Every conferred expected judgment SHALL identify an independent reviewer. |
| `CSAA-006-ORC-006` | Every consequential oracle act SHALL cite exact effective authority. |
| `CSAA-006-ORC-007` | Absence of a conferral record SHALL remain explicit and non-green. |
| `CSAA-006-ORC-008` | Provider output SHALL NOT be copied, normalized, voted, or inferred into the expected judgment. |
| `CSAA-006-ORC-009` | Oracle and implementation streams SHALL remain authority-separated. |
| `CSAA-006-ORC-010` | An oracle semantic change SHALL create a successor and preserve the predecessor. |
| `CSAA-006-ORC-011` | A suspected-wrong oracle SHALL create an explicit divergence with separate adjudication. |
| `CSAA-006-ORC-012` | An unreviewed expected judgment SHALL NOT produce a green conformance claim. |
| `CSAA-006-ORC-013` | Every Analysis Rule Profile SHALL receive a proposed positive judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-014` | Every Analysis Rule Profile SHALL receive a proposed negative judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-015` | Every Analysis Rule Profile SHALL receive a proposed inconclusive judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-016` | Every Analysis Rule Profile SHALL receive a proposed partial judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-017` | Every Analysis Rule Profile SHALL receive a proposed stale judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-018` | Every Analysis Rule Profile SHALL receive a proposed disagreement judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-019` | Every Analysis Rule Profile SHALL receive a proposed provider failure judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-020` | Every Analysis Rule Profile SHALL receive a proposed exception judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-021` | Every Analysis Rule Profile SHALL receive a proposed suppression judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-022` | Every Analysis Rule Profile SHALL receive a proposed non-bypass judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-023` | Every Analysis Rule Profile SHALL receive a proposed zero-static-callers judgment whose applicability, basis, underlying result, and absence of transition effect remain explicit. |
| `CSAA-006-ORC-024` | Each Analysis Rule Profile judgment SHALL preserve its fixed claim character. |
| `CSAA-006-ORC-025` | A hard-invariant profile SHALL distinguish supported satisfaction from supported violation. |
| `CSAA-006-ORC-026` | An owner-defined-rule profile SHALL cite the exact owner-defined criterion for satisfaction or violation. |
| `CSAA-006-ORC-027` | A heuristic-smell profile SHALL report bounded risk detection or non-detection and SHALL NOT claim universal safety. |
| `CSAA-006-ORC-028` | A metric-advisory profile SHALL report compatible measurement and direction and SHALL NOT create a violation without an exact separately owned threshold. |
| `CSAA-006-ORC-029` | An exception judgment SHALL preserve the underlying violation or evidence deficiency visibly. |
| `CSAA-006-ORC-030` | A suppression judgment SHALL preserve the underlying technical result and treatment history visibly. |
| `CSAA-006-ORC-031` | A finding judgment SHALL preserve durable occurrence identity and SHALL NOT disappear after remediation or later success. |
| `CSAA-006-ORC-032` | Expected Rule Application Results and findings SHALL carry reciprocal exact identities where a finding exists. |
| `CSAA-006-ORC-033` | No expected judgment SHALL instantiate an RGP, execute a gate, or create transition effect. |
| `CSAA-006-ORC-034` | Every RGT misuse attempt SHALL be rejected as `NOT_A_PROFILE` and SHALL NOT become an evaluation input. |
| `CSAA-006-ORC-035` | Required reviewer independence SHALL be checked across producer, reviewer, agent, model, provider, hidden context, prompt lineage, and authority. |
| `CSAA-006-ORC-036` | Every oracle act SHALL preserve author, reviewer, rationale, source, subject, and version provenance. |
| `CSAA-006-ORC-037` | Every expected judgment SHALL state an inspectable rationale and cited basis. |
| `CSAA-006-ORC-038` | Every expected judgment SHALL bind exact source, subject, version, and applicable profile identities. |
| `CSAA-006-ORC-039` | Conflicting proposed or reviewed judgments SHALL remain visible until governed resolution. |
| `CSAA-006-ORC-040` | Correction, revocation, and supersession SHALL preserve append-only history. |
| `CSAA-006-ORC-041` | Time-limited expected judgments SHALL bind expiry and review triggers. |
| `CSAA-006-ORC-042` | A change author SHALL NOT weaken an expected judgment merely to make implementation output conform. |
| `CSAA-006-ORC-043` | Oracle adequacy SHALL include adversarial negative, degraded, and no-false-green cases. |
| `CSAA-006-ORC-044` | Exact expected-result and oracle-record field shapes SHALL remain deferred to `JAN-CSAA-007`. |

### 23.8 Coverage and matrices

| ID | Requirement |
| --- | --- |
| `CSAA-006-COV-001` | Coverage SHALL include exactly twenty required scenario families. |
| `CSAA-006-COV-002` | Coverage SHALL include exactly forty paired positive and negative family cases. |
| `CSAA-006-COV-003` | Coverage SHALL include exactly nine zero-static-callers mechanism cases. |
| `CSAA-006-COV-004` | Every Scenario Profile SHALL resolve all thirty mandatory facets. |
| `CSAA-006-COV-005` | The capability-outcome matrix SHALL contain exactly `32 × 8 = 256` cells. |
| `CSAA-006-COV-006` | Every capability-outcome cell SHALL cite at least one scenario and one proposed expected outcome. |
| `CSAA-006-COV-007` | Query coverage SHALL include every declared truth, binding, quantifier, join, aggregation, failure, emptiness, and ordering branch. |
| `CSAA-006-COV-008` | Slicing coverage SHALL include forward, backward, and chop cases. |
| `CSAA-006-COV-009` | Comparison coverage SHALL include identical, changed, incompatible, ambiguous-lineage, and swapped-subject cases. |
| `CSAA-006-COV-010` | Impact coverage SHALL include direct/transitive, configuration/dependency, generated/framework, reflection/dynamic, and runtime cases. |
| `CSAA-006-COV-011` | The ARP judgment matrix SHALL contain exactly `17 × 11 = 187` cells. |
| `CSAA-006-COV-012` | The RGT inertness matrix SHALL contain exactly `12 × 2 = 24` cells. |
| `CSAA-006-COV-013` | Every coverage claim SHALL state population, denominator, and grain. |
| `CSAA-006-COV-014` | Every coverage claim SHALL state exclusions and unsupported regions. |
| `CSAA-006-COV-015` | A closed negative claim SHALL cite exact closure conditions. |
| `CSAA-006-COV-016` | No required matrix cell SHALL be blank. |
| `CSAA-006-COV-017` | Every `N/A` cell SHALL carry an exact applicability rationale. |
| `CSAA-006-COV-018` | Matrix dimensions, IDs, and cell counts SHALL be mechanically reproducible. |
| `CSAA-006-COV-019` | Coverage completion SHALL NOT establish implementation correctness or oracle conferral. |
| `CSAA-006-COV-020` | Every matrix cell SHALL trace to scenario, profile, outcome mode, and verification method. |
| `CSAA-006-COV-021` | Duplicate IDs, omitted required members, and overlapping exclusive populations SHALL fail validation. |
| `CSAA-006-COV-022` | Provider-failure and degraded-operation coverage SHALL apply across all required judgment surfaces. |
| `CSAA-006-COV-023` | Oracle adequacy SHALL itself receive mutation or tests-of-tests evidence in `JAN-CSAA-008`. |
| `CSAA-006-COV-024` | Empty or vacuous output SHALL NOT satisfy any coverage obligation. |

### 23.9 Provenance and reconstruction

| ID | Requirement |
| --- | --- |
| `CSAA-006-PRV-001` | Every scenario record SHALL retain permanent scenario identity and version. |
| `CSAA-006-PRV-002` | Every scenario record SHALL retain exact pre-change and post-change subject identities. |
| `CSAA-006-PRV-003` | Every dated scenario SHALL retain repository cutoff and working-change identity. |
| `CSAA-006-PRV-004` | Every fixture SHALL retain manifest identity and content digests. |
| `CSAA-006-PRV-005` | Compiler, project, resolver, framework, generator, and variant contexts SHALL remain reconstructable. |
| `CSAA-006-PRV-006` | Tool, model, rule-set, configuration, and environment versions SHALL remain reconstructable. |
| `CSAA-006-PRV-007` | Any provider invocation retained as observation SHALL remain separate from the expected judgment. |
| `CSAA-006-PRV-008` | Applicable Analysis Capability Profile identities and versions SHALL remain exact. |
| `CSAA-006-PRV-009` | Applicable Analysis Rule Profile identities and versions SHALL remain exact. |
| `CSAA-006-PRV-010` | Any RGT reference SHALL identify inert design content and `NOT_A_PROFILE` state. |
| `CSAA-006-PRV-011` | Raw observations SHALL remain distinct from normalized records and expected judgments. |
| `CSAA-006-PRV-012` | Expected derivation SHALL identify method, contributing facts, assumptions, and invalidation dependencies. |
| `CSAA-006-PRV-013` | Path, slice, impact, and finding expectations SHALL retain witnesses where applicable. |
| `CSAA-006-PRV-014` | Coverage basis, population, denominator, exclusions, and closure evidence SHALL remain reconstructable. |
| `CSAA-006-PRV-015` | Test, build, coverage, runtime, collector, workload, and environment coordinates SHALL remain exact. |
| `CSAA-006-PRV-016` | Generated and virtual-source expectations SHALL retain generator and origin lineage. |
| `CSAA-006-PRV-017` | Source-map expectations SHALL retain map identity, chain, health, and ambiguity. |
| `CSAA-006-PRV-018` | Author, reviewer, authority, and authority evidence SHALL remain attributable. |
| `CSAA-006-PRV-019` | Observation, record, review, conferral, and effective times SHALL remain distinguishable. |
| `CSAA-006-PRV-020` | Assumptions, limitations, conflicts, exclusions, and uncertainty SHALL remain visible. |
| `CSAA-006-PRV-021` | Access, confidentiality, redaction, and retention treatment SHALL remain reconstructable. |
| `CSAA-006-PRV-022` | Every scenario and judgment SHALL declare invalidation dependencies. |
| `CSAA-006-PRV-023` | Correction and successor records SHALL preserve predecessor identity and rationale. |
| `CSAA-006-PRV-024` | A sampled expected result SHALL be reconstructable to exact fixture inputs and governing sources. |

### 23.10 Mutation, invalidation, and lineage

| ID | Requirement |
| --- | --- |
| `CSAA-006-MUT-001` | A source edit SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-002` | A source addition SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-003` | A source deletion SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-004` | A rename SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-005` | A move SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-006` | A semantic-relation change SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-007` | A contract, declaration, or generated-source change SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-008` | A manifest change SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-009` | A lockfile or resolved-version change SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-010` | A resolver, path-alias, or condition-set change SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-011` | A project, compiler, framework, or generator change SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-012` | A rule, profile, provider, or model change SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-013` | A build, instrumentation, or test-selection change SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-014` | A coverage, trace, workload, environment, or map change SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-015` | An evidence invalidation SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-016` | An oracle change SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-017` | A dependency-driven transitive invalidation SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |
| `CSAA-006-MUT-018` | A successor-lineage creation SHALL have an exact mutation identity, affected-dependency set, invalidation result, and successor treatment. |

### 23.11 Degradation and no-false-green

| ID | Requirement |
| --- | --- |
| `CSAA-006-DEG-001` | A scenario SHALL inject unsupported construct or semantic context and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-002` | A scenario SHALL inject excluded region and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-003` | A scenario SHALL inject not-analyzed region and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-004` | A scenario SHALL inject partial result and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-005` | A scenario SHALL inject provider or analysis failure and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-006` | A scenario SHALL inject timeout and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-007` | A scenario SHALL inject cancellation and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-008` | A scenario SHALL inject resource exhaustion or budget refusal and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-009` | A scenario SHALL inject malformed output and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-010` | A scenario SHALL inject stale result and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-011` | A scenario SHALL inject incompatible comparison basis and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-012` | A scenario SHALL inject conflicting result and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-013` | A scenario SHALL inject redacted material and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-014` | A scenario SHALL inject access denial and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-015` | A scenario SHALL inject truncation or pagination cutoff and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-016` | A scenario SHALL inject broken source or generated mapping and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-017` | A scenario SHALL inject unavailable or unqualified provider and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-018` | A scenario SHALL inject mixed revision or subject mismatch and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-019` | A scenario SHALL inject interrupted index or stale cache and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |
| `CSAA-006-DEG-020` | A scenario SHALL inject empty or vacuous output and SHALL preserve it as an explicit proposed non-green outcome that cannot become supported absence, safety, permission, or passing. |

### 23.12 Acceptance and lifecycle closure

| ID | Requirement |
| --- | --- |
| `CSAA-006-ACC-001` | Draft acceptance SHALL require all metadata and exact source identities to reconcile. |
| `CSAA-006-ACC-002` | Draft acceptance SHALL account for exactly 989 ledger rows. |
| `CSAA-006-ACC-003` | Draft acceptance SHALL account for exactly 340 unique local requirements. |
| `CSAA-006-ACC-004` | Draft acceptance SHALL reproduce every required matrix dimension and cell count. |
| `CSAA-006-ACC-005` | Every expected judgment SHALL remain `PROPOSED / NOT_CONFERRED / NOT_EXECUTED` during documentation-only Wave 2. |
| `CSAA-006-ACC-006` | No provider output SHALL be used to derive expected judgments. |
| `CSAA-006-ACC-007` | Unsupported, excluded, failed, timed-out, partial, stale, conflicting, truncated, and empty cases SHALL remain non-green. |
| `CSAA-006-ACC-008` | Zero observed static callers SHALL remain a bounded candidate surface and SHALL NOT establish deadness or removal authority. |
| `CSAA-006-ACC-009` | Every RGT SHALL remain inert and no RGP identity SHALL exist. |
| `CSAA-006-ACC-010` | Exception, suppression, conflict, and underlying result SHALL remain visible. |
| `CSAA-006-ACC-011` | Dated repository evidence SHALL remain labeled by its observation cutoff. |
| `CSAA-006-ACC-012` | Draft authoring SHALL make no implementation, fixture-source, schema, dependency, provider, gate, or oracle mutation. |
| `CSAA-006-ACC-013` | Links, headings, tables, fences, encoding, and exact identity SHALL reproduce. |
| `CSAA-006-ACC-014` | Requirement-ledger closure SHALL precede authoring-complete status. |
| `CSAA-006-ACC-015` | Author self-review SHALL answer all eighteen `JAN-CSAA-000` §17 questions and preserve failures as findings. |
| `CSAA-006-ACC-016` | The unperformed consolidated implementation refresh and affected reconciliation SHALL block Proposed freeze. |
| `CSAA-006-ACC-017` | Independent adversarial review, distinct integrity validation, and exact-member conferral SHALL remain external terminal predicates. |
| `CSAA-006-ACC-018` | Draft acceptance SHALL be author-side evidence only and SHALL NOT confer authority, oracle standing, or executable conformance. |

## 24. Verification and later-execution allocations

This table records the exact entry state for this lifecycle-correction successor. The eighteen objective methods passed only against the immutable `JAN-CSAA-006@0.1.0` predecessor; `CSAA-006-CTL-020` therefore requires all eighteen to be rerun against these successor bytes. The preliminary author self-review was performed and is nonpass because `JAN-CSAA-006-SR-001 / MAJOR` remains open. After successor evidence is issued, the linked controlled ledger and its exact objective record control current state; this immutable table does not override them.
| Method | Required conclusion | Correction-entry state |
| --- | --- | --- |
| `JAN-CSAA-006-VER-CTL-001` | Metadata, lifecycle, authority, exact inputs, currentness boundary, and no-expansion are correct | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-SRC-001` | All 649 inherited and 340 local obligations have non-lossy bidirectional allocation | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-OWN-001` | Concern ownership and exclusions close without a semantic fork | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-MOD-001` | Every Scenario Profile resolves all thirty facets | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-STR-001` | Both fixture lanes and all structural boundaries are complete | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-SCN-001` | Twenty families, forty paired cases, and all query/slice/comparison/impact scenarios are exact | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-ZSC-001` | All nine zero-static-callers mechanisms preserve bounded conclusions | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-CAP-001` | The `32 × 8` capability matrix contains exactly 256 nonblank traceable cells | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-QRY-001` | Every query truth, binding, quantifier, aggregation, failure, emptiness, and order branch is covered | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-SLI-001` | Forward, backward, and chop slicing preserve witnesses and unresolved frontiers | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-ARP-001` | The `17 × 11` ARP matrix contains exactly 187 claim-character-preserving cells | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-RGT-001` | The `12 × 2` RGT matrix contains exactly 24 inertness and misuse-rejection cells | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-ORC-001` | Oracle independence, lifecycle, provenance, divergence, and no-self-approval are complete | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-PRV-001` | Every sampled judgment reconstructs to exact subject, inputs, method, and lineage | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-MUT-001` | All eighteen mutation classes close invalidation and successor behavior | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-DEG-001` | All twenty degraded classes remain explicit and non-green | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-XPK-001` | Downstream allocations preserve exact source meaning | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |
| `JAN-CSAA-006-VER-SELF-001` | All eighteen `JAN-CSAA-000` §17 adversarial questions are answered | `PRELIMINARY_REVIEW_NONPASS — JAN-CSAA-006-SR-001 / MAJOR; CORRECTIVE_REVIEW_INELIGIBLE_BEFORE_SUCCESSOR_OBJECTIVE_CLOSURE_AND_SYNCHRONIZED_RECONCILIATION / NOT_ACTIVATED` |
| `JAN-CSAA-006-VER-INTEGRITY-001` | Exact identity, counts, links, tables, headings, encoding, and evidence continuity reproduce | `PREDECESSOR_PASS / SUCCESSOR_RERUN_REQUIRED` |

`CSAA-006-ACC-017` is externally owned and cannot receive an author-side `PASS`:

| Terminal predicate | Required distinct owner |
| --- | --- |
| Independent adversarial semantic review | Reviewer distinct from author and integrator |
| Integrity and provenance validation | Validator distinct from author and adversarial reviewer |
| Final consolidated implementation refresh and affected reconciliation | Exact final-refresh owner with independently inspectable evidence |
| Exact-member conferral | Accountable final decision authority followed by a ministerial recorder |

Its current state is `NOT_RUN — EXTERNAL_TERMINAL_OWNERSHIP`.

Executable fixture construction, conformance execution, recovery testing, provider differential testing, gate integration, and oracle conferral are later allocations. Author-side documentation methods cannot mark them passed.

## 25. Open alternatives and conservative defaults

| Open design surface | Conservative Draft default | Owner |
| --- | --- | --- |
| Physical fixture directory and serialization | Documentation shape is specified by `JAN-CSAA-007@1.0.1`; no enforced schema, generated derivative, or materialized fixture exists | `JAN-CSAA-007` |
| Executable harness and runner | Executable test design is documented by `JAN-CSAA-008@0.2.2`; no harness, fixture execution, or conformance result exists | `JAN-CSAA-008` |
| Persistence, scheduling, and recovery topology | Persistence and recovery design is documented by `JAN-CSAA-009@0.2.1`; no physical topology, operational profile, or recovery result exists | `JAN-CSAA-009` |
| Coding-agent invocation and stop policy | No employment point is activated | `JAN-CSAA-010` |
| Analyzer provider and qualification | No provider is selected or qualified | `JAN-CSAA-011` |
| Oracle reviewer and conferral authority | All expectations remain proposed and non-conferred | Governed later authority |
| Live repository currentness | Dated evidence only; final consolidated refresh blocks freeze | Final-refresh owner |

## 26. Draft acceptance state

The table records the exact entry state of this correction successor. The predecessor objective closure is historical evidence, not an inherited pass for changed bytes. The linked successor ledger controls current state after its own objective rerun and closure.

| Predicate | Correction-entry state |
| --- | --- |
| 340 unique local requirements | `PREDECESSOR_VERIFIED / SUCCESSOR_REEXTRACTION_REQUIRED` |
| 649 inherited ledger rows | `PREDECESSOR_RECONCILED / SUCCESSOR_RECONCILIATION_REQUIRED` |
| 989 total ledger rows | `PREDECESSOR_CLOSED / SUCCESSOR_LEDGER_REOPEN_REQUIRED` |
| 20 families and 40 paired cases | `DOCUMENTED / NOT_EXECUTED` |
| 9 zero-static-callers cases | `DOCUMENTED / NOT_EXECUTED` |
| 256 CAP cells | `DOCUMENTED / NOT_EXECUTED` |
| 187 ARP cells | `DOCUMENTED / NOT_EXECUTED` |
| 24 RGT cells | `DOCUMENTED / NOT_EXECUTED` |
| Expected judgments | `PROPOSED / NOT_CONFERRED / NOT_EXECUTED` |
| Requirement ledger | `PREDECESSOR_CLOSED / SUCCESSOR_OPEN_REQUIRED` |
| Author self-review | `PERFORMED / NONPASS — JAN-CSAA-006-SR-001 / MAJOR` |
| Corrective author self-review | `INELIGIBLE_BEFORE_SUCCESSOR_OBJECTIVE_CLOSURE_AND_SYNCHRONIZED_RECONCILIATION / NOT_ACTIVATED` |
| Consolidated implementation refresh | `NOT_PERFORMED` |
| Independent review and integrity validation | `NOT_RUN` |
| Exact-member conferral | `ABSENT` |

These states are deliberately bounded. A successor objective-verification pass may close the documentation-only objective commission in the linked ledger, but it cannot close `JAN-CSAA-006-SR-001` without a distinct corrective eighteen-question self-review and cannot turn any executable, oracle, provider, final-refresh, Proposed, independent-review, integrity, sponsor, or conferral predicate green.
## 27. Closing rule

A fixture is trustworthy only when its subject, semantic boundary, expected judgment, independence, provenance, degraded cases, and invalidation behavior are independently inspectable. A provider cannot author its own answer key. An unreviewed answer key cannot make conformance green. No empty, stale, failed, partial, conflicting, bypassable, or zero-static-callers result may become safety, permission, or completion.
