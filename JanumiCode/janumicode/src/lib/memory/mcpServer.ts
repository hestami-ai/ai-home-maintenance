/**
 * Deep Memory MCP Server
 *
 * A lightweight Model Context Protocol server over JSON-RPC/stdio.
 * Exposes 7 tools for querying the memory substrate (memory_objects, memory_edges)
 * via the existing better-sqlite3 database.
 *
 * Can be used as:
 *   - Imported: `startMcpServer()` from another module
 *   - Standalone: `node mcpServer.js`
 */

import * as readline from 'node:readline';
import { getDatabase } from '../database/init';
import type Database from 'better-sqlite3';

/**
 * Module-level database override. When the MCP server runs as a standalone
 * process (via `node mcpServer.js`), it opens its own read-only connection
 * instead of using the extension host's singleton from getDatabase().
 */
let standaloneDb: Database.Database | null = null;

// ==================== JSON-RPC Types ====================

interface JsonRpcRequest {
	jsonrpc: '2.0';
	id: number | string | null;
	method: string;
	params?: Record<string, unknown>;
}

interface JsonRpcResponse {
	jsonrpc: '2.0';
	id: number | string | null;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

// ==================== MCP Tool Definitions ====================

interface McpToolDefinition {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

const TOOL_DEFINITIONS: McpToolDefinition[] = [
	{
		name: 'check_health',
		description: 'Verify DB connection and return table counts for memory_objects, memory_edges, and memory_extraction_runs.',
		inputSchema: {
			type: 'object',
			properties: {},
			additionalProperties: false,
		},
	},
	{
		name: 'search_memory_candidates',
		description: 'FTS5 full-text search on memory content with LIKE fallback. Returns matching memory objects.',
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'Search query string' },
				object_types: {
					type: 'array',
					items: { type: 'string' },
					description: 'Filter by object_type values (optional)',
				},
				limit: { type: 'number', description: 'Maximum results (default 20)' },
				time_after: { type: 'string', description: 'ISO-8601 lower bound on event_at (optional)' },
				time_before: { type: 'string', description: 'ISO-8601 upper bound on event_at (optional)' },
			},
			required: ['query'],
			additionalProperties: false,
		},
	},
	{
		name: 'expand_memory_neighbors',
		description: 'BFS expansion from a memory object through the memory_edges graph. Returns connected objects and edges.',
		inputSchema: {
			type: 'object',
			properties: {
				objectId: { type: 'string', description: 'Starting memory object ID' },
				edgeTypes: {
					type: 'array',
					items: { type: 'string' },
					description: 'Filter by edge_type values (optional)',
				},
				depth: { type: 'number', description: 'BFS depth limit (default 2, max 5)' },
			},
			required: ['objectId'],
			additionalProperties: false,
		},
	},
	{
		name: 'load_evidence_span',
		description: 'Load a single row from an allowlisted evidence table by primary key.',
		inputSchema: {
			type: 'object',
			properties: {
				table: { type: 'string', description: 'Table name (must be allowlisted)' },
				id: { type: 'string', description: 'Primary key value' },
			},
			required: ['table', 'id'],
			additionalProperties: false,
		},
	},
	{
		name: 'get_supersession_chain',
		description: 'Follow the superseded_by chain from a memory object to find all versions.',
		inputSchema: {
			type: 'object',
			properties: {
				objectId: { type: 'string', description: 'Starting memory object ID' },
			},
			required: ['objectId'],
			additionalProperties: false,
		},
	},
	{
		name: 'get_conflict_set',
		description: 'Find all memory objects connected by "contradicts" edges to the given object.',
		inputSchema: {
			type: 'object',
			properties: {
				objectId: { type: 'string', description: 'Memory object ID to find conflicts for' },
			},
			required: ['objectId'],
			additionalProperties: false,
		},
	},
	{
		name: 'temporal_query',
		description: 'Query memory objects filtered by time range and optional object type.',
		inputSchema: {
			type: 'object',
			properties: {
				since: { type: 'string', description: 'ISO-8601 lower bound (optional)' },
				until: { type: 'string', description: 'ISO-8601 upper bound (optional)' },
				objectType: { type: 'string', description: 'Filter by object_type (optional)' },
			},
			additionalProperties: false,
		},
	},
];

