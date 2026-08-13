import type {
	ModuleDependencyGraphEdgeId,
	ModuleDependencyGraphId,
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphSnapshot
} from './graph.js';
import type { SemanticSnapshotId, StaticSemanticSnapshot } from './semantic.js';

export const STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION =
	'jan-csaa-structural-scc-analysis-request/1.0.0' as const;
export const STRUCTURAL_SCC_ANALYSIS_SCHEMA_VERSION =
	'jan-csaa-structural-scc-analysis/1.0.0' as const;
export const STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION =
	'jan-csaa-analyze-structural-scc/0.1.0' as const;
export const STRUCTURAL_SCC_ANALYSIS_CANONICAL_PROFILE =
	'jan-csaa-structural-scc-canonical/1.0.0' as const;
export const STRUCTURAL_SCC_ANALYSIS_METHOD =
	'validated-directed-strong-connectivity-partition/1.0.0' as const;
export const STRUCTURAL_SCC_ANALYSIS_CAPABILITY = 'JAN-CSAA-CAP-027' as const;
export const STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS = 'PARTIAL' as const;
export const STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY = 'NONE' as const;
export const STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER = 'NONE' as const;
export const STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT = 'NONE' as const;
export const STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;

export const STRUCTURAL_SCC_ANALYSIS_SELECTION = Object.freeze({
	direction: 'DECLARED_SOURCE_TO_TARGET',
	edgePopulation: 'ALL_VALIDATED_GRAPH_EDGES',
	nodePopulation: 'ALL_VALIDATED_GRAPH_NODES',
	parallelEdges: 'PRESERVE',
	selfLoops: 'PRESERVE'
} as const);

export const STRUCTURAL_SCC_ANALYSIS_NONCLAIMS = Object.freeze([
	'JAN_CSAA_CAP_009_GRAPH_COMPOSITION',
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'WHOLE_PROGRAM_OR_BEHAVIORAL_REACHABILITY',
	'ENTRY_MECHANISM_OR_POPULATION_CLOSURE',
	'ORPHAN_OR_DEAD_CODE_CANDIDACY',
	'SAFE_REMOVAL_OR_NON_IMPACT',
	'RUNTIME_EXECUTION_OR_BEHAVIOR',
	'FINDING_GATE_DECISION_OR_REMEDIATION_AUTHORITY',
	'FULL_JAN_CSAA_007_OR_008_CONFORMANCE'
] as const);

declare const structuralSccAnalysisBrand: unique symbol;
type Branded<Kind extends string> = string & {
	readonly [structuralSccAnalysisBrand]: Kind;
};
export type StructuralSccAnalysisId = Branded<'StructuralSccAnalysis'>;
export type StructuralSccComponentId = Branded<'StructuralSccComponent'>;
export type StructuralSccLayerId = Branded<'StructuralSccLayer'>;

export interface StructuralSccAnalysisBudgets {
	readonly maxComponents: number;
	readonly maxDiagnostics: number;
	readonly maxEdges: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxNodes: number;
	readonly maxTraversalSteps: number;
}

export interface StructuralSccSourceGraphReference {
	readonly contentDigest: string;
	readonly graphId: ModuleDependencyGraphId;
	readonly graphInputDigest: string;
	readonly graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY';
}

export type StructuralSccAnalysisSelection = typeof STRUCTURAL_SCC_ANALYSIS_SELECTION;

export interface BuildStructuralSccAnalysisRequest {
	readonly budgets: StructuralSccAnalysisBudgets;
	readonly operationVersion: typeof STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION;
	readonly schemaVersion: typeof STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION;
	readonly selection: StructuralSccAnalysisSelection;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceGraph: StructuralSccSourceGraphReference;
	readonly subjectId: string;
}

/** Public construction input; `graph` names the exact predecessor consumed by the analysis. */
export interface StructuralSccAnalysisInputs {
	readonly graph: ModuleDependencyGraphSnapshot;
	readonly request: BuildStructuralSccAnalysisRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export type StructuralSccAnalysisBuildInputs = StructuralSccAnalysisInputs;

export type StructuralSccAnalysisRequest = BuildStructuralSccAnalysisRequest;

export type StructuralSccCycleKind = 'ACYCLIC_SINGLETON' | 'SELF_LOOP_SINGLETON' | 'MULTI_NODE';

export interface StructuralSccComponent {
	readonly cycleKind: StructuralSccCycleKind;
	readonly id: StructuralSccComponentId;
	readonly internalEdgeIds: readonly ModuleDependencyGraphEdgeId[];
	readonly nodeIds: readonly ModuleDependencyGraphNodeId[];
	readonly ordinal: number;
}

export interface StructuralSccComponentIndexEntry {
	readonly componentId: StructuralSccComponentId;
	readonly nodeId: ModuleDependencyGraphNodeId;
}

export interface StructuralSccAnalysisCoverage {
	readonly chargedTraversalSteps: number;
	readonly components: number;
	readonly crossComponentEdges: number;
	readonly cyclicComponents: number;
	readonly edgeAccountingReconciles: boolean;
	readonly inputEdges: number;
	readonly inputNodes: number;
	readonly internalEdges: number;
	readonly isolatedSingletons: number;
	readonly multiNodeComponents: number;
	readonly partitionReconciles: boolean;
	readonly selfLoopSingletons: number;
}

export interface StructuralSccAnalysisLayer {
	readonly analysisId: StructuralSccAnalysisId;
	readonly capability: typeof STRUCTURAL_SCC_ANALYSIS_CAPABILITY;
	readonly capabilityStatus: typeof STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS;
	readonly componentIds: readonly StructuralSccComponentId[];
	readonly id: StructuralSccLayerId;
	readonly kind: 'STRUCTURAL_STRONG_CONNECTIVITY';
	readonly ordinal: 0;
	readonly sourceGraph: StructuralSccSourceGraphReference;
}

export interface StructuralSccAnalysisSnapshot {
	readonly authorityTransfer: typeof STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER;
	readonly budgets: StructuralSccAnalysisBudgets;
	readonly canonicalProfile: typeof STRUCTURAL_SCC_ANALYSIS_CANONICAL_PROFILE;
	readonly capability: typeof STRUCTURAL_SCC_ANALYSIS_CAPABILITY;
	readonly capabilityStatus: typeof STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS;
	readonly componentIndex: readonly StructuralSccComponentIndexEntry[];
	readonly components: readonly StructuralSccComponent[];
	readonly contentDigest: string;
	readonly coverage: StructuralSccAnalysisCoverage;
	readonly fullJanCsaa007Conformance: typeof STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof STRUCTURAL_SCC_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly gateEffect: typeof STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT;
	readonly graphAuthority: typeof STRUCTURAL_SCC_ANALYSIS_GRAPH_AUTHORITY;
	readonly health: 'PARTIAL';
	readonly id: StructuralSccAnalysisId;
	readonly inputDigest: string;
	readonly layers: readonly [StructuralSccAnalysisLayer];
	readonly method: typeof STRUCTURAL_SCC_ANALYSIS_METHOD;
	readonly nonclaims: typeof STRUCTURAL_SCC_ANALYSIS_NONCLAIMS;
	readonly operationVersion: typeof STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION;
	readonly schemaVersion: typeof STRUCTURAL_SCC_ANALYSIS_SCHEMA_VERSION;
	readonly selection: StructuralSccAnalysisSelection;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceGraph: StructuralSccSourceGraphReference;
	readonly structuralClosure: 'EXACT_FOR_SELECTED_VALIDATED_GRAPH';
	readonly subjectId: string;
	readonly upstreamClosure: 'CLOSED' | 'OPEN';
}

export type StructuralSccAnalysisDiagnosticCode =
	| 'ANALYSIS_VALIDATION_FAILED'
	| 'BUDGET_EXCEEDED'
	| 'INPUT_IDENTITY_MISMATCH'
	| 'REQUEST_INVALID'
	| 'SOURCE_GRAPH_INVALID';

export interface StructuralSccAnalysisDiagnostic {
	readonly code: StructuralSccAnalysisDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'BIND' | 'REQUEST' | 'TRAVERSE' | 'VALIDATE';
}

export type StructuralSccAnalysisBuildOutcome =
	| {
			readonly analysis: StructuralSccAnalysisSnapshot;
			readonly diagnostics: readonly StructuralSccAnalysisDiagnostic[];
			readonly outcome: 'partial';
	  }
	| {
			readonly diagnostics: readonly StructuralSccAnalysisDiagnostic[];
			readonly outcome: 'unavailable';
	  };

export type StructuralSccAnalysisOutcome = StructuralSccAnalysisBuildOutcome;
export type StructuralSccDiagnostic = StructuralSccAnalysisDiagnostic;

export interface StructuralSccAnalysisValidationOptions {
	readonly maxDepth?: number;
	readonly maxInputRecords?: number;
	readonly maxInputStringCharacters?: number;
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type StructuralSccAnalysisValidationIssueCode =
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INPUT_INVALID'
	| 'POPULATION_MISMATCH'
	| 'SHAPE_INVALID';

export interface StructuralSccAnalysisValidationIssue {
	readonly code: StructuralSccAnalysisValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export type StructuralSccAnalysisValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly StructuralSccAnalysisValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

export type StructuralSccValidationIssue = StructuralSccAnalysisValidationIssue;
export type StructuralSccValidationOptions = StructuralSccAnalysisValidationOptions;
export type StructuralSccValidationResult = StructuralSccAnalysisValidationResult;
