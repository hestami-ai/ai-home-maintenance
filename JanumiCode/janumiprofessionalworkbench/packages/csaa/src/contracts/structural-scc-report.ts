import type {
	ModuleDependencyGraphCoverage,
	ModuleDependencyGraphEdge,
	ModuleDependencyGraphEpistemicState,
	ModuleDependencyGraphHealth,
	ModuleDependencyGraphId,
	ModuleDependencyGraphLimitation,
	ModuleDependencyGraphNode
} from './graph.js';
import type {
	SemanticBudgets,
	SemanticProgramId,
	SemanticProjectId,
	SemanticSnapshotId,
	SemanticSourceId
} from './semantic.js';
import type {
	StructuralSccAnalysisBudgets,
	StructuralSccAnalysisSnapshot
} from './structural-scc-analysis.js';
import type { SubjectBudgets, SubjectCompleteness, SubjectDescriptor } from './subject.js';

/**
 * Preliminary CAP-027 report surface for the already implemented structural SCC partition. This is
 * neither a registered JAN-CSAA-007 operation envelope nor DWP-005/DWP-006 completion evidence.
 */
export const STRUCTURAL_SCC_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-structural-scc-report-request/0.1.0' as const;
export const STRUCTURAL_SCC_REPORT_SCHEMA_VERSION = 'jan-csaa-structural-scc-report/0.1.0' as const;
export const STRUCTURAL_SCC_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-structural-scc-report-result/0.1.0' as const;
export const STRUCTURAL_SCC_REPORT_OPERATION_VERSION =
	'jan-csaa-report-structural-scc/0.1.0' as const;

export interface StructuralSccReportBudgets {
	/** Maximum admitted partial-result bytes, including the command's terminal LF. */
	readonly maxResultBytes: number;
	readonly scc: StructuralSccAnalysisBudgets;
	readonly semantic: SemanticBudgets;
	readonly subject: SubjectBudgets;
}

/** Absolute request ceilings, never implicit caller defaults or performance objectives. */
export const STRUCTURAL_SCC_REPORT_SAFETY_CEILINGS = Object.freeze({
	maxResultBytes: 64 * 1024 * 1024,
	scc: Object.freeze({
		maxComponents: 1_000_000,
		maxDiagnostics: 100_000,
		maxEdges: 1_000_000,
		maxInputRecords: 10_000_000,
		maxInputStringCharacters: 1_000_000_000,
		maxNodes: 1_000_000,
		maxTraversalSteps: 2_000_000
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
} satisfies StructuralSccReportBudgets);

export const STRUCTURAL_SCC_REPORT_NONCLAIMS = Object.freeze([
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
	'WORKING_CHANGE_MERGE_BASE_TARGET_REVISION_OR_CANDIDATE_MERGE_BINDING',
	'CROSS_SNAPSHOT_DELTA_EQUIVALENCE_OR_SEMANTIC_COMPARISON',
	'WHOLE_PROGRAM_BEHAVIORAL_FRAMEWORK_DYNAMIC_ENTRY_OR_RUNTIME_CLOSURE',
	'SELECTED_GRAPH_SCC_PARTITION_OR_ABSENCE_OF_CYCLIC_COMPONENTS_AS_WHOLE_PROGRAM_ACYCLICITY_OR_NON_INTERACTION',
	'RECOGNIZED_ARCHITECTURE_OR_ARCHITECTURE_VIOLATION',
	'CYCLIC_COMPONENT_AS_DEFECT_SEVERITY_OR_REMEDIATION_PRIORITY',
	'ORPHAN_DEAD_CODE_IRRELEVANCE_NON_IMPACT_OR_SAFE_REMOVAL',
	'BEHAVIORAL_PRESERVATION_OR_TEST_SELECTION_PROOF',
	'RULE_FINDING_SEVERITY_GATE_DESIGN_MERGE_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface StructuralSccReportRequest {
	readonly budgets: StructuralSccReportBudgets;
	readonly operationVersion: typeof STRUCTURAL_SCC_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof STRUCTURAL_SCC_REPORT_REQUEST_SCHEMA_VERSION;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type StructuralSccReportStage =
	| 'REQUEST'
	| 'SUBJECT'
	| 'SEMANTIC_SNAPSHOT'
	| 'MODULE_GRAPH'
	| 'ANALYSIS'
	| 'CURRENTNESS'
	| 'RESULT';

export interface StructuralSccReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly phase: string | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source:
		'REPORT' | 'SUBJECT' | 'SEMANTIC_SNAPSHOT' | 'MODULE_GRAPH' | 'ANALYSIS' | 'CURRENTNESS';
}

export interface StructuralSccReportProjectIdentity {
	readonly configPath: string;
	readonly id: SemanticProjectId;
	readonly programId: SemanticProgramId;
}

export interface StructuralSccReportSourceIdentity {
	readonly analysisDisposition: 'DEEP_INDEXED' | 'CONTEXT_ONLY';
	readonly id: SemanticSourceId;
	readonly logicalPath: string;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
}

export interface StructuralSccReportStageOutcomes {
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

export interface StructuralSccReportResult {
	readonly analysis: StructuralSccAnalysisSnapshot;
	readonly capability: {
		readonly architectureDiscovery: 'NOT_CLAIMED';
		readonly changeImpact: 'NOT_CLAIMED';
		readonly codeSlice: 'NOT_CLAIMED';
		readonly id: 'JAN-CSAA-CAP-027';
		readonly semanticQuery: 'NOT_CLAIMED';
		readonly status: 'PARTIAL';
	};
	readonly currentness: {
		readonly changedPaths: readonly string[];
		readonly diagnosticCodes: readonly string[];
		readonly scope: 'SELECTED_CAPTURED_SUBJECT_ONLY';
		readonly state: 'CURRENT_FOR_CAPTURED_SUBJECT' | 'STALE' | 'UNAVAILABLE';
	};
	readonly evidence: {
		readonly componentEvidenceEncoding: 'ALL_SELECTED_VALIDATED_GRAPH_COMPONENT_MEMBERS_WITH_INTERNAL_EDGE_EVIDENCE';
		readonly coordinateSystem: 'UTF16_CODE_UNIT_OFFSET';
		readonly internalEdges: readonly ModuleDependencyGraphEdge[];
		readonly nodes: readonly ModuleDependencyGraphNode[];
		readonly projects: readonly StructuralSccReportProjectIdentity[];
		readonly sources: readonly StructuralSccReportSourceIdentity[];
	};
	readonly facadeNonclaims: typeof STRUCTURAL_SCC_REPORT_NONCLAIMS;
	readonly interpretation: 'SELECTED_VALIDATED_MODULE_DEPENDENCY_GRAPH_STRONGLY_CONNECTED_COMPONENTS';
	readonly schemaVersion: typeof STRUCTURAL_SCC_REPORT_RESULT_SCHEMA_VERSION;
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

export interface StructuralSccReportPartialOutcome {
	readonly diagnostics: readonly StructuralSccReportDiagnostic[];
	readonly operationVersion: typeof STRUCTURAL_SCC_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: StructuralSccReportRequest;
	readonly result: StructuralSccReportResult;
	readonly schemaVersion: typeof STRUCTURAL_SCC_REPORT_SCHEMA_VERSION;
	readonly stageOutcomes: StructuralSccReportStageOutcomes;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type StructuralSccReportFailureState = 'failed' | 'incompatible' | 'resource-refused';

export interface StructuralSccReportUnavailableOutcome {
	readonly code: string;
	readonly diagnostics: readonly StructuralSccReportDiagnostic[];
	readonly facadeNonclaims: typeof STRUCTURAL_SCC_REPORT_NONCLAIMS;
	readonly operationVersion: typeof STRUCTURAL_SCC_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly request?: StructuralSccReportRequest;
	readonly schemaVersion: typeof STRUCTURAL_SCC_REPORT_SCHEMA_VERSION;
	readonly stage: StructuralSccReportStage;
	readonly state: StructuralSccReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type StructuralSccReportOutcome =
	StructuralSccReportPartialOutcome | StructuralSccReportUnavailableOutcome;
