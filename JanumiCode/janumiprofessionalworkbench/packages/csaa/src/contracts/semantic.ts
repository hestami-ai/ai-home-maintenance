import type {
	ArtifactPrimaryClass,
	ArtifactSemanticRole,
	ProgramRecipe,
	SubjectDiagnostic,
	SubjectDiagnosticCode
} from './subject.js';

export const SEMANTIC_REQUEST_SCHEMA_VERSION = 'jan-csaa-semantic-request/1.0.0' as const;
export const SEMANTIC_SNAPSHOT_SCHEMA_VERSION = 'jan-csaa-semantic-snapshot/2.0.0' as const;
export const SEMANTIC_OPERATION_VERSION = 'jan-csaa-build-static-semantic-snapshot/1.0.0' as const;
export const SEMANTIC_EXTRACTION_VERSION = 'jan-csaa-typescript-syntax/0.2.0' as const;
export const SEMANTIC_CANONICAL_PROFILE = 'jan-csaa-semantic-canonical/1.0.0' as const;
export const SEMANTIC_AST_TRAVERSAL_PROFILE = 'typescript-public-normalized-ast-with-jsdoc/1.0.0' as const;
export const TYPESCRIPT_PROVIDER_VERSION = '5.9.3' as const;
export const FULL_JAN_CSAA_007_CONFORMANCE = 'NOT_CLAIMED' as const;

declare const semanticIdBrand: unique symbol;
export type SemanticId<Kind extends string> = string & { readonly [semanticIdBrand]: Kind };
export type SemanticSnapshotId = SemanticId<'SemanticSnapshot'>;
export type SemanticProjectId = SemanticId<'SemanticProject'>;
export type SemanticProgramId = SemanticId<'SemanticProgram'>;
export type SemanticSourceId = SemanticId<'SemanticSource'>;
export type SemanticNodeId = SemanticId<'SemanticNode'>;
export type SemanticDeclarationCandidateId = SemanticId<'SemanticDeclarationCandidate'>;
export type SemanticInvocationSiteId = SemanticId<'SemanticInvocationSite'>;
export type SemanticDiagnosticId = SemanticId<'SemanticDiagnostic'>;
export type SemanticContextInputId = SemanticId<'SemanticContextInput'>;
export type SemanticProvenanceId = SemanticId<'SemanticProvenance'>;

export type SemanticCapability = 'TS_PROJECT' | 'TS_SYNTAX' | 'TS_SYMBOL' | 'TS_TYPE';
export type SemanticHealth = 'COMPLETE' | 'PARTIAL';
export type SemanticAstStructuralRole =
	| 'assignment-target'
	| 'assignment-value'
	| 'declaration-name'
	| 'generic-child'
	| 'invocation-argument'
	| 'invocation-callee'
	| 'invocation-template'
	| 'source-file';

export interface SemanticCapabilityRecord {
	readonly capability: SemanticCapability;
	readonly reason: string;
	readonly state: 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED';
}

export const SEMANTIC_BUDGET_KEYS = [
	'maxAstDepth',
	'maxAstNodes',
	'maxCompilerInputMetadataBytes',
	'maxCompilerQueries',
	'maxCompilerQueryInvocations',
	'maxContextBytes',
	'maxContextFileBytes',
	'maxContextFiles',
	'maxDiagnosticCharacters',
	'maxDiagnostics',
	'maxDirectoryEntries',
	'maxDurationMs',
	'maxLiteralCharacters',
	'maxPathCharacters',
	'maxProjects',
	'maxSnapshotBytes',
	'maxSources'
] as const;

export type SemanticBudgetKey = typeof SEMANTIC_BUDGET_KEYS[number];
export type SemanticBudgets = Readonly<Record<SemanticBudgetKey, number>>;

export interface BuildStaticSemanticSnapshotRequest {
	readonly budgets: SemanticBudgets;
	readonly capabilities: readonly SemanticCapability[];
	readonly expectEmpty: boolean;
	readonly operationVersion: typeof SEMANTIC_OPERATION_VERSION;
	readonly rootLocator: string;
	readonly schemaVersion: typeof SEMANTIC_REQUEST_SCHEMA_VERSION;
	readonly subjectId: string;
}

