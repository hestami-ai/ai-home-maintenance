import type {
	CompilerInputObservation,
	SemanticAssignabilityRequest,
	SemanticCapability,
	SemanticBudgets,
	SemanticContextInputId,
	SemanticAliasId,
	SemanticDeclarationId,
	SemanticDeclarationCandidateId,
	SemanticDurableDeclarationId,
	SemanticDeclarationCandidateRole,
	SemanticDiagnosticFamily,
	SemanticDiagnosticMessage,
	SemanticDiagnosticId,
	SemanticInvocationSiteId,
	SemanticModuleExportId,
	SemanticModuleOccurrenceKind,
	SemanticModuleSpecifierState,
	SemanticModuleResolutionId,
	SemanticOverloadSetId,
	SemanticAstStructuralRole,
	SemanticNodeId,
	SemanticProgramId,
	SemanticProvenanceId,
	SemanticFactProvenanceRecord,
	SemanticProjectId,
	SemanticReferenceId,
	SemanticReferenceRole,
	SemanticSnapshotId,
	SemanticScopeId,
	SemanticScopeDomain,
	SemanticScopeKind,
	SemanticSignatureId,
	SemanticSignatureKind,
	SemanticSignatureOwner,
	SemanticSignatureParameterId,
	SemanticSignatureRecord,
	SemanticSignatureSemanticKind,
	SemanticSourceId,
	SemanticSourceModuleKind,
	SemanticSymbolId,
	SemanticTypeId,
	SemanticTypeIdentityBasis,
	SemanticTypeParameterId,
	SemanticTypeParameterOwner,
	SemanticTypeRecord,
	SemanticTypeRelationId,
	SemanticTypeRelationRecord,
	SemanticProviderIdentity,
	SemanticRelatedDiagnostic
} from '../contracts/semantic.js';
import type { ProgramRecipe } from '../contracts/subject.js';
import { canonicalJson, sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from './canonical.js';
import {
	durableDeclarationIdentityPreimage,
	type DurableDeclarationIdentityInput
} from './durable-declaration-id.js';

const ID_ALGORITHM_VERSION = '1';

/**
 * Total order over strings that reproduces the default lexicographic (UTF-16 code unit)
 * ordering: -1 when `left` sorts first, 1 when `right` sorts first, 0 when equivalent.
 */
const compareStrings = (left: string, right: string): number =>
	Number(left > right) - Number(left < right);

function id<Kind extends string>(
	prefix: string,
	family: string,
	domain: string,
	preimage: unknown
): Kind {
	const preimageDigest = sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	);
	return `${prefix}:${family}-${preimageDigest}` as Kind;
}

export interface SemanticSnapshotIdentityInput {
	readonly assignabilityRequests: readonly SemanticAssignabilityRequest[];
	readonly astTraversalProfile: string;
	readonly budgets: SemanticBudgets;
	readonly canonicalProfile: string;
	readonly contextDigest: string;
	readonly expectedEmpty: boolean;
	readonly extractionVersion: string;
	readonly operationVersion: string;
	readonly projectRecipeDigests: readonly string[];
	readonly provider: SemanticProviderIdentity;
	readonly requestedCapabilities: readonly SemanticCapability[];
	readonly schemaVersion: string;
	readonly subjectId: string;
}

