/**
 * Unit tests for the upstream-id indexer.
 */
import { describe, it, expect } from 'vitest';
import { indexArtifacts } from '../../../../lib/orchestrator/phases/packetSynthesis/upstreamIndex';

describe('indexArtifacts — basic extraction', () => {
  it('extracts business_domains_bloom domain + persona ids', () => {
    const idx = indexArtifacts({
      artifacts: [{
        sub_phase_id: 'business_domains_bloom',
        content: {
          kind: 'business_domains_bloom',
          domains: [
            { id: 'DOM-A', name: 'A', source: 'user-specified' },
            { id: 'DOM-B', name: 'B', source: 'ai-proposed' },
          ],
          personas: [{ id: 'P-1', name: 'Sharer', source: 'user-specified' }],
        },
      }],
    });
    expect(idx.allUpstreamIds.has('DOM-A')).toBe(true);
    expect(idx.allUpstreamIds.has('DOM-B')).toBe(true);
    expect(idx.allUpstreamIds.has('P-1')).toBe(true);
    expect(idx.userSpecifiedIds.has('DOM-A')).toBe(true);
    expect(idx.aiProposedIds.has('DOM-B')).toBe(true);
    expect(idx.userSpecifiedIds.has('DOM-B')).toBe(false);
  });

  it('extracts journeys + workflows + entities', () => {
    const idx = indexArtifacts({
      artifacts: [
        { sub_phase_id: 'user_journey_bloom', content: { userJourneys: [{ id: 'UJ-1', title: 't' }] } },
        { sub_phase_id: 'system_workflow_bloom', content: { workflows: [{ id: 'WF-1', name: 'w' }] } },
        { sub_phase_id: 'entities_bloom', content: { entities: [{ id: 'ENT-1', name: 'e' }] } },
      ],
    });
    expect(idx.allUpstreamIds.has('UJ-1')).toBe(true);
    expect(idx.allUpstreamIds.has('WF-1')).toBe(true);
    expect(idx.allUpstreamIds.has('ENT-1')).toBe(true);
  });

  it('extracts TECH-* / COMP-* / VV-* from discovery sub-phases', () => {
    const idx = indexArtifacts({
      artifacts: [
        { sub_phase_id: 'technical_constraints_discovery', content: { technicalConstraints: [{ id: 'TECH-1', text: 'foo' }] } },
        { sub_phase_id: 'compliance_retention_discovery', content: { complianceExtractedItems: [{ id: 'COMP-1', text: 'foo' }] } },
        { sub_phase_id: 'vv_requirements_discovery', content: { vvRequirements: [{ id: 'VV-1', target: 'foo' }] } },
      ],
    });
    expect(idx.allUpstreamIds.has('TECH-1')).toBe(true);
    expect(idx.allUpstreamIds.has('COMP-1')).toBe(true);
    expect(idx.allUpstreamIds.has('VV-1')).toBe(true);
  });

  it('extracts synthetic QA-N ids from integrations_qa_bloom quality_attributes', () => {
    const idx = indexArtifacts({
      artifacts: [{
        sub_phase_id: 'integrations_qa_bloom',
        content: {
          integrations: [{ id: 'INT-1', name: 'foo' }],
          qualityAttributes: ['encrypted at rest', 'low latency', 'high availability'],
        },
      }],
    });
    expect(idx.allUpstreamIds.has('INT-1')).toBe(true);
    expect(idx.allUpstreamIds.has('QA-1')).toBe(true);
    expect(idx.allUpstreamIds.has('QA-2')).toBe(true);
    expect(idx.allUpstreamIds.has('QA-3')).toBe(true);
  });

  it('extracts nested AC ids from fr_bloom_skeleton', () => {
    const idx = indexArtifacts({
      artifacts: [{
        sub_phase_id: 'fr_bloom_skeleton',
        content: {
          user_stories: [
            {
              id: 'US-001',
              action: 'do x',
              acceptance_criteria: [
                { id: 'AC-001', description: 'foo' },
                { id: 'AC-002', description: 'bar' },
              ],
            },
            {
              id: 'US-002',
              action: 'do y',
              acceptance_criteria: [{ id: 'AC-001', description: 'baz' }],
            },
          ],
        },
      }],
    });
    expect(idx.allUpstreamIds.has('US-001')).toBe(true);
    expect(idx.allUpstreamIds.has('US-002')).toBe(true);
    expect(idx.allUpstreamIds.has('AC-001')).toBe(true);
    expect(idx.allUpstreamIds.has('AC-002')).toBe(true);
  });

  it('extracts component/data-model/task ids from skeleton phases', () => {
    const idx = indexArtifacts({
      artifacts: [
        { sub_phase_id: 'component_skeleton', content: { components: [{ id: 'comp-001', name: 'A' }] } },
        // Producer-minted entity ids live under models[].entities[].id (Pillar A/B).
        { sub_phase_id: 'data_model_skeleton', content: { models: [{ component_id: 'comp-001', entities: [{ id: 'DM-001', name: 'M' }] }] } },
        { sub_phase_id: 'task_skeleton', content: { tasks: [{ id: 'task-001', name: 'T' }] } },
        {
          sub_phase_id: 'test_case_skeleton',
          content: {
            test_suites: [{
              suite_id: 'suite-001',
              test_cases: [{ test_case_id: 'TC-001' }, { test_case_id: 'TC-002' }],
            }],
          },
        },
      ],
    });
    expect(idx.allUpstreamIds.has('comp-001')).toBe(true);
    expect(idx.allUpstreamIds.has('DM-001')).toBe(true);
    expect(idx.allUpstreamIds.has('task-001')).toBe(true);
    expect(idx.allUpstreamIds.has('suite-001')).toBe(true);
    expect(idx.allUpstreamIds.has('TC-001')).toBe(true);
    expect(idx.allUpstreamIds.has('TC-002')).toBe(true);
  });

  it('indexes saturation node ids (component/task/data_model/test)', () => {
    const idx = indexArtifacts({
      artifacts: [],
      saturationNodes: [
        {
          recordType: 'task_decomposition_node',
          content: { node_id: 'node-abc', task: { id: 'task-leaf-1', name: 'l' } },
        },
        {
          recordType: 'component_decomposition_node',
          content: { node_id: 'node-def', component: { id: 'comp-leaf', name: 'c' } },
        },
      ],
    });
    expect(idx.allUpstreamIds.has('task-leaf-1')).toBe(true);
    expect(idx.allUpstreamIds.has('node-abc')).toBe(true);
    expect(idx.allUpstreamIds.has('comp-leaf')).toBe(true);
    expect(idx.allUpstreamIds.has('node-def')).toBe(true);
  });

  it('populates artifactsById lookup with the source object', () => {
    const idx = indexArtifacts({
      artifacts: [{
        sub_phase_id: 'technical_constraints_discovery',
        content: { technicalConstraints: [{ id: 'TECH-1', text: 'Postgres 16+', category: 'database' }] },
      }],
    });
    const item = idx.artifactsById.get('TECH-1') as { text: string; category: string };
    expect(item.text).toBe('Postgres 16+');
    expect(item.category).toBe('database');
  });

  it('returns empty index on no input', () => {
    const idx = indexArtifacts({ artifacts: [] });
    expect(idx.allUpstreamIds.size).toBe(0);
    expect(idx.aiProposedIds.size).toBe(0);
    expect(idx.userSpecifiedIds.size).toBe(0);
    expect(idx.artifactsById.size).toBe(0);
  });

  it('skips unknown sub-phases without throwing', () => {
    const idx = indexArtifacts({
      artifacts: [{ sub_phase_id: 'totally_unknown_subphase', content: { foo: [{ id: 'X-1' }] } }],
    });
    expect(idx.allUpstreamIds.has('X-1')).toBe(false);
  });
});
