import type {
	CallGraphCoverage,
	CallGraphEpistemicState,
	CallGraphHealth,
	CallGraphId,
	CallGraphLayerId,
	CallGraphLimitation,
	CallGraphNodeId,
	CallGraphSnapshot
} from './call-graph.js';
import type {
	ModuleDependencyGraphCoverage,
	ModuleDependencyGraphEpistemicState,
	ModuleDependencyGraphHealth,
	ModuleDependencyGraphId,
	ModuleDependencyGraphLayerId,
	ModuleDependencyGraphLimitation,
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphSnapshot
} from './graph.js';
import type {
	SemanticProgramId,
	SemanticProjectId,
	SemanticSnapshotId,
	SemanticSourceId,
	StaticSemanticSnapshot
} from './semantic.js';

export const LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION =
	'jan-csaa-logical-graph-composition-request/1.0.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_SCHEMA_VERSION =
	'jan-csaa-logical-graph-composition/1.0.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-logical-graph-composition-progress/1.0.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION =
	'jan-csaa-compose-logical-graph/0.1.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_CANONICAL_PROFILE =
	'jan-csaa-logical-graph-composition-canonical/1.0.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_METHOD =
	'exact-two-layer-semantic-source-reference-composition/1.0.0' as const;
export const LOGICAL_GRAPH_COMPOSITION_CAPABILITY = 'JAN-CSAA-CAP-009' as const;
export const LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS = 'PARTIAL' as const;
export const LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY = 'NONE' as const;
export const LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER = 'NONE' as const;
export const LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT = 'NONE' as const;
export const LOGICAL_GRAPH_COMPOSITION_FRESHNESS = 'NOT_ASSESSED' as const;
export const LOGICAL_GRAPH_COMPOSITION_CURRENTNESS = 'NOT_CLAIMED' as const;
export const LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE = 'NOT_CLAIMED' as const;
export const LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;

export const LOGICAL_GRAPH_COMPOSITION_SELECTION = Object.freeze({
	callNodePopulation: 'ALL_VALIDATED_CALL_SOURCE_REGION_NODES',
	compositionMode: 'REFERENCE_ONLY',
	conflictTreatment: 'INCOMPATIBLE_INPUT_REFUSED',
	consistencyFields: Object.freeze([
		'PROGRAM_ID',
		'PROJECT_ID',
		'LOGICAL_PATH',
		'ANALYSIS_DISPOSITION'
	] as const),
	crossLinkRelation: 'SAME_SEMANTIC_SOURCE_OCCURRENCE',
	joinKey: 'EXACT_SEMANTIC_SOURCE_ID',
	layerOrder: Object.freeze(['MODULE_DEPENDENCY', 'CALL'] as const),
	moduleNodePopulation: 'ALL_VALIDATED_MODULE_SOURCE_NODES'
} as const);

export const LOGICAL_GRAPH_COMPOSITION_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_009_GRAPH_COMPOSITION',
	'UNIVERSAL_OR_MATERIALIZED_CODE_PROPERTY_GRAPH',
	'LAYERS_BEYOND_MODULE_DEPENDENCY_AND_CALL',
	'CROSS_LAYER_TRAVERSAL_OR_UNIFIED_AUTHORITATIVE_EDGE_SET',
	'SEMANTIC_EQUIVALENCE_BEYOND_EXACT_SOURCE_OCCURRENCE',
	'IMPORT_CAUSES_CALL_OR_CALL_BELONGS_TO_DEPENDENCY',
	'JAN_CSAA_CAP_026_ARCHITECTURE_DISCOVERY',
	'JAN_CSAA_CAP_029_SEMANTIC_QUERY',
	'JAN_CSAA_CAP_030_CODE_SLICE',
	'JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'JAN_CSAA_CAP_032_SEMANTIC_COMPARISON',
	'EXACT_CALL_DISPATCH',
	'ENTRY_MECHANISM_OR_POPULATION_CLOSURE',
	'WHOLE_PROGRAM_OR_BEHAVIORAL_REACHABILITY',
	'CURRENTNESS_OR_FRESHNESS',
	'ORPHAN_OR_DEAD_CODE_CANDIDACY',
	'UNMATCHED_NODE_IRRELEVANCE_OR_NON_IMPACT',
	'SAFE_REMOVAL',
	'RUNTIME_EXECUTION_OR_BEHAVIOR',
	'FINDING_GATE_DECISION_OR_REMEDIATION_AUTHORITY',
	'FULL_JAN_CSAA_007_OR_008_CONFORMANCE'
] as const);

declare const logicalGraphCompositionBrand: unique symbol;
type Branded<Kind extends string> = string & {
	readonly [logicalGraphCompositionBrand]: Kind;
};

