import { spawn } from 'node:child_process';
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { isProxy } from 'node:util/types';

import {
	ARROW_COMMAND_CENSUS_ADAPTER_ID,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	type ArrowCommandCensusArtifactSetBinding,
	type ArrowCommandCensusDiagnostic,
	type ArrowCommandCensusDiagnosticCode,
	type ObserveArrowCommandCensusOutcome,
	type ObserveArrowCommandCensusRequest
} from '../../contracts/arrow-command-census.js';
import type { FrozenSubject } from '../../contracts/subject.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
import {
	isFrozenSubjectCapability,
	readFrozenSubjectArtifact
} from '../../subject/frozen-store.js';
import { assertCanonicalRelativePath } from '../../subject/paths.js';
import { validateArrowCommandCensusArtifactSet } from './artifact-set.js';
import {
	ArrowCommandCensusExecutorEnvironmentError,
	resolveArrowCommandCensusExecutorEnvironment
} from './executor-environment.js';
import {
	ArrowCommandCensusNormalizationError,
	normalizeArrowCommandCensusObservation
} from './normalize-arrow-command-census.js';
import {
	ArrowCommandCensusRawOutputError,
	parseArrowCommandCensusWorkerOutput
} from './parse-worker-output.js';
import { ARROW_COMMAND_CENSUS_WORKER_REQUEST_SCHEMA_VERSION } from './worker.js';

const WORKER_PATH = fileURLToPath(new URL('./worker.ts', import.meta.url));
const ANALYZER_PATH = 'verif/arrow-command-census.ts';
export const ARROW_COMMAND_CENSUS_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-progress/1.0.0' as const;
const BUDGET_KEYS = [
	'maxArtifacts',
	'maxBirthStates',
	'maxDeclaredArrowOccurrences',
	'maxDeclaredSites',
	'maxDiagnostics',
	'maxExecutorDurationMs',
	'maxExternalModuleBytes',
	'maxExternalModuleFiles',
	'maxMachines',
	'maxMapStates',
	'maxMaterializedBytes',
	'maxOutputStringCharacters',
	'maxRawArrayEntries',
	'maxRawJsonDepth',
	'maxStderrBytes',
	'maxStdoutBytes'
] as const;

type PlainRecord = Record<string, unknown>;

export type ArrowCommandCensusProgressPhase =
	| 'CAPSULE_CLEANUP'
	| 'CAPSULE_MATERIALIZATION'
	| 'EXECUTOR_ENVIRONMENT_CAPTURE'
	| 'OBSERVATION_NORMALIZATION'
	| 'POST_EXECUTION_INTEGRITY_RECHECK'
	| 'REQUEST_AND_ARTIFACT_BIND'
	| 'RETAINED_VERIFIER_EXECUTION'
	| 'RETAINED_VERIFIER_RESULT_ACCEPTANCE'
	| 'WORKER_OUTPUT_PARSE_AND_RUNTIME_RECONCILE';

export interface ArrowCommandCensusProgressEvent {
	readonly adapterElapsedMs: number;
	readonly details: Readonly<Record<string, unknown>>;
	readonly durationMs?: number;
	readonly event: 'CSAA_ARROW_COMMAND_CENSUS_PHASE';
	readonly phase: ArrowCommandCensusProgressPhase;
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly state: 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'STARTED';
	readonly timestamp: string;
}

export interface ObserveArrowCommandCensusOptions {
	/** Out-of-band progress only. It is excluded from evidence and identity calculations. */
	readonly onProgress?: (event: ArrowCommandCensusProgressEvent) => void;
}

interface ArrowCommandCensusProgressRecorder {
	complete(details?: Readonly<Record<string, unknown>>): void;
	fail(error: unknown): void;
	skip(phase: ArrowCommandCensusProgressPhase, details: Readonly<Record<string, unknown>>): void;
	start(phase: ArrowCommandCensusProgressPhase, details?: Readonly<Record<string, unknown>>): void;
}

class ObserveFailure extends Error {
	constructor(readonly diagnostic: ArrowCommandCensusDiagnostic) {
		super(diagnostic.message);
	}
}

function safeProgressSink(
	options: ObserveArrowCommandCensusOptions | undefined
): ((event: ArrowCommandCensusProgressEvent) => void) | undefined {
	try {
		if (options === undefined || options === null || isProxy(options)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: ArrowCommandCensusProgressEvent) => void)
			: undefined;
	} catch {
		return undefined;
	}
}

function progressError(error: unknown): Readonly<Record<string, unknown>> {
	if (error instanceof ObserveFailure) return { code: error.diagnostic.code };
	if (error instanceof ArrowCommandCensusExecutorEnvironmentError) return { code: error.code };
	if (error instanceof ArrowCommandCensusRawOutputError) return { code: 'RAW_OUTPUT_INVALID' };
	if (error instanceof ArrowCommandCensusNormalizationError)
		return { code: 'OBSERVATION_VALIDATION_FAILED' };
	return { code: 'UNCLASSIFIED_FAILURE' };
}

function createProgressRecorder(
	options: ObserveArrowCommandCensusOptions | undefined
): ArrowCommandCensusProgressRecorder {
	const sink = safeProgressSink(options);
	const adapterStartedAtMonotonicMs = performance.now();
	let sequence = 0;
	let active: {
		readonly phase: ArrowCommandCensusProgressPhase;
		readonly startedAtMonotonicMs: number;
	} | null = null;
	const emit = (
		phase: ArrowCommandCensusProgressPhase,
		state: ArrowCommandCensusProgressEvent['state'],
		details: Readonly<Record<string, unknown>>,
		wallTimestampMs: number,
		monotonicTimestampMs: number,
		durationMs?: number
	): void => {
		const event: ArrowCommandCensusProgressEvent = {
			adapterElapsedMs: Math.max(0, monotonicTimestampMs - adapterStartedAtMonotonicMs),
			details,
			event: 'CSAA_ARROW_COMMAND_CENSUS_PHASE',
			phase,
			schemaVersion: ARROW_COMMAND_CENSUS_PROGRESS_SCHEMA_VERSION,
			sequence,
			state,
			timestamp: new Date(wallTimestampMs).toISOString(),
			...(durationMs === undefined ? {} : { durationMs })
		};
		sequence += 1;
		try {
			sink?.(event);
		} catch {
			// Progress is deliberately unable to affect retained-verifier evidence or outcome.
		}
	};
	return {
		complete(details = {}): void {
			if (active === null) return;
			const finishedAtMonotonicMs = performance.now();
			emit(
				active.phase,
				'COMPLETED',
				details,
				Date.now(),
				finishedAtMonotonicMs,
				Math.max(0, finishedAtMonotonicMs - active.startedAtMonotonicMs)
			);
			active = null;
		},
		fail(error: unknown): void {
			if (active === null) return;
			const failedAtMonotonicMs = performance.now();
			emit(
				active.phase,
				'FAILED',
				progressError(error),
				Date.now(),
				failedAtMonotonicMs,
				Math.max(0, failedAtMonotonicMs - active.startedAtMonotonicMs)
			);
			active = null;
		},
		skip(phase, details): void {
			emit(phase, 'SKIPPED', details, Date.now(), performance.now(), 0);
		},
		start(phase, details = {}): void {
			const startedAtMonotonicMs = performance.now();
			active = { phase, startedAtMonotonicMs };
			emit(phase, 'STARTED', details, Date.now(), startedAtMonotonicMs);
		}
	};
}

function fail(
	code: ArrowCommandCensusDiagnosticCode,
	phase: ArrowCommandCensusDiagnostic['phase'],
	message: string,
	path: string | null = null
): never {
	throw new ObserveFailure({ code, message, path, phase, severity: 'ERROR' });
}

function plainRecord(value: unknown, path: string, keys: readonly string[]): PlainRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		fail('REQUEST_INVALID', 'REQUEST', 'Expected a plain, non-Proxy record.', path);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		fail('REQUEST_INVALID', 'REQUEST', 'Expected a plain record.', path);
	const own = Reflect.ownKeys(value);
	if (
		own.some((key) => typeof key !== 'string') ||
		own.length !== keys.length ||
		(own as string[]).some((key) => !keys.includes(key))
	)
		fail('REQUEST_INVALID', 'REQUEST', 'Request field population is not exact.', path);
	for (const key of keys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
			fail('REQUEST_INVALID', 'REQUEST', 'Expected enumerable data properties.', `${path}.${key}`);
	}
	return value as PlainRecord;
}

function data(record: PlainRecord, key: string): unknown {
	return Reflect.getOwnPropertyDescriptor(record, key)?.value;
}

function closedRequest(value: unknown): ObserveArrowCommandCensusRequest {
	const request = plainRecord(value, '$request', [
		'artifactSetId',
		'budgets',
		'operationVersion',
		'schemaVersion',
		'subjectId'
	]);
	if (data(request, 'schemaVersion') !== ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION)
		fail(
			'REQUEST_INVALID',
			'REQUEST',
			'Unsupported request schema version.',
			'$request.schemaVersion'
		);
	if (data(request, 'operationVersion') !== ARROW_COMMAND_CENSUS_OPERATION_VERSION)
		fail(
			'REQUEST_INVALID',
			'REQUEST',
			'Unsupported operation version.',
			'$request.operationVersion'
		);
	for (const key of ['artifactSetId', 'subjectId'] as const) {
		const value = data(request, key);
		if (typeof value !== 'string' || value.length === 0)
			fail('REQUEST_INVALID', 'REQUEST', 'Identity must be nonempty text.', `$request.${key}`);
	}
	const budgets = plainRecord(data(request, 'budgets'), '$request.budgets', BUDGET_KEYS);
	for (const key of BUDGET_KEYS) {
		const value = data(budgets, key);
		if (!Number.isSafeInteger(value) || (value as number) <= 0)
			fail(
				'REQUEST_INVALID',
				'REQUEST',
				'Budgets must be caller-supplied positive safe integers.',
				`$request.budgets.${key}`
			);
	}
	return value as ObserveArrowCommandCensusRequest;
}

function contained(root: string, candidate: string): boolean {
	const fromRoot = relative(root, candidate);
	return (
		fromRoot === '' ||
		(!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
	);
}

function materializedPath(capsuleRoot: string, artifactPath: string): string {
	assertCanonicalRelativePath(artifactPath);
	if (artifactPath.startsWith('packages/rph-domain/'))
		return join(
			capsuleRoot,
			'node_modules',
			'@janumipwb',
			'rph-domain',
			...artifactPath.slice('packages/rph-domain/'.length).split('/')
		);
	if (artifactPath.startsWith('packages/rph-contracts/'))
		return join(
			capsuleRoot,
			'node_modules',
			'@janumipwb',
			'rph-contracts',
			...artifactPath.slice('packages/rph-contracts/'.length).split('/')
		);
	return join(capsuleRoot, ...artifactPath.split('/'));
}

function writeCapsule(
	capsuleRoot: string,
	artifactSet: ArrowCommandCensusArtifactSetBinding,
	subject: FrozenSubject,
	workerBytes: Uint8Array,
	maximum: number
): readonly { readonly absolutePath: string; readonly path: string; readonly sha256: string }[] {
	const total = artifactSet.artifacts.reduce(
		(sum, artifact) => sum + artifact.bytes,
		workerBytes.byteLength
	);
	if (!Number.isSafeInteger(total) || total > maximum)
		fail(
			'BUDGET_EXHAUSTED',
			'BIND',
			`Materialized bytes ${total} exceed the caller budget ${maximum}.`,
			'$request.budgets.maxMaterializedBytes'
		);
	const written: { absolutePath: string; path: string; sha256: string }[] = [];
	for (const artifact of artifactSet.artifacts) {
		const bytes = readFrozenSubjectArtifact(subject, artifact.path);
		if (
			bytes === undefined ||
			bytes.byteLength !== artifact.bytes ||
			sha256(bytes) !== artifact.sha256
		)
			fail(
				'ARTIFACT_SET_IDENTITY_MISMATCH',
				'BIND',
				'Frozen artifact bytes do not reproduce the selected artifact binding.',
				artifact.path
			);
		const absolutePath = materializedPath(capsuleRoot, artifact.path);
		if (!contained(capsuleRoot, absolutePath))
			fail('ARTIFACT_SET_INVALID', 'BIND', 'Materialized artifact escapes capsule.', artifact.path);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, bytes, { flag: 'wx' });
		written.push({ absolutePath, path: artifact.path, sha256: artifact.sha256 });
	}
	const capsuleWorker = join(capsuleRoot, '.csaa', 'worker.ts');
	mkdirSync(dirname(capsuleWorker), { recursive: true });
	writeFileSync(capsuleWorker, workerBytes, { flag: 'wx' });
	return written;
}

function makeReadOnly(paths: readonly string[]): void {
	for (const path of paths) {
		try {
			chmodSync(path, 0o444);
		} catch {
			// Post-execution byte verification remains authoritative where ACLs ignore POSIX modes.
		}
	}
}

function linkModule(capsuleRoot: string, name: string, target: string): void {
	const destination = join(capsuleRoot, 'node_modules', name);
	mkdirSync(dirname(destination), { recursive: true });
	symlinkSync(target, destination, process.platform === 'win32' ? 'junction' : 'dir');
}

interface ProcessResult {
	readonly exitCode: number | null;
	readonly stderr: Uint8Array;
	readonly stdout: Uint8Array;
}

async function runWorker(
	executable: string,
	workerPath: string,
	requestBytes: Uint8Array,
	budgets: ObserveArrowCommandCensusRequest['budgets']
): Promise<ProcessResult> {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(executable, ['--no-install', '--conditions=source', workerPath], {
			env: Object.fromEntries(
				Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PIN_ARROW_BASELINE')
			),
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		let stdoutBytes = 0;
		let stderrBytes = 0;
		let budgetFailure: ObserveFailure | null = null;
		let settled = false;
		const stop = (failure: ObserveFailure): void => {
			budgetFailure ??= failure;
			child.kill();
		};
		const timer = setTimeout(() => {
			stop(
				new ObserveFailure({
					code: 'BUDGET_EXHAUSTED',
					message: 'Retained verifier duration exceeds the caller budget.',
					path: '$request.budgets.maxExecutorDurationMs',
					phase: 'EXECUTE',
					severity: 'ERROR'
				})
			);
		}, budgets.maxExecutorDurationMs);
		child.stdout.on('data', (chunk: Buffer) => {
			stdoutBytes += chunk.byteLength;
			if (stdoutBytes > budgets.maxStdoutBytes)
				stop(
					new ObserveFailure({
						code: 'BUDGET_EXHAUSTED',
						message: 'Worker stdout exceeds the caller byte budget.',
						path: '$request.budgets.maxStdoutBytes',
						phase: 'EXECUTE',
						severity: 'ERROR'
					})
				);
			else stdout.push(Buffer.from(chunk));
		});
		child.stderr.on('data', (chunk: Buffer) => {
			stderrBytes += chunk.byteLength;
			if (stderrBytes > budgets.maxStderrBytes)
				stop(
					new ObserveFailure({
						code: 'BUDGET_EXHAUSTED',
						message: 'Worker stderr exceeds the caller byte budget.',
						path: '$request.budgets.maxStderrBytes',
						phase: 'EXECUTE',
						severity: 'ERROR'
					})
				);
			else stderr.push(Buffer.from(chunk));
		});
		child.once('error', (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			rejectPromise(error);
		});
		child.once('close', (exitCode) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (budgetFailure !== null) rejectPromise(budgetFailure);
			else
				resolvePromise({
					exitCode,
					stderr: Buffer.concat(stderr),
					stdout: Buffer.concat(stdout)
				});
		});
		child.stdin.end(requestBytes);
	});
}

function exactJson(bytes: Uint8Array): unknown {
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		fail('RAW_OUTPUT_INVALID', 'NORMALIZE', 'Worker stdout is not valid UTF-8.', '$worker');
	}
	if (!text.endsWith('\n') || text.endsWith('\n\n') || text.includes('\r'))
		fail(
			'RAW_OUTPUT_INVALID',
			'NORMALIZE',
			'Worker stdout must be exactly one JSON value followed by LF.',
			'$worker'
		);
	try {
		return JSON.parse(text.slice(0, -1));
	} catch {
		return fail('RAW_OUTPUT_INVALID', 'NORMALIZE', 'Worker stdout is not valid JSON.', '$worker');
	}
}

function stderrIdentity(bytes: Uint8Array): string {
	return `${bytes.byteLength} stderr bytes (SHA-256 ${sha256(bytes)})`;
}

