# AODD Design Memo — janumicode v2

**Status**: Approved 2026-05-26. Resolves the ten open questions in `aodd-principles.md`. Implementation proceeds per the phased migration in §11.3, with per-phase confirmation.
**Date**: 2026-05-26.
**Companion**: `aodd-principles.md` (locks the principles and architectural boundary).

---

## 0. Scope recap

This memo decides the concrete shape of the AODD trace layer. The principles doc fixed the boundary: the SQLite DB is untouched; AODD is a parallel, file-first, TTL-bounded observability layer whose audience is AI coding agents finishing v2. Logger is AODD-aware; EventBus is not; dual-emit at shared call-sites.

This memo does not contain implementation code. It locks contracts and migration sequence so implementation can proceed deterministically.

---

## 1. Event schema

### 1.1 Decision

A unified event envelope. One event = one NDJSON line. Event types are a typed registry (union of literals + payload map, EventBus-style), not free-form strings.

**Envelope** (all fields required unless noted):

```ts
interface AoddEvent<T extends AoddEventType = AoddEventType> {
  schema_version: number;        // AODD schema, integer, bump on breaking change
  event_id: string;              // ULID
  event_type: T;                 // dotted: "phase.entered", "llm.invoked", etc.
  ts: string;                    // ISO8601 UTC
  run_id: string;                // canonical workflow_run_id
  phase_id: PhaseId | null;      // canonical form ("1", "0.5", "10") — see §3
  sub_phase_id: string | null;
  invocation_id: string | null;
  agent_role: string | null;
  parent_event_id: string | null;     // chain for nested cognition (push/pop)
  caused_by_event_id: string | null;  // semantic causation (distinct from parent)
  payload: AoddEventPayload[T];
  metadata: Record<string, unknown> | null;  // supplemental, untyped
}
```

### 1.2 Event-type registry

Initial event types, grouped by namespace:

| Namespace | Event types |
|---|---|
| `run.*` | `run.started`, `run.completed`, `run.resumed`, `run.failed` |
| `phase.*` | `phase.entered`, `phase.exited` |
| `sub_phase.*` | `sub_phase.entered`, `sub_phase.exited`, `sub_phase.summary` |
| `llm.*` | `llm.invoked`, `llm.returned`, `llm.failed`, `llm.cache_hit` |
| `agent.*` | `agent.invocation_started`, `agent.invocation_completed`, `agent.reasoning_step`, `agent.self_correction`, `agent.tool_call`, `agent.output_skipped`, `agent.output_write_failed` |
| `prompt.*` | `prompt.template_rendered`, `prompt.materialized` |
| `record.*` | `record.added`, `record.updated`, `record.quarantined` |
| `decision.*` | `decision.requested`, `decision.resolved`, `decision.escalated` |
| `mirror.*` | `mirror.presented`, `mirror.resolved` |
| `validator.*` | `validator.run`, `validator.finding` |
| `gate.*` | `gate.pending`, `gate.approved`, `gate.rejected` |
| `repair.*` | `repair.json_attempted`, `repair.json_succeeded`, `repair.json_failed` |
| `retry.*` | `retry.scheduled`, `retry.attempted` |
| `audit.*` | `audit.pause_emitted`, `audit.pause_resolved` |
| `log.*` | `log.debug`, `log.info`, `log.warn`, `log.error` |
| `test.*` | `test.run_started`, `test.suite_completed`, `test.run_completed` |
| `eval.*` | `eval.started`, `eval.completed` |
| `context.*` | `context.assembled`, `context.detail_file_written` |

Two design choices that fall out of this:

- **Naming convention is `namespace.action`**, not `namespace:action` (EventBus uses `:`). The dot is canonical for AODD and signals "this is a different layer." This prevents accidental cross-namespace overlap.
- **Field naming is snake_case** throughout AODD payloads (matches LLM-emit norm; see `feedback_normalizer_case_dual_keys.md`). EventBus stays camelCase. The dual-emit pattern carries the transform explicitly.

### 1.3 Schema versioning

`schema_version` is an integer, starting at `1`. Bump only on breaking changes (field removal, type change). Additive changes (new optional fields, new event types) do not bump.

