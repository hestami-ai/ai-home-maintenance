/**
 * buildInterpretationMirror — derives the Phase 1.3 interpretation-assumption
 * Mirror (the "what did I assume when I interpreted your intent?" surface)
 * from lens classification + candidate concepts.
 *
 * Before this refactor, Phase 1.3 built its Mirror and Menu from the same
 * candidate_product_concepts array — two panels showing the same data twice.
 * That gave the user no way to reject an interpretation assumption without
 * also rejecting a candidate.
 *
 * Post-refactor:
 *   - Menu  = the candidate concepts (unchanged — this is the prune).
 *   - Mirror = interpretation assumptions — things the agent silently decided
 *              when framing the candidates: which lens it used, which scope
 *              boundaries it respected, which assumptions appear in MORE than
 *              one candidate (so they are cross-cutting framing rather than
 *              candidate-specific).
 *
 * A rejection on a Mirror item is the signal to re-bloom with the corrected
 * framing. That loop is deferred; for now Phase 1 returns `requires_input`
 * when any mirror row is rejected.
 */

import type { IntentLens } from '../../../types/records';
import type { MirrorItem, MirrorItemCategory } from '../../../types/decisionBundle';

/** Inputs — kept minimal so the builder is a pure function under test. */
export interface InterpretationMirrorInputs {
  /** Lens the classifier chose (the "real" lens for audit). */
  classifiedLens: IntentLens;
  /** Lens actually used downstream (may differ when the real lens is unsupported). */
  activeLens: IntentLens;
  /** Classifier's rationale — becomes the body of the lens mirror item. */
  lensRationale: string;
  /** Candidate concepts from the bloom. */
  candidates: Array<{
    id: string;
    assumptions: Array<string | { statement?: string; inference?: string; assumption?: string; basis?: string }>;
    constraints?: string[];
    open_questions?: string[];
  }>;
  /** Scope classification summary (breadth + depth), optional. */
  scopeSummary?: string;
  /** Compliance context summary, optional. */
  complianceSummary?: string;
}

function assumptionText(
  a: string | { statement?: string; inference?: string; assumption?: string; basis?: string },
): string {
  if (typeof a === 'string') return a;
  return a.statement ?? a.inference ?? a.assumption ?? JSON.stringify(a);
}

function assumptionBasis(
  a: string | { statement?: string; inference?: string; assumption?: string; basis?: string },
): string | undefined {
  return typeof a === 'object' ? a.basis : undefined;
}

/** Heuristic — classify a shared assumption into a v1-MMP category. */
function categorizeAssumption(text: string): MirrorItemCategory {
  const lower = text.toLowerCase();
  if (/\bnot\b|\bnever\b|\bout of scope\b|\bexclud/.test(lower)) return 'anti_goal';
  if (/\buser\b|\bpersona\b|\broles?\b|\bcustomer\b|\bbuyer\b|\boperator\b/.test(lower)) return 'persona';
  if (/\bscope\b|\bboundary\b|\binclud/.test(lower)) return 'scope';
  if (/\bpriorit|\bmust\b|\bshould\b/.test(lower)) return 'priority';
  return 'constraint';
}

/**
 * Assemble the ordered Mirror items:
 *   1. A single `lens` row summarizing the classifier's framing.
 *   2. Any cross-cutting scope / compliance boundaries (if non-empty).
 *   3. Assumptions that appear in ≥ 2 candidates (cross-cutting).
 * Leaves candidate-specific assumptions off the Mirror — those live on the
 * candidate cards in the Menu section.
 */
export function buildInterpretationMirror(
  inputs: InterpretationMirrorInputs,
): MirrorItem[] {
  const items: MirrorItem[] = [];

  // 1. Lens assumption — always first, always present.
  const lensText = inputs.classifiedLens === inputs.activeLens
    ? `I'm interpreting this as a **${inputs.classifiedLens}** intent.`
    : `I classified this as a **${inputs.classifiedLens}** intent; templates for that lens haven't shipped yet, so I'm using the **${inputs.activeLens}** lens downstream.`;
  items.push({
    id: 'lens-assumption',
    text: lensText,
    rationale: inputs.lensRationale,
    category: 'lens',
  });

  // 2. Scope + compliance framing, when non-trivial.
  if (inputs.scopeSummary && inputs.scopeSummary.trim().length > 0) {
    items.push({
      id: 'scope-framing',
      text: `Scope framing: ${inputs.scopeSummary}`,
      category: 'scope',
    });
  }
  if (inputs.complianceSummary && inputs.complianceSummary.trim().length > 0
      && !/^no compliance/i.test(inputs.complianceSummary)) {
    items.push({
      id: 'compliance-framing',
      text: `Compliance framing: ${inputs.complianceSummary}`,
      category: 'constraint',
    });
  }

  // 3. Cross-cutting assumptions — text shared by ≥ 2 candidates.
  const occurrences = new Map<string, { text: string; basis?: string; count: number; candidateIds: string[] }>();
  for (const candidate of inputs.candidates) {
    const seenInThisCandidate = new Set<string>();
    for (const entry of candidate.assumptions) {
      const text = assumptionText(entry).trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (seenInThisCandidate.has(key)) continue;
      seenInThisCandidate.add(key);
      const existing = occurrences.get(key);
      if (existing) {
        existing.count += 1;
        existing.candidateIds.push(candidate.id);
        if (!existing.basis) existing.basis = assumptionBasis(entry);
      } else {
        occurrences.set(key, {
          text,
          basis: assumptionBasis(entry),
          count: 1,
          candidateIds: [candidate.id],
        });
      }
    }
  }

  let crossCuttingIndex = 0;
  for (const entry of occurrences.values()) {
    if (entry.count < 2) continue;
    crossCuttingIndex += 1;
    items.push({
      id: `shared-assumption-${crossCuttingIndex}`,
      text: entry.text,
      rationale: entry.basis
        ? `${entry.basis} (shared by ${entry.count} candidates)`
        : `Appears in ${entry.count} candidate interpretations.`,
      category: categorizeAssumption(entry.text),
    });
  }

  return items;
}
