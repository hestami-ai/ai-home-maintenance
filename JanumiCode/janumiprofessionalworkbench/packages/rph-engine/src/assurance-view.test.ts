// The Assurance View (DOC-004 §38) folded from the LIVE reference undertaking log — not a hand fixture.
//
// This is the payoff of the §38 mapping (Increments 32-35): the read model the Assurance Workbench renders,
// built from the assurance events the seed now actually emits (Increments 25-28). The test asserts BOTH halves
// of the honest contract: the fields the log genuinely sources ARE populated and correct, and the fields it does
// NOT source are visibly absent (undefined), never faked into a reassuring value.
import { buildAssuranceView } from '@janumipwb/rph-projections';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking, REFERENCE_UNDERTAKING } from './index.js';

describe('Assurance View (DOC-004 §38) over the live log', () => {
	function build() {
		const engine = createEngine({
			ontology,
			now: () => '2026-07-12T00:00:00Z',
			newEventId: (() => {
				let s = 0;
				return () => `evt_${++s}`;
			})()
		});
		driveReferenceUndertaking(engine);
		return buildAssuranceView(engine.readAllEvents());
	}

	it('folds the reference undertaking into a non-trivial set of assessments', () => {
		const view = build();
		const assessments = Object.values(view.assessments);
		// The reference undertaking runs many assessments (per-PWU fitness + three floor policies per AI output).
		expect(assessments.length).toBeGreaterThan(10);
		// Every assessment names the policy it was judged under and at least one subject — §38 "applicable
		// policies" (assessed sense) resolves to something real, not empty.
		expect(assessments.every((a) => a.policyId.length > 0 && a.subjectObjectIds.length > 0)).toBe(
			true
		);
	});

	it('§38 POPULATED: the fields the log sources are present and correct', () => {
		const view = build();
		const assessments = Object.values(view.assessments);

		// disposition + assessment state: every completed assessment carries a terminal disposition, and the
		// state tracks it (not left at ASSESSING).
		const dispositions = new Set(assessments.map((a) => a.disposition).filter(Boolean));
		expect(dispositions.has('SATISFIED')).toBe(true);
		expect(dispositions.has('CONDITIONALLY_SATISFIED')).toBe(true);
		for (const a of assessments) {
			if (a.disposition) expect(a.assessmentState).toBe(a.disposition);
		}

		// evidence considered: the conditionally-satisfied fitness assessment of Mobile & Offline considered the
		// admitted evidence.
		const conditional = assessments.find(
			(a) =>
				a.disposition === 'CONDITIONALLY_SATISFIED' &&
				a.subjectObjectIds.includes(REFERENCE_UNDERTAKING.mobileOffline)
		);
		expect(conditional, 'the conditionally-satisfied Mobile & Offline assessment').toBeDefined();
		expect(conditional!.evidenceConsideredIds.length).toBeGreaterThan(0);

		// open conditions: a CONDITIONALLY_SATISFIED disposition surfaces its residual as an open condition;
		// a SATISFIED one has none.
		expect(conditional!.openConditions.length).toBeGreaterThan(0);
		const satisfied = assessments.find((a) => a.disposition === 'SATISFIED');
		expect(satisfied!.openConditions).toEqual([]);

		// findings + severity: the Mobile & Offline assessment recorded a MATERIAL observation.
		expect(conditional!.observations.length).toBeGreaterThan(0);
		expect(conditional!.observations.some((o) => o.severity === 'MATERIAL')).toBe(true);

		// validator implementation identity (Increment 37): the conditionally-satisfied fitness assessment names
		// the validator that judged it, at its version — §38 "validator implementation identity", §22 "validator/
		// version". Threaded from the §20 ValidatorResult the completion command already carried.
		expect(conditional!.validatorImplementationIdentity).toBe('reference-undertaking.reviewer');
		expect(conditional!.validatorImplementationVersion).toBe('1');
		// EVERY completed assessment records who/what judged it — the floor assessments carry their own
		// deterministic validator identity too. None is left blank: a completed assessment with no recorded author
		// is exactly the §22 audit gap this increment closed.
		const completedAssessments = assessments.filter((a) => a.disposition);
		expect(completedAssessments.length).toBeGreaterThan(10);
		expect(
			completedAssessments.every((a) => (a.validatorImplementationIdentity ?? '').length > 0)
		).toBe(true);
		expect(
			assessments.some((a) => a.validatorImplementationIdentity?.startsWith('deterministic.'))
		).toBe(true);
	});

	it('§38 independence status: fitness assessments are VERIFIED (a real DIFFERENT_AGENT pass); floor assessments are unknown (check skipped)', () => {
		const view = build();
		const assessments = Object.values(view.assessments);
		// Increments I1/I2/I4: the fitness assessments run under the DIFFERENT_AGENT policy with a producer supplied
		// and the distinct evaluator, so the check RAN and PASSED — independence is VERIFIED, not merely asserted.
		const conditional = assessments.find(
			(a) =>
				a.disposition === 'CONDITIONALLY_SATISFIED' &&
				a.subjectObjectIds.includes(REFERENCE_UNDERTAKING.mobileOffline)
		);
		expect(conditional!.independenceStatus).toBe('VERIFIED');
		expect(assessments.some((a) => a.independenceStatus === 'VERIFIED')).toBe(true);
		// The floor assessments supply no producer, so the check is SKIPPED — independence stays undefined (unknown),
		// never a fabricated pass. The log therefore genuinely distinguishes VERIFIED from unknown.
		expect(assessments.some((a) => a.independenceStatus === undefined)).toBe(true);
		// And nothing is a fabricated VIOLATION — the seed's independence genuinely holds.
		expect(assessments.every((a) => a.independenceStatus !== 'VIOLATED')).toBe(true);
	});

	// NOTE: the "open conditions ONLY while conditional" GUARD is NOT provable over this log — every SATISFIED
	// assessment the reference undertaking emits carries an empty residualUncertainty, so a fold that ignored the
	// disposition and just copied residuals would pass here too (mutation-verified: it does). The guard is proved
	// in rph-projections/src/assurance-view.test.ts against a SATISFIED-with-residuals event this log never makes.
	// This file asserts only what the live data genuinely distinguishes, above — no test here overclaims.
});
