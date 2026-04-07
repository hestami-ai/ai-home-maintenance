import { describe, it, expect } from 'vitest';
import {
	resolveHumanFacingState,
	getHumanFacingStateLabel,
	getHumanFacingStateClass,
} from '../../../lib/workflow/humanFacingState';
import { Phase } from '../../../lib/types';
import { HumanFacingState } from '../../../lib/types/maker';

describe('HumanFacingState', () => {
	describe('resolveHumanFacingState', () => {
		it('maps INTAKE with DISCUSSING to UNDERSTANDING', () => {
			const result = resolveHumanFacingState(Phase.INTAKE, {
				hasOpenGates: false,
				intakeSubState: 'DISCUSSING',
			});

			expect(result.state).toBe(HumanFacingState.UNDERSTANDING);
			expect(result.detail).toContain('Grounding');
		});

		it('maps INTAKE with SYNTHESIZING to FRAMING', () => {
			const result = resolveHumanFacingState(Phase.INTAKE, {
				hasOpenGates: false,
				intakeSubState: 'SYNTHESIZING',
			});

			expect(result.state).toBe(HumanFacingState.FRAMING);
			expect(result.detail).toContain('Synthesizing');
		});

		it('maps INTAKE with AWAITING_APPROVAL to NEEDS_INPUT', () => {
			const result = resolveHumanFacingState(Phase.INTAKE, {
				hasOpenGates: false,
				intakeSubState: 'AWAITING_APPROVAL',
			});

			expect(result.state).toBe(HumanFacingState.NEEDS_INPUT);
			expect(result.detail).toContain('review and approval');
		});

		it('maps PROPOSE to PLANNING', () => {
			const result = resolveHumanFacingState(Phase.PROPOSE, {
				hasOpenGates: false,
			});

			expect(result.state).toBe(HumanFacingState.PLANNING);
			expect(result.detail).toContain('task graph');
		});

		it('maps ASSUMPTION_SURFACING to PLANNING', () => {
			const result = resolveHumanFacingState(Phase.ASSUMPTION_SURFACING, {
				hasOpenGates: false,
			});

			expect(result.state).toBe(HumanFacingState.PLANNING);
			expect(result.detail).toContain('assumptions');
		});

		it('maps VERIFY to VERIFYING', () => {
			const result = resolveHumanFacingState(Phase.VERIFY, {
				hasOpenGates: false,
			});

			expect(result.state).toBe(HumanFacingState.VERIFYING);
			expect(result.detail).toContain('Validating');
		});

		it('maps HISTORICAL_CHECK to VERIFYING', () => {
			const result = resolveHumanFacingState(Phase.HISTORICAL_CHECK, {
				hasOpenGates: false,
			});

			expect(result.state).toBe(HumanFacingState.VERIFYING);
			expect(result.detail).toContain('historical');
		});

		it('maps REVIEW to NEEDS_INPUT', () => {
			const result = resolveHumanFacingState(Phase.REVIEW, {
				hasOpenGates: false,
			});

			expect(result.state).toBe(HumanFacingState.NEEDS_INPUT);
			expect(result.detail).toContain('approval');
		});

		it('maps EXECUTE to EXECUTING', () => {
			const result = resolveHumanFacingState(Phase.EXECUTE, {
				hasOpenGates: false,
			});

			expect(result.state).toBe(HumanFacingState.EXECUTING);
			expect(result.detail).toContain('Applying changes');
		});

		it('maps EXECUTE with repair context to REPAIRING', () => {
			const result = resolveHumanFacingState(Phase.EXECUTE, {
				hasOpenGates: false,
				isRepairing: true,
			});

			expect(result.state).toBe(HumanFacingState.REPAIRING);
			expect(result.detail).toContain('repair');
		});

		it('maps VALIDATE to VERIFYING', () => {
			const result = resolveHumanFacingState(Phase.VALIDATE, {
				hasOpenGates: false,
			});

			expect(result.state).toBe(HumanFacingState.VERIFYING);
			expect(result.detail).toContain('acceptance');
		});

		it('maps COMMIT to COMPLETE', () => {
			const result = resolveHumanFacingState(Phase.COMMIT, {
				hasOpenGates: false,
			});

			expect(result.state).toBe(HumanFacingState.COMPLETE);
			expect(result.detail).toContain('completed');
		});

		it('maps REPLAN to PLANNING', () => {
			const result = resolveHumanFacingState(Phase.REPLAN, {
				hasOpenGates: false,
			});

			expect(result.state).toBe(HumanFacingState.PLANNING);
			expect(result.detail).toContain('replanning');
		});

		it('overrides to BLOCKED when gates are open (except REVIEW)', () => {
			const result = resolveHumanFacingState(Phase.EXECUTE, {
				hasOpenGates: true,
			});

			expect(result.state).toBe(HumanFacingState.BLOCKED);
			expect(result.detail).toContain('decision');
		});

		it('does not override REVIEW phase with gate status', () => {
			const result = resolveHumanFacingState(Phase.REVIEW, {
				hasOpenGates: true,
			});

			expect(result.state).toBe(HumanFacingState.NEEDS_INPUT);
		});

		it('includes progress information for EXECUTE', () => {
			const result = resolveHumanFacingState(Phase.EXECUTE, {
				hasOpenGates: false,
				unitsCompleted: 3,
				unitsTotal: 10,
			});

			expect(result.progress).toBeDefined();
			if (result.progress) {
				expect(result.progress.completed).toBe(3);
				expect(result.progress.total).toBe(10);
			}
		});

		it('includes current unit label in EXECUTE', () => {
			const unitLabel = 'Create authentication module';
			const result = resolveHumanFacingState(Phase.EXECUTE, {
				hasOpenGates: false,
				currentUnitLabel: unitLabel,
			});

			expect(result.detail).toContain(unitLabel);
			expect(result.currentUnit).toBe(unitLabel);
		});

		it('includes current unit label in REPAIRING', () => {
			const unitLabel = 'Fix validation errors';
			const result = resolveHumanFacingState(Phase.EXECUTE, {
				hasOpenGates: false,
				isRepairing: true,
				currentUnitLabel: unitLabel,
			});

			expect(result.detail).toContain(unitLabel);
			expect(result.currentUnit).toBe(unitLabel);
		});

		it('handles undefined intake sub-state', () => {
			const result = resolveHumanFacingState(Phase.INTAKE, {
				hasOpenGates: false,
			});

			expect(result.state).toBe(HumanFacingState.UNDERSTANDING);
		});

		it('handles EXECUTE without progress', () => {
			const result = resolveHumanFacingState(Phase.EXECUTE, {
				hasOpenGates: false,
			});

			expect(result.progress).toBeUndefined();
		});

		it('handles EXECUTE without current unit', () => {
			const result = resolveHumanFacingState(Phase.EXECUTE, {
				hasOpenGates: false,
			});

			expect(result.detail).not.toContain('undefined');
		});
	});

	describe('getHumanFacingStateLabel', () => {
		it('returns the state enum value directly', () => {
			const label = getHumanFacingStateLabel(HumanFacingState.UNDERSTANDING);
			expect(label).toBe(HumanFacingState.UNDERSTANDING);
		});

		it('returns labels for all states', () => {
			const states = [
				HumanFacingState.UNDERSTANDING,
				HumanFacingState.FRAMING,
				HumanFacingState.NEEDS_INPUT,
				HumanFacingState.PLANNING,
				HumanFacingState.VERIFYING,
				HumanFacingState.EXECUTING,
				HumanFacingState.REPAIRING,
				HumanFacingState.BLOCKED,
				HumanFacingState.COMPLETE,
			];

			for (const state of states) {
				const label = getHumanFacingStateLabel(state);
				expect(label).toBe(state);
			}
		});
	});

	describe('getHumanFacingStateClass', () => {
		it('returns CSS class for UNDERSTANDING', () => {
			const cssClass = getHumanFacingStateClass(HumanFacingState.UNDERSTANDING);
			expect(cssClass).toBe('understanding');
		});

		it('returns CSS class for FRAMING', () => {
			const cssClass = getHumanFacingStateClass(HumanFacingState.FRAMING);
			expect(cssClass).toBe('framing');
		});

		it('returns CSS class for NEEDS_INPUT', () => {
			const cssClass = getHumanFacingStateClass(HumanFacingState.NEEDS_INPUT);
			expect(cssClass).toBe('needs-input');
		});

		it('returns CSS class for PLANNING', () => {
			const cssClass = getHumanFacingStateClass(HumanFacingState.PLANNING);
			expect(cssClass).toBe('planning');
		});

		it('returns CSS class for VERIFYING', () => {
			const cssClass = getHumanFacingStateClass(HumanFacingState.VERIFYING);
			expect(cssClass).toBe('verifying');
		});

		it('returns CSS class for EXECUTING', () => {
			const cssClass = getHumanFacingStateClass(HumanFacingState.EXECUTING);
			expect(cssClass).toBe('executing');
		});

		it('returns CSS class for REPAIRING', () => {
			const cssClass = getHumanFacingStateClass(HumanFacingState.REPAIRING);
			expect(cssClass).toBe('repairing');
		});

		it('returns CSS class for BLOCKED', () => {
			const cssClass = getHumanFacingStateClass(HumanFacingState.BLOCKED);
			expect(cssClass).toBe('blocked');
		});

		it('returns CSS class for COMPLETE', () => {
			const cssClass = getHumanFacingStateClass(HumanFacingState.COMPLETE);
			expect(cssClass).toBe('complete');
		});
	});

	describe('integration scenarios', () => {
		it('resolves complete workflow progression', () => {
			const phases = [
				Phase.INTAKE,
				Phase.PROPOSE,
				Phase.VERIFY,
				Phase.REVIEW,
				Phase.EXECUTE,
				Phase.VALIDATE,
				Phase.COMMIT,
			];

			for (const phase of phases) {
				const result = resolveHumanFacingState(phase, { hasOpenGates: false });
				expect(result.state).toBeDefined();
				expect(result.detail).toBeDefined();
			}
		});

		it('handles gate blocking across phases', () => {
			const phases = [Phase.INTAKE, Phase.PROPOSE, Phase.EXECUTE];

			for (const phase of phases) {
				const result = resolveHumanFacingState(phase, { hasOpenGates: true });
				expect(result.state).toBe(HumanFacingState.BLOCKED);
			}
		});

		it('provides consistent detail format', () => {
			const phases = [
				Phase.INTAKE,
				Phase.PROPOSE,
				Phase.VERIFY,
				Phase.EXECUTE,
				Phase.COMMIT,
			];

			for (const phase of phases) {
				const result = resolveHumanFacingState(phase, { hasOpenGates: false });
				expect(typeof result.detail).toBe('string');
				expect(result.detail.length).toBeGreaterThan(0);
			}
		});

		it('tracks execution progress through states', () => {
			const contexts = [
				{ hasOpenGates: false, unitsCompleted: 0, unitsTotal: 5 },
				{ hasOpenGates: false, unitsCompleted: 2, unitsTotal: 5 },
				{ hasOpenGates: false, unitsCompleted: 5, unitsTotal: 5 },
			];

			for (const context of contexts) {
				const result = resolveHumanFacingState(Phase.EXECUTE, context);
				expect(result.progress).toBeDefined();
			}
		});

		it('differentiates between normal execution and repair', () => {
			const normal = resolveHumanFacingState(Phase.EXECUTE, {
				hasOpenGates: false,
				isRepairing: false,
			});

			const repair = resolveHumanFacingState(Phase.EXECUTE, {
				hasOpenGates: false,
				isRepairing: true,
			});

			expect(normal.state).toBe(HumanFacingState.EXECUTING);
			expect(repair.state).toBe(HumanFacingState.REPAIRING);
		});
	});
});
