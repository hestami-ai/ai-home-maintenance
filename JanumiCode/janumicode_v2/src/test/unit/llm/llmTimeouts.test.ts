/**
 * Model/provider-aware LLM-call timeout budgets (llmTimeouts.ts).
 *
 * Root cause this fixes (cal-29, 2026-06-28): the flat 90 s no-progress timeout
 * killed gemma4:31b mid-stream because a ~19 GB dense local model's reload +
 * prefill (time-to-first-token) after an Ollama model swap routinely exceeds
 * 90 s. LOCAL providers now get generous budgets; CLOUD stays tight; env wins.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { resolveLlmTimeouts, isLocalProvider, resolveRecordsIdleStallMs } from '../../../lib/llm/llmTimeouts';

const ENV_KEYS = [
  'JANUMICODE_LLM_NO_PROGRESS_SECONDS',
  'JANUMICODE_LLM_STALL_MS',
  'JANUMICODE_LLM_MAX_CALL_SECONDS',
  'JANUMICODE_RECORDS_IDLE_STALL_MS',
];

function clearEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k];
}

describe('llmTimeouts.resolveLlmTimeouts', () => {
  afterEach(clearEnv);

  it('LOCAL providers (ollama/llamacpp/ollama-local) get generous reload+prefill budgets', () => {
    const expected = { noProgressSeconds: 600, stallMs: 900_000, maxCallSeconds: 1200 };
    for (const p of ['ollama', 'llamacpp', 'ollama-local', 'OLLAMA']) {
      clearEnv();
      expect(resolveLlmTimeouts(p, 'gemma4:31b-it-qat')).toEqual(expected);
    }
  });

  it('CLOUD / fast providers keep the tight defaults', () => {
    const expected = { noProgressSeconds: 90, stallMs: 180_000, maxCallSeconds: 600 };
    for (const p of ['anthropic', 'google', 'openai', undefined]) {
      clearEnv();
      expect(resolveLlmTimeouts(p, 'whatever')).toEqual(expected);
    }
  });

  it('per-knob env vars override the resolved default (for both local and cloud)', () => {
    process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS = '45';
    process.env.JANUMICODE_LLM_STALL_MS = '12345';
    process.env.JANUMICODE_LLM_MAX_CALL_SECONDS = '777';
    expect(resolveLlmTimeouts('ollama')).toEqual({ noProgressSeconds: 45, stallMs: 12345, maxCallSeconds: 777 });
    expect(resolveLlmTimeouts('anthropic')).toEqual({ noProgressSeconds: 45, stallMs: 12345, maxCallSeconds: 777 });
  });

  it('honors env "0" (disable) and ignores blank/invalid env (falls back to the default)', () => {
    process.env.JANUMICODE_LLM_NO_PROGRESS_SECONDS = '0'; // disable
    process.env.JANUMICODE_LLM_STALL_MS = '';            // blank → default
    process.env.JANUMICODE_LLM_MAX_CALL_SECONDS = 'abc'; // invalid → default
    expect(resolveLlmTimeouts('ollama')).toEqual({ noProgressSeconds: 0, stallMs: 900_000, maxCallSeconds: 1200 });
  });

  it('isLocalProvider classifies correctly', () => {
    expect(isLocalProvider('ollama')).toBe(true);
    expect(isLocalProvider('llamacpp')).toBe(true);
    expect(isLocalProvider('anthropic')).toBe(false);
    expect(isLocalProvider(undefined)).toBe(false);
  });
});

describe('llmTimeouts.resolveRecordsIdleStallMs (session stall MUST exceed per-call wall-clock)', () => {
  afterEach(clearEnv);

  it('LOCAL runs get 1 h — above the 1200 s (1_200_000 ms) local wall-clock', () => {
    const stall = resolveRecordsIdleStallMs(true);
    expect(stall).toBe(3_600_000);
    expect(stall).toBeGreaterThan(resolveLlmTimeouts('ollama').maxCallSeconds * 1000);
  });

  it('CLOUD-only runs keep the 15 min default — above the 600 s cloud wall-clock', () => {
    const stall = resolveRecordsIdleStallMs(false);
    expect(stall).toBe(900_000);
    expect(stall).toBeGreaterThan(resolveLlmTimeouts('anthropic').maxCallSeconds * 1000);
  });

  it('env JANUMICODE_RECORDS_IDLE_STALL_MS overrides both, and honors "0"', () => {
    process.env.JANUMICODE_RECORDS_IDLE_STALL_MS = '7200000';
    expect(resolveRecordsIdleStallMs(true)).toBe(7_200_000);
    expect(resolveRecordsIdleStallMs(false)).toBe(7_200_000);
    process.env.JANUMICODE_RECORDS_IDLE_STALL_MS = '0';
    expect(resolveRecordsIdleStallMs(true)).toBe(0);
  });
});
