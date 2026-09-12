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
	COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS,
	COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT,
	COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY,
	COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY,
	COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY,
	COMMAND_DISPATCH_TOPOLOGY_METHOD,
	COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION,
	COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY,
	COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE,
	COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY,
	COMMAND_DISPATCH_TOPOLOGY_SCOPE,
	type CommandDispatchTopologyBudgets,
	type CommandDispatchTopologyCoverage,
	type CommandDispatchTopologySnapshot
} from './command-dispatch-topology.js';
import type { SemanticSnapshotId } from './semantic.js';
import type { SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent facade over one exact semantic, retained-arrow, command-handler, and
 * command-dispatch topology pipeline. It is not a registered JAN-CSAA-007 operation or DWP
 * completion evidence.
 */
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-command-dispatch-topology-report-request/0.1.0' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_SCHEMA_VERSION =
	'jan-csaa-command-dispatch-topology-report/0.1.0' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-command-dispatch-topology-report-result/0.1.0' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION =
	'jan-csaa-report-command-dispatch-topology/0.1.0' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY = 'NONE' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT = 'NONE' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION =
	COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION;
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_CAPABILITY_ID =
	'command-dispatch-static-topology' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE =
	'EXACT_SELECTED_FROZEN_SUBJECT_SEMANTIC_RETAINED_ARROW_COMMAND_HANDLER_AND_COMMAND_DISPATCH_TOPOLOGY' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_PROJECT_CONFIG_PATHS =
	COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS;

export const COMMAND_DISPATCH_TOPOLOGY_REPORT_SELECTION = Object.freeze({
	commandBus:
		'EXACT_JPWB_RPH_APPLICATION_COMMAND_BUS_DISPATCH_STAMPED_METHOD_DERIVED_FROM_THE_SEMANTIC_SNAPSHOT',
	commandHandlerEvidence: 'FULL_VALIDATED_SAME_SUBJECT_COMMAND_HANDLER_GRAPH',
	dispatchMethod: COMMAND_DISPATCH_TOPOLOGY_METHOD,
	execution: COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION,
	retainedArrowEvidence: 'FULL_VALIDATED_SAME_SUBJECT_RETAINED_ARROW_OBSERVATION',
	retainedDispatchCensus: 'EXACT_FROZEN_ARTIFACT_REFERENCE_NOT_EXECUTED_BY_CSAA_AND_NOT_INTEGRATED',
	semanticCapabilities: Object.freeze(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const),
	semanticEvidence: 'FULL_VALIDATED_SAME_SUBJECT_STATIC_SEMANTIC_SNAPSHOT_SUMMARY',
	subjectPopulation:
		'EXPLICIT_SEVEN_PROJECT_CLOSURE_PLUS_FIXED_RETAINED_ARROW_AND_COMMAND_DISPATCH_CENSUS_ARTIFACTS_CAPTURED_IN_ONE_FROZEN_SUBJECT'
} as const);

export interface CommandDispatchTopologyReportBudgets extends CommandHandlerGraphReportBudgets {
	readonly commandDispatchTopology: CommandDispatchTopologyBudgets;
}

/** Absolute admission ceilings, never caller defaults, performance targets, or SLOs. */
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_SAFETY_CEILINGS = Object.freeze({
	...COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS,
	commandDispatchTopology: Object.freeze({
		maxAstNodes: 5_000_000,
		maxDiagnostics: 100_000,
		maxEdges: 100_000,
		maxHandlerTargets: 100_000,
		maxNodes: 1,
		maxSourceBytes: 128 * 1024 * 1024
	})
} satisfies CommandDispatchTopologyReportBudgets);

export const COMMAND_DISPATCH_TOPOLOGY_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	commandHandlerGraphReport: COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS,
	commandHandlerGraphReportPredecessors: COMMAND_HANDLER_GRAPH_REPORT_PREDECESSOR_NONCLAIMS
} as const);

/** Embedded predecessor and topology limitations remain authoritative; this facade narrows claims. */
export const COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_027_GRAPH_DERIVATION_OR_CAP_028_GRAPH_INFERENCE',
	'RUNTIME_COMMAND_DISPATCH_CLOSURE_OR_COMMAND_PERFORMABILITY',
	'RUNTIME_HANDLER_INVOCATION_TARGET_SELECTION_OR_HANDLER_OWNERSHIP',
	'RETAINED_COMMAND_DISPATCH_CENSUS_EXECUTION_OR_INTEGRATION',
	'RETAINED_COMMAND_DISPATCH_CENSUS_GATE_EXECUTION_OR_GATE_RESULT',
	'RETAINED_COMMAND_DISPATCH_CENSUS_AS_RUNTIME_DISPATCH_PROOF',
	'EXACT_HANDLER_TARGET_ATTRIBUTION_FOR_A_RUNTIME_COMMAND',
	'COMMAND_SPEC_REGISTRY_CROSS_PROGRAM_EQUIVALENCE',
	'CONTROL_FLOW_PATH_FEASIBILITY_OR_ALTERNATE_DISPATCH_ROUTE_CLOSURE',
	'MISSING_HANDLER_GUARD_RUNTIME_REJECTION',
	'PAYLOAD_VALIDATION_SUCCESS_OR_PARSED_VALUE_IDENTITY',
	'GUARD_EFFECT_EVENT_OR_PERSISTENCE_COVERAGE',
	'BASELINE_MATCH_AS_CORRECTNESS_PROOF',
	'REPLACEMENT_EQUIVALENCE',
	'PROVIDER_QUALIFICATION',
	'HOSTILE_CODE_SECURITY_SANDBOX',
	'NETWORK_FILESYSTEM_PROCESS_ENVIRONMENT_OR_SECRET_CONFINEMENT',
	'SUBJECT_MODULE_INITIALIZER_SAFETY_OR_SIDE_EFFECT_FREEDOM',
	'WHOLE_REPOSITORY_WHOLE_PROGRAM_OR_RUNTIME_CLOSURE',
	'JAN_CSAA_CAP_010_PROJECT_CONTEXT_PROJECTION',
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

