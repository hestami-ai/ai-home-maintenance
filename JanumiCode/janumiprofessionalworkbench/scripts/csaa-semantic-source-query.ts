import { closeSync, fstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

import { runSemanticSourceQueryCommand } from '../packages/csaa/src/application/run-semantic-source-query-command.js';

// The core reconciles the capture's real repository root exactly; canonicalize once at the host edge.
const ROOT = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const MAX_REQUEST_BYTES = 1024 * 1024;

process.stderr.on('error', () => {
	// Progress and adapter diagnostics are best-effort side channels; stdout owns the terminal envelope.
});

class RequestInputError extends Error {}

function decodeRequestBytes(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new RequestInputError('Request input is not valid UTF-8.');
	}
}

function writeTerminalLine(line: string): Promise<void> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (error?: Error | null): void => {
			if (settled) return;
			settled = true;
			process.stdout.off('error', finish);
			if (error == null) resolve();
			else reject(error);
		};
		process.stdout.once('error', finish);
		process.stdout.write(line, finish);
	});
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	let bytes = 0;
	for await (const chunk of process.stdin) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		bytes += buffer.byteLength;
		if (bytes > MAX_REQUEST_BYTES) throw new RequestInputError('Request input exceeds 1 MiB.');
		chunks.push(buffer);
	}
	return decodeRequestBytes(Buffer.concat(chunks, bytes));
}

function readRequestFile(path: string): string {
	let descriptor: number;
	try {
		descriptor = openSync(path, 'r');
	} catch {
		throw new RequestInputError('Unable to read the request file.');
	}
	try {
		if (!fstatSync(descriptor).isFile())
			throw new RequestInputError('The request path must identify a regular file.');
		const buffer = Buffer.allocUnsafe(MAX_REQUEST_BYTES + 1);
		let bytes = 0;
		while (bytes < buffer.byteLength) {
			const count = readSync(descriptor, buffer, bytes, buffer.byteLength - bytes, null);
			if (count === 0) break;
			bytes += count;
		}
		if (bytes > MAX_REQUEST_BYTES) throw new RequestInputError('Request input exceeds 1 MiB.');
		return decodeRequestBytes(buffer.subarray(0, bytes));
	} catch (error) {
		if (error instanceof RequestInputError) throw error;
		throw new RequestInputError('Unable to read the request file.');
	} finally {
		closeSync(descriptor);
	}
}

function usage(): never {
	throw new RequestInputError('Use exactly one of --stdin or --request <json-file>.');
}

const args = process.argv.slice(2);
try {
	let requestText: string;
	if (args.length === 1 && args[0] === '--stdin') {
		requestText = await readStdin();
	} else if (args.length === 2 && args[0] === '--request' && args[1]!.length > 0) {
		requestText = readRequestFile(args[1]!);
	} else {
		usage();
	}

	let request: unknown;
	try {
		request = JSON.parse(requestText);
	} catch {
		throw new RequestInputError('Request input is not valid JSON.');
	}
	process.exitCode = await runSemanticSourceQueryCommand(request, {
		repositoryRoot: ROOT,
		writeProgress: (line) => process.stderr.write(line),
		writeTerminal: writeTerminalLine
	});
} catch (error) {
	if (error instanceof RequestInputError) {
		process.stderr.write(
			`${JSON.stringify({ error: 'request-input-invalid', message: error.message })}\n`
		);
		process.exitCode = 2;
	} else {
		process.stderr.write(
			`${JSON.stringify({ error: 'adapter-internal-failure', message: 'The request adapter failed closed.' })}\n`
		);
		process.exitCode = 4;
	}
}
