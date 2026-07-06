/**
 * Pure unit test for the node-detail view model (no DB, always runs).
 * Content fixtures mirror the real cal-40 shapes probed from the phase-9 clone.
 */
import { describe, it, expect } from 'vitest';
import { buildNodeDetailView } from '../../../webview/decompViewer/stores/nodeDetailView';

describe('buildNodeDetailView', () => {
  it('maps a task record to component/criteria/paths/traces sections', () => {
    const v = buildNodeDetailView({
      record_id: 'r1',
      record_type: 'task_decomposition_node',
      content: {
        display_key: 'task-persist', status: 'atomic',
        task: {
          id: 'task-persist', name: 'Persist Record', description: 'Insert row',
          task_type: 'standard', estimated_complexity: 'medium',
          component_id: 'comp-svc', component_responsibility: 'Persist',
          completion_criteria: [{ criterion_id: 'CC-001', description: 'saves', verifies_acceptance_criteria: ['AC-US001-001'] }],
          write_directory_paths: ['src/svc'], read_directory_paths: ['src/repo'],
          dependency_task_ids: [], active_constraints: ['TECH-X'], traces_to: ['AC-US001-001', 'US-001'],
        },
      },
    });
    expect(v.layer).toBe('task');
    expect(v.title).toBe('Persist Record');
    expect(v.badges).toEqual(['standard', 'complexity: medium']);
    const headings = v.sections.map((s) => s.heading);
    expect(headings).toContain('Component');
    expect(headings).toContain('Completion Criteria');
    expect(headings).toContain('Writes');
    expect(headings).toContain('Verifies ACs');
    const cc = v.sections.find((s) => s.heading === 'Completion Criteria')!;
    expect(cc.items[0].text).toContain('verifies AC-US001-001');
    // Empty arrays (dependency_task_ids) produce no section.
    expect(headings).not.toContain('Depends on');
    // Nav refs: component id → component; verified ACs → ac.
    expect(v.sections.find((s) => s.heading === 'Component')!.items[0]).toMatchObject({ refKind: 'component', refId: 'comp-svc' });
    expect(v.sections.find((s) => s.heading === 'Verifies ACs')!.items[0]).toMatchObject({ refKind: 'ac', refId: 'AC-US001-001' });
  });

  it('maps a test record with steps + expected outcome', () => {
    const v = buildNodeDetailView({
      record_id: 'r2',
      record_type: 'test_decomposition_node',
      content: {
        display_key: 'TC-1', status: 'atomic',
        test_case: {
          id: 'TC-1', name: 'metric equals', test_type: 'integration',
          component_ids: ['comp-di'], acceptance_criterion_ids: ['AC-US-014-A-003'],
          preconditions: ['db seeded'], steps: [{ id: 'step-01', description: 'call metric' }],
          expected_outcome: 'returns 12345.67',
        },
      },
    });
    expect(v.layer).toBe('test');
    expect(v.badges).toEqual(['type: integration']);
    expect(v.outcome).toBe('returns 12345.67');
    const headings = v.sections.map((s) => s.heading);
    expect(headings).toEqual(expect.arrayContaining(['Verifies ACs', 'Components', 'Preconditions', 'Steps']));
    expect(v.sections.find((s) => s.heading === 'Steps')!.items[0].text).toBe('step-01: call metric');
    expect(v.sections.find((s) => s.heading === 'Verifies ACs')!.items[0]).toMatchObject({ refKind: 'ac', refId: 'AC-US-014-A-003' });
    expect(v.sections.find((s) => s.heading === 'Components')!.items[0]).toMatchObject({ refKind: 'component', refId: 'comp-di' });
  });

  it('maps a component record with responsibilities + dependencies', () => {
    const v = buildNodeDetailView({
      record_id: 'r3',
      record_type: 'component_decomposition_node',
      content: {
        display_key: 'comp-prop', status: 'atomic', decomposition_rationale: 'owns property',
        component: {
          id: 'comp-prop', name: 'Property Service', domain_id: 'domain-prop',
          responsibilities: [{ id: 'res-1', description: 'Create property' }],
          dependencies: [{ component_id: 'comp-media', kind: 'sync_call' }],
          traces_to: ['res-1'], active_constraints: ['TECH-X'],
        },
      },
    });
    expect(v.layer).toBe('component');
    expect(v.title).toBe('Property Service');
    expect(v.description).toBe('owns property');
    const deps = v.sections.find((s) => s.heading === 'Dependencies')!;
    expect(deps.items[0]).toMatchObject({ text: 'comp-media (sync_call)', refKind: 'component', refId: 'comp-media' });
    const resp = v.sections.find((s) => s.heading === 'Responsibilities')!;
    expect(resp.items[0].text).toBe('Create property');
  });

  it('maps a data-model record with fields + relationships', () => {
    const v = buildNodeDetailView({
      record_id: 'r4',
      record_type: 'data_model_decomposition_node',
      content: {
        display_key: 'DM-x', status: 'atomic',
        entity: {
          id: 'DM-x', name: 'ContractorMatch', kind: 'entity', component_id: null,
          fields: [{ name: 'id', type: 'uuid' }, { name: 'score', type: 'float' }],
          relationships: [{ target_entity_id: 'DM-y', kind: 'many_to_one' }],
          traces_to: ['US-002-1'], active_constraints: [],
        },
      },
    });
    expect(v.layer).toBe('data_model');
    expect(v.badges).toEqual(['kind: entity', 'no component']);
    const fields = v.sections.find((s) => s.heading === 'Fields')!;
    expect(fields.items.map((i) => i.text)).toEqual(['id: uuid', 'score: float']);
    const rel = v.sections.find((s) => s.heading === 'Relationships')!;
    expect(rel.items[0].text).toBe('DM-y (many_to_one)');
  });

  it('degrades gracefully on an unknown record type', () => {
    const v = buildNodeDetailView({ record_id: 'r5', record_type: 'weird_record', content: { display_key: 'W-1', a: 1, b: 2 } });
    expect(v.layer).toBe('other');
    expect(v.display_key).toBe('W-1');
    expect(v.sections[0].items.map((i) => i.text)).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('never throws on empty/garbage content', () => {
    for (const rt of ['task_decomposition_node', 'test_decomposition_node', 'component_decomposition_node', 'data_model_decomposition_node']) {
      const v = buildNodeDetailView({ record_id: 'x', record_type: rt, content: {} });
      expect(v.sections).toEqual([]);
      expect(typeof v.title).toBe('string');
    }
  });
});
