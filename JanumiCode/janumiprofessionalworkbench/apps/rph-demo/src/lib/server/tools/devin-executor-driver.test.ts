// ⭐⭐ `JAN-MHX` MH-4 — the victim for THE devin DRIVER (`DESIGN-multi-harness-executor.md` §4.1; roadmap MH-4 tests 1–6).
//
// ⭑ TWO KINDS OF CASE. The run folder's files, the argv and the preflight's refusal are the driver's alone, so they are
// asked of it directly. What devin's export and stderr make of a turn is the opener's classification over the driver's
// reading, so those cases run the REAL opener with a `CliExec` seam playing devin: it reads the MCP entry the driver wrote
// into `cli/.devin/`, finds the endpoint file that entry names, calls the REAL host tool server with the turn's token, and
// writes an export in the shape MH-0a measured (devin 3000.11.92, ATIF-v1.7) at the path its argv names. No model is
// called, and no devin is started.
// ⚠ Every directory is under `os.tmpdir()`, never under the repository. The fixtures carry MH-0a's field names and values,
// never its files, which hold the operator's paths.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import type { ProcessRunOutcome, ProcessRunner } from '@janumipwb/rph-ports';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import type { ProducerSession, ProducerSessionContext } from '../execution/producer-session.js';
import { readWorkspaceTaint } from '../execution/workspace-taint.js';
import type { ToolInvocationResult } from './backing-tool.js';
import {
	openCliExecutionSession,
	type CliExec,
	type CliExecRequest,
	type CliRun,
	type CliRunFolder
} from './cli-executor-session.js';
import { devinExecutorDriver } from './devin-executor-driver.js';
import { DEVIN_BIN_OVERRIDE } from './devin-reviewer.js';

let container = '';
let workspaceDir = '';
let root = '';
const sessions: ProducerSession[] = [];

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-devin-driver-'));
	workspaceDir = join(container, 'workspace');
	root = join(container, 'root');
	mkdirSync(workspaceDir);
});
afterEach(async () => {
	for (const s of sessions.splice(0)) s.dispose();
	await new Promise((r) => setTimeout(r, 400));
	await rm(container, { recursive: true, force: true, maxRetries: 5 });
});

/** S2's model for a devin executor, beside the GLM reviewer — the model MH-0a's calls ran. */
const MODEL = 'deepseek-v4-1-flash-max';
const SELECTION = { kind: 'CLI', toolId: 'devin', modelId: MODEL } as const;

/**
 * The places the driver reads from, inside this test's container: the home folder, so devin's listing names its
 * sources under `~` as it does on this host, and the two application-data folders its config sources and program live in.
 */
const places = () => ({
	home: container,
	appData: join(container, 'AppData', 'Roaming'),
	localAppData: join(container, 'AppData', 'Local')
});
const driver = () => devinExecutorDriver(places());

/** A run folder as the opener hands it to a driver, under this test's container. */
function runFolder(): CliRunFolder {
	const directory = join(root, 'jpwb-exec-devin-1-AbC123');
	return {
		directory,
		cliDirectory: join(directory, 'cli'),
		hostDirectory: join(directory, 'host'),
		bridgePath: join(directory, 'host', 'jpwb-bridge.mjs'),
		endpointPath: join(directory, 'host', 'endpoint.json'),
		nodePath: process.execPath,
		serverName: 'jpwb',
		systemPrompt: 'SYSTEM-PROMPT'
	};
}

/** The tool-surface tests' stub runner. */
function stubRunner(): ProcessRunner {
	return {
		kind: 'REAL',
		run: async (): Promise<ProcessRunOutcome> => ({
			ran: true,
			exitCode: 0,
			timedOut: false,
			stdout: 'v24\n',
			stderr: '',
			omittedRegions: [],
			outputComplete: true,
			retention: { retained: false, notRetainedBecause: 'stub runner retains nothing' },
			durationMs: 1
		})
	};
}

function context(): ProducerSessionContext {
	return {
		workspace: createFilesystemWorkspace({
			ownerKind: 'UNDERTAKING',
			ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
			purgeability: 'RETAINED_BY_PARTICIPATION',
			directoryPath: workspaceDir
		}),
		runner: stubRunner(),
		grantedCapabilities: ['file-system', 'process-execution'],
		bindingAuthorizationStatus: 'AUTHORIZED'
	};
}

