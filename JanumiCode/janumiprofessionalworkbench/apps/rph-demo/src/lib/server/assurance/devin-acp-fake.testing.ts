// ⭐⭐ `JAN-EXEC` Phase 7, package L17b6 — design D94 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.48; `REG-D-202` to `REG-D-204`; the lead's
// rulings on L17b6's Stage 0, `l17b4/l17b4-facts.md` §39, Q14) — A FAKE OF devin's ACP SERVER, for the tests of the Historian's call: no devin, no model.
//
// ⭑ IT IS THE CALL'S CHILD, IN MEMORY (`HistorianAcpChild`): handed the launch, it reads each line the call writes as JSON-RPC 2.0 and answers in the
// form the lead's probes measured (`l17b4/runs/c94-c95/acp-*.jsonl`, masked logs; §35, §36):
//   · `initialize` as acp-00's line 3 — protocol version 1, devin's capabilities, its agent `affogato` at `0.0.0-dev`, and `_meta.mcpConfigPath`, a
//     path under the home folder (here a fixture's, its parts joined so that no line of this file holds one);
//   · `session/new` as acp-06's lines 5-10 — two `_cognition.ai/mcp/serversChanged`, the mode and config updates, then its session, `swe-2-high`
//     (*"SWE-2"*) at thought level `max` (*"Max"*), in mode `accept-edits`;
//   · `session/set_mode` as lines 12-19, then `{}`; `session/delete` as lines 462-463, `{}`;
//   · `session/prompt` — the case's turn, in the notices' measured shapes (acp-06's lines 24-45; acp-02's lines 18-41), then, at its end, the stop
//     notices and the prompt's answer (acp-02's lines 38-41), `_cognition.ai/agent_stopped` naming `SWE-2 Max`.
// ⭑ WHAT IT KEEPS: every message the call wrote (`received`), every answer to a request of its own (`answers`), each launch it was handed
// (`launches`) and each stop, in order (`stops`).
// ⛔ It binds no standard error: there is none (`verif/agy-stderr-unbound.test.ts`).
import type { HistorianAcpChild, HistorianLaunch, HistorianSpawn } from '../tools/devin-historian.js';

/** A home folder named `fixture`, its parts joined here, so that no line of this file holds an absolute path. */
export const FAKE_HOME = ['C:', 'Users', 'fixture'].join('\\');
/** The fake's process id. */
export const FAKE_PID = 4242;
/** The fake's session, as devin names one (acp-06's `skillful-helium`). */
export const FAKE_SESSION = 'skillful-helium';

/** ⭑ The six options probe B's request offered (acp-02 line 20), in its order. */
export const PROBE_B_OPTIONS: readonly { readonly optionId: string; readonly name: string; readonly kind: string }[] = [
	{ optionId: 'allow_once', name: 'Allow', kind: 'allow_once' },
	{ optionId: 'allow_session', name: 'Yes, allow `node` commands (this session)', kind: 'allow_always' },
	{ optionId: 'allow_always', name: 'Yes, always allow `node` commands in `02-refused-by-host`', kind: 'allow_always' },
	{ optionId: 'allow_always_global', name: 'Yes, always allow `node` commands in all projects', kind: 'allow_always' },
	{ optionId: 'switch_bypass', name: 'Yes, switch to bypass mode', kind: 'allow_always' },
	{ optionId: 'reject_once', name: 'Reject', kind: 'reject_once' }
];

/** ⭑ A read's notice, as acp-06's line 30: kind `read`, its absolute `file_path`, the same place in `locations`, devin's tool name. */
export const readNotice = (toolCallId: string, path: string, place: string = path): Record<string, unknown> => ({
	sessionUpdate: 'tool_call',
	toolCallId,
	title: 'Read file',
	kind: 'read',
	locations: [{ path: place }],
	rawInput: { file_path: path },
	_meta: { 'cognition.ai/inferenceToolName': 'read', 'cognition.ai/timestamp': '2026-11-27T12:26:33.104201500+00:00' }
});
/** ⭑ A search's notice, as acp-06's line 100: kind `search`, its `query` and its `path`, devin's tool name `grep`. */
export const searchNotice = (toolCallId: string, path: string | undefined, name = 'grep'): Record<string, unknown> => ({
	sessionUpdate: 'tool_call',
	toolCallId,
	title: "Search for 'part'",
	kind: 'search',
	...(path === undefined ? {} : { locations: [{ path }] }),
	rawInput: { query: 'part', ...(path === undefined ? {} : { path }) },
	_meta: { 'cognition.ai/inferenceToolName': name }
});
/** ⭑ An exec's notice, as acp-02's line 18: kind `execute`, its command, no place. */
export const execNotice = (toolCallId: string, name = 'exec', kind = 'execute'): Record<string, unknown> => ({
	sessionUpdate: 'tool_call',
	toolCallId,
	title: 'Ran node',
	kind,
	rawInput: { command: 'node --version' },
	content: [{ type: 'content', content: { type: 'resource', resource: { mimeType: 'text/x-shellscript', text: 'node --version', uri: 'tool://preview' } } }],
	_meta: { 'cognition.ai/commandNames': ['node'], 'cognition.ai/inferenceToolName': name }
});
/**
 * ⭑ A call's update, as acp-06's lines 34 and 39, and acp-02's line 23 (a refused one, `cognition.ai/rejected`): its `_meta` names the call's own tool, as
 * devin's do (`exec` for acp-02's).
 */
export const updateNotice = (toolCallId: string, status: string, rejected = false, name = 'read'): Record<string, unknown> => ({
	sessionUpdate: 'tool_call_update',
	toolCallId,
	status,
	...(status === 'failed' && rejected ? { content: [{ type: 'content', content: { type: 'text', text: 'Tool execution was rejected: User rejected this tool call' } }] } : {}),
	_meta: { 'cognition.ai/inferenceToolName': name, ...(rejected ? { 'cognition.ai/rejected': true } : {}) }
});

/** One step of devin's turn, after the call's `session/prompt`. */
export type FakeAcpEvent =
	| { readonly message: string }
	| { readonly thought: string }
	| { readonly notice: Record<string, unknown> }
	| { readonly ask: { readonly toolCallId: string; readonly options?: readonly unknown[] } }
	| { readonly request: { readonly method: string; readonly params?: unknown } }
	| { readonly line: string }
	| { readonly hold: true }
	| { readonly end: string; readonly cause?: string }
	| { readonly exit: number }
	// ⭐ L17b6 round 5 (the lead's §47.7, item 7) — the child ended by a signal, after what was already sent: its code null (constructed: no log holds one).
	| { readonly signal: string | null };

/** What the fake does, beyond its measured answers. */
export interface FakeAcpScript {
	readonly turn: readonly FakeAcpEvent[];
	/** At `session/cancel`: end the turn `cancelled` (the spec's form, as the lead's design assumes it), or ignore it. Default: end it. */
	readonly onCancel?: 'end' | 'ignore';
	/** At its stdin's close: exit 0, as 8 of 8 logs did, or go on. Default: exit. */
	readonly onStdinClose?: 'exit' | 'ignore';
	/** At a terminate: exit by the signal, or go on. Default: exit. */
	readonly onTerminate?: 'exit' | 'ignore';
	/** ⭐ L17b6 round 3 (the lead's §43.6) — at a kill: exit by the signal, or go on, so that no stop ends it (constructed: no log holds one). Default: exit. */
	readonly onKill?: 'exit' | 'ignore';
	/** ⭐ L17b6 round 3 (the lead's §43.7) — at `session/delete`: answer it, or never, so that the call's wait for it is seen (constructed). Default: answer. */
	readonly onDelete?: 'answer' | 'ignore';
	/** An error answered to one method, in place of its result. */
	readonly errors?: Readonly<Record<string, { readonly code: number; readonly message: string }>>;
	/** A start that fails, by its code (`ENOENT`): no line, the child ended at once. */
	readonly startError?: string;
	/** The `initialize` result's `_meta`, in place of the measured one. */
	readonly initializeMeta?: Record<string, unknown>;
	/**
	 * ⭐ L17b6 round 5 (the lead's §47.7, item 1) — at `session/cancel`: these events first, a request among them waited for as the turn's are; then the
	 * turn ended, or not, as `onCancel` says (constructed: no log holds a request after a cancel). Default: none, the cancel as before.
	 */
	readonly atCancel?: readonly FakeAcpEvent[];
	/** ⭐ L17b6 round 5 (the lead's §47.7, item 3) — methods the fake never answers, so that the bound is reached before the prompt (constructed). Default: none. */
	readonly neverAnswer?: readonly string[];
	/** ⭐ L17b6 round 5 (the lead's §47.7, item 4) — the id `session/new` names, in place of the measured one; `null`, none (constructed). Default: the measured one. */
	readonly newSessionId?: string | null;
	/** ⭐ L17b6 round 5 (the lead's §47.7, item 9) — the label `agent_stopped` names, in place of the measured one; `null`, none (constructed). Default: the measured one. */
	readonly modelLabel?: string | null;
	/**
	 * ⭐ L17b6 round 6 (the lead's §49.5, item 1) — the session's model option, its current value and that value's name, in place of the measured
	 * `swe-2-high` named `SWE-2`, wherever the fake reports its config options (constructed). Default: the measured one.
	 */
	readonly modelOption?: { readonly value: string; readonly name: string };
}

/** ⭑ The measured model option: `swe-2-high`, named `SWE-2`. */
const MEASURED_MODEL = { value: 'swe-2-high', name: 'SWE-2' } as const;
/**
 * ⭑ The `configOptions` acp-06's `session/new` reported, abridged to the values the call reads, in their measured shape. ⭐ L17b6 round 6 (§49.5, item 1)
 * — ~~`(mode: string): unknown[]`~~: and the model option's value and name, the measured ones by default.
 */
const CONFIG_OPTIONS = (mode: string, model: { readonly value: string; readonly name: string } = MEASURED_MODEL): unknown[] => [
	{
		id: 'mode',
		name: 'Session Mode',
		category: 'mode',
		type: 'select',
		currentValue: mode,
		options: [
			{ value: 'accept-edits', name: 'Code' },
			{ value: 'smart', name: 'Smart' },
			{ value: 'ask', name: 'Ask', description: 'Answer questions without code changes' },
			{ value: 'plan', name: 'Plan' },
			{ value: 'bypass', name: 'Bypass Permissions' }
		]
	},
	{
		id: 'model',
		name: 'Model',
		category: 'model',
		type: 'select',
		// ⭐ L17b6 round 6 (§49.5, item 1) — ~~`currentValue: 'swe-2-high',`~~ and ~~`{ value: 'swe-2-high', name: 'SWE-2' },`~~: the model given, the measured by default.
		currentValue: model.value,
		options: [
			{ value: 'adaptive', name: 'Adaptive' },
			{ value: model.value, name: model.name },
			{ value: 'swe-2-flash-medium', name: 'SWE-2 Flash' }
		]
	},
	{
		id: 'thought_level',
		name: 'Thought Level',
		category: 'thought_level',
		type: 'select',
		currentValue: 'max',
		options: [
			{ value: 'medium', name: 'Medium' },
			{ value: 'high', name: 'High' },
			{ value: 'max', name: 'Max' }
		]
	},
	{ id: 'speed', name: 'Speed', category: 'model_config', type: 'select', currentValue: 'standard', options: [{ value: 'standard', name: 'Standard' }] }
];

/** The fake's record of a run, and its spawn. */
export interface FakeAcp {
	readonly spawn: HistorianSpawn;
	readonly launches: HistorianLaunch[];
	/** Each message the call wrote, parsed, in order (a line that is not JSON kept as `{ unparsed }`). */
	readonly received: Record<string, unknown>[];
	/** Each answer the call gave to a request of the fake's, by the request's method, in order. */
	readonly answers: { readonly method: string; readonly id: unknown; readonly answer: Record<string, unknown> }[];
	/** Each stop, in order: `stdin`, `terminate`, `kill`. */
	readonly stops: string[];
	/** The methods the call wrote, in order. */
	readonly methods: () => string[];
}

/** ⭐ A fake of devin's ACP server for one call (see the header). */
export function fakeAcp(script: FakeAcpScript): FakeAcp {
	const launches: HistorianLaunch[] = [];
	const received: Record<string, unknown>[] = [];
	const answers: { method: string; id: unknown; answer: Record<string, unknown> }[] = [];
	const stops: string[] = [];
	const spawn: HistorianSpawn = (launch) => {
		launches.push(launch);
		const listeners: ((line: string) => void)[] = [];
		let ended = false;
		let endWith: (v: { code: number | null; signal: string | null } | { startError: string }) => void = () => undefined;
		const exited = new Promise<{ code: number | null; signal: string | null } | { startError: string }>((resolve) => {
			endWith = resolve;
		});
		const end = (v: { code: number | null; signal: string | null } | { startError: string }): void => {
			if (ended) return;
			ended = true;
			endWith(v);
		};
		const emit = (msg: unknown): void => {
			if (ended) return;
			const line = typeof msg === 'string' ? msg : JSON.stringify(msg);
			setImmediate(() => {
				if (!ended) for (const l of listeners) l(line);
			});
		};
		const update = (u: Record<string, unknown>): void => emit({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: FAKE_SESSION, update: u } });
		const answer = (id: unknown, method: string, result: unknown): void => {
			const error = script.errors?.[method];
			emit(error === undefined ? { jsonrpc: '2.0', id, result } : { jsonrpc: '2.0', id, error });
		};
		// ── The turn: each event in order; a request of the fake's waits for its answer, a hold for the cancel.
		let promptId: unknown;
		let step = 0;
		let waiting: string | undefined;
		let requestSeq = 0;
		let turnOver = false;
		/** The method of each request the fake sent, by its id, for `answers`. */
		const askedMethod = new Map<string, string>();
		const endTurn = (stopReason: string, cause = 'complete'): void => {
			if (turnOver) return;
			turnOver = true;
			update({ sessionUpdate: 'session_info_update', _meta: { 'cognition.ai/statusEnum': 'blocked' } });
			emit({ jsonrpc: '2.0', method: '_cognition.ai/turn_stats', params: { sessionId: FAKE_SESSION } });
			// ⭐ L17b6 round 5 (§47.7, item 9) — ~~`stats: { modelLabel: 'SWE-2 Max' }`~~ always: the measured label, or the script's, or none.
			const label = script.modelLabel === undefined ? 'SWE-2 Max' : script.modelLabel;
			emit({ jsonrpc: '2.0', method: '_cognition.ai/agent_stopped', params: { cause, stats: label === null ? {} : { modelLabel: label }, sessionId: FAKE_SESSION } });
			answer(promptId, 'session/prompt', { stopReason, usage: { totalTokens: 1, inputTokens: 1, outputTokens: 0 } });
		};
		/** A request of the fake's own, sent; the turn waits for its answer. */
		const ask = (method: string, params: unknown): void => {
			requestSeq += 1;
			waiting = `${method}#${requestSeq}`;
			askedMethod.set(waiting, method);
			emit({ jsonrpc: '2.0', id: waiting, method, params });
		};
		/** One event of the turn played; `false` where the turn stops there (a hold, an exit). */
		const play = (e: FakeAcpEvent): boolean => {
			if ('message' in e) update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: e.message } });
			else if ('thought' in e) update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: e.thought } });
			else if ('notice' in e) update(e.notice);
			else if ('line' in e) emit(e.line);
			else if ('ask' in e)
				ask('session/request_permission', {
					sessionId: FAKE_SESSION,
					toolCall: { toolCallId: e.ask.toolCallId, _meta: { 'cognition.ai/permissionRule': 'Read(*)' } },
					options: e.ask.options ?? PROBE_B_OPTIONS
				});
			else if ('request' in e) ask(e.request.method, e.request.params ?? {});
			else if ('end' in e) endTurn(e.end, e.cause);
			// An exit after what was already sent: a child's output is read before its end, as a real one's is.
			else if ('exit' in e) setImmediate(() => end({ code: e.exit, signal: null }));
			// ⭐ L17b6 round 5 (§47.7, item 7) — and an end by a signal, the same way.
			else if ('signal' in e) setImmediate(() => end({ code: null, signal: e.signal }));
			// ⭐ L17b6 round 5 — ~~`return !('hold' in e) && !('exit' in e);`~~: and a signal's end stops the turn there too.
			return !('hold' in e) && !('exit' in e) && !('signal' in e);
		};
		/** ⭐ L17b6 round 5 (§47.7, item 1) — the cancel's own events (`atCancel`), in order, a request among them waited for; then the turn ended, or not. */
		let cancelQueue: FakeAcpEvent[] | undefined;
		const drainCancel = (): void => {
			while (!ended && waiting === undefined && cancelQueue !== undefined && cancelQueue.length > 0) if (!play(cancelQueue.shift()!)) return;
			if (ended || waiting !== undefined || cancelQueue === undefined) return;
			cancelQueue = undefined;
			if (script.onCancel !== 'ignore') endTurn('cancelled');
		};
		const next = (): void => {
			while (!ended && !turnOver && waiting === undefined && step < script.turn.length) {
				step += 1;
				if (!play(script.turn[step - 1]!)) return;
			}
		};
		/** devin's answers to the call's requests, by method, in the measured forms. */
		const onRequest: Readonly<Record<string, (id: unknown) => void>> = {
			initialize: (id) =>
				answer(id, 'initialize', {
					protocolVersion: 1,
					agentCapabilities: {
						loadSession: true,
						promptCapabilities: { image: true, audio: false, embeddedContext: true },
						mcpCapabilities: { http: true, sse: true },
						sessionCapabilities: { list: {}, delete: {}, additionalDirectories: {}, close: { _meta: { 'cognition.ai/force': true } } }
					},
					authMethods: [{ id: 'devin-browser', name: 'Log in with browser', description: 'Sign in via your browser' }],
					agentInfo: { name: 'affogato', title: 'Devin Agent', version: '0.0.0-dev' },
					_meta: script.initializeMeta ?? { mcpConfigPath: [FAKE_HOME, 'AppData', 'Roaming', 'devin', 'mcp_config.json'].join('\\') }
				}),
			'session/new': (id) => {
				emit({ jsonrpc: '2.0', method: '_cognition.ai/mcp/serversChanged', params: {} });
				emit({ jsonrpc: '2.0', method: '_cognition.ai/mcp/serversChanged', params: {} });
				// ⭐ L17b6 round 6 (§49.5, item 1) — here and below, ~~`CONFIG_OPTIONS(mode)`~~: and the script's model option, where it gives one.
				update({ sessionUpdate: 'config_option_update', configOptions: CONFIG_OPTIONS('accept-edits', script.modelOption) });
				update({ sessionUpdate: 'current_mode_update', currentModeId: 'accept-edits' });
				update({ sessionUpdate: 'available_commands_update', availableCommands: [{ name: 'login', description: 'Authenticate with an API key' }] });
				answer(id, 'session/new', {
					// ⭐ L17b6 round 5 (§47.7, item 4) — ~~`sessionId: FAKE_SESSION,`~~ always: the measured one, the script's, or none.
					...(script.newSessionId === undefined ? { sessionId: FAKE_SESSION } : script.newSessionId === null ? {} : { sessionId: script.newSessionId }),
					modes: { currentModeId: 'accept-edits', availableModes: ['accept-edits', 'smart', 'ask', 'plan', 'bypass'].map((m) => ({ id: m, name: m })) },
					configOptions: CONFIG_OPTIONS('accept-edits', script.modelOption),
					_meta: { 'cognition.ai/isLocked': false, 'cognition.ai/lockHolderPid': null }
				});
			},
			'session/set_mode': (id) => {
				update({ sessionUpdate: 'config_option_update', configOptions: CONFIG_OPTIONS('ask', script.modelOption) });
				update({ sessionUpdate: 'current_mode_update', currentModeId: 'ask' });
				answer(id, 'session/set_mode', {});
			},
			'session/prompt': (id) => {
				promptId = id;
				update({ sessionUpdate: 'session_info_update', title: 'You are the Historian of the assurance stage…' });
				update({ sessionUpdate: 'session_info_update', _meta: { 'cognition.ai/statusEnum': 'working' } });
				if (script.errors?.['session/prompt'] === undefined) return next();
				turnOver = true;
				answer(id, 'session/prompt', {});
			},
			// ⭐ L17b6 round 3 (§43.7) — ~~`'session/delete': (id) => answer(id, 'session/delete', {})`~~: or never answered, as the script says.
			'session/delete': (id) => {
				if (script.onDelete !== 'ignore') answer(id, 'session/delete', {});
			}
		};
		const onMessage = (msg: Record<string, unknown>): void => {
			const id = msg.id;
			if (typeof msg.method !== 'string') {
				// An answer to a request of the fake's.
				answers.push({ method: askedMethod.get(String(id)) ?? 'unknown', id, answer: msg });
				if (id === waiting) {
					waiting = undefined;
					// ⭐ L17b6 round 5 (§47.7, item 1) — ~~`next();`~~ alone: the cancel's own events go on first, where they are playing.
					if (cancelQueue === undefined) next();
					else drainCancel();
				}
				return;
			}
			const method = msg.method;
			// A notification: `session/cancel` alone is known.
			if (id === undefined) {
				// ⭐ L17b6 round 5 (§47.7, item 1) — where the script gives events for the cancel, those first (`atCancel`); else the cancel as before.
				if (method === 'session/cancel' && script.atCancel !== undefined && promptId !== undefined) {
					cancelQueue = [...script.atCancel];
					return drainCancel();
				}
				if (method === 'session/cancel' && script.onCancel !== 'ignore' && promptId !== undefined) endTurn('cancelled');
				return;
			}
			// ⭐ L17b6 round 5 (§47.7, item 3) — a method the script says devin never answers is never answered.
			if (script.neverAnswer?.includes(method) === true) return;
			const known = onRequest[method];
			if (known === undefined) emit({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
			else known(id);
		};
		const child: HistorianAcpChild = {
			pid: script.startError === undefined ? FAKE_PID : undefined,
			write: (line: string) => {
				if (ended) return;
				let msg: Record<string, unknown>;
				try {
					msg = JSON.parse(line) as Record<string, unknown>;
				} catch {
					received.push({ unparsed: line });
					return;
				}
				received.push(msg);
				onMessage(msg);
			},
			onLine: (listener) => {
				listeners.push(listener);
			},
			exited,
			closeStdin: () => {
				stops.push('stdin');
				if (script.onStdinClose !== 'ignore') setImmediate(() => end({ code: 0, signal: null }));
			},
			terminate: () => {
				stops.push('terminate');
				if (script.onTerminate !== 'ignore') setImmediate(() => end({ code: null, signal: 'SIGTERM' }));
			},
			kill: () => {
				stops.push('kill');
				// ⭐ L17b6 round 3 (§43.6) — ~~`setImmediate(() => end({ code: null, signal: 'SIGKILL' }));`~~ always: or not, as the script says.
				if (script.onKill !== 'ignore') setImmediate(() => end({ code: null, signal: 'SIGKILL' }));
			}
		};
		const startError = script.startError;
		if (startError !== undefined) setImmediate(() => end({ startError }));
		return child;
	};
	return { spawn, launches, received, answers, stops, methods: () => received.map(methodName) };
}

/** A written message's method; `answer` for an answer, `unparsed` for a line that is not JSON. */
function methodName(m: Record<string, unknown>): string {
	if (typeof m.method === 'string') return m.method;
	return m.unparsed === undefined ? 'answer' : 'unparsed';
}
