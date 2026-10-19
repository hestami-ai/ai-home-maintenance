// ⭐⭐ `JAN-MHX` MH-5 — the victim for THE agy DRIVER (`DESIGN-multi-harness-executor.md` §4.2; roadmap MH-5 tests 1–9),
// read against what MH-0b measured on agy 1.4.2.
//
// ⭑ TWO KINDS OF CASE. The driver's own answers (its run folder, argv, stdin line, preflight, reading and stderr
// classification) are asked directly. And whole turns are driven through the REAL opener and the REAL host tool server,
// with a `CliExec` seam that plays agy: it finds the endpoint through the agent file the driver wrote, calls the host's
// tools with the turn's token as agy's bridge would, writes its log where `--log-file` says, and answers in the
// stream-json shapes P1a and P1b recorded (`mhx/probe-agy/p1`). No process is started and no model is called.
// ⚠ Every directory is under `os.tmpdir()`, never under the repository.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { basename, delimiter, dirname, join, relative } from 'node:path';
import type { ProcessRunOutcome, ProcessRunner } from '@janumipwb/rph-ports';
import { EXECUTION_CONTRACT_PROMPT } from '../execution/execution-contract.js';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import type { ProducerSession, ProducerSessionContext } from '../execution/producer-session.js';
import { readWorkspaceTaint } from '../execution/workspace-taint.js';
import { AGY_AGENT_FILE, AGY_EXECUTOR_AGENT, agyExecutorDriver } from './agy-executor-driver.js';
import type { ToolInvocationResult } from './backing-tool.js';
import {
	EXECUTOR_HOST_TOOLS_PREAMBLE,
	openCliExecutionSession,
	type CliExec,
	type CliExecRequest,
	type CliRecordReading,
	type CliRunFolder,
	type CliTurnInput
} from './cli-executor-session.js';

const MODEL = 'gemini-4-argon-high';
const SELECTION = { kind: 'CLI', toolId: 'agy', modelId: MODEL } as const;
const PROGRAM_NAME = process.platform === 'win32' ? 'agy.exe' : 'agy';

let container = '';
let workspaceDir = '';
let programs = '';
const sessions: ProducerSession[] = [];

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-agy-driver-'));
	workspaceDir = join(container, 'workspace');
	mkdirSync(workspaceDir);
	// ⭑ agy's program, where the driver looks for it, on PATH: an empty file, which nothing here starts.
	programs = join(container, 'programs');
	mkdirSync(programs);
	writeFileSync(join(programs, PROGRAM_NAME), '');
	vi.stubEnv('PATH', programs);
});
afterEach(async () => {
	vi.unstubAllEnvs();
	for (const s of sessions.splice(0)) s.dispose();
	await new Promise((r) => setTimeout(r, 400));
	await rm(container, { recursive: true, force: true, maxRetries: 5 });
});

/** A runner whose every command completes: the host's `run_command` reaches it through the minted tool. */
const completingRunner: ProcessRunner = {
	kind: 'REAL',
	run: async (): Promise<ProcessRunOutcome> => ({
		ran: true,
		exitCode: 0,
		timedOut: false,
		stdout: 'ok\n',
		stderr: '',
		omittedRegions: [],
		outputComplete: true,
		retention: { retained: false, notRetainedBecause: 'the stub runner retains nothing' },
		durationMs: 1
	})
};

function context(runner: ProcessRunner = completingRunner): ProducerSessionContext {
	return {
		workspace: createFilesystemWorkspace({
			ownerKind: 'UNDERTAKING',
			ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
			purgeability: 'RETAINED_BY_PARTICIPATION',
			directoryPath: workspaceDir
		}),
		runner,
		grantedCapabilities: ['file-system', 'process-execution'],
		bindingAuthorizationStatus: 'AUTHORIZED'
	};
}

/** A run folder as the opener hands one to a driver, for the cases that ask the driver directly. */
function runFolder(directory = join(container, 'run')): CliRunFolder {
	return {
		directory,
		cliDirectory: join(directory, 'cli'),
		hostDirectory: join(directory, 'host'),
		bridgePath: join(directory, 'host', 'jpwb-bridge.mjs'),
		endpointPath: join(directory, 'host', 'endpoint.json'),
		nodePath: process.execPath,
		serverName: 'jpwb',
		systemPrompt: `${EXECUTOR_HOST_TOOLS_PREAMBLE}\n\n${EXECUTION_CONTRACT_PROMPT}`
	};
}

/** One turn, as the opener tells a driver it. */
function turnInput(run: CliRunFolder, turn = 1, userPrompt = 'MH5-THE-INSTRUCTION'): CliTurnInput {
	return {
		run,
		turn,
		modelId: MODEL,
		effort: undefined,
		prompt: `${run.systemPrompt}\n\n${userPrompt}`,
		userPrompt,
		promptPath: join(run.hostDirectory, `prompt-${turn}.txt`)
	};
}

// ── what agy writes, in the shapes MH-0b recorded ────────────────────────────────────────────────────────────────

/** One stream-json line. */
const line = (event: string, payload: unknown): string =>
	JSON.stringify({ event, [event]: payload });

/** A step update, as P1b's carry them. */
const step = (index: number, fields: Record<string, unknown>): string =>
	line('step_update', { conversation_id: 'fixture-conversation', step_index: index, ...fields });

/** P1b's pre-send rejection of an undeclared argument (B7). */
const REJECTION = {
	type: 'TOOL_ERROR',
	message: "invalid arguments:\n- additional properties 'mode' not allowed"
};

/** P1a's error, as its stream-json result and its `AGY_ERROR` line carried it (B4). */
const P1A_ERROR =
	'failed to construct executor: failed to resolve components: unknown component: tool "call_mcp_tool" not found in registry';
const P1A_AGY_ERROR_LINE = `AGY_ERROR: ${JSON.stringify({
	short_error: P1A_ERROR,
	status: 'UNKNOWN',
	error_code: 2,
	code_kind: 'grpc',
	retryable: false,
	error_id: 'fixture-error-id'
})}`;

/** P0's sibling folder: agy listing no hook, with no turn taken (B16). */
const NO_HOOKS = JSON.stringify({
	conversation_id: '',
	status: 'SUCCESS',
	response: '',
	duration_seconds: 0,
	num_turns: 0,
	usage: {
		input_tokens: 0,
		output_tokens: 0,
		thinking_tokens: 0,
		cache_read_tokens: 0,
		total_tokens: 0
	},
	command: { name: 'hooks', data: { hooks: [] } }
});

