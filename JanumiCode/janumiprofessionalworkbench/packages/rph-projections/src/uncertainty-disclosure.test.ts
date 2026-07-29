// JPWB-SPEC-001-DR-002 W-5 — the three disclosure states, proved without a browser.
//
// The seeded reference workbench carries exactly ONE residual-uncertainty statement across 32 completion events,
// so the e2e can prove that one is rendered and very little else. It cannot exercise NONE_DECLARED against
// UNASSESSED on demand, and that distinction is the obligation (O-8-R7).
import { describe, expect, it } from 'vitest';
import { uncertaintyDisclosures, type CompletionEventLike } from './uncertainty-disclosure.js';

const completed = (subjects: string[], residuals: string[]): CompletionEventLike => ({
	eventType: 'AssuranceAssessmentCompleted',
	payload: { subjectObjectIds: subjects, residualUncertainty: residuals }
});

describe('uncertaintyDisclosures — silence and a finding of none are different facts', () => {
	it('distinguishes UNASSESSED from NONE_DECLARED, which is the whole obligation', () => {
		const [assessed, never] = uncertaintyDisclosures(
			[completed(['pwu_a'], [])],
			['pwu_a', 'pwu_b']
		);
		expect(assessed!.state, 'a completion declaring none is a FINDING of none').toBe('NONE_DECLARED');
		expect(never!.state, 'no completion at all is SILENCE, not a finding').toBe('UNASSESSED');
		// Both render zero statements. A surface that reported only the count could not tell them apart, which is
		// why `state` exists as well — the count answers O-8-R2, the state answers O-8-R7.
		expect(assessed!.disclosedCount).toBe(0);
		expect(never!.disclosedCount).toBe(0);
	});

	it('reports the statements a validator recorded', () => {
		const [d] = uncertaintyDisclosures(
			[completed(['pwu_a'], ['Offline behaviour deferred', 'Load profile unverified'])],
			['pwu_a']
		);
		expect(d!.state).toBe('DECLARED');
		expect(d!.statements).toEqual(['Offline behaviour deferred', 'Load profile unverified']);
		expect(d!.disclosedCount).toBe(2);
	});

	it('accumulates across assessments, because the LAST assessment is not the only one that found something', () => {
		const [d] = uncertaintyDisclosures(
			[completed(['pwu_a'], ['first']), completed(['pwu_a'], ['second'])],
			['pwu_a']
		);
		expect(d!.statements).toEqual(['first', 'second']);
	});

	it('a later assessment declaring NONE does not erase an earlier finding', () => {
		// Fold order must not silently retract a disclosure. If a subsequent assessment genuinely supersedes an
		// earlier one, that is a retraction someone has to make explicitly — not a side effect of ordering.
		const [d] = uncertaintyDisclosures(
			[completed(['pwu_a'], ['unresolved']), completed(['pwu_a'], [])],
			['pwu_a']
		);
		expect(d!.state).toBe('DECLARED');
		expect(d!.statements).toEqual(['unresolved']);
	});

	it('an assessment naming several subjects discloses to each of them', () => {
		const out = uncertaintyDisclosures(
			[completed(['pwu_a', 'pwu_b'], ['shared risk'])],
			['pwu_a', 'pwu_b']
		);
		expect(out.map((d) => d.state)).toEqual(['DECLARED', 'DECLARED']);
	});

	it('returns an entry for EVERY requested subject, because a missing row is not a disclosure', () => {
		const out = uncertaintyDisclosures([], ['pwu_a', 'pwu_b', 'pwu_c']);
		expect(out.map((d) => d.subjectId)).toEqual(['pwu_a', 'pwu_b', 'pwu_c']);
		expect(out.every((d) => d.state === 'UNASSESSED')).toBe(true);
	});

	it('ignores events that are not completions, and malformed payloads', () => {
		const out = uncertaintyDisclosures(
			[
				{ eventType: 'AssuranceAssessmentStarted', payload: { subjectObjectIds: ['pwu_a'] } },
				{ eventType: 'AssuranceAssessmentCompleted', payload: {} },
				{ eventType: 'AssuranceAssessmentCompleted' }
			],
			['pwu_a']
		);
		// A *Started* event must NOT mark the subject assessed: an assessment in flight has found nothing yet, and
		// reading it as NONE_DECLARED would announce a conclusion no validator has reached.
		expect(out[0]!.state).toBe('UNASSESSED');
	});
});
