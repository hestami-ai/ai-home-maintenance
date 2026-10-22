// ⭐⭐ `REG-F-501` — A CONNECTION LEFT IDLE PAST NODE'S CLOSE, THEN SENT ON: RESET BY NODE'S DEFAULTS, ANSWERED BY A
// SERVER BOOTED THROUGH `keepHarnessConnectionsOpen`, THE FUNCTION THE HARNESS'S VITE PLUGIN CALLS.
//
// ── THE MECHANISM, AS THE REGISTER RECORDS IT ──────────────────────────────────────────────────────────────────
// Node closes an idle keep-alive connection `keepAliveTimeout` + `keepAliveTimeoutBuffer` after its last response
// (5,000 + 1,000 ms by default; the register measured 6001 to 6015 ms), and the resets it timed went out on a pooled
// connection idle for about that long, at that close.
//
// ── THE ARRANGEMENT ────────────────────────────────────────────────────────────────────────────────────────────
// The client is Node's own keep-alive agent, on a worker thread. From the turn after its first answers to its second
// requests the thread is held still (`Atomics.wait`), so it reads nothing: the server's close is still unread when the
// second request goes out on the pooled connection, and a request written on a connection the server has closed is
// reset. The servers stay on this thread, so they close on time. ⚠ An agent whose loop runs through the idle reads the
// close and opens a new connection instead, which is answered: that run would show nothing either way.
//
// Two servers side by side, one through the function and one left with Node's defaults — the CONTROL, which proves the
// arrangement reproduces the reset. Both second requests go out together, at least 6.5 s after the first answers and
// once the control's server has closed its connection (20 s later at most, when it has not, and the control then
// fails): the harness server's connection has idled past the close Node's defaults make, in the same run.
import { createServer, type RequestListener, type Server } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { Worker } from 'node:worker_threads';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keepHarnessConnectionsOpen } from './harness-keep-alive.js';

/** The least time from the first answers to the second requests: past Node's default close, measured at 6001 to 6015 ms. */
const IDLE_MS = 6_500;
/** The longest the client then waits for the control's server to close its connection, should a loaded host close it late. */
const LATE_CLOSE_MS = 20_000;

/** The client: plain JavaScript on its own thread, so its loop can be held while this thread's runs. */
const CLIENT = `
const { Agent, get } = require('node:http');
const { parentPort, workerData } = require('node:worker_threads');
const { ports, idleMs, lateCloseMs, controlClosed } = workerData;
const agents = ports.map(() => new Agent({ keepAlive: true, maxSockets: 1 }));
const send = (i, path) =>
	new Promise((resolve) => {
		const req = get({ host: '127.0.0.1', port: ports[i], path, agent: agents[i] }, (res) => {
			res.resume();
			res.on('end', () => resolve({ answered: res.statusCode, sameConnection: req.reusedSocket }));
		});
		req.on('error', (e) => resolve({ error: e.message, sameConnection: req.reusedSocket }));
	});
(async () => {
	await Promise.all(ports.map((_, i) => send(i, '/first')));
	const answeredAt = Date.now();
	await new Promise((resolve) => setImmediate(resolve));
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, answeredAt + idleMs - Date.now()));
	Atomics.wait(new Int32Array(controlClosed), 0, 0, lateCloseMs);
	const second = await Promise.all(ports.map((_, i) => send(i, '/second')));
	parentPort.postMessage({ answeredAt, sentAt: Date.now(), second });
	for (const agent of agents) agent.destroy();
})();
`;

interface Outcome {
	readonly answered?: number;
	readonly error?: string;
	readonly sameConnection: boolean;
}

const servers: Server[] = [];
let harness: Outcome;
let control: Outcome;
let idledMs = 0;
let controlClosedAfterMs: number | undefined;

async function listening(server: Server): Promise<number> {
	servers.push(server);
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	return (server.address() as AddressInfo).port;
}

beforeAll(
	async () => {
		const answer: RequestListener = (_req, res) => {
			res.end('answered');
		};
		const harnessServer = createServer(answer);
		keepHarnessConnectionsOpen(harnessServer);
		const controlServer = createServer(answer);
		const controlClosed = new SharedArrayBuffer(4);
		let closedAt: number | undefined;
		controlServer.on('connection', (socket) =>
			socket.once('close', () => {
				closedAt ??= Date.now();
				Atomics.store(new Int32Array(controlClosed), 0, 1);
				Atomics.notify(new Int32Array(controlClosed), 0);
			})
		);
		const ports = [await listening(harnessServer), await listening(controlServer)];
		const client = new Worker(CLIENT, {
			eval: true,
			workerData: { ports, idleMs: IDLE_MS, lateCloseMs: LATE_CLOSE_MS, controlClosed }
		});
		try {
			const [result] = (await once(client, 'message')) as [
				{ answeredAt: number; sentAt: number; second: [Outcome, Outcome] }
			];
			[harness, control] = result.second;
			idledMs = result.sentAt - result.answeredAt;
			controlClosedAfterMs = closedAt === undefined ? undefined : closedAt - result.answeredAt;
		} finally {
			await client.terminate();
		}
	},
	IDLE_MS + LATE_CLOSE_MS + 30_000
);

afterAll(() => {
	for (const server of servers) {
		server.closeAllConnections();
		server.close();
	}
});

describe('⭐⭐ REG-F-501 — a pooled connection idle past Node’s close, its close unread, then sent on', () => {
	it('⭐ the server booted through keepHarnessConnectionsOpen answers it, on the same connection', () => {
		expect(
			harness,
			`a request sent ${idledMs} ms after the last answer, on the connection that answer rode, is reset unless the ` +
				'server keeps that connection open (REG-F-501)'
		).toEqual({ answered: 200, sameConnection: true });
	});

	it('⛔ CONTROL — with Node’s defaults, the request sent on that connection is reset', () => {
		// ⚠ Without this, the test above would pass in an arrangement that never reached Node's close at all.
		expect(
			control,
			`the control's server closed its connection ${controlClosedAfterMs ?? 'never'} ms after the last answer; the ` +
				`request went out ${idledMs} ms after it`
		).toEqual({ error: 'read ECONNRESET', sameConnection: true });
	});
});
