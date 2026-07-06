/**
 * Pure unit test for the test-coverage model (no DB, always runs).
 */
import { describe, it, expect } from 'vitest';
import { buildCoverageModel, sumRollups, EMPTY_ROLLUP } from '../../../webview/decompViewer/stores/coverage';
import type { ViewerDecompositionNode, ViewerRealizationNode } from '../../../webview/decompViewer/stores/snapshot';

function node(nodeId: string, parent: string | null, root: string, depth: number, acIds: string[]): ViewerDecompositionNode {
  return {
    record_id: `rec-${nodeId}`, node_id: nodeId, display_key: nodeId, parent_node_id: parent,
    root_fr_id: root, root_kind: 'fr', tier: null, tier_hint: null, status: 'atomic', depth, pass_number: 0,
    release_id: null, release_ordinal: null, story_role: '', story_action: '', story_outcome: '',
    acceptance_criteria: acIds.map((id) => ({ id, description: id, measurable_condition: '' })),
    surfaced_assumption_ids: [], traces_to: [], produced_at: '', children_display_keys: [],
  };
}
const rz = (layer: 'task' | 'test'): ViewerRealizationNode => ({ layer } as ViewerRealizationNode);

describe('buildCoverageModel', () => {
  // US-1 → leaf L1 (AC-1 covered, AC-2 gap, AC-3 unrealized), leaf L2 (AC-4 tested).
  const nodes = [
    node('us1', null, 'us1', 0, []),
    node('L1', 'us1', 'us1', 1, ['AC-1', 'AC-2', 'AC-3']),
    node('L2', 'us1', 'us1', 1, ['AC-4']),
  ];
  const byAc = new Map<string, ViewerRealizationNode[]>([
    ['AC-1', [rz('task'), rz('test')]],
    ['AC-2', [rz('task')]],       // gap
    ['AC-3', []],                 // unrealized
    ['AC-4', [rz('test')]],
  ]);
  const m = buildCoverageModel(nodes, byAc);

  it('scores each AC', () => {
    expect(m.acCov.get('AC-1')).toMatchObject({ task: 1, test: 1, gap: false, unrealized: false });
    expect(m.acCov.get('AC-2')).toMatchObject({ task: 1, test: 0, gap: true, unrealized: false });
    expect(m.acCov.get('AC-3')).toMatchObject({ task: 0, test: 0, gap: false, unrealized: true });
    expect(m.acCov.get('AC-4')).toMatchObject({ task: 0, test: 1, gap: false, unrealized: false });
  });

  it('rolls up per root', () => {
    expect(m.byRoot.get('us1')).toEqual({ totalAc: 4, realized: 2, tested: 2, gaps: 1, unrealized: 1 });
  });

  it('propagates gap membership up the parent chain', () => {
    expect([...m.reqSubtreeHasGap].sort()).toEqual(['L1', 'us1']); // L2 excluded
    expect([...m.rootHasGap]).toEqual(['us1']);
  });

  it('sumRollups aggregates and EMPTY_ROLLUP is neutral', () => {
    const total = sumRollups([m.byRoot.get('us1')!, EMPTY_ROLLUP]);
    expect(total).toEqual({ totalAc: 4, realized: 2, tested: 2, gaps: 1, unrealized: 1 });
    expect(sumRollups([])).toEqual(EMPTY_ROLLUP);
  });

  it('handles an empty run', () => {
    const empty = buildCoverageModel([], new Map());
    expect(empty.acCov.size).toBe(0);
    expect(empty.rootHasGap.size).toBe(0);
    expect(empty.reqSubtreeHasGap.size).toBe(0);
  });
});
