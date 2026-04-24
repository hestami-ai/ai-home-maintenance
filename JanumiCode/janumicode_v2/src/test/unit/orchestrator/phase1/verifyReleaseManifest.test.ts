/**
 * Unit tests for Phase 1.8 widened release-manifest verifier.
 */

import { describe, it, expect } from 'vitest';
import { verifyReleaseManifest, type ReleaseManifestVerifierInputs } from '../../../../lib/orchestrator/phases/phase1/verifyReleaseManifest';
import type { ReleasePlanContentV2, UserJourney, WorkflowV2, Integration, VocabularyTerm } from '../../../../lib/types/records';

function emptyContains() {
  return { journeys: [], workflows: [], entities: [], compliance: [], integrations: [], vocabulary: [] };
}
function emptyCrossCutting() {
  return { workflows: [], compliance: [], integrations: [], vocabulary: [] };
}
function plan(partial?: Partial<ReleasePlanContentV2>): ReleasePlanContentV2 {
  return {
    kind: 'release_plan',
    schemaVersion: '2.0',
    releases: [{
      release_id: 'REL-1', ordinal: 1, name: 'R1', description: 'd', rationale: 'r',
      contains: emptyContains(),
    }],
    cross_cutting: emptyCrossCutting(),
    approved: false,
    ...partial,
  };
}
function journey(id: string, personaId = 'P-1'): UserJourney {
  return {
    id, personaId, title: 't', scenario: 's', steps: [], acceptanceCriteria: [], implementationPhase: 'Phase 1',
  };
}
function workflow(opts: { id: string; triggers?: WorkflowV2['triggers']; backs_journeys?: string[] }): WorkflowV2 {
  return {
    id: opts.id, businessDomainId: 'DOM-X', name: 'W', description: 'd',
    steps: [], triggers: opts.triggers ?? [{ kind: 'schedule', cadence: 'daily' }],
    actors: [], backs_journeys: opts.backs_journeys ?? [],
  };
}
function integration(id: string): Integration {
  return { id, name: id, category: 'generic', description: 'x', standardProviders: [], ownershipModel: 'consumed', rationale: 'x' };
}
function voc(id: string): VocabularyTerm {
  return { id, term: id, definition: 'x' };
}

function inputs(partial: Partial<ReleaseManifestVerifierInputs> = {}): ReleaseManifestVerifierInputs {
  return {
    plan: partial.plan ?? plan(),
    journeys: partial.journeys ?? [],
    workflows: partial.workflows ?? [],
    entityIds: partial.entityIds ?? [],
    complianceIds: partial.complianceIds ?? [],
    integrations: partial.integrations ?? [],
    vocabulary: partial.vocabulary ?? [],
  };
}

