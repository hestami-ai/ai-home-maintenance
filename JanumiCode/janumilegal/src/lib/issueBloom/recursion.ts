/**
 * Recursive sub-issue decomposition.
 *
 * Per docs/janumilegal_product_description_evolution.md §7 (Recursive
 * decomposition under Proposal C) and roadmap Wave 5 §5.3:
 *
 *   - Issue Bloom is shallow (top-level candidates).
 *   - Sub-issue decomposition is a separate, lens-controlled recursion that
 *     may run on retained issues post-prune, with its OWN three-pass
 *     discipline per recursion level.
 *   - Tier-based gate: a recursion level may not start until the prior
 *     level's saturation has terminated.
 *   - Promise.all gating semantics for parallel sub-issue branches: at level
 *     N, multiple retained issues can be sub-bloomed in parallel; ALL must
 *     complete before level N+1 starts.
 *
 * The recursion has a configurable maximum depth to prevent runaway. Default
 * depth = 3 (mirrors JanumiCode v2 Wave 6 tier-based gating).
 */

import { ThreePassBloom } from './threePass.js';
import type { BloomResult, IssueBloomAgent, IssueCandidate, SeedDomain } from './types.js';

export interface RecursionNode {
  readonly level: number;
  readonly parentIssueId?: string;
  readonly parentDomain?: string;
  readonly result: BloomResult;
}

export interface RecursionOptions {
  /** Maximum depth (top-level = 0). Levels above the cap are not bloomed. */
  readonly maxDepth?: number;
  /**
   * For each retained issue, derive seed domains for the sub-bloom.
   * Returning an empty array means "no further decomposition for this branch".
   */
  readonly subSeedDerive: (parent: IssueCandidate) => readonly SeedDomain[];
  /** Per-issue matter-context summary for sub-bloom invocations. */
  readonly subContextDerive: (parent: IssueCandidate) => string;
  /**
   * Optional pruning hook: which sub-candidates are retained and recursed
   * into. Returns the set of retained candidate IDs. Default = retain all.
   */
  readonly retainSelector?: (subCandidates: readonly IssueCandidate[]) => readonly string[];
}

export interface RecursionResult {
  readonly nodes: readonly RecursionNode[];
  readonly anyEscalated: boolean;
  readonly maxDepthReached: number;
}

export class IssueRecursion {
  constructor(private readonly agent: IssueBloomAgent) {}

  /**
   * Run a recursive bloom rooted at the supplied top-level candidates.
   * Each level uses Promise.all so sibling branches at the same level run
   * concurrently. The next level does not start until all siblings complete.
   */
  async recurse(args: {
    rootCandidates: readonly IssueCandidate[];
    options: RecursionOptions;
  }): Promise<RecursionResult> {
    const maxDepth = args.options.maxDepth ?? 3;
    const nodes: RecursionNode[] = [];
    let maxDepthReached = 0;
    let anyEscalated = false;

    type Frontier = { parent: IssueCandidate; level: number };
    let frontier: Frontier[] = args.rootCandidates.map((c) => ({ parent: c, level: 1 }));

    while (frontier.length > 0) {
      // Tier-based gate: collect everything at this level, run in parallel.
      const currentLevel = frontier[0].level;
      if (currentLevel > maxDepth) break;

      const bloom = new ThreePassBloom(this.agent);
      const levelOutcomes = await Promise.all(
        frontier.map(async (f) => {
          const subSeeds = args.options.subSeedDerive(f.parent);
          if (subSeeds.length === 0) return null;
          const result = await bloom.run({
            seedDomains: subSeeds,
            matterContextSummary: args.options.subContextDerive(f.parent),
          });
          const node: RecursionNode = {
            level: f.level,
            parentIssueId: f.parent.issueId,
            parentDomain: f.parent.issueDomain,
            result,
          };
          return node;
        }),
      );

      // Promise.all gate: ensure ALL sibling blooms have completed before advancing.
      const newFrontier: Frontier[] = [];
      for (const node of levelOutcomes) {
        if (!node) continue;
        nodes.push(node);
        maxDepthReached = Math.max(maxDepthReached, node.level);
        if (node.result.status === 'escalated') {
          anyEscalated = true;
          // Do not recurse further down an escalated branch.
          continue;
        }
        const retainedIds = args.options.retainSelector
          ? new Set(args.options.retainSelector(node.result.candidates))
          : null;
        for (const cand of node.result.candidates) {
          if (retainedIds && !retainedIds.has(cand.issueId)) continue;
          if (node.level + 1 > maxDepth) continue;
          newFrontier.push({ parent: cand, level: node.level + 1 });
        }
      }
      frontier = newFrontier;
    }

    return { nodes, anyEscalated, maxDepthReached };
  }
}
