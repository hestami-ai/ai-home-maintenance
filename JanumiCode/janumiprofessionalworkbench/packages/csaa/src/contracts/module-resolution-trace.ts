import type {
	ConditionalExportResolutionId,
	ConditionalExportResolutionRequest,
	ConditionalExportResolutionSnapshot
} from './conditional-export-resolution.js';
import type {
	ProjectContextGraphId,
	ProjectContextGraphSnapshot,
	ProjectContextProgramId,
	ProjectContextProjectId,
	ProjectContextSourceId
} from './project-context-graph.js';
import type {
	CompilerInputObservation,
	SemanticContextInputId,
	SemanticModuleResolutionId,
	SemanticNodeId,
	SemanticProgramId,
	SemanticProjectId,
	SemanticSnapshotId,
	SemanticSourceId,
	SourceOrigin,
	StaticSemanticSnapshot
} from './semantic.js';
import type { ArtifactPrimaryClass, FrozenSubject } from './subject.js';
import type { CompilerInputQuery } from '../providers/typescript/compiler-input-journal.js';

export const MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION =
	'jan-csaa-module-resolution-trace-request/1.0.0' as const;
export const MODULE_RESOLUTION_TRACE_SCHEMA_VERSION =
	'jan-csaa-module-resolution-trace/1.0.0' as const;
export const MODULE_RESOLUTION_TRACE_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-module-resolution-trace-progress/1.0.0' as const;
export const MODULE_RESOLUTION_TRACE_OPERATION_VERSION =
	'jan-csaa-build-module-resolution-trace/0.1.0' as const;
export const MODULE_RESOLUTION_TRACE_CANONICAL_PROFILE =
	'jan-csaa-module-resolution-trace-canonical/1.0.0' as const;
export const MODULE_RESOLUTION_TRACE_METHOD =
	'validated-typescript-public-resolve-module-name-over-project-scoped-capture/1.0.0' as const;
export const MODULE_RESOLUTION_TRACE_CAPABILITY = 'JAN-CSAA-CAP-011' as const;
export const MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS = 'PARTIAL' as const;
export const MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE = 'NOT_CLAIMED' as const;
export const MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;
export const MODULE_RESOLUTION_TRACE_AUTHORITY = 'NONE' as const;
export const MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER = 'NONE' as const;
export const MODULE_RESOLUTION_TRACE_GATE_EFFECT = 'NONE' as const;
export const MODULE_RESOLUTION_TRACE_FRESHNESS = 'NOT_ASSESSED' as const;
export const MODULE_RESOLUTION_TRACE_CURRENTNESS = 'NOT_CLAIMED' as const;

/** The only accepted v1 request surface. Any other surface is unavailable. */
export const MODULE_RESOLUTION_TRACE_SELECTION = Object.freeze({
	acceptedOutcome: 'RESOLVED_DECLARATION_BUILD_OUTPUT',
	candidateDerivation: 'MODULE_RESOLUTION_STAGE_FILE_EXISTS_CALLBACKS_ONLY',
	compilerApi: 'TYPESCRIPT_PUBLIC_RESOLVE_MODULE_NAME',
	conditionalExportExplicitConditions: Object.freeze(['types'] as const),
	conditionalExportModuleMode: 'IMPORT',
	conditionalExportPlatform: 'NODE',
	conditionOrderAuthority: 'MEMBERSHIP_ONLY_ORDER_NOT_CLAIMED',
	importerPopulation: 'ONE_EXACT_SEMANTIC_LITERAL_BARE_IMPORT_OCCURRENCE',
	impliedNodeFormatApi: 'TYPESCRIPT_PUBLIC_GET_IMPLIED_NODE_FORMAT_FOR_FILE',
	moduleModeApi: 'TYPESCRIPT_PUBLIC_GET_MODE_FOR_USAGE_LOCATION',
	packagePopulation: 'ONE_EXACT_FROZEN_WORKSPACE_PACKAGE',
	resolutionHost: 'VERIFIED_PROJECT_SCOPED_CAPTURE_ONLY',
	specifierSyntax: 'BARE_WORKSPACE_PACKAGE_ROOT_LITERAL_ONLY',
	targetEvidence: 'EXACT_CAPTURED_READ_FILE_BYTES_AND_SEMANTIC_SOURCE',
	unsupportedTreatment: 'OPERATION_UNAVAILABLE_NEVER_PARTIAL_OUTPUT'
} as const);

