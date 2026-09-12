import { isAbsolute } from 'node:path';

import {
	COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	type CommandHandlerGraphReportRequest
} from '../contracts/command-handler-graph-report.js';
import {
	COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
	type BuildCommandHandlerGraphRequest
} from '../contracts/command-handler-graph.js';
import {
	COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER,
	COMMAND_EVENT_CONTRACT_OVERLAY_BASELINE_CHANGE,
	COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS,
	COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_GRAPH_AUTHORITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_INTEGRATION_STRATEGY,
	COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_STATUS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_AUTHORITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_EXECUTION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_INTEGRATION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
	COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_SCOPE,
	COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH,
	type BuildCommandEventContractOverlayRequest,
	type CommandEventContractOverlayBudgets,
	type CommandEventContractOverlayBuildInputs,
	type CommandEventContractOverlayDiagnostic,
	type CommandEventContractOverlayProgressEvent,
	type CommandEventContractOverlaySnapshot
} from '../contracts/command-event-contract-overlay.js';
import {
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_CAPABILITY_ID,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_NONCLAIMS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_RESULT_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SAFETY_CEILINGS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCOPE,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SELECTION,
	type CommandEventContractOverlayReportDiagnostic,
	type CommandEventContractOverlayReportFailureState,
	type CommandEventContractOverlayReportOutcome,
	type CommandEventContractOverlayReportRequest,
	type CommandEventContractOverlayReportStage,
	type CommandEventContractOverlayReportStageOutcomes
} from '../contracts/command-event-contract-overlay-report.js';
import type { SubjectDiagnostic } from '../contracts/subject.js';
import {
	buildCommandEventContractOverlay,
	selectJpwbCommandEventContractOverlayInputs
} from '../graph/build-command-event-contract-overlay.js';
import { selectJpwbCommandHandlerRegistries } from '../graph/build-command-handler-graph.js';
import { commandEventContractOverlayInputDigest } from '../graph/command-event-contract-overlay-canonical.js';
import { commandHandlerGraphInputDigest } from '../graph/command-handler-graph-canonical.js';
import { validateCommandEventContractOverlay } from '../graph/validate-command-event-contract-overlay.js';
import { validateCommandHandlerGraph } from '../graph/validate-command-handler-graph.js';
import { ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS } from '../providers/jpwb-arrow-command-census/artifact-set.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
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
	'commandEventContractOverlay',
	'commandHandlerGraph',
	'maxResultBytes',
	'observation',
	'semantic',
	'subject'
] as const;
const OVERLAY_BUDGET_KEYS = [
	'maxAstNodes',
	'maxBoundContributions',
	'maxCommands',
	'maxDeclaredLinks',
	'maxDiagnostics',
	'maxEventContracts',
	'maxFrontiers',
	'maxPinnedEmissions',
	'maxSourceBytes'
] as const satisfies readonly (keyof CommandEventContractOverlayBudgets)[];
const MAX_DIAGNOSTIC_PATH_CHARACTERS = 10_000;
const VALIDATION_MAX_RECORDS = 10_000_000;
const VALIDATION_MAX_STRING_CHARACTERS = 1_000_000_000;

interface CommandEventContractOverlayReportAdmission {
	readonly overlayBudgets: CommandEventContractOverlayBudgets;
	readonly predecessorRequest: CommandHandlerGraphReportRequest;
}

export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-command-event-contract-overlay-report-progress/0.1.0' as const;

export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type CommandEventContractOverlayReportProgressPhase =
	| 'REQUEST_BIND'
	| 'PREDECESSOR_PIPELINE'
	| 'COMMAND_EVENT_CONTRACT_OVERLAY'
	| 'CURRENTNESS'
	| 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	COMMAND_EVENT_CONTRACT_OVERLAY: 'COMMAND_EVENT_CONTRACT_OVERLAY',
	CURRENTNESS: 'CURRENTNESS',
	PREDECESSOR_PIPELINE: 'PREDECESSOR_PIPELINE',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT'
} as const satisfies Readonly<
	Record<CommandEventContractOverlayReportProgressPhase, CommandEventContractOverlayReportStage>
>);

export type CommandEventContractOverlayReportProgressObservationMetric =
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'OVERLAY_BOUND_CONTRIBUTIONS'
	| 'OVERLAY_COMMANDS'
	| 'OVERLAY_DECLARED_LINKS'
	| 'OVERLAY_EVENT_CONTRACTS'
	| 'OVERLAY_FRONTIERS'
	| 'OVERLAY_PINNED_EMISSIONS'
	| 'OVERLAY_RETAINED_CENSUS_BYTES'
	| 'OVERLAY_VOCAB_BYTES'
	| 'PREDECESSOR_ARROW_OCCURRENCES'
	| 'PREDECESSOR_COMMAND_HANDLER_EDGES'
	| 'PREDECESSOR_COMMAND_HANDLER_NODES'
	| 'PREDECESSOR_SEMANTIC_AST_NODES'
	| 'PREDECESSOR_SUBJECT_ARTIFACTS'
	| 'RESULT_BYTES';

export interface CommandEventContractOverlayReportProgressObservation {
	readonly limit: number | null;
	readonly metric: CommandEventContractOverlayReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT';
	readonly value: number;
}

export interface CommandEventContractOverlayReportProgressEvent {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly kind: 'REPORT_STAGE' | 'PREDECESSOR_REPORT' | 'OVERLAY_BUILDER';
	readonly nonclaims: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly CommandEventContractOverlayReportProgressObservation[];
	readonly operationVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION;
	readonly overlayProgress: CommandEventContractOverlayProgressEvent | null;
	readonly phase: CommandEventContractOverlayReportProgressPhase;
	readonly predecessorProgress: CommandHandlerGraphReportProgressEvent | null;
	readonly protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: CommandEventContractOverlayReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

export interface RunCommandEventContractOverlayReportOptions {
	readonly onProgress?: (event: CommandEventContractOverlayReportProgressEvent) => unknown;
	readonly repositoryRoot: string;
}

interface ProgressRecorder {
	complete(
		observations?: readonly CommandEventContractOverlayReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly CommandEventContractOverlayReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(
		outcome: CommandEventContractOverlayReportOutcome
	): CommandEventContractOverlayReportOutcome;
	forwardOverlay(event: CommandEventContractOverlayProgressEvent): void;
	forwardPredecessor(event: CommandHandlerGraphReportProgressEvent): void;
	start(
		phase: CommandEventContractOverlayReportProgressPhase,
		observations?: readonly CommandEventContractOverlayReportProgressObservation[]
	): void;
}

function progressObservation(
	metric: CommandEventContractOverlayReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: CommandEventContractOverlayReportProgressObservation['unit'] = 'COUNT'
): CommandEventContractOverlayReportProgressObservation {
	return Object.freeze({
		limit,
		metric,
		unit,
		value: Number.isFinite(value) && value >= 0 ? Math.min(value, Number.MAX_SAFE_INTEGER) : 0
	});
}

function progressSink(
	options: RunCommandEventContractOverlayReportOptions
): ((event: CommandEventContractOverlayReportProgressEvent) => unknown) | undefined {
	try {
		if (options === null || typeof options !== 'object' || isProxyValue(options)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: CommandEventContractOverlayReportProgressEvent) => unknown)
			: undefined;
	} catch {
		return undefined;
	}
}

function createProgressRecorder(
	options: RunCommandEventContractOverlayReportOptions
): ProgressRecorder {
	const sink = progressSink(options);
	const started = performance.now();
	let sequence = 0;
	let active: CommandEventContractOverlayReportProgressPhase | null = null;
	const clone = <T>(event: T): T | null => {
		try {
			return JSON.parse(canonicalSemanticJson(event)) as T;
		} catch {
			return null;
		}
	};
	const emit = (
		kind: CommandEventContractOverlayReportProgressEvent['kind'],
		phase: CommandEventContractOverlayReportProgressPhase,
		state: CommandEventContractOverlayReportProgressEvent['state'],
		observations: readonly CommandEventContractOverlayReportProgressObservation[],
		detailCode: string | null,
		predecessorProgress: CommandHandlerGraphReportProgressEvent | null,
		overlayProgress: CommandEventContractOverlayProgressEvent | null
	): void => {
		if (sink === undefined) return;
		const event = Object.freeze({
			deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' as const,
			detailCode,
			elapsedMs: Math.max(0, Math.round(performance.now() - started)),
			kind,
			nonclaims: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
			observations,
			operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
			overlayProgress,
			phase,
			predecessorProgress,
			protocolRole:
				'PRELIMINARY_TYPESCRIPT_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_TELEMETRY' as const,
			reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
			schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_SCHEMA_VERSION,
			sequence: ++sequence,
			stage: PROGRESS_PHASE_STAGE[phase],
			state,
			wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET' as const
		});
		try {
			const result = sink(event);
			if (result !== undefined) void Promise.resolve(result).catch(() => undefined);
		} catch {
			// Best-effort telemetry cannot alter terminal evidence.
		}
	};
	const close = (
		state: 'COMPLETED' | 'FAILED',
		observations: readonly CommandEventContractOverlayReportProgressObservation[],
		detailCode: string | null
	): void => {
		if (active === null) return;
		const phase = active;
		active = null;
		emit('REPORT_STAGE', phase, state, observations, detailCode, null, null);
	};
	return {
		complete(observations = [], detailCode = null): void {
			close('COMPLETED', observations, detailCode);
		},
		fail(observations = [], detailCode = null): void {
			close('FAILED', observations, detailCode);
		},
		finish(outcome): CommandEventContractOverlayReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			return outcome;
		},
		forwardOverlay(event): void {
			const detached = clone(event);
			if (detached !== null)
				emit(
					'OVERLAY_BUILDER',
					'COMMAND_EVENT_CONTRACT_OVERLAY',
					detached.state,
					[],
					detached.detailCode,
					null,
					detached
				);
		},
		forwardPredecessor(event): void {
			const detached = clone(event);
			if (detached !== null)
				emit(
					'PREDECESSOR_REPORT',
					'PREDECESSOR_PIPELINE',
					detached.state,
					[],
					detached.detailCode,
					detached,
					null
				);
		},
		start(phase, observations = []): void {
			if (active !== null) close('FAILED', [], 'STAGE_INTERRUPTED');
			active = phase;
			emit('REPORT_STAGE', phase, 'STARTED', observations, null, null, null);
		}
	};
}

class ReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly path: string,
		readonly state: CommandEventContractOverlayReportFailureState = 'incompatible'
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
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', path + ' must be an exact object.', path);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', path + ' must be a data object.', path);
	const keys = Reflect.ownKeys(value);
	if (
		keys.some((key) => typeof key !== 'string') ||
		keys.length !== expectedKeys.length ||
		expectedKeys.some((key) => !keys.includes(key))
	)
		throw new ReportRequestError('REQUEST_SHAPE_INVALID', path + ' has unexpected keys.', path);
	const materialized: Record<string, unknown> = {};
	for (const key of expectedKeys) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			throw new ReportRequestError(
				'REQUEST_SHAPE_INVALID',
				path + '.' + key + ' must be an enumerable data property.',
				path + '.' + key
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
			path + ' must be a positive safe integer.',
			path
		);
	if (value > ceiling)
		throw new ReportRequestError(
			'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			path + ' exceeds the operation safety ceiling.',
			path,
			'resource-refused'
		);
	return value;
}

function materializeAdmission(value: unknown): CommandEventContractOverlayReportAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	if (record.executionSelection !== COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION)
		throw new ReportRequestError(
			'RETAINED_EXECUTION_NOT_ACKNOWLEDGED',
			'$.executionSelection must explicitly acknowledge retained predecessor execution.',
			'$.executionSelection'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const overlayRecord = exactDataRecord(
		budgets.commandEventContractOverlay,
		OVERLAY_BUDGET_KEYS,
		'$.budgets.commandEventContractOverlay'
	);
	const overlayBudgets = Object.freeze(
		Object.fromEntries(
			OVERLAY_BUDGET_KEYS.map((key) => [
				key,
				boundedBudget(
					overlayRecord[key],
					COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SAFETY_CEILINGS.commandEventContractOverlay[key],
					'$.budgets.commandEventContractOverlay.' + key
				)
			])
		) as unknown as CommandEventContractOverlayBudgets
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
		executionSelection: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION,
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
	return Object.freeze({ overlayBudgets, predecessorRequest: predecessorAdmission.request });
}

function materializedRequest(
	admission: CommandEventContractOverlayReportAdmission
): CommandEventContractOverlayReportRequest {
	return Object.freeze({
		budgets: Object.freeze({
			...admission.predecessorRequest.budgets,
			commandEventContractOverlay: admission.overlayBudgets
		}),
		executionSelection: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION,
		operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
		schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: admission.predecessorRequest.subjectProjectConfigPaths
	});
}

export type CommandEventContractOverlayReportRequestAdmission =
	| { readonly outcome: 'admitted'; readonly request: CommandEventContractOverlayReportRequest }
	| {
			readonly code: string;
			readonly message: string;
			readonly outcome: 'rejected';
			readonly path: string;
			readonly state: CommandEventContractOverlayReportFailureState;
	  };

/** @internal Exact hostile-safe admission seam; intentionally not package-root exported. */
export function admitCommandEventContractOverlayReportRequest(
	value: unknown
): CommandEventContractOverlayReportRequestAdmission {
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
	source: CommandEventContractOverlayReportDiagnostic['source'] = 'REPORT',
	severity: CommandEventContractOverlayReportDiagnostic['severity'] = null,
	predecessorSource: CommandEventContractOverlayReportDiagnostic['predecessorSource'] = null
): CommandEventContractOverlayReportDiagnostic {
	return { code, message, path, phase, predecessorSource, severity, source };
}

function escapedRegularExpression(text: string): string {
	return text.replace(/[.*+?^{}$()|[\]\\]/gu, '\\$&');
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

function nestedOverlayDiagnosticPath(path: string | null, repositoryRoot: string): string | null {
	if (path === '$.budgets' || path === '$request.budgets')
		return '$.budgets.commandEventContractOverlay';
	for (const prefix of ['$.budgets.', '$request.budgets.'])
		if (path?.startsWith(prefix) === true)
			return '$.budgets.commandEventContractOverlay.' + path.slice(prefix.length);
	if (path?.startsWith('$request') === true) return null;
	return safeDiagnosticPath(path, repositoryRoot);
}

function predecessorDiagnostics(
	capture: CommandHandlerGraphReportPipelineCapture
): CommandEventContractOverlayReportDiagnostic[] {
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
): CommandEventContractOverlayReportDiagnostic[] {
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

function projectedOverlayDiagnostics(
	diagnostics: readonly CommandEventContractOverlayDiagnostic[],
	repositoryRoot: string
): CommandEventContractOverlayReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			nestedOverlayDiagnosticPath(diagnostic.path, repositoryRoot),
			diagnostic.phase,
			'COMMAND_EVENT_CONTRACT_OVERLAY',
			diagnostic.code === 'BUDGET_EXCEEDED' ? 'ERROR' : null
		)
	);
}

function failure(
	code: string,
	stage: CommandEventContractOverlayReportStage,
	state: CommandEventContractOverlayReportFailureState,
	diagnostics: readonly CommandEventContractOverlayReportDiagnostic[],
	request?: CommandEventContractOverlayReportRequest,
	subject?: CommandHandlerGraphReportPipelineCapture['frozenSubject']['descriptor']
): Extract<CommandEventContractOverlayReportOutcome, { readonly outcome: 'unavailable' }> {
	return {
		analysisAuthority: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY,
		authorityTransfer: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_NONCLAIMS,
		gateEffect: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT,
		operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

function overlayFailureState(
	diagnostics: readonly CommandEventContractOverlayDiagnostic[]
): CommandEventContractOverlayReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code === 'BUDGET_EXCEEDED'))
		return 'resource-refused';
	if (
		diagnostics.some((diagnostic) =>
			[
				'REQUEST_INVALID',
				'SEMANTIC_CAPABILITY_UNAVAILABLE',
				'SUBJECT_CAPABILITY_UNAVAILABLE',
				'UNSUPPORTED_GENERATED_REGISTRY',
				'UNSUPPORTED_RETAINED_CENSUS',
				'UNSUPPORTED_VOCAB'
			].includes(diagnostic.code)
		)
	)
		return 'incompatible';
	return 'failed';
}

function repositoryRootOption(options: RunCommandEventContractOverlayReportOptions): string {
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
	return descriptor.value;
}

function predecessorObservations(
	capture: CommandHandlerGraphReportPipelineCapture,
	request: CommandEventContractOverlayReportRequest
): readonly CommandEventContractOverlayReportProgressObservation[] {
	return [
		progressObservation(
			'PREDECESSOR_SUBJECT_ARTIFACTS',
			capture.frozenSubject.artifacts.length,
			request.budgets.subject.maxFiles
		),
		progressObservation(
			'PREDECESSOR_SEMANTIC_AST_NODES',
			capture.semanticSnapshot.astNodes.length,
			request.budgets.semantic.maxAstNodes
		),
		progressObservation(
			'PREDECESSOR_ARROW_OCCURRENCES',
			capture.observation.declaredArrows.length,
			request.budgets.observation.maxDeclaredArrowOccurrences
		),
		progressObservation(
			'PREDECESSOR_COMMAND_HANDLER_NODES',
			capture.commandHandlerGraph.nodes.length,
			request.budgets.commandHandlerGraph.maxNodes
		),
		progressObservation(
			'PREDECESSOR_COMMAND_HANDLER_EDGES',
			capture.commandHandlerGraph.edges.length,
			request.budgets.commandHandlerGraph.maxEdges
		)
	];
}

function overlayObservations(
	overlay: CommandEventContractOverlaySnapshot,
	budgets: CommandEventContractOverlayBudgets
): readonly CommandEventContractOverlayReportProgressObservation[] {
	return [
		progressObservation('OVERLAY_COMMANDS', overlay.commands.length, budgets.maxCommands),
		progressObservation(
			'OVERLAY_EVENT_CONTRACTS',
			overlay.eventContracts.length,
			budgets.maxEventContracts
		),
		progressObservation(
			'OVERLAY_DECLARED_LINKS',
			overlay.declaredLinks.length,
			budgets.maxDeclaredLinks
		),
		progressObservation(
			'OVERLAY_BOUND_CONTRIBUTIONS',
			overlay.boundContributions.length,
			budgets.maxBoundContributions
		),
		progressObservation(
			'OVERLAY_PINNED_EMISSIONS',
			overlay.pinnedEmissions.length,
			budgets.maxPinnedEmissions
		),
		progressObservation('OVERLAY_FRONTIERS', overlay.frontiers.length, budgets.maxFrontiers),
		progressObservation(
			'OVERLAY_RETAINED_CENSUS_BYTES',
			overlay.retainedCensus.artifactBytes,
			budgets.maxSourceBytes,
			'BYTES'
		),
		progressObservation(
			'OVERLAY_VOCAB_BYTES',
			overlay.vocabArtifact.artifactBytes,
			budgets.maxSourceBytes,
			'BYTES'
		)
	];
}

export interface CommandEventContractOverlayReportRuntimeDependencies {
	readonly buildOverlay: typeof buildCommandEventContractOverlay;
	readonly captureHandler: typeof captureCommandHandlerGraphReportPipeline;
	readonly verifySubject: typeof verifyFrozenSubject;
}

const DEFAULT_DEPENDENCIES: CommandEventContractOverlayReportRuntimeDependencies = Object.freeze({
	buildOverlay: buildCommandEventContractOverlay,
	captureHandler: captureCommandHandlerGraphReportPipeline,
	verifySubject: verifyFrozenSubject
});

function exactAdditionalArtifacts(capture: CommandHandlerGraphReportPipelineCapture): boolean {
	if (capture.frozenSubject.request.scope.kind !== 'EXPLICIT_PROJECTS') return false;
	try {
		const actual = (capture.frozenSubject.request.scope.additionalArtifacts ?? [])
			.map((path) => canonicalPathKey(assertCanonicalRelativePath(path)))
			.sort();
		const expected = [
			...ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS,
			COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
		]
			.map((path) => canonicalPathKey(assertCanonicalRelativePath(path)))
			.sort();
		return (
			actual.length === new Set(actual).size &&
			expected.length === new Set(expected).size &&
			canonicalSemanticJson(actual) === canonicalSemanticJson(expected)
		);
	} catch {
		return false;
	}
}

function trustedCommandHandlerRequest(
	capture: CommandHandlerGraphReportPipelineCapture,
	predecessorRequest: CommandHandlerGraphReportRequest
): BuildCommandHandlerGraphRequest | null {
	const subject = capture.frozenSubject;
	const snapshot = capture.semanticSnapshot;
	const observation = capture.observation;
	const graph = capture.commandHandlerGraph;
	const executorArtifacts = capture.artifactSet.artifacts.filter((artifact) =>
		artifact.uses.includes('EXECUTOR_SOURCE')
	);
	const executorArtifact = executorArtifacts[0];
	if (
		!isFrozenSubjectCapability(subject) ||
		!hasValidatedStaticSemanticSnapshotCapability(
			snapshot,
			subject,
			predecessorRequest.budgets.semantic
		) ||
		snapshot.expectedEmpty ||
		snapshot.assignabilityRequests.length !== 0 ||
		canonicalSemanticJson(snapshot.requestedCapabilities) !==
			canonicalSemanticJson(COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SELECTION.semanticCapabilities) ||
		canonicalSemanticJson(capture.request) !== canonicalSemanticJson(predecessorRequest) ||
		canonicalSemanticJson(snapshot.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.semantic) ||
		canonicalSemanticJson(subject.request.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.subject) ||
		subject.request.scope.kind !== 'EXPLICIT_PROJECTS' ||
		canonicalSemanticJson(subject.request.scope.projects) !==
			canonicalSemanticJson(predecessorRequest.subjectProjectConfigPaths) ||
		!exactAdditionalArtifacts(capture) ||
		subject.descriptor.subjectId !== snapshot.subjectId ||
		snapshot.subjectId !== observation.subjectId ||
		observation.subjectId !== graph.subjectId ||
		graph.semanticSnapshotId !== snapshot.id ||
		graph.arrowObservationId !== observation.id ||
		capture.artifactSet.subjectId !== subject.descriptor.subjectId ||
		canonicalSemanticJson(observation.artifactSet) !== canonicalSemanticJson(capture.artifactSet) ||
		canonicalSemanticJson(observation.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.observation) ||
		executorArtifacts.length !== 1 ||
		executorArtifact === undefined ||
		observation.executor.retainedVerifierCanonicalPathKey !== executorArtifact.canonicalPathKey ||
		observation.executor.retainedVerifierSha256 !== executorArtifact.sha256
	)
		return null;
	if (
		validateArrowCommandCensusObservation(observation, subject, {
			maxIssues: Math.max(1, Math.min(1_000, predecessorRequest.budgets.observation.maxDiagnostics))
		}).state !== 'VALID' ||
		validateCommandHandlerGraph(graph, snapshot, observation, subject, {
			maxIssues: Math.max(1, Math.min(1_000, predecessorRequest.budgets.semantic.maxDiagnostics))
		}).state !== 'VALID'
	)
		return null;
	try {
		const registries = selectJpwbCommandHandlerRegistries(snapshot);
		const request: BuildCommandHandlerGraphRequest = {
			arrowObservationId: observation.id,
			budgets: predecessorRequest.budgets.commandHandlerGraph,
			commandRegistry: registries.commandRegistry,
			handlerRegistry: registries.handlerRegistry,
			operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
			schemaVersion: COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: subject.descriptor.subjectId
		};
		if (
			graph.graphInputDigest !== commandHandlerGraphInputDigest(request, snapshot, observation) ||
			canonicalSemanticJson(graph.budgets) !== canonicalSemanticJson(request.budgets) ||
			canonicalSemanticJson(graph.commandRegistry) !==
				canonicalSemanticJson(request.commandRegistry) ||
			canonicalSemanticJson(graph.handlerRegistry) !==
				canonicalSemanticJson(request.handlerRegistry)
		)
			return null;
		return request;
	} catch {
		return null;
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

interface DetachedReconciledEvidence {
	readonly diagnostics: readonly CommandEventContractOverlayReportDiagnostic[];
	readonly evidence: {
		readonly arrowObservation: CommandHandlerGraphReportPipelineCapture['observation'];
		readonly commandHandlerGraph: CommandHandlerGraphReportPipelineCapture['commandHandlerGraph'];
		readonly encoding: 'FULL_VALIDATED_SAME_SUBJECT_RETAINED_ARROW_COMMAND_HANDLER_AND_COMMAND_EVENT_CONTRACT_OVERLAY_EVIDENCE';
		readonly overlay: CommandEventContractOverlaySnapshot;
	};
	readonly predecessorStageOutcomes: CommandHandlerGraphReportPipelineCapture['predecessorStageOutcomes'];
	readonly semanticSnapshotSummary: {
		readonly astNodes: number;
		readonly id: CommandHandlerGraphReportPipelineCapture['semanticSnapshot']['id'];
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
	readonly subject: CommandHandlerGraphReportPipelineCapture['frozenSubject']['descriptor'];
}

function detachReconciledEvidence(
	capture: CommandHandlerGraphReportPipelineCapture,
	overlay: CommandEventContractOverlaySnapshot,
	diagnostics: readonly CommandEventContractOverlayReportDiagnostic[]
): DetachedReconciledEvidence {
	return detached({
		diagnostics,
		evidence: {
			arrowObservation: capture.observation,
			commandHandlerGraph: capture.commandHandlerGraph,
			encoding:
				'FULL_VALIDATED_SAME_SUBJECT_RETAINED_ARROW_COMMAND_HANDLER_AND_COMMAND_EVENT_CONTRACT_OVERLAY_EVIDENCE' as const,
			overlay
		},
		predecessorStageOutcomes: capture.predecessorStageOutcomes,
		semanticSnapshotSummary: {
			astNodes: capture.semanticSnapshot.astNodes.length,
			id: capture.semanticSnapshot.id,
			programs: capture.semanticSnapshot.programs.length,
			projects: capture.semanticSnapshot.projects.length,
			sources: capture.semanticSnapshot.sources.length
		},
		subject: capture.frozenSubject.descriptor
	});
}

function successfulOverlayReconciles(
	inputs: CommandEventContractOverlayBuildInputs,
	overlay: CommandEventContractOverlaySnapshot,
	buildDiagnostics: readonly CommandEventContractOverlayDiagnostic[],
	producer: typeof buildCommandEventContractOverlay
): boolean {
	if (
		buildDiagnostics.length !== 0 ||
		overlay.inputDigest !== commandEventContractOverlayInputDigest(inputs) ||
		validateCommandEventContractOverlay(overlay, inputs, {
			maxInputRecords: VALIDATION_MAX_RECORDS,
			maxInputStringCharacters: VALIDATION_MAX_STRING_CHARACTERS,
			maxIssues: Math.max(1, Math.min(1_000, inputs.request.budgets.maxDiagnostics)),
			maxRecords: VALIDATION_MAX_RECORDS,
			maxStringCharacters: VALIDATION_MAX_STRING_CHARACTERS
		}).state !== 'VALID'
	)
		return false;
	if (producer === buildCommandEventContractOverlay) return true;
	try {
		const trusted = buildCommandEventContractOverlay(inputs);
		return (
			trusted.outcome === 'partial' &&
			canonicalSemanticJson(trusted.diagnostics) === canonicalSemanticJson(buildDiagnostics) &&
			canonicalSemanticJson(trusted.overlay) === canonicalSemanticJson(overlay)
		);
	} catch {
		return false;
	}
}

async function runInternal(
	requestValue: unknown,
	options: RunCommandEventContractOverlayReportOptions,
	progress: ProgressRecorder,
	dependencies: CommandEventContractOverlayReportRuntimeDependencies
): Promise<CommandEventContractOverlayReportOutcome> {
	const buildOverlay = dependencies.buildOverlay;
	const captureHandler = dependencies.captureHandler;
	const verifySubject = dependencies.verifySubject;
	progress.start('REQUEST_BIND');
	let admission: CommandEventContractOverlayReportAdmission;
	let repositoryRoot: string;
	try {
		admission = materializeAdmission(requestValue);
		repositoryRoot = repositoryRootOption(options);
	} catch (error) {
		if (error instanceof ReportRequestError) {
			progress.fail([], error.code);
			return failure(error.code, 'REQUEST', error.state, [
				reportDiagnostic(error.code, error.message, error.path, 'REQUEST')
			]);
		}
		progress.fail([], 'REQUEST_INVALID');
		return failure('REQUEST_INVALID', 'REQUEST', 'incompatible', [
			reportDiagnostic('REQUEST_INVALID', 'The report request or adapter options are invalid.', '$')
		]);
	}
	const request = detached(materializedRequest(admission));
	progress.complete([], 'REQUEST_ADMITTED');

	progress.start('PREDECESSOR_PIPELINE');
	const predecessorOutcome = await captureHandler(admission.predecessorRequest, {
		additionalArtifacts: [
			COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH,
			COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH
		],
		onProgress: (event) => progress.forwardPredecessor(event),
		repositoryRoot
	});
	if (predecessorOutcome.outcome !== 'captured') {
		progress.fail([], predecessorOutcome.code);
		return failure(
			predecessorOutcome.code,
			'PREDECESSOR_PIPELINE',
			predecessorOutcome.state,
			unavailablePredecessorDiagnostics(predecessorOutcome.diagnostics),
			request,
			predecessorOutcome.subject
		);
	}
	const predecessor = predecessorOutcome;
	const inheritedDiagnostics = predecessorDiagnostics(predecessor);
	const commandHandlerRequest = trustedCommandHandlerRequest(
		predecessor,
		admission.predecessorRequest
	);
	if (commandHandlerRequest === null) {
		progress.fail([], 'PREDECESSOR_VALIDATION_FAILED');
		return failure(
			'PREDECESSOR_VALIDATION_FAILED',
			'PREDECESSOR_PIPELINE',
			'failed',
			[
				...inheritedDiagnostics,
				reportDiagnostic(
					'PREDECESSOR_VALIDATION_FAILED',
					'The captured semantic, retained-arrow, and command-handler evidence failed exact same-subject trust reconciliation.',
					null,
					'VALIDATE',
					'PREDECESSOR_PIPELINE',
					'ERROR'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(
		predecessorObservations(predecessor, request),
		'SAME_SUBJECT_COMMAND_HANDLER_PIPELINE_AND_COMMAND_EVENT_ARTIFACTS_CAPTURED'
	);

	progress.start('COMMAND_EVENT_CONTRACT_OVERLAY');
	let selection: ReturnType<typeof selectJpwbCommandEventContractOverlayInputs>;
	try {
		selection = selectJpwbCommandEventContractOverlayInputs(
			predecessor.semanticSnapshot,
			predecessor.frozenSubject
		);
	} catch {
		progress.fail([], 'OVERLAY_INPUT_SELECTION_UNAVAILABLE');
		return failure(
			'OVERLAY_INPUT_SELECTION_UNAVAILABLE',
			'COMMAND_EVENT_CONTRACT_OVERLAY',
			'incompatible',
			[
				...inheritedDiagnostics,
				reportDiagnostic(
					'OVERLAY_INPUT_SELECTION_UNAVAILABLE',
					'The exact generated COMMANDS and EVENTS declarations, retained census, and vocab artifact could not be selected uniquely.',
					null,
					'BIND',
					'COMMAND_EVENT_CONTRACT_OVERLAY',
					'ERROR'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const overlayRequest: BuildCommandEventContractOverlayRequest = {
		arrowObservationId: predecessor.observation.id,
		budgets: request.budgets.commandEventContractOverlay,
		commandHandlerGraphId: predecessor.commandHandlerGraph.id,
		commandRegistry: selection.commandRegistry,
		eventRegistry: selection.eventRegistry,
		operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION,
		retainedCensusArtifact: selection.retainedCensusArtifact,
		schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: predecessor.semanticSnapshot.id,
		subjectId: predecessor.frozenSubject.descriptor.subjectId,
		vocabArtifact: selection.vocabArtifact
	};
	const overlayInputs: CommandEventContractOverlayBuildInputs = {
		arrowObservation: predecessor.observation,
		commandHandlerGraph: predecessor.commandHandlerGraph,
		commandHandlerRequest,
		request: overlayRequest,
		semanticSnapshot: predecessor.semanticSnapshot,
		subject: predecessor.frozenSubject
	};
	const bufferedOverlayProgress: CommandEventContractOverlayProgressEvent[] = [];
	let acceptOverlayProgress = true;
	const overlayOutcome = buildOverlay(overlayInputs, {
		onProgress(event) {
			if (!acceptOverlayProgress || bufferedOverlayProgress.length >= 2_048) return;
			try {
				bufferedOverlayProgress.push(
					JSON.parse(canonicalSemanticJson(event)) as CommandEventContractOverlayProgressEvent
				);
			} catch {
				// Malformed telemetry cannot alter terminal evidence.
			}
		}
	});
	const projectedDiagnostics = projectedOverlayDiagnostics(
		overlayOutcome.diagnostics,
		predecessor.repositoryRoot
	);
	if (overlayOutcome.outcome !== 'partial') {
		acceptOverlayProgress = false;
		bufferedOverlayProgress.length = 0;
		progress.fail(
			[],
			overlayOutcome.diagnostics[0]?.code ?? 'COMMAND_EVENT_CONTRACT_OVERLAY_UNAVAILABLE'
		);
		return failure(
			'COMMAND_EVENT_CONTRACT_OVERLAY_UNAVAILABLE',
			'COMMAND_EVENT_CONTRACT_OVERLAY',
			overlayFailureState(overlayOutcome.diagnostics),
			[...inheritedDiagnostics, ...projectedDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const overlay = overlayOutcome.overlay;
	if (
		!successfulOverlayReconciles(overlayInputs, overlay, overlayOutcome.diagnostics, buildOverlay)
	) {
		acceptOverlayProgress = false;
		bufferedOverlayProgress.length = 0;
		progress.fail(
			overlayObservations(overlay, request.budgets.commandEventContractOverlay),
			'EVIDENCE_IDENTITY_MISMATCH'
		);
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'COMMAND_EVENT_CONTRACT_OVERLAY',
			'failed',
			[
				...inheritedDiagnostics,
				...projectedDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The generated registries, vocab, retained event-surface census, trusted predecessors, producer envelope, and overlay do not reconcile.',
					null,
					'VALIDATE',
					'COMMAND_EVENT_CONTRACT_OVERLAY',
					'ERROR'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	let detachedEvidence: DetachedReconciledEvidence;
	try {
		detachedEvidence = detachReconciledEvidence(predecessor, overlay, [
			...inheritedDiagnostics,
			...projectedDiagnostics
		]);
	} catch {
		acceptOverlayProgress = false;
		bufferedOverlayProgress.length = 0;
		progress.start('RESULT');
		progress.fail([], 'EVIDENCE_DETACH_FAILED');
		return failure(
			'EVIDENCE_DETACH_FAILED',
			'RESULT',
			'failed',
			[
				reportDiagnostic(
					'EVIDENCE_DETACH_FAILED',
					'Reconciled evidence could not be detached safely.',
					null,
					'SERIALIZE',
					'REPORT',
					'ERROR'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const completedStageOutcomes = detached({
		commandEventContractOverlay: {
			diagnosticCodes: overlayOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial' as const
		},
		predecessorPipeline: detachedEvidence.predecessorStageOutcomes
	});
	// The core builder intentionally delivers telemetry in a microtask. Evidence is already
	// reconciled, detached, and frozen before this yield. Close the private buffer immediately
	// afterward so later or adversarial emissions are dropped.
	await Promise.resolve();
	acceptOverlayProgress = false;
	for (const event of bufferedOverlayProgress) progress.forwardOverlay(event);
	progress.complete(
		overlayObservations(
			detachedEvidence.evidence.overlay,
			request.budgets.commandEventContractOverlay
		),
		'PARTIAL_OPEN_COMMAND_EVENT_CONTRACT_OVERLAY'
	);

	progress.start('CURRENTNESS');
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		freshness = detached(
			verifySubject(predecessor.frozenSubject, {
				rootLocator: repositoryRoot
			})
		);
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
		[progressObservation('CURRENTNESS_CHANGED_PATHS', freshness.changedPaths.length, null)],
		currentnessState
	);

	progress.start('RESULT');
	const stageOutcomes: CommandEventContractOverlayReportStageOutcomes = {
		...completedStageOutcomes,
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		}
	};
	const report: CommandEventContractOverlayReportOutcome = {
		analysisAuthority: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY,
		authorityTransfer: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [...detachedEvidence.diagnostics, ...currentnessDiagnostics],
		gateEffect: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT,
		operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				authorityTransfer: COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER,
				baselineChange: COMMAND_EVENT_CONTRACT_OVERLAY_BASELINE_CHANGE,
				derivationCapability: COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
				facadeScope: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCOPE,
				fullJanCsaa007Conformance: COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
				fullJanCsaa008Conformance: COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
				graphAuthority: COMMAND_EVENT_CONTRACT_OVERLAY_GRAPH_AUTHORITY,
				id: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_CAPABILITY_ID,
				inferenceCapability: COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY,
				integrationStrategy: COMMAND_EVENT_CONTRACT_OVERLAY_INTEGRATION_STRATEGY,
				oracleChange: COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE,
				registryStatus: COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_STATUS,
				replacementEquivalence: COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE,
				retainedCensusAuthority: COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_AUTHORITY,
				retainedCensusExecution: COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_EXECUTION,
				retainedCensusIntegration: COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_INTEGRATION,
				runtimeEmission: COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION,
				runtimePerformability: COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY,
				scope: COMMAND_EVENT_CONTRACT_OVERLAY_SCOPE,
				status: COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS
			},
			coverage: {
				...detachedEvidence.evidence.overlay.coverage,
				health: detachedEvidence.evidence.overlay.health,
				limitations: detachedEvidence.evidence.overlay.limitations.length
			},
			currentness: {
				changedPaths: freshness.changedPaths,
				diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
				scope: 'SELECTED_CAPTURED_SUBJECT_ONLY',
				state: currentnessState
			},
			evidence: detachedEvidence.evidence,
			facadeNonclaims: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_SAME_SUBJECT_STATIC_COMMAND_EVENT_CONTRACT_OVERLAY',
			predecessorNonclaims: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS,
			schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_RESULT_SCHEMA_VERSION,
			selection: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SELECTION,
			semanticSnapshotSummary: detachedEvidence.semanticSnapshotSummary
		},
		schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCHEMA_VERSION,
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
						'The admitted command-event-contract-overlay report exceeds maxResultBytes.'
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
export async function runCommandEventContractOverlayReportWithDependencies(
	requestValue: unknown,
	options: RunCommandEventContractOverlayReportOptions,
	dependencies: CommandEventContractOverlayReportRuntimeDependencies
): Promise<CommandEventContractOverlayReportOutcome> {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(await runInternal(requestValue, options, progress, dependencies));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic(
					'INTERNAL_FAILURE',
					'The command-event-contract-overlay report failed closed.'
				)
			])
		);
	}
}

export async function runCommandEventContractOverlayReport(
	requestValue: unknown,
	options: RunCommandEventContractOverlayReportOptions
): Promise<CommandEventContractOverlayReportOutcome> {
	return runCommandEventContractOverlayReportWithDependencies(
		requestValue,
		options,
		DEFAULT_DEPENDENCIES
	);
}

export function commandEventContractOverlayReportExitCode(
	outcome: CommandEventContractOverlayReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
