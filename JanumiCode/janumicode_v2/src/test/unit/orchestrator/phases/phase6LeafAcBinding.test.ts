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
  computeUncoveredAcIds,
  backfillTracesFromCriteria,
  renderComponentBlockForTask,
  renderComponentMenu,
  renderUncoveredAcsMenu,
  chunkUncoveredByStory,
  taskCoversAny,
  summarizeResidualDivergence,
  parseImplementationTasks,
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

describe('Phase 6.1 per-component chunking helpers', () => {
  const leaves = collectLeafAcceptanceCriteria([
    leafNode('US-001-01-1', ['AC-a', 'AC-b']),
    leafNode('US-002-D1', ['AC-c']),
  ]);
  const leafAcIdSet = new Set(['AC-a', 'AC-b', 'AC-c']);

  it('computeUncoveredAcIds returns leaf ACs no task cites', () => {
    const u = computeUncoveredAcIds([{ traces_to: ['AC-a', 'res-x'] }], leafAcIdSet);
    expect([...u].sort()).toEqual(['AC-b', 'AC-c']);
  });

  it('computeUncoveredAcIds is empty at 100% coverage', () => {
    expect(computeUncoveredAcIds([{ traces_to: ['AC-a', 'AC-b', 'AC-c'] }], leafAcIdSet).size).toBe(0);
  });

  it('computeUncoveredAcIds counts ACs cited only in completion_criteria.verifies_acceptance_criteria', () => {
    // The model often places leaf ACs in the CC field, not top-level traces_to.
    const u = computeUncoveredAcIds(
      [{ traces_to: ['US-x'], completion_criteria: [{ verifies_acceptance_criteria: ['AC-a', 'AC-b'] }] }],
      leafAcIdSet,
    );
    expect([...u]).toEqual(['AC-c']);
  });

  it('backfillTracesFromCriteria promotes CC-only AC ids into traces_to (canonical field)', () => {
    const t = {
      id: 'task-x', task_type: 'standard', component_id: 'comp-y', component_responsibility: 'r',
      description: 'd', estimated_complexity: 'low',
      traces_to: ['US-x', 'SR-1'],
      completion_criteria: [
        { criterion_id: 'CC-1', description: 'c', verification_method: 'test_execution', verifies_acceptance_criteria: ['AC-a', 'AC-b'] },
        { criterion_id: 'CC-2', description: 'c2', verification_method: 'invariant' },
      ],
    } as Parameters<typeof backfillTracesFromCriteria>[0];
    backfillTracesFromCriteria(t);
    expect(t.traces_to).toEqual(['US-x', 'SR-1', 'AC-a', 'AC-b']); // US/SR kept, ACs appended, no dup
  });

  it('backfillTracesFromCriteria tolerates non-array LLM fields (cal-29 verifies_acceptance_criteria:true crash)', () => {
    // gemma4:31b reconciliation emitted `verifies_acceptance_criteria: true`
    // (boolean shorthand) which crashed every batch via `for..of true`.
    const t = {
      id: 'task-x', task_type: 'standard', component_id: 'comp-y', component_responsibility: 'r',
      description: 'd', estimated_complexity: 'low',
      traces_to: ['AC-US-001-6-2-001', 'SR-VAULT-02'],
      completion_criteria: [
        { criterion_id: 'CC-1', description: 'c', verification_method: 'output_comparison', verifies_acceptance_criteria: true },
      ],
    } as unknown as Parameters<typeof backfillTracesFromCriteria>[0];
    expect(() => backfillTracesFromCriteria(t)).not.toThrow();
    // The AC in traces_to survives; the boolean CC field is simply ignored.
    expect(t.traces_to).toEqual(['AC-US-001-6-2-001', 'SR-VAULT-02']);
  });

  it('computeUncoveredAcIds / taskCoversAny tolerate boolean/non-array fields without throwing', () => {
    const tasks = [
      { traces_to: ['AC-a'], completion_criteria: [{ verifies_acceptance_criteria: true }] },
      { traces_to: true, completion_criteria: [{ verifies_acceptance_criteria: ['AC-b'] }] },
      { traces_to: ['AC-c'], completion_criteria: true },
    ] as unknown as Parameters<typeof computeUncoveredAcIds>[0];
    // AC-a (traces_to) + AC-b (CC array) + AC-c (traces_to) are credited; booleans ignored, no throw.
    const u = computeUncoveredAcIds(tasks, leafAcIdSet);
    expect(u.size).toBe(0);
    expect(taskCoversAny(tasks[0], new Set(['AC-a']))).toBe(true);
    expect(taskCoversAny(tasks[1], new Set(['AC-b']))).toBe(true);   // traces_to:true ignored, CC array read
    expect(taskCoversAny(tasks[2], new Set(['AC-c']))).toBe(true);   // completion_criteria:true ignored, traces_to read
  });

  it('backfillTracesFromCriteria is a no-op when no CC carries AC ids', () => {
    const t = {
      id: 'task-x', task_type: 'standard', component_id: 'comp-y', component_responsibility: 'r',
      description: 'd', estimated_complexity: 'low', traces_to: ['US-x'],
      completion_criteria: [{ criterion_id: 'CC-1', description: 'c', verification_method: 'invariant' }],
    } as Parameters<typeof backfillTracesFromCriteria>[0];
    backfillTracesFromCriteria(t);
    expect(t.traces_to).toEqual(['US-x']);
  });

  it('renderComponentBlockForTask renders a single component (id, tier, responsibilities)', () => {
    const block = renderComponentBlockForTask({
      id: 'comp-vault-indexer', name: 'Vault Indexer',
      _leaf_display_key: 'comp-vault-indexer', _leaf_tier: 'D', _leaf_root_display_key: 'comp-document-vault',
      responsibilities: [{ id: 'res-1', description: 'Index OCR text' }, { id: 'res-2', description: 'Retry failed updates' }],
    });
    expect(block).toContain('comp-vault-indexer');
    expect(block).toContain('Tier D leaf under comp-document-vault');
    expect(block).toContain('Index OCR text');
    expect(block).toContain('Retry failed updates');
  });

  it('renderComponentBlockForTask falls back to statement + id when leaf metadata absent', () => {
    const block = renderComponentBlockForTask({ id: 'comp-x', responsibilities: [{ id: 'res-1', statement: 'do thing' }] });
    expect(block).toContain('comp-x');
    expect(block).toContain('do thing');
  });

  it('renderComponentMenu lists each component id + responsibilities; skips id-less entries', () => {
    const menu = renderComponentMenu([
      { id: 'comp-a', name: 'A', responsibilities: [{ id: 'r1', description: 'resp a1' }] },
      { id: 'comp-b', name: 'B', responsibilities: [{ id: 'r2', statement: 'resp b1' }] },
      { name: 'no-id-skipped' },
    ]);
    expect(menu).toContain('comp-a: A');
    expect(menu).toContain('resp a1');
    expect(menu).toContain('comp-b: B');
    expect(menu).toContain('resp b1');
    expect(menu).not.toContain('no-id-skipped');
  });

  it('renderUncoveredAcsMenu shows only uncovered ACs, grouped by story', () => {
    const menu = renderUncoveredAcsMenu(new Set(['AC-b', 'AC-c']), leaves);
    expect(menu).toContain('US-001-01-1');
    expect(menu).toContain('AC-b');
    expect(menu).toContain('US-002-D1');
    expect(menu).toContain('AC-c');
    expect(menu).not.toContain('AC-a'); // covered → excluded
  });

  it('chunkUncoveredByStory keeps a story together and respects the per-batch AC budget', () => {
    // Three stories: A(2), B(1), C(2) ACs. Budget 3 → [A+B], [C].
    const wide = collectLeafAcceptanceCriteria([
      leafNode('US-A', ['AC-a1', 'AC-a2']),
      leafNode('US-B', ['AC-b1']),
      leafNode('US-C', ['AC-c1', 'AC-c2']),
    ]);
    const uncovered = new Set(['AC-a1', 'AC-a2', 'AC-b1', 'AC-c1', 'AC-c2']);
    const batches = chunkUncoveredByStory(uncovered, wide, 3);
    expect(batches.length).toBe(2);
    expect([...batches[0]].sort()).toEqual(['AC-a1', 'AC-a2', 'AC-b1']);
    expect([...batches[1]].sort()).toEqual(['AC-c1', 'AC-c2']);
    // Every uncovered id lands in exactly one batch (no loss, no dup).
    expect(batches.flatMap(b => [...b]).sort()).toEqual([...uncovered].sort());
  });

  it('chunkUncoveredByStory does NOT split a single story that alone exceeds the budget', () => {
    const big = collectLeafAcceptanceCriteria([leafNode('US-BIG', ['AC-1', 'AC-2', 'AC-3', 'AC-4'])]);
    const batches = chunkUncoveredByStory(new Set(['AC-1', 'AC-2', 'AC-3', 'AC-4']), big, 2);
    expect(batches.length).toBe(1); // unsplit, over-budget batch
    expect(batches[0].size).toBe(4);
  });

  it('chunkUncoveredByStory only includes still-uncovered ACs', () => {
    const batches = chunkUncoveredByStory(new Set(['AC-b']), leaves, 25);
    expect(batches.length).toBe(1);
    expect([...batches[0]]).toEqual(['AC-b']);
  });

  it('taskCoversAny reads traces_to ∪ completion_criteria.verifies_acceptance_criteria', () => {
    const batch = new Set(['AC-x']);
    expect(taskCoversAny({ traces_to: ['AC-x'] }, batch)).toBe(true);
    expect(taskCoversAny({ completion_criteria: [{ verifies_acceptance_criteria: ['AC-x'] }] }, batch)).toBe(true);
    expect(taskCoversAny({ traces_to: ['AC-y'], completion_criteria: [{ verifies_acceptance_criteria: ['AC-z'] }] }, batch)).toBe(false);
    expect(taskCoversAny({}, batch)).toBe(false);
  });

  it('summarizeResidualDivergence groups orphan ACs by story, largest gap first, with coverage %', () => {
    const wide = collectLeafAcceptanceCriteria([
      leafNode('US-A', ['AC-a1', 'AC-a2']),
      leafNode('US-B', ['AC-b1']),
    ]);
    // total 3 ACs; 2 remain uncovered (US-A both) → coverage 33.3%
    const s = summarizeResidualDivergence(new Set(['AC-a1', 'AC-a2']), wide, 3);
    expect(s.uncovered).toBe(2);
    expect(s.total).toBe(3);
    expect(s.coverage_pct).toBe(33.3);
    expect(s.orphan_story_count).toBe(1);
    expect(s.stories[0].leaf_story_id).toBe('US-A');
    expect(s.stories[0].orphan_ac_count).toBe(2);
    expect(s.stories[0].ac_ids.sort()).toEqual(['AC-a1', 'AC-a2']);
  });

  it('parseImplementationTasks tolerates {tasks}, {implementation_plan:[]}, nested, and null', () => {
    expect(parseImplementationTasks({ tasks: [{ id: 't1' }] }).length).toBe(1);
    expect(parseImplementationTasks({ implementation_plan: [{ id: 't2' }] }).length).toBe(1);
    expect(parseImplementationTasks({ implementation_plan: { tasks: [{ id: 't3' }] } }).length).toBe(1);
    expect(parseImplementationTasks(null)).toEqual([]);
  });
});
