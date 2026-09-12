import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import {
	GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_AUTHORITY_TRANSFER,
	GUARD_ENFORCEMENT_LEDGER_BASELINE_CHANGE,
	GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE,
	GUARD_ENFORCEMENT_LEDGER_GATE_EFFECT,
	GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
	GUARD_ENFORCEMENT_LEDGER_LIMITATIONS,
	GUARD_ENFORCEMENT_LEDGER_METHOD,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION,
	GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT,
	GUARD_ENFORCEMENT_LEDGER_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE,
	GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY,
	type GuardEnforcementLedgerArtifactSetBudgets,
	type GuardEnforcementLedgerArtifactSetDiagnostic,
	type GuardEnforcementLedgerBudgets,
	type GuardEnforcementLedgerDiagnostic,
	type GuardEnforcementLedgerObservation
} from '../contracts/guard-enforcement-ledger.js';
import {
	GUARD_ENFORCEMENT_LEDGER_REPORT_ADDITIONAL_ARTIFACT_PATHS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY,
	GUARD_ENFORCEMENT_LEDGER_REPORT_ADMISSION_LIMITS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER,
	GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_ID,
	GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_STATUS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_FULL_JAN_CSAA_007_CONFORMANCE,
	GUARD_ENFORCEMENT_LEDGER_REPORT_FULL_JAN_CSAA_008_CONFORMANCE,
	GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT,
	GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_REGISTRY_STATUS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_RESULT_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_SELECTION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_SCOPE,
	type GuardEnforcementLedgerReportDiagnostic,
	type GuardEnforcementLedgerReportFailureState,
	type GuardEnforcementLedgerReportOutcome,
	type GuardEnforcementLedgerReportRequest,
	type GuardEnforcementLedgerReportStage,
	type GuardEnforcementLedgerReportStageOutcomes
} from '../contracts/guard-enforcement-ledger-report.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject,
	type SubjectBudgets,
	type SubjectDiagnostic,
	type SubjectResolutionOutcome
} from '../contracts/subject.js';
import {
	buildGuardEnforcementLedgerArtifactSet,
	validateGuardEnforcementLedgerArtifactSet
} from '../providers/jpwb-guard-enforcement-ledger/artifact-set.js';
import {
	observeGuardEnforcementLedger,
	type GuardEnforcementLedgerProgressEvent
} from '../providers/jpwb-guard-enforcement-ledger/observe-guard-enforcement-ledger.js';
import { validateGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import {
	assertCanonicalRelativePath,
	canonicalPathKey,
	repositoryRelativePath,
	resolveExistingRepositoryPath,
	resolveRepositoryRoot
} from '../subject/paths.js';
import { resolveSubject } from '../subject/resolve-subject.js';

const REQUEST_KEYS = [
	'budgets',
	'executionSelection',
	'operationVersion',
	'schemaVersion',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = ['artifactSet', 'maxResultBytes', 'observation', 'subject'] as const;
const SUBJECT_BUDGET_KEYS = [
	'maxBytes',
	'maxConfigDepth',
	'maxDiagnostics',
	'maxDurationMs',
	'maxFiles',
	'maxProjects'
] as const satisfies readonly (keyof SubjectBudgets)[];
const ARTIFACT_SET_BUDGET_KEYS = [
	'maxArtifacts',
	'maxDiagnostics',
	'maxTotalBytes'
] as const satisfies readonly (keyof GuardEnforcementLedgerArtifactSetBudgets)[];
const OBSERVATION_BUDGET_KEYS = [
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
] as const satisfies readonly (keyof GuardEnforcementLedgerBudgets)[];
const FORBIDDEN_PATH_PATTERN_CHARACTERS = new Set(['*', '?', '[', ']', '{', '}']);

export const GUARD_ENFORCEMENT_LEDGER_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-guard-enforcement-ledger-report-progress/0.1.0' as const;

export const GUARD_ENFORCEMENT_LEDGER_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type GuardEnforcementLedgerReportProgressPhase =
	| 'REQUEST_BIND'
	| 'SUBJECT_CAPTURE'
	| 'ARTIFACT_SET'
	| 'RETAINED_LEDGER'
	| 'CURRENTNESS'
	| 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	ARTIFACT_SET: 'ARTIFACT_SET',
	CURRENTNESS: 'CURRENTNESS',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT',
	RETAINED_LEDGER: 'RETAINED_LEDGER',
	SUBJECT_CAPTURE: 'SUBJECT'
} as const satisfies Readonly<
	Record<GuardEnforcementLedgerReportProgressPhase, GuardEnforcementLedgerReportStage>
>);

export type GuardEnforcementLedgerReportProgressObservationMetric =
	| 'ARTIFACT_SET_ARTIFACTS'
	| 'ARTIFACT_SET_BYTES'
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'OBSERVATION_DISTINCT_GUARD_TEXTS'
	| 'OBSERVATION_GUARDED_ARROW_OCCURRENCES'
	| 'OBSERVATION_LEDGER_ROWS'
	| 'OBSERVATION_LIMITATIONS'
	| 'OBSERVATION_RAW_OUTPUT_BYTES'
	| 'OBSERVATION_STALE_LEDGER_ROWS'
	| 'OBSERVATION_UNCLASSIFIED_GUARD_TEXTS'
	| 'RESULT_BYTES'
	| 'SUBJECT_ARTIFACTS'
	| 'SUBJECT_BYTES'
	| 'SUBJECT_PROJECTS';

export interface GuardEnforcementLedgerReportProgressObservation {
	readonly limit: number | null;
	readonly metric: GuardEnforcementLedgerReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

export interface GuardEnforcementLedgerReportProgressEvent {
	readonly adapterProgress: GuardEnforcementLedgerProgressEvent | null;
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly kind: 'REPORT_STAGE' | 'RETAINED_ADAPTER';
	readonly nonclaims: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly GuardEnforcementLedgerReportProgressObservation[];
	readonly operationVersion: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION;
	readonly phase: GuardEnforcementLedgerReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_GUARD_ENFORCEMENT_LEDGER_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof GUARD_ENFORCEMENT_LEDGER_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: GuardEnforcementLedgerReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

export interface RunGuardEnforcementLedgerReportOptions {
	/** Trusted-host telemetry callback; excluded from terminal evidence and identity. */
	readonly onProgress?: (event: GuardEnforcementLedgerReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

interface ProgressRecorder {
	complete(
		observations?: readonly GuardEnforcementLedgerReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly GuardEnforcementLedgerReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: GuardEnforcementLedgerReportOutcome): GuardEnforcementLedgerReportOutcome;
	forwardAdapter(event: GuardEnforcementLedgerProgressEvent): void;
	start(
		phase: GuardEnforcementLedgerReportProgressPhase,
		observations?: readonly GuardEnforcementLedgerReportProgressObservation[]
	): void;
}

function observation(
	metric: GuardEnforcementLedgerReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: GuardEnforcementLedgerReportProgressObservation['unit'] = 'COUNT'
): GuardEnforcementLedgerReportProgressObservation {
	return Object.freeze({
		limit,
		metric,
		unit,
		value: Number.isFinite(value) && value >= 0 ? Math.min(value, Number.MAX_SAFE_INTEGER) : 0
	});
}

function containRejectedObserverResult(result: unknown): void {
	if (result === undefined) return;
	void Promise.resolve(result).catch(() => {
		// Rejected thenables are contained like synchronous callback exceptions.
	});
}

function safeProgressSink(
	options: RunGuardEnforcementLedgerReportOptions
): ((event: GuardEnforcementLedgerReportProgressEvent) => unknown) | undefined {
	try {
		if (options === null || typeof options !== 'object' || isProxyValue(options)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: GuardEnforcementLedgerReportProgressEvent) => unknown)
			: undefined;
	} catch {
		return undefined;
	}
}

function createProgressRecorder(options: RunGuardEnforcementLedgerReportOptions): ProgressRecorder {
	const sink = safeProgressSink(options);
	const startedAt = performance.now();
	let sequence = 0;
	let active: GuardEnforcementLedgerReportProgressPhase | null = null;
	const emit = (
		kind: GuardEnforcementLedgerReportProgressEvent['kind'],
		phase: GuardEnforcementLedgerReportProgressPhase,
		state: GuardEnforcementLedgerReportProgressEvent['state'],
		observations: readonly GuardEnforcementLedgerReportProgressObservation[],
		detailCode: string | null,
		adapterProgress: GuardEnforcementLedgerProgressEvent | null
	): void => {
		const event: GuardEnforcementLedgerReportProgressEvent = Object.freeze({
			adapterProgress,
			deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
			detailCode,
			elapsedMs: Math.max(0, performance.now() - startedAt),
			kind,
			nonclaims: GUARD_ENFORCEMENT_LEDGER_REPORT_PROGRESS_NONCLAIMS,
			observations,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
			phase,
			protocolRole: 'PRELIMINARY_GUARD_ENFORCEMENT_LEDGER_REPORT_TELEMETRY',
			reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_PROGRESS_SCHEMA_VERSION,
			sequence: (sequence += 1),
			stage: PROGRESS_PHASE_STAGE[phase],
			state,
			wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
		});
		try {
			containRejectedObserverResult(sink?.(event));
		} catch {
			// Trusted-host telemetry cannot change evidence or outcome.
		}
	};
	const close = (
		state: 'COMPLETED' | 'FAILED',
		observations: readonly GuardEnforcementLedgerReportProgressObservation[],
		detailCode: string | null
	): void => {
		if (active === null) return;
		const phase = active;
		active = null;
		emit('REPORT_STAGE', phase, state, observations, detailCode, null);
	};
	return {
		complete(observations = [], detailCode = null): void {
			close('COMPLETED', observations, detailCode);
		},
		fail(observations = [], detailCode = null): void {
			close('FAILED', observations, detailCode);
		},
		finish(outcome): GuardEnforcementLedgerReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			return outcome;
		},
		forwardAdapter(event): void {
			// The retained provider may expose live internal objects in progress details. A canonical
			// data clone prevents a trusted-host observer from mutating provider evidence in flight.
			let adapterProgress: GuardEnforcementLedgerProgressEvent;
			try {
				adapterProgress = JSON.parse(
					canonicalSemanticJson(event)
				) as GuardEnforcementLedgerProgressEvent;
			} catch {
				return;
			}
			emit(
				'RETAINED_ADAPTER',
				'RETAINED_LEDGER',
				adapterProgress.state,
				[],
				typeof adapterProgress.details.code === 'string'
					? adapterProgress.details.code
					: adapterProgress.phase,
				adapterProgress
			);
		},
		start(phase, observations = []): void {
			if (active !== null) close('FAILED', [], 'STAGE_INTERRUPTED');
			active = phase;
			emit('REPORT_STAGE', phase, 'STARTED', observations, null, null);
		}
	};
}

class ReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly path: string,
		readonly state: GuardEnforcementLedgerReportFailureState = 'incompatible'
	) {
		super(message);
	}
}

