import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { isProxy } from 'node:util/types';

import type { AgentOperation } from '../agent/agent-operation-protocol.js';
import { canonicalSemanticJson, isUnicodeScalarString } from '../semantic/canonical.js';
import {
	CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS,
	CodingAgentCliArtifactError,
	codingAgentCliArtifactDigest,
	publishCodingAgentCliJsonArtifact,
	readCodingAgentCliJsonArtifact
} from './coding-agent-cli-artifact-store.js';
import { CODING_AGENT_CLI_SAFETY_CEILINGS } from './coding-agent-cli-contract.js';
import { composeCodingAgentCliHandlers } from './compose-coding-agent-cli-handlers.js';
import { ContentAddressedCodingAgentCliArtifactStore } from './content-addressed-coding-agent-cli-artifact-store.js';
import { runCodingAgentCli } from './run-coding-agent-cli.js';

export const CODING_AGENT_PROCESS_VERSION = 'jan-csaa-coding-agent-process/0.1.0' as const;
export const CODING_AGENT_PROCESS_INVOCATION_VERSION =
	'jan-csaa-coding-agent-process-invocation/0.1.0' as const;
export const CODING_AGENT_PROCESS_DIAGNOSTIC_VERSION =
	'jan-csaa-coding-agent-process-diagnostic/0.1.0' as const;
export const CODING_AGENT_PROCESS_ARTIFACT_RESULT_VERSION =
	'jan-csaa-coding-agent-process-artifact-result/0.1.0' as const;

/**
 * The outer reader may stop at maxStdinBytes without interpreting the command. Invocation admission
 * applies the narrower maxInvocationStdinBytes after exact argv classification.
 */
export const CODING_AGENT_PROCESS_SAFETY_CEILINGS = Object.freeze({
	maxArguments: CODING_AGENT_CLI_SAFETY_CEILINGS.maxArguments,
	maxArgumentBytes: CODING_AGENT_CLI_SAFETY_CEILINGS.maxArgumentBytes,
	maxArtifactStdinBytes: CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxTransportBytes,
	maxInvocationStdinBytes: CODING_AGENT_CLI_SAFETY_CEILINGS.maxArgumentBytes,
	maxJsonDepth: 64,
	maxJsonNodes: 262_144,
	maxStdinChunks: 65_536,
	maxStdinBytes: CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxTransportBytes
} as const);

export interface RunCodingAgentProcessOptions {
	/** Trusted absolute subject root naming an existing ordinary real directory. */
	readonly repositoryRoot: string;
	/**
	 * Trusted absolute persistence root. An explicit root retains trusted-host semantics and may be
	 * outside the repository. The default is confined through ordinary existing path components at
	 * repositoryRoot/.csaa/coding-agent-artifacts.
	 */
	readonly storeRoot?: string;
	/** Already-bounded host stdin. The process contract never reads ambient process.stdin itself. */
	readonly stdin?: string | Uint8Array;
	readonly now?: () => string;
	readonly signal?: AbortSignal;
}

export interface CodingAgentProcessResult {
	readonly exitCode: 0 | 2 | 3 | 4 | 5;
	readonly stderr: string;
	readonly stdout: string;
}

export type CodingAgentProcessDiagnosticCode =
	| 'ARGUMENTS_INVALID'
	| 'ARTIFACT_REFERENCE_INVALID'
	| 'ARTIFACT_UNAVAILABLE'
	| 'INTERNAL_FAILURE'
	| 'INVOCATION_ENVELOPE_INVALID'
	| 'PROCESS_CANCELLED'
	| 'STDIN_JSON_DUPLICATE_KEY'
	| 'STDIN_JSON_INVALID'
	| 'STDIN_LIMIT_EXCEEDED'
	| 'STDIN_REQUIRED'
	| 'STDIN_UNICODE_INVALID'
	| 'UNSAFE_PATH_REFUSED';

interface StrictJsonBudget {
	readonly maxDepth: number;
	readonly maxNodes: number;
	readonly maxStringBytes: number;
}

class ProcessAdmissionError extends Error {
	public constructor(readonly code: CodingAgentProcessDiagnosticCode) {
		super(code);
		this.name = 'ProcessAdmissionError';
	}
}

const COMMANDS = new Set<AgentOperation>([
	'explain',
	'findings',
	'impact',
	'inventory',
	'query',
	'snapshot',
	'verify'
]);

const DIAGNOSTIC_SUMMARIES = Object.freeze({
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

function diagnosticResult(
	exitCode: 2 | 3 | 5,
	code: CodingAgentProcessDiagnosticCode
): CodingAgentProcessResult {
	return Object.freeze({
		exitCode,
		stderr: `${canonicalSemanticJson({
			code,
			messageKind: 'coding-agent-process-diagnostic',
			processVersion: CODING_AGENT_PROCESS_VERSION,
			schemaVersion: CODING_AGENT_PROCESS_DIAGNOSTIC_VERSION,
			severity: 'ERROR',
			summary: DIAGNOSTIC_SUMMARIES[code]
		})}\n`,
		stdout: ''
	});
}

function dataObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const keys = Object.keys(value);
	return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

function trustedRoot(value: unknown): string {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.includes('\0') ||
		!isUnicodeScalarString(value) ||
		!isAbsolute(value)
	)
		throw new Error('Trusted process roots must be absolute scalar strings.');
	return resolve(value);
}

function errno(error: unknown): string | undefined {
	return typeof error === 'object' && error !== null && 'code' in error
		? String((error as NodeJS.ErrnoException).code)
		: undefined;
}

function inspectOrdinaryRealDirectory(path: string, label: string): 'MISSING' | 'PRESENT' {
	let canonical: string;
	let status;
	try {
		status = lstatSync(path);
	} catch (error) {
		if (errno(error) === 'ENOENT') return 'MISSING';
		throw new Error(`${label} must be an existing ordinary real directory.`);
	}
	try {
		canonical = realpathSync.native(path);
	} catch {
		throw new Error(`${label} must be an existing ordinary real directory.`);
	}
	if (status.isSymbolicLink() || !status.isDirectory() || relative(path, canonical) !== '')
		throw new Error(`${label} must be an existing ordinary real directory.`);
	return 'PRESENT';
}

function assertOrdinaryRealDirectory(path: string, label: string): void {
	if (inspectOrdinaryRealDirectory(path, label) === 'MISSING')
		throw new Error(`${label} must be an existing ordinary real directory.`);
}

function confinedDefaultStoreRoot(repositoryRoot: string): string {
	let candidate = repositoryRoot;
	for (const component of ['.csaa', 'coding-agent-artifacts']) {
		candidate = join(candidate, component);
		if (
			inspectOrdinaryRealDirectory(candidate, 'The default persistence path component') ===
			'MISSING'
		)
			return join(repositoryRoot, '.csaa', 'coding-agent-artifacts');
	}
	return candidate;
}

function materializeOptions(options: RunCodingAgentProcessOptions): {
	readonly now: (() => string) | undefined;
	readonly repositoryRoot: string;
	readonly signal: AbortSignal | undefined;
	readonly stdin: string | Uint8Array | undefined;
	readonly storeRoot: string;
} {
	if (options === null || typeof options !== 'object' || isProxy(options))
		throw new Error('Trusted process options are invalid.');
	const repositoryRoot = trustedRoot(options.repositoryRoot);
	assertOrdinaryRealDirectory(repositoryRoot, 'The repository root');
	const storeRoot =
		options.storeRoot === undefined
			? confinedDefaultStoreRoot(repositoryRoot)
			: trustedRoot(options.storeRoot);
	if (options.now !== undefined && typeof options.now !== 'function')
		throw new Error('The trusted time source is invalid.');
	if (options.signal !== undefined && !(options.signal instanceof AbortSignal))
		throw new Error('The trusted cancellation signal is invalid.');
	return {
		now: options.now,
		repositoryRoot,
		signal: options.signal,
		stdin: options.stdin,
		storeRoot
	};
}

function materializeArguments(args: readonly string[]): readonly string[] {
	if (!Array.isArray(args) || isProxy(args)) throw new ProcessAdmissionError('ARGUMENTS_INVALID');
	if (Reflect.getPrototypeOf(args) !== Array.prototype)
		throw new ProcessAdmissionError('ARGUMENTS_INVALID');
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(args, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		lengthDescriptor.value < 1 ||
		lengthDescriptor.value > CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxArguments
	)
		throw new ProcessAdmissionError('ARGUMENTS_INVALID');
	const length = lengthDescriptor.value as number;
	if (
		Reflect.ownKeys(args).some(
			(key) =>
				typeof key !== 'string' ||
				(key !== 'length' && !/^\d+$/u.test(key)) ||
				(key !== 'length' && String(Number(key)) !== key) ||
				(key !== 'length' && Number(key) >= length)
		)
	)
		throw new ProcessAdmissionError('ARGUMENTS_INVALID');
	const materialized: string[] = [];
	let bytes = 0;
	for (let index = 0; index < length; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(args, String(index));
		if (
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor) ||
			typeof descriptor.value !== 'string' ||
			descriptor.value.includes('\0') ||
			!isUnicodeScalarString(descriptor.value)
		)
			throw new ProcessAdmissionError('ARGUMENTS_INVALID');
		bytes += Buffer.byteLength(descriptor.value, 'utf8');
		if (bytes > CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxArgumentBytes)
			throw new ProcessAdmissionError('ARGUMENTS_INVALID');
		materialized.push(descriptor.value);
	}
	return Object.freeze(materialized);
}

function materializeStdin(input: string | Uint8Array | undefined, maximumBytes: number): string {
	if (input === undefined) throw new ProcessAdmissionError('STDIN_REQUIRED');
	if (typeof input === 'string') {
		if (!isUnicodeScalarString(input)) throw new ProcessAdmissionError('STDIN_UNICODE_INVALID');
		if (Buffer.byteLength(input, 'utf8') > maximumBytes)
			throw new ProcessAdmissionError('STDIN_LIMIT_EXCEEDED');
		return input;
	}
	if (!(input instanceof Uint8Array) || isProxy(input))
		throw new ProcessAdmissionError('STDIN_UNICODE_INVALID');
	if (input.byteLength > maximumBytes) throw new ProcessAdmissionError('STDIN_LIMIT_EXCEEDED');
	const bytes = Uint8Array.from(input);
	if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
		throw new ProcessAdmissionError('STDIN_UNICODE_INVALID');
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new ProcessAdmissionError('STDIN_UNICODE_INVALID');
	}
	if (!isUnicodeScalarString(text)) throw new ProcessAdmissionError('STDIN_UNICODE_INVALID');
	return text;
}

class StrictJsonParser {
	#index = 0;
	#nodes = 0;
	#stringBytes = 0;

	public constructor(
		private readonly text: string,
		private readonly budget: StrictJsonBudget
	) {}

	public parse(): unknown {
		this.#whitespace();
		if (this.#index === this.text.length) throw new ProcessAdmissionError('STDIN_JSON_INVALID');
		const value = this.#value(0);
		this.#whitespace();
		if (this.#index !== this.text.length) throw new ProcessAdmissionError('STDIN_JSON_INVALID');
		try {
			canonicalSemanticJson(value);
		} catch {
			throw new ProcessAdmissionError('STDIN_JSON_INVALID');
		}
		return value;
	}

	#node(): void {
		this.#nodes += 1;
		if (this.#nodes > this.budget.maxNodes) throw new ProcessAdmissionError('STDIN_LIMIT_EXCEEDED');
	}

	#value(depth: number): unknown {
		if (depth > this.budget.maxDepth) throw new ProcessAdmissionError('STDIN_LIMIT_EXCEEDED');
		this.#node();
		const character = this.text[this.#index];
		if (character === '{') return this.#object(depth);
		if (character === '[') return this.#array(depth);
		if (character === '"') return this.#string();
		if (character === 't') return this.#literal('true', true);
		if (character === 'f') return this.#literal('false', false);
		if (character === 'n') return this.#literal('null', null);
		if (character === '-' || (character !== undefined && character >= '0' && character <= '9'))
			return this.#number();
		throw new ProcessAdmissionError('STDIN_JSON_INVALID');
	}

	#object(depth: number): Record<string, unknown> {
		this.#index += 1;
		this.#whitespace();
		const value = Object.create(null) as Record<string, unknown>;
		const keys = new Set<string>();
		if (this.text[this.#index] === '}') {
			this.#index += 1;
			return value;
		}
		while (true) {
			if (this.text[this.#index] !== '"') throw new ProcessAdmissionError('STDIN_JSON_INVALID');
			this.#node();
			const key = this.#string();
			if (keys.has(key)) throw new ProcessAdmissionError('STDIN_JSON_DUPLICATE_KEY');
			keys.add(key);
			this.#whitespace();
			if (this.text[this.#index] !== ':') throw new ProcessAdmissionError('STDIN_JSON_INVALID');
			this.#index += 1;
			this.#whitespace();
			Reflect.defineProperty(value, key, {
				configurable: true,
				enumerable: true,
				value: this.#value(depth + 1),
				writable: true
			});
			this.#whitespace();
			const delimiter = this.text[this.#index];
			if (delimiter === '}') {
				this.#index += 1;
				return value;
			}
			if (delimiter !== ',') throw new ProcessAdmissionError('STDIN_JSON_INVALID');
			this.#index += 1;
			this.#whitespace();
		}
	}

	#array(depth: number): readonly unknown[] {
		this.#index += 1;
		this.#whitespace();
		const value: unknown[] = [];
		if (this.text[this.#index] === ']') {
			this.#index += 1;
			return value;
		}
		while (true) {
			value.push(this.#value(depth + 1));
			this.#whitespace();
			const delimiter = this.text[this.#index];
			if (delimiter === ']') {
				this.#index += 1;
				return value;
			}
			if (delimiter !== ',') throw new ProcessAdmissionError('STDIN_JSON_INVALID');
			this.#index += 1;
			this.#whitespace();
		}
	}

	#string(): string {
		const start = this.#index;
		this.#index += 1;
		while (this.#index < this.text.length) {
			const code = this.text.charCodeAt(this.#index);
			if (code === 0x22) {
				this.#index += 1;
				let value: string;
				try {
					value = JSON.parse(this.text.slice(start, this.#index)) as string;
				} catch {
					throw new ProcessAdmissionError('STDIN_JSON_INVALID');
				}
				if (!isUnicodeScalarString(value)) throw new ProcessAdmissionError('STDIN_UNICODE_INVALID');
				this.#stringBytes += Buffer.byteLength(value, 'utf8');
				if (this.#stringBytes > this.budget.maxStringBytes)
					throw new ProcessAdmissionError('STDIN_LIMIT_EXCEEDED');
				return value;
			}
			if (code < 0x20) throw new ProcessAdmissionError('STDIN_JSON_INVALID');
			if (code === 0x5c) {
				this.#index += 1;
				const escaped = this.text[this.#index];
				if (escaped === 'u') {
					const digits = this.text.slice(this.#index + 1, this.#index + 5);
					if (digits.length !== 4 || !/^[0-9a-fA-F]{4}$/u.test(digits))
						throw new ProcessAdmissionError('STDIN_JSON_INVALID');
					this.#index += 5;
					continue;
				}
				if (escaped === undefined || !'"\\/bfnrt'.includes(escaped))
					throw new ProcessAdmissionError('STDIN_JSON_INVALID');
			}
			this.#index += 1;
		}
		throw new ProcessAdmissionError('STDIN_JSON_INVALID');
	}

	#literal(token: string, value: boolean | null): boolean | null {
		if (this.text.slice(this.#index, this.#index + token.length) !== token)
			throw new ProcessAdmissionError('STDIN_JSON_INVALID');
		this.#index += token.length;
		return value;
	}

	#number(): number {
		const start = this.#index;
		if (this.text[this.#index] === '-') this.#index += 1;
		if (this.text[this.#index] === '0') this.#index += 1;
		else {
			const first = this.text[this.#index];
			if (first === undefined || first < '1' || first > '9')
				throw new ProcessAdmissionError('STDIN_JSON_INVALID');
			do this.#index += 1;
			while (
				this.text[this.#index] !== undefined &&
				this.text[this.#index]! >= '0' &&
				this.text[this.#index]! <= '9'
			);
		}
		if (this.text[this.#index] === '.') {
			this.#index += 1;
			const first = this.text[this.#index];
			if (first === undefined || first < '0' || first > '9')
				throw new ProcessAdmissionError('STDIN_JSON_INVALID');
			do this.#index += 1;
			while (
				this.text[this.#index] !== undefined &&
				this.text[this.#index]! >= '0' &&
				this.text[this.#index]! <= '9'
			);
		}
		if (this.text[this.#index] === 'e' || this.text[this.#index] === 'E') {
			this.#index += 1;
			if (this.text[this.#index] === '+' || this.text[this.#index] === '-') this.#index += 1;
			const first = this.text[this.#index];
			if (first === undefined || first < '0' || first > '9')
				throw new ProcessAdmissionError('STDIN_JSON_INVALID');
			do this.#index += 1;
			while (
				this.text[this.#index] !== undefined &&
				this.text[this.#index]! >= '0' &&
				this.text[this.#index]! <= '9'
			);
		}
		const value = Number(this.text.slice(start, this.#index));
		if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
			throw new ProcessAdmissionError('STDIN_JSON_INVALID');
		return value;
	}

	#whitespace(): void {
		while (
			this.text[this.#index] === ' ' ||
			this.text[this.#index] === '\n' ||
			this.text[this.#index] === '\r' ||
			this.text[this.#index] === '\t'
		)
			this.#index += 1;
	}
}

function strictJson(input: string | Uint8Array | undefined, maximumBytes: number): unknown {
	const text = materializeStdin(input, maximumBytes);
	return new StrictJsonParser(text, {
		maxDepth: CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxJsonDepth,
		maxNodes: CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxJsonNodes,
		maxStringBytes: maximumBytes
	}).parse();
}

function isUnsafeHostPath(value: string): boolean {
	return (
		value.includes('\0') ||
		value.includes('\\') ||
		/^(?:[a-zA-Z]:[\\/]|file:|\/)/u.test(value) ||
		value.split('/').includes('..')
	);
}

function refuseUnsafeHostPaths(value: unknown): void {
	const pending: unknown[] = [value];
	while (pending.length > 0) {
		const current = pending.pop();
		if (typeof current === 'string') {
			if (isUnsafeHostPath(current)) throw new ProcessAdmissionError('UNSAFE_PATH_REFUSED');
			continue;
		}
		if (Array.isArray(current)) {
			for (const item of current) pending.push(item);
			continue;
		}
		if (dataObject(current)) {
			for (const [key, item] of Object.entries(current)) {
				if (isUnsafeHostPath(key)) throw new ProcessAdmissionError('UNSAFE_PATH_REFUSED');
				pending.push(item);
			}
		}
	}
}

function invocationArguments(value: unknown): readonly string[] {
	if (
		!dataObject(value) ||
		!exactKeys(value, ['schemaVersion', 'command', 'request', 'input', 'output']) ||
		value.schemaVersion !== CODING_AGENT_PROCESS_INVOCATION_VERSION ||
		typeof value.command !== 'string' ||
		!COMMANDS.has(value.command as AgentOperation) ||
		!dataObject(value.request) ||
		!dataObject(value.input) ||
		value.output !== 'json'
	)
		throw new ProcessAdmissionError('INVOCATION_ENVELOPE_INVALID');
	refuseUnsafeHostPaths(value);
	let requestJson: string;
	let inputJson: string;
	try {
		requestJson = canonicalSemanticJson(value.request);
		inputJson = canonicalSemanticJson(value.input);
	} catch {
		throw new ProcessAdmissionError('STDIN_JSON_INVALID');
	}
	return Object.freeze([
		value.command,
		'--request-json',
		requestJson,
		'--input-json',
		inputJson,
		'--output',
		'json'
	]);
}

function processResult(result: {
	readonly exitCode: 0 | 2 | 3 | 4 | 5;
	readonly stderr: string;
	readonly stdout: string;
}): CodingAgentProcessResult {
	return Object.freeze({
		exitCode: result.exitCode,
		stderr: result.stderr,
		stdout: result.stdout
	});
}

async function runCli(
	args: readonly string[],
	options: ReturnType<typeof materializeOptions>
): Promise<CodingAgentProcessResult> {
	const store = new ContentAddressedCodingAgentCliArtifactStore(options.storeRoot);
	const handlers = composeCodingAgentCliHandlers({
		artifactStore: store,
		repositoryRoot: options.repositoryRoot
	});
	return processResult(
		await runCodingAgentCli(args, {
			artifactTransaction: store,
			handlers,
			now: options.now,
			signal: options.signal
		})
	);
}

async function putArtifact(
	options: ReturnType<typeof materializeOptions>
): Promise<CodingAgentProcessResult> {
	const value = strictJson(
		options.stdin,
		CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxArtifactStdinBytes
	);
	refuseUnsafeHostPaths(value);
	const store = new ContentAddressedCodingAgentCliArtifactStore(options.storeRoot);
	let transactionBegun = false;
	try {
		store.begin(options.signal);
		transactionBegun = true;
		const artifact = await publishCodingAgentCliJsonArtifact(
			store,
			value,
			CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxArtifactStdinBytes
		);
		store.commit();
		transactionBegun = false;
		return Object.freeze({
			exitCode: 0,
			stderr: '',
			stdout: `${canonicalSemanticJson({
				artifact,
				messageKind: 'artifact-published',
				processVersion: CODING_AGENT_PROCESS_VERSION,
				schemaVersion: CODING_AGENT_PROCESS_ARTIFACT_RESULT_VERSION
			})}\n`
		});
	} catch (error) {
		if (transactionBegun) {
			try {
				store.rollback();
			} catch {
				// Rollback remains best effort after a store refusal; no staged artifact is published.
			}
		}
		if (error instanceof ProcessAdmissionError) throw error;
		return diagnosticResult(3, 'ARTIFACT_UNAVAILABLE');
	}
}

async function getArtifact(
	reference: string,
	options: ReturnType<typeof materializeOptions>
): Promise<CodingAgentProcessResult> {
	try {
		codingAgentCliArtifactDigest(reference);
	} catch {
		return diagnosticResult(2, 'ARTIFACT_REFERENCE_INVALID');
	}
	try {
		const value = await readCodingAgentCliJsonArtifact(
			new ContentAddressedCodingAgentCliArtifactStore(options.storeRoot),
			reference,
			CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxArtifactStdinBytes
		);
		return Object.freeze({ exitCode: 0, stderr: '', stdout: `${canonicalSemanticJson(value)}\n` });
	} catch (error) {
		if (error instanceof CodingAgentCliArtifactError)
			return diagnosticResult(3, 'ARTIFACT_UNAVAILABLE');
		return diagnosticResult(5, 'INTERNAL_FAILURE');
	}
}

/**
 * Pure process adapter: argv/stdin are admitted as data, while repository and persistence roots
 * come only from the trusted host. It never spawns, imports subject modules, opens network access,
 * accepts output paths, or mutates subject source.
 */
export async function runCodingAgentProcess(
	args: readonly string[],
	options: RunCodingAgentProcessOptions
): Promise<CodingAgentProcessResult> {
	try {
		const trusted = materializeOptions(options);
		const argv = materializeArguments(args);
		if (trusted.signal?.aborted === true) return diagnosticResult(3, 'PROCESS_CANCELLED');
		if (argv[0] === 'invoke') {
			if (argv.length !== 2 || argv[1] !== '--stdin')
				throw new ProcessAdmissionError('ARGUMENTS_INVALID');
			const value = strictJson(
				trusted.stdin,
				CODING_AGENT_PROCESS_SAFETY_CEILINGS.maxInvocationStdinBytes
			);
			return await runCli(invocationArguments(value), trusted);
		}
		if (argv[0] === 'artifact') {
			if (argv.length === 3 && argv[1] === 'put' && argv[2] === '--stdin')
				return await putArtifact(trusted);
			if (
				argv.length === 4 &&
				argv[1] === 'get' &&
				argv[2] === '--reference' &&
				argv[3] !== undefined
			)
				return await getArtifact(argv[3], trusted);
			throw new ProcessAdmissionError('ARGUMENTS_INVALID');
		}
		if (!COMMANDS.has(argv[0] as AgentOperation))
			throw new ProcessAdmissionError('ARGUMENTS_INVALID');
		return await runCli(argv, trusted);
	} catch (error) {
		if (error instanceof ProcessAdmissionError) return diagnosticResult(2, error.code);
		return diagnosticResult(5, 'INTERNAL_FAILURE');
	}
}
