/**
 * Claude API Provider
 * Implements Phase 4.2: Claude API Integration
 * Provides integration with Anthropic's Claude API
 */

import type { Result } from '../../types';
import type {
	LLMProvider,
	LLMRequest,
	LLMResponse,
	ProviderConfig,
	ProviderCapabilities,
	RateLimitInfo,
	Message,
} from '../provider';
import { LLMError, LLMErrorType, executeWithRetry } from '../provider';
import { countTokens } from '../tokenCounter';

/**
 * Claude API message format
 */
interface ClaudeMessage {
	role: 'user' | 'assistant';
	content: string | ClaudeContentPart[];
}

interface ClaudeContentPart {
	type: 'text' | 'image';
	text?: string;
	source?: {
		type: 'base64';
		media_type: string;
		data: string;
	};
}

/**
 * Claude API request format
 */
interface ClaudeAPIRequest {
	model: string;
	messages: ClaudeMessage[];
	max_tokens: number;
	system?: string;
	temperature?: number;
	top_p?: number;
	stop_sequences?: string[];
	metadata?: Record<string, unknown>;
}

/**
 * Claude API response format
 */
interface ClaudeAPIResponse {
	id: string;
	type: 'message';
	role: 'assistant';
	content: Array<{
		type: 'text';
		text: string;
	}>;
	model: string;
	stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
}

/**
 * Claude API error response
 */
interface ClaudeAPIError {
	type: 'error';
	error: {
		type: string;
		message: string;
	};
}

/**
 * Claude provider implementation
 */
export class ClaudeProvider implements LLMProvider {
	public readonly name = 'Claude';
	private config: ProviderConfig;
	private rateLimitInfo: RateLimitInfo | null = null;

	public readonly capabilities: ProviderCapabilities = {
		supportsSystemPrompt: true,
		supportsStreaming: true,
		supportsMultimodal: true,
		maxContextWindow: 200000,
		models: [
			'claude-opus-4-6',
			'claude-sonnet-4-5-20250929',
			'claude-sonnet-4-20250514',
			'claude-haiku-4-5-20251001',
		],
	};

	constructor(config: ProviderConfig) {
		this.config = {
			...config,
			endpoint: config.endpoint || 'https://api.anthropic.com/v1',
			timeout: config.timeout || 120000,
			maxRetries: config.maxRetries || 3,
		};
	}

	/**
	 * Generate completion
	 */
	async complete(request: LLMRequest): Promise<Result<LLMResponse>> {
		return executeWithRetry(async () => {
			try {
				// Convert messages to Claude format
				const claudeMessages = this.convertMessages(request.messages);

				// Resolve model — 'default' means use configured default
				const model = request.model === 'default'
					? (this.config.defaultModel || 'claude-sonnet-4-5-20250929')
					: request.model;

				// Build API request
				const apiRequest: ClaudeAPIRequest = {
					model,
					messages: claudeMessages,
					max_tokens: request.maxTokens || 4096,
				};

				// Add system prompt if provided
				if (request.systemPrompt) {
					apiRequest.system = request.systemPrompt;
				}

				// Add optional parameters
				if (request.temperature !== undefined) {
					apiRequest.temperature = request.temperature;
				}
				if (request.topP !== undefined) {
					apiRequest.top_p = request.topP;
				}
				if (request.stopSequences) {
					apiRequest.stop_sequences = request.stopSequences;
				}
				if (request.metadata) {
					apiRequest.metadata = request.metadata;
				}

				// Make API request
				const response = await this.makeRequest(apiRequest);

				// Parse response
				return this.parseResponse(response);
			} catch (error) {
				if (error instanceof LLMError) {
					return { success: false, error };
				}
				return {
					success: false,
					error: new LLMError(
						error instanceof Error ? error.message : 'Unknown error',
						LLMErrorType.UNKNOWN
					),
				};
			}
		});
	}

