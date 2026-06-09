/**
 * Phase-6 task→leaf-AC binding helpers: collect the leaf-AC menu, validate the
 * AC ids a task cites (structural membership, no regex), and report coverage.
 */
import { describe, it, expect } from 'vitest';
import {
  collectLeafAcceptanceCriteria,
  renderAcceptanceCriteriaMenu,
  computeTaskAcCoverage,
  normalizeRootTaskShape,
} from '../../../../lib/orchestrator/phases/phase6';
import type { GovernedStreamRecord } from '../../../../lib/types/records';

function leafNode(storyId: string, acIds: string[], produced_at = '2026-01-01T00:00:00Z'): GovernedStreamRecord {
  return {
    id: `r-${storyId}`, record_type: 'requirement_decomposition_node', produced_at,
    content: {
      kind: 'requirement_decomposition_node', node_id: `node-${storyId}`, root_kind: 'fr', status: 'atomic',
      display_key: storyId,
      user_story: { id: storyId, role: 'sharer', action: 'do x', outcome: 'y', acceptance_criteria: acIds.map((id) => ({ id, description: `${id} text` })) },
    },
  } as unknown as GovernedStreamRecord;
}

describe('collectLeafAcceptanceCriteria', () => {
  it('extracts leaf story → AC ids from atomic FR decomposition leaves', () => {
    const leaves = collectLeafAcceptanceCriteria([
      leafNode('US-001-01-1', ['AC-US-001-01-1-001', 'AC-US-001-01-1-002']),
      leafNode('US-002-D1', ['AC-US-002-D1-001']),
      // non-atomic / non-fr nodes are ignored
      { id: 'r-x', record_type: 'requirement_decomposition_node', produced_at: '2026-01-01T00:00:00Z',
        content: { kind: 'requirement_decomposition_node', node_id: 'n-x', root_kind: 'fr', status: 'decomposed', user_story: { id: 'US-009', acceptance_criteria: [{ id: 'AC-US-009-001' }] } } } as unknown as GovernedStreamRecord,
    ]);
    expect(leaves.map((l) => l.leafStoryId).sort()).toEqual(['US-001-01-1', 'US-002-D1']);
    expect(leaves.find((l) => l.leafStoryId === 'US-001-01-1')!.acs.map((a) => a.id))
      .toEqual(['AC-US-001-01-1-001', 'AC-US-001-01-1-002']);
  });

  it('renders a grouped menu', () => {
    const menu = renderAcceptanceCriteriaMenu(collectLeafAcceptanceCriteria([leafNode('US-001-01-1', ['AC-US-001-01-1-001'])]));
    expect(menu).toContain('US-001-01-1');
    expect(menu).toContain('AC-US-001-01-1-001');
  });
});

describe('normalizeRootTaskShape — leaf-AC validation in traces_to', () => {
  const leafAcIds = new Set(['AC-US-001-01-1-001', 'AC-US-001-01-1-002']);
  const baseTask = { id: 'task-x', component_id: 'comp-foo', description: 'd', component_responsibility: 'r', estimated_complexity: 'low', completion_criteria: [{ criterion_id: 'CC-1', description: 'c', verification_method: 'test_execution' }] };

  it('keeps member AC ids and non-AC ids; drops invented AC refs', () => {
    const t = normalizeRootTaskShape(
      { ...baseTask, traces_to: ['AC-US-001-01-1-001', 'AC-US-999-BOGUS-001', 'res-store-mapping', 'TECH-AES256'] },
      0, ['TECH-AES256'], 'src', leafAcIds,
    );
    expect(t.traces_to).toEqual(['AC-US-001-01-1-001', 'res-store-mapping', 'TECH-AES256']);
  });

  it('without a leaf-AC set, passes traces_to through unchanged (back-compat)', () => {
    const t = normalizeRootTaskShape({ ...baseTask, traces_to: ['AC-US-999-X-001', 'res-foo'] }, 0, []);
    expect(t.traces_to).toEqual(['AC-US-999-X-001', 'res-foo']);
  });

  it('validates completion_criteria.verifies_acceptance_criteria against the leaf-AC set (drops non-members)', () => {
    const t = normalizeRootTaskShape(
      {
        ...baseTask,
        completion_criteria: [{
          criterion_id: 'CC-1', description: 'delete', verification_method: 'test_execution',
          verifies_acceptance_criteria: ['AC-US-001-01-1-002', 'AC-US-999-BOGUS-001'],
        }],
      },
      0, [], 'src', leafAcIds,
    );
    expect(t.completion_criteria[0].verifies_acceptance_criteria).toEqual(['AC-US-001-01-1-002']);
  });

  it('drops verifies_acceptance_criteria entirely when none are members', () => {
    const t = normalizeRootTaskShape(
      {
        ...baseTask,
        completion_criteria: [{
          criterion_id: 'CC-1', description: 'x', verification_method: 'test_execution',
          verifies_acceptance_criteria: ['AC-US-999-BOGUS-001'],
        }],
      },
      0, [], 'src', leafAcIds,
    );
    expect(t.completion_criteria[0].verifies_acceptance_criteria).toBeUndefined();
  });
});

describe('normalizeRootTaskShape — component-id drift resolution (Fix 1)', () => {
  const componentOracle = new Set(['comp-redirect-handling-service', 'comp-url-shortening-service']);
  const techOracle = new Set(['TECH-PGSQL-16', 'TECH-JSON-LOGS']);
  const base = { id: 'task-x', description: 'd', component_responsibility: 'r', estimated_complexity: 'low', completion_criteria: [{ criterion_id: 'CC-1', description: 'c', verification_method: 'test_execution' }] };

  it('resolves an underscore component_id to the canonical hyphen oracle id', () => {
    const t = normalizeRootTaskShape({ ...base, component_id: 'comp-redirect_handling_service' }, 0, [], 'src', undefined, componentOracle, techOracle);
    expect(t.component_id).toBe('comp-redirect-handling-service');
  });

  it('resolves comp-*/TECH-* drift inside traces_to; leaves unresolvable ids', () => {
    const t = normalizeRootTaskShape(
      { ...base, component_id: 'comp-url-shortening-service', traces_to: ['comp-url_shortening_service', 'TECH-JSON_LOGS', 'res-foo', 'comp-bogus-thing'] },
      0, [], 'src', undefined, componentOracle, techOracle,
    );
    expect(t.traces_to).toEqual(['comp-url-shortening-service', 'TECH-JSON-LOGS', 'res-foo', 'comp-bogus-thing']);
  });
});

describe('computeTaskAcCoverage', () => {
  it('reports leaf ACs cited by no task as honest gaps', () => {
    const leaves = collectLeafAcceptanceCriteria([leafNode('US-001-01-1', ['AC-a', 'AC-b', 'AC-c'])]);
    const r = computeTaskAcCoverage([{ traces_to: ['AC-a', 'res-x'] }, { traces_to: ['AC-b'] }], leaves);
    expect(r.total_leaf_acs).toBe(3);
    expect(r.covered).toBe(2);
    expect(r.gaps.map((g) => g.acceptance_criterion_id)).toEqual(['AC-c']);
    expect(r.coverage_percentage).toBe(67);
  });

  it('100% / no gaps when every AC is cited', () => {
    const leaves = collectLeafAcceptanceCriteria([leafNode('US-1', ['AC-a'])]);
    const r = computeTaskAcCoverage([{ traces_to: ['AC-a'] }], leaves);
    expect(r.gaps).toEqual([]);
    expect(r.coverage_percentage).toBe(100);
  });
});
