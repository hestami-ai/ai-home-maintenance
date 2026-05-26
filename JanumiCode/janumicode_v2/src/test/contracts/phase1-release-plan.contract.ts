/**
 * Contract for Phase 1.9 — release_plan (artifact kind: `release_plan`).
 *
 * Release plan v2: per the Phase 1.9 prompt schema, each release carries
 * its contents as FLAT `contains_<axis>` fields (e.g. `contains_journeys`,
 * `contains_workflows`, `contains_user_stories`), not a nested
 * `contains: {...}` object. Cross-cutting items follow the same flat
 * `cross_cutting_<axis>` convention.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface Release {
  release_id: string;
  ordinal: number;
  name: string;
  description?: string;
  rationale?: string;
  /** Flat axis fields. Each is optional; at least one must be populated. */
  contains_journeys?: string[];
  contains_workflows?: string[];
  contains_user_stories?: string[];
  contains_nfrs?: string[];
  contains_vv_requirements?: string[];
  contains_quality_attributes?: string[];
  contains_technical_constraints?: string[];
}

export interface ReleasePlanArtifact {
  kind: 'release_plan';
  schemaVersion?: string;
  releases: Release[];
  cross_cutting_journeys?: string[];
  cross_cutting_workflows?: string[];
  cross_cutting_user_stories?: string[];
  cross_cutting_nfrs?: string[];
  cross_cutting_technical_constraints?: string[];
  approved?: boolean;
}

const PRIMARY_CONTAINS_AXES = [
  'contains_journeys',
  'contains_workflows',
  'contains_user_stories',
  'contains_nfrs',
] as const;

// ── Contract suite ───────────────────────────────────────────────

export const phase1ReleasePlanContract: ContractSuite<ReleasePlanArtifact> = {
  boundaryId: '1.9_release_plan',
  phaseId: '1',
  subPhaseId: 'release_plan',
  producerArtifactKind: 'release_plan',
  description:
    'Phase 1 release plan v2 — releases have unique ordinals, names, and non-empty contains.',
  clauses: [
    {
      id: 'C-1.9.1',
      description: 'release_plan.releases is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.releases) || artifact.releases.length === 0) {
          return { message: 'releases is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-1.9.2',
      description: 'Every release has a non-empty release_id, positive ordinal, and non-empty name.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ idx: number; reason: string }> = [];
        artifact.releases.forEach((r, idx) => {
          if (!r.release_id) bad.push({ idx, reason: 'missing release_id' });
          if (typeof r.ordinal !== 'number' || r.ordinal < 1) bad.push({ idx, reason: `invalid ordinal: ${r.ordinal}` });
          if (!r.name || r.name.trim().length === 0) bad.push({ idx, reason: 'empty name' });
        });
        if (bad.length === 0) return true;
        return { message: `${bad.length} release(s) have invalid identifiers`, details: { bad } };
      },
    },
    {
      id: 'C-1.9.3',
      description: 'Release ordinals are unique.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<number, number>();
        for (const r of artifact.releases) counts.set(r.ordinal, (counts.get(r.ordinal) ?? 0) + 1);
        const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([o]) => o);
        if (dups.length === 0) return true;
        return { message: `duplicate ordinals: ${dups.join(', ')}`, details: { dups } };
      },
    },
    {
      id: 'C-1.9.4',
      description: 'Every release has at least one populated primary axis (contains_journeys / _workflows / _user_stories / _nfrs).',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ releaseId: string }> = [];
        for (const r of artifact.releases) {
          const populated = PRIMARY_CONTAINS_AXES.some((axis) => {
            const v = r[axis];
            return Array.isArray(v) && v.length > 0;
          });
          if (!populated) bad.push({ releaseId: r.release_id });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} release(s) have empty contains_* across all primary axes`, details: { bad } };
      },
    },
    {
      id: 'C-1.9.5',
      description: 'Release ordinals form a contiguous sequence starting from 1.',
      severity: 'advisory',
      check: (artifact) => {
        const sorted = [...artifact.releases].sort((a, b) => a.ordinal - b.ordinal);
        const expected = sorted.map((_, i) => i + 1);
        const actual = sorted.map((r) => r.ordinal);
        const matches = expected.every((e, i) => e === actual[i]);
        if (matches) return true;
        return { message: `ordinals are not contiguous from 1`, details: { actual } };
      },
    },
  ],
};
