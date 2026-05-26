import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1ScopeBoundingContract, type ScopeClassificationArtifact } from './phase1-scope-bounding.contract';
import ideal from './fixtures/phase1-scope-classification.ideal.json' assert { type: 'json' };

describe('Phase 1.1b scope_bounding contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1ScopeBoundingContract,
      ideal as unknown as ScopeClassificationArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.1b.1 when breadth is missing', () => {
    const broken: ScopeClassificationArtifact = {
      kind: 'scope_classification',
      depth: 'production_grade',
    };
    const results = runContractSuite(phase1ScopeBoundingContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.1b.1');
    expect(f?.passed).toBe(false);
  });

  it('breaks C-1.1b.2 on unrecognized breadth (advisory)', () => {
    const broken: ScopeClassificationArtifact = {
      kind: 'scope_classification',
      breadth: 'whatever',
      depth: 'prototype',
    };
    const results = runContractSuite(phase1ScopeBoundingContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.1b.2');
    expect(f?.passed).toBe(false);
    expect(f?.severity).toBe('advisory');
  });
});
