// ⭐⭐ `JAN-MHX` MH-4 (`DESIGN-multi-harness-executor.md` §4.1, D12–D24, D44a; the sponsor's S2) — THE devin DRIVER: what a
// devin executor's run folder holds, how devin is started and checked before its first turn, and how its export is read.
// The opener (`cli-executor-session.ts`) does everything else, once, for every CLI.
//
// ⭑ EVERY VALUE BELOW WAS MEASURED BY MH-0a, not read from documentation: devin 3000.11.92, 2026-10-18, two paid calls on
// deepseek-v4-1-flash-max (S2's model for a devin executor beside the GLM reviewer), through a stand-in of the shipping
// path — the bridge, a host server on 127.0.0.1 serving the minted schemas.
//   · `allow: ["mcp__jpwb__*"]` in the run folder's project config is what approves a host call made through devin's
//     carrier `mcp_call_tool` in print mode. Without it devin rejects the call, writes its rejection line on stderr,
//     exits 0 with blank stdout, and its export ends on the rejected call (call 2).
//   · `shell.setup_complete: true` in the `--config`. Without it, the account's org in the file, print mode waited on
//     devin's interactive setup screen ("We strongly recommend connecting your Git provider…") until the probe's bound
//     killed it (MH-0a's F1).
//   · The preflight is `devin --config <file> mcp list`, the global option before the subcommand: after it, devin refuses
//     ("error: unexpected argument '--config' found"). The listing connects to no server.
//   · The export is ATIF-v1.7. What devin offered its model is `agent.tool_definitions[].function.name`; a host call is
//     `mcp_call_tool` with `arguments.server_name` the host's server and `arguments.tool_name` the minted name, never an
//     `mcp__jpwb__*` function; a call devin rejected has the observation "Tool execution was rejected by the user"; and
//     every agent step names its model in `extra.generation_model`, the configured slug exactly.
//   · stdout is every agent step's message, then a line break, so the answer follows devin's blank lines.
//
// ⛔ WHAT THIS DRIVER DOES NOT HOLD, STATED (MH-0a's open questions, the lead's to rule):
//   · THE ACCOUNT'S `devin.org_id`, which MH-0a's passing call carried in its `--config` beside `setup_complete`. It is
//     account data, not this repository's, so the `--config` here is those bytes without it — a form no call has run, so
//     what devin does with it is unmeasured. ~~If devin then runs its first-run setup again, it writes the org into the
//     `--config` file, and the opener refuses the next turn for the changed file (D44a).~~ ⭐ `JAN-MHX` MH-4, the check's
//     fix — that was one outcome of two, and neither was measured on this form. The setup MH-0a did meet both wrote and
//     waited: with neither key, devin wrote the org into that `--config` itself and exited 1 after 673,729 ms; with the
//     org and no `setup_complete`, it was still waiting when the probe's bound killed it, at 420,294 ms. So on this form
//     devin may wait on its setup screen until the host's bound, the turn CALL_ABORTED (D18), or rewrite the `--config`
//     file, which refuses the next turn (D44a).
//   · THE SURFACE devin 3000.11.92 OFFERS beside its carriers: `ask_user_question`, `find_file_by_name`, `mcp_read_resource`
//     and `skill`, which this config does not remove (`skill` and `mcp_read_resource` are disabled, and offered anyway).
//     Each is a tool of devin's own offered to its model, so the opener fails every such turn `CLI_OWN_TOOL_RAN` and
//     marks the workspace (D14a, D21a), until a ruling and a probe say otherwise (MH-0a's F2). ⭐ `JAN-MHX` MH-4, the
//     check's fix — so the selector wires devin in test mode only (`execution/executor-selection.ts`, D30).
//   · A CALL devin rejects BEFORE sending it for an unknown name or a malformed argument: whether its export records one is
//     unmeasured. Only a rejection for want of approval was, and the export holds it.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type {
	CliDriver,
	CliRecordEvent,
	CliRecordReading,
	CliRunFile,
	CliRunFolder,
	CliToolRef
} from './cli-executor-session.js';
import { DEVIN_BIN_OVERRIDE } from './devin-reviewer.js';

/**
 * The tools the run folder's project config denies by name (§4.1). ⛔ NEVER `mcp__*`, the reviewer's deny: a deny always
 * wins, so it would block the host's tools too.
 */
