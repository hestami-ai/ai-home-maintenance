/**
 * Harness-owned Ollama server lifecycle for the model bakeoff.
 *
 * The system Ollama (default port 11434) stays untouched — the harness
 * spawns its OWN `ollama serve` on an alternate port with the per-config
 * env (flash attention, KV-cache type, context length, ...). Both servers
 * share the default model blob store (~/.ollama/models), so pulls are
 * reused. The system server's resident models are evicted (keep_alive: 0)
 * before each config so the candidate has the full GPU.
 *
 * Every function takes injectable deps so unit tests run without a GPU,
 * Ollama install, or open ports.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { CandidateSpec, ModelfileSpec } from './bakeoffConfig';
import { effectiveNumCtx } from './bakeoffConfig';

export interface LifecycleDeps {
  fetchFn: typeof fetch;
  spawnFn: typeof spawn;
  spawnSyncFn: typeof spawnSync;
  sleep: (ms: number) => Promise<void>;
  platform: NodeJS.Platform;
  log: (msg: string) => void;
}

export const defaultDeps: LifecycleDeps = {
  fetchFn: (...args) => fetch(...args),
  spawnFn: spawn,
  spawnSyncFn: spawnSync,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  platform: process.platform,
  log: (msg) => console.log(`[ollama-lifecycle] ${msg}`),
};

export interface OllamaHandle {
  port: number;
  baseUrl: string;
  version: string;
  pid: number;
  teardown(): Promise<void>;
}

export type ContextFitVerdict = 'ok' | 'cpu_offload' | 'unknown';

export interface ContextFitResult {
  verdict: ContextFitVerdict;
  numCtx: number | null;
  sizeVram: number | null;
  size: number | null;
}

export interface VramSample {
  usedMb: number;
  totalMb: number;
}

interface PsModel {
  name?: string;
  model?: string;
  size?: number;
  size_vram?: number;
}

/** Env block for the harness-owned `ollama serve` process. Pure. */
export function buildServerEnv(
  candidate: CandidateSpec,
  port: number,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...baseEnv, OLLAMA_HOST: `127.0.0.1:${port}` };
  const s = candidate.server;
  if (s.flashAttention !== undefined) env.OLLAMA_FLASH_ATTENTION = s.flashAttention ? '1' : '0';
  if (s.kvCacheType !== undefined) env.OLLAMA_KV_CACHE_TYPE = s.kvCacheType;
  if (s.contextLength !== undefined) env.OLLAMA_CONTEXT_LENGTH = String(s.contextLength);
  if (s.numParallel !== undefined) env.OLLAMA_NUM_PARALLEL = String(s.numParallel);
  if (s.maxLoadedModels !== undefined) env.OLLAMA_MAX_LOADED_MODELS = String(s.maxLoadedModels);
  return env;
}

