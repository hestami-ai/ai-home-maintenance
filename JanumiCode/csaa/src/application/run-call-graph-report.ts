import { isAbsolute } from 'node:path';

import {
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION,
	type CallGraphSnapshot
} from '../contracts/call-graph.js';
import {
	CALL_GRAPH_REPORT_AUTHORITY,
	CALL_GRAPH_REPORT_AUTHORITY_TRANSFER,
	CALL_GRAPH_REPORT_FULL_JAN_CSAA_CAPABILITY_005,
	CALL_GRAPH_REPORT_GATE_EFFECT,
	CALL_GRAPH_REPORT_NONCLAIMS,
	CALL_GRAPH_REPORT_OPERATION_VERSION,
	CALL_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
	CALL_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	CALL_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
	CALL_GRAPH_REPORT_SAFETY_CEILINGS,
	CALL_GRAPH_REPORT_SCHEMA_VERSION,
	CALL_GRAPH_REPORT_SELECTION,
	type CallGraphReportDiagnostic,
	type CallGraphReportFailureState,
	type CallGraphReportGraphBudgets,
	type CallGraphReportOutcome,
	type CallGraphReportRequest,
	type CallGraphReportStage,
	type CallGraphReportStageOutcomes
} from '../contracts/call-graph-report.js';
import { CALL_GRAPH_CAPABILITY, CALL_GRAPH_CAPABILITY_STATUS } from '../contracts/call-graph.js';
import {
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	type ProjectContextReportRequest
} from '../contracts/project-context-report.js';
import type { SubjectDiagnostic } from '../contracts/subject.js';
import {
	buildBoundedCallGraph,
	type BoundedCallGraphBuildDiagnostic
} from '../graph/build-call-graph.js';
import { validateCallGraph } from '../graph/validate-call-graph.js';
import {
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import { assertCanonicalRelativePath, repositoryRelativePath } from '../subject/paths.js';
import {
	admitProjectContextReportRequest,
	captureProjectContextReportPipeline,
	type ProjectContextReportPipelineCapture
} from './run-project-context-report.js';

const REQUEST_KEYS = [
	'budgets',
	'operationVersion',
	'schemaVersion',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = [
	'callGraph',
	'maxResultBytes',
	'projectContext',
	'semantic',
	'subject'
] as const;
const CALL_GRAPH_BUDGET_KEYS = [
	'maxClassificationSteps',
	'maxEdges',
	'maxLimitations',
	'maxNodes'
] as const satisfies readonly (keyof CallGraphReportGraphBudgets)[];
const MAX_DIAGNOSTIC_PATH_CHARACTERS = 10_000;

interface CallGraphReportAdmission {
	readonly callGraphBudgets: CallGraphReportGraphBudgets;
	readonly predecessorRequest: ProjectContextReportRequest;
}

export const CALL_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-call-graph-report-progress/0.1.0' as const;

export const CALL_GRAPH_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: CALL_GRAPH_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type CallGraphReportProgressPhase =
	'REQUEST_BIND' | 'PREDECESSOR_PIPELINE' | 'CALL_GRAPH' | 'CURRENTNESS' | 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	CALL_GRAPH: 'CALL_GRAPH',
	CURRENTNESS: 'CURRENTNESS',
	PREDECESSOR_PIPELINE: 'PREDECESSOR_PIPELINE',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT'
} as const satisfies Readonly<Record<CallGraphReportProgressPhase, CallGraphReportStage>>);

export type CallGraphReportProgressObservationMetric =
	| 'CALL_GRAPH_CALL_SITES'
	| 'CALL_GRAPH_CANDIDATE_TARGET_EDGES'
	| 'CALL_GRAPH_EDGES'
	| 'CALL_GRAPH_FRONTIERS'
	| 'CALL_GRAPH_LIMITATIONS'
	| 'CALL_GRAPH_NODES'
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'PREDECESSOR_PROJECT_CONTEXT_PROGRAMS'
	| 'PREDECESSOR_PROJECT_CONTEXT_PROJECTS'
	| 'PREDECESSOR_PROJECT_CONTEXT_SOURCES'
	| 'PREDECESSOR_SEMANTIC_AST_NODES'
	| 'PREDECESSOR_SEMANTIC_INVOCATIONS'
	| 'PREDECESSOR_SEMANTIC_SOURCES'
	| 'PREDECESSOR_SEMANTIC_TYPES'
	| 'PREDECESSOR_SUBJECT_ARTIFACTS'
	| 'PREDECESSOR_SUBJECT_PROJECTS'
	| 'RESULT_BYTES';

export interface CallGraphReportProgressObservation {
	readonly limit: number | null;
	readonly metric: CallGraphReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

export interface CallGraphReportProgressEvent {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly kind: 'REPORT_STAGE';
	readonly nonclaims: typeof CALL_GRAPH_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly CallGraphReportProgressObservation[];
	readonly operationVersion: typeof CALL_GRAPH_REPORT_OPERATION_VERSION;
	readonly phase: CallGraphReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_TYPESCRIPT_CALL_GRAPH_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof CALL_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: CallGraphReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED';
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

interface ProgressRecorder {
	complete(
		observations?: readonly CallGraphReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly CallGraphReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: CallGraphReportOutcome): CallGraphReportOutcome;
	start(
		phase: CallGraphReportProgressPhase,
		observations?: readonly CallGraphReportProgressObservation[]
	): void;
}

function observation(
	metric: CallGraphReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: CallGraphReportProgressObservation['unit'] = 'COUNT'
): CallGraphReportProgressObservation {
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
		// Rejected thenables are contained like synchronous observer exceptions.
	});
}

export interface RunCallGraphReportOptions {
	/** Trusted-host telemetry callback; excluded from terminal evidence and identity. */
	readonly onProgress?: (event: CallGraphReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

function createProgressRecorder(options: RunCallGraphReportOptions): ProgressRecorder {
	let sink: ((event: CallGraphReportProgressEvent) => unknown) | undefined;
	try {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		if (descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'function')
			sink = descriptor.value as (event: CallGraphReportProgressEvent) => unknown;
	} catch {
		// Observer inspection is best-effort and outside the evidence-producing path.
	}
	let active: CallGraphReportProgressPhase | null = null;
	let lastElapsedMs = 0;
	let origin: bigint | null = null;
	let sealed = false;
	let sequence = 0;
	if (sink !== undefined)
		try {
			origin = process.hrtime.bigint();
		} catch {
			origin = null;
		}

	const elapsed = (): number => {
		if (origin === null) return lastElapsedMs;
		try {
			const measured = Number(process.hrtime.bigint() - origin) / 1_000_000;
			if (Number.isFinite(measured)) lastElapsedMs = Math.max(lastElapsedMs, measured);
		} catch {
			// Retain the last monotonic observation.
		}
		return lastElapsedMs;
	};
	const emit = (
		phase: CallGraphReportProgressPhase,
		state: CallGraphReportProgressEvent['state'],
		observations: readonly CallGraphReportProgressObservation[],
		detailCode: string | null
	): void => {
		if (sink === undefined || sealed) return;
		sequence += 1;
		const event = Object.freeze({
			deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' as const,
			detailCode,
			elapsedMs: elapsed(),
			kind: 'REPORT_STAGE' as const,
			nonclaims: CALL_GRAPH_REPORT_PROGRESS_NONCLAIMS,
			observations: Object.freeze([...observations]),
			operationVersion: CALL_GRAPH_REPORT_OPERATION_VERSION,
			phase,
			protocolRole: 'PRELIMINARY_TYPESCRIPT_CALL_GRAPH_REPORT_TELEMETRY' as const,
			reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
			schemaVersion: CALL_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION,
			sequence,
			stage: PROGRESS_PHASE_STAGE[phase],
			state,
			wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET' as const
		});
		try {
			containRejectedObserverResult(sink(event));
		} catch {
			// Progress is a contained best-effort side channel.
		}
	};
	const close = (
		state: 'COMPLETED' | 'FAILED',
		observations: readonly CallGraphReportProgressObservation[] = [],
		detailCode: string | null = null
	): void => {
		if (active === null || sealed) return;
		const phase = active;
		active = null;
		emit(phase, state, observations, detailCode);
	};

	return {
		complete(observations = [], detailCode = null): void {
			close('COMPLETED', observations, detailCode);
		},
		fail(observations = [], detailCode = null): void {
			close('FAILED', observations, detailCode);
		},
		finish(outcome): CallGraphReportOutcome {
			if (active !== null) close('FAILED', [], 'INTERNAL_PROGRESS_INCOMPLETE');
			sealed = true;
			return outcome;
		},
		start(phase, observations = []): void {
			if (sealed) return;
			if (active !== null) close('FAILED', [], 'INTERNAL_PROGRESS_OVERLAP');
			active = phase;
			emit(phase, 'STARTED', observations, null);
		}
	};
}

class ReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly path: string,
		readonly state: CallGraphReportFailureState = 'incompatible'
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
		value <= 0
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

function materializeAdmission(value: unknown): CallGraphReportAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== CALL_GRAPH_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== CALL_GRAPH_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const graphRecord = exactDataRecord(
		budgets.callGraph,
		CALL_GRAPH_BUDGET_KEYS,
		'$.budgets.callGraph'
	);
	const callGraphBudgets = Object.freeze(
		Object.fromEntries(
			CALL_GRAPH_BUDGET_KEYS.map((key) => [
				key,
				boundedBudget(
					graphRecord[key],
					CALL_GRAPH_REPORT_SAFETY_CEILINGS.callGraph[key],
					`$.budgets.callGraph.${key}`
				)
			])
		) as unknown as CallGraphReportGraphBudgets
	);
	const predecessorAdmission = admitProjectContextReportRequest({
		budgets: {
			maxResultBytes: budgets.maxResultBytes,
			projectContext: budgets.projectContext,
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
	return Object.freeze({ callGraphBudgets, predecessorRequest: predecessorAdmission.request });
}

function materializedRequest(admission: CallGraphReportAdmission): CallGraphReportRequest {
	return Object.freeze({
		budgets: Object.freeze({
			...admission.predecessorRequest.budgets,
			callGraph: admission.callGraphBudgets
		}),
		operationVersion: CALL_GRAPH_REPORT_OPERATION_VERSION,
		schemaVersion: CALL_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: admission.predecessorRequest.subjectProjectConfigPaths
	});
}

function reportDiagnostic(
	code: string,
	message: string,
	path: string | null = null,
	phase: string | null = null,
	source: CallGraphReportDiagnostic['source'] = 'REPORT',
	severity: CallGraphReportDiagnostic['severity'] = null,
	predecessorSource: CallGraphReportDiagnostic['predecessorSource'] = null
): CallGraphReportDiagnostic {
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
	if (
		path.startsWith('$') &&
		path.length <= MAX_DIAGNOSTIC_PATH_CHARACTERS &&
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

function capturedPredecessorSource(
	source: ProjectContextReportPipelineCapture['diagnostics'][number]['source']
): CallGraphReportDiagnostic['predecessorSource'] {
	return source === 'CURRENTNESS' ? null : source;
}

function predecessorDiagnostics(
	capture: ProjectContextReportPipelineCapture
): CallGraphReportDiagnostic[] {
	return capture.diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, capture.repositoryRoot),
			safeDiagnosticPath(diagnostic.path, capture.repositoryRoot),
			diagnostic.phase,
			'PREDECESSOR_PIPELINE',
			diagnostic.severity,
			capturedPredecessorSource(diagnostic.source)
		)
	);
}

function unavailablePredecessorDiagnostics(
	diagnostics: readonly ProjectContextReportPipelineCapture['diagnostics'][number][]
): CallGraphReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			diagnostic.message,
			diagnostic.path,
			diagnostic.phase,
			'PREDECESSOR_PIPELINE',
			diagnostic.severity,
			capturedPredecessorSource(diagnostic.source)
		)
	);
}

function graphDiagnosticPath(path: string | null): string | null {
	if (path?.startsWith('$options.budgets.') === true)
		return path.replace('$options.budgets.', '$.budgets.callGraph.');
	return path;
}

function graphDiagnostics(
	diagnostics: readonly BoundedCallGraphBuildDiagnostic[],
	repositoryRoot: string
): CallGraphReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			safeDiagnosticPath(graphDiagnosticPath(diagnostic.path), repositoryRoot),
			diagnostic.phase,
			'CALL_GRAPH',
			diagnostic.code === 'GRAPH_PARTIAL' ? 'WARNING' : null
		)
	);
}

function failure(
	code: string,
	stage: CallGraphReportStage,
	state: CallGraphReportFailureState,
	diagnostics: readonly CallGraphReportDiagnostic[],
	request?: CallGraphReportRequest,
	subject?: ProjectContextReportPipelineCapture['frozenSubject']['descriptor']
): CallGraphReportOutcome {
	return {
		analysisAuthority: CALL_GRAPH_REPORT_AUTHORITY,
		authorityTransfer: CALL_GRAPH_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: CALL_GRAPH_REPORT_NONCLAIMS,
		gateEffect: CALL_GRAPH_REPORT_GATE_EFFECT,
		operationVersion: CALL_GRAPH_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: CALL_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: CALL_GRAPH_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

/** @internal Typed mapping retained for direct regression verification; not package-root exported. */
export function classifyCallGraphFailureState(
	diagnostics: readonly BoundedCallGraphBuildDiagnostic[]
): CallGraphReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXCEEDED'))
		return 'resource-refused';
	if (
		diagnostics.some(
			(diagnostic) =>
				diagnostic.code === 'REQUEST_INVALID' ||
				diagnostic.code === 'SEMANTIC_CAPABILITY_UNAVAILABLE'
		)
	)
		return 'incompatible';
	return 'failed';
}

function evidenceReconciles(
	capture: ProjectContextReportPipelineCapture,
	graph: CallGraphSnapshot
): boolean {
	const snapshot = capture.semanticSnapshot;
	const subjectId = capture.frozenSubject.descriptor.subjectId;
	const contextSources = new Map(
		capture.projectContextGraph.sources.map((source) => [source.semanticSourceId, source])
	);
	const semanticNodes = new Set(snapshot.astNodes.map((node) => node.id));
	const invocationIds = new Set(snapshot.invocations.map((invocation) => invocation.id));
	const callSites = graph.nodes.filter((node) => node.kind === 'CALL_SITE');
	const sourceRegions = graph.nodes.filter((node) => node.kind === 'SOURCE_REGION');
	const frontiers = graph.nodes.filter((node) => node.kind === 'FRONTIER');
	const callableTargets = graph.nodes.filter((node) => node.kind === 'CALLABLE_TARGET');
	const ownershipEdges = graph.edges.filter((edge) => edge.relationKind === 'CALL_SITE_OWNERSHIP');
	const targetEdges = graph.edges.filter((edge) => edge.relationKind !== 'CALL_SITE_OWNERSHIP');
	if (
		graph.subjectId !== subjectId ||
		graph.semanticSnapshotId !== snapshot.id ||
		capture.projectContextGraph.subjectId !== subjectId ||
		capture.projectContextGraph.semanticSnapshotId !== snapshot.id ||
		graph.health !== 'PARTIAL' ||
		graph.coverage.closure !== 'OPEN' ||
		graph.coverage.wholeProgramReachability !== 'NOT_CLAIMED' ||
		!graph.coverage.reconciles ||
		graph.coverage.expectedCallSites !== snapshot.invocations.length ||
		graph.coverage.representedCallSites !== callSites.length ||
		callSites.length !== snapshot.invocations.length ||
		new Set(callSites.map((node) => node.invocationId)).size !== invocationIds.size ||
		callSites.some((node) => !invocationIds.has(node.invocationId)) ||
		ownershipEdges.length !== callSites.length ||
		targetEdges.length < callSites.length ||
		graph.coverage.ownershipEdges !== ownershipEdges.length ||
		graph.coverage.targetEdges !== targetEdges.length ||
		graph.coverage.frontierNodes !== frontiers.length ||
		sourceRegions.length !== snapshot.sources.length ||
		contextSources.size !== capture.projectContextGraph.sources.length ||
		graph.forwardIndex.length !== graph.nodes.length ||
		graph.reverseIndex.length !== graph.nodes.length ||
		graph.forwardIndex.reduce((total, entry) => total + entry.edgeIds.length, 0) !==
			graph.edges.length ||
		graph.reverseIndex.reduce((total, entry) => total + entry.edgeIds.length, 0) !==
			graph.edges.length ||
		graph.layers[0].nodeIds.length !== graph.nodes.length ||
		graph.layers[0].edgeIds.length !== graph.edges.length ||
		graph.layers[0].limitations.length !== graph.limitations.length ||
		!snapshot.capabilities.some(
			(capability) => capability.capability === 'TS_TYPE' && capability.state !== 'UNSUPPORTED'
		)
	)
		return false;
	for (const node of graph.nodes) {
		if (
			node.subjectId !== subjectId ||
			node.semanticSnapshotId !== snapshot.id ||
			node.sourceLocations.some((location) => !contextSources.has(location.sourceId))
		)
			return false;
		if (node.kind === 'SOURCE_REGION') {
			const context = contextSources.get(node.semanticSourceId);
			if (
				context === undefined ||
				context.logicalPath !== node.logicalPath ||
				context.analysisDisposition !== node.analysisDisposition ||
				context.semanticProgramId !== node.programId ||
				context.semanticProjectId !== node.projectId
			)
				return false;
		}
		if (node.kind === 'CALLABLE_TARGET' && !semanticNodes.has(node.semanticNodeId)) return false;
	}
	return (
		callableTargets.every((node) => contextSources.has(node.sourceId)) &&
		graph.edges.every((edge) =>
			edge.sourceLocations.every((location) => contextSources.has(location.sourceId))
		) &&
		graph.limitations.every(
			(limitation) => limitation.sourceId === null || contextSources.has(limitation.sourceId)
		)
	);
}

function graphObservations(
	graph: CallGraphSnapshot,
	budgets: CallGraphReportGraphBudgets
): readonly CallGraphReportProgressObservation[] {
	return [
		observation('CALL_GRAPH_CALL_SITES', graph.coverage.representedCallSites, null),
		observation('CALL_GRAPH_CANDIDATE_TARGET_EDGES', graph.coverage.candidateTargetEdges, null),
		observation('CALL_GRAPH_EDGES', graph.edges.length, budgets.maxEdges),
		observation('CALL_GRAPH_FRONTIERS', graph.coverage.frontierNodes, null),
		observation('CALL_GRAPH_LIMITATIONS', graph.limitations.length, budgets.maxLimitations),
		observation('CALL_GRAPH_NODES', graph.nodes.length, budgets.maxNodes)
	];
}

function runInternal(
	requestValue: unknown,
	options: RunCallGraphReportOptions,
	progress: ProgressRecorder
): CallGraphReportOutcome {
	progress.start('REQUEST_BIND');
	let admission: CallGraphReportAdmission;
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
			reportDiagnostic('REQUEST_INVALID', 'The report request could not be inspected safely.', '$')
		]);
	}
	const request = materializedRequest(admission);
	progress.complete([], 'REQUEST_ADMITTED');

	progress.start('PREDECESSOR_PIPELINE');
	const predecessor = captureProjectContextReportPipeline(admission.predecessorRequest, {
		includeTypeCapability: true,
		repositoryRoot: options.repositoryRoot
	});
	if (predecessor.outcome !== 'captured') {
		progress.fail([], predecessor.code);
		return failure(
			predecessor.code,
			'PREDECESSOR_PIPELINE',
			predecessor.state,
			unavailablePredecessorDiagnostics(predecessor.diagnostics),
			request,
			predecessor.subject
		);
	}
	progress.complete(
		[
			observation(
				'PREDECESSOR_SUBJECT_ARTIFACTS',
				predecessor.frozenSubject.artifacts.length,
				request.budgets.subject.maxFiles
			),
			observation(
				'PREDECESSOR_SUBJECT_PROJECTS',
				predecessor.frozenSubject.projects.length,
				request.budgets.subject.maxProjects
			),
			observation(
				'PREDECESSOR_SEMANTIC_SOURCES',
				predecessor.semanticSnapshot.sources.length,
				request.budgets.semantic.maxSources
			),
			observation(
				'PREDECESSOR_SEMANTIC_AST_NODES',
				predecessor.semanticSnapshot.astNodes.length,
				request.budgets.semantic.maxAstNodes
			),
			observation(
				'PREDECESSOR_SEMANTIC_INVOCATIONS',
				predecessor.semanticSnapshot.invocations.length,
				null
			),
			observation(
				'PREDECESSOR_SEMANTIC_TYPES',
				predecessor.semanticSnapshot.types.length,
				request.budgets.semantic.maxCompilerFacts
			),
			observation(
				'PREDECESSOR_PROJECT_CONTEXT_PROJECTS',
				predecessor.projectContextGraph.projects.length,
				request.budgets.projectContext.maxProjects
			),
			observation(
				'PREDECESSOR_PROJECT_CONTEXT_PROGRAMS',
				predecessor.projectContextGraph.programs.length,
				request.budgets.projectContext.maxPrograms
			),
			observation(
				'PREDECESSOR_PROJECT_CONTEXT_SOURCES',
				predecessor.projectContextGraph.sources.length,
				request.budgets.projectContext.maxSources
			)
		],
		'CAP_010_PIPELINE_CAPTURED_WITH_TS_TYPE'
	);
	const inheritedDiagnostics = predecessorDiagnostics(predecessor);

	progress.start('CALL_GRAPH');
	const graphOutcome = buildBoundedCallGraph(
		{
			operationVersion: CALL_GRAPH_OPERATION_VERSION,
			schemaVersion: CALL_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: predecessor.semanticSnapshot.id,
			subjectId: predecessor.frozenSubject.descriptor.subjectId
		},
		predecessor.semanticSnapshot,
		{ budgets: request.budgets.callGraph }
	);
	const callGraphDiagnostics = graphDiagnostics(
		graphOutcome.diagnostics,
		predecessor.repositoryRoot
	);
	if (graphOutcome.outcome !== 'partial') {
		progress.fail([], graphOutcome.diagnostics[0]?.code ?? 'CALL_GRAPH_UNAVAILABLE');
		return failure(
			'CALL_GRAPH_UNAVAILABLE',
			'CALL_GRAPH',
			classifyCallGraphFailureState(graphOutcome.diagnostics),
			[...inheritedDiagnostics, ...callGraphDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const graph = graphOutcome.graph;
	const validation = validateCallGraph(graph, predecessor.semanticSnapshot, {
		maxIssues: Math.max(1, Math.min(1_000, request.budgets.semantic.maxDiagnostics))
	});
	if (validation.state !== 'VALID') {
		progress.fail(graphObservations(graph, request.budgets.callGraph), 'GRAPH_VALIDATION_FAILED');
		return failure(
			'GRAPH_VALIDATION_FAILED',
			'CALL_GRAPH',
			'failed',
			[
				...inheritedDiagnostics,
				...callGraphDiagnostics,
				...validation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, predecessor.repositoryRoot),
						safeDiagnosticPath(issue.path, predecessor.repositoryRoot),
						'VALIDATE',
						'CALL_GRAPH',
						'ERROR'
					)
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(graphObservations(graph, request.budgets.callGraph), 'PARTIAL_OPEN');

	progress.start('CURRENTNESS');
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		freshness = verifyFrozenSubject(predecessor.frozenSubject, {
			rootLocator: predecessor.repositoryRoot
		});
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
	const currentnessDiagnostics = freshness.diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, predecessor.repositoryRoot),
			safeDiagnosticPath(diagnostic.path, predecessor.repositoryRoot),
			diagnostic.phase,
			'CURRENTNESS',
			diagnostic.severity
		)
	);
	progress.complete(
		[observation('CURRENTNESS_CHANGED_PATHS', freshness.changedPaths.length, null)],
		currentnessState
	);

	progress.start('RESULT');
	if (!evidenceReconciles(predecessor, graph)) {
		progress.fail([], 'EVIDENCE_IDENTITY_MISMATCH');
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				...inheritedDiagnostics,
				...callGraphDiagnostics,
				...currentnessDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The call graph does not reconcile with its exact semantic and project-context evidence.'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const stageOutcomes: CallGraphReportStageOutcomes = {
		callGraph: {
			diagnosticCodes: graphOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial'
		},
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		predecessorPipeline: predecessor.predecessorStageOutcomes
	};
	const report: CallGraphReportOutcome = {
		analysisAuthority: CALL_GRAPH_REPORT_AUTHORITY,
		authorityTransfer: CALL_GRAPH_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [...inheritedDiagnostics, ...callGraphDiagnostics, ...currentnessDiagnostics],
		gateEffect: CALL_GRAPH_REPORT_GATE_EFFECT,
		operationVersion: CALL_GRAPH_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				fullJanCsaaCapability005CallGraph: CALL_GRAPH_REPORT_FULL_JAN_CSAA_CAPABILITY_005,
				id: CALL_GRAPH_CAPABILITY,
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				status: CALL_GRAPH_CAPABILITY_STATUS
			},
			coverage: {
				...graph.coverage,
				edges: graph.edges.length,
				health: graph.health,
				limitations: graph.limitations.length,
				nodes: graph.nodes.length
			},
			currentness: {
				changedPaths: freshness.changedPaths,
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			evidence: {
				callGraph: graph,
				coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN',
				encoding: 'FULL_VALIDATED_PROJECT_CONTEXT_AND_STATIC_CALL_GRAPH',
				projectContextGraph: predecessor.projectContextGraph
			},
			facadeNonclaims: CALL_GRAPH_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_OPEN_STATIC_CALL_GRAPH',
			predecessorNonclaims: CALL_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
			schemaVersion: CALL_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
			selection: CALL_GRAPH_REPORT_SELECTION,
			semanticSnapshotSummary: {
				astNodes: predecessor.semanticSnapshot.astNodes.length,
				id: predecessor.semanticSnapshot.id,
				invocations: predecessor.semanticSnapshot.invocations.length,
				programs: predecessor.semanticSnapshot.programs.length,
				projects: predecessor.semanticSnapshot.projects.length,
				sources: predecessor.semanticSnapshot.sources.length,
				types: predecessor.semanticSnapshot.types.length
			}
		},
		schemaVersion: CALL_GRAPH_REPORT_SCHEMA_VERSION,
		stageOutcomes,
		state: 'partial',
		subject: predecessor.frozenSubject.descriptor
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
						'The admitted call-graph report exceeds maxResultBytes.'
					)
				],
				request,
				predecessor.frozenSubject.descriptor
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
			predecessor.frozenSubject.descriptor
		);
	}
}

export function runCallGraphReport(
	requestValue: unknown,
	options: RunCallGraphReportOptions
): CallGraphReportOutcome {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(runInternal(requestValue, options, progress));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic('INTERNAL_FAILURE', 'The call-graph report failed closed.')
			])
		);
	}
}

export function callGraphReportExitCode(outcome: CallGraphReportOutcome): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
