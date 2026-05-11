/**
 * Narrative Curator (legal).
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 4 §4.2.
 *
 * Wave 4 ships a deterministic summary generator that produces
 * `curatorNotes` for an LBH from the structured fields. Wave 6+ adds an
 * LLM-backed version that produces richer prose.
 *
 * The curator does not invent facts; it summarizes the structural inputs.
 */

import type { LensBoundaryHandoff } from '../../lbh/types.js';

export type LbhPlanInputs = Omit<LensBoundaryHandoff, 'lbhId' | 'curatorNotes' | 'producedAt' | 'privilegeContext'>;

export class NarrativeCurator {
  curate(plan: LbhPlanInputs): string {
    const lines: string[] = [];
    lines.push(`Handoff ${plan.fromLensId}/${plan.fromState} → ${plan.toLensId}/${plan.toState}.`);
    lines.push(`Governing objective: ${plan.governingObjective}`);
    lines.push(
      `Retained: ${plan.retainedFacts.length} fact(s), ${plan.retainedIssues.length} issue(s); ` +
        `pruned: ${plan.prunedIssuesWithReasons.length}; ` +
        `open questions: ${plan.openQuestions.length}; ` +
        `assumptions: ${plan.assumptionsCarried.length}.`,
    );
    if (plan.prunedIssuesWithReasons.length > 0) {
      lines.push('Pruning rationale (top 3):');
      for (const p of plan.prunedIssuesWithReasons.slice(0, 3)) {
        lines.push(`  - ${p.issueDomain} (${p.decision}): ${p.reason}`);
      }
    }
    if (plan.assumptionsCarried.length > 0) {
      lines.push('Assumptions carried (top 3):');
      for (const a of plan.assumptionsCarried.slice(0, 3)) {
        lines.push(`  - ${a.text}${a.couldChangeIf ? ` [could change if: ${a.couldChangeIf}]` : ''}`);
      }
    }
    if (plan.openQuestions.length > 0) {
      lines.push(`Open questions: ${plan.openQuestions.slice(0, 5).join('; ')}${plan.openQuestions.length > 5 ? '; …' : ''}`);
    }
    lines.push(
      `Authority status: retrieved=${plan.authorityStatus.retrievedCount}, machine_assessed_support=${plan.authorityStatus.machineAssessedSupportCount}, attorney_confirmed=${plan.authorityStatus.attorneyConfirmedCount}, citator_status=${plan.authorityStatus.citatorStatusCount}.`,
    );
    lines.push(`CLV terms in scope: ${plan.clvContext.join(', ') || '(none)'}.`);
    return lines.join('\n');
  }
}
