/**
 * Characterization tests for `rebuildSaturationStateFromStream` (Phase 2
 * Wave-6 resume helper). The release-prioritization e2e test only ever
 * exercises the FRESH-run path (the helper returns null at its first
 * guard because no decomposition nodes exist yet). These tests pin the
 * RESUME reconstruction branches — latest-per-node_id, queue rebuild,
 * sibling map, assumption-seq recovery, pipeline start/current selection,
 * and max-depth — that were previously uncovered.
 *
 * The helper reads the stream exclusively through
 * `ctx.engine.writer.getRecordsByType(runId, type, false)` and only
 * touches `record.id`, `record.produced_at`, and `record.content`, so a
 * lightweight in-memory writer stub is sufficient (no DB/engine needed).
 */

import { describe, it, expect } from 'vitest';
import type { GovernedStreamRecord } from '../../../lib/types/records';
import type { PhaseContext } from '../../../lib/orchestrator/orchestratorEngine';
import { rebuildSaturationStateFromStream } from '../../../lib/orchestrator/phases/phase2';

function nodeRec(opts: {
  id: string;
  node_id: string;
  parent_node_id?: string | null;
  root_fr_id: string;
  depth: number;
  status: string;
  tier?: 'A' | 'B' | 'C' | 'D';
  root_kind?: 'fr' | 'nfr';
  display_key?: string;
  story_id?: string;
  release_id?: string | null;
  release_ordinal?: number | null;
  produced_at: string;
}): GovernedStreamRecord {
  const content: Record<string, unknown> = {
    kind: 'requirement_decomposition_node',
    node_id: opts.node_id,
    parent_node_id: opts.parent_node_id ?? null,
    root_fr_id: opts.root_fr_id,
    depth: opts.depth,
    pass_number: opts.depth,
    status: opts.status,
    surfaced_assumption_ids: [],
    release_id: opts.release_id ?? null,
    release_ordinal: opts.release_ordinal ?? null,
    user_story: {
      id: opts.story_id ?? opts.node_id,
      role: 'operator',
      action: `action ${opts.node_id}`,
      outcome: `outcome ${opts.node_id}`,
      acceptance_criteria: [{ id: 'AC-001', description: 'd', measurable_condition: 'c' }],
      priority: 'high',
      traces_to: [],
    },
  };
  if (opts.tier) content.tier = opts.tier;
  if (opts.root_kind) content.root_kind = opts.root_kind;
  if (opts.display_key !== undefined) content.display_key = opts.display_key;
  return { id: opts.id, produced_at: opts.produced_at, content } as unknown as GovernedStreamRecord;
}

function snapRec(opts: {
  id: string;
  root_fr_id: string;
  pass_number: number;
  assumptions: Array<{ id: string }>;
  produced_at: string;
}): GovernedStreamRecord {
  return {
    id: opts.id,
    produced_at: opts.produced_at,
    content: {
      kind: 'assumption_set_snapshot',
      root_fr_id: opts.root_fr_id,
      pass_number: opts.pass_number,
      assumptions: opts.assumptions,
      delta_from_previous_pass: opts.assumptions.length,
    },
  } as unknown as GovernedStreamRecord;
}

function pipeRec(opts: {
  id: string;
  pipeline_id: string;
  root_fr_id: string;
  passes: unknown[];
  produced_at: string;
}): GovernedStreamRecord {
  return {
    id: opts.id,
    produced_at: opts.produced_at,
    content: {
      kind: 'requirement_decomposition_pipeline',
      pipeline_id: opts.pipeline_id,
      root_fr_id: opts.root_fr_id,
      passes: opts.passes,
    },
  } as unknown as GovernedStreamRecord;
}

function makeCtx(recordsByType: Record<string, GovernedStreamRecord[]>): PhaseContext {
  return {
    workflowRun: { id: 'run-1' },
    engine: {
      writer: {
        getRecordsByType: (_runId: string, type: string) => recordsByType[type] ?? [],
      },
    },
  } as unknown as PhaseContext;
}

function callFr(recordsByType: Record<string, GovernedStreamRecord[]>) {
  return rebuildSaturationStateFromStream(
    makeCtx(recordsByType),
    {
      recordSubPhaseId: 'fr_saturation',
      templateSubPhase: 'fr_bloom_skeleton',
      rootKind: 'fr',
      gateSurfacePrefix: 'fr',
    },
    'pipe-1',
    'fr-root-key',
  );
}

