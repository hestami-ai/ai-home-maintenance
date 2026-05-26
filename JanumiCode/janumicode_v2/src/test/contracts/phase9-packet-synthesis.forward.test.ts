import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase9PacketSynthesisContract } from './phase9-packet-synthesis.contract';
import type { ImplementationPacketContent } from '../../lib/types/records';
import ideal from './fixtures/phase9-implementation-packet.ideal.json' assert { type: 'json' };

describe('Phase 9.0 packet_synthesis contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase9PacketSynthesisContract,
      ideal as unknown as ImplementationPacketContent,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-9.0.2 when coherence.passed=false but blocking_failures is empty', () => {
    const broken: ImplementationPacketContent = {
      ...(ideal as unknown as ImplementationPacketContent),
      coherence: { passed: false, blocking_failures: [], advisory_findings: [], annotations: { ai_proposed_root_count: 0, ai_proposed_root_ids: [] } },
    };
    const results = runContractSuite(phase9PacketSynthesisContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-9.0.2');
    expect(f?.passed).toBe(false);
  });

  it('flags C-9.0.3 advisory when user_stories is empty (infrastructure-task case)', () => {
    const infra: ImplementationPacketContent = {
      ...(ideal as unknown as ImplementationPacketContent),
      user_stories: [],
    };
    const results = runContractSuite(phase9PacketSynthesisContract, infra, { workflowRunId: 'fwd', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-9.0.3');
    expect(f?.passed).toBe(false);
    expect(f?.severity).toBe('advisory');
  });
});
