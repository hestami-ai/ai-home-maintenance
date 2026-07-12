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
