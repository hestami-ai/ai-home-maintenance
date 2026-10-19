// ⭐⭐ `JAN-MHX` MH-10 — the victim for THE MUSE DRIVER (`DESIGN-multi-harness-executor.md` §4.4; the sponsor's answers of
// 2026-10-18, S4; MH-10's probes, P1 to P3).
//
// ⭑ TWO WAYS IN. The driver's own methods, over a run folder of this test's and Muse's records rebuilt here from the shapes
// the probes measured (no captured record is copied: each holds the operator's paths); and the REAL opener, with a
// `CliExec` seam playing Muse: it reads the MCP entry the driver put in argv, reads the endpoint file that entry names, and
// calls the REAL host tool server with the turn's token, as Muse's bridge would; then it writes Muse's records under the
// data root its environment names. No model is called and no Muse is started.
// ⚠ Every directory is under `os.tmpdir()`, never under the repository.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProcessRunOutcome, ProcessRunner } from '@janumipwb/rph-ports';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import type { ProducerSession, ProducerSessionContext } from '../execution/producer-session.js';
import { readWorkspaceTaint } from '../execution/workspace-taint.js';
import type { ToolInvocationResult } from './backing-tool.js';
import {
	EXECUTOR_HOST_TOOLS_PREAMBLE,
	openCliExecutionSession,
	type CliExec,
	type CliExecRequest,
	type CliRecordReading,
	type CliRun,
	type CliRunFolder,
	type CliTurnInput
} from './cli-executor-session.js';
import { museExecutorDriver, type MuseDriverHost } from './muse-executor-driver.js';

const RELEASE = '1.4.10-R6427.1';
const MODEL = 'muse-wonder-1.0';
const SELECTION = { kind: 'CLI', toolId: 'muse', modelId: MODEL, effort: 'high' } as const;

let container = '';
let workspaceDir = '';
let root = '';
let install = '';
let home = '';
const sessions: ProducerSession[] = [];

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-muse-driver-'));
	workspaceDir = join(container, 'workspace');
	root = join(container, 'root');
	install = join(container, 'install');
	home = join(container, 'home');
	mkdirSync(workspaceDir);
	mkdirSync(install);
	writeFileSync(join(install, '.muse-version'), `${RELEASE}\n`, 'utf8');
	writeFileSync(
		join(install, '.muse-release-info.json'),
		JSON.stringify({ version: RELEASE }),
		'utf8'
	);
	mkdirSync(join(home, '.config', 'muse', 'skills'), { recursive: true });
	writeFileSync(join(home, '.config', 'muse', 'settings.json'), '{}', 'utf8');
	writeFileSync(join(home, '.config', 'muse', 'trust.json'), '{}', 'utf8');
});
afterEach(async () => {
	vi.unstubAllEnvs();
	for (const s of sessions.splice(0)) s.dispose();
	await new Promise((r) => setTimeout(r, 300));
	await rm(container, { recursive: true, force: true, maxRetries: 5 });
});

const host = (over: Partial<MuseDriverHost> = {}): MuseDriverHost => ({
	installDirectory: install,
	home,
	programOverride: undefined,
	...over
});

// ── Muse's records, rebuilt from the shapes MH-10's probes measured ─────────────────────────────────────────────────────

let sequence = 0;
/** One record of Muse's JSONL. */
const rec = (payloadType: string, payload: Record<string, unknown>) => ({
	schema_version: 1,
	id: `record-${++sequence}`,
	stream: { kind: 'session', id: 'session-1' },
	sequence,
	recorded_at: 0,
	record_type: 'event',
	durability: 'durable',
	causation_id: null,
	payload_type: payloadType,
	payload_schema_version: 1,
	payload
});
/** A run event of the session log. */
const runEventRecord = (event: Record<string, unknown>) =>
	rec('runtime.session', { kind: 'run', run_id: 'run-1', event });
const configured = (active: unknown) =>
	runEventRecord({
		kind: 'model_request_configured',
		base_instructions: 'You are Muse Code.',
		toolset: { source: 'settings', mode: 'named', active_tools: active }
	});
const identityCatalog = (entries: readonly (readonly [string, string])[]) =>
	rec('runtime.mcp_tool_identity_catalog', {
		schema_version: 1,
		kind: 'mcp_tool_identity_catalog',
		entries: entries.map(([server, tool]) => ({
			canonical_id: `mcp__${server}__${tool}`,
			surface: { namespace: `mcp__${server}`, name: tool },
			server_name: server,
			raw_tool_name: tool
		}))
	});
const committedCalls = (calls: readonly (readonly [string, string, unknown?])[]) =>
	runEventRecord({
		kind: 'assistant_tool_calls_committed',
		message_id: 'message-1',
		response_id: 'response-1',
		tool_calls: calls.map(([callId, name, args]) => ({
			id: `fc_${callId}`,
			call_id: callId,
			name,
			args: JSON.stringify(args ?? {})
		}))
	});
const effectStarted = (callId: string, toolName: string) =>
	rec('tool_batch.effect.started', {
		kind: 'tool_batch_effect',
		run_id: 'run-1',
		record: { kind: 'started', effect_id: `effect-${callId}`, call_id: callId, tool_name: toolName }
	});
const said = (text: string) =>
	runEventRecord({
		kind: 'assistant_message_committed',
		message_id: 'message-2',
		response_id: 'response-2',
		text
	});
