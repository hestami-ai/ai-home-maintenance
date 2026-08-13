import type { ArrowCommandCensusObservation } from './arrow-command-census.js';
import type {
	BuildCommandHandlerGraphRequest,
	CommandHandlerGraphEdgeId,
	CommandHandlerGraphId,
	CommandHandlerGraphNodeId,
	CommandHandlerGraphSnapshot
} from './command-handler-graph.js';
import type {
	SemanticDeclarationId,
	SemanticNodeId,
	SemanticProgramId,
	SemanticProjectId,
	SemanticProviderIdentity,
	SemanticReferenceId,
	SemanticSnapshotId,
	SemanticSourceId,
	SemanticSymbolId,
	StaticSemanticSnapshot
} from './semantic.js';
import type { FrozenSubject } from './subject.js';

export const COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION =
	'jan-csaa-command-event-contract-overlay-request/1.0.0' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_SCHEMA_VERSION =
	'jan-csaa-command-event-contract-overlay/1.0.0' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION =
	'jan-csaa-build-command-event-contract-overlay/0.1.0' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-command-event-contract-overlay-progress/1.0.0' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_CANONICAL_PROFILE =
	'jan-csaa-command-event-contract-overlay-canonical/1.0.0' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_METHOD =
	'jpwb-static-command-event-contract-correlation/0.1.0' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY = 'JAN-CSAA-CAP-027' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY = 'JAN-CSAA-CAP-028' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITIES = Object.freeze([
	COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
	COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY
] as const);
export const COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS = 'PARTIAL' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_SCOPE =
	'JPWB_STATIC_COMMAND_DECLARATIONS_EVENT_CONTRACTS_AND_RETAINED_EVENT_SURFACE' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_GRAPH_AUTHORITY = 'NONE' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER = 'NONE' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_INTEGRATION_STRATEGY = 'OVERLAY' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_GATE_EFFECT = 'NONE' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE = 'NONE' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_BASELINE_CHANGE = 'NONE' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE = 'NOT_CLAIMED' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION = 'NOT_CLAIMED' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY = 'NOT_CLAIMED' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH =
	'verif/event-surface-census.test.ts' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH =
	'packages/rph-contracts/vocab/m3-commands-events.json' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH =
	'packages/rph-contracts/src/messages.ts' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH =
	'packages/rph-contracts/tsconfig.json' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_AUTHORITY =
	'RETAINED_DELEGATED' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_EXECUTION =
	'NOT_EXECUTED_BY_CSAA' as const;
export const COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_INTEGRATION = 'NOT_INTEGRATED' as const;

declare const commandEventContractOverlayBrand: unique symbol;
type Branded<Kind extends string> = string & {
	readonly [commandEventContractOverlayBrand]: Kind;
};
export type CommandEventContractOverlayId = Branded<'CommandEventContractOverlay'>;
export type CommandEventContractCommandId = Branded<'CommandEventContractCommand'>;
export type CommandEventContractEventId = Branded<'CommandEventContractEvent'>;
export type CommandEventContractDeclaredLinkId = Branded<'CommandEventContractDeclaredLink'>;
export type CommandEventContractBoundContributionId =
	Branded<'CommandEventContractBoundContribution'>;
export type CommandEventContractPinnedEmissionId = Branded<'CommandEventContractPinnedEmission'>;
export type CommandEventContractFrontierId = Branded<'CommandEventContractFrontier'>;
export type CommandEventContractLayerId = Branded<'CommandEventContractLayer'>;

export interface CommandEventContractOverlayBudgets {
	readonly maxAstNodes: number;
	readonly maxBoundContributions: number;
	readonly maxCommands: number;
	readonly maxDeclaredLinks: number;
	readonly maxDiagnostics: number;
	readonly maxEventContracts: number;
	readonly maxFrontiers: number;
	readonly maxPinnedEmissions: number;
	readonly maxSourceBytes: number;
}

export interface CommandEventContractRegistrySelector {
	readonly contentSha256: string;
	readonly declarationId: SemanticDeclarationId;
	readonly exportName: 'COMMANDS' | 'EVENTS';
	readonly logicalPath: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_PATH;
	readonly programId: SemanticProgramId;
	readonly projectConfigPath: typeof COMMAND_EVENT_CONTRACT_OVERLAY_PROJECT_CONFIG_PATH;
	readonly projectId: SemanticProjectId;
	readonly sourceId: SemanticSourceId;
}

export interface CommandEventContractArtifactSelector {
	readonly artifactBytes: number;
	readonly artifactContentSha256: string;
	readonly artifactPath:
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_VOCAB_PATH;
}

