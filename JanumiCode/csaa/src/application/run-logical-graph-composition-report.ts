import { isAbsolute } from 'node:path';

import {
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION,
	type CallGraphSnapshot
} from '../contracts/call-graph.js';
import {
	LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_SELECTION,
	type BuildLogicalGraphCompositionRequest,
	type LogicalGraphCompositionBuildInputs,
	type LogicalGraphCompositionBuildOutcome,
	type LogicalGraphCompositionDiagnostic,
	type LogicalGraphCompositionSnapshot
} from '../contracts/logical-graph-composition.js';
import {
	LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY,
	LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER,
	LOGICAL_GRAPH_COMPOSITION_REPORT_CAPABILITY_ID,
	LOGICAL_GRAPH_COMPOSITION_REPORT_FULL_CAPABILITY,
	LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT,
	LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS,
	LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_PREDECESSOR_NONCLAIMS,
	LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_RESULT_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS,
	LOGICAL_GRAPH_COMPOSITION_REPORT_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_SELECTION,
	type LogicalGraphCompositionReportBudgets,
	type LogicalGraphCompositionReportDiagnostic,
	type LogicalGraphCompositionReportFailureState,
	type LogicalGraphCompositionReportOutcome,
	type LogicalGraphCompositionReportRequest,
	type LogicalGraphCompositionReportStage,
	type LogicalGraphCompositionReportStageOutcomes
} from '../contracts/logical-graph-composition-report.js';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	MODULE_DEPENDENCY_GRAPH_CAPABILITY,
	MODULE_DEPENDENCY_GRAPH_CAPABILITY_STATUS,
	type BuildModuleDependencyGraphRequest,
	type ModuleDependencyGraphBuildOutcome,
	type ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import {
	PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	type ProjectContextGraphBuildInputs
} from '../contracts/project-context-graph.js';
import {
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	type ProjectContextReportRequest
} from '../contracts/project-context-report.js';
import type { SubjectDiagnostic } from '../contracts/subject.js';
import {
	buildBoundedCallGraph,
	type BoundedCallGraphBuildOutcome
} from '../graph/build-call-graph.js';
import { buildLogicalGraphComposition } from '../graph/build-logical-graph-composition.js';
import { buildModuleDependencyGraph } from '../graph/build-module-dependency-graph.js';
import { validateCallGraph } from '../graph/validate-call-graph.js';
import { validateLogicalGraphComposition } from '../graph/validate-logical-graph-composition.js';
import { validateModuleDependencyGraph } from '../graph/validate-graph.js';
import { validateProjectContextGraph } from '../graph/validate-project-context-graph.js';
import { hasValidatedStaticSemanticSnapshotCapability } from '../semantic/build-static-semantic-snapshot.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import { isFrozenSubjectCapability } from '../subject/frozen-store.js';
import {
	assertCanonicalRelativePath,
	repositoryRelativePath,
	resolveRepositoryRoot
} from '../subject/paths.js';
import { projectedModuleDependencyPopulation } from './run-module-dependency-report.js';
import {
	admitProjectContextReportRequest,
	captureProjectContextReportPipeline,
	type CaptureProjectContextReportPipelineOptions,
	type ProjectContextReportPipelineCapture,
	type ProjectContextReportPipelineOutcome
} from './run-project-context-report.js';

const REQUEST_KEYS = [
	'budgets',
	'operationVersion',
	'schemaVersion',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = [
	'callGraph',
	'logicalGraphComposition',
	'maxResultBytes',
	'moduleDependencyGraph',
	'projectContext',
	'semantic',
	'subject'
] as const;
const MODULE_BUDGET_KEYS = ['maxEdges', 'maxLimitations', 'maxNodes'] as const;
const CALL_BUDGET_KEYS = [
	'maxClassificationSteps',
	'maxEdges',
	'maxLimitations',
	'maxNodes'
] as const;
const PROJECT_CONTEXT_BUDGET_KEYS = [
	'maxConfigurationClosureRecords',
	'maxDiagnostics',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxMemberships',
	'maxOutputRecords',
	'maxPrograms',
	'maxProjectReferences',
	'maxProjects',
	'maxSources',
	'maxTraversalSteps'
] as const;
const COMPOSITION_BUDGET_KEYS = [
	'maxCallEdges',
	'maxCallNodes',
	'maxConflictRecords',
	'maxDiagnostics',
	'maxEligibleSourceNodes',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxLinks',
	'maxModuleDependencyEdges',
	'maxModuleDependencyNodes',
	'maxOutputRecords',
	'maxTraversalSteps',
	'maxUnmatchedRecords'
] as const;
const ZERO_COMPOSITION_BUDGET_KEYS = new Set<(typeof COMPOSITION_BUDGET_KEYS)[number]>([
	'maxConflictRecords',
	'maxUnmatchedRecords'
]);
const ZERO_PROJECT_CONTEXT_BUDGET_KEYS = new Set<(typeof PROJECT_CONTEXT_BUDGET_KEYS)[number]>([
	'maxProjectReferences',
	'maxSources'
]);
const MAX_DIAGNOSTIC_PATH_CHARACTERS = 10_000;
const VALIDATION_MAX_RECORDS = 10_000_000;
const VALIDATION_MAX_STRING_CHARACTERS = 1_000_000_000;

interface LogicalGraphCompositionReportAdmission {
	readonly budgets: LogicalGraphCompositionReportBudgets;
	readonly predecessorRequest: ProjectContextReportRequest;
}

type ProjectedModuleDependencyPopulation = ReturnType<typeof projectedModuleDependencyPopulation>;

export const LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-logical-graph-composition-report-progress/0.1.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type LogicalGraphCompositionReportProgressPhase =
	| 'REQUEST_BIND'
	| 'PREDECESSOR_PIPELINE'
	| 'MODULE_DEPENDENCY_GRAPH'
	| 'CALL_GRAPH'
	| 'LOGICAL_GRAPH_COMPOSITION'
	| 'CURRENTNESS'
	| 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	CALL_GRAPH: 'CALL_GRAPH',
	CURRENTNESS: 'CURRENTNESS',
	LOGICAL_GRAPH_COMPOSITION: 'LOGICAL_GRAPH_COMPOSITION',
	MODULE_DEPENDENCY_GRAPH: 'MODULE_DEPENDENCY_GRAPH',
	PREDECESSOR_PIPELINE: 'PREDECESSOR_PIPELINE',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT'
} as const satisfies Readonly<
	Record<LogicalGraphCompositionReportProgressPhase, LogicalGraphCompositionReportStage>
>);

