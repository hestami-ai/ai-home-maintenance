// ⭐⭐ `JAN-MHX` MH-1 — the victim for THE HOST TOOL SERVER (`DESIGN-multi-harness-executor.md` D1–D9; roadmap S1–S14).
//
// ⭑ EVERY CASE CALLS THE REAL SERVER OVER LOOPBACK, over a temporary FILESYSTEM workspace and the recording runner the
// tool-surface tests use: what is asserted is what a CLI's bridge would be answered, and what the host observed.
// ⚠ Every directory is under `os.tmpdir()`, never under the repository.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Agent, request } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProcessRunOutcome, ProcessRunRequest, ProcessRunner } from '@janumipwb/rph-ports';
import { toPiToolResult } from '../agent/pi-tool-result.js';
import { executorKeyOf } from '../replay/replay-executor.js';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import { mintExecutionTools } from './execution-tool-surface.js';
import { governedToolCallReport } from './observed-tool-calls.js';
import { createProcessRunObserver } from './process-run-observer.js';
import { createToolCallObserver } from './tool-call-observer.js';
import { GATE_REFUSED_STATUS, startHostToolServer, type HostToolServer } from './host-tool-server.js';

let container = '';
let dir = '';
const servers: HostToolServer[] = [];

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-host-server-'));
	dir = join(container, 'workspace');
	await mkdir(dir, { recursive: true });
});
afterEach(async () => {
	await Promise.all(servers.splice(0).map((s) => s.close()));
	await rm(container, { recursive: true, force: true });
});

const workspace = () =>
	createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
		purgeability: 'RETAINED_BY_PARTICIPATION',
		directoryPath: dir
	});

/** The tool-surface tests' stub: records what it is asked to run and answers without spawning. */
function recordingRunner(
	over: Partial<Extract<ProcessRunOutcome, { ran: true }>> = {},
	hold?: (request: ProcessRunRequest) => Promise<void>
): ProcessRunner & { seen: ProcessRunRequest[]; events: string[] } {
	const seen: ProcessRunRequest[] = [];
	const events: string[] = [];
	return {
		kind: 'REAL',
		seen,
		events,
		run: async (request) => {
			seen.push(request);
			events.push(`start ${request.argv.join(' ')}`);
			await hold?.(request);
			events.push(`end ${request.argv.join(' ')}`);
			return {
				ran: true,
				exitCode: 0,
				timedOut: false,
				stdout: 'ok\n',
				stderr: '',
				omittedRegions: [],
				outputComplete: true,
				retention: { retained: false, notRetainedBecause: 'stub runner retains nothing' },
				durationMs: 1,
				...over
			};
		}
	};
}

async function serve(granted: readonly string[], runner: ProcessRunner = recordingRunner()) {
	const processRuns = createProcessRunObserver();
	const tools = mintExecutionTools({
		ports: { workspace: workspace(), runner, processRuns },
		grantedCapabilities: granted,
		bindingAuthorizationStatus: 'AUTHORIZED'
	});
	const observer = createToolCallObserver();
	const server = await startHostToolServer({ tools, observer });
	servers.push(server);
	return { server, observer, tools, processRuns };
}

interface Sent {
	readonly status: number;
	readonly body: { result?: { content?: { type: string; text: string }[]; isError?: boolean; tools?: unknown[] }; error?: unknown } | undefined;
	readonly reused: boolean;
}

/** One POST, as a bridge would send it. */
function post(
	server: HostToolServer,
	message: unknown,
	options: { token?: string; host?: string; origin?: string; agent?: Agent; method?: string } = {}
): Promise<Sent> {
	return new Promise((resolve, reject) => {
		// ⚠ A GET carries no body and declares none: one that declared a length it never sent would hang a server that
		// read it, and a test of the GET refusal would time out rather than fail (found by its mutant, MH1-M19).
		const body = options.method === 'GET' ? undefined : Buffer.from(JSON.stringify(message), 'utf8');
		const headers: Record<string, string | number> = {
			'content-type': 'application/json',
			...(body === undefined ? {} : { 'content-length': body.length }),
			host: options.host ?? `127.0.0.1:${server.port}`
		};
		if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
		if (options.origin !== undefined) headers.origin = options.origin;
		const req = request(
			{ host: '127.0.0.1', port: server.port, path: '/', method: options.method ?? 'POST', headers, agent: options.agent },
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (c: Buffer) => chunks.push(c));
				res.on('end', () => {
					const text = Buffer.concat(chunks).toString('utf8');
					resolve({ status: res.statusCode ?? 0, body: text === '' ? undefined : JSON.parse(text), reused: req.reusedSocket });
				});
			}
		);
		req.on('error', reject);
		req.end(body);
	});
}

let ids = 0;
const callOf = (name: string, args: unknown) => ({
	jsonrpc: '2.0',
	id: ++ids,
	method: 'tools/call',
	params: { name, arguments: args }
});

/** Wait until `test` holds, or fail naming what was awaited. */
async function until(test: () => boolean, what: string): Promise<void> {
	for (let i = 0; i < 200; i++) {
		if (test()) return;
		await new Promise((r) => setTimeout(r, 10));
	}
	throw new Error(`timed out waiting for: ${what}`);
}

const deferred = () => {
	let release!: () => void;
	const gate = new Promise<void>((r) => (release = r));
	return { gate, release };
};

describe('⭐ D3 — the server serves exactly the minted tools', () => {
	it('S1 — `tools/list` under a grant of [file-system] names only write_file', async () => {
		// ⛔ THE MUTANT: list `EXECUTION_TOOL_CATALOG`. The model would then be told of `run_command`, which the grant
		// withheld — grant by absence undone at the one place a CLI learns its tools.
		const { server } = await serve(['file-system']);
		const token = server.openTurn();
		const listed = await post(server, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { token });
		expect(listed.status).toBe(200);
		expect((listed.body?.result?.tools as { name: string }[]).map((t) => t.name)).toEqual(['write_file']);
	});

	it('S2 — a `run_command` call under that grant is refused, runs nothing, and is observed FAILED, graded NOT_MINTED', async () => {
		const runner = recordingRunner();
		const { server, observer } = await serve(['file-system'], runner);
		const token = server.openTurn();
		const answered = await post(server, callOf('run_command', { argv: ['node', '--version'] }), { token });
		expect(answered.body?.result?.isError).toBe(true);
		expect(answered.body?.result?.content?.[0]?.text).toBe('Tool run_command not found');
		expect(runner.seen, 'the runner was called for a tool the grant withheld').toEqual([]);
		expect(observer.since(0)).toEqual([{ name: 'run_command', outcome: 'FAILED' }]);
		const report = governedToolCallReport({ canObserve: true, mintedToolNames: ['write_file'], calls: observer.since(0) });
		expect(report.observation === 'OBSERVED' && report.calls).toEqual([
			{ ordinal: 1, nameProvenance: 'NOT_MINTED', outcome: 'FAILED' }
		]);
	});
});

describe('⭐ D5, D6 — one call at a time, observed on arrival', () => {
	it('S3 — two concurrent calls run one after the other, and the observer lists them in arrival order', async () => {
		// ⛔ THE MUTANT: remove the queue. The second command would start while the first still runs.
		const slow = deferred();
		const runner = recordingRunner({}, async (r) => {
			if (r.argv[1] === 'first') await slow.gate;
		});
		const { server, observer } = await serve(['process-execution'], runner);
		const token = server.openTurn();
		const first = post(server, callOf('run_command', { argv: ['node', 'first'] }), { token });
		await until(() => runner.events.length === 1, 'the first call to start');
		const second = post(server, callOf('run_command', { argv: ['node', 'second'] }), { token });
		await until(() => server.transcript().length === 2, 'the second call to arrive');
		await new Promise((r) => setTimeout(r, 50));
		slow.release();
		await Promise.all([first, second]);
		expect(runner.events).toEqual(['start node first', 'end node first', 'start node second', 'end node second']);
		expect(observer.since(0)).toEqual([
			{ name: 'run_command', outcome: 'COMPLETED' },
			{ name: 'run_command', outcome: 'COMPLETED' }
		]);
	});

	it('S4 — a call that arrives while another runs is started at once; dropped when the gate closes, it never runs and is UNKNOWN', async () => {
		// ⛔ THE MUTANT: call `started` when the call leaves the queue. The queued call would vanish from the record.
		const slow = deferred();
		const runner = recordingRunner({}, async (r) => {
			if (r.argv[1] === 'first') await slow.gate;
		});
		const { server, observer } = await serve(['process-execution'], runner);
		const token = server.openTurn();
		const first = post(server, callOf('run_command', { argv: ['node', 'first'] }), { token });
		await until(() => runner.events.length === 1, 'the first call to start');
		const second = post(server, callOf('run_command', { argv: ['node', 'second'] }), { token });
		await until(() => server.transcript().length === 2, 'the second call to arrive');
		expect(observer.count(), 'the queued call was not started on arrival').toBe(2);
		const closed = server.closeTurn();
		slow.release();
		await closed;
		const [, dropped] = await Promise.all([first, second]);
		expect(dropped.status).toBe(GATE_REFUSED_STATUS);
		expect(runner.seen.map((r) => r.argv[1])).toEqual(['first']);
		expect(observer.since(0)).toEqual([
			{ name: 'run_command', outcome: 'COMPLETED' },
			{ name: 'run_command', outcome: 'UNKNOWN' }
		]);
	});
});

