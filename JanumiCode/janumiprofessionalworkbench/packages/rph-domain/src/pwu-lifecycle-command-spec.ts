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

// ── THE GENERIC SETTER'S ARROWS — REG-F-119, and the other half of REG-F-114's ruling ────────────────────────
//
// `ChangePwuState` performs the PWU's MAIN LIFECYCLE SPINE, and until now the census could not see one arrow of
// it. The eleven semantically named commands above declare 49 of the machine's 57 arrows — and every one of those
// is a PERIPHERAL act: abandon, supersede, block, challenge, invalidate, reject. The eight below are the path the
// workbench actually drives:
//
//     READY -> PLANNED -> EXECUTING -> EVIDENCE_PENDING -> UNDER_ASSURANCE -> SATISFIED -> RECOMPOSING
//         -> RECOMPOSED            (and UNDER_ASSURANCE -> CONDITIONALLY_SATISFIED)
//
// The setter is invisible to the census for a structural reason: its target is `payload.newState`, resolved at
// RUNTIME, so its call site declares NOTHING — not a destination, let alone an arrow. That is the same shape
// REG-F-114 found in `advancePwuLifecycle` and ruled on: **make the idiom self-declaring and let the census read
// the declaration as DATA.** This table is that ruling applied to the fourth idiom.
//
// ── ⚠ TRANSCRIBED, NOT DERIVED, AND THE REASON IS A CONTROL THAT WOULD OTHERWISE BE UNFALSIFIABLE ─────────────
// REG-F-072 says the generic setter may not target a state a named command owns, so these eight targets are
// exactly the COMPLEMENT of the eleven above, minus `PROPOSED` — which is the BIRTH and the only state of the
// twenty with no in-edge at all. It is therefore tempting to COMPUTE this table from that complement. **Do not.**
// `verif/lifecycle-arrow-declarations.test.ts` asks whether any ratified arrow is unaccounted for by ANY command.
// If these targets were the complement BY CONSTRUCTION, the union of the two tables would cover every state
// NECESSARILY, and that gate could never fail — a control that cannot fail, authored inside the increment meant
// to strengthen it. **The transcription IS the value**: it lets the gate compare two independently authored
// artifacts, and these eight `sourceStates` are held equal to the machine's in-edges in BOTH directions.
//
// ── WHAT THIS BUYS, STATED AS NARROWLY AS REG-F-114 STATED ITS OWN ───────────────────────────────────────────
// **DRIFT and VISIBILITY. It is NOT a new guard, and it must not become one.** `checkTransition` already enforces
// the machine, and `rejectArrowOwnedBySemanticCommand` already enforces REG-F-072 at dispatch — with a DELIBERATE
// exemption for holds (`newState === current`), one of which `generic-setter-scope.test.ts` pins as ACCEPTED.
// ⚠ A `sourceStates` CHECK AT DISPATCH WOULD REFUSE THE REFERENCE UNDERTAKING: the seed HOLDS at
// `EXECUTING -> EXECUTING` and `UNDER_ASSURANCE -> UNDER_ASSURANCE`, whose declared sources here are `PLANNED`
// and `EVIDENCE_PENDING`. Measured before this table was written, not discovered after.
export const PWU_GENERIC_SETTER_SPECS: Readonly<Record<string, PwuLifecycleCommandSpec>> = {
	PLANNED: {
		commandType: 'ChangePwuState',
		target: 'PLANNED',
		eventType: 'PwuStateChanged',
		sourceStates: ['READY']
	},
	EXECUTING: {
		commandType: 'ChangePwuState',
		target: 'EXECUTING',
		eventType: 'PwuStateChanged',
		sourceStates: ['PLANNED']
	},
	EVIDENCE_PENDING: {
		commandType: 'ChangePwuState',
		target: 'EVIDENCE_PENDING',
		eventType: 'PwuStateChanged',
		sourceStates: ['EXECUTING']
	},
	UNDER_ASSURANCE: {
		commandType: 'ChangePwuState',
		target: 'UNDER_ASSURANCE',
		eventType: 'PwuStateChanged',
		sourceStates: ['EVIDENCE_PENDING']
	},
	SATISFIED: {
		commandType: 'ChangePwuState',
		target: 'SATISFIED',
		eventType: 'PwuStateChanged',
		sourceStates: ['UNDER_ASSURANCE']
	},
	CONDITIONALLY_SATISFIED: {
		commandType: 'ChangePwuState',
		target: 'CONDITIONALLY_SATISFIED',
		eventType: 'PwuStateChanged',
		sourceStates: ['UNDER_ASSURANCE']
	},
	RECOMPOSING: {
		commandType: 'ChangePwuState',
		target: 'RECOMPOSING',
		eventType: 'PwuStateChanged',
		sourceStates: ['SATISFIED']
	},
	RECOMPOSED: {
		commandType: 'ChangePwuState',
		target: 'RECOMPOSED',
		eventType: 'PwuStateChanged',
		sourceStates: ['RECOMPOSING']
	}
};

