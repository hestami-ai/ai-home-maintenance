import type {
	ModuleDependencyGraphEdgeId,
	ModuleDependencyGraphId,
	ModuleDependencyGraphLimitation,
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphSnapshot
} from './graph.js';
import type {
	SemanticModuleResolutionId,
	SemanticSnapshotId,
	StaticSemanticSnapshot
} from './semantic.js';

export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION =
	'jan-csaa-structural-module-reachability-analysis-request/1.0.0' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SCHEMA_VERSION =
	'jan-csaa-structural-module-reachability-analysis/1.0.0' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION =
	'jan-csaa-analyze-structural-module-reachability/0.1.0' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CANONICAL_PROFILE =
	'jan-csaa-structural-module-reachability-canonical/1.0.0' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_METHOD =
	'validated-module-edge-reachability/1.0.0' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY = 'JAN-CSAA-CAP-027' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY_STATUS = 'PARTIAL' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY = 'NONE' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER = 'NONE' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT = 'NONE' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE =
	'NOT_CLAIMED' as const;
export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE =
	'NOT_CLAIMED' as const;

export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION = Object.freeze({
	edgePopulation: 'ALL_VALIDATED_GRAPH_EDGES',
	nodePopulation: 'ALL_VALIDATED_GRAPH_NODES',
	parallelEdges: 'PRESERVE',
	witnessPolicy: 'CANONICAL_SHORTEST_FIRST_DISCOVERY'
} as const);

export const STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS = Object.freeze([
	'JAN_CSAA_CAP_009_GRAPH_COMPOSITION',
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'WHOLE_PROGRAM_OR_BEHAVIORAL_REACHABILITY',
	'ENTRY_MECHANISM_OR_POPULATION_CLOSURE',
	'UNREACHED_NODE_IRRELEVANCE_OR_NON_IMPACT',
	'ORPHAN_OR_DEAD_CODE_CANDIDACY',
	'SAFE_REMOVAL',
	'RUNTIME_EXECUTION_OR_BEHAVIOR',
	'FINDING_GATE_DECISION_OR_REMEDIATION_AUTHORITY',
	'FULL_JAN_CSAA_007_OR_008_CONFORMANCE'
] as const);

export const STRUCTURAL_MODULE_REACHABILITY_TERMINAL_FRONTIER_REASON =
	'REACHED_GRAPH_NATIVE_RESOLUTION_TARGET' as const;

declare const structuralModuleReachabilityBrand: unique symbol;
type Branded<Kind extends string> = string & {
	readonly [structuralModuleReachabilityBrand]: Kind;
};

export type StructuralModuleReachabilityAnalysisId =
	Branded<'StructuralModuleReachabilityAnalysis'>;
export type StructuralModuleReachabilityMemberId = Branded<'StructuralModuleReachabilityMember'>;
export type StructuralModuleReachabilityFrontierId =
	Branded<'StructuralModuleReachabilityFrontier'>;
export type StructuralModuleReachabilityLayerId = Branded<'StructuralModuleReachabilityLayer'>;

export type StructuralModuleReachabilityDirection = 'FORWARD' | 'REVERSE';

export interface StructuralModuleReachabilityAnalysisBudgets {
	readonly maxDiagnostics: number;
	readonly maxEdges: number;
	readonly maxFrontierRecords: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxNodes: number;
	readonly maxReachableNodes: number;
	readonly maxTraversalSteps: number;
	readonly maxWitnessEdges: number;
}

export interface StructuralModuleReachabilitySourceGraphReference {
	readonly contentDigest: string;
	readonly graphId: ModuleDependencyGraphId;
	readonly graphInputDigest: string;
	readonly graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY';
}

export interface StructuralModuleReachabilityCriterion {
	readonly nodeId: ModuleDependencyGraphNodeId;
}

export type StructuralModuleReachabilitySelection =
	typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION;

export interface BuildStructuralModuleReachabilityAnalysisRequest {
	readonly budgets: StructuralModuleReachabilityAnalysisBudgets;
	readonly criterion: StructuralModuleReachabilityCriterion;
	readonly direction: StructuralModuleReachabilityDirection;
	readonly operationVersion: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION;
	readonly schemaVersion: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION;
	readonly selection: StructuralModuleReachabilitySelection;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceGraph: StructuralModuleReachabilitySourceGraphReference;
	readonly subjectId: string;
}

export interface StructuralModuleReachabilityAnalysisInputs {
	readonly graph: ModuleDependencyGraphSnapshot;
	readonly request: BuildStructuralModuleReachabilityAnalysisRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export type StructuralModuleReachabilityAnalysisRequest =
	BuildStructuralModuleReachabilityAnalysisRequest;
export type StructuralModuleReachabilityAnalysisBuildInputs =
	StructuralModuleReachabilityAnalysisInputs;

export interface StructuralModuleReachabilityMember {
	readonly criterion: boolean;
	readonly distance: number;
	readonly id: StructuralModuleReachabilityMemberId;
	readonly nodeId: ModuleDependencyGraphNodeId;
	readonly nodeKind: 'RESOLUTION_TARGET' | 'SOURCE';
	readonly ordinal: number;
	readonly predecessorNodeId: ModuleDependencyGraphNodeId | null;
	readonly witnessEdgeId: ModuleDependencyGraphEdgeId | null;
}

export interface StructuralModuleReachabilityEncounteredFrontier {
	readonly id: StructuralModuleReachabilityFrontierId;
	readonly memberId: StructuralModuleReachabilityMemberId;
	readonly moduleResolutionId: SemanticModuleResolutionId;
	readonly nodeId: ModuleDependencyGraphNodeId;
	readonly ordinal: number;
	readonly reason: typeof STRUCTURAL_MODULE_REACHABILITY_TERMINAL_FRONTIER_REASON;
	readonly resolutionState: Exclude<
		ModuleDependencyGraphSnapshot['edges'][number]['resolutionState'],
		'RESOLVED_SOURCE'
	>;
	readonly witnessEdgeId: ModuleDependencyGraphEdgeId | null;
}

export interface StructuralModuleReachabilityCoverage {
	readonly chargedTraversalSteps: number;
	readonly criterionReconciles: boolean;
	readonly encounteredFrontiers: number;
	readonly examinedEdges: number;
	readonly inputEdges: number;
	readonly inputNodes: number;
	readonly maxDistance: number;
	readonly memberAccountingReconciles: boolean;
	readonly reachedNodes: number;
	readonly resolutionTargetMembers: number;
	readonly sourceMembers: number;
	readonly traversalReconciles: boolean;
	readonly unvisitedNodes: number;
	readonly witnessAccountingReconciles: boolean;
	readonly witnessEdges: number;
}

export interface StructuralModuleReachabilityTruncation {
	readonly reason: null;
	readonly state: 'NOT_TRUNCATED';
}

export interface StructuralModuleReachabilityAnalysisLayer {
	readonly analysisId: StructuralModuleReachabilityAnalysisId;
	readonly capability: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY;
	readonly capabilityStatus: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY_STATUS;
	readonly encounteredFrontierIds: readonly StructuralModuleReachabilityFrontierId[];
	readonly id: StructuralModuleReachabilityLayerId;
	readonly kind: 'STRUCTURAL_MODULE_REACHABILITY';
	readonly memberIds: readonly StructuralModuleReachabilityMemberId[];
	readonly ordinal: 0;
	readonly sourceGraph: StructuralModuleReachabilitySourceGraphReference;
}

export interface StructuralModuleReachabilityAnalysisSnapshot {
	readonly authorityTransfer: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER;
	readonly budgets: StructuralModuleReachabilityAnalysisBudgets;
	readonly canonicalProfile: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CANONICAL_PROFILE;
	readonly capability: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY;
	readonly capabilityStatus: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY_STATUS;
	readonly contentDigest: string;
	readonly coverage: StructuralModuleReachabilityCoverage;
	readonly criterion: StructuralModuleReachabilityCriterion;
	readonly direction: StructuralModuleReachabilityDirection;
	readonly encounteredFrontiers: readonly StructuralModuleReachabilityEncounteredFrontier[];
	readonly fullJanCsaa007Conformance: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly gateEffect: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT;
	readonly graphAuthority: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY;
	readonly health: 'PARTIAL';
	readonly id: StructuralModuleReachabilityAnalysisId;
	readonly inputDigest: string;
	readonly layers: readonly [StructuralModuleReachabilityAnalysisLayer];
	readonly members: readonly StructuralModuleReachabilityMember[];
	readonly method: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_METHOD;
	readonly nonclaims: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS;
	readonly operationVersion: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION;
	readonly schemaVersion: typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SCHEMA_VERSION;
	readonly selection: StructuralModuleReachabilitySelection;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceGraph: StructuralModuleReachabilitySourceGraphReference;
	readonly structuralClosure: 'EXACT_FOR_SELECTED_VALIDATED_GRAPH_AND_CRITERION';
	readonly subjectId: string;
	readonly truncation: StructuralModuleReachabilityTruncation;
	readonly upstreamClosure: 'CLOSED' | 'OPEN';
	readonly upstreamLimitations: readonly ModuleDependencyGraphLimitation[];
}

export type StructuralModuleReachabilityAnalysisDiagnosticCode =
	| 'ANALYSIS_VALIDATION_FAILED'
	| 'BUDGET_EXCEEDED'
	| 'CRITERION_INVALID'
	| 'INPUT_IDENTITY_MISMATCH'
	| 'REQUEST_INVALID'
	| 'SOURCE_GRAPH_INVALID';

export interface StructuralModuleReachabilityAnalysisDiagnostic {
	readonly code: StructuralModuleReachabilityAnalysisDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'BIND' | 'REQUEST' | 'TRAVERSE' | 'VALIDATE';
}

export type StructuralModuleReachabilityAnalysisBuildOutcome =
	| {
			readonly analysis: StructuralModuleReachabilityAnalysisSnapshot;
			readonly diagnostics: readonly StructuralModuleReachabilityAnalysisDiagnostic[];
			readonly outcome: 'partial';
	  }
	| {
			readonly diagnostics: readonly StructuralModuleReachabilityAnalysisDiagnostic[];
			readonly outcome: 'unavailable';
	  };

// S6564 REFUSED: the alias IS the exported vocabulary, not a redundant restatement of it.
// `src/index.ts` re-exports this module with `export *`, so removing the alias deletes a public
// name from @janumipwb/csaa and promotes the longer internal spelling to the API. All three
// structural contracts declare the same pair the same way; 34 use sites outside these files
// reach for the short names, so those are the interface and the long ones are the detail.
export type StructuralModuleReachabilityAnalysisOutcome =
	StructuralModuleReachabilityAnalysisBuildOutcome;
export type StructuralModuleReachabilityDiagnostic = StructuralModuleReachabilityAnalysisDiagnostic;

export interface StructuralModuleReachabilityAnalysisValidationOptions {
	readonly maxDepth?: number;
	readonly maxInputRecords?: number;
	readonly maxInputStringCharacters?: number;
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type StructuralModuleReachabilityAnalysisValidationIssueCode =
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INPUT_INVALID'
	| 'POPULATION_MISMATCH'
	| 'SHAPE_INVALID';

export interface StructuralModuleReachabilityAnalysisValidationIssue {
	readonly code: StructuralModuleReachabilityAnalysisValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export type StructuralModuleReachabilityAnalysisValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly StructuralModuleReachabilityAnalysisValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

export type StructuralModuleReachabilityValidationIssue =
	StructuralModuleReachabilityAnalysisValidationIssue;
export type StructuralModuleReachabilityValidationOptions =
	StructuralModuleReachabilityAnalysisValidationOptions;
// S6564 REFUSED: 7 external use sites take this short name. See the Outcome alias above.
// `src/index.ts` re-exports this module with `export *`, so removing the alias deletes a public
// name from @janumipwb/csaa and promotes the longer internal spelling to the API. All three
// structural contracts declare the same pair the same way; 34 use sites outside these files
// reach for the short names, so those are the interface and the long ones are the detail.
export type StructuralModuleReachabilityValidationResult =
	StructuralModuleReachabilityAnalysisValidationResult;
