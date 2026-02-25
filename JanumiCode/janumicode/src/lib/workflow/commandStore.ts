/**
 * Workflow Command Store
 * Persists workflow command blocks and their output to the database.
 * Subscribes to workflow:command events for automatic persistence.
 * Data is read back by the data aggregator for static HTML rendering.
 */

import { getDatabase } from '../database';
import { getEventBus, type EventPayloads } from '../integration/eventBus';
import type { Result } from '../types';

// ==================== TYPES ====================

/**
 * Persisted workflow command record
 */
export interface WorkflowCommandRecord {
	command_id: string;
	dialogue_id: string;
	command_type: 'cli_invocation' | 'llm_api_call' | 'role_invocation';
	label: string;
	status: 'running' | 'success' | 'error';
	collapsed: boolean;
	started_at: string;
	completed_at: string | null;
}

/**
 * Persisted command output line
 */
export interface WorkflowCommandOutput {
	id: number;
	command_id: string;
	line_type: 'summary' | 'detail' | 'error' | 'stdin' | 'tool_input' | 'tool_output';
	tool_name: string | null;
	content: string;
	timestamp: string;
}

// ==================== WRITE OPERATIONS ====================

/**
 * Insert a new workflow command record.
 */
export function insertCommand(
	commandId: string,
	dialogueId: string,
	commandType: WorkflowCommandRecord['command_type'],
	label: string,
	startedAt: string,
	collapsed: boolean = false,
): Result<void> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		db.prepare(
			`INSERT OR IGNORE INTO workflow_commands
			 (command_id, dialogue_id, command_type, label, status, collapsed, started_at)
			 VALUES (?, ?, ?, ?, 'running', ?, ?)`
		).run(commandId, dialogueId, commandType, label, collapsed ? 1 : 0, startedAt);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to insert command'),
		};
	}
}

/**
 * Append an output line to a command block.
 */
export function appendCommandOutput(
	commandId: string,
	lineType: WorkflowCommandOutput['line_type'],
	content: string,
	timestamp: string,
	toolName?: string,
): Result<void> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		db.prepare(
			`INSERT INTO workflow_command_outputs
			 (command_id, line_type, tool_name, content, timestamp)
			 VALUES (?, ?, ?, ?, ?)`
		).run(commandId, lineType, toolName ?? null, content, timestamp);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to append command output'),
		};
	}
}

/**
 * Mark a command as complete (success or error) and update its label.
 */
export function completeCommand(
	commandId: string,
	status: 'success' | 'error',
	label?: string,
	completedAt?: string,
): Result<void> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const now = completedAt ?? new Date().toISOString();
		if (label) {
			db.prepare(
				`UPDATE workflow_commands SET status = ?, label = ?, completed_at = ? WHERE command_id = ?`
			).run(status, label, now, commandId);
		} else {
			db.prepare(
				`UPDATE workflow_commands SET status = ?, completed_at = ? WHERE command_id = ?`
			).run(status, now, commandId);
		}

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to complete command'),
		};
	}
}

// ==================== READ OPERATIONS ====================

/**
 * Get all workflow commands for a dialogue, ordered by started_at.
 */
export function getCommandsForDialogue(dialogueId: string): Result<WorkflowCommandRecord[]> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const rows = db.prepare(
			`SELECT command_id, dialogue_id, command_type, label, status,
			        collapsed, started_at, completed_at
			 FROM workflow_commands
			 WHERE dialogue_id = ?
			 ORDER BY started_at ASC`
		).all(dialogueId) as Array<Omit<WorkflowCommandRecord, 'collapsed'> & { collapsed: number }>;

		return {
			success: true,
			value: rows.map((r) => ({ ...r, collapsed: r.collapsed === 1 })),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to get commands'),
		};
	}
}

/**
 * Get output lines for a command, ordered by id (insertion order).
 */
export function getCommandOutputs(commandId: string): Result<WorkflowCommandOutput[]> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const rows = db.prepare(
			`SELECT id, command_id, line_type, tool_name, content, timestamp
			 FROM workflow_command_outputs
			 WHERE command_id = ?
			 ORDER BY id ASC`
		).all(commandId) as WorkflowCommandOutput[];

		return { success: true, value: rows };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to get command outputs'),
		};
	}
}

// ==================== EVENT BUS SUBSCRIBER ====================

let unsubscribe: (() => void) | null = null;

/**
 * Subscribe to workflow:command events and auto-persist to DB.
 * Call once during extension activation.
 * Returns an unsubscribe function.
 */
export function subscribeCommandPersistence(): () => void {
	if (unsubscribe) {
		return unsubscribe; // Already subscribed
	}

	const bus = getEventBus();

	unsubscribe = bus.on('workflow:command', (payload: EventPayloads['workflow:command']) => {
		switch (payload.action) {
			case 'start':
				insertCommand(
					payload.commandId,
					payload.dialogueId,
					payload.commandType,
					payload.label,
					payload.timestamp,
					payload.collapsed ?? false,
				);
				// Also persist initial summary as first output line
				if (payload.summary) {
					appendCommandOutput(payload.commandId, 'summary', payload.summary, payload.timestamp);
				}
				break;

			case 'output':
				if (payload.lineType === 'stdin' && payload.detail) {
					if (payload.summary) {
						appendCommandOutput(payload.commandId, 'summary', payload.summary, payload.timestamp);
					}
					appendCommandOutput(payload.commandId, 'stdin', payload.detail, payload.timestamp);
				} else {
					if (payload.summary) {
						appendCommandOutput(payload.commandId, 'summary', payload.summary, payload.timestamp);
					}
					if (payload.detail) {
						appendCommandOutput(payload.commandId, 'detail', payload.detail, payload.timestamp);
					}
				}
				break;

			case 'complete':
				completeCommand(payload.commandId, 'success', payload.label, payload.timestamp);
				if (payload.summary) {
					appendCommandOutput(payload.commandId, 'summary', payload.summary, payload.timestamp);
				}
				if (payload.detail) {
					appendCommandOutput(payload.commandId, 'detail', payload.detail, payload.timestamp);
				}
				break;

			case 'error':
				completeCommand(payload.commandId, 'error', payload.label, payload.timestamp);
				if (payload.summary) {
					appendCommandOutput(payload.commandId, 'error', payload.summary, payload.timestamp);
				}
				if (payload.detail) {
					appendCommandOutput(payload.commandId, 'error', payload.detail, payload.timestamp);
				}
				break;
		}
	});

	return unsubscribe;
}

/**
 * Unsubscribe from workflow:command events.
 */
export function unsubscribeCommandPersistence(): void {
	if (unsubscribe) {
		unsubscribe();
		unsubscribe = null;
	}
}
