import type { ConfigurationClosureRecord, FrozenSubject, ProgramRecipe } from './subject.js';
import type {
	SemanticProgramId,
	SemanticProjectId,
	SemanticSnapshotId,
	SemanticSourceId,
	StaticSemanticSnapshot
} from './semantic.js';

export const PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION =
	'jan-csaa-project-context-graph-request/1.0.0' as const;
export const PROJECT_CONTEXT_GRAPH_SCHEMA_VERSION = 'jan-csaa-project-context-graph/1.0.0' as const;
export const PROJECT_CONTEXT_GRAPH_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-project-context-graph-progress/1.0.0' as const;
export const PROJECT_CONTEXT_GRAPH_OPERATION_VERSION =
	'jan-csaa-build-project-context-graph/0.1.0' as const;
export const PROJECT_CONTEXT_GRAPH_CANONICAL_PROFILE =
	'jan-csaa-project-context-graph-canonical/1.0.0' as const;
export const PROJECT_CONTEXT_GRAPH_METHOD =
	'validated-frozen-project-context-projection/1.0.0' as const;
export const PROJECT_CONTEXT_GRAPH_CAPABILITY = 'JAN-CSAA-CAP-010' as const;
export const PROJECT_CONTEXT_GRAPH_CAPABILITY_STATUS = 'PARTIAL' as const;
export const PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE = 'NOT_CLAIMED' as const;
export const PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY = 'NONE' as const;
export const PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER = 'NONE' as const;
export const PROJECT_CONTEXT_GRAPH_GATE_EFFECT = 'NONE' as const;
export const PROJECT_CONTEXT_GRAPH_FRESHNESS = 'NOT_ASSESSED' as const;
export const PROJECT_CONTEXT_GRAPH_CURRENTNESS = 'NOT_CLAIMED' as const;

export const PROJECT_CONTEXT_GRAPH_SELECTION = Object.freeze({
	effectiveConfigurationPolicy: 'FROZEN_PROGRAM_RECIPE_WITNESS_ONLY',
	membershipRelations: Object.freeze(['PROJECT_HAS_PROGRAM', 'PROGRAM_HAS_SOURCE'] as const),
	programPopulation: 'ALL_VALIDATED_SEMANTIC_PROGRAMS',
	projectPopulation: 'ALL_VALIDATED_SEMANTIC_PROJECTS',
	projectReferencePopulation: 'ALL_DECLARED_SEMANTIC_PROJECT_REFERENCES',
	referenceResolutionBasis: 'EXACT_CANONICAL_CONFIG_PATH_WITHIN_SELECTED_PROJECT_POPULATION',
	sourcePopulation: 'ALL_VALIDATED_SEMANTIC_SOURCES',
	variantPolicy: 'NO_VARIANTS_INFERRED'
} as const);

export const PROJECT_CONTEXT_GRAPH_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_010_PROJECT_REFERENCE_AND_VARIANT_RESOLUTION',
	'INFERRED_NORMAL_BUILD_TEST_GENERATED_OR_CONSUMER_VARIANTS',
	'CONFIGURATION_INHERITANCE_BEYOND_FROZEN_PROGRAM_RECIPE',
	'CUSTOM_BUILD_SYSTEM_OR_RUNTIME_PROJECT_MEMBERSHIP',
	'PROJECT_OR_PROGRAM_SEMANTIC_EQUIVALENCE',
	'JAN_CSAA_CAP_011_PATH_ALIAS_OR_MODULE_RESOLUTION',
	'JAN_CSAA_CAP_012_CONDITIONAL_EXPORT_RESOLUTION',
	'JAN_CSAA_CAP_013_DECLARATION_OR_MODULE_AUGMENTATION',
	'JAN_CSAA_CAP_014_SOURCE_MAP_OR_SOURCE_ORIGIN_CORRELATION',
	'GENERATED_SOURCE_LINEAGE_BEYOND_RETAINED_ORIGIN_FACTS',
	'BUILD_SUCCESS_OR_RUNTIME_LOADABILITY',
	'CURRENTNESS_OR_FRESHNESS',
	'FINDING_GATE_DECISION_OR_REMEDIATION_AUTHORITY'
] as const);

declare const projectContextGraphBrand: unique symbol;
type Branded<Kind extends string> = string & { readonly [projectContextGraphBrand]: Kind };

export type ProjectContextGraphId = Branded<'ProjectContextGraph'>;
export type ProjectContextProjectId = Branded<'ProjectContextProject'>;
export type ProjectContextProgramId = Branded<'ProjectContextProgram'>;
export type ProjectContextSourceId = Branded<'ProjectContextSource'>;
export type ProjectContextMembershipId = Branded<'ProjectContextMembership'>;
export type ProjectContextReferenceId = Branded<'ProjectContextReference'>;

export interface ProjectContextGraphBudgets {
	readonly maxConfigurationClosureRecords: number;
	readonly maxDiagnostics: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxMemberships: number;
	readonly maxOutputRecords: number;
	readonly maxPrograms: number;
	readonly maxProjectReferences: number;
	readonly maxProjects: number;
	readonly maxSources: number;
	readonly maxTraversalSteps: number;
}

export interface ProjectContextGraphRequest {
	readonly budgets: ProjectContextGraphBudgets;
	readonly operationVersion: typeof PROJECT_CONTEXT_GRAPH_OPERATION_VERSION;
	readonly schemaVersion: typeof PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION;
	readonly selection: typeof PROJECT_CONTEXT_GRAPH_SELECTION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export interface ProjectContextGraphBuildInputs {
	readonly frozenSubject: FrozenSubject;
	readonly request: ProjectContextGraphRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export type ProjectContextGraphInputs = ProjectContextGraphBuildInputs;

export interface ProjectContextProjectRecord {
	readonly configurationClosure: readonly ConfigurationClosureRecord[];
	readonly configPath: string;
	readonly health: StaticSemanticSnapshot['projects'][number]['health'];
	readonly id: ProjectContextProjectId;
	readonly kind: StaticSemanticSnapshot['projects'][number]['kind'];
	readonly ordinal: number;
	readonly partialityReasons: StaticSemanticSnapshot['projects'][number]['partialityReasons'];
	readonly programId: ProjectContextProgramId;
	readonly programRecipe: ProgramRecipe;
	readonly rootDisposition: StaticSemanticSnapshot['projects'][number]['rootDisposition'];
	readonly rootNames: readonly string[];
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly sourceIds: readonly ProjectContextSourceId[];
}

export interface ProjectContextProgramRecord {
	readonly checkerState: StaticSemanticSnapshot['programs'][number]['checkerState'];
	readonly contextDigest: string;
	readonly id: ProjectContextProgramId;
	readonly ordinal: number;
	readonly projectId: ProjectContextProjectId;
	readonly rootSourceIds: readonly ProjectContextSourceId[];
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly sourceIds: readonly ProjectContextSourceId[];
}

export interface ProjectContextSourceRecord {
	readonly analysisDisposition: StaticSemanticSnapshot['sources'][number]['analysisDisposition'];
	readonly declarationFile: boolean;
	readonly id: ProjectContextSourceId;
	readonly logicalPath: string;
	readonly ordinal: number;
	readonly origin: StaticSemanticSnapshot['sources'][number]['origin'];
	readonly programId: ProjectContextProgramId;
	readonly projectId: ProjectContextProjectId;
	readonly rootFile: boolean;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
}

export interface ProjectContextProjectProgramMembership {
	readonly id: ProjectContextMembershipId;
	readonly kind: 'PROJECT_HAS_PROGRAM';
	readonly ordinal: number;
	readonly programId: ProjectContextProgramId;
	readonly projectId: ProjectContextProjectId;
}

export interface ProjectContextProgramSourceMembership {
	readonly id: ProjectContextMembershipId;
	readonly kind: 'PROGRAM_HAS_SOURCE';
	readonly ordinal: number;
	readonly programId: ProjectContextProgramId;
	readonly sourceId: ProjectContextSourceId;
}

export type ProjectContextMembership =
	ProjectContextProjectProgramMembership | ProjectContextProgramSourceMembership;

export interface ProjectContextGraphProjectReference {
	readonly declaredTargetConfigPath: string;
	readonly fromConfigPath: string;
	readonly fromProjectId: ProjectContextProjectId;
	readonly id: ProjectContextReferenceId;
	readonly ordinal: number;
	readonly resolution: 'RESOLVED_SELECTED_PROJECT';
	readonly targetProjectId: ProjectContextProjectId;
}

export interface ProjectContextSemanticValidationWitness {
	readonly context: 'FROZEN_SUBJECT';
	readonly frozenSubjectSha256: string;
	readonly method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT';
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly semanticSnapshotSha256: string;
	readonly state: 'VALID';
	readonly subjectId: string;
}

export interface ProjectContextGraphCoverage {
	readonly chargedInputTraversalSteps: number;
	readonly configurationClosureRecords: number;
	readonly declaredProjectReferences: number;
	readonly inputPrograms: number;
	readonly inputProjects: number;
	readonly inputSources: number;
	readonly memberships: number;
	readonly outsideSelectedProjectReferences: 0;
	readonly programPopulationReconciles: true;
	readonly programSourceMemberships: number;
	readonly projectPopulationReconciles: true;
	readonly projectedPrograms: number;
	readonly projectedProjects: number;
	readonly projectedSources: number;
	readonly projectProgramMemberships: number;
	readonly referencePopulationReconciles: true;
	readonly resolvedProjectReferences: number;
	readonly sourcePopulationReconciles: true;
	readonly unresolvedProjectReferences: 0;
}

export interface ProjectContextGraphSnapshot {
	readonly authorityTransfer: typeof PROJECT_CONTEXT_GRAPH_AUTHORITY_TRANSFER;
	readonly budgets: ProjectContextGraphBudgets;
	readonly canonicalProfile: typeof PROJECT_CONTEXT_GRAPH_CANONICAL_PROFILE;
	readonly capability: typeof PROJECT_CONTEXT_GRAPH_CAPABILITY;
	readonly capabilityStatus: typeof PROJECT_CONTEXT_GRAPH_CAPABILITY_STATUS;
	readonly closure: 'CLOSED_FOR_ALL_DECLARED_PROJECT_REFERENCES';
	readonly contentDigest: string;
	readonly coverage: ProjectContextGraphCoverage;
	readonly currentness: typeof PROJECT_CONTEXT_GRAPH_CURRENTNESS;
	readonly freshness: typeof PROJECT_CONTEXT_GRAPH_FRESHNESS;
	readonly fullJanCsaa010Conformance: typeof PROJECT_CONTEXT_GRAPH_FULL_JAN_CSAA_010_CONFORMANCE;
	readonly gateEffect: typeof PROJECT_CONTEXT_GRAPH_GATE_EFFECT;
	readonly graphAuthority: typeof PROJECT_CONTEXT_GRAPH_GRAPH_AUTHORITY;
	readonly health: 'PARTIAL';
	readonly id: ProjectContextGraphId;
	readonly inputDigest: string;
	readonly memberships: readonly ProjectContextMembership[];
	readonly method: typeof PROJECT_CONTEXT_GRAPH_METHOD;
	readonly nonclaims: typeof PROJECT_CONTEXT_GRAPH_NONCLAIMS;
	readonly operationVersion: typeof PROJECT_CONTEXT_GRAPH_OPERATION_VERSION;
	readonly outsideSelectedProjectReferences: readonly [];
	readonly programs: readonly ProjectContextProgramRecord[];
	readonly projectReferences: readonly ProjectContextGraphProjectReference[];
	readonly projects: readonly ProjectContextProjectRecord[];
	readonly resultCompleteness: 'COMPLETE_FOR_VALIDATED_SELECTED_PROJECT_CONTEXT_POPULATIONS';
	readonly schemaVersion: typeof PROJECT_CONTEXT_GRAPH_SCHEMA_VERSION;
	readonly selection: typeof PROJECT_CONTEXT_GRAPH_SELECTION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly semanticValidationWitness: ProjectContextSemanticValidationWitness;
	readonly sources: readonly ProjectContextSourceRecord[];
	readonly subjectId: string;
	readonly truncation: { readonly reason: null; readonly state: 'NOT_TRUNCATED' };
	readonly unresolvedProjectReferences: readonly [];
}

export type ProjectContextGraphResult = ProjectContextGraphSnapshot;

export type ProjectContextGraphDiagnosticCode =
	| 'BUDGET_EXCEEDED'
	| 'GRAPH_VALIDATION_FAILED'
	| 'INPUT_IDENTITY_MISMATCH'
	| 'INPUT_POPULATION_MISMATCH'
	| 'REQUEST_INVALID'
	| 'SEMANTIC_SNAPSHOT_INVALID';

export interface ProjectContextGraphDiagnostic {
	readonly code: ProjectContextGraphDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'BIND' | 'MATERIALIZE' | 'PROJECT' | 'REFERENCE' | 'REQUEST' | 'VALIDATE';
}

export type ProjectContextGraphBuildOutcome =
	| {
			readonly diagnostics: readonly ProjectContextGraphDiagnostic[];
			readonly graph: ProjectContextGraphSnapshot;
			readonly outcome: 'partial';
	  }
	| {
			readonly diagnostics: readonly ProjectContextGraphDiagnostic[];
			readonly outcome: 'unavailable';
	  };

export type ProjectContextGraphProgressPhase =
	| 'REQUEST_BIND'
	| 'INPUT_BUDGET'
	| 'SEMANTIC_SNAPSHOT_VALIDATE'
	| 'PROJECT_CONTEXT_PROJECT'
	| 'REFERENCE_RESOLUTION'
	| 'MEMBERSHIP_PROJECT'
	| 'POPULATION_RECONCILE'
	| 'MATERIALIZE'
	| 'SERIALIZE'
	| 'GRAPH_VALIDATE';

export interface ProjectContextGraphProgressEvent {
	readonly counts: Readonly<Record<string, number>>;
	readonly detailCode: string | null;
	readonly phase: ProjectContextGraphProgressPhase;
	readonly schemaVersion: typeof PROJECT_CONTEXT_GRAPH_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly state: 'COMPLETED' | 'FAILED' | 'STARTED';
}

export interface BuildProjectContextGraphOptions {
	readonly onProgress?: (event: ProjectContextGraphProgressEvent) => void;
}

export interface ProjectContextGraphValidationOptions {
	readonly maxDepth?: number;
	readonly maxInputRecords?: number;
	readonly maxInputStringCharacters?: number;
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type ProjectContextGraphValidationIssueCode =
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'INPUT_INVALID'
	| 'POPULATION_MISMATCH'
	| 'SHAPE_INVALID';

export interface ProjectContextGraphValidationIssue {
	readonly code: ProjectContextGraphValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export type ProjectContextGraphValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly ProjectContextGraphValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };
