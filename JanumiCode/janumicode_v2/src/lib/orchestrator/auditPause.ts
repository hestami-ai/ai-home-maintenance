/**
 * Audit-pause hook for agent-driven sub-phase auditing.
 *
 * Architecture
 * ────────────
 * When JANUMICODE_AUDIT_PAUSE=1, the orchestrator's state-machine pauses
 * synchronously at every sub-phase boundary (right after the prior
 * sub-phase's records are persisted, before the next sub-phase's handler
 * fires). The pause writes a marker file describing the just-completed
 * sub-phase, then spin-sleeps until an ack file appears.
 *
 * An external audit agent (Claude in the parent process) watches the
 * pending directory, performs its review (DB queries, deep-audit script,
 * semantic content checks of artifacts + handoffs), then drops the ack
 * file to release the pause.
 *
 * Why a file-marker scheme and not a CDP breakpoint:
 *   - Survives CDP harness restarts. The pause state lives on disk.
 *   - No source-map / dist-line-number drift between src/ and dist/.
 *   - No race between scriptParsed and Debugger.setBreakpoint.
 *   - Inspector port stays open — the agent can attach with the CDP
 *     harness for runtime introspection during a pause if needed.
 *
 * Synchronous on purpose: blocking the event loop is the only way to
 * guarantee no further phase handlers run until ack. Other in-flight
 * LLM calls and DB writes complete naturally (their threads aren't
 * blocked); they just can't trigger new phase work because the JS
 * event loop is parked.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  emit as aoddEmit,
  phaseIdToFilenameSegment,
  subPhaseIdToFilenameSegment,
} from '../aodd';
import type { PhaseId } from '../types/records';

interface AuditPauseConfig {
  workspaceRoot: string;
  /**
   * Maximum seconds to wait for an ack before giving up and aborting
   * the run. Defaults to 4 hours — generous so a human can step away
   * mid-audit, but not infinite so an abandoned run eventually exits.
   */
  ackTimeoutSeconds: number;
  /** Poll interval in milliseconds. Default 500ms. */
  pollIntervalMs: number;
  /**
   * Optional DB handle for the resume-cascade-skip check. When provided,
   * the auditPause queries this DB on each pause to determine whether
   * the prior sub-phase produced any records in the current process's
   * lifetime — if not, the pause auto-resumes silently. This eliminates
   * the wall of cached-replay pauses that fire when a resume re-runs
   * Phase 1 from its first sub-phase. Each cached replay produces zero
   * fresh records (LLM cache short-circuits the writer), so the pause
   * would force the operator to ack ~10 no-op sub-phases before reaching
   * the actual re-execution target.
   */
  db: import('../database/init').Database | null;
}

let config: AuditPauseConfig | null = null;
let pauseSeq = 0;
/**
 * Wall-clock when configureAuditPause was called. Used to distinguish
 * records produced THIS process (after this timestamp) from records
 * inherited from a prior process via --resume-from-db (before). The
 * cascade-skip check uses this to auto-resume cached-replay pauses.
 *
 * Set as ISO string for direct SQL comparison against produced_at.
 */
let processStartedAt: string = new Date().toISOString();

export function configureAuditPause(c: { workspaceRoot: string; ackTimeoutSeconds?: number; pollIntervalMs?: number; db?: import('../database/init').Database } | null): void {
  if (!c) { config = null; return; }
  config = {
    workspaceRoot: c.workspaceRoot,
    ackTimeoutSeconds: c.ackTimeoutSeconds ?? 4 * 60 * 60,
    pollIntervalMs: c.pollIntervalMs ?? 500,
    db: c.db ?? null,
  };
  processStartedAt = new Date().toISOString();
}

export function isAuditPauseEnabled(): boolean {
  return config !== null && process.env.JANUMICODE_AUDIT_PAUSE === '1';
}

interface PauseMarker {
  seq: number;
  ts: string;
  workflow_run_id: string;
  prior_phase_id: string | null;
  prior_sub_phase_id: string;
  next_sub_phase_id: string;
  /**
   * Set on phase-boundary markers only (auditPhaseExitPauseSync).
   * When 'phase_exit', the pause covers the end of a phase rather than
   * a sub-phase transition within a phase. The marker filename also
   * encodes this distinction (`{seq}__phase{N}_exit__...json`).
   */
  kind?: 'sub_phase_exit' | 'phase_exit';
  next_phase_id?: string | null;
}