const DENIED_TOOLS = ['read', 'edit', 'write', 'grep', 'glob', 'exec', 'web_search', 'Fetch(*)'];

/** Every other tool's configuration devin can read, each off (§4.1): the project config's and the `--config`'s. */
const READ_CONFIG_FROM_OFF = {
	agents_standard: false,
	cursor: false,
	windsurf: false,
	claude: false,
	copilot: false,
	opencode: false,
	zed: false
};

/** The 25 tools the `--config` disables (§4.1), in the order of the file MH-0a ran. */
const DISABLED_TOOLS = [
	'read',
	'notebook_read',
	'code_search',
	'grep',
	'glob',
	'edit',
	'write',
	'apply_patch',
	'notebook_edit',
	'exec',
	'shell_command',
	'get_output',
	'write_to_process',
	'kill_shell',
	'webfetch',
	'web_search',
	'view_image',
	'browser_preview',
	'close_browser_preview',
	'skill',
	'run_subagent',
	'read_subagent',
	'request_scope',
	'todo_write',
	'mcp_read_resource'
];

/**
 * ⭐ THE `--config` FILE'S BYTES: `JSON.stringify` of the design's file with `shell.setup_complete` added, two-space
 * indented, and a closing line break — the form MH-0a's passing call ran, without its `devin.org_id` (this file's header).
 */
const USER_CONFIG_BYTES = `${JSON.stringify(
	{
		version: 1,
		subagents_enabled: false,
		skip_workspace_trust: true,
		disabled_tools: DISABLED_TOOLS,
		read_config_from: READ_CONFIG_FROM_OFF,
		// ⭑ devin reaches the host's server through the bridge on 127.0.0.1, which no proxy may stand in front of.
		proxy: { mode: 'system', no_proxy: '127.0.0.1,localhost' },
		// ⛔ MH-0a's F1: without it, the org in the file, print mode waited on devin's setup screen until the probe's bound.
		shell: { setup_complete: true }
	},
	null,
	2
)}\n`;

/** The `--config` file, in the run folder's `host/`, outside devin's working folder. */
const USER_CONFIG_FILE = 'user-config.json';

/** ⭐ D21 — devin's own plumbing for reaching the host's server. */
const CARRIERS = ['mcp_list_servers', 'mcp_list_tools', 'mcp_call_tool'];

/** The export's schema, as MH-0a read it. */
const EXPORT_SCHEMA = 'ATIF-v1.7';

/** What a call's observation holds when devin rejected it for want of approval (MH-0a's call 2). */
const REJECTED_OBSERVATION = 'Tool execution was rejected by the user';

/** ⭐ D19, D24 — devin's rejection line on stderr, as MH-0a's call 2 printed it, to its first sentence. */
const REJECTION_LINE = 'warning: rejected a tool call that requires confirmation';

/** Where devin reads from and is installed: on this host, the user's home and Windows' two application-data folders. */
export interface DevinPlaces {
	readonly home: string;
	readonly appData: string;
	readonly localAppData: string;
}

/** This host's places, read once, when the driver is made. */
function hostPlaces(): DevinPlaces {
	const home = homedir();
	return {
		home,
		appData: process.env.APPDATA ?? join(home, 'AppData', 'Roaming'),
		localAppData: process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local')
	};
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** The lines of `text`, each trimmed, the blank ones left out. */
const trimmedLines = (text: string): string[] =>
	text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line !== '');

/** The refusal of a listing that names no MCP server. */
const NO_SERVER = 'it lists no MCP server, so devin does not read the run folder’s own entry.';

/**
 * ⭐ D14 — why devin's own listing of its MCP servers refuses the session, or `undefined` when the only server is the run
 * folder's own. ⭑ Every sentence is fixed: a server's name or path is the listing's to write, and a refusal reaches the
 * open's thrown message. ⚠ The listing names servers, never devin's built-in tools: the export proves those (D14a).
 */
