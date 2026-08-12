import type {
	SemanticProgramId,
	SemanticProjectId,
	SemanticProvenanceId,
	SemanticProviderIdentity,
	SemanticSnapshotId,
	SemanticSourceId,
	StaticSemanticSnapshot
} from './semantic.js';
import { FULL_JAN_CSAA_007_CONFORMANCE } from './semantic.js';
import type { ArtifactPrimaryClass, ArtifactSemanticRole } from './subject.js';

export const STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION =
	'jan-csaa-state-machine-topology-observation-request/1.0.0' as const;
export const STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION =
	'jan-csaa-state-machine-topology-observation/1.0.0' as const;
export const STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION =
	'jan-csaa-observe-jpwb-state-machine-topology/0.1.0' as const;
export const STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD =
	'jpwb-generated-transition-table-typescript-ast/0.1.0' as const;
export const STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION =
	'jan-csaa-state-machine-graph-request/1.0.0' as const;
export const STATE_MACHINE_GRAPH_SCHEMA_VERSION = 'jan-csaa-state-machine-graph/1.0.0' as const;
export const STATE_MACHINE_GRAPH_OPERATION_VERSION =
	'jan-csaa-build-state-machine-graph/0.1.0' as const;
export const STATE_MACHINE_GRAPH_CANONICAL_PROFILE =
	'jan-csaa-state-machine-graph-canonical/1.0.0' as const;
export const STATE_MACHINE_GRAPH_METHOD =
	'jpwb-generated-transition-topology-projection/0.1.0' as const;
export const STATE_MACHINE_GRAPH_CAPABILITY = 'JAN-CSAA-CAP-027' as const;
export const STATE_MACHINE_GRAPH_CAPABILITY_STATUS = 'PARTIAL' as const;
export const STATE_MACHINE_GRAPH_REGISTRY_STATUS = 'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY = 'RETAINED_DELEGATED' as const;
export const STATE_MACHINE_GRAPH_SCOPE = 'GENERATED_RUNTIME_TOPOLOGY_ONLY' as const;
export const FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;

declare const stateMachineIdentityBrand: unique symbol;
export type StateMachineTopologyObservationId = string & {
	readonly [stateMachineIdentityBrand]: 'StateMachineTopologyObservation';
};
export type StateMachineTopologyMachineId = string & {
	readonly [stateMachineIdentityBrand]: 'StateMachineTopologyMachine';
};
export type StateMachineTopologyStateId = string & {
	readonly [stateMachineIdentityBrand]: 'StateMachineTopologyState';
};
export type StateMachineTopologyTransitionId = string & {
	readonly [stateMachineIdentityBrand]: 'StateMachineTopologyTransition';
};
export type StateMachineTopologyCrossAxisRuleId = string & {
	readonly [stateMachineIdentityBrand]: 'StateMachineTopologyCrossAxisRule';
};
export type StateMachineGraphId = string & {
	readonly [stateMachineIdentityBrand]: 'StateMachineGraph';
};
export type StateMachineGraphLayerId = string & {
	readonly [stateMachineIdentityBrand]: 'StateMachineGraphLayer';
};
export type StateMachineGraphNodeId = string & {
	readonly [stateMachineIdentityBrand]: 'StateMachineGraphNode';
};
export type StateMachineGraphEdgeId = string & {
	readonly [stateMachineIdentityBrand]: 'StateMachineGraphEdge';
};

export interface StateMachineSourceSpan {
	readonly end: number;
	readonly start: number;
}

export interface StateMachineTopologyArtifactBinding {
	readonly bytes: number;
	readonly canonicalPathKey: string;
	readonly disposition: 'ANALYZED';
	readonly path: string;
	readonly primaryClass: ArtifactPrimaryClass;
	readonly roles: readonly ArtifactSemanticRole[];
	readonly sha256: string;
}

/** All operational bounds are explicit caller budgets, not product capacity ceilings. */
export interface StateMachineTopologyObservationBudgets {
	readonly maxAstNodes: number;
	readonly maxCrossAxisRules: number;
	readonly maxDiagnostics: number;
	readonly maxMachines: number;
	readonly maxSourceBytes: number;
	readonly maxStates: number;
	readonly maxTextCharacters: number;
	readonly maxTransitions: number;
}

export interface BuildStateMachineTopologyObservationRequest {
	readonly artifact: StateMachineTopologyArtifactBinding;
	readonly budgets: StateMachineTopologyObservationBudgets;
	readonly operationVersion: typeof STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION;
	readonly schemaVersion: typeof STATE_MACHINE_TOPOLOGY_OBSERVATION_REQUEST_SCHEMA_VERSION;
	readonly subjectId: string;
}

export interface StateMachineTopologyMachineRecord {
	readonly explicitlyIllegalTransitionIds: readonly StateMachineTopologyTransitionId[];
	readonly guardedTransitionIds: readonly StateMachineTopologyTransitionId[];
	readonly id: StateMachineTopologyMachineId;
	readonly initialState: string | null;
	readonly legalTransitionIds: readonly StateMachineTopologyTransitionId[];
	readonly name: string;
	readonly sourceSection: string | null;
	readonly span: StateMachineSourceSpan;
	readonly stateIds: readonly StateMachineTopologyStateId[];
	readonly terminalStates: readonly string[];
}

export interface StateMachineTopologyStateRecord {
	readonly id: StateMachineTopologyStateId;
	readonly initial: boolean;
	readonly machineId: StateMachineTopologyMachineId;
	readonly name: string;
	readonly ordinal: number;
	readonly span: StateMachineSourceSpan;
	readonly terminal: boolean;
}

export interface StateMachineTopologyLegalTransitionRecord {
	readonly from: string;
	readonly fromStateId: StateMachineTopologyStateId;
	readonly guard: string | null;
	readonly id: StateMachineTopologyTransitionId;
	readonly machineId: StateMachineTopologyMachineId;
	readonly note: string | null;
	readonly ordinal: number;
	readonly span: StateMachineSourceSpan;
	readonly to: string;
	readonly toStateId: StateMachineTopologyStateId;
	readonly trigger: string | null;
}

export interface StateMachineTopologyIllegalTransitionRecord {
	readonly from: string;
	readonly fromStateId: StateMachineTopologyStateId;
	readonly id: StateMachineTopologyTransitionId;
	readonly machineId: StateMachineTopologyMachineId;
	readonly ordinal: number;
	readonly reason: string | null;
	readonly span: StateMachineSourceSpan;
	readonly to: string;
	readonly toStateId: StateMachineTopologyStateId;
}

export interface StateMachineTopologyGuardedTransitionRecord {
	readonly from: string;
	readonly fromStateId: StateMachineTopologyStateId;
	readonly id: StateMachineTopologyTransitionId;
	readonly legalTransitionId: StateMachineTopologyTransitionId;
	readonly machineId: StateMachineTopologyMachineId;
	readonly ordinal: number;
	readonly reason: string | null;
	readonly span: StateMachineSourceSpan;
	readonly to: string;
	readonly toStateId: StateMachineTopologyStateId;
}

export interface StateMachineTopologyCrossAxisRuleRecord {
	readonly from: string;
	readonly id: StateMachineTopologyCrossAxisRuleId;
	readonly machineId: StateMachineTopologyMachineId;
	readonly machineName: string;
	readonly ordinal: number;
	readonly reason: string | null;
	readonly span: StateMachineSourceSpan;
	readonly to: string;
}

export interface StateMachineTopologyCoverage {
	readonly crossAxisRules: number;
	readonly explicitlyIllegalTransitions: number;
	readonly guardedTransitions: number;
	readonly legalTransitions: number;
	readonly machines: number;
	readonly reconciles: boolean;
	readonly states: number;
}

export interface StateMachineTopologyEpistemicState {
	readonly capabilityCoverage: 'PARTIAL';
	readonly conflictState: 'NOT_EVALUATED';
	readonly executionHealth: 'SUCCEEDED' | 'PARTIAL';
	readonly freshness: 'SUBJECT_BOUND' | 'SUBJECT_AND_SNAPSHOT_BOUND';
	readonly inferenceState: 'NONE';
	readonly supportBasis: 'DECLARED_GENERATED_TOPOLOGY';
}

