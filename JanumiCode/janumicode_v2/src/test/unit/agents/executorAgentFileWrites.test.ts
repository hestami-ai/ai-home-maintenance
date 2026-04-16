/**
 * Regression tests for ExecutorAgent's dual-path file-write detection.
 *
 * Background: the governed stream's file_system_writes table and
 * `file_system_write_record` stream record were dead for a long time —
 * the writer method existed but nothing called it. ExecutorAgent.execute()
 * hard-coded `filesWritten: []` and never populated the audit trail, so
 * the executor reported "success" without proof of what it changed.
 *
 * The fix runs TWO detectors for every execution:
 *   1. Snapshot-diff — hash every file under writeDirectoryPaths before
 *      and after the CLI invocation, diff to produce ground-truth
 *      creates/modifies/deletes.
 *   2. Tool-event-parse — walk the CLI's tool_call stream for Write/Edit/
 *      MultiEdit/Delete operations and extract their target paths.
 *
 * These tests pin that both detectors run, that corroborated writes land
 * as `detection_source: 'both'`, and that disagreements surface as
 * `drift_detected: true` so audits can measure how often an agent
 * announces writes that don't actually land (or lands writes it never
 * announced).
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
function testId(): string { return `ea-${++idCounter}`; }

describe('ExecutorAgent — dual-detection file writes', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let eventBus: EventBus;
  let agentInvoker: AgentInvoker;
  let executor: ExecutorAgent;
  let tmpDir: string;
  let runId: string;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    runId = 'run-ea-1';
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES (?, 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run(runId);

    writer = new GovernedStreamWriter(db, testId);
    eventBus = new EventBus();
    const llm = new LLMCaller({ maxRetries: 0 });
    agentInvoker = new AgentInvoker(llm, {
      timeoutSeconds: 1,
      idleTimeoutSeconds: 1,
      bufferMaxEvents: 100,
    });
    executor = new ExecutorAgent(db, agentInvoker, writer, eventBus, testId);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-executor-'));
  });

  afterEach(() => {
    db.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // Fake invocation with pre/post side effects on disk and a scripted
  // tool_call event stream. Saves each test from having to stub the CLI
  // subprocess machinery directly.
  function stubInvocation(args: {
    writeFilesDuringInvoke?: Array<{ path: string; content: string }>;
    deleteFilesDuringInvoke?: string[];
    toolCallEvents?: Array<{ name: string; filePath: string }>;
    preSeedFiles?: Array<{ path: string; content: string }>;
  }): void {
    // Seed any files that should exist before the invocation runs.
    for (const f of args.preSeedFiles ?? []) {
      const abs = path.resolve(tmpDir, f.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, f.content);
    }

    (agentInvoker as unknown as {
      invoke: (opts: unknown) => Promise<unknown>;
    }).invoke = vi.fn(async () => {
      for (const f of args.writeFilesDuringInvoke ?? []) {
        const abs = path.resolve(tmpDir, f.path);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, f.content);
      }
      for (const rel of args.deleteFilesDuringInvoke ?? []) {
        const abs = path.resolve(tmpDir, rel);
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      }
      return {
        success: true,
        cliResult: {
          exitCode: 0,
          timedOut: false,
          idledOut: false,
          events: (args.toolCallEvents ?? []).map((e, i) => ({
            recordType: 'tool_call',
            data: { name: e.name, input: { file_path: e.filePath } },
            sequencePosition: i,
            isSelfCorrection: false,
          })),
          stderr: '',
          durationMs: 10,
        },
      };
    });
  }

  function makeTask(overrides: Partial<ExecutionTask> = {}): ExecutionTask {
    return {
      id: 'task-1',
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

  function listFileWriteRows(): Array<{
    file_path: string;
    operation: string;
    file_sha256_before: string | null;
    file_sha256_after: string | null;
  }> {
    return db.prepare(`
      SELECT file_path, operation, file_sha256_before, file_sha256_after
      FROM file_system_writes
      WHERE workflow_run_id = ?
      ORDER BY file_path
    `).all(runId) as Array<{
      file_path: string;
      operation: string;
      file_sha256_before: string | null;
      file_sha256_after: string | null;
    }>;
  }

  function listWriteRecords(): Array<Record<string, unknown>> {
    return writer.getRecordsByType(runId, 'file_system_write_record')
      .map(r => r.content as Record<string, unknown>);
  }

  it('detects a create via snapshot-diff even when the tool stream is empty', async () => {
    // Silent agent: writes a file but emits no tool_call events. Only the
    // snapshot diff can tell the truth — this is the case where
    // tool-event-only detection would have produced a silent zero.
    stubInvocation({
      writeFilesDuringInvoke: [{ path: 'out.txt', content: 'hello' }],
      toolCallEvents: [],
    });

    const out = await executor.execute(makeTask(), runId, 'stdin', tmpDir, 'dev');
    expect(out.success).toBe(true);
    expect(out.filesWritten).toHaveLength(1);
    expect(out.filesWritten[0].operation).toBe('create');
    expect(out.filesWritten[0].detectionSource).toBe('snapshot_diff');
    expect(out.filesWritten[0].driftDetected).toBe(false);

    const rows = listFileWriteRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].operation).toBe('create');
    expect(rows[0].file_sha256_before).toBeNull();
    expect(rows[0].file_sha256_after).not.toBeNull();

    const records = listWriteRecords();
    expect(records).toHaveLength(1);
    expect(records[0].detection_source).toBe('snapshot_diff');
    expect(records[0].drift_detected).toBe(false);
  });

  it('corroborates a modify via BOTH detectors when the agent announces the write', async () => {
    // Agent both writes the file AND emits a Write tool_call pointing at
    // it. Both detectors see it → detection_source='both', drift=false.
    stubInvocation({
      preSeedFiles: [{ path: 'config.json', content: '{"v":1}' }],
      writeFilesDuringInvoke: [{ path: 'config.json', content: '{"v":2}' }],
      toolCallEvents: [{ name: 'Write', filePath: path.resolve(tmpDir, 'config.json') }],
    });

    const out = await executor.execute(makeTask(), runId, 'stdin', tmpDir, 'dev');
    expect(out.filesWritten).toHaveLength(1);
    expect(out.filesWritten[0].operation).toBe('modify');
    expect(out.filesWritten[0].detectionSource).toBe('both');
    expect(out.filesWritten[0].driftDetected).toBe(false);
    expect(out.filesWritten[0].toolName).toBe('Write');
    expect(out.filesWritten[0].sha256Before).not.toBeNull();
    expect(out.filesWritten[0].sha256After).not.toBeNull();
    expect(out.filesWritten[0].sha256Before).not.toBe(out.filesWritten[0].sha256After);
  });

  it('flags drift when the agent announces a write that did not land on disk', async () => {
    // Agent claims it wrote the file (tool_call present), but the file
    // doesn't actually change. This is exactly the kind of "announced
    // without landing" regression dual detection is meant to surface.
    stubInvocation({
      writeFilesDuringInvoke: [], // no actual write
      toolCallEvents: [{ name: 'Edit', filePath: path.resolve(tmpDir, 'vaporware.txt') }],
    });

    const out = await executor.execute(makeTask(), runId, 'stdin', tmpDir, 'dev');
    expect(out.filesWritten).toHaveLength(1);
    expect(out.filesWritten[0].detectionSource).toBe('tool_event');
    expect(out.filesWritten[0].driftDetected).toBe(true);
    expect(out.filesWritten[0].toolName).toBe('Edit');

    const records = listWriteRecords();
    expect(records[0].drift_detected).toBe(true);
    expect(records[0].tool_name).toBe('Edit');
  });

  it('detects a delete and records sha256Before only', async () => {
    stubInvocation({
      preSeedFiles: [{ path: 'stale.txt', content: 'bye' }],
      deleteFilesDuringInvoke: ['stale.txt'],
      toolCallEvents: [],
    });

    const out = await executor.execute(makeTask(), runId, 'stdin', tmpDir, 'dev');
    expect(out.filesWritten).toHaveLength(1);
    expect(out.filesWritten[0].operation).toBe('delete');
    expect(out.filesWritten[0].sha256Before).not.toBeNull();
    expect(out.filesWritten[0].sha256After).toBeNull();
    expect(out.filesWritten[0].detectionSource).toBe('snapshot_diff');
  });

  it('handles multiple concurrent writes and keeps detection sources per-path', async () => {
    stubInvocation({
      preSeedFiles: [
        { path: 'a.txt', content: 'a1' },
        { path: 'b.txt', content: 'b1' },
      ],
      writeFilesDuringInvoke: [
        { path: 'a.txt', content: 'a2' },       // modify, silent
        { path: 'c.txt', content: 'c1' },       // create, announced
      ],
      deleteFilesDuringInvoke: ['b.txt'],        // delete, silent
      toolCallEvents: [
        { name: 'Write', filePath: path.resolve(tmpDir, 'c.txt') },
        { name: 'Write', filePath: path.resolve(tmpDir, 'ghost.txt') }, // drift
      ],
    });

    const out = await executor.execute(makeTask(), runId, 'stdin', tmpDir, 'dev');
    const byOp = new Map(out.filesWritten.map(w => [path.basename(w.filePath), w]));

    expect(byOp.get('a.txt')?.operation).toBe('modify');
    expect(byOp.get('a.txt')?.detectionSource).toBe('snapshot_diff');
    expect(byOp.get('a.txt')?.driftDetected).toBe(false);

    expect(byOp.get('b.txt')?.operation).toBe('delete');
    expect(byOp.get('b.txt')?.detectionSource).toBe('snapshot_diff');

    expect(byOp.get('c.txt')?.operation).toBe('create');
    expect(byOp.get('c.txt')?.detectionSource).toBe('both');

    expect(byOp.get('ghost.txt')?.detectionSource).toBe('tool_event');
    expect(byOp.get('ghost.txt')?.driftDetected).toBe(true);

    const rows = listFileWriteRows();
    expect(rows).toHaveLength(4);
  });

  it('links every file_system_write row to the agent_invocation via agent_invocation_id', async () => {
    // Audit invariant: the file-write rows must be attributable to the
    // specific agent invocation that produced them.
    stubInvocation({
      writeFilesDuringInvoke: [{ path: 'out.txt', content: 'x' }],
    });

    await executor.execute(makeTask(), runId, 'stdin', tmpDir, 'dev');

    const row = db.prepare(`
      SELECT agent_invocation_id FROM file_system_writes WHERE workflow_run_id = ?
    `).get(runId) as { agent_invocation_id: string };
    expect(row.agent_invocation_id).toBeTruthy();

    // And the linked id matches the agent_invocation record the
    // executor wrote at the start of execute().
    const invocation = writer.getRecordsByType(runId, 'agent_invocation')[0];
    expect(invocation).toBeDefined();
    const invocationId = (invocation.content as { invocation_id: string }).invocation_id;
    expect(row.agent_invocation_id).toBe(invocationId);
  });
});
