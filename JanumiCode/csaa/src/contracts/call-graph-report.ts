import {
	CALL_GRAPH_CAPABILITY,
	CALL_GRAPH_CAPABILITY_STATUS,
	CALL_GRAPH_METHOD,
	type CallGraphCoverage,
	type CallGraphHealth,
	type CallGraphSnapshot
} from './call-graph.js';
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
 * Preliminary coding-agent report over one complete bounded static call projection and its
 * CAP-010 evidence pipeline. It is neither full CAP-005, a registered JAN-CSAA-007 operation
 * envelope, nor DWP-004/DWP-005/DWP-006 completion evidence.
 */
export const CALL_GRAPH_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-call-graph-report-request/0.1.0' as const;
export const CALL_GRAPH_REPORT_SCHEMA_VERSION = 'jan-csaa-call-graph-report/0.1.0' as const;
export const CALL_GRAPH_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-call-graph-report-result/0.1.0' as const;
export const CALL_GRAPH_REPORT_OPERATION_VERSION = 'jan-csaa-report-call-graph/0.1.0' as const;
export const CALL_GRAPH_REPORT_AUTHORITY = 'NONE' as const;
export const CALL_GRAPH_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const CALL_GRAPH_REPORT_GATE_EFFECT = 'NONE' as const;
export const CALL_GRAPH_REPORT_FULL_JAN_CSAA_CAPABILITY_005 = 'NOT_CLAIMED' as const;

export const CALL_GRAPH_REPORT_SELECTION = Object.freeze({
	entryMechanisms: 'ALL_TWELVE_CLASSES_NOT_ANALYZED',
	frontierTreatment:
		'EVERY_NON_CANDIDATE_SELECTED_INVOCATION_HAS_ONE_EXPLICIT_EXTERNAL_DISPATCH_UNRESOLVED_OR_UNSUPPORTED_FRONTIER',
	invocationPopulation:
		'ALL_RETAINED_CALL_NEW_AND_TAGGED_TEMPLATE_INVOCATION_RECORDS_IN_THE_SELECTED_SEMANTIC_SNAPSHOT',
	method: CALL_GRAPH_METHOD,
	ownership:
		'NEAREST_RETAINED_LEXICAL_CALLABLE_OR_SOURCE_REGION_STRUCTURAL_OWNER; RUNTIME_CALLER_AND_EVALUATION_OWNER_NOT_CLAIMED',
	projectContextEvidence:
		'ALL_VALIDATED_PROJECTS_PROGRAMS_SOURCES_MEMBERSHIPS_AND_PROJECT_REFERENCES',
	semanticCapabilities: Object.freeze(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE'] as const),
	targetPopulation:
		'ALL_OPEN_COMPILER_BOUND_LOCAL_CALLABLE_CANDIDATES_OR_ONE_EXPLICIT_FRONTIER_PER_SELECTED_INVOCATION; NO_EXACT_OR_EXCLUSIVE_TARGET_CLAIM'
} as const);

export interface CallGraphReportGraphBudgets {
	/** Deterministic record-inspection ceiling for invocation classification hot paths. */
	readonly maxClassificationSteps: number;
	readonly maxEdges: number;
	readonly maxLimitations: number;
	readonly maxNodes: number;
}

export interface CallGraphReportBudgets extends Omit<
	ProjectContextReportBudgets,
	'maxResultBytes'
> {
	/** Maximum admitted partial-result bytes, including the command terminal LF. */
	readonly maxResultBytes: number;
	readonly callGraph: CallGraphReportGraphBudgets;
}

/** Absolute admission ceilings, never caller defaults, performance targets, or SLOs. */
export const CALL_GRAPH_REPORT_SAFETY_CEILINGS = Object.freeze({
	...PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	callGraph: Object.freeze({
		maxClassificationSteps: 100_000_000,
		maxEdges: 50_000,
		maxLimitations: 50_004,
		maxNodes: 75_000
	})
} satisfies CallGraphReportBudgets);

export const CALL_GRAPH_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	projectContextReport: PROJECT_CONTEXT_REPORT_NONCLAIMS
} as const);

