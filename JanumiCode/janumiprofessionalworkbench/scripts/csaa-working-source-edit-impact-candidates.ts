import {
	closeSync,
	constants,
	fstatSync,
	lstatSync,
	openSync,
	readSync,
	type BigIntStats
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import {
	canonicalSemanticJson,
	runWorkingSourceEditImpactCandidateReport,
	workingSourceEditImpactCandidateReportExitCode
} from '../packages/csaa/src/index.js';
import { createStructuralModuleReachabilityProgressJsonlWriter } from '../packages/csaa/src/application/structural-module-reachability-progress-jsonl.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MAX_REQUEST_BYTES = 1024 * 1024;

process.stderr.on('error', () => {
	// Predecessor progress and adapter diagnostics are best-effort side channels.
});
process.stdout.on('error', () => {
	// A closed terminal consumer cannot receive the envelope, but must not trigger an unhandled EPIPE.
});

class RequestInputError extends Error {}

function decodeRequestBytes(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new RequestInputError('Request input is not valid UTF-8.');
	}
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

function sameFileIdentity(left: BigIntStats, right: BigIntStats): boolean {
	return (
		left.dev === right.dev &&
		left.ino === right.ino &&
		left.size === right.size &&
		left.mtimeNs === right.mtimeNs &&
		left.ctimeNs === right.ctimeNs
	);
}

function readRequestFile(path: string): string {
	let lexical: BigIntStats;
	try {
		lexical = lstatSync(path, { bigint: true });
		if (!lexical.isFile())
			throw new RequestInputError('The request path must identify a regular non-symlink file.');
		if (lexical.size > BigInt(MAX_REQUEST_BYTES))
			throw new RequestInputError('Request input exceeds 1 MiB.');
	} catch (error) {
		if (error instanceof RequestInputError) throw error;
		throw new RequestInputError('Unable to inspect the request file safely.');
	}
	let descriptor: number;
	try {
		descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
	} catch {
		throw new RequestInputError('Unable to read the request file.');
	}
	try {
		const opened = fstatSync(descriptor, { bigint: true });
		if (!opened.isFile() || !sameFileIdentity(lexical, opened))
			throw new RequestInputError('The request file identity changed before it was opened.');
		const buffer = Buffer.allocUnsafe(MAX_REQUEST_BYTES + 1);
		let bytes = 0;
		while (bytes < buffer.byteLength) {
			const count = readSync(descriptor, buffer, bytes, buffer.byteLength - bytes, null);
			if (count === 0) break;
			bytes += count;
		}
		if (bytes > MAX_REQUEST_BYTES) throw new RequestInputError('Request input exceeds 1 MiB.');
		const finished = fstatSync(descriptor, { bigint: true });
		if (!sameFileIdentity(opened, finished))
			throw new RequestInputError('The request file changed while it was being read.');
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
	const progressWriter = createStructuralModuleReachabilityProgressJsonlWriter({
		write: (line) => process.stderr.write(line)
	});
	const outcome = runWorkingSourceEditImpactCandidateReport(request, {
		onPredecessorProgress: (event) => progressWriter.emit(event),
		repositoryRoot: ROOT
	});
	process.stdout.write(`${canonicalSemanticJson(outcome)}\n`);
	process.exitCode = workingSourceEditImpactCandidateReportExitCode(outcome);
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
