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
	GUARD_CLASSIFICATION_OVERLAY_AUTHORITY_TRANSFER,
	GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE,
	GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
	GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
	GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
	GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
	GUARD_CLASSIFICATION_OVERLAY_GATE_EFFECT,
	GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY,
	GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY,
	GUARD_CLASSIFICATION_OVERLAY_INTEGRATION_STRATEGY,
	GUARD_CLASSIFICATION_OVERLAY_LIMITATIONS,
	GUARD_CLASSIFICATION_OVERLAY_METHOD,
	GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE,
	GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS,
	GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE,
	GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT,
	GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY,
	GUARD_CLASSIFICATION_OVERLAY_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_SCOPE,
	type BuildGuardClassificationOverlayRequest,
	type GuardClassificationOverlayBudgets,
	type GuardClassificationOverlayBuildInputs,
	type GuardClassificationOverlayProgressEvent,
	type GuardClassificationOverlaySnapshot
} from '../contracts/guard-classification-overlay.js';
import {
	GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_CAPABILITY_ID,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_RESULT_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE,
	type GuardClassificationOverlayReportDiagnostic,
	type GuardClassificationOverlayReportFailureState,
	type GuardClassificationOverlayReportOutcome,
	type GuardClassificationOverlayReportRequest,
	type GuardClassificationOverlayReportResult,
	type GuardClassificationOverlayReportStage,
	type GuardClassificationOverlayReportStageOutcomes
} from '../contracts/guard-classification-overlay-report.js';
import {
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS,
	type GuardEnforcementLedgerArtifactSetBudgets,
	type GuardEnforcementLedgerBudgets,
	type GuardEnforcementLedgerObservation
} from '../contracts/guard-enforcement-ledger.js';
import { GUARD_ENFORCEMENT_LEDGER_REPORT_ADDITIONAL_ARTIFACT_PATHS } from '../contracts/guard-enforcement-ledger-report.js';
import {
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
	type BuildStateMachineGraphRequest,
	type BuildStateMachineTopologyObservationRequest,
	type StateMachineGraphBudgets,
	type StateMachineGraphSnapshot,
	type StateMachineTopologyObservation,
	type StateMachineTopologyObservationBudgets
} from '../contracts/state-machine-graph.js';
import type { SubjectDiagnostic } from '../contracts/subject.js';
import { buildGuardClassificationOverlay } from '../graph/build-guard-classification-overlay.js';
import { selectJpwbCommandHandlerRegistries } from '../graph/build-command-handler-graph.js';
import { buildStateMachineGraph } from '../graph/build-state-machine-graph.js';
import { commandHandlerGraphInputDigest } from '../graph/command-handler-graph-canonical.js';
import {
	validateCommandHandlerGraph,
	validateConstructedCommandHandlerGraph
} from '../graph/validate-command-handler-graph.js';
import { ARROW_COMMAND_CENSUS_RETAINED_VERIFIER_PATHS } from '../providers/jpwb-arrow-command-census/artifact-set.js';
import { validateArrowCommandCensusObservation } from '../providers/jpwb-arrow-command-census/validate-arrow-command-census.js';
import {
	buildGuardEnforcementLedgerArtifactSet,
	validateGuardEnforcementLedgerArtifactSet
} from '../providers/jpwb-guard-enforcement-ledger/artifact-set.js';
import {
	observeGuardEnforcementLedger,
	type GuardEnforcementLedgerProgressEvent
} from '../providers/jpwb-guard-enforcement-ledger/observe-guard-enforcement-ledger.js';
import { validateGuardEnforcementLedgerObservation } from '../providers/jpwb-guard-enforcement-ledger/validate-guard-enforcement-ledger.js';
import { observeStateMachineTopology } from '../providers/jpwb-state-machines/observe-state-machines.js';
import { validateStateMachineTopologyObservation } from '../providers/jpwb-state-machines/validate-state-machine-observation.js';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { hasValidatedStaticSemanticSnapshotCapability } from '../semantic/build-static-semantic-snapshot.js';
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
	'commandHandlerGraph',
	'guardArtifactSet',
	'guardClassificationOverlay',
	'guardObservation',
	'maxResultBytes',
	'observation',
	'semantic',
	'stateMachineGraph',
	'stateObservation',
	'subject'
] as const;
const GUARD_ARTIFACT_SET_BUDGET_KEYS = [
	'maxArtifacts',
	'maxDiagnostics',
	'maxTotalBytes'
] as const satisfies readonly (keyof GuardEnforcementLedgerArtifactSetBudgets)[];
const GUARD_OBSERVATION_BUDGET_KEYS = [
	'maxArtifacts',
	'maxAuditEntries',
	'maxDiagnostics',
	'maxExecutorDurationMs',
	'maxExternalModuleBytes',
	'maxExternalModuleFiles',
	'maxGuardedArrows',
	'maxGuardTexts',
	'maxLedgerRows',
	'maxMaterializedBytes',
	'maxOutputStringCharacters',
	'maxRawArrayEntries',
	'maxRawJsonDepth',
	'maxStderrBytes',
	'maxStdoutBytes'
] as const satisfies readonly (keyof GuardEnforcementLedgerBudgets)[];
const STATE_OBSERVATION_BUDGET_KEYS = [
	'maxAstNodes',
	'maxCrossAxisRules',
	'maxDiagnostics',
	'maxMachines',
	'maxSourceBytes',
	'maxStates',
	'maxTextCharacters',
	'maxTransitions'
] as const satisfies readonly (keyof StateMachineTopologyObservationBudgets)[];
const STATE_GRAPH_BUDGET_KEYS = [
	'maxEdges',
	'maxNodes'
] as const satisfies readonly (keyof StateMachineGraphBudgets)[];
const OVERLAY_BUDGET_KEYS = [
	'maxAnchorSites',
	'maxAstNodes',
	'maxCommandEvidenceLinks',
	'maxDiagnostics',
	'maxFrontiers',
	'maxGuardOccurrences',
	'maxGuardRecords',
	'maxHandlerLinks',
	'maxSourceBytes',
	'maxStateEvidenceRefs'
] as const satisfies readonly (keyof GuardClassificationOverlayBudgets)[];
const MAX_DIAGNOSTIC_PATH_CHARACTERS = 10_000;
const STATE_GRAPH_PARTIAL_DIAGNOSTICS = Object.freeze([
	Object.freeze({
		code: 'GRAPH_PARTIAL',
		message:
			'Generated runtime topology is projected with explicit authority and behavioral limitations.',
		path: null,
		phase: 'PROJECT'
	})
]);

interface GuardClassificationOverlayReportAdmission {
	readonly guardArtifactSetBudgets: GuardEnforcementLedgerArtifactSetBudgets;
	readonly guardObservationBudgets: GuardEnforcementLedgerBudgets;
	readonly overlayBudgets: GuardClassificationOverlayBudgets;
	readonly predecessorRequest: CommandHandlerGraphReportRequest;
	readonly stateGraphBudgets: StateMachineGraphBudgets;
	readonly stateObservationBudgets: StateMachineTopologyObservationBudgets;
}

export const GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-guard-classification-overlay-report-progress/0.1.0' as const;

export const GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_NONCLAIMS = Object.freeze({
	dwp004Dwp005OrDwp006Completion: 'NOT_CLAIMED',
	facadeNonclaims: GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS,
	janCsaa007OperationProgressResponse: 'NOT_CLAIMED',
	runtimeOutcomeInvariance: 'NOT_CLAIMED',
	terminalOutcomeEvidenceOrCapabilityCompleteness: 'NOT_CLAIMED'
} as const);

export type GuardClassificationOverlayReportProgressPhase =
	| 'REQUEST_BIND'
	| 'PREDECESSOR_PIPELINE'
	| 'GUARD_ARTIFACT_SET'
	| 'GUARD_ENFORCEMENT_LEDGER'
	| 'STATE_TOPOLOGY_OBSERVATION'
	| 'STATE_MACHINE_GRAPH'
	| 'GUARD_CLASSIFICATION_OVERLAY'
	| 'CURRENTNESS'
	| 'RESULT';

const PROGRESS_PHASE_STAGE = Object.freeze({
	CURRENTNESS: 'CURRENTNESS',
	GUARD_ARTIFACT_SET: 'GUARD_ARTIFACT_SET',
	GUARD_CLASSIFICATION_OVERLAY: 'GUARD_CLASSIFICATION_OVERLAY',
	GUARD_ENFORCEMENT_LEDGER: 'GUARD_ENFORCEMENT_LEDGER',
	PREDECESSOR_PIPELINE: 'PREDECESSOR_PIPELINE',
	REQUEST_BIND: 'REQUEST',
	RESULT: 'RESULT',
	STATE_MACHINE_GRAPH: 'STATE_MACHINE_GRAPH',
	STATE_TOPOLOGY_OBSERVATION: 'STATE_TOPOLOGY_OBSERVATION'
} as const satisfies Readonly<
	Record<GuardClassificationOverlayReportProgressPhase, GuardClassificationOverlayReportStage>
>);

