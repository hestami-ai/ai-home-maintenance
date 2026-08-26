import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';

import { afterEach, describe, expect, it } from 'vitest';

import { CODING_AGENT_PROCESS_SAFETY_CEILINGS } from './run-coding-agent-process.js';
import { runCodingAgentProcessHost } from './run-coding-agent-process-host.js';

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'csaa-process-host-'));
	temporaryRoots.push(root);
	return root;
}

function outputSink(): { readonly stream: Writable; readonly value: () => string } {
	const chunks: Buffer[] = [];
	const stream = new Writable({
		highWaterMark: 1,
		write(chunk: Buffer | string, encoding, callback) {
			chunks.push(Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk, encoding));
			setImmediate(callback);
		}
	});
	return {
		stream,
		value: () => Buffer.concat(chunks).toString('utf8')
	};
}

afterEach(async () => {
	for (const root of temporaryRoots.splice(0)) await rm(root, { force: true, recursive: true });
});

describe('coding-agent ambient process host', () => {
	it('bounds stdin and forwards persistent artifact put/get results exactly', async () => {
		const repositoryRoot = await temporaryRoot();
		const storeRoot = join(repositoryRoot, 'persistent-store');
		const putOut = outputSink();
		const putErr = outputSink();
		const putExit = await runCodingAgentProcessHost({
			args: ['artifact', 'put', '--stdin'],
			repositoryRoot,
			stderr: putErr.stream,
			stdin: Readable.from(['{"alpha":', '[1,true,null]}']),
			stdout: putOut.stream,
			storeRoot
		});
		expect(putExit).toBe(0);
		expect(putErr.value()).toBe('');
		const published = JSON.parse(putOut.value()) as {
			readonly artifact: { readonly reference: string };
		};

		const getOut = outputSink();
		const getErr = outputSink();
		const getExit = await runCodingAgentProcessHost({
			args: ['artifact', 'get', '--reference', published.artifact.reference],
			repositoryRoot,
			stderr: getErr.stream,
			stdin: Readable.from([new Uint8Array(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxStdinBytes)]),
			stdout: getOut.stream,
			storeRoot
		});
		expect(getExit).toBe(0);
		expect(getErr.value()).toBe('');
		expect(getOut.value()).toBe('{"alpha":[1,true,null]}\n');
	});

	it('stops retaining input at the host ceiling and delegates the versioned refusal', async () => {
		const repositoryRoot = await temporaryRoot();
		let readCount = 0;
		const hostileInput = {
			[Symbol.asyncIterator]() {
				return {
					next: async () => {
						readCount += 1;
						return readCount === 1
							? {
									value: new Uint8Array(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxStdinBytes + 1),
									done: false as const
								}
							: { value: undefined, done: true as const };
					}
				};
			}
		} as unknown as NodeJS.ReadableStream & AsyncIterable<Uint8Array>;
		const stdout = outputSink();
		const stderr = outputSink();
		const exitCode = await runCodingAgentProcessHost({
			args: ['artifact', 'put', '--stdin'],
			repositoryRoot,
			stderr: stderr.stream,
			stdin: hostileInput,
			stdout: stdout.stream
		});
		expect(exitCode).toBe(2);
		expect(stdout.value()).toBe('');
		expect(JSON.parse(stderr.value())).toMatchObject({ code: 'STDIN_LIMIT_EXCEEDED' });
		expect(readCount).toBe(1);
	});

	it('uses fixed retained storage for arbitrarily many empty chunks', async () => {
		const repositoryRoot = await temporaryRoot();
		const storeRoot = join(repositoryRoot, 'many-chunk-store');
		const chunks = [...new Array(10_000).fill(''), '{"bounded":true}'];
		const stdout = outputSink();
		const stderr = outputSink();
		const exitCode = await runCodingAgentProcessHost({
			args: ['artifact', 'put', '--stdin'],
			repositoryRoot,
			stderr: stderr.stream,
			stdin: Readable.from(chunks),
			stdout: stdout.stream,
			storeRoot
		});
		expect(exitCode).toBe(0);
		expect(stderr.value()).toBe('');
		expect(JSON.parse(stdout.value())).toMatchObject({ messageKind: 'artifact-published' });
	});

	it('refuses an unending zero-byte chunk stream at the versioned chunk ceiling', async () => {
		const repositoryRoot = await temporaryRoot();
		let destroyed = false;
		let readCount = 0;
		let returned = false;
		const zeroProgressInput = {
			destroy() {
				destroyed = true;
			},
			[Symbol.asyncIterator]() {
				return {
					next: async () => {
						readCount += 1;
						return { done: false as const, value: new Uint8Array() };
					},
					return: async () => {
						returned = true;
						return { done: true as const, value: undefined };
					}
				};
			}
		} as unknown as NodeJS.ReadableStream & AsyncIterable<Uint8Array>;
		const stdout = outputSink();
		const stderr = outputSink();
		const exitCode = await runCodingAgentProcessHost({
			args: ['artifact', 'put', '--stdin'],
			repositoryRoot,
			stderr: stderr.stream,
			stdin: zeroProgressInput,
			stdout: stdout.stream
		});

		expect(exitCode).toBe(2);
		expect(stdout.value()).toBe('');
		expect(JSON.parse(stderr.value())).toMatchObject({ code: 'STDIN_LIMIT_EXCEEDED' });
		expect(readCount).toBe(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxStdinChunks + 1);
		expect(destroyed).toBe(true);
		expect(returned).toBe(true);
	});

	it('cancels a pending stdin read and closes the iterator without waiting for input', async () => {
		const repositoryRoot = await temporaryRoot();
		const controller = new AbortController();
		let returned = false;
		const pendingInput = {
			[Symbol.asyncIterator]() {
				return {
					next: () => new Promise<IteratorResult<Uint8Array>>(() => undefined),
					return: async () => {
						returned = true;
						return { done: true as const, value: undefined };
					}
				};
			}
		} as unknown as NodeJS.ReadableStream & AsyncIterable<Uint8Array>;
		const stdout = outputSink();
		const stderr = outputSink();
		setImmediate(() => controller.abort());
		const exitCode = await runCodingAgentProcessHost({
			args: ['artifact', 'put', '--stdin'],
			repositoryRoot,
			signal: controller.signal,
			stderr: stderr.stream,
			stdin: pendingInput,
			stdout: stdout.stream
		});
		expect(exitCode).toBe(3);
		expect(stdout.value()).toBe('');
		expect(JSON.parse(stderr.value())).toMatchObject({ code: 'PROCESS_CANCELLED' });
		expect(returned).toBe(true);
	});

	it('cannot miss an abort fired synchronously by iterator admission', async () => {
		const repositoryRoot = await temporaryRoot();
		const controller = new AbortController();
		let returned = false;
		const adversarialInput = {
			[Symbol.asyncIterator]() {
				return {
					next: () => {
						controller.abort();
						return new Promise<IteratorResult<Uint8Array>>(() => undefined);
					},
					return: async () => {
						returned = true;
						return { done: true as const, value: undefined };
					}
				};
			}
		} as unknown as NodeJS.ReadableStream & AsyncIterable<Uint8Array>;
		const stdout = outputSink();
		const stderr = outputSink();
		const exitCode = await runCodingAgentProcessHost({
			args: ['artifact', 'put', '--stdin'],
			repositoryRoot,
			signal: controller.signal,
			stderr: stderr.stream,
			stdin: adversarialInput,
			stdout: stdout.stream
		});

		expect(exitCode).toBe(3);
		expect(stdout.value()).toBe('');
		expect(JSON.parse(stderr.value())).toMatchObject({ code: 'PROCESS_CANCELLED' });
		expect(returned).toBe(true);
	});

	it('returns the determined exit code when a downstream diagnostic consumer closes', async () => {
		const repositoryRoot = await temporaryRoot();
		const closedConsumer = new Writable({
			write(_chunk, _encoding, callback) {
				callback(new Error('consumer closed'));
			}
		});
		await expect(
			runCodingAgentProcessHost({
				args: ['unknown'],
				repositoryRoot,
				stderr: closedConsumer,
				stdout: outputSink().stream
			})
		).resolves.toBe(2);
	});
});
