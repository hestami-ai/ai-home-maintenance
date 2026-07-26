# JAN-CSAA-005 Preparation Evidence Snapshot

**Evidence ID:** `JAN-CSAA-005-EVIDENCE-001`

**Evidence version:** `0.1.0`

**Status:** Complete preparation evidence for `JAN-CSAA-005@0.1.0` Draft; review input; not a Normative CSAA member

**Subject:** Revision-bound current JPWB implementation/configuration inventory supporting `JAN-CSAA-005`

**Observation time:** `2026-07-26T11:52:31.6050250-04:00`

**Authority:** Collected read-only under `JPWB-REG-005 REG-D-018`. This record observes repository state; it selects no provider, approves no dependency, and authorizes no implementation, experiment, topology, gate change, source mutation, oracle change, installation, or execution.

**Supersedes:** None

---

## 1. Observation identity

| Field | Recorded value |
| --- | --- |
| Observation time | `2026-07-26T11:52:31.6050250-04:00` |
| Repository root | `E:/Projects/hestami-ai` |
| JPWB subject root | `E:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench` |
| Branch | `main` |
| Parent commit | `e673fb5c2e186fb0873d3720036e5e8d7b00038a` |
| JPWB porcelain-v2 records | 57 total: 15 tracked changes and 42 untracked paths |
| JPWB status-manifest SHA-256 | `95178408efa287ddfdd2a29e42be20e75ba0a61a946e0141a47eee73f2102054` |
| Implementation/configuration porcelain-v2 records | 0 |
| Tracked implementation/configuration records | 528 |
| Tracked implementation/configuration manifest SHA-256 | `43961152982d7082c5f2f5644d84e1b2b4282d834b42319ca44a8d620333d4ea` |
| `packages` Git tree object | `fc84e78a63513fe7c97fc7516cd265b590277f4b` |
| `apps` Git tree object | `082b937ce653ad9ecd72b239ffb72aac1a7aa49d` |

All 57 JPWB status records at the observation time were under `docs/**`. The explicitly selected implementation/configuration paths had no tracked modification or untracked path. The preparation stream preserved the active worktree and did not clean, stage, commit, or modify pre-existing work.

Authoring `JAN-CSAA-005` and this evidence record necessarily adds later paths under `docs/ASTs and Code Analysis/**`. Those later authoring changes do not retroactively change the recorded implementation/configuration snapshot. They do mean a later raw JPWB status will not equal the pre-authoring status digest.

### 1.1 Fingerprint normalization

- The JPWB status manifest is SHA-256 over UTF-8, LF-terminated, ordinal-sorted records from `git status --porcelain=v2 --untracked-files=all -- JanumiCode/janumiprofessionalworkbench`, with one terminal LF.
- Counts classify record prefixes: ordinary/rename/unmerged records as tracked and `?` records as untracked.
- The tracked implementation/configuration manifest is SHA-256 over UTF-8, LF-terminated, ordinal-sorted `git ls-files -s` records for the explicit paths in §2, with one terminal LF.
- A `git ls-files -s` record preserves Git mode, blob object identity, stage, and path. Because the selected implementation/configuration status was empty, those tracked file bytes equal the recorded parent commit.
- Git tree object identities are repository-native Git object IDs. They are recorded in addition to, not substituted for, the SHA-256 manifest.
- No claim is made that the JPWB status digest hashes file content. The tracked manifest and clean selected worktree provide the relevant content binding.

---

## 2. Explicit implementation/configuration manifest scope

The 528-record tracked manifest was constructed from:

- `JanumiCode/janumiprofessionalworkbench/package.json`;
- `bun.lock`;
- `bunfig.toml`;
- `turbo.json`;
- root `tsconfig.json`;
- root `vitest.config.ts`;
- `eslint.config.mjs`;
- `.dependency-cruiser.cjs`;
- `sonar-project.properties`;
- `.prettierignore`;
- `.prettierrc`;
- `.gitignore`;
- `.github/**`;
- `packages/**`;
- `apps/**`;
- `scripts/**`; and
- `verif/**`.

