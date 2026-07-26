# JAN-CSAA-000 Refresh Preparation Evidence Snapshot

**Evidence ID:** `JAN-CSAA-000-EVIDENCE-002`

**Evidence version:** `0.1.0`

**Status:** Complete refresh evidence for `JAN-CSAA-000@0.3.0`; review input; not a Normative CSAA member

**Subject:** Conclusion-affecting repository/configuration drift since the first W0-17 presentation

**Authority:** Collected read-only under `JPWB-REG-005 REG-D-017`. This record observes repository state; it selects no provider, approves no dependency, and authorizes no implementation, experiment, gate change, source mutation, or oracle change.

**Replaces for current-package readiness:** `JAN-CSAA-000-EVIDENCE-001@0.2.0`; the earlier evidence remains immutable historical observation

---

## 1. Observation identity

Two complete read-only passes were identical during this window:

| Field | Stable value |
| --- | --- |
| Observation window | `2026-07-26T08:07:35.3220068-04:00` through `2026-07-26T08:07:36.9732663-04:00` |
| Repository root | `E:/Projects/hestami-ai` |
| CSAA subject root | `E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench` |
| Branch / `HEAD` | `main` / `9c952433c8b10b3ba1a2252c39b3d7b2833ad13c` |
| Global porcelain-v1 `-z` status | 4,628 bytes; 44 records: 22 tracked and 22 untracked; SHA-256 `17b541dd657d9bbb1cc52046d9c39998c28c4ee16caff5e12b74e1e862358550` |
| JPWB-scoped porcelain-v1 `-z` status | 4,586 bytes; 43 records: 21 tracked and 22 untracked; SHA-256 `6cce89e39653db5659ebb6fe18d0b2922a2000850be7343ccfdcc9e78d5331b4` |
| JPWB changed-path/content manifest | 7,635 bytes; 43 records; SHA-256 `bfe73b559917cde40fe0633e52afdbc43222786516062d03bd3c751bd06cc1c7` |
| JPWB tracked binary diff | 168,331 bytes; SHA-256 `1a5e1f8d390a9ed2ee15343fff529cbf038860f2dd3b13e5038f58c8d998858c` |
| Root/workspace/configuration manifest | 49 explicitly enumerated files; 4,998 bytes; SHA-256 `4604d51849b1c120d4887aa5926d1916a231744fcb2f7838be24db92b71dcc8d` |

The status digest is path/status evidence, not content identity. The changed-path/content manifest adds sorted `status + relative path + byte length + file SHA-256` records for the observed dirty subject. It still omits ignored files and clean tracked content other than through `HEAD` and separately selected configuration evidence.

The active worktree contains substantial work not authored by this refresh. This evidence preserves rather than cleans or stages it.

### 1.1 Accepted intermediate pre-review refresh

After the initial observation and before valid Draft closure, `HEAD` and active work changed again. One attempted observation pair from `2026-07-26T08:30:29-04:00` through `08:30:35-04:00` was rejected because its changed-content hashes differed. The next two complete passes were identical:

| Field | Final accepted pre-review value |
| --- | --- |
| Observation window | `2026-07-26T08:31:21.3148288-04:00` through `2026-07-26T08:31:23.0288293-04:00` |
| Branch / `HEAD` | `main` / `f550774f9765bca816c5fc5c2e1e51592ef0b0d5` |
| Global porcelain-v1 `-z` status | 6,764 bytes; 63 records: 29 tracked and 34 untracked; SHA-256 `0ef8f10363fba252b71202e58fa7d01d53428d669af8b9aed12eee5d5bcdf749` |
| JPWB-scoped porcelain-v1 `-z` status | 6,722 bytes; 62 records: 28 tracked and 34 untracked; SHA-256 `da1be5079c2d184b511e0730dd98b9ef6b918087bd61b2f33b1e0504171d234e` |
| JPWB changed-path/content manifest | 11,114 bytes; 62 records; SHA-256 `5b85ca93c5a9285c1ce6a5ee345ef551f3398dc9e02b2fb5ebc8cdc8c7518eb5` |
| JPWB tracked binary diff | 171,590 bytes; SHA-256 `53c9aa1a785b4b3c22df3b5bebd8f95ea8809fef66e4389075d0de59553ae549` |
| Explicit 49-path configuration manifest | 4,999 bytes; SHA-256 `09dd1feb4d1852960fa43533111ab4d16a90f99944a81023c66bab026d187d28` |

`HEAD` advanced through `d18c60aeba77604d75dfaf2838ac8ad00905f733` and `f550774f9765bca816c5fc5c2e1e51592ef0b0d5`. The commits added and measured RW-6 work, including one package test and new declared mutations. Active work also added an untracked RW-7 test and corresponding declared mutations.

The coverage provider, source-resolution mode, root scripts, thresholds, reports, exclusions, and app/root boundary did not change. Three actively modified package manifests added generated-output formatting, so the configuration identity did change even though the coverage conclusion did not. Section 1.3 supersedes this intermediate subject identity for final Draft closure.

### 1.2 Fingerprint normalization

- Status digests hash exact stdout bytes from `git status --porcelain=v1 -z --untracked-files=all --no-renames`.
- The JPWB changed-path/content manifest sorts complete records ordinally and hashes UTF-8-without-BOM records of `XY<TAB>Git-relative-path<TAB>byte-length<TAB>lowercase-SHA256<LF>`, with one final LF.
- The tracked-diff digest hashes exact stdout bytes from `git diff --binary --full-index --no-ext-diff --no-renames HEAD -- JanumiCode/janumiprofessionalworkbench`.
- The configuration manifest attachment sorts the 49 explicit forward-slash paths ordinally and records `relative-path<TAB>byte-length<TAB>lowercase-SHA256<LF>` in UTF-8 without BOM with one final LF.

### 1.3 Scope-relevant stability window

Authoring the refresh package necessarily changes paths under `docs/ASTs and Code Analysis/**`, so a later raw JPWB status or all-path changed-content digest would recursively include the package whose identity is still being completed. A final repeated-observation check therefore separated repository-subject drift from target-package authoring:

| Field | Stable scope-relevant value |
| --- | --- |
| Observation window | Four identical observations from `2026-07-26T10:00:06.6084336-04:00` through `2026-07-26T10:00:16.3943398-04:00`: three separated observations plus an immediate fourth |
| Branch / `HEAD` | `main` / `0be2eb5d6e4599020b32b4d94ed6dd7e5d1dce0c` |
| Raw JPWB porcelain-v1 status | 50 records; 5,687 bytes; SHA-256 `302632fc7abb0d71ba8a70a59b7bbaa163b6a7d48e5ceea3f7fd037a45093f1d` |
| Target-corpus records excluded | 28 records whose ordinal path begins `JanumiCode/janumiprofessionalworkbench/docs/ASTs and Code Analysis/` |
| Included filtered porcelain identity | 22 records; 2,197 bytes; SHA-256 `c3f61cdf029735bb424fed07cb01def67811d2500a7551e822b1ca30dc02461d` |
| Included scope-relevant changed-path/content manifest | 22 rows; 3,756 bytes; SHA-256 `74bce5d33b6301a214d2f27a7208a03dfb79191e1a97ad0bf2d99e3bca00a6ee` |
| Explicit configuration manifest | 49 files; 4,999 bytes; SHA-256 `09dd1feb4d1852960fa43533111ab4d16a90f99944a81023c66bab026d187d28` |
| Mutation journal / register state | `scripts/mutants/.in-flight` absent in all four observations; maximum decision `REG-D-017`; `REG-D-018` absent |

The included manifest uses the changed-path/content normalization in §1.2 and preserves every dirty JPWB path outside the target corpus. Exclusion is classification, not erasure: the refreshed package is bound separately by its exact integrity manifest, and the historical package is bound by its preserved integrity and presentation evidence. All four observations had the same branch, `HEAD`, included manifest, and configuration manifest.

| Scope-manifest attachment field | Exact value |
| --- | --- |
| Attachment ID | `JAN-CSAA-000-EVIDENCE-002-SCOPE-MANIFEST-001@0.1.0` |
| Path | `records/JAN-CSAA-000-EVIDENCE-002 - Scope-Relevant Changed-Content Manifest.tsv` |
| Rows / bytes | 22 / 3,756 |
| SHA-256 | `74bce5d33b6301a214d2f27a7208a03dfb79191e1a97ad0bf2d99e3bca00a6ee` |
| Encoding / line endings | UTF-8 without BOM / LF |

Between the §1.1 observation and this closure observation, commits through `0be2eb5d6e4599020b32b4d94ed6dd7e5d1dce0c` completed and corrected RW-7 work, repaired six mutation-ledger anchors, corrected the B6 fail-open path after a repository-recorded survivor, and recorded the independently executed mutation run's results. During later attempted freezes, that separately running Bun process repeatedly changed and restored source while maintaining `scripts/mutants/.in-flight`; every affected window was rejected. The final four observations began only after the process exited and the journal was absent. Project counts changed once and then remained stable; the mutation-ledger identity changed, while the coverage provider, root configuration, selection, thresholds, gate wiring, verification identities, and generated context did not. The external run and its commit are repository-recorded evidence, not independently repeated verification by this CSAA stream.

---

## 2. Read-only execution boundary

The refresh used Git, manifest, configuration, lockfile, source, and filesystem inspection only. It did not run:

- installation or dependency update;
- formatting, generation, build, or SvelteKit sync;
- TypeScript, Svelte, lint, dependency, test, coverage, Playwright, Sonar, or gate execution;
- the mutation runner or its preflight;
- an external analyzer or scanner;
- network or live-agent execution;
- production trace collection; or
- a command intended to write caches or derived artifacts.

A checked-in command is configuration evidence only. A checked-in comment, commit message, or roadmap result is a repository-recorded claim and is not represented here as an independently repeated execution.

Those execution statements describe only this CSAA refresh and review stream. During later freshness attempts, a separately running Bun mutation process was observed through its live process and `scripts/mutants/.in-flight` journal while it applied and restored temporary source changes. This stream did not start, stop, authorize, or treat that run as independently repeated CSAA verification. Every observation affected by its writes was rejected; the final evidence window must begin only after the process exits, the journal is absent, and repeated read-only observations agree.

---

## 3. Explicit configuration-manifest membership

The exact attachment is:

| Field | Value |
| --- | --- |
| Attachment ID | `JAN-CSAA-000-EVIDENCE-002-CONFIG-MANIFEST-001@0.1.0` |
| Path | `records/JAN-CSAA-000-EVIDENCE-002 - Root Workspace Configuration Manifest.tsv` |
| Rows / bytes | 49 / 4,999 |
| SHA-256 | `09dd1feb4d1852960fa43533111ab4d16a90f99944a81023c66bab026d187d28` |
| Encoding / line endings | UTF-8 without BOM / LF |

The prior evidence recorded a 48-file digest but did not enumerate those 48 paths. The new set makes membership explicit and includes root `vitest.config.ts`. It is a prose-reconstructed expansion of the earlier selection, not a claim that the new digest is a like-for-like comparison against an independently preserved old path list.

The new member is:

| Path | Exact bytes | SHA-256 |
| --- | ---: | --- |
| `vitest.config.ts` | 7,970 | `e463b130c343dc0814a17e77a4249837dfff28a7014793f27b57962345f1d976` |

Other conclusion-bearing identities include:

| Path | Exact bytes | SHA-256 |
| --- | ---: | --- |
| `package.json` | 1,583 | `ab4027b89f2cef87a548977e4cad1ff0f63e9df27f1da84dcad320f47322109b` |
| `bun.lock` | 131,000 | `9d4f7ecec8363ae4111538aa489383b3bcb4b5935afc5d93f78bf53b60229358` |

---

## 4. Project and source-perimeter observations

These are configuration and glob observations, not compiler or build results.

| Surface | Current count and qualification |
| --- | --- |
| Package normal TypeScript inputs | 243 |
| Package tests within that count | 145 by test-path classification: 141 `*.test.ts` files and four `__tests__` fixtures |
| Generator sources under `src/gen` | 6 |
| Inventory-classified generated outputs | 5 |
| Generated contract-schema JSON files | 107 |
| Projected package build inputs | 92 |
| App TypeScript files | 57, including 19 `*.test.ts` |
| App JavaScript / Svelte | 0 / 11 |
| Combined selected/authored TypeScript under the prior metric | 301 / 296: 243 package + 57 app + 1 app Vite configuration, less 5 generated outputs for authored |
| Root Vitest verification tests | 3 additional `verif/**/*.test.ts` files; reported separately rather than silently changing the prior metric |
| Deterministic/live Playwright specifications | 32 / 2 |
| Playwright configurations | 2 |
| Static JavaScript / excluded harness JavaScript | 1 / 1 |

Subsequent committed and active work explains the historical increase from 238 package inputs and 140 tests to 243 and 145. The RW-7 commit added two tests, but one was already present and counted as untracked in the preceding observation, so the comparable count rose by one. Later RW-7 corrections edited existing files. The build projection remains 92 because the build configurations exclude those tests.

`apps/rph-demo/.svelte-kit/tsconfig.json` still exists at 1,010 bytes with SHA-256 `c01d35eee60b3cb21e230c392c72c947234d7f406b83959a042a63e09db454c4`. Its freshness remains `UNPROVED` because the write-producing sync operation was not authorized.

The root `tsconfig.json` remains an empty discovery context. Root `vitest.config.ts`, `scripts/mutants/**/*.ts`, and `verif/**/*.test.ts` therefore require explicit inventory-only or partial classification rather than an unsupported compiler-complete claim. The Vitest configuration explicitly selects the three `verif` tests, but that selection is not equivalent to a TypeScript project context.

---

## 5. Coverage and test configuration

**Result:** root-level aggregate source-coverage collection configuration is present. Its configured subject include is package source only; `apps/rph-demo` is outside the root project set, so this is not evidence of complete whole-repository subject coverage.

### 5.1 Distinct configured modes

| Surface | Checked-in role |
| --- | --- |
| `test` | `turbo run test`; package-owned artifact/default mode |
| `test:src` | `vitest run`; root source-resolution mode |
| `test:coverage` | `vitest run --coverage`; root source-resolution coverage mode |
| Root Vitest projects | One `verif` project plus ten package projects |
| App relationship | `apps/rph-demo` is not a root Vitest project; its Vitest/Svelte checks and Playwright tests remain separate app surfaces |

Root aliases map `@janumipwb/*` package imports to `packages/*/src`, including subpath handling. That is checked-in source-resolution configuration. Its actual run result was not re-executed here.

### 5.2 Coverage identity

| Field | Checked-in value |
| --- | --- |
| Provider | V8 |
| Declared package | `@vitest/coverage-v8` `^4.0.0` |
| Resolved lockfile package | `@vitest/coverage-v8@4.1.10`; Vitest resolves at `4.1.10` |
| Subject include | `packages/*/src/**/*.ts` |
| Reporters | `text`, `json-summary`, `html` |
| Reports directory | `./coverage` |
| Threshold scope | Global, not per-file |
| Thresholds | Statements 94.5%; branches 82.5%; functions 95.5%; lines 96.5% |
| Automatic threshold update | `false` |

The exclusions cover test files, `__tests__`, `src/gen`, four named generated contract modules, `transitions.data.ts`, declaration files, and `index.ts`.

Known limitations and non-implications:

1. `ontology.data.ts` is the fifth inventory-classified generated output but is not named by the enforced coverage exclusions. A prose claim that all generated outputs are excluded would therefore be broader than the configuration.
2. The configuration supplies no LCOV reporter, and checked-in Sonar configuration has no coverage-ingestion property.
3. Global thresholds do not establish per-file adequacy.
4. Source-mode coverage does not establish artifact/build/export-map correctness; artifact and source modes are distinct.
5. A configured provider, threshold, or gate is current repository evidence. It is not a CSAA provider selection, machine-contract decision, oracle approval, or proof that the command currently passes.

---

## 6. Mutation, verification, and gate surfaces

### 6.1 Exact checked-in instruments

| Path | Exact bytes | SHA-256 | Observed role |
| --- | ---: | --- | --- |
| `scripts/mutants/ledger.ts` | 75,319 | `42ba71a357100cd5015486c73e2be7ba81f343f4309ce7311dab1e26b602a695` | Declared-mutation inventory and metadata |
| `scripts/mutants/run.ts` | 20,532 | `39ae4660ab7f385f9614e3f9d2d048a97c36920c808aa5797067ad7f2f296119` | Source-mutating runner with journal, restoration, precondition, selection, verdict, and blocking behavior |
| `scripts/mutants/show.ts` | 991 | `f8c470c02bead8cfa199d5315102e4b5b1fdf920e3022073c130405ee246a530` | Read-only declared-mutant display helper |
| `verif/source-resolution.test.ts` | 5,490 | `a5ac13471feb7f2c2c48f2ee9fe75a4122136583f103a64b1012f179f9b5452b` | Root source-resolution proof |
| `verif/source-is-reviewable.test.ts` | 3,008 | `88a5575babd62c48d045a7f3c7fd9c2fb29f98491118845c78bed137ab272ca3` | Authored-source text/reviewability check |
| `verif/mutant-ledger.test.ts` | 5,269 | `d17adadbb238eea5faf9a3db5f798e4eab0cb881db258292cb85a0eb3d1ffd19` | Mutation-ledger identity and coherence checks |

Read-only source inspection indicates that the runner:

