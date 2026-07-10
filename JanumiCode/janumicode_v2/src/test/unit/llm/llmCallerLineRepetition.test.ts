/**
 * Regression: in-stream line-repetition detector.
 *
 * Cal-27 NFR saturation pathology: qwen3.5:9b stuck in a low-entropy
 * attractor and emitted "* `1`: Count/status check." 1000+ times. The
 * 5-min wall-clock fired per attempt, but 3 retries × 5 min = 15 min,
 * exactly the orchestrator's records-idle stall window, so the session
 * aborted instead of just deferring the node.
 *
 * The detector counts identical non-trivial lines as they stream in
 * and aborts the call once any line crosses N=30 occurrences. Reset
 * per attempt so sampling variance gets a clean slate on retry.
 */

import { describe, it, expect } from 'vitest';
import {
  LLMCaller,
  LLMError,
  detectConsecutiveLineRepeat,
} from '../../../lib/llm/llmCaller';
import type {
  LLMCallResult,
  LLMProviderAdapter,
  LLMStreamingCallOptions,
  LineRepeatState,
} from '../../../lib/llm/llmCaller';

function loopingProvider(
  line: string,
  iterations: number,
): { provider: LLMProviderAdapter; chunkCount: () => number } {
  let chunksEmitted = 0;
  const provider: LLMProviderAdapter = {
    name: 'llamacpp',
    async call(options): Promise<LLMCallResult> {
      const onChunk = (options as LLMStreamingCallOptions).onChunk;
      const abortSignal = (options as LLMStreamingCallOptions).abortSignal;
      for (let i = 0; i < iterations; i++) {
        if (abortSignal?.aborted) break;
        chunksEmitted++;
        onChunk?.({ text: line + '\n', channel: 'response' });
      }
      // If the abort signal fired, throw — mirrors what real adapters
      // do when their fetch is aborted mid-stream.
      if (abortSignal?.aborted) {
        throw new LLMError(
          'aborted by caller', 'unknown', undefined, true,
        );
      }
      return {
        text: '', parsed: null, toolCalls: [],
        provider: options.provider, model: options.model,
        inputTokens: 0, outputTokens: 0,
        usedFallback: false, retryAttempts: 0,
      };
    },
  };
  return { provider, chunkCount: () => chunksEmitted };
}

