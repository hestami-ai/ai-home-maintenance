import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	MessageRole,
	LLMError,
	LLMErrorType,
	calculateRetryDelay,
	executeWithRetry,
	DEFAULT_RETRY_CONFIG,
	type Message,
	type LLMRequest,
	type LLMResponse,
	type TokenUsage,
	type RetryConfig,
} from '../../../lib/llm/provider';

describe('llm/provider', () => {
	describe('MessageRole enum', () => {
		it('defines all message roles', () => {
			expect(MessageRole.SYSTEM).toBe('system');
			expect(MessageRole.USER).toBe('user');
			expect(MessageRole.ASSISTANT).toBe('assistant');
		});
	});

	describe('LLMError', () => {
		it('creates error with type and message', () => {
			const error = new LLMError('Test error', LLMErrorType.INVALID_API_KEY);
			expect(error.message).toBe('Test error');
			expect(error.type).toBe(LLMErrorType.INVALID_API_KEY);
			expect(error.name).toBe('LLMError');
		});

		it('marks retryable errors as retryable', () => {
			const rateLimitError = new LLMError('Rate limit', LLMErrorType.RATE_LIMIT);
			expect(rateLimitError.retryable).toBe(true);

			const networkError = new LLMError('Network', LLMErrorType.NETWORK_ERROR);
			expect(networkError.retryable).toBe(true);

			const serviceError = new LLMError('Service', LLMErrorType.SERVICE_UNAVAILABLE);
			expect(serviceError.retryable).toBe(true);
		});

		it('marks non-retryable errors as non-retryable', () => {
			const apiKeyError = new LLMError('Invalid key', LLMErrorType.INVALID_API_KEY);
			expect(apiKeyError.retryable).toBe(false);

			const contextError = new LLMError('Context', LLMErrorType.CONTEXT_LENGTH);
			expect(contextError.retryable).toBe(false);

			const invalidError = new LLMError('Invalid', LLMErrorType.INVALID_REQUEST);
			expect(invalidError.retryable).toBe(false);
		});

		it('allows manual retryable override', () => {
			const error = new LLMError('Test', LLMErrorType.INVALID_API_KEY, {
				retryable: true,
			});
			expect(error.retryable).toBe(true);
		});

		it('includes status code when provided', () => {
			const error = new LLMError('Test', LLMErrorType.RATE_LIMIT, {
				statusCode: 429,
			});
			expect(error.statusCode).toBe(429);
		});

		it('includes metadata when provided', () => {
			const metadata = { requestId: '123', endpoint: '/chat' };
			const error = new LLMError('Test', LLMErrorType.NETWORK_ERROR, {
				metadata,
			});
			expect(error.metadata).toEqual(metadata);
		});

		it('has undefined statusCode and metadata by default', () => {
			const error = new LLMError('Test', LLMErrorType.UNKNOWN);
			expect(error.statusCode).toBeUndefined();
			expect(error.metadata).toBeUndefined();
		});
	});

	describe('LLMErrorType enum', () => {
		it('defines all error types', () => {
			expect(LLMErrorType.INVALID_API_KEY).toBe('INVALID_API_KEY');
			expect(LLMErrorType.RATE_LIMIT).toBe('RATE_LIMIT');
			expect(LLMErrorType.CONTEXT_LENGTH).toBe('CONTEXT_LENGTH');
			expect(LLMErrorType.INVALID_REQUEST).toBe('INVALID_REQUEST');
			expect(LLMErrorType.NETWORK_ERROR).toBe('NETWORK_ERROR');
			expect(LLMErrorType.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
			expect(LLMErrorType.UNKNOWN).toBe('UNKNOWN');
		});
	});

	describe('calculateRetryDelay', () => {
		it('calculates delay with exponential backoff', () => {
			const config: RetryConfig = {
				maxRetries: 3,
				initialDelay: 1000,
				maxDelay: 60000,
				backoffMultiplier: 2,
				jitter: 0,
			};

			expect(calculateRetryDelay(0, config)).toBe(1000); // 1000 * 2^0
			expect(calculateRetryDelay(1, config)).toBe(2000); // 1000 * 2^1
			expect(calculateRetryDelay(2, config)).toBe(4000); // 1000 * 2^2
			expect(calculateRetryDelay(3, config)).toBe(8000); // 1000 * 2^3
		});

		it('caps delay at maxDelay', () => {
			const config: RetryConfig = {
				maxRetries: 10,
				initialDelay: 1000,
				maxDelay: 5000,
				backoffMultiplier: 2,
				jitter: 0,
			};

			expect(calculateRetryDelay(5, config)).toBe(5000); // Would be 32000, capped
			expect(calculateRetryDelay(10, config)).toBe(5000); // Would be 1024000, capped
		});

		it('adds jitter to delay', () => {
			const config: RetryConfig = {
				maxRetries: 3,
				initialDelay: 1000,
				maxDelay: 60000,
				backoffMultiplier: 2,
				jitter: 0.1,
			};

			const delay = calculateRetryDelay(0, config);
			expect(delay).toBeGreaterThanOrEqual(900); // 1000 - 10%
			expect(delay).toBeLessThanOrEqual(1100); // 1000 + 10%
		});

		it('uses default config when not provided', () => {
			const delay = calculateRetryDelay(0);
			expect(delay).toBeGreaterThanOrEqual(900); // ~1000 with jitter
			expect(delay).toBeLessThanOrEqual(1100);
		});

		it('never returns negative delay', () => {
			const config: RetryConfig = {
				maxRetries: 1,
				initialDelay: 100,
				maxDelay: 200,
				backoffMultiplier: 2,
				jitter: 2,
			};

			const delay = calculateRetryDelay(0, config);
			expect(delay).toBeGreaterThanOrEqual(0);
		});
	});

	describe('DEFAULT_RETRY_CONFIG', () => {
		it('has expected values', () => {
			expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
			expect(DEFAULT_RETRY_CONFIG.initialDelay).toBe(1000);
			expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(60000);
			expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
			expect(DEFAULT_RETRY_CONFIG.jitter).toBe(0.1);
		});
	});

	describe('executeWithRetry', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('returns immediately on success', async () => {
			const fn = vi.fn().mockResolvedValue({
				success: true,
				value: 'success',
			});

			const config: RetryConfig = {
				maxRetries: 3,
				initialDelay: 1000,
				maxDelay: 60000,
				backoffMultiplier: 2,
				jitter: 0,
			};

			const promise = executeWithRetry(fn, config);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe('success');
			}
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('retries on retryable error', async () => {
			const fn = vi
				.fn()
				.mockResolvedValueOnce({
					success: false,
					error: new LLMError('Rate limit', LLMErrorType.RATE_LIMIT),
				})
				.mockResolvedValueOnce({
					success: false,
					error: new LLMError('Rate limit', LLMErrorType.RATE_LIMIT),
				})
				.mockResolvedValueOnce({
					success: true,
					value: 'success',
				});

			const config: RetryConfig = {
				maxRetries: 3,
				initialDelay: 1000,
				maxDelay: 60000,
				backoffMultiplier: 2,
				jitter: 0,
			};

			const promise = executeWithRetry(fn, config);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result.success).toBe(true);
			expect(fn).toHaveBeenCalledTimes(3);
		});

		it('does not retry on non-retryable error', async () => {
			const fn = vi.fn().mockResolvedValue({
				success: false,
				error: new LLMError('Invalid API key', LLMErrorType.INVALID_API_KEY),
			});

			const config: RetryConfig = {
				maxRetries: 3,
				initialDelay: 1000,
				maxDelay: 60000,
				backoffMultiplier: 2,
				jitter: 0,
			};

			const promise = executeWithRetry(fn, config);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result.success).toBe(false);
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('returns error after max retries', async () => {
			const fn = vi.fn().mockResolvedValue({
				success: false,
				error: new LLMError('Network error', LLMErrorType.NETWORK_ERROR),
			});

			const config: RetryConfig = {
				maxRetries: 2,
				initialDelay: 100,
				maxDelay: 1000,
				backoffMultiplier: 2,
				jitter: 0,
			};

			const promise = executeWithRetry(fn, config);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result.success).toBe(false);
			expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
		});

		it('handles thrown errors', async () => {
			const fn = vi
				.fn()
				.mockRejectedValueOnce(new Error('Network failure'))
				.mockResolvedValueOnce({
					success: true,
					value: 'success',
				});

			const config: RetryConfig = {
				maxRetries: 2,
				initialDelay: 100,
				maxDelay: 1000,
				backoffMultiplier: 2,
				jitter: 0,
			};

			const promise = executeWithRetry(fn, config);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result.success).toBe(true);
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it('handles non-Error thrown values', async () => {
			const fn = vi
				.fn()
				.mockRejectedValueOnce('string error')
				.mockResolvedValueOnce({
					success: true,
					value: 'success',
				});

			const config: RetryConfig = {
				maxRetries: 2,
				initialDelay: 100,
				maxDelay: 1000,
				backoffMultiplier: 2,
				jitter: 0,
			};

			const promise = executeWithRetry(fn, config);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result.success).toBe(true);
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it('uses default config when not provided', async () => {
			const fn = vi.fn().mockResolvedValue({
				success: true,
				value: 'success',
			});

			const promise = executeWithRetry(fn);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result.success).toBe(true);
		});

		it('waits correct delay between retries', async () => {
			const fn = vi
				.fn()
				.mockResolvedValueOnce({
					success: false,
					error: new LLMError('Network', LLMErrorType.NETWORK_ERROR),
				})
				.mockResolvedValueOnce({
					success: true,
					value: 'success',
				});

			const config: RetryConfig = {
				maxRetries: 2,
				initialDelay: 1000,
				maxDelay: 60000,
				backoffMultiplier: 2,
				jitter: 0,
			};

			const promise = executeWithRetry(fn, config);

			// First call happens immediately
			await vi.advanceTimersByTimeAsync(0);
			expect(fn).toHaveBeenCalledTimes(1);

			// Second call after 1000ms delay
			await vi.advanceTimersByTimeAsync(1000);
			expect(fn).toHaveBeenCalledTimes(2);

			const result = await promise;
			expect(result.success).toBe(true);
		});
	});

	describe('Message types', () => {
		it('creates message with string content', () => {
			const message: Message = {
				role: MessageRole.USER,
				content: 'Hello',
			};

			expect(message.role).toBe(MessageRole.USER);
			expect(message.content).toBe('Hello');
		});

		it('creates message with multimodal content', () => {
			const message: Message = {
				role: MessageRole.USER,
				content: [
					{ type: 'text', text: 'Describe this image' },
					{ type: 'image', image_url: 'https://example.com/image.jpg' },
				],
			};

			expect(message.role).toBe(MessageRole.USER);
			expect(Array.isArray(message.content)).toBe(true);
			if (Array.isArray(message.content)) {
				expect(message.content).toHaveLength(2);
				expect(message.content[0].type).toBe('text');
				expect(message.content[1].type).toBe('image');
			}
		});
	});

	describe('LLMRequest', () => {
		it('creates request with required fields', () => {
			const request: LLMRequest = {
				messages: [
					{ role: MessageRole.USER, content: 'Hello' },
				],
				model: 'gpt-4',
			};

			expect(request.messages).toHaveLength(1);
			expect(request.model).toBe('gpt-4');
		});

		it('includes optional configuration', () => {
			const request: LLMRequest = {
				systemPrompt: 'You are a helpful assistant',
				messages: [
					{ role: MessageRole.USER, content: 'Hello' },
				],
				model: 'gpt-4',
				maxTokens: 1000,
				temperature: 0.7,
				topP: 0.9,
				stopSequences: ['\n\n'],
				metadata: { requestId: '123' },
			};

			expect(request.systemPrompt).toBe('You are a helpful assistant');
			expect(request.maxTokens).toBe(1000);
			expect(request.temperature).toBe(0.7);
			expect(request.topP).toBe(0.9);
			expect(request.stopSequences).toEqual(['\n\n']);
			expect(request.metadata).toEqual({ requestId: '123' });
		});

		it('includes response schema for structured output', () => {
			const schema = {
				type: 'object',
				properties: {
					name: { type: 'string' },
					age: { type: 'number' },
				},
			};

			const request: LLMRequest = {
				messages: [{ role: MessageRole.USER, content: 'Extract user info' }],
				model: 'gpt-4',
				responseSchema: schema,
			};

			expect(request.responseSchema).toEqual(schema);
		});
	});

	describe('LLMResponse', () => {
		it('creates response with required fields', () => {
			const usage: TokenUsage = {
				inputTokens: 10,
				outputTokens: 20,
				totalTokens: 30,
			};

			const response: LLMResponse = {
				content: 'Hello!',
				model: 'gpt-4',
				usage,
			};

			expect(response.content).toBe('Hello!');
			expect(response.model).toBe('gpt-4');
			expect(response.usage.inputTokens).toBe(10);
			expect(response.usage.outputTokens).toBe(20);
			expect(response.usage.totalTokens).toBe(30);
		});

		it('includes stop reason', () => {
			const response: LLMResponse = {
				content: 'Hello!',
				model: 'gpt-4',
				usage: {
					inputTokens: 10,
					outputTokens: 20,
					totalTokens: 30,
				},
				stopReason: 'end_turn',
			};

			expect(response.stopReason).toBe('end_turn');
		});

		it('includes metadata', () => {
			const metadata = { modelVersion: '2024-01' };

			const response: LLMResponse = {
				content: 'Hello!',
				model: 'gpt-4',
				usage: {
					inputTokens: 10,
					outputTokens: 20,
					totalTokens: 30,
				},
				metadata,
			};

			expect(response.metadata).toEqual(metadata);
		});
	});

	describe('TokenUsage', () => {
		it('tracks all token counts', () => {
			const usage: TokenUsage = {
				inputTokens: 100,
				outputTokens: 50,
				totalTokens: 150,
			};

			expect(usage.inputTokens).toBe(100);
			expect(usage.outputTokens).toBe(50);
			expect(usage.totalTokens).toBe(150);
		});
	});

	describe('ProviderConfig', () => {
		it('creates config with API key', () => {
			const config = {
				apiKey: 'sk-test-key',
			};

			expect(config.apiKey).toBe('sk-test-key');
		});

		it('includes optional fields', () => {
			const config = {
				apiKey: 'sk-test-key',
				endpoint: 'https://custom.api.com',
				defaultModel: 'custom-model',
				timeout: 30000,
				maxRetries: 5,
				organizationId: 'org-123',
			};

			expect(config.endpoint).toBe('https://custom.api.com');
			expect(config.defaultModel).toBe('custom-model');
			expect(config.timeout).toBe(30000);
			expect(config.maxRetries).toBe(5);
			expect(config.organizationId).toBe('org-123');
		});
	});
});