/** P0's fresh folder: one hook listed (B16), its paths fixture strings. */
const ONE_HOOK = JSON.stringify({
	conversation_id: '',
	status: 'SUCCESS',
	response: 'jpwb-guard\tenabled\tPreToolUse\t*\tcommand\tfixture-command\n',
	num_turns: 0,
	command: {
		name: 'hooks',
		data: {
			hooks: [
				{
					name: 'jpwb-guard',
					enabled: true,
					source: 'fixture-source/hooks.json',
					actions: [
						{
							event: 'PreToolUse',
							matcher: '*',
							type: 'command',
							command: 'fixture-command',
							timeout_seconds: 10
						}
					]
				}
			]
		}
	}
});

/** The log lines agy 1.4.2 writes about the model on every run with `--model` (B9), and its account line (B12). */
const logLines = (model = MODEL): string[] => [
	`I1018 15:21:36.196965       1 resolver.go:85] Model ID ${model} not in local config, defaulting to CCPA`,
	'I1018 15:21:36.197974       1 resolver.go:111] Model resolved via default',
	'I1018 15:21:36.300000       1 server_oauth.go:224] applyAuthResult: email=mh5-fixture-account@example.invalid, authMethod=consumer',
	`I1018 15:21:36.447492       1 printmode.go:202] Print mode: starting (promptLength=0, model="${model}", conversationID="")`,
	`I1018 15:21:37.136241       1 model_resolver.go:107] Resolving model ${model}`,
	'I1018 15:21:37.136241       1 model_config_manager.go:340] Propagating selected model override to backend: label="Gemini 4 Argon (High)"'
];

/** What the played agy's model does in a turn, in order. */
type Act =
	| { readonly host: string; readonly args: Record<string, unknown> }
	| { readonly rejected: string; readonly args: Record<string, unknown> }
	| { readonly own: string; readonly state?: 'DONE' | 'ERROR'; readonly error?: unknown }
	| { readonly says: string };

interface Script {
	readonly acts?: readonly Act[];
	/** Replaces the result event; `null` writes none. */
	readonly result?: Record<string, unknown> | null;
	readonly initModel?: string;
	readonly log?: readonly string[];
	readonly exitCode?: number;
	readonly errorLines?: readonly string[];
	/** Lines written after the rest, as they are. */
	readonly extraLines?: readonly string[];
}

/** A POST to the host's server, as agy's bridge sends one. */
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
				headers: {
					'content-type': 'application/json',
					'content-length': body.length,
					authorization: `Bearer ${token}`
				}
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (c: Buffer) => chunks.push(c));
				res.on('end', () => {
					const text = Buffer.concat(chunks).toString('utf8');
					resolve({
						status: res.statusCode ?? 0,
						body: text === '' ? undefined : JSON.parse(text)
					});
				});
			}
		);
		req.on('error', reject);
		req.end(body);
	});
}

/** The endpoint file the agent file names: the second `args` item of its one MCP server, a JSON-quoted string. */
function endpointNamedBy(cwd: string): string {
	const agent = readFileSync(
		join(cwd, '.agents', 'agents', `${AGY_EXECUTOR_AGENT}.md`),
		'utf8'
	).split('\n');
	const at = agent.indexOf('    args:');
	return JSON.parse(agent[at + 2]!.slice('      - '.length)) as string;
}

/** agy, as the seam plays it: the preflight's listing, and each turn's script, in order. */
function playedAgy(
	scripts: readonly Script[],
	listing = NO_HOOKS
): CliExec & { requests: CliExecRequest[] } {
	const requests: CliExecRequest[] = [];
	let next = 0;
	const exec: CliExec = (req) => {
		requests.push(req);
		const done = (async () => {
			if (req.args.includes('/hooks'))
				return { exitCode: 0, stdout: listing, stdoutComplete: true, errorLines: [] };
			const script = scripts[next++] ?? {};
			const endpoint = JSON.parse(readFileSync(endpointNamedBy(req.cwd), 'utf8')) as {
				url: string;
				token: string;
			};
			const out = [
				// ⭑ `cwd` is agy's working folder, the run's `cli/`, by its real path, as P1b's init carried it.
				line('init', {
					model: script.initModel ?? MODEL,
					cwd: req.cwd,
					agent: AGY_EXECUTOR_AGENT,
					tools: ['run_command', 'write_to_file', 'view_file'],
					permission_mode: 'request-review'
				}),
				step(0, { state: 'DONE', step_type: 'user_input' })
			];
			let index = 1;
			let said = '';
			for (const act of script.acts ?? []) {
				if ('says' in act) {
					out.push(
						step(index++, { state: 'DONE', step_type: 'agent_response', text_delta: act.says })
					);
					said = act.says;
					continue;
				}
				out.push(step(index++, { state: 'DONE', step_type: 'agent_response' }));
				if ('host' in act) {
					const name = `mcp_jpwb_${act.host}`;
					out.push(
						step(index, {
							state: 'ACTIVE',
							step_type: 'tool',
							tool_name: name,
							tool_info: { name, parameters: act.args }
						})
					);
					const answered = await rpc(endpoint.url, endpoint.token, {
						jsonrpc: '2.0',
						id: index,
						method: 'tools/call',
						params: { name: act.host, arguments: act.args }
					});
					const output = String(answered.body?.result?.content?.[0]?.text ?? '');
					out.push(
						step(index++, {
							state: 'DONE',
							step_type: 'tool',
							tool_name: name,
							tool_info: { name, parameters: act.args, output }
						})
					);
				} else if ('rejected' in act) {
					const name = `mcp_jpwb_${act.rejected}`;
					out.push(
						step(index, {
							state: 'ACTIVE',
							step_type: 'tool',
							tool_name: name,
							tool_info: { name, parameters: act.args }
						})
					);
					out.push(
						step(index++, {
							state: 'ERROR',
							step_type: 'tool',
							tool_name: name,
							tool_info: { name, parameters: act.args, error: REJECTION }
						})
					);
				} else {
					const state = act.state ?? 'DONE';
					out.push(
						step(index++, {
							state,
							step_type: 'tool',
							tool_name: act.own,
							tool_info: {
								name: act.own,
								parameters: {},
								...(act.error === undefined ? {} : { error: act.error })
							}
						})
					);
				}
			}
			if (script.result !== null)
				out.push(
					line(
						'result',
						script.result ?? {
							conversation_id: 'fixture-conversation',
							status: 'SUCCESS',
							response: said,
							num_turns: 1
						}
					)
				);
			out.push(...(script.extraLines ?? []));
			const log = req.args[req.args.indexOf('--log-file') + 1]!;
			writeFileSync(log, `${(script.log ?? logLines()).join('\n')}\n`, 'utf8');
			return {
				exitCode: script.exitCode ?? 0,
				stdout: `${out.join('\n')}\n`,
				stdoutComplete: true,
				errorLines: [...(script.errorLines ?? [])]
			};
		})();
		return { done, kill: async () => undefined };
	};
	return Object.assign(exec, { requests });
}