describe('⭐ D2, D8 — who may call', () => {
	it('S5 — a missing or wrong token gets 401, runs nothing and observes nothing', async () => {
		// ⛔ THE MUTANT: skip the token check.
		const runner = recordingRunner();
		const { server, observer } = await serve(['process-execution'], runner);
		server.openTurn();
		const none = await post(server, callOf('run_command', { argv: ['node', 'x'] }));
		const wrong = await post(server, callOf('run_command', { argv: ['node', 'x'] }), { token: 'f'.repeat(64) });
		expect([none.status, wrong.status]).toEqual([401, 401]);
		expect(runner.seen).toEqual([]);
		expect(observer.count()).toBe(0);
	});

	it('S6 — a Host that is not 127.0.0.1:<port> gets 403', async () => {
		// ⛔ THE MUTANT: skip the Host check. A page reached through DNS rebinding names its own host.
		const { server, observer } = await serve(['process-execution']);
		const token = server.openTurn();
		const rebound = await post(server, callOf('run_command', { argv: ['node', 'x'] }), { token, host: `evil.test:${server.port}` });
		const named = await post(server, callOf('run_command', { argv: ['node', 'x'] }), { token, host: `localhost:${server.port}` });
		expect([rebound.status, named.status]).toEqual([403, 403]);
		expect(observer.count()).toBe(0);
	});

	it('S6 — a request carrying an Origin gets 403', async () => {
		// ⛔ THE MUTANT: skip the Origin check. A browser sends one; no CLI's bridge does.
		const { server, observer } = await serve(['process-execution']);
		const token = server.openTurn();
		const fromAPage = await post(server, callOf('run_command', { argv: ['node', 'x'] }), { token, origin: 'http://evil.test' });
		expect(fromAPage.status).toBe(403);
		expect(observer.count()).toBe(0);
	});

	it('S7 — a call with no turn open is refused by the gate, counted, and not observed', async () => {
		// ⛔ THE MUTANT: remove the gate. With no turn open the call would meet only the token check, and answer 401.
		const runner = recordingRunner();
		const { server, observer } = await serve(['process-execution'], runner);
		const before = server.refusals();
		const outside = await post(server, callOf('run_command', { argv: ['node', 'x'] }), { token: 'f'.repeat(64) });
		expect(outside.status).toBe(GATE_REFUSED_STATUS);
		expect(server.refusals()).toBe(before + 1);
		expect(observer.count()).toBe(0);
		expect(runner.seen).toEqual([]);
	});

	it('S8 — on a connection held across the turn change, turn n’s token after turn n+1 opens meets the gate, and is counted', async () => {
		// ⛔ THE MUTANT: one token per session. A descendant of turn n's CLI would then act in turn n+1.
		const agent = new Agent({ keepAlive: true, maxSockets: 1 });
		try {
			const runner = recordingRunner();
			const { server, observer } = await serve(['process-execution'], runner);
			const turnN = server.openTurn();
			const during = await post(server, callOf('run_command', { argv: ['node', 'n'] }), { token: turnN, agent });
			expect(during.status).toBe(200);
			await server.closeTurn();
			server.openTurn();
			const before = server.refusals();
			const late = await post(server, callOf('run_command', { argv: ['node', 'late'] }), { token: turnN, agent });
			expect(late.reused, 'arrangement: the late call rode the connection held from turn n').toBe(true);
			expect(late.status).toBe(GATE_REFUSED_STATUS);
			expect(server.refusals()).toBe(before + 1);
			expect(runner.seen.map((r) => r.argv[1])).toEqual(['n']);
			expect(observer.count()).toBe(1);
		} finally {
			agent.destroy();
		}
	});

	it('S9 — on a connection opened before close(), a call sent right after close() returns meets the gate, and is counted', async () => {
		// ⛔ THE MUTANT: close the socket without closing the gate. ⚠ A FRESH connection refused with ECONNREFUSED would
		// pass for the wrong reason, so the connection is held and the status asserted.
		const agent = new Agent({ keepAlive: true, maxSockets: 1 });
		try {
			const runner = recordingRunner();
			const { server } = await serve(['process-execution'], runner);
			const token = server.openTurn();
			expect((await post(server, callOf('run_command', { argv: ['node', 'during'] }), { token, agent })).status).toBe(200);
			const before = server.refusals();
			const closing = server.close();
			const after = await post(server, callOf('run_command', { argv: ['node', 'after'] }), { token, agent });
			expect(after.reused, 'arrangement: the call rode the connection held from before close()').toBe(true);
			expect(after.status).toBe(GATE_REFUSED_STATUS);
			expect(server.refusals()).toBe(before + 1);
			expect(runner.seen.map((r) => r.argv[1])).toEqual(['during']);
			await closing;
		} finally {
			agent.destroy();
		}
	});
});

describe('⭐ D6, D7 — the observers and the result are Pi’s', () => {
	it('S10 — CONTROL: run_command through the server and the same minted tool called directly give equal process-run observations', async () => {
		// ⭑ A control: it proves the observers are Pi's, not a measure of anything new. ⛔ ITS MUTANT: the server runs the
		// tool with arguments other than the ones the CLI sent.
		const viaServer = await serve(['process-execution']);
		const token = viaServer.server.openTurn();
		await post(viaServer.server, callOf('run_command', { argv: ['node', '--version'] }), { token });
		const direct = await serve(['process-execution']);
		await direct.tools[0]!.run({ argv: ['node', '--version'] });
		const withoutOrdinal = (o: ReturnType<typeof viaServer.processRuns.observed>) =>
			o.runs.map(({ ordinal: _ordinal, ...rest }) => rest);
		expect(viaServer.processRuns.observed().runs).toHaveLength(1);
		expect(withoutOrdinal(viaServer.processRuns.observed())).toEqual(withoutOrdinal(direct.processRuns.observed()));
	});

	it('S11 — the text the CLI receives is toPiToolResult’s, and isError is true exactly when ok is false', async () => {
		// ⛔ THE MUTANT: set `isError` from the exit code. A test suite that failed is a call that COMPLETED.
		const { server, tools } = await serve(['file-system', 'process-execution'], recordingRunner({ exitCode: 1 }));
		const token = server.openTurn();
		const wrote = await post(server, callOf('write_file', { path: 'a.txt', contents: 'x' }), { token });
		const escaped = await post(server, callOf('write_file', { path: '../out.txt', contents: 'x' }), { token });
		const failedSuite = await post(server, callOf('run_command', { argv: ['node', 'test'] }), { token });
		const direct = await serve(['file-system', 'process-execution'], recordingRunner({ exitCode: 1 }));
		expect(wrote.body?.result).toEqual({
			content: toPiToolResult(await direct.tools[0]!.run({ path: 'a.txt', contents: 'x' })).content,
			isError: false
		});
		expect(escaped.body?.result?.isError).toBe(true);
		expect(failedSuite.body?.result).toEqual({
			content: toPiToolResult(await tools[1]!.run({ argv: ['node', 'test'] })).content,
			isError: false
		});
	});

	it('S12 — `ok: false` is REFUSED, a throw is FAILED, `ok: true` with exit 1 is COMPLETED', async () => {
		// ⛔ THE MUTANT: FAILED for `ok: false`, which would make the governed seam's own refusal read as a host fault.
		const throwing: ProcessRunner = {
			kind: 'REAL',
			run: async (r) => {
				if (r.argv[1] === 'throw') throw new Error(`host path ${dir} leaked`);
				return recordingRunner({ exitCode: 1 }).run(r);
			}
		};
		const { server, observer } = await serve(['file-system', 'process-execution'], throwing);
		const token = server.openTurn();
		await post(server, callOf('write_file', { path: '../out.txt', contents: 'x' }), { token });
		const thrown = await post(server, callOf('run_command', { argv: ['node', 'throw'] }), { token });
		await post(server, callOf('run_command', { argv: ['node', 'exit-1'] }), { token });
		expect(observer.since(0).map((c) => c.outcome)).toEqual(['REFUSED', 'FAILED', 'COMPLETED']);
		// ⭐ D7 — and a throw is answered with the host's fixed sentence, never the thrown message, which named a host path.
		expect(thrown.body?.result?.isError).toBe(true);
		expect(thrown.body?.result?.content?.[0]?.text).toBe(
			'The host failed to carry out this call. Nothing about the failure is reported here.'
		);
	});

	it('S13 — CONTROL: each tool’s inputSchema is `toTypeBox(parameters)` serialised, the replay’s `executorKeyOf` form', async () => {
		// ⭑ A control. ⛔ ITS MUTANT: serve the host's own parameter spec, which no provider was ever sent.
		const { server, tools } = await serve(['file-system', 'process-execution']);
		const key = executorKeyOf(tools);
		expect(server.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.inputSchema }))).toEqual(
			key.tools
		);
		expect(server.tools.map((t) => t._meta)).toEqual([
			{ 'antigravity/alwaysLoad': true },
			{ 'antigravity/alwaysLoad': true }
		]);
	});

	it('S14 — the transcript holds each call’s name, arguments and result as sent, in arrival order, and a dropped call with result null', async () => {
		// ⛔ THE MUTANT: omit the result. E-1 would then hold calls and not what the model read of them.
		const slow = deferred();
		const runner = recordingRunner({}, async (r) => {
			if (r.argv[1] === 'slow') await slow.gate;
		});
		const { server } = await serve(['file-system', 'process-execution'], runner);
		const token = server.openTurn();
		const wrote = await post(server, callOf('write_file', { path: 'a.txt', contents: 'hello' }), { token });
		const running = post(server, callOf('run_command', { argv: ['node', 'slow'] }), { token });
		await until(() => runner.events.length === 1, 'the slow call to start');
		const queued = post(server, callOf('run_command', { argv: ['node', 'queued'] }), { token });
		await until(() => server.transcript().length === 3, 'the queued call to arrive');
		const closed = server.closeTurn();
		slow.release();
		await closed;
		const ran = await running;
		await queued;
		expect(server.transcript()).toEqual([
			{ name: 'write_file', arguments: { path: 'a.txt', contents: 'hello' }, result: wrote.body?.result?.content?.[0]?.text, isError: false },
			{ name: 'run_command', arguments: { argv: ['node', 'slow'] }, result: ran.body?.result?.content?.[0]?.text, isError: false },
			{ name: 'run_command', arguments: { argv: ['node', 'queued'] }, result: null, isError: false }
		]);
		expect(existsSync(join(dir, 'a.txt'))).toBe(true);
	});
});

describe('⭐ D9 — the protocol', () => {
	it('initialize answers in the version asked when it is one this server knows, and a notification gets no body', async () => {
		const { server } = await serve(['file-system']);
		const token = server.openTurn();
		const init = await post(
			server,
			{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
			{ token }
		);
		expect(init.body?.result).toEqual({
			protocolVersion: '2025-03-26',
			capabilities: { tools: { listChanged: false } },
			serverInfo: { name: 'jpwb', version: '1.0.0' }
		});
		const note = await post(server, { jsonrpc: '2.0', method: 'notifications/initialized' }, { token });
		expect([note.status, note.body]).toEqual([202, undefined]);
	});

	it('a GET gets 405: there is no event stream', async () => {
		const { server } = await serve(['file-system']);
		const token = server.openTurn();
		expect((await post(server, {}, { token, method: 'GET' })).status).toBe(405);
	});
});
