/**
 * Token Counting Utilities
 * Implements Phase 4.1: Token counting for budget management
 * Provides approximations for Claude and OpenAI models
 */

import type { Result } from '../types';
import type { Message } from './provider';

/**
 * Token counting method
 */
export enum TokenCountMethod {
	/** Character-based approximation (fast, less accurate) */
	CHARACTER_APPROXIMATION = 'CHARACTER_APPROXIMATION',
	/** Word-based approximation (medium accuracy) */
	WORD_APPROXIMATION = 'WORD_APPROXIMATION',
	/** Provider-specific (when available) */
	PROVIDER_SPECIFIC = 'PROVIDER_SPECIFIC',
}

/**
 * Approximate token count from text using character-based method
 * Claude: ~4 characters per token
 * OpenAI: ~4 characters per token
 * @param text Text to count
 * @returns Approximate token count
 */
export function approximateTokensByChars(text: string): number {
	// Remove extra whitespace
	const normalized = text.trim().replaceAll(/\s+/g, ' ');
	// ~4 characters per token is a reasonable approximation
	return Math.ceil(normalized.length / 4);
}

/**
 * Approximate token count from text using word-based method
 * @param text Text to count
 * @returns Approximate token count
 */
export function approximateTokensByWords(text: string): number {
	// Empty/whitespace input has zero tokens. (`split(/\s+/)` returns ['']
	// for an empty string, so we have to special-case.)
	const trimmed = text.trim();
	if (trimmed.length === 0) { return 0; }
	const words = trimmed.split(/\s+/);
	// Most words are 1-2 tokens, average ~1.3 tokens per word
	return Math.ceil(words.length * 1.3);
}

/**
 * Count tokens in text
 * @param text Text to count
 * @param method Counting method (default: CHARACTER_APPROXIMATION)
 * @returns Token count
 */
export function countTokens(
	text: string,
	method: TokenCountMethod = TokenCountMethod.CHARACTER_APPROXIMATION
): number {
	switch (method) {
		case TokenCountMethod.WORD_APPROXIMATION:
			return approximateTokensByWords(text);
		case TokenCountMethod.CHARACTER_APPROXIMATION:
		default:
			return approximateTokensByChars(text);
	}
}

/**
 * Count tokens in messages
 * @param messages Messages to count
 * @param method Counting method
 * @returns Token count including message overhead
 */
export function countMessageTokens(
	messages: Message[],
	method: TokenCountMethod = TokenCountMethod.CHARACTER_APPROXIMATION
): number {
	let total = 0;

	for (const message of messages) {
		// Role overhead (~3 tokens per message for role + formatting)
		total += 3;

		// Content tokens
		if (typeof message.content === 'string') {
			total += countTokens(message.content, method);
		} else {
			// Multimodal content
			for (const part of message.content) {
				if (part.type === 'text' && part.text) {
					total += countTokens(part.text, method);
				} else if (part.type === 'image') {
					// Image tokens vary by size, estimate ~1000 tokens per image
					total += 1000;
				}
			}
		}
	}

	// Message wrapper overhead (~3 tokens)
	total += 3;

	return total;
}

/**
 * Count tokens with Result wrapper
 * @param text Text to count
 * @param method Counting method
 * @returns Result containing token count
 */
export function countTokensSafe(
	text: string,
	method: TokenCountMethod = TokenCountMethod.CHARACTER_APPROXIMATION
): Result<number> {
	try {
		const count = countTokens(text, method);
		return { success: true, value: count };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to count tokens'),
		};
	}
}

/**
 * Estimate cost based on token usage
 * Prices as of 2024 (approximate)
 */
export interface TokenPricing {
	/** Input tokens per million */
	inputPerMillion: number;
	/** Output tokens per million */
	outputPerMillion: number;
}

/**
 * Model pricing database
 */
