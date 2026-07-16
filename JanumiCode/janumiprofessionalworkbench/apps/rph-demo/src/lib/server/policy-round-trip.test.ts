// The policy-manager criteria round-trip must not destroy ratified content.
//
// FOUND BY ADVERSARIAL REVIEW of Increment 11, against an inline comment of mine that claimed the round-trip
// "stays lossless". It did not. The criteria textarea projects only `description` (DOC-004 §7's other seven
// fields have no control), so `editPolicy` re-minted every criterion from its line. Two things died silently:
//
//   1. `name` — a seeded criterion's 'Objective fidelity' became the whole sentence.
//   2. `severityIfNotMet` — every criterion reset to BLOCKING, quietly PROMOTING the ADVISORY criteria of all
//      six additive policies to blocking. That changes what those policies MEAN: assurance-rules maps a
//      BLOCKING criterion's NOT_MET to REJECTED, whereas an ADVISORY one does not affect the disposition.
//
// (2) is the dangerous one: nothing about editing a policy's wording should make it stricter.
//
// These tests exercise the pure reader, which is where the loss happened. The `prior`-preservation contract is
// what the editPolicy action depends on.
import { describe, expect, it } from 'vitest';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { readPolicyFields } from '../../routes/pwa/[id]/policy-fields';

/** A seeded criterion as the engine actually stores it: distinct name, and ADVISORY (was `mandatory: false`). */
const SEEDED: AssessmentCriterion = {
	id: 'IC-03',
	name: 'Stakeholder representation',
	description: 'Known stakeholders and actors are represented proportionally to risk.',
	criterionType: 'BOOLEAN',
	evaluationMethod: 'MODEL_JUDGMENT',
	requiredEvidenceIds: [],
	severityIfNotMet: 'ADVISORY',
	mayBeNotApplicable: false
};

const formWith = (criteriaText: string): FormData => {
	const f = new FormData();
	f.set('criteria', criteriaText);
	f.set('name', 'Intent Completeness');
	return f;
};

describe('policy-manager criteria round-trip preserves ratified content', () => {
	it('an UNCHANGED line keeps the seeded name and severity — not re-minted', () => {
		const out = readPolicyFields(formWith(SEEDED.description), [SEEDED]);
		expect(out.criteria).toHaveLength(1);
		// The regression: without `prior`, name became the description and ADVISORY became BLOCKING.
		expect(out.criteria[0]!.name).toBe('Stakeholder representation');
		expect(out.criteria[0]!.severityIfNotMet).toBe('ADVISORY');
		expect(out.criteria[0]!.id).toBe('IC-03');
		expect(out.criteria[0]).toEqual(SEEDED);
	});

	it('editing a policy does not silently PROMOTE an ADVISORY criterion to BLOCKING', () => {
		// The load-bearing one. Re-saving a policy untouched must not change what it enforces.
		const out = readPolicyFields(formWith(SEEDED.description), [SEEDED]);
		expect(out.criteria[0]!.severityIfNotMet).not.toBe('BLOCKING');
	});

	it('reordering lines still preserves each criterion (matched by description, not index)', () => {
		const second: AssessmentCriterion = {
			...SEEDED,
			id: 'IC-04',
			name: 'Constraints recorded',
			description: 'Mandatory constraints are recorded.',
			severityIfNotMet: 'BLOCKING'
		};
		const out = readPolicyFields(formWith(`${second.description}\n${SEEDED.description}`), [
			SEEDED,
			second
		]);
		expect(out.criteria.map((c) => c.name)).toEqual([
			'Constraints recorded',
			'Stakeholder representation'
		]);
		expect(out.criteria.map((c) => c.severityIfNotMet)).toEqual(['BLOCKING', 'ADVISORY']);
	});

	it('a genuinely NEW line mints a ratified criterion with the author’s words in both name and description', () => {
		const out = readPolicyFields(formWith('A brand new criterion.'), [SEEDED]);
		expect(out.criteria).toHaveLength(1);
		expect(out.criteria[0]!.name).toBe('A brand new criterion.');
		expect(out.criteria[0]!.description).toBe('A brand new criterion.');
		// BLOCKING preserves the old `mandatory: true` default for newly authored criteria.
		expect(out.criteria[0]!.severityIfNotMet).toBe('BLOCKING');
	});

	it('an EDITED line is re-minted — its old name/severity cannot be carried onto different content', () => {
		const out = readPolicyFields(formWith('Completely different wording now.'), [SEEDED]);
		expect(out.criteria[0]!.name).toBe('Completely different wording now.');
		expect(out.criteria[0]!.severityIfNotMet).toBe('BLOCKING');
	});
});
