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
import type Database from 'better-sqlite3';
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

			// Inject MAKER narrative context (failure motifs, invariants, lessons)
			const narrative = retrieveNarrativeContext(options.dialogueId, 2000);
			if (narrative.length > 0) {
				historicalFindings.push(...narrative);
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

		// If over budget, truncate gracefully instead of hard-failing.
		// Priority (keep first): constraints > claims > verdicts > goal > decisions > historical > artifacts
		if (tokenUsage.total > options.tokenBudget) {
			truncateContextPackToBudget(contextPack, tokenUsage, options.tokenBudget);
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

		const findings: string[] = [];

		// 1. Retrieve Historian-Interpreter turns with actual content
		const turns = db
			.prepare(
				`
				SELECT dt.content_ref, dt.speech_act, dt.phase
				FROM dialogue_turns dt
				WHERE dt.dialogue_id = ?
				  AND dt.role = 'HISTORIAN'
				ORDER BY dt.turn_id DESC
				LIMIT ?
			`
			)
			.all(dialogueId, limit) as { content_ref: string; speech_act: string; phase: string }[];

		for (const turn of turns) {
			// Try to parse JSON content into readable text
			let readable = turn.content_ref;
			try {
				const parsed = JSON.parse(turn.content_ref);
				if (typeof parsed === 'string') {
					readable = parsed;
				} else if (typeof parsed === 'object' && parsed !== null) {
					// Extract meaningful fields from structured responses
					readable = parsed.summary ?? parsed.finding ?? JSON.stringify(parsed);
				}
			} catch { /* use raw content */ }
			findings.push(`[${turn.phase}/${turn.speech_act}] ${readable}`);
		}

		// 2. Include recent verdicts with rationale (actual substance)
		const verdicts = db
			.prepare(
				`
				SELECT v.verdict, v.rationale, c.statement
				FROM verdicts v
				JOIN claims c ON v.claim_id = c.claim_id
				WHERE c.dialogue_id = ?
				ORDER BY v.timestamp DESC
				LIMIT ?
			`
			)
			.all(dialogueId, limit) as { verdict: string; rationale: string; statement: string }[];

		for (const v of verdicts) {
			const preview = v.rationale.length > 150 ? v.rationale.substring(0, 150) + '…' : v.rationale;
			findings.push(`Verdict [${v.verdict}] on "${v.statement}": ${preview}`);
		}

		// 3. Include human decisions with rationale
		const decisions = db
			.prepare(
				`
				SELECT hd.action, hd.rationale
				FROM human_decisions hd
				JOIN gates g ON hd.gate_id = g.gate_id
				WHERE g.dialogue_id = ?
				ORDER BY hd.timestamp DESC
				LIMIT ?
			`
			)
			.all(dialogueId, Math.min(limit, 5)) as { action: string; rationale: string }[];

		for (const d of decisions) {
			findings.push(`Human decision [${d.action}]: ${d.rationale}`);
		}

		// 4. Include Narrative Curator artifacts (cross-dialogue lessons)
		retrieveCuratorLessons(db, dialogueId, limit, findings);

		// 5. Include current-dialogue Curator records (decisions, lessons, open loops)
		retrieveCurrentDialogueCuratorRecords(db, dialogueId, findings);

		// 6. Include intake dialogue summary (human↔expert conversation)
		retrieveIntakeSummary(db, dialogueId, findings);

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
 * Retrieve Narrative Curator lessons from prior dialogues.
 * Appends findings in-place. Silently skips if the table doesn't exist (pre-V9).
 */
function retrieveCuratorLessons(
	db: Database.Database,
	dialogueId: string,
	limit: number,
	findings: string[]
): void {
	try {
		const narratives = db
			.prepare(
				`
				SELECT goal, resolution_status, lessons
				FROM narrative_memories
				WHERE dialogue_id != ?
				ORDER BY created_at DESC
				LIMIT ?
			`
			)
			.all(dialogueId, Math.min(limit, 3)) as {
			goal: string;
			resolution_status: string;
			lessons: string;
		}[];

		for (const n of narratives) {
			const lessons: string[] = JSON.parse(n.lessons);
			if (lessons.length > 0) {
				findings.push(
					`Prior narrative [${n.resolution_status}]: ${n.goal} — Lessons: ${lessons.join('; ')}`
				);
			}
		}
	} catch {
		// narrative_memories table may not exist yet (pre-V9) — skip silently
	}
}

/**
 * Retrieve Narrative Curator records from the CURRENT dialogue.
 * Includes narrative memories (lessons), decision traces (key decisions),
 * and open loops (unresolved issues). This ensures the Verifier, Historian,
 * and other roles see human feedback that was curated after gate decisions.
 * Appends findings in-place. Silently skips if tables don't exist.
 */
function retrieveCurrentDialogueCuratorRecords(
	db: Database.Database,
	dialogueId: string,
	findings: string[]
): void {
	try {
		// Current-dialogue narrative memories
		const narratives = db
			.prepare(
				`
				SELECT curation_mode, goal, resolution_status, lessons
				FROM narrative_memories
				WHERE dialogue_id = ?
				ORDER BY created_at DESC
				LIMIT 5
			`
			)
			.all(dialogueId) as {
			curation_mode: string;
			goal: string;
			resolution_status: string;
			lessons: string;
		}[];

		for (const n of narratives) {
			const lessons: string[] = JSON.parse(n.lessons);
			if (lessons.length > 0) {
				findings.push(
					`Curator [${n.curation_mode}] [${n.resolution_status}]: ${n.goal} — Lessons: ${lessons.join('; ')}`
				);
			}
		}

		// Current-dialogue decision traces
		const traces = db
			.prepare(
				`
				SELECT curation_mode, decision_points
				FROM decision_traces
				WHERE dialogue_id = ?
				ORDER BY created_at DESC
				LIMIT 3
			`
			)
			.all(dialogueId) as {
			curation_mode: string;
			decision_points: string;
		}[];

		for (const t of traces) {
			const points: Array<{ selected_option: string; rationale: string }> = JSON.parse(t.decision_points);
			for (const dp of points) {
				if (dp.selected_option && dp.rationale) {
					findings.push(
						`Decision [${t.curation_mode}]: ${dp.selected_option} — ${dp.rationale}`
					);
				}
			}
		}

		// Current-dialogue open loops
		const loops = db
			.prepare(
				`
				SELECT category, description, priority
				FROM open_loops
				WHERE dialogue_id = ?
				ORDER BY priority ASC, created_at DESC
				LIMIT 5
			`
			)
			.all(dialogueId) as {
			category: string;
			description: string;
			priority: string;
		}[];

		for (const l of loops) {
			findings.push(
				`Open issue [${l.category}] [${l.priority}]: ${l.description}`
			);
		}
	} catch {
		// Curator tables may not exist yet — skip silently
	}
}

/**
 * Retrieve the intake dialogue summary for the current dialogue.
 * The intake dialogue contains human↔Technical Expert conversation that
 * captures requirements, clarifications, and corrections. This context
 * is essential for the Verifier and Historian to understand human intent.
 * Appends findings in-place. Silently skips if intake_turns doesn't exist.
 */
function retrieveIntakeSummary(
	db: Database.Database,
	dialogueId: string,
	findings: string[]
): void {
	try {
		const intakeTurns = db
			.prepare(
				`
				SELECT turn_number, human_message, expert_response
				FROM intake_turns
				WHERE dialogue_id = ?
				ORDER BY turn_number ASC
				LIMIT 10
			`
			)
			.all(dialogueId) as {
			turn_number: number;
			human_message: string;
			expert_response: string;
		}[];

		for (const t of intakeTurns) {
			const humanPreview = t.human_message.length > 300
				? t.human_message.substring(0, 300) + '...'
				: t.human_message;
			const expertPreview = t.expert_response.length > 300
				? t.expert_response.substring(0, 300) + '...'
				: t.expert_response;
			findings.push(
				`Intake [Turn ${t.turn_number}]: Human: ${humanPreview} | Expert: ${expertPreview}`
			);
		}
	} catch {
		// intake_turns table may not exist — skip silently
	}
}

/**
 * Retrieve MAKER narrative context from historical invariant packets,
 * outcome snapshots, and decision traces. Provides failure motifs,
 * invariants, and lessons learned from prior dialogues for active
 * memory injection into the execution context.
 *
 * @param dialogueId Current dialogue ID (excluded from cross-dialogue queries)
 * @param tokenBudget Approximate character budget for narrative content
 * @returns Array of narrative context strings
 */
function retrieveNarrativeContext(
	dialogueId: string,
	tokenBudget: number
): string[] {
	const db = getDatabase();
	if (!db) { return []; }

	const collector = new BudgetedCollector(tokenBudget);

	try {
		collectInvariantPackets(db, dialogueId, collector);
		collectOutcomeSnapshots(db, dialogueId, collector);
	} catch {
		// Tables may not exist yet (pre-V11) — return whatever was gathered
	}

	return collector.entries;
}

/**
 * Accumulates entries while respecting a character budget.
 */
class BudgetedCollector {
	readonly entries: string[] = [];
	private usedChars = 0;
	constructor(private readonly budget: number) {}

	/** Returns false if budget is exhausted. */
	add(entry: string): boolean {
		if (this.usedChars + entry.length > this.budget) { return false; }
		this.entries.push(entry);
		this.usedChars += entry.length;
		return true;
	}

	addTaggedList(tag: string, items: string[]): void {
		for (const item of items) {
			if (!this.add(`[${tag}] ${item}`)) { return; }
		}
	}

	get exhausted(): boolean { return this.usedChars >= this.budget; }
}

function collectInvariantPackets(
	db: Database.Database,
	dialogueId: string,
	collector: BudgetedCollector
): void {
	const rows = db
		.prepare(
			`SELECT relevant_invariants, prior_failure_motifs, precedent_patterns
			 FROM historical_invariant_packets
			 WHERE dialogue_id != ?
			 ORDER BY created_at DESC
			 LIMIT 5`
		)
		.all(dialogueId) as {
		relevant_invariants: string;
		prior_failure_motifs: string;
		precedent_patterns: string;
	}[];

	for (const row of rows) {
		if (collector.exhausted) { return; }
		collector.addTaggedList('Invariant', safeParseJSON<string[]>(row.relevant_invariants, []));
		collector.addTaggedList('Failure Motif', safeParseJSON<string[]>(row.prior_failure_motifs, []));
		collector.addTaggedList('Precedent', safeParseJSON<string[]>(row.precedent_patterns, []));
	}
}

function collectOutcomeSnapshots(
	db: Database.Database,
	dialogueId: string,
	collector: BudgetedCollector
): void {
	const rows = db
		.prepare(
			`SELECT failure_modes, useful_invariants, success, units_completed, units_total
			 FROM outcome_snapshots
			 WHERE dialogue_id != ?
			 ORDER BY created_at DESC
			 LIMIT 3`
		)
		.all(dialogueId) as {
		failure_modes: string;
		useful_invariants: string;
		success: number;
		units_completed: number;
		units_total: number;
	}[];

	for (const row of rows) {
		if (collector.exhausted) { return; }

		const status = row.success ? 'succeeded' : 'failed';
		collector.add(`[Prior Outcome] ${status} (${row.units_completed}/${row.units_total} units)`);

		if (!row.success) {
			collector.addTaggedList('  → failure', safeParseJSON<string[]>(row.failure_modes, []).slice(0, 3));
		}
		collector.addTaggedList('  → lesson', safeParseJSON<string[]>(row.useful_invariants, []).slice(0, 3));
	}
}

function safeParseJSON<T>(value: string | null | undefined, fallback: T): T {
	if (!value) { return fallback; }
	try { return JSON.parse(value) as T; } catch { return fallback; }
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
 * Truncate a context pack to fit within a token budget.
 * Removes lowest-priority sections first: historical → artifacts → decisions → verdicts.
 * Mutates the pack and tokenUsage in place.
 */
function truncateContextPackToBudget(
	pack: CompiledContextPack,
	usage: CompiledContextPack['tokenUsage'],
	budget: number
): void {
	const recalcTotal = () => {
		usage.total = usage.goal + usage.constraints + usage.claims
			+ usage.verdicts + usage.decisions + usage.historical + usage.workspace;
	};

	// 1. Drop historical findings (100 tokens each estimated)
	while (pack.historical_findings.length > 0 && usage.total > budget) {
		pack.historical_findings.pop();
		usage.historical = Math.max(0, usage.historical - 100);
		recalcTotal();
	}

	// 2. Drop artifact refs
	while (pack.artifact_refs.length > 0 && usage.total > budget) {
		pack.artifact_refs.pop();
		usage.workspace = Math.max(0, usage.workspace - 30);
		recalcTotal();
	}

	// 3. Drop decisions (oldest first, but popping from end is fine for budget)
	while (pack.human_decisions.length > 0 && usage.total > budget) {
		pack.human_decisions.pop();
		usage.decisions = Math.max(0, usage.decisions - 40);
		recalcTotal();
	}

	// 4. Drop verdicts if still over
	while (pack.verdicts.length > 0 && usage.total > budget) {
		pack.verdicts.pop();
		usage.verdicts = Math.max(0, usage.verdicts - 30);
		recalcTotal();
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