// ==================== Allowlisted Tables ====================

const EVIDENCE_TABLES: Record<string, string> = {
	dialogue_events: 'event_id',
	claims: 'claim_id',
	verdicts: 'verdict_id',
	workflow_commands: 'command_id',
	workflow_command_outputs: 'output_id',
	intake_conversations: 'conversation_id',
	architecture_documents: 'doc_id',
};

// ==================== Tool Implementations ====================

function requireDb(): Database.Database {
	// Prefer standalone connection (when running as a separate process)
	if (standaloneDb) { return standaloneDb; }
	// Fall back to extension host singleton (when imported in-process)
	const db = getDatabase();
	if (!db) {
		throw new Error('Database not initialized');
	}
	return db;
}

function tableCount(db: Database.Database, table: string): number {
	try {
		const row = db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as { cnt: number } | undefined;
		return row?.cnt ?? 0;
	} catch {
		return 0;
	}
}

function checkHealth(): Record<string, unknown> {
	const db = requireDb();
	return {
		status: 'ok',
		tables: {
			memory_objects: tableCount(db, 'memory_objects'),
			memory_edges: tableCount(db, 'memory_edges'),
			memory_extraction_runs: tableCount(db, 'memory_extraction_runs'),
		},
	};
}

function searchMemoryCandidates(params: Record<string, unknown>): unknown[] {
	const db = requireDb();
	const query = params.query as string;
	const objectTypes = params.object_types as string[] | undefined;
	const limit = Math.min((params.limit as number) || 20, 100);
	const timeAfter = params.time_after as string | undefined;
	const timeBefore = params.time_before as string | undefined;

	// Try FTS5 first
	let results: unknown[] = [];
	try {
		results = ftsSearch(db, query, objectTypes, limit, timeAfter, timeBefore);
	} catch {
		// FTS5 table may not exist; fall through to LIKE
	}

	// LIKE fallback if FTS returned nothing
	if (results.length === 0) {
		results = likeSearch(db, query, objectTypes, limit, timeAfter, timeBefore);
	}

	return results;
}

function ftsSearch(
	db: Database.Database,
	query: string,
	objectTypes: string[] | undefined,
	limit: number,
	timeAfter: string | undefined,
	timeBefore: string | undefined,
): unknown[] {
	// fts_stream_content is the general FTS table; check if memory_objects are indexed there.
	// We join against memory_objects to filter by object_type and time range.
	// If there's no dedicated memory FTS, we search memory_objects.content via the general FTS table.
	let sql = `
		SELECT mo.*
		FROM memory_objects mo
		WHERE mo.object_id IN (
			SELECT fts.source_id FROM fts_stream_content fts
			WHERE fts.source_table = 'memory_objects'
			AND fts.content MATCH ?
		)
	`;
	const sqlParams: unknown[] = [query];

	if (objectTypes && objectTypes.length > 0) {
		const placeholders = objectTypes.map(() => '?').join(', ');
		sql += ` AND mo.object_type IN (${placeholders})`;
		sqlParams.push(...objectTypes);
	}
	if (timeAfter) {
		sql += ' AND mo.event_at >= ?';
		sqlParams.push(timeAfter);
	}
	if (timeBefore) {
		sql += ' AND mo.event_at <= ?';
		sqlParams.push(timeBefore);
	}
	sql += ' ORDER BY mo.recorded_at DESC LIMIT ?';
	sqlParams.push(limit);

	return db.prepare(sql).all(...sqlParams);
}

