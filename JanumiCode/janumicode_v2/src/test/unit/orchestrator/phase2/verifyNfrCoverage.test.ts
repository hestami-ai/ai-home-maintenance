/**
 * Unit tests for Phase 2.2c NFR coverage verifier.
 */

import { describe, it, expect } from 'vitest';
import {
  verifyNfrCoverage,
  type NfrCoverageVerifierInputs,
  type NfrSkeleton,
} from '../../../../lib/orchestrator/phases/phase2/verifyNfrCoverage';
import type { VVRequirement, ExtractedItem, TechnicalConstraint, UserJourney } from '../../../../lib/types/records';

function vv(id: string): VVRequirement {
  return { id, category: 'performance', target: 't', measurement: 'm' };
}
function comp(id: string): ExtractedItem {
  return { id, type: 'REQUIREMENT', text: 'x', timestamp: '2026-01-01T00:00:00Z' };
}
function tech(id: string): TechnicalConstraint {
  return { id, category: 'backend', text: 'x' };
}
function journey(id: string): UserJourney {
  return {
    id, title: id, scenario: 's', personaId: 'P-1',
    acceptanceCriteria: [], implementationPhase: 'Phase 1',
    steps: [{ stepNumber: 1, actor: 'P-1', action: 'a', expectedOutcome: 'o' }],
  };
}
function nfr(opts: Partial<NfrSkeleton> & { id: string }): NfrSkeleton {
  return {
    category: 'performance',
    description: 'd',
    priority: 'high',
    traces_to: ['VV-1'],
    threshold: 'p95 < 1s',
    measurement_method: 'Prometheus histogram',
    ...opts,
  };
}
function base(p: Partial<NfrCoverageVerifierInputs> = {}): NfrCoverageVerifierInputs {
  return {
    vvRequirements: p.vvRequirements ?? [],
    qualityAttributesCount: p.qualityAttributesCount ?? 0,
    technicalConstraints: p.technicalConstraints ?? [],
    complianceItems: p.complianceItems ?? [],
    journeys: p.journeys ?? [],
    acceptedFrIds: p.acceptedFrIds ?? [],
    nfrs: p.nfrs ?? [],
    unreachedSeeds: p.unreachedSeeds,
  };
}

describe('verifyNfrCoverage — VV coverage', () => {
  it('passes when every VV is traced', () => {
    const r = verifyNfrCoverage(base({
      vvRequirements: [vv('VV-1'), vv('VV-2')],
      nfrs: [nfr({ id: 'NFR-001', traces_to: ['VV-1'] }), nfr({ id: 'NFR-002', traces_to: ['VV-2'] })],
    }));
    expect(r.filter(g => g.check === 'vv_nfr_coverage')).toHaveLength(0);
  });
  it('flags a silently-dropped VV', () => {
    const r = verifyNfrCoverage(base({
      vvRequirements: [vv('VV-1'), vv('VV-2')],
      nfrs: [nfr({ id: 'NFR-001', traces_to: ['VV-1'] })],
    }));
    const g = r.find(x => x.check === 'vv_nfr_coverage');
    expect(g).toBeDefined();
    expect(g!.severity).toBe('blocking');
    expect(g!.missing).toEqual(['VV-2']);
  });
  it('accepts absorbed-via unreached_seeds', () => {
    const r = verifyNfrCoverage(base({
      vvRequirements: [vv('VV-1'), vv('VV-2')],
      nfrs: [nfr({ id: 'NFR-001', traces_to: ['VV-1'] })],
      unreachedSeeds: [{ seed_id: 'VV-2', absorbed_into: 'NFR-001', reason: 'folded' }],
    }));
    expect(r.filter(g => g.check === 'vv_nfr_coverage')).toHaveLength(0);
  });
});

describe('verifyNfrCoverage — compliance coverage', () => {
  it('flags a silently-dropped compliance item', () => {
    const r = verifyNfrCoverage(base({
      complianceItems: [comp('COMP-1')],
      nfrs: [nfr({ id: 'NFR-001', traces_to: ['VV-1'] })],
      vvRequirements: [vv('VV-1')],
    }));
    const g = r.find(x => x.check === 'compliance_nfr_coverage');
    expect(g).toBeDefined();
    expect(g!.missing).toEqual(['COMP-1']);
  });
});

