// Policy applicability (DOC-004 §5.1 / §5.2) — does a policy govern this work at all?
//
// THE KERNEL IS BUILT AND NOT WIRED, so these tests are the only thing standing behind it. That is stated rather
// than assumed: a deferred kernel with no tests is a promise, and the reason it is deferred (the de minimis floor
// is scoped to PROFESSIONAL_WORK_ARCHITECTURE by a limitation the seeder itself discloses as §16-unresolved) will
// be resolved by someone who needs an instrument waiting, not a function nobody has exercised.
//
// The sharp edge is what it REFUSES to decide. §5.1's `expression` is a `PolicyExpression` — a type the corpus
// NAMES and DEFINES NOWHERE. Answering from the fields we DO understand while ignoring one we do not is the
// fail-open reading: a policy whose real condition is "externally delegated work only" would be reported
// applicable to everything.
import { describe, expect, it } from 'vitest';
import { applicabilityPermitsAssessment, policyApplicability } from './governance.js';

const PWU = { objectType: 'PROFESSIONAL_WORK_UNIT' as const };

describe('policyApplicability (DOC-004 §5.1 / §5.2)', () => {
	it('CONTROL: a rule that matches yields REQUIRED — otherwise every NOT_APPLICABLE below is a broken matcher', () => {
		expect(policyApplicability({ objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'] }, PWU)).toBe(
			'REQUIRED'
		);
	});

	it('an object type the policy does not name is NOT_APPLICABLE', () => {
		expect(
			policyApplicability({ objectTypeConditions: ['PROFESSIONAL_WORK_ARCHITECTURE'] }, PWU)
		).toBe('NOT_APPLICABLE');
	});

	it('pwuKindConditions is an ALLOW-LIST when present and unrestricted when absent', () => {
		const rule = { objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'], pwuKindConditions: ['ARCHITECTURE'] };
		expect(policyApplicability(rule, { ...PWU, pwuKind: 'ARCHITECTURE' })).toBe('REQUIRED');
		expect(policyApplicability(rule, { ...PWU, pwuKind: 'PRODUCT_REALIZATION' })).toBe('NOT_APPLICABLE');
		// Absent restriction means the policy does not restrict by kind — NOT that it restricts to none.
		expect(
			policyApplicability({ objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'] }, {
				...PWU,
				pwuKind: 'PRODUCT_REALIZATION'
			})
		).toBe('REQUIRED');
	});

	it('a kind-scoped policy does not apply to a subject that HAS no kind', () => {
		// A PWA has no pwuKind. A policy restricted to PWU kinds cannot be satisfied by one, and guessing "the
		// restriction does not apply so let it through" would be the fail-open reading.
		expect(
			policyApplicability(
				{ objectTypeConditions: ['PROFESSIONAL_WORK_ARCHITECTURE'], pwuKindConditions: ['ARCHITECTURE'] },
				{ objectType: 'PROFESSIONAL_WORK_ARCHITECTURE' }
			)
		).toBe('NOT_APPLICABLE');
	});

	it('requiredTags must all be present; excludedTags must all be absent', () => {
		const base = { objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'] };
		expect(policyApplicability({ ...base, requiredTags: ['regulated'] }, PWU)).toBe('NOT_APPLICABLE');
		expect(
			policyApplicability({ ...base, requiredTags: ['regulated'] }, { ...PWU, tags: ['regulated'] })
		).toBe('REQUIRED');
		expect(
			policyApplicability({ ...base, excludedTags: ['internal'] }, { ...PWU, tags: ['internal'] })
		).toBe('NOT_APPLICABLE');
	});

	// ── WHAT IT REFUSES TO DECIDE ─────────────────────────────────────────────────────────────────────────────
	it('an opaque expression yields REQUIRES_HUMAN_DETERMINATION even when every other field matches', () => {
		expect(
			policyApplicability(
				{ objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'], expression: { some: 'condition' } },
				PWU
			),
			'answering REQUIRED here would report a policy applicable on the strength of the conditions we happen ' +
				'to understand, while a condition we do not understand goes unread. An unevaluable condition is not ' +
				'an absent one'
		).toBe('REQUIRES_HUMAN_DETERMINATION');
	});

	it('a structured (non-string) objectTypeCondition is undecidable, not unsatisfied', () => {
		// The corpus never defines ObjectTypeCondition, so a structured one cannot be compared. Reporting
		// NOT_APPLICABLE would be a DECIDED NEGATIVE derived from having no way to decide.
		expect(policyApplicability({ objectTypeConditions: [{ type: 'PWU', when: 'x' }] }, PWU)).toBe(
			'REQUIRES_HUMAN_DETERMINATION'
		);
	});

	it('no rule at all is permissive — an absent scope has not declared this subject out', () => {
		expect(policyApplicability(undefined, PWU)).toBe('REQUIRED');
		expect(policyApplicability({}, PWU)).toBe('REQUIRED');
	});

	// ── THE CONTESTABLE JUDGEMENT, ON ITS OWN LINE ────────────────────────────────────────────────────────────
	it('only NOT_APPLICABLE forbids assessing; an undecidable outcome is PERMITTED and disclosed', () => {
		expect(applicabilityPermitsAssessment('NOT_APPLICABLE')).toBe(false);
		expect(applicabilityPermitsAssessment('REQUIRES_HUMAN_DETERMINATION')).toBe(true);
		for (const o of ['REQUIRED', 'RECOMMENDED', 'OPTIONAL'] as const)
			expect(applicabilityPermitsAssessment(o)).toBe(true);
		// Refusing on REQUIRES_HUMAN_DETERMINATION would block real work on a condition nobody can evaluate;
		// treating it as NOT_APPLICABLE would let the undecidable pass as decided. Permitting it and surfacing the
		// outcome is the third option, and it is a judgement — asserted here so it is reviewable, not buried.
	});
});
