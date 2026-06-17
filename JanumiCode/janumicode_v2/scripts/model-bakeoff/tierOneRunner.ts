/**
 * Tier-1 driver: per candidate config, re-execute Phase 9 (+10) from the
 * Phase-8-complete reference DB against a harness-owned alt-port Ollama.
 *
 * Per-config flow:
 *   1. fresh workspace seeded from the reference (corpusPrep)
 *   2. evict the system Ollama's resident models (VRAM contention)
 *   3. spawn `ollama serve` on the alt port with the candidate's server env
 *   4. pull/create the candidate model, context-fit pre-check, VRAM sample
 *   5. spawn `node dist/cli/janumicode.js run ... --resume-from-db <ref>
 *      --resume-at-sub-phase scaffold_synthesis` with Goose pointed at the
 *      alt port; sample VRAM peak while it runs
 *   6. collect metrics from the workspace DB, write result + rolling report
 *   7. tear the alt-port server down
 *
 * Sequential by design — one GPU.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';

import type { BakeoffSweepConfig, CandidateSpec } from './bakeoffConfig';
import {
  DEFAULT_SYSTEM_PORT,
  DEFAULT_TIER1_TIMEOUT_SECONDS,
  resolveAltPort,
} from './bakeoffConfig';
import { prepareConfigWorkspace } from './corpusPrep';
import {
  checkContextFit,
  defaultDeps,
  evictResidentModels,
  pullOrCreateModel,
  sampleVram,
  spawnOllamaServer,
  type LifecycleDeps,
  type VramSample,
} from './ollamaLifecycle';
import { collectMetrics, findWorkspaceDb, type ConfigMetrics, type RunEnvironment } from './metricsCollector';
import { buildCrossConfigReport, writeConfigResult, writeCrossConfigReport } from './reportGenerator';
import { SweepStateManager } from './sweepState';

export const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * Env for the JanumiCode CLI child (and, by inheritance, every goose
 * process it spawns). Pure — unit-tested against the documented Goose env
 * contract in janumicode/docs/Goose CLI Environment Variables.md.
 */
export function buildCliEnv(
  candidate: CandidateSpec,
  altPort: number,
  gooseRoot: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const altUrl = `http://127.0.0.1:${altPort}`;
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    // Route EVERYTHING at the harness-owned alt-port server.
    OLLAMA_HOST: `127.0.0.1:${altPort}`,
    OLLAMA_URL: altUrl,
    GOOSE_PROVIDER__HOST: altUrl,
    JANUMICODE_GOOSE_PROVIDER: 'ollama',
    JANUMICODE_GOOSE_MODEL: candidate.modelTag,
    // Hermetic goose config/data/state per config; no auxiliary model
    // calls (session naming / tool-call summaries) polluting metrics.
    GOOSE_PATH_ROOT: gooseRoot,
    GOOSE_MODE: 'auto',
    GOOSE_CONTEXT_STRATEGY: 'summarize',
    GOOSE_DISABLE_SESSION_NAMING: 'true',
    GOOSE_DISABLE_TOOL_CALL_SUMMARY: 'true',
    // Unattended-harness rails (same set run-harness.sh uses).
    JANUMICODE_EXECUTOR_UNATTENDED: '1',
    JANUMICODE_DB_MODE: 'direct',
    JANUMICODE_AUDIT_PAUSE: '0',
    JANUMICODE_REVIEW_ENABLED: 'false',
    JANUMICODE_INGESTION_STAGE3_OFF: '1',
  };
  const g = candidate.goose;
  if (g?.inputLimit !== undefined) env.GOOSE_INPUT_LIMIT = String(g.inputLimit);
  if (g?.contextLimit !== undefined) env.GOOSE_CONTEXT_LIMIT = String(g.contextLimit);
  if (g?.autoCompactThreshold !== undefined) env.GOOSE_AUTO_COMPACT_THRESHOLD = String(g.autoCompactThreshold);
  if (g?.maxToolResponseSize !== undefined) env.GOOSE_MAX_TOOL_RESPONSE_SIZE = String(g.maxToolResponseSize);
  if (g?.toolCallCutoff !== undefined) env.GOOSE_TOOL_CALL_CUTOFF = String(g.toolCallCutoff);
  if (g?.maxTokens !== undefined) env.GOOSE_MAX_TOKENS = String(g.maxTokens);
  if (g?.temperature !== undefined) env.GOOSE_TEMPERATURE = String(g.temperature);
  return env;
}

export interface CliRunResult {
  exitCode: number | null;
  timedOut: boolean;
  vramPeak: VramSample | null;
}

/** Spawn the JanumiCode CLI and wait, sampling VRAM peak while it runs. */
export function runJanumicodeCli(opts: {
  args: string[];
  env: NodeJS.ProcessEnv;
  logFile: string;
  timeoutSeconds: number;
  deps?: LifecycleDeps;
}): Promise<CliRunResult> {
  const deps = opts.deps ?? defaultDeps;
  mkdirSync(dirname(opts.logFile), { recursive: true });
  const logStream = createWriteStream(opts.logFile, { flags: 'a' });
  logStream.on('error', (err) => deps.log(`CLI log write failed: ${err.message}`));

  return new Promise((resolvePromise) => {
    const child = spawn('node', opts.args, {
      cwd: REPO_ROOT,
      env: opts.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);

    let vramPeak: VramSample | null = sampleVram(deps);
    const vramTimer = setInterval(() => {
      const s = sampleVram(deps);
      if (s && (!vramPeak || s.usedMb > vramPeak.usedMb)) vramPeak = s;
    }, 30_000);

    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      deps.log(`CLI run exceeded ${opts.timeoutSeconds}s — killing process tree`);
      if (child.pid !== undefined) {
        if (deps.platform === 'win32') {
          deps.spawnSyncFn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false });
        } else {
          child.kill('SIGKILL');
        }
      }
    }, opts.timeoutSeconds * 1000);

    child.on('exit', (code) => {
      clearInterval(vramTimer);
      clearTimeout(killTimer);
      logStream.end();
      resolvePromise({ exitCode: code, timedOut, vramPeak });
    });
  });
}