/** A POST to the host's server, as devin's bridge sends one. */
function rpc(url: string, token: string, message: unknown): Promise<{ status: number; body: any }> {
	return new Promise((resolve, reject) => {
		const target = new URL(url);
		const body = Buffer.from(JSON.stringify(message), 'utf8');
		const req = request(
			{
				host: target.hostname,
				port: Number(target.port),
				path: '/',
				method: 'POST',
				headers: { 'content-type': 'application/json', 'content-length': body.length, authorization: `Bearer ${token}` }
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (c: Buffer) => chunks.push(c));
				res.on('end', () => {
					const text = Buffer.concat(chunks).toString('utf8');
					resolve({ status: res.statusCode ?? 0, body: text === '' ? undefined : JSON.parse(text) });
				});
			}
		);
		req.on('error', reject);
		req.end(body);
	});
}

/** The surface devin 3000.11.92 offered its model in both MH-0a calls, in the export's order. */
const MEASURED_SURFACE = [
	'ask_user_question',
	'find_file_by_name',
	'mcp_call_tool',
	'mcp_list_servers',
	'mcp_list_tools',
	'mcp_read_resource',
	'skill'
];
/** devin's carriers alone (§4.1, D21). */
const CARRIERS_ONLY = ['mcp_call_tool', 'mcp_list_servers', 'mcp_list_tools'];
/** What MH-0a's call 2 shows for a call devin rejected for want of approval. */
const REJECTED = 'Tool execution was rejected by the user';
/** MH-0a's call 2, its stderr, byte for byte. */
const REJECTION_LINE =
	'warning: rejected a tool call that requires confirmation. Running in non-interactive mode. Use --permission-mode ' +
	'dangerous to auto-approve all tools.';

/** devin, as the seam plays it: one agent step after another, written out as its export when the turn ends. */
class FakeDevin {
	readonly endpoint: { url: string; token: string };
	readonly exportPath: string;
	readonly configPath: string;
	surface: string[] | undefined = [...CARRIERS_ONLY];
	schema = 'ATIF-v1.7';
	/** A tool definition that names no tool, beside the surface. */
	namelessDefinition = false;
	steps: Record<string, unknown>[] = [];
	writes = true;
	private nextId = 1;
	constructor(readonly request: CliExecRequest) {
		const entry = (
			JSON.parse(readFileSync(join(request.cwd, '.devin', 'mcp_config.json'), 'utf8')) as {
				mcpServers: { jpwb: { args: string[] } };
			}
		).mcpServers.jpwb;
		this.endpoint = JSON.parse(readFileSync(entry.args[1]!, 'utf8')) as { url: string; token: string };
		this.exportPath = request.args[request.args.indexOf('--export') + 1]!;
		this.configPath = request.args[request.args.indexOf('--config') + 1]!;
	}
	/** One agent step, in MH-0a's shape: its message, its calls, their results, the model that generated it. */
	step(
		message: string,
		calls: { name: string; args: unknown; result: string }[] = [],
		/** ⭑ `null`: a step that names no model. */
		model: string | null = MODEL,
		reasoning?: string
	): void {
		const ids = calls.map(() => `call_${this.nextId++}`);
		this.steps.push({
			step_id: this.steps.length + 8,
			timestamp: '2026-10-18T19:28:11.000Z',
			source: 'agent',
			message,
			...(model === null ? {} : { model_name: model }),
			...(reasoning === undefined ? {} : { reasoning_content: reasoning }),
			tool_calls: calls.map((c, i) => ({ tool_call_id: ids[i], function_name: c.name, arguments: c.args })),
			...(calls.length === 0
				? {}
				: { observation: { results: calls.map((c, i) => ({ source_call_id: ids[i], content: c.result })) } }),
			metrics: { prompt_tokens: 1, completion_tokens: 1, cached_tokens: 0 },
			extra: {
				...(model === null ? {} : { generation_model: model }),
				telemetry: { source: 'assistant', operation: 'inference' }
			}
		});
	}
	listTools(): void {
		this.step('\n\n', [{ name: 'mcp_list_tools', args: { server_name: 'jpwb' }, result: '[ { "server_name": "jpwb" } ]' }]);
	}
	/** A host call, through devin's carrier, to the REAL server: it runs, and its result is what the model read. */
	async host(name: string, args: unknown, message = '\n\n'): Promise<void> {
		const answered = await rpc(this.endpoint.url, this.endpoint.token, {
			jsonrpc: '2.0',
			id: this.nextId,
			method: 'tools/call',
			params: { name, arguments: args }
		});
		const result = String(answered.body.result.content[0].text);
		this.step(message, [{ name: 'mcp_call_tool', args: { server_name: 'jpwb', tool_name: name, arguments: args }, result }]);
	}
	/** A host call devin rejected before sending it, for want of approval (MH-0a's call 2). */
	rejected(name: string, args: unknown, message = '\n\n'): void {
		this.step(message, [{ name: 'mcp_call_tool', args: { server_name: 'jpwb', tool_name: name, arguments: args }, result: REJECTED }]);
	}
	/** devin's stdout: every agent step's message, then a line break — what MH-0a's two calls printed. */
	stdout(): string {
		return `${this.steps.map((s) => String(s.message)).join('')}\n`;
	}
	writeExport(): void {
		if (!this.writes) return;
		const agent = {
			name: 'devin',
			version: '3000.11.92',
			model_name: 'DeepSeek V4.1 Flash Max',
			...(this.surface === undefined
				? {}
				: {
						tool_definitions: [
							...this.surface.map((name) => ({
								type: 'function',
								function: { name, description: `the fixture's ${name}`, parameters: { type: 'object' } }
							})),
							...(this.namelessDefinition ? [{ type: 'function', function: { description: 'no name' } }] : [])
						]
					}),
			extra: { backend: 'Windsurf', permission_mode: 'Normal' }
		};
		const opening = [
			{ step_id: 1, timestamp: '2026-10-18T19:28:10.000Z', source: 'system', message: 'SYSTEM', extra: {} },
			{ step_id: 6, timestamp: '2026-10-18T19:28:10.000Z', source: 'user', message: 'PROMPT', extra: {} }
		];
		writeFileSync(
			this.exportPath,
			JSON.stringify({ schema_version: this.schema, session_id: 'fixture', agent, steps: [...opening, ...this.steps] }),
			'utf8'
		);
	}
}

