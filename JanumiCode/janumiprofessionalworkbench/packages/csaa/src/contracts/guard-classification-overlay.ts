import type { ArrowCommandCensusObservation } from './arrow-command-census.js';
import type {
	BuildCommandHandlerGraphRequest,
	CommandHandlerGraphEdgeId,
	CommandHandlerGraphId,
	CommandHandlerGraphNodeId,
	CommandHandlerGraphSnapshot
} from './command-handler-graph.js';
import type {
	GuardEnforcementDisposition,
	GuardEnforcementLedgerArrowId,
	GuardEnforcementLedgerGuardId,
	GuardEnforcementLedgerObservation,
	GuardEnforcementLedgerObservationId
} from './guard-enforcement-ledger.js';
import type {
	SemanticNodeId,
	SemanticProgramId,
	SemanticProjectId,
	SemanticProviderIdentity,
	SemanticSnapshotId,
	SemanticSourceId,
	StaticSemanticSnapshot
} from './semantic.js';
import type {
	BuildStateMachineGraphRequest,
	StateMachineGraphEdgeId,
	StateMachineGraphId,
	StateMachineGraphSnapshot,
	StateMachineTopologyObservation,
	StateMachineTopologyObservationId,
	StateMachineTopologyTransitionId
} from './state-machine-graph.js';
import type { FrozenSubject } from './subject.js';

export const GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION =
	'jan-csaa-guard-classification-overlay-request/1.0.0' as const;
export const GUARD_CLASSIFICATION_OVERLAY_SCHEMA_VERSION =
	'jan-csaa-guard-classification-overlay/1.0.0' as const;
export const GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION =
	'jan-csaa-build-guard-classification-overlay/0.1.0' as const;
export const GUARD_CLASSIFICATION_OVERLAY_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-guard-classification-overlay-progress/1.0.0' as const;
export const GUARD_CLASSIFICATION_OVERLAY_CANONICAL_PROFILE =
	'jan-csaa-guard-classification-overlay-canonical/1.0.0' as const;
export const GUARD_CLASSIFICATION_OVERLAY_METHOD =
	'jpwb-retained-guard-state-and-handler-correlation/0.1.0' as const;
export const GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY = 'JAN-CSAA-CAP-027' as const;
export const GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY = 'JAN-CSAA-CAP-028' as const;
export const GUARD_CLASSIFICATION_OVERLAY_CAPABILITIES = Object.freeze([
	GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
	GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY
] as const);
export const GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS = 'PARTIAL' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const GUARD_CLASSIFICATION_OVERLAY_SCOPE =
	'RETAINED_GUARD_CLASSIFICATIONS_WITH_STATIC_STATE_AND_HANDLER_CORRELATION' as const;
export const GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY = 'NONE' as const;
export const GUARD_CLASSIFICATION_OVERLAY_AUTHORITY_TRANSFER = 'NONE' as const;
export const GUARD_CLASSIFICATION_OVERLAY_INTEGRATION_STRATEGY = 'OVERLAY' as const;
export const GUARD_CLASSIFICATION_OVERLAY_GATE_EFFECT = 'NONE' as const;
export const GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE = 'NONE' as const;
export const GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE = 'NONE' as const;
export const GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE = 'NOT_CLAIMED' as const;
export const GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT = 'NOT_CLAIMED' as const;
export const GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY = 'NOT_CLAIMED' as const;
export const GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;

declare const guardClassificationOverlayBrand: unique symbol;
type Branded<Kind extends string> = string & {
	readonly [guardClassificationOverlayBrand]: Kind;
};
export type GuardClassificationOverlayId = Branded<'GuardClassificationOverlay'>;
export type GuardClassificationOverlayClassificationId =
	Branded<'GuardClassificationOverlayClassification'>;
export type GuardClassificationOverlayOccurrenceId =
	Branded<'GuardClassificationOverlayOccurrence'>;
export type GuardClassificationOverlayCommandEvidenceLinkId =
	Branded<'GuardClassificationOverlayCommandEvidenceLink'>;
