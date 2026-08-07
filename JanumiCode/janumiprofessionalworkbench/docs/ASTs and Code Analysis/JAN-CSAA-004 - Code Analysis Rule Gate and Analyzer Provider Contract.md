# Code-Analysis Rule, Gate, and Analyzer-Provider Contract

## Provider-neutral technical rules, findings, exceptions, repository gates, evaluations, and no-false-green controls

**Document ID:** `JAN-CSAA-004`

**Canonical title:** Code-Analysis Rule, Gate, and Analyzer-Provider Contract

**Version:** `0.1.1`

**Status:** Draft

**Settledness:** HYPOTHESIS

**Classification:** Prepared controlled-CSAA member corrective successor; non-authoritative Draft. `JAN-CSAA-000@0.3.0` remains the adopted authority and manifest baseline. `JAN-CSAA-WORKING-STATUS-001@0.5.0` is historical Wave 2-entry evidence; `JAN-CSAA-WORKING-STATUS-001@0.13.0` is the correction-entry authoring-state record and becomes historical when this successor package is published. Analysis Rule Profiles here remain `UNFROZEN / NO_EFFECTIVE_STANDING`, their binding authority remains `UNASSIGNED`, and their transition carriers remain `N/A — no instantiated RGP or protected transition`. Gate material remains design-template content with designation inputs `UNRESOLVED_BY_DESIGNATION`; no Repository Gate Profile is instantiated without a separate recognized binding-gate designation

**Governing status:** Documentation-only Wave 2 entry is recorded by `JAN-CSAA-W1-SEMANTIC-READINESS-001@0.1.0` under `JPWB-REG-005 REG-D-021` as corrected by `REG-D-022`; this document has no member authority

**Role:** Provider-neutral technical contract for Analysis Rule Profiles, Analyzer Finding Records, Engineering Exception Records, Repository Gate Profiles and Evaluations, and analyzer-provider capability declarations

**Authority:** None. Documentation preparation, objective verification, Draft-to-Proposed promotion after its gates pass, and later independent review and validation are authorized. No profile, rule, gate, exception, provider, evaluation, or result becomes effective through authorship. Only an exact-member final conferral can make this document Normative, and separate recognized authorities remain required to bind concrete profiles and enforcement carriers

**Scope:** Technical analysis-rule semantics; technical finding lifecycle; review, remediation, suppression, and exception effects; repository-gate semantics and aggregation; execution-health and epistemic outcomes; provider-neutral analyzer contract; no-self-approval, oracle-protection, and non-bypassability requirements

**Applicability:** Exact repository subjects and analysis results described by the non-authoritative `JAN-CSAA-002` and `JAN-CSAA-003` Draft inputs, for the TypeScript, JavaScript, and TypeScript-bearing Svelte subject permitted by adopted `JAN-CSAA-000`

**Governs:** While Draft, nothing with program authority. Candidate concern allocation: technical rule, finding, exception, provider-declaration, repository-gate-profile, and repository-gate-evaluation meaning

**Does not govern:** Code-semantic objects or graph/query algorithms; current repository facts; fixture or oracle judgments; exact schemas, fields, enum spellings, adapters, or APIs; executable conformance; persistence or operations; coding-agent employment points; concrete provider selection, licensing acceptance, configuration, installation, deployment, or operation; canonical Assurance Policy, Assessment, Assurance Observation, Decision, waiver, or Baseline authority; implementation permission

**Adopted and canonical authorities:** `JAN-CSAA-000@0.3.0`, `JPWB-CON-000@1.3.0`, `JPWB-DOC-002@1.2.0`, `JPWB-DOC-003@1.3.0`, `JPWB-DOC-004@1.3.0`, and `JPWB-REG-005@1.0.0 REG-D-021` and `REG-D-022`, each only for its concern

**Provisional non-authoritative Draft inputs:** `JAN-CSAA-001@0.3.0 / Draft`, `JAN-CSAA-002@0.3.1 / Draft` (163,765 bytes; SHA-256 `961a338cf4b843b9568981d3580b3af5dbb3dc6f22d4426609833bd6b52a09c6`), `JAN-CSAA-003@0.1.0 / Draft`, and `JAN-CSAA-005@0.3.0 / Draft`. These exact dependency versions supply architecture, semantic, analysis, and dated repository-description inputs only. They confer no authority. Their exact byte and digest identities are controlled by the requirement ledger, and any change to a bound dependency identity triggers affected source reconciliation

**Precedence and conflict routing:** Canon retains professional assurance and governance meaning. If those Drafts are later conferred, `JAN-CSAA-002` owns semantic identity, `JAN-CSAA-003` owns analysis, query, reachability, slicing, comparison, and impact meaning, and `JAN-CSAA-005` owns dated repository description. This candidate owns only proposed technical rule, result, finding, treatment, provider-declaration, and repository-gate semantics. Conflicts SHALL be routed to the concern owner; this Draft SHALL NOT invent or silently alter a canonical meaning

**Requirement ledger:** [JAN-CSAA-004 Requirement Ledger](<records/JAN-CSAA-004 - Requirement Ledger.md>)

**Verification owner:** The author/integrator owns requirement extraction, objective verification, ledger closure, and author self-review. A distinct adversarial reviewer owns Proposed-candidate semantic review. A distinct integrity/provenance validator owns exact-identity and evidence-continuity validation. Profile/oracle author, provider, evaluator, disposition authority, exception authority, enforcement carrier, final decision authority, and ministerial recorder remain distinguishable roles

**Change authority and procedure:** Authors MAY revise this Draft under `REG-D-021` and `REG-D-022`. Proposed eligibility requires source reconciliation, closed ledger, completed author self-review, resolved blocking findings, and exact freeze. Every post-freeze candidate-byte change triggers affected re-review except an exact pre-frozen non-semantic administrative substitution independently replayed and validated

**Review and evidence companions:** [Wave 2 Entry Record](<records/JAN-CSAA-W1 - Documentation Semantic Readiness and Wave 2 Entry Record.md>); [Current Corpus Reconciliation and Wave 4 Baseline](<records/JAN-CSAA - Current Corpus Reconciliation and Wave 4 Baseline Record.md>); [Wave 4 Entry Record](<records/JAN-CSAA-W3 - Documentation Semantic Readiness and Wave 4 Entry Record.md>); [Working Corpus Authoring Status 013](<records/JAN-CSAA - Working Corpus Authoring Status 013.md>); [Sponsor Standing Direction](<records/JAN-CSAA - Sponsor Standing Direction for Autonomous Corpus Preparation and Final Review.md>); [Standing Direction Correction](<records/JAN-CSAA - Standing Direction Interpretation Correction and Assurance Clarification.md>); and the requirement-ledger stable path above. The preliminary author self-review exists and remains a nonpass. Exact Proposed-candidate review and distinct independent integrity/provenance validation remain absent

**Exact historical pre-correction evidence:** [`JAN-CSAA-004-LEDGER-001@0.1.1`](<records/archive/JAN-CSAA-004-LEDGER@0.1.1.Closed.PRE-W4-SELF-REVIEW-CORRECTION.snapshot>), 498,116 bytes, SHA-256 `368e3c4537d0ceb493df5bb534d992c54cc5a1a6a5798bb5172d63bd6a9cef63`; [`JAN-CSAA-004-VERIFICATION-001@0.1.2`](<records/archive/JAN-CSAA-004-VERIFICATION@0.1.2.PRE-W4-SELF-REVIEW-CORRECTION.snapshot>), 15,019 bytes, SHA-256 `944f15c504f8a78f12ae27d88dfe3e07eee0f377ecb65d075d763c3beb686812`; [`JAN-CSAA-W2-OBJECTIVE-RECONCILIATION-001@0.1.0`](<records/JAN-CSAA-W2 - Wave 2 Cross-Package Objective Reconciliation Record.md>), 13,879 bytes, SHA-256 `755459221a65f9fada7541953bd9aa7ba8976592fdc803801a1838ce1dfef46b`; [`JAN-CSAA-W2-LEDGER-CLOSURE-INTEGRITY-001@0.1.0`](<records/JAN-CSAA-W2 - Synchronized Ledger Closure and Integrity Record.md>), 12,436 bytes, SHA-256 `5f2f5d095354dc90b4525e9dec84c0f07fefdcd612a6b39c11097bdae6e4f643`; [`JAN-CSAA-004-SELF-REVIEW-001@0.1.0`](<records/JAN-CSAA-004 - Author Self Review.md>), 13,404 bytes, SHA-256 `e48e96f7ca29d5a858c68dc98c580d1d6dfee3686967d0627d24b2f6a8a797cd`; and [`JAN-CSAA-WORKING-STATUS-001@0.8.0`](<records/JAN-CSAA - Working Corpus Authoring Status 008.md>), 12,120 bytes, SHA-256 `9187787def76cfdb0c2c9942405610d2fb35d89df3c9ff14584a8092dcb5cfef`

**Corrective-successor evidence boundary:** The exact `0.1.0` objective ledger closed with sixteen current-phase method passes plus `JAN-CSAA-004-VER-SELF-001 / NOT_REQUIRED_CURRENT_PHASE`; its preliminary self-review was then performed, found `JAN-CSAA-004-SR-001 / MAJOR`, and remained nonpass. This `0.1.1` successor corrects lifecycle and evidence presentation plus the necessary current definition-carrier self-identity only. It carries all 401 requirement IDs and substantive rule, finding, exception, provider, gate, authority, and no-false-green semantics unchanged. No predecessor PASS is carried to these changed bytes: a successor ledger, direct-current objective verification, successor reconciliation, and fresh eighteen-question author self-review remain required before exact Proposed freeze

**Companion enforced artifacts:** None. No Repository Gate Profile is instantiated in this documentation phase; the twelve `RGT` records are inert design templates only

**Conformance-test references:** At this corrective source-finalization cutoff, `JAN-CSAA-006@0.1.0`, `JAN-CSAA-007@1.0.1`, and `JAN-CSAA-008@0.2.2` exist only as non-authoritative documentation Drafts; `JAN-CSAA-009@0.2.1` likewise exists only as a non-authoritative operations-design Draft. A synchronized exact `JAN-CSAA-006` corrective successor may publish in the same correction package and then controls corpus currentness through external successor evidence; it creates no reverse dependency into these frozen `JAN-CSAA-004` bytes and does not change `JAN-CSAA-004` concern cession. No executable fixture, conferred oracle, enforced schema, generated derivative, gate run, provider qualification, conformance execution, persistence mechanism, or operational result exists through this Draft

**Repository-evidence boundary:** [JAN-CSAA-005-EVIDENCE-007@0.1.0](<records/JAN-CSAA-005 - Current Subject Rebinding Record 004.md>) is the exact dated authoring baseline, not a continuously current repository claim. [JAN-CSAA-005-EVIDENCE-008@0.1.0](<records/JAN-CSAA-005 - Non-Blocking External Drift and Authoring Baseline Record.md>) is the controlling non-blocking authoring rule. Existing analyzer configuration and historical results are descriptive evidence only; they are not adopted profiles or qualified providers. No intermediate Git polling is required. One consolidated implementation-subject refresh remains mandatory before final corpus freeze

**Audience:** Coding-agent designers, TypeScript engineers, software architects, assurance engineers, security reviewers, repository administrators, analyzer integrators, implementers, and maintainers

**Background:** [JAN-CSAA-000](<README.md>); [JAN-CSAA-001](<JAN-CSAA-001 - Codebase Semantic Analysis and Assurance Architecture.md>); [JAN-CSAA-002](<JAN-CSAA-002 - TypeScript Semantic Model and Invariant Catalog.md>); [JAN-CSAA-003](<JAN-CSAA-003 - Analysis Enrichment Query and Change Impact Specification.md>); [JAN-CSAA-005](<JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md>)

**Structural exemplars:** [RPH assurance-policy catalog](<../Recursive Professional Harness/Janumi Professional Workbench Product Realization PWA - Assurance Policy Catalog and Validator Contract.md>); [RPH executable invariant specification](<../Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Executable Invariant and Conformance Test Specification.md>)

**Supersedes:** [JAN-CSAA-004@0.1.0 / Draft](<records/archive/JAN-CSAA-004@0.1.0.Draft.PRE-W4-SELF-REVIEW-CORRECTION.snapshot>); 176,071 bytes; SHA-256 `8812dc55c05167223341b08d3d5bc85b8b1e5ad085c9a0e198a13512af69dc89`; exact predecessor and its ledger, objective, Wave 2 reconciliation, closure, Status 008, and preliminary-review evidence remain immutable historical evidence; patch scope is lifecycle/currentness presentation, exact dependency/evidence rebinding, and current definition-carrier self-identity only; all 401 requirement IDs and substantive technical semantics remain unchanged

**Superseded by:** None

**Normative keywords:** SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY, and MUST are interpreted under `JAN-CSAA-000@0.3.0` §5. Exact machine spellings are deferred to `JAN-CSAA-007`

---

## 1. Purpose

This Draft answers:

> How shall technical analysis rules, findings, exceptions, and repository gates be represented and evaluated so that incomplete analysis, provider failure, local bypass, or self-authored judgment cannot manufacture a green result?

It defines technical assurance semantics for software engineering. It maps into canonical assurance only through an explicitly governed boundary and does not create canonical assurance authority itself.

---

## 2. Concern ownership and non-goals

| Concern | Owner | Treatment here |
| --- | --- | --- |
| Program scope and assurance-question population | `JAN-CSAA-000` | Inherited |
| Logical architecture and trust boundary | `JAN-CSAA-001` | Inherited |
| Semantic subjects, facts, evidence sets, epistemic dimensions | `JAN-CSAA-002` | Referenced without redefinition |
| Capability, query, reachability, slicing, comparison, impact | `JAN-CSAA-003` | Inputs; not redefined |
| Rule, finding, exception, provider declaration, gate, evaluation | `JAN-CSAA-004` candidate | Defined here |
| Current repository facts | `JAN-CSAA-005` | Dated evidence only |
| Fixture judgments and oracle governance | `JAN-CSAA-006` | `DOCUMENTED / NOT_CONFERRED / NOT_EXECUTED`; individual expected judgments remain proposed |
| Exact schemas and adapter envelopes | `JAN-CSAA-007` | Later allocation |
| Executable conformance and assurance-of-assurance | `JAN-CSAA-008` | Later allocation |
| Persistence, resource operations, security implementation, telemetry | `JAN-CSAA-009` | Later allocation |
| Coding-agent employment and lifecycle integration | `JAN-CSAA-010` | Later allocation |
| Provider qualification, selection, licensing, and operation | `JAN-CSAA-011` | Later allocation |
| Canonical assurance and governance objects | Canon and owning JPWB artifacts | Mapped at boundary only |

This document SHALL NOT select a CI system, branch rule, analyzer, compiler wrapper, database, carrier, deployment topology, provider, or threshold. It SHALL NOT report any gate as executed or effective.

---

## 3. Foundational non-equivalences

```text
Rule profile exists                  != rule is assigned
Rule is assigned                     != required capability is available
Capability is available              != analysis executed
Analysis executed                    != evidence is current or complete
Zero findings                        != rule satisfied
Provider failure                     != subject violation
Provider severity                    != profile severity
Suppression                          != exception
Exception                            != rule satisfaction
Exception                            != canonical waiver
Local/pre-commit pass                != binding repository gate
Gate evaluation                      != approval or Baseline
Provider recommendation              != disposition
Change made                          != finding resolved
Zero observed static callers         != dead code or safe removal
```

Every technical conclusion preserves five orthogonal dimensions:

1. **Applicability:** applicable, not applicable, or unresolved.
2. **Execution health:** complete, partial, not analyzed, failed, timed out, cancelled, unavailable, or malformed.
3. **Evidence state:** current or stale; supported or unsupported capability; complete or incomplete declared coverage.
4. **Epistemic conclusion:** supported, violated, or inconclusive.
5. **Agreement:** consistent or conflicting.

`JAN-CSAA-007` may encode these as orthogonal values or a lossless tagged union. It SHALL NOT flatten materially different combinations into one pass/fail value.

---

## 4. Technical vocabulary and relationships

An **Analysis Rule Profile** is a versioned technical judgment contract that maps exact analysis capabilities and evidence to a bounded engineering claim.

A **Rule Application Result** is an immutable evaluation of one exact Analysis Rule Profile against one exact subject. It is the bridge between raw analysis and a technical conclusion.

An **Analyzer Finding Record** is an immutable technical observation that one Rule Application Result identified a deficiency, risk signal, incompatibility, or unresolved condition under an exact profile.

An **Engineering Exception Record** is a separately authorized, scoped, expiring permission for a known technical violation or an expressly eligible non-qualification evidence deficiency at an identified protected boundary. It does not change the underlying conclusion or evidence state.

A **Repository Gate Profile** is a versioned composition of rule profiles and evidence prerequisites protecting one technical transition.

A **Repository Gate Evaluation** is an immutable, revision-bound evaluation of one exact Gate Profile. It permits, blocks, or withholds only the technical transition named by the profile.

An **Analyzer Provider Declaration** is a provider claim about implemented `JAN-CSAA-003` capabilities and this document's output obligations. It is not qualification evidence.

None of these terms redefines canonical Assurance Policy, Assessment, Assurance Observation, Decision, waiver, or Baseline.

---

## 5. Common profile contract

Every Analysis Rule Profile and Repository Gate Profile SHALL carry:

| Facet | Required meaning |
| --- | --- |
| Stable identity and version | Permanent ID, semantic version, immutable content identity, lifecycle, predecessor and successor |
| Purpose and protected decision | The engineering question and protected transition or action; not a canonical Decision |
| Subject and applicability | Exact repository subject, scope, configuration, generated/excluded regions, dirty-worktree treatment, and explicit applicability predicate |
| Claim | Polarity and epistemic strength: hard invariant, owner-defined rule, heuristic/smell, or metric/advisory |
| Required evidence | Exact `JAN-CSAA-003` capabilities, coverage, freshness, provenance, and permitted corroboration |
| Criteria and outcomes | Satisfaction, violation, inconclusive, and not-applicable criteria without inferring satisfaction from silence |
| Severity and confidence | Independent dimensions with profile interpretation separated from raw provider metadata |
| Transition-effect treatment | For an ARP, `RULE_ONLY` or exact inert RGT design provenance; for a separately designated RGP, the exact protected-boundary consequence for each outcome |
| Profile owner and authority | Content owner distinguished from authority that binds the profile |
| Non-bypass boundary | For an ARP, literal `N/A` plus rationale because no RGP or protected transition exists; for a separately instantiated RGP, definitive carrier or explicit `UNBOUND` state |
| Failure and local-run treatment | Timeout, failure, unsupported, stale, disagreement, and local/early-feedback behavior |
| Interim carrier | Same versioned profile plus registered authority-transfer plan |
| Independence | Required separation among author, oracle, provider, executor, disposer, exception authority, and carrier |
| Eligible capabilities | Required capability IDs and permitted provider declarations |
| False-positive and disagreement treatment | Evidence, review, conflict preservation, and no-majority-vote rule |
| Remediation and reanalysis | Successor-subject requirement and historical preservation |
| Exception authority and record | Eligible conditions, separate authority, scope, expiry, and non-waivable constraints |
| Retention | Raw output, normalized record, transformation, contradiction, evaluation, and supersession history |

Every facet SHALL be populated or explicitly inapplicable with rationale. A profile SHALL NOT appoint its own binding authority or make its own carrier non-bypassable by declaration.

For compact tables in this document only, `CAP-nnn`, where `nnn` is one of `001` through `032`, resolves exactly to the permanent `JAN-CSAA-CAP-nnn` identity at profile version `0.1.0 / Draft` defined by the exact `JAN-CSAA-003@0.1.0 / Draft` candidate §5.5. A compact inclusive range such as `CAP-001` through `CAP-003` expands to each exact member at that version. The shorthand has no independent identity and SHALL NOT survive an external machine contract or provider declaration.

For every profile, **not applicable** means that the exact applicability predicate is supported false for a completely identified subject and a complete relevant population. An absent, excluded, unsupported, failed, stale, partial, redacted, or unresolved region is inconclusive, not not-applicable.