export type LogicalGraphCompositionReportProgressMetric =
	| 'CALL_GRAPH_EDGES'
	| 'CALL_GRAPH_LIMITATIONS'
	| 'CALL_GRAPH_NODES'
	| 'COMPOSITION_CROSS_LINKS'
	| 'COMPOSITION_INHERITED_LIMITATIONS'
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'MODULE_GRAPH_EDGES'
	| 'MODULE_GRAPH_LIMITATIONS'
	| 'MODULE_GRAPH_NODES'
	| 'PREDECESSOR_AST_NODES'
	| 'PREDECESSOR_INVOCATIONS'
	| 'PREDECESSOR_SOURCES'
	| 'PREDECESSOR_SUBJECT_ARTIFACTS'
	| 'RESULT_BYTES';

export interface LogicalGraphCompositionReportProgressObservation {
	readonly limit: number | null;
	readonly metric: LogicalGraphCompositionReportProgressMetric;
	readonly unit: 'BYTES' | 'COUNT';
	readonly value: number;
}

export interface LogicalGraphCompositionReportProgressEvent {
	readonly deliverySemantics: 'DEFERRED_UNTIL_TERMINAL_EVIDENCE';
	readonly detailCode: string | null;
	readonly kind: 'REPORT_STAGE';
	readonly nonclaims: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly LogicalGraphCompositionReportProgressObservation[];
	readonly operationVersion: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION;
	readonly phase: LogicalGraphCompositionReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: LogicalGraphCompositionReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED';
}

export interface RunLogicalGraphCompositionReportOptions {
	readonly onProgress?: (event: LogicalGraphCompositionReportProgressEvent) => unknown;
	readonly repositoryRoot: string;
}

interface ProgressRecorder {
	complete(
		observations?: readonly LogicalGraphCompositionReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly LogicalGraphCompositionReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: LogicalGraphCompositionReportOutcome): LogicalGraphCompositionReportOutcome;
	start(
		phase: LogicalGraphCompositionReportProgressPhase,
		observations?: readonly LogicalGraphCompositionReportProgressObservation[]
	): void;
}

function progressObservation(
	metric: LogicalGraphCompositionReportProgressMetric,
	value: number,
	limit: number | null,
	unit: LogicalGraphCompositionReportProgressObservation['unit'] = 'COUNT'
): LogicalGraphCompositionReportProgressObservation {
	return Object.freeze({
		limit,
		metric,
		unit,
		value: Number.isSafeInteger(value) && value >= 0 ? value : 0
	});
}

function progressSink(
	options: RunLogicalGraphCompositionReportOptions
): ((event: LogicalGraphCompositionReportProgressEvent) => unknown) | undefined {
	try {
		if (options === null || typeof options !== 'object' || isProxyValue(options)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: LogicalGraphCompositionReportProgressEvent) => unknown)
			: undefined;
	} catch {
		return undefined;
	}
}

function createProgressRecorder(
	options: RunLogicalGraphCompositionReportOptions
): ProgressRecorder {
	const sink = progressSink(options);
	const events: LogicalGraphCompositionReportProgressEvent[] = [];
	let active: LogicalGraphCompositionReportProgressPhase | null = null;
	let sequence = 0;
	const record = (
		phase: LogicalGraphCompositionReportProgressPhase,
		state: LogicalGraphCompositionReportProgressEvent['state'],
		observations: readonly LogicalGraphCompositionReportProgressObservation[],
		detailCode: string | null
	): void => {
		events.push(
			Object.freeze({
				deliverySemantics: 'DEFERRED_UNTIL_TERMINAL_EVIDENCE' as const,
				detailCode,
				kind: 'REPORT_STAGE' as const,
				nonclaims: LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS,
				observations: Object.freeze([...observations]),
				operationVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
				phase,
				protocolRole: 'PRELIMINARY_TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_TELEMETRY' as const,
				reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
				schemaVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_SCHEMA_VERSION,
				sequence: ++sequence,
				stage: PROGRESS_PHASE_STAGE[phase],
				state
			})
		);
	};
	const close = (
		state: 'COMPLETED' | 'FAILED',
		observations: readonly LogicalGraphCompositionReportProgressObservation[],
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
		finish(outcome): LogicalGraphCompositionReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			if (sink !== undefined)
				for (const event of events)
					try {
						const result = sink(event);
						if (result !== undefined) void Promise.resolve(result).catch(() => undefined);
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
		readonly state: LogicalGraphCompositionReportFailureState = 'incompatible'
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

function boundedBudget(value: unknown, ceiling: number, path: string, allowZero = false): number {
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		Object.is(value, -0) ||
		value < (allowZero ? 0 : 1)
	)
		throw new ReportRequestError(
			'REQUEST_BUDGET_INVALID',
			`${path} must be ${allowZero ? 'a non-negative' : 'a positive'} safe integer.`,
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
	path: string,
	zeroKeys: ReadonlySet<Keys[number]> = new Set()
): Readonly<Record<Keys[number], number>> {
	const record = exactDataRecord(value, keys, path);
	return Object.freeze(
		Object.fromEntries(
			keys.map((key) => [
				key,
				boundedBudget(
					record[key],
					ceilings[key as Keys[number]],
					`${path}.${key}`,
					zeroKeys.has(key)
				)
			])
		) as Record<Keys[number], number>
	);
}

function materializeAdmission(value: unknown): LogicalGraphCompositionReportAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const maxResultBytes = boundedBudget(
		budgets.maxResultBytes,
		LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS.maxResultBytes,
		'$.budgets.maxResultBytes'
	);
	const moduleDependencyGraph = materializeBudgetRecord(
		budgets.moduleDependencyGraph,
		MODULE_BUDGET_KEYS,
		LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS.moduleDependencyGraph,
		'$.budgets.moduleDependencyGraph'
	) as unknown as LogicalGraphCompositionReportBudgets['moduleDependencyGraph'];
	const callGraph = materializeBudgetRecord(
		budgets.callGraph,
		CALL_BUDGET_KEYS,
		LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS.callGraph,
		'$.budgets.callGraph'
	) as unknown as LogicalGraphCompositionReportBudgets['callGraph'];
	const projectContext = materializeBudgetRecord(
		budgets.projectContext,
		PROJECT_CONTEXT_BUDGET_KEYS,
		LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS.projectContext,
		'$.budgets.projectContext',
		ZERO_PROJECT_CONTEXT_BUDGET_KEYS
	) as unknown as LogicalGraphCompositionReportBudgets['projectContext'];
	const logicalGraphComposition = materializeBudgetRecord(
		budgets.logicalGraphComposition,
		COMPOSITION_BUDGET_KEYS,
		LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS.logicalGraphComposition,
		'$.budgets.logicalGraphComposition',
		ZERO_COMPOSITION_BUDGET_KEYS
	) as unknown as LogicalGraphCompositionReportBudgets['logicalGraphComposition'];
	const predecessorAdmission = admitProjectContextReportRequest({
		budgets: {
			maxResultBytes: Math.min(
				maxResultBytes,
				PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.maxResultBytes
			),
			projectContext: {
				...projectContext,
				maxInputRecords: Math.min(
					projectContext.maxInputRecords,
					PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.projectContext.maxInputRecords
				)
			},
			semantic: budgets.semantic,
			subject: budgets.subject
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
			callGraph,
			logicalGraphComposition,
			maxResultBytes,
			moduleDependencyGraph,
			projectContext,
			semantic: predecessorAdmission.request.budgets.semantic,
			subject: predecessorAdmission.request.budgets.subject
		}),
		predecessorRequest: predecessorAdmission.request
	});
}

function materializedRequest(
	admission: LogicalGraphCompositionReportAdmission
): LogicalGraphCompositionReportRequest {
	return Object.freeze({
		budgets: admission.budgets,
		operationVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
		schemaVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: admission.predecessorRequest.subjectProjectConfigPaths
	});
}

function effectivePredecessorRequest(
	admission: LogicalGraphCompositionReportAdmission
): ProjectContextReportRequest {
	return {
		...admission.predecessorRequest,
		budgets: {
			...admission.predecessorRequest.budgets,
			projectContext: admission.budgets.projectContext
		}
	};
}

export type LogicalGraphCompositionReportRequestAdmission =
	| { readonly outcome: 'admitted'; readonly request: LogicalGraphCompositionReportRequest }
	| {
			readonly code: string;
			readonly message: string;
			readonly outcome: 'rejected';
			readonly path: string;
			readonly state: LogicalGraphCompositionReportFailureState;
	  };

/** @internal Hostile-safe admission seam; intentionally not package-root exported. */
export function admitLogicalGraphCompositionReportRequest(
	value: unknown
): LogicalGraphCompositionReportRequestAdmission {
	try {
		return { outcome: 'admitted', request: materializedRequest(materializeAdmission(value)) };
	} catch (error) {
		if (error instanceof ReportRequestError)
			return {
				code: error.code,
				message: error.message,
				outcome: 'rejected',
				path: error.path,
				state: error.state
			};
		return {
			code: 'REQUEST_INVALID',
			message: 'The report request could not be inspected safely.',
			outcome: 'rejected',
			path: '$',
			state: 'incompatible'
		};
	}
}

function reportDiagnostic(
	code: string,
	message: string,
	path: string | null = null,
	phase: string | null = null,
	source: LogicalGraphCompositionReportDiagnostic['source'] = 'REPORT',
	severity: LogicalGraphCompositionReportDiagnostic['severity'] = null,
	predecessorSource: LogicalGraphCompositionReportDiagnostic['predecessorSource'] = null
): LogicalGraphCompositionReportDiagnostic {
	return { code, message, path, phase, predecessorSource, severity, source };
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
	if (path === null) return null;
	if (path.length > MAX_DIAGNOSTIC_PATH_CHARACTERS || !isUnicodeScalarString(path)) return null;
	if (path.startsWith('$')) return path;
	try {
		return isAbsolute(path)
			? repositoryRelativePath(repositoryRoot, path)
			: assertCanonicalRelativePath(path);
	} catch {
		return null;
	}
}

function predecessorSource(
	source: ProjectContextReportPipelineCapture['diagnostics'][number]['source']
): LogicalGraphCompositionReportDiagnostic['predecessorSource'] {
	return source === 'CURRENTNESS' ? null : source;
}

function predecessorDiagnostics(
	capture: ProjectContextReportPipelineCapture
): LogicalGraphCompositionReportDiagnostic[] {
	return capture.diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, capture.repositoryRoot),
			safeDiagnosticPath(diagnostic.path, capture.repositoryRoot),
			diagnostic.phase,
			'PREDECESSOR_PIPELINE',
			diagnostic.severity,
			predecessorSource(diagnostic.source)
		)
	);
}

