import type {
	ModuleDependencyGraphCoverage,
	ModuleDependencyGraphHealth,
	ModuleDependencyGraphSnapshot
} from './graph.js';
import {
	MODULE_DEPENDENCY_GRAPH_CAPABILITY,
	MODULE_DEPENDENCY_GRAPH_CAPABILITY_STATUS,
	MODULE_DEPENDENCY_GRAPH_METHOD
} from './graph.js';
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
 * Preliminary coding-agent report over one complete bounded compiler-native module-dependency
 * projection and its CAP-010 evidence pipeline. It is neither full CAP-004 dependency analysis,
 * a registered JAN-CSAA-007 operation envelope, nor DWP-004/DWP-005/DWP-006 completion evidence.
 */
export const MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-module-dependency-report-request/0.1.0' as const;
export const MODULE_DEPENDENCY_REPORT_SCHEMA_VERSION =
	'jan-csaa-module-dependency-report/0.1.0' as const;
export const MODULE_DEPENDENCY_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-module-dependency-report-result/0.1.0' as const;
export const MODULE_DEPENDENCY_REPORT_OPERATION_VERSION =
	'jan-csaa-report-module-dependency/0.1.0' as const;
export const MODULE_DEPENDENCY_REPORT_AUTHORITY = 'NONE' as const;
export const MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER = 'NONE' as const;
export const MODULE_DEPENDENCY_REPORT_GATE_EFFECT = 'NONE' as const;
export const MODULE_DEPENDENCY_REPORT_FULL_JAN_CSAA_CAPABILITY_004 = 'NOT_CLAIMED' as const;

export const MODULE_DEPENDENCY_REPORT_SELECTION = Object.freeze({
	edgePopulation: 'EXACTLY_ONE_TYPED_EDGE_PER_SELECTED_SEMANTIC_MODULE_RESOLUTION_RECORD',
	frontierTreatment:
		'EVERY_NON_RESOLVED_SOURCE_MODULE_RESOLUTION_HAS_ONE_EXPLICIT_LIMITATION; A_GRAPH_NATIVE_TARGET_EXISTS_ONLY_WHEN_NO_CAPTURED_TARGET_SOURCE_ID_EXISTS',
	method: MODULE_DEPENDENCY_GRAPH_METHOD,
	nodePopulation:
		'ONE_SOURCE_NODE_PER_SELECTED_SEMANTIC_SOURCE_PLUS_ONE_GRAPH_NATIVE_TARGET_NODE_PER_MODULE_RESOLUTION_WITHOUT_A_CAPTURED_TARGET_SOURCE',
	projectContextEvidence:
		'ALL_VALIDATED_PROJECTS_PROGRAMS_SOURCES_MEMBERSHIPS_AND_PROJECT_REFERENCES',
	providerCorroboration: 'DEPENDENCY_CRUISER_NOT_RUN',
	semanticCapabilities: Object.freeze(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const),
	resolutionStates: Object.freeze([
		'RESOLVED_SOURCE',
		'RESOLVED_AMBIENT',
		'RESOLVED_EXTERNAL',
		'UNRESOLVED',
		'UNSUPPORTED'
	] as const)
} as const);

export interface ModuleDependencyReportGraphBudgets {
	readonly maxEdges: number;
	readonly maxLimitations: number;
	readonly maxNodes: number;
}

export interface ModuleDependencyReportBudgets extends Omit<
	ProjectContextReportBudgets,
	'maxResultBytes'
> {
	/** Maximum admitted partial-result bytes, including the command terminal LF. */
	readonly maxResultBytes: number;
	readonly moduleDependency: ModuleDependencyReportGraphBudgets;
}

/** Absolute admission ceilings, never caller defaults, performance targets, or SLOs. */
export const MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS = Object.freeze({
	...PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
	moduleDependency: Object.freeze({
		maxEdges: 50_000,
		maxLimitations: 50_002,
		maxNodes: 75_000
	})
} satisfies ModuleDependencyReportBudgets);

export const MODULE_DEPENDENCY_REPORT_PREDECESSOR_NONCLAIMS = Object.freeze({
	projectContextReport: PROJECT_CONTEXT_REPORT_NONCLAIMS
} as const);

