/**
 * Characterization tests for buildOllamaGenerateBody — the per-family
 * /api/generate request-body assembly that was extracted out of
 * OllamaProvider.call() to reduce its cognitive complexity (S3776).
 *
 * These pin the EXACT observable body the provider POSTs for each model family
 * (temperature, num_ctx, think flag, sampling profile, num_predict, and the
 * format:json carve-out), derived from the original inline logic. They guard the
 * behavior-preserving refactor and document the subtle bits — notably that the
 * generate path matches apriel by SUBSTRING (`includes`), and that granite is a
 * non-thinking family that still receives `format: json`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { buildOllamaGenerateBody } from '../../../lib/llm/providers/ollama';
import type { LLMCallOptions } from '../../../lib/llm/llmCaller';

const ENV_KEY = 'JANUMICODE_LLM_NUM_PREDICT';
let savedEnv: string | undefined;

beforeAll(() => { savedEnv = process.env[ENV_KEY]; });
// Keep num_predict deterministic regardless of the operator's environment.
beforeEach(() => { delete process.env[ENV_KEY]; });
afterAll(() => {
  if (savedEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedEnv;
});

function opts(model: string, extra: Partial<LLMCallOptions> = {}): LLMCallOptions {
  return { provider: 'ollama', model, prompt: 'hi', ...extra };
}

function optionsOf(body: Record<string, unknown>): Record<string, unknown> {
  return body.options as Record<string, unknown>;
}

describe('buildOllamaGenerateBody', () => {
  describe('default (unknown) model family', () => {
    it('pins model/prompt/stream and the minimal options block', () => {
      const body = buildOllamaGenerateBody(opts('llama3.1:8b'), false);
      expect(body.model).toBe('llama3.1:8b');
      expect(body.prompt).toBe('hi');
      expect(body.stream).toBe(false);
      expect(body.think).toBe(true); // thinking supported for non-granite
      expect(body).not.toHaveProperty('system');
      expect(body).not.toHaveProperty('format');
      // No family sampling overrides, no num_predict when maxTokens/env unset.
      expect(optionsOf(body)).toEqual({ temperature: 0.7, num_ctx: 262141 });
    });

    it('uses the caller temperature and sets format:json (family does not skip it)', () => {
      const body = buildOllamaGenerateBody(
        opts('llama3.1:8b', { temperature: 0.2, responseFormat: 'json' }),
        false,
      );
      expect(optionsOf(body).temperature).toBe(0.2);
      expect(body.format).toBe('json');
    });

    it('mirrors the streaming flag from the streaming argument', () => {
      expect(buildOllamaGenerateBody(opts('llama3.1:8b'), true).stream).toBe(true);
      expect(buildOllamaGenerateBody(opts('llama3.1:8b'), false).stream).toBe(false);
    });

    it('sets body.system only when a system prompt is provided', () => {
      expect(buildOllamaGenerateBody(opts('llama3.1:8b', { system: 'sys' }), false).system).toBe('sys');
      expect(buildOllamaGenerateBody(opts('llama3.1:8b'), false)).not.toHaveProperty('system');
    });

    it('emits num_predict from maxTokens, and omits it otherwise', () => {
      const withCap = buildOllamaGenerateBody(opts('llama3.1:8b', { maxTokens: 128 }), false);
      expect(optionsOf(withCap).num_predict).toBe(128);
      const noCap = buildOllamaGenerateBody(opts('llama3.1:8b'), false);
      expect(optionsOf(noCap)).not.toHaveProperty('num_predict');
    });

    it('honors JANUMICODE_LLM_NUM_PREDICT as the num_predict fallback', () => {
      process.env[ENV_KEY] = '256';
      const body = buildOllamaGenerateBody(opts('llama3.1:8b'), false);
      expect(optionsOf(body).num_predict).toBe(256);
    });
  });

  describe('qwen family', () => {
    it('pins temperature 1, default num_ctx, qwen sampling, and skips format:json', () => {
      const body = buildOllamaGenerateBody(opts('qwen3:32b', { responseFormat: 'json' }), false);
      expect(body.think).toBe(true);
      expect(body).not.toHaveProperty('format'); // qwen merges response into thinking under format:json
      expect(optionsOf(body)).toEqual({
        temperature: 1,
        num_ctx: 262141,
        presence_penalty: 1.5,
        top_k: 20,
        top_p: 0.95,
        min_p: 0,
        repeat_penalty: 1,
      });
    });
  });

  describe('gemma family', () => {
    it('small gemma: temperature 1, num_ctx 131072, gemma sampling, skips format:json', () => {
      const body = buildOllamaGenerateBody(opts('gemma4:e4b', { responseFormat: 'json' }), false);
      expect(body.think).toBe(true);
      expect(body).not.toHaveProperty('format');
      expect(optionsOf(body)).toEqual({ temperature: 1, num_ctx: 131072, top_k: 64, top_p: 0.95 });
    });

    it('large gemma4 (26b) gets the full 262144 window', () => {
      const body = buildOllamaGenerateBody(opts('gemma4:26b-a4b-it-qat'), false);
      expect(optionsOf(body).num_ctx).toBe(262144);
      expect(optionsOf(body).temperature).toBe(1);
      expect(optionsOf(body).top_k).toBe(64);
    });

    it('large gemma4 (12b) also gets the full 262144 window', () => {
      const body = buildOllamaGenerateBody(opts('gemma4:12b-it-qat'), false);
      expect(optionsOf(body).num_ctx).toBe(262144);
    });
  });

  describe('granite family (non-thinking)', () => {
    it('omits think, uses num_ctx 11000 and default temperature, but STILL sets format:json', () => {
      const body = buildOllamaGenerateBody(opts('granite4.1:30b-q4_K_M', { responseFormat: 'json' }), false);
      expect(body).not.toHaveProperty('think'); // Ollama rejects think:true for granite
      expect(body.format).toBe('json'); // granite is NOT in the json-format skip set
      expect(optionsOf(body)).toEqual({ temperature: 0.7, num_ctx: 11000 });
    });
  });

  describe('gpt-oss family', () => {
    it('num_ctx 131072, default temperature, think true, skips format:json', () => {
      const body = buildOllamaGenerateBody(opts('gpt-oss:20b', { responseFormat: 'json' }), false);
      expect(body.think).toBe(true);
      expect(body).not.toHaveProperty('format');
      expect(optionsOf(body)).toEqual({ temperature: 0.7, num_ctx: 131072 });
    });
  });

  describe('apriel family (matched by substring, not prefix)', () => {
    it('a namespaced apriel model still resolves to num_ctx 50000 and skips format:json', () => {
      const body = buildOllamaGenerateBody(
        opts('servicenow-ai/apriel-1.6-15b-thinker:q4_k_m', { responseFormat: 'json' }),
        false,
      );
      expect(body.think).toBe(true);
      expect(body).not.toHaveProperty('format');
      expect(optionsOf(body)).toEqual({ temperature: 0.7, num_ctx: 50000 });
    });
  });

  describe('ornith family', () => {
    it('temperature 0.6, num_ctx 131072, ornith sampling with stop token, skips format:json', () => {
      const body = buildOllamaGenerateBody(opts('ornith:35b-q4_K_M', { responseFormat: 'json' }), false);
      expect(body.think).toBe(true);
      expect(body).not.toHaveProperty('format');
      expect(optionsOf(body)).toEqual({
        temperature: 0.6,
        num_ctx: 131072,
        top_k: 20,
        top_p: 0.95,
        stop: ['<|im_end|>'],
      });
    });
  });
});
