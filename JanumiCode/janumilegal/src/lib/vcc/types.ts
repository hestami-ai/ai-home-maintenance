/**
 * Vocabulary Collision Check (VCC) — types.
 *
 * Per docs/janumilegal_product_description_evolution.md §2.
 *
 * Severity matrix (evolution §2.4):
 *   CORE redefinition by Layer 2 or Layer 3        → BLOCK
 *   LENS redefinition by Layer 3                   → BLOCK unless namespaced extension
 *   JURISDICTION variance with no variant mapping  → WARN_ACK
 *   SYNONYM overlap with prohibitedSynonyms        → BLOCK
 *   SOFT collision (different exampleUsage)        → WARN
 */

import type { CanonicalVocabularyEntry, CLVScope } from '../clv/types.js';

export type CollisionSeverity = 'BLOCK' | 'WARN_ACK' | 'WARN';

export type CollisionRule =
  | 'CORE_REDEFINITION'
  | 'LENS_REDEFINITION'
  | 'JURISDICTION_VARIANCE'
  | 'SYNONYM_PROHIBITED_OVERLAP'
  | 'SYNONYM_CROSS_TERM_OVERLAP'
  | 'CANONICAL_NAME_COLLISION'
  | 'COLLISIONS_WITH_DECLARED';

export interface Collision {
  readonly rule: CollisionRule;
  readonly severity: CollisionSeverity;
  readonly leftTermId: string;
  readonly rightTermId?: string;
  readonly message: string;
}

export interface VocabularyCollisionReport {
  readonly reportId: string;
  readonly trigger: VccTrigger;
  readonly producedAt: string;
  readonly collisions: readonly Collision[];
  readonly blockingCount: number;
  readonly warnAckCount: number;
  readonly warnCount: number;
  readonly verdict: 'allow' | 'allow_with_ack' | 'block';
}

export type VccTrigger =
  | 'lens_pack_load'
  | 'firm_config_merge'
  | 'matter_open'
  | 'lens_upgrade'
  | 'clv_publish';

export interface VccInputBatch {
  /** Existing core/published entries against which the candidate batch is checked. */
  readonly existing: readonly CanonicalVocabularyEntry[];
  /** Candidate entries being introduced (e.g., a lens pack's CLV extensions). */
  readonly candidates: readonly CanonicalVocabularyEntry[];
  /** Trigger context. */
  readonly trigger: VccTrigger;
  /** Active jurisdiction(s) for the matter or lens; used for JURISDICTION_VARIANCE checks. */
  readonly activeJurisdictions?: readonly string[];
}

export interface VccLayerOriginMap {
  /** Optional: termId → layer that introduced it. Used for redefinition severity. */
  readonly [termId: string]: 'core' | 'practice_area' | 'jurisdiction' | 'firm';
}

export interface VccOptions {
  readonly layerOrigins?: VccLayerOriginMap;
  /** Treat candidate entries as introduced at this layer. */
  readonly candidateLayer?: CLVScope;
}
