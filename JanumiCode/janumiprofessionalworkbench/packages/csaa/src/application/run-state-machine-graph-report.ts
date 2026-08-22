import { isAbsolute } from 'node:path';

import {
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_SCOPE,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
	type StateMachineGraphBuildDiagnostic,
	type StateMachineGraphBudgets,
	type StateMachineGraphSnapshot,
	type StateMachineGraphSourceSelector,
	type StateMachineTopologyObservation,
	type StateMachineTopologyObservationBudgets,
	type StateMachineTopologyObservationDiagnostic
} from '../contracts/state-machine-graph.js';
import {
	STATE_MACHINE_GRAPH_REPORT_AUTHORITY,
	STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER,
	STATE_MACHINE_GRAPH_REPORT_FULL_JAN_CSAA_CAPABILITY_027,
	STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT,
	STATE_MACHINE_GRAPH_REPORT_NONCLAIMS,
	STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
	STATE_MACHINE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_REPORT_SAFETY_CEILINGS,
	STATE_MACHINE_GRAPH_REPORT_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_REPORT_SELECTION,
	type StateMachineGraphReportDiagnostic,
	type StateMachineGraphReportFailureState,
	type StateMachineGraphReportOutcome,
	type StateMachineGraphReportRequest,
	type StateMachineGraphReportSourceSelector,
	type StateMachineGraphReportStage,
	type StateMachineGraphReportStageOutcomes
} from '../contracts/state-machine-graph-report.js';
import {
	STATE_MACHINE_GRAPH_CAPABILITY,
	STATE_MACHINE_GRAPH_CAPABILITY_STATUS,
	STATE_MACHINE_GRAPH_REGISTRY_STATUS,
	STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY
} from '../contracts/state-machine-graph.js';
import {
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	type ProjectContextReportRequest
} from '../contracts/project-context-report.js';
import type { SubjectDiagnostic } from '../contracts/subject.js';
import { buildStateMachineGraph } from '../graph/build-state-machine-graph.js';
import { validateStateMachineGraph } from '../graph/validate-state-machine-graph.js';
import { observeStateMachineTopology } from '../providers/jpwb-state-machines/observe-state-machines.js';
import { validateStateMachineTopologyObservation } from '../providers/jpwb-state-machines/validate-state-machine-observation.js';
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
	'source',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = [
	'maxResultBytes',
	'projectContext',
	'semantic',
	'stateMachineGraph',
	'subject',
	'topologyObservation'
] as const;
const STATE_MACHINE_GRAPH_BUDGET_KEYS = [
	'maxEdges',
	'maxNodes'
] as const satisfies readonly (keyof StateMachineGraphBudgets)[];
const TOPOLOGY_OBSERVATION_BUDGET_KEYS = [
	'maxAstNodes',
	'maxCrossAxisRules',
	'maxDiagnostics',
	'maxMachines',
	'maxSourceBytes',
	'maxStates',
	'maxTextCharacters',
	'maxTransitions'
] as const satisfies readonly (keyof StateMachineTopologyObservationBudgets)[];
const FORBIDDEN_PATH_PATTERN_CHARACTERS = new Set(['*', '?', '[', ']', '{', '}']);
const MAX_DIAGNOSTIC_PATH_CHARACTERS = 10_000;

interface StateMachineGraphReportAdmission {
	readonly stateMachineGraphBudgets: StateMachineGraphBudgets;
	readonly predecessorRequest: ProjectContextReportRequest;
	readonly source: StateMachineGraphReportSourceSelector;
	readonly topologyObservationBudgets: StateMachineTopologyObservationBudgets;
}

export const STATE_MACHINE_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-state-machine-graph-report-progress/0.1.0' as const;

export const STATE_MACHINE_GRAPH_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: STATE_MACHINE_GRAPH_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type StateMachineGraphReportProgressPhase =
	| 'REQUEST_BIND'
	| 'PREDECESSOR_PIPELINE'
	| 'TOPOLOGY_OBSERVATION'
	| 'STATE_MACHINE_GRAPH'
	| 'CURRENTNESS'
	| 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	STATE_MACHINE_GRAPH: 'STATE_MACHINE_GRAPH',
	CURRENTNESS: 'CURRENTNESS',
	PREDECESSOR_PIPELINE: 'PREDECESSOR_PIPELINE',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT',
	TOPOLOGY_OBSERVATION: 'TOPOLOGY_OBSERVATION'
} as const satisfies Readonly<
	Record<StateMachineGraphReportProgressPhase, StateMachineGraphReportStage>
>);

export type StateMachineGraphReportProgressObservationMetric =
	| 'STATE_MACHINE_GRAPH_EDGES'
	| 'STATE_MACHINE_GRAPH_MACHINE_NODES'
	| 'STATE_MACHINE_GRAPH_LIMITATIONS'
	| 'STATE_MACHINE_GRAPH_NODES'
	| 'STATE_MACHINE_GRAPH_STATE_NODES'
	| 'TOPOLOGY_ARTIFACT_BYTES'
	| 'TOPOLOGY_CROSS_AXIS_RULES'
	| 'TOPOLOGY_EXPLICITLY_ILLEGAL_TRANSITIONS'
	| 'TOPOLOGY_GUARDED_TRANSITIONS'
	| 'TOPOLOGY_LEGAL_TRANSITIONS'
	| 'TOPOLOGY_MACHINES'
	| 'TOPOLOGY_STATES'
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

export interface StateMachineGraphReportProgressObservation {
	readonly limit: number | null;
	readonly metric: StateMachineGraphReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

export interface StateMachineGraphReportProgressEvent {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly kind: 'REPORT_STAGE';
	readonly nonclaims: typeof STATE_MACHINE_GRAPH_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly StateMachineGraphReportProgressObservation[];
	readonly operationVersion: typeof STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION;
	readonly phase: StateMachineGraphReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_TYPESCRIPT_STATE_MACHINE_GRAPH_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof STATE_MACHINE_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: StateMachineGraphReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED';
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

interface ProgressRecorder {
	complete(
		observations?: readonly StateMachineGraphReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly StateMachineGraphReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: StateMachineGraphReportOutcome): StateMachineGraphReportOutcome;
	start(
		phase: StateMachineGraphReportProgressPhase,
		observations?: readonly StateMachineGraphReportProgressObservation[]
	): void;
}

function observation(
	metric: StateMachineGraphReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: StateMachineGraphReportProgressObservation['unit'] = 'COUNT'
): StateMachineGraphReportProgressObservation {
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

export interface RunStateMachineGraphReportOptions {
	/** Trusted-host telemetry callback; excluded from terminal evidence and identity. */
	readonly onProgress?: (event: StateMachineGraphReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

function createProgressRecorder(options: RunStateMachineGraphReportOptions): ProgressRecorder {
	let sink: ((event: StateMachineGraphReportProgressEvent) => unknown) | undefined;
	try {
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		if (descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'function')
			sink = descriptor.value as (event: StateMachineGraphReportProgressEvent) => unknown;
	} catch {
		// Observer inspection is best-effort and outside the evidence-producing path.
	}
	let active: StateMachineGraphReportProgressPhase | null = null;
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
		phase: StateMachineGraphReportProgressPhase,
		state: StateMachineGraphReportProgressEvent['state'],
		observations: readonly StateMachineGraphReportProgressObservation[],
		detailCode: string | null
	): void => {
		if (sink === undefined || sealed) return;
		sequence += 1;
		const event = Object.freeze({
			deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' as const,
			detailCode,
			elapsedMs: elapsed(),
			kind: 'REPORT_STAGE' as const,
			nonclaims: STATE_MACHINE_GRAPH_REPORT_PROGRESS_NONCLAIMS,
			observations: Object.freeze([...observations]),
			operationVersion: STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION,
			phase,
			protocolRole: 'PRELIMINARY_TYPESCRIPT_STATE_MACHINE_GRAPH_REPORT_TELEMETRY' as const,
			reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
			schemaVersion: STATE_MACHINE_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION,
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
		observations: readonly StateMachineGraphReportProgressObservation[] = [],
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
		finish(outcome): StateMachineGraphReportOutcome {
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
		readonly state: StateMachineGraphReportFailureState = 'incompatible'
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

function canonicalRequestPath(value: unknown, maxPathCharacters: number, path: string): string {
	if (typeof value !== 'string' || value.length === 0 || !isUnicodeScalarString(value))
		throw new ReportRequestError(
			'REQUEST_PATH_INVALID',
			`${path} must be nonempty Unicode text.`,
			path
		);
	if (value.length > maxPathCharacters)
		throw new ReportRequestError(
			'REQUEST_PATH_BUDGET_EXCEEDED',
			`${path} exceeds the caller path-character budget.`,
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
			`${path} must be a canonical repository-relative path.`,
			path
		);
	}
}

function materializeAdmission(value: unknown): StateMachineGraphReportAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== STATE_MACHINE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const graphRecord = exactDataRecord(
		budgets.stateMachineGraph,
		STATE_MACHINE_GRAPH_BUDGET_KEYS,
		'$.budgets.stateMachineGraph'
	);
	const stateMachineGraphBudgets = Object.freeze(
		Object.fromEntries(
			STATE_MACHINE_GRAPH_BUDGET_KEYS.map((key) => [
				key,
				boundedBudget(
					graphRecord[key],
					STATE_MACHINE_GRAPH_REPORT_SAFETY_CEILINGS.stateMachineGraph[key],
					`$.budgets.stateMachineGraph.${key}`
				)
			])
		) as unknown as StateMachineGraphBudgets
	);
	const observationRecord = exactDataRecord(
		budgets.topologyObservation,
		TOPOLOGY_OBSERVATION_BUDGET_KEYS,
		'$.budgets.topologyObservation'
	);
	const topologyObservationBudgets = Object.freeze(
		Object.fromEntries(
			TOPOLOGY_OBSERVATION_BUDGET_KEYS.map((key) => [
				key,
				boundedBudget(
					observationRecord[key],
					STATE_MACHINE_GRAPH_REPORT_SAFETY_CEILINGS.topologyObservation[key],
					`$.budgets.topologyObservation.${key}`
				)
			])
		) as unknown as StateMachineTopologyObservationBudgets
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
	const sourceRecord = exactDataRecord(
		record.source,
		['logicalPath', 'projectConfigPath'],
		'$.source'
	);
	const maxPathCharacters = predecessorAdmission.request.budgets.semantic.maxPathCharacters;
	const source = Object.freeze({
		logicalPath: canonicalRequestPath(
			sourceRecord.logicalPath,
			maxPathCharacters,
			'$.source.logicalPath'
		),
		projectConfigPath: canonicalRequestPath(
			sourceRecord.projectConfigPath,
			maxPathCharacters,
			'$.source.projectConfigPath'
		)
	});
	if (!predecessorAdmission.request.subjectProjectConfigPaths.includes(source.projectConfigPath))
		throw new ReportRequestError(
			'SOURCE_PROJECT_NOT_SELECTED',
			'$.source.projectConfigPath must be included in $.subjectProjectConfigPaths.',
			'$.source.projectConfigPath'
		);
	return Object.freeze({
		predecessorRequest: predecessorAdmission.request,
		source,
		stateMachineGraphBudgets,
		topologyObservationBudgets
	});
}

function materializedRequest(
	admission: StateMachineGraphReportAdmission
): StateMachineGraphReportRequest {
	return Object.freeze({
		budgets: Object.freeze({
			...admission.predecessorRequest.budgets,
			stateMachineGraph: admission.stateMachineGraphBudgets,
			topologyObservation: admission.topologyObservationBudgets
		}),
		operationVersion: STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
		source: admission.source,
		subjectProjectConfigPaths: admission.predecessorRequest.subjectProjectConfigPaths
	});
}

function reportDiagnostic(
	code: string,
	message: string,
	path: string | null = null,
	phase: string | null = null,
	source: StateMachineGraphReportDiagnostic['source'] = 'REPORT',
	severity: StateMachineGraphReportDiagnostic['severity'] = null,
	predecessorSource: StateMachineGraphReportDiagnostic['predecessorSource'] = null
): StateMachineGraphReportDiagnostic {
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
): StateMachineGraphReportDiagnostic['predecessorSource'] {
	return source === 'CURRENTNESS' ? null : source;
}

function predecessorDiagnostics(
	capture: ProjectContextReportPipelineCapture
): StateMachineGraphReportDiagnostic[] {
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
): StateMachineGraphReportDiagnostic[] {
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
	if (path === '$.budgets') return '$.budgets.stateMachineGraph';
	return path;
}

function graphDiagnostics(
	diagnostics: readonly StateMachineGraphBuildDiagnostic[],
	repositoryRoot: string
): StateMachineGraphReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			safeDiagnosticPath(graphDiagnosticPath(diagnostic.path), repositoryRoot),
			diagnostic.phase,
			'STATE_MACHINE_GRAPH',
			diagnostic.code === 'GRAPH_PARTIAL' ? 'WARNING' : null
		)
	);
}

function observationDiagnosticPath(path: string | null): string | null {
	if (path === '$.budgets') return '$.budgets.topologyObservation';
	if (path?.startsWith('$.budgets.') === true)
		return path.replace('$.budgets.', '$.budgets.topologyObservation.');
	return path;
}

function observationDiagnostics(
	diagnostics: readonly StateMachineTopologyObservationDiagnostic[],
	repositoryRoot: string
): StateMachineGraphReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			safeDiagnosticPath(observationDiagnosticPath(diagnostic.path), repositoryRoot),
			diagnostic.phase,
			'TOPOLOGY_OBSERVATION'
		)
	);
}

function failure(
	code: string,
	stage: StateMachineGraphReportStage,
	state: StateMachineGraphReportFailureState,
	diagnostics: readonly StateMachineGraphReportDiagnostic[],
	request?: StateMachineGraphReportRequest,
	subject?: ProjectContextReportPipelineCapture['frozenSubject']['descriptor']
): StateMachineGraphReportOutcome {
	return {
		analysisAuthority: STATE_MACHINE_GRAPH_REPORT_AUTHORITY,
		authorityTransfer: STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: STATE_MACHINE_GRAPH_REPORT_NONCLAIMS,
		gateEffect: STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT,
		operationVersion: STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: STATE_MACHINE_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: STATE_MACHINE_GRAPH_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

/** @internal Typed mapping retained for direct regression verification; not package-root exported. */
export function classifyStateMachineGraphFailureState(
	diagnostics: readonly StateMachineGraphBuildDiagnostic[]
): StateMachineGraphReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXHAUSTED'))
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

/** @internal Typed mapping retained for direct regression verification; not package-root exported. */
export function classifyStateMachineObservationFailureState(
	diagnostics: readonly StateMachineTopologyObservationDiagnostic[]
): StateMachineGraphReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXHAUSTED'))
		return 'resource-refused';
	if (
		diagnostics.some(
			(diagnostic) =>
				diagnostic.code === 'REQUEST_INVALID' ||
				diagnostic.code === 'MALFORMED_GENERATED_TABLE' ||
				diagnostic.code === 'SUBJECT_CAPABILITY_UNAVAILABLE' ||
				diagnostic.code === 'UNSUPPORTED_GENERATED_TABLE'
		)
	)
		return 'incompatible';
	return 'failed';
}

interface SelectedStateMachineSource {
	readonly artifact: ProjectContextReportPipelineCapture['frozenSubject']['artifacts'][number];
	readonly graphSelector: StateMachineGraphSourceSelector;
	readonly semanticSource: ProjectContextReportPipelineCapture['semanticSnapshot']['sources'][number];
}

function selectStateMachineSource(
	capture: ProjectContextReportPipelineCapture,
	selector: StateMachineGraphReportSourceSelector
): SelectedStateMachineSource | null {
	const artifacts = capture.frozenSubject.artifacts.filter(
		(artifact) =>
			artifact.path === selector.logicalPath &&
			artifact.disposition === 'ANALYZED' &&
			artifact.primaryClass === 'GENERATED_SOURCE' &&
			artifact.roles.includes('GENERATED')
	);
	if (artifacts.length !== 1) return null;
	const artifact = artifacts[0]!;
	const projectConfigById = new Map(
		capture.semanticSnapshot.projects.map((project) => [project.id, project.configPath])
	);
	const semanticSources = capture.semanticSnapshot.sources.filter(
		(source) =>
			source.logicalPath === selector.logicalPath &&
			projectConfigById.get(source.projectId) === selector.projectConfigPath &&
			source.analysisDisposition === 'DEEP_INDEXED' &&
			source.artifactClass === 'GENERATED_SOURCE' &&
			source.artifactRoles.length === artifact.roles.length &&
			source.artifactRoles.every((role, index) => role === artifact.roles[index]) &&
			source.origin === 'GENERATED' &&
			source.bytes === artifact.bytes &&
			source.contentSha256 === artifact.sha256
	);
	if (semanticSources.length !== 1) return null;
	const semanticSource = semanticSources[0]!;
	const contextSources = capture.projectContextGraph.sources.filter(
		(source) =>
			source.semanticSourceId === semanticSource.id &&
			source.logicalPath === selector.logicalPath &&
			source.semanticProjectId === semanticSource.projectId &&
			source.semanticProgramId === semanticSource.programId &&
			source.analysisDisposition === 'DEEP_INDEXED' &&
			source.origin === 'GENERATED'
	);
	const contextProjects = capture.projectContextGraph.projects.filter(
		(project) =>
			project.semanticProjectId === semanticSource.projectId &&
			project.configPath === selector.projectConfigPath
	);
	if (contextSources.length !== 1 || contextProjects.length !== 1) return null;
	return {
		artifact,
		graphSelector: {
			logicalPath: semanticSource.logicalPath,
			programId: semanticSource.programId,
			projectId: semanticSource.projectId,
			semanticSourceId: semanticSource.id
		},
		semanticSource
	};
}

function evidenceReconciles(
	capture: ProjectContextReportPipelineCapture,
	selected: SelectedStateMachineSource,
	observationValue: StateMachineTopologyObservation,
	graph: StateMachineGraphSnapshot
): boolean {
	const snapshot = capture.semanticSnapshot;
	const subjectId = capture.frozenSubject.descriptor.subjectId;
	const observationCoverage = observationValue.coverage;
	const guardedLegalTransitionIds = new Set(
		observationValue.guardedTransitions.map((transition) => transition.legalTransitionId)
	);
	const expectedNodes =
		observationValue.machines.length +
		observationValue.states.length +
		observationValue.crossAxisRules.length;
	const expectedEdges =
		observationValue.states.length +
		observationValue.legalTransitions.length -
		guardedLegalTransitionIds.size +
		observationValue.guardedTransitions.length +
		observationValue.explicitlyIllegalTransitions.length +
		observationValue.crossAxisRules.length;
	const contextSources = capture.projectContextGraph.sources.filter(
		(source) => source.semanticSourceId === selected.semanticSource.id
	);
	if (
		graph.subjectId !== subjectId ||
		graph.semanticSnapshotId !== snapshot.id ||
		graph.observationId !== observationValue.id ||
		graph.source.logicalPath !== selected.graphSelector.logicalPath ||
		graph.source.programId !== selected.graphSelector.programId ||
		graph.source.projectId !== selected.graphSelector.projectId ||
		graph.source.semanticSourceId !== selected.graphSelector.semanticSourceId ||
		capture.projectContextGraph.subjectId !== subjectId ||
		capture.projectContextGraph.semanticSnapshotId !== snapshot.id ||
		observationValue.subjectId !== subjectId ||
		observationValue.artifact.path !== selected.artifact.path ||
		observationValue.artifact.bytes !== selected.artifact.bytes ||
		observationValue.artifact.sha256 !== selected.artifact.sha256 ||
		observationValue.scope !== STATE_MACHINE_GRAPH_SCOPE ||
		observationValue.registryStatus !== STATE_MACHINE_GRAPH_REGISTRY_STATUS ||
		observationValue.verifierAuthority !== STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY ||
		graph.capability !== STATE_MACHINE_GRAPH_CAPABILITY ||
		graph.capabilityStatus !== STATE_MACHINE_GRAPH_CAPABILITY_STATUS ||
		graph.scope !== STATE_MACHINE_GRAPH_SCOPE ||
		graph.registryStatus !== STATE_MACHINE_GRAPH_REGISTRY_STATUS ||
		graph.verifierAuthority !== STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY ||
		graph.health !== 'PARTIAL' ||
		graph.closure !== 'OPEN' ||
		!graph.coverage.reconciles ||
		!observationCoverage.reconciles ||
		observationCoverage.machines !== observationValue.machines.length ||
		observationCoverage.states !== observationValue.states.length ||
		observationCoverage.legalTransitions !== observationValue.legalTransitions.length ||
		observationCoverage.guardedTransitions !== observationValue.guardedTransitions.length ||
		observationCoverage.explicitlyIllegalTransitions !==
			observationValue.explicitlyIllegalTransitions.length ||
		observationCoverage.crossAxisRules !== observationValue.crossAxisRules.length ||
		graph.nodes.length !== expectedNodes ||
		graph.edges.length !== expectedEdges ||
		graph.coverage.expectedMachines !== observationValue.machines.length ||
		graph.coverage.expectedStates !== observationValue.states.length ||
		graph.coverage.expectedLegalTransitions !==
			observationValue.legalTransitions.length - guardedLegalTransitionIds.size ||
		graph.coverage.expectedGuardedTransitions !== observationValue.guardedTransitions.length ||
		graph.coverage.expectedExplicitlyIllegalTransitions !==
			observationValue.explicitlyIllegalTransitions.length ||
		graph.coverage.expectedCrossAxisRules !== observationValue.crossAxisRules.length ||
		contextSources.length !== 1 ||
		graph.forwardIndex.length !== graph.nodes.length ||
		graph.reverseIndex.length !== graph.nodes.length ||
		graph.forwardIndex.reduce((total, entry) => total + entry.edgeIds.length, 0) !==
			graph.edges.length ||
		graph.reverseIndex.reduce((total, entry) => total + entry.edgeIds.length, 0) !==
			graph.edges.length ||
		graph.layers[0].nodeIds.length !== graph.nodes.length ||
		graph.layers[0].edgeIds.length !== graph.edges.length ||
		graph.layers[0].limitations.length !== graph.limitations.length
	)
		return false;
	return (
		graph.nodes.every(
			(node) =>
				node.subjectId === subjectId &&
				node.semanticSnapshotId === snapshot.id &&
				node.sourceLocations.every((location) => location.sourceId === selected.semanticSource.id)
		) &&
		graph.edges.every(
			(edge) =>
				edge.subjectId === subjectId &&
				edge.semanticSnapshotId === snapshot.id &&
				edge.sourceLocations.every((location) => location.sourceId === selected.semanticSource.id)
		)
	);
}

function topologyObservations(
	observationValue: StateMachineTopologyObservation,
	budgets: StateMachineTopologyObservationBudgets
): readonly StateMachineGraphReportProgressObservation[] {
	return [
		observation(
			'TOPOLOGY_ARTIFACT_BYTES',
			observationValue.artifact.bytes,
			budgets.maxSourceBytes,
			'BYTES'
		),
		observation('TOPOLOGY_MACHINES', observationValue.machines.length, budgets.maxMachines),
		observation('TOPOLOGY_STATES', observationValue.states.length, budgets.maxStates),
		observation(
			'TOPOLOGY_LEGAL_TRANSITIONS',
			observationValue.legalTransitions.length,
			budgets.maxTransitions
		),
		observation(
			'TOPOLOGY_GUARDED_TRANSITIONS',
			observationValue.guardedTransitions.length,
			budgets.maxTransitions
		),
		observation(
			'TOPOLOGY_EXPLICITLY_ILLEGAL_TRANSITIONS',
			observationValue.explicitlyIllegalTransitions.length,
			budgets.maxTransitions
		),
		observation(
			'TOPOLOGY_CROSS_AXIS_RULES',
			observationValue.crossAxisRules.length,
			budgets.maxCrossAxisRules
		)
	];
}

function graphObservations(
	graph: StateMachineGraphSnapshot,
	budgets: StateMachineGraphBudgets
): readonly StateMachineGraphReportProgressObservation[] {
	return [
		observation('STATE_MACHINE_GRAPH_EDGES', graph.edges.length, budgets.maxEdges),
		observation('STATE_MACHINE_GRAPH_MACHINE_NODES', graph.coverage.machineNodes, null),
		observation('STATE_MACHINE_GRAPH_LIMITATIONS', graph.limitations.length, null),
		observation('STATE_MACHINE_GRAPH_NODES', graph.nodes.length, budgets.maxNodes),
		observation('STATE_MACHINE_GRAPH_STATE_NODES', graph.coverage.stateNodes, null)
	];
}

function runInternal(
	requestValue: unknown,
	options: RunStateMachineGraphReportOptions,
	progress: ProgressRecorder
): StateMachineGraphReportOutcome {
	progress.start('REQUEST_BIND');
	let admission: StateMachineGraphReportAdmission;
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
				'PREDECESSOR_SEMANTIC_AST_NODES',
				predecessor.semanticSnapshot.astNodes.length,
				request.budgets.semantic.maxAstNodes
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
		'CAP_010_PIPELINE_CAPTURED_WITH_TS_PROJECT_SYMBOL_SYNTAX'
	);
	const inheritedDiagnostics = predecessorDiagnostics(predecessor);

	progress.start('TOPOLOGY_OBSERVATION');
	const selected = selectStateMachineSource(predecessor, request.source);
	if (selected === null) {
		progress.fail([], 'SOURCE_BINDING_UNAVAILABLE');
		return failure(
			'SOURCE_BINDING_UNAVAILABLE',
			'TOPOLOGY_OBSERVATION',
			'incompatible',
			[
				...inheritedDiagnostics,
				reportDiagnostic(
					'SOURCE_BINDING_UNAVAILABLE',
					'The selected generated artifact, semantic source, and project-context source do not bind exactly.',
					'$.source',
					'BIND',
					'TOPOLOGY_OBSERVATION'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const observationOutcome = observeStateMachineTopology(
		{
			artifact: {
				bytes: selected.artifact.bytes,
				canonicalPathKey: selected.artifact.canonicalPathKey,
				disposition: 'ANALYZED',
				path: selected.artifact.path,
				primaryClass: selected.artifact.primaryClass,
				roles: selected.artifact.roles,
				sha256: selected.artifact.sha256
			},
			budgets: request.budgets.topologyObservation,
			operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
			schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
			subjectId: predecessor.frozenSubject.descriptor.subjectId
		},
		{ subject: predecessor.frozenSubject }
	);
	const topologyDiagnostics = observationDiagnostics(
		observationOutcome.diagnostics,
		predecessor.repositoryRoot
	);
	if (observationOutcome.outcome !== 'complete') {
		progress.fail([], observationOutcome.diagnostics[0]?.code ?? 'TOPOLOGY_UNAVAILABLE');
		return failure(
			'TOPOLOGY_OBSERVATION_UNAVAILABLE',
			'TOPOLOGY_OBSERVATION',
			classifyStateMachineObservationFailureState(observationOutcome.diagnostics),
			[...inheritedDiagnostics, ...topologyDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const topologyObservation = observationOutcome.observation;
	const topologyValidation = validateStateMachineTopologyObservation(
		topologyObservation,
		predecessor.frozenSubject
	);
	if (topologyValidation.state !== 'VALID') {
		progress.fail(
			topologyObservations(topologyObservation, request.budgets.topologyObservation),
			'OBSERVATION_VALIDATION_FAILED'
		);
		return failure(
			'OBSERVATION_VALIDATION_FAILED',
			'TOPOLOGY_OBSERVATION',
			'failed',
			[
				...inheritedDiagnostics,
				...topologyDiagnostics,
				...topologyValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, predecessor.repositoryRoot),
						safeDiagnosticPath(issue.path, predecessor.repositoryRoot),
						'VALIDATE',
						'TOPOLOGY_OBSERVATION',
						'ERROR'
					)
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(
		topologyObservations(topologyObservation, request.budgets.topologyObservation),
		'COMPLETE_GENERATED_TOPOLOGY'
	);

	progress.start('STATE_MACHINE_GRAPH');
	const graphRequest = {
		budgets: request.budgets.stateMachineGraph,
		observationId: topologyObservation.id,
		operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: predecessor.semanticSnapshot.id,
		source: selected.graphSelector,
		subjectId: predecessor.frozenSubject.descriptor.subjectId
	} as const;
	const graphOutcome = buildStateMachineGraph(
		graphRequest,
		predecessor.semanticSnapshot,
		topologyObservation
	);
	const stateMachineGraphDiagnostics = graphDiagnostics(
		graphOutcome.diagnostics,
		predecessor.repositoryRoot
	);
	if (graphOutcome.outcome !== 'partial') {
		progress.fail([], graphOutcome.diagnostics[0]?.code ?? 'STATE_MACHINE_GRAPH_UNAVAILABLE');
		return failure(
			'STATE_MACHINE_GRAPH_UNAVAILABLE',
			'STATE_MACHINE_GRAPH',
			classifyStateMachineGraphFailureState(graphOutcome.diagnostics),
			[...inheritedDiagnostics, ...topologyDiagnostics, ...stateMachineGraphDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const graph = graphOutcome.graph;
	const validation = validateStateMachineGraph(
		graph,
		graphRequest,
		predecessor.semanticSnapshot,
		topologyObservation,
		{ maxIssues: Math.max(1, Math.min(1_000, request.budgets.semantic.maxDiagnostics)) }
	);
	if (validation.state !== 'VALID') {
		progress.fail(
			graphObservations(graph, request.budgets.stateMachineGraph),
			'GRAPH_VALIDATION_FAILED'
		);
		return failure(
			'GRAPH_VALIDATION_FAILED',
			'STATE_MACHINE_GRAPH',
			'failed',
			[
				...inheritedDiagnostics,
				...topologyDiagnostics,
				...stateMachineGraphDiagnostics,
				...validation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, predecessor.repositoryRoot),
						safeDiagnosticPath(issue.path, predecessor.repositoryRoot),
						'VALIDATE',
						'STATE_MACHINE_GRAPH',
						'ERROR'
					)
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(graphObservations(graph, request.budgets.stateMachineGraph), 'PARTIAL_OPEN');

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
	if (!evidenceReconciles(predecessor, selected, topologyObservation, graph)) {
		progress.fail([], 'EVIDENCE_IDENTITY_MISMATCH');
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				...inheritedDiagnostics,
				...topologyDiagnostics,
				...stateMachineGraphDiagnostics,
				...currentnessDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The topology observation and state-machine graph do not reconcile with their exact artifact, semantic, and project-context evidence.'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const stageOutcomes: StateMachineGraphReportStageOutcomes = {
		stateMachineGraph: {
			diagnosticCodes: graphOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial'
		},
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		predecessorPipeline: predecessor.predecessorStageOutcomes,
		topologyObservation: {
			diagnosticCodes: observationOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'complete'
		}
	};
	const report: StateMachineGraphReportOutcome = {
		analysisAuthority: STATE_MACHINE_GRAPH_REPORT_AUTHORITY,
		authorityTransfer: STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [
			...inheritedDiagnostics,
			...topologyDiagnostics,
			...stateMachineGraphDiagnostics,
			...currentnessDiagnostics
		],
		gateEffect: STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT,
		operationVersion: STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				architectureDiscovery: 'NOT_CLAIMED',
				changeImpact: 'NOT_CLAIMED',
				codeSlice: 'NOT_CLAIMED',
				fullJanCsaaCapability027StateMachineAnalysis:
					STATE_MACHINE_GRAPH_REPORT_FULL_JAN_CSAA_CAPABILITY_027,
				id: STATE_MACHINE_GRAPH_CAPABILITY,
				registryStatus: STATE_MACHINE_GRAPH_REGISTRY_STATUS,
				semanticComparison: 'NOT_CLAIMED',
				semanticQuery: 'NOT_CLAIMED',
				scope: STATE_MACHINE_GRAPH_SCOPE,
				status: STATE_MACHINE_GRAPH_CAPABILITY_STATUS,
				verifierAuthority: STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY
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
				encoding:
					'FULL_VALIDATED_PROJECT_CONTEXT_GENERATED_TOPOLOGY_OBSERVATION_AND_STATE_MACHINE_GRAPH',
				projectContextGraph: predecessor.projectContextGraph,
				stateMachineGraph: graph,
				topologyObservation
			},
			facadeNonclaims: STATE_MACHINE_GRAPH_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_GENERATED_RUNTIME_TOPOLOGY',
			predecessorNonclaims: STATE_MACHINE_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
			schemaVersion: STATE_MACHINE_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
			selection: STATE_MACHINE_GRAPH_REPORT_SELECTION,
			semanticSnapshotSummary: {
				astNodes: predecessor.semanticSnapshot.astNodes.length,
				id: predecessor.semanticSnapshot.id,
				programs: predecessor.semanticSnapshot.programs.length,
				projects: predecessor.semanticSnapshot.projects.length,
				sources: predecessor.semanticSnapshot.sources.length
			},
			source: request.source,
			topologyCoverage: topologyObservation.coverage
		},
		schemaVersion: STATE_MACHINE_GRAPH_REPORT_SCHEMA_VERSION,
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
						'The admitted state-machine-graph report exceeds maxResultBytes.'
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

export function runStateMachineGraphReport(
	requestValue: unknown,
	options: RunStateMachineGraphReportOptions
): StateMachineGraphReportOutcome {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(runInternal(requestValue, options, progress));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic('INTERNAL_FAILURE', 'The state-machine-graph report failed closed.')
			])
		);
	}
}

export function stateMachineGraphReportExitCode(
	outcome: StateMachineGraphReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