export interface CommandDispatchTopologyReportRequest {
	readonly budgets: CommandDispatchTopologyReportBudgets;
	/** Explicit acknowledgement required because the retained arrow predecessor executes modules. */
	readonly executionSelection: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION;
	readonly operationVersion: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION;
	/** Fixed bounded semantic closure; retained artifacts are implementation-owned. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type CommandDispatchTopologyReportStage =
	'REQUEST' | 'PREDECESSOR_PIPELINE' | 'COMMAND_DISPATCH_TOPOLOGY' | 'CURRENTNESS' | 'RESULT';

export interface CommandDispatchTopologyReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly predecessorSource: CommandHandlerGraphReportDiagnostic['source'] | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'PREDECESSOR_PIPELINE' | 'COMMAND_DISPATCH_TOPOLOGY' | 'CURRENTNESS';
}

export interface CommandDispatchTopologyReportStageOutcomes {
	readonly commandDispatchTopology: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly predecessorPipeline: Omit<CommandHandlerGraphReportStageOutcomes, 'currentness'>;
}

export interface CommandDispatchTopologyReportResult {
	readonly capability: {
		readonly commandHandlerPopulationTreatment: typeof COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT;
		readonly derivationCapability: typeof COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY;
		readonly facadeScope: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_SCOPE;
		readonly fullJanCsaa007Conformance: typeof COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE;
		readonly fullJanCsaa008Conformance: typeof COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE;
		readonly graphAuthority: typeof COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY;
		readonly id: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_CAPABILITY_ID;
		readonly inferenceCapability: typeof COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY;
		readonly registryStatus: typeof COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS;
		readonly retainedDispatchCensusExecution: typeof COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION;
		readonly retainedDispatchCensusIntegration: typeof COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION;
		readonly retainedDispatchCensusVerifierAuthority: typeof COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY;
		readonly runtimeDispatchClosure: typeof COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE;
		readonly runtimePerformability: typeof COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY;
		readonly scope: typeof COMMAND_DISPATCH_TOPOLOGY_SCOPE;
		readonly status: typeof COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS;
	};
	readonly coverage: CommandDispatchTopologyCoverage & {
		readonly edges: number;
		readonly health: 'PARTIAL';
		readonly limitations: number;
		readonly nodes: number;
	};
	readonly currentness: {
		readonly changedPaths: readonly string[];
		readonly diagnosticCodes: readonly string[];
		readonly scope: 'SELECTED_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly evidence: {
		readonly commandDispatchTopology: CommandDispatchTopologySnapshot;
		readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
		readonly encoding: 'FULL_VALIDATED_RETAINED_ARROW_COMMAND_HANDLER_AND_COMMAND_DISPATCH_EVIDENCE';
		readonly observation: ArrowCommandCensusObservation;
	};
	readonly facadeNonclaims: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_SAME_SUBJECT_STATIC_COMMAND_DISPATCH_TOPOLOGY';
	readonly predecessorNonclaims: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_PREDECESSOR_NONCLAIMS;
	readonly schemaVersion: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly astNodes: number;
		readonly id: SemanticSnapshotId;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
}

export interface CommandDispatchTopologyReportPartialOutcome {
	readonly analysisAuthority: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly CommandDispatchTopologyReportDiagnostic[];
	readonly gateEffect: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: CommandDispatchTopologyReportRequest;
	readonly result: CommandDispatchTopologyReportResult;
	readonly schemaVersion: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: CommandDispatchTopologyReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type CommandDispatchTopologyReportFailureState =
	'failed' | 'incompatible' | 'resource-refused';

export interface CommandDispatchTopologyReportUnavailableOutcome {
	readonly analysisAuthority: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly CommandDispatchTopologyReportDiagnostic[];
	readonly facadeNonclaims: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_NONCLAIMS;
	readonly gateEffect: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: CommandDispatchTopologyReportRequest;
	readonly schemaVersion: typeof COMMAND_DISPATCH_TOPOLOGY_REPORT_SCHEMA_VERSION;
	readonly stage: CommandDispatchTopologyReportStage;
	readonly state: CommandDispatchTopologyReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type CommandDispatchTopologyReportOutcome =
	CommandDispatchTopologyReportPartialOutcome | CommandDispatchTopologyReportUnavailableOutcome;