An Analysis Rule Profile result alone has no transition effect. For a separately designated, instantiated, bound Repository Gate Profile, the protected-transition effects are exact: supported satisfaction over a nonempty applicable blocking population permits; after non-exceptable qualification and uncovered-state checks, one or more exact effective exceptions collectively covering every remaining eligible violation or non-qualification evidence deficiency, with every other applicable blocking criterion supported, permit with every exception and underlying state visible; an unexcepted blocking violation blocks; required uncertainty, conflict, failure, staleness, or partiality not covered by its own exact permitted exception withholds; a profile that is not wholly not-applicable but lacks a nonempty applicable blocking population withholds; and supported not-applicable over a nonempty exact component population contributes no blocking effect. Advisory results remain visible but do not block unless the exact designated Gate Profile says otherwise. No template or unbound profile permits, blocks, or withholds a real transition.

### 5.1 Reusable Analysis Rule Profile clause registry

Every §8.1 Analysis Rule Profile explicitly incorporates `ARP-COM-001` through `ARP-COM-028`. Incorporation is by exact reference, not implicit inheritance. A profile-specific addendum may specialize a common clause only where the addendum names that clause. Every omitted, contradictory, or unresolved mandatory addendum makes the profile incomplete and incapable of a supported positive result.

| Clause | Common requirement |
| --- | --- |
| `ARP-COM-001` | Bind permanent ARP identity, semantic version, definition carrier, immutable content identity or literal `UNFROZEN`, lifecycle, predecessor, and successor. An unfrozen profile has no effective standing. |
| `ARP-COM-002` | Cite every adopted, provisional, canonical, and concern-owning source obligation that supplies the claim or its limits. |
| `ARP-COM-003` | Bind exact repository, revision and tree, reproducible working change, configuration, scope, generated regions, exclusions, and relevant build, test, runtime, and resolver contexts. |
| `ARP-COM-004` | State an explicit applicability predicate. `NOT_APPLICABLE` requires supported-false applicability and a rationale; unknown applicability is inconclusive. |
| `ARP-COM-005` | Select exactly one claim character: `HARD_INVARIANT`, `OWNER_DEFINED_RULE`, `HEURISTIC_SMELL`, or `METRIC_ADVISORY`. Conditional or compound characters are prohibited. A different character requires a separate profile or semantic revision. |
| `ARP-COM-006` | State one exact bounded claim and polarity. No profile may upgrade a smell, heuristic, correlation, metric, or owner preference into a universal invariant. |
| `ARP-COM-007` | Bind full `JAN-CSAA-CAP-nnn` identities and versions, required predecessor capabilities, semantic inputs, queries, permitted execution evidence, and permitted corroboration. |
| `ARP-COM-008` | Declare coverage population, dimensions, denominator, excluded regions, closure conditions, and evidence required for positive and negative claims. |
| `ARP-COM-009` | Require exact run, invocation, provider, adapter, method, configuration, raw-result, transformation, source-location, and evidence provenance. |
| `ARP-COM-010` | Define supported, violated, inconclusive, and not-applicable criteria without deriving support from silence, zero findings, provider success, or an empty result. |
| `ARP-COM-011` | Define profile-derived severity and confidence independently from provider metadata and independently from blocking effect. |
| `ARP-COM-012` | Enumerate known false-positive classes. `None known` is permitted only with cited analysis and remains revisable. |
| `ARP-COM-013` | Enumerate known false-negative classes and unsupported seams. |
| `ARP-COM-014` | Preserve provider and evidence disagreement as conflict; no majority vote, averaging, or preferred-provider overwrite is permitted. |
| `ARP-COM-015` | Define the exact finding trigger. Hard and owner-defined rules normally create findings on supported violation; heuristic profiles may create candidate findings when their positive risk claim is supported; metric profiles create findings only under an exact cited threshold rule. |
| `ARP-COM-016` | Define finding grain, deduplication key, recurrence lineage, immutable observation core, correction, invalidation, and historical retention. |
| `ARP-COM-017` | Require an attributable Finding Disposition Record for confirmation, dispute, false-positive, or duplicate treatment. |
| `ARP-COM-018` | Suppression changes presentation or configuration treatment only. It never changes evidence, conclusion, satisfaction, exception state, or permission. |
| `ARP-COM-019` | State exception eligibility, separate authority, exact scope, expiry, non-waivability, and effect. If no protected transition exists, record literal `N/A — no instantiated RGP or protected transition`. |
| `ARP-COM-020` | A change is `CHANGED_PENDING_REANALYSIS`; resolution requires a current, compatible successor-subject Rule Application Result and explicit predecessor links. |
| `ARP-COM-021` | Declare every logical invalidation dependency. Affected refresh creates a successor and preserves the predecessor. |
| `ARP-COM-022` | Allocate independently owned fixture and expected-judgment work to `JAN-CSAA-006`, executable conformance to `JAN-CSAA-008`, and provider qualification to `JAN-CSAA-011`. Record the current exact state of each allocation independently: `DOCUMENTED / NOT_CONFERRED / NOT_EXECUTED`, `NOT_AUTHORED / NOT_RUN`, or `NOT_AUTHORED / NOT_QUALIFIED` as applicable; never imply an oracle, conformance result, or qualification exists. |
| `ARP-COM-023` | State required separation among subject author, profile or oracle author, provider, executor, normalizer, disposer, exception authority, carrier, and canonical authority. |
| `ARP-COM-024` | Distinguish unsupported, excluded, failed, timed out, cancelled, malformed, partial, stale, conflicting, redacted, and not-analyzed states. These states cannot yield supported satisfaction or violation outside their bounded evidence. |
| `ARP-COM-025` | State resource, ordering, pagination, access, confidentiality, redaction, raw-output retention, and explanation obligations. |
| `ARP-COM-026` | Results may report or recommend only. They cannot mutate, approve, dispose, suppress, waive, except, confer authority, or imply implementation currentness. |
| `ARP-COM-027` | Record either `RULE_ONLY` or exact inert RGT design provenance. An RGT reference is not gate eligibility, designation, RGP instantiation, authority, carrier, or enforcement. |
| `ARP-COM-028` | Every inapplicable field SHALL contain literal `N/A` plus rationale. `UNASSIGNED`, `UNKNOWN`, `PENDING`, and `N/A` are distinct and SHALL NOT substitute for one another. |

For every §8.1 profile, the current definition carrier is this exact `JAN-CSAA-004@0.1.1 / Draft` candidate member; the predecessor is the exact archived `JAN-CSAA-004@0.1.0 / Draft`; the successor is `NONE — no successor currently recorded`; and any later semantic revision SHALL create a successor version. This definition-carrier self-identity correction changes no profile criterion, facet, obligation, standing, authority, or ARP/RGP carrier semantic. The ARP binding authority is `UNASSIGNED — no recognized ARP-binding record`. Definitive and interim transition carriers are `N/A — no instantiated RGP or protected transition`. At this corrective source-finalization cutoff, the exact `JAN-CSAA-006@0.1.0 / Draft` oracle allocation is `DOCUMENTED / NOT_CONFERRED / NOT_EXECUTED`; any synchronized `JAN-CSAA-006` successor currentness remains external and creates no reverse dependency into these exact `JAN-CSAA-004` bytes. The exact `JAN-CSAA-008@0.2.2 / Draft` specification is `DOCUMENTED`, while every executable evidence item and result remains `NOT_PERFORMED`; `JAN-CSAA-011` qualification remains `NOT_AUTHORED / NOT_QUALIFIED`. These states are Draft facts, not passed predicates.

---

## 6. Exact subject, evidence, and outcome model

### 6.1 Subject and currency

Every application and evaluation SHALL bind:

- repository identity;
- exact revision and tree identity;
- reproducible working-change identity where applicable;
- subject scope and exclusions;
- project, compiler, resolver, generated, build, test, and runtime contexts needed by the profile;
- profile versions and content identities;
- capability-profile versions;
- provider, rule-set, model/database/feed, adapter, and configuration versions;
- observation and evaluation times; and
- logical invalidation dependencies.

A subject, profile, capability, provider, or material input mismatch invalidates the evaluation for current use and creates a successor requirement.

### 6.2 Supported conclusion

A supported rule-satisfaction conclusion requires all of:

1. exact subject identity;
2. resolved applicability;
3. required capabilities present;
4. coverage adequate for the profile claim;
5. healthy complete execution;
6. current evidence;
7. no unresolved conflicting evidence; and
8. positive satisfaction of the profile criterion; and
9. when the result contributes to a protected gate, an effective `JAN-CSAA-011` qualification that binds the exact provider, adapter, capability profile, method, rule set, model, database or feed, configuration, and their exact versions, plus the exact `JAN-CSAA-006` oracle allocation and `JAN-CSAA-008` conformance evidence.

Zero findings alone satisfies none of these predicates.

A Provider Declaration is a claim, not the qualification required by item 9. Because `JAN-CSAA-011` qualification and the referenced executable oracle evidence do not yet exist, this Draft cannot support a positive binding-gate conclusion.

No instantiated Repository Gate Profile or Repository Gate Evaluation may produce a positive transition effect unless every contributing provider, adapter, capability profile, method, rule set, model, database or feed, and configuration is covered by a current effective `JAN-CSAA-011` qualification. The qualification's exact scope SHALL include the subject language, compiler, project and framework modes; security and licensing conditions; conformance basis; expiry; and substitution lineage.

Missing, stale, expired, partial, mismatched, or conflicting qualification yields `Withheld`. An Engineering Exception under this document SHALL NOT substitute for provider qualification. Provider substitution requires new exact qualification and affected reanalysis.

### 6.3 Provider failure

Provider failure, timeout, malformed output, unsupported coverage, stale evidence, cancellation, or partial execution is not a subject violation. It makes the affected evaluation inconclusive or unavailable. A protected transition fails closed by being withheld, without falsely declaring the subject defective.

---

## 7. Analysis Rule Profile contract

Each Analysis Rule Profile SHALL additionally state:

- stable rule identity and version;
- recognized external concern owner for the protected meaning;
- exact technical claim and polarity;
- hard-rule, owner-defined policy, heuristic/smell, or metric/advisory character;
- applicability and exclusions;
- eligible `JAN-CSAA-003` capability profiles;
- required semantic facts, queries, execution evidence, and corroboration;
- satisfaction, violation, inconclusive, and not-applicable criteria;
- profile-derived severity, confidence interpretation, and transition-effect design treatment;
- known false-positive, false-negative, and provider-disagreement classes;
- finding creation and deduplication rules;
- disposition, remediation, reanalysis, suppression, and exception behavior;
- invalidation and recurrence semantics;
- independently owned fixture/oracle reference; and
- whether the profile is `RULE_ONLY` or cites exact inert RGT design provenance.

A rule SHALL NOT invent a recognized architecture, contract, security boundary, behavior oracle, test floor, license policy, or risk appetite. It SHALL reference the exact concern-owning artifact.

---

## 8. Baseline Analysis Rule Profile catalog

All candidate profiles below are `0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`. IDs are stable; exact serialized profiles and oracle content do not yet exist.

| Profile | Assurance area | Allocation | Required boundary |
| --- | --- | --- | --- |
| `JAN-CSAA-004-ARP-001` | Composite implementation readiness | Rule plus non-instantiated design template `RGT-001` | Strictest unresolved result for enumerated obligations; never arbitrary implementation correctness |
| `JAN-CSAA-004-ARP-002` | Syntax and type correctness | Rule plus non-instantiated design template `RGT-002` | Exact compiler, configuration, and project-reference coverage; type success does not prove behavior |
| `JAN-CSAA-004-ARP-003` | Contract conformance | Rule plus non-instantiated design template `RGT-003` | Requires recognized contract owner and exact enforced contract/reference version |
| `JAN-CSAA-004-ARP-004` | Architecture-boundary conformance | Rule plus non-instantiated design template `RGT-004` | Maps recognized constraints; never invents architecture; dynamic dependency limits visible |
| `JAN-CSAA-004-ARP-005` | Dependency integrity and cycles | Rule plus non-instantiated design template `RGT-005` | Scope, resolution, direction, cycle, and unresolved-import semantics explicit |
| `JAN-CSAA-004-ARP-006` | Dead or unreachable code | Rule only | Candidate unreachable under declared reachability surface; no baseline removal gate |
| `JAN-CSAA-004-ARP-007` | Coupling and change amplification | Rule only | Compatible before/after metric and impact closure; generic metric is not architecture violation |
| `JAN-CSAA-004-ARP-008` | Behavioral preservation | Rule plus non-instantiated design template `RGT-008` | Requires governed behavior/contract oracle; tests and coverage alone are insufficient |
| `JAN-CSAA-004-ARP-009` | Test adequacy | Rule plus non-instantiated design template `RGT-009` | Obligation coverage, mutation, assertion strength, isolation, mocking, and changed-module treatment |
| `JAN-CSAA-004-ARP-010` | Security weakness and taint flow | Rule plus non-instantiated design template `RGT-010` | Owner-defined security-rule violations remain technical conclusions; only a separately designated future RGP may assign a blocking effect; incomplete source/sink/framework coverage cannot yield a clean bill |
| `JAN-CSAA-004-ARP-011` | Third-party and supply-chain exposure | Rule plus non-instantiated design template `RGT-011` | Feed identity/time, lockfile scope, integrity, vulnerability, provenance, and license policy explicit |
| `JAN-CSAA-004-ARP-012` | Unsafe input/output handling | Rule plus non-instantiated design template `RGT-012` | Exact trust boundaries and taint coverage; unsupported boundaries are inconclusive |
| `JAN-CSAA-004-ARP-013` | Concurrency and asynchronous-control risk | Rule only | Generic warnings are signals; hard contracts route to contract, security, or behavior gates |
| `JAN-CSAA-004-ARP-014` | Error and recovery behavior | Rule only | Static smells cannot establish restart, retry, rollback, or recovery correctness |
| `JAN-CSAA-004-ARP-015` | Observability sufficiency | Rule only | Static telemetry presence does not establish reconstructable runtime observability |
| `JAN-CSAA-004-ARP-016` | Maintainability and complexity | Rule plus non-instantiated design template `RGT-016` | Exact changed-module thresholds remain separately versioned oracle content |
| `JAN-CSAA-004-ARP-017` | Semantic-index freshness and completeness | Rule plus non-instantiated design template `RGT-017` | Meta-prerequisite for positive analysis/gate results; missing invalidation edge never proves freshness |

Twelve non-instantiated Repository Gate Templates are documented: `RGT-001` through `005`, `RGT-008` through `012`, `RGT-016`, and `RGT-017`. They are not Repository Gate Profiles and have no protected-transition effect. Five areas are intentionally Rule only.

### 8.1 Explicit Analysis Rule Profile facet bindings

Every row below explicitly incorporates `ARP-COM-001` through `ARP-COM-028`. The following addenda fix one claim character and the minimum rule-specific meaning for each profile. The subsequent numbered clauses bind the original eighteen navigational facets of §5 in order and supplement, but do not replace, the common clauses and addenda. No blank means `N/A`. Within those navigational rows, every unassigned ARP binding-authority phrase resolves exactly to `UNASSIGNED — no recognized ARP-binding record`; every definitive-carrier or interim-carrier phrase resolves exactly to `N/A — no instantiated RGP or protected transition`. Neither state reserves a future value or implies missing required profile content. Within an ARP row, `withholds` means withholds a supported technical conclusion; it never means that the ARP itself withholds a protected transition. Every described exception authority or condition is prospective design information only; the present exception field is `N/A — no instantiated RGP or protected transition`.

| Profile | Common clauses | Fixed character | Profile-specific bounded claim, false-positive classes, and false-negative classes |
| --- | --- | --- | --- |
| `ARP-001` | `ARP-COM-001`–`028` | `OWNER_DEFINED_RULE` | Composite result over one exact closed obligation and component-profile population. Support requires every applicable required component supported; violation requires a supported violation in at least one required component; exception and future gate-blocking treatment remain separate and do not alter that technical conclusion; any missing or unresolved component is inconclusive. False positives: wrong composition or duplicated component. False negatives: omitted obligation or profile, or hidden conflict. Component findings are linked rather than duplicated. |
| `ARP-002` | `ARP-COM-001`–`028` | `HARD_INVARIANT` | Exact subject parses, binds, and type-checks under the named compiler, project, configuration, and generated context. `N/A` requires proof that no TypeScript-bearing surface applies. False positives: wrong configuration, ambient context, or generated mapping. False negatives: excluded projects, generated or ambient gaps, or permissive compiler options. Finding grain is diagnostic criterion plus semantic and source location. |
| `ARP-003` | `ARP-COM-001`–`028` | `OWNER_DEFINED_RULE` | Exact subject conforms to one recognized contract owner, version, and compatibility criterion. `N/A` requires proof that no protected contract surface applies. False positives: shape-only comparison or generated-map mismatch. False negatives: omitted consumers, conditional exports, declaration seams, or version seams. |
| `ARP-004` | `ARP-COM-001`–`028` | `OWNER_DEFINED_RULE` | Exact recognized architecture constraints hold for the declared dependency and entry population. Inferred architecture is evidence, never authority. False positives: incorrect resolution or inferred boundary. False negatives: dynamic, reflective, generated, framework, or runtime edges. |
| `ARP-005` | `ARP-COM-001`–`028` | `OWNER_DEFINED_RULE` | Exact dependency-direction, integrity, resolution, or cycle rule holds over a closed declared population. False positives: alias or conditional-export misresolution, or a spurious cycle. False negatives: dynamic loads, generated imports, missing manifests, or runtime dependencies. |
| `ARP-006` | `ARP-COM-001`–`028` | `HEURISTIC_SMELL` | A declaration is a candidate unreachable under the declared reachability surface; this is not dead-code truth or removal permission. A supported candidate creates an advisory finding; demonstrated reachability contradicts it. False positives: missed entry mechanism. False negatives: a spurious or inferred path hiding genuine unreachability. Exception field: `N/A — no instantiated RGP or protected transition`. |
| `ARP-007` | `ARP-COM-001`–`028` | `METRIC_ADVISORY` | Report exact compatible coupling and change-amplification measurements and impact paths. No architecture violation exists without a separate exact owner-defined rule. False positives: incompatible metric or unstable lineage. False negatives: omitted dynamic or generated dependencies. Threshold absence is `N/A`, not zero. |
| `ARP-008` | `ARP-COM-001`–`028` | `OWNER_DEFINED_RULE` | Exact governed behavior is preserved between compatible subjects under an exact oracle and adequate evidence. `N/A` requires proof that no governed affected behavior applies. False positives: flake, environment, or workload incompatibility. False negatives: inadequate selection, coverage, assertions, mutation, mocks, or runtime workload. |
| `ARP-009` | `ARP-COM-001`–`028` | `OWNER_DEFINED_RULE` | Tests adequately protect an exact changed-risk and obligation population across every bound dimension. False positives: unrepresentative mutants or denominator. False negatives: never-failing tests, weak assertions, excessive mocking, order dependence, or omitted changed modules. |
| `ARP-010` | `ARP-COM-001`–`028` | `OWNER_DEFINED_RULE` | Exact security rule is satisfied across declared sources, sinks, sanitizers, propagation, frameworks, and trust boundaries. False positives: infeasible flow or incorrect sanitizer model. False negatives: missing source or sink, implicit or native flow, reflection, or framework model. A heuristic weakness requires a separate profile. |
| `ARP-011` | `ARP-COM-001`–`028` | `OWNER_DEFINED_RULE` | Exact supply-chain, security, legal, or license policy holds for the resolved component population and named feeds and cutoffs. False positives: component alias or advisory mismatch. False negatives: unresolved transitives, stale feed, missing lock resolution, provenance gap, or license-scope gap. |
| `ARP-012` | `ARP-COM-001`–`028` | `OWNER_DEFINED_RULE` | Exact unsafe-input or output policy holds at named trust boundaries. False positives: infeasible path, encoding error, or sanitizer-order mis-model. False negatives: hidden entry, native boundary, dynamic dispatch, or framework seam. |
| `ARP-013` | `ARP-COM-001`–`028` | `HEURISTIC_SMELL` | A bounded concurrency or asynchronous-control risk pattern is present. It never establishes violation of an unstated contract or universal safety. False positives: framework serialization or synchronization guarantee. False negatives: scheduler, runtime, library, event-loop, or hidden-state seam. |
| `ARP-014` | `ARP-COM-001`–`028` | `HEURISTIC_SMELL` | A bounded error, retry, or recovery risk pattern is present. Static absence never proves restart, idempotency, rollback, or recovery correctness. False positives: external or framework guarantee. False negatives: hidden effects, crash windows, retries, compensation, or restart behavior. |
| `ARP-015` | `ARP-COM-001`–`028` | `OWNER_DEFINED_RULE` | Exact observability obligations are satisfied, including runtime reconstructability where required. Static telemetry presence alone is insufficient. False positives: dead or uncollected telemetry, or incompatible collector. False negatives: missing failure path, fields, redaction, dropped events, or environment and workload gaps. |
| `ARP-016` | `ARP-COM-001`–`028` | `METRIC_ADVISORY` | Report exact compatible maintainability and complexity measurements at changed-module grain and any separately owned threshold comparison. False positives: metric instability or generated-code classification error. False negatives: averaging dilution, omitted paths, or gaming. No threshold means `N/A`, not satisfied. |
| `ARP-017` | `ARP-COM-001`–`028` | `HARD_INVARIANT` | Every analysis-dependent conclusion binds the exact current subject, required capability coverage, provider health, invalidation closure, and atomic publication basis. `N/A` requires proof that no analysis-dependent conclusion is requested. False positives: over-broad invalidation. False negatives: missing dependency edge, cache contamination, mixed revision, or last-known-good substitution. |

| Profile | Explicit eighteen-facet record |
| --- | --- |
| `ARP-001` | **1** `JAN-CSAA-004-ARP-001@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate readiness for one enumerated obligation population before a separately named integration transition; **3** exact repository subject plus the exact component-profile population, applicability unresolved if that population is open; **4** fixed claim character `OWNER_DEFINED_RULE` for the bounded composite-readiness rule; **5** current component Rule Application Results and their exact evidence; **6** satisfied only when every required component is supported, violated when at least one required component has a supported violation, otherwise inconclusive or not applicable by exact population; component exceptions and future gate effects remain separate from this technical conclusion; **7** severity is the strictest applicable component and confidence is not averaged; **8** exact inert design provenance `RGT-001`; no gate eligibility, designation, or RGP exists; **9** profile owner CSAA rule concern, binding authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** local execution is early feedback and every missing/stale/failed component is non-green; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** component-oracle and change authorship separation required; **14** every capability required by the exact component set; **15** omission and incompatible component versions are known false-green risks, disagreement remains conflict; **16** remediation requires exact successor-subject component reanalysis; **17** component exceptions retain their own authorities and scopes; **18** retain all component raw, normalized, exception, conflict, aggregate, and supersession records. |
| `ARP-002` | **1** `JAN-CSAA-004-ARP-002@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate syntax and type correctness before a technical integration transition; **3** exact subject, compiler version, project/reference closure, configuration, generated context, and included/excluded files; **4** fixed claim character `HARD_INVARIANT` for compiler-semantic correctness; **5** `CAP-001`–`CAP-003`, `CAP-010`–`CAP-017`, diagnostics, and generation health; **6** satisfied only with complete healthy configured analysis and no profile-defined error, violated by supported error, otherwise inconclusive/not applicable; **7** severity comes from exact profile criteria, provider diagnostic category remains raw; **8** exact inert design provenance `RGT-002`; no gate eligibility, designation, or RGP exists; **9** compiler/contract concern owner recognized per bound profile, gate authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** missing project or generation context withholds, local result is early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** oracle/profile change separated from implementation change; **14** named capabilities above; **15** ambient/generated gaps and provider disagreement remain visible; **16** successor-subject full affected-project reanalysis; **17** exception only by bound technical authority and never for malformed or unidentified subject; **18** retain diagnostics, raw outputs, contexts, mappings, evaluation, and history. |
| `ARP-003` | **1** `JAN-CSAA-004-ARP-003@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate conformance to an exact recognized contract before a contract-affecting transition; **3** exact subject, contract owner/version, contract surface, generated artifacts, consumer context, and applicability; **4** fixed claim character `OWNER_DEFINED_RULE` for contract conformance; **5** `CAP-002`–`CAP-004`, `CAP-010`–`CAP-017`, `CAP-032`, exact enforced contract and compatibility oracle; **6** criteria distinguish supported conformance, supported incompatibility, inconclusive mapping, and not applicable; **7** severity derives from contract rule, confidence exposes mapping basis; **8** exact inert design provenance `RGT-003`; no gate eligibility, designation, or RGP exists; **9** contract owner and gate authority separately bound, both unassigned here; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** missing owner/version or ambiguous mapping withholds, local checks are early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** contract-oracle change independent from affected implementation; **14** named capabilities above; **15** shape similarity and generated-map gaps are known false-support risks, disagreement remains conflict; **16** remediation requires successor comparison and contract reanalysis; **17** exception authority comes from contract concern owner and preserves incompatibility; **18** retain contracts, maps, facts, raw outputs, comparisons, exceptions, and history. |
| `ARP-004` | **1** `JAN-CSAA-004-ARP-004@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate recognized architecture-boundary constraints before integration; **3** exact subject, architecture rule/version, package/project scope, resolver and entry-point coverage; **4** fixed claim character `OWNER_DEFINED_RULE` for recognized architecture-boundary conformance; **5** `CAP-004`, `CAP-005`, `CAP-009`–`CAP-012`, `CAP-024`–`CAP-026`, exact recognized constraint; **6** a supported prohibited edge is a technical violation only under adequate coverage; unresolved dynamic dependency is inconclusive; **7** severity comes from architecture rule and confidence exposes inferred edges; **8** exact inert design provenance `RGT-004`; no gate eligibility, designation, or RGP exists; **9** architecture owner distinct from rule executor, binding authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** unresolved resolution/framework entry withholds clean result, local run is early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** architecture oracle independent of implementation change; **14** named capabilities above; **15** inferred architecture and missing dynamic edges are known error classes, disagreement preserved; **16** successor-subject dependency and entry reanalysis; **17** exception only by architecture authority and never converts inferred architecture to recognized authority; **18** retain exact constraints, graphs, raw outputs, inference, findings, exceptions, and history. |
| `ARP-005` | **1** `JAN-CSAA-004-ARP-005@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate dependency integrity and cycles before integration; **3** exact package/project population, manifests, lockfiles, resolver conditions, source imports, generated contexts, and runtime evidence where required; **4** fixed claim character `OWNER_DEFINED_RULE` for dependency integrity; **5** `CAP-004`, `CAP-009`–`CAP-012`, `CAP-023`–`CAP-025`; **6** supported prohibited edge/cycle is violation, supported allowed closed population is satisfaction, unresolved resolution is inconclusive; **7** severity derives from exact dependency rule, inference confidence separate; **8** exact inert design provenance `RGT-005`; no gate eligibility, designation, or RGP exists; **9** dependency/architecture owner and gate authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** resolution failure or partial graph withholds, local check is early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** rule/oracle author separate from affected change; **14** named capabilities above; **15** lexical-only edges and hidden runtime loads are known error classes, disagreement preserved; **16** successor-subject resolution and cycle reanalysis; **17** exception requires exact edge/cycle scope and authority; **18** retain manifests, resolution attempts, graph, raw output, findings, exceptions, and history. |
| `ARP-006` | **1** `JAN-CSAA-004-ARP-006@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** identify reachability/dead-code candidates for human engineering review, not removal permission; **3** exact subject, declaration population, entry-universe declaration, project/framework/generated/runtime contexts; **4** fixed claim character `HEURISTIC_SMELL` for a candidate-unreachable signal; **5** `CAP-002`, `CAP-004`–`CAP-007`, `CAP-009`–`CAP-019`, `CAP-022`–`CAP-025`, `CAP-029`–`CAP-031`; **6** candidate only when no path is found under declared coverage, any unresolved entry makes inconclusive, not-applicable by exact declaration class; **7** severity is advisory and confidence states reachability basis; **8** Rule only, nonblocking baseline; **9** technical profile owner only, no removal authority; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** local result is advisory and failure/partiality is inconclusive; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** expected reachability judgment independently reviewed; **14** named capabilities above; **15** all nine dynamic-entry mechanisms and provider blind spots are explicit false-negative classes, disagreement preserved; **16** code change remains pending reanalysis and removal is separately authorized; **17** exception not applicable to make the candidate true, suppression only changes presentation; **18** retain entry universe, paths/frontier, raw output, runtime corroboration, review, and recurrence. |
| `ARP-007` | **1** `JAN-CSAA-004-ARP-007@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** assess coupling and change amplification for planning/review; **3** exact compatible before/after subjects, metric definition/version, population, graph coverage, and impact profile; **4** fixed claim character `METRIC_ADVISORY` for compatible coupling measurements; **5** `CAP-004`, `CAP-005`, `CAP-009`, `CAP-026`, `CAP-029`, `CAP-031`, `CAP-032`; **6** increase/decrease/unchanged only under compatible coverage, otherwise inconclusive/not applicable; **7** severity and confidence require separately owned threshold and compatibility basis; **8** Rule only; **9** technical profile owner, no architecture or gate authority; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** incompatible subjects or metric versions withhold comparison, local result advisory; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** threshold/oracle author separated from affected change; **14** named capabilities above; **15** metric gaming, omitted dynamic edges, and coverage drift are known error classes; **16** successor comparison after remediation; **17** exceptions apply only if an external exact threshold rule is bound; **18** retain both subjects, metric, graphs, impact paths, raw outputs, and history. |
| `ARP-008` | **1** `JAN-CSAA-004-ARP-008@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate preservation of exact governed behavior before integration; **3** exact before/after subjects, behavior/contract oracle, build, test selection, environment, workload, and applicable scope; **4** fixed claim character `OWNER_DEFINED_RULE` for governed behavior preservation; **5** `CAP-018`–`CAP-022`, `CAP-029`, `CAP-031`, `CAP-032`, tests, coverage, traces, mutation where required; **6** support requires oracle satisfaction under adequate evidence, contradiction violates, gaps are inconclusive; **7** severity derives from protected behavior and confidence exposes evidence coverage; **8** exact inert design provenance `RGT-008`; no gate eligibility, designation, or RGP exists; **9** behavior/contract owner and gate authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** failed tests, incompatible evidence, or absent oracle withhold, local run early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** behavior oracle protected from change author; **14** named capabilities above; **15** test selection, coverage, workload, and mapping blind spots are explicit; **16** successor-subject rerun of affected behavior evidence; **17** exception only by behavior owner and preserves failed behavior claim; **18** retain oracle, tests, coverage, traces, comparisons, raw outputs, exceptions, and history. |
| `ARP-009` | **1** `JAN-CSAA-004-ARP-009@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate adequacy of tests protecting an exact changed-risk population; **3** exact subject, changed modules, obligations, test selection, framework, mutation scope, ordering, and mocks; **4** fixed claim character `OWNER_DEFINED_RULE` for exact test adequacy; **5** `CAP-018`–`CAP-021`, `CAP-029`, `CAP-031`, coverage, mutation, assertion-strength, isolation and mocking evidence; **6** satisfaction requires support for every bound adequacy dimension; a supported observed inadequacy, including a surviving required mutant or demonstrated never-fails test, under healthy complete evidence is a technical violation; missing, failed, unsupported, or unresolved evidence is inconclusive and withholds support, never a subject violation by silence; **7** severity derives from protected risk and confidence is evidence-grain; **8** exact inert design provenance `RGT-009`; no gate eligibility, designation, or RGP exists; **9** test-oracle owner and gate authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** missing mutation/selection/denominator evidence withholds, local run early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** adequacy oracle independent of implementation change; **14** named capabilities above; **15** coverage-only, excessive mocking, order dependence, and non-failing assertions are known false-green classes; **16** successor-subject tests plus adequacy reanalysis; **17** exceptions require exact risk and authority, no silent floor lowering; **18** retain tests, selections, coverage, mutants, results, mocks, raw outputs, exceptions, and history. |
| `ARP-010` | **1** `JAN-CSAA-004-ARP-010@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate exact security weakness and taint-flow rules before integration; **3** exact subject, trust boundaries, source/sink/sanitizer/propagation profiles, framework and entry coverage; **4** fixed claim character `OWNER_DEFINED_RULE` for an exact security rule; **5** `CAP-005`–`CAP-009`, `CAP-024`, `CAP-025`, `CAP-029`–`CAP-031`, exact security rules; **6** a supported breach of the exact owner-defined security rule is a technical violation; complete supported satisfaction requires full bound coverage, otherwise the result is inconclusive; **7** severity from security rule, provider severity/confidence raw only; **8** exact inert design provenance `RGT-010`; no gate eligibility, designation, or RGP exists; **9** security concern owner and gate authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** unsupported boundary or malformed/partial analysis withholds, local result early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** security oracle independent and protected; **14** named capabilities above; **15** missing sources/sinks/sanitizers/framework models and disagreement explicit; **16** successor-subject security reanalysis; **17** exception authority and non-waivable categories supplied by security owner; **18** retain rule, graph/paths, raw outputs, coverage, conflicts, exceptions, and history. |
| `ARP-011` | **1** `JAN-CSAA-004-ARP-011@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate third-party and supply-chain exposure before dependency-affecting transition; **3** exact subject, manifests, lockfiles, resolved components, integrity, feed/database cutoff, provenance, vulnerability and license policy; **4** fixed claim character `OWNER_DEFINED_RULE` for exact supply-chain, security, legal, or license policy; **5** `CAP-004`, `CAP-010`–`CAP-012`, `CAP-029`, `CAP-032`, exact feeds and policies; **6** supported prohibited exposure violates, satisfaction requires current complete required feeds and component mapping, otherwise inconclusive; **7** severity from exact policy/advisory and confidence exposes match quality; **8** exact inert design provenance `RGT-011`; no gate eligibility, designation, or RGP exists; **9** security/legal/license owners and gate authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** stale/unavailable/conflicting feed or unresolved component withholds, local check early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** feed/policy oracle independent of dependency change; **14** named capabilities above; **15** aliasing, transitive resolution, stale feeds and advisory conflicts explicit; **16** successor lock/manifest/feed reanalysis; **17** exception authority comes from owning security/legal policy and preserves exposure; **18** retain manifests, locks, feeds, cutoffs, mappings, raw outputs, exceptions, and history. |
| `ARP-012` | **1** `JAN-CSAA-004-ARP-012@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate unsafe input/output handling at exact trust boundaries; **3** exact subject, trust-boundary population, entry mechanisms, source/sink/sanitizer and framework contexts; **4** fixed claim character `OWNER_DEFINED_RULE` for an exact unsafe-input or output rule; **5** `CAP-005`–`CAP-009`, `CAP-024`, `CAP-025`, `CAP-029`–`CAP-031`; **6** supported unsafe path violates, supported safety requires complete bound coverage, otherwise inconclusive; **7** severity from exact trust-boundary policy and confidence exposes path basis; **8** exact inert design provenance `RGT-012`; no gate eligibility, designation, or RGP exists; **9** security owner and gate authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** unsupported boundary or partial taint model withholds, local check early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** trust-boundary oracle independent; **14** named capabilities above; **15** hidden entry, sanitizer order, native boundary and framework blind spots explicit; **16** successor-subject path reanalysis; **17** exception only under exact security authority and non-waivability; **18** retain boundaries, paths, raw outputs, coverage, conflicts, exceptions, and history. |
| `ARP-013` | **1** `JAN-CSAA-004-ARP-013@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** identify concurrency and asynchronous-control risk candidates; **3** exact subject, async/control-flow scope, concurrency model, runtime context and exclusions; **4** fixed claim character `HEURISTIC_SMELL`; any external hard contract requires a separate profile; **5** `CAP-005`–`CAP-007`, `CAP-022`, `CAP-029`–`CAP-031`; **6** supported pattern creates candidate, unsupported scheduling/control is inconclusive, no universal safety conclusion; **7** advisory severity and bounded confidence; **8** Rule only; **9** technical profile owner, no hard-contract or gate authority; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** failure/partiality remains inconclusive, local result advisory; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** scenario oracle independently reviewed; **14** named capabilities above; **15** scheduler, event-loop, library and runtime blind spots explicit; **16** successor-subject reanalysis; **17** suppression does not remove risk and exception requires an external hard rule; **18** retain control/data paths, runtime observations, raw output, review, and history. |
| `ARP-014` | **1** `JAN-CSAA-004-ARP-014@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** identify error and recovery risk candidates; **3** exact subject, error/retry/restart/rollback scope, external effects and runtime evidence; **4** fixed claim character `HEURISTIC_SMELL`; any external hard contract requires a separate profile; **5** `CAP-005`–`CAP-007`, `CAP-022`, `CAP-029`–`CAP-031`; **6** supported risky pattern creates candidate, static absence never proves recovery, unsupported behavior inconclusive; **7** advisory severity/confidence; **8** Rule only; **9** technical profile owner, no recovery-contract or gate authority; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** missing runtime/recovery evidence remains inconclusive, local result advisory; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** recovery oracle independently reviewed; **14** named capabilities above; **15** hidden external effects, framework retries and crash windows explicit; **16** successor-subject and later executable recovery reanalysis; **17** exception only through an external exact contract profile; **18** retain paths, assumptions, raw outputs, runtime corroboration, review, and history. |
| `ARP-015` | **1** `JAN-CSAA-004-ARP-015@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** identify observability-sufficiency signals against exact reconstruction obligations; **3** exact subject, required events/logs/metrics/traces, failure paths, environment and runtime evidence; **4** fixed claim character `OWNER_DEFINED_RULE` for a cited observability obligation; **5** `CAP-004`–`CAP-007`, `CAP-022`, `CAP-029`–`CAP-031`, exact observability obligation; **6** static presence is candidate support only, runtime reconstruction evidence required for stronger conclusion, missing required signal may violate exact rule; **7** severity from cited obligation and confidence exposes static/runtime basis; **8** Rule only; **9** observability concern owner distinct from technical executor; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** missing runtime evidence withholds strong support, local result advisory; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** observability oracle independently reviewed; **14** named capabilities above; **15** dead logging, wrong fields, redaction, unreachable paths and collector gaps explicit; **16** successor-subject/runtime reanalysis; **17** exception only by obligation owner; **18** retain obligations, code facts, traces, reconstruction evidence, raw output, and history. |
| `ARP-016` | **1** `JAN-CSAA-004-ARP-016@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate maintainability and complexity at changed-module grain before integration; **3** exact before/after subject, changed-module population, metric/version, thresholds, exclusions and generated treatment; **4** fixed claim character `METRIC_ADVISORY` for compatible maintainability and complexity measurements; **5** `CAP-001`–`CAP-009`, `CAP-026`, `CAP-029`, `CAP-031`, `CAP-032`, exact threshold oracle; **6** supported threshold violation versus satisfaction under compatible complete measurements, otherwise inconclusive; **7** severity from exact threshold and confidence exposes metric stability; **8** exact inert design provenance `RGT-016`; no gate eligibility, designation, or RGP exists; **9** quality-rule owner and gate authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** incompatible metrics/coverage withhold, local result early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** threshold/oracle change independent of affected implementation; **14** named capabilities above; **15** generated-code dilution, repository averages and metric gaming explicit; **16** successor-subject changed-module reanalysis; **17** exception exact, scoped, expiring, and authority-bound; **18** retain subjects, metrics, thresholds, raw output, comparisons, exceptions, and history. |
| `ARP-017` | **1** `JAN-CSAA-004-ARP-017@0.1.0 / Draft / UNFROZEN / NO_EFFECTIVE_STANDING`, no predecessor; **2** evaluate semantic-index freshness/completeness before any positive analysis-based gate; **3** exact subject, index snapshot, capability population, invalidation closure, provider health, publication evidence and access context; **4** fixed claim character `HARD_INVARIANT` for analysis-subject freshness and completeness; **5** all required `JAN-CSAA-003` capabilities plus subject/invalidation/publication provenance; **6** support requires exact identity, complete required coverage, healthy providers, resolved invalidation and atomic publication; a supported breach of an identity, coverage, invalidation, or publication invariant under healthy complete evidence is a technical violation; missing, failed, unsupported, or unresolved evidence is inconclusive and withholds support, never a subject violation by silence; **7** profile-derived semantic-index criterion severity is independent of confidence and has no ARP-level blocking effect; **8** exact inert design provenance `RGT-017`; no gate eligibility, designation, or RGP exists; **9** semantic-index owner and gate authority unassigned; **10** definitive transition carrier `N/A — no instantiated RGP or protected transition`; **11** missing edges, last-known-good, partial publication or provider failure withholds, local result early feedback; **12** interim transition carrier `N/A — no instantiated RGP or protected transition`; **13** freshness oracle independent from index implementation; **14** every capability required by dependent gate plus invalidation/publication checks; **15** missing dependency edges, cache contamination and mixed revision explicit; **16** clean successor analysis/recovery and re-evaluation; **17** evidence-gap exception prohibited by default; **18** retain subject, dependency closure, health, publication, raw output, evaluation, and history. |

