// @vitest-environment happy-dom
//
// Wave 6 follow-up — DecompositionPipelineCard renders the composite
// view of a saturation-loop run: per-pass deltas, final totals, and
// nested root-node cards.

import { describe, it, expect, beforeEach } from 'vitest';
import DecompositionPipelineCard from '../../../../webview/components/DecompositionPipelineCard.svelte';
import { recordsStore } from '../../../../webview/stores/records.svelte';
import { mountComponent, makeFakeRecord } from '../../../helpers/svelteTestHelpers';

function makePipelineRecord(overrides: Record<string, unknown> = {}) {
  return makeFakeRecord({
    record_type: 'requirement_decomposition_pipeline' as never,
    produced_by_agent_role: 'orchestrator' as never,
    content: {
      kind: 'requirement_decomposition_pipeline',
      pipeline_id: 'decomp-pipe-fr-test',
      root_fr_id: '*',
      passes: [
        { pass_number: 1, status: 'completed', started_at: '2026-04-20T09:00:00.000Z',
          completed_at: '2026-04-20T09:00:05.000Z', nodes_produced: 3, assumption_delta: 2 },
        { pass_number: 2, status: 'completed', started_at: '2026-04-20T09:00:05.000Z',
          completed_at: '2026-04-20T09:00:08.000Z', nodes_produced: 5, assumption_delta: 0,
          termination_reason: 'fixed_point' },
      ],
      final_leaf_count: 5,
      final_max_depth: 3,
      total_llm_calls: 4,
      ...overrides,
    },
  });
}

describe('DecompositionPipelineCard', () => {
  beforeEach(() => {
    recordsStore.clear();
  });

  it('renders header with pass count, LLM call count, and termination chip when finalized', () => {
    const rec = makePipelineRecord();
    recordsStore.setSnapshot([rec]);
    const { container, cleanup } = mountComponent(DecompositionPipelineCard, { record: rec });
    try {
      expect(container.querySelector('.pipeline-card')).toBeTruthy();
      expect(container.textContent).toContain('FR Decomposition');
      expect(container.textContent).toContain('2 passes');
      expect(container.textContent).toContain('4 LLM calls');
      expect(container.textContent).toContain('5 atomic leaves');
      expect(container.textContent).toContain('saturated');
    } finally {
      cleanup();
    }
  });

  it('renders NFR label and warning-coloured accent for NFR pipeline', () => {
    const rec = makePipelineRecord({ root_fr_id: '*nfr*' });
    recordsStore.setSnapshot([rec]);
    const { container, cleanup } = mountComponent(DecompositionPipelineCard, { record: rec });
    try {
      expect(container.querySelector('.pipeline-nfr')).toBeTruthy();
      expect(container.textContent).toContain('NFR Decomposition');
    } finally {
      cleanup();
    }
  });

  it('lists each pass with delta + node count + duration', () => {
    const rec = makePipelineRecord();
    recordsStore.setSnapshot([rec]);
    const { container, cleanup } = mountComponent(DecompositionPipelineCard, { record: rec });
    try {
      const passes = container.querySelectorAll('.pass');
      expect(passes.length).toBe(2);
      expect(container.textContent).toContain('Δ +2');
      expect(container.textContent).toContain('Δ +0');
      expect(container.textContent).toContain('3 nodes');
      expect(container.textContent).toContain('5 nodes');
      expect(container.textContent).toContain('5.0s');
      expect(container.textContent).toContain('3.0s');
    } finally {
      cleanup();
    }
  });

  it('renders root-node cards for depth-0 nodes matching the pipeline root_kind', () => {
    const pipeline = makePipelineRecord();
    const frRoot = makeFakeRecord({
      record_type: 'requirement_decomposition_node' as never,
      produced_by_agent_role: 'requirements_agent' as never,
      content: {
        kind: 'requirement_decomposition_node',
        node_id: 'FR-ROOT', parent_node_id: null, root_fr_id: 'FR-ROOT',
        depth: 0, pass_number: 0, status: 'pending', root_kind: 'fr',
        user_story: {
          id: 'FR-ROOT', role: 'op', action: 'root action', outcome: 'root outcome',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'high', traces_to: ['UJ-1'],
        },
        surfaced_assumption_ids: [],
      },
    });
    // An NFR root should NOT be picked up by an FR pipeline.
    const nfrRoot = makeFakeRecord({
      record_type: 'requirement_decomposition_node' as never,
      produced_by_agent_role: 'requirements_agent' as never,
      content: {
        kind: 'requirement_decomposition_node',
        node_id: 'NFR-ROOT', parent_node_id: null, root_fr_id: 'NFR-ROOT',
        depth: 0, pass_number: 0, status: 'pending', root_kind: 'nfr',
        user_story: {
          id: 'NFR-ROOT', role: 'system', action: 'nfr action', outcome: 'nfr outcome',
          acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
          priority: 'high', traces_to: ['VV-1'],
        },
        surfaced_assumption_ids: [],
      },
    });
    recordsStore.setSnapshot([pipeline, frRoot, nfrRoot]);
    const { container, cleanup } = mountComponent(DecompositionPipelineCard, { record: pipeline });
    try {
      expect(container.textContent).toContain('FR-ROOT');
      expect(container.textContent).not.toContain('NFR-ROOT');
    } finally {
      cleanup();
    }
  });

  it('renders final totals section when pipeline has final_* fields set', () => {
    const rec = makePipelineRecord();
    recordsStore.setSnapshot([rec]);
    const { container, cleanup } = mountComponent(DecompositionPipelineCard, { record: rec });
    try {
      expect(container.textContent).toContain('Final totals');
      expect(container.textContent).toContain('Max depth reached');
    } finally {
      cleanup();
    }
  });

  it('omits final totals section when pipeline is still in-progress (no final_* fields)', () => {
    const rec = makePipelineRecord({
      passes: [
        { pass_number: 1, status: 'running', started_at: '2026-04-20T09:00:00.000Z',
          completed_at: null, nodes_produced: 0, assumption_delta: 0 },
      ],
      final_leaf_count: undefined,
      final_max_depth: undefined,
      total_llm_calls: undefined,
    });
    recordsStore.setSnapshot([rec]);
    const { container, cleanup } = mountComponent(DecompositionPipelineCard, { record: rec });
    try {
      expect(container.textContent).not.toContain('Final totals');
    } finally {
      cleanup();
    }
  });
});