export type GuardClassificationOverlayReportProgressObservationMetric =
	| 'CURRENTNESS_CHANGED_PATHS'
	| 'GUARD_ARTIFACT_BYTES'
	| 'GUARD_ARTIFACTS'
	| 'GUARD_OCCURRENCES'
	| 'GUARD_RECORDS'
	| 'OVERLAY_CLASSIFICATIONS'
	| 'OVERLAY_COMMAND_EVIDENCE_LINKS'
	| 'OVERLAY_FRONTIERS'
	| 'OVERLAY_HANDLER_LINKS'
	| 'OVERLAY_OCCURRENCES'
	| 'PREDECESSOR_ARROW_OCCURRENCES'
	| 'PREDECESSOR_COMMAND_HANDLER_NODES'
	| 'PREDECESSOR_SEMANTIC_AST_NODES'
	| 'PREDECESSOR_SUBJECT_ARTIFACTS'
	| 'RESULT_BYTES'
	| 'STATE_GRAPH_EDGES'
	| 'STATE_GRAPH_NODES'
	| 'STATE_MACHINES'
	| 'STATE_TRANSITIONS';

export interface GuardClassificationOverlayReportProgressObservation {
	readonly limit: number | null;
	readonly metric: GuardClassificationOverlayReportProgressObservationMetric;
	readonly unit: 'BYTES' | 'COUNT';
	readonly value: number;
}

export interface GuardClassificationOverlayReportProgressEvent {
	readonly deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK';
	readonly detailCode: string | null;
	readonly elapsedMs: number;
	readonly guardProgress: GuardEnforcementLedgerProgressEvent | null;
	readonly kind: 'REPORT_STAGE' | 'PREDECESSOR_REPORT' | 'GUARD_ADAPTER' | 'OVERLAY_BUILDER';
	readonly nonclaims: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_NONCLAIMS;
	readonly observations: readonly GuardClassificationOverlayReportProgressObservation[];
	readonly operationVersion: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION;
	readonly overlayProgress: GuardClassificationOverlayProgressEvent | null;
	readonly phase: GuardClassificationOverlayReportProgressPhase;
	readonly predecessorProgress: CommandHandlerGraphReportProgressEvent | null;
	readonly protocolRole: 'PRELIMINARY_TYPESCRIPT_GUARD_CLASSIFICATION_OVERLAY_REPORT_TELEMETRY';
	readonly reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY';
	readonly schemaVersion: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly stage: GuardClassificationOverlayReportStage;
	readonly state: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
	readonly wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET';
}

export interface RunGuardClassificationOverlayReportOptions {
	/** Trusted-host telemetry callback; excluded from terminal evidence and identity. */
	readonly onProgress?: (event: GuardClassificationOverlayReportProgressEvent) => unknown;
	/** Absolute fixed worktree root supplied by the executable, never by the wire request. */
	readonly repositoryRoot: string;
}

interface ProgressRecorder {
	complete(
		observations?: readonly GuardClassificationOverlayReportProgressObservation[],
		detailCode?: string | null
	): void;
	fail(
		observations?: readonly GuardClassificationOverlayReportProgressObservation[],
		detailCode?: string | null
	): void;
	finish(outcome: GuardClassificationOverlayReportOutcome): GuardClassificationOverlayReportOutcome;
	forwardGuard(event: GuardEnforcementLedgerProgressEvent): void;
	forwardOverlay(event: GuardClassificationOverlayProgressEvent): void;
	forwardPredecessor(event: CommandHandlerGraphReportProgressEvent): void;
	start(
		phase: GuardClassificationOverlayReportProgressPhase,
		observations?: readonly GuardClassificationOverlayReportProgressObservation[]
	): void;
}

function progressObservation(
	metric: GuardClassificationOverlayReportProgressObservationMetric,
	value: number,
	limit: number | null,
	unit: GuardClassificationOverlayReportProgressObservation['unit'] = 'COUNT'
): GuardClassificationOverlayReportProgressObservation {
	return Object.freeze({
		limit,
		metric,
		unit,
		value: Number.isFinite(value) && value >= 0 ? Math.min(value, Number.MAX_SAFE_INTEGER) : 0
	});
}

function progressSink(
	options: RunGuardClassificationOverlayReportOptions
): ((event: GuardClassificationOverlayReportProgressEvent) => unknown) | undefined {
	try {
		if (options === null || typeof options !== 'object' || isProxyValue(options)) return undefined;
		const descriptor = Reflect.getOwnPropertyDescriptor(options, 'onProgress');
		return descriptor !== undefined &&
			'value' in descriptor &&
			typeof descriptor.value === 'function'
			? (descriptor.value as (event: GuardClassificationOverlayReportProgressEvent) => unknown)
			: undefined;
	} catch {
		return undefined;
	}
}

function createProgressRecorder(
	options: RunGuardClassificationOverlayReportOptions
): ProgressRecorder {
	const sink = progressSink(options);
	const started = performance.now();
	let sequence = 0;
	let active: GuardClassificationOverlayReportProgressPhase | null = null;
	const emit = (
		kind: GuardClassificationOverlayReportProgressEvent['kind'],
		phase: GuardClassificationOverlayReportProgressPhase,
		state: GuardClassificationOverlayReportProgressEvent['state'],
		observations: readonly GuardClassificationOverlayReportProgressObservation[],
		detailCode: string | null,
		predecessorProgress: CommandHandlerGraphReportProgressEvent | null,
		guardProgress: GuardEnforcementLedgerProgressEvent | null,
		overlayProgress: GuardClassificationOverlayProgressEvent | null
	): void => {
		if (sink === undefined) return;
		const event = Object.freeze({
			deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' as const,
			detailCode,
			elapsedMs: Math.max(0, Math.round(performance.now() - started)),
			guardProgress,
			kind,
			nonclaims: GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
			observations,
			operationVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
			overlayProgress,
			phase,
			predecessorProgress,
			protocolRole: 'PRELIMINARY_TYPESCRIPT_GUARD_CLASSIFICATION_OVERLAY_REPORT_TELEMETRY' as const,
			reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY' as const,
			schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_SCHEMA_VERSION,
			sequence: ++sequence,
			stage: PROGRESS_PHASE_STAGE[phase],
			state,
			wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET' as const
		});
		try {
			const result = sink(event);
			if (result !== undefined) void Promise.resolve(result).catch(() => undefined);
		} catch {
			// Best-effort telemetry cannot change terminal evidence.
		}
	};
	const close = (
		state: GuardClassificationOverlayReportProgressEvent['state'],
		observations: readonly GuardClassificationOverlayReportProgressObservation[],
		detailCode: string | null
	): void => {
		if (active === null) return;
		const phase = active;
		active = null;
		emit('REPORT_STAGE', phase, state, observations, detailCode, null, null, null);
	};
	const clone = <T>(event: T): T | null => {
		try {
			return JSON.parse(canonicalSemanticJson(event)) as T;
		} catch {
			return null;
		}
	};
	return {
		complete(observations = [], detailCode = null): void {
			close('COMPLETED', observations, detailCode);
		},
		fail(observations = [], detailCode = null): void {
			close('FAILED', observations, detailCode);
		},
		finish(outcome): GuardClassificationOverlayReportOutcome {
			if (active !== null)
				close('FAILED', [], outcome.outcome === 'unavailable' ? outcome.code : 'STAGE_INTERRUPTED');
			return outcome;
		},
		forwardGuard(event): void {
			const copied = clone(event);
			if (copied !== null)
				emit(
					'GUARD_ADAPTER',
					'GUARD_ENFORCEMENT_LEDGER',
					copied.state,
					[],
					copied.phase,
					null,
					copied,
					null
				);
		},
		forwardOverlay(event): void {
			const copied = clone(event);
			if (copied !== null)
				emit(
					'OVERLAY_BUILDER',
					'GUARD_CLASSIFICATION_OVERLAY',
					copied.state,
					[],
					copied.detailCode,
					null,
					null,
					copied
				);
		},
		forwardPredecessor(event): void {
			const copied = clone(event);
			if (copied !== null)
				emit(
					'PREDECESSOR_REPORT',
					'PREDECESSOR_PIPELINE',
					copied.state,
					[],
					copied.detailCode,
					copied,
					null,
					null
				);
		},
		start(phase, observations = []): void {
			if (active !== null) close('FAILED', [], 'STAGE_INTERRUPTED');
			active = phase;
			emit('REPORT_STAGE', phase, 'STARTED', observations, null, null, null, null);
		}
	};
}

class ReportRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly path: string,
		readonly state: GuardClassificationOverlayReportFailureState = 'incompatible'
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

function materializeBudgetRecord<T extends object>(
	value: unknown,
	keys: readonly (keyof T & string)[],
	ceilings: T,
	path: string
): T {
	const record = exactDataRecord(value, keys, path);
	return Object.freeze(
		Object.fromEntries(
			keys.map((key) => [
				key,
				boundedBudget(record[key], ceilings[key] as number, `${path}.${key}`)
			])
		) as T
	);
}

function materializeAdmission(value: unknown): GuardClassificationOverlayReportAdmission {
	const record = exactDataRecord(value, REQUEST_KEYS, '$');
	if (record.operationVersion !== GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION)
		throw new ReportRequestError(
			'REQUEST_OPERATION_INCOMPATIBLE',
			'$.operationVersion is unsupported.',
			'$.operationVersion'
		);
	if (record.schemaVersion !== GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION)
		throw new ReportRequestError(
			'REQUEST_SCHEMA_INCOMPATIBLE',
			'$.schemaVersion is unsupported.',
			'$.schemaVersion'
		);
	if (record.executionSelection !== GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION)
		throw new ReportRequestError(
			'RETAINED_EXECUTION_NOT_ACKNOWLEDGED',
			'$.executionSelection must explicitly acknowledge retained verifier execution and its isolation boundary.',
			'$.executionSelection'
		);
	const budgets = exactDataRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const guardArtifactSetBudgets = materializeBudgetRecord(
		budgets.guardArtifactSet,
		GUARD_ARTIFACT_SET_BUDGET_KEYS,
		GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS.guardArtifactSet,
		'$.budgets.guardArtifactSet'
	);
	const guardObservationBudgets = materializeBudgetRecord(
		budgets.guardObservation,
		GUARD_OBSERVATION_BUDGET_KEYS,
		GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS.guardObservation,
		'$.budgets.guardObservation'
	);
	const stateObservationBudgets = materializeBudgetRecord(
		budgets.stateObservation,
		STATE_OBSERVATION_BUDGET_KEYS,
		GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS.stateObservation,
		'$.budgets.stateObservation'
	);
	const stateGraphBudgets = materializeBudgetRecord(
		budgets.stateMachineGraph,
		STATE_GRAPH_BUDGET_KEYS,
		GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS.stateMachineGraph,
		'$.budgets.stateMachineGraph'
	);
	const overlayBudgets = materializeBudgetRecord(
		budgets.guardClassificationOverlay,
		OVERLAY_BUDGET_KEYS,
		GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS.guardClassificationOverlay,
		'$.budgets.guardClassificationOverlay'
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
		executionSelection: GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION,
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
	return Object.freeze({
		guardArtifactSetBudgets,
		guardObservationBudgets,
		overlayBudgets,
		predecessorRequest: predecessorAdmission.request,
		stateGraphBudgets,
		stateObservationBudgets
	});
}

function materializedRequest(
	admission: GuardClassificationOverlayReportAdmission
): GuardClassificationOverlayReportRequest {
	return Object.freeze({
		budgets: Object.freeze({
			...admission.predecessorRequest.budgets,
			guardArtifactSet: admission.guardArtifactSetBudgets,
			guardClassificationOverlay: admission.overlayBudgets,
			guardObservation: admission.guardObservationBudgets,
			stateMachineGraph: admission.stateGraphBudgets,
			stateObservation: admission.stateObservationBudgets
		}),
		executionSelection: GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION,
		operationVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
		schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: admission.predecessorRequest.subjectProjectConfigPaths
	});
}

export type GuardClassificationOverlayReportRequestAdmission =
	| { readonly outcome: 'admitted'; readonly request: GuardClassificationOverlayReportRequest }
	| {
			readonly code: string;
			readonly message: string;
			readonly outcome: 'rejected';
			readonly path: string;
			readonly state: GuardClassificationOverlayReportFailureState;
	  };

/** @internal Exact hostile-safe admission seam; intentionally not package-root exported. */
export function admitGuardClassificationOverlayReportRequest(
	value: unknown
): GuardClassificationOverlayReportRequestAdmission {
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
	source: GuardClassificationOverlayReportDiagnostic['source'] = 'REPORT',
	severity: GuardClassificationOverlayReportDiagnostic['severity'] = null,
	predecessorSource: GuardClassificationOverlayReportDiagnostic['predecessorSource'] = null
): GuardClassificationOverlayReportDiagnostic {
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

function nestedBudgetDiagnosticPath(
	path: string | null,
	repositoryRoot: string,
	budgetName: string
): string | null {
	if (path === '$.budgets' || path === '$request.budgets') return `$.budgets.${budgetName}`;
	for (const prefix of ['$.budgets.', '$request.budgets.'])
		if (path?.startsWith(prefix) === true)
			return `$.budgets.${budgetName}.${path.slice(prefix.length)}`;
	if (path?.startsWith('$request') === true) return null;
	return safeDiagnosticPath(path, repositoryRoot);
}

function predecessorDiagnostics(
	capture: CommandHandlerGraphReportPipelineCapture
): GuardClassificationOverlayReportDiagnostic[] {
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
): GuardClassificationOverlayReportDiagnostic[] {
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

function projectedDiagnostics(
	diagnostics: readonly {
		readonly code: string;
		readonly message: string;
		readonly path: string | null;
		readonly phase: string;
		readonly severity?: 'ERROR' | 'WARNING';
	}[],
	repositoryRoot: string,
	source: GuardClassificationOverlayReportDiagnostic['source'],
	budgetName: string
): GuardClassificationOverlayReportDiagnostic[] {
	return diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, repositoryRoot),
			nestedBudgetDiagnosticPath(diagnostic.path, repositoryRoot, budgetName),
			diagnostic.phase,
			source,
			diagnostic.severity ?? (diagnostic.code.endsWith('PARTIAL') ? 'WARNING' : null)
		)
	);
}

function failure(
	code: string,
	stage: GuardClassificationOverlayReportStage,
	state: GuardClassificationOverlayReportFailureState,
	diagnostics: readonly GuardClassificationOverlayReportDiagnostic[],
	request?: GuardClassificationOverlayReportRequest,
	subject?: CommandHandlerGraphReportPipelineCapture['frozenSubject']['descriptor']
): Extract<GuardClassificationOverlayReportOutcome, { readonly outcome: 'unavailable' }> {
	return {
		analysisAuthority: GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY,
		authorityTransfer: GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER,
		code,
		diagnostics,
		facadeNonclaims: GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS,
		gateEffect: GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT,
		operationVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: GUARD_CLASSIFICATION_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS,
		...(request === undefined ? {} : { request }),
		schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_SCHEMA_VERSION,
		stage,
		state,
		...(subject === undefined ? {} : { subject })
	};
}

function diagnosticFailureState(
	diagnostics: readonly { readonly code: string }[]
): GuardClassificationOverlayReportFailureState {
	if (diagnostics.some((diagnostic) => diagnostic.code.includes('BUDGET')))
		return 'resource-refused';
	if (
		diagnostics.some((diagnostic) =>
			/REQUEST|MISMATCH|UNSUPPORTED|UNAVAILABLE|CAPABILITY/u.test(diagnostic.code)
		)
	)
		return 'incompatible';
	return 'failed';
}

interface SelectedStateSource {
	readonly artifact: CommandHandlerGraphReportPipelineCapture['frozenSubject']['artifacts'][number];
	readonly semanticSource: CommandHandlerGraphReportPipelineCapture['semanticSnapshot']['sources'][number];
}

function selectStateSource(
	capture: CommandHandlerGraphReportPipelineCapture
): SelectedStateSource | null {
	const artifacts = capture.frozenSubject.artifacts.filter(
		(artifact) =>
			artifact.path === GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE.logicalPath &&
			artifact.disposition === 'ANALYZED' &&
			artifact.primaryClass === 'GENERATED_SOURCE' &&
			artifact.roles.includes('GENERATED')
	);
	if (artifacts.length !== 1) return null;
	const artifact = artifacts[0]!;
	const projectIds = new Set(
		capture.semanticSnapshot.projects
			.filter(
				(project) =>
					project.configPath === GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE.projectConfigPath
			)
			.map((project) => project.id)
	);
	const sources = capture.semanticSnapshot.sources.filter(
		(source) =>
			source.logicalPath === GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE.logicalPath &&
			projectIds.has(source.projectId) &&
			source.analysisDisposition === 'DEEP_INDEXED' &&
			source.artifactClass === 'GENERATED_SOURCE' &&
			source.origin === 'GENERATED' &&
			source.bytes === artifact.bytes &&
			source.contentSha256 === artifact.sha256
	);
	return sources.length === 1 ? { artifact, semanticSource: sources[0]! } : null;
}

function predecessorObservations(
	capture: CommandHandlerGraphReportPipelineCapture,
	request: GuardClassificationOverlayReportRequest
): readonly GuardClassificationOverlayReportProgressObservation[] {
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
		)
	];
}

function overlayObservations(
	overlay: GuardClassificationOverlaySnapshot,
	budgets: GuardClassificationOverlayBudgets
): readonly GuardClassificationOverlayReportProgressObservation[] {
	return [
		progressObservation(
			'OVERLAY_CLASSIFICATIONS',
			overlay.classifications.length,
			budgets.maxGuardRecords
		),
		progressObservation(
			'OVERLAY_OCCURRENCES',
			overlay.occurrences.length,
			budgets.maxGuardOccurrences
		),
		progressObservation(
			'OVERLAY_COMMAND_EVIDENCE_LINKS',
			overlay.commandEvidenceLinks.length,
			budgets.maxCommandEvidenceLinks
		),
		progressObservation(
			'OVERLAY_HANDLER_LINKS',
			overlay.handlerLinks.length,
			budgets.maxHandlerLinks
		),
		progressObservation('OVERLAY_FRONTIERS', overlay.frontiers.length, budgets.maxFrontiers)
	];
}

export interface GuardClassificationOverlayReportRuntimeDependencies {
	readonly buildGuardArtifactSet: typeof buildGuardEnforcementLedgerArtifactSet;
	readonly buildOverlay: typeof buildGuardClassificationOverlay;
	readonly buildStateGraph: typeof buildStateMachineGraph;
	readonly captureHandler: typeof captureCommandHandlerGraphReportPipeline;
	readonly observeGuard: typeof observeGuardEnforcementLedger;
	readonly observeState: typeof observeStateMachineTopology;
	readonly validateGuardArtifactSet: typeof validateGuardEnforcementLedgerArtifactSet;
	readonly validateGuardObservation: typeof validateGuardEnforcementLedgerObservation;
	readonly validateHandlerGraph: typeof validateCommandHandlerGraph;
	readonly validateObservation: typeof validateArrowCommandCensusObservation;
	readonly validateStateObservation: typeof validateStateMachineTopologyObservation;
	readonly verifySubject: typeof verifyFrozenSubject;
}

const DEFAULT_DEPENDENCIES: GuardClassificationOverlayReportRuntimeDependencies = Object.freeze({
	buildGuardArtifactSet: buildGuardEnforcementLedgerArtifactSet,
	buildOverlay: buildGuardClassificationOverlay,
	buildStateGraph: buildStateMachineGraph,
	captureHandler: captureCommandHandlerGraphReportPipeline,
	observeGuard: observeGuardEnforcementLedger,
	observeState: observeStateMachineTopology,
	validateGuardArtifactSet: validateGuardEnforcementLedgerArtifactSet,
	validateGuardObservation: validateGuardEnforcementLedgerObservation,
	validateHandlerGraph: validateCommandHandlerGraph,
	validateObservation: validateArrowCommandCensusObservation,
	validateStateObservation: validateStateMachineTopologyObservation,
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
			...GUARD_ENFORCEMENT_LEDGER_RETAINED_VERIFIER_PATHS
		]
			.map((path) => canonicalPathKey(assertCanonicalRelativePath(path)))
			.sort();
		return (
			new Set(actual).size === actual.length &&
			new Set(expected).size === expected.length &&
			canonicalSemanticJson(actual) === canonicalSemanticJson(expected)
		);
	} catch {
		return false;
	}
}

interface SuccessfulStageEnvelopes {
	readonly guardArtifactSetDiagnostics: readonly unknown[];
	readonly guardDiagnostics: readonly unknown[];
	readonly guardOutcome: 'complete' | 'partial';
	readonly overlayDiagnostics: readonly unknown[];
	readonly stateGraphDiagnostics: readonly unknown[];
	readonly stateObservationDiagnostics: readonly unknown[];
}

interface SuccessfulStageProducers {
	readonly buildOverlay: typeof buildGuardClassificationOverlay;
	readonly buildStateGraph: typeof buildStateMachineGraph;
}

interface DetachedReconciledEvidence {
	readonly evidence: GuardClassificationOverlayReportResult['evidence'];
	readonly predecessorStageOutcomes: CommandHandlerGraphReportPipelineCapture['predecessorStageOutcomes'];
	readonly terminalContext: {
		readonly repositoryRoot: string;
		readonly semanticSnapshotSummary: GuardClassificationOverlayReportResult['semanticSnapshotSummary'];
		readonly subject: CommandHandlerGraphReportPipelineCapture['frozenSubject']['descriptor'];
	};
}

function deepFreezeDetached<Value>(value: Value, seen = new WeakSet<object>()): Value {
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
	const object = value as object;
	if (seen.has(object)) return value;
	seen.add(object);
	for (const key of Reflect.ownKeys(object)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
		if (descriptor !== undefined && 'value' in descriptor)
			deepFreezeDetached(descriptor.value, seen);
	}
	return Object.freeze(value);
}

function detachReconciledEvidence(
	capture: CommandHandlerGraphReportPipelineCapture,
	guardObservation: GuardEnforcementLedgerObservation,
	stateObservation: StateMachineTopologyObservation,
	stateGraph: StateMachineGraphSnapshot,
	overlay: GuardClassificationOverlaySnapshot
): DetachedReconciledEvidence {
	return deepFreezeDetached(
		JSON.parse(
			canonicalSemanticJson({
				evidence: {
					arrowObservation: capture.observation,
					commandHandlerGraph: capture.commandHandlerGraph,
					encoding: 'FULL_VALIDATED_SAME_SUBJECT_GUARD_STATE_COMMAND_HANDLER_AND_OVERLAY_EVIDENCE',
					guardObservation,
					overlay,
					stateMachineGraph: stateGraph,
					stateObservation
				},
				predecessorStageOutcomes: capture.predecessorStageOutcomes,
				terminalContext: {
					repositoryRoot: capture.repositoryRoot,
					semanticSnapshotSummary: {
						astNodes: capture.semanticSnapshot.astNodes.length,
						id: capture.semanticSnapshot.id,
						programs: capture.semanticSnapshot.programs.length,
						projects: capture.semanticSnapshot.projects.length,
						sources: capture.semanticSnapshot.sources.length
					},
					subject: capture.frozenSubject.descriptor
				}
			})
		) as DetachedReconciledEvidence
	);
}

function detachFreshness(
	value: ReturnType<typeof verifyFrozenSubject>
): ReturnType<typeof verifyFrozenSubject> {
	return deepFreezeDetached(
		JSON.parse(canonicalSemanticJson(value)) as ReturnType<typeof verifyFrozenSubject>
	);
}

function successfulStageEnvelopesReconcile(
	envelopes: SuccessfulStageEnvelopes,
	guardObservation: GuardEnforcementLedgerObservation
): boolean {
	const audit = guardObservation.rawEvidence.audit;
	const expectedGuardOutcome =
		audit.enforcedAnchorBroken.length +
			audit.enforcedWithoutSite.length +
			audit.stale.length +
			audit.unclassified.length ===
		0
			? 'complete'
			: 'partial';
	return (
		envelopes.guardArtifactSetDiagnostics.length === 0 &&
		envelopes.guardDiagnostics.length === 0 &&
		envelopes.guardOutcome === expectedGuardOutcome &&
		guardObservation.coverage.reconciles &&
		envelopes.stateObservationDiagnostics.length === 0 &&
		canonicalSemanticJson(envelopes.stateGraphDiagnostics) ===
			canonicalSemanticJson(STATE_GRAPH_PARTIAL_DIAGNOSTICS) &&
		envelopes.overlayDiagnostics.length === 0
	);
}

function evidenceReconciles(
	capture: CommandHandlerGraphReportPipelineCapture,
	predecessorRequest: CommandHandlerGraphReportRequest,
	request: GuardClassificationOverlayReportRequest,
	commandHandlerRequest: BuildCommandHandlerGraphRequest,
	guardArtifactSet: GuardEnforcementLedgerObservation['artifactSet'],
	guardObservation: GuardEnforcementLedgerObservation,
	stateObservationRequest: BuildStateMachineTopologyObservationRequest,
	stateObservation: StateMachineTopologyObservation,
	stateGraphRequest: BuildStateMachineGraphRequest,
	stateGraph: StateMachineGraphSnapshot,
	overlayRequest: BuildGuardClassificationOverlayRequest,
	overlayInputs: GuardClassificationOverlayBuildInputs,
	overlay: GuardClassificationOverlaySnapshot,
	envelopes: SuccessfulStageEnvelopes,
	producers: SuccessfulStageProducers
): boolean {
	const subject = capture.frozenSubject;
	const subjectId = subject.descriptor.subjectId;
	const snapshot = capture.semanticSnapshot;
	const arrowObservation = capture.observation;
	const handlerGraph = capture.commandHandlerGraph;
	const scope = subject.request.scope;
	const retainedAnalyzers = guardArtifactSet.artifacts.filter((artifact) =>
		artifact.uses.includes('ANALYZER_SOURCE')
	);
	const retainedDataFiles = guardArtifactSet.artifacts.filter((artifact) =>
		artifact.uses.includes('LEDGER_DATA')
	);
	const retainedAnalyzer = retainedAnalyzers[0];
	const retainedData = retainedDataFiles[0];
	if (
		scope.kind !== 'EXPLICIT_PROJECTS' ||
		!exactAdditionalArtifacts(capture) ||
		!successfulStageEnvelopesReconcile(envelopes, guardObservation) ||
		!hasValidatedStaticSemanticSnapshotCapability(snapshot, subject, request.budgets.semantic) ||
		retainedAnalyzers.length !== 1 ||
		retainedDataFiles.length !== 1 ||
		retainedAnalyzer === undefined ||
		retainedData === undefined
	)
		return false;
	try {
		if (
			canonicalSemanticJson(snapshot.requestedCapabilities) !==
				canonicalSemanticJson(GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION.semanticCapabilities) ||
			snapshot.assignabilityRequests.length !== 0 ||
			snapshot.expectedEmpty !== false
		)
			return false;
		const trustedGuardArtifactOutcome = buildGuardEnforcementLedgerArtifactSet(
			{
				budgets: request.budgets.guardArtifactSet,
				operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
				schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
				subjectId
			},
			{ subject }
		);
		const trustedStateObservationOutcome = observeStateMachineTopology(stateObservationRequest, {
			subject
		});
		// The exact built-in producer functions independently validate successful products before
		// returning them. Only an injected producer needs a second trusted replay to close that seam.
		const trustedStateGraphOutcome =
			producers.buildStateGraph === buildStateMachineGraph
				? null
				: buildStateMachineGraph(stateGraphRequest, snapshot, stateObservation);
		const trustedOverlayOutcome =
			producers.buildOverlay === buildGuardClassificationOverlay
				? null
				: buildGuardClassificationOverlay(overlayInputs);
		if (
			trustedGuardArtifactOutcome.outcome !== 'complete' ||
			canonicalSemanticJson(trustedGuardArtifactOutcome.diagnostics) !==
				canonicalSemanticJson(envelopes.guardArtifactSetDiagnostics) ||
			canonicalSemanticJson(trustedGuardArtifactOutcome.artifactSet) !==
				canonicalSemanticJson(guardArtifactSet) ||
			trustedStateObservationOutcome.outcome !== 'complete' ||
			canonicalSemanticJson(trustedStateObservationOutcome.diagnostics) !==
				canonicalSemanticJson(envelopes.stateObservationDiagnostics) ||
			canonicalSemanticJson(trustedStateObservationOutcome.observation) !==
				canonicalSemanticJson(stateObservation) ||
			(trustedStateGraphOutcome !== null &&
				(trustedStateGraphOutcome.outcome !== 'partial' ||
					canonicalSemanticJson(trustedStateGraphOutcome.diagnostics) !==
						canonicalSemanticJson(envelopes.stateGraphDiagnostics) ||
					canonicalSemanticJson(trustedStateGraphOutcome.graph) !==
						canonicalSemanticJson(stateGraph))) ||
			(trustedOverlayOutcome !== null &&
				(trustedOverlayOutcome.outcome !== 'partial' ||
					canonicalSemanticJson(trustedOverlayOutcome.diagnostics) !==
						canonicalSemanticJson(envelopes.overlayDiagnostics) ||
					canonicalSemanticJson(trustedOverlayOutcome.overlay) !== canonicalSemanticJson(overlay)))
		)
			return false;
	} catch {
		return false;
	}
	const trustedValidations = [
		validateArrowCommandCensusObservation(arrowObservation, subject, {
			maxIssues: Math.max(1, Math.min(1_000, request.budgets.observation.maxDiagnostics))
		}),
		validateConstructedCommandHandlerGraph(
			handlerGraph,
			snapshot,
			arrowObservation,
			subject,
			commandHandlerGraphInputDigest(commandHandlerRequest, snapshot, arrowObservation),
			{ maxIssues: Math.max(1, Math.min(1_000, request.budgets.semantic.maxDiagnostics)) }
		),
		validateGuardEnforcementLedgerArtifactSet(guardArtifactSet, subject, {
			maxIssues: Math.max(1, Math.min(1_000, request.budgets.guardArtifactSet.maxDiagnostics))
		}),
		validateGuardEnforcementLedgerObservation(guardObservation, subject, {
			maxIssues: Math.max(1, Math.min(1_000, request.budgets.guardObservation.maxDiagnostics))
		}),
		validateStateMachineTopologyObservation(stateObservation, subject)
	];
	if (trustedValidations.some((validation) => validation.state !== 'VALID')) return false;
	const coverage = overlay.coverage;
	if (
		canonicalSemanticJson(capture.request) !== canonicalSemanticJson(predecessorRequest) ||
		canonicalSemanticJson(scope.projects) !==
			canonicalSemanticJson(predecessorRequest.subjectProjectConfigPaths) ||
		canonicalSemanticJson(subject.request.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.subject) ||
		canonicalSemanticJson(snapshot.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.semantic) ||
		snapshot.subjectId !== subjectId ||
		arrowObservation.subjectId !== subjectId ||
		capture.artifactSet.subjectId !== subjectId ||
		canonicalSemanticJson(arrowObservation.artifactSet) !==
			canonicalSemanticJson(capture.artifactSet) ||
		canonicalSemanticJson(arrowObservation.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.observation) ||
		handlerGraph.subjectId !== subjectId ||
		handlerGraph.semanticSnapshotId !== snapshot.id ||
		handlerGraph.arrowObservationId !== arrowObservation.id ||
		canonicalSemanticJson(handlerGraph.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.commandHandlerGraph) ||
		canonicalSemanticJson(handlerGraph.commandRegistry) !==
			canonicalSemanticJson(commandHandlerRequest.commandRegistry) ||
		canonicalSemanticJson(handlerGraph.handlerRegistry) !==
			canonicalSemanticJson(commandHandlerRequest.handlerRegistry) ||
		commandHandlerRequest.subjectId !== subjectId ||
		commandHandlerRequest.semanticSnapshotId !== snapshot.id ||
		commandHandlerRequest.arrowObservationId !== arrowObservation.id ||
		canonicalSemanticJson(commandHandlerRequest.budgets) !==
			canonicalSemanticJson(predecessorRequest.budgets.commandHandlerGraph) ||
		commandHandlerRequest.schemaVersion !== COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION ||
		commandHandlerRequest.operationVersion !== COMMAND_HANDLER_GRAPH_OPERATION_VERSION ||
		guardArtifactSet.subjectId !== subjectId ||
		guardObservation.subjectId !== subjectId ||
		guardObservation.artifactSet.id !== guardArtifactSet.id ||
		canonicalSemanticJson(guardObservation.artifactSet) !==
			canonicalSemanticJson(guardArtifactSet) ||
		canonicalSemanticJson(guardObservation.budgets) !==
			canonicalSemanticJson(request.budgets.guardObservation) ||
		guardObservation.executor.retainedAnalyzerCanonicalPathKey !==
			retainedAnalyzer.canonicalPathKey ||
		guardObservation.executor.retainedAnalyzerSha256 !== retainedAnalyzer.sha256 ||
		guardObservation.executor.retainedDataCanonicalPathKey !== retainedData.canonicalPathKey ||
		guardObservation.executor.retainedDataSha256 !== retainedData.sha256 ||
		stateObservation.subjectId !== subjectId ||
		canonicalSemanticJson(stateObservation.budgets) !==
			canonicalSemanticJson(request.budgets.stateObservation) ||
		canonicalSemanticJson(stateObservation.artifact) !==
			canonicalSemanticJson(stateObservationRequest.artifact) ||
		stateGraph.subjectId !== subjectId ||
		stateGraph.semanticSnapshotId !== snapshot.id ||
		stateGraph.observationId !== stateObservation.id ||
		canonicalSemanticJson(stateGraph.budgets) !==
			canonicalSemanticJson(request.budgets.stateMachineGraph) ||
		canonicalSemanticJson(stateGraph.source) !== canonicalSemanticJson(stateGraphRequest.source) ||
		overlayRequest.subjectId !== subjectId ||
		overlayRequest.semanticSnapshotId !== snapshot.id ||
		overlayRequest.arrowObservationId !== arrowObservation.id ||
		overlayRequest.commandHandlerGraphId !== handlerGraph.id ||
		overlayRequest.guardObservationId !== guardObservation.id ||
		overlayRequest.stateObservationId !== stateObservation.id ||
		overlayRequest.stateGraphId !== stateGraph.id ||
		canonicalSemanticJson(overlayRequest.budgets) !==
			canonicalSemanticJson(request.budgets.guardClassificationOverlay) ||
		overlay.subjectId !== subjectId ||
		overlay.semanticSnapshotId !== snapshot.id ||
		overlay.arrowObservationId !== arrowObservation.id ||
		overlay.arrowObservationContentDigest !== arrowObservation.contentDigest ||
		overlay.commandHandlerGraphId !== handlerGraph.id ||
		overlay.commandHandlerGraphContentDigest !== handlerGraph.contentDigest ||
		overlay.guardObservationId !== guardObservation.id ||
		overlay.guardObservationContentDigest !== guardObservation.contentDigest ||
		overlay.stateObservationId !== stateObservation.id ||
		overlay.stateObservationContentDigest !== stateObservation.contentDigest ||
		overlay.stateGraphId !== stateGraph.id ||
		overlay.stateGraphContentDigest !== stateGraph.contentDigest ||
		canonicalSemanticJson(overlay.budgets) !== canonicalSemanticJson(overlayRequest.budgets) ||
		overlay.schemaVersion !== GUARD_CLASSIFICATION_OVERLAY_SCHEMA_VERSION ||
		overlay.operationVersion !== GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION ||
		overlay.method !== GUARD_CLASSIFICATION_OVERLAY_METHOD ||
		overlay.capabilityStatus !== GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS ||
		overlay.registryStatus !== GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS ||
		overlay.scope !== GUARD_CLASSIFICATION_OVERLAY_SCOPE ||
		overlay.graphAuthority !== GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY ||
		overlay.authorityTransfer !== GUARD_CLASSIFICATION_OVERLAY_AUTHORITY_TRANSFER ||
		overlay.gateEffect !== GUARD_CLASSIFICATION_OVERLAY_GATE_EFFECT ||
		overlay.oracleChange !== GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE ||
		overlay.baselineChange !== GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE ||
		overlay.integrationStrategy !== GUARD_CLASSIFICATION_OVERLAY_INTEGRATION_STRATEGY ||
		overlay.replacementEquivalence !== GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE ||
		overlay.runtimeEnforcement !== GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT ||
		overlay.runtimePerformability !== GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY ||
		overlay.fullJanCsaa007Conformance !==
			GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE ||
		overlay.fullJanCsaa008Conformance !==
			GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE ||
		overlay.health !== 'PARTIAL' ||
		overlay.capabilities.length !== 2 ||
		overlay.capabilities[0] !== GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY ||
		overlay.capabilities[1] !== GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY ||
		canonicalSemanticJson(overlay.limitations) !==
			canonicalSemanticJson(GUARD_CLASSIFICATION_OVERLAY_LIMITATIONS) ||
		!coverage.reconciles ||
		coverage.classifications !== overlay.classifications.length ||
		coverage.occurrences !== overlay.occurrences.length ||
		coverage.commandEvidenceLinks !== overlay.commandEvidenceLinks.length ||
		coverage.anchorSites !== overlay.anchorSites.length ||
		coverage.frontiers !== overlay.frontiers.length ||
		overlay.layers.length !== 2 ||
		overlay.layers[0].capability !== GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY ||
		overlay.layers[1].capability !== GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY
	)
		return false;
	return true;
}

async function runInternal(
	requestValue: unknown,
	options: RunGuardClassificationOverlayReportOptions,
	progress: ProgressRecorder,
	dependencies: GuardClassificationOverlayReportRuntimeDependencies
): Promise<GuardClassificationOverlayReportOutcome> {
	// Capture the internal dependency references once so producer identity and invocation cannot
	// diverge across awaited stages or trusted-host callbacks.
	const buildOverlay = dependencies.buildOverlay;
	const buildStateGraph = dependencies.buildStateGraph;
	progress.start('REQUEST_BIND');
	let admission: GuardClassificationOverlayReportAdmission;
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
	const predecessorOutcome = await dependencies.captureHandler(admission.predecessorRequest, {
		additionalArtifacts: GUARD_ENFORCEMENT_LEDGER_REPORT_ADDITIONAL_ARTIFACT_PATHS,
		onProgress: (event) => progress.forwardPredecessor(event),
		repositoryRoot: options.repositoryRoot
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
	const predecessor: CommandHandlerGraphReportPipelineCapture = Object.freeze({
		artifactSet: predecessorOutcome.artifactSet,
		commandHandlerGraph: predecessorOutcome.commandHandlerGraph,
		diagnostics: predecessorOutcome.diagnostics,
		frozenSubject: predecessorOutcome.frozenSubject,
		observation: predecessorOutcome.observation,
		outcome: 'captured',
		predecessorStageOutcomes: predecessorOutcome.predecessorStageOutcomes,
		repositoryRoot: predecessorOutcome.repositoryRoot,
		request: predecessorOutcome.request,
		semanticSnapshot: predecessorOutcome.semanticSnapshot
	});
	const inheritedDiagnostics = predecessorDiagnostics(predecessor);
	const arrowValidation = dependencies.validateObservation(
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
	if (arrowValidation.state !== 'VALID' || handlerValidation.state !== 'VALID') {
		progress.fail([], 'PREDECESSOR_VALIDATION_FAILED');
		return failure(
			'PREDECESSOR_VALIDATION_FAILED',
			'PREDECESSOR_PIPELINE',
			arrowValidation.state === 'BUDGET_EXHAUSTED' || handlerValidation.state === 'BUDGET_EXHAUSTED'
				? 'resource-refused'
				: 'failed',
			[
				...inheritedDiagnostics,
				...[...arrowValidation.issues, ...handlerValidation.issues].map((issue) =>
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
		'SAME_SUBJECT_HANDLER_PIPELINE_CAPTURED'
	);

	progress.start('GUARD_ARTIFACT_SET');
	const guardArtifactOutcome = dependencies.buildGuardArtifactSet(
		{
			budgets: request.budgets.guardArtifactSet,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
			subjectId: predecessor.frozenSubject.descriptor.subjectId
		},
		{ subject: predecessor.frozenSubject }
	);
	const guardArtifactDiagnostics = projectedDiagnostics(
		guardArtifactOutcome.diagnostics,
		predecessor.repositoryRoot,
		'GUARD_ARTIFACT_SET',
		'guardArtifactSet'
	);
	if (guardArtifactOutcome.outcome !== 'complete') {
		progress.fail(
			[],
			guardArtifactOutcome.diagnostics[0]?.code ?? 'GUARD_ARTIFACT_SET_UNAVAILABLE'
		);
		return failure(
			'GUARD_ARTIFACT_SET_UNAVAILABLE',
			'GUARD_ARTIFACT_SET',
			diagnosticFailureState(guardArtifactOutcome.diagnostics),
			[...inheritedDiagnostics, ...guardArtifactDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const guardArtifactSet = guardArtifactOutcome.artifactSet;
	const guardArtifactValidation = dependencies.validateGuardArtifactSet(
		guardArtifactSet,
		predecessor.frozenSubject,
		{ maxIssues: Math.max(1, Math.min(1_000, request.budgets.guardArtifactSet.maxDiagnostics)) }
	);
	if (guardArtifactValidation.state !== 'VALID') {
		progress.fail([], 'GUARD_ARTIFACT_SET_VALIDATION_FAILED');
		return failure(
			'GUARD_ARTIFACT_SET_VALIDATION_FAILED',
			'GUARD_ARTIFACT_SET',
			guardArtifactValidation.state === 'BUDGET_EXHAUSTED' ? 'resource-refused' : 'failed',
			[
				...inheritedDiagnostics,
				...guardArtifactValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						redactRoot(issue.message, predecessor.repositoryRoot),
						safeDiagnosticPath(issue.path, predecessor.repositoryRoot),
						'VALIDATE',
						'GUARD_ARTIFACT_SET',
						'ERROR'
					)
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(
		[
			progressObservation(
				'GUARD_ARTIFACTS',
				guardArtifactSet.artifacts.length,
				request.budgets.guardArtifactSet.maxArtifacts
			),
			progressObservation(
				'GUARD_ARTIFACT_BYTES',
				guardArtifactSet.artifacts.reduce((total, artifact) => total + artifact.bytes, 0),
				request.budgets.guardArtifactSet.maxTotalBytes,
				'BYTES'
			)
		],
		'EXACT_GUARD_ARTIFACT_SET_BOUND'
	);

	progress.start('GUARD_ENFORCEMENT_LEDGER');
	const guardOutcome = await dependencies.observeGuard(
		{
			artifactSetId: guardArtifactSet.id,
			budgets: request.budgets.guardObservation,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
			subjectId: predecessor.frozenSubject.descriptor.subjectId
		},
		{ artifactSet: guardArtifactSet, subject: predecessor.frozenSubject },
		{ onProgress: (event) => progress.forwardGuard(event) }
	);
	const guardDiagnostics = projectedDiagnostics(
		guardOutcome.diagnostics,
		predecessor.repositoryRoot,
		'GUARD_ENFORCEMENT_LEDGER',
		'guardObservation'
	);
	if (guardOutcome.outcome === 'unavailable') {
		progress.fail([], guardOutcome.diagnostics[0]?.code ?? 'GUARD_OBSERVATION_UNAVAILABLE');
		return failure(
			'GUARD_OBSERVATION_UNAVAILABLE',
			'GUARD_ENFORCEMENT_LEDGER',
			diagnosticFailureState(guardOutcome.diagnostics),
			[...inheritedDiagnostics, ...guardArtifactDiagnostics, ...guardDiagnostics],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const guardObservation = guardOutcome.observation;
	const guardValidation = dependencies.validateGuardObservation(
		guardObservation,
		predecessor.frozenSubject,
		{ maxIssues: Math.max(1, Math.min(1_000, request.budgets.guardObservation.maxDiagnostics)) }
	);
	if (guardValidation.state !== 'VALID') {
		progress.fail([], 'GUARD_OBSERVATION_VALIDATION_FAILED');
		return failure(
			'GUARD_OBSERVATION_VALIDATION_FAILED',
			'GUARD_ENFORCEMENT_LEDGER',
			guardValidation.state === 'BUDGET_EXHAUSTED' ? 'resource-refused' : 'failed',
			[
				...inheritedDiagnostics,
				...guardArtifactDiagnostics,
				...guardDiagnostics,
				...guardValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						issue.message,
						issue.path,
						'VALIDATE',
						'GUARD_ENFORCEMENT_LEDGER',
						'ERROR'
					)
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(
		[
			progressObservation(
				'GUARD_RECORDS',
				guardObservation.guards.length,
				request.budgets.guardObservation.maxGuardTexts
			),
			progressObservation(
				'GUARD_OCCURRENCES',
				guardObservation.guardedArrows.length,
				request.budgets.guardObservation.maxGuardedArrows
			)
		],
		guardOutcome.outcome === 'complete'
			? 'COMPLETE_RETAINED_GUARD_EVIDENCE'
			: 'PARTIAL_RETAINED_GUARD_EVIDENCE'
	);

	progress.start('STATE_TOPOLOGY_OBSERVATION');
	const selectedStateSource = selectStateSource(predecessor);
	if (selectedStateSource === null) {
		progress.fail([], 'STATE_SOURCE_BINDING_UNAVAILABLE');
		return failure(
			'STATE_SOURCE_BINDING_UNAVAILABLE',
			'STATE_TOPOLOGY_OBSERVATION',
			'incompatible',
			[
				...inheritedDiagnostics,
				...guardArtifactDiagnostics,
				...guardDiagnostics,
				reportDiagnostic(
					'STATE_SOURCE_BINDING_UNAVAILABLE',
					'The exact generated state source does not bind uniquely to the frozen subject and semantic snapshot.',
					GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE.logicalPath,
					'BIND',
					'STATE_TOPOLOGY_OBSERVATION',
					'ERROR'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const stateObservationRequest: BuildStateMachineTopologyObservationRequest = {
		artifact: {
			bytes: selectedStateSource.artifact.bytes,
			canonicalPathKey: selectedStateSource.artifact.canonicalPathKey,
			disposition: 'ANALYZED',
			path: selectedStateSource.artifact.path,
			primaryClass: selectedStateSource.artifact.primaryClass,
			roles: selectedStateSource.artifact.roles,
			sha256: selectedStateSource.artifact.sha256
		},
		budgets: request.budgets.stateObservation,
		operationVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION,
		subjectId: predecessor.frozenSubject.descriptor.subjectId
	};
	const stateObservationOutcome = dependencies.observeState(stateObservationRequest, {
		subject: predecessor.frozenSubject
	});
	const stateObservationDiagnostics = projectedDiagnostics(
		stateObservationOutcome.diagnostics,
		predecessor.repositoryRoot,
		'STATE_TOPOLOGY_OBSERVATION',
		'stateObservation'
	);
	if (stateObservationOutcome.outcome !== 'complete') {
		progress.fail(
			[],
			stateObservationOutcome.diagnostics[0]?.code ?? 'STATE_OBSERVATION_UNAVAILABLE'
		);
		return failure(
			'STATE_OBSERVATION_UNAVAILABLE',
			'STATE_TOPOLOGY_OBSERVATION',
			diagnosticFailureState(stateObservationOutcome.diagnostics),
			[
				...inheritedDiagnostics,
				...guardArtifactDiagnostics,
				...guardDiagnostics,
				...stateObservationDiagnostics
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const stateObservation = stateObservationOutcome.observation;
	const stateObservationValidation = dependencies.validateStateObservation(
		stateObservation,
		predecessor.frozenSubject
	);
	if (stateObservationValidation.state !== 'VALID') {
		progress.fail([], 'STATE_OBSERVATION_VALIDATION_FAILED');
		return failure(
			'STATE_OBSERVATION_VALIDATION_FAILED',
			'STATE_TOPOLOGY_OBSERVATION',
			'failed',
			[
				...inheritedDiagnostics,
				...guardArtifactDiagnostics,
				...guardDiagnostics,
				...stateObservationDiagnostics,
				...stateObservationValidation.issues.map((issue) =>
					reportDiagnostic(
						issue.code,
						issue.message,
						issue.path,
						'VALIDATE',
						'STATE_TOPOLOGY_OBSERVATION',
						'ERROR'
					)
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	progress.complete(
		[
			progressObservation(
				'STATE_MACHINES',
				stateObservation.machines.length,
				request.budgets.stateObservation.maxMachines
			),
			progressObservation(
				'STATE_TRANSITIONS',
				stateObservation.legalTransitions.length,
				request.budgets.stateObservation.maxTransitions
			)
		],
		'COMPLETE_GENERATED_STATE_OBSERVATION'
	);

	progress.start('STATE_MACHINE_GRAPH');
	const stateGraphRequest: BuildStateMachineGraphRequest = {
		budgets: request.budgets.stateMachineGraph,
		observationId: stateObservation.id,
		operationVersion: STATE_MACHINE_GRAPH_OPERATION_VERSION,
		schemaVersion: STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: predecessor.semanticSnapshot.id,
		source: {
			logicalPath: selectedStateSource.semanticSource.logicalPath,
			programId: selectedStateSource.semanticSource.programId,
			projectId: selectedStateSource.semanticSource.projectId,
			semanticSourceId: selectedStateSource.semanticSource.id
		},
		subjectId: predecessor.frozenSubject.descriptor.subjectId
	};
	const stateGraphOutcome = buildStateGraph(
		stateGraphRequest,
		predecessor.semanticSnapshot,
		stateObservation
	);
	const stateGraphDiagnostics = projectedDiagnostics(
		stateGraphOutcome.diagnostics,
		predecessor.repositoryRoot,
		'STATE_MACHINE_GRAPH',
		'stateMachineGraph'
	);
	if (stateGraphOutcome.outcome !== 'partial') {
		progress.fail([], stateGraphOutcome.diagnostics[0]?.code ?? 'STATE_MACHINE_GRAPH_UNAVAILABLE');
		return failure(
			'STATE_MACHINE_GRAPH_UNAVAILABLE',
			'STATE_MACHINE_GRAPH',
			diagnosticFailureState(stateGraphOutcome.diagnostics),
			[
				...inheritedDiagnostics,
				...guardArtifactDiagnostics,
				...guardDiagnostics,
				...stateObservationDiagnostics,
				...stateGraphDiagnostics
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	// The builder validates its constructed graph independently. An injected product remains
	// provisional until trusted producer identity or replay in evidenceReconciles succeeds.
	const stateGraph = stateGraphOutcome.graph;
	progress.complete(
		[
			progressObservation(
				'STATE_GRAPH_NODES',
				stateGraph.nodes.length,
				request.budgets.stateMachineGraph.maxNodes
			),
			progressObservation(
				'STATE_GRAPH_EDGES',
				stateGraph.edges.length,
				request.budgets.stateMachineGraph.maxEdges
			)
		],
		'PARTIAL_OPEN_STATE_GRAPH'
	);

	progress.start('GUARD_CLASSIFICATION_OVERLAY');
	const overlayRequest: BuildGuardClassificationOverlayRequest = {
		arrowObservationId: predecessor.observation.id,
		budgets: request.budgets.guardClassificationOverlay,
		commandHandlerGraphId: predecessor.commandHandlerGraph.id,
		guardObservationId: guardObservation.id,
		operationVersion: GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION,
		schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: predecessor.semanticSnapshot.id,
		stateGraphId: stateGraph.id,
		stateObservationId: stateObservation.id,
		subjectId: predecessor.frozenSubject.descriptor.subjectId
	};
	let commandHandlerRegistries: ReturnType<typeof selectJpwbCommandHandlerRegistries>;
	try {
		commandHandlerRegistries = selectJpwbCommandHandlerRegistries(predecessor.semanticSnapshot);
	} catch {
		progress.fail([], 'REGISTRY_SELECTION_UNAVAILABLE');
		return failure(
			'REGISTRY_SELECTION_UNAVAILABLE',
			'GUARD_CLASSIFICATION_OVERLAY',
			'incompatible',
			[
				...inheritedDiagnostics,
				...guardArtifactDiagnostics,
				...guardDiagnostics,
				...stateObservationDiagnostics,
				...stateGraphDiagnostics,
				reportDiagnostic(
					'REGISTRY_SELECTION_UNAVAILABLE',
					'The exact JPWB COMMANDS and HANDLERS registries could not be selected independently for overlay binding.',
					null,
					'BIND',
					'GUARD_CLASSIFICATION_OVERLAY',
					'ERROR'
				)
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	const commandHandlerRequest: BuildCommandHandlerGraphRequest = {
		arrowObservationId: predecessor.observation.id,
		budgets: predecessor.request.budgets.commandHandlerGraph,
		commandRegistry: commandHandlerRegistries.commandRegistry,
		handlerRegistry: commandHandlerRegistries.handlerRegistry,
		operationVersion: COMMAND_HANDLER_GRAPH_OPERATION_VERSION,
		schemaVersion: COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: predecessor.semanticSnapshot.id,
		subjectId: predecessor.frozenSubject.descriptor.subjectId
	};
	const overlayInputs: GuardClassificationOverlayBuildInputs = {
		arrowObservation: predecessor.observation,
		commandHandlerGraph: predecessor.commandHandlerGraph,
		commandHandlerRequest,
		guardObservation,
		request: overlayRequest,
		semanticSnapshot: predecessor.semanticSnapshot,
		stateGraph,
		stateGraphRequest,
		stateObservation,
		subject: predecessor.frozenSubject
	};
	const overlayOutcome = buildOverlay(overlayInputs, {
		onProgress: (event) => progress.forwardOverlay(event)
	});
	const overlayDiagnostics = projectedDiagnostics(
		overlayOutcome.diagnostics,
		predecessor.repositoryRoot,
		'GUARD_CLASSIFICATION_OVERLAY',
		'guardClassificationOverlay'
	);
	if (overlayOutcome.outcome !== 'partial') {
		progress.fail(
			[],
			overlayOutcome.diagnostics[0]?.code ?? 'GUARD_CLASSIFICATION_OVERLAY_UNAVAILABLE'
		);
		return failure(
			'GUARD_CLASSIFICATION_OVERLAY_UNAVAILABLE',
			'GUARD_CLASSIFICATION_OVERLAY',
			diagnosticFailureState(overlayOutcome.diagnostics),
			[
				...inheritedDiagnostics,
				...guardArtifactDiagnostics,
				...guardDiagnostics,
				...stateObservationDiagnostics,
				...stateGraphDiagnostics,
				...overlayDiagnostics
			],
			request,
			predecessor.frozenSubject.descriptor
		);
	}
	// The builder independently re-derives and validates its complete overlay. Producer identity
	// below avoids redundant replay for the built-in path and replays any injected build seam.
	const overlay = overlayOutcome.overlay;
	progress.complete(
		overlayObservations(overlay, request.budgets.guardClassificationOverlay),
		'PARTIAL_OPEN_GUARD_CLASSIFICATION_OVERLAY'
	);
	let detachedEvidence: DetachedReconciledEvidence | null = null;
	if (
		evidenceReconciles(
			predecessor,
			admission.predecessorRequest,
			request,
			commandHandlerRequest,
			guardArtifactSet,
			guardObservation,
			stateObservationRequest,
			stateObservation,
			stateGraphRequest,
			stateGraph,
			overlayRequest,
			overlayInputs,
			overlay,
			{
				guardArtifactSetDiagnostics: guardArtifactOutcome.diagnostics,
				guardDiagnostics: guardOutcome.diagnostics,
				guardOutcome: guardOutcome.outcome,
				overlayDiagnostics: overlayOutcome.diagnostics,
				stateGraphDiagnostics: stateGraphOutcome.diagnostics,
				stateObservationDiagnostics: stateObservationOutcome.diagnostics
			},
			{
				buildOverlay,
				buildStateGraph
			}
		)
	)
		try {
			detachedEvidence = detachReconciledEvidence(
				predecessor,
				guardObservation,
				stateObservation,
				stateGraph,
				overlay
			);
		} catch {
			// Reconciled evidence that cannot be detached safely cannot enter the terminal result.
		}
	if (detachedEvidence === null) {
		progress.start('RESULT');
		progress.fail([], 'EVIDENCE_IDENTITY_MISMATCH');
		return failure(
			'EVIDENCE_IDENTITY_MISMATCH',
			'RESULT',
			'failed',
			[
				...inheritedDiagnostics,
				...guardArtifactDiagnostics,
				...guardDiagnostics,
				...stateObservationDiagnostics,
				...stateGraphDiagnostics,
				...overlayDiagnostics,
				reportDiagnostic(
					'EVIDENCE_IDENTITY_MISMATCH',
					'The retained arrow, trusted command-handler request, guard, state, producer envelopes, and overlay evidence do not reconcile with one exact frozen subject and trusted producer identity or replay.',
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
	const completedStageOutcomes = deepFreezeDetached({
		guardArtifactSet: {
			diagnosticCodes: guardArtifactOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'complete' as const
		},
		guardClassificationOverlay: {
			diagnosticCodes: overlayOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial' as const
		},
		guardEnforcementLedger: {
			diagnosticCodes: guardOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: guardOutcome.outcome
		},
		predecessorPipeline: detachedEvidence.predecessorStageOutcomes,
		stateMachineGraph: {
			diagnosticCodes: stateGraphOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'partial' as const
		},
		stateTopologyObservation: {
			diagnosticCodes: stateObservationOutcome.diagnostics.map((diagnostic) => diagnostic.code),
			outcome: 'complete' as const
		}
	});

	progress.start('CURRENTNESS');
	let freshness: ReturnType<typeof verifyFrozenSubject>;
	try {
		freshness = detachFreshness(
			dependencies.verifySubject(predecessor.frozenSubject, {
				rootLocator: detachedEvidence.terminalContext.repositoryRoot
			})
		);
	} catch {
		freshness = deepFreezeDetached({
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
	const currentnessDiagnostics = freshness.diagnostics.map((diagnostic) =>
		reportDiagnostic(
			diagnostic.code,
			redactRoot(diagnostic.message, detachedEvidence.terminalContext.repositoryRoot),
			safeDiagnosticPath(diagnostic.path, detachedEvidence.terminalContext.repositoryRoot),
			diagnostic.phase,
			'CURRENTNESS',
			diagnostic.severity
		)
	);
	progress.complete(
		[progressObservation('CURRENTNESS_CHANGED_PATHS', freshness.changedPaths.length, null)],
		currentnessState
	);

	progress.start('RESULT');
	const stageOutcomes: GuardClassificationOverlayReportStageOutcomes = {
		...completedStageOutcomes,
		currentness: {
			diagnosticCodes: freshness.diagnostics.map((diagnostic) => diagnostic.code),
			state: currentnessState
		}
	};
	const report: GuardClassificationOverlayReportOutcome = {
		analysisAuthority: GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY,
		authorityTransfer: GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER,
		diagnostics: [
			...inheritedDiagnostics,
			...guardArtifactDiagnostics,
			...guardDiagnostics,
			...stateObservationDiagnostics,
			...stateGraphDiagnostics,
			...overlayDiagnostics,
			...currentnessDiagnostics
		],
		gateEffect: GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT,
		operationVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request,
		result: {
			capability: {
				baselineChange: GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE,
				derivationCapability: GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
				facadeScope: GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE,
				fullJanCsaa007Conformance: GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
				fullJanCsaa008Conformance: GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
				graphAuthority: GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY,
				id: GUARD_CLASSIFICATION_OVERLAY_REPORT_CAPABILITY_ID,
				inferenceCapability: GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY,
				integrationStrategy: GUARD_CLASSIFICATION_OVERLAY_INTEGRATION_STRATEGY,
				oracleChange: GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE,
				registryStatus: GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS,
				replacementEquivalence: GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE,
				runtimeEnforcement: GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT,
				runtimePerformability: GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY,
				scope: GUARD_CLASSIFICATION_OVERLAY_SCOPE,
				status: GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS
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
			facadeNonclaims: GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS,
			interpretation: 'SELECTED_VALIDATED_SAME_SUBJECT_STATIC_GUARD_CLASSIFICATION_OVERLAY',
			predecessorNonclaims: GUARD_CLASSIFICATION_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS,
			schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_RESULT_SCHEMA_VERSION,
			selection: GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION,
			semanticSnapshotSummary: detachedEvidence.terminalContext.semanticSnapshotSummary
		},
		schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_SCHEMA_VERSION,
		stageOutcomes,
		state: 'partial',
		subject: detachedEvidence.terminalContext.subject
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
						'The admitted guard-classification-overlay report exceeds maxResultBytes.'
					)
				],
				request,
				detachedEvidence.terminalContext.subject
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
			detachedEvidence.terminalContext.subject
		);
	}
}

/** @internal Test seam; intentionally not exported from the package root. */
export async function runGuardClassificationOverlayReportWithDependencies(
	requestValue: unknown,
	options: RunGuardClassificationOverlayReportOptions,
	dependencies: GuardClassificationOverlayReportRuntimeDependencies
): Promise<GuardClassificationOverlayReportOutcome> {
	const progress = createProgressRecorder(options);
	try {
		return progress.finish(await runInternal(requestValue, options, progress, dependencies));
	} catch {
		progress.fail([], 'INTERNAL_FAILURE');
		return progress.finish(
			failure('INTERNAL_FAILURE', 'RESULT', 'failed', [
				reportDiagnostic(
					'INTERNAL_FAILURE',
					'The guard-classification-overlay report failed closed.'
				)
			])
		);
	}
}

export async function runGuardClassificationOverlayReport(
	requestValue: unknown,
	options: RunGuardClassificationOverlayReportOptions
): Promise<GuardClassificationOverlayReportOutcome> {
	return runGuardClassificationOverlayReportWithDependencies(
		requestValue,
		options,
		DEFAULT_DEPENDENCIES
	);
}

export function guardClassificationOverlayReportExitCode(
	outcome: GuardClassificationOverlayReportOutcome
): 2 | 3 | 4 {
	if (outcome.outcome === 'partial' || outcome.state === 'resource-refused') return 3;
	return outcome.state === 'incompatible' ? 2 : 4;
}
