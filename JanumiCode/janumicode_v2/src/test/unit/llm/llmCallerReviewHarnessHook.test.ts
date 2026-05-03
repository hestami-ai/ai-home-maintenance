/**
 * Track D Commit 10 — LLMCaller wires the reasoning-review HARNESS hook.
 *
 * Verifies:
 *   - A successful call() with a populated traceContext (non-harness,
 *     non-json_repair role) triggers setReviewHarnessHook's callback.
 *   - The callback receives the agent_invocation_id, agent_output_id,
 *     traceContext, prompt, and result.
 *   - Calls stamped agentRole='harness', 'json_repair', or
 *     'reasoning_review' do NOT trigger the hook (loop guard).
 */

import { describe, it, expect } from 'vitest';
import { LLMCaller } from '../../../lib/llm/llmCaller';
import type { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
  LLMTraceContext,
} from '../../../lib/llm/llmCaller';

let recCount = 0;
function stubWriter(): GovernedStreamWriter {
  return {
    writeRecord: () => ({ id: `rec-${++recCount}` }) as unknown as ReturnType<
      GovernedStreamWriter['writeRecord']
    >,
    supersedByRollback: () => undefined,
  } as unknown as GovernedStreamWriter;
}

function stubProvider(): LLMProviderAdapter {
  return {
    name: 'llamacpp',
    async call(options: LLMCallOptions): Promise<LLMCallResult> {
      return {
        text: 'ok',
        parsed: null,
        toolCalls: [],
        provider: options.provider,
        model: options.model,
        inputTokens: 1,
        outputTokens: 2,
        usedFallback: false,
        retryAttempts: 0,
      };
    },
  };
}

function trace(role: string | null): LLMTraceContext {
  return {
    workflowRunId: 'wf-1',
    phaseId: '1',
    subPhaseId: 'intent_quality_check',
    agentRole: role as LLMTraceContext['agentRole'],
    label: 'test',
  };
}

describe('LLMCaller.setReviewHarnessHook', () => {
  it('fires the harness hook on a successful non-internal call', async () => {
    const caller = new LLMCaller({ maxRetries: 0 });
    caller.registerProvider(stubProvider());
    caller.setWriter(stubWriter(), 'sha');

    const calls: Array<{
      agentInvocationId: string;
      agentOutputId: string;
      traceContext: LLMTraceContext;
      prompt: string;
      result: LLMCallResult;
    }> = [];
    caller.setReviewHarnessHook(async (params) => {
      calls.push(params);
    });

    await caller.call({
      provider: 'llamacpp',
      model: 'm',
      prompt: 'p',
      traceContext: trace('orchestrator'),
    });

    expect(calls.length).toBe(1);
    expect(calls[0].agentInvocationId).toBeTruthy();
    expect(calls[0].agentOutputId).toBeTruthy();
    expect(calls[0].prompt).toBe('p');
    expect(calls[0].result.text).toBe('ok');
    expect(calls[0].traceContext.agentRole).toBe('orchestrator');
  });

  it('skips the hook when no writer is attached (no invocation id available)', async () => {
    const caller = new LLMCaller({ maxRetries: 0 });
    caller.registerProvider(stubProvider());
    let fired = 0;
    caller.setReviewHarnessHook(async () => {
      fired += 1;
    });
    await caller.call({
      provider: 'llamacpp',
      model: 'm',
      prompt: 'p',
      traceContext: trace('orchestrator'),
    });
    expect(fired).toBe(0);
  });

  it('does NOT fire when agentRole is harness (loop guard)', async () => {
    const caller = new LLMCaller({ maxRetries: 0 });
    caller.registerProvider(stubProvider());
    let fired = 0;
    caller.setReviewHarnessHook(async () => {
      fired += 1;
    });
    await caller.call({
      provider: 'llamacpp',
      model: 'm',
      prompt: 'p',
      traceContext: trace('harness'),
    });
    expect(fired).toBe(0);
  });

  it('does NOT fire when agentRole is json_repair (loop guard)', async () => {
    const caller = new LLMCaller({ maxRetries: 0 });
    caller.registerProvider(stubProvider());
    let fired = 0;
    caller.setReviewHarnessHook(async () => {
      fired += 1;
    });
    await caller.call({
      provider: 'llamacpp',
      model: 'm',
      prompt: 'p',
      traceContext: trace('json_repair'),
    });
    expect(fired).toBe(0);
  });

  it('does NOT fire when agentRole is reasoning_review (loop guard)', async () => {
    const caller = new LLMCaller({ maxRetries: 0 });
    caller.registerProvider(stubProvider());
    let fired = 0;
    caller.setReviewHarnessHook(async () => {
      fired += 1;
    });
    await caller.call({
      provider: 'llamacpp',
      model: 'm',
      prompt: 'p',
      traceContext: trace('reasoning_review'),
    });
    expect(fired).toBe(0);
  });
});
