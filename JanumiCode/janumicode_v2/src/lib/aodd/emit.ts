/**
 * Single emit seam for AODD events.
 *
 * Per design memo §1 (event envelope) and §5 (emit API). Mirrors the
 * pattern of `src/lib/trace/emit.ts` so the codebase has one familiar
 * shape for "configure once at orchestrator boot, emit anywhere
 * downstream, silent no-op when unconfigured."
 *
 * Disk layout for a run (design memo §2.1):
 *   <workspace>/.janumicode/runs/<run_id>/aodd/
 *     events.ndjson      one event per line
 *     payloads/          sidecar payload files (see payloadStore.ts)
 *     summaries/         written by summaryWriter.ts / runSummaryWriter.ts
 *     index.json         emitted on endRun()
 *
 * Reuses the existing TraceCtx (`src/lib/trace/traceContext.ts`) for
 * run/phase/sub_phase coordinates. Does not introduce a third trace
 * context.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  currentParentStep,
  currentTraceContext,
  popStep,
  pushStep,
} from '../trace/traceContext';
import { configurePayloadStore } from './payloadStore';
import {
  AODD_SCHEMA_VERSION,
  type AoddEvent,
  type AoddEventPayload,
  type AoddEventType,
} from './types';
import type { PhaseId } from '../types/records';
import { mintUlid } from './ulid';
import {
  deriveAndWriteOneSubPhaseSummary,
  deriveAndWriteSubPhaseSummaries,
} from './summaryWriter';
import { deriveAndWriteRunSummary } from './runSummaryWriter';
import {
  clearSubPhaseStateTracker,
  markSubPhaseFailure,
  trackSubPhaseEntered,
} from './subPhaseTracker';

// ── Module config (set once at orchestrator boot) ───────────────────

interface AoddConfig {
  workspaceRoot: string;
  janumicodeVersionSha: string;
  enabled: boolean;
}

let config: AoddConfig | null = null;

interface ActiveRun {
  runId: string;
  startedAt: string;
  eventsPath: string;
  firstEventId: string | null;
  lastEventId: string | null;
  eventCount: number;
}

let activeRun: ActiveRun | null = null;

/**
 * Initialize the AODD emit layer. Call once during orchestrator boot
 * after the workspace root is known. Calling with `null` disables AODD
 * entirely; useful for tests and benchmark runs.
 *
 * Gated by `JANUMICODE_AODD=off` env var (overrides `enabled: true`).
 */
export function initialize(c: AoddConfig | null): void {
  if (c && process.env.JANUMICODE_AODD === 'off') {
    config = { ...c, enabled: false };
    return;
  }
  config = c;
}

/** True when AODD is configured and enabled and a run is active. */
export function isAoddEnabled(): boolean {
  return config?.enabled === true && activeRun !== null;
}

/** True when AODD is configured (regardless of run state). Used by tests. */
export function isAoddConfigured(): boolean {
  return config?.enabled === true;
}

/**
 * Start a run. Creates the on-disk directory tree, opens the events
 * stream, binds the payload store. Idempotent for the same run_id;
 * starting a different run_id closes the previous run first.
 */
export function startRun(runId: string): void {
  if (!config?.enabled) return;
  if (activeRun?.runId === runId) return;
  if (activeRun) endRun({ status: 'partial', silent: true });

  const runDir = path.join(
    config.workspaceRoot,
    '.janumicode',
    'runs',
    runId,
    'aodd',
  );
  try {
    fs.mkdirSync(runDir, { recursive: true });
    fs.mkdirSync(path.join(runDir, 'payloads'), { recursive: true });
    fs.mkdirSync(path.join(runDir, 'summaries'), { recursive: true });
  } catch (err) {
    process.stderr.write(
      `[aodd] WARN: failed to create run directory ${runDir}: ` +
        `${err instanceof Error ? err.message : String(err)}\n`,
    );
    return;
  }

  // Sync append (fs.appendFileSync) is used instead of a buffered
  // WriteStream. Design memo §12.7 anticipates this: gives atomic
  // per-line writes on the platforms we target, simplifies endRun()
  // (no async flush dance), and makes tests + replay reads
  // deterministic without await semantics. The per-call cost is a
  // syscall; acceptable for AODD volumes.
  const eventsPath = path.join(runDir, 'events.ndjson');

  activeRun = {
    runId,
    startedAt: new Date().toISOString(),
    eventsPath,
    firstEventId: null,
    lastEventId: null,
    eventCount: 0,
  };

  configurePayloadStore({ workspaceRoot: config.workspaceRoot, runId });
}

/**
 * End the currently active run. On non-silent close, emits either
 * `run.completed` (success/partial) or `run.failed` (failed) — distinct
 * event types per design memo §1.2. Then writes `index.json` with the
 * first/last event_id and total count.
 *
 * P1: emits a minimal index.json. The full run summary lands in P6 via
 * runSummaryWriter.ts.
 */
export function endRun(opts: {
  status: 'success' | 'partial' | 'failed';
  /** Required when status === 'failed'. Recorded in run.failed payload. */
  error?: { message: string; phase_id?: PhaseId | null };
  /** Suppress the run.completed/run.failed emit (used when abandoning
   * a previous run from inside startRun). Default false. */
  silent?: boolean;
}): void {
  if (!activeRun || !config) return;

  if (!opts.silent) {
    const startedMs = Date.parse(activeRun.startedAt);
    const duration_ms = Number.isNaN(startedMs) ? 0 : Date.now() - startedMs;
    if (opts.status === 'failed') {
      emit('run.failed', {
        duration_ms,
        error: opts.error ?? { message: 'workflow failed' },
      });
    } else {
      emit('run.completed', { duration_ms, status: opts.status });
    }
  }

  try {
    const indexPath = path.join(
      path.dirname(activeRun.eventsPath),
      'index.json',
    );
    fs.writeFileSync(
      indexPath,
      JSON.stringify(
        {
          schema_version: AODD_SCHEMA_VERSION,
          run_id: activeRun.runId,
          started_at: activeRun.startedAt,
          completed_at: new Date().toISOString(),
          status: opts.status,
          events: {
            first_event_id: activeRun.firstEventId,
            last_event_id: activeRun.lastEventId,
            count: activeRun.eventCount,
          },
        },
        null,
        2,
      ),
      { encoding: 'utf8' },
    );
  } catch (err) {
    process.stderr.write(
      `[aodd] WARN: failed to write index.json for ${activeRun.runId}: ` +
        `${err instanceof Error ? err.message : String(err)}\n`,
    );
  }

  // Write-time summaries (design memo §4). Sub-phase summaries are
  // derived in bulk from events.ndjson after the index.json is written;
  // the run summary follows. Errors here are logged but do not propagate
  // — a failed summary write must not break workflow completion.
  if (config) {
    try {
      deriveAndWriteSubPhaseSummaries(config.workspaceRoot, activeRun.runId);
    } catch (err) {
      process.stderr.write(
        `[aodd] WARN: sub-phase summary derivation failed for ${activeRun.runId}: ` +
          `${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
    try {
      deriveAndWriteRunSummary(
        config.workspaceRoot,
        activeRun.runId,
        config.janumicodeVersionSha,
      );
    } catch (err) {
      process.stderr.write(
        `[aodd] WARN: run summary derivation failed for ${activeRun.runId}: ` +
          `${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  configurePayloadStore(null);
  activeRun = null;
}

// ── Emit API ────────────────────────────────────────────────────────

export interface EmitOptions {
  parent_event_id?: string;
  caused_by_event_id?: string;
  metadata?: Record<string, unknown>;
  /** Override the phase_id pulled from TraceCtx (rare). */
  phase_id_override?: PhaseId;
  /** Override the sub_phase_id pulled from TraceCtx (used by LLM caller). */
  sub_phase_id_override?: string;
  /** Set when an event is associated with a specific invocation. */
  invocation_id?: string;
  /** Set when the emit-site has an agent_role distinct from the ctx. */
  agent_role?: string;
}

/**
 * Emit a single AODD event. Returns the new event_id on success, or
 * `null` when AODD is disabled / no run is active / no TraceCtx is
 * present (matches the silent-no-op pattern of `emitTransformationStep`).
 *
 * Reads `currentTraceContext()` for run/phase/sub_phase coordinates and
 * `currentParentStep()` for the default `parent_event_id`. Both are
 * overridable via `options`.
 */
export function emit<T extends AoddEventType>(
  event_type: T,
  payload: AoddEventPayload[T],
  options: EmitOptions = {},
): string | null {
  if (!config?.enabled || !activeRun) return null;

  // run_id is sourced from the active run, not TraceCtx. This lets
  // run-level events (run.completed emitted by endRun) succeed after
  // the phase frame has exited. TraceCtx supplies phase/sub_phase
  // coordinates when present; otherwise both are null.
  const ctx = currentTraceContext();

  const event_id = mintUlid();
  const ts = new Date().toISOString();

  const phase_id =
    options.phase_id_override ?? ((ctx?.phase_id ?? null) as PhaseId | null);
  const sub_phase_id =
    options.sub_phase_id_override ?? ctx?.sub_phase_id ?? null;
  // invocation_id resolves from: explicit override > TraceCtx > null.
  // The TraceCtx fallback lets `log.*` events fired inside an LLM call
  // pick up the active invocation without the caller threading it.
  const invocation_id =
    options.invocation_id ?? ctx?.invocation_id ?? null;
  const parent_event_id = options.parent_event_id ?? currentParentStep();

  const envelope: AoddEvent<T> = {
    schema_version: AODD_SCHEMA_VERSION,
    event_id,
    event_type,
    ts,
    run_id: activeRun.runId,
    phase_id,
    sub_phase_id,
    invocation_id,
    agent_role: options.agent_role ?? null,
    parent_event_id,
    caused_by_event_id: options.caused_by_event_id ?? null,
    payload,
    metadata: options.metadata ?? null,
  };

  try {
    fs.appendFileSync(activeRun.eventsPath, `${JSON.stringify(envelope)}\n`, {
      encoding: 'utf8',
    });
    activeRun.firstEventId ??= event_id;
    activeRun.lastEventId = event_id;
    activeRun.eventCount += 1;
    // Post-write side effects: sub-phase boundary tracking + focused
    // summary write. Wrapped to defend against handler failures bubbling
    // up and breaking the emit caller.
    try {
      handlePostEmitSideEffects(envelope);
    } catch (err) {
      process.stderr.write(
        `[aodd] WARN: post-emit side effect failed for ${event_type}: ` +
          `${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
    return event_id;
  } catch (err) {
    process.stderr.write(
      `[aodd] WARN: emit failed for ${event_type}: ` +
        `${err instanceof Error ? err.message : String(err)}\n`,
    );
    return null;
  }
}

/**
 * Emit an event, push its id onto the trace step_chain, run `fn`, then
 * pop. Nested emits inside `fn` automatically chain `parent_event_id`
 * back to the outer event.
 *
 * P1 note: relies on the existing `pushStep`/`popStep` on the shared
 * TraceCtx. This means AODD events and transformation_step ids share
 * the same chain — intentional, since both represent "what is the
 * current parent for the next thing I emit?"
 */
export async function withAoddSpan<T extends AoddEventType, R>(
  event_type: T,
  payload: AoddEventPayload[T],
  fn: () => Promise<R>,
  options: EmitOptions = {},
): Promise<R> {
  const id = emit(event_type, payload, options);
  if (!id) return fn();
  pushStep(id);
  try {
    return await fn();
  } finally {
    popStep();
  }
}

/** For tests + shutdown: forget the active run without writing the index. */
export function closeStreams(): void {
  if (activeRun) {
    configurePayloadStore(null);
    activeRun = null;
  }
  clearSubPhaseStateTracker();
}

// ── Post-emit side effects ──────────────────────────────────────────

/**
 * Failure-marker event types that mark the current sub-phase as
 * `status: 'failed'` for its terminal `sub_phase.exited` payload.
 * Kept small and explicit — these are events that unambiguously
 * indicate something went wrong during the sub-phase.
 */
function isFailureMarker(envelope: AoddEvent): boolean {
  if (envelope.event_type === 'llm.failed') return true;
  if (envelope.event_type === 'repair.json_failed') return true;
  if (envelope.event_type === 'decision.escalated') return true;
  if (envelope.event_type === 'gate.rejected') return true;
  if (envelope.event_type === 'record.quarantined') return true;
  if (envelope.event_type === 'record.added') {
    const payload = envelope.payload as { record_type?: string };
    if (payload.record_type === 'packet_synthesis_failure') return true;
  }
  return false;
}

function handlePostEmitSideEffects(envelope: AoddEvent): void {
  if (!activeRun || !config) return;

  // Sub-phase entered: start tracking entered_at + initial status.
  if (envelope.event_type === 'sub_phase.entered' && envelope.sub_phase_id) {
    trackSubPhaseEntered(envelope.sub_phase_id);
    return;
  }

  // Sub-phase exited: write the focused summary so it's on disk
  // immediately — no waiting on endRun. Bulk-derive pass at endRun
  // remains as safety net for sub-phases that never emitted exited
  // (e.g. mid-sub-phase process crash).
  if (
    envelope.event_type === 'sub_phase.exited' &&
    envelope.phase_id &&
    envelope.sub_phase_id
  ) {
    deriveAndWriteOneSubPhaseSummary(
      config.workspaceRoot,
      activeRun.runId,
      envelope.phase_id,
      envelope.sub_phase_id,
    );
    return;
  }

  // Failure markers inside a sub-phase: mark the active sub-phase as
  // failed so its terminal sub_phase.exited payload reflects it.
  if (envelope.sub_phase_id && isFailureMarker(envelope)) {
    markSubPhaseFailure(envelope.sub_phase_id);
  }
}