/** The `devin --config <file> mcp list` listing MH-0a's preflights printed, for this run folder. */
function measuredListing(cwd: string): string {
	const entry = (
		JSON.parse(readFileSync(join(cwd, '.devin', 'mcp_config.json'), 'utf8')) as {
			mcpServers: { jpwb: { command: string; args: string[] } };
		}
	).mcpServers.jpwb;
	const source = `~\\${relative(container, join(cwd, '.devin', 'mcp_config.json'))}`;
	return `Configured MCP servers:\n\n  • jpwb\n    Command: ${entry.command} ${entry.args.join(' ')}\n    Source: ${source}\n\n`;
}

type Script = (devin: FakeDevin) => Promise<Partial<CliRun> | void>;

/** The seam playing devin: its preflight's listing, and each turn as `script` plays it. */
function fakeDevin(script: Script): CliExec & { requests: CliExecRequest[]; turns: FakeDevin[] } {
	const requests: CliExecRequest[] = [];
	const turns: FakeDevin[] = [];
	const exec: CliExec = (req) => {
		requests.push(req);
		if (req.args.includes('mcp')) {
			const stdout = measuredListing(req.cwd);
			return { done: Promise.resolve({ exitCode: 0, stdout, stdoutComplete: true, errorLines: [] }), kill: async () => undefined };
		}
		const devin = new FakeDevin(req);
		turns.push(devin);
		const done = script(devin).then((over) => {
			devin.writeExport();
			return { exitCode: 0, stdout: devin.stdout(), stdoutComplete: true, errorLines: [], ...over };
		});
		return { done, kill: async () => undefined };
	};
	return Object.assign(exec, { requests, turns });
}

async function open(exec: CliExec): Promise<ProducerSession> {
	const session = await openCliExecutionSession(context(), SELECTION, driver(), {
		exec,
		root,
		turnTimeoutMs: 60_000,
		now: () => '2026-10-18T10:00:00Z'
	});
	sessions.push(session);
	return session;
}

const turn = async (session: ProducerSession, text = 'INSTRUCTION'): Promise<ToolInvocationResult> =>
	(await session.turn(text)) as ToolInvocationResult;

const messageOf = (r: ToolInvocationResult): string =>
	r.answer.arrived ? '' : 'message' in r.answer ? (r.answer.message ?? '') : '';

const ANSWER = '{"workProduct":"done","rationale":{}}';

/** MH-0a's call 1, with an answer the execution contract asks for: list the tools, two host calls in one step, answer. */
const callOne: Script = async (devin) => {
	devin.listTools();
	await devin.host('write_file', { contents: 'hello', path: 'probe.txt' });
	await devin.host('run_command', { argv: ['node', '--version'] });
	devin.step(ANSWER);
};