export interface BuildCommandEventContractOverlayRequest {
	readonly arrowObservationId: ArrowCommandCensusObservation['id'];
	readonly budgets: CommandEventContractOverlayBudgets;
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly commandRegistry: CommandEventContractRegistrySelector;
	readonly eventRegistry: CommandEventContractRegistrySelector;
	readonly operationVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION;
	readonly retainedCensusArtifact: CommandEventContractArtifactSelector;
	readonly schemaVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REQUEST_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
	readonly vocabArtifact: CommandEventContractArtifactSelector;
}

export interface CommandEventContractOverlayBuildInputs {
	readonly arrowObservation: ArrowCommandCensusObservation;
	readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
	readonly commandHandlerRequest: BuildCommandHandlerGraphRequest;
	readonly request: BuildCommandEventContractOverlayRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
	readonly subject: FrozenSubject;
}

export interface RetainedEventSurfaceCensusReference {
	readonly artifactBytes: number;
	readonly artifactContentSha256: string;
	readonly artifactPath: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_PATH;
	readonly authorityTransfer: typeof COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER;
	readonly execution: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_EXECUTION;
	readonly gateEffect: typeof COMMAND_EVENT_CONTRACT_OVERLAY_GATE_EFFECT;
	readonly integration: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_INTEGRATION;
	readonly oracleChange: typeof COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE;
	readonly replacementEquivalence: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE;
	readonly verifierAuthority: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RETAINED_CENSUS_AUTHORITY;
}

export interface CommandEventContractHandlerReference {
	readonly registrationNodeId: CommandHandlerGraphNodeId;
	readonly supportingEdgeIds: readonly CommandHandlerGraphEdgeId[];
	readonly targetNodeId: CommandHandlerGraphNodeId | null;
	readonly upstreamAttribution: 'EXACT' | 'CANDIDATE' | 'UNRESOLVED';
}

export interface CommandEventContractCommandRecord {
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly commandName: string;
	readonly commandNodeId: CommandHandlerGraphNodeId;
	readonly declaredLinkIds: readonly CommandEventContractDeclaredLinkId[];
	readonly handlerReferences: readonly CommandEventContractHandlerReference[];
	readonly id: CommandEventContractCommandId;
	readonly nameNodeId: SemanticNodeId;
	readonly propertyNodeId: SemanticNodeId;
}

export interface CommandEventContractEventRecord {
	readonly aggregateType: string;
	readonly aggregateTypeNodeId: SemanticNodeId;
	readonly eventName: string;
	readonly id: CommandEventContractEventId;
	readonly nameNodeId: SemanticNodeId;
	readonly payloadDeclarationId: SemanticDeclarationId;
	readonly payloadNodeId: SemanticNodeId;
	readonly payloadReferenceId: SemanticReferenceId;
	readonly payloadSymbolId: SemanticSymbolId;
	readonly propertyNodeId: SemanticNodeId;
	readonly sourceId: SemanticSourceId;
}

export interface CommandEventContractDeclaredLink {
	readonly attribution: 'EXACT';
	readonly commandId: CommandEventContractCommandId;
	readonly commandName: string;
	readonly eventId: CommandEventContractEventId;
	readonly eventName: string;
	readonly eventNameNodeId: SemanticNodeId;
	readonly id: CommandEventContractDeclaredLinkId;
	readonly ordinal: number;
	readonly role: 'PRIMARY' | 'ADDITIONAL';
	readonly supportingNodeIds: readonly SemanticNodeId[];
}

export interface CommandEventContractBoundContribution {
	readonly commandName: string;
	readonly eventName: string;
	readonly from: string | null;
	readonly id: CommandEventContractBoundContributionId;
	readonly machine: string | null;
	readonly ordinal: number;
	readonly sourceKind: 'COMMAND_PRIMARY' | 'TRANSITION_BINDING';
	readonly to: string | null;
}

export interface CommandEventContractPinnedEmission {
	readonly eventName: string;
	readonly id: CommandEventContractPinnedEmissionId;
	readonly ordinal: number;
	readonly retainedMeasurement: 'EMITTED_2026_08_04';
}

export type CommandEventContractFrontierKind =
	| 'COMMAND_WITHOUT_TRANSITION_BINDING'
	| 'DECLARED_NEITHER_BOUND_NOR_PINNED_EMITTED'
	| 'GENERATED_EVENT_SCHEMA_UNRESOLVED'
	| 'GENERATED_RETAINED_BOUND_SET_MISMATCH'
	| 'PINNED_EMITTED_NOT_RETAINED_BOUND'
	| 'RETAINED_BOUND_NOT_PINNED_EMITTED'
	| 'UNSUPPORTED_GENERATED_EVENT_DECLARATION'
	| 'UNSUPPORTED_RETAINED_CENSUS_GRAMMAR'
	| 'UNSUPPORTED_VOCAB_BINDING';

export interface CommandEventContractFrontier {
	readonly commandId: CommandEventContractCommandId | null;
	readonly eventId: CommandEventContractEventId | null;
	readonly eventName: string | null;
	readonly frontierKind: CommandEventContractFrontierKind;
	readonly id: CommandEventContractFrontierId;
	readonly reason: string;
}

export type CommandEventContractOverlayLimitationKind =
	| 'COMMAND_EVENT_DECLARATION_IS_NOT_HANDLER_OWNERSHIP'
	| 'EVENT_PAYLOAD_COMPATIBILITY_NOT_ANALYZED'
	| 'NO_CFG_DOMINANCE_OR_PATH_FEASIBILITY'
	| 'NO_HANDLER_INVOCATION_OR_EXECUTION'
	| 'NO_PERSISTENCE_WRITE_OR_EFFECT_PROOF'
	| 'PINNED_EMITTED_SET_IS_NOT_FRESH_RUNTIME_EVIDENCE'
	| 'RELATION_REGISTRY_UNAVAILABLE'
	| 'RETAINED_EVENT_SURFACE_AUTHORITY_UNCHANGED'
	| 'RUNTIME_EVENT_EMISSION_NOT_CLAIMED'
	| 'STATIC_SURFACES_ARE_NOT_COMPLETENESS_PROOF';

export interface CommandEventContractOverlayLimitation {
	readonly kind: CommandEventContractOverlayLimitationKind;
	readonly reason: string;
}

const limitation = (
	kind: CommandEventContractOverlayLimitationKind,
	reason: string
): CommandEventContractOverlayLimitation => Object.freeze({ kind, reason });

export const COMMAND_EVENT_CONTRACT_OVERLAY_LIMITATIONS = Object.freeze([
	limitation(
		'COMMAND_EVENT_DECLARATION_IS_NOT_HANDLER_OWNERSHIP',
		'A command declaration and a separately registered handler route do not prove that the handler owns, constructs, or emits the named event.'
	),
	limitation(
		'NO_HANDLER_INVOCATION_OR_EXECUTION',
		'The overlay neither invokes nor executes subject handlers and does not establish runtime dispatch or successful command handling.'
	),
	limitation(
		'RUNTIME_EVENT_EMISSION_NOT_CLAIMED',
		'Static emitsEvent and alsoEmitsEvents declarations do not prove that an event occurs on any runtime path.'
	),
	limitation(
		'PINNED_EMITTED_SET_IS_NOT_FRESH_RUNTIME_EVIDENCE',
		'The retained EMITTED set is a dated static measurement reproduced from exact retained bytes, not a fresh execution or exhaustive runtime observation.'
	),
	limitation(
		'NO_CFG_DOMINANCE_OR_PATH_FEASIBILITY',
		'No control-flow graph, dominance, reachability, branch selection, or path-feasibility evidence is produced.'
	),
	limitation(
		'NO_PERSISTENCE_WRITE_OR_EFFECT_PROOF',
		'This overlay does not prove persistence, port writes, state mutation, event construction, commit success, or any other handler effect.'
	),
	limitation(
		'EVENT_PAYLOAD_COMPATIBILITY_NOT_ANALYZED',
		'The presence of payload schema declarations is recorded, but command and event payload compatibility is not established.'
	),
	limitation(
		'STATIC_SURFACES_ARE_NOT_COMPLETENESS_PROOF',
		'Absence from a generated registry, vocab binding table, or pinned emitted set is an explicit frontier and not proof of dead code or behavioral absence.'
	),
	limitation(
		'RETAINED_EVENT_SURFACE_AUTHORITY_UNCHANGED',
		'The retained event-surface Vitest gate keeps its delegated authority, oracle, gate, baseline, and replacement status and is not executed or integrated here.'
	),
	limitation(
		'RELATION_REGISTRY_UNAVAILABLE',
		'The closed JAN-CSAA relation registry has no command-event-contract family; this overlay remains implementation-local and full JAN-CSAA-007/008 conformance is not claimed.'
	)
]);

