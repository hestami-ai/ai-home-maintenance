/**
 * Diagnostic snapshot builder.
 * Exports recent logs plus key workflow/event rows for regression triage.
 */

import type Database from 'better-sqlite3';
import {
	getActiveDatabaseConnectionMode,
	getActiveDatabaseInstanceId,
	getActiveDatabasePath,
	getDatabase,
} from '../database';
import { getLogger, isLoggerInitialized, type LogEntry } from '../logging';

export interface DiagnosticSnapshotOptions {
	logLimit?: number;
	eventLimit?: number;
	stateLimit?: number;
	transitionLimit?: number;
	pendingLimit?: number;
	dialogueId?: string;
}

export interface DiagnosticSnapshot {
	generatedAt: string;
	filters: {
		dialogueId?: string;
	};
	limits: {
		logs: number;
		dialogueEvents: number;
		workflowStates: number;
		stateTransitions: number;
		pendingMmpDecisions: number;
	};
	database: {
		connectionMode: 'direct' | 'sidecar' | 'none';
		dbPath: string | null;
		dbInstanceId: string | null;
		ready: boolean;
	};
	counts: {
		logs: number;
		dialogueEvents: number;
		workflowStates: number;
		stateTransitions: number;
		pendingMmpDecisions: number;
	};
	logs: unknown[];
	rows: {
		dialogueEvents: unknown[];
		workflowStates: unknown[];
		stateTransitions: unknown[];
		pendingMmpDecisions: unknown[];
	};
}

function toSerializable(value: unknown): unknown {
	if (value === null || value === undefined) {
		return value;
	}
	if (typeof value === 'bigint') {
		return value.toString();
	}
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack,
		};
	}
	if (Array.isArray(value)) {
		return value.map((item) => toSerializable(item));
	}
	if (typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			out[key] = toSerializable(val);
		}
		return out;
	}
	return value;
}

function queryRows(
	db: Database.Database | null,
	sql: string,
	params: unknown[]
): unknown[] {
	if (!db) {
		return [];
	}
	try {
		return (db.prepare(sql).all(...params) as unknown[]).map((row) => toSerializable(row));
	} catch {
		return [];
	}
}

function getRecentLogs(limit: number): unknown[] {
	if (!isLoggerInitialized()) {
		return [];
	}
	try {
		const entries = getLogger().getRecentEntries(limit);
		return entries.map((entry) => toSerializable(entry as LogEntry));
	} catch {
		return [];
	}
}

export function buildDiagnosticSnapshot(
	options: DiagnosticSnapshotOptions = {}
): DiagnosticSnapshot {
	const logLimit = options.logLimit ?? 200;
	const eventLimit = options.eventLimit ?? 200;
	const stateLimit = options.stateLimit ?? 100;
	const transitionLimit = options.transitionLimit ?? 200;
	const pendingLimit = options.pendingLimit ?? 100;

	const db = getDatabase();
	const dialogueId = options.dialogueId;

	const dialogueEvents = queryRows(
		db,
		dialogueId
			? `SELECT event_id, dialogue_id, event_type, role, phase, speech_act, summary, timestamp
			   FROM dialogue_events
			   WHERE dialogue_id = ?
			   ORDER BY event_id DESC
			   LIMIT ?`
			: `SELECT event_id, dialogue_id, event_type, role, phase, speech_act, summary, timestamp
			   FROM dialogue_events
			   ORDER BY event_id DESC
			   LIMIT ?`,
		dialogueId ? [dialogueId, eventLimit] : [eventLimit]
	);

	const workflowStates = queryRows(
		db,
		dialogueId
			? `SELECT state_id, dialogue_id, current_phase, previous_phase, metadata, created_at, updated_at
			   FROM workflow_states
			   WHERE dialogue_id = ?
			   ORDER BY updated_at DESC
			   LIMIT ?`
			: `SELECT state_id, dialogue_id, current_phase, previous_phase, metadata, created_at, updated_at
			   FROM workflow_states
			   ORDER BY updated_at DESC
			   LIMIT ?`,
		dialogueId ? [dialogueId, stateLimit] : [stateLimit]
	);

	const stateTransitions = queryRows(
		db,
		dialogueId
			? `SELECT st.transition_id, st.workflow_state_id, ws.dialogue_id, st.from_phase, st.to_phase, st.trigger, st.timestamp
			   FROM state_transitions st
			   JOIN workflow_states ws ON ws.state_id = st.workflow_state_id
			   WHERE ws.dialogue_id = ?
			   ORDER BY st.timestamp DESC
			   LIMIT ?`
			: `SELECT st.transition_id, st.workflow_state_id, ws.dialogue_id, st.from_phase, st.to_phase, st.trigger, st.timestamp
			   FROM state_transitions st
			   LEFT JOIN workflow_states ws ON ws.state_id = st.workflow_state_id
			   ORDER BY st.timestamp DESC
			   LIMIT ?`,
		dialogueId ? [dialogueId, transitionLimit] : [transitionLimit]
	);

	const pendingMmpDecisions = queryRows(
		db,
		dialogueId
			? `SELECT dialogue_id, card_id, updated_at
			   FROM pending_mmp_decisions
			   WHERE dialogue_id = ?
			   ORDER BY updated_at DESC
			   LIMIT ?`
			: `SELECT dialogue_id, card_id, updated_at
			   FROM pending_mmp_decisions
			   ORDER BY updated_at DESC
			   LIMIT ?`,
		dialogueId ? [dialogueId, pendingLimit] : [pendingLimit]
	);

	const logs = getRecentLogs(logLimit);

	return {
		generatedAt: new Date().toISOString(),
		filters: { dialogueId },
		limits: {
			logs: logLimit,
			dialogueEvents: eventLimit,
			workflowStates: stateLimit,
			stateTransitions: transitionLimit,
			pendingMmpDecisions: pendingLimit,
		},
		database: {
			connectionMode: getActiveDatabaseConnectionMode(),
			dbPath: getActiveDatabasePath(),
			dbInstanceId: getActiveDatabaseInstanceId(),
			ready: db !== null,
		},
		counts: {
			logs: logs.length,
			dialogueEvents: dialogueEvents.length,
			workflowStates: workflowStates.length,
			stateTransitions: stateTransitions.length,
			pendingMmpDecisions: pendingMmpDecisions.length,
		},
		logs,
		rows: {
			dialogueEvents,
			workflowStates,
			stateTransitions,
			pendingMmpDecisions,
		},
	};
}
