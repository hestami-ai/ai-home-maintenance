/**
 * Pending MMP Decisions Store
 *
 * Persists partial MMP (Mirror & Menu Protocol) decisions to SQLite so they
 * survive VS Code restarts. Decisions are stored per (dialogue_id, card_id)
 * and deleted when the user submits the final MMP decisions.
 *
 * Used by all MMP card types: INTAKE product discovery, proposer-validator,
 * architecture gates, review gates, etc.
 */

import type { Result } from '../types';
import { getDatabase } from './index';

export interface PendingMmpDecisions {
	dialogueId: string;
	cardId: string;
	mirrorDecisions: Record<string, { status: string; editedText?: string }>;
	menuSelections: Record<string, { selectedOptionId: string; customResponse?: string }>;
	preMortemDecisions: Record<string, { status: string; rationale?: string }>;
	productEdits: Record<string, string>;
}

/**
 * Upsert pending MMP decisions for a specific card.
 * Called on every user decision change (accept/reject/defer/edit).
 */
export function savePendingMmpDecisions(
	dialogueId: string,
	cardId: string,
	decisions: {
		mirrorDecisions?: Record<string, { status: string; editedText?: string }>;
		menuSelections?: Record<string, { selectedOptionId: string; customResponse?: string }>;
		preMortemDecisions?: Record<string, { status: string; rationale?: string }>;
		productEdits?: Record<string, string>;
	}
): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		const stmt = db.prepare(`
			INSERT INTO pending_mmp_decisions (dialogue_id, card_id, mirror_decisions, menu_selections, premortem_decisions, product_edits, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
			ON CONFLICT(dialogue_id, card_id) DO UPDATE SET
				mirror_decisions = excluded.mirror_decisions,
				menu_selections = excluded.menu_selections,
				premortem_decisions = excluded.premortem_decisions,
				product_edits = excluded.product_edits,
				updated_at = datetime('now')
		`);

		stmt.run(
			dialogueId,
			cardId,
			JSON.stringify(decisions.mirrorDecisions ?? {}),
			JSON.stringify(decisions.menuSelections ?? {}),
			JSON.stringify(decisions.preMortemDecisions ?? {}),
			JSON.stringify(decisions.productEdits ?? {}),
		);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to save pending MMP decisions'),
		};
	}
}

/**
 * Get all pending MMP decisions for a dialogue.
 * Returns a map of cardId → decisions.
 */
export function getPendingMmpDecisions(
	dialogueId: string
): Result<Record<string, PendingMmpDecisions>> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		const rows = db.prepare(
			'SELECT card_id, mirror_decisions, menu_selections, premortem_decisions, product_edits FROM pending_mmp_decisions WHERE dialogue_id = ?'
		).all(dialogueId) as Array<{
			card_id: string;
			mirror_decisions: string;
			menu_selections: string;
			premortem_decisions: string;
			product_edits: string;
		}>;

		const result: Record<string, PendingMmpDecisions> = {};
		for (const row of rows) {
			result[row.card_id] = {
				dialogueId,
				cardId: row.card_id,
				mirrorDecisions: JSON.parse(row.mirror_decisions),
				menuSelections: JSON.parse(row.menu_selections),
				preMortemDecisions: JSON.parse(row.premortem_decisions),
				productEdits: JSON.parse(row.product_edits),
			};
		}

		return { success: true, value: result };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to get pending MMP decisions'),
		};
	}
}

/**
 * Delete pending MMP decisions for a specific card (after submission).
 */
export function deletePendingMmpDecisions(
	dialogueId: string,
	cardId: string
): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		db.prepare(
			'DELETE FROM pending_mmp_decisions WHERE dialogue_id = ? AND card_id = ?'
		).run(dialogueId, cardId);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to delete pending MMP decisions'),
		};
	}
}

/**
 * Delete all pending MMP decisions for a dialogue (cleanup on dialogue completion/abandon).
 */
export function deleteAllPendingMmpDecisions(
	dialogueId: string
): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		db.prepare(
			'DELETE FROM pending_mmp_decisions WHERE dialogue_id = ?'
		).run(dialogueId);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to delete all pending MMP decisions'),
		};
	}
}
