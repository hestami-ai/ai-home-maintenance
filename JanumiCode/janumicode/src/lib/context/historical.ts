/**
 * Historical Context Retrieval
 * Implements Phase 5.4: Relevance-based historical context retrieval
 * Retrieves relevant past context for role invocations
 */

import type {
	Result,
	Claim,
	Verdict,
	HumanDecision,
	DialogueEvent,
} from '../types';
import { getDatabase } from '../database/init';
import { countTokens } from '../llm/tokenCounter';
import { isEmbeddingAvailable, searchSimilar } from '../embedding/service';
import type { SearchResult } from '../embedding/service';

/**
 * Historical context query options
 */
export interface HistoricalQueryOptions {
	/**
	 * Maximum number of items to retrieve
	 */
	limit?: number;

	/**
	 * Time window in days (0 = no limit)
	 */
	timeWindowDays?: number;

	/**
	 * Include only items from current dialogue
	 */
	currentDialogueOnly?: boolean;

	/**
	 * Similarity threshold (0-1, higher = more similar required)
	 */
	similarityThreshold?: number;

	/**
	 * Token budget for historical context
	 */
	tokenBudget?: number;
}

/**
 * Historical context item
 */
export interface HistoricalItem<T> {
	item: T;
	relevanceScore: number;
	timestamp: string;
	dialogueId: string;
}

/**
 * Historical context result
 */
export interface HistoricalContext {
	claims: HistoricalItem<Claim>[];
	verdicts: HistoricalItem<Verdict>[];
	decisions: HistoricalItem<HumanDecision>[];
	turns: HistoricalItem<DialogueEvent>[];
	tokenCount: number;
}

/**
 * Default historical query options
 */
const DEFAULT_OPTIONS: HistoricalQueryOptions = {
	limit: 10,
	timeWindowDays: 0, // No limit
	currentDialogueOnly: false,
	similarityThreshold: 0.5,
	tokenBudget: 1000,
};

/**
 * Retrieve relevant historical claims
 * @param query Query text to match against
 * @param options Query options
 * @returns Result containing historical claims
 */
export function retrieveRelevantClaims(
	query: string,
	options: HistoricalQueryOptions = {}
): Result<HistoricalItem<Claim>[]> {
	try {
		const opts = { ...DEFAULT_OPTIONS, ...options };
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Build time window constraint
		const timeConstraint = opts.timeWindowDays
			? `AND datetime(c.created_at) >= datetime('now', '-${opts.timeWindowDays} days')`
			: '';

		// Retrieve claims
		const claims = db
			.prepare(
				`
				SELECT c.claim_id, c.statement, c.introduced_by, c.criticality,
				       c.status, c.dialogue_id, c.turn_id, c.created_at
				FROM claims c
				WHERE 1=1
				${timeConstraint}
				ORDER BY c.created_at DESC
				LIMIT ?
			`
			)
			.all(opts.limit || 10) as Claim[];

		// Calculate relevance scores
		const scoredClaims = claims.map((claim) => ({
			item: claim,
			relevanceScore: calculateTextSimilarity(query, claim.statement),
			timestamp: claim.created_at,
			dialogueId: claim.dialogue_id,
		}));

		// Filter by similarity threshold
		const filtered = scoredClaims.filter(
			(item) => item.relevanceScore >= (opts.similarityThreshold || 0)
		);

		// Sort by relevance score (descending)
		filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);

		// Apply token budget if specified
		if (opts.tokenBudget) {
			return { success: true, value: fitWithinBudget(filtered, opts.tokenBudget, (c) => c.statement) };
		}

		return { success: true, value: filtered };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve relevant claims'),
		};
	}
}

/**
 * Retrieve relevant historical verdicts
 * @param claimIds Claim IDs to retrieve verdicts for
 * @param options Query options
 * @returns Result containing historical verdicts
 */
export function retrieveRelevantVerdicts(
	claimIds: string[],
	options: HistoricalQueryOptions = {}
): Result<HistoricalItem<Verdict>[]> {
	try {
		if (claimIds.length === 0) {
			return { success: true, value: [] };
		}

		const opts = { ...DEFAULT_OPTIONS, ...options };
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const placeholders = claimIds.map(() => '?').join(',');

		const verdicts = db
			.prepare(
				`
				SELECT v.verdict_id, v.claim_id, v.verdict, v.constraints_ref,
				       v.evidence_ref, v.rationale, v.timestamp
				FROM verdicts v
				WHERE v.claim_id IN (${placeholders})
				ORDER BY v.timestamp DESC
				LIMIT ?
			`
			)
			.all(...claimIds, opts.limit || 10) as Verdict[];

		const scoredVerdicts = verdicts.map((verdict) => ({
			item: verdict,
			relevanceScore: 1.0, // Direct relationship via claim ID
			timestamp: verdict.timestamp,
			dialogueId: '', // Verdicts don't have direct dialogue reference
		}));

		return { success: true, value: scoredVerdicts };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve relevant verdicts'),
		};
	}
}

/**
 * Retrieve relevant historical decisions
 * @param query Query text to match against
 * @param options Query options
 * @returns Result containing historical decisions
 */
export function retrieveRelevantDecisions(
	query: string,
	options: HistoricalQueryOptions = {}
): Result<HistoricalItem<HumanDecision>[]> {
	try {
		const opts = { ...DEFAULT_OPTIONS, ...options };
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const timeConstraint = opts.timeWindowDays
			? `AND datetime(hd.timestamp) >= datetime('now', '-${opts.timeWindowDays} days')`
			: '';

		const decisions = db
			.prepare(
				`
				SELECT hd.decision_id, hd.gate_id, hd.action,
				       hd.rationale, hd.attachments_ref, hd.timestamp,
				       g.dialogue_id
				FROM human_decisions hd
				JOIN gates g ON hd.gate_id = g.gate_id
				WHERE 1=1
				${timeConstraint}
				ORDER BY hd.timestamp DESC
				LIMIT ?
			`
			)
			.all(opts.limit || 10) as (HumanDecision & { dialogue_id: string })[];

		const scoredDecisions = decisions.map((decision) => ({
			item: {
				decision_id: decision.decision_id,
				gate_id: decision.gate_id,
				action: decision.action,
				rationale: decision.rationale,
				attachments_ref: decision.attachments_ref,
				timestamp: decision.timestamp,
			} as HumanDecision,
			relevanceScore: calculateTextSimilarity(query, decision.rationale),
			timestamp: decision.timestamp,
			dialogueId: decision.dialogue_id,
		}));

		const filtered = scoredDecisions.filter(
			(item) => item.relevanceScore >= (opts.similarityThreshold || 0)
		);

		filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);

		return { success: true, value: filtered };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve relevant decisions'),
		};
	}
}

/**
 * Retrieve dialogue turns by temporal window
 * @param dialogueId Dialogue ID
 * @param options Query options
 * @returns Result containing dialogue turns
 */
export function retrieveTurnsByTimeWindow(
	dialogueId: string,
	options: HistoricalQueryOptions = {}
): Result<HistoricalItem<DialogueEvent>[]> {
	try {
		const opts = { ...DEFAULT_OPTIONS, ...options };
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const timeConstraint = opts.timeWindowDays
			? `AND datetime(dt.timestamp) >= datetime('now', '-${opts.timeWindowDays} days')`
			: '';

		const dialogueConstraint = opts.currentDialogueOnly
			? `AND dt.dialogue_id = '${dialogueId}'`
			: '';

		const turns = db
			.prepare(
				`
				SELECT dt.event_id, dt.dialogue_id, dt.role, dt.phase,
				       dt.speech_act, dt.summary, dt.content, dt.timestamp
				FROM dialogue_events dt
				WHERE 1=1
				${timeConstraint}
				${dialogueConstraint}
				ORDER BY dt.timestamp DESC
				LIMIT ?
			`
			)
			.all(opts.limit || 10) as Array<{
			event_id: number; dialogue_id: string; role: string; phase: string;
			speech_act: string; summary: string; content: string | null; timestamp: string;
		}>;

		const scoredTurns = turns.map((turn) => ({
			item: {
				event_id: turn.event_id,
				dialogue_id: turn.dialogue_id,
				event_type: 'legacy',
				role: turn.role,
				phase: turn.phase,
				speech_act: turn.speech_act,
				summary: turn.summary,
				content: turn.content,
				detail: null,
				timestamp: turn.timestamp,
			} as DialogueEvent,
			relevanceScore: 1.0, // Temporal relevance
			timestamp: turn.timestamp,
			dialogueId: turn.dialogue_id,
		}));

		return { success: true, value: scoredTurns };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve turns by time window'),
		};
	}
}

/**
 * Search for contradictions in historical context
 * @param claim Claim to check for contradictions
 * @param options Query options
 * @returns Result containing potential contradictions
 */
export function searchForContradictions(
	claim: Claim,
	options: HistoricalQueryOptions = {}
): Result<HistoricalItem<Claim>[]> {
	try {
		// Retrieve all historical claims
		const historicalResult = retrieveRelevantClaims(claim.statement, {
			...options,
			currentDialogueOnly: false, // Search across all dialogues
		});

		if (!historicalResult.success) {
			return historicalResult;
		}

		// Filter for potential contradictions
		// This is a simple implementation - could be enhanced with NLP
		const contradictions = historicalResult.value.filter((item) => {
			// Check if claim is DISPROVED and similar
			return (
				item.item.status === 'DISPROVED' &&
				item.relevanceScore > 0.7 // High similarity
			);
		});

		return { success: true, value: contradictions };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to search for contradictions'),
		};
	}
}

/**
 * Search for precedents in historical decisions
 * @param query Query text
 * @param options Query options
 * @returns Result containing precedents
 */
