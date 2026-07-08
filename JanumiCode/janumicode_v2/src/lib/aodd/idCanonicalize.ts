/**
 * Canonical ID stringification for AODD.
 *
 * Per design memo §3: the canonical form of `phase_id` is the bare
 * `PhaseId` string (`"1"`, `"0.5"`, `"10"`). Decorated forms exist only
 * for filesystem use (safe characters, lexical sort) and are derived
 * here at the writer boundary.
 *
 * This module replaces three ad-hoc renderings currently scattered
 * across the codebase (auditPause.ts, llmCaller.ts buildLogFilenamePrefix,
 * and lifecycle.ts's pass-through). Those writers should call
 * `phaseIdToFilenameSegment()` instead of rolling their own.
 */

import type { PhaseId } from '../types/records';

export interface PhaseIdSegmentOptions {
  /**
   * When true, each dot-separated component is zero-padded to two
   * digits. Used by writers that want lexical sort to match numerical
   * order (e.g. invocation log filenames where "phase02" must sort
   * before "phase10").
   *
   * Examples (padded: true):
   *   "0"   → "phase00"
   *   "0.5" → "phase00_5"
   *   "1"   → "phase01"
   *   "10"  → "phase10"
   *
   * Examples (padded: false):
   *   "0"   → "phase0"
   *   "0.5" → "phase0_5"
   *   "1"   → "phase1"
   *   "10"  → "phase10"
   */
  padded?: boolean;
}

/**
 * Render a PhaseId for filesystem use. Replaces `.` with `_` so the
 * segment is safe in any path.
 *
 * Callers that need raw greppable IDs (event payloads, summary JSON,
 * lifecycle records) should use the PhaseId directly — do not pass it
 * through this function.
 */
export function phaseIdToFilenameSegment(
  id: PhaseId,
  options: PhaseIdSegmentOptions = {},
): string {
  const padded = options.padded ?? false;
  const parts = id.split('.');
  const rendered = padded
    ? parts.map((p) => p.padStart(2, '0')).join('_')
    : parts.join('_');
  return `phase${rendered}`;
}

/**
 * Sanitize a free-form sub_phase_id for filesystem use. Replaces
 * anything outside [A-Za-z0-9_] with `_`. Idempotent.
 */
export function subPhaseIdToFilenameSegment(id: string): string {
  return id.replace(/\W/g, '_');
}