export type GuardClassificationOverlayAnchorSiteId =
	Branded<'GuardClassificationOverlayAnchorSite'>;
export type GuardClassificationOverlayHandlerLinkId =
	Branded<'GuardClassificationOverlayHandlerLink'>;
export type GuardClassificationOverlayFrontierId = Branded<'GuardClassificationOverlayFrontier'>;
export type GuardClassificationOverlayLayerId = Branded<'GuardClassificationOverlayLayer'>;

/** Caller operation guards, not product ceilings, expected sizes, or service-level objectives. */
export interface GuardClassificationOverlayBudgets {
	readonly maxAnchorSites: number;
	readonly maxAstNodes: number;
	readonly maxCommandEvidenceLinks: number;
	readonly maxDiagnostics: number;
	readonly maxFrontiers: number;
	readonly maxGuardOccurrences: number;
	readonly maxGuardRecords: number;
	readonly maxHandlerLinks: number;
	readonly maxSourceBytes: number;
	readonly maxStateEvidenceRefs: number;
}

export interface BuildGuardClassificationOverlayRequest {
	readonly arrowObservationId: ArrowCommandCensusObservation['id'];
	readonly budgets: GuardClassificationOverlayBudgets;
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly guardObservationId: GuardEnforcementLedgerObservationId;
	readonly operationVersion: typeof GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION;
	readonly schemaVersion: typeof GUARD_CLASSIFICATION_OVERLAY_REQUEST_SCHEMA_VERSION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly stateGraphId: StateMachineGraphId;
	readonly stateObservationId: StateMachineTopologyObservationId;
	readonly subjectId: string;
}

/** Explicit predecessor requests prevent candidate-reconstructed validation from becoming self-authenticating. */
export interface GuardClassificationOverlayBuildInputs {
	readonly arrowObservation: ArrowCommandCensusObservation;
	readonly commandHandlerGraph: CommandHandlerGraphSnapshot;
	readonly commandHandlerRequest: BuildCommandHandlerGraphRequest;
	readonly guardObservation: GuardEnforcementLedgerObservation;
	readonly request: BuildGuardClassificationOverlayRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
	readonly stateGraph: StateMachineGraphSnapshot;
	readonly stateGraphRequest: BuildStateMachineGraphRequest;
	readonly stateObservation: StateMachineTopologyObservation;
	readonly subject: FrozenSubject;
}

export interface GuardClassificationOverlayClassificationRecord {
	readonly anchorSiteId: GuardClassificationOverlayAnchorSiteId | null;
	readonly disposition: GuardEnforcementDisposition | null;
	readonly enforcingAnchor: string | null;
	readonly enforcingSite: string | null;
	readonly evidence: string | null;
	readonly guardId: GuardEnforcementLedgerGuardId;
	readonly guardText: string;
	readonly id: GuardClassificationOverlayClassificationId;
	readonly ledgerState: 'CLASSIFIED' | 'STALE' | 'UNCLASSIFIED';
	readonly occurrenceIds: readonly GuardClassificationOverlayOccurrenceId[];
}

export interface GuardClassificationOverlayOccurrenceRecord {
	readonly arrowId: GuardEnforcementLedgerArrowId;
	readonly classificationId: GuardClassificationOverlayClassificationId;
	readonly commandEvidenceLinkIds: readonly GuardClassificationOverlayCommandEvidenceLinkId[];
	readonly frontierIds: readonly GuardClassificationOverlayFrontierId[];
	readonly from: string;
	readonly guardText: string;
	readonly id: GuardClassificationOverlayOccurrenceId;
	readonly legalTransitionId: StateMachineTopologyTransitionId;
	readonly machine: string;
	readonly stateGraphEdgeIds: readonly StateMachineGraphEdgeId[];
	readonly to: string;
}

