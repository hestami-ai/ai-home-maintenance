// ⭐⭐ `JAN-MHX` MH-6 (`DESIGN-multi-harness-executor.md` §4.3, D14a, D19, D21, D22, D44a) — THE CODEX DRIVER: what differs
// when the Codex CLI executes a work unit through the host's own tools. Everything the CLIs share is the opener's
// (`cli-executor-session.ts`, D12); this file says only what Codex needs and how to read what it writes back.
//
// ⭑ EVERY VALUE HERE IS ONE MH-0c MEASURED, on codex-cli 0.162.1 on this host: Probe 0's arms against a local mock of the
// Responses API, and Probe 1's two live calls on gpt-5.6-sol at high effort, on the operator's ChatGPT login (the sponsor's
// S3). Where a measurement moved the design, the line says which:
//   · THE CATALOG (`codex-executor-catalog.json`) is the bytes Probe 1's second call ran with: §4.3's host-only catalog with
//     `supports_search_tool: false`. With search on, Codex offered the host's tools only behind `tool_search`, and live
//     gpt-5.6-sol could not load them: Probe 1's first call called no host tool and answered BLOCKED (MH-0c F1).
//   · THE ARGV is §4.3's, with `--strict-config` (an unknown `-c` key is otherwise only ignored, F6) and `--ignore-rules`
//     (the execpolicy rules files §4.3 left on, F7) — Probe 1's second call's, element for element.
//
// ⛔ THE SURFACE PROOF (D14a) IS A MEASUREMENT OF ONE VERSION AND ONE CATALOG, NOT OF THE TURN. Codex's `--json` record lists
// no tools, so nothing a turn leaves shows what Codex offered its model. What Probe 0's mock saw in the request, with these
// flags and this catalog, is Codex's four functions of its own beside the host's (`MEASURED_OWN_SURFACE`, F2), and the
// driver holds every turn to the conditions it was measured under: the preflight refuses any other `codex --version`, and
// a model or effort the catalog does not hold, before the first turn. The run report says the surface is the measured
// version's (D37).
//
// ⭑ WHAT THE RECORD HOLDS, AND WHAT IT DOES NOT (D20, D21).
//   · An `mcp_tool_call` on `jpwb` that names a host tool is a host call; one that names Codex's resource functions is
//     Codex's own carrier, which the host's server refuses (F5). A `command_execution`, `file_change`, `web_search`,
//     `collab_tool_call`, or any item type this driver does not know, is a tool of Codex's own: one not DECLINED ran.
//   · ⚠ A CALL CODEX REJECTED BEFORE IT WAS SENT IS IN NO JSONL ITEM (F4): an unknown name, a tool it does not offer, a
//     patch or a command its sandbox refused. Codex says so only on its error stream, with no place in the record's
//     order, so the attempt cannot be recorded among the calls as Pi's would be. The driver reads such a line as an
//     error (`CLI_ERROR`), so a turn that holds an attempt it cannot place is not accepted as though it held every one.
//   · The model is never named (HOST_CONFIGURED). A `model rerouted: <from> -> <to>` notice is the one substitution
//     signal Probe 0 found (F10), and the driver reports `<to>` as the model that served, so the opener fails the turn.
//
// ⚠ THE RESIDUALS, STATED.
//   · `enabled_tools` names both host tools whatever the grant minted; it was measured only with both served. A grant of
//     one is served one by the host (D3), and what Codex makes of a name the server does not list is unmeasured.
//   · Only `high` was run live. The other efforts the catalog lists are admitted because Codex validates them against the
//     same catalog; the surface at each is Probe 0's measurement at `high`.
//   · Other Codex processes on this host write `~/.codex` (F17), so only the declared sources below refuse a turn.
//   · Codex still contacts OpenAI before its first model call, and sends the run folder's absolute path with every request
//     (F16); and its base instructions, in the catalog, still say to use `apply_patch`, which is not offered.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import CODEX_CATALOG from './codex-executor-catalog.json' with { type: 'json' };
import type {
	CliDriver,
	CliExecutorSelection,
	CliRecordEvent,
	CliRecordReading,
	CliRunFolder,
	CliStderrSignals,
	CliToolRef,
	CliTurnOutput
} from './cli-executor-session.js';

/**
 * ⭐ `JAN-MHX` MH-3 (D34), MH-6 — `JPWB_CODEX_BIN`, CAPTURED WHEN THIS MODULE LOADS, as `devin-reviewer.ts` captures
 * `JPWB_DEVIN_BIN`: the adapter runs what it captured, and the selector refuses the same capture outside test mode
 * (`execution/executor-selection.ts`). `undefined` is unset; `''` is SET, to an empty program name.
 */
export const CODEX_BIN_OVERRIDE: string | undefined = process.env.JPWB_CODEX_BIN;

/** The one version MH-0c measured (D14a). ⛔ Any other is refused before the first turn. */
const CODEX_VERSION = 'codex-cli 0.162.1';

/** The model the pinned catalog holds — the one model this driver runs. */
const CATALOG_MODEL: string = CODEX_CATALOG.models[0]!.slug;

/** The efforts the pinned catalog lists for that model, which Codex validates the configured one against. */
const CATALOG_EFFORTS: readonly string[] = CODEX_CATALOG.models[0]!.supported_reasoning_levels.map(
	(l) => l.effort
);

/** The catalog's bytes, as Probe 1's second call read them: the file is the measured file, and serialises to it whole. */
const CATALOG_BYTES = JSON.stringify(CODEX_CATALOG);

/** §4.3's `--disable` set, one feature per flag, as Probe 0 measured Codex takes them. */
const DISABLED_FEATURES = [
	'shell_tool',
	'plugins',
	'apps',
	'multi_agent',
	'browser_use',
	'computer_use',
	'in_app_browser',
	'image_generation',
	'view_image',
	'memories',
	'goals',
	'hooks',
	'sleep_tool',
	'tool_suggest',
	'skill_search'
];

/** Codex's functions that reach an MCP server's resources: through `jpwb`, they reach only the host, which refuses them. */
const RESOURCE_FUNCTIONS: ReadonlySet<string> = new Set([
	'list_mcp_resources',
	'list_mcp_resource_templates',
	'read_mcp_resource'
]);

/**
 * ⭐ D14a — WHAT CODEX OFFERED ITS MODEL OF ITS OWN, with these flags and this catalog, as Probe 0's mock saw the request
 * (MH-0c F2): its three resource functions and `request_user_input`. ⭑ The host's part of the surface is what the host's
 * server listed (D3), which `enabled_tools` names again; it is not declared here, because the grant decides it.
 */
const MEASURED_OWN_SURFACE: readonly CliToolRef[] = [
	...RESOURCE_FUNCTIONS,
	'request_user_input'
].map((name) => ({
	party: 'OWN',
	name
}));

/**
 * ⭐ D21 — THE TOOLS OF CODEX'S OWN THE MEASURED SURFACE OFFERS, each one a turn may hold without a breach.
 *   · The three resource functions are carriers proper: Codex's plumbing to an MCP server, and through `jpwb` they reach
 *     the host's server, which answers `resources/*` with a JSON-RPC error. One that ran is passed over; one refused is a
 *     refused attempt (the opener's rule).
 *   · ⚠ `request_user_input` IS NOT PLUMBING. It is listed because the measured surface offers it, and the opener holds
 *     every offered tool of a CLI's own to this list: Codex refuses it itself in exec mode ("request_user_input is
 *     unavailable in Default mode", Probe 0's A22), it reaches no server and no file, and an attempt at it shows only on
 *     the error stream, which this driver reads as an error.
 */
const CODEX_CARRIERS: readonly string[] = MEASURED_OWN_SURFACE.map((t) => t.name);

/** What Codex wrote when it refused a host call for want of approval: the call never reached the host (MH-0c F12). */
const NOT_SENT_FOR_APPROVAL = 'MCP tool call requires approval, but approval policy is never';

/** The two transport notices Probe 0 measured, each followed by a turn that completed (A14). */
const BENIGN_NOTICES = ['Reconnecting... ', 'Falling back from WebSockets to HTTPS transport'];

/** The substitution signal Probe 0 measured (F10). */
const REROUTED = 'model rerouted: ';

/** A line of Codex's tool router on its error stream: the timestamp, the level, the component, then what it says. */
const ROUTER_LINE = /^\S+\s+ERROR codex_core::tools::router: error=(.*)$/;

/** The router lines that echo a resource call its JSONL also holds, in order (Probe 1's first call; A21). */
const MIRRORED_IN_THE_RECORD = [
	'resources/list failed: ',
	'resources/templates/list failed: ',
	'resources/read failed: '
];

/**
 * ⭐ D19a — THE ROUTER'S REJECTIONS PROBE 0 MEASURED, each with the words an excerpt may carry: Codex's own, cut before
 * the name or the command the MODEL chose, which follows them.
 */
const ROUTER_REJECTIONS: readonly {
	readonly said: (text: string) => boolean;
	readonly words: string;
}[] = [
	// An unknown name, or a tool Codex does not offer (A7, A8, A8b).
	{ said: (t) => t.startsWith('unsupported call: '), words: 'unsupported call' },
	// An `apply_patch` Codex does not offer (A5, A6).
	{
		said: (t) => t.startsWith('unsupported custom tool call: '),
		words: 'unsupported custom tool call'
	},
	// The one function of its own Codex offers and refuses (A22).
	{
		said: (t) => t === 'request_user_input is unavailable in Default mode',
		words: 'request_user_input is unavailable in Default mode'
	},
	// A patch the read-only sandbox refused (A3, A4b).
	{
		said: (t) =>
			t ===
			'patch rejected: writing is blocked by read-only sandbox; rejected by user approval settings',
		words:
			'patch rejected: writing is blocked by read-only sandbox; rejected by user approval settings'
	},
	// A shell command the sandbox refused (A7r).
	{ said: (t) => t.startsWith('exec_command failed: '), words: 'exec_command failed' }
];

/** A character a TOML literal string cannot carry: its own quote, a control character. */
// eslint-disable-next-line no-control-regex
const NOT_TOML_LITERAL = /['\u0000-\u001f\u007f]/;

/** A refusal of the session, in the opener's words for one. */
const refusedBecause = (reason: string): Error =>
	new Error(`The CLI executor session for 'codex' is refused: ${reason}`);

/**
 * Codex's own executable, by absolute path, where the npm install put it on the one platform MH-0c measured, Windows x64 —
 * or why there is none to name. ⚠ On any other platform that path holds nothing, so the preflight cannot start it, and
 * the session is refused there (D14).
 */
function measuredProgram(): { readonly program: string } | { readonly refusal: string } {
	const appData = process.env.APPDATA;
	if (appData === undefined || !isAbsolute(appData))
		return {
			refusal:
				'its program is Codex’s own executable under %APPDATA%, where the npm install places it, and %APPDATA% is ' +
				'unset or not an absolute path.'
		};
	return {
		// ⛔ NEVER THE npm SHIM (`codex.cmd`, `codex.ps1`): node will not start a batch file with the shell off, and the
		// shim is not what MH-0c measured.
		program: join(
			appData,
			'npm',
			'node_modules',
			'@openai',
			'codex',
			'node_modules',
			'@openai',
			'codex-win32-x64',
			'vendor',
			'x86_64-pc-windows-msvc',
			'bin',
			'codex.exe'
		)
	};
}

/** A version string a refusal may print, or a sentence saying it was not printed. */
function printableVersion(text: string): string {
	return /^[A-Za-z0-9._ -]{1,60}$/.test(text) ? `'${text}'` : 'a version this host will not print';
}

/** A JSON object, or `undefined`. */
function objectOf(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

/** A string field, or `undefined`. */
function textOf(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

/** A line's JSON, or `undefined` when it is not JSON. */
function jsonOf(line: string): unknown {
	try {
		return JSON.parse(line);
	} catch {
		return undefined;
	}
}

/** Whether a notice is one of the transport notices Probe 0 measured before a turn that completed. */
const isBenign = (said: string): boolean =>
	BENIGN_NOTICES.some((notice) => said.startsWith(notice));

/** Every non-blank line of the JSONL as an event with a type, or `undefined` when any line is not one. */
function jsonEvents(raw: string): Record<string, unknown>[] | undefined {
	const events: Record<string, unknown>[] = [];
	for (const line of raw.split(/\r?\n/)) {
		if (line.trim() === '') continue;
		const event = objectOf(jsonOf(line));
		if (event === undefined || typeof event.type !== 'string') return undefined;
		events.push(event);
	}
	return events;
}

/** What the turn's events say of its shape and its items, before the items are read. */
interface TurnShape {
	/** Each item's id, where it first appeared. */
	readonly order: string[];
	/** Each item in its last state. */
	readonly items: Map<string, Record<string, unknown>>;
	threads: number;
	terminals: number;
	terminalAt: number | undefined;
	/** The turn failed, with Codex's message or none. */
	failed: { readonly message: string | undefined } | undefined;
	/** An error event of no shape this driver knows. */
	unknownError: boolean;
}

/** Add one item event's item to the shape; `false` when it carries no id or no type. */
function itemTallied(shape: TurnShape, value: unknown): boolean {
	const item = objectOf(value);
	const id = textOf(item?.id);
	if (item === undefined || id === undefined || typeof item.type !== 'string') return false;
	if (!shape.items.has(id)) shape.order.push(id);
	shape.items.set(id, item);
	return true;
}

/** Add one event to the shape; `false` for an event of a type this version does not write. */
function tallied(shape: TurnShape, event: Record<string, unknown>, at: number): boolean {
	switch (event.type) {
		case 'thread.started':
			shape.threads += 1;
			return true;
		case 'turn.started':
			return true;
		case 'item.started':
		case 'item.updated':
		case 'item.completed':
			return itemTallied(shape, event.item);
		case 'turn.completed':
			shape.terminals += 1;
			shape.terminalAt = at;
			return true;
		case 'turn.failed':
			shape.terminals += 1;
			shape.terminalAt = at;
			shape.failed = { message: textOf(objectOf(event.error)?.message) };
			return true;
		case 'error':
			if (!isBenign(textOf(event.message) ?? '')) shape.unknownError = true;
			return true;
		default:
			return false;
	}
}

/** The turn's shape, or `undefined` when an event is one this driver cannot read. */
function turnShapeOf(events: readonly Record<string, unknown>[]): TurnShape | undefined {
	const shape: TurnShape = {
		order: [],
		items: new Map(),
		threads: 0,
		terminals: 0,
		terminalAt: undefined,
		failed: undefined,
		unknownError: false
	};
	for (const [at, event] of events.entries()) if (!tallied(shape, event, at)) return undefined;
	return shape;
}

/** An `mcp_tool_call` item, as a call of the host's or a tool of Codex's own. */
function mcpCallOf(
	item: Record<string, unknown>,
	serverName: string
): CliRecordEvent | 'UNREADABLE' {
	const server = textOf(item.server);
	const tool = textOf(item.tool);
	const status = textOf(item.status);
	if (server === undefined || tool === undefined || status === undefined) return 'UNREADABLE';
	// ⛔ ANOTHER SERVER IS A TOOL OF CODEX'S OWN, named by its kind, never by its tool: a server of the operator's could
	// name a tool as a carrier is named.
	if (server !== serverName)
		return { kind: 'OWN_TOOL', name: 'mcp_tool_call', ran: status !== 'declined' };
	// ⭐ MH-0c F5 — Codex's resource functions reach the host's server, which refuses them: they are carriers, and one
	// that did not complete was refused.
	if (RESOURCE_FUNCTIONS.has(tool))
		return { kind: 'OWN_TOOL', name: tool, ran: status === 'completed' };
	// ⭐ MH-0c F12 — a call Codex refused for approval, or declined, never reached the host. Any other failure did, or is
	// left to the opener's cross-check with the host's own calls, which fails the turn on a mismatch (D21).
	const refusedForApproval =
		status === 'failed' && textOf(objectOf(item.error)?.message) === NOT_SENT_FOR_APPROVAL;
	return { kind: 'HOST_CALL', name: tool, sent: status !== 'declined' && !refusedForApproval };
}

/** What the items say, read in the order they first appeared. */
interface ItemReading {
	readonly events: CliRecordEvent[];
	readonly reportedModels: string[];
	readonly reasoning: string[];
	unknownError: boolean;
}

/** Read one notice item into `out`; `false` when it carries no message. */
function noticeRead(out: ItemReading, said: string | undefined): boolean {
	if (said === undefined) return false;
	// ⭐ MH-0c F10 — the model that served, from the reroute notice; the opener fails the turn on it (D22).
	if (said.startsWith(REROUTED))
		out.reportedModels.push(
			/^model rerouted: \S+ -> (\S+)/.exec(said)?.[1] ?? said.slice(REROUTED.length).trim()
		);
	else if (!isBenign(said)) out.unknownError = true;
	return true;
}

/** Read one item into `out`; `false` when it is one this driver cannot read. */
function itemRead(out: ItemReading, item: Record<string, unknown>, serverName: string): boolean {
	switch (item.type) {
		case 'agent_message':
			out.events.push({ kind: 'ASSISTANT_MESSAGE' });
			return true;
		case 'reasoning': {
			// ⭐ D23 — volunteered reasoning, never the answer.
			const text = textOf(item.text);
			if (text !== undefined) out.reasoning.push(text);
			return text !== undefined;
		}
		case 'error':
			return noticeRead(out, textOf(item.message));
		case 'mcp_tool_call': {
			const event = mcpCallOf(item, serverName);
			if (event !== 'UNREADABLE') out.events.push(event);
			return event !== 'UNREADABLE';
		}
		default:
			// ⛔ A COMMAND, A FILE CHANGE, A WEB SEARCH, A COLLABORATION CALL, OR ANY TYPE THIS DRIVER DOES NOT KNOW: a tool of
			// Codex's own, which RAN unless Codex declined it — a failed command is one that ran and exited non-zero.
			out.events.push({
				kind: 'OWN_TOOL',
				name: item.type as string,
				ran: item.status !== 'declined'
			});
			return true;
	}
}

/** The items read, or `undefined` when one is unreadable. */
function itemsRead(shape: TurnShape, serverName: string): ItemReading | undefined {
	const out: ItemReading = { events: [], reportedModels: [], reasoning: [], unknownError: false };
	for (const id of shape.order)
		if (!itemRead(out, shape.items.get(id)!, serverName)) return undefined;
	return out;
}

/**
 * ⭐ D19a — the error a turn's record holds: `turn.failed`'s message, the known shape, as its excerpt; a `turn.failed` with
 * no message, and an error of no shape this driver knows, are errors with none, so the code stands alone (the opener's
 * `CLI_ERROR` takes an empty excerpt as no excerpt). `undefined`: the record holds no error.
 */
function errorExcerptOf(shape: TurnShape, read: ItemReading): string | undefined {
	if (shape.failed !== undefined) return shape.failed.message ?? '';
	return shape.unknownError || read.unknownError ? '' : undefined;
}

/** The last message Codex wrote to this turn's `-o` file, or `undefined`: none was written, so none arrived. */
async function lastMessage(output: CliTurnOutput): Promise<string | undefined> {
	try {
		return await readFile(join(output.run.hostDirectory, `last-${output.turn}.txt`), 'utf8');
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw e;
	}
}

/**
 * ⭐ D14a, D20–D23 — CODEX'S JSONL, READ WHOLE OR NOT AT ALL. Every line must be a JSON event of a type this version
 * writes; every item must carry an id and a type. Items are placed where each first appeared, in its last state.
 */
async function readCodexRecord(output: CliTurnOutput): Promise<CliRecordReading> {
	const raw = output.stdout;
	if (raw.trim() === '') return { read: 'ABSENT' };
	const events = jsonEvents(raw);
	const shape = events === undefined ? undefined : turnShapeOf(events);
	const read = shape === undefined ? undefined : itemsRead(shape, output.run.serverName);
	if (events === undefined || shape === undefined || read === undefined)
		return { read: 'UNPARSEABLE', raw };
	// ⛔ THE SURFACE IS DECLARED ONLY FOR ONE WHOLE TURN: one `thread.started`, and it first; one terminal event, and it
	// last. The version pin and the catalog are the proof only of a turn Codex ran to its end.
	const wholeTurn =
		events[0]?.type === 'thread.started' &&
		shape.threads === 1 &&
		shape.terminals === 1 &&
		shape.terminalAt === events.length - 1;
	const errorExcerpt = errorExcerptOf(shape, read);
	return {
		read: 'PARSED',
		raw,
		surface: wholeTurn ? MEASURED_OWN_SURFACE : undefined,
		events: read.events,
		reportedModels: read.reportedModels,
		answer: await lastMessage(output),
		...(read.reasoning.length === 0 ? {} : { volunteeredReasoning: read.reasoning.join('\n\n') }),
		...(errorExcerpt === undefined ? {} : { errorExcerpt })
	};
}

/**
 * ⭐ D24, MH-0c F4 — WHAT CODEX SAYS ONLY ON ITS ERROR STREAM: a call its router refused before it was sent. Read as an
 * error, with Codex's own words for the refusal and never what follows them. ⭑ A resource call's failure is passed
 * over: the JSONL holds it, in order.
 */
function classifyCodexLines(lines: readonly string[]): CliStderrSignals {
	for (const line of lines) {
		const said = ROUTER_LINE.exec(line)?.[1];
		if (said === undefined || MIRRORED_IN_THE_RECORD.some((prefix) => said.startsWith(prefix)))
			continue;
		const known = ROUTER_REJECTIONS.find((rejection) => rejection.said(said));
		return { errorExcerpt: `codex_core::tools::router: ${known?.words ?? 'error'}` };
	}
	return {};
}

/**
 * ⛔ EVERY PATH THE ARGV WRITES INTO A TOML LITERAL STRING must be one it can carry: a quote would end the string, and
 * Codex would read the rest as configuration. Named by its part, never printed (D42).
 */
function refuseUnwritablePaths(run: CliRunFolder): void {
	for (const [part, path] of [
		['the host folder', run.hostDirectory],
		['the node runtime', run.nodePath],
		['the bridge', run.bridgePath],
		['the endpoint file', run.endpointPath]
	] as const)
		if (NOT_TOML_LITERAL.test(path))
			throw refusedBecause(
				`${part}'s path holds a character a TOML literal string cannot carry, and the argv names it in one.`
			);
	if (!/^[A-Za-z0-9_-]+$/.test(run.serverName))
		throw refusedBecause('the MCP server’s name cannot be written as a bare TOML key.');
}

/**
 * ⛔ THE CONDITIONS THE SURFACE WAS MEASURED UNDER (D14a), asked before any turn: the catalog's model, and an effort the
 * catalog lists — which is also what keeps the effort's TOML string to a word.
 */
function refuseUnmeasuredSelection(selection: CliExecutorSelection): void {
	if (selection.modelId !== CATALOG_MODEL)
		throw refusedBecause(
			`it runs only the model its pinned catalog holds, ${CATALOG_MODEL}, and this session names ` +
				`${JSON.stringify(selection.modelId)}: another model's tool surface was never measured.`
		);
	if (selection.effort === undefined || !CATALOG_EFFORTS.includes(selection.effort))
		throw refusedBecause(
			`its effort must be one its pinned catalog lists (${CATALOG_EFFORTS.join(', ')}), and this session names ` +
				`${selection.effort === undefined ? 'none' : JSON.stringify(selection.effort)}.`
		);
}

/** ⛔ D14a — the refusal of what `codex --version` printed, or `undefined` for the one version MH-0c measured. */
function versionRefusal(exitCode: number | null, stdout: string): string | undefined {
	if (exitCode !== 0)
		return `\`codex --version\` exited with ${exitCode}, so its version could not be read.`;
	const version = stdout.trim();
	if (version === CODEX_VERSION) return undefined;
	return (
		`it reports ${printableVersion(version)}, and this driver was measured on ${CODEX_VERSION} only: another ` +
		'version’s tool surface was never seen (JAN-MHX D14a).'
	);
}

/** The Codex CLI's driver (§4.3), as `cli-executor-drivers.ts` hands it to the opener. */
export function codexExecutorDriver(): CliDriver {
	const found =
		CODEX_BIN_OVERRIDE === undefined ? measuredProgram() : { program: CODEX_BIN_OVERRIDE };
	const home = homedir();
	const programOrRefuse = (): string => {
		if ('refusal' in found) throw refusedBecause(found.refusal);
		return found.program;
	};
	return {
		toolId: 'codex',
		carriers: CODEX_CARRIERS,
		// ⭐ D44a — `config.toml` and the rules folder are ignored by `--ignore-user-config` and `--ignore-rules`, and
		// fingerprinted anyway; the global `AGENTS.md` reaches the model despite both (MH-0c F8), and `run_command` can
		// write it.
		configSources: [
			{ name: '~/.codex/config.toml', path: join(home, '.codex', 'config.toml') },
			{ name: '~/.codex/AGENTS.md', path: join(home, '.codex', 'AGENTS.md') },
			{ name: '~/.codex/rules', path: join(home, '.codex', 'rules') }
		],
		// ⭑ D43 — the allowlist alone: Codex runs on the operator's ChatGPT login in its own home (S3), which the allowlist's
		// home variables reach, and no key.
		environment: {},
		runFolderFiles(run) {
			refuseUnwritablePaths(run);
			return [{ path: 'host/catalog.json', bytes: CATALOG_BYTES }];
		},
		preflight(_run, selection) {
			refuseUnmeasuredSelection(selection);
			return {
				invocation: { program: programOrRefuse(), args: ['--version'] },
				refusal: ({ exitCode, stdout }) => versionRefusal(exitCode, stdout)
			};
		},
		invocation(turn) {
			const run = turn.run;
			return {
				program: programOrRefuse(),
				args: [
					'exec',
					'--ignore-user-config',
					'--skip-git-repo-check',
					'--ephemeral',
					'--json',
					'-o',
					join(run.hostDirectory, `last-${turn.turn}.txt`),
					'-C',
					run.cliDirectory,
					'-s',
					'read-only',
					'-m',
					turn.modelId,
					'-c',
					`model_reasoning_effort="${turn.effort}"`,
					'-c',
					'approval_policy="never"',
					'-c',
					'approvals_reviewer="user"',
					'-c',
					'web_search="disabled"',
					'-c',
					'project_doc_max_bytes=0',
					'-c',
					`model_catalog_json='${join(run.hostDirectory, 'catalog.json')}'`,
					...DISABLED_FEATURES.flatMap((feature) => ['--disable', feature]),
					'-c',
					`mcp_servers.${run.serverName}={command='${run.nodePath}', args=['${run.bridgePath}', '${run.endpointPath}'], ` +
						'required=true, startup_timeout_sec=30, tool_timeout_sec=180, default_tools_approval_mode="approve", ' +
						'enabled_tools=["write_file", "run_command"], supports_parallel_tool_calls=false}',
					'--strict-config',
					'--ignore-rules',
					'-'
				],
				// ⭐ D15, D40 — the prompt on stdin, the preamble and the contract at its head: never in argv.
				stdin: turn.prompt
			};
		},
		readRecord: readCodexRecord,
		classifyStderr: classifyCodexLines
	};
}
