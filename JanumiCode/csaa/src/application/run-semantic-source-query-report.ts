import { isAbsolute } from 'node:path';

import {
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	type ProjectContextReportRequest
} from '../contracts/project-context-report.js';
import {
	SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY,
	SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER,
	SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY,
	SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY_STATUS,
	SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT,
	SEMANTIC_SOURCE_QUERY_REPORT_MAX_EXECUTION_ID_CHARACTERS,
	SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS,
	SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_RESULT_SCHEMA_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_SAFETY_CEILINGS,
	SEMANTIC_SOURCE_QUERY_REPORT_SCHEMA_VERSION,
	type SemanticSourceQueryReportBinding,
	type SemanticSourceQueryReportBudgets,
	type SemanticSourceQueryReportDefinition,
	type SemanticSourceQueryReportDiagnostic,
	type SemanticSourceQueryReportFailureState,
	type SemanticSourceQueryReportOutcome,
	type SemanticSourceQueryReportPartitions,
	type SemanticSourceQueryReportReference,
	type SemanticSourceQueryReportRequest,
	type SemanticSourceQueryReportResultOccurrence,
	type SemanticSourceQueryReportSourceReference,
	type SemanticSourceQueryReportStage,
	type SemanticSourceQueryReportStageOutcomes
} from '../contracts/semantic-source-query-report.js';
import {
	SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
	SEMANTIC_SOURCE_QUERY_FIELDS,
	SEMANTIC_SOURCE_QUERY_NONCLAIMS,
	SEMANTIC_SOURCE_QUERY_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_OPERATORS,
	SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS,
	type SemanticSourceQueryBudgets,
	type SemanticSourceQueryEvaluation,
	type SemanticSourceQueryEvaluationOutcome,
	type SemanticSourceQueryExpression,
	type SemanticSourceQueryRecordResult
} from '../contracts/semantic-source-query.js';
import {
	SEMANTIC_BUDGET_KEYS,
	type SemanticEpistemicState,
	type SemanticSourceRecord,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type {
	FrozenSubject,
	SubjectBudgets,
	SubjectCompleteness,
	SubjectDiagnostic,
	SubjectFilters
} from '../contracts/subject.js';
import { evaluateSemanticSourceQuery } from '../query/evaluate-semantic-source-query.js';
import { hasValidatedStaticSemanticSnapshotCapability } from '../semantic/build-static-semantic-snapshot.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonPrefixedSha256,
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import { isFrozenSubjectCapability } from '../subject/frozen-store.js';
import { subjectFilterPolicyId } from '../subject/policy.js';
import {
	assertCanonicalRelativePath,
	canonicalPathKey,
	repositoryRelativePath,
	resolveRepositoryRoot
} from '../subject/paths.js';
import {
	admitProjectContextReportRequest,
	captureSemanticReportPipeline,
	type CaptureProjectContextReportPipelineOptions,
	type SemanticReportPipelineOutcome
} from './run-project-context-report.js';

const REQUEST_KEYS = [
	'budgets',
	'executionId',
	'expression',
	'operationVersion',
	'schemaVersion',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = [
	'maxDiagnostics',
	'maxResultBytes',
	'maxResultRecords',
	'query',
	'semantic',
	'subject'
] as const;
const QUERY_BUDGET_KEYS = [
	'maxDepth',
	'maxEvaluations',
	'maxFanout',
	'maxNodes',
	'maxPopulation',
	'maxTraceNodes'
] as const satisfies readonly (keyof SemanticSourceQueryBudgets)[];
const SUBJECT_BUDGET_KEYS = [
	'maxBytes',
	'maxConfigDepth',
	'maxDiagnostics',
	'maxDurationMs',
	'maxFiles',
	'maxProjects'
] as const satisfies readonly (keyof SubjectBudgets)[];
const BASE_SEMANTIC_CAPABILITIES = Object.freeze(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const);
const MAX_DIAGNOSTIC_PATH_CHARACTERS = 10_000;

interface SemanticSourceQueryReportAdmission {
	readonly budgets: SemanticSourceQueryReportBudgets;
	readonly executionId: string;
	readonly expression: unknown;
	readonly predecessorRequest: ProjectContextReportRequest;
}

export const SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-semantic-source-query-report-progress/0.2.0' as const;
export const SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp005Dwp006OrG5Completion: 'NOT_CLAIMED',
	facadeNonclaims: SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type SemanticSourceQueryReportProgressPhase =
	| 'REQUEST_BIND'
	| 'SEMANTIC_CAPTURE'
	| 'QUERY_VALIDATE'
	| 'QUERY_EVALUATE'
	| 'CURRENTNESS'
	| 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	CURRENTNESS: 'CURRENTNESS',
	QUERY_EVALUATE: 'QUERY_EVALUATE',
	QUERY_VALIDATE: 'QUERY_VALIDATE',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT',
	SEMANTIC_CAPTURE: 'SEMANTIC_CAPTURE'
} as const satisfies Readonly<
	Record<SemanticSourceQueryReportProgressPhase, SemanticSourceQueryReportStage>
>);

export type SemanticSourceQueryReportProgressMetric =
	| 'AST_MAX_DEPTH'
	| 'AST_MAX_FANOUT'
	| 'AST_NODES'
	| 'CHARGED_EVALUATIONS'
	| 'CONFLICT_RECORDS'
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'NOT_APPLICABLE_RECORDS'
	| 'RESULT_BYTES'
	| 'SEMANTIC_SOURCES'
	| 'SUPPORTED_MATCH_RECORDS'
	| 'SUPPORTED_NONMATCH_RECORDS'
	| 'TRACE_NODES'
	| 'UNEVALUATED_RECORDS'
	| 'UNKNOWN_RECORDS';

export interface SemanticSourceQueryReportProgressObservation {
	readonly limit: number | null;
	readonly metric: SemanticSourceQueryReportProgressMetric;
	readonly unit: 'BYTES' | 'COUNT';
	readonly value: number;
}

export interface SemanticSourceQueryReportProgressEvent {
	readonly deliverySemantics: 'DEFERRED_UNTIL_TERMINAL_EVIDENCE';
	readonly detailCode: string | null;
	readonly kind: 'REPORT_STAGE';
	readonly nonclaims: typeof SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly SemanticSourceQueryReportProgressObservation[];
	readonly operationVersion: typeof SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION;
	readonly phase: SemanticSourceQueryReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_SEMANTIC_SOURCE_QUERY_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: SemanticSourceQueryReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED';
}

export interface RunSemanticSourceQueryReportOptions {
	/** Trusted same-process artifacts that must participate in the same frozen subject identity. */
	readonly additionalArtifacts?: readonly string[];
	readonly onProgress?: (event: SemanticSourceQueryReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
	/** Trusted exact filter policy that must participate in the same frozen subject identity. */
	readonly subjectFilters?: SubjectFilters;
}

interface ProgressRecorder {
	complete(
		observations?: readonly SemanticSourceQueryReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly SemanticSourceQueryReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: SemanticSourceQueryReportOutcome): SemanticSourceQueryReportOutcome;
	start(
		phase: SemanticSourceQueryReportProgressPhase,
		observations?: readonly SemanticSourceQueryReportProgressObservation[]
	): void;
}

function progressObservation(
	metric: SemanticSourceQueryReportProgressMetric,
	value: number,
	limit: number | null,
	unit: SemanticSourceQueryReportProgressObservation['unit'] = 'COUNT'
): SemanticSourceQueryReportProgressObservation {
	return Object.freeze({
		limit,
		metric,
		unit,
		value: Number.isSafeInteger(value) && value >= 0 ? value : 0
	});
}

function progressSink(
	options: RunSemanticSourceQueryReportOptions
): ((event: SemanticSourceQueryReportProgressEvent) => unknown) | undefined {
	try {
		if (options === null || typeof options !== 'object' || isProxyValue(options)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: SemanticSourceQueryReportProgressEvent) => unknown)
			: undefined;
	} catch {
		return undefined;
	}
}

