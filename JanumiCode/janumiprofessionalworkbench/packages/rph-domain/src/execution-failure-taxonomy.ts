// THE §36.2 EXECUTION FAILURE TAXONOMY AND ITS CONTROL-ACTION MAPPING (REG-E-025).
//
// ── WHAT THE CORPUS RATIFIES, AND WHERE ──────────────────────────────────────────────────────────────────────
// RPH-DOC-002 §36 "Failure Taxonomy" names five families — §36.1 shape (8), §36.2 execution (7), §36.3 assurance
// (7), §36.4 governance (5), §36.5 persistence (5): thirty-two classes in prose, from which no enum was ever
// minted. It closes with a rule that sits after all five and governs all of them:
//
//     "Each failure class must map to permitted control actions."
//
// That rule had never been built. This file is it, for the ONE family a field actually carries.
//
// ── A CITATION CORRECTION, RECORDED RATHER THAN QUIETLY FIXED ────────────────────────────────────────────────
// REG-E-025 and both `failureClass` field annotations cited "DOC-004 §36.2". RPH-DOC-004 §36 is *Assurance
// Profiles* (Lightweight / Standard / High) and contains no failure taxonomy at all. The right seven items were
// named under the wrong document for as long as the item was open. It is recorded because a mis-cited
// ratification is exactly how an authored claim acquires borrowed authority — the reader checks §36.2 of the
// document they were pointed at, finds a §36.2, and stops.
//
// ── WHY ONLY §36.2 IS MINTED ─────────────────────────────────────────────────────────────────────────────────
// Four `failureClass` payload fields exist and all four are about EXECUTION steps and plans. Nothing in the
// contract carries a shape, assurance, governance or persistence failure class. Minting the other twenty-five
// would create four more declared-and-unreachable vocabularies, which is REG-F-023's finding verbatim — states
// and values a machine cannot enter. They stay unminted and this is said out loud rather than left to be
// discovered: THE §36 RULE IS MET FOR ONE FAMILY OF FIVE.
//
// ── WHAT HAPPENED TO `TRANSIENT` ─────────────────────────────────────────────────────────────────────────────
// The only value ever passed at runtime was `TRANSIENT`, which appears in no §36 list and in no enum. It had no
// production producer — every occurrence was a test fixture — so constraining the field refuses nothing that any
// shipped code path emits. The fixtures now name a real class. `TRANSIENT` is not retained as an alias: an alias
// would preserve a vocabulary the corpus does not contain, and the §36 rule could not map it.
import { ControlActionSchema, ExecutionFailureClassSchema } from '@janumipwb/rph-contracts';
import type { ControlAction, ExecutionFailureClass } from '@janumipwb/rph-contracts';
import { RETRY_EXHAUSTION_ACTIONS } from './execution.js';

/**
 * The control actions permitted in response to each §36.2 execution failure class.
 *
 * ── WHICH ACTION VOCABULARY, BECAUSE THERE ARE TWO AND THEY ARE NOT NESTED ───────────────────────────────────
 * DOC-002 §37 lists EIGHTEEN control actions. The contract's `ControlAction` enum carries TWENTY-THREE, built
 * from **DOC-004 §11** (see `canonical-vocabulary.json`). §11 ADDS six — `CLARIFY`, `GATHER_CONTEXT`,
 * `CHANGE_VALIDATOR`, `INVALIDATE_DEPENDENTS`, `REQUEST_HUMAN_DECISION`, `REQUEST_WAIVER` — and RENAMES §37's
 * `WAIVE` to `REQUEST_WAIVER`. 18 + 6 − 1 = 23.
 *
 * So §11 is **not a strict superset**: `WAIVE` is in §37 and not in §11. Calling it "the superset" (as an earlier
 * draft of this comment did) is the loose kind of claim this file exists to avoid. This mapping uses §11, which
 * is the vocabulary the runtime actually validates against, and the companion test asserts membership in
 * `ControlActionSchema` under a name that says §11 — so the claim it makes is the claim it checks.
 *
 * ── THIS IS AUTHORED, AND HERE IS THE REASONING PER ROW ──────────────────────────────────────────────────────
 * The corpus ratifies the failure classes (§36.2) and the action vocabulary (§11/§37) and states that a mapping
 * must exist. It does not state the mapping. What follows is authored under the sponsor's 2026-08-05
 * ratification, built on one organising question: WHAT COULD PLAUSIBLY CHANGE THE OUTCOME? An action that cannot
 * change anything is not a permitted response, it is a way of failing twice.
 *
 * Two properties hold across every row, and both are gated in the companion test rather than merely asserted
 * here:
 *   * ESCALATE is always permitted. A failure class with no route to a human is a dead end, and §36's rule would
 *     be met in letter by a mapping that traps the runtime.
 *   * RETRY_EXHAUSTION does NOT permit RETRY. That is the whole content of the class: retrying is what has
 *     already been established not to work. A mapping that permitted it would be a table that compiled and said
 *     nothing.
 */
/** A row of the §36 mapping: the permitted actions, and WHO decided them. */
export interface FailureClassMapping {
	readonly actions: readonly ControlAction[];
	/** RATIFIED = the corpus states this set. AUTHORED = I chose it, under the 2026-08-05 grant. */
	readonly basis: 'RATIFIED' | 'AUTHORED';
	/** REQUIRED when RATIFIED and FORBIDDEN when AUTHORED — verbatim corpus words, checked by the
	 *  anti-laundering lock in the companion test. Authority cannot be implied decoratively. */
	readonly quote?: string;
	/** Why these actions and not others. The sponsor audits this; it is the field that makes an AUTHORED row
	 *  rejectable rather than merely present. */
	readonly rationale: string;
}

/**
 * The §36 mapping WITH ITS PROVENANCE — the single source for both.
 *
 * ── WHY THIS FIELD EXISTS AT ALL ─────────────────────────────────────────────────────────────────────────────
 * This table shipped as seven rows of authored judgement with the reasoning in comments. A row then silently
 * gained an action, and while both gates caught the SPELLING, nothing caught — or could have caught — that the
 * row's membership had changed, because there was no structure separating "the corpus requires this" from
 * "someone added this". **An authored governance table with no basis field is indistinguishable from a ratified
 * one, and its comments cannot fail.**
 *
 * The repository had already solved this one artifact over: `FindingAnnotation.severityBasis` + `severityQuote` +
 * `severityRationale`, with an anti-laundering lock, its inverse, and the ratio pinned as a number. This is that
 * machinery applied here. **One of seven rows is ratified.** Before this field, all seven looked alike.
 *
 * `EXECUTION_FAILURE_CONTROL_ACTIONS` is DERIVED from this, never maintained beside it — two constants naming one
 * governed set is the drifting twin this register has caught three times, once in this very file.
 */
export const EXECUTION_FAILURE_MAPPING: Readonly<Record<ExecutionFailureClass, FailureClassMapping>> = {
	TOOL_FAILURE: {
		actions: ['RETRY', 'CHANGE_TOOL', 'CHANGE_TACTIC', 'ESCALATE'],
		basis: 'AUTHORED',
		rationale:
			'The tool failed, so another tool or another approach may still succeed. CHANGE_MODEL and REVISE_PROMPT ' +
			'are deliberately ABSENT — the model and the prompt are not implicated — and that absence is what ' +
			'distinguishes this row from MODEL_FAILURE rather than leaving the two interchangeable. REQUEST_WAIVER ' +
			'was present and is REMOVED (2026-08-05): §12.2 requires a waiver to record "exact policy and ' +
			'criterion" and "finding being waived", and an execution-step failure has no policy, no criterion and ' +
			'no finding — so no §12 waiver can be CONSTITUTED for it. Worse, permitting one would mean treating a ' +
			'step as passable without the output it failed to produce, which corrupts the evidence chain rather ' +
			'than governing it. The action stays ratified for the controller generally (§37 WAIVE / §11 ' +
			'REQUEST_WAIVER); what it cannot be is a response to a §36.2 EXECUTION failure class.'
	},
	MODEL_FAILURE: {
		actions: ['RETRY', 'CHANGE_MODEL', 'REVISE_PROMPT', 'ESCALATE'],
		basis: 'AUTHORED',
		rationale:
			'Symmetric to TOOL_FAILURE: a different model or a different prompt is the lever, not a different tool. ' +
			'CHANGE_TOOL is absent for the same reason CHANGE_MODEL is absent there.'
	},
	TIMEOUT: {
		actions: ['RETRY', 'WAIT', 'CHANGE_TACTIC', 'ESCALATE'],
		basis: 'AUTHORED',
		rationale:
			'It took too long. WAIT because the work may still be progressing; CHANGE_TACTIC because a smaller unit ' +
			'of work may fit where the original did not.'
	},
	SANDBOX_FAILURE: {
		actions: ['RETRY', 'WAIT', 'ESCALATE'],
		basis: 'AUTHORED',
		rationale:
			'The execution environment failed. Nothing about the prompt, model or tool selection is implicated — this ' +
			'is infrastructure, and the honest responses are to wait for it, try again, or tell someone. The ' +
			'narrowest row in the table, deliberately.'
	},
	DEPENDENCY_UNAVAILABLE: {
		actions: ['WAIT', 'RETRY', 'CHANGE_TACTIC', 'ESCALATE'],
		basis: 'AUTHORED',
		rationale:
			'Something the step depends on is not there. WAIT (it may return) and CHANGE_TACTIC (route around it) are ' +
			'the substantive levers; RETRY covers a transient lookup.'
	},
	RETRY_EXHAUSTION: {
		// THE ONE ROW THE CORPUS DECIDED. Referenced, not copied — see RETRY_EXHAUSTION_ACTIONS.
		actions: [...RETRY_EXHAUSTION_ACTIONS],
		basis: 'RATIFIED',
		quote:
			'It must select: * change tactic; * replan; * escalate; * reject; * abandon.',
		rationale:
			'RPH-EXE-008 states the exhaustion remedy set verbatim, and states the exclusion too ("the controller ' +
			'must not issue a fourth retry") — which is why RETRY is absent here and why that absence is not a ' +
			'judgement of mine. I first authored this row as four actions and dropped REJECT; the adversarial review ' +
			'found the corpus had said five all along.'
	},
	INVALID_OUTPUT_SCHEMA: {
		actions: ['REVISE_PROMPT', 'RETRY', 'CHANGE_MODEL', 'ESCALATE'],
		basis: 'AUTHORED',
		rationale:
			'The output did not match its schema. The prompt is the first lever (the instruction may be ' +
			'underspecified), the model the second; RETRY covers non-determinism.'
	}
};

/**
 * The actions alone, DERIVED from `EXECUTION_FAILURE_MAPPING`.
 *
 * Derived rather than declared, so the provenance layer cannot drift away from the thing it describes. Every
 * consumer (`permittedControlActionsForFailure`, `isPermittedForFailure`, the read-model limb) reads this.
 */
export const EXECUTION_FAILURE_CONTROL_ACTIONS: Readonly<
	Record<ExecutionFailureClass, readonly ControlAction[]>
> = Object.fromEntries(
	Object.entries(EXECUTION_FAILURE_MAPPING).map(([k, v]) => [k, v.actions])
) as Readonly<Record<ExecutionFailureClass, readonly ControlAction[]>>;

/**
 * The control actions permitted for a failure class, or `undefined` if the class is not one of §36.2's seven.
 *
 * FAILS CLOSED, and deliberately does not fall back to a default set: a class this map does not know is a class
 * §36's rule has not been met for, and returning "the usual actions" would report a mapping that does not exist.
 */
export function permittedControlActionsForFailure(
	failureClass: string | undefined
): readonly ControlAction[] | undefined {
	if (failureClass === undefined) return undefined;
	const parsed = ExecutionFailureClassSchema.safeParse(failureClass);
	return parsed.success ? EXECUTION_FAILURE_CONTROL_ACTIONS[parsed.data] : undefined;
}

/** Is `action` a permitted response to `failureClass`? False when the class is unknown — see above. */
export function isPermittedForFailure(failureClass: string | undefined, action: string): boolean {
	const permitted = permittedControlActionsForFailure(failureClass);
	if (!permitted) return false;
	const parsed = ControlActionSchema.safeParse(action);
	return parsed.success && permitted.includes(parsed.data);
}
