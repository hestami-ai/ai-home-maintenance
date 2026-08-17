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
	SemanticModuleOccurrenceKind,
	SemanticModuleSpecifierState,
	SemanticOverloadMembershipRole,
	SemanticReferenceRole,
	SemanticScopeDomain,
	SemanticScopeKind,
	SemanticScopeLinkState,
	SemanticSignatureDeclarationRole,
	SemanticSignatureKind,
	SemanticSignatureSemanticKind,
	SemanticSourceModuleKind,
	SemanticTypeCategory,
	SemanticTypeIdentityBasis,
	SemanticTypeQueryMode,
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
	readonly code:
		SemanticBuildDiagnosticCode | 'CONTEXT_FRESHNESS_UNKNOWN' | 'FRAMEWORK_CANDIDATES_UNSUPPORTED';
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
	readonly moduleKind: SemanticSourceModuleKind;
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

export interface RawSemanticDeclaration {
	readonly ambient: boolean;
	readonly candidateNodeOrdinal: number | null;
	readonly declaringScopeOrdinal: number | null;
	readonly declarationOrdinal: number;
	readonly end: number;
	readonly kind: number;
	readonly kindName: string;
	readonly name: string | null;
	readonly nameState: SemanticDeclarationCandidateNameState;
	readonly nodeOrdinal: number | null;
	readonly sourceOrdinal: number;
	readonly scopeLinkState: SemanticScopeLinkState;
	readonly start: number;
	readonly symbolBindingState: 'RESOLVED' | 'UNSUPPORTED';
	readonly symbolOrdinal: number | null;
}

export interface RawSemanticSymbol {
	readonly declarationOrdinals: readonly number[];
	readonly fallbackReferenceNodes: readonly {
		readonly nodeOrdinal: number;
		readonly sourceOrdinal: number;
	}[];
	readonly flags: number;
	readonly flagNames: readonly string[];
	readonly name: string;
	readonly symbolOrdinal: number;
	readonly valueDeclarationOrdinal: number | null;
}

export interface RawSemanticAlias {
	readonly aliasSymbolOrdinal: number;
	readonly state: 'RESOLVED' | 'UNRESOLVED' | 'CIRCULAR' | 'UNSUPPORTED';
	readonly targetSymbolOrdinal: number | null;
	readonly terminalSymbolOrdinal: number | null;
}

export interface RawSemanticReference {
	readonly containingScopeOrdinal: number | null;
	readonly nodeOrdinal: number;
	readonly resolvedSymbolOrdinal: number | null;
	readonly resolutionState: 'RESOLVED_DIRECT' | 'RESOLVED_ALIAS' | 'UNRESOLVED' | 'UNSUPPORTED';
	readonly role: SemanticReferenceRole;
	readonly scopeLinkState: SemanticScopeLinkState;
	readonly sourceOrdinal: number;
	readonly symbolOrdinal: number | null;
}

export interface RawSemanticScope {
	readonly domain: SemanticScopeDomain;
	readonly end: number | null;
	readonly kind: SemanticScopeKind;
	readonly ownerKind: number | null;
	readonly ownerKindName: string | null;
	readonly ownerNodeOrdinal: number | null;
	readonly parentScopeOrdinal: number | null;
	readonly scopeOrdinal: number;
	readonly sourceOrdinal: number | null;
	readonly start: number | null;
}

export interface RawSemanticModuleResolution {
	readonly moduleSymbolOrdinal: number | null;
	readonly nodeOrdinal: number;
	readonly occurrenceKind: SemanticModuleOccurrenceKind;
	readonly resolutionState:
		'RESOLVED_SOURCE' | 'RESOLVED_AMBIENT' | 'RESOLVED_EXTERNAL' | 'UNRESOLVED' | 'UNSUPPORTED';
	readonly sourceOrdinal: number;
	readonly specifier: string | null;
	readonly specifierState: SemanticModuleSpecifierState;
	readonly targetSourceOrdinal: number | null;
	readonly typeOnly: boolean;
}

export interface RawSemanticModuleExport {
	readonly exportName: string;
	readonly sourceOrdinal: number;
	readonly state: 'DIRECT' | 'ALIAS' | 'REEXPORT' | 'UNRESOLVED';
	readonly symbolOrdinal: number;
	readonly targetSymbolOrdinal: number | null;
}

export type RawSemanticTypeAcquisitionAnchor =
	| {
			readonly kind: 'NODE';
			readonly nodeOrdinal: number;
			readonly queryMode: SemanticTypeQueryMode;
			readonly sourceOrdinal: number;
	  }
	| {
			readonly declarationOrdinal: number;
			readonly kind: 'DECLARATION';
			readonly queryMode: SemanticTypeQueryMode;
	  }
	| {
			readonly kind: 'SYMBOL';
			readonly queryMode: SemanticTypeQueryMode;
			readonly symbolOrdinal: number;
	  }
	| {
			readonly componentKind: 'UNION' | 'INTERSECTION' | 'GENERIC_TARGET' | 'TYPE_ARGUMENT';
			readonly componentOrdinal: number;
			readonly kind: 'TYPE_COMPONENT';
			readonly parentTypeOrdinal: number;
	  }
	| {
			readonly componentKind: 'THIS' | 'PARAMETER' | 'RETURN' | 'TYPE_PARAMETER';
			readonly componentOrdinal: number;
			readonly kind: 'SIGNATURE_COMPONENT';
			readonly signatureOrdinal: number;
	  };

