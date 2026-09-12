# `@janumipwb/csaa`

Deterministic, read-only code-semantic analysis and assurance tooling for the Janumi Professional Workbench (JPWB). The package exposes the CSAA subject, semantic snapshot, graph, query, impact, harmonization, evidence-import, persistence, and coding-agent process surfaces.

This is an implementation-local, unregistered capability. It has analysis authority `NONE`, gate effect `NONE`, and does not approve a change, qualify a provider, establish behavioral correctness, or transfer governance authority.

For task-oriented coding-agent recipes, request construction, use-case selection, failure handling, and handoff guidance, see the [CSAA Coding Agent Guide](./CODING_AGENT_GUIDE.md).

## Coding-agent entry points

From the JPWB repository root:

```text
bun run csaa:agent -- <command> --request-json <AgentOperationRequest JSON> --input-json <operation input JSON> --output json
```

The emitted package binary is `csaa-coding-agent`. Both shipped launchers bind the subject to the JPWB repository containing the launcher. A request, operation artifact, or stdin payload cannot select another filesystem root. Library hosts that need a different authorized root must call `runCodingAgentProcessHost` and supply that trusted absolute root outside argv and stdin.

The seven commands are `inventory`, `snapshot`, `query`, `impact`, `findings`, `explain`, and `verify`. `invoke --stdin` accepts the same command, request, and input in one closed process envelope:

```json
{
  "schemaVersion": "jan-csaa-coding-agent-process-invocation/0.1.0",
  "command": "inventory",
  "request": {},
  "input": {},
  "output": "json"
}
```

The empty objects above show placement only; they are not valid requests. `request` must be a valid `jan-csaa-agent-operation-protocol/0.1.0` request. `input` must be a closed operation input whose canonical SHA-256 is bound by `request.operationInput.inputDigest`, and `request.operationInput.inputRef` must equal `input.bindingRef`.

## Persistent artifact bootstrap

Operation-specific requests, snapshots, queries, change sets, finding profiles, explanations, and verification expectations travel as canonical JSON artifacts. Publish an artifact through stdin:

```text
'{"kind":"REPOSITORY_INVENTORY_REQUEST","requireJpwbPopulations":false,"rootLocator":"<repository-root>","schemaVersion":"jan-csaa-coding-agent-inventory-request/0.1.0"}' | bun run csaa:agent:artifact:put
```

The one-line stdout result contains an `artifact:sha256:<lowercase digest>` reference. Retrieve and re-verify it in a later process:

```text
bun run csaa:agent:artifact:get -- artifact:sha256:<digest>
```

The default store is `.csaa/coding-agent-artifacts` under the trusted repository root. It publishes immutable, content-addressed generations atomically. Every read rechecks the SHA-256 address and canonical JSON bytes. Handler writes remain staged until a valid terminal response; cancellation, invalid output, timeout, and internal failure roll them back. `.csaa/` is local state and is gitignored.

## Seven-command workflow

Each example assumes that every artifact named by `...Ref` was first published with `artifact put`, and that `<request-json>` is a complete request for the named operation.

### 1. Inventory

Input:

```json
{"bindingRef":"binding:agent:inventory","kind":"INVENTORY","output":"STDOUT_JSON","schemaVersion":"jan-csaa-coding-agent-cli-input/0.1.0","subjectInputRef":"artifact:sha256:<inventory-request>"}
```

```text
bun run csaa:agent -- inventory --request-json '<request-json>' --input-json '<input-json>' --output json
```

The handler performs two consecutive canonical inventory captures and admits a result only when their exact subject identity agrees. `requireJpwbPopulations` selects whether JPWB-specific population assertions are required.

### 2. Snapshot

Input:

```json
{"bindingRef":"binding:agent:snapshot","kind":"SNAPSHOT","output":"STDOUT_JSON","schemaVersion":"jan-csaa-coding-agent-cli-input/0.1.0","subjectInputRef":"artifact:sha256:<snapshot-request>"}
```

```text
bun run csaa:agent -- snapshot --request-json '<request-json>' --input-json '<input-json>' --output json
```

The referenced `STATIC_SEMANTIC_SNAPSHOT_REQUEST` contains a subject request and semantic request. Both use the literal root locator `<repository-root>`; the semantic subject id is `<resolved-subject>` or the exact resolved id. Snapshot capability requirements currently map `JAN-CSAA-CAP-001`, `002`, and `003` to syntax, symbol, and type capture.

### 3. Query

