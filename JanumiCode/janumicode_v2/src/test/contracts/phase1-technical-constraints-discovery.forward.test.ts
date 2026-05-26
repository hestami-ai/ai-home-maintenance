import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1TechnicalConstraintsContract, type TechnicalConstraintsArtifact } from './phase1-technical-constraints-discovery.contract';
import ideal from './fixtures/phase1-technical-constraints.ideal.json' assert { type: 'json' };

describe('Phase 1.0c technical_constraints_discovery contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1TechnicalConstraintsContract,
      ideal as unknown as TechnicalConstraintsArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.0c.4 when a downstream consumer cites an unresolved TECH ref', () => {
    const partial: TechnicalConstraintsArtifact = {
      kind: 'technical_constraints_discovery',
      technical_extracted_items: [{ id: 'TECH-A', category: 'security', text: 'x' }],
    };
    // implementation_plan task.active_constraints is a real TECH consumer.
    const downstream = { tasks: [{ id: 'task-x', active_constraints: ['TECH-B', 'TECH-C'] }] };
    const context = {
      workflowRunId: 'neg',
      relatedArtifacts: new Map<string, ReadonlyArray<unknown>>([['implementation_plan', [downstream]]]),
    };
    const results = runContractSuite(phase1TechnicalConstraintsContract, partial, context);
    const f = results.find((r) => r.clauseId === 'C-1.0c.4');
    expect(f?.passed).toBe(false);
  });
});
