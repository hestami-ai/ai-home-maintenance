import { isAbsolute } from 'node:path';

import {
	COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	type CommandHandlerGraphReportRequest
} from '../contracts/command-handler-graph-report.js';
import {
	COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER,
	COMMAND_DISPATCH_TOPOLOGY_BASELINE_CHANGE,
	COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE,
	COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS,
	COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT,
	COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY,
	COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT,
	COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY,
	COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY,
	COMMAND_DISPATCH_TOPOLOGY_INTEGRATION_STRATEGY,
	COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS,
	COMMAND_DISPATCH_TOPOLOGY_METHOD,
	COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE,
	COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS,
	COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE,
	COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY,
	COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE,
	COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY,
	COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_SCOPE,
	type BuildCommandDispatchTopologyRequest,
	type CommandDispatchTopologyBudgets,
	type CommandDispatchTopologyBuildDiagnostic,
	type CommandDispatchTopologySnapshot
} from '../contracts/command-dispatch-topology.js';
import {
	COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_CAPABILITY_ID,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_PREDECESSOR_NONCLAIMS,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_RESULT_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_SAFETY_CEILINGS,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_SELECTION,
	type CommandDispatchTopologyReportDiagnostic,
	type CommandDispatchTopologyReportFailureState,
	type CommandDispatchTopologyReportOutcome,
	type CommandDispatchTopologyReportRequest,
	type CommandDispatchTopologyReportStage,
	type CommandDispatchTopologyReportStageOutcomes
} from '../contracts/command-dispatch-topology-report.js';
import type { SubjectDiagnostic } from '../contracts/subject.js';
import {
	buildCommandDispatchTopology,
	selectJpwbCommandDispatchTopology
} from '../graph/build-command-dispatch-topology.js';
import {
	commandDispatchTopologyContentDigest,
	commandDispatchTopologyDerivationLayerId,
	commandDispatchTopologyGraphId,
	commandDispatchTopologyInferenceLayerId,
	commandDispatchTopologyInputDigest,
	commandDispatchPipelineNodeId,
	commandDispatchTopologyRetainedCensusReference
} from '../graph/command-dispatch-topology-canonical.js';
import { validateCommandDispatchTopology } from '../graph/validate-command-dispatch-topology.js';
import { validateCommandHandlerGraph } from '../graph/validate-command-handler-graph.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import { ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS } from '../providers/jpwb-arrow-command-census/artifact-set.js';
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
	admitCommandHandlerGraphReportRequest,
	captureCommandHandlerGraphReportPipeline,
	type CommandHandlerGraphReportPipelineCapture,
	type CommandHandlerGraphReportProgressEvent
} from './run-command-handler-graph-report.js';

const REQUEST_KEYS = [
	'budgets',
	'executionSelection',
	'operationVersion',
	'schemaVersion',
	'subjectProjectConfigPaths'
] as const;
const BUDGET_KEYS = [
	'artifactSet',
	'commandDispatchTopology',
	'commandHandlerGraph',
	'maxResultBytes',
	'observation',
	'semantic',
	'subject'
] as const;
const COMMAND_DISPATCH_TOPOLOGY_BUDGET_KEYS = [
	'maxAstNodes',
	'maxDiagnostics',
	'maxEdges',
	'maxHandlerTargets',
	'maxNodes',
	'maxSourceBytes'
] as const satisfies readonly (keyof CommandDispatchTopologyBudgets)[];
const MAX_DIAGNOSTIC_PATH_CHARACTERS = 10_000;
const DISPATCH_VALIDATION_MAX_RECORDS = 10_000_000;
const DISPATCH_VALIDATION_MAX_STRING_CHARACTERS = 1_000_000_000;

interface CommandDispatchTopologyReportAdmission {
	readonly dispatchBudgets: CommandDispatchTopologyBudgets;
	readonly predecessorRequest: CommandHandlerGraphReportRequest;
}

export const COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-command-dispatch-topology-report-progress/0.1.0' as const;

export const COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type CommandDispatchTopologyReportProgressPhase =
	'REQUEST_BIND' | 'PREDECESSOR_PIPELINE' | 'COMMAND_DISPATCH_TOPOLOGY' | 'CURRENTNESS' | 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	COMMAND_DISPATCH_TOPOLOGY: 'COMMAND_DISPATCH_TOPOLOGY',
	CURRENTNESS: 'CURRENTNESS',
	PREDECESSOR_PIPELINE: 'PREDECESSOR_PIPELINE',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT'
} as const satisfies Readonly<
	Record<CommandDispatchTopologyReportProgressPhase, CommandDispatchTopologyReportStage>
>);

export type CommandDispatchTopologyReportProgressObservationMetric =
	| 'COMMAND_DISPATCH_CANDIDATE_EDGES'
	| 'COMMAND_DISPATCH_NODES'
	| 'COMMAND_DISPATCH_PIPELINE_FACTS'
	| 'COMMAND_DISPATCH_RETAINED_CENSUS_BYTES'
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'PREDECESSOR_ARROW_OCCURRENCES'
	| 'PREDECESSOR_ARROW_SITES'
	| 'PREDECESSOR_COMMAND_HANDLER_EDGES'
	| 'PREDECESSOR_COMMAND_HANDLER_NODES'
	| 'PREDECESSOR_SEMANTIC_AST_NODES'
	| 'PREDECESSOR_SUBJECT_ARTIFACTS'
	| 'RESULT_BYTES';

export interface CommandDispatchTopologyReportProgressObservation {
	readonly limit: number | null;
	readonly metric: CommandDispatchTopologyReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT' | 'MILLISECONDS';
	readonly value: number;
}

export interface CommandDispatchTopologyReportProgressEvent {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly kind: 'REPORT_STAGE' | 'PREDECESSOR_REPORT';
	readonly nonclaims: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly CommandDispatchTopologyReportProgressObservation[];
	readonly operationVersion: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION;
	readonly phase: CommandDispatchTopologyReportProgressPhase;
	readonly predecessorProgress: CommandHandlerGraphReportProgressEvent | null;
	readonly protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_DISPATCH_TOPOLOGY_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: CommandDispatchTopologyReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

export interface RunCommandDispatchTopologyReportOptions {
	/** Trusted-host telemetry callback; excluded from terminal evidence and identity. */
	readonly onProgress?: (event: CommandDispatchTopologyReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the adapter, never by the wire request. */
	readonly repositoryRoot: string;
}

interface ProgressRecorder {
	complete(
		observations?: readonly CommandDispatchTopologyReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly CommandDispatchTopologyReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: CommandDispatchTopologyReportOutcome): CommandDispatchTopologyReportOutcome;
	forwardPredecessor(event: CommandHandlerGraphReportProgressEvent): void;
	start(
		phase: CommandDispatchTopologyReportProgressPhase,
		observations?: readonly CommandDispatchTopologyReportProgressObservation[]
	): void;
}

function observation(
	metric: CommandDispatchTopologyReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: CommandDispatchTopologyReportProgressObservation['unit'] = 'COUNT'
): CommandDispatchTopologyReportProgressObservation {
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
	options: RunCommandDispatchTopologyReportOptions
): ((event: CommandDispatchTopologyReportProgressEvent) => unknown) | undefined {
	try {
		if (options === null || typeof options !== 'object' || isProxyValue(options)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: CommandDispatchTopologyReportProgressEvent) => unknown)
			: undefined;
	} catch {
		return undefined;
	}
}

function createProgressRecorder(
	options: RunCommandDispatchTopologyReportOptions
): ProgressRecorder {
	const sink = safeProgressSink(options);
	const startedAt = performance.now();
	let sequence = 0;
	let active: CommandDispatchTopologyReportProgressPhase | null = null;
	const emit = (
		kind: CommandDispatchTopologyReportProgressEvent['kind'],
		phase: CommandDispatchTopologyReportProgressPhase,
		state: CommandDispatchTopologyReportProgressEvent['state'],
		observations: readonly CommandDispatchTopologyReportProgressObservation[],
		detailCode: string | null,
		predecessorProgress: CommandHandlerGraphReportProgressEvent | null
	): void => {
		const event: CommandDispatchTopologyReportProgressEvent = Object.freeze({
			deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
			detailCode,
			elapsedMs: Math.max(0, performance.now() - startedAt),
			kind,
			nonclaims: COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_NONCLAIMS,
			observations,
			operationVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
			phase,
			predecessorProgress,
			protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_DISPATCH_TOPOLOGY_REPORT_TELEMETRY',
			reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
			schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_SCHEMA_VERSION,
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
		observations: readonly CommandDispatchTopologyReportProgressObservation[],
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
		finish(outcome): CommandDispatchTopologyReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			return outcome;
		},
		forwardPredecessor(event): void {
			let predecessorProgress: CommandHandlerGraphReportProgressEvent;
			try {
				predecessorProgress = JSON.parse(
					canonicalSemanticJson(event)
				) as CommandHandlerGraphReportProgressEvent;
			} catch {
				return;
			}
			emit(
				'PREDECESSOR_REPORT',
				'PREDECESSOR_PIPELINE',
				predecessorProgress.state,
				[],
				predecessorProgress.detailCode,
				predecessorProgress
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
		readonly state: CommandDispatchTopologyReportFailureState = 'incompatible'
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

function materializeAdmission(value: unknown): CommandDispatchTopologyReportAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	if (record.executionSelection !== COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION)
		throw new ReportRequestError(
			'RETAINED_EXECUTION_NOT_ACKNOWLEDGED',
			'$.executionSelection must explicitly acknowledge retained arrow verifier execution and its isolation boundary.',
			'$.executionSelection'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const dispatchBudgetRecord = exactDataRecord(
		budgets.commandDispatchTopology,
		COMMAND_DISPATCH_TOPOLOGY_BUDGET_KEYS,
		'$.budgets.commandDispatchTopology'
	);
	const dispatchBudgets = Object.freeze(
		Object.fromEntries(
			COMMAND_DISPATCH_TOPOLOGY_BUDGET_KEYS.map((key) => [
				key,
				boundedBudget(
					dispatchBudgetRecord[key],
					COMMAND_DISPATCH_TOPOLOGY_REPORT_SAFETY_CEILINGS.commandDispatchTopology[key],
					`$.budgets.commandDispatchTopology.${key}`
				)
			])
		) as unknown as CommandDispatchTopologyBudgets
	);
	const predecessorAdmission = admitCommandHandlerGraphReportRequest({
		budgets: {
			artifactSet: budgets.artifactSet,
			commandHandlerGraph: budgets.commandHandlerGraph,
			maxResultBytes: budgets.maxResultBytes,
			observation: budgets.observation,
			semantic: budgets.semantic,
			subject: budgets.subject
		},
		executionSelection: COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION,
		operationVersion: COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
		schemaVersion: COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: record.subjectProjectConfigPaths
	});
	if (predecessorAdmission.outcome === 'rejected')
		throw new ReportRequestError(
			predecessorAdmission.code,
			predecessorAdmission.message,
			predecessorAdmission.path,
			predecessorAdmission.state
		);
	return Object.freeze({ dispatchBudgets, predecessorRequest: predecessorAdmission.request });
}

function materializedRequest(
	admission: CommandDispatchTopologyReportAdmission
): CommandDispatchTopologyReportRequest {
	return Object.freeze({
		budgets: Object.freeze({
			...admission.predecessorRequest.budgets,
			commandDispatchTopology: admission.dispatchBudgets
		}),
		executionSelection: COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION,
		operationVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
		schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: admission.predecessorRequest.subjectProjectConfigPaths
	});
}

export type CommandDispatchTopologyReportRequestAdmission =
	| { readonly outcome: 'admitted'; readonly request: CommandDispatchTopologyReportRequest }
	| {
			readonly code: string;
			readonly message: string;
			readonly outcome: 'rejected';
			readonly path: string;
			readonly state: CommandDispatchTopologyReportFailureState;
	  };

/** @internal Exact hostile-safe admission seam; intentionally not package-root exported. */
export function admitCommandDispatchTopologyReportRequest(
	value: unknown
): CommandDispatchTopologyReportRequestAdmission {
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
	source: CommandDispatchTopologyReportDiagnostic['source'] = 'REPORT',
	severity: CommandDispatchTopologyReportDiagnostic['severity'] = null,
	predecessorSource: CommandDispatchTopologyReportDiagnostic['predecessorSource'] = null
): CommandDispatchTopologyReportDiagnostic {
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

function nestedDispatchDiagnosticPath(path: string | null, repositoryRoot: string): string | null {
	if (path === '$.budgets' || path === '$request.budgets')
		return '$.budgets.commandDispatchTopology';
	for (const prefix of ['$.budgets.', '$request.budgets.'])
		if (path?.startsWith(prefix) === true)
			return `$.budgets.commandDispatchTopology.${path.slice(prefix.length)}`;
	if (path?.startsWith('$request') === true) return null;
	return safeDiagnosticPath(path, repositoryRoot);
}

function predecessorDiagnostics(
	capture: CommandHandlerGraphReportPipelineCapture
): CommandDispatchTopologyReportDiagnostic[] {
	return capture.diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, capture.repositoryRoot),
			safeDiagnosticPath(diagnostic.path, capture.repositoryRoot),
			diagnostic.phase,
			'PREDECESSOR_PIPELINE',
			diagnostic.severity,
			diagnostic.source
		)
	);
}

function unavailablePredecessorDiagnostics(
	diagnostics: Extract<
		Awaited<ReturnType<typeof captureCommandHandlerGraphReportPipeline>>,
		{ readonly outcome: 'unavailable' }
	>['diagnostics']
): CommandDispatchTopologyReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			diagnostic.message,
			diagnostic.path,
			diagnostic.phase,
			'PREDECESSOR_PIPELINE',
			diagnostic.severity,
			diagnostic.source
		)
	);
}

function dispatchDiagnostics(
	diagnostics: readonly CommandDispatchTopologyBuildDiagnostic[],
	repositoryRoot: string
): CommandDispatchTopologyReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			nestedDispatchDiagnosticPath(diagnostic.path, repositoryRoot),
			diagnostic.phase,
			'COMMAND_DISPATCH_TOPOLOGY',
			diagnostic.code === 'GRAPH_PARTIAL' ? 'WARNING' : null
		)
	);
}

function failure(
	code: string,
	stage: CommandDispatchTopologyReportStage,
	state: CommandDispatchTopologyReportFailureState,
	diagnostics: readonly CommandDispatchTopologyReportDiagnostic[],
	request?: CommandDispatchTopologyReportRequest,
	subject?: CommandHandlerGraphReportPipelineCapture['frozenSubject']['descriptor']
): Extract<CommandDispatchTopologyReportOutcome, { readonly outcome: 'unavailable' }> {
	return {
		analysisAuthority: COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY,
		authorityTransfer: COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS,
		gateEffect: COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT,
		operationVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: COMMAND_DISPATCH_TOPOLOGY_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

function dispatchFailureState(
	diagnostics: readonly CommandDispatchTopologyBuildDiagnostic[]
): CommandDispatchTopologyReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXCEEDED'))
		return 'resource-refused';
	if (
		diagnostics.some((diagnostic) =>
			[
				'COMMAND_BUS_SELECTOR_MISMATCH',
				'REQUEST_INVALID',
				'SEMANTIC_CAPABILITY_UNAVAILABLE',
				'UNSUPPORTED_DISPATCH_PIPELINE'
			].includes(diagnostic.code)
		)
	)
		return 'incompatible';
	return 'failed';
}

function dispatchOutcomeEnvelopeReconciles(
	diagnostics: readonly CommandDispatchTopologyBuildDiagnostic[]
): boolean {
	return (
		diagnostics.length === 1 &&
		diagnostics[0]?.code === 'GRAPH_PARTIAL' &&
		diagnostics[0].phase === 'VALIDATE' &&
		diagnostics[0].path === null
	);
}

function predecessorObservations(
	capture: CommandHandlerGraphReportPipelineCapture,
	request: CommandDispatchTopologyReportRequest
): CommandDispatchTopologyReportProgressObservation[] {
	return [
		observation(
			'PREDECESSOR_SUBJECT_ARTIFACTS',
			capture.frozenSubject.artifacts.length,
			request.budgets.subject.maxFiles
		),
		observation(
			'PREDECESSOR_SEMANTIC_AST_NODES',
			capture.semanticSnapshot.astNodes.length,
			request.budgets.semantic.maxAstNodes
		),
		observation(
			'PREDECESSOR_ARROW_SITES',
			capture.observation.declaredSites.length,
			request.budgets.observation.maxDeclaredSites
		),
		observation(
			'PREDECESSOR_ARROW_OCCURRENCES',
			capture.observation.declaredArrows.length,
			request.budgets.observation.maxDeclaredArrowOccurrences
		),
		observation(
			'PREDECESSOR_COMMAND_HANDLER_NODES',
			capture.commandHandlerGraph.nodes.length,
			request.budgets.commandHandlerGraph.maxNodes
		),
		observation(
			'PREDECESSOR_COMMAND_HANDLER_EDGES',
			capture.commandHandlerGraph.edges.length,
			request.budgets.commandHandlerGraph.maxEdges
		)
	];
}

function dispatchObservations(
	graph: CommandDispatchTopologySnapshot,
	budgets: CommandDispatchTopologyBudgets
): CommandDispatchTopologyReportProgressObservation[] {
	return [
		observation('COMMAND_DISPATCH_NODES', graph.nodes.length, budgets.maxNodes),
		observation('COMMAND_DISPATCH_CANDIDATE_EDGES', graph.edges.length, budgets.maxEdges),
		observation('COMMAND_DISPATCH_PIPELINE_FACTS', graph.coverage.representedPipelineFacts, 5),
		observation(
			'COMMAND_DISPATCH_RETAINED_CENSUS_BYTES',
			graph.retainedCommandDispatchCensus.artifactBytes,
			null,
			'BYTES'
		)
	];
}

export interface CommandDispatchTopologyReportRuntimeDependencies {
	readonly buildTopology: typeof buildCommandDispatchTopology;
	readonly captureHandler: typeof captureCommandHandlerGraphReportPipeline;
	readonly selectCommandBus: typeof selectJpwbCommandDispatchTopology;
	readonly validateHandlerGraph: typeof validateCommandHandlerGraph;
	readonly validateObservation: typeof validateArrowCommandCensusObservation;
	readonly validateTopology: typeof validateCommandDispatchTopology;
	readonly verifySubject: typeof verifyFrozenSubject;
}

const DEFAULT_DEPENDENCIES: CommandDispatchTopologyReportRuntimeDependencies = Object.freeze({
	buildTopology: buildCommandDispatchTopology,
	captureHandler: captureCommandHandlerGraphReportPipeline,
	selectCommandBus: selectJpwbCommandDispatchTopology,
	validateHandlerGraph: validateCommandHandlerGraph,
	validateObservation: validateArrowCommandCensusObservation,
	validateTopology: validateCommandDispatchTopology,
	verifySubject: verifyFrozenSubject
});

function evidenceReconciles(
	capture: CommandHandlerGraphReportPipelineCapture,
	graph: CommandDispatchTopologySnapshot,
	commandBus: ReturnType<typeof selectJpwbCommandDispatchTopology>,
	request: CommandDispatchTopologyReportRequest,
	predecessorRequest: CommandHandlerGraphReportRequest,
	requireTrustedTopologyReplay: boolean
): boolean {
	const subject = capture.frozenSubject;
	const subjectId = subject.descriptor.subjectId;
	const snapshot = capture.semanticSnapshot;
	const observationValue = capture.observation;
	const handlerGraph = capture.commandHandlerGraph;
	const subjectScope = subject.request.scope;
	if (subjectScope.kind !== 'EXPLICIT_PROJECTS') return false;
	let actualAdditionalArtifactKeys: readonly string[];
	let expectedAdditionalArtifactKeys: readonly string[];
	try {
		actualAdditionalArtifactKeys = (subjectScope.additionalArtifacts ?? [])
			.map((path) => canonicalPathKey(assertCanonicalRelativePath(path)))
			.sort();
		expectedAdditionalArtifactKeys = [
			...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
			COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH
		]
			.map((path) => canonicalPathKey(assertCanonicalRelativePath(path)))
			.sort();
	} catch {
		return false;
	}
	let expectedCommandBus: ReturnType<typeof selectJpwbCommandDispatchTopology>;
	try {
		expectedCommandBus = selectJpwbCommandDispatchTopology(snapshot);
	} catch {
		return false;
	}
	const topologyRequest: BuildCommandDispatchTopologyRequest = {
		budgets: request.budgets.commandDispatchTopology,
		commandBus: expectedCommandBus,
		commandHandlerGraphId: handlerGraph.id,
		operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
		schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		subjectId
	};
	if (requireTrustedTopologyReplay) {
		let trustedOutcome: ReturnType<typeof buildCommandDispatchTopology>;
		try {
			trustedOutcome = buildCommandDispatchTopology(
				topologyRequest,
				snapshot,
				handlerGraph,
				observationValue,
				subject
			);
		} catch {
			return false;
		}
		if (
			trustedOutcome.outcome !== 'partial' ||
			!dispatchOutcomeEnvelopeReconciles(trustedOutcome.diagnostics) ||
			canonicalSemanticJson(trustedOutcome.graph) !== canonicalSemanticJson(graph)
		)
			return false;
	}
	let expectedRetainedCensus: ReturnType<typeof commandDispatchTopologyRetainedCensusReference>;
	let expectedGraphInputDigest: string;
	let expectedGraphId: CommandDispatchTopologySnapshot['id'];
	let expectedContentDigest: string;
	try {
		expectedRetainedCensus = commandDispatchTopologyRetainedCensusReference(subject);
		expectedGraphInputDigest = commandDispatchTopologyInputDigest(
			topologyRequest,
			snapshot,
			handlerGraph,
			observationValue,
			subject
		);
		expectedGraphId = commandDispatchTopologyGraphId({
			canonicalProfile: COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE,
			commandHandlerGraphId: handlerGraph.id,
			graphInputDigest: expectedGraphInputDigest,
			method: COMMAND_DISPATCH_TOPOLOGY_METHOD,
			operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
			schemaVersion: COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId
		});
		expectedContentDigest = commandDispatchTopologyContentDigest(graph);
	} catch {
		return false;
	}
	const retainedArtifacts = subject.artifacts.filter(
		(artifact) =>
			artifact.canonicalPathKey === canonicalPathKey(COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH)
	);
	const retainedArtifact = retainedArtifacts[0];
	const handlerTargets = handlerGraph.nodes.filter((node) => node.kind === 'HANDLER_TARGET');
	const handlerTargetIds = new Set(handlerTargets.map((node) => node.id));
	const handlerRegistrations = handlerGraph.nodes.filter(
		(node) => node.kind === 'HANDLER_REGISTRATION'
	);
	const registrationsWithSupport = new Set(
		handlerGraph.edges
			.filter((edge) => edge.relationKind === 'HANDLER_REGISTRATION_TO_TARGET')
			.map((edge) => edge.source.nodeId)
	);
	const unresolvedHandlerTargets = handlerRegistrations.filter(
		(registration) => !registrationsWithSupport.has(registration.id)
	).length;
	if (
		retainedArtifacts.length !== 1 ||
		retainedArtifact === undefined ||
		canonicalSemanticJson(capture.request) !== canonicalSemanticJson(predecessorRequest) ||
		canonicalSemanticJson(subject.request.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.subject) ||
		canonicalSemanticJson(subjectScope.projects) !==
			canonicalSemanticJson(predecessorRequest.subjectProjectConfigPaths) ||
		new Set(actualAdditionalArtifactKeys).size !== actualAdditionalArtifactKeys.length ||
		canonicalSemanticJson(actualAdditionalArtifactKeys) !==
			canonicalSemanticJson(expectedAdditionalArtifactKeys) ||
		snapshot.subjectId !== subjectId ||
		canonicalSemanticJson(snapshot.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.semantic) ||
		observationValue.subjectId !== subjectId ||
		capture.artifactSet.subjectId !== subjectId ||
		canonicalSemanticJson(observationValue.artifactSet) !==
			canonicalSemanticJson(capture.artifactSet) ||
		canonicalSemanticJson(observationValue.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.observation) ||
		handlerGraph.subjectId !== subjectId ||
		handlerGraph.semanticSnapshotId !== snapshot.id ||
		handlerGraph.arrowObservationId !== observationValue.id ||
		canonicalSemanticJson(handlerGraph.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.commandHandlerGraph) ||
		graph.subjectId !== subjectId ||
		graph.semanticSnapshotId !== snapshot.id ||
		graph.arrowObservationId !== observationValue.id ||
		graph.arrowObservationContentDigest !== observationValue.contentDigest ||
		graph.commandHandlerGraphId !== handlerGraph.id ||
		graph.commandHandlerGraphContentDigest !== handlerGraph.contentDigest ||
		graph.commandHandlerGraphSchemaVersion !== handlerGraph.schemaVersion ||
		canonicalSemanticJson(commandBus) !== canonicalSemanticJson(expectedCommandBus) ||
		canonicalSemanticJson(graph.commandBus) !== canonicalSemanticJson(expectedCommandBus) ||
		graph.graphInputDigest !== expectedGraphInputDigest ||
		graph.id !== expectedGraphId ||
		graph.contentDigest !== expectedContentDigest ||
		canonicalSemanticJson(graph.budgets) !==
			canonicalSemanticJson(request.budgets.commandDispatchTopology) ||
		graph.schemaVersion !== COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION ||
		graph.operationVersion !== COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION ||
		graph.canonicalProfile !== COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE ||
		graph.graphKind !== 'JPWB_COMMAND_DISPATCH_STATIC_TOPOLOGY_OVERLAY' ||
		graph.method !== COMMAND_DISPATCH_TOPOLOGY_METHOD ||
		graph.capabilityStatus !== COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS ||
		graph.registryStatus !== COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS ||
		graph.scope !== COMMAND_DISPATCH_TOPOLOGY_SCOPE ||
		graph.graphAuthority !== COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY ||
		graph.authorityTransfer !== COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER ||
		graph.gateEffect !== COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT ||
		graph.oracleChange !== COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE ||
		graph.baselineChange !== COMMAND_DISPATCH_TOPOLOGY_BASELINE_CHANGE ||
		graph.integrationStrategy !== COMMAND_DISPATCH_TOPOLOGY_INTEGRATION_STRATEGY ||
		graph.replacementEquivalence !== COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE ||
		canonicalSemanticJson(graph.producer) !== canonicalSemanticJson(snapshot.provider) ||
		graph.semanticExtractionVersion !== snapshot.extractionVersion ||
		graph.semanticSchemaVersion !== snapshot.schemaVersion ||
		graph.commandHandlerPopulationTreatment !==
			COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT ||
		graph.retainedCommandDispatchCensusIntegration !==
			COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION ||
		graph.runtimeDispatchClosure !== COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE ||
		graph.runtimePerformability !== COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY ||
		graph.fullJanCsaa007Conformance !== COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE ||
		graph.fullJanCsaa008Conformance !== COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE ||
		graph.health !== 'PARTIAL' ||
		graph.capabilities.length !== 2 ||
		graph.capabilities[0] !== COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY ||
		graph.capabilities[1] !== COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY ||
		canonicalSemanticJson(graph.limitations) !==
			canonicalSemanticJson(COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS) ||
		canonicalSemanticJson(graph.retainedCommandDispatchCensus) !==
			canonicalSemanticJson(expectedRetainedCensus) ||
		!graph.coverage.reconciles ||
		graph.coverage.pipelineNodes !== 1 ||
		graph.coverage.representedPipelineFacts !== 5 ||
		graph.coverage.commandsLookupAssignments !== 1 ||
		graph.coverage.handlersLookupAssignments !== 1 ||
		graph.coverage.missingHandlerGuards !== 1 ||
		graph.coverage.payloadValidationInvocations !== 1 ||
		graph.coverage.handlerInvocations !== 1 ||
		graph.coverage.candidateHandlerTargetEdges !== graph.edges.length ||
		graph.coverage.commandHandlerGraphHandlerTargets !== handlerTargets.length ||
		graph.coverage.referencedHandlerTargets !== graph.edges.length ||
		graph.coverage.unresolvedHandlerTargets !== unresolvedHandlerTargets ||
		graph.coverage.duplicatedCommandHandlerNodes !== 0 ||
		graph.coverage.duplicatedCommandRegistryEntries !== 0 ||
		graph.coverage.duplicatedHandlerRegistrations !== 0 ||
		graph.nodes.length !== 1 ||
		graph.nodes[0]!.id !==
			commandDispatchPipelineNodeId(expectedGraphId, expectedCommandBus.declarationId) ||
		graph.layers.length !== 2 ||
		graph.layers[0]!.id !== commandDispatchTopologyDerivationLayerId(expectedGraphId) ||
		graph.layers[0]!.ordinal !== 0 ||
		graph.layers[0]!.kind !== 'JPWB_COMMAND_DISPATCH_DERIVATION' ||
		graph.layers[0]!.capability !== COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY ||
		canonicalSemanticJson(graph.layers[0]!.nodeIds) !==
			canonicalSemanticJson(graph.nodes.map((node) => node.id)) ||
		graph.layers[0]!.edgeIds.length !== 0 ||
		graph.layers[1]!.id !== commandDispatchTopologyInferenceLayerId(expectedGraphId) ||
		graph.layers[1]!.ordinal !== 1 ||
		graph.layers[1]!.kind !== 'JPWB_COMMAND_DISPATCH_HANDLER_TARGET_INFERENCE' ||
		graph.layers[1]!.capability !== COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY ||
		graph.layers[1]!.nodeIds.length !== 0 ||
		canonicalSemanticJson(graph.layers[1]!.edgeIds) !==
			canonicalSemanticJson(graph.edges.map((edge) => edge.id)) ||
		graph.layers.some(
			(layer) =>
				canonicalSemanticJson(layer.coverage) !== canonicalSemanticJson(graph.coverage) ||
				canonicalSemanticJson(layer.limitations) !==
					canonicalSemanticJson(COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS) ||
				canonicalSemanticJson(layer.producer) !== canonicalSemanticJson(snapshot.provider)
		) ||
		graph.forwardIndex.length !== 1 ||
		graph.forwardIndex[0]!.endpointOwner !== 'COMMAND_DISPATCH_TOPOLOGY' ||
		graph.forwardIndex[0]!.graphId !== expectedGraphId ||
		graph.forwardIndex[0]!.nodeId !== graph.nodes[0]!.id ||
		canonicalSemanticJson(graph.forwardIndex[0]!.edgeIds) !==
			canonicalSemanticJson(graph.edges.map((edge) => edge.id)) ||
		graph.reverseIndex.length !== graph.edges.length ||
		graph.reverseIndex.some(
			(entry) =>
				entry.endpointOwner !== 'COMMAND_HANDLER_GRAPH' ||
				entry.graphId !== handlerGraph.id ||
				entry.edgeIds.length !== 1 ||
				!handlerTargetIds.has(entry.nodeId) ||
				!graph.edges.some(
					(edge) => edge.id === entry.edgeIds[0] && edge.target.nodeId === entry.nodeId
				)
		) ||
		graph.edges.some(
			(edge) =>
				edge.attribution !== 'CANDIDATE' ||
				edge.method !== COMMAND_DISPATCH_TOPOLOGY_METHOD ||
				edge.relationCode !== 'IMPL-JPWB-CD-DISPATCH-TARGET-001' ||
				edge.relationKind !== 'STATIC_DISPATCH_PIPELINE_TO_HANDLER_TARGET' ||
				edge.source.kind !== 'STATIC_DISPATCH_PIPELINE' ||
				edge.target.kind !== 'HANDLER_TARGET' ||
				!handlerTargetIds.has(edge.target.nodeId) ||
				edge.registeredCommandNames.length === 0
		) ||
		graph.retainedCommandDispatchCensus.artifactPath !==
			COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH ||
		graph.retainedCommandDispatchCensus.artifactBytes !== retainedArtifact.bytes ||
		graph.retainedCommandDispatchCensus.artifactContentSha256 !== retainedArtifact.sha256 ||
		graph.retainedCommandDispatchCensus.execution !==
			COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION ||
		graph.retainedCommandDispatchCensus.integration !==
			COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION ||
		graph.retainedCommandDispatchCensus.verifierAuthority !==
			COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY
	)
		return false;
	return (
		graph.nodes.every(
			(node) =>
				node.subjectId === subjectId &&
				node.semanticSnapshotId === snapshot.id &&
				node.commandHandlerGraphId === handlerGraph.id
		) &&
		graph.edges.every(
			(edge) =>
				edge.subjectId === subjectId &&
				edge.semanticSnapshotId === snapshot.id &&
				edge.commandHandlerGraphId === handlerGraph.id &&
				edge.target.graphId === handlerGraph.id &&
				edge.source.graphId === graph.id
		) &&
		graph.layers.every(
			(layer) =>
				layer.subjectId === subjectId &&
				layer.semanticSnapshotId === snapshot.id &&
				layer.commandHandlerGraphId === handlerGraph.id
		)
	);
}

async function runInternal(
	requestValue: unknown,
	options: RunCommandDispatchTopologyReportOptions,
	progress: ProgressRecorder,
	dependencies: CommandDispatchTopologyReportRuntimeDependencies
): Promise<CommandDispatchTopologyReportOutcome> {
	progress.start('REQUEST_BIND');
	let admission: CommandDispatchTopologyReportAdmission;
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
	const predecessor = await dependencies.captureHandler(admission.predecessorRequest, {
		additionalArtifacts: [COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH],
		onProgress: (event) => progress.forwardPredecessor(event),
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
	const inheritedDiagnostics = predecessorDiagnostics(predecessor);
	const observationValidation = dependencies.validateObservation(
		predecessor.observation,
		predecessor.frozenSubject,
		{ maxIssues: Math.max(1, Math.min(1_000, request.budgets.observation.maxDiagnostics)) }
	);
	const handlerValidation = dependencies.validateHandlerGraph(
		predecessor.commandHandlerGraph,
		predecessor.semanticSnapshot,
		predecessor.observation,
		predecessor.frozenSubject,
		{ maxIssues: Math.max(1, Math.min(1_000, request.budgets.semantic.maxDiagnostics)) }
	);
	if (observationValidation.state !== 'VALID' || handlerValidation.state !== 'VALID') {
		progress.fail([], 'PREDECESSOR_VALIDATION_FAILED');
		const validationIssues = [...observationValidation.issues, ...handlerValidation.issues];
		return failure(
			'PREDECESSOR_VALIDATION_FAILED',
			'PREDECESSOR_PIPELINE',
			observationValidation.state === 'BUDGET_EXHAUSTED' ||
				handlerValidation.state === 'BUDGET_EXHAUSTED'
				? 'resource-refused'
				: 'failed',
			[
				...inheritedDiagnostics,
				...validationIssues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, predecessor.repositoryRoot),
						safeDiagnosticPath(issue.path, predecessor.repositoryRoot),
						'VALIDATE',
						'PREDECESSOR_PIPELINE',
						'ERROR'
					)
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(
		predecessorObservations(predecessor, request),
		'SAME_SUBJECT_COMMAND_HANDLER_PIPELINE_AND_RETAINED_DISPATCH_CENSUS_CAPTURED'
	);

	progress.start('COMMAND_DISPATCH_TOPOLOGY');
	let commandBus: ReturnType<typeof selectJpwbCommandDispatchTopology>;
	try {
		commandBus = dependencies.selectCommandBus(predecessor.semanticSnapshot);
	} catch {
		progress.fail([], 'COMMAND_BUS_SELECTION_UNAVAILABLE');
		return failure(
			'COMMAND_BUS_SELECTION_UNAVAILABLE',
			'COMMAND_DISPATCH_TOPOLOGY',
			'incompatible',
			[
				...inheritedDiagnostics,
				reportDiagnostic(
					'COMMAND_BUS_SELECTION_UNAVAILABLE',
					'The exact JPWB command-bus dispatchStamped method could not be selected uniquely.',
					null,
					'BIND',
					'COMMAND_DISPATCH_TOPOLOGY',
					'ERROR'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const topologyRequest: BuildCommandDispatchTopologyRequest = {
		budgets: request.budgets.commandDispatchTopology,
		commandBus,
		commandHandlerGraphId: predecessor.commandHandlerGraph.id,
		operationVersion: COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION,
		schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: predecessor.semanticSnapshot.id,
		subjectId: predecessor.frozenSubject.descriptor.subjectId
	};
	const topologyOutcome = dependencies.buildTopology(
		topologyRequest,
		predecessor.semanticSnapshot,
		predecessor.commandHandlerGraph,
		predecessor.observation,
		predecessor.frozenSubject
	);
	const topologyDiagnostics = dispatchDiagnostics(
		topologyOutcome.diagnostics,
		predecessor.repositoryRoot
	);
	if (topologyOutcome.outcome !== 'partial') {
		progress.fail(
			[],
			topologyOutcome.diagnostics[0]?.code ?? 'COMMAND_DISPATCH_TOPOLOGY_UNAVAILABLE'
		);
		return failure(
			'COMMAND_DISPATCH_TOPOLOGY_UNAVAILABLE',
			'COMMAND_DISPATCH_TOPOLOGY',
			dispatchFailureState(topologyOutcome.diagnostics),
			[...inheritedDiagnostics, ...topologyDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const topology = topologyOutcome.graph;
	const topologyValidation = dependencies.validateTopology(
		topology,
		topologyRequest,
		predecessor.semanticSnapshot,
		predecessor.commandHandlerGraph,
		predecessor.observation,
		predecessor.frozenSubject,
		{
			maxIssues: Math.max(
				1,
				Math.min(1_000, request.budgets.commandDispatchTopology.maxDiagnostics)
			),
			maxRecords: DISPATCH_VALIDATION_MAX_RECORDS,
			maxStringCharacters: DISPATCH_VALIDATION_MAX_STRING_CHARACTERS
		}
	);
	if (topologyValidation.state !== 'VALID') {
		progress.fail(
			dispatchObservations(topology, request.budgets.commandDispatchTopology),
			'TOPOLOGY_VALIDATION_FAILED'
		);
		return failure(
			'TOPOLOGY_VALIDATION_FAILED',
			'COMMAND_DISPATCH_TOPOLOGY',
			topologyValidation.state === 'BUDGET_EXHAUSTED' ? 'resource-refused' : 'failed',
			[
				...inheritedDiagnostics,
				...topologyValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, predecessor.repositoryRoot),
						nestedDispatchDiagnosticPath(issue.path, predecessor.repositoryRoot),
						'VALIDATE',
						'COMMAND_DISPATCH_TOPOLOGY',
						'ERROR'
					)
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	if (!dispatchOutcomeEnvelopeReconciles(topologyOutcome.diagnostics)) {
		progress.fail(
			dispatchObservations(topology, request.budgets.commandDispatchTopology),
			'TOPOLOGY_OUTCOME_MISMATCH'
		);
		return failure(
			'TOPOLOGY_OUTCOME_MISMATCH',
			'COMMAND_DISPATCH_TOPOLOGY',
			'failed',
			[
				...inheritedDiagnostics,
				...topologyDiagnostics,
				reportDiagnostic(
					'TOPOLOGY_OUTCOME_MISMATCH',
					'The command-dispatch topology partial outcome lacks its required explicit frontier diagnostic.',
					null,
					'VALIDATE',
					'COMMAND_DISPATCH_TOPOLOGY',
					'ERROR'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(
		dispatchObservations(topology, request.budgets.commandDispatchTopology),
		'PARTIAL_OPEN_STATIC_DISPATCH_TOPOLOGY'
	);

	progress.start('CURRENTNESS');
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		freshness = dependencies.verifySubject(predecessor.frozenSubject, {
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
	if (
		!evidenceReconciles(
			predecessor,
			topology,
			commandBus,
			request,
			admission.predecessorRequest,
			dependencies.buildTopology !== buildCommandDispatchTopology ||
				dependencies.validateTopology !== validateCommandDispatchTopology
		)
	) {
		progress.fail([], 'EVIDENCE_IDENTITY_MISMATCH');
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				...inheritedDiagnostics,
				...topologyDiagnostics,
				...currentnessDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The semantic capture, retained arrow observation, command-handler graph, retained dispatch census, selector, and command-dispatch topology do not reconcile with one exact frozen subject.',
					null,
					'VALIDATE',
					'REPORT',
					'ERROR'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const stageOutcomes: CommandDispatchTopologyReportStageOutcomes = {
		commandDispatchTopology: {
			diagnosticCodes: topologyOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial'
		},
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		},
		predecessorPipeline: predecessor.predecessorStageOutcomes
	};
	const report: CommandDispatchTopologyReportOutcome = {
		analysisAuthority: COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY,
		authorityTransfer: COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [...inheritedDiagnostics, ...topologyDiagnostics, ...currentnessDiagnostics],
		gateEffect: COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT,
		operationVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				commandHandlerPopulationTreatment:
					COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT,
				derivationCapability: COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY,
				facadeScope: COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE,
				fullJanCsaa007Conformance: COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE,
				fullJanCsaa008Conformance: COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE,
				graphAuthority: COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY,
				id: COMMAND_DISPATCH_TOPOLOGY_REPORT_CAPABILITY_ID,
				inferenceCapability: COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY,
				registryStatus: COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS,
				retainedDispatchCensusExecution: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION,
				retainedDispatchCensusIntegration: COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
				retainedDispatchCensusVerifierAuthority:
					COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY,
				runtimeDispatchClosure: COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE,
				runtimePerformability: COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY,
				scope: COMMAND_DISPATCH_TOPOLOGY_SCOPE,
				status: COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS
			},
			coverage: {
				...topology.coverage,
				edges: topology.edges.length,
				health: topology.health,
				limitations: topology.limitations.length,
				nodes: topology.nodes.length
			},
			currentness: {
				changedPaths: freshness.changedPaths,
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			evidence: {
				commandDispatchTopology: topology,
				commandHandlerGraph: predecessor.commandHandlerGraph,
				encoding: 'FULL_VALIDATED_RETAINED_ARROW_COMMAND_HANDLER_AND_COMMAND_DISPATCH_EVIDENCE',
				observation: predecessor.observation
			},
			facadeNonclaims: COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_SAME_SUBJECT_STATIC_COMMAND_DISPATCH_TOPOLOGY',
			predecessorNonclaims: COMMAND_DISPATCH_TOPOLOGY_REPORT_PREDECESSOR_NONCLAIMS,
			schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_RESULT_SCHEMA_VERSION,
			selection: COMMAND_DISPATCH_TOPOLOGY_REPORT_SELECTION,
			semanticSnapshotSummary: {
				astNodes: predecessor.semanticSnapshot.astNodes.length,
				id: predecessor.semanticSnapshot.id,
				programs: predecessor.semanticSnapshot.programs.length,
				projects: predecessor.semanticSnapshot.projects.length,
				sources: predecessor.semanticSnapshot.sources.length
			}
		},
		schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_SCHEMA_VERSION,
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
						'The admitted command-dispatch-topology report exceeds maxResultBytes.'
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

/** @internal Test seam; intentionally not exported from the package root. */
export async function runCommandDispatchTopologyReportWithDependencies(
	requestValue: unknown,
	options: RunCommandDispatchTopologyReportOptions,
	dependencies: CommandDispatchTopologyReportRuntimeDependencies
): Promise<CommandDispatchTopologyReportOutcome> {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(await runInternal(requestValue, options, progress, dependencies));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic('INTERNAL_FAILURE', 'The command-dispatch-topology report failed closed.')
			])
		);
	}
}

export async function runCommandDispatchTopologyReport(
	requestValue: unknown,
	options: RunCommandDispatchTopologyReportOptions
): Promise<CommandDispatchTopologyReportOutcome> {
	return runCommandDispatchTopologyReportWithDependencies(
		requestValue,
		options,
		DEFAULT_DEPENDENCIES
	);
}

export function commandDispatchTopologyReportExitCode(
	outcome: CommandDispatchTopologyReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
