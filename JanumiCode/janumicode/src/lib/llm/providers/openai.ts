/**
 * OpenAI API Provider
 * Implements Phase 4.3: OpenAI API Integration
 * Provides integration with OpenAI's GPT models
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
 * OpenAI API message format
 */
interface OpenAIMessage {
	role: 'system' | 'user' | 'assistant';
	content: string | OpenAIContentPart[];
}

interface OpenAIContentPart {
	type: 'text' | 'image_url';
	text?: string;
	image_url?: {
		url: string;
	};
}

/**
 * OpenAI API request format
 */
interface OpenAIAPIRequest {
	model: string;
	messages: OpenAIMessage[];
	max_tokens?: number;
	temperature?: number;
	top_p?: number;
	stop?: string[];
}

/**
 * OpenAI API response format
 */
interface OpenAIAPIResponse {
	id: string;
	object: 'chat.completion';
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: {
			role: 'assistant';
			content: string;
		};
		finish_reason: 'stop' | 'length' | 'content_filter' | null;
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * OpenAI API error response
 */
interface OpenAIAPIError {
	error: {
		message: string;
		type: string;
		code: string | null;
	};
}

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider implements LLMProvider {
	public readonly name = 'OpenAI';
	private config: ProviderConfig;
	private rateLimitInfo: RateLimitInfo | null = null;

	public readonly capabilities: ProviderCapabilities = {
		supportsSystemPrompt: true,
		supportsStreaming: true,
		supportsMultimodal: true,
		maxContextWindow: 128000,
		models: [
			'gpt-4',
			'gpt-4-turbo',
			'gpt-4-turbo-preview',
			'gpt-3.5-turbo',
			'gpt-3.5-turbo-16k',
		],
	};

	constructor(config: ProviderConfig) {
		this.config = {
			...config,
			endpoint: config.endpoint || 'https://api.openai.com/v1',
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
				// Convert messages to OpenAI format
				const openaiMessages = this.convertMessages(
					request.systemPrompt,
					request.messages
				);

				// Resolve model — 'default' means use configured default
				const model = request.model === 'default'
					? (this.config.defaultModel || 'gpt-4')
					: request.model;

				// Build API request
				const apiRequest: OpenAIAPIRequest = {
					model,
					messages: openaiMessages,
				};

				// Add optional parameters
				if (request.maxTokens) {
					apiRequest.max_tokens = request.maxTokens;
				}
				if (request.temperature !== undefined) {
					apiRequest.temperature = request.temperature;
				}
				if (request.topP !== undefined) {
					apiRequest.top_p = request.topP;
				}
				if (request.stopSequences) {
					apiRequest.stop = request.stopSequences;
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
			// TODO: Implement proper OpenAI tokenizer (tiktoken)
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
			const response = await fetch(`${this.config.endpoint}/models`, {
				method: 'GET',
				headers: this.getHeaders(),
			});

			return { success: true, value: response.ok };
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
	 * Convert messages to OpenAI format
	 */
	private convertMessages(
		systemPrompt: string | undefined,
		messages: Message[]
	): OpenAIMessage[] {
		const openaiMessages: OpenAIMessage[] = [];

		// Add system prompt as first message if provided
		if (systemPrompt) {
			openaiMessages.push({
				role: 'system',
				content: systemPrompt,
			});
		}

		// Convert messages
		for (const msg of messages) {
			const openaiMessage: OpenAIMessage = {
				role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
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
										type: 'image_url',
										image_url: {
											url: part.image_url || '',
										},
									};
								}
						  }),
			};
			openaiMessages.push(openaiMessage);
		}

		return openaiMessages;
	}

