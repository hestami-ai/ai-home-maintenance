// PWU four-axis guards + property P1 / INV-5 (RPH-PWU + the flagship anti-collapse rule).
import { describe, expect, it } from 'vitest';
import {
	canAdvanceWorkLifecycle,
	canTransition,
	getMachine,
	satisfiesP1,
	type PwuAxes
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
