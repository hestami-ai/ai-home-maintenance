/**
 * Reasoning-Review Validator Registry (Wave 11).
 *
 * Per docs/design/wave11_reasoning_review_harness.md §4 §5.
 *
 * Single source of truth for the validator catalog. Each entry declares
 * identity, family, applicability rule, and (for LLM validators) the
 * registered prompt template id.
 *
 * The catalog is loaded by the harness at construction time. The harness
 * iterates entries in registry order and invokes those whose `appliesTo`
 * predicate returns true for the current state and output.
 */

import type { ValidatorEntry } from './types.js';

import {
  outputSchemaConformance,
  clvScopeAdherence,
  verificationStatusFloor,
  quoteProvenance,
  authorityStatusTiering,
  attorneyConfirmationRequiredSet,
  pruningDecisionCompleteness,
  conclusionCertaintyLanguage,
  releaseStatusFloorAdvice,
  filingReleaseStatusFloor,
  releaseMapFloor,
  jsonShapeFloor,
} from './validators/deterministic/index.js';

import {
  groundingValidator,
  reasoningToResponseFaithfulness,
  factClassificationDiscipline,
  authorityCitationGrounding,
  seedCoveragePass1,
  finalSynthesis,
  divergencePass2Stub,
  dampeningPass3Stub,
  pruningRationaleSubstanceStub,
  conclusionAdverseConsiderationStub,
  argumentAuthorityAlignmentStub,
  toneCaveatCompletenessStub,
} from './validators/llm/index.js';

/** Initial catalog — 12 deterministic + 12 LLM validators. */
export const VALIDATOR_CATALOG: readonly ValidatorEntry[] = [
  // ── cross_state (universal applicability) ─────────────────────────
  outputSchemaConformance,
  clvScopeAdherence,
  verificationStatusFloor,
  quoteProvenance,
  jsonShapeFloor,
  groundingValidator,
  reasoningToResponseFaithfulness,

  // ── fact_extraction ────────────────────────────────────────────────
  factClassificationDiscipline,

  // ── authority ─────────────────────────────────────────────────────
  authorityStatusTiering,
  attorneyConfirmationRequiredSet,
  authorityCitationGrounding,

  // ── issue_bloom ───────────────────────────────────────────────────
  seedCoveragePass1,
  divergencePass2Stub,
  dampeningPass3Stub,

  // ── issue_prune ───────────────────────────────────────────────────
  pruningDecisionCompleteness,
  pruningRationaleSubstanceStub,

  // ── conclusion ────────────────────────────────────────────────────
  conclusionCertaintyLanguage,
  conclusionAdverseConsiderationStub,

  // ── client_advice ─────────────────────────────────────────────────
  releaseStatusFloorAdvice,
  toneCaveatCompletenessStub,

  // ── filing ────────────────────────────────────────────────────────
  filingReleaseStatusFloor,
  argumentAuthorityAlignmentStub,

  // ── release ───────────────────────────────────────────────────────
  releaseMapFloor,

  // ── final_synthesis (always last) ─────────────────────────────────
  finalSynthesis,
];

export class ReasoningReviewRegistry {
  private readonly entries: readonly ValidatorEntry[];

  constructor(entries: readonly ValidatorEntry[] = VALIDATOR_CATALOG) {
    this.entries = entries;
  }

  /**
   * Select validators applicable to a given state and output. Order is
   * preserved from the catalog so dependent validators (e.g. final_synthesis
   * which reads upstreamFindings) come last.
   */
  select(args: { stateId: string; output: unknown }): readonly ValidatorEntry[] {
    return this.entries.filter((e) => e.appliesTo(args));
  }

  list(): readonly ValidatorEntry[] {
    return this.entries;
  }

  byId(id: string): ValidatorEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }
}
