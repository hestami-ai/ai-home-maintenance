# CSAA Coding Agent Guide

*Task-oriented how-to for using CSAA in the JPWB repository*

- **Document class:** Uncontrolled repository-local operational guide
- **Authority:** None
- **Audience:** AI coding agents and agent integrators
- **Applies to:** `@janumipwb/csaa@0.1.0` and the current JPWB repository-root launchers
- **Implementation baseline:** Git commit `95d0b3ae773f573455255c8f504b2ace4217fad6`
- **Executable sources of truth:** CLI contracts, validators, tests, and repository scripts
- **Maintenance triggers:** Command, schema-version, artifact-store, exit-category, budget,
  currentness, or workflow changes

> CSAA is deterministic, read-only analysis and assurance tooling. The current package and
> coding-agent composition are implementation-local and unregistered. Their analysis authority
> and gate effect are `NONE`. A successful result is evidence for an agent to consider; it is not
> approval, provider qualification, proof of behavioral correctness, or permission to merge.

## 1. Read this first

Use CSAA when a coding task benefits from exact repository identity, retained semantic evidence,
bounded graph analysis, explicit unknown regions, or reproducible before/after assertions. Do not
use it as a substitute for reading the relevant source, running the applicable tests, or satisfying
the repository's governance and review requirements.

The practical operating rules are:

1. Run CSAA from the JPWB repository root in the worktree that owns the task.
2. Bind a request to the exact current subject and exact operation input.
3. Treat snapshots and result artifacts as immutable evidence for one exact subject.
4. Recapture and reanalyze after relevant subject bytes change.
5. Inspect coverage, currentness, diagnostics, exclusions, conflicts, and unknown regions.
6. Preserve `TRUE`, `FALSE`, `UNKNOWN`, and `CONFLICT`; never turn unknown into false.
7. Report what the result establishes and the nonclaims that remain.

The controlled Draft coding-agent employment profile is
[JAN-CSAA-010](<../../docs/ASTs and Code Analysis/JAN-CSAA-010 - Coding Agent Analysis Employment Profile.md>).
The general coding-agent procedure is
[JPWB-DOC-004](<../../docs/canon/JPWB-DOC-004 Agent Operating Protocol.md>).
This guide does not replace either document.

## 2. Five-minute orientation

All commands in this guide assume PowerShell at the JPWB repository root.

```powershell
git rev-parse --show-toplevel
git status --short --branch
bun --version
bun run csaa:generated-context:check
bun run csaa:inventory:check
```

The checks confirm that the generated context and checked inventory agree with the current selected
working-tree bytes. They do not perform a task-specific semantic analysis.

When an end-to-end proof of the implemented coding-agent surface is warranted, run the real current
JPWB workflow:

```powershell
bun run csaa:agent:current-jpwb:smoke
```

That smoke executes all seven operations against the current repository. It is materially slower
and more memory-intensive than a narrow report, so do not use it as the default answer to a small
question.

## 3. Choose the right surface

| Need | Use | Why |
| --- | --- | --- |
| Durable, chained, content-addressed agent evidence | Seven-command agent process | It binds inputs, subject identity, currentness, protocol responses, and persisted results. |
| One focused semantic or graph report | `csaa:analyze:*` script | It is simpler when no cross-operation artifact chain is needed. |
| Verify checked CSAA repository evidence | `csaa:*:check` script | It compares current output with a reviewed checked artifact or generated file. |
| Prove the complete CSAA implementation candidate | `csaa:completion:check` | It runs the staged technical-completion sequence, including the expensive repository gate and mutation suite. |

Start narrow. Escalate to the seven-command process when evidence must be reused, handed off, or
verified across multiple operations.

## 4. Seven-command agent process

### 4.1 Mental model

```text
versioned JSON artifact
        |
        v
   artifact put  --->  artifact:sha256:<digest>
                              |
operation input --------------+
        |
        v
canonical input digest + AgentOperationRequest
        |
        v
      invoke  ---> progress JSONL on stderr
        |
        +-----> one terminal protocol response on stdout
                              |
                              v
                 admitted result reference
                              |
                              +---> next operation
                              +---> artifact get
```

