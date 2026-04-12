/**
 * PriorityLLMCaller — concurrency, lane priority, and event emission tests.
 * Uses an auto-resolving fake provider with a small delay so we can observe
 * call ordering deterministically.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PriorityLLMCaller } from '../../../lib/llm/priorityLLMCaller';
import type { LLMCallOptions, LLMCallResult, LLMProviderAdapter } from '../../../lib/llm/llmCaller';
import { EventBus } from '../../../lib/events/eventBus';

class FakeProvider implements LLMProviderAdapter {
  readonly name = 'fake';
  public callOrder: string[] = [];
  public delayMs: number;

  constructor(delayMs = 5) {
    this.delayMs = delayMs;
  }

  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const tag = options.prompt;
    this.callOrder.push(tag);
    await new Promise((r) => setTimeout(r, this.delayMs));
    return {
      text: `result-${tag}`,
      parsed: null,
      toolCalls: [],
      provider: 'fake',
      model: 'm',
      inputTokens: null,
      outputTokens: null,
      usedFallback: false,
      retryAttempts: 0,
    };
  }
}

describe('PriorityLLMCaller', () => {
  let caller: PriorityLLMCaller;
  let provider: FakeProvider;
  let eventBus: EventBus;

  beforeEach(() => {
    caller = new PriorityLLMCaller({ maxRetries: 0, maxParallel: 1 });
    provider = new FakeProvider(5);
    caller.registerProvider(provider);
    eventBus = new EventBus();
    caller.setEventBus(eventBus);
  });

  it('runs phase-lane requests in submission order', async () => {
    const opts = (prompt: string) => ({ provider: 'fake', model: 'm', prompt });
    await Promise.all([
      caller.call(opts('phase-1'), { priority: 'phase' }),
      caller.call(opts('phase-2'), { priority: 'phase' }),
      caller.call(opts('phase-3'), { priority: 'phase' }),
    ]);
    expect(provider.callOrder).toEqual(['phase-1', 'phase-2', 'phase-3']);
  });

  it('user_query lane jumps ahead of pending phase work', async () => {
    const opts = (prompt: string) => ({ provider: 'fake', model: 'm', prompt });

    // Submit phase-1; it goes in flight immediately.
    const p1 = caller.call(opts('phase-1'), { priority: 'phase' });
    // Queue phase-2 and phase-3, then a user query.
    const p2 = caller.call(opts('phase-2'), { priority: 'phase' });
    const p3 = caller.call(opts('phase-3'), { priority: 'phase' });
    const pq = caller.call(opts('user-q'), { priority: 'user_query' });

    await Promise.all([p1, p2, p3, pq]);

    // phase-1 is in-flight first, then user-q jumps the queue, then phase-2, phase-3.
    expect(provider.callOrder).toEqual(['phase-1', 'user-q', 'phase-2', 'phase-3']);
  });

  it('emits llm:queued / llm:started / llm:finished events', async () => {
    const events: string[] = [];
    eventBus.on('llm:queued', (p) => events.push(`queued:${p.lane}`));
    eventBus.on('llm:started', (p) => events.push(`started:${p.lane}`));
    eventBus.on('llm:finished', (p) => events.push(`finished:${p.lane}`));

    await caller.call(
      { provider: 'fake', model: 'm', prompt: 'test' },
      { priority: 'user_query' },
    );

    expect(events).toContain('queued:user_query');
    expect(events).toContain('started:user_query');
    expect(events).toContain('finished:user_query');
  });

  it('respects per-provider in-flight cap of 1', async () => {
    let inFlight = 0;
    let maxConcurrent = 0;

    class CountingProvider implements LLMProviderAdapter {
      readonly name = 'counting';
      async call(): Promise<LLMCallResult> {
        inFlight++;
        if (inFlight > maxConcurrent) maxConcurrent = inFlight;
        await new Promise((r) => setTimeout(r, 10));
        inFlight--;
        return {
          text: 'ok',
          parsed: null,
          toolCalls: [],
          provider: 'counting',
          model: 'm',
          inputTokens: null,
          outputTokens: null,
          usedFallback: false,
          retryAttempts: 0,
        };
      }
    }

    const c2 = new PriorityLLMCaller({ maxRetries: 0, maxParallel: 1 });
    c2.registerProvider(new CountingProvider());
    await Promise.all([
      c2.call({ provider: 'counting', model: 'm', prompt: '1' }),
      c2.call({ provider: 'counting', model: 'm', prompt: '2' }),
      c2.call({ provider: 'counting', model: 'm', prompt: '3' }),
    ]);
    expect(maxConcurrent).toBe(1);
  });
});
