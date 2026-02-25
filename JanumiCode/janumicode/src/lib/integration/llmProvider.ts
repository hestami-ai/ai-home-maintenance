/**
 * LLM Provider Integration
 * Implements Phase 9.1.3: Integrate LLM providers with role agents
 * Provides unified interface for LLM invocation across providers
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { Result, RoleLLMConfig } from '../types';
import { CodedError, LLMProvider } from '../types';

/**
 * LLM request options
 */
export interface LLMRequestOptions {
	/** Provider type */
	provider: LLMProvider;
	/** API key */
	apiKey: string;
	/** Model name */
	model: string;
	/** System prompt */
	systemPrompt?: string;
	/** User prompt/content */
	userPrompt: string;
	/** Temperature (0-1) */
	temperature?: number;
	/** Max tokens */
	maxTokens?: number;
	/** Top P (nucleus sampling) */
	topP?: number;
}

/**
 * LLM response
 */
export interface LLMResponse {
	/** Generated content */
	content: string;
	/** Provider used */
	provider: string;
	/** Model used */
	model: string;
	/** Token usage */
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	/** Response metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Invoke LLM with unified interface
 * Handles provider-specific API calls
 *
 * @param options Request options
 * @returns Result with LLM response
 */
export async function invokeLLM(options: LLMRequestOptions): Promise<Result<LLMResponse>> {
	try {
		switch (options.provider) {
			case LLMProvider.CLAUDE:
				return await invokeAnthropic(options);
			case LLMProvider.OPENAI:
				return await invokeOpenAI(options);
			default:
				return {
					success: false,
					error: new CodedError(
						'UNSUPPORTED_PROVIDER',
						`Unsupported LLM provider: ${options.provider}`
					),
				};
		}
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'LLM_INVOCATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Invoke Anthropic Claude
 * Calls Anthropic API with unified interface
 *
 * @param options Request options
 * @returns Result with response
 */
async function invokeAnthropic(options: LLMRequestOptions): Promise<Result<LLMResponse>> {
	try {
		const client = new Anthropic({
			apiKey: options.apiKey,
		});

		const response = await client.messages.create({
			model: options.model,
			max_tokens: options.maxTokens || 4096,
			temperature: options.temperature || 0.7,
			system: options.systemPrompt,
			messages: [
				{
					role: 'user',
					content: options.userPrompt,
				},
			],
		});

		// Extract text content
		const textContent = response.content
			.filter((block: any) => block.type === 'text')
			.map((block: any) => block.text as string)
			.join('\n');

		return {
			success: true,
			value: {
				content: textContent,
				provider: 'anthropic',
				model: response.model,
				usage: {
					promptTokens: response.usage.input_tokens,
					completionTokens: response.usage.output_tokens,
					totalTokens: response.usage.input_tokens + response.usage.output_tokens,
				},
				metadata: {
					id: response.id,
					stopReason: response.stop_reason,
				},
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'ANTHROPIC_API_ERROR',
				error instanceof Error ? error.message : 'Unknown Anthropic error'
			),
		};
	}
}

/**
 * Invoke OpenAI
 * Calls OpenAI API with unified interface
 *
 * @param options Request options
 * @returns Result with response
 */
async function invokeOpenAI(options: LLMRequestOptions): Promise<Result<LLMResponse>> {
	try {
		const client = new OpenAI({
			apiKey: options.apiKey,
		});

		const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

		if (options.systemPrompt) {
			messages.push({
				role: 'system',
				content: options.systemPrompt,
			});
		}

		messages.push({
			role: 'user',
			content: options.userPrompt,
		});

		const response = await client.chat.completions.create({
			model: options.model,
			messages,
			max_tokens: options.maxTokens || 4096,
			temperature: options.temperature || 0.7,
			top_p: options.topP,
		});

		const content = response.choices[0]?.message?.content || '';

		return {
			success: true,
			value: {
				content,
				provider: 'openai',
				model: response.model,
				usage: {
					promptTokens: response.usage?.prompt_tokens || 0,
					completionTokens: response.usage?.completion_tokens || 0,
					totalTokens: response.usage?.total_tokens || 0,
				},
				metadata: {
					id: response.id,
					finishReason: response.choices[0]?.finish_reason,
				},
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'OPENAI_API_ERROR',
				error instanceof Error ? error.message : 'Unknown OpenAI error'
			),
		};
	}
}

/**
 * Invoke LLM with retry logic
 * Retries failed LLM calls with exponential backoff
 *
 * @param options Request options
 * @param maxRetries Maximum retry attempts
 * @param baseDelay Base delay in ms
 * @returns Result with response
 */
export async function invokeLLMWithRetry(
	options: LLMRequestOptions,
	maxRetries: number = 3,
	baseDelay: number = 1000
): Promise<Result<LLMResponse>> {
	let lastError: Result<LLMResponse> | null = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const result = await invokeLLM(options);

		if (result.success) {
			return result;
		}

		lastError = result;

		// Don't retry on final attempt
		if (attempt === maxRetries) {
			break;
		}

		// Exponential backoff
		const delay = baseDelay * Math.pow(2, attempt);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	return (
		lastError || {
			success: false,
			error: new CodedError(
				'LLM_RETRY_FAILED',
				'All retry attempts failed'
			),
		}
	);
}

/**
 * Invoke role-specific LLM
 * Uses role configuration to invoke appropriate LLM
 *
 * @param role Role name
 * @param config Role LLM configuration
 * @param systemPrompt System prompt
 * @param userPrompt User prompt
 * @param maxTokens Max tokens
 * @returns Result with response
 */
export async function invokeRoleLLM(
	role: 'executor' | 'technicalExpert' | 'verifier' | 'historianInterpreter',
	config: RoleLLMConfig,
	systemPrompt: string,
	userPrompt: string,
	maxTokens?: number
): Promise<Result<LLMResponse>> {
	try {
		const roleConfig = config[role];

		if (!roleConfig) {
			return {
				success: false,
				error: new CodedError(
					'ROLE_CONFIG_NOT_FOUND',
					`Configuration not found for role: ${role}`
				),
			};
		}

		const options: LLMRequestOptions = {
			provider: roleConfig.provider,
			apiKey: roleConfig.apiKey,
			model: roleConfig.model,
			systemPrompt,
			userPrompt,
			temperature: roleConfig.temperature,
			maxTokens: maxTokens || roleConfig.maxTokens,
		};

		// Use retry logic for role invocations
		return await invokeLLMWithRetry(options);
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'ROLE_LLM_INVOCATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Validate LLM configuration
 * Checks if configuration is valid
 *
 * @param config Role LLM configuration
 * @returns Validation result
 */
export function validateLLMConfig(
	config: RoleLLMConfig
): Result<{ valid: true; roles: string[] }> {
	try {
		const roles = ['executor', 'technicalExpert', 'verifier', 'historianInterpreter'] as const;
		const validRoles: string[] = [];
		const errors: string[] = [];

		for (const role of roles) {
			const roleConfig = config[role];

			if (!roleConfig) {
				errors.push(`Missing configuration for role: ${role}`);
				continue;
			}

			if (!roleConfig.apiKey || roleConfig.apiKey.trim().length === 0) {
				errors.push(`Missing API key for role: ${role}`);
				continue;
			}

			if (!roleConfig.model || roleConfig.model.trim().length === 0) {
				errors.push(`Missing model for role: ${role}`);
				continue;
			}

			if (![LLMProvider.OPENAI, LLMProvider.CLAUDE].includes(roleConfig.provider)) {
				errors.push(`Invalid provider for role ${role}: ${roleConfig.provider}`);
				continue;
			}

			validRoles.push(role);
		}

		if (errors.length > 0) {
			return {
				success: false,
				error: new CodedError(
					'INVALID_LLM_CONFIG',
					errors.join('; ')
				),
			};
		}

		return {
			success: true,
			value: {
				valid: true,
				roles: validRoles,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'LLM_CONFIG_VALIDATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Estimate token count (rough approximation)
 * Uses simple heuristic: ~4 characters per token
 *
 * @param text Text to estimate
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
	// Simple heuristic: average of 4 characters per token
	return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit token budget
 * Truncates text to approximately fit within token budget
 *
 * @param text Text to truncate
 * @param maxTokens Maximum tokens
 * @returns Truncated text
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
	const estimatedTokens = estimateTokenCount(text);

	if (estimatedTokens <= maxTokens) {
		return text;
	}

	// Truncate to approximate character count
	const maxChars = maxTokens * 4;
	return text.substring(0, maxChars) + '\n\n[...truncated]';
}
