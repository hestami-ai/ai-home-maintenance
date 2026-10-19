// ⭐⭐ `JAN-MHX` MH-1 — the victim for THE CLI EXECUTOR SESSION (`DESIGN-multi-harness-executor.md` D12–D24, D40–D44a;
// roadmap C1–C28).
//
// ⭑ A FAKE DRIVER AND A `CliExec` SEAM THAT ACTS AS THE CLI: it reads the MCP entry the driver wrote into `cli/`, reads the
// endpoint file that entry names, and calls the REAL host tool server with the turn's token, as a CLI's bridge would; then
// it writes the record the fake driver reads back. Two cases start real processes instead (C4's command, C7's tree), each
// by this runtime's own executable. No model is called anywhere here.
// ⚠ Every directory is under `os.tmpdir()`, never under the repository.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import type { ProcessRunOutcome, ProcessRunRequest, ProcessRunner } from '@janumipwb/rph-ports';
import { createChildProcessRunner } from '../execution/child-process-runner.js';
import { EXECUTION_CONTRACT_PROMPT } from '../execution/execution-contract.js';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import type { ProducerSession, ProducerSessionContext } from '../execution/producer-session.js';
import { readWorkspaceTaint } from '../execution/workspace-taint.js';
import type { ToolInvocationResult } from './backing-tool.js';
import {
	ancestorConfiguration,
	EXECUTOR_HOST_TOOLS_PREAMBLE,
	EXECUTOR_RESEND_HISTORY_CHARS,
	openCliExecutionSession,
	type CliDriver,
	type CliExec,
	type CliExecRequest,
	type CliRecordEvent,
	type CliRun,
	type CliToolRef
} from './cli-executor-session.js';
import { GATE_REFUSED_STATUS } from './host-tool-server.js';
import { governedToolCallReport } from './observed-tool-calls.js';

let container = '';
let workspaceDir = '';
let root = '';
const sessions: ProducerSession[] = [];

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-cli-session-'));
	workspaceDir = join(container, 'workspace');
	root = join(container, 'root');
	mkdirSync(workspaceDir);
});
afterEach(async () => {
	vi.unstubAllEnvs();
	for (const s of sessions.splice(0)) s.dispose();
	await new Promise((r) => setTimeout(r, 400));
	await rm(container, { recursive: true, force: true, maxRetries: 5 });
});

const SELECTION = { kind: 'CLI', toolId: 'fake', modelId: 'fake-model-1' } as const;
const DEFAULT_SURFACE: CliToolRef[] = [
	{ party: 'OWN', name: 'mcp_call' },
	{ party: 'HOST', name: 'write_file' },
	{ party: 'HOST', name: 'run_command' }
];

/** The tool-surface tests' stub runner; `during` runs while a command is "running". */
function stubRunner(during?: (r: ProcessRunRequest) => void): ProcessRunner & { seen: ProcessRunRequest[] } {
	const seen: ProcessRunRequest[] = [];
	return {
		kind: 'REAL',
		seen,
		run: async (r): Promise<ProcessRunOutcome> => {
			seen.push(r);
			during?.(r);
			return {
				ran: true,
				exitCode: 0,
				timedOut: false,
				stdout: 'ok\n',
				stderr: '',
				omittedRegions: [],
				outputComplete: true,
				retention: { retained: false, notRetainedBecause: 'stub runner retains nothing' },
				durationMs: 1
			};
		}
	};
}

function context(runner: ProcessRunner = stubRunner()): ProducerSessionContext {
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

/** The fake CLI's record of its turn, as the fake driver reads it back. */
interface FakeRecord {
	surface: CliToolRef[] | undefined;
	events: CliRecordEvent[];
	reportedModels: string[];
	answer?: string;
	volunteeredReasoning?: string;
}

/** A POST to the host's server, as a bridge sends one. */
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

/** The CLI, as the seam plays it: it finds the host through the files the driver wrote, as a real CLI would. */
class FakeCli {
	readonly endpointPath: string;
	readonly endpoint: { url: string; token: string };
	readonly turn: number;
	record: FakeRecord = { surface: [...DEFAULT_SURFACE], events: [], reportedModels: [] };
	writeRaw: string | undefined | null = undefined;
	exitsNever = false;
	constructor(readonly request: CliExecRequest) {
		const entry = JSON.parse(readFileSync(join(request.cwd, 'fake-mcp.json'), 'utf8')) as { args: string[] };
		this.endpointPath = entry.args[1]!;
		this.endpoint = JSON.parse(readFileSync(this.endpointPath, 'utf8')) as { url: string; token: string };
		this.turn = Number(request.args[request.args.indexOf('--turn') + 1]);
	}
	get hostDirectory(): string {
		return dirname(this.endpointPath);
	}
	get runDirectory(): string {
		return dirname(this.hostDirectory);
	}
	get port(): number {
		return Number(new URL(this.endpoint.url).port);
	}
	async call(name: string, args: unknown, token = this.endpoint.token) {
		const answered = await rpc(this.endpoint.url, token, {
			jsonrpc: '2.0',
			id: this.record.events.length + 1,
			method: 'tools/call',
			params: { name, arguments: args }
		});
		this.record.events.push({ kind: 'HOST_CALL', name, sent: true });
		return answered;
	}
	own(name: string, ran: boolean): void {
		this.record.events.push({ kind: 'OWN_TOOL', name, ran });
	}
	rejected(name: string): void {
		this.record.events.push({ kind: 'HOST_CALL', name, sent: false });
	}
	answer(text: string): void {
		this.record.events.push({ kind: 'ASSISTANT_MESSAGE' });
		this.record.answer = text;
	}
	prompt(): string {
		return readFileSync(this.request.args[this.request.args.indexOf('--prompt-file') + 1]!, 'utf8');
	}
	writeRecord(): void {
		if (this.writeRaw === null) return;
		writeFileSync(join(this.hostDirectory, `record-${this.turn}.json`), this.writeRaw ?? JSON.stringify(this.record), 'utf8');
	}
}

type Script = (cli: FakeCli) => Promise<Partial<CliRun> | void>;

/** The `CliExec` seam playing the CLI. `killed` counts the opener's kills. */
function fakeExec(script: Script): CliExec & { requests: CliExecRequest[]; clis: FakeCli[]; killed: () => number } {
	const requests: CliExecRequest[] = [];
	const clis: FakeCli[] = [];
	let killed = 0;
	const exec: CliExec = (req) => {
		requests.push(req);
		const cli = new FakeCli(req);
		clis.push(cli);
		let release: (run: CliRun) => void = () => undefined;
		const done = new Promise<CliRun>((resolve, reject) => {
			release = resolve;
			script(cli).then((over) => {
				if (cli.exitsNever) return;
				cli.writeRecord();
				resolve({ exitCode: 0, stdout: '', stdoutComplete: true, errorLines: [], ...over });
			}, reject);
		});
		return {
			done,
			// ⚠ THE CLI IS GONE A LITTLE AFTER THE KILL, AS A REAL TREE KILL IS: `taskkill` takes time. A kill that ended the
			// fake at once let the turn close the gate before a call sent right after `dispose()` arrived, so C23 could not
			// see who closed it (found by its mutant, MH1-M82).
			kill: async () => {
				killed += 1;
				await new Promise((r) => setTimeout(r, 200));
				release({ exitCode: null, stdout: '', stdoutComplete: true, errorLines: [] });
			}
		};
	};
	return Object.assign(exec, { requests, clis, killed: () => killed });
}

/** The fake driver: the run folder's MCP entry, its argv, and its record read back. */
function fakeDriver(over: Partial<CliDriver> = {}): CliDriver {
	return {
		toolId: 'fake',
		carriers: ['mcp_call'],
		configSources: [],
		environment: { FAKE_CLI_CONSTANT: 'on' },
		runFolderFiles: (run) => [
			{ path: 'cli/fake-mcp.json', bytes: JSON.stringify({ command: run.nodePath, args: [run.bridgePath, run.endpointPath] }) }
		],
		preflight: () => undefined,
		invocation: (turn) => ({
			program: 'fake-cli',
			args: ['--turn', String(turn.turn), '--prompt-file', turn.promptPath, '--model', turn.modelId]
		}),
		readRecord: async (out) => {
			const path = join(out.run.hostDirectory, `record-${out.turn}.json`);
			if (!existsSync(path)) return { read: 'ABSENT' };
			const raw = readFileSync(path, 'utf8');
			try {
				return { read: 'PARSED', raw, answer: undefined, ...(JSON.parse(raw) as FakeRecord) };
			} catch {
				return { read: 'UNPARSEABLE', raw };
			}
		},
		classifyStderr: (lines) => {
			const error = lines.find((l) => l.startsWith('FAKE-ERROR: '));
			return {
				...(lines.includes('FAKE-REJECTED') ? { rejectedACall: true } : {}),
				...(lines.includes('FAKE-TIMED-OUT') ? { timedOut: true } : {}),
				...(error === undefined ? {} : { errorExcerpt: error.slice('FAKE-ERROR: '.length) })
			};
		},
		...over
	};
}

async function open(
	exec: CliExec,
	options: {
		driver?: CliDriver;
		ctx?: ProducerSessionContext;
		root?: string;
		turnTimeoutMs?: number;
		preflightTimeoutMs?: number;
	} = {}
): Promise<ProducerSession> {
	const session = await openCliExecutionSession(options.ctx ?? context(), SELECTION, options.driver ?? fakeDriver(), {
		exec,
		root: options.root ?? root,
		turnTimeoutMs: options.turnTimeoutMs ?? 60_000,
		...(options.preflightTimeoutMs === undefined ? {} : { preflightTimeoutMs: options.preflightTimeoutMs }),
		now: () => '2026-10-18T10:00:00Z'
	});
	sessions.push(session);
	return session;
}

const turn = async (session: ProducerSession, text = 'INSTRUCTION'): Promise<ToolInvocationResult> =>
	(await session.turn(text)) as ToolInvocationResult;

const passing: Script = async (cli) => {
	await cli.call('write_file', { path: 'a.txt', contents: 'hello' });
	cli.answer('{"workProduct":"done","rationale":{}}');
};

const messageOf = (r: ToolInvocationResult): string => (r.answer.arrived ? '' : 'message' in r.answer ? (r.answer.message ?? '') : '');

describe('⭐ D13, D41, D43 — where the CLI runs, and what it is given', () => {
	it('C1 — the CLI starts in the run’s cli/ folder: not the workspace, not the server’s folder', async () => {
		// ⛔ THE MUTANT: cwd = the workspace, the folder the executor writes into (`REG-F-548`'s shape).
		const exec = fakeExec(passing);
		await turn(await open(exec));
		const cwd = exec.requests[0]!.cwd;
		expect(basename(cwd)).toBe('cli');
		expect(dirname(dirname(cwd))).toBe(root);
		expect(cwd).not.toBe(workspaceDir);
		expect(cwd).not.toBe(process.cwd());
	});

	it('C2 — the endpoint file is in host/, not under the CLI’s working folder, and no file under cli/ holds the token', async () => {
		// ⛔ THE MUTANT: write it into cli/, where a CLI that reads its working folder would find the token.
		const exec = fakeExec(passing);
		await turn(await open(exec));
		const cli = exec.clis[0]!;
		expect(dirname(cli.endpointPath)).toBe(join(cli.runDirectory, 'host'));
		expect(cli.endpointPath.startsWith(cli.request.cwd)).toBe(false);
		const underCli = readdirSync(cli.request.cwd, { recursive: true }).map(String);
		for (const file of underCli)
			if (statSync(join(cli.request.cwd, file)).isFile())
				expect(readFileSync(join(cli.request.cwd, file), 'utf8'), file).not.toContain(cli.endpoint.token);
	});

	it('C3 — a key and a planted variable in the server’s environment reach the CLI neither; the driver’s constants do', async () => {
		// ⛔ THE MUTANT: pass `process.env`, so a provider key in the server's environment would change account and billing.
		vi.stubEnv('OPENAI_API_KEY', 'sk-planted-mh1');
		vi.stubEnv('JPWB_PLANTED', 'planted-mh1');
		const exec = fakeExec(passing);
		await turn(await open(exec));
		const env = exec.requests[0]!.env;
		expect(env.OPENAI_API_KEY).toBeUndefined();
		expect(env.JPWB_PLANTED).toBeUndefined();
		expect(env.FAKE_CLI_CONSTANT).toBe('on');
		expect(Object.keys(env).some((k) => k.toUpperCase() === 'PATH'), 'the allowlist itself reached the CLI').toBe(true);
	});

	it('C4 — a driver’s declared secret reaches the CLI’s environment, no command the model runs, and nothing the result holds', async () => {
		// ⛔ THE MUTANT: add it to the shared allowlist, which also serves every command the model runs.
		const SECRET = 'the-fake-cli-secret-value-4c1e';
		vi.stubEnv('JPWB_FAKE_CLI_SECRET', SECRET);
		const outDir = join(container, 'process-output');
		mkdirSync(outDir);
		const ws = createFilesystemWorkspace({
			ownerKind: 'UNDERTAKING',
			ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
			purgeability: 'RETAINED_BY_PARTICIPATION',
			directoryPath: workspaceDir
		});
		const runner = createChildProcessRunner({
			deliverableWorkspace: ws,
			outputWorkspace: createFilesystemWorkspace({
				ownerKind: 'UNDERTAKING',
				ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
				purgeability: 'PURGEABLE_AT_EXPIRY',
				directoryPath: outDir
			})
		});
		let commandSaw = '';
		const exec = fakeExec(async (cli) => {
			const ran = await cli.call('run_command', {
				argv: [process.execPath, '-e', "process.stdout.write('secret=' + String(process.env.JPWB_FAKE_CLI_SECRET))"]
			});
			commandSaw = ran.body.result.content[0].text;
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const result = await turn(
			await open(exec, {
				driver: fakeDriver({ secretVariable: 'JPWB_FAKE_CLI_SECRET' }),
				ctx: { ...context(), workspace: ws, runner }
			})
		);
		expect(exec.requests[0]!.env.JPWB_FAKE_CLI_SECRET).toBe(SECRET);
		expect(commandSaw).toContain('secret=undefined');
		expect(JSON.stringify(result)).not.toContain(SECRET);
	});

	it('C5 — no turn’s token is in any argv element, environment variable, field of the result, or failure message', async () => {
		// ⛔ THE MUTANT: hand the token to the CLI as `JPWB_MCP_TOKEN`.
		const exec = fakeExec(async (cli) => {
			await cli.call('write_file', { path: 'a.txt', contents: 'x' });
			if (cli.turn === 1) {
				cli.answer('{"workProduct":"done","rationale":{}}');
				return;
			}
			return { exitCode: 2, errorLines: [`FAKE-ERROR: token ${cli.endpoint.token} rejected`] };
		});
		const session = await open(exec);
		const results = [await turn(session), await turn(session, 'FINDINGS')];
		expect(results[1]!.answer.arrived, 'arrangement: the second turn failed').toBe(false);
		exec.clis.forEach((cli, i) => {
			const token = cli.endpoint.token;
			expect(token).toMatch(/^[0-9a-f]{64}$/);
			expect(cli.request.args.some((a) => a.includes(token)), 'argv').toBe(false);
			expect(Object.values(cli.request.env).some((v) => v.includes(token)), 'environment').toBe(false);
			expect(JSON.stringify(results[i]), 'result').not.toContain(token);
			expect(messageOf(results[i]!), 'failure message').not.toContain(token);
		});
		expect(exec.clis[0]!.endpoint.token).not.toBe(exec.clis[1]!.endpoint.token);
	});
});

describe('⭐ D2, D8, D18 — the turn’s bounds, and what survives a turn', () => {
	it('C6 — a CLI that never exits is killed at the bound, the turn is CALL_ABORTED, and a call after it is refused', async () => {
		// ⛔ THE MUTANT: no kill.
		const exec = fakeExec(async (cli) => {
			await cli.call('write_file', { path: 'a.txt', contents: 'x' });
			cli.exitsNever = true;
		});
		const result = await turn(await open(exec, { turnTimeoutMs: 300 }));
		expect(result.answer).toEqual({
			arrived: false,
			cause: 'CALL_ABORTED',
			message: "The CLI outlasted the host's bound of 300 ms on one turn, and its process tree was killed."
		});
		expect(exec.killed()).toBe(1);
		const cli = exec.clis[0]!;
		expect((await rpc(cli.endpoint.url, cli.endpoint.token, { jsonrpc: '2.0', id: 9, method: 'ping' })).status).toBe(
			GATE_REFUSED_STATUS
		);
	});

	it('C7 — a CLI that starts a grandchild and stays alive: at the bound, both are gone', async () => {
		// ⛔ THE MUTANT: `child.kill()` alone. The predicted red is the grandchild still alive (D18).
		// ⚠ THE GRANDCHILD BREAKS AWAY FROM ITS PARENT'S JOB ON WINDOWS, AS A CLI'S OWN CHILD DOES. This fake CLI runs on node,
		// and libuv puts every child a node process spawns in a job that is killed when that process dies — so with a plain
		// spawn the grandchild died with its parent and `child.kill()` alone passed (MH1-M41 SURVIVED). devin, agy and Codex
		// are not node, and their children outlive them. `detached` breaks away from the job; the grandchild keeps its parent
		// id, which is what `taskkill /T` walks. On POSIX it stays in the CLI's process group, which is what is killed there.
		const script = join(container, 'fake-cli.cjs');
		const pids = join(container, 'pids.json');
		writeFileSync(
			script,
			[
				"const { spawn } = require('node:child_process');",
				"const { writeFileSync } = require('node:fs');",
				"const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', detached: process.platform === 'win32' });",
				'writeFileSync(process.argv[2], JSON.stringify({ parent: process.pid, grandchild: grandchild.pid }));',
				'setInterval(() => {}, 1000);'
			].join('\n'),
			'utf8'
		);
		const driver = fakeDriver({ invocation: () => ({ program: process.execPath, args: [script, pids] }) });
		const alive = (pid: number): boolean => {
			try {
				process.kill(pid, 0);
				return true;
			} catch {
				return false;
			}
		};
		const session = await openCliExecutionSession(context(), SELECTION, driver, { root, turnTimeoutMs: 3_000 });
		sessions.push(session);
		let tree: { parent: number; grandchild: number } | undefined;
		try {
			const result = await turn(session);
			expect(result.answer.arrived).toBe(false);
			tree = JSON.parse(readFileSync(pids, 'utf8')) as { parent: number; grandchild: number };
			for (let i = 0; i < 40 && (alive(tree.parent) || alive(tree.grandchild)); i++)
				await new Promise((r) => setTimeout(r, 100));
			expect(alive(tree.parent), 'the CLI survived the bound').toBe(false);
			expect(alive(tree.grandchild), 'the CLI’s grandchild survived the bound').toBe(false);
		} finally {
			// ⚠ BOTH, whatever the outcome: under a mutant that never kills, a live CLI holding its folder would leave this
			// file's cleanup waiting on it (found by MH1-M40, whose verdict was INCONCLUSIVE for that reason).
			tree ??= existsSync(pids) ? (JSON.parse(readFileSync(pids, 'utf8')) as { parent: number; grandchild: number }) : undefined;
			for (const pid of tree === undefined ? [] : [tree.parent, tree.grandchild]) if (alive(pid)) process.kill(pid);
		}
	});

	it('C8 — a descendant that outlived its CLI, calling with the old token during the next turn, is refused and not observed', async () => {
		// ⛔ THE MUTANT: one token per session. The orphan's write would run in turn 2 and be recorded as turn 2's.
		let oldToken = '';
		let orphanStatus = 0;
		const exec = fakeExec(async (cli) => {
			if (cli.turn === 1) {
				oldToken = cli.endpoint.token;
				await cli.call('write_file', { path: 'a.txt', contents: 'x' });
				cli.answer('{"workProduct":"done","rationale":{}}');
				return;
			}
			const orphan = await rpc(cli.endpoint.url, oldToken, {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				params: { name: 'write_file', arguments: { path: 'orphan.txt', contents: 'x' } }
			});
			orphanStatus = orphan.status;
			cli.answer('{"workProduct":"again","rationale":{}}');
		});
		const session = await open(exec);
		await turn(session);
		const second = await turn(session, 'FINDINGS');
		expect(orphanStatus).toBe(GATE_REFUSED_STATUS);
		expect(second.observedToolCalls).toEqual({ canObserve: true, mintedToolNames: ['write_file', 'run_command'], calls: [] });
		expect(existsSync(join(workspaceDir, 'orphan.txt'))).toBe(false);
	});
});

/**
 * ⭐ D15 — the preamble's bytes, pinned here, by literal, as `DEVIN_REVIEWER_PREAMBLE`'s are in `devin-reviewer.test.ts`.
 * ⚠ Written out rather than read from the constant: C9 finds the preamble by reference, so without this pin any text
 * would pass every case.
 */
const PINNED_PREAMBLE =
	'You work through the tools of one MCP server, named jpwb, and through nothing else.\n' +
	'Its tools are your only tools: at most write_file, which writes a file in this work unit’s workspace, and ' +
	'run_command, which runs a command there. The server lists the ones this step was granted.\n' +
	'The workspace is reached only through those tools. No other tool will work, and you must not try one: a file ' +
	'written or a command run any other way fails this turn.\n' +
	'Do not create files the instruction does not ask for, such as AGENTS.md.';

describe('⭐ D15 — the preamble', () => {
	it('D15 — the preamble is the pinned bytes, byte for byte, its line breaks included', () => {
		// ⛔ THE MUTANT: one character of it changed — a change to what every CLI executor is told, unseen by any other case.
		expect(Buffer.byteLength(PINNED_PREAMBLE, 'utf8'), 'arrangement: the pinned preamble is 519 bytes').toBe(519);
		expect(EXECUTOR_HOST_TOOLS_PREAMBLE).toBe(PINNED_PREAMBLE);
	});
});

describe('⭐ D16, D17 — repairs re-send, and E-1 is the host’s envelope', () => {
	const INSTR = 'INSTRUCTION-MARK: produce the work product the instruction describes, in full.';
	const F1 = 'FINDINGS-1-MARK: the review found the first answer incomplete.';
	const F2 = 'FINDINGS-2-MARK: the review found the second answer incomplete.';

	it('C9 — try 3’s prompt holds the preamble, the contract, the instruction, A1, F1, A2, F2 and the turn, in order, and E-1’s prompt is it', async () => {
		// ⛔ THE MUTANTS: carry only the last pair; send the turn alone (`oneShotSession`'s shape).
		let sent = '';
		const exec = fakeExec(async (cli) => {
			if (cli.turn === 3) sent = cli.prompt();
			cli.answer(`ANSWER-${cli.turn}-MARK`);
		});
		const session = await open(exec);
		await turn(session, INSTR);
		await turn(session, F1);
		const third = await turn(session, F2);
		const at = (s: string) => sent.indexOf(s);
		const order = [
			EXECUTOR_HOST_TOOLS_PREAMBLE,
			EXECUTION_CONTRACT_PROMPT,
			INSTR,
			'ANSWER-1-MARK',
			F1,
			'ANSWER-2-MARK',
			F2
		].map(at);
		expect(order.every((i) => i >= 0), `every part is in the prompt: ${order.join(', ')}`).toBe(true);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
		expect(sent.endsWith(F2), 'the prompt ends with the turn run-model-step sent').toBe(true);
		expect((JSON.parse(third.materializedInput!) as { prompt: string }).prompt).toBe(sent);
	});

	it('C10 — past the history bound the oldest try is left out WHOLE, and the prompt says how many were left out', async () => {
		// ⛔ THE MUTANT: cut mid-pair.
		const big = (mark: string, fill: string) => `${mark}${fill.repeat(70_000)}`;
		let sent = '';
		const exec = fakeExec(async (cli) => {
			if (cli.turn === 3) sent = cli.prompt();
			cli.answer(cli.turn === 1 ? big('A1-MARK', 'x') : big('A2-MARK', 'y'));
		});
		expect(70_000 * 2, 'arrangement: two answers exceed the bound').toBeGreaterThan(EXECUTOR_RESEND_HISTORY_CHARS);
		const session = await open(exec);
		await turn(session, INSTR);
		await turn(session, F1);
		await turn(session, F2);
		expect(sent).not.toContain('A1-MARK');
		expect(sent).not.toContain('x'.repeat(100));
		expect(sent).toContain(big('A2-MARK', 'y'));
		expect(sent).toContain('1 earlier try is left out here, to keep this prompt within its bound; the record holds it.');
	});

	it('C11 — E-1 is the envelope: the prompt, the tools as served, and the calls with their results', async () => {
		// ⛔ THE MUTANT: E-1 = the prompt alone, which drops every argument and result the model saw.
		const exec = fakeExec(passing);
		const result = await turn(await open(exec), INSTR);
		const e1 = JSON.parse(result.materializedInput!) as {
			e1: string;
			prompt: string;
			tools: { name: string }[];
			calls: { name: string; arguments: unknown; result: string | null; isError: boolean }[];
		};
		expect(e1.e1).toBe('HOST_TO_CLI');
		expect(e1.prompt).toBe(exec.clis[0]!.prompt());
		expect(e1.tools.map((t) => t.name)).toEqual(['write_file', 'run_command']);
		expect(e1.calls).toEqual([
			{ name: 'write_file', arguments: { path: 'a.txt', contents: 'hello' }, result: expect.stringContaining('Wrote 5 UTF-8 bytes to a.txt.'), isError: false }
		]);
	});
});

describe('⭐ D14a, D19, D21 — what the CLI’s own record must prove', () => {
	it('C12 — a tool of the CLI’s own that RAN fails the turn; it sits among the host calls in the record’s order, NOT_MINTED, and the workspace is tainted', async () => {
		// ⛔ THE MUTANTS: ignore the driver's own calls; append them after the host's.
		const exec = fakeExec(async (cli) => {
			await cli.call('write_file', { path: 'a.txt', contents: 'x' });
			cli.own('mcp_call', true);
			cli.own('shell', true);
			await cli.call('run_command', { argv: ['node', '--version'] });
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const result = await turn(await open(exec));
		expect(result.answer.arrived).toBe(false);
		expect(result.answer.arrived === false && result.answer.cause === 'CALL_FAILED' && result.answer.reportedBy).toBe('TOOL');
		expect(messageOf(result).startsWith('CLI_OWN_TOOL_RAN: ')).toBe(true);
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'cli:shell', outcome: 'UNKNOWN' },
				{ name: 'run_command', outcome: 'COMPLETED' }
			]
		});
		const report = governedToolCallReport(result.observedToolCalls);
		expect(report.observation === 'OBSERVED' && report.calls?.map((c) => c.nameProvenance)).toEqual([
			'MINTED_BY_HOST',
			'NOT_MINTED',
			'MINTED_BY_HOST'
		]);
		expect(readWorkspaceTaint(workspaceDir)).toEqual({
			tainted: true,
			entries: [{ code: 'CLI_OWN_TOOL_RAN', toolId: 'fake', turn: 1, at: '2026-10-18T10:00:00Z' }]
		});
	});

	it('C12 — a surface that OFFERS a tool of the CLI’s own beside its carriers is a breach too, though nothing shows it ran', async () => {
		// ⛔ THE MUTANT: fail only on a tool the record shows running. The vendor's record can hide a step (D20).
		const exec = fakeExec(async (cli) => {
			cli.record.surface = [...DEFAULT_SURFACE, { party: 'OWN', name: 'shell' }];
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const result = await turn(await open(exec));
		expect(messageOf(result).startsWith('CLI_OWN_TOOL_RAN: ')).toBe(true);
		expect(readWorkspaceTaint(workspaceDir).tainted).toBe(true);
	});

	it('C13 — a record whose host calls differ from the host’s, in order or by name, fails the turn CLI_SURFACE_UNPROVEN', async () => {
		// ⛔ THE MUTANT: skip the cross-check, and place the CLI's own calls by a record that disagrees with the host.
		const reordered = fakeExec(async (cli) => {
			await cli.call('write_file', { path: 'a.txt', contents: 'x' });
			await cli.call('run_command', { argv: ['node', '--version'] });
			cli.record.events = [
				{ kind: 'HOST_CALL', name: 'run_command', sent: true },
				{ kind: 'HOST_CALL', name: 'write_file', sent: true }
			];
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const omitted = fakeExec(async (cli) => {
			await cli.call('write_file', { path: 'a.txt', contents: 'x' });
			cli.record.events = [];
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		for (const exec of [reordered, omitted])
			expect(messageOf(await turn(await open(exec))).startsWith('CLI_SURFACE_UNPROVEN: ')).toBe(true);
	});

	it('C14 — a refusal with no assistant message after it fails the turn; a refusal followed by an answer is REFUSED and the answer stands', async () => {
		// ⛔ THE MUTANT: always record the refusal and go on (the first draft's D21).
		const stopped = fakeExec(async (cli) => {
			cli.answer('I will now ');
			cli.own('edit', false);
		});
		expect(messageOf(await turn(await open(stopped))).startsWith('CLI_ENDED_ON_REFUSAL: ')).toBe(true);
		const went = fakeExec(async (cli) => {
			cli.own('edit', false);
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const result = await turn(await open(went));
		expect(result.answer).toEqual({ arrived: true, text: '{"workProduct":"done","rationale":{}}' });
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [{ name: 'cli:edit', outcome: 'REFUSED' }]
		});
	});

	it('C14 — a CARRIER the CLI refused is a refused attempt too: with no assistant message after it, the turn fails', async () => {
		// ⛔ THE MUTANT: pass over a carrier whether it ran or was refused. devin's print mode ends the session when its
		// carrier `mcp_call_tool` is rejected for want of approval (`REG-F-549`), so a refused carrier is the shape such a
		// record shows, and with no stderr line only the record says the CLI stopped there.
		const exec = fakeExec(async (cli) => {
			cli.answer('I will now write the file');
			cli.own('mcp_call', false);
		});
		const result = await turn(await open(exec));
		expect(messageOf(result)).toMatch(/^CLI_ENDED_ON_REFUSAL: /);
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [{ name: 'cli:mcp_call', outcome: 'REFUSED' }]
		});
	});

	it('C14 — the CLI’s own rejection line on stderr fails the turn, whatever it exited with', async () => {
		// ⛔ THE MUTANT: read only the record's refusals. devin's print mode says it on stderr (D19, REG-F-549).
		const exec = fakeExec(async (cli) => {
			cli.answer('partial');
			return { errorLines: ['FAKE-REJECTED'] };
		});
		expect(messageOf(await turn(await open(exec))).startsWith('CLI_ENDED_ON_REFUSAL: ')).toBe(true);
	});

	it('C15 — a call the CLI rejected before sending it is in the observation as REFUSED', async () => {
		// ⛔ THE MUTANT: drop it. The attempt would vanish, which it does not for Pi (§1.14).
		const exec = fakeExec(async (cli) => {
			cli.rejected('delete_file');
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const result = await turn(await open(exec));
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [{ name: 'delete_file', outcome: 'REFUSED' }]
		});
		const report = governedToolCallReport(result.observedToolCalls);
		expect(report.observation === 'OBSERVED' && report.calls).toEqual([
			{ ordinal: 1, nameProvenance: 'NOT_MINTED', outcome: 'REFUSED' }
		]);
	});

	it.each([
		['absent', (cli: FakeCli) => (cli.writeRaw = null)],
		['unparseable', (cli: FakeCli) => (cli.writeRaw = 'not json')],
		['without the surface proof', (cli: FakeCli) => (cli.record.surface = undefined)],
		['naming a host tool the host did not serve', (cli: FakeCli) => (cli.record.surface = [{ party: 'HOST', name: 'delete_file' }])]
	])('C16 — a record that is %s fails the turn CLI_SURFACE_UNPROVEN', async (_, spoil) => {
		// ⛔ ONE MUTANT PER ARM: each arm let through.
		const exec = fakeExec(async (cli) => {
			cli.answer('{"workProduct":"done","rationale":{}}');
			spoil(cli);
		});
		const result = await turn(await open(exec));
		expect(messageOf(result).startsWith('CLI_SURFACE_UNPROVEN: ')).toBe(true);
	});
});

describe('⭐ D14b — the workspace may change only inside the host’s calls', () => {
	it('C17 — a host write_file, and a command writing during its call, explain their changes', async () => {
		// ⛔ THE MUTANT: a manifest only at the turn's ends, which fails the command arm.
		const runner = stubRunner(() => writeFileSync(join(workspaceDir, 'built.txt'), 'by the command', 'utf8'));
		const exec = fakeExec(async (cli) => {
			await cli.call('write_file', { path: 'a.txt', contents: 'x' });
			await cli.call('run_command', { argv: ['node', 'build'] });
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const result = await turn(await open(exec, { ctx: context(runner) }));
		expect(result.answer.arrived, messageOf(result)).toBe(true);
		expect(readWorkspaceTaint(workspaceDir)).toEqual({ tainted: false });
	});

	it.each([
		['between two host calls', 'between'],
		['before the first host call', 'before'],
		['after the last host call', 'after']
	])('C17 — a file changed in the workspace %s fails the turn CLI_UNEXPLAINED_CHANGE, and taints it', async (_, when) => {
		// ⛔ THE MUTANT: no manifest.
		const exec = fakeExec(async (cli) => {
			const sneak = () => writeFileSync(join(workspaceDir, 'sneaked.txt'), 'by the CLI', 'utf8');
			if (when === 'before') sneak();
			await cli.call('write_file', { path: 'a.txt', contents: 'x' });
			if (when === 'between') sneak();
			await cli.call('write_file', { path: 'b.txt', contents: 'y' });
			if (when === 'after') sneak();
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const result = await turn(await open(exec));
		expect(messageOf(result).startsWith('CLI_UNEXPLAINED_CHANGE: ')).toBe(true);
		expect(readWorkspaceTaint(workspaceDir)).toEqual({
			tainted: true,
			entries: [{ code: 'CLI_UNEXPLAINED_CHANGE', toolId: 'fake', turn: 1, at: '2026-10-18T10:00:00Z' }]
		});
		expect(JSON.parse(result.sessionExport!)).toEqual(
			expect.objectContaining({ breach: 'CLI_UNEXPLAINED_CHANGE', unexplainedChanges: ['sneaked.txt'] })
		);
	});
});

describe('⭐ D21a, D14a, D24 — a driver that throws reading what its CLI left fails the turn closed', () => {
	const enoent = (): NodeJS.ErrnoException =>
		Object.assign(new Error('the fake driver found no export'), { code: 'ENOENT' });
	const throwingRecord = (): CliDriver =>
		fakeDriver({
			readRecord: async () => {
				throw enoent();
			}
		});
	/** The CLI writes into the workspace itself, outside any host call, and exits 0. */
	const ownWrite: Script = async (cli) => {
		writeFileSync(join(workspaceDir, 'own-write.txt'), 'by the CLI', 'utf8');
		cli.answer('I will now write the file');
	};
	const TAINTED_BY_THE_CHANGE = {
		tainted: true,
		entries: [{ code: 'CLI_UNEXPLAINED_CHANGE', toolId: 'fake', turn: 1, at: '2026-10-18T10:00:00Z' }]
	};

	it('C17 — the CLI’s own write fails the turn CLI_UNEXPLAINED_CHANGE and taints the workspace, though readRecord throws ENOENT', async () => {
		// ⛔ THE MUTANT: the driver's readRecord unguarded. Its throw ended the turn before the taint was written, so a
		// re-run would reuse a workspace holding a write nobody recorded, with no mark on it (D21a). A missing export is an
		// expected case (devin only warns when it fails to write one, D20).
		const result = await turn(await open(fakeExec(ownWrite), { driver: throwingRecord() }));
		expect(messageOf(result)).toMatch(/^CLI_UNEXPLAINED_CHANGE: /);
		expect(readWorkspaceTaint(workspaceDir)).toEqual(TAINTED_BY_THE_CHANGE);
		expect(JSON.parse(result.sessionExport!)).toEqual({
			breach: 'CLI_UNEXPLAINED_CHANGE',
			cliRecord: null,
			unexplainedChanges: ['own-write.txt']
		});
	});

	it('C16 — a readRecord that throws, the workspace unchanged, fails the turn CLI_SURFACE_UNPROVEN', async () => {
		// ⛔ THE MUTANT: a driver's throw read as a record that proves the surface.
		const result = await turn(await open(fakeExec(passing), { driver: throwingRecord() }));
		expect(messageOf(result)).toMatch(/^CLI_SURFACE_UNPROVEN: /);
		expect(readWorkspaceTaint(workspaceDir)).toEqual({ tainted: false });
	});

	it('C20 — a classifyStderr that throws fails the turn CLI_ERROR: nothing then shows the CLI reported no error or refusal', async () => {
		// ⛔ THE MUTANTS: the driver's classifyStderr unguarded; its throw read as no signal at all, which would accept a
		// turn whose only sign of a refusal is its stderr line (devin's, D19).
		const driver = fakeDriver({
			classifyStderr: () => {
				throw new TypeError('the fake driver misread a line');
			}
		});
		const exec = fakeExec(async (cli) => {
			cli.answer('{"workProduct":"done","rationale":{}}');
			return { errorLines: ['FAKE-REJECTED'] };
		});
		const result = await turn(await open(exec, { driver }));
		expect(messageOf(result)).toMatch(
			/^CLI_ERROR: .* What the CLI wrote to its error stream could not be classified, so nothing shows it reported no error\.$/
		);
	});

	it('C17 — a reading the opener cannot use still leaves the change marked: the taint is written before any driver code runs', async () => {
		// ⛔ THE MUTANT: the taint written once the driver's reading is merged, where the first build wrote it. A reading
		// that throws there (its events not a list) ended the turn with the workspace unmarked.
		const driver = fakeDriver({
			readRecord: async () => ({
				read: 'PARSED',
				raw: '{}',
				surface: [...DEFAULT_SURFACE],
				events: null as unknown as CliRecordEvent[],
				reportedModels: [],
				answer: 'x'
			})
		});
		await expect(turn(await open(fakeExec(ownWrite), { driver }))).rejects.toThrow(
			"The CLI executor for 'fake' could not run this turn (no error code)."
		);
		expect(readWorkspaceTaint(workspaceDir)).toEqual(TAINTED_BY_THE_CHANGE);
	});
});

describe('⭐ D22 — the model, read back where the CLI reports it', () => {
	it('C18 — a reported model other than the configured one fails the turn CLI_MODEL_SUBSTITUTED, naming both', async () => {
		// ⛔ THE MUTANT: take the reported model.
		const exec = fakeExec(async (cli) => {
			cli.record.reportedModels = ['fake-model-1', 'other-model-2'];
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const message = messageOf(await turn(await open(exec)));
		expect(message.startsWith('CLI_MODEL_SUBSTITUTED: ')).toBe(true);
		expect(message).toContain("Configured: 'fake-model-1'; reported: 'fake-model-1', 'other-model-2'.");
	});

	it('C18 — a reported model name this host will not print is said to be one, and never printed', async () => {
		// ⛔ THE MUTANT: print every reported name. The name is the CLI's to write, and the message lands on the record plane.
		const exec = fakeExec(async (cli) => {
			cli.record.reportedModels = ["other-model'\nINJECTED-LINE"];
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const message = messageOf(await turn(await open(exec)));
		expect(message).toContain("Configured: 'fake-model-1'; reported: a model name this host will not print.");
		expect(message).not.toContain('INJECTED-LINE');
	});

	it('C19 — one reported model equal to the configured one is PROVIDER_REPORTED; none reported is HOST_CONFIGURED with the configured id', async () => {
		// ⛔ THE MUTANT: always PROVIDER_REPORTED, the shape of `pi-executor.ts`'s grade.
		const reported = fakeExec(async (cli) => {
			cli.record.reportedModels = ['fake-model-1'];
			cli.record.volunteeredReasoning = 'REASONING-MARK';
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const silent = fakeExec(async (cli) => cli.answer('{"workProduct":"done","rationale":{}}'));
		const a = await turn(await open(reported));
		const b = await turn(await open(silent));
		expect([a.identityEvidence, a.producer]).toEqual([
			'PROVIDER_REPORTED',
			{ agentId: 'execution.model-invocation', modelId: 'fake-model-1', providerId: 'fake' }
		]);
		expect([b.identityEvidence, b.producer]).toEqual([
			'HOST_CONFIGURED',
			{ agentId: 'execution.model-invocation', modelId: 'fake-model-1', providerId: 'fake' }
		]);
		// ⭐ D23 — reasoning the CLI returned apart from its answer is volunteered reasoning, never the answer.
		expect(a.volunteeredReasoning).toBe('REASONING-MARK');
		expect(b.volunteeredReasoning).toBeUndefined();
	});
});

describe('⭐ D19, D19a — every turn ends as an answer or a stated cause, and a message carries no secret', () => {
	it('C20 — exit 0 with nothing is ENDED_WITHOUT_ANSWER', async () => {
		const result = await turn(await open(fakeExec(async () => undefined)));
		expect(result.answer).toEqual({ arrived: false, cause: 'ENDED_WITHOUT_ANSWER' });
	});

	it('C20 — exit 2 is CLI_ERROR, even with an answer in its record', async () => {
		const exec = fakeExec(async (cli) => {
			cli.answer('{"workProduct":"done","rationale":{}}');
			return { exitCode: 2 };
		});
		expect(messageOf(await turn(await open(exec)))).toMatch(/^CLI_ERROR: [^“]*$/);
	});

	it('C20 — a stdout cut at the host’s bound is CLI_ERROR, not an answer', async () => {
		const exec = fakeExec(async (cli) => {
			cli.answer('{"workProduct":"done","rationale":{}}');
			return { stdoutComplete: false };
		});
		expect(messageOf(await turn(await open(exec))).startsWith('CLI_ERROR: ')).toBe(true);
	});

	it('C20 — a program that could not be started is CLI_ERROR naming its errno code', async () => {
		const exec = fakeExec(async () => ({ exitCode: null, startFailure: 'ENOENT' }));
		expect(messageOf(await turn(await open(exec)))).toMatch(/^CLI_ERROR: .* It could not be started \(ENOENT\)\.$/);
	});

	it('C20 — the CLI’s own timeout warning is CALL_ABORTED, not an answer', async () => {
		const exec = fakeExec(async (cli) => {
			cli.answer('partial text');
			return { errorLines: ['FAKE-TIMED-OUT'] };
		});
		expect((await turn(await open(exec))).answer).toEqual({
			arrived: false,
			cause: 'CALL_ABORTED',
			message: 'The CLI reported that its own time limit expired, so what it returned is not an answer.'
		});
	});

	it('C20 — a known-shape excerpt is kept to 300 characters', async () => {
		const exec = fakeExec(async () => ({ exitCode: 1, errorLines: [`FAKE-ERROR: ${'e'.repeat(400)}`] }));
		const message = messageOf(await turn(await open(exec)));
		expect(message).toContain(`“${'e'.repeat(300)}”`);
		expect(message).not.toContain('e'.repeat(301));
	});

	it('⭑ CONTROL — a clean known-shape excerpt reaches the message', async () => {
		const exec = fakeExec(async () => ({ exitCode: 1, errorLines: ['FAKE-ERROR: disk quota exceeded'] }));
		expect(messageOf(await turn(await open(exec)))).toContain(' The CLI reported: “disk quota exceeded”');
	});

	it.each([
		['the prompt', (cli: FakeCli) => cli.prompt().slice(-100)],
		['a served argument', () => 'SERVED-ARGUMENT-qqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'],
		// ⚠ The command's result, which names none of the arguments: a result that named one would be withheld by that
		// argument, and this arm would prove nothing about results.
		['a served result', (_cli: FakeCli, commandResult: string) => commandResult],
		['the run path', (cli: FakeCli) => `could not open ${cli.runDirectory}`],
		['the port', (cli: FakeCli) => `connect refused on ${cli.port}`],
		['the token', (cli: FakeCli) => `bad token ${cli.endpoint.token}`]
	])('C20 — an excerpt carrying %s is withheld, and the code stays', async (_, leak) => {
		// ⛔ ONE MUTANT PER ARM: that check left out of what an excerpt is measured against.
		const exec = fakeExec(async (cli) => {
			await cli.call('write_file', { path: 'served.txt', contents: 'SERVED-ARGUMENT-qqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' });
			const ran = await cli.call('run_command', { argv: ['node', '--served-flag-zz'] });
			const commandResult = String(ran.body.result.content[0].text);
			expect(commandResult, 'arrangement: the result names no argument').not.toMatch(/served|node|zz/);
			return { exitCode: 1, errorLines: [`FAKE-ERROR: ${leak(cli, commandResult)}`] };
		});
		const message = messageOf(await turn(await open(exec, { ctx: context() }), 'INSTRUCTION '.repeat(20)));
		expect(message.startsWith('CLI_ERROR: ')).toBe(true);
		expect(message).not.toContain('The CLI reported: “');
	});

	it('C20 — a stderr line of no shape the driver knows never reaches the message', async () => {
		const exec = fakeExec(async () => ({ exitCode: 1, errorLines: ['UNKNOWN-SHAPE planted line'] }));
		const message = messageOf(await turn(await open(exec)));
		expect(message.startsWith('CLI_ERROR: ')).toBe(true);
		expect(message).not.toContain('planted');
	});
});

describe('⭐ D13, D44a — the configuration a CLI reads', () => {
	it('C21 — a config source whose size changed refuses the next turn before any spawn, naming the source', async () => {
		// ⛔ THE MUTANT: fingerprint only when the session opens.
		const config = join(container, 'config');
		mkdirSync(config);
		writeFileSync(join(config, 'settings.json'), '{}', 'utf8');
		const exec = fakeExec(passing);
		const session = await open(exec, {
			driver: fakeDriver({ configSources: [{ name: 'fake settings', path: join(config, 'settings.json') }] })
		});
		expect((await turn(session)).answer.arrived).toBe(true);
		appendFileSync(join(config, 'settings.json'), ' ', 'utf8');
		const second = await turn(session, 'FINDINGS');
		expect(messageOf(second)).toMatch(/^EXECUTOR_CONFIG_CHANGED: .* It names: fake settings\.$/);
		expect(exec.requests, 'the CLI was started for a refused turn').toHaveLength(1);
		expect(second.observedToolCalls.canObserve).toBe(false);
	});

	it('C21 — a config source that cannot be opened as a file, a folder, is fingerprinted by stat alone', async () => {
		const hooks = join(container, 'hooks.d');
		mkdirSync(hooks);
		const exec = fakeExec(passing);
		const session = await open(exec, { driver: fakeDriver({ configSources: [{ name: 'fake hooks folder', path: hooks }] }) });
		expect((await turn(session)).answer.arrived).toBe(true);
		await new Promise((r) => setTimeout(r, 20));
		writeFileSync(join(hooks, 'new-hook.json'), '{}', 'utf8');
		expect(messageOf(await turn(session, 'FINDINGS'))).toMatch(/It names: fake hooks folder\.$/);
	});

	it('C21 — a CLI’s project configuration appearing in an ancestor of the root refuses the next turn', async () => {
		const nested = join(container, 'a', 'root');
		const exec = fakeExec(passing);
		const session = await open(exec, { root: nested });
		expect((await turn(session)).answer.arrived).toBe(true);
		mkdirSync(join(container, 'a', '.agents'));
		expect(messageOf(await turn(session, 'FINDINGS'))).toContain(
			'an ancestor of the dedicated root now holds .agents, 1 folder above the root'
		);
	});

	it('C21 — the bridge rewritten between turns refuses the next turn before any spawn, naming it: the CLI runs it each turn', async () => {
		// ⛔ THE MUTANT: the bridge left out of the files the opener checks, so a bridge the model rewrote runs unrecorded code
		// in the CLI's tree on the next turn, as a planted hook would.
		const exec = fakeExec(passing);
		const session = await open(exec);
		expect((await turn(session)).answer.arrived).toBe(true);
		appendFileSync(join(exec.clis[0]!.hostDirectory, 'jpwb-bridge.mjs'), '\n// planted\n', 'utf8');
		const second = await turn(session, 'FINDINGS');
		expect(messageOf(second)).toMatch(
			/^EXECUTOR_CONFIG_CHANGED: .* It names: host\/jpwb-bridge\.mjs, which no longer holds the bytes the opener wrote\.$/
		);
		expect(exec.requests, 'the CLI was started for a refused turn').toHaveLength(1);
	});

	it('C22 — a dedicated root with an ancestor holding .devin refuses the session', async () => {
		// ⛔ THE MUTANT: skip the check.
		mkdirSync(join(container, 'x', '.devin'), { recursive: true });
		await expect(open(fakeExec(passing), { root: join(container, 'x', 'y', 'root') })).rejects.toThrow(
			'.devin, 2 folders above the root'
		);
	});

	it('C22 — in the home folder only the CLIs’ own user directories are passed over; every other name there, and every name elsewhere, is refused', () => {
		// ⛔ THE MUTANTS: no exception for the home folder; an exception for every name in it.
		const home = join(container, 'home');
		const rootUnderHome = join(home, 'AppData', 'Temp', 'jpwb-exec');
		const present = new Set([join(home, '.devin'), join(home, '.claude')]);
		expect(ancestorConfiguration(rootUnderHome, home, (p) => present.has(p))).toEqual([]);
		present.add(join(home, 'CLAUDE.md'));
		present.add(join(home, 'AppData', '.claude'));
		expect(ancestorConfiguration(rootUnderHome, home, (p) => present.has(p))).toEqual([
			'.claude, 2 folders above the root',
			'CLAUDE.md, 3 folders above the root'
		]);
	});
});

describe('⭐ D13 — the run folder’s life', () => {
	it('C23 — when dispose() returns mid-turn, the gate is closed and the token revoked; the folder goes afterwards, and the CLI is killed', async () => {
		// ⛔ THE MUTANT: leave the gate to the server's close.
		const holder: { session?: ProducerSession } = {};
		let after: Promise<{ status: number }> | undefined;
		let folderAtReturn = false;
		const exec = fakeExec(async (cli) => {
			expect((await cli.call('write_file', { path: 'a.txt', contents: 'x' })).status).toBe(200);
			holder.session!.dispose();
			folderAtReturn = existsSync(cli.runDirectory);
			// ⚠ Sent at once, before anything awaits: dispose() has returned, and the listener is still up.
			after = rpc(cli.endpoint.url, cli.endpoint.token, { jsonrpc: '2.0', id: 2, method: 'ping' });
			await after;
		});
		holder.session = await open(exec);
		await turn(holder.session);
		expect((await after!).status).toBe(GATE_REFUSED_STATUS);
		expect(folderAtReturn, 'the folder was removed before dispose() returned').toBe(true);
		expect(exec.killed()).toBe(1);
		const runDirectory = exec.clis[0]!.runDirectory;
		for (let i = 0; i < 50 && existsSync(runDirectory); i++) await new Promise((r) => setTimeout(r, 50));
		expect(existsSync(runDirectory)).toBe(false);
	});

	it('C24 — opening removes a stale run folder whose server pid is dead, and keeps one whose pid is live', async () => {
		// ⛔ THE MUTANT: remove every one.
		const dead = spawnSync(process.execPath, ['-e', '']).pid;
		mkdirSync(join(root, `jpwb-exec-fake-${dead}-AbC123`), { recursive: true });
		mkdirSync(join(root, `jpwb-exec-fake-${process.pid}-DeF456`), { recursive: true });
		await open(fakeExec(passing));
		expect(existsSync(join(root, `jpwb-exec-fake-${dead}-AbC123`))).toBe(false);
		expect(existsSync(join(root, `jpwb-exec-fake-${process.pid}-DeF456`))).toBe(true);
	});

	it('C25 — a failure to open removes the run folder and closes the server', async () => {
		// ⛔ THE MUTANT: no `finally`.
		let url = '';
		const exec: CliExec = (req) => {
			url = (JSON.parse(readFileSync(join(dirname(req.cwd), 'host', 'endpoint.json'), 'utf8')) as { url: string }).url;
			return { done: Promise.resolve({ exitCode: 0, stdout: 'not ours', stdoutComplete: true, errorLines: [] }), kill: async () => undefined };
		};
		const driver = fakeDriver({
			preflight: () => ({ invocation: { program: 'fake-cli', args: ['list'] }, refusal: () => 'the fake preflight refused' })
		});
		await expect(open(exec, { driver })).rejects.toThrow('the fake preflight refused');
		expect(readdirSync(root).filter((n) => n.startsWith('jpwb-exec-'))).toEqual([]);
		await expect(rpc(url, 'x', { jsonrpc: '2.0', id: 1, method: 'ping' })).rejects.toThrow(/ECONNREFUSED/);
	});

	it('C26 — after a turn whose CLI throws, lastTurnObservation() holds the calls made before it, and the throw carries no path', async () => {
		// ⛔ THE MUTANTS: set the observation after the `try`; rethrow the CLI's own error.
		const exec = fakeExec(async (cli) => {
			await cli.call('write_file', { path: 'a.txt', contents: 'x' });
			throw new Error(`the fake CLI fell over in ${cli.runDirectory}`);
		});
		const session = await open(exec);
		await expect(session.turn('INSTRUCTION')).rejects.toThrow(
			"The CLI executor for 'fake' could not run this turn (no error code)."
		);
		expect(session.lastTurnObservation()).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [{ name: 'write_file', outcome: 'COMPLETED' }]
		});
	});

	it('C27 — a driver’s file outside the run folder refuses the session, and nothing is written there', async () => {
		// ⛔ THE MUTANT: a driver writing to the temp root.
		const driver = fakeDriver({ runFolderFiles: () => [{ path: '../escape.txt', bytes: 'x' }] });
		await expect(open(fakeExec(passing), { driver })).rejects.toThrow('declared a run-folder file outside its run folder');
		expect(existsSync(join(root, 'escape.txt'))).toBe(false);
		expect(readdirSync(root).filter((n) => n.startsWith('jpwb-exec-'))).toEqual([]);
	});

	it('C28 — on a breach the CLI’s record goes with the answer, to be kept; on a turn that passes it does not', async () => {
		// ⛔ THE MUTANT: hand it on every turn (the orphan REG-F-336 C-2 forbids once kept).
		const exec = fakeExec(async (cli) => {
			if (cli.turn === 2) cli.own('shell', true);
			cli.answer('{"workProduct":"done","rationale":{}}');
		});
		const session = await open(exec);
		const passed = await turn(session);
		const breached = await turn(session, 'FINDINGS');
		expect(passed.sessionExport).toBeUndefined();
		const kept = JSON.parse(breached.sessionExport!) as { breach: string; cliRecord: string; unexplainedChanges: string[] };
		expect(kept.breach).toBe('CLI_OWN_TOOL_RAN');
		expect(JSON.parse(kept.cliRecord)).toEqual(expect.objectContaining({ events: expect.arrayContaining([{ kind: 'OWN_TOOL', name: 'shell', ran: true }]) }));
	});

	it('refuses a driver whose tool is not the selection’s', async () => {
		await expect(
			openCliExecutionSession(context(), SELECTION, fakeDriver({ toolId: 'other' }), { exec: fakeExec(passing), root })
		).rejects.toThrow("No CLI executor driver for 'fake' was handed to its opener");
	});

	it('refuses a tool id outside its characters, before any folder is made: the run folder is named from it', async () => {
		// ⛔ THE MUTANT: no character check (MH1-M90 removes only the driver's comparison). `jpwb-exec-fake/../../outside-…`
		// would put the run folder outside the dedicated root, where the stale sweep never looks.
		const toolId = 'fake/../../outside';
		await expect(
			openCliExecutionSession(context(), { ...SELECTION, toolId }, fakeDriver({ toolId }), { exec: fakeExec(passing), root })
		).rejects.toThrow(`No CLI executor driver for '${toolId}' was handed to its opener`);
		expect(readdirSync(container).filter((n) => n.startsWith('outside-'))).toEqual([]);
	});

	it('a disposed session takes no further turn: it refuses in its own words, and starts nothing', async () => {
		// ⛔ THE MUTANT: no check. The turn would write its prompt into a run folder being removed and meet the closed
		// server's refusal, and the record would say only that the turn could not run.
		const exec = fakeExec(passing);
		const session = await open(exec);
		session.dispose();
		await expect(session.turn('INSTRUCTION')).rejects.toThrow(
			'This CLI executor session has been disposed; it takes no further turn.'
		);
		expect(exec.requests).toHaveLength(0);
	});
});

describe('⭐ D14, D18 — the preflight is bounded by the host, and a preflight that did not run whole refuses the session', () => {
	const preflighting = (): CliDriver =>
		fakeDriver({
			// ⭑ The driver's own refusal passes everything, so only the opener's checks can refuse.
			preflight: () => ({ invocation: { program: 'fake-cli', args: ['list'] }, refusal: () => undefined })
		});

	it('a preflight that never ends is killed at the host’s bound, and the session is refused', async () => {
		// ⛔ THE MUTANTS: no bound, so a hung preflight hangs the session's open; no kill at the bound. ⚠ THE OPEN IS RACED
		// AGAINST A DEADLINE OF THIS TEST'S OWN, so a hung open fails an assertion: a test that merely timed out measured
		// nothing, and the mutation runner says so (INCONCLUSIVE, found by MH1-M103's first run). The deadline sits past
		// the bound plus the opener's wait for a killed child (5 s), so the no-kill mutant still settles before it.
		let kills = 0;
		const exec: CliExec = () => {
			let release: (run: CliRun) => void = () => undefined;
			return {
				done: new Promise<CliRun>((settle) => (release = settle)),
				kill: async () => {
					kills += 1;
					release({ exitCode: null, stdout: '', stdoutComplete: true, errorLines: [] });
				}
			};
		};
		const opening = open(exec, { driver: preflighting(), preflightTimeoutMs: 200 }).then(
			() => 'the session opened',
			(e: Error) => e.message
		);
		let timer: ReturnType<typeof setTimeout> | undefined;
		const deadline = new Promise<string>((settle) => {
			timer = setTimeout(() => settle('the session was still opening 8000 ms on'), 8_000);
		});
		const settled = await Promise.race([opening, deadline]);
		clearTimeout(timer);
		expect(settled).toBe(
			"The CLI executor session for 'fake' is refused by its preflight: it outlasted the host's bound of 200 ms, and " +
				'its process tree was killed.'
		);
		expect(kills).toBe(1);
		expect(readdirSync(root).filter((n) => n.startsWith('jpwb-exec-'))).toEqual([]);
	}, 15_000);

	it.each([
		[
			'could not be started',
			{ exitCode: null, startFailure: 'ENOENT', stdout: '', stdoutComplete: true, errorLines: [] },
			'it could not be started (ENOENT).'
		],
		[
			'had its output cut at the host’s bound',
			{ exitCode: 0, stdout: 'jpwb', stdoutComplete: false, errorLines: [] },
			'its output passed the host’s bound, so it could not be read whole.'
		]
	])('a preflight that %s refuses the session, whatever the driver’s own refusal says', async (_, run, said) => {
		// ⛔ ONE MUTANT PER ARM: that arm left to the driver's refusal function, which here passes everything (D12).
		const exec: CliExec = () => ({ done: Promise.resolve(run as CliRun), kill: async () => undefined });
		await expect(open(exec, { driver: preflighting() })).rejects.toThrow(`is refused by its preflight: ${said}`);
	});
});
