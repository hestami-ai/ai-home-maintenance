# JPWB Repository-Specific Code Analysis Implementation Design

## An implementation-ready design for the Codebase Semantic Analysis and Assurance tool

**Document ID:** `JAN-CSAA-W4-DESIGN-001`

**Version:** `0.1.0`

**Status:** Draft

**Date:** 2026-08-10

**Role:** Normative, prescriptive implementation design for building the first JPWB Codebase Semantic Analysis and Assurance implementation

**Scope:** Repository placement, module boundaries, subject identity, TypeScript semantic extraction, graph construction, query and finding services, provider adapters, generated inventory, coding-agent interface, persistence trajectory, security, verification, and implementation exit conditions

**Inputs:** `JAN-CSAA-001` through `JAN-CSAA-011`, the current JPWB repository, and the 75 confirmed findings in `docs/_working/HARMONIZATION-FINDINGS.md`

**Normative keywords:** SHALL, SHALL NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as requirement terms. Each numbered `W4D-REQ-*` statement is independently testable.

**Implementation posture:** This design authorizes no sponsor ceremony, archive, evidence package, or intermediate decision record. Implementation may proceed incrementally under ordinary repository review. Sponsor review is reserved for the completed integrated corpus and implementation unless a genuine architecture conflict requires a decision.

---

## 1. Intended result

JPWB needs a local engineering instrument that lets a coding agent ask questions about the implementation and receive reproducible, source-cited answers instead of relying on text search, memory, or a model's inference alone. The instrument is the **CSAA tool**.

The first useful CSAA implementation is not a universal code-analysis platform. It is a private JPWB development package that:

1. resolves the exact repository subject being analyzed;
2. builds a compiler-semantic model of the JPWB TypeScript workspaces;
3. normalizes facts from the TypeScript compiler and existing repository tools;
4. constructs the dependency, symbol-reference, call, state-machine, test, and selected data-flow projections needed by JPWB rules;
5. evaluates versioned rules and four-valued semantic queries;
6. reports findings, uncertainty, provenance, and change impact through a deterministic JSON interface; and
7. generates a current, reproducible `JAN-CSAA-005` repository inventory as its first delivered increment.