describe('LLMCaller — line-repetition detector', () => {
  it('does NOT trip on a JSON field repeated many times when interspersed with other fields (regression: thin-slice-1 false-positive)', async () => {
    // Thin-slice-1 false positive: `"actor": "System",` appeared 100+
    // times across a list of valid workflow definitions but interleaved
    // with `"action"`, `"step_number"`, `"expected_outcome"`. The
    // initial total-count detector flagged this as a degenerate loop;
    // the consecutive-count variant correctly leaves it alone because
    // `"actor"` never appears 30× back-to-back.
    const caller = new LLMCaller({ maxRetries: 0 });
    const provider: LLMProviderAdapter = {
      name: 'llamacpp',
      async call(options): Promise<LLMCallResult> {
        const onChunk = (options as LLMStreamingCallOptions).onChunk;
        // Emit 50 workflow blocks, each contributing 4 lines including
        // the same `"actor": "System",` line. Total `"actor"` count = 50.
        for (let i = 0; i < 50; i++) {
          onChunk?.({ text: '"step_number": 1,\n', channel: 'response' });
          onChunk?.({ text: '"actor": "System",\n', channel: 'response' });
          onChunk?.({ text: `"action": "Step ${i} action description",\n`, channel: 'response' });
          onChunk?.({ text: '"expected_outcome": "Some outcome here",\n', channel: 'response' });
        }
        return {
          text: 'ok', parsed: null, toolCalls: [],
          provider: options.provider, model: options.model,
          inputTokens: 0, outputTokens: 0,
          usedFallback: false, retryAttempts: 0,
        };
      },
    };
    caller.registerProvider(provider);

    const result = await caller.call({ provider: 'llamacpp', model: 'test', prompt: 'p' });
    expect(result.text).toBe('ok');
  });

  it('aborts with runaway_thinking after a single line repeats 30+ times consecutively', async () => {
    const caller = new LLMCaller({ maxRetries: 0 });
    const { provider, chunkCount } = loopingProvider(
      '*   `1`: Count/status check.', 200);
    caller.registerProvider(provider);

    await expect(
      caller.call({ provider: 'llamacpp', model: 'test', prompt: 'p' }),
    ).rejects.toMatchObject({ name: 'LLMError', errorType: 'runaway_thinking' });

    // The detector should have aborted well before all 200 chunks emitted.
    // Tolerate a small overshoot — the abort signal is checked on the
    // next loop iteration in the fake adapter.
    expect(chunkCount()).toBeLessThan(40);
  });

  it('does NOT trip on legitimately distinct lines', async () => {
    const caller = new LLMCaller({ maxRetries: 0 });
    const provider: LLMProviderAdapter = {
      name: 'llamacpp',
      async call(options): Promise<LLMCallResult> {
        const onChunk = (options as LLMStreamingCallOptions).onChunk;
        for (let i = 0; i < 100; i++) {
          onChunk?.({ text: `Line number ${i}: distinct content.\n`, channel: 'response' });
        }
        return {
          text: 'ok', parsed: null, toolCalls: [],
          provider: options.provider, model: options.model,
          inputTokens: 0, outputTokens: 0,
          usedFallback: false, retryAttempts: 0,
        };
      },
    };
    caller.registerProvider(provider);

    const result = await caller.call({ provider: 'llamacpp', model: 'test', prompt: 'p' });
    expect(result.text).toBe('ok');
  });

  it('does NOT trip on short repeated lines (under 8 chars)', async () => {
    // Common in JSON output: "  ]," and "  }," etc. Threshold ignores
    // < 8-char trimmed lines so structural punctuation does not flag.
    const caller = new LLMCaller({ maxRetries: 0 });
    const provider: LLMProviderAdapter = {
      name: 'llamacpp',
      async call(options): Promise<LLMCallResult> {
        const onChunk = (options as LLMStreamingCallOptions).onChunk;
        for (let i = 0; i < 100; i++) {
          onChunk?.({ text: '  },\n', channel: 'response' });
        }
        return {
          text: 'ok', parsed: null, toolCalls: [],
          provider: options.provider, model: options.model,
          inputTokens: 0, outputTokens: 0,
          usedFallback: false, retryAttempts: 0,
        };
      },
    };
    caller.registerProvider(provider);

    const result = await caller.call({ provider: 'llamacpp', model: 'test', prompt: 'p' });
    expect(result.text).toBe('ok');
  });

  it('retries a degenerate-loop abort (same retry semantics as runaway_thinking)', async () => {
    let callCount = 0;
    const provider: LLMProviderAdapter = {
      name: 'llamacpp',
      async call(options): Promise<LLMCallResult> {
        callCount++;
        const onChunk = (options as LLMStreamingCallOptions).onChunk;
        const abortSignal = (options as LLMStreamingCallOptions).abortSignal;
        // First two attempts loop; third recovers.
        if (callCount <= 2) {
          for (let i = 0; i < 100; i++) {
            if (abortSignal?.aborted) {
              throw new LLMError('aborted', 'unknown', undefined, true);
            }
            onChunk?.({ text: '*   `1`: Count/status check.\n', channel: 'response' });
          }
          throw new LLMError('aborted', 'unknown', undefined, true);
        }
        return {
          text: 'recovered', parsed: null, toolCalls: [],
          provider: options.provider, model: options.model,
          inputTokens: 0, outputTokens: 0,
          usedFallback: false, retryAttempts: 0,
        };
      },
    };
    const caller = new LLMCaller({ maxRetries: 3 });
    caller.registerProvider(provider);

    const result = await caller.call({ provider: 'llamacpp', model: 'test', prompt: 'p' });
    expect(result.text).toBe('recovered');
    expect(callCount).toBe(3);
  });

  it('aborts with runaway_thinking when no chunk arrives for the no-progress window', async () => {
    // Wedged-socket pathology: provider connects but never emits a
    // chunk. The no-progress timer (env var, 1s for the test) trips
    // and the call retries.
    const prev = process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS;
    process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS = '1';
    try {
      const caller = new LLMCaller({ maxRetries: 0 });
      const provider: LLMProviderAdapter = {
        name: 'llamacpp',
        async call(options): Promise<LLMCallResult> {
          const abortSignal = (options as LLMStreamingCallOptions).abortSignal;
          // Wait for abort — never emit anything.
          await new Promise<void>((resolve) => {
            if (abortSignal?.aborted) { resolve(); return; }
            abortSignal?.addEventListener('abort', () => resolve(), { once: true });
            // Safety: also resolve after 5s in case the test infra fails to abort.
            setTimeout(() => resolve(), 5000);
          });
          throw new LLMError('aborted', 'unknown', undefined, true);
        },
      };
      caller.registerProvider(provider);

      const startedAt = Date.now();
      await expect(
        caller.call({ provider: 'llamacpp', model: 'test', prompt: 'p' }),
      ).rejects.toMatchObject({ name: 'LLMError', errorType: 'runaway_thinking' });
      // Timer fires at 1s; the surrounding async setup (instrumentation,
      // provider Promise resolution) adds a few seconds in the test
      // environment. Anything well under the 5s safety net proves the
      // no-progress timer fired correctly.
      expect(Date.now() - startedAt).toBeLessThan(4500);
    } finally {
      if (prev === undefined) delete process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS;
      else process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS = prev;
    }
  });

  it('does NOT trip no-progress timer while chunks are still arriving', async () => {
    // Slow-but-streaming legitimate generation: a chunk every 200ms
    // for 2s total. With no-progress=1s, this should succeed because
    // the timer keeps getting re-armed.
    const prev = process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS;
    process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS = '1';
    try {
      const caller = new LLMCaller({ maxRetries: 0 });
      const provider: LLMProviderAdapter = {
        name: 'llamacpp',
        async call(options): Promise<LLMCallResult> {
          const onChunk = (options as LLMStreamingCallOptions).onChunk;
          for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 200));
            onChunk?.({ text: `chunk ${i}\n`, channel: 'response' });
          }
          return {
            text: 'streamed', parsed: null, toolCalls: [],
            provider: options.provider, model: options.model,
            inputTokens: 0, outputTokens: 0,
            usedFallback: false, retryAttempts: 0,
          };
        },
      };
      caller.registerProvider(provider);

      const result = await caller.call({ provider: 'llamacpp', model: 'test', prompt: 'p' });
      expect(result.text).toBe('streamed');
    } finally {
      if (prev === undefined) delete process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS;
      else process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS = prev;
    }
  });

  it('respects JANUMICODE_LLM_MAX_REPEATED_LINE=0 (disabled)', async () => {
    const prev = process.env.JANUMICODE_LLM_MAX_REPEATED_LINE;
    process.env.JANUMICODE_LLM_MAX_REPEATED_LINE = '0';
    try {
      const caller = new LLMCaller({ maxRetries: 0 });
      const provider: LLMProviderAdapter = {
        name: 'llamacpp',
        async call(options): Promise<LLMCallResult> {
          const onChunk = (options as LLMStreamingCallOptions).onChunk;
          for (let i = 0; i < 100; i++) {
            onChunk?.({ text: '*   `1`: Count/status check.\n', channel: 'response' });
          }
          return {
            text: 'completed', parsed: null, toolCalls: [],
            provider: options.provider, model: options.model,
            inputTokens: 0, outputTokens: 0,
            usedFallback: false, retryAttempts: 0,
          };
        },
      };
      caller.registerProvider(provider);

      const result = await caller.call({ provider: 'llamacpp', model: 'test', prompt: 'p' });
      expect(result.text).toBe('completed');
    } finally {
      if (prev === undefined) delete process.env.JANUMICODE_LLM_MAX_REPEATED_LINE;
      else process.env.JANUMICODE_LLM_MAX_REPEATED_LINE = prev;
    }
  });
});

/**
 * Characterization tests for `detectConsecutiveLineRepeat`, the pure helper
 * extracted from call()'s onChunk callback (S3776 decomposition). These pin
 * the exact behaviour the inline loop had so the refactor stays
 * behaviour-preserving: 8-char floor, consecutive-only counting, partial-line
 * buffering across chunks, preview truncation, and the early-exit buffer state
 * the original `break` left behind.
 */
describe('detectConsecutiveLineRepeat (extracted pure helper)', () => {
  const fresh = (): LineRepeatState => ({
    lineBuffer: '',
    lastLine: null,
    consecutiveLineCount: 0,
  });

  it('buffers a partial line across chunks and counts it once the newline arrives', () => {
    const first = detectConsecutiveLineRepeat(fresh(), 'PARTIAL_LON', 30);
    expect(first.lineBuffer).toBe('PARTIAL_LON');
    expect(first.lastLine).toBeNull();
    expect(first.consecutiveLineCount).toBe(0);
    expect(first.abortReason).toBeNull();

    const second = detectConsecutiveLineRepeat(first, 'G_LINE\n', 30);
    expect(second.lineBuffer).toBe('');
    expect(second.lastLine).toBe('PARTIAL_LONG_LINE');
    expect(second.consecutiveLineCount).toBe(1);
    expect(second.abortReason).toBeNull();
  });

  it('aborts on the FIRST crossing of maxRepeatedLine consecutive occurrences', () => {
    let state: LineRepeatState = fresh();
    let last = detectConsecutiveLineRepeat(state, 'REPEAT_ME_XX\n', 3);
    expect(last.consecutiveLineCount).toBe(1);
    expect(last.abortReason).toBeNull();
    state = last;

    last = detectConsecutiveLineRepeat(state, 'REPEAT_ME_XX\n', 3);
    expect(last.consecutiveLineCount).toBe(2);
    expect(last.abortReason).toBeNull();
    state = last;

    last = detectConsecutiveLineRepeat(state, 'REPEAT_ME_XX\n', 3);
    expect(last.consecutiveLineCount).toBe(3);
    expect(last.abortReason).toBe(
      'degenerate loop detected (line repeated 3× consecutively this attempt): "REPEAT_ME_XX"',
    );
  });

  it('resets the consecutive run to 1 when a different >= 8-char line appears', () => {
    let state = detectConsecutiveLineRepeat(fresh(), 'AAAAAAAA\n', 30);
    state = detectConsecutiveLineRepeat(state, 'AAAAAAAA\n', 30);
    expect(state.lastLine).toBe('AAAAAAAA');
    expect(state.consecutiveLineCount).toBe(2);

    const reset = detectConsecutiveLineRepeat(state, 'BBBBBBBB\n', 30);
    expect(reset.lastLine).toBe('BBBBBBBB');
    expect(reset.consecutiveLineCount).toBe(1);
    expect(reset.abortReason).toBeNull();
  });

  it('ignores lines under 8 trimmed chars (never tracked, never aborts)', () => {
    // Structural punctuation like `  },` trims to 2 chars and must not count.
    const out = detectConsecutiveLineRepeat(fresh(), '  },\n  },\n  },\n', 2);
    expect(out.lastLine).toBeNull();
    expect(out.consecutiveLineCount).toBe(0);
    expect(out.abortReason).toBeNull();
    expect(out.lineBuffer).toBe('');
  });

  it('truncates the preview to 60 chars + ellipsis for long lines', () => {
    const longLine = 'X'.repeat(70);
    const out = detectConsecutiveLineRepeat(fresh(), longLine + '\n', 1);
    expect(out.abortReason).toBe(
      `degenerate loop detected (line repeated 1× consecutively this attempt): "${'X'.repeat(60)}…"`,
    );
  });

  it('early-exits mid-buffer on threshold and returns the unprocessed remainder', () => {
    // Three identical lines + a trailing partial in ONE chunk; the abort must
    // fire on the 2nd line (threshold 2) and leave the rest of the buffer
    // intact — mirroring the original inline `break`.
    const out = detectConsecutiveLineRepeat(
      fresh(),
      'SAMELINEXX\nSAMELINEXX\nSAMELINEXX\nLEFTOVER',
      2,
    );
    expect(out.consecutiveLineCount).toBe(2);
    expect(out.lineBuffer).toBe('SAMELINEXX\nLEFTOVER');
    expect(out.abortReason).toContain('degenerate loop detected');
  });
});
