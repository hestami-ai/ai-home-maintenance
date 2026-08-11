import type {
	ArtifactDisposition,
	ArtifactPrimaryClass,
	ArtifactSemanticRole
} from '../contracts/subject.js';
import type {
	SemanticAstStructuralRole,
	SemanticBuildDiagnosticCode,
	SemanticCapability,
	SemanticDeclarationCandidateExportSyntax,
	SemanticDeclarationCandidateNameState,
	SemanticDeclarationCandidateRole,
	SemanticDiagnosticFamily,
	SemanticLiteralRecord,
	SourceMappingRecord,
	SourceOrigin
} from '../contracts/semantic.js';

/** JSON-like values retained from an already validated ProgramRecipe. */
export type RawSemanticValue =
	| null
	| boolean
	| number
	| string
	| readonly RawSemanticValue[]
	| { readonly [key: string]: RawSemanticValue };

/**
 * Identity-free copy of the authoritative recipe. Semantic identities are
 * deliberately assigned only after capture/replay agreement.
 */
export interface RawSemanticProgramRecipe {
	readonly compilerOptions: Readonly<Record<string, RawSemanticValue>>;
	readonly configClosureDigest: string;
	readonly configPath: string;
	readonly kind: 'PROJECT' | 'BUILD' | 'SOLUTION';
	readonly projectReferences: readonly string[];
	readonly projectResolutionDigest: string;
	readonly provider: { readonly id: 'typescript'; readonly version: string };
	readonly rootNames: readonly string[];
}

export interface RawSemanticPartialityReason {
	readonly capability: SemanticCapability;
	readonly code: SemanticBuildDiagnosticCode | 'CONTEXT_FRESHNESS_UNKNOWN' | 'FRAMEWORK_CANDIDATES_UNSUPPORTED';
	readonly message: string;
	readonly path: string | null;
}

/**
 * Exact source evidence derived by orchestration from compiler-input
 * observations. Captured evidence is permitted only for the discarded capture
 * projection; emitted semantic facts require finalized and rechecked evidence.
 * Program text is never an evidence source.
 */
export interface RawCompilerSourceBinding {
	readonly artifact: {
		readonly disposition: ArtifactDisposition;
		readonly primaryClass: ArtifactPrimaryClass;
		readonly roles: readonly ArtifactSemanticRole[];
	} | null;
	readonly byteBudgetClass: 'FROZEN_SUBJECT' | 'LIVE_COMPILER_CONTEXT';
	readonly bytes: number;
	readonly contentSha256: string;
	readonly logicalPath: string;
	readonly mapping: SourceMappingRecord;
	readonly origin: SourceOrigin;
	readonly verificationState: 'CAPTURED_COMPILER_INPUT' | 'VERIFIED_COMPILER_INPUT';
}

export interface RawSemanticProject {
	readonly configPath: string;
	readonly frameworkCandidates: readonly string[];
	readonly kind: 'PROJECT' | 'BUILD' | 'SOLUTION';
	readonly partialityReasons: readonly RawSemanticPartialityReason[];
	readonly programRecipe: RawSemanticProgramRecipe;
	readonly projectReferences: readonly string[];
	readonly rootDisposition: 'COMPILER_ROOTS' | 'INTENTIONAL_EMPTY_SOLUTION' | 'INCOMPLETE';
	readonly rootNames: readonly string[];
}

export interface RawSemanticSource {
	readonly analysisDisposition: 'DEEP_INDEXED' | 'CONTEXT_ONLY';
	readonly artifactClass: ArtifactPrimaryClass | 'CONTEXT_ONLY';
	readonly artifactRoles: readonly ArtifactSemanticRole[];
	readonly bytes: number;
	readonly contentSha256: string;
	readonly declarationFile: boolean;
	readonly languageVariant: string;
	readonly logicalPath: string;
	readonly mapping: SourceMappingRecord;
	readonly origin: SourceOrigin;
	readonly rootFile: boolean;
	readonly rootNodeOrdinal: number | null;
	readonly scriptKind: number;
	readonly scriptKindName: string;
	readonly sourceOrdinal: number;
	readonly textLength: number;
}

export interface RawSemanticAstNode {
	readonly end: number;
	readonly fullStart: number;
	readonly hasAssignmentInitializer: boolean;
	readonly kind: number;
	readonly kindName: string;
	readonly nodeOrdinal: number;
	readonly operatorKind: number | null;
	readonly operatorName: string | null;
	readonly parentNodeOrdinal: number | null;
	readonly publicFlags: number;
	readonly siblingOrdinal: number;
	readonly sourceOrdinal: number;
	readonly start: number;
	readonly structuralRoles: readonly SemanticAstStructuralRole[];
	readonly syntacticIdentifierText: string | null;
}

export interface RawSemanticDeclarationCandidate {
	readonly ambientSyntax: boolean;
	readonly candidateRole: SemanticDeclarationCandidateRole;
	readonly exportCarrierNodeOrdinal: number | null;
	readonly exportSyntax: SemanticDeclarationCandidateExportSyntax;
	readonly localModifiers: readonly { readonly code: number; readonly name: string }[];
	readonly nameNodeOrdinal: number | null;
	readonly nameState: SemanticDeclarationCandidateNameState;
	readonly nodeOrdinal: number;
	readonly sourceOrdinal: number;
	readonly syntacticName: string | null;
	readonly syntaxKind: number;
	readonly syntaxKindName: string;
}

export interface RawSemanticLiteral {
	readonly lexemeLength: number;
	readonly lexemeSha256: string;
	readonly nodeOrdinal: number;
	readonly sourceOrdinal: number;
	readonly value: SemanticLiteralRecord['value'];
	readonly valueEncoding: SemanticLiteralRecord['valueEncoding'];
	readonly valueLength: number;
	readonly valueSha256: string;
	readonly valueState: SemanticLiteralRecord['valueState'];
	readonly valueType: SemanticLiteralRecord['valueType'];
}

export interface RawSemanticInvocation {
	readonly argumentNodeOrdinals: readonly number[];
	readonly calleeNodeOrdinal: number;
	readonly invocationKind: 'CALL' | 'NEW' | 'TAGGED_TEMPLATE';
	readonly nodeOrdinal: number;
	readonly optional: boolean;
	readonly sourceOrdinal: number;
	readonly templateNodeOrdinal: number | null;
}

export interface RawSemanticAssignment {
	readonly assignmentKind: 'BINARY' | 'INITIALIZER' | 'PREFIX_UPDATE' | 'POSTFIX_UPDATE';
	readonly nodeOrdinal: number;
	readonly operatorKind: number;
	readonly operatorName: string;
	readonly sourceOrdinal: number;
	readonly targetNodeOrdinal: number;
	readonly valueNodeOrdinal: number | null;
}

export interface RawSemanticDiagnosticMessage {
	readonly category: 'WARNING' | 'ERROR' | 'SUGGESTION' | 'MESSAGE' | null;
	readonly code: number | null;
	readonly next: readonly RawSemanticDiagnosticMessage[];
	readonly text: string;
	readonly textEncoding: 'UNICODE_SCALAR' | 'UTF16_CODE_UNITS_HEX';
	readonly textLength: number;
	readonly textSha256: string;
}

export interface RawSemanticRelatedDiagnostic {
	readonly category: 'WARNING' | 'ERROR' | 'SUGGESTION' | 'MESSAGE';
	readonly code: string;
	readonly end: number | null;
	readonly message: RawSemanticDiagnosticMessage;
	readonly path: string | null;
	readonly start: number | null;
}

/** One record per compiler occurrence; canonical collapsing happens later. */
export interface RawSemanticDiagnosticOccurrence {
	readonly category: 'WARNING' | 'ERROR' | 'SUGGESTION' | 'MESSAGE';
	readonly code: string;
	readonly end: number | null;
	readonly family: SemanticDiagnosticFamily;
	readonly locationKind: 'NONE' | 'PATH' | 'SOURCE';
	readonly message: RawSemanticDiagnosticMessage;
	readonly occurrenceOrdinal: number;
	readonly path: string | null;
	readonly related: readonly RawSemanticRelatedDiagnostic[];
	readonly sourceOrdinal: number | null;
	readonly start: number | null;
}

export interface RawSemanticDiagnosticFamilyCoverage {
	readonly coverage: 'COMPLETE' | 'BOUNDED';
	readonly diagnosticOccurrenceOrdinals: readonly number[];
	readonly family: SemanticDiagnosticFamily;
	readonly reason: string;
	readonly state: 'RUN' | 'FAILED';
}

/**
 * One project's replay-comparable, identity-free semantic projection. Every
 * value is a primitive, array, or plain data object; no TypeScript object,
 * absolute path, timestamp, semantic ID, or provenance is retained.
 */
export interface RawStaticSemanticProjectExtraction {
	readonly assignments: readonly RawSemanticAssignment[];
	readonly astNodes: readonly RawSemanticAstNode[];
	readonly declarationCandidates: readonly RawSemanticDeclarationCandidate[];
	readonly diagnosticFamilies: readonly RawSemanticDiagnosticFamilyCoverage[];
	readonly diagnostics: readonly RawSemanticDiagnosticOccurrence[];
	/** Prevents provisional capture projections from crossing normalization. */
	readonly evidenceState: RawCompilerSourceBinding['verificationState'];
	readonly invocations: readonly RawSemanticInvocation[];
	readonly literals: readonly RawSemanticLiteral[];
	readonly project: RawSemanticProject;
	readonly sources: readonly RawSemanticSource[];
}
