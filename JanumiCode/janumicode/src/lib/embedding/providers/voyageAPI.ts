/**
 * Voyage AI Cloud Embedding Provider
 * Uses the Voyage Embeddings API (voyage-4-lite) for cloud-based embedding.
 * Shares embedding space with voyage-4-nano (local ONNX) — embeddings are interchangeable.
 */

import type { Result } from '../../types';
import type { EmbeddingProvider, EmbeddingResult, EmbedOptions } from '../provider';
import { getSecretKeyManager } from '../../config/secretKeyManager';
import { getLogger, isLoggerInitialized } from '../../logging';

const VOYAGE_API_ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
const MAX_BATCH_SIZE = 128;
const DEFAULT_MODEL = 'voyage-4-lite';
const DEFAULT_DIMENSIONS = 1024;

/**
 * Voyage AI Embeddings API response shape
 */
interface VoyageAPIResponse {
	data: Array<{
		embedding: number[];
		index: number;
	}>;
	usage: {
		total_tokens: number;
	};
	model: string;
}

/**
 * Resolve Voyage API key from env vars or SecretStorage
 */
async function resolveVoyageApiKey(): Promise<string | null> {
	// 1. Direct env var
	if (process.env.VOYAGE_API_KEY?.trim()) {
		return process.env.VOYAGE_API_KEY.trim();
	}

	// 2. SecretStorage via SecretKeyManager
	try {
		const skm = getSecretKeyManager();
		// Use the embedding role key
		const stored = await (skm as any)._secrets?.get('janumicode.apiKey.embedding');
		if (stored?.trim()) {
			return stored.trim();
		}
	} catch {
		// SecretStorage may not be initialized
	}

	return null;
}

export class VoyageAPIProvider implements EmbeddingProvider {
	readonly name = 'voyage-api';
	readonly dimensions: number;

	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model?: string, dimensions?: number) {
		this.apiKey = apiKey;
		this.model = model ?? DEFAULT_MODEL;
		this.dimensions = dimensions ?? DEFAULT_DIMENSIONS;
	}

	async embed(texts: string[], options?: EmbedOptions): Promise<Result<EmbeddingResult[]>> {
		const logger = isLoggerInitialized()
			? getLogger().child({ component: 'embedding.voyage-api' })
			: undefined;

		if (texts.length === 0) {
			return { success: true, value: [] };
		}

		try {
			const allResults: EmbeddingResult[] = [];

			// Process in batches
			for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
				const batch = texts.slice(i, i + MAX_BATCH_SIZE);
				const batchResult = await this.embedBatch(batch, options);

				if (!batchResult.success) {
					return batchResult;
				}

				allResults.push(...batchResult.value);
			}

			logger?.debug('Voyage API embedding complete', {
				inputCount: texts.length,
				dimensions: this.dimensions,
			});

			return { success: true, value: allResults };
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			logger?.error('Voyage API embedding failed', { error: msg });
			return {
				success: false,
				error: error instanceof Error ? error : new Error(msg),
			};
		}
	}

	async validateConnection(): Promise<Result<boolean>> {
		try {
			const result = await this.embed(['connection test'], { inputType: 'query' });
			return result.success
				? { success: true, value: true }
				: { success: false, error: result.error };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error : new Error('Connection validation failed'),
			};
		}
	}

	private async embedBatch(
		texts: string[],
		options?: EmbedOptions
	): Promise<Result<EmbeddingResult[]>> {
		const dims = options?.dimensions ?? this.dimensions;
		const body = {
			input: texts,
			model: this.model,
			input_type: options?.inputType ?? 'document',
			output_dimension: dims,
		};

		const response = await fetch(VOYAGE_API_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unknown error');
			return {
				success: false,
				error: new Error(`Voyage API error ${response.status}: ${errorText}`),
			};
		}

		const data = (await response.json()) as VoyageAPIResponse;
		const tokensPerInput = Math.ceil(data.usage.total_tokens / texts.length);

		// Sort by index to maintain input order
		const sorted = [...data.data].sort((a, b) => a.index - b.index);

		const results: EmbeddingResult[] = sorted.map((item) => ({
			embedding: new Float32Array(item.embedding),
			tokenCount: tokensPerInput,
			truncated: false,
		}));

		return { success: true, value: results };
	}
}

/**
 * Create a VoyageAPIProvider instance, resolving the API key automatically.
 * Returns null if no API key is available.
 */
export async function createVoyageAPIProvider(
	model?: string,
	dimensions?: number
): Promise<VoyageAPIProvider | null> {
	const apiKey = await resolveVoyageApiKey();
	if (!apiKey) {
		return null;
	}
	return new VoyageAPIProvider(apiKey, model, dimensions);
}
