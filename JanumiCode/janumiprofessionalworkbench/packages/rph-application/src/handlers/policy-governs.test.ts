// ⭐ THE §5.1 DETERMINATION, IN ONE PLACE — and the three answers it must not collapse into two.
//
// ⚠ THIS GUARD EXISTS BECAUSE THE RATCHET DEMANDED IT, AND THAT IS WORTH RECORDING. `policyGovernance` landed in
// `packages/`, which `guards:export` walks — so the gate reported `POPULATION_CHANGED` on its first run and the
// export could not ship bare. The same function in `apps/` would have shipped with nothing measuring it, which
// is the blindness `JAN-EXEC` Phase 5 had to guard by hand.
import { describe, expect, it } from 'vitest';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { policyGovernance } from './policy-governs.js';
import type { HandlerContext } from './kit.js';

const TS = '2026-09-17T00:00:00Z';
const silent = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

/** A context over a store we can plant objects in directly — the determination reads state and nothing else. */
function ctxWith(objects: Record<string, Record<string, unknown>>): HandlerContext {
	const store = {
		loadObject: (id: string) =>
			objects[id] ? { state: objects[id], revision: 1, semanticVersion: 1 } : undefined,
		readAllEvents: () => [],
		append: () => undefined
	} as unknown as SqliteStorageAdapter;
	return { store, now: () => TS, newEventId: () => 'evt_1', logger: silent } as unknown as HandlerContext;
}

const PWU = {
	objectType: 'PROFESSIONAL_WORK_UNIT',
	pwuKind: 'ARCHITECTURE',
	riskProfile: { consequence: 'HIGH' }
};

describe('⭐ policyGovernance — the §5.1 determination, with three answers rather than two', () => {
	it('⭑ an ACTIVE policy whose rule admits this subject GOVERNS', () => {
		const ctx = ctxWith({
			pol_1: { status: 'ACTIVE', applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'] },
			pwu_1: PWU
		});
		expect(policyGovernance(ctx, 'pol_1', 'pwu_1')).toBe('GOVERNS');
	});

	it('⛔ a DECIDED negative is DOES_NOT_GOVERN — the rule looked at this subject and excluded it', () => {
		const ctx = ctxWith({
			pol_1: { status: 'ACTIVE', applicableObjectTypes: ['ARTIFACT'] },
			pwu_1: PWU
		});
		expect(policyGovernance(ctx, 'pol_1', 'pwu_1')).toBe('DOES_NOT_GOVERN');
	});

	it('⛔ a SUSPENDED policy is NOT_AVAILABLE, NOT "does not govern" — and the difference is the remedy', () => {
		// ⛔ COLLAPSING THESE WOULD TELL A READER THE POLICY EXAMINED THIS SUBJECT AND DECLINED IT. A suspended
		// policy has been taken out of service; nothing has been determined about this subject at all. The two
		// have different remedies — reactivate the policy, versus accept that it does not apply here.
		const ctx = ctxWith({
			pol_1: { status: 'SUSPENDED', applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'] },
			pwu_1: PWU
		});
		expect(policyGovernance(ctx, 'pol_1', 'pwu_1')).toBe('NOT_AVAILABLE');
	});

	it('⛔ a policy that is not in the store at all is NOT_AVAILABLE', () => {
		expect(policyGovernance(ctxWith({ pwu_1: PWU }), 'pol_missing', 'pwu_1')).toBe('NOT_AVAILABLE');
	});

	it('⛔ a subject that will not resolve is UNDECIDABLE — never a decided negative', () => {
		// ⛔ THE DEFECT THE EXTRACTED CODE RECORDS HAVING COMMITTED ONCE: reading `objectType` off an absent
		// subject yielded the empty string, which matched no condition and was reported NOT_APPLICABLE — *"a
		// decided negative manufactured from having no information, at the call site of the kernel built to
		// prevent exactly that."*
		const ctx = ctxWith({ pol_1: { status: 'ACTIVE', applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'] } });
		expect(policyGovernance(ctx, 'pol_1', 'pwu_absent')).toBe('UNDECIDABLE');
	});

	it('⭐ a rule that needs a human is UNDECIDABLE, and that is NOT the same as GOVERNS', () => {
		// ⚠ THIS IS WHERE THIS FUNCTION DELIBERATELY DIFFERS FROM `RequestAssuranceAssessment`'s use of
		// `applicabilityPermitsAssessment`, which admits REQUIRES_HUMAN_DETERMINATION because it is deciding
		// whether to PERMIT an assessment. A gate deciding whether to DEMAND one must not: demanding a verdict
		// from a rule nobody could evaluate is a refusal with no route forward, which is the over-refusal `R19`
		// exists to avoid.
		const ctx = ctxWith({
			pol_1: {
				status: 'ACTIVE',
				applicability: {
					objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
					expression: { op: 'SOMETHING_NOBODY_EVALUATES' }
				}
			},
			pwu_1: PWU
		});
		expect(policyGovernance(ctx, 'pol_1', 'pwu_1')).toBe('UNDECIDABLE');
	});

	it('⭑ the legacy shape is read too — a policy with only `applicableObjectTypes` still decides', () => {
		// A policy created before `applicability` existed carries only the flat list. Deriving the rule from it
		// is what lets ONE determination read both shapes, which is the whole reason this is one function.
		const ctx = ctxWith({
			pol_1: { status: 'ACTIVE', applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'] },
			pwu_1: PWU
		});
		expect(policyGovernance(ctx, 'pol_1', 'pwu_1')).toBe('GOVERNS');
	});
});