export interface CommandEventContractOverlayCoverage {
	readonly boundContributions: number;
	readonly boundDistinctEvents: number;
	readonly boundRepeatedContributions: number;
	readonly commandDeclaredDistinctEvents: number;
	readonly commandDeclaredLinks: number;
	readonly commands: number;
	readonly commandsWithoutTransitionBinding: number;
	readonly declaredNeitherBoundNorPinned: number;
	readonly eventContracts: number;
	readonly frontiers: number;
	readonly generatedBoundSetDifferences: number;
	readonly missingEventContracts: number;
	readonly pinnedEmissions: number;
	readonly pinnedEmittedNotBound: number;
	readonly retainedBoundNotPinnedEmitted: number;
	readonly primaryDeclaredLinks: number;
	readonly additionalDeclaredLinks: number;
	readonly reconciles: boolean;
}

export interface CommandEventContractOverlayIndexEntry {
	readonly boundContributionIds: readonly CommandEventContractBoundContributionId[];
	readonly commandIds: readonly CommandEventContractCommandId[];
	readonly declaredLinkIds: readonly CommandEventContractDeclaredLinkId[];
	readonly eventIds: readonly CommandEventContractEventId[];
	readonly frontierIds: readonly CommandEventContractFrontierId[];
	readonly key: string;
	readonly pinnedEmissionIds: readonly CommandEventContractPinnedEmissionId[];
}

export interface CommandEventContractOverlayLayer {
	readonly boundContributionIds: readonly CommandEventContractBoundContributionId[];
	readonly capability:
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY
		| typeof COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY;
	readonly capabilityStatus: typeof COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS;
	readonly commandIds: readonly CommandEventContractCommandId[];
	readonly declaredLinkIds: readonly CommandEventContractDeclaredLinkId[];
	readonly eventIds: readonly CommandEventContractEventId[];
	readonly frontierIds: readonly CommandEventContractFrontierId[];
	readonly id: CommandEventContractLayerId;
	readonly kind: 'JPWB_COMMAND_EVENT_CONTRACT_DERIVATION' | 'JPWB_COMMAND_EVENT_CONTRACT_INFERENCE';
	readonly ordinal: 0 | 1;
	readonly overlayId: CommandEventContractOverlayId;
	readonly pinnedEmissionIds: readonly CommandEventContractPinnedEmissionId[];
}

export interface CommandEventContractOverlaySnapshot {
	readonly arrowObservationContentDigest: string;
	readonly arrowObservationId: ArrowCommandCensusObservation['id'];
	readonly authorityTransfer: typeof COMMAND_EVENT_CONTRACT_OVERLAY_AUTHORITY_TRANSFER;
	readonly baselineChange: typeof COMMAND_EVENT_CONTRACT_OVERLAY_BASELINE_CHANGE;
	readonly boundContributions: readonly CommandEventContractBoundContribution[];
	readonly budgets: CommandEventContractOverlayBudgets;
	readonly canonicalProfile: typeof COMMAND_EVENT_CONTRACT_OVERLAY_CANONICAL_PROFILE;
	readonly capabilities: readonly [
		typeof COMMAND_EVENT_CONTRACT_OVERLAY_DERIVATION_CAPABILITY,
		typeof COMMAND_EVENT_CONTRACT_OVERLAY_INFERENCE_CAPABILITY
	];
	readonly capabilityStatus: typeof COMMAND_EVENT_CONTRACT_OVERLAY_CAPABILITY_STATUS;
	readonly commandHandlerGraphContentDigest: string;
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly commandRegistry: CommandEventContractRegistrySelector;
	readonly commands: readonly CommandEventContractCommandRecord[];
	readonly contentDigest: string;
	readonly coverage: CommandEventContractOverlayCoverage;
	readonly declaredLinks: readonly CommandEventContractDeclaredLink[];
	readonly eventContracts: readonly CommandEventContractEventRecord[];
	readonly eventRegistry: CommandEventContractRegistrySelector;
	readonly forwardIndex: readonly CommandEventContractOverlayIndexEntry[];
	readonly frontiers: readonly CommandEventContractFrontier[];
	readonly fullJanCsaa007Conformance: typeof COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof COMMAND_EVENT_CONTRACT_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly gateEffect: typeof COMMAND_EVENT_CONTRACT_OVERLAY_GATE_EFFECT;
	readonly graphAuthority: typeof COMMAND_EVENT_CONTRACT_OVERLAY_GRAPH_AUTHORITY;
	readonly health: 'PARTIAL';
	readonly id: CommandEventContractOverlayId;
	readonly inputDigest: string;
	readonly integrationStrategy: typeof COMMAND_EVENT_CONTRACT_OVERLAY_INTEGRATION_STRATEGY;
	readonly layers: readonly [CommandEventContractOverlayLayer, CommandEventContractOverlayLayer];
	readonly limitations: readonly CommandEventContractOverlayLimitation[];
	readonly method: typeof COMMAND_EVENT_CONTRACT_OVERLAY_METHOD;
	readonly operationVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_OPERATION_VERSION;
	readonly oracleChange: typeof COMMAND_EVENT_CONTRACT_OVERLAY_ORACLE_CHANGE;
	readonly pinnedEmissions: readonly CommandEventContractPinnedEmission[];
	readonly producer: SemanticProviderIdentity;
	readonly registryStatus: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REGISTRY_STATUS;
	readonly replacementEquivalence: typeof COMMAND_EVENT_CONTRACT_OVERLAY_REPLACEMENT_EQUIVALENCE;
	readonly retainedCensus: RetainedEventSurfaceCensusReference;
	readonly reverseIndex: readonly CommandEventContractOverlayIndexEntry[];
	readonly runtimeEmission: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_EMISSION;
	readonly runtimePerformability: typeof COMMAND_EVENT_CONTRACT_OVERLAY_RUNTIME_PERFORMABILITY;
	readonly schemaVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_SCHEMA_VERSION;
	readonly scope: typeof COMMAND_EVENT_CONTRACT_OVERLAY_SCOPE;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
	readonly vocabArtifact: CommandEventContractArtifactSelector;
}

