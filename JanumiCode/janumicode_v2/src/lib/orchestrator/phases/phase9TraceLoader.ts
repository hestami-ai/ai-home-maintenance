/**
 * Loads the executor's execution trace from the governed stream for
 * Phase 9 reasoning_review. Extracted from phase9.ts so the SQL filter
 * and typeMap can be regression-tested without spinning up a full
 * Phase9Handler.
 *
 * Correlation key — the executor (ExecutorAgent.execute) generates an
 * `invocation_id` and stamps it on every child trace record's
 * `produced_by_record_id`. ExecutionResult.invocationId is the same
 * value. Phase9 must filter the trace using THAT id, not the local
 * detail-file id phase9 generates separately.
 */

import type { Database } from '../../database/init';
import type { TraceRecord } from '../contextBuilder';

interface TraceRow {
  id: string;
  record_type: string;
  content: string;
  produced_at: string;
}

const TRACE_TYPE_MAP: Record<string, TraceRecord['type']> = {
  agent_reasoning_step: 'agent_reasoning_step',
  agent_self_correction: 'agent_self_correction',
  tool_call: 'tool_call',
  tool_result: 'tool_result',
};

export interface ExecutorTraceLoadResult {
  /** Raw rows from the SQL query (pre-typeMap filter). */
  rows: TraceRow[];
  /** Records mapped to TraceRecord shape, suitable for ReasoningReview. */
  traceRecords: TraceRecord[];
  /** Counts by raw record_type — used for diagnostic logging. */
  typeCounts: Record<string, number>;
}

export function loadExecutorTrace(
  db: Database,
  workflowRunId: string,
  invocationId: string,
): ExecutorTraceLoadResult {
  const rows = db.prepare(`
    SELECT id, record_type, content, produced_at FROM governed_stream
    WHERE workflow_run_id = ? AND phase_id = '9' AND sub_phase_id = '9.1'
      AND is_current_version = 1
      AND produced_by_record_id = ?
    ORDER BY produced_at ASC
  `).all(workflowRunId, invocationId) as TraceRow[];

  const typeCounts: Record<string, number> = {};
  for (const r of rows) {
    typeCounts[r.record_type] = (typeCounts[r.record_type] ?? 0) + 1;
  }

  // Map governed_stream record_type → TraceRecord.type. ContextBuilder
  // distinguishes tool_call / tool_result / agent_reasoning_step /
  // agent_self_correction for selection (tool_results are dropped,
  // reasoning steps adjacent to tool_calls are kept). Lumping every
  // record under a single type defeats that selection logic.
  const traceRecords: TraceRecord[] = rows
    .filter(r => r.record_type in TRACE_TYPE_MAP)
    .map((r, i) => ({
      id: r.id,
      type: TRACE_TYPE_MAP[r.record_type],
      content: r.content,
      sequencePosition: i,
      tokenCount: Math.ceil(r.content.length / 4),
    }));

  return { rows, traceRecords, typeCounts };
}
