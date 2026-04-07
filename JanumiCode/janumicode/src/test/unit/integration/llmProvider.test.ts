import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	invokeLLM,
	invokeLLMWithRetry,
	invokeRoleLLM,
	validateLLMConfig,
	type LLMRequestOptions,
} from '../../../lib/integration/llmProvider';
import { LLMProvider, CodedError } from '../../../lib/types';

vi.mock('@anthropic-ai/sdk');
vi.mock('openai');

describe('LLM Provider Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('invokeLLM', () => {
		it('invokes Claude provider', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			const mockCreate = vi.fn().mockResolvedValue({
				id: 'msg-123',
				model: 'claude-3-opus-20240229',
				content: [{ type: 'text', text: 'Test response' }],
				usage: {
					input_tokens: 100,
					output_tokens: 50,
				},
				stop_reason: 'end_turn',
			});

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: { create: mockCreate },
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.content).toBe('Test response');
				expect(result.value.provider).toBe('anthropic');
			}
		});

		it('invokes OpenAI provider', async () => {
			const OpenAI = (await import('openai')).default;

			const mockCreate = vi.fn().mockResolvedValue({
				id: 'chatcmpl-123',
				model: 'gpt-4',
				choices: [{
					message: { content: 'OpenAI response' },
					finish_reason: 'stop',
				}],
				usage: {
					prompt_tokens: 80,
					completion_tokens: 40,
					total_tokens: 120,
				},
			});

			vi.mocked(OpenAI).mockImplementation(() => ({
				chat: { completions: { create: mockCreate } },
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.OPENAI,
				apiKey: 'test-key',
				model: 'gpt-4',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.content).toBe('OpenAI response');
				expect(result.value.provider).toBe('openai');
			}
		});

		it('handles unsupported provider', async () => {
			const options: LLMRequestOptions = {
				provider: 'UNSUPPORTED' as any,
				apiKey: 'test-key',
				model: 'test-model',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('UNSUPPORTED_PROVIDER');
			}
		});

		it('passes system prompt to Claude', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			const mockCreate = vi.fn().mockResolvedValue({
				id: 'msg-123',
				model: 'claude-3-opus-20240229',
				content: [{ type: 'text', text: 'Response' }],
				usage: { input_tokens: 100, output_tokens: 50 },
				stop_reason: 'end_turn',
			});

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: { create: mockCreate },
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				systemPrompt: 'You are a helpful assistant',
				userPrompt: 'Test prompt',
			};

			await invokeLLM(options);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					system: 'You are a helpful assistant',
				})
			);
		});

		it('passes system prompt to OpenAI', async () => {
			const OpenAI = (await import('openai')).default;

			const mockCreate = vi.fn().mockResolvedValue({
				id: 'chatcmpl-123',
				model: 'gpt-4',
				choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
				usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
			});

			vi.mocked(OpenAI).mockImplementation(() => ({
				chat: { completions: { create: mockCreate } },
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.OPENAI,
				apiKey: 'test-key',
				model: 'gpt-4',
				systemPrompt: 'You are a helpful assistant',
				userPrompt: 'Test prompt',
			};

			await invokeLLM(options);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({ role: 'system' }),
					]),
				})
			);
		});

		it('applies temperature parameter', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			const mockCreate = vi.fn().mockResolvedValue({
				id: 'msg-123',
				model: 'claude-3-opus-20240229',
				content: [{ type: 'text', text: 'Response' }],
				usage: { input_tokens: 100, output_tokens: 50 },
				stop_reason: 'end_turn',
			});

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: { create: mockCreate },
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
				temperature: 0.5,
			};

			await invokeLLM(options);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.5,
				})
			);
		});

		it('applies maxTokens parameter', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			const mockCreate = vi.fn().mockResolvedValue({
				id: 'msg-123',
				model: 'claude-3-opus-20240229',
				content: [{ type: 'text', text: 'Response' }],
				usage: { input_tokens: 100, output_tokens: 50 },
				stop_reason: 'end_turn',
			});

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: { create: mockCreate },
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
				maxTokens: 2000,
			};

			await invokeLLM(options);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					max_tokens: 2000,
				})
			);
		});

		it('handles Anthropic API errors', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockRejectedValue(new Error('API rate limit exceeded')),
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('ANTHROPIC_API_ERROR');
			}
		});

		it('handles OpenAI API errors', async () => {
			const OpenAI = (await import('openai')).default;

			vi.mocked(OpenAI).mockImplementation(() => ({
				chat: {
					completions: {
						create: vi.fn().mockRejectedValue(new Error('Invalid API key')),
					},
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.OPENAI,
				apiKey: 'test-key',
				model: 'gpt-4',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('OPENAI_API_ERROR');
			}
		});

		it('includes token usage in response', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockResolvedValue({
						id: 'msg-123',
						model: 'claude-3-opus-20240229',
						content: [{ type: 'text', text: 'Response' }],
						usage: {
							input_tokens: 150,
							output_tokens: 75,
						},
						stop_reason: 'end_turn',
					}),
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.usage.promptTokens).toBe(150);
				expect(result.value.usage.completionTokens).toBe(75);
				expect(result.value.usage.totalTokens).toBe(225);
			}
		});

		it('handles multiple text blocks from Claude', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockResolvedValue({
						id: 'msg-123',
						model: 'claude-3-opus-20240229',
						content: [
							{ type: 'text', text: 'First block' },
							{ type: 'text', text: 'Second block' },
						],
						usage: { input_tokens: 100, output_tokens: 50 },
						stop_reason: 'end_turn',
					}),
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.content).toBe('First block\nSecond block');
			}
		});

		it('handles empty OpenAI response', async () => {
			const OpenAI = (await import('openai')).default;

			vi.mocked(OpenAI).mockImplementation(() => ({
				chat: {
					completions: {
						create: vi.fn().mockResolvedValue({
							id: 'chatcmpl-123',
							model: 'gpt-4',
							choices: [],
							usage: { prompt_tokens: 80, completion_tokens: 0, total_tokens: 80 },
						}),
					},
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.OPENAI,
				apiKey: 'test-key',
				model: 'gpt-4',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.content).toBe('');
			}
		});
	});

	describe('invokeLLMWithRetry', () => {
		it('succeeds on first attempt', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockResolvedValue({
						id: 'msg-123',
						model: 'claude-3-opus-20240229',
						content: [{ type: 'text', text: 'Response' }],
						usage: { input_tokens: 100, output_tokens: 50 },
						stop_reason: 'end_turn',
					}),
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLMWithRetry(options, 3, 100);

			expect(result.success).toBe(true);
		});

		it('retries on failure', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			let callCount = 0;
			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockImplementation(() => {
						callCount++;
						if (callCount < 3) {
							throw new Error('Temporary error');
						}
						return {
							id: 'msg-123',
							model: 'claude-3-opus-20240229',
							content: [{ type: 'text', text: 'Response' }],
							usage: { input_tokens: 100, output_tokens: 50 },
							stop_reason: 'end_turn',
						};
					}),
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLMWithRetry(options, 3, 10);

			expect(result.success).toBe(true);
			expect(callCount).toBeGreaterThan(1);
		});

		it('fails after max retries', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockRejectedValue(new Error('Persistent error')),
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLMWithRetry(options, 2, 10);

			expect(result.success).toBe(false);
		});

		it('uses exponential backoff', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			const delays: number[] = [];
			let lastCall = Date.now();

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockImplementation(() => {
						const now = Date.now();
						if (lastCall > 0) {
							delays.push(now - lastCall);
						}
						lastCall = now;
						throw new Error('Retry test');
					}),
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
			};

			await invokeLLMWithRetry(options, 2, 50);

			expect(delays.length).toBeGreaterThan(0);
		});
	});

	describe('invokeRoleLLM', () => {
		it('invokes LLM with role configuration', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockResolvedValue({
						id: 'msg-123',
						model: 'claude-3-opus-20240229',
						content: [{ type: 'text', text: 'Response' }],
						usage: { input_tokens: 100, output_tokens: 50 },
						stop_reason: 'end_turn',
					}),
				},
			} as any));

			const config = {
				executor: {
					provider: LLMProvider.CLAUDE,
					apiKey: 'test-key',
					model: 'claude-3-opus-20240229',
					temperature: 0.7,
					maxTokens: 4096,
				},
			} as any;

			const result = await invokeRoleLLM(
				'executor',
				config,
				'System prompt',
				'User prompt'
			);

			expect(result.success).toBe(true);
		});

		it('handles missing role configuration', async () => {
			const config = {} as any;

			const result = await invokeRoleLLM(
				'executor',
				config,
				'System prompt',
				'User prompt'
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect((result.error as CodedError).code).toBe('ROLE_CONFIG_NOT_FOUND');
			}
		});

		it('overrides maxTokens when provided', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			const mockCreate = vi.fn().mockResolvedValue({
				id: 'msg-123',
				model: 'claude-3-opus-20240229',
				content: [{ type: 'text', text: 'Response' }],
				usage: { input_tokens: 100, output_tokens: 50 },
				stop_reason: 'end_turn',
			});

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: { create: mockCreate },
			} as any));

			const config = {
				executor: {
					provider: LLMProvider.CLAUDE,
					apiKey: 'test-key',
					model: 'claude-3-opus-20240229',
					temperature: 0.7,
					maxTokens: 4096,
				},
			} as any;

			await invokeRoleLLM(
				'executor',
				config,
				'System prompt',
				'User prompt',
				2000
			);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					max_tokens: 2000,
				})
			);
		});

		it('uses role-specific temperature', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			const mockCreate = vi.fn().mockResolvedValue({
				id: 'msg-123',
				model: 'claude-3-opus-20240229',
				content: [{ type: 'text', text: 'Response' }],
				usage: { input_tokens: 100, output_tokens: 50 },
				stop_reason: 'end_turn',
			});

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: { create: mockCreate },
			} as any));

			const config = {
				executor: {
					provider: LLMProvider.CLAUDE,
					apiKey: 'test-key',
					model: 'claude-3-opus-20240229',
					temperature: 0.3,
					maxTokens: 4096,
				},
			} as any;

			await invokeRoleLLM(
				'executor',
				config,
				'System prompt',
				'User prompt'
			);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.3,
				})
			);
		});
	});

	describe('validateLLMConfig', () => {
		it('validates complete configuration', () => {
			const config = {
				executor: {
					provider: LLMProvider.CLAUDE,
					apiKey: 'test-key-1',
					model: 'claude-3-opus-20240229',
					temperature: 0.7,
					maxTokens: 4096,
				},
				technicalExpert: {
					provider: LLMProvider.OPENAI,
					apiKey: 'test-key-2',
					model: 'gpt-4',
					temperature: 0.5,
					maxTokens: 4096,
				},
				verifier: {
					provider: LLMProvider.CLAUDE,
					apiKey: 'test-key-3',
					model: 'claude-3-sonnet-20240229',
					temperature: 0.3,
					maxTokens: 2048,
				},
				historianInterpreter: {
					provider: LLMProvider.OPENAI,
					apiKey: 'test-key-4',
					model: 'gpt-4',
					temperature: 0.5,
					maxTokens: 4096,
				},
			} as any;

			const result = validateLLMConfig(config);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.valid).toBe(true);
				expect(result.value.roles.length).toBe(4);
			}
		});

		it('detects missing role configuration', () => {
			const config = {
				executor: {
					provider: LLMProvider.CLAUDE,
					apiKey: 'test-key',
					model: 'claude-3-opus-20240229',
					temperature: 0.7,
					maxTokens: 4096,
				},
			} as any;

			const result = validateLLMConfig(config);

			expect(result.success).toBe(false);
		});

		it('detects missing API key', () => {
			const config = {
				executor: {
					provider: LLMProvider.CLAUDE,
					apiKey: '',
					model: 'claude-3-opus-20240229',
					temperature: 0.7,
					maxTokens: 4096,
				},
				technicalExpert: {
					provider: LLMProvider.OPENAI,
					apiKey: 'test-key',
					model: 'gpt-4',
					temperature: 0.5,
					maxTokens: 4096,
				},
				verifier: {
					provider: LLMProvider.CLAUDE,
					apiKey: 'test-key',
					model: 'claude-3-sonnet-20240229',
					temperature: 0.3,
					maxTokens: 2048,
				},
				historianInterpreter: {
					provider: LLMProvider.OPENAI,
					apiKey: 'test-key',
					model: 'gpt-4',
					temperature: 0.5,
					maxTokens: 4096,
				},
			} as any;

			const result = validateLLMConfig(config);

			expect(result.success).toBe(false);
		});

		it('detects missing model', () => {
			const config = {
				executor: {
					provider: LLMProvider.CLAUDE,
					apiKey: 'test-key',
					model: '',
					temperature: 0.7,
					maxTokens: 4096,
				},
				technicalExpert: {
					provider: LLMProvider.OPENAI,
					apiKey: 'test-key',
					model: 'gpt-4',
					temperature: 0.5,
					maxTokens: 4096,
				},
				verifier: {
					provider: LLMProvider.CLAUDE,
					apiKey: 'test-key',
					model: 'claude-3-sonnet-20240229',
					temperature: 0.3,
					maxTokens: 2048,
				},
				historianInterpreter: {
					provider: LLMProvider.OPENAI,
					apiKey: 'test-key',
					model: 'gpt-4',
					temperature: 0.5,
					maxTokens: 4096,
				},
			} as any;

			const result = validateLLMConfig(config);

			expect(result.success).toBe(false);
		});

		it('detects invalid provider', () => {
			const config = {
				executor: {
					provider: 'INVALID' as any,
					apiKey: 'test-key',
					model: 'model',
					temperature: 0.7,
					maxTokens: 4096,
				},
				technicalExpert: {
					provider: LLMProvider.OPENAI,
					apiKey: 'test-key',
					model: 'gpt-4',
					temperature: 0.5,
					maxTokens: 4096,
				},
				verifier: {
					provider: LLMProvider.CLAUDE,
					apiKey: 'test-key',
					model: 'claude-3-sonnet-20240229',
					temperature: 0.3,
					maxTokens: 2048,
				},
				historianInterpreter: {
					provider: LLMProvider.OPENAI,
					apiKey: 'test-key',
					model: 'gpt-4',
					temperature: 0.5,
					maxTokens: 4096,
				},
			} as any;

			const result = validateLLMConfig(config);

			expect(result.success).toBe(false);
		});

		it('handles empty configuration', () => {
			const config = {} as any;

			const result = validateLLMConfig(config);

			expect(result.success).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('handles Claude response with no content blocks', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockResolvedValue({
						id: 'msg-123',
						model: 'claude-3-opus-20240229',
						content: [],
						usage: { input_tokens: 100, output_tokens: 0 },
						stop_reason: 'end_turn',
					}),
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.content).toBe('');
			}
		});

		it('handles OpenAI response with missing usage', async () => {
			const OpenAI = (await import('openai')).default;

			vi.mocked(OpenAI).mockImplementation(() => ({
				chat: {
					completions: {
						create: vi.fn().mockResolvedValue({
							id: 'chatcmpl-123',
							model: 'gpt-4',
							choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
							usage: undefined,
						}),
					},
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.OPENAI,
				apiKey: 'test-key',
				model: 'gpt-4',
				userPrompt: 'Test prompt',
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.usage.totalTokens).toBe(0);
			}
		});

		it('handles very long prompts', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockResolvedValue({
						id: 'msg-123',
						model: 'claude-3-opus-20240229',
						content: [{ type: 'text', text: 'Response' }],
						usage: { input_tokens: 10000, output_tokens: 50 },
						stop_reason: 'end_turn',
					}),
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'x'.repeat(50000),
			};

			const result = await invokeLLM(options);

			expect(result.success).toBe(true);
		});

		it('handles zero temperature', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			const mockCreate = vi.fn().mockResolvedValue({
				id: 'msg-123',
				model: 'claude-3-opus-20240229',
				content: [{ type: 'text', text: 'Response' }],
				usage: { input_tokens: 100, output_tokens: 50 },
				stop_reason: 'end_turn',
			});

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: { create: mockCreate },
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
				temperature: 0,
			};

			await invokeLLM(options);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0,
				})
			);
		});

		it('handles concurrent invocations', async () => {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;

			vi.mocked(Anthropic).mockImplementation(() => ({
				messages: {
					create: vi.fn().mockResolvedValue({
						id: 'msg-123',
						model: 'claude-3-opus-20240229',
						content: [{ type: 'text', text: 'Response' }],
						usage: { input_tokens: 100, output_tokens: 50 },
						stop_reason: 'end_turn',
					}),
				},
			} as any));

			const options: LLMRequestOptions = {
				provider: LLMProvider.CLAUDE,
				apiKey: 'test-key',
				model: 'claude-3-opus-20240229',
				userPrompt: 'Test prompt',
			};

			const results = await Promise.all([
				invokeLLM(options),
				invokeLLM(options),
				invokeLLM(options),
			]);

			expect(results.every(r => r.success)).toBe(true);
		});
	});
});