function likeSearch(
	db: Database.Database,
	query: string,
	objectTypes: string[] | undefined,
	limit: number,
	timeAfter: string | undefined,
	timeBefore: string | undefined,
): unknown[] {
	let sql = 'SELECT * FROM memory_objects WHERE content LIKE ?';
	const sqlParams: unknown[] = [`%${query}%`];

	if (objectTypes && objectTypes.length > 0) {
		const placeholders = objectTypes.map(() => '?').join(', ');
		sql += ` AND object_type IN (${placeholders})`;
		sqlParams.push(...objectTypes);
	}
	if (timeAfter) {
		sql += ' AND event_at >= ?';
		sqlParams.push(timeAfter);
	}
	if (timeBefore) {
		sql += ' AND event_at <= ?';
		sqlParams.push(timeBefore);
	}
	sql += ' ORDER BY recorded_at DESC LIMIT ?';
	sqlParams.push(limit);

	return db.prepare(sql).all(...sqlParams);
}

interface EdgeRow {
	from_object_id: string;
	to_object_id: string;
}

function queryEdgesForNode(
	db: Database.Database,
	nodeId: string,
	edgeTypes: string[] | undefined,
): EdgeRow[] {
	let sql = `
		SELECT * FROM memory_edges
		WHERE from_object_id = ? OR to_object_id = ?
	`;
	const sqlParams: unknown[] = [nodeId, nodeId];

	if (edgeTypes && edgeTypes.length > 0) {
		const placeholders = edgeTypes.map(() => '?').join(', ');
		sql += ` AND edge_type IN (${placeholders})`;
		sqlParams.push(...edgeTypes);
	}

	return db.prepare(sql).all(...sqlParams) as EdgeRow[];
}

function collectNeighbors(
	edges: EdgeRow[],
	nodeId: string,
	visited: Set<string>,
): string[] {
	const neighbors: string[] = [];
	for (const edge of edges) {
		const neighborId = edge.from_object_id === nodeId
			? edge.to_object_id
			: edge.from_object_id;
		if (!visited.has(neighborId)) {
			neighbors.push(neighborId);
		}
	}
	return neighbors;
}

function loadObjectsByIds(db: Database.Database, ids: string[]): unknown[] {
	if (ids.length === 0) {
		return [];
	}
	const placeholders = ids.map(() => '?').join(', ');
	return db.prepare(`SELECT * FROM memory_objects WHERE object_id IN (${placeholders})`).all(...ids);
}

function expandMemoryNeighbors(params: Record<string, unknown>): Record<string, unknown> {
	const db = requireDb();
	const startId = params.objectId as string;
	const edgeTypes = params.edgeTypes as string[] | undefined;
	const maxDepth = Math.min(Math.max((params.depth as number) || 2, 1), 5);

	const visited = new Set<string>();
	const collectedEdges: unknown[] = [];
	let frontier = [startId];

	for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
		const nextFrontier: string[] = [];

		for (const nodeId of frontier) {
			if (visited.has(nodeId)) {
				continue;
			}
			visited.add(nodeId);

			const edges = queryEdgesForNode(db, nodeId, edgeTypes);
			collectedEdges.push(...edges);
			nextFrontier.push(...collectNeighbors(edges, nodeId, visited));
		}

		frontier = nextFrontier;
	}

	const objects = loadObjectsByIds(db, Array.from(visited));
	return { objects, edges: collectedEdges, visited_count: visited.size };
}

function loadEvidenceSpan(params: Record<string, unknown>): unknown {
	const table = params.table as string;
	const id = params.id as string;

	const primaryKey = EVIDENCE_TABLES[table];
	if (!primaryKey) {
		throw new Error(`Table "${table}" is not in the allowlist. Allowed: ${Object.keys(EVIDENCE_TABLES).join(', ')}`);
	}

	const db = requireDb();
	const row = db.prepare(`SELECT * FROM ${table} WHERE ${primaryKey} = ?`).get(id);
	if (!row) {
		return { found: false, table, id };
	}
	return { found: true, table, id, data: row };
}