function exactDataRecord(
	value: unknown,
	expectedKeys: readonly string[],
	path: string
): Readonly<Record<string, unknown>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxyValue(value))
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', `${path} must be an exact object.`, path);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', `${path} must be a data object.`, path);
	const keys = Reflect.ownKeys(value);
	if (
		keys.some((key) => typeof key !== 'string') ||
		keys.length !== expectedKeys.length ||
		expectedKeys.some((key) => !keys.includes(key))
	)
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', `${path} has unexpected keys.`, path);
	const materialized: Record<string, unknown> = {};
	for (const key of expectedKeys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			throw new ReportRequestError(
				'REQUEST_SHAPE_INVALID',
				`${path}.${key} must be an enumerable data property.`,
				`${path}.${key}`
			);
		materialized[key] = descriptor.value;
	}
	return materialized;
}

function boundedBudget(value: unknown, ceiling: number, path: string): number {
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		Object.is(value, -0) ||
		value < 1
	)
		throw new ReportRequestError(
			'REQUEST_BUDGET_INVALID',
			`${path} must be a positive safe integer.`,
			path
		);
	if (value > ceiling)
		throw new ReportRequestError(
			'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			`${path} exceeds the operation safety ceiling.`,
			path,
			'resource-refused'
		);
	return value;
}

function materializeBudgetRecord<Keys extends readonly string[]>(
	value: unknown,
	keys: Keys,
	ceilings: Readonly<Record<Keys[number], number>>,
	path: string
): Readonly<Record<Keys[number], number>> {
	const record = exactDataRecord(value, keys, path);
	return Object.freeze(
		Object.fromEntries(
			keys.map((key) => [
				key,
				boundedBudget(record[key], ceilings[key as Keys[number]], `${path}.${key}`)
			])
		) as Record<Keys[number], number>
	);
}

function materializePath(value: unknown, path: string): string {
	if (typeof value !== 'string' || !isUnicodeScalarString(value) || value.length === 0)
		throw new ReportRequestError('REQUEST_PATH_INVALID', `${path} must be nonempty text.`, path);
	if (value.length > GUARD_ENFORCEMENT_LEDGER_REPORT_ADMISSION_LIMITS.maxProjectPathCharacters)
		throw new ReportRequestError(
			'REQUEST_PATH_BUDGET_EXCEEDED',
			`${path} exceeds the operation path-character ceiling.`,
			path,
			'resource-refused'
		);
	if (
		[...value].some((character) => {
			const codePoint = character.codePointAt(0)!;
			return (
				codePoint <= 0x1f || codePoint === 0x7f || FORBIDDEN_PATH_PATTERN_CHARACTERS.has(character)
			);
		})
	)
		throw new ReportRequestError(
			'REQUEST_PATH_INVALID',
			`${path} contains a control or pattern character.`,
			path
		);
	try {
		return assertCanonicalRelativePath(value);
	} catch {
		throw new ReportRequestError(
			'REQUEST_PATH_INVALID',
			`${path} must be one canonical repository-relative path.`,
			path
		);
	}
}

function materializeProjectPaths(value: unknown, maxProjects: number): readonly string[] {
	if (
		!Array.isArray(value) ||
		isProxyValue(value) ||
		Reflect.getPrototypeOf(value) !== Array.prototype
	)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be a nonempty exact data array.',
			'$.subjectProjectConfigPaths'
		);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	if (
		lengthDescriptor === undefined ||
		!('value' in lengthDescriptor) ||
		typeof lengthDescriptor.value !== 'number' ||
		!Number.isSafeInteger(lengthDescriptor.value) ||
		lengthDescriptor.value <= 0
	)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be a nonempty exact array.',
			'$.subjectProjectConfigPaths'
		);
	const length = lengthDescriptor.value;
	if (length > maxProjects)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_BUDGET_EXCEEDED',
			'$.subjectProjectConfigPaths exceeds the caller project budget.',
			'$.subjectProjectConfigPaths',
			'resource-refused'
		);
	const ownKeys = Reflect.ownKeys(value);
	if (
		ownKeys.some((key) => typeof key !== 'string') ||
		ownKeys.length !== length + 1 ||
		!ownKeys.includes('length') ||
		Array.from({ length }, (_, index) => String(index)).some((key) => !ownKeys.includes(key))
	)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths must be dense and have no extra properties.',
			'$.subjectProjectConfigPaths'
		);
	const paths: string[] = [];
	for (let index = 0; index < length; index += 1) {
		const path = `$.subjectProjectConfigPaths[${index}]`;
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			throw new ReportRequestError(
				'REQUEST_PROJECTS_INVALID',
				`${path} must be an enumerable data property.`,
				path
			);
		paths.push(materializePath(descriptor.value, path));
	}
	const keys = paths.map((path) => canonicalPathKey(path));
	if (new Set(keys).size !== keys.length)
		throw new ReportRequestError(
			'REQUEST_PROJECTS_INVALID',
			'$.subjectProjectConfigPaths contains duplicate canonical paths.',
			'$.subjectProjectConfigPaths'
		);
	return Object.freeze(paths);
}

function materializeRequest(value: unknown): GuardEnforcementLedgerReportRequest {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.schemaVersion !== GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_VERSION_UNSUPPORTED',
			'The guard-enforcement-ledger report request schema version is unsupported.',
			'$.schemaVersion'
		);
	if (record.operationVersion !== GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_VERSION_UNSUPPORTED',
			'The guard-enforcement-ledger report operation version is unsupported.',
			'$.operationVersion'
		);
	if (record.executionSelection !== GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION)
		throw new ReportRequestError(
			'REQUEST_EXECUTION_SELECTION_UNSUPPORTED',
			'The request must explicitly select the retained subprocess execution boundary.',
			'$.executionSelection'
		);
	const budgetsRecord = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const subject = materializeBudgetRecord(
		budgetsRecord.subject,
		SUBJECT_BUDGET_KEYS,
		GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.subject,
		'$.budgets.subject'
	) as unknown as SubjectBudgets;
	const artifactSet = materializeBudgetRecord(
		budgetsRecord.artifactSet,
		ARTIFACT_SET_BUDGET_KEYS,
		GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.artifactSet,
		'$.budgets.artifactSet'
	) as unknown as GuardEnforcementLedgerArtifactSetBudgets;
	const observationBudgets = materializeBudgetRecord(
		budgetsRecord.observation,
		OBSERVATION_BUDGET_KEYS,
		GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.observation,
		'$.budgets.observation'
	) as unknown as GuardEnforcementLedgerBudgets;
	const maxResultBytes = boundedBudget(
		budgetsRecord.maxResultBytes,
		GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.maxResultBytes,
		'$.budgets.maxResultBytes'
	);
	return Object.freeze({
		budgets: Object.freeze({
			artifactSet,
			maxResultBytes,
			observation: observationBudgets,
			subject
		}),
		executionSelection: GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION,
		operationVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: materializeProjectPaths(
			record.subjectProjectConfigPaths,
			subject.maxProjects
		)
	});
}