function publicExecutorErrorPath(error: ArrowCommandCensusExecutorEnvironmentError): string {
	if (error.moduleName !== null) return `$executor.externalModules.${error.moduleName}`;
	switch (error.code) {
		case 'BUDGET_EXHAUSTED':
			return '$request.budgets';
		case 'BUN_REQUIRED':
		case 'EXECUTABLE_INVALID':
			return '$executor.runtime';
		case 'REQUEST_INVALID':
			return '$executor.request';
		case 'WORKER_INVALID':
			return '$executor.worker';
		default:
			return '$executor';
	}
}

function verifyCapsuleBytes(
	written: readonly {
		readonly absolutePath: string;
		readonly path: string;
		readonly sha256: string;
	}[]
): void {
	for (const artifact of written) {
		let digest: string;
		try {
			digest = sha256(readFileSync(artifact.absolutePath));
		} catch {
			fail(
				'ARTIFACT_SET_IDENTITY_MISMATCH',
				'VALIDATE',
				'Materialized subject evidence disappeared during execution.',
				artifact.path
			);
		}
		if (digest !== artifact.sha256)
			fail(
				'ARTIFACT_SET_IDENTITY_MISMATCH',
				'VALIDATE',
				'Materialized subject evidence changed during execution.',
				artifact.path
			);
	}
}

function verifyRuntimeModulePath(value: string, moduleRoot: string, moduleName: string): void {
	let path: string;
	try {
		path = realpathSync.native(value);
	} catch {
		fail(
			'EXECUTOR_IDENTITY_MISMATCH',
			'VALIDATE',
			`Worker-reported ${moduleName} path does not resolve.`,
			'$worker.runtime'
		);
	}
	if (!contained(moduleRoot, path))
		fail(
			'EXECUTOR_IDENTITY_MISMATCH',
			'VALIDATE',
			`Worker-reported ${moduleName} path is outside the captured module tree.`,
			'$worker.runtime'
		);
}

export interface ObserveArrowCommandCensusDependencies {
	readonly artifactSet: ArrowCommandCensusArtifactSetBinding;
	readonly subject: FrozenSubject;
}

export async function observeArrowCommandCensus(
	requestValue: ObserveArrowCommandCensusRequest,
	dependencies: ObserveArrowCommandCensusDependencies,
	options?: ObserveArrowCommandCensusOptions
): Promise<ObserveArrowCommandCensusOutcome> {
	let maximumDiagnostics = 1;
	let capsuleRoot: string | null = null;
	let outcome: ObserveArrowCommandCensusOutcome = {
		diagnostics: [
			{
				code: 'EXECUTOR_FAILED',
				message: 'Arrow-command census observation failed closed.',
				path: null,
				phase: 'EXECUTE',
				severity: 'ERROR'
			}
		],
		outcome: 'unavailable'
	};
	const progress = createProgressRecorder(options);
	try {
		progress.start('REQUEST_AND_ARTIFACT_BIND');
		const request = closedRequest(requestValue);
		maximumDiagnostics = request.budgets.maxDiagnostics;
		const artifactSet = dependencies?.artifactSet;
		const subject = dependencies?.subject;
		if (!isFrozenSubjectCapability(subject) || isProxy(subject))
			fail(
				'SUBJECT_CAPABILITY_UNAVAILABLE',
				'BIND',
				'Observer requires the exact FrozenSubject byte capability.',
				'$dependencies.subject'
			);
		if (subject.descriptor.subjectId !== request.subjectId)
			fail('SUBJECT_ID_MISMATCH', 'BIND', 'Request and FrozenSubject identities differ.');
		if (artifactSet?.id !== request.artifactSetId || artifactSet.subjectId !== request.subjectId)
			fail(
				'ARTIFACT_SET_IDENTITY_MISMATCH',
				'BIND',
				'Request does not bind the supplied artifact set.'
			);
		if (artifactSet.artifacts.length > request.budgets.maxArtifacts)
			fail(
				'BUDGET_EXHAUSTED',
				'BIND',
				'Artifact population exceeds the caller budget.',
				'$request.budgets.maxArtifacts'
			);
		const setValidation = validateArrowCommandCensusArtifactSet(artifactSet, subject, {
			maxIssues: request.budgets.maxDiagnostics
		});
		if (setValidation.state !== 'VALID')
			fail(
				'ARTIFACT_SET_INVALID',
				'BIND',
				setValidation.issues[0]?.message ?? 'Artifact-set validation failed.',
				setValidation.issues[0]?.path ?? null
			);
		const artifactBytes = artifactSet.artifacts.reduce(
			(total, artifact) => total + artifact.bytes,
			0
		);
		progress.complete({
			artifactBytes,
			artifactSetId: artifactSet.id,
			artifacts: artifactSet.artifacts.length,
			subjectId: request.subjectId
		});

		progress.start('EXECUTOR_ENVIRONMENT_CAPTURE', {
			budgetClassification: 'CALLER_OPERATION_BUDGETS_NOT_PRODUCT_CEILINGS',
			maxExternalModuleBytes: request.budgets.maxExternalModuleBytes,
			maxExternalModuleFiles: request.budgets.maxExternalModuleFiles
		});
		const environment = resolveArrowCommandCensusExecutorEnvironment({
			maxExternalModuleBytes: request.budgets.maxExternalModuleBytes,
			maxExternalModuleFiles: request.budgets.maxExternalModuleFiles,
			workerPath: WORKER_PATH
		});
		const analyzer = artifactSet.artifacts.find((artifact) => artifact.path === ANALYZER_PATH);
		if (analyzer === undefined)
			fail(
				'ARTIFACT_SET_INVALID',
				'BIND',
				'Artifact set omits the retained verifier.',
				ANALYZER_PATH
			);
		const executor = {
			adapterId: ARROW_COMMAND_CENSUS_ADAPTER_ID,
			adapterVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
			...environment.identity,
			retainedVerifierCanonicalPathKey: analyzer.canonicalPathKey,
			retainedVerifierSha256: analyzer.sha256
		};
		const workerBytes = readFileSync(WORKER_PATH);
		if (
			workerBytes.byteLength !== executor.worker.bytes ||
			sha256(workerBytes) !== executor.worker.sha256
		)
			fail(
				'EXECUTOR_IDENTITY_MISMATCH',
				'BIND',
				'Worker bytes changed after executor capture.',
				'$executor.worker'
			);
		progress.complete({
			executableBytes: executor.executableBytes,
			executableSha256: executor.executableSha256,
			externalModules: executor.externalModules.map((module) => ({
				bytes: module.bytes,
				contentDigest: module.contentDigest,
				files: module.files,
				name: module.name,
				version: module.version
			})),
			runtime: executor.runtime,
			runtimeVersion: executor.runtimeVersion,
			workerBytes: executor.worker.bytes,
			workerSha256: executor.worker.sha256
		});

		progress.start('CAPSULE_MATERIALIZATION', {
			artifacts: artifactSet.artifacts.length,
			maxMaterializedBytes: request.budgets.maxMaterializedBytes
		});
		capsuleRoot = mkdtempSync(join(tmpdir(), 'jcsaa-'));
		if (/[%#\s]/u.test(capsuleRoot))
			fail(
				'EXECUTOR_FAILED',
				'BIND',
				'Retained verifier requires a URL-safe capsule path.',
				'$executor.capsule'
			);
		const written = writeCapsule(
			capsuleRoot,
			artifactSet,
			subject,
			workerBytes,
			request.budgets.maxMaterializedBytes
		);
		linkModule(capsuleRoot, 'typescript', environment.moduleRoots.typescript);
		linkModule(capsuleRoot, 'ulid', environment.moduleRoots.ulid);
		linkModule(capsuleRoot, 'zod', environment.moduleRoots.zod);
		const capsuleWorker = join(capsuleRoot, '.csaa', 'worker.ts');
		makeReadOnly([...written.map((artifact) => artifact.absolutePath), capsuleWorker]);
		progress.complete({
			artifacts: written.length,
			externalModuleLinks: executor.externalModules.length,
			materializedBytes: artifactBytes + workerBytes.byteLength,
			workerBytes: workerBytes.byteLength
		});
		const workerRequest = new TextEncoder().encode(
			canonicalSemanticJson({
				analyzerPath: ANALYZER_PATH,
				capsuleRoot,
				schemaVersion: ARROW_COMMAND_CENSUS_WORKER_REQUEST_SCHEMA_VERSION
			})
		);
		progress.start('RETAINED_VERIFIER_EXECUTION', {
			runtimeCancellationAndTransportGuards: {
				maxExecutorDurationMs: request.budgets.maxExecutorDurationMs,
				maxStderrBytes: request.budgets.maxStderrBytes,
				maxStdoutBytes: request.budgets.maxStdoutBytes
			}
		});
		const processResult = await runWorker(
			environment.executable,
			capsuleWorker,
			workerRequest,
			request.budgets
		);
		progress.complete({
			exitCode: processResult.exitCode,
			stderrBytes: processResult.stderr.byteLength,
			stdoutBytes: processResult.stdout.byteLength,
			terminatedByBudget: false
		});
		progress.start('POST_EXECUTION_INTEGRITY_RECHECK');
		verifyCapsuleBytes(written);
		const materializedWorkerBytes = readFileSync(capsuleWorker);
		if (
			sha256(materializedWorkerBytes) !== executor.worker.sha256 ||
			materializedWorkerBytes.byteLength !== executor.worker.bytes
		)
			fail(
				'EXECUTOR_IDENTITY_MISMATCH',
				'VALIDATE',
				'Materialized worker bytes changed during execution.',
				'$worker'
			);
		const recapturedEnvironment = resolveArrowCommandCensusExecutorEnvironment({
			maxExternalModuleBytes: request.budgets.maxExternalModuleBytes,
			maxExternalModuleFiles: request.budgets.maxExternalModuleFiles,
			workerPath: WORKER_PATH
		});
		if (
			canonicalSemanticJson(recapturedEnvironment.identity) !==
			canonicalSemanticJson(environment.identity)
		)
			fail(
				'EXECUTOR_IDENTITY_MISMATCH',
				'VALIDATE',
				'Executor or external module bytes changed during execution.',
				'$executor'
			);
		progress.complete({
			executorRecaptureMatched: true,
			subjectBytesMatched: true,
			workerBytesMatched: true
		});
		progress.start('RETAINED_VERIFIER_RESULT_ACCEPTANCE', {
			exitCode: processResult.exitCode,
			stderrBytes: processResult.stderr.byteLength,
			stdoutBytes: processResult.stdout.byteLength
		});
		if (processResult.exitCode !== 0)
			fail(
				'EXECUTOR_FAILED',
				'EXECUTE',
				`Retained verifier exited with status ${String(processResult.exitCode)}; ${stderrIdentity(processResult.stderr)}.`,
				'$worker'
			);
		if (processResult.stderr.byteLength !== 0)
			fail(
				'EXECUTOR_FAILED',
				'EXECUTE',
				'Retained verifier emitted stderr on a successful exit.',
				'$worker'
			);
		progress.complete({ accepted: true });
		progress.start('WORKER_OUTPUT_PARSE_AND_RUNTIME_RECONCILE', {
			postExecutionAcceptanceBudgets: {
				maxBirthStates: request.budgets.maxBirthStates,
				maxDeclaredArrowOccurrences: request.budgets.maxDeclaredArrowOccurrences,
				maxDeclaredSites: request.budgets.maxDeclaredSites,
				maxMachines: request.budgets.maxMachines,
				maxMapStates: request.budgets.maxMapStates,
				maxOutputStringCharacters: request.budgets.maxOutputStringCharacters,
				maxRawArrayEntries: request.budgets.maxRawArrayEntries,
				maxRawJsonDepth: request.budgets.maxRawJsonDepth
			}
		});
		const parsed = parseArrowCommandCensusWorkerOutput(
			exactJson(processResult.stdout),
			request.budgets
		);
		const runtimeModules = new Map(executor.externalModules.map((module) => [module.name, module]));
		if (
			parsed.runtime.bunVersion !== executor.runtimeVersion ||
			parsed.runtime.typescriptVersion !== runtimeModules.get('typescript')?.version ||
			parsed.runtime.ulidVersion !== runtimeModules.get('ulid')?.version ||
			parsed.runtime.zodVersion !== runtimeModules.get('zod')?.version
		)
			fail(
				'EXECUTOR_IDENTITY_MISMATCH',
				'VALIDATE',
				'Worker-reported runtime versions differ from pre-execution identities.',
				'$worker.runtime'
			);
		verifyRuntimeModulePath(
			parsed.runtime.typescriptResolvedPath,
			environment.moduleRoots.typescript,
			'TypeScript'
		);
		verifyRuntimeModulePath(parsed.runtime.ulidResolvedPath, environment.moduleRoots.ulid, 'ULID');
		verifyRuntimeModulePath(parsed.runtime.zodResolvedPath, environment.moduleRoots.zod, 'Zod');
		progress.complete({
			birthMachines: parsed.evidence.births.length,
			declaredArrowOccurrences: parsed.evidence.declaredArrows.length,
			deadCoveredArrows: parsed.evidence.deadCovered.dead.length,
			occupiableMachines: parsed.evidence.occupiable.length,
			orphanMachines: parsed.evidence.census.orphans.length,
			totalInScopeTopologyArrows: parsed.evidence.census.total,
			unanalysedMachines: parsed.evidence.deadCovered.unanalysed.length,
			uncoveredArrows: parsed.evidence.census.uncovered.length
		});
		progress.start('OBSERVATION_NORMALIZATION');
		const normalized = normalizeArrowCommandCensusObservation({
			artifactSet,
			evidence: parsed.evidence,
			executor,
			request
		});
		progress.complete({
			baselineMatches: normalized.observation.coverage.baselineMatches,
			coverage: normalized.observation.coverage,
			observationId: normalized.observation.id,
			rawOutputBytes: normalized.observation.rawOutput.bytes,
			rawOutputId: normalized.observation.rawOutput.id,
			rawOutputSha256: normalized.observation.rawOutput.sha256
		});
		outcome = normalized.baselineMismatch
			? {
					diagnostics: [
						{
							code: 'BASELINE_MISMATCH',
							message: 'Retained census result differs from its exact frozen baseline.',
							path: 'verif/arrow-command-census.baseline.json',
							phase: 'VALIDATE',
							severity: 'WARNING'
						}
					],
					observation: normalized.observation,
					outcome: 'partial'
				}
			: { diagnostics: [], observation: normalized.observation, outcome: 'complete' };
	} catch (error) {
		progress.fail(error);
		const diagnostic: ArrowCommandCensusDiagnostic =
			error instanceof ObserveFailure
				? error.diagnostic
				: error instanceof ArrowCommandCensusExecutorEnvironmentError
					? {
							code: error.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'EXECUTOR_FAILED',
							message:
								error.code === 'BUDGET_EXHAUSTED'
									? 'Executor environment capture exceeded a caller operation budget.'
									: `Executor environment capture failed closed (${error.code}).`,
							path: publicExecutorErrorPath(error),
							phase: 'BIND',
							severity: 'ERROR'
						}
					: error instanceof ArrowCommandCensusRawOutputError
						? {
								code: 'RAW_OUTPUT_INVALID',
								message: error.message,
								path: error.path,
								phase: 'NORMALIZE',
								severity: 'ERROR'
							}
						: error instanceof ArrowCommandCensusNormalizationError
							? {
									code: 'OBSERVATION_VALIDATION_FAILED',
									message: error.message,
									path: error.path,
									phase: 'VALIDATE',
									severity: 'ERROR'
								}
							: {
									code: 'EXECUTOR_FAILED',
									message: 'Arrow-command census observation failed closed.',
									path: null,
									phase: 'EXECUTE',
									severity: 'ERROR'
								};
		outcome = { diagnostics: [diagnostic].slice(0, maximumDiagnostics), outcome: 'unavailable' };
	} finally {
		if (capsuleRoot === null)
			progress.skip('CAPSULE_CLEANUP', { attempted: false, reason: 'CAPSULE_NOT_CREATED' });
		else {
			progress.start('CAPSULE_CLEANUP', { attempted: true });
			try {
				rmSync(capsuleRoot, { force: true, recursive: true });
				progress.complete({ attempted: true, succeeded: true });
			} catch (error) {
				progress.fail(error);
				const cleanupDiagnostic: ArrowCommandCensusDiagnostic = {
					code: 'EXECUTOR_FAILED',
					message: 'Arrow-command census capsule cleanup failed; temporary material may remain.',
					path: null,
					phase: 'VALIDATE',
					severity: 'ERROR'
				};
				outcome = {
					diagnostics: [cleanupDiagnostic].slice(0, maximumDiagnostics),
					outcome: 'unavailable'
				};
			}
		}
	}
	return outcome;
}