function getSupersessionChain(params: Record<string, unknown>): unknown {
	const db = requireDb();
	const startId = params.objectId as string;

	const chain: unknown[] = [];
	let currentId: string | null = startId;
	const seen = new Set<string>();

	// Walk forward through superseded_by
	while (currentId && !seen.has(currentId)) {
		seen.add(currentId);
		const row = db.prepare('SELECT * FROM memory_objects WHERE object_id = ?').get(currentId) as
			| { superseded_by: string | null; [key: string]: unknown }
			| undefined;
		if (!row) {
			break;
		}
		chain.push(row);
		currentId = row.superseded_by ?? null;
	}

	// Also walk backward: find objects whose superseded_by points to startId
	const predecessors: unknown[] = [];
	let predId: string | null = startId;
	const predSeen = new Set<string>([startId]);

	 
	while (true) {
		const pred = db.prepare('SELECT * FROM memory_objects WHERE superseded_by = ?').get(predId) as
			| { object_id: string; superseded_by: string | null; [key: string]: unknown }
			| undefined;
		if (!pred || predSeen.has(pred.object_id)) {
			break;
		}
		predSeen.add(pred.object_id);
		predecessors.unshift(pred);
		predId = pred.object_id;
	}

	const fullChain = [...predecessors, ...chain];
	return {
		chain: fullChain,
		current: fullChain.at(-1) ?? null,
		original: fullChain.length > 0 ? fullChain[0] : null,
		length: fullChain.length,
	};
}

function getConflictSet(params: Record<string, unknown>): unknown {
	const db = requireDb();
	const objectId = params.objectId as string;

	const edges = db.prepare(`
		SELECT * FROM memory_edges
		WHERE edge_type = 'contradicts'
		AND (from_object_id = ? OR to_object_id = ?)
	`).all(objectId, objectId) as Array<{
		from_object_id: string;
		to_object_id: string;
	}>;

	const conflictIds = new Set<string>();
	for (const edge of edges) {
		const otherId = edge.from_object_id === objectId
			? edge.to_object_id
			: edge.from_object_id;
		conflictIds.add(otherId);
	}

	const conflicts = loadObjectsByIds(db, Array.from(conflictIds));

	return { objectId, conflicts, edges, count: conflicts.length };
}

function temporalQuery(params: Record<string, unknown>): unknown[] {
	const db = requireDb();
	const since = params.since as string | undefined;
	const until = params.until as string | undefined;
	const objectType = params.objectType as string | undefined;

	let sql = 'SELECT * FROM memory_objects WHERE 1=1';
	const sqlParams: unknown[] = [];

	if (since) {
		sql += ' AND event_at >= ?';
		sqlParams.push(since);
	}
	if (until) {
		sql += ' AND event_at <= ?';
		sqlParams.push(until);
	}
	if (objectType) {
		sql += ' AND object_type = ?';
		sqlParams.push(objectType);
	}

	sql += ' ORDER BY event_at DESC LIMIT 50';

	return db.prepare(sql).all(...sqlParams);
}

// ==================== Tool Dispatch ====================