export const MODULE_RESOLUTION_TRACE_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_011_PATH_ALIAS_OR_MODULE_RESOLUTION',
	'FULL_JAN_CSAA_007_CONFORMANCE',
	'FULL_JAN_CSAA_008_CONFORMANCE',
	'IMPORTER_OR_SPECIFIER_POPULATION_BEYOND_SELECTED_EXACT_OCCURRENCE',
	'PATH_ALIAS_RESOLUTION',
	'RELATIVE_SPECIFIER_RESOLUTION',
	'PACKAGE_SUBPATH_RESOLUTION_BEYOND_SELECTED_ROOT',
	'EXTERNAL_OR_NON_WORKSPACE_NODE_MODULES_RESOLUTION',
	'PACKAGE_IMPORTS_MAP_RESOLUTION',
	'FILE_EXTENSION_INDEX_OR_DIRECTORY_RESOLUTION_BEYOND_EXACT_TARGET',
	'CUSTOM_PLUGIN_PNP_OR_RUNTIME_LOADER_RESOLUTION',
	'SOURCE_CUSTOM_CONDITION_ACTIVATION',
	'CONDITION_MODE_OR_PLATFORM_UNIVERSALITY',
	'NODE_OR_TYPESCRIPT_RESOLVER_EQUIVALENCE_BEYOND_SELECTED_EXACT_REQUEST',
	'TARGET_RUNTIME_LOADABILITY_OR_BUILD_SUCCESS',
	'TARGET_DECLARATION_SEMANTIC_OR_TYPE_COMPATIBILITY',
	'DEPENDENCY_DECLARATION_IMPORT_OR_RUNTIME_LOAD_EQUIVALENCE',
	'UNRESOLVED_SPECIFIER_MEANS_ABSENT_DEPENDENCY',
	'ORIGINAL_TYPESCRIPT_PROGRAM_RESOLUTION_CACHE_OR_CALLBACK_ORDER',
	'PERSISTED_OR_DESERIALIZED_CAPTURE_REPLAY',
	'UNDOCUMENTED_TYPESCRIPT_INTERNAL_CONDITION_ARRAY_ORDER',
	'CURRENTNESS_OR_FRESHNESS',
	'PROVIDER_QUALIFICATION_OR_ORACLE_CONFERRAL',
	'FINDING_GATE_DECISION_OR_REMEDIATION_AUTHORITY'
] as const);

declare const moduleResolutionTraceBrand: unique symbol;
type Branded<Kind extends string> = string & { readonly [moduleResolutionTraceBrand]: Kind };

export type ModuleResolutionTraceId = Branded<'ModuleResolutionTrace'>;
export type ModuleResolutionAttemptId = Branded<'ModuleResolutionAttempt'>;
export type ModuleResolutionCandidateId = Branded<'ModuleResolutionCandidate'>;
export type ModuleResolutionRelationId = Branded<'ModuleResolutionRelation'>;

export interface ModuleResolutionTraceBudgets {
	readonly maxAstNodes: number;
	readonly maxAttempts: number;
	readonly maxCandidates: number;
	readonly maxDiagnostics: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxOutputRecords: number;
	readonly maxReadBytes: number;
	readonly maxTraversalSteps: number;
}

export interface ModuleResolutionTraceImporterCriterion {
	readonly projectContextProgramId: ProjectContextProgramId;
	readonly projectContextSourceId: ProjectContextSourceId;
	readonly semanticModuleResolutionId: SemanticModuleResolutionId;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticSourceId: SemanticSourceId;
	readonly specifierNodeId: SemanticNodeId;
}

export interface ModuleResolutionTraceProjectContextGraphReference {
	readonly contentDigest: string;
	readonly graphId: ProjectContextGraphId;
	readonly inputDigest: string;
}

export interface ModuleResolutionTraceConditionalExportReference {
	readonly contentDigest: string;
	readonly id: ConditionalExportResolutionId;
	readonly inputDigest: string;
}