/**
 * Cascade-skip decision. Returns true when the prior sub-phase did no
 * real LLM work in THIS process — the signal is `agent_invocation`
 * records, written only when the LLMCaller actually makes an HTTP call to
 * a provider (a cache hit short-circuits and emits none). `produced_at >=
 * processStartedAt` restricts the count to this process's lifetime.
 *
 * On a skip, `skipLog` (the exact stderr line the caller wants) is
 * emitted. A query failure must NOT block the workflow: it logs a warning
 * naming `warnLabel` and returns false so the caller falls through to a
 * normal pause.
 */
function shouldCascadeSkip(
  db: import('../database/init').Database,
  workflowRunId: string,
  subPhaseId: string,
  skipLog: string,
  warnLabel: string,
): boolean {
  try {
    const row = db.prepare(`
        SELECT COUNT(*) AS n
          FROM governed_stream
         WHERE workflow_run_id = ?
           AND sub_phase_id    = ?
           AND record_type     = 'agent_invocation'
           AND produced_at     >= ?
      `).get(workflowRunId, subPhaseId, processStartedAt) as { n: number } | undefined;
    if ((row?.n ?? 0) === 0) {
      process.stderr.write(skipLog);
      return true;
    }
    return false;
  } catch (err) {
    // Defensive: a query failure must not block the workflow. Fall
    // through to the normal pause path so the operator still sees it.
    process.stderr.write(
      `[audit-pause] WARN ${warnLabel} (${err instanceof Error ? err.message : String(err)}); falling through to pause\n`,
    );
    return false;
  }
}

/** Ensure the audit pending/acks/done directories exist; return their paths. */
function ensureAuditDirs(workspaceRoot: string): {
  pendingDir: string;
  ackDir: string;
  doneDir: string;
} {
  const pendingDir = path.join(workspaceRoot, '.janumicode', 'audit', 'pending');
  const ackDir = path.join(workspaceRoot, '.janumicode', 'audit', 'acks');
  const doneDir = path.join(workspaceRoot, '.janumicode', 'audit', 'done');
  for (const d of [pendingDir, ackDir, doneDir]) fs.mkdirSync(d, { recursive: true });
  return { pendingDir, ackDir, doneDir };
}

interface AckWaitParams {
  seq: number;
  ackPath: string;
  markerPath: string;
  doneDir: string;
  basename: string;
  /** Exact stderr line to emit once the pause resumes (non-abort). */
  resumedLog: string;
  /** Build the abort Error message from the ack's reason. */
  abortMessage: (reason: string) => string;
}

/**
 * Process an ack file that has appeared: read + parse it, move the marker
 * and ack into done/ (best effort), then either throw (abort) or emit the
 * resolve event and log the resume. Empty/unreadable ack ⇒ treated as a
 * plain continue.
 */
function resolveAck(p: AckWaitParams): void {
  let ackContent = '';
  try { ackContent = fs.readFileSync(p.ackPath, 'utf8'); } catch { /* race; loop */ }
  let parsed: { action?: string; reason?: string } = {};
  try { parsed = JSON.parse(ackContent); } catch { /* empty ack ⇒ continue */ }
  // Move marker + ack to done/ so the pending dir reflects only
  // outstanding pauses. Lets the operator visually verify nothing
  // is hanging.
  try {
    fs.renameSync(p.markerPath, path.join(p.doneDir, `${p.basename}.json`));
    fs.renameSync(p.ackPath, path.join(p.doneDir, `${p.basename}.ack`));
  } catch { /* best effort */ }

  if (parsed.action === 'abort') {
    aoddEmit('audit.pause_resolved', {
      seq: p.seq,
      ack_path: p.ackPath,
      action: 'abort',
    });
    throw new Error(p.abortMessage(parsed.reason ?? 'no reason given'));
  }
  aoddEmit('audit.pause_resolved', {
    seq: p.seq,
    ack_path: p.ackPath,
    ...(parsed.action ? { action: parsed.action } : {}),
  });
  process.stderr.write(p.resumedLog);
}

/**
 * Block the event loop until the ack file appears or the deadline passes.
 * On ack: delegate to resolveAck (returns on continue, throws on abort).
 * On deadline: throw the timeout error.
 *
 * Synchronous sleep via Atomics.wait on an SAB — blocks the JS event loop
 * without burning CPU. SharedArrayBuffer support is universal in modern
 * Node; falling back to busy-spin would peg a core.
 */
function waitForAck(
  p: AckWaitParams & {
    ackTimeoutSeconds: number;
    pollIntervalMs: number;
    timeoutMessage: string;
  },
): void {
  const deadline = Date.now() + p.ackTimeoutSeconds * 1000;
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  while (Date.now() < deadline) {
    if (fs.existsSync(p.ackPath)) {
      resolveAck(p);
      return;
    }
    Atomics.wait(view, 0, 0, p.pollIntervalMs);
  }
  throw new Error(p.timeoutMessage);
}

/**
 * Block the event loop until an ack file appears for this pause. Called
 * by stateMachine.setSubPhase() right before the sub_phase.entered emit.
 *
 * The marker filename is monotonic (`<seq>__<phase>__<sub_phase>.json`)
 * so the audit agent can process them in order. The ack must match the
 * marker's basename with a `.ack` extension.
 *
 * Returns nothing on continue. Throws on abort or timeout — the caller
 * lets the throw propagate up, aborting the workflow cleanly.
 */
export function auditPauseSync(args: {
  workflowRunId: string;
  priorPhaseId: string | null;
  priorSubPhaseId: string;
  nextSubPhaseId: string;
}): void {
  if (!isAuditPauseEnabled() || !config) return;

  // Cascade-skip: skip the pause when the prior sub-phase did no real
  // LLM work in THIS process. The signal is agent_invocation records:
  // they are written only when the LLMCaller actually makes an HTTP
  // call to a provider (the LLM-call cache short-circuits and does NOT
  // emit agent_invocation on cache hit). artifact_produced is NOT a
  // valid signal — the phase handler always writes it even when all
  // upstream LLM data came from cache.
  //
  // Eliminates the 10-pause cascade that fires when a --resume-from-db
  // run re-executes Phase 1 from its first sub-phase with every LLM
  // call hitting the primed cache. The first pause in a fresh run is
  // never skipped (Phase 0's first sub-phase makes real LLM calls).
  if (
    config.db &&
    shouldCascadeSkip(
      config.db,
      args.workflowRunId,
      args.priorSubPhaseId,
      `[audit-pause] SKIP (cascade) prior=${args.priorSubPhaseId} next=${args.nextSubPhaseId} ` +
      `— no fresh LLM invocations this process\n`,
      'cascade-skip query failed',
    )
  ) {
    return;
  }

  const seq = ++pauseSeq;
  const ts = new Date().toISOString();
  const safeSub = subPhaseIdToFilenameSegment(args.priorSubPhaseId);
  const phaseSeg = args.priorPhaseId
    ? phaseIdToFilenameSegment(args.priorPhaseId as PhaseId, { padded: false })
    : 'phaseno_phase';
  const basename = `${String(seq).padStart(4, '0')}__${phaseSeg}__${safeSub}`;

  const { pendingDir, ackDir, doneDir } = ensureAuditDirs(config.workspaceRoot);

  const marker: PauseMarker = {
    seq,
    ts,
    workflow_run_id: args.workflowRunId,
    prior_phase_id: args.priorPhaseId,
    prior_sub_phase_id: args.priorSubPhaseId,
    next_sub_phase_id: args.nextSubPhaseId,
  };
  const markerPath = path.join(pendingDir, `${basename}.json`);
  const ackPath = path.join(ackDir, `${basename}.ack`);
  fs.writeFileSync(markerPath, JSON.stringify(marker, null, 2), 'utf8');
  aoddEmit('audit.pause_emitted', { seq, marker_path: markerPath });

  process.stderr.write(
    `[audit-pause] PAUSED at sub_phase.exited prior=${args.priorSubPhaseId} next=${args.nextSubPhaseId} seq=${seq}\n` +
    `[audit-pause]   marker: ${markerPath}\n` +
    `[audit-pause]   awaiting ack: ${ackPath}\n`,
  );

  // CDP debugger pause: when an inspector is attached, this halts the V8
  // thread and the CDP harness can read locals, evaluate expressions, then
  // call Debugger.resume to release. No-op when no inspector is attached
  // (production / un-debugged runs just fall through to the file poll).
  //
  // Order matters: we write the marker file FIRST so the harness can read
  // pause context on the Debugger.paused event. After the harness sends
  // Debugger.resume, execution falls into the sync ack-file poll loop
  // below — that loop is what gates progression. The CDP pause is a
  // courtesy interrupt for runtime introspection; the ack file is the
  // semantic gate. Both must release before the workflow advances.
  if (process.env.JANUMICODE_AUDIT_CDP_BREAK === '1') {
    // eslint-disable-next-line no-debugger
    debugger;
  }

  waitForAck({
    seq,
    ackPath,
    markerPath,
    doneDir,
    basename,
    ackTimeoutSeconds: config.ackTimeoutSeconds,
    pollIntervalMs: config.pollIntervalMs,
    resumedLog: `[audit-pause] resumed seq=${seq}\n`,
    abortMessage: (reason) =>
      `[audit-pause] aborted by audit agent at sub_phase.exited "${args.priorSubPhaseId}": ${reason}`,
    timeoutMessage: `[audit-pause] timed out waiting for ack at sub_phase.exited "${args.priorSubPhaseId}" after ${config.ackTimeoutSeconds}s`,
  });
}