export type GuardEnforcementLedgerReportRequestAdmission =
	| { readonly outcome: 'admitted'; readonly request: GuardEnforcementLedgerReportRequest }
	| {
			readonly code: string;
			readonly message: string;
			readonly outcome: 'rejected';
			readonly path: string;
			readonly state: GuardEnforcementLedgerReportFailureState;
	  };

export function admitGuardEnforcementLedgerReportRequest(
	requestValue: unknown
): GuardEnforcementLedgerReportRequestAdmission {
	try {
		return Object.freeze({
			outcome: 'admitted' as const,
			request: materializeRequest(requestValue)
		});
	} catch (error) {
		if (error instanceof ReportRequestError)
			return Object.freeze({
				code: error.code,
				message: error.message,
				outcome: 'rejected' as const,
				path: error.path,
				state: error.state
			});
		return Object.freeze({
			code: 'REQUEST_INVALID',
			message: 'The report request could not be inspected safely.',
			outcome: 'rejected' as const,
			path: '$',
			state: 'incompatible' as const
		});
	}
}

function reportDiagnostic(
	code: string,
	message: string,
	path: string | null = null,
	phase: string | null = null,
	severity: 'INFO' | 'WARNING' | 'ERROR' | null = 'ERROR',
	source: GuardEnforcementLedgerReportDiagnostic['source'] = 'REPORT'
): GuardEnforcementLedgerReportDiagnostic {
	return { code, message, path, phase, severity, source };
}

function escapedRegularExpression(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function redactRoot(message: string, repositoryRoot: string): string {
	let redacted = message;
	for (const candidate of new Set([repositoryRoot, repositoryRoot.replaceAll('\\', '/')])) {
		if (candidate.length > 0)
			redacted = redacted.replace(
				new RegExp(escapedRegularExpression(candidate), 'giu'),
				'<repository-root>'
			);
	}
	return redacted;
}

function safeDiagnosticPath(path: string | null, repositoryRoot: string): string | null {
	if (path === null) return null;
	if (
		path.length > GUARD_ENFORCEMENT_LEDGER_REPORT_ADMISSION_LIMITS.maxDiagnosticPathCharacters ||
		!isUnicodeScalarString(path)
	)
		return null;
	if (path.startsWith('$')) return path;
	try {
		if (isAbsolute(path)) return repositoryRelativePath(repositoryRoot, path);
		return assertCanonicalRelativePath(path);
	} catch {
		return null;
	}
}

interface DiagnosticLike {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase?: string | null;
	readonly severity?: 'INFO' | 'WARNING' | 'ERROR' | null;
}

function projectDiagnostics(
	diagnostics: readonly DiagnosticLike[],
	source: Exclude<GuardEnforcementLedgerReportDiagnostic['source'], 'REPORT'>,
	repositoryRoot: string,
	pathMapper: ((path: string | null) => string | null) | undefined = undefined
): GuardEnforcementLedgerReportDiagnostic[] {
	return diagnostics.map((diagnostic) => ({
		code: diagnostic.code,
		message: redactRoot(diagnostic.message, repositoryRoot),
		path:
			pathMapper === undefined
				? safeDiagnosticPath(diagnostic.path, repositoryRoot)
				: pathMapper(diagnostic.path),
		phase: diagnostic.phase ?? null,
		severity: diagnostic.severity ?? null,
		source
	}));
}

function ledgerDiagnosticPath(path: string | null, repositoryRoot: string): string | null {
	if (path === '$request.budgets') return '$.budgets.observation';
	if (path?.startsWith('$request.budgets.') === true)
		return `$.budgets.observation.${path.slice('$request.budgets.'.length)}`;
	if (path?.startsWith('$request') === true) return null;
	return safeDiagnosticPath(path, repositoryRoot);
}

function failure(
	code: string,
	stage: GuardEnforcementLedgerReportStage,
	state: GuardEnforcementLedgerReportFailureState,
	diagnostics: readonly GuardEnforcementLedgerReportDiagnostic[],
	request?: GuardEnforcementLedgerReportRequest,
	subject?: FrozenSubject
): Extract<GuardEnforcementLedgerReportOutcome, { readonly outcome: 'unavailable' }> {
	return {
		analysisAuthority: GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY,
		authorityTransfer: GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS,
		gateEffect: GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT,
		operationVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		...(request === undefined ? {} : { request }),
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject: subject.descriptor })
	};
}

function hasBudgetDiagnostic(diagnostics: readonly DiagnosticLike[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.code.includes('BUDGET'));
}

