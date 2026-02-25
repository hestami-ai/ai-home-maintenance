/**
 * Dialogue Lifecycle Management
 * Tracks dialogue status (ACTIVE, COMPLETED, ABANDONED) in the `dialogues` table
 * for multi-dialogue stream support.
 */

import type { Result } from '../types';
import { getDatabase } from '../database';

/**
 * A row from the dialogues table
 */
export interface DialogueRecord {
	dialogue_id: string;
	goal: string;
	status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
	created_at: string;
	completed_at: string | null;
	title: string | null;
}

/**
 * Insert a new dialogue record with ACTIVE status.
 */
export function createDialogueRecord(
	dialogueId: string,
	goal: string
): Result<void> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		db.prepare(
			`INSERT INTO dialogues (dialogue_id, goal, status, created_at)
			 VALUES (?, ?, 'ACTIVE', datetime('now'))`
		).run(dialogueId, goal);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to create dialogue record'),
		};
	}
}

/**
 * Mark a dialogue as COMPLETED.
 */
export function completeDialogue(dialogueId: string): Result<void> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		db.prepare(
			`UPDATE dialogues SET status = 'COMPLETED', completed_at = datetime('now')
			 WHERE dialogue_id = ?`
		).run(dialogueId);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to complete dialogue'),
		};
	}
}

/**
 * Mark a dialogue as ABANDONED.
 */
export function abandonDialogue(dialogueId: string): Result<void> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		db.prepare(
			`UPDATE dialogues SET status = 'ABANDONED', completed_at = datetime('now')
			 WHERE dialogue_id = ?`
		).run(dialogueId);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to abandon dialogue'),
		};
	}
}

/**
 * Resume an ABANDONED dialogue by setting it back to ACTIVE.
 * Only ABANDONED dialogues can be resumed; COMPLETED is final.
 */
export function resumeDialogue(dialogueId: string): Result<void> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const result = db
			.prepare(
				`UPDATE dialogues SET status = 'ACTIVE', completed_at = NULL
				 WHERE dialogue_id = ? AND status = 'ABANDONED'`
			)
			.run(dialogueId);

		if ((result as { changes: number }).changes === 0) {
			return {
				success: false,
				error: new Error(
					'Dialogue not found or not in ABANDONED status'
				),
			};
		}

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to resume dialogue'),
		};
	}
}

/**
 * Update the title of a dialogue.
 */
export function updateDialogueTitle(
	dialogueId: string,
	title: string
): Result<void> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		db.prepare(`UPDATE dialogues SET title = ? WHERE dialogue_id = ?`).run(
			title,
			dialogueId
		);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to update dialogue title'),
		};
	}
}

/**
 * Get the most recent ACTIVE dialogue, if any.
 */
export function getActiveDialogue(): Result<DialogueRecord | null> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const row = db
			.prepare(
				`SELECT * FROM dialogues WHERE status = 'ACTIVE'
				 ORDER BY created_at DESC LIMIT 1`
			)
			.get() as DialogueRecord | undefined;

		return { success: true, value: row ?? null };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get active dialogue'),
		};
	}
}

/**
 * Get all dialogues ordered by creation time (oldest first).
 */
export function getAllDialogues(
	limit: number = 50
): Result<DialogueRecord[]> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const rows = db
			.prepare(
				`SELECT * FROM dialogues ORDER BY created_at ASC LIMIT ?`
			)
			.all(limit) as DialogueRecord[];

		return { success: true, value: rows };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get dialogues'),
		};
	}
}