const modelCompleted = (model: unknown) =>
	runEventRecord({
		kind: 'model_completed',
		usage: { input_tokens: 1, output_tokens: 1 },
		duration_ms: 1,
		model
	});
const summaryOf = (text: string) =>
	runEventRecord({
		kind: 'reasoning_summary_committed',
		message_id: 'message-3',
		response_id: 'response-2',
		text
	});
const encryptedReasoning = () =>
	runEventRecord({
		kind: 'reasoning_committed',
		message_id: 'message-4',
		text: '',
		encrypted_content: 'ENCRYPTED-REASONING'
	});
/** Records Muse commits together, inside one retained transaction. */
const retainedFrame = (children: readonly object[]) => ({
	retained_frame: 'session_permission_transaction',
	frame_schema_version: 1,
	outer_log_ordinal: 1,
	transaction_id: 'transaction-1',
	children: children.map((child, k) => ({ child_index: k, record_json: JSON.stringify(child) })),
	content_sha256: 'sha256:0'
});
const terminalCompleted = (text: string) =>
	rec('run.terminal.completed', {
		kind: 'run_terminal',
		terminal: 'completed',
		text,
		reason: null
	});
const terminalFailed = (reason: unknown) =>
	rec('run.terminal.failed', { kind: 'run_terminal', terminal: 'failed', text: '', reason });
/**
 * ⚠ NOT MEASURED: no probe ran a cancelled turn. The record kind is one Muse's binary names (its strings, MH-10's probe);
 * its shape here is the failed one's.
 */
const terminalCancelled = (reason: unknown) =>
	rec('run.terminal.cancelled', { kind: 'run_terminal', terminal: 'cancelled', text: '', reason });
/** Muse's local-tracing line for the tools it registered. */
const surfaceLine = (active: number, deferred = 0, hosted = 0) =>
	'2026-10-18T19:12:52.691662Z INFO tbh.local.tool tools/registration_selection_diagnostic.rs:17 ' +
	`event="tool.surface.registered" run_id=run-1 epoch_ordinal=0 registered_tool_count=33 active_tool_count=${active} ` +
	`deferred_tool_count=${deferred} provider_hosted_tool_count=${hosted} outcome="registered"`;

const HOST_TOOLS = ['mcp__jpwb__write_file', 'mcp__jpwb__run_command'];
const ANSWER = '{"workProduct":"done","rationale":{}}';

/** A turn whose record proves its surface, with the two host calls and an answer after them. */
function cleanSession(answer = ANSWER): object[] {
	return [
		retainedFrame([rec('runtime.session.permission_format_declared', {})]),
		configured(HOST_TOOLS),
		identityCatalog([
			['jpwb', 'run_command'],
			['jpwb', 'write_file']
		]),
		modelCompleted(MODEL),
		committedCalls([['call-1', 'mcp__jpwb__write_file', { path: 'a.txt', contents: 'hello' }]]),
		effectStarted('call-1', 'mcp__jpwb__write_file'),
		modelCompleted(MODEL),
		committedCalls([['call-2', 'mcp__jpwb__run_command', { argv: ['node', '--version'] }]]),
		effectStarted('call-2', 'mcp__jpwb__run_command'),
		summaryOf('Summarising the two steps.'),
		encryptedReasoning(),
		said(answer),
		modelCompleted(MODEL)
	];
}

/** Write Muse's records of a turn under `dataRoot`, where Muse 1.4.10 writes them. */
function writeMuseRecords(
	dataRoot: string,
	session: readonly object[] | null,
	tracing: readonly string[],
	sessionFolders = ['session-1']
): void {
	if (session !== null)
		for (const folder of sessionFolders) {
			const dir = join(dataRoot, 'muse', 'sessions', '2026', '10', '18', folder);
			mkdirSync(dir, { recursive: true });
			writeFileSync(
				join(dir, 'session.jsonl'),
				`${session.map((r) => JSON.stringify(r)).join('\n')}\n`,
				'utf8'
			);
			// ⭑ The session folder's own log, as Muse writes one: it holds no surface line.
			writeFileSync(
				join(dir, 'cli-1.log'),
				'INFO settings.load source="user_settings" outcome="loaded"\n',
				'utf8'
			);
		}
	const bootstrap = join(dataRoot, 'muse', 'local-tracing', 'bootstrap');
	mkdirSync(bootstrap, { recursive: true });
	writeFileSync(join(bootstrap, 'cli-1.log'), `${tracing.join('\n')}\n`, 'utf8');
}

const jsonl = (records: readonly object[]): string =>
	records.map((r) => JSON.stringify(r)).join('\n');

// ── The driver alone ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A run folder of this test's own, as the opener would tell the driver one. */
function runFolder(minted: readonly string[] = ['write_file', 'run_command']): CliRunFolder {
	const directory = join(container, 'run');
	return {
		directory,
		cliDirectory: join(directory, 'cli'),
		hostDirectory: join(directory, 'host'),
		bridgePath: join(directory, 'host', 'jpwb-bridge.mjs'),
		endpointPath: join(directory, 'host', 'endpoint.json'),
		nodePath: process.execPath,
		serverName: 'jpwb',
		mintedToolNames: minted,
		systemPrompt: 'THE SYSTEM PROMPT'
	};
}
const turnOf = (run: CliRunFolder, over: Partial<CliTurnInput> = {}): CliTurnInput => ({
	run,
	turn: 1,
	modelId: MODEL,
	effort: 'high',
	prompt: 'THE SYSTEM PROMPT\n\nTHE INSTRUCTION',
	userPrompt: 'THE INSTRUCTION',
	promptPath: join(run.hostDirectory, 'prompt-1.txt'),
	...over
});
/** The driver, its run folder named, and what it reads of the records written for turn 1. */
function driverOver(run = runFolder()) {
	const driver = museExecutorDriver(host());
	driver.runFolderFiles(run);
	const dataRoot = join(run.hostDirectory, 'muse-data-1');
	const read = (stdout: string): Promise<CliRecordReading> =>
		driver.readRecord({ run, turn: 1, exitCode: 0, stdout });
	return { driver, run, dataRoot, read };
}
const surfaceOf = (r: CliRecordReading) => (r.read === 'PARSED' ? r.surface : 'not parsed');

