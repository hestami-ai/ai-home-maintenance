// M3<->M2 consistency: the command->event->transition binding table (rph-contracts) must be consistent with
// the lifecycle state machines (rph-domain). Every binding whose from/to name concrete states of a known
// machine must drive a LEGAL (or NOOP) transition. This is the integration guard that keeps the command
// contracts and the state machines from drifting apart.
import { BINDINGS, FIRST_SLICE_COMMANDS } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { STATE_MACHINES, classifyTransition, getMachine } from './index.js';

const firstSlice = new Set<string>(FIRST_SLICE_COMMANDS);

function concreteBinding(b: { machine?: string; from?: string; to?: string }): boolean {
	if (!b.machine || !(b.machine in STATE_MACHINES)) return false;
	const m = getMachine(b.machine);
	// Skip non-concrete markers: '(initial)', '(any)', '(prior)', 'A|B', '(no status ...)' etc.
	return !!b.from && !!b.to && m.states.includes(b.from) && m.states.includes(b.to);
}

describe('M3 binding table <-> M2 state machines', () => {
	it('every FIRST-SLICE binding with concrete states drives a legal transition', () => {
		for (const b of BINDINGS) {
			if (!firstSlice.has(b.commandType) || !concreteBinding(b)) continue;
			const c = classifyTransition(b.machine!, b.from!, b.to!);
			expect(
				['LEGAL', 'NOOP'],
				`${b.commandType}: ${b.machine} ${b.from}->${b.to} (${c.klass})`
			).toContain(c.klass);
		}
	});

	// Known cross-doc gaps: DOC-007 has a command whose transition DOC-002's machine did not tabulate.
	// These are addressed in the milestone that owns the machine (execution -> M11). See OPEN-QUESTIONS.
	const KNOWN_CROSS_DOC_GAPS = new Set<string>([
		'CancelExecutionPlan:ExecutionPlan.status:ACTIVE->CANCELLED'
	]);

	it('every binding overall with concrete states drives a legal transition (except documented gaps)', () => {
		const violations: string[] = [];
		for (const b of BINDINGS) {
			if (!concreteBinding(b)) continue;
			const c = classifyTransition(b.machine!, b.from!, b.to!);
			if (c.klass !== 'LEGAL' && c.klass !== 'NOOP') {
				const key = `${b.commandType}:${b.machine}:${b.from}->${b.to}`;
				if (!KNOWN_CROSS_DOC_GAPS.has(key)) violations.push(`${key} (${c.klass})`);
			}
		}
		expect(violations, violations.join('; ')).toEqual([]);
	});
});