export interface StateMachineTopologyObservation {
	readonly artifact: StateMachineTopologyArtifactBinding;
	readonly budgets: StateMachineTopologyObservationBudgets;
	readonly contentDigest: string;
	readonly coverage: StateMachineTopologyCoverage;
	readonly crossAxisRules: readonly StateMachineTopologyCrossAxisRuleRecord[];
	readonly explicitlyIllegalTransitions: readonly StateMachineTopologyIllegalTransitionRecord[];
	readonly epistemic: StateMachineTopologyEpistemicState;
	readonly fullJanCsaa007Conformance: typeof FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof FULL_JAN_CSAA_008_CONFORMANCE;
	readonly guardedTransitions: readonly StateMachineTopologyGuardedTransitionRecord[];
	readonly id: StateMachineTopologyObservationId;
	readonly legalTransitions: readonly StateMachineTopologyLegalTransitionRecord[];
	readonly machines: readonly StateMachineTopologyMachineRecord[];
	readonly method: typeof STATE_MACHINE_TOPOLOGY_OBSERVATION_METHOD;
	readonly operationVersion: typeof STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION;
	readonly producer: SemanticProviderIdentity;
	readonly registryStatus: typeof STATE_MACHINE_GRAPH_REGISTRY_STATUS;
	readonly schemaVersion: typeof STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION;
	readonly scope: typeof STATE_MACHINE_GRAPH_SCOPE;
	readonly states: readonly StateMachineTopologyStateRecord[];
	readonly subjectId: string;
	readonly verifierAuthority: typeof STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY;
}

export type StateMachineTopologyObservationDiagnosticCode =
	| 'ARTIFACT_IDENTITY_MISMATCH'
	| 'BUDGET_EXHAUSTED'
	| 'MALFORMED_GENERATED_TABLE'
	| 'REQUEST_INVALID'
	| 'SUBJECT_CAPABILITY_UNAVAILABLE'
	| 'SUBJECT_ID_MISMATCH'
	| 'UNSUPPORTED_GENERATED_TABLE';

export interface StateMachineTopologyObservationDiagnostic {
	readonly code: StateMachineTopologyObservationDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'REQUEST' | 'READ' | 'PARSE' | 'VALIDATE';
}

export type BuildStateMachineTopologyObservationOutcome =
	| {
			readonly diagnostics: readonly StateMachineTopologyObservationDiagnostic[];
			readonly observation: StateMachineTopologyObservation;
			readonly outcome: 'complete';
	  }
	| {
			readonly diagnostics: readonly StateMachineTopologyObservationDiagnostic[];
			readonly observation?: never;
			readonly outcome: 'unavailable';
	  };

export interface StateMachineGraphSourceSelector {
	readonly logicalPath: string;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
}

/** Caller policy for this operation; these values do not define product capacity. */
export interface StateMachineGraphBudgets {
	readonly maxEdges: number;
	readonly maxNodes: number;
}

export interface BuildStateMachineGraphRequest {
	readonly budgets: StateMachineGraphBudgets;
	readonly observationId: StateMachineTopologyObservationId;
	readonly operationVersion: typeof STATE_MACHINE_GRAPH_OPERATION_VERSION;
	readonly schemaVersion: typeof STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly source: StateMachineGraphSourceSelector;
	readonly subjectId: string;
}

export interface StateMachineGraphSourceLocation extends StateMachineSourceSpan {
	readonly sourceId: SemanticSourceId;
}

interface StateMachineGraphNodeBase {
	readonly epistemic: StateMachineTopologyEpistemicState;
	readonly graphId: StateMachineGraphId;
	readonly id: StateMachineGraphNodeId;
	readonly layerId: StateMachineGraphLayerId;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceLocations: readonly StateMachineGraphSourceLocation[];
	readonly subjectId: string;
}

export interface StateMachineGraphMachineNode extends StateMachineGraphNodeBase {
	readonly initialState: string | null;
	readonly kind: 'MACHINE';
	readonly name: string;
	readonly observationMachineId: StateMachineTopologyMachineId;
	readonly sourceSection: string | null;
	readonly terminalStates: readonly string[];
}

export interface StateMachineGraphStateNode extends StateMachineGraphNodeBase {
	readonly initial: boolean;
	readonly kind: 'STATE';
	readonly machineNodeId: StateMachineGraphNodeId;
	readonly name: string;
	readonly observationStateId: StateMachineTopologyStateId;
	readonly ordinal: number;
	readonly terminal: boolean;
}

export interface StateMachineGraphCrossAxisFrontierNode extends StateMachineGraphNodeBase {
	readonly from: string;
	readonly kind: 'CROSS_AXIS_FRONTIER';
	readonly machineName: string;
	readonly observationRuleId: StateMachineTopologyCrossAxisRuleId;
	readonly reason: string | null;
	readonly to: string;
}

export type StateMachineGraphNode =
	| StateMachineGraphMachineNode
	| StateMachineGraphStateNode
	| StateMachineGraphCrossAxisFrontierNode;

export type StateMachineGraphRelationKind =
	| 'CONTAINS_STATE'
	| 'DECLARES_CROSS_AXIS_RULE'
	| 'EXPLICITLY_ILLEGAL_TRANSITION'
	| 'GUARDED_LEGAL_TRANSITION'
	| 'LEGAL_TRANSITION';

export type StateMachineGraphRelationCode =
	| 'IMPL-JPWB-SM-CONTAINS-STATE-001'
	| 'IMPL-JPWB-SM-DECLARES-CROSS-AXIS-RULE-001'
	| 'IMPL-JPWB-SM-EXPLICITLY-ILLEGAL-TRANSITION-001'
	| 'IMPL-JPWB-SM-GUARDED-LEGAL-TRANSITION-001'
	| 'IMPL-JPWB-SM-LEGAL-TRANSITION-001';

export interface StateMachineGraphEndpoint {
	readonly kind: StateMachineGraphNode['kind'];
	readonly nodeId: StateMachineGraphNodeId;
}

export interface StateMachineGraphEdge {
	readonly epistemic: StateMachineTopologyEpistemicState;
	readonly graphId: StateMachineGraphId;
	readonly guard: string | null;
	readonly id: StateMachineGraphEdgeId;
	readonly layerId: StateMachineGraphLayerId;
	readonly method: typeof STATE_MACHINE_GRAPH_METHOD;
	readonly note: string | null;
	readonly observationRecordId: string;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly reason: string | null;
	readonly relationCode: StateMachineGraphRelationCode;
	readonly relationKind: StateMachineGraphRelationKind;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly source: StateMachineGraphEndpoint;
	readonly sourceLocations: readonly StateMachineGraphSourceLocation[];
	readonly subjectId: string;
	readonly target: StateMachineGraphEndpoint;
	readonly trigger: string | null;
}

export interface StateMachineGraphCoverage {
	readonly crossAxisRuleEdges: number;
	readonly expectedCrossAxisRules: number;
	readonly expectedExplicitlyIllegalTransitions: number;
	readonly expectedGuardedTransitions: number;
	readonly expectedLegalTransitions: number;
	readonly expectedMachines: number;
	readonly expectedStates: number;
	readonly explicitlyIllegalTransitionEdges: number;
	readonly guardedLegalTransitionEdges: number;
	readonly legalTransitionEdges: number;
	readonly machineNodes: number;
	readonly reconciles: boolean;
	readonly stateContainmentEdges: number;
	readonly stateNodes: number;
}

export type StateMachineGraphLimitationKind =
	| 'COMMAND_PERFORMABILITY_NOT_ANALYZED'
	| 'CROSS_AXIS_EFFECT_NOT_MODELED'
	| 'GENERATED_TOPOLOGY_ONLY'
	| 'GUARD_ENFORCEMENT_NOT_ANALYZED'
	| 'RELATION_REGISTRY_UNAVAILABLE'
	| 'SEMANTIC_INPUT_PARTIAL'
	| 'WHOLE_PROGRAM_REACHABILITY_NOT_ANALYZED';

export interface StateMachineGraphLimitation {
	readonly kind: StateMachineGraphLimitationKind;
	readonly reason: string;
}

export interface StateMachineGraphLayer {
	readonly capability: typeof STATE_MACHINE_GRAPH_CAPABILITY;
	readonly capabilityStatus: typeof STATE_MACHINE_GRAPH_CAPABILITY_STATUS;
	readonly coverage: StateMachineGraphCoverage;
	readonly edgeIds: readonly StateMachineGraphEdgeId[];
	readonly epistemic: StateMachineTopologyEpistemicState;
	readonly graphId: StateMachineGraphId;
	readonly id: StateMachineGraphLayerId;
	readonly kind: 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY';
	readonly limitations: readonly StateMachineGraphLimitation[];
	readonly method: typeof STATE_MACHINE_GRAPH_METHOD;
	readonly nodeIds: readonly StateMachineGraphNodeId[];
	readonly ordinal: 0;
	readonly producer: SemanticProviderIdentity;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly scope: typeof STATE_MACHINE_GRAPH_SCOPE;
	readonly subjectId: string;
}

export interface StateMachineGraphIndexEntry {
	readonly edgeIds: readonly StateMachineGraphEdgeId[];
	readonly nodeId: StateMachineGraphNodeId;
}

export interface StateMachineGraphSnapshot {
	readonly budgets: StateMachineGraphBudgets;
	readonly canonicalProfile: typeof STATE_MACHINE_GRAPH_CANONICAL_PROFILE;
	readonly capability: typeof STATE_MACHINE_GRAPH_CAPABILITY;
	readonly capabilityStatus: typeof STATE_MACHINE_GRAPH_CAPABILITY_STATUS;
	readonly contentDigest: string;
	readonly coverage: StateMachineGraphCoverage;
	readonly closure: 'OPEN';
	readonly edges: readonly StateMachineGraphEdge[];
	readonly epistemic: StateMachineTopologyEpistemicState;
	readonly forwardIndex: readonly StateMachineGraphIndexEntry[];
	readonly fullJanCsaa007Conformance: typeof FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof FULL_JAN_CSAA_008_CONFORMANCE;
	readonly graphInputDigest: string;
	readonly graphKind: 'JPWB_GENERATED_STATE_MACHINE_TOPOLOGY';
	readonly health: 'PARTIAL';
	readonly id: StateMachineGraphId;
	readonly layers: readonly [StateMachineGraphLayer];
	readonly limitations: readonly StateMachineGraphLimitation[];
	readonly method: typeof STATE_MACHINE_GRAPH_METHOD;
	readonly nodes: readonly StateMachineGraphNode[];
	readonly observationId: StateMachineTopologyObservationId;
	readonly operationVersion: typeof STATE_MACHINE_GRAPH_OPERATION_VERSION;
	readonly producer: SemanticProviderIdentity;
	readonly registryStatus: typeof STATE_MACHINE_GRAPH_REGISTRY_STATUS;
	readonly reverseIndex: readonly StateMachineGraphIndexEntry[];
	readonly schemaVersion: typeof STATE_MACHINE_GRAPH_SCHEMA_VERSION;
	readonly semanticExtractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly semanticSchemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly scope: typeof STATE_MACHINE_GRAPH_SCOPE;
	readonly source: StateMachineGraphSourceSelector;
	readonly subjectId: string;
	readonly verifierAuthority: typeof STATE_MACHINE_GRAPH_VERIFIER_AUTHORITY;
}

export type StateMachineGraphBuildDiagnosticCode =
	| 'BUDGET_EXHAUSTED'
	| 'GRAPH_PARTIAL'
	| 'GRAPH_VALIDATION_FAILED'
	| 'OBSERVATION_ID_MISMATCH'
	| 'OBSERVATION_INVALID'
	| 'REQUEST_INVALID'
	| 'SEMANTIC_CAPABILITY_UNAVAILABLE'
	| 'SEMANTIC_SNAPSHOT_ID_MISMATCH'
	| 'SOURCE_BINDING_MISMATCH'
	| 'SUBJECT_ID_MISMATCH';

export interface StateMachineGraphBuildDiagnostic {
	readonly code: StateMachineGraphBuildDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'REQUEST' | 'PROJECT' | 'VALIDATE';
}

export type StateMachineGraphBuildOutcome =
	| {
			readonly diagnostics: readonly StateMachineGraphBuildDiagnostic[];
			readonly graph: StateMachineGraphSnapshot;
			readonly outcome: 'partial';
	  }
	| {
			readonly diagnostics: readonly StateMachineGraphBuildDiagnostic[];
			readonly graph?: never;
			readonly outcome: 'unavailable';
	  };