function dispatchTool(name: string, args: Record<string, unknown>): unknown {
	switch (name) {
		case 'check_health':
			return checkHealth();
		case 'search_memory_candidates':
			return searchMemoryCandidates(args);
		case 'expand_memory_neighbors':
			return expandMemoryNeighbors(args);
		case 'load_evidence_span':
			return loadEvidenceSpan(args);
		case 'get_supersession_chain':
			return getSupersessionChain(args);
		case 'get_conflict_set':
			return getConflictSet(args);
		case 'temporal_query':
			return temporalQuery(args);
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}

// ==================== JSON-RPC Handler ====================

function handleRequest(request: JsonRpcRequest): JsonRpcResponse {
	const { id, method, params } = request;

	try {
		switch (method) {
			case 'initialize': {
				return {
					jsonrpc: '2.0',
					id,
					result: {
						protocolVersion: '2024-11-05',
						capabilities: { tools: {} },
						serverInfo: {
							name: 'janumicode-deep-memory',
							version: '0.1.0',
						},
					},
				};
			}

			case 'notifications/initialized': {
				// Acknowledgement — no response needed for notifications
				return { jsonrpc: '2.0', id, result: {} };
			}

			case 'tools/list': {
				return {
					jsonrpc: '2.0',
					id,
					result: {
						tools: TOOL_DEFINITIONS,
					},
				};
			}

			case 'tools/call': {
				const toolName = (params as Record<string, unknown>)?.name as string;
				const toolArgs = ((params as Record<string, unknown>)?.arguments ?? {}) as Record<string, unknown>;

				if (!toolName) {
					return {
						jsonrpc: '2.0',
						id,
						error: { code: -32602, message: 'Missing tool name in params.name' },
					};
				}

				try {
					const result = dispatchTool(toolName, toolArgs);
					return {
						jsonrpc: '2.0',
						id,
						result: {
							content: [
								{
									type: 'text',
									text: JSON.stringify(result, null, 2),
								},
							],
						},
					};
				} catch (toolError) {
					return {
						jsonrpc: '2.0',
						id,
						result: {
							content: [
								{
									type: 'text',
									text: JSON.stringify({
										error: toolError instanceof Error ? toolError.message : String(toolError),
									}),
								},
							],
							isError: true,
						},
					};
				}
			}

			default: {
				return {
					jsonrpc: '2.0',
					id,
					error: { code: -32601, message: `Method not found: ${method}` },
				};
			}
		}
	} catch (err) {
		return {
			jsonrpc: '2.0',
			id,
			error: {
				code: -32603,
				message: err instanceof Error ? err.message : 'Internal error',
			},
		};
	}
}

// ==================== Stdio Transport ====================

/**
 * Start the MCP server, reading JSON-RPC messages from stdin and writing responses to stdout.
 * Each message is a single line of JSON.
 */
export function startMcpServer(): void {
	const rl = readline.createInterface({
		input: process.stdin,
		output: undefined,
		terminal: false,
	});

	rl.on('line', (line: string) => {
		const trimmed = line.trim();
		if (!trimmed) {
			return;
		}

		let request: JsonRpcRequest;
		try {
			request = JSON.parse(trimmed) as JsonRpcRequest;
		} catch {
			const errorResponse: JsonRpcResponse = {
				jsonrpc: '2.0',
				id: null,
				error: { code: -32700, message: 'Parse error' },
			};
			process.stdout.write(JSON.stringify(errorResponse) + '\n');
			return;
		}

		const response = handleRequest(request);

		// Notifications (id === undefined/null in the request sense) don't always need a response,
		// but we send one anyway for simplicity since the caller may expect it.
		if (request.id !== undefined) {
			process.stdout.write(JSON.stringify(response) + '\n');
		}
	});

	rl.on('close', () => {
		process.exit(0);
	});
}

// ==================== Standalone Entry Point ====================

// When run directly as `node mcpServer.js`, open a direct read-only
// better-sqlite3 connection (no sidecar dependency) and start the server.
// The DB path comes from the JANUMICODE_DB_PATH env var.
if (require.main === module) {
	const dbPath = process.env.JANUMICODE_DB_PATH;
	if (!dbPath) {
		process.stderr.write('[mcp-memory] JANUMICODE_DB_PATH env var not set\n');
		process.exit(1);
	}

	try {
		 
		const BetterSqlite3 = require('better-sqlite3');
		standaloneDb = new BetterSqlite3(dbPath, { readonly: true }) as Database.Database;
		standaloneDb.pragma('journal_mode = WAL');
		standaloneDb.pragma('busy_timeout = 5000');
		process.stderr.write(`[mcp-memory] Opened DB (read-only): ${dbPath}\n`);
	} catch (err) {
		process.stderr.write(`[mcp-memory] Failed to open DB: ${(err as Error).message}\n`);
		process.exit(1);
	}

	startMcpServer();
}
