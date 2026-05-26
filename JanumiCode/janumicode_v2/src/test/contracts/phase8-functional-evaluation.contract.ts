/**
 * Contract for Phase 8.1 — evaluation_design (artifact kind: `functional_evaluation_plan`).
 *
 * Backwards-derived from Phase 9's
 * packetBuilder.findEvalsForUserStoriesAndNfrs. Eval criteria must
 * carry a functional_requirement_id (US-*) so the consumer can match
 * the right criterion to the right user story.
 *
 * Sibling artifacts (quality_evaluation_plan, reasoning_evaluation_plan)
 * each get their own contract — written separately when the ladder
 * gets there. This contract covers the functional plan only.
 */

import type { ContractSuite } from './types';
import type { FunctionalRequirementsArtifact } from './phase2-fr-bloom-skeleton.contract';

// ── Producer artifact shape ─────────────────────────────────────

export interface FunctionalEvalCriterion {
  functional_requirement_id: string;
  evaluation_method: string;
  success_condition: string;
}

export interface FunctionalEvaluationPlanArtifact {
  kind: 'functional_evaluation_plan';
  criteria: FunctionalEvalCriterion[];
}

// ── Contract suite ───────────────────────────────────────────────

const US_ID_PATTERN = /^US-\d+$/;

export const phase8FunctionalEvaluationContract: ContractSuite<FunctionalEvaluationPlanArtifact> = {
  boundaryId: '8.1_functional_evaluation_design',
  phaseId: '8',
  subPhaseId: 'evaluation_design',
  producerArtifactKind: 'functional_evaluation_plan',
  description:
    'Phase 8 functional evaluation — each criterion ties to a US id with concrete method + success condition.',
  clauses: [
    {
      id: 'C-8.1.1',
      description: 'functional_evaluation_plan.criteria is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.criteria) || artifact.criteria.length === 0) {
          return { message: 'criteria is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-8.1.2',
      description: 'Every criterion has functional_requirement_id matching US-* pattern.',
      severity: 'blocking',
      check: (artifact) => {
        const bad = artifact.criteria
          .filter((c) => !c.functional_requirement_id || !US_ID_PATTERN.test(c.functional_requirement_id))
          .map((c) => c.functional_requirement_id || '(missing)');
        if (bad.length === 0) return true;
        return { message: `${bad.length} criterion(criteria) have invalid functional_requirement_id`, details: { ids: bad } };
      },
    },
    {
      id: 'C-8.1.3',
      description: 'Every criterion has a non-empty evaluation_method and success_condition.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ usId: string; missing: string[] }> = [];
        for (const c of artifact.criteria) {
          const missing: string[] = [];
          if (!c.evaluation_method || c.evaluation_method.trim().length === 0) missing.push('evaluation_method');
          if (!c.success_condition || c.success_condition.trim().length === 0) missing.push('success_condition');
          if (missing.length) bad.push({ usId: c.functional_requirement_id, missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} criterion(criteria) missing method/condition`, details: { bad } };
      },
    },
    {
      id: 'C-8.1.4',
      description: 'Every functional_requirement_id resolves to a US in functional_requirements.',
      severity: 'advisory',
      check: (artifact, context) => {
        const frArtifacts = context.relatedArtifacts.get('functional_requirements') ?? [];
        if (frArtifacts.length === 0) return true;
        const known = new Set<string>();
        for (const fr of frArtifacts) {
          const stories = (fr as FunctionalRequirementsArtifact).user_stories ?? [];
          for (const us of stories) if (us.id) known.add(us.id);
        }
        const unresolved = artifact.criteria
          .filter((c) => !known.has(c.functional_requirement_id))
          .map((c) => c.functional_requirement_id);
        if (unresolved.length === 0) return true;
        return { message: `${unresolved.length} criterion(criteria) cite unresolved US ids`, details: { usIds: unresolved } };
      },
    },
    {
      id: 'C-8.1.5',
      description: 'Every user story has at least one functional eval criterion (US ⊆ criterion.US set).',
      severity: 'advisory',
      check: (artifact, context) => {
        const frArtifacts = context.relatedArtifacts.get('functional_requirements') ?? [];
        if (frArtifacts.length === 0) return true;
        const requiredUs = new Set<string>();
        for (const fr of frArtifacts) {
          for (const us of (fr as FunctionalRequirementsArtifact).user_stories ?? []) {
            if (us.id) requiredUs.add(us.id);
          }
        }
        const covered = new Set(artifact.criteria.map((c) => c.functional_requirement_id));
        const uncovered = [...requiredUs].filter((u) => !covered.has(u));
        if (uncovered.length === 0) return true;
        return { message: `${uncovered.length} US(s) have no functional eval criterion`, details: { usIds: uncovered } };
      },
    },
  ],
};
