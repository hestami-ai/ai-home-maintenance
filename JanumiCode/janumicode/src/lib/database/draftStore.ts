/**
 * Webview Draft Store
 *
 * Persists in-progress user inputs (gate rationales, intake responses,
 * verification/review rationales, file attachments, etc.) to SQLite so they
 * survive VS Code restarts and webview re-renders.
 *
 * Drafts are stored per (dialogue_id, category, item_key) and deleted
 * when the user submits the corresponding form (gate decision, intake response, etc.).
 */

import type { Result } from '../types';
import { getDatabase } from './index';
import { getLogger, isLoggerInitialized } from '../logging';

const log = isLoggerInitialized() ? getLogger().child({ component: 'draftStore' }) : undefined;

export interface DraftEntry {
	category: string;
	itemKey: string;
	value: string;
}

/**
 * Upsert a batch of drafts for a dialogue.
 * Called on every user input change (debounced from the webview).
 */
export function saveDraftsBatch(
	dialogueId: string,
	drafts: DraftEntry[]
): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		const stmt = db.prepare(`
			INSERT INTO webview_drafts (dialogue_id, category, item_key, value, updated_at)
			VALUES (?, ?, ?, ?, datetime('now'))
			ON CONFLICT(dialogue_id, category, item_key) DO UPDATE SET
				value = excluded.value,
				updated_at = excluded.updated_at
		`);

		const transaction = db.transaction(() => {
			for (const draft of drafts) {
				stmt.run(dialogueId, draft.category, draft.itemKey, draft.value);
			}
		});
		transaction();

		return { success: true, value: undefined };
	} catch (error) {
		log?.warn('saveDraftsBatch failed', { error: error instanceof Error ? error.message : String(error) });
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get all drafts for a dialogue, grouped by category.
 * Returns: Record<category, Record<itemKey, value>>
 */
export function getDrafts(
	dialogueId: string
): Result<Record<string, Record<string, string>>> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		const rows = db.prepare(
			'SELECT category, item_key, value FROM webview_drafts WHERE dialogue_id = ?'
		).all(dialogueId) as Array<{ category: string; item_key: string; value: string }>;

		const grouped: Record<string, Record<string, string>> = {};
		for (const row of rows) {
			if (!grouped[row.category]) {
				grouped[row.category] = {};
			}
			grouped[row.category][row.item_key] = row.value;
		}

		return { success: true, value: grouped };
	} catch (error) {
		log?.warn('getDrafts failed', { error: error instanceof Error ? error.message : String(error) });
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Delete all drafts for a dialogue (e.g., when dialogue completes or user clears data).
 */
export function deleteAllDrafts(dialogueId: string): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		db.prepare('DELETE FROM webview_drafts WHERE dialogue_id = ?').run(dialogueId);
		return { success: true, value: undefined };
	} catch (error) {
		log?.warn('deleteAllDrafts failed', { error: error instanceof Error ? error.message : String(error) });
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Delete drafts for a specific category (e.g., clear gate rationales after gate submission).
 */
export function deleteDraftsByCategory(
	dialogueId: string,
	category: string
): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		db.prepare(
			'DELETE FROM webview_drafts WHERE dialogue_id = ? AND category = ?'
		).run(dialogueId, category);
		return { success: true, value: undefined };
	} catch (error) {
		log?.warn('deleteDraftsByCategory failed', { error: error instanceof Error ? error.message : String(error) });
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}
