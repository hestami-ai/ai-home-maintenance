import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1ComplianceRetentionContract, type ComplianceRetentionArtifact } from './phase1-compliance-retention-discovery.contract';
import ideal from './fixtures/phase1-compliance-retention.ideal.json' assert { type: 'json' };

describe('Phase 1.0d compliance_retention_discovery contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1ComplianceRetentionContract,
      ideal as unknown as ComplianceRetentionArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.0d.4 when a downstream consumer cites an unresolved COMP ref', () => {
    const partial: ComplianceRetentionArtifact = {
      kind: 'compliance_retention_discovery',
      compliance_extracted_items: [{ id: 'COMP-A', description: 'x' }],
    };
    // Use a real downstream-consumer artifact kind so the contract's
    // allowlist counts the ref. functional_requirements US.traces_to
    // can carry COMP-* refs.
    const downstream = { user_stories: [{ id: 'US-1', traces_to: ['COMP-MISSING'] }] };
    const context = {
      workflowRunId: 'neg',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['functional_requirements', [downstream]]]),
    };
    const results = runContractSuite(phase1ComplianceRetentionContract, partial, context);
    const f = results.find((r) => r.clauseId === 'C-1.0d.4');
    expect(f?.passed).toBe(false);
  });
});