The implementation remains subordinate to the repository it analyzes. Source code and effective configuration are the source of truth for what is implemented. Governing documents are the source of truth for obligations. A difference between those sources is a reportable relation; it is not permission for the analyzer to rewrite either source.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-001` | CSAA SHALL identify an exact subject before emitting any semantic conclusion. |
| `W4D-REQ-002` | Every conclusion SHALL identify the facts, provider invocations, rule or query version, completeness state, and source locations that support it. |
| `W4D-REQ-003` | Absence of evidence SHALL NOT be represented as evidence of absence unless the analyzed population and capability coverage are both demonstrably complete for the conclusion. |
| `W4D-REQ-004` | CSAA SHALL preserve implementation facts, normative obligations, analyzer conclusions, and human dispositions as distinct record classes. |
| `W4D-REQ-005` | The first implementation SHALL optimize for useful local and coding-agent operation; distributed services, organization-wide indexing, and heavyweight graph infrastructure SHALL remain deferred until measured need justifies them. |

---

## 2. Current JPWB implementation basis

This design is intentionally repository-specific. The following facts were rechecked in the working repository during authoring:

| Surface | Current implementation fact | Design consequence |
| --- | --- | --- |
| Workspace | Private ESM Bun workspace with `packages/*` and `apps/*`; Turborepo coordinates workspace tasks | CSAA is another private workspace package and follows existing build conventions |
| Runtime | Node.js `>=22`; Bun package manager `1.3.14` | The development CLI runs under Bun but SHALL use Node-compatible TypeScript APIs where practical |
| Compiler | `typescript@5.9.3` resolved in `bun.lock` | The TypeScript Compiler API is available without adding `ts-morph` |
| Architecture | `.dependency-cruiser.cjs`; `dependency-cruiser@16.10.4` resolved | Existing dependency facts and boundary results can be adapted rather than reimplemented immediately |
| Static quality | ESLint 9 with `typescript-eslint` | ESLint results can enter through a loss-declaring adapter |
| Tests | Vitest source and built-artifact modes, plus Playwright for the app | Test identity, source/artifact mode, coverage, and runtime evidence remain separate inputs |
| Coverage | V8 coverage through Vitest | CSAA ingests coverage only from an identified execution; an old `coverage/` directory is not current evidence |
| Persistence | `better-sqlite3@12.11.1` is already resolved for `rph-persistence` | A later local CSAA index may use SQLite without coupling CSAA to the RPH persistence package |
| Existing analyzer precedent | `verif/arrow-command-census.ts` uses `ts.createSourceFile`; its tests and baseline participate in the normal verification surface | CSAA SHALL reuse the same fail-closed population, deterministic ordering, and anti-vacuity style |
| Generated-spec precedent | `scripts/spec-obligations.ts` derives and checks specification obligations | Generated `JAN-CSAA-005` inventory follows a generator plus `--check` pattern |
| Product packages | Eleven package directories: ten `rph-*` packages plus `typescript-config`; one `rph-demo` app | The initial subject resolver covers all workspaces and the root `scripts/` and `verif/` TypeScript contexts |

The present verification tree contains a changing, filesystem-discoverable population of top-level TypeScript assets, including whole-repository censuses, contract checks, mutation controls, and anti-vacuity checks. These files are not merely inspiration. Every asset discovered for the frozen subject is an implementation input to CSAA and requires a disposition. `arrow-command-census.ts`, `binding-row-truth.ts`, `trigger-claim-truth.ts`, `guard-enforcement-ledger.ts`, `canon-provenance.ts`, `emitted-event-guard.ts`, their tests, and their baselines already implement partial CSAA capabilities against live JPWB source. CSAA SHALL extract, wrap, and generalize those proven capabilities incrementally behind the shared subject and semantic contracts. It SHALL NOT build a disconnected duplicate analyzer while the existing instruments continue to answer the same question through different parsing, population, or truth rules.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-006` | Implementation SHALL consume the versions resolved by `bun.lock`; it SHALL NOT silently use a globally installed compiler or analyzer. |
| `W4D-REQ-007` | Existing verified analyzers SHALL be migrated or wrapped incrementally. A wholesale rewrite is not a prerequisite for the first usable release. |
| `W4D-REQ-008` | The CSAA package SHALL participate in root type-check, lint, build, source-test, and built-artifact-test discovery before it is considered usable. |
| `W4D-REQ-009` | Adding CSAA SHALL NOT weaken `passWithNoTests: false`, source-versus-artifact resolution checks, coverage ratchets, mutation controls, or existing package boundaries. |
| `W4D-REQ-073` | The implementation SHALL maintain an explicit migration map from each current `verif` analyzer, baseline, and test to the CSAA capability, rule, or retained standalone control that owns its future. |
| `W4D-REQ-074` | When an existing analyzer and CSAA need the same AST, symbol, population, or graph fact, they SHALL converge on the CSAA extraction primitive or an equivalently shared library rather than maintain independent parsers. |
| `W4D-REQ-075` | An existing analyzer SHALL be removed only after side-by-side fixture and live-repository tests prove equal or stronger detection, population coverage, provenance, and failure visibility in its CSAA replacement. |

---

## 3. Binding implementation decisions

| Decision ID | Decision | Consequence |
| --- | --- | --- |
| `W4D-DEC-001` | Create one private workspace package at `packages/csaa`, named `@janumipwb/csaa`. | The first release has one deployable unit and internal modules, not a premature family of packages. |
| `W4D-DEC-002` | Use the TypeScript Compiler API as the primary semantic provider. | AST, symbol, type, project, resolution, diagnostic, and reference facts share one exact `Program`/`TypeChecker` context. |
| `W4D-DEC-003` | Use the existing dependency-cruiser, ESLint, Vitest/V8, and Playwright surfaces through explicit adapters. | CSAA preserves provider-native evidence while avoiding duplicate implementations. |
| `W4D-DEC-004` | Expose a versioned command-line JSON protocol first. | Coding agents and CI can use CSAA without a daemon, UI, or MCP server. |
| `W4D-DEC-005` | Make deterministic generation of the current `JAN-CSAA-005` inventory the first increment. | The tool proves subject resolution, configuration discovery, provenance, stable serialization, and non-vacuity before deeper graph work. |
| `W4D-DEC-006` | Run full analysis in memory initially; add a rebuildable local SQLite index only after semantic equivalence is tested. | Persistence cannot delay the first useful analyzer. |
| `W4D-DEC-007` | Keep the analyzer outside the product runtime dependency graph. | No RPH package or app may depend on CSAA, directly or transitively. |
| `W4D-DEC-008` | Treat Joern, CodeQL, Semgrep, and other external providers as later bounded integrations. | They are added only for a demonstrated capability gap and after provider qualification; they are not prerequisites. |
| `W4D-DEC-009` | Use deterministic, content-derived identities and canonical ordering. | Repeated analysis of the same subject produces byte-identical generated inventory and semantically identical snapshots. |
| `W4D-DEC-010` | Keep analyzer results epistemically explicit. | `unknown`, `conflict`, `not-applicable`, `partial`, and provider failure cannot be collapsed into pass. |
| `W4D-DEC-011` | Make the 75 confirmed harmonization findings an implementation benchmark. | The tool is measured against failures that occurred in this repository, not only synthetic examples. |
| `W4D-DEC-012` | Reserve manual review for judgments the semantic model cannot make. | The implementation automates collection and contradiction detection while leaving genuine normative ambiguity with a human. |

---

## 4. Package placement and dependency boundary

### 4.1 Required package shape

The first implementation SHALL use this shape. Filenames may be divided further without changing the owned responsibilities.

```text
packages/csaa/
  package.json
  tsconfig.json
  tsconfig.build.json
  src/
    index.ts
    cli/
      main.ts
      protocol.ts
    contracts/
      ids.ts
      records.ts
      diagnostics.ts
      schemas.ts
    subject/
      resolve-subject.ts
      file-manifest.ts
      project-discovery.ts
    inventory/
      collect-inventory.ts
      render-inventory.ts
      check-inventory.ts
    providers/
      provider.ts
      typescript/
      dependency-cruiser/
      eslint/
      vitest/
      coverage/
      playwright/
    semantic/
      normalize.ts
      snapshot.ts
      graph.ts
      indexes.ts
    query/
      ast.ts
      truth.ts
      evaluate.ts
      explain.ts
    rules/
      profiles.ts
      evaluate.ts
      findings.ts
      jpwb/
    impact/
      compare.ts
      slice.ts
      propagate.ts
    persistence/
      store.ts
      memory-store.ts
      sqlite-store.ts
```

`sqlite-store.ts` MAY be absent until the persistence increment. Public exports SHALL be deliberately small: protocol types, provider contracts, snapshot/query contracts, and a programmatic `analyze` entry point. Compiler objects, database handles, and provider-native mutable objects SHALL NOT cross the package boundary.

### 4.2 Dependency direction

```text
root CLI / CI / coding agent
             |
             v
      @janumipwb/csaa
        |     |     \
        v     v      v
 TypeScript  existing  optional later
 Compiler    tool      qualified providers
 API         adapters

packages/rph-* and apps/rph-demo  -X->  @janumipwb/csaa
```

The dependency-cruiser configuration SHALL gain a rule equivalent to:

```text
from: ^(packages/rph-|apps/)
to:   ^packages/csaa/
severity: error
```

The executing boundary command SHALL analyze both `packages` and `apps`; adding a rule to configuration while continuing to cruise only `packages` is not enforcement of the app-side prohibition. The first increment SHALL either expand the root boundary command to `depcruise packages apps --config .dependency-cruiser.cjs` or add an equivalently gate-wired focused command. A non-vacuity fixture that introduces one `rph-*` import and one app import of `@janumipwb/csaa` SHALL make that check fail.

CSAA reads and models product packages as files and compiler inputs. It SHALL NOT import product package entry points merely to discover their contents, because doing so executes module initialization and confuses static analysis with runtime observation. A purpose-built runtime probe MAY import a subject only when the operation explicitly declares runtime execution and captures that provenance.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-010` | `packages/csaa/package.json` SHALL declare `private: true`, `type: module`, a workspace-local version, and the same licensing posture as the repository unless the repository owner explicitly changes it. |
| `W4D-REQ-011` | Product packages and apps SHALL NOT import CSAA or expose CSAA types in their public contracts. |
| `W4D-REQ-012` | CSAA MAY depend on tool libraries and Node/Bun platform APIs; it SHOULD NOT depend on an `rph-*` runtime package. |
| `W4D-REQ-013` | Provider-specific data SHALL be normalized behind a provider contract before query or rule evaluation consumes it. |
| `W4D-REQ-014` | A provider adapter SHALL declare capability, version, configuration identity, subject coverage, execution state, losses introduced by normalization, and diagnostics. |
| `W4D-REQ-076` | The enforced dependency-boundary path SHALL analyze both `packages` and `apps` and SHALL include a non-vacuity control proving that imports of CSAA from either product perimeter fail. |

---

## 5. Subject identity and deterministic intake

### 5.1 Subject forms

CSAA SHALL support two local subject forms:

- **working-tree subject**: current file bytes within an explicit repository perimeter, including tracked modifications and selected untracked source/configuration files;
- **revision subject**: files materialized from a specified Git commit or tree without silently mixing working-tree bytes.

The first increment needs the working-tree form. Revision comparison may follow when impact analysis is implemented.

A `SubjectDescriptor` SHALL contain at least:

```ts
interface SubjectDescriptor {
  schemaVersion: string;
  subjectId: string;
  repositoryRoot: string;       // normalized, repository-relative in persisted output
  subjectKind: 'WORKTREE' | 'REVISION';
  revision?: string;
  parentRevision?: string;
  perimeter: readonly string[];
  fileManifestDigest: string;
  configurationDigest: string;
  dirtyState: 'CLEAN' | 'DIRTY' | 'NOT_APPLICABLE' | 'UNKNOWN';
  excludedClasses: readonly ExclusionRecord[];
}
```

Absolute machine-specific paths SHALL NOT participate in content identities or committed generated output. Input paths SHALL be resolved against the real repository root, normalized to `/`, checked for escape through `..` or symlinks, and serialized repository-relative.

`subjectId` SHALL be the lowercase SHA-256 of the UTF-8 bytes formed by the ASCII domain separator `JAN-CSAA-SUBJECT\0`, the subject-identity algorithm version `1\0`, and canonical JSON containing exactly `schemaVersion`, `subjectKind`, `revision` or `null`, `parentRevision` or `null`, the canonically ordered perimeter, `fileManifestDigest`, `configurationDigest`, and the canonically ordered exclusion-policy identities. `fileManifestDigest` SHALL itself bind the ordered repository-relative path, byte count, content SHA-256, and artifact class of every selected input. `dirtyState`, observation times, absolute paths, and generated outputs are descriptive metadata and SHALL NOT enter either digest.

### 5.2 Population discovery

The resolver SHALL derive populations, not depend on lists that silently rot:

1. workspace patterns come from root `package.json`;
2. workspace members come from directory expansion and each member's manifest;
3. TypeScript project contexts come from root, package, app, `verif`, and `scripts` `tsconfig` files;
4. compiler roots and exclusions come from parsed TypeScript configuration;
5. package export surfaces come from package manifests;
6. test populations come from discovered projects and configured globs; and
7. generated, ignored, build, cache, fixture, and test artifacts remain classified even when excluded from semantic analysis.

Default exclusions include `node_modules`, `dist`, `.turbo`, `coverage`, `.svelte-kit`, and CSAA's own local cache. Exclusion is not erasure: the inventory records the class, rule, and count so a zero-sized analyzed population cannot appear complete.

For the generated-inventory operation, the `JAN-CSAA-005` target, its canonical JSON baseline, temporary replacement files, and any rendered projection SHALL be output identities, never members of the selected-file preimage. Their paths and post-generation digests remain reportable outside `SubjectDescriptor`. This exclusion is fixed by generator version rather than Git status, so `--write` followed immediately by `--check` converges even in a dirty working tree.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-015` | Every operation SHALL freeze one immutable subject descriptor before provider execution begins. |
| `W4D-REQ-016` | A provider result whose observed bytes no longer match the frozen subject SHALL be stale or failed, never current. |
| `W4D-REQ-017` | Population discovery SHALL be filesystem/configuration-derived wherever an authoritative repository source exists. |
| `W4D-REQ-018` | Every population-based conclusion SHALL report discovered, included, excluded, successfully analyzed, and failed counts. |
| `W4D-REQ-019` | Zero discovered or zero analyzed subjects SHALL fail a completeness-dependent operation unless zero is explicitly expected and proven by the request. |
| `W4D-REQ-077` | Subject identity SHALL use the domain-separated canonical preimage defined in §5.1 and SHALL NOT depend on machine paths, wall-clock values, process identity, or Git cleanliness. |
| `W4D-REQ-078` | Generated inventory targets and temporary replacements SHALL be excluded from their own selected-file preimage while remaining explicitly identified as generated outputs. |

---

## 6. First increment: generated current `JAN-CSAA-005` inventory

The first implementation increment SHALL turn the repository inventory from a manually re-authored observation into a deterministic product of repository bytes.

### 6.1 Controlled successor and artifact split

The current `JAN-CSAA-005@0.3.1` is historical-only and SHALL NOT be silently relabeled as a current shell. The first increment SHALL create `JAN-CSAA-005@0.4.0 / Draft` as an explicit controlled successor. Its stable human-authored clauses distinguish the retained historical observation body from one uniquely delimited generated-current region and define the currentness rule for that region. No archive, sponsor packet, or intermediate lifecycle record is required; repository history retains predecessor recovery.

The generator SHALL render two views from one in-memory model:

```text
verif/csaa/jan-csaa-005.inventory.baseline.json
JAN-CSAA-005@0.4.0 uniquely marked generated-current Markdown region
```

The JSON baseline is the canonical machine-readable current inventory for its exact `subjectId`. The marked Markdown region is its deterministic human projection. Stable prose outside the markers owns method, interpretation, limitations, and historical context; legacy hand-authored repository counts remain explicitly historical and SHALL NOT override the generated region. If the two generated views disagree, are stale, or fail reproduction, neither is current. These are product artifacts, not lifecycle records or evidence-package scaffolding. Wall-clock time, absolute paths, process IDs, temporary directories, Git dirty state, and nondeterministically ordered diagnostics SHALL NOT enter their bytes.

The first root scripts SHOULD be:

```json
{
  "csaa:inventory": "bun run scripts/csaa-inventory.ts --write",
  "csaa:inventory:check": "bun run scripts/csaa-inventory.ts --check"
}
```

The general `csaa` command and its versioned operation router arrive with the CLI increment; the inventory entry point remains a thin caller of the same package application function and is not a second implementation.

### 6.2 Required inventory content

The generated model SHALL include:

- repository/worktree subject identity and perimeter;
- workspace and package manifests, names, paths, private/public state, exports, scripts, and dependency declarations;
- TypeScript projects, inheritance, compiler options affecting semantics, roots, and diagnostics state;
- source, test, generated, configuration, build, cache, and excluded artifact counts;
- root and workspace commands for build, type-check, lint, boundary, generation, tests, coverage, mutation, framework checks, and E2E;
- configured provider names and exact lockfile versions;
- dependency-cruiser rule identities and analyzed perimeter;
- Vitest source/artifact project populations and `passWithNoTests` setting;
- coverage provider, include/exclude population, thresholds, and output identity when explicitly ingested;
- existing repository-specific analyzers in `verif/` and `scripts/`;
- missing CSAA capability states expressed as `UNIMPLEMENTED`, `NOT_CONFIGURED`, `NOT_RUN`, `PARTIAL`, or `UNKNOWN`, never as prose-only omission; and
- provenance from every rendered row back to the files and fields from which it was derived.

### 6.3 Determinism and check mode

`inventory --write` is the only normal CSAA operation allowed to mutate these generated files. `inventory --check` SHALL recompute both outputs in memory and compare exact bytes. It SHALL report a structured diff summary and return a non-success verification result when committed output is stale. It SHALL NOT rewrite in check mode.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-020` | The canonical JSON baseline and marked Markdown region SHALL be rendered from the same typed model in one invocation. |
| `W4D-REQ-021` | Two runs over identical subject bytes and tool versions SHALL produce byte-identical output. |
| `W4D-REQ-022` | Generated arrays and maps SHALL use documented canonical sort keys and duplicate rejection. |
| `W4D-REQ-023` | `--check` SHALL fail on missing, stale, malformed, or noncanonical output and SHALL perform no write. |
| `W4D-REQ-024` | A fixture mutation to a manifest, `tsconfig`, tool configuration, workspace population, or analyzer script SHALL change the corresponding inventory fact. |
| `W4D-REQ-025` | The first increment SHALL include anti-vacuity tests proving that all current workspaces, the `verif` context, the `scripts` context, and the known root assurance commands are discovered. |
| `W4D-REQ-026` | Inventory generation SHALL run without a clean Git worktree and SHALL bind the actual selected file bytes rather than refusing ordinary in-progress development. |
| `W4D-REQ-079` | The generated inventory SHALL first publish through an explicit `JAN-CSAA-005@0.4.0` successor whose current generated region and canonical JSON baseline take precedence over retained historical counts only when exact-byte check mode succeeds for their bound subject. |

---

## 7. TypeScript semantic provider

### 7.1 Compiler context

The primary provider SHALL use the exact repository TypeScript version and public Compiler API. For each discovered TypeScript project it SHALL:

1. read and parse configuration through TypeScript configuration APIs;
2. preserve configuration diagnostics;
3. create a `Program` for the frozen file set;
4. obtain the associated `TypeChecker`;
5. record source-file origin and project membership;
6. extract syntax, declarations, symbols, aliases, types, signatures, references, module resolution, and diagnostics; and
7. normalize those facts without retaining mutable compiler nodes in persisted records.

`ts-morph` SHALL NOT be introduced in the first implementation. It would add a second abstraction and identity layer before the native Compiler API has demonstrated a limitation. A later proposal MAY add it only for a measured implementation benefit while retaining Compiler API identity and conformance tests.

### 7.2 Stable identity

Compiler node object identity is process-local and SHALL NOT be serialized. Normalized record identity SHALL be derived from:

```text
subject-id + project-id + repository-relative file + syntax kind + start + end + semantic discriminator
```

Symbol identity SHALL distinguish declarations, aliases, merged symbols, overload signatures, ambient declarations, generated declarations, and unresolved references. Types SHALL use structural/provider fingerprints plus displayed forms; displayed text alone is not identity.

### 7.3 Extraction layers

The provider SHALL expose capability layers so an operation can request only what it needs:

| Layer | Initial facts |
| --- | --- |
| `TS_PROJECT` | configuration graph, roots, options, project references, diagnostics |
| `TS_SYNTAX` | files, AST nodes needed by rules, declarations, literals, call sites, assignments |
| `TS_SYMBOL` | scopes, declarations, references, aliases, imports/exports, resolution |
| `TS_TYPE` | types, signatures, assignability judgments requested by rules, generic instantiations |
| `TS_CALL` | statically resolvable call targets, candidate targets, unresolved/dynamic sites |
| `TS_FLOW` | compiler control-flow facts available through supported APIs plus CSAA's normalized basic-block/data-flow projection |

| ID | Requirement |
| --- | --- |
| `W4D-REQ-027` | The provider SHALL preserve parse, configuration, resolution, and type diagnostics as data and SHALL NOT silently drop a file that failed analysis. |
| `W4D-REQ-028` | Every normalized fact SHALL cite its provider, subject, project, source span, extraction version, and confidence/completeness state. |
| `W4D-REQ-029` | An unresolved call, symbol, module, or dynamic access SHALL be represented explicitly; it SHALL NOT be omitted and later interpreted as no edge. |
| `W4D-REQ-030` | Generated and transformed sources SHALL carry source-origin and mapping state distinct from authored source. |
| `W4D-REQ-031` | Provider unit tests SHALL use real compiler programs and fixture projects, not mocks of the TypeChecker. |

---

## 8. Semantic graph and indexes

### 8.1 Normalized graph

CSAA SHALL expose one logical semantic snapshot with typed nodes and edges. Physical storage may use maps initially and SQLite later; query meaning SHALL not depend on storage choice.

Initial node families are:

- repository, workspace, package, TypeScript project, and file;
- declaration, symbol, type, signature, parameter, function, class, interface, and property;
- import/export, call site, assignment, return, branch, and basic block;
- test file, suite, case, fixture, command, state machine, state, transition, guard, handler, schema, generated registry, and configuration rule;
- rule profile, rule application, finding, provider invocation, diagnostic, coverage region, and runtime observation.

Initial edge families are:

- `CONTAINS`, `MEMBER_OF_PROJECT`, `DECLARES`, `REFERENCES`, `ALIASES`, `IMPORTS`, `EXPORTS`, `RESOLVES_TO`;
- `TYPE_OF`, `RETURNS`, `ACCEPTS`, `IMPLEMENTS`, `EXTENDS`, `OVERRIDES`;
- `CALLS`, `MAY_CALL`, `READS`, `WRITES`, `FLOWS_TO`, `CONTROLS`, `REACHES`;
- `DEPENDS_ON`, `GENERATED_FROM`, `CONFIGURED_BY`, `HANDLES`, `EMITS`, `VALIDATES`;
- `TESTS`, `COVERS`, `OBSERVED_AT_RUNTIME`, `CONTRADICTS`, and `SUPPORTS`.

Each edge SHALL state whether it is direct, inferred, conservative, provider-native, or runtime-observed. A conservative `MAY_CALL` edge is not a proven `CALLS` edge.

### 8.2 JPWB-specific enrichers

Repository-specific enrichers SHALL build on normalized compiler facts rather than parse the same source independently. The first enrichers SHOULD cover:

- command registry to handler implementation;
- command payload schema to handler reads;
- handler to emitted-event schema and persisted aggregate fields;
- state-machine transition to command, guard, and writer sites;
- declared identifier prefixes to schema validators and generated payload fields;
- normative or generated catalog entries to production consumers and tests;
- gate predicates to their callers and actual arguments;
- test/property/mutant registries to executable test populations; and
- package boundary rules to compiler-resolved dependencies.

These enrichers directly target recurring JPWB failure shapes: declared-but-unused registries, implemented-but-uncalled guards, hardcoded truth at an assurance boundary, fields carried in a request but dropped before persistence, and conformance universes narrowed until a gate passes vacuously.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-032` | Graph construction SHALL be deterministic and reject dangling internal identities unless the edge is explicitly unresolved/external. |
| `W4D-REQ-033` | Every inferred edge SHALL retain the supporting direct edges and inference rule. |
| `W4D-REQ-034` | A JPWB enricher SHALL declare its complete input population and SHALL fail or return partial when that population cannot be established. |
| `W4D-REQ-035` | The same normalized compiler fact SHALL be shared by enrichers; independent regex parsers SHALL be limited to lexically sufficient facts and justified by a capability declaration. |

---

## 9. Existing and later provider adapters

### 9.1 Initial adapters

| Adapter | Initial role | Boundary |
| --- | --- | --- |
| TypeScript Compiler API | Primary syntax, symbol, type, module, diagnostic, and base flow provider | Authoritative only for the exact compiler context it analyzed |
| dependency-cruiser | Package/module dependency and configured architecture-rule results | Native rule IDs and ignored paths retained; results do not replace compiler facts |
| ESLint | Lint and selected syntax/security findings | Parser mode, rule configuration, ignored files, and fix availability recorded; CSAA does not auto-fix |
| Vitest | Test discovery/result identity and source-versus-artifact mode | A configuration is not an execution; empty collection is a failure where tests are expected |
| V8 coverage | Statement/branch/function/line coverage correlation | Requires identified producing run and source-map state; stale output is not current evidence |
| Playwright | E2E result, trace, screenshot, and runtime interaction evidence | Kept distinct from source coverage and static reachability |
| Existing `verif` instruments | JPWB-specific rule exemplars and baseline data | Wrapped or migrated one at a time with equivalence tests |

Adapters SHALL prefer programmatic APIs when those APIs preserve structured evidence. A subprocess adapter MAY be used when it is the provider's stable interface. All subprocess execution SHALL be explicit in the request, bounded, and captured in the invocation record.

### 9.2 Advanced providers

Joern, CodeQL, Semgrep, Sonar, or another provider MAY be evaluated only when a named CSAA capability remains materially unsupported. The evaluation SHALL use a bounded JPWB slice and fixture, declare installation/network/licensing implications, compare normalized facts against the Compiler API baseline, and measure false positives, false negatives, runtime, and provenance loss.

No provider receives the label "primary" merely because it emits more findings. Primary designation depends on semantic fidelity, reproducibility, local operability, provenance, failure visibility, and compatibility with the normalized model.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-036` | Configured, installed, executed, healthy, complete, and qualified SHALL remain separate provider states. |
| `W4D-REQ-037` | Provider overlap SHALL preserve all source observations and apply deterministic deduplication; one provider result SHALL NOT silently erase another. |
| `W4D-REQ-038` | A provider disagreement SHALL surface as conflict with both evidence chains unless a versioned precedence rule resolves that exact fact class. |
| `W4D-REQ-039` | External network access SHALL be off by default and SHALL NOT be required for the Compiler API, inventory, query, or baseline JPWB-rule path. |

---

## 10. Query, slicing, comparison, and impact

### 10.1 Query model

The query engine SHALL implement the `JAN-CSAA-003`/`JAN-CSAA-007` logical model, including:

- a typed, versioned query AST;
- complete validation and resource-budget checks over the whole AST before evaluation;
- four evidence-pair outcomes: true `(1,0)`, false `(0,1)`, unknown `(0,0)`, and conflict `(1,1)`;
- `NOT`, `AND`, and `OR` using the specified evidence-pair algebra;
- `not-applicable` as a disposition separate from four-valued truth;
- lawful decisive short-circuiting only, with skipped-node provenance;
- one evaluation-disposition record per AST node;
- separate root partitions for true, false, unknown, conflict, not-applicable, and omitted/unevaluated subjects; and
- explanation vectors for support basis, capability coverage, execution health, freshness, conflict, and inference.

Query evaluation SHALL never convert a provider failure or missing capability into an empty result. An agent asking "which handlers do not validate emitted events?" must be able to distinguish "none" from "the event schema population was not loaded."

### 10.2 Change impact

Impact analysis SHALL compare two exact semantic snapshots or one snapshot plus an explicit working change set. The initial propagation model SHOULD include:

- changed declaration/symbol/type and direct references;
- import and package dependents;
- callers and possible callers;
- implementing/overriding types;
- affected schemas, generated artifacts, handlers, events, state transitions, tests, and architecture rules;
- data-flow successors for selected JPWB field lifecycles; and
- coverage and runtime witnesses when current evidence exists.

Impact states SHALL include at least `DIRECT`, `TRANSITIVE`, `POSSIBLE`, `RULE_AFFECTED`, `TEST_AFFECTED`, `UNSUPPORTED`, and `OUTSIDE_PERIMETER`. Coupling metrics and change amplification are explanatory measurements, not correctness verdicts.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-040` | Query truth tables, N/A handling, short-circuit traces, and closed-empty quantifier behavior SHALL be unit-tested exhaustively. |
| `W4D-REQ-041` | Query results SHALL be stable under canonical reordering and SHALL preserve witnesses and counter-witnesses. |
| `W4D-REQ-042` | Impact propagation SHALL identify its seed set, edge kinds, traversal limits, exclusions, and frontier. |
| `W4D-REQ-043` | A missing edge capability SHALL widen uncertainty; it SHALL NOT narrow the reported impact set without disclosure. |

---

## 11. Rules and findings

Rules SHALL be versioned, provider-neutral profiles. A rule profile contains:

- stable rule ID and version;
- title, protected property, and rationale;
- subject and applicability predicate;
- required capabilities and minimum completeness;
- query or evaluator reference;
- technical severity and confidence policy;
- finding fingerprint fields;
- remediation guidance where mechanically safe;
- suppression/exception boundary; and
- positive, negative, boundary, non-vacuity, and mutation fixtures.

An Analyzer Finding Record is an immutable observation over an exact subject. Review disposition, remediation, suppression, exception, and reanalysis are separate records or fields; a coding agent SHALL NOT overwrite the original observation to make it disappear.

The first JPWB rule families SHOULD be:

1. registry consumer coverage;
2. schema/payload consistency;
3. command pipeline stage coverage;
4. state transition writer and guard reachability;
5. persisted-field propagation;
6. hardcoded assurance predicate detection;
7. test-universe and mutation non-vacuity;
8. identifier-prefix contract consistency; and
9. package boundary conformance.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-044` | A rule SHALL return `NOT_APPLICABLE` when its declared subject class is absent and `UNKNOWN` or `PARTIAL` when required capability is missing. |
| `W4D-REQ-045` | A passing rule application SHALL include the analyzed population and proof that the failure predicate was executable. |
| `W4D-REQ-046` | Finding fingerprints SHALL remain stable across irrelevant line movement where a semantic identity survives, while preserving the current source span separately. |
| `W4D-REQ-047` | Automated remediation SHALL remain disabled in the first implementation. CSAA reports and explains; ordinary coding-agent change controls govern edits. |

---

## 12. Coding-agent and CLI contract

### 12.1 Commands

The first CLI SHALL expose these stable operations:

```text
csaa inventory   derive or check repository inventory
csaa snapshot    build a semantic snapshot
csaa query       evaluate a typed query against a snapshot
csaa impact      compare subjects and propagate possible impact
csaa findings    evaluate selected rule profiles
csaa explain     expand provenance for a result or finding
csaa verify      run CSAA conformance and generated-output checks
```

Commands MAY be delivered incrementally. Unsupported commands SHALL return a structured `UNIMPLEMENTED_CAPABILITY` diagnostic, not a placeholder success.

### 12.2 JSON envelope

Stdout SHALL contain only a single JSON response in JSON mode. Human diagnostics go to stderr. The protocol SHALL be a lossless presentation projection of the exact `JAN-CSAA-007` closed operation-response union; it SHALL NOT collapse progress, partiality, failure, or subject-resolution refusal into nullable fields:

```ts
interface CsaaResponseBase {
  protocolVersion: string;
  operation: string;
  requestId: string;
  subjectResolution: SubjectResolutionOutcome;
}

type CsaaResponse<T> =
  | (CsaaResponseBase & {
      outcome: 'progress'; state: 'requested' | 'accepted' | 'running';
      progress: OperationProgress; result?: never; error?: never;
    })
  | (CsaaResponseBase & {
      outcome: 'success'; state: 'succeeded'; subject: SubjectDescriptor;
      result: T; epistemicSummary: EpistemicSummary; error?: never;
    })
  | (CsaaResponseBase & {
      outcome: 'partial'; state: 'partial'; subject?: SubjectDescriptor;
      partial: PartialResult<T>; result?: never; error?: never;
    })
  | (CsaaResponseBase & {
      outcome: 'error';
      state: 'failed' | 'cancelled' | 'timed-out' | 'resource-refused'
        | 'authorization-refused' | 'incompatible' | 'unknown';
      subject?: SubjectDescriptor; error: TypedError; result?: never;
    });
```

`SubjectResolutionOutcome` SHALL retain `resolved`, `not-found`, `ambiguous`, `forbidden`, `unavailable`, and `incompatible`; non-resolved branches SHALL NOT invent a subject. Predicate truth and the six epistemic dimensions belong to the operation-specific result or partial-result records, not to one generic scalar `conclusion`. In particular, unsupported capability is not supported-false, and `UNIMPLEMENTED_CAPABILITY` is a typed error in the error variant.

Exit codes communicate transport/execution state, not semantic truth:

| Code | Meaning |
| --- | --- |
| `0` | Request completed; inspect the operation-specific result, partial result, findings, and epistemic state |
| `1` | An explicit verification or `--fail-on` policy did not pass |
| `2` | Invalid request, subject, schema, or unsupported protocol |
| `3` | Required analysis was partial, stale, or degraded |
| `4` | Provider or internal execution failed |

An MCP server or long-lived local service MAY later wrap this protocol. It SHALL call the same application functions and return the same envelopes; it SHALL NOT create a second query or truth model.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-080` | JSON responses SHALL preserve the exact progress, success, partial, and error union plus subject-resolution outcomes; they SHALL NOT require a fabricated subject or encode unsupported capability as predicate false. |

### 12.3 Expected coding-agent use

A coding agent should use CSAA in this order:

1. resolve/freeze the intended subject;
2. request the cheapest capability that can answer the question;
3. inspect completeness and execution health before relying on any operation-specific result;
4. cite finding/query IDs and source witnesses in its plan;
5. after an edit, request affected reanalysis rather than assume the previous answer remains current; and
6. report residual unknown/conflict/N/A states at handoff.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-048` | The CLI SHALL accept request JSON by file or stdin and SHALL emit schema-valid response JSON suitable for direct agent consumption. |
| `W4D-REQ-049` | Protocol schemas SHALL be versioned and tested for backward-compatible additive change within a major version. |
| `W4D-REQ-050` | Source citations SHALL use repository-relative path plus exact span and subject identity. |
| `W4D-REQ-051` | The agent interface SHALL expose capability gaps and recommended next evidence; it SHALL NOT manufacture a confident natural-language answer. |

---

## 13. Persistence and incrementality

### 13.1 First release

The first release SHALL build snapshots in memory and write only explicitly requested generated inventory or exported snapshot JSON. This is sufficient for inventory, focused rules, and small/medium repository queries. It avoids coupling semantic correctness to a database before the record model is stable.

### 13.2 Local index release

When repeat analysis time becomes material, CSAA MAY add a repository-local SQLite index at `.csaa/index.sqlite`. The path is a rebuildable developer cache, not documentation and not authoritative evidence. It SHOULD be ignored by Git. CSAA SHALL use `better-sqlite3` directly behind `CsaaStore`; it SHALL NOT reuse `rph-persistence`, whose schema and ports serve the product runtime.

Publication shall follow candidate-then-atomic-swap semantics:

1. analyze into a candidate namespace;
2. validate referential integrity, counts, capability states, and manifest digests;
3. compare selected incremental results with clean-full results during qualification;
4. commit the candidate transaction; and
5. update the current-snapshot pointer atomically.

Corruption or incompatible schema version causes quarantine and rebuild, never silent partial reuse.

### 13.3 Invalidation

Initial invalidation keys are file content, parsed configuration, lockfile/provider version, project membership, package exports, rule/query version, and relevant adapter configuration. A change to any key invalidates all dependent normalized facts and projections. Incremental reuse is an optimization and SHALL be observationally equivalent to a clean full run within the same declared capabilities.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-052` | Persistence SHALL be introduced only behind the existing store contract and after clean-full behavior is covered by tests. |
| `W4D-REQ-053` | Cache absence, deletion, or rebuild SHALL NOT change semantic conclusions for the same subject and capabilities. |
| `W4D-REQ-054` | A cached fact SHALL retain the source/configuration/provider/rule keys needed to prove currentness. |
| `W4D-REQ-055` | Incremental analysis SHALL be tested against clean-full analysis with file, configuration, dependency, generated-source, and rule-version mutations. |

---

## 14. Security and operational containment

CSAA analyzes untrusted source text and may execute local tools. Its default static path SHALL be read-only, local, and non-executing with respect to subject code.

Security controls are:

- canonicalize and bound every path to the frozen repository root;
- reject symlink and traversal escape unless an explicitly allowed external project root is recorded;
- do not load TypeScript language-service plugins or project transformers by default;
- do not evaluate source modules during static extraction;
- do not invoke package lifecycle scripts;
- disable network access by default;
- allowlist provider executables and arguments;
- impose file-count, file-size, AST-depth, query-depth, time, memory, result-size, and subprocess-output budgets;
- treat source text, environment values, diagnostics, and external-provider output as potentially sensitive;
- redact secrets in diagnostics and never serialize the full environment;
- emit source excerpts only when explicitly requested and bounded;
- use temporary files outside committed documentation and delete them on normal completion; and
- never pass repository content to an LLM or remote analyzer merely because the caller is a coding agent.

The analyzer is not an authorization oracle. A finding about authentication or authority does not grant CSAA permission to exercise product commands or access secrets.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-056` | Static inventory, snapshot, query, impact, and rule operations SHALL execute without running analyzed application code. |
| `W4D-REQ-057` | Any runtime probe SHALL require an explicit operation/profile and SHALL report process, arguments, environment allowlist, network policy, limits, and captured outputs. |
| `W4D-REQ-058` | Budget exhaustion SHALL yield a typed partial/failed result with the unfinished population; it SHALL NOT yield an empty successful result. |
| `W4D-REQ-059` | Generated output SHALL contain no secrets, absolute user paths, bearer tokens, private environment values, or unbounded source excerpts. |

---

## 15. Verification strategy

### 15.1 Test layers

| Layer | Required proof |
| --- | --- |
| Contract | JSON schemas accept every emitted response and reject malformed discriminated unions |
| Determinism | Repeated and order-randomized input produces identical normalized facts and generated bytes |
| Compiler fixtures | Syntax, symbol, alias, overload, merged declaration, unresolved module, dynamic call, generated source, and project-reference behavior |
| JPWB golden fixtures | Command/handler/event/schema, state/guard/writer, registry/consumer, and persisted-field flow examples |
| Query algebra | Exhaustive truth tables, N/A, quantifiers, eager/short-circuit equivalence, node traces, provenance, and invalid AST budgets |
| Rule tests | Positive, negative, boundary, unsupported-capability, non-applicable, and zero-population cases |
| Metamorphic | Stable under harmless rename/order/format changes; appropriately changed under semantic mutations |
| Mutation | Mutants that disconnect a guard, hardcode truth, narrow a test universe, drop a field, or bypass a schema must be killed |
| Adapter | Native fixture output normalizes without losing declared identity; provider failure and malformed output are visible |
| Incremental | Incremental snapshot/query/finding set equals clean-full result for mutation matrix |
| Repository integration | Root type-check, lint, boundary, build, source test, dist test, coverage, and inventory check include CSAA non-vacuously |

### 15.2 No-false-green controls

Every test that claims an analyzer caught a defect SHALL prove:

1. the intended subject entered the analyzed population;
2. the relevant rule evaluator executed;
3. the unmutated fixture has the expected result;
4. the mutation changes the protected property rather than merely breaking parsing;
5. the finding identifies the intended witness; and
6. removing or disabling the analyzer makes the test fail for the expected reason.

Snapshot tests alone are insufficient for semantic correctness. Golden outputs SHALL be paired with assertions over population, identity, and key relationships so an empty or truncated model cannot be approved as a harmless snapshot update.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-060` | Every analyzer rule SHALL have at least one executable counterexample and one valid example. |
| `W4D-REQ-061` | Every registry or universe comparison SHALL derive at least one side independently and reject unexpected empty sets. |
| `W4D-REQ-062` | Every baseline update SHALL expose additions, removals, and changed semantic keys; a blanket snapshot rewrite SHALL NOT constitute review. |
| `W4D-REQ-063` | The first implementation release SHALL run the complete first-increment benchmark fixture set and report detected, missed, unsupported, and not-applicable counts. |

---

## 16. Harmonization-finding detectability benchmark

### 16.1 Purpose and taxonomy

The 75 confirmed findings in `docs/_working/HARMONIZATION-FINDINGS.md` form a repository-grounded benchmark. The exact classified source used here is 26,518 bytes with SHA-256 `1fd8b47d624822bb821cf6319274b9b0ce26756fff2debf1bd58be7b1d8a0c45` and contains 75 confirmed finding rows. The working file is an analyzed source, not a required checked-in CSAA artifact. The future checked-in `verif/harmonization-detectability.baseline.json` SHALL carry this digest, the complete per-row map below, and its taxonomy; `scripts/harmonization-detectability.ts` SHALL generate or check that baseline, and `verif/harmonization-detectability.test.ts` SHALL verify its integrity and benchmark execution. This preserves the business-case benchmark without promoting ignored review working material into the maintained corpus.

The classification answers: **could a correctly configured analyzer establish the reported defect, and what minimum capability would it need?** It does not re-adjudicate the finding or replace its source evidence.

| Class | Meaning | Count |
| --- | --- | ---: |
| `STATIC_DIRECT` (`D`) | A bounded AST, schema, configuration, or direct-file check can establish the defect without whole-program reachability | 21 |
| `STATIC_WHOLE_PROGRAM` (`W`) | Compiler resolution, call/data flow, global symbol use, state-machine reachability, or cross-file population closure is required | 41 |
| `HYBRID_RUNTIME` (`H`) | Static analysis can identify risk or instrumentation points, but runtime/test/trace evidence is required to establish the reported behavior | 5 |
| `NORMATIVE_HUMAN` (`N`) | The decisive issue is normative ambiguity, ontology, policy interpretation, or acceptability; an analyzer may surface the conflict but cannot decide it | 8 |

Thus 62 of 75 findings (82.7%) are statically detectable in principle. Adding bounded runtime evidence raises analyzable coverage to 67 of 75 (89.3%). The remaining eight are not automation failures: CSAA should locate and frame the contradictory sources, then return a human-decision requirement.

Capability codes are `AST` syntax/structure, `SYM` symbol/reference closure, `SCHEMA` contract/schema comparison, `CALL` call graph/reachability, `DFG` data flow, `TAINT` trust/taint flow, `TEST` test-population/conformance analysis, `FSM` state-machine reachability, `TRACE` runtime evidence, and `NORM` normative comparison/judgment. `I1` marks the first-increment exemplar set.

### 16.2 Complete classification

| Finding | Class | Minimum capabilities | I1 |
| ---: | :---: | --- | :---: |
| 1 | W | CALL + DFG | Y |
| 2 | W | DFG + AST |  |
| 3 | W | SYM | Y |
| 4 | W | DFG + SCHEMA |  |
| 5 | W | SYM + CALL | Y |
| 6 | W | CALL + TEST | Y |
| 7 | W | TAINT + DFG |  |
| 8 | W | SCHEMA + SYM | Y |
| 9 | H | TAINT + TRACE |  |
| 10 | W | DFG |  |
| 11 | D | AST + SCHEMA | Y |
| 12 | D | AST | Y |
| 13 | D | SCHEMA + NORM |  |
| 14 | W | DFG + SCHEMA |  |
| 15 | W | DFG |  |
| 16 | W | DFG + SCHEMA |  |
| 17 | W | CALL + AST | Y |
| 18 | W | SYM | Y |
| 19 | H | TRACE + DFG |  |
| 20 | N | NORM |  |
| 21 | W | TAINT + CALL |  |
| 22 | D | TEST + AST | Y |
| 23 | W | TEST + CALL | Y |
| 24 | W | DFG |  |
| 25 | W | AST + DFG |  |
| 26 | W | SCHEMA + SYM |  |
| 27 | W | DFG + SCHEMA |  |
| 28 | W | SYM + DFG | Y |
| 29 | W | TAINT + DFG |  |
| 30 | D | SCHEMA | Y |
| 31 | D | AST + SCHEMA | Y |
| 32 | D | SCHEMA + NORM | Y |
| 33 | D | SCHEMA |  |
| 34 | W | CALL + AST | Y |
| 35 | W | CALL + SYM | Y |
| 36 | W | CALL + DFG | Y |
| 37 | D | SCHEMA + NORM |  |
| 38 | W | FSM + AST |  |
| 39 | W | CALL + AST | Y |
| 40 | D | AST | Y |
| 41 | W | CALL + SYM |  |
| 42 | W | CALL + SYM |  |
| 43 | D | SCHEMA |  |
| 44 | W | SYM + DFG |  |
| 45 | H | TRACE + DFG |  |
| 46 | W | DFG + SCHEMA |  |
| 47 | D | AST |  |
| 48 | N | NORM + FSM |  |
| 49 | W | CALL + TAINT | Y |
| 50 | D | AST |  |
| 51 | D | SCHEMA |  |
| 52 | W | DFG + SCHEMA |  |
| 53 | N | NORM + SCHEMA |  |
| 54 | H | TRACE + TAINT |  |
| 55 | H | TRACE + TAINT |  |
| 56 | D | AST |  |
| 57 | D | AST + DFG |  |
| 58 | D | AST |  |
| 59 | N | NORM + DFG |  |
| 60 | W | TAINT + DFG |  |
| 61 | W | DFG |  |
| 62 | D | AST |  |
| 63 | W | DFG + SCHEMA |  |
| 64 | N | NORM |  |
| 65 | D | SCHEMA |  |
| 66 | D | SCHEMA + NORM |  |
| 67 | W | CALL + SCHEMA |  |
| 68 | N | NORM |  |
| 69 | W | DFG + AST |  |
| 70 | W | SYM + AST | Y |
| 71 | W | CALL + FSM |  |
| 72 | W | CALL + AST |  |
| 73 | D | AST + DFG | Y |
| 74 | N | NORM + SCHEMA |  |
| 75 | N | NORM |  |

### 16.3 First-increment exemplars

The first-increment set contains **23** findings (30.7% of the benchmark). The earlier working summary of 22 was an arithmetic error; the enumerated flags have always identified these 23:

| Finding | Exemplar defect shape |
| ---: | --- |
| 1 | Gate vacuity caused by arguments that force the early-return path |
| 3 | `expectedRevision` declared but unread across the command pipeline |
| 5 | Generated event registry has no production consumer |
| 6 | Property tested against a disconnected kernel while the live gate hardcodes validity |
| 8 | Required authorizer port is absent from the exported port surface |
| 11 | Schema spread is overridden by weaker field declarations |
| 12 | Five assurance predicates are literal `true` at the live call site |
| 17 | `ValidatePwa` changes status without performing validation |
| 18 | PWA semantic version has no authoring writer |
| 22 | Mandatory properties P9-P12 are omitted from a hard-coded test universe |
| 23 | Mutation gate is represented by a non-empty static list rather than executable mutation |
| 28 | Assessment evidence and uncertainty fields are born empty and have no writer |
| 30 | Identifier validator accepts prefixes outside the registered prefix set |
| 31 | Generated identifier-bearing payload fields use unconstrained strings |
| 32 | `ID_PREFIXES` differs from the governed prefix registry |
| 34 | Readiness transition is unconditional instead of guarded |
| 35 | Declared Intent guard has no production call path |
| 36 | Runtime-binding composite gate is uncalled and binding IDs are dropped |
| 39 | Evidence-admissibility function is uncalled while the live result uses a literal true value |
| 40 | Validator-output schema check is a literal true value |
| 49 | Authority checking is opt-in by handler instead of a pipeline-wide stage |
| 70 | Guard reads a field that no production path writes, making it vacuous |
| 73 | Version-drift comparison receives the same array on both sides |

This set deliberately spans direct AST/schema checks and whole-program consumer, call, writer, and data-flow checks. It SHALL be implemented as executable fixtures and repository rules, not a hand-maintained claim that the tool "would have" caught them.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-064` | The benchmark SHALL be stored in `verif/harmonization-detectability.baseline.json` as a typed machine-readable fixture with the source digest, finding ID, classification, required capabilities, and first-increment flag. |
| `W4D-REQ-065` | Benchmark execution SHALL report results per finding and aggregate by class; aggregate percentages alone are insufficient. |
| `W4D-REQ-066` | A static miss caused by unavailable capability SHALL be `UNSUPPORTED` or `PARTIAL`, not a passed detection. |
| `W4D-REQ-067` | Normative-human findings SHALL produce cited conflict packets or decision questions where possible, never automated normative verdicts. |

---

## 17. Implementation release slices and exit conditions

This design defines capability slices, not sponsor gates. Detailed sequencing belongs in `JAN-CSAA-W4-ROADMAP-001`; the conditions below state when each architectural slice is genuinely usable.

### 17.1 Slice A: package and generated inventory

Exit requires:

- `@janumipwb/csaa` participates non-vacuously in repository type-check, lint, build, and tests;
- subject resolution and canonical file/configuration manifests are implemented;
- `inventory --write` and `inventory --check` produce and verify both generated artifacts;
- repeated runs are byte-identical;
- workspace/project/tool populations are derived and anti-vacuity tested; and
- the root gate can detect stale generated inventory without rewriting it.

### 17.2 Slice B: compiler-semantic snapshot

Exit requires:

- project, syntax, symbol, type, module-resolution, and diagnostic facts for all supported JPWB TypeScript contexts;
- stable normalized identities and provenance;
- explicit unresolved/partial states;
- compiler fixtures plus one full JPWB snapshot smoke test; and
- no product package depends on CSAA.

### 17.3 Slice C: JPWB graph and first rule set

Exit requires:

- dependency, call, registry-consumer, state/writer/guard, schema, and selected field-flow projections;
- executable rules for all 23 first-increment exemplars;
- per-rule population and anti-vacuity evidence;
- structured findings with source witnesses; and
- benchmark reporting that distinguishes detected, missed, unsupported, and N/A.

### 17.4 Slice D: query, impact, and coding-agent employment

Exit requires:

- full four-valued query algebra and explanation traces;
- backward/forward slice and bounded impact propagation;
- stable JSON request/response protocol for all implemented commands;
- post-edit affected reanalysis; and
- an agent workflow test proving that a plan changes in response to a material finding and reports residual uncertainty.

### 17.5 Slice E: persistence and broader providers

Exit requires measured need, clean-full equivalence, crash-safe publication, cache rebuild, and qualified adapter tests. It is not required for the first production-useful CSAA release.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-068` | No slice SHALL claim completion when its required population is empty, its key provider is `NOT_RUN`, or its benchmark path is disabled. |
| `W4D-REQ-069` | Each slice SHALL leave the repository usable and SHALL add only the commands and outputs it can support truthfully. |
| `W4D-REQ-070` | Later provider, persistence, service, or UI work SHALL preserve the CLI protocol and logical model or version them explicitly. |

---

## 18. Deferred choices and explicit non-goals

The following are deliberately deferred:

- a distributed graph database;
- a continuously running indexing service;
- remote organization-wide repositories;
- a graphical CSAA UI;
- automated source remediation;
- mandatory Joern, CodeQL, Semgrep, Sonar, or cloud analysis;
- generalized multi-language analysis;
- LLM-derived semantic facts;
- product-runtime dependence on CSAA; and
- lifecycle archives, sponsor-response records, or per-increment ratification instruments.

These items may become useful. None is necessary to deliver a deterministic JPWB inventory, compiler-semantic graph, targeted findings, change impact, or coding-agent JSON interface.

| ID | Requirement |
| --- | --- |
| `W4D-REQ-071` | A deferred capability SHALL remain visibly unsupported; placeholder output SHALL NOT imply implementation. |
| `W4D-REQ-072` | New infrastructure SHALL be justified by a measured capability, scale, latency, or integration gap in the working CSAA implementation. |

---

## 19. Closing design rule

Build the smallest instrument that can prove what it observed.

For JPWB, that means starting with the compiler already in the repository, the analyzer patterns already running in `verif`, and a deterministic generated inventory. It then means sharing those facts across call, data-flow, state-machine, rule, query, and impact projections instead of growing more disconnected scripts. Every answer must remain tied to exact source bytes, explicit capability, visible uncertainty, and a reproducible witness. That is the point at which coding agents can use the implementation as engineering evidence rather than as another confident narrator.
