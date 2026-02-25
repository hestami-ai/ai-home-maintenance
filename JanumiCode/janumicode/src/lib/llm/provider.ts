/**
 * LLM Provider Abstraction Layer
 * Implements Phase 4.1: Provider interface and base types
 * Provides unified interface for Claude, OpenAI, and future providers
 */

import type { Result } from '../types';

/**
 * Message role types (standardized across providers)
 */
export enum MessageRole {
	SYSTEM = 'system',
	USER = 'user',
	ASSISTANT = 'assistant',
}

/**
 * Message content types
 */
export type MessageContent = string | MessageContentPart[];

/**
 * Message content part (for multimodal content)
 */
export interface MessageContentPart {
	type: 'text' | 'image';
	text?: string;
	image_url?: string;
}

/**
 * Standardized message format
 */
export interface Message {
	role: MessageRole;
	content: MessageContent;
}

/**
 * LLM request configuration
 */
export interface LLMRequest {
	/** System prompt (if supported by provider) */
	systemPrompt?: string;
	/** Conversation messages */
	messages: Message[];
	/** Model identifier */
	model: string;
	/** Maximum tokens to generate */
	maxTokens?: number;
	/** Temperature (0-1, higher = more creative) */
	temperature?: number;
	/** Top-p sampling */
	topP?: number;
	/** Stop sequences */
	stopSequences?: string[];
	/** Request metadata (for logging/tracking) */
	metadata?: Record<string, unknown>;
}

/**
 * Token usage information
 */
export interface TokenUsage {
	/** Input tokens consumed */
	inputTokens: number;
	/** Output tokens generated */
	outputTokens: number;
	/** Total tokens */
	totalTokens: number;
}

/**
 * LLM response
 */
export interface LLMResponse {
	/** Generated text content */
	content: string;
	/** Model used */
	model: string;
	/** Token usage */
	usage: TokenUsage;
	/** Stop reason */
	stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'error';
	/** Provider-specific metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
	/** Requests remaining in current window */
	requestsRemaining: number;
	/** Tokens remaining in current window */
	tokensRemaining: number;
	/** Reset timestamp (ISO-8601) */
	resetAt: string;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
	/** Supports system prompts */
	supportsSystemPrompt: boolean;
	/** Supports streaming responses */
	supportsStreaming: boolean;
	/** Supports multimodal input */
	supportsMultimodal: boolean;
	/** Maximum context window (tokens) */
	maxContextWindow: number;
	/** Available models */
	models: string[];
}

/**
 * LLM Provider interface
 * All providers must implement this interface
 */
export interface LLMProvider {
	/** Provider name */
	name: string;

	/** Provider capabilities */
	capabilities: ProviderCapabilities;

	/**
	 * Generate completion
	 * @param request LLM request
	 * @returns Result containing LLM response
	 */
	complete(request: LLMRequest): Promise<Result<LLMResponse>>;

	/**
	 * Count tokens in text
	 * @param text Text to count
	 * @param model Model to use for counting
	 * @returns Result containing token count
	 */
	countTokens(text: string, model: string): Promise<Result<number>>;

	/**
	 * Get rate limit info
	 * @returns Result containing rate limit information
	 */
	getRateLimitInfo(): Promise<Result<RateLimitInfo | null>>;

	/**
	 * Validate API key
	 * @returns Result indicating if API key is valid
	 */
	validateApiKey(): Promise<Result<boolean>>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
	/** API key */
	apiKey: string;
	/** API endpoint (for custom endpoints) */
	endpoint?: string;
	/** Default model */
	defaultModel?: string;
	/** Request timeout (ms) */
	timeout?: number;
	/** Max retries */
	maxRetries?: number;
	/** Organization ID (for some providers) */
	organizationId?: string;
}

/**
 * LLM error types
 */
export enum LLMErrorType {
	/** Invalid API key */
	INVALID_API_KEY = 'INVALID_API_KEY',
	/** Rate limit exceeded */
	RATE_LIMIT = 'RATE_LIMIT',
	/** Context length exceeded */
	CONTEXT_LENGTH = 'CONTEXT_LENGTH',
	/** Invalid request */
	INVALID_REQUEST = 'INVALID_REQUEST',
	/** Network error */
	NETWORK_ERROR = 'NETWORK_ERROR',
	/** Service unavailable */
	SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
	/** Unknown error */
	UNKNOWN = 'UNKNOWN',
}

/**
 * LLM error class
 */
export class LLMError extends Error {
	public readonly type: LLMErrorType;
	public readonly statusCode?: number;
	public readonly retryable: boolean;
	public readonly metadata?: Record<string, unknown>;

	constructor(
		message: string,
		type: LLMErrorType,
		options?: {
			statusCode?: number;
			retryable?: boolean;
			metadata?: Record<string, unknown>;
		}
	) {
		super(message);
		this.name = 'LLMError';
		this.type = type;
		this.statusCode = options?.statusCode;
		this.retryable = options?.retryable ?? this.isRetryableType(type);
		this.metadata = options?.metadata;
	}

	private isRetryableType(type: LLMErrorType): boolean {
		return [
			LLMErrorType.RATE_LIMIT,
			LLMErrorType.NETWORK_ERROR,
			LLMErrorType.SERVICE_UNAVAILABLE,
		].includes(type);
	}
}

/**
 * Retry configuration
 */
export interface RetryConfig {
	/** Maximum retry attempts */
	maxRetries: number;
	/** Initial retry delay (ms) */
	initialDelay: number;
	/** Maximum retry delay (ms) */
	maxDelay: number;
	/** Backoff multiplier */
	backoffMultiplier: number;
	/** Jitter (0-1) */
	jitter: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	initialDelay: 1000,
	maxDelay: 60000,
	backoffMultiplier: 2,
	jitter: 0.1,
};

/**
 * Calculate retry delay with exponential backoff
 * @param attempt Attempt number (0-indexed)
 * @param config Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
	attempt: number,
	config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
	const exponentialDelay =
		config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
	const delay = Math.min(exponentialDelay, config.maxDelay);

	// Add jitter to prevent thundering herd
	const jitterAmount = delay * config.jitter;
	const jitter = Math.random() * jitterAmount * 2 - jitterAmount;

	return Math.max(0, delay + jitter);
}

/**
 * Execute with retry logic
 * @param fn Function to execute
 * @param config Retry configuration
 * @returns Result from function
 */
export async function executeWithRetry<T>(
	fn: () => Promise<Result<T>>,
	config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Result<T>> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
		try {
			const result = await fn();

			// If successful, return immediately
			if (result.success) {
				return result;
			}

			// Check if error is retryable
			if (result.error instanceof LLMError && !result.error.retryable) {
				return result;
			}

			lastError = result.error;

			// If not last attempt, wait before retrying
			if (attempt < config.maxRetries) {
				const delay = calculateRetryDelay(attempt, config);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		} catch (error) {
			lastError =
				error instanceof Error ? error : new Error(
					`Non-Error thrown: ${typeof error === 'object' ? JSON.stringify(error) : String(error)}`
				);

			// If not last attempt, wait before retrying
			if (attempt < config.maxRetries) {
				const delay = calculateRetryDelay(attempt, config);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	return {
		success: false,
		error: lastError || new Error('Maximum retries exceeded'),
	};
}
