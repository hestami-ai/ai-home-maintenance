// @vitest-environment happy-dom
//
// Wave 6 — DecompositionNodeCard renders a requirement_decomposition_node
// record with tier/status/depth badges and recursively inlines its
// children. Depth-0 "root" nodes (pre-2.1a) lack a tier; depth-1+ nodes
// carry A/B/C/D labels that drive colour + routing.

import { describe, it, expect, beforeEach } from 'vitest';
import DecompositionNodeCard from '../../../../webview/components/DecompositionNodeCard.svelte';
import { recordsStore } from '../../../../webview/stores/records.svelte';
import { mountComponent, makeFakeRecord } from '../../../helpers/svelteTestHelpers';

function makeNodeRecord(overrides: {
  node_id: string;
  parent_node_id?: string | null;
  depth: number;
  tier?: 'A' | 'B' | 'C' | 'D';
  status?: string;
  pruning_reason?: string;
  traces_to?: string[];
  id?: string;
}) {
  return makeFakeRecord({
    id: overrides.id ?? `rec-${overrides.node_id}`,
    record_type: 'requirement_decomposition_node' as never,
    produced_by_agent_role: 'requirements_agent' as never,
    content: {
      kind: 'requirement_decomposition_node',
      node_id: overrides.node_id,
      parent_node_id: overrides.parent_node_id ?? null,
      root_fr_id: overrides.node_id,
      depth: overrides.depth,
      pass_number: overrides.depth,
      status: overrides.status ?? 'pending',
      ...(overrides.tier ? { tier: overrides.tier } : {}),
      user_story: {
        id: overrides.node_id,
        role: 'operator',
        action: `action for ${overrides.node_id}`,
        outcome: `outcome for ${overrides.node_id}`,
        acceptance_criteria: [
          { id: 'AC-001', description: 'description', measurable_condition: 'test passes' },
        ],
        priority: 'high',
        traces_to: overrides.traces_to ?? ['UJ-1'],
      },
      surfaced_assumption_ids: [],
      ...(overrides.pruning_reason ? { pruning_reason: overrides.pruning_reason } : {}),
    },
  });
}

describe('DecompositionNodeCard', () => {
  beforeEach(() => {
    recordsStore.clear();
  });

  it('renders a root node with Root badge, depth 0 and user story', () => {
    const rec = makeNodeRecord({ node_id: 'FR-ROOT', depth: 0 });
    recordsStore.setSnapshot([rec]);
    const { container, cleanup } = mountComponent(DecompositionNodeCard, { record: rec });
    try {
      expect(container.querySelector('.decomp-node')).toBeTruthy();
      expect(container.textContent).toContain('FR-ROOT');
      expect(container.textContent).toContain('Root');
      expect(container.textContent).toContain('depth 0');
      expect(container.textContent).toContain('action for FR-ROOT');
    } finally {
      cleanup();
    }
  });

  it('renders tier badge for depth-1+ nodes', () => {
    const rec = makeNodeRecord({ node_id: 'FR-B1', depth: 1, tier: 'B', parent_node_id: 'FR-ROOT' });
    recordsStore.setSnapshot([rec]);
    const { container, cleanup } = mountComponent(DecompositionNodeCard, { record: rec });
    try {
      expect(container.textContent).toContain('Tier B');
      expect(container.querySelector('.tier-b')).toBeTruthy();
    } finally {
      cleanup();
    }
  });

  it('recursively renders children under a root node', () => {
    const root = makeNodeRecord({ node_id: 'FR-ROOT', depth: 0 });
    const child = makeNodeRecord({ node_id: 'FR-CHILD', depth: 1, tier: 'C', parent_node_id: 'FR-ROOT' });
    recordsStore.setSnapshot([root, child]);
    const { container, cleanup } = mountComponent(DecompositionNodeCard, { record: root });
    try {
      expect(container.textContent).toContain('FR-ROOT');
      expect(container.textContent).toContain('FR-CHILD');
      expect(container.textContent).toContain('Children (1)');
    } finally {
      cleanup();
    }
  });

  it('renders status tags for pruned/deferred/downgraded nodes with pruning_reason', () => {
    const rec = makeNodeRecord({
      node_id: 'FR-PRUNED', depth: 1, tier: 'B', parent_node_id: 'FR-ROOT',
      status: 'pruned', pruning_reason: 'human-rejected',
    });
    recordsStore.setSnapshot([rec]);
    const { container, cleanup } = mountComponent(DecompositionNodeCard, { record: rec });
    try {
      expect(container.querySelector('.status-pruned')).toBeTruthy();
      expect(container.textContent).toContain('human-rejected');
    } finally {
      cleanup();
    }
  });

  it('shows supersession history count when multiple versions of same node_id exist', () => {
    const original = makeNodeRecord({
      id: 'rec-v1', node_id: 'FR-X', depth: 1, tier: 'B', parent_node_id: 'FR-ROOT', status: 'pending',
    });
    // A later supersession records the downgrade.
    const downgrade = makeNodeRecord({
      id: 'rec-v2', node_id: 'FR-X', depth: 1, tier: 'B', parent_node_id: 'FR-ROOT',
      status: 'downgraded', pruning_reason: 'tier_downgrade: post_gate_children_still_tier_B',
    });
    // bump produced_at on v2 so getLatest returns it
    downgrade.produced_at = new Date(Date.now() + 1000).toISOString();
    recordsStore.setSnapshot([original, downgrade]);
    const { container, cleanup } = mountComponent(DecompositionNodeCard, { record: downgrade });
    try {
      expect(container.textContent).toContain('downgraded');
      expect(container.textContent).toContain('tier_downgrade');
      expect(container.textContent).toContain('+1');
    } finally {
      cleanup();
    }
  });

  it('shows traces_to chips when present', () => {
    const rec = makeNodeRecord({
      node_id: 'FR-TRACED', depth: 1, tier: 'C', parent_node_id: 'FR-ROOT',
      traces_to: ['UJ-1', 'VV-3'],
    });
    recordsStore.setSnapshot([rec]);
    const { container, cleanup } = mountComponent(DecompositionNodeCard, { record: rec });
    try {
      expect(container.textContent).toContain('UJ-1');
      expect(container.textContent).toContain('VV-3');
    } finally {
      cleanup();
    }
  });
});
