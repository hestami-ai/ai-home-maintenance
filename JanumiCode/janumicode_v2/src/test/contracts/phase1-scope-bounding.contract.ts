/**
 * Contract for Phase 1.1b — scope_bounding
 * (artifact kind: `scope_classification`).
 *
 * Phase 1.1b emits a two-axis scope CLASSIFICATION:
 *   - `breadth` describes how wide (single_product / multi_product / platform / ...)
 *   - `depth` describes how deep (prototype / production_grade / ...)
 *
 * These two values drive downstream decomposition policy: how aggressively
 * Phase 2 saturates FRs/NFRs, how Phase 4 spreads components, etc.
 *
 * (The intent-doc-declared "Out of Scope" items live elsewhere — they're
 * captured as `requirements/decisions/constraints` on the intent_discovery
 * artifact, not on a separate scope-list artifact. The earlier draft of
 * this contract assumed in_scope/out_of_scope arrays here; it was wrong.)
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export type ScopeBreadth = 'single_product' | 'multi_product' | 'platform' | 'feature' | 'extension' | string;
export type ScopeDepth = 'prototype' | 'production_grade' | 'enterprise_grade' | string;

export interface ScopeClassificationArtifact {
  kind: 'scope_classification';
  breadth?: ScopeBreadth;
  depth?: ScopeDepth;
  rationale?: string;
  // Back-compat: older fixtures used in/out arrays. Kept as accepted
  // but no longer the primary surface.
  in_scope?: Array<unknown>;
  out_of_scope?: Array<unknown>;
}

const VALID_BREADTHS = new Set<string>(['single_product', 'multi_product', 'platform', 'feature', 'extension']);
const VALID_DEPTHS = new Set<string>(['prototype', 'production_grade', 'enterprise_grade']);

// ── Contract suite ───────────────────────────────────────────────

export const phase1ScopeBoundingContract: ContractSuite<ScopeClassificationArtifact> = {
  boundaryId: '1.1b_scope_bounding',
  phaseId: '1',
  subPhaseId: 'scope_bounding',
  producerArtifactKind: 'scope_classification',
  description:
    'Phase 1 scope bounding — breadth + depth classification populated and recognized.',
  clauses: [
    {
      id: 'C-1.1b.1',
      description: 'breadth and depth are both non-empty strings (the classification axes).',
      severity: 'blocking',
      check: (a) => {
        if (typeof a.breadth !== 'string' || a.breadth.trim().length === 0) {
          return { message: 'breadth is missing or empty' };
        }
        if (typeof a.depth !== 'string' || a.depth.trim().length === 0) {
          return { message: 'depth is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-1.1b.2',
      description: 'breadth is one of the recognized values.',
      severity: 'advisory',
      check: (a) => {
        if (typeof a.breadth !== 'string') return true;
        if (!VALID_BREADTHS.has(a.breadth)) {
          return { message: `unknown breadth: "${a.breadth}"`, details: { valid: [...VALID_BREADTHS] } };
        }
        return true;
      },
    },
    {
      id: 'C-1.1b.3',
      description: 'depth is one of the recognized values.',
      severity: 'advisory',
      check: (a) => {
        if (typeof a.depth !== 'string') return true;
        if (!VALID_DEPTHS.has(a.depth)) {
          return { message: `unknown depth: "${a.depth}"`, details: { valid: [...VALID_DEPTHS] } };
        }
        return true;
      },
    },
  ],
};
