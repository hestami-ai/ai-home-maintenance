/**
 * Tier-2 driver: finalists (sweep.tier2Finalists) get a FRESH full-slice
 * pipeline run — Phase 0 → 10, no resume — so the winning configs are
 * validated end-to-end, not just on the resumed Phase-9 corpus. Same
 * Ollama lifecycle and metrics collection as Tier 1; results land under
 * <outputDir>/tier2/.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

import type { BakeoffSweepConfig, CandidateSpec } from './bakeoffConfig';
import { DEFAULT_SYSTEM_PORT, DEFAULT_TIER1_TIMEOUT_SECONDS, resolveAltPort } from './bakeoffConfig';
import { prepareConfigWorkspace } from './corpusPrep';
import {
  checkContextFit,
  defaultDeps,
  evictResidentModels,
  pullOrCreateModel,
  sampleVram,
  spawnOllamaServer,
  type LifecycleDeps,
} from './ollamaLifecycle';
import { collectMetrics, findWorkspaceDb, type ConfigMetrics, type RunEnvironment } from './metricsCollector';
import { buildCrossConfigReport, writeConfigResult, writeCrossConfigReport } from './reportGenerator';
import { SweepStateManager } from './sweepState';
import { REPO_ROOT, buildCliEnv, runJanumicodeCli } from './tierOneRunner';

export async function runCandidateTierTwo(
  sweep: BakeoffSweepConfig,
  candidate: CandidateSpec,
  tier2Dir: string,
  deps: LifecycleDeps = defaultDeps,
): Promise<ConfigMetrics> {
  const altPort = resolveAltPort(sweep, candidate);
  const systemBaseUrl = `http://127.0.0.1:${sweep.systemOllamaPort ?? DEFAULT_SYSTEM_PORT}`;
  const logsDir = join(tier2Dir, 'logs');

  const { workspaceDir, intentPath } = prepareConfigWorkspace({
    referenceWorkspace: sweep.referenceWorkspace,
    candidate,
    workspacesRoot: join(tier2Dir, 'workspaces'),
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

    // Fresh end-to-end run: no --resume flags. Tier-2 budgets twice the
    // Tier-1 cap by default — the full pipeline includes Phases 0–8 too.
    const cliResult = await runJanumicodeCli({
      args: [
        join(REPO_ROOT, 'dist', 'cli', 'janumicode.js'),
        'run',
        '--intent', `@${intentPath}`,
        '--workspace', workspaceDir,
        '--llm-mode', 'real',
        '--auto-approve',
        '--full-slice',
      ],
      env: buildCliEnv(candidate, altPort, join(tier2Dir, 'goose-roots', candidate.slug)),
      logFile: join(logsDir, `${candidate.slug}.janumicode.log`),
      timeoutSeconds: (sweep.tier1?.globalTimeoutSeconds ?? DEFAULT_TIER1_TIMEOUT_SECONDS) * 2,
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
      metrics.notes.push('tier-2 full-slice run (fresh Phase 0→10, no resume)');
      if (cliResult.timedOut) metrics.notes.push('CLI run hit the sweep global timeout and was killed');
      return metrics;
    } finally {
      db.close();
    }
  } finally {
    await server.teardown();
  }
}

export async function runTierTwo(
  sweep: BakeoffSweepConfig,
  opts: { resume: boolean; only?: string },
  deps: LifecycleDeps = defaultDeps,
): Promise<void> {
  const finalistSlugs = new Set(sweep.tier2Finalists ?? []);
  if (opts.only !== undefined) {
    finalistSlugs.clear();
    finalistSlugs.add(opts.only);
  }
  const finalists = sweep.candidates.filter((c) => finalistSlugs.has(c.slug));
  if (finalists.length === 0) {
    throw new Error('No tier-2 finalists — set tier2Finalists in the sweep matrix (or pass --only <slug>)');
  }

  const tier2Dir = join(sweep.outputDir, 'tier2');
  mkdirSync(tier2Dir, { recursive: true });
  const state = new SweepStateManager(tier2Dir, `tier2-${new Date().toISOString().slice(0, 19)}`);

  const queue = state.getPendingConfigs(finalists, opts.resume);
  deps.log(`tier-2 sweep: ${queue.length} finalist(s) to run`);

  const completed: ConfigMetrics[] = [];
  for (const candidate of queue) {
    deps.log(`=== tier-2 ${candidate.slug} (${candidate.modelTag}) ===`);
    state.markRunning(candidate.slug);
    try {
      const metrics = await runCandidateTierTwo(sweep, candidate, tier2Dir, deps);
      const resultPath = writeConfigResult(tier2Dir, metrics);
      state.markCompleted(candidate.slug, resultPath);
      completed.push(metrics);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      deps.log(`${candidate.slug} FAILED: ${msg}`);
      state.markFailed(candidate.slug, msg);
    }
    const report = buildCrossConfigReport({
      sweepId: state.current.sweepId,
      generatedAt: new Date().toISOString(),
      referenceWorkspace: sweep.referenceWorkspace,
      candidates: finalists,
      results: completed,
    });
    writeCrossConfigReport(tier2Dir, report);
  }
  deps.log(`tier-2 sweep done — report at ${join(tier2Dir, 'bakeoff-report.md')}`);
}
