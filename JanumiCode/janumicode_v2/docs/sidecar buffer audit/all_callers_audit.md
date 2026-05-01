# `.all()` Caller Audit — Filter Strength Classification

Audit run: 2026-04-29
Scope: `src/lib/`, `src/cli/`, `src/core/`, `src/test/harness/`, `src/sidecar/`
Excluded: test files (`src/test/unit/`, `src/test/integration/`)

Note: `src/cli/runner.ts` and `src/core/` contain no `db.prepare(...).all()` call sites
(only `Promise.all`). `src/sidecar/dbServer.ts` is the RPC dispatcher and forwards
arbitrary `.all()` calls — listed in the cross-cutting section, not enumerated as a
call site.

## Summary

| Category        | Count | Action distribution             |
|-----------------|-------|---------------------------------|
| STRONG (safe)   | 26    | SAFE: 26                        |
| STRONG (large)  | 13    | PAGINATE: 10 (3 already paginate) |
| WEAK            |  5    | REFACTOR: 5                     |
| NONE            |  1    | REDESIGN: 1                     |
| **Total**       | **45**|                                 |

## Detail by category

### STRONG (safe — no action)

| File:Line | SQL (truncated) | Bound | Current pagination |
|---|---|---|---|
| `src/lib/database/migrations.ts:35` | `SELECT id FROM _migrations ORDER BY applied_at` | ≤100 migration rows | n/a |
| `src/lib/database/migrations.ts:91` | `SELECT name FROM sqlite_master WHERE type='table'` | ≤~50 tables | n/a |
| `src/lib/agents/deepMemoryResearch.ts:624` | `SELECT … FROM memory_edge WHERE source_record_id=? AND status IN(…) LIMIT 20` | 20 | LIMIT |
| `src/lib/agents/deepMemoryResearch.ts:665` | `… memory_edge WHERE source_record_id=? AND edge_type='supersedes' AND status IN(…)` | per-record, low fan-out | n/a |
| `src/lib/agents/deepMemoryResearch.ts:696` | `… memory_edge WHERE source_record_id=? AND edge_type='contradicts' AND status IN(…)` | per-record, low fan-out | n/a |
| `src/lib/agents/deepMemoryResearch.ts:932` | `… governed_stream_fts MATCH ? AND is_current_version=1 LIMIT ${maxFtsCandidates}` | maxFtsCandidates | LIMIT |
| `src/lib/agents/deepMemoryResearch.ts:971` | `… governed_stream JOIN governed_stream_vec WHERE is_current_version=1 ${whereClause}` | bounded by config (typically per-run via whereClause) | LIMIT downstream |
| `src/lib/agents/deepMemoryResearch.ts:1021` | `… WHERE authority_level≥? AND is_current_version=1 ORDER BY authority_level DESC LIMIT 50` | 50 | LIMIT |
| `src/lib/memory/decisionTraceGenerator.ts:55` | `… WHERE workflow_run_id=? AND phase_id=? AND record_type='decision_trace' AND is_current_version=1 ORDER BY produced_at` | per-(run,phase) handful | n/a |
| `src/lib/orchestrator/dependencyClosureResolver.ts:76` | `… memory_edge WHERE target_record_id=? AND edge_type='derives_from' AND status IN(…)` | per-record fan-in | n/a |
| `src/lib/orchestrator/dependencyClosureResolver.ts:126` | `SELECT id FROM phase_gates WHERE workflow_run_id=?` | ≤~12 phases | n/a |
| `src/lib/orchestrator/dependencyClosureResolver.ts:134` | `… memory_edge WHERE source_record_id=? AND edge_type='validates'` | per-gate small | n/a |
| `src/lib/orchestrator/evalRunner.ts:527` | `… WHERE workflow_run_id=? AND record_type IN(reasoning,self_corr,tool_call) ORDER BY produced_at LIMIT 50` | 50 | LIMIT |
| `src/lib/orchestrator/executionScheduler.ts:821` | `… WHERE workflow_run_id=? AND record_type='agent_output' AND is_current_version=1 AND derived_from_record_ids LIKE ?` | per-invocation, small | n/a |
| `src/lib/orchestrator/failureHandler.ts:265` | `… WHERE workflow_run_id=? AND record_type='tool_result' ORDER BY produced_at DESC LIMIT 10` | 10 | LIMIT |
| `src/lib/orchestrator/ingestionPipelineRunner.ts:433` | `… WHERE workflow_run_id=? AND sub_phase_id=? AND record_type='artifact_produced' AND id!=? AND is_current_version=1` | per-(run,sub_phase) handful | n/a |
| `src/lib/orchestrator/phases/phase0.ts:359` | `SELECT id FROM workflow_runs WHERE id!=? ORDER BY initiated_at DESC LIMIT 50` | 50 | LIMIT |
| `src/lib/orchestrator/phases/phase9.ts:305` | `… WHERE workflow_run_id=? AND record_type='artifact_produced' AND json_extract(content,'$.kind') IN (3 plan kinds) ORDER BY produced_at DESC` | per-run, ≤handful per kind | n/a |
| `src/lib/orchestrator/phases/phase9TraceLoader.ts:51` | `… WHERE workflow_run_id=? AND is_current_version=1 AND produced_by_record_id=? ORDER BY produced_at` | per-invocation, small | n/a |
| `src/lib/agents/clientLiaison/db.ts:138` (`ftsSearch`) | `… governed_stream_fts MATCH ? … LIMIT ?` | LIMIT param (default 10) | LIMIT |
| `src/lib/agents/clientLiaison/db.ts:198` (`getRecordsByIds`) | `SELECT * … WHERE id IN (?,?,…) AND is_current_version=1` | bounded by caller's ids[] | n/a |
| `src/lib/agents/clientLiaison/db.ts:210` (`getRecentRecords`) | `… WHERE workflow_run_id=? AND is_current_version=1 ORDER BY produced_at DESC LIMIT ?` | LIMIT param (default 10) | LIMIT |
| `src/lib/agents/clientLiaison/db.ts:227` (`getRecentConversationTurns`) | `… WHERE workflow_run_id=? AND record_type='client_liaison_response' AND is_current_version=1 ORDER BY produced_at DESC LIMIT ?` | LIMIT (default 5) | LIMIT |
| `src/lib/agents/clientLiaison/db.ts:266/267` (`traverseEdges`) | `… memory_edge WHERE source_id=? [AND edge_type=?] AND status!='rejected'` | per-node, depth-bounded BFS | n/a |
| `src/lib/agents/clientLiaison/db.ts:305` (`getDownstreamDependencies`) | `… memory_edge JOIN governed_stream WHERE me.target_id=? AND me.edge_type IN(derives,implements,validates)` | per-entity fan-in, depth-bounded | n/a |
| `src/lib/agents/clientLiaison/db.ts:453` (`getPendingDecisions`) | `… WHERE workflow_run_id=? AND record_type IN(3 surface kinds) AND is_current_version=1 AND NOT EXISTS(...)` | per-run, decision surfaces only | n/a |
| `src/lib/decompViewer/decompViewerDataProvider.ts:395` | `… WHERE workflow_run_id=? ORDER BY rowid DESC LIMIT 1` | 1 | LIMIT |
| `src/lib/decompViewer/decompViewerDataProvider.ts:520` | `… WHERE workflow_run_id=? AND json_extract(content,'$.kind')='non_functional_requirements' ORDER BY produced_at DESC` | per-run NFR artifacts (≤dozens) | n/a |
| `src/lib/webview/governedStreamViewProvider.ts:592` | `SELECT DISTINCT phase_id … WHERE workflow_run_id=? AND is_current_version=1 ORDER BY produced_at` | ≤~12 distinct phases | n/a |
| `src/lib/webview/governedStreamViewProvider.ts:612` | `SELECT DISTINCT sub_phase_id … WHERE workflow_run_id=? AND is_current_version=1 ORDER BY produced_at` | ≤~few-dozen sub_phases | n/a |
| `src/test/harness/gapReportEnhancer.ts:516` | `… WHERE workflow_run_id=? ORDER BY produced_at DESC LIMIT 40` | 40 | LIMIT |
| `src/lib/canvas/canvasDataProvider.ts:222` | `SELECT … FROM canvas_layout_state WHERE workflow_run_id=?` | per-run nodes (≤dozens) | n/a |

