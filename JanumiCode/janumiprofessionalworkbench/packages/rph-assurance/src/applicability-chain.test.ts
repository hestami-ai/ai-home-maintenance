// JAN-APPLSUBJ AS-01 — the WHOLE CHAIN a production applicability decision runs through.
//
// ⭑⭑ THIS IS THE TEST THAT WOULD HAVE CAUGHT IT, AND ITS ABSENCE IS WHY NOTHING DID. `applicability.test.ts`
// builds its subject BY HAND — `riskProfile` included — so every `RISK_AT_LEAST` assertion passed while both
// production callers supplied a subject that had no profile at all. A suite that constructs the input the
// production path fails to supply cannot fail for that reason. Here the subject comes from the PROJECTOR, so
// the link under test is the one production uses.
//
// ⚠ AND THE DEFECT WAS LATENT, NOT LIVE. No shipped policy carries an executable risk gate — `RISK_AT_LEAST`
// occurs in production nowhere, and the HIGH_ASSURANCE "risk gate" is PROSE in an `appliesToRisk` description
// string. This pins the trap before it is stepped in, which is the only moment it is cheap.
import { describe, expect, it } from 'vitest';
import { applicabilitySubjectFrom, policyApplicability } from '@janumipwb/rph-domain';
import { evaluateApplicability } from './applicability.js';

/** Exactly the call production makes: project the stored state, decide, with the DSL evaluator injected. */
const decide = (state: Record<string, unknown>, rule: Record<string, unknown>) =>
	policyApplicability(rule, applicabilitySubjectFrom(state)!, (expr, subj) =>
		evaluateApplicability(expr as never, subj)
	);

const RISK_GATED = {
	objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
	expression: { op: 'RISK_AT_LEAST', dimension: 'CONSEQUENCE', level: 'HIGH' }
};

const HIGH_RISK_PWU = {
	objectType: 'PROFESSIONAL_WORK_UNIT',
	riskProfile: { consequence: 'HIGH', uncertainty: 'HIGH', securitySensitivity: 'HIGH' }
};

describe('AS-01 — a risk-gated policy decided the way production decides it', () => {
	it('⭑⭑ a HIGH-consequence work unit is GOVERNED by a RISK_AT_LEAST(CONSEQUENCE,HIGH) policy', () => {
		// THE MUTANT: drop `riskProfile` from the projector — the state at both call sites before this slice. The
		// clause then reads `false`, the outcome flips to NOT_APPLICABLE, and a policy the author gated ON high
		// consequence is silently excluded from exactly the work it was written for.
		expect(decide(HIGH_RISK_PWU, RISK_GATED)).toBe('REQUIRED');
	});

	it('⭑ CONTROL — a LOW-consequence work unit is NOT governed, so the gate is not "always true"', () => {
		// ⛔ Without this, "the gate passes" cannot be told apart from "the gate is ignored". A risk gate that
		// admits everything is as broken as one that admits nothing — it just fails silently in the other
		// direction.
		expect(
			decide({ ...HIGH_RISK_PWU, riskProfile: { consequence: 'LOW' } }, RISK_GATED)
		).toBe('NOT_APPLICABLE');
	});

	it('⭑ CONTROL — a subject with NO risk profile is correctly NOT governed', () => {
		// A PWA genuinely carries no risk, and `RISK_AT_LEAST`'s `false`-on-absence is the RIGHT answer for it.
		// ⚠ This is why the fix is at the caller and not at the operator: making absence undecidable would flip
		// every PWA to REQUIRES_HUMAN_DETERMINATION, a behaviour change to a case that is already correct.
		expect(
			decide({ objectType: 'PROFESSIONAL_WORK_UNIT' }, RISK_GATED)
		).toBe('NOT_APPLICABLE');
	});

	it('⭑ CONTROL — an UNGATED policy still governs, so this slice changed no existing verdict', () => {
		// Every policy shipped today carries objectTypeConditions and no expression. This is the shape that must
		// be untouched, and it is the population the whole seeded workbench runs on.
		expect(decide(HIGH_RISK_PWU, { objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'] })).toBe(
			'REQUIRED'
		);
	});

	it('⚠ an expression can only NARROW — a risk gate does not re-admit a wrong object type', () => {
		// The kernel states it: "a subject already excluded by object type or kind is not re-admitted by an
		// expression that happens to hold." Worth pinning here because this slice is the first to give an
		// expression real data to hold on.
		expect(
			decide(
				{ objectType: 'PROFESSIONAL_WORK_ARCHITECTURE', riskProfile: { consequence: 'HIGH' } },
				RISK_GATED
			)
		).toBe('NOT_APPLICABLE');
	});
});
