/**
 * Historian-Core (Non-Agent)
 * Implements Phase 6.1: Pure event persistence, query interface, and history retrieval
 * This is NOT an LLM-backed agent - it's a pure data layer for event sourcing
 */

import type { Result, DialogueTurn, Claim, Verdict, HumanDecision } from '../types';
import { getDatabase } from '../database';

/**
 * History query options
 */
export interface HistoryQueryOptions {
	dialogueId?: string;
	turnId?: string;
	claimId?: string;
	startTime?: Date;
	endTime?: Date;
	eventTypes?: HistoryEventType[];
	limit?: number;
	offset?: number;
}

/**
 * History event types for filtering
 */
export enum HistoryEventType {
	DIALOGUE_TURN = 'DIALOGUE_TURN',
	CLAIM = 'CLAIM',
	VERDICT = 'VERDICT',
	HUMAN_DECISION = 'HUMAN_DECISION',
	GATE = 'GATE',
}

/**
 * History event record
 */
export interface HistoryEvent {
	event_id: string;
	event_type: HistoryEventType;
	timestamp: string;
	dialogue_id: string;
	turn_id?: string;
	data: unknown;
}

/**
 * History export format
 */
export interface HistoryExport {
	dialogue_id: string;
	export_timestamp: string;
	events: HistoryEvent[];
	metadata: {
		total_events: number;
		start_time?: string;
		end_time?: string;
	};
}

/**
 * Query history events
 * Pure read operation - no LLM involvement
 *
 * @param options Query options
 * @returns Result containing history events
 */
export function queryHistory(
	options: HistoryQueryOptions = {}
): Result<HistoryEvent[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const events: HistoryEvent[] = [];

		// Query dialogue turns if included
		if (
			!options.eventTypes ||
			options.eventTypes.includes(HistoryEventType.DIALOGUE_TURN)
		) {
			const turns = queryDialogueTurns(options);
			if (turns.success) {
				events.push(...turns.value);
			}
		}

		// Query claims if included
		if (
			!options.eventTypes ||
			options.eventTypes.includes(HistoryEventType.CLAIM)
		) {
			const claims = queryClaims(options);
			if (claims.success) {
				events.push(...claims.value);
			}
		}

		// Query verdicts if included
		if (
			!options.eventTypes ||
			options.eventTypes.includes(HistoryEventType.VERDICT)
		) {
			const verdicts = queryVerdicts(options);
			if (verdicts.success) {
				events.push(...verdicts.value);
			}
		}

		// Query human decisions if included
		if (
			!options.eventTypes ||
			options.eventTypes.includes(HistoryEventType.HUMAN_DECISION)
		) {
			const decisions = queryHumanDecisions(options);
			if (decisions.success) {
				events.push(...decisions.value);
			}
		}

		// Sort by timestamp
		events.sort(
			(a, b) =>
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
		);

		// Apply limit and offset
		const start = options.offset || 0;
		const end = options.limit ? start + options.limit : undefined;
		const paginatedEvents = events.slice(start, end);

		return { success: true, value: paginatedEvents };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to query history'),
		};
	}
}

/**
 * Query dialogue turns
 */
function queryDialogueTurns(
	options: HistoryQueryOptions
): Result<HistoryEvent[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	const conditions: string[] = ['1=1'];
	const params: unknown[] = [];

	if (options.dialogueId) {
		conditions.push('dialogue_id = ?');
		params.push(options.dialogueId);
	}

	if (options.turnId) {
		conditions.push('turn_id = ?');
		params.push(options.turnId);
	}

	if (options.startTime) {
		conditions.push('datetime(timestamp) >= datetime(?)');
		params.push(options.startTime.toISOString());
	}

	if (options.endTime) {
		conditions.push('datetime(timestamp) <= datetime(?)');
		params.push(options.endTime.toISOString());
	}

	const query = `
		SELECT turn_id, dialogue_id, role, phase, speech_act,
		       content_ref, artifact_refs, timestamp
		FROM dialogue_turns
		WHERE ${conditions.join(' AND ')}
		ORDER BY timestamp ASC
	`;

	const rows = db.prepare(query).all(...params) as DialogueTurn[];

	const events: HistoryEvent[] = rows.map((row) => ({
		event_id: row.turn_id.toString(),
		event_type: HistoryEventType.DIALOGUE_TURN,
		timestamp: row.timestamp,
		dialogue_id: row.dialogue_id,
		turn_id: row.turn_id.toString(),
		data: row,
	}));

	return { success: true, value: events };
}

/**
 * Query claims
 */
function queryClaims(options: HistoryQueryOptions): Result<HistoryEvent[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	const conditions: string[] = ['1=1'];
	const params: unknown[] = [];

	if (options.dialogueId) {
		conditions.push('dialogue_id = ?');
		params.push(options.dialogueId);
	}

	if (options.claimId) {
		conditions.push('claim_id = ?');
		params.push(options.claimId);
	}

	if (options.turnId) {
		conditions.push('turn_id = ?');
		params.push(options.turnId);
	}

	if (options.startTime) {
		conditions.push('datetime(created_at) >= datetime(?)');
		params.push(options.startTime.toISOString());
	}

	if (options.endTime) {
		conditions.push('datetime(created_at) <= datetime(?)');
		params.push(options.endTime.toISOString());
	}

	const query = `
		SELECT claim_id, statement, introduced_by, criticality,
		       status, dialogue_id, turn_id, created_at
		FROM claims
		WHERE ${conditions.join(' AND ')}
		ORDER BY created_at ASC
	`;

	const rows = db.prepare(query).all(...params) as Claim[];

	const events: HistoryEvent[] = rows.map((row) => ({
		event_id: row.claim_id,
		event_type: HistoryEventType.CLAIM,
		timestamp: row.created_at,
		dialogue_id: row.dialogue_id,
		turn_id: row.turn_id.toString(),
		data: row,
	}));

	return { success: true, value: events };
}

/**
 * Query verdicts
 */
function queryVerdicts(options: HistoryQueryOptions): Result<HistoryEvent[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	const conditions: string[] = ['1=1'];
	const params: unknown[] = [];

	if (options.claimId) {
		conditions.push('claim_id = ?');
		params.push(options.claimId);
	}

	if (options.startTime) {
		conditions.push('datetime(timestamp) >= datetime(?)');
		params.push(options.startTime.toISOString());
	}

	if (options.endTime) {
		conditions.push('datetime(timestamp) <= datetime(?)');
		params.push(options.endTime.toISOString());
	}

	// Join with claims to get dialogue_id
	const query = `
		SELECT v.verdict_id, v.claim_id, v.verdict, v.constraints_ref,
		       v.evidence_ref, v.rationale, v.timestamp, c.dialogue_id
		FROM verdicts v
		JOIN claims c ON v.claim_id = c.claim_id
		WHERE ${conditions.join(' AND ')}
		ORDER BY v.timestamp ASC
	`;

	interface VerdictWithDialogue extends Verdict {
		dialogue_id: string;
	}

	const rows = db.prepare(query).all(...params) as VerdictWithDialogue[];

	const events: HistoryEvent[] = rows.map((row) => ({
		event_id: row.verdict_id,
		event_type: HistoryEventType.VERDICT,
		timestamp: row.timestamp,
		dialogue_id: row.dialogue_id,
		data: row,
	}));

	return { success: true, value: events };
}

/**
 * Query human decisions
 */
