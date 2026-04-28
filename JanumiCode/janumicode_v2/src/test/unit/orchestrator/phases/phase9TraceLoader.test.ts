/**
 * Regression tests for Phase 9's executor-trace loader.
 *
 * Pins two related guarantees:
 *   1. Records are correlated by `produced_by_record_id` (the executor's
 *      `invocation_id`), NOT by some other field. Earlier code filtered
 *      on `content.task_id`, then on a phase9-local id that the executor
 *      never wrote — both bugs returned zero rows and starved
 *      reasoning_review of evidence, producing false-positive
 *      `completeness_shortcut` flags. If a future regression filters on
 *      the wrong column again, this test fires.
 *   2. The raw `record_type` is preserved through the typeMap so
 *      ContextBuilder.buildTraceSelection can distinguish tool_calls
 *      from reasoning steps. The original code lumped everything as
 *      `agent_reasoning_step`, which silently broke the always-include-
 *      tool-calls and tool-result-exclusion logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { GovernedStreamWriter } from '../../../../lib/orchestrator/governedStreamWriter';
import { loadExecutorTrace } from '../../../../lib/orchestrator/phases/phase9TraceLoader';

let idCounter = 0;
function testId(): string { return `tl-${++idCounter}`; }

describe('phase9TraceLoader.loadExecutorTrace', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  const runId = 'run-tl-1';
  const matchingInvocationId = 'inv-match';
  const otherInvocationId = 'inv-other';

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES (?, 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run(runId);
    writer = new GovernedStreamWriter(db, testId);
  });

  afterEach(() => { db.close(); });

  function writeChild(recordType: string, content: Record<string, unknown>, producedById: string | null): string {
    const rec = writer.writeRecord({
      record_type: recordType as 'agent_reasoning_step',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: '9',
      sub_phase_id: '9.1',
      produced_by_agent_role: 'executor_agent',
      produced_by_record_id: producedById ?? undefined,
      janumicode_version_sha: 'dev',
      content,
    });
    return rec.id;
  }

  it('returns only rows whose produced_by_record_id matches the invocationId', () => {
    // Matching invocation — these MUST come back.
    writeChild('agent_reasoning_step', { type: 'thinking', content: 'planning' }, matchingInvocationId);
    writeChild('tool_call',           { name: 'Write', input: { file_path: '/x' } }, matchingInvocationId);
    writeChild('tool_result',         { name: 'Write', output: 'ok' }, matchingInvocationId);
    writeChild('agent_self_correction', { content: 'fixed' }, matchingInvocationId);
    writeChild('file_system_write_record', { file_path: '/x', operation: 'create' }, matchingInvocationId);

    // Decoys — different invocation. Must NOT come back.
    writeChild('tool_call', { name: 'Read', input: {} }, otherInvocationId);
    writeChild('agent_reasoning_step', { type: 'thinking', content: 'unrelated' }, otherInvocationId);

    // Decoy — null produced_by_record_id (e.g. an agent_invocation row
    // for some other context). Must NOT come back.
    writeChild('agent_invocation', { task_id: 'TASK-X', invocation_id: 'inv-X' }, null);

    const result = loadExecutorTrace(db, runId, matchingInvocationId);

    expect(result.rows.length).toBe(5);
    expect(result.typeCounts).toEqual({
      agent_reasoning_step: 1,
      tool_call: 1,
      tool_result: 1,
      agent_self_correction: 1,
      file_system_write_record: 1,
    });

    // typeMap filters out file_system_write_record — only the four
    // ContextBuilder-recognised types reach reasoning_review.
    expect(result.traceRecords.length).toBe(4);
    const traceTypes = result.traceRecords.map(r => r.type).sort();
    expect(traceTypes).toEqual([
      'agent_reasoning_step',
      'agent_self_correction',
      'tool_call',
      'tool_result',
    ]);
  });

  it('preserves each row\'s actual record_type rather than lumping them all together', () => {
    // Earlier phase9.ts code mapped EVERY record to 'agent_reasoning_step'.
    // ContextBuilder then couldn't tell tool_calls apart, breaking the
    // always-include-tool-calls and exclude-tool-results invariants.
    writeChild('agent_reasoning_step', { type: 'thinking', content: 'r1' }, matchingInvocationId);
    writeChild('tool_call',           { name: 'Read' }, matchingInvocationId);
    writeChild('tool_call',           { name: 'Write' }, matchingInvocationId);
    writeChild('tool_result',         { output: 'a' }, matchingInvocationId);

    const { traceRecords } = loadExecutorTrace(db, runId, matchingInvocationId);

    const byType: Record<string, number> = {};
    for (const r of traceRecords) byType[r.type] = (byType[r.type] ?? 0) + 1;
    expect(byType).toEqual({
      agent_reasoning_step: 1,
      tool_call: 2,
      tool_result: 1,
    });
  });

  it('returns an empty result when no records match (empty type counts, empty trace)', () => {
    // The diagnostic logger keys off rows.length === 0; this contract
    // pins that an empty match looks like an empty result, not an
    // exception.
    const result = loadExecutorTrace(db, runId, 'no-such-invocation');
    expect(result.rows).toEqual([]);
    expect(result.traceRecords).toEqual([]);
    expect(result.typeCounts).toEqual({});
  });

  it('only returns is_current_version=1 rows', () => {
    // Sanity: superseded rows must not leak into the trace.
    const recId = writeChild('tool_call', { name: 'X' }, matchingInvocationId);
    db.prepare(`UPDATE governed_stream SET is_current_version = 0 WHERE id = ?`).run(recId);

    const result = loadExecutorTrace(db, runId, matchingInvocationId);
    expect(result.rows.length).toBe(0);
  });

  it('respects sequencePosition order so the reviewer sees a coherent timeline', () => {
    writeChild('agent_reasoning_step', { content: 'step-1' }, matchingInvocationId);
    writeChild('tool_call', { name: 'Read' }, matchingInvocationId);
    writeChild('agent_reasoning_step', { content: 'step-2' }, matchingInvocationId);

    const { traceRecords } = loadExecutorTrace(db, runId, matchingInvocationId);
    expect(traceRecords.map(r => r.sequencePosition)).toEqual([0, 1, 2]);
  });
});
