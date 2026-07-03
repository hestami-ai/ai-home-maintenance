/**
 * Phase 2.1 deterministic post-processor: auto-flag any accepted journey the
 * FR bloom silently dropped from BOTH `userStories[].traces_to` AND
 * `unreached_journeys[]`.
 *
 * The FR/journey analog of `autoFlagDroppedSeeds` (the NFR/VV-COMP side). Same
 * architectural principle: enumeration discipline ("did every accepted journey
 * appear somewhere in output?") is a DETERMINISTIC concern, not an LLM concern —
 * the LLM does the creative FR authoring; code checks completeness exactly.
 * cal-32 surfaced an instance where gpt-oss:20b created 12 journeys but neither
 * traced an FR to `UJ-SCHEDULE-APPOINTMENT` nor declared it unreached, so the
 * `journey_fr_coverage` verifier correctly hard-failed Phase 2.1c. This closes
 * the loop by auto-declaring such journeys as unreached (with a system-inferred
 * reason) so the verifier sees them as acknowledged-pending-review, not missing.
 */

import type { UnreachedJourneyDeclaration } from './verifyFrCoverage';

export const SYSTEM_INFERRED_JOURNEY_REASON =
  'SYSTEM_INFERRED__AGENT_OMISSION: journey neither traced by any FR nor declared in unreached_journeys[]. '
  + 'Auto-flagged by the deterministic post-processor; review and route to an FR or accept as a scope cut.';

export interface AutoFlagJourneyInputs {
  journeys: Array<{ id: string }>;
  userStories: Array<{ traces_to?: string[] }>;
  unreachedJourneys: UnreachedJourneyDeclaration[];
}

export interface AutoFlagJourneyResult {
  /** unreachedJourneys merged with any system-inferred entries. Pass this to
   *  verifyFrCoverage AND persist it in place of the original list. */
  unreachedJourneys: UnreachedJourneyDeclaration[];
  /** Just the new entries the system added (empty ⇒ agent output was complete). */
  autoFlagged: UnreachedJourneyDeclaration[];
}

/**
 * Compute and append system-inferred unreached_journeys for any accepted
 * journey the FR bloom neither traced (via `userStories[].traces_to` with a
 * `UJ-` prefix) nor explicitly declared unreached. Pure function.
 */
export function autoFlagDroppedJourneys(inputs: AutoFlagJourneyInputs): AutoFlagJourneyResult {
  const traced = new Set<string>();
  for (const s of inputs.userStories) {
    for (const t of s.traces_to ?? []) {
      if (t.startsWith('UJ-')) traced.add(t);
    }
  }
  const declared = new Set(inputs.unreachedJourneys.map(u => u.journey_id));
  const autoFlagged: UnreachedJourneyDeclaration[] = [];
  for (const j of inputs.journeys) {
    if (!traced.has(j.id) && !declared.has(j.id)) {
      autoFlagged.push({ journey_id: j.id, reason: SYSTEM_INFERRED_JOURNEY_REASON });
    }
  }
  return { unreachedJourneys: [...inputs.unreachedJourneys, ...autoFlagged], autoFlagged };
}
