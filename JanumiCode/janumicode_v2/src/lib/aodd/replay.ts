/**
 * AODD replay / read API.
 *
 * Per design memo §8: read-side library API used by the CLI
 * (`scripts/aodd.js`), tests (trace-completeness fixtures), and any
 * future tooling that needs to walk AODD traces.
 *
 * All reads are file-system reads against
 *   <workspace>/.janumicode/runs/<run_id>/aodd/
 * No DB access. AODD traces are self-sufficient (design memo §1).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  AoddEvent,
  AoddEventType,
  PayloadRef,
  RunInfo,
  RunSummary,
  SubPhaseSummary,
} from './types';
import { phaseIdToFilenameSegment, subPhaseIdToFilenameSegment } from './idCanonicalize';

export interface EventFilter {
  types?: AoddEventType[];
  /** Inclusive lower bound on `ts` (ISO 8601). */
  since?: string;
  /** Inclusive upper bound on `ts` (ISO 8601). */
  until?: string;
  phase_id?: string;
  sub_phase_id?: string;
  invocation_id?: string;
}

// ── Paths ───────────────────────────────────────────────────────────

function runsRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.janumicode', 'runs');
}

function runDir(workspaceRoot: string, runId: string): string {
  return path.join(runsRoot(workspaceRoot), runId);
}

function aoddDir(workspaceRoot: string, runId: string): string {
  return path.join(runDir(workspaceRoot, runId), 'aodd');
}

function eventsPath(workspaceRoot: string, runId: string): string {
  return path.join(aoddDir(workspaceRoot, runId), 'events.ndjson');
}

function indexPath(workspaceRoot: string, runId: string): string {
  return path.join(aoddDir(workspaceRoot, runId), 'index.json');
}

function runSummaryPath(workspaceRoot: string, runId: string): string {
  return path.join(aoddDir(workspaceRoot, runId), 'summaries', 'run.summary.json');
}

function subPhaseSummaryPath(
  workspaceRoot: string,
  runId: string,
  phaseId: string,
  subPhaseId: string,
): string {
  const phaseSeg = phaseIdToFilenameSegment(phaseId as never, { padded: false });
  const subSeg = subPhaseIdToFilenameSegment(subPhaseId);
  return path.join(
    aoddDir(workspaceRoot, runId),
    'summaries',
    phaseSeg,
    `${subSeg}.summary.json`,
  );
}

function payloadPathFor(
  workspaceRoot: string,
  runId: string,
  ref: PayloadRef,
): string {
  const ext = ref.kind === 'json' ? 'json' : 'txt';
  return path.join(
    aoddDir(workspaceRoot, runId),
    'payloads',
    `${ref.payload_ref}.${ext}`,
  );
}

// ── listRuns ────────────────────────────────────────────────────────

/**
 * List AODD-traced runs in the workspace. Newest first by `started_at`
 * from the run's index.json (if present) or by directory mtime as
 * fallback. Skips directories that lack an AODD subdir.
 */
export function listRuns(workspaceRoot: string): RunInfo[] {
  const root = runsRoot(workspaceRoot);
  if (!fs.existsSync(root)) return [];
  const out: RunInfo[] = [];
  for (const entry of fs.readdirSync(root)) {
    const aodd = aoddDir(workspaceRoot, entry);
    if (!fs.existsSync(aodd)) continue;
    let info: RunInfo;
    const idxFile = indexPath(workspaceRoot, entry);
    if (fs.existsSync(idxFile)) {
      try {
        const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8')) as {
          started_at?: string;
          completed_at?: string;
          status?: RunInfo['status'];
        };
        const startedMs = idx.started_at ? Date.parse(idx.started_at) : Number.NaN;
        const completedMs = idx.completed_at ? Date.parse(idx.completed_at) : Number.NaN;
        const duration_ms =
          Number.isFinite(startedMs) && Number.isFinite(completedMs)
            ? Math.max(0, completedMs - startedMs)
            : null;
        info = {
          run_id: entry,
          started_at: idx.started_at ?? '',
          completed_at: idx.completed_at ?? null,
          status: idx.status ?? 'in_progress',
          duration_ms,
          has_keep: fs.existsSync(path.join(aodd, '.keep')),
        };
      } catch {
        info = fallbackRunInfo(workspaceRoot, entry, aodd);
      }
    } else {
      info = fallbackRunInfo(workspaceRoot, entry, aodd);
    }
    out.push(info);
  }
  // Newest first. Use started_at if present; otherwise empty string sorts
  // to the bottom.
  out.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  return out;
}