/** The pinned project config: `cli/.devin/config.json`, MH-0a's 398 bytes. */
const PINNED_PROJECT_CONFIG = [
	'{',
	'  "permissions": {',
	'    "deny": [',
	'      "read",',
	'      "edit",',
	'      "write",',
	'      "grep",',
	'      "glob",',
	'      "exec",',
	'      "web_search",',
	'      "Fetch(*)"',
	'    ],',
	'    "allow": [',
	'      "mcp__jpwb__*"',
	'    ]',
	'  },',
	'  "read_config_from": {',
	'    "agents_standard": false,',
	'    "cursor": false,',
	'    "windsurf": false,',
	'    "claude": false,',
	'    "copilot": false,',
	'    "opencode": false,',
	'    "zed": false',
	'  }',
	'}',
	''
].join('\n');

/**
 * The pinned `--config`: `host/user-config.json`, MH-0a's passing call's bytes without the account's `devin.org_id`, which
 * is account data and not this repository's (MH-0a's F1, open).
 */
const PINNED_USER_CONFIG = [
	'{',
	'  "version": 1,',
	'  "subagents_enabled": false,',
	'  "skip_workspace_trust": true,',
	'  "disabled_tools": [',
	'    "read",',
	'    "notebook_read",',
	'    "code_search",',
	'    "grep",',
	'    "glob",',
	'    "edit",',
	'    "write",',
	'    "apply_patch",',
	'    "notebook_edit",',
	'    "exec",',
	'    "shell_command",',
	'    "get_output",',
	'    "write_to_process",',
	'    "kill_shell",',
	'    "webfetch",',
	'    "web_search",',
	'    "view_image",',
	'    "browser_preview",',
	'    "close_browser_preview",',
	'    "skill",',
	'    "run_subagent",',
	'    "read_subagent",',
	'    "request_scope",',
	'    "todo_write",',
	'    "mcp_read_resource"',
	'  ],',
	'  "read_config_from": {',
	'    "agents_standard": false,',
	'    "cursor": false,',
	'    "windsurf": false,',
	'    "claude": false,',
	'    "copilot": false,',
	'    "opencode": false,',
	'    "zed": false',
	'  },',
	'  "proxy": {',
	'    "mode": "system",',
	'    "no_proxy": "127.0.0.1,localhost"',
	'  },',
	'  "shell": {',
	'    "setup_complete": true',
	'  }',
	'}',
	''
].join('\n');

/** The run folder's file at `path`, as the driver declares it. */
function fileOf(path: string, run = runFolder()): string {
	const file = driver()
		.runFolderFiles(run)
		.find((f) => f.path === path);
	if (file === undefined) throw new Error(`arrangement: the driver declares no ${path}`);
	return file.bytes;
}

describe('⭐ MH-4 test 1 — the run folder’s three files, byte-pinned', () => {
	it('cli/.devin/config.json: no deny names an mcp__ pattern, the allow names mcp__jpwb__*, and every read_config_from is off — MH-0a’s 398 bytes', () => {
		// ⛔ THE MUTANT: the reviewer's `DENY_ALL_TOOLS_CONFIG`, whose `mcp__*` deny would block the host's tools too — a deny
		// always wins.
		expect(Buffer.byteLength(PINNED_PROJECT_CONFIG, 'utf8'), 'arrangement: MH-0a’s bytes are 398').toBe(398);
		const bytes = fileOf('cli/.devin/config.json');
		const parsed = JSON.parse(bytes) as {
			permissions: { deny: string[]; allow: string[] };
			read_config_from: Record<string, boolean>;
		};
		expect(parsed.permissions.deny.filter((d) => d.startsWith('mcp__'))).toEqual([]);
		expect(parsed.permissions.allow).toEqual(['mcp__jpwb__*']);
		expect(Object.values(parsed.read_config_from)).toEqual([false, false, false, false, false, false, false]);
		expect(bytes).toBe(PINNED_PROJECT_CONFIG);
	});

	it('host/user-config.json: the 25 disabled tools, the proxy line, every read_config_from off, and shell.setup_complete — pinned byte for byte', () => {
		// ⛔ THE MUTANTS: setup_complete dropped (MH-0a's F1: print mode then waits on devin's setup screen until the host's
		// bound kills it); the proxy line dropped, which keeps devin's loopback to the host off any proxy.
		expect(Buffer.byteLength(PINNED_USER_CONFIG, 'utf8'), 'arrangement: the pinned bytes are 872').toBe(872);
		const bytes = fileOf('host/user-config.json');
		const parsed = JSON.parse(bytes) as {
			disabled_tools: string[];
			proxy: unknown;
			shell: unknown;
			read_config_from: Record<string, boolean>;
		};
		expect(parsed.disabled_tools).toHaveLength(25);
		expect(parsed.proxy).toEqual({ mode: 'system', no_proxy: '127.0.0.1,localhost' });
		expect(parsed.shell).toEqual({ setup_complete: true });
		expect(Object.values(parsed.read_config_from)).toEqual([false, false, false, false, false, false, false]);
		expect(bytes).toBe(PINNED_USER_CONFIG);
	});

	it('cli/.devin/mcp_config.json: one server, jpwb, the server’s own runtime running the bridge on the endpoint file, both in host/', () => {
		const run = runFolder();
		expect(JSON.parse(fileOf('cli/.devin/mcp_config.json', run))).toEqual({
			mcpServers: { jpwb: { command: process.execPath, args: [run.bridgePath, run.endpointPath] } }
		});
		expect(dirname(run.bridgePath)).toBe(run.hostDirectory);
		expect(dirname(run.endpointPath)).toBe(run.hostDirectory);
	});

	it('the three, and no other', () => {
		expect(
			driver()
				.runFolderFiles(runFolder())
				.map((f) => f.path)
		).toEqual(['cli/.devin/config.json', 'cli/.devin/mcp_config.json', 'host/user-config.json']);
	});
});