async function open(exec: CliExec, runner?: ProcessRunner): Promise<ProducerSession> {
	const session = await openCliExecutionSession(context(runner), SELECTION, agyExecutorDriver(), {
		exec,
		root: join(container, 'root'),
		turnTimeoutMs: 60_000,
		now: () => '2026-10-18T10:00:00Z'
	});
	sessions.push(session);
	return session;
}

const turnOf = async (
	session: ProducerSession,
	text = 'MH5-THE-INSTRUCTION'
): Promise<ToolInvocationResult> => (await session.turn(text)) as ToolInvocationResult;

const messageOf = (r: ToolInvocationResult): string =>
	r.answer.arrived ? '' : 'message' in r.answer ? (r.answer.message ?? '') : '';

/** P1b's turn (B3, B7): two host calls the host runs, then one agy rejected before sending, then the model's answer. */
const P1B: Script = {
	acts: [
		{ host: 'write_file', args: { contents: 'hello', path: 'probe.txt' } },
		{ host: 'run_command', args: { argv: ['node', '--version'] } },
		{ rejected: 'write_file', args: { contents: 'x', mode: 'append', path: 'extra.txt' } },
		{ says: 'DONE\n' }
	]
};

// ── the run folder ───────────────────────────────────────────────────────────────────────────────────────────────

describe('⭐ test 1, 2 — the run folder: one agent file, P1b’s frontmatter with no `tools:` line, and no hooks.json', () => {
	it('⛔ the agent file, pinned: P1b’s fields, the host’s server by its bridge and endpoint in host/, the system prompt as its body', () => {
		// ⛔ THE MUTANTS: inheritCustomizations true; a `tools:` line (B4: it broke the executor's construction); inheritMcp
		// true; excludeDefaultComponents false; commandExecutionPolicy on; another timeout; a path unquoted.
		const run = runFolder();
		const files = agyExecutorDriver().runFolderFiles(run);
		expect(files.map((f) => f.path)).toEqual(['cli/.agents/agents/jpwb-executor.md']);
		expect(AGY_AGENT_FILE).toBe('cli/.agents/agents/jpwb-executor.md');
		expect(files[0]!.bytes).toBe(
			[
				'---',
				'name: jpwb-executor',
				'description: The JPWB executor; only the host tools on the jpwb server.',
				'inheritCustomizations: false',
				'inheritMcp: false',
				'excludeDefaultComponents: true',
				'commandExecutionPolicy: off',
				'mcpServers:',
				'  - name: jpwb',
				`    command: ${JSON.stringify(run.nodePath)}`,
				'    args:',
				`      - ${JSON.stringify(run.bridgePath)}`,
				`      - ${JSON.stringify(run.endpointPath)}`,
				'    enabledTools:',
				'      - write_file',
				'      - run_command',
				'    timeoutSeconds: 180',
				'---',
				'# jpwb-executor',
				run.systemPrompt,
				''
			].join('\n')
		);
		expect(files[0]!.bytes).not.toMatch(/^\s*tools\s*:/m);
	});

	it('⭑ a path with a backslash or a quote is written as a JSON string, which YAML reads back as written', () => {
		const odd = join(container, 'odd "run" folder\\x');
		const bytes = agyExecutorDriver().runFolderFiles(runFolder(odd))[0]!.bytes;
		const args = bytes.split('\n').filter((l) => l.startsWith('      - "'));
		expect(args.map((l) => JSON.parse(l.slice('      - '.length)) as string)).toEqual([
			join(odd, 'host', 'jpwb-bridge.mjs'),
			join(odd, 'host', 'endpoint.json')
		]);
	});

	it('⛔ the body agy reads its system prompt from holds whole: no line of the preamble or contract is an H1 or a fence', () => {
		// ⭑ agy delimits a Markdown agent's system prompt by its H1 (changelog), so a `# ` line in the body would cut it.
		const body = runFolder().systemPrompt.split('\n');
		expect(body.filter((l) => /^#\s/.test(l) || l.trim() === '---')).toEqual([]);
	});

	it('⛔ D44 — every file the driver declares lies inside the run folder, and its logs in host/', () => {
		const run = runFolder();
		const driver = agyExecutorDriver();
		const inside = (path: string) => !relative(run.directory, path).startsWith('..');
		for (const f of driver.runFolderFiles(run))
			expect(inside(join(run.directory, f.path)), f.path).toBe(true);
		const args = driver.invocation(turnInput(run)).args;
		const preflightArgs = driver.preflight(run)!.invocation.args;
		expect(dirname(args[args.indexOf('--log-file') + 1]!)).toBe(run.hostDirectory);
		expect(dirname(preflightArgs[preflightArgs.indexOf('--log-file') + 1]!)).toBe(
			run.hostDirectory
		);
	});
});

// ── the argv and the stdin line ──────────────────────────────────────────────────────────────────────────────────

describe('⭐ test 3, 4 — the turn: its argv pinned, and the turn as one stream-json line on stdin', () => {
	it('⛔ the argv, pinned: the agent, the slug, stream-json in and out, a log in host/, slash commands off — and none of the flags §4.2 forbids', () => {
		// ⛔ THE MUTANT: add `--mode accept-edits`, which approves agy's own file writes (and MH-9's positive control uses).
		const run = runFolder();
		const invocation = agyExecutorDriver().invocation(turnInput(run, 2));
		expect(invocation.program).toBe(join(programs, PROGRAM_NAME));
		expect(invocation.args).toEqual([
			'--agent',
			'jpwb-executor',
			'--model',
			MODEL,
			'--input-format',
			'stream-json',
			'--output-format',
			'stream-json',
			'--log-file',
			join(run.hostDirectory, 'agy-2.log'),
			'--disable-slash-commands'
		]);
		for (const forbidden of [
			'--dangerously-skip-permissions',
			'--mode',
			'--effort',
			'--print-timeout',
			'-p',
			'--print'
		])
			expect(invocation.args, forbidden).not.toContain(forbidden);
	});

	it('⛔ REG-F-458 — `--model` is the model THIS turn was handed, whatever it is: never a pinned one, never the judge’s', () => {
		// ⛔ THE MUTANT: a pinned `--model` — the sponsor's own default, which the turn above also runs. A second model shows it.
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge-model');
		const args = agyExecutorDriver().invocation({
			...turnInput(runFolder()),
			modelId: 'gemini-4-argon-low'
		}).args;
		expect(args[args.indexOf('--model') + 1]).toBe('gemini-4-argon-low');
		expect(args).not.toContain('fixture-judge-model');
	});

	it('⛔ the turn goes on stdin as one stream-json line, the prompt without the system prompt, and no argv element holds it', () => {
		// ⛔ THE MUTANTS: the prompt in argv; the whole prompt, system prompt included, on stdin (the agent file's body already
		// carries it, D15).
		const run = runFolder();
		const input = turnInput(run, 1, 'MH5-INSTRUCTION, with "quotes" and a\nline break');
		const invocation = agyExecutorDriver().invocation(input);
		expect(invocation.stdin).toBe(
			'{"event":"user","message":{"content":"MH5-INSTRUCTION, with \\"quotes\\" and a\\nline break"}}\n'
		);
		expect(invocation.stdin!.split('\n')).toHaveLength(2);
		for (const arg of invocation.args) expect(arg).not.toContain('MH5-INSTRUCTION');
		expect(invocation.stdin).not.toContain(EXECUTOR_HOST_TOOLS_PREAMBLE.slice(0, 40));
	});

	it('⭑ D43, D44a — its environment constant, no carriers, and the config sources it declares, all under the home folder', () => {
		const driver = agyExecutorDriver();
		expect(driver.toolId).toBe('agy');
		expect(driver.carriers).toEqual([]);
		expect(driver.environment).toEqual({ AGY_CLI_DISABLE_AUTO_UPDATE: '1' });
		expect(driver.secretVariable).toBeUndefined();
		expect(
			driver.configSources.map((s) => relative(homedir(), s.path).replaceAll('\\', '/'))
		).toEqual([
			'.gemini/config/config.json',
			'.gemini/antigravity-cli/settings.json',
			'.gemini/config/hooks.json',
			'.gemini/config/mcp_config.json',
			'.gemini/config/plugins',
			'.gemini/config/projects'
		]);
	});
});

// ── the program ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('⭐ its program — found on the server’s PATH, by absolute path, or the session is refused before anything starts', () => {
	it('⛔ with no agy program on PATH, the session is refused at its preflight, and nothing is started', async () => {
		// ⛔ THE MUTANT: fall back to the bare name `agy`, which the spawn would search PATH for.
		vi.stubEnv('PATH', join(container, 'nothing-here'));
		const exec = playedAgy([]);
		await expect(open(exec)).rejects.toThrow('The agy executor has no program to run');
		expect(exec.requests).toEqual([]);
	});

	it('⛔ a relative PATH entry is not searched, though it holds an agy program the working folder would find', () => {
		// ⛔ THE MUTANT: search every entry, so a folder relative to wherever the server runs could supply agy.
		// ⭑ The working folder is the container for the case, so the relative entry `near` is a folder holding a program.
		mkdirSync(join(container, 'near'));
		writeFileSync(join(container, 'near', PROGRAM_NAME), '');
		const before = process.cwd();
		process.chdir(container);
		try {
			expect(
				existsSync(join('near', PROGRAM_NAME)),
				'arrangement: the relative entry holds a program'
			).toBe(true);
			vi.stubEnv('PATH', ['near', programs].join(delimiter));
			expect(agyExecutorDriver().invocation(turnInput(runFolder())).program).toBe(
				join(programs, PROGRAM_NAME)
			);
		} finally {
			process.chdir(before);
		}
	});
});

