// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — D46 (`REG-D-145`; design §11.7) — THE FREE-TIER REFUSALS A CALL WAS WAITED OUT THROUGH, as
// devin's adapter carries them: on its answer (`ToolInvocationResult.freeTierRefusals`) or on the failure it throws, off the
// failure's message. ⭑ A module of its own, which reads no setting when it loads: the qualification's runner and transport read
// it without loading devin's adapter, which captures its program override when it loads (`REG-D-072` D12's order).
/**
 * How many refusals were waited out before the call, and the time waited for them — ⭐ and (the lead's correction to ruling 3,
 * `z3-p1-rulings.md`) all that came before the attempt that reached the model: the refused attempts' own run time and their waits
 * together, measured on the clock the call's callers time it by. ⛔ Every caller timing the call takes that last figure off: D46,
 * *"Such a refusal did not reach the model. It is no reviewer call."*
 */
export interface FreeTierRefusals {
	readonly count: number;
	/**
	 * ~~the rule's figure, the count × 45 s~~ ⛔ MOVED 2026-11-07 (Z3 — the lead's ruling on the second follow-up, "measure the
	 * waits"): the waits as long as they took, each measured around the wait on the same clock as `beforeLastAttemptMs`, so a wait
	 * that ran late is stated as wait, never as refused attempts' time.
	 */
	readonly waitedMs: number;
	readonly beforeLastAttemptMs: number;
}

const CARRIED = Symbol('devin free-tier refusals');

/** `failure`, carrying the refusals waited out before it (none: as it is). */
export function withFreeTierRefusals<E extends Error>(failure: E, refusals: FreeTierRefusals | undefined): E {
	return refusals === undefined ? failure : Object.assign(failure, { [CARRIED]: refusals });
}

/**
 * ⭐ THE FREE-TIER REFUSALS WAITED OUT BEFORE `value` — an answer, or the failure thrown — or `undefined` when none was.
 * ~~⚠ The waits are no part of the call that reached the model: a caller timing the call takes them off.~~ ⛔ MOVED 2026-11-07 (Z3 —
 * the lead's correction to ruling 3): ⚠ all that came before the last attempt is no part of the call that reached the model, so a
 * caller timing the call takes `beforeLastAttemptMs` off.
 */
export function freeTierRefusalsOf(value: unknown): FreeTierRefusals | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const carried = (value as { [CARRIED]?: FreeTierRefusals })[CARRIED];
	return carried ?? (value as { freeTierRefusals?: FreeTierRefusals }).freeTierRefusals;
}

/**
 * ⭐⭐ Z3 (the lead's ruling on question 5) — THE REFUSALS' FIGURES, IN THE ONE PHRASE EVERY RECORD STATES THEM IN: the failure's
 * detail (`reasoning-review-validator.ts`, `withRefusals`), the answer's observation (`devinPrint`) and the replay's. A recording
 * reads them back by its pattern (`FREE_TIER_REFUSALS_FIGURES`; `replay/recording.ts`, `freeTierRefusalsIn`), so the replay can
 * carry them as the adapter did. ⛔ The phrase and its pattern are both here, so a sentence reworded elsewhere cannot drift from what
 * the recorder reads.
 */
export function freeTierRefusalsFigures(r: FreeTierRefusals): string {
	return (
		`${r.count} free-tier refusal${r.count === 1 ? '' : 's'}: ${r.beforeLastAttemptMs - r.waitedMs} ms of refused attempts and ` +
		`${r.waitedMs} ms of waits`
	);
}

/**
 * ⭐ Z3 (Q5) — what `freeTierRefusalsFigures` writes, as a pattern: the count, the refused attempts' run time and the waits.
 * ⭑ The reader lives with the recording that needs it (`replay/recording.ts`, `freeTierRefusalsIn`): every function this folder
 * exports is reached by production code (`verif/tool-adapter-exports-reachable.test.ts`, AI-01b), and only the recorder reads it.
 * ⭑ S8786: `(?<!\d)` starts the count only at its run's first digit, so a long run of digits the phrase does not follow is
 * read once, not once from each digit. It changes no match: a match starting inside a run implies one starting a digit earlier.
 */
export const FREE_TIER_REFUSALS_FIGURES = /(?<!\d)(\d+) free-tier refusals?: (-?\d+) ms of refused attempts and (\d+) ms of waits/;

/**
 * ⭐⭐ Z3 (the lead's ruling on the second follow-up: the recorder reads only the product's own sentence) — THE WORDS EACH OF THE
 * PRODUCT'S TWO SENTENCES ON A CALL'S REFUSALS OPENS WITH, its figures right after them: the validator's, in a failed call's
 * detail (`reasoning-review-validator.ts`, `refusalsBeforeTheFailure`), and devin's adapter's, in an answer's observation
 * (`devinPrint`). A recording reads the figures there and nowhere else (`replay/recording.ts`, `freeTierRefusalsIn`). ⛔ Both
 * writers build their sentence on its opening here, so neither can be reworded away from what the recorder reads — a sentence
 * the recorder no longer found would be read as no refusals.
 */
export const FREE_TIER_REFUSALS_OPENING = Object.freeze({
	failure: 'Before this, the call met ',
	answer: 'devin answered after '
} as const);