function listingRefusal(
	output: { readonly exitCode: number | null; readonly stdout: string },
	run: CliRunFolder,
	home: string
): string | undefined {
	if (output.exitCode !== 0) return `it exited with status ${String(output.exitCode)}.`;
	const lines = trimmedLines(output.stdout);
	if (lines[0]?.startsWith('No MCP servers configured.')) return NO_SERVER;
	// ⛔ A LISTING OF ANOTHER SHAPE IS NO LISTING: a later devin's servers would not be read as this one's are.
	if (lines[0] !== 'Configured MCP servers:')
		return 'its output is not the listing this driver knows, so it shows nothing about devin’s MCP servers.';
	const servers = lines.filter((line) => line.startsWith('• ')).map((line) => line.slice(2).trim());
	if (servers.length !== 1)
		return `it lists ${servers.length} MCP servers, where the run folder’s own is the only one allowed.`;
	if (servers[0] !== run.serverName) return 'the one MCP server it lists is not the run folder’s own.';
	const sources = lines.filter((line) => line.startsWith('Source:'));
	if (sources.length !== 1)
		return 'it names no single source for its server, so nothing shows where the entry was read from.';
	// ⭑ devin writes a source under the home folder from `~` (MH-0a's listings: "Source: ~\AppData\Local\Temp\…").
	const source = sources[0]!.slice('Source:'.length).trim().replace(/^~(?=[\\/])/, () => home);
	const inside = relative(run.directory, resolve(source));
	if (inside === '' || inside.startsWith('..') || isAbsolute(inside))
		return 'its server’s source is outside the run folder.';
	return undefined;
}

/**
 * ⭐ D14a — what devin offered its model, by name, or `undefined` when the export holds no proof of it. `called` is every
 * function its agent steps called.
 */
function surfaceOf(agent: unknown, called: ReadonlySet<string>): CliToolRef[] | undefined {
	if (!isRecord(agent) || !Array.isArray(agent.tool_definitions)) return undefined;
	const names = agent.tool_definitions.map((definition) =>
		isRecord(definition) && isRecord(definition.function) && typeof definition.function.name === 'string'
			? definition.function.name
			: undefined
	);
	// ⛔ A DEFINITION THAT NAMES NO TOOL leaves the offer unknown, so nothing shows which tools devin offered.
	if (names.some((name) => name === undefined)) return undefined;
	// ⛔ `JAN-MHX` MH-4, the check's fix — A STEP THAT CALLS A FUNCTION THE OFFER DOES NOT HOLD: the record contradicts itself,
	// so its offer proves nothing about what devin offered. An empty offer beside any call is one such record.
	if ([...called].some((name) => !names.includes(name))) return undefined;
	// ⭑ Every one is devin's own: devin lists the host's tools through its carrier `mcp_list_tools`, never here (MH-0a).
	return names.map((name) => ({ party: 'OWN', name: name! }));
}

/** The ids of the calls a step's observation says devin rejected. */
function rejectedCallIds(observation: unknown): Set<unknown> {
	const results = isRecord(observation) && Array.isArray(observation.results) ? observation.results : [];
	return new Set(
		results
			.filter((r) => isRecord(r) && r.content === REJECTED_OBSERVATION)
			.map((r) => (r as Record<string, unknown>).source_call_id)
	);
}

/**
 * ⭐ D21 — one of devin's calls, as the opener merges it: a call to the host's server through devin's carrier, by the
 * minted name it asked for, or a tool of devin's own. ⭑ RAN, OR SENT, UNLESS THE EXPORT SAYS devin REJECTED IT.
 */
function eventOf(call: unknown, rejected: Set<unknown>, serverName: string): CliRecordEvent {
	const c = isRecord(call) ? call : {};
	const name = typeof c.function_name === 'string' ? c.function_name : '';
	const went = !rejected.has(c.tool_call_id);
	const args = isRecord(c.arguments) ? c.arguments : {};
	if (name === 'mcp_call_tool' && args.server_name === serverName && typeof args.tool_name === 'string')
		return { kind: 'HOST_CALL', name: args.tool_name, sent: went };
	// ⛔ THE CARRIER, REACHING A SERVER NOT THE HOST'S, IS NOT A CARRIER: whatever it did there the host never recorded.
	// Named so no carrier and no minted tool has its name (the opener records it as one of devin's own, NOT_MINTED).
	if (name === 'mcp_call_tool') return { kind: 'OWN_TOOL', name: 'mcp_call_tool (another server)', ran: went };
	return { kind: 'OWN_TOOL', name, ran: went };
}

/**
 * The sources of the steps MH-0a's exports held: devin's own system steps, the user's prompt, and the agent's steps. Only
 * an agent step named a model or carried a call.
 */
const MEASURED_STEP_SOURCES: readonly unknown[] = ['system', 'user', 'agent'];

/** One step of devin's export, as `readExport` takes it. */
type ExportStep =
	| {
			readonly read: 'AGENT';
			readonly step: Readonly<Record<string, unknown>>;
			readonly model: string;
			readonly calls: readonly unknown[];
	  }
	| { readonly read: 'PASSED_OVER' }
	| { readonly read: 'REFUSED' };

/**
 * ⛔ `JAN-MHX` MH-4, the check's fix — ONE STEP, READ ONLY IN A SHAPE MH-0a MEASURED: an agent step that names its model,
 * its calls a list; or a system or user step, passed over, that carries no call. Every other step is REFUSED, and its
 * export reads as one that could not be read: a step this reader passed over would take with it what it holds — the
 * model that served it, the tools devin ran in it.
 */
function exportStepOf(step: unknown): ExportStep {
	if (!isRecord(step) || !MEASURED_STEP_SOURCES.includes(step.source)) return { read: 'REFUSED' };
	const calls: unknown = step.tool_calls ?? [];
	if (!Array.isArray(calls)) return { read: 'REFUSED' };
	if (step.source !== 'agent') return calls.length > 0 ? { read: 'REFUSED' } : { read: 'PASSED_OVER' };
	const model = isRecord(step.extra) ? step.extra.generation_model : undefined;
	if (typeof model !== 'string' || model === '') return { read: 'REFUSED' };
	return { read: 'AGENT', step, model, calls };
}

/** The function a call of devin's names, or `''` when it names none. */
const functionNameOf = (call: unknown): string =>
	isRecord(call) && typeof call.function_name === 'string' ? call.function_name : '';

/**
 * ⭐ D20 — devin's export, read: its surface (D14a), its calls in its own order (D21), every model it reports (D22), and
 * the reasoning it returned (D23). The answer is stdout, after devin's blank lines.
 * ⛔ AN EXPORT OF ANOTHER SCHEMA, OR ONE WITH AN AGENT STEP THAT NAMES NO MODEL, IS NOT THE RECORD MH-0a MEASURED, and
 * reads as one that could not be read: nothing then shows which model served that step, and `PROVIDER_REPORTED` would
 * claim the provider said.
 * ⛔ `JAN-MHX` MH-4, the check's fix — AND SO DOES ONE WITH A STEP OF ANOTHER SHAPE (`exportStepOf`), OR WITH NO AGENT STEP
 * AT ALL: read, either would report less than it holds — no model, so the answer graded `HOST_CONFIGURED` and D22's
 * compare never asked, or no call where devin may have run one. D20: devin can hide steps from its export.
 */
function readExport(raw: string, stdout: string, serverName: string): CliRecordReading {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { read: 'UNPARSEABLE', raw };
	}
	if (!isRecord(parsed) || parsed.schema_version !== EXPORT_SCHEMA || !Array.isArray(parsed.steps))
		return { read: 'UNPARSEABLE', raw };
	const events: CliRecordEvent[] = [];
	const models = new Set<string>();
	const reasoning: string[] = [];
	const called = new Set<string>();
	let agentSteps = 0;
	for (const entry of parsed.steps) {
		const read = exportStepOf(entry);
		if (read.read === 'REFUSED') return { read: 'UNPARSEABLE', raw };
		if (read.read === 'PASSED_OVER') continue;
		const { step, model, calls } = read;
		agentSteps += 1;
		models.add(model);
		if (typeof step.reasoning_content === 'string' && step.reasoning_content.trim() !== '')
			reasoning.push(step.reasoning_content);
		// ⭑ THE STEP'S MESSAGE COMES BEFORE ITS CALLS, as the model wrote them; a message of blank lines is not the model
		// speaking — devin writes "\n\n" before its calls (MH-0a).
		if (typeof step.message === 'string' && step.message.trim() !== '') events.push({ kind: 'ASSISTANT_MESSAGE' });
		const rejected = rejectedCallIds(step.observation);
		for (const call of calls) {
			called.add(functionNameOf(call));
			events.push(eventOf(call, rejected, serverName));
		}
	}
	if (agentSteps === 0) return { read: 'UNPARSEABLE', raw };
	return {
		read: 'PARSED',
		raw,
		surface: surfaceOf(parsed.agent, called),
		events,
		reportedModels: [...models],
		answer: stdout.replace(/^(?:\r?\n)+/, ''),
		...(reasoning.length === 0 ? {} : { volunteeredReasoning: reasoning.join('\n\n') })
	};
}

