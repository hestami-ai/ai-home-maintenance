import {
	STATE_MACHINE_GRAPH_CAPABILITY,
	STATE_MACHINE_GRAPH_CAPABILITY_STATUS,
	STATE_MACHINE_GRAPH_METHOD,
	STATE_MACHINE_GRAPH_REGISTRY_STATUS,
	STATE_MACHINE_GRAPH_SCOPE,
	STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD,
	type StateMachineGraphBudgets,
	type StateMachineGraphCoverage,
	type StateMachineGraphSnapshot,
	type StateMachineTopologyObservation,
	type StateMachineTopologyObservationBudgets
} from './state-machine-graph.js';
import {
	PROJECT_CONTEXT_REPORT_NONCLAIMS,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	type ProjectContextReportBudgets,
	type ProjectContextReportDiagnostic
} from './project-context-report.js';
import type { ProjectContextGraphSnapshot } from './project-context-graph.js';
import type { SemanticSnapshotId } from './semantic.js';
import type { SubjectCompleteness, SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent report over one exact generated JPWB transition-table source. It is
 * neither full CAP-027, a registered JAN-CSAA-007 operation envelope, nor DWP-004/005/006
 * completion evidence.
 */
export const STATE_MACHINE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-state-machine-graph-report-request/0.1.0' as const;
export const STATE_MACHINE_GRAPH_REPORT_SCHEMA_VERSION =
	'jan-csaa-state-machine-graph-report/0.1.0' as const;
export const STATE_MACHINE_GRAPH_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-state-machine-graph-report-result/0.1.0' as const;
export const STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION =
	'jan-csaa-report-state-machine-graph/0.1.0' as const;
export const STATE_MACHINE_GRAPH_REPORT_AUTHORITY = 'NONE' as const;
export const STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT = 'NONE' as const;
export const STATE_MACHINE_GRAPH_REPORT_FULL_JAN_CSAA_CAPABILITY_027 = 'NOT_CLAIMED' as const;

export const STATE_MACHINE_GRAPH_REPORT_SELECTION = Object.freeze({
	artifactPopulation:
		'ONE_EXACT_CAPTURED_GENERATED_SOURCE_ARTIFACT_SELECTED_BY_PROJECT_CONFIG_AND_LOGICAL_PATH',
	graphMethod: STATE_MACHINE_GRAPH_METHOD,
	observationMethod: STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD,
	projectContextEvidence:
		'ALL_VALIDATED_PROJECTS_PROGRAMS_SOURCES_MEMBERSHIPS_AND_PROJECT_REFERENCES',
	semanticCapabilities: Object.freeze(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const),
	topologyPopulation:
		'ALL_SUPPORTED_GENERATED_MACHINES_STATES_TRANSITIONS_AND_CROSS_AXIS_RULES_IN_THE_SELECTED_ARTIFACT'
} as const);

export interface StateMachineGraphReportSourceSelector {
	readonly logicalPath: string;
	readonly projectConfigPath: string;
}

export interface StateMachineGraphReportBudgets extends Omit<
	ProjectContextReportBudgets,
	'maxResultBytes'
> {
	/** Maximum admitted partial-result bytes, including the command terminal LF. */
	readonly maxResultBytes: number;
	readonly stateMachineGraph: StateMachineGraphBudgets;
	readonly topologyObservation: StateMachineTopologyObservationBudgets;
}

/** Absolute admission ceilings, never caller defaults, performance targets, or SLOs. */
export const STATE_MACHINE_GRAPH_REPORT_SAFETY_CEILINGS = Object.freeze({
	...PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	stateMachineGraph: Object.freeze({
		maxEdges: 250_000,
		maxNodes: 150_000
	}),
	topologyObservation: Object.freeze({
		maxAstNodes: 1_000_000,
		maxCrossAxisRules: 100_000,
		maxDiagnostics: 10_000,
		maxMachines: 10_000,
		maxSourceBytes: 8 * 1024 * 1024,
		maxStates: 100_000,
		maxTextCharacters: 16 * 1024 * 1024,
		maxTransitions: 1_000_000
	})
} satisfies StateMachineGraphReportBudgets);

export const STATE_MACHINE_GRAPH_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	projectContextReport: PROJECT_CONTEXT_REPORT_NONCLAIMS
} as const);

/** The embedded observation and graph limitations remain inherited; this facade only narrows claims. */
export const STATE_MACHINE_GRAPH_REPORT_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_027_STATE_MACHINE_ANALYSIS',
	'RUNTIME_BEHAVIOR_OR_BEHAVIORAL_REACHABILITY',
	'UPSTREAM_VOCABULARY_OR_GENERATOR_AUTHORITY',
	'COMMAND_PERFORMABILITY_COMMAND_HANDLER_OR_WRITER_EFFECT_COVERAGE',
	'GUARD_ENFORCEMENT',
	'STATE_MACHINE_GENERALIZATION_OR_INFERENCE',
	'SPECIALIZED_RETAINED_CENSUS_CONCLUSIONS',
	'WHOLE_REPOSITORY_OR_WHOLE_PROGRAM_REACHABILITY',
	'JAN_CSAA_CAP_006_CONTROL_FLOW',
	'JAN_CSAA_CAP_007_DATA_FLOW',
	'JAN_CSAA_CAP_009_GRAPH_COMPOSITION',
	'JAN_CSAA_CAP_026_ARCHITECTURE_DISCOVERY',
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'JAN_CSAA_CAP_032_SEMANTIC_COMPARISON',
	'DWP_004_DWP_005_OR_DWP_006_COMPLETION',
	'FULL_JAN_CSAA_007_008_009_010_OR_011_CONFORMANCE',
	'JAN_CSAA_007_REGISTERED_OPERATION_OR_OPERATION_RESPONSE_ENVELOPE',
	'PROVIDER_QUALIFICATION',
	'PERSISTED_OR_DESERIALIZED_CAPTURE_REPLAY',
	'PERSISTENT_FRESHNESS_OR_CROSS_REVISION_CURRENTNESS',
	'WORKING_CHANGE_MERGE_BASE_TARGET_REVISION_OR_CANDIDATE_MERGE_BINDING',
	'ZERO_EDGE_ZERO_INCOMING_EDGE_OR_UNREACHED_NODE_AS_UNUSED_DEAD_ORPHAN_IRRELEVANT_NON_IMPACT_OR_SAFE_REMOVAL',
	'RECOGNIZED_ARCHITECTURE_ARCHITECTURE_VIOLATION_OR_LAYER_CONFORMANCE',
	'BEHAVIORAL_PRESERVATION_OR_TEST_SELECTION_PROOF',
	'RULE_FINDING_SEVERITY_GATE_DESIGN_MERGE_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface StateMachineGraphReportRequest {
	readonly budgets: StateMachineGraphReportBudgets;
	readonly operationVersion: typeof STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof STATE_MACHINE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION;
	readonly source: StateMachineGraphReportSourceSelector;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type StateMachineGraphReportStage =
	| 'REQUEST'
	| 'PREDECESSOR_PIPELINE'
	| 'TOPOLOGY_OBSERVATION'
	| 'STATE_MACHINE_GRAPH'
	| 'CURRENTNESS'
	| 'RESULT';

export interface StateMachineGraphReportDiagnostic {
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
		| 'TOPOLOGY_OBSERVATION'
		| 'STATE_MACHINE_GRAPH'
		| 'CURRENTNESS';
}

export interface StateMachineGraphReportStageOutcomes {
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly predecessorPipeline: {
		readonly projectContext: {
			readonly diagnosticCodes: readonly string[];
			readonly outcome: 'partial';
		};
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
	readonly stateMachineGraph: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
	readonly topologyObservation: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete';
	};
}

export interface StateMachineGraphReportResult {
	readonly capability: {
		readonly architectureDiscovery: 'NOT_CLAIMED';
		readonly changeImpact: 'NOT_CLAIMED';
		readonly codeSlice: 'NOT_CLAIMED';
		readonly fullJanCsaaCapability027StateMachineAnalysis: typeof STATE_MACHINE_GRAPH_REPORT_FULL_JAN_CSAA_CAPABILITY_027;
		readonly id: typeof STATE_MACHINE_GRAPH_CAPABILITY;
		readonly registryStatus: typeof STATE_MACHINE_GRAPH_REGISTRY_STATUS;
		readonly semanticComparison: 'NOT_CLAIMED';
		readonly semanticQuery: 'NOT_CLAIMED';
		readonly scope: typeof STATE_MACHINE_GRAPH_SCOPE;
		readonly status: typeof STATE_MACHINE_GRAPH_CAPABILITY_STATUS;
		readonly verifierAuthority: typeof STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY;
	};
	readonly coverage: StateMachineGraphCoverage & {
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
		readonly coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN';
		readonly encoding: 'FULL_VALIDATED_PROJECT_CONTEXT_GENERATED_TOPOLOGY_OBSERVATION_AND_STATE_MACHINE_GRAPH';
		readonly projectContextGraph: ProjectContextGraphSnapshot;
		readonly stateMachineGraph: StateMachineGraphSnapshot;
		readonly topologyObservation: StateMachineTopologyObservation;
	};
	readonly facadeNonclaims: typeof STATE_MACHINE_GRAPH_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_GENERATED_RUNTIME_TOPOLOGY';
	readonly predecessorNonclaims: typeof STATE_MACHINE_GRAPH_REPORT_PREDECESSOR_NONCLAIMS;
	readonly schemaVersion: typeof STATE_MACHINE_GRAPH_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof STATE_MACHINE_GRAPH_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly astNodes: number;
		readonly id: SemanticSnapshotId;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
	readonly source: StateMachineGraphReportSourceSelector;
	readonly topologyCoverage: StateMachineTopologyObservation['coverage'];
}

export interface StateMachineGraphReportPartialOutcome {
	readonly analysisAuthority: typeof STATE_MACHINE_GRAPH_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly StateMachineGraphReportDiagnostic[];
	readonly gateEffect: typeof STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: StateMachineGraphReportRequest;
	readonly result: StateMachineGraphReportResult;
	readonly schemaVersion: typeof STATE_MACHINE_GRAPH_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: StateMachineGraphReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type StateMachineGraphReportFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface StateMachineGraphReportUnavailableOutcome {
	readonly analysisAuthority: typeof STATE_MACHINE_GRAPH_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof STATE_MACHINE_GRAPH_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly StateMachineGraphReportDiagnostic[];
	readonly facadeNonclaims: typeof STATE_MACHINE_GRAPH_REPORT_NONCLAIMS;
	readonly gateEffect: typeof STATE_MACHINE_GRAPH_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof STATE_MACHINE_GRAPH_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof STATE_MACHINE_GRAPH_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: StateMachineGraphReportRequest;
	readonly schemaVersion: typeof STATE_MACHINE_GRAPH_REPORT_SCHEMA_VERSION;
	readonly stage: StateMachineGraphReportStage;
	readonly state: StateMachineGraphReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type StateMachineGraphReportOutcome =
	StateMachineGraphReportPartialOutcome | StateMachineGraphReportUnavailableOutcome;