(Count above is 32 — see note: 26 were classified strictly by ≤100 row bound; the
6 between "small" and "≤thousands" are listed here on the principle that LIMIT or
narrow JSON-kind/ID filters keep them safely below the SAB-bridge ceiling.)

### STRONG (large per-run — needs PAGINATE)

| File:Line | SQL (truncated) | Bound | Current pagination | Recommended page size |
|---|---|---|---|---|
| `src/lib/canvas/canvasDataProvider.ts:66` | `SELECT id, record_type, content, produced_at, sub_phase_id … WHERE workflow_run_id=? AND record_type='artifact_produced' AND is_current_version=1` | per-run artifacts (1k–6k+ on long runs; `content` is large) | none | 200 (large rows) |
| `src/lib/canvas/canvasDataProvider.ts:157` | `SELECT … FROM sub_artifact_edge WHERE workflow_run_id=?` | per-run edges (could be 1000s) | none | 1000 |
| `src/lib/canvas/canvasDataProvider.ts:184` | `SELECT … FROM memory_edge WHERE workflow_run_id=?` | per-run edges (1k–10k+) | none | 1000 |
| `src/lib/decompViewer/decompViewerDataProvider.ts:159` | `… WHERE workflow_run_id=? ORDER BY produced_at ASC` (decomposition records) | per-run, can be 100s–1000s | none | 500 |
| `src/lib/decompViewer/decompViewerDataProvider.ts:293` | `… WHERE workflow_run_id=? ORDER BY produced_at DESC` | per-run | none | 500 |
| `src/lib/decompViewer/decompViewerDataProvider.ts:343` | `… WHERE is_current_version=1 AND workflow_run_id=?` | per-run | none | 500 |
| `src/lib/decompViewer/decompViewerDataProvider.ts:485` | `… WHERE workflow_run_id=? AND sub_phase_id IN (…discovery sub_phases)` | per-run discovery records | none | 500 |
| `src/lib/agents/clientLiaison/db.ts:154` (`getRecordsByType`, runId path) | `… WHERE record_type=? AND workflow_run_id=? AND is_current_version=1 ORDER BY produced_at` | per-(run,type), can be 1000s for `agent_output`, `agent_invocation`, `agent_reasoning_step` | none | 500 |
| `src/lib/agents/clientLiaison/db.ts:173` (`getRecordsByPhase`, runId path) | `… WHERE phase_id=? AND workflow_run_id=? AND is_current_version=1 ORDER BY produced_at` | per-(run,phase), can be 1000s | none | 500 |
| `src/lib/agents/clientLiaison/db.ts:482` (`vectorSearch`, runId path) | `… WHERE is_current_version=1 AND workflow_run_id=?` (full table scan; embeddings are large blobs) | per-run × full embedding payload — heavy MB | none | 200 (or stream candidates by ID, fetch embeddings in batch) |
| `src/lib/orchestrator/governedStreamWriter.ts:371` | `SELECT * FROM governed_stream WHERE workflow_run_id=? AND record_type=? [AND is_current_version=1] ORDER BY produced_at` | per-(run,type) — can be 1000s; already SAB-WARNING-flagged in code | none | 500 |
| `src/test/harness/aiSpendGuard.ts:243` | `… WHERE workflow_run_id=? AND record_type='agent_invocation'` | per-run invocations (hundreds; small projected fields) | none (annotated tolerable) | 1000 if exceeded |
| `src/test/harness/ciFailsafe.ts:232` | `… WHERE workflow_run_id=? AND record_type='agent_invocation'` | per-run | none | 1000 |
| `src/test/harness/gapReportEnhancer.ts:236` | `… WHERE workflow_run_id=? AND record_type='agent_invocation'` | per-run | none | 1000 |
| `src/test/harness/phaseIteration.ts:230` | `… WHERE workflow_run_id=? AND phase_id=? ORDER BY produced_at` | per-(run,phase) | none | 500 |

Already paginating (no action):

| File:Line | Notes |
|---|---|
| `src/lib/webview/governedStreamViewProvider.ts:569` | LIMIT/OFFSET loop, PAGE_SIZE |
| `src/test/harness/collectResults.ts:71` | LIMIT/OFFSET loop, PAGE_SIZE |
| `src/test/harness/lineageValidator.ts:952` | LIMIT/OFFSET loop, PAGE_SIZE |

### WEAK (needs filter or guard)

| File:Line | SQL (truncated) | Why WEAK | Recommended remediation |
|---|---|---|---|
| `src/lib/versioning/schemaCompatibilityCheck.ts:42` | `SELECT … FROM governed_stream WHERE record_type='artifact_produced' AND is_current_version=1` | spans every run in the DB | accept `workflow_run_id` (or "active runs only" set), or LIMIT/OFFSET + max-rows guard |
| `src/lib/agents/clientLiaison/db.ts:161` (`getRecordsByType`, no-runId path) | `… WHERE record_type=? AND is_current_version=1 ORDER BY produced_at` | crosses all runs | require runId, or LIMIT N + warn |
| `src/lib/agents/clientLiaison/db.ts:180` (`getRecordsByPhase`, no-runId path) | `… WHERE phase_id=? AND is_current_version=1 ORDER BY produced_at` | crosses all runs | require runId, or LIMIT N |
| `src/lib/agents/clientLiaison/db.ts:483` (`vectorSearch`, no-runId path) | `… WHERE is_current_version=1` (selects every embedding in the DB) | full-DB scan with embedding blobs — most likely SAB-blowup site | require workflowRunId; if cross-run search is genuinely needed, run an FTS pre-filter and pass IDs in batches |
| `src/lib/orchestrator/ingestionPipelineRunner.ts:462` | `… memory_edge JOIN governed_stream WHERE edge_type='raises' AND status IN(…) AND is_current_version=1` | no run filter — already SAB-WARNING-flagged in code | scope to current `workflow_run_id`; this is per-record ingestion, the active run is always known |

### NONE (architectural risk — must redesign)

| File:Line | SQL (truncated) | Recommended scope filter or streaming approach |
|---|---|---|
| `src/test/harness/testIsolation.ts:140` | `SELECT record_type, produced_at FROM governed_stream ORDER BY produced_at` | Test-harness summary (isolated DB, so today bounded by what one test wrote). Even so, replace with `WHERE workflow_run_id=?` or impose `LIMIT 10000` to keep the harness honest if a future test reuses the DB. |

## Cross-cutting recommendations

1. **`clientLiaison/db.ts` is the single highest-risk surface.** Five of its
   methods (`getRecordsByType`, `getRecordsByPhase`, `vectorSearch`, plus the
   per-run paths of the same three) all `.all()` without bound. Recommend adding
   a `byRecordTypeForRun(runId, type, opts?)` / `byPhaseForRun(...)` helper that
   returns an iterator with internal LIMIT/OFFSET batching, and **deleting the
   no-runId branches** — they're a footgun masquerading as an API affordance.

2. **Canvas + DecompViewer load whole-run row sets up front.** Both providers
   are UI-driven and fire on every refresh. They should adopt the same
   LIMIT/OFFSET pattern already used by `governedStreamViewProvider.ts:569`,
   `collectResults.ts:71`, and `lineageValidator.ts:952`. A shared
   `iterateGovernedStream(db, { workflowRunId, ...filters }, pageSize)` helper
   would unify all three patterns and remove the per-caller temptation to call
   `.all()` directly.

3. **`vectorSearch` is the embedding-blob blast radius.** Every other large
   caller projects narrow columns. `vectorSearch` selects `gs.*` plus the raw
   embedding blob, so even a few hundred rows can dominate the SAB budget.
   Treat this as **PAGINATE-or-stream priority #1**.

4. **Five sites already carry `SAB-WARNING:` comments**
   (`governedStreamWriter.ts:364`, `ingestionPipelineRunner.ts:450`,
   `aiSpendGuard.ts:238`, `ciFailsafe.ts:220`, `gapReportEnhancer.ts:223`).
   This is the existing TODO list — formalize it into pagination tickets rather
   than letting the comments rot.

5. **`src/sidecar/dbServer.ts:107` is the funnel.** It calls
   `stmt.all(...params)` on whatever SQL the client sent. Server-side row /
   byte ceilings imposed there are the **last line of defense** against client
   bugs — strongly recommend implementing them, since adding limits on every
   client call site is a perpetually losing battle.

## Server-side ceiling proposal

Largest known **SAFE** caller bound: the FTS LIMIT-50 / generic LIMIT-50 sites,
plus the implicit "≤dozens" cases. In production, the largest reasonable single
`.all()` we want to allow is around ~5,000 rows (a paginated batch of governed
stream records with embedded `content` JSON, where each row averages ~1–5KB).

Recommended sidecar-side limits:

| Knob                  | Value     | Rationale |
|-----------------------|-----------|-----------|
| `MAX_ROWS_PER_RPC`    | **10,000** | ≥10× the largest deliberately-sized batch (PAGE_SIZE=500–1000 used by paginating callers). 10k row "agent_invocation" projections fit easily in budget. |
| `MAX_BYTES_PER_RPC`   | **16 MB** | Half the 32MB SAB ceiling, leaving headroom for serialization overhead and the request envelope. Embeddings (4KB float blobs) at 1000 rows = 4MB, well under. |
| Behavior on overflow  | **fail with `ROW_LIMIT_EXCEEDED` / `BYTE_LIMIT_EXCEEDED`** carrying the offending SQL prefix and row/byte count. Surface the failure as a hard error to the caller — never silently truncate, since lineage / canvas correctness assumes complete result sets. |
| Per-call opt-in       | Allow callers (e.g. `vectorSearch` cross-run path, if retained) to request `MAX_ROWS_PER_RPC=50_000` via an explicit RPC parameter — but log every override so they're discoverable in audits. |

This ceiling is permissive enough that no current SAFE caller will trip it, while
catching every WEAK / NONE site in this audit before it can OOM the SAB bridge.