describe('rebuildSaturationStateFromStream', () => {
  it('returns null when no decomposition nodes match the root_kind (fresh run)', () => {
    // Only an NFR-kind node exists; FR config filters it out → empty kindMatch.
    const result = callFr({
      requirement_decomposition_node: [
        nodeRec({
          id: 'rec-N', node_id: 'N', root_fr_id: 'N', depth: 0, status: 'pending',
          root_kind: 'nfr', produced_at: '2026-01-01T10:00:00Z',
        }),
      ],
    });
    expect(result).toBeNull();
  });

  it('returns null when matching nodes exist but no pipeline record matches', () => {
    const result = callFr({
      requirement_decomposition_node: [
        nodeRec({
          id: 'rec-R', node_id: 'R', root_fr_id: 'R', depth: 0, status: 'pending',
          display_key: 'FR-ROOT', produced_at: '2026-01-01T10:00:00Z',
        }),
      ],
      assumption_set_snapshot: [],
      requirement_decomposition_pipeline: [
        // Wrong pipeline_id + wrong root_fr_id → filtered out.
        pipeRec({
          id: 'rec-P', pipeline_id: 'other-pipe', root_fr_id: 'nope',
          passes: [{ pass_number: 1 }], produced_at: '2026-01-01T10:00:00Z',
        }),
      ],
    });
    expect(result).toBeNull();
  });

  it('reconstructs queue, siblings, assumptions, pipeline, and max depth on resume', () => {
    const nodes: GovernedStreamRecord[] = [
      // Depth-0 root WITH children → not re-queued.
      nodeRec({
        id: 'rec-R', node_id: 'R', parent_node_id: null, root_fr_id: 'R', depth: 0,
        status: 'pending', display_key: 'FR-ROOT', release_id: 'REL-1', release_ordinal: 1,
        produced_at: '2026-01-01T10:00:00Z',
      }),
      // Depth-0 root, no children, no tier → re-queued with tierHint 'root'.
      nodeRec({
        id: 'rec-R2', node_id: 'R2', parent_node_id: null, root_fr_id: 'R2', depth: 0,
        status: 'pending', display_key: 'FR-ROOT2', release_id: null, release_ordinal: null,
        produced_at: '2026-01-01T10:00:00Z',
      }),
      // Depth-0 root, no display_key → displayKey falls back to user_story.id.
      nodeRec({
        id: 'rec-R3', node_id: 'R3', parent_node_id: null, root_fr_id: 'R3', depth: 0,
        status: 'pending', story_id: 'US-R3', release_id: null, release_ordinal: null,
        produced_at: '2026-01-01T10:00:00Z',
      }),
      // Two versions of C1 — the LATER (tier B) must win.
      nodeRec({
        id: 'rec-C1a', node_id: 'C1', parent_node_id: 'R', root_fr_id: 'R', depth: 1,
        status: 'pending', tier: 'C', display_key: 'FR-C1', release_id: 'REL-1', release_ordinal: 1,
        produced_at: '2026-01-01T10:00:00Z',
      }),
      nodeRec({
        id: 'rec-C1b', node_id: 'C1', parent_node_id: 'R', root_fr_id: 'R', depth: 1,
        status: 'pending', tier: 'B', display_key: 'FR-C1', release_id: 'REL-1', release_ordinal: 1,
        produced_at: '2026-01-01T11:00:00Z',
      }),
      // Atomic child → not re-queued, but still a sibling of C1.
      nodeRec({
        id: 'rec-C2', node_id: 'C2', parent_node_id: 'R', root_fr_id: 'R', depth: 1,
        status: 'atomic', tier: 'D', display_key: 'FR-C2', produced_at: '2026-01-01T10:00:00Z',
      }),
      // NFR-kind node → filtered out of the FR reconstruction entirely.
      nodeRec({
        id: 'rec-N1', node_id: 'N1', parent_node_id: null, root_fr_id: 'N1', depth: 0,
        status: 'pending', root_kind: 'nfr', display_key: 'NFR-1', produced_at: '2026-01-01T10:00:00Z',
      }),
    ];

    const snapshots: GovernedStreamRecord[] = [
      snapRec({
        id: 'snap-1', root_fr_id: 'fr-root-key', pass_number: 1,
        assumptions: [{ id: 'A-0001' }], produced_at: '2026-01-01T10:00:00Z',
      }),
      // Latest matching snapshot → drives allAssumptions + passNumber.
      snapRec({
        id: 'snap-2', root_fr_id: 'fr-root-key', pass_number: 3,
        assumptions: [{ id: 'A-0001' }, { id: 'A-0007' }, { id: 'X-3' }],
        produced_at: '2026-01-01T11:00:00Z',
      }),
      // Different root key → ignored even though it is newest.
      snapRec({
        id: 'snap-3', root_fr_id: 'other-key', pass_number: 9,
        assumptions: [{ id: 'A-9999' }], produced_at: '2026-01-01T12:00:00Z',
      }),
    ];

    const pipelines: GovernedStreamRecord[] = [
      pipeRec({
        id: 'rec-P1', pipeline_id: 'pipe-1', root_fr_id: 'fr-root-key',
        passes: [{ pass_number: 1 }], produced_at: '2026-01-01T10:00:00Z',
      }),
      pipeRec({
        id: 'rec-P2', pipeline_id: 'pipe-1', root_fr_id: 'fr-root-key',
        passes: [{ pass_number: 1 }, { pass_number: 2 }], produced_at: '2026-01-01T11:00:00Z',
      }),
      // Different pipeline_id → excluded from start/latest selection.
      pipeRec({
        id: 'rec-P3', pipeline_id: 'other-pipe', root_fr_id: 'fr-root-key',
        passes: [{ pass_number: 5 }], produced_at: '2026-01-01T12:00:00Z',
      }),
    ];

    const result = callFr({
      requirement_decomposition_node: nodes,
      assumption_set_snapshot: snapshots,
      requirement_decomposition_pipeline: pipelines,
    });

    expect(result).not.toBeNull();
    const state = result!;

    // ── Queue: only pending, childless nodes; R excluded (has children),
    //    C2 excluded (atomic). Order follows latest-per-node insertion.
    expect(state.queue.map(q => q.nodeId)).toEqual(['R2', 'R3', 'C1']);

    const r2 = state.queue.find(q => q.nodeId === 'R2')!;
    expect(r2.tierHint).toBe('root');
    expect(r2.displayKey).toBe('FR-ROOT2');
    expect(r2.releaseId).toBeNull();
    expect(r2.releaseOrdinal).toBeNull();
    expect(r2.parentNodeId).toBeNull();
    expect(r2.depth).toBe(0);
    expect(r2.parentRecordId).toBe('rec-R2');

    const r3 = state.queue.find(q => q.nodeId === 'R3')!;
    expect(r3.tierHint).toBe('root');
    // No persisted display_key → falls back to user_story.id.
    expect(r3.displayKey).toBe('US-R3');

    const c1 = state.queue.find(q => q.nodeId === 'C1')!;
    // Later version (tier B) wins over the earlier tier-C version.
    expect(c1.tierHint).toBe('B');
    expect(c1.displayKey).toBe('FR-C1');
    expect(c1.parentNodeId).toBe('R');
    expect(c1.rootFrId).toBe('R');
    expect(c1.depth).toBe(1);
    expect(c1.releaseId).toBe('REL-1');
    expect(c1.releaseOrdinal).toBe(1);
    expect(c1.parentRecordId).toBe('rec-C1b');

    // ── Siblings: null key holds the depth-0 roots; 'R' holds C1 + C2.
    const rootStories = state.siblingsByParent.get(null)!;
    // R3's node was seeded with story_id 'US-R3', so its task.id is 'US-R3'
    // (siblings hold the task objects; task.id resolves from story_id ?? node_id).
    expect(rootStories.map(s => s.id)).toEqual(['R', 'R2', 'US-R3']);
    const rChildren = state.siblingsByParent.get('R')!;
    expect(rChildren.map(s => s.id)).toEqual(['C1', 'C2']);

    // ── Assumptions: latest matching snapshot; seq parsed from "A-NNNN".
    expect(state.allAssumptions.map(a => a.id)).toEqual(['A-0001', 'A-0007', 'X-3']);
    expect(state.passNumber).toBe(3);
    expect(state.assumptionSeq).toBe(7); // max(1, 7); 'X-3' does not match

    // ── Pipeline: earliest = start, newest = current; 'other-pipe' ignored.
    expect(state.pipelineStartRecord.id).toBe('rec-P1');
    expect(state.currentPipelineRecordId).toBe('rec-P2');
    expect(state.pipelinePasses).toHaveLength(2);

    // ── Max depth across FR-kind nodes (NFR node excluded).
    expect(state.maxDepthReached).toBe(1);
  });
});
