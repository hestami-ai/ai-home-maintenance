// THE FIFTH ARGUMENT MUST ACTUALLY REACH THE ENGINE — proved by dispatching, not by the type checker.
//
// `dispatch()` is the funnel for 25 of the 28 surface dispatch sites. It had four positional parameters and no
// slot for `expectedRevision`, so the field added to `UiCommandInput` was declared, honoured by the engine, and
// UNREACHABLE from almost every caller — a hollow one layer up from the one the census had just caught in
// `ObjectRow.revision`, made in the same increment.
//
// ⚠ WHY THIS FILE EXISTS RATHER THAN A TYPECHECK. "It compiles" would have been satisfied by a parameter that
// is accepted and dropped on the floor. This dispatches for real and asserts the ENGINE'S verdict changes —
// the only evidence that distinguishes a threaded value from an ignored one. The same increment already shipped
// two things that type-checked perfectly and did nothing.
//
// THE RULE: JPWB-DOC-003 §9 PER-4 — "Updates to existing aggregates declare the revision they believe current.
// On conflict, the command is rejected." Its NON-EXAMPLE exempts pure creations, which is why passing nothing
// stays legal here and is asserted as such.

import { describe, expect, it } from 'vitest';
import { dispatch, getEngine } from './workbench';

const CLAIM = 'clm_01ARZ3NDEKTSV4RRFFQ69M1001';
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69M1002';

/** A Claim is used because it is freely advanceable — so the ONLY thing that can refuse the third dispatch
 *  below is the revision check, not some unrelated precondition doing its job. */
describe('dispatch() threads expectedRevision through to the engine', () => {
	it('a stale expectation is refused, a current one is accepted, and none at all still creates', () => {
		// CREATE — no expectation, and PER-4's NON-EXAMPLE says none is needed.
		const created = dispatch('AssertClaim', 'CLAIM', CLAIM, {
			statement: 'the boundary holds',
			claimType: 'COMPLETENESS',
			subjectObjectIds: [SUBJECT]
		});
		expect(created.status, 'a creation needs no expected revision').toBe('ACCEPTED');

		// RENDER — this read stands in for the page load. It happens BEFORE the intervening write, which is the
		// whole of the protection (see optimistic-concurrency-surface.test.ts).
		const renderedAt = getEngine().loadObject(CLAIM)?.revision;
		expect(renderedAt, 'the store must expose a revision to declare').toBeTypeOf('number');

		// SOMEBODY ELSE WRITES — the rendered page is now stale.
		expect(
			dispatch('RecordClaimAssessment', 'CLAIM', CLAIM, { targetStatus: 'UNDER_ASSESSMENT' }).status
		).toBe('ACCEPTED');

		// THE STALE SUBMIT. CONTESTED is a legal move from UNDER_ASSESSMENT, so only the revision can refuse it.
		// MUTANT: drop `expectedRevision` from dispatch()'s parameter list or from the uiCommand call and this
		// line reddens while the control below stays green.
		const stale = dispatch(
			'RecordClaimAssessment',
			'CLAIM',
			CLAIM,
			{ targetStatus: 'CONTESTED', rationale: 'r' },
			renderedAt
		);
		expect(stale.status, 'the fifth argument must reach the engine').toBe('CONFLICT');
		expect(stale.error?.code).toBe('RPH_REVISION_CONFLICT');

		// THE CONTROL — without it, a parameter that made every dispatch conflict would satisfy the assertion
		// above. REG-F-015's anatomy: a true assertion about an arrangement that never happened.
		const fresh = dispatch(
			'RecordClaimAssessment',
			'CLAIM',
			CLAIM,
			{ targetStatus: 'CONTESTED', rationale: 'r' },
			getEngine().loadObject(CLAIM)?.revision
		);
		expect(fresh.status, 'declaring the CURRENT revision must still succeed').toBe('ACCEPTED');
	});
});