Input:

```json
{"bindingRef":"binding:agent:query","kind":"QUERY","output":"STDOUT_JSON","queryRef":"artifact:sha256:<query-request>","schemaVersion":"jan-csaa-coding-agent-cli-input/0.1.0","snapshotRef":"artifact:sha256:<snapshot-result>"}
```

```text
bun run csaa:agent -- query --request-json '<request-json>' --input-json '<input-json>' --output json
```

The query request uses `jan-csaa-semantic-source-query-report-request/0.2.0`. The handler recaptures the exact stored snapshot subject and refuses stale or mismatched snapshot identity. Four-valued results retain `TRUE`, `FALSE`, `UNKNOWN`, and `CONFLICT`; unknown regions are not coerced to absence.

### 4. Impact

Input:

```json
{"bindingRef":"binding:agent:impact","changeSetRef":"artifact:sha256:<impact-request>","kind":"IMPACT","output":"STDOUT_JSON","schemaVersion":"jan-csaa-coding-agent-cli-input/0.1.0","snapshotRef":"artifact:sha256:<snapshot-result>"}
```

```text
bun run csaa:agent -- impact --request-json '<request-json>' --input-json '<input-json>' --output json
```

`changeSetRef` may name the registered static-module impact request or the working-source-edit impact request. Results are bounded candidate sets. They do not prove non-impact, safe deletion, complete dynamic reachability, or behavior preservation.

### 5. Findings

Input:

```json
{"bindingRef":"binding:agent:findings","kind":"FINDINGS","output":"STDOUT_JSON","ruleProfileRef":"artifact:sha256:<native-findings-request>","schemaVersion":"jan-csaa-coding-agent-cli-input/0.1.0","snapshotRef":"artifact:sha256:<snapshot-result>"}
```

```text
bun run csaa:agent -- findings --request-json '<request-json>' --input-json '<input-json>' --output json
```

The referenced request is `jan-csaa-coding-agent-findings-request/2.0.0`, operation `jan-csaa-project-jpwb-harmonization-first-increment/1.0.0`, with `RUN` or `NOT_RUN` disposition, explicit native budgets, one canonical `hybridStaticObservedAt`, and nullable `hybridRuntimeEvidence`. `RUN` projects all 23 first-increment native rule records and five rule-specific DFG/TAINT prerequisite rows from retained frozen bytes. Only a native rule with every required capability, projection surface, mandatory input, and closed eligible physical population can become conclusive; all other regions remain `UNSUPPORTED` or open.

When `hybridRuntimeEvidence` is non-null, it names one content-addressed caller-supplied deterministic trace plus its exact provider-run identity, assessment time, and freshness window. The handler imports those bytes but never launches a provider or executes subject code. Provider, subject, freshness, health, coverage, or normalization failures remain conflicts, stale evidence, `NOT_RUN`, or `UNSUPPORTED`; they cannot manufacture support. The five static prerequisite rows are always source-bound, and the composition independently verifies the exact frozen subject after both native and hybrid projection.

### 6. Explain

Input:

```json
{"bindingRef":"binding:agent:explain","explanationProfileRef":"artifact:sha256:<explanation-profile>","kind":"EXPLAIN","output":"STDOUT_JSON","resultRef":"artifact:sha256:<findings-result>","schemaVersion":"jan-csaa-coding-agent-cli-input/0.1.0"}
```

```text
bun run csaa:agent -- explain --request-json '<request-json>' --input-json '<input-json>' --output json
```

The `EXACT_FINDING_EXPLANATION_PROFILE` selects `findingId`, exact `evaluationId`, and the finding fingerprint (or `null`). Explanation recaptures the subject, replays the native projection and the complete source-bound/optional-runtime hybrid evidence envelope, requires canonical equality with the stored findings result, and copies exact native facts, population, provenance, currentness, and evidence. It does not infer a cause or remediation.

### 7. Verify

Input:

```json
{"bindingRef":"binding:agent:verify","expectationRef":"artifact:sha256:<workflow-expectation>","kind":"VERIFY","output":"STDOUT_JSON","schemaVersion":"jan-csaa-coding-agent-cli-input/0.1.0","subjectInputRef":"artifact:sha256:<snapshot-result>"}
```

```text
bun run csaa:agent -- verify --request-json '<request-json>' --input-json '<input-json>' --output json
```

An `ARTIFACT_WORKFLOW_EXPECTATION` binds the exact snapshot and subject and contains one to 32 conjunctive `ARTIFACT_DIGEST_EQUALS` or `JSON_VALUE_EQUALS` assertions over at most eight artifacts. Every assertion and both bindings must pass. Verification checks stored evidence only; it does not run tests or activate a gate.

## Request and result discipline

- Use the operation and capability versions exported by this package. Local capability ids for inventory, findings, explain, and verify are implementation-local and unregistered.
- Use `REQUIRE_CURRENT` when current evidence is required. Snapshot, query, impact, findings, explain, and verify recapture or recheck the subject at their defined boundaries and fail closed on mismatch.
- Treat an admitted result reference as the durable payload. The terminal response is the versioned protocol envelope and may report a partial result whose admitted artifact remains useful.
- Do not interpret `partial` as failure or as success. Inspect capability coverage, currentness, excluded/unknown regions, diagnostics, and admitted result references.
- Content references are opaque. Filesystem paths, `file:` URIs, backslashes, and parent traversal are refused in untrusted argv/stdin data.

## Stdout, stderr, and exit codes

Progress responses are canonical JSON Lines on stderr. Exactly one terminal protocol response is written to stdout. Admission and process diagnostics use stderr and leave stdout empty.

| Exit | Category | Meaning |
| ---: | --- | --- |
| `0` | `SUCCESS` | The requested operation completed under its exact contract. |
| `2` | `INVALID_REQUEST` | Closed-shape, version, binding, reference, budget, JSON, or argv admission failed. |
| `3` | `INCOMPLETE_OR_UNSUPPORTED` | Useful partial evidence, an unsupported capability, stale/unavailable input, or a bounded refusal. Inspect the terminal response. |
| `4` | `FAILED_EXPECTATION` | Verification executed and at least one declared binding/assertion failed. |
| `5` | `INTERNAL_FAILURE` | Trusted composition, validated response production, or store integration failed. No success claim is available. |

Consumers must parse the terminal `exitCategory`; they must not equate every nonzero exit with the same condition.

## Safety and operational limits

The protocol caps a terminal or progress message at 1 MiB and an internally persisted admitted-result artifact at 128 MiB. Explicit `artifact put`/`artifact get` transport remains independently capped at 16 MiB; ordinary operation responses carry only the content-addressed reference, and downstream operations read larger artifacts locally by that reference. The selected store caps one artifact at 128 MiB and one retained current generation at 1 GiB. The current-JPWB workflow separately authorizes at most 96 MiB for its semantic snapshot. These are byte-admission ceilings, not memory bounds: canonicalization, validation, and persistence can hold several representations concurrently.

The current-JPWB impact smoke is calibrated from an exact-subject run that consumed 676,278 predecessor input records, 11,035,042 string UTF-16 code units, and 131,897 output bytes including the terminal LF. Its admitted ceilings are therefore 1,000,000 input records, 16,000,000 string code units, and 1 MiB of result bytes; the measurements describe this smoke subject and are not universal repository-size claims.

The same exact subject measures 371 explicit members for its widest native harmonization rule population. The first-increment evaluator and native projector share a 512-member ceiling, retaining about 40% headroom while continuing to refuse oversized populations instead of substituting a lossy census identity. A fixed-identity calibration of its 23-rule native projection measures 205,671 bytes; the production smoke admits 512 KiB and reasserts the actual identity-dependent outcome size against that bound.

An earlier broad DWP-004 discovery reported a 4,737,843,200-byte aggregate-private high-water mark and a 4,157,128,704-byte working-set high-water mark. The current request sets `maxProcessRssBytes` to 6 GiB. The implementation compares the coordinating process's RSS with that bound at mandatory checkpoints and observes RSS reported during semantic-build progress. The blocking dependency-cruiser child is bounded by timeout and stdout/stderr limits; there is no implemented process-tree memory monitor. Accordingly, the evidence attests only `WITHIN_BOUND_AT_ALL_OPERATION_CHECKPOINTS`, not termination or no-write behavior on a child-process memory breach.

The protocol also caps nodes at 1,000,000, edges at 5,000,000, results at 250,000, references at 128, depth at 256, and timeout at one hour. The process parser additionally caps JSON depth at 64 and JSON nodes at 262,144. Operation-specific limits may be narrower, and every inner budget must fit inside the enclosing agent request.

The implementation:

- reads a frozen subject and content-addressed evidence; it does not execute subject modules;
- does not make network requests;
- does not write subject source or accept an output path;
- writes only to the trusted local artifact store and atomically managed verification/evidence outputs invoked by explicit repository scripts;
- uses cooperative timeout/cancellation and withholds staged artifacts when a terminal response is not valid;
- preserves unsupported, unknown, excluded, conflict, stale, not-run, and resource-refused states instead of manufacturing an empty success.

## Repository checks and roadmap traceability

These mappings identify implementation/evidence surfaces; they do not declare owner acceptance or governance approval.

| Work package / gate | Implementation or evidence surface |
| --- | --- |
| DWP-001 / G1 Inventory | `csaa:inventory`, `csaa:inventory:check`, generated JAN-CSAA-005 mapping and baseline |
| DWP-002 / G2 Subject | frozen subject resolver, exact byte store, freshness and generated-context checks |
| DWP-003 / G3 Semantic | static semantic snapshot builder/validator and source/dist repository smoke suites |
| DWP-004 / G4 Graph | structural graph operations, command/guard providers, the retained broad asymmetric dependency-cruiser observation, and an exact-build-root same-perimeter differential closure |
| DWP-005 / G5 Analysis | four-valued query, code slice, semantic comparison, 23-rule native projection, and 75-row accounting |
| DWP-006 / G6 Agent | seven-command JSON CLI, spawned process host, persistent artifact transport, and emitted binary |
| DWP-007 / G7 Incremental | selected content-addressed generation store, clean/incremental equivalence and crash tests, cold/warm empirical evidence, and checked SQLite-vs-files selection evidence |
| DWP-008 / G8 Enriched | ESLint, Vitest, V8 coverage, deterministic runtime import, five source-bound hybrid prerequisite projections, Svelte virtual-source, and native-security adapters |
| DWP-009 / G9 Provider | dated local `DEFER`; no advanced provider is installed or treated as qualified |
| G10 Final | full current verification and Marshall Hendricks's integrated implementation/corpus review; no approval is claimed by this package |

### Reviewed partial dependency-cruiser differential

The DWP-004 differential is deliberately asymmetric: the compiler side is exactly `packages/rph-contracts/tsconfig.build.json`, while dependency-cruiser 16.10.4 observes the source perimeter under `apps` and `packages`. Its provider configuration excludes `node_modules`, `dist`, `coverage`, `.turbo`, and `.svelte-kit`, so ignored generated output cannot alter the graph for an otherwise unchanged frozen subject. The current reviewed digest is `f83f2f4ef78e45b1f1bf3dadea85d9ff6a6d4d023a96d12e3b3c8abc7b4ca2aa`. Its accepted population contains 34 compiler edges, 940 provider modules, 4,825 provider dependencies, and 4,781 comparison records: 24 agreements, one corroboration, 4,756 incomparable records, and zero observed-difference records. The pre-integration discovery digest `702f5a25ee3316c43a4066d3d0cd95bb860950a1a24663b4b43b4c3962a5e355` is retained as historical evidence only and is not a current baseline.

The evidence retains three provider limitations: `MODULE_OPTIONAL_FIELDS_NOT_INTERPRETED`, `PROVIDER_RESOLUTION_OPTIONS_DIGEST_ONLY`, and `SUMMARY_VIOLATIONS_DIGEST_ONLY`. Compiler/provider context equivalence remains `UNKNOWN`, negative coverage remains open, and provider rows outside the compiler slice remain incomparable. The evidence has authority `REVIEWED_DIFFERENTIAL_EVIDENCE_ONLY` and gate effect `NONE`; it does not establish repository-wide compiler/provider equivalence, optional metadata interpretation, negative-coverage closure, provider qualification, G4 passage, or repository gate authority.

From the repository root, verify the checked evidence or deliberately replace it only after reviewing a current discovery and intentionally updating `CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST`:

```text
bun run csaa:dependency-cruiser-differential:check
bun run csaa:dependency-cruiser-differential
```

The equivalent package-local commands are `dependency-cruiser-differential:check` and `dependency-cruiser-differential`. The write command is intentionally not part of `gate` or `gate:fast`; the check has no gate authority either. Both commands use the fixed local executable and arguments, no shell, no network use, bounded output/cardinality/memory, post-provider identity/currentness checks, and final FrozenSubject currentness verification.

### Exact build-root same-perimeter G4 closure

The separate G4 closure profile retains the broad evidence above unchanged and runs dependency-cruiser over the exact ten root files declared by `packages/rph-contracts/tsconfig.build.json`. Acceptance requires exact equality among compiler root names, deep-indexed non-declaration compiler sources, provider input paths, and provider module paths; compiler source-origin classification does not remove a declared project root from that perimeter. Every compiler edge and provider dependency must reconcile and have an importer inside the exact root population, and the comparison must contain zero observed-difference records. The fixed file argv prevents excluded tests and generators under `src` from silently widening the provider perimeter.

The reviewed closure digest is `4a67faa02207d68dae0ebd913d518ab19f7cad186c5d473239b14f08c171da08`, over same-perimeter differential `c2303f9cf32b6df01e03b0ddbb7dd032ef86f404fccd6c87435c916f8d3cecf4`. The accepted slice contains ten compiler roots, ten deep-indexed non-declaration compiler sources, ten provider inputs, ten local provider modules, 34 compiler edges, 25 provider dependencies, and 34 comparisons: 24 agreements, one corroboration, nine incomparable records, and zero observed-difference records.

This is a bounded exact-slice closure only. It records bounded evidence for `CLOSED_FOR_EXACT_BUILD_ROOT_AND_REPRESENTED_RELATION_POPULATIONS` over that slice, with analysis authority and gate effect `NONE`. Compiler/provider resolution-context equivalence remains `UNKNOWN`, and the underlying v1 comparison deliberately retains negative coverage `OPEN`. Optional dependency-cruiser metadata interpretation, target-semantic equivalence, multi-project or whole-`apps`/`packages` compiler closure, repository-wide G4 passage, gate activation, provider qualification, and architecture-rule compliance remain explicit nonclaims.

The repository scripts below expose discovery, check, and deliberate reviewed-evidence write modes. They remain outside `gate` and `gate:fast` because the evidence itself has gate effect `NONE`:

```text
bun scripts/csaa-dependency-cruiser-differential.ts --g4-json
bun scripts/csaa-dependency-cruiser-differential.ts --g4-check
bun scripts/csaa-dependency-cruiser-differential.ts --g4-write
```

`--g4-json` is the discovery surface. `--g4-write` deliberately replaces evidence only after the exact current closure digest has been reviewed and bound in source; `--g4-check` compares the stable current projection without granting repository-gate authority.

### DWP-007 persistence selection

The measured Windows/Bun decision selects the already implemented content-addressed file store. The candidate passed atomic publication/rollback, cancellation preservation, concurrent reader isolation and writer exclusion, identity-checked reuse, rebuild on unknown schema, and active-host startup checks. `better-sqlite3` 12.11.1 passed the Node transaction, migration-rollback, and WAL-reader spike but did not produce a completion record under the active Bun host; Bun's built-in SQLite control passed but would require a different, currently unimplemented adapter. Startup is recorded without a product threshold or SLO.

The selection is a bounded technical decision, not cross-platform or provider qualification, and it does not authorize reuse of product persistence or make cache content authoritative. Re-measure deliberately or verify the exact checked environment and implementation-source digest:

```text
bun run csaa:persistence-selection
bun run csaa:persistence-selection:check
```

### Total technical completion check

After all controlled evidence has deliberately been regenerated and every candidate path has been staged explicitly, one serialized command checks the complete staged/tracked patch whitespace against `HEAD`, generated context and inventory, DWP-007 selection, the broad and exact-slice dependency differentials, the real current-JPWB seven-operation coding-agent workflow, and the full repository gate including mutation testing. The mutation runner captures the staged index as its exact baseline, refuses any unstaged tracked byte or later index change, restores each mutation to the captured candidate bytes, and verifies that same baseline again after the run:

```text
bun run csaa:completion:check
```

This command reports only technical implementation-check completion with analysis authority and gate effect `NONE`. It does not perform or replace the external G10 integrated corpus review.

Useful checks from the repository root include:

```text
bun run csaa:generated-context:check
bun run csaa:inventory:check
bun run csaa:content-store-performance:check
bun run csaa:persistence-selection:check
bun run csaa:dependency-cruiser-differential:check
bun scripts/csaa-dependency-cruiser-differential.ts --g4-check
bun run csaa:agent:current-jpwb:smoke
bun run csaa:completion:check
bun run check-types
bun run boundary
bun run build
bun run test:src
bun run test:dist
bun run test:coverage
bun run mutants
```

The governing architecture and operation constraints live in `docs/ASTs and Code Analysis/JAN-CSAA-001` through `JAN-CSAA-011`. The package README is operational guidance, not a controlled-document replacement.
