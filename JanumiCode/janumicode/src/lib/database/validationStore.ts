/**
 * Validation Review Data Access Layer
 *
 * CRUD operations for the validation_findings table:
 *   - Stores hypotheses, proof artifacts, and user ratings from the VALIDATE phase
 */

import { randomUUID } from 'crypto';
import { getDatabase } from './init';
import type { Result } from '../types';
import type { GradedFinding } from '../types/validate';

// ==================== HELPERS ====================

function db() {
	const instance = getDatabase();
	if (!instance) {
		throw new Error('Database not initialized');
	}
	return instance;
}

// ==================== TYPES ====================

export interface ValidationFindingRecord {
	finding_id: string;
	dialogue_id: string;
	hypothesis: string;
	category: string;
	severity: string;
	location: string;
	tool_used: string;
	proof_status: string;
	proof_artifact: string | null;
	confidence: number;
	useful_rating: number | null;
	created_at: string;
}

// ==================== WRITE OPERATIONS ====================

/**
 * Insert a graded finding into the database.
 */
export function insertFinding(
	dialogueId: string,
	finding: GradedFinding
): Result<ValidationFindingRecord> {
	try {
		const now = new Date().toISOString();
		const record: ValidationFindingRecord = {
			finding_id: finding.finding_id,
			dialogue_id: dialogueId,
			hypothesis: finding.text,
			category: finding.category,
			severity: finding.severity,
			location: finding.location,
			tool_used: finding.tool_used,
			proof_status: finding.proof_status,
			proof_artifact: finding.proof_artifact,
			confidence: finding.confidence,
			useful_rating: null,
			created_at: now,
		};

		db().prepare(`
			INSERT INTO validation_findings
				(finding_id, dialogue_id, hypothesis, category, severity, location,
				 tool_used, proof_status, proof_artifact, confidence, useful_rating, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
		`).run(
			record.finding_id, record.dialogue_id, record.hypothesis, record.category,
			record.severity, record.location, record.tool_used, record.proof_status,
			record.proof_artifact, record.confidence, record.created_at
		);

		return { success: true, value: record };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Bulk insert all graded findings for a dialogue in a single transaction.
 */
export function insertFindings(
	dialogueId: string,
	findings: GradedFinding[]
): Result<void> {
	try {
		const txn = db().transaction(() => {
			for (const finding of findings) {
				insertFinding(dialogueId, finding);
			}
		});
		txn();
		return { success: true, value: undefined };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Update the useful_rating for a finding.
 */
export function updateFindingRating(
	findingId: string,
	useful: boolean
): Result<void> {
	try {
		db().prepare(`
			UPDATE validation_findings SET useful_rating = ? WHERE finding_id = ?
		`).run(useful ? 1 : 0, findingId);

		return { success: true, value: undefined };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

// ==================== READ OPERATIONS ====================

/**
 * Get all findings for a dialogue, ordered by confidence descending.
 */
export function getFindingsForDialogue(
	dialogueId: string
): Result<ValidationFindingRecord[]> {
	try {
		const rows = db().prepare(`
			SELECT * FROM validation_findings
			WHERE dialogue_id = ?
			ORDER BY confidence DESC, created_at ASC
		`).all(dialogueId) as ValidationFindingRecord[];

		return { success: true, value: rows };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get findings that are proven or probable (not disproven/error) for a dialogue.
 */
export function getActiveFindings(
	dialogueId: string
): Result<ValidationFindingRecord[]> {
	try {
		const rows = db().prepare(`
			SELECT * FROM validation_findings
			WHERE dialogue_id = ? AND proof_status IN ('proven', 'probable')
			ORDER BY confidence DESC, created_at ASC
		`).all(dialogueId) as ValidationFindingRecord[];

		return { success: true, value: rows };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Get a single finding by ID.
 */
export function getFinding(findingId: string): Result<ValidationFindingRecord | null> {
	try {
		const row = db().prepare(
			`SELECT * FROM validation_findings WHERE finding_id = ?`
		).get(findingId) as ValidationFindingRecord | undefined;

		return { success: true, value: row ?? null };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}

/**
 * Generate a new finding_id (UUID).
 */
export function newFindingId(): string {
	return randomUUID();
}
