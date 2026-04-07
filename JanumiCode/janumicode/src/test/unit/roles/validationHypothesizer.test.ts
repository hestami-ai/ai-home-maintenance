import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	invokeHypothesizer,
	SECURITY_SYSTEM_PROMPT,
	LOGIC_SYSTEM_PROMPT,
	BEST_PRACTICES_SYSTEM_PROMPT,
} from '../../../lib/roles/validationHypothesizer';

vi.mock('../../../lib/cli/providerResolver');
vi.mock('../../../lib/cli/roleInvoker');

describe('Validation Hypothesizer Role', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('security agent', () => {
		it('invokes security hypothesizer', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						hypotheses: [
							{
								id: 'H-001',
								text: 'SQL injection vulnerability in user input',
								location: 'src/auth/login.ts:45',
								category: 'security',
								severity: 'high',
							},
						],
					}),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('security', 'code context');

			expect(result.agentType).toBe('security');
			expect(result.hypotheses.length).toBe(1);
			expect(result.hypotheses[0].category).toBe('security');
		});

		it('uses security system prompt', () => {
			expect(SECURITY_SYSTEM_PROMPT).toContain('Security Hypothesis Agent');
			expect(SECURITY_SYSTEM_PROMPT).toContain('Trust boundary violations');
		});

		it('generates hypotheses with S prefix', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						hypotheses: [
							{ text: 'Hypothesis 1', location: 'file.ts:10', severity: 'high' },
							{ text: 'Hypothesis 2', location: 'file.ts:20', severity: 'medium' },
						],
					}),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('security', 'code context');

			expect(result.hypotheses[0].id).toMatch(/^S-\d{3}$/);
			expect(result.hypotheses[1].id).toMatch(/^S-\d{3}$/);
		});
	});

	describe('logic agent', () => {
		it('invokes logic hypothesizer', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						hypotheses: [
							{
								id: 'H-001',
								text: 'Race condition in async state update',
								location: 'src/store/reducer.ts:78',
								category: 'logic',
								severity: 'high',
							},
						],
					}),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('logic', 'code context');

			expect(result.agentType).toBe('logic');
			expect(result.hypotheses.length).toBe(1);
			expect(result.hypotheses[0].category).toBe('logic');
		});

		it('uses logic system prompt', () => {
			expect(LOGIC_SYSTEM_PROMPT).toContain('Logic & Correctness Hypothesis Agent');
			expect(LOGIC_SYSTEM_PROMPT).toContain('State machine violations');
		});

		it('generates hypotheses with L prefix', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						hypotheses: [
							{ text: 'Logic issue', location: 'file.ts:10', severity: 'medium' },
						],
					}),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('logic', 'code context');

			expect(result.hypotheses[0].id).toMatch(/^L-\d{3}$/);
		});
	});

	describe('best practices agent', () => {
		it('invokes best practices hypothesizer', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						hypotheses: [
							{
								id: 'H-001',
								text: 'Missing idempotency in retry logic',
								location: 'src/api/client.ts:120',
								category: 'best_practices',
								severity: 'medium',
							},
						],
					}),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('best_practices', 'code context');

			expect(result.agentType).toBe('best_practices');
			expect(result.hypotheses.length).toBe(1);
			expect(result.hypotheses[0].category).toBe('best_practices');
		});

		it('uses best practices system prompt', () => {
			expect(BEST_PRACTICES_SYSTEM_PROMPT).toContain('Semantic Best Practices Hypothesis Agent');
			expect(BEST_PRACTICES_SYSTEM_PROMPT).toContain('Inappropriate library usage');
		});

		it('generates hypotheses with B prefix', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						hypotheses: [
							{ text: 'Best practice issue', location: 'file.ts:10', severity: 'low' },
						],
					}),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('best_practices', 'code context');

			expect(result.hypotheses[0].id).toMatch(/^B-\d{3}$/);
		});
	});

	describe('error handling', () => {
		it('handles provider resolution failure', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: false,
				error: new Error('Provider not found'),
			});

			const result = await invokeHypothesizer('security', 'code context');

			expect(result.hypotheses).toEqual([]);
			expect(result.agentType).toBe('security');
		});

		it('handles CLI invocation failure', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: false,
				error: new Error('CLI failed'),
			});

			const result = await invokeHypothesizer('logic', 'code context');

			expect(result.hypotheses).toEqual([]);
		});

		it('handles JSON parsing errors', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: { response: 'Invalid JSON', exitCode: 0 } as any,
			});

			const result = await invokeHypothesizer('security', 'code context');

			expect(result.hypotheses).toEqual([]);
		});

		it('handles empty hypotheses array', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({ hypotheses: [] }),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('logic', 'code context');

			expect(result.hypotheses).toEqual([]);
		});

		it('handles thrown errors', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockRejectedValue(new Error('Unexpected'));

			const result = await invokeHypothesizer('best_practices', 'code context');

			expect(result.hypotheses).toEqual([]);
		});
	});

	describe('parsing', () => {
		it('handles markdown code fences', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			const jsonResponse = { hypotheses: [{ text: 'Issue', location: 'file.ts', severity: 'high' }] };
			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: '```json\n' + JSON.stringify(jsonResponse) + '\n```',
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('security', 'code context');

			expect(result.hypotheses.length).toBe(1);
		});

		it('filters out empty hypothesis text', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						hypotheses: [
							{ text: '', location: 'file.ts', severity: 'high' },
							{ text: 'Valid hypothesis', location: 'file.ts', severity: 'medium' },
						],
					}),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('logic', 'code context');

			expect(result.hypotheses.length).toBe(1);
			expect(result.hypotheses[0].text).toBe('Valid hypothesis');
		});

		it('normalizes severity levels', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						hypotheses: [
							{ text: 'Critical issue', location: 'file.ts', severity: 'critical' },
							{ text: 'High issue', location: 'file.ts', severity: 'high' },
							{ text: 'Medium issue', location: 'file.ts', severity: 'medium' },
							{ text: 'Low issue', location: 'file.ts', severity: 'low' },
						],
					}),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('security', 'code context');

			expect(result.hypotheses.length).toBe(4);
		});

		it('handles missing location field', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						hypotheses: [
							{ text: 'Issue without location', severity: 'medium' },
						],
					}),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('logic', 'code context');

			expect(result.hypotheses.length).toBe(1);
			expect(result.hypotheses[0].location).toBe('');
		});
	});

	describe('edge cases', () => {
		it('handles multiple hypotheses', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			const hypotheses = Array(10).fill(null).map((_, i) => ({
				text: `Hypothesis ${i + 1}`,
				location: `file.ts:${i * 10}`,
				severity: 'medium',
			}));

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({ hypotheses }),
					exitCode: 0,
				} as any,
			});

			const result = await invokeHypothesizer('best_practices', 'code context');

			expect(result.hypotheses.length).toBe(10);
			expect(result.hypotheses[0].id).toBe('B-001');
			expect(result.hypotheses[9].id).toBe('B-010');
		});

		it('handles streaming callback', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({ hypotheses: [] }),
					exitCode: 0,
				} as any,
			});

			const onEvent = vi.fn();
			await invokeHypothesizer('security', 'code context', onEvent);

			expect(invokeRoleStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					onEvent,
				})
			);
		});
	});
});