export type CommandEventContractOverlayDiagnosticCode =
	| 'ARROW_OBSERVATION_INVALID'
	| 'BUDGET_EXCEEDED'
	| 'COMMAND_HANDLER_GRAPH_INVALID'
	| 'INPUT_IDENTITY_MISMATCH'
	| 'INPUT_POPULATION_MISMATCH'
	| 'OVERLAY_VALIDATION_FAILED'
	| 'REQUEST_INVALID'
	| 'SEMANTIC_CAPABILITY_UNAVAILABLE'
	| 'SUBJECT_CAPABILITY_UNAVAILABLE'
	| 'UNSUPPORTED_GENERATED_REGISTRY'
	| 'UNSUPPORTED_RETAINED_CENSUS'
	| 'UNSUPPORTED_VOCAB';

export interface CommandEventContractOverlayDiagnostic {
	readonly code: CommandEventContractOverlayDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'BIND' | 'MATERIALIZE' | 'PARSE' | 'RECONCILE' | 'REQUEST' | 'VALIDATE';
}

export type CommandEventContractOverlayBuildOutcome =
	| {
			readonly diagnostics: readonly CommandEventContractOverlayDiagnostic[];
			readonly outcome: 'partial';
			readonly overlay: CommandEventContractOverlaySnapshot;
	  }
	| {
			readonly diagnostics: readonly CommandEventContractOverlayDiagnostic[];
			readonly outcome: 'unavailable';
	  };

export type CommandEventContractOverlayProgressPhase =
	| 'REQUEST_BIND'
	| 'ARROW_VALIDATE'
	| 'HANDLER_GRAPH_VALIDATE'
	| 'ARTIFACT_BIND'
	| 'GENERATED_REGISTRY_PARSE'
	| 'VOCAB_PARSE'
	| 'RETAINED_CENSUS_PARSE'
	| 'COMMAND_EVENT_JOIN'
	| 'SURFACE_RECONCILE'
	| 'MATERIALIZE'
	| 'SERIALIZE'
	| 'OVERLAY_VALIDATE';

export interface CommandEventContractOverlayProgressEvent {
	readonly counts: Readonly<Record<string, number>>;
	readonly detailCode: string | null;
	readonly phase: CommandEventContractOverlayProgressPhase;
	readonly schemaVersion: typeof COMMAND_EVENT_CONTRACT_OVERLAY_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly state: 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'STARTED';
}

export interface BuildCommandEventContractOverlayOptions {
	readonly onProgress?: (event: CommandEventContractOverlayProgressEvent) => void;
}

export interface CommandEventContractOverlayValidationOptions {
	readonly maxDepth?: number;
	readonly maxInputRecords?: number;
	readonly maxInputStringCharacters?: number;
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type CommandEventContractOverlayValidationIssueCode =
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INPUT_INVALID'
	| 'POPULATION_MISMATCH'
	| 'SHAPE_INVALID';

export interface CommandEventContractOverlayValidationIssue {
	readonly code: CommandEventContractOverlayValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export type CommandEventContractOverlayValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly CommandEventContractOverlayValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };
