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
	it('an expression yields REQUIRES_HUMAN_DETERMINATION when NO EVALUATOR IS SUPPLIED', () => {
		// CORRECTED 2026-08-05. This assertion used to be justified by "the corpus NAMES and DEFINES NOWHERE" the
		// expression type. It does define it — DOC-007 §18 ratifies the eight-op grammar and item C-9 unifies
		// `PolicyExpression` with it — and this repository has evaluated it since before the kernel was written.
		// The outcome is unchanged; the REASON is now true. Without an evaluator this call genuinely cannot decide,
		// and answering REQUIRED would report a policy applicable while a condition it carries goes unread.
		expect(
			policyApplicability(
				{ objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'], expression: { some: 'condition' } },
				PWU
			)
		).toBe('REQUIRES_HUMAN_DETERMINATION');
	});

	it('WITH an evaluator, the expression DECIDES — both ways', () => {
		const rule = { objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'], expression: { op: 'X' } };
		expect(policyApplicability(rule, PWU, () => true)).toBe('REQUIRED');
		expect(
			policyApplicability(rule, PWU, () => false),
			'an expression that does not hold means the policy does not govern this subject — that is the whole ' +
				'point of scoping by one, and returning REQUIRED anyway would be the fail-open reading'
		).toBe('NOT_APPLICABLE');
	});

	it('an expression can only NARROW — it never re-admits a subject the other conditions excluded', () => {
		// Order matters: the expression is consulted last, after object type / kind / tags. An always-true
		// expression must not rescue a subject whose kind the policy excludes, or scope would be decidable twice
		// with the looser answer winning.
		expect(
			policyApplicability(
				{ objectTypeConditions: ['PROFESSIONAL_WORK_ARCHITECTURE'], expression: { op: 'X' } },
				PWU,
				() => true
			)
		).toBe('NOT_APPLICABLE');
	});

	it('an evaluator that THROWS yields REQUIRES_HUMAN_DETERMINATION, not NOT_APPLICABLE', () => {
		// A malformed or out-of-grammar expression is undecidable, not unsatisfied. Reporting NOT_APPLICABLE would
		// be a decided negative derived from failing to understand the input — the exact confusion this kernel
		// exists to prevent, and one already made once at its call site.
		expect(
			policyApplicability(
				{ objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'], expression: { op: 'NONSENSE' } },
				PWU,
				() => {
					throw new Error('unknown op');
				}
			)
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
