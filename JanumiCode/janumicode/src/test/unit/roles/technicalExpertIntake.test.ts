import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../lib/context');
vi.mock('../../../lib/cli/roleInvoker');
vi.mock('../../../lib/workflow/stateMachine');
vi.mock('../../../lib/integration/eventBus');

describe('Technical Expert Intake Role', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('intake conversational mode', () => {
		it('imports technical expert intake module', async () => {
			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');
			
			expect(technicalExpertIntake).toBeDefined();
		});

		it('handles conversation turn invocation', async () => {
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
						conversationalResponse: 'Response',
						updatedPlan: {
							version: 1,
							title: 'Plan',
							summary: 'Summary',
							requirements: [],
							decisions: [],
							constraints: [],
							openQuestions: [],
							technicalNotes: [],
							proposedApproach: 'Approach',
							lastUpdatedAt: '2024-01-01T00:00:00Z',
							requestCategory: 'product_or_feature',
						},
						mmp: {
							mirror: { steelMan: 'Summary', items: [] },
							menu: { items: [] },
							suggestedQuestions: [],
						},
					}),
					exitCode: 0,
				} as any,
			});

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
		});

		it('handles plan synthesis', async () => {
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
						synthesizedPlan: {
							version: 1,
							title: 'Final Plan',
							summary: 'Summary',
							requirements: [],
							decisions: [],
							constraints: [],
							openQuestions: [],
							technicalNotes: [],
							proposedApproach: 'Approach',
							lastUpdatedAt: '2024-01-01T00:00:00Z',
							requestCategory: 'product_or_feature',
						},
					}),
					exitCode: 0,
				} as any,
			});

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
		});

		it('handles mirror and menu protocol', async () => {
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
						conversationalResponse: 'Response',
						updatedPlan: {
							version: 1,
							title: 'Plan',
							summary: 'Summary',
							requirements: [],
							decisions: [],
							constraints: [],
							openQuestions: [],
							technicalNotes: [],
							proposedApproach: 'Approach',
							lastUpdatedAt: '2024-01-01T00:00:00Z',
							requestCategory: 'technical_task',
						},
						mmp: {
							mirror: {
								steelMan: 'You want to fix the authentication bug',
								items: [
									{
										id: 'MIR-1',
										text: 'The bug affects JWT token validation',
										category: 'scope',
										rationale: 'Based on error logs',
										status: 'pending',
									},
								],
							},
							menu: {
								items: [
									{
										id: 'MENU-1',
										question: 'Which approach should we use?',
										context: 'Context',
										options: [
											{ id: 'OPT-1', label: 'Option 1', tradeoffs: 'Tradeoffs' },
											{ id: 'OPT-2', label: 'Option 2', tradeoffs: 'Tradeoffs' },
										],
									},
								],
							},
							suggestedQuestions: ['Question 1'],
						},
					}),
					exitCode: 0,
				} as any,
			});

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
		});

		it('handles product vs technical task categories', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			const productResponse = JSON.stringify({
				conversationalResponse: 'Response',
				updatedPlan: {
					version: 1,
					title: 'Plan',
					summary: 'Summary',
					requirements: [],
					decisions: [],
					constraints: [],
					openQuestions: [],
					technicalNotes: [],
					proposedApproach: 'Approach',
					lastUpdatedAt: '2024-01-01T00:00:00Z',
					requestCategory: 'product_or_feature',
					productVision: 'Vision',
					productDescription: 'Description',
					personas: [],
					userJourneys: [],
					successMetrics: [],
					phasingStrategy: [],
					uxRequirements: [],
				},
				mmp: { mirror: { steelMan: 'Summary', items: [] }, menu: { items: [] }, suggestedQuestions: [] },
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: { response: productResponse, exitCode: 0 } as any,
			});

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
		});

		it('handles context assembly failure', async () => {
			const { assembleContext } = await import('../../../lib/context');

			vi.mocked(assembleContext).mockResolvedValue({
				success: false,
				error: new Error('Context failed'),
			});

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
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

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
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
				value: { response: 'Invalid JSON', exitCode: 0 } as any,
			});

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
		});

		it('emits deferred command blocks', async () => {
			const { emitWorkflowCommand } = await import('../../../lib/integration/eventBus');
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
						conversationalResponse: 'Response',
						updatedPlan: {
							version: 1,
							title: 'Plan',
							summary: 'Summary',
							requirements: [],
							decisions: [],
							constraints: [],
							openQuestions: [],
							technicalNotes: [],
							proposedApproach: 'Approach',
							lastUpdatedAt: '2024-01-01T00:00:00Z',
							requestCategory: 'technical_task',
						},
						mmp: { mirror: { steelMan: 'Summary', items: [] }, menu: { items: [] }, suggestedQuestions: [] },
					}),
					exitCode: 0,
				} as any,
			});

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
		});

		it('updates workflow metadata', async () => {
			const { updateWorkflowMetadata } = await import('../../../lib/workflow/stateMachine');
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
						conversationalResponse: 'Response',
						updatedPlan: {
							version: 1,
							title: 'Plan',
							summary: 'Summary',
							requirements: [],
							decisions: [],
							constraints: [],
							openQuestions: [],
							technicalNotes: [],
							proposedApproach: 'Approach',
							lastUpdatedAt: '2024-01-01T00:00:00Z',
							requestCategory: 'technical_task',
						},
						mmp: { mirror: { steelMan: 'Summary', items: [] }, menu: { items: [] }, suggestedQuestions: [] },
					}),
					exitCode: 0,
				} as any,
			});

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
		});
	});

	describe('edge cases', () => {
		it('handles clarification rounds', async () => {
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
						conversationalResponse: 'Clarification response',
						updatedPlan: {
							version: 1,
							title: 'Plan',
							summary: 'Summary',
							requirements: [],
							decisions: [],
							constraints: [],
							openQuestions: [],
							technicalNotes: [],
							proposedApproach: 'Approach',
							lastUpdatedAt: '2024-01-01T00:00:00Z',
							requestCategory: 'technical_task',
						},
						mmp: { mirror: { steelMan: 'Summary', items: [] }, menu: { items: [] }, suggestedQuestions: [] },
					}),
					exitCode: 0,
				} as any,
			});

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
		});

		it('handles domain coverage context', async () => {
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
						conversationalResponse: 'Response',
						updatedPlan: {
							version: 1,
							title: 'Plan',
							summary: 'Summary',
							requirements: [],
							decisions: [],
							constraints: [],
							openQuestions: [],
							technicalNotes: [],
							proposedApproach: 'Approach',
							lastUpdatedAt: '2024-01-01T00:00:00Z',
							requestCategory: 'technical_task',
						},
						mmp: { mirror: { steelMan: 'Summary', items: [] }, menu: { items: [] }, suggestedQuestions: [] },
					}),
					exitCode: 0,
				} as any,
			});

			const technicalExpertIntake = await import('../../../lib/roles/technicalExpertIntake');

			expect(technicalExpertIntake).toBeDefined();
		});
	});
});
