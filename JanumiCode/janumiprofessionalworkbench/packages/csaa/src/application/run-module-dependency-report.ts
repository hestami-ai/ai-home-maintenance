import { isAbsolute } from 'node:path';

import {
	MODULE_DEPENDENCY_GRAPH_CAPABILITY,
	MODULE_DEPENDENCY_GRAPH_CAPABILITY_STATUS,
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type ModuleDependencyGraphBuildDiagnostic,
	type ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import {
	MODULE_DEPENDENCY_REPORT_AUTHORITY,
	MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER,
	MODULE_DEPENDENCY_REPORT_FULL_JAN_CSAA_CAPABILITY_004,
	MODULE_DEPENDENCY_REPORT_GATE_EFFECT,
	MODULE_DEPENDENCY_REPORT_NONCLAIMS,
	MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
	MODULE_DEPENDENCY_REPORT_PREDECESSOR_NONCLAIMS,
	MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION,
	MODULE_DEPENDENCY_REPORT_RESULT_SCHEMA_VERSION,
	MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS,
	MODULE_DEPENDENCY_REPORT_SCHEMA_VERSION,
	MODULE_DEPENDENCY_REPORT_SELECTION,
	type ModuleDependencyReportDiagnostic,
	type ModuleDependencyReportFailureState,
	type ModuleDependencyReportGraphBudgets,
	type ModuleDependencyReportOutcome,
	type ModuleDependencyReportRequest,
	type ModuleDependencyReportStage,
	type ModuleDependencyReportStageOutcomes
} from '../contracts/module-dependency-report.js';
import {
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	type ProjectContextReportRequest
} from '../contracts/project-context-report.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { SubjectDiagnostic } from '../contracts/subject.js';
import { buildModuleDependencyGraph } from '../graph/build-module-dependency-graph.js';
import { validateModuleDependencyGraph } from '../graph/validate-graph.js';
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
	'moduleDependency',
	'projectContext',
	'semantic',
	'subject'
] as const;
const MODULE_DEPENDENCY_BUDGET_KEYS = [
	'maxEdges',
	'maxLimitations',
	'maxNodes'
] as const satisfies readonly (keyof ModuleDependencyReportGraphBudgets)[];
const MAX_DIAGNOSTIC_PATH_CHARACTERS = 10_000;

interface ModuleDependencyReportAdmission {
	readonly moduleDependencyBudgets: ModuleDependencyReportGraphBudgets;
	readonly predecessorRequest: ProjectContextReportRequest;
}

interface ProjectedModuleDependencyPopulation {
	readonly edges: number;
	readonly limitations: number;
	readonly nodes: number;
}

export const MODULE_DEPENDENCY_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-module-dependency-report-progress/0.1.0' as const;

export const MODULE_DEPENDENCY_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: MODULE_DEPENDENCY_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type ModuleDependencyReportProgressPhase =
	'REQUEST_BIND' | 'PREDECESSOR_PIPELINE' | 'MODULE_DEPENDENCY' | 'CURRENTNESS' | 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	CURRENTNESS: 'CURRENTNESS',
	MODULE_DEPENDENCY: 'MODULE_DEPENDENCY',
	PREDECESSOR_PIPELINE: 'PREDECESSOR_PIPELINE',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT'
} as const satisfies Readonly<
	Record<ModuleDependencyReportProgressPhase, ModuleDependencyReportStage>
>);

export type ModuleDependencyReportProgressObservationMetric =
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'MODULE_DEPENDENCY_EDGES'
	| 'MODULE_DEPENDENCY_LIMITATIONS'
	| 'MODULE_DEPENDENCY_NODES'
	| 'PREDECESSOR_PROJECT_CONTEXT_PROGRAMS'
	| 'PREDECESSOR_PROJECT_CONTEXT_PROJECTS'
	| 'PREDECESSOR_PROJECT_CONTEXT_SOURCES'
	| 'PREDECESSOR_SEMANTIC_MODULE_RESOLUTIONS'
	| 'PREDECESSOR_SEMANTIC_SOURCES'
	| 'PREDECESSOR_SUBJECT_ARTIFACTS'
	| 'PREDECESSOR_SUBJECT_PROJECTS'
	| 'RESULT_BYTES';

