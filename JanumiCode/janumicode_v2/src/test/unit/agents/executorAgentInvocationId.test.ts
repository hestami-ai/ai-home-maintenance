/**
 * Regression tests for ExecutorAgent.execute()'s invocationId contract.
 *
 * Background — silent false-positive cascade:
 *   Phase 9 dispatches one ExecutionTask at a time, then runs
 *   ReasoningReview against the trace records the executor produced.
 *   The reviewer is supposed to see every tool_call, agent_reasoning_step
 *   and agent_self_correction emitted during execution.
 *
 *   Originally, phase9 generated its own UUID locally (used to name a
 *   per-task detail file) and fed THAT UUID into the SQL filter for the
 *   reviewer's trace records. ExecutorAgent meanwhile generated its own
 *   internal `invocation_id` and stamped THAT on every child record's
 *   `produced_by_record_id`. The two IDs never matched. The SQL query
 *   returned zero rows, the reviewer received an empty trace text, and
 *   correctly concluded "no evidence of work" — emitting a false-positive
 *   `completeness_shortcut` flag on every executor task.
 *
 * Fix:
 *   ExecutionResult now carries `invocationId`, set to the executor's
 *   internal id. Callers must filter trace records by THIS field to
 *   correlate them with the executor invocation.
 *
 * This file pins three guarantees:
 *   1. ExecutionResult.invocationId is non-empty and matches the
 *      `agent_invocation.content.invocation_id` of the row the executor
 *      writes at the start of execution.
 *   2. Every child trace record (tool_call / tool_result / reasoning /
 *      self-correction / file_system_write_record) carries
 *      `produced_by_record_id === ExecutionResult.invocationId`.
 *   3. Idempotent / indeterminate early-exit paths still populate
 *      invocationId so callers don't crash on missing fields.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { EventBus } from '../../../lib/events/eventBus';
import { AgentInvoker } from '../../../lib/orchestrator/agentInvoker';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import { ExecutorAgent, type ExecutionTask } from '../../../lib/agents/executorAgent';

let idCounter = 0;
function testId(): string { return `eaid-${++idCounter}`; }

describe('ExecutorAgent — invocationId contract', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let agentInvoker: AgentInvoker;
  let executor: ExecutorAgent;
  let tmpDir: string;
  const runId = 'run-eaid-1';

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES (?, 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run(runId);

    writer = new GovernedStreamWriter(db, testId);
    const eventBus = new EventBus();
    const llm = new LLMCaller({ maxRetries: 0 });
    agentInvoker = new AgentInvoker(llm, {
      timeoutSeconds: 1,
      idleTimeoutSeconds: 1,
      bufferMaxEvents: 100,
    });
    executor = new ExecutorAgent(db, agentInvoker, writer, eventBus, testId);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-eaid-'));
  });

  afterEach(() => {
    db.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  function makeTask(overrides: Partial<ExecutionTask> = {}): ExecutionTask {
    return {
      id: 'TASK-001',
      taskType: 'standard',
      componentId: 'comp-1',
      componentResponsibility: 'create files',
      description: 'test',
      backingTool: 'claude_code_cli',
      completionCriteria: [],
      writeDirectoryPaths: [tmpDir],
      ...overrides,
    };
  }

  it('returns the same invocationId stamped on agent_invocation.content.invocation_id', async () => {
    (agentInvoker as unknown as { invoke: (opts: unknown) => Promise<unknown> }).invoke = vi.fn(async () => ({
      success: true,
      cliResult: { exitCode: 0, timedOut: false, idledOut: false, events: [], stderr: '', durationMs: 1 },
    }));

    const out = await executor.execute(makeTask(), runId, 'stdin', tmpDir, 'dev');

    expect(out.invocationId).toBeTruthy();
    const invocationRow = db.prepare(`
      SELECT json_extract(content, '$.invocation_id') AS iid
      FROM governed_stream
      WHERE workflow_run_id = ? AND record_type = 'agent_invocation'
    `).get(runId) as { iid: string } | undefined;
    expect(invocationRow?.iid).toBe(out.invocationId);
  });

  it('stamps every child trace record with produced_by_record_id === invocationId', async () => {
    // Scripted CLI run: two reasoning steps + one tool_call + one
    // tool_result + a file write. Every one of these must correlate
    // back to the executor's invocationId.
    const targetFile = path.resolve(tmpDir, 'out.txt');
    (agentInvoker as unknown as { invoke: (opts: unknown) => Promise<unknown> }).invoke = vi.fn(async () => {
      fs.writeFileSync(targetFile, 'hello');
      return {
        success: true,
        cliResult: {
          exitCode: 0, timedOut: false, idledOut: false, durationMs: 1, stderr: '',
          events: [
            { recordType: 'agent_reasoning_step', data: { type: 'thinking', content: 'planning…', text: 'planning…' }, sequencePosition: 0, isSelfCorrection: false },
            { recordType: 'tool_call', data: { name: 'Write', input: { file_path: targetFile } }, sequencePosition: 1, isSelfCorrection: false },
            { recordType: 'tool_result', data: { name: 'Write', output: 'ok' }, sequencePosition: 2, isSelfCorrection: false },
            { recordType: 'agent_reasoning_step', data: { type: 'thinking', content: 'done', text: 'done' }, sequencePosition: 3, isSelfCorrection: false },
          ],
        },
      };
    });

    const out = await executor.execute(makeTask(), runId, 'stdin', tmpDir, 'dev');

    const childTypes = ['agent_reasoning_step', 'tool_call', 'tool_result', 'file_system_write_record'];
    const childRows = db.prepare(`
      SELECT record_type, produced_by_record_id
      FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type IN ('agent_reasoning_step', 'tool_call', 'tool_result', 'file_system_write_record')
    `).all(runId) as Array<{ record_type: string; produced_by_record_id: string | null }>;

    // Every child record exists AND points back to the executor's invocationId.
    expect(childRows.length).toBeGreaterThan(0);
    for (const row of childRows) {
      expect(childTypes).toContain(row.record_type);
      expect(row.produced_by_record_id).toBe(out.invocationId);
    }

    // Sanity: filtering the governed stream by produced_by_record_id =
    // out.invocationId returns the trace reasoning_review needs.
    const filtered = db.prepare(`
      SELECT COUNT(*) AS n FROM governed_stream
      WHERE workflow_run_id = ? AND produced_by_record_id = ?
    `).get(runId, out.invocationId) as { n: number };
    expect(filtered.n).toBe(childRows.length);
  });

  it('populates invocationId on the refactoring-skip early-exit path', async () => {
    // The idempotency-skip return predates the invocationId field. It
    // must still emit a real id so phase9 callers can log it.
    const sha = ExecutorAgent.computeFileHash('some content');
    const refactoringTask = makeTask({
      taskType: 'refactoring',
      expectedPreStateHash: sha, // any string triggers the idempotency check
    });

    // Mock the idempotency check to "skip" (file already in target state).
    (executor as unknown as {
      checkRefactoringIdempotency: () => Promise<string>;
    }).checkRefactoringIdempotency = vi.fn(async () => 'skip');

    const out = await executor.execute(refactoringTask, runId, 'stdin', tmpDir, 'dev');

    expect(out.skippedIdempotent).toBe(true);
    expect(out.invocationId).toBeTruthy();
    expect(typeof out.invocationId).toBe('string');
  });
});