function subjectFailureIdentity(
	outcome: Exclude<SubjectResolutionOutcome, { readonly outcome: 'resolved' }>
): { readonly code: string; readonly state: GuardEnforcementLedgerReportFailureState } {
	if (hasBudgetDiagnostic(outcome.diagnostics))
		return { code: 'SUBJECT_RESOURCE_REFUSED', state: 'resource-refused' };
	switch (outcome.outcome) {
		case 'not-found':
			return { code: 'SUBJECT_NOT_FOUND', state: 'incompatible' };
		case 'ambiguous':
			return { code: 'SUBJECT_AMBIGUOUS', state: 'incompatible' };
		case 'forbidden':
			return { code: 'SUBJECT_FORBIDDEN', state: 'incompatible' };
		case 'incompatible':
			return { code: 'SUBJECT_INCOMPATIBLE', state: 'incompatible' };
		case 'unavailable':
			return { code: 'SUBJECT_UNAVAILABLE', state: 'failed' };
	}
}

function artifactSetFailureState(
	diagnostics: readonly GuardEnforcementLedgerArtifactSetDiagnostic[]
): GuardEnforcementLedgerReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXHAUSTED'))
		return 'resource-refused';
	if (
		diagnostics.some((diagnostic) =>
			['REQUIRED_ARTIFACT_MISSING', 'UNSUPPORTED_REPOSITORY_LAYOUT'].includes(diagnostic.code)
		)
	)
		return 'incompatible';
	return 'failed';
}

function ledgerFailureState(
	diagnostics: readonly GuardEnforcementLedgerDiagnostic[]
): GuardEnforcementLedgerReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXHAUSTED'))
		return 'resource-refused';
	return 'failed';
}

function ledgerOutcomeEnvelopeReconciles(
	outcome: 'complete' | 'partial',
	diagnostics: readonly GuardEnforcementLedgerDiagnostic[],
	observationValue: GuardEnforcementLedgerObservation
): boolean {
	const audit = observationValue.rawEvidence.audit;
	const expected =
		audit.enforcedAnchorBroken.length +
			audit.enforcedWithoutSite.length +
			audit.stale.length +
			audit.unclassified.length ===
		0
			? 'complete'
			: 'partial';
	return diagnostics.length === 0 && outcome === expected && observationValue.coverage.reconciles;
}

function existingProjectPath(
	repositoryRoot: string,
	path: string,
	request: GuardEnforcementLedgerReportRequest
):
	| ReturnType<typeof resolveExistingRepositoryPath>
	| Extract<GuardEnforcementLedgerReportOutcome, { readonly outcome: 'unavailable' }> {
	try {
		const resolved = resolveExistingRepositoryPath(repositoryRoot, path);
		if (!statSync(resolved.realPath).isFile())
			return failure(
				'PROJECT_PATH_INVALID',
				'SUBJECT',
				'incompatible',
				[
					reportDiagnostic(
						'PROJECT_PATH_INVALID',
						'The requested project path is not a file.',
						path
					)
				],
				request
			);
		return resolved;
	} catch {
		return failure(
			'PROJECT_PATH_INVALID',
			'SUBJECT',
			'incompatible',
			[
				reportDiagnostic(
					'PROJECT_PATH_INVALID',
					'The requested project path is absent or escapes the repository.',
					path
				)
			],
			request
		);
	}
}

function subjectObservations(
	subject: FrozenSubject,
	budgets: SubjectBudgets
): readonly GuardEnforcementLedgerReportProgressObservation[] {
	const artifactBytes = subject.artifacts.reduce((total, artifact) => total + artifact.bytes, 0);
	return [
		observation('SUBJECT_ARTIFACTS', subject.artifacts.length, budgets.maxFiles),
		observation('SUBJECT_BYTES', artifactBytes, budgets.maxBytes, 'BYTES'),
		observation('SUBJECT_PROJECTS', subject.projects.length, budgets.maxProjects)
	];
}

function ledgerObservations(
	value: GuardEnforcementLedgerObservation,
	budgets: GuardEnforcementLedgerBudgets
): readonly GuardEnforcementLedgerReportProgressObservation[] {
	return [
		observation(
			'OBSERVATION_GUARDED_ARROW_OCCURRENCES',
			value.coverage.arrowOccurrences,
			budgets.maxGuardedArrows
		),
		observation(
			'OBSERVATION_DISTINCT_GUARD_TEXTS',
			value.coverage.distinctGuardTexts,
			budgets.maxGuardTexts
		),
		observation('OBSERVATION_LEDGER_ROWS', value.coverage.ledgerRows, budgets.maxLedgerRows),
		observation('OBSERVATION_LIMITATIONS', value.limitations.length, null),
		observation(
			'OBSERVATION_RAW_OUTPUT_BYTES',
			value.rawOutput.bytes,
			budgets.maxStdoutBytes,
			'BYTES'
		),
		observation('OBSERVATION_STALE_LEDGER_ROWS', value.coverage.staleLedgerRows, null),
		observation('OBSERVATION_UNCLASSIFIED_GUARD_TEXTS', value.coverage.unclassifiedGuardTexts, null)
	];
}

export interface GuardEnforcementLedgerReportRuntimeDependencies {
	readonly buildArtifactSet: typeof buildGuardEnforcementLedgerArtifactSet;
	readonly observeLedger: typeof observeGuardEnforcementLedger;
	readonly resolveSubject: typeof resolveSubject;
	readonly validateArtifactSet: typeof validateGuardEnforcementLedgerArtifactSet;
	readonly validateObservation: typeof validateGuardEnforcementLedgerObservation;
	readonly verifySubject: typeof verifyFrozenSubject;
}

const DEFAULT_DEPENDENCIES: GuardEnforcementLedgerReportRuntimeDependencies = Object.freeze({
	buildArtifactSet: buildGuardEnforcementLedgerArtifactSet,
	observeLedger: observeGuardEnforcementLedger,
	resolveSubject,
	validateArtifactSet: validateGuardEnforcementLedgerArtifactSet,
	validateObservation: validateGuardEnforcementLedgerObservation,
	verifySubject: verifyFrozenSubject
});

async function runInternal(
	requestValue: unknown,
	options: RunGuardEnforcementLedgerReportOptions,
	progress: ProgressRecorder,
	dependencies: GuardEnforcementLedgerReportRuntimeDependencies
): Promise<GuardEnforcementLedgerReportOutcome> {
	progress.start('REQUEST_BIND');
	const admission = admitGuardEnforcementLedgerReportRequest(requestValue);
	if (admission.outcome === 'rejected') {
		progress.fail([], admission.code);
		return failure(admission.code, 'REQUEST', admission.state, [
			reportDiagnostic(admission.code, admission.message, admission.path, 'REQUEST')
		]);
	}
	const request = admission.request;
	let repositoryRoot: string;
	try {
		repositoryRoot = resolveRepositoryRoot(options.repositoryRoot);
	} catch {
		progress.fail([], 'REPOSITORY_ROOT_UNAVAILABLE');
		return failure(
			'REPOSITORY_ROOT_UNAVAILABLE',
			'REQUEST',
			'failed',
			[
				reportDiagnostic('REPOSITORY_ROOT_UNAVAILABLE', 'The fixed repository root is unavailable.')
			],
			request
		);
	}
	progress.complete([], 'REQUEST_ADMITTED');

	progress.start('SUBJECT_CAPTURE');
	const resolvedProjects = [];
	for (const projectPath of request.subjectProjectConfigPaths) {
		const resolved = existingProjectPath(repositoryRoot, projectPath, request);
		if ('outcome' in resolved) {
			progress.fail([], resolved.code);
			return resolved;
		}
		resolvedProjects.push(resolved);
	}
	const subjectOutcome = dependencies.resolveSubject({
		budgets: request.budgets.subject,
		expectEmpty: false,
		filters: { exclude: [], include: [] },
		operationVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: repositoryRoot,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: {
			additionalArtifacts: GUARD_ENFORCEMENT_LEDGER_REPORT_ADDITIONAL_ARTIFACT_PATHS,
			kind: 'EXPLICIT_PROJECTS',
			projects: resolvedProjects.map((project) => project.path)
		},
		subjectKind: 'WORKTREE'
	});
	const subjectDiagnostics = projectDiagnostics(
		subjectOutcome.diagnostics,
		'SUBJECT',
		repositoryRoot
	);
	if (subjectOutcome.outcome !== 'resolved') {
		const identity = subjectFailureIdentity(subjectOutcome);
		progress.fail([], identity.code);
		return failure(identity.code, 'SUBJECT', identity.state, subjectDiagnostics, request);
	}
	const subject = subjectOutcome.subject;
	progress.complete(
		subjectObservations(subject, request.budgets.subject),
		'EXACT_SUBJECT_CAPTURED'
	);
	const subjectBytes = subject.artifacts.reduce((total, artifact) => total + artifact.bytes, 0);

	progress.start('ARTIFACT_SET');
	const artifactSetOutcome = dependencies.buildArtifactSet(
		{
			budgets: request.budgets.artifactSet,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ subject }
	);
	const artifactSetDiagnostics = projectDiagnostics(
		artifactSetOutcome.diagnostics,
		'ARTIFACT_SET',
		repositoryRoot
	);
	if (artifactSetOutcome.outcome !== 'complete') {
		progress.fail([], artifactSetOutcome.diagnostics[0]?.code ?? 'ARTIFACT_SET_UNAVAILABLE');
		return failure(
			'ARTIFACT_SET_UNAVAILABLE',
			'ARTIFACT_SET',
			artifactSetFailureState(artifactSetOutcome.diagnostics),
			[...subjectDiagnostics, ...artifactSetDiagnostics],
			request,
			subject
		);
	}
	const artifactSet = artifactSetOutcome.artifactSet;
	const artifactSetValidation = dependencies.validateArtifactSet(artifactSet, subject, {
		maxIssues: Math.max(1, Math.min(1_000, request.budgets.artifactSet.maxDiagnostics))
	});
	if (artifactSetValidation.state !== 'VALID') {
		progress.fail([], 'ARTIFACT_SET_VALIDATION_FAILED');
		return failure(
			'ARTIFACT_SET_VALIDATION_FAILED',
			'ARTIFACT_SET',
			'failed',
			[
				...subjectDiagnostics,
				...artifactSetValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, repositoryRoot),
						safeDiagnosticPath(issue.path, repositoryRoot),
						'VALIDATE',
						'ERROR',
						'ARTIFACT_SET'
					)
				)
			],
			request,
			subject
		);
	}
	const artifactBytes = artifactSet.artifacts.reduce(
		(total, artifact) => total + artifact.bytes,
		0
	);
	progress.complete(
		[
			observation(
				'ARTIFACT_SET_ARTIFACTS',
				artifactSet.artifacts.length,
				request.budgets.artifactSet.maxArtifacts
			),
			observation(
				'ARTIFACT_SET_BYTES',
				artifactBytes,
				request.budgets.artifactSet.maxTotalBytes,
				'BYTES'
			)
		],
		'EXACT_ARTIFACT_SET_BOUND'
	);

	progress.start('RETAINED_LEDGER');
	const ledgerOutcome = await dependencies.observeLedger(
		{
			artifactSetId: artifactSet.id,
			budgets: request.budgets.observation,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ artifactSet, subject },
		{ onProgress: (event) => progress.forwardAdapter(event) }
	);
	const ledgerDiagnostics = projectDiagnostics(
		ledgerOutcome.diagnostics,
		'RETAINED_LEDGER',
		repositoryRoot,
		(path) => ledgerDiagnosticPath(path, repositoryRoot)
	);
	if (ledgerOutcome.outcome === 'unavailable') {
		progress.fail([], ledgerOutcome.diagnostics[0]?.code ?? 'RETAINED_LEDGER_UNAVAILABLE');
		return failure(
			'RETAINED_LEDGER_UNAVAILABLE',
			'RETAINED_LEDGER',
			ledgerFailureState(ledgerOutcome.diagnostics),
			[...subjectDiagnostics, ...artifactSetDiagnostics, ...ledgerDiagnostics],
			request,
			subject
		);
	}
	const ledgerObservation = ledgerOutcome.observation;
	const ledgerValidation = dependencies.validateObservation(ledgerObservation, subject, {
		maxIssues: Math.max(1, Math.min(1_000, request.budgets.observation.maxDiagnostics))
	});
	if (ledgerValidation.state !== 'VALID') {
		progress.fail(
			ledgerObservations(ledgerObservation, request.budgets.observation),
			'OBSERVATION_VALIDATION_FAILED'
		);
		return failure(
			'OBSERVATION_VALIDATION_FAILED',
			'RETAINED_LEDGER',
			'failed',
			[
				...subjectDiagnostics,
				...artifactSetDiagnostics,
				...ledgerDiagnostics,
				...ledgerValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, repositoryRoot),
						safeDiagnosticPath(issue.path, repositoryRoot),
						'VALIDATE',
						'ERROR',
						'RETAINED_LEDGER'
					)
				)
			],
			request,
			subject
		);
	}
	if (
		!ledgerOutcomeEnvelopeReconciles(
			ledgerOutcome.outcome,
			ledgerOutcome.diagnostics,
			ledgerObservation
		)
	) {
		progress.fail(
			ledgerObservations(ledgerObservation, request.budgets.observation),
			'EVIDENCE_IDENTITY_MISMATCH'
		);
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RETAINED_LEDGER',
			'failed',
			[
				...subjectDiagnostics,
				...artifactSetDiagnostics,
				...ledgerDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The retained observer outcome, diagnostics, and audit-hole classification do not reconcile.'
				)
			],
			request,
			subject
		);
	}
	progress.complete(
		ledgerObservations(ledgerObservation, request.budgets.observation),
		ledgerOutcome.outcome === 'complete'
			? 'COMPLETE_RETAINED_EVIDENCE'
			: 'PARTIAL_RETAINED_EVIDENCE'
	);

	progress.start('CURRENTNESS');
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		freshness = dependencies.verifySubject(subject, { rootLocator: repositoryRoot });
	} catch {
		freshness = {
			changedPaths: [],
			diagnostics: [
				{
					code: 'SUBJECT_CHANGED_DURING_RESOLUTION',
					message: 'Final captured-subject currentness could not be established.',
					path: null,
					phase: 'FRESHNESS',
					severity: 'WARNING'
				} satisfies SubjectDiagnostic
			],
			state: 'UNAVAILABLE'
		};
	}
	const currentnessState =
		freshness.state === 'CURRENT' ? 'CURRENT_FOR_CAPTURED_SUBJECT' : freshness.state;
	const currentnessDiagnostics = projectDiagnostics(
		freshness.diagnostics,
		'CURRENTNESS',
		repositoryRoot
	);
	progress.complete(
		[observation('CURRENTNESS_CHANGED_PATHS', freshness.changedPaths.length, null)],
		currentnessState
	);

	progress.start('RESULT');
	const retainedAnalyzer = artifactSet.artifacts.find((artifact) =>
		artifact.uses.includes('ANALYZER_SOURCE')
	);
	const retainedData = artifactSet.artifacts.find((artifact) =>
		artifact.uses.includes('LEDGER_DATA')
	);
	if (
		ledgerObservation.subjectId !== subject.descriptor.subjectId ||
		ledgerObservation.artifactSet.id !== artifactSet.id ||
		canonicalSemanticJson(ledgerObservation.artifactSet) !== canonicalSemanticJson(artifactSet) ||
		canonicalSemanticJson(ledgerObservation.budgets) !==
			canonicalSemanticJson(request.budgets.observation) ||
		ledgerObservation.schemaVersion !== GUARD_ENFORCEMENT_LEDGER_SCHEMA_VERSION ||
		ledgerObservation.operationVersion !== GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION ||
		ledgerObservation.verifierAuthority !== GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY ||
		ledgerObservation.authorityTransfer !== GUARD_ENFORCEMENT_LEDGER_AUTHORITY_TRANSFER ||
		ledgerObservation.gateEffect !== GUARD_ENFORCEMENT_LEDGER_GATE_EFFECT ||
		ledgerObservation.baselineChange !== GUARD_ENFORCEMENT_LEDGER_BASELINE_CHANGE ||
		ledgerObservation.oracleChange !== GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE ||
		ledgerObservation.replacementEquivalence !== GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE ||
		ledgerObservation.retainedTestExecution !== GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION ||
		ledgerObservation.runtimeEnforcement !== GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT ||
		ledgerObservation.integrationStrategy !== GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY ||
		ledgerObservation.method !== GUARD_ENFORCEMENT_LEDGER_METHOD ||
		ledgerObservation.canonicalProfile !== GUARD_ENFORCEMENT_LEDGER_CANONICAL_PROFILE ||
		canonicalSemanticJson(ledgerObservation.limitations) !==
			canonicalSemanticJson(GUARD_ENFORCEMENT_LEDGER_LIMITATIONS) ||
		ledgerObservation.executor.adapterId !== GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID ||
		ledgerObservation.executor.adapterVersion !== GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION ||
		retainedAnalyzer === undefined ||
		ledgerObservation.executor.retainedAnalyzerCanonicalPathKey !==
			retainedAnalyzer.canonicalPathKey ||
		ledgerObservation.executor.retainedAnalyzerSha256 !== retainedAnalyzer.sha256 ||
		retainedData === undefined ||
		ledgerObservation.executor.retainedDataCanonicalPathKey !== retainedData.canonicalPathKey ||
		ledgerObservation.executor.retainedDataSha256 !== retainedData.sha256
	) {
		progress.fail([], 'EVIDENCE_IDENTITY_MISMATCH');
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				...subjectDiagnostics,
				...artifactSetDiagnostics,
				...ledgerDiagnostics,
				...currentnessDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The retained observation does not reconcile with its exact subject, artifact set, or authority boundary.'
				)
			],
			request,
			subject
		);
	}
	const stageOutcomes: GuardEnforcementLedgerReportStageOutcomes = {
		artifactSet: { diagnosticCodes: [], outcome: 'complete' },
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		retainedLedger: {
			diagnosticCodes: ledgerOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: ledgerOutcome.outcome
		},
		subject: {
			completeness: subjectOutcome.completeness,
			diagnosticCodes: subjectOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'resolved'
		}
	};
	const report: GuardEnforcementLedgerReportOutcome = {
		analysisAuthority: GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY,
		authorityTransfer: GUARD_ENFORCEMENT_LEDGER_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [
			...subjectDiagnostics,
			...artifactSetDiagnostics,
			...ledgerDiagnostics,
			...currentnessDiagnostics
		],
		gateEffect: GUARD_ENFORCEMENT_LEDGER_REPORT_GATE_EFFECT,
		operationVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				adapterId: GUARD_ENFORCEMENT_LEDGER_ADAPTER_ID,
				fullJanCsaa007Conformance: GUARD_ENFORCEMENT_LEDGER_REPORT_FULL_JAN_CSAA_007_CONFORMANCE,
				fullJanCsaa008Conformance: GUARD_ENFORCEMENT_LEDGER_REPORT_FULL_JAN_CSAA_008_CONFORMANCE,
				integrationStrategy: GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
				id: GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_ID,
				oracleChange: GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE,
				registryStatus: GUARD_ENFORCEMENT_LEDGER_REPORT_REGISTRY_STATUS,
				replacementEquivalence: GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE,
				retainedTestExecution: GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION,
				runtimeEnforcement: GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT,
				scope: GUARD_ENFORCEMENT_LEDGER_REPORT_SCOPE,
				status: GUARD_ENFORCEMENT_LEDGER_REPORT_CAPABILITY_STATUS,
				verifierAuthority: GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY
			},
			coverage: {
				...ledgerObservation.coverage,
				artifactBytes,
				artifacts: artifactSet.artifacts.length,
				health: 'PARTIAL',
				limitations: ledgerObservation.limitations.length,
				rawOutputBytes: ledgerObservation.rawOutput.bytes
			},
			currentness: {
				changedPaths: freshness.changedPaths,
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			evidence: {
				encoding: 'FULL_VALIDATED_RETAINED_GUARD_ENFORCEMENT_LEDGER_OBSERVATION',
				observation: ledgerObservation
			},
			facadeNonclaims: GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS,
			interpretation: 'VALIDATED_CAPTURE_AND_EXECUTOR_BOUND_RETAINED_LEDGER_EVIDENCE',
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_RESULT_SCHEMA_VERSION,
			selection: GUARD_ENFORCEMENT_LEDGER_REPORT_SELECTION,
			subjectSummary: {
				artifactBytes: subjectBytes,
				artifacts: subject.artifacts.length,
				completeness: subjectOutcome.completeness,
				projects: subject.projects.length
			}
		},
		schemaVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_SCHEMA_VERSION,
		stageOutcomes,
		state: 'partial',
		subject: subject.descriptor
	};
	try {
		const resultBytes = canonicalSemanticJsonWitness(report).bytes + 1;
		if (resultBytes > request.budgets.maxResultBytes) {
			progress.fail(
				[observation('RESULT_BYTES', resultBytes, request.budgets.maxResultBytes, 'BYTES')],
				'RESULT_BUDGET_EXCEEDED'
			);
			return failure(
				'RESULT_BUDGET_EXCEEDED',
				'RESULT',
				'resource-refused',
				[
					reportDiagnostic(
						'RESULT_BUDGET_EXCEEDED',
						'The admitted guard-enforcement-ledger report exceeds maxResultBytes.'
					)
				],
				request,
				subject
			);
		}
		progress.complete(
			[observation('RESULT_BYTES', resultBytes, request.budgets.maxResultBytes, 'BYTES')],
			'PARTIAL'
		);
		return report;
	} catch {
		progress.fail([], 'RESULT_SERIALIZATION_FAILED');
		return failure(
			'RESULT_SERIALIZATION_FAILED',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'RESULT_SERIALIZATION_FAILED',
					'The report could not be serialized safely.'
				)
			],
			request,
			subject
		);
	}
}

/** @internal Test seam; intentionally not exported from the package root. */
export async function runGuardEnforcementLedgerReportWithDependencies(
	requestValue: unknown,
	options: RunGuardEnforcementLedgerReportOptions,
	dependencies: GuardEnforcementLedgerReportRuntimeDependencies
): Promise<GuardEnforcementLedgerReportOutcome> {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(await runInternal(requestValue, options, progress, dependencies));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic('INTERNAL_FAILURE', 'The guard-enforcement-ledger report failed closed.')
			])
		);
	}
}

export async function runGuardEnforcementLedgerReport(
	requestValue: unknown,
	options: RunGuardEnforcementLedgerReportOptions
): Promise<GuardEnforcementLedgerReportOutcome> {
	return runGuardEnforcementLedgerReportWithDependencies(
		requestValue,
		options,
		DEFAULT_DEPENDENCIES
	);
}

export function guardEnforcementLedgerReportExitCode(
	outcome: GuardEnforcementLedgerReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
