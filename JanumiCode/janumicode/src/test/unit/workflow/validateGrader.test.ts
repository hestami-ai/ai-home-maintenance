import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { gradeFindings } from '../../../lib/workflow/validateGrader';
import type { ValidatedHypothesis } from '../../../lib/types/validate';

vi.mock('../../../lib/cli/providerResolver', () => ({
	resolveProviderForRole: vi.fn(async () => ({
		success: true,
		value: {
			detect: async () => ({ success: true, value: { available: true } }),
		},
	})),
}));

vi.mock('../../../lib/cli/roleInvoker', () => ({
	invokeRoleStreaming: vi.fn(async () => ({
		success: true,
		value: {
			response: JSON.stringify({
				gradedFindings: [
					{ sourceId: 'H-001', confidence: 0.85, mergedWith: [] },
					{ sourceId: 'H-002', confidence: 0.72, mergedWith: ['H-003'] },
				],
			}),
			exitCode: 0,
			executionTime: 1000,
			rawOutput: '',
		},
	})),
}));

describe('ValidateGrader', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		vi.clearAllMocks();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	const createMockHypothesis = (overrides?: Partial<ValidatedHypothesis>): ValidatedHypothesis => ({
		id: 'H-001',
		category: 'logic',
		severity: 'high',
		text: 'Test hypothesis',
		location: 'file.ts:10',
		proof_status: 'proven',
		tool_used: 'llm_only',
		proof_artifact: null,
		...overrides,
	});

	describe('gradeFindings', () => {
		it('returns empty array for empty input', async () => {
			const result = await gradeFindings([]);
			expect(result).toEqual([]);
		});

		it('filters only proven and probable hypotheses', async () => {
			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
				createMockHypothesis({ id: 'H-002', proof_status: 'probable' }),
				createMockHypothesis({ id: 'H-003', proof_status: 'disproven' }),
				createMockHypothesis({ id: 'H-004', proof_status: 'error' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
			expect(result.every(f => f.proof_status === 'proven' || f.proof_status === 'probable')).toBe(true);
		});

		it('assigns confidence scores to findings', async () => {
			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toHaveProperty('confidence');
			expect(typeof result[0].confidence).toBe('number');
			expect(result[0].confidence).toBeGreaterThanOrEqual(0);
			expect(result[0].confidence).toBeLessThanOrEqual(1);
		});

		it('generates finding_id for each graded finding', async () => {
			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toHaveProperty('finding_id');
			expect(typeof result[0].finding_id).toBe('string');
		});

		it('suppresses low-confidence findings', async () => {
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			vi.mocked(invokeRoleStreaming).mockResolvedValueOnce({
				success: true,
				value: {
					response: JSON.stringify({
						gradedFindings: [
							{ sourceId: 'H-001', confidence: 0.85, mergedWith: [] },
							{ sourceId: 'H-002', confidence: 0.45, mergedWith: [] },
						],
					}),
					exitCode: 0,
					executionTime: 1000,
					rawOutput: '',
				},
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
				createMockHypothesis({ id: 'H-002', proof_status: 'probable' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.every(f => f.confidence >= 0.6)).toBe(true);
		});

		it('handles LLM provider resolution failure with fallback', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			vi.mocked(resolveProviderForRole).mockResolvedValueOnce({
				success: false,
				error: new Error('Provider not available'),
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven', severity: 'high' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
			expect(result[0].confidence).toBeGreaterThanOrEqual(0.6);
		});

		it('handles CLI invocation failure with fallback', async () => {
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			vi.mocked(invokeRoleStreaming).mockResolvedValueOnce({
				success: false,
				error: new Error('CLI failed'),
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
		});

		it('handles malformed LLM response with fallback', async () => {
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			vi.mocked(invokeRoleStreaming).mockResolvedValueOnce({
				success: true,
				value: {
					response: 'This is not valid JSON',
					exitCode: 0,
					executionTime: 1000,
					rawOutput: '',
				},
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
		});

		it('applies severity bonus in fallback mode', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			vi.mocked(resolveProviderForRole).mockResolvedValueOnce({
				success: false,
				error: new Error('No provider'),
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven', severity: 'critical' }),
				createMockHypothesis({ id: 'H-002', proof_status: 'proven', severity: 'low' }),
			];

			const result = await gradeFindings(hypotheses);

			const critical = result.find(f => f.id === 'H-001');
			const low = result.find(f => f.id === 'H-002');

			if (critical && low) {
				expect(critical.confidence).toBeGreaterThan(low.confidence);
			}
		});

		it('clamps confidence scores to 0-1 range', async () => {
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			vi.mocked(invokeRoleStreaming).mockResolvedValueOnce({
				success: true,
				value: {
					response: JSON.stringify({
						gradedFindings: [
							{ sourceId: 'H-001', confidence: 1.5, mergedWith: [] },
							{ sourceId: 'H-002', confidence: -0.2, mergedWith: [] },
						],
					}),
					exitCode: 0,
					executionTime: 1000,
					rawOutput: '',
				},
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
				createMockHypothesis({ id: 'H-002', proof_status: 'proven' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.every(f => f.confidence >= 0 && f.confidence <= 1)).toBe(true);
		});

		it('calls onEvent callback when provided', async () => {
			const onEvent = vi.fn();
			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
			];

			await gradeFindings(hypotheses, onEvent);

			expect(onEvent).toHaveBeenCalled();
		});

		it('handles exception during grading with fallback', async () => {
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			vi.mocked(invokeRoleStreaming).mockRejectedValueOnce(new Error('Unexpected error'));

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
		});

		it('preserves hypothesis properties in graded findings', async () => {
			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({
					id: 'H-001',
					category: 'security',
					severity: 'critical',
					text: 'Security vulnerability',
					location: 'auth.ts:42',
					proof_status: 'proven',
					tool_used: 'sandbox_poc',
				}),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
			expect(result[0].category).toBe('security');
			expect(result[0].severity).toBe('critical');
			expect(result[0].text).toBe('Security vulnerability');
			expect(result[0].location).toBe('auth.ts:42');
		});

		it('handles multiple proven hypotheses', async () => {
			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
				createMockHypothesis({ id: 'H-002', proof_status: 'proven' }),
				createMockHypothesis({ id: 'H-003', proof_status: 'proven' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
		});

		it('handles response with markdown code fence', async () => {
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			vi.mocked(invokeRoleStreaming).mockResolvedValueOnce({
				success: true,
				value: {
					response: '```json\n{"gradedFindings":[{"sourceId":"H-001","confidence":0.8,"mergedWith":[]}]}\n```',
					exitCode: 0,
					executionTime: 1000,
					rawOutput: '',
				},
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
		});

		it('skips findings with invalid source IDs', async () => {
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			vi.mocked(invokeRoleStreaming).mockResolvedValueOnce({
				success: true,
				value: {
					response: JSON.stringify({
						gradedFindings: [
							{ sourceId: 'INVALID-ID', confidence: 0.9, mergedWith: [] },
							{ sourceId: 'H-001', confidence: 0.8, mergedWith: [] },
						],
					}),
					exitCode: 0,
					executionTime: 1000,
					rawOutput: '',
				},
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.every(f => f.id === 'H-001')).toBe(true);
		});

		it('handles different severity levels in fallback', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			vi.mocked(resolveProviderForRole).mockResolvedValueOnce({
				success: false,
				error: new Error('No provider'),
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven', severity: 'critical' }),
				createMockHypothesis({ id: 'H-002', proof_status: 'proven', severity: 'high' }),
				createMockHypothesis({ id: 'H-003', proof_status: 'proven', severity: 'medium' }),
				createMockHypothesis({ id: 'H-004', proof_status: 'proven', severity: 'low' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
			expect(result.every(f => f.confidence >= 0.6)).toBe(true);
		});

		it('handles probable status in fallback', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			vi.mocked(resolveProviderForRole).mockResolvedValueOnce({
				success: false,
				error: new Error('No provider'),
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'probable', severity: 'high' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
			expect(result[0].confidence).toBeGreaterThanOrEqual(0.6);
		});
	});

	describe('integration scenarios', () => {
		it('grades mixed severity and proof status hypotheses', async () => {
			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven', severity: 'critical' }),
				createMockHypothesis({ id: 'H-002', proof_status: 'probable', severity: 'high' }),
				createMockHypothesis({ id: 'H-003', proof_status: 'disproven', severity: 'medium' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBeGreaterThan(0);
			expect(result.every(f => f.confidence >= 0.6)).toBe(true);
		});

		it('handles complete grading workflow', async () => {
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			vi.mocked(invokeRoleStreaming).mockResolvedValueOnce({
				success: true,
				value: {
					response: JSON.stringify({
						gradedFindings: [
							{ sourceId: 'H-001', confidence: 0.95, mergedWith: [] },
							{ sourceId: 'H-002', confidence: 0.75, mergedWith: ['H-003'] },
						],
					}),
					exitCode: 0,
					executionTime: 1000,
					rawOutput: '',
				},
			});

			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven', text: 'Critical issue' }),
				createMockHypothesis({ id: 'H-002', proof_status: 'proven', text: 'Duplicate root' }),
				createMockHypothesis({ id: 'H-003', proof_status: 'proven', text: 'Same root cause' }),
			];

			const result = await gradeFindings(hypotheses);

			expect(result.length).toBe(2);
			expect(result.every(f => f.finding_id)).toBe(true);
			expect(result.every(f => f.confidence >= 0.6)).toBe(true);
		});

		it('falls back gracefully on all error scenarios', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			const errorScenarios = [
				() => vi.mocked(resolveProviderForRole).mockResolvedValueOnce({ success: false, error: new Error('Provider error') }),
				() => vi.mocked(invokeRoleStreaming).mockResolvedValueOnce({ success: false, error: new Error('CLI error') }),
				() => vi.mocked(invokeRoleStreaming).mockResolvedValueOnce({ success: true, value: { response: 'invalid', exitCode: 0, executionTime: 1000, rawOutput: '' } }),
			];

			for (const setupError of errorScenarios) {
				setupError();
				const hypotheses: ValidatedHypothesis[] = [
					createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
				];
				const result = await gradeFindings(hypotheses);
				expect(result.length).toBeGreaterThan(0);
			}
		});

		it('generates unique finding IDs for each graded finding', async () => {
			const hypotheses: ValidatedHypothesis[] = [
				createMockHypothesis({ id: 'H-001', proof_status: 'proven' }),
				createMockHypothesis({ id: 'H-002', proof_status: 'proven' }),
			];

			const result = await gradeFindings(hypotheses);

			const findingIds = result.map(f => f.finding_id);
			const uniqueIds = new Set(findingIds);
			expect(uniqueIds.size).toBe(findingIds.length);
		});
	});
});