export type SemanticBuildDiagnosticCode =
	| SubjectDiagnosticCode
	| 'CAPABILITY_UNSUPPORTED'
	| 'COMPILER_CONTEXT_CHANGED'
	| 'COMPILER_CONTEXT_FORBIDDEN'
	| 'COMPILER_CONTEXT_UNAVAILABLE'
	| 'COMPILER_VERSION_MISMATCH'
	| 'FROZEN_BYTES_UNAVAILABLE'
	| 'PROGRAM_CREATION_FAILED'
	| 'PROGRAM_RECIPE_MISMATCH'
	| 'SEMANTIC_BUDGET_EXCEEDED'
	| 'SEMANTIC_VALIDATION_FAILED'
	| 'SUBJECT_ID_MISMATCH';

export interface SemanticBuildDiagnostic {
	readonly code: SemanticBuildDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'REQUEST' | 'FRESHNESS' | 'MATERIALIZE' | 'CAPTURE' | 'RECHECK' | 'PROGRAM' | 'EXTRACT' | 'VALIDATE';
	readonly severity: 'INFO' | 'WARNING' | 'ERROR';
}

export interface SemanticProviderIdentity {
	readonly api: 'PUBLIC_COMPILER_API';
	readonly id: 'typescript';
	readonly version: typeof TYPESCRIPT_PROVIDER_VERSION;
}

export type SemanticCapabilityCoverage = 'supported' | 'partial' | 'unsupported' | 'excluded' | 'not-analyzed';
export type SemanticExecutionHealth = 'succeeded' | 'failed' | 'timed-out' | 'cancelled' | 'resource-exhausted' | 'malformed-output' | 'unavailable' | 'not-run';
export type SemanticFreshness = 'current-for-subject' | 'stale' | 'invalidated' | 'unknown';
export type SemanticConflict = 'unopposed' | 'corroborated' | 'conflicting' | 'corrected' | 'superseded';
export type SemanticInference = 'direct' | 'derived' | 'candidate' | 'bounded-inference' | 'unknown' | 'not-applicable';

export interface SemanticSupportBasis {
	readonly kind: 'direct-extraction' | 'compiler-confirmed' | 'derived' | 'unknown' | 'not-applicable';
	readonly method: string | null;
	readonly rationale: string;
	readonly sourceRefs: readonly string[];
}

export interface SemanticEpistemicState {
	readonly capabilityCoverage: SemanticCapabilityCoverage;
	readonly conflict: SemanticConflict;
	readonly executionHealth: SemanticExecutionHealth;
	readonly freshness: SemanticFreshness;
	readonly inference: SemanticInference;
	readonly rationale: string;
	readonly supportBasis: SemanticSupportBasis;
	readonly unresolvedRegions: readonly string[];
}

export interface SemanticInvalidationDependency {
	readonly digest: string;
	readonly kind: 'SUBJECT' | 'PROJECT_RECIPE' | 'CONTEXT_INPUT' | 'PROVIDER' | 'EXTRACTION';
}

export interface SemanticLimitation {
	readonly capability: SemanticCapability;
	readonly closureEffect: 'NONE' | 'DEGRADES_CLOSURE' | 'FATAL';
	readonly reason: string;
	readonly region: string;
}

export interface SemanticFactProvenanceRecord {
	readonly capability: 'TS_PROJECT' | 'TS_SYNTAX';
	readonly epistemic: SemanticEpistemicState;
	readonly extractionVersion: typeof SEMANTIC_EXTRACTION_VERSION;
	readonly id: SemanticProvenanceId;
	readonly invalidationDependencies: readonly SemanticInvalidationDependency[];
	readonly limitations: readonly SemanticLimitation[];
	readonly parentProvenanceId: SemanticProvenanceId | null;
	readonly projectId: SemanticProjectId;
	readonly provider: SemanticProviderIdentity;
	readonly snapshotId: SemanticSnapshotId;
	readonly sourceId: SemanticSourceId | null;
	readonly subjectId: string;
}

