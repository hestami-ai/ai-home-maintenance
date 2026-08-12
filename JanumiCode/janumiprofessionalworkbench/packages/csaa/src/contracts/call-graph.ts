import type {
	SemanticDeclarationId,
	SemanticInvocationSiteId,
	SemanticInvocationSiteRecord,
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
import { FULL_JAN_CSAA_007_CONFORMANCE } from './semantic.js';

export const CALL_GRAPH_REQUEST_SCHEMA_VERSION = 'jan-csaa-call-graph-request/1.0.0' as const;
export const CALL_GRAPH_SCHEMA_VERSION = 'jan-csaa-call-graph/1.0.0' as const;
export const CALL_GRAPH_OPERATION_VERSION = 'jan-csaa-build-call-graph/0.1.0' as const;
export const CALL_GRAPH_CANONICAL_PROFILE = 'jan-csaa-call-graph-canonical/1.0.0' as const;
export const CALL_GRAPH_METHOD = 'typescript-5.9.3-direct-static-call-projection/0.1.0' as const;
export const CALL_GRAPH_CAPABILITY = 'JAN-CSAA-CAP-005' as const;
export const CALL_GRAPH_CAPABILITY_STATUS = 'PARTIAL' as const;

declare const callGraphIdBrand: unique symbol;
export type CallGraphId = string & { readonly [callGraphIdBrand]: 'CallGraph' };
export type CallGraphLayerId = string & { readonly [callGraphIdBrand]: 'CallGraphLayer' };
export type CallGraphNodeId = string & { readonly [callGraphIdBrand]: 'CallGraphNode' };
export type CallGraphEdgeId = string & { readonly [callGraphIdBrand]: 'CallGraphEdge' };

export interface BuildCallGraphRequest {
	readonly operationVersion: typeof CALL_GRAPH_OPERATION_VERSION;
	readonly schemaVersion: typeof CALL_GRAPH_REQUEST_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type CallGraphHealth = 'COMPLETE' | 'PARTIAL';
export type CallGraphClosure = 'CLOSED_WITHIN_DECLARED_METHOD' | 'OPEN';
export type CallGraphResolutionClass =
	'EXACT' | 'CANDIDATE_SET' | 'EXTERNAL_DISPATCH' | 'UNRESOLVED' | 'UNSUPPORTED';
export type CallGraphDispatchClass =
	| 'DIRECT_REFERENCE'
	| 'INLINE_CALLABLE'
	| 'MEMBER_REFERENCE'
	| 'LITERAL_ELEMENT_REFERENCE'
	| 'DYNAMIC_EXPRESSION'
	| 'UNSUPPORTED_EXPRESSION';
export type CallGraphReasonCode =
	| 'INVOCATION_SPECIFIC_SIGNATURE_NOT_RETAINED'
	| 'INLINE_CALLABLE_WITHOUT_RESOLVED_SIGNATURE'
	| 'RESOLVED_LOCAL_CALLABLE_CANDIDATES'
	| 'RESOLVED_EXTERNAL_OR_CONTEXT_ONLY_SYMBOL'
	| 'RESOLVED_SYMBOL_WITHOUT_EXECUTABLE_TARGET'
	| 'REFERENCE_UNRESOLVED'
	| 'REFERENCE_UNSUPPORTED'
	| 'CALLEE_REFERENCE_NOT_RECONCILED'
	| 'MULTIPLE_CALLEE_REFERENCE_CANDIDATES'
	| 'DYNAMIC_CALLEE_EXPRESSION'
	| 'COMPUTED_ELEMENT_DISPATCH'
	| 'DYNAMIC_IMPORT_CALL'
	| 'THIS_OR_SUPER_DISPATCH'
	| 'CALLABLE_VALUE_FLOW_NOT_MODELED';

/**
 * The six JAN-CSAA epistemic dimensions remain separate. SNAPSHOT_BOUND is a
 * binding statement, not a claim that the worktree or repository is current.
 */
export interface CallGraphEpistemicState {
	readonly capabilityCoverage: 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED';
	readonly conflictState: 'NOT_EVALUATED' | 'NONE_OBSERVED' | 'CONFLICTING';
	readonly executionHealth: 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
	readonly freshness: 'SNAPSHOT_BOUND' | 'STALE' | 'UNKNOWN';
	readonly inferenceState: 'NONE' | 'CANDIDATE' | 'UNRESOLVED' | 'MIXED';
	readonly supportBasis:
		'COMPILER_CONFIRMED' | 'COMPILER_BOUND_STATIC_CANDIDATE' | 'NO_TARGET_EVIDENCE' | 'UNSUPPORTED';
}

export interface CallGraphSourceLocation {
	readonly end: number;
	readonly sourceId: SemanticSourceId;
	readonly start: number;
}

export type CallGraphLimitationKind =
	| 'SEMANTIC_INPUT_PARTIAL'
	| 'INVOCATION_SPECIFIC_SIGNATURE_NOT_RETAINED'
	| 'ENTRY_MECHANISM_NOT_ANALYZED'
	| 'CANDIDATE_SET_OPEN'
	| 'EXTERNAL_DISPATCH_FRONTIER'
	| 'UNRESOLVED_TARGET_FRONTIER'
	| 'UNSUPPORTED_TARGET_FRONTIER'
	| 'CALLABLE_VALUE_FLOW_NOT_MODELED'
	| 'DYNAMIC_DISPATCH_NOT_CLOSED'
	| 'CALLER_CONTEXT_COARSENED';

export interface CallGraphLimitation {
	readonly closureEffect: 'NONE' | 'DEGRADES_CLOSURE';
	readonly invocationId: SemanticInvocationSiteId | null;
	readonly kind: CallGraphLimitationKind;
	readonly reason: string;
	readonly sourceId: SemanticSourceId | null;
}

export type CallGraphEntryMechanism =
	| 'PACKAGE_OR_EXECUTABLE_ENTRY'
	| 'FRAMEWORK_ENTRY'
	| 'TEST_DISCOVERY_ENTRY'
	| 'DYNAMIC_IMPORT_OR_CONDITIONAL_LOAD'
	| 'DEPENDENCY_INJECTION_OR_SERVICE_REGISTRY'
	| 'EVENT_MESSAGE_COMMAND_CALLBACK_TIMER_OR_SUBSCRIPTION'
	| 'DECORATOR_OR_METADATA_DISCOVERY'
	| 'REFLECTION_OR_NAME_LOOKUP'
	| 'CONFIG_MANIFEST_SCRIPT_PLUGIN_OR_EXTENSION'
	| 'GENERATED_OR_VIRTUAL_SOURCE_ENTRY'
	| 'EXTERNAL_API_JOB_PROTOCOL_OR_NATIVE_ENTRY'
	| 'RUNTIME_OBSERVED_ENTRY';

export interface CallGraphEntryMechanismCoverage {
	readonly mechanism: CallGraphEntryMechanism;
	readonly reason: string;
	readonly state: 'COVERED' | 'PARTIAL' | 'NOT_ANALYZED' | 'NOT_APPLICABLE';
}

export type CallGraphRelationLane =
	'CONFIRMED' | 'CANDIDATE' | 'INFERRED' | 'OBSERVED' | 'UNRESOLVED';

export interface CallGraphRelationLaneCoverage {
	readonly lane: CallGraphRelationLane;
	readonly reason: string;
	readonly state: 'SUPPORTED' | 'PARTIAL' | 'NOT_SUPPORTED' | 'NOT_RUN';
}

export interface CallGraphCoverage {
	readonly candidateSetCallSites: number;
	readonly candidateTargetEdges: number;
	readonly closure: CallGraphClosure;
	readonly exactCallSites: number;
	readonly expectedCallSites: number;
	readonly externalDispatchCallSites: number;
	readonly frontierNodes: number;
	readonly ownershipEdges: number;
	readonly reconciles: boolean;
	readonly representedCallSites: number;
	readonly targetEdges: number;
	readonly unresolvedCallSites: number;
	readonly unsupportedCallSites: number;
	readonly wholeProgramReachability: 'NOT_CLAIMED';
}

interface CallGraphNodeBase {
	readonly epistemic: CallGraphEpistemicState;
	readonly graphId: CallGraphId;
	readonly id: CallGraphNodeId;
	readonly layerId: CallGraphLayerId;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceLocations: readonly CallGraphSourceLocation[];
	readonly subjectId: string;
}

export interface CallGraphSourceRegionNode extends CallGraphNodeBase {
	readonly analysisDisposition: 'DEEP_INDEXED' | 'CONTEXT_ONLY';
	readonly kind: 'SOURCE_REGION';
	readonly logicalPath: string;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
}

export type CallGraphCallableKind =
	| 'FUNCTION_DECLARATION'
	| 'METHOD_DECLARATION'
	| 'CONSTRUCTOR'
	| 'GET_ACCESSOR'
	| 'SET_ACCESSOR'
	| 'FUNCTION_EXPRESSION'
	| 'ARROW_FUNCTION'
	| 'CLASS_EXPRESSION'
	| 'CLASS_DECLARATION'
	| 'CLASS_STATIC_BLOCK';

export interface CallGraphCallableTargetNode extends CallGraphNodeBase {
	readonly bodyState: 'BLOCK_BODY' | 'EXPRESSION_BODY' | 'IMPLICIT' | 'STATIC_BLOCK';
	readonly callableKind: CallGraphCallableKind;
	readonly declarationIds: readonly SemanticDeclarationId[];
	readonly kind: 'CALLABLE_TARGET';
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly semanticNodeId: SemanticNodeId;
	readonly sourceId: SemanticSourceId;
	readonly symbolIds: readonly SemanticSymbolId[];
}

export interface CallGraphCallSiteNode extends CallGraphNodeBase {
	readonly calleeNodeId: SemanticNodeId;
	readonly dispatchClass: CallGraphDispatchClass;
	readonly invocationId: SemanticInvocationSiteId;
	readonly invocationKind: SemanticInvocationSiteRecord['invocationKind'];
	readonly invocationNodeId: SemanticNodeId;
	readonly kind: 'CALL_SITE';
	readonly optional: boolean;
	readonly ownerNodeId: CallGraphNodeId;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly reasonCode: CallGraphReasonCode;
	readonly referenceIds: readonly SemanticReferenceId[];
	readonly resolutionClass: CallGraphResolutionClass;
	readonly resolvedSymbolIds: readonly SemanticSymbolId[];
	readonly sourceId: SemanticSourceId;
	readonly targetNodeIds: readonly CallGraphNodeId[];
}

export interface CallGraphFrontierNode extends CallGraphNodeBase {
	readonly frontierKind: 'EXTERNAL_DISPATCH' | 'UNRESOLVED' | 'UNSUPPORTED';
	readonly invocationId: SemanticInvocationSiteId;
	readonly kind: 'FRONTIER';
	readonly reasonCode: CallGraphReasonCode;
	readonly semanticSymbolIds: readonly SemanticSymbolId[];
	readonly sourceId: SemanticSourceId;
}

export type CallGraphNode =
	| CallGraphSourceRegionNode
	| CallGraphCallableTargetNode
	| CallGraphCallSiteNode
	| CallGraphFrontierNode;

export interface CallGraphEndpoint {
	readonly kind: CallGraphNode['kind'];
	readonly nodeId: CallGraphNodeId;
}

interface CallGraphEdgeBase {
	readonly epistemic: CallGraphEpistemicState;
	readonly graphId: CallGraphId;
	readonly id: CallGraphEdgeId;
	readonly layerId: CallGraphLayerId;
	readonly method: typeof CALL_GRAPH_METHOD;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly source: CallGraphEndpoint;
	readonly sourceLocations: readonly CallGraphSourceLocation[];
	readonly subjectId: string;
	readonly target: CallGraphEndpoint;
}

export interface CallGraphOwnershipEdge extends CallGraphEdgeBase {
	readonly candidateRank: null;
	readonly evidenceClass: 'R-SEM';
	readonly invocationId: SemanticInvocationSiteId;
	readonly relationCode: 'STRUCTURAL';
	readonly relationKind: 'CALL_SITE_OWNERSHIP';
	readonly resolutionClass: null;
	readonly targetState: 'STRUCTURAL';
}

export interface CallGraphConfirmedTargetEdge extends CallGraphEdgeBase {
	readonly candidateRank: null;
	readonly evidenceClass: 'R-SEM';
	readonly invocationId: SemanticInvocationSiteId;
	readonly relationCode: 'REL-067';
	readonly relationKind: 'CONFIRMED_CALL_TARGET';
	readonly resolutionClass: 'EXACT';
	readonly targetState: 'CONFIRMED';
}

export interface CallGraphCandidateTargetEdge extends CallGraphEdgeBase {
	readonly candidateRank: number;
	readonly evidenceClass: 'R-INF';
	readonly inferenceBasis: {
		readonly inputIds: readonly string[];
		readonly limitationKinds: readonly CallGraphLimitationKind[];
		readonly method: typeof CALL_GRAPH_METHOD;
		readonly rationale: string;
	};
	readonly invocationId: SemanticInvocationSiteId;
	readonly relationCode: 'REL-068';
	readonly relationKind: 'CANDIDATE_CALL_TARGET';
	readonly resolutionClass: 'CANDIDATE_SET';
	readonly targetState: 'CANDIDATE';
}

export interface CallGraphUnresolvedTargetEdge extends CallGraphEdgeBase {
	readonly candidateRank: null;
	readonly evidenceClass: 'R-INF';
	readonly invocationId: SemanticInvocationSiteId;
	readonly relationCode: 'REL-071';
	readonly relationKind: 'UNRESOLVED_CALL_TARGET';
	readonly resolutionClass: 'EXTERNAL_DISPATCH' | 'UNRESOLVED' | 'UNSUPPORTED';
	readonly targetState: 'UNRESOLVED_DYNAMIC';
}

export type CallGraphEdge =
	| CallGraphOwnershipEdge
	| CallGraphConfirmedTargetEdge
	| CallGraphCandidateTargetEdge
	| CallGraphUnresolvedTargetEdge;

export interface CallGraphLayer {
	readonly capability: typeof CALL_GRAPH_CAPABILITY;
	readonly capabilityStatus: typeof CALL_GRAPH_CAPABILITY_STATUS;
	readonly coverage: CallGraphCoverage;
	readonly edgeIds: readonly CallGraphEdgeId[];
	readonly entryMechanismCoverage: readonly CallGraphEntryMechanismCoverage[];
	readonly epistemic: CallGraphEpistemicState;
	readonly graphId: CallGraphId;
	readonly id: CallGraphLayerId;
	readonly kind: 'TYPESCRIPT_STATIC_CALL';
	readonly limitations: readonly CallGraphLimitation[];
	readonly method: typeof CALL_GRAPH_METHOD;
	readonly nodeIds: readonly CallGraphNodeId[];
	readonly ordinal: 0;
	readonly producer: SemanticProviderIdentity;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly relationLaneCoverage: readonly CallGraphRelationLaneCoverage[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export interface CallGraphIndexEntry {
	readonly edgeIds: readonly CallGraphEdgeId[];
	readonly nodeId: CallGraphNodeId;
}

export interface CallGraphSnapshot {
	readonly canonicalProfile: typeof CALL_GRAPH_CANONICAL_PROFILE;
	readonly capability: typeof CALL_GRAPH_CAPABILITY;
	readonly capabilityStatus: typeof CALL_GRAPH_CAPABILITY_STATUS;
	readonly contentDigest: string;
	readonly coverage: CallGraphCoverage;
	readonly edges: readonly CallGraphEdge[];
	readonly entryMechanismCoverage: readonly CallGraphEntryMechanismCoverage[];
	readonly epistemic: CallGraphEpistemicState;
	readonly forwardIndex: readonly CallGraphIndexEntry[];
	readonly fullJanCsaa007Conformance: typeof FULL_JAN_CSAA_007_CONFORMANCE;
	readonly graphInputDigest: string;
	readonly graphKind: 'TYPESCRIPT_CALL';
	readonly health: CallGraphHealth;
	readonly id: CallGraphId;
	readonly layers: readonly [CallGraphLayer];
	readonly limitations: readonly CallGraphLimitation[];
	readonly method: typeof CALL_GRAPH_METHOD;
	readonly nodes: readonly CallGraphNode[];
	readonly operationVersion: typeof CALL_GRAPH_OPERATION_VERSION;
	readonly producer: SemanticProviderIdentity;
	readonly relationLaneCoverage: readonly CallGraphRelationLaneCoverage[];
	readonly reverseIndex: readonly CallGraphIndexEntry[];
	readonly schemaVersion: typeof CALL_GRAPH_SCHEMA_VERSION;
	readonly semanticExtractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly semanticSchemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type CallGraphBuildDiagnosticCode =
	| 'DANGLING_SEMANTIC_REFERENCE'
	| 'GRAPH_PARTIAL'
	| 'GRAPH_VALIDATION_FAILED'
	| 'REQUEST_INVALID'
	| 'SEMANTIC_CAPABILITY_UNAVAILABLE'
	| 'SEMANTIC_SNAPSHOT_ID_MISMATCH'
	| 'SUBJECT_ID_MISMATCH';

export interface CallGraphBuildDiagnostic {
	readonly code: CallGraphBuildDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'REQUEST' | 'PROJECT' | 'VALIDATE';
}

export type CallGraphBuildOutcome =
	| {
			readonly diagnostics: readonly CallGraphBuildDiagnostic[];
			readonly graph: CallGraphSnapshot;
			readonly outcome: 'complete' | 'partial';
	  }
	| {
			readonly diagnostics: readonly CallGraphBuildDiagnostic[];
			readonly graph?: never;
			readonly outcome: 'unavailable';
	  };
