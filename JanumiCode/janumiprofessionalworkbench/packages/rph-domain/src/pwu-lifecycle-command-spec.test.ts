// A-3 — the declared source set is CHECKED, and an undeclared arrow is a DIFFERENT mistake from an illegal one.
//
// ⚠ TESTED AGAINST A SYNTHETIC SPEC, AND THAT IS THE HONEST CHOICE RATHER THAN A CONVENIENT ONE. No production
// spec is narrower than its machine today — every handler already intends exactly its target's in-edges (§8.1,
// §8.2) — so no real command can currently produce this refusal. The options were: prove the mechanism on a
// fixture, or invent a narrow production command so there would be something to test. The second manufactures
// the evidence, which is the shape REG-F-104 refused for rejection and REG-F-022 calls Gate A.
//
// What makes the fixture honest is that the LIVE half is proved elsewhere and not skipped: the eleven real
// commands still perform their arrows (`pwu.test.ts` and the handler suites), and
// `verif/lifecycle-arrow-declarations.test.ts` holds every spec's `sourceStates` equal to the machine's in-edges
// in both directions. So this file proves the check DISCRIMINATES; those prove it is WIRED to the truth.
import { describe, expect, it } from 'vitest';
import {
	checkDeclaredSource,
	PWU_LIFECYCLE_COMMAND_SPECS,
	type PwuLifecycleCommandSpec
} from './pwu-lifecycle-command-spec.js';

/** A spec that claims ONE of the two source states its machine actually allows for RESHAPING. */
const NARROW: PwuLifecycleCommandSpec = {
	commandType: 'ReshapePwuNarrowFixture',
	target: 'RESHAPING',
	eventType: 'PwuReshapingStarted',
	sourceStates: ['EXECUTING']
};

describe('checkDeclaredSource — a command performs the arrows it claims, and no others', () => {
	it('ACCEPTS a source state the spec claims', () => {
		expect(checkDeclaredSource(NARROW, 'EXECUTING').ok).toBe(true);
	});

	it('REFUSES a state the MACHINE allows but the spec does not claim — the undeclared arrow', () => {
		// UNDER_ASSURANCE -> RESHAPING is a ratified arrow (§8.2, "Blocking finding"). The machine permits it;
		// this fixture command does not claim it. That must be refused, or the declaration is decoration.
		const r = checkDeclaredSource(NARROW, 'UNDER_ASSURANCE');
		expect(r.ok).toBe(false);
		expect(r.reason).toContain('UNDECLARED ARROW');
		expect(r.reason, 'the refusal must name what the command DOES claim').toContain('EXECUTING');
	});

	it('the refusal distinguishes itself from an illegal transition IN WORDS, not only in code', () => {
		// A caller who reads "illegal transition" goes and looks at the machine. A caller who reads "this command
		// does not claim it" goes and finds the command that does. The message is the whole difference.
		const r = checkDeclaredSource(NARROW, 'UNDER_ASSURANCE');
		expect(r.reason).toContain('not an illegal transition');
	});

	// CONTROL — the check is not vacuously true for everything. Without this, a `checkDeclaredSource` that
	// returned `{ ok: true }` unconditionally would pass the first test and fail nothing a caller would notice.
	it('CONTROL — a state NO spec claims is refused by every real spec', () => {
		const nonsense = 'NOT_A_STATE';
		const accepted = Object.values(PWU_LIFECYCLE_COMMAND_SPECS).filter(
			(s) => checkDeclaredSource(s, nonsense).ok
		);
		expect(accepted.map((s) => s.commandType), 'specs accepting a state that does not exist').toEqual([]);
	});

	// CONTROL — and it is not vacuously FALSE either. Every real spec accepts its own first source state, so a
	// check that refused everything would be caught here rather than looking like a strict gate.
	it('CONTROL — every real spec accepts each source state it declares', () => {
		for (const spec of Object.values(PWU_LIFECYCLE_COMMAND_SPECS))
			for (const from of spec.sourceStates)
				expect(
					checkDeclaredSource(spec, from).ok,
					`${spec.commandType} must accept its own declared source ${from}`
				).toBe(true);
	});
});