describe('verifyNfrCoverage — FR-id leakage', () => {
  it('flags US-* ids in traces_to', () => {
    const r = verifyNfrCoverage(base({
      vvRequirements: [vv('VV-1')],
      nfrs: [nfr({ id: 'NFR-001', traces_to: ['VV-1', 'US-005'] })],
    }));
    const g = r.find(x => x.check === 'nfr_traces_to_fr_leakage');
    expect(g).toBeDefined();
    expect(g!.missing).toEqual(['NFR-001:US-005']);
  });
});

describe('verifyNfrCoverage — traces referential', () => {
  it('flags dangling refs', () => {
    const r = verifyNfrCoverage(base({
      vvRequirements: [vv('VV-1')],
      technicalConstraints: [tech('TECH-1')],
      complianceItems: [comp('COMP-1')],
      journeys: [journey('UJ-1')],
      qualityAttributesCount: 3,
      nfrs: [nfr({
        id: 'NFR-001',
        traces_to: ['VV-99', 'TECH-99', 'COMP-99', 'UJ-99', 'QA-9'],
      })],
    }));
    const g = r.find(x => x.check === 'nfr_traces_to_dangling');
    expect(g).toBeDefined();
    expect(g!.missing).toEqual([
      'NFR-001:COMP-99',
      'NFR-001:QA-9',
      'NFR-001:TECH-99',
      'NFR-001:UJ-99',
      'NFR-001:VV-99',
    ]);
  });
  it('accepts valid QA-# within range', () => {
    const r = verifyNfrCoverage(base({
      vvRequirements: [vv('VV-1')],
      qualityAttributesCount: 3,
      nfrs: [nfr({ id: 'NFR-001', traces_to: ['VV-1', 'QA-2'] })],
    }));
    expect(r.filter(g => g.check === 'nfr_traces_to_dangling')).toHaveLength(0);
  });
});

describe('verifyNfrCoverage — applies_to_requirements', () => {
  it('flags unknown FR ids', () => {
    const r = verifyNfrCoverage(base({
      vvRequirements: [vv('VV-1')],
      acceptedFrIds: ['US-001'],
      nfrs: [nfr({ id: 'NFR-001', applies_to_requirements: ['US-001', 'US-GHOST'] })],
    }));
    const g = r.find(x => x.check === 'nfr_applies_to_requirements_dangling');
    expect(g).toBeDefined();
    expect(g!.missing).toEqual(['NFR-001:US-GHOST']);
  });
});

describe('verifyNfrCoverage — threshold presence', () => {
  it('flags missing threshold or measurement_method', () => {
    const r = verifyNfrCoverage(base({
      vvRequirements: [vv('VV-1')],
      nfrs: [
        nfr({ id: 'NFR-001', threshold: '' }),
        nfr({ id: 'NFR-002', measurement_method: '' }),
      ],
    }));
    const g = r.find(x => x.check === 'nfr_threshold_presence');
    expect(g).toBeDefined();
    expect(g!.missing).toEqual(['NFR-001:no-threshold', 'NFR-002:no-measurement-method']);
  });
});

describe('verifyNfrCoverage — id uniqueness', () => {
  it('flags duplicates', () => {
    const r = verifyNfrCoverage(base({
      vvRequirements: [vv('VV-1')],
      nfrs: [nfr({ id: 'NFR-001' }), nfr({ id: 'NFR-001' })],
    }));
    const g = r.find(x => x.check === 'nfr_id_uniqueness');
    expect(g).toBeDefined();
    expect(g!.missing).toEqual(['NFR-001:x2']);
  });
});

describe('verifyNfrCoverage — clean pass', () => {
  it('returns empty for consistent NFR set', () => {
    const r = verifyNfrCoverage(base({
      vvRequirements: [vv('VV-1')],
      complianceItems: [comp('COMP-1')],
      acceptedFrIds: ['US-001'],
      nfrs: [nfr({
        id: 'NFR-001',
        traces_to: ['VV-1', 'COMP-1'],
        applies_to_requirements: ['US-001'],
      })],
    }));
    expect(r).toHaveLength(0);
  });
});
