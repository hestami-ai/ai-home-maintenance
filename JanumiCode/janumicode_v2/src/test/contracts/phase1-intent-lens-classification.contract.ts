/**
 * Contract for Phase 1.1a — intent_lens_classification
 * (artifact kind: `intent_lens_classification`).
 *
 * The lens drives prompt-template selection across every downstream
 * phase. Must be one of the recognized IntentLens values.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export type IntentLensValue =
  | 'product' | 'feature' | 'bugfix' | 'refactor' | 'documentation'
  | 'research' | 'infrastructure' | 'other';

export interface IntentLensClassificationArtifact {
  kind: 'intent_lens_classification';
  lens: IntentLensValue | string;
  confidence?: number;
  rationale?: string;
}

// ── Contract suite ───────────────────────────────────────────────

const VALID_LENSES = new Set<string>([
  'product', 'feature', 'bugfix', 'refactor', 'documentation',
  'research', 'infrastructure', 'other',
]);

export const phase1IntentLensClassificationContract: ContractSuite<IntentLensClassificationArtifact> = {
  boundaryId: '1.1a_intent_lens_classification',
  phaseId: '1',
  subPhaseId: 'intent_lens_classification',
  producerArtifactKind: 'intent_lens_classification',
  description:
    'Phase 1 intent lens — exactly one recognized lens declared with rationale.',
  clauses: [
    {
      id: 'C-1.1a.1',
      description: 'lens is a non-empty string.',
      severity: 'blocking',
      check: (artifact) => {
        if (!artifact.lens || typeof artifact.lens !== 'string' || artifact.lens.trim().length === 0) {
          return { message: 'lens is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-1.1a.2',
      description: 'lens is one of the recognized IntentLens values.',
      severity: 'blocking',
      check: (artifact) => {
        if (!VALID_LENSES.has(artifact.lens)) {
          return { message: `unknown lens: "${artifact.lens}"`, details: { valid: [...VALID_LENSES] } };
        }
        return true;
      },
    },
    {
      id: 'C-1.1a.3',
      description: 'rationale is present (downstream phases display it).',
      severity: 'advisory',
      check: (artifact) => {
        if (!artifact.rationale || artifact.rationale.trim().length === 0) {
          return { message: 'rationale is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-1.1a.4',
      description: 'confidence (when present) is between 0 and 1.',
      severity: 'advisory',
      check: (artifact) => {
        if (artifact.confidence === undefined) return true;
        if (typeof artifact.confidence !== 'number' || artifact.confidence < 0 || artifact.confidence > 1) {
          return { message: `confidence out of [0,1]: ${artifact.confidence}` };
        }
        return true;
      },
    },
  ],
};
