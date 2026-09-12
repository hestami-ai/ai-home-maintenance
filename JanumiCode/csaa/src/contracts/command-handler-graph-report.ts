import type {
	ArrowCommandCensusArtifactSetBudgets,
	ArrowCommandCensusBudgets,
	ArrowCommandCensusObservation
} from './arrow-command-census.js';
import { ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS } from './arrow-command-census-report.js';
import {
	COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS,
	COMMAND_HANDLER_GRAPH_COMMAND_DISPATCH_CENSUS_INTEGRATION,
	COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
	COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_007_CONFORMANCE,
	COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_008_CONFORMANCE,
	COMMAND_HANDLER_GRAPH_GRAPH_AUTHORITY,
	COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY,
	COMMAND_HANDLER_GRAPH_METHOD,
	COMMAND_HANDLER_GRAPH_REGISTRY_STATUS,
	COMMAND_HANDLER_GRAPH_RETAINED_ARROW_VERIFIER_AUTHORITY,
	COMMAND_HANDLER_GRAPH_RUNTIME_DISPATCH_CLOSURE,
	COMMAND_HANDLER_GRAPH_RUNTIME_PERFORMABILITY,
	COMMAND_HANDLER_GRAPH_SCOPE,
	type CommandHandlerGraphBudgets,
	type CommandHandlerGraphCoverage,
	type CommandHandlerGraphSnapshot
} from './command-handler-graph.js';
import {
	PROJECT_CONTEXT_REPORT_NONCLAIMS,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	type ProjectContextReportBudgets,
	type ProjectContextReportDiagnostic
} from './project-context-report.js';
import type { SemanticSnapshotId } from './semantic.js';
import type { SubjectCompleteness, SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent facade over one same-subject semantic, retained-arrow, and
 * command-handler projection pipeline. It is not a registered JAN-CSAA-007 operation or DWP
 * completion evidence.
 */
export const COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-command-handler-graph-report-request/0.1.0' as const;
export const COMMAND_HANDLER_GRAPH_REPORT_SCHEMA_VERSION =
	'jan-csaa-command-handler-graph-report/0.1.0' as const;
export const COMMAND_HANDLER_GRAPH_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-command-handler-graph-report-result/0.1.0' as const;
export const COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION =
	'jan-csaa-report-command-handler-graph/0.1.0' as const;
export const COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY = 'NONE' as const;
export const COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT = 'NONE' as const;
export const COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION =
	'RUN_RETAINED_VERIFIER_WITH_SUBJECT_MODULE_INITIALIZERS_IN_PROCESS_ISOLATION_NOT_SECURITY_SANDBOX' as const;
export const COMMAND_HANDLER_GRAPH_REPORT_CAPABILITY_ID =
	'command-handler-static-projection' as const;
export const COMMAND_HANDLER_GRAPH_REPORT_SCOPE =
	'EXACT_SELECTED_FROZEN_SUBJECT_SEMANTIC_RETAINED_ARROW_AND_COMMAND_HANDLER_GRAPH' as const;
export const COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS = Object.freeze([
	'packages/rph-application/tsconfig.json',
	'packages/rph-assurance/tsconfig.json',
	'packages/rph-contracts/tsconfig.json',
	'packages/rph-domain/tsconfig.json',
	'packages/rph-persistence/tsconfig.json',
	'packages/rph-ports/tsconfig.json',
	'packages/rph-projections/tsconfig.json'
] as const);

export const COMMAND_HANDLER_GRAPH_REPORT_SELECTION = Object.freeze({
	arrowEvidencePopulation:
		'ALL_VALIDATED_RETAINED_DECLARED_ARROW_SITES_AND_OCCURRENCES_FROM_THE_SAME_FROZEN_SUBJECT',
	commandRegistry: 'EXACT_JPWB_COMMANDS_EXPORT_DERIVED_FROM_THE_SEMANTIC_SNAPSHOT',
	execution: COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION,
	graphMethod: COMMAND_HANDLER_GRAPH_METHOD,
	handlerRegistry: 'EXACT_JPWB_HANDLERS_EXPORT_DERIVED_FROM_THE_SEMANTIC_SNAPSHOT',
	semanticCapabilities: Object.freeze(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const),
	semanticEvidence: 'FULL_VALIDATED_SAME_SUBJECT_STATIC_SEMANTIC_SNAPSHOT_SUMMARY',
	subjectPopulation:
		'EXPLICIT_PROJECT_CLOSURE_PLUS_FIXED_RETAINED_ARROW_ARTIFACTS_CAPTURED_IN_ONE_FROZEN_SUBJECT'
} as const);

export interface CommandHandlerGraphReportBudgets extends Omit<
	ProjectContextReportBudgets,
	'maxResultBytes' | 'projectContext'
> {
	readonly artifactSet: ArrowCommandCensusArtifactSetBudgets;
	readonly commandHandlerGraph: CommandHandlerGraphBudgets;
	/** Maximum admitted partial-result bytes, including the command terminal LF. */
	readonly maxResultBytes: number;
	readonly observation: ArrowCommandCensusBudgets;
}

/** Absolute admission ceilings, never caller defaults, performance targets, or SLOs. */
export const COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS = Object.freeze({
	artifactSet: Object.freeze({
		maxArtifacts: 1_000,
		maxDiagnostics: 100,
		maxTotalBytes: 64 * 1024 * 1024
	}),
	commandHandlerGraph: Object.freeze({
		maxAstNodes: 5_000_000,
		maxCommandRegistryEntries: 100_000,
		maxEdges: 2_000_000,
		maxFrontiers: 1_000_000,
		maxHandlerRegistryEntries: 100_000,
		maxNodes: 2_000_000,
		maxSourceBytes: 128 * 1024 * 1024
	}),
	maxResultBytes: PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.maxResultBytes,
	observation: Object.freeze({
		maxArtifacts: 1_000,
		maxBirthStates: 10_000,
		maxDeclaredArrowOccurrences: 10_000,
		maxDeclaredSites: 10_000,
		maxDiagnostics: 100,
		maxExecutorDurationMs: 120_000,
		maxExternalModuleBytes: 64 * 1024 * 1024,
		maxExternalModuleFiles: 5_000,
		maxMachines: 1_000,
		maxMapStates: 100_000,
		maxMaterializedBytes: 64 * 1024 * 1024,
		maxOutputStringCharacters: 10_000_000,
		maxRawArrayEntries: 100_000,
		maxRawJsonDepth: 20,
		maxStderrBytes: 1024 * 1024,
		maxStdoutBytes: 64 * 1024 * 1024
	}),
	semantic: PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.semantic,
	subject: PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS.subject
} satisfies CommandHandlerGraphReportBudgets);

export const COMMAND_HANDLER_GRAPH_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	semanticCapture: PROJECT_CONTEXT_REPORT_NONCLAIMS,
	retainedArrowCommandCensusReport: ARROW_COMMAND_CENSUS_REPORT_NONCLAIMS
} as const);

