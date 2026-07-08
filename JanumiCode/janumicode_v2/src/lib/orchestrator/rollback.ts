/**
 * Resume-time rollback support for the debug-iterate loop.
 *
 * When an operator wants to re-execute the workflow from a given
 * sub-phase (because an upstream change to a prompt template, a
 * normalizer, or a phase handler should produce different output),
 * we need to invalidate the stale records that were previously the
 * "current" outputs at-or-after that boundary. Otherwise the resumed
 * run would see both old and new "current" records in the governed
 * stream and downstream phases would read a corrupted upstream.
 *
 * Design:
 *   - Rollback is by SUB-PHASE granularity. Operator names the sub-phase
 *     they want to start from; we use the FIRST occurrence (smallest
 *     produced_at) of that sub_phase_id as the cutoff, plus the PHASE that
 *     sub-phase belongs to.
 *   - Invalidation is scoped by PIPELINE POSITION, not raw timestamp: a record
 *     is superseded iff it is in a phase AFTER the target phase (any timestamp),
 *     or in the target phase (or phase-less) AND produced_at >= cutoff. UPSTREAM
 *     phases are NEVER touched. This is load-bearing on multiply-resumed DBs,
 *     where sub-phase timestamps interleave out of dependency order and a naive
 *     `produced_at >= cutoff` sweep would tombstone still-valid upstream heads
 *     that the partial re-run never regenerates (see the phase-scope note below).
 *   - Exceptions: agent_invocation, agent_output, agent_output_chunk (and the
 *     other IMMUTABLE_HISTORY_TYPES). These are immutable history (what happened,
 *     not state). Keeping them current preserves the audit trail of what was
 *     attempted even after rollback.
 *   - The function is a pure DB mutation. The caller is responsible
 *     for advancing the state machine and emitting the
 *     workflow.resumed lifecycle event.
 *
 * Trade-off (documented up-front):
 *   - We do NOT yet partially-resume a phase. If sub-phase X is in
 *     Phase 1, rollback removes records from X onward, but the
 *     orchestrator will still re-execute Phase 1 from its first
 *     sub-phase. The records produced by the early sub-phases (which
 *     don't change because their upstream is unchanged) become
 *     fresh-but-equivalent. This is wasteful but simple, and a
 *     correctness-first first cut. A future optimization could have
 *     phase handlers skip sub-phases whose `is_current_version=1`
 *     records already exist with up-to-date inputs.
 */

import type { Database } from '../database/init';

/**
 * Immutable history record types — they describe what the LLM did,
 * not the current state of the workflow. Rollback preserves them so
 * the audit trail across attempts stays intact.
 */
const IMMUTABLE_HISTORY_TYPES = new Set([
  'agent_invocation',
  'agent_output',
  'agent_output_chunk',
  'agent_reasoning_step',
  'agent_self_correction',
  'tool_call',
  'tool_result',
  'json_repair_record',
  'llm_api_failure',
  'llm_api_recovery',
]);

export interface RollbackResult {
  cutoff_produced_at: string | null;
  /** Records flipped from is_current_version=1 to 0 in this rollback. */
  rolled_back_count: number;
  /** Records left current because their type is immutable history. */
  preserved_count: number;
  /** Per-record-type breakdown of what was rolled back. */
  rolled_back_by_type: Record<string, number>;
}

/**
 * Roll back all stateful records produced at-or-after the first
 * occurrence of `target_sub_phase_id` in this workflow run.
 *
 * Returns a result envelope describing what was changed (for the
 * lifecycle event + audit log). When no records match the target
 * sub-phase (e.g., operator named a sub-phase that never ran),
 * `cutoff_produced_at` is null and counts are zero — the caller
 * should treat that as an error.
 */
export function rollbackToSubPhase(
  db: Database,
  workflow_run_id: string,
  target_sub_phase_id: string,
): RollbackResult {
  // Find the cutoff: earliest produced_at where the target sub-phase had a
  // current-version record, plus the PHASE that sub-phase belongs to. This works
  // even if the sub-phase ran multiple times (re-runs / saturation loops): the
  // FIRST entry is the boundary. SQLite returns the bare `phase_id` from the row
  // that owns the MIN(produced_at).
  const cutoffRow = db.prepare(`
    SELECT phase_id, MIN(produced_at) AS cutoff
      FROM governed_stream
     WHERE workflow_run_id = ?
       AND sub_phase_id = ?
       AND is_current_version = 1
  `).get(workflow_run_id, target_sub_phase_id) as { phase_id: string | null; cutoff: string | null } | undefined;

  const cutoff = cutoffRow?.cutoff ?? null;
  if (!cutoff) {
    return {
      cutoff_produced_at: null,
      rolled_back_count: 0,
      preserved_count: 0,
      rolled_back_by_type: {},
    };
  }

  // PHASE-SCOPED invalidation (fixes the multiply-resumed over-sweep). A naive
  // `produced_at >= cutoff` sweep is UNSOUND once a DB has been resumed several
  // times: sub-phase timestamps interleave out of dependency order, so an UPSTREAM
  // phase's current head can carry a LATER wall-clock time than the (downstream)
  // target sub-phase and get wrongly tombstoned — then the partial re-run never
  // regenerates it (cal-41: resuming into Phase-9 `reconnaissance` @10:12 tombstoned
  // the Phase-7 test plan @11:49 + Phase-8 eval plan @10:54, so every packet lost
  // its tests/eval). Fix: invalidate strictly by PIPELINE POSITION —
  //   • records in a phase AFTER the target phase → always (any timestamp);
  //   • records in the target phase (or with no phase) → only at-or-after `cutoff`;
  //   • records in an UPSTREAM phase → NEVER, regardless of timestamp.
  // phase_id is numeric-castable across the whole pipeline ('0','0.5','1'…'10'), so
  // CAST(phase_id AS REAL) is a total order. If the target's phase_id is missing/
  // non-numeric we degrade to the old global-timestamp rule (never worse).
  const targetOrdinal = Number.parseFloat(cutoffRow?.phase_id ?? '');
  const usePhaseScope = Number.isFinite(targetOrdinal);
  const scopeSql = usePhaseScope
    ? "( CAST(phase_id AS REAL) > ? OR ((phase_id IS NULL OR phase_id = '' OR CAST(phase_id AS REAL) = ?) AND produced_at >= ?) )"
    : 'produced_at >= ?';
  const scopeParams: Array<string | number> = usePhaseScope ? [targetOrdinal, targetOrdinal, cutoff] : [cutoff];

  // Pre-count what we're about to roll back (for the result envelope + lifecycle
  // event payload). Same scope as the UPDATE below.
  const breakdown = db.prepare(`
    SELECT record_type, COUNT(*) AS n
      FROM governed_stream
     WHERE workflow_run_id = ?
       AND is_current_version = 1
       AND ${scopeSql}
  GROUP BY record_type
  `).all(workflow_run_id, ...scopeParams) as Array<{ record_type: string; n: number }>;

  const rolledByType: Record<string, number> = {};
  const preservedByType: Record<string, number> = {};
  for (const row of breakdown) {
    if (IMMUTABLE_HISTORY_TYPES.has(row.record_type)) {
      preservedByType[row.record_type] = row.n;
    } else {
      rolledByType[row.record_type] = row.n;
    }
  }

  // Build the IN-clause for the rollback target. Excluding immutable
  // history types means agent_invocation et al. retain their current
  // status, preserving the audit trail of what was attempted before.
  const stateful = breakdown
    .map((r) => r.record_type)
    .filter((t) => !IMMUTABLE_HISTORY_TYPES.has(t));
  if (stateful.length === 0) {
    return {
      cutoff_produced_at: cutoff,
      rolled_back_count: 0,
      preserved_count: sumValues(preservedByType),
      rolled_back_by_type: {},
    };
  }

  const placeholders = stateful.map(() => '?').join(',');
  const now = new Date().toISOString();
  const update = db.prepare(`
    UPDATE governed_stream
       SET is_current_version = 0,
           superseded_at      = ?
     WHERE workflow_run_id   = ?
       AND is_current_version = 1
       AND record_type IN (${placeholders})
       AND ${scopeSql}
  `);
  const info = update.run(now, workflow_run_id, ...stateful, ...scopeParams);

  return {
    cutoff_produced_at: cutoff,
    rolled_back_count: info.changes,
    preserved_count: sumValues(preservedByType),
    rolled_back_by_type: rolledByType,
  };
}

function sumValues(o: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(o)) total += v;
  return total;
}

/**
 * Zero a resumed run's cycle counter so Phase 6/7/8 execute their FULL
 * generate-and-gatekeep path on the next forward pass instead of the
 * `runPhaseNCycleDelta` incremental path (which they take whenever
 * `current_cycle_number > 0`, i.e. after the run went through packet-synthesis-
 * failure route-and-restart cycles). The delta path only heals failure-seed
 * orphans and never re-runs the generator, so a fix living in the main path
 * (e.g. a Phase-7 test-plan gatekeeper change) would be silently skipped on a
 * cycle-mode resume. Pairs with {@link rollbackToSubPhase} — rollback moves the
 * artifacts back, this moves the run out of cycle mode. Returns the prior cycle
 * number (for logging); a no-op returns 0 if the run was already at 0/unset.
 */
export function resetRunCycleCounter(db: Database, workflow_run_id: string): number {
  const row = db.prepare(
    `SELECT current_cycle_number AS n FROM workflow_runs WHERE id = ?`,
  ).get(workflow_run_id) as { n: number | null } | undefined;
  const prior = row?.n ?? 0;
  db.prepare(
    `UPDATE workflow_runs SET current_cycle_number = 0 WHERE id = ?`,
  ).run(workflow_run_id);
  return prior;
}
