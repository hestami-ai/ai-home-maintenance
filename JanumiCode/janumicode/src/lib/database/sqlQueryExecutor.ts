/**
 * SQL Query Executor
 *
 * Safe, read-only SQL execution for the text-to-SQL Tier 3 query path.
 * Validates LLM-generated SQL, executes it against the dialogue database,
 * and formats results for consumption by a second LLM pass.
 */

import { getDatabase } from './init';
import { getLogger, isLoggerInitialized } from '../logging';

// ==================== TYPES ====================

export interface SqlQueryResult {
	success: boolean;
	rows: Record<string, unknown>[];
	rowCount: number;
	truncated: boolean;
	formattedResult: string;
	error?: string;
}

// ==================== VALIDATION ====================

/**
 * Dangerous SQL keywords that should never appear in a read-only query.
 * Word-boundary matched to avoid false positives (e.g., "description" contains "INTO"? No — \bINTO\b won't match).
 */
const DANGEROUS_KEYWORDS = /\b(INSERT\s+INTO|CREATE|DROP|ALTER|ATTACH|DETACH|LOAD_EXTENSION|PRAGMA|VACUUM|REINDEX|DELETE|UPDATE|REPLACE)\b/i;

/**
 * Validate that the SQL is a safe, read-only SELECT scoped to the dialogue.
 */
function validateSql(sql: string, dialogueId: string): { valid: boolean; error?: string } {
	const trimmed = sql.trim();

	// 1. Must start with SELECT or WITH (for CTEs)
	const firstToken = trimmed.split(/\s+/)[0].toUpperCase();
	if (firstToken !== 'SELECT' && firstToken !== 'WITH') {
		return { valid: false, error: `SQL must start with SELECT or WITH, got: ${firstToken}` };
	}

	// 2. No dangerous keywords
	if (DANGEROUS_KEYWORDS.test(trimmed)) {
		const match = trimmed.match(DANGEROUS_KEYWORDS);
		return { valid: false, error: `SQL contains forbidden keyword: ${match?.[1]}` };
	}

	// 3. No multi-statement (semicolon followed by non-whitespace)
	const semiIndex = trimmed.indexOf(';');
	if (semiIndex !== -1 && semiIndex < trimmed.length - 1) {
		const afterSemi = trimmed.substring(semiIndex + 1).trim();
		if (afterSemi.length > 0) {
			return { valid: false, error: 'Multi-statement SQL is not allowed' };
		}
	}

	// 4. Must reference the dialogue_id (scoping enforcement)
	if (!trimmed.includes(dialogueId)) {
		return { valid: false, error: 'SQL must be scoped to the current dialogue_id' };
	}

	return { valid: true };
}

/**
 * Enforce row limits on the SQL.
 * - If no LIMIT clause, append LIMIT maxRows.
 * - If LIMIT > cap, replace with cap.
 */
function enforceLimits(sql: string, maxRows: number, cap: number): string {
	let trimmed = sql.trim();
	// Remove trailing semicolon for manipulation
	if (trimmed.endsWith(';')) {
		trimmed = trimmed.slice(0, -1).trim();
	}

	const limitMatch = trimmed.match(/\bLIMIT\s+(\d+)\s*$/i);
	if (!limitMatch) {
		return trimmed + ` LIMIT ${maxRows}`;
	}

	const limitValue = parseInt(limitMatch[1], 10);
	if (limitValue > cap) {
		return trimmed.replace(/\bLIMIT\s+\d+\s*$/i, `LIMIT ${cap}`);
	}

	return trimmed;
}

// ==================== RESULT FORMATTING ====================

/**
 * Format query result rows as a pipe-delimited table for LLM consumption.
 */
function formatResultsAsTable(rows: Record<string, unknown>[], maxChars: number): { text: string; truncated: boolean } {
	if (rows.length === 0) {
		return { text: '(No results)', truncated: false };
	}

	const columns = Object.keys(rows[0]);
	const lines: string[] = [];

	// Header
	lines.push('| ' + columns.join(' | ') + ' |');
	lines.push('| ' + columns.map(() => '---').join(' | ') + ' |');

	// Rows
	let totalChars = lines.join('\n').length;
	let truncated = false;

	for (const row of rows) {
		const values = columns.map(col => {
			const val = row[col];
			if (val === null || val === undefined) return '';
			const str = String(val);
			// Truncate individual cell values that are very long
			return str.length > 200 ? str.substring(0, 197) + '...' : str;
		});
		const line = '| ' + values.join(' | ') + ' |';

		if (totalChars + line.length + 1 > maxChars) {
			truncated = true;
			break;
		}
		lines.push(line);
		totalChars += line.length + 1;
	}

	return { text: lines.join('\n'), truncated };
}

// ==================== EXECUTION ====================

/**
 * Execute an LLM-generated SQL query safely against the dialogue database.
 *
 * Validates the SQL for safety (SELECT-only, dialogue-scoped, no dangerous keywords),
 * enforces row limits, executes it, and formats the results as a pipe-delimited table.
 *
 * @param sql The SQL query string (expected to be a SELECT)
 * @param dialogueId The active dialogue ID (used for scope validation)
 * @param maxRows Maximum rows to return (default 50)
 * @param maxChars Maximum characters in formatted output (default 4000)
 * @returns SqlQueryResult with formatted results or error
 */
export function executeSafeQuery(
	sql: string,
	dialogueId: string,
	maxRows = 50,
	maxChars = 4000,
): SqlQueryResult {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'sqlQueryExecutor' })
		: null;

	// Validate
	const validation = validateSql(sql, dialogueId);
	if (!validation.valid) {
		log?.warn('SQL validation failed', { error: validation.error, sql: sql.substring(0, 200) });
		return {
			success: false,
			rows: [],
			rowCount: 0,
			truncated: false,
			formattedResult: '',
			error: validation.error,
		};
	}

	// Enforce limits
	const limitedSql = enforceLimits(sql, maxRows, 100);

	// Execute
	try {
		const db = getDatabase();
		if (!db) { return { success: false, rows: [], rowCount: 0, truncated: false, formattedResult: '', error: 'Database not initialized' }; }
		const rows = db.prepare(limitedSql).all() as Record<string, unknown>[];

		log?.debug('SQL query executed', { rowCount: rows.length, sql: limitedSql.substring(0, 200) });

		// Format
		const { text, truncated } = formatResultsAsTable(rows, maxChars);

		return {
			success: true,
			rows,
			rowCount: rows.length,
			truncated,
			formattedResult: truncated
				? text + `\n(Results truncated — ${rows.length} rows returned, output limit reached)`
				: text,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown SQL execution error';
		log?.warn('SQL execution failed', { error: message, sql: limitedSql.substring(0, 200) });
		return {
			success: false,
			rows: [],
			rowCount: 0,
			truncated: false,
			formattedResult: '',
			error: message,
		};
	}
}