function createProgressRecorder(options: RunSemanticSourceQueryReportOptions): ProgressRecorder {
	const sink = progressSink(options);
	const events: SemanticSourceQueryReportProgressEvent[] = [];
	let active: SemanticSourceQueryReportProgressPhase | null = null;
	let sequence = 0;
	const record = (
		phase: SemanticSourceQueryReportProgressPhase,
		state: SemanticSourceQueryReportProgressEvent['state'],
		observations: readonly SemanticSourceQueryReportProgressObservation[],
		detailCode: string | null
	): void => {
		events.push(
			Object.freeze({
				deliverySemantics: 'DEFERRED_UNTIL_TERMINAL_EVIDENCE' as const,
				detailCode,
				kind: 'REPORT_STAGE' as const,
				nonclaims: SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS,
				observations: Object.freeze([...observations]),
				operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
				phase,
				protocolRole: 'PRELIMINARY_SEMANTIC_SOURCE_QUERY_REPORT_TELEMETRY' as const,
				reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
				schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_SCHEMA_VERSION,
				sequence: ++sequence,
				stage: PROGRESS_PHASE_STAGE[phase],
				state
			})
		);
	};
	const close = (
		state: 'COMPLETED' | 'FAILED',
		observations: readonly SemanticSourceQueryReportProgressObservation[],
		detailCode: string | null
	): void => {
		if (active === null) return;
		const phase = active;
		active = null;
		record(phase, state, observations, detailCode);
	};
	return {
		complete(observations = [], detailCode = null): void {
			close('COMPLETED', observations, detailCode);
		},
		fail(observations = [], detailCode = null): void {
			close('FAILED', observations, detailCode);
		},
		finish(outcome): SemanticSourceQueryReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			if (sink !== undefined)
				for (const event of events)
					try {
						const sinkResult = sink(event);
						if (sinkResult !== undefined) void Promise.resolve(sinkResult).catch(() => undefined);
					} catch {
						// Deferred best-effort telemetry cannot alter terminal evidence.
					}
			return outcome;
		},
		start(phase, observations = []): void {
			if (active !== null) close('FAILED', [], 'STAGE_INTERRUPTED');
			active = phase;
			record(phase, 'STARTED', observations, null);
		}
	};
}

class ReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly path: string,
		readonly state: SemanticSourceQueryReportFailureState = 'incompatible'
	) {
		super(message);
	}
}

class RepositoryRootUnavailableError extends Error {}

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

function materializeAdmission(value: unknown): SemanticSourceQueryReportAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	if (
		typeof record.executionId !== 'string' ||
		record.executionId.length === 0 ||
		record.executionId.length > SEMANTIC_SOURCE_QUERY_REPORT_MAX_EXECUTION_ID_CHARACTERS ||
		!isUnicodeScalarString(record.executionId)
	)
		throw new ReportRequestError(
			'REQUEST_EXECUTION_ID_INVALID',
			`$.executionId must be nonempty Unicode scalar text no longer than ${SEMANTIC_SOURCE_QUERY_REPORT_MAX_EXECUTION_ID_CHARACTERS} UTF-16 code units.`,
			'$.executionId'
		);
	const budgetRecord = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const query = materializeBudgetRecord(
		budgetRecord.query,
		QUERY_BUDGET_KEYS,
		SEMANTIC_SOURCE_QUERY_SAFETY_CEILINGS,
		'$.budgets.query'
	) as unknown as SemanticSourceQueryBudgets;
	const semantic = materializeBudgetRecord(
		budgetRecord.semantic,
		SEMANTIC_BUDGET_KEYS,
		SEMANTIC_SOURCE_QUERY_REPORT_SAFETY_CEILINGS.semantic,
		'$.budgets.semantic'
	);
	const subject = materializeBudgetRecord(
		budgetRecord.subject,
		SUBJECT_BUDGET_KEYS,
		SEMANTIC_SOURCE_QUERY_REPORT_SAFETY_CEILINGS.subject,
		'$.budgets.subject'
	) as unknown as SubjectBudgets;
	const maxDiagnostics = boundedBudget(
		budgetRecord.maxDiagnostics,
		SEMANTIC_SOURCE_QUERY_REPORT_SAFETY_CEILINGS.maxDiagnostics,
		'$.budgets.maxDiagnostics'
	);
	const maxResultBytes = boundedBudget(
		budgetRecord.maxResultBytes,
		SEMANTIC_SOURCE_QUERY_REPORT_SAFETY_CEILINGS.maxResultBytes,
		'$.budgets.maxResultBytes'
	);
	const maxResultRecords = boundedBudget(
		budgetRecord.maxResultRecords,
		SEMANTIC_SOURCE_QUERY_REPORT_SAFETY_CEILINGS.maxResultRecords,
		'$.budgets.maxResultRecords'
	);
	const predecessorAdmission = admitProjectContextReportRequest({
		budgets: {
			maxResultBytes: Math.min(
				maxResultBytes,
				PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.maxResultBytes
			),
			projectContext: PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.projectContext,
			semantic,
			subject
		},
		operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
		schemaVersion: PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: record.subjectProjectConfigPaths
	});
	if (predecessorAdmission.outcome === 'rejected')
		throw new ReportRequestError(
			predecessorAdmission.code,
			predecessorAdmission.message,
			predecessorAdmission.path,
			predecessorAdmission.state
		);
	return Object.freeze({
		budgets: Object.freeze({
			maxDiagnostics,
			maxResultBytes,
			maxResultRecords,
			query,
			semantic: predecessorAdmission.request.budgets.semantic,
			subject: predecessorAdmission.request.budgets.subject
		}),
		executionId: record.executionId,
		expression: record.expression,
		predecessorRequest: predecessorAdmission.request
	});
}

function materializedRequest(
	admission: SemanticSourceQueryReportAdmission,
	expression: SemanticSourceQueryExpression
): SemanticSourceQueryReportRequest {
	return Object.freeze({
		budgets: admission.budgets,
		executionId: admission.executionId,
		expression,
		operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
		schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: admission.predecessorRequest.subjectProjectConfigPaths
	});
}

export type SemanticSourceQueryReportRequestAdmission =
	| { readonly outcome: 'admitted'; readonly request: SemanticSourceQueryReportRequest }
	| {
			readonly code: string;
			readonly message: string;
			readonly outcome: 'rejected';
			readonly path: string;
			readonly state: SemanticSourceQueryReportFailureState;
	  };

/** @internal Hostile-safe request/AST admission seam; intentionally not package-root exported. */
export function admitSemanticSourceQueryReportRequest(
	value: unknown
): SemanticSourceQueryReportRequestAdmission {
	try {
		const admission = materializeAdmission(value);
		const preflight = evaluateSemanticSourceQuery({
			budgets: admission.budgets.query,
			expression: admission.expression as SemanticSourceQueryExpression,
			mode: SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
			records: []
		});
		if (preflight.state === 'REFUSED')
			return Object.freeze({
				code: preflight.diagnostic.code,
				message: preflight.diagnostic.message,
				outcome: 'rejected' as const,
				path: '$.expression',
				state: preflight.diagnostic.code.includes('BUDGET')
					? ('resource-refused' as const)
					: ('incompatible' as const)
			});
		const expression = detached(admission.expression as SemanticSourceQueryExpression);
		return Object.freeze({
			outcome: 'admitted' as const,
			request: detached(materializedRequest(admission, expression))
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
	source: SemanticSourceQueryReportDiagnostic['source'] = 'REPORT',
	severity: SemanticSourceQueryReportDiagnostic['severity'] = null
): SemanticSourceQueryReportDiagnostic {
	return { code, message, path, phase, severity, source };
}

function failure(
	code: string,
	stage: SemanticSourceQueryReportStage,
	state: SemanticSourceQueryReportFailureState,
	diagnostics: readonly SemanticSourceQueryReportDiagnostic[],
	request?: SemanticSourceQueryReportRequest,
	subject?: FrozenSubject['descriptor']
): SemanticSourceQueryReportOutcome {
	return {
		analysisAuthority: SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY,
		authorityTransfer: SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS,
		gateEffect: SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT,
		operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		...(request === undefined ? {} : { request }),
		schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

function repositoryRootOption(options: RunSemanticSourceQueryReportOptions): string {
	if (options === null || typeof options !== 'object' || isProxyValue(options))
		throw new TypeError('Report options must be a trusted data object.');
	const descriptor = Reflect.getOwnPropertyDescriptor(options, 'repositoryRoot');
	if (
		descriptor === undefined ||
		!('value' in descriptor) ||
		typeof descriptor.value !== 'string' ||
		!isAbsolute(descriptor.value)
	)
		throw new TypeError('repositoryRoot must be an absolute data property.');
	try {
		return resolveRepositoryRoot(descriptor.value);
	} catch {
		throw new RepositoryRootUnavailableError();
	}
}

function deepFreezeDetached<Value>(value: Value, seen = new WeakSet<object>()): Value {
	if (value === null || typeof value !== 'object' || seen.has(value)) return value;
	seen.add(value);
	for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value)))
		if ('value' in descriptor) deepFreezeDetached(descriptor.value, seen);
	return Object.freeze(value);
}

function detached<Value>(value: Value): Value {
	return deepFreezeDetached(JSON.parse(canonicalSemanticJson(value)) as Value);
}

function escapedRegularExpression(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function redactRoot(message: string, repositoryRoot: string): string {
	let redacted = message;
	for (const candidate of new Set([repositoryRoot, repositoryRoot.replaceAll('\\', '/')]))
		if (candidate.length > 0)
			redacted = redacted.replace(
				new RegExp(escapedRegularExpression(candidate), 'giu'),
				'<repository-root>'
			);
	return redacted;
}

function safeDiagnosticPath(path: string | null, repositoryRoot: string): string | null {
	if (path === null || path.length > MAX_DIAGNOSTIC_PATH_CHARACTERS || !isUnicodeScalarString(path))
		return null;
	if (path.startsWith('$')) return path;
	try {
		return isAbsolute(path)
			? repositoryRelativePath(repositoryRoot, path)
			: assertCanonicalRelativePath(path);
	} catch {
		return null;
	}
}

function subjectCompleteness(subject: FrozenSubject): SubjectCompleteness {
	if (subject.projects.some((project) => project.status === 'PARTIAL')) return 'PARTIAL';
	if (subject.diagnostics.some((diagnostic) => diagnostic.severity !== 'INFO')) return 'PARTIAL';
	return 'COMPLETE';
}

function exactCaptureReconciles(
	capture: StableSemanticCapture,
	admission: SemanticSourceQueryReportAdmission,
	repositoryRoot: string,
	additionalArtifacts: readonly string[],
	subjectFilters: SubjectFilters
): boolean {
	try {
		const subject = capture.frozenSubject;
		const snapshot = capture.semanticSnapshot;
		const subjectScope = subject.request.scope;
		if (subjectScope.kind !== 'EXPLICIT_PROJECTS') return false;
		const actualAdditionalArtifacts = (subjectScope.additionalArtifacts ?? [])
			.map((path) => canonicalPathKey(assertCanonicalRelativePath(path)))
			.sort();
		const expectedAdditionalArtifacts = additionalArtifacts
			.map((path) => canonicalPathKey(assertCanonicalRelativePath(path)))
			.sort();
		const expectedFilterRequest = { ...subject.request, filters: subjectFilters };
		return (
			capture.outcome === 'semantic-captured' &&
			capture.repositoryRoot === repositoryRoot &&
			isFrozenSubjectCapability(subject) &&
			hasValidatedStaticSemanticSnapshotCapability(snapshot, subject, admission.budgets.semantic) &&
			canonicalSemanticJson(capture.request) ===
				canonicalSemanticJson(admission.predecessorRequest) &&
			canonicalSemanticJson(snapshot.budgets) ===
				canonicalSemanticJson(admission.budgets.semantic) &&
			canonicalSemanticJson(snapshot.requestedCapabilities) ===
				canonicalSemanticJson(BASE_SEMANTIC_CAPABILITIES) &&
			!snapshot.expectedEmpty &&
			snapshot.assignabilityRequests.length === 0 &&
			canonicalSemanticJson(subject.request.budgets) ===
				canonicalSemanticJson(admission.budgets.subject) &&
			canonicalSemanticJson(subjectScope.projects) ===
				canonicalSemanticJson(admission.predecessorRequest.subjectProjectConfigPaths) &&
			actualAdditionalArtifacts.length === new Set(actualAdditionalArtifacts).size &&
			expectedAdditionalArtifacts.length === new Set(expectedAdditionalArtifacts).size &&
			canonicalSemanticJson(actualAdditionalArtifacts) ===
				canonicalSemanticJson(expectedAdditionalArtifacts) &&
			subjectFilterPolicyId(subject.request) === subjectFilterPolicyId(expectedFilterRequest) &&
			subject.descriptor.subjectId === snapshot.subjectId
		);
	} catch {
		return false;
	}
}

function hashIdentity(prefix: string, value: unknown): string {
	return `${prefix}-${canonicalSemanticJsonPrefixedSha256(`jan-csaa:${prefix}:0.1.0\n`, value)}`;
}

function safeSourceReferences(
	snapshot: StaticSemanticSnapshot
): readonly SemanticSourceQueryReportSourceReference[] {
	const projectPaths = new Map(
		snapshot.projects.map((project) => [project.id, project.configPath])
	);
	return snapshot.sources.map((source) => {
		const projectConfigPath = projectPaths.get(source.projectId);
		if (projectConfigPath === undefined)
			throw new Error('A validated semantic source lacks its project configuration record.');
		return {
			analysisDisposition: source.analysisDisposition,
			artifactClass: source.artifactClass,
			declarationFile: source.declarationFile,
			id: source.id,
			languageVariant: source.languageVariant,
			logicalPath: source.logicalPath,
			moduleKind: source.moduleKind,
			origin: source.origin,
			programId: source.programId,
			projectConfigPath,
			projectId: source.projectId,
			provenanceId: source.provenanceId,
			rootFile: source.rootFile,
			scriptKindName: source.scriptKindName
		};
	});
}

function partitionEvaluation(
	recordResults: readonly SemanticSourceQueryRecordResult[]
): SemanticSourceQueryReportPartitions {
	const partitions: {
		conflict: SemanticSourceRecord['id'][];
		notApplicable: SemanticSourceRecord['id'][];
		supportedMatches: SemanticSourceRecord['id'][];
		supportedNonmatches: SemanticSourceRecord['id'][];
		unevaluated: SemanticSourceRecord['id'][];
		unknown: SemanticSourceRecord['id'][];
	} = {
		conflict: [],
		notApplicable: [],
		supportedMatches: [],
		supportedNonmatches: [],
		unevaluated: [],
		unknown: []
	};
	for (const result of recordResults) {
		if (result.disposition === 'not-applicable') {
			partitions.notApplicable.push(result.sourceId);
			continue;
		}
		switch (result.truth) {
			case 'T':
				partitions.supportedMatches.push(result.sourceId);
				break;
			case 'F':
				partitions.supportedNonmatches.push(result.sourceId);
				break;
			case 'U':
				partitions.unknown.push(result.sourceId);
				break;
			case 'C':
				partitions.conflict.push(result.sourceId);
				break;
		}
	}
	return partitions;
}

function partitionCounts(partitions: SemanticSourceQueryReportPartitions) {
	return {
		conflict: partitions.conflict.length,
		notApplicable: partitions.notApplicable.length,
		supportedMatches: partitions.supportedMatches.length,
		supportedNonmatches: partitions.supportedNonmatches.length,
		unevaluated: partitions.unevaluated.length,
		unknown: partitions.unknown.length
	};
}

const DYNAMIC_EVIDENCE_RATIONALE =
	'This implementation-local operation evaluates captured static source metadata only; dynamic evidence is outside its semantic owner and population.';

function dynamicEvidenceEpistemic(): SemanticEpistemicState {
	return {
		capabilityCoverage: 'excluded',
		conflict: 'unopposed',
		executionHealth: 'not-run',
		freshness: 'unknown',
		inference: 'not-applicable',
		rationale: DYNAMIC_EVIDENCE_RATIONALE,
		supportBasis: {
			kind: 'not-applicable',
			method: null,
			rationale: DYNAMIC_EVIDENCE_RATIONALE,
			sourceRefs: []
		},
		unresolvedRegions: []
	};
}

function derivedReportDiagnostics(
	snapshot: StaticSemanticSnapshot
): readonly SemanticSourceQueryReportDiagnostic[] {
	const diagnostics: SemanticSourceQueryReportDiagnostic[] = [
		reportDiagnostic(
			'GLOBAL_POPULATION_CLOSURE_OPEN',
			'The result is closed only over retained validated SEMANTIC_SOURCE records; it does not support a whole-repository or runtime absence conclusion.',
			null,
			'INTERPRET',
			'REPORT',
			'WARNING'
		),
		reportDiagnostic(
			'DYNAMIC_EVIDENCE_NOT_APPLICABLE',
			DYNAMIC_EVIDENCE_RATIONALE,
			null,
			'INTERPRET',
			'REPORT',
			'INFO'
		)
	];
	if (snapshot.health === 'PARTIAL')
		diagnostics.push(
			reportDiagnostic(
				'SEMANTIC_CAPTURE_PARTIAL',
				'The validated static semantic snapshot is PARTIAL; zero supported matches cannot establish absence outside its retained records.',
				null,
				'CAPTURE',
				'SEMANTIC_CAPTURE',
				'WARNING'
			)
		);
	return diagnostics;
}

function queryDefinition(
	request: SemanticSourceQueryReportRequest,
	normalizedExpression: SemanticSourceQueryEvaluation['expression']
): SemanticSourceQueryReportDefinition {
	const preimage = {
		access: 'CAPTURED_STATIC_SEMANTIC_SOURCE_METADATA_ONLY' as const,
		budgets: request.budgets.query,
		evaluationMode: SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
		explanationPolicy: 'NODE_TOTAL_PREORDER_TRACE_PER_RETAINED_SOURCE' as const,
		expression: normalizedExpression,
		operationVersion: SEMANTIC_SOURCE_QUERY_OPERATION_VERSION,
		ordering: 'STATIC_SEMANTIC_SNAPSHOT_SOURCE_ORDER' as const,
		population: 'SEMANTIC_SOURCE' as const,
		prerequisiteCapabilities: BASE_SEMANTIC_CAPABILITIES,
		purpose: 'BOUNDED_STATIC_SOURCE_METADATA_SCALAR_FILTER' as const,
		registeredFields: SEMANTIC_SOURCE_QUERY_FIELDS,
		registeredOperators: SEMANTIC_SOURCE_QUERY_OPERATORS,
		version: '0.2.0' as const
	};
	return {
		...preimage,
		id: hashIdentity('semantic-source-query-definition', preimage)
	};
}

function queryReference(
	request: SemanticSourceQueryReportRequest,
	definition: SemanticSourceQueryReportDefinition
): SemanticSourceQueryReportReference {
	const preimage = {
		captureBudgets: {
			semantic: request.budgets.semantic,
			subject: request.budgets.subject
		},
		definitionId: definition.id,
		subjectProjectConfigPaths: request.subjectProjectConfigPaths
	};
	return { ...preimage, id: hashIdentity('semantic-source-query-reference', preimage) };
}

function queryBinding(
	definition: SemanticSourceQueryReportDefinition,
	reference: SemanticSourceQueryReportReference,
	snapshot: StaticSemanticSnapshot
): SemanticSourceQueryReportBinding {
	const preimage = {
		definitionId: definition.id,
		referenceId: reference.id,
		retainedSourceRecords: snapshot.sources.length,
		semanticHealth: snapshot.health,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	};
	return { ...preimage, id: hashIdentity('semantic-source-query-binding', preimage) };
}

function queryResultOccurrence(
	request: SemanticSourceQueryReportRequest,
	binding: SemanticSourceQueryReportBinding,
	partitions: SemanticSourceQueryReportPartitions,
	evaluation: SemanticSourceQueryEvaluation
): SemanticSourceQueryReportResultOccurrence {
	const preimage = {
		bindingId: binding.id,
		executionId: request.executionId,
		partitionCounts: partitionCounts(partitions),
		projections: evaluation.recordResults.map((result) =>
			result.disposition === 'not-applicable'
				? {
						disposition: result.disposition,
						reasonCode: result.applicability.reasonCode,
						sourceId: result.sourceId
					}
				: {
						disposition: result.disposition,
						evidencePair: result.evidencePair,
						sourceId: result.sourceId,
						truth: result.truth
					}
		)
	};
	return {
		bindingId: preimage.bindingId,
		executionId: preimage.executionId,
		id: hashIdentity('semantic-source-query-result', preimage),
		partitionCounts: preimage.partitionCounts
	};
}

type Awaitable<Value> = PromiseLike<Value> | Value;

export interface SemanticSourceQueryReportRuntimeDependencies {
	readonly captureSemantic: (
		requestValue: unknown,
		options: CaptureProjectContextReportPipelineOptions
	) => Awaitable<SemanticReportPipelineOutcome>;
	readonly evaluateQuery: typeof evaluateSemanticSourceQuery;
	readonly verifySubject: typeof verifyFrozenSubject;
}

interface StableSemanticCapture {
	readonly frozenSubject: FrozenSubject;
	readonly outcome: 'semantic-captured';
	readonly repositoryRoot: string;
	readonly request: ProjectContextReportRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

function stableRuntimeDependencies(value: unknown): SemanticSourceQueryReportRuntimeDependencies {
	const record = exactDataRecord(
		value,
		['captureSemantic', 'evaluateQuery', 'verifySubject'],
		'$dependencies'
	);
	const captureSemantic = record.captureSemantic;
	const evaluateQuery = record.evaluateQuery;
	const verifySubject = record.verifySubject;
	if (
		typeof captureSemantic !== 'function' ||
		typeof evaluateQuery !== 'function' ||
		typeof verifySubject !== 'function' ||
		isProxyValue(captureSemantic) ||
		isProxyValue(evaluateQuery) ||
		isProxyValue(verifySubject)
	)
		throw new TypeError('Runtime dependencies must be exact non-proxy functions.');
	return Object.freeze({
		captureSemantic:
			captureSemantic as SemanticSourceQueryReportRuntimeDependencies['captureSemantic'],
		evaluateQuery: evaluateQuery as SemanticSourceQueryReportRuntimeDependencies['evaluateQuery'],
		verifySubject: verifySubject as SemanticSourceQueryReportRuntimeDependencies['verifySubject']
	});
}

function stableSemanticCapture(value: unknown): StableSemanticCapture | null {
	try {
		const record = exactDataRecord(
			value,
			[
				'diagnostics',
				'frozenSubject',
				'outcome',
				'predecessorStageOutcomes',
				'repositoryRoot',
				'request',
				'semanticSnapshot'
			],
			'$capture'
		);
		if (record.outcome !== 'semantic-captured' || typeof record.repositoryRoot !== 'string')
			return null;
		return Object.freeze({
			frozenSubject: record.frozenSubject as FrozenSubject,
			outcome: record.outcome,
			repositoryRoot: record.repositoryRoot,
			request: record.request as ProjectContextReportRequest,
			semanticSnapshot: record.semanticSnapshot as StaticSemanticSnapshot
		});
	} catch {
		return null;
	}
}

const DEFAULT_DEPENDENCIES: SemanticSourceQueryReportRuntimeDependencies = Object.freeze({
	captureSemantic: captureSemanticReportPipeline,
	evaluateQuery: evaluateSemanticSourceQuery,
	verifySubject: verifyFrozenSubject
});

function evaluationReconciles(
	evaluation: SemanticSourceQueryEvaluation,
	snapshot: StaticSemanticSnapshot
): boolean {
	try {
		if (
			evaluation.recordResults.length !== snapshot.sources.length ||
			evaluation.coverage.populationRecords !== snapshot.sources.length ||
			!evaluation.coverage.partitionsReconcile ||
			evaluation.mode !== SEMANTIC_SOURCE_QUERY_EXECUTION_MODE
		)
			return false;
		const normalizedNodeIds = evaluation.expression.nodes.map((node) => node.nodeId);
		let traceNodes = 0;
		for (let index = 0; index < evaluation.recordResults.length; index += 1) {
			const result = evaluation.recordResults[index]!;
			if (result.sourceId !== snapshot.sources[index]!.id) return false;
			if (
				result.trace.length !== normalizedNodeIds.length ||
				canonicalSemanticJson(result.trace.map((node) => node.nodeId)) !==
					canonicalSemanticJson(normalizedNodeIds)
			)
				return false;
			traceNodes += result.trace.length;
		}
		const partitions = partitionEvaluation(evaluation.recordResults);
		const counts = partitionCounts(partitions);
		return (
			traceNodes === evaluation.coverage.traceNodes &&
			counts.supportedMatches === evaluation.coverage.counts.supportedTrue &&
			counts.supportedNonmatches === evaluation.coverage.counts.supportedFalse &&
			counts.unknown === evaluation.coverage.counts.unknown &&
			counts.conflict === evaluation.coverage.counts.conflicting &&
			counts.notApplicable === evaluation.coverage.counts.notApplicable &&
			counts.unevaluated === 0
		);
	} catch {
		return false;
	}
}

function refusedState(
	outcome: Extract<SemanticSourceQueryEvaluationOutcome, { state: 'REFUSED' }>
) {
	return outcome.diagnostic.code.includes('BUDGET')
		? ('resource-refused' as const)
		: ('incompatible' as const);
}

async function runInternal(
	requestValue: unknown,
	options: RunSemanticSourceQueryReportOptions,
	progress: ProgressRecorder,
	dependencies: SemanticSourceQueryReportRuntimeDependencies
): Promise<SemanticSourceQueryReportOutcome> {
	progress.start('REQUEST_BIND');
	let admission: SemanticSourceQueryReportAdmission;
	try {
		admission = materializeAdmission(requestValue);
	} catch (error) {
		if (error instanceof ReportRequestError) {
			progress.fail([], error.code);
			return failure(error.code, 'REQUEST', error.state, [
				reportDiagnostic(error.code, error.message, error.path, 'REQUEST', 'REPORT', 'ERROR')
			]);
		}
		progress.fail([], 'REQUEST_INVALID');
		return failure('REQUEST_INVALID', 'REQUEST', 'incompatible', [
			reportDiagnostic(
				'REQUEST_INVALID',
				'The report request could not be inspected safely.',
				'$',
				'REQUEST',
				'REPORT',
				'ERROR'
			)
		]);
	}
	let repositoryRoot: string;
	try {
		repositoryRoot = repositoryRootOption(options);
	} catch (error) {
		progress.fail(
			[],
			error instanceof RepositoryRootUnavailableError
				? 'REPOSITORY_ROOT_UNAVAILABLE'
				: 'REQUEST_INVALID'
		);
		return failure(
			error instanceof RepositoryRootUnavailableError
				? 'REPOSITORY_ROOT_UNAVAILABLE'
				: 'REQUEST_INVALID',
			'REQUEST',
			error instanceof RepositoryRootUnavailableError ? 'failed' : 'incompatible',
			[
				reportDiagnostic(
					error instanceof RepositoryRootUnavailableError
						? 'REPOSITORY_ROOT_UNAVAILABLE'
						: 'REQUEST_INVALID',
					'The fixed repository root or report options are unavailable.',
					'$options',
					'REQUEST',
					'REPORT',
					'ERROR'
				)
			]
		);
	}
	progress.complete([], 'REQUEST_SHAPE_ADMITTED');

	// The trusted core performs a whole-AST prepass against an empty population before any subject
	// or compiler capture is started. Invalid descendants, proxies, getters, cycles, and AST budget
	// failures therefore fail before an expensive or state-observing predecessor operation.
	progress.start('QUERY_VALIDATE');
	let preflight: SemanticSourceQueryEvaluationOutcome;
	try {
		preflight = evaluateSemanticSourceQuery({
			budgets: admission.budgets.query,
			expression: admission.expression as SemanticSourceQueryExpression,
			mode: SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
			records: []
		});
	} catch {
		progress.fail([], 'QUERY_VALIDATION_FAILED');
		return failure('QUERY_VALIDATION_FAILED', 'QUERY_VALIDATE', 'incompatible', [
			reportDiagnostic(
				'QUERY_VALIDATION_FAILED',
				'The query expression could not be validated safely.',
				'$.expression',
				'VALIDATE_AST',
				'QUERY_ENGINE',
				'ERROR'
			)
		]);
	}
	if (preflight.state === 'REFUSED') {
		progress.fail([], preflight.diagnostic.code);
		return failure(preflight.diagnostic.code, 'QUERY_VALIDATE', refusedState(preflight), [
			reportDiagnostic(
				preflight.diagnostic.code,
				preflight.diagnostic.message,
				'$.expression',
				preflight.diagnostic.phase,
				'QUERY_ENGINE',
				'ERROR'
			)
		]);
	}
	let request: SemanticSourceQueryReportRequest;
	try {
		request = detached(
			materializedRequest(
				admission,
				detached(admission.expression as SemanticSourceQueryExpression)
			)
		);
	} catch {
		progress.fail([], 'QUERY_VALIDATION_FAILED');
		return failure('QUERY_VALIDATION_FAILED', 'QUERY_VALIDATE', 'incompatible', [
			reportDiagnostic(
				'QUERY_VALIDATION_FAILED',
				'The validated query expression could not be detached safely.',
				'$.expression',
				'VALIDATE_AST',
				'QUERY_ENGINE',
				'ERROR'
			)
		]);
	}
	progress.complete(
		[
			progressObservation(
				'AST_NODES',
				preflight.evaluation.expression.nodeCount,
				request.budgets.query.maxNodes
			),
			progressObservation(
				'AST_MAX_DEPTH',
				preflight.evaluation.expression.maxObservedDepth,
				request.budgets.query.maxDepth
			),
			progressObservation(
				'AST_MAX_FANOUT',
				preflight.evaluation.expression.maxObservedFanout,
				request.budgets.query.maxFanout
			)
		],
		'WHOLE_AST_VALIDATED'
	);

	progress.start('SEMANTIC_CAPTURE');
	let predecessorOutcome: SemanticReportPipelineOutcome;
	let additionalArtifacts: readonly string[];
	let subjectFilters: SubjectFilters;
	try {
		additionalArtifacts = options.additionalArtifacts ?? [];
		subjectFilters = options.subjectFilters ?? { exclude: [], include: [] };
		predecessorOutcome = await dependencies.captureSemantic(admission.predecessorRequest, {
			additionalArtifacts,
			repositoryRoot,
			subjectFilters
		});
	} catch {
		progress.fail([], 'SEMANTIC_CAPTURE_UNAVAILABLE');
		return failure(
			'SEMANTIC_CAPTURE_UNAVAILABLE',
			'SEMANTIC_CAPTURE',
			'failed',
			[
				reportDiagnostic(
					'SEMANTIC_CAPTURE_UNAVAILABLE',
					'The bounded static semantic predecessor was unavailable.',
					null,
					'CAPTURE',
					'SEMANTIC_CAPTURE',
					'ERROR'
				)
			],
			request
		);
	}
	const capture = stableSemanticCapture(predecessorOutcome);
	if (capture === null) {
		progress.fail([], 'SEMANTIC_CAPTURE_UNAVAILABLE');
		return failure(
			'SEMANTIC_CAPTURE_UNAVAILABLE',
			'SEMANTIC_CAPTURE',
			'failed',
			[
				reportDiagnostic(
					'SEMANTIC_CAPTURE_UNAVAILABLE',
					'The bounded static semantic predecessor did not produce a trusted capture.',
					null,
					'CAPTURE',
					'SEMANTIC_CAPTURE',
					'ERROR'
				)
			],
			request
		);
	}
	if (
		!exactCaptureReconciles(capture, admission, repositoryRoot, additionalArtifacts, subjectFilters)
	) {
		progress.fail([], 'SEMANTIC_CAPTURE_VALIDATION_FAILED');
		return failure(
			'SEMANTIC_CAPTURE_VALIDATION_FAILED',
			'SEMANTIC_CAPTURE',
			'failed',
			[
				reportDiagnostic(
					'SEMANTIC_CAPTURE_VALIDATION_FAILED',
					'The captured branded subject and validated semantic snapshot failed exact request, root, budget, capability, or identity reconciliation.',
					null,
					'VALIDATE',
					'SEMANTIC_CAPTURE',
					'ERROR'
				)
			],
			request
		);
	}
	const snapshot = capture.semanticSnapshot;
	const subject = capture.frozenSubject;
	const capturedSubjectCompleteness = subjectCompleteness(subject);
	progress.complete(
		[
			progressObservation(
				'SEMANTIC_SOURCES',
				snapshot.sources.length,
				request.budgets.query.maxPopulation
			)
		],
		snapshot.health
	);

	progress.start('QUERY_EVALUATE');
	const queryInput = Object.freeze({
		budgets: request.budgets.query,
		expression: request.expression,
		mode: SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
		records: snapshot.sources
	});
	let observedEvaluationOutcome: SemanticSourceQueryEvaluationOutcome;
	let trustedEvaluationOutcome: SemanticSourceQueryEvaluationOutcome;
	try {
		observedEvaluationOutcome = dependencies.evaluateQuery(queryInput);
		trustedEvaluationOutcome =
			dependencies.evaluateQuery === evaluateSemanticSourceQuery
				? observedEvaluationOutcome
				: evaluateSemanticSourceQuery(queryInput);
	} catch {
		progress.fail([], 'QUERY_EVALUATION_FAILED');
		return failure(
			'QUERY_EVALUATION_FAILED',
			'QUERY_EVALUATE',
			'failed',
			[
				reportDiagnostic(
					'QUERY_EVALUATION_FAILED',
					'The bounded semantic-source query failed closed.',
					null,
					'EVALUATE',
					'QUERY_ENGINE',
					'ERROR'
				)
			],
			request,
			subject.descriptor
		);
	}
	let observedEvaluationReconciles = true;
	if (dependencies.evaluateQuery !== evaluateSemanticSourceQuery)
		try {
			observedEvaluationReconciles =
				canonicalSemanticJson(observedEvaluationOutcome) ===
				canonicalSemanticJson(trustedEvaluationOutcome);
		} catch {
			observedEvaluationReconciles = false;
		}
	if (!observedEvaluationReconciles) {
		progress.fail([], 'QUERY_EVALUATION_VALIDATION_FAILED');
		return failure(
			'QUERY_EVALUATION_VALIDATION_FAILED',
			'QUERY_EVALUATE',
			'failed',
			[
				reportDiagnostic(
					'QUERY_EVALUATION_VALIDATION_FAILED',
					'The query evaluation failed exact trusted replay reconciliation.',
					null,
					'VALIDATE',
					'QUERY_ENGINE',
					'ERROR'
				)
			],
			request,
			subject.descriptor
		);
	}
	const evaluatedOutcome = trustedEvaluationOutcome;
	if (evaluatedOutcome.state === 'REFUSED') {
		progress.fail([], evaluatedOutcome.diagnostic.code);
		return failure(
			evaluatedOutcome.diagnostic.code,
			'QUERY_EVALUATE',
			refusedState(evaluatedOutcome),
			[
				reportDiagnostic(
					evaluatedOutcome.diagnostic.code,
					evaluatedOutcome.diagnostic.message,
					null,
					evaluatedOutcome.diagnostic.phase,
					'QUERY_ENGINE',
					'ERROR'
				)
			],
			request,
			subject.descriptor
		);
	}
	const evaluation = evaluatedOutcome.evaluation;
	if (!evaluationReconciles(evaluation, snapshot)) {
		progress.fail([], 'QUERY_EVALUATION_VALIDATION_FAILED');
		return failure(
			'QUERY_EVALUATION_VALIDATION_FAILED',
			'QUERY_EVALUATE',
			'failed',
			[
				reportDiagnostic(
					'QUERY_EVALUATION_VALIDATION_FAILED',
					'The query evaluation failed exact population, node-total trace, partition, or trusted replay reconciliation.',
					null,
					'VALIDATE',
					'QUERY_ENGINE',
					'ERROR'
				)
			],
			request,
			subject.descriptor
		);
	}
	const partitions = partitionEvaluation(evaluation.recordResults);
	const counts = partitionCounts(partitions);
	progress.complete(
		[
			progressObservation(
				'CHARGED_EVALUATIONS',
				evaluation.coverage.chargedEvaluations,
				request.budgets.query.maxEvaluations
			),
			progressObservation(
				'TRACE_NODES',
				evaluation.coverage.traceNodes,
				request.budgets.query.maxTraceNodes
			),
			progressObservation('SUPPORTED_MATCH_RECORDS', counts.supportedMatches, null),
			progressObservation('SUPPORTED_NONMATCH_RECORDS', counts.supportedNonmatches, null),
			progressObservation('UNKNOWN_RECORDS', counts.unknown, null),
			progressObservation('CONFLICT_RECORDS', counts.conflict, null),
			progressObservation('NOT_APPLICABLE_RECORDS', counts.notApplicable, null),
			progressObservation('UNEVALUATED_RECORDS', counts.unevaluated, null)
		],
		'COMPLETE_NODE_TOTAL_EVALUATION'
	);

	let preCurrentnessResultRecords = 0;
	let detachedEvidence: {
		readonly binding: SemanticSourceQueryReportBinding;
		readonly coverage: SemanticSourceQueryEvaluation['coverage'];
		readonly definition: SemanticSourceQueryReportDefinition;
		readonly diagnostics: readonly SemanticSourceQueryReportDiagnostic[];
		readonly evaluations: readonly {
			readonly query: SemanticSourceQueryRecordResult;
			readonly source: SemanticSourceQueryReportSourceReference;
		}[];
		readonly explanation: {
			readonly evaluatedRecords: number;
			readonly id: string;
			readonly nodeTotal: true;
			readonly policy: 'NODE_TOTAL_PREORDER_TRACE_PER_RETAINED_SOURCE';
			readonly resultId: string;
			readonly traceNodes: number;
		};
		readonly partitions: SemanticSourceQueryReportPartitions;
		readonly population: {
			readonly retainedRecords: number;
			readonly semanticHealth: StaticSemanticSnapshot['health'];
			readonly semanticSnapshotId: StaticSemanticSnapshot['id'];
		};
		readonly reference: SemanticSourceQueryReportReference;
		readonly resultOccurrence: SemanticSourceQueryReportResultOccurrence;
		readonly semanticLimitations: StaticSemanticSnapshot['limitations'];
		readonly subject: FrozenSubject['descriptor'];
	};
	try {
		const diagnostics = derivedReportDiagnostics(snapshot);
		if (diagnostics.length > request.budgets.maxDiagnostics)
			throw new ReportRequestError(
				'RESULT_DIAGNOSTIC_BUDGET_EXCEEDED',
				'The derived report diagnostics exceed maxDiagnostics.',
				'$.budgets.maxDiagnostics',
				'resource-refused'
			);
		const sourceReferences = safeSourceReferences(snapshot);
		const evaluations = evaluation.recordResults.map((query, index) => ({
			query,
			source: sourceReferences[index]!
		}));
		preCurrentnessResultRecords =
			evaluations.length +
			evaluation.coverage.traceNodes +
			snapshot.sources.length +
			snapshot.limitations.length +
			evaluation.expression.nodeCount +
			diagnostics.length +
			16;
		if (preCurrentnessResultRecords > request.budgets.maxResultRecords)
			throw new ReportRequestError(
				'RESULT_RECORD_BUDGET_EXCEEDED',
				`The query report requires ${preCurrentnessResultRecords} pre-currentness accounted records and exceeds maxResultRecords ${request.budgets.maxResultRecords}.`,
				'$.budgets.maxResultRecords',
				'resource-refused'
			);
		const definition = queryDefinition(request, evaluation.expression);
		const reference = queryReference(request, definition);
		const binding = queryBinding(definition, reference, snapshot);
		const resultOccurrence = queryResultOccurrence(request, binding, partitions, evaluation);
		const explanationPreimage = {
			evaluatedRecords: evaluation.recordResults.length,
			evaluations,
			nodeTotal: true as const,
			policy: 'NODE_TOTAL_PREORDER_TRACE_PER_RETAINED_SOURCE' as const,
			resultId: resultOccurrence.id,
			traceNodes: evaluation.coverage.traceNodes
		};
		const explanation = {
			evaluatedRecords: explanationPreimage.evaluatedRecords,
			id: hashIdentity('semantic-source-query-explanation', explanationPreimage),
			nodeTotal: true as const,
			policy: explanationPreimage.policy,
			resultId: explanationPreimage.resultId,
			traceNodes: explanationPreimage.traceNodes
		};
		detachedEvidence = detached({
			binding,
			coverage: evaluation.coverage,
			definition,
			diagnostics,
			evaluations,
			explanation,
			partitions,
			population: {
				retainedRecords: snapshot.sources.length,
				semanticHealth: snapshot.health,
				semanticSnapshotId: snapshot.id
			},
			reference,
			resultOccurrence,
			semanticLimitations: snapshot.limitations,
			subject: subject.descriptor
		});
	} catch (error) {
		const requestError = error instanceof ReportRequestError ? error : null;
		const code = requestError?.code ?? 'EVIDENCE_DETACH_FAILED';
		progress.fail([], code);
		return failure(
			code,
			'QUERY_EVALUATE',
			requestError?.state ?? 'failed',
			[
				reportDiagnostic(
					code,
					requestError?.message ??
						'The validated query evidence could not be bounded and detached safely.',
					requestError?.path ?? null,
					'RESULT_BUILD',
					'REPORT',
					'ERROR'
				)
			],
			request,
			subject.descriptor
		);
	}

	// Currentness is intentionally last, after every query witness and identity is detached and
	// deeply frozen. It cannot retroactively change the evidence-producing subject.
	progress.start('CURRENTNESS');
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		const observed = detached(dependencies.verifySubject(subject, { rootLocator: repositoryRoot }));
		if (dependencies.verifySubject !== verifyFrozenSubject) {
			const trusted = detached(verifyFrozenSubject(subject, { rootLocator: repositoryRoot }));
			if (canonicalSemanticJson(observed) !== canonicalSemanticJson(trusted))
				throw new Error('Injected currentness observation failed trusted replay.');
			freshness = trusted;
		} else {
			freshness = observed;
		}
	} catch {
		freshness = detached({
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
			state: 'UNAVAILABLE' as const
		});
	}
	const currentnessState =
		freshness.state === 'CURRENT' ? ('CURRENT_FOR_CAPTURED_SUBJECT' as const) : freshness.state;
	const currentnessChangedPaths = detached(
		freshness.changedPaths
			.map((path) => safeDiagnosticPath(path, repositoryRoot))
			.filter((path): path is string => path !== null)
	);
	const currentnessDiagnostics = detached(
		freshness.diagnostics.map((diagnostic) =>
			reportDiagnostic(
				diagnostic.code,
				redactRoot(diagnostic.message, repositoryRoot),
				safeDiagnosticPath(diagnostic.path, repositoryRoot),
				diagnostic.phase,
				'CURRENTNESS',
				diagnostic.severity
			)
		)
	);
	if (
		detachedEvidence.diagnostics.length + currentnessDiagnostics.length >
		request.budgets.maxDiagnostics
	) {
		progress.fail([], 'RESULT_DIAGNOSTIC_BUDGET_EXCEEDED');
		return failure(
			'RESULT_DIAGNOSTIC_BUDGET_EXCEEDED',
			'CURRENTNESS',
			'resource-refused',
			[
				reportDiagnostic(
					'RESULT_DIAGNOSTIC_BUDGET_EXCEEDED',
					'The final currentness diagnostics exceed maxDiagnostics.',
					'$.budgets.maxDiagnostics',
					'FRESHNESS',
					'CURRENTNESS',
					'ERROR'
				)
			],
			request,
			detachedEvidence.subject
		);
	}
	const finalAccountedResultRecords =
		preCurrentnessResultRecords + currentnessDiagnostics.length + currentnessChangedPaths.length;
	if (finalAccountedResultRecords > request.budgets.maxResultRecords) {
		progress.fail([], 'RESULT_RECORD_BUDGET_EXCEEDED');
		return failure(
			'RESULT_RECORD_BUDGET_EXCEEDED',
			'CURRENTNESS',
			'resource-refused',
			[
				reportDiagnostic(
					'RESULT_RECORD_BUDGET_EXCEEDED',
					`The final query report requires ${finalAccountedResultRecords} accounted records and exceeds maxResultRecords ${request.budgets.maxResultRecords}.`,
					'$.budgets.maxResultRecords',
					'FRESHNESS',
					'CURRENTNESS',
					'ERROR'
				)
			],
			request,
			detachedEvidence.subject
		);
	}
	progress.complete(
		[progressObservation('CURRENTNESS_CHANGED_PATHS', currentnessChangedPaths.length, null)],
		currentnessState
	);

	progress.start('RESULT');
	const stageOutcomes: SemanticSourceQueryReportStageOutcomes = detached({
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		queryEvaluation: {
			diagnosticCodes: [],
			mode: SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
			outcome: 'evaluated' as const
		},
		queryValidation: {
			diagnosticCodes: [],
			outcome: 'validated' as const
		},
		semanticCapture: {
			diagnosticCodes: [
				...(snapshot.health === 'PARTIAL' ? ['SEMANTIC_CAPTURE_PARTIAL'] : []),
				...(capturedSubjectCompleteness === 'PARTIAL' ? ['SUBJECT_CAPTURE_PARTIAL'] : [])
			],
			outcome: 'captured' as const,
			semanticHealth: snapshot.health,
			subjectCompleteness: capturedSubjectCompleteness
		}
	});
	const report: SemanticSourceQueryReportOutcome = {
		analysisAuthority: SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY,
		authorityTransfer: SEMANTIC_SOURCE_QUERY_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [...detachedEvidence.diagnostics, ...currentnessDiagnostics],
		gateEffect: SEMANTIC_SOURCE_QUERY_REPORT_GATE_EFFECT,
		operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				fullJanCsaaCapability029SemanticQuery: 'NOT_CLAIMED',
				id: SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY,
				registeredJanCsaa007Operation: 'NOT_CLAIMED',
				status: SEMANTIC_SOURCE_QUERY_REPORT_CAPABILITY_STATUS
			},
			currentness: {
				changedPaths: currentnessChangedPaths,
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			dynamicEvidence: {
				applicability: 'NOT_APPLICABLE',
				epistemic: detached(dynamicEvidenceEpistemic()),
				rationale: DYNAMIC_EVIDENCE_RATIONALE
			},
			evaluations: detachedEvidence.evaluations,
			executionMode: SEMANTIC_SOURCE_QUERY_EXECUTION_MODE,
			facadeNonclaims: SEMANTIC_SOURCE_QUERY_REPORT_NONCLAIMS,
			identities: {
				queryBindingId: detachedEvidence.binding.id,
				queryDefinitionId: detachedEvidence.definition.id,
				queryExplanationId: detachedEvidence.explanation.id,
				queryReferenceId: detachedEvidence.reference.id,
				queryResultId: detachedEvidence.resultOccurrence.id
			},
			interpretation: 'BOUNDED_STATIC_SEMANTIC_SOURCE_SCALAR_QUERY',
			limitations: {
				semanticSnapshot: detachedEvidence.semanticLimitations,
				zeroSupportedMatchesGlobalAbsence: 'NOT_SUPPORTED'
			},
			partitions: detachedEvidence.partitions,
			population: {
				evaluatedRecords: detachedEvidence.evaluations.length,
				evaluationClosure: 'CLOSED_FOR_RETAINED_VALIDATED_SEMANTIC_SOURCES',
				globalClosure: 'OPEN',
				retainedRecords: detachedEvidence.population.retainedRecords,
				semanticHealth: detachedEvidence.population.semanticHealth,
				semanticSnapshotId: detachedEvidence.population.semanticSnapshotId,
				zeroSupportedMatchesMeaning: 'NO_SUPPORTED_MATCH_IN_RETAINED_POPULATION_ONLY'
			},
			queryBinding: detachedEvidence.binding,
			queryCoreNonclaims: SEMANTIC_SOURCE_QUERY_NONCLAIMS,
			queryCoverage: {
				chargedEvaluations: detachedEvidence.coverage.chargedEvaluations,
				partitionsReconcile: detachedEvidence.coverage.partitionsReconcile,
				traceNodes: detachedEvidence.coverage.traceNodes
			},
			queryDefinition: detachedEvidence.definition,
			queryExplanation: detachedEvidence.explanation,
			queryReference: detachedEvidence.reference,
			queryResult: detachedEvidence.resultOccurrence,
			schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_RESULT_SCHEMA_VERSION
		},
		schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_SCHEMA_VERSION,
		stageOutcomes,
		state: 'partial',
		subject: detachedEvidence.subject
	};
	try {
		const resultBytes = canonicalSemanticJsonWitness(report).bytes + 1;
		if (resultBytes > request.budgets.maxResultBytes) {
			progress.fail(
				[progressObservation('RESULT_BYTES', resultBytes, request.budgets.maxResultBytes, 'BYTES')],
				'RESULT_BUDGET_EXCEEDED'
			);
			return failure(
				'RESULT_BUDGET_EXCEEDED',
				'RESULT',
				'resource-refused',
				[
					reportDiagnostic(
						'RESULT_BUDGET_EXCEEDED',
						`The admitted semantic-source query report requires ${resultBytes} bytes including the terminal LF and exceeds maxResultBytes ${request.budgets.maxResultBytes}.`,
						null,
						'SERIALIZE',
						'REPORT',
						'ERROR'
					)
				],
				request,
				detachedEvidence.subject
			);
		}
		progress.complete(
			[progressObservation('RESULT_BYTES', resultBytes, request.budgets.maxResultBytes, 'BYTES')],
			'PARTIAL'
		);
		return detached(report);
	} catch {
		progress.fail([], 'RESULT_SERIALIZATION_FAILED');
		return failure(
			'RESULT_SERIALIZATION_FAILED',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'RESULT_SERIALIZATION_FAILED',
					'The report could not be serialized safely.',
					null,
					'SERIALIZE',
					'REPORT',
					'ERROR'
				)
			],
			request,
			detachedEvidence.subject
		);
	}
}

/** @internal Dependency seam for focused tests; intentionally not package-root exported. */
export async function runSemanticSourceQueryReportWithDependencies(
	requestValue: unknown,
	options: RunSemanticSourceQueryReportOptions,
	dependencies: SemanticSourceQueryReportRuntimeDependencies
): Promise<SemanticSourceQueryReportOutcome> {
	const progress = createProgressRecorder(options);
	try {
		const stableDependencies = stableRuntimeDependencies(dependencies);
		return progress.finish(await runInternal(requestValue, options, progress, stableDependencies));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic(
					'INTERNAL_FAILURE',
					'The semantic-source query report failed closed.',
					null,
					'INTERNAL',
					'REPORT',
					'ERROR'
				)
			])
		);
	}
}

export async function runSemanticSourceQueryReport(
	requestValue: unknown,
	options: RunSemanticSourceQueryReportOptions
): Promise<SemanticSourceQueryReportOutcome> {
	return runSemanticSourceQueryReportWithDependencies(requestValue, options, DEFAULT_DEPENDENCIES);
}

export function semanticSourceQueryReportExitCode(
	outcome: SemanticSourceQueryReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
