// JAN-APPLSUBJ AS-01 — the applicability subject carries what the rule can ask about.
//
// ⭑⭑ THE DEFECT WAS A SUPPLY FAILURE, NOT A READER FAILURE. `RISK_AT_LEAST` resolves `$.riskProfile` and works;
// both production callers projected `{objectType, pwuKind?, tags?}` and dropped it — independently — so the
// operator read `false` for every subject, including PWUs where `riskProfile` is REQUIRED (`objects.ts:532`)
// and stored (`handlers/pwu.ts:334`).
//
// ⚠ IT IS A PRIMED TRAP, NOT LIVE SUPPRESSION, and the tests must not imply otherwise. No shipped policy carries
// an executable risk gate: `RISK_AT_LEAST` occurs in production nowhere, and the HIGH_ASSURANCE "risk gate" is
// PROSE inside an `appliesToRisk` description string. What is true is that the payload schema accepts an
// `expression`, so the first risk-gated policy authored would be NOT_APPLICABLE forever with nothing saying why.
import { describe, expect, it } from 'vitest';
import { applicabilitySubjectFrom } from './governance.js';

const PWU_STATE = {
	objectType: 'PROFESSIONAL_WORK_UNIT',
	pwuKind: 'ARCHITECTURE_DEFINITION',
	tags: ['alpha'],
	riskProfile: { consequence: 'HIGH', uncertainty: 'HIGH' },
	title: 'not projected'
};

describe('AS-01 — applicabilitySubjectFrom', () => {
	it('⭑⭑ projects riskProfile, which is the field both call sites dropped', () => {
		// THE MUTANT: omit `riskProfile` from the projector — i.e. today's behaviour at both sites. Every
		// `RISK_AT_LEAST` clause then reads `false` for a subject that plainly has a profile.
		expect(applicabilitySubjectFrom(PWU_STATE)?.riskProfile).toEqual({
			consequence: 'HIGH',
			uncertainty: 'HIGH'
		});
	});

	it('⭑ CONTROL — the three existing fields project exactly as before', () => {
		// ⛔ WITHOUT THIS, "adds riskProfile" cannot be told apart from "rewrites the projection". This slice is
		// an ADDITION: every applicability verdict reachable before it must be unchanged.
		const s = applicabilitySubjectFrom(PWU_STATE)!;
		expect(s.objectType).toBe('PROFESSIONAL_WORK_UNIT');
		expect(s.pwuKind).toBe('ARCHITECTURE_DEFINITION');
		expect(s.tags).toEqual(['alpha']);
	});

	it('⚠ an ABSENT profile leaves NO KEY — present-and-undefined is a different fact', () => {
		// ⭑ `EXISTS` tests `resolvePath(subject, path) !== undefined`, so spreading an undefined value would make
		// an absent profile answer that operator as though it were there. THE MUTANT: `riskProfile:
		// state.riskProfile` unconditionally.
		const pwa = applicabilitySubjectFrom({ objectType: 'PROFESSIONAL_WORK_ARCHITECTURE' })!;
		expect('riskProfile' in pwa).toBe(false);
	});

	it('⚠ a NULL profile is treated as absent, not projected as null', () => {
		// A stored null is the absence of a profile, not a profile. THE MUTANT: check only for `undefined` —
		// `typeof null === "object"`, so `RISK_AT_LEAST`'s own guard would then be the only thing standing
		// between a null and a member read on it.
		const s = applicabilitySubjectFrom({ objectType: 'PROFESSIONAL_WORK_UNIT', riskProfile: null })!;
		expect('riskProfile' in s).toBe(false);
	});

	it('⭑ does NOT synthesize a profile for a subject that has none', () => {
		// ⛔ A PWA genuinely carries no risk, and a risk-gated policy correctly does not govern it. Projecting
		// `{}` to look decidable would convert a CORRECT exclusion into a fiction — the fabricated-measurement
		// defect. THE MUTANT: `riskProfile: state.riskProfile ?? {}`.
		expect(applicabilitySubjectFrom({ objectType: 'PROFESSIONAL_WORK_ARCHITECTURE' })).toEqual({
			objectType: 'PROFESSIONAL_WORK_ARCHITECTURE'
		});
	});

	it('⭑ CONTROL — an object with no string objectType returns undefined: cannot decide, do not decide', () => {
		// The caller's existing guard, preserved inside the projector so it cannot be forgotten at a new site.
		expect(applicabilitySubjectFrom(undefined)).toBeUndefined();
		expect(applicabilitySubjectFrom({ objectType: 42 })).toBeUndefined();
	});

	it('⭑ carries only what the rule can ask about — not the whole stored object', () => {
		// THE MUTANT: `return { ...state }`. A rule's `expression` could then reach any field the object happens
		// to have, which is the undeclared-dependency drift the closed projection exists to prevent.
		expect(Object.keys(applicabilitySubjectFrom(PWU_STATE)!).sort()).toEqual([
			'objectType',
			'pwuKind',
			'riskProfile',
			'tags'
		]);
	});
});
