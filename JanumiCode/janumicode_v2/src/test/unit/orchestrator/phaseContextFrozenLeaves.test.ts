/**
 * Wave 6 frozen-leaf projection + effective FR view.
 *
 * The downstream-phase helper layer needs to:
 *   1. Return leaves whose latest version has status='atomic'.
 *   2. Ignore nodes whose latest version is pruned / deferred / downgraded / pending.
 *   3. Prefer leaves over root FRs when leaves exist.
 *   4. Fall back cleanly to root FRs when no leaves are present (e.g. default-lens runs).
 */

import { describe, it, expect } from 'vitest';
import type { GovernedStreamRecord, PhaseId, AgentRole, AuthorityLevel } from '../../../lib/types/records';
import {
  getFrozenFrLeaves,
  buildEffectiveFrView,
  extractPriorPhaseContext,
} from '../../../lib/orchestrator/phases/phaseContext';

function makeNodeRecord(opts: {
  id: string;
  node_id: string;
  status: 'pending' | 'atomic' | 'pruned' | 'deferred' | 'downgraded';
  depth: number;
  tier?: 'A' | 'B' | 'C' | 'D';
  parent_node_id?: string | null;
  producedAt?: string;
  storyOverrides?: Record<string, unknown>;
}): GovernedStreamRecord {
  return {
    id: opts.id,
    record_type: 'requirement_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: 'run-1',
    phase_id: '2' as PhaseId,
    sub_phase_id: '2.1a',
    produced_by_agent_role: 'requirements_agent' as AgentRole,
    produced_by_record_id: null,
    produced_at: opts.producedAt ?? '2026-04-20T10:00:00.000Z',
    effective_at: null,
    janumicode_version_sha: 'sha',
    authority_level: 2 as AuthorityLevel,
    derived_from_system_proposal: false,
    is_current_version: true,
    superseded_by_id: null,
    superseded_at: null,
    superseded_by_record_id: null,
    source_workflow_run_id: 'run-1',
    derived_from_record_ids: [],
    quarantined: false,
    sanitized: false,
    sanitized_fields: null,
    content: {
      kind: 'requirement_decomposition_node',
      node_id: opts.node_id,
      parent_node_id: opts.parent_node_id ?? null,
      root_fr_id: opts.node_id,
      depth: opts.depth,
      pass_number: opts.depth,
      status: opts.status,
      ...(opts.tier ? { tier: opts.tier } : {}),
      user_story: {
        id: opts.node_id,
        role: 'operator',
        action: `action ${opts.node_id}`,
        outcome: `outcome ${opts.node_id}`,
        acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
        priority: 'high',
        traces_to: ['UJ-1'],
        ...(opts.storyOverrides ?? {}),
      },
      surfaced_assumption_ids: [],
    },
  };
}

describe('getFrozenFrLeaves', () => {
  it('returns only nodes whose latest version has status=atomic', () => {
    const records: GovernedStreamRecord[] = [
      makeNodeRecord({ id: 'r1', node_id: 'FR-A', status: 'atomic', depth: 2, tier: 'D' }),
      makeNodeRecord({ id: 'r2', node_id: 'FR-B', status: 'pending', depth: 2, tier: 'C' }),
      makeNodeRecord({ id: 'r3', node_id: 'FR-C', status: 'pruned', depth: 2, tier: 'B' }),
      makeNodeRecord({ id: 'r4', node_id: 'FR-D', status: 'atomic', depth: 3, tier: 'D' }),
    ];
    const leaves = getFrozenFrLeaves(records);
    expect(leaves.map(l => l.node_id).sort()).toEqual(['FR-A', 'FR-D']);
  });

  it('uses the LATEST version per node_id when multiple supersessions exist', () => {
    const earlier = makeNodeRecord({
      id: 'r1-v1', node_id: 'FR-X', status: 'atomic', depth: 1, tier: 'D',
      producedAt: '2026-04-20T10:00:00.000Z',
    });
    const later = makeNodeRecord({
      id: 'r1-v2', node_id: 'FR-X', status: 'pruned', depth: 1, tier: 'D',
      producedAt: '2026-04-20T11:00:00.000Z',
    });
    const leaves = getFrozenFrLeaves([earlier, later]);
    expect(leaves).toHaveLength(0); // later version is pruned, not atomic
  });

  it('returns empty array when no decomposition nodes are present', () => {
    expect(getFrozenFrLeaves([])).toEqual([]);
  });

  it('carries tier labels through the projection', () => {
    const records = [
      makeNodeRecord({ id: 'r1', node_id: 'FR-TIER-D', status: 'atomic', depth: 2, tier: 'D' }),
    ];
    const leaves = getFrozenFrLeaves(records);
    expect(leaves[0].tier).toBe('D');
  });
});

describe('buildEffectiveFrView', () => {
  function makeFrArtifactRecord(stories: Array<Record<string, unknown>>): GovernedStreamRecord {
    return {
      id: 'fr-art',
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '2' as PhaseId,
      sub_phase_id: '2.1',
      produced_by_agent_role: 'requirements_agent' as AgentRole,
      produced_by_record_id: null,
      produced_at: '2026-04-20T09:00:00.000Z',
      effective_at: null,
      janumicode_version_sha: 'sha',
      authority_level: 2 as AuthorityLevel,
      derived_from_system_proposal: false,
      is_current_version: true,
      superseded_by_id: null,
      superseded_at: null,
      superseded_by_record_id: null,
      source_workflow_run_id: 'run-1',
      derived_from_record_ids: [],
      quarantined: false,
      sanitized: false,
      sanitized_fields: null,
      content: { kind: 'functional_requirements', user_stories: stories },
    };
  }

  it('prefers leaves over roots when leaves are present (source=leaves)', () => {
    const frArt = makeFrArtifactRecord([
      { id: 'FR-ROOT', role: 'op', action: 'root action', outcome: 'r', acceptance_criteria: [] },
    ]);
    const nodes = [
      makeNodeRecord({ id: 'n1', node_id: 'FR-LEAF-1', status: 'atomic', depth: 3, tier: 'D' }),
      makeNodeRecord({ id: 'n2', node_id: 'FR-LEAF-2', status: 'atomic', depth: 3, tier: 'D' }),
    ];
    const prior = extractPriorPhaseContext([frArt]);
    const view = buildEffectiveFrView(nodes, prior);
    expect(view.source).toBe('leaves');
    expect(view.leafCount).toBe(2);
    expect(view.rootCount).toBe(1);
    expect(view.stories).toHaveLength(2);
    expect(view.summary).toContain('FR-LEAF-1');
    expect(view.summary).toContain('Tier D leaf');
  });

  it('falls back to root FRs when no leaves are atomic (source=roots)', () => {
    const frArt = makeFrArtifactRecord([
      { id: 'FR-ROOT', role: 'op', action: 'root action', outcome: 'r', acceptance_criteria: [] },
    ]);
    const prior = extractPriorPhaseContext([frArt]);
    const view = buildEffectiveFrView([], prior);
    expect(view.source).toBe('roots');
    expect(view.leafCount).toBe(0);
    expect(view.rootCount).toBe(1);
    expect(view.stories).toHaveLength(1);
  });

  it('returns source=none when neither leaves nor root FRs are present', () => {
    const prior = extractPriorPhaseContext([]);
    const view = buildEffectiveFrView([], prior);
    expect(view.source).toBe('none');
    expect(view.stories).toHaveLength(0);
    expect(view.summary).toBe('No functional requirements available');
  });
});