// ── the preflight ────────────────────────────────────────────────────────────────────────────────────────────────

describe('⭐ test 9 — the preflight: agy’s free hooks listing, and the session refused unless it lists none', () => {
	it('⛔ its argv, pinned: `/hooks` for this agent, as JSON, logged in host/ — and never with slash commands off', () => {
		// ⛔ THE MUTANT: `--disable-slash-commands` here, which would send `/hooks` to the model as a prompt.
		const run = runFolder();
		const check = agyExecutorDriver().preflight(run)!;
		expect(check.invocation.program).toBe(join(programs, PROGRAM_NAME));
		expect(check.invocation.args).toEqual([
			'-p',
			'/hooks',
			'--agent',
			'jpwb-executor',
			'--output-format',
			'json',
			'--log-file',
			join(run.hostDirectory, 'agy-preflight.log')
		]);
		expect(check.invocation.stdin).toBeUndefined();
	});

	it('⭑ P0’s empty listing passes, through the opener, and the turn after it runs', async () => {
		const exec = playedAgy([P1B]);
		await turnOf(await open(exec));
		expect(exec.requests.map((r) => r.args.includes('/hooks'))).toEqual([true, false]);
	});

	it('⛔ a listing with a hook refuses the session, through the opener, before any turn', async () => {
		// ⛔ THE MUTANT: skip the hooks check.
		const exec = playedAgy([P1B], ONE_HOOK);
		await expect(open(exec)).rejects.toThrow(
			'refused by its preflight: agy lists 1 hook, and this executor runs with none'
		);
		expect(exec.requests).toHaveLength(1);
	});

	it('⛔ each other arm refuses: a turn taken, another answer, unreadable JSON, a failing exit', () => {
		// ⛔ ONE MUTANT PER ARM.
		const refusal = agyExecutorDriver().preflight(runFolder())!.refusal;
		const tookATurn = JSON.stringify({ ...JSON.parse(NO_HOOKS), num_turns: 1 });
		expect(refusal({ exitCode: 0, stdout: tookATurn })).toContain(
			'took the hooks listing as a model turn'
		);
		const noCount = JSON.stringify({ command: { name: 'hooks', data: { hooks: [] } } });
		expect(refusal({ exitCode: 0, stdout: noCount })).toContain(
			'took the hooks listing as a model turn'
		);
		const otherCommand = JSON.stringify({
			num_turns: 0,
			command: { name: 'skills', data: { skills: [] } }
		});
		expect(refusal({ exitCode: 0, stdout: otherCommand })).toBe(
			"agy's answer is not a listing of its hooks."
		);
		// ⭑ Another command's answer refuses by its name, though its data holds an empty `hooks` list.
		const otherNamed = JSON.stringify({
			num_turns: 0,
			command: { name: 'skills', data: { hooks: [] } }
		});
		expect(refusal({ exitCode: 0, stdout: otherNamed })).toBe(
			"agy's answer is not a listing of its hooks."
		);
		expect(refusal({ exitCode: 0, stdout: 'not json' })).toBe(
			"agy's hooks listing could not be read as JSON."
		);
		expect(refusal({ exitCode: 1, stdout: NO_HOOKS })).toBe("agy's hooks listing exited 1.");
		expect(refusal({ exitCode: 0, stdout: NO_HOOKS })).toBeUndefined();
	});

	it('⭑ the refusal names how many hooks, never their names or sources', () => {
		const said =
			agyExecutorDriver().preflight(runFolder())!.refusal({ exitCode: 0, stdout: ONE_HOOK }) ?? '';
		expect(said).not.toContain('jpwb-guard');
		expect(said).not.toContain('fixture-source');
		expect(said).not.toContain('fixture-command');
	});
});

