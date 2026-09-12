import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import {
	ARROW_COMMAND_CENSUS_ADAPTER_ID,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_AUTHORITY_TRANSFER,
	ARROW_COMMAND_CENSUS_CANONICAL_PROFILE,
	ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_007_CONFORMANCE,
	ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_008_CONFORMANCE,
	ARROW_COMMAND_CENSUS_GATE_EFFECT,
	ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY,
	ARROW_COMMAND_CENSUS_LIMITATIONS,
	ARROW_COMMAND_CENSUS_METHOD,
	ARROW_COMMAND_CENSUS_OBSERVATION_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ORACLE_CHANGE,
	ARROW_COMMAND_CENSUS_REPLACEMENT_EQUIVALENCE,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY,
	type ArrowCommandCensusArtifactSetBudgets,
	type ArrowCommandCensusArtifactSetDiagnostic,
	type ArrowCommandCensusBudgets,
	type ArrowCommandCensusDiagnostic,
	type ArrowCommandCensusObservation
} from '../contracts/arrow-command-census.js';
import {
	ARROW_COMMAND_CENSUS_REPORT_AUTHORITY,
	ARROW_COMMAND_CENSUS_REPORT_ADMISSION_LIMITS,
	ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER,
	ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_ID,
	ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_STATUS,
	ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION,
	ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT,
	ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS,
	ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_REPORT_REGISTRY_STATUS,
	ARROW_COMMAND_CENSUS_REPORT_RESULT_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS,
	ARROW_COMMAND_CENSUS_REPORT_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_REPORT_SELECTION,
	ARROW_COMMAND_CENSUS_REPORT_SCOPE,
	type ArrowCommandCensusReportDiagnostic,
	type ArrowCommandCensusReportFailureState,
	type ArrowCommandCensusReportOutcome,
	type ArrowCommandCensusReportRequest,
	type ArrowCommandCensusReportStage,
	type ArrowCommandCensusReportStageOutcomes
} from '../contracts/arrow-command-census-report.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject,
	type SubjectBudgets,
	type SubjectDiagnostic,
	type SubjectResolutionOutcome
} from '../contracts/subject.js';
import {
	ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
	buildArrowCommandCensusArtifactSet,
	validateArrowCommandCensusArtifactSet
} from '../providers/jpwb-arrow-command-census/artifact-set.js';
import {
	observeArrowCommandCensus,
	type ArrowCommandCensusProgressEvent
} from '../providers/jpwb-arrow-command-census/observe-arrow-command-census.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
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
] as const satisfies readonly (keyof ArrowCommandCensusArtifactSetBudgets)[];
const OBSERVATION_BUDGET_KEYS = [
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
] as const satisfies readonly (keyof ArrowCommandCensusBudgets)[];
const FORBIDDEN_PATH_PATTERN_CHARACTERS = new Set(['*', '?', '[', ']', '{', '}']);

export const ARROW_COMMAND_CENSUS_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-arrow-command-census-report-progress/0.1.0' as const;

export const ARROW_COMMAND_CENSUS_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type ArrowCommandCensusReportProgressPhase =
	| 'REQUEST_BIND'
	| 'SUBJECT_CAPTURE'
	| 'ARTIFACT_SET'
	| 'RETAINED_CENSUS'
	| 'CURRENTNESS'
	| 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	ARTIFACT_SET: 'ARTIFACT_SET',
	CURRENTNESS: 'CURRENTNESS',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT',
	RETAINED_CENSUS: 'RETAINED_CENSUS',
	SUBJECT_CAPTURE: 'SUBJECT'
} as const satisfies Readonly<
	Record<ArrowCommandCensusReportProgressPhase, ArrowCommandCensusReportStage>
>);

export type ArrowCommandCensusReportProgressObservationMetric =
	| 'ARTIFACT_SET_ARTIFACTS'
	| 'ARTIFACT_SET_BYTES'
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'OBSERVATION_DECLARED_ARROWS'
	| 'OBSERVATION_DECLARED_SITES'
	| 'OBSERVATION_LIMITATIONS'
	| 'OBSERVATION_RAW_OUTPUT_BYTES'
	| 'OBSERVATION_TOTAL_TOPOLOGY_ARROWS'
	| 'OBSERVATION_UNCOVERED_ARROWS'
	| 'RESULT_BYTES'
	| 'SUBJECT_ARTIFACTS'
	| 'SUBJECT_BYTES'
	| 'SUBJECT_PROJECTS';

export interface ArrowCommandCensusReportProgressObservation {
	readonly limit: number | null;
	readonly metric: ArrowCommandCensusReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

export interface ArrowCommandCensusReportProgressEvent {
	readonly adapterProgress: ArrowCommandCensusProgressEvent | null;
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly kind: 'REPORT_STAGE' | 'RETAINED_ADAPTER';
	readonly nonclaims: typeof ARROW_COMMAND_CENSUS_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly ArrowCommandCensusReportProgressObservation[];
	readonly operationVersion: typeof ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION;
	readonly phase: ArrowCommandCensusReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_ARROW_COMMAND_CENSUS_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof ARROW_COMMAND_CENSUS_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: ArrowCommandCensusReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

export interface RunArrowCommandCensusReportOptions {
	/** Trusted-host telemetry callback; excluded from terminal evidence and identity. */
	readonly onProgress?: (event: ArrowCommandCensusReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

interface ProgressRecorder {
	complete(
		observations?: readonly ArrowCommandCensusReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly ArrowCommandCensusReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: ArrowCommandCensusReportOutcome): ArrowCommandCensusReportOutcome;
	forwardAdapter(event: ArrowCommandCensusProgressEvent): void;
	start(
		phase: ArrowCommandCensusReportProgressPhase,
		observations?: readonly ArrowCommandCensusReportProgressObservation[]
	): void;
}

function observation(
	metric: ArrowCommandCensusReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: ArrowCommandCensusReportProgressObservation['unit'] = 'COUNT'
): ArrowCommandCensusReportProgressObservation {
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
	options: RunArrowCommandCensusReportOptions
): ((event: ArrowCommandCensusReportProgressEvent) => unknown) | undefined {
	try {
		if (options === null || typeof options !== 'object' || isProxyValue(options)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: ArrowCommandCensusReportProgressEvent) => unknown)
			: undefined;
	} catch {
		return undefined;
	}
}

function createProgressRecorder(options: RunArrowCommandCensusReportOptions): ProgressRecorder {
	const sink = safeProgressSink(options);
	const startedAt = performance.now();
	let sequence = 0;
	let active: ArrowCommandCensusReportProgressPhase | null = null;
	const emit = (
		kind: ArrowCommandCensusReportProgressEvent['kind'],
		phase: ArrowCommandCensusReportProgressPhase,
		state: ArrowCommandCensusReportProgressEvent['state'],
		observations: readonly ArrowCommandCensusReportProgressObservation[],
		detailCode: string | null,
		adapterProgress: ArrowCommandCensusProgressEvent | null
	): void => {
		const event: ArrowCommandCensusReportProgressEvent = Object.freeze({
			adapterProgress,
			deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
			detailCode,
			elapsedMs: Math.max(0, performance.now() - startedAt),
			kind,
			nonclaims: ARROW_COMMAND_CENSUS_REPORT_PROGRESS_NONCLAIMS,
			observations,
			operationVersion: ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
			phase,
			protocolRole: 'PRELIMINARY_ARROW_COMMAND_CENSUS_REPORT_TELEMETRY',
			reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
			schemaVersion: ARROW_COMMAND_CENSUS_REPORT_PROGRESS_SCHEMA_VERSION,
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
		observations: readonly ArrowCommandCensusReportProgressObservation[],
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
		finish(outcome): ArrowCommandCensusReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			return outcome;
		},
		forwardAdapter(event): void {
			// The retained provider may expose live internal objects in progress details. A canonical
			// data clone prevents a trusted-host observer from mutating provider evidence in flight.
			let adapterProgress: ArrowCommandCensusProgressEvent;
			try {
				adapterProgress = JSON.parse(
					canonicalSemanticJson(event)
				) as ArrowCommandCensusProgressEvent;
			} catch {
				return;
			}
			emit(
				'RETAINED_ADAPTER',
				'RETAINED_CENSUS',
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
		readonly state: ArrowCommandCensusReportFailureState = 'incompatible'
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
	if (value.length > ARROW_COMMAND_CENSUS_REPORT_ADMISSION_LIMITS.maxProjectPathCharacters)
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

function materializeRequest(value: unknown): ArrowCommandCensusReportRequest {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.schemaVersion !== ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_VERSION_UNSUPPORTED',
			'The arrow-command-census report request schema version is unsupported.',
			'$.schemaVersion'
		);
	if (record.operationVersion !== ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_VERSION_UNSUPPORTED',
			'The arrow-command-census report operation version is unsupported.',
			'$.operationVersion'
		);
	if (record.executionSelection !== ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION)
		throw new ReportRequestError(
			'REQUEST_EXECUTION_SELECTION_UNSUPPORTED',
			'The request must explicitly select the retained subprocess execution boundary.',
			'$.executionSelection'
		);
	const budgetsRecord = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const subject = materializeBudgetRecord(
		budgetsRecord.subject,
		SUBJECT_BUDGET_KEYS,
		ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS.subject,
		'$.budgets.subject'
	) as unknown as SubjectBudgets;
	const artifactSet = materializeBudgetRecord(
		budgetsRecord.artifactSet,
		ARTIFACT_SET_BUDGET_KEYS,
		ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS.artifactSet,
		'$.budgets.artifactSet'
	) as unknown as ArrowCommandCensusArtifactSetBudgets;
	const observationBudgets = materializeBudgetRecord(
		budgetsRecord.observation,
		OBSERVATION_BUDGET_KEYS,
		ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS.observation,
		'$.budgets.observation'
	) as unknown as ArrowCommandCensusBudgets;
	const maxResultBytes = boundedBudget(
		budgetsRecord.maxResultBytes,
		ARROW_COMMAND_CENSUS_REPORT_SAFETY_CEILINGS.maxResultBytes,
		'$.budgets.maxResultBytes'
	);
	return Object.freeze({
		budgets: Object.freeze({
			artifactSet,
			maxResultBytes,
			observation: observationBudgets,
			subject
		}),
		executionSelection: ARROW_COMMAND_CENSUS_REPORT_EXECUTION_SELECTION,
		operationVersion: ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
		schemaVersion: ARROW_COMMAND_CENSUS_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: materializeProjectPaths(
			record.subjectProjectConfigPaths,
			subject.maxProjects
		)
	});
}

export type ArrowCommandCensusReportRequestAdmission =
	| { readonly outcome: 'admitted'; readonly request: ArrowCommandCensusReportRequest }
	| {
			readonly code: string;
			readonly message: string;
			readonly outcome: 'rejected';
			readonly path: string;
			readonly state: ArrowCommandCensusReportFailureState;
	  };

export function admitArrowCommandCensusReportRequest(
	requestValue: unknown
): ArrowCommandCensusReportRequestAdmission {
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
	source: ArrowCommandCensusReportDiagnostic['source'] = 'REPORT'
): ArrowCommandCensusReportDiagnostic {
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
		path.startsWith('$') &&
		path.length <= ARROW_COMMAND_CENSUS_REPORT_ADMISSION_LIMITS.maxDiagnosticPathCharacters &&
		isUnicodeScalarString(path)
	)
		return path;
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
	source: Exclude<ArrowCommandCensusReportDiagnostic['source'], 'REPORT'>,
	repositoryRoot: string,
	pathMapper: ((path: string | null) => string | null) | undefined = undefined
): ArrowCommandCensusReportDiagnostic[] {
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

function censusDiagnosticPath(path: string | null, repositoryRoot: string): string | null {
	if (path === '$request.budgets') return '$.budgets.observation';
	if (path?.startsWith('$request.budgets.') === true)
		return `$.budgets.observation.${path.slice('$request.budgets.'.length)}`;
	if (path?.startsWith('$request') === true) return null;
	return safeDiagnosticPath(path, repositoryRoot);
}

function failure(
	code: string,
	stage: ArrowCommandCensusReportStage,
	state: ArrowCommandCensusReportFailureState,
	diagnostics: readonly ArrowCommandCensusReportDiagnostic[],
	request?: ArrowCommandCensusReportRequest,
	subject?: FrozenSubject
): Extract<ArrowCommandCensusReportOutcome, { readonly outcome: 'unavailable' }> {
	return {
		analysisAuthority: ARROW_COMMAND_CENSUS_REPORT_AUTHORITY,
		authorityTransfer: ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS,
		gateEffect: ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT,
		operationVersion: ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		...(request === undefined ? {} : { request }),
		schemaVersion: ARROW_COMMAND_CENSUS_REPORT_SCHEMA_VERSION,
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
): { readonly code: string; readonly state: ArrowCommandCensusReportFailureState } {
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
	diagnostics: readonly ArrowCommandCensusArtifactSetDiagnostic[]
): ArrowCommandCensusReportFailureState {
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

function censusFailureState(
	diagnostics: readonly ArrowCommandCensusDiagnostic[]
): ArrowCommandCensusReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXHAUSTED'))
		return 'resource-refused';
	return 'failed';
}

function censusOutcomeEnvelopeReconciles(
	outcome: 'complete' | 'partial',
	diagnostics: readonly ArrowCommandCensusDiagnostic[],
	observationValue: ArrowCommandCensusObservation
): boolean {
	const baselineMatches =
		observationValue.coverage.baselineMatches && observationValue.baselineComparison.matches;
	if (outcome === 'complete')
		return (
			diagnostics.length === 0 &&
			baselineMatches &&
			observationValue.epistemic.executionHealth === 'SUCCEEDED'
		);
	return (
		diagnostics.length === 1 &&
		diagnostics[0]?.code === 'BASELINE_MISMATCH' &&
		diagnostics[0].path === 'verif/arrow-command-census.baseline.json' &&
		diagnostics[0].phase === 'VALIDATE' &&
		diagnostics[0].severity === 'WARNING' &&
		!observationValue.coverage.baselineMatches &&
		!observationValue.baselineComparison.matches &&
		observationValue.epistemic.executionHealth === 'PARTIAL'
	);
}

function existingProjectPath(
	repositoryRoot: string,
	path: string,
	request: ArrowCommandCensusReportRequest
):
	| ReturnType<typeof resolveExistingRepositoryPath>
	| Extract<ArrowCommandCensusReportOutcome, { readonly outcome: 'unavailable' }> {
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
): readonly ArrowCommandCensusReportProgressObservation[] {
	const artifactBytes = subject.artifacts.reduce((total, artifact) => total + artifact.bytes, 0);
	return [
		observation('SUBJECT_ARTIFACTS', subject.artifacts.length, budgets.maxFiles),
		observation('SUBJECT_BYTES', artifactBytes, budgets.maxBytes, 'BYTES'),
		observation('SUBJECT_PROJECTS', subject.projects.length, budgets.maxProjects)
	];
}

function censusObservations(
	value: ArrowCommandCensusObservation,
	budgets: ArrowCommandCensusBudgets
): readonly ArrowCommandCensusReportProgressObservation[] {
	return [
		observation(
			'OBSERVATION_DECLARED_ARROWS',
			value.declaredArrows.length,
			budgets.maxDeclaredArrowOccurrences
		),
		observation('OBSERVATION_DECLARED_SITES', value.declaredSites.length, budgets.maxDeclaredSites),
		observation('OBSERVATION_LIMITATIONS', value.limitations.length, null),
		observation(
			'OBSERVATION_RAW_OUTPUT_BYTES',
			value.rawOutput.bytes,
			budgets.maxStdoutBytes,
			'BYTES'
		),
		observation(
			'OBSERVATION_TOTAL_TOPOLOGY_ARROWS',
			value.coverage.totalInScopeTopologyArrows,
			null
		),
		observation('OBSERVATION_UNCOVERED_ARROWS', value.coverage.uncoveredArrows, null)
	];
}

export interface ArrowCommandCensusReportRuntimeDependencies {
	readonly buildArtifactSet: typeof buildArrowCommandCensusArtifactSet;
	readonly observeCensus: typeof observeArrowCommandCensus;
	readonly resolveSubject: typeof resolveSubject;
	readonly validateArtifactSet: typeof validateArrowCommandCensusArtifactSet;
	readonly validateObservation: typeof validateArrowCommandCensusObservation;
	readonly verifySubject: typeof verifyFrozenSubject;
}

const DEFAULT_DEPENDENCIES: ArrowCommandCensusReportRuntimeDependencies = Object.freeze({
	buildArtifactSet: buildArrowCommandCensusArtifactSet,
	observeCensus: observeArrowCommandCensus,
	resolveSubject,
	validateArtifactSet: validateArrowCommandCensusArtifactSet,
	validateObservation: validateArrowCommandCensusObservation,
	verifySubject: verifyFrozenSubject
});

async function runInternal(
	requestValue: unknown,
	options: RunArrowCommandCensusReportOptions,
	progress: ProgressRecorder,
	dependencies: ArrowCommandCensusReportRuntimeDependencies
): Promise<ArrowCommandCensusReportOutcome> {
	progress.start('REQUEST_BIND');
	const admission = admitArrowCommandCensusReportRequest(requestValue);
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
		operationVersion: ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: repositoryRoot,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: {
			additionalArtifacts: ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
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
			operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
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

	progress.start('RETAINED_CENSUS');
	const censusOutcome = await dependencies.observeCensus(
		{
			artifactSetId: artifactSet.id,
			budgets: request.budgets.observation,
			operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
			schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		},
		{ artifactSet, subject },
		{ onProgress: (event) => progress.forwardAdapter(event) }
	);
	const censusDiagnostics = projectDiagnostics(
		censusOutcome.diagnostics,
		'RETAINED_CENSUS',
		repositoryRoot,
		(path) => censusDiagnosticPath(path, repositoryRoot)
	);
	if (censusOutcome.outcome === 'unavailable') {
		progress.fail([], censusOutcome.diagnostics[0]?.code ?? 'RETAINED_CENSUS_UNAVAILABLE');
		return failure(
			'RETAINED_CENSUS_UNAVAILABLE',
			'RETAINED_CENSUS',
			censusFailureState(censusOutcome.diagnostics),
			[...subjectDiagnostics, ...artifactSetDiagnostics, ...censusDiagnostics],
			request,
			subject
		);
	}
	const censusObservation = censusOutcome.observation;
	const censusValidation = dependencies.validateObservation(censusObservation, subject, {
		maxIssues: Math.max(1, Math.min(1_000, request.budgets.observation.maxDiagnostics))
	});
	if (censusValidation.state !== 'VALID') {
		progress.fail(
			censusObservations(censusObservation, request.budgets.observation),
			'OBSERVATION_VALIDATION_FAILED'
		);
		return failure(
			'OBSERVATION_VALIDATION_FAILED',
			'RETAINED_CENSUS',
			'failed',
			[
				...subjectDiagnostics,
				...artifactSetDiagnostics,
				...censusDiagnostics,
				...censusValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, repositoryRoot),
						safeDiagnosticPath(issue.path, repositoryRoot),
						'VALIDATE',
						'ERROR',
						'RETAINED_CENSUS'
					)
				)
			],
			request,
			subject
		);
	}
	if (
		!censusOutcomeEnvelopeReconciles(
			censusOutcome.outcome,
			censusOutcome.diagnostics,
			censusObservation
		)
	) {
		progress.fail(
			censusObservations(censusObservation, request.budgets.observation),
			'EVIDENCE_IDENTITY_MISMATCH'
		);
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RETAINED_CENSUS',
			'failed',
			[
				...subjectDiagnostics,
				...artifactSetDiagnostics,
				...censusDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The retained observer outcome, diagnostics, baseline comparison, and execution health do not reconcile.'
				)
			],
			request,
			subject
		);
	}
	progress.complete(
		censusObservations(censusObservation, request.budgets.observation),
		censusOutcome.outcome === 'complete'
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
	if (
		censusObservation.subjectId !== subject.descriptor.subjectId ||
		censusObservation.artifactSet.id !== artifactSet.id ||
		canonicalSemanticJson(censusObservation.artifactSet) !== canonicalSemanticJson(artifactSet) ||
		canonicalSemanticJson(censusObservation.budgets) !==
			canonicalSemanticJson(request.budgets.observation) ||
		censusObservation.schemaVersion !== ARROW_COMMAND_CENSUS_OBSERVATION_SCHEMA_VERSION ||
		censusObservation.operationVersion !== ARROW_COMMAND_CENSUS_OPERATION_VERSION ||
		censusObservation.verifierAuthority !== ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY ||
		censusObservation.authorityTransfer !== ARROW_COMMAND_CENSUS_AUTHORITY_TRANSFER ||
		censusObservation.gateEffect !== ARROW_COMMAND_CENSUS_GATE_EFFECT ||
		censusObservation.oracleChange !== ARROW_COMMAND_CENSUS_ORACLE_CHANGE ||
		censusObservation.replacementEquivalence !== ARROW_COMMAND_CENSUS_REPLACEMENT_EQUIVALENCE ||
		censusObservation.integrationStrategy !== ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY ||
		censusObservation.fullJanCsaa007Conformance !==
			ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_007_CONFORMANCE ||
		censusObservation.fullJanCsaa008Conformance !==
			ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_008_CONFORMANCE ||
		censusObservation.method !== ARROW_COMMAND_CENSUS_METHOD ||
		censusObservation.canonicalProfile !== ARROW_COMMAND_CENSUS_CANONICAL_PROFILE ||
		canonicalSemanticJson(censusObservation.limitations) !==
			canonicalSemanticJson(ARROW_COMMAND_CENSUS_LIMITATIONS) ||
		censusObservation.executor.adapterId !== ARROW_COMMAND_CENSUS_ADAPTER_ID ||
		censusObservation.executor.adapterVersion !== ARROW_COMMAND_CENSUS_OPERATION_VERSION
	) {
		progress.fail([], 'EVIDENCE_IDENTITY_MISMATCH');
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				...subjectDiagnostics,
				...artifactSetDiagnostics,
				...censusDiagnostics,
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
	const stageOutcomes: ArrowCommandCensusReportStageOutcomes = {
		artifactSet: { diagnosticCodes: [], outcome: 'complete' },
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		retainedCensus: {
			diagnosticCodes: censusOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: censusOutcome.outcome
		},
		subject: {
			completeness: subjectOutcome.completeness,
			diagnosticCodes: subjectOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'resolved'
		}
	};
	const report: ArrowCommandCensusReportOutcome = {
		analysisAuthority: ARROW_COMMAND_CENSUS_REPORT_AUTHORITY,
		authorityTransfer: ARROW_COMMAND_CENSUS_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [
			...subjectDiagnostics,
			...artifactSetDiagnostics,
			...censusDiagnostics,
			...currentnessDiagnostics
		],
		gateEffect: ARROW_COMMAND_CENSUS_REPORT_GATE_EFFECT,
		operationVersion: ARROW_COMMAND_CENSUS_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				adapterId: ARROW_COMMAND_CENSUS_ADAPTER_ID,
				fullJanCsaa007Conformance: ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_007_CONFORMANCE,
				fullJanCsaa008Conformance: ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_008_CONFORMANCE,
				integrationStrategy: ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY,
				id: ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_ID,
				oracleChange: ARROW_COMMAND_CENSUS_ORACLE_CHANGE,
				registryStatus: ARROW_COMMAND_CENSUS_REPORT_REGISTRY_STATUS,
				replacementEquivalence: ARROW_COMMAND_CENSUS_REPLACEMENT_EQUIVALENCE,
				scope: ARROW_COMMAND_CENSUS_REPORT_SCOPE,
				status: ARROW_COMMAND_CENSUS_REPORT_CAPABILITY_STATUS,
				verifierAuthority: ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY
			},
			coverage: {
				...censusObservation.coverage,
				artifactBytes,
				artifacts: artifactSet.artifacts.length,
				health: 'PARTIAL',
				limitations: censusObservation.limitations.length,
				rawOutputBytes: censusObservation.rawOutput.bytes
			},
			currentness: {
				changedPaths: freshness.changedPaths,
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			evidence: {
				encoding: 'FULL_VALIDATED_RETAINED_ARROW_COMMAND_CENSUS_OBSERVATION',
				observation: censusObservation
			},
			facadeNonclaims: ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS,
			interpretation: 'VALIDATED_CAPTURE_AND_EXECUTOR_BOUND_RETAINED_CENSUS_EVIDENCE',
			schemaVersion: ARROW_COMMAND_CENSUS_REPORT_RESULT_SCHEMA_VERSION,
			selection: ARROW_COMMAND_CENSUS_REPORT_SELECTION,
			subjectSummary: {
				artifactBytes: subjectBytes,
				artifacts: subject.artifacts.length,
				completeness: subjectOutcome.completeness,
				projects: subject.projects.length
			}
		},
		schemaVersion: ARROW_COMMAND_CENSUS_REPORT_SCHEMA_VERSION,
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
						'The admitted arrow-command-census report exceeds maxResultBytes.'
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
export async function runArrowCommandCensusReportWithDependencies(
	requestValue: unknown,
	options: RunArrowCommandCensusReportOptions,
	dependencies: ArrowCommandCensusReportRuntimeDependencies
): Promise<ArrowCommandCensusReportOutcome> {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(await runInternal(requestValue, options, progress, dependencies));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic('INTERNAL_FAILURE', 'The arrow-command-census report failed closed.')
			])
		);
	}
}

export async function runArrowCommandCensusReport(
	requestValue: unknown,
	options: RunArrowCommandCensusReportOptions
): Promise<ArrowCommandCensusReportOutcome> {
	return runArrowCommandCensusReportWithDependencies(requestValue, options, DEFAULT_DEPENDENCIES);
}

export function arrowCommandCensusReportExitCode(
	outcome: ArrowCommandCensusReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