export interface SemanticProjectIdentityInput {
	readonly configPath: string;
	readonly projectResolutionDigest: string;
	readonly snapshotId: SemanticSnapshotId;
}
export interface SemanticProgramIdentityInput {
	readonly contextDigest: string;
	readonly projectId: SemanticProjectId;
}
export interface SemanticSourceIdentityInput {
	readonly contentSha256: string;
	readonly logicalPath: string;
	readonly moduleKind: SemanticSourceModuleKind;
	readonly programId: SemanticProgramId;
}
export interface SemanticNodeIdentityInput {
	readonly end: number;
	readonly fullStart: number;
	readonly kind: number;
	readonly parentId: SemanticNodeId | null;
	readonly siblingOrdinal: number;
	readonly sourceId: SemanticSourceId;
	readonly start: number;
	readonly structuralRoles: readonly SemanticAstStructuralRole[];
}
export interface SemanticDeclarationCandidateIdentityInput {
	readonly candidateRole: SemanticDeclarationCandidateRole;
	readonly nodeId: SemanticNodeId;
	readonly syntaxKind: number;
}
export interface SemanticScopeIdentityInput {
	readonly domain: SemanticScopeDomain;
	readonly end: number | null;
	readonly kind: SemanticScopeKind;
	readonly ownerKind: number | null;
	readonly programId: SemanticProgramId;
	readonly sourceId: SemanticSourceId | null;
	readonly start: number | null;
}
export interface SemanticDeclarationIdentityInput {
	readonly end: number;
	readonly kind: number;
	readonly nodeId: SemanticNodeId | null;
	readonly sourceId: SemanticSourceId;
	readonly start: number;
}
export interface SemanticSymbolIdentityInput {
	readonly declarationIds: readonly SemanticDeclarationId[];
	readonly fallbackReferenceNodeIds: readonly SemanticNodeId[];
	readonly flags: number;
	readonly identityBasis: 'DECLARATIONS' | 'REFERENCE_FALLBACK';
	readonly name: string;
	readonly programId: SemanticProgramId;
	readonly projectId: SemanticProjectId;
}
export interface SemanticAliasIdentityInput {
	readonly aliasSymbolId: SemanticSymbolId;
	readonly state: 'RESOLVED' | 'UNRESOLVED' | 'CIRCULAR' | 'UNSUPPORTED';
	readonly targetSymbolId: SemanticSymbolId | null;
	readonly terminalSymbolId: SemanticSymbolId | null;
}
export interface SemanticReferenceIdentityInput {
	readonly nodeId: SemanticNodeId;
	readonly resolvedSymbolId: SemanticSymbolId | null;
	readonly resolutionState: 'RESOLVED_DIRECT' | 'RESOLVED_ALIAS' | 'UNRESOLVED' | 'UNSUPPORTED';
	readonly role: SemanticReferenceRole;
	readonly symbolId: SemanticSymbolId | null;
}
export interface SemanticModuleResolutionIdentityInput {
	readonly moduleSymbolId: SemanticSymbolId | null;
	readonly nodeId: SemanticNodeId;
	readonly occurrenceKind: SemanticModuleOccurrenceKind;
	readonly resolutionState:
		'RESOLVED_SOURCE' | 'RESOLVED_AMBIENT' | 'RESOLVED_EXTERNAL' | 'UNRESOLVED' | 'UNSUPPORTED';
	readonly specifier: string | null;
	readonly specifierState: SemanticModuleSpecifierState;
	readonly targetSourceId: SemanticSourceId | null;
	readonly typeOnly: boolean;
}
export interface SemanticModuleExportIdentityInput {
	readonly exportName: string;
	readonly sourceId: SemanticSourceId;
	readonly state: 'DIRECT' | 'ALIAS' | 'REEXPORT' | 'UNRESOLVED';
	readonly symbolId: SemanticSymbolId;
	readonly targetSymbolId: SemanticSymbolId | null;
}
export interface SemanticTypeIdentityInput {
	readonly fingerprintProfile: SemanticTypeRecord['fingerprintProfile'];
	readonly fingerprintSha256: string;
	readonly identityBasis: SemanticTypeIdentityBasis;
	readonly programId: SemanticProgramId;
}
export interface SemanticTypeParameterIdentityInput {
	readonly declarationId: SemanticDeclarationId | null;
	readonly ordinal: number;
	readonly owner: SemanticTypeParameterOwner;
}
export type SemanticSignatureIdentityInput =
	| {
			readonly declarationId: SemanticDeclarationId;
			readonly identityBasis: 'DECLARATION_ANCHORED';
			readonly programId: SemanticProgramId;
			readonly semanticKind: SemanticSignatureSemanticKind;
			readonly signatureKind: SemanticSignatureKind;
	  }
	| {
			readonly fingerprintProfile: SemanticSignatureRecord['fingerprintProfile'];
			readonly fingerprintSha256: string;
			readonly identityBasis: 'OWNER_ORDINAL';
			readonly owner: SemanticSignatureOwner;
			readonly programId: SemanticProgramId;
			readonly providerOrdinal: number;
			readonly semanticKind: SemanticSignatureSemanticKind;
			readonly signatureKind: SemanticSignatureKind;
	  };
export interface SemanticSignatureParameterIdentityInput {
	readonly ordinal: number;
	readonly role: 'THIS' | 'PARAMETER';
	readonly signatureId: SemanticSignatureId;
}
export interface SemanticOverloadSetIdentityInput {
	readonly callableSymbolId: SemanticSymbolId;
	readonly programId: SemanticProgramId;
}
type WithoutTypeRelationRecordIdentity<Value> = Value extends unknown
	? Omit<Value, 'id' | 'provenanceId'>
	: never;
export type SemanticTypeRelationIdentityInput =
	WithoutTypeRelationRecordIdentity<SemanticTypeRelationRecord>;
export interface SemanticInvocationSiteIdentityInput {
	readonly invocationKind: 'CALL' | 'NEW' | 'TAGGED_TEMPLATE';
	readonly nodeId: SemanticNodeId;
}
export interface SemanticDiagnosticIdentityInput {
	readonly category: 'WARNING' | 'ERROR' | 'SUGGESTION' | 'MESSAGE';
	readonly code: string;
	readonly end: number | null;
	readonly family: SemanticDiagnosticFamily;
	readonly locationKind: 'NONE' | 'PATH' | 'SOURCE';
	readonly message: SemanticDiagnosticMessage;
	readonly path: string | null;
	readonly projectId: SemanticProjectId;
	readonly related: readonly SemanticRelatedDiagnostic[];
	readonly sourceId: SemanticSourceId | null;
	readonly start: number | null;
}
export type SemanticProvenanceIdentityInput = Omit<SemanticFactProvenanceRecord, 'id'>;
export type SemanticContextInputIdentityInput = Omit<CompilerInputObservation, 'id'> & {
	readonly subjectId: string;
};

export const semanticSnapshotId = (preimage: SemanticSnapshotIdentityInput): SemanticSnapshotId =>
	id<SemanticSnapshotId>('static', 'ts-snapshot', 'JAN-CSAA-TS-SNAPSHOT', {
		...preimage,
		assignabilityRequests: [...preimage.assignabilityRequests].sort((left, right) => {
			const requestOrder = compareStrings(left.requestId, right.requestId);
			if (requestOrder !== 0) return requestOrder;
			return compareStrings(canonicalSemanticJson(left), canonicalSemanticJson(right));
		})
	});
export const semanticProjectId = (preimage: SemanticProjectIdentityInput): SemanticProjectId =>
	id<SemanticProjectId>('semantic', 'project', 'JAN-CSAA-TS-PROJECT', preimage);
export const semanticProgramId = (preimage: SemanticProgramIdentityInput): SemanticProgramId =>
	id<SemanticProgramId>('semantic', 'program', 'JAN-CSAA-TS-PROGRAM', preimage);
export const semanticSourceId = (preimage: SemanticSourceIdentityInput): SemanticSourceId =>
	id<SemanticSourceId>('semantic', 'source', 'JAN-CSAA-TS-SOURCE', preimage);
export const semanticNodeId = (preimage: SemanticNodeIdentityInput): SemanticNodeId =>
	id<SemanticNodeId>('semantic', 'node', 'JAN-CSAA-TS-NODE', preimage);
export const semanticScopeId = (preimage: SemanticScopeIdentityInput): SemanticScopeId =>
	id<SemanticScopeId>('semantic', 'scope', 'JAN-CSAA-TS-SCOPE', preimage);
export const semanticDeclarationCandidateId = (
	preimage: SemanticDeclarationCandidateIdentityInput
): SemanticDeclarationCandidateId =>
	id<SemanticDeclarationCandidateId>(
		'semantic',
		'decl-candidate',
		'JAN-CSAA-TS-DECLARATION-CANDIDATE',
		preimage
	);
export const semanticDeclarationId = (
	preimage: SemanticDeclarationIdentityInput
): SemanticDeclarationId =>
	id<SemanticDeclarationId>('semantic', 'declaration', 'JAN-CSAA-TS-DECLARATION', preimage);
export const semanticDurableDeclarationId = (
	preimage: DurableDeclarationIdentityInput
): SemanticDurableDeclarationId =>
	id<SemanticDurableDeclarationId>(
		'semantic',
		'declaration-durable',
		'JAN-CSAA-TS-DECLARATION-DURABLE',
		durableDeclarationIdentityPreimage(preimage)
	);
export const semanticSymbolId = (preimage: SemanticSymbolIdentityInput): SemanticSymbolId => {
	const declarationIds = [...preimage.declarationIds].sort(compareStrings);
	const fallbackReferenceNodeIds = [...preimage.fallbackReferenceNodeIds].sort(compareStrings);
	if (
		new Set(declarationIds).size !== declarationIds.length ||
		new Set(fallbackReferenceNodeIds).size !== fallbackReferenceNodeIds.length
	)
		throw new TypeError('Semantic symbol identity inputs must be unique sets.');
	if (
		preimage.identityBasis === 'DECLARATIONS'
			? declarationIds.length === 0 || fallbackReferenceNodeIds.length !== 0
			: declarationIds.length !== 0 || fallbackReferenceNodeIds.length === 0
	)
		throw new TypeError('Semantic symbol identity basis and members disagree.');
	return id<SemanticSymbolId>('semantic', 'symbol', 'JAN-CSAA-TS-SYMBOL', {
		...preimage,
		declarationIds,
		fallbackReferenceNodeIds
	});
};
export const semanticAliasId = (preimage: SemanticAliasIdentityInput): SemanticAliasId =>
	id<SemanticAliasId>('semantic', 'alias', 'JAN-CSAA-TS-ALIAS', preimage);
