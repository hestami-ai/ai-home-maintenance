// ⭐⭐ `JAN-MHX` MH-1 — the victim for THE BRIDGE (`DESIGN-multi-harness-executor.md` D10, D11, D41; roadmap B1–B3, and
// B5, which the check of MH-1 added). B4, the pin of its bytes, is `host-tool-bridge-pin.test.ts`'s, so that a mutant of
// the bridge's behaviour is killed here by what it does, never by its changed bytes alone.
//
// ⭑ THE BRIDGE IS SPAWNED AS A REAL CHILD, by this runtime's own executable (and, in B5, by bun where this host has it),
// exactly as a CLI's MCP entry starts it, and it relays to a real host tool server over loopback. ⚠ Every directory is
// under `os.tmpdir()`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInMemoryWorkspace, createRefusingProcessRunner } from '@janumipwb/rph-ports';
import { mintExecutionTools } from './execution-tool-surface.js';
import { writeBridge } from './host-tool-bridge.js';
import { startHostToolServer, type HostToolServer } from './host-tool-server.js';
import { createToolCallObserver } from './tool-call-observer.js';

let dir = '';
let server: HostToolServer | undefined;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'jpwb-bridge-'));
});
afterEach(async () => {
	await server?.close();
	server = undefined;
	await rm(dir, { recursive: true, force: true });
});

/** A server serving write_file, an open turn, and the endpoint file the bridge reads. */
async function arranged(): Promise<{ bridge: string; endpoint: string; token: string }> {
	const tools = mintExecutionTools({
		ports: {
			workspace: createInMemoryWorkspace({
				ownerKind: 'UNDERTAKING',
				ownerId: 'und_bridge_test',
				purgeability: 'RETAINED_BY_PARTICIPATION'
			}),
			runner: createRefusingProcessRunner()
		},
		grantedCapabilities: ['file-system'],
		bindingAuthorizationStatus: 'AUTHORIZED'
	});
	server = await startHostToolServer({ tools, observer: createToolCallObserver() });
	const token = server.openTurn();
	const endpoint = join(dir, 'endpoint.json');
	writeFileSync(endpoint, JSON.stringify({ url: server.url, token }), 'utf8');
	return { bridge: await writeBridge(dir), endpoint, token };
}

/** A plain listener on 127.0.0.1 that hands each request to `onRequest`. */
async function listener(onRequest: Parameters<typeof createServer>[1]): Promise<{ listening: Server; port: number }> {
	const listening = createServer(onRequest);
	await new Promise<void>((resolve) => listening.listen(0, '127.0.0.1', () => resolve()));
	return { listening, port: (listening.address() as AddressInfo).port };
}

function closeListener(listening: Server): void {
	listening.closeAllConnections();
	listening.close();
}

/**
 * Run the bridge over `lines`, closing its stdin once `replies` replies are in (at once for 0), or `closeAfterMs` after
 * the last line is written; kill it if it has not exited 3 s after stdin closed; and report what it did.
 */
function relay(
	bridge: string,
	endpoint: string,
	lines: readonly string[],
	replies: number,
	options: { runtime?: string; env?: NodeJS.ProcessEnv; closeAfterMs?: number } = {}
): Promise<{ stdout: string; stderr: string; exitedAfterStdinClosedMs: number }> {
	return new Promise((resolve, reject) => {
		const child = spawn(options.runtime ?? process.execPath, [bridge, endpoint], {
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true,
			...(options.env === undefined ? {} : { env: options.env })
		});
		let stdout = '';
		let stderr = '';
		let closedAt = 0;
		let giveUp: ReturnType<typeof setTimeout> | undefined;
		const closeStdin = (): void => {
			if (closedAt !== 0) return;
			closedAt = Date.now();
			child.stdin.end();
			giveUp = setTimeout(() => child.kill(), 3_000);
		};
		child.stdout.on('data', (c: Buffer) => {
			stdout += c.toString('utf8');
			if (options.closeAfterMs === undefined && stdout.split('\n').length - 1 >= replies) closeStdin();
		});
		child.stderr.on('data', (c: Buffer) => (stderr += c.toString('utf8')));
		child.on('error', reject);
		child.on('exit', () => {
			clearTimeout(giveUp);
			resolve({ stdout, stderr, exitedAfterStdinClosedMs: Date.now() - closedAt });
		});
		for (const line of lines) child.stdin.write(`${line}\n`);
		if (options.closeAfterMs !== undefined) setTimeout(closeStdin, options.closeAfterMs);
		else if (replies === 0) closeStdin();
	});
}

/** A bun binary, by absolute path, if this host has one. ⭑ Found once, by asking bun itself where it is. */
const BUN: string | undefined = (() => {
	if (process.versions.bun !== undefined) return process.execPath;
	const found = spawnSync('bun', ['-e', 'process.stdout.write(process.execPath)'], {
		encoding: 'utf8',
		windowsHide: true
	});
	return found.status === 0 && found.stdout !== '' ? found.stdout : undefined;
})();