export const MODEL_PRICING: Record<string, TokenPricing> = {
	// Claude models
	'claude-opus-4': {
		inputPerMillion: 15,
		outputPerMillion: 75,
	},
	'claude-sonnet-4': {
		inputPerMillion: 3,
		outputPerMillion: 15,
	},
	'claude-haiku-4': {
		inputPerMillion: 0.8,
		outputPerMillion: 4,
	},
	// OpenAI models
	'gpt-4': {
		inputPerMillion: 30,
		outputPerMillion: 60,
	},
	'gpt-4-turbo': {
		inputPerMillion: 10,
		outputPerMillion: 30,
	},
	'gpt-3.5-turbo': {
		inputPerMillion: 0.5,
		outputPerMillion: 1.5,
	},
};

/**
 * Estimate cost for token usage
 * @param inputTokens Input tokens
 * @param outputTokens Output tokens
 * @param model Model name
 * @returns Estimated cost in USD
 */
export function estimateCost(
	inputTokens: number,
	outputTokens: number,
	model: string
): number {
	const pricing = MODEL_PRICING[model];
	if (!pricing) {
		// Unknown model, return 0
		return 0;
	}

	const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
	const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

	return inputCost + outputCost;
}

/**
 * Truncate text to fit within token budget
 * @param text Text to truncate
 * @param maxTokens Maximum tokens
 * @param method Counting method
 * @returns Truncated text
 */
export function truncateToTokenBudget(
	text: string,
	maxTokens: number,
	method: TokenCountMethod = TokenCountMethod.CHARACTER_APPROXIMATION
): string {
	const currentTokens = countTokens(text, method);

	if (currentTokens <= maxTokens) {
		return text;
	}

	// Estimate characters per token
	const charsPerToken = text.length / currentTokens;
	const targetChars = Math.floor(maxTokens * charsPerToken);

	// Truncate and add ellipsis
	return text.substring(0, targetChars) + '...';
}

/**
 * Split text into chunks within token budget
 * @param text Text to split
 * @param maxTokensPerChunk Maximum tokens per chunk
 * @param method Counting method
 * @returns Array of text chunks
 */
export function splitIntoChunks(
	text: string,
	maxTokensPerChunk: number,
	method: TokenCountMethod = TokenCountMethod.CHARACTER_APPROXIMATION
): string[] {
	const lines = text.split('\n');
	const chunks: string[] = [];
	let currentChunk = '';

	for (const line of lines) {
		const testChunk =
			currentChunk === '' ? line : `${currentChunk}\n${line}`;
		const testTokens = countTokens(testChunk, method);

		if (testTokens <= maxTokensPerChunk) {
			currentChunk = testChunk;
		} else {
			// Current line would exceed budget
			if (currentChunk !== '') {
				chunks.push(currentChunk);
			}

			// Check if single line exceeds budget
			if (countTokens(line, method) > maxTokensPerChunk) {
				// Line is too long, truncate it
				chunks.push(truncateToTokenBudget(line, maxTokensPerChunk, method));
				currentChunk = '';
			} else {
				currentChunk = line;
			}
		}
	}

	// Add remaining chunk
	if (currentChunk !== '') {
		chunks.push(currentChunk);
	}

	return chunks;
}

/**
 * Get context window size for model
 * @param model Model name
 * @returns Context window size in tokens
 */
export function getContextWindow(model: string): number {
	// Claude models
	if (model.startsWith('claude-opus')) {return 200000;}
	if (model.startsWith('claude-sonnet')) {return 200000;}
	if (model.startsWith('claude-haiku')) {return 200000;}

	// OpenAI models
	if (model.startsWith('gpt-4-turbo')) {return 128000;}
	if (model.startsWith('gpt-4')) {return 8192;}
	if (model.startsWith('gpt-3.5-turbo')) {return 16385;}

	// Default
	return 8192;
}

/**
 * Check if text fits within model's context window
 * @param text Text to check
 * @param model Model name
 * @param method Counting method
 * @returns True if text fits
 */
export function fitsInContextWindow(
	text: string,
	model: string,
	method: TokenCountMethod = TokenCountMethod.CHARACTER_APPROXIMATION
): boolean {
	const tokens = countTokens(text, method);
	const contextWindow = getContextWindow(model);
	return tokens <= contextWindow;
}
