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
	});

	it('§38 ABSENT-BY-SOURCE: validator identity and independence are undefined, not faked', () => {
		const view = build();
		const assessments = Object.values(view.assessments);
		// These two §38 fields have NO source in the log today (the event drops validatorId; only the
		// independence REQUIREMENT is logged, never a verified status). The view must leave them undefined —
		// rendering them as anything concrete would be a fabricated assurance fact.
		expect(assessments.every((a) => a.validatorImplementationIdentity === undefined)).toBe(true);
		expect(assessments.every((a) => a.independenceStatus === undefined)).toBe(true);
	});

	// NOTE: the "open conditions ONLY while conditional" GUARD is NOT provable over this log — every SATISFIED
	// assessment the reference undertaking emits carries an empty residualUncertainty, so a fold that ignored the
	// disposition and just copied residuals would pass here too (mutation-verified: it does). The guard is proved
	// in rph-projections/src/assurance-view.test.ts against a SATISFIED-with-residuals event this log never makes.
	// This file asserts only what the live data genuinely distinguishes, above — no test here overclaims.
});
