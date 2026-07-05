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

  it('splits BINDING constraints from CERTIFIED CONTEXT by bindingClass (slice-156)', () => {
    const packet = mkPacket({
      activeConstraints: [
        { id: 'adr1', statement: 'ADR-002: AES-256 at rest', authorityLevel: 6, sourceRecordIds: ['adr1'], bindingClass: 'binding' },
        { id: 'cm1', statement: 'comp-link-management responsibilities', authorityLevel: 6, sourceRecordIds: ['cm1'], bindingClass: 'certified_context' },
      ],
    });
    const md = renderHydratedPacket(packet, () => null);
    expect(md).toContain('## Governing Constraints (binding — apply without exception)');
    expect(md).toContain('ADR-002');
    expect(md).toContain('## Certified Architecture Context');
    expect(md).toContain('comp-link-management responsibilities');
    // The certified-context item must NOT sit under the binding heading.
    const bindingSection = md.split('## Certified Architecture Context')[0];
    expect(bindingSection).not.toContain('comp-link-management responsibilities');
  });

  it('PA-13(2b): omitGoverningSections drops governing/certified but keeps findings + dedup', () => {
    const packet = mkPacket({
      activeConstraints: [
        { id: 'adr1', statement: 'ADR-002: AES-256 at rest', authorityLevel: 6, sourceRecordIds: ['adr1'], bindingClass: 'binding' },
        { id: 'cm1', statement: 'comp-link certified context', authorityLevel: 6, sourceRecordIds: ['cm1'], bindingClass: 'certified_context' },
      ],
      supersessionChains: [{
        subject: 'system_boundary',
        chain: [
          { recordId: 'old', position: 'superseded', timestamp: '2026-01-01' },
          { recordId: 'new', position: 'superseding', timestamp: '2026-02-01' },
        ],
      }],
      contradictions: [{ recordIds: ['a', 'b'], explanation: 'A says X, B says not-X', resolutionStatus: 'unresolved' }],
      materialFindings: [
        { id: 'adr1', recordType: 'artifact_produced', authorityLevel: 6, governingStatus: 'active', summary: 'ADR-002: AES-256 at rest', sourceRecordIds: ['adr1'], materialityScore: 0.95 },
        { id: 'z9', recordType: 'artifact_produced', authorityLevel: 4, governingStatus: 'active', summary: 'A distinct downstream finding', sourceRecordIds: ['z9'], materialityScore: 0.6 },
      ],
    });
    const md = renderHydratedPacket(packet, () => null, { omitGoverningSections: true });
    // Governing/certified section blocks are omitted (the caller injects them at the top).
    expect(md).not.toContain('## Governing Constraints');
    expect(md).not.toContain('## Certified Architecture Context');
    expect(md).not.toContain('AES-256 at rest'); // the constraint statement is not re-rendered
    // Everything else still renders.
    expect(md).toContain('Supersession Chains');
    expect(md).toContain('Contradictions');
    expect(md).toContain('A distinct downstream finding');
    // The constraint-id findings dedup is independent of section rendering.
    expect(md).toContain('already shown above');
  });

  it('PA-13(2b): default (no option) still renders the governing sections (no regression)', () => {
    const packet = mkPacket({
      activeConstraints: [
        { id: 'adr1', statement: 'ADR-002: AES-256 at rest', authorityLevel: 6, sourceRecordIds: ['adr1'], bindingClass: 'binding' },
      ],
    });
    const md = renderHydratedPacket(packet, () => null);
    expect(md).toContain('## Governing Constraints (binding — apply without exception)');
    expect(md).toContain('AES-256 at rest');
  });

  it('dedups material findings already shown above as constraints/context (ws-156 triple-render)', () => {
    const packet = mkPacket({
      activeConstraints: [
        { id: 'x1', statement: 'NFR-002 encryption threshold', authorityLevel: 6, sourceRecordIds: ['x1'], bindingClass: 'binding' },
      ],
      materialFindings: [
        { id: 'x1', recordType: 'artifact_produced', authorityLevel: 6, governingStatus: 'active', summary: 'NFR-002 encryption threshold', sourceRecordIds: ['x1'], materialityScore: 0.95 },
        { id: 'y2', recordType: 'artifact_produced', authorityLevel: 4, governingStatus: 'active', summary: 'Distinct finding', sourceRecordIds: ['y2'], materialityScore: 0.6 },
      ],
    });
    const md = renderHydratedPacket(packet, () => null);
    expect(md).toContain('Distinct finding');     // genuinely-new finding kept
    expect(md).toContain('already shown above');   // dedup note present
    // The constraint's id is NOT repeated as a findings line.
    const findingsSection = md.includes('Most Material Findings') ? md.split('Most Material Findings')[1] : '';
    expect(findingsSection).not.toContain('NFR-002 encryption threshold');
  });

  it('legacy packet without bindingClass renders constraints as binding (no regression)', () => {
    const packet = mkPacket({
      activeConstraints: [
        { id: 'c1', statement: 'legacy constraint', authorityLevel: 6, sourceRecordIds: ['c1'] } as never,
      ],
    });
    const md = renderHydratedPacket(packet, () => null);
    expect(md).toContain('## Governing Constraints (binding — apply without exception)');
    expect(md).toContain('legacy constraint');
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

  // Fix #4 (slice-156): the big structured architecture artifacts used to fall
  // through to the raw-JSON `jsonCap` default — a ~1.2KB firehose per item in the
  // "apply without exception" Governing Constraints section. They now render a
  // crisp roster.
  it('software_domains → id (name) roster, not raw JSON', () => {
    const rec: ResolvedRecord = { record_type: 'artifact_produced', content: { kind: 'software_domains', domains: [
      { id: 'domain-link-identity', name: 'Link Identity and Creation', ubiquitous_language: [{ term: 'Slug', definition: '6 chars' }] },
      { id: 'domain-redirection-engine', name: 'Redirection Engine' },
    ] } };
    const s = renderRecordExcerpt(rec);
    expect(s).toContain('domain-link-identity (Link Identity and Creation)');
    expect(s).toContain('domain-redirection-engine (Redirection Engine)');
    expect(s).not.toContain('ubiquitous_language'); // no raw-JSON keys leak
    expect(s).not.toContain('{');
  });

  it('system_requirements → "SR-id: statement" lines, capped', () => {
    const rec: ResolvedRecord = { record_type: 'artifact_produced', content: { kind: 'system_requirements', items: [
      { id: 'SR-001', statement: 'Generate unique 6-character alphanumeric slugs.' },
      { id: 'SR-003', statement: 'Encrypt destination URLs at rest using AES-256.' },
    ] } };
    const s = renderRecordExcerpt(rec);
    expect(s).toContain('SR-001: Generate unique 6-character alphanumeric slugs.');
    expect(s).toContain('SR-003: Encrypt destination URLs at rest using AES-256.');
    expect(s).not.toContain('"id"');
  });

  it('system_boundary → in-scope capabilities + out-of-scope/external counts', () => {
    const rec: ResolvedRecord = { record_type: 'artifact_produced', content: { kind: 'system_boundary',
      in_scope: [{ capability: 'URL Conversion and Validation' }, { capability: 'Analytics and Metric Retrieval' }],
      out_of_scope: ['admin UI', 'microservices'],
      external_systems: [{ id: 'EXT-DB-POSTGRES' }],
    } };
    const s = renderRecordExcerpt(rec);
    expect(s).toContain('URL Conversion and Validation');
    expect(s).toContain('2 out-of-scope');
    expect(s).toContain('1 external system');
    expect(s).not.toContain('{');
  });

  it('error_handling_strategies → "component: TYPE, TYPE"', () => {
    const rec: ResolvedRecord = { record_type: 'artifact_produced', content: { kind: 'error_handling_strategies', strategies: [
      { component_id: 'comp-link-management', error_types: ['HTTP_400', 'HTTP_500'], detection: 'schema validation' },
    ] } };
    const s = renderRecordExcerpt(rec);
    expect(s).toContain('comp-link-management: HTTP_400, HTTP_500');
    expect(s).not.toContain('detection');
  });

  it('configuration_parameters → "component.name" list', () => {
    const rec: ResolvedRecord = { record_type: 'artifact_produced', content: { kind: 'configuration_parameters', params: [
      { component_id: 'comp-link-management', name: 'database_url', default: null },
      { component_id: 'comp-link-management', name: 'encryption_key_id' },
    ] } };
    const s = renderRecordExcerpt(rec);
    expect(s).toContain('comp-link-management.database_url');
    expect(s).toContain('comp-link-management.encryption_key_id');
    expect(s).not.toContain('default');
  });

  it('implementation_plan → task count + task ids, not the full task JSON', () => {
    const rec: ResolvedRecord = { record_type: 'artifact_produced', content: { kind: 'implementation_plan', tasks: [
      { id: 'task-generate-slugs', write_directory_paths: ['src/services/link-management'], completion_criteria: [{ criterion_id: 'CC-001' }] },
      { id: 'task-validate-urls' },
    ] } };
    const s = renderRecordExcerpt(rec);
    expect(s).toContain('2 task(s)');
    expect(s).toContain('task-generate-slugs');
    // The other-task hyphen write paths that used to leak no longer appear.
    expect(s).not.toContain('src/services/link-management');
    expect(s).not.toContain('completion_criteria');
  });
});
