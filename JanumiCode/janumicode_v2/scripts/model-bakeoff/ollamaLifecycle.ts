/**
 * Ollama helpers for the model bakeoff. The harness uses the ALREADY-RUNNING
 * system Ollama (default port 11434) — it never spawns its own server. (An
 * earlier design spawned a harness-owned `ollama serve` on an alt port; that
 * could orphan and hold GPU VRAM when the run was hard-killed, so the alt-
 * instance launching was removed entirely.) These helpers only pull/create the
 * candidate model, verify VRAM fit, and sample GPU memory against that server.
 *
 * Every function takes injectable deps so unit tests run without a GPU,
 * Ollama install, or open ports.
 */
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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


/**
 * Ensure the candidate's model exists on the system server: `ollama pull`
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