export type LogicalGraphCompositionId = Branded<'LogicalGraphComposition'>;
export type LogicalGraphCompositionLayerId = Branded<'LogicalGraphCompositionLayer'>;
export type LogicalGraphCompositionCrossLinkId = Branded<'LogicalGraphCompositionCrossLink'>;

export interface LogicalGraphCompositionBudgets {
	readonly maxCallEdges: number;
	readonly maxCallNodes: number;
	readonly maxConflictRecords: 0;
	readonly maxDiagnostics: number;
	readonly maxEligibleSourceNodes: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxLinks: number;
	readonly maxModuleDependencyEdges: number;
	readonly maxModuleDependencyNodes: number;
	readonly maxOutputRecords: number;
	readonly maxTraversalSteps: number;
	readonly maxUnmatchedRecords: 0;
}

export interface LogicalGraphCompositionModuleDependencyLayerReference {
	readonly canonicalProfile: ModuleDependencyGraphSnapshot['canonicalProfile'];
	readonly contentDigest: string;
	readonly graphId: ModuleDependencyGraphId;
	readonly graphInputDigest: string;
	readonly graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY';
	readonly layerId: ModuleDependencyGraphLayerId;
	readonly method: ModuleDependencyGraphSnapshot['method'];
	readonly operationVersion: ModuleDependencyGraphSnapshot['operationVersion'];
	readonly ordinal: 0;
	readonly producer: ModuleDependencyGraphSnapshot['producer'];
	readonly role: 'MODULE_DEPENDENCY';
	readonly schemaVersion: ModuleDependencyGraphSnapshot['schemaVersion'];
	readonly semanticExtractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly semanticSchemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export interface LogicalGraphCompositionCallLayerReference {
	readonly canonicalProfile: CallGraphSnapshot['canonicalProfile'];
	readonly contentDigest: string;
	readonly graphId: CallGraphId;
	readonly graphInputDigest: string;
	readonly graphKind: 'TYPESCRIPT_CALL';
	readonly layerId: CallGraphLayerId;
	readonly method: CallGraphSnapshot['method'];
	readonly operationVersion: CallGraphSnapshot['operationVersion'];
	readonly ordinal: 1;
	readonly producer: CallGraphSnapshot['producer'];
	readonly role: 'CALL';
	readonly schemaVersion: CallGraphSnapshot['schemaVersion'];
	readonly semanticExtractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly semanticSchemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type LogicalGraphCompositionSourceLayerReference =
	LogicalGraphCompositionModuleDependencyLayerReference | LogicalGraphCompositionCallLayerReference;

export type LogicalGraphCompositionSourceLayers = readonly [
	LogicalGraphCompositionModuleDependencyLayerReference,
	LogicalGraphCompositionCallLayerReference
];

export type LogicalGraphCompositionSelection = typeof LOGICAL_GRAPH_COMPOSITION_SELECTION;

export interface BuildLogicalGraphCompositionRequest {
	readonly budgets: LogicalGraphCompositionBudgets;
	readonly operationVersion: typeof LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION;
	readonly schemaVersion: typeof LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION;
	readonly selection: LogicalGraphCompositionSelection;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceLayers: LogicalGraphCompositionSourceLayers;
	readonly subjectId: string;
}

/** Public construction input; both graphs are immutable required predecessors in the fixed layer order. */
export interface LogicalGraphCompositionInputs {
	readonly callGraph: CallGraphSnapshot;
	readonly moduleDependencyGraph: ModuleDependencyGraphSnapshot;
	readonly request: BuildLogicalGraphCompositionRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export type LogicalGraphCompositionRequest = BuildLogicalGraphCompositionRequest;
export type LogicalGraphCompositionBuildInputs = LogicalGraphCompositionInputs;

export interface LogicalGraphCompositionSourceIdentity {
	readonly analysisDisposition: 'CONTEXT_ONLY' | 'DEEP_INDEXED';
	readonly logicalPath: string;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
}

export interface LogicalGraphCompositionModuleDependencySourceEndpoint {
	readonly graphId: ModuleDependencyGraphId;
	readonly kind: 'SOURCE';
	readonly layerId: ModuleDependencyGraphLayerId;
	readonly nodeId: ModuleDependencyGraphNodeId;
}

export interface LogicalGraphCompositionCallSourceEndpoint {
	readonly graphId: CallGraphId;
	readonly kind: 'SOURCE_REGION';
	readonly layerId: CallGraphLayerId;
	readonly nodeId: CallGraphNodeId;
}

export interface LogicalGraphCompositionCrossLink {
	readonly basis: 'EXACT_SEMANTIC_SOURCE_ID_WITH_COORDINATE_CONSISTENCY';
	readonly callSourceRegion: LogicalGraphCompositionCallSourceEndpoint;
	readonly id: LogicalGraphCompositionCrossLinkId;
	readonly moduleDependencySource: LogicalGraphCompositionModuleDependencySourceEndpoint;
	readonly ordinal: number;
	readonly relationKind: 'SAME_SEMANTIC_SOURCE_OCCURRENCE';
	readonly sourceIdentity: LogicalGraphCompositionSourceIdentity;
}

export interface LogicalGraphCompositionModuleDependencyLayerBinding {
	readonly compositionId: LogicalGraphCompositionId;
	readonly id: LogicalGraphCompositionLayerId;
	readonly ordinal: 0;
	readonly role: 'MODULE_DEPENDENCY';
	readonly sourceClosure: ModuleDependencyGraphCoverage['closure'];
	readonly sourceCoverage: ModuleDependencyGraphCoverage;
	readonly sourceEdgeIds: readonly ModuleDependencyGraphSnapshot['edges'][number]['id'][];
	readonly sourceEpistemic: ModuleDependencyGraphEpistemicState;
	readonly sourceGraph: LogicalGraphCompositionModuleDependencyLayerReference;
	readonly sourceHealth: ModuleDependencyGraphHealth;
	readonly sourceLimitations: readonly ModuleDependencyGraphLimitation[];
	readonly sourceNodeIds: readonly ModuleDependencyGraphNodeId[];
}

export interface LogicalGraphCompositionCallLayerBinding {
	readonly compositionId: LogicalGraphCompositionId;
	readonly id: LogicalGraphCompositionLayerId;
	readonly ordinal: 1;
	readonly role: 'CALL';
	readonly sourceClosure: CallGraphCoverage['closure'];
	readonly sourceCoverage: CallGraphCoverage;
	readonly sourceEdgeIds: readonly CallGraphSnapshot['edges'][number]['id'][];
	readonly sourceEpistemic: CallGraphEpistemicState;
	readonly sourceGraph: LogicalGraphCompositionCallLayerReference;
	readonly sourceHealth: CallGraphHealth;
	readonly sourceLimitations: readonly CallGraphLimitation[];
	readonly sourceNodeIds: readonly CallGraphNodeId[];
}

export type LogicalGraphCompositionLayerBinding =
	LogicalGraphCompositionModuleDependencyLayerBinding | LogicalGraphCompositionCallLayerBinding;

export type LogicalGraphCompositionLayerBindings = readonly [
	LogicalGraphCompositionModuleDependencyLayerBinding,
	LogicalGraphCompositionCallLayerBinding
];

export type LogicalGraphCompositionInheritedLimitation =
	| {
			readonly layerOrdinal: 0;
			readonly layerRole: 'MODULE_DEPENDENCY';
			readonly limitation: ModuleDependencyGraphLimitation;
			readonly limitationOrdinal: number;
			readonly sourceGraphId: ModuleDependencyGraphId;
	  }
	| {
			readonly layerOrdinal: 1;
			readonly layerRole: 'CALL';
			readonly limitation: CallGraphLimitation;
			readonly limitationOrdinal: number;
			readonly sourceGraphId: CallGraphId;
	  };

export interface LogicalGraphCompositionCoverage {
	readonly callEligibleSourceRegions: number;
	readonly callInputEdges: number;
	readonly callInputNodes: number;
	readonly callPopulationReconciles: true;
	readonly chargedInputTraversalSteps: number;
	readonly conflictingSemanticSources: 0;
	readonly crossLinks: number;
	readonly exactSemanticSourceIdCandidates: number;
	readonly linkedSemanticSources: number;
	readonly linkPopulationReconciles: true;
	readonly moduleEligibleSourceNodes: number;
	readonly moduleInputEdges: number;
	readonly moduleInputNodes: number;
	readonly modulePopulationReconciles: true;
	readonly sourceIdentityPopulationReconciles: true;
	readonly unmatchedCallSources: 0;
	readonly unmatchedModuleSources: 0;
}

export interface LogicalGraphCompositionTruncation {
	readonly reason: null;
	readonly state: 'NOT_TRUNCATED';
}

export interface LogicalGraphCompositionSnapshot {
	readonly authorityTransfer: typeof LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER;
	readonly budgets: LogicalGraphCompositionBudgets;
	readonly canonicalProfile: typeof LOGICAL_GRAPH_COMPOSITION_CANONICAL_PROFILE;
	readonly capability: typeof LOGICAL_GRAPH_COMPOSITION_CAPABILITY;
	readonly capabilityStatus: typeof LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS;
	readonly closure: 'CLOSED_WITHIN_SELECTED_CONTRIBUTING_LAYER_METHODS' | 'OPEN';
	readonly compositionClosure: 'EXACT_FOR_SELECTED_VALIDATED_LAYERS_AND_MAPPING_RULE';
	/** Independently valid same-snapshot predecessors cannot expose a conflict population. */
	readonly conflicts: readonly [];
	readonly contentDigest: string;
	readonly coverage: LogicalGraphCompositionCoverage;
	readonly crossLinks: readonly LogicalGraphCompositionCrossLink[];
	readonly currentness: typeof LOGICAL_GRAPH_COMPOSITION_CURRENTNESS;
	readonly freshness: typeof LOGICAL_GRAPH_COMPOSITION_FRESHNESS;
	readonly fullJanCsaa007Conformance: typeof LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly fullJanCsaa009Conformance: typeof LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE;
	readonly gateEffect: typeof LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT;
	readonly graphAuthority: typeof LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY;
	readonly health: 'PARTIAL';
	readonly id: LogicalGraphCompositionId;
	readonly inheritedLimitations: readonly LogicalGraphCompositionInheritedLimitation[];
	readonly inputDigest: string;
	readonly layers: LogicalGraphCompositionLayerBindings;
	readonly method: typeof LOGICAL_GRAPH_COMPOSITION_METHOD;
	readonly nonclaims: typeof LOGICAL_GRAPH_COMPOSITION_NONCLAIMS;
	readonly operationVersion: typeof LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION;
	readonly resultCompleteness: 'COMPLETE_FOR_DECLARED_TWO_LAYER_REFERENCE_COMPOSITION';
	readonly schemaVersion: typeof LOGICAL_GRAPH_COMPOSITION_SCHEMA_VERSION;
	readonly selection: LogicalGraphCompositionSelection;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceLayers: LogicalGraphCompositionSourceLayers;
	readonly subjectId: string;
	readonly truncation: LogicalGraphCompositionTruncation;
	/** Independently valid same-snapshot predecessors must total-project the same source population. */
	readonly unmatchedSources: readonly [];
}

export type LogicalGraphCompositionResult = LogicalGraphCompositionSnapshot;

export type LogicalGraphCompositionDiagnosticCode =
	| 'BUDGET_EXCEEDED'
	| 'CALL_GRAPH_INVALID'
	| 'COMPOSITION_VALIDATION_FAILED'
	| 'INPUT_IDENTITY_MISMATCH'
	| 'INPUT_POPULATION_MISMATCH'
	| 'LAYER_BINDING_INVALID'
	| 'MODULE_DEPENDENCY_GRAPH_INVALID'
	| 'REQUEST_INVALID';

export interface LogicalGraphCompositionDiagnostic {
	readonly code: LogicalGraphCompositionDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'BIND' | 'JOIN' | 'MATERIALIZE' | 'REQUEST' | 'VALIDATE';
}

export type LogicalGraphCompositionBuildOutcome =
	| {
			readonly composition: LogicalGraphCompositionSnapshot;
			readonly diagnostics: readonly LogicalGraphCompositionDiagnostic[];
			readonly outcome: 'partial';
	  }
	| {
			readonly diagnostics: readonly LogicalGraphCompositionDiagnostic[];
			readonly outcome: 'unavailable';
	  };

export type LogicalGraphCompositionOutcome = LogicalGraphCompositionBuildOutcome;

export type LogicalGraphCompositionProgressPhase =
	| 'REQUEST_BIND'
	| 'INPUT_BUDGET'
	| 'MODULE_DEPENDENCY_GRAPH_VALIDATE'
	| 'CALL_GRAPH_VALIDATE'
	| 'INPUT_IDENTITY_RECONCILE'
	| 'SOURCE_OCCURRENCE_JOIN'
	| 'POPULATION_RECONCILE'
	| 'MATERIALIZE'
	| 'SERIALIZE'
	| 'COMPOSITION_VALIDATE';

export interface LogicalGraphCompositionProgressEvent {
	readonly counts: Readonly<Record<string, number>>;
	readonly detailCode: string | null;
	readonly phase: LogicalGraphCompositionProgressPhase;
	readonly schemaVersion: typeof LOGICAL_GRAPH_COMPOSITION_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly state: 'COMPLETED' | 'FAILED' | 'STARTED';
}

export interface BuildLogicalGraphCompositionOptions {
	readonly onProgress?: (event: LogicalGraphCompositionProgressEvent) => void;
}

export interface LogicalGraphCompositionValidationOptions {
	readonly maxDepth?: number;
	readonly maxInputRecords?: number;
	readonly maxInputStringCharacters?: number;
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type LogicalGraphCompositionValidationIssueCode =
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INPUT_INVALID'
	| 'POPULATION_MISMATCH'
	| 'SHAPE_INVALID';

export interface LogicalGraphCompositionValidationIssue {
	readonly code: LogicalGraphCompositionValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export type LogicalGraphCompositionValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly LogicalGraphCompositionValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };
