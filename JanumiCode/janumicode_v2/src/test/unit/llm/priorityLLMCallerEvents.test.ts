/**
 * Regression tests for LLM activity-event payload plumbing.
 *
 * The webview's ActivityStrip displays the `traceContext.label` from the
 * active LLM call ("DMR Stage 1 — Query Decomposition" etc.) so the user
 * can see WHAT is being processed, not just that something is. For that
 * to work, the PriorityLLMCaller must forward label/agentRole/subPhaseId
 * from `request.traceContext` into the `llm:queued`/`started`/`finished`
 * event payloads. Without this plumb-through, the strip would show only
 * the provider name.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PriorityLLMCaller } from '../../../lib/llm/priorityLLMCaller';
import { EventBus } from '../../../lib/events/eventBus';
import type { LLMCallOptions, LLMCallResult, LLMProviderAdapter } from '../../../lib/llm/llmCaller';

function stubProvider(name = 'mock'): LLMProviderAdapter {
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

describe('PriorityLLMCaller — LLM event label plumbing', () => {
  let caller: PriorityLLMCaller;
  let bus: EventBus;
  let events: CapturedEvent[];

  beforeEach(() => {
    caller = new PriorityLLMCaller({ maxRetries: 0, maxParallel: 1 });
    caller.registerProvider(stubProvider('mock'));
    bus = new EventBus();
    caller.setEventBus(bus);
    events = [];
    for (const type of ['llm:queued', 'llm:started', 'llm:finished'] as const) {
      bus.on(type, (p) => events.push({ type, payload: p as Record<string, unknown> }));
    }
  });

  it('includes the traceContext label on queued, started, and finished events', async () => {
    await caller.call({
      provider: 'mock',
      model: 'test',
      prompt: 'p',
      traceContext: {
        workflowRunId: 'run-1',
        phaseId: '1',
        subPhaseId: '1.2',
        agentRole: 'requirements_agent',
        label: 'Phase 1.2 — Intent Domain Bloom',
      },
    });

    const q = events.find(e => e.type === 'llm:queued')?.payload;
    const s = events.find(e => e.type === 'llm:started')?.payload;
    const f = events.find(e => e.type === 'llm:finished')?.payload;

    expect(q?.label).toBe('Phase 1.2 — Intent Domain Bloom');
    expect(q?.agentRole).toBe('requirements_agent');
    expect(q?.subPhaseId).toBe('1.2');

    expect(s?.label).toBe('Phase 1.2 — Intent Domain Bloom');
    expect(s?.agentRole).toBe('requirements_agent');

    expect(f?.label).toBe('Phase 1.2 — Intent Domain Bloom');
    expect(f?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('emits null label when traceContext is absent, not undefined', async () => {
    await caller.call({ provider: 'mock', model: 'test', prompt: 'p' });

    const s = events.find(e => e.type === 'llm:started')?.payload;
    expect(s).toBeDefined();
    // The ActivityStrip renders "{label ?? provider}" — a null label is an
    // explicit "no label available" signal; an undefined one would suggest
    // the field was omitted.
    expect(s).toHaveProperty('label', null);
    expect(s).toHaveProperty('agentRole', null);
    expect(s).toHaveProperty('subPhaseId', null);
  });

  it('preserves per-call labels when multiple calls are queued concurrently', async () => {
    // maxParallel is 1 so the second call queues. Both should resolve;
    // each started/finished pair should carry its own label.
    const p1 = caller.call({
      provider: 'mock',
      model: 'test',
      prompt: 'one',
      traceContext: {
        workflowRunId: 'run-1',
        label: 'First call',
      },
    });
    const p2 = caller.call({
      provider: 'mock',
      model: 'test',
      prompt: 'two',
      traceContext: {
        workflowRunId: 'run-1',
        label: 'Second call',
      },
    });
    await Promise.all([p1, p2]);

    const startedLabels = events
      .filter(e => e.type === 'llm:started')
      .map(e => e.payload.label);
    expect(startedLabels).toEqual(['First call', 'Second call']);

    const finishedLabels = events
      .filter(e => e.type === 'llm:finished')
      .map(e => e.payload.label);
    expect(finishedLabels).toEqual(['First call', 'Second call']);
  });
});
