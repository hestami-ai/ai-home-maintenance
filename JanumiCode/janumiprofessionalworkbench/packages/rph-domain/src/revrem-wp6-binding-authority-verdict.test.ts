// JAN-REVREM RW-6 — `bindingAuthorityVerdict`, the extracted decision, tested DIRECTLY.
//
// WHY THIS FILE EXISTS. RW-6 moved RPH-EXE-003's four checks out of `rph-application` so the engine and the
// read-model could consult ONE declaration. Both layers then had batteries against it — and the decision itself had
// none. That is a specific hazard rather than a tidiness complaint: every existing test reaches this function through
// a layer that resolves the facts, so the CELLS THOSE LAYERS NEVER PRODUCE go unexercised, and the coverage ratchet
// caught exactly that on the first run after the extraction (`facts.authorizationStatus === undefined`, unreachable
// from either caller because both always supply a string).
//
// A pure four-cell decision with no unit tests, reachable only through two callers that each exercise a subset, is
// the F-28 shape looking at itself: assertions at one layer accepted as evidence about a rule enforced at another.
import { describe, expect, it } from 'vitest';
import { bindingAuthorityVerdict, type BindingAuthorityFacts } from './execution.js';

const STEP = 'stp_this-one';
const OK: BindingAuthorityFacts = {
	bindingId: 'bind_1',
	bindingResolves: true,
	boundStepId: STEP,
	authorizationStatus: 'AUTHORIZED'
};

describe('bindingAuthorityVerdict — the four checks, each cell named', () => {
	it('OUT_OF_SCOPE when no binding is named, and that is OK rather than a refusal', () => {
		// The rule's antecedent is "WITH a runtime binding". `ok: true` on OUT_OF_SCOPE is load-bearing: the reference
		// seed authors no RuntimeBinding at all, so a refusal here makes every existing plan unstartable (mutant B5).
		for (const bindingId of [undefined, '']) {
			const v = bindingAuthorityVerdict(STEP, { ...OK, bindingId });
			expect(v.limb, String(bindingId)).toBe('OUT_OF_SCOPE');
			expect(v.ok).toBe(true);
		}
	});

	it('UNRESOLVABLE fails CLOSED — authority that cannot be READ cannot authorize', () => {
		const v = bindingAuthorityVerdict(STEP, { bindingId: 'bind_1', bindingResolves: false });
		expect(v.limb).toBe('UNRESOLVABLE');
		expect(v.ok).toBe(false);
	});

	it('WRONG_STEP refuses a binding granted for other work, and reports what it WAS granted for', () => {
		const v = bindingAuthorityVerdict(STEP, { ...OK, boundStepId: 'stp_other' });
		expect(v.limb).toBe('WRONG_STEP');
		expect(v.boundStepId).toBe('stp_other');
	});

	it('SCOPE runs BEFORE STATUS: a REVOKED binding for another step reports WRONG_STEP, not NOT_AUTHORIZED', () => {
		// The ordering argument, asserted rather than described. Reporting "your binding is REVOKED" for a binding that
		// was never yours names the wrong defect and sends an operator to re-authorize something still refused.
		const v = bindingAuthorityVerdict(STEP, {
			...OK,
			boundStepId: 'stp_other',
			authorizationStatus: 'REVOKED'
		});
		expect(v.limb).toBe('WRONG_STEP');
	});

	it('NOT_AUTHORIZED carries the ratified kernel’s own label for the message layer to render', () => {
		for (const status of ['REQUESTED', 'DENIED', 'REVOKED']) {
			const v = bindingAuthorityVerdict(STEP, { ...OK, authorizationStatus: status });
			expect(v.limb, status).toBe('NOT_AUTHORIZED');
			expect(v.errorCode, status).toBe('RPH_BINDING_NOT_AUTHORIZED');
			expect(v.reason, status).toContain(status);
		}
	});

	it('PERMITTED for both accepted statuses — the positive half', () => {
		for (const status of ['AUTHORIZED', 'PARTIALLY_AUTHORIZED']) {
			const v = bindingAuthorityVerdict(STEP, { ...OK, authorizationStatus: status });
			expect(v.limb, status).toBe('PERMITTED');
			expect(v.ok, status).toBe(true);
		}
	});
});

describe('bindingAuthorityVerdict — the cells NEITHER caller produces (why this file had to exist)', () => {
	it('an unset boundStepId does NOT refuse: a caller that resolved the object but not the field gates nothing', () => {
		// Reading absence as "authorized for no step" would refuse EVERY step — the over-refusal mutant S2 exists to
		// catch. Both production callers always supply the field, so nothing else reaches this cell.
		const { boundStepId: _omitted, ...withoutBoundStep } = OK;
		expect(bindingAuthorityVerdict(STEP, withoutBoundStep).limb).toBe('PERMITTED');
	});

	it('an unset authorizationStatus does NOT refuse — the disclosed fail-OPEN (DS §6b R9)', () => {
		// THE LINE THE RATCHET CAUGHT. Both callers always pass a string — the handler does `String(...)`, the
		// projection requires it in `StepBindingFacts` — so this cell was unreachable from either. It is still the
		// right behaviour for a caller that resolves a binding without reading its status, and it is now asserted, so
		// it cannot be silently tightened into an emptied action column.
		const { authorizationStatus: _omitted, ...withoutStatus } = OK;
		const v = bindingAuthorityVerdict(STEP, withoutStatus);
		expect(v.limb).toBe('PERMITTED');
		expect(v.ok).toBe(true);
	});

	it('an unset bindingResolves is NO INFORMATION, distinct from a resolved FALSE', () => {
		// The asymmetry R9 turns on. `false` gates; absent does not.
		const { bindingResolves: _omitted, ...unknownResolution } = OK;
		expect(bindingAuthorityVerdict(STEP, unknownResolution).ok).toBe(true);
		expect(bindingAuthorityVerdict(STEP, { ...OK, bindingResolves: false }).ok).toBe(false);
	});
});