The path set deliberately includes inventory-only and excluded code classes such as Playwright, static JavaScript, and harness material. Manifest membership permits classification; it does not make every member part of the compiler-supported semantic subject.

---

## 3. Generated SvelteKit context

The consumed app context is ignored by Git and therefore requires a separate identity:

| Field | Recorded value |
| --- | --- |
| Path | `apps/rph-demo/.svelte-kit/tsconfig.json` |
| Ignore evidence | JPWB `.gitignore:8` |
| Bytes | 1,010 |
| SHA-256 | `c01d35eee60b3cb21e230c392c72c947234d7f406b83959a042a63e09db454c4` |
| Last-write time, UTC | `2026-07-26T13:24:25.1297328Z` |
| Include evidence | Lines 30-45 include Vite configuration, app JS/TS/Svelte, and conventional test roots |
| Exclude evidence | Lines 47-55 exclude dependencies and service-worker variants |
| Freshness | Unproved |

`apps/rph-demo/tsconfig.json:1-13` extends this file. The preparation stream did not run `svelte-kit sync`; therefore the file supports a configured include-surface observation only.

---

## 4. Read-only execution boundary

The preparation used:

- Git revision, status, tracked-path, and tree-object inspection;
- manifest and lockfile inspection;
- TypeScript, JavaScript, Svelte, JSON, YAML, TOML, and configuration text inspection;
- read-only filesystem enumeration and file hashing;
- bounded lexical import and named-capability searches; and
- arithmetic classification of enumerated files and declared mutation entries.

It did not run:

- installation or dependency update;
- formatting or generation;
- build or SvelteKit sync;
- TypeScript or Svelte checking;
- ESLint;
- dependency-cruiser;
- Vitest artifact or source tests;
- V8 coverage;
- the mutation runner or its preflight;
- Playwright deterministic or live tests;
- Sonar;
- Semgrep, CodeQL, Joern, ts-morph, Tree-sitter, Stryker, or another external analyzer;
- live Pi or agy execution;
- network access;
- production trace collection; or
- any command intended to write caches, results, or derived artifacts.

A checked-in command or repository comment is configuration evidence only. A roadmap, comment, or prior result statement is a repository-recorded claim and is not represented as an independently repeated execution.

---

## 5. Workspace and project evidence

### 5.1 Workspace expansion

Root `package.json:2-9` declares a private ESM workspace with `packages/*` and `apps/*`.

Observed directories:

- ten RPH packages: application, assurance, authoring, contracts, domain, engine, persistence, ports, Product Realization PWA, and projections;
- one shared `typescript-config` package; and
- one `rph-demo` app.

Root runtime declarations are Bun `1.3.14` and Node `>=22` (`package.json:40-48`).

### 5.2 Project contexts

- `packages/typescript-config/base.json:4-22` configures strict NodeNext ES2022 TypeScript with declaration and source metadata.
- Each RPH package normal project includes `src` and emits to `dist`.
- Each build project excludes package tests and fixtures.
- Contracts, domain, engine, and Product Realization PWA build projects also exclude `src/gen/**`.
- Root `tsconfig.json:1-8` contains empty `include` and `files`.
- App `tsconfig.json:1-13` extends the generated context and enables JS checking, strictness, and bundler resolution.

The evidence therefore supports package project contexts, a partial/freshness-qualified app context, and an inventory-only root verification/mutation/Playwright perimeter.

---

## 6. File-classification counts

Read-only filesystem enumeration produced:

| Artifact class | Count |
| --- | ---: |
| Package TypeScript under `packages/*/src` | 243 |
| Package `*.test.ts` | 141 |
| Package fixtures under `__tests__` | 4 |
| Total package test-classified TypeScript | 145 |
| Package generator TypeScript under `src/gen` | 6 |
| Projected package build TypeScript | 92 |
| Checked-in generated TypeScript outputs | 5 |
| Contract vocabulary JSON inputs | 3 |
| Generated JSON schemas | 107 |
| App TypeScript under `src` | 57 |
| App unit tests included in the TypeScript count | 19 |
| App JavaScript under `src` | 0 |
| App Svelte under `src` | 11 |
| Deterministic Playwright `*.e2e.ts` files | 28 |
| Live Playwright `*.live.ts` files | 2 |
| Root `verif/*.test.ts` files | 3 |