### 8.2 Dead-code constraint

`ARP-006` SHALL claim only “candidate unreachable under the declared reachability surface.” Its evidence SHALL enumerate coverage of framework, reflection, dynamic import, event, registration, external, runtime, generated, and configuration entry mechanisms.

Any applicable unresolved, unsupported, stale, failed, excluded, not-evaluated, or incomplete mechanism makes the result inconclusive and prevents a negative reachability conclusion. Merely displaying that frontier is disclosure, not closure. Zero observed static callers SHALL NOT mean dead code or safe removal.

---

## 9. Rule Application Result

Every Rule Application Result SHALL retain:

- permanent immutable result identity, semantic version, content identity, lifecycle, predecessor, and successor;
- producing Analysis Run and Analysis Invocation identities;
- exact subject and rule-profile identity/version/content identity;
- exact concern-owning criterion or rule reference;
- exact capability profiles, providers, adapters, qualifications where required, configurations, raw results, and normalized facts;
- raw-to-normalized transformation and validation lineage;
- applicability result and rationale;
- execution-health, evidence-state, epistemic, and disagreement dimensions;
- coverage basis, unsupported regions, freshness, and invalidation dependencies;
- criterion-by-criterion result and explanation;
- resulting technical conclusion and profile-derived severity/blocking context;
- every created or linked finding, with reciprocal exact result identity;
- observation and record times; and
- historical predecessor or supersession relation.

A malformed provider result MAY be retained as diagnostic raw material. It SHALL NOT create an accepted Rule Application Result or Finding Record.

The accepted result core is immutable. Correction, re-evaluation, subject change, profile change, capability or provider change, qualification change, evidence change, or invalidation creates a successor result and preserves the predecessor. A result mismatch makes the affected conclusion unusable for current support; it does not rewrite the prior observation.

---

## 10. Analyzer Finding Record

### 10.1 Immutable observation core

Every Analyzer Finding Record SHALL preserve:

- stable occurrence identity and recurrence lineage;
- exact producing Rule Application Result identity and content identity;
- exact repository subject and revision;
- exact Rule Profile identity/version;
- precise claim, location, deficiency, implication, and rule character;
- profile-derived severity and blocking context;
- raw provider severity/confidence as separate metadata;
- evidence, raw result, invocation, provider/rule-set/configuration, normalization, and transformation references;
- capability coverage, health, freshness, unsupported regions, and conflicts;
- exception, suppression, disposition, remediation, and reanalysis references; and
- creation, invalidation, supersession, and append-only history.

The immutable observation core SHALL NOT be rewritten. A correction creates a successor. Recurrence creates a new occurrence linked by lineage. Deduplication links records without erasing them.

### 10.2 Technical status only

An Analyzer Finding Record is a technical observation record. It is not canon's Assurance Observation. Entry into canonical assurance requires an explicitly governed mapping in which the Assurance Service independently evaluates admissibility and re-derives the canonical result.

---

## 11. Review, remediation, suppression, and exception

### 11.1 Separate axes

Finding treatment SHALL preserve separate axes:

| Axis | Candidate meanings |
| --- | --- |
| Review | Unreviewed, confirmed, disputed, false positive, duplicate |
| Remediation | Unresolved, remediation proposed, changed pending reanalysis, resolved by successor-subject reanalysis |
| Freshness | Current, stale, invalidated, superseded |
| Exception effect | None, effective, expired, revoked, invalid |
| Suppression effect | Presentation/configuration treatment only |

Exact enum spelling belongs to `JAN-CSAA-007`.

Every Finding Disposition, Remediation, Reanalysis, Suppression Treatment, and Engineering Exception Record SHALL carry permanent identity, semantic version, immutable content identity, lifecycle, predecessor and successor, exact subject and target identities, actor, authority and authority evidence where effect is consequential, observation or effective time and record time, cited evidence and raw provenance, assumptions and limitations, invalidation dependencies, challenge, correction, revocation and supersession history, and access, redaction and retention treatment. Every inapplicable field SHALL contain literal `N/A` with rationale.

### 11.2 Finding Disposition Record

Every non-unreviewed review action SHALL create an immutable Finding Disposition Record with:

- permanent disposition identity, semantic version, content identity, lifecycle, predecessor, and successor;
- exact finding and producing Rule Application Result identities and content identities;
- one exact disposition meaning;
- reviewer identity, recognized review authority, decision time, and record time;
- cited evidence, rationale, assumptions, limitations, and conflict treatment;
- for duplicate, the exact surviving and duplicate occurrence identities;
- for disputed, every competing position and the unresolved issue;
- for false positive, a re-derived explanation of why the profile criterion does not apply or was not met, independent of the provider's preferred label; and
- append-only challenge, correction, invalidation, revocation, and supersession history.

A provider, result producer, or affected change author SHALL NOT dispose its own finding solely by declaration. A disposition changes review treatment only. It does not rewrite the finding, Rule Application Result, raw output, or criterion. Confirmed, disputed, false-positive, and duplicate dispositions remain attributable and reconstructable.

### 11.3 Remediation and Reanalysis Records

Every remediation proposal or claimed change SHALL create an immutable Remediation Record with permanent identity, version, content identity, lifecycle, exact finding and result targets, actor, proposed action, exact successor-change identity where performed, rationale, time, predecessor, successor, and status.

`Changed pending reanalysis` requires an exact successor subject. `Resolved by reanalysis` additionally requires an exact successful successor Rule Application Result, compatible profile and criterion identity, current complete-enough evidence, and an explicit link from the prior finding and remediation record. A change or later success never deletes the historical finding.

Every reanalysis attempt SHALL retain its own run, invocation, subject, profile, provider, qualification, evidence, health, outcome, and failure history. Failed or inconclusive reanalysis cannot resolve the finding.

### 11.4 Suppression Treatment Record

Every suppression SHALL create an attributable, append-only Suppression Treatment Record with permanent identity, configuration or policy version and content identity, exact finding or rule target and scope, actor and authority, rationale, effective time, expiry or review trigger, predecessor and successor, and a mandatory-visibility indicator.

Suppression SHALL NOT establish defect removal, rule satisfaction, exception effectiveness, or gate permission. Analyzer ignore configuration SHALL remain visible in configuration identity and coverage accounting. Configuration silence is not an exception. Expired, revoked, invalid, or mismatched suppression remains historical and has no presentation effect on the current subject.

### 11.5 Engineering Exception Record

Every Engineering Exception Record SHALL have permanent identity, semantic version, immutable content identity, lifecycle, predecessor, and successor independent of its target records.

An effective Engineering Exception Record SHALL additionally bind:

- exact rule, criterion, Gate Profile, protected transition, subject, and version scope; and either exact finding and producing Rule Application Result identities when they exist, or the exact failed or not-analyzed gate-prerequisite/evidence-deficiency coordinate plus invocation or attempt identity when no accepted result and finding can exist;
- effective authority and authority evidence;
- rationale and accepted residual technical risk;
- author, reviewer, effective time, record time, expiry, review triggers, and renewal behavior;
- conditions and compensating controls;
- downstream impact;
- revocation, challenge, correction, and supersession; and
- non-waivability imposed by the external concern owner.

An exception changes permission at one protected technical boundary. It does not turn violation into support, revive stale or invalid evidence, erase a finding, change provider output, or create a canonical waiver.

Missing, stale, expired, partial, mismatched, or conflicting provider qualification is never exception-eligible. For any other exact stale, unsupported, incomplete, conflicting, failed, or not-analyzed evidence deficiency, the conservative default prohibits an exception unless a higher concern-owning authority explicitly permits that exact gap. Such an exception changes permission only at its exact protected transition, preserves the unresolved evidence visibly, and cannot create support or revive invalid evidence.

---

## 12. Repository Gate Profile

No binding-gate designation exists for any assurance area in this Draft. Therefore no Repository Gate Profile instance is defined here. The exact non-instantiated Repository Gate Template set is `RGT-001`–`RGT-005`, `RGT-008`–`RGT-012`, `RGT-016`, and `RGT-017`. A template is an inert design aid: it has no profile identity usable by an evaluator, no authority, no carrier, and no transition effect.

An RGP may be instantiated only after a separate recognized record designates the exact assurance area, protected transition, concern owner, and binding-gate need. Instantiation SHALL create a separately versioned permanent RGP identity and immutable content identity, bind exact component ARP versions, identify recognized authority and carrier or remain explicitly unbound, bind an independently governed oracle-change procedure, and preserve the originating RGT only as design provenance. A template ID SHALL NOT be passed to a Repository Gate Evaluation.

Template completeness is not profile completeness. An RGT is complete only when every prospective design field is either populated with a reusable invariant or marked `UNRESOLVED_BY_DESIGNATION`. Binding authority, definitive carrier, protected-transition effect, RGP identity, provider qualification, effective oracle, exception authority, and effective time are designation inputs and SHALL NOT be marked `N/A`. An interim carrier and authority-transfer plan MAY be literal `N/A` with rationale when no interim carrier applies.

An RGT suffix does not reserve the corresponding RGP suffix. A recognized designation and collision check assign the permanent RGP identity. No RGT may self-designate, be evaluated, or be supplied as a profile reference.

A recognized designation SHALL identify:

1. exact authoritative designation record and effective time;
2. assurance area and exact protected technical transition;
3. exact component ARP identities, versions, and content identities;
4. a nonempty closed blocking component population and a closed advisory component population;
5. recognized concern owner, and binding authority or an explicit `UNBOUND` state with rationale;
6. definitive carrier and versioned enforcement artifact, or an explicit `UNBOUND` state with rationale;
7. registered interim carrier and authority-transfer plan, or literal `N/A` with rationale;
8. exact provider qualification prerequisites;
9. independently governed oracle and oracle-change procedure;
10. exception authority and non-waivable conditions;
11. applicability, scope, exclusions, and subject/version rules; and
12. retention, invalidation, re-evaluation, supersession, and withdrawal rules.

Once separately designated, every Repository Gate Profile SHALL define:

- permanent profile identity, semantic version, content identity, and lifecycle;
- exact component Rule Profile versions;
- protected technical transition;
- subject/revision applicability and exclusions;
- recognized binding authority or explicit unbound state;
- definitive non-bypassable carrier or explicit unbound state;
- registered interim carrier and authority-transfer plan where applicable;
- required evidence, coverage, freshness, provider health, and independence;
- blocking and advisory rules;
- strictest-unresolved aggregation;
- exception eligibility and authority;
- local-run treatment;
- failure, timeout, disagreement, stale-input, and re-evaluation behavior;
- oracle-change procedure; and
- raw, normalized, evaluation, exception, and supersession retention.

The profile SHALL reference criteria by exact Rule Profile identity and version. It SHALL NOT copy criteria into each evaluation.

A binding gate requires both recognized authority and a carrier the affected change author cannot bypass. Missing either makes an instantiated profile unbound or interim. Profile existence alone is never enforcement.

### 12.1 Non-instantiated Repository Gate Template bindings

The numbered clauses in each row document how a future separately designated RGP might resolve the eighteen facets of §5. They do not instantiate or bind an RGP. Every `RGT` lifecycle is `Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`. A prospective reusable invariant may be populated, but every actual binding value that only a recognized designation can supply remains `UNRESOLVED_BY_DESIGNATION`; every authority, carrier, protected-transition effect, provider qualification, and oracle conferral remains absent.

Within the navigational rows below, `unassigned`, `absent`, or an equivalent phrase applied to a designation-supplied field resolves exactly to `UNRESOLVED_BY_DESIGNATION`; it never means `N/A`, permission, withholding, failure, or a reserved future value.