/** Render a ModelfileSpec to Modelfile text. Pure. */
export function renderModelfile(spec: ModelfileSpec): string {
  const lines = [`FROM ${spec.from}`];
  for (const [key, value] of Object.entries(spec.parameters ?? {})) {
    lines.push(`PARAMETER ${key} ${value}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * cpu_offload when the loaded model isn't fully VRAM-resident. Ollama's
 * /api/ps reports size (total bytes) and size_vram (bytes on GPU); any
 * meaningful gap means layers or KV cache spilled to system RAM. Pure.
 */
export function classifyFit(ps: PsModel | undefined): Omit<ContextFitResult, 'numCtx'> {
  const size = ps?.size ?? null;
  const sizeVram = ps?.size_vram ?? null;
  if (size === null || sizeVram === null || size === 0) {
    return { verdict: 'unknown', size, sizeVram };
  }
  return { verdict: sizeVram / size < 0.99 ? 'cpu_offload' : 'ok', size, sizeVram };
}

export async function isPortServing(baseUrl: string, deps: LifecycleDeps = defaultDeps): Promise<boolean> {
  try {
    const res = await deps.fetchFn(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Evict every model resident on a server (normally the SYSTEM Ollama at
 * 11434) so the candidate gets the whole GPU. `keep_alive: 0` unloads
 * after the (empty) request completes. The server itself keeps running.
 */
export async function evictResidentModels(baseUrl: string, deps: LifecycleDeps = defaultDeps): Promise<string[]> {
  let models: PsModel[] = [];
  try {
    const res = await deps.fetchFn(`${baseUrl}/api/ps`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    models = ((await res.json()) as { models?: PsModel[] }).models ?? [];
  } catch {
    deps.log(`no server reachable at ${baseUrl} — nothing to evict`);
    return [];
  }
  const evicted: string[] = [];
  for (const m of models) {
    const name = m.model ?? m.name;
    if (!name) continue;
    deps.log(`evicting ${name} from ${baseUrl}`);
    try {
      await deps.fetchFn(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: name, keep_alive: 0 }),
        signal: AbortSignal.timeout(30_000),
      });
      evicted.push(name);
    } catch (err) {
      deps.log(`evict ${name} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return evicted;
}

function killTree(pid: number, deps: LifecycleDeps): void {
  if (deps.platform === 'win32') {
    deps.spawnSyncFn('taskkill', ['/pid', String(pid), '/T', '/F'], { shell: false });
  } else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* already dead */
    }
  }
}

/**
 * Spawn the harness-owned `ollama serve` on the alt port and wait until
 * /api/version answers. Refuses to spawn over a stale/foreign listener.
 */