/** The embedded graph's limitations remain inherited; this facade only narrows claims. */
export const CALL_GRAPH_REPORT_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_005_CALL_GRAPH',
	'EXACT_OR_EXCLUSIVE_CALL_TARGETS',
	'EXHAUSTIVE_CALLER_SETS',
	'INVOCATION_SPECIFIC_RESOLVED_SIGNATURES',
	'DISPATCH_CLOSURE_OVERRIDE_CLOSURE_OR_POINTS_TO_CLOSURE',
	'RUNTIME_CALLER_EVALUATION_OWNER_OR_EXECUTION_OBSERVATION',
	'PACKAGE_FRAMEWORK_TEST_DYNAMIC_DEPENDENCY_INJECTION_EVENT_DECORATOR_REFLECTION_CONFIG_GENERATED_EXTERNAL_OR_RUNTIME_ENTRY_CLOSURE',
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

export interface CallGraphReportRequest {
	readonly budgets: CallGraphReportBudgets;
	readonly operationVersion: typeof CALL_GRAPH_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof CALL_GRAPH_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type CallGraphReportStage =
	'REQUEST' | 'PREDECESSOR_PIPELINE' | 'CALL_GRAPH' | 'CURRENTNESS' | 'RESULT';

export interface CallGraphReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly predecessorSource: Exclude<
		ProjectContextReportDiagnostic['source'],
		'CURRENTNESS'
	> | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'PREDECESSOR_PIPELINE' | 'CALL_GRAPH' | 'CURRENTNESS';
}

export interface CallGraphReportStageOutcomes {
	readonly callGraph: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
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
}

export interface CallGraphReportResult {
	readonly capability: {
		readonly architectureDiscovery: 'NOT_CLAIMED';
		readonly changeImpact: 'NOT_CLAIMED';
		readonly codeSlice: 'NOT_CLAIMED';
		readonly fullJanCsaaCapability005CallGraph: typeof CALL_GRAPH_REPORT_FULL_JAN_CSAA_CAPABILITY_005;
		readonly id: typeof CALL_GRAPH_CAPABILITY;
		readonly semanticComparison: 'NOT_CLAIMED';
		readonly semanticQuery: 'NOT_CLAIMED';
		readonly status: typeof CALL_GRAPH_CAPABILITY_STATUS;
	};
	readonly coverage: CallGraphCoverage & {
		readonly edges: number;
		readonly health: CallGraphHealth;
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
		readonly callGraph: CallGraphSnapshot;
		readonly coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN';
		readonly encoding: 'FULL_VALIDATED_PROJECT_CONTEXT_AND_STATIC_CALL_GRAPH';
		readonly projectContextGraph: ProjectContextGraphSnapshot;
	};
	readonly facadeNonclaims: typeof CALL_GRAPH_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_OPEN_STATIC_CALL_GRAPH';
	readonly predecessorNonclaims: typeof CALL_GRAPH_REPORT_PREDECESSOR_NONCLAIMS;
	readonly schemaVersion: typeof CALL_GRAPH_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof CALL_GRAPH_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly astNodes: number;
		readonly id: SemanticSnapshotId;
		readonly invocations: number;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
		readonly types: number;
	};
}

export interface CallGraphReportPartialOutcome {
	readonly analysisAuthority: typeof CALL_GRAPH_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof CALL_GRAPH_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly CallGraphReportDiagnostic[];
	readonly gateEffect: typeof CALL_GRAPH_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof CALL_GRAPH_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: CallGraphReportRequest;
	readonly result: CallGraphReportResult;
	readonly schemaVersion: typeof CALL_GRAPH_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: CallGraphReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type CallGraphReportFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface CallGraphReportUnavailableOutcome {
	readonly analysisAuthority: typeof CALL_GRAPH_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof CALL_GRAPH_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly CallGraphReportDiagnostic[];
	readonly facadeNonclaims: typeof CALL_GRAPH_REPORT_NONCLAIMS;
	readonly gateEffect: typeof CALL_GRAPH_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof CALL_GRAPH_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof CALL_GRAPH_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: CallGraphReportRequest;
	readonly schemaVersion: typeof CALL_GRAPH_REPORT_SCHEMA_VERSION;
	readonly stage: CallGraphReportStage;
	readonly state: CallGraphReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type CallGraphReportOutcome =
	CallGraphReportPartialOutcome | CallGraphReportUnavailableOutcome;
