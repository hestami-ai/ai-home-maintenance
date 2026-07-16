// PWU cross-axis guards — the load-bearing part of the domain kernel. A PWU carries FOUR independent state
// axes (workLifecycleState / executionState / assuranceState / shapeIntegrityState). workLifecycleState is a
// controller-computed rollup (docs §5): some of its transitions have GUARDS that reference the OTHER axes.
// This is where property P1 / INV-5 is enforced structurally: execution success NEVER implies assurance.
import { canTransition } from './stateMachine.js';

export interface PwuAxes {
	readonly workLifecycleState: string;
	readonly executionState: string;
	readonly assuranceState: string;
	readonly shapeIntegrityState: string;
}

/**
 * Cross-axis preconditions on PWU.workLifecycleState transitions, keyed `from->to`. Each predicate reads the
 * OTHER axes. The `UNDER_ASSURANCE->SATISFIED` guard is the structural expression of property P1: the only
 * legal route into SATISFIED requires assuranceState === 'SATISFIED' — a SUCCEEDED execution is never enough.
 */
const WORK_LIFECYCLE_CROSS_AXIS_GUARDS: Readonly<Record<string, (axes: PwuAxes) => boolean>> = {
	'EXECUTING->EVIDENCE_PENDING': (a) => a.executionState === 'SUCCEEDED',
	'UNDER_ASSURANCE->SATISFIED': (a) => a.assuranceState === 'SATISFIED',
	'UNDER_ASSURANCE->CONDITIONALLY_SATISFIED': (a) => a.assuranceState === 'CONDITIONALLY_SATISFIED'
};

export interface AdvanceCheck {
	readonly ok: boolean;
	readonly reason?: string;
}

// ---------------------------------------------------------------------------------------------------
// Shape readiness (SHAPING -> READY). DOC-002 (the ratified meaning authority) §9 "PWU Shape Readiness"
// L661, byte-exact:
//   "A PWU may enter `READY` only if its Shape Readiness Profile is satisfied."
// §9.1 "Minimum shape readiness fields" L665 "Every PWU requires:" — the ten limbs, byte-exact:
//   "* explicit intent reference;"
//   "* title and professional purpose;"
//   "* in-scope statement;"
//   "* out-of-scope statement or explicit “not yet known” status;"
//   "* expected output;"
//   "* at least one completion claim or verification criterion;"
//   "* known mandatory constraints;"
//   "* current assumptions;"
//   "* identified authority;"
//   "* declared risk profile."
// §8.1 L616 gives the same gate on the transition matrix: "| SHAPING | Mark ready | READY | Shape
// readiness policy satisfied |".
// Root-intent limb — DOC-002 §6.3 "Intent invariants" L472, byte-exact:
//   "* A root PWU cannot enter `READY` unless its intent is at least `PROVISIONAL`."
//
// FOUR §9.1 limbs are deliberately NOT enforced here. Each is WITHHELD, not waived: the precedent is
// Increment 2's `evidenceAdmissibility` wiring, which passed 6 of 8 §8.11 conditions and withheld the two
// the Command could not carry, because "passing a guess would re-create the defect being fixed". §0.3
// forbids the alternative outright ("must not choose a convenient interpretation and encode it as
// architecture"). The gaps are disclosed here rather than silently satisfied (§8.4 L856).
//
//   - "known mandatory constraints" / "current assumptions" — `constraintIds` / `assumptionIds` being
//     empty is indistinguishable from the professionally legitimate finding "there are none". The shape
//     carries no "none, and that is a finding" marker, and §9.1 states no cardinality for these two
//     (contrast the completion limb, which says "at least one" outright). A non-empty check here would
//     be a rule of my own devising, not DOC-002's.
//   - "identified authority" — there is NO authority field on the ratified PWU at all (DOC-002 §7.1).
//     `createdBy` is envelope provenance (who typed the command), not the responsible professional
//     authority; reading it as such would re-create the parallel-weaker-shape defect this program exists
//     to remove.
//   - "at least one completion claim or verification criterion" — THE ONE WORTH ESCALATING. The PWU
//     object carries `verificationCriterionIds` (DOC-002 §7.1 L510, DOC-007 L831), but the field has NO
//     WIRE PATH: the ratified `ProposePwuPayload` (DOC-007 §11.2) does not carry it, no other ratified
//     PWU command writes it, and `proposePwu` therefore hardcodes it to `[]` (pwu.ts). There is no
//     completion-Claim link on the PWU at all, so neither branch of the limb is reachable. Enforcing it
//     would not fail closed — it would make SHAPING -> READY unsatisfiable for EVERY PWU, permanently,
//     which contradicts DOC-002 §8.1 L616's own matrix row ("| SHAPING | Mark ready | READY | Shape
//     readiness policy satisfied |"): that row describes a transition that OCCURS when readiness holds,
//     not an unconditional deny. Adding the field to a ratified DOC-007 payload to make it reachable
//     would be inventing a contract shape. Un-withhold this the moment a ratified command writes
//     `verificationCriterionIds` — the check is one line, and its unit test is already written.
// ---------------------------------------------------------------------------------------------------

