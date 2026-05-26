/**
 * Unit tests for `assignReleaseToRoot` (Phase 2 root → release anchor).
 *
 * Covers the ts-13 cross-cutting fallback: a root that traces exclusively
 * into `cross_cutting` (typical for NFR roots tracing only to VV-* / QA-N /
 * TECH-* ids) anchors to Release 1 instead of falling through to Backlog.
 */

import { describe, it, expect } from 'vitest';
import { assignReleaseToRoot } from '../../../../lib/orchestrator/phases/phase2';
import type { ReleasePlanContentV2, ReleaseContents, CrossCuttingContents } from '../../../../lib/types/records';

function emptyContains(): ReleaseContents {
  return {
    journeys: [], workflows: [], entities: [], compliance: [], integrations: [], vocabulary: [],
    vv_requirements: [], quality_attributes: [], technical_constraints: [],
  };
}
function emptyCrossCutting(): CrossCuttingContents {
  return {
    workflows: [], compliance: [], integrations: [], vocabulary: [],
    vv_requirements: [], quality_attributes: [], technical_constraints: [],
  };
}

function plan(opts: {
  releases?: ReleasePlanContentV2['releases'];
  cross_cutting?: CrossCuttingContents;
  approved?: boolean;
} = {}): ReleasePlanContentV2 {
  return {
    kind: 'release_plan',
    schemaVersion: '2.0',
    releases: opts.releases ?? [
      { release_id: 'rel-uuid-1', ordinal: 1, name: 'R1', description: 'd', rationale: 'r', contains: emptyContains() },
      { release_id: 'rel-uuid-2', ordinal: 2, name: 'R2', description: 'd', rationale: 'r', contains: emptyContains() },
    ],
    cross_cutting: opts.cross_cutting ?? emptyCrossCutting(),
    approved: opts.approved ?? true,
  };
}