/**
 * Phase-boundary audit pause. Distinct from sub_phase.exited because the
 * state machine's advancePhase() clears current_sub_phase_id atomically
 * with the phase change, so the next phase's first setSubPhase sees
 * `prior.current_sub_phase_id = null` and never emits a sub_phase.exited
 * for the last sub-phase of the prior phase. Without this hook the
 * audit pause for material work like Phase 1.8 release_plan is silently
 * dropped.
 *
 * Marker filename pattern: `{seq}__phase{N}_exit__lastsub_{X}.json`
 * (distinguishable from sub_phase markers `{seq}__phase{N}__{X}.json`).
 *
 * The same cascade-skip rule applies: if the last sub-phase of the
 * exiting phase produced zero `agent_invocation` records this process
 * (deterministic-only phase), the pause auto-resumes.
 */
export function auditPhaseExitPauseSync(args: {
  workflowRunId: string;
  priorPhaseId: string;
  priorSubPhaseId: string | null;
  nextPhaseId: string;
}): void {
  if (!isAuditPauseEnabled() || !config) return;

  // Cascade-skip when the last sub-phase did no real LLM work this process.
  // priorSubPhaseId may be null on transitions out of phases that never
  // set a sub-phase (rare — Phase 0 cleanup); in that case skip.
  if (!args.priorSubPhaseId) return;
  if (
    config.db &&
    shouldCascadeSkip(
      config.db,
      args.workflowRunId,
      args.priorSubPhaseId,
      `[audit-pause] SKIP (cascade) phase_exit prior_phase=${args.priorPhaseId} last_sub=${args.priorSubPhaseId} ` +
      `next_phase=${args.nextPhaseId} — no fresh LLM invocations\n`,
      'cascade-skip query failed at phase exit',
    )
  ) {
    return;
  }

  const seq = ++pauseSeq;
  const ts = new Date().toISOString();
  const safeSub = subPhaseIdToFilenameSegment(args.priorSubPhaseId);
  const phaseSeg = phaseIdToFilenameSegment(args.priorPhaseId as PhaseId, { padded: false });
  const basename = `${String(seq).padStart(4, '0')}__${phaseSeg}_exit__lastsub_${safeSub}`;

  const { pendingDir, ackDir, doneDir } = ensureAuditDirs(config.workspaceRoot);

  const marker: PauseMarker = {
    seq,
    ts,
    workflow_run_id: args.workflowRunId,
    prior_phase_id: args.priorPhaseId,
    prior_sub_phase_id: args.priorSubPhaseId,
    next_sub_phase_id: '<phase_exit>',
    kind: 'phase_exit',
    next_phase_id: args.nextPhaseId,
  };
  const markerPath = path.join(pendingDir, `${basename}.json`);
  const ackPath = path.join(ackDir, `${basename}.ack`);
  fs.writeFileSync(markerPath, JSON.stringify(marker, null, 2), 'utf8');
  aoddEmit('audit.pause_emitted', { seq, marker_path: markerPath });

  process.stderr.write(
    `[audit-pause] PAUSED at phase.exited prior_phase=${args.priorPhaseId} last_sub=${args.priorSubPhaseId} ` +
    `next_phase=${args.nextPhaseId} seq=${seq}\n` +
    `[audit-pause]   marker: ${markerPath}\n` +
    `[audit-pause]   awaiting ack: ${ackPath}\n`,
  );

  if (process.env.JANUMICODE_AUDIT_CDP_BREAK === '1') {
    // eslint-disable-next-line no-debugger
    debugger;
  }

  waitForAck({
    seq,
    ackPath,
    markerPath,
    doneDir,
    basename,
    ackTimeoutSeconds: config.ackTimeoutSeconds,
    pollIntervalMs: config.pollIntervalMs,
    resumedLog: `[audit-pause] resumed phase_exit seq=${seq}\n`,
    abortMessage: (reason) =>
      `[audit-pause] aborted at phase.exited "${args.priorPhaseId}": ${reason}`,
    timeoutMessage: `[audit-pause] timed out waiting for phase.exited ack on phase "${args.priorPhaseId}" after ${config.ackTimeoutSeconds}s`,
  });
}
