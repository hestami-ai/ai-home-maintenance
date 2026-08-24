import type {
	ModuleDependencyGraphCoverage,
	ModuleDependencyGraphEdge,
	ModuleDependencyGraphEpistemicState,
	ModuleDependencyGraphHealth,
	ModuleDependencyGraphId,
	ModuleDependencyGraphLimitation,
	ModuleDependencyGraphNode,
	ModuleDependencyGraphNodeId
} from './graph.js';
import type {
	SemanticBudgets,
	SemanticProgramId,
	SemanticProjectId,
	SemanticSnapshotId,
	SemanticSourceId
} from './semantic.js';
import type {
	StructuralModuleReachabilityAnalysisBudgets,
	StructuralModuleReachabilityAnalysisSnapshot,
	StructuralModuleReachabilityDirection
} from './structural-module-reachability-analysis.js';
import type {
	CapturedArtifactRecord,
	SubjectBudgets,
	SubjectCompleteness,
	SubjectDescriptor
} from './subject.js';

/**
 * This preliminary wire surface exposes only the already implemented CAP-027 analysis. It is not
 * the stable JAN-CSAA-007 query envelope or completion evidence for DWP-005/DWP-006.
 */
export const STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-structural-module-reachability-report-request/0.2.0' as const;
export const STRUCTURAL_MODULE_REACHABILITY_REPORT_SCHEMA_VERSION =
	'jan-csaa-structural-module-reachability-report/0.2.0' as const;
export const STRUCTURAL_MODULE_REACHABILITY_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-structural-module-reachability-report-result/0.2.0' as const;
export const STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION =
	'jan-csaa-report-structural-module-reachability/0.2.0' as const;

export interface StructuralModuleReachabilityReportBudgets {
	/** Maximum admitted partial-result bytes, including the command's terminal LF; small refusals remain emit-able. */
	readonly maxResultBytes: number;
	readonly reachability: StructuralModuleReachabilityAnalysisBudgets;
	readonly semantic: SemanticBudgets;
	readonly subject: SubjectBudgets;
}

/**
 * Absolute request ceilings, not performance objectives or implicit caller defaults. Callers must
 * still provide every budget and may only lower these bounds.
 */
export const STRUCTURAL_MODULE_REACHABILITY_REPORT_SAFETY_CEILINGS = Object.freeze({
	maxResultBytes: 64 * 1024 * 1024,
	reachability: Object.freeze({
		maxDiagnostics: 100_000,
		maxEdges: 1_000_000,
		maxFrontierRecords: 1_000_000,
		maxInputRecords: 10_000_000,
		maxInputStringCharacters: 1_000_000_000,
		maxNodes: 1_000_000,
		maxReachableNodes: 1_000_000,
		maxTraversalSteps: 2_000_000,
		maxWitnessEdges: 1_000_000
	}),
	semantic: Object.freeze({
		maxAstDepth: 2_048,
		maxAstNodes: 5_000_000,
		maxCompilerInputMetadataBytes: 536_870_912,
		maxCompilerQueries: 5_000_000,
		maxCompilerFacts: 5_000_000,
		maxCompilerQueryInvocations: 50_000_000,
		maxContextBytes: 536_870_912,
		maxContextFileBytes: 67_108_864,
		maxContextFiles: 100_000,
		maxDiagnosticCharacters: 50_000_000,
		maxDiagnostics: 500_000,
		maxDirectoryEntries: 5_000_000,
		maxDurationMs: 3_600_000,
		maxLiteralCharacters: 10_000,
		maxPathCharacters: 4_096,
		maxProjects: 200,
		maxScopes: 1_000_000,
		maxSnapshotBytes: 1_000_000_000,
		maxSources: 100_000
	}),
	subject: Object.freeze({
		maxBytes: 1_000_000_000,
		maxConfigDepth: 64,
		maxDiagnostics: 100_000,
		maxDurationMs: 180_000,
		maxFiles: 100_000,
		maxProjects: 200
	})
} satisfies StructuralModuleReachabilityReportBudgets);

export const STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS = Object.freeze([
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'DWP_005_OR_DWP_006_COMPLETION',
	'FULL_JAN_CSAA_007_008_009_010_OR_011_CONFORMANCE',
	'PROVIDER_QUALIFICATION',
	'WORKING_CHANGE_OR_REVISION_BINDING',
	'WHOLE_PROGRAM_BEHAVIORAL_RUNTIME_FRAMEWORK_OR_ENTRY_POPULATION_CLOSURE',
	'UNVISITED_NODE_IRRELEVANCE_OR_NON_IMPACT',
	'DEAD_CODE_SAFE_REMOVAL_BEHAVIORAL_PRESERVATION_OR_TEST_SELECTION_PROOF',
	'FINDING_GATE_REMEDIATION_MERGE_OR_DESIGN_AUTHORITY'
] as const);