/** Embedded predecessor and graph limitations remain authoritative; this facade narrows claims. */
export const COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_027_GRAPH_DERIVATION_OR_CAP_028_GRAPH_INFERENCE',
	'RUNTIME_COMMAND_DISPATCH_CLOSURE_OR_COMMAND_PERFORMABILITY',
	'RUNTIME_HANDLER_INVOCATION_OR_HANDLER_OWNERSHIP',
	'COMMAND_DISPATCH_CENSUS_INTEGRATION',
	'EXACT_FACTORY_HANDLER_OR_ARROW_SITE_ATTRIBUTION',
	'GUARD_EFFECT_EVENT_OR_PERSISTENCE_COVERAGE',
	'BASELINE_MATCH_AS_CORRECTNESS_PROOF',
	'RETAINED_TEST_GATE_EXECUTION_OR_GATE_RESULT',
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

export interface CommandHandlerGraphReportRequest {
	readonly budgets: CommandHandlerGraphReportBudgets;
	/** Explicit acknowledgement of the retained provider's subprocess and initializer behavior. */
	readonly executionSelection: typeof COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION;
	readonly operationVersion: typeof COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic subject closure; fixed retained artifacts are implementation-owned. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type CommandHandlerGraphReportStage =
	| 'REQUEST'
	| 'PREDECESSOR_PIPELINE'
	| 'ARTIFACT_SET'
	| 'RETAINED_CENSUS'
	| 'COMMAND_HANDLER_GRAPH'
	| 'CURRENTNESS'
	| 'RESULT';

export interface CommandHandlerGraphReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly predecessorSource: Exclude<
		ProjectContextReportDiagnostic['source'],
		'CURRENTNESS'
	> | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source:
		| 'REPORT'
		| 'PREDECESSOR_PIPELINE'
		| 'ARTIFACT_SET'
		| 'RETAINED_CENSUS'
		| 'COMMAND_HANDLER_GRAPH'
		| 'CURRENTNESS';
}