The seven operations are `inventory`, `snapshot`, `query`, `impact`, `findings`, `explain`, and
`verify`.

### 4.2 Use files and stdin on PowerShell

Keep transient request material under the gitignored `.csaa/` directory. Avoid shell-quoting large
JSON values on argv.

```powershell
New-Item -ItemType Directory -Force .csaa\agent-work | Out-Null

# Publish a versioned operation artifact.
Get-Content -Raw .csaa\agent-work\artifact.json |
  bun run csaa:agent:artifact:put

# Invoke one closed process envelope.
Get-Content -Raw .csaa\agent-work\invocation.json |
  bun run csaa:agent:invoke

# Retrieve a transport-sized durable result.
bun run csaa:agent:artifact:get -- artifact:sha256:<64-lowercase-hex>
```

The invocation file has exactly five top-level keys:

```json
{
  "schemaVersion": "jan-csaa-coding-agent-process-invocation/0.1.0",
  "command": "inventory",
  "request": {},
  "input": {},
  "output": "json"
}
```

The empty `request` and `input` objects show placement only; they are not valid operation values.
Replace them with the complete bound request and closed input. Extra keys, unsupported commands, or
another output value are refused.

The equivalent direct argv form is:

```text
bun run csaa:agent -- <operation> --request-json <json> --input-json <json> --output json
```

The launcher fixes the trusted repository root. Untrusted request data cannot choose a different
root. The stdin process and artifact publication recursively refuse unsafe path-like strings,
including absolute filesystem paths, `file:` URIs, backslashes, and parent traversal, anywhere in
their untrusted JSON.

### 4.3 Bootstrap with inventory

Publish this exact inventory-request shape as `.csaa/agent-work/artifact.json`:

```json
{
  "kind": "REPOSITORY_INVENTORY_REQUEST",
  "requireJpwbPopulations": true,
  "rootLocator": "<repository-root>",
  "schemaVersion": "jan-csaa-coding-agent-inventory-request/0.1.0"
}
```

Capture `artifact.reference` from `artifact put`. Build the closed inventory input:

```json
{
  "bindingRef": "binding:my-agent:inventory:current",
  "kind": "INVENTORY",
  "output": "STDOUT_JSON",
  "schemaVersion": "jan-csaa-coding-agent-cli-input/0.1.0",
  "subjectInputRef": "artifact:sha256:<inventory-request-digest>"
}
```

For the initial inventory request, `request.subjectInput` may bind the locator artifact directly:

```json
{
  "kind": "SUBJECT_LOCATOR",
  "locatorDigest": "<inventory-request-digest>",
  "locatorRef": "artifact:sha256:<inventory-request-digest>",
  "resolutionPolicyRef": "policy:exact-content-addressed-input"
}
```

After invocation, read the durable inventory result reference from
`terminal.partial.admittedResultRefs[0]`. Retrieve that artifact and retain
`capture.subjectId` as the inventory subject identity.

Do not automatically reuse the inventory subject ID for a semantic snapshot. Publish the complete
snapshot-request artifact and bind that new artifact through a new `SUBJECT_LOCATOR`. The snapshot
request has its own scoped `subjectRequest`, so its resolved subject can differ from the repository
inventory subject. Extract `snapshot.subjectId` from the admitted snapshot result, then use
`{"kind":"RESOLVED_SUBJECT","subjectId":"<snapshot-subject-id>"}` for dependent `query`,
`impact`, `findings`, `explain`, and `verify` requests. Reuse an earlier subject ID only when the
later operation independently resolves the identical subject.

Inventory deliberately performs two consecutive canonical captures and admits a result only if
their exact subject identities agree.

### 4.4 Bind the request programmatically

Do not hash serialized JSON text yourself. Import `codingAgentCliInputDigest`, because the binding is
over CSAA's validated canonical operation input. The tested pattern is:

```ts
import {
  AGENT_OPERATION_PROTOCOL_VERSION,
  AGENT_OPERATION_VERSIONS,
  CODING_AGENT_CLI_INPUT_CONTRACT_ID,
  CODING_AGENT_CLI_INPUT_VERSION,
  codingAgentCliInputDigest,
  type AgentOperation,
  type AgentOperationRequest,
  type AgentProtocolResourceBudget,
  type AgentSubjectInput,
  type AgentWorkContext,
  type CodingAgentCliOperationInput
} from '@janumipwb/csaa';

function bindRequest(options: {
  operation: AgentOperation;
  input: CodingAgentCliOperationInput;
  subjectInput: AgentSubjectInput;
  capability: AgentOperationRequest['capabilityRequirement'];
  budgets: AgentProtocolResourceBudget;
  work: AgentWorkContext;
  requestId: string;
  requestedAt: string;
}): AgentOperationRequest {
  const digest = codingAgentCliInputDigest(options.input);
  if (digest.state !== 'VALID') throw new Error(JSON.stringify(digest));

  return {
    budgets: options.budgets,
    capabilityRequirement: options.capability,
    currentnessRequirement: { kind: 'REQUIRE_CURRENT' },
    messageKind: 'request',
    operation: options.operation,
    operationInput: {
      contractId: CODING_AGENT_CLI_INPUT_CONTRACT_ID,
      contractVersion: CODING_AGENT_CLI_INPUT_VERSION,
      inputDigest: digest.digest,
      inputRef: options.input.bindingRef
    },
    operationVersion: AGENT_OPERATION_VERSIONS[options.operation],
    protocolVersion: AGENT_OPERATION_PROTOCOL_VERSION,
    requestId: options.requestId,
    requestedAt: options.requestedAt,
    subjectInput: options.subjectInput,
    work: options.work
  };
}
```

Choose budgets that are justified by the target and that fit inside the protocol ceilings. Do not
copy a large smoke-test budget into an ordinary task without need. The command, request operation,
input `kind`, contract version, `inputRef`, and canonical `inputDigest` must all reconcile.
`requestedAt` must be RFC 3339 with milliseconds, and `work.userRequestDigest` must be a lowercase
SHA-256 digest of the bound user request.

Capability requirements for the current composition are:

| Operation | Capability ID | Capability version |
| --- | --- | --- |
| `inventory` | `IMPLEMENTATION_LOCAL_REPOSITORY_INVENTORY` | `IMPLEMENTATION_LOCAL_REPOSITORY_INVENTORY@0.1.0` |
| `snapshot` — syntax evidence | `JAN-CSAA-CAP-001` | `JAN-CSAA-CAP-001@0.1.0` |
| `snapshot` — symbol evidence | `JAN-CSAA-CAP-002` | `JAN-CSAA-CAP-002@0.1.0` |
| `snapshot` — type evidence | `JAN-CSAA-CAP-003` | `JAN-CSAA-CAP-003@0.1.0` |
| `query` | `JAN-CSAA-CAP-029` | `JAN-CSAA-CAP-029@0.1.0` |
| `impact` | `JAN-CSAA-CAP-031` | `JAN-CSAA-CAP-031@0.1.0` |
| `findings` | `IMPLEMENTATION_LOCAL_JPWB_HARMONIZATION_FINDINGS` | `IMPLEMENTATION_LOCAL_JPWB_HARMONIZATION_FINDINGS@2.0.0` |
| `explain` | `IMPLEMENTATION_LOCAL_EXACT_FINDING_EXPLANATION` | `IMPLEMENTATION_LOCAL_EXACT_FINDING_EXPLANATION@1.0.0` |
| `verify` | `IMPLEMENTATION_LOCAL_ARTIFACT_WORKFLOW_VERIFICATION` | `IMPLEMENTATION_LOCAL_ARTIFACT_WORKFLOW_VERIFICATION@0.1.0` |

