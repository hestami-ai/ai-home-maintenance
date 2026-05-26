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
 *     produced_at) of that sub_phase_id as the cutoff timestamp.
 *   - Every record with produced_at >= cutoff AND is_current_version=1
 *     gets marked is_current_version=0 (superseded). Exceptions:
 *        agent_invocation, agent_output, agent_output_chunk
 *     These are immutable history (what happened, not state). Keeping
 *     them current preserves the audit trail of what was attempted
 *     even after rollback.
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
  'transformation_step',
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
  // Find the cutoff: earliest produced_at where the target sub-phase
  // had a current-version record. This works even if the sub-phase
  // ran multiple times (re-runs / saturation loops): the FIRST entry
  // is the boundary we want to roll back to.
  const cutoffRow = db.prepare(`
    SELECT MIN(produced_at) AS cutoff
      FROM governed_stream
     WHERE workflow_run_id = ?
       AND sub_phase_id = ?
       AND is_current_version = 1
  `).get(workflow_run_id, target_sub_phase_id) as { cutoff: string | null } | undefined;

  const cutoff = cutoffRow?.cutoff ?? null;
  if (!cutoff) {
    return {
      cutoff_produced_at: null,
      rolled_back_count: 0,
      preserved_count: 0,
      rolled_back_by_type: {},
    };
  }

  // Pre-count what we're about to roll back (for the result envelope
  // + lifecycle event payload). Same WHERE as the UPDATE below.
  const breakdown = db.prepare(`
    SELECT record_type, COUNT(*) AS n
      FROM governed_stream
     WHERE workflow_run_id = ?
       AND produced_at >= ?
       AND is_current_version = 1
  GROUP BY record_type
  `).all(workflow_run_id, cutoff) as Array<{ record_type: string; n: number }>;

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
       AND produced_at       >= ?
       AND is_current_version = 1
       AND record_type IN (${placeholders})
  `);
  const info = update.run(now, workflow_run_id, cutoff, ...stateful);

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
