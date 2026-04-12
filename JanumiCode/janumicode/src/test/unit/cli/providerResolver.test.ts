import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { resolveProviderForRole, resolveProviderForUnit } from '../../../lib/cli/providerResolver';
import { Role, CodedError } from '../../../lib/types';
import type { RoleCLIProvider } from '../../../lib/cli/roleCLIProvider';
import type { CLIProviderInfo } from '../../../lib/cli/types';

vi.mock('../../../lib/config/manager');
vi.mock('../../../lib/llm/providerFactory');
vi.mock('../../../lib/cli/roleCLIProvider');

const createMockCLIProviderInfo = (overrides: Partial<CLIProviderInfo> = {}): CLIProviderInfo => ({
	id: 'test-provider',
	name: 'Test Provider',
	available: true,
	version: '1.0.0',
	requiresApiKey: false,
	apiKeyConfigured: true,
	...overrides,
});

describe('CLI Provider Resolver', () => {
	beforeEach(() => {
		initTestLogger();
		vi.clearAllMocks();
	});

	afterEach(() => {
		teardownTestLogger();
	});

	describe('resolveProviderForRole', () => {
		it('resolves configured CLI provider when available', async () => {
			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: vi.fn().mockResolvedValue({
					success: true,
					value: createMockCLIProviderInfo({ id: 'claude-code', name: 'Claude Code CLI' }),
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('claude-code');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			const result = await resolveProviderForRole(Role.EXECUTOR);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(mockProvider);
			}
		});

		it('fails when CLI provider is configured but not available', async () => {
			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: vi.fn().mockResolvedValue({
					success: true,
					value: createMockCLIProviderInfo({ id: 'claude-code', name: 'Claude Code CLI', available: false, requiresApiKey: true, apiKeyConfigured: false }),
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('claude-code');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			const result = await resolveProviderForRole(Role.EXECUTOR);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('CLI_NOT_AVAILABLE');
			}
		});

		it('falls back to API provider when no CLI configured', async () => {
			const mockLLMProvider = {
				id: 'gemini',
				name: 'Gemini',
				invoke: vi.fn(),
				capabilities: {},
				complete: vi.fn(),
				countTokens: vi.fn(),
				getRateLimitInfo: vi.fn(),
				validateApiKey: vi.fn(),
			} as any;

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');
			const { createProviderForRole } = await import('../../../lib/llm/providerFactory');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('api-gemini');
			vi.mocked(getRoleCLIProvider).mockReturnValue(undefined);
			vi.mocked(createProviderForRole).mockResolvedValue({
				success: true,
				value: mockLLMProvider,
			});

			const result = await resolveProviderForRole(Role.VERIFIER);

			expect(result.success).toBe(true);
		});

		it('fails when API fallback is not available', async () => {
			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');
			const { createProviderForRole } = await import('../../../lib/llm/providerFactory');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('api-gemini');
			vi.mocked(getRoleCLIProvider).mockReturnValue(undefined);
			vi.mocked(createProviderForRole).mockResolvedValue({
				success: false,
				error: new Error('API key not configured'),
			});

			const result = await resolveProviderForRole(Role.VERIFIER);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('NO_PROVIDER_AVAILABLE');
			}
		});

		it('fails when provider ID is not registered', async () => {
			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('unknown-provider');
			vi.mocked(getRoleCLIProvider).mockReturnValue(undefined);

			const result = await resolveProviderForRole(Role.EXECUTOR);

			expect(result.success).toBe(false);
			if (!result.success) {
				// When the provider ID is not registered, the resolver tries the API
				// fallback path first; if that also fails it returns NO_PROVIDER_AVAILABLE.
				// PROVIDER_NOT_FOUND is reserved for a code path that's no longer
				// reachable when the unknown-provider check happens after API fallback.
				expect((result.error as CodedError).code).toBe('NO_PROVIDER_AVAILABLE');
			}
		});

		it('handles detection failure gracefully', async () => {
			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: vi.fn().mockResolvedValue({
					success: false,
					error: new Error('Detection failed'),
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('claude-code');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			const result = await resolveProviderForRole(Role.EXECUTOR);

			expect(result.success).toBe(false);
		});

		it('resolves provider for all role types', async () => {
			const mockProvider: RoleCLIProvider = {
				id: 'test-provider',
				name: 'Test Provider',
				detect: vi.fn().mockResolvedValue({
					success: true,
					value: createMockCLIProviderInfo(),
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('test-provider');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			const roles = [Role.EXECUTOR, Role.VERIFIER, Role.TECHNICAL_EXPERT, Role.HISTORIAN];

			for (const role of roles) {
				const result = await resolveProviderForRole(role);
				expect(result.success).toBe(true);
			}
		});

		it('includes reason when CLI is not installed', async () => {
			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: vi.fn().mockResolvedValue({
					success: true,
					value: createMockCLIProviderInfo({ id: 'claude-code', name: 'Claude Code CLI', available: false }),
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('claude-code');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			const result = await resolveProviderForRole(Role.EXECUTOR);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('not installed or not in PATH');
			}
		});

		it('includes reason when API key is missing', async () => {
			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: vi.fn().mockResolvedValue({
					success: true,
					value: createMockCLIProviderInfo({ id: 'claude-code', name: 'Claude Code CLI', requiresApiKey: true, apiKeyConfigured: false }),
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('claude-code');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			const result = await resolveProviderForRole(Role.EXECUTOR);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('API key not configured');
			}
		});
	});

	describe('resolveProviderForUnit', () => {
		it('routes task unit to appropriate provider', async () => {
			const mockUnit = {
				unit_id: 'unit-1',
				category: 'logic',
				statement: 'Test task',
			};

			const mockProfiles = [
				{
					providerId: 'claude-code',
					capabilities: [
						{ category: 'logic', score: 0.9 },
					],
				},
			];

			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: vi.fn(),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			vi.doMock('../../../lib/workflow/taskRouter.js', () => ({
				routeTaskToProvider: vi.fn().mockResolvedValue({
					success: true,
					value: mockProvider,
				}),
			}));

			const result = await resolveProviderForUnit(mockUnit as any, mockProfiles as any);

			expect(result.success).toBe(true);
		});

		it('falls back to executor provider when routing fails', async () => {
			const mockUnit = {
				unit_id: 'unit-1',
				category: 'logic',
				statement: 'Test task',
			};

			const mockProfiles: any[] = [];

			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: vi.fn().mockResolvedValue({
					success: true,
					value: createMockCLIProviderInfo({ id: 'claude-code', name: 'Claude Code CLI' }),
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('claude-code');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			vi.doMock('../../../lib/workflow/taskRouter.js', () => ({
				routeTaskToProvider: vi.fn().mockResolvedValue({
					success: false,
					error: new Error('No suitable provider'),
				}),
			}));

			const result = await resolveProviderForUnit(mockUnit as any, mockProfiles);

			expect(result.success).toBe(true);
		});

		it('falls back to executor when taskRouter throws', async () => {
			const mockUnit = {
				unit_id: 'unit-1',
				category: 'logic',
				statement: 'Test task',
			};

			const mockProfiles: any[] = [];

			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: vi.fn().mockResolvedValue({
					success: true,
					value: { id: 'claude-code', name: 'Claude Code CLI', available: true, version: '1.0.0', apiKeyConfigured: true, requiresApiKey: false } as CLIProviderInfo,
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('claude-code');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			const result = await resolveProviderForUnit(mockUnit as any, mockProfiles);

			expect(result.success).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('handles unknown role gracefully', async () => {
			const result = await resolveProviderForRole('UNKNOWN_ROLE' as Role);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('UNKNOWN_ROLE');
			}
		});

		it('handles provider with null version', async () => {
			const mockProvider: RoleCLIProvider = {
				id: 'test-provider',
				name: 'Test Provider',
				detect: vi.fn().mockResolvedValue({
					success: true,
					value: createMockCLIProviderInfo({ version: undefined }),
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('test-provider');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			const result = await resolveProviderForRole(Role.EXECUTOR);

			expect(result.success).toBe(true);
		});

		it('handles concurrent resolution requests', async () => {
			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: vi.fn().mockResolvedValue({
					success: true,
					value: createMockCLIProviderInfo({ id: 'claude-code', name: 'Claude Code CLI' }),
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('claude-code');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			const results = await Promise.all([
				resolveProviderForRole(Role.EXECUTOR),
				resolveProviderForRole(Role.EXECUTOR),
				resolveProviderForRole(Role.EXECUTOR),
			]);

			expect(results.every(r => r.success)).toBe(true);
		});
	});

	describe('provider detection', () => {
		it('calls detect method once per resolution', async () => {
			const detectFn = vi.fn().mockResolvedValue({
				success: true,
				value: createMockCLIProviderInfo({ id: 'claude-code', name: 'Claude Code CLI' }),
			});

			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: detectFn,
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('claude-code');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			await resolveProviderForRole(Role.EXECUTOR);

			expect(detectFn).toHaveBeenCalledTimes(1);
		});

		it('does not call detect for API fallback', async () => {
			const mockLLMProvider = {
				id: 'gemini',
				name: 'Gemini',
				invoke: vi.fn(),
				capabilities: {},
				complete: vi.fn(),
				countTokens: vi.fn(),
				getRateLimitInfo: vi.fn(),
				validateApiKey: vi.fn(),
			} as any;

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');
			const { createProviderForRole } = await import('../../../lib/llm/providerFactory');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('api-gemini');
			vi.mocked(getRoleCLIProvider).mockReturnValue(undefined);
			vi.mocked(createProviderForRole).mockResolvedValue({
				success: true,
				value: mockLLMProvider,
			});

			const result = await resolveProviderForRole(Role.VERIFIER);

			expect(result.success).toBe(true);
			expect(vi.mocked(getRoleCLIProvider)).toHaveBeenCalledWith('api-gemini');
		});
	});

	describe('error messages', () => {
		it('includes helpful instructions when CLI not available', async () => {
			const mockProvider: RoleCLIProvider = {
				id: 'claude-code',
				name: 'Claude Code CLI',
				detect: vi.fn().mockResolvedValue({
					success: true,
					value: createMockCLIProviderInfo({ id: 'claude-code', name: 'Claude Code CLI', available: false }),
				}),
				invoke: vi.fn(),
				invokeStreaming: vi.fn(),
				getCommandPreview: vi.fn(),
			};

			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('claude-code');
			vi.mocked(getRoleCLIProvider).mockReturnValue(mockProvider);

			const result = await resolveProviderForRole(Role.EXECUTOR);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('janumicode.cli.roles.executor');
			}
		});

		it('includes provider list suggestion when not found', async () => {
			const { getCLIProviderIdForRole } = await import('../../../lib/config/manager');
			const { getRoleCLIProvider } = await import('../../../lib/cli/roleCLIProvider');

			vi.mocked(getCLIProviderIdForRole).mockReturnValue('unknown-provider');
			vi.mocked(getRoleCLIProvider).mockReturnValue(undefined);

			const result = await resolveProviderForRole(Role.EXECUTOR);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Detect CLI Providers command');
			}
		});
	});
});