A single `AODD_SCHEMA_VERSION` constant lives in `src/lib/aodd/types.ts`. No per-record-type version map.

### 1.4 Tradeoff considered and rejected

Free-form `event_type` strings (lifecycle.ndjson's current model) were rejected. Typed registries cost typing effort up front and pay back in two places: TypeScript-checked payload shape at every call-site, and a single source of truth that test fixtures and the replay tool can derive completeness from. Free-form strings let `emitLifecycle('phase_9.dispatch_order_selected', ...)` coin a name no one downstream knows about — that is the fragmentation we're closing.

---

## 2. Stream layout

### 2.1 Decision

One primary structured event stream per run, plus a sidecar payload store for large content. Summaries are separate files, one per sub-phase.

```
.janumicode/runs/<run_id>/aodd/
  events.ndjson                   primary structured event stream
  payloads/                       large content referenced by event lines
    <ulid>.json                   one file per oversized payload
    <ulid>.txt                    plain text payloads (prompt text, model output)
  summaries/
    phase-<phase_id>/
      <sub_phase_id>.summary.json   machine-readable summary
      <sub_phase_id>.summary.md     human-readable, derived from .json
    run.summary.json                run-level summary (emitted on run.completed/failed)
    run.summary.md
  index.json                       lightweight pointer index for fast lookup
  .keep                            (optional) sentinel: never prune this run
```

### 2.2 Why one structured stream

A single `events.ndjson` makes joining trivial (parent chains are local greps), retention easy (delete one directory), and CLI access predictable. Partitioning by namespace was considered and rejected: would force readers to know which file an event lives in before they can chain back across namespaces (e.g., `llm.returned` ← `prompt.materialized`).

### 2.3 Why payloads are sidecar files

The transforms.jsonl in workspace-104 was 13MB and that was largely from in-line LLM prompt+response text. Inlining megabyte-scale payloads makes `events.ndjson` impractical for line-oriented tools. The sidecar pattern keeps event lines small (typically <2 KB) and parks the heavy content where the line can reference it by ULID. An event payload field becomes either inline (small structured data) or a pointer `{ "payload_ref": "01HXY..." }`.

Threshold for inlining vs spilling: payload byte size > 4 KB OR contains free-form text fields exceeding 1 KB.

### 2.4 `index.json`

A small file emitted at run completion that maps `sub_phase_id` → `{ first_event_id, last_event_id, summary_path }`. Lets the replay tool jump to a specific sub-phase without scanning `events.ndjson`. Cheap to rebuild from `events.ndjson` if lost.

---

## 3. ID normalization

### 3.1 Decision

The **canonical form is the bare `PhaseId` string** (`"1"`, `"0.5"`, `"10"`) — the form already used by the type system at `src/lib/types/records.ts:109-121`. AODD events store this verbatim. No transformations.

Decorated forms (`phase1`, `phase01`, `phase00_5`) exist only because filesystems need safe characters and lexical sort. They are derived at the boundary by a single utility:

```ts
// src/lib/aodd/idCanonicalize.ts
export function phaseIdToFilenameSegment(id: PhaseId, opts?: { padded?: boolean }): string;
// "1"   → "phase1"   (padded:false)   or   "phase01" (padded:true)
// "0.5" → "phase0_5" (padded:false)   or   "phase00_5" (padded:true)
// "10"  → "phase10"                   or   "phase10"
```

### 3.2 Migration of existing writers

Three writers currently roll their own:

- `src/lib/orchestrator/auditPause.ts:164` — uses `phase{X}` with `.` → `_`. **Refactor**: call `phaseIdToFilenameSegment(id, { padded: false })`.
- `src/lib/llm/llmCaller.ts:1503` — uses `phase{XX}_{YY}` padded. **Refactor**: call `phaseIdToFilenameSegment(id, { padded: true })`.
- `src/lib/trace/lifecycle.ts` — uses raw `PhaseId`. **No change** (already canonical).

Three call-sites to fix, one utility to introduce. Small, atomic.

### 3.3 `sub_phase_id` and `invocation_id`

`sub_phase_id` is already a free-form string and renders identically everywhere. No normalization needed beyond ensuring it appears in every event that has a current sub-phase scope.

`invocation_id` is a UUID v4 today; we adopt ULID for new AODD `event_id`s (lexically sortable, preserves ordering when filenames embed them). `invocation_id` itself stays UUID v4 to avoid touching the existing invocation tracking.

---

## 4. Summary artifact format

### 4.1 Decision

Twin files per sub-phase: `<sub_phase_id>.summary.json` (machine source-of-truth) and `<sub_phase_id>.summary.md` (human-readable, **generated from** the JSON at write time so they cannot diverge).

A run-level summary follows the same twin-file pattern at `summaries/run.summary.{json,md}`.

### 4.2 Summary JSON schema (5W+H)

```ts
interface SubPhaseSummary {
  schema_version: number;
  run_id: string;
  phase_id: PhaseId;
  sub_phase_id: string;

  // WHEN
  started_at: string;
  completed_at: string;
  duration_ms: number;

  // WHO
  who: {
    agent_role: string | null;
    model: string;
    model_parameters: { temperature?: number; max_tokens?: number; [k: string]: unknown };
    invocation_chain: Array<{ invocation_id: string; depth: number }>;
  };

  // WHAT
  what: {
    inputs_consumed: Array<{ record_id: string; record_type: string; brief: string }>;
    outputs_produced: Array<{ record_id: string; record_type: string; brief: string }>;
    decisions: Array<{ kind: 'validator_finding' | 'mirror' | 'gate' | 'escalation'; ref_event_id: string; brief: string }>;
  };

  // WHY
  why: {
    template_key: string;
    template_source_sha: string;       // git sha of the prompt template file at call time
    rendered_prompt_ref: string;       // payload_ref ULID in payloads/
    governing_constraints: string[];   // identifiers, not bodies
  };

  // HOW
  how: {
    retries: number;
    repairs: number;                   // json_repair events
    escalations: number;
    fallbacks: Array<{ from: string; to: string; reason: string }>;
    status: 'success' | 'partial' | 'failed';
    error: { event_id: string; message: string } | null;
  };

  // joinability
  events: {
    first_event_id: string;
    last_event_id: string;
    count: number;
  };
}
```

### 4.3 Completeness invariant

The summary writer must be unable to emit if any 5W+H field cannot be derived from observed events. If `template_source_sha` is unknown, the summary writer raises — it does not silently emit `null`. This is the principle "trace completeness is a regression test" enforced at write time, not only at fixture-replay time.

### 4.4 Markdown rendering

The `.md` companion is purely a projection. A single deterministic renderer (`renderSubPhaseSummary(s: SubPhaseSummary): string`) produces it. Tests assert it round-trips a fixed schema.

---

## 5. Dual-emit mechanics

### 5.1 Decision

Explicit paired emits at the call-site. No magic helper that emits both from one call. Each side gets its own native shape:

```ts
// at src/lib/agents/executorAgent.ts:289
eventBus.emit('agent:reasoning_step', { invocationId, content, sequencePosition });
aodd.emit('agent.reasoning_step', {
  invocation_id: invocationId,
  content,
  sequence_position: sequencePosition,
});
```

### 5.2 Why explicit, not unified

EventBus payloads use camelCase and are shaped for in-app webview consumption. AODD payloads use snake_case and are shaped for forensic reconstruction. A helper hiding both calls would couple the two surfaces and force one to adopt the other's conventions. The 14 call-sites that need dual-emit (enumerated in §12) are a one-time tax, not a recurring burden.

### 5.3 AODD-only emits

Most AODD events have no EventBus counterpart (e.g., `prompt.materialized`, `validator.finding`, `repair.json_attempted`). Those are single emits via the AODD API only.

### 5.4 Emit API

```ts
// src/lib/aodd/emit.ts
export function emit<T extends AoddEventType>(
  event_type: T,
  payload: AoddEventPayload[T],
  options?: {
    parent_event_id?: string;
    caused_by_event_id?: string;
    metadata?: Record<string, unknown>;
  },
): string;  // returns event_id

// scoped helpers for parent-chain pushing (mirrors withTraceContext)
export async function withAoddSpan<R>(
  event_type: AoddEventType,
  payload: AoddEventPayload[AoddEventType],
  fn: () => Promise<R>,
): Promise<R>;
```

`emit()` reads `currentTraceContext()` from `src/lib/trace/traceContext.ts` for run/phase/sub_phase IDs and `currentParentStep()` for the default `parent_event_id`. `withAoddSpan` pushes an event onto `step_chain` for its body's duration, so nested emits inherit the parent. This reuses the existing AsyncLocalStorage rather than introducing a third trace-context.

---

## 6. Logger integration

### 6.1 Decision

Widen `Logger` to expose an additive `addHandler()` seam. Add a new `AoddLogHandler` that translates `LogEntry` → AODD `log.<level>` events. Both existing handlers (Console, OutputChannel) remain in place; AODD becomes a third handler that captures persistently.

### 6.2 Logger API delta

`src/lib/logging/logger.ts` gains two public methods:

```ts
addHandler(handler: LogHandler): () => void;   // returns dispose
removeHandler(handler: LogHandler): void;
```

The existing `setOutputChannel()` is unaffected.

### 6.3 `AoddLogHandler` shape

```ts
// src/lib/aodd/loggerHandler.ts
class AoddLogHandler implements LogHandler {
  constructor(private minLevel: LogLevel = 'DEBUG') {}
  handle(entry: LogEntry): void {
    aodd.emit(`log.${entry.level.toLowerCase()}`, {
      trace_id: entry.trace_id,
      category: entry.category,
      message: entry.message,
      data: entry.data,
      duration_ms: entry.duration_ms,
    });
  }
  setLevel(level: LogLevel): void { this.minLevel = level; }
}
```

### 6.4 Trace context bridge

Logger uses `src/lib/logging/traceContext.ts` `TraceContext` (carries `trace_id`, `agent_role`, `parent_record_id`). AODD uses `src/lib/trace/traceContext.ts` `TraceCtx` (carries `workflow_run_id`, `phase_id`, `sub_phase_id`, `step_chain`). They are siblings today.

For AODD log capture, we do **not** unify them. The `AoddLogHandler` reads the AODD `TraceCtx` for run/phase/sub_phase IDs (which `aodd.emit` already does) and carries the Logger's `trace_id` through as a payload field. Two trace contexts, one bridging point, no schema unification needed.

### 6.5 Level policy

`AoddLogHandler` default level: `DEBUG`. Captures everything. Overridable via env var `JANUMICODE_AODD_LOG_LEVEL`. Pruning of volume happens at retention, not at capture (principle 3).

---

## 7. Retention policy

### 7.1 Decision

Per-run TTL + run-count cap, configurable, with operator override via `.keep` sentinel file.

### 7.2 Config keys

```jsonc
// workspace .janumicode/config.json — new "aodd" block
{
  "aodd": {
    "retention": {
      "max_runs": 10,                  // keep last N runs; older deleted
      "ttl_days": 30,                  // also delete runs older than this
      "min_runs": 3                    // floor — keep at least this many regardless of TTL
    }
  }
}
```

Defaults shown. `min_runs` prevents an aggressive `ttl_days` from clearing all runs if the system has been idle.

### 7.3 When pruning runs

At AODD initialization (run start), before the new run's directory is created. Single-threaded with the orchestrator boot path. Not a background timer. This avoids surprise deletions and makes the prune step deterministic in the lifecycle event stream.

### 7.4 `.keep` sentinel

An operator can drop an empty file `runs/<run_id>/aodd/.keep` to mark a run permanent. Pruning skips any run with `.keep` present. Counted against neither `max_runs` nor `ttl_days`. Useful for runs being actively debugged or referenced from a bug report.

### 7.5 DB is not touched

To repeat for clarity: AODD pruning deletes only files under `runs/<run_id>/aodd/`. The DB (`test-harness/<unix_ms>.db`) is governed by separate (existing or future) lifecycle rules. The non-AODD files in `runs/<run_id>/` — currently `lifecycle.ndjson`, `transforms.jsonl`, `context/` — are also out of scope for AODD pruning until those streams are migrated (see §12 phasing).

---

## 8. Replay surface

### 8.1 Decision

Three layers, in increasing convenience cost: file-system, CLI, library.

### 8.2 File-system layer

NDJSON is the source of truth. `jq`, `grep`, `tail -f` all work directly. Field names in §1.1 are deliberately greppable.

### 8.3 CLI — `scripts/aodd.js`

Commands:

| Command | Behavior |
|---|---|
| `aodd ls` | list runs in the active workspace, newest first, with status + duration |
| `aodd show <run_id>` | print `summaries/run.summary.md` |
| `aodd show <run_id> --phase <id>` | print all sub-phase summary MDs under that phase |
| `aodd show <run_id> --sub <sub_id>` | print one sub-phase summary MD |
| `aodd events <run_id>` | stream `events.ndjson`; supports `--type <type>` and `--since <ts>` filters |
| `aodd trail <run_id> <event_id>` | print the parent_event_id chain back to the run root |
| `aodd caused-by <run_id> <event_id>` | print the caused_by chain |
| `aodd payload <run_id> <payload_ref>` | print the referenced payload file |
| `aodd grep <run_id> <pattern>` | grep events.ndjson + all payload files |
| `aodd diff <run_a> <run_b>` | structural diff of two run summaries (same sub-phases, different outputs) |
| `aodd keep <run_id>` | create `.keep` sentinel |
| `aodd prune` | manual prune dry-run / apply |

### 8.4 Library API

```ts
// src/lib/aodd/replay.ts
export function listRuns(workspaceRoot: string): RunInfo[];
export function readRunSummary(workspaceRoot: string, runId: string): RunSummary;
export function readSubPhaseSummary(workspaceRoot: string, runId: string, subPhaseId: string): SubPhaseSummary;
export function readEvents(workspaceRoot: string, runId: string, filter?: EventFilter): AsyncIterable<AoddEvent>;
export function readParentChain(workspaceRoot: string, runId: string, eventId: string): AoddEvent[];
export function readPayload(workspaceRoot: string, runId: string, payloadRef: string): Buffer;
```

Used by the CLI, tests, the trace-completeness regression check, and any future tooling.

---

## 9. Trace-completeness fixtures

### 9.1 Decision

A fixture is a frozen `aodd/` directory + a `manifest.json` declaring expected reconstructability. A regression test loads the fixture and asserts the 5W+H questions can be answered from the trace alone.

### 9.2 Fixture layout

```
src/test/regression/aodd-fixtures/
  <scenario-name>/
    aodd/
      events.ndjson
      payloads/...
      summaries/...
      index.json
    manifest.json
```

### 9.3 `manifest.json` schema

```ts
interface FixtureManifest {
  scenario: string;
  description: string;
  schema_version: number;        // AODD schema this fixture was captured at
  expected_sub_phases: Array<{
    phase_id: PhaseId;
    sub_phase_id: string;
    expected_status: 'success' | 'partial' | 'failed';
    must_answer_5wh: true;       // hard requirement
    spot_checks?: Array<{        // optional pinpoint assertions
      path: string;              // dotted path into SubPhaseSummary
      equals?: unknown;
      matches?: string;          // regex
      not_null?: boolean;
    }>;
  }>;
  forbidden_events?: AoddEventType[];   // event types that must NOT appear
}
```

### 9.4 The regression assertion

For each expected sub-phase:
1. Locate `summaries/phase-<phase_id>/<sub_phase_id>.summary.json`.
2. Validate against the `SubPhaseSummary` schema.
3. Assert all 5W+H fields are non-null where the schema requires.
4. Assert `events.first_event_id` and `events.last_event_id` resolve to real events in `events.ndjson`.
5. For each event referenced by the summary, walk `parent_event_id` to root — assert no broken links.
6. Run spot checks.

Failure of any step fails the test. The principle "trace completeness is a regression test" becomes literal.

### 9.5 Capturing new fixtures

`scripts/aodd.js capture <run_id> <scenario-name>` copies a run's `aodd/` directory into the fixtures tree and stubs out a `manifest.json` for the user to fill in expectations.

---

## 10. Orphan stream policy

| Stream | Today | Policy |
|---|---|---|
| `.tmp/acceptance-raw-<sub_phase>.txt` | No `run_id`, plain text dump | **Adopt**: route through AODD `prompt.materialized` + `llm.returned` events as part of acceptance-runner instrumentation. Delete the loose `.tmp` write after migration. |
| `test-and-evaluation/bakeoff-results/` | Standalone, no run linkage | **Adopt as runs**: each bakeoff invocation gets its own AODD `run_id` and AODD trace directory. Existing `bakeoff-report.md` becomes a projection of the run summary. |
| `test-and-evaluation/prompt-probe-output/<sub_phase>/*` | Isolated diagnostic files | **Adopt as runs**: same as bakeoff. Probe runs are runs. |
| `calibration-workspaces/review-of-<run_id>.log` | Per-workspace, no AODD link | **Link**: the log file gets an entry in the `aodd` block of the calibration's own run summary. The file content itself stays where it is. |
| `lifecycle.ndjson`, `transforms.jsonl`, `live/*.log`, `audit/*` | Existing v2 trace surfaces | **Migrate then deprecate** (see §12 phasing). Not "orphan" — these are the precursor streams AODD subsumes. |
| `runs/<id>/context/*.md` | Detail files for context payloads | **Keep**: these are read by CLI executor agents at runtime, not just diagnostic. Cross-reference them from AODD `context.detail_file_written` events. |

---

## 11. Implementation surface delta

### 11.1 New files

```
src/lib/aodd/
  types.ts             event types union, payload map, AODD_SCHEMA_VERSION
  emit.ts              emit(), withAoddSpan(), writer config
  loggerHandler.ts     AoddLogHandler
  summaryWriter.ts     emits sub_phase summary at sub_phase.exited
  runSummaryWriter.ts  emits run summary at run.completed/failed
  idCanonicalize.ts    phaseIdToFilenameSegment() and friends
  payloadStore.ts      sidecar payload writes; size-threshold detection
  replay.ts            read API
  retention.ts         prune logic
  index.ts             public exports

scripts/
  aodd.js              CLI entry point

src/test/regression/
  aodd-fixtures/       fixture directory tree
  aodd-completeness.test.ts   the regression test
```

### 11.2 Files needing modification

| File | Change |
|---|---|
| `src/lib/logging/logger.ts` | add `addHandler()` / `removeHandler()` public methods |
| `src/lib/orchestrator/orchestratorEngine.ts:215` | call `aodd.initialize()` at boot; call `aodd.startRun()` / `aodd.endRun()` |
| `src/lib/orchestrator/orchestratorEngine.ts:598` | emit `phase.entered` / `phase.exited` (paired with existing `emitLifecycle`) |
| `src/lib/orchestrator/orchestratorEngine.ts:840, 854, 974, 1048` | dual-emit for `decision.*`, `mirror.*`, escalation events |
| `src/lib/agents/executorAgent.ts:208, 289, 295, 301, 311` | dual-emit for `agent.*` events |
| `src/lib/orchestrator/waveGate.ts:81`, `phases/phase1.ts:1579,1887`, `phases/phase3.ts:301`, `phases/phase4_2a.ts:1320`, `phases/phase5.ts:444`, `phases/phase10.ts:138` | dual-emit `mirror.presented` |
| `src/lib/orchestrator/auditPause.ts:164` | use `phaseIdToFilenameSegment` |
| `src/lib/llm/llmCaller.ts:1503` | use `phaseIdToFilenameSegment` |
| `src/lib/orchestrator/testRunner.ts:105,132,154` | dual-emit `test.*` |
| `src/lib/orchestrator/evalRunner.ts:106,160` | dual-emit `eval.*` |
| `src/lib/trace/emit.ts` | once AODD covers it: deprecate (keep as thin shim into AODD `prompt.materialized` etc., remove writer) |
| `src/lib/trace/lifecycle.ts` | once AODD covers it: deprecate similarly |
| `src/cli/runner.ts:205` | wire `liveLogDir` setup through AODD payload-store integration (optional optimization) |

### 11.3 Phased migration

The phasing below intentionally keeps the legacy streams alive until AODD has parity. Nothing is removed in early phases.

| Phase | Scope | Risk |
|---|---|---|
| **P1: scaffolding** | new files in `src/lib/aodd/`; types union; emit/initialize/startRun/endRun no-ops with disk write; CLI stub; principle docs cross-linked | low — no existing call-sites touched |
| **P2: Logger handler** | `Logger.addHandler()` added; `AoddLogHandler` registered at boot; all logs flow to `events.ndjson` | low — additive only |
| **P3: orchestrator wiring** | `phase.entered/exited`, `run.started/completed/failed/resumed` emits at `orchestratorEngine.ts`; ID normalization helper used at the three writers | low — paired emits, legacy streams untouched |
| **P4: dual-emit at EventBus call-sites** | 14 call-sites enumerated in §11.2 get paired AODD emits | medium — touches many files but each change is small and additive |
| **P5: prompt/LLM/validator/repair events** | `prompt.template_rendered`, `prompt.materialized`, `llm.invoked`, `llm.returned`, `llm.failed`, `llm.cache_hit`, `repair.json_*`, `validator.*` at the existing trace-emit sites (`llmCaller.ts`, `traceNormalize.ts`, validator dispatch) | medium — overlaps with `transforms.jsonl`, must verify parity |
| **P6: write-time summaries** | `summaryWriter.ts` runs at `sub_phase.exited`; `runSummaryWriter.ts` runs at `run.completed/failed`; completeness invariant enforced | medium — bugs here cause crashes, not data loss |
| **P7: replay CLI + library** | CLI commands; library API; first end-to-end agent-readable workflow | low — read-only over already-written data |
| **P8: fixtures + regression test** | first 3 fixtures captured (one happy path, one failed path, one cache-hit path); regression test added to CI | medium — fixtures break loudly when schema changes |
| **P9: retention** | `retention.ts`; config-block; `.keep` sentinel | low — gated by config defaulting to "do not prune" until P9 is verified |
| **P10: orphan stream adoption** | acceptance-runner, bakeoff, prompt-probe routed through AODD | medium — touches diagnostic tooling |
| **P11: deprecate legacy streams** | `transforms.jsonl`, `lifecycle.ndjson` writers become AODD-shim or removed; `live/*.log` either replaced by AODD payload store or retained as `tail -f` projection | high — only after fixtures prove AODD parity covers every diagnostic question the legacy streams answered today |

P1–P3 are independent and safe. P4–P6 form the core value delivery. P7–P9 are required for the AODD layer to be self-sustaining. P10–P11 are cleanup that follows from the rest being solid.

---

## 12. Open questions remaining

These can be deferred until implementation begins or until they become blockers:

1. **ULID vs UUID v4 for `event_id`.** ULID gives lexicographic ordering and makes file-by-event_id naming useful. Default to ULID unless we hit ecosystem friction (no maintained ULID lib for our Node version, etc.).
2. **Payload spill threshold.** §2.3 proposes 4 KB structured / 1 KB free-text. May tune after measuring real distributions.
3. **`run.summary.md` template.** Markdown shape for the top-level run summary is unspecified — defer to first implementation.
4. **CLI argument parser.** `scripts/aodd.js` will use one of the lightweight CLI parsers already in the v2 toolchain — pick at implementation time.
5. **AODD initialization in tests.** Many existing tests do not currently set up a TraceCtx. AODD `emit()` must no-op safely when no run is active (already true for `emitTransformationStep`); confirm semantics match in P1 scaffolding.
6. **Migration of historical workspace runs.** Out of scope; existing runs are not retro-traced.
7. **Concurrency.** If two phases ever emit concurrently (Phase 9 parallel executors), the NDJSON append must be atomic — verify behavior of the writer used (likely `fs.appendFileSync` is sufficient on the platforms we target; verify on Windows).
8. **Webview consumption.** Out of scope for this memo (the principles doc deferred product-facing AODD). The architecture does not preclude a future webview reader of `events.ndjson`.

---

## 13. Acceptance for this design memo

The memo is considered locked when:

- Decisions in §1–§10 are reviewed and either accepted or specifically rejected by the user.
- The implementation surface in §11 is acknowledged as the work scope.
- Phased migration order in §11.3 is endorsed (or revised) before P1 begins.

The implementation lands behind this design memo; if implementation reveals a decision was wrong, the decision is revised here first and the change-of-direction is dated and noted.