The complete current request builder, calibrated budgets, work context, and artifact chain are in
[`current-jpwb-coding-agent-workflow.integration.test.ts`](./src/cli/current-jpwb-coding-agent-workflow.integration.test.ts).
Use that executable example when constructing a new host; do not infer missing closed fields from
the abbreviated examples in prose.

### 4.5 Closed operation-input shapes

Every input includes `bindingRef`, `output: "STDOUT_JSON"`, and
`schemaVersion: "jan-csaa-coding-agent-cli-input/0.1.0"`. Add only these operation fields:

| Command | Required operation fields |
| --- | --- |
| `inventory` | `kind: "INVENTORY"`, `subjectInputRef` |
| `snapshot` | `kind: "SNAPSHOT"`, `subjectInputRef` |
| `query` | `kind: "QUERY"`, `queryRef`, `snapshotRef` |
| `impact` | `kind: "IMPACT"`, `changeSetRef`, `snapshotRef` |
| `findings` | `kind: "FINDINGS"`, `ruleProfileRef`, `snapshotRef` |
| `explain` | `kind: "EXPLAIN"`, `explanationProfileRef`, `resultRef` |
| `verify` | `kind: "VERIFY"`, `expectationRef`, `subjectInputRef` |

Unknown or missing properties are refused; these are closed shapes.

## 5. Use-case cookbook

### 5.1 Repository intake: inventory, then snapshot

Use `inventory` to establish the canonical repository population and exact subject identity. Use
`snapshot` when later questions need TypeScript syntax, project, symbol, or type evidence.

The snapshot operation artifact is a `STATIC_SEMANTIC_SNAPSHOT_REQUEST` containing a closed
`subjectRequest` and `semanticRequest`. Both use the literal `"<repository-root>"` sentinel; the
semantic request may use `"<resolved-subject>"` until the handler binds the exact subject.

Start from these executable examples:

- Inventory artifact and invocation:
  [`coding-agent-process.spawn.integration.test.ts`](./src/cli/coding-agent-process.spawn.integration.test.ts)
  near the inventory-to-snapshot transition.
- Current JPWB semantic budgets and request:
  [`current-jpwb-coding-agent-workflow.integration.test.ts`](./src/cli/current-jpwb-coding-agent-workflow.integration.test.ts)
  in the `STATIC_SEMANTIC_SNAPSHOT_REQUEST` block.

Inspect `snapshot.health`, per-capability states, diagnostics, source population, project population,
and subject ID. The current JPWB workflow can legitimately produce a useful partial snapshot. A
partial symbol region is not complete symbol knowledge.

### 5.2 Find a source or answer a semantic question

Use agent `query` when the result belongs in a durable workflow. Use the direct semantic-source
query script for a one-off report:

```powershell
Get-Content -Raw .csaa\agent-work\semantic-query.json |
  bun run csaa:analyze:semantic-source-query -- --stdin

# Or read one regular JSON file directly.
bun run csaa:analyze:semantic-source-query -- --request .csaa\agent-work\semantic-query.json
```

A common exact-path expression is:

```json
{
  "field": "logicalPath",
  "kind": "EQUALS",
  "nodeId": "root",
  "value": "packages/rph-contracts/src/common.ts"
}
```

Put that expression inside the complete
`jan-csaa-semantic-source-query-report-request/0.2.0` request. Copy the full request shape and
budgets from
[`run-semantic-source-query-report.test.ts`](./src/application/run-semantic-source-query-report.test.ts)
or the current workflow test, then change only deliberate query and identity fields.

Implemented expressions cover fixed scalar equality, case-sensitive logical-path prefix, `NOT`,
`AND`, and `OR`. They do not provide regex, glob, traversal, joins, aggregation, paging, or universal
negative closure. Always inspect all four result partitions.

### 5.3 Estimate impact before an edit

Use agent `impact` with a static-module impact request, or run:

```powershell
bun run csaa:analyze:static-module-impact-candidates -- `
  --request .csaa\agent-work\static-impact.json
