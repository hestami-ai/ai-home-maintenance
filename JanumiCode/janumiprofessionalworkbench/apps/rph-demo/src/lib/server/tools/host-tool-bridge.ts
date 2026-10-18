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
// CLI sent them (D5). It posts with `node:http` to 127.0.0.1, so no proxy setting in the environment it inherits can
// route it elsewhere.
//
// ⛔ ITS SOURCE IS A PINNED CONSTANT, WRITTEN INTO THE RUN'S `host/` FOLDER AND RUN BY THE SERVER'S OWN RUNTIME (D11). The
// adapter names `process.execPath` as the command, by absolute path: no `PATH` search and no batch shim. The bytes
// `writeBridge` writes are pinned by `host-tool-bridge.test.ts`, by hash, so a change to them is a change a reviewer
// sees. It runs under node and under bun, the two runtimes this server runs on.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The bridge's file name in the run's `host/` folder. */
const BRIDGE_FILE = 'jpwb-bridge.mjs';

const BRIDGE_SOURCE = `import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { createInterface } from 'node:readline';

const endpoint = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const target = new URL(endpoint.url);
let chain = Promise.resolve();

function post(line) {
	return new Promise((resolve) => {
		const body = Buffer.from(line, 'utf8');
		const req = request(
			{
				host: target.hostname,
				port: Number(target.port),
				path: target.pathname,
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'content-length': body.length,
					authorization: 'Bearer ' + endpoint.token
				}
			},
			(res) => {
				const chunks = [];
				res.on('data', (chunk) => chunks.push(chunk));
				res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
				res.on('error', () => resolve({ status: 0, text: '' }));
			}
		);
		req.on('error', () => resolve({ status: 0, text: '' }));
		req.end(body);
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