describe('⭐ MH-4 test 2 — the argv, pinned', () => {
	it('--print on the configured model, the prompt, the export and the --config each in host/, workspace trust off, never dangerous', () => {
		// ⛔ THE MUTANT: drop `--config`, so devin reads the operator's own user config and its tools are no longer disabled.
		const run = runFolder();
		const promptPath = join(run.hostDirectory, 'prompt-3.txt');
		const invocation = driver().invocation({
			run,
			turn: 3,
			modelId: MODEL,
			effort: undefined,
			prompt: 'P',
			userPrompt: 'P',
			promptPath
		});
		expect(invocation.args).toEqual([
			'--print',
			'--model',
			MODEL,
			'--prompt-file',
			promptPath,
			'--export',
			join(run.hostDirectory, 'export-3.json'),
			'--respect-workspace-trust',
			'false',
			'--config',
			join(run.hostDirectory, 'user-config.json')
		]);
		expect(invocation.args.join(' ')).not.toMatch(/dangerous|permission-mode/);
		expect(invocation.stdin).toBeUndefined();
		// ⭑ The installed program, by absolute path — or, in test mode, the override the reviewer's adapter captured.
		expect(invocation.program).toBe(
			DEVIN_BIN_OVERRIDE ?? join(places().localAppData, 'devin', 'cli', 'bin', 'devin.exe')
		);
	});
});

