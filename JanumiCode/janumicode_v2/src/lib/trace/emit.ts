/**
 * Single write seam for transformation_step records.
 *
 * Why centralized: every step emission needs the same coordination —
 * read TraceCtx, mint a step_id, append the payload to the per-run
 * transforms.jsonl, write the governed_stream record, return the new
 * id so the caller can chain. Doing this once means call sites stay
 * one line.
 *
 * Configuration happens at orchestrator startup via configureTraceEmit()
 * (writer + version sha + workspace root). When unconfigured, emit
 * becomes a silent no-op so unit tests and pre-init code paths don't
 * crash. Mirrors the pattern in LLMCaller.setWriter / setLiveLogDir.
 *
 * Payload format on disk: one JSONL file per workflow run, at
 *   <workspace>/.janumicode/runs/<workflow_run_id>/transforms.jsonl
 * Each line is the full step record (step_id, sub_phase_id, step_type,
 * parent_step_id, input_record_ids, output_record_id, field_diff,
 * duration_ms, error, metadata, payload). One file → easy to grep,
 * `jq`-friendly, fewer inodes than the previous per-step file scheme.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  AgentRole,
  TransformationFieldDiff,
  TransformationStepContent,
  TransformationStepType,
} from '../types/records';
import { currentParentStep, currentTraceContext } from './traceContext';

// Minimal writer surface so this module doesn't drag the whole
// GovernedStreamWriter class into its dependency graph. The real
// writer satisfies this shape. `content` is typed as
// Record<string, unknown> to match the writer's signature; we
// build the TransformationStepContent locally and pass it through.
export interface TraceWriter {
  writeRecord(options: {
    record_type: 'transformation_step';
    schema_version: string;
    workflow_run_id: string;
    phase_id?: string | null;
    sub_phase_id?: string | null;
    produced_by_agent_role?: AgentRole | null;
    janumicode_version_sha: string;
    content: Record<string, unknown>;
  }): { id: string };
}

interface EmitConfig {
  writer: TraceWriter;
  versionSha: string;
  workspaceRoot: string;
  /** When false, payload files are not written. Step records still are. */
  payloadsEnabled: boolean;
}

let config: EmitConfig | null = null;

/**
 * Initialize the trace-emit module. Call once during orchestrator boot,
 * after the workspace root and governed-stream writer are known.
 *
 * Calling configureTraceEmit(null) disables emission. Useful in tests
 * or for performance-critical runs (set via JANUMICODE_TRACE=off).
 */
export function configureTraceEmit(c: EmitConfig | null): void {
  config = c;
}

/** Returns true when the trace layer is wired and emitting. */
export function isTraceEnabled(): boolean {
  return config !== null;
}

export interface EmitStepOptions {
  step_type: TransformationStepType;
  input_record_ids?: string[];
  output_record_id?: string;
  /**
   * Optional full payload to dump to disk. Pass the object you want
   * preserved (materialized prompt as { prompt, system }, raw response
   * as { text, thinking, toolCalls }, etc). JSON.stringified verbatim.
   * If omitted, no file is written and payload_path is undefined.
   */
  payload?: unknown;
  field_diff?: TransformationFieldDiff;
  duration_ms?: number;
  error?: { message: string; stack?: string };
  metadata?: Record<string, unknown>;
  /** Override agent role; defaults to the current TraceCtx. */
  agent_role?: AgentRole | null;
  /**
   * Override sub_phase_id. Useful when the step belongs to a different
   * sub-phase than the current TraceCtx (e.g. context_assembled records
   * the sub-phase whose context was assembled, not the assembler's).
   */
  sub_phase_id_override?: string;
}

/**
 * Emit a transformation step. Returns the new step_id, or null if the
 * trace layer is disabled or no TraceCtx is active. Caller is free to
 * ignore the return value when not building a sub-chain.
 *
 * Failures (disk IO, DB write) are swallowed and logged to stderr —
 * the trace layer must never break an in-flight workflow run.
 */
export function emitTransformationStep(opts: EmitStepOptions): string | null {
  if (!config) return null;
  const ctx = currentTraceContext();
  if (!ctx) return null;

  const sub_phase_id = opts.sub_phase_id_override ?? ctx.sub_phase_id;
  if (!sub_phase_id) {
    // Steps need a sub_phase_id by design (so walk-back can group by phase).
    // Skip silently rather than fail; surface as a warning so the seam
    // can be fixed.
    process.stderr.write(
      `[trace] WARN: step ${opts.step_type} skipped — no sub_phase_id in TraceCtx ` +
      `(workflow=${ctx.workflow_run_id})\n`,
    );
    return null;
  }

  const step_id = randomUUID();
  const parent_step_id = currentParentStep();

  let payload_path: string | undefined;
  if (config.payloadsEnabled && opts.payload !== undefined) {
    payload_path = appendToTransformsJsonl({
      workspaceRoot: config.workspaceRoot,
      workflow_run_id: ctx.workflow_run_id,
      step_id,
      step_type: opts.step_type,
      sub_phase_id,
      parent_step_id,
      input_record_ids: opts.input_record_ids ?? [],
      output_record_id: opts.output_record_id,
      field_diff: opts.field_diff,
      duration_ms: opts.duration_ms,
      error: opts.error,
      metadata: opts.metadata,
      payload: opts.payload,
    });
  }

  const content: TransformationStepContent = {
    kind: 'transformation_step',
    schemaVersion: '1.0',
    step_id,
    parent_step_id,
    step_type: opts.step_type,
    sub_phase_id,
    agent_role: opts.agent_role === undefined ? null : opts.agent_role,
    input_record_ids: opts.input_record_ids ?? [],
  };
  if (opts.output_record_id !== undefined) content.output_record_id = opts.output_record_id;
  if (payload_path) content.payload_path = payload_path;
  if (opts.field_diff) content.field_diff = opts.field_diff;
  if (opts.duration_ms !== undefined) content.duration_ms = opts.duration_ms;
  if (opts.error) content.error = opts.error;
  if (opts.metadata) content.metadata = opts.metadata;

  try {
    config.writer.writeRecord({
      record_type: 'transformation_step',
      schema_version: '1.0',
      workflow_run_id: ctx.workflow_run_id,
      phase_id: ctx.phase_id,
      sub_phase_id,
      produced_by_agent_role: opts.agent_role ?? null,
      janumicode_version_sha: config.versionSha,
      // Cast: the writer types `content` as Record<string, unknown> to
      // accept any record-content shape. Our specific shape is a
      // closed interface that doesn't carry an index signature, so we
      // widen at the call site.
      content: content as unknown as Record<string, unknown>,
    });
  } catch (err) {
    process.stderr.write(
      `[trace] ERROR: failed to write transformation_step ${step_id} (${opts.step_type}): ` +
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
  }

  return step_id;
}

interface AppendArgs {
  workspaceRoot: string;
  workflow_run_id: string;
  step_id: string;
  step_type: TransformationStepType;
  sub_phase_id: string;
  parent_step_id: string | null;
  input_record_ids: string[];
  output_record_id?: string;
  field_diff?: TransformationFieldDiff;
  duration_ms?: number;
  error?: { message: string; stack?: string };
  metadata?: Record<string, unknown>;
  payload: unknown;
}

/**
 * Append one line to the per-run transforms.jsonl. Returns the
 * workspace-relative path to the file (the same value for every step
 * in a run) so callers can store it on the governed_stream record as
 * a stable handle for the walk-back CLI.
 *
 * Each line carries the step's identifying fields PLUS the full
 * payload, so `jq` queries can run against the jsonl without joining
 * back to the DB.
 */
function appendToTransformsJsonl(args: AppendArgs): string | undefined {
  const stream = openTransformsStream(args.workspaceRoot, args.workflow_run_id);
  if (!stream) return undefined;
  const record = {
    step_id: args.step_id,
    ts: new Date().toISOString(),
    step_type: args.step_type,
    sub_phase_id: args.sub_phase_id,
    parent_step_id: args.parent_step_id,
    input_record_ids: args.input_record_ids,
    output_record_id: args.output_record_id,
    field_diff: args.field_diff,
    duration_ms: args.duration_ms,
    error: args.error,
    metadata: args.metadata,
    payload: args.payload,
  };
  try {
    stream.stream.write(`${JSON.stringify(record)}\n`);
    return stream.relativePath;
  } catch (err) {
    process.stderr.write(
      `[trace] WARN: failed to append transforms.jsonl for ${args.workflow_run_id}: ` +
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    return undefined;
  }
}

// ── Per-run JSONL stream cache ────────────────────────────────────
//
// Same pattern as lifecycle.ts: cache the WriteStream per workflow_run_id
// so we open the file once and append on every emit. Attach an error
// handler so async write failures (workspace deleted under us in tests,
// disk full, ACL change in production) don't escape as unhandled
// rejections; instead we warn once and invalidate the cache so the
// next emit reopens cleanly.

interface CachedStream {
  stream: fs.WriteStream;
  filepath: string;
  relativePath: string;
}

const transformStreamCache = new Map<string, CachedStream>();
const MAX_CACHED_TRANSFORM_STREAMS = 4;

function openTransformsStream(
  workspaceRoot: string,
  workflow_run_id: string,
): CachedStream | null {
  const cached = transformStreamCache.get(workflow_run_id);
  if (cached) {
    // Bump LRU
    transformStreamCache.delete(workflow_run_id);
    transformStreamCache.set(workflow_run_id, cached);
    return cached;
  }
  const dir = path.join(workspaceRoot, '.janumicode', 'runs', workflow_run_id);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, 'transforms.jsonl');
    const stream = fs.createWriteStream(filepath, { flags: 'a', encoding: 'utf8' });
    stream.on('error', (err: Error) => {
      process.stderr.write(
        `[trace] WARN: transforms.jsonl write failed for ${workflow_run_id}: ${err.message}\n`,
      );
      if (transformStreamCache.get(workflow_run_id)?.stream === stream) {
        transformStreamCache.delete(workflow_run_id);
      }
    });
    if (transformStreamCache.size >= MAX_CACHED_TRANSFORM_STREAMS) {
      const oldestKey = transformStreamCache.keys().next().value;
      if (oldestKey !== undefined) {
        transformStreamCache.get(oldestKey)?.stream.end();
        transformStreamCache.delete(oldestKey);
      }
    }
    const entry: CachedStream = {
      stream,
      filepath,
      relativePath: path
        .relative(workspaceRoot, filepath)
        .replaceAll('\\', '/'),
    };
    transformStreamCache.set(workflow_run_id, entry);
    return entry;
  } catch (err) {
    process.stderr.write(
      `[trace] WARN: failed to open transforms.jsonl for ${workflow_run_id}: ` +
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    return null;
  }
}

/** For tests + shutdown: flush + close all open transform streams. */
export function closeTransformStreams(): void {
  for (const c of transformStreamCache.values()) c.stream.end();
  transformStreamCache.clear();
}