// ── THE RECOVERY COMMAND'S ARROWS — JAN-PWUWP W-5.5, under REG-D-043 and REG-F-193 ───────────────────────────
//
// ⚠ A THIRD TABLE, SHAPED DIFFERENTLY FROM THE OTHER TWO ON PURPOSE. Every command above declares a single
// `target` plus the sources it claims, because for all nineteen of those the target is a CONSTANT. The recovery
// command's target is a FUNCTION OF ITS SOURCE — a PWU blocked out of PLANNED returns to PLANNED, one blocked
// out of EXECUTING returns to EXECUTING — so no single `target` can describe it. Widening
// `PwuLifecycleCommandSpec.target` to admit a marker would put a non-state value in a field nineteen rows and
// every reader treat as a state. The shape follows the thing, rather than the thing being bent to fit the shape.
//
// ── AND THE OWNERSHIP TABLE WAS DELIBERATELY *NOT* RE-KEYED TO MATCH (REG-F-193) ─────────────────────────────
// The obvious move was to re-key `PWU_SEMANTIC_LIFECYCLE_COMMANDS` from target to arrow. It was REFUTED by
// measurement: `generic-setter-scope.test.ts` CONTROL 2 is the SOLE pin on the ownership guard running LAST, its
// subject is `PROPOSED->READY`, and that arrow is not among the 49 any command declares — so under a pure arrow
// key the lookup would miss whether it ran first or last and **that mutant would become UNKILLABLE**. No ledger
// mutant backs it up either. The guard is a UNION instead: arrow first for precision, the eleven-row target
// table retained as a fail-closed backstop. See `ownerOfArrow` below.
//
// ⚠ DERIVED FROM §8.2 REVERSED, AND `BLOCKED -> READY` IS THE DISCRIMINATING ABSENCE. §8.2 ratifies exactly
// three in-arrows to BLOCKED and one to ESCALATED; these four are those pairings traversed the other way and
// nothing else. READY is not among them. Had this set been chosen for convenience rather than derived, READY —
// the state a caller would most naturally want to resume at — is exactly what would have crept in.
export interface PwuArrow {
	readonly from: WorkLifecycleState;
	readonly to: WorkLifecycleState;
}

export interface PwuRecoveryCommandSpec {
	readonly commandType: string;
	readonly eventType: string;
	/** The explicit `from -> to` pairs this command claims. Held equal to the machine by `verif/`, both ways. */
	readonly arrows: readonly PwuArrow[];
}

export const PWU_RECOVERY_COMMAND_SPECS: Readonly<Record<string, PwuRecoveryCommandSpec>> = {
	UnblockPwu: {
		commandType: 'UnblockPwu',
		eventType: 'PwuUnblocked',
		arrows: [
			{ from: 'BLOCKED', to: 'SHAPING' },
			{ from: 'BLOCKED', to: 'PLANNED' },
			{ from: 'BLOCKED', to: 'EXECUTING' },
			{ from: 'ESCALATED', to: 'EVIDENCE_PENDING' }
		]
	}
};

/**
 * The targets the recovery command declares for a PWU currently in `from`.
 *
 * ⚠ THE CARDINALITY OF THIS RESULT IS THE DESIGN, not an implementation detail. Where it returns exactly ONE
 * target the origin is DERIVABLE from the declaration and no recorded field is needed — which is why
 * `PwuEscalated` deliberately carries no `escalatedFrom`: ESCALATED has one ratified in-arrow, so recovery from
 * it is determined by a DECLARED ARTIFACT rather than by event ORDERING, and CON-000 AX-6 forbids only the
 * latter. Where it returns MORE than one, the origin must have been RECORDED (`PwuBlocked.blockedFrom`), and a
 * PWU blocked before that field existed fails closed (AX-8).
 *
 * **So "does this state need a recorded origin?" is answered BY THE TABLE rather than by a hardcoded state
 * list.** If ESCALATED ever gains a second in-arrow, escalation recovery degrades to fail-closed on its own
 * instead of quietly picking one of two. A control pins the count at one so that degradation is loud rather
 * than merely safe.
 */
export function declaredRecoveryTargets(from: string): readonly WorkLifecycleState[] {
	return Object.values(PWU_RECOVERY_COMMAND_SPECS)
		.flatMap((s) => s.arrows)
		.filter((a) => a.from === from)
		.map((a) => a.to);
}

/**
 * Which semantically named command, if any, OWNS this arrow — the UNION REG-F-193 settled on.
 *
 * ARROW FIRST, for the precision W-5.5 needs: `BLOCKED -> PLANNED` belongs to the recovery command while
 * `READY -> PLANNED` remains the generic setter's, and a target key cannot say both.
 *
 * TARGET SECOND, AND IT IS A BACKSTOP RATHER THAN A FALLBACK: an arrow into a target some command owns is
 * refused even when no command declares that exact pairing, so the refused set is a SUPERSET of both keys and
 * the change cannot widen anything. Measured before adopting rather than argued: the two sets are identical
 * today at 49 arrows, with the symmetric difference empty in both directions.
 *
 * `ownedTargets` is passed in rather than imported because the table lives in `rph-application` — the boundary
 * runs the other way, and inverting it here would be a dependency violation for a lookup.
 */
export function ownerOfArrow(
	from: string,
	to: string,
	ownedTargets: Readonly<Record<string, string | undefined>>
): string | undefined {
	for (const spec of Object.values(PWU_RECOVERY_COMMAND_SPECS)) {
		if (spec.arrows.some((a) => a.from === from && a.to === to)) return spec.commandType;
	}
	return ownedTargets[to];
}
