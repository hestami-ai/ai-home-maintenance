/**
 * Tracks the entered_at timestamp + accumulating diagnostic state for
 * each in-flight sub-phase, so when `sub_phase.exited` fires the
 * payload can carry an accurate `duration_ms` and a `status` that
 * reflects whether any failure marker was observed during the
 * sub-phase.
 *
 * Module-level state. Keyed by `sub_phase_id` because sub_phase ids
 * are unique within a workflow run and a single process only runs one
 * workflow at a time.
 *
 * Update flow:
 *   - `emit('sub_phase.entered', ...)` in `emit.ts` calls
 *     `trackSubPhaseEntered(id)`.
 *   - Failure-marker events (`llm.failed`, `repair.json_failed`,
 *     `decision.escalated`, and `record.added` for
 *     `packet_synthesis_failure`) call `markSubPhaseFailure(id)` for
 *     the active sub-phase.
 *   - `stateMachine.ts setSubPhase()` calls `consumeSubPhaseState(id)`
 *     just before emitting the `sub_phase.exited` event so the payload
 *     carries the real duration + accumulated status.
 *
 * The bulk-derive pass at `endRun()` still works because the derived
 * `how.status` re-reads events from disk; this tracker only matters
 * for the in-line `sub_phase.exited` event payload.
 */

interface SubPhaseState {
  entered_at: number;
  status: 'success' | 'partial' | 'failed';
}

const state = new Map<string, SubPhaseState>();

export function trackSubPhaseEntered(subPhaseId: string): void {
  state.set(subPhaseId, { entered_at: Date.now(), status: 'success' });
}

export function markSubPhaseFailure(subPhaseId: string): void {
  const s = state.get(subPhaseId);
  if (s) s.status = 'failed';
}

export function consumeSubPhaseState(
  subPhaseId: string,
): { duration_ms: number; status: 'success' | 'partial' | 'failed' } {
  const s = state.get(subPhaseId);
  if (!s) return { duration_ms: 0, status: 'success' };
  state.delete(subPhaseId);
  return {
    duration_ms: Math.max(0, Date.now() - s.entered_at),
    status: s.status,
  };
}

/** Reset between runs / tests. Called by `closeStreams()` and `endRun()`. */
export function clearSubPhaseStateTracker(): void {
  state.clear();
}
