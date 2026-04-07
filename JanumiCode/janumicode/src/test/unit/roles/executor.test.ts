import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
	invokeExecutor,
	reparseExecutorResponse,
	type ExecutorInvocationOptions,
	type ExecutorResponse,
} from '../../../lib/roles/executor';
import { Phase, Role } from '../../../lib/types';

vi.mock('../../../lib/context');
vi.mock('../../../lib/database/init');
vi.mock('../../../lib/cli/roleInvoker');
vi.mock('../../../lib/integration/eventBus');
vi.mock('../../../lib/workflow/stateMachine');
vi.mock('../../../lib/context/workspaceReader.js');
vi.mock('../../../lib/mcp/goalDetector');
vi.mock('../../../lib/mcp/mcpConfigManager');
vi.mock('../../../lib/config/manager');

describe('Executor Role', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('invokeExecutor', () => {
		it('assembles context for executor role', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace summary');
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
						proposal: 'Test proposal',
						assumptions: [],
						artifacts: [],
						constraint_adherence_notes: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeExecutor(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					dialogueId: 'test-dialogue-123',
					role: Role.EXECUTOR,
					phase: Phase.EXECUTE,
					tokenBudget: 4000,
				})
			);
		});

		it('includes workspace specs in context extras', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace specs');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						proposal: 'Test',
						assumptions: [],
						artifacts: [],
						constraint_adherence_notes: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Build feature',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeExecutor(options);

			expect(assembleContext).toHaveBeenCalledWith(
				expect.objectContaining({
					extras: expect.objectContaining({
						workspace_specs: 'workspace specs',
					}),
				})
			);
		});

		it('blocks execution if critical claims are disproved', async () => {
			const { getDatabase } = await import('../../../lib/database/init');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([
					{ claim_id: 'claim-1' },
					{ claim_id: 'claim-2' },
				]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Executor blocked');
			}
		});

		it('allows execution if no blocking claims exist', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						proposal: 'Test',
						assumptions: [],
						artifacts: [],
						constraint_adherence_notes: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(true);
		});

		it('parses valid executor response', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			const responseObj = {
				proposal: 'Detailed implementation plan',
				assumptions: [
					{
						statement: 'Database supports JSON',
						criticality: 'CRITICAL',
						assumption_type: 'compatibility',
						rationale: 'Required for storage',
					},
				],
				artifacts: [
					{
						type: 'CODE',
						content: 'const x = 1;',
						description: 'Implementation code',
					},
				],
				constraint_adherence_notes: ['Follows constraint A', 'Adheres to constraint B'],
			};

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify(responseObj),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.proposal).toBe('Detailed implementation plan');
				expect(result.value.assumptions.length).toBe(1);
				expect(result.value.artifacts.length).toBe(1);
			}
		});

		it('adds UUIDs to assumptions and artifacts', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						proposal: 'Plan',
						assumptions: [{ statement: 'Assumption', criticality: 'CRITICAL', rationale: 'Why' }],
						artifacts: [{ type: 'CODE', content: 'code', description: 'desc' }],
						constraint_adherence_notes: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.assumptions[0].assumption_id).toBeTruthy();
				expect(result.value.artifacts[0].artifact_id).toBeTruthy();
			}
		});

		it('handles context assembly failure', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: false,
				error: new Error('Context assembly failed'),
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(false);
		});

		it('handles CLI invocation failure', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: false,
				error: new Error('CLI failed'),
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(false);
		});

		it('handles JSON parsing errors', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: 'Invalid JSON response',
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(false);
		});

		it('caches raw CLI output before parsing', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { updateWorkflowMetadata } = await import('../../../lib/workflow/stateMachine');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			const rawResponse = JSON.stringify({
				proposal: 'Plan',
				assumptions: [],
				artifacts: [],
				constraint_adherence_notes: [],
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: { response: rawResponse, exitCode: 0 } as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeExecutor(options);

			expect(updateWorkflowMetadata).toHaveBeenCalledWith(
				'test-dialogue-123',
				expect.objectContaining({
					cachedRawCliOutput: rawResponse,
				})
			);
		});

		it('emits stdin content when commandId provided', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { emitWorkflowCommand } = await import('../../../lib/integration/eventBus');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						proposal: 'Plan',
						assumptions: [],
						artifacts: [],
						constraint_adherence_notes: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
				commandId: 'cmd-123',
			};

			await invokeExecutor(options);

			expect(emitWorkflowCommand).toHaveBeenCalledWith(
				expect.objectContaining({
					lineType: 'stdin',
				})
			);
		});

		it('validates response structure', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						proposal: 'Plan',
					}),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test goal',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(false);
		});

		it('handles mobile specialist detection', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { analyzeGoalForMobile } = await import('../../../lib/mcp/goalDetector');
			const { isMobileSpecialistEnabled } = await import('../../../lib/config/manager');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(analyzeGoalForMobile).mockReturnValue({
				isMobileRelated: true,
				detectedPlatforms: ['ios'],
				matchedKeywords: ['ios'],
			});
			vi.mocked(isMobileSpecialistEnabled).mockReturnValue(false);

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						proposal: 'iOS implementation',
						assumptions: [],
						artifacts: [],
						constraint_adherence_notes: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Build iOS app',
				tokenBudget: 4000,
				provider: { id: 'test-provider', name: 'Test' } as any,
			};

			await invokeExecutor(options);

			expect(analyzeGoalForMobile).toHaveBeenCalledWith('Build iOS app');
		});
	});

	describe('reparseExecutorResponse', () => {
		it('parses cached raw response', () => {
			const rawResponse = JSON.stringify({
				proposal: 'Cached proposal',
				assumptions: [],
				artifacts: [],
				constraint_adherence_notes: [],
			});

			const result = reparseExecutorResponse(rawResponse);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.proposal).toBe('Cached proposal');
			}
		});

		it('adds UUIDs to items without IDs', () => {
			const rawResponse = JSON.stringify({
				proposal: 'Plan',
				assumptions: [{ statement: 'Assumption', criticality: 'CRITICAL', rationale: 'Why' }],
				artifacts: [{ type: 'CODE', content: 'code', description: 'desc' }],
				constraint_adherence_notes: [],
			});

			const result = reparseExecutorResponse(rawResponse);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.assumptions[0].assumption_id).toBeTruthy();
				expect(result.value.artifacts[0].artifact_id).toBeTruthy();
			}
		});

		it('preserves existing UUIDs', () => {
			const rawResponse = JSON.stringify({
				proposal: 'Plan',
				assumptions: [{
					assumption_id: 'existing-id',
					statement: 'Assumption',
					criticality: 'CRITICAL',
					rationale: 'Why',
				}],
				artifacts: [],
				constraint_adherence_notes: [],
			});

			const result = reparseExecutorResponse(rawResponse);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.assumptions[0].assumption_id).toBe('existing-id');
			}
		});

		it('handles parse errors', () => {
			const result = reparseExecutorResponse('Invalid JSON');

			expect(result.success).toBe(false);
		});

		it('handles markdown code fences', () => {
			const rawResponse = '```json\n' + JSON.stringify({
				proposal: 'Plan',
				assumptions: [],
				artifacts: [],
				constraint_adherence_notes: [],
			}) + '\n```';

			const result = reparseExecutorResponse(rawResponse);

			expect(result.success).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('handles empty assumptions array', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						proposal: 'Plan',
						assumptions: [],
						artifacts: [],
						constraint_adherence_notes: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test',
				tokenBudget: 4000,
				provider: { id: 'test', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.assumptions).toEqual([]);
			}
		});

		it('handles large proposals', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			const largeProposal = 'x'.repeat(50000);
			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						proposal: largeProposal,
						assumptions: [],
						artifacts: [],
						constraint_adherence_notes: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test',
				tokenBudget: 4000,
				provider: { id: 'test', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.proposal.length).toBeGreaterThan(40000);
			}
		});

		it('handles temperature parameter', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockResolvedValue('workspace');
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						proposal: 'Plan',
						assumptions: [],
						artifacts: [],
						constraint_adherence_notes: [],
					}),
					exitCode: 0,
				} as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test',
				tokenBudget: 4000,
				provider: { id: 'test', name: 'Test' } as any,
				temperature: 0.3,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(true);
		});

		it('handles thrown errors', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { getWorkspaceStructureSummary } = await import('../../../lib/context/workspaceReader.js');
			const { getDatabase } = await import('../../../lib/database/init');

			vi.mocked(getDatabase).mockReturnValue(null);
			vi.mocked(getWorkspaceStructureSummary).mockRejectedValue(new Error('Unexpected'));
			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			const options: ExecutorInvocationOptions = {
				dialogueId: 'test-dialogue-123',
				goal: 'Test',
				tokenBudget: 4000,
				provider: { id: 'test', name: 'Test' } as any,
			};

			const result = await invokeExecutor(options);

			expect(result.success).toBe(false);
		});
	});
});