/**
 * Intent statuses that satisfy DOC-002 §6.3 L472's "at least `PROVISIONAL`". This is a position on the
 * §6.2 maturity progression (RAW -> UNDER_DISCOVERY -> PROVISIONAL -> FORMALIZED -> APPROVED <-> REVISED),
 * NOT an index into the §6.1 enum: `SUPERSEDED` and `WITHDRAWN` are declared later in that enum but are
 * exits from the progression, not advances along it — and §6.3 L476 states "A superseded intent cannot
 * authorize new PWUs."
 */
const INTENT_AT_LEAST_PROVISIONAL: ReadonlySet<string> = new Set([
	'PROVISIONAL',
	'FORMALIZED',
	'APPROVED',
	'REVISED'
]);

/** The facts a caller must read off the PWU (and its Intent) for the §9.1 / §6.3 readiness check. */
export interface PwuReadinessFacts {
	/** §9.1 "explicit intent reference". */
	readonly intentId: string;
	/** §9.1 "title and professional purpose" — title. */
	readonly title: string;
	/** §9.1 "title and professional purpose" — the professional purpose (PWU.description, DOC-002 §7.1). */
	readonly description: string;
	/** §9.1 "in-scope statement" / "out-of-scope statement or explicit “not yet known” status". */
	readonly inScope: readonly string[];
	readonly outOfScope: readonly string[];
	/** §9.1 "expected output". */
	readonly expectedOutputs: readonly unknown[];
	/** §9.1 "declared risk profile". */
	readonly hasRiskProfile: boolean;
	/** DOC-002 §6.3 L472 applies to a ROOT PWU: one with no `parentWorkUnitId` (DOC-002 §7.1). */
	readonly isRoot: boolean;
	/** The `intentStatus` of the referenced Intent (DOC-002 §6.1). */
	readonly intentStatus: string;
}

export interface ReadinessCheck {
	readonly ok: boolean;
	/** Every unmet limb, each carrying its own citation. Never abridged — §8.4 L856 "gaps are never silent". */
	readonly unmet: readonly string[];
}

/**
 * DOC-002 §9 L661: "A PWU may enter `READY` only if its Shape Readiness Profile is satisfied." Returns the
 * FULL set of unmet limbs rather than the first, so a caller can report every gap at once.
 *
 * Note the direction: this fails CLOSED. A limb whose evidence is absent is unmet, not assumed.
 */
export function checkPwuShapeReadiness(facts: PwuReadinessFacts): ReadinessCheck {
	const unmet: string[] = [];
	if (facts.intentId.trim() === '') unmet.push('explicit intent reference (DOC-002 §9.1)');
	if (facts.title.trim() === '') unmet.push('title (DOC-002 §9.1 "title and professional purpose")');
	if (facts.description.trim() === '') {
		unmet.push('professional purpose (DOC-002 §9.1 "title and professional purpose")');
	}
	if (facts.inScope.length === 0) unmet.push('in-scope statement (DOC-002 §9.1)');
	// §9.1 permits "out-of-scope statement OR explicit “not yet known” status". The ratified WorkBoundary
	// (DOC-002 §7.1) is four string arrays with no separate status field, so the "not yet known" status is
	// expressible only as an explicit outOfScope entry saying so. Either way the limb requires SOMETHING
	// stated; silence satisfies neither branch.
	if (facts.outOfScope.length === 0) {
		unmet.push('out-of-scope statement or explicit "not yet known" status (DOC-002 §9.1)');
	}
	if (facts.expectedOutputs.length === 0) unmet.push('expected output (DOC-002 §9.1)');
	if (!facts.hasRiskProfile) unmet.push('declared risk profile (DOC-002 §9.1)');
	if (facts.isRoot && !INTENT_AT_LEAST_PROVISIONAL.has(facts.intentStatus)) {
		unmet.push(
			`root PWU intent must be at least PROVISIONAL, is ${facts.intentStatus} (DOC-002 §6.3 L472)`
		);
	}
	return { ok: unmet.length === 0, unmet };
}

/**
 * Can this PWU's workLifecycleState advance from->to given ALL four axes? Combines the generic transition
 * matrix (legality) with the cross-axis guards (property P1 and friends).
 */
export function canAdvanceWorkLifecycle(from: string, to: string, axes: PwuAxes): AdvanceCheck {
	if (!canTransition('PWU.workLifecycleState', from, to)) {
		return { ok: false, reason: `not a legal PWU.workLifecycleState transition: ${from} -> ${to}` };
	}
	const guard = WORK_LIFECYCLE_CROSS_AXIS_GUARDS[`${from}->${to}`];
	if (guard && !guard(axes)) {
		return { ok: false, reason: `cross-axis guard failed for ${from} -> ${to}` };
	}
	return { ok: true };
}

/**
 * Property P1 / INV-5, stated as a predicate over a candidate PWU state: reaching workLifecycleState =
 * SATISFIED is permitted ONLY when assuranceState = SATISFIED. Returns true when the combination is consistent
 * with P1 (i.e. NOT a "satisfied-without-assurance" state). Used by conformance tests and the controller.
 */
export function satisfiesP1(axes: PwuAxes): boolean {
	if (axes.workLifecycleState === 'SATISFIED') return axes.assuranceState === 'SATISFIED';
	return true;
}
