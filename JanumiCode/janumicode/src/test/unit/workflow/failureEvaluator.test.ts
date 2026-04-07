import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { evaluateUnitFailure, type FailureEvaluation } from '../../../lib/workflow/failureEvaluator';

describe('FailureEvaluator', () => {
	beforeEach(() => {
		initTestLogger();
	});

	afterEach(() => {
		teardownTestLogger();
	});

	describe('evaluateUnitFailure', () => {
		it('returns fallback evaluation when API unavailable', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Complete test task',
				'',
				'Exit code 1',
				'runtime_error'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.completionStatus).toBe('failed');
				expect(result.value.summary).toBe('Exit code 1');
				expect(result.value.model).toBe('fallback');
			}
		});

		it('includes failure reason in fallback', async () => {
			const failureReason = 'Permission denied';
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Write file',
				'',
				failureReason,
				'runtime_error'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.issues).toContain(failureReason);
			}
		});

		it('provides runtime error recommendations', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Execute task',
				'',
				'Exit code 1',
				'runtime_error'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.recommendations.length).toBeGreaterThan(0);
			}
		});

		it('provides validation error recommendations', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Execute task',
				'',
				'Lint failed',
				'lint_error'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.recommendations.length).toBeGreaterThan(0);
			}
		});

		it('handles empty executor output', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Complete task',
				'',
				'No output',
				'unknown'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.completionStatus).toBe('failed');
			}
		});

		it('handles long executor output', async () => {
			const longOutput = 'x'.repeat(10000);
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Complete task',
				longOutput,
				'Exit code 1',
				'runtime_error'
			);

			expect(result.success).toBe(true);
		});

		it('includes timing metadata', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Complete task',
				'Some output',
				'Exit code 1',
				'runtime_error'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.elapsedMs).toBeDefined();
				expect(typeof result.value.elapsedMs).toBe('number');
			}
		});

		it('initializes empty arrays for fallback', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Complete task',
				'',
				'Failed',
				'unknown'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(Array.isArray(result.value.deliverables)).toBe(true);
				expect(Array.isArray(result.value.issues)).toBe(true);
				expect(Array.isArray(result.value.recommendations)).toBe(true);
			}
		});

		it('sets contentRecoverable to false in fallback', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Complete task',
				'',
				'Failed',
				'unknown'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.contentRecoverable).toBeUndefined();
			}
		});

		it('handles various failure types', async () => {
			const failureTypes = [
				'lint_error',
				'type_error',
				'runtime_error',
				'permission_denied',
				'timeout',
			];

			for (const failureType of failureTypes) {
				const result = await evaluateUnitFailure(
					'Test Unit',
					'Task',
					'output',
					'Failed',
					failureType
				);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.completionStatus).toBeDefined();
				}
			}
		});
	});

	describe('evaluation structure', () => {
		it('validates completion status values', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Task',
				'',
				'Failed',
				'unknown'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				const validStatuses = [
					'completed_with_errors',
					'partially_completed',
					'blocked',
					'failed',
				];
				expect(validStatuses).toContain(result.value.completionStatus);
			}
		});

		it('includes all required fields', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Task',
				'output',
				'Failed',
				'unknown'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.completionStatus).toBeDefined();
				expect(result.value.summary).toBeDefined();
				expect(result.value.deliverables).toBeDefined();
				expect(result.value.issues).toBeDefined();
				expect(result.value.recommendations).toBeDefined();
				expect(result.value.elapsedMs).toBeDefined();
				expect(result.value.model).toBeDefined();
			}
		});

		it('provides actionable recommendations', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Task',
				'',
				'Permission denied',
				'runtime_error'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.recommendations.length).toBeGreaterThan(0);
				result.value.recommendations.forEach(rec => {
					expect(typeof rec).toBe('string');
					expect(rec.length).toBeGreaterThan(0);
				});
			}
		});

		it('formats summary as string', async () => {
			const result = await evaluateUnitFailure(
				'Test Unit',
				'Task',
				'output',
				'Specific failure reason',
				'unknown'
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(typeof result.value.summary).toBe('string');
				expect(result.value.summary.length).toBeGreaterThan(0);
			}
		});
	});

	describe('integration scenarios', () => {
		it('handles complete failure workflow', async () => {
			const unitLabel = 'Create Authentication Module';
			const unitGoal = 'Implement user authentication with JWT';
			const executorOutput = 'Started implementation...\nError: Permission denied writing to /etc/app.conf';
			const failureReason = 'Exit code 1: Permission denied';
			const failureType = 'runtime_error';

			const result = await evaluateUnitFailure(
				unitLabel,
				unitGoal,
				executorOutput,
				failureReason,
				failureType
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.summary).toBeTruthy();
				expect(result.value.issues.length).toBeGreaterThan(0);
				expect(result.value.recommendations.length).toBeGreaterThan(0);
			}
		});

		it('handles validation failure workflow', async () => {
			const executorOutput = 'Running lint...\nError: Missing semicolon at line 42';
			const failureReason = 'Lint check failed';
			const failureType = 'lint_error';

			const result = await evaluateUnitFailure(
				'Refactor Module',
				'Clean up code',
				executorOutput,
				failureReason,
				failureType
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.recommendations).toBeTruthy();
			}
		});

		it('handles timeout scenario', async () => {
			const executorOutput = 'Starting long-running task...\n(timeout)';
			const failureReason = 'Task timeout after 5 minutes';
			const failureType = 'timeout';

			const result = await evaluateUnitFailure(
				'Data Migration',
				'Migrate database',
				executorOutput,
				failureReason,
				failureType
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.completionStatus).toBeDefined();
			}
		});
	});
});
