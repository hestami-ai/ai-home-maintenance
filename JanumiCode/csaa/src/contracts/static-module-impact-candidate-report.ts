import type {
	ModuleDependencyGraphEdgeId,
	ModuleDependencyGraphEpistemicState,
	ModuleDependencyGraphHealth,
	ModuleDependencyGraphId,
	ModuleDependencyGraphLimitation,
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphRelationKind,
	ModuleDependencyGraphSourceLocation
} from './graph.js';
import type {
	SemanticModuleOccurrenceKind,
	SemanticProgramId,
	SemanticProjectId,
	SemanticSnapshotId,
	SemanticSourceId
} from './semantic.js';
import {
	STRUCTURAL_MODULE_REACHABILITY_REPORT_SAFETY_CEILINGS,
	type StructuralModuleReachabilityReportBudgets,
	type StructuralModuleReachabilityReportDiagnostic,
	type StructuralModuleReachabilityReportPartialOutcome
} from './structural-module-reachability-report.js';
import type { CapturedArtifactRecord, SubjectDescriptor } from './subject.js';

/**
 * An implementation-local, one-seed projection over validated reverse static module reachability.
 * It reports possible importer candidates only. It is not CAP-031, a ChangeSeedRecord, a
 * ChangeImpactResultRecord, or completion evidence for DWP-005/DWP-006.
 */
export const STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION =
	'jan-csaa-static-module-impact-candidate-report-request/0.1.0' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION =
	'jan-csaa-static-module-impact-candidate-report/0.1.0' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION =
	'jan-csaa-static-module-impact-candidate-report-result/0.1.0' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION =
	'jan-csaa-report-static-module-impact-candidates/0.1.0' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION =
	'jan-csaa-caller-declared-source-edit-seed/0.1.0' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_METHOD =
	'validated-reverse-module-importer-candidate-projection/1.0.0' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY =
	'IMPLEMENTATION_LOCAL_STATIC_MODULE_IMPACT_CANDIDATES' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY_STATUS =
	'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY = 'NONE' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER = 'NONE' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT = 'NONE' as const;
export const STATIC_MODULE_IMPACT_CANDIDATE_FULL_CAP_031 = 'NOT_CLAIMED' as const;

export const STATIC_MODULE_IMPACT_CANDIDATE_RELATION_KINDS = Object.freeze([
	'DYNAMIC_IMPORT_OCCURRENCE',
	'EXPORT_OCCURRENCE',
	'IMPORT_EQUALS_OCCURRENCE',
	'IMPORT_OCCURRENCE',
	'IMPORT_TYPE_OCCURRENCE'
] as const satisfies readonly ModuleDependencyGraphRelationKind[]);

export const STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION = Object.freeze({
	candidatePopulation: 'ALL_REVERSE_REACHABLE_SOURCE_MEMBERS_EXCEPT_SEED',
	direction: 'REVERSE',
	impactEpistemicState: 'POSSIBLE',
	method: STATIC_MODULE_IMPACT_CANDIDATE_METHOD,
	nativeEdgeOrientation: 'IMPORTER_TO_IMPORTED',
	relationFamily: 'TYPESCRIPT_MODULE_RESOLUTION',
	relationKinds: STATIC_MODULE_IMPACT_CANDIDATE_RELATION_KINDS,
	seedPopulation: 'ONE_CALLER_DECLARED_EXISTING_SOURCE_EDIT',
	witnessPolicy: 'CANONICAL_SHORTEST_FIRST_DISCOVERY_PREDECESSOR_FOREST'
} as const);

export const STATIC_MODULE_IMPACT_CANDIDATE_NEXT_EVIDENCE = Object.freeze([
	'VALIDATED_WORKING_CHANGE_CONTENT_OR_CROSS_SNAPSHOT_DIFF',
	'SYMBOL_REFERENCE_CALL_CONTROL_AND_DATA_FLOW_PROPAGATION',
	'FRAMEWORK_GENERATED_CONFIGURATION_AND_ENTRY_MECHANISM_PROPAGATION',
	'RELEVANT_TEST_MAPPING_AND_EXECUTION_EVIDENCE',
	'RUNTIME_OBSERVATION_WHERE_STATIC_CLOSURE_IS_INSUFFICIENT'
] as const);

export const STATIC_MODULE_IMPACT_CANDIDATE_UNASSESSED_PROPAGATION_FAMILIES = Object.freeze([
	'CALL_GRAPH',
	'CONTROL_FLOW',
	'DATA_FLOW',
	'STATE_AND_EFFECT',
	'FRAMEWORK',
	'GENERATED_CODE',
	'CONFIGURATION',
	'ENTRY_MECHANISMS',
	'RULES',
	'TEST_MAPPING',
	'RUNTIME'
] as const);

export const STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_031_CHANGE_IMPACT',
	'DWP_005_OR_DWP_006_COMPLETION',
	'G5_G6_OR_ANY_GATE',
	'REGISTERED_JAN_CSAA_007_IMPACT_OPERATION_OR_FULL_JAN_CSAA_007_008_CONFORMANCE',
	'JAN_CSAA_CHANGE_SEED_RECORD_OR_CHANGE_IMPACT_RESULT_RECORD',
	'VALIDATED_WORKING_CHANGE_CONTENT_CROSS_SNAPSHOT_OR_REVISION_BINDING',
	'SEED_CLASSES_BEYOND_ONE_CALLER_DECLARED_EXISTING_WHOLE_SOURCE_EDIT',
	'GRAPH_FAMILIES_BEYOND_TYPESCRIPT_MODULE_DEPENDENCY',
	'DEFINITE_DIRECT_OR_TRANSITIVE_BREAKAGE',
	'CALL_CONTROL_DATA_STATE_FRAMEWORK_GENERATED_CONFIGURATION_RUNTIME_OR_RULE_IMPACT',
	'TEST_SELECTION_RULE_AFFECTED_OR_BEHAVIORAL_PRESERVATION_PROOF',
	'NOT_AFFECTED_UNVISITED_IRRELEVANCE_DEAD_CODE_OR_SAFE_REMOVAL',
	'FINDING_SEVERITY_GATE_REMEDIATION_DISPOSITION_MERGE_OR_DESIGN_AUTHORITY',
	'PROVIDER_QUALIFICATION_OR_ORACLE_CONFERRAL'
] as const);

/**
 * Operation-version resource reservation used before duplicated witness paths are allocated. This
 * is intentionally larger than the current minimum canonical wire contribution of one hop and is
 * not an assertion that every admitted hop will fit within this many output bytes.
 */
export const STATIC_MODULE_IMPACT_CANDIDATE_WITNESS_HOP_RESULT_BYTE_RESERVATION = 4_096 as const;

/** Fixed non-witness outer-envelope reservation applied after the exact predecessor result bytes. */
export const STATIC_MODULE_IMPACT_CANDIDATE_OUTER_RESULT_BASE_BYTE_RESERVATION = 64 * 1024;

export const STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SAFETY_CEILINGS = Object.freeze({
	...STRUCTURAL_MODULE_REACHABILITY_REPORT_SAFETY_CEILINGS,
	/**
	 * Bounds cumulative duplicated seed-to-candidate witness hops before path allocation. The
	 * runtime further lowers this limit from maxResultBytes using the per-hop resource reservation.
	 */
	maxCandidateWitnessHops: Math.floor(
		STRUCTURAL_MODULE_REACHABILITY_REPORT_SAFETY_CEILINGS.maxResultBytes /
			STATIC_MODULE_IMPACT_CANDIDATE_WITNESS_HOP_RESULT_BYTE_RESERVATION
	)
} as const);

export interface StaticModuleImpactCandidateReportBudgets extends StructuralModuleReachabilityReportBudgets {
	/** Sum of every published candidate witness hop, not only unique predecessor-forest edges. */
	readonly maxCandidateWitnessHops: number;
}

export interface StaticModuleImpactCandidateSeedRequest {
	/** Caller-owned stable identity; CSAA binds but does not independently validate its provenance. */
	readonly id: string;
	readonly basis: 'CALLER_DECLARED_WORKING_CHANGE_SET';
	/** Exact captured baseline digest expected by the caller. */
	readonly expectedArtifactSha256: string;
	readonly logicalPath: string;
	readonly operation: 'EDIT';
	readonly projectConfigPath: string;
	readonly schemaVersion: typeof STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION;
	readonly scope: 'WHOLE_SOURCE';
	/** Opaque caller-owned identity; existence/content are not independently validated by this facade. */
	readonly workingChangeSetId: string;
}

export interface StaticModuleImpactCandidateReportRequest {
	readonly budgets: StaticModuleImpactCandidateReportBudgets;
	readonly operationVersion: typeof STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION;
	readonly schemaVersion: typeof STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION;
	readonly seed: StaticModuleImpactCandidateSeedRequest;
	/** Explicit bounded semantic subject closure; no workspace project is inferred silently. */
	readonly subjectProjectConfigPaths: readonly string[];
}

export type StaticModuleImpactCandidateReportStage =
	'REQUEST' | 'PREDECESSOR_REPORT' | 'CURRENTNESS' | 'SEED_BIND' | 'PROJECTION' | 'RESULT';

export interface StaticModuleImpactCandidateReportDiagnostic {
	readonly code: string;
	readonly message: string;
	readonly path: string | null;
	readonly predecessorPhase: string | null;
	readonly predecessorSource: StructuralModuleReachabilityReportDiagnostic['source'] | null;
	readonly severity: 'INFO' | 'WARNING' | 'ERROR' | null;
	readonly source: 'REPORT' | 'PREDECESSOR_REPORT';
}

export interface StaticModuleImpactCandidateWitnessStep {
	readonly edgeId: ModuleDependencyGraphEdgeId;
	readonly edgeEpistemic: ModuleDependencyGraphEpistemicState;
	readonly fromSeedTowardCandidateNodeId: ModuleDependencyGraphNodeId;
	readonly nativeImportedNodeId: ModuleDependencyGraphNodeId;
	readonly nativeImporterNodeId: ModuleDependencyGraphNodeId;
	readonly occurrenceKind: SemanticModuleOccurrenceKind;
	readonly ordinal: number;
	readonly relationKind: ModuleDependencyGraphRelationKind;
	readonly sourceLocations: readonly ModuleDependencyGraphSourceLocation[];
	readonly specifier: string | null;
	readonly toCandidateNodeId: ModuleDependencyGraphNodeId;
	readonly typeOnly: boolean;
}

export interface StaticModuleImpactCandidateWitness {
	readonly edgeIdsInTraversalOrder: readonly ModuleDependencyGraphEdgeId[];
	readonly hopCount: number;
	readonly nativeEdgeOrientation: 'IMPORTER_TO_IMPORTED';
	readonly seedToCandidateNodeIds: readonly ModuleDependencyGraphNodeId[];
	readonly steps: readonly StaticModuleImpactCandidateWitnessStep[];
	readonly traversalDirection: 'REVERSE';
}

export interface StaticModuleImpactCandidateRecord {
	readonly candidateKind: 'STATIC_MODULE_IMPORTER_SOURCE';
	readonly analysisDisposition: 'DEEP_INDEXED' | 'CONTEXT_ONLY';
	readonly distance: number;
	/** Possible impact only; structural direct/transitive depth is reported separately. */
	readonly impactEpistemicState: 'POSSIBLE';
	readonly logicalPath: string;
	readonly nextEvidenceNeeded: typeof STATIC_MODULE_IMPACT_CANDIDATE_NEXT_EVIDENCE;
	readonly nodeId: ModuleDependencyGraphNodeId;
	readonly ordinal: number;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
	readonly structuralRelationship:
		'DIRECT_STATIC_MODULE_IMPORTER' | 'TRANSITIVE_STATIC_MODULE_IMPORTER';
	readonly structuralEvidenceState: ModuleDependencyGraphEpistemicState;
	readonly witness: StaticModuleImpactCandidateWitness;
}

export interface StaticModuleImpactCandidateSeedBinding {
	readonly analysisDisposition: 'DEEP_INDEXED';
	readonly artifact: CapturedArtifactRecord;
	readonly bindingState: 'BOUND_TO_CURRENT_CAPTURED_SOURCE';
	readonly graphId: ModuleDependencyGraphId;
	readonly graphNodeId: ModuleDependencyGraphNodeId;
	readonly logicalPath: string;
	readonly operation: 'EDIT';
	readonly programId: SemanticProgramId;
	readonly projectConfigPath: string;
	readonly projectId: SemanticProjectId;
	readonly schemaVersion: typeof STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION;
	readonly scope: 'WHOLE_SOURCE';
	readonly seedId: string;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly semanticSourceId: SemanticSourceId;
	readonly subjectId: string;
	readonly structuralEvidenceState: ModuleDependencyGraphEpistemicState;
	readonly workingChangeSet: {
		readonly basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_VALIDATED';
		readonly id: string;
	};
}

export interface StaticModuleImpactCandidateReportResult {
	readonly capability: {
		readonly fullJanCsaaCap031: typeof STATIC_MODULE_IMPACT_CANDIDATE_FULL_CAP_031;
		readonly id: typeof STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY;
		readonly predecessorCapability: 'JAN-CSAA-CAP-027';
		readonly predecessorStatus: 'PARTIAL';
		readonly status: typeof STATIC_MODULE_IMPACT_CANDIDATE_CAPABILITY_STATUS;
	};
	readonly candidates: readonly StaticModuleImpactCandidateRecord[];
	readonly conclusion:
		| 'STATIC_MODULE_IMPORTER_CANDIDATES_OBSERVED'
		| 'NO_STATIC_MODULE_IMPORTER_CANDIDATES_OBSERVED_WITHIN_SELECTED_GRAPH';
	readonly coverage: {
		readonly candidateWitnessHops: number;
		readonly candidates: number;
		readonly directCandidates: number;
		readonly transitiveCandidates: number;
		readonly unvisitedGraphNodes: number;
	};
	readonly currentness: StructuralModuleReachabilityReportPartialOutcome['result']['currentness'] & {
		readonly finalFacadeVerification: 'RECHECKED_AFTER_PROJECTION_AND_RESULT_SIZE_ACCOUNTING';
	};
	readonly evidence: {
		readonly encoding: 'FULL_PREDECESSOR_REPORT_PLUS_SEED_TO_CANDIDATE_WITNESS_PATHS';
		readonly predecessorReport: StructuralModuleReachabilityReportPartialOutcome;
	};
	readonly exclusions: {
		readonly callerQueryExclusions: 'NONE_SUPPORTED';
		readonly subjectExcludedClasses: SubjectDescriptor['excludedClasses'];
		readonly subjectExclusionPolicyIds: SubjectDescriptor['exclusionPolicyIds'];
		readonly subjectPerimeter: SubjectDescriptor['perimeter'];
	};
	readonly facadeNonclaims: typeof STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS;
	readonly globalImpactClosure: 'OPEN';
	readonly invalidationDependencies: {
		readonly artifactSha256: string;
		readonly predecessorAnalysisContentDigest: string;
		readonly predecessorAnalysisId: string;
		readonly semanticSnapshotId: SemanticSnapshotId;
		readonly sourceGraphContentDigest: string;
		readonly sourceGraphId: ModuleDependencyGraphId;
		readonly sourceGraphInputDigest: string;
		readonly subjectId: string;
		readonly workingChangeSetId: string;
	};
	readonly propagation: typeof STATIC_MODULE_IMPACT_CANDIDATE_PROPAGATION;
	readonly schemaVersion: typeof STATIC_MODULE_IMPACT_CANDIDATE_REPORT_RESULT_SCHEMA_VERSION;
	readonly seed: StaticModuleImpactCandidateSeedBinding;
	readonly uncertainty: {
		readonly encounteredFrontiers: StructuralModuleReachabilityReportPartialOutcome['result']['analysis']['encounteredFrontiers'];
		readonly entryMechanisms: 'NOT_ASSESSED';
		readonly graphEpistemic: ModuleDependencyGraphEpistemicState;
		readonly graphHealth: ModuleDependencyGraphHealth;
		readonly nextEvidenceNeeded: typeof STATIC_MODULE_IMPACT_CANDIDATE_NEXT_EVIDENCE;
		readonly runtimeBehavior: 'NOT_ASSESSED';
		readonly structuralClosure: 'EXACT_FOR_SELECTED_VALIDATED_GRAPH_AND_CRITERION';
		readonly unassessedPropagationFamilies: typeof STATIC_MODULE_IMPACT_CANDIDATE_UNASSESSED_PROPAGATION_FAMILIES;
		readonly unvisitedNodeInterpretation: 'NO_IMPACT_OR_IRRELEVANCE_STATE_ASSIGNED';
		readonly upstreamClosure: 'CLOSED' | 'OPEN';
		readonly upstreamLimitations: readonly ModuleDependencyGraphLimitation[];
	};
}

export interface StaticModuleImpactCandidateReportPartialOutcome {
	readonly analysisAuthority: typeof STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY;
	readonly authorityTransfer: typeof STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER;
	readonly diagnostics: readonly StaticModuleImpactCandidateReportDiagnostic[];
	readonly gateEffect: typeof STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT;
	readonly operationVersion: typeof STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION;
	readonly outcome: 'partial';
	readonly request: StaticModuleImpactCandidateReportRequest;
	readonly result: StaticModuleImpactCandidateReportResult;
	readonly schemaVersion: typeof STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION;
	readonly state: 'partial';
	readonly subject: SubjectDescriptor;
}

export type StaticModuleImpactCandidateReportFailureState =
	'failed' | 'incompatible' | 'resource-refused' | 'stale';

export interface StaticModuleImpactCandidateReportUnavailableOutcome {
	readonly analysisAuthority: typeof STATIC_MODULE_IMPACT_CANDIDATE_ANALYSIS_AUTHORITY;
	readonly authorityTransfer: typeof STATIC_MODULE_IMPACT_CANDIDATE_AUTHORITY_TRANSFER;
	readonly code: string;
	readonly diagnostics: readonly StaticModuleImpactCandidateReportDiagnostic[];
	readonly facadeNonclaims: typeof STATIC_MODULE_IMPACT_CANDIDATE_REPORT_NONCLAIMS;
	readonly gateEffect: typeof STATIC_MODULE_IMPACT_CANDIDATE_GATE_EFFECT;
	readonly operationVersion: typeof STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION;
	readonly outcome: 'unavailable';
	readonly request?: StaticModuleImpactCandidateReportRequest;
	readonly schemaVersion: typeof STATIC_MODULE_IMPACT_CANDIDATE_REPORT_SCHEMA_VERSION;
	readonly stage: StaticModuleImpactCandidateReportStage;
	readonly state: StaticModuleImpactCandidateReportFailureState;
	readonly subject?: SubjectDescriptor;
}

export type StaticModuleImpactCandidateReportOutcome =
	| StaticModuleImpactCandidateReportPartialOutcome
	| StaticModuleImpactCandidateReportUnavailableOutcome;
