/**
 * LLMProviderAdapter
 * Wraps an existing LLMProviderInterface (API-based provider) to conform
 * to the RoleCLIProvider interface. Used as a fallback when no CLI tool
 * is configured for a role.
 *
 * See: docs/Multi-CLI Integration Spec.md — Section 3 (LLMProviderAdapter)
 */

import type { Result } from '../types';
import type { LLMProvider as LLMProviderInterface } from '../llm/provider';
import { MessageRole } from '../llm/provider';
import type { RoleCLIProvider } from './roleCLIProvider';
import type {
	CLIProviderInfo,
	RoleCLIInvocationOptions,
	RoleCLIResult,
	CLIActivityEvent,
} from './types';
import { splitStdinContent } from './types';

/**
 * Adapter that wraps an LLMProviderInterface to conform to RoleCLIProvider.
 * The role invocation functions work identically — they receive the same
 * context pack and return the same structured types. The only difference
 * is that the work happens via API call instead of CLI process spawn.
 */
export class LLMProviderAdapter implements RoleCLIProvider {
	readonly id: string;
	readonly name: string;

	constructor(
		private readonly provider: LLMProviderInterface,
		providerName: string
	) {
		this.id = `api-${providerName.toLowerCase()}`;
		this.name = `${providerName} (API)`;
	}

	async detect(): Promise<Result<CLIProviderInfo>> {
		try {
			const valid = await this.provider.validateApiKey();
			return {
				success: true,
				value: {
					id: this.id,
					name: this.name,
					available: valid.success && valid.value,
					requiresApiKey: true,
					apiKeyConfigured: valid.success && valid.value,
				},
			};
		} catch (_error) {
			return {
				success: true,
				value: {
					id: this.id,
					name: this.name,
					available: false,
					requiresApiKey: true,
					apiKeyConfigured: false,
				},
			};
		}
	}

	async invoke(options: RoleCLIInvocationOptions): Promise<Result<RoleCLIResult>> {
		const startTime = Date.now();

		try {
			const [systemPrompt, userContent] = splitStdinContent(options.stdinContent);

			const messages = [];
			if (systemPrompt) {
				messages.push({ role: MessageRole.SYSTEM, content: systemPrompt });
			}
			messages.push({ role: MessageRole.USER, content: userContent });

			const llmResult = await this.provider.complete({
				messages,
				model: options.model ?? 'default',
				maxTokens: 4000,
			});

			if (!llmResult.success) {
				return llmResult as Result<RoleCLIResult>;
			}

			const executionTime = Date.now() - startTime;

			return {
				success: true,
				value: {
					response: llmResult.value.content,
					exitCode: 0,
					executionTime,
					tokenUsage: {
						inputTokens: llmResult.value.usage.inputTokens,
						outputTokens: llmResult.value.usage.outputTokens,
						totalTokens: llmResult.value.usage.totalTokens,
					},
					rawOutput: llmResult.value.content,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error : new Error('LLM API call failed'),
			};
		}
	}

	async invokeStreaming(
		options: RoleCLIInvocationOptions,
		onEvent: (event: CLIActivityEvent) => void
	): Promise<Result<RoleCLIResult>> {
		// API providers don't support granular streaming events.
		// Emit init, then invoke, then complete.
		onEvent({
			timestamp: new Date().toISOString(),
			eventType: 'init',
			summary: `${this.name} processing...`,
		});

		const result = await this.invoke(options);

		if (result.success) {
			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'complete',
				summary: 'Response received',
				detail: result.value.response.substring(0, 200),
				status: 'success',
			});
		} else {
			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'error',
				summary: result.error.message,
				status: 'error',
			});
		}

		return result;
	}

	getCommandPreview(_options: RoleCLIInvocationOptions): Result<string> {
		return {
			success: true,
			value: `[API fallback: ${this.name}] (no CLI command)`,
		};
	}
}
