# JPWB Code Analysis Detailed Implementation Roadmap

**Document ID:** `JAN-CSAA-W4-ROADMAP-001`

**Version:** `0.1.0`

**Status:** Draft implementation roadmap

**Settledness:** HYPOTHESIS

**Repository:** `E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench`

**Prepared against:** Current working tree observed `2026-08-10`; each analyzer run binds its own exact selected-byte subject.
**Classification:** Repository-specific route from the CSAA specifications to a usable analyzer. It creates no provider qualification, gate activation, finding disposition, archive, evidence package, or normative conferral.

SHALL, SHALL NOT, SHOULD, SHOULD NOT, and MAY are prescriptive. Implementation is the source of truth for what currently exists and executes; the concern-owning CSAA specification defines the implementation target.

---

## 1. Outcome, commission, and exclusions

This roadmap delivers a JPWB development tool that identifies an exact repository subject; builds a TypeScript semantic snapshot; constructs dependency, call, state-machine, and read/write graphs; evaluates unknown-aware queries and change impact; produces provenance-rich findings; and exposes deterministic JSON to coding agents.

Implementation SHALL proceed through the nine work packages without per-document, per-increment, or per-wave sponsor ratification. Marshall Hendricks reviews the integrated implementation and corpus at the final gate. Earlier pause is required only for material scope expansion, an unsafe externally consequential action requiring new authority, or evidence invalidating a load-bearing semantic decision.

The tool SHALL remain outside the RPH product runtime. It may analyze RPH packages but no `packages/rph-*` or `apps/rph-demo` source may import it. Findings are technical claims, not self-executing design decisions.

Excluded are cost analysis; new intermediate governance records, archives, ledgers, presentations, or sponsor instruments; hosted multi-tenancy; automatic remediation, exception, waiver, or finding disposition; automatic merge-gate activation; and broad provider adoption before a measured need.

---

## 2. Inputs, current state, and source-of-truth boundary

### 2.1 CSAA inputs

Versions are the authoring baseline and SHALL be rebound if changed before a dependent package begins.

| Source | Version | Concern used |
| --- | --- | --- |
| `JAN-CSAA-000` / `README.md` | `0.3.0` | corpus scope and allocation |
| `JAN-CSAA-001` | `0.3.1` | architecture, trust, degraded operation |
| `JAN-CSAA-002` | `0.3.1` | semantic identities, provenance, invariants |
| `JAN-CSAA-003` | `0.2.0` | query algebra, slicing, comparison, impact |
| `JAN-CSAA-004` | `0.1.1` | rules, findings, gate separation, providers |
| `JAN-CSAA-005` | `0.3.1` | JPWB inventory; first generated product |
| `JAN-CSAA-006` | `0.1.1` | golden repositories and changes |
| `JAN-CSAA-007` | `1.1.0` | machine contracts and envelopes |
| `JAN-CSAA-008` | `0.3.0` | conformance, mutation, non-vacuity |
| `JAN-CSAA-009` | `0.2.1` | invalidation, persistence, recovery |
| `JAN-CSAA-010` | `0.1.0` | coding-agent use and completion accounting |
| `JAN-CSAA-011` | `0.1.0` | provider integration and removal |

The corrected four-valued query semantics in current `003`, `007`, and `008` control implementation. Historical PASS records do not replace executable conformance. Historical CSAA records and archives are not product inputs.

### 2.2 Confirmed repository facts

- JPWB is a private ESM Bun/Turbo workspace containing ten `rph-*` packages, shared `typescript-config`, and `apps/rph-demo`.
- Root scripts already cover build, type check, lint, dependency boundaries, source/distribution tests, coverage, mutation, fast/full gates, and specification-obligation counting.
- The lock resolves TypeScript `5.9.3`, dependency-cruiser `16.10.4`, and better-sqlite3 `12.11.1` (already used by `rph-persistence`, but not reusable product state).
- `.dependency-cruiser.cjs` enforces the RPH DAG and core/app boundaries.
- `scripts/spec-obligations.ts` is a 299-line generated-measurement precedent with self-tests.
- `verif/arrow-command-census.ts` is a 451-line Compiler API analyzer using `ts.createSourceFile` with tests and baseline.
- `verif/` contains a changing, filesystem-discoverable population of top-level TypeScript assets, including arrow, authority-resolution, aggregate-birth, command-dispatch, contract-number, dead-kernel, event-surface, policy-evidence-requirement, and route-action censuses plus truth/provenance analyzers. Every asset discovered for the frozen subject requires a disposition; the roadmap does not freeze a count that concurrent implementation can invalidate.

### 2.3 Source and subject rules

| Question | Source of truth |
| --- | --- |
| Existing code/config/tests | selected repository bytes |
| Current behavior | implementation plus executable evidence |
| Semantic/query meaning | owning CSAA specification plus contract tests |
| Intended architecture | recognized architecture sources and enforced rules |
| Support for an analyzer fact | provenance, capability, health, freshness, conflict |
| Change acceptability | authorized workflow, never the analyzer alone |

Every result SHALL carry a `SubjectDescriptor`: repository root and perimeter; normalized selected paths and artifact classes; selected-file content manifest; workspace/compiler/lock/tool identities; worktree and generated-source policy; start/completion times; exclusions; and the canonical `subjectId`. Git identity MAY supplement but SHALL NOT replace selected-byte identity. Selected uncommitted bytes are legitimate inputs. Unrelated documentation changes SHALL not invalidate an implementation-only subject.

Absence, unsupported analysis, excluded scope, not-applicable, unevaluated, stale, and contradictory evidence SHALL remain distinct. None may be coerced into `false`, `pass`, or an empty success.

---

## 3. Selected architecture and migration strategy

Create one private workspace package, `@janumipwb/csaa`:

```text
packages/csaa/src/
  contracts/  subject/  providers/  semantic/  graph/
  query/      impact/   rules/      inventory/ persistence/ cli/
```

Supporting changes are limited initially to `scripts/csaa-inventory.ts`, `verif/csaa/**`, the generated region of `JAN-CSAA-005`, root `package.json`, and `.dependency-cruiser.cjs`. New files require a work-package need. No server, UI, separate repository, or graph database is initial scope.

Selections:

- TypeScript Compiler API before ts-morph or regex semantics, because it is installed and proven locally.
- One package before package proliferation; internal modules preserve later split points.
- Canonical in-memory graph before persistence; measured SQLite later with content-addressed fallback.
- Versioned CLI JSON before MCP/service transport.
- Existing depcruise, ESLint, Vitest/V8, Playwright, and `verif` logic before new providers.
- Advisory findings throughout this roadmap; gate activation remains a final decision.
- Conditional Joern/CodeQL-class spike after native gaps are measured.

Existing `verif` assets SHALL receive one disposition: `RETAIN_DELEGATED`, `WRAP`, `PORT`, or `RETIRE_AFTER_EQUIVALENCE`. A replacement must reproduce the prior population, baseline, and discriminating failures before retirement. The old gate either delegates to CSAA or is retired in the same change that activates the replacement; simultaneous divergent gates are prohibited.

---

## 4. Detailed work-package register

All packages begin `NOT_STARTED / UNASSESSED`. Completion requires demonstrated exit criteria, not file presence.

### JAN-CSAA-W4-DWP-001 — Generate JAN-CSAA-005 inventory

**Outcome:** Publish `JAN-CSAA-005@0.4.0` as an explicit successor whose deterministic generated-current region and machine baseline replace hand-maintained current repository facts while retained legacy facts remain historical.

**Knowledge status:** `CONFIRMED`; required inputs and two local generator/analyzer precedents exist.

**Concrete paths:** `packages/csaa/{package.json,tsconfig.json,src/contracts/**,src/subject/**,src/inventory/**}`; `scripts/csaa-inventory.ts`; generated region and successor metadata of `docs/ASTs and Code Analysis/JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md`; `verif/csaa/jan-csaa-005.inventory.baseline.json`; focused tests; root `package.json`; `.dependency-cruiser.cjs`.

**Dependencies:** Bun/TypeScript, manifests/configuration, `scripts/spec-obligations.ts`, `verif/arrow-command-census.ts`; no new provider.

**Required changes:** Define the domain-separated subject-ID preimage from the design and a versioned inventory containing subject identity, workspaces/projects, commands, boundaries, test/coverage/mutation surfaces, artifact classes, provider identities/capabilities, and unknowns. Create the explicit 005 successor and historical/current precedence split. Derive populations; render stable JSON and a uniquely delimited Markdown region; provide `--write`, read-only `--check`, and `--json`; use atomic replacement. Inventory every top-level `verif/*.ts` asset discovered for the frozen subject by population, method, gate/test, and migration disposition. Enforce the no-product-imports-CSAA rule over both `packages` and `apps`, not configuration alone.

**Invariants/prohibited shortcuts:** Preserve prose outside generated markers after the initial controlled migration; exclude the 005 target, JSON baseline, and temporary outputs from their own subject preimage; reject missing/duplicate markers, malformed manifests, incomplete required roots, or noncanonical output. Git dirty state and generated output bytes do not enter subject identity. Do not infer compiler support from extensions, claim commands ran, require a clean worktree, scan `records/**`, or hide discovery errors.

**Tests/evidence:** Ordering, paths, canonical subject preimage, output self-exclusion, malformed/duplicate manifests, marker safety, write-then-check convergence, synthetic population change and excluded-control tests, plus `csaa:inventory:check`; boundary mutations from one RPH package and the app must fail. Evidence is tests and the tracked baseline, not a record package.

**Rollback/recovery:** Remove new scripts/package and restore the former marked region. Both outputs stage and validate before publication; a synchronous second-write failure restores the prior first target. Because two filesystem paths cannot share one atomic rename, hard termination may leave a detectable mismatched pair: check mode must refuse it and the next write deterministically repairs it. A mismatched pair is never current.

**Exit criteria:** Markdown and JSON share the exact `subjectId`; write followed by check converges; check mode detects fixture drift; populations reconcile independently; every top-level `verif` TypeScript file discovered for the frozen subject has a disposition; stable prose outside markers is unchanged after migration; package and app import prohibitions execute non-vacuously; focused and existing type/lint/boundary checks pass.

### JAN-CSAA-W4-DWP-002 — Resolve the exact subject

**Outcome:** Every operation begins with one validated, reproducible subject and artifact-classification map.

**Knowledge status:** `CONFIRMED` for workspace/config discovery; `UNKNOWN` for complete Svelte inclusion.

**Concrete paths:** `packages/csaa/src/subject/**`, subject contracts, `verif/csaa/fixtures/subject/**`, DWP-001 inventory calls.

**Dependencies:** DWP-001 canonicalization and contracts.

**Required changes:** Discover workspaces, tsconfig inheritance/references, compiler roots, exports, generated/app config, scripts/tests, and exclusions. Normalize Windows paths, case, real paths, and symlinks. Classify production, test, generator, generated, config, script, verification, inventory-only, third-party identity, and excluded artifacts. Support bounded repo/project/include/exclude inputs. Produce content manifest and digest before analysis.

**Invariants/prohibited shortcuts:** Every artifact has one class and explicit inclusion reasoning. Generated config carries freshness. Repository escapes, duplicate canonical paths, unreadable selected files, and cyclic configs fail closed. Missing optional regions remain reported absences, not completeness.

**Tests/evidence:** Windows/case/path tables, symlink escape, project references, stale generated config, malformed config, and equivalent-path subject identity.

**Rollback/recovery:** DWP-001 retains a narrow adapter until equivalence. Last output becomes explicitly stale; it is never relabeled current.

**Exit criteria:** All paths stay inside root; classification and manifest reconciliation are total; equivalent inputs share a digest; material changes alter it; incomplete discovery cannot return complete.

### JAN-CSAA-W4-DWP-003 — Build the TypeScript semantic snapshot

**Outcome:** Produce deterministic files, AST declarations/references, symbols, types, modules, imports/exports, diagnostics, and provenance across JPWB projects.

**Knowledge status:** `CONFIRMED` for Compiler API feasibility; full-scale performance is `ASSUMED` until measured.

**Concrete paths:** `packages/csaa/src/providers/typescript/**`, `src/semantic/**`, fixtures, snapshot contract tests.

**Dependencies:** DWP-002; TypeScript `5.9.3`; public Compiler API.

**Required changes:** Build programs without executing subject code. Assign snapshot-local IDs and durable declaration identities independent of array order. Record structured nodes, declarations, references, symbols, aliases, types, signatures, modules, imports/exports, diagnostics, spans, provider/tool/subject identity, coverage, and fact provenance. Represent unresolved, ambiguous, unsupported, and conflicting facts. Validate the applicable `JAN-CSAA-007` contract.

**Invariants/prohibited shortcuts:** No undocumented compiler internals without a pinned adapter/test. Spelling alone is not symbol identity; display text is not structured type identity. Parse errors may yield degraded facts but cannot silently erase coverage.

**Tests/evidence:** Aliases, re-exports, overloads, generics, unions/intersections, merging, ambient declarations, path maps, references, JavaScript, diagnostics, duplicate names, deterministic serialization, schema validation, and dropped-file/unresolved-alias mutations.

**Rollback/recovery:** Version formats; reject unknown major versions; rebuild rather than silently translate unsupported data.

**Exit criteria:** Golden snapshots reproduce; provider populations reconcile; representative projects load; degradation is honest/queryable; focused and fast-gate checks pass.

### JAN-CSAA-W4-DWP-004 — Construct semantic graphs

**Outcome:** Build traversable dependency, call, state-machine, and read/write graphs for architecture, dead-code, coupling, reachability, and impact questions.

**Knowledge status:** Dependency/FSM evidence is `CONFIRMED`; call/read-write precision is `INFERRED`.

**Concrete paths:** `packages/csaa/src/graph/**`, provider adapters, graph fixtures, compatibility changes to graph-relevant `verif` assets, and `.dependency-cruiser.cjs`.

**Dependencies:** DWP-003, depcruise configuration, arrow census and other censuses.

**Required changes:** Build compiler-resolved file/module/package edges and retain depcruise disagreement. Build calls categorized exact, candidate-set, external dispatch, unresolved, or unsupported. Generalize arrow facts into transitions, handlers, guards, and effects. Build field/state/persistence/port reads and writes via declared adapters. Add deterministic forward/reverse indexes, slices, SCCs, reachability, and orphan candidates. Reuse or migrate command-dispatch, event-surface, route-action, dead-kernel, birth, authority, contract-number, and policy-evidence census logic.

**Invariants/prohibited shortcuts:** Possible calls are not certain; unsupported dynamic behavior prevents dead-code completeness; provider conflicts remain. Graph shape alone does not declare a policy violation. Never leave an old census and disconnected CSAA population simultaneously authoritative.

**Tests/evidence:** Synthetic dispatch/dependency cycles/aliases, FSM equivalence, read/write controls, dead-code counterexamples, graph invariants, old/new output comparisons, and mutations dropping reverse edges, provenance, or candidates.

**Rollback/recovery:** Graphs are rebuildable. Existing censuses remain until replacement equivalence; format change invalidates affected cache only.

**Exit criteria:** Endpoints and reverse indexes reconcile; depcruise differences are explained; every graph-relevant `verif` analyzer is retained/wrapped/ported/retired as recorded; ported logic reproduces baseline and failures; one gate exists per concern; unsupported regions block false completeness.

### JAN-CSAA-W4-DWP-005 — Implement query, impact, rules, findings, and explanation

**Outcome:** Return bounded answers that preserve truth, unknown, conflict, applicability, provenance, and coverage.

**Knowledge status:** Algebra and classification are `CONFIRMED`; detector precision is `INFERRED` until fixtures run.

**Concrete paths:** `packages/csaa/src/{query,impact,rules}/**`, contracts, `verif/csaa/harmonization-detectability.baseline.json`, `JAN-CSAA-006` fixtures, `JAN-CSAA-008` conformance tests, and rule-relevant `verif` migration changes.

**Dependencies:** DWP-004 and corrected `003`/`007`/`008`.

**Required changes:** Implement evidence-pair `T/F/U/C`, exact NOT/AND/OR, empty quantifiers, separate N/A, whole-AST validation, lawful short-circuit, and per-node traces with support basis, capability coverage, execution health, freshness, conflict, and inference. Add predicates, quantifiers, bounded traversal, slices, comparison, changed-object sets, and impact frontiers. Produce versioned rule evaluations/findings without gate effect. Preserve all 75 review findings with ID, class, capability, phase, rationale, and status. First deliver IDs `1, 3, 5, 6, 8, 11, 12, 17, 18, 22, 23, 28, 30, 31, 32, 34, 35, 36, 39, 40, 49, 70, 73`. Reuse/migrate truth, provenance, evidence-gate, guard, deferral, and absence checks without divergent implementations.

**Invariants/prohibited shortcuts:** Account for all 75, including unsupported rows. Human judgment cannot become analyzer PASS. Empty populations require explicit closed semantics and disclosure. Validate skipped branches against budgets. Only `F` short-circuits AND and `T` short-circuits OR; skipped nodes remain explained.

**Tests/evidence:** Exhaustive tables; association/commutation where defined; double negation, De Morgan, eager/short equivalence; empty/N/A/node-trace/budget cases; query mutations; rule controls; impact counterexamples; and positive, nearby negative, provenance, and mutation/equivalent discrimination for each claimed benchmark detector.

**Rollback/recovery:** Version queries/rules/results; do not rewrite history. Rebuild derived results against prior versions.

**Exit criteria:** Algebra/metamorphic and hostile-mutation tests pass; 23 exemplars discriminate; all 75 rows are accounted without inflated automation; findings bind rule/evidence; impact exposes uncertainty/frontier; migrated checks have one implementation/gate.

### JAN-CSAA-W4-DWP-006 — Expose coding-agent CLI JSON

**Outcome:** Coding agents invoke bounded analysis and consume typed results without prose scraping.

**Knowledge status:** `CONFIRMED` feasible; ergonomics require use testing.

**Concrete paths:** `packages/csaa/src/cli/**`, package exports/bin, root `package.json`, CLI fixtures and integration tests.

**Dependencies:** DWP-005 and `JAN-CSAA-010`.

**Required changes:** Add `inventory`, `snapshot`, `query`, `impact`, `findings`, `explain`, and `verify`. Emit the exact closed progress/success/partial/error response union and subject-resolution outcomes as versioned JSON stdout; diagnostics/progress use stderr. Accept explicit subject, snapshot, query/rule, output, timeout, node/edge/result, and depth limits. Define exit categories for success, invalid request, incomplete/unsupported, failed expectation, and internal failure. Expose capabilities, execution health, freshness, exclusions, warnings, truncation, and continuations in their owning result variants. Test unresolved/forbidden subjects plus a pre-change, planned-impact, post-change, finding-review, completion sequence.

**Invariants/prohibited shortcuts:** Fixed input yields deterministic JSON except declared timestamps. Do not execute subject code, use network, mutate source, activate gates, hide partiality behind zero, or implement different semantics for human output.

**Tests/evidence:** Golden closed-union envelopes, subject-resolution failures without fabricated subjects, stdout/stderr, invalid requests, exhaustion/cancellation/paging, empty versus unsupported, injection/path cases, and end-to-end golden client.

**Rollback/recovery:** Major envelope changes version the protocol; compatible fields are additive. Failed commands leave source unchanged; prior response versions remain readable as declared.

**Exit criteria:** All commands have contracts/failures; JSON validates; automated client completes the full workflow; limits work; focused and `gate:fast` checks pass.

### JAN-CSAA-W4-DWP-007 — Add incremental freshness and local persistence

**Outcome:** Reuse valid work, invalidate correctly, publish atomically, and recover without mixed-generation results.

**Knowledge status:** Need is `CONFIRMED`; SQLite selection is `ASSUMED` pending measurement.

**Concrete paths:** `packages/csaa/src/persistence/**`, invalidation code, store fixtures, and at most one root ignore entry if a repository-local cache is selected.

**Dependencies:** DWP-003 through DWP-006 and `JAN-CSAA-009`.

**Required changes:** Compare SQLite with content-addressed files for transactions, startup, Bun/Windows compatibility, migration, and readers; choose SQLite only if it passes. Persist immutable subjects, snapshots, provider runs, graph partitions, versions, and result keys; publish one pointer after validation. Invalidate from content/config/tool/provider identity and semantic dependencies, never timestamps alone. Add clean/incremental equivalence, single writer/readers, cancellation, locks, migrations, retention, corruption detection, and rebuild. Keep transient data outside documentation records.

**Invariants/prohibited shortcuts:** No mixed generations; cache hits are identity-checked; corrupt/unknown versions rebuild; processing fewer files is not correctness proof; never import/share `rph-persistence` or product data.

**Tests/evidence:** Crashes around publish, cancellation, concurrent access, stale locks, corruption, migration, retention, config-only changes, rename/delete/fan-out, and randomized clean/incremental equivalence.

**Rollback/recovery:** Cache is disposable. Failed migration preserves last published generation; rollback selects compatible generation or rebuilds.

**Exit criteria:** Clean and incremental results agree across change matrix; faults expose no partial state; caches rebuild; concurrency passes; measured reuse improves repeated analysis without weakening freshness.

### JAN-CSAA-W4-DWP-008 — Integrate test, coverage, runtime, and security evidence

**Outcome:** Enrich static facts with current execution/security evidence while preserving provider identity, freshness, disagreement, and degradation.

**Knowledge status:** Tool surfaces are `CONFIRMED`; mappings are `INFERRED` until adapters run.

**Concrete paths:** `packages/csaa/src/providers/{dependency-cruiser,eslint,vitest,coverage,runtime,security}/**`, adapter fixtures, existing root/test commands.

**Dependencies:** DWP-005 through DWP-007 and `JAN-CSAA-011`.

**Required changes:** Import depcruise/ESLint machine output; map Vitest/V8 coverage with source-map validation; import supplied deterministic Playwright/runtime traces without implicit live execution. Add bounded native security rules for evidence-supported JPWB concerns. Implement five `HYBRID_RUNTIME` benchmark rows using static prerequisites plus dated evidence; keep eight `NORMATIVE_HUMAN` rows human. Preserve provider conflicts and show effects of absence/staleness/failure.

**Invariants/prohibited shortcuts:** Configured is not executed; executed is not current; covered is not correct; no finding is not no vulnerability. Runtime evidence names command/profile, environment, subject, times, exit, and artifacts. Provider failure degrades dependent conclusions, never to empty success.

**Tests/evidence:** Real small outputs, stale/mismatched maps, partial coverage, crash/timeout, compiler/depcruise conflict, malicious output/path, redaction, five hybrid fixtures, absent/unhealthy providers, and security negative controls.

**Rollback/recovery:** Adapters are removable; removal invalidates only dependent facts. Static core continues with reduced capability.

**Exit criteria:** Boundaries and freshness are demonstrated; mismatched evidence cannot support current claims; five hybrid rows work; security rules discriminate; appropriate fast/full gates pass.

### JAN-CSAA-W4-DWP-009 — Measure an advanced CPG provider

**Outcome:** Adopt, constrain, or decline Joern/CodeQL-class capability from evidence without delaying native CSAA.

**Knowledge status:** `UNKNOWN`; both gap and provider advantage require proof.

**Concrete paths:** Only if entry passes: `packages/csaa/src/providers/experimental/**`, `verif/csaa/experimental/**`; initial subject `packages/rph-domain`.

**Dependencies:** DWP-008 and a high-value native gap or need for independent corroboration.

**Required changes:** Select one available provider for the exact gap; record version/query/translation/setup/subject/runtime/result; compare facts, false positives, unknowns, provenance, reproducibility, operations, and incremental behavior; disposition `ADOPT_BOUNDED_ADAPTER`, `DEFER`, or `REJECT_FOR_CURRENT_NEED`; remove experimental code unless adopted.

**Invariants/prohibited shortcuts:** This roadmap does not authorize installation, licensing, network/upload, or system configuration. If unavailable, `DEFER` does not block native completion. All output uses normal provenance/uncertainty contracts.

**Tests/evidence:** Reproducible bounded run, hand-checked positive/negative gap queries, native comparison, and degraded/removal tests if adoption is proposed.

**Rollback/recovery:** Experimental outputs are disposable; removal invalidates only provider-supported results.

**Exit criteria:** Entry predicate and disposition are explicit; advantages have discriminating proof; constraints are known; native operation is independent; no unjustified dependency remains.

---

## 5. Data, compatibility, security, and recovery

Core entities are immutable `SubjectDescriptor`, `ProviderRun`, `SemanticSnapshot`, `SemanticNode/Edge`, `CapabilityCoverage`, `QueryDefinition/Result`, `ChangeSet/ImpactResult`, `RuleProfile/Evaluation`, and `AnalyzerFinding`. Only a current-snapshot pointer is mutable. Physical storage is replaceable and never shares the RPH product database.

Contracts use semantic versions; unknown majors fail. Provider/TypeScript upgrades create new identities and rerun goldens. Failed generation or analysis leaves the previous publication intact but stale. Derived state remains rebuildable from selected bytes, versions, and provider evidence.

Repository content is untrusted. Static analysis SHALL NOT execute subject modules, scripts, plugins, or arbitrary configuration. Tool adapters use fixed argument arrays, constrained directories, time/output limits, and explicit configuration. Paths prevent traversal/symlink escape; queries/traversals/results have budgets; diagnostics redact secrets; default commands use no network or upload. Findings cannot approve changes, exceptions, suppression, source mutation, gate state, or human-normative compliance.

Operations report subject/provider/capability/coverage/reuse/invalidation/limits and complete/degraded/stale/failed state. Logs use digests and bounded spans, not source dumps. Invalid subjects publish nothing; optional-provider failure degrades dependent results; required semantic failure blocks complete snapshots; cancellation publishes no partial generation; corrupt cache rebuilds; generated-write failure leaves prior bytes.

---

## 6. Assurance, benchmark, and gates

Required layers are unit, versioned-contract, golden fixture, current-repository integration, differential, metamorphic, mutation, fault-injection, security, and measured cold/warm performance. Every population check proves the required population is nonempty and responds to a controlled change. A count without a re-derivable population is not evidence.

### 6.1 Harmonization benchmark

The executable baseline preserves every ID from the 75 confirmed findings:

| Class | Count | Acceptance |
| --- | ---: | --- |
| `STATIC_DIRECT` | 21 | static query/detector by DWP-005 |
| `STATIC_WHOLE_PROGRAM` | 41 | graph/query/rule detector by DWP-005 |
| `HYBRID_RUNTIME` | 5 | static prerequisites DWP-005; runtime DWP-008 |
| `NORMATIVE_HUMAN` | 8 | human; only prerequisites may be automated |
| **Total** | **75** | exactly one class and status per row |

Static expectation is 62/75 (82.7%); static plus runtime is 67/75 (89.3%). These are hypotheses, not pre-awarded passes. The 23 first analyzer-increment exemplars are IDs `1, 3, 5, 6, 8, 11, 12, 17, 18, 22, 23, 28, 30, 31, 32, 34, 35, 36, 39, 40, 49, 70, 73`. Each implemented row needs a positive case, nearby negative, provenance, and mutation/equivalent discrimination. Results distinguish `DETECTED`, `NOT_DETECTED`, `UNSUPPORTED`, `NOT_APPLICABLE`, and `NOT_RUN`; no attempted-subset denominator is allowed.

### 6.2 Implementation gates

| Gate | Minimum proof |
| --- | --- |
| `G0 BASELINE` | current focused health known; unrelated failures identified |
| `G1 INVENTORY` | deterministic generation, drift detection, no unrelated prose change |
| `G2 SUBJECT` | total classification and digest sensitivity |
| `G3 SEMANTIC` | compiler goldens and honest degradation |
| `G4 GRAPH` | graph invariants plus census/depcruise differential |
| `G5 ANALYSIS` | exhaustive algebra, 23 exemplars, total 75-row accounting |
| `G6 AGENT` | stable JSON client workflow and budgets |
| `G7 INCREMENTAL` | clean/incremental equality and crash safety |
| `G8 ENRICHED` | adapter freshness/degradation/security and hybrid rows |
| `G9 PROVIDER` | measured disposition if entry passes; otherwise explicit defer |
| `G10 FINAL` | full current verification and one integrated corpus/sponsor review |

Passing permits progression within this roadmap only; it is not provider qualification, gate activation, or normative conferral.

---

## 7. Risks, traceability, ordering, and final exit

### 7.1 Controlled risks and triggers

| Risk/unknown | Control or trigger |
| --- | --- |
| large Draft sources retain contradictions | implement executable slices; block only affected semantics; propose narrow correction |
| generated inventory churn | canonical ordering; separate volatile observation metadata; byte tests |
| TypeScript identity drift | owned identities, provider version, upgrade goldens |
| call/read-write overclaim | edge categories, coverage, unknown/conflict preservation |
| SQLite Bun/Windows behavior | DWP-007 spike and file fallback |
| Svelte/config freshness | honest classification; adapter only for measured gap |
| benchmark overfit | counterexamples; benchmark is not sole taxonomy |
| noisy security rules | supported regions and negative controls |
| provider requires external authority/network | defer without blocking native release |
| CSAA becomes runtime dependency or hosted service | material expansion; stop for architecture authority |
| conflict changes truth, finding identity, or publication atomicity | stop affected package only; continue independent work |

Ordinary refactoring, test correction, generated refresh, or adapter work requires no sponsor pause.

### 7.2 Traceability

| Concern | DWP | Carrier |
| --- | --- | --- |
| architecture/degradation (`001`) | 2–8 | package modules and provider-health tests |
| semantic model (`002`) | 2–5 | contracts, nodes/edges, invariants |
| query/impact (`003`) | 5–6 | algebra/query engine and CLI |
| rules/findings (`004`) | 5, 8 | rule/finding tests; no gate effect |
| inventory (`005`) | 1–2 | generated region and JSON baseline |
| fixtures/conformance (`006`, `008`) | 1–8 | fixtures, mutation, faults, non-vacuity |
| machine contracts (`007`) | 3, 5, 6 | versioned contracts/JSON |
| persistence (`009`) | 7 | invalidation/publication/recovery tests |
| agent use (`010`) | 6 | end-to-end CLI workflow |
| providers (`011`) | 3, 4, 8, 9 | adapters, health, removal tests |
| 75 findings | 5, 8 | total baseline and detector tests |
| Frozen-subject `verif` estate | 1, 4, 5 | discover all assets, assign dispositions, prove equivalence, retain one gate/concern |

Completion summaries add concrete source symbols and test names. A document citation alone is not implementation traceability.

### 7.3 Order and concurrency

```text
001 inventory -> 002 subject -> 003 semantic -> 004 graphs
-> 005 analysis -> 006 agent -> 007 persistence -> 008 adapters
-> 009 provider decision -> G10 integrated review
```

Fixtures/contracts/benchmark preparation may lead implementation. Concurrent work requires disjoint files or isolated worktrees; shared `package.json`, `.dependency-cruiser.cjs`, contracts, and generated `JAN-CSAA-005` edits are serialized. Never generate while its generator or population is being edited. The agent continues automatically after each passed gate and creates no transition review records.

### 7.4 Final exit

Implementation is complete when DWP-001 through DWP-008 pass; DWP-009 is completed or validly deferred; `JAN-CSAA-005` is generator-owned and check-clean; native semantic/graph/query/impact/rule/finding/explanation works over JPWB; a coding agent completes pre/post-change JSON workflow; incremental equals clean; all 75 benchmark rows are honest; relevant unit/contract/golden/integration/metamorphic/mutation/fault/security/coverage/repository gates pass or identify unrelated pre-existing failure; and implementation plus `001`–`011` are reconciled once.

Marshall Hendricks then receives the integrated corpus, implementation summary, limitations, provider disposition, and current verification for the single sponsor review. Until then CSAA is an implementation candidate and its findings have no automatic governance effect. No archive, evidence binder, sponsor packet, or cost report is required; durable proof is source, generated inventory, versioned baselines, tests, normal CI output, and the final review.

**Readiness:** `READY_TO_IMPLEMENT_DWP-001`. Existing toolchain and local precedents are sufficient; no provider installation, archival action, intermediate sponsor decision, or further documentation wave is prerequisite.