/**
 * ⭐ D12 — devin's driver. `places` is where devin reads from and is installed: this host's own unless a test hands in
 * its own. ⭑ The program is the installed `devin.exe`, by absolute path, or — in test mode only, which the selector
 * enforces (D34) — the override `devin-reviewer.ts` captured when it loaded, the one capture both roles share.
 */
export function devinExecutorDriver(places: DevinPlaces = hostPlaces()): CliDriver {
	const program = DEVIN_BIN_OVERRIDE ?? join(places.localAppData, 'devin', 'cli', 'bin', 'devin.exe');
	const userConfigOf = (run: CliRunFolder): string => join(run.hostDirectory, USER_CONFIG_FILE);
	return {
		toolId: 'devin',
		carriers: CARRIERS,
		// ⭐ D44a — the sources MH-0a fingerprinted, none of which changed by itself in its four launches.
		configSources: [
			{ name: '%APPDATA%/devin/config.json', path: join(places.appData, 'devin', 'config.json') },
			{ name: '%APPDATA%/devin/mcp_config.json', path: join(places.appData, 'devin', 'mcp_config.json') },
			{ name: '%APPDATA%/devin/AGENTS.md', path: join(places.appData, 'devin', 'AGENTS.md') },
			{ name: '%APPDATA%/devin/skills', path: join(places.appData, 'devin', 'skills') },
			{ name: '~/.claude/settings.json', path: join(places.home, '.claude', 'settings.json') }
		],
		environment: {},
		// ⭐ D44 — devin's session store, in the run folder's `host/`: removed with it (MH-0a: devin honours the variable).
		runEnvironment: (run) => ({ DEVIN_SESSIONS_DIR: join(run.hostDirectory, 'sessions') }),
		runFolderFiles(run): readonly CliRunFile[] {
			return [
				{
					path: 'cli/.devin/config.json',
					bytes: `${JSON.stringify(
						{
							permissions: { deny: DENIED_TOOLS, allow: [`mcp__${run.serverName}__*`] },
							read_config_from: READ_CONFIG_FROM_OFF
						},
						null,
						2
					)}\n`
				},
				{
					path: 'cli/.devin/mcp_config.json',
					bytes: `${JSON.stringify(
						{ mcpServers: { [run.serverName]: { command: run.nodePath, args: [run.bridgePath, run.endpointPath] } } },
						null,
						2
					)}\n`
				},
				{ path: `host/${USER_CONFIG_FILE}`, bytes: USER_CONFIG_BYTES }
			];
		},
		preflight(run) {
			return {
				invocation: { program, args: ['--config', userConfigOf(run), 'mcp', 'list'] },
				refusal: (output) => listingRefusal(output, run, places.home)
			};
		},
		invocation(turn) {
			return {
				program,
				args: [
					'--print',
					'--model',
					turn.modelId,
					'--prompt-file',
					turn.promptPath,
					'--export',
					join(turn.run.hostDirectory, `export-${turn.turn}.json`),
					// ⭑ The run folder is fresh, so untrusted by construction; isolation is the control (the reviewer's reason).
					'--respect-workspace-trust',
					'false',
					'--config',
					userConfigOf(turn.run)
				]
			};
		},
		async readRecord(output) {
			let raw: string;
			try {
				raw = await readFile(join(output.run.hostDirectory, `export-${output.turn}.json`), 'utf8');
			} catch (e) {
				// ⭑ devin only warns when it fails to write its export (D20): that is an absent record, and the turn fails.
				if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { read: 'ABSENT' };
				throw e;
			}
			return readExport(raw, output.stdout, output.run.serverName);
		},
		classifyStderr(lines) {
			return lines.some((line) => line.startsWith(REJECTION_LINE)) ? { rejectedACall: true } : {};
		}
	};
}
