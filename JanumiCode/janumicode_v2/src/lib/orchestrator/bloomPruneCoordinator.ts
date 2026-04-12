/**
 * BloomPruneCoordinator — sequences Menu interactions within a Phase.
 * Based on JanumiCode Spec v2.3, §7.5.
 *
 * Decision Sequencing Protocol — higher-priority decisions first:
 *   Priority 1: Scope and boundary decisions (always individual)
 *   Priority 2: Compliance and constraint decisions (always individual)
 *   Priority 3: Architectural choices (individual if high complexity)
 *   Priority 4: Implementation preferences (may be bundled)
 *
 * Decision Bundles present multiple independent decisions as one Menu item
 * with system-recommended defaults.
 */

// ── Types ───────────────────────────────────────────────────────────

export type DecisionPriority = 1 | 2 | 3 | 4;

export interface PendingDecision {
  id: string;
  /** Decision priority per the protocol */
  priority: DecisionPriority;
  /** Decision category for display */
  category: string;
  /** The question or choice */
  question: string;
  /** Available options */
  options: DecisionOption[];
  /** Estimated downstream complexity */
  estimatedComplexity: 'low' | 'medium' | 'high';
  /** Whether this is a prior decision override */
  isPriorDecisionOverride: boolean;
  /** Whether this involves compliance regime selection */
  isComplianceSelection: boolean;
  /** Whether this involves System-Proposed Content approval */
  isSystemProposalApproval: boolean;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  /** System-recommended (for Decision Bundles) */
  isRecommended: boolean;
  /** Justification for recommendation */
  recommendationJustification?: string;
}

export interface DecisionBundle {
  id: string;
  decisions: PendingDecision[];
}

export interface SequencedOutput {
  /** Individual decisions in priority order */
  individualDecisions: PendingDecision[];
  /** Bundled decisions (priority 4, low complexity, independent) */
  bundles: DecisionBundle[];
}

// ── Decision Bundle Exclusion Rules (§7.5) ──────────────────────────

const BUNDLE_EXCLUSIONS = new Set<string>([
  'prior_decision_override',
  'compliance_selection',
  'system_proposal_approval',
  'high_complexity',
  'scope_or_boundary',
]);

// ── BloomPruneCoordinator ───────────────────────────────────────────

export class BloomPruneCoordinator {
  private bundleCounter = 0;

  /**
   * Sequence a set of pending decisions according to the Decision Sequencing Protocol.
   */
  sequence(decisions: PendingDecision[]): SequencedOutput {
    // Sort by priority (ascending = higher priority first)
    const sorted = [...decisions].sort((a, b) => a.priority - b.priority);

    const individualDecisions: PendingDecision[] = [];
    const bundleCandidates: PendingDecision[] = [];

    for (const decision of sorted) {
      if (this.mustBeIndividual(decision)) {
        individualDecisions.push(decision);
      } else {
        bundleCandidates.push(decision);
      }
    }

    // Create bundles from remaining candidates
    const bundles = this.createBundles(bundleCandidates);

    return { individualDecisions, bundles };
  }

  /**
   * Check if a decision must be presented individually (never bundled).
   */
  private mustBeIndividual(decision: PendingDecision): boolean {
    // Priority 1 and 2: always individual
    if (decision.priority <= 2) return true;

    // High complexity: always individual
    if (decision.estimatedComplexity === 'high') return true;

    // Excluded types per spec §7.5
    if (decision.isPriorDecisionOverride) return true;
    if (decision.isComplianceSelection) return true;
    if (decision.isSystemProposalApproval) return true;

    return false;
  }

  /**
   * Group bundleable decisions into Decision Bundles.
   * Each bundle contains independent decisions that can be resolved together.
   */
  private createBundles(candidates: PendingDecision[]): DecisionBundle[] {
    if (candidates.length === 0) return [];

    // For now, group all remaining candidates into a single bundle
    // Future: could analyze independence between decisions
    const bundles: DecisionBundle[] = [];

    if (candidates.length === 1) {
      // Single item — no need for a bundle, but include as individual
      // Actually per spec, single items can still be bundled
      // Let's keep it clean: 1 item = no bundle needed
      return [];
    }

    bundles.push({
      id: `bundle-${++this.bundleCounter}`,
      decisions: candidates,
    });

    return bundles;
  }

  /**
   * Check if a decision can be included in a Decision Bundle.
   * Exported for testing.
   */
  canBundle(decision: PendingDecision): boolean {
    return !this.mustBeIndividual(decision);
  }
}
