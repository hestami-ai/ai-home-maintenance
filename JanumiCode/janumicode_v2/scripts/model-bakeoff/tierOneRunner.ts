/**
 * Tier-1 driver: per candidate config, re-execute Phase 9 (+10) from the
 * Phase-8-complete reference DB against the RUNNING system Ollama.
 *
 * Per-config flow:
 *   1. fresh workspace seeded from the reference (corpusPrep) + seeded goose cfg
 *   2. pull/create the candidate model on the system server, context-fit
 *      pre-check, VRAM sample
 *   3. spawn `node dist/cli/janumicode.js run ... --resume-from-db <ref>
 *      --resume-at-sub-phase reconnaissance` with Goose pointed at the system
 *      Ollama; sample VRAM peak while it runs
 *   4. collect metrics from the workspace DB, write result + rolling report
 *
 * The harness NEVER spawns its own `ollama serve` (an earlier alt-port design
 * could orphan and hold GPU VRAM on a hard kill). Sequential by design — one GPU.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';

import type { BakeoffSweepConfig, CandidateSpec } from './bakeoffConfig';
import {
  DEFAULT_SYSTEM_PORT,
  DEFAULT_TIER1_TIMEOUT_SECONDS,
} from './bakeoffConfig';
import { prepareConfigWorkspace, seedGooseConfig } from './corpusPrep';
import {
  checkContextFit,
  defaultDeps,
  pullOrCreateModel,
  sampleVram,
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
  ollamaPort: number,
  gooseRoot: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
  tuning: {
    maxLeaves?: number;
    noProgressSeconds?: number;
    maxCallSeconds?: number;
    cliTimeoutSeconds?: number;
    cliIdleTimeoutSeconds?: number;
  } = {},
): NodeJS.ProcessEnv {
  const altUrl = `http://127.0.0.1:${ollamaPort}`;
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    // Route EVERYTHING at the (system) ollama server.
    OLLAMA_HOST: `127.0.0.1:${ollamaPort}`,
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
  // Language-sweep lever: Phase-9 recon pins every area to this stack.
  if (candidate.forceStack !== undefined) env.JANUMICODE_FORCE_STACK = candidate.forceStack;
  // Suppress goose's first-run telemetry-consent onboarding (the hermetic
  // GOOSE_PATH_ROOT has no prior consent → goose would block on a Yes/No TUI
  // prompt and never call the model). Belt-and-suspenders with seedGooseConfig.
  env.GOOSE_TELEMETRY_ENABLED = 'false';
  // Bakeoff levers: cap the leaf set and lengthen the no-progress watchdog so a
  // REASONING model's silent thinking is not aborted as a "hang" (the 90s
  // default killed gpt-oss's per-leaf context/codegen calls 3× → leaf errors).
  if (tuning.maxLeaves !== undefined) env.JANUMICODE_BAKEOFF_MAX_LEAVES = String(tuning.maxLeaves);
  if (tuning.noProgressSeconds !== undefined) env.JANUMICODE_LLM_NO_PROGRESS_SECONDS = String(tuning.noProgressSeconds);
  // Wall-clock cap per llmCaller attempt (default 600s also cut long reasoning).
  if (tuning.maxCallSeconds !== undefined) env.JANUMICODE_LLM_MAX_CALL_SECONDS = String(tuning.maxCallSeconds);
  // Per-leaf executor (goose) process caps — the 600s/120s defaults quarantine
  // a slow reasoning model's leaves as "Process timed out" (speed, not quality).
  if (tuning.cliTimeoutSeconds !== undefined) env.JANUMICODE_CLI_TIMEOUT_SECONDS = String(tuning.cliTimeoutSeconds);
  if (tuning.cliIdleTimeoutSeconds !== undefined) env.JANUMICODE_CLI_IDLE_TIMEOUT_SECONDS = String(tuning.cliIdleTimeoutSeconds);
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
  // The harness ALWAYS uses the already-running system ollama — it never spawns
  // its own server (the removed alt instance could orphan + hold VRAM on a
  // hard kill). The candidate's `server` block (flash/KV/context) is therefore
  // advisory only; the running system server's own config governs.
  const ollamaPort = sweep.systemOllamaPort ?? DEFAULT_SYSTEM_PORT;
  const ollamaBaseUrl = `http://127.0.0.1:${ollamaPort}`;
  const logsDir = join(outputDir, 'logs');

  const { workspaceDir, intentPath } = prepareConfigWorkspace({
    referenceWorkspace: sweep.referenceWorkspace,
    candidate,
    workspacesRoot: join(outputDir, 'workspaces'),
  });

  // Pre-seed the hermetic goose root so the session does not block on goose's
  // first-run onboarding (the smoke run hung here, GPU idle, model never called).
  seedGooseConfig(join(outputDir, 'goose-roots', candidate.slug), { modelTag: candidate.modelTag, ollamaPort });

  deps.log(`${candidate.slug}: using system ollama at ${ollamaBaseUrl} (no server spawned)`);
  const ver = await deps.fetchFn(`${ollamaBaseUrl}/api/version`).then(r => r.json()).catch(() => ({ version: 'unknown' }));
  const ollamaVersion = (ver as { version?: string }).version ?? 'unknown';

  {
    pullOrCreateModel(candidate, ollamaPort, deps);
    const contextFit = await checkContextFit(candidate, ollamaBaseUrl, deps);
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
        // Re-enter Phase 9 at its FIRST sub-phase (reconnaissance) — not
        // scaffold_synthesis (stale: predates the recon/author->enforce
        // redesign). Resuming here rolls back any partial Phase-9 records to
        // is_current_version=0, so the LLM cache excludes them and Phase 9
        // (recon -> scaffold -> implement -> closing act) runs fresh with the
        // candidate model and the forced stack. Required for the language sweep.
        '--resume-at-sub-phase', 'reconnaissance',
      ],
      env: buildCliEnv(candidate, ollamaPort, join(outputDir, 'goose-roots', candidate.slug), process.env, {
        maxLeaves: sweep.tier1?.maxLeaves,
        noProgressSeconds: sweep.tier1?.noProgressSeconds,
        maxCallSeconds: sweep.tier1?.maxCallSeconds,
        cliTimeoutSeconds: sweep.tier1?.cliTimeoutSeconds,
        cliIdleTimeoutSeconds: sweep.tier1?.cliIdleTimeoutSeconds,
      }),
      logFile: join(logsDir, `${candidate.slug}.janumicode.log`),
      timeoutSeconds: sweep.tier1?.globalTimeoutSeconds ?? DEFAULT_TIER1_TIMEOUT_SECONDS,
      deps,
    });

    const env: RunEnvironment = {
      contextFit,
      ollamaVersion,
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
      const metrics = collectMetrics({ db, candidate, env, gooseRootDir: join(outputDir, 'goose-roots', candidate.slug) });
      if (cliResult.timedOut) metrics.notes.push('CLI run hit the sweep global timeout and was killed');
      return metrics;
    } finally {
      db.close();
    }
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