export function searchForPrecedents(
	query: string,
	options: HistoricalQueryOptions = {}
): Result<HistoricalItem<HumanDecision>[]> {
	try {
		// Retrieve relevant decisions
		const decisionsResult = retrieveRelevantDecisions(query, {
			...options,
			currentDialogueOnly: false, // Search across all dialogues
		});

		if (!decisionsResult.success) {
			return decisionsResult;
		}

		// Filter for high-relevance decisions (precedents)
		const precedents = decisionsResult.value.filter(
			(item) => item.relevanceScore > 0.6
		);

		return { success: true, value: precedents };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to search for precedents'),
		};
	}
}

/**
 * Calculate text similarity using simple word overlap (Jaccard).
 * Used as fallback when vector embeddings are not available.
 * For semantic search, use searchSemanticSimilar() instead.
 * @param text1 First text
 * @param text2 Second text
 * @returns Similarity score (0-1)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
	// Normalize texts
	const normalize = (text: string) =>
		text.toLowerCase().replace(/[^a-z0-9\s]/g, '');

	const words1 = new Set(normalize(text1).split(/\s+/));
	const words2 = new Set(normalize(text2).split(/\s+/));

	// Calculate Jaccard similarity
	const intersection = new Set([...words1].filter((x) => words2.has(x)));
	const union = new Set([...words1, ...words2]);

	if (union.size === 0) {return 0;}

	return intersection.size / union.size;
}

/**
 * Fit items within token budget
 * @param items Items to fit
 * @param budget Token budget
 * @param textExtractor Function to extract text from item
 * @returns Items within budget
 */
function fitWithinBudget<T>(
	items: HistoricalItem<T>[],
	budget: number,
	textExtractor: (item: T) => string
): HistoricalItem<T>[] {
	const selected: HistoricalItem<T>[] = [];
	let usedTokens = 0;

	for (const item of items) {
		const text = textExtractor(item.item);
		const tokens = countTokens(text);

		if (usedTokens + tokens <= budget) {
			selected.push(item);
			usedTokens += tokens;
		} else {
			break; // Budget exceeded
		}
	}

	return selected;
}

/**
 * Retrieve comprehensive historical context
 * @param query Query text
 * @param claimIds Related claim IDs
 * @param dialogueId Current dialogue ID
 * @param options Query options
 * @returns Result containing historical context
 */
export function retrieveHistoricalContext(
	query: string,
	claimIds: string[],
	dialogueId: string,
	options: HistoricalQueryOptions = {}
): Result<HistoricalContext> {
	try {
		const opts = { ...DEFAULT_OPTIONS, ...options };

		// Allocate token budget across components
		const budgetPerComponent = Math.floor((opts.tokenBudget || 1000) / 4);

		// Retrieve claims
		const claimsResult = retrieveRelevantClaims(query, {
			...opts,
			tokenBudget: budgetPerComponent,
		});
		if (!claimsResult.success) {
			return claimsResult;
		}

		// Retrieve verdicts
		const verdictsResult = retrieveRelevantVerdicts(claimIds, {
			...opts,
			tokenBudget: budgetPerComponent,
		});
		if (!verdictsResult.success) {
			return verdictsResult;
		}

		// Retrieve decisions
		const decisionsResult = retrieveRelevantDecisions(query, {
			...opts,
			tokenBudget: budgetPerComponent,
		});
		if (!decisionsResult.success) {
			return decisionsResult;
		}

		// Retrieve turns
		const turnsResult = retrieveTurnsByTimeWindow(dialogueId, {
			...opts,
			tokenBudget: budgetPerComponent,
		});
		if (!turnsResult.success) {
			return turnsResult;
		}

		// Calculate total token count
		const totalTokens =
			claimsResult.value.reduce(
				(sum, item) => sum + countTokens(item.item.statement),
				0
			) +
			verdictsResult.value.reduce(
				(sum, item) => sum + countTokens(item.item.rationale),
				0
			) +
			decisionsResult.value.reduce(
				(sum, item) => sum + countTokens(item.item.rationale),
				0
			) +
			turnsResult.value.length * 50; // Rough estimate for turns

		return {
			success: true,
			value: {
				claims: claimsResult.value,
				verdicts: verdictsResult.value,
				decisions: decisionsResult.value,
				turns: turnsResult.value,
				tokenCount: totalTokens,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve historical context'),
		};
	}
}

// ==================== SEMANTIC SEARCH ====================

/**
 * Search for semantically similar content using vector embeddings.
 * Returns empty array if embeddings are not available (graceful degradation).
 *
 * @param queryText Text to search for
 * @param sourceTypes Source types to search across
 * @param excludeDialogueId Exclude results from this dialogue (for cross-dialogue search)
 * @param limit Max results
 * @returns Array of search results with similarity scores
 */
export async function searchSemanticSimilar(
	queryText: string,
	sourceTypes?: SearchResult['sourceType'][],
	excludeDialogueId?: string,
	limit?: number
): Promise<SearchResult[]> {
	if (!isEmbeddingAvailable()) {
		return [];
	}

	const result = await searchSimilar(queryText, {
		sourceTypes,
		excludeDialogueId,
		limit: limit ?? 10,
		minScore: 0.3,
	});

	return result.success ? result.value : [];
}
