// ⭐⭐ `JAN-MHX` MH-1 (`DESIGN-multi-harness-executor.md` D1–D9) — THE HOST'S MCP TOOL SERVER: the two tools Pi gets,
// served to an external CLI over loopback, one server per CLI execution session.
//
// ⭑ WHAT IT SERVES IS WHAT `mintExecutionTools` MINTED FOR THE SESSION, AND NOTHING ELSE (D3). `tools/list` returns those
// descriptors in mint order; a `tools/call` of any other name is refused by the host and observed under the name asked
// for, so `governedToolCallReport` grades it NOT_MINTED, as it does for Pi. Grant by absence holds for the HOST's tools.
// ⚠ It does not hold for the CLI's OWN tools, which only the CLI's config withholds: the session opener checks each turn
// for that (D4, D14a, D14b), and this server knows nothing of it.
//
// ⭑ ITS OBSERVERS ARE PI'S (D6). The process-run observer reaches `run_command` through the minted tool's own ports, and
// the tool-call observer is called here: `started` when a call ARRIVES, before it waits in the queue; `ended` with the
// result in Pi's shape (`toPiToolResult`), so `observedToolOutcome` grades it as it grades Pi's — a throw is FAILED,
// `ok: false` is REFUSED, anything else COMPLETED. A call still queued when its turn's gate closes is dropped unrun and
// never ended: UNKNOWN, as `tool-call-observer.ts` defines it.
//
// ⛔ ONE CALL AT A TIME, IN ARRIVAL ORDER (D5; `REG-F-518`): every `tools/call` goes through one queue, so a
// `run_command` never races the `write_file` before it. Arrival order is the order the CLI sent the calls.
//
// ⛔ WHO MAY CALL (D2, D8). It binds 127.0.0.1 on a random port. A request whose `Host` is not `127.0.0.1:<port>`, or that
// carries an `Origin`, is refused (a web page reaching it through DNS rebinding sends one or the other). Calls are taken
// only while a turn is open and only with that turn's bearer token, compared in constant time; a token is minted per
// turn and revoked when the turn closes. A refusal at the gate — no turn open, or an earlier turn's token — is answered
// with `GATE_REFUSED_STATUS` and counted, so a descendant of an earlier turn's CLI that outlived it can neither act in a
// later turn nor go unseen. ⚠ What this does not defend against is the executing model itself: minting `run_command` is
// arbitrary code as the server user (`R12`, `R13`), and such a model can read the token file. It then holds what it
// already had: the same tools, under the same grant, for the same turn, recorded the same way.
//
// ⭑ HAND-WRITTEN JSON-RPC OVER `node:http`, NO LIBRARY (D9): five methods, `initialize`, `notifications/initialized`,
// `ping`, `tools/list` and `tools/call`. A POST carries one message and gets one JSON reply; a notification gets 202 and
// no body; a GET gets 405, because there is no event stream.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { toPiToolResult, unknownToolResult } from '../agent/pi-tool-result.js';
import { toTypeBox } from '../agent/pi-typebox.js';
import type { ExecutionToolDescriptor } from './execution-tool-surface.js';
import type { ToolCallObserver } from './tool-call-observer.js';

/** The MCP server's name, as every CLI's run-folder config names it. */
export const HOST_TOOL_SERVER_NAME = 'jpwb';

/**
 * ⛔ THE GATE'S OWN REFUSAL — no turn open, or a token minted for a turn that has closed. Distinct from 401 (a token
 * this server never minted) so a test, and a reader of a probe's log, can tell the gate's refusal from an
 * authentication failure. ⚠ AUTHORED: HTTP has no status that means "this turn has ended".
 */
export const GATE_REFUSED_STATUS = 409;

/** A request body is bounded (D9). ⚠ AUTHORED. */
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;

/**
 * How long the listener stays up after `close()` has shut the gate. ⭑ So a request already sent on a connection the CLI
 * held open is answered with the gate's refusal, and counted, rather than reset. Nothing runs in that window: the gate
 * is shut and every token revoked before it starts. ⚠ AUTHORED.
 */
const CLOSE_GRACE_MS = 250;

/** The MCP protocol versions this server answers in, newest last. ⭑ It serves tools only, which all of them describe alike. */
const PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18'];

/** One tool as `tools/list` serves it. */
export interface ServedTool {
	readonly name: string;
	readonly description: string;
	/** `toTypeBox(parameters)` serialised — the schema Pi's provider is sent (`executorKeyOf`'s form). */
	readonly inputSchema: unknown;
	/** ⭑ agy reads this key (changelog 1.3.3). That the other CLIs ignore it is assumed, not measured (D9). */
	readonly _meta: { readonly 'antigravity/alwaysLoad': true };
}

/** One `tools/call` that reached the host in a turn, as the host's transcript holds it (D17). */
export interface HostToolCall {
	readonly name: string;
	/** As the CLI sent them. ⛔ Model-chosen: content plane only (`R11`). */
	readonly arguments: unknown;
	/** The text the host sent back, or `null` for a call dropped unrun when its turn closed. */
	readonly result: string | null;
	readonly isError: boolean;
}

export interface HostToolServerInput {
	/** What `mintExecutionTools` returned for the session — the whole surface, in mint order. */
	readonly tools: readonly ExecutionToolDescriptor[];
	/** The session's tool-call observer (D6). */
	readonly observer: ToolCallObserver;
	/**
	 * ⭐ D14b — run immediately before and after each minted tool runs, so the session's workspace manifests bracket
	 * every host call. Never called for a call that runs nothing (an unknown name, a dropped call).
	 */
	readonly aroundCall?: { before(): Promise<void>; after(): Promise<void> };
}

export interface HostToolServer {
	readonly port: number;
	/** The URL the bridge posts to. */
	readonly url: string;
	/** `tools/list`'s descriptors, as served. */
	readonly tools: readonly ServedTool[];
	/** Open a turn's gate, and mint and return its token. ⚠ Opening a turn while one is open closes that one first. */
	openTurn(): string;
	/**
	 * Close the turn's gate and revoke its token — at once, before this returns — and drop every call still queued.
	 * The promise settles when the call running at the time, if any, has ended.
	 */
	closeTurn(): Promise<void>;
	/** The calls that reached the host in the turn opened last, in arrival order. */
	transcript(): readonly HostToolCall[];
	/** How many requests the gate has refused, over the server's life. */
	refusals(): number;
	/** Shut the gate and revoke every token at once; the listener closes after a short grace. Idempotent. */
	close(): Promise<void>;
}

type JsonRpcId = string | number | null;

/** A JSON-RPC reply, or `undefined` for a notification, which gets none. */
type Reply = { readonly status: number; readonly body?: unknown };

const rpcResult = (id: JsonRpcId, result: unknown): Reply => ({
	status: 200,
	body: { jsonrpc: '2.0', id, result }
});
const rpcError = (id: JsonRpcId, code: number, message: string, status = 200): Reply => ({
	status,
	body: { jsonrpc: '2.0', id, error: { code, message } }
});

/** Constant-time equality of two tokens. ⭑ Every token is 64 hex characters, so a length difference leaks nothing. */
function sameToken(a: string, b: string): boolean {
	const x = Buffer.from(a, 'utf8');
	const y = Buffer.from(b, 'utf8');
	return x.length === y.length && timingSafeEqual(x, y);
}

/** The bearer token a request carries, or `undefined`. */
function bearerOf(request: IncomingMessage): string | undefined {
	const header = request.headers.authorization;
	if (typeof header !== 'string' || !header.startsWith('Bearer ')) return undefined;
	return header.slice('Bearer '.length);
}

/** The request's body, or `undefined` when it exceeds the bound. */
function readBody(request: IncomingMessage): Promise<string | undefined> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		let size = 0;
		let over = false;
		request.on('data', (chunk: Buffer) => {
			size += chunk.length;
			if (size > MAX_REQUEST_BYTES) over = true;
			else chunks.push(chunk);
		});
		request.on('end', () => resolve(over ? undefined : Buffer.concat(chunks).toString('utf8')));
		request.on('error', () => resolve(undefined));
	});
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** The text of a Pi-shaped result's parts, as the CLI is sent it. */
const textOf = (content: ReadonlyArray<{ readonly text?: string }>): string =>
	content.map((part) => part.text ?? '').join('\n');

/**
 * ⭐ D7 — what a tool that THREW is answered with: a fixed sentence. The thrown message is not echoed, because it may
 * carry a host path.
 */
const HOST_FAILED_SENTENCE = 'The host failed to carry out this call. Nothing about the failure is reported here.';

/** Start one server for one session. It listens on 127.0.0.1, on a port the system picks. */
export async function startHostToolServer(input: HostToolServerInput): Promise<HostToolServer> {
	const served: ServedTool[] = input.tools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		inputSchema: JSON.parse(JSON.stringify(toTypeBox(tool.parameters))) as unknown,
		_meta: { 'antigravity/alwaysLoad': true }
	}));
	/** Every token this server has minted; the last is the open turn's while `gateOpen`. */
	const minted: string[] = [];
	let gateOpen = false;
	let current: string | undefined;
	/** Bumped each time a turn opens, so a queued call can tell it belongs to a turn that has closed. */
	let turnSerial = 0;
	let transcript: { name: string; arguments: unknown; result: string | null; isError: boolean }[] = [];
	let refused = 0;
	let queue: Promise<void> = Promise.resolve();
	let callIds = 0;
	let closing: Promise<void> | undefined;

	/** ⛔ D3, D6, D7 — one `tools/call`, observed on arrival and run when the queue reaches it. */
	function call(id: JsonRpcId, params: unknown): Promise<Reply> {
		const name = isRecord(params) && typeof params.name === 'string' ? params.name : '';
		const args = isRecord(params) ? params.arguments : undefined;
		const callId = `host-call-${++callIds}`;
		const serial = turnSerial;
		// ⭑ STARTED ON ARRIVAL, BEFORE IT WAITS (D6): a call the CLI sent is recorded even if it never runs.
		input.observer.started(callId, name);
		const entry = { name, arguments: args, result: null as string | null, isError: false };
		transcript.push(entry);
		const reply = queue.then(async (): Promise<Reply> => {
			// ⛔ DROPPED UNRUN: its turn's gate closed while it waited. It stays started with no end — UNKNOWN.
			if (!gateOpen || serial !== turnSerial)
				return rpcError(id, -32000, 'The turn ended before the host ran this call; it was not run.', GATE_REFUSED_STATUS);
			const tool = input.tools.find((t) => t.name === name);
			if (tool === undefined) {
				const unknown = unknownToolResult(name);
				input.observer.ended(callId, unknown, true);
				entry.result = textOf(unknown.content);
				entry.isError = true;
				return rpcResult(id, { content: unknown.content, isError: true });
			}
			let result: ReturnType<typeof toPiToolResult>;
			let threw = false;
			await input.aroundCall?.before();
			try {
				result = toPiToolResult(await tool.run(isRecord(args) ? args : {}));
			} catch {
				threw = true;
				result = toPiToolResult({ ok: false, summary: HOST_FAILED_SENTENCE });
			} finally {
				await input.aroundCall?.after();
			}
			// ⭑ D6: `observedToolOutcome` reads `isError` as the TRANSPORT failure and `details.ok` as the tool's own refusal.
			input.observer.ended(callId, result, threw);
			const isError = threw || !result.details.ok;
			entry.result = textOf(result.content);
			entry.isError = isError;
			return rpcResult(id, { content: result.content, isError });
		});
		queue = reply.then(
			() => undefined,
			() => undefined
		);
		return reply;
	}

	function dispatch(message: unknown): Reply | Promise<Reply> {
		if (!isRecord(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string')
			return rpcError(null, -32600, 'Invalid request.');
		const isNotification = !('id' in message);
		const id = (isNotification ? null : message.id) as JsonRpcId;
		if (isNotification) return { status: 202 };
		switch (message.method) {
			case 'initialize': {
				const asked = isRecord(message.params) ? message.params.protocolVersion : undefined;
				return rpcResult(id, {
					protocolVersion:
						typeof asked === 'string' && PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS.at(-1),
					capabilities: { tools: { listChanged: false } },
					serverInfo: { name: HOST_TOOL_SERVER_NAME, version: '1.0.0' }
				});
			}
			case 'ping':
				return rpcResult(id, {});
			case 'tools/list':
				return rpcResult(id, { tools: served });
			case 'tools/call':
				return call(id, message.params);
			default:
				return rpcError(id, -32601, 'Method not found.');
		}
	}

	async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
		const send = (reply: Reply): void => {
			if (reply.body === undefined) {
				response.writeHead(reply.status).end();
				return;
			}
			const text = JSON.stringify(reply.body);
			response.writeHead(reply.status, { 'content-type': 'application/json' }).end(text);
		};
		// ⛔ D2 — loopback by name, and no browser: a rebinding page sends another `Host`, or an `Origin`.
		if (request.headers.host !== `127.0.0.1:${port}` || request.headers.origin !== undefined) {
			request.resume();
			send({ status: 403 });
			return;
		}
		if (request.method !== 'POST') {
			request.resume();
			send({ status: 405 });
			return;
		}
		const body = await readBody(request);
		if (body === undefined) {
			send({ status: 413 });
			return;
		}
		// ⛔ D8 — THE GATE, ASKED BEFORE THE TOKEN: outside a turn nothing is taken, whatever it carries.
		if (!gateOpen) {
			refused += 1;
			send({ status: GATE_REFUSED_STATUS });
			return;
		}
		const bearer = bearerOf(request);
		const isCurrent = bearer !== undefined && current !== undefined && sameToken(bearer, current);
		if (!isCurrent) {
			// ⛔ An earlier turn's token meets the gate's refusal, counted; a token never minted is an authentication failure.
			if (bearer !== undefined && minted.some((token) => sameToken(bearer, token))) {
				refused += 1;
				send({ status: GATE_REFUSED_STATUS });
				return;
			}
			send({ status: 401 });
			return;
		}
		let message: unknown;
		try {
			message = JSON.parse(body);
		} catch {
			send(rpcError(null, -32700, 'Parse error.'));
			return;
		}
		send(await dispatch(message));
	}

	const server = createServer((request, response) => {
		void handle(request, response).catch(() => {
			if (!response.headersSent) response.writeHead(500).end();
		});
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolve();
		});
	});
	const port = (server.address() as AddressInfo).port;

	/** ⛔ D8 — shut the gate and revoke the open turn's token, synchronously. */
	function shutGate(): void {
		gateOpen = false;
		current = undefined;
	}

	return {
		port,
		url: `http://127.0.0.1:${port}/`,
		tools: served,
		openTurn() {
			if (closing !== undefined) throw new Error('This host tool server is closed; no turn can open on it.');
			shutGate();
			const token = randomBytes(32).toString('hex');
			minted.push(token);
			current = token;
			turnSerial += 1;
			transcript = [];
			gateOpen = true;
			return token;
		},
		closeTurn() {
			shutGate();
			// ⭑ What is queued is dropped when the queue reaches it; what runs now is awaited.
			return queue;
		},
		transcript: () => transcript.map((entry) => ({ ...entry })),
		refusals: () => refused,
		close() {
			shutGate();
			closing ??= new Promise<void>((resolve) => {
				setTimeout(() => {
					server.close(() => resolve());
					server.closeAllConnections();
				}, CLOSE_GRACE_MS);
			});
			return closing;
		}
	};
}
