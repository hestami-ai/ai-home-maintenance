/**
 * FTS5 Full-Text Search Sync
 *
 * Provides functions to index content into the FTS5 virtual table
 * and search it with BM25 ranking. Used by the Tier 3b escalation layer.
 *
 * The FTS5 table is created by migration V14.
 */

import { getDatabase } from './init';

// ==================== TYPES ====================

export interface FTSResult {
	sourceTable: string;
	sourceId: string;
	snippet: string;
	rank: number;
}

// ==================== INDEXING ====================

/**
 * Index a single content row into the FTS5 table.
 * Fire-and-forget — errors are silently swallowed to avoid blocking callers.
 */
export function indexContent(
	sourceTable: string,
	sourceId: string,
	dialogueId: string,
	content: string,
): void {
	try {
		const db = getDatabase();
		if (!db || !content?.trim()) { return; }

		// Check if FTS table exists (migration may not have run yet)
		const tableCheck = db.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='fts_stream_content'"
		).get();
		if (!tableCheck) { return; }

		db.prepare(
			'INSERT INTO fts_stream_content (content, source_table, source_id, dialogue_id) VALUES (?, ?, ?, ?)'
		).run(content, sourceTable, sourceId, dialogueId);
	} catch {
		// Silently ignore — FTS is best-effort
	}
}

/**
 * Bulk-index all existing content for a dialogue (backfill).
 * Called when FTS is first enabled or after migration.
 */
export function indexDialogue(dialogueId: string): void {
	try {
		const db = getDatabase();
		if (!db) { return; }

		const tableCheck = db.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='fts_stream_content'"
		).get();
		if (!tableCheck) { return; }

		// Clear existing FTS entries for this dialogue to avoid duplicates
		db.prepare('DELETE FROM fts_stream_content WHERE dialogue_id = ?').run(dialogueId);

		// Index command outputs (executor streaming output)
		const outputs = db.prepare(`
			SELECT o.rowid as id, o.content, o.command_id
			FROM workflow_command_outputs o
			JOIN workflow_commands c ON o.command_id = c.command_id
			WHERE c.dialogue_id = ? AND o.content IS NOT NULL AND o.content != ''
		`).all(dialogueId) as Array<{ id: number; content: string; command_id: string }>;

		for (const row of outputs) {
			db.prepare(
				'INSERT INTO fts_stream_content (content, source_table, source_id, dialogue_id) VALUES (?, ?, ?, ?)'
			).run(row.content, 'workflow_command_outputs', String(row.id), dialogueId);
		}

		// Index CLI activity events
		const events = db.prepare(`
			SELECT event_id, summary, detail FROM cli_activity_events
			WHERE dialogue_id = ?
		`).all(dialogueId) as Array<{ event_id: string; summary: string; detail: string | null }>;

		for (const ev of events) {
			const text = ev.detail ? `${ev.summary} ${ev.detail}` : ev.summary;
			if (text?.trim()) {
				db.prepare(
					'INSERT INTO fts_stream_content (content, source_table, source_id, dialogue_id) VALUES (?, ?, ?, ?)'
				).run(text, 'cli_activity_events', ev.event_id, dialogueId);
			}
		}

		// Index claims
		const claims = db.prepare(
			'SELECT claim_id, statement FROM claims WHERE dialogue_id = ? AND statement IS NOT NULL'
		).all(dialogueId) as Array<{ claim_id: string; statement: string }>;

		for (const claim of claims) {
			if (claim.statement?.trim()) {
				db.prepare(
					'INSERT INTO fts_stream_content (content, source_table, source_id, dialogue_id) VALUES (?, ?, ?, ?)'
				).run(claim.statement, 'claims', claim.claim_id, dialogueId);
			}
		}

		// Index verdicts
		const verdicts = db.prepare(`
			SELECT v.verdict_id, v.rationale FROM verdicts v
			JOIN claims c ON v.claim_id = c.claim_id
			WHERE c.dialogue_id = ? AND v.rationale IS NOT NULL
		`).all(dialogueId) as Array<{ verdict_id: string; rationale: string }>;

		for (const verdict of verdicts) {
			if (verdict.rationale?.trim()) {
				db.prepare(
					'INSERT INTO fts_stream_content (content, source_table, source_id, dialogue_id) VALUES (?, ?, ?, ?)'
				).run(verdict.rationale, 'verdicts', verdict.verdict_id, dialogueId);
			}
		}

		// Index open loops
		const loops = db.prepare(`
			SELECT loop_id, description FROM open_loops WHERE dialogue_id = ? AND description IS NOT NULL
		`).all(dialogueId) as Array<{ loop_id: string; description: string }>;

		for (const loop of loops) {
			if (loop.description?.trim()) {
				db.prepare(
					'INSERT INTO fts_stream_content (content, source_table, source_id, dialogue_id) VALUES (?, ?, ?, ?)'
				).run(loop.description, 'open_loops', loop.loop_id, dialogueId);
			}
		}
	} catch {
		// Silently ignore — FTS backfill is best-effort
	}
}

// ==================== SEARCH ====================

/**
 * Search the FTS5 index with BM25 ranking.
 * Returns matching rows with snippets highlighted with >>> and <<<.
 */
export function searchStreamContent(
	query: string,
	dialogueId: string,
	limit: number = 10,
): FTSResult[] {
	try {
		const db = getDatabase();
		if (!db || !query?.trim()) { return []; }

		const tableCheck = db.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='fts_stream_content'"
		).get();
		if (!tableCheck) { return []; }

		// Sanitize query for FTS5 — escape special characters
		const sanitized = query.replace(/['"*()]/g, ' ').trim();
		if (!sanitized) { return []; }

		const rows = db.prepare(`
			SELECT source_table, source_id,
				snippet(fts_stream_content, 0, '>>>', '<<<', '...', 32) as snippet,
				rank
			FROM fts_stream_content
			WHERE fts_stream_content MATCH ? AND dialogue_id = ?
			ORDER BY rank
			LIMIT ?
		`).all(sanitized, dialogueId, limit) as Array<{
			source_table: string;
			source_id: string;
			snippet: string;
			rank: number;
		}>;

		return rows.map(row => ({
			sourceTable: row.source_table,
			sourceId: row.source_id,
			snippet: row.snippet,
			rank: row.rank,
		}));
	} catch {
		return [];
	}
}
