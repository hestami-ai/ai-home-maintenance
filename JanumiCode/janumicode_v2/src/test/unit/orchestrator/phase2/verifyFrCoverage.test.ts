/**
 * Unit tests for Phase 2.1c FR coverage verifier.
 */

import { describe, it, expect } from 'vitest';
import {
  verifyFrCoverage,
  type FrCoverageVerifierInputs,
  type UserStorySkeleton,
} from '../../../../lib/orchestrator/phases/phase2/verifyFrCoverage';
import type { UserJourney, WorkflowV2, Entity, ExtractedItem, VocabularyTerm } from '../../../../lib/types/records';

function journey(id: string): UserJourney {
  return {
    id,
    title: id,
    scenario: 's',
    personaId: 'P-1',
    acceptanceCriteria: ['ok'],
    implementationPhase: 'Phase 1',
    steps: [{ stepNumber: 1, actor: 'P-1', action: 'a', expectedOutcome: 'o' }],
  } as UserJourney;
}
function entity(id: string): Entity {
  return { id, businessDomainId: 'DOM-X', name: id, description: 'x', keyAttributes: [], relationships: [] };
}
function workflow(id: string): WorkflowV2 {
  return {
    id, name: id, description: 'd', businessDomainId: 'DOM-X',
    steps: [{ stepNumber: 1, actor: 'System', action: 'a', expectedOutcome: 'o' }],
    triggers: [{ kind: 'schedule', cadence: 'daily' }],
    actors: ['System'], backs_journeys: [],
  } as WorkflowV2;
}
function compItem(id: string): ExtractedItem {
  return { id, type: 'REQUIREMENT', text: 'x', timestamp: '2026-01-01T00:00:00Z' };
}
function vocab(id: string): VocabularyTerm {
  return { id, term: id, definition: 'x', synonyms: [] };
}
function story(opts: Partial<UserStorySkeleton> & { id: string }): UserStorySkeleton {
  return {
    role: 'Homeowner',
    action: 'do thing',
    outcome: 'value',
    priority: 'high',
    traces_to: opts.traces_to ?? ['UJ-A'],
    acceptance_criteria: opts.acceptance_criteria ?? [
      { id: 'AC-001', description: 'd', measurable_condition: 'does X when Y' },
    ],
    ...opts,
  };
}

function baseInputs(p: Partial<FrCoverageVerifierInputs> = {}): FrCoverageVerifierInputs {
  return {
    journeys: p.journeys ?? [],
    entities: p.entities ?? [],
    workflows: p.workflows ?? [],
    complianceItems: p.complianceItems ?? [],
    vocabulary: p.vocabulary ?? [],
    openQuestionIds: p.openQuestionIds ?? [],
    userStories: p.userStories ?? [],
    unreachedJourneys: p.unreachedJourneys,
  };
}

describe('verifyFrCoverage — journey coverage', () => {
  it('passes when every accepted journey is traced by some FR', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A'), journey('UJ-B')],
      userStories: [
        story({ id: 'US-001', traces_to: ['UJ-A'] }),
        story({ id: 'US-002', traces_to: ['UJ-B'] }),
      ],
    }));
    expect(r.filter(g => g.check === 'journey_fr_coverage')).toHaveLength(0);
  });

  it('reports a blocking gap when a journey is silently dropped', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A'), journey('UJ-B')],
      userStories: [story({ id: 'US-001', traces_to: ['UJ-A'] })],
    }));
    const gap = r.find(g => g.check === 'journey_fr_coverage');
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe('blocking');
    expect(gap!.missing).toEqual(['UJ-B']);
  });

  it('does not flag a journey that is declared in unreached_journeys[]', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A'), journey('UJ-B')],
      userStories: [story({ id: 'US-001', traces_to: ['UJ-A'] })],
      unreachedJourneys: [{ journey_id: 'UJ-B', reason: 'covered by US-001 sibling scope' }],
    }));
    expect(r.filter(g => g.check === 'journey_fr_coverage')).toHaveLength(0);
  });
});

describe('verifyFrCoverage — unreached_journeys integrity', () => {
  it('flags declarations referencing non-accepted journeys', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A')],
      userStories: [story({ id: 'US-001', traces_to: ['UJ-A'] })],
      unreachedJourneys: [{ journey_id: 'UJ-GHOST', reason: 'rationale' }],
    }));
    const gap = r.find(g => g.check === 'unreached_journeys_integrity');
    expect(gap).toBeDefined();
    expect(gap!.missing).toContain('UJ-GHOST:not-accepted');
  });
  it('flags declarations with empty reason', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A'), journey('UJ-B')],
      userStories: [story({ id: 'US-001', traces_to: ['UJ-A'] })],
      unreachedJourneys: [{ journey_id: 'UJ-B', reason: '  ' }],
    }));
    const gap = r.find(g => g.check === 'unreached_journeys_integrity');
    expect(gap).toBeDefined();
    expect(gap!.missing).toContain('UJ-B:empty-reason');
  });
});

describe('verifyFrCoverage — traces_to referential integrity', () => {
  it('flags unknown id prefixes', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A')],
      userStories: [story({ id: 'US-001', traces_to: ['UJ-A', 'FOO-1'] })],
    }));
    const gap = r.find(g => g.check === 'traces_to_unknown_prefix');
    expect(gap).toBeDefined();
    expect(gap!.missing).toEqual(['US-001:FOO-1']);
  });
  it('flags dangling UJ/ENT/WF/COMP/VOC refs', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A')],
      entities: [entity('ENT-P')],
      workflows: [workflow('WF-1')],
      complianceItems: [compItem('COMP-GDPR')],
      vocabulary: [vocab('VOC-assessment')],
      userStories: [story({
        id: 'US-001',
        traces_to: ['UJ-A', 'ENT-MISSING', 'WF-MISSING', 'COMP-MISSING', 'VOC-MISSING'],
      })],
    }));
    const gap = r.find(g => g.check === 'traces_to_dangling');
    expect(gap).toBeDefined();
    expect(gap!.missing).toEqual([
      'US-001:COMP-MISSING',
      'US-001:ENT-MISSING',
      'US-001:VOC-MISSING',
      'US-001:WF-MISSING',
    ]);
  });
  it('accepts OPEN-/Q- refs when listed in openQuestionIds', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A')],
      openQuestionIds: ['OPEN-42', 'Q-7'],
      userStories: [story({ id: 'US-001', traces_to: ['UJ-A', 'OPEN-42', 'Q-7'] })],
    }));
    expect(r.filter(g => g.check === 'traces_to_dangling')).toHaveLength(0);
  });
});

describe('verifyFrCoverage — AC presence', () => {
  it('flags FRs with no ACs at all', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A')],
      userStories: [story({ id: 'US-001', acceptance_criteria: [] })],
    }));
    const gap = r.find(g => g.check === 'ac_presence');
    expect(gap).toBeDefined();
    expect(gap!.missing).toContain('US-001:no-acs');
    expect(gap!.severity).toBe('blocking');
  });
  it('flags FRs whose ACs have no measurable_condition', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A')],
      userStories: [story({
        id: 'US-001',
        acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: '' }],
      })],
    }));
    const gap = r.find(g => g.check === 'ac_presence');
    expect(gap).toBeDefined();
    expect(gap!.missing).toContain('US-001:no-measurable-condition');
  });
});

describe('verifyFrCoverage — id uniqueness', () => {
  it('flags duplicate FR ids', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A')],
      userStories: [
        story({ id: 'US-001', traces_to: ['UJ-A'] }),
        story({ id: 'US-001', traces_to: ['UJ-A'] }),
      ],
    }));
    const gap = r.find(g => g.check === 'fr_id_uniqueness');
    expect(gap).toBeDefined();
    expect(gap!.missing).toEqual(['US-001:x2']);
  });
});

describe('verifyFrCoverage — empty traces advisory', () => {
  it('flags FRs with empty traces_to as advisory', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A')],
      userStories: [story({ id: 'US-001', traces_to: [] })],
      // journey-coverage gap will also exist; we only care about the traces_to one here.
    }));
    const gap = r.find(g => g.check === 'traces_to_non_empty');
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe('advisory');
    expect(gap!.missing).toEqual(['US-001']);
  });
});

describe('verifyFrCoverage — clean pass', () => {
  it('returns empty array for a fully-consistent FR set', () => {
    const r = verifyFrCoverage(baseInputs({
      journeys: [journey('UJ-A')],
      entities: [entity('ENT-P')],
      userStories: [story({
        id: 'US-001',
        traces_to: ['UJ-A', 'ENT-P'],
      })],
    }));
    expect(r).toHaveLength(0);
  });
});
