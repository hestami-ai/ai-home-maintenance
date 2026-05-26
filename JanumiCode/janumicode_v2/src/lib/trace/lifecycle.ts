/**
 * Tier-1/2 lifecycle event emitter.
 *
 * Writes one NDJSON line per event to
 *   <workspace>/.janumicode/runs/<workflow_run_id>/lifecycle.ndjson
 *
 * Distinct from the Tier-3 transformation_step layer:
 *   - Tier 3 (governed_stream + payload files): forensic lineage. Tells you
 *     *where* in the pipeline a field changed.
 *   - Tier 1/2 (this file, NDJSON): operational survey. Tells you *that*
 *     something happened — phase boundaries, artifact counts, packet
 *     coherence verdicts, executor lifecycle changes, decision points.
 *
 * Why NDJSON not a governed_stream record:
 *   - High emission rate (5–500/phase). Spamming governed_stream would
 *     bloat the table that the webview, contract harness, and trace CLI
 *     all read from.
 *   - Operators grep these. NDJSON + jq is the right surface.
 *   - One-file-per-run isolates the data and ages out naturally with
 *     the workspace.
 *
 * Cost: append-only writes, no fsync, no JSON validation. Tens of KB
 * per phase. Negligible.
 *
 * Configuration:
 *   - configureLifecycleLog({ workspaceRoot, enabled }) is called once
 *     during orchestrator boot.
 *   - When disabled (JANUMICODE_LIFECYCLE_LOG=off), all emits are no-ops.
 *   - run_id is read from the TraceCtx at emit time, so a single
 *     configuration call serves any number of concurrent workflow runs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { currentTraceContext } from './traceContext';

interface LifecycleConfig {
  workspaceRoot: string;
  enabled: boolean;
}

let config: LifecycleConfig | null = null;

/**
 * Cache of per-run write streams. Each run gets its own append stream.
 * Streams are not closed proactively — the process exits when the run
 * ends, which closes them. For long-lived orchestrator processes
 * (Extension Host) we cap the cache at 4 entries and evict LRU.
 */
const streamCache = new Map<string, fs.WriteStream>();
const MAX_CACHED_STREAMS = 4;

export function configureLifecycleLog(c: LifecycleConfig | null): void {
  // Close any existing streams when re-configuring (e.g. workspace switch).
  for (const s of streamCache.values()) s.end();
  streamCache.clear();
  config = c;
}

export function isLifecycleEnabled(): boolean {
  return config?.enabled ?? false;
}

/**
 * Emit a lifecycle event. The event_name is a dotted path
 * (`phase.entered`, `executor.dispatched`, etc). Additional fields go
 * under `data`. Workflow / phase / sub_phase coordinates are pulled
 * from the current TraceCtx if not provided.
 *
 * Failures (disk full, etc.) are swallowed and logged once per session
 * via stderr — the lifecycle layer must never break a workflow run.
 */
export function emitLifecycle(event: string, data: Record<string, unknown> = {}): void {
  if (!config?.enabled) return;
  const ctx = currentTraceContext();
  // We can emit even outside a TraceCtx — falls back to a "system"
  // bucket. Useful for pre-workflow events (startup, config load).
  const workflow_run_id =
    typeof data.workflow_run_id === 'string'
      ? data.workflow_run_id
      : (ctx?.workflow_run_id ?? 'no-workflow');

  const phase_id = data.phase_id === undefined ? (ctx?.phase_id ?? null) : data.phase_id;
  const sub_phase_id = data.sub_phase_id === undefined ? (ctx?.sub_phase_id ?? null) : data.sub_phase_id;

  const record = {
    ts: new Date().toISOString(),
    event,
    workflow_run_id,
    phase_id,
    sub_phase_id,
    ...data,
  };

  const line = `${JSON.stringify(record)}\n`;
  const stream = openStream(workflow_run_id);
  if (!stream) return;
  try {
    stream.write(line);
  } catch (err) {
    warnOnce(`lifecycle write failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function openStream(workflow_run_id: string): fs.WriteStream | null {
  if (!config) return null;
  const cached = streamCache.get(workflow_run_id);
  if (cached) {
    // Bump LRU
    streamCache.delete(workflow_run_id);
    streamCache.set(workflow_run_id, cached);
    return cached;
  }
  const dir = path.join(config.workspaceRoot, '.janumicode', 'runs', workflow_run_id);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, 'lifecycle.ndjson');
    const stream = fs.createWriteStream(filepath, { flags: 'a', encoding: 'utf8' });
    // Attach an error handler — append streams can fail asynchronously
    // (workspace deleted under us in tests, ACL change in production,
    // disk full). Without this, the 'error' event surfaces as an
    // unhandled Node rejection. We swallow, warn once, and invalidate
    // the cache entry so the next emit opens a fresh stream against
    // whatever still exists on disk.
    stream.on('error', (err: Error) => {
      warnOnce(`lifecycle stream write failed for ${workflow_run_id}: ${err.message}`);
      if (streamCache.get(workflow_run_id) === stream) {
        streamCache.delete(workflow_run_id);
      }
    });
    // Evict LRU if over cap.
    if (streamCache.size >= MAX_CACHED_STREAMS) {
      const oldestKey = streamCache.keys().next().value;
      if (oldestKey !== undefined) {
        streamCache.get(oldestKey)?.end();
        streamCache.delete(oldestKey);
      }
    }
    streamCache.set(workflow_run_id, stream);
    return stream;
  } catch (err) {
    warnOnce(`lifecycle open-stream failed for ${workflow_run_id}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

let warnedOnce = false;
function warnOnce(msg: string): void {
  if (warnedOnce) return;
  warnedOnce = true;
  process.stderr.write(`[lifecycle] WARN: ${msg}\n`);
}

/** For tests / shutdown: flush and close all open streams. */
export function closeLifecycleStreams(): void {
  for (const s of streamCache.values()) s.end();
  streamCache.clear();
}