| Template | Prospective eighteen-facet design record |
| --- | --- |
| `RGT-001` | **1** `JAN-CSAA-004-RGT-001@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect a separately named composite-readiness transition; **3** exact subject and enumerated `ARP-001` component population; **4** composite readiness claim only; **5** exact current Rule Application Results and evidence referenced by `ARP-001`; **6** satisfied, permitted-with-exception, blocked, withheld, and not-applicable per §13.2; **7** strictest component severity, confidence never averaged; **8** every unexcepted blocking violation blocks and every unresolved required component withholds; **9** content owner CSAA rule concern, binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** failure/stale/partial/conflict withholds and local run is early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** change, profile/oracle, execution, disposition, and exception roles separated; **14** capabilities are the exact union declared by component ARPs; **15** omitted or mismatched components are false-green risks and disagreement remains conflict; **16** successor subject and complete component re-evaluation required; **17** only exact effective component exceptions apply; **18** retain component inputs, raw/normalized evidence, findings, exceptions, aggregate derivation, and history. |
| `RGT-002` | **1** `JAN-CSAA-004-RGT-002@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect an exact syntax/type integration transition; **3** exact subject and `ARP-002` applicability; **4** syntax/type gate claim; **5** exact `ARP-002` Rule Application Result and evidence; **6** §13.2 outcomes with no copied criteria; **7** profile-derived severity/confidence; **8** supported profile violation blocks and required uncertainty withholds; **9** compiler/contract binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** missing generation/project context or provider failure withholds, local run early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** profile/oracle independent from affected change; **14** `ARP-002` capability set; **15** ambient/generated gaps and provider conflict preserved; **16** successor-subject affected-project re-evaluation; **17** exact effective exception only; **18** retain profile, inputs, diagnostics, raw outputs, findings, exceptions, evaluation, and history. |
| `RGT-003` | **1** `JAN-CSAA-004-RGT-003@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect an exact contract-affecting transition; **3** exact subject, contract owner/version, and `ARP-003` applicability; **4** contract-conformance gate claim; **5** exact `ARP-003` result and contract evidence; **6** §13.2 outcomes; **7** contract-derived severity and mapping confidence; **8** supported incompatibility blocks and mapping uncertainty withholds; **9** contract/gate binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** absent contract authority/version or incompatible mapping withholds, local run early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** contract oracle protected from change author; **14** `ARP-003` capability set; **15** shape similarity and generated mapping risks preserved; **16** successor comparison and re-evaluation; **17** exact contract-authority exception only; **18** retain contracts, mappings, facts, raw output, findings, exceptions, evaluation, and history. |
| `RGT-004` | **1** `JAN-CSAA-004-RGT-004@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect an exact architecture-boundary transition; **3** exact subject, recognized constraint/version, and `ARP-004` applicability; **4** architecture-boundary gate claim; **5** exact `ARP-004` result, graphs, and recognized rules; **6** §13.2 outcomes; **7** rule-derived severity and inference confidence; **8** supported prohibited edge blocks and unresolved dynamic dependency withholds; **9** architecture/gate binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** partial resolution/framework coverage withholds, local early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** architecture oracle protected; **14** `ARP-004` capabilities; **15** inferred boundaries and hidden dynamic edges preserved as risks/conflict; **16** successor dependency/entry re-evaluation; **17** exact architecture-authority exception only; **18** retain constraints, graphs, inference, raw output, findings, exceptions, evaluation, and history. |
| `RGT-005` | **1** `JAN-CSAA-004-RGT-005@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect an exact dependency-integrity transition; **3** exact subject, dependency population/rules, resolver contexts, and `ARP-005` applicability; **4** dependency/cycle gate claim; **5** exact `ARP-005` result and resolution evidence; **6** §13.2 outcomes; **7** rule-derived severity/confidence; **8** prohibited edge/cycle blocks and unresolved resolution withholds; **9** dependency/gate binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** partial/mixed resolution withholds, local early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** dependency oracle protected; **14** `ARP-005` capabilities; **15** lexical-only and hidden runtime edges preserved; **16** successor resolution/cycle re-evaluation; **17** exact edge/cycle exception only; **18** retain manifests, resolution, graphs, raw output, findings, exceptions, evaluation, and history. |
| `RGT-008` | **1** `JAN-CSAA-004-RGT-008@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect a behavior-preservation transition; **3** exact before/after subjects, governed behavior oracle, evidence coordinates, and `ARP-008` applicability; **4** behavior-preservation gate claim; **5** exact `ARP-008` result, tests, coverage, traces, mutation and oracle evidence; **6** §13.2 outcomes; **7** behavior-derived severity and evidence confidence; **8** supported regression blocks and evidence incompatibility/gap withholds; **9** behavior/gate binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** failed or incompatible evidence withholds, local early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** behavior oracle protected; **14** `ARP-008` capabilities; **15** selection, workload, coverage and mapping blind spots preserved; **16** successor affected-behavior re-evaluation; **17** exact behavior-authority exception only; **18** retain oracle, tests, coverage, traces, raw output, findings, exceptions, evaluation, and history. |
| `RGT-009` | **1** `JAN-CSAA-004-RGT-009@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect a transition requiring exact test adequacy; **3** exact changed-risk population and `ARP-009` applicability; **4** test-adequacy gate claim; **5** exact `ARP-009` result, obligation, selection, coverage, mutation, assertion, isolation and mocking evidence; **6** §13.2 outcomes; **7** risk-derived severity/confidence; **8** supported inadequacy blocks; a missing or unresolved required dimension withholds; **9** test-oracle/gate binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** unavailable required evidence withholds, local early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** adequacy oracle protected; **14** `ARP-009` capabilities; **15** coverage-only, surviving mutants, non-failing assertions, mocking and order risks preserved; **16** successor tests and re-evaluation; **17** exact risk exception only, no silent floor change; **18** retain all test evidence, raw output, findings, exceptions, evaluation, and history. |
| `RGT-010` | **1** `JAN-CSAA-004-RGT-010@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect a transition subject to exact security/taint rules; **3** exact subject, security rules, trust boundaries and `ARP-010` applicability; **4** security gate claim; **5** exact `ARP-010` result, rule and path evidence; **6** §13.2 outcomes; **7** security-rule severity and bounded confidence; **8** a supported owner-defined security-rule violation blocks and incomplete security coverage withholds; **9** security/gate binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** unsupported/malformed/partial analysis withholds, local early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** security oracle protected; **14** `ARP-010` capabilities; **15** model blind spots and disagreement preserved; **16** successor security re-evaluation; **17** exact security-authority exception respecting non-waivability; **18** retain rules, paths, raw output, coverage, conflicts, findings, exceptions, evaluation, and history. |
| `RGT-011` | **1** `JAN-CSAA-004-RGT-011@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect a dependency transition subject to supply-chain policy; **3** exact subject, components, feeds/cutoff, policies and `ARP-011` applicability; **4** supply-chain gate claim; **5** exact `ARP-011` result, manifest/lock/component/feed/policy evidence; **6** §13.2 outcomes; **7** policy/advisory severity and match confidence; **8** prohibited exposure blocks and stale/unavailable/conflicting required feed withholds; **9** security/legal/license/gate binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** unresolved components/feeds withhold, local early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** policy/feed oracle protected; **14** `ARP-011` capabilities; **15** alias, transitive, stale-feed and advisory-conflict risks preserved; **16** successor lock/manifest/feed re-evaluation; **17** exact owning-authority exception only; **18** retain component/feed/policy data, raw output, findings, exceptions, evaluation, and history. |
| `RGT-012` | **1** `JAN-CSAA-004-RGT-012@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect a transition subject to exact unsafe-I/O rules; **3** exact subject, trust boundaries and `ARP-012` applicability; **4** unsafe-input/output gate claim; **5** exact `ARP-012` result and taint/path evidence; **6** §13.2 outcomes; **7** security-rule severity and path confidence; **8** supported unsafe path blocks and unsupported boundary withholds; **9** security/gate binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** partial/unsupported taint analysis withholds, local early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** trust-boundary oracle protected; **14** `ARP-012` capabilities; **15** hidden entry, sanitizer, native and framework blind spots preserved; **16** successor path re-evaluation; **17** exact security exception respecting non-waivability; **18** retain boundaries, paths, raw output, coverage, findings, exceptions, evaluation, and history. |
| `RGT-016` | **1** `JAN-CSAA-004-RGT-016@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect a changed-module quality transition; **3** exact before/after subject, metric/threshold oracle, changed population and `ARP-016` applicability; **4** maintainability/complexity gate claim; **5** exact `ARP-016` result and metric evidence; **6** §13.2 outcomes; **7** threshold-derived severity and metric confidence; **8** supported threshold violation blocks and incompatible measurements withhold; **9** quality/gate binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** coverage/metric mismatch withholds, local early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** threshold oracle protected; **14** `ARP-016` capabilities; **15** averaging, generated dilution and metric gaming preserved; **16** successor changed-module re-evaluation; **17** exact scoped expiring exception only; **18** retain subjects, metrics, thresholds, raw output, findings, exceptions, evaluation, and history. |
| `RGT-017` | **1** `JAN-CSAA-004-RGT-017@0.1.0 / Draft / UNDESIGNATED_TEMPLATE / NOT_A_PROFILE`, no predecessor; **2** protect every positive analysis-based gate from stale or incomplete semantic index; **3** exact subject, index snapshot, dependent capability population and `ARP-017` applicability; **4** semantic-index freshness/completeness meta-gate claim; **5** exact `ARP-017` result, invalidation closure, health and publication evidence; **6** §13.2 outcomes; **7** meta-gate criterion severity remains separate from confidence and from prospective blocking effect; **8** missing identity/coverage/health/invalidation/publication evidence withholds dependent gates; **9** semantic-index/gate binding authority `UNRESOLVED_BY_DESIGNATION`; **10** definitive carrier `UNRESOLVED_BY_DESIGNATION`; **11** last-known-good, partial publication, missing edge or provider failure withholds, local early feedback; **12** interim carrier `UNRESOLVED_BY_DESIGNATION`; **13** freshness oracle independent from index implementation; **14** all capabilities required by dependent gate; **15** cache contamination, mixed revision and missing dependencies preserved; **16** clean successor analysis/recovery and re-evaluation; **17** evidence-gap exception prohibited by default; **18** retain subject, dependency closure, health, publication, raw output, findings, exceptions, evaluation, and history. |

---

## 13. Repository Gate Evaluation

### 13.1 Required content

Every Repository Gate Evaluation SHALL preserve:

- immutable evaluation identity;
- exact repository, revision/tree, working-change, configuration, and scope;
- exact Gate Profile identity/version/content identity;
- exact component Rule Profile versions;
- Rule Application Results;
- exact inputs, admitted technical evidence, findings, and raw-result references;
- capability coverage, execution health, freshness, unsupported regions, and conflicts;
- every effective, expired, invalid, rejected, or inapplicable exception;
- advisory findings;
- execution and record time;
- aggregate result and derivation;
- currentness and invalidation boundary; and
- append-only predecessor/supersession history.

A subject, profile, component-rule, capability, provider, or required-input mismatch invalidates the evaluation.

### 13.2 Gate-result semantics

A gate preserves at least:

| Result meaning | Required interpretation |
| --- | --- |
| Satisfied without exception | A nonempty applicable blocking population exists; every blocking criterion is supported under current, complete, healthy, non-conflicting evidence; and every contributing qualification is exact, current, effective, and non-conflicting |
| Permitted with effective exception | One or more known underlying violations or exact exception-eligible evidence deficiencies remain visible; a distinct exact effective exception from the recognized concern-owning authority covers every such remaining violation or deficiency; every other applicable blocking criterion is supported; no required unresolved state remains uncovered; and every contributing qualification remains exact, current, effective, and non-conflicting |
| Blocked | One or more unexcepted blocking violations apply |
| Withheld | Applicability is unresolved; a required component is inconclusive, stale, unsupported, conflicting, not analyzed, failed, timed out, cancelled, malformed, or partial without an exact effective higher concern-owner exception covering that non-qualification evidence deficiency; the effective `JAN-CSAA-011` qualification covering the exact provider, adapter, capability profile, method, rule set, model, database or feed, configuration, their exact versions, and the exact oracle and conformance basis is missing, stale, expired, mismatched, partial, or conflicting; or the profile is not wholly not-applicable but no nonempty applicable blocking population exists |
| Not applicable | A nonempty exact component population exists and every component's applicability is supported false under that population |

Exact enum spelling is deferred. `Permitted with effective exception` SHALL NOT render as an unqualified green result. Advisory findings remain visible when a transition is permitted.

Aggregation SHALL be evaluated in this order: missing, stale, expired, partial, mismatched, or conflicting required provider qualification yields non-exceptable `Withheld`; any unexcepted blocking violation yields `Blocked`; any required unresolved state not covered by its own exact effective permitted exception yields `Withheld`; a profile that is not wholly not-applicable but lacks a nonempty applicable blocking population yields `Withheld`; only after those checks, one or more exact effective exceptions that collectively cover every remaining eligible violation or non-qualification evidence deficiency, with every other applicable blocking criterion supported, yield `Permitted with effective exception` while preserving every violation or deficiency visibly; complete supported satisfaction yields `Satisfied without exception`; and a nonempty exact component population with wholly supported-false applicability yields `Not applicable`. A numeric ordering SHALL NOT replace these predicates. Majority vote, average confidence, or provider count SHALL NOT override a blocking violation, conflict, or evidence gap.

### 13.3 Re-evaluation

Every material subject, profile, criterion, capability, provider, configuration, evidence, exception, or oracle change invalidates affected evaluation currency. Re-evaluation creates a successor and preserves the predecessor.

---

## 14. Authority, non-bypassability, and oracle protection

The following roles SHALL remain distinguishable:

1. change author;
2. profile or oracle author;
3. analyzer provider;
4. execution and normalization operator;
5. technical finding-disposition authority;
6. Engineering Exception authority;
7. enforcement carrier;
8. canonical assurance service and authority; and
9. final corpus decision authority.

A profile SHALL identify its content owner but SHALL NOT confer or appoint its own binding authority or carrier. A provider MAY report or recommend; it SHALL NOT approve, dispose, suppress, waive, except, or alter the authority of its output.

The identity authoring a change SHALL NOT weaken, remove, or rewrite a pre-existing rule, criterion, gate configuration, or oracle judgment in that same change merely to obtain a passing result. A suspected-wrong oracle creates a divergence and separate review; it is not edited inline.

A change author SHALL NOT self-authorize an exception. A gate executor SHALL NOT confer authority on its evaluation.

An IDE result, local hook, pre-commit run, or developer-run command is early feedback. It is never the binding guarantee. The definitive carrier SHALL operate at a boundary the affected author cannot bypass.

Automated enforcement is permitted when it applies a separately authorized immutable profile at a non-bypassable boundary. It does not require a new human approval for every run.

Gate enforcement permits, blocks, or withholds its named technical transition. It SHALL NOT create a canonical approval, waiver, risk acceptance, Baseline, or professional Decision.

---

## 15. Analyzer Provider Declaration

Every Analyzer Provider Declaration SHALL state:

- stable provider, adapter, and declaration identity/version;
- implemented `JAN-CSAA-003` capability IDs and versions;
- supported languages, compiler versions, project modes, frameworks, and constructs;
- explicit unsupported constructs, contexts, and known blind spots;
- required inputs, preconditions, environment, and configuration identity;
- output classes, raw-result availability, transformations, and retention limitations;
- provider engine, rule-set, model, database, advisory feed, and configuration versions;
- soundness/completeness objective and declared meaning of complete;
- partial, unsupported, failure, crash, cancellation, timeout, and malformed-output signals;
- determinism, seed, concurrency, cache, and reproducibility limits;
- incremental-analysis and invalidation behavior;
- CPU, memory, storage, time, and result-size behavior;
- filesystem, process, network, secret, data-egress, sandbox, and hostile-repository constraints;
- licensing and redistribution constraints;
- normalization, location, severity, confidence, deduplication, and semantic-loss mappings;
- raw-to-normalized traceability;
- health and self-diagnostic signals;
- known disagreement behavior and substitution limitations; and
- `JAN-CSAA-011` qualification-reference slot.

A declaration is a provider claim. It SHALL NOT be represented as qualification evidence. Two providers that declare the same capability labels SHALL NOT inherit one another's qualification.

Analysis used for a gate SHALL be read-only. Any provider remediation or source-writing mode is a separate tool action requiring separate authority and SHALL NOT occur as an implicit analysis side effect.

Provider severity and confidence are raw inputs. Profile interpretation SHALL remain independently versioned and inspectable.

---

## 16. Assurance-area allocation

### 16.1 Composite implementation readiness

`ARP-001` composes exact component profiles for a declared obligation population. It SHALL use the strictest unresolved result, preserve every advisory and exception, and refuse to claim implementation correctness outside that population.

`RGT-001` is inert design content. Only a future separately designated and instantiated RGP may protect a composite-readiness transition, and only after exact authority and carrier are bound.

### 16.2 Syntax and type correctness

`ARP-002` requires exact compiler version, configuration, project-reference closure, generated context, included/excluded populations, and diagnostic health. Unsupported projects or failed generation withhold support.

`RGT-002` is inert design content. A future separately designated RGP may protect a technical integration transition; it SHALL NOT imply behavioral correctness.

### 16.3 Contract conformance

`ARP-003` requires an exact recognized contract owner, contract/reference-artifact version, subject mapping, and compatibility criterion. Shape similarity alone is insufficient.

`RGT-003` is inert design content. A future separately designated RGP may protect changes to an enforced contract surface; it cannot invent contract authority.

### 16.4 Architecture-boundary conformance

`ARP-004` maps exact recognized architecture constraints to declared dependency and entry-point capabilities. Dynamic or unresolved dependencies remain visible.

`RGT-004` is inert design content. A future separately designated RGP may block exact prohibited edges under adequate coverage; it cannot infer architecture from provider clustering and then treat the inference as authority.

### 16.5 Dependency integrity and cycles

`ARP-005` distinguishes declared, resolved, imported, runtime-inferred, and runtime-observed dependencies. It states cycle population and resolver completeness.

`RGT-005` is inert design content. A future separately designated RGP may protect an exact dependency-boundary transition; unresolved module resolution would withhold a clean result.

### 16.6 Dead or unreachable code

`ARP-006` is Rule only. A finding is a reachability candidate under a declared entry universe. All applicable dynamic-entry mechanisms and unresolved regions are recorded.

No baseline dead-code gate exists. Any future gate requires separately reviewed proof that the relevant entry universe is complete.

### 16.7 Coupling and change amplification

`ARP-007` is Rule only. It binds compatible before/after subjects, exact metric definitions, coverage, impact closure, and confidence limits. Generic metric movement is not automatically an architecture violation.

### 16.8 Behavioral preservation

`ARP-008` requires an exact governed behavior or contract oracle, compatible before/after subjects, test selection, coverage and mutation evidence where required, and explicit unresolved behavior.

`RGT-008` is inert design content. Any future separately designated RGP derived from it SHALL NOT infer preservation from passing tests, coverage percentage, or empty semantic delta alone.

### 16.9 Test adequacy

`ARP-009` covers obligation and risk coverage, assertion strength, never-fails detection, differential mutation, isolation, order independence, excessive mocking, and changed-module treatment. Numeric floors come only from separately versioned recognized oracle content.

`RGT-009` is inert design content. A future separately designated RGP may protect a technical transition only when every required adequacy dimension has current evidence.

### 16.10 Security weakness and taint flow

`ARP-010` requires exact security-rule ownership, source/sink/sanitizer/propagation profiles, framework coverage, trust boundaries, and known blind spots.

`RGT-010` is inert design content. A future separately designated RGP may block supported owner-defined security-rule violations. Incomplete security modeling would withhold a clean result; it never produces a clean bill of security.

### 16.11 Third-party and supply-chain exposure

`ARP-011` binds manifest and lockfile scope, resolved component identity, integrity, provenance, exact advisory/feed identity and cutoff, vulnerability and license policy, and unknown/conflicting evidence.

`RGT-011` is inert design content. A future separately designated RGP would withhold on required stale or unavailable feeds unless an exact higher-authority policy states another treatment. It SHALL NOT convert missing advisories into safety.

### 16.12 Unsafe input/output handling

`ARP-012` binds exact trust boundaries, data-flow/taint capabilities, entry mechanisms, source/sink/sanitizer rules, and unsupported boundaries.

`RGT-012` is inert design content. A future separately designated RGP may block supported unsafe-flow violations; unsupported boundaries remain inconclusive.

### 16.13 Concurrency and asynchronous-control risk

`ARP-013` is Rule only. Generic warnings remain signals. Exact hard concurrency obligations route through contract, security, or behavioral profiles owned by the corresponding concern.

### 16.14 Error and recovery behavior

`ARP-014` is Rule only. Static patterns MAY identify risk candidates. They cannot establish restart, idempotency, retry, rollback, or recovery correctness without execution evidence and a governed behavior/contract oracle.

### 16.15 Observability sufficiency

`ARP-015` is Rule only. Static presence of logs, metrics, or traces is not proof of reconstructability. Runtime evidence and explicit observability obligations are required for stronger claims.

### 16.16 Maintainability and complexity

`ARP-016` binds exact metrics, changed-module population, thresholds, exclusions, generated-code treatment, trend/comparison compatibility, and exception rules.

`RGT-016` is inert design content. A future separately designated RGP may protect technical integration when a recognized threshold oracle is bound. Repository-wide averages SHALL NOT dilute changed-module violations.

### 16.17 Semantic-index freshness and completeness

`ARP-017` evaluates exact subject identity, invalidation closure, capability coverage, provider health, publication atomicity evidence, and unresolved dependencies.

`RGT-017` is inert design content. A future separately designated RGP may serve as a meta-gate prerequisite for positive analysis-based gates. Missing invalidation edges, last-known-good data, or an apparently empty result SHALL NOT establish freshness or completeness.

---

## 17. Canonical assurance mapping boundary

Technical findings and gate evaluations MAY become inputs to canonical assurance only through a governed mapping that:

- names the canonical Assurance Policy and exact version;
- identifies admissible technical evidence and limitations;
- preserves raw and normalized provenance;
- independently evaluates applicability and criteria;
- applies required independence;
- produces a canonical Assessment or Assurance Observation through the canonical service;
- preserves conflicts and contrary findings; and
- obtains any required canonical Decision from its authorized actor.

A repository gate SHALL NOT write canonical assurance state directly. A canonical mapping SHALL NOT treat a technical gate pass as an Assessment, approval, waiver, or Baseline.

---

## 18. Failure, disagreement, and degraded operation

The protected-transition effects below are conservative defaults applied before any exact effective Engineering Exception permitted by §§11.5 and 13.2. An eligible non-qualification evidence deficiency may follow that higher concern-owner exception path while remaining visible and non-supporting; every provider-qualification defect remains non-exceptable and withheld.

| Condition | Technical treatment | Protected-transition effect |
| --- | --- | --- |
| Provider unavailable, crash, timeout, cancellation | Execution-health failure; no subject violation inferred | Withhold when required |
| Malformed or provenance-incompatible output | Quarantine/diagnostic raw material; semantically inert | Withhold when required |
| Unsupported construct or missing capability | Unsupported coverage remains explicit | Withhold any claim depending on it |
| Partial analysis or resource exhaustion | Publish only bounded partial result with consequences | Withhold broader result |
| Stale subject, profile, provider, configuration, or evidence | Invalidate affected currentness | Withhold |
| Conflicting providers or evidence | Preserve conflict; no averaging or majority vote | Withhold unless profile explicitly resolves through evidence |
| Unknown applicability | Not not-applicable | Withhold |
| Invalid, expired, revoked, or out-of-scope exception | No permission effect | Underlying violation controls |
| Suppressed finding | Finding remains in evaluation and coverage | No permission effect |
| Missing/bypassable carrier | Profile is unbound or interim | No binding enforcement claim |
| Provider substitution | New qualification and affected reanalysis required | Withhold until satisfied |

No failed, timed-out, unsupported, stale, conflicting, partial, not-analyzed, or bypassable condition may be rendered as green.

---

## 19. Cross-document handoff

```text
JAN-CSAA-003 capability, query, reachability, and impact semantics
    → JAN-CSAA-004 rule, finding, exception, provider, and gate semantics
    → JAN-CSAA-006 independently governed scenario judgments
    → JAN-CSAA-007 exact machine contracts
    → JAN-CSAA-008 executable conformance and no-false-green evidence
    → JAN-CSAA-010 employment-point binding
    → JAN-CSAA-011 provider qualification and operation