export interface RawSemanticType {
	readonly acquisitionAnchors: readonly RawSemanticTypeAcquisitionAnchor[];
	readonly aliasSymbolOrdinal: number | null;
	readonly category: SemanticTypeCategory;
	readonly display: string;
	readonly displayProfile: 'typescript-type-to-string-canonical-logical-paths/5.9.3-default/1.0.0';
	readonly displaySha256: string;
	readonly fingerprintProfile: 'jan-csaa-ts-type-fingerprint/1.0.0';
	readonly fingerprintSha256: string;
	readonly flagNames: readonly string[];
	readonly flags: number;
	readonly identityBasis: SemanticTypeIdentityBasis;
	readonly objectFlagNames: readonly string[];
	readonly objectFlags: number | null;
	readonly structureState: 'COMPLETE' | 'BOUNDED';
	readonly symbolOrdinal: number | null;
	readonly typeOrdinal: number;
	readonly unsupportedStructureKinds: readonly string[];
}

export type RawSemanticTypeParameterOwner =
	| { readonly kind: 'TYPE'; readonly typeOrdinal: number }
	| { readonly kind: 'SIGNATURE'; readonly signatureOrdinal: number }
	| { readonly declarationOrdinal: number; readonly kind: 'DECLARATION' };

type RawSemanticTypeParameterResolutionState =
	| 'RESOLVED'
	| 'MISSING'
	| 'UNRESOLVED'
	| 'UNSUPPORTED';

export interface RawSemanticTypeParameter {
	readonly constraintState: RawSemanticTypeParameterResolutionState;
	readonly constraintTypeOrdinal: number | null;
	readonly declarationOrdinal: number | null;
	readonly defaultState: RawSemanticTypeParameterResolutionState;
	readonly defaultTypeOrdinal: number | null;
	readonly name: string;
	readonly ordinal: number;
	readonly owner: RawSemanticTypeParameterOwner;
	readonly parameterTypeOrdinal: number;
	readonly typeParameterOrdinal: number;
}

export type RawSemanticSignatureOwner =
	| { readonly kind: 'TYPE'; readonly typeOrdinal: number }
	| { readonly kind: 'SYMBOL'; readonly symbolOrdinal: number }
	| { readonly declarationOrdinal: number; readonly kind: 'DECLARATION' };

export interface RawSemanticSignature {
	readonly declarationOrdinal: number | null;
	readonly declarationRole: SemanticSignatureDeclarationRole;
	readonly display: string;
	readonly displaySha256: string;
	readonly fingerprintProfile: 'jan-csaa-ts-signature-fingerprint/1.0.0';
	readonly fingerprintSha256: string;
	readonly identityBasis: 'DECLARATION_ANCHORED' | 'OWNER_ORDINAL';
	readonly owner: RawSemanticSignatureOwner;
	readonly parameterOrdinals: readonly number[];
	readonly providerOrdinal: number | null;
	readonly returnTypeOrdinal: number;
	readonly semanticKind: SemanticSignatureSemanticKind;
	readonly signatureKind: SemanticSignatureKind;
	readonly signatureOrdinal: number;
	readonly typeParameterOrdinals: readonly number[];
}

export interface RawSemanticSignatureParameter {
	readonly declarationOrdinal: number | null;
	readonly name: string;
	readonly optional: boolean;
	readonly ordinal: number;
	readonly rest: boolean;
	readonly role: 'THIS' | 'PARAMETER';
	readonly signatureOrdinal: number;
	readonly signatureParameterOrdinal: number;
	readonly symbolOrdinal: number | null;
	readonly typeOrdinal: number;
}

export interface RawSemanticOverloadSet {
	readonly callableSymbolOrdinal: number;
	readonly overloadSetOrdinal: number;
}

export type RawSemanticTypeSubjectRef =
	| { readonly kind: 'AST_NODE'; readonly nodeOrdinal: number; readonly sourceOrdinal: number }
	| { readonly declarationOrdinal: number; readonly kind: 'DECLARATION' }
	| { readonly kind: 'SYMBOL'; readonly symbolOrdinal: number };

export type RawSemanticTypeOrSignatureRef =
	| { readonly kind: 'TYPE'; readonly typeOrdinal: number }
	| { readonly kind: 'SIGNATURE'; readonly signatureOrdinal: number };

export type RawSemanticHeritageOccurrenceRef =
	| { readonly kind: 'AST_NODE'; readonly nodeOrdinal: number; readonly sourceOrdinal: number }
	| { readonly declarationOrdinal: number; readonly kind: 'DECLARATION' };

interface RawSemanticTypeRelationBase {
	readonly relationOrdinal: number;
	readonly state: 'CONFIRMED' | 'UNRESOLVED' | 'UNSUPPORTED';
}

export interface RawSemanticTypeOfRelation extends RawSemanticTypeRelationBase {
	readonly kind: 'TYPE_OF';
	readonly queryMode: SemanticTypeQueryMode;
	readonly subject: RawSemanticTypeSubjectRef;
	readonly typeOrdinal: number | null;
}

export interface RawSemanticTypeAliasRelation extends RawSemanticTypeRelationBase {
	readonly aliasDeclarationOrdinal: number;
	readonly aliasedTypeOrdinal: number | null;
	readonly kind: 'TYPE_ALIAS';
}

export interface RawSemanticTypeConstituentRelation extends RawSemanticTypeRelationBase {
	readonly compositeTypeOrdinal: number;
	readonly constituentTypeOrdinal: number;
	readonly kind: 'UNION_CONSTITUENT' | 'INTERSECTION_CONSTITUENT';
	readonly ordinal: number;
}

export interface RawSemanticGenericInstantiationRelation extends RawSemanticTypeRelationBase {
	readonly argumentTypeOrdinals: readonly number[];
	readonly genericTarget: RawSemanticTypeOrSignatureRef;
	readonly instantiatedTarget: RawSemanticTypeOrSignatureRef;
	readonly kind: 'GENERIC_INSTANTIATION';
}

export interface RawSemanticParameterConstraintRelation extends RawSemanticTypeRelationBase {
	readonly constraintState: RawSemanticTypeParameterResolutionState;
	readonly constraintTypeOrdinal: number | null;
	readonly kind: 'PARAMETER_CONSTRAINT';
	readonly typeParameterOrdinal: number;
}

export interface RawSemanticHeritageTypeRelation extends RawSemanticTypeRelationBase {
	readonly baseTypeOrdinal: number;
	readonly derivedTypeOrdinal: number;
	readonly heritageOccurrence: RawSemanticHeritageOccurrenceRef;
	readonly kind: 'TYPE_EXTENSION' | 'TYPE_IMPLEMENTATION';
}

export interface RawSemanticAssignabilityRelation extends RawSemanticTypeRelationBase {
	readonly checkerContextDigest: string;
	readonly kind: 'ASSIGNABILITY';
	readonly requestId: string;
	readonly result: boolean | null;
	readonly sourceTypeOrdinal: number | null;
	readonly targetTypeOrdinal: number | null;
}

export interface RawSemanticOverloadMembershipRelation extends RawSemanticTypeRelationBase {
	readonly kind: 'OVERLOAD_MEMBERSHIP';
	readonly ordinal: number;
	readonly overloadSetOrdinal: number;
	readonly role: SemanticOverloadMembershipRole;
	readonly signatureOrdinal: number;
}

export type RawSemanticTypeRelation =
	| RawSemanticTypeOfRelation
	| RawSemanticTypeAliasRelation
	| RawSemanticTypeConstituentRelation
	| RawSemanticGenericInstantiationRelation
	| RawSemanticParameterConstraintRelation
	| RawSemanticHeritageTypeRelation
	| RawSemanticAssignabilityRelation
	| RawSemanticOverloadMembershipRelation;

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
	readonly aliases: readonly RawSemanticAlias[];
	readonly assignments: readonly RawSemanticAssignment[];
	readonly astNodes: readonly RawSemanticAstNode[];
	readonly declarationCandidates: readonly RawSemanticDeclarationCandidate[];
	readonly declarations: readonly RawSemanticDeclaration[];
	readonly diagnosticFamilies: readonly RawSemanticDiagnosticFamilyCoverage[];
	readonly diagnostics: readonly RawSemanticDiagnosticOccurrence[];
	/** Prevents provisional capture projections from crossing normalization. */
	readonly evidenceState: RawCompilerSourceBinding['verificationState'];
	readonly invocations: readonly RawSemanticInvocation[];
	readonly literals: readonly RawSemanticLiteral[];
	readonly moduleExports: readonly RawSemanticModuleExport[];
	readonly moduleResolutions: readonly RawSemanticModuleResolution[];
	readonly overloadSets: readonly RawSemanticOverloadSet[];
	readonly project: RawSemanticProject;
	readonly references: readonly RawSemanticReference[];
	readonly scopes: readonly RawSemanticScope[];
	readonly signatureParameters: readonly RawSemanticSignatureParameter[];
	readonly signatures: readonly RawSemanticSignature[];
	readonly sources: readonly RawSemanticSource[];
	readonly symbols: readonly RawSemanticSymbol[];
	readonly typeParameters: readonly RawSemanticTypeParameter[];
	readonly typeRelations: readonly RawSemanticTypeRelation[];
	readonly types: readonly RawSemanticType[];
}
