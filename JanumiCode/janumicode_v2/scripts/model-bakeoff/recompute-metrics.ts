/**
 * Recompute bakeoff metrics from already-saved workspace DBs — no GPU, no
 * pipeline re-run. Use after a metricsCollector fix to backfill the per-config
 * result.json + cross-config report for a sweep that already ran.
 *
 *   npx tsx scripts/model-bakeoff/recompute-metrics.ts \
 *     --config scripts/model-bakeoff/sweep-matrix-languages.json [--tier 1|2]
 *
 * The infra-side environment fields (ollama version, context-fit verdict, VRAM,
 * CLI exit code) are NOT in the DB — they were measured live and are recovered
 * from the existing result.json. The per-task timing / outcomes / Phase-10 /
 * stabilization fields are recomputed from the DB by the current collector.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';

import { validateSweepConfig, type CandidateSpec } from './bakeoffConfig';
import { collectMetrics, findWorkspaceDb, type ConfigMetrics, type RunEnvironment } from './metricsCollector';
import { buildCrossConfigReport, writeConfigResult, writeCrossConfigReport } from './reportGenerator';

/** Rebuild the live-measured RunEnvironment from a previously-saved result.json. */
function envFromSavedResult(prev: Partial<ConfigMetrics>): RunEnvironment {
  const totalMb = prev.vramTotalMb ?? null;
  return {
    contextFit: {
      verdict: prev.contextFit ?? 'unknown',
      numCtx: prev.effectiveNumCtx ?? null,
      size: null,
      sizeVram: null,
    },
    ollamaVersion: prev.ollamaVersion ?? 'unknown',
    vramAfterLoad: prev.vramAfterLoadMb != null ? { usedMb: prev.vramAfterLoadMb, totalMb: totalMb ?? 0 } : null,
    vramPeak: prev.vramPeakMb != null ? { usedMb: prev.vramPeakMb, totalMb: totalMb ?? 0 } : null,
    cliExitCode: prev.cliExitCode ?? null,
  };
}

function parseArgs(argv: string[]): { config: string; tier: '1' | '2' } {
  let config = '';
  let tier: '1' | '2' = '1';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') config = argv[++i] ?? '';
    else if (argv[i] === '--tier') {
      const t = argv[++i];
      if (t !== '1' && t !== '2') throw new Error(`--tier must be 1 or 2 (got ${t})`);
      tier = t;
    } else throw new Error(`Unknown flag: ${argv[i]}`);
  }
  if (config === '') throw new Error('--config <path> is required');
  return { config, tier };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const { config, errors } = validateSweepConfig(JSON.parse(readFileSync(resolve(args.config), 'utf-8')));
  if (config === null) {
    for (const e of errors) console.error(`[recompute] ERROR: ${e}`);
    process.exit(2);
  }
  const outputDir = resolve(config.outputDir);
  const baseDir = args.tier === '2' ? join(outputDir, 'tier2') : outputDir;
  const workspacesRoot = join(baseDir, 'workspaces');
  const resultsRoot = join(baseDir, 'results');

  const candidates: CandidateSpec[] =
    args.tier === '2'
      ? config.candidates.filter((c) => (config.tier2Finalists ?? []).includes(c.slug))
      : config.candidates;

  // Skip a config the live sweep is still running — its DB is partial and the
  // live run will write the authoritative result.json when it finishes.
  const statePath = join(baseDir, 'sweep-state.json');
  const running = new Set<string>();
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, 'utf-8')) as { configs?: Record<string, { status?: string }> };
    for (const [slug, st] of Object.entries(state.configs ?? {})) {
      if (st.status === 'running') running.add(slug);
    }
  }

  const recomputed: ConfigMetrics[] = [];
  for (const candidate of candidates) {
    if (running.has(candidate.slug)) {
      console.warn(`[recompute] ${candidate.slug}: live run in progress — skipping (DB is partial)`);
      continue;
    }
    const workspaceDir = join(workspacesRoot, candidate.slug);
    const dbPath = findWorkspaceDb(workspaceDir);
    if (dbPath === null) {
      console.warn(`[recompute] ${candidate.slug}: no workspace DB found — skipping (not run yet?)`);
      continue;
    }
    const prevPath = join(resultsRoot, `${candidate.slug}.result.json`);
    const prev: Partial<ConfigMetrics> = existsSync(prevPath)
      ? (JSON.parse(readFileSync(prevPath, 'utf-8')) as Partial<ConfigMetrics>)
      : {};
    const env = envFromSavedResult(prev);

    try {
      const db = new Database(dbPath, { readonly: true });
      try {
        const metrics = collectMetrics({ db, candidate, env, gooseRootDir: join(baseDir, 'goose-roots', candidate.slug) });
        writeConfigResult(baseDir, metrics);
        recomputed.push(metrics);
        const tasksWithTime = metrics.tasks.filter((t) => t.durationMs > 0).length;
        console.log(
          `[recompute] ${candidate.slug}: ${metrics.tasks.length} task(s), ${tasksWithTime} timed; ` +
          `mean=${metrics.meanTaskWallMs == null ? '—' : Math.round(metrics.meanTaskWallMs / 1000) + 's'} ` +
          `p95=${metrics.p95TaskWallMs == null ? '—' : Math.round(metrics.p95TaskWallMs / 1000) + 's'} ` +
          `chars/s=${metrics.meanCharsPerSec == null ? '—' : Math.round(metrics.meanCharsPerSec)} ` +
          `pass=${metrics.taskPassRate == null ? '—' : Math.round(metrics.taskPassRate * 100) + '%'}`,
        );
      } finally {
        db.close();
      }
    } catch (err) {
      console.warn(`[recompute] ${candidate.slug}: failed (${err instanceof Error ? err.message : String(err)}) — skipping`);
    }
  }

  if (recomputed.length > 0) {
    const report = buildCrossConfigReport({
      sweepId: `recomputed-tier${args.tier}`,
      generatedAt: new Date().toISOString(),
      referenceWorkspace: config.referenceWorkspace,
      candidates,
      results: recomputed,
    });
    const reportPath = writeCrossConfigReport(baseDir, report);
    console.log(`[recompute] rewrote ${recomputed.length} result(s) + report → ${reportPath}`);
  } else {
    console.warn('[recompute] nothing recomputed (no workspace DBs found)');
  }
}

main();