export interface ModuleResolutionTraceRequest {
	readonly budgets: ModuleResolutionTraceBudgets;
	readonly conditionalExportResolution: ModuleResolutionTraceConditionalExportReference;
	readonly importer: ModuleResolutionTraceImporterCriterion;
	readonly operationVersion: typeof MODULE_RESOLUTION_TRACE_OPERATION_VERSION;
	readonly packageName: string;
	readonly projectContextGraph: ModuleResolutionTraceProjectContextGraphReference;
	readonly schemaVersion: typeof MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION;
	readonly selection: typeof MODULE_RESOLUTION_TRACE_SELECTION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly specifier: string;
	readonly subjectId: string;
}

export interface ModuleResolutionTraceBuildInputs {
	readonly conditionalExportRequest: ConditionalExportResolutionRequest;
	readonly conditionalExportResolution: ConditionalExportResolutionSnapshot;
	readonly frozenSubject: FrozenSubject;
	readonly projectContextGraph: ProjectContextGraphSnapshot;
	readonly request: ModuleResolutionTraceRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export type ModuleResolutionTraceInputs = ModuleResolutionTraceBuildInputs;

export interface ModuleResolutionTraceSemanticValidationWitness {
	readonly context: 'FROZEN_SUBJECT';
	readonly frozenSubjectSha256: string;
	readonly method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT';
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly semanticSnapshotSha256: string;
	readonly state: 'VALID';
	readonly subjectId: string;
}

export interface ModuleResolutionTraceImporterWitness {
	readonly artifactClass: ArtifactPrimaryClass | 'CONTEXT_ONLY';
	readonly bytes: number;
	readonly contentSha256: string;
	readonly declarationFile: boolean;
	readonly end: number;
	readonly literalValueSha256: string;
	readonly logicalPath: string;
	readonly occurrenceKind: 'IMPORT';
	readonly origin: SourceOrigin;
	readonly projectContextProgramId: ProjectContextProgramId;
	readonly projectContextProjectId: ProjectContextProjectId;
	readonly projectContextSourceId: ProjectContextSourceId;
	readonly semanticModuleResolutionId: SemanticModuleResolutionId;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
	readonly specifier: string;
	readonly specifierNodeId: SemanticNodeId;
	readonly start: number;
	readonly typeOnly: false;
}

export type ModuleResolutionAttemptStage = 'IMPLIED_NODE_FORMAT' | 'MODULE_RESOLUTION';
export type ModuleResolutionAttemptPurpose =
	| 'CASE_SENSITIVITY'
	| 'CURRENT_DIRECTORY'
	| 'DIRECTORY_PROBE'
	| 'MODULE_TARGET_CANDIDATE'
	| 'PACKAGE_METADATA'
	| 'REALPATH'
	| 'RESOLVER_INPUT';

/**
 * `ordinal` is the zero-based overall callback order across the fresh two-stage
 * trace. `invocationOrdinal` is the zero-based occurrence ordinal for this exact
 * canonical query across that same overall order; it does not reproduce the
 * captured observation's aggregate `invocationCount`.
 *
 * CURRENT_DIRECTORY and USE_CASE_SENSITIVE_FILE_NAMES map to their named
 * purposes; directory operations map to DIRECTORY_PROBE; REALPATH maps to
 * REALPATH; package.json READ_FILE/FILE_EXISTS probes map to PACKAGE_METADATA;
 * every other FILE_EXISTS maps to MODULE_TARGET_CANDIDATE; remaining callbacks
 * map to RESOLVER_INPUT.
 */
export interface ModuleResolutionAttemptRecord {
	readonly id: ModuleResolutionAttemptId;
	readonly invocationOrdinal: number;
	readonly observation: CompilerInputObservation;
	readonly ordinal: number;
	readonly projectContextInputId: SemanticContextInputId;
	readonly purpose: ModuleResolutionAttemptPurpose;
	readonly query: CompilerInputQuery;
	readonly stage: ModuleResolutionAttemptStage;
}

export type ModuleResolutionCandidateExclusionReason =
	'FILE_ABSENT' | 'PACKAGE_METADATA_NOT_A_MODULE_TARGET' | 'PRESENT_NOT_SELECTED' | null;

/** Exactly one record for every MODULE_RESOLUTION-stage FILE_EXISTS attempt. */
export interface ModuleResolutionCandidateRecord {
	readonly attemptId: ModuleResolutionAttemptId;
	readonly disposition: 'EXCLUDED' | 'SELECTED';
	readonly exclusionReason: ModuleResolutionCandidateExclusionReason;
	readonly id: ModuleResolutionCandidateId;
	readonly logicalPath: string;
	readonly observationResult: 'ABSENT' | 'PRESENT';
	readonly ordinal: number;
	readonly purpose: 'MODULE_TARGET_CANDIDATE' | 'PACKAGE_METADATA';
}

/** The exact PRESENT READ_FILE member of CompilerInputObservation, written explicitly. */
export interface ModuleResolutionPresentReadFileObservation {
	readonly byteBudgetClass: 'FROZEN_SUBJECT' | 'LIVE_COMPILER_CONTEXT';
	readonly contentBytes: number;
	readonly contentSha256: string;
	readonly id: SemanticContextInputId;
	readonly invocationCount: number;
	readonly logicalPath: string;
	readonly operation: 'READ_FILE';
	readonly origin: SourceOrigin;
	readonly result: 'PRESENT';
	readonly resultDigest: string;
}

export interface ModuleResolutionCapturedReadWitness {
	readonly observation: ModuleResolutionPresentReadFileObservation;
	readonly query: Extract<CompilerInputQuery, { readonly operation: 'READ_FILE' }>;
}

export interface ModuleResolutionTargetWitness {
	/** Semantic classification; the excluded physical build artifact is compiler context only. */
	readonly artifactClass: 'CONTEXT_ONLY';
	readonly bytes: number;
	readonly candidateId: ModuleResolutionCandidateId;
	readonly contentSha256: string;
	readonly declarationFile: true;
	readonly extension: '.d.ts' | '.d.mts' | '.d.cts';
	readonly logicalPath: string;
	readonly originalResolvedLogicalPath: string;
	readonly origin: 'WORKSPACE_BUILD_DECLARATION';
	readonly packageExportTarget: string;
	readonly packageName: string;
	readonly packageWorkspacePath: string;
	readonly selectedFileExistsAttemptId: ModuleResolutionAttemptId;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
	readonly targetRead: ModuleResolutionCapturedReadWitness;
}

/** Input-time target facts, before trace-local attempt and candidate IDs exist. */
export type ModuleResolutionTargetInputWitness = Omit<
	ModuleResolutionTargetWitness,
	'candidateId' | 'selectedFileExistsAttemptId'
>;

export interface ModuleResolutionResolverEnvironment {
	/** SHA-256 canonical JSON witness of the exact reconstructed compilerOptions object. */
	readonly compilerOptionsDigest: string;
	readonly compilerVersion: string;
	readonly configPath: string;
	readonly customConditions: readonly [];
	readonly impliedNodeFormat: number;
	readonly impliedNodeFormatName: 'ESNext';
	readonly module: number;
	readonly moduleName: 'NodeNext';
	readonly moduleResolution: number;
	readonly moduleResolutionName: 'NodeNext';
	readonly packageJsonType: 'module';
	readonly publicConditionMembership: Readonly<{
		readonly import: true;
		readonly node: true;
		readonly types: true;
	}>;
	readonly publicConditionOrder: 'NOT_CLAIMED';
	readonly resolutionMode: number;
	readonly resolutionModeName: 'ESNext';
	readonly useCaseSensitiveFileNames: boolean;
}

export interface ModuleResolutionCaptureWitness {
	readonly contextDigest: string;
	readonly inputRecordIds: readonly SemanticContextInputId[];
	/** Must equal the digest of the full reconstructed materialized ProgramRecipe. */
	readonly materializedRecipeDigest: string;
	readonly projectResolutionDigest: string;
	readonly state: 'VERIFIED_PROJECT_SCOPED_CAPTURE';
}

export interface ModuleResolutionTraceCanonicalBinding {
	readonly captureWitness: ModuleResolutionCaptureWitness;
	readonly importerWitness: ModuleResolutionTraceImporterWitness;
	readonly resolverEnvironment: ModuleResolutionResolverEnvironment;
	readonly targetWitness: ModuleResolutionTargetInputWitness;
}

export interface ModuleResolutionRelationRecord {
	readonly id: ModuleResolutionRelationId;
	readonly importerSourceId: SemanticSourceId;
	readonly kind: 'EXACT_LITERAL_IMPORT_RESOLVES_TO_DECLARATION_BUILD_OUTPUT';
	readonly ordinal: 0;
	readonly semanticModuleResolutionId: SemanticModuleResolutionId;
	readonly specifierNodeId: SemanticNodeId;
	readonly targetSourceId: SemanticSourceId;
}

export interface ModuleResolutionTraceCoverage {
	readonly astNodes: number;
	readonly attemptPopulationReconciles: true;
	readonly attemptRecords: number;
	readonly candidatePopulationReconciles: true;
	readonly candidateRecords: number;
	/** astNodes + attemptRecords + candidateRecords. */
	readonly chargedTraversalSteps: number;
	readonly excludedCandidates: number;
	readonly impliedNodeFormatAttempts: number;
	/** attemptRecords plus the independently captured target READ_FILE witness. */
	readonly inputRecords: number;
	readonly moduleResolutionAttempts: number;
	readonly moduleResolutionFileExistsAttempts: number;
	/** One snapshot plus attemptRecords plus candidateRecords; singletons are embedded. */
	readonly outputRecords: number;
	/**
	 * Importer captured READ_FILE bytes plus every PRESENT READ_FILE callback's
	 * bytes across both stages plus the separately captured selected-target
	 * READ_FILE bytes. Duplicate retrievals are charged independently.
	 */
	readonly readBytes: number;
	readonly relationPopulationReconciles: true;
	readonly relationRecords: 1;
	readonly selectedCandidates: 1;
	readonly selectedImporterPrograms: 1;
	readonly selectedImporterSources: 1;
	readonly selectedTargets: 1;
	readonly selectedWorkspacePackages: 1;
}

export interface ModuleResolutionTraceSnapshot {
	readonly attempts: readonly ModuleResolutionAttemptRecord[];
	readonly authorityTransfer: typeof MODULE_RESOLUTION_TRACE_AUTHORITY_TRANSFER;
	readonly budgets: ModuleResolutionTraceBudgets;
	readonly candidates: readonly ModuleResolutionCandidateRecord[];
	readonly canonicalProfile: typeof MODULE_RESOLUTION_TRACE_CANONICAL_PROFILE;
	readonly capability: typeof MODULE_RESOLUTION_TRACE_CAPABILITY;
	readonly capabilityStatus: typeof MODULE_RESOLUTION_TRACE_CAPABILITY_STATUS;
	readonly captureWitness: ModuleResolutionCaptureWitness;
	readonly closure: 'CLOSED_FOR_SELECTED_SUPPORTED_EXACT_RESOLVED_REQUEST';
	readonly conditionalExportResolution: ModuleResolutionTraceConditionalExportReference;
	readonly contentDigest: string;
	readonly coverage: ModuleResolutionTraceCoverage;
	readonly currentness: typeof MODULE_RESOLUTION_TRACE_CURRENTNESS;
	readonly freshness: typeof MODULE_RESOLUTION_TRACE_FRESHNESS;
	readonly fullJanCsaa007Conformance: typeof MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly fullJanCsaa011Conformance: typeof MODULE_RESOLUTION_TRACE_FULL_JAN_CSAA_011_CONFORMANCE;
	readonly gateEffect: typeof MODULE_RESOLUTION_TRACE_GATE_EFFECT;
	readonly health: 'PARTIAL';
	readonly id: ModuleResolutionTraceId;
	readonly importerWitness: ModuleResolutionTraceImporterWitness;
	readonly inputDigest: string;
	readonly method: typeof MODULE_RESOLUTION_TRACE_METHOD;
	readonly nonclaims: typeof MODULE_RESOLUTION_TRACE_NONCLAIMS;
	readonly operationVersion: typeof MODULE_RESOLUTION_TRACE_OPERATION_VERSION;
	readonly projectContextGraph: ModuleResolutionTraceProjectContextGraphReference;
	readonly relation: ModuleResolutionRelationRecord;
	readonly resolutionAuthority: typeof MODULE_RESOLUTION_TRACE_AUTHORITY;
	readonly resolverEnvironment: ModuleResolutionResolverEnvironment;
	readonly resultCompleteness: 'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_RESOLVED_REQUEST';
	readonly schemaVersion: typeof MODULE_RESOLUTION_TRACE_SCHEMA_VERSION;
	readonly selection: typeof MODULE_RESOLUTION_TRACE_SELECTION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly semanticValidationWitness: ModuleResolutionTraceSemanticValidationWitness;
	readonly subjectId: string;
	readonly targetWitness: ModuleResolutionTargetWitness;
	readonly truncation: { readonly reason: null; readonly state: 'NOT_TRUNCATED' };
}

export type ModuleResolutionTraceResult = ModuleResolutionTraceSnapshot;

export type ModuleResolutionTraceDiagnosticCode =
	| 'BUDGET_EXCEEDED'
	| 'CAPTURE_INVALID'
	| 'CONDITIONAL_EXPORT_RESOLUTION_INVALID'
	| 'INPUT_IDENTITY_MISMATCH'
	| 'INPUT_POPULATION_MISMATCH'
	| 'PROJECT_CONTEXT_GRAPH_INVALID'
	| 'REQUEST_INVALID'
	| 'RESOLUTION_UNAVAILABLE'
	| 'SEMANTIC_SNAPSHOT_INVALID'
	| 'TARGET_UNAVAILABLE'
	| 'TRACE_VALIDATION_FAILED'
	| 'UNSUPPORTED_REQUEST';

export type ModuleResolutionTraceProgressPhase =
	| 'REQUEST_BIND'
	| 'INPUT_BUDGET'
	| 'SEMANTIC_SNAPSHOT_VALIDATE'
	| 'PROJECT_CONTEXT_GRAPH_VALIDATE'
	| 'CONDITIONAL_EXPORT_RESOLUTION_VALIDATE'
	| 'IMPORTER_BIND'
	| 'IMPLIED_NODE_FORMAT_RESOLVE'
	| 'MODULE_RESOLVE'
	| 'TARGET_BIND'
	| 'MATERIALIZE'
	| 'SERIALIZE'
	| 'TRACE_VALIDATE';

export interface ModuleResolutionTraceDiagnostic {
	readonly code: ModuleResolutionTraceDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: ModuleResolutionTraceProgressPhase;
}

export type ModuleResolutionTraceBuildOutcome =
	| {
			readonly diagnostics: readonly ModuleResolutionTraceDiagnostic[];
			readonly outcome: 'partial';
			readonly trace: ModuleResolutionTraceSnapshot;
	  }
	| {
			readonly diagnostics: readonly ModuleResolutionTraceDiagnostic[];
			readonly outcome: 'unavailable';
	  };

export interface ModuleResolutionTraceProgressEvent {
	readonly counts: Readonly<Record<string, number>>;
	readonly detailCode: string | null;
	readonly phase: ModuleResolutionTraceProgressPhase;
	readonly schemaVersion: typeof MODULE_RESOLUTION_TRACE_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly state: 'COMPLETED' | 'FAILED' | 'STARTED';
}

export interface BuildModuleResolutionTraceOptions {
	readonly onProgress?: (event: ModuleResolutionTraceProgressEvent) => void;
}

export interface ModuleResolutionTraceValidationOptions {
	readonly maxDepth?: number;
	readonly maxInputRecords?: number;
	readonly maxInputStringCharacters?: number;
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type ModuleResolutionTraceValidationIssueCode =
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'DERIVATION_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INPUT_INVALID'
	| 'POPULATION_MISMATCH'
	| 'SHAPE_INVALID';

export interface ModuleResolutionTraceValidationIssue {
	readonly code: ModuleResolutionTraceValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export type ModuleResolutionTraceValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly ModuleResolutionTraceValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };
