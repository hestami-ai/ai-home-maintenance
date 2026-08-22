import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runStateMachineGraphCommand } from '../packages/csaa/src/application/run-state-machine-graph-command.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MAX_REQUEST_BYTES = 1024 * 1024;

process.stderr.on('error', () => {
	// Progress and adapter diagnostics are best-effort side channels; stdout owns the terminal envelope.
});
process.stdout.on('error', () => {
	// A closed terminal consumer cannot receive the envelope, but must not trigger an unhandled EPIPE.
});

class RequestInputError extends Error {}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	let bytes = 0;
	for await (const chunk of process.stdin) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		bytes += buffer.byteLength;
		if (bytes > MAX_REQUEST_BYTES) throw new RequestInputError('Request input exceeds 1 MiB.');
		chunks.push(buffer);
	}
	return Buffer.concat(chunks, bytes).toString('utf8');
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
		return buffer.subarray(0, bytes).toString('utf8');
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
	process.exitCode = runStateMachineGraphCommand(request, {
		repositoryRoot: ROOT,
		writeProgress: (line) => process.stderr.write(line),
		writeTerminal: (line) => process.stdout.write(line)
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
