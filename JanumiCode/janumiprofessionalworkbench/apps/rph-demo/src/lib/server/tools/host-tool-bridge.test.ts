// ⭐⭐ `JAN-MHX` MH-1 — the victim for THE BRIDGE (`DESIGN-multi-harness-executor.md` D10, D11; roadmap B1–B4).
//
// ⭑ THE BRIDGE IS SPAWNED AS A REAL CHILD, by this runtime's own executable, exactly as a CLI's MCP entry starts it, and it
// relays to a real host tool server over loopback. ⚠ Every directory is under `os.tmpdir()`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
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

/** Run the bridge over `lines`, closing its stdin after the last reply is in, and report what it did. */
function relay(
	bridge: string,
	endpoint: string,
	lines: readonly string[],
	replies: number
): Promise<{ stdout: string; stderr: string; exitedAfterStdinClosedMs: number; argv: readonly string[] }> {
	return new Promise((resolve, reject) => {
		const argv = [bridge, endpoint];
		const child = spawn(process.execPath, argv, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
		let stdout = '';
		let stderr = '';
		let closedAt = 0;
		child.stdout.on('data', (c: Buffer) => {
			stdout += c.toString('utf8');
			if (stdout.split('\n').length - 1 >= replies && closedAt === 0) {
				closedAt = Date.now();
				child.stdin.end();
			}
		});
		child.stderr.on('data', (c: Buffer) => (stderr += c.toString('utf8')));
		child.on('error', reject);
		child.on('exit', () =>
			resolve({ stdout, stderr, exitedAfterStdinClosedMs: Date.now() - closedAt, argv: [process.execPath, ...argv] })
		);
		for (const line of lines) child.stdin.write(`${line}\n`);
		if (replies === 0) {
			closedAt = Date.now();
			child.stdin.end();
		}
	});
}

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

	it('B2 — the token is in no argv element, no stdout line and no stderr byte of the bridge', async () => {
		// ⛔ THE MUTANT: print the endpoint at start.
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
		expect(out.argv.some((a) => a.includes(token))).toBe(false);
		expect(out.stdout.includes(token)).toBe(false);
		expect(out.stderr).toBe('');
	});

	it('B3 — the bridge exits within a second of its stdin closing', async () => {
		// ⛔ THE MUTANT: keep going after stdin closes. A bridge that lingers outlives the CLI that started it.
		const { bridge, endpoint } = await arranged();
		const out = await relay(bridge, endpoint, ['{"jsonrpc":"2.0","id":1,"method":"ping"}'], 1);
		expect(out.exitedAfterStdinClosedMs).toBeLessThan(1000);
	});
});

describe('⭐ D11 — the bridge is a pinned constant', () => {
	it('B4 — the bytes writeBridge writes are pinned by hash', async () => {
		// ⭑ As `DEVIN_REVIEWER_PREAMBLE`'s are pinned: a change to them is a change to what every CLI runs, and must be one a
		// reviewer sees here. ⛔ THE MUTANT: any byte of the source changed.
		const written = readFileSync(await writeBridge(dir));
		expect(createHash('sha256').update(written).digest('hex')).toBe(
			'7555ce1ef5fbbde7a5751d6f45d35dc9d03d4ecdbc282fb225c8961cd0d3499a'
		);
	});
});
