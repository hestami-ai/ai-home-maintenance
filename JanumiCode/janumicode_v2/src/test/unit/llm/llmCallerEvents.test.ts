/**
 * Regression test: plain LLMCaller emits llm:started / llm:finished.
 *
 * Root cause of the "ActivityStrip says Idle while Ollama is busy" bug:
 * only PriorityLLMCaller emitted activity events. But the Client Liaison
 * is the only component that uses PriorityLLMCaller. Every phase handler,
 * DMR, Reasoning Review, narrative memory generator, and failure handler
 * uses the plain LLMCaller — which emitted nothing. During the ~95% of a
 * workflow where those components are hitting Ollama, the webview's
 * ActivityStrip had no signal and stayed in its "Idle" default.
 *
 * Fix: LLMCaller.setEventBus(bus) + emit `llm:started` at entry and
 * `llm:finished` in the finally clause, carrying the same label /
 * agentRole / subPhaseId fields the PriorityLLMCaller emits. This test
 * pins both emission points and the payload shape.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import { EventBus } from '../../../lib/events/eventBus';
import type { LLMCallOptions, LLMCallResult, LLMProviderAdapter } from '../../../lib/llm/llmCaller';

function stubProvider(name = 'ollama'): LLMProviderAdapter {
  return {
    name,
    async call(options: LLMCallOptions): Promise<LLMCallResult> {
      return {
        text: 'ok',
        parsed: null,
        toolCalls: [],
        provider: options.provider,
        model: options.model,
        inputTokens: 0,
        outputTokens: 0,
        usedFallback: false,
        retryAttempts: 0,
      };
    },
  };
}

interface CapturedEvent {
  type: string;
  payload: Record<string, unknown>;
}

describe('LLMCaller — activity event emission', () => {
  let caller: LLMCaller;
  let bus: EventBus;
  let events: CapturedEvent[];

  beforeEach(() => {
    caller = new LLMCaller({ maxRetries: 0 });
    caller.registerProvider(stubProvider('ollama'));
    bus = new EventBus();
    caller.setEventBus(bus);
    events = [];
    for (const type of ['llm:started', 'llm:finished'] as const) {
      bus.on(type, (p) => events.push({ type, payload: p as Record<string, unknown> }));
    }
  });

  it('emits llm:started and llm:finished in order for a successful call', async () => {
    await caller.call({
      provider: 'ollama',
      model: 'qwen3.5:9b',
      prompt: 'hello',
      traceContext: {
        workflowRunId: 'run-1',
        phaseId: '1',
        subPhaseId: '1.0',
        agentRole: 'requirements_agent',
        label: 'Phase 1.0 — Intent Quality Check',
      },
    });

    const types = events.map(e => e.type);
    expect(types).toEqual(['llm:started', 'llm:finished']);
  });

  it('carries traceContext label / agentRole / subPhaseId into both events', async () => {
    await caller.call({
      provider: 'ollama',
      model: 'qwen3.5:9b',
      prompt: 'hello',
      traceContext: {
        workflowRunId: 'run-1',
        phaseId: '1',
        subPhaseId: '1.2',
        agentRole: 'requirements_agent',
        label: 'DMR Stage 1 — Query Decomposition',
      },
    });

    const started = events.find(e => e.type === 'llm:started')?.payload;
    const finished = events.find(e => e.type === 'llm:finished')?.payload;

    expect(started?.label).toBe('DMR Stage 1 — Query Decomposition');
    expect(started?.agentRole).toBe('requirements_agent');
    expect(started?.subPhaseId).toBe('1.2');
    expect(started?.provider).toBe('ollama');
    expect(started?.lane).toBe('phase');

    expect(finished?.label).toBe('DMR Stage 1 — Query Decomposition');
    expect(finished?.agentRole).toBe('requirements_agent');
    expect(finished?.subPhaseId).toBe('1.2');
    expect(finished?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('emits null label (not undefined) when traceContext is absent', async () => {
    await caller.call({ provider: 'ollama', model: 'q', prompt: 'p' });

    const started = events.find(e => e.type === 'llm:started')?.payload;
    expect(started).toHaveProperty('label', null);
    expect(started).toHaveProperty('agentRole', null);
    expect(started).toHaveProperty('subPhaseId', null);
  });

  it('still emits llm:finished when the provider call throws', async () => {
    caller.registerProvider({
      name: 'broken',
      async call(): Promise<LLMCallResult> { throw new Error('boom'); },
    });

    await expect(
      caller.call({ provider: 'broken', model: 'x', prompt: 'p' }),
    ).rejects.toThrow(/boom/);

    const types = events.map(e => e.type);
    expect(types).toContain('llm:started');
    expect(types).toContain('llm:finished');
    // finished must come last — the ActivityStrip transitions out of its
    // "running" state only when it sees llm:finished.
    expect(types[types.length - 1]).toBe('llm:finished');
  });
});
