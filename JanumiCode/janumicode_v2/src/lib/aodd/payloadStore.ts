/**
 * Sidecar payload store for AODD events.
 *
 * Per design memo §2.3: when an event payload would carry a structured
 * body larger than 4 KB OR a free-form text field larger than 1 KB,
 * spill the content to a file under
 *   runs/<run_id>/aodd/payloads/<ulid>.{json,txt}
 * and emit a `PayloadRef` in the event line instead.
 *
 * The thresholds are tunable via env vars but default to the design-
 * memo values. Pruning of payloads happens with the parent run during
 * retention (no separate lifecycle).
 *
 * P1 status: structured-payload spill is wired; text-payload spill is
 * exposed via the same helper. The threshold decision lives at the
 * caller — callers know whether a value is structured or free-form
 * text. We do not auto-classify here.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { mintUlid } from './ulid';
import type { PayloadRef } from './types';

const STRUCTURED_INLINE_THRESHOLD_BYTES = Number.parseInt(
  process.env.JANUMICODE_AODD_STRUCTURED_THRESHOLD ?? '4096',
  10,
);
const TEXT_INLINE_THRESHOLD_BYTES = Number.parseInt(
  process.env.JANUMICODE_AODD_TEXT_THRESHOLD ?? '1024',
  10,
);

/**
 * Decide whether a structured (JSON-serializable) value should be
 * spilled to a payload file. Caller has already serialized the value;
 * we measure bytes only.
 */
export function shouldSpillStructured(byteLength: number): boolean {
  return byteLength > STRUCTURED_INLINE_THRESHOLD_BYTES;
}

/**
 * Decide whether a free-form text value should be spilled. The text
 * threshold is intentionally tighter because text payloads tend to be
 * the heaviest (LLM prompts, model responses, reasoning chains).
 */
export function shouldSpillText(byteLength: number): boolean {
  return byteLength > TEXT_INLINE_THRESHOLD_BYTES;
}

interface PayloadStoreConfig {
  workspaceRoot: string;
  runId: string;
}

let config: PayloadStoreConfig | null = null;

/**
 * Bind the payload store to a workspace + run. Called by emit.startRun().
 * Calling configurePayloadStore(null) clears the binding (emit.endRun()).
 */
export function configurePayloadStore(c: PayloadStoreConfig | null): void {
  config = c;
}

function payloadsDir(): string | null {
  if (!config) return null;
  return path.join(
    config.workspaceRoot,
    '.janumicode',
    'runs',
    config.runId,
    'aodd',
    'payloads',
  );
}

function ensurePayloadsDir(): string | null {
  const dir = payloadsDir();
  if (!dir) return null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (err) {
    process.stderr.write(
      `[aodd] WARN: failed to create payloads dir for ${config?.runId}: ` +
        `${err instanceof Error ? err.message : String(err)}\n`,
    );
    return null;
  }
}

/**
 * Spill a structured (JSON-serializable) payload to disk. Returns a
 * PayloadRef on success; returns null if the store isn't configured or
 * the write fails (caller should inline the payload as a fallback).
 */
export function writeStructuredPayload(value: unknown): PayloadRef | null {
  const dir = ensurePayloadsDir();
  if (!dir) return null;
  const ulid = mintUlid();
  const filepath = path.join(dir, `${ulid}.json`);
  const serialized = JSON.stringify(value);
  try {
    fs.writeFileSync(filepath, serialized, { encoding: 'utf8' });
    return {
      payload_ref: ulid,
      bytes: Buffer.byteLength(serialized, 'utf8'),
      kind: 'json',
    };
  } catch (err) {
    process.stderr.write(
      `[aodd] WARN: failed to write structured payload ${ulid}: ` +
        `${err instanceof Error ? err.message : String(err)}\n`,
    );
    return null;
  }
}

/**
 * Spill a free-form text payload to disk. Returns a PayloadRef on
 * success; returns null on failure.
 */
export function writeTextPayload(value: string): PayloadRef | null {
  const dir = ensurePayloadsDir();
  if (!dir) return null;
  const ulid = mintUlid();
  const filepath = path.join(dir, `${ulid}.txt`);
  try {
    fs.writeFileSync(filepath, value, { encoding: 'utf8' });
    return {
      payload_ref: ulid,
      bytes: Buffer.byteLength(value, 'utf8'),
      kind: 'text',
    };
  } catch (err) {
    process.stderr.write(
      `[aodd] WARN: failed to write text payload ${ulid}: ` +
        `${err instanceof Error ? err.message : String(err)}\n`,
    );
    return null;
  }
}

/**
 * Adaptive text payload helper. Used at AODD emit sites that may carry
 * heavy free-form text (prompts, model output, reasoning chains).
 * When the text fits the inline threshold, returns it verbatim;
 * otherwise spills to the sidecar store and returns a `PayloadRef`. On
 * spill failure, falls back to inline (better to have the text in the
 * event line than to lose it).
 */
export function maybeSpillText(s: string): string | PayloadRef {
  const bytes = Buffer.byteLength(s, 'utf8');
  if (!shouldSpillText(bytes)) return s;
  return writeTextPayload(s) ?? s;
}

/**
 * Read a payload by reference (used by replay tooling). Returns null
 * when the store isn't bound or the file doesn't exist.
 */
export function readPayload(
  workspaceRoot: string,
  runId: string,
  ref: PayloadRef,
): string | null {
  const filepath = path.join(
    workspaceRoot,
    '.janumicode',
    'runs',
    runId,
    'aodd',
    'payloads',
    `${ref.payload_ref}.${ref.kind === 'json' ? 'json' : 'txt'}`,
  );
  try {
    return fs.readFileSync(filepath, { encoding: 'utf8' });
  } catch {
    return null;
  }
}
