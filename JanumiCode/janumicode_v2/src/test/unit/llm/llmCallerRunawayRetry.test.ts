/**
 * Regression: in-stream runaway-thinking aborts (log-file size cap
 * exceeded during streaming) must be retried up to `maxRetries` times.
 *
 * Before the fix, the in-stream abort was classified as `context_exceeded`
 * and treated as non-retryable (reasonable for a true HTTP 400 "context
 * too long" — but wrong for the in-stream cap, where a fresh attempt
 * gets a fresh log-file baseline and sampling variance frequently
 * rescues a runaway thinking spiral). Cal-20 showed this failure mode:
 * the first runaway abort marked the node deferred immediately.
 *
 * Tests directly construct LLMError instances of each type — the abort
 * classification machinery requires a real logFile wired in, which
 * isn't available in a pure unit test. The full end-to-end abort path
 * is exercised by calibration runs.
 */

import { describe, it, expect } from 'vitest';
import { LLMCaller, LLMError } from '../../../lib/llm/llmCaller';
import type { LLMCallOptions, LLMCallResult, LLMProviderAdapter } from '../../../lib/llm/llmCaller';

function providerThatFailsThenSucceeds(
  failures: LLMError,
  failCount: number,
): { provider: LLMProviderAdapter; getCount: () => number } {
  let callCount = 0;
  const provider: LLMProviderAdapter = {
    name: 'ollama',
    async call(options: LLMCallOptions): Promise<LLMCallResult> {
      callCount++;
      if (callCount <= failCount) throw failures;
      return {
        text: 'recovered', parsed: null, toolCalls: [],
        provider: options.provider, model: options.model,
        inputTokens: 0, outputTokens: 0,
        usedFallback: false, retryAttempts: 0,
      };
    },
  };
  return { provider, getCount: () => callCount };
}

describe('LLMCaller — runaway-thinking retry semantics', () => {
  it('retries up to maxRetries times on runaway_thinking errors (sampling variance rescue)', async () => {
    const caller = new LLMCaller({ maxRetries: 3 });
    const err = new LLMError(
      'LLM stream aborted: invocation log size exceeded (1572874 > 1572864 bytes this attempt) — likely runaway thinking',
      'runaway_thinking', undefined, true,
    );
    const { provider, getCount } = providerThatFailsThenSucceeds(err, 2);
    caller.registerProvider(provider);

    const result = await caller.call({ provider: 'ollama', model: 'test', prompt: 'test' });
    expect(result.text).toBe('recovered');
    expect(getCount()).toBe(3); // 2 failures + 1 success
    expect(result.retryAttempts).toBe(2);
  });

  it('surfaces LLMError with errorType=runaway_thinking after exhausting maxRetries', async () => {
    const caller = new LLMCaller({ maxRetries: 2 });
    let callCount = 0;
    const provider: LLMProviderAdapter = {
      name: 'ollama',
      async call() {
        callCount++;
        throw new LLMError(
          'LLM stream aborted: invocation log size exceeded', 'runaway_thinking', undefined, true,
        );
      },
    };
    caller.registerProvider(provider);

    await expect(caller.call({ provider: 'ollama', model: 'test', prompt: 'test' })).rejects.toMatchObject({
      name: 'LLMError',
      errorType: 'runaway_thinking',
    });
    expect(callCount).toBe(3); // maxRetries=2 → attempts 0, 1, 2
  });

  it('does NOT retry a true HTTP-400 context_exceeded (model rejected the request)', async () => {
    const caller = new LLMCaller({ maxRetries: 3 });
    let callCount = 0;
    const provider: LLMProviderAdapter = {
      name: 'ollama',
      async call() {
        callCount++;
        throw new LLMError('context length exceeded', 'context_exceeded', 400, false);
      },
    };
    caller.registerProvider(provider);

    await expect(caller.call({ provider: 'ollama', model: 'test', prompt: 'test' })).rejects.toMatchObject({
      errorType: 'context_exceeded',
    });
    expect(callCount).toBe(1); // no retry
  });
});
