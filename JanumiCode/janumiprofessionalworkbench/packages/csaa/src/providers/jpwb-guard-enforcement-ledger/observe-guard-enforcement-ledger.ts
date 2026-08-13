import { spawn, spawnSync } from 'node:child_process';
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
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_MAX_EXECUTOR_DURATION_MS,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	type GuardEnforcementLedgerArtifactSetBinding,
	type GuardEnforcementLedgerAudit,
	type GuardEnforcementLedgerDiagnostic,
	type GuardEnforcementLedgerDiagnosticCode,
	type ObserveGuardEnforcementLedgerOutcome,
	type ObserveGuardEnforcementLedgerRequest
} from '../../contracts/guard-enforcement-ledger.js';
import type { FrozenSubject } from '../../contracts/subject.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
import {
	isFrozenSubjectCapability,
	readFrozenSubjectArtifact
} from '../../subject/frozen-store.js';
import { assertCanonicalRelativePath } from '../../subject/paths.js';
import {
	ArrowCommandCensusExecutorEnvironmentError,
	resolveArrowCommandCensusExecutorEnvironment
} from '../jpwb-arrow-command-census/executor-environment.js';
import { validateGuardEnforcementLedgerArtifactSet } from './artifact-set.js';
import {
	GuardEnforcementLedgerNormalizationError,
	normalizeGuardEnforcementLedgerObservation
} from './normalize-guard-enforcement-ledger.js';
import {
	GuardEnforcementLedgerRawOutputError,
	parseGuardEnforcementLedgerWorkerOutput
} from './parse-worker-output.js';
import { validateGuardEnforcementLedgerObservation } from './validate-guard-enforcement-ledger.js';
import { GUARD_ENFORCEMENT_LEDGER_WORKER_REQUEST_SCHEMA_VERSION } from './worker.js';

const WORKER_PATH = fileURLToPath(new URL('./worker.ts', import.meta.url));
const ANALYZER_PATH = 'verif/guard-enforcement-ledger.ts';
const DATA_PATH = 'verif/guard-enforcement-ledger.data.ts';
const TERMINATION_GRACE_MS = 250;
const TERMINATION_SETTLE_MS = 2_000;

export const GUARD_ENFORCEMENT_LEDGER_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-progress/1.0.0' as const;

const BUDGET_KEYS = [
	'maxArtifacts',
	'maxAuditEntries',
	'maxDiagnostics',
	'maxExecutorDurationMs',
	'maxExternalModuleBytes',
	'maxExternalModuleFiles',
	'maxGuardedArrows',
	'maxGuardTexts',
	'maxLedgerRows',
	'maxMaterializedBytes',
	'maxOutputStringCharacters',
	'maxRawArrayEntries',
	'maxRawJsonDepth',
	'maxStderrBytes',
	'maxStdoutBytes'
] as const;

type PlainRecord = Record<string, unknown>;

export type GuardEnforcementLedgerProgressPhase =
	| 'CAPSULE_CLEANUP'
	| 'CAPSULE_MATERIALIZATION'
	| 'EXECUTOR_ENVIRONMENT_CAPTURE'
	| 'OBSERVATION_NORMALIZATION'
	| 'POST_EXECUTION_INTEGRITY_RECHECK'
	| 'REQUEST_AND_ARTIFACT_BIND'
	| 'RETAINED_VERIFIER_EXECUTION'
	| 'RETAINED_VERIFIER_RESULT_ACCEPTANCE'
	| 'WORKER_OUTPUT_PARSE_AND_RUNTIME_RECONCILE';

export interface GuardEnforcementLedgerProgressEvent {
	readonly adapterElapsedMs: number;
	readonly details: Readonly<Record<string, unknown>>;
	readonly durationMs?: number;
	readonly event: 'CSAA_GUARD_ENFORCEMENT_LEDGER_PHASE';
	readonly phase: GuardEnforcementLedgerProgressPhase;
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly state: 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'STARTED';
	readonly timestamp: string;
}

export interface ObserveGuardEnforcementLedgerOptions {
	/** Deferred out-of-band telemetry; delivered only after evidence and outcome are final. */
	readonly onProgress?: (event: GuardEnforcementLedgerProgressEvent) => void;
}

interface ProgressRecorder {
	complete(details?: Readonly<Record<string, unknown>>): void;
	fail(error: unknown): void;
	skip(
		phase: GuardEnforcementLedgerProgressPhase,
		details: Readonly<Record<string, unknown>>
	): void;
	start(
		phase: GuardEnforcementLedgerProgressPhase,
		details?: Readonly<Record<string, unknown>>
	): void;
}

interface DeferredProgressRecorder extends ProgressRecorder {
	flush(): void;
}

class ObserveFailure extends Error {
	constructor(readonly diagnostic: GuardEnforcementLedgerDiagnostic) {
		super(diagnostic.message);
	}
}

function safeProgressSink(
	options: ObserveGuardEnforcementLedgerOptions | undefined
): ((event: GuardEnforcementLedgerProgressEvent) => void) | undefined {
	try {
		if (options === undefined || options === null || isProxy(options)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: GuardEnforcementLedgerProgressEvent) => void)
			: undefined;
	} catch {
		return undefined;
	}
}

function progressCode(error: unknown): string {
	if (error instanceof ObserveFailure) return error.diagnostic.code;
	if (error instanceof ArrowCommandCensusExecutorEnvironmentError) return error.code;
	if (error instanceof GuardEnforcementLedgerRawOutputError) return 'RAW_OUTPUT_INVALID';
	if (error instanceof GuardEnforcementLedgerNormalizationError)
		return 'OBSERVATION_VALIDATION_FAILED';
	return 'UNCLASSIFIED_FAILURE';
}

function createProgressRecorder(
	options: ObserveGuardEnforcementLedgerOptions | undefined
): DeferredProgressRecorder {
	const sink = safeProgressSink(options);
	const adapterStart = performance.now();
	let sequence = 0;
	let active: { phase: GuardEnforcementLedgerProgressPhase; startedAt: number } | null = null;
	const pending: GuardEnforcementLedgerProgressEvent[] = [];
	const emit = (
		phase: GuardEnforcementLedgerProgressPhase,
		state: GuardEnforcementLedgerProgressEvent['state'],
		details: Readonly<Record<string, unknown>>,
		at: number,
		durationMs?: number
	): void => {
		const event: GuardEnforcementLedgerProgressEvent = {
			adapterElapsedMs: Math.max(0, at - adapterStart),
			details,
			event: 'CSAA_GUARD_ENFORCEMENT_LEDGER_PHASE',
			phase,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_PROGRESS_SCHEMA_VERSION,
			sequence: sequence++,
			state,
			timestamp: new Date().toISOString(),
			...(durationMs === undefined ? {} : { durationMs })
		};
		pending.push(Object.freeze({ ...event, details: Object.freeze({ ...details }) }));
	};
	return {
		complete(details = {}): void {
			if (active === null) return;
			const at = performance.now();
			emit(active.phase, 'COMPLETED', details, at, Math.max(0, at - active.startedAt));
			active = null;
		},
		fail(error): void {
			if (active === null) return;
			const at = performance.now();
			emit(
				active.phase,
				'FAILED',
				{ code: progressCode(error) },
				at,
				Math.max(0, at - active.startedAt)
			);
			active = null;
		},
		flush(): void {
			for (const event of pending) {
				try {
					sink?.(event);
				} catch {
					// Deferred telemetry cannot affect completed evidence or outcome.
				}
			}
			pending.length = 0;
		},
		skip(phase, details): void {
			emit(phase, 'SKIPPED', details, performance.now(), 0);
		},
		start(phase, details = {}): void {
			const at = performance.now();
			active = { phase, startedAt: at };
			emit(phase, 'STARTED', details, at);
		}
	};
}

function fail(
	code: GuardEnforcementLedgerDiagnosticCode,
	phase: GuardEnforcementLedgerDiagnostic['phase'],
	message: string,
	path: string | null = null
): never {
	throw new ObserveFailure({ code, message, path, phase, severity: 'ERROR' });
}

function exactRecord(value: unknown, path: string, keys: readonly string[]): PlainRecord {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value))
		fail('REQUEST_INVALID', 'REQUEST', 'Expected a plain, non-Proxy record.', path);
	const prototype = Reflect.getPrototypeOf(value);
	const own = Reflect.ownKeys(value);
	if (
		(prototype !== Object.prototype && prototype !== null) ||
		own.length !== keys.length ||
		own.some((key) => typeof key !== 'string' || !keys.includes(key))
	)
		fail('REQUEST_INVALID', 'REQUEST', 'Record field population is not exact.', path);
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

function closedRequest(value: unknown): ObserveGuardEnforcementLedgerRequest {
	const request = exactRecord(value, '$request', [
		'artifactSetId',
		'budgets',
		'operationVersion',
		'schemaVersion',
		'subjectId'
	]);
	if (data(request, 'schemaVersion') !== GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION)
		fail(
			'REQUEST_INVALID',
			'REQUEST',
			'Unsupported request schema version.',
			'$request.schemaVersion'
		);
	if (data(request, 'operationVersion') !== GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION)
		fail(
			'REQUEST_INVALID',
			'REQUEST',
			'Unsupported operation version.',
			'$request.operationVersion'
		);
	for (const key of ['artifactSetId', 'subjectId'] as const) {
		const identity = data(request, key);
		if (typeof identity !== 'string' || identity.length === 0)
			fail('REQUEST_INVALID', 'REQUEST', 'Identity must be nonempty text.', `$request.${key}`);
	}
	const budgets = exactRecord(data(request, 'budgets'), '$request.budgets', BUDGET_KEYS);
	for (const key of BUDGET_KEYS) {
		const budget = data(budgets, key);
		if (!Number.isSafeInteger(budget) || (budget as number) <= 0)
			fail(
				'REQUEST_INVALID',
				'REQUEST',
				'Budgets must be caller-supplied positive safe integers.',
				`$request.budgets.${key}`
			);
	}
	if (
		(data(budgets, 'maxExecutorDurationMs') as number) >
		GUARD_ENFORCEMENT_LEDGER_MAX_EXECUTOR_DURATION_MS
	)
		fail(
			'REQUEST_INVALID',
			'REQUEST',
			'Executor duration exceeds the runtime timer representation limit.',
			'$request.budgets.maxExecutorDurationMs'
		);
	return Object.freeze({
		artifactSetId: data(
			request,
			'artifactSetId'
		) as ObserveGuardEnforcementLedgerRequest['artifactSetId'],
		budgets: Object.freeze(
			Object.fromEntries(BUDGET_KEYS.map((key) => [key, data(budgets, key)]))
		) as unknown as ObserveGuardEnforcementLedgerRequest['budgets'],
		operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
		subjectId: data(request, 'subjectId') as string
	});
}

function closedDependencies(value: unknown): {
	readonly artifactSet: GuardEnforcementLedgerArtifactSetBinding;
	readonly subject: FrozenSubject;
} {
	const dependencies = exactRecord(value, '$dependencies', ['artifactSet', 'subject']);
	const artifactSet = data(dependencies, 'artifactSet');
	const subject = data(dependencies, 'subject');
	if (!isFrozenSubjectCapability(subject) || isProxy(subject))
		fail(
			'SUBJECT_CAPABILITY_UNAVAILABLE',
			'BIND',
			'Observer requires the exact FrozenSubject byte capability.',
			'$dependencies.subject'
		);
	return { artifactSet: artifactSet as GuardEnforcementLedgerArtifactSetBinding, subject };
}

function contained(root: string, candidate: string): boolean {
	const fromRoot = relative(root, candidate);
	return (
		fromRoot === '' ||
		(!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
	);
}

function capsulePath(root: string, artifactPath: string): string {
	assertCanonicalRelativePath(artifactPath);
	for (const [prefix, packageName] of [
		['packages/rph-domain/', 'rph-domain'],
		['packages/rph-contracts/', 'rph-contracts']
	] as const)
		if (artifactPath.startsWith(prefix))
			return join(
				root,
				'node_modules',
				'@janumipwb',
				packageName,
				...artifactPath.slice(prefix.length).split('/')
			);
	return join(root, ...artifactPath.split('/'));
}

interface WrittenArtifact {
	readonly absolutePath: string;
	readonly path: string;
	readonly sha256: string;
}

function writeCapsule(
	root: string,
	artifactSet: GuardEnforcementLedgerArtifactSetBinding,
	subject: FrozenSubject,
	workerBytes: Uint8Array,
	maximum: number
): readonly WrittenArtifact[] {
	const total = artifactSet.artifacts.reduce(
		(sum, artifact) => sum + artifact.bytes,
		workerBytes.byteLength
	);
	if (!Number.isSafeInteger(total) || total > maximum)
		fail(
			'BUDGET_EXHAUSTED',
			'BIND',
			'Materialized population exceeds the caller budget.',
			'$request.budgets.maxMaterializedBytes'
		);
	const written: WrittenArtifact[] = [];
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
				'Frozen bytes do not reproduce the selected artifact binding.',
				artifact.path
			);
		const absolutePath = capsulePath(root, artifact.path);
		if (!contained(root, absolutePath))
			fail('ARTIFACT_SET_INVALID', 'BIND', 'Materialized artifact escapes capsule.', artifact.path);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, bytes, { flag: 'wx' });
		written.push({ absolutePath, path: artifact.path, sha256: artifact.sha256 });
	}
	const workerPath = join(root, '.csaa', 'worker.ts');
	mkdirSync(dirname(workerPath), { recursive: true });
	writeFileSync(workerPath, workerBytes, { flag: 'wx' });
	return written;
}

function makeReadOnly(paths: readonly string[]): void {
	for (const path of paths) {
		try {
			chmodSync(path, 0o444);
		} catch {
			// The exact post-execution byte check remains authoritative on platforms that ignore this mode.
		}
	}
}

function linkModule(root: string, name: string, target: string): void {
	const destination = join(root, 'node_modules', name);
	mkdirSync(dirname(destination), { recursive: true });
	symlinkSync(target, destination, process.platform === 'win32' ? 'junction' : 'dir');
}

interface ProcessResult {
	readonly exitCode: number | null;
	readonly stderr: Uint8Array;
	readonly stdout: Uint8Array;
}

export async function executeGuardEnforcementLedgerWorkerProcess(
	executable: string,
	workerPath: string,
	requestBytes: Uint8Array,
	budgets: ObserveGuardEnforcementLedgerRequest['budgets']
): Promise<ProcessResult> {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(executable, ['--no-install', '--conditions=source', workerPath], {
			detached: process.platform !== 'win32',
			env: process.env,
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		let stdoutBytes = 0;
		let stderrBytes = 0;
		let budgetFailure: ObserveFailure | null = null;
		let settled = false;
		let hardKillTimer: ReturnType<typeof setTimeout> | null = null;
		let settleTimer: ReturnType<typeof setTimeout> | null = null;
		let durationTimer: ReturnType<typeof setTimeout> | null = null;
		const signalTree = (signal: 'SIGKILL' | 'SIGTERM'): void => {
			if (child.pid === undefined) return;
			try {
				if (process.platform === 'win32') {
					spawnSync(
						'taskkill',
						['/PID', String(child.pid), '/T', ...(signal === 'SIGKILL' ? ['/F'] : [])],
						{
							stdio: 'ignore',
							timeout: TERMINATION_GRACE_MS,
							windowsHide: true
						}
					);
					if (signal === 'SIGKILL') child.kill(signal);
				} else process.kill(-child.pid, signal);
			} catch {
				try {
					child.kill(signal);
				} catch {
					// Independent settlement below prevents an unbounded wait.
				}
			}
		};
		const clearTerminationTimers = (): void => {
			if (durationTimer !== null) clearTimeout(durationTimer);
			if (hardKillTimer !== null) clearTimeout(hardKillTimer);
			if (settleTimer !== null) clearTimeout(settleTimer);
		};
		const stop = (failure: ObserveFailure): void => {
			if (budgetFailure !== null) return;
			budgetFailure ??= failure;
			if (durationTimer !== null) clearTimeout(durationTimer);
			signalTree('SIGTERM');
			hardKillTimer = setTimeout(() => signalTree('SIGKILL'), TERMINATION_GRACE_MS);
			settleTimer = setTimeout(() => {
				if (settled) return;
				settled = true;
				clearTerminationTimers();
				signalTree('SIGKILL');
				child.stdin.destroy();
				child.stdout.destroy();
				child.stderr.destroy();
				rejectPromise(failure);
			}, TERMINATION_SETTLE_MS);
		};
		durationTimer = setTimeout(
			() =>
				stop(
					new ObserveFailure({
						code: 'BUDGET_EXHAUSTED',
						message: 'Retained verifier duration exceeds the caller operation budget.',
						path: '$request.budgets.maxExecutorDurationMs',
						phase: 'EXECUTE',
						severity: 'ERROR'
					})
				),
			budgets.maxExecutorDurationMs
		);
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
			clearTerminationTimers();
			rejectPromise(error);
		});
		child.once('close', (exitCode) => {
			if (settled) return;
			settled = true;
			if (budgetFailure !== null) signalTree('SIGKILL');
			clearTerminationTimers();
			if (budgetFailure !== null) rejectPromise(budgetFailure);
			else
				resolvePromise({ exitCode, stderr: Buffer.concat(stderr), stdout: Buffer.concat(stdout) });
		});
		child.stdin.end(requestBytes);
	});
}

function exactJson(bytes: Uint8Array): unknown {
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return fail('RAW_OUTPUT_INVALID', 'NORMALIZE', 'Worker stdout is not valid UTF-8.', '$worker');
	}
	if (!text.endsWith('\n') || text.endsWith('\n\n') || text.includes('\r'))
		fail(
			'RAW_OUTPUT_INVALID',
			'NORMALIZE',
			'Worker stdout must be one JSON value followed by LF.',
			'$worker'
		);
	try {
		return JSON.parse(text.slice(0, -1));
	} catch {
		return fail('RAW_OUTPUT_INVALID', 'NORMALIZE', 'Worker stdout is not valid JSON.', '$worker');
	}
}

function verifyCapsuleBytes(written: readonly WrittenArtifact[]): void {
	for (const artifact of written) {
		let digest: string;
		try {
			digest = sha256(readFileSync(artifact.absolutePath));
		} catch {
			fail(
				'ARTIFACT_SET_IDENTITY_MISMATCH',
				'VALIDATE',
				'Materialized evidence disappeared.',
				artifact.path
			);
		}
		if (digest !== artifact.sha256)
			fail(
				'ARTIFACT_SET_IDENTITY_MISMATCH',
				'VALIDATE',
				'Materialized evidence changed.',
				artifact.path
			);
	}
}

function verifyRuntimePath(value: string, root: string, moduleName: string): void {
	let resolved: string;
	try {
		resolved = realpathSync.native(value);
	} catch {
		return fail(
			'EXECUTOR_IDENTITY_MISMATCH',
			'VALIDATE',
			`${moduleName} path does not resolve.`,
			'$worker.runtime'
		);
	}
	if (!contained(root, resolved))
		fail(
			'EXECUTOR_IDENTITY_MISMATCH',
			'VALIDATE',
			`${moduleName} path is outside the captured tree.`,
			'$worker.runtime'
		);
}

export interface ObserveGuardEnforcementLedgerDependencies {
	readonly artifactSet: GuardEnforcementLedgerArtifactSetBinding;
	readonly subject: FrozenSubject;
}

/** Successful retained evidence remains available but partial while its audit records any hole. */
export function classifyGuardEnforcementLedgerObservationOutcome(
	audit: GuardEnforcementLedgerAudit
): 'complete' | 'partial' {
	return audit.enforcedAnchorBroken.length +
		audit.enforcedWithoutSite.length +
		audit.stale.length +
		audit.unclassified.length ===
		0
		? 'complete'
		: 'partial';
}

export async function observeGuardEnforcementLedger(
	requestValue: ObserveGuardEnforcementLedgerRequest,
	dependencies: ObserveGuardEnforcementLedgerDependencies,
	options?: ObserveGuardEnforcementLedgerOptions
): Promise<ObserveGuardEnforcementLedgerOutcome> {
	let maximumDiagnostics = 1;
	let capsuleRoot: string | null = null;
	let outcome: ObserveGuardEnforcementLedgerOutcome = {
		diagnostics: [
			{
				code: 'EXECUTOR_FAILED',
				message: 'Guard-enforcement ledger observation failed closed.',
				path: null,
				phase: 'EXECUTE',
				severity: 'ERROR'
			}
		],
		outcome: 'unavailable'
	};
	const progress = createProgressRecorder(options);
	try {
		const request = closedRequest(requestValue);
		maximumDiagnostics = request.budgets.maxDiagnostics;
		progress.start('REQUEST_AND_ARTIFACT_BIND');
		const { artifactSet, subject } = closedDependencies(dependencies);
		const setValidation = validateGuardEnforcementLedgerArtifactSet(artifactSet, subject, {
			maxIssues: request.budgets.maxDiagnostics,
			maxRecords: request.budgets.maxArtifacts,
			maxStringCharacters: request.budgets.maxOutputStringCharacters
		});
		if (setValidation.state !== 'VALID')
			fail(
				setValidation.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'ARTIFACT_SET_INVALID',
				'BIND',
				setValidation.issues[0]?.message ?? 'Artifact-set validation failed.',
				setValidation.issues[0]?.path ?? null
			);
		const artifactSetSnapshot = structuredClone(artifactSet);
		const snapshotValidation = validateGuardEnforcementLedgerArtifactSet(
			artifactSetSnapshot,
			subject,
			{
				maxIssues: request.budgets.maxDiagnostics,
				maxRecords: request.budgets.maxArtifacts,
				maxStringCharacters: request.budgets.maxOutputStringCharacters
			}
		);
		if (snapshotValidation.state !== 'VALID')
			fail(
				'ARTIFACT_SET_INVALID',
				'BIND',
				'Artifact-set snapshot validation failed.',
				'$dependencies.artifactSet'
			);
		if (subject.descriptor.subjectId !== request.subjectId)
			fail('SUBJECT_ID_MISMATCH', 'BIND', 'Request and FrozenSubject identities differ.');
		if (
			artifactSetSnapshot.id !== request.artifactSetId ||
			artifactSetSnapshot.subjectId !== request.subjectId
		)
			fail(
				'ARTIFACT_SET_IDENTITY_MISMATCH',
				'BIND',
				'Request does not bind the supplied artifact set.'
			);
		const artifactBytes = artifactSetSnapshot.artifacts.reduce(
			(total, artifact) => total + artifact.bytes,
			0
		);
		progress.complete({
			artifactBytes,
			artifactSetId: artifactSetSnapshot.id,
			artifacts: artifactSetSnapshot.artifacts.length,
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
		const analyzer = artifactSetSnapshot.artifacts.find(
			(artifact) => artifact.path === ANALYZER_PATH
		);
		const dataArtifact = artifactSetSnapshot.artifacts.find(
			(artifact) => artifact.path === DATA_PATH
		);
		if (analyzer === undefined)
			fail(
				'ARTIFACT_SET_INVALID',
				'BIND',
				'Artifact set omits the retained analyzer.',
				ANALYZER_PATH
			);
		if (dataArtifact === undefined)
			fail(
				'ARTIFACT_SET_INVALID',
				'BIND',
				'Artifact set omits the retained ledger data.',
				DATA_PATH
			);
		const executor = {
			adapterId: GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
			adapterVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
			...environment.identity,
			retainedAnalyzerCanonicalPathKey: analyzer.canonicalPathKey,
			retainedAnalyzerSha256: analyzer.sha256,
			retainedDataCanonicalPathKey: dataArtifact.canonicalPathKey,
			retainedDataSha256: dataArtifact.sha256
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
			runtime: executor.runtime,
			runtimeVersion: executor.runtimeVersion,
			workerBytes: executor.worker.bytes,
			workerSha256: executor.worker.sha256
		});

		progress.start('CAPSULE_MATERIALIZATION', {
			artifacts: artifactSetSnapshot.artifacts.length,
			maxMaterializedBytes: request.budgets.maxMaterializedBytes
		});
		capsuleRoot = mkdtempSync(join(tmpdir(), 'jcsaa-guard-'));
		if (/[%#\s]/u.test(capsuleRoot))
			fail(
				'EXECUTOR_FAILED',
				'BIND',
				'Retained analyzer requires a URL-safe capsule path.',
				'$executor.capsule'
			);
		const written = writeCapsule(
			capsuleRoot,
			artifactSetSnapshot,
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
			materializedBytes: artifactBytes + workerBytes.byteLength
		});

		const workerRequest = new TextEncoder().encode(
			canonicalSemanticJson({
				analyzerPath: ANALYZER_PATH,
				capsuleRoot,
				dataPath: DATA_PATH,
				schemaVersion: GUARD_ENFORCEMENT_LEDGER_WORKER_REQUEST_SCHEMA_VERSION
			})
		);
		progress.start('RETAINED_VERIFIER_EXECUTION', {
			runtimeCancellationAndTransportGuards: {
				maxExecutorDurationMs: request.budgets.maxExecutorDurationMs,
				maxStderrBytes: request.budgets.maxStderrBytes,
				maxStdoutBytes: request.budgets.maxStdoutBytes
			}
		});
		const processResult = await executeGuardEnforcementLedgerWorkerProcess(
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
		const materializedWorker = readFileSync(capsuleWorker);
		if (
			materializedWorker.byteLength !== executor.worker.bytes ||
			sha256(materializedWorker) !== executor.worker.sha256
		)
			fail(
				'EXECUTOR_IDENTITY_MISMATCH',
				'VALIDATE',
				'Materialized worker bytes changed.',
				'$worker'
			);
		const recaptured = resolveArrowCommandCensusExecutorEnvironment({
			maxExternalModuleBytes: request.budgets.maxExternalModuleBytes,
			maxExternalModuleFiles: request.budgets.maxExternalModuleFiles,
			workerPath: WORKER_PATH
		});
		if (canonicalSemanticJson(recaptured.identity) !== canonicalSemanticJson(environment.identity))
			fail(
				'EXECUTOR_IDENTITY_MISMATCH',
				'VALIDATE',
				'Executor or external module bytes changed.',
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
				`Retained analyzer exited with status ${String(processResult.exitCode)}; stderr SHA-256 ${sha256(processResult.stderr)}.`,
				'$worker'
			);
		if (processResult.stderr.byteLength !== 0)
			fail(
				'EXECUTOR_FAILED',
				'EXECUTE',
				'Retained analyzer emitted stderr on a successful exit.',
				'$worker'
			);
		progress.complete({ accepted: true });

		progress.start('WORKER_OUTPUT_PARSE_AND_RUNTIME_RECONCILE');
		const parsed = parseGuardEnforcementLedgerWorkerOutput(
			exactJson(processResult.stdout),
			request.budgets
		);
		const modules = new Map(executor.externalModules.map((module) => [module.name, module]));
		if (parsed.runtime.bunVersion !== executor.runtimeVersion)
			fail(
				'EXECUTOR_IDENTITY_MISMATCH',
				'VALIDATE',
				'Worker Bun version differs from the captured executor.',
				'$worker.runtime'
			);
		for (const name of ['typescript', 'ulid', 'zod'] as const) {
			const module = modules.get(name);
			if (module === undefined)
				fail(
					'EXECUTOR_IDENTITY_MISMATCH',
					'VALIDATE',
					'Executor module population is incomplete.',
					'$executor.externalModules'
				);
			const reportedVersion = parsed.runtime[`${name}Version`];
			const reportedPath = parsed.runtime[`${name}ResolvedPath`];
			if (reportedVersion !== module.version)
				fail(
					'EXECUTOR_IDENTITY_MISMATCH',
					'VALIDATE',
					`Worker-reported ${name} version differs from capture.`,
					'$worker.runtime'
				);
			verifyRuntimePath(reportedPath, environment.moduleRoots[name], name);
		}
		if (!modules.has('typescript') || !modules.has('ulid') || !modules.has('zod'))
			fail(
				'EXECUTOR_IDENTITY_MISMATCH',
				'VALIDATE',
				'Executor module population is incomplete.',
				'$executor.externalModules'
			);
		progress.complete({
			guardedArrows: parsed.evidence.guardedArrows.length,
			guardTexts: parsed.evidence.guardTexts.length,
			ledgerRows: parsed.evidence.ledgerRows.length
		});

		progress.start('OBSERVATION_NORMALIZATION');
		const normalized = normalizeGuardEnforcementLedgerObservation({
			artifactSet: artifactSetSnapshot,
			evidence: parsed.evidence,
			executor,
			transportOutputBytes: processResult.stdout,
			request
		});
		const observationValidation = validateGuardEnforcementLedgerObservation(normalized, subject);
		if (observationValidation.state !== 'VALID')
			fail(
				'OBSERVATION_VALIDATION_FAILED',
				'VALIDATE',
				observationValidation.issues[0]?.message ??
					'Independent public observation validation failed.',
				observationValidation.issues[0]?.path ?? '$observation'
			);
		const auditFindingCount =
			normalized.rawEvidence.audit.enforcedAnchorBroken.length +
			normalized.rawEvidence.audit.enforcedWithoutSite.length +
			normalized.rawEvidence.audit.stale.length +
			normalized.rawEvidence.audit.unclassified.length;
		progress.complete({
			auditFindingCount,
			canonicalRawEvidenceBytes: normalized.rawOutput.bytes,
			observationId: normalized.id,
			rawOutputId: normalized.rawOutput.id,
			rawOutputSha256: normalized.rawOutput.sha256,
			validationState: observationValidation.state
		});
		outcome = {
			diagnostics: [],
			observation: normalized,
			outcome: classifyGuardEnforcementLedgerObservationOutcome(normalized.rawEvidence.audit)
		};
	} catch (error) {
		progress.fail(error);
		const diagnostic: GuardEnforcementLedgerDiagnostic =
			error instanceof ObserveFailure
				? error.diagnostic
				: error instanceof ArrowCommandCensusExecutorEnvironmentError
					? {
							code: error.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'EXECUTOR_FAILED',
							message: 'Executor environment capture failed closed.',
							path: '$executor',
							phase: 'BIND',
							severity: 'ERROR'
						}
					: error instanceof GuardEnforcementLedgerRawOutputError
						? {
								code: 'RAW_OUTPUT_INVALID',
								message: error.message,
								path: error.path,
								phase: 'NORMALIZE',
								severity: 'ERROR'
							}
						: error instanceof GuardEnforcementLedgerNormalizationError
							? {
									code: 'OBSERVATION_VALIDATION_FAILED',
									message: error.message,
									path: error.path,
									phase: 'VALIDATE',
									severity: 'ERROR'
								}
							: {
									code: 'EXECUTOR_FAILED',
									message: 'Guard-enforcement ledger observation failed closed.',
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
				const cleanupDiagnostic: GuardEnforcementLedgerDiagnostic = {
					code: 'EXECUTOR_FAILED',
					message: 'Guard-ledger capsule cleanup failed; temporary material may remain.',
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
	progress.flush();
	return outcome;
}
