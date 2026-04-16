/**
 * Regression tests for ExecutorAgent's backing-tool routing.
 *
 * Background: Phase 9 task fixtures carry a `backing_tool` field like
 * "DBOS Middleware / PostgreSQL RLS Policies" — the infrastructure the
 * generated code will touch. The previous implementation forwarded
 * that string to AgentInvoker as the invocation target, producing
 * cascading "No output parser registered for backing tool: …" errors
 * for every task in a run. The actual invocation target is the coding
 * agent itself (Claude Code, or a direct LLM API), which is the same
 * for every task.
 *
 * These tests pin:
 *   1. ExecutorAgent invokes with its own configured backing tool
 *      (default `claude_code_cli`), NOT the task's `backingTool` field.
 *   2. A custom `executorBackingTool` option flows through to the
 *      invoker, so tests can steer away from a real CLI binary.
 *   3. The task's `backing_tool` descriptive value is still recorded
 *      on the `agent_invocation` row for audit — we didn't drop the
 *      metadata, we just stopped mis-routing it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { EventBus } from '../../../lib/events/eventBus';
import { AgentInvoker } from '../../../lib/orchestrator/agentInvoker';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import { ExecutorAgent, type ExecutionTask } from '../../../lib/agents/executorAgent';

let idCounter = 0;
function testId(): string { return `ebt-${++idCounter}`; }

const TASK: ExecutionTask = {
  id: 'TASK-SEC-001',
  taskType: 'standard',
  componentId: 'cmp-security',
  componentResponsibility: 'RSP-014: Enforce RLS.',
  description: 'Implement RLS policies.',
  backingTool: 'DBOS Middleware / PostgreSQL RLS Policies',
  completionCriteria: [{ criterionId: 'cc-1', description: 'RLS applied.' }],
  writeDirectoryPaths: [],
};

describe('ExecutorAgent — backing tool routing', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let eventBus: EventBus;
  let agentInvoker: AgentInvoker;
  let invokeSpy: ReturnType<typeof vi.fn>;
  const runId = 'run-ebt-1';

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
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

    // Stub invoke so the test can assert what the executor passes
    // without spawning real child processes.
    invokeSpy = vi.fn().mockResolvedValue({
      success: true,
      cliResult: { events: [], stdout: '', stderr: '', exitCode: 0 },
    });
    (agentInvoker as unknown as { invoke: unknown }).invoke = invokeSpy;
  });

  afterEach(() => { db.close(); });

  it('routes through the default executor backing tool, not the task infrastructure', async () => {
    const executor = new ExecutorAgent(db, agentInvoker, writer, eventBus, testId);
    await executor.execute(TASK, runId, 'prompt content', '/tmp', 'dev');

    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const invokeArgs = invokeSpy.mock.calls[0][0] as { backingTool: string; agentRole: string };
    // The routing target is the executor's own identity, NOT the infra
    // description carried by the task.
    expect(invokeArgs.backingTool).toBe('claude_code_cli');
    expect(invokeArgs.backingTool).not.toBe(TASK.backingTool);
    expect(invokeArgs.agentRole).toBe('executor_agent');
  });

  it('honors a custom executorBackingTool option', async () => {
    const executor = new ExecutorAgent(db, agentInvoker, writer, eventBus, testId, {
      executorBackingTool: 'direct_llm_api',
    });
    await executor.execute(TASK, runId, 'prompt content', '/tmp', 'dev');

    const invokeArgs = invokeSpy.mock.calls[0][0] as { backingTool: string };
    expect(invokeArgs.backingTool).toBe('direct_llm_api');
  });

  it('still records the task infrastructure on the agent_invocation audit row', async () => {
    const executor = new ExecutorAgent(db, agentInvoker, writer, eventBus, testId);
    await executor.execute(TASK, runId, 'prompt content', '/tmp', 'dev');

    const row = db.prepare(
      `SELECT content FROM governed_stream
       WHERE workflow_run_id = ? AND record_type = 'agent_invocation'
       ORDER BY produced_at DESC LIMIT 1`,
    ).get(runId) as { content: string };
    const content = JSON.parse(row.content) as { backing_tool: string; task_id: string };
    // The task's infra description is still preserved for audit.
    expect(content.backing_tool).toBe('DBOS Middleware / PostgreSQL RLS Policies');
    expect(content.task_id).toBe('TASK-SEC-001');
  });
});
