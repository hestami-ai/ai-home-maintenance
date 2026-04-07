/**
 * Handoff Document Store
 *
 * SQLite CRUD operations for canonical phase-boundary handoff documents.
 * Documents are produced by the Narrative Curator at phase transitions
 * and consumed by the Context Engineer for pre-invocation context assembly.
 */

import { randomUUID } from 'node:crypto';
import { getDatabase } from '../database/init';
import { getLogger, isLoggerInitialized } from '../logging';
import type { Result } from '../types';
import type { HandoffDocument, HandoffDocContent } from './engineTypes';
import { HandoffDocType } from './engineTypes';

// ==================== STORE ====================

/**
 * Store a new handoff document.
 */
export function storeHandoffDocument(
	dialogueId: string,
	docType: HandoffDocType,
	sourcePhase: string,
	content: HandoffDocContent,
	tokenCount: number,
	eventWatermark: number,
): Result<HandoffDocument> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		const doc: HandoffDocument = {
			doc_id: randomUUID(),
			dialogue_id: dialogueId,
			doc_type: docType,
			source_phase: sourcePhase,
			content,
			token_count: tokenCount,
			event_watermark: eventWatermark,
			created_at: new Date().toISOString(),
		};

		const stmt = db.prepare(`
			INSERT INTO handoff_documents (doc_id, dialogue_id, doc_type, source_phase, content, token_count, event_watermark, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`);

		stmt.run(
			doc.doc_id,
			doc.dialogue_id,
			doc.doc_type,
			doc.source_phase,
			JSON.stringify(doc.content),
			doc.token_count,
			doc.event_watermark,
			doc.created_at,
		);

		if (isLoggerInitialized()) {
			getLogger().info(`Stored handoff document: ${doc.doc_type} for dialogue ${dialogueId} (${tokenCount} tokens, watermark ${eventWatermark})`);
		}

		return { success: true, value: doc };
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		if (isLoggerInitialized()) {
			getLogger().warn(`Failed to store handoff document: ${error.message}`);
		}
		return { success: false, error };
	}
}

/**
 * Get the latest handoff document of a given type for a dialogue.
 */
export function getLatestHandoffDocument(
	dialogueId: string,
	docType: HandoffDocType,
): Result<HandoffDocument | null> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		const row = db.prepare(`
			SELECT doc_id, dialogue_id, doc_type, source_phase, content, token_count, event_watermark, created_at
			FROM handoff_documents
			WHERE dialogue_id = ? AND doc_type = ?
			ORDER BY created_at DESC, rowid DESC
			LIMIT 1
		`).get(dialogueId, docType) as HandoffDocRow | undefined;

		if (!row) {
			return { success: true, value: null };
		}

		return { success: true, value: rowToDocument(row) };
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		return { success: false, error };
	}
}

/**
 * Get all handoff documents for a dialogue, optionally filtered by type.
 */
export function getHandoffDocuments(
	dialogueId: string,
	docType?: HandoffDocType,
): Result<HandoffDocument[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		let rows: HandoffDocRow[];
		if (docType) {
			rows = db.prepare(`
				SELECT doc_id, dialogue_id, doc_type, source_phase, content, token_count, event_watermark, created_at
				FROM handoff_documents
				WHERE dialogue_id = ? AND doc_type = ?
				ORDER BY created_at DESC, rowid DESC
			`).all(dialogueId, docType) as HandoffDocRow[];
		} else {
			rows = db.prepare(`
				SELECT doc_id, dialogue_id, doc_type, source_phase, content, token_count, event_watermark, created_at
				FROM handoff_documents
				WHERE dialogue_id = ?
				ORDER BY created_at DESC, rowid DESC
			`).all(dialogueId) as HandoffDocRow[];
		}

		return { success: true, value: rows.map(rowToDocument) };
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		return { success: false, error };
	}
}

/**
 * Get handoff documents created after a given event watermark.
 */
export function getHandoffDocumentsSince(
	dialogueId: string,
	eventWatermark: number,
): Result<HandoffDocument[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		const rows = db.prepare(`
			SELECT doc_id, dialogue_id, doc_type, source_phase, content, token_count, event_watermark, created_at
			FROM handoff_documents
			WHERE dialogue_id = ? AND event_watermark > ?
			ORDER BY created_at DESC, rowid DESC
		`).all(dialogueId, eventWatermark) as HandoffDocRow[];

		return { success: true, value: rows.map(rowToDocument) };
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		return { success: false, error };
	}
}

/**
 * Delete all handoff documents for a dialogue (used on DB reset or re-intake).
 */
export function deleteHandoffDocuments(dialogueId: string): Result<number> {
	try {
		const db = getDatabase();
		if (!db) {
			return { success: false, error: new Error('Database not initialized') };
		}

		const result = db.prepare(`
			DELETE FROM handoff_documents WHERE dialogue_id = ?
		`).run(dialogueId);

		return { success: true, value: result.changes };
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		return { success: false, error };
	}
}

// ==================== INTERNAL ====================

interface HandoffDocRow {
	doc_id: string;
	dialogue_id: string;
	doc_type: string;
	source_phase: string;
	content: string;
	token_count: number;
	event_watermark: number;
	created_at: string;
}

function rowToDocument(row: HandoffDocRow): HandoffDocument {
	return {
		doc_id: row.doc_id,
		dialogue_id: row.dialogue_id,
		doc_type: row.doc_type as HandoffDocType,
		source_phase: row.source_phase,
		content: JSON.parse(row.content) as HandoffDocContent,
		token_count: row.token_count,
		event_watermark: row.event_watermark,
		created_at: row.created_at,
	};
}
