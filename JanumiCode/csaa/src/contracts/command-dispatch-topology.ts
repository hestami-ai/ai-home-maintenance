import type {
	CommandHandlerGraphId,
	CommandHandlerGraphNodeId,
	CommandHandlerGraphSnapshot
} from './command-handler-graph.js';
import type { ArrowCommandCensusObservation } from './arrow-command-census.js';
import type {
	SemanticDeclarationId,
	SemanticInvocationSiteId,
	SemanticNodeId,
	SemanticProgramId,
	SemanticProjectId,
	SemanticProvenanceId,
	SemanticProviderIdentity,
	SemanticReferenceId,
	SemanticSnapshotId,
	SemanticSourceId,
	StaticSemanticSnapshot
} from './semantic.js';
import type { FrozenSubject } from './subject.js';

export const COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION =
	'jan-csaa-command-dispatch-topology-request/1.0.0' as const;
export const COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION =
	'jan-csaa-command-dispatch-topology/1.0.0' as const;
export const COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION =
	'jan-csaa-build-command-dispatch-topology/0.1.0' as const;
export const COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE =
	'jan-csaa-command-dispatch-topology-canonical/1.0.0' as const;
export const COMMAND_DISPATCH_TOPOLOGY_METHOD =
	'jpwb-command-bus-static-dispatch-topology-overlay/1.0.0' as const;
export const COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY = 'JAN-CSAA-CAP-027' as const;
export const COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY = 'JAN-CSAA-CAP-028' as const;
export const COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS = 'PARTIAL' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const COMMAND_DISPATCH_TOPOLOGY_SCOPE =
	'JPWB_COMMAND_BUS_DISPATCH_STAMPED_STATIC_PIPELINE_ONLY' as const;
export const COMMAND_DISPATCH_TOPOLOGY_INTEGRATION_STRATEGY = 'OVERLAY' as const;
export const COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY = 'NONE' as const;
export const COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER = 'NONE' as const;
export const COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT = 'NONE' as const;
export const COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE = 'NONE' as const;
export const COMMAND_DISPATCH_TOPOLOGY_BASELINE_CHANGE = 'NONE' as const;
export const COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE = 'NOT_CLAIMED' as const;
export const COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT =
	'REFERENCE_EXISTING_GRAPH_WITHOUT_DUPLICATION' as const;
export const COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION = 'NOT_INTEGRATED' as const;
export const COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY =
	'RETAIN_DELEGATED' as const;
export const COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION = 'NOT_EXECUTED_BY_CSAA' as const;
export const COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE = 'NOT_CLAIMED' as const;
export const COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY = 'NOT_CLAIMED' as const;
export const COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;
export const COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH =
	'packages/rph-application/src/command-bus.ts' as const;
export const COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH =
	'packages/rph-application/tsconfig.json' as const;
export const COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME = 'dispatchStamped' as const;
export const COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH =
	'verif/command-dispatch-census.test.ts' as const;

declare const commandDispatchTopologyBrand: unique symbol;
export type CommandDispatchTopologyGraphId = string & {
	readonly [commandDispatchTopologyBrand]: 'CommandDispatchTopologyGraph';
};
export type CommandDispatchTopologyLayerId = string & {
	readonly [commandDispatchTopologyBrand]: 'CommandDispatchTopologyLayer';
};
export type CommandDispatchTopologyNodeId = string & {
	readonly [commandDispatchTopologyBrand]: 'CommandDispatchTopologyNode';
};
export type CommandDispatchTopologyEdgeId = string & {
	readonly [commandDispatchTopologyBrand]: 'CommandDispatchTopologyEdge';
};

/** Exact caller-selected JPWB command-bus method; selection itself is evidence. */
export interface CommandDispatchTopologyCommandBusSelector {
	readonly contentSha256: string;
	readonly declarationId: SemanticDeclarationId;
	readonly logicalPath: typeof COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_LOGICAL_PATH;
	readonly methodName: typeof COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME;
	readonly programId: SemanticProgramId;
	readonly projectConfigPath: typeof COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_PROJECT_CONFIG_PATH;
	readonly projectId: SemanticProjectId;
	readonly sourceId: SemanticSourceId;
}

/** Caller-supplied operation guards, never product capacity ceilings or SLOs. */
export interface CommandDispatchTopologyBudgets {
	readonly maxAstNodes: number;
	readonly maxDiagnostics: number;
	readonly maxEdges: number;
	readonly maxHandlerTargets: number;
	readonly maxNodes: number;
	readonly maxSourceBytes: number;
}

export interface BuildCommandDispatchTopologyRequest {
	readonly budgets: CommandDispatchTopologyBudgets;
	readonly commandBus: CommandDispatchTopologyCommandBusSelector;
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly operationVersion: typeof COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION;
	readonly schemaVersion: typeof COMMAND_DISPATCH_TOPOLOGY_REQUEST_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

/**
 * The complete input identity surface for the operation. Implementations may expose these as
 * separate parameters, but MUST validate every request identity against these exact inputs.
 */
export interface CommandDispatchTopologyBuildInputs {
	readonly arrowObservation: ArrowCommandCensusObservation;
	readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
	readonly request: BuildCommandDispatchTopologyRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
	readonly subject: FrozenSubject;
}

export interface CommandDispatchTopologySourceLocation {
	readonly end: number;
	readonly sourceId: SemanticSourceId;
	readonly start: number;
}

export interface CommandDispatchLookupSemanticBinding {
	readonly assignmentNodeId: SemanticNodeId;
	readonly commandTypeReferenceId: SemanticReferenceId;
	readonly registryName: 'COMMANDS' | 'HANDLERS';
	readonly registryReferenceId: SemanticReferenceId;
	readonly targetNodeId: SemanticNodeId;
	readonly valueNodeId: SemanticNodeId;
}

export interface CommandDispatchInvocationSemanticBinding {
	readonly calleeNodeId: SemanticNodeId;
	readonly calleeReferenceId: SemanticReferenceId;
	readonly invocationId: SemanticInvocationSiteId;
	readonly invocationNodeId: SemanticNodeId;
}

export interface CommandDispatchPayloadValidationSemanticBinding extends CommandDispatchInvocationSemanticBinding {
	readonly commandPayloadArgumentNodeId: SemanticNodeId;
	readonly parsedValueNodeId: SemanticNodeId;
	readonly schemaArgumentNodeId: SemanticNodeId;
}

export interface CommandDispatchMissingHandlerGuardSemanticBinding {
	readonly conditionNodeId: SemanticNodeId;
	readonly guardedHandlerReferenceId: SemanticReferenceId;
	readonly guardedHandlerValueNodeId: SemanticNodeId;
	readonly guardStatementNodeId: SemanticNodeId;
}

export interface CommandDispatchHandlerInvocationSemanticBinding extends CommandDispatchInvocationSemanticBinding {
	readonly commandArgumentNodeId: SemanticNodeId;
	readonly contextArgumentNodeId: SemanticNodeId;
	readonly parsedPayloadArgumentNodeId: SemanticNodeId;
}

export interface CommandDispatchPipelineNode {
	readonly attribution: 'EXACT_STATIC_SYNTAX';
	readonly commandBusDeclarationId: SemanticDeclarationId;
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly commandsLookup: CommandDispatchLookupSemanticBinding & {
		readonly registryName: 'COMMANDS';
	};
	readonly graphId: CommandDispatchTopologyGraphId;
	readonly handlerInvocation: CommandDispatchHandlerInvocationSemanticBinding;
	readonly handlersLookup: CommandDispatchLookupSemanticBinding & {
		readonly registryName: 'HANDLERS';
	};
	readonly id: CommandDispatchTopologyNodeId;
	readonly kind: 'STATIC_DISPATCH_PIPELINE';
	readonly layerId: CommandDispatchTopologyLayerId;
	readonly methodName: typeof COMMAND_DISPATCH_TOPOLOGY_COMMAND_BUS_METHOD_NAME;
	readonly missingHandlerGuard: CommandDispatchMissingHandlerGuardSemanticBinding;
	readonly payloadValidationInvocation: CommandDispatchPayloadValidationSemanticBinding;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceId: SemanticSourceId;
	readonly sourceLocations: readonly CommandDispatchTopologySourceLocation[];
	readonly subjectId: string;
}

export type CommandDispatchTopologyNode = CommandDispatchPipelineNode;

export interface CommandDispatchTopologyInferenceBasis {
	readonly assumptions: readonly string[];
	readonly limitationKinds: readonly CommandDispatchTopologyLimitationKind[];
	readonly method: typeof COMMAND_DISPATCH_TOPOLOGY_METHOD;
	readonly rationale: string;
	readonly supportingInputIds: readonly string[];
}

export interface CommandDispatchTopologyOverlayEndpoint {
	readonly graphId: CommandDispatchTopologyGraphId;
	readonly kind: 'STATIC_DISPATCH_PIPELINE';
	readonly nodeId: CommandDispatchTopologyNodeId;
}

export interface CommandDispatchTopologyHandlerTargetEndpoint {
	readonly graphId: CommandHandlerGraphId;
	readonly kind: 'HANDLER_TARGET';
	readonly nodeId: CommandHandlerGraphNodeId;
}

/** Candidate cross-graph relation; the existing HANDLER_TARGET node is referenced, never copied. */
export interface CommandDispatchTopologyHandlerTargetEdge {
	readonly attribution: 'CANDIDATE';
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly graphId: CommandDispatchTopologyGraphId;
	readonly id: CommandDispatchTopologyEdgeId;
	readonly inferenceBasis: CommandDispatchTopologyInferenceBasis;
	readonly layerId: CommandDispatchTopologyLayerId;
	readonly method: typeof COMMAND_DISPATCH_TOPOLOGY_METHOD;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly registeredCommandNames: readonly string[];
	readonly relationCode: 'IMPL-JPWB-CD-DISPATCH-TARGET-001';
	readonly relationKind: 'STATIC_DISPATCH_PIPELINE_TO_HANDLER_TARGET';
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly source: CommandDispatchTopologyOverlayEndpoint;
	readonly sourceLocations: readonly CommandDispatchTopologySourceLocation[];
	readonly subjectId: string;
	readonly target: CommandDispatchTopologyHandlerTargetEndpoint;
}

export type CommandDispatchTopologyEdge = CommandDispatchTopologyHandlerTargetEdge;
export type CommandDispatchTopologyRelationCode = CommandDispatchTopologyEdge['relationCode'];
export type CommandDispatchTopologyRelationKind = CommandDispatchTopologyEdge['relationKind'];

export type CommandDispatchTopologyLimitationKind =
	| 'COMMAND_HANDLER_GRAPH_PARTIALITY_INHERITED'
	| 'COMMAND_HANDLER_POPULATIONS_REFERENCED_NOT_REBUILT'
	| 'COMMAND_SPEC_REGISTRY_EQUIVALENCE_UNPROVEN'
	| 'CONTROL_FLOW_AND_PATH_FEASIBILITY_NOT_ANALYZED'
	| 'DISPATCH_PIPELINE_SCOPE_IS_IMPLEMENTATION_LOCAL'
	| 'HANDLER_TARGET_EDGES_ARE_CANDIDATE_ONLY'
	| 'MISSING_HANDLER_GUARD_EXECUTION_NOT_PROVEN'
	| 'PAYLOAD_VALIDATION_SUCCESS_NOT_PROVEN'
	| 'RELATION_REGISTRY_UNAVAILABLE'
	| 'RETAINED_COMMAND_DISPATCH_CENSUS_NOT_EXECUTED'
	| 'RETAINED_COMMAND_DISPATCH_CENSUS_NOT_RUNTIME_PROOF'
	| 'RUNTIME_DISPATCH_NOT_CLAIMED'
	| 'RUNTIME_PERFORMABILITY_NOT_CLAIMED';

export interface CommandDispatchTopologyLimitation {
	readonly kind: CommandDispatchTopologyLimitationKind;
	readonly reason: string;
}

export const COMMAND_DISPATCH_TOPOLOGY_LIMITATIONS = [
	{
		kind: 'COMMAND_HANDLER_GRAPH_PARTIALITY_INHERITED',
		reason:
			'This overlay consumes a PARTIAL command-handler graph and cannot strengthen its handler-target or registry closure claims.'
	},
	{
		kind: 'COMMAND_HANDLER_POPULATIONS_REFERENCED_NOT_REBUILT',
		reason:
			'Command registry entries, handler registrations, and handler targets remain owned by the input command-handler graph; this overlay references them without duplication.'
	},
	{
		kind: 'COMMAND_SPEC_REGISTRY_EQUIVALENCE_UNPROVEN',
		reason:
			'The application Program may resolve COMMANDS through built declaration output while the predecessor graph owns the source registry in the contracts Program; this overlay does not claim a cross-Program declaration-equivalence proof.'
	},
	{
		kind: 'CONTROL_FLOW_AND_PATH_FEASIBILITY_NOT_ANALYZED',
		reason:
			'Lexically ordered semantic bindings do not establish control-flow reachability, branch feasibility, exception behavior, or data-flow identity.'
	},
	{
		kind: 'DISPATCH_PIPELINE_SCOPE_IS_IMPLEMENTATION_LOCAL',
		reason:
			'The projection is bounded to the selected JPWB dispatchStamped method and does not establish the absence of alternate dispatch routes, wrappers, or dynamic invocations.'
	},
	{
		kind: 'HANDLER_TARGET_EDGES_ARE_CANDIDATE_ONLY',
		reason:
			'Candidate edges enumerate statically registered handler targets that the selected lookup can address; they do not prove which target a runtime command reaches.'
	},
	{
		kind: 'MISSING_HANDLER_GUARD_EXECUTION_NOT_PROVEN',
		reason:
			'The missing-handler guard is statically represented, but its runtime evaluation and rejection behavior are not executed or proven.'
	},
	{
		kind: 'PAYLOAD_VALIDATION_SUCCESS_NOT_PROVEN',
		reason:
			'The payload-validation invocation is statically represented; schema correctness, validation success, and parsed-value identity are not runtime claims.'
	},
	{
		kind: 'RELATION_REGISTRY_UNAVAILABLE',
		reason:
			'The closed JAN-CSAA-002/007 relation registry has no command-dispatch relation family; the relation code is implementation-local and full conformance is not claimed.'
	},
	{
		kind: 'RETAINED_COMMAND_DISPATCH_CENSUS_NOT_EXECUTED',
		reason:
			'CSAA preserves a subject-bound reference to the retained command-dispatch census but does not execute, normalize, replace, or integrate it.'
	},
	{
		kind: 'RETAINED_COMMAND_DISPATCH_CENSUS_NOT_RUNTIME_PROOF',
		reason:
			'The retained census searches executable test text for command-name literals; even its independent PASS is a floor, not proof that runtime dispatch was attempted or accepted.'
	},
	{
		kind: 'RUNTIME_DISPATCH_NOT_CLAIMED',
		reason:
			'Static lookup, guard, validation, and invocation syntax do not establish runtime dispatch closure.'
	},
	{
		kind: 'RUNTIME_PERFORMABILITY_NOT_CLAIMED',
		reason:
			'Static topology does not prove authentication, validation, preconditions, guards, persistence, events, or successful command execution.'
	}
] as const satisfies readonly CommandDispatchTopologyLimitation[];

export interface RetainedCommandDispatchCensusReference {
	readonly artifactBytes: number;
	readonly artifactContentSha256: string;
	readonly artifactPath: typeof COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_PATH;
	readonly authorityTransfer: typeof COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER;
	readonly execution: typeof COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_EXECUTION;
	readonly gateEffect: typeof COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT;
	readonly integration: typeof COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION;
	readonly oracleChange: typeof COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE;
	readonly replacementEquivalence: typeof COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE;
	readonly verifierAuthority: typeof COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_VERIFIER_AUTHORITY;
}

export interface CommandDispatchTopologyCoverage {
	readonly candidateHandlerTargetEdges: number;
	readonly commandHandlerGraphHandlerTargets: number;
	readonly commandsLookupAssignments: 1;
	readonly duplicatedCommandHandlerNodes: 0;
	readonly duplicatedCommandRegistryEntries: 0;
	readonly duplicatedHandlerRegistrations: 0;
	readonly handlerInvocations: 1;
	readonly handlersLookupAssignments: 1;
	readonly missingHandlerGuards: 1;
	readonly payloadValidationInvocations: 1;
	readonly pipelineNodes: 1;
	readonly reconciles: boolean;
	readonly referencedHandlerTargets: number;
	readonly representedPipelineFacts: 5;
	readonly unresolvedHandlerTargets: number;
}

export type CommandDispatchTopologyIndexEntry =
	| {
			readonly edgeIds: readonly CommandDispatchTopologyEdgeId[];
			readonly endpointOwner: 'COMMAND_DISPATCH_TOPOLOGY';
			readonly graphId: CommandDispatchTopologyGraphId;
			readonly nodeId: CommandDispatchTopologyNodeId;
	  }
	| {
			readonly edgeIds: readonly CommandDispatchTopologyEdgeId[];
			readonly endpointOwner: 'COMMAND_HANDLER_GRAPH';
			readonly graphId: CommandHandlerGraphId;
			readonly nodeId: CommandHandlerGraphNodeId;
	  };

interface CommandDispatchTopologyLayerBase {
	readonly capabilityStatus: typeof COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS;
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly coverage: CommandDispatchTopologyCoverage;
	readonly graphId: CommandDispatchTopologyGraphId;
	readonly id: CommandDispatchTopologyLayerId;
	readonly limitations: readonly CommandDispatchTopologyLimitation[];
	readonly method: typeof COMMAND_DISPATCH_TOPOLOGY_METHOD;
	readonly producer: SemanticProviderIdentity;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly registryStatus: typeof COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type CommandDispatchTopologyLayer =
	| (CommandDispatchTopologyLayerBase & {
			readonly capability: typeof COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY;
			readonly edgeIds: readonly [];
			readonly kind: 'JPWB_COMMAND_DISPATCH_DERIVATION';
			readonly nodeIds: readonly [CommandDispatchTopologyNodeId];
			readonly ordinal: 0;
	  })
	| (CommandDispatchTopologyLayerBase & {
			readonly capability: typeof COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY;
			readonly edgeIds: readonly CommandDispatchTopologyEdgeId[];
			readonly kind: 'JPWB_COMMAND_DISPATCH_HANDLER_TARGET_INFERENCE';
			readonly nodeIds: readonly [];
			readonly ordinal: 1;
	  });

export interface CommandDispatchTopologySnapshot {
	readonly arrowObservationContentDigest: string;
	readonly arrowObservationId: ArrowCommandCensusObservation['id'];
	readonly authorityTransfer: typeof COMMAND_DISPATCH_TOPOLOGY_AUTHORITY_TRANSFER;
	readonly baselineChange: typeof COMMAND_DISPATCH_TOPOLOGY_BASELINE_CHANGE;
	readonly budgets: CommandDispatchTopologyBudgets;
	readonly canonicalProfile: typeof COMMAND_DISPATCH_TOPOLOGY_CANONICAL_PROFILE;
	readonly capabilities: readonly [
		typeof COMMAND_DISPATCH_TOPOLOGY_DERIVATION_CAPABILITY,
		typeof COMMAND_DISPATCH_TOPOLOGY_INFERENCE_CAPABILITY
	];
	readonly capabilityStatus: typeof COMMAND_DISPATCH_TOPOLOGY_CAPABILITY_STATUS;
	readonly commandBus: CommandDispatchTopologyCommandBusSelector;
	readonly commandHandlerGraphContentDigest: string;
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly commandHandlerGraphSchemaVersion: CommandHandlerGraphSnapshot['schemaVersion'];
	readonly commandHandlerPopulationTreatment: typeof COMMAND_DISPATCH_TOPOLOGY_COMMAND_HANDLER_POPULATION_TREATMENT;
	readonly contentDigest: string;
	readonly coverage: CommandDispatchTopologyCoverage;
	readonly edges: readonly CommandDispatchTopologyEdge[];
	readonly forwardIndex: readonly CommandDispatchTopologyIndexEntry[];
	readonly fullJanCsaa007Conformance: typeof COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof COMMAND_DISPATCH_TOPOLOGY_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly gateEffect: typeof COMMAND_DISPATCH_TOPOLOGY_GATE_EFFECT;
	readonly graphAuthority: typeof COMMAND_DISPATCH_TOPOLOGY_GRAPH_AUTHORITY;
	readonly graphInputDigest: string;
	readonly graphKind: 'JPWB_COMMAND_DISPATCH_STATIC_TOPOLOGY_OVERLAY';
	readonly health: 'PARTIAL';
	readonly id: CommandDispatchTopologyGraphId;
	readonly integrationStrategy: typeof COMMAND_DISPATCH_TOPOLOGY_INTEGRATION_STRATEGY;
	readonly layers: readonly [CommandDispatchTopologyLayer, CommandDispatchTopologyLayer];
	readonly limitations: readonly CommandDispatchTopologyLimitation[];
	readonly method: typeof COMMAND_DISPATCH_TOPOLOGY_METHOD;
	readonly nodes: readonly [CommandDispatchPipelineNode];
	readonly operationVersion: typeof COMMAND_DISPATCH_TOPOLOGY_OPERATION_VERSION;
	readonly oracleChange: typeof COMMAND_DISPATCH_TOPOLOGY_ORACLE_CHANGE;
	readonly producer: SemanticProviderIdentity;
	readonly registryStatus: typeof COMMAND_DISPATCH_TOPOLOGY_REGISTRY_STATUS;
	readonly replacementEquivalence: typeof COMMAND_DISPATCH_TOPOLOGY_REPLACEMENT_EQUIVALENCE;
	readonly retainedCommandDispatchCensus: RetainedCommandDispatchCensusReference;
	readonly retainedCommandDispatchCensusIntegration: typeof COMMAND_DISPATCH_TOPOLOGY_RETAINED_CENSUS_INTEGRATION;
	readonly reverseIndex: readonly CommandDispatchTopologyIndexEntry[];
	readonly runtimeDispatchClosure: typeof COMMAND_DISPATCH_TOPOLOGY_RUNTIME_DISPATCH_CLOSURE;
	readonly runtimePerformability: typeof COMMAND_DISPATCH_TOPOLOGY_RUNTIME_PERFORMABILITY;
	readonly schemaVersion: typeof COMMAND_DISPATCH_TOPOLOGY_SCHEMA_VERSION;
	readonly scope: typeof COMMAND_DISPATCH_TOPOLOGY_SCOPE;
	readonly semanticExtractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly semanticSchemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type CommandDispatchTopologyBuildDiagnosticCode =
	| 'ARROW_OBSERVATION_MISMATCH'
	| 'BUDGET_EXCEEDED'
	| 'COMMAND_BUS_SELECTOR_MISMATCH'
	| 'COMMAND_HANDLER_GRAPH_ID_MISMATCH'
	| 'COMMAND_HANDLER_GRAPH_INVALID'
	| 'GRAPH_PARTIAL'
	| 'GRAPH_VALIDATION_FAILED'
	| 'INPUT_POPULATION_DUPLICATED'
	| 'REQUEST_INVALID'
	| 'RETAINED_CENSUS_ARTIFACT_MISMATCH'
	| 'SEMANTIC_CAPABILITY_UNAVAILABLE'
	| 'SEMANTIC_SNAPSHOT_ID_MISMATCH'
	| 'SUBJECT_ID_MISMATCH'
	| 'UNSUPPORTED_DISPATCH_PIPELINE';

export interface CommandDispatchTopologyBuildDiagnostic {
	readonly code: CommandDispatchTopologyBuildDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'BIND' | 'CLASSIFY' | 'PROJECT' | 'REQUEST' | 'VALIDATE';
}

export type CommandDispatchTopologyBuildOutcome =
	| {
			readonly diagnostics: readonly CommandDispatchTopologyBuildDiagnostic[];
			readonly graph: CommandDispatchTopologySnapshot;
			readonly outcome: 'partial';
	  }
	| {
			readonly diagnostics: readonly CommandDispatchTopologyBuildDiagnostic[];
			readonly graph?: never;
			readonly outcome: 'unavailable';
	  };

export type CommandDispatchTopologyValidationIssueCode =
	| 'CONTENT_DIGEST_MISMATCH'
	| 'GRAPH_ID_MISMATCH'
	| 'INPUT_BINDING_MISMATCH'
	| 'INVALID_SHAPE'
	| 'INVALID_VALUE'
	| 'NONCANONICAL_ORDER'
	| 'POPULATION_DUPLICATION'
	| 'POPULATION_MISMATCH'
	| 'RECONCILIATION_MISMATCH'
	| 'SELECTOR_MISMATCH'
	| 'UNSUPPORTED_SCHEMA_VERSION'
	| 'VALIDATION_BUDGET_EXHAUSTED';

export interface CommandDispatchTopologyValidationIssue {
	readonly code: CommandDispatchTopologyValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface CommandDispatchTopologyValidationOptions {
	readonly maxIssues?: number;
	/** Plain-data traversal guard; never a product capacity ceiling or SLO. */
	readonly maxRecords?: number;
	/** Plain-data traversal string guard; never a product capacity ceiling or SLO. */
	readonly maxStringCharacters?: number;
}

export type CommandDispatchTopologyValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly CommandDispatchTopologyValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };
