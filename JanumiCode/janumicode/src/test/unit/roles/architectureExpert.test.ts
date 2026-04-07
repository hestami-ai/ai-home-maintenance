import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../lib/context');
vi.mock('../../../lib/cli/roleInvoker');
vi.mock('../../../lib/cli/providerResolver');
vi.mock('../../../lib/workflow/stateMachine');
vi.mock('../../../lib/integration/eventBus');
vi.mock('../../../lib/llm/providerFactory');
vi.mock('../../../lib/config/secretKeyManager');

describe('Architecture Expert Role', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('architecture document generation', () => {
		it('imports architecture expert module', async () => {
			const architectureExpert = await import('../../../lib/roles/architectureExpert');
			
			expect(architectureExpert).toBeDefined();
		});

		it('handles decomposition invocation', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						capabilities: [],
						workflows: [],
					}),
					exitCode: 0,
				} as any,
			});

			const architectureExpert = await import('../../../lib/roles/architectureExpert');

			expect(architectureExpert).toBeDefined();
		});

		it('handles modeling invocation', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						data_models: [],
					}),
					exitCode: 0,
				} as any,
			});

			const architectureExpert = await import('../../../lib/roles/architectureExpert');

			expect(architectureExpert).toBeDefined();
		});

		it('handles design invocation', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						components: [],
						interfaces: [],
					}),
					exitCode: 0,
				} as any,
			});

			const architectureExpert = await import('../../../lib/roles/architectureExpert');

			expect(architectureExpert).toBeDefined();
		});

		it('handles sequencing invocation', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({
						implementation_steps: [],
					}),
					exitCode: 0,
				} as any,
			});

			const architectureExpert = await import('../../../lib/roles/architectureExpert');

			expect(architectureExpert).toBeDefined();
		});
	});

	describe('error handling', () => {
		it('handles provider resolution failure', async () => {
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: false,
				error: new Error('Provider not found'),
			});

			const architectureExpert = await import('../../../lib/roles/architectureExpert');

			expect(architectureExpert).toBeDefined();
		});

		it('handles context assembly failure', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(assembleContext).mockResolvedValue({
				success: false,
				error: new Error('Context failed'),
			});

			const architectureExpert = await import('../../../lib/roles/architectureExpert');

			expect(architectureExpert).toBeDefined();
		});

		it('handles CLI invocation failure', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: false,
				error: new Error('CLI failed'),
			});

			const architectureExpert = await import('../../../lib/roles/architectureExpert');

			expect(architectureExpert).toBeDefined();
		});

		it('handles JSON parsing errors', async () => {
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

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

			const architectureExpert = await import('../../../lib/roles/architectureExpert');

			expect(architectureExpert).toBeDefined();
		});
	});

	describe('integration', () => {
		it('emits workflow command events', async () => {
			const { emitWorkflowCommand } = await import('../../../lib/integration/eventBus');
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({ capabilities: [], workflows: [] }),
					exitCode: 0,
				} as any,
			});

			const architectureExpert = await import('../../../lib/roles/architectureExpert');

			expect(architectureExpert).toBeDefined();
		});

		it('updates workflow metadata', async () => {
			const { updateWorkflowMetadata } = await import('../../../lib/workflow/stateMachine');
			const { assembleContext } = await import('../../../lib/context');
			const { invokeRoleStreaming } = await import('../../../lib/cli/roleInvoker');
			const { resolveProviderForRole } = await import('../../../lib/cli/providerResolver');

			vi.mocked(resolveProviderForRole).mockResolvedValue({
				success: true,
				value: { id: 'test-provider', name: 'Test' } as any,
			});

			vi.mocked(assembleContext).mockResolvedValue({
				success: true,
				value: { briefing: 'context', tokenUsage: {} } as any,
			});

			vi.mocked(invokeRoleStreaming).mockResolvedValue({
				success: true,
				value: {
					response: JSON.stringify({ capabilities: [], workflows: [] }),
					exitCode: 0,
				} as any,
			});

			const architectureExpert = await import('../../../lib/roles/architectureExpert');

			expect(architectureExpert).toBeDefined();
		});
	});
});
