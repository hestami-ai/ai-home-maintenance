import { isAbsolute } from 'node:path';

import {
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	type ProjectContextReportRequest
} from '../contracts/project-context-report.js';
import {
	READ_WRITE_ACCESS_GRAPH_CAPABILITY,
	READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS,
	READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
	READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
	type ReadWriteAccessGraphBudgets,
	type ReadWriteAccessGraphBuildDiagnostic,
	type ReadWriteAccessGraphSnapshot
} from '../contracts/read-write-access-graph.js';
import {
	READ_WRITE_ACCESS_REPORT_AUTHORITY,
	READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER,
	READ_WRITE_ACCESS_REPORT_GATE_EFFECT,
	READ_WRITE_ACCESS_REPORT_NONCLAIMS,
	READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
	READ_WRITE_ACCESS_REPORT_PREDECESSOR_NONCLAIMS,
	READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION,
	READ_WRITE_ACCESS_REPORT_RESULT_SCHEMA_VERSION,
	READ_WRITE_ACCESS_REPORT_SAFETY_CEILINGS,
	READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION,
	READ_WRITE_ACCESS_REPORT_SELECTION,
	type ReadWriteAccessReportDiagnostic,
	type ReadWriteAccessReportFailureState,
	type ReadWriteAccessReportOutcome,
	type ReadWriteAccessReportRequest,
	type ReadWriteAccessReportStage,
	type ReadWriteAccessReportStageOutcomes
} from '../contracts/read-write-access-report.js';
import type { SubjectDiagnostic } from '../contracts/subject.js';
import { buildReadWriteAccessGraph } from '../graph/build-read-write-access-graph.js';
import { validateReadWriteAccessGraph } from '../graph/validate-read-write-access-graph.js';
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
	'maxResultBytes',
	'projectContext',
	'readWriteAccess',
	'semantic',
	'subject'
] as const;
const READ_WRITE_ACCESS_BUDGET_KEYS = [
	'maxAccesses',
	'maxEdges',
	'maxFrontiers',
	'maxNodes'
] as const satisfies readonly (keyof ReadWriteAccessGraphBudgets)[];
const MAX_DIAGNOSTIC_PATH_CHARACTERS = 10_000;

interface ReadWriteAccessReportAdmission {
	readonly predecessorRequest: ProjectContextReportRequest;
	readonly readWriteAccessBudgets: ReadWriteAccessGraphBudgets;
}

export const READ_WRITE_ACCESS_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-read-write-access-report-progress/0.1.0' as const;

export const READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: READ_WRITE_ACCESS_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type ReadWriteAccessReportProgressPhase =
	'REQUEST_BIND' | 'PREDECESSOR_PIPELINE' | 'READ_WRITE_ACCESS' | 'CURRENTNESS' | 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	CURRENTNESS: 'CURRENTNESS',
	PREDECESSOR_PIPELINE: 'PREDECESSOR_PIPELINE',
	READ_WRITE_ACCESS: 'READ_WRITE_ACCESS',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT'
} as const satisfies Readonly<
	Record<ReadWriteAccessReportProgressPhase, ReadWriteAccessReportStage>
>);

export type ReadWriteAccessReportProgressObservationMetric =
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'PREDECESSOR_PROJECT_CONTEXT_PROGRAMS'
	| 'PREDECESSOR_PROJECT_CONTEXT_PROJECTS'
	| 'PREDECESSOR_PROJECT_CONTEXT_SOURCES'
	| 'PREDECESSOR_SEMANTIC_SOURCES'
	| 'PREDECESSOR_SUBJECT_ARTIFACTS'
	| 'PREDECESSOR_SUBJECT_PROJECTS'
	| 'READ_WRITE_ACCESS_EDGES'
	| 'READ_WRITE_ACCESS_FRONTIERS'
	| 'READ_WRITE_ACCESS_NODES'
	| 'READ_WRITE_ACCESS_OCCURRENCES'
	| 'READ_WRITE_ACCESS_READS'
	| 'READ_WRITE_ACCESS_READ_WRITES'
	| 'READ_WRITE_ACCESS_SYMBOL_SLOTS'
	| 'READ_WRITE_ACCESS_WRITES'
	| 'RESULT_BYTES';

export interface ReadWriteAccessReportProgressObservation {
	readonly limit: number | null;
	readonly metric: ReadWriteAccessReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

export interface ReadWriteAccessReportProgressEvent {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly kind: 'REPORT_STAGE';
	readonly nonclaims: typeof READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly ReadWriteAccessReportProgressObservation[];
	readonly operationVersion: typeof READ_WRITE_ACCESS_REPORT_OPERATION_VERSION;
	readonly phase: ReadWriteAccessReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_TYPESCRIPT_READ_WRITE_ACCESS_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof READ_WRITE_ACCESS_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: ReadWriteAccessReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED';
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

interface ProgressRecorder {
	complete(
		observations?: readonly ReadWriteAccessReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly ReadWriteAccessReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: ReadWriteAccessReportOutcome): ReadWriteAccessReportOutcome;
	start(
		phase: ReadWriteAccessReportProgressPhase,
		observations?: readonly ReadWriteAccessReportProgressObservation[]
	): void;
}

function observation(
	metric: ReadWriteAccessReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: ReadWriteAccessReportProgressObservation['unit'] = 'COUNT'
): ReadWriteAccessReportProgressObservation {
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

export interface RunReadWriteAccessReportOptions {
	/** Trusted-host telemetry callback; excluded from terminal evidence and identity. */
	readonly onProgress?: (event: ReadWriteAccessReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

function createProgressRecorder(options: RunReadWriteAccessReportOptions): ProgressRecorder {
	let sink: ((event: ReadWriteAccessReportProgressEvent) => unknown) | undefined;
	try {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		if (descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'function')
			sink = descriptor.value as (event: ReadWriteAccessReportProgressEvent) => unknown;
	} catch {
		// Observer inspection is best-effort and outside the evidence-producing path.
	}
	let active: ReadWriteAccessReportProgressPhase | null = null;
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
		event: Omit<
			ReadWriteAccessReportProgressEvent,
			| 'deliverySemantics'
			| 'elapsedMs'
			| 'nonclaims'
			| 'operationVersion'
			| 'protocolRole'
			| 'reportIdentityEffect'
			| 'schemaVersion'
			| 'sequence'
			| 'wallClockBudgetEffect'
		>
	): void => {
		if (sink === undefined || sealed) return;
		try {
			sequence += 1;
			const materialized = Object.freeze({
				...event,
				deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' as const,
				elapsedMs: elapsed(),
				nonclaims: READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS,
				observations: Object.freeze([...event.observations]),
				operationVersion: READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
				protocolRole: 'PRELIMINARY_TYPESCRIPT_READ_WRITE_ACCESS_REPORT_TELEMETRY' as const,
				reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
				schemaVersion: READ_WRITE_ACCESS_REPORT_PROGRESS_SCHEMA_VERSION,
				sequence,
				wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET' as const
			});
			containRejectedObserverResult(sink(materialized));
		} catch {
			// Telemetry never changes terminal evidence.
		}
	};
	const close = (
		state: 'COMPLETED' | 'FAILED',
		observations: readonly ReadWriteAccessReportProgressObservation[],
		detailCode: string | null
	): void => {
		if (active === null) return;
		const phase = active;
		active = null;
		emit({
			detailCode,
			kind: 'REPORT_STAGE',
			observations,
			phase,
			stage: PROGRESS_PHASE_STAGE[phase],
			state
		});
	};

	return {
		complete(observations = [], detailCode = null): void {
			close('COMPLETED', observations, detailCode);
		},
		fail(observations = [], detailCode = null): void {
			close('FAILED', observations, detailCode);
		},
		finish(outcome): ReadWriteAccessReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			sealed = true;
			return outcome;
		},
		start(phase, observations = []): void {
			if (active !== null) close('FAILED', [], 'STAGE_INTERRUPTED');
			active = phase;
			emit({
				detailCode: null,
				kind: 'REPORT_STAGE',
				observations,
				phase,
				stage: PROGRESS_PHASE_STAGE[phase],
				state: 'STARTED'
			});
		}
	};
}

class ReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly path: string,
		readonly state: ReadWriteAccessReportFailureState = 'incompatible'
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

function materializeAdmission(value: unknown): ReadWriteAccessReportAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== READ_WRITE_ACCESS_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const readWriteAccessRecord = exactDataRecord(
		budgets.readWriteAccess,
		READ_WRITE_ACCESS_BUDGET_KEYS,
		'$.budgets.readWriteAccess'
	);
	const readWriteAccessBudgets = Object.freeze(
		Object.fromEntries(
			READ_WRITE_ACCESS_BUDGET_KEYS.map((key) => [
				key,
				boundedBudget(
					readWriteAccessRecord[key],
					READ_WRITE_ACCESS_REPORT_SAFETY_CEILINGS.readWriteAccess[key],
					`$.budgets.readWriteAccess.${key}`
				)
			])
		) as unknown as ReadWriteAccessGraphBudgets
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
	return Object.freeze({
		predecessorRequest: predecessorAdmission.request,
		readWriteAccessBudgets
	});
}

function materializedRequest(
	admission: ReadWriteAccessReportAdmission,
	predecessor: ProjectContextReportRequest
): ReadWriteAccessReportRequest {
	return Object.freeze({
		budgets: Object.freeze({
			...predecessor.budgets,
			readWriteAccess: admission.readWriteAccessBudgets
		}),
		operationVersion: READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
		schemaVersion: READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: predecessor.subjectProjectConfigPaths
	});
}

function reportDiagnostic(
	code: string,
	message: string,
	path: string | null = null,
	phase: string | null = null,
	source: ReadWriteAccessReportDiagnostic['source'] = 'REPORT',
	severity: ReadWriteAccessReportDiagnostic['severity'] = null,
	predecessorSource: ReadWriteAccessReportDiagnostic['predecessorSource'] = null
): ReadWriteAccessReportDiagnostic {
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
): ReadWriteAccessReportDiagnostic['predecessorSource'] {
	return source === 'CURRENTNESS' ? null : source;
}

function predecessorDiagnostics(
	capture: ProjectContextReportPipelineCapture
): ReadWriteAccessReportDiagnostic[] {
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
): ReadWriteAccessReportDiagnostic[] {
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

function graphDiagnostics(
	diagnostics: readonly ReadWriteAccessGraphBuildDiagnostic[],
	repositoryRoot: string
): ReadWriteAccessReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			safeDiagnosticPath(diagnostic.path, repositoryRoot),
			diagnostic.phase,
			'READ_WRITE_ACCESS'
		)
	);
}

function failure(
	code: string,
	stage: ReadWriteAccessReportStage,
	state: ReadWriteAccessReportFailureState,
	diagnostics: readonly ReadWriteAccessReportDiagnostic[],
	request?: ReadWriteAccessReportRequest,
	subject?: ProjectContextReportPipelineCapture['frozenSubject']['descriptor']
): ReadWriteAccessReportOutcome {
	return {
		analysisAuthority: READ_WRITE_ACCESS_REPORT_AUTHORITY,
		authorityTransfer: READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: READ_WRITE_ACCESS_REPORT_NONCLAIMS,
		gateEffect: READ_WRITE_ACCESS_REPORT_GATE_EFFECT,
		operationVersion: READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: READ_WRITE_ACCESS_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

const GRAPH_INCOMPATIBILITY_CODES = new Set<ReadWriteAccessGraphBuildDiagnostic['code']>([
	'REQUEST_INVALID',
	'SEMANTIC_CAPABILITY_UNAVAILABLE'
]);

/** @internal Typed mapping retained for direct regression verification; not package-root exported. */
export function classifyReadWriteAccessGraphFailureState(
	diagnostics: readonly ReadWriteAccessGraphBuildDiagnostic[]
): ReadWriteAccessReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXCEEDED'))
		return 'resource-refused';
	if (diagnostics.some((diagnostic) => GRAPH_INCOMPATIBILITY_CODES.has(diagnostic.code)))
		return 'incompatible';
	return 'failed';
}

function evidenceReconciles(
	capture: ProjectContextReportPipelineCapture,
	graph: ReadWriteAccessGraphSnapshot
): boolean {
	const subjectId = capture.frozenSubject.descriptor.subjectId;
	if (
		graph.subjectId !== subjectId ||
		graph.semanticSnapshotId !== capture.semanticSnapshot.id ||
		capture.projectContextGraph.subjectId !== subjectId ||
		capture.projectContextGraph.semanticSnapshotId !== capture.semanticSnapshot.id ||
		graph.capability !== READ_WRITE_ACCESS_GRAPH_CAPABILITY ||
		graph.capabilityStatus !== READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS ||
		graph.health !== 'PARTIAL' ||
		graph.coverage.closure !== 'OPEN' ||
		graph.fullJanCsaaCapability007DataFlow !== 'NOT_CLAIMED' ||
		!graph.coverage.reconciles
	)
		return false;
	const contextSources = new Map(
		capture.projectContextGraph.sources.map((source) => [source.semanticSourceId, source])
	);
	const contextPrograms = new Map(
		capture.projectContextGraph.programs.map((program) => [program.semanticProgramId, program])
	);
	const contextProjects = new Map(
		capture.projectContextGraph.projects.map((project) => [project.semanticProjectId, project])
	);
	if (
		contextSources.size !== capture.projectContextGraph.sources.length ||
		contextPrograms.size !== capture.projectContextGraph.programs.length ||
		contextProjects.size !== capture.projectContextGraph.projects.length ||
		capture.semanticSnapshot.sources.some((source) => !contextSources.has(source.id)) ||
		capture.semanticSnapshot.programs.some((program) => !contextPrograms.has(program.id)) ||
		capture.semanticSnapshot.projects.some((project) => !contextProjects.has(project.id))
	)
		return false;
	for (const node of graph.nodes) {
		if (node.subjectId !== subjectId || node.semanticSnapshotId !== capture.semanticSnapshot.id)
			return false;
		if (node.sourceLocations.some((location) => !contextSources.has(location.sourceId)))
			return false;
		if (node.kind === 'SYMBOL_SLOT') {
			if (!contextPrograms.has(node.programId) || !contextProjects.has(node.projectId))
				return false;
		} else if (!contextSources.has(node.sourceId)) return false;
	}
	return (
		graph.coverage.accessOccurrences ===
			graph.nodes.filter((node) => node.kind === 'ACCESS_OCCURRENCE').length &&
		graph.coverage.frontierNodes ===
			graph.nodes.filter((node) => node.kind === 'FRONTIER').length &&
		graph.coverage.symbolSlots ===
			graph.nodes.filter((node) => node.kind === 'SYMBOL_SLOT').length &&
		graph.coverage.edges === graph.edges.length
	);
}

function runInternal(
	requestValue: unknown,
	options: RunReadWriteAccessReportOptions,
	progress: ProgressRecorder
): ReadWriteAccessReportOutcome {
	progress.start('REQUEST_BIND');
	let admission: ReadWriteAccessReportAdmission;
	try {
		admission = materializeAdmission(requestValue);
	} catch (error) {
		if (error instanceof ReportRequestError)
			return failure(error.code, 'REQUEST', error.state, [
				reportDiagnostic(error.code, error.message, error.path, 'REQUEST')
			]);
		return failure('REQUEST_INVALID', 'REQUEST', 'incompatible', [
			reportDiagnostic('REQUEST_INVALID', 'The report request could not be inspected safely.', '$')
		]);
	}
	const request = materializedRequest(admission, admission.predecessorRequest);
	progress.complete([], 'REQUEST_ADMITTED');

	progress.start('PREDECESSOR_PIPELINE');
	const predecessor = captureProjectContextReportPipeline(admission.predecessorRequest, {
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
		'CAP_010_PIPELINE_CAPTURED'
	);
	const inheritedDiagnostics = predecessorDiagnostics(predecessor);

	progress.start('READ_WRITE_ACCESS');
	const graphOutcome = buildReadWriteAccessGraph(
		{
			budgets: request.budgets.readWriteAccess,
			operationVersion: READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
			schemaVersion: READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: predecessor.semanticSnapshot.id,
			subjectId: predecessor.frozenSubject.descriptor.subjectId
		},
		predecessor.semanticSnapshot
	);
	const readWriteDiagnostics = graphDiagnostics(
		graphOutcome.diagnostics,
		predecessor.repositoryRoot
	);
	if (graphOutcome.outcome !== 'partial') {
		progress.fail([], graphOutcome.diagnostics[0]?.code ?? 'READ_WRITE_ACCESS_UNAVAILABLE');
		return failure(
			'READ_WRITE_ACCESS_UNAVAILABLE',
			'READ_WRITE_ACCESS',
			classifyReadWriteAccessGraphFailureState(graphOutcome.diagnostics),
			[...inheritedDiagnostics, ...readWriteDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const graph = graphOutcome.graph;
	const validation = validateReadWriteAccessGraph(graph, predecessor.semanticSnapshot, {
		maxIssues: Math.max(1, Math.min(1_000, request.budgets.semantic.maxDiagnostics)),
		maxRecords: predecessor.semanticSnapshot.budgets.maxSnapshotBytes,
		maxStringCharacters: predecessor.semanticSnapshot.budgets.maxSnapshotBytes
	});
	if (validation.state !== 'VALID') {
		progress.fail([], 'GRAPH_VALIDATION_FAILED');
		const validationDiagnostics = validation.issues.map((issue) =>
			reportDiagnostic(
				issue.code,
				redactRoot(issue.message, predecessor.repositoryRoot),
				safeDiagnosticPath(issue.path, predecessor.repositoryRoot),
				'VALIDATE',
				'READ_WRITE_ACCESS'
			)
		);
		return failure(
			'GRAPH_VALIDATION_FAILED',
			'READ_WRITE_ACCESS',
			'failed',
			[...inheritedDiagnostics, ...readWriteDiagnostics, ...validationDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(
		[
			observation(
				'READ_WRITE_ACCESS_OCCURRENCES',
				graph.coverage.accessOccurrences,
				request.budgets.readWriteAccess.maxAccesses
			),
			observation(
				'READ_WRITE_ACCESS_EDGES',
				graph.edges.length,
				request.budgets.readWriteAccess.maxEdges
			),
			observation(
				'READ_WRITE_ACCESS_FRONTIERS',
				graph.coverage.frontierNodes,
				request.budgets.readWriteAccess.maxFrontiers
			),
			observation(
				'READ_WRITE_ACCESS_NODES',
				graph.nodes.length,
				request.budgets.readWriteAccess.maxNodes
			),
			observation('READ_WRITE_ACCESS_READS', graph.coverage.readAccesses, null),
			observation('READ_WRITE_ACCESS_WRITES', graph.coverage.writeAccesses, null),
			observation('READ_WRITE_ACCESS_READ_WRITES', graph.coverage.readWriteAccesses, null),
			observation('READ_WRITE_ACCESS_SYMBOL_SLOTS', graph.coverage.symbolSlots, null)
		],
		'PARTIAL_OPEN'
	);

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
				...readWriteDiagnostics,
				...currentnessDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The read/write-access graph does not reconcile with its exact semantic and project-context evidence.'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const stageOutcomes: ReadWriteAccessReportStageOutcomes = {
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		predecessorPipeline: predecessor.predecessorStageOutcomes,
		readWriteAccess: {
			diagnosticCodes: graphOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial'
		}
	};
	const report: ReadWriteAccessReportOutcome = {
		analysisAuthority: READ_WRITE_ACCESS_REPORT_AUTHORITY,
		authorityTransfer: READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [...inheritedDiagnostics, ...readWriteDiagnostics, ...currentnessDiagnostics],
		gateEffect: READ_WRITE_ACCESS_REPORT_GATE_EFFECT,
		operationVersion: READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				fullJanCsaaCapability007DataFlow: graph.fullJanCsaaCapability007DataFlow,
				id: READ_WRITE_ACCESS_GRAPH_CAPABILITY,
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				status: READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS
			},
			coverage: {
				accessOccurrences: graph.coverage.accessOccurrences,
				closure: graph.coverage.closure,
				edges: graph.coverage.edges,
				frontierNodes: graph.coverage.frontierNodes,
				readAccesses: graph.coverage.readAccesses,
				readWriteAccesses: graph.coverage.readWriteAccesses,
				reconciles: graph.coverage.reconciles,
				symbolSlots: graph.coverage.symbolSlots,
				writeAccesses: graph.coverage.writeAccesses
			},
			currentness: {
				changedPaths: freshness.changedPaths,
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			evidence: {
				coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN',
				encoding: 'FULL_VALIDATED_PROJECT_CONTEXT_AND_PROGRAM_LOCAL_READ_WRITE_ACCESS_GRAPH',
				projectContextGraph: predecessor.projectContextGraph,
				readWriteAccessGraph: graph
			},
			facadeNonclaims: READ_WRITE_ACCESS_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_PROGRAM_LOCAL_READ_WRITE_ACCESS_GRAPH',
			predecessorNonclaims: READ_WRITE_ACCESS_REPORT_PREDECESSOR_NONCLAIMS,
			schemaVersion: READ_WRITE_ACCESS_REPORT_RESULT_SCHEMA_VERSION,
			selection: READ_WRITE_ACCESS_REPORT_SELECTION,
			semanticSnapshotSummary: {
				id: predecessor.semanticSnapshot.id,
				programs: predecessor.semanticSnapshot.programs.length,
				projects: predecessor.semanticSnapshot.projects.length,
				sources: predecessor.semanticSnapshot.sources.length
			}
		},
		schemaVersion: READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION,
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
						'The admitted read/write-access report exceeds maxResultBytes.'
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

export function runReadWriteAccessReport(
	requestValue: unknown,
	options: RunReadWriteAccessReportOptions
): ReadWriteAccessReportOutcome {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(runInternal(requestValue, options, progress));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic('INTERNAL_FAILURE', 'The read/write-access report failed closed.')
			])
		);
	}
}

export function readWriteAccessReportExitCode(outcome: ReadWriteAccessReportOutcome): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