function queryHumanDecisions(
	options: HistoryQueryOptions
): Result<HistoryEvent[]> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	const conditions: string[] = ['1=1'];
	const params: unknown[] = [];

	if (options.dialogueId) {
		conditions.push('g.dialogue_id = ?');
		params.push(options.dialogueId);
	}

	if (options.startTime) {
		conditions.push('datetime(hd.timestamp) >= datetime(?)');
		params.push(options.startTime.toISOString());
	}

	if (options.endTime) {
		conditions.push('datetime(hd.timestamp) <= datetime(?)');
		params.push(options.endTime.toISOString());
	}

	const query = `
		SELECT hd.decision_id, hd.gate_id, hd.action,
		       hd.rationale, hd.attachments_ref, hd.timestamp,
		       g.dialogue_id
		FROM human_decisions hd
		JOIN gates g ON hd.gate_id = g.gate_id
		WHERE ${conditions.join(' AND ')}
		ORDER BY hd.timestamp ASC
	`;

	interface HumanDecisionWithDialogue extends HumanDecision {
		dialogue_id: string;
	}

	const rows = db
		.prepare(query)
		.all(...params) as HumanDecisionWithDialogue[];

	const events: HistoryEvent[] = rows.map((row) => ({
		event_id: row.decision_id,
		event_type: HistoryEventType.HUMAN_DECISION,
		timestamp: row.timestamp,
		dialogue_id: row.dialogue_id,
		data: row,
	}));

	return { success: true, value: events };
}

/**
 * Export history for a dialogue
 * Creates a complete audit trail export
 *
 * @param dialogueId Dialogue ID to export
 * @param options Query options for filtering
 * @returns Result containing history export
 */
export function exportHistory(
	dialogueId: string,
	options: Omit<HistoryQueryOptions, 'dialogueId'> = {}
): Result<HistoryExport> {
	try {
		const queryResult = queryHistory({ ...options, dialogueId });

		if (!queryResult.success) {
			return queryResult;
		}

		const events = queryResult.value;

		// Calculate metadata
		const startTime = events.length > 0 ? events[0].timestamp : undefined;
		const endTime =
			events.length > 0 ? events[events.length - 1].timestamp : undefined;

		const exportData: HistoryExport = {
			dialogue_id: dialogueId,
			export_timestamp: new Date().toISOString(),
			events,
			metadata: {
				total_events: events.length,
				start_time: startTime,
				end_time: endTime,
			},
		};

		return { success: true, value: exportData };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to export history'),
		};
	}
}

/**
 * Replay history for a dialogue
 * Returns events in chronological order for state reconstruction
 *
 * @param dialogueId Dialogue ID to replay
 * @param upToTime Optional timestamp to replay up to
 * @returns Result containing chronological events
 */
export function replayHistory(
	dialogueId: string,
	upToTime?: Date
): Result<HistoryEvent[]> {
	try {
		const options: HistoryQueryOptions = {
			dialogueId,
			endTime: upToTime,
		};

		return queryHistory(options);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to replay history'),
		};
	}
}

/**
 * Get versioned state at a specific point in time
 * Reconstructs dialogue state by replaying events up to that time
 *
 * @param dialogueId Dialogue ID
 * @param timestamp Point-in-time timestamp
 * @returns Result containing versioned state
 */
export function getVersionedState(
	dialogueId: string,
	timestamp: Date
): Result<{
	claims: Claim[];
	verdicts: Verdict[];
	decisions: HumanDecision[];
}> {
	try {
		const replayResult = replayHistory(dialogueId, timestamp);

		if (!replayResult.success) {
			return replayResult;
		}

		const events = replayResult.value;

		// Extract state from events
		const claims: Claim[] = [];
		const verdicts: Verdict[] = [];
		const decisions: HumanDecision[] = [];

		for (const event of events) {
			switch (event.event_type) {
				case HistoryEventType.CLAIM:
					claims.push(event.data as Claim);
					break;
				case HistoryEventType.VERDICT:
					verdicts.push(event.data as Verdict);
					break;
				case HistoryEventType.HUMAN_DECISION:
					decisions.push(event.data as HumanDecision);
					break;
			}
		}

		return {
			success: true,
			value: {
				claims,
				verdicts,
				decisions,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get versioned state'),
		};
	}
}
