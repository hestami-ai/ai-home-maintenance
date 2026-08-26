import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdtempSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import {
	AGENT_OPERATION_PROTOCOL_VERSION,
	AGENT_OPERATION_VERSIONS,
	type AgentOperationRequest
} from '../agent/agent-operation-protocol.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS,
	codingAgentCliArtifactDigest,
	codingAgentCliArtifactReference
} from './coding-agent-cli-artifact-store.js';
import {
	CODING_AGENT_CLI_INPUT_CONTRACT_ID,
	CODING_AGENT_CLI_INPUT_VERSION,
	codingAgentCliInputDigest,
	type CodingAgentCliInventoryInput
} from './coding-agent-cli-contract.js';
import {
	CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION,
	CODING_AGENT_CLI_LOCAL_CAPABILITIES,
	CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS
} from './compose-coding-agent-cli-handlers.js';
import {
	CODING_AGENT_PROCESS_ARTIFACT_RESULT_VERSION,
	CODING_AGENT_PROCESS_DIAGNOSTIC_VERSION,
	CODING_AGENT_PROCESS_INVOCATION_VERSION,
	CODING_AGENT_PROCESS_SAFETY_CEILINGS,
	CODING_AGENT_PROCESS_VERSION,
	runCodingAgentProcess,
	type CodingAgentProcessDiagnosticCode,
	type CodingAgentProcessResult
} from './run-coding-agent-process.js';

const roots: string[] = [];
const USER_REQUEST_DIGEST = 'a'.repeat(64);

const SUMMARIES = Object.freeze({
	ARGUMENTS_INVALID: 'The process arguments do not match one closed command shape.',
	ARTIFACT_REFERENCE_INVALID: 'The artifact reference is not a lowercase SHA-256 reference.',
	ARTIFACT_UNAVAILABLE: 'The requested artifact or persistent artifact store is unavailable.',
	INTERNAL_FAILURE: 'The trusted process composition failed closed.',
	INVOCATION_ENVELOPE_INVALID: 'The stdin invocation envelope has an open or invalid shape.',
	PROCESS_CANCELLED: 'The coding-agent process was cancelled by its trusted host.',
	STDIN_JSON_DUPLICATE_KEY: 'The stdin JSON contains a duplicate decoded object key.',
	STDIN_JSON_INVALID: 'The stdin payload is not closed canonicalizable JSON data.',
	STDIN_LIMIT_EXCEEDED: 'The stdin payload exceeds a process admission ceiling.',
	STDIN_REQUIRED: 'This command requires one stdin payload.',
	STDIN_UNICODE_INVALID: 'The stdin payload is not valid scalar UTF-8 or Unicode text.',
	UNSAFE_PATH_REFUSED: 'Untrusted input contains a host filesystem path or parent traversal.'
} as const satisfies Record<CodingAgentProcessDiagnosticCode, string>);

interface FixtureRoots {
	readonly repositoryRoot: string;
	readonly storeRoot: string;
}

function write(root: string, logicalPath: string, content: string): void {
	const absolute = join(root, ...logicalPath.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
}

function fixture(): FixtureRoots {
	const base = mkdtempSync(join(tmpdir(), 'jan-csaa-process-'));
	roots.push(base);
	const repositoryRoot = join(base, 'subject');
	mkdirSync(repositoryRoot);
	write(
		repositoryRoot,
		'package.json',
		JSON.stringify({
			name: 'coding-agent-process-fixture',
			private: true,
			scripts: { 'check-types': 'tsc --noEmit', test: 'vitest run' },
			workspaces: ['packages/*']
		})
	);
	write(
		repositoryRoot,
		'packages/example/package.json',
		JSON.stringify({ name: '@fixture/example', private: true, version: '0.0.0' })
	);
	write(repositoryRoot, 'packages/example/src/index.ts', 'export const example = 1;\n');
	write(
		repositoryRoot,
		'packages/example/tsconfig.json',
		'{"compilerOptions":{"strict":true},"include":["src"]}\n'
	);
	write(repositoryRoot, 'tsconfig.json', '{"include":[]}\n');
	write(repositoryRoot, 'bun.lock', '    "typescript": ["typescript@5.9.3", ""],\n');
	return { repositoryRoot, storeRoot: join(base, 'artifact-store') };
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function diagnostic(
	exitCode: 2 | 3 | 5,
	code: CodingAgentProcessDiagnosticCode
): CodingAgentProcessResult {
	return {
		exitCode,
		stderr: `${canonicalSemanticJson({
			code,
			messageKind: 'coding-agent-process-diagnostic',
			processVersion: CODING_AGENT_PROCESS_VERSION,
			schemaVersion: CODING_AGENT_PROCESS_DIAGNOSTIC_VERSION,
			severity: 'ERROR',
			summary: SUMMARIES[code]
		})}\n`,
		stdout: ''
	};
}

function artifactReference(result: CodingAgentProcessResult): string {
	const output = JSON.parse(result.stdout) as { artifact: { reference: string } };
	return output.artifact.reference;
}

function inventoryInput(subjectInputRef: string): CodingAgentCliInventoryInput {
	return {
		bindingRef: 'binding:process:inventory',
		kind: 'INVENTORY',
		output: 'STDOUT_JSON',
		schemaVersion: CODING_AGENT_CLI_INPUT_VERSION,
		subjectInputRef
	};
}

function inventoryRequest(
	input: CodingAgentCliInventoryInput,
	artifactReferenceValue: string
): AgentOperationRequest {
	const digest = codingAgentCliInputDigest(input);
	if (digest.state !== 'VALID') throw new Error(JSON.stringify(digest));
	return {
		budgets: {
			maxDepth: 128,
			maxEdges: 10_000,
			maxNodes: 10_000,
			maxOutputBytes: 1_000_000,
			maxResults: 2_000,
			timeoutMs: 30_000
		},
		capabilityRequirement: {
			affectedQuestionRefs: ['question:process:inventory'],
			capabilityId: CODING_AGENT_CLI_LOCAL_CAPABILITIES.inventory,
			capabilityVersion: CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS.inventory,
			necessity: 'MANDATORY'
		},
		currentnessRequirement: { kind: 'REQUIRE_CURRENT' },
		messageKind: 'request',
		operation: 'inventory',
		operationInput: {
			contractId: CODING_AGENT_CLI_INPUT_CONTRACT_ID,
			contractVersion: CODING_AGENT_CLI_INPUT_VERSION,
			inputDigest: digest.digest,
			inputRef: input.bindingRef
		},
		operationVersion: AGENT_OPERATION_VERSIONS.inventory,
		protocolVersion: AGENT_OPERATION_PROTOCOL_VERSION,
		requestId: 'request:process:inventory',
		requestedAt: '2026-08-25T00:00:00.000Z',
		subjectInput: {
			kind: 'SUBJECT_LOCATOR',
			locatorDigest: codingAgentCliArtifactDigest(artifactReferenceValue),
			locatorRef: artifactReferenceValue,
			resolutionPolicyRef: 'policy:exact-content-addressed-input'
		},
		work: {
			agentId: 'agent:process-test',
			authorityEnvelopeRef: 'authority:local-readonly',
			changeContract: { changeContractRef: 'change:csaa-g6', kind: 'REFERENCE' },
			employmentPoint: 'DURING_IMPLEMENTATION',
			userRequestDigest: USER_REQUEST_DIGEST,
			workPackageRef: 'work-package:DWP-006'
		}
	};
}

describe('coding-agent process artifact transport', () => {
	it('confines the default persistent store beneath an ordinary repository root', async () => {
		const roots = fixture();
		const put = await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
			repositoryRoot: roots.repositoryRoot,
			stdin: '{"defaultStore":"confined"}'
		});
		expect(put.exitCode).toBe(0);
		expect(
			existsSync(join(roots.repositoryRoot, '.csaa', 'coding-agent-artifacts', 'current.json'))
		).toBe(true);
		expect(
			await runCodingAgentProcess(['artifact', 'get', '--reference', artifactReference(put)], {
				repositoryRoot: roots.repositoryRoot
			})
		).toEqual({
			exitCode: 0,
			stderr: '',
			stdout: '{"defaultStore":"confined"}\n'
		});
	});

	it('canonicalizes, publishes, and re-verifies artifacts across independent calls', async () => {
		const roots = fixture();
		const value = { z: 2, a: { value: 1 } };
		const canonical = canonicalSemanticJson(value);
		const reference = codingAgentCliArtifactReference(canonical);
		const put = await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
			...roots,
			stdin: '{ "z": 2, "a": { "value": 1 } }'
		});
		expect(put).toEqual({
			exitCode: 0,
			stderr: '',
			stdout: `${canonicalSemanticJson({
				artifact: {
					bytes: Buffer.byteLength(canonical),
					digest: codingAgentCliArtifactDigest(reference),
					reference
				},
				messageKind: 'artifact-published',
				processVersion: CODING_AGENT_PROCESS_VERSION,
				schemaVersion: CODING_AGENT_PROCESS_ARTIFACT_RESULT_VERSION
			})}\n`
		});

		const get = await runCodingAgentProcess(['artifact', 'get', '--reference', reference], roots);
		expect(get).toEqual({ exitCode: 0, stderr: '', stdout: `${canonical}\n` });
	});

	it(
		'admits an artifact whose canonical bytes equal the explicit process transport ceiling',
		{ timeout: 20_000 },
		async () => {
			const roots = fixture();
			const canonical = `"${'x'.repeat(
				CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxArtifactStdinBytes - 2
			)}"`;
			expect(Buffer.byteLength(canonical)).toBe(
				CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxArtifactStdinBytes
			);
			const put = await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
				...roots,
				stdin: canonical
			});
			expect(put.exitCode).toBe(0);
			expect(put.stderr).toBe('');
			expect(artifactReference(put)).toBe(codingAgentCliArtifactReference(canonical));
		}
	);

	it('rolls back a fully staged artifact when the trusted host cancels before commit', async () => {
		const roots = fixture();
		const value = { staged: 'must-not-publish' };
		const reference = codingAgentCliArtifactReference(canonicalSemanticJson(value));
		const controller = new AbortController();
		queueMicrotask(() => controller.abort());
		const put = await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
			...roots,
			signal: controller.signal,
			stdin: JSON.stringify(value)
		});
		expect(put).toEqual(diagnostic(3, 'ARTIFACT_UNAVAILABLE'));
		expect(
			await runCodingAgentProcess(['artifact', 'get', '--reference', reference], roots)
		).toEqual(diagnostic(3, 'ARTIFACT_UNAVAILABLE'));
	});

	it('re-verifies persisted bytes and refuses a corrupted content address', async () => {
		const roots = fixture();
		const put = await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
			...roots,
			stdin: '{"integrity":"required"}'
		});
		const reference = artifactReference(put);
		const digest = codingAgentCliArtifactDigest(reference);
		writeFileSync(join(roots.storeRoot, 'artifacts', digest.slice(0, 2), `${digest}.blob`), '{}');
		expect(
			await runCodingAgentProcess(['artifact', 'get', '--reference', reference], roots)
		).toEqual(diagnostic(3, 'ARTIFACT_UNAVAILABLE'));
	});
});

describe('coding-agent process invocation transport', () => {
	it('routes the same implemented inventory operation through direct argv and bounded stdin', async () => {
		const roots = fixture();
		const subjectRequest = {
			kind: 'REPOSITORY_INVENTORY_REQUEST',
			requireJpwbPopulations: false,
			rootLocator: '<repository-root>',
			schemaVersion: CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION
		};
		const published = await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
			...roots,
			stdin: JSON.stringify(subjectRequest)
		});
		const reference = artifactReference(published);
		const input = inventoryInput(reference);
		const request = inventoryRequest(input, reference);
		const directArgs = [
			'inventory',
			'--request-json',
			JSON.stringify(request),
			'--input-json',
			JSON.stringify(input),
			'--output',
			'json'
		];
		const direct = await runCodingAgentProcess(directArgs, roots);
		expect(direct.exitCode).toBe(3);
		expect(JSON.parse(direct.stdout)).toMatchObject({
			exitCategory: 'INCOMPLETE_OR_UNSUPPORTED',
			operation: 'inventory',
			outcome: 'partial'
		});
		expect(direct.stderr.trim().split('\n')).toHaveLength(2);

		const invoked = await runCodingAgentProcess(['invoke', '--stdin'], {
			...roots,
			stdin: canonicalSemanticJson({
				command: 'inventory',
				input,
				output: 'json',
				request,
				schemaVersion: CODING_AGENT_PROCESS_INVOCATION_VERSION
			})
		});
		expect(invoked).toEqual(direct);
	});

	it.each(['inventory', 'snapshot', 'query', 'impact', 'findings', 'explain', 'verify'])(
		'routes direct %s argv through the closed core admission contract',
		async (command) => {
			const roots = fixture();
			const result = await runCodingAgentProcess(
				[command, '--request-json', '{}', '--input-json', '{}', '--output', 'json'],
				roots
			);
			expect(result.exitCode).toBe(2);
			expect(result.stdout).toBe('');
			expect(JSON.parse(result.stderr)).toMatchObject({ messageKind: 'cli-diagnostic' });
			expect(existsSync(roots.storeRoot)).toBe(false);
		}
	);
});

describe('coding-agent process hostile-input refusal', () => {
	it('publishes a finite versioned stdin chunk ceiling for the trusted host reader', () => {
		expect(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxStdinChunks).toBe(65_536);
		expect(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxArtifactStdinBytes).toBe(16 * 1024 * 1024);
		expect(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxStdinBytes).toBe(16 * 1024 * 1024);
		expect(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxArtifactStdinBytes).toBeLessThan(
			CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
		);
	});

	it.runIf(process.platform !== 'win32')(
		'refuses a POSIX symlink in the default persistence path without writing outside',
		async () => {
			const fixtureRoots = fixture();
			const outside = mkdtempSync(join(tmpdir(), 'jan-csaa-process-outside-'));
			roots.push(outside);
			symlinkSync(outside, join(fixtureRoots.repositoryRoot, '.csaa'), 'dir');

			expect(
				await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
					repositoryRoot: fixtureRoots.repositoryRoot,
					stdin: '{}'
				})
			).toEqual(diagnostic(5, 'INTERNAL_FAILURE'));
			expect(existsSync(join(outside, 'coding-agent-artifacts'))).toBe(false);
		}
	);

	it.runIf(process.platform === 'win32')(
		'refuses a Windows junction in the default persistence path without writing outside',
		async () => {
			const fixtureRoots = fixture();
			const outside = mkdtempSync(join(tmpdir(), 'jan-csaa-process-outside-'));
			roots.push(outside);
			symlinkSync(outside, join(fixtureRoots.repositoryRoot, '.csaa'), 'junction');

			expect(
				await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
					repositoryRoot: fixtureRoots.repositoryRoot,
					stdin: '{}'
				})
			).toEqual(diagnostic(5, 'INTERNAL_FAILURE'));
			expect(existsSync(join(outside, 'coding-agent-artifacts'))).toBe(false);
		}
	);

	it.each([
		{
			code: 'STDIN_REQUIRED' as const,
			stdin: undefined
		},
		{
			code: 'STDIN_JSON_INVALID' as const,
			stdin: '{not-json'
		},
		{
			code: 'STDIN_JSON_DUPLICATE_KEY' as const,
			stdin: '{"outer":{"a":1,"\\u0061":2}}'
		},
		{
			code: 'STDIN_JSON_INVALID' as const,
			stdin: '1e999'
		},
		{
			code: 'STDIN_UNICODE_INVALID' as const,
			stdin: '{"value":"\\ud800"}'
		},
		{
			code: 'UNSAFE_PATH_REFUSED' as const,
			stdin: '{"source":"C:\\\\subject\\\\source.ts"}'
		},
		{
			code: 'UNSAFE_PATH_REFUSED' as const,
			stdin: '{"source":"../source.ts"}'
		}
	])('returns an exact diagnostic and publishes nothing for $code', async ({ code, stdin }) => {
		const roots = fixture();
		const result = await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
			...roots,
			stdin
		});
		expect(result).toEqual(diagnostic(2, code));
		expect(existsSync(roots.storeRoot)).toBe(false);
	});

	it('rejects malformed UTF-8, over-limit stdin, and excessive depth before publication', async () => {
		const invalidUtf8Roots = fixture();
		expect(
			await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
				...invalidUtf8Roots,
				stdin: Uint8Array.from([0xc3, 0x28])
			})
		).toEqual(diagnostic(2, 'STDIN_UNICODE_INVALID'));
		expect(existsSync(invalidUtf8Roots.storeRoot)).toBe(false);

		const oversizedRoots = fixture();
		expect(
			await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
				...oversizedRoots,
				stdin: new Uint8Array(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxStdinBytes + 1)
			})
		).toEqual(diagnostic(2, 'STDIN_LIMIT_EXCEEDED'));
		expect(existsSync(oversizedRoots.storeRoot)).toBe(false);

		const deepRoots = fixture();
		const deep = `${'['.repeat(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxJsonDepth + 2)}null${']'.repeat(
			CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxJsonDepth + 2
		)}`;
		expect(
			await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
				...deepRoots,
				stdin: deep
			})
		).toEqual(diagnostic(2, 'STDIN_LIMIT_EXCEEDED'));
		expect(existsSync(deepRoots.storeRoot)).toBe(false);
	});

	it('enforces the narrower invoke budget and one exact closed invocation envelope', async () => {
		const oversized = fixture();
		expect(
			await runCodingAgentProcess(['invoke', '--stdin'], {
				...oversized,
				stdin: new Uint8Array(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxInvocationStdinBytes + 1)
			})
		).toEqual(diagnostic(2, 'STDIN_LIMIT_EXCEEDED'));

		const open = fixture();
		expect(
			await runCodingAgentProcess(['invoke', '--stdin'], {
				...open,
				stdin: JSON.stringify({
					command: 'inventory',
					input: {},
					output: 'json',
					repositoryRoot: open.repositoryRoot,
					request: {},
					schemaVersion: CODING_AGENT_PROCESS_INVOCATION_VERSION
				})
			})
		).toEqual(diagnostic(2, 'INVOCATION_ENVELOPE_INVALID'));
		expect(existsSync(open.storeRoot)).toBe(false);
	});

	it('rejects open argv shapes and distinguishes invalid from unavailable artifacts', async () => {
		const roots = fixture();
		expect(
			await runCodingAgentProcess(['artifact', 'put', '--stdin', '--extra'], {
				...roots,
				stdin: '{}'
			})
		).toEqual(diagnostic(2, 'ARGUMENTS_INVALID'));
		expect(
			await runCodingAgentProcess(['artifact', 'get', '--reference', 'artifact:sha256:ABC'], roots)
		).toEqual(diagnostic(2, 'ARTIFACT_REFERENCE_INVALID'));
		expect(
			await runCodingAgentProcess(
				['artifact', 'get', '--reference', `artifact:sha256:${'f'.repeat(64)}`],
				roots
			)
		).toEqual(diagnostic(3, 'ARTIFACT_UNAVAILABLE'));
	});

	it('rejects non-data argv and maps trusted configuration and store failures exactly', async () => {
		const hostileRoots = fixture();
		const hostile = ['artifact', 'put', '--stdin'];
		Reflect.defineProperty(hostile, 'extra', { enumerable: true, value: 'not-an-argument' });
		expect(await runCodingAgentProcess(hostile, { ...hostileRoots, stdin: '{}' })).toEqual(
			diagnostic(2, 'ARGUMENTS_INVALID')
		);
		expect(existsSync(hostileRoots.storeRoot)).toBe(false);

		const invalidTrustedRoot = await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
			repositoryRoot: 'relative-subject-root',
			stdin: '{}'
		});
		expect(invalidTrustedRoot).toEqual(diagnostic(5, 'INTERNAL_FAILURE'));

		const unavailable = fixture();
		writeFileSync(unavailable.storeRoot, 'occupied-by-a-file', 'utf8');
		expect(
			await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
				...unavailable,
				stdin: '{}'
			})
		).toEqual(diagnostic(3, 'ARTIFACT_UNAVAILABLE'));
		expect(existsSync(unavailable.storeRoot)).toBe(true);
	});

	it('exercises the complete strict JSON token grammar and malformed delimiter boundaries', async () => {
		const roots = fixture();
		for (const stdin of ['[]', '-1', '0', '1.5', '1e+2', 'true', 'false', 'null'])
			expect(
				await runCodingAgentProcess(['artifact', 'put', '--stdin'], { ...roots, stdin }),
				stdin
			).toMatchObject({ exitCode: 0, stderr: '' });

		const malformed: readonly [string, CodingAgentProcessDiagnosticCode][] = [
			['', 'STDIN_JSON_INVALID'],
			['true false', 'STDIN_JSON_INVALID'],
			['?', 'STDIN_JSON_INVALID'],
			['{"a" 1}', 'STDIN_JSON_INVALID'],
			['{"a":1;}', 'STDIN_JSON_INVALID'],
			['[1;2]', 'STDIN_JSON_INVALID'],
			['"\\x"', 'STDIN_JSON_INVALID'],
			['"\\u12X4"', 'STDIN_JSON_INVALID'],
			['"unterminated', 'STDIN_JSON_INVALID'],
			['truX', 'STDIN_JSON_INVALID'],
			['-.1', 'STDIN_JSON_INVALID'],
			['1.', 'STDIN_JSON_INVALID'],
			['1e+', 'STDIN_JSON_INVALID'],
			['{"value":"\n"}', 'STDIN_JSON_INVALID'],
			['{"../unsafe":1}', 'UNSAFE_PATH_REFUSED']
		];
		for (const [stdin, code] of malformed)
			expect(
				await runCodingAgentProcess(['artifact', 'put', '--stdin'], { ...roots, stdin }),
				stdin
			).toEqual(diagnostic(2, code));

		const excessiveNodes = `[${Array.from(
			{ length: CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxJsonNodes },
			() => 'null'
		).join(',')}]`;
		expect(
			await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
				...roots,
				stdin: excessiveNodes
			})
		).toEqual(diagnostic(2, 'STDIN_LIMIT_EXCEEDED'));
	});

	it('rejects remaining stdin, argv descriptor, and trusted option shapes', async () => {
		const roots = fixture();
		expect(
			await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
				...roots,
				stdin: String.fromCharCode(0xd800)
			})
		).toEqual(diagnostic(2, 'STDIN_UNICODE_INVALID'));
		expect(
			await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
				...roots,
				stdin: Uint8Array.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d])
			})
		).toEqual(diagnostic(2, 'STDIN_UNICODE_INVALID'));
		expect(
			await runCodingAgentProcess(['artifact', 'put', '--stdin'], {
				...roots,
				stdin: 1 as never
			})
		).toEqual(diagnostic(2, 'STDIN_UNICODE_INVALID'));

		const proxyArgs = new Proxy(['artifact', 'put', '--stdin'], {});
		expect(await runCodingAgentProcess(proxyArgs, { ...roots, stdin: '{}' })).toEqual(
			diagnostic(2, 'ARGUMENTS_INVALID')
		);
		class ArgumentArray extends Array<string> {}
		expect(
			await runCodingAgentProcess(new ArgumentArray('artifact', 'put', '--stdin'), {
				...roots,
				stdin: '{}'
			})
		).toEqual(diagnostic(2, 'ARGUMENTS_INVALID'));
		expect(await runCodingAgentProcess([], roots)).toEqual(diagnostic(2, 'ARGUMENTS_INVALID'));
		const sparse = new Array<string>(3);
		sparse[0] = 'artifact';
		sparse[2] = '--stdin';
		expect(await runCodingAgentProcess(sparse, { ...roots, stdin: '{}' })).toEqual(
			diagnostic(2, 'ARGUMENTS_INVALID')
		);
		expect(
			await runCodingAgentProcess(
				['x'.repeat(CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxArgumentBytes + 1)],
				roots
			)
		).toEqual(diagnostic(2, 'ARGUMENTS_INVALID'));

		expect(await runCodingAgentProcess(['artifact'], null as never)).toEqual(
			diagnostic(5, 'INTERNAL_FAILURE')
		);
		expect(await runCodingAgentProcess(['artifact'], new Proxy(roots, {}) as never)).toEqual(
			diagnostic(5, 'INTERNAL_FAILURE')
		);
		expect(await runCodingAgentProcess(['artifact'], { ...roots, now: 1 as never })).toEqual(
			diagnostic(5, 'INTERNAL_FAILURE')
		);
		expect(await runCodingAgentProcess(['artifact'], { ...roots, signal: {} as never })).toEqual(
			diagnostic(5, 'INTERNAL_FAILURE')
		);
	});
});
