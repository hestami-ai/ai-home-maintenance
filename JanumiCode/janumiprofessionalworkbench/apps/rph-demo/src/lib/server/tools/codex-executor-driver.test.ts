// ⭐⭐ `JAN-MHX` MH-6 — the victim for THE CODEX DRIVER (`DESIGN-multi-harness-executor.md` §4.3, D14a, D19, D21, D22,
// D44a; roadmap MH-6 tests 1–5).
//
// ⭑ TWO HALVES. First the driver's own answers, asked directly: its run folder, its argv, its preflight, and its reading of
// the JSONL and of the error stream, each against a shape MH-0c measured on codex-cli 0.162.1 — copied here with every
// path and identifier replaced. Then the driver through the REAL opener, with a `CliExec` seam that plays Codex: it
// answers `--version`, finds the host's endpoint file through the MCP entry the argv carries, calls the real host tool
// server with the turn's token, and writes the JSONL and the last-message file Codex writes. No Codex and no model is run.
// ⚠ Every directory is under `os.tmpdir()`, never under the repository.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProcessRunOutcome, ProcessRunner } from '@janumipwb/rph-ports';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import type { ProducerSession, ProducerSessionContext } from '../execution/producer-session.js';
import { readWorkspaceTaint } from '../execution/workspace-taint.js';
import type { ToolInvocationResult } from './backing-tool.js';
import {
	openCliExecutionSession,
	type CliDriver,
	type CliExec,
	type CliExecRequest,
	type CliExecutorSelection,
	type CliPreflight,
	type CliRecordReading,
	type CliRun,
	type CliRunFolder,
	type CliTurnInput
} from './cli-executor-session.js';
import { codexExecutorDriver } from './codex-executor-driver.js';
import { governedToolCallReport } from './observed-tool-calls.js';

let container = '';
let workspaceDir = '';
let root = '';
let runDir = '';
const sessions: ProducerSession[] = [];

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-codex-driver-'));
	workspaceDir = join(container, 'workspace');
	root = join(container, 'root');
	runDir = join(container, 'jpwb-exec-codex-1-abc123');
	mkdirSync(workspaceDir);
	mkdirSync(join(runDir, 'host'), { recursive: true });
	mkdirSync(join(runDir, 'cli'));
});
afterEach(async () => {
	vi.unstubAllEnvs();
	for (const s of sessions.splice(0)) s.dispose();
	await new Promise((r) => setTimeout(r, 300));
	await rm(container, { recursive: true, force: true, maxRetries: 5 });
});

/** The selection Probe 1 ran: the sponsor's S3. */
const SELECTION: CliExecutorSelection = {
	kind: 'CLI',
	toolId: 'codex',
	modelId: 'gpt-5.6-sol',
	effort: 'high'
};

/** A run folder as the opener hands it to a driver (D13). */
function runFolder(directory = runDir): CliRunFolder {
	const hostDirectory = join(directory, 'host');
	return {
		directory,
		cliDirectory: join(directory, 'cli'),
		hostDirectory,
		bridgePath: join(hostDirectory, 'jpwb-bridge.mjs'),
		endpointPath: join(hostDirectory, 'endpoint.json'),
		nodePath: process.execPath,
		serverName: 'jpwb',
		systemPrompt: 'THE SYSTEM PROMPT'
	};
}

