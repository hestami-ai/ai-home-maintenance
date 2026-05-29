# AODD Parity Matrix — legacy streams → AODD events

**Status**: P11 retirement complete 2026-05-26. `transforms.jsonl` and `lifecycle.ndjson` writers have been physically removed; downstream consumers now read AODD events.ndjson directly. `live/*.log` retained as documented (operator `tail -f` workflow).
**Audience**: anyone reasoning about diagnostic surfaces in v2 or considering removal of the last remaining legacy stream (`live/*.log`).

This matrix shows, for every event/record class the legacy observability streams (`transforms.jsonl`, `lifecycle.ndjson`, `live/*.log`) used to carry, where the equivalent information lives in the AODD trace.

## Retirement status

| Stream | Status |
|---|---|
| `transforms.jsonl` | **REMOVED** (writer deleted; `src/lib/trace/emit.ts` no longer exists). Downstream consumers (`src/cli/deep-audit.ts`, `scripts/trace.js`) read AODD `events.ndjson` directly. `transformation_step` record_type is no longer written to `governed_stream`. |
| `lifecycle.ndjson` | **REMOVED** (writer deleted; `src/lib/trace/lifecycle.ts` no longer exists). `src/cli/deep-audit.ts` and `scripts/audit/run-audit.js` translate AODD envelopes to the legacy lifecycle event shape inline. |
| `live/*.log` | RETAINED. Per-chunk `tail -f` operator workflow has no AODD equivalent; the two surfaces coexist by design. Documented in `src/lib/llm/invocationLogger.ts`. |

The env-var opt-outs (`JANUMICODE_TRACE`, `JANUMICODE_LIFECYCLE_LOG`) no longer exist. The `JANUMICODE_AODD=off` opt-out remains for disabling the AODD layer entirely.

## transforms.jsonl

Written by `src/lib/trace/emit.ts` `emitTransformationStep()`. Twelve `step_type` variants:

| Legacy `step_type` | AODD coverage |
|---|---|
| `context_assembled` | `context.assembled` (paired at `dmrContext.ts:153`) |
| `template_rendered` | `prompt.template_rendered` (paired at `templateRendered.ts`) |
| `prompt_materialized` | `prompt.materialized` + `llm.invoked` (paired at `llmCaller.ts:610`) |
| `llm_invoked` | `llm.invoked` (paired at `llmCaller.ts:610`) |
| `llm_returned` (success) | `llm.returned` (paired at `llmCaller.ts:972`) |
| `llm_returned` (error path) | `llm.failed` (paired at `llmCaller.ts:1166`) |
| `llm_returned` (cache hit) | `llm.cache_hit` (paired at `llmCaller.ts:553`) |
| `json_parsed` | absorbed into `llm.returned` (text + parsed flag in summary) |
| `json_repaired` | `repair.json_succeeded` / `repair.json_failed` (paired at `llmCaller.ts:941`) |
| `normalized` | deterministic transform — no AODD counterpart |
| `persisted` | `record.added` (paired at `governedStreamWriter.ts:writeRecord`) |
| `consumed` | covered by upstream emit sites (rare in practice) |
| `cli_invoked` | `agent.invocation_started` (paired at `executorAgent.ts:208`) |
| `cli_returned` | `agent.invocation_completed` (paired at `executorAgent.ts:311`) |

**External consumers still reading `transforms.jsonl`**:
- `scripts/trace.js` — walk-back CLI; reads transforms.jsonl as primary input
- `scripts/audit/*.js` — audit predicates
- `scripts/inspect-*.js`, `scripts/extract-*.js` — diagnostic tools
- Regression harness (`src/test/regression/`)

Removal blocked on migrating those consumers to read `events.ndjson` instead.

## lifecycle.ndjson

Written by `src/lib/trace/lifecycle.ts` `emitLifecycle(event, data)`. Free-form event names; observed in production:

| Legacy event | AODD coverage |
|---|---|
| `phase.entered` | `phase.entered` (paired at `orchestratorEngine.ts:623`) |
| `phase.exited` | `phase.exited` (paired at `orchestratorEngine.ts:628, 640`) |
| `sub_phase.entered` | (not currently fired by lifecycle.ts in v2) |
| `workflow.resumed` | `run.resumed` (paired at `cli/runner.ts`) |
| `llm.call` (success) | `llm.invoked` + `llm.returned` (LLM caller pair) |
| `llm.call` (cache hit) | `llm.cache_hit` |
| `llm.call` (error) | `llm.failed` |
| `executor.dispatched` | `agent.invocation_started` |
| `executor.invocation_status_change` | `agent.invocation_completed` |
| `executor.agent_invocation_skipped` | covered by `agent.invocation_completed` with `success: false` |
| `executor.agent_invocation_write_failed` | `agent.output_write_failed` |
| `executor.agent_output_skipped` | `agent.output_skipped` |
| `executor.agent_output_write_failed` | `agent.output_write_failed` |
| `artifact.produced` | `record.added` (governedStreamWriter pair) |
| `phase9.dispatch_order_selected` | covered by sub-phase summary (run-level totals) |
| `phase4.saturation_iteration_complete` | covered by sub-phase summary |
| `packet.synthesized` | covered by `record.added` for the packet record |
| `phase8_5.ref_resolution` | covered by sub-phase summary decisions list |

**External consumers still reading `lifecycle.ndjson`**:
- `scripts/audit/run-audit.js` — tails the file, runs predicate cards against `sub_phase.exited`

