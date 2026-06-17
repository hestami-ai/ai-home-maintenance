import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ALT_PORT,
  effectiveNumCtx,
  resolveAltPort,
  validateSweepConfig,
  type BakeoffSweepConfig,
  type CandidateSpec,
} from '../../../../../scripts/model-bakeoff/bakeoffConfig';

function baseSweep(overrides: Partial<BakeoffSweepConfig> = {}): BakeoffSweepConfig {
  return {
    referenceWorkspace: '/ref/ws',
    referenceDb: '/ref/db.db',
    outputDir: '/out',
    candidates: [
      { slug: 'a', modelTag: 'gpt-oss:20b', server: {} },
    ],
    ...overrides,
  };
}

function candidate(overrides: Partial<CandidateSpec> = {}): CandidateSpec {
  return { slug: 'c1', modelTag: 'gemma4:12b-it-qat', server: {}, ...overrides };
}

describe('validateSweepConfig', () => {
  it('accepts a minimal valid config', () => {
    const r = validateSweepConfig(baseSweep());
    expect(r.errors).toEqual([]);
    expect(r.config).not.toBeNull();
  });

  it('rejects non-object input', () => {
    expect(validateSweepConfig(null).errors).toHaveLength(1);
    expect(validateSweepConfig([]).errors).toHaveLength(1);
  });

  it('requires referenceWorkspace, referenceDb, outputDir', () => {
    const r = validateSweepConfig({ candidates: [candidate()] });
    expect(r.config).toBeNull();
    expect(r.errors.join(' ')).toContain('referenceWorkspace');
    expect(r.errors.join(' ')).toContain('referenceDb');
    expect(r.errors.join(' ')).toContain('outputDir');
  });

  it('rejects empty candidates', () => {
    const r = validateSweepConfig(baseSweep({ candidates: [] }));
    expect(r.errors.join(' ')).toContain('non-empty');
  });

  it('rejects duplicate slugs and bad slug characters', () => {
    const r = validateSweepConfig(
      baseSweep({
        candidates: [candidate({ slug: 'x' }), candidate({ slug: 'x' }), candidate({ slug: 'bad slug!' })],
      }),
    );
    expect(r.errors.some((e) => e.includes('duplicate slug'))).toBe(true);
    expect(r.errors.some((e) => e.includes('slug must match'))).toBe(true);
  });

  it('rejects unknown kvCacheType and missing modelfile.from', () => {
    const r = validateSweepConfig(
      baseSweep({
        candidates: [
          candidate({ slug: 'kv', server: { kvCacheType: 'q5_1' as never } }),
          candidate({ slug: 'mf', modelfile: { from: '' } }),
        ],
      }),
    );
    expect(r.errors.some((e) => e.includes('kvCacheType'))).toBe(true);
    expect(r.errors.some((e) => e.includes('modelfile.from'))).toBe(true);
  });

  it('rejects tier2Finalists referencing unknown slugs', () => {
    const r = validateSweepConfig(baseSweep({ tier2Finalists: ['nope'] }));
    expect(r.errors.some((e) => e.includes('unknown slug "nope"'))).toBe(true);
  });

  it('warns when context sizes disagree across goose/modelfile/server', () => {
    const r = validateSweepConfig(
      baseSweep({
        candidates: [
          candidate({
            slug: 'mismatch',
            server: { contextLength: 131072 },
            goose: { inputLimit: 65536 },
          }),
        ],
      }),
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('context sizes disagree'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('65536'))).toBe(true);
  });

  it('warns when no context length is specified anywhere', () => {
    const r = validateSweepConfig(baseSweep({ candidates: [candidate({ slug: 'noctx' })] }));
    expect(r.warnings.some((w) => w.includes('no context length'))).toBe(true);
  });

  it('rejects out-of-range autoCompactThreshold', () => {
    const r = validateSweepConfig(
      baseSweep({ candidates: [candidate({ goose: { autoCompactThreshold: 1.5 } })] }),
    );
    expect(r.errors.some((e) => e.includes('autoCompactThreshold'))).toBe(true);
  });
});

describe('effectiveNumCtx precedence', () => {
  it('goose.inputLimit wins over modelfile and server', () => {
    const c = candidate({
      goose: { inputLimit: 32768 },
      modelfile: { from: 'gemma4:12b-it-qat', parameters: { num_ctx: 65536 } },
      server: { contextLength: 131072 },
    });
    expect(effectiveNumCtx(c)).toBe(32768);
  });

  it('modelfile num_ctx wins over server.contextLength', () => {
    const c = candidate({
      modelfile: { from: 'x', parameters: { num_ctx: '65536' } },
      server: { contextLength: 131072 },
    });
    expect(effectiveNumCtx(c)).toBe(65536);
  });

  it('falls back to server.contextLength, then null', () => {
    expect(effectiveNumCtx(candidate({ server: { contextLength: 8192 } }))).toBe(8192);
    expect(effectiveNumCtx(candidate())).toBeNull();
  });
});

describe('resolveAltPort', () => {
  it('candidate port > sweep altPort > default', () => {
    const sweep = baseSweep({ altPort: 11600 });
    expect(resolveAltPort(sweep, candidate({ server: { port: 11700 } }))).toBe(11700);
    expect(resolveAltPort(sweep, candidate())).toBe(11600);
    expect(resolveAltPort(baseSweep(), candidate())).toBe(DEFAULT_ALT_PORT);
  });
});