function turnInput(turn = 1, run = runFolder()): CliTurnInput {
	return {
		run,
		turn,
		modelId: SELECTION.modelId,
		effort: SELECTION.effort,
		prompt: 'THE SYSTEM PROMPT\n\nTHE INSTRUCTION, WHICH NO ARGV ELEMENT MAY CARRY',
		userPrompt: 'THE INSTRUCTION, WHICH NO ARGV ELEMENT MAY CARRY',
		promptPath: join(run.hostDirectory, `prompt-${turn}.txt`)
	};
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** A driver's no-model checks, in the order the opener runs them (D14): none, one, or a list. */
function checksOf(
	driver: CliDriver = codexExecutorDriver(),
	selection: CliExecutorSelection = SELECTION,
	run: CliRunFolder = runFolder()
): readonly CliPreflight[] {
	const declared = driver.preflight(run, selection);
	return declared === undefined ? [] : 'invocation' in declared ? [declared] : declared;
}

/** Where the npm install puts Codex's own executable under an `%APPDATA%`, as MH-0c ran it. */
const programUnder = (appData: string): string =>
	join(
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
	);

/**
 * The one server `codex mcp list --json` printed in MH-0c's preflight arm (`runs/preflight/mcp-list.json`, under an empty
 * CODEX_HOME), its paths replaced by the run folder's.
 */
function measuredServer(
	run: CliRunFolder,
	over: Record<string, unknown> = {}
): Record<string, unknown> {
	return {
		name: 'jpwb',
		enabled: true,
		disabled_reason: null,
		transport: {
			type: 'stdio',
			command: run.nodePath,
			args: [run.bridgePath, run.endpointPath],
			env: null,
			env_vars: [],
			cwd: null
		},
		startup_timeout_sec: 30.0,
		tool_timeout_sec: 180.0,
		auth_status: 'unsupported',
		...over
	};
}

// ── The JSONL, in the shapes MH-0c measured (paths and identifiers replaced) ─────────────────────────────────────────

const lines = (...events: unknown[]): string =>
	events.map((e) => `${JSON.stringify(e)}\n`).join('');
const THREAD = { type: 'thread.started', thread_id: '01a15000-0000-7000-8000-000000000000' };
const TURN = { type: 'turn.started' };
const COMPLETED = {
	type: 'turn.completed',
	usage: {
		input_tokens: 10,
		cached_input_tokens: 0,
		cache_write_input_tokens: 0,
		output_tokens: 5,
		reasoning_output_tokens: 0
	}
};
const started = (item: Record<string, unknown>) => ({ type: 'item.started', item });
const completed = (item: Record<string, unknown>) => ({ type: 'item.completed', item });
const message = (id: string, text: string) => completed({ id, type: 'agent_message', text });
const hostCall = (
	id: string,
	tool: string,
	status: string,
	over: Record<string, unknown> = {}
) => ({
	id,
	type: 'mcp_tool_call',
	server: 'jpwb',
	tool,
	arguments: {},
	result: { content: [{ type: 'text', text: 'the host’s result' }], structured_content: null },
	error: null,
	status,
	...over
});

/** Probe 1's second live call, as its record ran: two host calls that completed, then the answer. */
const LIVE_CALL_2 = lines(
	THREAD,
	TURN,
	started(hostCall('item_0', 'write_file', 'in_progress', { result: null })),
	completed(hostCall('item_0', 'write_file', 'completed')),
	started(hostCall('item_1', 'run_command', 'in_progress', { result: null })),
	completed(hostCall('item_1', 'run_command', 'completed')),
	message('item_2', 'DONE'),
	COMPLETED
);

/** The tools Probe 0 measured Codex offering beside the host's, with this catalog and these flags (MH-0c F2). */
const MEASURED_OWN_SURFACE = [
	{ party: 'OWN', name: 'list_mcp_resources' },
	{ party: 'OWN', name: 'list_mcp_resource_templates' },
	{ party: 'OWN', name: 'read_mcp_resource' },
	{ party: 'OWN', name: 'request_user_input' }
];

async function read(
	stdout: string,
	opts: { turn?: number; last?: string; exitCode?: number } = {}
): Promise<CliRecordReading> {
	const turn = opts.turn ?? 1;
	if (opts.last !== undefined)
		writeFileSync(join(runDir, 'host', `last-${turn}.txt`), opts.last, 'utf8');
	return codexExecutorDriver().readRecord({
		run: runFolder(),
		turn,
		exitCode: opts.exitCode ?? 0,
		stdout
	});
}

/** The parsed reading, or a failure naming what it was instead. */
function parsed(reading: CliRecordReading): Extract<CliRecordReading, { read: 'PARSED' }> {
	if (reading.read !== 'PARSED') throw new Error(`the record read as ${reading.read}, not PARSED`);
	return reading;
}

describe('⭐ §4.3 — the run folder, the argv and the stdin (roadmap MH-6 tests 1–3)', () => {
	it('test 1 — the run folder holds one file, the catalog Probe 1’s second call ran with, byte for byte', () => {
		// ⛔ THE MUTANT: the catalog with `supports_search_tool` true. The host's tools are then deferred behind tool_search,
		// and live gpt-5.6-sol could not load them: Probe 1's first call called no host tool and answered BLOCKED (MH-0c F1).
		const files = codexExecutorDriver().runFolderFiles(runFolder());
		expect(files.map((f) => f.path)).toEqual(['host/catalog.json']);
		const bytes = files[0]!.bytes;
		expect(sha256(bytes), 'the measured file’s sha256').toBe(
			'68731490e2cf45efecde590a475ad7cd29cd90e77972d4c512d323e3cb82a64e'
		);
		const catalog = JSON.parse(bytes) as { models: Record<string, unknown>[] };
		expect(catalog.models).toHaveLength(1);
		expect(catalog.models[0]).toMatchObject({
			slug: 'gpt-5.6-sol',
			shell_type: 'disabled',
			apply_patch_tool_type: null,
			multi_agent_version: null,
			tool_mode: 'direct',
			node_repl_disabled: true,
			supports_search_tool: false
		});
	});

	it('test 2 — the argv, pinned: the design’s, with --strict-config and --ignore-rules, as Probe 1’s second call ran it', () => {
		// ⛔ THE MUTANTS, each one argument: drop `approvals_reviewer` (this host's config routes approvals to an auto-review
		// thread on the same quota); drop `--strict-config` (an unknown key is then only ignored, MH-0c F6); drop
		// `--ignore-rules` (F7); drop `--ephemeral` (the turn then lands in CODEX_HOME, F15); `-s workspace-write`; drop
		// `default_tools_approval_mode="approve"` (every host call refused, F12); `supports_parallel_tool_calls=true` (F13).
		const run = runFolder();
		const invocation = codexExecutorDriver().invocation(turnInput(2, run));
		const host = run.hostDirectory;
		expect(invocation.args).toEqual([
			'exec',
			'--ignore-user-config',
			'--skip-git-repo-check',
			'--ephemeral',
			'--json',
			'-o',
			join(host, 'last-2.txt'),
			'-C',
			run.cliDirectory,
			'-s',
			'read-only',
			'-m',
			'gpt-5.6-sol',
			'-c',
			'model_reasoning_effort="high"',
			'-c',
			'approval_policy="never"',
			'-c',
			'approvals_reviewer="user"',
			'-c',
			'web_search="disabled"',
			'-c',
			'project_doc_max_bytes=0',
			'-c',
			`model_catalog_json='${join(host, 'catalog.json')}'`,
			...[
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
			].flatMap((feature) => ['--disable', feature]),
			'-c',
			`mcp_servers.jpwb={command='${run.nodePath}', args=['${run.bridgePath}', '${run.endpointPath}'], required=true, ` +
				'startup_timeout_sec=30, tool_timeout_sec=180, default_tools_approval_mode="approve", ' +
				'enabled_tools=["write_file", "run_command"], supports_parallel_tool_calls=false}',
			'--strict-config',
			'--ignore-rules',
			'-'
		]);
		// ⛔ NEVER the auto-review subagent's flag, the bypass, or a sandbox that writes (§4.3; MH-0c F9).
		for (const never of [
			'--approve-for-me',
			'--dangerously-bypass-approvals-and-sandbox',
			'workspace-write'
		])
			expect(invocation.args, never).not.toContain(never);
	});

	it('test 3 — the prompt goes on stdin, after `-`, and no argv element carries it', () => {
		// ⛔ THE MUTANT: the prompt in argv. It would then reach every diagnostic that echoes the command line (PER-12).
		const turn = turnInput();
		const invocation = codexExecutorDriver().invocation(turn);
		expect(invocation.stdin).toBe(turn.prompt);
		expect(invocation.args.at(-1)).toBe('-');
		for (const arg of invocation.args) expect(arg).not.toContain('THE INSTRUCTION');
	});

	it('⛔ a run-folder path a TOML literal string cannot carry refuses the session, naming the part and never the path', () => {
		// ⛔ THE MUTANT: no check. A quote in a path would end the literal string early, and Codex would read the rest of
		// the path as configuration of its own (`--strict-config` refuses only an unknown KEY).
		const run = runFolder(join(container, "jpwb-exec-codex-1-a'quote"));
		expect(() => codexExecutorDriver().runFolderFiles(run)).toThrow(
			"The CLI executor session for 'codex' is refused: the host folder's path holds a character a TOML literal " +
				'string cannot carry'
		);
		expect(() => codexExecutorDriver().runFolderFiles(run)).not.toThrow(/a'quote/);
	});

	it('⛔ the node runtime’s path, which lies outside the run folder, is held to the same rule: its own arm, tripped alone', () => {
		// ⛔ THE MUTANT: leave the node runtime out of the paths asked. Every other fixture runs `process.execPath`, and a
		// quote in the host folder trips the bridge's and the endpoint's arms with the host's own, so only this arrangement
		// holds a quote in the runtime's path and nowhere else.
		const run = { ...runFolder(), nodePath: join(container, "node'runtime", 'node.exe') };
		expect(() => codexExecutorDriver().runFolderFiles(run)).toThrow(
			"The CLI executor session for 'codex' is refused: the node runtime's path holds a character a TOML literal " +
				'string cannot carry'
		);
		expect(() => codexExecutorDriver().runFolderFiles(run)).not.toThrow(/node'runtime/);
	});

	it('⛔ a server name a bare TOML key cannot be refuses the session: the argv names it as `mcp_servers.<name>`', () => {
		// ⛔ THE MUTANT: no check. A dot or a space would split or end the key, and Codex would read another table.
		expect(() =>
			codexExecutorDriver().runFolderFiles({ ...runFolder(), serverName: 'jpwb.other' })
		).toThrow(
			"The CLI executor session for 'codex' is refused: the MCP server’s name cannot be written"
		);
		expect(codexExecutorDriver().runFolderFiles(runFolder())).toHaveLength(1);
	});

	it('⭑ the program is Codex’s own executable, by absolute path: never the npm shim, which node will not start with shell off', () => {
		// ⛔ THE MUTANT: the path without its install folder, a relative one. ⭑ And never the npm shim: it is a batch file and
		// a PowerShell script, which node will not start with the shell off, and not what MH-0c measured.
		vi.stubEnv('APPDATA', join(container, 'AppData', 'Roaming'));
		const driver = codexExecutorDriver();
		const program = programUnder(join(container, 'AppData', 'Roaming'));
		expect(checksOf(driver).map((check) => check.invocation.program)).toEqual([program, program]);
		expect(driver.invocation(turnInput()).program).toBe(program);
	});

	it('⛔ with APPDATA unset, or not an absolute path, the driver names no program at all, and refuses the session', () => {
		// ⛔ THE MUTANT: take any APPDATA. A relative program path is resolved against the folder the CLI is started in, the
		// run's cli/, where no install is.
		for (const appData of [undefined, join('relative', 'AppData', 'Roaming')]) {
			vi.stubEnv('APPDATA', appData);
			expect(() => checksOf(codexExecutorDriver()), String(appData)).toThrow(
				"The CLI executor session for 'codex' is refused: its program is Codex’s own executable under %APPDATA%"
			);
		}
	});

	it('⭐ JPWB_CODEX_BIN, captured when the driver loads, names the program the driver runs — the capture the selector refuses outside test mode', async () => {
		// ⛔ THE MUTANT: run the measured path whatever the capture says. The selector would then honour an override in
		// test mode that nothing ran — a variable read by nothing that looked as though it took effect (D32's rule).
		vi.resetModules();
		vi.stubEnv('JPWB_CODEX_BIN', 'stand-in/codex.exe');
		const loaded = await import('./codex-executor-driver.js');
		vi.stubEnv('JPWB_CODEX_BIN', undefined);
		expect(loaded.CODEX_BIN_OVERRIDE).toBe('stand-in/codex.exe');
		const driver = loaded.codexExecutorDriver();
		expect(checksOf(driver).map((check) => check.invocation.program)).toEqual([
			'stand-in/codex.exe',
			'stand-in/codex.exe'
		]);
		expect(driver.invocation(turnInput()).program).toBe('stand-in/codex.exe');
		// ⭑ And the program fingerprinted before each turn is the one the driver runs (D44a).
		expect(driver.configSources).toContainEqual({
			name: 'the Codex program',
			path: 'stand-in/codex.exe'
		});
		vi.resetModules();
	});

	it('⭐ D44a — the configuration sources Codex reads are declared: its config, its instructions, its rules, its skills, and its program', () => {
		// ⛔ THE MUTANT: drop `~/.codex/AGENTS.md`. Probe 0 planted one and it reached the model despite
		// `--ignore-user-config` and `project_doc_max_bytes=0` (MH-0c F8), and `run_command` can write it.
		vi.stubEnv('APPDATA', join(container, 'AppData', 'Roaming'));
		expect(codexExecutorDriver().configSources).toEqual([
			{ name: '~/.codex/config.toml', path: join(homedir(), '.codex', 'config.toml') },
			{ name: '~/.codex/AGENTS.md', path: join(homedir(), '.codex', 'AGENTS.md') },
			{
				name: '~/.codex/AGENTS.override.md',
				path: join(homedir(), '.codex', 'AGENTS.override.md')
			},
			{ name: '~/.codex/rules', path: join(homedir(), '.codex', 'rules') },
			{ name: '~/.codex/skills', path: join(homedir(), '.codex', 'skills') },
			{ name: '~/.codex/skills/.system', path: join(homedir(), '.codex', 'skills', '.system') },
			{ name: 'the Codex program', path: programUnder(join(container, 'AppData', 'Roaming')) }
		]);
	});

	it('⭐ D44a — ~/.codex/AGENTS.override.md is declared: Codex reads it before AGENTS.md, and run_command can create it', () => {
		// ⛔ THE MUTANT: drop it. Codex's codex-home instructions module names `AGENTS.override.md` before `AGENTS.md` (the
		// binary's strings), and the AGENTS.md beside it reached the model despite the flags (MH-0c F8): a file the model
		// creates there between turns would reach the next turn's prompt with no `EXECUTOR_CONFIG_CHANGED`.
		expect(codexExecutorDriver().configSources).toContainEqual({
			name: '~/.codex/AGENTS.override.md',
			path: join(homedir(), '.codex', 'AGENTS.override.md')
		});
	});

	it('⭐ D44a — ~/.codex/skills is declared, by a folder’s stat: a skill folder created in it changes its modified time', () => {
		// ⛔ THE MUTANT: drop it. Each of Probe 0's A23 requests carried a `<skills_instructions>` developer message listing
		// the skills Codex found in its home, despite `--ignore-user-config` and `--disable skill_search`.
		expect(codexExecutorDriver().configSources).toContainEqual({
			name: '~/.codex/skills',
			path: join(homedir(), '.codex', 'skills')
		});
	});

	it('⭐ D44a — ~/.codex/skills/.system is declared: it is the skill root A23’s requests listed', () => {
		// ⛔ THE MUTANT: drop it. A skill folder created under `.system` changes `.system`'s modified time and not the
		// skills folder's, so the stat of `~/.codex/skills` alone would not see it.
		expect(codexExecutorDriver().configSources).toContainEqual({
			name: '~/.codex/skills/.system',
			path: join(homedir(), '.codex', 'skills', '.system')
		});
	});

	it('⭐ D44a, D14a — the program the version check ran is declared, by a stat alone: the version is checked once, at open', () => {
		// ⛔ THE MUTANT: drop it. The version pin is the whole basis of Codex's surface proof, and `run_command` can replace
		// `codex.exe` between turns: every later turn would run an unmeasured program while the record claimed the measured
		// surface.
		vi.stubEnv('APPDATA', join(container, 'AppData', 'Roaming'));
		expect(codexExecutorDriver().configSources).toContainEqual({
			name: 'the Codex program',
			path: programUnder(join(container, 'AppData', 'Roaming'))
		});
	});

	it('⭑ D43 — the CLI gets the allowlist and no constant or secret of the driver’s: the ChatGPT login is in its own home', () => {
		const driver = codexExecutorDriver();
		expect(driver.environment).toEqual({});
		expect(driver.secretVariable).toBeUndefined();
	});
});

describe('⭐ D14, D14a — the preflight: the version, the model and the effort Probe 0 measured (roadmap MH-6 test 5)', () => {
	const preflight = () => {
		const check = checksOf().find((c) => c.invocation.args[0] === '--version');
		if (check === undefined) throw new Error('the Codex driver asks no version');
		return check;
	};

	it('test 5 — it asks `codex --version`, and refuses any version but codex-cli 0.162.1, naming both', () => {
		// ⛔ THE MUTANT: skip the version check. The surface proof for Codex is a measurement of ONE version (D14a): another
		// version's tools were never seen.
		const check = preflight();
		expect(check.invocation.args).toEqual(['--version']);
		expect(check.invocation.stdin).toBeUndefined();
		expect(check.refusal({ exitCode: 0, stdout: 'codex-cli 0.162.1\n' })).toBeUndefined();
		const newer = check.refusal({ exitCode: 0, stdout: 'codex-cli 0.163.0\n' }) ?? 'NO REFUSAL';
		expect(newer).toContain("'codex-cli 0.163.0'");
		expect(newer).toContain('codex-cli 0.162.1');
		expect(
			check.refusal({ exitCode: 1, stdout: 'codex-cli 0.162.1\n' }),
			'a failing exit'
		).toContain('exited with 1');
		expect(
			check.refusal({ exitCode: 0, stdout: `codex-cli 0.162.1 ${'x'.repeat(200)}\n` }),
			'a version this host will not print'
		).toContain('a version this host will not print');
	});

	it('⛔ a model the pinned catalog does not hold refuses the session before any turn, naming the one it holds', () => {
		// ⛔ THE MUTANT: no model check. Codex would look the model up in a catalog that does not hold it, with a tool
		// surface nobody measured.
		const driver = codexExecutorDriver();
		expect(() => driver.preflight(runFolder(), { ...SELECTION, modelId: 'gpt-5.6-terra' })).toThrow(
			"The CLI executor session for 'codex' is refused: it runs only the model its pinned catalog holds, gpt-5.6-sol, " +
				'and this session names "gpt-5.6-terra"'
		);
	});

	it('⛔ every effort but high, the one every MH-0c arm ran at, refuses the session before any turn, naming it', () => {
		// ⛔ THE MUTANTS: take any effort the catalog lists (the first build's rule: five of the six were never run, and the
		// catalog describes `ultra` as "Maximum reasoning with automatic task delegation", which could change the tool
		// surface); take no effort (unset, Codex's user configuration would choose one).
		const driver = codexExecutorDriver();
		for (const effort of [
			'low',
			'medium',
			'xhigh',
			'max',
			'ultra',
			'ludicrous',
			'high" , web_search="live'
		])
			expect(() => driver.preflight(runFolder(), { ...SELECTION, effort }), effort).toThrow(
				"The CLI executor session for 'codex' is refused: its effort must be high, the one effort its tool surface " +
					`was measured at, and this session names ${JSON.stringify(effort)}.`
			);
		expect(() => driver.preflight(runFolder(), { ...SELECTION, effort: undefined })).toThrow(
			'its effort must be high, the one effort its tool surface was measured at, and this session names none.'
		);
		expect(() => driver.preflight(runFolder(), SELECTION), 'high').not.toThrow();
	});

	it('⭑ high is an effort the pinned catalog lists, so Codex validates the one effort admitted against the catalog it runs', () => {
		const catalog = JSON.parse(codexExecutorDriver().runFolderFiles(runFolder())[0]!.bytes) as {
			models: { supported_reasoning_levels: { effort: string }[] }[];
		};
		expect(catalog.models[0]!.supported_reasoning_levels.map((l) => l.effort)).toContain('high');
	});
});

describe('⭐ D14 — the preflight lists the MCP servers Codex would start, and refuses any but the run folder’s jpwb', () => {
	const listing = (run: CliRunFolder = runFolder()) => {
		const check = checksOf(codexExecutorDriver(), SELECTION, run).find(
			(c) => c.invocation.args[0] === 'mcp'
		);
		if (check === undefined) throw new Error('the Codex driver asks no MCP listing');
		return check;
	};

	it('⭐ it asks `codex mcp list --json` after the version, with the turn’s own configuration flags, element for element', () => {
		// ⛔ THE MUTANTS: no listing (the first build's preflight held the version alone, so nothing in a session showed which
		// MCP servers Codex started); a listing without the turn's flags (it would list a configuration the turn never runs).
		const run = runFolder();
		const checks = checksOf(codexExecutorDriver(), SELECTION, run);
		expect(checks.map((c) => c.invocation.args.slice(0, 3))).toEqual([
			['--version'],
			['mcp', 'list', '--json']
		]);
		const turnArgs = codexExecutorDriver().invocation(turnInput(1, run)).args;
		const flags = turnArgs.slice(turnArgs.indexOf('-m') + 2, turnArgs.indexOf('--strict-config'));
		expect(flags, 'arrangement: the turn’s flags hold its server entry').toContain(
			`mcp_servers.jpwb={command='${run.nodePath}', args=['${run.bridgePath}', '${run.endpointPath}'], required=true, ` +
				'startup_timeout_sec=30, tool_timeout_sec=180, default_tools_approval_mode="approve", ' +
				'enabled_tools=["write_file", "run_command"], supports_parallel_tool_calls=false}'
		);
		expect(flags, 'arrangement: and its other -c pairs and --disable flags').toContain(
			'approvals_reviewer="user"'
		);
		expect(listing(run).invocation.args).toEqual(['mcp', 'list', '--json', ...flags]);
		expect(listing(run).invocation.stdin).toBeUndefined();
	});

	it('⭑ the one server MH-0c’s preflight arm listed, with this run folder’s paths, passes', () => {
		const run = runFolder();
		const stdout = `${JSON.stringify([measuredServer(run)], null, 2)}\n`;
		expect(listing(run).refusal({ exitCode: 0, stdout })).toBeUndefined();
	});

	it.each([
		[
			'a second server beside jpwb',
			(run: CliRunFolder) => [measuredServer(run), measuredServer(run, { name: 'operator' })],
			'its MCP listing names 2 servers, and the run folder’s jpwb must be the only one'
		],
		[
			'no server at all',
			() => [],
			'its MCP listing names 0 servers, and the run folder’s jpwb must be the only one'
		],
		[
			'one server of another name',
			(run: CliRunFolder) => [measuredServer(run, { name: 'operator' })],
			'the one server its MCP listing names is not the run folder’s jpwb'
		],
		[
			'jpwb started by another program',
			(run: CliRunFolder) => [
				measuredServer(run, {
					transport: {
						type: 'stdio',
						command: join(container, 'other', 'node.exe'),
						args: [run.bridgePath, run.endpointPath]
					}
				})
			],
			'its MCP listing’s jpwb does not start the run folder’s bridge with the server’s own runtime'
		],
		[
			'jpwb with other arguments',
			(run: CliRunFolder) => [
				measuredServer(run, {
					transport: {
						type: 'stdio',
						command: run.nodePath,
						args: [run.bridgePath, join(container, 'other', 'endpoint.json')]
					}
				})
			],
			'its MCP listing’s jpwb does not start the run folder’s bridge with the server’s own runtime'
		]
	])('⛔ a listing holding %s refuses the session, and names no path', (_, servers, said) => {
		// ⛔ ONE MUTANT PER ARM: that arm left out. A server any source Codex still reads defines would be started by Codex,
		// a process the host never recorded, and seen only if the model called it (D14).
		const run = runFolder();
		const refusal = listing(run).refusal({ exitCode: 0, stdout: JSON.stringify(servers(run)) });
		expect(refusal).toBe(`${said} (JAN-MHX D14).`);
		expect(refusal).not.toContain(container);
	});

	it.each([
		[
			{ exitCode: 1, stdout: '' },
			'`codex mcp list` exited with 1, so the MCP servers Codex would start could not be read.'
		],
		[
			{ exitCode: 0, stdout: 'jpwb  node  bridge\n' },
			'its MCP listing could not be read as a list of servers, so the MCP servers Codex would start are unknown.'
		],
		[
			{ exitCode: 0, stdout: '{"servers":[]}' },
			'its MCP listing could not be read as a list of servers, so the MCP servers Codex would start are unknown.'
		]
	])(
		'⛔ a listing that did not end well, or is not a JSON list, refuses the session',
		(output, said) => {
			// ⛔ ONE MUTANT PER ARM: a failing exit read as a listing; a listing that is not a list read as an empty one.
			expect(listing().refusal(output)).toBe(said);
		}
	);
});

describe('⭐ D14a, D19, D21, D22 — what the JSONL record holds (roadmap MH-6 test 4)', () => {
	it('⭑ Probe 1’s second call: two host calls sent, the answer, the measured surface, and no model reported', async () => {
		const reading = parsed(await read(LIVE_CALL_2, { last: 'DONE' }));
		expect(reading.events).toEqual([
			{ kind: 'HOST_CALL', name: 'write_file', sent: true },
			{ kind: 'HOST_CALL', name: 'run_command', sent: true },
			{ kind: 'ASSISTANT_MESSAGE' }
		]);
		expect(reading.surface).toEqual(MEASURED_OWN_SURFACE);
		expect(reading.reportedModels).toEqual([]);
		expect(reading.answer).toBe('DONE');
		expect(reading.errorExcerpt).toBeUndefined();
		expect(reading.raw).toBe(LIVE_CALL_2);
	});

	it('⭑ the answer is the last message Codex wrote to its -o file, for this turn: an earlier message is not the answer', async () => {
		// ⛔ THE MUTANT: turn 1's file on turn 2. ⭑ And an earlier message is not the answer: the answer is the -o file,
		// Codex's own last message.
		writeFileSync(join(runDir, 'host', 'last-1.txt'), 'turn 1’s answer', 'utf8');
		const stdout = lines(
			THREAD,
			TURN,
			message('item_0', 'I’m listing the tools first.'),
			message('item_1', 'BLOCKED'),
			COMPLETED
		);
		const reading = parsed(await read(stdout, { turn: 2, last: 'BLOCKED' }));
		expect(reading.answer).toBe('BLOCKED');
		expect(reading.events).toEqual([{ kind: 'ASSISTANT_MESSAGE' }, { kind: 'ASSISTANT_MESSAGE' }]);
		// ⭑ No -o file: Codex wrote no last message (Probe 0's provider failure, A18), so there is no answer.
		expect(parsed(await read(stdout, { turn: 3 })).answer).toBeUndefined();
	});

	it.each([
		[
			'command_execution',
			{ command: 'pwsh -Command "node --version"', aggregated_output: '', exit_code: 0 }
		],
		['file_change', { changes: [{ path: 'patched-by-mock.txt', kind: 'add' }] }],
		['web_search', { query: 'what' }],
		['collab_tool_call', {}],
		['todo_list', { items: [] }]
	])('⛔ a %s item that completed is a tool of Codex’s own that RAN', async (type, fields) => {
		// ⛔ THE MUTANT: a completed item of Codex's own read as refused. Its bytes reached the workspace, or its command ran,
		// and the host recorded neither (D21). ⭑ Any item type this driver does not know is one too: the closed direction.
		const stdout = lines(
			THREAD,
			TURN,
			completed({ id: 'item_0', type, status: 'completed', ...fields }),
			message('item_1', 'DONE'),
			COMPLETED
		);
		expect(parsed(await read(stdout)).events).toEqual([
			{ kind: 'OWN_TOOL', name: type, ran: true },
			{ kind: 'ASSISTANT_MESSAGE' }
		]);
	});

	it('⛔ a command that started and FAILED ran too; only one DECLINED is a refused attempt', async () => {
		// ⛔ THE MUTANT: a failed command read as refused. `failed` is a command that exited non-zero: it ran.
		const failed = lines(
			THREAD,
			TURN,
			completed({ id: 'item_0', type: 'command_execution', status: 'failed' }),
			COMPLETED
		);
		expect(parsed(await read(failed)).events).toEqual([
			{ kind: 'OWN_TOOL', name: 'command_execution', ran: true }
		]);
		const declined = lines(
			THREAD,
			TURN,
			completed({ id: 'item_0', type: 'command_execution', status: 'declined' }),
			COMPLETED
		);
		expect(parsed(await read(declined)).events).toEqual([
			{ kind: 'OWN_TOOL', name: 'command_execution', ran: false }
		]);
	});

	it('⭐ MH-0c F5 — an mcp_tool_call on jpwb is the host’s only when it names a host tool: Codex’s resource functions are its own carriers', async () => {
		// ⛔ THE MUTANT: every mcp_tool_call on jpwb read as a host call (§4.3 as the design first worded it). Probe 1's first
		// call made three resource calls the host never received as tool calls, so the cross-check would fail every such
		// turn as a record that disagrees with the host's.
		const stdout = lines(
			THREAD,
			TURN,
			completed(
				hostCall('item_0', 'list_mcp_resources', 'failed', {
					result: null,
					error: { message: 'resources/list failed' }
				})
			),
			completed(
				hostCall('item_1', 'list_mcp_resource_templates', 'failed', {
					result: null,
					error: { message: 'x' }
				})
			),
			completed(hostCall('item_2', 'read_mcp_resource', 'completed')),
			completed(hostCall('item_3', 'write_file', 'completed')),
			message('item_4', 'DONE'),
			COMPLETED
		);
		expect(parsed(await read(stdout)).events).toEqual([
			{ kind: 'OWN_TOOL', name: 'list_mcp_resources', ran: false },
			{ kind: 'OWN_TOOL', name: 'list_mcp_resource_templates', ran: false },
			{ kind: 'OWN_TOOL', name: 'read_mcp_resource', ran: true },
			{ kind: 'HOST_CALL', name: 'write_file', sent: true },
			{ kind: 'ASSISTANT_MESSAGE' }
		]);
	});

	it('⛔ an mcp_tool_call on ANOTHER server is a tool of Codex’s own that ran, whatever its tool is called', async () => {
		// ⛔ THE MUTANT: carriers known by tool name alone. A server of the operator's could offer a tool named
		// `list_mcp_resources`, and it would pass as plumbing to the host.
		const stdout = lines(
			THREAD,
			TURN,
			completed({ ...hostCall('item_0', 'list_mcp_resources', 'completed'), server: 'operator' }),
			completed({ ...hostCall('item_1', 'write_file', 'failed'), server: 'operator' }),
			COMPLETED
		);
		expect(parsed(await read(stdout)).events).toEqual([
			{ kind: 'OWN_TOOL', name: 'mcp_tool_call', ran: true },
			{ kind: 'OWN_TOOL', name: 'mcp_tool_call', ran: true }
		]);
	});

	it('⭐ MH-0c F12 — a host call Codex refused for approval never reached the host: it was not sent', async () => {
		// ⛔ THE MUTANT: every host call read as sent. The host's cross-check would then fail the turn as a record that
		// disagrees with the host's, where the true fact is a refused attempt (D21).
		const approval = {
			result: null,
			error: { message: 'MCP tool call requires approval, but approval policy is never' }
		};
		const stdout = lines(
			THREAD,
			TURN,
			completed(hostCall('item_0', 'write_file', 'failed', approval)),
			completed(hostCall('item_1', 'run_command', 'declined', { result: null })),
			// ⭑ Codex's own timeout of a call the host DID receive (Probe 0's A13b): sent.
			completed(
				hostCall('item_2', 'write_file', 'failed', {
					result: null,
					error: {
						message:
							'tool call error: tool call failed for `jpwb/write_file`\n\nCaused by:\n    timed out awaiting tools/call after 20s'
					}
				})
			),
			// ⭑ The host's own refusal (`isError`, Probe 0's A9): sent, and answered.
			completed(hostCall('item_3', 'write_file', 'failed')),
			COMPLETED
		);
		expect(parsed(await read(stdout)).events).toEqual([
			{ kind: 'HOST_CALL', name: 'write_file', sent: false },
			{ kind: 'HOST_CALL', name: 'run_command', sent: false },
			{ kind: 'HOST_CALL', name: 'write_file', sent: true },
			{ kind: 'HOST_CALL', name: 'write_file', sent: true }
		]);
	});

	it('⭐ turn.failed is CLI_ERROR’s known shape: its message is the excerpt (D19a)', async () => {
		// ⛔ THE MUTANT: ignore turn.failed. Probe 0's A18 exited 1 with it, and its message is the only account of why.
		const stdout = lines(
			THREAD,
			TURN,
			{
				type: 'error',
				message: 'stream disconnected before completion: the provider failed this turn'
			},
			{
				type: 'turn.failed',
				error: { message: 'stream disconnected before completion: the provider failed this turn' }
			}
		);
		const reading = parsed(await read(stdout, { exitCode: 1 }));
		expect(reading.errorExcerpt).toBe(
			'stream disconnected before completion: the provider failed this turn'
		);
		expect(reading.surface).toEqual(MEASURED_OWN_SURFACE);
	});

	it('⭐ MH-0c F10 — a reroute notice reports the model that served, so the opener fails the turn as substituted (D22)', async () => {
		// ⛔ THE MUTANT: read the notice as a benign one. Codex still answers after a reroute and exits 0 (Probe 0's A11),
		// so the turn would pass as the configured model's.
		const stdout = lines(
			THREAD,
			TURN,
			completed({
				id: 'item_0',
				type: 'error',
				message: 'model rerouted: gpt-5.6-sol -> gpt-5.6-terra (HighRiskCyberActivity)'
			}),
			completed({
				id: 'item_1',
				type: 'error',
				message: 'Your account was flagged for potentially high-risk cyber activity.'
			}),
			message('item_2', 'DONE'),
			COMPLETED
		);
		expect(parsed(await read(stdout, { last: 'DONE' })).reportedModels).toEqual(['gpt-5.6-terra']);
	});

	it('⭑ the two transport notices Probe 0 measured are benign: the turn they precede still answers', async () => {
		// ⛔ THE MUTANT: every error event is an error. Codex retries its transport and says so (Probe 0's A14), and the
		// turn after it completed.
		const stdout = lines(
			THREAD,
			TURN,
			{ type: 'error', message: 'Reconnecting... 2/5 (unexpected status 404 Not Found)' },
			completed({
				id: 'item_0',
				type: 'error',
				message: 'Falling back from WebSockets to HTTPS transport. unexpected status 404'
			}),
			message('item_1', 'DONE'),
			COMPLETED
		);
		const reading = parsed(await read(stdout, { last: 'DONE' }));
		expect(reading.errorExcerpt).toBeUndefined();
		expect(reading.events).toEqual([{ kind: 'ASSISTANT_MESSAGE' }]);
	});

	it('⛔ an error of a shape this driver does not know is an error with no excerpt: the code stands alone (D19a)', async () => {
		// ⛔ THE MUTANT: pass over an unknown error. "Codex is ignoring 1 unrecognized configuration setting" is one, which
		// `--strict-config` exists to prevent (MH-0c F6), and so is any notice no probe has seen.
		for (const event of [
			completed({
				id: 'item_0',
				type: 'error',
				message: 'Codex is ignoring 1 unrecognized configuration setting.'
			}),
			{ type: 'error', message: 'something no probe has seen' }
		]) {
			const reading = parsed(
				await read(lines(THREAD, TURN, event, message('item_1', 'DONE'), COMPLETED), {
					last: 'DONE'
				})
			);
			expect(reading.errorExcerpt, JSON.stringify(event)).toBe('');
		}
	});

	it('⭑ D23 — a reasoning item is volunteered reasoning, never the answer', async () => {
		// ⭑ None arrived in Probe 1: the catalog asks for no summary. Were one to, it is reasoning, and the answer is still
		// Codex's last message.
		const stdout = lines(
			THREAD,
			TURN,
			completed({ id: 'item_0', type: 'reasoning', text: 'first, the plan' }),
			message('item_1', 'DONE'),
			COMPLETED
		);
		const reading = parsed(await read(stdout, { last: 'DONE' }));
		expect(reading.volunteeredReasoning).toBe('first, the plan');
		expect(reading.answer).toBe('DONE');
		expect(reading.events).toEqual([{ kind: 'ASSISTANT_MESSAGE' }]);
	});

	it('⛔ a record that is not one whole turn holds no proof of the surface: no thread first, or no terminal event last', async () => {
		// ⛔ THE MUTANT: declare the surface whatever the record holds. The version pin and the catalog are the proof only of
		// a turn Codex ran to its end.
		for (const stdout of [
			lines(TURN, message('item_0', 'DONE'), COMPLETED),
			lines(THREAD, TURN, message('item_0', 'DONE')),
			lines(THREAD, TURN, COMPLETED, message('item_0', 'DONE')),
			lines(THREAD, THREAD, TURN, COMPLETED)
		])
			expect(parsed(await read(stdout)).surface, stdout).toBeUndefined();
	});

	it.each([
		// ⭑ One thread, one terminal event and it last: only the first event is not the thread's.
		['the thread not first', lines(TURN, THREAD, COMPLETED)],
		// ⭑ The thread first, and the last event terminal: only the count of terminal events is not one.
		['two terminal events, the last one last', lines(THREAD, TURN, COMPLETED, COMPLETED)]
	])(
		'⛔ a record with %s holds no proof of the surface: that conjunct alone refuses it',
		async (_, stdout) => {
			// ⛔ ONE MUTANT PER CONJUNCT: `events[0]?.type === 'thread.started'` removed; `shape.terminals === 1` removed. Every
			// arrangement above trips two conjuncts or another one (TURN, msg, COMPLETED fails the first-event check AND the
			// one-thread check), so none of them shows either conjunct matters.
			expect(parsed(await read(stdout)).surface).toBeUndefined();
			// ⭑ CONTROL: the same events in the one order that is a whole turn declare it.
			expect(parsed(await read(lines(THREAD, TURN, COMPLETED))).surface).toEqual(
				MEASURED_OWN_SURFACE
			);
		}
	);

	it('⛔ a line that is not a JSON event, or an event of a type this driver does not know, makes the record unparseable', async () => {
		// ⛔ THE MUTANT: pass over a line the driver cannot read. A record read in part is not one (D14a).
		for (const stdout of [
			`${LIVE_CALL_2}not json\n`,
			lines(THREAD, TURN, { type: 'turn.forked' }, COMPLETED),
			lines(THREAD, TURN, { item: {} }, COMPLETED),
			lines(THREAD, TURN, completed({ id: 'item_0' }), COMPLETED),
			lines(
				THREAD,
				TURN,
				completed({ id: 'item_0', type: 'mcp_tool_call', server: 'jpwb', status: 'completed' }),
				COMPLETED
			)
		])
			expect((await read(stdout)).read, stdout).toBe('UNPARSEABLE');
		// ⭑ And nothing at all is no record.
		expect((await read('')).read).toBe('ABSENT');
	});
});

describe('⭐ D24, MH-0c F4 — what Codex says only on its error stream', () => {
	const ROUTER = '2026-10-18T19:22:58.853142Z ERROR codex_core::tools::router: error=';
	const classify = (...errorLines: string[]) => codexExecutorDriver().classifyStderr(errorLines);

	it.each([
		['unsupported call: mcp__jpwbno_such_tool', 'codex_core::tools::router: unsupported call'],
		['unsupported call: exec_command', 'codex_core::tools::router: unsupported call'],
		[
			'unsupported custom tool call: apply_patch',
			'codex_core::tools::router: unsupported custom tool call'
		],
		[
			'request_user_input is unavailable in Default mode',
			'codex_core::tools::router: request_user_input is unavailable in Default mode'
		],
		[
			'patch rejected: writing is blocked by read-only sandbox; rejected by user approval settings',
			'codex_core::tools::router: patch rejected: writing is blocked by read-only sandbox; rejected by user approval settings'
		],
		[
			'exec_command failed: CreateProcess { message: "Rejected(\\"node --version\\")" }',
			'codex_core::tools::router: exec_command failed'
		],
		['a shape no probe has seen: with its own words', 'codex_core::tools::router: error']
	])(
		'⛔ a call Codex refused before it was sent (%s) is an error: its JSONL does not hold it',
		(said, excerpt) => {
			// ⛔ THE MUTANTS: ignore the router's lines (an attempt the record cannot hold would vanish, D21); and excerpt the
			// whole line, which carries the name or the command the MODEL chose (D19a).
			expect(classify('unrelated', `${ROUTER}${said}`)).toEqual({ errorExcerpt: excerpt });
		}
	);

	it('⭑ a resource call’s failure on the error stream is passed over: its JSONL item holds it, in order', () => {
		// ⛔ THE MUTANT: every router line an error. Probe 1's first call wrote one for each resource call its JSONL also held.
		expect(
			classify(
				`${ROUTER}resources/list failed: resources/list failed for \`jpwb\`: Mcp error: -32601: Method not found`,
				`${ROUTER}resources/templates/list failed: resources/templates/list failed for \`jpwb\`: Mcp error: -32601`,
				`${ROUTER}resources/read failed: resources/read failed for \`jpwb\` (tools://list): Mcp error: -32601`
			)
		).toEqual({});
	});

	it('⭑ another component’s error, a warning, and the empty stream are no signal', () => {
		expect(
			classify(
				'2026-10-18T19:36:44.049305Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket',
				'WARNING: proceeding, even though we could not create PATH aliases'
			)
		).toEqual({});
		expect(classify()).toEqual({});
	});
});

// ── The driver through the REAL opener ─────────────────────────────────────────────────────────────────────────────

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

/** A POST to the host's server, as the bridge sends one. */
function rpc(
	url: string,
	token: string,
	body: unknown
): Promise<{ result?: { isError?: boolean } }> {
	return new Promise((resolve, reject) => {
		const target = new URL(url);
		const bytes = Buffer.from(JSON.stringify(body), 'utf8');
		const req = request(
			{
				host: target.hostname,
				port: Number(target.port),
				path: '/',
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'content-length': bytes.length,
					authorization: `Bearer ${token}`
				}
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (c: Buffer) => chunks.push(c));
				res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')));
			}
		);
		req.on('error', reject);
		req.end(bytes);
	});
}

/** Codex, as the seam plays it: it finds the host through the argv the driver built, as Codex does. */
class FakeCodex {
	readonly events: unknown[] = [THREAD, TURN];
	readonly errorLines: string[] = [];
	exitCode = 0;
	errorLinesComplete = true;
	terminal: unknown = COMPLETED;
	/** The endpoint file as Codex's bridge reads it: the server's URL and the turn's token. */
	readonly endpoint: { url: string; token: string };
	private readonly lastPath: string;
	private next = 0;
	constructor(readonly request: CliExecRequest) {
		const entry = request.args.find((a) => a.startsWith('mcp_servers.jpwb='))!;
		const endpointPath = /args=\['[^']*', '([^']*)'\]/.exec(entry)![1]!;
		this.endpoint = JSON.parse(readFileSync(endpointPath, 'utf8')) as {
			url: string;
			token: string;
		};
		this.lastPath = request.args[request.args.indexOf('-o') + 1]!;
	}
	private id(): string {
		this.next += 1;
		return `item_${this.next}`;
	}
	async call(tool: string, args: unknown): Promise<void> {
		const id = this.id();
		this.events.push(
			started({ ...hostCall(id, tool, 'in_progress'), arguments: args, result: null })
		);
		const answered = await rpc(this.endpoint.url, this.endpoint.token, {
			jsonrpc: '2.0',
			id: this.next,
			method: 'tools/call',
			params: { name: tool, arguments: args }
		});
		this.events.push(
			completed({
				...hostCall(id, tool, answered.result?.isError === true ? 'failed' : 'completed'),
				arguments: args
			})
		);
	}
	item(item: Record<string, unknown>): void {
		this.events.push(completed({ ...item, id: this.id() }));
	}
	answer(text: string): void {
		this.events.push(message(this.id(), text));
		writeFileSync(this.lastPath, text, 'utf8');
	}
	stdout(): string {
		return lines(...this.events, ...(this.terminal === undefined ? [] : [this.terminal]));
	}
}

/**
 * What `codex mcp list --json` prints for the argv it was given, as the seam plays it: the server the `-c` entry
 * configures, in the shape MH-0c's preflight arm measured, then any server `besides` adds.
 */
function listedServers(
	args: readonly string[],
	besides: readonly Record<string, unknown>[]
): string {
	const entry = args.find((a) => a.startsWith('mcp_servers.jpwb='));
	const configured =
		entry === undefined
			? []
			: [
					{
						name: 'jpwb',
						enabled: true,
						disabled_reason: null,
						transport: {
							type: 'stdio',
							command: /command='([^']*)'/.exec(entry)![1],
							args: [.../args=\['([^']*)', '([^']*)'\]/.exec(entry)!.slice(1)],
							env: null,
							env_vars: [],
							cwd: null
						},
						startup_timeout_sec: 30.0,
						tool_timeout_sec: 180.0,
						auth_status: 'unsupported'
					}
				];
	return `${JSON.stringify([...configured, ...besides], null, 2)}\n`;
}

/**
 * The seam playing Codex: `--version` answers `version`; `mcp list` lists what its argv configures, and `besides`;
 * `exec` runs the script. ⭑ Every Codex it started is kept, so a test can read the endpoint each one read.
 */
function codexExec(
	script: (codex: FakeCodex) => Promise<void>,
	version = 'codex-cli 0.162.1',
	besides: readonly Record<string, unknown>[] = []
): CliExec & { requests: CliExecRequest[]; codexes: FakeCodex[] } {
	const requests: CliExecRequest[] = [];
	const codexes: FakeCodex[] = [];
	const answered = (stdout: string) => ({
		done: Promise.resolve({
			exitCode: 0,
			stdout,
			stdoutComplete: true,
			errorLines: [],
			errorLinesComplete: true
		}),
		kill: async () => undefined
	});
	const exec: CliExec = (req) => {
		requests.push(req);
		if (req.args[0] === '--version') return answered(`${version}\n`);
		if (req.args[0] === 'mcp') return answered(listedServers(req.args, besides));
		const codex = new FakeCodex(req);
		codexes.push(codex);
		const done = script(codex).then((): CliRun => ({
			exitCode: codex.exitCode,
			stdout: codex.stdout(),
			stdoutComplete: true,
			errorLines: codex.errorLines,
			errorLinesComplete: codex.errorLinesComplete
		}));
		return { done, kill: async () => undefined };
	};
	return Object.assign(exec, { requests, codexes });
}

