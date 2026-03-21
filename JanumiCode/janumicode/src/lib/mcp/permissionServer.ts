/**
 * MCP Permission Server
 * Minimal JSON-RPC 2.0 stdio server for Claude Code's --permission-prompt-tool.
 *
 * This runs as a standalone Node.js process spawned by Claude Code via MCP config.
 * It exposes a single tool "decide_permission" that bridges permission requests
 * back to the JanumiCode extension host via HTTP localhost.
 *
 * Protocol: MCP over stdio (JSON-RPC 2.0 with newline-delimited framing)
 */

import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ==================== CONFIGURATION ====================

const PERMISSION_PORT = parseInt(process.env.JANUMICODE_PERMISSION_PORT || '0', 10);
const HTTP_TIMEOUT_MS = 120_000; // 120 seconds — must match bridge's human decision timeout

// Diagnostic logging to file (stdout=MCP protocol, stderr=swallowed by Claude Code)
const LOG_PATH = path.join(os.tmpdir(), 'janumicode-mcp', 'permission-server.log');
try { fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true }); } catch { /* ignore */ }
function log(msg: string): void {
	const line = `[${new Date().toISOString()}] ${msg}\n`;
	process.stderr.write(`[MCP-PermissionServer] ${msg}\n`);
	try { fs.appendFileSync(LOG_PATH, line); } catch { /* ignore */ }
}

log(`Starting — PID=${process.pid}, PORT=${PERMISSION_PORT}`);
log(`Node version: ${process.version}`);
log(`Log file: ${LOG_PATH}`);
log(`argv: ${process.argv.join(' ')}`);

// Prevent silent crashes
process.on('uncaughtException', (err) => {
	log(`UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`);
});
process.on('unhandledRejection', (reason) => {
	log(`UNHANDLED REJECTION: ${reason}`);
});

// ==================== MCP TOOL DEFINITION ====================

const TOOL_DEFINITION = {
	name: 'decide_permission',
	description: 'Decide whether to approve or deny a tool permission request. Called by Claude Code when a tool needs permission in non-interactive mode.',
	inputSchema: {
		type: 'object' as const,
		properties: {
			tool_name: { type: 'string' as const, description: 'Tool name requesting permission' },
			input: { type: 'object' as const, description: 'Tool input/arguments' },
		},
		required: ['tool_name'],
	},
};

// ==================== JSON-RPC 2.0 FRAMING ====================
// MCP stdio transport uses newline-delimited JSON (one JSON message per line).

let inputBuffer = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk: string) => {
	log(`stdin raw (${chunk.length} bytes): ${chunk.substring(0, 300).replaceAll('\n', '\\n')}`);
	inputBuffer += chunk;
	processBuffer();
});

process.stdin.on('end', () => {
	log('stdin ended');
});

function processBuffer(): void {
	// Split on newlines — each line is a complete JSON-RPC message
	while (true) {
		const newlineIdx = inputBuffer.indexOf('\n');
		if (newlineIdx === -1) { break; }

		const line = inputBuffer.substring(0, newlineIdx).trim();
		inputBuffer = inputBuffer.substring(newlineIdx + 1);

		if (line.length > 0) {
			handleMessage(line);
		}
	}
}

function sendResponse(response: unknown): void {
	const body = JSON.stringify(response);
	log(`Sending response: ${body.substring(0, 200)}`);
	process.stdout.write(body + '\n');
}

// ==================== REQUEST HANDLING ====================

 
function handleMessage(raw: string): void {
	let msg: { jsonrpc: string; id?: number | string; method: string; params?: unknown };
	try {
		msg = JSON.parse(raw);
	} catch (e) {
		log(`Failed to parse JSON: ${e}`);
		return;
	}

	log(`Received: method=${msg.method}, id=${msg.id}`);

	if (msg.method === 'initialize') {
		log('Handling initialize — sending capabilities');
		sendResponse({
			jsonrpc: '2.0',
			id: msg.id,
			result: {
				protocolVersion: '2024-11-05',
				capabilities: { tools: {} },
				serverInfo: {
					name: 'janumicode-permission',
					version: '1.0.0',
				},
			},
		});
		return;
	}

	if (msg.method === 'notifications/initialized') {
		// Acknowledgement — no response needed
		return;
	}

	if (msg.method === 'tools/list') {
		log('Handling tools/list — returning decide_permission');
		sendResponse({
			jsonrpc: '2.0',
			id: msg.id,
			result: { tools: [TOOL_DEFINITION] },
		});
		return;
	}

	if (msg.method === 'tools/call') {
		log(`Handling tools/call — name=${(msg.params as any)?.name}`);
		handleToolCall(msg.id, msg.params as { name: string; arguments?: Record<string, unknown> });
		return;
	}

	// Unknown method — respond with error if it has an ID
	if (msg.id !== undefined) {
		sendResponse({
			jsonrpc: '2.0',
			id: msg.id,
			error: { code: -32601, message: `Method not found: ${msg.method}` },
		});
	}
}

async function handleToolCall(
	id: number | string | undefined,
	params: { name: string; arguments?: Record<string, unknown> }
): Promise<void> {
	if (params.name !== 'decide_permission') {
		sendResponse({
			jsonrpc: '2.0',
			id,
			result: {
				content: [{ type: 'text', text: `Unknown tool: ${params.name}` }],
				isError: true,
			},
		});
		return;
	}

	const args = params.arguments || {};
	// Claude Code sends tool_name (not tool) per --permission-prompt-tool spec
	let tool = 'unknown';
	if (typeof args.tool_name === 'string') { tool = args.tool_name; }
	else if (typeof args.tool === 'string') { tool = args.tool; }
	const input = (typeof args.input === 'object' && args.input !== null) ? args.input as Record<string, unknown> : {};

	log(`Permission request: tool=${tool}, input keys=${Object.keys(input).join(',')}`);

	try {
		const decision = await callPermissionBridge(tool, input);
		const text = decision.approved
			? `APPROVED: ${decision.reason}`
			: `DENIED: ${decision.reason}`;

		sendResponse({
			jsonrpc: '2.0',
			id,
			result: {
				content: [{ type: 'text', text }],
			},
		});
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Bridge call failed';
		sendResponse({
			jsonrpc: '2.0',
			id,
			result: {
				content: [{ type: 'text', text: `DENIED: ${errorMsg}` }],
				isError: true,
			},
		});
	}
}

// ==================== HTTP BRIDGE CALL ====================

interface BridgeResponse {
	approved: boolean;
	reason: string;
}

function callPermissionBridge(
	tool: string,
	input: Record<string, unknown>
): Promise<BridgeResponse> {
	if (!PERMISSION_PORT) {
		return Promise.resolve({
			approved: false,
			reason: 'JANUMICODE_PERMISSION_PORT not configured',
		});
	}

	const body = JSON.stringify({ tool, input });

	return new Promise<BridgeResponse>((resolve, reject) => {
		const req = http.request(
			{
				hostname: '127.0.0.1',
				port: PERMISSION_PORT,
				path: '/permission',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body),
				},
				timeout: HTTP_TIMEOUT_MS,
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => { data += chunk; });
				res.on('end', () => {
					try {
						const parsed = JSON.parse(data) as BridgeResponse;
						resolve(parsed);
					} catch {
						reject(new Error('Invalid response from permission bridge'));
					}
				});
			}
		);

		req.on('error', (err) => {
			reject(new Error(`Permission bridge connection failed: ${err.message}`));
		});

		req.on('timeout', () => {
			req.destroy();
			reject(new Error('Permission bridge request timed out'));
		});

		req.write(body);
		req.end();
	});
}