```

`JAN-CSAA-006` SHALL include positive, negative, inconclusive, partial, stale, disagreement, provider-failure, exception, suppression, non-bypass, and zero-static-callers judgments for this document's profiles.

`JAN-CSAA-007` SHALL encode, without semantic loss, rule application, finding, disposition, remediation, suppression, exception, gate profile, gate evaluation, provider declaration, and failure meanings.

`JAN-CSAA-008` SHALL verify aggregation, lifecycle, no-self-approval, exception preservation, mutation resistance, provider substitution, non-bypassability, and no-false-green behavior.

`JAN-CSAA-010` may bind exact profile versions to employment points but SHALL NOT reinterpret a result or suppress a finding.

`JAN-CSAA-011` SHALL qualify concrete providers against `JAN-CSAA-003` capabilities, this provider contract, independently reviewed oracles, and executable conformance.

---

## 20. Normative requirement catalog

Requirement identifiers are permanent within `JAN-CSAA-004`. A retired requirement remains historical and its identifier SHALL NOT be reused.

### 20.1 Governance, ownership, authority, and non-goals

| ID | Requirement |
| --- | --- |
| `CSAA-004-GOV-001` | The document SHALL retain permanent ID, title, exact version, lifecycle status, and settledness. |
| `CSAA-004-GOV-002` | Draft status SHALL remain non-authoritative until exact-member conferral. |
| `CSAA-004-GOV-003` | The document SHALL bind exact adopted `JAN-CSAA-000` authority. |
| `CSAA-004-GOV-004` | The document SHALL bind exact provisional `JAN-CSAA-001`, `002`, and `003` inputs. |
| `CSAA-004-GOV-005` | Documentation-only Wave 2 entry SHALL trace to the readiness record and `REG-D-021`/`022`. |
| `CSAA-004-GOV-006` | Profile authorship SHALL NOT bind a rule, gate, authority, carrier, or provider. |
| `CSAA-004-GOV-007` | The candidate concern SHALL own technical rule, finding, exception, provider-declaration, gate-profile, and gate-evaluation meaning only. |
| `CSAA-004-GOV-008` | Code-semantic objects and analysis algorithms SHALL remain owned by `JAN-CSAA-002` and `003`. |
| `CSAA-004-GOV-009` | Current repository facts SHALL remain owned by `JAN-CSAA-005`. |
| `CSAA-004-GOV-010` | Fixture and oracle judgments SHALL remain owned by `JAN-CSAA-006`. |
| `CSAA-004-GOV-011` | Exact schemas, fields, enums, adapters, and APIs SHALL remain owned by `JAN-CSAA-007`. |
| `CSAA-004-GOV-012` | Executable conformance SHALL remain owned by `JAN-CSAA-008`. |
| `CSAA-004-GOV-013` | Persistence and operations SHALL remain owned by `JAN-CSAA-009`. |
| `CSAA-004-GOV-014` | Coding-agent employment SHALL remain owned by `JAN-CSAA-010`. |
| `CSAA-004-GOV-015` | Concrete provider qualification and selection SHALL remain owned by `JAN-CSAA-011`. |
| `CSAA-004-GOV-016` | Canonical Assurance Policy, Assessment, Assurance Observation, Decision, waiver, and Baseline meanings SHALL remain owned by canon. |
| `CSAA-004-GOV-017` | Concern conflicts SHALL be routed to the owner without silent local resolution. |
| `CSAA-004-GOV-018` | This Draft SHALL NOT select a provider, CI system, branch rule, carrier, topology, or threshold. |
| `CSAA-004-GOV-019` | This Draft SHALL NOT report an executed or effective gate. |
| `CSAA-004-GOV-020` | This Draft SHALL NOT authorize source, configuration, dependency, test, fixture, oracle, schema, or gate mutation. |
| `CSAA-004-GOV-021` | Repository observations SHALL remain dated evidence and SHALL NOT become adopted profiles. |
| `CSAA-004-GOV-022` | Final corpus freeze SHALL require one consolidated implementation-subject refresh. |
| `CSAA-004-GOV-023` | Author, adversarial reviewer, integrity validator, decision authority, and recorder SHALL remain distinct for the same judgment surface. |
| `CSAA-004-GOV-024` | Profile/oracle author, provider, executor, disposition authority, exception authority, and carrier SHALL remain distinguishable. |
| `CSAA-004-GOV-025` | Post-freeze byte changes SHALL trigger affected re-review except exact pre-frozen non-semantic substitutions. |
| `CSAA-004-GOV-026` | Every mandatory local predicate SHALL receive one permanent requirement identifier. |
| `CSAA-004-GOV-027` | Every local and applicable inherited requirement SHALL receive one ledger binding. |
| `CSAA-004-GOV-028` | No requirement SHALL pass without reproducible method-bound evidence. |
| `CSAA-004-GOV-029` | Examples SHALL NOT acquire repository-shape or authority standing. |
| `CSAA-004-GOV-030` | Exact final conferral SHALL remain distinct from technical gate enforcement. |
| `CSAA-004-GOV-031` | The compact `CAP-nnn` shorthand SHALL NOT survive into an external machine contract or provider declaration. |

### 20.2 Epistemic states and non-equivalences

| ID | Requirement |
| --- | --- |
| `CSAA-004-EPI-001` | Rule-profile existence SHALL remain distinct from rule assignment. |
| `CSAA-004-EPI-002` | Rule assignment SHALL remain distinct from capability availability. |
| `CSAA-004-EPI-003` | Capability availability SHALL remain distinct from analysis execution. |
| `CSAA-004-EPI-004` | Analysis execution SHALL remain distinct from current complete evidence. |
| `CSAA-004-EPI-005` | Zero findings SHALL NOT imply rule satisfaction. |
| `CSAA-004-EPI-006` | Provider failure SHALL NOT imply subject violation. |
| `CSAA-004-EPI-007` | Provider severity SHALL remain distinct from profile severity. |
| `CSAA-004-EPI-008` | Provider confidence SHALL remain distinct from profile confidence interpretation. |
| `CSAA-004-EPI-009` | Suppression SHALL remain distinct from exception. |
| `CSAA-004-EPI-010` | Exception SHALL remain distinct from rule satisfaction. |
| `CSAA-004-EPI-011` | Engineering Exception SHALL remain distinct from canonical waiver. |
| `CSAA-004-EPI-012` | Local or pre-commit pass SHALL remain distinct from a binding gate. |
| `CSAA-004-EPI-013` | Gate evaluation SHALL remain distinct from approval, Decision, or Baseline. |
| `CSAA-004-EPI-014` | Provider recommendation SHALL remain distinct from disposition. |
| `CSAA-004-EPI-015` | A source change SHALL remain distinct from finding resolution. |
| `CSAA-004-EPI-016` | Zero observed static callers SHALL remain distinct from dead code and safe removal. |
| `CSAA-004-EPI-017` | Applicability SHALL preserve applicable, not-applicable, and unresolved meanings. |
| `CSAA-004-EPI-018` | Unknown applicability SHALL NOT become not applicable. |
| `CSAA-004-EPI-019` | Execution health SHALL preserve complete, partial, not-analyzed, failed, timed-out, cancelled, unavailable, and malformed meanings. |
| `CSAA-004-EPI-020` | Evidence state SHALL preserve freshness, capability support, and coverage completeness as independent dimensions. |
| `CSAA-004-EPI-021` | Epistemic conclusion SHALL preserve supported, violated, and inconclusive meanings. |
| `CSAA-004-EPI-022` | Agreement SHALL preserve consistent and conflicting meanings. |
| `CSAA-004-EPI-023` | Exact machine encoding SHALL preserve every material cross-product of the five dimensions. |
| `CSAA-004-EPI-024` | A supported satisfaction conclusion SHALL require exact subject identity. |
| `CSAA-004-EPI-025` | A supported satisfaction conclusion SHALL require resolved applicability. |
| `CSAA-004-EPI-026` | A supported satisfaction conclusion SHALL require every required capability. |
| `CSAA-004-EPI-027` | A supported satisfaction conclusion SHALL require coverage adequate for the claim. |
| `CSAA-004-EPI-028` | A supported satisfaction conclusion SHALL require healthy complete execution. |
| `CSAA-004-EPI-029` | A supported satisfaction conclusion SHALL require current evidence. |
| `CSAA-004-EPI-030` | A supported satisfaction conclusion SHALL require no unresolved conflict. |
| `CSAA-004-EPI-031` | A supported satisfaction conclusion SHALL require positive criterion evidence. |
| `CSAA-004-EPI-032` | Unsupported, stale, failed, timed-out, partial, not-analyzed, or conflicting evidence SHALL NOT become green. |
| `CSAA-004-EPI-033` | Provider failure SHALL result in incomplete evaluation rather than counterfeit subject defect. |
| `CSAA-004-EPI-034` | Protected transitions SHALL be withheld when required evidence is inconclusive or unavailable. |
| `CSAA-004-EPI-035` | Withholding a transition SHALL NOT be represented as a finding that the subject violated the rule. |
| `CSAA-004-EPI-036` | Exact outcome spelling SHALL remain deferred while semantic distinctions remain mandatory. |

### 20.3 Analysis Rule Profile contract

| ID | Requirement |
| --- | --- |
| `CSAA-004-RUL-001` | Every Analysis Rule Profile SHALL have a permanent stable identity. |
| `CSAA-004-RUL-002` | Every rule profile SHALL carry exact semantic version, content identity, lifecycle, predecessor, and successor. |
| `CSAA-004-RUL-003` | Every rule profile SHALL state its purpose and protected engineering question. |
| `CSAA-004-RUL-004` | Every rule profile SHALL identify its recognized external concern owner. |
| `CSAA-004-RUL-005` | Every rule profile SHALL bind exact subject and revision applicability. |
| `CSAA-004-RUL-006` | Every rule profile SHALL state scope, configuration, generated regions, exclusions, and dirty-worktree treatment. |
| `CSAA-004-RUL-007` | Every rule profile SHALL define an explicit applicability predicate. |
| `CSAA-004-RUL-008` | Every rule profile SHALL state exact technical claim and polarity. |
| `CSAA-004-RUL-009` | Every Analysis Rule Profile SHALL select exactly one claim character from `HARD_INVARIANT`, `OWNER_DEFINED_RULE`, `HEURISTIC_SMELL`, or `METRIC_ADVISORY`; compound or conditional claim characters are prohibited. |
| `CSAA-004-RUL-010` | Every rule profile SHALL name eligible `JAN-CSAA-003` capability profiles. |
| `CSAA-004-RUL-011` | Every rule profile SHALL state required semantic facts, queries, and execution evidence. |
| `CSAA-004-RUL-012` | Every rule profile SHALL state required coverage, freshness, provenance, and permitted corroboration. |
| `CSAA-004-RUL-013` | Every rule profile SHALL define satisfaction criteria. |
| `CSAA-004-RUL-014` | Every rule profile SHALL define violation criteria. |
| `CSAA-004-RUL-015` | Every rule profile SHALL define inconclusive criteria. |
| `CSAA-004-RUL-016` | Every rule profile SHALL define not-applicable criteria. |
| `CSAA-004-RUL-017` | Satisfaction SHALL NOT be inferred from absence of findings. |
| `CSAA-004-RUL-018` | Every rule profile SHALL define profile-derived severity. |
| `CSAA-004-RUL-019` | Every rule profile SHALL define confidence interpretation and basis. |
| `CSAA-004-RUL-020` | Severity, confidence, and blocking SHALL remain independent. |
| `CSAA-004-RUL-021` | Every rule profile SHALL record `RULE_ONLY` or exact inert RGT design provenance and SHALL NOT claim ARP-level gate eligibility or protected-boundary consequence. |
| `CSAA-004-RUL-022` | Every rule profile SHALL identify profile content owner separately from binding authority. |
| `CSAA-004-RUL-023` | Every Analysis Rule Profile SHALL record literal `N/A` plus rationale for definitive and interim transition carriers when no instantiated RGP or protected transition exists; a separately instantiated Repository Gate Profile SHALL instead identify its definitive carrier or explicit `UNBOUND` state. |
| `CSAA-004-RUL-024` | Every rule profile SHALL define local-run and interim-carrier treatment. |
| `CSAA-004-RUL-025` | Every rule profile SHALL define independence requirements. |
| `CSAA-004-RUL-026` | Every rule profile SHALL identify known false-positive classes. |
| `CSAA-004-RUL-027` | Every rule profile SHALL identify known false-negative classes. |
| `CSAA-004-RUL-028` | Every rule profile SHALL define provider-disagreement treatment. |
| `CSAA-004-RUL-029` | Provider disagreement SHALL NOT be resolved by majority vote or average confidence. |
| `CSAA-004-RUL-030` | Every rule profile SHALL define finding-creation rules. |
| `CSAA-004-RUL-031` | Every rule profile SHALL define deduplication and recurrence rules. |
| `CSAA-004-RUL-032` | Every rule profile SHALL define review and false-positive treatment. |
| `CSAA-004-RUL-033` | Every rule profile SHALL define remediation and successor-subject reanalysis. |
| `CSAA-004-RUL-034` | Every rule profile SHALL define suppression behavior. |
| `CSAA-004-RUL-035` | Every rule profile SHALL define exception eligibility and separate authority. |
| `CSAA-004-RUL-036` | Every rule profile SHALL preserve externally imposed non-waivability. |
| `CSAA-004-RUL-037` | Every rule profile SHALL define logical invalidation dependencies. |
| `CSAA-004-RUL-038` | Every rule profile SHALL define recurrence and historical-preservation semantics. |
| `CSAA-004-RUL-039` | Every rule profile SHALL bind independently owned fixture/oracle allocation. |
| `CSAA-004-RUL-040` | Every Analysis Rule Profile SHALL state `RULE_ONLY` or cite exact inert RGT design provenance; neither state instantiates, reserves, or designates a Repository Gate Profile. |
| `CSAA-004-RUL-041` | Every rule profile SHALL define raw, normalized, contradictory, evaluation, and supersession retention. |
| `CSAA-004-RUL-042` | A rule profile SHALL NOT invent architecture, contract, security, behavior, test-floor, license, or risk authority. |
| `CSAA-004-RUL-043` | A rule profile SHALL reference exact concern-owning artifacts for protected meaning. |
| `CSAA-004-RUL-044` | A rule profile SHALL NOT appoint its own binding authority or carrier. |
| `CSAA-004-RUL-045` | A rule profile SHALL remain semantic and SHALL NOT prescribe provider-specific shape. |
| `CSAA-004-RUL-046` | Every Analysis Rule Profile facet SHALL be populated or, when inapplicable, contain literal `N/A` plus rationale. |
| `CSAA-004-RUL-047` | `UNASSIGNED`, `UNKNOWN`, `PENDING`, and `N/A` SHALL remain distinct and SHALL NOT substitute for one another. |
| `CSAA-004-RUL-048` | Any semantic revision to an Analysis Rule Profile SHALL create a successor version. |

### 20.4 Rule Application Result

| ID | Requirement |
| --- | --- |
| `CSAA-004-RAR-001` | Every Rule Application Result SHALL have a permanent immutable result identity. |
| `CSAA-004-RAR-002` | Every Rule Application Result SHALL bind exact semantic version, immutable content identity, and lifecycle. |
| `CSAA-004-RAR-003` | Every Rule Application Result SHALL retain predecessor and successor relations without rewriting the accepted core. |
| `CSAA-004-RAR-004` | Every Rule Application Result SHALL bind exact producing Analysis Run and Analysis Invocation identities. |
| `CSAA-004-RAR-005` | Every Rule Application Result SHALL bind exact repository, revision/tree, reproducible working-change, configuration, and scope subject identity. |
| `CSAA-004-RAR-006` | Every Rule Application Result SHALL bind exact Analysis Rule Profile identity, version, and content identity. |
| `CSAA-004-RAR-007` | Every Rule Application Result SHALL bind the exact external concern-owning criterion or rule reference. |
| `CSAA-004-RAR-008` | Every Rule Application Result SHALL bind every contributing `JAN-CSAA-003` capability profile identity and version. |
| `CSAA-004-RAR-009` | Every Rule Application Result SHALL bind exact providers, adapters, engines, rule sets, and configurations. |
| `CSAA-004-RAR-010` | A Rule Application Result contributing to a positive gate SHALL bind the effective `JAN-CSAA-011` qualification for its exact provider, adapter, capability profile, method, rule set, model, database or feed, configuration, and their exact versions, plus its exact `JAN-CSAA-006` oracle allocation and `JAN-CSAA-008` conformance evidence. |
| `CSAA-004-RAR-011` | Every Rule Application Result SHALL retain raw provider results or auditable content-addressed references. |
| `CSAA-004-RAR-012` | Every Rule Application Result SHALL retain normalized facts and technical evidence. |
| `CSAA-004-RAR-013` | Every Rule Application Result SHALL retain raw-to-normalized transformation and validation lineage. |
| `CSAA-004-RAR-014` | Every Rule Application Result SHALL retain applicability result and rationale. |
| `CSAA-004-RAR-015` | Every Rule Application Result SHALL retain execution-health state and every distinct failure cause. |
| `CSAA-004-RAR-016` | Every Rule Application Result SHALL retain evidence currency, freshness, coverage basis, population, denominator, and closure state. |
| `CSAA-004-RAR-017` | Every Rule Application Result SHALL retain its exact epistemic conclusion without coercing unknown or inconclusive material. |
| `CSAA-004-RAR-018` | Every Rule Application Result SHALL retain disagreement, contradiction, and competing-provider evidence. |
| `CSAA-004-RAR-019` | Every Rule Application Result SHALL retain unsupported, excluded, failed, partial, redacted, and unresolved frontier regions. |
| `CSAA-004-RAR-020` | Every Rule Application Result SHALL retain logical invalidation dependencies and currentness boundary. |
| `CSAA-004-RAR-021` | Every Rule Application Result SHALL retain criterion-by-criterion results. |
| `CSAA-004-RAR-022` | Every Rule Application Result SHALL retain explanation and witness material sufficient to reproduce the conclusion. |
| `CSAA-004-RAR-023` | Every Rule Application Result SHALL state one bounded technical conclusion. |
| `CSAA-004-RAR-024` | Every Rule Application Result SHALL retain profile-derived severity separately from provider metadata. |
| `CSAA-004-RAR-025` | Every Rule Application Result SHALL retain blocking context separately from severity, confidence, and canonical authority. |
| `CSAA-004-RAR-026` | Every Rule Application Result and every resulting finding SHALL carry reciprocal exact identities. |
| `CSAA-004-RAR-027` | Every Rule Application Result SHALL retain observation time and record time. |
| `CSAA-004-RAR-028` | A subject, profile, criterion, capability, provider, qualification, configuration, evidence, or material-input mismatch SHALL invalidate current use and require a successor result. |
| `CSAA-004-RAR-029` | Malformed, failed, or invalid provider output MAY remain diagnostic raw material but SHALL NOT create an accepted Rule Application Result; correction SHALL create a successor rather than rewrite the accepted core. |
| `CSAA-004-RAR-030` | Exact Rule Application Result schema, field, enum, and carrier shapes SHALL remain deferred to `JAN-CSAA-007`. |

### 20.5 Analyzer Finding Record

| ID | Requirement |
| --- | --- |
| `CSAA-004-FND-001` | Every finding SHALL have a stable occurrence identity. |
| `CSAA-004-FND-002` | Every finding SHALL bind the exact producing Rule Application Result identity and content identity; recurrence lineage remains required by `CSAA-004-FND-030`. |
| `CSAA-004-FND-003` | Every finding SHALL bind exact repository subject and revision. |
| `CSAA-004-FND-004` | Every finding SHALL bind exact Rule Profile identity and version. |
| `CSAA-004-FND-005` | Every finding SHALL state the precise evaluated claim. |
| `CSAA-004-FND-006` | Every finding SHALL state exact semantic or source location where applicable. |
| `CSAA-004-FND-007` | Every finding SHALL state observed deficiency or unresolved condition. |
| `CSAA-004-FND-008` | Every finding SHALL state bounded technical implication. |
| `CSAA-004-FND-009` | Every finding SHALL retain exactly the producing profile's one selected claim character from `HARD_INVARIANT`, `OWNER_DEFINED_RULE`, `HEURISTIC_SMELL`, or `METRIC_ADVISORY`. |
| `CSAA-004-FND-010` | Every finding SHALL retain profile-derived severity. |
| `CSAA-004-FND-011` | Every finding SHALL retain blocking context separately from severity. |
| `CSAA-004-FND-012` | Raw provider severity SHALL remain separate metadata. |
| `CSAA-004-FND-013` | Raw provider confidence SHALL remain separate metadata. |
| `CSAA-004-FND-014` | Every finding SHALL reference supporting facts and technical evidence. |
| `CSAA-004-FND-015` | Every finding SHALL reference raw provider output or an auditable content-addressed reference. |
| `CSAA-004-FND-016` | Every finding SHALL bind provider invocation, engine, rule-set, adapter, and configuration versions. |
| `CSAA-004-FND-017` | Every finding SHALL retain normalization and transformation lineage. |
| `CSAA-004-FND-018` | Every finding SHALL retain capability coverage. |
| `CSAA-004-FND-019` | Every finding SHALL retain execution health. |
| `CSAA-004-FND-020` | Every finding SHALL retain freshness and invalidation state. |
| `CSAA-004-FND-021` | Every finding SHALL retain unsupported and excluded regions. |
| `CSAA-004-FND-022` | Every finding SHALL retain conflicting evidence and provider disagreement. |
| `CSAA-004-FND-023` | Every finding SHALL link applicable exception. |
| `CSAA-004-FND-024` | Every finding SHALL link applicable suppression treatment. |
| `CSAA-004-FND-025` | Every finding SHALL link review disposition. |
| `CSAA-004-FND-026` | Every finding SHALL link remediation and reanalysis records. |
| `CSAA-004-FND-027` | Every finding SHALL retain creation, invalidation, and supersession times. |
| `CSAA-004-FND-028` | A finding's immutable observation core SHALL NOT be rewritten. |
| `CSAA-004-FND-029` | Correction SHALL create a successor finding record. |
| `CSAA-004-FND-030` | Recurrence SHALL create a new occurrence linked by lineage. |
| `CSAA-004-FND-031` | Deduplication SHALL link records without erasing them. |
| `CSAA-004-FND-032` | Malformed provider output SHALL NOT create an accepted finding. |
| `CSAA-004-FND-033` | A finding SHALL remain a technical observation record. |
| `CSAA-004-FND-034` | A finding SHALL NOT redefine canonical Assurance Observation. |
| `CSAA-004-FND-035` | Canonical assurance intake SHALL require explicit governed mapping. |
| `CSAA-004-FND-036` | Canonical assurance intake SHALL independently evaluate admissibility and criteria. |
| `CSAA-004-FND-037` | Later success SHALL NOT delete historical findings. |
| `CSAA-004-FND-038` | A finding SHALL retain enough explanation to reproduce its profile conclusion. |
| `CSAA-004-FND-039` | Authorization filtering SHALL NOT leak protected finding existence through metadata or counts. |
| `CSAA-004-FND-040` | Exact finding schema and enum spelling SHALL remain deferred to `JAN-CSAA-007`. |

### 20.6 Disposition, suppression, remediation, and exception

| ID | Requirement |
| --- | --- |
| `CSAA-004-DSP-001` | Review, remediation, freshness, exception, and suppression SHALL remain separate axes. |
| `CSAA-004-DSP-002` | Every treatment record SHALL carry the common identity, provenance, lifecycle, time, invalidation, and history contract. |
| `CSAA-004-DSP-003` | Every treatment record SHALL bind exact Analysis Rule Profile, subject, applicable criterion, and target identities; it SHALL bind exact finding and producing Rule Application Result identities when they exist, while an Engineering Exception for an eligible failed or not-analyzed prerequisite for which no accepted result and finding can exist SHALL instead bind the exact gate-prerequisite/evidence-deficiency coordinate, invocation or attempt, and protected transition. |
| `CSAA-004-DSP-004` | Every consequential treatment SHALL record actor, authority, authority evidence, effective time, and record time. |
| `CSAA-004-DSP-005` | Every treatment SHALL record cited evidence, rationale, assumptions, limitations, and conflicts. |
| `CSAA-004-DSP-006` | Correction, challenge, revocation, invalidation, and supersession SHALL be append-only. |
| `CSAA-004-DSP-007` | A Finding Disposition Record SHALL state exactly one review meaning. |
| `CSAA-004-DSP-008` | A false-positive disposition SHALL independently re-derive why applicability or criterion support failed. |
| `CSAA-004-DSP-009` | A duplicate disposition SHALL bind both occurrence identities and name the surviving record. |
| `CSAA-004-DSP-010` | A disputed disposition SHALL preserve every competing position and unresolved issue. |
| `CSAA-004-DSP-011` | A provider, affected change author, or producing invocation SHALL NOT self-dispose solely by declaration. |
| `CSAA-004-DSP-012` | A disposition SHALL change review treatment only and SHALL NOT rewrite the finding, Rule Application Result, criterion, or raw output. |
| `CSAA-004-DSP-013` | Every remediation proposal or performed change SHALL create an immutable Remediation Record. |
| `CSAA-004-DSP-014` | A performed change SHALL remain `CHANGED_PENDING_REANALYSIS`. |
| `CSAA-004-DSP-015` | Every reanalysis attempt SHALL create an immutable Reanalysis Record with exact run, invocation, successor subject, Analysis Rule Profile, provider, qualification, evidence, health, and outcome. |
| `CSAA-004-DSP-016` | Resolution SHALL require a compatible supported successor Rule Application Result and reciprocal predecessor links. |
| `CSAA-004-DSP-017` | Failed, partial, stale, conflicting, or inconclusive reanalysis SHALL NOT resolve a finding. |
| `CSAA-004-DSP-018` | Every suppression SHALL create an immutable Suppression Treatment Record with exact target, presentation or configuration carrier, scope, authority, rationale, effective time, expiry or review trigger, and history. |
| `CSAA-004-DSP-019` | Suppression SHALL remain visible in configuration identity and coverage accounting. |
| `CSAA-004-DSP-020` | Suppression SHALL NOT establish removal, satisfaction, exception, permission, or canonical disposition. |
| `CSAA-004-DSP-021` | Expired, revoked, invalid, stale, or mismatched suppression SHALL have no current presentation effect. |
| `CSAA-004-DSP-022` | Every Engineering Exception Record SHALL have identity and lifecycle independent of every target record. |
| `CSAA-004-DSP-023` | Every exception SHALL bind exact rule, criterion, subject and version, and protected transition; it SHALL bind exact finding and Rule Application Result identities when they exist, or otherwise the exact eligible failed or not-analyzed gate-prerequisite/evidence-deficiency coordinate plus invocation or attempt when no accepted result and finding can exist; absent RGP or transition fields SHALL use literal `N/A` with rationale. |
| `CSAA-004-DSP-024` | Every exception SHALL bind separate effective authority, authority evidence, rationale, and accepted residual technical risk. |
| `CSAA-004-DSP-025` | Every exception SHALL bind effective time, record time, expiry, review triggers, renewal, revocation, and supersession. |
| `CSAA-004-DSP-026` | Every exception SHALL bind conditions, compensating controls, downstream impact, and externally imposed non-waivability. |
| `CSAA-004-DSP-027` | An exception SHALL change permission only at its exact protected technical boundary. |
| `CSAA-004-DSP-028` | An exception SHALL NOT create support, erase a finding, change provider output, or revive invalid evidence. |
| `CSAA-004-DSP-029` | Provider-qualification gaps SHALL never be exceptable; another exact evidence gap SHALL be prohibited unless exact higher concern-owner authority expressly permits that gap, in which case the exception SHALL preserve the unresolved evidence visibly and SHALL NOT create support or revive invalid evidence. |
| `CSAA-004-DSP-030` | Every treatment record SHALL declare its logical invalidation dependencies and successor trigger. |
| `CSAA-004-DSP-031` | No technical disposition or exception SHALL be represented as a canonical waiver, Decision, Assessment, or Assurance Observation. |
| `CSAA-004-DSP-032` | Exact record shapes and enum spellings SHALL remain deferred to `JAN-CSAA-007`. |
| `CSAA-004-DSP-033` | Every inapplicable field of a Finding Disposition, Remediation, Reanalysis, Suppression Treatment, or Engineering Exception Record SHALL contain literal `N/A` plus rationale. |

### 20.7 Repository Gate Profile, Template, and Evaluation

| ID | Requirement |
| --- | --- |
| `CSAA-004-GAT-001` | Every Repository Gate Profile SHALL have a prior exact recognized binding-gate designation record and effective time, pass an identity-collision check, and receive a permanent identity, semantic version, content identity, and lifecycle distinct from every design template; an RGT suffix SHALL NOT reserve an RGP suffix. |
| `CSAA-004-GAT-002` | Every Gate Profile SHALL bind exact component Rule Profile versions. |
| `CSAA-004-GAT-003` | Every Gate Profile SHALL state one protected technical transition. |
| `CSAA-004-GAT-004` | Every Gate Profile SHALL state subject/revision applicability and exclusions. |
| `CSAA-004-GAT-005` | Every Gate Profile SHALL identify recognized binding authority or explicit unbound state. |
| `CSAA-004-GAT-006` | Every Gate Profile SHALL identify definitive non-bypassable carrier or explicit unbound state. |
| `CSAA-004-GAT-007` | Every interim carrier SHALL execute the same exact versioned profile. |
| `CSAA-004-GAT-008` | Every interim carrier SHALL retain a registered authority-transfer plan. |
| `CSAA-004-GAT-009` | Every Gate Profile SHALL state required evidence and capability coverage. |
| `CSAA-004-GAT-010` | Every Gate Profile SHALL state freshness, provider-health, independence, and effective `JAN-CSAA-011` qualification prerequisites for the exact provider, adapter, capability profile, method, rule set, model, database or feed, configuration, and their exact versions, plus the exact oracle and conformance basis, for any positive gate result. |
| `CSAA-004-GAT-011` | Every Gate Profile SHALL bind a nonempty closed blocking component population and a closed advisory component population and SHALL classify every component rule as blocking or advisory. |
| `CSAA-004-GAT-012` | Every Gate Profile SHALL define strictest-unresolved aggregation. |
| `CSAA-004-GAT-013` | Every Gate Profile SHALL define exception eligibility and authority. |
| `CSAA-004-GAT-014` | Every Gate Profile SHALL define local-run treatment. |
| `CSAA-004-GAT-015` | Every Gate Profile SHALL define failure, timeout, disagreement, and stale-input behavior. |
| `CSAA-004-GAT-016` | Every Gate Profile SHALL define re-evaluation triggers. |
| `CSAA-004-GAT-017` | Every Gate Profile SHALL define oracle-change procedure. |
| `CSAA-004-GAT-018` | Every Gate Profile SHALL define raw, normalized, evaluation, exception, and supersession retention. |
| `CSAA-004-GAT-019` | A Gate Profile SHALL reference criteria by exact Rule Profile identity/version rather than copying them into evaluations. |
| `CSAA-004-GAT-020` | Profile existence SHALL NOT be represented as enforcement. |
| `CSAA-004-GAT-021` | Binding enforcement SHALL require both recognized authority and a non-bypassable carrier. |
| `CSAA-004-GAT-022` | Missing authority or carrier SHALL produce unbound or interim state. |
| `CSAA-004-GAT-023` | Every Gate Evaluation SHALL have immutable identity. |
| `CSAA-004-GAT-024` | Every Gate Evaluation SHALL bind exact repository, revision/tree, working change, configuration, and scope. |
| `CSAA-004-GAT-025` | Every Gate Evaluation SHALL bind exact Gate Profile identity/version/content identity. |
| `CSAA-004-GAT-026` | Every Gate Evaluation SHALL bind exact Rule Profile versions. |
| `CSAA-004-GAT-027` | Every Gate Evaluation SHALL reference Rule Application Results. |
| `CSAA-004-GAT-028` | Every Gate Evaluation SHALL retain exact inputs, technical evidence, findings, and raw-result references. |
| `CSAA-004-GAT-029` | Every Gate Evaluation SHALL retain capability coverage, execution health, freshness, unsupported regions, and conflicts. |
| `CSAA-004-GAT-030` | Every Gate Evaluation SHALL retain every effective, expired, invalid, rejected, or inapplicable exception. |
| `CSAA-004-GAT-031` | Every Gate Evaluation SHALL retain advisory findings. |
| `CSAA-004-GAT-032` | Every Gate Evaluation SHALL retain execution and record time. |
| `CSAA-004-GAT-033` | Every Gate Evaluation SHALL retain aggregate result and derivation. |
| `CSAA-004-GAT-034` | Every Gate Evaluation SHALL retain currentness, invalidation, predecessor, and supersession state. |
| `CSAA-004-GAT-035` | Subject, profile, rule, capability, provider, or required-input mismatch SHALL invalidate the evaluation. |
| `CSAA-004-GAT-036` | Satisfied-without-exception SHALL require a nonempty applicable blocking population, every blocking criterion supported under current adequate evidence, and every contributing provider qualification exact, current, effective, and non-conflicting; only a bound profile and carrier may then permit the named transition. |
| `CSAA-004-GAT-037` | Permitted-with-effective-exception SHALL preserve every underlying violation or exact non-qualification evidence deficiency and every exact exception, SHALL require a distinct exact effective exception covering each remaining eligible violation or deficiency, every other applicable blocking criterion supported, no uncovered required unresolved state, and exact effective provider qualification; an exception may address an eligible subject violation or an exact evidence gap expressly permitted by higher concern-owner authority but cannot substitute for provider qualification or create technical support. Only a bound profile and carrier may permit the named transition with every exception visible. |
| `CSAA-004-GAT-038` | Unexcepted blocking violation SHALL block the protected transition. |
| `CSAA-004-GAT-039` | Inconclusive, stale, unsupported, conflicting, not-analyzed, failed, timed-out, cancelled, malformed, or partial required evidence SHALL withhold the transition unless an exact effective higher concern-owner exception covers that non-qualification evidence deficiency; missing, stale, expired, mismatched, partial, or conflicting required provider qualification SHALL always withhold. |
| `CSAA-004-GAT-040` | Not-applicable SHALL require a nonempty exact component population with every component's applicability supported false and SHALL contribute no blocking effect within the exact protected scope. |
| `CSAA-004-GAT-041` | Permitted-with-effective-exception SHALL NOT render as unqualified green. |
| `CSAA-004-GAT-042` | Advisory findings SHALL remain visible on a permitted transition. |
| `CSAA-004-GAT-043` | Aggregation SHALL evaluate, in order, missing or invalid required provider qualification as non-exceptable withheld, any unexcepted blocking violation as blocked, any required unresolved state not covered by its own exact effective permitted exception as withheld, a profile that is not wholly not-applicable but lacks a nonempty applicable blocking population as withheld, one or more exact effective exceptions collectively covering every remaining eligible violation or non-qualification evidence deficiency with every other applicable blocking criterion supported as permitted-with-effective-exception with all underlying states visible, complete supported satisfaction as satisfied-without-exception, and a nonempty exact component population with wholly supported-false applicability as not-applicable. |
| `CSAA-004-GAT-044` | Majority vote, average confidence, or provider count SHALL NOT override violation, conflict, or evidence gap. |
| `CSAA-004-GAT-045` | Material subject, profile, criterion, capability, provider, configuration, evidence, exception, or oracle change SHALL invalidate affected currency. |
| `CSAA-004-GAT-046` | Re-evaluation SHALL create a successor and preserve the predecessor. |
| `CSAA-004-GAT-047` | Gate enforcement SHALL permit, block, or withhold only its named technical transition. |
| `CSAA-004-GAT-048` | Gate enforcement SHALL NOT create canonical approval, waiver, risk acceptance, Decision, or Baseline. |
| `CSAA-004-GAT-049` | Exact Gate Profile and Evaluation shapes SHALL remain deferred to `JAN-CSAA-007`. |
| `CSAA-004-GAT-050` | Every prospective field in the exact set `RGT-001`–`RGT-005`, `RGT-008`–`RGT-012`, `RGT-016`, and `RGT-017` SHALL contain a reusable design invariant or literal `UNRESOLVED_BY_DESIGNATION`; every template SHALL remain `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE` and SHALL NOT be supplied to an evaluation or represented as a bound, executed, permitting, blocking, or withholding Repository Gate Profile. |
| `CSAA-004-GAT-051` | Every Repository Gate Profile facet SHALL be populated or, when inapplicable, contain literal `N/A` plus rationale. |

### 20.8 Analyzer-provider capability contract

| ID | Requirement |
| --- | --- |
| `CSAA-004-PRV-001` | Every provider declaration SHALL have stable provider, adapter, declaration identity, and version. |
| `CSAA-004-PRV-002` | Every provider declaration SHALL identify implemented `JAN-CSAA-003` capability IDs and versions. |
| `CSAA-004-PRV-003` | Every provider declaration SHALL state supported languages and compiler versions. |
| `CSAA-004-PRV-004` | Every provider declaration SHALL state supported project modes, frameworks, and constructs. |
| `CSAA-004-PRV-005` | Every provider declaration SHALL state unsupported constructs, contexts, and known blind spots. |
| `CSAA-004-PRV-006` | Every provider declaration SHALL state required inputs and preconditions. |
| `CSAA-004-PRV-007` | Every provider declaration SHALL bind environment and configuration identity. |
| `CSAA-004-PRV-008` | Every provider declaration SHALL state output classes. |
| `CSAA-004-PRV-009` | Every provider declaration SHALL state raw-result availability. |
| `CSAA-004-PRV-010` | Every provider declaration SHALL state transformation and raw-retention limits. |
| `CSAA-004-PRV-011` | Every provider declaration SHALL bind engine and rule-set versions. |
| `CSAA-004-PRV-012` | Every provider declaration SHALL bind model, database, or advisory-feed versions where applicable. |
| `CSAA-004-PRV-013` | Every provider declaration SHALL bind adapter and configuration versions. |
| `CSAA-004-PRV-014` | Every provider declaration SHALL state soundness objective. |
| `CSAA-004-PRV-015` | Every provider declaration SHALL state completeness objective and meaning of complete. |
| `CSAA-004-PRV-016` | Every provider declaration SHALL signal partial results distinctly. |
| `CSAA-004-PRV-017` | Every provider declaration SHALL signal unsupported coverage distinctly. |
| `CSAA-004-PRV-018` | Every provider declaration SHALL signal failure, crash, cancellation, timeout, and malformed output distinctly. |
| `CSAA-004-PRV-019` | Every provider declaration SHALL state determinism and seed behavior. |
| `CSAA-004-PRV-020` | Every provider declaration SHALL state concurrency, cache, and reproducibility limits. |
| `CSAA-004-PRV-021` | Every provider declaration SHALL state incremental-analysis behavior. |
| `CSAA-004-PRV-022` | Every provider declaration SHALL state invalidation behavior. |
| `CSAA-004-PRV-023` | Every provider declaration SHALL state CPU, memory, storage, time, and result-size behavior. |
| `CSAA-004-PRV-024` | Every provider declaration SHALL state filesystem and process permissions. |
| `CSAA-004-PRV-025` | Every provider declaration SHALL state network, secret, and data-egress behavior. |
| `CSAA-004-PRV-026` | Every provider declaration SHALL state sandbox and hostile-repository constraints. |
| `CSAA-004-PRV-027` | Every provider declaration SHALL state licensing and redistribution constraints. |
| `CSAA-004-PRV-028` | Every provider declaration SHALL state normalization mappings. |
| `CSAA-004-PRV-029` | Every provider declaration SHALL state source/generated location mappings. |
| `CSAA-004-PRV-030` | Every provider declaration SHALL state severity and confidence mappings. |
| `CSAA-004-PRV-031` | Every provider declaration SHALL state deduplication behavior. |
| `CSAA-004-PRV-032` | Every provider declaration SHALL disclose every material semantic loss. |
| `CSAA-004-PRV-033` | Every provider declaration SHALL preserve raw-to-normalized traceability. |
| `CSAA-004-PRV-034` | Every provider declaration SHALL state health and self-diagnostic signals. |
| `CSAA-004-PRV-035` | Every provider declaration SHALL state known disagreement behavior. |
| `CSAA-004-PRV-036` | Every provider declaration SHALL state provider-substitution limitations. |
| `CSAA-004-PRV-037` | Every provider declaration SHALL contain a `JAN-CSAA-011` qualification-reference slot. |
| `CSAA-004-PRV-038` | A provider declaration SHALL be represented as a claim rather than qualification evidence. |
| `CSAA-004-PRV-039` | Shared capability labels SHALL NOT transfer qualification between providers. |
| `CSAA-004-PRV-040` | Gate analysis SHALL use read-only provider mode. |
| `CSAA-004-PRV-041` | Remediation or source-writing mode SHALL be a separately authorized tool action. |
| `CSAA-004-PRV-042` | Provider remediation SHALL NOT occur as an implicit analysis side effect. |
| `CSAA-004-PRV-043` | Providers MAY report and recommend only. |
| `CSAA-004-PRV-044` | Providers SHALL NOT approve, dispose, suppress, waive, except, mutate, or confer authority. |
| `CSAA-004-PRV-045` | Concrete provider qualification, selection, configuration, licensing acceptance, and operation SHALL remain deferred to `JAN-CSAA-011`; until effective qualification exists, provider output may support labeled technical inspection only and SHALL NOT contribute to a positive gate result. |
| `CSAA-004-PRV-046` | Every effective `JAN-CSAA-011` qualification used by an application or evaluation SHALL include exact subject-language, compiler, project, framework-mode, security, licensing, conformance-basis, expiry, and substitution-lineage scope. |

### 20.9 Assurance-area allocations

| ID | Requirement |
| --- | --- |
| `CSAA-004-ARE-001` | `ARP-001` SHALL define composite readiness for an exact enumerated obligation population. |
| `CSAA-004-ARE-002` | Composite readiness SHALL be Rule plus non-instantiated `RGT-001` design content; only a separately designated future RGP may use strictest-unresolved aggregation at a protected transition. |
| `CSAA-004-ARE-003` | Composite readiness SHALL NOT claim arbitrary implementation correctness or hide advisory and exception state. |
| `CSAA-004-ARE-004` | `ARP-002` SHALL define syntax/type correctness with exact compiler, configuration, project, and generated-context coverage. |
| `CSAA-004-ARE-005` | Syntax/type correctness SHALL be Rule plus non-instantiated `RGT-002` design content, not an instantiated Gate Profile. |
| `CSAA-004-ARE-006` | Successful type checking SHALL NOT prove behavior. |
| `CSAA-004-ARE-007` | `ARP-003` SHALL define contract conformance against an exact recognized contract owner and version. |
| `CSAA-004-ARE-008` | Contract conformance SHALL be Rule plus non-instantiated `RGT-003` design content, not an instantiated Gate Profile. |
| `CSAA-004-ARE-009` | Shape or textual similarity SHALL NOT establish semantic contract compatibility. |
| `CSAA-004-ARE-010` | `ARP-004` SHALL define architecture-boundary conformance against recognized exact constraints. |
| `CSAA-004-ARE-011` | Architecture-boundary conformance SHALL be Rule plus non-instantiated `RGT-004` design content, not an instantiated Gate Profile. |
| `CSAA-004-ARE-012` | Architecture inference or unresolved dynamic dependency SHALL NOT become authoritative architecture or a clean result. |
| `CSAA-004-ARE-013` | `ARP-005` SHALL define dependency integrity and cycle analysis across distinct dependency kinds. |
| `CSAA-004-ARE-014` | Dependency integrity SHALL be Rule plus non-instantiated `RGT-005` design content, not an instantiated Gate Profile. |
| `CSAA-004-ARE-015` | Unresolved module resolution SHALL NOT become no-cycle or allowed-edge evidence. |
| `CSAA-004-ARE-016` | `ARP-006` SHALL define only a reachability/dead-code candidate under a declared entry universe. |
| `CSAA-004-ARE-017` | Dead or unreachable code SHALL remain Rule only in the baseline. |
| `CSAA-004-ARE-018` | Zero static callers or an unresolved entry mechanism SHALL NOT prove dead code or safe removal. |
| `CSAA-004-ARE-019` | `ARP-007` SHALL define coupling/change amplification against compatible subjects and exact metrics. |
| `CSAA-004-ARE-020` | Coupling/change amplification SHALL remain Rule only in the baseline. |
| `CSAA-004-ARE-021` | Generic coupling movement SHALL NOT become architecture violation without an external exact rule. |
| `CSAA-004-ARE-022` | `ARP-008` SHALL define behavioral preservation against an exact governed behavior or contract oracle. |
| `CSAA-004-ARE-023` | Behavioral preservation SHALL be Rule plus non-instantiated `RGT-008` design content, not an instantiated Gate Profile. |
| `CSAA-004-ARE-024` | Passing tests, coverage percentage, or empty semantic delta SHALL NOT alone establish preservation. |
| `CSAA-004-ARE-025` | `ARP-009` SHALL define test adequacy across obligation coverage, mutation, assertion strength, isolation, mocking, and changed-module treatment. |
| `CSAA-004-ARE-026` | Test adequacy SHALL be Rule plus non-instantiated `RGT-009` design content, not an instantiated Gate Profile. |
| `CSAA-004-ARE-027` | Numeric test floors SHALL come only from separately versioned recognized oracle content. |
| `CSAA-004-ARE-028` | `ARP-010` SHALL define security weakness and taint flow against exact rule ownership and coverage. |
| `CSAA-004-ARE-029` | Security weakness SHALL be Rule plus non-instantiated `RGT-010` design content, not an instantiated Gate Profile. |
| `CSAA-004-ARE-030` | Incomplete source, sink, sanitizer, propagation, framework, or trust-boundary coverage SHALL NOT yield a clean security result. |
| `CSAA-004-ARE-031` | `ARP-011` SHALL define third-party and supply-chain exposure with exact manifest, lockfile, component, feed, cutoff, provenance, vulnerability, and license-policy identity. |
| `CSAA-004-ARE-032` | Supply-chain exposure SHALL be Rule plus non-instantiated `RGT-011` design content, not an instantiated Gate Profile. |
| `CSAA-004-ARE-033` | Stale, unavailable, unknown, or conflicting advisory evidence SHALL NOT yield a clean supply-chain result. |
| `CSAA-004-ARE-034` | `ARP-012` SHALL define unsafe input/output handling against exact trust boundaries and taint coverage. |
| `CSAA-004-ARE-035` | Unsafe input/output handling SHALL be Rule plus non-instantiated `RGT-012` design content, not an instantiated Gate Profile. |
| `CSAA-004-ARE-036` | Unsupported trust boundaries SHALL remain inconclusive. |
| `CSAA-004-ARE-037` | `ARP-013` SHALL define concurrency and asynchronous-control risk as bounded technical signals. |
| `CSAA-004-ARE-038` | Concurrency risk SHALL remain Rule only in the baseline. |
| `CSAA-004-ARE-039` | Generic static concurrency warnings SHALL NOT establish violation of an unstated hard contract. |
| `CSAA-004-ARE-040` | `ARP-014` SHALL define error and recovery risk candidates. |
| `CSAA-004-ARE-041` | Error and recovery behavior SHALL remain Rule only in the baseline. |
| `CSAA-004-ARE-042` | Static smells SHALL NOT establish restart, idempotency, retry, rollback, or recovery correctness. |
| `CSAA-004-ARE-043` | `ARP-015` SHALL define observability-sufficiency signals against explicit obligations and evidence. |
| `CSAA-004-ARE-044` | Observability sufficiency SHALL remain Rule only in the baseline. |
| `CSAA-004-ARE-045` | Static telemetry presence SHALL NOT establish reconstructable runtime observability. |
| `CSAA-004-ARE-046` | `ARP-016` SHALL define maintainability/complexity with exact metrics, changed-module population, thresholds, exclusions, and generated-code treatment. |
| `CSAA-004-ARE-047` | Maintainability/complexity SHALL be Rule plus non-instantiated `RGT-016` design content, not an instantiated Gate Profile. |
| `CSAA-004-ARE-048` | Repository-wide averages SHALL NOT dilute changed-module violations. |
| `CSAA-004-ARE-049` | `ARP-017` SHALL define semantic-index freshness/completeness against exact identity, invalidation closure, coverage, health, and publication evidence. |
| `CSAA-004-ARE-050` | Semantic-index freshness/completeness SHALL be Rule plus non-instantiated meta-gate design template `RGT-017`, not an instantiated Gate Profile. |
| `CSAA-004-ARE-051` | Missing invalidation edges, last-known-good data, or empty results SHALL NOT establish freshness or completeness. |

### 20.10 Verification, cross-document closure, and lifecycle

| ID | Requirement |
| --- | --- |
| `CSAA-004-VFY-001` | Every `JAN-CSAA-000` §10.4 source requirement SHALL be imported and reconciled individually. |
| `CSAA-004-VFY-002` | Applicable canon and predecessor requirements SHALL be imported individually. |
| `CSAA-004-VFY-003` | All seventeen assurance areas SHALL have one complete allocation. |
| `CSAA-004-VFY-004` | Every Analysis Rule Profile SHALL resolve all common and rule-specific facets; every Repository Gate Template SHALL be complete as inert design content and SHALL NOT be treated as an instantiated Gate Profile. |
| `CSAA-004-VFY-005` | Outcome verification SHALL cover the five-dimensional state product. |
| `CSAA-004-VFY-006` | Outcome verification SHALL prove zero findings cannot manufacture support. |
| `CSAA-004-VFY-007` | Gate verification SHALL prove strictest-unresolved aggregation. |
| `CSAA-004-VFY-008` | Gate verification SHALL preserve effective exception and underlying violation. |
| `CSAA-004-VFY-009` | Result and finding verification SHALL prove stable identities, reciprocal links, immutable observation cores, and append-only correction and supersession. |
| `CSAA-004-VFY-010` | Remediation verification SHALL prove attributable record lineage and that change is not resolution without exact successful successor-subject reanalysis. |
| `CSAA-004-VFY-011` | Suppression verification SHALL prove attributable visible treatment history and no satisfaction or permission effect. |
| `CSAA-004-VFY-012` | Disposition and exception verification SHALL cover stable record identity, evidence, authority, scope, rationale, time, expiry, challenge, revocation, supersession, non-waivability, non-exceptable provider qualification, and higher concern-owner evidence-gap controls. |
| `CSAA-004-VFY-013` | Authority verification SHALL prove no profile, provider, executor, or change author self-confers authority. |
| `CSAA-004-VFY-014` | Oracle verification SHALL prove a change author cannot weaken pre-existing judgment to pass. |
| `CSAA-004-VFY-015` | Non-bypass verification SHALL distinguish local, interim, unbound, and definitive carriers. |
| `CSAA-004-VFY-016` | Provider verification SHALL cover every declaration facet and provider neutrality. |
| `CSAA-004-VFY-017` | Provenance verification SHALL reconstruct raw-to-normalized-to-Rule-Application-Result-to-finding-to-gate lineage. |
| `CSAA-004-VFY-018` | Failure verification SHALL prove failure, timeout, unsupported, partial, stale, and conflict cannot become green. |
| `CSAA-004-VFY-019` | Provider-substitution and positive-gate verification SHALL prove qualification is exact and is not inherited, inferred from a Provider Declaration, or reused across provider, adapter, capability-profile, method, rule-set, model, database or feed, configuration, version, oracle, or conformance changes. |
| `CSAA-004-VFY-020` | Dead-code verification SHALL cover all nine dynamic-entry mechanisms and unresolved coverage. |
| `CSAA-004-VFY-021` | Canonical-mapping verification SHALL prove technical gates cannot write canonical assurance directly. |
| `CSAA-004-VFY-022` | Cross-package review SHALL prove `JAN-CSAA-003` capabilities are referenced without redefinition. |
| `CSAA-004-VFY-023` | Cross-package review SHALL allocate fixture, schema, executable, employment, and qualification concerns to `006`, `007`, `008`, `010`, and `011`. |
| `CSAA-004-VFY-024` | Requirement-ledger closure SHALL require evidence for every local and inherited applicable obligation. |
| `CSAA-004-VFY-025` | Author self-review SHALL answer all eighteen `JAN-CSAA-000` §17 questions. |
| `CSAA-004-VFY-026` | Blocking author findings SHALL be resolved before Proposed freeze. |
| `CSAA-004-VFY-027` | Exact candidate identity, links, requirement counts, and evidence continuity SHALL be validated. |
| `CSAA-004-VFY-028` | Executable fixture, schema, conformance, gate, and provider results SHALL remain unperformed during documentation-only Wave 2. |
| `CSAA-004-VFY-029` | Proposed eligibility SHALL require closed ledger, completed self-review, resolved blockers, and exact freeze. |
| `CSAA-004-VFY-030` | Normative eligibility SHALL additionally require independent review, distinct integrity validation, final implementation reconciliation, and exact-member conferral. |
| `CSAA-004-VFY-031` | `JAN-CSAA-006` SHALL include positive, negative, inconclusive, partial, stale, disagreement, provider-failure, exception, suppression, non-bypass, and zero-static-callers judgments for this document's profiles. |
| `CSAA-004-VFY-032` | `JAN-CSAA-007` SHALL encode, without semantic loss, rule application, finding, disposition, remediation, suppression, exception, gate profile, gate evaluation, provider declaration, and failure meanings. |
| `CSAA-004-VFY-033` | `JAN-CSAA-008` SHALL verify aggregation, lifecycle, no-self-approval, exception preservation, mutation resistance, provider substitution, non-bypassability, and no-false-green behavior. |
| `CSAA-004-VFY-034` | `JAN-CSAA-010` MAY bind exact profile versions to employment points but SHALL NOT reinterpret a result or suppress a finding. |
| `CSAA-004-VFY-035` | `JAN-CSAA-011` SHALL qualify concrete providers against `JAN-CSAA-003` capabilities, this provider contract, independently reviewed oracles, and executable conformance. |

---

## 21. Verification and later-allocation matrix

### 21.1 Author-side methods

| Method | Required conclusion | Exact historical `0.1.0` pre-objective declaration |
| --- | --- | --- |
| `JAN-CSAA-004-VER-CTL-001` | Metadata, authority, lifecycle, exact inputs, and no-expansion are correct | `NOT_RUN` |
| `JAN-CSAA-004-VER-SRC-001` | Every applicable source clause has a bidirectional non-lossy allocation | `NOT_RUN` |
| `JAN-CSAA-004-VER-ARE-001` | All 17 assurance areas and 12 non-instantiated Repository Gate Templates are present exactly once | `NOT_RUN` |
| `JAN-CSAA-004-VER-CPF-001` | Every ARP resolves all common and rule-specific facets; every RGT remains an inert complete design record rather than an RGP | `NOT_RUN` |
| `JAN-CSAA-004-VER-EPI-001` | Outcome-product truth tables preserve applicability, health, evidence, epistemic, and conflict dimensions | `NOT_RUN` |
| `JAN-CSAA-004-VER-GAT-001` | Strictest aggregation, exceptions, advisory visibility, and mismatch invalidation are coherent | `NOT_RUN` |
| `JAN-CSAA-004-VER-RAR-001` | Rule Application Result identity, provenance, criteria, outcomes, finding reciprocity, invalidation, and successor history are complete | `NOT_RUN` |
| `JAN-CSAA-004-VER-FND-001` | Finding identity, immutability, recurrence, deduplication, and canonical boundary are coherent | `NOT_RUN` |
| `JAN-CSAA-004-VER-DSP-001` | Review, remediation, suppression, and exception axes cannot manufacture support | `NOT_RUN` |
| `JAN-CSAA-004-VER-AUT-001` | No-self-approval, oracle protection, authority, and non-bypass boundaries are complete | `NOT_RUN` |
| `JAN-CSAA-004-VER-PRV-001` | Provider declaration facets, raw-to-normalized lineage, and neutrality are complete | `NOT_RUN` |
| `JAN-CSAA-004-VER-DEG-001` | Failure, timeout, stale, unsupported, conflict, partial, and provider substitution remain non-green | `NOT_RUN` |
| `JAN-CSAA-004-VER-ZSC-001` | Zero-static-callers cases preserve every dynamic-entry frontier | `NOT_RUN` |
| `JAN-CSAA-004-VER-CAN-001` | Technical-to-canonical mapping does not transfer authority silently | `NOT_RUN` |
| `JAN-CSAA-004-VER-XPK-001` | Cross-document ownership and downstream allocations close without semantic forks | `NOT_RUN` |
| `JAN-CSAA-004-VER-SELF-001` | All eighteen `JAN-CSAA-000` §17 questions are answered | `NOT_RUN` |
| `JAN-CSAA-004-VER-INTEGRITY-001` | Exact identity, requirement counts, links, format, and evidence continuity reproduce | `NOT_RUN` |

The table above preserves the exact historical declaration embedded in `JAN-CSAA-004@0.1.0` before objective verification. It is not the current method state of this `0.1.1` successor. Exact predecessor objective closure recorded sixteen current-phase `PASSED` methods plus `JAN-CSAA-004-VER-SELF-001 / NOT_REQUIRED_CURRENT_PHASE`; the later preliminary self-review was performed but remained nonpass because `JAN-CSAA-004-SR-001 / MAJOR` was open. No predecessor method result is carried as direct-current evidence for changed successor bytes.

`CSAA-004-VFY-029` is a Proposed-eligibility rule and requires every author-side method in this table: `CTL`, `SRC`, `ARE`, `CPF`, `EPI`, `GAT`, `RAR`, `FND`, `DSP`, `AUT`, `PRV`, `DEG`, `ZSC`, `CAN`, `XPK`, `SELF`, and `INTEGRITY`. Objective-ledger closure may use only performed current-phase methods plus explicit evidence-supported `NOT_REQUIRED_CURRENT_PHASE` allocations; no subset or lifecycle conflation may manufacture Proposed readiness.

Author-side evidence may establish only candidate readiness for `CSAA-004-VFY-030`. Terminal satisfaction remains externally owned:

| Terminal predicate | Required distinct owner |
| --- | --- |
| Independent adversarial semantic review | Reviewer distinct from author and integrator |
| Integrity and provenance validation | Validator distinct from author and adversarial reviewer |
| Final implementation reconciliation | Exact final-refresh and reconciliation owner with independently inspectable evidence |
| Exact-member conferral | Accountable final decision authority, followed by a ministerial recorder |

The current state of `CSAA-004-VFY-030` is `NOT_RUN — EXTERNAL_TERMINAL_OWNERSHIP`. It can never receive an author-side `PASS`.

### 21.2 Later executable allocations

| Evidence need | Owner | Correction-cutoff state |
| --- | --- | --- |
| Independently authored expected profile and gate outcomes | `JAN-CSAA-006@0.1.0 / Draft` | `DOCUMENTED / NOT_CONFERRED / NOT_EXECUTED`; individual expected judgments remain `PROPOSED / NOT_CONFERRED / NOT_EXECUTED` |
| Exact rule, finding, exception, provider, and gate shapes | `JAN-CSAA-007@1.0.1 / Draft` | `DOCUMENTED / NON_AUTHORITATIVE / NOT_IMPLEMENTED / NOT_ENFORCED`; corrective author review is complete, but no schema, generated derivative, validator, adapter, or provider result exists |
| Executable lifecycle, mutation, failure, non-bypass, and no-false-green tests | `JAN-CSAA-008@0.2.2 / Draft` | Specification documented; every executable conformance result remains `NOT_PERFORMED` |
| Persistence, resource, security, and telemetry operations | `JAN-CSAA-009@0.2.1 / Draft` | Design documented; physical mechanism selection and every operational result remain `NOT_PERFORMED` |
| Exact coding-agent/developer employment-point bindings | `JAN-CSAA-010` | `NOT_AUTHORED / NOT_PERFORMED` at the correction cutoff |
| Concrete provider qualification and substitution evidence | `JAN-CSAA-011` | `NOT_AUTHORED / NOT_QUALIFIED / NOT_PERFORMED` at the correction cutoff |

Document existence is not implementation, execution, authority, conferral, qualification, or green evidence. Every `NOT_RUN`, `NOT_PERFORMED`, `NOT_IMPLEMENTED`, `NOT_ENFORCED`, `NOT_CONFERRED`, and `NOT_QUALIFIED` state remains an explicit nonpass for its own predicate.

---

## 22. Open alternatives and conservative defaults

| Alternative | Safe default |
| --- | --- |
| Gate allocation for coupling, concurrency, recovery, and observability | Rule only; exact hard obligations route through recognized contract, architecture, security, or behavior profiles |
| Dead-code gate | No baseline gate; future gate requires complete entry-universe evidence and separate review |
| Rule Application Result carrier | Semantic record required; top-level versus embedded shape belongs to `JAN-CSAA-007` |
| Area-specific versus one composite gate | Area-specific profiles plus composite readiness; employment composition belongs to `JAN-CSAA-010` |
| Exception over evidence gaps | Prohibited unless exact higher concern-owner authority explicitly permits it |
| Multiple-provider disagreement | Conflicting and inconclusive; no averaging or majority vote |
| Provider confidence normalization | Preserve raw value and basis; interpret only through exact profile |
| Advisory findings on permitted gate | Keep visible; never render unqualified green |
| Non-waivable categories | External concern owners identify them; this document invents no universal list |
| Actual authority and carrier | ARP binding authority is `UNASSIGNED`; ARP transition carriers are `N/A — no instantiated RGP or protected transition`; RGT designation inputs are `UNRESOLVED_BY_DESIGNATION`; `UNBOUND` applies only to a separately instantiated RGP; later binding cannot redefine criteria |
| Raw-output retention versus licensing/security | Provider is ineligible for profiles whose required traceability it cannot satisfy |
| Numeric thresholds | Separately versioned recognized oracle artifacts; no historical repository value becomes a rule silently |

---

## 23. Draft acceptance state

An exact Draft becomes eligible for exact Proposed freeze only when:

1. every `JAN-CSAA-000` §10.4 requirement is mapped bidirectionally;
2. applicable canon and predecessor clauses are individually reconciled;
3. all 401 local requirements are accounted for exactly once;
4. all 17 assurance areas and 17 Analysis Rule Profiles are substantively complete;
5. all 12 exact Repository Gate Templates are complete as inert `UNDESIGNATED_TEMPLATE / NOT_A_PROFILE` design records, and no Repository Gate Profile is instantiated;
6. every Analysis Rule Profile explicitly incorporates the reusable ARP clause registry and supplies every required profile-specific addendum;
7. outcome, Rule Application Result, finding, disposition, remediation, reanalysis, suppression, exception, provider, failure, zero-static-callers, canonical-boundary, and RGT non-instantiation checks pass;
8. the requirement ledger is closed by performed author-side evidence;
9. author self-review is complete and every blocking, major, and minor author finding is resolved against the exact candidate; and
10. exact freeze makes no executable, RGP-instantiation, binding-carrier, provider-qualification, current-repository, or implementation claim.

| Acceptance surface | Exact lifecycle state at `0.1.1` source finalization |
| --- | --- |
| Conditions 1–8 against exact predecessor `0.1.0` | Completed by `JAN-CSAA-004-VERIFICATION-001@0.1.2`, ledger `@0.1.1`, Wave 2 reconciliation, and closure evidence; historical evidence only for this changed successor |
| Conditions 1–8 against exact successor `0.1.1` | `AFFECTED_DIRECT_CURRENT_OBJECTIVE_RERUN_REQUIRED`; no predecessor PASS is carried |
| Condition 9 | Preliminary review was performed and remains `NONPASS / JAN-CSAA-004-SR-001 / MAJOR`; fresh corrective eighteen-question review is not yet eligible or performed |
| Condition 10 | `NOT_PERFORMED`; no exact Proposed freeze exists |

This `0.1.1 / Draft` is not Proposed-ready. Its successor ledger controls direct-current evidence after publication. Provider qualification, Repository Gate Profile instantiation or effect, executable conformance, final implementation refresh, independent assurance, sponsor review, and exact-member conferral all remain separate unperformed predicates.

---

## 24. Closing gate rule

A technical gate is trustworthy only when its exact profile, subject, criteria, capabilities, evidence, execution health, authority, carrier, exceptions, conflicts, and derivation are inspectable.

No provider may approve its own output. No change author may weaken the judgment that would have failed the change. No local green check is a binding gate. No empty finding set is support. When required analysis is unavailable or uncertain, the protected transition is withheld honestly.
