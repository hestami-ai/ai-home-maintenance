// ⭐⭐ `JAN-EXEC` Phase 7, package L2 — D20 (`REG-F-580`; `REG-D-135` (4); DESIGN-data-flow-order-and-deliverable-review.md
// D20, revision 2; roadmap 9b.2a) — THE AUTHORING REVIEW'S ALLOWANCE: a server setting that gives the review in parts a
// reviewer-call allowance, and the reservation each review round makes against it.
//
// ⛔ WHY IT EXISTS. Before Send no candidate exists, the agent may author any number of types, and the authoring floor reviews
// each one inside the Send press (`REG-F-580`): so no count the paid lane makes before Send can be the floor's whole worst case,
// and the limit could be crossed inside that press. The bound has to belong to the HOST that runs the rounds — the ground
// `tools/process-run-observer.ts` argues for its own run bound — so the server holds it, and the lane hands it over and counts
// what it handed (`e2e-live-exec/lane-config.ts`, `phase7AuthoringReviewAllowance`; `phase7-operator.ts`, `authorThePwa`).
//
// ⭑ WHAT IT DOES. Before EACH review round — the turn's first, and the refinement's — the floor reserves that round's worst
// case, its parts × the validator's calls a review (`REVIEWER_CALLS_PER_REVIEW`), here (`floor.ts`, `runPwaFloor`). A round runs
// only while the worst cases already reserved and its own stay within the allowance, so the calls the floor makes never exceed
// what was reserved. A round that would pass it makes NO reviewer call: each of its parts is recorded as a review that did not
// execute, with the reason this module states (`allowanceStoppedStatement`), and the candidate is not accepted. A stopped round
// reserves nothing.
//
// ⛔ OFF BY DEFAULT: unset or blank, there is no allowance, and nothing changes. ⚠ A value that is not a whole number of calls
// stops every round with a part, saying so, rather than being read as no allowance: a typo must not lift a bound the operator
// set (fail-closed, §13.3).
//
// ⚠ ONE PER SERVER PROCESS, IN MEMORY (`processAuthoringReviewAllowance`): read from the environment once, at the first round,
// and every later round of the process — any turn's, any PWA's — reserves against the same one. A process that restarts starts
// a fresh one; the paid lane boots one server per run (`playwright.live-exec.config.ts`). Nothing here reads or writes a store.

/** The server setting: unset or blank, no allowance — the product's default, under which nothing changes. */
export const AUTHORING_REVIEW_ALLOWANCE_VARIABLE = 'JPWB_AUTHORING_REVIEW_ALLOWANCE';

/** The setting as configured: none; a whole number of reviewer calls; or a value that reads as no number of calls. */
export type AuthoringReviewAllowanceSetting =
	| { readonly kind: 'NONE' }
	| { readonly kind: 'SET'; readonly calls: number }
	| { readonly kind: 'UNREADABLE'; readonly configured: string };

/** What reserving a round's worst case came to: the round may run, or it is stopped before its first call. */
export type RoundAdmission = { readonly admitted: true } | RoundStop;

/** A round the allowance stops, before its first reviewer call — and what it was stopped by. */
export interface RoundStop {
	readonly admitted: false;
	/** The round's worst case, in reviewer calls. */
	readonly worstCase: number;
	/** The allowance, in reviewer calls; or the value configured, where it reads as no number of calls. */
	readonly allowance: number | { readonly unreadable: string };
	/** The worst cases earlier rounds of the process reserved. */
	readonly reserved: number;
	/** What is left of the allowance: the allowance less what was reserved; none, for an unreadable one. */
	readonly left: number;
}

/** The allowance a server's authoring review reserves against. */
export interface AuthoringReviewAllowance {
	/**
	 * Reserve a round's worst case BEFORE its first reviewer call: admitted, and reserved, only while the worst cases already
	 * reserved and this one stay within the allowance — reaching it is allowed; passing it is refused, and reserves nothing.
	 */
	reserve(worstCase: number): RoundAdmission;
}

/**
 * The setting, read through the server's configuration path — the environment, as the product's other `JPWB_` settings are —
 * or from the value handed in. ⭑ Trimmed; a whole number in decimal, with no sign and no leading zero, as the lane's own
 * counts are read (`phase7-operator.ts`, `priorReviewerCalls`).
 */
