/**
 * Event Reader - Query and Filter Events
 * Implements Phase 1.4: Event Logging Infrastructure
 * Provides queryable access to append-only event log
 */

import type {
	Result,
	DialogueTurn,
	Claim,
	ClaimEvent,
	Verdict,
	Gate,
	HumanDecision,
	ConstraintManifest,
	Artifact,
	ArtifactReference,
	Role,
	Phase,
	ClaimStatus,
	ClaimCriticality,
	VerdictType,
	GateStatus,
	HumanAction,
	IntakeConversationState,
	IntakeConversationTurn,
	IntakePlanDocument,
	IntakeAccumulation,
	IntakeTurnResponse,
	IntakeGatheringTurnResponse,
	DomainCoverageMap,
	IntakeModeRecommendation,
	IntakeCheckpoint,
} from '../types';
import { IntakeSubState, IntakeMode, EngineeringDomain, createEmptyPlanDocument } from '../types';
import { getDatabase } from '../database';

// ==================== FILTER TYPES ====================

export interface DialogueTurnFilter {
	dialogue_id?: string;
	role?: Role;
	phase?: Phase;
	since?: string; // ISO-8601 timestamp
	until?: string; // ISO-8601 timestamp
	limit?: number;
	offset?: number;
}

export interface ClaimFilter {
	dialogue_id?: string;
	status?: ClaimStatus;
	criticality?: ClaimCriticality;
	introduced_by?: Role;
	since?: string;
	until?: string;
	limit?: number;
	offset?: number;
}

export interface ClaimEventFilter {
	claim_id?: string;
	since?: string;
	until?: string;
	limit?: number;
	offset?: number;
}

export interface VerdictFilter {
	claim_id?: string;
	verdict?: VerdictType;
	since?: string;
	until?: string;
	limit?: number;
	offset?: number;
}

export interface GateFilter {
	dialogue_id?: string;
	status?: GateStatus;
	since?: string;
	until?: string;
	limit?: number;
	offset?: number;
}

export interface HumanDecisionFilter {
	gate_id?: string;
	action?: HumanAction;
	since?: string;
	until?: string;
	limit?: number;
	offset?: number;
}

// ==================== DIALOGUE TURN READERS ====================

/**
 * Get all dialogue turns with optional filtering
 * @param filter Optional filter criteria
 * @returns Array of dialogue turns
 */
export function getDialogueTurns(
	filter?: DialogueTurnFilter
): Result<DialogueTurn[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		let sql = 'SELECT * FROM dialogue_turns WHERE 1=1';
		const params: unknown[] = [];

		if (filter?.dialogue_id) {
			sql += ' AND dialogue_id = ?';
			params.push(filter.dialogue_id);
		}

		if (filter?.role) {
			sql += ' AND role = ?';
			params.push(filter.role);
		}

		if (filter?.phase) {
			sql += ' AND phase = ?';
			params.push(filter.phase);
		}

		if (filter?.since) {
			sql += ' AND timestamp >= ?';
			params.push(filter.since);
		}

		if (filter?.until) {
			sql += ' AND timestamp <= ?';
			params.push(filter.until);
		}

		sql += ' ORDER BY turn_id ASC';

		if (filter?.limit) {
			sql += ' LIMIT ?';
			params.push(filter.limit);
		}

		if (filter?.offset) {
			sql += ' OFFSET ?';
			params.push(filter.offset);
		}

		const turns = db.prepare(sql).all(...params) as DialogueTurn[];

		return { success: true, value: turns };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get dialogue turns'),
		};
	}
}

/**
 * Get a single dialogue turn by turn_id
 * @param turn_id Turn ID
 * @returns Dialogue turn or null
 */
export function getDialogueTurnById(
	turn_id: number
): Result<DialogueTurn | null> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const turn = db
			.prepare('SELECT * FROM dialogue_turns WHERE turn_id = ?')
			.get(turn_id) as DialogueTurn | undefined;

		return { success: true, value: turn || null };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get dialogue turn'),
		};
	}
}

// ==================== CLAIM READERS ====================

/**
 * Get all claims with optional filtering
 * @param filter Optional filter criteria
 * @returns Array of claims
 */
