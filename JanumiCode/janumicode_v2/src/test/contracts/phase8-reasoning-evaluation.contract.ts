/**
 * Contract for Phase 8.3 — reasoning_evaluation
 * (artifact kind: `reasoning_evaluation_plan`).
 *
 * Third sibling alongside functional / quality. Reasoning scenarios
 * apply when ai_subsystems_detected=true; the plan must declare that
 * flag explicitly.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface ReasoningScenario {
  id: string;
  description: string;
  pass_criteria: string;
  related_requirement_ids?: string[];
}

export interface ReasoningEvaluationPlanArtifact {
  kind: 'reasoning_evaluation_plan';
  scenarios: ReasoningScenario[];
  ai_subsystems_detected: boolean;
}

// ── Contract suite ───────────────────────────────────────────────

const REASONING_ID_PATTERN = /^(RS-|REASON-)/;

export const phase8ReasoningEvaluationContract: ContractSuite<ReasoningEvaluationPlanArtifact> = {
  boundaryId: '8.3_reasoning_evaluation',
  phaseId: '8',
  subPhaseId: 'evaluation_thresholds',
  producerArtifactKind: 'reasoning_evaluation_plan',
  description:
    'Phase 8 reasoning evaluation — ai_subsystems_detected declared; scenarios populated when true.',
  clauses: [
    {
      id: 'C-8.3.1',
      description: 'reasoning_evaluation_plan has scenarios array and ai_subsystems_detected boolean.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.scenarios)) return { message: 'scenarios is missing or not an array' };
        if (typeof artifact.ai_subsystems_detected !== 'boolean') {
          return { message: 'ai_subsystems_detected is missing or not a boolean' };
        }
        return true;
      },
    },
    {
      id: 'C-8.3.2',
      description: 'When ai_subsystems_detected=true, scenarios is non-empty.',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.ai_subsystems_detected && (artifact.scenarios ?? []).length === 0) {
          return { message: 'ai_subsystems_detected=true but scenarios is empty' };
        }
        return true;
      },
    },
    {
      id: 'C-8.3.3',
      description: 'When ai_subsystems_detected=false, scenarios is empty (consistency).',
      severity: 'advisory',
      check: (artifact) => {
        if (!artifact.ai_subsystems_detected && (artifact.scenarios ?? []).length > 0) {
          return {
            message: 'ai_subsystems_detected=false but scenarios is non-empty',
            details: { scenarioCount: artifact.scenarios.length },
          };
        }
        return true;
      },
    },
    {
      id: 'C-8.3.4',
      description: 'Every scenario has id, description, and pass_criteria.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ id: string; missing: string[] }> = [];
        for (const s of artifact.scenarios ?? []) {
          const missing: string[] = [];
          if (!s.id || !REASONING_ID_PATTERN.test(s.id)) missing.push('id');
          if (!s.description || s.description.trim().length === 0) missing.push('description');
          if (!s.pass_criteria || s.pass_criteria.trim().length === 0) missing.push('pass_criteria');
          if (missing.length) bad.push({ id: s.id || '(missing)', missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} scenario(s) have shape issues`, details: { bad } };
      },
    },
  ],
};