export interface CommandHandlerGraphReportStageOutcomes {
	readonly artifactSet: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete';
	};
	readonly commandHandlerGraph: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly predecessorPipeline: {
		readonly semanticSnapshot: {
			readonly diagnosticCodes: readonly string[];
			readonly outcome: 'complete' | 'partial';
		};
		readonly subject: {
			readonly completeness: SubjectCompleteness;
			readonly diagnosticCodes: readonly string[];
			readonly outcome: 'resolved';
		};
	};
	readonly retainedCensus: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete' | 'partial';
	};
}

export interface CommandHandlerGraphReportResult {
	readonly capability: {
		readonly commandDispatchCensusIntegration: typeof COMMAND_HANDLER_GRAPH_COMMAND_DISPATCH_CENSUS_INTEGRATION;
		readonly derivationCapability: typeof COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY;
		readonly facadeScope: typeof COMMAND_HANDLER_GRAPH_REPORT_SCOPE;
		readonly fullJanCsaa007Conformance: typeof COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_007_CONFORMANCE;
		readonly fullJanCsaa008Conformance: typeof COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_008_CONFORMANCE;
		readonly graphAuthority: typeof COMMAND_HANDLER_GRAPH_GRAPH_AUTHORITY;
		readonly id: typeof COMMAND_HANDLER_GRAPH_REPORT_CAPABILITY_ID;
		readonly inferenceCapability: typeof COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY;
		readonly registryStatus: typeof COMMAND_HANDLER_GRAPH_REGISTRY_STATUS;
		readonly retainedArrowVerifierAuthority: typeof COMMAND_HANDLER_GRAPH_RETAINED_ARROW_VERIFIER_AUTHORITY;
		readonly runtimeDispatchClosure: typeof COMMAND_HANDLER_GRAPH_RUNTIME_DISPATCH_CLOSURE;
		readonly runtimePerformability: typeof COMMAND_HANDLER_GRAPH_RUNTIME_PERFORMABILITY;
		readonly scope: typeof COMMAND_HANDLER_GRAPH_SCOPE;
		readonly status: typeof COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS;
	};
	readonly coverage: CommandHandlerGraphCoverage & {
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
		readonly encoding: 'FULL_VALIDATED_RETAINED_ARROW_OBSERVATION_AND_COMMAND_HANDLER_GRAPH';
		readonly observation: ArrowCommandCensusObservation;
		readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
	};
	readonly facadeNonclaims: typeof COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_SAME_SUBJECT_STATIC_COMMAND_HANDLER_PROJECTION';
	readonly predecessorNonclaims: typeof COMMAND_HANDLER_GRAPH_REPORT_PREDECESSOR_NONCLAIMS;
	readonly schemaVersion: typeof COMMAND_HANDLER_GRAPH_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof COMMAND_HANDLER_GRAPH_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly astNodes: number;
		readonly id: SemanticSnapshotId;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
}

export interface CommandHandlerGraphReportPartialOutcome {
	readonly analysisAuthority: typeof COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly CommandHandlerGraphReportDiagnostic[];
	readonly gateEffect: typeof COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: CommandHandlerGraphReportRequest;
	readonly result: CommandHandlerGraphReportResult;
	readonly schemaVersion: typeof COMMAND_HANDLER_GRAPH_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: CommandHandlerGraphReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type CommandHandlerGraphReportFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface CommandHandlerGraphReportUnavailableOutcome {
	readonly analysisAuthority: typeof COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof COMMAND_HANDLER_GRAPH_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly CommandHandlerGraphReportDiagnostic[];
	readonly facadeNonclaims: typeof COMMAND_HANDLER_GRAPH_REPORT_NONCLAIMS;
	readonly gateEffect: typeof COMMAND_HANDLER_GRAPH_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof COMMAND_HANDLER_GRAPH_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: CommandHandlerGraphReportRequest;
	readonly schemaVersion: typeof COMMAND_HANDLER_GRAPH_REPORT_SCHEMA_VERSION;
	readonly stage: CommandHandlerGraphReportStage;
	readonly state: CommandHandlerGraphReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type CommandHandlerGraphReportOutcome =
	CommandHandlerGraphReportPartialOutcome | CommandHandlerGraphReportUnavailableOutcome;
