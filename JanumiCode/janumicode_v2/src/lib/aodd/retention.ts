/**
 * AODD trace retention.
 *
 * Per design memo §7:
 *   - Per-run TTL + run-count cap.
 *   - Operator override via `.keep` sentinel file under the run's
 *     `aodd/` directory.
 *   - Pruning runs at AODD initialize() time, before the new run is
 *     created. Not a background timer.
 *   - The DB is NOT touched by AODD pruning. Only the `aodd/` subdir
 *     of pruned runs is removed; the parent `runs/<run_id>/` directory
 *     (which may contain other production files like `transforms.jsonl`,
 *     `lifecycle.ndjson`, `context/*.md`) is left alone.
 *
 * Config (under `aodd.retention` in workspace config.json):
 *   max_runs   default 10
 *   ttl_days   default 30
 *   min_runs   default 3 (floor — keep at least this many regardless of TTL)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface RetentionConfig {
  max_runs: number;
  ttl_days: number;
  min_runs: number;
}

export const DEFAULT_RETENTION: RetentionConfig = {
  max_runs: 10,
  ttl_days: 30,
  min_runs: 3,
};

export interface PruneResult {
  /** Runs that satisfy the prune predicate (over cap OR over TTL, not in floor). */
  candidates: string[];
  /** Runs whose aodd/ subdir was actually deleted. */
  pruned: string[];
  /** Runs that were candidates but kept due to `.keep` sentinel. */
  kept_by_sentinel: string[];
}

interface PruneOptions {
  /** When true, no filesystem changes occur; `candidates` is still populated. */
  dryRun?: boolean;
}

interface DiscoveredRun {
  runId: string;
  aoddPath: string;
  /** ms-since-epoch used to sort newest-first (started_at, fallback mtime). */
  sortKey: number;
  /** ms-since-epoch of completion (null when in-progress / unknown). */
  completedAt: number | null;
  hasKeep: boolean;
}

function discoverRuns(workspaceRoot: string): DiscoveredRun[] {
  const runsRoot = path.join(workspaceRoot, '.janumicode', 'runs');
  if (!fs.existsSync(runsRoot)) return [];
  const out: DiscoveredRun[] = [];
  for (const entry of fs.readdirSync(runsRoot)) {
    const aoddPath = path.join(runsRoot, entry, 'aodd');
    if (!fs.existsSync(aoddPath)) continue;
    let startedMs = 0;
    let completedMs: number | null = null;
    const idxPath = path.join(aoddPath, 'index.json');
    if (fs.existsSync(idxPath)) {
      try {
        const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8')) as {
          started_at?: string;
          completed_at?: string;
        };
        if (idx.started_at) {
          const parsed = Date.parse(idx.started_at);
          if (Number.isFinite(parsed)) startedMs = parsed;
        }
        if (idx.completed_at) {
          const parsed = Date.parse(idx.completed_at);
          if (Number.isFinite(parsed)) completedMs = parsed;
        }
      } catch {
        // fall through to mtime
      }
    }
    if (startedMs === 0) {
      try {
        startedMs = fs.statSync(aoddPath).mtime.getTime();
      } catch {
        // leave as 0
      }
    }
    const hasKeep = fs.existsSync(path.join(aoddPath, '.keep'));
    out.push({ runId: entry, aoddPath, sortKey: startedMs, completedAt: completedMs, hasKeep });
  }
  return out;
}

/**
 * Prune AODD trace directories under `<workspace>/.janumicode/runs/`
 * according to the retention policy. A run is a prune candidate when
 * (over `max_runs` cap OR completed > `ttl_days` ago) AND outside the
 * `min_runs` floor. Candidates with a `.keep` sentinel are kept and
 * recorded in `kept_by_sentinel`.
 *
 * The DB and non-AODD files within `runs/<run_id>/` are untouched.
 */
export function pruneAoddRuns(
  workspaceRoot: string,
  config: RetentionConfig = DEFAULT_RETENTION,
  options: PruneOptions = {},
): PruneResult {
  const result: PruneResult = {
    candidates: [],
    pruned: [],
    kept_by_sentinel: [],
  };

  const runs = discoverRuns(workspaceRoot);
  // Newest-first.
  runs.sort((a, b) => b.sortKey - a.sortKey);

  const now = Date.now();
  const ttlMs = config.ttl_days * 24 * 60 * 60 * 1000;

  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    // Floor: keep the newest min_runs unconditionally (even if they're
    // older than TTL or beyond the cap).
    if (i < config.min_runs) continue;

    const overCap = i >= config.max_runs;
    const completedReference = r.completedAt ?? r.sortKey;
    const overTtl =
      completedReference > 0 && now - completedReference > ttlMs;

    if (!overCap && !overTtl) continue;

    result.candidates.push(r.runId);

    if (r.hasKeep) {
      result.kept_by_sentinel.push(r.runId);
      continue;
    }

    if (options.dryRun) continue;

    try {
      fs.rmSync(r.aoddPath, { recursive: true, force: true });
      result.pruned.push(r.runId);
    } catch (err) {
      process.stderr.write(
        `[aodd] WARN: failed to prune ${r.aoddPath}: ` +
          `${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  return result;
}
