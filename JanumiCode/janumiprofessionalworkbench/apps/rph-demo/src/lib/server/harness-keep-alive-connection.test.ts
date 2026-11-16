// ⭐⭐ `REG-F-501` — A CONNECTION LEFT IDLE PAST NODE'S CLOSE, THEN SENT ON: ~~RESET BY NODE'S DEFAULTS~~ ⭐ NOT RIDDEN BY NODE'S
// DEFAULTS (RESET BEFORE ~~v24.22.3~~ ⭐ v24.22.1 — AND v22.23.4, v26.12.1 ON THEIR LINES, `REG-D-165`; DROPPED FOR A NEW CONNECTION SINCE,
// `REG-F-639`), ANSWERED BY A SERVER BOOTED THROUGH
// `keepHarnessConnectionsOpen`, THE FUNCTION THE HARNESS'S VITE PLUGIN CALLS.
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
//
// ── ⭐⭐ `JAN-EXEC` Phase 7, package L15 — `REG-F-639` (2026-11-13): UNDER NODE v24.22.3 THE AGENT'S PENDING-READ CHECK DECIDES ─────
// Node v24.22.3's agent checks each pooled socket for data pending in the OS buffer before it hands it to a request, and destroys one the
// server's close has reached (`_http_agent`'s `hasPendingRead`: *"PENDING DATA on FREE socket - destroying poisoned socket"*; *"Data that
// reached the OS socket buffer after the last poll has not been seen by it yet, so check for it directly before handing an idle socket to a
// request."*). So the pending-read check, not the held loop, decides what the second request rides: with Node's defaults it no longer goes
// out on the closed connection to be reset — the agent drops it and opens a NEW one, which is answered. The hold is kept: harmless here, and
// on an earlier Node (v24.11.1) it is what made the reset reproducible. The CONTROL therefore asserts what this runtime shows: the control's
// server closed the connection BEFORE the request went out, and the request rode a new connection. The harness's request still rides the
// same one, so the test above it still tells the remedy from Node's defaults, by the connection.
//
// ── ⭐⭐ `REG-D-161` (the lead's proposal, measured 2026-11-15): ONE CONTROL FOR EVERY SUPPORTED NODE ──────────────────────────────
// The pending-read check came in Node 24.22.1, 22.23.4 and 26.12.1 (CVE-2026-105481, *"http: ensure agent data guard works without
// I/O"*); before it, the same arrangement resets the control's request on the connection the close reached. So the CONTROL asserts, on
// whichever Node runs it: the control's server closed the connection BEFORE the requests went out; the connection was STILL in its
// agent's pool as they did (its client had not read the close: what the held loop is for); and the request got the outcome this Node
// gives, by its release line (`PENDING_READ_CHECK_SINCE`): reset on that connection before the check, answered on a new one from it.
// A line not in the table is not measured, and the CONTROL refuses to guess its outcome.
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

/**
 * The client: plain JavaScript on its own thread, so its loop can be held while this thread's runs.
 * ⭐⭐ (2026-11-13, package L15, `REG-F-639`; the lead's correction) It stamps `sendingAt` as the second requests go out, beside `sentAt`, which
 * it stamps only once BOTH are answered: the CONTROL's close is held against the send, not the answers.
 */
const CLIENT = `
const { Agent, get } = require('node:http');
const { parentPort, workerData } = require('node:worker_threads');
const { ports, idleMs, lateCloseMs, controlClosed } = workerData;
const agents = ports.map(() => new Agent({ keepAlive: true, maxSockets: 1 }));
const firstSockets = [];
const send = (i, path) =>
	new Promise((resolve) => {
		const req = get({ host: '127.0.0.1', port: ports[i], path, agent: agents[i] }, (res) => {
			res.resume();
			res.on('end', () => resolve({ answered: res.statusCode, sameConnection: req.reusedSocket }));
		});
		if (path === '/first') req.once('socket', (socket) => { firstSockets[i] = socket; });
		req.on('error', (e) => resolve({ error: e.message, sameConnection: req.reusedSocket }));
	});
(async () => {
	await Promise.all(ports.map((_, i) => send(i, '/first')));
	const answeredAt = Date.now();
	await new Promise((resolve) => setImmediate(resolve));
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, answeredAt + idleMs - Date.now()));
	Atomics.wait(new Int32Array(controlClosed), 0, 0, lateCloseMs);
	const pooledAtTheSend = agents.map((agent, i) => Object.values(agent.freeSockets).some((free) => free.includes(firstSockets[i])));
	const sendingAt = Date.now();
	const second = await Promise.all(ports.map((_, i) => send(i, '/second')));
	parentPort.postMessage({ answeredAt, sendingAt, sentAt: Date.now(), second, pooledAtTheSend });
	for (const agent of agents) agent.destroy();
})();
`;

interface Outcome {
	readonly answered?: number;
	readonly error?: string;
	readonly sameConnection: boolean;
}

/**
 * ⭐⭐ (`REG-D-161`; the lead's proposal, measured 2026-11-15) Each supported release line's first release with the keep-alive agent's
 * pending-read check, measured on both sides of it. Before it, Node hands the control's request the pooled connection its server has
 * closed, and the request is reset there; from it, the agent drops that connection and the request is answered on a new one.
 */
const PENDING_READ_CHECK_SINCE: Readonly<Record<string, string>> = { '22': '22.23.4', '24': '24.22.1', '26': '26.12.1' };

function atLeast(version: string, since: string): boolean {
	const have = version.split('.').map(Number);
	const want = since.split('.').map(Number);
	for (let i = 0; i < 3; i++) if (have[i] !== want[i]) return have[i] > want[i];
	return true;
}

/** The control's outcome with Node's defaults on this Node, by `PENDING_READ_CHECK_SINCE`; `undefined` on a line not measured. */
function outcomeWithNodesDefaults(version: string = process.versions.node): Outcome | undefined {
	const since = PENDING_READ_CHECK_SINCE[version.split('.')[0]];
	if (since === undefined) return undefined;
	return atLeast(version, since)
		? { answered: 200, sameConnection: false }
		: { error: 'read ECONNRESET', sameConnection: true };
}

const servers: Server[] = [];
let harness: Outcome;
let control: Outcome;
/** ⭐⭐ (package L15) From the first answers to the moment the second requests went out — the client's send stamp, `sendingAt`. */
let idledMs = 0;
let controlClosedAfterMs: number | undefined;
/** ⭐⭐ (`REG-D-161`) Whether the control's connection was still in its agent's pool as the second requests went out (the client's check). */
let controlPooledAtTheSend: boolean | undefined;

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
				{ answeredAt: number; sendingAt: number; sentAt: number; second: [Outcome, Outcome]; pooledAtTheSend: [boolean, boolean] }
			];
			[harness, control] = result.second;
			controlPooledAtTheSend = result.pooledAtTheSend[1];
			// ⭐⭐ (2026-11-13, package L15, `REG-F-639`; the lead's correction, the builder's call) ~~`result.sentAt`~~ — stamped once BOTH
			// second requests were answered — ⭐ `result.sendingAt`, stamped as they went out: the idle both messages below name ("a request sent
			// … ms after", "the request went out … ms after it"), and the moment the CONTROL's close is held against.
			idledMs = result.sendingAt - result.answeredAt;
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
		// ⭐⭐ (2026-11-13, package L15, `REG-F-639`) its expectation unchanged; its message's ~~"is reset unless the server keeps that
		// connection open"~~ restated to what Node v24.22.3 does with such a connection: it drops it for a new one (P6K-M1's mutation, the
		// lead's probe's `harness-5000` row: `{ answered: 200, sameConnection: false }`).
		// ⭐⭐ (2026-11-16, package L17a — design D83, `REG-D-165`) its title and expectation byte for byte; its message's ~~"before Node v24.22.3"~~
		// said as the measured boundary, the release that brought the agent's pending-read check on each line (`control-facts.md` §5).
		expect(
			harness,
			`a request sent ${idledMs} ms after the last answer rides the connection that answer rode only if the server keeps ` +
				'that connection open (REG-F-501): with Node’s defaults it was reset before Node v24.22.1 (v22.23.4, v26.12.1 on their lines), and rides a new connection since (REG-F-639; REG-D-165)'
		).toEqual({ answered: 200, sameConnection: true });
	});

	// ⭐⭐ RESTATED 2026-11-13 (`JAN-EXEC` Phase 7, package L15 — `REG-F-639`, the lead's ruling): ~~'⛔ CONTROL — with Node’s defaults, the
	// request sent on that connection is reset'~~, ~~`.toEqual({ error: 'read ECONNRESET', sameConnection: true })`~~ — before Node ~~v24.22.3's~~
	// ⭐ v24.22.1's (v22.23.4's, v26.12.1's on their lines; `REG-D-165`, design D83) pending-read check (Node v24.11.1), the same arrangement gave
	// `{ error: 'read ECONNRESET', sameConnection: true }`. Under Node v24.22.3
	// the agent drops the connection the close reached, and the request rides a new one (the header's note). The promise kept: the
	// arrangement reaches Node's close — the control's server closed the connection BEFORE the requests went out (the send stamp).
	// ⭐⭐ RESTATED 2026-11-15 (`REG-D-161`, the lead's proposal): ~~'… and the request rides a NEW connection (REG-F-639)'~~ — that outcome
	// is Node's from its pending-read check on (24.22.1, 22.23.4, 26.12.1); before it the request is reset. The close before the send kept;
	// the pool at the send added; and the outcome this Node gives, by its release line.
	it('⛔ CONTROL — with Node’s defaults, the server closes that connection before the request goes out, while it is still pooled, and the request gets the outcome this Node gives (REG-F-639, REG-D-161)', () => {
		// ⚠ Without this, the test above would pass in an arrangement that never reached Node's close at all.
		const closedBeforeTheSend = controlClosedAfterMs !== undefined && controlClosedAfterMs < idledMs;
		expect(
			closedBeforeTheSend,
			`the control's server closed its connection ${controlClosedAfterMs ?? 'never'} ms after the last answer; the ` +
				`request went out ${idledMs} ms after it`
		).toBe(true);
		expect(
			controlPooledAtTheSend,
			"the control's connection was not in its agent's pool when the request went out: its client had read the server's close"
		).toBe(true);
		const expected = outcomeWithNodesDefaults();
		expect(
			expected,
			`Node ${process.version}: its release line is not in PENDING_READ_CHECK_SINCE, so its outcome is not measured; measure it, then add its row`
		).toBeDefined();
		expect(control, `with Node’s defaults, on Node ${process.version}`).toEqual(expected);
	});
});
