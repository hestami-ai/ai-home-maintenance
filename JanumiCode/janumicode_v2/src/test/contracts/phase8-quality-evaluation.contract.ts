/**
 * Contract for Phase 8.2 — quality_evaluation (artifact kind: `quality_evaluation_plan`).
 *
 * Backwards-derived from Phase 9's packetBuilder. Quality criteria are
 * targeted at NFR-* ids; each carries a threshold and a measurement.
 */

import type { ContractSuite } from './types';
import type { NonFunctionalRequirementsArtifact } from './phase2-nfr-bloom-skeleton.contract';

// ── Producer artifact shape ─────────────────────────────────────

export interface QualityEvalCriterion {
  nonfunctional_requirement_id: string;
  category?: string;
  evaluation_tool?: string;
  threshold: string;
  measurement_method: string;
  fallback_if_tool_unavailable?: string;
}

export interface QualityEvaluationPlanArtifact {
  kind: 'quality_evaluation_plan';
  criteria: QualityEvalCriterion[];
}

// ── Contract suite ───────────────────────────────────────────────

const NFR_ID_PATTERN = /^NFR-/;

export const phase8QualityEvaluationContract: ContractSuite<QualityEvaluationPlanArtifact> = {
  boundaryId: '8.2_quality_evaluation',
  phaseId: '8',
  subPhaseId: 'evaluation_metrics',
  producerArtifactKind: 'quality_evaluation_plan',
  description:
    'Phase 8 quality evaluation — each criterion ties to an NFR id with threshold + measurement.',
  clauses: [
    {
      id: 'C-8.2.1',
      description: 'quality_evaluation_plan.criteria is an array (may be empty if there are no NFRs).',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.criteria)) return { message: 'criteria is missing or not an array' };
        return true;
      },
    },
    {
      id: 'C-8.2.2',
      description: 'Every criterion has a nonfunctional_requirement_id matching NFR-*.',
      severity: 'blocking',
      check: (artifact) => {
        const bad = artifact.criteria
          .filter((c) => !c.nonfunctional_requirement_id || !NFR_ID_PATTERN.test(c.nonfunctional_requirement_id))
          .map((c) => c.nonfunctional_requirement_id || '(missing)');
        if (bad.length === 0) return true;
        return { message: `${bad.length} criterion(criteria) have invalid NFR id`, details: { ids: bad } };
      },
    },
    {
      id: 'C-8.2.3',
      description: 'Every criterion has non-empty threshold and measurement_method.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ nfrId: string; missing: string[] }> = [];
        for (const c of artifact.criteria) {
          const missing: string[] = [];
          if (!c.threshold || c.threshold.trim().length === 0) missing.push('threshold');
          if (!c.measurement_method || c.measurement_method.trim().length === 0) missing.push('measurement_method');
          if (missing.length) bad.push({ nfrId: c.nonfunctional_requirement_id, missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} criterion(criteria) missing threshold/measurement`, details: { bad } };
      },
    },
    {
      id: 'C-8.2.4',
      description: 'Every nonfunctional_requirement_id resolves to an NFR in non_functional_requirements.',
      severity: 'advisory',
      check: (artifact, context) => {
        const nfrArtifacts = context.relatedArtifacts.get('non_functional_requirements') ?? [];
        if (nfrArtifacts.length === 0) return true;
        const known = new Set<string>();
        for (const n of nfrArtifacts) {
          const reqs = (n as NonFunctionalRequirementsArtifact).requirements ?? [];
          for (const r of reqs) if (r.id) known.add(r.id);
        }
        const unresolved = artifact.criteria
          .filter((c) => !known.has(c.nonfunctional_requirement_id))
          .map((c) => c.nonfunctional_requirement_id);
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} criterion(criteria) cite unresolved NFR ids`,
          details: { nfrIds: unresolved },
        };
      },
    },
    {
      id: 'C-8.2.5',
      description: 'Every NFR has at least one quality eval criterion.',
      severity: 'advisory',
      check: (artifact, context) => {
        const nfrArtifacts = context.relatedArtifacts.get('non_functional_requirements') ?? [];
        if (nfrArtifacts.length === 0) return true;
        const required = new Set<string>();
        for (const n of nfrArtifacts) {
          for (const r of (n as NonFunctionalRequirementsArtifact).requirements ?? []) {
            if (r.id) required.add(r.id);
          }
        }
        const covered = new Set(artifact.criteria.map((c) => c.nonfunctional_requirement_id));
        const uncovered = [...required].filter((n) => !covered.has(n));
        if (uncovered.length === 0) return true;
        return {
          message: `${uncovered.length} NFR(s) have no quality eval criterion`,
          details: { nfrIds: uncovered },
        };
      },
    },
  ],
};
