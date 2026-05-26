/**
 * Contract for Phase 9.3 — evaluation_execution
 * (artifact kind: `evaluation_result` per criterion; `evaluation_results` aggregated).
 *
 * The evaluation phase runs each criterion from Phase 8 and emits a
 * verdict. This contract validates the per-criterion record shape.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface EvaluationResultArtifact {
  kind: 'evaluation_result';
  criterion_id?: string;
  target_id?: string;
  evaluation_kind?: 'functional' | 'quality' | 'reasoning' | string;
  verdict: 'pass' | 'fail' | 'inconclusive';
  rationale?: string;
  measured_value?: string | number;
  threshold?: string;
  evidence?: string[];
}

// ── Contract suite ───────────────────────────────────────────────

const VALID_VERDICTS = new Set<string>(['pass', 'fail', 'inconclusive']);
const VALID_KINDS = new Set<string>(['functional', 'quality', 'reasoning']);

export const phase9EvaluationExecutionContract: ContractSuite<EvaluationResultArtifact> = {
  boundaryId: '9.3_evaluation_execution',
  phaseId: '9',
  subPhaseId: 'evaluation_execution',
  producerArtifactKind: 'evaluation_result',
  description:
    'Phase 9 evaluation — each criterion has verdict (pass/fail/inconclusive), kind, and target ref.',
  clauses: [
    {
      id: 'C-9.3.1',
      description: 'evaluation_result has a target_id citing the requirement being evaluated.',
      severity: 'blocking',
      check: (artifact) => {
        if (!artifact.target_id || artifact.target_id.trim().length === 0) {
          return { message: 'target_id is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-9.3.2',
      description: 'verdict is one of pass/fail/inconclusive.',
      severity: 'blocking',
      check: (artifact) => {
        if (!VALID_VERDICTS.has(artifact.verdict)) {
          return { message: `invalid verdict: "${artifact.verdict}"`, details: { valid: [...VALID_VERDICTS] } };
        }
        return true;
      },
    },
    {
      id: 'C-9.3.3',
      description: 'evaluation_kind (when present) is functional/quality/reasoning.',
      severity: 'advisory',
      check: (artifact) => {
        if (artifact.evaluation_kind === undefined) return true;
        if (!VALID_KINDS.has(artifact.evaluation_kind)) {
          return { message: `unknown evaluation_kind: "${artifact.evaluation_kind}"`, details: { valid: [...VALID_KINDS] } };
        }
        return true;
      },
    },
    {
      id: 'C-9.3.4',
      description: 'On verdict=fail, rationale is recorded.',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.verdict !== 'fail') return true;
        if (!artifact.rationale || artifact.rationale.trim().length === 0) {
          return { message: 'verdict=fail but rationale is missing' };
        }
        return true;
      },
    },
    {
      id: 'C-9.3.5',
      description: 'On verdict=inconclusive, rationale explains why.',
      severity: 'advisory',
      check: (artifact) => {
        if (artifact.verdict !== 'inconclusive') return true;
        if (!artifact.rationale || artifact.rationale.trim().length === 0) {
          return { message: 'verdict=inconclusive but rationale is missing' };
        }
        return true;
      },
    },
  ],
};