export type SourceOrigin =
	| 'AUTHORED'
	| 'TEST'
	| 'VERIFICATION'
	| 'SCRIPT'
	| 'GENERATOR'
	| 'GENERATED'
	| 'GENERATED_DECLARATION'
	| 'WORKSPACE_BUILD_DECLARATION'
	| 'EXTERNAL_DECLARATION'
	| 'TOOLCHAIN_LIBRARY'
	| 'CONFIGURATION'
	| 'UNKNOWN';

export interface SourceMappingRecord {
	readonly reason: string;
	readonly state: 'EXACT' | 'PARTIAL' | 'AMBIGUOUS' | 'UNAVAILABLE' | 'CONFLICTING' | 'NOT_APPLICABLE';
}

interface CompilerInputObservationBase {
	readonly id: SemanticContextInputId;
	readonly invocationCount: number;
	readonly logicalPath: string;
	readonly origin: SourceOrigin;
	readonly resultDigest: string;
}

export type CompilerInputObservation = CompilerInputObservationBase & (
	| {
		readonly byteBudgetClass: 'FROZEN_SUBJECT' | 'LIVE_COMPILER_CONTEXT';
		readonly contentBytes: number;
		readonly contentSha256: string;
		readonly operation: 'READ_FILE';
		readonly result: 'PRESENT';
	}
	| { readonly operation: 'READ_FILE'; readonly result: 'ABSENT' }
	| { readonly operation: 'FILE_EXISTS'; readonly result: 'PRESENT' | 'ABSENT' }
	| { readonly operation: 'DIRECTORY_EXISTS'; readonly result: 'DIRECTORY' | 'NOT_DIRECTORY' }
	| { readonly operation: 'GET_DIRECTORIES'; readonly result: 'DIRECTORY' | 'NOT_DIRECTORY'; readonly resultEntries: readonly string[]; readonly scannedEntries: number }
	| {
		readonly depth: number | null;
		readonly excludes: readonly string[];
		readonly extensions: readonly string[];
		readonly includes: readonly string[];
		readonly operation: 'READ_DIRECTORY';
		readonly result: 'DIRECTORY' | 'NOT_DIRECTORY';
		readonly resultEntries: readonly string[];
		readonly scannedEntries: number;
	}
	| { readonly operation: 'REALPATH'; readonly result: 'ABSENT' }
	| { readonly operation: 'REALPATH'; readonly resolvedLogicalPath: string; readonly result: 'RESOLVED' }
	| { readonly operation: 'CURRENT_DIRECTORY'; readonly resolvedLogicalPath: '.'; readonly result: 'RESOLVED' }
	| { readonly operation: 'USE_CASE_SENSITIVE_FILE_NAMES'; readonly result: 'CASE_SENSITIVE' | 'CASE_INSENSITIVE' }
);

export interface SemanticPartialityReason {
	readonly capability: SemanticCapability;
	readonly code: SemanticBuildDiagnosticCode | SubjectDiagnostic['code'] | 'CONTEXT_FRESHNESS_UNKNOWN' | 'FRAMEWORK_CANDIDATES_UNSUPPORTED';
	readonly message: string;
	readonly path: string | null;
}

export interface SemanticProjectRecord {
	readonly configPath: string;
	readonly contextInputIds: readonly SemanticContextInputId[];
	readonly diagnosticIds: readonly SemanticDiagnosticId[];
	readonly frameworkCandidates: readonly string[];
	readonly health: SemanticHealth;
	readonly id: SemanticProjectId;
	readonly kind: 'PROJECT' | 'BUILD' | 'SOLUTION';
	readonly partialityReasons: readonly SemanticPartialityReason[];
	readonly programId: SemanticProgramId;
	readonly programRecipe: ProgramRecipe;
	readonly provenanceId: SemanticProvenanceId;
	readonly projectReferences: readonly string[];
	readonly rootDisposition: 'COMPILER_ROOTS' | 'INTENTIONAL_EMPTY_SOLUTION' | 'INCOMPLETE';
	readonly rootNames: readonly string[];
	readonly sourceIds: readonly SemanticSourceId[];
}

