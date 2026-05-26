import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase4AdrCaptureContract, type ArchitecturalDecisionsArtifact } from './phase4-adr-capture.contract';
import ideal from './fixtures/phase4-architectural-decisions.ideal.json' assert { type: 'json' };

describe('Phase 4.3 adr_capture contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase4AdrCaptureContract,
      ideal as unknown as ArchitecturalDecisionsArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-4.3.3 when an ADR has no decision text', () => {
    const broken: ArchitecturalDecisionsArtifact = {
      kind: 'architectural_decisions',
      adrs: [{ id: 'ADR-001', title: 'x', decision: '' }],
    };
    const results = runContractSuite(phase4AdrCaptureContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-4.3.3');
    expect(f?.passed).toBe(false);
  });
});
