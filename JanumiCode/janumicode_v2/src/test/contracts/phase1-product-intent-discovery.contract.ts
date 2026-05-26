/**
 * Contract for Phase 1.0b — product_intent_discovery
 * (artifact kind: `intent_discovery`).
 *
 * Captures the structured product concept (vision, description,
 * personas, journeys, decisions, constraints) that feeds every
 * downstream Phase 1+ prompt.
 *
 * Schema reflects what the current Phase 1.0b prompt actually emits:
 * `product_vision` + `product_description` at root, personas in a
 * separate array, journeys/decisions/constraints as siblings.
 */

import type { ContractSuite } from './types';

export interface IntentDiscoveryPersona {
  id?: string;
  name?: string;
  role?: string;
  description?: string;
}

/**
 * Schema accepts BOTH snake_case (LLM wire format) and camelCase
 * (canonical persisted form after the Phase 1 normalizer). The
 * persisted artifact uses camelCase exclusively; snake_case is kept
 * here for backward compat with older fixtures captured before the
 * normalizer was wired. See feedback_normalizer_case_dual_keys.md.
 */
export interface IntentDiscoveryArtifact {
  kind?: 'intent_discovery';
  // camelCase (persisted shape — what we read in production audits)
  analysisSummary?: string;
  productVision?: string;
  productDescription?: string;
  userJourneys?: Array<unknown>;
  phasingStrategy?: Array<unknown>;
  successMetrics?: Array<unknown>;
  openQuestions?: Array<unknown>;
  // snake_case (wire / fixture compat)
  analysis_summary?: string;
  product_vision?: string;
  product_description?: string;
  user_journeys?: Array<unknown>;
  phasing_strategy?: Array<unknown>;
  success_metrics?: Array<unknown>;
  open_questions?: Array<unknown>;
  // Shared (no case difference)
  personas?: IntentDiscoveryPersona[];
  decisions?: Array<unknown>;
  constraints?: Array<unknown>;
}

/** Pick a string field accepting snake_case OR camelCase keys. */
function pickStr(a: IntentDiscoveryArtifact, snake: keyof IntentDiscoveryArtifact, camel: keyof IntentDiscoveryArtifact): string {
  const s = a[snake];
  if (typeof s === 'string' && s.length > 0) return s;
  const c = a[camel];
  if (typeof c === 'string' && c.length > 0) return c;
  return '';
}

/** Pick an array field accepting snake_case OR camelCase keys. */
function pickArr(a: IntentDiscoveryArtifact, snake: keyof IntentDiscoveryArtifact, camel: keyof IntentDiscoveryArtifact): Array<unknown> {
  const s = a[snake];
  if (Array.isArray(s)) return s;
  const c = a[camel];
  if (Array.isArray(c)) return c;
  return [];
}

export const phase1ProductIntentDiscoveryContract: ContractSuite<IntentDiscoveryArtifact> = {
  boundaryId: '1.0b_product_intent_discovery',
  phaseId: '1',
  subPhaseId: 'product_intent_discovery',
  producerArtifactKind: 'intent_discovery',
  description:
    'Phase 1 product intent — product_vision + product_description populated; personas declared.',
  clauses: [
    {
      id: 'C-1.0b.1',
      description: 'productVision (or product_vision) is a non-empty string.',
      severity: 'blocking',
      check: (a) => {
        const v = pickStr(a, 'product_vision', 'productVision');
        if (v.trim().length === 0) {
          return { message: 'productVision / product_vision is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-1.0b.2',
      description: 'productDescription (or product_description) is a non-empty string.',
      severity: 'blocking',
      check: (a) => {
        const v = pickStr(a, 'product_description', 'productDescription');
        if (v.trim().length === 0) {
          return { message: 'productDescription / product_description is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-1.0b.3',
      description: 'personas is non-empty.',
      severity: 'blocking',
      check: (a) => {
        const p = a.personas ?? [];
        if (p.length === 0) {
          return { message: 'personas array is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-1.0b.4',
      description: 'Every persona has a non-empty id or name.',
      severity: 'advisory',
      check: (a) => {
        const bad = (a.personas ?? []).filter((p) => !p.id && !p.name).length;
        if (bad === 0) return true;
        return { message: `${bad} persona(s) lack id and name` };
      },
    },
    {
      id: 'C-1.0b.5',
      description: 'When openQuestions is non-empty, downstream phases will run with incomplete intent.',
      severity: 'advisory',
      check: (a) => {
        const q = pickArr(a, 'open_questions', 'openQuestions');
        if (q.length === 0) return true;
        return {
          message: `${q.length} open question(s) remain in intent_discovery`,
          details: { count: q.length },
        };
      },
    },
  ],
};
