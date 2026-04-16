/**
 * Regression tests for end-to-end invocation persistence.
 *
 * Before this change, agent_invocation records only held provider/model/
 * label/status — the actual prompt never made it into the governed stream.
 * Users had no way to see what was sent to the LLM, which broke the
 * "persist everything" contract and made debugging an agent run pointless.
 *
 * These tests pin:
 *   1. Prompt + system + temperature + tools are persisted on agent_invocation.
 *   2. Streaming chunks are emitted as `llm:stream_chunk` events and are
 *      NOT persisted as governed_stream rows (per-token persistence pushed
 *      a real workspace past 20K rows / RPC buffer overflow).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
  LLMStreamingCallOptions,
} from '../../../lib/llm/llmCaller';
import { EventBus } from '../../../lib/events/eventBus';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { createTestDatabase, type Database } from '../../../lib/database/init';

let idCounter = 0;
function testId(): string { return `llm-${++idCounter}`; }

function listRecords(db: Database): Array<{ record_type: string; content: Record<string, unknown>; derived_from_record_ids: string[]; id: string }> {
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

describe('LLMCaller — invocation persistence', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let caller: LLMCaller;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run();
    writer = new GovernedStreamWriter(db, testId);
    caller = new LLMCaller({ maxRetries: 0 });
    caller.setWriter(writer, 'dev');
  });

  afterEach(() => { db.close(); });

  const trace = {
    workflowRunId: 'run-1',
    phaseId: '1',
    subPhaseId: '1.0',
    agentRole: 'requirements_agent' as const,
    label: 'Phase 1.0 — Intent Quality Check',
  };

  function stubProvider(): LLMProviderAdapter {
    return {
      name: 'ollama',
      async call(options: LLMCallOptions): Promise<LLMCallResult> {
        return {
          text: 'ok', parsed: null, toolCalls: [], provider: options.provider,
          model: options.model, inputTokens: 10, outputTokens: 20,
          usedFallback: false, retryAttempts: 0,
        };
      },
    };
  }

  function streamingProvider(chunks: string[]): LLMProviderAdapter {
    return {
      name: 'ollama',
      async call(options: LLMCallOptions): Promise<LLMCallResult> {
        const opts = options as LLMStreamingCallOptions;
        for (const c of chunks) {
          opts.onChunk?.({ text: c, channel: 'response' });
        }
        return {
          text: chunks.join(''), parsed: null, toolCalls: [], provider: 'ollama',
          model: options.model, inputTokens: null, outputTokens: null,
          usedFallback: false, retryAttempts: 0,
        };
      },
    };
  }

  it('persists prompt, system, temperature, and tools on agent_invocation', async () => {
    caller.registerProvider(stubProvider());
    await caller.call({
      provider: 'ollama',
      model: 'qwen3.5:9b',
      prompt: 'Classify this intent: "build a todo app"',
      system: 'You are a requirements analyst.',
      temperature: 0.2,
      tools: [{ name: 'flag_flaw', description: 'flag', input_schema: {} }],
      traceContext: trace,
    });

    const records = listRecords(db);
    const invocation = records.find(r => r.record_type === 'agent_invocation');
    expect(invocation).toBeDefined();
    expect(invocation!.content.prompt).toBe('Classify this intent: "build a todo app"');
    expect(invocation!.content.system).toBe('You are a requirements analyst.');
    expect(invocation!.content.temperature).toBe(0.2);
    expect(Array.isArray(invocation!.content.tools)).toBe(true);
    expect(((invocation!.content.tools as unknown[])[0] as { name?: string }).name).toBe('flag_flaw');
  });

  it('writes system as null when absent, not undefined', async () => {
    caller.registerProvider(stubProvider());
    await caller.call({
      provider: 'ollama',
      model: 'x',
      prompt: 'p',
      traceContext: trace,
    });
    const invocation = listRecords(db).find(r => r.record_type === 'agent_invocation')!;
    // JSON.stringify drops undefined; persisting null makes it explicit that
    // the call had no system prompt, so the card renders accordingly.
    expect(invocation.content.system).toBeNull();
  });

  it('emits llm:stream_chunk events per streamed chunk anchored to the invocation', async () => {
    const bus = new EventBus();
    const events: Array<{ invocationId: string; sequence: number; channel: string; text: string }> = [];
    bus.on('llm:stream_chunk', (p) => events.push(p));
    caller.setEventBus(bus);
    caller.registerProvider(streamingProvider(['Hello', ', ', 'world']));
    await caller.call({
      provider: 'ollama',
      model: 'x',
      prompt: 'greet',
      traceContext: trace,
    });

    expect(events).toHaveLength(3);
    expect(events.map(e => e.text)).toEqual(['Hello', ', ', 'world']);
    expect(events.map(e => e.sequence)).toEqual([0, 1, 2]);
    expect(events.every(e => e.channel === 'response')).toBe(true);

    // Each event's invocationId points at the agent_invocation record so
    // the webview's transient streaming store can key its buffer correctly.
    const invocation = listRecords(db).find(r => r.record_type === 'agent_invocation')!;
    for (const event of events) {
      expect(event.invocationId).toBe(invocation.id);
    }
  });

  it('does not persist chunks as governed_stream rows', async () => {
    // The chunk channel is transient by design — the final agent_output
    // record carries the full text + thinking, so persisting per-token
    // rows just bloats the DB.
    caller.setEventBus(new EventBus());
    caller.registerProvider(streamingProvider(['a', 'b', 'c']));
    await caller.call({
      provider: 'ollama',
      model: 'x',
      prompt: 'p',
      traceContext: trace,
    });
    const chunks = listRecords(db).filter(r => r.record_type === 'agent_output_chunk');
    expect(chunks).toHaveLength(0);
  });
});