// ── The real opener, with a seam playing Muse ────────────────────────────────────────────────────────────────────────────

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

function context(
	grantedCapabilities: readonly string[] = ['file-system', 'process-execution']
): ProducerSessionContext {
	return {
		workspace: createFilesystemWorkspace({
			ownerKind: 'UNDERTAKING',
			ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
			purgeability: 'RETAINED_BY_PARTICIPATION',
			directoryPath: workspaceDir
		}),
		runner: stubRunner(),
		grantedCapabilities: [...grantedCapabilities],
		bindingAuthorizationStatus: 'AUTHORIZED'
	};
}

/** A POST to the host's server, as Muse's bridge sends one. */
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

/** Muse, as the seam plays it: it finds the host through the argv and the endpoint file, as Muse 1.4.10 did in P2. */
class FakeMuse {
	readonly entry: { readonly command: string; readonly args: string[]; readonly framing: string };
	readonly endpoint: { readonly url: string; readonly token: string };
	readonly dataRoot: string;
	session: object[] | null = null;
	out: object[] = [];
	tracing: string[] = [];
	errorLines: string[];
	constructor(readonly request: CliExecRequest) {
		const entry = request.args.find((a) => a.startsWith('mcpServers.jpwb='));
		if (entry === undefined) throw new Error('the argv names no jpwb MCP server');
		this.entry = JSON.parse(entry.slice('mcpServers.jpwb='.length));
		this.endpoint = JSON.parse(readFileSync(this.entry.args[1]!, 'utf8'));
		this.dataRoot = request.env.XDG_DATA_HOME ?? join(container, 'the-operator-s-own-data-root');
		this.errorLines = [`muse: workspace root: ${request.cwd} (cwd default)`];
	}
	get toolset(): string[] {
		const value = this.request.args.find((a) => a.startsWith('run.toolset='));
		return value === undefined ? [] : JSON.parse(value.slice('run.toolset='.length));
	}
	async call(name: string, args: unknown): Promise<void> {
		await rpc(this.endpoint.url, this.endpoint.token, {
			jsonrpc: '2.0',
			id: 1,
			method: 'tools/call',
			params: { name, arguments: args }
		});
	}
	finish(): CliRun {
		writeMuseRecords(this.dataRoot, this.session, this.tracing);
		return {
			exitCode: 0,
			stdout: jsonl(this.out),
			stdoutComplete: true,
			errorLines: this.errorLines
		};
	}
}

type Script = (muse: FakeMuse) => Promise<Partial<CliRun> | void>;

function museExec(script: Script): CliExec & { requests: CliExecRequest[]; muses: FakeMuse[] } {
	const requests: CliExecRequest[] = [];
	const muses: FakeMuse[] = [];
	const exec: CliExec = (req) => {
		requests.push(req);
		const muse = new FakeMuse(req);
		muses.push(muse);
		return {
			done: script(muse).then((over) => ({ ...muse.finish(), ...over })),
			kill: async () => undefined
		};
	};
	return Object.assign(exec, { requests, muses });
}

/** The two host calls, made through the host's server, and a record that proves the surface and carries the answer. */
const clean: Script = async (muse) => {
	await muse.call('write_file', { path: 'a.txt', contents: 'hello' });
	await muse.call('run_command', { argv: ['node', '--version'] });
	muse.session = cleanSession();
	muse.out = [terminalCompleted(ANSWER)];
	muse.tracing = [surfaceLine(2)];
};

async function open(
	exec: CliExec,
	options: { ctx?: ProducerSessionContext; driverHost?: MuseDriverHost } = {}
): Promise<ProducerSession> {
	const session = await openCliExecutionSession(
		options.ctx ?? context(),
		SELECTION,
		museExecutorDriver(options.driverHost ?? host()),
		{ exec, root, turnTimeoutMs: 60_000, now: () => '2026-10-18T10:00:00Z' }
	);
	sessions.push(session);
	return session;
}
const turn = async (
	session: ProducerSession,
	text = 'THE INSTRUCTION'
): Promise<ToolInvocationResult> => (await session.turn(text)) as ToolInvocationResult;
/** The marker a breach of the session's first turn writes beside the workspace (D21a). */
const TAINTED_BY_MUSE = {
	tainted: true,
	entries: [{ code: 'CLI_OWN_TOOL_RAN', toolId: 'muse', turn: 1, at: '2026-10-18T10:00:00Z' }]
} as const;
const messageOf = (r: ToolInvocationResult): string =>
	r.answer.arrived ? '' : 'message' in r.answer ? (r.answer.message ?? '') : '';

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('⭐ §4.4 — what Muse is given to run', () => {
	it('the argv is the design’s, in the form Muse 1.4.10 takes: pinned element by element', () => {
		// ⛔ THE MUTANTS, EACH ONE ELEMENT: the design's MCP entry (`"type":"stdio"`, `"lineDelimitedJson"`), which Muse refuses
		// whole; `--no-session-log`, which leaves no record of the offered tools; contributor mode on; telemetry left on; the
		// approval judge, a model call of its own; parallel calls left to Muse.
		const { driver, run } = driverOver();
		const invocation = driver.invocation(turnOf(run));
		expect(invocation.program).toBe(join(install, `muse-bin-${RELEASE}.exe`));
		expect(invocation.args).toEqual([
			'exec',
			'--provider',
			'meta',
			'--model',
			MODEL,
			'--reasoning-effort',
			'high',
			'--prompt-file',
			join(run.hostDirectory, 'prompt-1.txt'),
			'--json',
			'--disable-shell',
			'--disable-write',
			'--disable-web-tools',
			'--disable-reminders',
			'--disable-request-user-input',
			'--no-foreign-personal-context',
			'--approval-mode',
			'never',
			'--approval-judge',
			'off',
			'--contributor-mode',
			'off',
			'--no-parallel-tool-calls',
			'-c',
			'telemetry.enabled=false',
			'-c',
			'run.toolset=["mcp__jpwb__write_file","mcp__jpwb__run_command"]',
			'-c',
			`mcpServers.jpwb=${JSON.stringify({
				command: process.execPath,
				args: [run.bridgePath, run.endpointPath],
				framing: 'line_delimited_json'
			})}`
		]);
		expect(invocation.stdin).toBeUndefined();
		// ⭑ The entry, read back as Muse reads it: no `type`, no `tool_timeout_sec`, the snake-case framing.
		const entry = JSON.parse(invocation.args.at(-1)!.slice('mcpServers.jpwb='.length));
		expect(Object.keys(entry).sort()).toEqual(['args', 'command', 'framing']);
		for (const never of [
			'--yolo',
			'--disable-approval',
			'--disable-sandbox',
			'--trust-workspace',
			'--no-session-log'
		])
			expect(invocation.args, never).not.toContain(never);
		expect(
			invocation.args.some((a) => a.includes('THE INSTRUCTION')),
			'prompt text in argv'
		).toBe(false);
	});

	it('the toolset names exactly the tools minted for the grant: a file-system grant names write_file alone', async () => {
		// ⛔ THE MUTANT: the design's toolset, both names whatever the grant — Muse refuses a run whose toolset names a tool
		// the host did not mint, so every turn of a file-system-only unit would fail.
		const exec = museExec(async (muse) => {
			await muse.call('write_file', { path: 'a.txt', contents: 'hello' });
			muse.session = [
				configured(['mcp__jpwb__write_file']),
				identityCatalog([['jpwb', 'write_file']]),
				modelCompleted(MODEL),
				committedCalls([['call-1', 'mcp__jpwb__write_file']]),
				effectStarted('call-1', 'mcp__jpwb__write_file'),
				said(ANSWER),
				modelCompleted(MODEL)
			];
			muse.out = [terminalCompleted(ANSWER)];
			muse.tracing = [surfaceLine(1)];
		});
		const result = await turn(await open(exec, { ctx: context(['file-system']) }));
		expect(exec.muses[0]!.toolset).toEqual(['mcp__jpwb__write_file']);
		expect(result.answer).toEqual({ arrived: true, text: ANSWER });
	});

	it('the prompt is the prompt file in host/, the preamble and contract at its head, and nothing rides on stdin', async () => {
		const exec = museExec(clean);
		await turn(await open(exec));
		const req = exec.requests[0]!;
		const promptPath = req.args[req.args.indexOf('--prompt-file') + 1]!;
		expect(dirname(promptPath)).toBe(dirname(exec.muses[0]!.entry.args[1]!));
		expect(readFileSync(promptPath, 'utf8').startsWith(EXECUTOR_HOST_TOOLS_PREAMBLE)).toBe(true);
		expect(readFileSync(promptPath, 'utf8')).toContain('THE INSTRUCTION');
		expect(req.stdin).toBeUndefined();
	});

	it('the data root is the turn’s own, in host/, each turn another; Muse’s configuration root is not moved', async () => {
		// ⛔ THE MUTANTS: no XDG_DATA_HOME, so Muse writes the turn's session log and tracing into the operator's own store and
		// loads the operator's memory; one data root for every turn, so a turn's root holds an earlier turn's session log too;
		// MUSE_NO_AUTO_UPDATE left out.
		const exec = museExec(clean);
		const session = await open(exec);
		const first = await turn(session, 'THE INSTRUCTION');
		const second = await turn(session, 'THE FINDINGS');
		const hostDirectory = dirname(exec.muses[0]!.entry.args[1]!);
		expect(exec.requests[0]!.env.XDG_DATA_HOME).toBe(join(hostDirectory, 'muse-data-1'));
		expect(exec.requests[1]!.env.XDG_DATA_HOME).toBe(join(hostDirectory, 'muse-data-2'));
		expect(exec.requests[0]!.env.MUSE_NO_AUTO_UPDATE).toBe('1');
		expect(exec.requests[0]!.env.XDG_CONFIG_HOME).toBeUndefined();
		// ⭑ Each turn's record is read from its own root: the second is an answer too, not a root it cannot place.
		expect(first.answer.arrived).toBe(true);
		expect(second.answer).toEqual({ arrived: true, text: ANSWER });
	});

	it('the program is the installed binary its version file names, started in the run’s cli/ folder', async () => {
		const exec = museExec(clean);
		await turn(await open(exec));
		expect(exec.requests[0]!.program).toBe(join(install, `muse-bin-${RELEASE}.exe`));
		expect(exec.requests[0]!.cwd).toBe(
			join(dirname(dirname(exec.muses[0]!.entry.args[1]!)), 'cli')
		);
	});

	it('JPWB_MUSE_BIN, as captured, is run in the installed binary’s place', () => {
		// ⛔ THE MUTANT: the override is ignored, and a test's stand-in would start the operator's real Muse.
		const driver = museExecutorDriver(host({ programOverride: 'stand-in/muse-bin.exe' }));
		const run = runFolder();
		driver.runFolderFiles(run);
		expect(driver.invocation(turnOf(run)).program).toBe('stand-in/muse-bin.exe');
	});

	it('⛔ the override is the one captured when the module loaded: set afterwards, it runs nothing', async () => {
		// ⛔ THE MUTANT: the driver reads JPWB_MUSE_BIN when it is made, so a program the selector never saw would run.
		const localAppData = join(container, 'local-app-data');
		mkdirSync(join(localAppData, 'Programs', 'muse'), { recursive: true });
		writeFileSync(join(localAppData, 'Programs', 'muse', '.muse-version'), RELEASE, 'utf8');
		vi.stubEnv('LOCALAPPDATA', localAppData);
		const loadedWith = async (museBin: string | undefined) => {
			vi.resetModules();
			vi.stubEnv('JPWB_MUSE_BIN', museBin);
			const loaded = await import('./muse-executor-driver.js');
			vi.stubEnv('JPWB_MUSE_BIN', undefined);
			return loaded;
		};
		const programOf = (made: ReturnType<typeof museExecutorDriver>): string => {
			const run = runFolder();
			made.runFolderFiles(run);
			return made.invocation(turnOf(run)).program;
		};
		const unset = await loadedWith(undefined);
		vi.stubEnv('JPWB_MUSE_BIN', 'set-after-the-load/muse-bin.exe');
		expect(programOf(unset.museExecutorDriver())).toBe(
			join(localAppData, 'Programs', 'muse', `muse-bin-${RELEASE}.exe`)
		);
		const captured = await loadedWith('captured-at-load/muse-bin.exe');
		expect(programOf(captured.museExecutorDriver())).toBe('captured-at-load/muse-bin.exe');
		vi.resetModules();
	});

	it.each([
		[
			'no install folder',
			() => host({ installDirectory: undefined }),
			'this host names no folder Muse is installed in'
		],
		[
			'an install with no version file',
			() => host({ installDirectory: join(container, 'no-such-install') }),
			"its install's version file could not be read (ENOENT)"
		],
		[
			'a version file naming a path',
			() => {
				writeFileSync(join(install, '.muse-version'), '..\\..\\elsewhere\\muse', 'utf8');
				return host();
			},
			"its install's version file holds no release of the form Muse's take"
		]
	])(
		'⛔ a session with %s is refused when it opens, in words that name no path',
		async (_, driverHost, said) => {
			// ⛔ THE MUTANTS: a version file's contents taken as they are, so they name another program; a missing install
			// left to the turn, which would start a program named nowhere.
			const exec = museExec(clean);
			const opening = open(exec, { driverHost: driverHost() }).then(
				() => 'opened',
				(e: Error) => e.message
			);
			const message = await opening;
			expect(message).toContain('The Muse executor session is refused:');
			expect(message).toContain(said);
			expect(message).not.toContain(container);
			expect(exec.requests).toEqual([]);
		}
	);

	it('⛔ handed no effort, the driver starts nothing: Muse would take its own configuration’s', () => {
		// ⛔ THE MUTANT: the effort flag left out when there is none.
		const { driver, run } = driverOver();
		expect(() => driver.invocation(turnOf(run, { effort: undefined }))).toThrow(
			'The Muse executor was handed no effort, and Muse would take its own configuration’s.'
		);
	});
});

describe('⭐ D44a — the configuration Muse reads', () => {
	it('the sources are declared by name — its settings, its trust, its skills, its installed release and manifest — and never its login', () => {
		// ⛔ THE MUTANT: a source left off, so a change to it would steer the next try unseen.
		const driver = museExecutorDriver(host());
		const config = join(home, '.config', 'muse');
		expect(driver.configSources).toEqual([
			{ name: 'Muse’s settings (.config/muse/settings.json)', path: join(config, 'settings.json') },
			{
				name: 'Muse’s workspace trust (.config/muse/trust.json)',
				path: join(config, 'trust.json')
			},
			{ name: 'Muse’s skills (.config/muse/skills)', path: join(config, 'skills') },
			{ name: 'Muse’s installed release (.muse-version)', path: join(install, '.muse-version') },
			{
				name: 'Muse’s release manifest (.muse-release-info.json)',
				path: join(install, '.muse-release-info.json')
			}
		]);
		expect(driver.configSources.some((s) => s.path.endsWith('auth.json'))).toBe(false);
		// ⭑ A source's name reaches a refusal on the record: it names no path.
		for (const source of driver.configSources) expect(source.name).not.toContain(container);
	});

	it('⛔ a change to the installed release refuses the next turn before Muse is started, naming it', async () => {
		// ⛔ THE MUTANT: `.muse-version` left off the sources, so a session runs on after its release changed under it.
		const exec = museExec(clean);
		const session = await open(exec);
		expect((await turn(session)).answer.arrived).toBe(true);
		const at = new Date(Date.now() + 60_000);
		writeFileSync(join(install, '.muse-version'), '1.4.11-R7000.1\n', 'utf8');
		utimesSync(join(install, '.muse-version'), at, at);
		const refused = await turn(session, 'THE FINDINGS');
		expect(messageOf(refused)).toContain('EXECUTOR_CONFIG_CHANGED');
		expect(messageOf(refused)).toContain('Muse’s installed release (.muse-version)');
		expect(exec.requests).toHaveLength(1);
	});
});

describe('⭐ D14a, D20, D22 — what Muse’s record must prove', () => {
	it('a clean turn: the answer arrives, PROVIDER_REPORTED on the model Muse reported, both host calls COMPLETED, nothing tainted', async () => {
		// ⛔ THE MUTANT: the host's names kept whole (`mcp__jpwb__write_file`), so the record's calls never match the host's.
		const exec = museExec(clean);
		const result = await turn(await open(exec));
		expect(result.answer).toEqual({ arrived: true, text: ANSWER });
		expect(result.identityEvidence).toBe('PROVIDER_REPORTED');
		expect(result.producer).toEqual({
			agentId: 'execution.model-invocation',
			modelId: MODEL,
			providerId: 'muse'
		});
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'run_command', outcome: 'COMPLETED' }
			]
		});
		expect(readWorkspaceTaint(workspaceDir)).toEqual({ tainted: false });
		expect(result.sessionExport).toBeUndefined();
	});

	it('⛔ no session log in the turn’s root → ABSENT, and the turn fails CLI_SURFACE_UNPROVEN', async () => {
		// ⛔ THE MUTANT: a missing log read as an empty one, which proves an empty surface.
		const { dataRoot, read } = driverOver();
		writeMuseRecords(dataRoot, null, [surfaceLine(2)]);
		expect(await read(jsonl([terminalCompleted(ANSWER)]))).toEqual({ read: 'ABSENT' });
		const exec = museExec(async (muse) => {
			muse.out = [terminalCompleted(ANSWER)];
			muse.tracing = [surfaceLine(0)];
		});
		const result = await turn(await open(exec));
		expect(messageOf(result)).toMatch(/^CLI_SURFACE_UNPROVEN: /);
	});

	it('⛔ two session logs in the turn’s root → UNPARSEABLE: the host cannot place the turn’s', async () => {
		// ⛔ THE MUTANT: the first log found is taken as the turn's.
		const { dataRoot, read } = driverOver();
		writeMuseRecords(dataRoot, cleanSession(), [surfaceLine(2)], ['session-1', 'session-2']);
		expect((await read(jsonl([terminalCompleted(ANSWER)]))).read).toBe('UNPARSEABLE');
	});

	it('⛔ a line that is not a JSON object, in the session log or on stdout → UNPARSEABLE', async () => {
		// ⛔ THE MUTANT: such a line skipped, so a cut record reads as a whole one.
		const { dataRoot, read } = driverOver();
		writeMuseRecords(dataRoot, cleanSession(), [surfaceLine(2)]);
		expect((await read(jsonl([terminalCompleted(ANSWER)]))).read).toBe('PARSED');
		expect(
			(await read(`${jsonl([terminalCompleted(ANSWER)])}\n{"payload_type":"run.term`)).read
		).toBe('UNPARSEABLE');
		expect((await read('[1,2]')).read).toBe('UNPARSEABLE');
		const log = join(
			dataRoot,
			'muse',
			'sessions',
			'2026',
			'10',
			'18',
			'session-1',
			'session.jsonl'
		);
		writeFileSync(log, `${readFileSync(log, 'utf8')}{"payload_type":"tool_batch.eff\n`, 'utf8');
		expect((await read(jsonl([terminalCompleted(ANSWER)]))).read).toBe('UNPARSEABLE');
	});

	it('⛔ a record Muse committed inside a retained transaction is read in its place', async () => {
		// ⛔ THE MUTANT: a transaction's children passed over, so a tool of Muse's own that ran inside one goes unseen.
		const { dataRoot, read } = driverOver();
		const session = cleanSession();
		session.splice(
			5,
			0,
			retainedFrame([
				committedCalls([['call-own', 'read_file']]),
				effectStarted('call-own', 'read_file')
			])
		);
		writeMuseRecords(dataRoot, session, [surfaceLine(2)]);
		const reading = await read(jsonl([terminalCompleted(ANSWER)]));
		expect(reading.read === 'PARSED' && reading.events).toContainEqual({
			kind: 'OWN_TOOL',
			name: 'read_file',
			ran: true
		});
	});

	describe('⛔ the surface is proved only by every part of it, each a mutant of its own', () => {
		const proved: CliRecordReading['read'] = 'PARSED';
		it('⭑ CONTROL — the clean record proves the host’s two tools', async () => {
			const { dataRoot, read } = driverOver();
			writeMuseRecords(dataRoot, cleanSession(), [surfaceLine(2)]);
			const reading = await read(jsonl([terminalCompleted(ANSWER)]));
			expect(reading.read).toBe(proved);
			expect(surfaceOf(reading)).toEqual([
				{ party: 'HOST', name: 'write_file' },
				{ party: 'HOST', name: 'run_command' }
			]);
		});

		it.each([
			[
				// ⭑ EACH ROW TRIPS ONE CHECK ALONE. Here its tracing counts none, as an empty surface would name none, so only the
				// check that a request was configured refuses (found by MH10-M24, which survived the row's first form: it
				// counted two, and the count's own check refused it instead).
				'no model request was configured',
				(s: object[]) => s.filter((_, k) => k !== 1),
				[surfaceLine(0)]
			],
			[
				// ⭑ Its tracing counts none, as a list passed over would name none, so only the list's own check refuses.
				'a model request’s active tools are not a list',
				(s: object[]) => s.toSpliced(1, 1, configured('all')),
				[surfaceLine(0)]
			],
			[
				'Muse saw an MCP tool from a server other than the host’s',
				(s: object[]) =>
					s.toSpliced(
						2,
						1,
						identityCatalog([
							['jpwb', 'run_command'],
							['jpwb', 'write_file'],
							['science', 'search']
						])
					),
				[surfaceLine(2)]
			],
			[
				// ⭑ Its requests name the host's two tools and its tracing counts two, so only the catalog's absence refuses: a
				// Muse that stopped writing the catalog, or renamed it, would otherwise prove the surface by saying nothing.
				'Muse’s record holds no identity catalog',
				(s: object[]) => s.filter((_, k) => k !== 2),
				[surfaceLine(2)]
			],
			[
				// ⭑ Every entry is the host's server's and both minted names are there, so only their count refuses.
				'Muse’s identity catalog names a tool of the host’s server that the host did not mint',
				(s: object[]) =>
					s.toSpliced(
						2,
						1,
						identityCatalog([
							['jpwb', 'run_command'],
							['jpwb', 'write_file'],
							['jpwb', 'delete_file']
						])
					),
				[surfaceLine(2)]
			],
			[
				// ⭑ Every entry is the host's server's and they number two, so only the missing minted name refuses.
				'Muse’s identity catalog names another tool in a minted one’s place',
				(s: object[]) =>
					s.toSpliced(
						2,
						1,
						identityCatalog([
							['jpwb', 'run_command'],
							['jpwb', 'delete_file']
						])
					),
				[surfaceLine(2)]
			],
			[
				'its tracing holds no surface line',
				(s: object[]) => s,
				['INFO settings.load outcome="loaded"']
			],
			['its tracing counts a deferred tool', (s: object[]) => s, [surfaceLine(2, 1)]],
			['its tracing counts a tool the provider hosts', (s: object[]) => s, [surfaceLine(2, 0, 1)]],
			[
				'its tracing counts more active tools than the requests name',
				(s: object[]) => s,
				[surfaceLine(3)]
			]
		])('%s → no proof', async (_, edit, tracing) => {
			const { dataRoot, read } = driverOver();
			writeMuseRecords(dataRoot, edit(cleanSession()), tracing);
			const reading = await read(jsonl([terminalCompleted(ANSWER)]));
			expect(reading.read).toBe(proved);
			expect(surfaceOf(reading)).toBeUndefined();
		});
	});

	it('⛔ a surface that offers a tool of Muse’s own is a breach: CLI_OWN_TOOL_RAN, and the workspace is tainted', async () => {
		// ⛔ THE MUTANT: only the host's names kept in the surface, so Muse's own tools offered beside them go unseen.
		const exec = museExec(async (muse) => {
			await clean(muse);
			muse.session = cleanSession().toSpliced(1, 1, configured([...HOST_TOOLS, 'read_file']));
			muse.tracing = [surfaceLine(3)];
		});
		const result = await turn(await open(exec));
		expect(messageOf(result)).toMatch(/^CLI_OWN_TOOL_RAN: /);
		expect(readWorkspaceTaint(workspaceDir)).toEqual(TAINTED_BY_MUSE);
	});

	it('⛔ a tool of Muse’s own that ran is a breach, placed among the host’s calls in the log’s order', async () => {
		// ⛔ THE MUTANT: Muse's own effects passed over.
		const exec = museExec(async (muse) => {
			await clean(muse);
			muse.session = cleanSession().toSpliced(
				6,
				0,
				committedCalls([['call-own', 'read_file', { path: 'AGENTS.md' }]]),
				effectStarted('call-own', 'read_file')
			);
		});
		const result = await turn(await open(exec));
		expect(messageOf(result)).toMatch(/^CLI_OWN_TOOL_RAN: /);
		expect(result.observedToolCalls).toMatchObject({
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'cli:read_file', outcome: 'UNKNOWN' },
				{ name: 'run_command', outcome: 'COMPLETED' }
			]
		});
		expect(readWorkspaceTaint(workspaceDir)).toEqual(TAINTED_BY_MUSE);
	});

	it('⛔ a call the model committed that Muse never started is REFUSED: with no message after it the turn fails, with one the answer stands', async () => {
		// ⛔ THE MUTANTS: such a call dropped; such a call read as sent, so the host's calls and the record's no longer match.
		const rejected =
			(answerAfter: boolean): Script =>
			async (muse) => {
				await clean(muse);
				const session = cleanSession();
				const answerAt = session.findIndex((r) =>
					JSON.stringify(r).includes('assistant_message_committed')
				);
				session.splice(
					answerAt,
					0,
					committedCalls([['call-3', 'mcp__jpwb__write_file', { path: 'b.txt', contents: 1 }]])
				);
				muse.session = answerAfter ? session : session.filter((_, k) => k !== answerAt + 1);
			};
		const stopped = await turn(await open(museExec(rejected(false))));
		expect(messageOf(stopped)).toMatch(/^CLI_ENDED_ON_REFUSAL: /);
		expect(stopped.observedToolCalls).toMatchObject({
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'run_command', outcome: 'COMPLETED' },
				{ name: 'write_file', outcome: 'REFUSED' }
			]
		});
		const answered = await turn(await open(museExec(rejected(true))));
		expect(answered.answer).toEqual({ arrived: true, text: ANSWER });
		expect(answered.observedToolCalls).toMatchObject({
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'run_command', outcome: 'COMPLETED' },
				{ name: 'write_file', outcome: 'REFUSED' }
			]
		});
	});

	it('⛔ every step’s model is read: one step served by another model fails the turn CLI_MODEL_SUBSTITUTED, naming both', async () => {
		// ⛔ THE MUTANT: the last step's model alone, the reviewer's defect (`devin-reviewer.ts` reads `.at(-1)`).
		const exec = museExec(async (muse) => {
			await clean(muse);
			muse.session = cleanSession().toSpliced(3, 1, modelCompleted('muse-spark-1.3'));
		});
		const result = await turn(await open(exec));
		expect(messageOf(result)).toMatch(/^CLI_MODEL_SUBSTITUTED: /);
		expect(messageOf(result)).toContain(
			"Configured: 'muse-wonder-1.0'; reported: 'muse-spark-1.3', 'muse-wonder-1.0'."
		);
	});

	it('⛔ a model step that names no model → UNPARSEABLE: the record does not say who served it', async () => {
		// ⛔ THE MUTANT: such a step passed over, so the model that served it goes unread.
		const { dataRoot, read } = driverOver();
		writeMuseRecords(dataRoot, cleanSession().toSpliced(3, 1, modelCompleted(null)), [
			surfaceLine(2)
		]);
		expect((await read(jsonl([terminalCompleted(ANSWER)]))).read).toBe('UNPARSEABLE');
	});

	it('⭐ D23 — the reasoning summaries are volunteered reasoning; the encrypted reasoning is not', async () => {
		// ⛔ THE MUTANT: the summaries dropped, so reasoning Muse returned is recorded as none having arisen.
		const exec = museExec(clean);
		const result = await turn(await open(exec));
		expect(result.volunteeredReasoning).toBe('Summarising the two steps.');
		expect(JSON.stringify(result)).not.toContain('ENCRYPTED-REASONING');
	});
});

