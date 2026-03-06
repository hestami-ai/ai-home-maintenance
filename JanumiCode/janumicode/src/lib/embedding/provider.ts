/**
 * Embedding Provider Abstraction Layer
 * Provides unified interface for embedding providers (Voyage API, local ONNX, etc.)
 * Mirrors the pattern from src/lib/llm/provider.ts
 */

import type { Result } from '../types';

/**
 * Embedding input type — determines prefix/weighting strategy
 */
export type EmbedInputType = 'query' | 'document';

/**
 * Options for embedding requests
 */
export interface EmbedOptions {
	/** Whether input is a query or document (affects prefixing) */
	inputType?: EmbedInputType;
	/** Output dimensions (Matryoshka truncation) */
	dimensions?: number;
}

/**
 * Single embedding result
 */
export interface EmbeddingResult {
	/** The embedding vector */
	embedding: Float32Array;
	/** Number of tokens consumed by this input */
	tokenCount: number;
	/** Whether the input was truncated to fit model context */
	truncated: boolean;
}

/**
 * Embedding Provider interface
 * All embedding providers must implement this interface
 */
export interface EmbeddingProvider {
	/** Provider name (e.g. 'voyage-api', 'voyage-local') */
	name: string;

	/** Output embedding dimensions */
	dimensions: number;

	/**
	 * Embed one or more texts
	 * @param texts Array of texts to embed
	 * @param options Embedding options
	 * @returns Result containing array of embedding results
	 */
	embed(texts: string[], options?: EmbedOptions): Promise<Result<EmbeddingResult[]>>;

	/**
	 * Validate that the provider is properly configured and reachable
	 * @returns Result indicating if connection is valid
	 */
	validateConnection(): Promise<Result<boolean>>;
}