```

The seed binds a logical path, expected artifact SHA-256, project config, operation such as `EDIT`,
scope, and caller-declared working-change-set identity. Start from
[`run-static-module-impact-candidate-report.test.ts`](./src/application/run-static-module-impact-candidate-report.test.ts)
or the live example in the current workflow test.

The static request's `workingChangeSetId` is caller-owned and opaque. This analysis does not inspect
the declared change content or independently validate that identity; its result records that
provenance limitation.

Every returned item is a `POSSIBLE` candidate. Zero candidates does not prove non-impact. This
surface does not close call, control-flow, data-flow, framework, runtime, or test-mapping impact and
does not prove safe deletion or behavior preservation.

### 5.4 Analyze one actual working-source edit

After changing one tracked source file, use:

```powershell
bun run csaa:analyze:working-source-edit-impact-candidates -- `
  --request .csaa\agent-work\working-edit-impact.json
```

This surface independently binds the HEAD blob, stage-zero index entry, and current working bytes,
then reports structural importer candidates. Its current contract supports exactly one tracked,
existing, regular UTF-8 source edit whose index still matches HEAD. It does not support add, delete,
rename, copy, binary, multi-file, unmerged, or repository-wide dirty-state analysis.

Use the request factory in
[`run-working-source-edit-impact-candidate-report.test.ts`](./src/application/run-working-source-edit-impact-candidate-report.test.ts).
If the edit is outside the supported shape, report that limitation and use Git inspection plus the
applicable targeted tests; do not describe an unsupported CSAA run as clean.

The default seven-command launcher separately resolves selected working-tree bytes through the
ordinary frozen-subject resolver, with no bound Git revision. It does not expose the internal,
Git-aware full Working Change Set resolver. Do not claim that an agent inventory or snapshot alone
binds the complete index, rename/copy set, all untracked files, or other full Git working state.

### 5.5 Understand project, module, declaration, and resolution structure

All direct report adapters accept exactly one of `--stdin` or `--request <regular-json-file>`:

```powershell
bun run csaa:analyze:<name> -- --request .csaa\agent-work\request.json
```

| Question | Analyzer | Executable request example |
| --- | --- | --- |
| Which project owns a source and which projects reference it? | `project-context` | `src/application/run-project-context-report.test.ts` |
| Which static module occurrences and edges exist? | `module-dependency` | `src/application/run-module-dependency-report.test.ts` |
| How did a module specifier resolve? | `module-resolution-trace` | `src/application/run-module-resolution-trace-report.test.ts` |
| What declaration context surrounds a target? | `declaration-context` | `src/application/run-declaration-context-report.test.ts` |
| What is structurally reachable forward or in reverse? | `structural-module-reachability` | `src/application/run-structural-module-reachability-report.test.ts` |
| Which structural module cycles/SCCs exist? | `structural-scc` | `src/application/run-structural-scc-report.test.ts` |

These are bounded TypeScript/project projections, not proof of runtime closure, dead code, safe
removal, or behavior preservation.

### 5.6 Examine calls, effects, state machines, commands, and guards

| Question | Analyzer |
| --- | --- |
| What static call candidates are retained? | `call-graph` |
| What read/write access candidates are retained? | `read-write-access` |
| What generated JPWB transition-table topology is present? | `state-machine-graph` |
| How do module and call projections compose? | `logical-graph-composition` |
| What Arrow command members are present? | `arrow-command-census` |
| How do command handlers relate? | `command-handler-graph` |
| How are commands dispatched? | `command-dispatch-topology` |
| How do commands and emitted events overlay? | `command-event-contract-overlay` |
| Where are guards declared and enforced? | `guard-enforcement-ledger` |
| How are guard sites classified? | `guard-classification-overlay` |

Invoke each through `bun run csaa:analyze:<name> -- --request <request.json>`. Copy the request
factory from the matching `packages/csaa/src/application/run-*-report.test.ts` or matching adapter
test. A call candidate is not a proven runtime call target; read/write evidence is not a general
data-flow graph; the state-machine surface is specific to the generated JPWB tables; repository-
specific command and guard projections do not confer architecture or policy authority.