export function authoringReviewAllowanceSetting(
	configured: string | undefined = process.env[AUTHORING_REVIEW_ALLOWANCE_VARIABLE]
): AuthoringReviewAllowanceSetting {
	const trimmed = configured?.trim() ?? '';
	if (trimmed === '') return { kind: 'NONE' };
	if (/^(?:0|[1-9]\d*)$/.test(trimmed) && Number.isSafeInteger(Number(trimmed)))
		return { kind: 'SET', calls: Number(trimmed) };
	return { kind: 'UNREADABLE', configured: configured ?? '' };
}

/** An allowance for `setting`, nothing reserved yet. ⭑ An unreadable one is an allowance of none: a round with no call fits. */
export function createAuthoringReviewAllowance(setting: AuthoringReviewAllowanceSetting): AuthoringReviewAllowance {
	let reserved = 0;
	return {
		reserve(worstCase) {
			if (setting.kind === 'NONE') return { admitted: true };
			const calls = setting.kind === 'SET' ? setting.calls : 0;
			const left = calls - reserved;
			if (worstCase > left)
				return {
					admitted: false,
					worstCase,
					allowance: setting.kind === 'SET' ? setting.calls : { unreadable: setting.configured },
					reserved,
					left
				};
			reserved += worstCase;
			return { admitted: true };
		}
	};
}

/** The process's allowance: made at the first round from the environment, and the same one every later round reserves against. */
let processAllowance: AuthoringReviewAllowance | undefined;

/**
 * THE ALLOWANCE THIS SERVER PROCESS HOLDS — the one `runPwaFloor` reserves against when it is handed none (production hands it
 * none). ⛔ READ ONCE: the variable as it stood at the first round; a later change to the environment is not a second
 * allowance, and nothing reserved is forgotten.
 */
export function processAuthoringReviewAllowance(): AuthoringReviewAllowance {
	processAllowance ??= createAuthoringReviewAllowance(authoringReviewAllowanceSetting());
	return processAllowance;
}

/**
 * ⭐ THE STATED REASON A STOPPED ROUND RECORDS FOR EACH OF ITS PARTS — recorded as that part's review that did not execute
 * (`VALIDATOR_EXECUTION_FAILED`, the floor's own record of an incomplete review), so the page and the record read it beside the
 * part: the part as the host names it, the round's parts and worst case, the allowance, what is left and what earlier rounds
 * reserved. ⚠ Each part names itself and the round's count, never every other part: a round of N parts records N reasons, and
 * naming every part in each would grow with the square of N, in a round that is stopped only because it is large.
 */
export function allowanceStoppedStatement(
	stop: RoundStop,
	round: { readonly parts: number; readonly callsPerReview: number },
	part: { readonly typeId: string; readonly typeName: string }
): string {
	const theRound =
		`The round reviews ${round.parts} type(s), ${JSON.stringify(part.typeName)} (${part.typeId}) among them; its worst ` +
		`case is ${round.parts} × ${round.callsPerReview} = ${stop.worstCase} reviewer calls`;
	if (typeof stop.allowance !== 'number')
		return (
			'No reviewer call was made for this type: the authoring review’s allowance, ' +
			`${AUTHORING_REVIEW_ALLOWANCE_VARIABLE}=${JSON.stringify(stop.allowance.unreadable)}, is not a whole number of reviewer ` +
			'calls, so no round’s worst case can be reserved against it and no round with a type in it runs (REG-F-580; design ' +
			`D20). ${theRound}. This type is not reviewed and the candidate is not accepted.`
		);
	return (
		'No reviewer call was made for this type: the authoring review’s allowance stopped its round before the round’s first ' +
		`call (${AUTHORING_REVIEW_ALLOWANCE_VARIABLE}; REG-F-580; design D20). ${theRound}, and the allowance of ` +
		`${stop.allowance} has ${stop.left} left, ${stop.reserved} reserved by earlier rounds. A round runs only while its worst ` +
		'case fits what is left, so this type is not reviewed and the candidate is not accepted.'
	);
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L2's check, finding 2 — WHAT A STOPPED PART CARRIES UNDER ITS OWN CODE, beside the stated reason
 * (`VALIDATOR_ALLOWANCE_STOPPED`, `rph-assurance` D6; `floor.ts` `allowanceStoppedRegistry`): no reviewer failed. ⛔ Recorded as
 * a bare execution failure, the stop was answered "Configure or retry the reviewer" — which cannot clear it.
 */
export const ALLOWANCE_STOPPED_NO_REVIEWER_FAILED =
	`No reviewer failed: the authoring review’s allowance (${AUTHORING_REVIEW_ALLOWANCE_VARIABLE}) stopped this review before any ` +
	'reviewer call, so retrying, configuring or changing the reviewer does not change it (REG-F-580; design D20).';
