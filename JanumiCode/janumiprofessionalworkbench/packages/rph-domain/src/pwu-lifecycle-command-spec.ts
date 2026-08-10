// PWU LIFECYCLE COMMAND SPECS — a lifecycle command declares its ARROW, not just its destination.
//
// ── WHY THIS TABLE EXISTS (REG-F-114, ruling REG-F-087's residue) ─────────────────────────────────────────────
// `advancePwuLifecycle` took `{ target }` and resolved the source state at RUNTIME, so a PWU lifecycle command
// declared a DESTINATION and never an arrow. Two consequences, and the second is the serious one:
//
//   1. The arrow census could not read what was never declared — 49 of the machine's 57 arrows were invisible.
//   2. **The command accepted whatever `canAdvanceWorkLifecycle` happened to allow.** No command stated the
//      source set it intended, so no reader and no test could enumerate it.
//
// This is the state the STEP commands were in before JAN-EXECREM, and `advanceStep`'s own docblock records how
// that ended: the spec fields "used to be loose, optional arguments supplied per call site and declared nowhere
// a reader or a test could enumerate, **which is why four source sets went unkilled and four plan-ACTIVE
// omissions went unstated**. A new step command cannot now be added without a row." This table is that
// settlement applied to the other machine — the repository's own solution, not a new invention.
//
// ── WHAT IT IS WORTH, STATED HONESTLY ─────────────────────────────────────────────────────────────────────────
// **It narrows nothing today.** Checked against §8.1/§8.2, every handler already intends exactly its target's
// in-edges: `invalidatePwu` means all three of SATISFIED/CONDITIONALLY_SATISFIED/RECOMPOSED, `reshapePwu` means
// both of EXECUTING/UNDER_ASSURANCE. Selling this as closing a live hole would be false. What it buys, in order:
//
//   * **DRIFT.** If the ratified machine gains an in-edge to a target, that arrow is now UNIMPLEMENTED until
//     someone says otherwise, instead of being silently accepted by whichever command targets that state.
//   * **VISIBILITY.** The census reads this as DATA — its existing second idiom — so 49 arrows stop being
//     invisible. Reading a declaration cannot fabricate one, which is why this is safe where teaching the census
//     a new AST idiom was not (REG-F-114: inferring the from-half would report arrows the code never declared).
//   * **A PLACE TO BE NARROWER.** The first command that means less than its machine allows has nowhere to say
//     so today.
//
// ⚠ EVERY `sourceStates` BELOW IS GENERATED FROM `STATE_MACHINES`, NOT TYPED. `ABANDONED` and `SUPERSEDED` carry
// SEVENTEEN in-edges each — §8.2's "Any active" and "Any non-baselined" umbrellas, 34 of the 49 between them.
// Hand-transcribing those is how a table comes to disagree with the machine it describes;
// `verif/lifecycle-arrow-declarations.test.ts` holds the two in agreement in both directions.
import type { WorkLifecycleState } from '@janumipwb/rph-contracts';

/** The machine every row below describes. Named once so the gate and the census cannot drift onto another. */
export const PWU_LIFECYCLE_MACHINE = 'PWU.workLifecycleState';

export interface PwuLifecycleCommandSpec {
	readonly commandType: string;
	/** The state this command moves the PWU TO. */
	readonly target: WorkLifecycleState;
	/** The event it emits on success. */
	readonly eventType: string;
	/**
	 * The states this command CLAIMS it may move FROM.
	 *
	 * Checked BEFORE `canAdvanceWorkLifecycle`, and the order matters: a state the machine allows but the command
	 * does not claim must be refused as an UNDECLARED ARROW, not as an illegal transition. They are different
	 * mistakes and the caller needs the right one.
	 */
	readonly sourceStates: readonly WorkLifecycleState[];
}

export type PwuLifecycleCommandType =
	| 'BeginPwuShaping'
	| 'MarkPwuReady'
	| 'ChallengePwu'
	| 'ReshapePwu'
	| 'InvalidatePwu'
	| 'SupersedePwu'
	| 'BlockPwu'
	| 'EscalatePwu'
	| 'BaselinePwu'
	| 'AbandonPwu'
	| 'RejectPwu';

export const PWU_LIFECYCLE_COMMAND_SPECS: Readonly<
	Record<PwuLifecycleCommandType, PwuLifecycleCommandSpec>
> = {
	BeginPwuShaping: {
		commandType: 'BeginPwuShaping',
		target: 'SHAPING',
		eventType: 'PwuShapingStarted',
		sourceStates: ['PROPOSED']
	},
	MarkPwuReady: {
		commandType: 'MarkPwuReady',
		target: 'READY',
		eventType: 'PwuMarkedReady',
		sourceStates: ['SHAPING']
	},
	ChallengePwu: {
		commandType: 'ChallengePwu',
		target: 'CHALLENGED',
		eventType: 'PwuChallenged',
		sourceStates: ['READY']
	},
	ReshapePwu: {
		commandType: 'ReshapePwu',
		target: 'RESHAPING',
		eventType: 'PwuReshapingStarted',
		sourceStates: ['EXECUTING', 'UNDER_ASSURANCE']
	},
	InvalidatePwu: {
		commandType: 'InvalidatePwu',
		target: 'INVALIDATED',
		eventType: 'PwuInvalidated',
		sourceStates: ['CONDITIONALLY_SATISFIED', 'SATISFIED', 'RECOMPOSED']
	},
	SupersedePwu: {
		commandType: 'SupersedePwu',
		target: 'SUPERSEDED',
		eventType: 'PwuSuperseded',
		sourceStates: [
			'PROPOSED',
			'SHAPING',
			'READY',
			'PLANNED',
			'EXECUTING',
			'EVIDENCE_PENDING',
			'UNDER_ASSURANCE',
			'CONDITIONALLY_SATISFIED',
			'SATISFIED',
			'RECOMPOSING',
			'RECOMPOSED',
			'BLOCKED',
			'CHALLENGED',
			'RESHAPING',
			'ESCALATED',
			'INVALIDATED',
			'REJECTED'
		]
	},
	BlockPwu: {
		commandType: 'BlockPwu',
		target: 'BLOCKED',
		eventType: 'PwuBlocked',
		sourceStates: ['SHAPING', 'PLANNED', 'EXECUTING']
	},
	EscalatePwu: {
		commandType: 'EscalatePwu',
		target: 'ESCALATED',
		eventType: 'PwuEscalated',
		sourceStates: ['EVIDENCE_PENDING']
	},
	BaselinePwu: {
		commandType: 'BaselinePwu',
		target: 'BASELINED',
		eventType: 'PwuBaselined',
		sourceStates: ['SATISFIED', 'RECOMPOSED']
	},
	AbandonPwu: {
		commandType: 'AbandonPwu',
		target: 'ABANDONED',
		eventType: 'PwuAbandoned',
		sourceStates: [
			'PROPOSED',
			'SHAPING',
			'READY',
			'PLANNED',
			'EXECUTING',
			'EVIDENCE_PENDING',
			'UNDER_ASSURANCE',
			'CONDITIONALLY_SATISFIED',
			'SATISFIED',
			'RECOMPOSING',
			'RECOMPOSED',
			'BLOCKED',
			'CHALLENGED',
			'RESHAPING',
			'ESCALATED',
			'INVALIDATED',
			'REJECTED'
		]
	},
	RejectPwu: {
		commandType: 'RejectPwu',
		target: 'REJECTED',
		eventType: 'PwuRejected',
		sourceStates: ['UNDER_ASSURANCE']
	},
};

/**
 * Does this command CLAIM the arrow it is being asked to perform?
 *
 * ⚠ ASKED BEFORE `canAdvanceWorkLifecycle`, AND THE ORDER IS THE POINT. A state the machine allows but the
 * command does not claim is an UNDECLARED ARROW — the caller invoked the wrong command — whereas a state the
 * machine forbids is an ILLEGAL TRANSITION. Two different mistakes with two different fixes, and collapsing them
 * into one message tells the caller to look in the wrong place.
 *
 * Pure, and separated from the handler on purpose: no real spec is narrower than its machine today (every
 * handler already intends exactly its target's in-edges), so the ONLY way to prove this discriminates is a
 * synthetic spec. Proving a mechanism on a fixture is honest; inventing a narrow production command so there is
 * something to test would not be.
 */
export function checkDeclaredSource(
	spec: PwuLifecycleCommandSpec,
	current: string
): { readonly ok: boolean; readonly reason?: string } {
	if (spec.sourceStates.includes(current as WorkLifecycleState)) return { ok: true };
	return {
		ok: false,
		reason:
			`${spec.commandType} does not declare ${current} as a source state — it claims ` +
			`[${spec.sourceStates.join(', ')}] for ${spec.target}. This is an UNDECLARED ARROW, not an illegal ` +
			`transition: the machine may well permit ${current} -> ${spec.target}, but this command does not ` +
			`claim to be the one that performs it (REG-F-114).`
	};
}