Removal blocked on the audit-predicate runner migrating to `aodd events <run_id> --type ...`.

## live/\*.log

Written by `src/lib/llm/invocationLogger.ts` `InvocationLogFile`. Two files per invocation:
- `phase<NN>__<invocationId>.log` — banner + structured per-chunk lines + trailer
- `phase<NN>__<invocationId>.stream.log` — raw token stream for `tail -f`

| Legacy content | AODD coverage |
|---|---|
| Banner (provider/model/role/phase/sub-phase/prompt/system) | `llm.invoked` payload (prompt + system spill via `maybeSpillText`) |
| Per-chunk lines (channel, ms, cumulative chars, text) | Not in AODD — chunk-level streaming is operator-only |
| Trailer (status, duration, tokens, final text, thinking) | `llm.returned` / `llm.failed` payload |

**P11 decision: keep `live/*.log` as a projection.** The per-chunk live stream serves a distinct operator workflow (`tail -f` on an in-flight invocation) that the structured AODD events.ndjson — which is line-per-completed-event — cannot replace. The two surfaces coexist by design. Disable per-chunk writing via `JANUMICODE_LLM_LIVE_RAW_STREAM=0` (default).

## What AODD covers that the legacy streams do NOT

These event classes only exist in AODD:
- `run.started` / `run.completed` / `run.failed` (run-level lifecycle, missing from lifecycle.ndjson)
- `agent.reasoning_step` / `agent.self_correction` / `agent.tool_call` (in-DB only previously)
- `mirror.presented` / `mirror.resolved` (in EventBus only previously)
- `decision.requested` / `decision.resolved` / `decision.escalated` (in EventBus only previously)
- `validator.run` / `validator.finding` (in DB only previously)
- `gate.pending` / `gate.approved` / `gate.rejected`
- `retry.scheduled` / `retry.attempted` (new — first-class retry visibility)
- `audit.pause_emitted` / `audit.pause_resolved` (new — pause flow in trace)
- `context.assembled` / `context.detail_file_written` (new — context-builder visibility)
- `log.debug` / `log.info` / `log.warn` / `log.error` (new — Logger entries flow through AODD)
- `test.run_started` / `test.suite_completed` / `test.run_completed` / `eval.started` / `eval.completed`
- `sub_phase.summary` (when sub-phase summaries emit)

## Removal complete (P11 full retirement, 2026-05-26)

1. **Legacy projection helper landed first** as a transition step: `src/lib/aodd/legacyProjection.ts` projected events.ndjson into the legacy step/event shapes so downstream consumers could keep working.
2. **Writer defaults flipped** to off via env vars; consumers verified working against AODD-derived data.
3. **Physical removal**:
   - Deleted `src/lib/trace/emit.ts`, `src/lib/trace/lifecycle.ts`, `src/lib/aodd/legacyProjection.ts`.
   - Deleted the `JANUMICODE_TRACE` / `JANUMICODE_LIFECYCLE_LOG` env-var branches in `orchestratorEngine.ts`.
   - Removed every `emitTransformationStep(...)` / `emitLifecycle(...)` call across 11 files (llmCaller, orchestratorEngine, agentInvoker, executionScheduler, governedStreamWriter, stateMachine, cli/runner, dmrContext, packetSynthesis, coherenceVerifier, phase4_2a).
   - Simplified `templateRendered.ts` to emit only AODD `prompt.template_rendered`. Simplified `traceNormalize.ts` to a pure pass-through (the `normalized` step had no AODD counterpart).
   - Added new AODD emits to preserve coverage that wasn't already paired:
     - `sub_phase.entered` / `sub_phase.exited` at `stateMachine.ts setSubPhase()` (closes the deferred-from-P6 gap).
     - `agent.output_skipped` / `agent.output_write_failed` at `agentInvoker.ts` (the legacy `executor.agent_*` skip/fail variants).
   - Inlined the projection mapping tables (TRANSFORM_STEP_TYPE_BY_AODD, LIFECYCLE_EVENT_BY_AODD) into `src/cli/deep-audit.ts` and `scripts/trace.js` / `scripts/audit/run-audit.js`. Consumers now read AODD events directly with no legacy-file fallback path.
   - Removed `transformation_step` from `rollback.ts` preserve set (no longer written).
   - Updated `src/test/unit/orchestrator/rollback.test.ts` to remove the `transformation_step` seed row.

4. **Verified**: tsc clean, 74/74 AODD tests pass, 1666/1666 unit tests pass.

The `transformation_step` record_type still exists in the `RecordType` union for backwards compatibility with rollback's defensive shape; nothing writes it. A future cosmetic cleanup can remove it from the union if desired.

## Future cleanup (cosmetic, low priority)

- Remove `transformation_step` from the `RecordType` union in `src/lib/types/records.ts` and from anywhere else it's referenced as a type literal.
- Replace the remaining `traceNormalize` / `traceNormalizeFn` pass-through wrappers in `src/lib/orchestrator/phases/phase1.ts` and `phase1Normalizers.ts` (10 sites) with direct normalizer calls; then delete `src/lib/trace/traceNormalize.ts`.
- `governedStreamWriter.ts` has a now-unused `ARTIFACT_LIFECYCLE_RECORD_TYPES` set and `summarizeArtifactCounts` function — both were inputs to the deleted `emitLifecycle('artifact.produced', ...)` call. Delete on a quiet day.
