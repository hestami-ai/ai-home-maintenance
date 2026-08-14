// REG-F-159 — THE GUARD THE OCCUPANCY CENSUS RESTS ON HAD NO TEST AT ALL.
//
// `refuseOnBirthDrift` is called at BOTH commit seams (`kit.ts` `commitState` and `createObject`) and its own
// header states the stake: *"the occupancy census reads these declarations to decide which states can ever be
// occupied, and therefore which 'covered' arrows are dead. A declaration that drifts from the code makes that
// census confidently wrong, which is worse than no census."*
//
// ⚠ AND IT WAS UNFALSIFIABLE IN THE SUITE, WHICH IS THIS PROGRAMME'S RECURRING DEFECT WEARING A GUARD'S CLOTHES.
// Every declaration in the repository agrees with the state its site commits — that is what the census passing
// MEANS — so the refusing arm was never entered by any test, and a mutant replacing the whole body with
// `return null` would have SURVIVED. The guard was doing nothing observable, and nothing could tell.
//
// So these cases enter the refusing arm DIRECTLY, with a synthetic declaration, rather than through a handler:
// no production path can reach it while the declarations are correct, and a test that needs the code to be
// broken first is a test that never runs. Same reasoning as REG-F-122's fixtures.
//
// ⚠ ONE CASE PER FAILURE MODE, AND EACH ASSERTS THE REASON. A guard with three ways to fail and one test proves
// that SOMETHING refuses, not that the right thing does — the rule `abandonment-authority.test.ts` states.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { refuseOnBirthDrift } from './kit.js';

const command = {
	commandId: 'cmd_01ARZ3NDEKTSV4RRFFQ69H2200',
	commandType: 'ProposePwu',
	targetAggregateId: 'pwu_01ARZ3NDEKTSV4RRFFQ69H2210',
	correlationId: 'cor_01ARZ3NDEKTSV4RRFFQ69H2200'
} as unknown as DomainCommand;

const AGG = 'pwu_01ARZ3NDEKTSV4RRFFQ69H2210';
const PWU_BIRTHS = [
	{ machine: 'PWU.workLifecycleState', statusField: 'workLifecycleState', values: ['PROPOSED'] },
	{ machine: 'PWU.executionState', statusField: 'executionState', values: ['NOT_PLANNED'] },
	{ machine: 'PWU.assuranceState', statusField: 'assuranceState', values: ['UNASSESSED'] },
	{ machine: 'PWU.shapeIntegrityState', statusField: 'shapeIntegrityState', values: ['UNKNOWN'] }
];
const SEEDED = {
	workLifecycleState: 'PROPOSED',
	executionState: 'NOT_PLANNED',
	assuranceState: 'UNASSESSED',
	shapeIntegrityState: 'UNKNOWN'
};

describe('REG-F-159 — a birth declaration that has drifted from the committed state is REFUSED', () => {
	it('accepts the real `proposePwu` shape: four declarations, four matching fields', () => {
		expect(refuseOnBirthDrift(command, { ...SEEDED }, AGG, PWU_BIRTHS)).toBeNull();
	});

	// ⚠ THE CASE THE ENUM SCHEMA CANNOT CATCH, AND THE ONLY REASON THIS DECLARATION BUYS ANYTHING AT RUNTIME.
	// `ExecutionStateSchema` types the field as an enum, so a non-member was already refused by the object schema.
	// `PLANNED` IS a member — a perfectly valid `executionState` — and until the declaration named `NOT_PLANNED`,
	// nothing anywhere objected to a PWU being born already planned.
	it('refuses drift to a DIFFERENT VALID member of the same enum — the gap the schema leaves open', () => {
		const result = refuseOnBirthDrift(command, { ...SEEDED, executionState: 'PLANNED' }, AGG, PWU_BIRTHS);
		expect(result?.status).toBe('REJECTED');
		expect(result?.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(result?.error?.message).toContain('PWU.executionState');
		expect(result?.error?.message).toContain('NOT_PLANNED');
		expect(result?.error?.message, 'the refusal must name what was ACTUALLY committed').toContain('"PLANNED"');
	});

	// ⚠ EACH ENTRY IS CHECKED, NOT JUST THE FIRST — the failure mode a plural array introduces. No site in this
	// repository declared more than one machine before `proposePwu` did, so this arm had never been exercised:
	// a guard that returned after `births[0]` would have passed every existing test and silently stopped checking
	// three of the four axes this increment exists to declare.
	it('CONTROL — drift in the LAST declaration is refused, so the loop does not stop at the first', () => {
		const result = refuseOnBirthDrift(command, { ...SEEDED, shapeIntegrityState: 'VIOLATED' }, AGG, PWU_BIRTHS);
		expect(result?.error?.message, 'the fourth entry must be reached').toContain('PWU.shapeIntegrityState');
	});

	// CONTROL — the assertions above are all satisfied by a guard that refuses EVERYTHING, which would be a
	// different and equally broken instrument. This holds the discriminating half at the same seam: a field the
	// declaration does not mention must not be constrained, and a declaration list with nothing in it must pass.
	it('CONTROL — an undeclared field is NOT constrained, and an empty declaration list refuses nothing', () => {
		expect(
			refuseOnBirthDrift(command, { ...SEEDED, lifecycleStatus: 'ANYTHING_AT_ALL' }, AGG, PWU_BIRTHS),
			'`lifecycleStatus` is committed but declared by no birth'
		).toBeNull();
		expect(refuseOnBirthDrift(command, { ...SEEDED }, AGG, []), 'no declarations, nothing to refuse').toBeNull();
		expect(refuseOnBirthDrift(command, { ...SEEDED }, AGG, undefined), 'undeclared is not refused').toBeNull();
	});

	// A MISSING FIELD IS DRIFT TOO, and it is the shape a rename produces: the declaration still names
	// `statusField`, the state no longer carries it, and `typeof actual !== 'string'` is what catches it.
	it('refuses a declaration whose `statusField` is absent from the committed state', () => {
		const { assuranceState: _dropped, ...withoutAssurance } = SEEDED;
		const result = refuseOnBirthDrift(command, withoutAssurance, AGG, PWU_BIRTHS);
		expect(result?.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(result?.error?.message).toContain('PWU.assuranceState');
		expect(result?.error?.message, 'an absent field reports as undefined, not as a wrong value').toContain(
			'undefined'
		);
	});
});
