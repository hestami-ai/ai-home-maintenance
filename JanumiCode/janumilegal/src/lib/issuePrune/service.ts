/**
 * Issue Prune service.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 5 §5.2:
 *   - Retain / remove / defer / escalate decisions with reasons.
 *   - No silent pruning rule (every removal carries an attested reason).
 *   - Pruning decisions written to matter track of Governed Stream as work_product_mental.
 */

import type { Scope } from '../database/types.js';
import type { MatterTrackWriter } from '../governedStream/matterTrackWriter.js';
import type { PrivilegeFrameSnapshotRef } from '../privilege/frame.js';
import type { IssueCandidate } from '../issueBloom/types.js';

export type PruningDecision = 'retain' | 'remove' | 'defer' | 'escalate';

export interface PruningInput {
  readonly issueId: string;
  readonly issueDomain: string;
  readonly decision: PruningDecision;
  readonly reason: string;
  readonly missingFacts?: readonly string[];
  readonly requiredReview?: 'attorney' | 'business' | 'compliance';
}

export interface PruningResult {
  readonly retained: readonly IssueCandidate[];
  readonly removed: readonly PruningInput[];
  readonly deferred: readonly PruningInput[];
  readonly escalated: readonly PruningInput[];
  readonly silentPruningCount: number;
  readonly pruneReasonCompleteness: number; // 0..1
}

export class SilentPruningError extends Error {
  constructor(message: string, readonly violations: readonly string[]) {
    super(message);
    this.name = 'SilentPruningError';
  }
}

export interface PruneArgs {
  readonly scope: Scope;
  readonly activeMatterContext: Scope | null;
  readonly candidates: readonly IssueCandidate[];
  readonly decisions: readonly PruningInput[];
  readonly privilegeFrameRef: PrivilegeFrameSnapshotRef;
  readonly lensId?: string;
  readonly lensVersion?: string;
  readonly stateId?: string;
  readonly userId?: string;
}

export class IssuePruneService {
  constructor(private readonly writer: MatterTrackWriter) {}

  /**
   * Apply pruning decisions. Every decision must have a non-empty reason.
   * The set of decisions must cover every candidate exactly once. Pruning
   * decisions are emitted as work_product_mental matter-track events.
   */
  prune(args: PruneArgs): PruningResult {
    // No silent pruning: every decision must have a reason
    const missingReasons = args.decisions.filter((d) => !d.reason || !d.reason.trim());
    if (missingReasons.length > 0) {
      throw new SilentPruningError(
        `silent pruning detected: ${missingReasons.length} decision(s) without reason`,
        missingReasons.map((d) => d.issueId),
      );
    }

    // Coverage check: every candidate has exactly one decision
    const decisionByIssue = new Map<string, PruningInput>();
    for (const d of args.decisions) {
      if (decisionByIssue.has(d.issueId)) {
        throw new SilentPruningError(`duplicate pruning decision for issue ${d.issueId}`, [d.issueId]);
      }
      decisionByIssue.set(d.issueId, d);
    }
    const uncovered = args.candidates.filter((c) => !decisionByIssue.has(c.issueId));
    if (uncovered.length > 0) {
      throw new SilentPruningError(
        `uncovered candidates: ${uncovered.length} issue(s) without a pruning decision`,
        uncovered.map((c) => c.issueId),
      );
    }

    const retained: IssueCandidate[] = [];
    const removed: PruningInput[] = [];
    const deferred: PruningInput[] = [];
    const escalated: PruningInput[] = [];

    for (const c of args.candidates) {
      const d = decisionByIssue.get(c.issueId)!;
      switch (d.decision) {
        case 'retain':
          retained.push(c);
          break;
        case 'remove':
          removed.push(d);
          break;
        case 'defer':
          deferred.push(d);
          break;
        case 'escalate':
          escalated.push(d);
          break;
      }
    }

    // Emit each pruning decision as a work_product_mental matter-track event
    for (const d of args.decisions) {
      this.writer.write({
        scope: args.scope,
        activeMatterContext: args.activeMatterContext,
        userId: args.userId,
        lensId: args.lensId,
        lensVersion: args.lensVersion,
        stateId: args.stateId ?? 'IssuePrune',
        eventType: 'pruning_decision_recorded',
        payload: {
          issueId: d.issueId,
          issueDomain: d.issueDomain,
          decision: d.decision,
          reason: d.reason,
          missingFacts: d.missingFacts ?? [],
          requiredReview: d.requiredReview ?? null,
        },
        clvScope: ['clv.core.issue.v1', 'clv.core.work_product.v1'],
        declaredClassification: 'work_product_mental',
        privilegeFrameRef: args.privilegeFrameRef,
      });
    }

    const reasonCount = args.decisions.filter((d) => d.reason && d.reason.trim().length > 0).length;
    return {
      retained,
      removed,
      deferred,
      escalated,
      silentPruningCount: 0,
      pruneReasonCompleteness: args.decisions.length === 0 ? 1 : reasonCount / args.decisions.length,
    };
  }
}