export async function runCandidateTierOne(
  sweep: BakeoffSweepConfig,
  candidate: CandidateSpec,
  deps: LifecycleDeps = defaultDeps,
): Promise<ConfigMetrics> {
  const outputDir = sweep.outputDir;
  const altPort = resolveAltPort(sweep, candidate);
  const systemBaseUrl = `http://127.0.0.1:${sweep.systemOllamaPort ?? DEFAULT_SYSTEM_PORT}`;
  const logsDir = join(outputDir, 'logs');

  const { workspaceDir, intentPath } = prepareConfigWorkspace({
    referenceWorkspace: sweep.referenceWorkspace,
    candidate,
    workspacesRoot: join(outputDir, 'workspaces'),
  });

  await evictResidentModels(systemBaseUrl, deps);
  const server = await spawnOllamaServer(
    candidate,
    { port: altPort, logFile: join(logsDir, `${candidate.slug}.ollama-serve.log`) },
    deps,
  );

  try {
    pullOrCreateModel(candidate, altPort, deps);
    const contextFit = await checkContextFit(candidate, server.baseUrl, deps);
    const vramAfterLoad = sampleVram(deps);
    if (contextFit.verdict === 'cpu_offload') {
      deps.log(`${candidate.slug}: model does NOT fit in VRAM at num_ctx=${contextFit.numCtx} — running anyway, all tasks will be classed context_overflow`);
    }

    const cliResult = await runJanumicodeCli({
      args: [
        join(REPO_ROOT, 'dist', 'cli', 'janumicode.js'),
        'run',
        '--intent', `@${intentPath}`,
        '--workspace', workspaceDir,
        '--llm-mode', 'real',
        '--auto-approve',
        '--full-slice',
        '--resume-from-db', sweep.referenceDb,
        '--resume-at-sub-phase', 'scaffold_synthesis',
      ],
      env: buildCliEnv(candidate, altPort, join(outputDir, 'goose-roots', candidate.slug)),
      logFile: join(logsDir, `${candidate.slug}.janumicode.log`),
      timeoutSeconds: sweep.tier1?.globalTimeoutSeconds ?? DEFAULT_TIER1_TIMEOUT_SECONDS,
      deps,
    });

    const env: RunEnvironment = {
      contextFit,
      ollamaVersion: server.version,
      vramAfterLoad,
      vramPeak: cliResult.vramPeak,
      cliExitCode: cliResult.exitCode,
    };

    const dbPath = findWorkspaceDb(workspaceDir);
    if (dbPath === null) {
      throw new Error(`No workspace DB produced at ${workspaceDir} — CLI exit ${cliResult.exitCode}, see logs`);
    }
    const db = new Database(dbPath, { readonly: true });
    try {
      const metrics = collectMetrics({ db, candidate, env });
      if (cliResult.timedOut) metrics.notes.push('CLI run hit the sweep global timeout and was killed');
      return metrics;
    } finally {
      db.close();
    }
  } finally {
    await server.teardown();
  }
}

export async function runTierOne(
  sweep: BakeoffSweepConfig,
  opts: { resume: boolean; only?: string },
  deps: LifecycleDeps = defaultDeps,
): Promise<void> {
  mkdirSync(sweep.outputDir, { recursive: true });
  const state = new SweepStateManager(sweep.outputDir, `tier1-${new Date().toISOString().slice(0, 19)}`);

  let queue = state.getPendingConfigs(sweep.candidates, opts.resume);
  if (opts.only !== undefined) queue = queue.filter((c) => c.slug === opts.only);
  deps.log(`tier-1 sweep: ${queue.length} config(s) to run (${sweep.candidates.length} total)`);

  const completed: ConfigMetrics[] = [];
  for (const candidate of sweep.candidates) {
    const st = state.getConfig(candidate.slug);
    if (st.status === 'completed' && st.resultPath) {
      try {
        completed.push(JSON.parse(readFileSync(st.resultPath, 'utf-8')) as ConfigMetrics);
      } catch {
        /* prior result unreadable — it will just be missing from the table */
      }
    }
  }

  for (const candidate of queue) {
    deps.log(`=== ${candidate.slug} (${candidate.modelTag}) ===`);
    state.markRunning(candidate.slug);
    try {
      const metrics = await runCandidateTierOne(sweep, candidate, deps);
      const resultPath = writeConfigResult(sweep.outputDir, metrics);
      state.markCompleted(candidate.slug, resultPath);
      completed.push(metrics);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      deps.log(`${candidate.slug} FAILED: ${msg}`);
      state.markFailed(candidate.slug, msg);
    }
    // Rolling report — partial results are visible mid-sweep.
    const report = buildCrossConfigReport({
      sweepId: state.current.sweepId,
      generatedAt: new Date().toISOString(),
      referenceWorkspace: sweep.referenceWorkspace,
      candidates: sweep.candidates,
      results: completed,
    });
    writeCrossConfigReport(sweep.outputDir, report);
  }
  deps.log(`tier-1 sweep done — report at ${join(sweep.outputDir, 'bakeoff-report.md')}`);
}