export interface ModuleDependencyReportProgressObservation {
	readonly limit: number | null;
	readonly metric: ModuleDependencyReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

export interface ModuleDependencyReportProgressEvent {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly kind: 'REPORT_STAGE';
	readonly nonclaims: typeof MODULE_DEPENDENCY_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly ModuleDependencyReportProgressObservation[];
	readonly operationVersion: typeof MODULE_DEPENDENCY_REPORT_OPERATION_VERSION;
	readonly phase: ModuleDependencyReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_TYPESCRIPT_MODULE_DEPENDENCY_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof MODULE_DEPENDENCY_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: ModuleDependencyReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED';
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

interface ProgressRecorder {
	complete(
		observations?: readonly ModuleDependencyReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly ModuleDependencyReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: ModuleDependencyReportOutcome): ModuleDependencyReportOutcome;
	start(
		phase: ModuleDependencyReportProgressPhase,
		observations?: readonly ModuleDependencyReportProgressObservation[]
	): void;
}

function observation(
	metric: ModuleDependencyReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: ModuleDependencyReportProgressObservation['unit'] = 'COUNT'
): ModuleDependencyReportProgressObservation {
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

export interface RunModuleDependencyReportOptions {
	/** Trusted-host telemetry callback; excluded from terminal evidence and identity. */
	readonly onProgress?: (event: ModuleDependencyReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

function createProgressRecorder(options: RunModuleDependencyReportOptions): ProgressRecorder {
	let sink: ((event: ModuleDependencyReportProgressEvent) => unknown) | undefined;
	try {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		if (descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'function')
			sink = descriptor.value as (event: ModuleDependencyReportProgressEvent) => unknown;
	} catch {
		// Observer inspection is best-effort and outside the evidence-producing path.
	}
	let active: ModuleDependencyReportProgressPhase | null = null;
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
		phase: ModuleDependencyReportProgressPhase,
		state: ModuleDependencyReportProgressEvent['state'],
		observations: readonly ModuleDependencyReportProgressObservation[],
		detailCode: string | null
	): void => {
		if (sink === undefined || sealed) return;
		sequence += 1;
		const event = Object.freeze({
			deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' as const,
			detailCode,
			elapsedMs: elapsed(),
			kind: 'REPORT_STAGE' as const,
			nonclaims: MODULE_DEPENDENCY_REPORT_PROGRESS_NONCLAIMS,
			observations: Object.freeze([...observations]),
			operationVersion: MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
			phase,
			protocolRole: 'PRELIMINARY_TYPESCRIPT_MODULE_DEPENDENCY_REPORT_TELEMETRY' as const,
			reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
			schemaVersion: MODULE_DEPENDENCY_REPORT_PROGRESS_SCHEMA_VERSION,
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
		observations: readonly ModuleDependencyReportProgressObservation[] = [],
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
		finish(outcome): ModuleDependencyReportOutcome {
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
		readonly state: ModuleDependencyReportFailureState = 'incompatible'
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

function materializeAdmission(value: unknown): ModuleDependencyReportAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== MODULE_DEPENDENCY_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const graphRecord = exactDataRecord(
		budgets.moduleDependency,
		MODULE_DEPENDENCY_BUDGET_KEYS,
		'$.budgets.moduleDependency'
	);
	const moduleDependencyBudgets = Object.freeze(
		Object.fromEntries(
			MODULE_DEPENDENCY_BUDGET_KEYS.map((key) => [
				key,
				boundedBudget(
					graphRecord[key],
					MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS.moduleDependency[key],
					`$.budgets.moduleDependency.${key}`
				)
			])
		) as unknown as ModuleDependencyReportGraphBudgets
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
		moduleDependencyBudgets,
		predecessorRequest: predecessorAdmission.request
	});
}

function materializedRequest(
	admission: ModuleDependencyReportAdmission
): ModuleDependencyReportRequest {
	return Object.freeze({
		budgets: Object.freeze({
			...admission.predecessorRequest.budgets,
			moduleDependency: admission.moduleDependencyBudgets
		}),
		operationVersion: MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
		schemaVersion: MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: admission.predecessorRequest.subjectProjectConfigPaths
	});
}

function reportDiagnostic(
	code: string,
	message: string,
	path: string | null = null,
	phase: string | null = null,
	source: ModuleDependencyReportDiagnostic['source'] = 'REPORT',
	severity: ModuleDependencyReportDiagnostic['severity'] = null,
	predecessorSource: ModuleDependencyReportDiagnostic['predecessorSource'] = null
): ModuleDependencyReportDiagnostic {
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
): ModuleDependencyReportDiagnostic['predecessorSource'] {
	return source === 'CURRENTNESS' ? null : source;
}

function predecessorDiagnostics(
	capture: ProjectContextReportPipelineCapture
): ModuleDependencyReportDiagnostic[] {
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
): ModuleDependencyReportDiagnostic[] {
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
	diagnostics: readonly ModuleDependencyGraphBuildDiagnostic[],
	repositoryRoot: string
): ModuleDependencyReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			safeDiagnosticPath(diagnostic.path, repositoryRoot),
			diagnostic.phase,
			'MODULE_DEPENDENCY',
			diagnostic.code === 'GRAPH_PARTIAL' ? 'WARNING' : null
		)
	);
}

function failure(
	code: string,
	stage: ModuleDependencyReportStage,
	state: ModuleDependencyReportFailureState,
	diagnostics: readonly ModuleDependencyReportDiagnostic[],
	request?: ModuleDependencyReportRequest,
	subject?: ProjectContextReportPipelineCapture['frozenSubject']['descriptor']
): ModuleDependencyReportOutcome {
	return {
		analysisAuthority: MODULE_DEPENDENCY_REPORT_AUTHORITY,
		authorityTransfer: MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: MODULE_DEPENDENCY_REPORT_NONCLAIMS,
		gateEffect: MODULE_DEPENDENCY_REPORT_GATE_EFFECT,
		operationVersion: MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: MODULE_DEPENDENCY_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: MODULE_DEPENDENCY_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

const GRAPH_INCOMPATIBILITY_CODES = new Set<ModuleDependencyGraphBuildDiagnostic['code']>([
	'REQUEST_INVALID',
	'SEMANTIC_CAPABILITY_UNAVAILABLE'
]);

/** @internal Typed mapping retained for direct regression verification; not package-root exported. */
export function classifyModuleDependencyGraphFailureState(
	diagnostics: readonly ModuleDependencyGraphBuildDiagnostic[]
): ModuleDependencyReportFailureState {
	if (diagnostics.some((diagnostic) => GRAPH_INCOMPATIBILITY_CODES.has(diagnostic.code)))
		return 'incompatible';
	return 'failed';
}

/** @internal Exact builder-population preflight; not package-root exported. */
export function projectedModuleDependencyPopulation(
	snapshot: StaticSemanticSnapshot
): ProjectedModuleDependencyPopulation {
	let nonSourceTargetNodes = 0;
	let degradingResolutionLimitations = 0;
	for (const resolution of snapshot.moduleResolutions) {
		if (resolution.targetSourceId === null) nonSourceTargetNodes += 1;
		if (resolution.resolutionState !== 'RESOLVED_SOURCE') degradingResolutionLimitations += 1;
	}
	return Object.freeze({
		edges: snapshot.moduleResolutions.length,
		limitations: 1 + (snapshot.health === 'PARTIAL' ? 1 : 0) + degradingResolutionLimitations,
		nodes: snapshot.sources.length + nonSourceTargetNodes
	});
}

function populationBudgetDiagnostics(
	population: ProjectedModuleDependencyPopulation,
	budgets: ModuleDependencyReportGraphBudgets
): ModuleDependencyReportDiagnostic[] {
	return (['edges', 'limitations', 'nodes'] as const).flatMap((key) => {
		const budgetKey =
			`max${key[0]!.toUpperCase()}${key.slice(1)}` as keyof ModuleDependencyReportGraphBudgets;
		if (population[key] <= budgets[budgetKey]) return [];
		return [
			reportDiagnostic(
				'MODULE_DEPENDENCY_GRAPH_BUDGET_EXCEEDED',
				`The exact projected module-dependency ${key} population exceeds ${budgetKey}.`,
				`$.budgets.moduleDependency.${budgetKey}`,
				'PREFLIGHT',
				'MODULE_DEPENDENCY'
			)
		];
	});
}

function evidenceReconciles(
	capture: ProjectContextReportPipelineCapture,
	graph: ModuleDependencyGraphSnapshot,
	population: ProjectedModuleDependencyPopulation
): boolean {
	const subjectId = capture.frozenSubject.descriptor.subjectId;
	if (
		graph.subjectId !== subjectId ||
		graph.semanticSnapshotId !== capture.semanticSnapshot.id ||
		capture.projectContextGraph.subjectId !== subjectId ||
		capture.projectContextGraph.semanticSnapshotId !== capture.semanticSnapshot.id ||
		graph.fullJanCsaa007Conformance !== 'NOT_CLAIMED' ||
		!graph.coverage.reconciles ||
		graph.coverage.expectedSources !== capture.semanticSnapshot.sources.length ||
		graph.coverage.expectedModuleResolutions !==
			capture.semanticSnapshot.moduleResolutions.length ||
		graph.nodes.length !== population.nodes ||
		graph.edges.length !== population.edges ||
		graph.limitations.length !== population.limitations ||
		graph.forwardIndex.length !== population.nodes ||
		graph.reverseIndex.length !== population.nodes ||
		graph.forwardIndex.reduce((total, entry) => total + entry.edgeIds.length, 0) !==
			population.edges ||
		graph.reverseIndex.reduce((total, entry) => total + entry.edgeIds.length, 0) !==
			population.edges ||
		graph.layers[0].nodeIds.length !== population.nodes ||
		graph.layers[0].edgeIds.length !== population.edges ||
		graph.layers[0].limitations.length !== population.limitations ||
		(graph.coverage.closure === 'CLOSED') !== (graph.health === 'COMPLETE')
	)
		return false;
	const contextSources = new Map(
		capture.projectContextGraph.sources.map((source) => [source.semanticSourceId, source])
	);
	const contextPrograms = new Set(
		capture.projectContextGraph.programs.map((program) => program.semanticProgramId)
	);
	const contextProjects = new Set(
		capture.projectContextGraph.projects.map((project) => project.semanticProjectId)
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
		if (
			node.subjectId !== subjectId ||
			node.semanticSnapshotId !== capture.semanticSnapshot.id ||
			node.sourceLocations.some((location) => !contextSources.has(location.sourceId))
		)
			return false;
		if (node.kind === 'SOURCE') {
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
	}
	return (
		graph.edges.every((edge) =>
			edge.sourceLocations.every((location) => contextSources.has(location.sourceId))
		) &&
		graph.limitations.every(
			(limitation) => limitation.sourceId === null || contextSources.has(limitation.sourceId)
		)
	);
}

function runInternal(
	requestValue: unknown,
	options: RunModuleDependencyReportOptions,
	progress: ProgressRecorder
): ModuleDependencyReportOutcome {
	progress.start('REQUEST_BIND');
	let admission: ModuleDependencyReportAdmission;
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
				'PREDECESSOR_SEMANTIC_MODULE_RESOLUTIONS',
				predecessor.semanticSnapshot.moduleResolutions.length,
				null
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

	progress.start('MODULE_DEPENDENCY');
	const population = projectedModuleDependencyPopulation(predecessor.semanticSnapshot);
	const populationObservations = [
		observation(
			'MODULE_DEPENDENCY_EDGES',
			population.edges,
			request.budgets.moduleDependency.maxEdges
		),
		observation(
			'MODULE_DEPENDENCY_LIMITATIONS',
			population.limitations,
			request.budgets.moduleDependency.maxLimitations
		),
		observation(
			'MODULE_DEPENDENCY_NODES',
			population.nodes,
			request.budgets.moduleDependency.maxNodes
		)
	] as const;
	const budgetDiagnostics = populationBudgetDiagnostics(
		population,
		request.budgets.moduleDependency
	);
	if (budgetDiagnostics.length > 0) {
		progress.fail(populationObservations, 'MODULE_DEPENDENCY_GRAPH_BUDGET_EXCEEDED');
		return failure(
			'MODULE_DEPENDENCY_GRAPH_BUDGET_EXCEEDED',
			'MODULE_DEPENDENCY',
			'resource-refused',
			[...inheritedDiagnostics, ...budgetDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const graphOutcome = buildModuleDependencyGraph(
		{
			operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
			schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: predecessor.semanticSnapshot.id,
			subjectId: predecessor.frozenSubject.descriptor.subjectId
		},
		predecessor.semanticSnapshot
	);
	const moduleDiagnostics = graphDiagnostics(graphOutcome.diagnostics, predecessor.repositoryRoot);
	if (graphOutcome.outcome === 'unavailable') {
		progress.fail(populationObservations, graphOutcome.diagnostics[0]?.code ?? 'GRAPH_UNAVAILABLE');
		return failure(
			'MODULE_DEPENDENCY_GRAPH_UNAVAILABLE',
			'MODULE_DEPENDENCY',
			classifyModuleDependencyGraphFailureState(graphOutcome.diagnostics),
			[...inheritedDiagnostics, ...moduleDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const graph = graphOutcome.graph;
	const validation = validateModuleDependencyGraph(graph, predecessor.semanticSnapshot, {
		maxIssues: Math.max(1, Math.min(1_000, request.budgets.semantic.maxDiagnostics))
	});
	if (validation.state !== 'VALID') {
		progress.fail(populationObservations, 'GRAPH_VALIDATION_FAILED');
		return failure(
			'GRAPH_VALIDATION_FAILED',
			'MODULE_DEPENDENCY',
			'failed',
			[
				...inheritedDiagnostics,
				...moduleDiagnostics,
				...validation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, predecessor.repositoryRoot),
						safeDiagnosticPath(issue.path, predecessor.repositoryRoot),
						'VALIDATE',
						'MODULE_DEPENDENCY',
						'ERROR'
					)
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(populationObservations, graphOutcome.outcome.toUpperCase());

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
	if (!evidenceReconciles(predecessor, graph, population)) {
		progress.fail([], 'EVIDENCE_IDENTITY_MISMATCH');
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				...inheritedDiagnostics,
				...moduleDiagnostics,
				...currentnessDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The module-dependency graph does not reconcile with its exact semantic and project-context evidence.'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const stageOutcomes: ModuleDependencyReportStageOutcomes = {
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		moduleDependency: {
			diagnosticCodes: graphOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: graphOutcome.outcome
		},
		predecessorPipeline: predecessor.predecessorStageOutcomes
	};
	const report: ModuleDependencyReportOutcome = {
		analysisAuthority: MODULE_DEPENDENCY_REPORT_AUTHORITY,
		authorityTransfer: MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [...inheritedDiagnostics, ...moduleDiagnostics, ...currentnessDiagnostics],
		gateEffect: MODULE_DEPENDENCY_REPORT_GATE_EFFECT,
		operationVersion: MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				fullJanCsaaCapability004DependencyAnalysis:
					MODULE_DEPENDENCY_REPORT_FULL_JAN_CSAA_CAPABILITY_004,
				id: MODULE_DEPENDENCY_GRAPH_CAPABILITY,
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				status: MODULE_DEPENDENCY_GRAPH_CAPABILITY_STATUS
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
				coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN',
				encoding: 'FULL_VALIDATED_PROJECT_CONTEXT_AND_COMPILER_MODULE_DEPENDENCY_GRAPH',
				moduleDependencyGraph: graph,
				projectContextGraph: predecessor.projectContextGraph
			},
			facadeNonclaims: MODULE_DEPENDENCY_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_COMPILER_MODULE_DEPENDENCY_GRAPH',
			predecessorNonclaims: MODULE_DEPENDENCY_REPORT_PREDECESSOR_NONCLAIMS,
			schemaVersion: MODULE_DEPENDENCY_REPORT_RESULT_SCHEMA_VERSION,
			selection: MODULE_DEPENDENCY_REPORT_SELECTION,
			semanticSnapshotSummary: {
				id: predecessor.semanticSnapshot.id,
				moduleResolutions: predecessor.semanticSnapshot.moduleResolutions.length,
				programs: predecessor.semanticSnapshot.programs.length,
				projects: predecessor.semanticSnapshot.projects.length,
				sources: predecessor.semanticSnapshot.sources.length
			}
		},
		schemaVersion: MODULE_DEPENDENCY_REPORT_SCHEMA_VERSION,
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
						'The admitted module-dependency report exceeds maxResultBytes.'
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

export function runModuleDependencyReport(
	requestValue: unknown,
	options: RunModuleDependencyReportOptions
): ModuleDependencyReportOutcome {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(runInternal(requestValue, options, progress));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic('INTERNAL_FAILURE', 'The module-dependency report failed closed.')
			])
		);
	}
}

export function moduleDependencyReportExitCode(outcome: ModuleDependencyReportOutcome): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