// ── the run folder, before each later turn ───────────────────────────────────────────────────────────────────────

describe('⭐ D44a — agy’s workspace, `cli/`, is a config source it reads on every turn, so it is checked before each one', () => {
	/** A hooks file of P0's shape (`10-F-hooks-agent`: agy lists `<cwd>/.agents/hooks.json` under this agent), its command a fixture string. */
	const PLANTED_HOOKS = JSON.stringify({
		hooks: [
			{
				name: 'planted',
				event: 'PreToolUse',
				matcher: '*',
				type: 'command',
				command: 'fixture-command'
			}
		]
	});

	it('⭑ CONTROL — two turns with nothing planted: the second is started, so the check refuses nothing the opener wrote', async () => {
		const exec = playedAgy([P1B, P1B]);
		const session = await open(exec);
		await turnOf(session);
		const second = await turnOf(session, 'MH5-FINDINGS');
		expect(messageOf(second)).toMatch(/^CLI_SURFACE_UNPROVEN: /);
		expect(exec.requests).toHaveLength(3);
	});

	it('⛔ a hooks.json a command plants in cli/.agents/ during a turn refuses the next turn before agy starts, naming no planted name', async () => {
		// ⛔ THE MUTANT: no check of what `cli/` holds, so the next turn runs under a hook that neither the host nor agy's
		// record shows (R12, R13: `run_command` is arbitrary code as the server user).
		const exec = playedAgy([
			{ acts: [{ host: 'run_command', args: { argv: ['node', 'plant.js'] } }, { says: 'DONE' }] },
			P1B
		]);
		const planting: ProcessRunner = {
			kind: 'REAL',
			run: async (request) => {
				writeFileSync(join(exec.requests[0]!.cwd, '.agents', 'hooks.json'), PLANTED_HOOKS, 'utf8');
				return completingRunner.run(request);
			}
		};
		const session = await open(exec, planting);
		expect(messageOf(await turnOf(session))).toMatch(/^CLI_SURFACE_UNPROVEN: /);
		expect(
			existsSync(join(exec.requests[0]!.cwd, '.agents', 'hooks.json')),
			'arrangement: the command planted it'
		).toBe(true);
		const second = await turnOf(session, 'MH5-FINDINGS');
		expect(messageOf(second)).toMatch(
			/^EXECUTOR_CONFIG_CHANGED: .* It names: the CLI’s working folder, cli\/, which holds 1 entry the opener did not write\.$/
		);
		expect(messageOf(second)).not.toContain('hooks.json');
		expect(exec.requests, 'agy was started for a refused turn').toHaveLength(2);
		expect(second.observedToolCalls.canObserve).toBe(false);
	});

	it('⛔ a rewrite of the agent file’s frontmatter between turns refuses the next turn, naming the file', async () => {
		// ⛔ THE MUTANT: the opener's files checked for presence, not for their bytes, so a frontmatter rewritten to inherit
		// the operator's customizations — here in a rewrite of the same size — steers the next turn.
		const exec = playedAgy([P1B, P1B]);
		const session = await open(exec);
		await turnOf(session);
		const agent = join(dirname(exec.requests[0]!.cwd), AGY_AGENT_FILE);
		const written = readFileSync(agent, 'utf8');
		const rewritten = written.replace(
			'inheritCustomizations: false',
			'inheritCustomizations: true '
		);
		expect(rewritten.length, 'arrangement: a rewrite of the same size').toBe(written.length);
		writeFileSync(agent, rewritten, 'utf8');
		const second = await turnOf(session, 'MH5-FINDINGS');
		expect(messageOf(second)).toMatch(
			/^EXECUTOR_CONFIG_CHANGED: .* It names: cli\/\.agents\/agents\/jpwb-executor\.md, which no longer holds the bytes the opener wrote\.$/
		);
		expect(exec.requests, 'agy was started for a refused turn').toHaveLength(2);
	});
});

// ── the record, read back ────────────────────────────────────────────────────────────────────────────────────────

describe('⭐ test 8 — the surface proof agy’s record cannot give (B5), and what its steps do show', () => {
	it('⛔ P1b’s turn: the host’s calls in order, the pre-send rejection REFUSED — and the turn CLI_SURFACE_UNPROVEN, with no breach', async () => {
		// ⛔ THE MUTANTS: the init event's tool list taken as the surface (every turn a breach, and the workspace tainted, for
		// tools agy never offered — B5); the host's tools taken as the whole surface (a proof the record does not hold).
		const result = await turnOf(await open(playedAgy([P1B])));
		expect(result.answer.arrived).toBe(false);
		expect(messageOf(result)).toMatch(/^CLI_SURFACE_UNPROVEN: /);
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'run_command', outcome: 'COMPLETED' },
				{ name: 'write_file', outcome: 'REFUSED' }
			]
		});
		expect(readWorkspaceTaint(workspaceDir)).toEqual({ tainted: false });
		expect(readFileSync(join(workspaceDir, 'probe.txt'), 'utf8')).toBe('hello');
		expect(existsSync(join(workspaceDir, 'extra.txt')), 'the rejected call reached the host').toBe(
			false
		);
		expect(result.identityEvidence).toBe('HOST_CONFIGURED');
		expect(result.producer).toEqual({
			agentId: 'execution.model-invocation',
			modelId: MODEL,
			providerId: 'agy'
		});
	});

	it('⛔ a tool of agy’s own that RAN is a breach: CLI_OWN_TOOL_RAN, in the record’s order, and the workspace tainted', async () => {
		// ⛔ THE MUTANT: a tool step read as the host's whatever its name, so agy's own `run_command` is taken for the host's.
		const result = await turnOf(
			await open(
				playedAgy([
					{
						acts: [
							{ host: 'write_file', args: { contents: 'one', path: 'one.txt' } },
							{ own: 'run_command' },
							{ host: 'write_file', args: { contents: 'two', path: 'two.txt' } },
							{ says: 'DONE' }
						]
					}
				])
			)
		);
		expect(messageOf(result)).toMatch(/^CLI_OWN_TOOL_RAN: /);
		expect(result.observedToolCalls).toMatchObject({
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'cli:run_command', outcome: 'UNKNOWN' },
				{ name: 'write_file', outcome: 'COMPLETED' }
			]
		});
		expect(readWorkspaceTaint(workspaceDir)).toMatchObject({
			tainted: true,
			entries: [{ code: 'CLI_OWN_TOOL_RAN', toolId: 'agy', turn: 1 }]
		});
	});

	it('⛔ an own tool’s step that ended ERROR is one that RAN, unless agy rejected its arguments before running it', async () => {
		// ⛔ THE MUTANT: read every own step that ended ERROR as refused, so a tool that ran and then failed is no breach.
		const driver = agyExecutorDriver();
		const run = runFolder();
		driver.invocation(turnInput(run));
		const read = (acts: string[]) =>
			driver.readRecord({ run, turn: 1, exitCode: 0, stdout: acts.join('\n') });
		const failedAfterRunning = await read([
			step(1, {
				state: 'ERROR',
				step_type: 'tool',
				tool_name: 'write_to_file',
				tool_info: { error: { type: 'EXECUTION_ERROR', message: 'disk full' } }
			})
		]);
		expect(failedAfterRunning).toMatchObject({
			read: 'PARSED',
			events: [{ kind: 'OWN_TOOL', name: 'write_to_file', ran: true }]
		});
		const rejected = await read([
			step(1, {
				state: 'ERROR',
				step_type: 'tool',
				tool_name: 'write_to_file',
				tool_info: { error: REJECTION }
			})
		]);
		expect(rejected).toMatchObject({
			read: 'PARSED',
			events: [{ kind: 'OWN_TOOL', name: 'write_to_file', ran: false }]
		});
	});

	it('⛔ denied actions are refused attempts, after the steps, named — and nothing that ran', async () => {
		// ⛔ THE MUTANT: drop `result.denied_actions`, so an action agy skipped for want of permission leaves no trace.
		const result = await turnOf(
			await open(
				playedAgy([
					{
						acts: [{ host: 'write_file', args: { contents: 'one', path: 'one.txt' } }],
						result: {
							status: 'SUCCESS',
							response: '',
							denied_actions: ['run_command', { name: 'write_to_file' }]
						}
					}
				])
			)
		);
		expect(result.observedToolCalls).toMatchObject({
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'cli:run_command', outcome: 'REFUSED' },
				{ name: 'cli:write_to_file', outcome: 'REFUSED' }
			]
		});
		expect(readWorkspaceTaint(workspaceDir)).toEqual({ tainted: false });
	});

	it('⭑ the model saying something after a refusal goes past it, as the record orders them (P1b’s step 7)', async () => {
		const driver = agyExecutorDriver();
		const run = runFolder();
		driver.invocation(turnInput(run));
		const reading = await driver.readRecord({
			run,
			turn: 1,
			exitCode: 0,
			stdout: [
				step(1, { state: 'DONE', step_type: 'agent_response' }),
				step(2, {
					state: 'ERROR',
					step_type: 'tool',
					tool_name: 'mcp_jpwb_write_file',
					tool_info: { error: REJECTION }
				}),
				step(3, { state: 'ACTIVE', step_type: 'agent_response', text_delta: 'DONE' }),
				step(3, { state: 'DONE', step_type: 'agent_response', text_delta: '\n' }),
				step(4, { state: 'ERROR', step_type: 'agent_response' })
			].join('\n')
		});
		// ⭑ Each step is read at its last update, in index order; a response that failed is not the model saying anything.
		expect(reading).toMatchObject({
			read: 'PARSED',
			events: [
				{ kind: 'ASSISTANT_MESSAGE' },
				{ kind: 'HOST_CALL', name: 'write_file', sent: false },
				{ kind: 'ASSISTANT_MESSAGE' }
			]
		});
		expect(reading.read === 'PARSED' ? reading.events : []).toHaveLength(3);
	});

	it('⭑ an empty stdout is no record at all, and P1b’s turn with the configured model reads PARSED with no surface', async () => {
		const driver = agyExecutorDriver();
		const run = runFolder();
		driver.invocation(turnInput(run));
		expect(await driver.readRecord({ run, turn: 1, exitCode: 0, stdout: '\n\n' })).toEqual({
			read: 'ABSENT'
		});
		const stdout = [
			line('init', { model: MODEL }),
			line('result', { status: 'SUCCESS', response: 'DONE\n' })
		].join('\n');
		expect(await driver.readRecord({ run, turn: 1, exitCode: 0, stdout })).toEqual({
			read: 'PARSED',
			raw: stdout,
			surface: undefined,
			events: [],
			reportedModels: [],
			answer: 'DONE\n'
		});
	});
});

