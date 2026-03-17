/**
 * Embedding Provider Factory and Registry
 * Mirrors the pattern from src/lib/llm/providerFactory.ts
 * Creates and manages embedding provider instances.
 */

import type { Result } from '../types';
import type { EmbeddingProvider } from './provider';
import { createVoyageAPIProvider } from './providers/voyageAPI';
import { createVoyageRPCClient } from './providers/voyageRPC';
import * as vscode from 'vscode';

/**
 * Async factory function type for embedding providers
 */
type EmbeddingProviderFactory = () => Promise<EmbeddingProvider | null>;

/**
 * Provider registry
 */
const registry = new Map<string, EmbeddingProviderFactory>();

/**
 * Cached provider instance (singleton per config)
 */
let cachedProvider: EmbeddingProvider | null = null;
let cachedProviderName: string | null = null;

/**
 * Register an embedding provider factory
 */
export function registerEmbeddingProvider(
	name: string,
	factory: EmbeddingProviderFactory
): void {
	registry.set(name.toLowerCase(), factory);
}

/**
 * Create an embedding provider based on current VS Code configuration.
 * Returns cached instance if config hasn't changed.
 */
export async function createEmbeddingProvider(): Promise<Result<EmbeddingProvider>> {
	const config = vscode.workspace.getConfiguration('janumicode');
	const enabled = config.get<boolean>('embedding.enabled', false);

	if (!enabled) {
		return {
			success: false,
			error: new Error('Embedding is disabled (janumicode.embedding.enabled = false)'),
		};
	}

	const providerName = config.get<string>('embedding.provider', 'voyage-api').toLowerCase();

	// Return cached if same provider
	if (cachedProvider && cachedProviderName === providerName) {
		return { success: true, value: cachedProvider };
	}

	const factory = registry.get(providerName);
	if (!factory) {
		return {
			success: false,
			error: new Error(`Unknown embedding provider: ${providerName}`),
		};
	}

	try {
		const provider = await factory();
		if (!provider) {
			return {
				success: false,
				error: new Error(`Embedding provider '${providerName}' not available (missing API key or config)`),
			};
		}

		cachedProvider = provider;
		cachedProviderName = providerName;
		return { success: true, value: provider };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to create embedding provider'),
		};
	}
}

/**
 * Clear the cached provider instance.
 * Call on config change to force re-creation.
 */
export function clearEmbeddingProviderCache(): void {
	cachedProvider = null;
	cachedProviderName = null;
}

/**
 * Shut down the cached embedding provider if it supports graceful shutdown.
 * Called during extension deactivation to clean up long-lived child processes
 * (e.g., VoyageRPCClient's ONNX inference process).
 */
export async function shutdownEmbeddingProvider(): Promise<void> {
	if (cachedProvider && 'shutdown' in cachedProvider
		&& typeof (cachedProvider as any).shutdown === 'function') {
		await (cachedProvider as any).shutdown();
	}
	cachedProvider = null;
	cachedProviderName = null;
}

// ==================== Register built-in providers ====================

registerEmbeddingProvider('voyage-api', () => {
	const config = vscode.workspace.getConfiguration('janumicode');
	const model = config.get<string>('embedding.model', 'voyage-4-lite');
	const dimensions = config.get<number>('embedding.dimensions', 1024);
	return createVoyageAPIProvider(model, dimensions);
});

registerEmbeddingProvider('voyage-local', () => {
	const config = vscode.workspace.getConfiguration('janumicode');
	const dimensions = config.get<number>('embedding.dimensions', 1024);
	return createVoyageRPCClient(dimensions);
});