export interface GuardClassificationOverlayCommandEvidenceLink {
	readonly attribution: 'EXACT_RETAINED_TUPLE_CORRELATION';
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly commandOccurrenceNodeId: CommandHandlerGraphNodeId;
	readonly commandSiteNodeId: CommandHandlerGraphNodeId;
	readonly handlerTargetNodeIds: readonly CommandHandlerGraphNodeId[];
	readonly id: GuardClassificationOverlayCommandEvidenceLinkId;
	readonly observationArrowId: ArrowCommandCensusObservation['declaredArrows'][number]['id'];
	readonly occurrenceId: GuardClassificationOverlayOccurrenceId;
	readonly siteAttribution: 'DIRECT_HANDLER' | 'FACTORY_SHARED' | 'TABLE_COMMAND' | 'UNRESOLVED';
	readonly supportingEdgeIds: readonly CommandHandlerGraphEdgeId[];
}

export interface GuardClassificationOverlayAnchorSite {
	readonly anchorText: string;
	readonly callableNodeId: SemanticNodeId;
	readonly classificationIds: readonly GuardClassificationOverlayClassificationId[];
	readonly currentLine: number;
	readonly end: number;
	readonly frontierIds: readonly GuardClassificationOverlayFrontierId[];
	readonly handlerLinkIds: readonly GuardClassificationOverlayHandlerLinkId[];
	readonly id: GuardClassificationOverlayAnchorSiteId;
	readonly path: string;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly sourceId: SemanticSourceId;
	readonly start: number;
}

interface GuardClassificationOverlayHandlerLinkBase {
	readonly anchorSiteId: GuardClassificationOverlayAnchorSiteId;
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly id: GuardClassificationOverlayHandlerLinkId;
	readonly supportingEdgeIds: readonly CommandHandlerGraphEdgeId[];
	readonly targetNodeIds: readonly CommandHandlerGraphNodeId[];
}

export type GuardClassificationOverlayHandlerLink =
	| (GuardClassificationOverlayHandlerLinkBase & {
			readonly attribution: 'EXACT';
			readonly kind: 'EXACT_HANDLER_TARGET';
			readonly targetNodeIds: readonly [CommandHandlerGraphNodeId];
	  })
	| (GuardClassificationOverlayHandlerLinkBase & {
			readonly attribution: 'CANDIDATE';
			readonly factoryCallableNodeId: SemanticNodeId;
			readonly kind: 'FACTORY_SHARED_CANDIDATE';
	  });

export type GuardClassificationOverlayFrontierKind =
	| 'FACTORY_HANDLER_ATTRIBUTION_CANDIDATE'
	| 'HELPER_CALL_FLOW_UNRESOLVED'
	| 'NO_RETAINED_DECLARED_ARROW_EVIDENCE'
	| 'STALE_LEDGER_ROW'
	| 'UNCLASSIFIED_GUARD_TEXT';

export interface GuardClassificationOverlayFrontier {
	readonly anchorSiteId: GuardClassificationOverlayAnchorSiteId | null;
	readonly classificationId: GuardClassificationOverlayClassificationId | null;
	readonly frontierKind: GuardClassificationOverlayFrontierKind;
	readonly id: GuardClassificationOverlayFrontierId;
	readonly occurrenceId: GuardClassificationOverlayOccurrenceId | null;
	readonly reason: string;
}

export type GuardClassificationOverlayLimitationKind =
	| 'COMMAND_EVIDENCE_ABSENCE_IS_NOT_DEAD_CODE_PROOF'
	| 'FACTORY_ASSOCIATIONS_ARE_CANDIDATE_ONLY'
	| 'GUARD_DISPOSITIONS_ARE_RETAINED_REVIEW_JUDGMENTS'
	| 'HANDLER_LINKS_ARE_STATIC_STRUCTURAL_CORRELATION_ONLY'
	| 'HELPER_CALL_FLOW_IS_NOT_MODELED'
	| 'NO_CFG_DOMINANCE_OR_PATH_FEASIBILITY'
	| 'NO_EFFECT_EVENT_OR_PERSISTENCE_PROOF'
	| 'RELATION_REGISTRY_UNAVAILABLE'
	| 'RETAINED_VERIFIER_AUTHORITY_UNCHANGED'
	| 'RUNTIME_ENFORCEMENT_NOT_CLAIMED';

