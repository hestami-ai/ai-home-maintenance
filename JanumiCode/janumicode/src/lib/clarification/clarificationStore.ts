/**
 * Clarification Store
 * Persists inline "Ask More" conversation threads to the database
 * so they survive re-renders and are available for future agent/human context.
 */

import { getDatabase } from '../database/init';

export interface ClarificationMessage {
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
}

export interface ClarificationThread {
	itemId: string;
	itemContext: string;
	messages: ClarificationMessage[];
}

/**
 * Save (upsert) a clarification thread for a specific item in a dialogue.
 */
export function saveClarificationThread(
	dialogueId: string,
	itemId: string,
	itemContext: string,
	messages: ClarificationMessage[],
): void {
	try {
		const db = getDatabase();
		if (!db) return;

		const messagesJson = JSON.stringify(messages);

		db.prepare(`
			INSERT INTO clarification_threads (dialogue_id, item_id, item_context, messages, updated_at)
			VALUES (?, ?, ?, ?, datetime('now'))
			ON CONFLICT(dialogue_id, item_id) DO UPDATE SET
				messages = excluded.messages,
				updated_at = datetime('now')
		`).run(dialogueId, itemId, itemContext, messagesJson);
	} catch {
		// Table may not exist if V13 migration hasn't been applied yet
	}
}

/**
 * Load all clarification threads for a dialogue.
 */
export function getClarificationThreads(dialogueId: string): ClarificationThread[] {
	try {
		const db = getDatabase();
		if (!db) return [];

		const rows = db.prepare(
			'SELECT item_id, item_context, messages FROM clarification_threads WHERE dialogue_id = ?'
		).all(dialogueId) as Array<{ item_id: string; item_context: string; messages: string }>;

		return rows.map((row) => ({
			itemId: row.item_id,
			itemContext: row.item_context,
			messages: JSON.parse(row.messages) as ClarificationMessage[],
		}));
	} catch {
		return [];
	}
}