export async function spawnOllamaServer(
  candidate: CandidateSpec,
  opts: { port: number; logFile: string },
  deps: LifecycleDeps = defaultDeps,
): Promise<OllamaHandle> {
  const baseUrl = `http://127.0.0.1:${opts.port}`;
  if (await isPortServing(baseUrl, deps)) {
    throw new Error(
      `Something already serves on ${baseUrl} (stale bakeoff server or other process). ` +
      `Stop it before sweeping — the harness won't kill a process it didn't spawn.`,
    );
  }

  mkdirSync(dirname(opts.logFile), { recursive: true });
  const logStream = createWriteStream(opts.logFile, { flags: 'a' });
  // A log-write failure must not take down the sweep (and the stream's
  // async open would otherwise surface as an uncaught exception).
  logStream.on('error', (err) => deps.log(`server log write failed: ${err.message}`));
  const child: ChildProcess = deps.spawnFn('ollama', ['serve'], {
    env: buildServerEnv(candidate, opts.port),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  const pid = child.pid;
  if (pid === undefined) {
    logStream.end();
    throw new Error('ollama serve failed to spawn (no pid)');
  }

  let exited = false;
  child.on('exit', () => {
    exited = true;
  });

  // Readiness: up to 60s. Cold service start on Windows can be slow.
  let version = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    if (exited) throw new Error(`ollama serve exited during startup — see ${opts.logFile}`);
    try {
      const res = await deps.fetchFn(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        version = ((await res.json()) as { version?: string }).version ?? 'unknown';
        break;
      }
    } catch {
      /* not up yet */
    }
    await deps.sleep(2000);
  }
  if (version === '') {
    killTree(pid, deps);
    logStream.end();
    throw new Error(`ollama serve on port ${opts.port} never became ready — see ${opts.logFile}`);
  }
  deps.log(`ollama ${version} serving at ${baseUrl} (pid ${pid})`);

  return {
    port: opts.port,
    baseUrl,
    version,
    pid,
    teardown: async () => {
      killTree(pid, deps);
      logStream.end();
      // Confirm the port actually freed so the next config can't trip the
      // stale-listener guard.
      for (let i = 0; i < 10; i++) {
        if (!(await isPortServing(baseUrl, deps))) return;
        await deps.sleep(1000);
      }
      deps.log(`WARNING: port ${opts.port} still serving after teardown`);
    },
  };
}

/**
 * Ensure the candidate's model exists on the alt-port server: `ollama pull`
 * for stock tags, or render + `ollama create` for Modelfile candidates.
 * Blobs land in the shared store, so repeat sweeps are cheap.
 */
export function pullOrCreateModel(
  candidate: CandidateSpec,
  port: number,
  deps: LifecycleDeps = defaultDeps,
): void {
  const env = { ...process.env, OLLAMA_HOST: `127.0.0.1:${port}` };
  if (candidate.modelfile) {
    const modelfilePath = join(tmpdir(), `bakeoff-${candidate.slug}.Modelfile`);
    writeFileSync(modelfilePath, renderModelfile(candidate.modelfile), 'utf-8');
    deps.log(`ollama create ${candidate.modelTag} -f ${modelfilePath}`);
    const r = deps.spawnSyncFn('ollama', ['create', candidate.modelTag, '-f', modelfilePath], {
      env,
      encoding: 'utf-8',
      timeout: 30 * 60 * 1000,
    });
    if (r.status !== 0) {
      throw new Error(`ollama create ${candidate.modelTag} failed (exit ${r.status}): ${r.stderr ?? ''}`);
    }
  } else {
    deps.log(`ollama pull ${candidate.modelTag}`);
    const r = deps.spawnSyncFn('ollama', ['pull', candidate.modelTag], {
      env,
      encoding: 'utf-8',
      timeout: 60 * 60 * 1000,
    });
    if (r.status !== 0) {
      throw new Error(`ollama pull ${candidate.modelTag} failed (exit ${r.status}): ${r.stderr ?? ''}`);
    }
  }
}

/**
 * Load the model at the candidate's effective num_ctx and verify it is
 * fully VRAM-resident. A model that silently spills to CPU would produce
 * garbage throughput numbers that look like a "slow model".
 */
export async function checkContextFit(
  candidate: CandidateSpec,
  baseUrl: string,
  deps: LifecycleDeps = defaultDeps,
): Promise<ContextFitResult> {
  const numCtx = effectiveNumCtx(candidate);
  try {
    const body: Record<string, unknown> = {
      model: candidate.modelTag,
      prompt: 'Reply with the single word: ok',
      stream: false,
      keep_alive: '10m',
    };
    if (numCtx !== null) body.options = { num_ctx: numCtx };
    // Allow long load: big QAT models take a while to map into VRAM.
    const res = await deps.fetchFn(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    if (!res.ok) {
      deps.log(`context-fit generate failed: HTTP ${res.status}`);
      return { verdict: 'unknown', numCtx, size: null, sizeVram: null };
    }
    const psRes = await deps.fetchFn(`${baseUrl}/api/ps`, { signal: AbortSignal.timeout(5000) });
    const ps = ((await psRes.json()) as { models?: PsModel[] }).models ?? [];
    const entry = ps.find((m) => (m.model ?? m.name) === candidate.modelTag) ?? ps[0];
    const fit = classifyFit(entry);
    deps.log(
      `context-fit ${candidate.modelTag} num_ctx=${numCtx ?? 'default'}: ${fit.verdict}` +
      (fit.size ? ` (vram ${fit.sizeVram}/${fit.size})` : ''),
    );
    return { ...fit, numCtx };
  } catch (err) {
    deps.log(`context-fit check errored: ${err instanceof Error ? err.message : String(err)}`);
    return { verdict: 'unknown', numCtx, size: null, sizeVram: null };
  }
}

/** GPU memory snapshot via nvidia-smi; null when unavailable. */
export function sampleVram(deps: LifecycleDeps = defaultDeps): VramSample | null {
  const r = deps.spawnSyncFn(
    'nvidia-smi',
    ['--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'],
    { encoding: 'utf-8', timeout: 10_000 },
  );
  if (r.status !== 0 || typeof r.stdout !== 'string') return null;
  const line = r.stdout.trim().split('\n')[0] ?? '';
  const [used, total] = line.split(',').map((s) => Number(s.trim()));
  if (!Number.isFinite(used) || !Number.isFinite(total)) return null;
  return { usedMb: used, totalMb: total };
}
