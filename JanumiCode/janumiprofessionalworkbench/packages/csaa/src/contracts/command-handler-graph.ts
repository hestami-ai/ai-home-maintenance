import type {
	ArrowCommandCensusDeclaredArrowId,
	ArrowCommandCensusDeclaredSiteId,
	ArrowCommandCensusObservationId,
	ArrowCommandCensusSourceSite
} from './arrow-command-census.js';
import type {
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

export const COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION =
	'jan-csaa-command-handler-graph-request/1.0.0' as const;
export const COMMAND_HANDLER_GRAPH_SCHEMA_VERSION = 'jan-csaa-command-handler-graph/1.0.0' as const;
export const COMMAND_HANDLER_GRAPH_OPERATION_VERSION =
	'jan-csaa-build-command-handler-graph/0.1.0' as const;
export const COMMAND_HANDLER_GRAPH_CANONICAL_PROFILE =
	'jan-csaa-command-handler-graph-canonical/1.0.0' as const;
export const COMMAND_HANDLER_GRAPH_METHOD =
	'jpwb-normalized-command-registry-and-retained-arrow-projection/1.0.0' as const;
export const COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY = 'JAN-CSAA-CAP-027' as const;
export const COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY = 'JAN-CSAA-CAP-028' as const;
export const COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS = 'PARTIAL' as const;
export const COMMAND_HANDLER_GRAPH_REGISTRY_STATUS = 'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const COMMAND_HANDLER_GRAPH_SCOPE =
	'DECLARED_STATIC_REGISTRIES_AND_RETAINED_ARROW_SITES_ONLY' as const;
export const COMMAND_HANDLER_GRAPH_RETAINED_ARROW_VERIFIER_AUTHORITY =
	'RETAINED_DELEGATED' as const;
export const COMMAND_HANDLER_GRAPH_GRAPH_AUTHORITY = 'NONE' as const;
export const COMMAND_HANDLER_GRAPH_AUTHORITY_TRANSFER = 'NONE' as const;
export const COMMAND_HANDLER_GRAPH_INTEGRATION_STRATEGY = 'OVERLAY' as const;
export const COMMAND_HANDLER_GRAPH_GATE_EFFECT = 'NONE' as const;
export const COMMAND_HANDLER_GRAPH_ORACLE_CHANGE = 'NONE' as const;
export const COMMAND_HANDLER_GRAPH_BASELINE_CHANGE = 'NONE' as const;
export const COMMAND_HANDLER_GRAPH_REPLACEMENT_EQUIVALENCE = 'NOT_CLAIMED' as const;
export const COMMAND_HANDLER_GRAPH_COMMAND_DISPATCH_CENSUS_INTEGRATION = 'NOT_INTEGRATED' as const;
export const COMMAND_HANDLER_GRAPH_RUNTIME_DISPATCH_CLOSURE = 'NOT_CLAIMED' as const;
export const COMMAND_HANDLER_GRAPH_RUNTIME_PERFORMABILITY = 'NOT_CLAIMED' as const;
export const COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;

declare const commandHandlerGraphBrand: unique symbol;
export type CommandHandlerGraphId = string & {
	readonly [commandHandlerGraphBrand]: 'CommandHandlerGraph';
};
export type CommandHandlerGraphLayerId = string & {
	readonly [commandHandlerGraphBrand]: 'CommandHandlerGraphLayer';
};
export type CommandHandlerGraphNodeId = string & {
	readonly [commandHandlerGraphBrand]: 'CommandHandlerGraphNode';
};
export type CommandHandlerGraphEdgeId = string & {
	readonly [commandHandlerGraphBrand]: 'CommandHandlerGraphEdge';
};

/** Exact caller-selected semantic registry root; selection itself is evidence. */
export interface CommandHandlerRegistrySelector {
	readonly contentSha256: string;
	readonly declarationId: SemanticDeclarationId;
	readonly exportName: 'COMMANDS' | 'HANDLERS';
	readonly logicalPath: string;
	readonly programId: SemanticProgramId;
	readonly projectConfigPath: string;
	readonly projectId: SemanticProjectId;
	readonly sourceId: SemanticSourceId;
}

/** Caller-supplied operation guards, never product ceilings or SLOs. */
export interface CommandHandlerGraphBudgets {
	readonly maxAstNodes: number;
	readonly maxCommandRegistryEntries: number;
	readonly maxEdges: number;
	readonly maxFrontiers: number;
	readonly maxHandlerRegistryEntries: number;
	readonly maxNodes: number;
	readonly maxSourceBytes: number;
}

export interface BuildCommandHandlerGraphRequest {
	readonly arrowObservationId: ArrowCommandCensusObservationId;
	readonly budgets: CommandHandlerGraphBudgets;
	readonly commandRegistry: CommandHandlerRegistrySelector;
	readonly handlerRegistry: CommandHandlerRegistrySelector;
	readonly operationVersion: typeof COMMAND_HANDLER_GRAPH_OPERATION_VERSION;
	readonly schemaVersion: typeof COMMAND_HANDLER_GRAPH_REQUEST_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export interface CommandHandlerGraphSourceLocation {
	readonly end: number;
	readonly sourceId: SemanticSourceId;
	readonly start: number;
}

interface CommandHandlerGraphNodeBase {
	readonly graphId: CommandHandlerGraphId;
	readonly id: CommandHandlerGraphNodeId;
	readonly layerId: CommandHandlerGraphLayerId;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceLocations: readonly CommandHandlerGraphSourceLocation[];
	readonly subjectId: string;
}

export interface CommandRegistryEntryNode extends CommandHandlerGraphNodeBase {
	readonly commandName: string;
	readonly declarationId: SemanticDeclarationId | null;
	readonly kind: 'COMMAND_REGISTRY_ENTRY';
	readonly nameNodeId: SemanticNodeId;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly propertyNodeId: SemanticNodeId;
	readonly sourceId: SemanticSourceId;
}

export interface HandlerRegistrationNode extends CommandHandlerGraphNodeBase {
	readonly commandName: string;
	readonly handlerAliasSymbolId: SemanticSymbolId | null;
	readonly handlerName: string;
	readonly handlerTerminalSymbolId: SemanticSymbolId | null;
	readonly kind: 'HANDLER_REGISTRATION';
	readonly nameNodeId: SemanticNodeId;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly propertyNodeId: SemanticNodeId;
	readonly sourceId: SemanticSourceId;
	readonly targetNodeId: SemanticNodeId;
	readonly targetReferenceId: SemanticReferenceId | null;
}

export interface HandlerTargetNode extends CommandHandlerGraphNodeBase {
	readonly bodyKind: 'DIRECT_FUNCTION' | 'FACTORY_CALL_RESULT_CANDIDATE';
	readonly declarationIds: readonly SemanticDeclarationId[];
	readonly handlerName: string;
	readonly kind: 'HANDLER_TARGET';
	readonly nodeId: SemanticNodeId;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly sourceId: SemanticSourceId;
	readonly symbolId: SemanticSymbolId;
}

export interface CommandArrowSiteNode extends CommandHandlerGraphNodeBase {
	readonly attribution: 'DIRECT_HANDLER' | 'FACTORY_SHARED' | 'TABLE_COMMAND' | 'UNRESOLVED';
	readonly kind: 'DECLARED_ARROW_SITE';
	readonly observationSiteId: ArrowCommandCensusDeclaredSiteId;
	readonly observationSource: ArrowCommandCensusSourceSite;
	readonly semanticSiteNodeId: SemanticNodeId | null;
	readonly sourceId: SemanticSourceId | null;
}

export interface CommandArrowOccurrenceNode extends CommandHandlerGraphNodeBase {
	readonly arrowKey: string;
	readonly from: string;
	readonly kind: 'DECLARED_ARROW_OCCURRENCE';
	readonly machine: string;
	readonly observationArrowId: ArrowCommandCensusDeclaredArrowId;
	readonly observationSiteId: ArrowCommandCensusDeclaredSiteId;
	readonly ordinalAtSite: number;
	readonly to: string;
}

interface CommandHandlerFrontierBase extends CommandHandlerGraphNodeBase {
	readonly kind: 'FRONTIER';
	readonly reason: string;
}

export type CommandHandlerFrontierNode =
	| (CommandHandlerFrontierBase & {
			readonly commandNodeId: CommandHandlerGraphNodeId;
			readonly frontierKind:
				'COMMAND_WITHOUT_DECLARED_ARROW_EVIDENCE' | 'MISSING_HANDLER_REGISTRATION';
	  })
	| (CommandHandlerFrontierBase & {
			readonly frontierKind:
				| 'FACTORY_HANDLER_TARGET_NOT_CONFIRMED'
				| 'UNDECLARED_HANDLER_REGISTRATION'
				| 'UNRESOLVED_HANDLER_TARGET';
			readonly registrationNodeId: CommandHandlerGraphNodeId;
	  })
	| (CommandHandlerFrontierBase & {
			readonly frontierKind:
				'FACTORY_SITE_ATTRIBUTION_AMBIGUOUS' | 'SITE_OWNER_NOT_REGISTERED_HANDLER';
			readonly siteNodeId: CommandHandlerGraphNodeId;
	  });

export type CommandHandlerFrontierKind = CommandHandlerFrontierNode['frontierKind'];

export type CommandHandlerGraphNode =
	| CommandRegistryEntryNode
	| HandlerRegistrationNode
	| HandlerTargetNode
	| CommandArrowSiteNode
	| CommandArrowOccurrenceNode
	| CommandHandlerFrontierNode;

export interface CommandHandlerGraphEndpoint<Kind extends CommandHandlerGraphNode['kind']> {
	readonly kind: Kind;
	readonly nodeId: CommandHandlerGraphNodeId;
}

export interface CommandHandlerInferenceBasis {
	readonly assumptions: readonly string[];
	readonly limitationKinds: readonly CommandHandlerGraphLimitationKind[];
	readonly method: typeof COMMAND_HANDLER_GRAPH_METHOD;
	readonly rationale: string;
	readonly supportingInputIds: readonly string[];
}

interface CommandHandlerGraphEdgeBase {
	readonly graphId: CommandHandlerGraphId;
	readonly id: CommandHandlerGraphEdgeId;
	readonly layerId: CommandHandlerGraphLayerId;
	readonly method: typeof COMMAND_HANDLER_GRAPH_METHOD;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly sourceLocations: readonly CommandHandlerGraphSourceLocation[];
	readonly subjectId: string;
}

interface ExactEdgeBase extends CommandHandlerGraphEdgeBase {
	readonly attribution: 'EXACT';
	readonly inferenceBasis: null;
}

interface CandidateEdgeBase extends CommandHandlerGraphEdgeBase {
	readonly attribution: 'CANDIDATE';
	readonly inferenceBasis: CommandHandlerInferenceBasis;
}

export type CommandHandlerGraphEdge =
	| (ExactEdgeBase & {
			readonly relationCode: 'IMPL-JPWB-CH-COMMAND-REGISTRATION-001';
			readonly relationKind: 'COMMAND_REGISTRY_ENTRY_TO_HANDLER_REGISTRATION';
			readonly source: CommandHandlerGraphEndpoint<'COMMAND_REGISTRY_ENTRY'>;
			readonly target: CommandHandlerGraphEndpoint<'HANDLER_REGISTRATION'>;
	  })
	| ((ExactEdgeBase | CandidateEdgeBase) & {
			readonly relationCode: 'IMPL-JPWB-CH-REGISTRATION-TARGET-001';
			readonly relationKind: 'HANDLER_REGISTRATION_TO_TARGET';
			readonly source: CommandHandlerGraphEndpoint<'HANDLER_REGISTRATION'>;
			readonly target: CommandHandlerGraphEndpoint<'HANDLER_TARGET'>;
	  })
	| ((ExactEdgeBase | CandidateEdgeBase) & {
			readonly relationCode: 'IMPL-JPWB-CH-TARGET-ARROW-SITE-001';
			readonly relationKind: 'HANDLER_TARGET_TO_ARROW_SITE';
			readonly source: CommandHandlerGraphEndpoint<'HANDLER_TARGET'>;
			readonly target: CommandHandlerGraphEndpoint<'DECLARED_ARROW_SITE'>;
	  })
	| (ExactEdgeBase & {
			readonly relationCode: 'IMPL-JPWB-CH-COMMAND-TABLE-SITE-001';
			readonly relationKind: 'COMMAND_REGISTRY_ENTRY_TO_TABLE_ARROW_SITE';
			readonly source: CommandHandlerGraphEndpoint<'COMMAND_REGISTRY_ENTRY'>;
			readonly target: CommandHandlerGraphEndpoint<'DECLARED_ARROW_SITE'>;
	  })
	| (ExactEdgeBase & {
			readonly relationCode: 'IMPL-JPWB-CH-SITE-ARROW-001';
			readonly relationKind: 'ARROW_SITE_TO_OCCURRENCE';
			readonly source: CommandHandlerGraphEndpoint<'DECLARED_ARROW_SITE'>;
			readonly target: CommandHandlerGraphEndpoint<'DECLARED_ARROW_OCCURRENCE'>;
	  });

export type CommandHandlerGraphRelationKind = CommandHandlerGraphEdge['relationKind'];
export type CommandHandlerGraphRelationCode = CommandHandlerGraphEdge['relationCode'];

export type CommandHandlerGraphLimitationKind =
	| 'ARROW_CENSUS_HANDLER_JOIN_IS_OVERLAY_ONLY'
	| 'COMMANDS_WITHOUT_ARROW_EVIDENCE_ARE_NOT_EFFECT_FREE'
	| 'FACTORY_ARROW_ATTRIBUTION_OPEN'
	| 'GUARDS_EFFECTS_EVENTS_NOT_ANALYZED'
	| 'RELATION_REGISTRY_UNAVAILABLE'
	| 'RETAINED_BASELINE_MATCH_NOT_CORRECTNESS_PROOF'
	| 'RETAINED_SUPPORTED_IDIOMS_BOUNDED'
	| 'RETAINED_SUBJECT_INITIALIZERS_MAY_EXECUTE'
	| 'RETAINED_VERIFIER_AUTHORITY_UNCHANGED'
	| 'RUNTIME_DISPATCH_NOT_ANALYZED'
	| 'RUNTIME_PERFORMABILITY_NOT_CLAIMED';

export interface CommandHandlerGraphLimitation {
	readonly kind: CommandHandlerGraphLimitationKind;
	readonly reason: string;
}

export const COMMAND_HANDLER_GRAPH_LIMITATIONS = [
	{
		kind: 'ARROW_CENSUS_HANDLER_JOIN_IS_OVERLAY_ONLY',
		reason:
			'This projection adds a separately validated registry join without rewriting the retained arrow observation or removing its NO_HANDLER_REGISTRY_JOIN limitation.'
	},
	{
		kind: 'COMMANDS_WITHOUT_ARROW_EVIDENCE_ARE_NOT_EFFECT_FREE',
		reason:
			'Absence from the retained transition-declaration census does not prove that a command has no handler, effect, event, or state mutation.'
	},
	{
		kind: 'FACTORY_ARROW_ATTRIBUTION_OPEN',
		reason:
			'Retained factory inference may pool literals from multiple factory instances, so shared factory sites remain candidate attribution with explicit frontiers.'
	},
	{
		kind: 'GUARDS_EFFECTS_EVENTS_NOT_ANALYZED',
		reason:
			'This increment does not close command payload reads, guards, emitted events, persistence writes, or other handler effects.'
	},
	{
		kind: 'RELATION_REGISTRY_UNAVAILABLE',
		reason:
			'The closed JAN-CSAA-002/007 relation registry has no command-handler relation family; all relation codes here are implementation-local and full conformance is not claimed.'
	},
	{
		kind: 'RETAINED_BASELINE_MATCH_NOT_CORRECTNESS_PROOF',
		reason:
			'The upstream retained observation baseline match proves exact non-regression only, not correctness.'
	},
	{
		kind: 'RETAINED_SUPPORTED_IDIOMS_BOUNDED',
		reason:
			'The upstream retained observation covers only its documented declaration idioms and cannot establish absence outside them.'
	},
	{
		kind: 'RETAINED_SUBJECT_INITIALIZERS_MAY_EXECUTE',
		reason:
			'The upstream retained verifier imports subject packages in an isolated process; this projection preserves that evidence limitation.'
	},
	{
		kind: 'RETAINED_VERIFIER_AUTHORITY_UNCHANGED',
		reason:
			'The retained arrow census and command-dispatch census keep their delegated authority, oracle, gate, and replacement status.'
	},
	{
		kind: 'RUNTIME_DISPATCH_NOT_ANALYZED',
		reason:
			'Static agreement between declared registries does not establish that runtime lookup or invocation reaches a handler.'
	},
	{
		kind: 'RUNTIME_PERFORMABILITY_NOT_CLAIMED',
		reason:
			'Static declarations do not prove that authentication, validation, preconditions, guards, persistence, or event conformance permit successful execution.'
	}
] as const satisfies readonly CommandHandlerGraphLimitation[];

export interface CommandHandlerGraphCoverage {
	readonly arrowAttributionClosure: 'OPEN';
	readonly candidateEdges: number;
	readonly commandRegistryClosure: 'CLOSED' | 'OPEN';
	readonly commandsWithArrowEvidence: number;
	readonly commandsWithoutArrowEvidence: number;
	readonly directHandlerArrowSites: number;
	readonly discoveredArrowOccurrences: number;
	readonly discoveredArrowSites: number;
	readonly discoveredCommandRegistryEntries: number;
	readonly discoveredHandlerRegistryEntries: number;
	readonly edges: number;
	readonly exactCommandRegistrations: number;
	readonly exactEdges: number;
	readonly factorySharedArrowSites: number;
	readonly frontierNodes: number;
	readonly handlerTargets: number;
	readonly missingHandlerRegistrations: number;
	readonly reconciles: boolean;
	readonly representedArrowOccurrences: number;
	readonly representedArrowSites: number;
	readonly representedCommandRegistryEntries: number;
	readonly representedHandlerRegistryEntries: number;
	readonly tableCommandArrowSites: number;
	readonly undeclaredHandlerRegistrations: number;
}

export interface CommandHandlerGraphIndexEntry {
	readonly edgeIds: readonly CommandHandlerGraphEdgeId[];
	readonly nodeId: CommandHandlerGraphNodeId;
}

interface CommandHandlerGraphLayerBase {
	readonly capabilityStatus: typeof COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS;
	readonly coverage: CommandHandlerGraphCoverage;
	readonly edgeIds: readonly CommandHandlerGraphEdgeId[];
	readonly graphId: CommandHandlerGraphId;
	readonly id: CommandHandlerGraphLayerId;
	readonly limitations: readonly CommandHandlerGraphLimitation[];
	readonly method: typeof COMMAND_HANDLER_GRAPH_METHOD;
	readonly nodeIds: readonly CommandHandlerGraphNodeId[];
	readonly producer: SemanticProviderIdentity;
	readonly provenanceIds: readonly SemanticProvenanceId[];
	readonly registryStatus: typeof COMMAND_HANDLER_GRAPH_REGISTRY_STATUS;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type CommandHandlerGraphLayer =
	| (CommandHandlerGraphLayerBase & {
			readonly capability: typeof COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY;
			readonly kind: 'JPWB_COMMAND_HANDLER_DERIVATION';
			readonly ordinal: 0;
	  })
	| (CommandHandlerGraphLayerBase & {
			readonly capability: typeof COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY;
			readonly kind: 'JPWB_COMMAND_HANDLER_INFERENCE';
			readonly ordinal: 1;
	  });

export interface CommandHandlerGraphSnapshot {
	readonly arrowObservationId: ArrowCommandCensusObservationId;
	readonly authorityTransfer: typeof COMMAND_HANDLER_GRAPH_AUTHORITY_TRANSFER;
	readonly baselineChange: typeof COMMAND_HANDLER_GRAPH_BASELINE_CHANGE;
	readonly budgets: CommandHandlerGraphBudgets;
	readonly canonicalProfile: typeof COMMAND_HANDLER_GRAPH_CANONICAL_PROFILE;
	readonly capabilities: readonly [
		typeof COMMAND_HANDLER_GRAPH_DERIVATION_CAPABILITY,
		typeof COMMAND_HANDLER_GRAPH_INFERENCE_CAPABILITY
	];
	readonly capabilityStatus: typeof COMMAND_HANDLER_GRAPH_CAPABILITY_STATUS;
	readonly commandDispatchCensusIntegration: typeof COMMAND_HANDLER_GRAPH_COMMAND_DISPATCH_CENSUS_INTEGRATION;
	readonly commandRegistry: CommandHandlerRegistrySelector;
	readonly contentDigest: string;
	readonly coverage: CommandHandlerGraphCoverage;
	readonly edges: readonly CommandHandlerGraphEdge[];
	readonly forwardIndex: readonly CommandHandlerGraphIndexEntry[];
	readonly fullJanCsaa007Conformance: typeof COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof COMMAND_HANDLER_GRAPH_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly gateEffect: typeof COMMAND_HANDLER_GRAPH_GATE_EFFECT;
	readonly graphAuthority: typeof COMMAND_HANDLER_GRAPH_GRAPH_AUTHORITY;
	readonly graphInputDigest: string;
	readonly graphKind: 'JPWB_COMMAND_HANDLER_STATIC_PROJECTION';
	readonly handlerRegistry: CommandHandlerRegistrySelector;
	readonly health: 'PARTIAL';
	readonly id: CommandHandlerGraphId;
	readonly integrationStrategy: typeof COMMAND_HANDLER_GRAPH_INTEGRATION_STRATEGY;
	readonly layers: readonly [CommandHandlerGraphLayer, CommandHandlerGraphLayer];
	readonly limitations: readonly CommandHandlerGraphLimitation[];
	readonly method: typeof COMMAND_HANDLER_GRAPH_METHOD;
	readonly nodes: readonly CommandHandlerGraphNode[];
	readonly operationVersion: typeof COMMAND_HANDLER_GRAPH_OPERATION_VERSION;
	readonly oracleChange: typeof COMMAND_HANDLER_GRAPH_ORACLE_CHANGE;
	readonly producer: SemanticProviderIdentity;
	readonly registryStatus: typeof COMMAND_HANDLER_GRAPH_REGISTRY_STATUS;
	readonly replacementEquivalence: typeof COMMAND_HANDLER_GRAPH_REPLACEMENT_EQUIVALENCE;
	readonly retainedArrowVerifierAuthority: typeof COMMAND_HANDLER_GRAPH_RETAINED_ARROW_VERIFIER_AUTHORITY;
	readonly reverseIndex: readonly CommandHandlerGraphIndexEntry[];
	readonly runtimeDispatchClosure: typeof COMMAND_HANDLER_GRAPH_RUNTIME_DISPATCH_CLOSURE;
	readonly runtimePerformability: typeof COMMAND_HANDLER_GRAPH_RUNTIME_PERFORMABILITY;
	readonly schemaVersion: typeof COMMAND_HANDLER_GRAPH_SCHEMA_VERSION;
	readonly scope: typeof COMMAND_HANDLER_GRAPH_SCOPE;
	readonly semanticExtractionVersion: StaticSemanticSnapshot['extractionVersion'];
	readonly semanticSchemaVersion: StaticSemanticSnapshot['schemaVersion'];
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export type CommandHandlerGraphBuildDiagnosticCode =
	| 'ARROW_OBSERVATION_ID_MISMATCH'
	| 'ARROW_OBSERVATION_INVALID'
	| 'BUDGET_EXCEEDED'
	| 'GRAPH_PARTIAL'
	| 'GRAPH_VALIDATION_FAILED'
	| 'INCOMPATIBLE_INPUT_POPULATION'
	| 'INPUT_INVALID'
	| 'REGISTRY_SELECTOR_MISMATCH'
	| 'REQUEST_INVALID'
	| 'SEMANTIC_CAPABILITY_UNAVAILABLE'
	| 'SEMANTIC_SNAPSHOT_ID_MISMATCH'
	| 'SUBJECT_ID_MISMATCH'
	| 'UNSUPPORTED_COMMAND_REGISTRY'
	| 'UNSUPPORTED_HANDLER_REGISTRY';

export interface CommandHandlerGraphBuildDiagnostic {
	readonly code: CommandHandlerGraphBuildDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'BIND' | 'CLASSIFY' | 'REQUEST' | 'VALIDATE';
}

export type CommandHandlerGraphBuildOutcome =
	| {
			readonly diagnostics: readonly CommandHandlerGraphBuildDiagnostic[];
			readonly graph: CommandHandlerGraphSnapshot;
			readonly outcome: 'partial';
	  }
	| {
			readonly diagnostics: readonly CommandHandlerGraphBuildDiagnostic[];
			readonly graph?: never;
			readonly outcome: 'unavailable';
	  };