- uses the source-resolution mode;
- distinguishes full execution from an anchor/typecheck-only preflight;
- rejects an already modified tracked tree as contamination;
- journals an in-flight mutation and attempts restoration;
- distinguishes killed, survived, unanchored, non-compiling, retired, duplicate, type-prevented, control, and aborted outcomes; and
- defaults actionable failures to blocking unless an explicit advisory mode is selected.

The final observation found 96 syntactic ledger entries, including ten `duplicateOf` entries, four supersession/retirement mappings, two type-prevented expectations, and two controls. Commit `0be2eb5d6e4599020b32b4d94ed6dd7e5d1dce0c` records a completed run over 82 distinct mutations with no survivor, unanchored, no-compile, or aborted-dirty result after earlier gate firings drove repairs. The current CSAA observation did not execute the runner. Those results are `REPOSITORY_RECORDED / NOT_INDEPENDENTLY_REEXECUTED`. A declared ledger is not the possible mutation space, and a zero-survivor result over a declared set cannot be generalized to all possible faults.

### 6.2 Composite gate

`gate:fast` is configured to run type checking, lint, dependency boundaries, build, artifact-mode tests, source coverage, app checks, and deterministic app end-to-end tests. `gate` then adds the mutation runner. This is checked-in gate wiring only.

The runner's cleanliness precondition inspects tracked modifications only under `packages`, `apps`, and `verif`, using `--untracked-files=no`. Documentation, scripts, paths outside those three roots, and every untracked file are outside that guard. A globally dirty worktree therefore does not by itself imply rejection. No attempt was made by this CSAA refresh and review stream to execute or bypass the runner.

---

## 7. Candidate impact and semantic boundary

The first presented evidence reported no repository-wide source-coverage provider or collection configuration. That conclusion was historically correct for its observation but is not current.

The old `JAN-CSAA-000@0.2.1` §10.5 text fixed that historical absence into a future inventory obligation. Current evidence falsified the fixed absence and required a successor candidate. `JAN-CSAA-000@0.3.0` therefore:

- makes the coverage obligation presence/absence durable;
- requires exact provider, resolution, selection, exclusion, denominator, report, threshold, gate, provenance, freshness, health, and limitation evidence when configuration is present;
- makes root verification and mutation instruments explicit inventory surfaces;
- distinguishes artifact-mode tests, source-mode tests, coverage, mutation, and composite gates; and
- preserves the rule that current checked-in tools are observations, not CSAA provider approvals.

The change does not claim that coverage, mutation, source resolution, or a gate passed. It does not adopt the candidate, activate Wave 1, select a CSAA provider, authorize an experiment or implementation, or change an oracle.

---

## 8. Freshness and invalidation rule

This observation is time-bound. Before presentation and again before any sponsor recording, the recorder must recheck:

- branch, `HEAD`, worktree/status/content identity, and register maximum;
- all 49 configuration-manifest paths, exact bytes, and digests;
- root Vitest, package-script, lockfile, coverage, mutation, and gate conclusions;
- generated Svelte configuration existence and qualification;
- candidate and package integrity;
- Stage A carriage; and
- prospective administrative carriage.

A new provider, script, configuration, threshold, selection, exclusion, gate, or contrary repository fact is conclusion-affecting unless an explicit impact review shows otherwise. Source-count drift may be accepted only when separately recorded with its exact impact.

---

## 9. Evidence disposition

| Claim | Disposition |
| --- | --- |
| Initial workspace and project perimeter remains identifiable | `PASS_WITH_QUALIFICATION` |
| Dirty-subject identity is explicit | `PASS` |
| Configuration-manifest membership is explicit | `PASS` |
| Root-level aggregate coverage configuration is present | `PASS` |
| Coverage provider, selection, exclusions, reports, thresholds, and gate wiring are inspectable | `PASS_WITH_KNOWN_LIMITATIONS` |
| Artifact and source modes are distinct | `PASS` |
| Root mutation and verification instruments are current repository surfaces | `PASS` |
| App and root Vitest surfaces remain distinct | `PASS` |
| Generated app compiler-context freshness is established | `UNPROVED` |
| Any configured command currently passes | `NOT_EXECUTED / NOT_CLAIMED` |
| Checked-in mutation results were independently repeated | `NOT_EXECUTED / NOT_CLAIMED` |
| A CSAA provider, dependency, implementation, experiment, gate, or oracle is approved | `NOT_AUTHORIZED / NOT_CLAIMED` |

The evidence is sufficient to correct and review the current-state charter ground. It is not sufficient to claim later-wave implementation or executable assurance closure.