describe('⭐ D10 — the bridge relays newline-delimited JSON-RPC to the host’s server', () => {
	it('B1 — a request line is relayed and its reply written as one line; a notification writes nothing', async () => {
		// ⛔ THE MUTANT: write a blank line for a notification. A CLI reading one reply per line would read garbage.
		const { bridge, endpoint } = await arranged();
		const out = await relay(
			bridge,
			endpoint,
			[
				'{"jsonrpc":"2.0","id":1,"method":"ping"}',
				'{"jsonrpc":"2.0","method":"notifications/initialized"}',
				'{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
			],
			2
		);
		const lines = out.stdout.split('\n');
		expect(lines.at(-1), 'the last reply ends its line').toBe('');
		expect(lines.slice(0, -1).map((l) => JSON.parse(l) as { id: number })).toEqual([
			{ jsonrpc: '2.0', id: 1, result: {} },
			expect.objectContaining({ jsonrpc: '2.0', id: 2 })
		]);
		expect(lines).toHaveLength(3);
	});

	it('B1 — a CLI that closes its stdin right after its last request still gets the reply', async () => {
		// ⛔ THE MUTANT: exit the moment stdin closes. A request already relayed would then be answered to no one.
		const { bridge, endpoint } = await arranged();
		const out = await relay(bridge, endpoint, ['{"jsonrpc":"2.0","id":7,"method":"ping"}'], 0);
		expect(out.stdout).toBe('{"jsonrpc":"2.0","id":7,"result":{}}\n');
	});

	it('B2 — the token is in no stdout line and no stderr byte of the bridge', async () => {
		// ⛔ THE MUTANT: print the endpoint at start. ⭑ The argv a bridge runs with is not the bridge's to choose: it is the
		// driver's MCP entry, built from the run folder's paths, and `cli-executor-session.test.ts` holds it to the token's
		// absence (C2: no file under `cli/`, where the entry is written, holds the token; C5: no argv element of the CLI).
		const { bridge, endpoint, token } = await arranged();
		const out = await relay(
			bridge,
			endpoint,
			[
				'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}',
				'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"write_file","arguments":{"path":"a.txt","contents":"x"}}}'
			],
			2
		);
		expect(readFileSync(endpoint, 'utf8'), 'arrangement: the endpoint file holds the token').toContain(token);
		expect(out.stdout.includes(token)).toBe(false);
		expect(out.stderr).toBe('');
	});

	it('B3 — the bridge exits within a second of its stdin closing', async () => {
		// ⛔ THE MUTANT: keep going after stdin closes. A bridge that lingers outlives the CLI that started it.
		const { bridge, endpoint } = await arranged();
		const out = await relay(bridge, endpoint, ['{"jsonrpc":"2.0","id":1,"method":"ping"}'], 1);
		expect(out.exitedAfterStdinClosedMs).toBeLessThan(1000);
	});

	it('B3 — with the host holding its reply, the bridge still exits within a second of its stdin closing', async () => {
		// ⛔ THE MUTANT: delete only the half-second bound. The case above closes stdin after the reply is in, so the relay
		// has settled and the bridge leaves without the bound; here only the bound can end it.
		const { listening, port } = await listener((request) => request.resume());
		try {
			const endpoint = join(dir, 'endpoint.json');
			writeFileSync(endpoint, JSON.stringify({ url: `http://127.0.0.1:${port}/`, token: 'f'.repeat(64) }), 'utf8');
			const out = await relay(await writeBridge(dir), endpoint, ['{"jsonrpc":"2.0","id":1,"method":"ping"}'], 1, {
				closeAfterMs: 200
			});
			expect(out.stdout, 'arrangement: the host never answered').toBe('');
			expect(out.exitedAfterStdinClosedMs).toBeLessThan(1000);
		} finally {
			closeListener(listening);
		}
	});
});

describe('⭐ D41 — the turn’s token reaches the host’s server and nowhere else', () => {
	const runtimes: [string, string][] = [['node', process.execPath]];
	if (BUN !== undefined) runtimes.push(['bun', BUN]);

	it.each(runtimes)(
		'B5 — under %s, with every proxy variable planted, the request reaches the host and a decoy proxy receives nothing',
		async (_, runtime) => {
			// ⛔ THE MUTANT: post with `node:http`, whose client bun routes through `HTTP_PROXY`, and node too under
			// `NODE_USE_ENV_PROXY=1`. A CLI may put any proxy in its MCP server's environment, and the decoy would then
			// receive the turn's bearer token.
			const seen: string[] = [];
			const decoy = await listener((request, response) => {
				const authorization = request.headers.authorization === undefined ? 'absent' : 'present';
				seen.push(`${request.method} ${request.url} authorization=${authorization}`);
				request.resume();
				request.on('end', () => response.writeHead(502).end());
			});
			try {
				const proxy = `http://127.0.0.1:${decoy.port}`;
				const planted = {
					HTTP_PROXY: proxy,
					http_proxy: proxy,
					HTTPS_PROXY: proxy,
					https_proxy: proxy,
					ALL_PROXY: proxy,
					all_proxy: proxy,
					NODE_USE_ENV_PROXY: '1',
					NO_PROXY: '',
					no_proxy: ''
				};
				const { bridge, endpoint } = await arranged();
				const out = await relay(bridge, endpoint, ['{"jsonrpc":"2.0","id":1,"method":"ping"}'], 1, {
					runtime,
					env: { ...process.env, ...planted }
				});
				expect(seen, 'the decoy proxy received the bridge’s request').toEqual([]);
				expect(out.stdout).toBe('{"jsonrpc":"2.0","id":1,"result":{}}\n');
			} finally {
				closeListener(decoy.listening);
			}
		}
	);
});