describe('assignReleaseToRoot — release-specific (Pass 1)', () => {
  it('anchors to the lowest-ordinal release whose contains.journeys intersects traces_to', () => {
    const p = plan({
      releases: [
        { release_id: 'rel-1', ordinal: 1, name: 'R1', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-A'] } },
        { release_id: 'rel-2', ordinal: 2, name: 'R2', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-B'] } },
      ],
    });
    const r = assignReleaseToRoot({ traces_to: ['UJ-B'] }, p);
    expect(r).toEqual({ release_id: 'rel-2', release_ordinal: 2 });
  });

  it('release-specific match wins over cross-cutting fallback', () => {
    const p = plan({
      releases: [
        { release_id: 'rel-1', ordinal: 1, name: 'R1', description: 'd', rationale: 'r', contains: emptyContains() },
        { release_id: 'rel-2', ordinal: 2, name: 'R2', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-X'] } },
      ],
      cross_cutting: { ...emptyCrossCutting(), vv_requirements: ['VV-1'] },
    });
    // traces include BOTH a release-2 journey AND a cross-cutting VV id —
    // release-specific must win, anchoring to release 2 (not the Pass-2
    // fallback to release 1).
    const r = assignReleaseToRoot({ traces_to: ['UJ-X', 'VV-1'] }, p);
    expect(r).toEqual({ release_id: 'rel-2', release_ordinal: 2 });
  });
});

describe('assignReleaseToRoot — cross-cutting fallback to Release 1 (Pass 2, ts-13 fix)', () => {
  it('anchors a VV-only root to Release 1 when VV id is in cross_cutting', () => {
    const p = plan({
      cross_cutting: { ...emptyCrossCutting(), vv_requirements: ['VV-1'] },
    });
    const r = assignReleaseToRoot({ traces_to: ['VV-1'] }, p);
    expect(r).toEqual({ release_id: 'rel-uuid-1', release_ordinal: 1 });
  });

  it('anchors a QA-only root to Release 1 when QA id is in cross_cutting', () => {
    const p = plan({
      cross_cutting: { ...emptyCrossCutting(), quality_attributes: ['QA-1'] },
    });
    const r = assignReleaseToRoot({ traces_to: ['QA-1'] }, p);
    expect(r).toEqual({ release_id: 'rel-uuid-1', release_ordinal: 1 });
  });

  it('anchors a TECH-only root to Release 1 when TECH id is in cross_cutting', () => {
    const p = plan({
      cross_cutting: { ...emptyCrossCutting(), technical_constraints: ['TECH-1'] },
    });
    const r = assignReleaseToRoot({ traces_to: ['TECH-1'] }, p);
    expect(r).toEqual({ release_id: 'rel-uuid-1', release_ordinal: 1 });
  });

  it('anchors a vocabulary-only root to Release 1 (existing cross_cutting slots also covered by Pass 2)', () => {
    const p = plan({
      cross_cutting: { ...emptyCrossCutting(), vocabulary: ['VOC-A'] },
    });
    const r = assignReleaseToRoot({ traces_to: ['VOC-A'] }, p);
    expect(r).toEqual({ release_id: 'rel-uuid-1', release_ordinal: 1 });
  });

  it('anchors a cross-cutting workflow / compliance / integration root to Release 1', () => {
    const p = plan({
      cross_cutting: {
        ...emptyCrossCutting(),
        workflows: ['WF-CC'], compliance: ['COMP-CC'], integrations: ['INT-CC'],
      },
    });
    expect(assignReleaseToRoot({ traces_to: ['WF-CC'] }, p))
      .toEqual({ release_id: 'rel-uuid-1', release_ordinal: 1 });
    expect(assignReleaseToRoot({ traces_to: ['COMP-CC'] }, p))
      .toEqual({ release_id: 'rel-uuid-1', release_ordinal: 1 });
    expect(assignReleaseToRoot({ traces_to: ['INT-CC'] }, p))
      .toEqual({ release_id: 'rel-uuid-1', release_ordinal: 1 });
  });
});

describe('assignReleaseToRoot — Backlog cases', () => {
  it('returns null/null when traces_to is empty', () => {
    const r = assignReleaseToRoot({ traces_to: [] }, plan());
    expect(r).toEqual({ release_id: null, release_ordinal: null });
  });

  it('returns null/null when traces_to is undefined', () => {
    const r = assignReleaseToRoot({}, plan());
    expect(r).toEqual({ release_id: null, release_ordinal: null });
  });

  it('returns null/null when no trace matches any release or cross_cutting', () => {
    const p = plan({
      releases: [
        { release_id: 'rel-1', ordinal: 1, name: 'R1', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-A'] } },
      ],
      cross_cutting: { ...emptyCrossCutting(), vv_requirements: ['VV-OTHER'] },
    });
    const r = assignReleaseToRoot({ traces_to: ['UJ-MISSING', 'VV-MISSING'] }, p);
    expect(r).toEqual({ release_id: null, release_ordinal: null });
  });

  it('returns null/null when plan is null (no release plan at all)', () => {
    const r = assignReleaseToRoot({ traces_to: ['UJ-A'] }, null);
    expect(r).toEqual({ release_id: null, release_ordinal: null });
  });

  it('returns null/null when plan is not approved', () => {
    const p = plan({
      approved: false,
      cross_cutting: { ...emptyCrossCutting(), vv_requirements: ['VV-1'] },
    });
    const r = assignReleaseToRoot({ traces_to: ['VV-1'] }, p);
    expect(r).toEqual({ release_id: null, release_ordinal: null });
  });

  it('defensively returns null/null when plan has zero releases even if a cross_cutting trace matches', () => {
    // A degenerate plan with an empty `releases[]` array but populated
    // cross_cutting cannot anchor anywhere — Pass 2 requires at least one
    // release to use as the anchor.
    const p = plan({
      releases: [],
      cross_cutting: { ...emptyCrossCutting(), vv_requirements: ['VV-1'] },
    });
    const r = assignReleaseToRoot({ traces_to: ['VV-1'] }, p);
    expect(r).toEqual({ release_id: null, release_ordinal: null });
  });
});

describe('assignReleaseToRoot — schema tolerance (ts-13 retro-compat)', () => {
  it('tolerates a cross_cutting object that omits the new VV / QA / TECH slots', () => {
    // Simulates an older release plan written before the ts-13 schema
    // extension — the new fields may be absent from a persisted plan.
    // The assignment must not crash and must fall through to Backlog
    // for a trace into a slot that doesn't exist.
    const cc = { workflows: [], compliance: [], integrations: [], vocabulary: [] } as unknown as CrossCuttingContents;
    const p = plan({ cross_cutting: cc });
    const r = assignReleaseToRoot({ traces_to: ['VV-1'] }, p);
    expect(r).toEqual({ release_id: null, release_ordinal: null });
  });
});
