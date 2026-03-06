/**
 * Embedding Service
 * Core orchestration tying EmbeddingProvider + SQLite database together.
 * Handles: embed text → store in DB → KNN search via sqlite-vector.
 */

import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import type { Result } from '../types';
import type { EmbeddingProvider } from './provider';
import { createEmbeddingProvider } from './factory';
import { getDatabase, isSqliteVectorLoaded, initializeVectorIndex } from '../database/init';
import { getLogger, isLoggerInitialized } from '../logging';

// ==================== TYPES ====================

/**
 * Source types that can have embeddings
 */
export type EmbeddingSourceType =
	| 'narrative_memory'
	| 'decision_trace'
	| 'open_loop'
	| 'dialogue_turn'
	| 'claim'
	| 'verdict';

/**
 * Options for similarity search
 */
export interface SearchOptions {
	/** Filter by source types */
	sourceTypes?: EmbeddingSourceType[];
	/** Exclude results from this dialogue (for cross-dialogue search) */
	excludeDialogueId?: string;
	/** Max results to return (default: 10) */
	limit?: number;
	/** Minimum similarity score 0-1 (default: 0.3) */
	minScore?: number;
}

/**
 * A single search result with similarity score
 */
export interface SearchResult {
	embeddingId: string;
	sourceType: EmbeddingSourceType;
	sourceId: string;
	dialogueId: string;
	contentText: string;
	/** Cosine similarity score (0-1, higher = more similar) */
	score: number;
}

// ==================== STATE ====================

/** Track whether vector index has been initialized for current connection */
let vectorIndexInitialized = false;

// ==================== PUBLIC API ====================

/**
 * Check if embedding functionality is available.
 * Requires: enabled in config + sqlite-vector loaded + provider available.
 */
export function isEmbeddingAvailable(): boolean {
	const config = vscode.workspace.getConfiguration('janumicode');
	const enabled = config.get<boolean>('embedding.enabled', false);
	if (!enabled) {
		return false;
	}
	if (!isSqliteVectorLoaded()) {
		return false;
	}
	if (!getDatabase()) {
		return false;
	}
	return true;
}

/**
 * Embed text and store in the database.
 * Deduplicates by content hash — skips if identical content already embedded.
 */
export async function embedAndStore(
	sourceType: EmbeddingSourceType,
	sourceId: string,
	dialogueId: string,
	text: string
): Promise<Result<string>> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'embedding.service' })
		: undefined;

	if (!isEmbeddingAvailable()) {
		return { success: false, error: new Error('Embedding not available') };
	}

	const db = getDatabase()!;
	ensureVectorIndex(db);

	// Content hash for dedup
	const contentHash = createHash('sha256').update(text).digest('hex');

	// Check if already embedded
	const existing = db.prepare(
		'SELECT embedding_id FROM embeddings WHERE source_type = ? AND source_id = ? AND content_hash = ?'
	).get(sourceType, sourceId, contentHash) as { embedding_id: string } | undefined;

	if (existing) {
		logger?.debug('Embedding already exists (dedup)', { sourceType, sourceId });
		return { success: true, value: existing.embedding_id };
	}

	// Get provider and embed
	const providerResult = await createEmbeddingProvider();
	if (!providerResult.success) {
		return { success: false, error: providerResult.error };
	}

	const provider = providerResult.value;
	const embedResult = await provider.embed([text], { inputType: 'document' });

	if (!embedResult.success) {
		return { success: false, error: embedResult.error };
	}

	const embeddingResult = embedResult.value[0];
	const embeddingId = randomUUID();

	// Store in database
	try {
		const embeddingBuffer = Buffer.from(embeddingResult.embedding.buffer);

		db.prepare(`
			INSERT INTO embeddings (embedding_id, source_type, source_id, dialogue_id, content_text, content_hash, embedding, model, dimensions)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			embeddingId,
			sourceType,
			sourceId,
			dialogueId,
			text,
			contentHash,
			embeddingBuffer,
			provider.name,
			provider.dimensions
		);

		logger?.debug('Embedding stored', {
			embeddingId,
			sourceType,
			sourceId,
			dimensions: provider.dimensions,
		});

		return { success: true, value: embeddingId };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		logger?.error('Failed to store embedding', { error: msg });
		return {
			success: false,
			error: error instanceof Error ? error : new Error(msg),
		};
	}
}

/**
 * Search for similar content using vector KNN search.
 * Falls back gracefully if embeddings are unavailable.
 */
export async function searchSimilar(
	queryText: string,
	options?: SearchOptions
): Promise<Result<SearchResult[]>> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'embedding.service' })
		: undefined;

	if (!isEmbeddingAvailable()) {
		return { success: false, error: new Error('Embedding not available') };
	}

	const db = getDatabase()!;
	ensureVectorIndex(db);

	// Get provider and embed query
	const providerResult = await createEmbeddingProvider();
	if (!providerResult.success) {
		return { success: false, error: providerResult.error };
	}

	const provider = providerResult.value;
	const embedResult = await provider.embed([queryText], { inputType: 'query' });

	if (!embedResult.success) {
		return { success: false, error: embedResult.error };
	}

	const queryEmbedding = embedResult.value[0].embedding;
	const queryBuffer = Buffer.from(queryEmbedding.buffer);

	const limit = options?.limit ?? 10;
	const minScore = options?.minScore ?? 0.3;

	try {
		// Build WHERE clause for filters
		const conditions: string[] = [];
		const params: unknown[] = [];

		if (options?.sourceTypes && options.sourceTypes.length > 0) {
			const placeholders = options.sourceTypes.map(() => '?').join(', ');
			conditions.push(`e.source_type IN (${placeholders})`);
			params.push(...options.sourceTypes);
		}

		if (options?.excludeDialogueId) {
			conditions.push('e.dialogue_id != ?');
			params.push(options.excludeDialogueId);
		}

		const whereClause = conditions.length > 0
			? `WHERE ${conditions.join(' AND ')}`
			: '';

		// Use sqlite-vector KNN scan
		// vector_quantize_scan returns rows with _distance (cosine distance, 0 = identical)
		// Convert distance to similarity: score = 1 - distance
		const rows = db.prepare(`
			SELECT
				e.embedding_id,
				e.source_type,
				e.source_id,
				e.dialogue_id,
				e.content_text,
				vector_distance(e.embedding, ?) as distance
			FROM embeddings e
			${whereClause}
			ORDER BY distance ASC
			LIMIT ?
		`).all(queryBuffer, ...params, limit) as Array<{
			embedding_id: string;
			source_type: EmbeddingSourceType;
			source_id: string;
			dialogue_id: string;
			content_text: string;
			distance: number;
		}>;

		const results: SearchResult[] = rows
			.map((row) => ({
				embeddingId: row.embedding_id,
				sourceType: row.source_type,
				sourceId: row.source_id,
				dialogueId: row.dialogue_id,
				contentText: row.content_text,
				score: 1 - row.distance,
			}))
			.filter((r) => r.score >= minScore);

		logger?.debug('Semantic search complete', {
			queryLength: queryText.length,
			totalCandidates: rows.length,
			filteredResults: results.length,
		});

		return { success: true, value: results };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		logger?.error('Semantic search failed', { error: msg });
		return {
			success: false,
			error: error instanceof Error ? error : new Error(msg),
		};
	}
}

/**
 * Embed all narrative artifacts from a curation run.
 * Call after storeNarrativeArtifacts() succeeds.
 */
export async function embedNarrativeArtifacts(
	dialogueId: string
): Promise<void> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'embedding.service' })
		: undefined;

	if (!isEmbeddingAvailable()) {
		return;
	}

	const db = getDatabase()!;

	try {
		// Embed narrative memories
		const memories = db.prepare(
			'SELECT memory_id, goal, lessons FROM narrative_memories WHERE dialogue_id = ?'
		).all(dialogueId) as Array<{ memory_id: string; goal: string; lessons: string }>;

		for (const mem of memories) {
			const lessons: string[] = JSON.parse(mem.lessons);
			const text = `Goal: ${mem.goal}${lessons.length > 0 ? `\nLessons: ${lessons.join('; ')}` : ''}`;
			await embedAndStore('narrative_memory', mem.memory_id, dialogueId, text);
		}

		// Embed decision traces
		const traces = db.prepare(
			'SELECT trace_id, decision_points FROM decision_traces WHERE dialogue_id = ?'
		).all(dialogueId) as Array<{ trace_id: string; decision_points: string }>;

		for (const trace of traces) {
			const points = JSON.parse(trace.decision_points) as Array<{ selected_option: string; rationale: string }>;
			const text = points.map((p) => `${p.selected_option}: ${p.rationale}`).join('\n');
			if (text) {
				await embedAndStore('decision_trace', trace.trace_id, dialogueId, text);
			}
		}

		// Embed open loops
		const loops = db.prepare(
			'SELECT loop_id, description, category FROM open_loops WHERE dialogue_id = ?'
		).all(dialogueId) as Array<{ loop_id: string; description: string; category: string }>;

		for (const loop of loops) {
			await embedAndStore('open_loop', loop.loop_id, dialogueId, `[${loop.category}] ${loop.description}`);
		}

		logger?.debug('Narrative artifacts embedded', {
			dialogueId,
			memories: memories.length,
			traces: traces.length,
			loops: loops.length,
		});
	} catch (error) {
		logger?.warn('Failed to embed narrative artifacts', {
			dialogueId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Rebuild the vector index for faster search.
 * Call periodically or after bulk inserts.
 */
export function rebuildIndex(): void {
	if (!isEmbeddingAvailable()) {
		return;
	}

	const db = getDatabase()!;
	try {
		db.prepare("SELECT vector_quantize('embeddings', 'embedding')").get();
	} catch {
		// vector_quantize may not be available
	}
}

// ==================== INTERNAL ====================

function ensureVectorIndex(db: import('better-sqlite3').Database): void {
	if (vectorIndexInitialized) {
		return;
	}
	initializeVectorIndex(db);
	vectorIndexInitialized = true;
}
