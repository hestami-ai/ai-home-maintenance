// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D74 to D76 (`REG-D-166` (3)) — THE ASSURANCE STAGE'S ROLES, as their exchanges record them (`invokerId`),
// each a role of its own; and the one test of whether an exchange is the stage's. ⭑ A leaf, so the replay recorder (`scripts/phase7/record-replay-core.ts`)
// reads the very names the stage records, and leaves those exchanges out: a replay runs none of the stage's roles (design D76).

/** The prefix every exchange of the stage's roles carries as its invoker. */
export const ASSURANCE_STAGE_INVOKER_PREFIX = 'assurance-stage.';

/** ⭐ D76 — the narrative writer's role: an ASSURANCE-plane exchange under `pol_historical_consistency`, its subject the round's opening verdict. */
export const NARRATIVE_WRITER_INVOKER = 'assurance-stage.narrative-writer';

/**
 * ⭐ D74, D75 — the helpers' roles: EXECUTION-plane exchanges whose subject is the round's opening verdict — never the rejected unit, whose tries
 * the run's readers count by subject — so neither is a unit's try nor a reviewer call.
 */
export const HELPER_INVOKER = {
	hypothesizer: 'assurance-stage.hypothesizer',
	unsticking: 'assurance-stage.unsticking-agent'
} as const;

/** ⭐ Whether an exchange is one of the stage's: its invoker carries the stage's prefix. */
export function isAssuranceStageExchange(state: Readonly<Record<string, unknown>>): boolean {
	return typeof state.invokerId === 'string' && state.invokerId.startsWith(ASSURANCE_STAGE_INVOKER_PREFIX);
}
