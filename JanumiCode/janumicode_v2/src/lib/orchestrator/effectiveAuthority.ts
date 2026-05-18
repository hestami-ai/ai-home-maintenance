/**
 * Effective Authority Level — recomputed at read time per spec §3.1.
 *
 * A record's stored `authority_level` reflects its level at write time.
 * Subsequent governance events (phase gate certification, supersession,
 * elevation to constitutional status) shift its *effective* authority
 * without mutating the original row. Consumers (DMR materiality scoring,
 * context-packet constraint extraction) read the effective level so the
 * stream stays append-only.
 *
 * Elevation rules currently implemented:
 *   - record_type === 'constitutional_invariant'  → 7 (spec §3.1 row 7)
 *   - record.id is the target of a `validates` edge whose source is a
 *     `phase_gate_approved` record                 → max(stored, 6)
 *     (spec §3.1 row 6 + §8.12 Stage II)
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import type { Database } from '../database/init';

export interface CandidateRecordRef {
  id: string;
  record_type: string;
  authority_level: number;
}

/**
 * Precomputed set of artifact record IDs that have been phase-gate-certified.
 *
 * Built once per DMR research() invocation by traversing `validates` edges
 * whose source is a `phase_gate_approved` record. Pass to
 * effectiveAuthorityLevel() per candidate.
 */
export interface AuthorityElevationIndex {
  certifiedIds: Set<string>;
}

export function buildAuthorityElevationIndex(db: Database): AuthorityElevationIndex {
  const certifiedIds = new Set<string>();
  try {
    const rows = db.prepare(`
      SELECT me.target_record_id AS target
      FROM memory_edge me
      JOIN governed_stream gs ON gs.id = me.source_record_id
      WHERE me.edge_type = 'validates'
        AND gs.record_type = 'phase_gate_approved'
        AND gs.is_current_version = 1
    `).all() as Array<{ target: string }>;
    for (const r of rows) certifiedIds.add(r.target);
  } catch {
    // memory_edge table missing or schema drift — degrade silently. Effective
    // authority falls back to stored level, which is the conservative answer.
  }
  return { certifiedIds };
}

export function effectiveAuthorityLevel(
  record: CandidateRecordRef,
  index: AuthorityElevationIndex,
): number {
  if (record.record_type === 'constitutional_invariant') return 7;
  const stored = record.authority_level ?? 2;
  if (index.certifiedIds.has(record.id) && stored < 6) return 6;
  return stored;
}