export interface SemanticProgramRecord {
	readonly checkerState: 'CREATED';
	readonly contextDigest: string;
	readonly diagnosticFamilies: readonly SemanticDiagnosticFamilyCoverage[];
	readonly diagnosticIds: readonly SemanticDiagnosticId[];
	readonly id: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly provenanceId: SemanticProvenanceId;
	readonly rootSourceIds: readonly SemanticSourceId[];
	readonly sourceIds: readonly SemanticSourceId[];
}

export interface SemanticSourceRecord {
	readonly analysisDisposition: 'DEEP_INDEXED' | 'CONTEXT_ONLY';
	readonly artifactClass: ArtifactPrimaryClass | 'CONTEXT_ONLY';
	readonly artifactRoles: readonly ArtifactSemanticRole[];
	readonly bytes: number;
	readonly contentSha256: string;
	readonly declarationFile: boolean;
	readonly diagnosticIds: readonly SemanticDiagnosticId[];
	readonly id: SemanticSourceId;
	readonly languageVariant: string;
	readonly logicalPath: string;
	readonly mapping: SourceMappingRecord;
	readonly origin: SourceOrigin;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
	readonly provenanceId: SemanticProvenanceId;
	readonly rootFile: boolean;
	readonly rootNodeId: SemanticNodeId | null;
	readonly scriptKind: number;
	readonly scriptKindName: string;
	readonly syntaxProvenanceId: SemanticProvenanceId | null;
	readonly textLength: number;
}

export interface SemanticAstNodeRecord {
	readonly end: number;
	readonly publicFlags: number;
	readonly fullStart: number;
	readonly hasAssignmentInitializer: boolean;
	readonly id: SemanticNodeId;
	readonly syntacticIdentifierText: string | null;
	readonly kind: number;
	readonly kindName: string;
	readonly operatorKind: number | null;
	readonly operatorName: string | null;
	readonly parentId: SemanticNodeId | null;
	readonly siblingOrdinal: number;
	readonly sourceId: SemanticSourceId;
	readonly start: number;
	readonly structuralRoles: readonly SemanticAstStructuralRole[];
}

export type SemanticDeclarationCandidateRole = 'BINDING' | 'MEMBER' | 'SIGNATURE' | 'IMPORT_ALIAS' | 'EXPORT_BINDING' | 'JSDOC_BINDING';
export type SemanticDeclarationCandidateNameState = 'ATOMIC' | 'COMPUTED' | 'PATTERN' | 'MISSING' | 'ANONYMOUS';
export type SemanticDeclarationCandidateExportSyntax = 'NONE' | 'EXPLICIT' | 'DEFAULT' | 'EXPORT_SPECIFIER' | 'EXPORT_ASSIGNMENT' | 'NAMESPACE_EXPORT';

export interface SemanticDeclarationCandidateRecord {
	readonly ambientSyntax: boolean;
	readonly candidateRole: SemanticDeclarationCandidateRole;
	readonly candidateState: 'SYNTAX_ONLY';
	readonly exportCarrierNodeId: SemanticNodeId | null;
	readonly exportSyntax: SemanticDeclarationCandidateExportSyntax;
	readonly id: SemanticDeclarationCandidateId;
	readonly localModifiers: readonly { readonly code: number; readonly name: string }[];
	readonly nameNodeId: SemanticNodeId | null;
	readonly nameState: SemanticDeclarationCandidateNameState;
	readonly nodeId: SemanticNodeId;
	readonly sourceId: SemanticSourceId;
	readonly syntacticName: string | null;
	readonly syntaxKind: number;
	readonly syntaxKindName: string;
}

interface SemanticLiteralRecordBase {
	readonly lexemeLength: number;
	readonly lexemeSha256: string;
	readonly nodeId: SemanticNodeId;
	readonly sourceId: SemanticSourceId;
	readonly valueLength: number;
	readonly valueSha256: string;
	readonly valueType:
		| 'STRING'
		| 'NUMBER'
		| 'BIGINT'
		| 'BOOLEAN'
		| 'NULL'
		| 'REGEXP'
		| 'NO_SUBSTITUTION_TEMPLATE'
		| 'TEMPLATE_HEAD'
		| 'TEMPLATE_MIDDLE'
		| 'TEMPLATE_TAIL';
}

export type SemanticLiteralRecord = SemanticLiteralRecordBase & (
	| { readonly value: string | boolean | null; readonly valueEncoding: 'JSON_SCALAR' | 'TYPESCRIPT_TEXT'; readonly valueState: 'EXACT' }
	| { readonly value: null; readonly valueEncoding: 'JSON_SCALAR' | 'TYPESCRIPT_TEXT'; readonly valueState: 'DIGEST_ONLY' }
	| { readonly value: null; readonly valueEncoding: 'UTF16_CODE_UNITS_LE'; readonly valueState: 'DIGEST_ONLY' }
);

interface SemanticInvocationSiteRecordBase {
	readonly calleeNodeId: SemanticNodeId;
	readonly id: SemanticInvocationSiteId;
	readonly invocationKind: 'CALL' | 'NEW' | 'TAGGED_TEMPLATE';
	readonly nodeId: SemanticNodeId;
	readonly sourceId: SemanticSourceId;
	readonly targetState: 'SYNTAX_ONLY';
}

export type SemanticInvocationSiteRecord = SemanticInvocationSiteRecordBase & (
	| {
	readonly argumentNodeIds: readonly SemanticNodeId[];
	readonly optional: boolean;
	readonly invocationKind: 'CALL';
	readonly templateNodeId: null;
	}
	| {
	readonly argumentNodeIds: readonly SemanticNodeId[];
	readonly optional: false;
	readonly invocationKind: 'NEW';
	readonly templateNodeId: null;
	}
	| {
	readonly argumentNodeIds: readonly [];
	readonly optional: false;
	readonly invocationKind: 'TAGGED_TEMPLATE';
	readonly templateNodeId: SemanticNodeId;
	}
);

export interface SemanticAssignmentRecord {
	readonly assignmentKind: 'BINARY' | 'INITIALIZER' | 'PREFIX_UPDATE' | 'POSTFIX_UPDATE';
	readonly nodeId: SemanticNodeId;
	readonly operatorKind: number;
	readonly operatorName: string;
	readonly sourceId: SemanticSourceId;
	readonly targetNodeId: SemanticNodeId;
	readonly valueNodeId: SemanticNodeId | null;
}

export type SemanticDiagnosticFamily = 'CONFIGURATION' | 'OPTIONS' | 'GLOBAL' | 'SYNTACTIC' | 'SEMANTIC' | 'DECLARATION';

export interface SemanticDiagnosticFamilyCoverage {
	readonly coverage: 'COMPLETE' | 'BOUNDED';
	readonly diagnosticIds: readonly SemanticDiagnosticId[];
	readonly family: SemanticDiagnosticFamily;
	readonly manifestDigest: string;
	readonly occurrenceCount: number;
	readonly reason: string;
	readonly recordCount: number;
	readonly state: 'RUN' | 'NOT_APPLICABLE' | 'FAILED';
}

export interface SemanticDiagnosticMessage {
	readonly category: 'WARNING' | 'ERROR' | 'SUGGESTION' | 'MESSAGE' | null;
	readonly code: number | null;
	readonly next: readonly SemanticDiagnosticMessage[];
	readonly text: string;
	readonly textEncoding: 'UNICODE_SCALAR' | 'UTF16_CODE_UNITS_HEX';
	readonly textLength: number;
	readonly textSha256: string;
}

export interface SemanticRelatedDiagnostic {
	readonly category: 'WARNING' | 'ERROR' | 'SUGGESTION' | 'MESSAGE';
	readonly code: string;
	readonly end: number | null;
	readonly message: SemanticDiagnosticMessage;
	readonly path: string | null;
	readonly start: number | null;
}

export interface SemanticDiagnosticRecord {
	readonly category: 'WARNING' | 'ERROR' | 'SUGGESTION' | 'MESSAGE';
	readonly code: string;
	readonly end: number | null;
	readonly family: SemanticDiagnosticFamily;
	readonly id: SemanticDiagnosticId;
	readonly locationKind: 'NONE' | 'PATH' | 'SOURCE';
	readonly message: SemanticDiagnosticMessage;
	readonly multiplicity: number;
	readonly path: string | null;
	readonly projectId: SemanticProjectId;
	readonly provenanceId: SemanticProvenanceId;
	readonly related: readonly SemanticRelatedDiagnostic[];
	readonly sourceId: SemanticSourceId | null;
	readonly start: number | null;
}

export type SemanticPopulationKind =
	| 'PROJECT'
	| 'PROGRAM'
	| 'SOURCE'
	| 'AST_NODE'
	| 'DECLARATION_CANDIDATE'
	| 'LITERAL'
	| 'INVOCATION_SITE'
	| 'ASSIGNMENT'
	| 'DIAGNOSTIC'
	| 'PROVENANCE'
	| 'FRAMEWORK_CANDIDATE'
	| 'CONTEXT_INPUT';

export interface SemanticPopulationRecord {
	readonly analyzed: number;
	readonly contextOnly: number;
	readonly discovered: number;
	readonly excluded: number;
	readonly excludedByPolicy: number;
	readonly expectedZero: boolean;
	readonly failed: number;
	readonly included: number;
	readonly kind: SemanticPopulationKind;
	readonly members: {
		readonly analyzed: readonly string[];
		readonly contextOnly: readonly string[];
		readonly excluded: readonly string[];
		readonly excludedByPolicy: readonly string[];
		readonly failed: readonly string[];
		readonly unknown: readonly string[];
		readonly unsupported: readonly string[];
	};
	readonly manifests: {
		readonly analyzed: string;
		readonly contextOnly: string;
		readonly discovered: string;
		readonly excluded: string;
		readonly excludedByPolicy: string;
		readonly failed: string;
		readonly included: string;
		readonly unknown: string;
		readonly unsupported: string;
	};
	readonly reconciles: boolean;
	readonly unsupported: number;
	readonly unknown: number;
}

export interface StaticSemanticSnapshot {
	readonly assignments: readonly SemanticAssignmentRecord[];
	readonly astNodes: readonly SemanticAstNodeRecord[];
	readonly astTraversalProfile: typeof SEMANTIC_AST_TRAVERSAL_PROFILE;
	readonly budgets: SemanticBudgets;
	readonly canonicalProfile: typeof SEMANTIC_CANONICAL_PROFILE;
	readonly capabilities: readonly SemanticCapabilityRecord[];
	readonly compilerInputs: readonly CompilerInputObservation[];
	readonly contextDigest: string;
	readonly declarationCandidates: readonly SemanticDeclarationCandidateRecord[];
	readonly diagnostics: readonly SemanticDiagnosticRecord[];
	readonly extractionVersion: typeof SEMANTIC_EXTRACTION_VERSION;
	readonly expectedEmpty: boolean;
	readonly fullJanCsaa007Conformance: typeof FULL_JAN_CSAA_007_CONFORMANCE;
	readonly health: SemanticHealth;
	readonly id: SemanticSnapshotId;
	readonly invocations: readonly SemanticInvocationSiteRecord[];
	readonly limitations: readonly SemanticLimitation[];
	readonly literals: readonly SemanticLiteralRecord[];
	readonly populations: readonly SemanticPopulationRecord[];
	readonly programs: readonly SemanticProgramRecord[];
	readonly projects: readonly SemanticProjectRecord[];
	readonly provenances: readonly SemanticFactProvenanceRecord[];
	readonly provider: SemanticProviderIdentity;
	readonly requestedCapabilities: readonly SemanticCapability[];
	readonly schemaVersion: typeof SEMANTIC_SNAPSHOT_SCHEMA_VERSION;
	readonly sources: readonly SemanticSourceRecord[];
	readonly subjectId: string;
	readonly operationVersion: typeof SEMANTIC_OPERATION_VERSION;
}

export type StaticSemanticSnapshotOutcome =
	| { readonly diagnostics: readonly SemanticBuildDiagnostic[]; readonly outcome: 'complete'; readonly snapshot: StaticSemanticSnapshot }
	| { readonly diagnostics: readonly SemanticBuildDiagnostic[]; readonly outcome: 'partial'; readonly snapshot: StaticSemanticSnapshot }
	| { readonly diagnostics: readonly SemanticBuildDiagnostic[]; readonly outcome: 'unavailable'; readonly snapshot?: never }
	| { readonly diagnostics: readonly SemanticBuildDiagnostic[]; readonly outcome: 'incompatible'; readonly snapshot?: never };
