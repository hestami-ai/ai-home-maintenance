/**
 * Contract for Phase 5.3 — error_handling (artifact kind: `error_handling_strategies`).
 *
 * Schema reflects what the current Phase 5.3 prompt actually emits:
 *   strategies: [{ component_id, error_types[], detection, response, surfacing }]
 *
 * Each entry has FOUR scalar strings per component (not an array of
 * scenarios). The Phase 5.3 prompt explicitly specifies this shape;
 * the contract previously assumed a `scenarios[]` array which is what
 * an earlier draft of this contract used.
 */

import type { ContractSuite } from './types';
import type { ComponentModelArtifact } from './phase4-component-skeleton.contract';

// ── Producer artifact shape ─────────────────────────────────────

export interface ErrorHandlingStrategy {
  component_id: string;
  error_types?: string[];
  detection?: string;
  response?: string;
  surfacing?: string;
}

export interface ErrorHandlingStrategiesArtifact {
  kind?: 'error_handling_strategies';
  strategies: ErrorHandlingStrategy[];
}

export const phase5ErrorHandlingContract: ContractSuite<ErrorHandlingStrategiesArtifact> = {
  boundaryId: '5.3_error_handling',
  phaseId: '5',
  subPhaseId: 'error_handling',
  producerArtifactKind: 'error_handling_strategies',
  description:
    'Phase 5 error handling — component-keyed strategies with error_types + detection + response + surfacing.',
  clauses: [
    {
      id: 'C-5.3.1',
      description: 'strategies is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.strategies) || artifact.strategies.length === 0) {
          return { message: 'strategies is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-5.3.2',
      description: 'Every strategy has a non-empty component_id (id token, not prose).',
      severity: 'blocking',
      check: (artifact) => {
        const bad = artifact.strategies
          .map((s, i) => ({ idx: i, id: s.component_id }))
          .filter((x) => !x.id || typeof x.id !== 'string' || x.id.includes(' ') || x.id.length > 100);
        if (bad.length === 0) return true;
        return { message: `${bad.length} strategy(ies) have invalid component_id`, details: { bad } };
      },
    },
    {
      id: 'C-5.3.3',
      description: 'Every strategy has non-empty error_types, detection, response, and surfacing.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ componentId: string; missing: string[] }> = [];
        for (const s of artifact.strategies) {
          const missing: string[] = [];
          if (!Array.isArray(s.error_types) || s.error_types.length === 0) missing.push('error_types');
          if (!s.detection || s.detection.trim().length === 0) missing.push('detection');
          if (!s.response || s.response.trim().length === 0) missing.push('response');
          if (!s.surfacing || s.surfacing.trim().length === 0) missing.push('surfacing');
          if (missing.length) bad.push({ componentId: s.component_id, missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} strategy(ies) have shape issues`, details: { bad: bad.slice(0, 10) } };
      },
    },
    {
      id: 'C-5.3.4',
      description: 'Every strategy.component_id resolves to a component in component_model.',
      severity: 'advisory',
      check: (artifact, context) => {
        const cms = context.relatedArtifacts.get('component_model') ?? [];
        if (cms.length === 0) return true;
        const known = new Set<string>();
        for (const cm of cms) {
          const cmA = cm as ComponentModelArtifact;
          for (const c of cmA.components ?? []) known.add(c.id);
        }
        const unresolved = artifact.strategies
          .filter((s) => !known.has(s.component_id))
          .map((s) => s.component_id);
        if (unresolved.length === 0) return true;
        return { message: `${unresolved.length} strategy component_id(s) do not resolve`, details: { componentIds: unresolved } };
      },
    },
  ],
};
