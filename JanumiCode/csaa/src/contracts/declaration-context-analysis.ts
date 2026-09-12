import type {
	ConditionalExportResolutionId,
	ConditionalExportResolutionRequest,
	ConditionalExportResolutionSnapshot
} from './conditional-export-resolution.js';
import type {
	ModuleResolutionTraceId,
	ModuleResolutionTraceRequest,
	ModuleResolutionTraceSnapshot,
	ModuleResolutionPresentReadFileObservation
} from './module-resolution-trace.js';
import type {
	ProjectContextGraphId,
	ProjectContextGraphSnapshot,
	ProjectContextProgramId,
	ProjectContextProjectId
} from './project-context-graph.js';
import type {
	CompilerInputObservation,
	SemanticProgramId,
	SemanticProjectId,
	SemanticSnapshotId,
	SemanticSourceId,
	SourceOrigin,
	StaticSemanticSnapshot
} from './semantic.js';
import type { FrozenSubject } from './subject.js';
import type { CompilerInputQuery } from '../providers/typescript/compiler-input-journal.js';

export const DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION =
	'jan-csaa-declaration-context-analysis-request/1.0.0' as const;
export const DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION =
	'jan-csaa-declaration-context-analysis/1.0.0' as const;
export const DECLARATION_CONTEXT_ANALYSIS_PROGRESS_SCHEMA_VERSION =
	'jan-csaa-declaration-context-analysis-progress/1.0.0' as const;
export const DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION =
	'jan-csaa-build-declaration-context-analysis/0.1.0' as const;
export const DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE =
	'jan-csaa-declaration-context-analysis-canonical/1.0.0' as const;
export const DECLARATION_CONTEXT_ANALYSIS_METHOD =
	'validated-typescript-public-package-root-export-declaration-context-over-project-scoped-capture/1.0.0' as const;
export const DECLARATION_CONTEXT_ANALYSIS_CAPABILITY = 'JAN-CSAA-CAP-013' as const;
export const DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS = 'PARTIAL' as const;
export const DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE = 'NOT_CLAIMED' as const;
export const DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;
export const DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE = 'NOT_CLAIMED' as const;
export const DECLARATION_CONTEXT_ANALYSIS_AUTHORITY = 'NONE' as const;
export const DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER = 'NONE' as const;
export const DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT = 'NONE' as const;
export const DECLARATION_CONTEXT_ANALYSIS_FRESHNESS = 'NOT_ASSESSED' as const;
export const DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS = 'NOT_CLAIMED' as const;

export const DECLARATION_CONTEXT_ANALYSIS_ARTIFACT_ROLE_ORDER = Object.freeze([
	'CAP011_SELECTED_DECLARATION_TARGET',
	'SELECTED_EXPORT_BINDING_CARRIER',
	'ALIAS_DECLARATION_CONTAINER',
	'TERMINAL_DECLARATION_CONTAINER'
] as const);

export const DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE = Object.freeze({
	ClassDeclaration: 'CLASS',
	EnumDeclaration: 'ENUM',
	FunctionDeclaration: 'FUNCTION',
	InterfaceDeclaration: 'INTERFACE',
	ModuleDeclarationIdentifierName: 'NAMESPACE',
	TypeAliasDeclaration: 'TYPE_ALIAS',
	VariableDeclaration: 'VARIABLE'
} as const);

/** The only accepted v1 declaration-analysis surface. */
export const DECLARATION_CONTEXT_ANALYSIS_SELECTION = Object.freeze({
	aliasResolution:
		'ZERO_HOP_DIRECT_EXPORT_OR_ONE_PUBLIC_GET_ALIASED_SYMBOL_LOCAL_ROOT_EXPORT_SPECIFIER_TO_SAME_ARTIFACT_TERMINAL',
	aliasDeclarationClosure:
		'ONE_LOCAL_ROOT_EXPORT_SPECIFIER_WITHOUT_MODULE_SPECIFIER_PROPERTY_NAME_EQUAL_TO_TERMINAL_NAME_WITH_EXACT_PARSED_CENSUS_RECONCILIATION',
	ambientEffectRefusal:
		'REJECT_ANY_CONSUMED_ARTIFACT_GLOBAL_AUGMENTATION_STRING_LITERAL_MODULE_NAMESPACE_EXPORT_OR_TRIPLE_SLASH_PATH_TYPES_LIB_NO_DEFAULT_LIB_AMD_MODULE_AMD_DEPENDENCY_DIRECTIVE',
	ambientEffectPopulation: 'EXPLICITLY_EMPTY_UNSUPPORTED_IN_V1',
	artifactOrdering: 'LOGICAL_PATH_THEN_SEMANTIC_SOURCE_ID_UTF16_CODE_UNIT_LEXICOGRAPHIC',
	artifactRoleOrder: DECLARATION_CONTEXT_ANALYSIS_ARTIFACT_ROLE_ORDER,
	astNodeCounting: 'SOURCE_FILE_ROOT_PLUS_PUBLIC_FOR_EACH_CHILD_RECURSIVE_PREORDER',
	attemptOrdering: 'GLOBAL_CALLBACK_ORDINAL_ASCENDING_ZERO_BASED_CONTIGUOUS',
	augmentationPopulation: 'EXPLICITLY_EMPTY_UNSUPPORTED_IN_V1',
	augmentationRefusal:
		'REJECT_ANY_CONSUMED_ARTIFACT_GLOBAL_AUGMENTATION_FLAG_OR_STRING_LITERAL_MODULE_DECLARATION',
	cap001Carrier:
		'STATIC_SEMANTIC_SNAPSHOT_PLUS_TARGET_BYTE_BOUND_PUBLIC_TYPESCRIPT_PROGRAM_PARSE_WITNESSES',
	cap002Consumption: 'FORBIDDEN',
	checkerApis: Object.freeze([
		'GET_SYMBOL_AT_LOCATION',
		'GET_EXPORTS_OF_MODULE',
		'GET_ALIASED_SYMBOL',
		'GET_DECLARATIONS'
	] as const),
	criterion:
		'ONE_EXACT_PACKAGE_ROOT_EXPORT_DECLARATION_BINDING_IN_CAP011_SELECTED_DECLARATION_TARGET',
	declarationKindProfile: DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE,
	declarationOrdering:
		'ARTIFACT_LOGICAL_PATH_THEN_START_THEN_END_THEN_NATIVE_KIND_CODE_THEN_NAME_UTF16_CODE_UNIT_LEXICOGRAPHIC',
	diagnosticPolicy:
		'ZERO_PUBLIC_PROGRAM_SYNTACTIC_DIAGNOSTICS_ACROSS_EVERY_CONSUMED_DECLARATION_ARTIFACT',
	deliveryWorkPackage: 'DWP-003_SEMANTIC_COMPLETION',
	declarationArtifactPopulation:
		'CAP011_SELECTED_DECLARATION_TARGET_ONLY_WITH_ALL_SUCCESSFUL_BINDING_ROLES_RECONCILED_TO_THAT_ARTIFACT',
	exportSelection: 'EXACT_UNICODE_SCALAR_NAME_MATCH_OVER_COMPLETE_ROOT_MODULE_EXPORT_ENUMERATION',
	exportSymbolCounting:
		'ENTIRE_GET_EXPORTS_OF_MODULE_RETURN_POPULATION_EXAMINED_EXACTLY_ONCE_REQUIRE_ONE_EXACT_NAME',
	languageVersionName: 'TYPESCRIPT_PUBLIC_SCRIPT_TARGET_REVERSE_ENUM_NAME',
	mergeSemantics: 'COMPLETE_SAME_FILE_TERMINAL_SYMBOL_DECLARATION_SET_ONLY',
	nativeDeclarationKindName: 'EXACT_SUPPORTED_PUBLIC_TYPESCRIPT_SYNTAX_KIND_MEMBER_NAME',
	programAstPopulation: 'EVERY_FRESH_PROGRAM_SOURCE_FILE_ROOT_AND_DESCENDANTS_EXACTLY_ONCE',
	programConstruction: 'TYPESCRIPT_PUBLIC_CREATE_PROGRAM_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE_ONLY',
	programInputAccounting:
		'ALL_ACTUAL_PROGRAM_COMPILER_HOST_CALLBACK_ATTEMPTS_CHARGED_WITH_DUPLICATE_PRESENT_READ_BYTES_AND_CAPTURE_ATTRIBUTION_UPPER_BOUNDS_PREFLIGHTED_AND_WITNESSED',
	programInputStages: Object.freeze([
		'PROGRAM_CONSTRUCTION',
		'TYPE_CHECKER_CREATE',
		'CALLER_ANALYSIS'
	] as const),
	relationOrdering:
		'KIND_RANK_DECLARES_CONTRIBUTES_TO_MERGES_WITH_THEN_KIND_ENDPOINT_IDS_UTF16_CODE_UNIT_LEXICOGRAPHIC',
	selectedArtifactParseAccounting:
		'INDEPENDENT_EXACT_CAPTURED_READ_WITNESS_PLUS_COMPLETE_SELECTED_ARTIFACT_AST_TRAVERSAL',
	selectedArtifactAstPopulation:
		'EACH_INDEPENDENT_CREATE_SOURCE_FILE_ROOT_AND_DESCENDANTS_EXACTLY_ONCE',
	sourceDecoding:
		'BOM_PREFIX_UTF16LE_UTF16BE_UTF8_ELSE_UTF8_FATAL_COMPLETE_CODE_UNITS_BOM_EXCLUDED',
	sourceEncodingNames: Object.freeze(['UTF8', 'UTF8_BOM', 'UTF16BE_BOM', 'UTF16LE_BOM'] as const),
	symbolFlagNameProfile:
		'ZERO_AS_NONE_ELSE_SET_SINGLE_BIT_PUBLIC_SYMBOL_FLAGS_ASCENDING_NUMERIC_CODE_NO_COMPOSITES',
	terminalAliasCycle:
		'REFERENCE_IDENTITY_VISITED_SET_INCLUDING_SELECTED_EXPORT_SYMBOL_UNAVAILABLE_ON_REPEAT',
	terminalAliasHopCounting:
		'ONE_PER_PUBLIC_GET_ALIASED_SYMBOL_CALL_IN_TRAVERSAL_ORDER_CAP_CHECKED_BEFORE_CALL',
	terminalDeclarationClosure:
		'ALL_PUBLIC_CHECKER_DECLARATIONS_FOR_ONE_TERMINAL_SYMBOL_MUST_BELONG_TO_THE_CAP011_SELECTED_DECLARATION_TARGET',
	terminalDeclarationCensusReconciliation:
		'EXACT_MULTISET_EQUALITY_WITH_METERED_INDEPENDENTLY_PARSED_SUPPORTED_TOP_LEVEL_TERMINAL_NAME_DECLARATIONS',
	terminalDeclarationPlacement:
		'TOP_LEVEL_SOURCE_FILE_DECLARATIONS_ONLY_WITH_VARIABLE_DECLARATIONS_REQUIRING_TOP_LEVEL_VARIABLE_STATEMENT',
	unsupportedTreatment: 'OPERATION_UNAVAILABLE_NEVER_PARTIAL_OUTPUT'
} as const);

export const DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS = Object.freeze([
	'FULL_JAN_CSAA_CAP_013_DECLARATION_FILE_OR_MODULE_AUGMENTATION_ANALYSIS',
	'FULL_JAN_CSAA_007_CONFORMANCE',
	'FULL_JAN_CSAA_008_CONFORMANCE',
	'DECLARATION_ARTIFACT_POPULATION_BEYOND_SELECTED_BINDING_CONSUMED_ARTIFACTS',
	'PACKAGE_ROOT_EXPORT_BINDINGS_BEYOND_SELECTED_EXACT_NAME',
	'REEXPORT_OR_ALIAS_TOPOLOGY_BEYOND_SELECTED_CHECKER_BINDING',
	'CROSS_FILE_TERMINAL_SYMBOL_DECLARATION_MERGE',
	'CROSS_PROGRAM_OR_CROSS_PROJECT_DECLARATION_MERGE',
	'MODULE_OR_GLOBAL_AUGMENTATION_ANALYSIS',
	'AMBIENT_EFFECT_ANALYSIS',
	'AMBIENT_DECLARATION_EFFECT_OR_RUNTIME_BEHAVIOR',
	'DECLARATION_MERGING_BEYOND_SELECTED_TERMINAL_SYMBOL',
	'JAN_CSAA_CAP_002_SYMBOL_OR_REFERENCE_RESOLUTION_PREDECESSOR',
	'JAN_CSAA_CAP_003_TYPE_ANALYSIS_OR_TYPE_COMPATIBILITY',
	'JAN_CSAA_CAP_014_SOURCE_MAP_OR_AUTHORED_ORIGIN_CORRELATION',
	'JAN_CSAA_CAP_023_GENERATED_ARTIFACT_LINEAGE',
	'GENERATED_TO_AUTHORED_DECLARATION_LINEAGE',
	'DECLARATION_AUTHORITY_OR_CONTRACT_SATISFACTION',
	'TARGET_RUNTIME_LOADABILITY_OR_BUILD_SUCCESS',
	'PERSISTED_OR_DESERIALIZED_CAPTURE_REPLAY',
	'CURRENTNESS_OR_FRESHNESS',
	'PROVIDER_QUALIFICATION_OR_ORACLE_CONFERRAL',
	'FINDING_GATE_DECISION_OR_REMEDIATION_AUTHORITY'
] as const);

declare const declarationContextAnalysisBrand: unique symbol;
type Branded<Kind extends string> = string & {
	readonly [declarationContextAnalysisBrand]: Kind;
};

export type DeclarationContextAnalysisId = Branded<'DeclarationContextAnalysis'>;
export type DeclarationContextProgramInputAttemptId =
	Branded<'DeclarationContextProgramInputAttempt'>;
export type DeclarationContextParseWitnessId = Branded<'DeclarationContextParseWitness'>;
export type DeclarationContextArtifactId = Branded<'DeclarationContextArtifact'>;
export type DeclarationContextDeclarationId = Branded<'DeclarationContextDeclaration'>;
export type DeclarationContextTerminalSymbolId = Branded<'DeclarationContextTerminalSymbol'>;
export type DeclarationContextExportBindingId = Branded<'DeclarationContextExportBinding'>;
export type DeclarationContextMergeId = Branded<'DeclarationContextMerge'>;
export type DeclarationContextRelationId = Branded<'DeclarationContextRelation'>;