The projected build count is `243 - 145 - 6 = 92`. It is a file classification based on build exclusions, not the result of invoking a compiler.

The five generated TypeScript outputs are:

- `packages/rph-contracts/src/enums.ts`;
- `packages/rph-contracts/src/messages.ts`;
- `packages/rph-contracts/src/objects.ts`;
- `packages/rph-domain/src/transitions.data.ts`; and
- `packages/rph-product-realization-pwa/src/ontology.data.ts`.

---

## 7. Dependency evidence and method limit

### 7.1 Declared workspace graph

Manifests establish these runtime workspace edges:

- application to assurance, contracts, domain, ports, projections;
- assurance to contracts, domain, ports;
- authoring to contracts, engine;
- domain to contracts;
- engine to application, assurance, contracts, domain, persistence, ports, projections;
- persistence to contracts, ports;
- ports to contracts;
- Product Realization PWA to contracts;
- projections to contracts, domain, ports; and
- app to authoring, engine, Product Realization PWA, projections.

Contracts has no runtime workspace dependency. Development-only dependencies were not collapsed into this graph.

### 7.2 Source-import observation

The lexical import scan:

- selected TypeScript under `packages/rph-*/src`;
- excluded `*.test.ts`;
- excluded `__tests__/**`;
- excluded `src/gen/**`; and
- observed static or dynamic module specifiers beginning `@janumipwb/rph-`.

No source-observed workspace edge lacked a declaring runtime manifest edge.

No non-test/non-generator runtime import was observed for:

- assurance to domain;
- assurance to ports;
- engine to domain; or
- projections to ports.

This was not a TypeScript Program, symbol, path-condition, or runtime-resolution analysis. It does not prove semantic reachability, type-only use, framework loading, or safe dependency removal.

### 7.3 Architecture-rule configuration

`.dependency-cruiser.cjs:7-76` configures cycles, resolution, foundation/purity, browser-safety, and no-core-to-app rules. Root `package.json:18` supplies `packages` as the command subject.

The preparation did not execute dependency-cruiser. No pass, violation, exception, or gate result was generated.

---

## 8. Tool and command evidence

### 8.1 Root commands

`package.json:10-24` configures:

- build;
- type-check;
- ESLint;
- Turborepo tests;
- generation;
- Prettier write/check;
- dependency-cruiser;
- source-resolution Vitest;
- V8 coverage;
- mutation and mutation preflight; and
- fast/full composite gates.

`turbo.json:4-25` records dependency-build ordering, build outputs, test/type prerequisites, uncached generation, and persistent uncached development.

All commands were unexecuted by this preparation.

### 8.2 Artifact/source test distinction

`vitest.config.ts:24-35` documents artifact-oriented package tests and separate source-oriented root tests. Source aliasing and project selection are at `vitest.config.ts:53-102`.

Root self-check files inspect source resolution, mutation-ledger coherence, and reviewable text. Their existence is not a current pass claim.

### 8.3 Coverage configuration

`vitest.config.ts:103-120,138-145` records:

- V8 provider;
- source resolution;
- package-only source include;
- test, fixture, generator, selected generated, declaration, and barrel exclusions;
- text, JSON-summary, and HTML reports;
- `coverage` output;
- global thresholds of 94.5 statements, 82.5 branches, 95.5 functions, and 96.5 lines; and
- automatic threshold update disabled.

No app coverage, per-file threshold, LCOV reporter, or Sonar coverage-ingestion property was found. Generated PWA `ontology.data.ts` is not explicitly excluded.

No coverage command was executed. Existing ignored coverage output was not treated as evidence.

### 8.4 Mutation configuration

Static ledger-field counting found:

- 96 entries;
- 10 duplicates;
- 4 retired/superseded;
- 2 expected compile-prevention entries; and
- 2 expected-survive controls.

The resulting distinct non-retired/non-duplicate population is 82. The runner's own denominator logic is at `scripts/mutants/run.ts:386-391`.

Preflight is expressly non-measurement (`run.ts:40-50`). The runner writes a journal and temporary source mutation, restores in `finally`, and has crash recovery (`run.ts:230-313`). It was not run.

### 8.5 CI and static-analysis configuration

CI runs frozen install, build, type, ESLint, dependency boundary, format check, and Turborepo test (`.github/workflows/ci.yml:1-30`).

No CI invocation was found for source-mode root tests, coverage, mutation, app check, E2E, live E2E, or Sonar.

Sonar configuration exists at `sonar-project.properties:1-12`; no checked-in runner command or workflow step was found.

Named dependency/configuration/source searches found no current ts-morph, Semgrep, CodeQL, Joern, Tree-sitter, Stryker, TypeScript Compiler API consumer, or code-property-graph implementation in the inspected subject. The only Stryker occurrence was ledger commentary describing it as a future, out-of-scope successor.

---

## 9. Contract and generation evidence

The contracts workspace declares generators in `packages/rph-contracts/package.json:24-36`.

Generator evidence:

- enum generation and paths: `src/gen/gen-enums.ts:1-5,21-24,61-78`;
- object generation and inputs: `src/gen/gen-objects.ts:1-23,46-55`;
- message generation and fallback: `src/gen/gen-messages.ts:1-5,42-66`;
- Draft-2020-12 schema emission: `src/gen/emit.ts:1-2,21-60`;
- domain transition generation: `packages/rph-domain/src/gen/gen-transitions.ts:1-12,40-45`; and
- PWA ontology generation: `packages/rph-product-realization-pwa/src/gen/gen-ontology.ts:1-43`.

Static inspection found:

- 24 `z.record(z.string(), z.unknown())` helper schemas in `packages/rph-contracts/src/objects.ts:65-111`;
- 161 `UNRATIFIED-AUTHORED` occurrences in `vocab/m3-commands-events.json`;
- unknown-enum fallback to string in message generation;
- selective event validation at `packages/rph-application/src/handlers/kit.ts:281-328`; and
- unknown trace-relation acceptance at `packages/rph-domain/src/traceability.ts:99-106`.

Generation was not run. Generated source freshness was not independently established beyond clean tracked identity at the parent commit.

---

## 10. Entry-point, dynamic-seam, and observability evidence

### 10.1 Entry points

Package export maps expose source and dist conditions; contracts adds `./hash`, and authoring adds `./catalog`.

The engine public seam is defined at `packages/rph-engine/src/engine.ts:86-164`.

SvelteKit routes expose page loads/actions, test-only reset/dispatch/introspection endpoints, and the PWA authoring SSE endpoint. The SSE handler is at `apps/rph-demo/src/routes/pwa/[id]/agent/+server.ts:279-400`.

### 10.2 Dynamic and external seams

- Stately/ELK/xyflow layout uses dynamic imports with Dagre fallback (`apps/rph-demo/src/lib/pwaFlow.ts:290-337`).
- Pi is dynamically imported only for live agent mode (`apps/rph-demo/src/lib/server/agent/index.ts:1-33`).
- Vite resolves ELK and externalizes better-sqlite3 (`apps/rph-demo/vite.config.ts:1-28`).
- agy is invoked as an external executable with explicit argument, timeout, and buffer limits (`apps/rph-demo/src/lib/server/assurance/agy-cli.ts:1-55`).

No live or external seam was invoked.

### 10.3 Observability

The Logger contract and defaults are at:

- `packages/rph-ports/src/ports/logger.ts:1-33`; and
- `packages/rph-ports/src/defaults/logger.ts:27-73`.

Provenance, correlation, and causation are in `packages/rph-contracts/src/envelopes.ts:34-110`.

Current state, versions, events, outbox, and receipts are in `packages/rph-persistence/src/schema.ts:1-74`.

The rebuildable traceability projection is at `packages/rph-projections/src/traceability-view.ts:1-93`.

No authored OTel pipeline, metrics backend, production trace ingestion, or revision-bound runtime-trace corpus was found. Playwright trace configuration and ignored outputs were not treated as executed traces.

---

## 11. Representative source-grounded paths

### 11.1 Success

The inspected path is:

1. app command envelope and dispatch (`apps/rph-demo/src/lib/server/workbench.ts:110-168`);
2. command ingress, idempotency, validation, and handler selection (`packages/rph-application/src/command-bus.ts:84-160`);
3. produced-state/event validation and commit assembly (`packages/rph-application/src/handlers/kit.ts:250-350`);
4. atomic revision/state/version/event/outbox/receipt persistence (`packages/rph-persistence/src/sqlite-storage-adapter.ts:114-215`);
5. accepted result (`handlers/kit.ts:350-376`); and
6. outbox delivery (`command-bus.ts:255-277`).

### 11.2 Failure

The inspected paths include:

- ontology construction failure (`packages/rph-engine/src/engine.ts:127-139`);
- unknown command, invalid payload, and missing handler (`packages/rph-application/src/command-bus.ts:118-152`);
- atomic batch abort (`command-bus.ts:163-187`);
- revision conflict (`packages/rph-application/src/handlers/kit.ts:349-365`);
- explicit layout fallback (`apps/rph-demo/src/lib/pwaFlow.ts:334-336`); and
- staged authoring-turn cleanup and SSE closure (`apps/rph-demo/src/routes/pwa/[id]/agent/+server.ts:370-390`).

These are source narratives. No captured execution path was produced.

---

## 12. Conclusion-bearing observations

The preparation supports the following high-confidence conclusions:

- the explicit tracked implementation/configuration scope was clean at the recorded parent commit;
- the workspace contains ten RPH packages, one shared config package, and one app;
- root TypeScript configuration is not a compiler project;
- app project context depends on an ignored generated file with unproved freshness;
- artifact and source test modes are separately configured;
- root coverage is source-mode, package-only, global-threshold V8 coverage;
- deterministic and live Playwright are separate;
- mutation is a bounded declared-ledger instrument and was not run;
- Sonar is configuration-only in the checked-in subject;
- CI is narrower than the composite gates;
- current contracts include material permissive/unratified regions;
- current runtime offers event/log/projection trace sources but no production trace-ingestion capability; and
- no current CSAA semantic graph or formal CSAA finding/gate implementation was found.

Medium-confidence conclusions are limited to bounded lexical import, reflection, and named-capability absence observations.

No formal Analyzer Finding Record was created. `JAN-CSAA-004` and `JAN-CSAA-007`, which would own finding semantics and shape, are reserved and uncommissioned.

---

## 13. Freshness and invalidation

This evidence is valid only for the recorded parent commit, selected clean implementation/configuration worktree, manifest membership/digest, and generated-context bytes.

It requires re-observation if:

- `HEAD` changes;
- any selected tracked path changes;
- the generated SvelteKit configuration changes;
- a workspace, dependency, project, command, rule, test, coverage, mutation, generated-contract, entry-point, or trace surface changes;
- a previously excluded region becomes supported;
- a live/external execution is to be claimed; or
- an open observation is adjudicated.

Before Proposed promotion, the reviewer SHALL require a fresh revision/worktree/configuration observation and compare conclusion-bearing fields. This Draft's authoring timestamp is not freshness proof.

---

## 14. Evidence disposition

This record is sufficient preparation evidence for authoring and reviewing `JAN-CSAA-005@0.1.0` as a non-authoritative Draft.

It is not evidence that:

- the repository builds;
- compiler, lint, dependency, test, coverage, mutation, E2E, or Sonar gates pass;
- generated source is freshly regenerated;
- ignored output is current;
- live Pi or agy is healthy;
- security vulnerabilities are absent;
- the current implementation conforms to every intended architecture claim;
- any observed tool is qualified for CSAA;
- a CSAA analyzer or contract package exists; or
- implementation, gate, provider, topology, persistence, or later-wave work is authorized.

No file other than the controlled `JAN-CSAA-005` Draft and this evidence companion was authorized for creation by this authoring subtask.
