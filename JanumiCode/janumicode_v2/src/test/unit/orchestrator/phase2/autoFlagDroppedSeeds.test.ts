/**
 * Unit tests for Phase 2.2 deterministic auto-flagger.
 */

import { describe, it, expect } from 'vitest';
import {
  autoFlagDroppedSeeds,
  SYSTEM_INFERRED_ABSORBED_INTO,
} from '../../../../lib/orchestrator/phases/phase2/autoFlagDroppedSeeds';
import type { NfrSkeleton, UnreachedSeedDeclaration } from '../../../../lib/orchestrator/phases/phase2/verifyNfrCoverage';
import type { VVRequirement, ExtractedItem } from '../../../../lib/types/records';

function vv(id: string): VVRequirement {
  return { id, category: 'performance', target: 't', measurement: 'm' };
}
function comp(id: string): ExtractedItem {
  return { id, type: 'REQUIREMENT', text: 'x', timestamp: '2026-01-01T00:00:00Z' };
}
function nfr(id: string, traces: string[]): NfrSkeleton {
  return {
    id, category: 'performance', description: 'd',
    priority: 'high', traces_to: traces,
    threshold: 'p95 < 1s', measurement_method: 'm',
  };
}

describe('autoFlagDroppedSeeds', () => {
  it('passes through unchanged when every input seed is traced or absorbed', () => {
    const result = autoFlagDroppedSeeds({
      vvRequirements: [vv('VV-1'), vv('VV-2')],
      complianceItems: [comp('COMP-X')],
      nfrs: [nfr('NFR-1', ['VV-1', 'COMP-X'])],
      unreached: [{ seed_id: 'VV-2', absorbed_into: 'NFR-1', reason: 'absorbed' }],
    });
    expect(result.autoFlagged).toEqual([]);
    expect(result.unreached).toHaveLength(1);
  });

  it('flags VV seeds the agent dropped from both traces and unreached', () => {
    const result = autoFlagDroppedSeeds({
      vvRequirements: [vv('VV-1'), vv('VV-LICENSE-MONITORING')],
      complianceItems: [],
      nfrs: [nfr('NFR-1', ['VV-1'])],
      unreached: [],
    });
    expect(result.autoFlagged).toHaveLength(1);
    expect(result.autoFlagged[0]).toMatchObject({
      seed_id: 'VV-LICENSE-MONITORING',
      absorbed_into: SYSTEM_INFERRED_ABSORBED_INTO,
      system_inferred: true,
      source_kind: 'vv',
    });
    expect(result.unreached).toHaveLength(1);
    expect(result.unreached[0].seed_id).toBe('VV-LICENSE-MONITORING');
  });

  it('flags COMP seeds the agent dropped, distinguishing source_kind', () => {
    const result = autoFlagDroppedSeeds({
      vvRequirements: [],
      complianceItems: [comp('COMP-A'), comp('COMP-B')],
      nfrs: [nfr('NFR-1', ['COMP-A'])],
      unreached: [],
    });
    expect(result.autoFlagged).toHaveLength(1);
    expect(result.autoFlagged[0].seed_id).toBe('COMP-B');
    expect(result.autoFlagged[0].source_kind).toBe('compliance');
  });

  it('does not double-flag when a seed is in both traces and unreached', () => {
    // Defensive — the agent shouldn't do this, but if it does, no flag.
    const result = autoFlagDroppedSeeds({
      vvRequirements: [vv('VV-1')],
      complianceItems: [],
      nfrs: [nfr('NFR-1', ['VV-1'])],
      unreached: [{ seed_id: 'VV-1', absorbed_into: 'NFR-1', reason: 'r' }],
    });
    expect(result.autoFlagged).toEqual([]);
  });

  it('preserves prior unreached entries in the merged output', () => {
    const prior: UnreachedSeedDeclaration = { seed_id: 'VV-A', absorbed_into: 'NFR-1', reason: 'absorbed' };
    const result = autoFlagDroppedSeeds({
      vvRequirements: [vv('VV-A'), vv('VV-B')],
      complianceItems: [],
      nfrs: [],
      unreached: [prior],
    });
    expect(result.unreached).toHaveLength(2);
    expect(result.unreached[0]).toEqual(prior);
    expect(result.unreached[1].seed_id).toBe('VV-B');
  });

  it('flags multiple dropped seeds across both kinds in one pass', () => {
    const result = autoFlagDroppedSeeds({
      vvRequirements: [vv('VV-1'), vv('VV-2'), vv('VV-3')],
      complianceItems: [comp('COMP-X'), comp('COMP-Y')],
      nfrs: [nfr('NFR-1', ['VV-1', 'COMP-X'])],
      unreached: [],
    });
    expect(result.autoFlagged.map(s => s.seed_id).sort()).toEqual(['COMP-Y', 'VV-2', 'VV-3']);
  });
});
