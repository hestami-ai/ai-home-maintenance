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

/**
 * The control actions §37 permits in response to each §36.2 execution failure class.
 *
 * ── THIS IS AUTHORED, AND HERE IS THE REASONING PER ROW ──────────────────────────────────────────────────────
 * The corpus ratifies the failure classes (§36.2) and the action vocabulary (§37) and states that a mapping must
 * exist. It does not state the mapping. What follows is authored under the sponsor's 2026-08-05 ratification,
 * built on one organising question: WHAT COULD PLAUSIBLY CHANGE THE OUTCOME? An action that cannot change
 * anything is not a permitted response, it is a way of failing twice.
 *
 * Two properties hold across every row, and both are gated in the companion test rather than merely asserted
 * here:
 *   * ESCALATE is always permitted. A failure class with no route to a human is a dead end, and §36's rule would
 *     be met in letter by a mapping that traps the runtime.
 *   * RETRY_EXHAUSTION does NOT permit RETRY. That is the whole content of the class: retrying is what has
 *     already been established not to work. A mapping that permitted it would be a table that compiled and said
 *     nothing.
 */
export const EXECUTION_FAILURE_CONTROL_ACTIONS: Readonly<
	Record<ExecutionFailureClass, readonly ControlAction[]>
> = {
	// The tool itself failed. Another tool, or another approach, may still succeed; the model and the prompt are
	// not implicated, so changing them is noise.
	TOOL_FAILURE: ['RETRY', 'CHANGE_TOOL', 'CHANGE_TACTIC', 'ESCALATE'],
	// The model failed. Symmetric to the above: a different model or a different prompt is the lever, not a
	// different tool.
	MODEL_FAILURE: ['RETRY', 'CHANGE_MODEL', 'REVISE_PROMPT', 'ESCALATE'],
	// It took too long. WAIT is permitted because the work may still be progressing; CHANGE_TACTIC because a
	// smaller unit of work may fit where the original did not.
	TIMEOUT: ['RETRY', 'WAIT', 'CHANGE_TACTIC', 'ESCALATE'],
	// The execution environment failed. Nothing about the prompt, model or tool selection is implicated — this is
	// infrastructure, and the honest responses are to wait for it, try again, or tell someone.
	SANDBOX_FAILURE: ['RETRY', 'WAIT', 'ESCALATE'],
	// Something the step depends on is not there. WAIT (it may return) and CHANGE_TACTIC (route around it) are
	// the substantive levers; RETRY covers a transient lookup.
	DEPENDENCY_UNAVAILABLE: ['WAIT', 'RETRY', 'CHANGE_TACTIC', 'ESCALATE'],
	// Retries are spent. RETRY is deliberately ABSENT — see the class doc above. What remains is to plan
	// differently, approach differently, escalate, or stop; ABANDON is included because "stop" must be sayable,
	// and a class whose only exits require someone else to act is how a runtime hangs.
	RETRY_EXHAUSTION: ['REPLAN_EXECUTION', 'CHANGE_TACTIC', 'ESCALATE', 'ABANDON'],
	// The output did not match its schema. The prompt is the first lever (the instruction may be underspecified),
	// the model the second; RETRY covers non-determinism.
	INVALID_OUTPUT_SCHEMA: ['REVISE_PROMPT', 'RETRY', 'CHANGE_MODEL', 'ESCALATE']
};

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
