import { describe, expect, it } from 'vitest';

import { buildCliEnv } from '../../../../../scripts/model-bakeoff/tierOneRunner';
import type { CandidateSpec } from '../../../../../scripts/model-bakeoff/bakeoffConfig';

const BASE: NodeJS.ProcessEnv = { PATH: '/bin', HOME: '/home/u' };

function candidate(overrides: Partial<CandidateSpec> = {}): CandidateSpec {
  return { slug: 'c1', modelTag: 'gemma4:12b-it-qat', server: {}, ...overrides };
}

describe('buildCliEnv', () => {
  it('routes JanumiCode and Goose at the alt-port Ollama', () => {
    const env = buildCliEnv(candidate(), 11500, '/out/goose-roots/c1', BASE);
    expect(env.OLLAMA_HOST).toBe('127.0.0.1:11500');
    expect(env.OLLAMA_URL).toBe('http://127.0.0.1:11500');
    expect(env.GOOSE_PROVIDER__HOST).toBe('http://127.0.0.1:11500');
    expect(env.JANUMICODE_GOOSE_PROVIDER).toBe('ollama');
    expect(env.JANUMICODE_GOOSE_MODEL).toBe('gemma4:12b-it-qat');
    expect(env.PATH).toBe('/bin'); // base env preserved
  });

  it('exports JANUMICODE_FORCE_STACK only when the candidate forces a stack (language sweep)', () => {
    expect(buildCliEnv(candidate(), 11500, '/g', BASE).JANUMICODE_FORCE_STACK).toBeUndefined();
    expect(buildCliEnv(candidate({ forceStack: 'python' }), 11500, '/g', BASE).JANUMICODE_FORCE_STACK).toBe('python');
  });

  it('sets the hermetic + metrics-hygiene goose baseline', () => {
    const env = buildCliEnv(candidate(), 11500, '/out/goose-roots/c1', BASE);
    expect(env.GOOSE_PATH_ROOT).toBe('/out/goose-roots/c1');
    expect(env.GOOSE_MODE).toBe('auto');
    expect(env.GOOSE_CONTEXT_STRATEGY).toBe('summarize');
    expect(env.GOOSE_DISABLE_SESSION_NAMING).toBe('true');
    expect(env.GOOSE_DISABLE_TOOL_CALL_SUMMARY).toBe('true');
    expect(env.JANUMICODE_EXECUTOR_UNATTENDED).toBe('1');
    expect(env.JANUMICODE_DB_MODE).toBe('direct');
    expect(env.JANUMICODE_AUDIT_PAUSE).toBe('0');
    expect(env.JANUMICODE_REVIEW_ENABLED).toBe('false');
    expect(env.JANUMICODE_INGESTION_STAGE3_OFF).toBe('1');
  });

  it('maps per-candidate goose dimensions to GOOSE_* vars', () => {
    const env = buildCliEnv(
      candidate({
        goose: {
          inputLimit: 65536,
          contextLimit: 60000,
          autoCompactThreshold: 0.6,
          maxToolResponseSize: 100000,
          toolCallCutoff: 5,
          maxTokens: 16000,
          temperature: 0.7,
        },
      }),
      11500,
      '/g',
      BASE,
    );
    expect(env.GOOSE_INPUT_LIMIT).toBe('65536');
    expect(env.GOOSE_CONTEXT_LIMIT).toBe('60000');
    expect(env.GOOSE_AUTO_COMPACT_THRESHOLD).toBe('0.6');
    expect(env.GOOSE_MAX_TOOL_RESPONSE_SIZE).toBe('100000');
    expect(env.GOOSE_TOOL_CALL_CUTOFF).toBe('5');
    expect(env.GOOSE_MAX_TOKENS).toBe('16000');
    expect(env.GOOSE_TEMPERATURE).toBe('0.7');
  });

  it('omits goose dimension vars when the candidate sets none', () => {
    const env = buildCliEnv(candidate(), 11500, '/g', BASE);
    expect(env.GOOSE_INPUT_LIMIT).toBeUndefined();
    expect(env.GOOSE_CONTEXT_LIMIT).toBeUndefined();
    expect(env.GOOSE_AUTO_COMPACT_THRESHOLD).toBeUndefined();
    expect(env.GOOSE_MAX_TOKENS).toBeUndefined();
  });
});