### 5.7 Review native JPWB findings and explain one exact finding

Run agent `findings` against a retained snapshot. The current native projection evaluates all 23
first-increment rules and five source-bound hybrid prerequisite rows. Use `executionDisposition:
"RUN"` for native projection or `"NOT_RUN"` when recording that it was deliberately not executed.

Runtime enrichment is optional caller-supplied deterministic evidence. CSAA imports the referenced
trace; it does not launch a runtime provider or execute subject code. Never invent a trace or mark
missing runtime coverage conclusive.

To explain one result, publish an `EXACT_FINDING_EXPLANATION_PROFILE` containing the exact
`findingId`, `evaluationId`, and nullable finding fingerprint from the stored findings artifact,
then invoke `explain`. Explanation independently replays the projection and copies exact evidence;
it does not infer root cause or remediation.

Use the `findings` and `explain` blocks in the current workflow integration test as the complete
executable example.

### 5.8 Verify a stored evidence workflow

Agent `verify` accepts an `ARTIFACT_WORKFLOW_EXPECTATION` with exact subject/snapshot bindings and
one to 32 conjunctive `ARTIFACT_DIGEST_EQUALS` or `JSON_VALUE_EQUALS` assertions across at most
eight artifacts.

Use it to assert statements such as:

- a referenced artifact has the expected content digest;
- an explanation binds the intended findings artifact;
- a retained JSON field has an exact expected value;
- all assertions refer to the intended subject and snapshot.

The complete pass/fail examples are in
[`coding-agent-process.spawn.integration.test.ts`](./src/cli/coding-agent-process.spawn.integration.test.ts)
and the current workflow test. Verification checks stored evidence only. It does not run tests,
establish conformance, or activate a gate.

### 5.9 Check repository evidence and technical completion

Use the narrowest checks that correspond to the files and evidence you changed:

```powershell
bun run csaa:generated-context:check
bun run csaa:inventory:check
bun run csaa:content-store-performance:check
bun run csaa:persistence-selection:check
bun run csaa:dependency-cruiser-differential:check
bun scripts/csaa-dependency-cruiser-differential.ts --g4-check
```

Use normal repository checks as required by the change:

```powershell
bun run check-types
bun run boundary
bun run build
bun run test:src
bun run test:dist
bun run test:coverage
```

Only use the serialized completion command when preparing the complete staged CSAA implementation
candidate:

```powershell
bun run csaa:completion:check
```

It requires an explicitly staged candidate with no unstaged tracked bytes and includes the real
seven-operation workflow, the full repository gate, coverage, and mutation testing. It is not a
routine preflight and does not perform the external G10 integrated corpus review.

## 6. Interpret outputs correctly

For the seven-command agent process, progress responses are canonical JSON Lines on `stderr` and a
validated operation terminal response is written to `stdout`. Process admission or host-composition
diagnostics use `stderr` and leave `stdout` empty. A validated operation-level internal failure can
still have its terminal response on `stdout`, so parse nonempty stdout regardless of exit code.

### Seven-command agent-process exits

| Exit | Category | Agent action |
| ---: | --- | --- |
| `0` | `SUCCESS` | Inspect the exact result and its authority/currentness before using it. |
| `2` | `INVALID_REQUEST` | Correct the closed shape, version, reference, budget, binding, or canonical input digest. |
| `3` | `INCOMPLETE_OR_UNSUPPORTED` | Inspect the terminal response and any admitted result. Useful partial evidence commonly exits `3`. |
| `4` | `FAILED_EXPECTATION` | Treat the declared assertion as failed; inspect the retained verification evidence. |
| `5` | `INTERNAL_FAILURE` | Make no result claim. Preserve diagnostics and investigate trusted composition/store failure. |

Do not flatten every nonzero exit into the same failure. Parse at least:

