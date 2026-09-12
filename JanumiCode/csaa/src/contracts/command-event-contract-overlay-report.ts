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
	COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER,
	COMMAND_EVENT_CONTRACT_OVERLAY_BASELINE_CHANGE,
	COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS,
	COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_GRAPH_AUTHORITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_INTEGRATION_STRATEGY,
	COMMAND_EVENT_CONTRACT_OVERLAY_METHOD,
	COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE,
	COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_STATUS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_AUTHORITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_EXECUTION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_INTEGRATION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_SCOPE,
	type CommandEventContractOverlayBudgets,
	type CommandEventContractOverlayCoverage,
	type CommandEventContractOverlaySnapshot
} from './command-event-contract-overlay.js';
import type { SemanticSnapshotId } from './semantic.js';
import type { SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent facade over one exact semantic, retained-arrow, command-handler, and
 * command-event-contract overlay pipeline. It is not a registered JAN-CSAA-007 operation or DWP
 * completion evidence.
 */
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-command-event-contract-overlay-report-request/0.1.0' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCHEMA_VERSION =
	'jan-csaa-command-event-contract-overlay-report/0.1.0' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-command-event-contract-overlay-report-result/0.1.0' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION =
	'jan-csaa-report-command-event-contract-overlay/0.1.0' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY = 'NONE' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT = 'NONE' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION =
	COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_CAPABILITY_ID =
	'command-event-contract-static-overlay' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCOPE =
	'EXACT_SELECTED_FROZEN_SUBJECT_SEMANTIC_RETAINED_ARROW_COMMAND_HANDLER_AND_COMMAND_EVENT_CONTRACT_OVERLAY' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROJECT_CONFIG_PATHS =
	COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS;

export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SELECTION = Object.freeze({
	commandDispatchTopology: 'NOT_CONSUMED',
	commandEventRegistries: 'EXACT_GENERATED_COMMANDS_AND_EVENTS_DECLARATIONS',
	commandHandlerEvidence: 'FULL_VALIDATED_SAME_SUBJECT_COMMAND_HANDLER_GRAPH',
	execution: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION,
	guardClassificationOverlay: 'NOT_CONSUMED',
	guardEnforcementLedger: 'NOT_CONSUMED',
	overlayMethod: COMMAND_EVENT_CONTRACT_OVERLAY_METHOD,
	retainedArrowEvidence: 'FULL_VALIDATED_SAME_SUBJECT_RETAINED_ARROW_OBSERVATION',
	retainedEventSurfaceCensus:
		'EXACT_FROZEN_ARTIFACT_REFERENCE_NOT_EXECUTED_BY_CSAA_AND_NOT_INTEGRATED',
	semanticCapabilities: Object.freeze(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const),
	semanticEvidence: 'FULL_VALIDATED_SAME_SUBJECT_STATIC_SEMANTIC_SNAPSHOT_SUMMARY',
	subjectPopulation:
		'EXPLICIT_SEVEN_PROJECT_CLOSURE_PLUS_FIXED_RETAINED_ARROW_EVENT_SURFACE_CENSUS_AND_COMMAND_EVENT_VOCAB_ARTIFACTS_CAPTURED_IN_ONE_FROZEN_SUBJECT',
	vocabArtifact: 'EXACT_FROZEN_M3_COMMANDS_EVENTS_VOCAB_ARTIFACT'
} as const);

export interface CommandEventContractOverlayReportBudgets extends CommandHandlerGraphReportBudgets {
	readonly commandEventContractOverlay: CommandEventContractOverlayBudgets;
}

/** Absolute admission ceilings, never caller defaults, performance targets, or SLOs. */
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SAFETY_CEILINGS = Object.freeze({
	...COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS,
	commandEventContractOverlay: Object.freeze({
		maxAstNodes: 5_000_000,
		maxBoundContributions: 2_000_000,
		maxCommands: 100_000,
		maxDeclaredLinks: 2_000_000,
		maxDiagnostics: 100_000,
		maxEventContracts: 100_000,
		maxFrontiers: 1_000_000,
		maxPinnedEmissions: 1_000_000,
		maxSourceBytes: 256 * 1024 * 1024
	})
} satisfies CommandEventContractOverlayReportBudgets);

export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	commandHandlerGraphReport: COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS,
	commandHandlerGraphReportPredecessors: COMMAND_HANDLER_GRAPH_REPORT_PREDECESSOR_NONCLAIMS
} as const);

/** Embedded predecessor and overlay limitations remain authoritative; this facade narrows claims. */
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_NONCLAIMS = Object.freeze([
	'COMMAND_DISPATCH_TOPOLOGY_CONSUMPTION_OR_DISPATCH_CLOSURE',
	'GUARD_ENFORCEMENT_LEDGER_OR_GUARD_CLASSIFICATION_OVERLAY_CONSUMPTION',
	'RUNTIME_EVENT_CONSTRUCTION_EMISSION_OR_COMMAND_PERFORMABILITY',
	'RUNTIME_HANDLER_INVOCATION_TARGET_SELECTION_OR_HANDLER_OWNERSHIP',
	'EVENT_PAYLOAD_COMPATIBILITY_OR_RUNTIME_VALIDATION',
	'CONTROL_FLOW_DOMINANCE_PATH_FEASIBILITY_OR_REACHABILITY',
	'PERSISTENCE_WRITE_OR_EFFECT_PROOF',
	'RETAINED_EVENT_SURFACE_CENSUS_EXECUTION_OR_GATE_RESULT',
	'RETAINED_EVENT_SURFACE_CENSUS_AS_FRESH_RUNTIME_EVIDENCE',
	'COMMAND_EVENT_RELATION_COMPLETENESS_OR_DEAD_CODE_PROOF',
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

export interface CommandEventContractOverlayReportRequest {
	readonly budgets: CommandEventContractOverlayReportBudgets;
	/** Explicit acknowledgement required because the retained arrow predecessor executes modules. */
	readonly executionSelection: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION;
	readonly operationVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION;
	/** Fixed bounded semantic closure; retained artifacts are implementation-owned. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type CommandEventContractOverlayReportStage =
	'REQUEST' | 'PREDECESSOR_PIPELINE' | 'COMMAND_EVENT_CONTRACT_OVERLAY' | 'CURRENTNESS' | 'RESULT';

export interface CommandEventContractOverlayReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly predecessorSource: CommandHandlerGraphReportDiagnostic['source'] | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source:
		'REPORT' | 'PREDECESSOR_PIPELINE' | 'COMMAND_EVENT_CONTRACT_OVERLAY' | 'CURRENTNESS';
}

export interface CommandEventContractOverlayReportStageOutcomes {
	readonly commandEventContractOverlay: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly predecessorPipeline: Omit<CommandHandlerGraphReportStageOutcomes, 'currentness'>;
}

export interface CommandEventContractOverlayReportResult {
	readonly capability: {
		readonly authorityTransfer: typeof COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER;
		readonly baselineChange: typeof COMMAND_EVENT_CONTRACT_OVERLAY_BASELINE_CHANGE;
		readonly derivationCapability: typeof COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY;
		readonly facadeScope: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCOPE;
		readonly fullJanCsaa007Conformance: typeof COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE;
		readonly fullJanCsaa008Conformance: typeof COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE;
		readonly graphAuthority: typeof COMMAND_EVENT_CONTRACT_OVERLAY_GRAPH_AUTHORITY;
		readonly id: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_CAPABILITY_ID;
		readonly inferenceCapability: typeof COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY;
		readonly integrationStrategy: typeof COMMAND_EVENT_CONTRACT_OVERLAY_INTEGRATION_STRATEGY;
		readonly oracleChange: typeof COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE;
		readonly registryStatus: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_STATUS;
		readonly replacementEquivalence: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE;
		readonly retainedCensusAuthority: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_AUTHORITY;
		readonly retainedCensusExecution: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_EXECUTION;
		readonly retainedCensusIntegration: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_INTEGRATION;
		readonly runtimeEmission: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION;
		readonly runtimePerformability: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY;
		readonly scope: typeof COMMAND_EVENT_CONTRACT_OVERLAY_SCOPE;
		readonly status: typeof COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS;
	};
	readonly coverage: CommandEventContractOverlayCoverage & {
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
		readonly encoding: 'FULL_VALIDATED_SAME_SUBJECT_RETAINED_ARROW_COMMAND_HANDLER_AND_COMMAND_EVENT_CONTRACT_OVERLAY_EVIDENCE';
		readonly overlay: CommandEventContractOverlaySnapshot;
	};
	readonly facadeNonclaims: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_SAME_SUBJECT_STATIC_COMMAND_EVENT_CONTRACT_OVERLAY';
	readonly predecessorNonclaims: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS;
	readonly schemaVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly astNodes: number;
		readonly id: SemanticSnapshotId;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
}

export interface CommandEventContractOverlayReportPartialOutcome {
	readonly analysisAuthority: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly CommandEventContractOverlayReportDiagnostic[];
	readonly gateEffect: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: CommandEventContractOverlayReportRequest;
	readonly result: CommandEventContractOverlayReportResult;
	readonly schemaVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: CommandEventContractOverlayReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type CommandEventContractOverlayReportFailureState =
	'failed' | 'incompatible' | 'resource-refused';

export interface CommandEventContractOverlayReportUnavailableOutcome {
	readonly analysisAuthority: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly CommandEventContractOverlayReportDiagnostic[];
	readonly facadeNonclaims: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_NONCLAIMS;
	readonly gateEffect: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: CommandEventContractOverlayReportRequest;
	readonly schemaVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SCHEMA_VERSION;
	readonly stage: CommandEventContractOverlayReportStage;
	readonly state: CommandEventContractOverlayReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type CommandEventContractOverlayReportOutcome =
	| CommandEventContractOverlayReportPartialOutcome
	| CommandEventContractOverlayReportUnavailableOutcome;
