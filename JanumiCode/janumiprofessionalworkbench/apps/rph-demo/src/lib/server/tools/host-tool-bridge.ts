// ⭐⭐ `JAN-MHX` MH-1 (`DESIGN-multi-harness-executor.md` D10, D11) — THE STDIO BRIDGE every CLI starts as its MCP server.
//
// ⭑ WHY A BRIDGE (D10). Every CLI this host drives speaks stdio MCP, so each one is given the same entry: `command` the
// server's own runtime, `args` this file and the turn's endpoint file. The bridge reads the server's URL and the turn's
// token from that file when it starts, then relays each newline-delimited JSON-RPC message from its stdin to the host's
// server as one POST, and writes each reply to its stdout as one line. A notification gets no reply. So the token lives
// in one file outside the CLI's working folder — never in argv, never in an environment variable (D41) — and each CLI's
// own HTTP client, with its quirks, is never in the path.
// ⭑ IT HOLDS NO STATE AND LOGS NOTHING: killing it loses nothing, and no stream of it can carry the token. It exits when
// its stdin closes — once what it already relayed is answered, or half a second later at most (⚠ AUTHORED) — so a CLI
// that closed its end after its last request still reads the reply, and the bridge never outlives its CLI for long.
// Messages are relayed one at a time, in the order the CLI wrote them, so the order calls reach the host is the order the
// CLI sent them (D5).
// ⛔ THE TOKEN GOES TO 127.0.0.1 AND NOWHERE ELSE (D41). The bridge writes each request itself, as HTTP/1.0, on a raw
// `node:net` socket to 127.0.0.1, and reads the reply until the server closes the connection. It uses no HTTP client:
// bun's `node:http` client sends through `HTTP_PROXY`, and node's does under `NODE_USE_ENV_PROXY=1`, so a proxy in the
// environment a CLI gives its MCP server would have received the bearer token (found by the check of MH-1). A raw socket
// is routed through no proxy by either runtime: `host-tool-bridge.test.ts` (B5) plants every proxy variable and runs the
// bridge under node, and under bun where this host has it.
//
// ⛔ ITS SOURCE IS A PINNED CONSTANT, WRITTEN INTO THE RUN'S `host/` FOLDER AND RUN BY THE SERVER'S OWN RUNTIME (D11). The
// adapter names `process.execPath` as the command, by absolute path: no `PATH` search and no batch shim. The bytes
// `writeBridge` writes are pinned by `host-tool-bridge-pin.test.ts`, by hash, so a change to them is a change a reviewer
// sees. Whichever runtime the server runs on runs the bridge, so it is written for node and for bun alike.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The bridge's file name in the run's `host/` folder. */
const BRIDGE_FILE = 'jpwb-bridge.mjs';

const BRIDGE_SOURCE = `import { readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { createInterface } from 'node:readline';

const endpoint = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const target = new URL(endpoint.url);
let chain = Promise.resolve();

function post(line) {
	return new Promise((resolve) => {
		const body = Buffer.from(line, 'utf8');
		const head = Buffer.from(
			'POST ' + target.pathname + ' HTTP/1.0\\r\\n' +
				'Host: 127.0.0.1:' + target.port + '\\r\\n' +
				'Content-Type: application/json\\r\\n' +
				'Content-Length: ' + body.length + '\\r\\n' +
				'Authorization: Bearer ' + endpoint.token + '\\r\\n\\r\\n',
			'latin1'
		);
		const chunks = [];
		let settled = false;
		const settle = (answer) => {
			if (settled) return;
			settled = true;
			resolve(answer);
		};
		const socket = connect(Number(target.port), '127.0.0.1', () => socket.write(Buffer.concat([head, body])));
		socket.on('data', (chunk) => chunks.push(chunk));
		socket.on('error', () => settle({ status: 0, text: '' }));
		socket.on('close', () => {
			const reply = Buffer.concat(chunks);
			const end = reply.indexOf('\\r\\n\\r\\n');
			const status = end < 0 ? null : /^HTTP\\/1\\.[01] (\\d{3})/.exec(reply.subarray(0, end).toString('latin1'));
			settle(
				status === null
					? { status: 0, text: '' }
					: { status: Number(status[1]), text: reply.subarray(end + 4).toString('utf8') }
			);
		});
	});
}

function requestId(line) {
	try {
		const message = JSON.parse(line);
		if (message !== null && typeof message === 'object' && !Array.isArray(message) && !('id' in message))
			return { reply: false };
		return { reply: true, id: message !== null && typeof message === 'object' && 'id' in message ? message.id : null };
	} catch {
		return { reply: true, id: null };
	}
}

createInterface({ input: process.stdin, crlfDelay: Infinity })
	.on('line', (line) => {
		if (line.trim() === '') return;
		const asked = requestId(line);
		chain = chain.then(async () => {
			const answer = await post(line);
			if (!asked.reply) return;
			const text =
				answer.status === 200 && answer.text.trim() !== ''
					? answer.text.trim()
					: JSON.stringify({
							jsonrpc: '2.0',
							id: asked.id,
							error: { code: -32000, message: 'The host refused this request (HTTP ' + answer.status + ').' }
						});
			process.stdout.write(text + '\\n');
		});
	})
	.on('close', () => {
		const leave = () => process.exit(0);
		chain.then(leave, leave);
		setTimeout(leave, 500);
	});
`;

/**
 * Write the bridge into a run's `host/` folder, and return its path. ⭑ The only export: the source stays module-private,
 * so what runs is what this function writes (D11).
 */
export async function writeBridge(hostDirectory: string): Promise<string> {
	const path = join(hostDirectory, BRIDGE_FILE);
	await writeFile(path, BRIDGE_SOURCE, 'utf8');
	return path;
}
