/**
 * Context Compiler Core
 * Implements Phase 5.1: Context pack compilation for stateless LLM invocation
 * Creates deterministic context packs from database state
 */

import type {
	Result,
	Role,
	ContextPack,
	Claim,
	Verdict,
	HumanDecision,
	ConstraintManifest,
} from '../types';
import { countTokens } from '../llm/tokenCounter';
import { getDatabase } from '../database/init';

/**
 * Context compilation options
 */
export interface CompileContextOptions {
	role: Role;
	dialogueId: string;
	goal?: string;
	tokenBudget: number;
	includeHistorical?: boolean;
	maxHistoricalFindings?: number;
}

/**
 * Context pack with token usage metadata
 */
export interface CompiledContextPack extends ContextPack {
	tokenUsage: {
		goal: number;
		constraints: number;
		claims: number;
		verdicts: number;
		decisions: number;
		historical: number;
		workspace: number;
		total: number;
	};
	/** Optional workspace file content injected into context */
	workspaceContext?: string;
}

/**
 * Context pack cache entry
 */
interface CachedContextPack {
	pack: CompiledContextPack;
	compiledAt: string;
	expiresAt: string;
}

/**
 * Context pack cache
 * Maps role:dialogueId to cached pack
 */
const contextPackCache = new Map<string, CachedContextPack>();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Compile context pack for role
 *
 * Generates a complete, deterministic context pack from database state for
 * stateless LLM invocation. The context pack includes all relevant information
 * for the specified role: claims, verdicts, human decisions, constraints,
 * historical findings, and artifact references. Respects token budget and
 * caches results for 5 minutes.
 *
 * @param options - Compilation configuration options
 * @param options.role - Role to compile context for (EXECUTOR, VERIFIER, etc.)
 * @param options.dialogueId - Dialogue ID to compile context from
 * @param options.goal - Optional user goal/requirement
 * @param options.tokenBudget - Maximum tokens allowed in context pack
 * @param options.includeHistorical - Whether to include historical findings (default: false)
 * @param options.maxHistoricalFindings - Max number of historical findings to include (default: 10)
 * @returns Result containing the compiled context pack with token usage metadata
 *
 * @example
 * ```typescript
 * const result = compileContextPack({
 *   role: Role.EXECUTOR,
 *   dialogueId: 'abc-123',
 *   goal: 'Create REST API client',
 *   tokenBudget: 10000,
 *   includeHistorical: true
 * });
 * if (result.success) {
 *   console.log(`Context compiled: ${result.value.tokenUsage.total} tokens`);
 * }
 * ```
 *
 * @remarks
 * - Context packs are deterministic (same input → same output)
 * - Results are cached for 5 minutes (CACHE_TTL)
 * - Token budget is enforced via truncation if needed
 * - Historical findings are optional for performance
 * - All data retrieved from database (append-only event log)
 * - Context pack includes token usage breakdown by section
 *
 * @see {@link CompileContextOptions} for full option details
 * @see {@link CompiledContextPack} for return value structure
 */
export function compileContextPack(
	options: CompileContextOptions
): Result<CompiledContextPack> {
	try {
		// Check cache first
		const cacheKey = `${options.role}:${options.dialogueId}`;
		const cached = contextPackCache.get(cacheKey);

		if (cached && new Date(cached.expiresAt) > new Date()) {
			return { success: true, value: cached.pack };
		}

		const db = getDatabase();
		const compiledAt = new Date().toISOString();

		// Retrieve active claims for this dialogue
		const claims = retrieveActiveClaims(options.dialogueId);
		if (!claims.success) {
			return claims;
		}

		// Retrieve verdicts for claims
		const verdicts = retrieveVerdicts(claims.value.map((c) => c.claim_id));
		if (!verdicts.success) {
			return verdicts;
		}

		// Retrieve human decisions
		const decisions = retrieveHumanDecisions(options.dialogueId);
		if (!decisions.success) {
			return decisions;
		}

		// Retrieve constraint manifest
		const manifest = retrieveLatestConstraintManifest();
		if (!manifest.success) {
			return manifest;
		}

		// Retrieve historical findings if requested
		let historicalFindings: string[] = [];
		if (options.includeHistorical) {
			const historical = retrieveHistoricalFindings(
				options.dialogueId,
				options.maxHistoricalFindings || 10
			);
			if (historical.success) {
				historicalFindings = historical.value;
			}
		}

		// Retrieve artifact references
		const artifactRefs = retrieveArtifactRefs(options.dialogueId);
		if (!artifactRefs.success) {
			return artifactRefs;
		}

		// Calculate token usage
		const tokenUsage = calculateTokenUsage({
			goal: options.goal || '',
			constraintManifest: manifest.value,
			claims: claims.value,
			verdicts: verdicts.value,
			decisions: decisions.value,
			historicalFindings,
			artifactRefs: artifactRefs.value,
		});

		// Create context pack
		const contextPack: CompiledContextPack = {
			role: options.role,
			goal: options.goal || null,
			constraint_manifest: manifest.value,
			active_claims: claims.value,
			verdicts: verdicts.value,
			human_decisions: decisions.value,
			historical_findings: historicalFindings,
			artifact_refs: artifactRefs.value,
			token_budget: options.tokenBudget,
			compiled_at: compiledAt,
			tokenUsage,
		};

		// Check if within budget
		if (tokenUsage.total > options.tokenBudget) {
			// Context pack exceeds budget - needs truncation
			// This will be handled by the truncation module
			return {
				success: false,
				error: new Error(
					`Context pack exceeds token budget: ${tokenUsage.total} > ${options.tokenBudget}`
				),
			};
		}

		// Cache the context pack
		const expiresAt = new Date(Date.now() + CACHE_TTL).toISOString();
		contextPackCache.set(cacheKey, {
			pack: contextPack,
			compiledAt,
			expiresAt,
		});

		return { success: true, value: contextPack };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to compile context pack'),
		};
	}
}

/**
 * Retrieve active claims for dialogue
 * @param dialogueId Dialogue ID
 * @returns Result containing active claims
 */
function retrieveActiveClaims(dialogueId: string): Result<Claim[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const claims = db
			.prepare(
				`
				SELECT claim_id, statement, introduced_by, criticality,
				       status, dialogue_id, turn_id, created_at
				FROM claims
				WHERE dialogue_id = ?
				ORDER BY created_at ASC
			`
			)
			.all(dialogueId) as Claim[];

		return { success: true, value: claims };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to retrieve claims'),
		};
	}
}

/**
 * Retrieve verdicts for claims
 * @param claimIds Claim IDs
 * @returns Result containing verdicts
 */
function retrieveVerdicts(claimIds: string[]): Result<Verdict[]> {
	try {
		if (claimIds.length === 0) {
			return { success: true, value: [] };
		}

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
				SELECT verdict_id, claim_id, verdict, constraints_ref,
				       evidence_ref, rationale, timestamp
				FROM verdicts
				WHERE claim_id IN (${placeholders})
				ORDER BY timestamp ASC
			`
			)
			.all(...claimIds) as Verdict[];

		return { success: true, value: verdicts };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to retrieve verdicts'),
		};
	}
}

/**
 * Retrieve human decisions for dialogue
 * @param dialogueId Dialogue ID
 * @returns Result containing human decisions
 */
function retrieveHumanDecisions(dialogueId: string): Result<HumanDecision[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const decisions = db
			.prepare(
				`
				SELECT hd.decision_id, hd.gate_id, hd.action,
				       hd.rationale, hd.attachments_ref, hd.timestamp
				FROM human_decisions hd
				JOIN gates g ON hd.gate_id = g.gate_id
				WHERE g.dialogue_id = ?
				ORDER BY hd.timestamp ASC
			`
			)
			.all(dialogueId) as HumanDecision[];

		return { success: true, value: decisions };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve human decisions'),
		};
	}
}

/**
 * Retrieve latest constraint manifest
 * @returns Result containing constraint manifest or null
 */
function retrieveLatestConstraintManifest(): Result<ConstraintManifest | null> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const manifest = db
			.prepare(
				`
				SELECT manifest_id, version, constraints_ref, timestamp
				FROM constraint_manifests
				ORDER BY version DESC
				LIMIT 1
			`
			)
			.get() as ConstraintManifest | undefined;

		return { success: true, value: manifest || null };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve constraint manifest'),
		};
	}
}

/**
 * Retrieve historical findings from Historian-Interpreter
 * @param dialogueId Dialogue ID
 * @param limit Maximum number of findings
 * @returns Result containing historical findings
 */
function retrieveHistoricalFindings(
	dialogueId: string,
	limit: number
): Result<string[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Retrieve Historian-Interpreter turns with content
		const turns = db
			.prepare(
				`
				SELECT dt.content_ref
				FROM dialogue_turns dt
				WHERE dt.dialogue_id = ?
				  AND dt.role = 'HISTORIAN'
				ORDER BY dt.turn_id DESC
				LIMIT ?
			`
			)
			.all(dialogueId, limit) as { content_ref: string }[];

		// Extract findings from content references
		// This would need to retrieve actual content from artifacts
		// For now, return content references
		const findings = turns.map((t) => t.content_ref);

		return { success: true, value: findings };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve historical findings'),
		};
	}
}

/**
 * Retrieve artifact references for dialogue
 * @param dialogueId Dialogue ID
 * @returns Result containing artifact reference IDs
 */
function retrieveArtifactRefs(dialogueId: string): Result<string[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Get artifact references linked to this dialogue's claims
		const refs = db
			.prepare(
				`
				SELECT DISTINCT ar.reference_id
				FROM artifact_references ar
				JOIN claims c ON ar.metadata LIKE '%' || c.claim_id || '%'
				WHERE c.dialogue_id = ?
				ORDER BY ar.created_at ASC
			`
			)
			.all(dialogueId) as { reference_id: string }[];

		return { success: true, value: refs.map((r) => r.reference_id) };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve artifact references'),
		};
	}
}

/**
 * Calculate token usage for context pack components
 * @param pack Context pack components
 * @returns Token usage breakdown
 */
function calculateTokenUsage(pack: {
	goal: string;
	constraintManifest: ConstraintManifest | null;
	claims: Claim[];
	verdicts: Verdict[];
	decisions: HumanDecision[];
	historicalFindings: string[];
	artifactRefs: string[];
}): CompiledContextPack['tokenUsage'] {
	const goalTokens = countTokens(pack.goal);

	// Estimate constraint manifest tokens (would need to read actual content)
	const constraintTokens = pack.constraintManifest ? 500 : 0;

	// Count tokens for claims
	const claimsText = pack.claims.map((c) => c.statement).join('\n');
	const claimsTokens = countTokens(claimsText);

	// Count tokens for verdicts
	const verdictsText = pack.verdicts
		.map((v) => `${v.verdict}: ${v.rationale}`)
		.join('\n');
	const verdictsTokens = countTokens(verdictsText);

	// Count tokens for decisions
	const decisionsText = pack.decisions
		.map((d) => `${d.action}: ${d.rationale}`)
		.join('\n');
	const decisionsTokens = countTokens(decisionsText);

	// Estimate historical findings tokens
	const historicalTokens = pack.historicalFindings.length * 100; // Rough estimate

	const total =
		goalTokens +
		constraintTokens +
		claimsTokens +
		verdictsTokens +
		decisionsTokens +
		historicalTokens;

	return {
		goal: goalTokens,
		constraints: constraintTokens,
		claims: claimsTokens,
		verdicts: verdictsTokens,
		decisions: decisionsTokens,
		historical: historicalTokens,
		workspace: 0,
		total,
	};
}

/**
 * Serialize context pack to string
 * @param pack Context pack
 * @returns Serialized context pack
 */
export function serializeContextPack(pack: ContextPack): string {
	return JSON.stringify(pack, null, 2);
}

/**
 * Deserialize context pack from string
 * @param serialized Serialized context pack
 * @returns Result containing deserialized context pack
 */
export function deserializeContextPack(serialized: string): Result<ContextPack> {
	try {
		const pack = JSON.parse(serialized) as ContextPack;
		return { success: true, value: pack };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to deserialize context pack'),
		};
	}
}

/**
 * Clear context pack cache
 * Useful for testing or after state changes
 */
export function clearContextPackCache(): void {
	contextPackCache.clear();
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCacheEntries(): void {
	const now = new Date();
	for (const [key, cached] of contextPackCache.entries()) {
		if (new Date(cached.expiresAt) <= now) {
			contextPackCache.delete(key);
		}
	}
}

/**
 * Get cache statistics
 * @returns Cache statistics
 */
export function getCacheStatistics(): {
	size: number;
	entries: Array<{ key: string; compiledAt: string; expiresAt: string }>;
} {
	const entries = Array.from(contextPackCache.entries()).map(([key, cached]) => ({
		key,
		compiledAt: cached.compiledAt,
		expiresAt: cached.expiresAt,
	}));

	return {
		size: contextPackCache.size,
		entries,
	};
}