export interface StructuralModuleReachabilityReportRequest {
	readonly budgets: StructuralModuleReachabilityReportBudgets;
	readonly criterionLogicalPath: string;
	readonly direction: StructuralModuleReachabilityDirection;
	readonly operationVersion: typeof STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION;
	/** The one project identity used to disambiguate the criterion source. */
	readonly projectConfigPath: string;
	readonly schemaVersion: typeof STRUCTURAL_MODULE_REACHABILITY_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type StructuralModuleReachabilityReportStage =
	| 'REQUEST'
	| 'SUBJECT'
	| 'SEMANTIC_SNAPSHOT'
	| 'MODULE_GRAPH'
	| 'CRITERION'
	| 'ANALYSIS'
	| 'CURRENTNESS'
	| 'RESULT';

export interface StructuralModuleReachabilityReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source:
		'REPORT' | 'SUBJECT' | 'SEMANTIC_SNAPSHOT' | 'MODULE_GRAPH' | 'ANALYSIS' | 'CURRENTNESS';
}

export interface StructuralModuleReachabilityProjectIdentity {
	readonly configPath: string;
	readonly id: SemanticProjectId;
	readonly programId: SemanticProgramId;
}

export interface StructuralModuleReachabilitySourceIdentity {
	readonly analysisDisposition: 'DEEP_INDEXED' | 'CONTEXT_ONLY';
	readonly id: SemanticSourceId;
	readonly logicalPath: string;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
}

export interface StructuralModuleReachabilityReportStageOutcomes {
	readonly analysis: { readonly diagnosticCodes: readonly string[]; readonly outcome: 'partial' };
	readonly currentness: {
		readonly diagnosticCodes: readonly string[];
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly moduleGraph: {
		readonly diagnosticCodes: readonly string[];
		readonly outcome: 'complete' | 'partial';
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
}

export interface StructuralModuleReachabilityReportResult {
	readonly analysis: StructuralModuleReachabilityAnalysisSnapshot;
	readonly capability: {
		readonly changeImpact: 'NOT_CLAIMED';
		readonly codeSlice: 'NOT_CLAIMED';
		readonly id: 'JAN-CSAA-CAP-027';
		readonly semanticQuery: 'NOT_CLAIMED';
		readonly status: 'PARTIAL';
	};
	readonly criterionSelector: {
		/** Exact captured artifact bound before semantic extraction and rechecked by final currentness. */
		readonly artifact: CapturedArtifactRecord;
		readonly logicalPath: string;
		readonly projectConfigPath: string;
		readonly selectedNodeId: ModuleDependencyGraphNodeId;
	};
	readonly currentness: {
		readonly changedPaths: readonly string[];
		readonly diagnosticCodes: readonly string[];
		readonly scope: 'SELECTED_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly evidence: {
		readonly coordinateSystem: 'UTF16_CODE_UNIT_OFFSET';
		readonly nodes: readonly ModuleDependencyGraphNode[];
		readonly projects: readonly StructuralModuleReachabilityProjectIdentity[];
		readonly sources: readonly StructuralModuleReachabilitySourceIdentity[];
		readonly witnessEdges: readonly ModuleDependencyGraphEdge[];
		readonly witnessEncoding: 'PREDECESSOR_FOREST';
	};
	readonly facadeNonclaims: typeof STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS;
	readonly interpretation: 'STRUCTURAL_DEPENDENCY_CANDIDATES' | 'STRUCTURAL_IMPORTER_CANDIDATES';
	readonly schemaVersion: typeof STRUCTURAL_MODULE_REACHABILITY_REPORT_RESULT_SCHEMA_VERSION;
	readonly sourceGraphSummary: {
		readonly contentDigest: string;
		readonly coverage: ModuleDependencyGraphCoverage;
		readonly epistemic: ModuleDependencyGraphEpistemicState;
		readonly graphInputDigest: string;
		readonly health: ModuleDependencyGraphHealth;
		readonly id: ModuleDependencyGraphId;
		readonly limitations: readonly ModuleDependencyGraphLimitation[];
		readonly semanticSnapshotId: SemanticSnapshotId;
	};
}

export interface StructuralModuleReachabilityReportPartialOutcome {
	readonly diagnostics: readonly StructuralModuleReachabilityReportDiagnostic[];
	readonly operationVersion: typeof STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: StructuralModuleReachabilityReportRequest;
	readonly result: StructuralModuleReachabilityReportResult;
	readonly schemaVersion: typeof STRUCTURAL_MODULE_REACHABILITY_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: StructuralModuleReachabilityReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type StructuralModuleReachabilityReportFailureState =
	'failed' | 'incompatible' | 'resource-refused';

export interface StructuralModuleReachabilityReportUnavailableOutcome {
	readonly code: string;
	readonly diagnostics: readonly StructuralModuleReachabilityReportDiagnostic[];
	readonly facadeNonclaims: typeof STRUCTURAL_MODULE_REACHABILITY_REPORT_NONCLAIMS;
	readonly operationVersion: typeof STRUCTURAL_MODULE_REACHABILITY_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly request?: StructuralModuleReachabilityReportRequest;
	readonly schemaVersion: typeof STRUCTURAL_MODULE_REACHABILITY_REPORT_SCHEMA_VERSION;
	readonly stage: StructuralModuleReachabilityReportStage;
	readonly state: StructuralModuleReachabilityReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type StructuralModuleReachabilityReportOutcome =
	| StructuralModuleReachabilityReportPartialOutcome
	| StructuralModuleReachabilityReportUnavailableOutcome;