- `exitCategory` and `outcome`;
- `currentness.status` and subject/snapshot bindings;
- capability coverage and execution health;
- conflict, excluded-region, unknown-region, and limitation references;
- diagnostics and warning references;
- `partial.admittedResultRefs` or refusal evidence references.

An exit `3` can be the expected useful outcome because current capability coverage is
not falsely promoted to complete. `partial` is neither blanket success nor blanket failure.

### Direct-report exits

Direct `csaa:analyze:*` adapters use a different terminal contract. They do not generally emit the
agent protocol's `exitCategory` field.

| Exit | Direct-report meaning |
| ---: | --- |
| `2` | Incompatible/invalid request or request-source admission failure. |
| `3` | Useful partial or resource refusal; impact reports also use it for stale evidence. |
| `4` | Other failed or internal outcome. |

Parse the direct report's own `outcome`, `state`, diagnostics, coverage, and evidence fields rather
than assuming the agent-process terminal shape.

## 7. Failure and reanalysis playbook

| Symptom | Likely meaning | Required response |
| --- | --- | --- |
| Input/request refused before execution | Open/incomplete shape, wrong version, unsafe reference, binding mismatch, or wrong digest | Validate the exact closed contract and recompute with `codingAgentCliInputDigest`. |
| Snapshot or result is stale | Relevant subject identity changed | Discard the currentness claim, recapture inventory/snapshot as required, and rerun dependent operations. |
| Partial/unsupported result | A bounded region completed but required coverage remains open | Use admitted evidence only for its completed region; report missing/unknown regions. |
| `UNKNOWN` query region | Evidence cannot decide the predicate | Preserve `UNKNOWN`; narrow or enrich the evidence instead of reporting no match. |
| `CONFLICT` | Retained evidence disagrees | Preserve both sides and the conflict references; do not choose silently. |
| Resource refusal or timeout | Calibrated bounds were insufficient or work exceeded them | Inspect partial evidence, narrow the subject/question, or deliberately justify a bounded increase. |
| Failed verification | At least one declared exact expectation is false | Report the failed assertion and decide whether the implementation or expectation is wrong. |
| Internal failure | Trusted composition or store could not produce a valid result | Make no success claim; preserve diagnostics and investigate before retrying. |

## 8. Suggested coding-agent lifecycle

### Before design or planning

1. Confirm the intended worktree and current Git state.
2. Run inventory; capture a snapshot if the question needs semantic facts.
3. Use project/module/query reports to identify the relevant bounded population.
4. Run static impact for proposed edit seeds.
5. Record unsupported and unknown regions in the plan.

### During implementation

1. Keep the change within the authorized worktree and scope.
2. After each coherent increment, rerun the narrow relevant analysis or targeted test.
3. For one supported tracked edit, use working-source-edit impact.
4. Recapture any subject-bound evidence made stale by the edit.

### Before handoff or merge

1. Run targeted build, type, boundary, and test checks appropriate to the patch.
2. Rerun affected CSAA queries, impact, or findings against the final current subject.
3. Use `verify` when exact cross-artifact assertions materially strengthen the handoff.
4. Report subject/snapshot IDs, admitted result refs, currentness, coverage, conflicts, exclusions,
   unknown regions, commands, exits, and nonclaims.
5. Do not claim approval, safe removal, complete impact closure, behavior preservation, or merge
   authority from CSAA output.

A compact handoff record can use this shape:

```text
CSAA use case:
Worktree / Git state:
Subject ID:
Snapshot ID:
Operation(s) and version(s):
Request/result artifact refs:
Terminal exit category:
Currentness:
Supported/completed regions:
Partial/unsupported/excluded/unknown/conflicting regions:
Corroborating tests/checks:
Remaining nonclaims and risk:
```

## 9. Limits agents commonly misread

- Explicit `artifact put`/`artifact get` transport is capped at 16 MiB. That is not the semantic
  snapshot ceiling.
- An operation input artifact is capped at 1 MiB. The explicit transport can therefore publish a
  larger artifact that an operation handler correctly refuses to consume as an input.
