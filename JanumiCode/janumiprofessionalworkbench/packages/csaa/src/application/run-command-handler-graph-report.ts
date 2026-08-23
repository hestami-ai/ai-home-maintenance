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
	COMMAND_HANDLER_GRAPH_AUTHORITY_TRANSFER,
	COMMAND_HANDLER_GRAPH_BASELINE_CHANGE,
	COMMAND_HANDLER_GRAPH_CANONICAL_PROFILE,
	COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS,
	COMMAND_HANDLER_GRAPH_COMMAND_DISPATCH_CENSUS_INTEGRATION,
	COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
	COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_HANDLER_GRAPH_GATE_EFFECT,
	COMMAND_HANDLER_GRAPH_GRAPH_AUTHORITY,
	COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY,
	COMMAND_HANDLER_GRAPH_INTEGRATION_STRATEGY,
	COMMAND_HANDLER_GRAPH_LIMITATIONS,
	COMMAND_HANDLER_GRAPH_METHOD,
	COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_ORACLE_CHANGE,
	COMMAND_HANDLER_GRAPH_REGISTRY_STATUS,
	COMMAND_HANDLER_GRAPH_REPLACEMENT_EQUIVALENCE,
	COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_RETAINED_ARROW_VERIFIER_AUTHORITY,
	COMMAND_HANDLER_GRAPH_RUNTIME_DISPATCH_CLOSURE,
	COMMAND_HANDLER_GRAPH_RUNTIME_PERFORMABILITY,
	COMMAND_HANDLER_GRAPH_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_SCOPE,
	type CommandHandlerGraphBuildDiagnostic,
	type CommandHandlerGraphBudgets,
	type CommandHandlerGraphSnapshot
} from '../contracts/command-handler-graph.js';
import {
	COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY,
	COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER,
	COMMAND_HANDLER_GRAPH_REPORT_CAPABILITY_ID,
	COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION,
	COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT,
	COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS,
	COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
	COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS,
	COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS,
	COMMAND_HANDLER_GRAPH_REPORT_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_SELECTION,
	COMMAND_HANDLER_GRAPH_REPORT_SCOPE,
	type CommandHandlerGraphReportDiagnostic,
	type CommandHandlerGraphReportFailureState,
	type CommandHandlerGraphReportOutcome,
	type CommandHandlerGraphReportRequest,
	type CommandHandlerGraphReportStage,
	type CommandHandlerGraphReportStageOutcomes
} from '../contracts/command-handler-graph-report.js';
import {
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	type ProjectContextReportRequest
} from '../contracts/project-context-report.js';
import type { SubjectDiagnostic } from '../contracts/subject.js';
import {
	buildCommandHandlerGraph,
	selectJpwbCommandHandlerRegistries
} from '../graph/build-command-handler-graph.js';
import { validateCommandHandlerGraph } from '../graph/validate-command-handler-graph.js';
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
	repositoryRelativePath
} from '../subject/paths.js';
import {
	admitProjectContextReportRequest,
	captureSemanticReportPipeline,
	type SemanticReportPipelineCapture
} from './run-project-context-report.js';

const REQUEST_KEYS = [
	'budgets',
	'executionSelection',
	'operationVersion',
	'schemaVersion',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = [
	'artifactSet',
	'commandHandlerGraph',
	'maxResultBytes',
	'observation',
	'semantic',
	'subject'
] as const;
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
const COMMAND_HANDLER_GRAPH_BUDGET_KEYS = [
	'maxAstNodes',
	'maxCommandRegistryEntries',
	'maxEdges',
	'maxFrontiers',
	'maxHandlerRegistryEntries',
	'maxNodes',
	'maxSourceBytes'
] as const satisfies readonly (keyof CommandHandlerGraphBudgets)[];
const MAX_DIAGNOSTIC_PATH_CHARACTERS = 10_000;

interface CommandHandlerGraphReportAdmission {
	readonly artifactSetBudgets: ArrowCommandCensusArtifactSetBudgets;
	readonly commandHandlerGraphBudgets: CommandHandlerGraphBudgets;
	readonly observationBudgets: ArrowCommandCensusBudgets;
	readonly predecessorRequest: ProjectContextReportRequest;
}

export const COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-command-handler-graph-report-progress/0.1.0' as const;

export const COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type CommandHandlerGraphReportProgressPhase =
	| 'REQUEST_BIND'
	| 'PREDECESSOR_PIPELINE'
	| 'ARTIFACT_SET'
	| 'RETAINED_CENSUS'
	| 'COMMAND_HANDLER_GRAPH'
	| 'CURRENTNESS'
	| 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	ARTIFACT_SET: 'ARTIFACT_SET',
	COMMAND_HANDLER_GRAPH: 'COMMAND_HANDLER_GRAPH',
	CURRENTNESS: 'CURRENTNESS',
	PREDECESSOR_PIPELINE: 'PREDECESSOR_PIPELINE',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT',
	RETAINED_CENSUS: 'RETAINED_CENSUS'
} as const satisfies Readonly<
	Record<CommandHandlerGraphReportProgressPhase, CommandHandlerGraphReportStage>
>);

export type CommandHandlerGraphReportProgressObservationMetric =
	| 'ARTIFACT_SET_ARTIFACTS'
	| 'ARTIFACT_SET_BYTES'
	| 'COMMAND_HANDLER_GRAPH_CANDIDATE_EDGES'
	| 'COMMAND_HANDLER_GRAPH_COMMANDS'
	| 'COMMAND_HANDLER_GRAPH_EDGES'
	| 'COMMAND_HANDLER_GRAPH_FRONTIERS'
	| 'COMMAND_HANDLER_GRAPH_HANDLERS'
	| 'COMMAND_HANDLER_GRAPH_NODES'
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'OBSERVATION_DECLARED_ARROWS'
	| 'OBSERVATION_DECLARED_SITES'
	| 'OBSERVATION_RAW_OUTPUT_BYTES'
	| 'PREDECESSOR_SEMANTIC_AST_NODES'
	| 'PREDECESSOR_SEMANTIC_PROGRAMS'
	| 'PREDECESSOR_SEMANTIC_PROJECTS'
	| 'PREDECESSOR_SEMANTIC_SOURCES'
	| 'PREDECESSOR_SUBJECT_ARTIFACTS'
	| 'PREDECESSOR_SUBJECT_PROJECTS'
	| 'RESULT_BYTES';

export interface CommandHandlerGraphReportProgressObservation {
	readonly limit: number | null;
	readonly metric: CommandHandlerGraphReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

export interface CommandHandlerGraphReportProgressEvent {
	readonly adapterProgress: ArrowCommandCensusProgressEvent | null;
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly kind: 'REPORT_STAGE' | 'RETAINED_ADAPTER';
	readonly nonclaims: typeof COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly CommandHandlerGraphReportProgressObservation[];
	readonly operationVersion: typeof COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION;
	readonly phase: CommandHandlerGraphReportProgressPhase;
	readonly protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_HANDLER_GRAPH_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: CommandHandlerGraphReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

export interface RunCommandHandlerGraphReportOptions {
	/** Trusted-host telemetry callback; excluded from terminal evidence and identity. */
	readonly onProgress?: (event: CommandHandlerGraphReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

interface ProgressRecorder {
	complete(
		observations?: readonly CommandHandlerGraphReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly CommandHandlerGraphReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: CommandHandlerGraphReportOutcome): CommandHandlerGraphReportOutcome;
	forwardAdapter(event: ArrowCommandCensusProgressEvent): void;
	start(
		phase: CommandHandlerGraphReportProgressPhase,
		observations?: readonly CommandHandlerGraphReportProgressObservation[]
	): void;
}

function observation(
	metric: CommandHandlerGraphReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: CommandHandlerGraphReportProgressObservation['unit'] = 'COUNT'
): CommandHandlerGraphReportProgressObservation {
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
	options: RunCommandHandlerGraphReportOptions
): ((event: CommandHandlerGraphReportProgressEvent) => unknown) | undefined {
	try {
		if (options === null || typeof options !== 'object' || isProxyValue(options)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: CommandHandlerGraphReportProgressEvent) => unknown)
			: undefined;
	} catch {
		return undefined;
	}
}

function createProgressRecorder(options: RunCommandHandlerGraphReportOptions): ProgressRecorder {
	const sink = safeProgressSink(options);
	const startedAt = performance.now();
	let sequence = 0;
	let active: CommandHandlerGraphReportProgressPhase | null = null;
	const emit = (
		kind: CommandHandlerGraphReportProgressEvent['kind'],
		phase: CommandHandlerGraphReportProgressPhase,
		state: CommandHandlerGraphReportProgressEvent['state'],
		observations: readonly CommandHandlerGraphReportProgressObservation[],
		detailCode: string | null,
		adapterProgress: ArrowCommandCensusProgressEvent | null
	): void => {
		const event: CommandHandlerGraphReportProgressEvent = Object.freeze({
			adapterProgress,
			deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
			detailCode,
			elapsedMs: Math.max(0, performance.now() - startedAt),
			kind,
			nonclaims: COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_NONCLAIMS,
			observations,
			operationVersion: COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
			phase,
			protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_HANDLER_GRAPH_REPORT_TELEMETRY',
			reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
			schemaVersion: COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_SCHEMA_VERSION,
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
		observations: readonly CommandHandlerGraphReportProgressObservation[],
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
		finish(outcome): CommandHandlerGraphReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			return outcome;
		},
		forwardAdapter(event): void {
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
		readonly state: CommandHandlerGraphReportFailureState = 'incompatible'
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

function exactProjectClosure(paths: readonly string[]): boolean {
	if (paths.length !== COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS.length) return false;
	const selected = new Set(paths.map((path) => canonicalPathKey(path)));
	return COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS.every((path) =>
		selected.has(canonicalPathKey(path))
	);
}

function materializeAdmission(value: unknown): CommandHandlerGraphReportAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	if (record.executionSelection !== COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION)
		throw new ReportRequestError(
			'RETAINED_EXECUTION_NOT_ACKNOWLEDGED',
			'$.executionSelection must explicitly acknowledge retained verifier execution and its isolation boundary.',
			'$.executionSelection'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const artifactSetBudgets = materializeBudgetRecord(
		budgets.artifactSet,
		ARTIFACT_SET_BUDGET_KEYS,
		COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS.artifactSet,
		'$.budgets.artifactSet'
	) as ArrowCommandCensusArtifactSetBudgets;
	const observationBudgets = materializeBudgetRecord(
		budgets.observation,
		OBSERVATION_BUDGET_KEYS,
		COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS.observation,
		'$.budgets.observation'
	) as ArrowCommandCensusBudgets;
	const commandHandlerGraphBudgets = materializeBudgetRecord(
		budgets.commandHandlerGraph,
		COMMAND_HANDLER_GRAPH_BUDGET_KEYS,
		COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS.commandHandlerGraph,
		'$.budgets.commandHandlerGraph'
	) as CommandHandlerGraphBudgets;
	const predecessorAdmission = admitProjectContextReportRequest({
		budgets: {
			maxResultBytes: budgets.maxResultBytes,
			projectContext: PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.projectContext,
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
	if (!exactProjectClosure(predecessorAdmission.request.subjectProjectConfigPaths))
		throw new ReportRequestError(
			'REQUIRED_PROJECT_CLOSURE_MISMATCH',
			'$.subjectProjectConfigPaths must select exactly the fixed seven-project JPWB command-handler closure.',
			'$.subjectProjectConfigPaths'
		);
	return Object.freeze({
		artifactSetBudgets,
		commandHandlerGraphBudgets,
		observationBudgets,
		predecessorRequest: predecessorAdmission.request
	});
}

function materializedRequest(
	admission: CommandHandlerGraphReportAdmission
): CommandHandlerGraphReportRequest {
	return Object.freeze({
		budgets: Object.freeze({
			artifactSet: admission.artifactSetBudgets,
			commandHandlerGraph: admission.commandHandlerGraphBudgets,
			maxResultBytes: admission.predecessorRequest.budgets.maxResultBytes,
			observation: admission.observationBudgets,
			semantic: admission.predecessorRequest.budgets.semantic,
			subject: admission.predecessorRequest.budgets.subject
		}),
		executionSelection: COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION,
		operationVersion: COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
		schemaVersion: COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: admission.predecessorRequest.subjectProjectConfigPaths
	});
}

export type CommandHandlerGraphReportRequestAdmission =
	| { readonly outcome: 'admitted'; readonly request: CommandHandlerGraphReportRequest }
	| {
			readonly code: string;
			readonly message: string;
			readonly outcome: 'rejected';
			readonly path: string;
			readonly state: CommandHandlerGraphReportFailureState;
	  };

/** @internal Exact hostile-safe admission seam; intentionally not package-root exported. */
export function admitCommandHandlerGraphReportRequest(
	value: unknown
): CommandHandlerGraphReportRequestAdmission {
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
	source: CommandHandlerGraphReportDiagnostic['source'] = 'REPORT',
	severity: CommandHandlerGraphReportDiagnostic['severity'] = null,
	predecessorSource: CommandHandlerGraphReportDiagnostic['predecessorSource'] = null
): CommandHandlerGraphReportDiagnostic {
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
	if (path === null || path.length > MAX_DIAGNOSTIC_PATH_CHARACTERS || !isUnicodeScalarString(path))
		return null;
	if (path.startsWith('$')) return path;
	try {
		if (isAbsolute(path)) return repositoryRelativePath(repositoryRoot, path);
		return assertCanonicalRelativePath(path);
	} catch {
		return null;
	}
}

function capturedPredecessorSource(
	source: SemanticReportPipelineCapture['diagnostics'][number]['source']
): CommandHandlerGraphReportDiagnostic['predecessorSource'] {
	return source === 'CURRENTNESS' ? null : source;
}

function predecessorDiagnostics(
	capture: SemanticReportPipelineCapture
): CommandHandlerGraphReportDiagnostic[] {
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
	diagnostics: readonly SemanticReportPipelineCapture['diagnostics'][number][]
): CommandHandlerGraphReportDiagnostic[] {
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

interface DiagnosticLike {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase?: string | null;
	readonly severity?: 'INFO' | 'WARNING' | 'ERROR' | null;
}

function nestedDiagnosticPath(
	path: string | null,
	nestedBudget: 'artifactSet' | 'observation' | 'commandHandlerGraph',
	repositoryRoot: string
): string | null {
	if (path === '$.budgets' || path === '$request.budgets') return `$.budgets.${nestedBudget}`;
	for (const prefix of ['$.budgets.', '$request.budgets.'])
		if (path?.startsWith(prefix) === true)
			return `$.budgets.${nestedBudget}.${path.slice(prefix.length)}`;
	if (path?.startsWith('$request') === true) return null;
	return safeDiagnosticPath(path, repositoryRoot);
}

function projectedDiagnostics(
	diagnostics: readonly DiagnosticLike[],
	source: Exclude<
		CommandHandlerGraphReportDiagnostic['source'],
		'REPORT' | 'PREDECESSOR_PIPELINE' | 'CURRENTNESS'
	>,
	repositoryRoot: string,
	nestedBudget: 'artifactSet' | 'observation' | 'commandHandlerGraph'
): CommandHandlerGraphReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			nestedDiagnosticPath(diagnostic.path, nestedBudget, repositoryRoot),
			diagnostic.phase ?? null,
			source,
			diagnostic.severity ?? (diagnostic.code === 'GRAPH_PARTIAL' ? 'WARNING' : null)
		)
	);
}

function failure(
	code: string,
	stage: CommandHandlerGraphReportStage,
	state: CommandHandlerGraphReportFailureState,
	diagnostics: readonly CommandHandlerGraphReportDiagnostic[],
	request?: CommandHandlerGraphReportRequest,
	subject?: SemanticReportPipelineCapture['frozenSubject']['descriptor']
): Extract<CommandHandlerGraphReportOutcome, { readonly outcome: 'unavailable' }> {
	return {
		analysisAuthority: COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY,
		authorityTransfer: COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS,
		gateEffect: COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT,
		operationVersion: COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: COMMAND_HANDLER_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: COMMAND_HANDLER_GRAPH_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

function artifactSetFailureState(
	diagnostics: readonly ArrowCommandCensusArtifactSetDiagnostic[]
): CommandHandlerGraphReportFailureState {
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
): CommandHandlerGraphReportFailureState {
	return diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXHAUSTED')
		? 'resource-refused'
		: 'failed';
}

function graphFailureState(
	diagnostics: readonly CommandHandlerGraphBuildDiagnostic[]
): CommandHandlerGraphReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXCEEDED'))
		return 'resource-refused';
	if (
		diagnostics.some((diagnostic) =>
			[
				'INCOMPATIBLE_INPUT_POPULATION',
				'REGISTRY_SELECTOR_MISMATCH',
				'REQUEST_INVALID',
				'SEMANTIC_CAPABILITY_UNAVAILABLE',
				'UNSUPPORTED_COMMAND_REGISTRY',
				'UNSUPPORTED_HANDLER_REGISTRY'
			].includes(diagnostic.code)
		)
	)
		return 'incompatible';
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

function graphOutcomeEnvelopeReconciles(
	diagnostics: readonly CommandHandlerGraphBuildDiagnostic[]
): boolean {
	return (
		diagnostics.length === 1 &&
		diagnostics[0]?.code === 'GRAPH_PARTIAL' &&
		diagnostics[0].phase === 'VALIDATE'
	);
}

function predecessorObservations(
	capture: SemanticReportPipelineCapture,
	request: CommandHandlerGraphReportRequest
): readonly CommandHandlerGraphReportProgressObservation[] {
	return [
		observation(
			'PREDECESSOR_SUBJECT_ARTIFACTS',
			capture.frozenSubject.artifacts.length,
			request.budgets.subject.maxFiles
		),
		observation(
			'PREDECESSOR_SUBJECT_PROJECTS',
			capture.frozenSubject.projects.length,
			request.budgets.subject.maxProjects
		),
		observation(
			'PREDECESSOR_SEMANTIC_AST_NODES',
			capture.semanticSnapshot.astNodes.length,
			request.budgets.semantic.maxAstNodes
		),
		observation(
			'PREDECESSOR_SEMANTIC_SOURCES',
			capture.semanticSnapshot.sources.length,
			request.budgets.semantic.maxSources
		),
		observation(
			'PREDECESSOR_SEMANTIC_PROGRAMS',
			capture.semanticSnapshot.programs.length,
			request.budgets.semantic.maxProjects
		),
		observation(
			'PREDECESSOR_SEMANTIC_PROJECTS',
			capture.semanticSnapshot.projects.length,
			request.budgets.semantic.maxProjects
		)
	];
}

function censusObservations(
	value: ArrowCommandCensusObservation,
	budgets: ArrowCommandCensusBudgets
): readonly CommandHandlerGraphReportProgressObservation[] {
	return [
		observation(
			'OBSERVATION_DECLARED_ARROWS',
			value.declaredArrows.length,
			budgets.maxDeclaredArrowOccurrences
		),
		observation('OBSERVATION_DECLARED_SITES', value.declaredSites.length, budgets.maxDeclaredSites),
		observation(
			'OBSERVATION_RAW_OUTPUT_BYTES',
			value.rawOutput.bytes,
			budgets.maxStdoutBytes,
			'BYTES'
		)
	];
}

function graphObservations(
	graph: CommandHandlerGraphSnapshot,
	budgets: CommandHandlerGraphBudgets
): readonly CommandHandlerGraphReportProgressObservation[] {
	return [
		observation('COMMAND_HANDLER_GRAPH_NODES', graph.nodes.length, budgets.maxNodes),
		observation('COMMAND_HANDLER_GRAPH_EDGES', graph.edges.length, budgets.maxEdges),
		observation(
			'COMMAND_HANDLER_GRAPH_COMMANDS',
			graph.coverage.discoveredCommandRegistryEntries,
			budgets.maxCommandRegistryEntries
		),
		observation(
			'COMMAND_HANDLER_GRAPH_HANDLERS',
			graph.coverage.discoveredHandlerRegistryEntries,
			budgets.maxHandlerRegistryEntries
		),
		observation(
			'COMMAND_HANDLER_GRAPH_FRONTIERS',
			graph.coverage.frontierNodes,
			budgets.maxFrontiers
		),
		observation('COMMAND_HANDLER_GRAPH_CANDIDATE_EDGES', graph.coverage.candidateEdges, null)
	];
}

export interface CommandHandlerGraphReportRuntimeDependencies {
	readonly buildArtifactSet: typeof buildArrowCommandCensusArtifactSet;
	readonly buildGraph: typeof buildCommandHandlerGraph;
	readonly captureSemantic: typeof captureSemanticReportPipeline;
	readonly observeCensus: typeof observeArrowCommandCensus;
	readonly selectRegistries: typeof selectJpwbCommandHandlerRegistries;
	readonly validateArtifactSet: typeof validateArrowCommandCensusArtifactSet;
	readonly validateGraph: typeof validateCommandHandlerGraph;
	readonly validateObservation: typeof validateArrowCommandCensusObservation;
	readonly verifySubject: typeof verifyFrozenSubject;
}

const DEFAULT_DEPENDENCIES: CommandHandlerGraphReportRuntimeDependencies = Object.freeze({
	buildArtifactSet: buildArrowCommandCensusArtifactSet,
	buildGraph: buildCommandHandlerGraph,
	captureSemantic: captureSemanticReportPipeline,
	observeCensus: observeArrowCommandCensus,
	selectRegistries: selectJpwbCommandHandlerRegistries,
	validateArtifactSet: validateArrowCommandCensusArtifactSet,
	validateGraph: validateCommandHandlerGraph,
	validateObservation: validateArrowCommandCensusObservation,
	verifySubject: verifyFrozenSubject
});

type ArrowArtifactSet = Extract<
	ReturnType<typeof buildArrowCommandCensusArtifactSet>,
	{ readonly outcome: 'complete' }
>['artifactSet'];

function evidenceReconciles(
	capture: SemanticReportPipelineCapture,
	artifactSet: ArrowArtifactSet,
	observationValue: ArrowCommandCensusObservation,
	graph: CommandHandlerGraphSnapshot,
	registries: ReturnType<typeof selectJpwbCommandHandlerRegistries>,
	request: CommandHandlerGraphReportRequest
): boolean {
	const snapshot = capture.semanticSnapshot;
	const subjectId = capture.frozenSubject.descriptor.subjectId;
	const executorArtifacts = artifactSet.artifacts.filter((artifact) =>
		artifact.uses.includes('EXECUTOR_SOURCE')
	);
	const executorArtifact = executorArtifacts[0];
	if (
		executorArtifacts.length !== 1 ||
		executorArtifact === undefined ||
		artifactSet.subjectId !== subjectId ||
		observationValue.subjectId !== subjectId ||
		observationValue.artifactSet.id !== artifactSet.id ||
		canonicalSemanticJson(observationValue.artifactSet) !== canonicalSemanticJson(artifactSet) ||
		canonicalSemanticJson(observationValue.budgets) !==
			canonicalSemanticJson(request.budgets.observation) ||
		observationValue.schemaVersion !== ARROW_COMMAND_CENSUS_OBSERVATION_SCHEMA_VERSION ||
		observationValue.operationVersion !== ARROW_COMMAND_CENSUS_OPERATION_VERSION ||
		observationValue.verifierAuthority !== ARROW_COMMAND_CENSUS_VERIFIER_AUTHORITY ||
		observationValue.authorityTransfer !== ARROW_COMMAND_CENSUS_AUTHORITY_TRANSFER ||
		observationValue.gateEffect !== ARROW_COMMAND_CENSUS_GATE_EFFECT ||
		observationValue.oracleChange !== ARROW_COMMAND_CENSUS_ORACLE_CHANGE ||
		observationValue.replacementEquivalence !== ARROW_COMMAND_CENSUS_REPLACEMENT_EQUIVALENCE ||
		observationValue.integrationStrategy !== ARROW_COMMAND_CENSUS_INTEGRATION_STRATEGY ||
		observationValue.fullJanCsaa007Conformance !==
			ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_007_CONFORMANCE ||
		observationValue.fullJanCsaa008Conformance !==
			ARROW_COMMAND_CENSUS_FULL_JAN_CSAA_008_CONFORMANCE ||
		observationValue.method !== ARROW_COMMAND_CENSUS_METHOD ||
		observationValue.canonicalProfile !== ARROW_COMMAND_CENSUS_CANONICAL_PROFILE ||
		canonicalSemanticJson(observationValue.limitations) !==
			canonicalSemanticJson(ARROW_COMMAND_CENSUS_LIMITATIONS) ||
		observationValue.executor.adapterId !== ARROW_COMMAND_CENSUS_ADAPTER_ID ||
		observationValue.executor.adapterVersion !== ARROW_COMMAND_CENSUS_OPERATION_VERSION ||
		observationValue.executor.retainedVerifierCanonicalPathKey !==
			executorArtifact.canonicalPathKey ||
		observationValue.executor.retainedVerifierSha256 !== executorArtifact.sha256 ||
		graph.subjectId !== subjectId ||
		graph.semanticSnapshotId !== snapshot.id ||
		graph.arrowObservationId !== observationValue.id ||
		canonicalSemanticJson(graph.budgets) !==
			canonicalSemanticJson(request.budgets.commandHandlerGraph) ||
		canonicalSemanticJson(graph.commandRegistry) !==
			canonicalSemanticJson(registries.commandRegistry) ||
		canonicalSemanticJson(graph.handlerRegistry) !==
			canonicalSemanticJson(registries.handlerRegistry) ||
		graph.schemaVersion !== COMMAND_HANDLER_GRAPH_SCHEMA_VERSION ||
		graph.operationVersion !== COMMAND_HANDLER_GRAPH_OPERATION_VERSION ||
		graph.canonicalProfile !== COMMAND_HANDLER_GRAPH_CANONICAL_PROFILE ||
		graph.method !== COMMAND_HANDLER_GRAPH_METHOD ||
		graph.capabilityStatus !== COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS ||
		graph.registryStatus !== COMMAND_HANDLER_GRAPH_REGISTRY_STATUS ||
		graph.scope !== COMMAND_HANDLER_GRAPH_SCOPE ||
		graph.graphAuthority !== COMMAND_HANDLER_GRAPH_GRAPH_AUTHORITY ||
		graph.authorityTransfer !== COMMAND_HANDLER_GRAPH_AUTHORITY_TRANSFER ||
		graph.gateEffect !== COMMAND_HANDLER_GRAPH_GATE_EFFECT ||
		graph.oracleChange !== COMMAND_HANDLER_GRAPH_ORACLE_CHANGE ||
		graph.baselineChange !== COMMAND_HANDLER_GRAPH_BASELINE_CHANGE ||
		graph.integrationStrategy !== COMMAND_HANDLER_GRAPH_INTEGRATION_STRATEGY ||
		graph.replacementEquivalence !== COMMAND_HANDLER_GRAPH_REPLACEMENT_EQUIVALENCE ||
		graph.commandDispatchCensusIntegration !==
			COMMAND_HANDLER_GRAPH_COMMAND_DISPATCH_CENSUS_INTEGRATION ||
		graph.runtimeDispatchClosure !== COMMAND_HANDLER_GRAPH_RUNTIME_DISPATCH_CLOSURE ||
		graph.runtimePerformability !== COMMAND_HANDLER_GRAPH_RUNTIME_PERFORMABILITY ||
		graph.retainedArrowVerifierAuthority !==
			COMMAND_HANDLER_GRAPH_RETAINED_ARROW_VERIFIER_AUTHORITY ||
		graph.fullJanCsaa007Conformance !== COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_007_CONFORMANCE ||
		graph.fullJanCsaa008Conformance !== COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_008_CONFORMANCE ||
		graph.health !== 'PARTIAL' ||
		graph.capabilities.length !== 2 ||
		graph.capabilities[0] !== COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY ||
		graph.capabilities[1] !== COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY ||
		canonicalSemanticJson(graph.limitations) !==
			canonicalSemanticJson(COMMAND_HANDLER_GRAPH_LIMITATIONS) ||
		!graph.coverage.reconciles ||
		graph.coverage.edges !== graph.edges.length ||
		graph.forwardIndex.length !== graph.nodes.length ||
		graph.reverseIndex.length !== graph.nodes.length
	)
		return false;
	return (
		graph.nodes.every(
			(node) => node.subjectId === subjectId && node.semanticSnapshotId === snapshot.id
		) &&
		graph.edges.every(
			(edge) => edge.subjectId === subjectId && edge.semanticSnapshotId === snapshot.id
		) &&
		graph.layers.every(
			(layer) => layer.subjectId === subjectId && layer.semanticSnapshotId === snapshot.id
		)
	);
}

async function runInternal(
	requestValue: unknown,
	options: RunCommandHandlerGraphReportOptions,
	progress: ProgressRecorder,
	dependencies: CommandHandlerGraphReportRuntimeDependencies
): Promise<CommandHandlerGraphReportOutcome> {
	progress.start('REQUEST_BIND');
	let admission: CommandHandlerGraphReportAdmission;
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
	const predecessor = dependencies.captureSemantic(admission.predecessorRequest, {
		additionalArtifacts: ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
		repositoryRoot: options.repositoryRoot
	});
	if (predecessor.outcome !== 'semantic-captured') {
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
		predecessorObservations(predecessor, request),
		'SAME_SUBJECT_SEMANTIC_PIPELINE_AND_FIXED_RETAINED_ARTIFACTS_CAPTURED'
	);
	const inheritedDiagnostics = predecessorDiagnostics(predecessor);
	const subject = predecessor.frozenSubject;

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
	const artifactSetDiagnostics = projectedDiagnostics(
		artifactSetOutcome.diagnostics,
		'ARTIFACT_SET',
		predecessor.repositoryRoot,
		'artifactSet'
	);
	if (artifactSetOutcome.outcome !== 'complete') {
		progress.fail([], artifactSetOutcome.diagnostics[0]?.code ?? 'ARTIFACT_SET_UNAVAILABLE');
		return failure(
			'ARTIFACT_SET_UNAVAILABLE',
			'ARTIFACT_SET',
			artifactSetFailureState(artifactSetOutcome.diagnostics),
			[...inheritedDiagnostics, ...artifactSetDiagnostics],
			request,
			subject.descriptor
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
			artifactSetValidation.state === 'BUDGET_EXHAUSTED' ? 'resource-refused' : 'failed',
			[
				...inheritedDiagnostics,
				...artifactSetValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, predecessor.repositoryRoot),
						nestedDiagnosticPath(issue.path, 'artifactSet', predecessor.repositoryRoot),
						'VALIDATE',
						'ARTIFACT_SET',
						'ERROR'
					)
				)
			],
			request,
			subject.descriptor
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
	const censusDiagnostics = projectedDiagnostics(
		censusOutcome.diagnostics,
		'RETAINED_CENSUS',
		predecessor.repositoryRoot,
		'observation'
	);
	if (censusOutcome.outcome === 'unavailable') {
		progress.fail([], censusOutcome.diagnostics[0]?.code ?? 'RETAINED_CENSUS_UNAVAILABLE');
		return failure(
			'RETAINED_CENSUS_UNAVAILABLE',
			'RETAINED_CENSUS',
			censusFailureState(censusOutcome.diagnostics),
			[...inheritedDiagnostics, ...artifactSetDiagnostics, ...censusDiagnostics],
			request,
			subject.descriptor
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
			censusValidation.state === 'BUDGET_EXHAUSTED' ? 'resource-refused' : 'failed',
			[
				...inheritedDiagnostics,
				...artifactSetDiagnostics,
				...censusValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, predecessor.repositoryRoot),
						nestedDiagnosticPath(issue.path, 'observation', predecessor.repositoryRoot),
						'VALIDATE',
						'RETAINED_CENSUS',
						'ERROR'
					)
				)
			],
			request,
			subject.descriptor
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
				...inheritedDiagnostics,
				...artifactSetDiagnostics,
				...censusDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The retained census outcome, baseline comparison, and execution health do not reconcile.',
					null,
					'VALIDATE',
					'RETAINED_CENSUS',
					'ERROR'
				)
			],
			request,
			subject.descriptor
		);
	}
	progress.complete(
		censusObservations(censusObservation, request.budgets.observation),
		censusOutcome.outcome === 'complete'
			? 'COMPLETE_RETAINED_EVIDENCE'
			: 'PARTIAL_RETAINED_EVIDENCE'
	);

	progress.start('COMMAND_HANDLER_GRAPH');
	let registries: ReturnType<typeof selectJpwbCommandHandlerRegistries>;
	try {
		registries = dependencies.selectRegistries(predecessor.semanticSnapshot);
	} catch {
		progress.fail([], 'REGISTRY_SELECTION_UNAVAILABLE');
		return failure(
			'REGISTRY_SELECTION_UNAVAILABLE',
			'COMMAND_HANDLER_GRAPH',
			'incompatible',
			[
				...inheritedDiagnostics,
				...artifactSetDiagnostics,
				...censusDiagnostics,
				reportDiagnostic(
					'REGISTRY_SELECTION_UNAVAILABLE',
					'The exact JPWB COMMANDS and HANDLERS registries could not be selected uniquely.',
					null,
					'BIND',
					'COMMAND_HANDLER_GRAPH',
					'ERROR'
				)
			],
			request,
			subject.descriptor
		);
	}
	const graphRequest = {
		arrowObservationId: censusObservation.id,
		budgets: request.budgets.commandHandlerGraph,
		commandRegistry: registries.commandRegistry,
		handlerRegistry: registries.handlerRegistry,
		operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
		schemaVersion: COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: predecessor.semanticSnapshot.id,
		subjectId: subject.descriptor.subjectId
	} as const;
	const graphOutcome = dependencies.buildGraph(
		graphRequest,
		predecessor.semanticSnapshot,
		censusObservation,
		subject
	);
	const graphDiagnostics = projectedDiagnostics(
		graphOutcome.diagnostics,
		'COMMAND_HANDLER_GRAPH',
		predecessor.repositoryRoot,
		'commandHandlerGraph'
	);
	if (graphOutcome.outcome !== 'partial') {
		progress.fail([], graphOutcome.diagnostics[0]?.code ?? 'COMMAND_HANDLER_GRAPH_UNAVAILABLE');
		return failure(
			'COMMAND_HANDLER_GRAPH_UNAVAILABLE',
			'COMMAND_HANDLER_GRAPH',
			graphFailureState(graphOutcome.diagnostics),
			[
				...inheritedDiagnostics,
				...artifactSetDiagnostics,
				...censusDiagnostics,
				...graphDiagnostics
			],
			request,
			subject.descriptor
		);
	}
	const graph = graphOutcome.graph;
	const graphValidation = dependencies.validateGraph(
		graph,
		predecessor.semanticSnapshot,
		censusObservation,
		subject,
		{ maxIssues: Math.max(1, Math.min(1_000, request.budgets.semantic.maxDiagnostics)) }
	);
	if (graphValidation.state !== 'VALID') {
		progress.fail(
			graphObservations(graph, request.budgets.commandHandlerGraph),
			'GRAPH_VALIDATION_FAILED'
		);
		return failure(
			'GRAPH_VALIDATION_FAILED',
			'COMMAND_HANDLER_GRAPH',
			graphValidation.state === 'BUDGET_EXHAUSTED' ? 'resource-refused' : 'failed',
			[
				...inheritedDiagnostics,
				...artifactSetDiagnostics,
				...censusDiagnostics,
				...graphValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, predecessor.repositoryRoot),
						nestedDiagnosticPath(issue.path, 'commandHandlerGraph', predecessor.repositoryRoot),
						'VALIDATE',
						'COMMAND_HANDLER_GRAPH',
						'ERROR'
					)
				)
			],
			request,
			subject.descriptor
		);
	}
	if (!graphOutcomeEnvelopeReconciles(graphOutcome.diagnostics)) {
		progress.fail(
			graphObservations(graph, request.budgets.commandHandlerGraph),
			'GRAPH_OUTCOME_MISMATCH'
		);
		return failure(
			'GRAPH_OUTCOME_MISMATCH',
			'COMMAND_HANDLER_GRAPH',
			'failed',
			[
				...inheritedDiagnostics,
				...artifactSetDiagnostics,
				...censusDiagnostics,
				...graphDiagnostics,
				reportDiagnostic(
					'GRAPH_OUTCOME_MISMATCH',
					'The command-handler graph partial outcome does not carry its required explicit frontier diagnostic.',
					null,
					'VALIDATE',
					'COMMAND_HANDLER_GRAPH',
					'ERROR'
				)
			],
			request,
			subject.descriptor
		);
	}
	progress.complete(
		graphObservations(graph, request.budgets.commandHandlerGraph),
		'PARTIAL_OPEN_STATIC_PROJECTION'
	);

	progress.start('CURRENTNESS');
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		freshness = dependencies.verifySubject(subject, { rootLocator: predecessor.repositoryRoot });
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
	if (
		!evidenceReconciles(predecessor, artifactSet, censusObservation, graph, registries, request)
	) {
		progress.fail([], 'EVIDENCE_IDENTITY_MISMATCH');
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				...inheritedDiagnostics,
				...artifactSetDiagnostics,
				...censusDiagnostics,
				...graphDiagnostics,
				...currentnessDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The semantic capture, retained arrow evidence, registry selectors, and command-handler graph do not reconcile with one exact frozen subject.',
					null,
					'VALIDATE',
					'REPORT',
					'ERROR'
				)
			],
			request,
			subject.descriptor
		);
	}
	const stageOutcomes: CommandHandlerGraphReportStageOutcomes = {
		artifactSet: {
			diagnosticCodes: [],
			outcome: 'complete'
		},
		commandHandlerGraph: {
			diagnosticCodes: graphOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial'
		},
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		predecessorPipeline: predecessor.predecessorStageOutcomes,
		retainedCensus: {
			diagnosticCodes: censusOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: censusOutcome.outcome
		}
	};
	const report: CommandHandlerGraphReportOutcome = {
		analysisAuthority: COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY,
		authorityTransfer: COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [
			...inheritedDiagnostics,
			...artifactSetDiagnostics,
			...censusDiagnostics,
			...graphDiagnostics,
			...currentnessDiagnostics
		],
		gateEffect: COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT,
		operationVersion: COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				commandDispatchCensusIntegration: COMMAND_HANDLER_GRAPH_COMMAND_DISPATCH_CENSUS_INTEGRATION,
				derivationCapability: COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
				facadeScope: COMMAND_HANDLER_GRAPH_REPORT_SCOPE,
				fullJanCsaa007Conformance: COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_007_CONFORMANCE,
				fullJanCsaa008Conformance: COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_008_CONFORMANCE,
				graphAuthority: COMMAND_HANDLER_GRAPH_GRAPH_AUTHORITY,
				id: COMMAND_HANDLER_GRAPH_REPORT_CAPABILITY_ID,
				inferenceCapability: COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY,
				registryStatus: COMMAND_HANDLER_GRAPH_REGISTRY_STATUS,
				retainedArrowVerifierAuthority: COMMAND_HANDLER_GRAPH_RETAINED_ARROW_VERIFIER_AUTHORITY,
				runtimeDispatchClosure: COMMAND_HANDLER_GRAPH_RUNTIME_DISPATCH_CLOSURE,
				runtimePerformability: COMMAND_HANDLER_GRAPH_RUNTIME_PERFORMABILITY,
				scope: COMMAND_HANDLER_GRAPH_SCOPE,
				status: COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS
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
				commandHandlerGraph: graph,
				encoding: 'FULL_VALIDATED_RETAINED_ARROW_OBSERVATION_AND_COMMAND_HANDLER_GRAPH',
				observation: censusObservation
			},
			facadeNonclaims: COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_SAME_SUBJECT_STATIC_COMMAND_HANDLER_PROJECTION',
			predecessorNonclaims: COMMAND_HANDLER_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
			schemaVersion: COMMAND_HANDLER_GRAPH_REPORT_RESULT_SCHEMA_VERSION,
			selection: COMMAND_HANDLER_GRAPH_REPORT_SELECTION,
			semanticSnapshotSummary: {
				astNodes: predecessor.semanticSnapshot.astNodes.length,
				id: predecessor.semanticSnapshot.id,
				programs: predecessor.semanticSnapshot.programs.length,
				projects: predecessor.semanticSnapshot.projects.length,
				sources: predecessor.semanticSnapshot.sources.length
			}
		},
		schemaVersion: COMMAND_HANDLER_GRAPH_REPORT_SCHEMA_VERSION,
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
						'The admitted command-handler-graph report exceeds maxResultBytes.'
					)
				],
				request,
				subject.descriptor
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
			subject.descriptor
		);
	}
}

/** @internal Test seam; intentionally not exported from the package root. */
export async function runCommandHandlerGraphReportWithDependencies(
	requestValue: unknown,
	options: RunCommandHandlerGraphReportOptions,
	dependencies: CommandHandlerGraphReportRuntimeDependencies
): Promise<CommandHandlerGraphReportOutcome> {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(await runInternal(requestValue, options, progress, dependencies));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic('INTERNAL_FAILURE', 'The command-handler-graph report failed closed.')
			])
		);
	}
}

export async function runCommandHandlerGraphReport(
	requestValue: unknown,
	options: RunCommandHandlerGraphReportOptions
): Promise<CommandHandlerGraphReportOutcome> {
	return runCommandHandlerGraphReportWithDependencies(requestValue, options, DEFAULT_DEPENDENCIES);
}

export function commandHandlerGraphReportExitCode(
	outcome: CommandHandlerGraphReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
