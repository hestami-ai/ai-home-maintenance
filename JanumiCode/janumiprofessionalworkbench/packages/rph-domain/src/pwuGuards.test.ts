// PWU four-axis guards + property P1 / INV-5 (RPH-PWU + the flagship anti-collapse rule).
import { describe, expect, it } from 'vitest';
import {
	canAdvanceWorkLifecycle,
	canTransition,
	checkPwuShapeReadiness,
	getMachine,
	satisfiesP1,
	type PwuAxes,
	type PwuReadinessFacts
} from './index.js';

const axes = (over: Partial<PwuAxes> = {}): PwuAxes => ({
	workLifecycleState: 'UNDER_ASSURANCE',
	executionState: 'SUCCEEDED',
	assuranceState: 'ASSESSING',
	shapeIntegrityState: 'PRESERVED',
	...over
});

describe('PWU workLifecycle matrix (RPH-PWU)', () => {
	it('initial state is PROPOSED and primary-chain steps are legal', () => {
		expect(getMachine('PWU.workLifecycleState').initialState).toBe('PROPOSED');
		expect(canTransition('PWU.workLifecycleState', 'PROPOSED', 'SHAPING')).toBe(true);
		expect(canTransition('PWU.workLifecycleState', 'SHAPING', 'READY')).toBe(true);
		expect(canTransition('PWU.workLifecycleState', 'UNDER_ASSURANCE', 'SATISFIED')).toBe(true);
	});

	it('rejects the §8.3 illegal transitions', () => {
		const illegal: ReadonlyArray<readonly [string, string]> = [
			['PROPOSED', 'EXECUTING'],
			['EXECUTING', 'SATISFIED'],
			['SHAPING', 'SATISFIED'],
			['READY', 'BASELINED'],
			['INVALIDATED', 'BASELINED'],
			['BASELINED', 'EXECUTING']
		];
		for (const [from, to] of illegal) {
			expect(canTransition('PWU.workLifecycleState', from, to), `${from}->${to}`).toBe(false);
		}
	});
});

describe('property P1 / INV-5: execution success NEVER implies assurance satisfaction', () => {
	it('UNDER_ASSURANCE->SATISFIED requires assuranceState=SATISFIED even when execution SUCCEEDED', () => {
		expect(
			canAdvanceWorkLifecycle(
				'UNDER_ASSURANCE',
				'SATISFIED',
				axes({ executionState: 'SUCCEEDED', assuranceState: 'REJECTED' })
			).ok
		).toBe(false);
		expect(
			canAdvanceWorkLifecycle(
				'UNDER_ASSURANCE',
				'SATISFIED',
				axes({ executionState: 'SUCCEEDED', assuranceState: 'ASSESSING' })
			).ok
		).toBe(false);
		expect(
			canAdvanceWorkLifecycle(
				'UNDER_ASSURANCE',
				'SATISFIED',
				axes({ executionState: 'SUCCEEDED', assuranceState: 'SATISFIED' })
			).ok
		).toBe(true);
	});

	it('EXECUTING->SATISFIED (skipping assurance) is illegal regardless of axis values', () => {
		expect(
			canAdvanceWorkLifecycle(
				'EXECUTING',
				'SATISFIED',
				axes({ executionState: 'SUCCEEDED', assuranceState: 'SATISFIED' })
			).ok
		).toBe(false);
	});

	it('EXECUTING->EVIDENCE_PENDING requires executionState=SUCCEEDED', () => {
		expect(
			canAdvanceWorkLifecycle('EXECUTING', 'EVIDENCE_PENDING', axes({ executionState: 'RUNNING' }))
				.ok
		).toBe(false);
		expect(
			canAdvanceWorkLifecycle(
				'EXECUTING',
				'EVIDENCE_PENDING',
				axes({ executionState: 'SUCCEEDED' })
			).ok
		).toBe(true);
	});

	it('satisfiesP1 predicate: SATISFIED lifecycle demands SATISFIED assurance', () => {
		expect(satisfiesP1(axes({ workLifecycleState: 'SATISFIED', assuranceState: 'REJECTED' }))).toBe(
			false
		);
		expect(
			satisfiesP1(axes({ workLifecycleState: 'SATISFIED', assuranceState: 'SATISFIED' }))
		).toBe(true);
		// A SUCCEEDED execution with a non-satisfied assurance is a perfectly valid (non-SATISFIED) state.
		expect(
			satisfiesP1(
				axes({
					workLifecycleState: 'EVIDENCE_PENDING',
					executionState: 'SUCCEEDED',
					assuranceState: 'UNASSESSED'
				})
			)
		).toBe(true);
	});
});

// DOC-002 §9 "PWU Shape Readiness" L661 + §9.1 L665 field contract + §6.3 L472 root-Intent invariant.
describe('PWU shape readiness (DOC-002 §9.1 / §6.3)', () => {
	// A root PWU that satisfies every limb DOC-002 makes representable.
	const ready = (over: Partial<PwuReadinessFacts> = {}): PwuReadinessFacts => ({
		intentId: 'int_1',
		title: 'Field service dispatch architecture',
		description: 'Establish the dispatch decomposition and its assurance obligations',
		inScope: ['dispatch routing'],
		outOfScope: ['billing'],
		expectedOutputs: [{ outputId: 'out_1' }],
		hasRiskProfile: true,
		isRoot: true,
		intentStatus: 'PROVISIONAL',
		...over
	});

	it('a fully shaped root PWU with a PROVISIONAL intent is ready', () => {
		expect(checkPwuShapeReadiness(ready())).toEqual({ ok: true, unmet: [] });
	});

	it.each([
		['explicit intent reference', { intentId: '' }],
		['title', { title: '   ' }],
		['professional purpose', { description: '' }],
		['in-scope statement', { inScope: [] }],
		['out-of-scope statement', { outOfScope: [] }],
		['expected output', { expectedOutputs: [] }],
		['declared risk profile', { hasRiskProfile: false }]
	])('§9.1 limb: a PWU missing %s is not ready', (limb, missing) => {
		const check = checkPwuShapeReadiness(ready(missing as Partial<PwuReadinessFacts>));
		expect(check.ok).toBe(false);
		expect(check.unmet.join(' ')).toContain(limb);
	});

	// WITHHELD LIMB — visible debt, not a vanished assertion. §9.1 requires "at least one completion claim
	// or verification criterion", and the check is one line. It is withheld because no ratified command
	// writes `verificationCriterionIds` (DOC-007 §11.2's ProposePwuPayload omits it; nothing else sets it),
	// so enforcing it would make SHAPING -> READY unsatisfiable for every PWU, permanently — contradicting
	// DOC-002 §8.1 L616. See the withholding note in pwuGuards.ts.
	// UN-SKIP WHEN: a ratified command can write PWU.verificationCriterionIds (or link a completion Claim).
	// Then add `verificationCriterionIds` back to PwuReadinessFacts and the non-empty check to the guard.
	it.skip('§9.1 limb: a PWU with no completion claim or verification criterion is not ready', () => {
		const check = checkPwuShapeReadiness({
			...ready(),
			verificationCriterionIds: []
		} as PwuReadinessFacts & { verificationCriterionIds: string[] });
		expect(check.ok).toBe(false);
		expect(check.unmet.join(' ')).toContain('completion claim or verification criterion');
	});

	// §6.3 L472: "A root PWU cannot enter `READY` unless its intent is at least `PROVISIONAL`."
	it.each(['RAW', 'UNDER_DISCOVERY'])(
		'§6.3 L472: a root PWU whose intent is %s is not ready',
		(intentStatus) => {
			const check = checkPwuShapeReadiness(ready({ intentStatus }));
			expect(check.ok).toBe(false);
			expect(check.unmet.join(' ')).toContain('at least PROVISIONAL');
		}
	);

	it.each(['PROVISIONAL', 'FORMALIZED', 'APPROVED', 'REVISED'])(
		'§6.3 L472: intent %s clears the "at least PROVISIONAL" bar',
		(intentStatus) => {
			expect(checkPwuShapeReadiness(ready({ intentStatus })).ok).toBe(true);
		}
	);

	// SUPERSEDED/WITHDRAWN sit later in the §6.1 enum but are exits from the §6.2 progression, not advances
	// along it — and §6.3 L476: "A superseded intent cannot authorize new PWUs."
	it.each(['SUPERSEDED', 'WITHDRAWN'])(
		'§6.3 L476: intent %s does NOT clear the bar despite its enum position',
		(intentStatus) => {
			expect(checkPwuShapeReadiness(ready({ intentStatus })).ok).toBe(false);
		}
	);

	it('the intent-maturity limb is ROOT-only (§6.3 L472 says "a root PWU")', () => {
		expect(checkPwuShapeReadiness(ready({ isRoot: false, intentStatus: 'RAW' })).ok).toBe(true);
	});

	it('reports EVERY unmet limb, not just the first (§8.4 L856: gaps are never silent)', () => {
		const check = checkPwuShapeReadiness(
			ready({ inScope: [], outOfScope: [], expectedOutputs: [], intentStatus: 'RAW' })
		);
		expect(check.ok).toBe(false);
		expect(check.unmet).toHaveLength(4);
		expect(check.unmet.join(' ')).toContain('in-scope');
		expect(check.unmet.join(' ')).toContain('out-of-scope');
		expect(check.unmet.join(' ')).toContain('expected output');
		expect(check.unmet.join(' ')).toContain('at least PROVISIONAL');
	});
});