describe('⭐ MH-4 test 3 — the preflight: devin’s own listing of its MCP servers, before the first turn', () => {
	// ⭑ Each a function: the container they name is made per case, after this block is collected.
	const source = () => `~\\${relative(container, join(runFolder().cliDirectory, '.devin', 'mcp_config.json'))}`;
	const listing = (servers: string) => `Configured MCP servers:\n\n${servers}\n`;
	const jpwb = (from = source()) => `  • jpwb\n    Command: node bridge endpoint\n    Source: ${from}\n`;
	const refusalOf = (stdout: string, exitCode: number | null = 0) =>
		driver().preflight(runFolder())!.refusal({ exitCode, stdout });

	it('runs `devin --config <host/user-config.json> mcp list`: the global option before the subcommand', () => {
		// ⛔ THE MUTANT: `mcp list --config …`, which devin 3000.11.92 refuses ("error: unexpected argument '--config' found").
		const run = runFolder();
		const check = driver().preflight(run)!;
		expect(check.invocation.args).toEqual(['--config', join(run.hostDirectory, 'user-config.json'), 'mcp', 'list']);
		expect(check.invocation.program).toBe(driver().invocation({ run, turn: 1, modelId: MODEL, effort: undefined, prompt: '', userPrompt: '', promptPath: '' }).program);
	});

	it('⭑ CONTROL — the listing MH-0a measured, its source under ~ and inside the run folder, passes', () => {
		expect(refusalOf(listing(jpwb()))).toBeUndefined();
	});

	it('⛔ a second server refuses the session', () => {
		expect(refusalOf(listing(`${jpwb()}\n  • other\n    Command: x\n    Source: ~\\.devin\\mcp_config.json\n`))).toBe(
			'it lists 2 MCP servers, where the run folder’s own is the only one allowed.'
		);
	});

	it('⛔ a source outside the run folder refuses the session', () => {
		expect(refusalOf(listing(jpwb('~\\AppData\\Roaming\\devin\\mcp_config.json')))).toBe(
			'its server’s source is outside the run folder.'
		);
	});

	it('⛔ no server refuses the session', () => {
		expect(refusalOf("No MCP servers configured. Use 'devin.exe mcp add' to add servers.\n")).toBe(
			'it lists no MCP server, so devin does not read the run folder’s own entry.'
		);
	});

	it('⛔ one server not named jpwb, a failing exit, and a listing of no shape the driver knows each refuse it', () => {
		expect(refusalOf(listing(jpwb().replace('• jpwb', '• other')))).toBe(
			'the one MCP server it lists is not the run folder’s own.'
		);
		expect(refusalOf(listing(jpwb()), 2)).toBe('it exited with status 2.');
		expect(refusalOf("error: unexpected argument '--config' found\n")).toBe(
			'its output is not the listing this driver knows, so it shows nothing about devin’s MCP servers.'
		);
		// ⛔ THE MUTANT: no check of the listing's first line. A listing of another shape, its server and source as this
		// one's, would then be read as this devin's.
		expect(refusalOf(listing(jpwb()).replace('Configured MCP servers:', 'MCP servers:'))).toBe(
			'its output is not the listing this driver knows, so it shows nothing about devin’s MCP servers.'
		);
		expect(refusalOf(listing(`  • jpwb\n    Command: node bridge endpoint\n`))).toBe(
			'it names no single source for its server, so nothing shows where the entry was read from.'
		);
	});
});

