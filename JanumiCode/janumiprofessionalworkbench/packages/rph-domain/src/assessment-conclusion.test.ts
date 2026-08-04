// REG-F-021 increment 0 — "has this assessment concluded?", and the exhaustiveness that makes a positive list safe.
//
// THE DEFECT THIS REPLACES. Baseline promotion asked the question inline as
//     complete = disposition !== 'ASSESSING' && disposition !== 'REQUESTED'
// The ratified §30 machine has FOUR pre-conclusion states. The exclusion named two. So EVIDENCE_PENDING and READY
// counted as CONCLUDED — harmless only because those states are unreachable today, and a fail-OPEN defect the
// moment REG-F-021 makes them reachable: a baseline promoted over an assessment that has not begun.
//
// WHY THE TEST MATTERS MORE THAN THE LIST. A positive list is only safe if nothing can fall outside it unnoticed.
// These assertions derive the machine's states from `transitions.data.ts` — the ratified source — and hold the two
// classifications against it. A state added to the machine and classified in neither set reddens here; a state in
// both reddens here. Without that, a positive list is just a different hardcoding.
import { describe, expect, it } from 'vitest';
import {
	ASSESSMENT_CONCLUDED_STATES,
	ASSESSMENT_IN_FLIGHT_STATES,
	assessmentHasConcluded
} from './governance.js';
import { getMachine } from './stateMachine.js';

const MACHINE = 'AssuranceAssessment.state';
/** Read from the RATIFIED machine, not retyped here — a hand-copied state list would make this file agree with
 *  itself rather than with the corpus. */
const machineStates = (): readonly string[] => getMachine(MACHINE).states;

const sorted = (xs: readonly string[]) => [...xs].sort((a, b) => a.localeCompare(b));

describe('assessment conclusion (REG-F-021 increment 0)', () => {
	it('CONTROL: the ratified machine is readable and has the states this classification is about', () => {
		const states = machineStates();
		expect(states).toHaveLength(15);
		expect(states).toContain('EVIDENCE_PENDING');
		expect(states).toContain('READY');
	});

	it('the two classifications EXHAUST the machine — no state can be added without being classified', () => {
		expect(
			sorted([...ASSESSMENT_CONCLUDED_STATES, ...ASSESSMENT_IN_FLIGHT_STATES]),
			'a state of the ratified machine that is in NEITHER set would be treated as not-concluded by default. ' +
				'That is the safe direction, but it must be a decision someone recorded, not a gap nobody saw'
		).toEqual(sorted(machineStates()));
	});

	it('the two classifications are DISJOINT — no state is both in flight and concluded', () => {
		const both = ASSESSMENT_CONCLUDED_STATES.filter((s) => ASSESSMENT_IN_FLIGHT_STATES.includes(s));
		expect(both).toEqual([]);
	});

	// THE DEFECT, AS AN ASSERTION. These two are the whole reason this module exists.
	it('EVIDENCE_PENDING and READY have NOT concluded — the two states the old exclusion missed', () => {
		expect(assessmentHasConcluded('EVIDENCE_PENDING')).toBe(false);
		expect(assessmentHasConcluded('READY')).toBe(false);
	});

	it('the other two in-flight states have not concluded either', () => {
		expect(assessmentHasConcluded('REQUESTED')).toBe(false);
		expect(assessmentHasConcluded('ASSESSING')).toBe(false);
	});

	it('every concluded state reports concluded — including the five the §10.1 disposition enum omits', () => {
		const notReported = ASSESSMENT_CONCLUDED_STATES.filter((s) => !assessmentHasConcluded(s));
		expect(notReported).toEqual([]);
		// The §10.1 AssuranceDisposition enum names six meanings; the MACHINE can also end in VALIDATOR_FAILED,
		// INDEPENDENCE_VIOLATION, INVALIDATED, WAIVER_EXPIRED and CANCELLED. Classifying by the disposition enum
		// alone would have left those five unconcluded and blocked promotions that should proceed.
		for (const s of ['VALIDATOR_FAILED', 'INDEPENDENCE_VIOLATION', 'INVALIDATED', 'WAIVER_EXPIRED', 'CANCELLED'])
			expect(assessmentHasConcluded(s), `${s} is a reachable end state of the machine`).toBe(true);
	});

	it('an UNKNOWN or absent state has NOT concluded — the positive list fails closed', () => {
		expect(assessmentHasConcluded(undefined)).toBe(false);
		expect(assessmentHasConcluded('SOME_FUTURE_STATE')).toBe(false);
		expect(assessmentHasConcluded('')).toBe(false);
	});
});
