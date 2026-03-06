/**
 * Embedding Module
 * Vector embedding infrastructure for semantic search across dialogue artifacts.
 */

export type { EmbeddingProvider, EmbeddingResult, EmbedOptions, EmbedInputType } from './provider';
export { createEmbeddingProvider, clearEmbeddingProviderCache } from './factory';
export {
	isEmbeddingAvailable,
	embedAndStore,
	searchSimilar,
	embedNarrativeArtifacts,
	rebuildIndex,
} from './service';
export type { EmbeddingSourceType, SearchOptions, SearchResult } from './service';