	/**
	 * Get request headers
	 */
	private getHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${this.config.apiKey}`,
		};

		if (this.config.organizationId) {
			headers['OpenAI-Organization'] = this.config.organizationId;
		}

		return headers;
	}

	/**
	 * Make API request
	 */
	private async makeRequest(request: OpenAIAPIRequest): Promise<Response> {
		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			this.config.timeout || 120000
		);

		try {
			const response = await fetch(
				`${this.config.endpoint}/chat/completions`,
				{
					method: 'POST',
					headers: this.getHeaders(),
					body: JSON.stringify(request),
					signal: controller.signal,
				}
			);

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
			const data = (await response.json()) as OpenAIAPIResponse;

			// Extract first choice
			const choice = data.choices[0];
			if (!choice) {
				return {
					success: false,
					error: new LLMError('No choices in response', LLMErrorType.UNKNOWN),
				};
			}

			// Map finish reason
			let stopReason: LLMResponse['stopReason'];
			switch (choice.finish_reason) {
				case 'stop':
					stopReason = 'end_turn';
					break;
				case 'length':
					stopReason = 'max_tokens';
					break;
				default:
					stopReason = undefined;
			}

			return {
				success: true,
				value: {
					content: choice.message.content,
					model: data.model,
					usage: {
						inputTokens: data.usage.prompt_tokens,
						outputTokens: data.usage.completion_tokens,
						totalTokens: data.usage.total_tokens,
					},
					stopReason,
					metadata: {
						id: data.id,
						created: data.created,
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
		// Read body as text first to avoid double-consumption and handle non-JSON errors
		let rawBody = '';
		try {
			rawBody = await response.text();
		} catch {
			rawBody = `(could not read response body — status ${response.status})`;
		}

		// Try to parse as JSON — handle both OpenAI and Gemini error formats
		let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
		let errorType = 'unknown';

		try {
			const data = JSON.parse(rawBody);
			// OpenAI format: { error: { message, type, code } }
			// Gemini format: { error: { code, message, status, details } }
			// Some APIs: { message, code }
			errorMessage = data.error?.message
				|| data.message
				|| data.error?.status
				|| `HTTP ${response.status}: ${rawBody.substring(0, 200)}`;
			errorType = data.error?.type
				|| data.error?.status
				|| data.type
				|| 'unknown';
		} catch {
			// Response body is not JSON (e.g. HTML error page)
			errorMessage = `HTTP ${response.status}: ${rawBody.substring(0, 300)}`;
		}

		// Map error types to LLM error types
		let llmErrorType: LLMErrorType;

		switch (errorType) {
			case 'invalid_request_error':
			case 'INVALID_ARGUMENT':
				llmErrorType = LLMErrorType.INVALID_REQUEST;
				break;
			case 'authentication_error':
			case 'UNAUTHENTICATED':
				llmErrorType = LLMErrorType.INVALID_API_KEY;
				break;
			case 'permission_error':
			case 'PERMISSION_DENIED':
				llmErrorType = LLMErrorType.INVALID_API_KEY;
				break;
			case 'rate_limit_error':
			case 'RESOURCE_EXHAUSTED':
				llmErrorType = LLMErrorType.RATE_LIMIT;
				break;
			case 'server_error':
			case 'INTERNAL':
			case 'UNAVAILABLE':
				llmErrorType = LLMErrorType.SERVICE_UNAVAILABLE;
				break;
			default:
				if (response.status === 429) {
					llmErrorType = LLMErrorType.RATE_LIMIT;
				} else if (response.status === 401 || response.status === 403) {
					llmErrorType = LLMErrorType.INVALID_API_KEY;
				} else {
					llmErrorType = LLMErrorType.UNKNOWN;
				}
		}

		throw new LLMError(errorMessage, llmErrorType, {
			statusCode: response.status,
			metadata: { errorType, rawBody: rawBody.substring(0, 500) },
		});
	}

	/**
	 * Update rate limit info from response headers
	 */
	private updateRateLimitInfo(headers: Headers): void {
		const requestsRemaining = headers.get('x-ratelimit-remaining-requests');
		const tokensRemaining = headers.get('x-ratelimit-remaining-tokens');
		const resetRequests = headers.get('x-ratelimit-reset-requests');

		if (requestsRemaining && tokensRemaining && resetRequests) {
			this.rateLimitInfo = {
				requestsRemaining: parseInt(requestsRemaining, 10),
				tokensRemaining: parseInt(tokensRemaining, 10),
				resetAt: resetRequests,
			};
		}
	}
}