export interface DeclarationContextAnalysisBudgets {
	/**
	 * Ceiling applied independently to descriptor/request records inspected before compiler work
	 * and to the exact output input-record population of Program attempts plus artifact reads.
	 */
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	/**
	 * Program-construction, checker-creation, and caller-analysis host attempts; preflighted against
	 * the complete capture-attributed invocation upper bound before Program construction begins.
	 */
	readonly maxCompilerInputAttempts: number;
	/**
	 * Fail-closed elapsed wall-clock resource guard; never semantic evidence. CAP-013 checks the
	 * clock before and after synchronous predecessor-validator and public-TypeScript capability
	 * calls, but does not claim preemptive cancellation inside those separately bounded calls.
	 */
	readonly maxDurationMs: number;
	/** Preflighted against the complete capture-attributed PRESENT READ_FILE byte upper bound. */
	readonly maxProgramReadBytes: number;
	readonly maxProgramSourceFiles: number;
	readonly maxProgramAstNodes: number;
	readonly maxParsedArtifactAstNodes: number;
	readonly maxExportSymbols: number;
	/** May be zero when the selected export is already the terminal symbol. */
	readonly maxAliasHops: number;
	readonly maxArtifacts: number;
	readonly maxDeclarations: number;
	readonly maxRelations: number;
	/** Program reads plus independent selected-artifact read witnesses. */
	readonly maxReadBytes: number;
	readonly maxTraversalSteps: number;
	readonly maxOutputRecords: number;
	/** Cumulative public Program syntactic diagnostics across consumed artifacts. */
	readonly maxDiagnostics: number;
}

export interface DeclarationContextProjectContextGraphReference {
	readonly contentDigest: string;
	readonly graphId: ProjectContextGraphId;
	readonly inputDigest: string;
}

export interface DeclarationContextConditionalExportReference {
	readonly contentDigest: string;
	readonly id: ConditionalExportResolutionId;
	readonly inputDigest: string;
}

export interface DeclarationContextModuleResolutionTraceReference {
	readonly contentDigest: string;
	readonly id: ModuleResolutionTraceId;
	readonly inputDigest: string;
}