export interface GuardClassificationOverlayLimitation {
	readonly kind: GuardClassificationOverlayLimitationKind;
	readonly reason: string;
}

const limitation = (
	kind: GuardClassificationOverlayLimitationKind,
	reason: string
): GuardClassificationOverlayLimitation => Object.freeze({ kind, reason });

export const GUARD_CLASSIFICATION_OVERLAY_LIMITATIONS = Object.freeze([
	limitation(
		'GUARD_DISPOSITIONS_ARE_RETAINED_REVIEW_JUDGMENTS',
		'The overlay copies retained ledger classifications exactly and neither confirms nor promotes them.'
	),
	limitation(
		'HANDLER_LINKS_ARE_STATIC_STRUCTURAL_CORRELATION_ONLY',
		'Anchor containment and retained tuple correlation do not establish handler ownership, invocation, refusal, or execution.'
	),
	limitation(
		'FACTORY_ASSOCIATIONS_ARE_CANDIDATE_ONLY',
		'An anchor inside a factory callable may correlate to multiple registered factory results and remains candidate evidence.'
	),
	limitation(
		'HELPER_CALL_FLOW_IS_NOT_MODELED',
		'An enforcement citation outside registered handler or factory callables remains an explicit helper call-flow frontier.'
	),
	limitation(
		'COMMAND_EVIDENCE_ABSENCE_IS_NOT_DEAD_CODE_PROOF',
		'Absence from the retained declared-arrow census does not prove that a guarded transition is unreachable or effect-free.'
	),
	limitation(
		'NO_CFG_DOMINANCE_OR_PATH_FEASIBILITY',
		'The overlay has no control-flow graph, dominance, reachability, or path-feasibility proof.'
	),
	limitation(
		'NO_EFFECT_EVENT_OR_PERSISTENCE_PROOF',
		'The overlay does not analyze payload reads, effects, emitted events, persistence, or port behavior.'
	),
	limitation(
		'RELATION_REGISTRY_UNAVAILABLE',
		'The closed JAN-CSAA relation registry has no guard-classification correlation family; this evidence schema remains implementation-local.'
	),
	limitation(
		'RETAINED_VERIFIER_AUTHORITY_UNCHANGED',
		'The retained ledger and arrow census keep their delegated authority, gates, oracles, and replacement status.'
	),
	limitation(
		'RUNTIME_ENFORCEMENT_NOT_CLAIMED',
		'Static evidence does not prove runtime guard enforcement, command performability, dispatch, or successful refusal.'
	)
]);

export interface GuardClassificationOverlayCoverage {
	readonly anchorSites: number;
	readonly candidateFactoryHandlerLinks: number;
	readonly classifications: number;
	readonly commandEvidenceLinks: number;
	readonly commandEvidenceOccurrences: number;
	readonly directHandlerLinks: number;
	readonly dispositionCounts: readonly {
		readonly count: number;
		readonly disposition: GuardEnforcementDisposition | null;
	}[];
	readonly expectedClassifications: number;
	readonly expectedCommandEvidenceLinks: number;
	readonly expectedOccurrences: number;
	readonly expectedStateEvidenceRefs: number;
	readonly frontiers: number;
	readonly helperFrontiers: number;
	readonly noCommandEvidenceFrontiers: number;
	readonly occurrences: number;
	readonly reconciles: boolean;
	readonly stateEvidenceRefs: number;
}

export interface GuardClassificationOverlayIndexEntry {
	readonly anchorSiteIds: readonly GuardClassificationOverlayAnchorSiteId[];
	readonly classificationIds: readonly GuardClassificationOverlayClassificationId[];
	readonly commandEvidenceLinkIds: readonly GuardClassificationOverlayCommandEvidenceLinkId[];
	readonly frontierIds: readonly GuardClassificationOverlayFrontierId[];
	readonly handlerLinkIds: readonly GuardClassificationOverlayHandlerLinkId[];
	readonly key: string;
	readonly occurrenceIds: readonly GuardClassificationOverlayOccurrenceId[];
}

