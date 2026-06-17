import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildServerEnv,
  checkContextFit,
  classifyFit,
  evictResidentModels,
  pullOrCreateModel,
  renderModelfile,
  sampleVram,
  spawnOllamaServer,
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

describe('buildServerEnv', () => {
  it('maps every server dimension to its OLLAMA_* env var', () => {
    const env = buildServerEnv(
      candidate({
        server: {
          flashAttention: true,
          kvCacheType: 'q8_0',
          contextLength: 65536,
          numParallel: 1,
          maxLoadedModels: 1,
        },
      }),
      11500,
      { PATH: '/bin' },
    );
    expect(env.OLLAMA_HOST).toBe('127.0.0.1:11500');
    expect(env.OLLAMA_FLASH_ATTENTION).toBe('1');
    expect(env.OLLAMA_KV_CACHE_TYPE).toBe('q8_0');
    expect(env.OLLAMA_CONTEXT_LENGTH).toBe('65536');
    expect(env.OLLAMA_NUM_PARALLEL).toBe('1');
    expect(env.OLLAMA_MAX_LOADED_MODELS).toBe('1');
    expect(env.PATH).toBe('/bin');
  });

  it('leaves unset dimensions absent (server defaults apply)', () => {
    const env = buildServerEnv(candidate(), 11500, {});
    expect(env.OLLAMA_HOST).toBe('127.0.0.1:11500');
    expect(env.OLLAMA_FLASH_ATTENTION).toBeUndefined();
    expect(env.OLLAMA_KV_CACHE_TYPE).toBeUndefined();
    expect(env.OLLAMA_CONTEXT_LENGTH).toBeUndefined();
  });
});

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

describe('evictResidentModels', () => {
  it('unloads every resident model via keep_alive: 0', async () => {
    const calls: { url: string; body?: unknown }[] = [];
    const deps = makeDeps({
      fetchFn: (async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
        if (url.endsWith('/api/ps')) {
          return jsonResponse({ models: [{ model: 'gpt-oss:20b' }, { name: 'qwen3.5:9b' }] });
        }
        return jsonResponse({});
      }) as unknown as typeof fetch,
    });
    const evicted = await evictResidentModels('http://127.0.0.1:11434', deps);
    expect(evicted).toEqual(['gpt-oss:20b', 'qwen3.5:9b']);
    const gens = calls.filter((c) => c.url.endsWith('/api/generate'));
    expect(gens).toHaveLength(2);
    expect(gens[0].body).toEqual({ model: 'gpt-oss:20b', keep_alive: 0 });
  });

  it('returns empty when the server is unreachable', async () => {
    const deps = makeDeps({
      fetchFn: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    expect(await evictResidentModels('http://127.0.0.1:11434', deps)).toEqual([]);
  });
});

describe('spawnOllamaServer', () => {
  let logDir: string;

  beforeEach(() => {
    logDir = mkdtempSync(join(tmpdir(), 'bakeoff-ollama-'));
  });

  afterEach(() => {
    rmSync(logDir, { recursive: true, force: true });
  });

  function fakeChild(pid = 4242) {
    return { pid, stdout: null, stderr: null, on: vi.fn() };
  }

  it('refuses to spawn over an already-serving port', async () => {
    const deps = makeDeps({
      fetchFn: (async () => jsonResponse({ version: '0.30.0' })) as unknown as typeof fetch,
    });
    await expect(
      spawnOllamaServer(candidate(), { port: 11500, logFile: join(logDir, 's.log') }, deps),
    ).rejects.toThrow(/already serves/);
    expect(deps.spawnFn).not.toHaveBeenCalled();
  });

  it('spawns, waits for readiness, captures the server version', async () => {
    let call = 0;
    const spawnFn = vi.fn(() => fakeChild());
    const deps = makeDeps({
      spawnFn: spawnFn as unknown as LifecycleDeps['spawnFn'],
      fetchFn: (async () => {
        call++;
        if (call === 1) throw new Error('ECONNREFUSED'); // stale-port pre-check
        return jsonResponse({ version: '0.30.0' });       // readiness
      }) as unknown as typeof fetch,
    });
    const handle = await spawnOllamaServer(
      candidate({ server: { flashAttention: true } }),
      { port: 11500, logFile: join(logDir, 's.log') },
      deps,
    );
    expect(handle.version).toBe('0.30.0');
    expect(handle.pid).toBe(4242);
    expect(handle.baseUrl).toBe('http://127.0.0.1:11500');
    const spawnEnv = (spawnFn.mock.calls[0] as unknown[])[2] as { env: NodeJS.ProcessEnv };
    expect(spawnEnv.env.OLLAMA_HOST).toBe('127.0.0.1:11500');
    expect(spawnEnv.env.OLLAMA_FLASH_ATTENTION).toBe('1');
  });

  it('teardown kills the process tree on Windows and confirms the port freed', async () => {
    let call = 0;
    const spawnSyncFn = vi.fn(() => ({ status: 0, stdout: '', stderr: '' }));
    const deps = makeDeps({
      spawnFn: vi.fn(() => fakeChild(777)) as unknown as LifecycleDeps['spawnFn'],
      spawnSyncFn: spawnSyncFn as unknown as LifecycleDeps['spawnSyncFn'],
      fetchFn: (async () => {
        call++;
        if (call === 1) throw new Error('ECONNREFUSED'); // pre-check
        if (call === 2) return jsonResponse({ version: '0.30.0' }); // readiness
        throw new Error('ECONNREFUSED'); // post-teardown port check: freed
      }) as unknown as typeof fetch,
    });
    const handle = await spawnOllamaServer(candidate(), { port: 11500, logFile: join(logDir, 's.log') }, deps);
    await handle.teardown();
    expect(spawnSyncFn).toHaveBeenCalledWith('taskkill', ['/pid', '777', '/T', '/F'], { shell: false });
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