function fallbackRunInfo(
  _workspaceRoot: string,
  runId: string,
  aoddPath: string,
): RunInfo {
  let mtime = '';
  try {
    mtime = fs.statSync(aoddPath).mtime.toISOString();
  } catch {
    // ignore
  }
  return {
    run_id: runId,
    started_at: mtime,
    completed_at: null,
    status: 'in_progress',
    duration_ms: null,
    has_keep: fs.existsSync(path.join(aoddPath, '.keep')),
  };
}

// ── Summary readers ─────────────────────────────────────────────────

export function readRunSummary(
  workspaceRoot: string,
  runId: string,
): RunSummary | null {
  const p = runSummaryPath(workspaceRoot, runId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as RunSummary;
  } catch {
    return null;
  }
}

/**
 * Read a specific sub-phase summary. Either pass an explicit
 * `phase_id` + `sub_phase_id`, or pass only `sub_phase_id` to search
 * across phases (returns the first match — most sub_phase_ids are
 * unique across phases).
 */
export function readSubPhaseSummary(
  workspaceRoot: string,
  runId: string,
  subPhaseId: string,
  phaseId?: string,
): SubPhaseSummary | null {
  if (phaseId) {
    const p = subPhaseSummaryPath(workspaceRoot, runId, phaseId, subPhaseId);
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8')) as SubPhaseSummary;
    } catch {
      return null;
    }
  }
  // Search across phases.
  const summariesDir = path.join(aoddDir(workspaceRoot, runId), 'summaries');
  if (!fs.existsSync(summariesDir)) return null;
  for (const entry of fs.readdirSync(summariesDir)) {
    if (!entry.startsWith('phase')) continue;
    const subSeg = subPhaseIdToFilenameSegment(subPhaseId);
    const candidate = path.join(summariesDir, entry, `${subSeg}.summary.json`);
    if (fs.existsSync(candidate)) {
      try {
        return JSON.parse(fs.readFileSync(candidate, 'utf8')) as SubPhaseSummary;
      } catch {
        // continue searching
      }
    }
  }
  return null;
}

/**
 * List all sub-phase summaries for a run, optionally filtered by phase.
 */
export function listSubPhaseSummaries(
  workspaceRoot: string,
  runId: string,
  phaseId?: string,
): SubPhaseSummary[] {
  const summariesDir = path.join(aoddDir(workspaceRoot, runId), 'summaries');
  if (!fs.existsSync(summariesDir)) return [];
  const out: SubPhaseSummary[] = [];
  for (const entry of fs.readdirSync(summariesDir)) {
    if (!entry.startsWith('phase')) continue;
    if (phaseId) {
      const wanted = phaseIdToFilenameSegment(phaseId as never, { padded: false });
      if (entry !== wanted) continue;
    }
    const phaseDir = path.join(summariesDir, entry);
    if (!fs.statSync(phaseDir).isDirectory()) continue;
    for (const file of fs.readdirSync(phaseDir)) {
      if (!file.endsWith('.summary.json')) continue;
      try {
        const s = JSON.parse(
          fs.readFileSync(path.join(phaseDir, file), 'utf8'),
        ) as SubPhaseSummary;
        out.push(s);
      } catch {
        // skip malformed
      }
    }
  }
  return out;
}

// ── Event reader ────────────────────────────────────────────────────

function eventPasses(event: AoddEvent, filter: EventFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.types && !filter.types.includes(event.event_type)) return false;
  if (filter.since && event.ts < filter.since) return false;
  if (filter.until && event.ts > filter.until) return false;
  if (filter.phase_id !== undefined && event.phase_id !== filter.phase_id) return false;
  if (filter.sub_phase_id !== undefined && event.sub_phase_id !== filter.sub_phase_id) {
    return false;
  }
  if (filter.invocation_id !== undefined && event.invocation_id !== filter.invocation_id) {
    return false;
  }
  return true;
}

/**
 * Async-iterate AODD events for a run. Each yield is one event. The
 * implementation reads the file synchronously and yields line-by-line —
 * AODD files are TTL-bounded so this is acceptable; can be swapped for
 * a streaming reader if profiling shows it matters.
 */
export async function* readEvents(
  workspaceRoot: string,
  runId: string,
  filter?: EventFilter,
): AsyncIterable<AoddEvent> {
  const p = eventsPath(workspaceRoot, runId);
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    if (!line) continue;
    let event: AoddEvent;
    try {
      event = JSON.parse(line) as AoddEvent;
    } catch {
      continue;
    }
    if (eventPasses(event, filter)) yield event;
  }
}