export interface GuardClassificationOverlayLayer {
	readonly capability:
		| typeof GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY
		| typeof GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY;
	readonly capabilityStatus: typeof GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS;
	readonly classificationIds: readonly GuardClassificationOverlayClassificationId[];
	readonly commandEvidenceLinkIds: readonly GuardClassificationOverlayCommandEvidenceLinkId[];
	readonly frontierIds: readonly GuardClassificationOverlayFrontierId[];
	readonly handlerLinkIds: readonly GuardClassificationOverlayHandlerLinkId[];
	readonly id: GuardClassificationOverlayLayerId;
	readonly kind: 'JPWB_GUARD_CLASSIFICATION_DERIVATION' | 'JPWB_GUARD_HANDLER_INFERENCE';
	readonly occurrenceIds: readonly GuardClassificationOverlayOccurrenceId[];
	readonly ordinal: 0 | 1;
	readonly overlayId: GuardClassificationOverlayId;
}

export interface GuardClassificationOverlaySnapshot {
	readonly anchorSites: readonly GuardClassificationOverlayAnchorSite[];
	readonly arrowObservationContentDigest: string;
	readonly arrowObservationId: ArrowCommandCensusObservation['id'];
	readonly authorityTransfer: typeof GUARD_CLASSIFICATION_OVERLAY_AUTHORITY_TRANSFER;
	readonly baselineChange: typeof GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE;
	readonly budgets: GuardClassificationOverlayBudgets;
	readonly canonicalProfile: typeof GUARD_CLASSIFICATION_OVERLAY_CANONICAL_PROFILE;
	readonly capabilities: readonly [
		typeof GUARD_CLASSIFICATION_OVERLAY_DERIVATION_CAPABILITY,
		typeof GUARD_CLASSIFICATION_OVERLAY_INFERENCE_CAPABILITY
	];
	readonly capabilityStatus: typeof GUARD_CLASSIFICATION_OVERLAY_CAPABILITY_STATUS;
	readonly classifications: readonly GuardClassificationOverlayClassificationRecord[];
	readonly commandEvidenceLinks: readonly GuardClassificationOverlayCommandEvidenceLink[];
	readonly commandHandlerGraphContentDigest: string;
	readonly commandHandlerGraphId: CommandHandlerGraphId;
	readonly contentDigest: string;
	readonly coverage: GuardClassificationOverlayCoverage;
	readonly forwardIndex: readonly GuardClassificationOverlayIndexEntry[];
	readonly frontiers: readonly GuardClassificationOverlayFrontier[];
	readonly fullJanCsaa007Conformance: typeof GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly gateEffect: typeof GUARD_CLASSIFICATION_OVERLAY_GATE_EFFECT;
	readonly graphAuthority: typeof GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY;
	readonly guardObservationContentDigest: string;
	readonly guardObservationId: GuardEnforcementLedgerObservationId;
	readonly handlerLinks: readonly GuardClassificationOverlayHandlerLink[];
	readonly health: 'PARTIAL';
	readonly id: GuardClassificationOverlayId;
	readonly inputDigest: string;
	readonly integrationStrategy: typeof GUARD_CLASSIFICATION_OVERLAY_INTEGRATION_STRATEGY;
	readonly layers: readonly [GuardClassificationOverlayLayer, GuardClassificationOverlayLayer];
	readonly limitations: readonly GuardClassificationOverlayLimitation[];
	readonly method: typeof GUARD_CLASSIFICATION_OVERLAY_METHOD;
	readonly occurrences: readonly GuardClassificationOverlayOccurrenceRecord[];
	readonly operationVersion: typeof GUARD_CLASSIFICATION_OVERLAY_OPERATION_VERSION;
	readonly oracleChange: typeof GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE;
	readonly producer: SemanticProviderIdentity;
	readonly registryStatus: typeof GUARD_CLASSIFICATION_OVERLAY_REGISTRY_STATUS;
	readonly replacementEquivalence: typeof GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE;
	readonly reverseIndex: readonly GuardClassificationOverlayIndexEntry[];
	readonly runtimeEnforcement: typeof GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT;
	readonly runtimePerformability: typeof GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY;
	readonly schemaVersion: typeof GUARD_CLASSIFICATION_OVERLAY_SCHEMA_VERSION;
	readonly scope: typeof GUARD_CLASSIFICATION_OVERLAY_SCOPE;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly stateGraphContentDigest: string;
	readonly stateGraphId: StateMachineGraphId;
	readonly stateObservationContentDigest: string;
	readonly stateObservationId: StateMachineTopologyObservationId;
	readonly subjectId: string;
}

export type GuardClassificationOverlayDiagnosticCode =
	| 'ARROW_OBSERVATION_INVALID'
	| 'BUDGET_EXCEEDED'
	| 'COMMAND_HANDLER_GRAPH_INVALID'
	| 'GUARD_OBSERVATION_INVALID'
	| 'INPUT_IDENTITY_MISMATCH'
	| 'INPUT_POPULATION_MISMATCH'
	| 'OVERLAY_VALIDATION_FAILED'
	| 'REQUEST_INVALID'
	| 'SEMANTIC_CAPABILITY_UNAVAILABLE'
	| 'STATE_GRAPH_INVALID'
	| 'STATE_OBSERVATION_INVALID'
	| 'SUBJECT_CAPABILITY_UNAVAILABLE'
	| 'UNSUPPORTED_HANDLER_CORRELATION'
	| 'UNSUPPORTED_TRANSITION_JOIN';

export interface GuardClassificationOverlayDiagnostic {
	readonly code: GuardClassificationOverlayDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'BIND' | 'CORRELATE' | 'JOIN' | 'MATERIALIZE' | 'REQUEST' | 'VALIDATE';
}

export type GuardClassificationOverlayBuildOutcome =
	| {
			readonly diagnostics: readonly GuardClassificationOverlayDiagnostic[];
			readonly outcome: 'partial';
			readonly overlay: GuardClassificationOverlaySnapshot;
	  }
	| {
			readonly diagnostics: readonly GuardClassificationOverlayDiagnostic[];
			readonly outcome: 'unavailable';
	  };

export type GuardClassificationOverlayProgressPhase =
	| 'REQUEST_BIND'
	| 'GUARD_VALIDATE'
	| 'STATE_OBSERVATION_VALIDATE'
	| 'STATE_GRAPH_VALIDATE'
	| 'ARROW_VALIDATE'
	| 'HANDLER_GRAPH_VALIDATE'
	| 'SHARED_SOURCE_RECONCILE'
	| 'TRANSITION_JOIN'
	| 'COMMAND_EVIDENCE_JOIN'
	| 'ENFORCEMENT_ANCHOR_BIND'
	| 'HANDLER_CORRELATE'
	| 'FRONTIER_RECONCILE'
	| 'MATERIALIZE'
	| 'SERIALIZE'
	| 'OVERLAY_VALIDATE';

export interface GuardClassificationOverlayProgressEvent {
	readonly counts: Readonly<Record<string, number>>;
	readonly detailCode: string | null;
	readonly phase: GuardClassificationOverlayProgressPhase;
	readonly schemaVersion: typeof GUARD_CLASSIFICATION_OVERLAY_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly state: 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'STARTED';
}

export interface BuildGuardClassificationOverlayOptions {
	readonly onProgress?: (event: GuardClassificationOverlayProgressEvent) => void;
}

export interface GuardClassificationOverlayValidationOptions {
	readonly maxDepth?: number;
	readonly maxInputRecords?: number;
	readonly maxInputStringCharacters?: number;
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export interface GuardClassificationOverlayValidationIssue {
	readonly code:
		| 'BUDGET_EXHAUSTED'
		| 'INPUT_INVALID'
		| 'INVALID_VALUE'
		| 'POPULATION_MISMATCH'
		| 'SHAPE_INVALID';
	readonly message: string;
	readonly path: string;
}

export interface GuardClassificationOverlayValidationResult {
	readonly issues: readonly GuardClassificationOverlayValidationIssue[];
	readonly state: 'BUDGET_EXHAUSTED' | 'INVALID' | 'VALID';
}
