// THE §36 RULE, GATED — "Each failure class must map to permitted control actions" (REG-E-025).
//
// A mapping is easy to write and easy to write vacuously. These are the checks that make it mean something:
// totality against the ENUM rather than against a hand-copied list, membership in the ratified action
// vocabulary, and the two substantive properties the mapping claims (ESCALATE everywhere, no RETRY after
// RETRY_EXHAUSTION). Without the last of those, a table mapping all seven classes to `[]` would pass.
import { ControlActionSchema, ExecutionFailureClassSchema } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import {
	EXECUTION_FAILURE_CONTROL_ACTIONS,
	isPermittedForFailure,
	permittedControlActionsForFailure
} from './execution-failure-taxonomy.js';

describe('DOC-002 §36.2 execution failure classes map to permitted control actions', () => {
	it('the enum IS §36.2, transcribed in document order', () => {
		// The seven prose items of "36.2 Execution failures", upper-snake-cased. Order is the document's, so a
		// reader can diff this against the section without reordering either side.
		expect(ExecutionFailureClassSchema.options).toEqual([
			'TOOL_FAILURE',
			'MODEL_FAILURE',
			'TIMEOUT',
			'SANDBOX_FAILURE',
			'DEPENDENCY_UNAVAILABLE',
			'RETRY_EXHAUSTION',
			'INVALID_OUTPUT_SCHEMA'
		]);
	});

	it('the mapping is TOTAL over the enum — derived from it, not from a copy of it', () => {
		// Keyed off ExecutionFailureClassSchema.options so an eighth class added to the vocab reddens here
		// instead of silently acquiring no mapping. A hand-maintained list would have to be remembered.
		expect(Object.keys(EXECUTION_FAILURE_CONTROL_ACTIONS).sort()).toEqual(
			[...ExecutionFailureClassSchema.options].sort()
		);
		for (const c of ExecutionFailureClassSchema.options)
			expect(
				EXECUTION_FAILURE_CONTROL_ACTIONS[c].length,
				`${c} maps to nothing — §36's rule is not met by an empty set, and a class with no permitted ` +
					'response is a state the runtime cannot leave'
			).toBeGreaterThan(0);
	});

	it('every mapped action is in the ratified ControlAction enum (DOC-004 §11, 23 values)', () => {
		// NAMED FOR WHAT IT CHECKS. An earlier draft called this "a ratified §37 ControlAction" while asserting
		// membership in `ControlActionSchema` — and those are DIFFERENT SETS. DOC-002 §37 lists 18; the contract
		// enum is DOC-004 §11's 23-value superset, and the two even disagree on a spelling (§37 `WAIVE` vs §11
		// `REQUEST_WAIVER`). A test whose name cites the narrower authority while checking the wider one is the
		// laundering shape this register keeps finding: the claim and the check must be the same claim.
		expect(ControlActionSchema.options).toHaveLength(23);
		for (const [cls, actions] of Object.entries(EXECUTION_FAILURE_CONTROL_ACTIONS))
			for (const a of actions)
				expect(ControlActionSchema.options, `${cls} permits ${a}, which is not a ControlAction`).toContain(
					a
				);
	});

	it('ESCALATE is permitted for EVERY class — no failure has a dead end', () => {
		for (const c of ExecutionFailureClassSchema.options)
			expect(
				EXECUTION_FAILURE_CONTROL_ACTIONS[c],
				`${c} offers no route to a human; §36's rule would be met in letter by a mapping that traps the runtime`
			).toContain('ESCALATE');
	});

	it('RETRY_EXHAUSTION does NOT permit RETRY — that is the whole content of the class', () => {
		// THE ASSERTION THAT MAKES THIS TABLE A JUDGEMENT RATHER THAN A LIST. Retrying is precisely what has
		// already been established not to work. If this ever goes green while RETRY is present, the mapping has
		// stopped saying anything.
		expect(EXECUTION_FAILURE_CONTROL_ACTIONS.RETRY_EXHAUSTION).not.toContain('RETRY');
		expect(isPermittedForFailure('RETRY_EXHAUSTION', 'RETRY')).toBe(false);
		// CONTROL: the same action IS permitted elsewhere, so the assertion above is about this class and not
		// about RETRY being absent from the mapping altogether.
		expect(isPermittedForFailure('TOOL_FAILURE', 'RETRY')).toBe(true);
	});

	it('an unknown class maps to NOTHING rather than to a default', () => {
		// `TRANSIENT` was the only value the runtime ever passed, and it is in no §36 list. A mapping that
		// answered for it would report a rule as met where the corpus has not met it.
		expect(permittedControlActionsForFailure('TRANSIENT')).toBeUndefined();
		expect(permittedControlActionsForFailure(undefined)).toBeUndefined();
		expect(isPermittedForFailure('TRANSIENT', 'ESCALATE')).toBe(false);
		// CONTROL: a real class does answer, so "undefined" above is a statement about the class and not about a
		// lookup that never works.
		expect(permittedControlActionsForFailure('TIMEOUT')).toContain('WAIT');
	});

	it('the four failureClass payload fields now REFUSE a non-§36.2 value', () => {
		// The point of minting the enum. Asserted through the contract schemas rather than the enum alone,
		// because the enum existing and the FIELDS using it are different claims — and the second is the one
		// REG-F-026 group (c) was actually about.
		expect(ExecutionFailureClassSchema.safeParse('TRANSIENT').success).toBe(false);
		expect(ExecutionFailureClassSchema.safeParse('TIMEOUT').success).toBe(true);
	});
});