async function open(
	exec: CliExec,
	selection: CliExecutorSelection = SELECTION,
	driver: CliDriver = codexExecutorDriver()
): Promise<ProducerSession> {
	const session = await openCliExecutionSession(context(), selection, driver, {
		exec,
		root,
		turnTimeoutMs: 60_000,
		now: () => '2026-10-18T10:00:00Z'
	});
	sessions.push(session);
	return session;
}

const turn = async (
	session: ProducerSession,
	text = 'INSTRUCTION'
): Promise<ToolInvocationResult> => (await session.turn(text)) as ToolInvocationResult;
const messageOf = (r: ToolInvocationResult): string =>
	r.answer.arrived ? '' : 'message' in r.answer ? (r.answer.message ?? '') : '';
const ANSWER = '{"workProduct":"done","rationale":{}}';

describe('⭐ the Codex driver through the real opener', () => {
	it('⭑ a turn as Probe 1’s second call ran: the host’s calls OBSERVED by their minted names, the answer, HOST_CONFIGURED', async () => {
		const exec = codexExec(async (codex) => {
			await codex.call('write_file', { path: 'a.txt', contents: 'hello' });
			await codex.call('run_command', { argv: ['node', '--version'] });
			codex.answer(ANSWER);
		});
		const result = await turn(await open(exec));
		expect(result.answer).toEqual({ arrived: true, text: ANSWER });
		expect(result.identityEvidence).toBe('HOST_CONFIGURED');
		expect(result.producer).toEqual({
			agentId: 'execution.model-invocation',
			modelId: 'gpt-5.6-sol',
			providerId: 'codex'
		});
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'run_command', outcome: 'COMPLETED' }
			]
		});
		expect(readFileSync(join(workspaceDir, 'a.txt'), 'utf8')).toBe('hello');
		expect(readWorkspaceTaint(workspaceDir).tainted).toBe(false);
		expect(result.sessionExport).toBeUndefined();
		// ⭑ The preflight ran first, its version and then its MCP listing, then the turn, with the prompt on stdin.
		expect(exec.requests.map((r) => r.args[0])).toEqual(['--version', 'mcp', 'exec']);
		expect(exec.requests[2]!.stdin).toContain('INSTRUCTION');
		// ⛔ D40 — THE TURN'S TOKEN, AS CODEX'S BRIDGE READ IT FROM THE ENDPOINT FILE, IS IN NO ELEMENT OF ANY ARGV CODEX WAS
		// GIVEN, NO VARIABLE OF ITS ENVIRONMENT, AND NOT ITS STDIN. ⛔ THE MUTANT: the opener appends the token to the CLI's
		// stdin, where the cli-executor-session tests' C5, which asks argv and the environment, does not look.
		const token = exec.codexes[0]!.endpoint.token;
		expect(token, 'arrangement: the token Codex read').toMatch(/^[0-9a-f]{64}$/);
		for (const r of exec.requests) {
			const asked = r.args[0]!;
			expect(
				r.args.some((a) => a.includes(token)),
				`${asked}: argv`
			).toBe(false);
			expect(
				Object.values(r.env).some((v) => v.includes(token)),
				`${asked}: environment`
			).toBe(false);
			expect(r.stdin ?? '', `${asked}: stdin`).not.toContain(token);
		}
	});

	it('⛔ D14 through the opener — an MCP server beside jpwb in Codex’s listing refuses the session, and Codex never runs a turn', async () => {
		// ⛔ THE MUTANT: no listing in the preflight. A server any source Codex still reads defines would be started with the
		// turn's Codex, and nothing in the session would show it.
		const exec = codexExec(async (codex) => codex.answer(ANSWER), 'codex-cli 0.162.1', [
			{
				name: 'operator',
				enabled: true,
				transport: { type: 'stdio', command: 'operator-server', args: [] }
			}
		]);
		await expect(open(exec)).rejects.toThrow(
			"The CLI executor session for 'codex' is refused by its preflight: its MCP listing names 2 servers, and the run " +
				'folder’s jpwb must be the only one (JAN-MHX D14).'
		);
		expect(exec.requests.map((r) => r.args[0])).toEqual(['--version', 'mcp']);
	});

	it.each([
		[
			'a skill folder created in ~/.codex/skills',
			'~/.codex/skills',
			(home: string) => mkdirSync(join(home, '.codex', 'skills', 'planted'))
		],
		[
			'a skill folder created in the listed root',
			'~/.codex/skills/.system',
			(home: string) => mkdirSync(join(home, '.codex', 'skills', '.system', 'planted'))
		],
		[
			'an AGENTS.override.md planted in ~/.codex',
			'~/.codex/AGENTS.override.md',
			(home: string) => writeFileSync(join(home, '.codex', 'AGENTS.override.md'), 'planted', 'utf8')
		],
		[
			'Codex’s program replaced',
			'the Codex program',
			(_home: string, program: string) =>
				writeFileSync(program, 'another program, of another size', 'utf8')
		]
	])(
		'⛔ D44a through the opener — %s between turns refuses the next turn, naming it',
		async (_, name, plant) => {
			// ⭑ The home and %APPDATA% stand in only while the driver is made, which is when it names its sources; the opener
			// then runs under this host's own home, as its ancestor check needs.
			const home = join(container, 'home');
			mkdirSync(join(home, '.codex', 'skills', '.system'), { recursive: true });
			const appData = join(container, 'AppData', 'Roaming');
			const program = programUnder(appData);
			mkdirSync(dirname(program), { recursive: true });
			writeFileSync(program, 'a program', 'utf8');
			vi.stubEnv('USERPROFILE', home);
			vi.stubEnv('HOME', home);
			vi.stubEnv('APPDATA', appData);
			const driver = codexExecutorDriver();
			vi.unstubAllEnvs();
			const exec = codexExec(async (codex) => codex.answer(ANSWER));
			const session = await open(exec, SELECTION, driver);
			expect((await turn(session)).answer).toEqual({ arrived: true, text: ANSWER });
			await new Promise((r) => setTimeout(r, 20));
			plant(home, program);
			const second = await turn(session, 'THE FINDINGS');
			expect(messageOf(second)).toMatch(
				new RegExp(`^EXECUTOR_CONFIG_CHANGED: .* It names: ${name.replaceAll('.', '\\.')}\\.$`)
			);
			expect(
				exec.requests.map((r) => r.args[0]),
				'Codex was started for the refused turn'
			).toEqual(['--version', 'mcp', 'exec']);
		}
	);

	it('⛔ an error stream the opener could not read whole fails the turn CLI_ERROR, though its JSONL and its answer are whole', async () => {
		// ⭑ The scenario of F4: the error stream is the only record of a call Codex rejected before sending it, the
		// resource-failure lines the driver passes over echo the uri the model chose (A21), so a model can push the stream
		// past the opener's bound before a call Codex rejects. Cut, the stream cannot show there was none.
		const exec = codexExec(async (codex) => {
			codex.errorLines.push(
				`2026-10-18T19:22:58.853142Z ERROR codex_core::tools::router: error=resources/read failed: resources/read failed for \`jpwb\` (${'x'.repeat(200)}): Mcp error: -32601`
			);
			codex.errorLinesComplete = false;
			codex.answer(ANSWER);
		});
		const said = messageOf(await turn(await open(exec)));
		expect(said).toMatch(/^CLI_ERROR: /);
		expect(said).toContain('passed the host’s bound, so it could not be read whole');
	});

	it('⭑ a repair turn reads its own last-message file: turn 2’s answer is turn 2’s', async () => {
		const session = await open(
			codexExec(async (codex) =>
				codex.answer(`answer ${codex.request.args.find((a) => a.endsWith('.txt'))?.slice(-10)}`)
			)
		);
		const first = await turn(session);
		const second = await turn(session, 'THE FINDINGS');
		expect(first.answer.arrived && first.answer.text).toContain('last-1.txt');
		expect(second.answer.arrived && second.answer.text).toContain('last-2.txt');
	});

	it('⛔ a command Codex ran itself fails the turn CLI_OWN_TOOL_RAN, among the host’s calls in order, and taints the workspace', async () => {
		const exec = codexExec(async (codex) => {
			await codex.call('write_file', { path: 'a.txt', contents: 'x' });
			codex.item({
				type: 'command_execution',
				command: 'node --version',
				aggregated_output: '',
				exit_code: 0,
				status: 'completed'
			});
			codex.answer(ANSWER);
		});
		const result = await turn(await open(exec));
		expect(messageOf(result)).toMatch(/^CLI_OWN_TOOL_RAN: /);
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'cli:command_execution', outcome: 'UNKNOWN' }
			]
		});
		expect(readWorkspaceTaint(workspaceDir)).toEqual({
			tainted: true,
			entries: [{ code: 'CLI_OWN_TOOL_RAN', toolId: 'codex', turn: 1, at: '2026-10-18T10:00:00Z' }]
		});
		expect(result.sessionExport).toBeDefined();
	});

	it('⭐ MH-0c F5 — a resource call the host refused, then an answer: the answer stands, and the attempt is REFUSED in its place', async () => {
		const exec = codexExec(async (codex) => {
			codex.item(
				hostCall('', 'list_mcp_resources', 'failed', {
					result: null,
					error: { message: 'resources/list failed' }
				})
			);
			await codex.call('write_file', { path: 'a.txt', contents: 'x' });
			codex.answer(ANSWER);
		});
		const result = await turn(await open(exec));
		expect(result.answer).toEqual({ arrived: true, text: ANSWER });
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [
				{ name: 'cli:list_mcp_resources', outcome: 'REFUSED' },
				{ name: 'write_file', outcome: 'COMPLETED' }
			]
		});
		const report = governedToolCallReport(result.observedToolCalls);
		expect(report.observation === 'OBSERVED' && report.calls?.map((c) => c.nameProvenance)).toEqual(
			['NOT_MINTED', 'MINTED_BY_HOST']
		);
	});

	it('⭐ MH-0c F12 — a host call refused for approval, with nothing after it, fails the turn CLI_ENDED_ON_REFUSAL; with an answer after it, the answer stands', async () => {
		const refused = {
			result: null,
			error: { message: 'MCP tool call requires approval, but approval policy is never' }
		};
		const stopped = codexExec(async (codex) => {
			codex.answer('I will write the file.');
			codex.item(hostCall('', 'write_file', 'failed', refused));
		});
		const failed = await turn(await open(stopped));
		expect(messageOf(failed)).toMatch(/^CLI_ENDED_ON_REFUSAL: /);
		expect(failed.observedToolCalls).toMatchObject({
			calls: [{ name: 'write_file', outcome: 'REFUSED' }]
		});
		const went = codexExec(async (codex) => {
			codex.item(hostCall('', 'write_file', 'failed', refused));
			codex.answer(ANSWER);
		});
		expect((await turn(await open(went))).answer).toEqual({ arrived: true, text: ANSWER });
	});

	it('⭐ MH-0c F10 — a reroute fails the turn CLI_MODEL_SUBSTITUTED, naming both models', async () => {
		const exec = codexExec(async (codex) => {
			codex.item({
				type: 'error',
				message: 'model rerouted: gpt-5.6-sol -> gpt-5.6-terra (HighRiskCyberActivity)'
			});
			codex.answer(ANSWER);
		});
		const result = await turn(await open(exec));
		expect(messageOf(result)).toBe(
			'CLI_MODEL_SUBSTITUTED: The CLI reports that a model other than the configured one served the turn. ' +
				"Configured: 'gpt-5.6-sol'; reported: 'gpt-5.6-terra'."
		);
	});

	it('⭐ MH-0c F4 — a call Codex refused before sending it fails the turn CLI_ERROR, with Codex’s words and never the name the model chose', async () => {
		// ⭑ The attempt is on the error stream alone, which carries no place in the record's order: it cannot be recorded
		// among the calls as Pi's would be, so the turn is not accepted as though it held every attempt.
		const exec = codexExec(async (codex) => {
			codex.errorLines.push(
				'2026-10-18T19:22:58.853142Z ERROR codex_core::tools::router: error=unsupported call: mcp__jpwbdelete_everything'
			);
			codex.answer(ANSWER);
		});
		const said = messageOf(await turn(await open(exec)));
		expect(said).toMatch(/^CLI_ERROR: /);
		expect(said).toContain('The CLI reported: “codex_core::tools::router: unsupported call”');
		expect(said).not.toContain('delete_everything');
	});

	it('⭐ a turn.failed with exit 1 is CLI_ERROR with Codex’s message (D19a)', async () => {
		const exec = codexExec(async (codex) => {
			codex.events.push({
				type: 'error',
				message: 'stream disconnected before completion: the provider failed'
			});
			codex.terminal = {
				type: 'turn.failed',
				error: { message: 'stream disconnected before completion: the provider failed' }
			};
			codex.exitCode = 1;
		});
		expect(messageOf(await turn(await open(exec)))).toContain(
			'The CLI reported: “stream disconnected before completion: the provider failed”'
		);
	});

	it('⭐ D19a — an error of no shape the driver knows fails the turn CLI_ERROR with the code alone, and none of its words', async () => {
		// ⭑ The driver hands the opener an empty excerpt for it, which the opener reads as an error with nothing to quote.
		const exec = codexExec(async (codex) => {
			codex.item({ type: 'error', message: 'something no probe has seen, in words of its own' });
			codex.answer(ANSWER);
		});
		const said = messageOf(await turn(await open(exec)));
		expect(said).toMatch(/^CLI_ERROR: /);
		// ⭑ The code's own sentence begins "The CLI reported an error"; what may not follow it is a quoted excerpt.
		expect(said).not.toContain('The CLI reported: “');
		expect(said).not.toContain('no probe has seen');
	});

	it('⛔ test 5 through the opener — a Codex of another version refuses the session, before any turn', async () => {
		const exec = codexExec(async (codex) => codex.answer(ANSWER), 'codex-cli 0.163.0');
		await expect(open(exec)).rejects.toThrow(
			"The CLI executor session for 'codex' is refused by its preflight: it reports 'codex-cli 0.163.0'"
		);
		expect(exec.requests.map((r) => r.args[0])).toEqual(['--version']);
	});

	it('⛔ a model the catalog does not hold refuses the session, and Codex is never started', async () => {
		const exec = codexExec(async (codex) => codex.answer(ANSWER));
		await expect(open(exec, { ...SELECTION, modelId: 'gpt-5.6-terra' })).rejects.toThrow(
			'it runs only the model its pinned catalog holds, gpt-5.6-sol'
		);
		expect(exec.requests).toEqual([]);
	});
});
