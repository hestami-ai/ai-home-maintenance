import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	invokeHistorianInterpreter,
	type HistorianInterpreterInvocationOptions,
} from '../../../lib/roles/historianInterpreter';
import { HistorianQueryType } from '../../../lib/context';
import { Phase, Role } from '../../../lib/types';

vi.mock('../../../lib/context');
vi.mock('../../../lib/cli/roleInvoker');
vi.mock('../../../lib/integration/eventBus');

describe('Historian-Interpreter Role', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('invokeHistorianInterpreter', () => {
		it('assembles context for historian role', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: {
					briefing: 'context briefing',
					tokenUsage: {},
				} as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: ['Finding 1', 'Finding 2'],
						contradictions: [],
						invariant_violations: [],
						precedents: [],
						summary: 'Historical analysis summary',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Check for contradictions',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeHistorianInterpreter(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					dialogueId: 'test-dialogue-123',
					role: Role.HISTORIAN,
					phase: Phase.HISTORICAL_CHECK,
					tokenBudget: 4000,
				})
			);
		});

		it('includes query in context extras', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: [],
						contradictions: [],
						invariant_violations: [],
						precedents: [],
						summary: 'Summary',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Find precedents',
				queryType: HistorianQueryType.PRECEDENT_SEARCH,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeHistorianInterpreter(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					extras: expect.objectContaining({
						query: 'Find precedents',
						queryType: HistorianQueryType.PRECEDENT_SEARCH,
					}),
				})
			);
		});

		it('handles CONTRADICTION_CHECK query type', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: ['Contradiction found'],
						contradictions: [
							{
								current_claim_id: 'claim-1',
								historical_claim_id: 'claim-2',
								contradiction_summary: 'Claims contradict',
								severity: 'HIGH',
							},
						],
						invariant_violations: [],
						precedents: [],
						summary: 'Contradiction analysis',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Check contradictions',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.query_type).toBe(HistorianQueryType.CONTRADICTION_CHECK);
				expect(result.value.contradictions.length).toBe(1);
			}
		});

		it('handles PRECEDENT_SEARCH query type', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: ['Precedent found'],
						contradictions: [],
						invariant_violations: [],
						precedents: [
							{
								precedent_decision_id: 'decision-1',
								relevance_score: 0.85,
								summary: 'Similar decision made',
								applicable_context: 'When X condition holds',
							},
						],
						summary: 'Precedent search results',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Find similar decisions',
				queryType: HistorianQueryType.PRECEDENT_SEARCH,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.precedents.length).toBe(1);
				expect(result.value.precedents[0].relevance_score).toBe(0.85);
			}
		});

		it('handles INVARIANT_VIOLATION query type', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: ['Violation detected'],
						contradictions: [],
						invariant_violations: [
							{
								invariant_description: 'System must maintain consistency',
								violating_claim_id: 'claim-1',
								violation_summary: 'Claim violates consistency rule',
								severity: 'CRITICAL',
							},
						],
						precedents: [],
						summary: 'Invariant violation analysis',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Check invariants',
				queryType: HistorianQueryType.INVARIANT_VIOLATION,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.invariant_violations.length).toBe(1);
				expect(result.value.invariant_violations[0].severity).toBe('CRITICAL');
			}
		});

		it('handles GENERAL_HISTORY query type', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: ['Timeline of events', 'Pattern analysis', 'Trend observation'],
						contradictions: [],
						invariant_violations: [],
						precedents: [],
						summary: 'General historical context',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Provide historical context',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.findings.length).toBe(3);
			}
		});

		it('adds IDs to contradictions', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: [],
						contradictions: [
							{
								current_claim_id: 'claim-1',
								historical_claim_id: 'claim-2',
								contradiction_summary: 'Conflict',
								severity: 'HIGH',
							},
						],
						invariant_violations: [],
						precedents: [],
						summary: 'Summary',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.contradictions[0].finding_id).toBeTruthy();
			}
		});

		it('adds IDs to invariant violations', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: [],
						contradictions: [],
						invariant_violations: [
							{
								invariant_description: 'Rule',
								violation_summary: 'Violated',
								severity: 'WARNING',
							},
						],
						precedents: [],
						summary: 'Summary',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.INVARIANT_VIOLATION,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.invariant_violations[0].violation_id).toBeTruthy();
			}
		});

		it('adds IDs to precedents', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: [],
						contradictions: [],
						invariant_violations: [],
						precedents: [
							{
								precedent_decision_id: 'decision-1',
								relevance_score: 0.9,
								summary: 'Summary',
								applicable_context: 'Context',
							},
						],
						summary: 'Summary',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.PRECEDENT_SEARCH,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.precedents[0].finding_id).toBeTruthy();
			}
		});

		it('includes related claim IDs in extras', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: [],
						contradictions: [],
						invariant_violations: [],
						precedents: [],
						summary: 'Summary',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				relatedClaimIds: ['claim-1', 'claim-2'],
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeHistorianInterpreter(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					extras: expect.objectContaining({
						relatedClaimIds: ['claim-1', 'claim-2'],
					}),
				})
			);
		});

		it('handles time window parameter', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: [],
						contradictions: [],
						invariant_violations: [],
						precedents: [],
						summary: 'Summary',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Recent history',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				timeWindowDays: 30,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeHistorianInterpreter(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					extras: expect.objectContaining({
						timeWindowDays: 30,
					}),
				})
			);
		});

		it('handles context assembly failure', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockResolvedValue({
				success: false,
				error: new Error('Context assembly failed'),
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(false);
		});

		it('handles CLI invocation failure', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: false,
				error: new Error('CLI failed'),
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(false);
		});

		it('handles JSON parsing errors', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: 'Invalid JSON',
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(false);
		});

		it('handles markdown code fences', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			const jsonResponse = {
				findings: [],
				contradictions: [],
				invariant_violations: [],
				precedents: [],
				summary: 'Summary',
			};

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: '```json\n' + JSON.stringify(jsonResponse) + '\n```',
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(true);
		});

		it('validates missing findings array', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						contradictions: [],
						invariant_violations: [],
						precedents: [],
						summary: 'Summary',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(false);
		});

		it('emits stdin content when commandId provided', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { emitWorkflowCommand } = await import('../../../lib/integration/eventBus');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: [],
						contradictions: [],
						invariant_violations: [],
						precedents: [],
						summary: 'Summary',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
				commandId: 'cmd-123',
			};

			await invokeHistorianInterpreter(options);

			expect(emitWorkflowCommand).toHaveBeenCalledWith(
				expect.objectContaining({
					lineType: 'stdin',
				})
			);
		});
	});

	describe('edge cases', () => {
		it('handles empty findings', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: [],
						contradictions: [],
						invariant_violations: [],
						precedents: [],
						summary: 'No findings',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.findings).toEqual([]);
			}
		});

		it('handles multiple contradictions with different severities', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						findings: [],
						contradictions: [
							{
								current_claim_id: 'c1',
								historical_claim_id: 'c2',
								contradiction_summary: 'High severity',
								severity: 'HIGH',
							},
							{
								current_claim_id: 'c3',
								historical_claim_id: 'c4',
								contradiction_summary: 'Medium severity',
								severity: 'MEDIUM',
							},
							{
								current_claim_id: 'c5',
								historical_claim_id: 'c6',
								contradiction_summary: 'Low severity',
								severity: 'LOW',
							},
						],
						invariant_violations: [],
						precedents: [],
						summary: 'Summary',
					}),
					exitCode: 0,
				} as any,
			});

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.CONTRADICTION_CHECK,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.contradictions.length).toBe(3);
			}
		});

		it('handles thrown errors', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockRejectedValue(new Error('Unexpected'));

			const options: HistorianInterpreterInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				query: 'Test',
				queryType: HistorianQueryType.GENERAL_HISTORY,
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeHistorianInterpreter(options);

			expect(result.success).toBe(false);
		});
	});
});
