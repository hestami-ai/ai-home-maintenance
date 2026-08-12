import type {
	SemanticAssignmentRecord,
	SemanticDeclarationId,
	SemanticNodeId,
	SemanticProgramId,
	SemanticProjectId,
	SemanticProvenanceId,
	SemanticProviderIdentity,
	SemanticReferenceId,
	SemanticSnapshotId,
	SemanticSourceId,
	SemanticSymbolId,
	StaticSemanticSnapshot
} from './semantic.js';

export const READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION =
	'jan-csaa-read-write-access-graph-request/1.0.0' as const;
export const READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION =
	'jan-csaa-read-write-access-graph/1.0.0' as const;
export const READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION =
	'jan-csaa-build-read-write-access-graph/0.1.0' as const;
export const READ_WRITE_ACCESS_GRAPH_CANONICAL_PROFILE =
	'jan-csaa-read-write-access-graph-canonical/1.0.0' as const;
export const READ_WRITE_ACCESS_GRAPH_METHOD =
	'typescript-normalized-reference-assignment-access-projection/1.0.0' as const;
export const READ_WRITE_ACCESS_GRAPH_CAPABILITY = 'TYPESCRIPT_READ_WRITE_ACCESS' as const;
export const READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS = 'PARTIAL' as const;
export const FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW = 'NOT_CLAIMED' as const;

declare const readWriteAccessGraphBrand: unique symbol;
export type ReadWriteAccessGraphId = string & {
	readonly [readWriteAccessGraphBrand]: 'ReadWriteAccessGraph';
};
export type ReadWriteAccessGraphLayerId = string & {
	readonly [readWriteAccessGraphBrand]: 'ReadWriteAccessGraphLayer';
};
export type ReadWriteAccessGraphNodeId = string & {
	readonly [readWriteAccessGraphBrand]: 'ReadWriteAccessGraphNode';
};
export type ReadWriteAccessGraphEdgeId = string & {
	readonly [readWriteAccessGraphBrand]: 'ReadWriteAccessGraphEdge';
};

export interface ReadWriteAccessGraphBudgets {
	readonly maxAccesses: number;
	readonly maxEdges: number;
	readonly maxFrontiers: number;
	readonly maxNodes: number;
}

