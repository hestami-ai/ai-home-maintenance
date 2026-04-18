/**
 * Regression tests for CLI-invocation persistence.
 *
 * Pin that when a traceContext is provided, AgentInvoker writes:
 *   1. agent_invocation with command / args / command_line / cwd / prompt
 *   2. agent_output with exit_code / duration / stderr / status
 * and emits `llm:stream_chunk` events per stdout/stderr line (not as
 * governed_stream rows — see the DB-bloat fix).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentInvoker } from '../../../lib/orchestrator/agentInvoker';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import { EventBus } from '../../../lib/events/eventBus';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import type { OutputParser } from '../../../lib/cli/outputParser';

let idCounter = 0;
function testId(): string { return `ai-${++idCounter}`; }

function listRecords(db: Database) {
  const rows = db
    .prepare('SELECT id, record_type, content, derived_from_record_ids FROM governed_stream ORDER BY produced_at ASC')
    .all() as Array<{ id: string; record_type: string; content: string; derived_from_record_ids: string }>;
  return rows.map(r => ({
    id: r.id,
    record_type: r.record_type,
    content: JSON.parse(r.content) as Record<string, unknown>,
    derived_from_record_ids: JSON.parse(r.derived_from_record_ids || '[]') as string[],
  }));
}

function stubParser(): OutputParser {
  return {
    parseLine: () => null,
    reset: () => {},
  };
}

describe('AgentInvoker — CLI invocation persistence', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let invoker: AgentInvoker;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run();
    writer = new GovernedStreamWriter(db, testId);
    const llm = new LLMCaller({ maxRetries: 0 });
    invoker = new AgentInvoker(llm, {
      timeoutSeconds: 1,
      idleTimeoutSeconds: 1,
      bufferMaxEvents: 100,
    });
    invoker.setWriter(writer, 'dev');
    invoker.setEventBus(new EventBus());
    invoker.registerOutputParser('gemini_cli', stubParser());
  });

  afterEach(() => { db.close(); });

  it('persists command/args/command_line/prompt on agent_invocation when traceContext is provided', async () => {
    // Stub the CLI invoker so the test doesn't actually spawn anything.
    // We reach into the private member because constructing a real child
    // process and mocking its stdio is far more painful than this surgical
    // stub.
    const invokerPrivate = invoker as unknown as {
      cliInvoker: {
        invoke: (opts: unknown) => Promise<{
          exitCode: number;
          timedOut: boolean;
          idledOut: boolean;
          events: unknown[];
          stderr: string;
          durationMs: number;
        }>;
      };
    };
    invokerPrivate.cliInvoker.invoke = vi.fn(async (opts: {
      onStdoutChunk?: (t: string) => void;
      onStderrChunk?: (t: string) => void;
    }) => {
      // Drive both streams so the chunk-writer path is exercised.
      opts.onStdoutChunk?.('hello\n');
      opts.onStdoutChunk?.('world\n');
      opts.onStderrChunk?.('warn: something\n');
      return {
        exitCode: 0,
        timedOut: false,
        idledOut: false,
        events: [],
        stderr: 'warn: something\n',
        durationMs: 42,
      };
    });

    await invoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'gemini_cli',
      invocationId: 'inv-1',
      prompt: 'review spec file',
      cwd: '/ws',
      traceContext: {
        workflowRunId: 'run-1',
        phaseId: '9',
        subPhaseId: '9.1',
        agentRole: 'executor_agent',
        label: 'Executor · Gemini CLI',
      },
    });

    const records = listRecords(db);
    const invocation = records.find(r => r.record_type === 'agent_invocation');
    expect(invocation).toBeDefined();
    expect(invocation!.content.command).toBe('gemini');
    expect(Array.isArray(invocation!.content.args)).toBe(true);
    // Gemini CLI is now stdin-only (passing --prompt alongside piped
    // stdin triggered the "both positional AND --prompt" error). The
    // prompt is still persisted on `content.prompt` for audit — we
    // just don't embed it on the command line.
    expect(invocation!.content.args).not.toContain('--prompt');
    expect(invocation!.content.command_line).toContain('gemini');
    expect(invocation!.content.cwd).toBe('/ws');
    expect(invocation!.content.prompt).toBe('review spec file');
    expect(invocation!.content.label).toBe('Executor · Gemini CLI');

    // Chunks are not persisted as governed_stream rows — they flow via
    // the EventBus as transient `llm:stream_chunk` events. The DB should
    // contain exactly the invocation + final output, no chunk rows.
    const chunkRows = records.filter(r => r.record_type === 'agent_output_chunk');
    expect(chunkRows).toHaveLength(0);

    // Final agent_output carries exit_code / duration / stderr.
    const output = records.find(r => r.record_type === 'agent_output');
    expect(output).toBeDefined();
    expect(output!.content.exit_code).toBe(0);
    expect(output!.content.status).toBe('success');
    // AgentInvoker measures wall-clock duration itself, not the CLI result's
    // durationMs, so assert the type rather than the exact value.
    expect(typeof output!.content.duration_ms).toBe('number');
    expect(output!.content.stderr).toBe('warn: something\n');
    expect(output!.derived_from_record_ids).toContain(invocation!.id);
  });

  it('writes status=error and an error_message when the CLI exits non-zero', async () => {
    const invokerPrivate = invoker as unknown as {
      cliInvoker: { invoke: (opts: unknown) => Promise<unknown> };
    };
    invokerPrivate.cliInvoker.invoke = vi.fn(async () => ({
      exitCode: 2,
      timedOut: false,
      idledOut: false,
      events: [],
      stderr: 'bad flag',
      durationMs: 10,
    }));

    await invoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'gemini_cli',
      invocationId: 'inv-2',
      prompt: 'p',
      cwd: '/ws',
      traceContext: {
        workflowRunId: 'run-1',
        phaseId: '9',
        subPhaseId: '9.1',
        agentRole: 'executor_agent',
      },
    });

    const output = listRecords(db).find(r => r.record_type === 'agent_output');
    expect(output).toBeDefined();
    expect(output!.content.status).toBe('error');
    expect(output!.content.exit_code).toBe(2);
    expect(output!.content.error_message).toContain('exited with code 2');
  });

  it('skips instrumentation when no traceContext is supplied', async () => {
    const invokerPrivate = invoker as unknown as {
      cliInvoker: { invoke: (opts: unknown) => Promise<unknown> };
    };
    invokerPrivate.cliInvoker.invoke = vi.fn(async () => ({
      exitCode: 0, timedOut: false, idledOut: false, events: [], stderr: '', durationMs: 1,
    }));

    await invoker.invoke({
      agentRole: 'executor_agent',
      backingTool: 'gemini_cli',
      invocationId: 'inv-3',
      prompt: 'p',
      cwd: '/ws',
      // no traceContext
    });

    const records = listRecords(db);
    expect(records.filter(r => r.record_type === 'agent_invocation')).toHaveLength(0);
    expect(records.filter(r => r.record_type === 'agent_output')).toHaveLength(0);
    expect(records.filter(r => r.record_type === 'agent_output_chunk')).toHaveLength(0);
  });
});