/**
 * Synchronous variant of `readEvents` returning the full list. Convenient
 * for callers that don't benefit from streaming. (Same overall cost as
 * the async iterator since the underlying read is sync.)
 */
export function readEventsSync(
  workspaceRoot: string,
  runId: string,
  filter?: EventFilter,
): AoddEvent[] {
  const p = eventsPath(workspaceRoot, runId);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf8');
  const out: AoddEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      const event = JSON.parse(line) as AoddEvent;
      if (eventPasses(event, filter)) out.push(event);
    } catch {
      // skip malformed
    }
  }
  return out;
}

/**
 * Walk `parent_event_id` from the given event back toward the root.
 * Returns the chain in reverse-chronological order (event first, root
 * last). Bails after 1000 hops to avoid pathological inputs.
 */
export function readParentChain(
  workspaceRoot: string,
  runId: string,
  eventId: string,
): AoddEvent[] {
  const byId = new Map<string, AoddEvent>();
  for (const e of readEventsSync(workspaceRoot, runId)) byId.set(e.event_id, e);
  const chain: AoddEvent[] = [];
  let current: AoddEvent | undefined = byId.get(eventId);
  let hops = 0;
  while (current && hops < 1000) {
    chain.push(current);
    if (!current.parent_event_id) break;
    current = byId.get(current.parent_event_id);
    hops += 1;
  }
  return chain;
}

/**
 * Walk `caused_by_event_id` analogously to `readParentChain`. Useful
 * when an effect points at the cause that triggered it (distinct from
 * the parent-step relationship).
 */
export function readCausedByChain(
  workspaceRoot: string,
  runId: string,
  eventId: string,
): AoddEvent[] {
  const byId = new Map<string, AoddEvent>();
  for (const e of readEventsSync(workspaceRoot, runId)) byId.set(e.event_id, e);
  const chain: AoddEvent[] = [];
  let current: AoddEvent | undefined = byId.get(eventId);
  let hops = 0;
  while (current && hops < 1000) {
    chain.push(current);
    if (!current.caused_by_event_id) break;
    current = byId.get(current.caused_by_event_id);
    hops += 1;
  }
  return chain;
}

// ── Payload reader ──────────────────────────────────────────────────

/**
 * Read a sidecar payload by reference. Returns null when the file
 * doesn't exist. Callers that want a Buffer can use Buffer.from(result).
 */
export function readPayloadByRef(
  workspaceRoot: string,
  runId: string,
  ref: PayloadRef,
): string | null {
  const p = payloadPathFor(workspaceRoot, runId, ref);
  if (!fs.existsSync(p)) return null;
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Look up a payload by raw ULID + kind hint. Used by the CLI's
 * `aodd payload <run_id> <payload_ref>` command when the caller has the
 * ULID but no full PayloadRef.
 */
export function readPayloadByUlid(
  workspaceRoot: string,
  runId: string,
  ulid: string,
): { kind: 'json' | 'text'; content: string } | null {
  const base = path.join(aoddDir(workspaceRoot, runId), 'payloads');
  const jsonPath = path.join(base, `${ulid}.json`);
  const txtPath = path.join(base, `${ulid}.txt`);
  if (fs.existsSync(jsonPath)) {
    try {
      return { kind: 'json', content: fs.readFileSync(jsonPath, 'utf8') };
    } catch {
      return null;
    }
  }
  if (fs.existsSync(txtPath)) {
    try {
      return { kind: 'text', content: fs.readFileSync(txtPath, 'utf8') };
    } catch {
      return null;
    }
  }
  return null;
}

// ── Markdown readers (read the .md projection for human-facing output) ─

export function readRunSummaryMd(
  workspaceRoot: string,
  runId: string,
): string | null {
  const p = path.join(
    aoddDir(workspaceRoot, runId),
    'summaries',
    'run.summary.md',
  );
  if (!fs.existsSync(p)) return null;
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

export function readSubPhaseSummaryMd(
  workspaceRoot: string,
  runId: string,
  phaseId: string,
  subPhaseId: string,
): string | null {
  const phaseSeg = phaseIdToFilenameSegment(phaseId as never, { padded: false });
  const subSeg = subPhaseIdToFilenameSegment(subPhaseId);
  const p = path.join(
    aoddDir(workspaceRoot, runId),
    'summaries',
    phaseSeg,
    `${subSeg}.summary.md`,
  );
  if (!fs.existsSync(p)) return null;
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}