describe('verifyReleaseManifest — ordinal integrity', () => {
  it('passes on contiguous 1-based ordinals', () => {
    const p = plan({
      releases: [
        { release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r', contains: emptyContains() },
        { release_id: 'REL-2', ordinal: 2, name: 'B', description: 'd', rationale: 'r', contains: emptyContains() },
      ],
    });
    const r = verifyReleaseManifest(inputs({ plan: p }));
    expect(r.find(g => g.check === 'release_ordinal_integrity')).toBeUndefined();
  });
  it('reports gap on ordinal gap', () => {
    const p = plan({
      releases: [
        { release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r', contains: emptyContains() },
        { release_id: 'REL-3', ordinal: 3, name: 'C', description: 'd', rationale: 'r', contains: emptyContains() },
      ],
    });
    const r = verifyReleaseManifest(inputs({ plan: p }));
    expect(r.find(g => g.check === 'release_ordinal_integrity')).toBeDefined();
  });
});

describe('verifyReleaseManifest — exact coverage', () => {
  it('reports gap when a journey is missing from the plan', () => {
    const r = verifyReleaseManifest(inputs({
      journeys: [journey('UJ-1')],
      // plan has empty releases
    }));
    const gap = r.find(g => g.check === 'release_exact_coverage_journeys');
    expect(gap).toBeDefined();
    expect(gap!.missing).toEqual(['UJ-1']);
  });
  it('reports double-count when workflow appears in both a release and cross_cutting', () => {
    const p = plan({
      releases: [{ release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r', contains: { ...emptyContains(), workflows: ['WF-1'] } }],
      cross_cutting: { ...emptyCrossCutting(), workflows: ['WF-1'] },
    });
    const r = verifyReleaseManifest(inputs({ plan: p, workflows: [workflow({ id: 'WF-1' })] }));
    const gap = r.find(g => g.check === 'release_exact_coverage_workflows_double_count');
    expect(gap).toBeDefined();
  });
  it('passes when every artifact type is exactly covered', () => {
    const p = plan({
      releases: [{
        release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r',
        contains: { journeys: ['UJ-1'], workflows: ['WF-1'], entities: ['ENT-A'], compliance: ['COMP-A'], integrations: ['INT-A'], vocabulary: ['VOC-A'] },
      }],
    });
    const r = verifyReleaseManifest(inputs({
      plan: p,
      journeys: [journey('UJ-1')],
      workflows: [workflow({ id: 'WF-1' })],
      entityIds: ['ENT-A'],
      complianceIds: ['COMP-A'],
      integrations: [integration('INT-A')],
      vocabulary: [voc('VOC-A')],
    }));
    expect(r.filter(g => g.severity === 'blocking')).toHaveLength(0);
  });
});

describe('verifyReleaseManifest — backward dependencies', () => {
  it('reports backward dep when workflow in REL-1 triggers off a journey in REL-2', () => {
    const p = plan({
      releases: [
        { release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), workflows: ['WF-1'] } },
        { release_id: 'REL-2', ordinal: 2, name: 'B', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-2'] } },
      ],
    });
    const r = verifyReleaseManifest(inputs({
      plan: p,
      journeys: [journey('UJ-2')],
      workflows: [workflow({ id: 'WF-1', triggers: [{ kind: 'journey_step', journey_id: 'UJ-2', step_number: 1 }], backs_journeys: ['UJ-2'] })],
    }));
    expect(r.find(g => g.check === 'release_backward_dependency')).toBeDefined();
  });
  it('passes when a cross_cutting workflow triggers off cross_cutting compliance', () => {
    const p = plan({
      releases: [{ release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r', contains: emptyContains() }],
      cross_cutting: { ...emptyCrossCutting(), workflows: ['WF-1'], compliance: ['COMP-A'] },
    });
    const r = verifyReleaseManifest(inputs({
      plan: p,
      workflows: [workflow({ id: 'WF-1', triggers: [{ kind: 'compliance', regime_id: 'COMP-A', rule: 'x' }] })],
      complianceIds: ['COMP-A'],
    }));
    expect(r.find(g => g.check === 'release_backward_dependency')).toBeUndefined();
  });
});

describe('verifyReleaseManifest — trace coherence (advisory)', () => {
  it('advises when a release-specific workflow backs journeys in multiple releases', () => {
    const p = plan({
      releases: [
        { release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-1'], workflows: ['WF-1'] } },
        { release_id: 'REL-2', ordinal: 2, name: 'B', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-2'] } },
      ],
    });
    // WF-1 is in REL-1 but backs both UJ-1 (REL-1) and UJ-2 (REL-2) via triggers.
    // Note: this scenario is illegal under backward-dep check too; for pure coherence, use an earlier release.
    // Construct a legal-but-smelly case: WF-1 in REL-2 backs UJ-1 (REL-1) AND UJ-2 (REL-2) — forward-OK but multi-release backing.
    const pLegal = plan({
      releases: [
        { release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-1'] } },
        { release_id: 'REL-2', ordinal: 2, name: 'B', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-2'], workflows: ['WF-1'] } },
      ],
    });
    const r = verifyReleaseManifest(inputs({
      plan: pLegal,
      journeys: [journey('UJ-1'), journey('UJ-2')],
      workflows: [workflow({ id: 'WF-1', triggers: [
        { kind: 'journey_step', journey_id: 'UJ-1', step_number: 1 },
        { kind: 'journey_step', journey_id: 'UJ-2', step_number: 1 },
      ], backs_journeys: ['UJ-1', 'UJ-2'] })],
    }));
    // Silence unused-binding warning for the smelly-illegal plan we construct but don't assert on.
    void p;
    const gap = r.find(g => g.check === 'release_trace_coherence');
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe('advisory');
  });
});
