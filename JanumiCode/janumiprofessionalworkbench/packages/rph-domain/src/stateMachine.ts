// The generic state-machine guard engine. Every object lifecycle is a table in transitions.data.ts; this
// module classifies and enforces same-axis transitions. Illegal transitions fail LOUD with a typed
// RPH_ILLEGAL_STATE_TRANSITION (Constitution: fail loud on invariants; never silently repair state).
import { makeRphError, RphErrorException } from '@janumipwb/rph-contracts';
import { STATE_MACHINES, type StateMachineSpec } from './transitions.data.js';

export type TransitionClass =
	'LEGAL' | 'NOOP' | 'ILLEGAL_EXPLICIT' | 'ILLEGAL_UNDEFINED' | 'UNKNOWN_STATE';

export function getMachine(name: string): StateMachineSpec {
	const m = STATE_MACHINES[name];
	if (!m) throw new Error(`Unknown state machine: ${name}`);
	return m;
}

export function machineNames(): string[] {
	return Object.keys(STATE_MACHINES);
}

export function isValidState(machine: string, state: string): boolean {
	return getMachine(machine).states.includes(state);
}

export function initialStateOf(machine: string): string | undefined {
	return getMachine(machine).initialState;
}

export function isTerminalState(machine: string, state: string): boolean {
	return getMachine(machine).terminalStates.includes(state);
}

export interface Classification {
	readonly klass: TransitionClass;
	readonly reason?: string;
}

/** Classify a same-axis transition against the machine's legal + explicitly-illegal tables. */
export function classifyTransition(machine: string, from: string, to: string): Classification {
	const m = getMachine(machine);
	if (!m.states.includes(from))
		return { klass: 'UNKNOWN_STATE', reason: `unknown from-state '${from}'` };
	if (!m.states.includes(to)) return { klass: 'UNKNOWN_STATE', reason: `unknown to-state '${to}'` };
	// JAN-CMDPRE DWP-07 (D2/D6): the `illegal` table is consulted BEFORE the from === to shortcut, so a machine that
	// DECLARES a self-edge illegal — forbidding an in-place mutation, e.g. §24.2 "an AUTHORITATIVE baseline is
	// immutable" (AUTHORITATIVE -> AUTHORITATIVE) — classifies ILLEGAL_EXPLICIT, not NOOP. An UNdeclared self-edge
	// (the common case) still falls through to NOOP just below. Ordering these the other way silently downgraded a
	// declared prohibition to a permitted no-op.
	const explicit = m.illegal.find((i) => i.from === from && i.to === to);
	if (explicit) return { klass: 'ILLEGAL_EXPLICIT', reason: explicit.reason };
	if (from === to) return { klass: 'NOOP' };
	if (m.transitions.some((t) => t.from === from && t.to === to)) return { klass: 'LEGAL' };
	return {
		klass: 'ILLEGAL_UNDEFINED',
		reason: `transition ${from} -> ${to} is not in the ${machine} matrix`
	};
}

/**
 * canTransition — LEGAL ONLY (a NOOP is NOT a transition). The STRICT sibling of the application layer's
 * `checkTransition` (kit.ts), which admits LEGAL **or** NOOP. The split is deliberate and load-bearing (JAN-CMDPRE
 * DWP-07 / D2):
 *   - GUARDS use `canTransition` (LEGAL only): `canActivatePlan`, `canPromoteBaseline`, `canAdvanceWorkLifecycle` —
 *     they must REFUSE a same-state re-issue, so a NOOP reads as "cannot". This is precisely why those sites were
 *     GUARD_ONLY_ACCIDENTAL: they refused the NOOP re-issue, but with the guard's code, not the state code.
 *   - The write primitive `advanceStatus` uses `checkTransition` (LEGAL|NOOP): the NOOP is admitted at the machine
 *     layer and refused ONE layer up by the command's `precondition` (JAN-CMDPRE) — which is why re-issue legality is
 *     declared PER COMMAND, not baked into the machine.
 * A DECLARED illegal self-edge (DWP-07) is neither LEGAL nor NOOP: `canTransition` is false AND `checkTransition` refuses.
 */
export function canTransition(machine: string, from: string, to: string): boolean {
	return classifyTransition(machine, from, to).klass === 'LEGAL';
}

export interface AssertOpts {
	readonly correlationId: string;
	readonly targetObjectIds?: string[];
}

/** Throw RPH_ILLEGAL_STATE_TRANSITION unless the transition is LEGAL (a same-state NOOP is permitted). */
export function assertTransition(
	machine: string,
	from: string,
	to: string,
	opts: AssertOpts
): void {
	const c = classifyTransition(machine, from, to);
	if (c.klass === 'LEGAL' || c.klass === 'NOOP') return;
	const reasonSuffix = c.reason ? ` (${c.reason})` : '';
	throw new RphErrorException(
		makeRphError('RPH_ILLEGAL_STATE_TRANSITION', {
			message: `Illegal transition on ${machine}: ${from} -> ${to}${reasonSuffix}`,
			correlationId: opts.correlationId,
			targetObjectIds: opts.targetObjectIds ?? [],
			details: { machine, from, to, classification: c.klass }
		})
	);
}
