import type {
	SemanticModuleOccurrenceKind,
	SemanticModuleResolutionId,
	SemanticModuleResolutionRecord,
	SemanticNodeId,
	SemanticProgramId,
	SemanticProviderIdentity,
	SemanticProjectId,
	SemanticProvenanceId,
	SemanticSnapshotId,
	SemanticSourceId,
	StaticSemanticSnapshot
} from './semantic.js';
import { FULL_JAN_CSAA_007_CONFORMANCE } from './semantic.js';

export const MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION =
	'jan-csaa-module-dependency-graph-request/1.0.0' as const;
export const MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION =
	'jan-csaa-module-dependency-graph/1.0.0' as const;
export const MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION =
	'jan-csaa-build-module-dependency-graph/0.1.1' as const;
export const MODULE_DEPENDENCY_GRAPH_CANONICAL_PROFILE =
	'jan-csaa-module-dependency-graph-canonical/1.0.1' as const;
export const MODULE_DEPENDENCY_GRAPH_METHOD =
	'typescript-public-module-resolution-projection/1.0.0' as const;
export const MODULE_DEPENDENCY_GRAPH_CAPABILITY = 'JAN-CSAA-CAP-004' as const;
export const MODULE_DEPENDENCY_GRAPH_CAPABILITY_STATUS = 'PARTIAL' as const;

declare const moduleDependencyGraphIdBrand: unique symbol;
export type ModuleDependencyGraphId = string & {
	readonly [moduleDependencyGraphIdBrand]: 'ModuleDependencyGraph';
};
export type ModuleDependencyGraphLayerId = string & {
	readonly [moduleDependencyGraphIdBrand]: 'ModuleDependencyGraphLayer';
};
export type ModuleDependencyGraphNodeId = string & {
	readonly [moduleDependencyGraphIdBrand]: 'ModuleDependencyGraphNode';
};
export type ModuleDependencyGraphEdgeId = string & {
	readonly [moduleDependencyGraphIdBrand]: 'ModuleDependencyGraphEdge';
};

export interface BuildModuleDependencyGraphRequest {
	readonly operationVersion: typeof MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION;
	readonly schemaVersion: typeof MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type ModuleDependencyGraphHealth = 'COMPLETE' | 'PARTIAL';
export type ModuleDependencyGraphEpistemicState =
	'SUPPORTED' | 'UNKNOWN' | 'UNSUPPORTED' | 'CONFLICTING';

export interface ModuleDependencyGraphSourceLocation {
	readonly end: number;
	readonly sourceId: SemanticSourceId;
	readonly start: number;
}

export type ModuleDependencyGraphLimitationKind =
	| 'DEPCRUISE_NOT_RUN'
	| 'NON_SOURCE_MODULE_TARGET'
	| 'SEMANTIC_INPUT_PARTIAL'
	| 'UNRESOLVED_MODULE'
	| 'UNSUPPORTED_MODULE_RESOLUTION';

export interface ModuleDependencyGraphLimitation {
	readonly closureEffect: 'NONE' | 'DEGRADES_CLOSURE';
	readonly kind: ModuleDependencyGraphLimitationKind;
	readonly moduleResolutionId: SemanticModuleResolutionId | null;
	readonly reason: string;
	readonly sourceId: SemanticSourceId | null;
}

export interface ModuleDependencyGraphCoverage {
	readonly closure: 'CLOSED' | 'OPEN';
	readonly expectedModuleResolutions: number;
	readonly expectedSources: number;
	readonly graphNativeTargets: number;
	readonly reconciles: boolean;
	readonly representedModuleResolutions: number;
	readonly representedSources: number;
	readonly resolvedAmbientTargets: number;
	readonly resolvedExternalTargets: number;
	readonly resolvedSourceTargets: number;
	readonly unresolvedTargets: number;
	readonly unsupportedTargets: number;
}

interface ModuleDependencyGraphNodeBase {
	readonly epistemic: ModuleDependencyGraphEpistemicState;
	readonly graphId: ModuleDependencyGraphId;
	readonly id: ModuleDependencyGraphNodeId;
	readonly layerId: ModuleDependencyGraphLayerId;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceLocations: readonly ModuleDependencyGraphSourceLocation[];
	readonly subjectId: string;
}

export interface ModuleDependencyGraphSourceNode extends ModuleDependencyGraphNodeBase {
	readonly analysisDisposition: 'DEEP_INDEXED' | 'CONTEXT_ONLY';
	readonly kind: 'SOURCE';
	readonly logicalPath: string;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
}

export interface ModuleDependencyGraphResolutionTargetNode extends ModuleDependencyGraphNodeBase {
	readonly kind: 'RESOLUTION_TARGET';
	readonly moduleResolutionId: SemanticModuleResolutionId;
	readonly moduleSymbolId: SemanticModuleResolutionRecord['moduleSymbolId'];
	readonly resolutionState: Exclude<
		SemanticModuleResolutionRecord['resolutionState'],
		'RESOLVED_SOURCE'
	>;
	readonly specifier: string | null;
	readonly specifierState: SemanticModuleResolutionRecord['specifierState'];
}

export type ModuleDependencyGraphNode =
	ModuleDependencyGraphSourceNode | ModuleDependencyGraphResolutionTargetNode;

export type ModuleDependencyGraphRelationKind =
	| 'DYNAMIC_IMPORT_OCCURRENCE'
	| 'EXPORT_OCCURRENCE'
	| 'IMPORT_EQUALS_OCCURRENCE'
	| 'IMPORT_OCCURRENCE'
	| 'IMPORT_TYPE_OCCURRENCE';

export interface ModuleDependencyGraphEndpoint {
	readonly kind: 'SOURCE' | 'RESOLUTION_TARGET';
	readonly nodeId: ModuleDependencyGraphNodeId;
}

export interface ModuleDependencyGraphEdge {
	readonly epistemic: ModuleDependencyGraphEpistemicState;
	readonly graphId: ModuleDependencyGraphId;
	readonly id: ModuleDependencyGraphEdgeId;
	readonly layerId: ModuleDependencyGraphLayerId;
	readonly method: typeof MODULE_DEPENDENCY_GRAPH_METHOD;
	readonly moduleResolutionId: SemanticModuleResolutionId;
	readonly occurrenceKind: SemanticModuleOccurrenceKind;
	readonly occurrenceNodeId: SemanticNodeId;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly relationKind: ModuleDependencyGraphRelationKind;
	readonly resolutionState: SemanticModuleResolutionRecord['resolutionState'];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly source: ModuleDependencyGraphEndpoint & { readonly kind: 'SOURCE' };
	readonly sourceLocations: readonly ModuleDependencyGraphSourceLocation[];
	readonly specifier: string | null;
	readonly specifierState: SemanticModuleResolutionRecord['specifierState'];
	readonly subjectId: string;
	readonly target: ModuleDependencyGraphEndpoint;
	readonly typeOnly: boolean;
}

export interface ModuleDependencyGraphLayer {
	readonly coverage: ModuleDependencyGraphCoverage;
	readonly edgeIds: readonly ModuleDependencyGraphEdgeId[];
	readonly epistemic: ModuleDependencyGraphEpistemicState;
	readonly graphId: ModuleDependencyGraphId;
	readonly id: ModuleDependencyGraphLayerId;
	readonly kind: 'TYPESCRIPT_MODULE_RESOLUTION';
	readonly limitations: readonly ModuleDependencyGraphLimitation[];
	readonly method: typeof MODULE_DEPENDENCY_GRAPH_METHOD;
	readonly nodeIds: readonly ModuleDependencyGraphNodeId[];
	readonly ordinal: 0;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly producer: SemanticProviderIdentity;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export interface ModuleDependencyGraphIndexEntry {
	readonly edgeIds: readonly ModuleDependencyGraphEdgeId[];
	readonly nodeId: ModuleDependencyGraphNodeId;
}

export interface ModuleDependencyGraphSnapshot {
	readonly canonicalProfile: typeof MODULE_DEPENDENCY_GRAPH_CANONICAL_PROFILE;
	readonly contentDigest: string;
	readonly coverage: ModuleDependencyGraphCoverage;
	readonly edges: readonly ModuleDependencyGraphEdge[];
	readonly epistemic: ModuleDependencyGraphEpistemicState;
	readonly forwardIndex: readonly ModuleDependencyGraphIndexEntry[];
	readonly fullJanCsaa007Conformance: typeof FULL_JAN_CSAA_007_CONFORMANCE;
	readonly graphInputDigest: string;
	readonly graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY';
	readonly health: ModuleDependencyGraphHealth;
	readonly id: ModuleDependencyGraphId;
	readonly layers: readonly [ModuleDependencyGraphLayer];
	readonly limitations: readonly ModuleDependencyGraphLimitation[];
	readonly method: typeof MODULE_DEPENDENCY_GRAPH_METHOD;
	readonly nodes: readonly ModuleDependencyGraphNode[];
	readonly operationVersion: typeof MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION;
	readonly producer: SemanticProviderIdentity;
	readonly reverseIndex: readonly ModuleDependencyGraphIndexEntry[];
	readonly schemaVersion: typeof MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION;
	readonly semanticExtractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly semanticSchemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type ModuleDependencyGraphBuildDiagnosticCode =
	| 'DANGLING_SEMANTIC_REFERENCE'
	| 'GRAPH_PARTIAL'
	| 'GRAPH_VALIDATION_FAILED'
	| 'REQUEST_INVALID'
	| 'SEMANTIC_CAPABILITY_UNAVAILABLE'
	| 'SEMANTIC_SNAPSHOT_ID_MISMATCH'
	| 'SUBJECT_ID_MISMATCH';

export interface ModuleDependencyGraphBuildDiagnostic {
	readonly code: ModuleDependencyGraphBuildDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'REQUEST' | 'PROJECT' | 'VALIDATE';
}

export type ModuleDependencyGraphBuildOutcome =
	| {
			readonly diagnostics: readonly ModuleDependencyGraphBuildDiagnostic[];
			readonly graph: ModuleDependencyGraphSnapshot;
			readonly outcome: 'complete' | 'partial';
	  }
	| {
			readonly diagnostics: readonly ModuleDependencyGraphBuildDiagnostic[];
			readonly graph?: never;
			readonly outcome: 'unavailable';
	  };