/** The embedded graph's limitations remain inherited; this facade only narrows claims. */
export const MODULE_DEPENDENCY_REPORT_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_004_DEPENDENCY_ANALYSIS',
	'JAN_CSAA_CAP_005_CALL_GRAPH',
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
	'DEPENDENCY_CRUISER_EXECUTION_OR_CORROBORATION',
	'PACKAGE_MANIFEST_DECLARED_DEPENDENCIES',
	'LOCKFILE_OR_INSTALLED_COMPONENT_INSTANCE_DEPENDENCIES',
	'INFERRED_OR_OBSERVED_RUNTIME_DEPENDENCIES',
	'DYNAMIC_COMPUTED_MODULE_LOAD_OR_FRAMEWORK_ENTRY_CLOSURE',
	'CROSS_PROGRAM_MODULE_IDENTITY_OR_GRAPH_COMPOSITION',
	'WHOLE_REPOSITORY_OR_WHOLE_PROGRAM_DEPENDENCY_CLOSURE',
	'EMBEDDED_CLOSED_GRAPH_AS_FULL_CAPABILITY_OR_WHOLE_PROGRAM_CLOSURE',
	'PERSISTED_OR_DESERIALIZED_CAPTURE_REPLAY',
	'PERSISTENT_FRESHNESS_OR_CROSS_REVISION_CURRENTNESS',
	'WORKING_CHANGE_MERGE_BASE_TARGET_REVISION_OR_CANDIDATE_MERGE_BINDING',
	'REACHABILITY_STRONG_CONNECTIVITY_TRANSITIVE_CLOSURE_OR_PATH_QUERY',
	'ZERO_EDGE_OR_ZERO_INCOMING_EDGE_AS_UNUSED_DEAD_ORPHAN_IRRELEVANT_NON_IMPACT_OR_SAFE_REMOVAL',
	'RECOGNIZED_ARCHITECTURE_ARCHITECTURE_DISCOVERY_OR_ARCHITECTURE_VIOLATION',
	'BEHAVIORAL_PRESERVATION_OR_TEST_SELECTION_PROOF',
	'RULE_FINDING_SEVERITY_GATE_DESIGN_MERGE_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface ModuleDependencyReportRequest {
	readonly budgets: ModuleDependencyReportBudgets;
	readonly operationVersion: typeof MODULE_DEPENDENCY_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type ModuleDependencyReportStage =
	'REQUEST' | 'PREDECESSOR_PIPELINE' | 'MODULE_DEPENDENCY' | 'CURRENTNESS' | 'RESULT';

export interface ModuleDependencyReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly predecessorSource: Exclude<
		ProjectContextReportDiagnostic['source'],
		'CURRENTNESS'
	> | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'PREDECESSOR_PIPELINE' | 'MODULE_DEPENDENCY' | 'CURRENTNESS';
}

export interface ModuleDependencyReportStageOutcomes {
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly moduleDependency: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete' | 'partial';
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

export interface ModuleDependencyReportResult {
	readonly capability: {
		readonly architectureDiscovery: 'NOT_CLAIMED';
		readonly changeImpact: 'NOT_CLAIMED';
		readonly codeSlice: 'NOT_CLAIMED';
		readonly fullJanCsaaCapability004DependencyAnalysis: typeof MODULE_DEPENDENCY_REPORT_FULL_JAN_CSAA_CAPABILITY_004;
		readonly id: typeof MODULE_DEPENDENCY_GRAPH_CAPABILITY;
		readonly semanticComparison: 'NOT_CLAIMED';
		readonly semanticQuery: 'NOT_CLAIMED';
		readonly status: typeof MODULE_DEPENDENCY_GRAPH_CAPABILITY_STATUS;
	};
	readonly coverage: ModuleDependencyGraphCoverage & {
		readonly edges: number;
		readonly health: ModuleDependencyGraphHealth;
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
		readonly encoding: 'FULL_VALIDATED_PROJECT_CONTEXT_AND_COMPILER_MODULE_DEPENDENCY_GRAPH';
		readonly moduleDependencyGraph: ModuleDependencyGraphSnapshot;
		readonly projectContextGraph: ProjectContextGraphSnapshot;
	};
	readonly facadeNonclaims: typeof MODULE_DEPENDENCY_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_COMPILER_MODULE_DEPENDENCY_GRAPH';
	readonly predecessorNonclaims: typeof MODULE_DEPENDENCY_REPORT_PREDECESSOR_NONCLAIMS;
	readonly schemaVersion: typeof MODULE_DEPENDENCY_REPORT_RESULT_SCHEMA_VERSION;
	readonly selection: typeof MODULE_DEPENDENCY_REPORT_SELECTION;
	readonly semanticSnapshotSummary: {
		readonly id: SemanticSnapshotId;
		readonly moduleResolutions: number;
		readonly programs: number;
		readonly projects: number;
		readonly sources: number;
	};
}

export interface ModuleDependencyReportPartialOutcome {
	readonly analysisAuthority: typeof MODULE_DEPENDENCY_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly ModuleDependencyReportDiagnostic[];
	readonly gateEffect: typeof MODULE_DEPENDENCY_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof MODULE_DEPENDENCY_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: ModuleDependencyReportRequest;
	readonly result: ModuleDependencyReportResult;
	readonly schemaVersion: typeof MODULE_DEPENDENCY_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: ModuleDependencyReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type ModuleDependencyReportFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface ModuleDependencyReportUnavailableOutcome {
	readonly analysisAuthority: typeof MODULE_DEPENDENCY_REPORT_AUTHORITY;
	readonly authorityTransfer: typeof MODULE_DEPENDENCY_REPORT_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly ModuleDependencyReportDiagnostic[];
	readonly facadeNonclaims: typeof MODULE_DEPENDENCY_REPORT_NONCLAIMS;
	readonly gateEffect: typeof MODULE_DEPENDENCY_REPORT_GATE_EFFECT;
	readonly operationVersion: typeof MODULE_DEPENDENCY_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly predecessorNonclaims: typeof MODULE_DEPENDENCY_REPORT_PREDECESSOR_NONCLAIMS;
	readonly request?: ModuleDependencyReportRequest;
	readonly schemaVersion: typeof MODULE_DEPENDENCY_REPORT_SCHEMA_VERSION;
	readonly stage: ModuleDependencyReportStage;
	readonly state: ModuleDependencyReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type ModuleDependencyReportOutcome =
	ModuleDependencyReportPartialOutcome | ModuleDependencyReportUnavailableOutcome;