export const semanticReferenceId = (
	preimage: SemanticReferenceIdentityInput
): SemanticReferenceId =>
	id<SemanticReferenceId>('semantic', 'reference', 'JAN-CSAA-TS-REFERENCE', preimage);
export const semanticModuleResolutionId = (
	preimage: SemanticModuleResolutionIdentityInput
): SemanticModuleResolutionId =>
	id<SemanticModuleResolutionId>(
		'semantic',
		'module-resolution',
		'JAN-CSAA-TS-MODULE-RESOLUTION',
		preimage
	);
export const semanticModuleExportId = (
	preimage: SemanticModuleExportIdentityInput
): SemanticModuleExportId =>
	id<SemanticModuleExportId>('semantic', 'module-export', 'JAN-CSAA-TS-MODULE-EXPORT', preimage);
export const semanticTypeId = (preimage: SemanticTypeIdentityInput): SemanticTypeId =>
	id<SemanticTypeId>('semantic', 'type', 'JAN-CSAA-TS-TYPE', preimage);
export const semanticTypeParameterId = (
	preimage: SemanticTypeParameterIdentityInput
): SemanticTypeParameterId =>
	id<SemanticTypeParameterId>('semantic', 'type-parameter', 'JAN-CSAA-TS-TYPE-PARAMETER', preimage);
export const semanticSignatureId = (
	preimage: SemanticSignatureIdentityInput
): SemanticSignatureId =>
	id<SemanticSignatureId>('semantic', 'signature', 'JAN-CSAA-TS-SIGNATURE', preimage);
export const semanticSignatureParameterId = (
	preimage: SemanticSignatureParameterIdentityInput
): SemanticSignatureParameterId =>
	id<SemanticSignatureParameterId>(
		'semantic',
		'signature-parameter',
		'JAN-CSAA-TS-SIGNATURE-PARAMETER',
		preimage
	);
export const semanticOverloadSetId = (
	preimage: SemanticOverloadSetIdentityInput
): SemanticOverloadSetId =>
	id<SemanticOverloadSetId>('semantic', 'overload-set', 'JAN-CSAA-TS-OVERLOAD-SET', preimage);
export const semanticTypeRelationId = (
	preimage: SemanticTypeRelationIdentityInput
): SemanticTypeRelationId =>
	id<SemanticTypeRelationId>('semantic', 'type-relation', 'JAN-CSAA-TS-TYPE-RELATION', preimage);
export const semanticInvocationSiteId = (
	preimage: SemanticInvocationSiteIdentityInput
): SemanticInvocationSiteId =>
	id<SemanticInvocationSiteId>('semantic', 'invocation', 'JAN-CSAA-TS-INVOCATION-SITE', preimage);
export const semanticDiagnosticId = (
	preimage: SemanticDiagnosticIdentityInput
): SemanticDiagnosticId =>
	id<SemanticDiagnosticId>('diagnostic', 'typescript', 'JAN-CSAA-TS-DIAGNOSTIC', {
		...preimage,
		related: [...preimage.related].sort((left, right) =>
			compareStrings(canonicalSemanticJson(left), canonicalSemanticJson(right))
		)
	});
export const semanticProvenanceId = (
	preimage: SemanticProvenanceIdentityInput
): SemanticProvenanceId =>
	id<SemanticProvenanceId>('analysis', 'provenance', 'JAN-CSAA-FACT-PROVENANCE', preimage);
export const semanticContextInputId = (
	preimage: SemanticContextInputIdentityInput
): SemanticContextInputId =>
	id<SemanticContextInputId>('analysis', 'context-input', 'JAN-CSAA-TS-CONTEXT', preimage);

export function programRecipeDigest(
	recipe: Omit<ProgramRecipe, 'projectResolutionDigest'>
): string {
	return sha256(canonicalJson(recipe));
}

export function compilerInputClosureDigest(
	observations: readonly CompilerInputObservation[]
): string {
	return sha256(
		canonicalSemanticJson(
			[...observations]
				.sort((left, right) => compareStrings(left.id, right.id))
				.map(({ id, ...observation }) => ({ id, ...observation }))
		)
	);
}

export function compilerInputResultDigest(
	observation: Omit<CompilerInputObservation, 'id' | 'resultDigest'>
): string {
	return sha256(canonicalSemanticJson(observation));
}

export function hasSemanticIdPrefix(value: string, prefix: string, family: string): boolean {
	return new RegExp(`^${prefix}:${family}-[a-f0-9]{64}$`, 'u').test(value);
}
