import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMProviderAdapter } from '../../../lib/cli/llmProviderAdapter';
import { MessageRole } from '../../../lib/llm/provider';
import type { LLMProvider } from '../../../lib/llm/provider';
import type { RoleCLIInvocationOptions } from '../../../lib/cli/types';

describe('LLM Provider Adapter', () => {
	let mockLLMProvider: LLMProvider;
	let adapter: LLMProviderAdapter;

	beforeEach(() => {
		mockLLMProvider = {
			complete: vi.fn(),
			invoke: vi.fn(),
			capabilities: {
				supportsSystemPrompt: true,
				supportsStreaming: false,
				supportsMultimodal: false,
				maxContextWindow: 4096,
				models: ['default'],
			},
			countTokens: vi.fn(),
			getRateLimitInfo: vi.fn(),
			validateApiKey: vi.fn(),
		} as any;

		adapter = new LLMProviderAdapter(mockLLMProvider, 'TestProvider');
	});

	describe('constructor', () => {
		it('generates API-prefixed ID', () => {
			expect(adapter.id).toBe('api-testprovider');
		});

		it('appends (API) suffix to name', () => {
			expect(adapter.name).toBe('TestProvider (API)');
		});

		it('handles lowercase provider names', () => {
			const lowercaseAdapter = new LLMProviderAdapter(mockLLMProvider, 'gemini');
			expect(lowercaseAdapter.id).toBe('api-gemini');
			expect(lowercaseAdapter.name).toBe('gemini (API)');
		});

		it('handles uppercase provider names', () => {
			const uppercaseAdapter = new LLMProviderAdapter(mockLLMProvider, 'CLAUDE');
			expect(uppercaseAdapter.id).toBe('api-claude');
			expect(uppercaseAdapter.name).toBe('CLAUDE (API)');
		});

		it('handles mixed-case provider names', () => {
			const mixedAdapter = new LLMProviderAdapter(mockLLMProvider, 'OpenAI');
			expect(mixedAdapter.id).toBe('api-openai');
			expect(mixedAdapter.name).toBe('OpenAI (API)');
		});
	});

	describe('detect', () => {
		it('returns available when API key is valid', async () => {
			vi.mocked(mockLLMProvider.validateApiKey).mockResolvedValue({
				success: true,
				value: true,
			});

			const result = await adapter.detect();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.available).toBe(true);
				expect(result.value.apiKeyConfigured).toBe(true);
				expect(result.value.requiresApiKey).toBe(true);
			}
		});

		it('returns unavailable when API key is invalid', async () => {
			vi.mocked(mockLLMProvider.validateApiKey).mockResolvedValue({
				success: true,
				value: false,
			});

			const result = await adapter.detect();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.available).toBe(false);
				expect(result.value.apiKeyConfigured).toBe(false);
			}
		});

		it('returns unavailable when validation throws', async () => {
			vi.mocked(mockLLMProvider.validateApiKey).mockRejectedValue(new Error('Validation failed'));

			const result = await adapter.detect();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.available).toBe(false);
				expect(result.value.apiKeyConfigured).toBe(false);
			}
		});

		it('includes provider ID in result', async () => {
			vi.mocked(mockLLMProvider.validateApiKey).mockResolvedValue({
				success: true,
				value: true,
			});

			const result = await adapter.detect();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.id).toBe('api-testprovider');
			}
		});

		it('includes provider name in result', async () => {
			vi.mocked(mockLLMProvider.validateApiKey).mockResolvedValue({
				success: true,
				value: true,
			});

			const result = await adapter.detect();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.name).toBe('TestProvider (API)');
			}
		});

		it('always sets requiresApiKey to true', async () => {
			vi.mocked(mockLLMProvider.validateApiKey).mockResolvedValue({
				success: true,
				value: true,
			});

			const result = await adapter.detect();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.requiresApiKey).toBe(true);
			}
		});

		it('handles validation returning error result', async () => {
			vi.mocked(mockLLMProvider.validateApiKey).mockResolvedValue({
				success: false,
				error: new Error('Invalid key'),
			});

			const result = await adapter.detect();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.available).toBe(false);
			}
		});
	});

	describe('invoke', () => {
		it('calls LLM provider with correct messages', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Test response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'SYSTEM: Test system prompt\n\nUSER: Test user content',
			};

			await adapter.invoke(options);

			expect(mockLLMProvider.complete).toHaveBeenCalledWith({
				messages: expect.arrayContaining([
					expect.objectContaining({
						role: MessageRole.SYSTEM,
						content: expect.stringContaining('Test system prompt'),
					}),
					expect.objectContaining({
						role: MessageRole.USER,
					}),
				]),
				model: 'default',
				maxTokens: 4000,
			});
		});

		it('returns successful result with response', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Test response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test content',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.response).toBe('Test response');
				expect(result.value.exitCode).toBe(0);
			}
		});

		it('includes token usage in result', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Test response',
					model: 'test-model',
					usage: {
						inputTokens: 100,
						outputTokens: 200,
						totalTokens: 300,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage).toEqual({
					inputTokens: 100,
					outputTokens: 200,
					totalTokens: 300,
				});
			}
		});

		it('includes execution time', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Test response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.executionTime).toBeGreaterThanOrEqual(0);
			}
		});

		it('sets rawOutput to response content', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Test raw output',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.rawOutput).toBe('Test raw output');
			}
		});

		it('uses custom model when provided', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
				model: 'gpt-4',
			};

			await adapter.invoke(options);

			expect(mockLLMProvider.complete).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'gpt-4',
				})
			);
		});

		it('handles LLM provider failure', async () => {
			vi.mocked(mockLLMProvider.complete).mockResolvedValue({
				success: false,
				error: new Error('API error'),
			});

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(false);
		});

		it('handles thrown errors', async () => {
			vi.mocked(mockLLMProvider.complete).mockRejectedValue(new Error('Network error'));

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Network error');
			}
		});

		it('handles non-Error thrown values', async () => {
			vi.mocked(mockLLMProvider.complete).mockRejectedValue('String error');

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toBe('LLM API call failed');
			}
		});

		it('handles stdin without system prompt', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Just user content',
			};

			await adapter.invoke(options);

			expect(mockLLMProvider.complete).toHaveBeenCalled();
		});

		it('handles empty stdin content', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Response',
					model: 'test-model',
					usage: {
						inputTokens: 0,
						outputTokens: 10,
						totalTokens: 10,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: '',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(true);
		});
	});

	describe('invokeStreaming', () => {
		it('emits init event before invocation', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const events: any[] = [];
			const onEvent = vi.fn((event) => events.push(event));

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			await adapter.invokeStreaming(options, onEvent);

			expect(events[0].eventType).toBe('init');
			expect(events[0].summary).toContain('processing');
		});

		it('emits complete event on success', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Test response content',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const events: any[] = [];
			const onEvent = vi.fn((event) => events.push(event));

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			await adapter.invokeStreaming(options, onEvent);

			const completeEvent = events.find(e => e.eventType === 'complete');
			expect(completeEvent).toBeDefined();
			expect(completeEvent.status).toBe('success');
		});

		it('emits error event on failure', async () => {
			vi.mocked(mockLLMProvider.complete).mockResolvedValue({
				success: false,
				error: new Error('API failed'),
			});

			const events: any[] = [];
			const onEvent = vi.fn((event) => events.push(event));

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			await adapter.invokeStreaming(options, onEvent);

			const errorEvent = events.find(e => e.eventType === 'error');
			expect(errorEvent).toBeDefined();
			expect(errorEvent.status).toBe('error');
			expect(errorEvent.summary).toContain('API failed');
		});

		it('includes response preview in complete event', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'A'.repeat(300),
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const events: any[] = [];
			const onEvent = vi.fn((event) => events.push(event));

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			await adapter.invokeStreaming(options, onEvent);

			const completeEvent = events.find(e => e.eventType === 'complete');
			expect(completeEvent.detail.length).toBeLessThanOrEqual(200);
		});

		it('returns same result as invoke', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Test response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			const streamResult = await adapter.invokeStreaming(options, vi.fn());
			const regularResult = await adapter.invoke(options);

			expect(streamResult.success).toBe(regularResult.success);
			if (streamResult.success && regularResult.success) {
				expect(streamResult.value.response).toBe(regularResult.value.response);
			}
		});

		it('calls onEvent callback for each event', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const onEvent = vi.fn();

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			await adapter.invokeStreaming(options, onEvent);

			expect(onEvent).toHaveBeenCalledTimes(2);
		});

		it('includes timestamps in events', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const events: any[] = [];
			const onEvent = vi.fn((event) => events.push(event));

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			await adapter.invokeStreaming(options, onEvent);

			expect(events.every(e => e.timestamp)).toBe(true);
		});
	});

	describe('getCommandPreview', () => {
		it('returns fallback message', () => {
			const result = adapter.getCommandPreview({ stdinContent: 'Test' });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('API fallback');
				expect(result.value).toContain('TestProvider (API)');
			}
		});

		it('indicates no CLI command', () => {
			const result = adapter.getCommandPreview({ stdinContent: 'Test' });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('no CLI command');
			}
		});

		it('ignores options parameter', () => {
			const result1 = adapter.getCommandPreview({ stdinContent: 'Test1' });
			const result2 = adapter.getCommandPreview({ stdinContent: 'Test2', model: 'gpt-4' });

			expect(result1.success && result2.success).toBe(true);
			if (result1.success && result2.success) {
				expect(result1.value).toBe(result2.value);
			}
		});
	});

	describe('edge cases', () => {
		it('handles very long responses', async () => {
			const longContent = 'x'.repeat(100000);
			const mockResponse = {
				success: true as const,
				value: {
					content: longContent,
					model: 'test-model',
					usage: {
						inputTokens: 1000,
						outputTokens: 10000,
						totalTokens: 11000,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.response.length).toBe(100000);
			}
		});

		it('handles zero token usage', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: '',
					model: 'test-model',
					usage: {
						inputTokens: 0,
						outputTokens: 0,
						totalTokens: 0,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage?.totalTokens).toBe(0);
			}
		});

		it('handles provider name with special characters', () => {
			const specialAdapter = new LLMProviderAdapter(mockLLMProvider, 'Test-Provider_123');
			expect(specialAdapter.id).toBe('api-test-provider_123');
		});

		it('handles empty provider name', () => {
			const emptyAdapter = new LLMProviderAdapter(mockLLMProvider, '');
			expect(emptyAdapter.id).toBe('api-');
			expect(emptyAdapter.name).toBe(' (API)');
		});

		it('handles concurrent invocations', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			const results = await Promise.all([
				adapter.invoke(options),
				adapter.invoke(options),
				adapter.invoke(options),
			]);

			expect(results.every(r => r.success)).toBe(true);
		});

		it('handles null usage in LLM response', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Response',
					model: 'test-model',
					usage: null as any,
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'Test',
			};

			await expect(adapter.invoke(options)).rejects.toThrow();
		});
	});

	describe('message formatting', () => {
		it('splits system and user content correctly', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'SYSTEM: You are a helpful assistant.\n\nUSER: What is 2+2?',
			};

			await adapter.invoke(options);

			const callArgs = vi.mocked(mockLLMProvider.complete).mock.calls[0][0];
			expect(callArgs.messages.length).toBeGreaterThan(0);
		});

		it('handles stdin with only user content', async () => {
			const mockResponse = {
				success: true as const,
				value: {
					content: 'Response',
					model: 'test-model',
					usage: {
						inputTokens: 10,
						outputTokens: 20,
						totalTokens: 30,
					},
				},
			};

			vi.mocked(mockLLMProvider.complete).mockResolvedValue(mockResponse);

			const options: RoleCLIInvocationOptions = {
				stdinContent: 'What is 2+2?',
			};

			const result = await adapter.invoke(options);

			expect(result.success).toBe(true);
		});
	});
});
