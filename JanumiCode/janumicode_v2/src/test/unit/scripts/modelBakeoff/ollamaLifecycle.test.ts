import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkContextFit,
  classifyFit,
  pullOrCreateModel,
  renderModelfile,
  sampleVram,
  type LifecycleDeps,
} from '../../../../../scripts/model-bakeoff/ollamaLifecycle';
import type { CandidateSpec } from '../../../../../scripts/model-bakeoff/bakeoffConfig';

function candidate(overrides: Partial<CandidateSpec> = {}): CandidateSpec {
  return { slug: 'c1', modelTag: 'gemma4:12b-it-qat', server: {}, ...overrides };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

function makeDeps(overrides: Partial<LifecycleDeps> = {}): LifecycleDeps {
  return {
    fetchFn: vi.fn(async () => jsonResponse({})) as unknown as typeof fetch,
    spawnFn: vi.fn() as unknown as LifecycleDeps['spawnFn'],
    spawnSyncFn: vi.fn(() => ({ status: 0, stdout: '', stderr: '' })) as unknown as LifecycleDeps['spawnSyncFn'],
    sleep: async () => {},
    platform: 'win32',
    log: () => {},
    ...overrides,
  };
}

describe('renderModelfile', () => {
  it('renders FROM + PARAMETER lines', () => {
    const text = renderModelfile({
      from: './unsloth-gemma4.Q4_K_M.gguf',
      parameters: { num_ctx: 65536, temperature: 0.7 },
    });
    expect(text).toBe('FROM ./unsloth-gemma4.Q4_K_M.gguf\nPARAMETER num_ctx 65536\nPARAMETER temperature 0.7\n');
  });

  it('renders FROM alone when no parameters', () => {
    expect(renderModelfile({ from: 'gemma4:12b-it-qat' })).toBe('FROM gemma4:12b-it-qat\n');
  });
});

describe('classifyFit', () => {
  it('ok when the model is fully VRAM-resident', () => {
    expect(classifyFit({ size: 1000, size_vram: 1000 }).verdict).toBe('ok');
    expect(classifyFit({ size: 1000, size_vram: 995 }).verdict).toBe('ok');
  });

  it('cpu_offload when a meaningful share spilled to RAM', () => {
    expect(classifyFit({ size: 1000, size_vram: 950 }).verdict).toBe('cpu_offload');
    expect(classifyFit({ size: 1000, size_vram: 0 }).verdict).toBe('cpu_offload');
  });

  it('unknown when ps data is missing or degenerate', () => {
    expect(classifyFit(undefined).verdict).toBe('unknown');
    expect(classifyFit({}).verdict).toBe('unknown');
    expect(classifyFit({ size: 0, size_vram: 0 }).verdict).toBe('unknown');
  });
});

describe('pullOrCreateModel', () => {
  it('pulls stock tags with OLLAMA_HOST pointed at the alt port', () => {
    const spawnSyncFn = vi.fn(() => ({ status: 0, stdout: '', stderr: '' }));
    const deps = makeDeps({ spawnSyncFn: spawnSyncFn as unknown as LifecycleDeps['spawnSyncFn'] });
    pullOrCreateModel(candidate(), 11500, deps);
    const [cmd, args, opts] = spawnSyncFn.mock.calls[0] as [string, string[], { env: NodeJS.ProcessEnv }];
    expect(cmd).toBe('ollama');
    expect(args).toEqual(['pull', 'gemma4:12b-it-qat']);
    expect(opts.env.OLLAMA_HOST).toBe('127.0.0.1:11500');
  });

  it('creates Modelfile candidates via ollama create -f', () => {
    const spawnSyncFn = vi.fn(() => ({ status: 0, stdout: '', stderr: '' }));
    const deps = makeDeps({ spawnSyncFn: spawnSyncFn as unknown as LifecycleDeps['spawnSyncFn'] });
    pullOrCreateModel(
      candidate({ slug: 'unsloth', modelTag: 'my-unsloth-quant', modelfile: { from: './q.gguf' } }),
      11500,
      deps,
    );
    const [cmd, args] = spawnSyncFn.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('ollama');
    expect(args[0]).toBe('create');
    expect(args[1]).toBe('my-unsloth-quant');
    expect(args[2]).toBe('-f');
    expect(args[3]).toContain('unsloth');
  });

  it('throws with stderr when the pull fails', () => {
    const deps = makeDeps({
      spawnSyncFn: vi.fn(() => ({ status: 1, stdout: '', stderr: 'manifest unknown' })) as unknown as LifecycleDeps['spawnSyncFn'],
    });
    expect(() => pullOrCreateModel(candidate(), 11500, deps)).toThrow(/manifest unknown/);
  });
});

describe('checkContextFit', () => {
  it('loads at the effective num_ctx and classifies from /api/ps', async () => {
    const bodies: unknown[] = [];
    const deps = makeDeps({
      fetchFn: (async (url: string, init?: RequestInit) => {
        if (url.endsWith('/api/generate')) {
          bodies.push(JSON.parse(init?.body as string));
          return jsonResponse({ response: 'ok' });
        }
        return jsonResponse({
          models: [{ model: 'gemma4:12b-it-qat', size: 1000, size_vram: 1000 }],
        });
      }) as unknown as typeof fetch,
    });
    const r = await checkContextFit(
      candidate({ goose: { inputLimit: 65536 } }),
      'http://127.0.0.1:11500',
      deps,
    );
    expect(r.verdict).toBe('ok');
    expect(r.numCtx).toBe(65536);
    expect((bodies[0] as { options: { num_ctx: number } }).options.num_ctx).toBe(65536);
  });

  it('reports cpu_offload when the model spilled to RAM', async () => {
    const deps = makeDeps({
      fetchFn: (async (url: string) =>
        url.endsWith('/api/generate')
          ? jsonResponse({ response: 'ok' })
          : jsonResponse({ models: [{ model: 'gemma4:12b-it-qat', size: 1000, size_vram: 600 }] })) as unknown as typeof fetch,
    });
    const r = await checkContextFit(candidate({ server: { contextLength: 262144 } }), 'http://x', deps);
    expect(r.verdict).toBe('cpu_offload');
    expect(r.numCtx).toBe(262144);
  });

  it('returns unknown on transport errors', async () => {
    const deps = makeDeps({
      fetchFn: (async () => {
        throw new Error('boom');
      }) as unknown as typeof fetch,
    });
    expect((await checkContextFit(candidate(), 'http://x', deps)).verdict).toBe('unknown');
  });
});

describe('sampleVram', () => {
  it('parses nvidia-smi csv output', () => {
    const deps = makeDeps({
      spawnSyncFn: vi.fn(() => ({ status: 0, stdout: '18432, 24576\n', stderr: '' })) as unknown as LifecycleDeps['spawnSyncFn'],
    });
    expect(sampleVram(deps)).toEqual({ usedMb: 18432, totalMb: 24576 });
  });

  it('returns null when nvidia-smi is unavailable', () => {
    const deps = makeDeps({
      spawnSyncFn: vi.fn(() => ({ status: 1, stdout: '', stderr: 'not found' })) as unknown as LifecycleDeps['spawnSyncFn'],
    });
    expect(sampleVram(deps)).toBeNull();
  });
});
