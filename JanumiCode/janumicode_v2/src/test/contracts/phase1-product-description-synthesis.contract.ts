/**
 * Contract for Phase 1.6 — product_description_synthesis
 * (artifact kind: `product_description_handoff`).
 *
 * Narrative handoff document carried into Phase 2+.
 *
 * Schema reflects what the current Phase 1.6 prompt actually emits:
 * `product_vision` + `product_description` + `summary` + `open_loops`.
 * Personas are NOT carried in this artifact (they live in
 * `intent_discovery` from Phase 1.0b).
 */

import type { ContractSuite } from './types';

export interface ProductDescriptionHandoffArtifact {
  kind?: 'product_description_handoff';
  product_vision?: string;
  product_description?: string;
  summary?: string;
  open_loops?: Array<unknown>;
}

export const phase1ProductDescriptionSynthesisContract: ContractSuite<ProductDescriptionHandoffArtifact> = {
  boundaryId: '1.6_product_description_synthesis',
  phaseId: '1',
  subPhaseId: 'product_description_synthesis',
  producerArtifactKind: 'product_description_handoff',
  description:
    'Phase 1 product handoff — product_vision + product_description populated; summary recorded.',
  clauses: [
    {
      id: 'C-1.6.1',
      description: 'product_vision is a non-empty string.',
      severity: 'blocking',
      check: (a) => {
        if (!a.product_vision || a.product_vision.trim().length === 0) {
          return { message: 'product_vision is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-1.6.2',
      description: 'product_description is a non-empty string.',
      severity: 'blocking',
      check: (a) => {
        if (!a.product_description || a.product_description.trim().length === 0) {
          return { message: 'product_description is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-1.6.3',
      description: 'summary is recorded (concise narrative for downstream consumers).',
      severity: 'advisory',
      check: (a) => {
        if (!a.summary || a.summary.trim().length === 0) {
          return { message: 'summary is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-1.6.4',
      description: 'When open_loops is non-empty, downstream phases will run with unresolved questions.',
      severity: 'advisory',
      check: (a) => {
        const ol = a.open_loops ?? [];
        if (ol.length === 0) return true;
        return { message: `${ol.length} open loop(s) carried into Phase 2`, details: { count: ol.length } };
      },
    },
  ],
};