- Internally persisted admitted-result artifacts can be up to 128 MiB, and the current JPWB smoke
  authorizes up to 96 MiB for its snapshot. Larger local results can flow to later operations by
  reference even when they cannot be dumped through the 16 MiB explicit transport.
- Terminal and progress protocol messages are capped at 1 MiB.
- The default store is `.csaa/coding-agent-artifacts`. It is immutable, content-addressed,
  revalidated on read, local, rebuildable, gitignored, and non-authoritative.
- One retained generation is additionally bounded to 4,096 artifacts, 128 MiB per artifact, and
  1 GiB total stored bytes.
- The current widest native-rule population is 371 explicit members against a 512-member ceiling.
  That calibration is current-JPWB evidence, not a universal repository-size rule.
- Advanced CodeQL/Joern-style provider support is experimental and currently `DEFER`; no advanced
  provider is installed or qualified.
- The reviewed dependency-cruiser evidence is bounded differential evidence, not repository-wide
  compiler/provider equivalence, architecture compliance, or provider qualification.

## 10. Executable implementation map

Use these files when prose and implementation appear to disagree:

| Concern | Source of truth |
| --- | --- |
| Agent request/response protocol and operation versions | `src/agent/agent-operation-protocol.ts` |
| Closed CLI operation inputs and digest binding | `src/cli/coding-agent-cli-contract.ts` |
| Artifact transport and store limits | `src/cli/coding-agent-cli-artifact-store.ts` |
| Seven operation handlers and artifact shapes | `src/cli/compose-coding-agent-cli-handlers.ts` |
| Stdin process envelope | `src/cli/run-coding-agent-process.ts` |
| Real current-JPWB seven-operation example | `src/cli/current-jpwb-coding-agent-workflow.integration.test.ts` |
| Spawned process and stale/pass/fail examples | `src/cli/coding-agent-process.spawn.integration.test.ts` |
| Direct analyzer launchers | `../../scripts/csaa-*.ts` |
| Package scripts and available analyzer names | `../../package.json` |
| Detailed operational limits and repository checks | [Package README](./README.md) |

For controlled CSAA design references, consult the following. These listed `JAN-CSAA` members are
currently Draft with authority `None`; they are not effective governing authority.

- [JAN-CSAA-003 — Analysis Enrichment Query and Change Impact Specification](<../../docs/ASTs and Code Analysis/JAN-CSAA-003 - Analysis Enrichment Query and Change Impact Specification.md>)
- [JAN-CSAA-004 — Code Analysis Rule Gate and Analyzer Provider Contract](<../../docs/ASTs and Code Analysis/JAN-CSAA-004 - Code Analysis Rule Gate and Analyzer Provider Contract.md>)
- [JAN-CSAA-007 — Semantic Snapshot Graph Query Analysis Record and Adapter Contract Package](<../../docs/ASTs and Code Analysis/JAN-CSAA-007 - Semantic Snapshot Graph Query Analysis Record and Adapter Contract Package.md>)
- [JAN-CSAA-009 — Index Persistence Incremental Reanalysis Recovery and Operations Design](<../../docs/ASTs and Code Analysis/JAN-CSAA-009 - Index Persistence Incremental Reanalysis Recovery and Operations Design.md>)
- [JAN-CSAA-010 — Coding Agent Analysis Employment Profile](<../../docs/ASTs and Code Analysis/JAN-CSAA-010 - Coding Agent Analysis Employment Profile.md>)
- [JAN-CSAA-011 — TypeScript and Analysis Tool Integration Standard](<../../docs/ASTs and Code Analysis/JAN-CSAA-011 - TypeScript and Analysis Tool Integration Standard.md>)

The controlled documents describe the intended architecture and semantics; inspect each document's
current metadata before treating it as authoritative. Executable contracts and tests define what
this implementation currently accepts and produces. When the two differ, preserve the distinction
and do not promote implementation-local behavior into governance authority.