describe('⭐ D19, D19a, D24 — Muse’s errors', () => {
	it('⛔ a run.terminal.failed reason is the excerpt of a CLI_ERROR', async () => {
		// ⛔ THE MUTANT: the failed terminal passed over, so the turn fails with no word of why.
		const exec = museExec(async (muse) => {
			await clean(muse);
			muse.out = [terminalFailed('provider stream failed after 10 attempts')];
			return { exitCode: 1 };
		});
		const result = await turn(await open(exec));
		expect(messageOf(result)).toMatch(/^CLI_ERROR: /);
		expect(messageOf(result)).toContain(
			'The CLI reported: “provider stream failed after 10 attempts”'
		);
	});

	it.each([
		[
			'a run.terminal.failed whose reason is not text',
			() => terminalFailed({ code: 'provider' }),
			'run.terminal.failed'
		],
		[
			'a run.terminal.cancelled',
			() => terminalCancelled('cancelled before the model answered'),
			'cancelled before the model answered'
		]
	])(
		'⛔ %s, at exit 0, is a CLI_ERROR, never a turn that ended without an answer',
		async (_, terminal, said) => {
			// ⛔ THE MUTANTS: a reason that is not text read as no error; a cancelled run read as no error. Either way the turn
			// would be ENDED_WITHOUT_ANSWER, a shortfall of the producer's, where Muse reported an error (D19; REG-F-410).
			const exec = museExec(async (muse) => {
				await clean(muse);
				muse.out = [terminal()];
			});
			const result = await turn(await open(exec));
			expect(messageOf(result)).toMatch(/^CLI_ERROR: /);
			expect(messageOf(result)).toContain(`The CLI reported: “${said}”`);
		}
	);

	it('⛔ Muse’s known error lines are excerpts; the workspace-root line it writes on every run never is', async () => {
		// ⛔ THE MUTANTS: the first line taken whatever its shape — the workspace root, which the opener then withholds, and
		// a clean turn fails as an error; the run-ended line not known, so a failure Muse explained says nothing.
		const driver = museExecutorDriver(host());
		const refusal =
			'muse: -c mcpServers.jpwb: refusing run: unknown key: no such setting (see `--help` for the -c/--config shape)';
		const ended =
			'run ended with Failed: invalid run configuration: Required MCP server `jpwb` failed during startup: the transport closed unexpectedly.';
		expect(driver.classifyStderr(['muse: workspace root: here (cwd default)', refusal])).toEqual({
			errorExcerpt: refusal
		});
		expect(driver.classifyStderr(['muse: workspace root: here (cwd default)', ended])).toEqual({
			errorExcerpt: ended
		});
		expect(
			driver.classifyStderr([
				'muse: workspace root: here (cwd default)',
				'muse: Agent delegation: auto unavailable: workspace is untrusted.'
			])
		).toEqual({});
		const result = await turn(await open(museExec(clean)));
		expect(result.answer).toEqual({ arrived: true, text: ANSWER });
	});
});