describe('⛔ a record of a shape this driver does not know fails the reading closed (UNPARSEABLE)', () => {
	const cases: Record<string, string[]> = {
		'a line that is not JSON': ['{"event":"init"'],
		'a line that is not an event': ['{"type":"init","init":{}}'],
		'an event this driver does not know': [line('tool_call', { name: 'x' })],
		'an event without its payload': ['{"event":"init"}'],
		'a step of a type it does not know': [step(1, { state: 'DONE', step_type: 'checkpoint' })],
		'a step in a state it does not know': [
			step(1, { state: 'CANCELLED', step_type: 'tool', tool_name: 'x' })
		],
		'a step without its index': [line('step_update', { state: 'DONE', step_type: 'user_input' })],
		'a tool step without its tool': [step(1, { state: 'DONE', step_type: 'tool' })],
		'a second result': [
			line('result', { status: 'SUCCESS' }),
			line('result', { status: 'SUCCESS' })
		],
		'a result of another status': [line('result', { status: 'PARTIAL' })],
		'denied actions that are not a list': [
			line('result', { status: 'SUCCESS', denied_actions: 'run_command' })
		],
		'a denied action of another shape': [
			line('result', { status: 'SUCCESS', denied_actions: [{ id: 7 }] })
		]
	};
	for (const [name, lines] of Object.entries(cases))
		it(name, async () => {
			// ⛔ THE MUTANTS: one for the whole table, the reading's catch taking a record it cannot read for one that says
			// nothing; and one for each line that refuses, so no row rests on the table's mutant alone. ⭑ The unknown event
			// and the second result are refused by one line, and share its mutant.
			const driver = agyExecutorDriver();
			const run = runFolder();
			driver.invocation(turnInput(run));
			const stdout = lines.join('\n');
			expect(await driver.readRecord({ run, turn: 1, exitCode: 0, stdout })).toEqual({
				read: 'UNPARSEABLE',
				raw: stdout
			});
		});
});

describe('⛔ D42 — the run folder’s path reaches no record: agy’s init carries it as `cwd` (P1b), and the reading blanks it', () => {
	it('⛔ on a breach, the record kept beside it holds no form of the run folder’s path, whose Windows form holds the account’s name', async () => {
		// ⛔ THE MUTANT: the record kept as agy wrote it.
		const exec = playedAgy([{ acts: [{ own: 'write_to_file' }, { says: 'DONE' }] }]);
		const result = await turnOf(await open(exec));
		expect(messageOf(result)).toMatch(/^CLI_OWN_TOOL_RAN: /);
		const run = dirname(exec.requests[1]!.cwd);
		const kept = JSON.parse(result.sessionExport!) as { cliRecord: string };
		expect(
			kept.cliRecord,
			'arrangement: the init line, with its cwd, is in the record kept'
		).toMatch(/^\{"event":"init","init":\{"model":"gemini-4-argon-high","cwd":"/);
		for (const form of [run, run.replaceAll('\\', '/'), JSON.stringify(run).slice(1, -1)])
			expect(kept.cliRecord).not.toContain(form);
		expect(result.sessionExport).not.toContain(basename(run));
		expect(kept.cliRecord).toContain('"cwd":"<run folder>');
	});

	it('⛔ it is blanked in each form — as it is, with forward slashes, and JSON-escaped — in a record read and in one that is not', async () => {
		// ⛔ ONE MUTANT PER FORM. ⭑ A run folder whose path holds backslashes, so the three forms differ on any system; a form
		// as it is, single backslashes and all, cannot sit in a JSON line, so it is in the record that cannot be read.
		const driver = agyExecutorDriver();
		const run = runFolder('fixture-root\\jpwb-exec-agy-1-abcdef');
		driver.invocation(turnInput(run));
		const forms = [
			run.directory,
			run.directory.replaceAll('\\', '/'),
			JSON.stringify(run.directory).slice(1, -1)
		];
		const read = await driver.readRecord({
			run,
			turn: 1,
			exitCode: 0,
			stdout: [
				line('init', { model: MODEL, cwd: `${run.directory}\\cli` }),
				line('result', { status: 'SUCCESS', response: `wrote ${forms[1]}/host/x` })
			].join('\n')
		});
		const unread = await driver.readRecord({
			run,
			turn: 1,
			exitCode: 0,
			stdout: [line('init', { model: MODEL }), `a line naming ${run.directory}\\cli`].join('\n')
		});
		for (const reading of [read, unread])
			for (const form of forms)
				expect(reading.read === 'ABSENT' ? '' : reading.raw).not.toContain(form);
		expect(read).toMatchObject({
			read: 'PARSED',
			raw: [
				line('init', { model: MODEL, cwd: '<run folder>\\cli' }),
				line('result', { status: 'SUCCESS', response: 'wrote <run folder>/host/x' })
			].join('\n')
		});
		expect(unread).toEqual({
			read: 'UNPARSEABLE',
			raw: `${line('init', { model: MODEL })}\na line naming <run folder>\\cli`
		});
	});
});

// ── the model ────────────────────────────────────────────────────────────────────────────────────────────────────

describe('⭐ test 5 — the model: HOST_CONFIGURED, and any OTHER model agy names fails the turn (D22)', () => {
	/** The driver's reading of a turn on the configured model whose init and log are as given. */
	async function reading(log: readonly string[], initModel = MODEL): Promise<CliRecordReading> {
		const driver = agyExecutorDriver();
		const run = runFolder();
		mkdirSync(run.hostDirectory, { recursive: true });
		driver.invocation(turnInput(run));
		writeFileSync(join(run.hostDirectory, 'agy-1.log'), log.join('\n'), 'utf8');
		const stdout = [
			line('init', { model: initModel }),
			line('result', { status: 'SUCCESS', response: 'DONE' })
		].join('\n');
		return driver.readRecord({ run, turn: 1, exitCode: 0, stdout });
	}

	it('⭑ a turn whose init and log name only the configured model reports none: agy reports no model it was served (B9)', async () => {
		// ⛔ THE MUTANT: report the model agy resolved — which would grade the turn PROVIDER_REPORTED on what the HOST configured.
		expect(await reading(logLines())).toMatchObject({ read: 'PARSED', reportedModels: [] });
	});

	it('⛔ a resolution line naming another model is a substitution, named', async () => {
		// ⛔ THE MUTANT: ignore `model_resolver.go:107`.
		const log = [
			...logLines(),
			'I1018 15:21:38.000000     679 model_resolver.go:107] Resolving model gemini-3.8-flash-low'
		];
		expect(await reading(log)).toMatchObject({ reportedModels: ['gemini-3.8-flash-low'] });
	});

	it('⛔ test 5 — the alias line `model_resolver.go:155 … resolved to …` naming another model fails the turn, naming both', async () => {
		// ⛔ THE MUTANT: ignore the line.
		const log = [
			...logLines(),
			`I1018 15:21:38.000000       1 model_resolver.go:155] alias ${MODEL} resolved to "gemini-3.8-flash-high"`
		];
		expect(await reading(log)).toMatchObject({ reportedModels: ['gemini-3.8-flash-high'] });
		const result = await turnOf(await open(playedAgy([{ acts: [{ says: 'DONE' }], log: log }])));
		// ⚠ Through the opener the surface proof is asked first, and agy's record has none (B5), so the turn names that.
		expect(messageOf(result)).toMatch(/^CLI_SURFACE_UNPROVEN: /);
		expect(result.answer.arrived).toBe(false);
	});

	it('⛔ an alias line whose target cannot be read fails the reading closed', async () => {
		const log = [
			...logLines(),
			'I1018 15:21:38.000000       1 model_resolver.go:155] alias line of another form'
		];
		expect(await reading(log)).toMatchObject({ read: 'UNPARSEABLE' });
	});

	it('⛔ an init naming another model is a substitution, named', async () => {
		expect(await reading(logLines(), 'gemini-4-argon-low')).toMatchObject({
			reportedModels: ['gemini-4-argon-low']
		});
	});

	it('⭑ `resolver.go:85` and `resolver.go:111`, on every run, are not substitution (B9)', async () => {
		const log = [
			'I1018 15:21:36.196965       1 resolver.go:85] Model ID gemini-3.8-flash-low not in local config, defaulting to CCPA',
			'I1018 15:21:36.197974       1 resolver.go:111] Model resolved via default'
		];
		expect(await reading(log)).toMatchObject({ read: 'PARSED', reportedModels: [] });
	});

	it('⛔ B12 — the log holds the account’s address, and no byte of the log reaches the reading', async () => {
		// ⛔ THE MUTANT: the log kept as the record's `raw`, which the opener keeps beside a breach (D20).
		const read = await reading(logLines());
		expect(JSON.stringify(read)).not.toContain('mh5-fixture-account');
		expect(JSON.stringify(read)).not.toContain('server_oauth');
	});

	it('⭑ a turn with no log reads its record still, and reports no model', async () => {
		const driver = agyExecutorDriver();
		const run = runFolder(join(container, 'run-without-a-log'));
		driver.invocation(turnInput(run));
		const stdout = line('result', { status: 'SUCCESS', response: 'DONE' });
		expect(await driver.readRecord({ run, turn: 1, exitCode: 0, stdout })).toMatchObject({
			read: 'PARSED',
			reportedModels: []
		});
	});

	it('⛔ the reading compares with the model THIS turn was asked to run, and refuses a turn it did not start', async () => {
		const driver = agyExecutorDriver();
		const run = runFolder();
		mkdirSync(run.hostDirectory, { recursive: true });
		driver.invocation({ ...turnInput(run, 1), modelId: 'gemini-4-argon-low' });
		writeFileSync(
			join(run.hostDirectory, 'agy-1.log'),
			logLines('gemini-4-argon-low').join('\n'),
			'utf8'
		);
		const stdout = line('init', { model: 'gemini-4-argon-low' });
		expect(await driver.readRecord({ run, turn: 1, exitCode: 0, stdout })).toMatchObject({
			reportedModels: []
		});
		await expect(driver.readRecord({ run, turn: 2, exitCode: 0, stdout })).rejects.toThrow(
			'a turn it did not start'
		);
	});
});

// ── its errors ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('⭐ tests 6, 7 — agy’s errors: its AGY_ERROR line and its time-limit warning', () => {
	it('⛔ test 7 — an AGY_ERROR line gives its short_error as the excerpt, and nothing else of the line (P1a)', () => {
		// ⛔ THE MUTANT: the whole line as the excerpt.
		const signals = agyExecutorDriver().classifyStderr([`error: ${P1A_ERROR}`, P1A_AGY_ERROR_LINE]);
		expect(signals).toEqual({ errorExcerpt: P1A_ERROR });
	});

	it('⭑ an AGY_ERROR line that is not JSON, or has no short_error, gives no excerpt; nor does an `error:` line alone', () => {
		const driver = agyExecutorDriver();
		expect(driver.classifyStderr(['AGY_ERROR: {not json'])).toEqual({});
		expect(driver.classifyStderr(['AGY_ERROR: {"status":"UNKNOWN"}'])).toEqual({});
		expect(driver.classifyStderr([`error: ${P1A_ERROR}`])).toEqual({});
	});

	it('⛔ test 7, through the opener — P1a’s turn: exit 3, its result’s error the excerpt, unless the surface proof outranks it', async () => {
		// ⭑ P1a's record: an error step, and a result of status ERROR whose `error` is the same sentence as `short_error`.
		const driver = agyExecutorDriver();
		const run = runFolder();
		driver.invocation(turnInput(run));
		const stdout = [
			line('init', { model: MODEL }),
			step(0, { state: 'DONE', step_type: 'user_input' }),
			step(1, { state: 'DONE', step_type: 'error_message' }),
			line('result', { status: 'ERROR', response: '', error: P1A_ERROR, num_turns: 1 })
		].join('\n');
		expect(await driver.readRecord({ run, turn: 1, exitCode: 3, stdout })).toMatchObject({
			read: 'PARSED',
			answer: undefined,
			errorExcerpt: P1A_ERROR,
			events: []
		});
		const result = await turnOf(
			await open(
				playedAgy([
					{
						result: { status: 'ERROR', response: '', error: P1A_ERROR, num_turns: 1 },
						exitCode: 3,
						errorLines: [`error: ${P1A_ERROR}`, P1A_AGY_ERROR_LINE]
					}
				])
			)
		);
		expect(result.answer.arrived).toBe(false);
		expect(messageOf(result)).toMatch(/^CLI_SURFACE_UNPROVEN: /);
	});

	it('⛔ test 6 — agy’s time-limit warning is its own timeout, whatever it exited with', () => {
		// ⛔ THE MUTANT: never read the warning, so a partial answer agy returned at its own limit, exiting 0, would stand.
		const driver = agyExecutorDriver();
		expect(
			driver.classifyStderr([
				'warning: print timeout of 3m0s reached; returning the partial response'
			])
		).toEqual({
			timedOut: true
		});
		expect(driver.classifyStderr(['warning: the turn timed out'])).toEqual({ timedOut: true });
		// ⭑ CONTROL — the one agy warning MH-0b saw (B17) is not a timeout.
		expect(
			driver.classifyStderr(['warning: ignoring unsupported stream input message event "bogus"'])
		).toEqual({});
	});
});
