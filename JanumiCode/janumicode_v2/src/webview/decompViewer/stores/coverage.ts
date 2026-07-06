/**
 * Decomposition Viewer — test-coverage model.
 *
 * Pure roll-up of acceptance-criterion coverage across the requirement spine,
 * driven by the realization join (tasks realize ACs, tests verify them). Kept
 * DOM/store-free so it's unit testable and shared by the AC rows, the per-US /
 * per-journey summaries, and the gaps-only filter — one definition of "gap".
 *
 * A gap = an AC that has ≥1 realizing task but 0 verifying test (work planned,
 * nothing proves it). Unrealized = an AC with neither. These are the two
 * coverage holes an operator auditing a run cares about.
 */

import type { ViewerDecompositionNode, ViewerRealizationNode } from './snapshot';

export interface AcCoverage {
  task: number;
  test: number;
  /** ≥1 task, 0 tests — planned but unverified. */
  gap: boolean;
  /** 0 tasks, 0 tests. */
  unrealized: boolean;
}

export interface CoverageRollup {
  totalAc: number;
  realized: number; // ACs with ≥1 task
  tested: number;   // ACs with ≥1 test
  gaps: number;
  unrealized: number;
}

export interface CoverageModel {
  /** AC id → its coverage. */
  acCov: Map<string, AcCoverage>;
  /** root_fr_id → rollup over that US/NFR root's whole subtree. */
  byRoot: Map<string, CoverageRollup>;
  /** node_id of every requirement node on a path to a gap AC (for pruning). */
  reqSubtreeHasGap: Set<string>;
  /** root_fr_id of roots containing ≥1 gap. */
  rootHasGap: Set<string>;
}

export const EMPTY_ROLLUP: CoverageRollup = { totalAc: 0, realized: 0, tested: 0, gaps: 0, unrealized: 0 };

/** Sum a set of rollups (per-journey aggregation over its US roots). */
export function sumRollups(rollups: Iterable<CoverageRollup>): CoverageRollup {
  const out: CoverageRollup = { ...EMPTY_ROLLUP };
  for (const r of rollups) {
    out.totalAc += r.totalAc;
    out.realized += r.realized;
    out.tested += r.tested;
    out.gaps += r.gaps;
    out.unrealized += r.unrealized;
  }
  return out;
}

/**
 * Build the coverage model from the requirement nodes + the AC→realization
 * index. Every AC found on a leaf is scored; rollups accumulate per root; gap
 * membership propagates up the parent chain so the gaps-only filter can keep
 * exactly the paths that lead to a hole.
 */
export function buildCoverageModel(
  nodes: ViewerDecompositionNode[],
  realizationByAc: Map<string, ViewerRealizationNode[]>,
): CoverageModel {
  const acCov = new Map<string, AcCoverage>();
  const byRoot = new Map<string, CoverageRollup>();
  const byNodeId = new Map<string, ViewerDecompositionNode>();
  for (const n of nodes) byNodeId.set(n.node_id, n);

  const ownGap = new Set<string>(); // node_ids that directly own a gap AC

  for (const n of nodes) {
    if (n.acceptance_criteria.length === 0) continue;
    const roll = byRoot.get(n.root_fr_id) ?? { ...EMPTY_ROLLUP };
    for (const ac of n.acceptance_criteria) {
      const rz = realizationByAc.get(ac.id) ?? [];
      let task = 0;
      let test = 0;
      for (const x of rz) {
        if (x.layer === 'task') task++;
        else if (x.layer === 'test') test++;
      }
      const gap = task > 0 && test === 0;
      const unrealized = task === 0 && test === 0;
      acCov.set(ac.id, { task, test, gap, unrealized });
      roll.totalAc++;
      if (task > 0) roll.realized++;
      if (test > 0) roll.tested++;
      if (gap) { roll.gaps++; ownGap.add(n.node_id); }
      if (unrealized) roll.unrealized++;
    }
    byRoot.set(n.root_fr_id, roll);
  }

  // Propagate gap membership up each parent chain. Stop early once a node is
  // already marked — its ancestors were marked on a previous propagation.
  const reqSubtreeHasGap = new Set<string>();
  for (const startId of ownGap) {
    let cur: ViewerDecompositionNode | undefined = byNodeId.get(startId);
    while (cur && !reqSubtreeHasGap.has(cur.node_id)) {
      reqSubtreeHasGap.add(cur.node_id);
      cur = cur.parent_node_id ? byNodeId.get(cur.parent_node_id) : undefined;
    }
  }

  const rootHasGap = new Set<string>();
  for (const [rootFr, roll] of byRoot) if (roll.gaps > 0) rootHasGap.add(rootFr);

  return { acCov, byRoot, reqSubtreeHasGap, rootHasGap };
}
