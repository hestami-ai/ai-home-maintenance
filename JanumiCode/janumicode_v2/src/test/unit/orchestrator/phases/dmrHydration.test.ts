import { describe, it, expect } from 'vitest';
import { renderHydratedPacket, renderRecordExcerpt, type ResolvedRecord } from '../../../../lib/orchestrator/phases/dmrHydration';
import type { ContextPacket } from '../../../../lib/agents/deepMemoryResearch';

function mkPacket(partial: Partial<ContextPacket>): ContextPacket {
  return {
    queryDecomposition: {
      topicEntities: [], decisionTypesSought: [],
      temporalScope: { from: '1970-01-01T00:00:00Z', to: '2026-01-01T00:00:00Z' },
      authorityLevelsIncluded: [5, 6, 7], sourcesInScope: [], knownConflictZones: [],
    },
    completenessStatus: 'partial_low',
    decisionContextSummary: '',
    completenessNarrative: 'Found constraints and contracts.',
    unavailableSources: [],
    materialFindings: [],
    activeConstraints: [],
    supersessionChains: [],
    contradictions: [],
    openQuestions: [],
    implicitDecisions: [],
    recommendedDrilldowns: [],
    coverageAssessment: { sourcesQueried: [], sourcesUnavailable: [], knownGaps: [], confidence: 0.5 },
    ...partial,
  };
}

const INTERFACE_REC: ResolvedRecord = {
  record_type: 'artifact_produced',
  content: { kind: 'interface_contracts', contracts: [
    { id: 'IC-1', protocol: 'rest' }, { id: 'IC-2', protocol: 'grpc' },
  ] },
};

describe('renderHydratedPacket — resolves references into content', () => {
  it('resolves a [interface_contracts] placeholder constraint to its body', () => {
    const packet = mkPacket({
      activeConstraints: [
        { id: 'c1', statement: '[interface_contracts]', authorityLevel: 6, sourceRecordIds: ['rec-iface'] },
      ],
    });
    const md = renderHydratedPacket(packet, (id) => (id === 'rec-iface' ? INTERFACE_REC : null));
    expect(md).toContain('Governing Constraints');
    // The actual contract ids + protocols are inlined (not the [label] + UUID).
    expect(md).toContain('IC-1');
    expect(md).toContain('rest');
    // No materiality-score noise.
    expect(md).not.toContain('semanticSimilarity');
    expect(md).not.toContain('materialityBreakdown');
  });

  it('renders supersession chains with resolved content', () => {
    const packet = mkPacket({
      supersessionChains: [{
        subject: 'system_boundary',
        chain: [
          { recordId: 'old', position: 'superseded', timestamp: '2026-01-01' },
          { recordId: 'new', position: 'superseding', timestamp: '2026-02-01' },
        ],
      }],
    });
    const resolve = (id: string): ResolvedRecord | null =>
      id === 'old' ? { record_type: 'artifact_produced', content: { kind: 'system_boundary', statement: 'delete API in scope' } }
        : id === 'new' ? { record_type: 'artifact_produced', content: { kind: 'system_boundary', statement: 'delete API OUT of scope' } }
          : null;
    const md = renderHydratedPacket(packet, resolve);
    expect(md).toContain('Supersession Chains');
    expect(md).toContain('superseded');
    expect(md).toContain('superseding');
    expect(md).toContain('OUT of scope');
  });

  it('renders contradictions', () => {
    const packet = mkPacket({
      contradictions: [{ recordIds: ['a', 'b'], explanation: 'A says X, B says not-X', resolutionStatus: 'unresolved' }],
    });
    const md = renderHydratedPacket(packet, () => null);
    expect(md).toContain('Contradictions');
    expect(md).toContain('unresolved');
    expect(md).toContain('A says X');
  });

  it('caps material findings and notes the remainder', () => {
    const findings = Array.from({ length: 20 }, (_, i) => ({
      id: `f${i}`, recordType: 'artifact_produced', authorityLevel: 6,
      governingStatus: 'active' as const, summary: `Finding ${i} body`,
      sourceRecordIds: [`f${i}`], materialityScore: 1 - i / 100,
    }));
    const md = renderHydratedPacket(mkPacket({ materialFindings: findings }), () => null, { maxFindings: 12 });
    expect(md).toContain('Most Material Findings (top 12)');
    expect(md).toContain('+8 more material finding');
  });

  it('collapses empty-summary provenance records into a footer (not the findings list)', () => {
    const packet = mkPacket({
      materialFindings: [
        { id: 'dt1', recordType: 'decision_trace', authorityLevel: 5, governingStatus: 'active', summary: '', sourceRecordIds: ['dt1'], materialityScore: 0.5 },
        { id: 'dt2', recordType: 'phase_gate_approved', authorityLevel: 5, governingStatus: 'active', summary: '', sourceRecordIds: ['dt2'], materialityScore: 0.5 },
        { id: 'a1', recordType: 'artifact_produced', authorityLevel: 6, governingStatus: 'active', summary: 'real content', sourceRecordIds: ['a1'], materialityScore: 0.9 },
      ],
    });
    const md = renderHydratedPacket(packet, () => null);
    expect(md).toContain('2 provenance record(s)');
    expect(md).toContain('real content');
    // The empty decision_trace is not rendered as a finding line.
    expect(md).not.toMatch(/- \*\*decision_trace\*\*/);
  });

  it('handles a missing record gracefully', () => {
    const packet = mkPacket({
      activeConstraints: [{ id: 'c1', statement: '[data_models]', authorityLevel: 6, sourceRecordIds: ['gone'] }],
    });
    expect(() => renderHydratedPacket(packet, () => null)).not.toThrow();
  });

  it('respects the overall character cap', () => {
    const big = Array.from({ length: 50 }, (_, i) => ({
      id: `f${i}`, recordType: 'artifact_produced', authorityLevel: 6, governingStatus: 'active' as const,
      summary: 'x'.repeat(500), sourceRecordIds: [`f${i}`], materialityScore: 0.5,
    }));
    const md = renderHydratedPacket(mkPacket({ materialFindings: big }), () => null, { totalCap: 2000 });
    expect(md.length).toBeLessThanOrEqual(2100);
    expect(md).toContain('truncated');
  });
});

describe('renderRecordExcerpt — kind-aware', () => {
  it('data_models → entity.field:type', () => {
    const rec: ResolvedRecord = { record_type: 'artifact_produced', content: { kind: 'data_models', models: [
      { name: 'User', entities: [{ name: 'User', fields: [{ name: 'id', type: 'string' }, { name: 'age', type: 'number' }] }] },
    ] } };
    const s = renderRecordExcerpt(rec);
    expect(s).toContain('User.id: string');
    expect(s).toContain('User.age: number');
  });

  it('api_definitions → METHOD path', () => {
    const rec: ResolvedRecord = { record_type: 'artifact_produced', content: { kind: 'api_definitions', definitions: [
      { component_id: 'svc', endpoints: [{ path: '/shorten', method: 'post' }, { path: '/resolve/:k', method: 'get' }] },
    ] } };
    const s = renderRecordExcerpt(rec);
    expect(s).toContain('POST /shorten');
    expect(s).toContain('GET /resolve/:k');
  });

  it('caps overly long excerpts', () => {
    const rec: ResolvedRecord = { record_type: 'narrative_memory', content: { description: 'y'.repeat(5000) } };
    expect(renderRecordExcerpt(rec, 100).length).toBeLessThanOrEqual(101);
  });
});
