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
import { policyApplicability } from '@janumipwb/rph-domain';
import {
	policyEditPatch,
	readPolicyFields,
	successorPolicyPayload
} from '../../routes/pwa/[id]/policy-fields';

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

// ── ⛔⛔ JAN-EXECGOV EG-04 — A FORM KEY NOBODY CAN SET STOPS WIDENING GOVERNANCE ────────────────────────────────
//
// The tests above caught a round-trip that DESTROYED authored content. This is the same file's other half, and
// it is worse: a round-trip that WIDENS what a policy governs, through a key the author cannot even see.
//
// ⭑ `applicableObjectTypes` is read from the form at `policy-fields.ts` and emitted by NO control. Measured
// across history: `name="applicableObjectTypes"` has never appeared in any `.svelte` file in this repository.
// The reader was written on 2026-07-15 (`691aa014`) for a control that was never built, and `+page.server.ts`
// still projects the stored value into the form model under a comment describing *"a comma-separated text
// input"* that does not exist.
//
// ⚠ IT SURVIVED EVERY GUARD BECAUSE `[]` IS TRUTHY. `csvList(null)` returned `[]`; the create fallback
// `f.applicableObjectTypes || 'PROFESSIONAL_WORK_UNIT'` was therefore DEAD (and type-wrong — a string where the
// schema demands an array, so it would have been REJECTED had it ever fired), and the edit guard
// `f.applicableObjectTypes ? {…} : {}` was ALWAYS taken. Three lines below it, `criteria` was guarded with
// `.length`. Two spellings of one guard, in one function, on one screen — which is why the guard now lives in
// ONE exported function rather than inline at each field.
//
// ⛔ AND THE HARM IS A WIDENING, NOT A LOSS, WHICH IS WHY THESE TESTS ASSERT AN OUTCOME AND NOT A FIELD.
// `governance.ts` guards its `NOT_APPLICABLE` limb on `objectTypes.length > 0`, so an EMPTY condition set skips
// the guard and falls through to `REQUIRED`. Driven against the engine before the fix: a policy created for
// `PROFESSIONAL_WORK_UNIT` was `NOT_APPLICABLE` to a PWA, and after a RENAME it was `REQUIRED`. Both commands
// ACCEPTED. Asserting `applicableObjectTypes` alone would go green the day someone "fixes" this by writing `[]`
// into both fields consistently, so the assertion is what the kernel CONCLUDES.
describe('EG-04 — a policy edit cannot widen what the policy applies to', () => {
	/** The policy form as the markup actually posts it: eight keys, and `applicableObjectTypes` is not one. */
	const realPolicyForm = (): FormData => {
		const f = new FormData();
		for (const [k, v] of [
			['name', 'Intent Completeness'],
			['purpose', 'p'],
			['rationale', 'r'],
			['evaluatedClaimTypes', 'CORRECTNESS'],
			['evaluatorRole', 'reviewer'],
			['independenceRequirement', 'DIFFERENT_AGENT'],
			['permittedControlActions', 'ESCALATE'],
			['criteria', SEEDED.description]
		])
			f.set(k!, v!);
		return f;
	};

	it('⭑ CONTROL — the arrangement is the real one: the form carries no applicableObjectTypes key', () => {
		// ⛔ WITHOUT THIS THE WHOLE BLOCK IS ARRANGED, NOT MEASURED. If a control is ever added, this test must
		// fail and be re-read rather than quietly keep asserting a shape the surface no longer has.
		expect(realPolicyForm().get('applicableObjectTypes')).toBeNull();
	});

	it('⛔ a form that carries no scope key yields NO scope value — absent is not empty', () => {
		// THE MUTANT: return `[]` for a missing key, which is what `csvList` did. `[]` is truthy, so every guard
		// downstream selects it and the surface asserts a scope the author never expressed.
		expect(readPolicyFields(realPolicyForm()).applicableObjectTypes).toBeUndefined();
	});

	it('⛔⛔ the edit patch OMITS the scope, so a rename cannot change what a policy governs', () => {
		// The kernel already has the correct limb — `reconcileApplicability` early-returns on
		// `p.applicableObjectTypes === undefined` with the comment *"scope untouched by this edit"* — and this
		// surface could never reach it. This is what makes it reachable.
		expect(policyEditPatch(readPolicyFields(realPolicyForm()))).not.toHaveProperty(
			'applicableObjectTypes'
		);
	});

	it('⛔⛔ THE OUTCOME: a renamed policy still does NOT apply to an object type it never claimed', () => {
		// ⭑ THE ASSERTION THAT MATTERS. Driven through the same kernel predicate the §5.1 determination uses.
		// Before the fix this returned REQUIRED — the policy applied to a PWA it was never scoped to.
		const patch = policyEditPatch(readPolicyFields(realPolicyForm()));
		const scopeAfterEdit =
			'applicableObjectTypes' in patch
				? (patch.applicableObjectTypes as string[])
				: ['PROFESSIONAL_WORK_UNIT']; // the stored value the kernel keeps when the patch omits it
		expect(
			policyApplicability({ objectTypeConditions: scopeAfterEdit }, {
				objectType: 'PROFESSIONAL_WORK_ARCHITECTURE'
			}),
			'an empty condition set skips the NOT_APPLICABLE guard and falls through to REQUIRED'
		).toBe('NOT_APPLICABLE');
	});

	it('⭑ CONTROL — a key the form DOES carry is still patched, so this is not "omit everything"', () => {
		// ⛔ Without this the fix is satisfiable by sending no patch at all, and editing a policy would silently
		// do nothing — the opposite defect, and a worse one.
		const patch = policyEditPatch(readPolicyFields(realPolicyForm()));
		expect(patch.evaluatedClaimTypes).toEqual(['CORRECTNESS']);
		expect(patch.permittedControlActions).toEqual(['ESCALATE']);
		expect(patch.name).toBe('Intent Completeness');
	});

	it('⛔ a scope key present but EMPTY is a deliberate CLEARING, and is patched as one', () => {
		// ⭐ THIS IS THE ASSERTION THAT GIVES `policyEditPatch` A MUTANT IT CAN FAIL. Reverting the guard to bare
		// truthiness leaves the suite GREEN — `undefined` is falsy and `[]` is truthy, so the two spellings agree
		// on every value an array can take, and the fix that mattered was `csvList`. THE MUTANT THIS ONE KILLS:
		// guard with `?.length`, which would silently swallow an author emptying the scope on purpose and make
		// 'cleared' indistinguishable from 'never asked' — the exact conflation this slice exists to end.
		const f = realPolicyForm();
		f.set('applicableObjectTypes', '');
		expect(policyEditPatch(readPolicyFields(f))).toHaveProperty('applicableObjectTypes', []);
	});

	it('⚠ a scope key that IS present is honoured — absence and emptiness stay different facts', () => {
		// The distinction this whole fix rests on. A surface that grows the control must be able to CLEAR a
		// scope deliberately; only an ABSENT key means "untouched".
		const f = realPolicyForm();
		f.set('applicableObjectTypes', 'PROFESSIONAL_WORK_UNIT, ARTIFACT');
		expect(policyEditPatch(readPolicyFields(f)).applicableObjectTypes).toEqual([
			'PROFESSIONAL_WORK_UNIT',
			'ARTIFACT'
		]);
	});
});

// ── ⛔ THE SECOND LIVE PATH ONTO THE SAME HARM ────────────────────────────────────────────────────────────────
//
// `successorPolicyPayload`'s own docblock said *"every field of the predecessor copied verbatim"*. It copied
// SEVENTEEN and omitted two: `applicability` and `remediationRules`. Because create derives
// `applicability ?? { objectTypeConditions: applicableObjectTypes }`, versioning a KIND-scoped policy returned a
// successor with no `pwuKindConditions` at all.
//
// ⭑⭑ AND THAT ARM IS THE ONLY REASON THE SEEDED CATALOG IS SAFE FROM THE DEFECT ABOVE. All twelve catalog
// policies carry `pwuKindConditions`; the object-type arm is what the surface empties, and the kind arm is what
// still refuses. So the two defects compose: press "Create & activate version" on a catalog policy and the
// protection is gone. That is a property of the DATA, not of the code, which is why it is asserted here.
describe('EG-04 — versioning a policy preserves the scope arms it was authored with', () => {
	const KIND_SCOPED = {
		name: 'Decomposition coverage',
		applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
		applicability: {
			objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
			pwuKindConditions: ['DECOMPOSITION']
		},
		remediationRules: [{ ruleId: 'R-1' }],
		evaluatedClaimTypes: ['COVERAGE'],
		criteria: [],
		permittedControlActions: ['ESCALATE']
	};

	it('⛔ the successor keeps the pwuKindConditions arm — the only guard the catalog still has', () => {
		// THE MUTANT: drop `applicability` from the payload, which is the shipped state. The successor is then
		// scoped by object type alone and assesses every kind of work unit its predecessor refused.
		const out = successorPolicyPayload(KIND_SCOPED, 'pol-2', '2.0.0');
		expect(out.applicability).toEqual(KIND_SCOPED.applicability);
	});

	it('⛔ the successor keeps its remediation rules', () => {
		// Subset-validated against `permittedControlActions` at create, so losing them is silent.
		expect(successorPolicyPayload(KIND_SCOPED, 'pol-2', '2.0.0').remediationRules).toEqual([
			{ ruleId: 'R-1' }
		]);
	});

	it('⭑ CONTROL — a predecessor with NO applicability rule does not gain an empty one', () => {
		// ⛔ Copying `applicability` unconditionally would write `undefined`, and `create` derives the rule from
		// `applicableObjectTypes` when it is absent. Sending an explicit `undefined` is not the same as omitting.
		const flat = { ...KIND_SCOPED, applicability: undefined };
		expect(successorPolicyPayload(flat, 'pol-2', '2.0.0')).not.toHaveProperty('applicability');
	});

	it('⭑ CONTROL — the seventeen fields it already copied are still copied', () => {
		const out = successorPolicyPayload(KIND_SCOPED, 'pol-2', '2.0.0');
		expect(out.policyId).toBe('pol-2');
		expect(out.version).toBe('2.0.0');
		expect(out.name).toBe('Decomposition coverage');
		expect(out.applicableObjectTypes).toEqual(['PROFESSIONAL_WORK_UNIT']);
	});
});