	/**
	 * Count tokens in text
	 */
	async countTokens(text: string, _model: string): Promise<Result<number>> {
		try {
			// Use approximation for now
			// TODO: Implement proper Claude tokenizer
			const tokens = countTokens(text);
			return { success: true, value: tokens };
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error ? error : new Error('Failed to count tokens'),
			};
		}
	}

	/**
	 * Get rate limit info
	 */
	async getRateLimitInfo(): Promise<Result<RateLimitInfo | null>> {
		return { success: true, value: this.rateLimitInfo };
	}

	/**
	 * Validate API key
	 */
	async validateApiKey(): Promise<Result<boolean>> {
		try {
			// Make a minimal request to validate key
			const response = await fetch(`${this.config.endpoint}/messages`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify({
					model: 'claude-haiku-4-5-20251001',
					messages: [{ role: 'user', content: 'test' }],
					max_tokens: 1,
				}),
			});

			return { success: true, value: response.ok || response.status === 400 };
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error
						? error
						: new Error('Failed to validate API key'),
			};
		}
	}

	/**
	 * Convert messages to Claude format
	 */
	private convertMessages(messages: Message[]): ClaudeMessage[] {
		return messages.map((msg) => {
			const claudeMessage: ClaudeMessage = {
				role: msg.role === 'user' ? 'user' : 'assistant',
				content:
					typeof msg.content === 'string'
						? msg.content
						: msg.content.map((part) => {
								if (part.type === 'text') {
									return {
										type: 'text',
										text: part.text || '',
									};
								} else {
									// Image part
									return {
										type: 'image',
										source: {
											type: 'base64',
											media_type: 'image/jpeg',
											data: part.image_url || '',
										},
									};
								}
						  }),
			};
			return claudeMessage;
		});
	}

	/**
	 * Get request headers
	 */
	private getHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'x-api-key': this.config.apiKey,
			'anthropic-version': '2023-06-01',
		};

		return headers;
	}

	/**
	 * Make API request
	 */
	private async makeRequest(request: ClaudeAPIRequest): Promise<Response> {
		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			this.config.timeout || 120000
		);

		try {
			const response = await fetch(`${this.config.endpoint}/messages`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify(request),
				signal: controller.signal,
			});

			clearTimeout(timeout);

			// Update rate limit info from headers
			this.updateRateLimitInfo(response.headers);

			// Handle errors
			if (!response.ok) {
				await this.handleErrorResponse(response);
			}

			return response;
		} catch (error) {
			clearTimeout(timeout);

			if (error instanceof LLMError) {
				throw error;
			}

			// Network error
			throw new LLMError(
				error instanceof Error ? error.message : 'Network error',
				LLMErrorType.NETWORK_ERROR
			);
		}
	}

	/**
	 * Parse API response
	 */
	private async parseResponse(response: Response): Promise<Result<LLMResponse>> {
		try {
			const data = (await response.json()) as ClaudeAPIResponse;

			// Extract text content
			const content = data.content
				.filter((c) => c.type === 'text')
				.map((c) => c.text)
				.join('');

			return {
				success: true,
				value: {
					content,
					model: data.model,
					usage: {
						inputTokens: data.usage.input_tokens,
						outputTokens: data.usage.output_tokens,
						totalTokens:
							data.usage.input_tokens + data.usage.output_tokens,
					},
					stopReason: data.stop_reason || undefined,
					metadata: {
						id: data.id,
					},
				},
			};
		} catch (error) {
			return {
				success: false,
				error: new LLMError(
					'Failed to parse response',
					LLMErrorType.UNKNOWN,
					{
						metadata: { originalError: error },
					}
				),
			};
		}
	}

	/**
	 * Handle error response
	 */
	private async handleErrorResponse(response: Response): Promise<never> {
		const data = (await response.json()) as ClaudeAPIError;

		const errorMessage = data.error?.message || 'Unknown error';
		const errorType = data.error?.type || 'unknown';

		// Map Claude error types to LLM error types
		let llmErrorType: LLMErrorType;

		switch (errorType) {
			case 'invalid_request_error':
				llmErrorType = LLMErrorType.INVALID_REQUEST;
				break;
			case 'authentication_error':
				llmErrorType = LLMErrorType.INVALID_API_KEY;
				break;
			case 'permission_error':
				llmErrorType = LLMErrorType.INVALID_API_KEY;
				break;
			case 'rate_limit_error':
				llmErrorType = LLMErrorType.RATE_LIMIT;
				break;
			case 'overloaded_error':
				llmErrorType = LLMErrorType.SERVICE_UNAVAILABLE;
				break;
			default:
				llmErrorType = LLMErrorType.UNKNOWN;
		}

		throw new LLMError(errorMessage, llmErrorType, {
			statusCode: response.status,
			metadata: { errorType },
		});
	}

	/**
	 * Update rate limit info from response headers
	 */
	private updateRateLimitInfo(headers: Headers): void {
		const requestsRemaining = headers.get('anthropic-ratelimit-requests-remaining');
		const tokensRemaining = headers.get('anthropic-ratelimit-tokens-remaining');
		const resetTimestamp = headers.get('anthropic-ratelimit-requests-reset');

		if (requestsRemaining && tokensRemaining && resetTimestamp) {
			this.rateLimitInfo = {
				requestsRemaining: parseInt(requestsRemaining, 10),
				tokensRemaining: parseInt(tokensRemaining, 10),
				resetAt: resetTimestamp,
			};
		}
	}
}
