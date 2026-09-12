import {
	CODING_AGENT_PROCESS_SAFETY_CEILINGS,
	runCodingAgentProcess,
	type CodingAgentProcessResult
} from './run-coding-agent-process.js';

export interface RunCodingAgentProcessHostOptions {
	readonly args?: readonly string[];
	readonly repositoryRoot: string;
	readonly signal?: AbortSignal;
	readonly stderr?: NodeJS.WritableStream;
	readonly stdin?: NodeJS.ReadableStream & AsyncIterable<string | Uint8Array>;
	readonly stdout?: NodeJS.WritableStream;
	readonly storeRoot?: string;
}

function commandConsumesStdin(args: readonly string[]): boolean {
	return (
		(args.length === 2 && args[0] === 'invoke' && args[1] === '--stdin') ||
		(args.length === 3 && args[0] === 'artifact' && args[1] === 'put' && args[2] === '--stdin')
	);
}

async function readBoundedStdin(
	stream: NodeJS.ReadableStream & AsyncIterable<string | Uint8Array>,
	maximumBytes: number,
	maximumChunks: number,
	signal?: AbortSignal
): Promise<Uint8Array | undefined> {
	const iterator = stream[Symbol.asyncIterator]();
	const retained = Buffer.allocUnsafe(maximumBytes);
	let totalBytes = 0;
	let totalChunks = 0;
	const closeInput = (): void => {
		const destroy = (stream as { destroy?: () => void }).destroy;
		if (typeof destroy === 'function') destroy.call(stream);
		if (typeof iterator.return === 'function') void iterator.return().catch(() => undefined);
	};
	while (true) {
		if (signal?.aborted === true) {
			closeInput();
			return undefined;
		}
		let removeAbortListener: (() => void) | undefined;
		const aborted =
			signal === undefined
				? undefined
				: new Promise<{ readonly kind: 'ABORTED' }>((resolve) => {
						const abort = (): void => resolve({ kind: 'ABORTED' });
						signal.addEventListener('abort', abort, { once: true });
						removeAbortListener = () => signal.removeEventListener('abort', abort);
						if (signal.aborted) abort();
					});
		const next = Promise.resolve()
			.then(() => iterator.next())
			.then(
				(value) => ({ kind: 'NEXT' as const, value }),
				(error: unknown) => ({ error, kind: 'ERROR' as const })
			);
		const outcome = aborted === undefined ? await next : await Promise.race([next, aborted]);
		removeAbortListener?.();
		if (outcome.kind === 'ABORTED') {
			closeInput();
			return undefined;
		}
		if (outcome.kind === 'ERROR') {
			closeInput();
			throw outcome.error;
		}
		if (outcome.value.done) break;
		totalChunks += 1;
		if (totalChunks > maximumChunks) {
			closeInput();
			return new Uint8Array(maximumBytes + 1);
		}
		const chunk = outcome.value.value;
		const chunkBytes =
			typeof chunk === 'string' ? Buffer.byteLength(chunk, 'utf8') : chunk.byteLength;
		if (chunkBytes > maximumBytes - totalBytes) {
			// The process admission layer owns the versioned refusal. A maximum-plus-one sentinel
			// communicates exhaustion without retaining attacker-controlled bytes beyond the ceiling.
			closeInput();
			return new Uint8Array(maximumBytes + 1);
		}
		if (typeof chunk === 'string') retained.write(chunk, totalBytes, chunkBytes, 'utf8');
		else retained.set(chunk, totalBytes);
		totalBytes += chunkBytes;
	}
	return Uint8Array.from(retained.subarray(0, totalBytes));
}

async function writeAll(stream: NodeJS.WritableStream, value: string): Promise<void> {
	if (value.length === 0) return;
	await new Promise<void>((resolve) => {
		let settled = false;
		const done = (): void => {
			if (settled) return;
			settled = true;
			stream.removeListener('close', done);
			stream.removeListener('drain', done);
			stream.removeListener('error', done);
			resolve();
		};
		stream.once('close', done);
		stream.once('error', done);
		try {
			if (stream.write(value)) done();
			else stream.once('drain', done);
		} catch {
			done();
		}
	});
}

/**
 * Thin ambient-process host. All command admission and semantics remain in runCodingAgentProcess;
 * this layer only bounds stdin and forwards the already-versioned stdout/stderr/exit result.
 */
export async function runCodingAgentProcessHost(
	options: RunCodingAgentProcessHostOptions
): Promise<CodingAgentProcessResult['exitCode']> {
	const args = options.args ?? process.argv.slice(2);
	const stdinStream = options.stdin ?? process.stdin;
	const stdin = commandConsumesStdin(args)
		? await readBoundedStdin(
				stdinStream,
				CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxStdinBytes,
				CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxStdinChunks,
				options.signal
			)
		: undefined;
	const result = await runCodingAgentProcess(args, {
		repositoryRoot: options.repositoryRoot,
		signal: options.signal,
		stdin,
		storeRoot: options.storeRoot
	});
	await writeAll(options.stdout ?? process.stdout, result.stdout);
	await writeAll(options.stderr ?? process.stderr, result.stderr);
	return result.exitCode;
}
