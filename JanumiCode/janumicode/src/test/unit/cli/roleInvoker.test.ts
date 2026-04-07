import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invokeRoleStreaming, type RoleInvokeOptions } from '../../../lib/cli/roleInvoker';
import type { RoleCLIProvider } from '../../../lib/cli/roleCLIProvider';
import type { RoleCLIResult, CLIActivityEvent } from '../../../lib/cli/types';

vi.mock('../../../lib/review/reasoningReviewer');
vi.mock('../../../lib/dialogue/lifecycle');

describe('Role Invoker', () => {
	let mockProvider: RoleCLIProvider;

	beforeEach(() => {
		vi.clearAllMocks();

		mockProvider = {
			id: 'test-provider',
			name: 'Test Provider',
			detect: vi.fn(),
			invoke: vi.fn(),
			invokeStreaming: vi.fn(),
			getCommandPreview: vi.fn(),
		};
	});

	describe('invokeRoleStreaming', () => {
		it('invokes provider with streaming options', async () => {
			const mockResult: RoleCLIResult = {
				response: '{"test": "response"}',
				rawOutput: 'data: {"type": "model_response", "content": "{\\"test\\": \\"response\\"}"}\n',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test prompt',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(true);
			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					stdinContent: 'Test prompt',
					outputFormat: 'stream-json',
					autoApprove: true,
				}),
				expect.any(Function)
			);
		});

		it('passes through optional working directory', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				workingDirectory: '/test/dir',
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					workingDirectory: '/test/dir',
				}),
				expect.any(Function)
			);
		});

		it('passes through timeout option', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				timeout: 60000,
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 60000,
				}),
				expect.any(Function)
			);
		});

		it('passes through MCP config paths', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				mcpConfigPaths: ['/path/to/config.json'],
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					mcpConfigPaths: ['/path/to/config.json'],
				}),
				expect.any(Function)
			);
		});

		it('passes through allowed MCP server names', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				allowedMcpServerNames: ['server1', 'server2'],
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					allowedMcpServerNames: ['server1', 'server2'],
				}),
				expect.any(Function)
			);
		});

		it('passes through allowed tools', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				allowedTools: ['read_file', 'write_file'],
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					allowedTools: ['read_file', 'write_file'],
				}),
				expect.any(Function)
			);
		});

		it('passes through sandbox mode', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				sandboxMode: 'read-only',
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					sandboxMode: 'read-only',
				}),
				expect.any(Function)
			);
		});

		it('passes through model override', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				model: 'claude-3-opus',
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'claude-3-opus',
				}),
				expect.any(Function)
			);
		});

		it('passes through JSON schema', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const jsonSchema = '{"type": "object"}';

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				jsonSchema,
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					jsonSchema,
				}),
				expect.any(Function)
			);
		});

		it('forwards streaming events to onEvent callback', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			let capturedEventHandler: ((event: CLIActivityEvent) => void) | undefined;

			vi.mocked(mockProvider.invokeStreaming).mockImplementation(async (opts, onEvent) => {
				capturedEventHandler = onEvent;
				return { success: true, value: mockResult };
			});

			const eventHandler = vi.fn();

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				onEvent: eventHandler,
			};

			await invokeRoleStreaming(options);

			expect(capturedEventHandler).toBe(eventHandler);
		});

		it('uses no-op handler when onEvent not provided', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.any(Object),
				expect.any(Function)
			);
		});

		it('handles provider invocation failure', async () => {
			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: false,
				error: new Error('Provider failed'),
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(false);
		});

		it('handles non-zero exit code with model output', async () => {
			const mockResult: RoleCLIResult = {
				response: '{"test": "valid response with lots of content that looks like real model output"}',
				rawOutput: '',
				exitCode: 1,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.warning).toBeDefined();
			}
		});

		it('fails on non-zero exit code with CLI error message', async () => {
			const mockResult: RoleCLIResult = {
				response: 'Error: API key not found',
				rawOutput: '',
				exitCode: 1,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(false);
		});

		it('fails immediately on Gemini fatal exit codes', async () => {
			const mockResult: RoleCLIResult = {
				response: 'Fatal error',
				rawOutput: '',
				exitCode: 41,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('fatal code 41');
			}
		});

		it('handles empty response with non-zero exit code', async () => {
			const mockResult: RoleCLIResult = {
				response: '',
				rawOutput: 'Connection timeout',
				exitCode: 1,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Connection timeout');
			}
		});

		it('succeeds with exit code 0', async () => {
			const mockResult: RoleCLIResult = {
				response: '{"status": "success"}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(true);
		});

		it('handles AbortSignal', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const controller = new AbortController();

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				signal: controller.signal,
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					signal: controller.signal,
				}),
				expect.any(Function)
			);
		});

		it('handles permission prompt tool option', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				permissionPromptTool: 'prompt_user',
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					permissionPromptTool: 'prompt_user',
				}),
				expect.any(Function)
			);
		});

		it('passes dialogue ID through options', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				dialogueId: 'test-dialogue-123',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(true);
		});

		it('handles multiple optional parameters together', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				workingDirectory: '/test',
				timeout: 30000,
				model: 'gpt-4',
				sandboxMode: 'workspace-write',
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					workingDirectory: '/test',
					timeout: 30000,
					model: 'gpt-4',
					sandboxMode: 'workspace-write',
				}),
				expect.any(Function)
			);
		});
	});

	describe('error handling', () => {
		it('detects API authentication errors', async () => {
			const mockResult: RoleCLIResult = {
				response: 'Error: Invalid API key',
				rawOutput: '',
				exitCode: 1,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(false);
		});

		it('detects connection errors', async () => {
			const mockResult: RoleCLIResult = {
				response: 'Error: connection refused',
				rawOutput: '',
				exitCode: 1,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(false);
		});

		it('detects SSL errors', async () => {
			const mockResult: RoleCLIResult = {
				response: 'ssl.SSLError: certificate verify failed',
				rawOutput: '',
				exitCode: 1,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(false);
		});

		it('handles provider that returns undefined exit code', async () => {
			const mockResult: RoleCLIResult = {
				response: '{"test": "response"}',
				rawOutput: '',
				exitCode: undefined as any,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(true);
		});

		it('truncates long error messages', async () => {
			const longError = 'Error: ' + 'x'.repeat(1000);
			const mockResult: RoleCLIResult = {
				response: longError,
				rawOutput: '',
				exitCode: 1,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message.length).toBeLessThan(600);
			}
		});
	});

	describe('edge cases', () => {
		it('handles empty stdin content', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: '',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(true);
		});

		it('handles very long stdin content', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'x'.repeat(100000),
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(true);
		});

		it('handles null response fields', async () => {
			const mockResult: RoleCLIResult = {
				response: null as any,
				rawOutput: null as any,
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(true);
		});

		it('handles zero execution time', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 0,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
			};

			const result = await invokeRoleStreaming(options);

			expect(result.success).toBe(true);
		});

		it('handles timeout set to zero', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				timeout: 0,
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 0,
				}),
				expect.any(Function)
			);
		});

		it('handles empty arrays for optional parameters', async () => {
			const mockResult: RoleCLIResult = {
				response: '{}',
				rawOutput: '',
				exitCode: 0,
				executionTime: 1000,
			};

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue({
				success: true,
				value: mockResult,
			});

			const options: RoleInvokeOptions = {
				provider: mockProvider,
				stdinContent: 'Test',
				mcpConfigPaths: [],
				allowedMcpServerNames: [],
				allowedTools: [],
			};

			await invokeRoleStreaming(options);

			expect(mockProvider.invokeStreaming).toHaveBeenCalledWith(
				expect.objectContaining({
					mcpConfigPaths: [],
					allowedMcpServerNames: [],
					allowedTools: [],
				}),
				expect.any(Function)
			);
		});
	});
});
