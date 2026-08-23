import type { ArrowCommandCensusObservation } from './arrow-command-census.js';
import type { CommandHandlerGraphSnapshot } from './command-handler-graph.js';
import {
	COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION,
	COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS,
	COMMAND_HANDLER_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
	COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS,
	COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS,
	type CommandHandlerGraphReportBudgets,
	type CommandHandlerGraphReportDiagnostic,
	type CommandHandlerGraphReportStageOutcomes
} from './command-handler-graph-report.js';
import {
	GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE,
	GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS,
	GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
	GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
	GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
	GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY,
	GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY,
	GUARD_CLASSIFICATION_OVERLAY_INTEGRATION_STRATEGY,
	GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE,
	GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS,
	GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE,
	GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT,
	GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY,
	GUARD_CLASSIFICATION_OVERLAY_SCOPE,
	type GuardClassificationOverlayBudgets,
	type GuardClassificationOverlayCoverage,
	type GuardClassificationOverlaySnapshot
} from './guard-classification-overlay.js';
import type {
	GuardEnforcementLedgerArtifactSetBudgets,
	GuardEnforcementLedgerBudgets,
	GuardEnforcementLedgerObservation
} from './guard-enforcement-ledger.js';
import {
	GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS,
	GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS
} from './guard-enforcement-ledger-report.js';
import type { SemanticSnapshotId } from './semantic.js';
import type {
	StateMachineGraphBudgets,
	StateMachineGraphSnapshot,
	StateMachineTopologyObservation,
	StateMachineTopologyObservationBudgets
} from './state-machine-graph.js';
import {
	STATE_MACHINE_GRAPH_REPORT_NONCLAIMS,
	STATE_MACHINE_GRAPH_REPORT_SAFETY_CEILINGS
} from './state-machine-graph-report.js';
import type { SubjectDescriptor } from './subject.js';

/** Preliminary coding-agent facade over one exact same-subject guard-classification pipeline. */
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-guard-classification-overlay-report-request/0.1.0' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_SCHEMA_VERSION =
	'jan-csaa-guard-classification-overlay-report/0.1.0' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-guard-classification-overlay-report-result/0.1.0' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION =
	'jan-csaa-report-guard-classification-overlay/0.1.0' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY = 'NONE' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT = 'NONE' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION =
	COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_CAPABILITY_ID =
	'guard-classification-static-overlay' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE =
	'EXACT_SELECTED_FROZEN_SUBJECT_RETAINED_GUARD_STATE_COMMAND_HANDLER_AND_GUARD_CLASSIFICATION_OVERLAY' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_PROJECT_CONFIG_PATHS =
	COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS;
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE = Object.freeze({
	logicalPath: 'packages/rph-domain/src/transitions.data.ts',
	projectConfigPath: 'packages/rph-domain/tsconfig.json'
} as const);

export const GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION = Object.freeze({
	commandDispatchTopology: 'NOT_CONSUMED',
	commandEventContractOverlay: 'NOT_CONSUMED',
	commandHandlerEvidence: 'FULL_VALIDATED_SAME_SUBJECT_COMMAND_HANDLER_GRAPH',
	execution: GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION,
	guardEvidence: 'FULL_VALIDATED_SAME_SUBJECT_RETAINED_GUARD_OBSERVATION',
	overlayMethod: 'jpwb-retained-guard-state-and-handler-correlation/0.1.0',
	retainedArrowEvidence: 'FULL_VALIDATED_SAME_SUBJECT_RETAINED_ARROW_OBSERVATION',
	semanticCapabilities: Object.freeze(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const),
	stateEvidence: 'FULL_VALIDATED_SAME_SUBJECT_STATE_OBSERVATION_AND_GRAPH',
	stateSource: GUARD_CLASSIFICATION_OVERLAY_REPORT_STATE_SOURCE,
	subjectPopulation:
		'EXPLICIT_SEVEN_PROJECT_CLOSURE_PLUS_FIXED_RETAINED_ARROW_AND_GUARD_ARTIFACTS_CAPTURED_IN_ONE_FROZEN_SUBJECT'
} as const);

export interface GuardClassificationOverlayReportBudgets extends CommandHandlerGraphReportBudgets {
	readonly guardArtifactSet: GuardEnforcementLedgerArtifactSetBudgets;
	readonly guardClassificationOverlay: GuardClassificationOverlayBudgets;
	readonly guardObservation: GuardEnforcementLedgerBudgets;
	readonly stateMachineGraph: StateMachineGraphBudgets;
	readonly stateObservation: StateMachineTopologyObservationBudgets;
}

/** Absolute admission ceilings, never defaults, performance targets, or SLOs. */
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS = Object.freeze({
	...COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS,
	guardArtifactSet: GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.artifactSet,
	guardClassificationOverlay: Object.freeze({
		maxAnchorSites: 100_000,
		maxAstNodes: 5_000_000,
		maxCommandEvidenceLinks: 2_000_000,
		maxDiagnostics: 100_000,
		maxFrontiers: 1_000_000,
		maxGuardOccurrences: 100_000,
		maxGuardRecords: 100_000,
		maxHandlerLinks: 2_000_000,
		maxSourceBytes: 256 * 1024 * 1024,
		maxStateEvidenceRefs: 2_000_000
	}),
	guardObservation: GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS.observation,
	stateMachineGraph: STATE_MACHINE_GRAPH_REPORT_SAFETY_CEILINGS.stateMachineGraph,
	stateObservation: STATE_MACHINE_GRAPH_REPORT_SAFETY_CEILINGS.topologyObservation
} satisfies GuardClassificationOverlayReportBudgets);

export const GUARD_CLASSIFICATION_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	commandHandlerGraphReport: COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS,
	commandHandlerGraphReportPredecessors: COMMAND_HANDLER_GRAPH_REPORT_PREDECESSOR_NONCLAIMS,
	guardEnforcementLedgerReport: GUARD_ENFORCEMENT_LEDGER_REPORT_NONCLAIMS,
	stateMachineGraphReport: STATE_MACHINE_GRAPH_REPORT_NONCLAIMS
} as const);

/** Embedded predecessor and overlay limitations remain authoritative; this facade narrows claims. */
export const GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS = Object.freeze([
	'COMMAND_DISPATCH_TOPOLOGY_CONSUMPTION_OR_DISPATCH_CLOSURE',
	'COMMAND_EVENT_CONTRACT_OVERLAY_CONSUMPTION_OR_EVENT_COVERAGE',
	'INDEPENDENT_CORRECTNESS_OR_PROMOTION_OF_RETAINED_GUARD_CLASSIFICATIONS',
	'RUNTIME_GUARD_ENFORCEMENT_COMMAND_PERFORMABILITY_OR_COMMAND_REFUSAL',
	'RUNTIME_HANDLER_INVOCATION_TARGET_SELECTION_OR_HANDLER_OWNERSHIP',
	'EXACT_FACTORY_HANDLER_ATTRIBUTION',
	'GUARD_DOMINANCE_CONTROL_FLOW_PATH_FEASIBILITY_OR_REACHABILITY',
	'GUARD_EFFECT_EVENT_OR_PERSISTENCE_COVERAGE',
	'RETAINED_TEST_GATE_EXECUTION_OR_GATE_RESULT',
	'BASELINE_MATCH_AS_CORRECTNESS_PROOF',
	'REPLACEMENT_EQUIVALENCE',
	'PROVIDER_QUALIFICATION',
	'HOSTILE_CODE_SECURITY_SANDBOX',
	'NETWORK_FILESYSTEM_PROCESS_ENVIRONMENT_OR_SECRET_CONFINEMENT',
	'SUBJECT_MODULE_INITIALIZER_SAFETY_OR_SIDE_EFFECT_FREEDOM',
	'WHOLE_REPOSITORY_WHOLE_PROGRAM_OR_RUNTIME_CLOSURE',
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'JAN_CSAA_CAP_032_SEMANTIC_COMPARISON',
	'DWP_004_DWP_005_OR_DWP_006_COMPLETION',
	'FULL_JAN_CSAA_007_OR_008_CONFORMANCE',
	'JAN_CSAA_007_REGISTERED_OPERATION_OR_OPERATION_RESPONSE_ENVELOPE',
	'PERSISTED_OR_DESERIALIZED_CAPTURE_REPLAY',
	'PERSISTENT_FRESHNESS_OR_CROSS_REVISION_CURRENTNESS',
	'WORKING_CHANGE_MERGE_BASE_TARGET_REVISION_OR_CANDIDATE_MERGE_BINDING',
	'FORMAL_JAN_CSAA_RULE_FINDING_OR_CODE_DEAD_OR_ORPHAN_CLASSIFICATION',
	'ARCHITECTURE_DEAD_CODE_NON_IMPACT_SAFE_REMOVAL_FINDING_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface GuardClassificationOverlayReportRequest {
	readonly budgets: GuardClassificationOverlayReportBudgets;
	/** Explicit acknowledgement required because retained predecessor modules execute. */
	readonly executionSelection: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION;
	readonly operationVersion: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION;
	/** Fixed bounded semantic closure; retained artifacts and state source are implementation-owned. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type GuardClassificationOverlayReportStage =
	| 'REQUEST'
	| 'PREDECESSOR_PIPELINE'
	| 'GUARD_ARTIFACT_SET'
	| 'GUARD_ENFORCEMENT_LEDGER'
	| 'STATE_TOPOLOGY_OBSERVATION'
	| 'STATE_MACHINE_GRAPH'
	| 'GUARD_CLASSIFICATION_OVERLAY'
	| 'CURRENTNESS'
	| 'RESULT';

export interface GuardClassificationOverlayReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly predecessorSource: CommandHandlerGraphReportDiagnostic['source'] | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source:
		| 'REPORT'
		| 'PREDECESSOR_PIPELINE'
		| 'GUARD_ARTIFACT_SET'
		| 'GUARD_ENFORCEMENT_LEDGER'
		| 'STATE_TOPOLOGY_OBSERVATION'
		| 'STATE_MACHINE_GRAPH'
		| 'GUARD_CLASSIFICATION_OVERLAY'
		| 'CURRENTNESS';
}

export interface GuardClassificationOverlayReportStageOutcomes {
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly guardArtifactSet: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete';
	};
	readonly guardClassificationOverlay: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
	readonly guardEnforcementLedger: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete' | 'partial';
	};
	readonly predecessorPipeline: Omit<CommandHandlerGraphReportStageOutcomes, 'currentness'>;
	readonly stateMachineGraph: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
	readonly stateTopologyObservation: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete';
	};
}

export interface GuardClassificationOverlayReportResult {
	readonly capability: {
		readonly baselineChange: typeof GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE;
		readonly derivationCapability: typeof GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY;
		readonly facadeScope: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_SCOPE;
		readonly fullJanCsaa007Conformance: typeof GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE;
		readonly fullJanCsaa008Conformance: typeof GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE;
		readonly graphAuthority: typeof GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY;
		readonly id: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_CAPABILITY_ID;
		readonly inferenceCapability: typeof GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY;
		readonly integrationStrategy: typeof GUARD_CLASSIFICATION_OVERLAY_INTEGRATION_STRATEGY;
		readonly oracleChange: typeof GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE;
		readonly registryStatus: typeof GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS;
		readonly replacementEquivalence: typeof GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE;
		readonly runtimeEnforcement: typeof GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT;
		readonly runtimePerformability: typeof GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY;
		readonly scope: typeof GUARD_CLASSIFICATION_OVERLAY_SCOPE;
		readonly status: typeof GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS;
	};
	readonly coverage: GuardClassificationOverlayCoverage & {
		readonly health: 'PARTIAL';
		readonly limitations: number;
	};
	readonly currentness: {
		readonly changedPaths: readonly string[];
		readonly diagnosticCodes: readonly string[];
		readonly scope: 'SELECTED_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly evidence: {
		readonly arrowObservation: ArrowCommandCensusObservation;
		readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
		readonly encoding: 'FULL_VALIDATED_SAME_SUBJECT_GUARD_STATE_COMMAND_HANDLER_AND_OVERLAY_EVIDENCE';
		readonly guardObservation: GuardEnforcementLedgerObservation;
		readonly overlay: GuardClassificationOverlaySnapshot;
		readonly stateMachineGraph: StateMachineGraphSnapshot;
		readonly stateObservation: StateMachineTopologyObservation;
	};
	readonly facadeNonclaims: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_SAME_SUBJECT_STATIC_GUARD_CLASSIFICATION_OVERLAY';
	readonly predecessorNonclaims: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS;
	readonly schemaVersion: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly astNodes: number;
		readonly id: SemanticSnapshotId;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
}

export interface GuardClassificationOverlayReportPartialOutcome {
	readonly analysisAuthority: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly GuardClassificationOverlayReportDiagnostic[];
	readonly gateEffect: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: GuardClassificationOverlayReportRequest;
	readonly result: GuardClassificationOverlayReportResult;
	readonly schemaVersion: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: GuardClassificationOverlayReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type GuardClassificationOverlayReportFailureState =
	'failed' | 'incompatible' | 'resource-refused';

export interface GuardClassificationOverlayReportUnavailableOutcome {
	readonly analysisAuthority: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly GuardClassificationOverlayReportDiagnostic[];
	readonly facadeNonclaims: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_NONCLAIMS;
	readonly gateEffect: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: GuardClassificationOverlayReportRequest;
	readonly schemaVersion: typeof GUARD_CLASSIFICATION_OVERLAY_REPORT_SCHEMA_VERSION;
	readonly stage: GuardClassificationOverlayReportStage;
	readonly state: GuardClassificationOverlayReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type GuardClassificationOverlayReportOutcome =
	| GuardClassificationOverlayReportPartialOutcome
	| GuardClassificationOverlayReportUnavailableOutcome;
