import {
	PROJECT_CONTEXT_REPORT_NONCLAIMS,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	type ProjectContextReportBudgets,
	type ProjectContextReportDiagnostic
} from './project-context-report.js';
import type { ProjectContextGraphSnapshot } from './project-context-graph.js';
import {
	FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW,
	READ_WRITE_ACCESS_GRAPH_CAPABILITY,
	READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS,
	READ_WRITE_ACCESS_GRAPH_METHOD,
	type ReadWriteAccessGraphBudgets,
	type ReadWriteAccessGraphSnapshot
} from './read-write-access-graph.js';
import type { SemanticSnapshotId } from './semantic.js';
import type { SubjectCompleteness, SubjectDescriptor } from './subject.js';

/**
 * Preliminary coding-agent report over one complete bounded read/write-access projection and its
 * CAP-010 evidence pipeline. It is not JAN-CSAA-CAP-007 data flow, a registered JAN-CSAA-007
 * operation envelope, or DWP-004/DWP-005/DWP-006 completion evidence.
 */
export const READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-read-write-access-report-request/0.1.0' as const;
export const READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION =
	'jan-csaa-read-write-access-report/0.1.0' as const;
export const READ_WRITE_ACCESS_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-read-write-access-report-result/0.1.0' as const;
export const READ_WRITE_ACCESS_REPORT_OPERATION_VERSION =
	'jan-csaa-report-read-write-access/0.1.0' as const;
export const READ_WRITE_ACCESS_REPORT_AUTHORITY = 'NONE' as const;
export const READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const READ_WRITE_ACCESS_REPORT_GATE_EFFECT = 'NONE' as const;

export const READ_WRITE_ACCESS_REPORT_SELECTION = Object.freeze({
	accessPopulation:
		'ALL_SUPPORTED_PROGRAM_LOCAL_MEMBER_NAME_AND_SYMBOL_USE_VALUE_REFERENCES_AND_NORMALIZED_ASSIGNMENT_TARGETS_IN_THE_SELECTED_SEMANTIC_SNAPSHOT',
	assignmentPopulation: 'ALL_NORMALIZED_ASSIGNMENT_RECORDS',
	frontierTreatment:
		'EVERY_SELECTED_CANDIDATE_REFERENCE_AND_NORMALIZED_ASSIGNMENT_IS_REPRESENTED_OR_EXPLICITLY_ACCOUNTED_BY_COVERAGE_AND_FRONTIER_RECORDS',
	method: READ_WRITE_ACCESS_GRAPH_METHOD,
	projectContextEvidence:
		'ALL_VALIDATED_PROJECTS_PROGRAMS_SOURCES_MEMBERSHIPS_AND_PROJECT_REFERENCES',
	semanticCapabilities: Object.freeze(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const),
	selectedReferenceRoles: Object.freeze(['MEMBER_NAME', 'SYMBOL_USE'] as const),
	symbolScope: 'PROGRAM_LOCAL_COMPILER_RESOLVED_SYMBOL_SLOTS',
	typePositionTreatment: 'EXCLUDED_FROM_RUNTIME_VALUE_ACCESS_WITH_EXPLICIT_COVERAGE_ACCOUNTING'
} as const);

export interface ReadWriteAccessReportBudgets extends Omit<
	ProjectContextReportBudgets,
	'maxResultBytes'
> {
	/** Maximum admitted partial-result bytes, including the command terminal LF. */
	readonly maxResultBytes: number;
	readonly readWriteAccess: ReadWriteAccessGraphBudgets;
}

/** Absolute admission ceilings, never caller defaults, performance targets, or SLOs. */
export const READ_WRITE_ACCESS_REPORT_SAFETY_CEILINGS = Object.freeze({
	...PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	readWriteAccess: Object.freeze({
		maxAccesses: 25_000,
		maxEdges: 50_000,
		maxFrontiers: 25_000,
		maxNodes: 75_000
	})
} satisfies ReadWriteAccessReportBudgets);

export const READ_WRITE_ACCESS_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	projectContextReport: PROJECT_CONTEXT_REPORT_NONCLAIMS
} as const);

/** The graph's existing limitations remain inherited; the facade only adds restrictions. */
export const READ_WRITE_ACCESS_REPORT_NONCLAIMS = Object.freeze([
	'JAN_CSAA_CAP_006_CONTROL_FLOW',
	'JAN_CSAA_CAP_007_DATA_FLOW',
	'JAN_CSAA_CAP_008_TAINT_ANALYSIS',
	'JAN_CSAA_CAP_009_GRAPH_COMPOSITION',
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
	'CROSS_PROGRAM_SYMBOL_OR_BINDING_RECONCILIATION',
	'ALIAS_HEAP_POINTS_TO_MEMORY_STORAGE_OR_RUNTIME_INSTANCE_IDENTITY',
	'REACHING_DEFINITION_LAST_WRITER_VALUE_FLOW_OR_MUTATION_CAUSALITY',
	'CONTROL_FLOW_PATH_ORDERING_FEASIBILITY_DOMINANCE_EXCEPTIONAL_ASYNC_OR_INTERPROCEDURAL_FLOW',
	'RUNTIME_READ_WRITE_SIDE_EFFECT_OR_EXTERNAL_STATE_OBSERVATION',
	'IMPLICIT_BINDING_FOR_IN_FOR_OF_DELETE_DYNAMIC_ELEMENT_OR_OTHER_UNMODELED_WRITE_COMPLETENESS',
	'TYPE_POSITION_REFERENCE_AS_RUNTIME_VALUE_ACCESS',
	'READ_WRITE_ACCESS_BEYOND_THE_SELECTED_CAPTURED_SEMANTIC_SNAPSHOT',
	'ZERO_RECORDED_ACCESS_AS_UNUSED_UNREAD_UNWRITTEN_DEAD_IRRELEVANT_NON_IMPACT_OR_SAFE_REMOVAL',
	'RECOGNIZED_ARCHITECTURE_ARCHITECTURE_DISCOVERY_OR_ARCHITECTURE_VIOLATION',
	'WHOLE_PROGRAM_BEHAVIORAL_FRAMEWORK_DYNAMIC_ENTRY_OR_RUNTIME_CLOSURE',
	'BEHAVIORAL_PRESERVATION_OR_TEST_SELECTION_PROOF',
	'RULE_FINDING_SEVERITY_GATE_DESIGN_MERGE_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface ReadWriteAccessReportRequest {
	readonly budgets: ReadWriteAccessReportBudgets;
	readonly operationVersion: typeof READ_WRITE_ACCESS_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type ReadWriteAccessReportStage =
	'REQUEST' | 'PREDECESSOR_PIPELINE' | 'READ_WRITE_ACCESS' | 'CURRENTNESS' | 'RESULT';

export interface ReadWriteAccessReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly predecessorSource: Exclude<
		ProjectContextReportDiagnostic['source'],
		'CURRENTNESS'
	> | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'PREDECESSOR_PIPELINE' | 'READ_WRITE_ACCESS' | 'CURRENTNESS';
}

export interface ReadWriteAccessReportStageOutcomes {
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
	readonly readWriteAccess: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'partial';
	};
}

export interface ReadWriteAccessReportResult {
	readonly capability: {
		readonly architectureDiscovery: 'NOT_CLAIMED';
		readonly changeImpact: 'NOT_CLAIMED';
		readonly codeSlice: 'NOT_CLAIMED';
		readonly fullJanCsaaCapability007DataFlow: typeof FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW;
		readonly id: typeof READ_WRITE_ACCESS_GRAPH_CAPABILITY;
		readonly semanticComparison: 'NOT_CLAIMED';
		readonly semanticQuery: 'NOT_CLAIMED';
		readonly status: typeof READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS;
	};
	readonly coverage: {
		readonly accessOccurrences: number;
		readonly closure: 'OPEN';
		readonly edges: number;
		readonly frontierNodes: number;
		readonly readAccesses: number;
		readonly readWriteAccesses: number;
		readonly reconciles: boolean;
		readonly symbolSlots: number;
		readonly writeAccesses: number;
	};
	readonly currentness: {
		readonly changedPaths: readonly string[];
		readonly diagnosticCodes: readonly string[];
		readonly scope: 'SELECTED_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly evidence: {
		readonly coordinateSystem: 'UTF16_CODE_UNIT_ZERO_BASED_HALF_OPEN';
		readonly encoding: 'FULL_VALIDATED_PROJECT_CONTEXT_AND_PROGRAM_LOCAL_READ_WRITE_ACCESS_GRAPH';
		readonly projectContextGraph: ProjectContextGraphSnapshot;
		readonly readWriteAccessGraph: ReadWriteAccessGraphSnapshot;
	};
	readonly facadeNonclaims: typeof READ_WRITE_ACCESS_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_PROGRAM_LOCAL_READ_WRITE_ACCESS_GRAPH';
	readonly predecessorNonclaims: typeof READ_WRITE_ACCESS_REPORT_PREDECESSOR_NONCLAIMS;
	readonly schemaVersion: typeof READ_WRITE_ACCESS_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof READ_WRITE_ACCESS_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly id: SemanticSnapshotId;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
}

export interface ReadWriteAccessReportPartialOutcome {
	readonly analysisAuthority: typeof READ_WRITE_ACCESS_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly ReadWriteAccessReportDiagnostic[];
	readonly gateEffect: typeof READ_WRITE_ACCESS_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof READ_WRITE_ACCESS_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: ReadWriteAccessReportRequest;
	readonly result: ReadWriteAccessReportResult;
	readonly schemaVersion: typeof READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: ReadWriteAccessReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type ReadWriteAccessReportFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface ReadWriteAccessReportUnavailableOutcome {
	readonly analysisAuthority: typeof READ_WRITE_ACCESS_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof READ_WRITE_ACCESS_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly ReadWriteAccessReportDiagnostic[];
	readonly facadeNonclaims: typeof READ_WRITE_ACCESS_REPORT_NONCLAIMS;
	readonly gateEffect: typeof READ_WRITE_ACCESS_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof READ_WRITE_ACCESS_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof READ_WRITE_ACCESS_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: ReadWriteAccessReportRequest;
	readonly schemaVersion: typeof READ_WRITE_ACCESS_REPORT_SCHEMA_VERSION;
	readonly stage: ReadWriteAccessReportStage;
	readonly state: ReadWriteAccessReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type ReadWriteAccessReportOutcome =
	ReadWriteAccessReportPartialOutcome | ReadWriteAccessReportUnavailableOutcome;
