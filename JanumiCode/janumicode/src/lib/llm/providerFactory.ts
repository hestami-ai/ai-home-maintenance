/**
 * LLM Provider Factory and Registry
 * Implements Phase 4.4: Provider registration system
 * Creates and manages LLM provider instances
 */

import type { Result, LLMProvider as LLMProviderEnum } from '../types';
import { getConfig } from '../config';
import type { LLMProvider, ProviderConfig } from './provider';
import { ClaudeProvider } from './providers/claude';
import { OpenAIProvider } from './providers/openai';
import { getLogger, isLoggerInitialized } from '../logging';

/**
 * Provider factory function type
 */
export type ProviderFactory = (config: ProviderConfig) => LLMProvider;

/**
 * Provider registry
 */
const providerRegistry = new Map<string, ProviderFactory>();

/**
 * Register a provider factory
 * @param name Provider name
 * @param factory Factory function
 */
export function registerProvider(
	name: string,
	factory: ProviderFactory
): void {
	providerRegistry.set(name.toLowerCase(), factory);
}

/**
 * Get provider factory by name
 * @param name Provider name
 * @returns Factory function or undefined
 */
export function getProviderFactory(
	name: string
): ProviderFactory | undefined {
	return providerRegistry.get(name.toLowerCase());
}

/**
 * Create provider instance
 * @param providerType Provider type enum
 * @param config Provider configuration
 * @returns Result containing provider instance
 */
export function createProvider(
	providerType: LLMProviderEnum,
	config: ProviderConfig
): Result<LLMProvider> {
	try {
		const providerName = providerType.toString();
		const factory = getProviderFactory(providerName);

		if (!factory) {
			return {
				success: false,
				error: new Error(`Unknown provider: ${providerName}`),
			};
		}

		const provider = factory(config);
		return { success: true, value: provider };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to create provider'),
		};
	}
}

/**
 * Create provider from role configuration
 * @param role Role name ('executor', 'technicalExpert', 'verifier', 'historianInterpreter')
 * @returns Result containing provider instance
 */
export async function createProviderForRole(
	role: string
): Promise<Result<LLMProvider>> {
	try {
		const config = await getConfig();
		const llmConfig = config.llmConfig[role as keyof typeof config.llmConfig];

		if (!llmConfig) {
			return {
				success: false,
				error: new Error(`No LLM configuration found for role: ${role}`),
			};
		}

		const providerConfig: ProviderConfig = {
			apiKey: llmConfig.apiKey,
			defaultModel: llmConfig.model,
		};

		if (isLoggerInitialized()) {
			getLogger().child({ component: 'llm' }).debug('Creating LLM provider', {
				role,
				provider: llmConfig.provider,
				model: llmConfig.model,
				hasKey: !!llmConfig.apiKey,
				keyLen: llmConfig.apiKey?.length ?? 0,
			});
		}

		return createProvider(llmConfig.provider, providerConfig);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to create provider for role'),
		};
	}
}

/**
 * Get all registered provider names
 * @returns Array of provider names
 */
export function getRegisteredProviders(): string[] {
	return Array.from(providerRegistry.keys());
}

/**
 * Check if provider is registered
 * @param name Provider name
 * @returns True if provider is registered
 */
export function isProviderRegistered(name: string): boolean {
	return providerRegistry.has(name.toLowerCase());
}

// Register built-in providers
registerProvider('CLAUDE', (config) => new ClaudeProvider(config));
registerProvider('OPENAI', (config) => new OpenAIProvider(config));
registerProvider('GEMINI', (config) => new OpenAIProvider({
	...config,
	endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
}));
