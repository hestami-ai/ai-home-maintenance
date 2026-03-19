/**
 * Document Store
 *
 * SQLite persistence for generated documents. Documents are ephemeral —
 * stored in the database for display, and can be exported to disk on demand.
 * Upserts on (dialogue_id, document_type) so re-generating replaces the
 * previous version.
 */

import { getDatabase } from '../database/index.js';
import type { Result } from '../types/index.js';
import type { GeneratedDocument, DocumentType } from './types.js';

// ==================== WRITE ====================

/**
 * Insert or replace a generated document.
 * Upserts on (dialogue_id, document_type).
 */
export function upsertGeneratedDocument(
	dialogueId: string,
	documentType: DocumentType,
	title: string,
	content: string,
): Result<GeneratedDocument> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const stmt = db.prepare(`
			INSERT INTO generated_documents (dialogue_id, document_type, title, content, created_at)
			VALUES (?, ?, ?, ?, datetime('now'))
			ON CONFLICT(dialogue_id, document_type)
			DO UPDATE SET title = excluded.title, content = excluded.content, created_at = datetime('now')
		`);
		stmt.run(dialogueId, documentType, title, content);

		// Fetch the upserted row
		const row = db.prepare(
			'SELECT * FROM generated_documents WHERE dialogue_id = ? AND document_type = ?'
		).get(dialogueId, documentType) as GeneratedDocumentRow | undefined;

		if (!row) {
			return { success: false, error: new Error('Failed to read back upserted document') };
		}

		return { success: true, value: hydrateRow(row) };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to upsert generated document'),
		};
	}
}

// ==================== READ ====================

/**
 * Get a specific generated document by dialogue and type.
 */
export function getGeneratedDocument(
	dialogueId: string,
	documentType: DocumentType,
): Result<GeneratedDocument | null> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const row = db.prepare(
			'SELECT * FROM generated_documents WHERE dialogue_id = ? AND document_type = ?'
		).get(dialogueId, documentType) as GeneratedDocumentRow | undefined;

		return { success: true, value: row ? hydrateRow(row) : null };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to get generated document'),
		};
	}
}

/**
 * Get all generated documents for a dialogue.
 */
export function getDocumentsForDialogue(
	dialogueId: string,
): Result<GeneratedDocument[]> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const rows = db.prepare(
			'SELECT * FROM generated_documents WHERE dialogue_id = ? ORDER BY created_at DESC'
		).all(dialogueId) as GeneratedDocumentRow[];

		return { success: true, value: rows.map(hydrateRow) };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to list generated documents'),
		};
	}
}

// ==================== DELETE ====================

/**
 * Delete a specific generated document.
 */
export function deleteGeneratedDocument(
	dialogueId: string,
	documentType: DocumentType,
): Result<void> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		db.prepare(
			'DELETE FROM generated_documents WHERE dialogue_id = ? AND document_type = ?'
		).run(dialogueId, documentType);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to delete generated document'),
		};
	}
}

// ==================== INTERNAL ====================

interface GeneratedDocumentRow {
	id: number;
	dialogue_id: string;
	document_type: string;
	title: string;
	content: string;
	created_at: string;
}

function hydrateRow(row: GeneratedDocumentRow): GeneratedDocument {
	return {
		id: row.id,
		dialogue_id: row.dialogue_id,
		document_type: row.document_type as DocumentType,
		title: row.title,
		content: row.content,
		created_at: row.created_at,
	};
}