function unavailablePredecessorDiagnostics(
	diagnostics: readonly ProjectContextReportPipelineCapture['diagnostics'][number][],
	repositoryRoot: string
): LogicalGraphCompositionReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			safeDiagnosticPath(diagnostic.path, repositoryRoot),
			diagnostic.phase,
			'PREDECESSOR_PIPELINE',
			diagnostic.severity,
			predecessorSource(diagnostic.source)
		)
	);
}

function failure(
	code: string,
	stage: LogicalGraphCompositionReportStage,
	state: LogicalGraphCompositionReportFailureState,
	diagnostics: readonly LogicalGraphCompositionReportDiagnostic[],
	request?: LogicalGraphCompositionReportRequest,
	subject?: ProjectContextReportPipelineCapture['frozenSubject']['descriptor']
): LogicalGraphCompositionReportOutcome {
	return {
		analysisAuthority: LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY,
		authorityTransfer: LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS,
		gateEffect: LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT,
		operationVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: LOGICAL_GRAPH_COMPOSITION_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

function repositoryRootOption(options: RunLogicalGraphCompositionReportOptions): string {
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

function exactCaptureReconciles(
	capture: ProjectContextReportPipelineCapture,
	admission: LogicalGraphCompositionReportAdmission,
	repositoryRoot: string,
	producer: LogicalGraphCompositionReportRuntimeDependencies['captureProjectContext']
): boolean {
	const subject = capture.frozenSubject;
	const snapshot = capture.semanticSnapshot;
	if (
		!isFrozenSubjectCapability(subject) ||
		!hasValidatedStaticSemanticSnapshotCapability(snapshot, subject, admission.budgets.semantic) ||
		capture.repositoryRoot !== repositoryRoot ||
		canonicalSemanticJson(capture.request) !==
			canonicalSemanticJson(effectivePredecessorRequest(admission)) ||
		canonicalSemanticJson(snapshot.budgets) !== canonicalSemanticJson(admission.budgets.semantic) ||
		canonicalSemanticJson(snapshot.requestedCapabilities) !==
			canonicalSemanticJson(LOGICAL_GRAPH_COMPOSITION_REPORT_SELECTION.semanticCapabilities) ||
		snapshot.expectedEmpty ||
		snapshot.assignabilityRequests.length !== 0 ||
		canonicalSemanticJson(subject.request.budgets) !==
			canonicalSemanticJson(admission.budgets.subject) ||
		subject.request.scope.kind !== 'EXPLICIT_PROJECTS' ||
		canonicalSemanticJson(subject.request.scope.projects) !==
			canonicalSemanticJson(admission.predecessorRequest.subjectProjectConfigPaths) ||
		(subject.request.scope.additionalArtifacts?.length ?? 0) !== 0 ||
		subject.descriptor.subjectId !== snapshot.subjectId ||
		capture.projectContextGraph.subjectId !== snapshot.subjectId ||
		capture.projectContextGraph.semanticSnapshotId !== snapshot.id
	)
		return false;
	const projectInputs: ProjectContextGraphBuildInputs = {
		frozenSubject: subject,
		request: {
			budgets: admission.budgets.projectContext,
			operationVersion: PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
			schemaVersion: PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
			selection: PROJECT_CONTEXT_GRAPH_SELECTION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		},
		semanticSnapshot: snapshot
	};
	if (producer === captureProjectContextReportPipeline) return true;
	return (
		validateProjectContextGraph(capture.projectContextGraph, projectInputs, {
			maxDepth: 4_096,
			maxInputRecords: admission.budgets.projectContext.maxInputRecords,
			maxInputStringCharacters: admission.budgets.projectContext.maxInputStringCharacters,
			maxIssues: Math.max(1, Math.min(1_000, admission.budgets.projectContext.maxDiagnostics)),
			maxRecords: admission.budgets.projectContext.maxInputRecords,
			maxStringCharacters: admission.budgets.projectContext.maxInputStringCharacters
		}).state === 'VALID'
	);
}

function injectedPredecessorMetadataReconciles(
	capture: ProjectContextReportPipelineCapture,
	admission: LogicalGraphCompositionReportAdmission,
	repositoryRoot: string,
	producer: LogicalGraphCompositionReportRuntimeDependencies['captureProjectContext']
): boolean {
	if (producer === captureProjectContextReportPipeline) return true;
	try {
		const trusted = captureProjectContextReportPipeline(admission.predecessorRequest, {
			includeTypeCapability: true,
			projectContextBudgets: admission.budgets.projectContext,
			repositoryRoot
		});
		return (
			trusted.outcome === 'captured' &&
			exactCaptureReconciles(
				trusted,
				admission,
				repositoryRoot,
				captureProjectContextReportPipeline
			) &&
			trusted.frozenSubject.descriptor.subjectId === capture.frozenSubject.descriptor.subjectId &&
			trusted.semanticSnapshot.id === capture.semanticSnapshot.id &&
			trusted.projectContextGraph.id === capture.projectContextGraph.id &&
			canonicalSemanticJson(trusted.diagnostics) === canonicalSemanticJson(capture.diagnostics) &&
			canonicalSemanticJson(trusted.predecessorStageOutcomes) ===
				canonicalSemanticJson(capture.predecessorStageOutcomes)
		);
	} catch {
		return false;
	}
}

function injectedUnavailablePredecessorReconciles(
	outcome: Extract<ProjectContextReportPipelineOutcome, { readonly outcome: 'unavailable' }>,
	admission: LogicalGraphCompositionReportAdmission,
	repositoryRoot: string,
	producer: LogicalGraphCompositionReportRuntimeDependencies['captureProjectContext']
): boolean {
	if (producer === captureProjectContextReportPipeline) return true;
	try {
		const trusted = captureProjectContextReportPipeline(admission.predecessorRequest, {
			includeTypeCapability: true,
			projectContextBudgets: admission.budgets.projectContext,
			repositoryRoot
		});
		return (
			trusted.outcome === 'unavailable' &&
			canonicalSemanticJson(trusted) === canonicalSemanticJson(outcome)
		);
	} catch {
		return false;
	}
}

function modulePopulationFits(
	population: ProjectedModuleDependencyPopulation,
	budgets: LogicalGraphCompositionReportBudgets['moduleDependencyGraph']
): boolean {
	return (
		population.edges <= budgets.maxEdges &&
		population.limitations <= budgets.maxLimitations &&
		population.nodes <= budgets.maxNodes
	);
}

function moduleOutputReconciles(
	outcome: ModuleDependencyGraphBuildOutcome,
	request: BuildModuleDependencyGraphRequest,
	capture: ProjectContextReportPipelineCapture,
	population: ProjectedModuleDependencyPopulation,
	producer: typeof buildModuleDependencyGraph
): outcome is Extract<ModuleDependencyGraphBuildOutcome, { readonly graph: unknown }> {
	if (outcome.outcome === 'unavailable') return false;
	const graph = outcome.graph;
	if (
		graph.subjectId !== request.subjectId ||
		graph.semanticSnapshotId !== request.semanticSnapshotId ||
		graph.nodes.length !== population.nodes ||
		graph.edges.length !== population.edges ||
		graph.limitations.length !== population.limitations
	)
		return false;
	if (producer === buildModuleDependencyGraph) return true;
	try {
		return (
			validateModuleDependencyGraph(graph, capture.semanticSnapshot, {
				maxIssues: Math.max(1, Math.min(1_000, capture.request.budgets.semantic.maxDiagnostics))
			}).state === 'VALID' &&
			canonicalSemanticJson(buildModuleDependencyGraph(request, capture.semanticSnapshot)) ===
				canonicalSemanticJson(outcome)
		);
	} catch {
		return false;
	}
}

function callOutputReconciles(
	outcome: BoundedCallGraphBuildOutcome,
	capture: ProjectContextReportPipelineCapture,
	budgets: LogicalGraphCompositionReportBudgets['callGraph'],
	producer: typeof buildBoundedCallGraph
): outcome is Extract<BoundedCallGraphBuildOutcome, { readonly graph: unknown }> {
	if (outcome.outcome !== 'partial') return false;
	const graph = outcome.graph;
	if (
		graph.subjectId !== capture.frozenSubject.descriptor.subjectId ||
		graph.semanticSnapshotId !== capture.semanticSnapshot.id
	)
		return false;
	if (producer === buildBoundedCallGraph) return true;
	try {
		const trusted = buildBoundedCallGraph(
			{
				operationVersion: CALL_GRAPH_OPERATION_VERSION,
				schemaVersion: CALL_GRAPH_REQUEST_SCHEMA_VERSION,
				semanticSnapshotId: capture.semanticSnapshot.id,
				subjectId: capture.frozenSubject.descriptor.subjectId
			},
			capture.semanticSnapshot,
			{ budgets }
		);
		return (
			validateCallGraph(graph, capture.semanticSnapshot, {
				maxIssues: Math.max(1, Math.min(1_000, capture.request.budgets.semantic.maxDiagnostics))
			}).state === 'VALID' && canonicalSemanticJson(trusted) === canonicalSemanticJson(outcome)
		);
	} catch {
		return false;
	}
}

function compositionRequest(
	capture: ProjectContextReportPipelineCapture,
	moduleGraph: ModuleDependencyGraphSnapshot,
	callGraph: CallGraphSnapshot,
	budgets: LogicalGraphCompositionReportBudgets['logicalGraphComposition']
): BuildLogicalGraphCompositionRequest {
	return {
		budgets,
		operationVersion: LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
		schemaVersion: LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION,
		selection: LOGICAL_GRAPH_COMPOSITION_SELECTION,
		semanticSnapshotId: capture.semanticSnapshot.id,
		sourceLayers: [
			{
				canonicalProfile: moduleGraph.canonicalProfile,
				contentDigest: moduleGraph.contentDigest,
				graphId: moduleGraph.id,
				graphInputDigest: moduleGraph.graphInputDigest,
				graphKind: moduleGraph.graphKind,
				layerId: moduleGraph.layers[0].id,
				method: moduleGraph.method,
				operationVersion: moduleGraph.operationVersion,
				ordinal: 0,
				producer: moduleGraph.producer,
				role: 'MODULE_DEPENDENCY',
				schemaVersion: moduleGraph.schemaVersion,
				semanticExtractionVersion: moduleGraph.semanticExtractionVersion,
				semanticSchemaVersion: moduleGraph.semanticSchemaVersion,
				semanticSnapshotId: moduleGraph.semanticSnapshotId,
				subjectId: moduleGraph.subjectId
			},
			{
				canonicalProfile: callGraph.canonicalProfile,
				contentDigest: callGraph.contentDigest,
				graphId: callGraph.id,
				graphInputDigest: callGraph.graphInputDigest,
				graphKind: callGraph.graphKind,
				layerId: callGraph.layers[0].id,
				method: callGraph.method,
				operationVersion: callGraph.operationVersion,
				ordinal: 1,
				producer: callGraph.producer,
				role: 'CALL',
				schemaVersion: callGraph.schemaVersion,
				semanticExtractionVersion: callGraph.semanticExtractionVersion,
				semanticSchemaVersion: callGraph.semanticSchemaVersion,
				semanticSnapshotId: callGraph.semanticSnapshotId,
				subjectId: callGraph.subjectId
			}
		],
		subjectId: capture.frozenSubject.descriptor.subjectId
	};
}

function compositionOutputReconciles(
	outcome: LogicalGraphCompositionBuildOutcome,
	inputs: LogicalGraphCompositionBuildInputs,
	producer: typeof buildLogicalGraphComposition
): outcome is Extract<LogicalGraphCompositionBuildOutcome, { readonly composition: unknown }> {
	if (outcome.outcome !== 'partial') return false;
	const composition = outcome.composition;
	if (
		composition.health !== 'PARTIAL' ||
		composition.closure !== 'OPEN' ||
		composition.layers.length !== 2 ||
		composition.conflicts.length !== 0 ||
		composition.unmatchedSources.length !== 0
	)
		return false;
	if (producer === buildLogicalGraphComposition) return true;
	try {
		return (
			validateLogicalGraphComposition(composition, inputs, {
				maxDepth: 4_096,
				maxInputRecords: inputs.request.budgets.maxInputRecords,
				maxInputStringCharacters: inputs.request.budgets.maxInputStringCharacters,
				maxIssues: Math.max(1, Math.min(1_000, inputs.request.budgets.maxDiagnostics)),
				maxRecords: VALIDATION_MAX_RECORDS,
				maxStringCharacters: VALIDATION_MAX_STRING_CHARACTERS
			}).state === 'VALID' &&
			canonicalSemanticJson(buildLogicalGraphComposition(inputs)) === canonicalSemanticJson(outcome)
		);
	} catch {
		return false;
	}
}

function projectedDiagnostics(
	diagnostics: readonly {
		readonly code: string;
		readonly message: string;
		readonly path: string | null;
		readonly phase: string;
	}[],
	repositoryRoot: string,
	source: LogicalGraphCompositionReportDiagnostic['source']
): LogicalGraphCompositionReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			safeDiagnosticPath(diagnostic.path, repositoryRoot),
			diagnostic.phase,
			source,
			diagnostic.code.includes('PARTIAL') ? 'WARNING' : null
		)
	);
}

function observationsForModule(
	graph: ModuleDependencyGraphSnapshot,
	budgets: LogicalGraphCompositionReportBudgets['moduleDependencyGraph']
): readonly LogicalGraphCompositionReportProgressObservation[] {
	return [
		progressObservation('MODULE_GRAPH_EDGES', graph.edges.length, budgets.maxEdges),
		progressObservation(
			'MODULE_GRAPH_LIMITATIONS',
			graph.limitations.length,
			budgets.maxLimitations
		),
		progressObservation('MODULE_GRAPH_NODES', graph.nodes.length, budgets.maxNodes)
	];
}

function observationsForCall(
	graph: CallGraphSnapshot,
	budgets: LogicalGraphCompositionReportBudgets['callGraph']
): readonly LogicalGraphCompositionReportProgressObservation[] {
	return [
		progressObservation('CALL_GRAPH_EDGES', graph.edges.length, budgets.maxEdges),
		progressObservation('CALL_GRAPH_LIMITATIONS', graph.limitations.length, budgets.maxLimitations),
		progressObservation('CALL_GRAPH_NODES', graph.nodes.length, budgets.maxNodes)
	];
}

function compositionFailureState(
	diagnostics: readonly LogicalGraphCompositionDiagnostic[]
): LogicalGraphCompositionReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXCEEDED'))
		return 'resource-refused';
	if (diagnostics.some((diagnostic) => diagnostic.code === 'REQUEST_INVALID'))
		return 'incompatible';
	return 'failed';
}

interface DetachedEvidence {
	readonly diagnostics: readonly LogicalGraphCompositionReportDiagnostic[];
	readonly evidence: {
		readonly callGraph: CallGraphSnapshot;
		readonly composition: LogicalGraphCompositionSnapshot;
		readonly encoding: 'FULL_VALIDATED_SAME_SUBJECT_PROJECT_CONTEXT_MODULE_CALL_AND_REFERENCE_ONLY_COMPOSITION';
		readonly moduleDependencyGraph: ModuleDependencyGraphSnapshot;
		readonly projectContextGraph: ProjectContextReportPipelineCapture['projectContextGraph'];
	};
	readonly predecessorStageOutcomes: ProjectContextReportPipelineCapture['predecessorStageOutcomes'];
	readonly semanticSnapshotSummary: {
		readonly astNodes: number;
		readonly id: ProjectContextReportPipelineCapture['semanticSnapshot']['id'];
		readonly invocations: number;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
		readonly types: number;
	};
	readonly subject: ProjectContextReportPipelineCapture['frozenSubject']['descriptor'];
}

function detachEvidence(
	capture: ProjectContextReportPipelineCapture,
	moduleGraph: ModuleDependencyGraphSnapshot,
	callGraph: CallGraphSnapshot,
	composition: LogicalGraphCompositionSnapshot,
	diagnostics: readonly LogicalGraphCompositionReportDiagnostic[]
): DetachedEvidence {
	return detached({
		diagnostics,
		evidence: {
			callGraph,
			composition,
			encoding:
				'FULL_VALIDATED_SAME_SUBJECT_PROJECT_CONTEXT_MODULE_CALL_AND_REFERENCE_ONLY_COMPOSITION' as const,
			moduleDependencyGraph: moduleGraph,
			projectContextGraph: capture.projectContextGraph
		},
		predecessorStageOutcomes: capture.predecessorStageOutcomes,
		semanticSnapshotSummary: {
			astNodes: capture.semanticSnapshot.astNodes.length,
			id: capture.semanticSnapshot.id,
			invocations: capture.semanticSnapshot.invocations.length,
			programs: capture.semanticSnapshot.programs.length,
			projects: capture.semanticSnapshot.projects.length,
			sources: capture.semanticSnapshot.sources.length,
			types: capture.semanticSnapshot.types.length
		},
		subject: capture.frozenSubject.descriptor
	});
}

type Awaitable<Value> = PromiseLike<Value> | Value;

export interface LogicalGraphCompositionReportRuntimeDependencies {
	readonly buildCallGraph: typeof buildBoundedCallGraph;
	readonly buildComposition: typeof buildLogicalGraphComposition;
	readonly buildModuleGraph: typeof buildModuleDependencyGraph;
	readonly captureProjectContext: (
		requestValue: unknown,
		options: CaptureProjectContextReportPipelineOptions
	) => Awaitable<ProjectContextReportPipelineOutcome>;
	readonly verifySubject: typeof verifyFrozenSubject;
}

const DEFAULT_DEPENDENCIES: LogicalGraphCompositionReportRuntimeDependencies = Object.freeze({
	buildCallGraph: buildBoundedCallGraph,
	buildComposition: buildLogicalGraphComposition,
	buildModuleGraph: buildModuleDependencyGraph,
	captureProjectContext: captureProjectContextReportPipeline,
	verifySubject: verifyFrozenSubject
});

async function runInternal(
	requestValue: unknown,
	options: RunLogicalGraphCompositionReportOptions,
	progress: ProgressRecorder,
	dependencies: LogicalGraphCompositionReportRuntimeDependencies
): Promise<LogicalGraphCompositionReportOutcome> {
	const buildCallGraph = dependencies.buildCallGraph;
	const buildComposition = dependencies.buildComposition;
	const buildModuleGraph = dependencies.buildModuleGraph;
	const captureProjectContext = dependencies.captureProjectContext;
	const verifySubject = dependencies.verifySubject;
	progress.start('REQUEST_BIND');
	let admission: LogicalGraphCompositionReportAdmission;
	try {
		admission = materializeAdmission(requestValue);
	} catch (error) {
		if (error instanceof ReportRequestError) {
			progress.fail([], error.code);
			return failure(error.code, 'REQUEST', error.state, [
				reportDiagnostic(error.code, error.message, error.path, 'REQUEST')
			]);
		}
		progress.fail([], 'REQUEST_INVALID');
		return failure('REQUEST_INVALID', 'REQUEST', 'incompatible', [
			reportDiagnostic('REQUEST_INVALID', 'The report request or options are invalid.', '$')
		]);
	}
	const request = detached(materializedRequest(admission));
	let repositoryRoot: string;
	try {
		repositoryRoot = repositoryRootOption(options);
	} catch (error) {
		if (error instanceof RepositoryRootUnavailableError) {
			progress.fail([], 'REPOSITORY_ROOT_UNAVAILABLE');
			return failure(
				'REPOSITORY_ROOT_UNAVAILABLE',
				'REQUEST',
				'failed',
				[
					reportDiagnostic(
						'REPOSITORY_ROOT_UNAVAILABLE',
						'The fixed repository root is unavailable.'
					)
				],
				request
			);
		}
		progress.fail([], 'REQUEST_INVALID');
		return failure('REQUEST_INVALID', 'REQUEST', 'incompatible', [
			reportDiagnostic('REQUEST_INVALID', 'The report options are invalid.', '$options')
		]);
	}
	progress.complete([], 'REQUEST_ADMITTED');

	progress.start('PREDECESSOR_PIPELINE');
	const predecessorOutcome = await captureProjectContext(admission.predecessorRequest, {
		includeTypeCapability: true,
		projectContextBudgets: admission.budgets.projectContext,
		repositoryRoot
	});
	if (predecessorOutcome.outcome !== 'captured') {
		if (
			!injectedUnavailablePredecessorReconciles(
				predecessorOutcome,
				admission,
				repositoryRoot,
				captureProjectContext
			)
		) {
			progress.fail([], 'PREDECESSOR_VALIDATION_FAILED');
			return failure(
				'PREDECESSOR_VALIDATION_FAILED',
				'PREDECESSOR_PIPELINE',
				'failed',
				[
					reportDiagnostic(
						'PREDECESSOR_VALIDATION_FAILED',
						'The predecessor failure envelope failed trusted replay.',
						null,
						'VALIDATE',
						'PREDECESSOR_PIPELINE',
						'ERROR'
					)
				],
				request
			);
		}
		progress.fail([], predecessorOutcome.code);
		return failure(
			predecessorOutcome.code,
			'PREDECESSOR_PIPELINE',
			predecessorOutcome.state,
			unavailablePredecessorDiagnostics(predecessorOutcome.diagnostics, repositoryRoot),
			request,
			predecessorOutcome.subject
		);
	}
	const capture = predecessorOutcome;
	if (
		!exactCaptureReconciles(capture, admission, repositoryRoot, captureProjectContext) ||
		!injectedPredecessorMetadataReconciles(
			capture,
			admission,
			repositoryRoot,
			captureProjectContext
		)
	) {
		progress.fail([], 'PREDECESSOR_VALIDATION_FAILED');
		return failure(
			'PREDECESSOR_VALIDATION_FAILED',
			'PREDECESSOR_PIPELINE',
			'failed',
			[
				reportDiagnostic(
					'PREDECESSOR_VALIDATION_FAILED',
					'The captured subject, TS_TYPE semantic snapshot, and project-context evidence failed exact trust reconciliation.',
					null,
					'VALIDATE',
					'PREDECESSOR_PIPELINE',
					'ERROR'
				)
			],
			request
		);
	}
	const inheritedDiagnostics = predecessorDiagnostics(capture);
	progress.complete(
		[
			progressObservation(
				'PREDECESSOR_SUBJECT_ARTIFACTS',
				capture.frozenSubject.artifacts.length,
				request.budgets.subject.maxFiles
			),
			progressObservation(
				'PREDECESSOR_SOURCES',
				capture.semanticSnapshot.sources.length,
				request.budgets.semantic.maxSources
			),
			progressObservation(
				'PREDECESSOR_AST_NODES',
				capture.semanticSnapshot.astNodes.length,
				request.budgets.semantic.maxAstNodes
			),
			progressObservation(
				'PREDECESSOR_INVOCATIONS',
				capture.semanticSnapshot.invocations.length,
				null
			)
		],
		'CAP_010_PIPELINE_CAPTURED_WITH_TS_TYPE'
	);

	progress.start('MODULE_DEPENDENCY_GRAPH');
	const modulePopulation = projectedModuleDependencyPopulation(capture.semanticSnapshot);
	if (!modulePopulationFits(modulePopulation, request.budgets.moduleDependencyGraph)) {
		progress.fail([], 'MODULE_DEPENDENCY_GRAPH_BUDGET_EXCEEDED');
		return failure(
			'MODULE_DEPENDENCY_GRAPH_BUDGET_EXCEEDED',
			'MODULE_DEPENDENCY_GRAPH',
			'resource-refused',
			[
				...inheritedDiagnostics,
				reportDiagnostic(
					'MODULE_DEPENDENCY_GRAPH_BUDGET_EXCEEDED',
					'The exact projected module-dependency population exceeds an admitted budget.',
					'$.budgets.moduleDependencyGraph',
					'PREFLIGHT',
					'MODULE_DEPENDENCY_GRAPH'
				)
			],
			request,
			capture.frozenSubject.descriptor
		);
	}
	const moduleRequest: BuildModuleDependencyGraphRequest = {
		operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
		schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: capture.semanticSnapshot.id,
		subjectId: capture.frozenSubject.descriptor.subjectId
	};
	const moduleOutcome = buildModuleGraph(moduleRequest, capture.semanticSnapshot);
	const moduleProducerIsTrusted = buildModuleGraph === buildModuleDependencyGraph;
	if (
		!moduleOutputReconciles(
			moduleOutcome,
			moduleRequest,
			capture,
			modulePopulation,
			buildModuleGraph
		)
	) {
		progress.fail([], 'MODULE_DEPENDENCY_GRAPH_VALIDATION_FAILED');
		return failure(
			'MODULE_DEPENDENCY_GRAPH_VALIDATION_FAILED',
			'MODULE_DEPENDENCY_GRAPH',
			moduleProducerIsTrusted && moduleOutcome.outcome === 'unavailable'
				? 'incompatible'
				: 'failed',
			[
				...inheritedDiagnostics,
				...(moduleProducerIsTrusted
					? projectedDiagnostics(
							moduleOutcome.diagnostics,
							repositoryRoot,
							'MODULE_DEPENDENCY_GRAPH'
						)
					: []),
				reportDiagnostic(
					'MODULE_DEPENDENCY_GRAPH_VALIDATION_FAILED',
					'The module-dependency producer output failed validation or trusted replay.',
					null,
					'VALIDATE',
					'MODULE_DEPENDENCY_GRAPH',
					'ERROR'
				)
			],
			request,
			capture.frozenSubject.descriptor
		);
	}
	const moduleDiagnostics = projectedDiagnostics(
		moduleOutcome.diagnostics,
		repositoryRoot,
		'MODULE_DEPENDENCY_GRAPH'
	);
	const moduleGraph = moduleOutcome.graph;
	progress.complete(
		observationsForModule(moduleGraph, request.budgets.moduleDependencyGraph),
		moduleOutcome.outcome.toUpperCase()
	);

	progress.start('CALL_GRAPH');
	const callRequest = {
		operationVersion: CALL_GRAPH_OPERATION_VERSION,
		schemaVersion: CALL_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: capture.semanticSnapshot.id,
		subjectId: capture.frozenSubject.descriptor.subjectId
	};
	const callOutcome = buildCallGraph(callRequest, capture.semanticSnapshot, {
		budgets: request.budgets.callGraph
	});
	const callProducerIsTrusted = buildCallGraph === buildBoundedCallGraph;
	if (!callOutputReconciles(callOutcome, capture, request.budgets.callGraph, buildCallGraph)) {
		progress.fail([], 'CALL_GRAPH_VALIDATION_FAILED');
		return failure(
			'CALL_GRAPH_VALIDATION_FAILED',
			'CALL_GRAPH',
			callProducerIsTrusted &&
				callOutcome.diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXCEEDED')
				? 'resource-refused'
				: 'failed',
			[
				...inheritedDiagnostics,
				...moduleDiagnostics,
				...(callProducerIsTrusted
					? projectedDiagnostics(callOutcome.diagnostics, repositoryRoot, 'CALL_GRAPH')
					: []),
				reportDiagnostic(
					'CALL_GRAPH_VALIDATION_FAILED',
					'The call-graph producer output failed validation or trusted replay.',
					null,
					'VALIDATE',
					'CALL_GRAPH',
					'ERROR'
				)
			],
			request,
			capture.frozenSubject.descriptor
		);
	}
	const callDiagnostics = projectedDiagnostics(
		callOutcome.diagnostics,
		repositoryRoot,
		'CALL_GRAPH'
	);
	const callGraph = callOutcome.graph;
	progress.complete(observationsForCall(callGraph, request.budgets.callGraph), 'PARTIAL_OPEN');

	progress.start('LOGICAL_GRAPH_COMPOSITION');
	const logicalRequest = compositionRequest(
		capture,
		moduleGraph,
		callGraph,
		request.budgets.logicalGraphComposition
	);
	const logicalInputs: LogicalGraphCompositionBuildInputs = {
		callGraph,
		moduleDependencyGraph: moduleGraph,
		request: logicalRequest,
		semanticSnapshot: capture.semanticSnapshot
	};
	const logicalOutcome = buildComposition(logicalInputs);
	const compositionProducerIsTrusted = buildComposition === buildLogicalGraphComposition;
	if (!compositionOutputReconciles(logicalOutcome, logicalInputs, buildComposition)) {
		progress.fail([], 'LOGICAL_GRAPH_COMPOSITION_VALIDATION_FAILED');
		return failure(
			'LOGICAL_GRAPH_COMPOSITION_VALIDATION_FAILED',
			'LOGICAL_GRAPH_COMPOSITION',
			compositionProducerIsTrusted ? compositionFailureState(logicalOutcome.diagnostics) : 'failed',
			[
				...inheritedDiagnostics,
				...moduleDiagnostics,
				...callDiagnostics,
				...(compositionProducerIsTrusted
					? projectedDiagnostics(
							logicalOutcome.diagnostics,
							repositoryRoot,
							'LOGICAL_GRAPH_COMPOSITION'
						)
					: []),
				reportDiagnostic(
					'LOGICAL_GRAPH_COMPOSITION_VALIDATION_FAILED',
					'The logical-composition producer output failed validation or trusted replay.',
					null,
					'VALIDATE',
					'LOGICAL_GRAPH_COMPOSITION',
					'ERROR'
				)
			],
			request,
			capture.frozenSubject.descriptor
		);
	}
	const logicalDiagnostics = projectedDiagnostics(
		logicalOutcome.diagnostics,
		repositoryRoot,
		'LOGICAL_GRAPH_COMPOSITION'
	);
	const composition = logicalOutcome.composition;
	let detachedEvidence: DetachedEvidence;
	try {
		detachedEvidence = detachEvidence(capture, moduleGraph, callGraph, composition, [
			...inheritedDiagnostics,
			...moduleDiagnostics,
			...callDiagnostics,
			...logicalDiagnostics
		]);
	} catch {
		progress.fail([], 'EVIDENCE_DETACH_FAILED');
		return failure(
			'EVIDENCE_DETACH_FAILED',
			'LOGICAL_GRAPH_COMPOSITION',
			'failed',
			[
				reportDiagnostic(
					'EVIDENCE_DETACH_FAILED',
					'Validated evidence could not be detached safely.'
				)
			],
			request,
			capture.frozenSubject.descriptor
		);
	}
	progress.complete(
		[
			progressObservation(
				'COMPOSITION_CROSS_LINKS',
				detachedEvidence.evidence.composition.crossLinks.length,
				request.budgets.logicalGraphComposition.maxLinks
			),
			progressObservation(
				'COMPOSITION_INHERITED_LIMITATIONS',
				detachedEvidence.evidence.composition.inheritedLimitations.length,
				request.budgets.logicalGraphComposition.maxOutputRecords
			)
		],
		'PARTIAL_OPEN_TWO_LAYER_REFERENCE_COMPOSITION'
	);
	const completedStageOutcomes = detached({
		callGraph: {
			diagnosticCodes: callOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial' as const
		},
		logicalGraphComposition: {
			diagnosticCodes: logicalOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial' as const
		},
		moduleDependencyGraph: {
			diagnosticCodes: moduleOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: moduleOutcome.outcome
		},
		predecessorPipeline: detachedEvidence.predecessorStageOutcomes
	});

	// Currentness is deliberately the final evidence-producing operation, after all graph evidence
	// has been validated, canonically detached, and deeply frozen.
	progress.start('CURRENTNESS');
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		const observedFreshness = detached(
			verifySubject(capture.frozenSubject, {
				rootLocator: repositoryRoot
			})
		);
		if (verifySubject !== verifyFrozenSubject) {
			const trustedFreshness = detached(
				verifyFrozenSubject(capture.frozenSubject, {
					rootLocator: repositoryRoot
				})
			);
			if (canonicalSemanticJson(observedFreshness) !== canonicalSemanticJson(trustedFreshness))
				throw new Error('Injected currentness observation failed trusted replay.');
		}
		freshness = observedFreshness;
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
		freshness.state === 'CURRENT' ? 'CURRENT_FOR_CAPTURED_SUBJECT' : freshness.state;
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
	progress.complete(
		[progressObservation('CURRENTNESS_CHANGED_PATHS', currentnessChangedPaths.length, null)],
		currentnessState
	);

	progress.start('RESULT');
	const stageOutcomes: LogicalGraphCompositionReportStageOutcomes = detached({
		...completedStageOutcomes,
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		}
	});
	const safeCallGraph = detachedEvidence.evidence.callGraph;
	const safeComposition = detachedEvidence.evidence.composition;
	const safeModuleGraph = detachedEvidence.evidence.moduleDependencyGraph;
	const report: LogicalGraphCompositionReportOutcome = {
		analysisAuthority: LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY,
		authorityTransfer: LOGICAL_GRAPH_COMPOSITION_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [...detachedEvidence.diagnostics, ...currentnessDiagnostics],
		gateEffect: LOGICAL_GRAPH_COMPOSITION_REPORT_GATE_EFFECT,
		operationVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				fullJanCsaaCapability009GraphComposition: LOGICAL_GRAPH_COMPOSITION_REPORT_FULL_CAPABILITY,
				fullJanCsaa007Conformance: safeComposition.fullJanCsaa007Conformance,
				fullJanCsaa008Conformance: safeComposition.fullJanCsaa008Conformance,
				fullJanCsaa009Conformance: safeComposition.fullJanCsaa009Conformance,
				graphAuthority: safeComposition.graphAuthority,
				id: LOGICAL_GRAPH_COMPOSITION_REPORT_CAPABILITY_ID,
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				status: safeComposition.capabilityStatus
			},
			contributingLayers: {
				callGraph: {
					capability: safeCallGraph.capability,
					edges: safeCallGraph.edges.length,
					health: safeCallGraph.health,
					limitations: safeCallGraph.limitations.length,
					nodes: safeCallGraph.nodes.length,
					status: safeCallGraph.capabilityStatus
				},
				moduleDependencyGraph: {
					capability: MODULE_DEPENDENCY_GRAPH_CAPABILITY,
					edges: safeModuleGraph.edges.length,
					health: safeModuleGraph.health,
					limitations: safeModuleGraph.limitations.length,
					nodes: safeModuleGraph.nodes.length,
					status: MODULE_DEPENDENCY_GRAPH_CAPABILITY_STATUS
				}
			},
			coverage: {
				...detachedEvidence.evidence.composition.coverage,
				closure: 'OPEN',
				conflicts: detachedEvidence.evidence.composition.conflicts.length,
				health: 'PARTIAL',
				inheritedLimitations: detachedEvidence.evidence.composition.inheritedLimitations.length,
				layers: 2,
				unmatchedSources: detachedEvidence.evidence.composition.unmatchedSources.length
			},
			currentness: {
				changedPaths: currentnessChangedPaths,
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			evidence: detachedEvidence.evidence,
			facadeNonclaims: LOGICAL_GRAPH_COMPOSITION_REPORT_NONCLAIMS,
			interpretation:
				'SELECTED_VALIDATED_SAME_SUBJECT_PARTIAL_OPEN_TWO_LAYER_REFERENCE_COMPOSITION',
			predecessorNonclaims: LOGICAL_GRAPH_COMPOSITION_REPORT_PREDECESSOR_NONCLAIMS,
			schemaVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_RESULT_SCHEMA_VERSION,
			selection: LOGICAL_GRAPH_COMPOSITION_REPORT_SELECTION,
			semanticSnapshotSummary: detachedEvidence.semanticSnapshotSummary
		},
		schemaVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_SCHEMA_VERSION,
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
						`The admitted logical-graph-composition report requires ${resultBytes} bytes and exceeds maxResultBytes ${request.budgets.maxResultBytes}.`
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
			detachedEvidence.subject
		);
	}
}

/** @internal Test seam; intentionally not exported from the package root. */
export async function runLogicalGraphCompositionReportWithDependencies(
	requestValue: unknown,
	options: RunLogicalGraphCompositionReportOptions,
	dependencies: LogicalGraphCompositionReportRuntimeDependencies
): Promise<LogicalGraphCompositionReportOutcome> {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(await runInternal(requestValue, options, progress, dependencies));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic('INTERNAL_FAILURE', 'The logical-graph-composition report failed closed.')
			])
		);
	}
}

export async function runLogicalGraphCompositionReport(
	requestValue: unknown,
	options: RunLogicalGraphCompositionReportOptions
): Promise<LogicalGraphCompositionReportOutcome> {
	return runLogicalGraphCompositionReportWithDependencies(
		requestValue,
		options,
		DEFAULT_DEPENDENCIES
	);
}

export function logicalGraphCompositionReportExitCode(
	outcome: LogicalGraphCompositionReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