export interface DeclarationContextAnalysisRequest {
	readonly budgets: DeclarationContextAnalysisBudgets;
	readonly conditionalExportResolution: DeclarationContextConditionalExportReference;
	readonly exportName: string;
	readonly moduleResolutionTrace: DeclarationContextModuleResolutionTraceReference;
	readonly operationVersion: typeof DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION;
	readonly projectContextGraph: DeclarationContextProjectContextGraphReference;
	readonly schemaVersion: typeof DECLARATION_CONTEXT_ANALYSIS_REQUEST_SCHEMA_VERSION;
	readonly selection: typeof DECLARATION_CONTEXT_ANALYSIS_SELECTION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export interface DeclarationContextAnalysisBuildInputs {
	readonly conditionalExportRequest: ConditionalExportResolutionRequest;
	readonly conditionalExportResolution: ConditionalExportResolutionSnapshot;
	readonly frozenSubject: FrozenSubject;
	readonly moduleResolutionRequest: ModuleResolutionTraceRequest;
	readonly moduleResolutionTrace: ModuleResolutionTraceSnapshot;
	readonly projectContextGraph: ProjectContextGraphSnapshot;
	readonly request: DeclarationContextAnalysisRequest;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export type DeclarationContextAnalysisInputs = DeclarationContextAnalysisBuildInputs;

export interface DeclarationContextSemanticValidationWitness {
	readonly context: 'FROZEN_SUBJECT';
	readonly frozenSubjectSha256: string;
	readonly method: 'VALIDATE_STATIC_SEMANTIC_SNAPSHOT_WITH_FROZEN_SUBJECT';
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly semanticSnapshotSha256: string;
	readonly state: 'VALID';
	readonly subjectId: string;
}

/** One fresh callback made by Program construction, checker creation, or selected checker analysis. */
export interface DeclarationContextProgramInputAttemptRecord {
	readonly attributedInvocationCount: number;
	readonly id: DeclarationContextProgramInputAttemptId;
	readonly invocationOrdinal: number;
	readonly observation: CompilerInputObservation;
	readonly ordinal: number;
	readonly query: CompilerInputQuery;
	readonly stage: 'CALLER_ANALYSIS' | 'PROGRAM_CONSTRUCTION' | 'TYPE_CHECKER_CREATE';
}

export interface DeclarationContextProgramWitness {
	/** Sum of every project-attributed query invocation count used for fail-closed preflight. */
	readonly attributedCompilerInputAttempts: number;
	/** PRESENT READ_FILE bytes multiplied by attributed invocation counts for preflight. */
	readonly attributedProgramReadBytes: number;
	readonly attributedUniqueQueries: number;
	readonly captureContextDigest: string;
	readonly compilerOptionsDigest: string;
	readonly compilerVersion: string;
	readonly configPath: string;
	readonly materializedRecipeDigest: string;
	readonly programInputAttemptIds: readonly DeclarationContextProgramInputAttemptId[];
	/** Every node visited by public `forEachChild` over every Program SourceFile. */
	readonly programParsedAstNodes: number;
	readonly programSourceFiles: number;
	/** Canonical digest of every Program source path, bytes, digest, origin, and semantic source identity. */
	readonly programSourcePopulationDigest: string;
	readonly projectContextProgramId: ProjectContextProgramId;
	readonly projectContextProjectId: ProjectContextProjectId;
	readonly projectResolutionDigest: string;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly state: 'FRESH_PUBLIC_TYPESCRIPT_PROGRAM_OVER_VERIFIED_PROJECT_SCOPED_CAPTURE';
}

export interface DeclarationContextCapturedReadWitness {
	readonly attributedInvocationCount: number;
	readonly inputRecordOrdinal: number;
	readonly invocationOrdinal: number;
	readonly observation: ModuleResolutionPresentReadFileObservation;
	readonly query: Readonly<{ readonly logicalPath: string; readonly operation: 'READ_FILE' }>;
	readonly stage: 'DECLARATION_ARTIFACT_PARSE';
}

export type DeclarationContextSourceEncoding = 'UTF16BE_BOM' | 'UTF16LE_BOM' | 'UTF8' | 'UTF8_BOM';

/** Target-byte-bound CAP-001 evidence for one declaration artifact consumed by v1. */
export interface DeclarationContextParseWitnessRecord {
	readonly astNodes: number;
	readonly bytes: number;
	readonly compilerVersion: string;
	readonly contentSha256: string;
	readonly decodedUtf16CodeUnits: number;
	readonly externalModule: true;
	readonly id: DeclarationContextParseWitnessId;
	readonly languageVersion: Readonly<{
		readonly nativeCode: number;
		readonly nativeName: string;
	}>;
	readonly logicalPath: string;
	readonly parseDiagnostics: readonly [];
	readonly parseHealth: 'VALID';
	readonly parseMethod: 'TYPESCRIPT_PUBLIC_CREATE_SOURCE_FILE_OVER_EXACT_CAPTURED_BYTES';
	readonly programSourceReconciliation: 'EXACT_LOGICAL_PATH_CONTENT_SHA256_AND_SEMANTIC_SOURCE_ID';
	readonly scriptKind: Readonly<{
		readonly nativeCode: number;
		readonly nativeName: 'TS';
	}>;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
	readonly sourceEncoding: DeclarationContextSourceEncoding;
	readonly sourceRead: DeclarationContextCapturedReadWitness;
	readonly statements: number;
}

export type DeclarationContextArtifactRole =
	(typeof DECLARATION_CONTEXT_ANALYSIS_ARTIFACT_ROLE_ORDER)[number];

export interface DeclarationContextArtifactRecord {
	readonly artifactClass: 'CONTEXT_ONLY';
	readonly bytes: number;
	readonly contentSha256: string;
	readonly declarationFile: true;
	readonly declarationRole: 'EMITTED_DECLARATION';
	readonly extension: '.d.cts' | '.d.mts' | '.d.ts';
	readonly id: DeclarationContextArtifactId;
	readonly logicalPath: string;
	readonly ordinal: number;
	readonly origin: 'WORKSPACE_BUILD_DECLARATION';
	readonly parseWitnessId: DeclarationContextParseWitnessId;
	readonly roles: readonly DeclarationContextArtifactRole[];
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly semanticSourceId: SemanticSourceId;
}

export interface DeclarationContextNativeKindBinding {
	readonly compilerVersion: string;
	readonly nativeCode: number;
	readonly nativeName: string;
}

export type DeclarationContextDeclarationKind =
	(typeof DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE)[keyof typeof DECLARATION_CONTEXT_ANALYSIS_DECLARATION_KIND_PROFILE];

/** No CAP-002 declaration or symbol identity appears in this record. */
export interface DeclarationContextDeclarationRecord {
	readonly ambientContext: 'DECLARATION_FILE';
	readonly artifactId: DeclarationContextArtifactId;
	readonly end: number;
	readonly id: DeclarationContextDeclarationId;
	readonly kind: DeclarationContextDeclarationKind;
	readonly name: string;
	readonly nameEnd: number;
	readonly nameStart: number;
	readonly nativeKind: DeclarationContextNativeKindBinding;
	readonly ordinal: number;
	readonly parseWitnessId: DeclarationContextParseWitnessId;
	readonly role: 'SELECTED_TERMINAL_SYMBOL_DECLARATION';
	readonly start: number;
}

export interface DeclarationContextSymbolFlagsBinding {
	readonly compilerVersion: string;
	readonly nativeMask: number;
	readonly nativeNames: readonly string[];
}

export interface DeclarationContextAliasHopWitness {
	readonly aliasDeclarationArtifactIds: readonly DeclarationContextArtifactId[];
	readonly aliasName: string;
	readonly aliasSymbolFlags: DeclarationContextSymbolFlagsBinding;
	readonly ordinal: number;
	readonly resolutionApi: 'TYPESCRIPT_PUBLIC_TYPE_CHECKER_GET_ALIASED_SYMBOL';
	readonly targetName: string;
}

/** Exactly one compiler-confirmed package-root export selected by exact name. */
export interface DeclarationContextExportBindingRecord {
	readonly aliasHops: readonly DeclarationContextAliasHopWitness[];
	readonly exportSymbolsExamined: number;
	readonly exportName: string;
	readonly id: DeclarationContextExportBindingId;
	readonly ordinal: 0;
	readonly resolutionKind: 'DIRECT_TERMINAL_SYMBOL' | 'ALIASED_TO_TERMINAL_SYMBOL';
	readonly rootArtifactId: DeclarationContextArtifactId;
	readonly rootExportSymbolFlags: DeclarationContextSymbolFlagsBinding;
	readonly selectionApi: 'TYPESCRIPT_PUBLIC_TYPE_CHECKER_GET_EXPORTS_OF_MODULE';
	readonly terminalSymbolId: DeclarationContextTerminalSymbolId;
}

/** One terminal checker symbol with its complete public declaration set. */
export interface DeclarationContextTerminalSymbolRecord {
	readonly declarationArtifactId: DeclarationContextArtifactId;
	readonly declarationIds: readonly DeclarationContextDeclarationId[];
	readonly declarationSetClosure: 'COMPLETE_PUBLIC_CHECKER_DECLARATION_SET_SAME_ARTIFACT';
	readonly flags: DeclarationContextSymbolFlagsBinding;
	readonly id: DeclarationContextTerminalSymbolId;
	readonly mergeState: 'SINGLE' | 'MERGED';
	readonly name: string;
	readonly ordinal: 0;
	readonly semanticProgramId: SemanticProgramId;
	readonly semanticProjectId: SemanticProjectId;
	readonly symbolMeaning: 'TERMINAL_CHECKER_SYMBOL_FOR_SELECTED_PACKAGE_ROOT_EXPORT';
}

export interface DeclarationContextMergeRecord {
	readonly declarationArtifactId: DeclarationContextArtifactId;
	readonly declarationIds: readonly DeclarationContextDeclarationId[];
	readonly id: DeclarationContextMergeId;
	readonly kind: 'COMPLETE_SAME_FILE_TERMINAL_SYMBOL_MERGE';
	readonly ordinal: 0;
	readonly terminalSymbolId: DeclarationContextTerminalSymbolId;
}

export interface DeclarationContextDeclaresRelationRecord {
	readonly artifactId: DeclarationContextArtifactId;
	readonly declarationId: DeclarationContextDeclarationId;
	readonly id: DeclarationContextRelationId;
	readonly kind: 'DECLARES';
	readonly ordinal: number;
}

export interface DeclarationContextContributesToRelationRecord {
	readonly declarationId: DeclarationContextDeclarationId;
	readonly id: DeclarationContextRelationId;
	readonly kind: 'CONTRIBUTES_TO';
	readonly ordinal: number;
	readonly terminalSymbolId: DeclarationContextTerminalSymbolId;
}

export interface DeclarationContextMergesWithRelationRecord {
	readonly declarationId: DeclarationContextDeclarationId;
	readonly id: DeclarationContextRelationId;
	readonly kind: 'MERGES_WITH';
	readonly mergeId: DeclarationContextMergeId;
	readonly ordinal: number;
	readonly terminalSymbolId: DeclarationContextTerminalSymbolId;
}

export type DeclarationContextRelationRecord =
	| DeclarationContextDeclaresRelationRecord
	| DeclarationContextContributesToRelationRecord
	| DeclarationContextMergesWithRelationRecord;

export type DeclarationContextRelationRecordWithoutId =
	| Omit<DeclarationContextDeclaresRelationRecord, 'id'>
	| Omit<DeclarationContextContributesToRelationRecord, 'id'>
	| Omit<DeclarationContextMergesWithRelationRecord, 'id'>;

export interface DeclarationContextAnalysisCoverage {
	readonly aliasHops: number;
	readonly ambientEffectRecords: 0;
	readonly artifactPopulationReconciles: true;
	readonly artifactReadBytes: number;
	readonly artifactReadWitnesses: number;
	readonly artifacts: number;
	readonly augmentationRecords: 0;
	/**
	 * `programCompilerInputAttempts + artifactReadWitnesses + programSourceFiles +
	 * programParsedAstNodes + selectedAstNodes + exportSymbolsExamined + aliasHops +
	 * declarations + relationRecords`. Selected artifact AST traversal is a
	 * separate public `forEachChild` pass and is charged again.
	 */
	readonly chargedTraversalSteps: number;
	readonly contributesToRelations: number;
	readonly declarationPopulationReconciles: true;
	readonly declarations: number;
	readonly declaresRelations: number;
	readonly diagnosticRecords: 0;
	readonly exportBindings: 1;
	readonly exportSymbolsExamined: number;
	/** Exactly `programCompilerInputAttempts + artifactReadWitnesses`. */
	readonly inputRecords: number;
	readonly mergePopulationReconciles: true;
	readonly mergeRecords: 0 | 1;
	readonly mergesWithRelations: number;
	/**
	 * One snapshot + attempts + parse witnesses + artifacts + one export binding +
	 * one terminal symbol + declarations + merges + relations.
	 */
	readonly outputRecords: number;
	readonly parseWitnessPopulationReconciles: true;
	readonly parseWitnesses: number;
	readonly programCompilerInputAttemptPopulationReconciles: true;
	readonly programCompilerInputAttempts: number;
	readonly programParsedAstNodePopulationReconciles: true;
	readonly programParsedAstNodes: number;
	readonly programPresentReadFileAttempts: number;
	readonly programReadBytes: number;
	readonly programSourceFilePopulationReconciles: true;
	readonly programSourceFiles: number;
	/** Exactly `programReadBytes + artifactReadBytes`; duplicate reads are charged. */
	readonly readBytes: number;
	/** Exactly `programPresentReadFileAttempts + artifactReadWitnesses`. */
	readonly readOperations: number;
	readonly relationPopulationReconciles: true;
	readonly relationRecords: number;
	readonly selectedAstNodePopulationReconciles: true;
	readonly selectedAstNodes: number;
	readonly selectedExportBindings: 1;
	readonly selectedPackageRootTargets: 1;
	readonly terminalSymbols: 1;
}

export interface DeclarationContextAnalysisSnapshot {
	readonly ambientEffectRecords: readonly [];
	readonly analysisAuthority: typeof DECLARATION_CONTEXT_ANALYSIS_AUTHORITY;
	readonly artifacts: readonly DeclarationContextArtifactRecord[];
	readonly augmentationRecords: readonly [];
	readonly authorityTransfer: typeof DECLARATION_CONTEXT_ANALYSIS_AUTHORITY_TRANSFER;
	readonly budgets: DeclarationContextAnalysisBudgets;
	readonly canonicalProfile: typeof DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE;
	readonly capability: typeof DECLARATION_CONTEXT_ANALYSIS_CAPABILITY;
	readonly capabilityStatus: typeof DECLARATION_CONTEXT_ANALYSIS_CAPABILITY_STATUS;
	readonly closure: 'CLOSED_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_DECLARATION_BINDING';
	readonly conditionalExportResolution: DeclarationContextConditionalExportReference;
	readonly contentDigest: string;
	readonly coverage: DeclarationContextAnalysisCoverage;
	readonly currentness: typeof DECLARATION_CONTEXT_ANALYSIS_CURRENTNESS;
	readonly declarations: readonly DeclarationContextDeclarationRecord[];
	readonly exportBinding: DeclarationContextExportBindingRecord;
	readonly freshness: typeof DECLARATION_CONTEXT_ANALYSIS_FRESHNESS;
	readonly fullJanCsaa007Conformance: typeof DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE;
	readonly fullJanCsaa008Conformance: typeof DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE;
	readonly fullJanCsaa013Conformance: typeof DECLARATION_CONTEXT_ANALYSIS_FULL_JAN_CSAA_013_CONFORMANCE;
	readonly gateEffect: typeof DECLARATION_CONTEXT_ANALYSIS_GATE_EFFECT;
	readonly health: 'PARTIAL';
	readonly id: DeclarationContextAnalysisId;
	readonly inputDigest: string;
	readonly merges: readonly DeclarationContextMergeRecord[];
	readonly method: typeof DECLARATION_CONTEXT_ANALYSIS_METHOD;
	readonly moduleResolutionTrace: DeclarationContextModuleResolutionTraceReference;
	readonly nonclaims: typeof DECLARATION_CONTEXT_ANALYSIS_NONCLAIMS;
	readonly operationVersion: typeof DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION;
	readonly parseWitnesses: readonly DeclarationContextParseWitnessRecord[];
	readonly programInputAttempts: readonly DeclarationContextProgramInputAttemptRecord[];
	readonly programWitness: DeclarationContextProgramWitness;
	readonly projectContextGraph: DeclarationContextProjectContextGraphReference;
	readonly relations: readonly DeclarationContextRelationRecord[];
	readonly resultCompleteness: 'COMPLETE_FOR_SELECTED_SUPPORTED_EXACT_EXPORT_DECLARATION_BINDING';
	readonly schemaVersion: typeof DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION;
	readonly selection: typeof DECLARATION_CONTEXT_ANALYSIS_SELECTION;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly semanticValidationWitness: DeclarationContextSemanticValidationWitness;
	readonly subjectId: string;
	readonly terminalSymbol: DeclarationContextTerminalSymbolRecord;
	readonly truncation: { readonly reason: null; readonly state: 'NOT_TRUNCATED' };
}

export type DeclarationContextAnalysisResult = DeclarationContextAnalysisSnapshot;

export type DeclarationContextAnalysisDiagnosticCode =
	| 'BUDGET_EXCEEDED'
	| 'CAPTURE_INVALID'
	| 'CONDITIONAL_EXPORT_RESOLUTION_INVALID'
	| 'INPUT_IDENTITY_MISMATCH'
	| 'INPUT_POPULATION_MISMATCH'
	| 'MODULE_RESOLUTION_TRACE_INVALID'
	| 'PROGRAM_CONSTRUCTION_UNAVAILABLE'
	| 'PROJECT_CONTEXT_GRAPH_INVALID'
	| 'REQUEST_INVALID'
	| 'SEMANTIC_SNAPSHOT_INVALID'
	| 'TARGET_UNAVAILABLE'
	| 'UNSUPPORTED_REQUEST'
	| 'VALIDATION_FAILED';

export type DeclarationContextAnalysisProgressPhase =
	| 'REQUEST_BIND'
	| 'INPUT_BUDGET'
	| 'SEMANTIC_SNAPSHOT_VALIDATE'
	| 'PROJECT_CONTEXT_GRAPH_VALIDATE'
	| 'CONDITIONAL_EXPORT_RESOLUTION_VALIDATE'
	| 'MODULE_RESOLUTION_TRACE_VALIDATE'
	| 'PROGRAM_CONSTRUCT'
	| 'PROGRAM_SOURCE_ACCOUNT'
	| 'ROOT_EXPORT_ENUMERATE'
	| 'ALIAS_RESOLVE'
	| 'TERMINAL_DECLARATION_BIND'
	| 'ARTIFACT_BIND'
	| 'ARTIFACT_PARSE_ACCOUNT'
	| 'MATERIALIZE'
	| 'SERIALIZE'
	| 'ANALYSIS_VALIDATE';

export interface DeclarationContextAnalysisDiagnostic {
	readonly code: DeclarationContextAnalysisDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: DeclarationContextAnalysisProgressPhase;
}

export type DeclarationContextAnalysisBuildOutcome =
	| {
			readonly analysis: DeclarationContextAnalysisSnapshot;
			readonly diagnostics: readonly DeclarationContextAnalysisDiagnostic[];
			readonly outcome: 'partial';
	  }
	| {
			readonly diagnostics: readonly DeclarationContextAnalysisDiagnostic[];
			readonly outcome: 'unavailable';
	  };

export interface DeclarationContextAnalysisProgressEvent {
	readonly counts: Readonly<Record<string, number>>;
	readonly detailCode: string | null;
	readonly phase: DeclarationContextAnalysisProgressPhase;
	readonly schemaVersion: typeof DECLARATION_CONTEXT_ANALYSIS_PROGRESS_SCHEMA_VERSION;
	readonly sequence: number;
	readonly state: 'COMPLETED' | 'FAILED' | 'STARTED';
}

export interface BuildDeclarationContextAnalysisOptions {
	readonly onProgress?: (event: DeclarationContextAnalysisProgressEvent) => void;
}

export interface DeclarationContextAnalysisValidationOptions {
	readonly maxDepth?: number;
	/**
	 * Optional validator-local wall-clock cap; resource control only and never hashed evidence.
	 * Synchronous predecessor-validator and public-TypeScript capability calls are bracketed but
	 * cannot be preemptively cancelled from this validator.
	 */
	readonly maxDurationMs?: number;
	readonly maxInputRecords?: number;
	readonly maxInputStringCharacters?: number;
	readonly maxIssues?: number;
	readonly maxRecords?: number;
	readonly maxStringCharacters?: number;
}

export type DeclarationContextAnalysisValidationIssueCode =
	| 'BUDGET_EXHAUSTED'
	| 'CONTENT_DIGEST_MISMATCH'
	| 'DERIVATION_MISMATCH'
	| 'IDENTITY_MISMATCH'
	| 'INPUT_INVALID'
	| 'POPULATION_MISMATCH'
	| 'SHAPE_INVALID';

export interface DeclarationContextAnalysisValidationIssue {
	readonly code: DeclarationContextAnalysisValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export type DeclarationContextAnalysisValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly DeclarationContextAnalysisValidationIssue[];
			readonly state: 'BUDGET_EXHAUSTED' | 'INVALID';
	  };

/** Canonical source-population member; no compiler-native object is hash input. */
export interface DeclarationContextProgramSourceIdentity {
	readonly bytes: number;
	readonly contentSha256: string;
	readonly declarationFile: boolean;
	readonly logicalPath: string;
	readonly origin: SourceOrigin;
	readonly semanticSourceId: SemanticSourceId;
}
