# CSAA Wave 0 Sponsor Decision Instrument

**Record handle:** `CSAA-W0-INSTRUMENT-2026-07-25`

**Version:** `0.3.0`

**Date:** 2026-07-25

**Status:** Stage A disposition record; W0-01 through W0-16 ratified; W0-17 not presented

**Authority:** None as an instrument. `JPWB-REG-005 REG-D-017` is the effective Stage A sponsor conferral.

**Controlling register record:** `JPWB-REG-005 REG-D-017`

**Open Stage B carrier:** `REG-Q-052` (Stage A portion satisfied; W0-17 remains open)

**Historical predecessor:** `REG-Q-051` (disposition procedure superseded)

**Prepared under:** The itemized sponsor act of 2026-07-25

**Governs:** Nothing by itself. The ratified scope and preparation commission govern only through `REG-D-017`.

**Does not govern:** JPWB canon, product or professional-work semantics, repository shapes, provider selection, implementation, gates, or any `JAN-CSAA` member.

**Primary proposal:** [CSAA corpus charter and manifest](<README.md>)

**Authority sources:**

- [JPWB Constitution](<../canon/JPWB-CON-000 Constitution.md>), especially B1, B2, B5, and B6;
- [JPWB Agent Operating Protocol](<../canon/JPWB-DOC-004 Agent Operating Protocol.md>), especially Sections 2, 3, 7, 9, and 10;
- [JPWB Decision and Divergence Register](<../canon/JPWB-REG-005 Decision and Divergence Register.md>), especially Sections 0 and 1.

---

## 1. Why this instrument exists

The initial instruction to proceed authorized Wave 0 preparation but did not itself establish program identity, authority form, scope, standing, permanent identifiers, or review authority. The sponsor subsequently disposed W0-01 through W0-16 individually as **RATIFY** and expressly made no disposition on W0-17. `REG-D-017` records the resulting Stage A grant.

`JPWB-CON-000 B2` prohibits an agent from converting fluency or best judgment into authority. `REG-D-013` requires a full-judgment instrument: every decision presents its proposed disposition, verified evidence, strongest opposing consideration, consequences, and recommendation. There is no bulk disposition.

The allowed dispositions for each item are:

- **RATIFY** — accept the proposed disposition;
- **AMEND** — state the replacement or changed text;
- **REJECT** — reject the proposal and state the controlling alternative where work depends on it;
- **DEFER** — leave the item open; its stated safe default controls and dependent work remains blocked.

The sponsor disposed each Stage A item separately. The rule remains controlling for W0-17 and future adoption instruments: a reply such as “approve all” is not the required judgment grain.

---

## 2. Evidence basis and verification status

### 2.1 Verified governance facts

The following facts were rechecked against the live files:

- the canon recognizes program working references only under a registered sponsor grant that names their scope and standing;
- their maximum standing is HYPOTHESIS-grade within the granted program scope;
- they are subordinate to every canon artifact by concern;
- status is conferred, never authored;
- a register conferral is effective on recording and does not need a substantive merge target;
- an agent may prepare a proposal or file an OPEN QUESTION but may not append an EFFECTIVE grant without the sponsor act;
- at initial decision preparation the register had no `JAN-CSAA` grant; the current register now carries the effective Stage A grant as `REG-D-017`;
- the pre-recording check confirmed `REG-D-017` as the next available decision identifier, and that identifier is now assigned to the Stage A act; every later filing SHALL recheck its own next identifier.

**Verification status:** confirmed from current `JPWB-CON-000`, `JPWB-DOC-004`, and `JPWB-REG-005`.

### 2.2 Verified repository facts

Repository evidence was refreshed at **2026-07-25T11:55:57.5639310-04:00**:

- repository root: `E:/Projects/hestami-ai`;
- branch: `main`;
- HEAD commit: `cffc796aed9c5ed0dce3b6c833295f52209a3991`;
- the working tree is materially dirty and contained 28 tracked/untracked porcelain entries at the observation time;
- the JPWB root manifest defines `packages/*` and `apps/*` workspaces;
- ten source library packages have TypeScript source/build project configurations;
- `packages/typescript-config` supplies shared compiler configuration;
- `apps/rph-demo` is the SvelteKit app and contains eleven authored `.svelte` files;
- the repository also contains a TypeScript prototype under `docs/Additional Concepts`, but it is not a root workspace;
- the root `tsconfig.json` contains no source program;
- deterministic Playwright and live/network Playwright surfaces are distinct from the app's SvelteKit TypeScript project;
- no repository-wide source-coverage provider is currently configured.

HEAD advanced during preparation from an earlier observed commit, demonstrating that this is a moving subject. **Verification status:** confirmed from the manifests, project configurations, source-file inventory, and Git state at the timestamp above. These are historical preparation-time observations, not a replacement for the revision-bound `JAN-CSAA-005` inventory.

**Append-only preparation refresh — 2026-07-25T12:08:21.6946056-04:00:** branch `main` remained at `cffc796aed9c5ed0dce3b6c833295f52209a3991`; the evolving working tree contained 34 tracked/untracked porcelain entries; root workspaces remained `packages/*` and `apps/*`; ten package build configurations and eleven authored `.svelte` files were observed; no repository-wide coverage-configuration hit was found by the recorded inspection. This refresh does not freeze the later sponsor-disposition subject.

**Append-only pre-disposition refresh — 2026-07-25T12:45:40.5169398-04:00:** branch `main` advanced to `92f30710dd559120af608f84018c33ac5d846f0b`; the evolving working tree contained 33 tracked/untracked porcelain entries; root workspaces remained `packages/*` and `apps/*`; ten package build configurations and eleven authored `.svelte` files were observed; no repository-wide coverage-configuration hit was found by the recorded inspection. Because the subject changed, the earlier commit observations remain historical and this latest observation controls only until another change.

**Append-only pre-recording refresh — 2026-07-25T12:52:23.7902772-04:00:** branch `main` remained at `92f30710dd559120af608f84018c33ac5d846f0b`; the evolving working tree contained 35 tracked/untracked porcelain entries; root workspaces remained `packages/*` and `apps/*`; ten package build configurations and eleven authored `.svelte` files were observed; no repository-wide coverage-configuration hit was found by the recorded inspection. This exact observation was carried in `REG-D-017`. The refresh was performed before the register append but was administratively appended to this instrument immediately afterward; the inverted carriage order is disclosed here and created no change to the observed facts or sponsor dispositions.

Immediately before sponsor disposition, the preparer SHALL recheck and record the observation time, HEAD, worktree identity/status, root workspace membership, supported project-configuration inventory, authored Svelte count, and repository-wide coverage configuration. A changed observation SHALL be appended to this evidence record or its superseding instrument; it SHALL NOT silently replace the historical observation above.

### 2.3 Evidence-basis labels

Every decision item distinguishes its basis using these labels:

- **[GOVERNING]** — text confirmed in an operative governing artifact;
- **[LIVE-VERIFIED]** — a repository fact directly observed at the Section 2.2 timestamp;
- **[USER-DIRECTIVE]** — scope or intent stated by the accountable sponsor in the request;
- **[INFERENCE]** — a conclusion drawn from identified facts or governing text;
- **[RECOMMENDATION]** — the preparer's proposed judgment, not an observed fact.

An inference or recommendation SHALL NOT be presented as live-verified evidence. Every time-sensitive **[LIVE-VERIFIED]** basis expires with the observed subject and SHALL be rechecked under Section 2.2 before disposition.

---

## 3. W0-01 — Working name and product standing

**Proposed disposition**

Adopt **Codebase Semantic Analysis and Assurance**, abbreviated **CSAA**, as the working program and capability name.

CSAA is:

- a JPWB engineering capability;
- not a separate Janumi product;
- not a PWA, PWU, Undertaking, canonical role, or professional-semantic object;
- not a claim that every engineering question is decidable or that analyzer output proves correctness.

**Evidence and basis classification**

**[INFERENCE]** The name describes the two bounded responsibilities commissioned by the proposal: provider-neutral semantic analysis of the codebase and evidence-bearing evaluation of software-engineering obligations.

**Strongest opposing consideration**

“Assurance” may be read as a promise of complete correctness or confused with canonical Janumi assurance semantics. A narrower name such as “TypeScript Code Intelligence” would reduce that risk.

The mitigation in the proposed name is explicit boundary text: CSAA technical records do not create canonical Assurance Assessments, and supported, violated, inconclusive, stale, and unsupported outcomes remain distinct.

**Consequences**

- **RATIFY:** the name/product boundary becomes an eligible term of the later Stage A grant; this item alone does not stabilize the prefix or create a product.
- **AMEND:** all proposed titles and the prefix decision must be reconciled to the replacement name.
- **REJECT:** Wave 1 remains blocked until a replacement working identity exists.
- **DEFER:** `CSAA` remains a provisional shorthand only.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 4. W0-02 — Authority form and standing

**Proposed disposition**

Establish CSAA as a **program working-reference series** under `JPWB-CON-000 B1`.

The series:

- holds no more than HYPOTHESIS-grade authority within its expressly granted program scope;
- is subordinate to every canon artifact by concern;
- defers exact governed shapes to enforced repository reference artifacts;
- does not initially enter the individually ratified `JPWB-SPEC-nnn` series;
- may later propose a separate `JPWB-SPEC-nnn` commission for stable subsystem semantic ground.

**Evidence and basis classification**

**[GOVERNING]** `JPWB-CON-000 B1` recognizes registered program working references and the separate `JPWB-SPEC-nnn` series. **[INFERENCE]** The planned corpus contains heterogeneous construction records: architecture, semantic ground, analysis semantics, repository inventory, fixture, contracts, V&V, operations, agent employment, and provider integration. Much of it is deliberately provisional until fixtures and measurements exist.

**Strongest opposing consideration**

A program reference series can grow into a side-canon, reproduce authority sprawl, or receive less rigorous review than individually ratified subsystem specifications.

The proposed controls are mandatory registration, bounded scope, HYPOTHESIS standing, total subordination to canon, per-document lifecycle status, requirement ledgers, executable discharge, and retirement through an authority-transfer audit.

**Consequences**

- **RATIFY:** the program-working-reference path becomes eligible for the later Stage A grant; this item alone confers nothing.
- **AMEND to `JPWB-SPEC`:** one or more subsystem boundaries and individual ratification packages must be designed before Wave 1.
- **REJECT without replacement:** no recognized authority path exists for Wave 1.
- **DEFER:** only Wave 0 proposal work may continue.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 5. W0-03 — Program scope and exclusions

**Proposed disposition**

Grant CSAA the program scope:

> Design, specify, fixture, implement, qualify, operate, and validate a revision-bound semantic-analysis and conventional software-assurance capability for the TypeScript, JavaScript, and TypeScript-bearing Svelte implementation of `JanumiCode/janumiprofessionalworkbench`.

The grant MAY cover `JAN-CSAA-000` through `JAN-CSAA-011` and their governed companion artifacts, subject to their individual lifecycle and review states.

The grant SHALL NOT authorize CSAA to:

- define or reinterpret PWA, PWU, Undertaking, professional-objective, or other professional semantics;
- create a new product, canonical ontology, role, governance Decision, waiver, approval, or Baseline;
- define infrastructure, cloud, Kubernetes, Pulumi, network-policy, or deployment-topology assurance;
- treat embeddings, code, analyzers, graphs, tests, coverage, or traces as independent semantic or governance authority;
- select or procure tools merely because the background chat named them;
- rewrite source or approve remediation as an implicit analyzer side effect;
- extend support to another repository or language without a new scoped decision.

CSAA MAY consume an externally governed software contract, architecture rule, or invariant as an opaque identified constraint. It may report technical evidence of conformance but may not model the professional object behind that constraint.

**Evidence and basis classification**

**[USER-DIRECTIVE]** The requested focus is the conventional TypeScript software-engineering domain. **[INFERENCE]** This boundary prevents the background chat's infrastructure and professional-graph expansion from entering the first program.

**Strongest opposing consideration**

Keeping professional-semantic traceability outside CSAA may later require a separate adapter and may prevent useful end-to-end intent-to-code queries in the first implementation.

That separation is deliberate. Code-to-professional-object traceability changes the source of truth, authority model, and semantic ontology; importing it now would make the first component unbounded and allow code tooling to assert professional realization.

**Consequences**

- **RATIFY:** the conventional code-analysis boundary becomes an eligible term of Stage A and the later Stage B commission; this item alone does not activate Wave 1.
- **AMEND:** every added domain must identify its source of truth, semantic owner, completeness limits, and adapter boundary.
- **REJECT:** a replacement scope is required before subject modeling.
- **DEFER:** scope remains proposal-only and Wave 1 is blocked.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 6. W0-04 — First supported repository subject

**Proposed disposition**

Set the first supported subject to the root-manifest-resolved JPWB workspace at an explicitly identified repository/worktree state.

### Semantically supported project set

Include:

- root discovery and configuration context: `package.json`, `bun.lock`, `turbo.json`, root `tsconfig.json`, ESLint configuration, dependency-cruiser configuration, and Sonar configuration;
- shared compiler configuration under `packages/typescript-config`;
- source and build project configurations for:
  - `packages/rph-application`;
  - `packages/rph-assurance`;
  - `packages/rph-authoring`;
  - `packages/rph-contracts`;
  - `packages/rph-domain`;
  - `packages/rph-engine`;
  - `packages/rph-persistence`;
  - `packages/rph-ports`;
  - `packages/rph-product-realization-pwa`;
  - `packages/rph-projections`;
- `apps/rph-demo` authored TypeScript, JavaScript, and `.svelte` source participating in its supported SvelteKit check/build pipeline;
- included package/app unit tests;
- generator source and generated TypeScript as distinct artifact classes;
- workspace manifests, package exports, lockfile-resolved dependencies, and existing architecture rules as contextual graph inputs.

Normal and `tsconfig.build.json` project variants SHALL remain distinct because their inclusion boundaries differ.

### Inventory-only perimeter

Inventory, but do not initially claim compiler-complete semantic support for:

- deterministic Playwright tests, configuration, setup, and teardown outside the SvelteKit project include set;
- live/network Playwright surfaces;
- executable static JavaScript not included by a declared project context;
- framework-generated `.svelte-kit` artifacts, which are derived rather than authored;
- any current gate exclusion or executable seam not covered by a declared project configuration.

Every perimeter region SHALL be labeled supported, partial, unsupported, or not analyzed. None may disappear into an implicit empty result.

### Excluded subject material

Exclude from first-scope semantic support:

- `node_modules`, `dist`, `build`, `.turbo`, coverage output, Playwright result output, caches, and temporary databases;
- TypeScript projects and code prototypes under `docs/**`, except the CSAA documents as authoring artifacts;
- `apps/rph-demo/harness/**` workflow-runtime JavaScript;
- third-party source beyond identity, manifest, lockfile, advisory, and provenance metadata;
- live agent/network execution and production trace collection;
- sibling repositories under `E:/Projects/hestami-ai`.

**Evidence and basis classification**

**[LIVE-VERIFIED]** The root manifest defines the JPWB monorepo workspaces; the documentation prototype is not a root workspace, while `apps/rph-demo` is. **[INFERENCE]** A manifest-resolved perimeter prevents the documentation prototype `tsconfig.json` from being silently included while ensuring Svelte-authored TypeScript is not silently excluded.

**Strongest opposing consideration**

The whole workspace is a broad first subject. Beginning with packages only would reduce discovery and fixture complexity.

Packages-only support would omit the actual Svelte application and reproduce the precise false-completeness problem the corpus is intended to prevent. Wave 1 is documentation and inventory work, so broad discovery is appropriate even where the resulting support state is partial.

**Consequences**

- **RATIFY:** `JAN-CSAA-001`, `002`, and `005` receive a proposed discovery perimeter for later Stage A/Stage B carriage; this item alone does not authorize their authoring.
- **AMEND:** identify each added or removed project/configuration surface.
- **REJECT:** a replacement subject boundary is required before inventory authoring.
- **DEFER:** no current-state completeness claim may be made.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 7. W0-05 — Inventory snapshot and execution mode

**Proposed disposition**

For Wave 1:

1. preserve the existing working tree exactly as received;
2. bind inventory facts to the parent commit plus an explicit worktree/change-set identity and relevant content/configuration digests;
3. record an intake observation time and re-verify the inventory subject at review;
4. never present the parent commit alone as the dirty tree's identity;
5. perform source and configuration inspection read-only by default;
6. do not install dependencies, format, generate, build, run live/network tests, invoke production traces, or run external scanners;
7. run an existing local command that may write caches or derived artifacts only under a separately declared execution authorization;
8. record configured-but-unexecuted commands as unexecuted rather than infer that they pass.

**Evidence and basis classification**

**[LIVE-VERIFIED]** The current tree contains material tracked and untracked user changes at the Section 2.2 observation. **[INFERENCE]** Cleaning, stashing, generating, or silently choosing a different commit would destroy or misstate the actual subject. Conversely, a dirty worktree is a moving subject unless its content identity and observation time are recorded.

**Strongest opposing consideration**

A sponsor-selected clean commit would be more stable and reproducible, and executing the current gates would provide stronger inventory evidence than configuration inspection alone.

A clean baseline can be added as a comparison subject later. It should not replace the actual worktree without an explicit sponsor choice. Gate execution can likewise be authorized once its writes and scope are known.

**Consequences**

- **RATIFY:** the source-faithful, read-only mode becomes an eligible term of the later Wave 1 commission; this item alone does not start inventory authoring.
- **AMEND to a clean commit:** identify the exact commit and whether the dirty tree remains a second subject.
- **AMEND execution permissions:** name allowed commands and whether network, caches, coverage, browsers, or generated outputs are permitted.
- **REJECT or DEFER:** `JAN-CSAA-005` preparation remains blocked beyond a preliminary perimeter inventory.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 8. W0-06 — Permanent program prefix and identifier allocations

**Proposed disposition**

Confirm `JAN-CSAA` as the permanent program-family prefix and reserve these permanent, non-reusable identifiers:

```text
JAN-CSAA-000
JAN-CSAA-001
JAN-CSAA-002
JAN-CSAA-003
JAN-CSAA-004
JAN-CSAA-005
JAN-CSAA-006
JAN-CSAA-007
JAN-CSAA-008
JAN-CSAA-009
JAN-CSAA-010
JAN-CSAA-011
```

`JAN-CSAA-000` remains the explicit `README.md` filename exception. Confirming an identifier does not confer authority on an unauthored or unadopted document.

**Evidence and basis classification**

**[LIVE-VERIFIED]** The prefix is collision-free in the repository at the Section 2.2 observation and is already used consistently throughout the proposal. **[INFERENCE]** Stable IDs make requirements, tests, schemas, and supersession links durable across title changes.

**Strongest opposing consideration**

The acronym could be confused with a product name or canonical assurance, and early allocation of all twelve IDs may preserve a decomposition that later proves suboptimal.

The working-name boundary addresses the first risk. Permanent IDs identify records, not an immutable decomposition: documents may be superseded, split by allocating new IDs, or retired without reusing an old identifier.

**Consequences**

- **RATIFY:** the allocations become eligible for confirmation by the later Stage A grant; this item alone does not make them permanent.
- **AMEND:** state the replacement prefix or allocation range and update all proposal references together.
- **REJECT:** Wave 1 documents require new provisional handles.
- **DEFER:** no proposed `JAN-CSAA` identifier is permanent.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 9. W0-07 — Document-control and lifecycle convention

**Proposed disposition**

Adopt for the CSAA program:

- permanent, non-reusable document IDs;
- `MAJOR.MINOR.PATCH` versions;
- status/version independence;
- exact local lifecycle labels:
  - **Draft** — in authoring; no program authority;
  - **Proposed** — review-ready; no program authority;
  - **Normative** — active program working reference at HYPOTHESIS settledness, only after the adoption authority named by the grant confers that status;
  - **Deprecated** — still discoverable and temporarily usable only under its stated compatibility rule;
  - **Superseded** — no longer current; successor required;
- exact authority citation separate from lifecycle status;
- synchronized manifest/member metadata;
- supersession links;
- `<PERMANENT-ID> - <Canonical Title>.md` filenames, except `JAN-CSAA-000` as `README.md`;
- the complete metadata block commissioned by `JAN-CSAA-000 Section 9.3`;
- stable requirement IDs and verification bindings for every retained SHALL and SHALL NOT before a member becomes Normative.

Neither “Normative” nor HYPOTHESIS standing makes a document canon or a `JPWB-SPEC-nnn`.

**Evidence and basis classification**

**[GOVERNING]** `JPWB-CON-000 B1-B2` separates artifact class, settledness, and conferred status. **[INFERENCE]** The proposed convention makes authoring state, program adoption, settledness, and canon standing independently visible. It also preserves the controlled-document behavior the RPH-shaped corpus requires without importing authority from the historical `JAN-DOCS-001`.

**Strongest opposing consideration**

“Normative” is easy to misread as canonical authority. A simpler `Draft / Active / Superseded` vocabulary would reduce that ambiguity.

The proposal already uses and defines the five labels. The separate authority and settledness fields are mandatory. If the sponsor prefers `Active`, that change should be made here rather than allowing later documents to improvise.

**Consequences**

- **RATIFY:** the lifecycle vocabulary and adoption gate become eligible terms of Stage A; this item alone does not adopt a member.
- **AMEND:** provide the complete replacement enumeration and meanings.
- **REJECT:** document-control authoring remains blocked.
- **DEFER:** the Stage A grant and Wave 1 remain blocked because no controlled lifecycle is settled.

**Recommendation**

**RATIFY.** Confidence: medium-high because the `Normative` label has a real ambiguity.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 10. W0-08 — Wave 1 documentation commission and execution limits

**Proposed disposition**

After both Wave 0 authority stages in Sections 20 and 21 are effective, commission documentation-only authoring and adversarial review of:

- `JAN-CSAA-001` — tool-neutral capability architecture and responsibility boundaries;
- `JAN-CSAA-002` — provider-independent TypeScript/Svelte semantic model and invariants;
- `JAN-CSAA-005` — revision-bound JPWB repository inventory and conformance map.

Wave 1 SHALL define subjects, identities, boundaries, current facts, and known unknowns. It SHALL NOT:

- implement an analyzer;
- add or update dependencies;
- alter application source, tests, or configuration;
- create final machine schemas, golden fixtures, or executable conformance suites;
- run a prototype or feasibility experiment under implied permission;
- decide CLI, IDE, UI, daemon, service, language-server, or microservice topology.

Any experiment requires a separate execution authorization naming tools, dependencies, files, writes, network access, cleanup, and evidentiary limits. An experiment may not modify semantic ground or satisfy a Wave 1 deliverable by implication.

**Evidence and basis classification**

**[INFERENCE]** `001`, `002`, and `005` form the minimum closed documentation foundation: logical responsibilities, provider-neutral meaning, and current repository truth. Implementation before those boundaries exist would permit tool or prototype convenience to shape the semantic model.

**Strongest opposing consideration**

Early prototypes could reveal feasibility and performance constraints that documentation inspection misses. A documentation-only wave can produce a model that later proves impractical.

The proposed response is explicit subsequent experiment authorization, not an implied experiment inside Wave 1.

**Consequences**

- **RATIFY:** the three-document Wave 1 commission is approved in principle but activates only after the exact `JAN-CSAA-000` adoption in W0-17.
- **AMEND:** state every added or removed deliverable and every additional execution permission.
- **REJECT:** define a replacement first production wave.
- **DEFER:** `001`, `002`, and `005` remain unauthored proposals.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 11. W0-09 — TypeScript semantic-evidence baseline

**Proposed disposition**

Adopt the following provider-independent semantic rule for Wave 1:

> A TypeScript or TypeScript-bearing Svelte fact is compiler-confirmed only for the exact source, project configuration, compiler/toolchain version, module-resolution environment, and relevant generated context against which it was derived. Analyzer and adapter output is derived evidence, never independent semantic authority.

Wave 1 may define identity, provenance, and uncertainty needed to perform this rule. It may not select an analyzer provider under this item.

**Evidence and basis classification**

**[LIVE-VERIFIED]** The supported repository has multiple source/build project configurations with different inclusion boundaries. **[INFERENCE]** A fact detached from its program and toolchain context can silently claim applicability to files or build variants it never analyzed.

**Strongest opposing consideration**

Binding every fact to full context increases storage, cache, and query complexity. Many developer tools intentionally return best-effort facts without preserving all compiler inputs.

**Consequences**

- **RATIFY:** `JAN-CSAA-002` must model compiler context and derived-evidence provenance.
- **AMEND:** provide the replacement semantic authority and minimum binding context.
- **REJECT:** identify what can confirm a TypeScript fact instead.
- **DEFER:** `JAN-CSAA-002` may inventory candidate fact kinds but may not define confirmation semantics.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 12. W0-10 — Coverage evidence baseline

**Proposed disposition**

Adopt the following semantic rule:

> Coverage is version-bound evidence that identified code regions were exercised by identified executions under identified instrumentation. A percentage alone is neither a correctness oracle nor evidence about unexecuted behavior.

Coverage provider, metric family, aggregation, exclusions, and repository-gate thresholds remain later decisions.

**Evidence and basis classification**

**[LIVE-VERIFIED]** No repository-wide source-coverage provider is configured at the Section 2.2 observation. **[INFERENCE]** Percentage-only treatment erases test identity, instrumentation limits, exclusions, and the distinction between execution and correctness.

**Strongest opposing consideration**

Teams commonly use a small threshold set because it is understandable, inexpensive, and easy to enforce. Rich execution provenance may be excessive for routine local development.

**Consequences**

- **RATIFY:** future coverage integration must preserve execution identity and limitations before deriving summaries.
- **AMEND:** state what coverage may prove and which provenance may be omitted.
- **REJECT:** identify the intended evidentiary meaning of coverage.
- **DEFER:** Wave 1 may inventory coverage absence only; it may not assign coverage semantics.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 13. W0-11 — Runtime-trace evidentiary limit

**Proposed disposition**

Adopt the following semantic rule:

> A runtime trace supports claims only about its identified captured execution, environment, inputs, instrumentation, and observation limits. It does not establish behavior for unobserved paths or all possible inputs.

Production trace collection, ingestion, retention, privacy, and sampling remain later decisions.

**Evidence and basis classification**

**[INFERENCE]** A trace is an observation of an execution, not a proof over the program. Treating it as universal evidence would collapse observed behavior into intended or exhaustive behavior.

**Strongest opposing consideration**

Repeated representative traces can be powerful behavioral evidence, and overly cautious language may prevent useful operational inference.

**Consequences**

- **RATIFY:** trace-derived findings must carry execution context and limits.
- **AMEND:** state the broader inference rule and its required sampling or statistical basis.
- **REJECT:** identify what evidentiary standing runtime traces should hold.
- **DEFER:** Wave 1 may reserve trace concepts but may not claim their assurance meaning.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 14. W0-12 — Analysis finding and disposition history

**Proposed disposition**

Adopt an append-only logical history for analyzer observations, findings, human or agent dispositions, suppressions, and corrections. A correction or changed judgment SHALL cite and supersede the prior record; it SHALL NOT erase or silently rewrite the prior decision. Physical compaction is permitted only if logical history and references remain losslessly reconstructable.

**Evidence and basis classification**

**[GOVERNING]** `JPWB-REG-005` uses append-only correction by superseding record for governance judgments. **[INFERENCE]** Technical findings require the same audit property to distinguish “the code changed,” “the analyzer changed,” and “the judgment changed.”

**Strongest opposing consideration**

Append-only history increases persistence, privacy, redaction, and lifecycle complexity. Many findings are low-value transient lint observations.

**Consequences**

- **RATIFY:** later persistence and contract work must preserve logical history and supersession.
- **AMEND:** define which record classes are mutable and how auditability survives.
- **REJECT:** identify the authoritative replacement history model.
- **DEFER:** Wave 1 may define finding identity but not final lifecycle or correction semantics.

**Recommendation**

**RATIFY.** Confidence: medium-high; retention and redaction require later design.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 15. W0-13 — Automated-remediation boundary

**Proposed disposition**

Keep source rewriting, automated remediation, approval of a repair, and application of a repair outside the CSAA analysis core. The analysis core may produce a proposed remediation plan or structured change candidate, but a separately authorized change workflow must decide, apply, and revalidate it.

**Evidence and basis classification**

**[USER-DIRECTIVE]** The requested component is a semantic-analysis and assurance capability used by coding agents. **[INFERENCE]** Combining observation, judgment, approval, and mutation in one implicit analyzer action defeats separation of responsibility and makes analyzer execution destructive.

**Strongest opposing consideration**

Integrated autofix is a core benefit of ESLint, formatters, and security tools. A hard boundary can create unnecessary orchestration and reduce developer adoption.

**Consequences**

- **RATIFY:** fix generation may be modeled, but mutation requires a separately authorized consumer and revalidation path.
- **AMEND:** identify exactly which safe mutations the analysis core may perform and under what approval.
- **REJECT:** define the combined analyzer/remediator authority and rollback model.
- **DEFER:** no CSAA-controlled source mutation may be designed or implemented.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 16. W0-14 — Incomplete and unsupported result behavior

**Proposed disposition**

Adopt the following false-green prohibition:

> An unsupported, failed, stale, partially analyzed, excluded, or otherwise incomplete region SHALL be reported explicitly. It SHALL NOT be collapsed into an empty finding set, a passing verdict, or an unqualified repository-level green result.

**Evidence and basis classification**

**[LIVE-VERIFIED]** The first repository subject includes semantically supported, inventory-only, and excluded regions. **[INFERENCE]** Without an explicit completeness state, the same empty result can mean “no violation,” “not analyzed,” or “analysis failed.”

**Strongest opposing consideration**

Strict incompleteness propagation can make aggregate status noisy or unusable while provider support is being built incrementally.

**Consequences**

- **RATIFY:** completeness and support state become mandatory parts of query and verdict semantics.
- **AMEND:** define the exact circumstances in which partial results may be summarized as passing.
- **REJECT:** identify how consumers distinguish absence of findings from absence of analysis.
- **DEFER:** no repository-level pass or green result may be specified.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 17. W0-15 — Concrete architecture, provider, and gate deferrals

**Proposed disposition**

Defer all concrete selections below to their owning later document and qualification evidence:

- `ts-morph`, TypeScript Compiler API, Tree-sitter, Joern, Semgrep, CodeQL, dependency-cruiser, Madge, and other analyzer providers;
- native graph composition versus imported or exported code-property graphs;
- graph and history persistence engines;
- coverage provider, metric, exclusions, and thresholds;
- production trace ingestion;
- concrete security and supply-chain gate profiles;
- severity, suppression, waiver, and repository-blocking profiles;
- licensing, redistribution, installation, deployment, and network-use profiles;
- CLI, IDE, UI, daemon, service, language-server, and microservice topology.

Wave 1 may record candidate capabilities, constraints, current repository configuration, and qualification questions. It SHALL NOT select, approve, procure, install, or normatively require a listed provider or topology.

**Evidence and basis classification**

**[INFERENCE]** Provider selection before the capability boundaries, semantic model, and repository inventory are reviewed would allow provider output shapes and convenience to determine the architecture.

**Strongest opposing consideration**

Some providers impose capabilities, licensing restrictions, performance ceilings, or graph models that materially constrain feasible architecture. Deferring every selection can delay discovery of those constraints.

The separate-experiment route in W0-08 permits evidence collection without making a provider authoritative by prototype.

**Consequences**

- **RATIFY:** Wave 1 stays provider-neutral and records qualification questions.
- **AMEND:** identify each selection to bring forward and the evidence/authority required.
- **REJECT:** identify which concrete architecture or provider choice is decided now.
- **DEFER:** no listed provider or topology receives approval by omission.

**Recommendation**

**RATIFY.** Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 18. W0-16 — Member adoption, review, and oracle authority

**Proposed disposition**

Until a multi-party authority model is established:

- the accountable sponsor retains authority to confer **Normative** program status on each CSAA member;
- every conferral SHALL be a distinct `JPWB-REG-005` sponsor `DECISION`, because `JPWB-CON-000 B2` makes that register the source of artifact authority;
- document authors MAY move a member from Draft to Proposed only after completing its requirement ledger and self-review;
- an author, reviewer, analyzer, or program-local log SHALL NOT confer Normative status;
- every Proposed member SHALL receive an independent adversarial review;
- every adoption package SHALL identify the exact document ID, semantic version, SHA-256 digest of the candidate bytes, review identity and method, requirement ledger, verification evidence, unresolved findings, strongest opposing case, consequences of adoption/rejection/deferral, and recommendation;
- every unresolved fork and every material normative change SHALL receive its own full-judgment decision surface and individual sponsor disposition;
- the sponsor's disposition SHALL be checked against the exact candidate bytes immediately before recording;
- the same controlled changeset SHALL append the conferral to `JPWB-REG-005` and synchronize the member and manifest status/version/authority fields;
- if candidate bytes change after sponsor disposition other than through an exactly previewed administrative carriage, the conferral SHALL pause for renewed review;
- pre-existing oracle judgments, acceptance criteria, fixtures, gate configurations, and other judgment-grain reference artifacts may be changed only by separately authorized review;
- newly authored oracle content remains Proposed until conferred;
- a suspected-wrong oracle creates a divergence record rather than an inline weakening;
- the Wave 0 ledger and review templates are mandatory starting points and may be specialized only with all required fields preserved.

A successful synchronized adoption record uses `EFFECTIVE — MERGED`. If synchronization cannot be completed in the same controlled changeset, the record SHALL say `EFFECTIVE — MERGE PENDING`, and a new append-only register entry SHALL later confirm carriage; the original entry SHALL NOT be rewritten.

The sponsor MAY amend this item by naming a delegated adoption authority and the exact scope, duration, reviewability, recording mechanism, and separation-of-duties constraints of that delegation.

**Evidence and basis classification**

**[GOVERNING]** `JPWB-CON-000 B2` states that artifact authority derives from its `JPWB-REG-005` ratification record and that status is conferred by the accountable sponsor. `JPWB-DOC-004 Section 7.6` separates oracle and implementation streams. `REG-D-013` requires full-judgment, itemized sponsor decisions.

**Strongest opposing consideration**

Sponsor-only, per-member `JPWB-REG-005` adoption can become a throughput and register-volume bottleneck, especially for technical documents and additive fixtures.

The current governing model nevertheless names one human sponsor. A future delegation is appropriate, but inventing its holder, scope, or alternate conferral log here would fabricate authority.

**Consequences**

- **RATIFY:** adoption has an exact evidence package, authority carrier, and synchronized recording procedure.
- **AMEND:** name the replacement authority and complete recording procedure.
- **REJECT:** no CSAA member can become Normative until a B2-compatible replacement exists.
- **DEFER:** members may reach Proposed only; pre-existing oracle judgments may not be changed.

**Recommendation**

**RATIFY** until an explicit delegated model is established. Confidence: high.

**Sponsor disposition**

`RATIFY — sponsor act 2026-07-25; recorded by REG-D-017`

---

## 19. W0-17 — Version-specific adoption of `JAN-CSAA-000`

This is a required second-stage decision, not a dispositionable placeholder.

**Proposed disposition**

After W0-01 through W0-16 are disposed and the Stage A grant is recorded:

1. incorporate the exact dispositions into `JAN-CSAA-000` while it remains Draft;
2. assign its next candidate semantic version without claiming authority;
3. complete and close its requirement ledger and self-review;
4. only after Step 3, change the exact candidate to Proposed;
5. conduct the independent adversarial review against the Proposed candidate;
6. incorporate permitted corrections, repeat affected review, and enumerate every remaining material fork or normative change using the W0-16 full-judgment fields;
7. calculate and display the SHA-256 digest of the final reviewed candidate;
8. present the complete candidate and adoption instrument to the sponsor;
9. accept an itemized W0-17 sponsor disposition only against that exact candidate.

The adoption record SHALL identify the exact version and digest and SHALL activate the W0-08 Wave 1 commission only if the sponsor ratifies adoption. No W0-17 disposition is requested or accepted while any field below is blank:

| Required adoption field | Value |
| --- | --- |
| Candidate document | `JAN-CSAA-000` |
| Candidate version | `TO BE PREPARED AFTER STAGE A` |
| Candidate SHA-256 | `TO BE PREPARED AFTER STAGE A` |
| Requirement ledger | `TO BE PREPARED AFTER STAGE A` |
| Independent review | `TO BE PREPARED AFTER STAGE A` |
| Remaining decision items | `TO BE PREPARED AFTER STAGE A` |
| Sponsor disposition | `NOT YET PRESENTED` |

**Evidence and basis classification**

**[GOVERNING]** B2 requires an artifact-specific ratification record. **[INFERENCE]** Adopting the current Draft before Stage A dispositions are incorporated would either ratify stale text or allow later agent-authored changes to inherit authority they were never shown.

**Strongest opposing consideration**

Two sponsor passes add latency. The current charter is already detailed, and a single grant could incorporate it by reference.

The second pass buys exact version/digest identity and independent review. It prevents a grant from silently making an unreviewed or subsequently amended Draft normative.

**Consequences**

- **RATIFY at Stage B:** `JAN-CSAA-000` becomes Normative at HYPOTHESIS standing and Wave 1 activates.
- **AMEND at Stage B:** revise, re-review, and recalculate the candidate before conferral.
- **REJECT at Stage B:** the program grant may remain effective, but the charter and Wave 1 commission do not activate.
- **DEFER at Stage B:** the charter remains Proposed and Wave 1 remains blocked.

**Recommendation**

Prepare and present the exact Stage B package after a compatible Stage A act. No adoption recommendation is made against unseen bytes.

**Sponsor disposition**

`NOT YET PRESENTED`

---

## 20. Stage A grant-record construction rule

**Outcome:** satisfied by `REG-D-017` on 2026-07-25. The rule is retained as the audit trail for that act.

The first sponsor response may establish the program and authorize preparation of the exact charter-adoption package. It SHALL NOT itself make `JAN-CSAA-000` Normative or activate Wave 1.

No Stage A `REG-D-nnn` entry may be filed unless:

1. W0-01 through W0-16 each receives an individual disposition;
2. every prerequisite disposition is **RATIFY** or a mutually compatible **AMEND**;
3. no prerequisite remains **REJECT** or **DEFER**;
4. every amendment is reconciled across dependent items;
5. live repository evidence in Section 2.2 is rechecked and appended with an exact observation time;
6. the next available `REG-D-nnn` identifier is rechecked;
7. the resulting register entry is regenerated from the actual dispositions rather than copied mechanically from this example;
8. the accountable sponsor's act and date are stated accurately.

If any item is rejected, deferred, or incompatible, the safe default remains no grant. The preparer SHALL record only the unresolved or replacement path; it SHALL NOT append a contradictory partial grant.

Subject to those gates, the expected entry shape is:

```markdown
### REG-D-[RECHECK] — JAN-CSAA program-working-reference grant and charter-preparation commission

- **Date:** [SPONSOR ACT DATE] · **Type:** DECISION (sponsor conferral:
  [exact itemized W0-01..W0-16 disposition record])
- **Statement:** The accountable sponsor establishes [DISPOSED PROGRAM NAME AND PREFIX] as a
  JPWB program working-reference series for [DISPOSED SCOPE AND SUBJECT]. The program holds
  no more than HYPOTHESIS-grade authority within that scope, is subordinate to every canon
  artifact by concern, and defers exact governed shapes to enforced repository reference
  artifacts. The grant confirms [DISPOSED IDENTIFIERS], lifecycle, semantic baselines,
  decision deferrals, review rules, and adoption procedure. It authorizes only administrative
  incorporation of these dispositions into `JAN-CSAA-000`, its ledger and independent review,
  and preparation of the W0-17 adoption package. No CSAA member is Normative, and the Wave 1
  authoring commission is not active, until the exact W0-17 adoption conferral is recorded.
  This grant creates no Janumi product, canonical role, professional-work semantics,
  infrastructure-assurance authority, provider approval, procurement approval, or authority
  for unauthored content.
- **Disposition:** Effective on recording as the B1 program sponsor grant and charter-preparation
  commission. It confers neither canon nor `JPWB-SPEC-nnn` status and does not adopt
  `JAN-CSAA-000`.
- **Merge target:** The grant itself has no substantive merge target. Administrative carriage:
  the Draft/Proposed CSAA manifest and W0-17 adoption package.
- **Status:** EFFECTIVE — MERGE PENDING.
```

Because the register is append-only, later carriage SHALL be confirmed through a new entry or synchronized `EFFECTIVE — MERGED` record; an existing status line SHALL NOT be rewritten.

---

## 21. Stage B adoption and Wave 1 activation rule

After Section 19 is fully populated and individually disposed, an exact `JPWB-REG-005` sponsor conferral may:

1. adopt the identified `JAN-CSAA-000` version/digest as a Normative program working reference at HYPOTHESIS standing;
2. synchronize its status block and manifest entry;
3. activate only the W0-08 commission for `JAN-CSAA-001`, `JAN-CSAA-002`, and `JAN-CSAA-005`;
4. carry forward every limitation and deferral from the Stage A dispositions.

The Stage B record SHALL be generated from the reviewed candidate and actual sponsor dispositions. This instrument deliberately supplies no pre-filled version, digest, or unconditional entry text.

---

## 22. Stage A sponsor response record

The sponsor returned one disposition for every row. No response to W0-17 was made.

| Item | Decision | Sponsor disposition |
| --- | --- | --- |
| W0-01 | Working name and product standing | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-02 | Authority form and standing | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-03 | Program scope and exclusions | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-04 | First supported repository subject | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-05 | Inventory snapshot and execution mode | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-06 | Permanent prefix and identifier allocations | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-07 | Document-control and lifecycle convention | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-08 | Wave 1 documentation commission and execution limits | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-09 | TypeScript semantic-evidence baseline | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-10 | Coverage evidence baseline | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-11 | Runtime-trace evidentiary limit | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-12 | Finding and disposition history | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-13 | Automated-remediation boundary | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-14 | Incomplete/unsupported false-green prohibition | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-15 | Concrete architecture/provider/gate deferrals | `RATIFY — sponsor act 2026-07-25; REG-D-017` |
| W0-16 | Member adoption, review, and oracle authority | `RATIFY — sponsor act 2026-07-25; REG-D-017` |

For every **AMEND**, provide the replacement text or exact boundary. A response has no authority until the resulting sponsor act is recorded through `JPWB-REG-005`.

---

## 23. Wave 0 completion state

| Wave 0 obligation | State |
| --- | --- |
| Decide working name and scope | Ratified by W0-01 and W0-03; recorded in `REG-D-017` |
| Decide program series versus `JPWB-SPEC-nnn` | Program working-reference series ratified by W0-02 |
| Confirm first subject and evidence mode | Ratified by W0-04 and W0-05 |
| Confirm permanent prefix and allocations | Ratified by W0-06 |
| Confirm document-control rules | Ratified by W0-07 |
| Decide Wave 1 commission | W0-08 ratified in principle; inactive until W0-17 |
| Decide semantic baselines independently | W0-09 through W0-14 ratified |
| Defer or advance concrete architecture choices | Deferrals ratified by W0-15 |
| Establish member review/adoption/oracle authority | Ratified by W0-16 |
| Record Stage A sponsor grant | `REG-D-017` EFFECTIVE — MERGE PENDING |
| Prepare exact `JAN-CSAA-000` adoption package | Authorized; not yet presented |
| Adopt `JAN-CSAA-000` and activate Wave 1 | Blocked until W0-17 Stage B conferral |
| Establish requirement-ledger template | Prepared; mandatory preserved-field starting point under `REG-D-017` / W0-16; not a CSAA member |
| Establish review template | Prepared; mandatory preserved-field starting point under `REG-D-017` / W0-16; not a CSAA member |

**Current state:** The bounded CSAA program and permanent identifier reservations exist under `REG-D-017`. No CSAA member is Normative; `JAN-CSAA-000@0.2.1` is an unadopted Proposed candidate; `JAN-CSAA-001` through `JAN-CSAA-011` remain unauthored; W0-17 remains undisposed; the W0-08 Wave 1 commission remains inactive; providers, implementation, dependencies, gates, experiments, and oracle changes remain unauthorized.

**Administrative Stage B preparation notation — 2026-07-25:** Draft ledger closure and author self-review preceded the Draft-to-Proposed transition. The exact Proposed candidate is `JAN-CSAA-000@0.2.1`, SHA-256 `3e0b5d503575b59c95f1e043d99122c5ebee5cff8429298347e7d3385c3725df`, 98,588 bytes, UTF-8 without BOM, CRLF. This notation records preparation progress only; it is not a W0-17 presentation, response, conferral, Wave 1 activation, provider decision, implementation authorization, experiment authorization, or oracle change.
