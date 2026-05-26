import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase0VocabularyCollisionCheckContract, type CollisionRiskReportArtifact } from './phase0-vocabulary-collision-check.contract';
import ideal from './fixtures/phase0-collision-risk-report.ideal.json' assert { type: 'json' };

describe('Phase 0.2 vocabulary_collision_check contract — forward', () => {
  it('ideal (empty collisions) passes', () => {
    const results = runContractSuite(
      phase0VocabularyCollisionCheckContract,
      ideal as unknown as CollisionRiskReportArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-0.2.3 when has_high_risk mismatches actual collisions', () => {
    const broken: CollisionRiskReportArtifact = {
      kind: 'collision_risk_report',
      collisions: [{ term: 'slug', severity: 'HIGH', description: 'collides with existing' }],
      has_high_risk: false,
    };
    const results = runContractSuite(phase0VocabularyCollisionCheckContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-0.2.3');
    expect(f?.passed).toBe(false);
  });
});
