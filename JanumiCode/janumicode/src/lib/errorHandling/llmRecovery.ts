/**
 * LLM API Error Recovery
 * Implements Phase 9.4.2: Error recovery for LLM API failures
 * Provides retry logic and fallback strategies for LLM errors
 */

import type { Result, RoleLLMConfig } from '../types';
import { CodedError } from '../types';
import { handleError, ErrorSeverity, ErrorCategory } from './globalHandler';

/**
 * LLM error types
 */
export type LLMErrorType =
	| 'RATE_LIMIT'
	| 'TIMEOUT'
	| 'INVALID_API_KEY'
	| 'NETWORK_ERROR'
	| 'SERVICE_UNAVAILABLE'
	| 'CONTEXT_LENGTH_EXCEEDED'
	| 'INVALID_REQUEST'
	| 'UNKNOWN';

/**
 * Retry strategy
 */
export interface RetryStrategy {
	/** Maximum retry attempts */
	maxRetries: number;
	/** Base delay in milliseconds */
	baseDelay: number;
	/** Maximum delay in milliseconds */
	maxDelay: number;
	/** Exponential backoff multiplier */
	backoffMultiplier: number;
	/** Whether to use jitter */
	useJitter: boolean;
}

/**
 * Default retry strategy
 */
const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
	maxRetries: 3,
	baseDelay: 1000,
	maxDelay: 30000,
	backoffMultiplier: 2,
	useJitter: true,
};

/**
 * Classify LLM error
 *
 * @param error Error to classify
 * @returns Error type
 */
export function classifyLLMError(error: any): LLMErrorType {
	const message = error?.message?.toLowerCase() || '';
	const status = error?.status || error?.statusCode;

	if (status === 429 || message.includes('rate limit')) {
		return 'RATE_LIMIT';
	}
	if (status === 401 || message.includes('api key') || message.includes('unauthorized')) {
		return 'INVALID_API_KEY';
	}
	if (status === 503 || message.includes('service unavailable')) {
		return 'SERVICE_UNAVAILABLE';
	}
	if (message.includes('timeout') || message.includes('timed out')) {
		return 'TIMEOUT';
	}
	if (message.includes('context') || message.includes('tokens')) {
		return 'CONTEXT_LENGTH_EXCEEDED';
	}
	if (status === 400 || message.includes('invalid request')) {
		return 'INVALID_REQUEST';
	}
	if (message.includes('network') || message.includes('econnrefused')) {
		return 'NETWORK_ERROR';
	}

	return 'UNKNOWN';
}

/**
 * Check if error is retryable
 *
 * @param errorType Error type
 * @returns Whether error should be retried
 */
export function isRetryable(errorType: LLMErrorType): boolean {
	switch (errorType) {
		case 'RATE_LIMIT':
		case 'TIMEOUT':
		case 'NETWORK_ERROR':
		case 'SERVICE_UNAVAILABLE':
			return true;

		case 'INVALID_API_KEY':
		case 'CONTEXT_LENGTH_EXCEEDED':
		case 'INVALID_REQUEST':
		case 'UNKNOWN':
			return false;

		default:
			return false;
	}
}

/**
 * Calculate retry delay
 *
 * @param attempt Attempt number (0-based)
 * @param strategy Retry strategy
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(attempt: number, strategy: RetryStrategy): number {
	// Calculate exponential backoff
	let delay = strategy.baseDelay * Math.pow(strategy.backoffMultiplier, attempt);

	// Cap at maximum delay
	delay = Math.min(delay, strategy.maxDelay);

	// Add jitter if enabled
	if (strategy.useJitter) {
		const jitter = Math.random() * 0.3 * delay; // +/- 30%
		delay = delay + (Math.random() > 0.5 ? jitter : -jitter);
	}

	return Math.floor(delay);
}

/**
 * Retry LLM function with exponential backoff
 *
 * @param fn Function to retry
 * @param strategy Retry strategy
 * @returns Result
 */
export async function retryWithBackoff<T>(
	fn: () => Promise<Result<T>>,
	strategy: RetryStrategy = DEFAULT_RETRY_STRATEGY
): Promise<Result<T>> {
	let lastError: any = null;

	for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
		try {
			const result = await fn();

			if (result.success) {
				return result;
			}

			// Check if error is retryable
			const errorType = classifyLLMError(result.error);

			if (!isRetryable(errorType)) {
				// Not retryable, return immediately
				handleError(new Error(result.error.message), {
					severity: ErrorSeverity.ERROR,
					category: ErrorCategory.LLM_API,
					context: { errorType, attempt },
				});
				return result;
			}

			lastError = result.error;

			// Don't delay on last attempt
			if (attempt < strategy.maxRetries) {
				const delay = calculateRetryDelay(attempt, strategy);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		} catch (error) {
			lastError = error;

			// Check if error is retryable
			const errorType = classifyLLMError(error);

			if (!isRetryable(errorType)) {
				handleError(error, {
					severity: ErrorSeverity.ERROR,
					category: ErrorCategory.LLM_API,
					context: { errorType, attempt },
				});

				return {
					success: false,
					error: new CodedError(
						'LLM_API_ERROR',
						error instanceof Error ? error.message : 'Unknown error'
					),
				};
			}

			// Don't delay on last attempt
			if (attempt < strategy.maxRetries) {
				const delay = calculateRetryDelay(attempt, strategy);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	// All retries failed
	handleError(lastError, {
		severity: ErrorSeverity.ERROR,
		category: ErrorCategory.LLM_API,
		context: { maxRetriesExceeded: true },
	});

	return {
		success: false,
		error: new CodedError(
			'MAX_RETRIES_EXCEEDED',
			`LLM API call failed after ${strategy.maxRetries} retries`
		),
	};
}

/**
 * Get recovery suggestion for LLM error
 *
 * @param errorType Error type
 * @returns Recovery suggestions
 */
export function getLLMRecoverySuggestions(errorType: LLMErrorType): string[] {
	switch (errorType) {
		case 'RATE_LIMIT':
			return [
				'Wait a few minutes before retrying',
				'Check API rate limits in your provider dashboard',
				'Consider upgrading API tier if rate limits are frequently hit',
			];

		case 'TIMEOUT':
			return [
				'Check internet connection',
				'Retry the operation',
				'Consider reducing request size',
			];

		case 'INVALID_API_KEY':
			return [
				'Verify API key is correct',
				'Check API key has not expired',
				'Reconfigure API key in settings',
			];

		case 'NETWORK_ERROR':
			return [
				'Check internet connection',
				'Verify proxy settings',
				'Check firewall settings',
				'Retry after network is stable',
			];

		case 'SERVICE_UNAVAILABLE':
			return [
				'Wait a few minutes and retry',
				'Check provider status page',
				'Consider using fallback provider if available',
			];

		case 'CONTEXT_LENGTH_EXCEEDED':
			return [
				'Reduce context size',
				'Trim dialogue history',
				'Use a model with larger context window',
			];

		case 'INVALID_REQUEST':
			return [
				'Check request parameters',
				'Verify model name is correct',
				'Review API documentation',
			];

		default:
			return [
				'Check error logs',
				'Verify API configuration',
				'Contact support if problem persists',
			];
	}
}