describe('⭐ MH-4 test 4 — the export is the turn’s second witness: its surface, its calls, its models', () => {
	it('⛔ an export devin did not write reads as absent, not as a driver that failed', async () => {
		// ⛔ THE MUTANT: a missing export thrown as an error. devin only warns when it fails to write one (D20), so its
		// absence is an expected case of its own; the opener fails the turn either way.
		await expect(driver().readRecord({ run: runFolder(), turn: 1, exitCode: 0, stdout: '' })).resolves.toEqual({
			read: 'ABSENT'
		});
	});

	it('a surface of carriers alone proves it: the answer arrives after devin’s blank lines, PROVIDER_REPORTED on S2’s model, the host’s calls observed', async () => {
		// ⛔ THE MUTANT: read the host's calls from `mcp__jpwb__*` function names, the design's guess. MH-0a measured
		// `mcp_call_tool` with `arguments.tool_name`, so the guess reads none, and the record disagrees with the host's.
		const exec = fakeDevin(callOne);
		const result = await turn(await open(exec));
		expect(exec.turns[0]!.stdout().startsWith('\n\n\n\n'), 'arrangement: devin’s blank lines come first').toBe(true);
		expect(result.answer).toEqual({ arrived: true, text: `${ANSWER}\n` });
		expect([result.identityEvidence, result.producer]).toEqual([
			'PROVIDER_REPORTED',
			{ agentId: 'execution.model-invocation', modelId: MODEL, providerId: 'devin' }
		]);
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'run_command', outcome: 'COMPLETED' }
			]
		});
		expect(readFileSync(join(workspaceDir, 'probe.txt'), 'utf8')).toBe('hello');
	});

	it('⛔ the surface devin 3000.11.92 offered in MH-0a — four tools of devin’s own beside its carriers — fails the turn CLI_OWN_TOOL_RAN and taints the workspace', async () => {
		// ⚠ WHAT THIS DRIVER DOES TODAY ON THE MEASURED VERSION (MH-0a's F2): its config leaves ask_user_question,
		// find_file_by_name, mcp_read_resource and skill offered, so every such turn fails closed until the lead rules.
		const exec = fakeDevin(async (devin) => {
			devin.surface = [...MEASURED_SURFACE];
			await callOne(devin);
		});
		const result = await turn(await open(exec));
		expect(messageOf(result)).toMatch(/^CLI_OWN_TOOL_RAN: /);
		expect(readWorkspaceTaint(workspaceDir).tainted).toBe(true);
	});

	it('⛔ a surface holding exec is a breach', async () => {
		const exec = fakeDevin(async (devin) => {
			devin.surface = [...CARRIERS_ONLY, 'exec'];
			devin.step(ANSWER);
		});
		expect(messageOf(await turn(await open(exec)))).toMatch(/^CLI_OWN_TOOL_RAN: /);
	});

	it.each([
		['with no tool_definitions', (devin: FakeDevin) => (devin.surface = undefined)],
		['with a tool definition that names no tool', (devin: FakeDevin) => (devin.namelessDefinition = true)],
		['absent', (devin: FakeDevin) => (devin.writes = false)],
		['of a schema MH-0a did not measure', (devin: FakeDevin) => (devin.schema = 'ATIF-v1.8')],
		['with an agent step that names no generation_model', (devin: FakeDevin) => devin.step('\n\n', [], null)]
	])('⛔ an export %s is CLI_SURFACE_UNPROVEN', async (_, spoil) => {
		// ⛔ ONE MUTANT PER ARM: that arm read as an export that proves the surface and the model.
		const exec = fakeDevin(async (devin) => {
			spoil(devin);
			devin.step(ANSWER);
		});
		expect(messageOf(await turn(await open(exec)))).toMatch(/^CLI_SURFACE_UNPROVEN: /);
	});

	it('⛔ two steps generated by two models report both: CLI_MODEL_SUBSTITUTED, naming both', async () => {
		// ⛔ THE MUTANT: the reviewer's reading, the LAST step's model alone (`devin-reviewer.ts`, `readReportedModel`).
		const exec = fakeDevin(async (devin) => {
			devin.step('\n\n', [], 'glm-5-3-flash-max');
			devin.step(ANSWER);
		});
		expect(messageOf(await turn(await open(exec)))).toBe(
			'CLI_MODEL_SUBSTITUTED: The CLI reports that a model other than the configured one served the turn. ' +
				"Configured: 'deepseek-v4-1-flash-max'; reported: 'glm-5-3-flash-max', 'deepseek-v4-1-flash-max'."
		);
	});

	it('⛔ a call through mcp_call_tool to a server not the host’s is a tool of devin’s own that ran', async () => {
		// ⛔ THE MUTANT: pass it over as a carrier. The carrier reached a server the host does not run, so whatever it did
		// is nothing the host recorded.
		const exec = fakeDevin(async (devin) => {
			devin.step('\n\n', [
				{ name: 'mcp_call_tool', args: { server_name: 'other', tool_name: 'write_file', arguments: {} }, result: 'ok' }
			]);
			devin.step(ANSWER);
		});
		expect(messageOf(await turn(await open(exec)))).toMatch(/^CLI_OWN_TOOL_RAN: /);
	});

	it('⭐ D23 — the reasoning devin returns beside each step is volunteered reasoning, never the answer', async () => {
		// ⛔ THE MUTANT: drop it — the undeclared omission `REG-D-057` forbids. MH-0a's export carries `reasoning_content` on
		// every agent step.
		const exec = fakeDevin(async (devin) => {
			devin.step('\n\n', [], MODEL, 'REASONING-1-MARK');
			devin.step(ANSWER, [], MODEL, 'REASONING-2-MARK');
		});
		const result = await turn(await open(exec));
		expect(result.volunteeredReasoning).toBe('REASONING-1-MARK\n\nREASONING-2-MARK');
		expect(result.answer).toEqual({ arrived: true, text: `${ANSWER}\n` });
	});
});

describe('⭐ MH-4 test 5 — a rejected call devin stopped on is CLI_ENDED_ON_REFUSAL, never by the exit code', () => {
	it('⛔ devin’s rejection line on stderr, with no assistant message after it, though devin exits 0 with blank stdout', async () => {
		// ⛔ THE MUTANT: classify by the exit code. devin exits 0, its stdout blank lines only (MH-0a's call 2), which reads
		// ENDED_WITHOUT_ANSWER: a refusal graded as a producer's silence (`REG-F-410`).
		const exec = fakeDevin(async (devin) => {
			devin.listTools();
			return { errorLines: [REJECTION_LINE] };
		});
		const result = await turn(await open(exec));
		expect(exec.turns[0]!.stdout().trim(), 'arrangement: stdout is blank').toBe('');
		expect(messageOf(result)).toMatch(/^CLI_ENDED_ON_REFUSAL: /);
	});

	it('⛔ the export’s last step a host call devin rejected, its stderr empty: CLI_ENDED_ON_REFUSAL, the attempt REFUSED under the host tool’s name', async () => {
		// ⛔ THE MUTANT: read a rejected call as one devin sent. The host never saw it, so the record would then disagree with
		// the host's, and the refusal the turn ended on would be lost.
		const exec = fakeDevin(async (devin) => {
			devin.listTools();
			devin.rejected('write_file', { contents: 'hello', path: 'probe.txt' });
		});
		const result = await turn(await open(exec));
		expect(messageOf(result)).toMatch(/^CLI_ENDED_ON_REFUSAL: /);
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [{ name: 'write_file', outcome: 'REFUSED' }]
		});
	});

	it('⛔ what the model wrote in the step it was refused in comes before the refusal, so the turn still ended on it', async () => {
		// ⛔ THE MUTANT: a step's message read after its calls, which would place the model's words after the refusal.
		const exec = fakeDevin(async (devin) => {
			devin.rejected('write_file', { contents: 'hello', path: 'probe.txt' }, 'I will write the file now.');
		});
		expect(messageOf(await turn(await open(exec)))).toMatch(/^CLI_ENDED_ON_REFUSAL: /);
	});

	it('⛔ a blank step after the refusal is not an assistant message', async () => {
		// ⛔ THE MUTANT: a message of line breaks alone read as the model speaking. devin writes "\n\n" before its calls.
		const exec = fakeDevin(async (devin) => {
			devin.rejected('write_file', { contents: 'hello', path: 'probe.txt' });
			devin.step('\n\n');
		});
		expect(messageOf(await turn(await open(exec)))).toMatch(/^CLI_ENDED_ON_REFUSAL: /);
	});

	it('⭑ CONTROL — a refusal the model answered after: the attempt is REFUSED, and the answer stands', async () => {
		const exec = fakeDevin(async (devin) => {
			devin.rejected('write_file', { contents: 'hello', path: 'probe.txt' });
			devin.step(ANSWER);
		});
		const result = await turn(await open(exec));
		expect(result.answer.arrived, messageOf(result)).toBe(true);
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [{ name: 'write_file', outcome: 'REFUSED' }]
		});
	});
});

describe('⭐ MH-4 test 6 — devin’s store in the run folder, and the configuration it reads, declared', () => {
	it('DEVIN_SESSIONS_DIR points inside host/, at the preflight and at each turn', async () => {
		// ⛔ THE MUTANT: the sessions folder in cli/, devin's working folder, where its store would sit beside its config.
		const exec = fakeDevin(callOne);
		await turn(await open(exec));
		const host = dirname(exec.turns[0]!.exportPath);
		const sessionsDirs = exec.requests.map((r) => r.env.DEVIN_SESSIONS_DIR);
		expect(sessionsDirs, 'the preflight and one turn').toHaveLength(2);
		// ⭑ Compared, not printed: the folder is under the system's temporary folder, whose path names the account.
		expect(sessionsDirs.every((d) => d === join(host, 'sessions'))).toBe(true);
	});

	it('the config sources (D44a): devin’s user config, its user-level MCP servers, its global rules and skills, and Claude Code’s settings', () => {
		// ⛔ THE MUTANT: one of them dropped, so a change to it between turns would go unseen.
		const { appData, home } = places();
		expect(driver().configSources).toEqual([
			{ name: '%APPDATA%/devin/config.json', path: join(appData, 'devin', 'config.json') },
			{ name: '%APPDATA%/devin/mcp_config.json', path: join(appData, 'devin', 'mcp_config.json') },
			{ name: '%APPDATA%/devin/AGENTS.md', path: join(appData, 'devin', 'AGENTS.md') },
			{ name: '%APPDATA%/devin/skills', path: join(appData, 'devin', 'skills') },
			{ name: '~/.claude/settings.json', path: join(home, '.claude', 'settings.json') }
		]);
	});

	it('⛔ devin rewriting its own --config, as its first-run setup did (MH-0a’s F1), refuses the next turn before devin is started', async () => {
		const exec = fakeDevin(async (devin) => {
			if (!existsSync(devin.configPath)) throw new Error('arrangement: the --config names a file');
			appendFileSync(devin.configPath, ' ', 'utf8');
			await callOne(devin);
		});
		const session = await open(exec);
		expect((await turn(session)).answer.arrived, 'arrangement: the first turn passes').toBe(true);
		const second = await turn(session, 'FINDINGS');
		expect(messageOf(second)).toMatch(/^EXECUTOR_CONFIG_CHANGED: .* It names: the run folder’s host\/user-config\.json\.$/);
		expect(exec.turns, 'devin was started for a refused turn').toHaveLength(1);
	});
});