export interface BuildReadWriteAccessGraphRequest {
	readonly budgets: ReadWriteAccessGraphBudgets;
	readonly operationVersion: typeof READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION;
	readonly schemaVersion: typeof READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type ReadWriteAccessKind = 'READ' | 'READ_WRITE' | 'WRITE';
export type ReadWriteAccessGraphEpistemicState = 'SUPPORTED' | 'UNKNOWN' | 'UNSUPPORTED';

export interface ReadWriteAccessSourceLocation {
	readonly end: number;
	readonly sourceId: SemanticSourceId;
	readonly start: number;
}

interface ReadWriteAccessGraphNodeBase {
	readonly epistemic: ReadWriteAccessGraphEpistemicState;
	readonly graphId: ReadWriteAccessGraphId;
	readonly id: ReadWriteAccessGraphNodeId;
	readonly layerId: ReadWriteAccessGraphLayerId;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceLocations: readonly ReadWriteAccessSourceLocation[];
	readonly subjectId: string;
}

export interface ReadWriteSymbolSlotNode extends ReadWriteAccessGraphNodeBase {
	readonly declarationIds: readonly SemanticDeclarationId[];
	readonly kind: 'SYMBOL_SLOT';
	readonly name: string;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly symbolId: SemanticSymbolId;
}

export interface ReadWriteAccessOccurrenceNode extends ReadWriteAccessGraphNodeBase {
	readonly accessKind: ReadWriteAccessKind;
	readonly assignmentNodeId: SemanticNodeId | null;
	readonly declarationId: SemanticDeclarationId | null;
	readonly kind: 'ACCESS_OCCURRENCE';
	readonly occurrenceKind: 'ASSIGNMENT_DECLARATION_TARGET' | 'REFERENCE';
	readonly occurrenceNodeId: SemanticNodeId;
	readonly referenceId: SemanticReferenceId | null;
	readonly slotNodeId: ReadWriteAccessGraphNodeId;
	readonly sourceId: SemanticSourceId;
	readonly symbolId: SemanticSymbolId;
}

export type ReadWriteAccessFrontierKind =
	| 'DYNAMIC_ELEMENT_WRITE_TARGET'
	| 'MISSING_SEMANTIC_RECORD'
	| 'TYPE_POSITION_EXCLUDED'
	| 'UNRESOLVED_REFERENCE'
	| 'UNSUPPORTED_ASSIGNMENT_TARGET'
	| 'UNSUPPORTED_REFERENCE';

export interface ReadWriteAccessFrontierNode extends ReadWriteAccessGraphNodeBase {
	readonly assignmentNodeId: SemanticNodeId | null;
	readonly frontierKind: ReadWriteAccessFrontierKind;
	readonly kind: 'FRONTIER';
	readonly occurrenceNodeId: SemanticNodeId;
	readonly reason: string;
	readonly referenceId: SemanticReferenceId | null;
	readonly sourceId: SemanticSourceId;
}

export type ReadWriteAccessGraphNode =
	ReadWriteAccessOccurrenceNode | ReadWriteAccessFrontierNode | ReadWriteSymbolSlotNode;

export interface ReadWriteAccessGraphEndpoint {
	readonly kind: ReadWriteAccessGraphNode['kind'];
	readonly nodeId: ReadWriteAccessGraphNodeId;
}

export interface ReadWriteAccessGraphEdge {
	readonly accessNodeId: ReadWriteAccessGraphNodeId;
	readonly epistemic: 'SUPPORTED';
	readonly graphId: ReadWriteAccessGraphId;
	readonly id: ReadWriteAccessGraphEdgeId;
	readonly layerId: ReadWriteAccessGraphLayerId;
	readonly method: typeof READ_WRITE_ACCESS_GRAPH_METHOD;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly relationKind: 'READS' | 'WRITES';
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly source: ReadWriteAccessGraphEndpoint & { readonly kind: 'ACCESS_OCCURRENCE' };
	readonly sourceLocations: readonly ReadWriteAccessSourceLocation[];
	readonly subjectId: string;
	readonly target: ReadWriteAccessGraphEndpoint & { readonly kind: 'SYMBOL_SLOT' };
}

export type ReadWriteAccessGraphLimitationKind =
	| 'ALIAS_AND_MEMORY_MODEL_NOT_ANALYZED'
	| 'CONTROL_FLOW_NOT_ANALYZED'
	| 'CROSS_PROGRAM_SYMBOL_RECONCILIATION_NOT_ANALYZED'
	| 'DATA_FLOW_CAPABILITY_NOT_CLAIMED'
	| 'DYNAMIC_WRITE_TARGETS_FRONTIERED'
	| 'TYPE_POSITION_REFERENCES_EXCLUDED'
	| 'UNMODELED_WRITE_FORMS_NOT_ANALYZED';

export interface ReadWriteAccessGraphLimitation {
	readonly kind: ReadWriteAccessGraphLimitationKind;
	readonly reason: string;
}

export interface ReadWriteAccessGraphCoverage {
	readonly accessOccurrences: number;
	readonly closure: 'OPEN';
	readonly discoveredAssignments: number;
	readonly discoveredCandidateReferences: number;
	readonly edges: number;
	readonly excludedTypePositionReferences: number;
	readonly frontierAssignments: number;
	readonly frontierReferences: number;
	readonly frontierNodes: number;
	readonly readAccesses: number;
	readonly readWriteAccesses: number;
	readonly reconciles: boolean;
	readonly representedAssignmentTargets: number;
	readonly representedReferences: number;
	readonly symbolSlots: number;
	readonly writeAccesses: number;
}

export interface ReadWriteAccessGraphIndexEntry {
	readonly edgeIds: readonly ReadWriteAccessGraphEdgeId[];
	readonly nodeId: ReadWriteAccessGraphNodeId;
}

export interface ReadWriteAccessGraphLayer {
	readonly capability: typeof READ_WRITE_ACCESS_GRAPH_CAPABILITY;
	readonly capabilityStatus: typeof READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS;
	readonly coverage: ReadWriteAccessGraphCoverage;
	readonly edgeIds: readonly ReadWriteAccessGraphEdgeId[];
	readonly graphId: ReadWriteAccessGraphId;
	readonly id: ReadWriteAccessGraphLayerId;
	readonly kind: 'TYPESCRIPT_READ_WRITE_ACCESS';
	readonly limitations: readonly ReadWriteAccessGraphLimitation[];
	readonly method: typeof READ_WRITE_ACCESS_GRAPH_METHOD;
	readonly nodeIds: readonly ReadWriteAccessGraphNodeId[];
	readonly ordinal: 0;
	readonly producer: SemanticProviderIdentity;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export interface ReadWriteAccessGraphSnapshot {
	readonly canonicalProfile: typeof READ_WRITE_ACCESS_GRAPH_CANONICAL_PROFILE;
	readonly capability: typeof READ_WRITE_ACCESS_GRAPH_CAPABILITY;
	readonly capabilityStatus: typeof READ_WRITE_ACCESS_GRAPH_CAPABILITY_STATUS;
	readonly contentDigest: string;
	readonly coverage: ReadWriteAccessGraphCoverage;
	readonly edges: readonly ReadWriteAccessGraphEdge[];
	readonly forwardIndex: readonly ReadWriteAccessGraphIndexEntry[];
	readonly fullJanCsaaCapability007DataFlow: typeof FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW;
	readonly graphInputDigest: string;
	readonly graphKind: 'TYPESCRIPT_READ_WRITE_ACCESS';
	readonly health: 'PARTIAL';
	readonly id: ReadWriteAccessGraphId;
	readonly layers: readonly [ReadWriteAccessGraphLayer];
	readonly limitations: readonly ReadWriteAccessGraphLimitation[];
	readonly method: typeof READ_WRITE_ACCESS_GRAPH_METHOD;
	readonly nodes: readonly ReadWriteAccessGraphNode[];
	readonly operationVersion: typeof READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION;
	readonly producer: SemanticProviderIdentity;
	readonly reverseIndex: readonly ReadWriteAccessGraphIndexEntry[];
	readonly schemaVersion: typeof READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION;
	readonly semanticExtractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly semanticSchemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type ReadWriteAccessGraphBuildDiagnosticCode =
	| 'BUDGET_EXCEEDED'
	| 'GRAPH_PARTIAL'
	| 'GRAPH_VALIDATION_FAILED'
	| 'REQUEST_INVALID'
	| 'SEMANTIC_CAPABILITY_UNAVAILABLE'
	| 'SEMANTIC_SNAPSHOT_ID_MISMATCH'
	| 'SUBJECT_ID_MISMATCH'
	| 'UNSAFE_SEMANTIC_INPUT';

export interface ReadWriteAccessGraphBuildDiagnostic {
	readonly code: ReadWriteAccessGraphBuildDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'CLASSIFY' | 'REQUEST' | 'VALIDATE';
}

export type ReadWriteAccessGraphBuildOutcome =
	| {
			readonly diagnostics: readonly ReadWriteAccessGraphBuildDiagnostic[];
			readonly graph: ReadWriteAccessGraphSnapshot;
			readonly outcome: 'partial';
	  }
	| {
			readonly diagnostics: readonly ReadWriteAccessGraphBuildDiagnostic[];
			readonly graph?: never;
			readonly outcome: 'unavailable';
	  };

export interface ReadWriteAccessAssignmentClassification {
	readonly assignment: SemanticAssignmentRecord;
	readonly accessKind: ReadWriteAccessKind;
}