export function getClaims(filter?: ClaimFilter): Result<Claim[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		let sql = 'SELECT * FROM claims WHERE 1=1';
		const params: unknown[] = [];

		if (filter?.dialogue_id) {
			sql += ' AND dialogue_id = ?';
			params.push(filter.dialogue_id);
		}

		if (filter?.status) {
			sql += ' AND status = ?';
			params.push(filter.status);
		}

		if (filter?.criticality) {
			sql += ' AND criticality = ?';
			params.push(filter.criticality);
		}

		if (filter?.introduced_by) {
			sql += ' AND introduced_by = ?';
			params.push(filter.introduced_by);
		}

		if (filter?.since) {
			sql += ' AND created_at >= ?';
			params.push(filter.since);
		}

		if (filter?.until) {
			sql += ' AND created_at <= ?';
			params.push(filter.until);
		}

		sql += ' ORDER BY created_at DESC';

		if (filter?.limit) {
			sql += ' LIMIT ?';
			params.push(filter.limit);
		}

		if (filter?.offset) {
			sql += ' OFFSET ?';
			params.push(filter.offset);
		}

		const claims = db.prepare(sql).all(...params) as Claim[];

		return { success: true, value: claims };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get claims'),
		};
	}
}

/**
 * Get a single claim by claim_id
 * @param claim_id Claim ID
 * @returns Claim or null
 */
export function getClaimById(claim_id: string): Result<Claim | null> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const claim = db
			.prepare('SELECT * FROM claims WHERE claim_id = ?')
			.get(claim_id) as Claim | undefined;

		return { success: true, value: claim || null };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get claim'),
		};
	}
}

/**
 * Get all claim events for a specific claim
 * @param claim_id Claim ID
 * @param filter Optional filter criteria
 * @returns Array of claim events
 */
export function getClaimEvents(
	claim_id: string,
	filter?: ClaimEventFilter
): Result<ClaimEvent[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		let sql = 'SELECT * FROM claim_events WHERE claim_id = ?';
		const params: unknown[] = [claim_id];

		if (filter?.since) {
			sql += ' AND timestamp >= ?';
			params.push(filter.since);
		}

		if (filter?.until) {
			sql += ' AND timestamp <= ?';
			params.push(filter.until);
		}

		sql += ' ORDER BY timestamp ASC';

		if (filter?.limit) {
			sql += ' LIMIT ?';
			params.push(filter.limit);
		}

		if (filter?.offset) {
			sql += ' OFFSET ?';
			params.push(filter.offset);
		}

		const events = db.prepare(sql).all(...params) as ClaimEvent[];

		return { success: true, value: events };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get claim events'),
		};
	}
}

// ==================== VERDICT READERS ====================

/**
 * Get all verdicts with optional filtering
 * @param filter Optional filter criteria
 * @returns Array of verdicts
 */
export function getVerdicts(filter?: VerdictFilter): Result<Verdict[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		let sql = 'SELECT * FROM verdicts WHERE 1=1';
		const params: unknown[] = [];

		if (filter?.claim_id) {
			sql += ' AND claim_id = ?';
			params.push(filter.claim_id);
		}

		if (filter?.verdict) {
			sql += ' AND verdict = ?';
			params.push(filter.verdict);
		}

		if (filter?.since) {
			sql += ' AND timestamp >= ?';
			params.push(filter.since);
		}

		if (filter?.until) {
			sql += ' AND timestamp <= ?';
			params.push(filter.until);
		}

		sql += ' ORDER BY timestamp DESC';

		if (filter?.limit) {
			sql += ' LIMIT ?';
			params.push(filter.limit);
		}

		if (filter?.offset) {
			sql += ' OFFSET ?';
			params.push(filter.offset);
		}

		const verdicts = db.prepare(sql).all(...params) as Verdict[];

		return { success: true, value: verdicts };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get verdicts'),
		};
	}
}

// ==================== GATE READERS ====================

/**
 * Get all gates with optional filtering
 * @param filter Optional filter criteria
 * @returns Array of gates
 */
export function getGates(filter?: GateFilter): Result<Gate[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		let sql = 'SELECT * FROM gates WHERE 1=1';
		const params: unknown[] = [];

		if (filter?.dialogue_id) {
			sql += ' AND dialogue_id = ?';
			params.push(filter.dialogue_id);
		}

		if (filter?.status) {
			sql += ' AND status = ?';
			params.push(filter.status);
		}

		if (filter?.since) {
			sql += ' AND created_at >= ?';
			params.push(filter.since);
		}

		if (filter?.until) {
			sql += ' AND created_at <= ?';
			params.push(filter.until);
		}

		sql += ' ORDER BY created_at DESC';

		if (filter?.limit) {
			sql += ' LIMIT ?';
			params.push(filter.limit);
		}

		if (filter?.offset) {
			sql += ' OFFSET ?';
			params.push(filter.offset);
		}

		const rawGates = db.prepare(sql).all(...params) as (Gate & {
			blocking_claims: string;
		})[];

		// Parse blocking_claims JSON
		const gates: Gate[] = rawGates.map((g) => ({
			...g,
			blocking_claims: JSON.parse(g.blocking_claims),
		}));

		return { success: true, value: gates };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get gates'),
		};
	}
}

/**
 * Get a single gate by gate_id
 * @param gate_id Gate ID
 * @returns Gate or null
 */
export function getGateById(gate_id: string): Result<Gate | null> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const rawGate = db
			.prepare('SELECT * FROM gates WHERE gate_id = ?')
			.get(gate_id) as
			| (Gate & { blocking_claims: string })
			| undefined;

		if (!rawGate) {
			return { success: true, value: null };
		}

		const gate: Gate = {
			...rawGate,
			blocking_claims: JSON.parse(rawGate.blocking_claims),
		};

		return { success: true, value: gate };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get gate'),
		};
	}
}

// ==================== HUMAN DECISION READERS ====================

/**
 * Get all human decisions with optional filtering
 * @param filter Optional filter criteria
 * @returns Array of human decisions
 */
export function getHumanDecisions(
	filter?: HumanDecisionFilter
): Result<HumanDecision[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		let sql = 'SELECT * FROM human_decisions WHERE 1=1';
		const params: unknown[] = [];

		if (filter?.gate_id) {
			sql += ' AND gate_id = ?';
			params.push(filter.gate_id);
		}

		if (filter?.action) {
			sql += ' AND action = ?';
			params.push(filter.action);
		}

		if (filter?.since) {
			sql += ' AND timestamp >= ?';
			params.push(filter.since);
		}

		if (filter?.until) {
			sql += ' AND timestamp <= ?';
			params.push(filter.until);
		}

		sql += ' ORDER BY timestamp DESC';

		if (filter?.limit) {
			sql += ' LIMIT ?';
			params.push(filter.limit);
		}

		if (filter?.offset) {
			sql += ' OFFSET ?';
			params.push(filter.offset);
		}

		const decisions = db.prepare(sql).all(...params) as HumanDecision[];

		return { success: true, value: decisions };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get human decisions'),
		};
	}
}

// ==================== ARTIFACT READERS ====================

/**
 * Get artifact by content hash
 * @param content_hash SHA-256 hash
 * @returns Artifact or null
 */
export function getArtifactByHash(
	content_hash: string
): Result<Artifact | null> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const artifact = db
			.prepare('SELECT * FROM artifacts WHERE content_hash = ?')
			.get(content_hash) as Artifact | undefined;

		return { success: true, value: artifact || null };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get artifact'),
		};
	}
}

/**
 * Get artifact reference by reference_id
 * @param reference_id Reference ID
 * @returns Artifact reference or null
 */
export function getArtifactReferenceById(
	reference_id: string
): Result<ArtifactReference | null> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const reference = db
			.prepare('SELECT * FROM artifact_references WHERE reference_id = ?')
			.get(reference_id) as ArtifactReference | undefined;

		return { success: true, value: reference || null };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get artifact reference'),
		};
	}
}

// ==================== UTILITY READERS ====================

// ==================== INTAKE CONVERSATION READERS ====================

/**
 * Raw row shape from the intake_conversations table (JSON fields are strings)
 */
interface IntakeConversationRow {
	id: number;
	dialogue_id: string;
	sub_state: string;
	turn_count: number;
	draft_plan: string;
	accumulations: string;
	finalized_plan: string | null;
	created_at: string;
	updated_at: string;
	// V15 Adaptive Deep INTAKE columns (nullable)
	intake_mode: string | null;
	domain_coverage: string | null;
	current_domain: string | null;
	checkpoints: string | null;
	classifier_result: string | null;
	// V17 Inverted flow
	clarification_round: number;
}

/**
 * Raw row shape from the intake_turns table (JSON fields are strings)
 */
interface IntakeTurnRow {
	id: number;
	dialogue_id: string;
	turn_number: number;
	human_message: string;
	expert_response: string;
	plan_snapshot: string;
	token_count: number;
	is_gathering: number;
	created_at: string;
}

/**
 * Parse a raw intake_conversations row into typed IntakeConversationState
 */
function parseIntakeConversationRow(
	row: IntakeConversationRow
): IntakeConversationState {
	return {
		id: row.id,
		dialogueId: row.dialogue_id,
		subState: row.sub_state as IntakeSubState,
		turnCount: row.turn_count,
		draftPlan: JSON.parse(row.draft_plan) as IntakePlanDocument,
		accumulations: JSON.parse(row.accumulations) as IntakeAccumulation[],
		finalizedPlan: row.finalized_plan
			? (JSON.parse(row.finalized_plan) as IntakePlanDocument)
			: null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		// V15 Adaptive Deep INTAKE fields
		intakeMode: row.intake_mode as IntakeMode | null,
		domainCoverage: row.domain_coverage
			? (JSON.parse(row.domain_coverage) as DomainCoverageMap)
			: null,
		currentDomain: row.current_domain as EngineeringDomain | null,
		checkpoints: row.checkpoints
			? (JSON.parse(row.checkpoints) as IntakeCheckpoint[])
			: [],
		classifierResult: row.classifier_result
			? (JSON.parse(row.classifier_result) as IntakeModeRecommendation)
			: null,
		// V17 Inverted flow
		clarificationRound: row.clarification_round ?? 0,
	};
}

/**
 * Parse a raw intake_turns row into typed IntakeConversationTurn
 */
function parseIntakeTurnRow(row: IntakeTurnRow): IntakeConversationTurn {
	const isGathering = row.is_gathering === 1;
	const parsedPlan = JSON.parse(row.plan_snapshot) as IntakePlanDocument;
	return {
		id: row.id,
		dialogueId: row.dialogue_id,
		turnNumber: row.turn_number,
		humanMessage: row.human_message,
		expertResponse: JSON.parse(row.expert_response) as
			IntakeTurnResponse | IntakeGatheringTurnResponse,
		// Gathering turns store an empty plan doc — return null instead
		planSnapshot: isGathering || (parsedPlan.version === 0 && !parsedPlan.title)
			? null
			: parsedPlan,
		tokenCount: row.token_count,
		isGathering,
		createdAt: row.created_at,
	};
}

/**
 * Get the INTAKE conversation state for a dialogue.
 * Returns null if no conversation exists yet.
 */
export function getIntakeConversation(
	dialogueId: string
): Result<IntakeConversationState | null> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const row = db
			.prepare(
				'SELECT * FROM intake_conversations WHERE dialogue_id = ?'
			)
			.get(dialogueId) as IntakeConversationRow | undefined;

		if (!row) {
			return { success: true, value: null };
		}

		return { success: true, value: parseIntakeConversationRow(row) };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get intake conversation'),
		};
	}
}

/**
 * Get or create the INTAKE conversation state for a dialogue.
 * If no conversation exists, creates one with default values.
 */
export function getOrCreateIntakeConversation(
	dialogueId: string
): Result<IntakeConversationState> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		// Try to get existing
		const existing = db
			.prepare(
				'SELECT * FROM intake_conversations WHERE dialogue_id = ?'
			)
			.get(dialogueId) as IntakeConversationRow | undefined;

		if (existing) {
			return {
				success: true,
				value: parseIntakeConversationRow(existing),
			};
		}

		// Create new
		const emptyPlan = createEmptyPlanDocument();
		db.prepare(
			`INSERT INTO intake_conversations (dialogue_id, sub_state, turn_count, draft_plan, accumulations, created_at, updated_at)
			 VALUES (?, ?, 0, ?, '[]', datetime('now'), datetime('now'))`
		).run(dialogueId, IntakeSubState.DISCUSSING, JSON.stringify(emptyPlan));

		// Retrieve created row
		const created = db
			.prepare(
				'SELECT * FROM intake_conversations WHERE dialogue_id = ?'
			)
			.get(dialogueId) as IntakeConversationRow;

		return { success: true, value: parseIntakeConversationRow(created) };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get or create intake conversation'),
		};
	}
}

/**
 * Get INTAKE conversation turns for a dialogue, ordered by turn number.
 * Supports limit and offset for pagination / sliding window queries.
 */
export function getIntakeTurns(
	dialogueId: string,
	options?: { limit?: number; offset?: number }
): Result<IntakeConversationTurn[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		let sql =
			'SELECT * FROM intake_turns WHERE dialogue_id = ? ORDER BY turn_number ASC';
		const params: unknown[] = [dialogueId];

		if (options?.limit) {
			sql += ' LIMIT ?';
			params.push(options.limit);
		}

		if (options?.offset) {
			sql += ' OFFSET ?';
			params.push(options.offset);
		}

		const rows = db.prepare(sql).all(...params) as IntakeTurnRow[];

		return {
			success: true,
			value: rows.map(parseIntakeTurnRow),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get intake turns'),
		};
	}
}

/**
 * Get INTAKE gathering turns for a dialogue (is_gathering = 1).
 * Returns turns in chronological order.
 */
export function getGatheringTurns(
	dialogueId: string
): Result<IntakeConversationTurn[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const rows = db
			.prepare(
				'SELECT * FROM intake_turns WHERE dialogue_id = ? AND is_gathering = 1 ORDER BY turn_number ASC'
			)
			.all(dialogueId) as IntakeTurnRow[];

		return {
			success: true,
			value: rows.map(parseIntakeTurnRow),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get gathering turns'),
		};
	}
}

/**
 * Get the most recent N INTAKE conversation turns (for sliding window context).
 * Returns turns in chronological order (oldest first).
 */
export function getRecentIntakeTurns(
	dialogueId: string,
	count: number
): Result<IntakeConversationTurn[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		// Sub-select to get last N, then re-order ascending
		const rows = db
			.prepare(
				`SELECT * FROM (
					SELECT * FROM intake_turns
					WHERE dialogue_id = ?
					ORDER BY turn_number DESC
					LIMIT ?
				) ORDER BY turn_number ASC`
			)
			.all(dialogueId, count) as IntakeTurnRow[];

		return {
			success: true,
			value: rows.map(parseIntakeTurnRow),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get recent intake turns'),
		};
	}
}

/**
 * Get INTAKE turns within a specific turn number range (for accumulation).
 * Returns turns in chronological order.
 */
export function getIntakeTurnsInRange(
	dialogueId: string,
	fromTurnNumber: number,
	toTurnNumber: number
): Result<IntakeConversationTurn[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const rows = db
			.prepare(
				`SELECT * FROM intake_turns
				 WHERE dialogue_id = ? AND turn_number > ? AND turn_number <= ?
				 ORDER BY turn_number ASC`
			)
			.all(dialogueId, fromTurnNumber, toTurnNumber) as IntakeTurnRow[];

		return {
			success: true,
			value: rows.map(parseIntakeTurnRow),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get intake turns in range'),
		};
	}
}

/**
 * Get latest constraint manifest
 * @returns Latest constraint manifest or null
 */
export function getLatestConstraintManifest(): Result<ConstraintManifest | null> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const manifest = db
			.prepare(
				'SELECT * FROM constraint_manifests ORDER BY version DESC LIMIT 1'
			)
			.get() as ConstraintManifest | undefined;

		return { success: true, value: manifest || null };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get latest constraint manifest'),
		};
	}
}

// ==================== Q&A EXCHANGE READERS ====================

export interface QaExchange {
	event_id: number;
	dialogue_id: string;
	timestamp: string;
	phase: string | null;
	question: string;
	answer: string;
}

/**
 * Get all Q&A exchanges for a dialogue, ordered chronologically.
 * Reads from cli_activity_events where event_type = 'qa_exchange'.
 */
export function getQaExchanges(dialogueId: string): Result<QaExchange[]> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const rows = db.prepare(
			`SELECT event_id, dialogue_id, timestamp, phase,
					summary AS question, detail AS answer
			 FROM cli_activity_events
			 WHERE dialogue_id = ? AND event_type = 'qa_exchange'
			 ORDER BY timestamp ASC`
		).all(dialogueId) as QaExchange[];

		return { success: true, value: rows };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to get Q&A exchanges'),
		};
	}
}
