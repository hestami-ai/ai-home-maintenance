import type {
	CompilerInputObservation,
	SemanticCapability,
	SemanticBudgets,
	SemanticContextInputId,
	SemanticDeclarationCandidateId,
	SemanticDeclarationCandidateRole,
	SemanticDiagnosticFamily,
	SemanticDiagnosticMessage,
	SemanticDiagnosticId,
	SemanticInvocationSiteId,
	SemanticAstStructuralRole,
	SemanticNodeId,
	SemanticProgramId,
	SemanticProvenanceId,
	SemanticFactProvenanceRecord,
	SemanticProjectId,
	SemanticSnapshotId,
	SemanticSourceId,
	SemanticProviderIdentity,
	SemanticRelatedDiagnostic
} from '../contracts/semantic.js';
import type { ProgramRecipe } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalJson } from '../inventory/canonical.js';
import { canonicalSemanticJson } from './canonical.js';

const ID_ALGORITHM_VERSION = '1';

function id<Kind extends string>(prefix: string, family: string, domain: string, preimage: unknown): Kind {
	return `${prefix}:${family}-${sha256(`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`)}` as Kind;
}

export interface SemanticSnapshotIdentityInput {
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

export interface SemanticProjectIdentityInput { readonly configPath: string; readonly projectResolutionDigest: string; readonly snapshotId: SemanticSnapshotId }
export interface SemanticProgramIdentityInput { readonly contextDigest: string; readonly projectId: SemanticProjectId }
export interface SemanticSourceIdentityInput { readonly contentSha256: string; readonly logicalPath: string; readonly programId: SemanticProgramId }
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
export type SemanticContextInputIdentityInput = Omit<CompilerInputObservation, 'id'> & { readonly subjectId: string };

export const semanticSnapshotId = (preimage: SemanticSnapshotIdentityInput): SemanticSnapshotId => id<SemanticSnapshotId>('static', 'ts-snapshot', 'JAN-CSAA-TS-SNAPSHOT', preimage);
export const semanticProjectId = (preimage: SemanticProjectIdentityInput): SemanticProjectId => id<SemanticProjectId>('semantic', 'project', 'JAN-CSAA-TS-PROJECT', preimage);
export const semanticProgramId = (preimage: SemanticProgramIdentityInput): SemanticProgramId => id<SemanticProgramId>('semantic', 'program', 'JAN-CSAA-TS-PROGRAM', preimage);
export const semanticSourceId = (preimage: SemanticSourceIdentityInput): SemanticSourceId => id<SemanticSourceId>('semantic', 'source', 'JAN-CSAA-TS-SOURCE', preimage);
export const semanticNodeId = (preimage: SemanticNodeIdentityInput): SemanticNodeId => id<SemanticNodeId>('semantic', 'node', 'JAN-CSAA-TS-NODE', preimage);
export const semanticDeclarationCandidateId = (preimage: SemanticDeclarationCandidateIdentityInput): SemanticDeclarationCandidateId => id<SemanticDeclarationCandidateId>('semantic', 'decl-candidate', 'JAN-CSAA-TS-DECLARATION-CANDIDATE', preimage);
export const semanticInvocationSiteId = (preimage: SemanticInvocationSiteIdentityInput): SemanticInvocationSiteId => id<SemanticInvocationSiteId>('semantic', 'invocation', 'JAN-CSAA-TS-INVOCATION-SITE', preimage);
export const semanticDiagnosticId = (preimage: SemanticDiagnosticIdentityInput): SemanticDiagnosticId => id<SemanticDiagnosticId>(
	'diagnostic',
	'typescript',
	'JAN-CSAA-TS-DIAGNOSTIC',
	{
		...preimage,
		related: [...preimage.related].sort((left, right) => {
			const leftCanonical = canonicalSemanticJson(left);
			const rightCanonical = canonicalSemanticJson(right);
			return leftCanonical < rightCanonical ? -1 : leftCanonical > rightCanonical ? 1 : 0;
		})
	}
);
export const semanticProvenanceId = (preimage: SemanticProvenanceIdentityInput): SemanticProvenanceId => id<SemanticProvenanceId>('analysis', 'provenance', 'JAN-CSAA-FACT-PROVENANCE', preimage);
export const semanticContextInputId = (preimage: SemanticContextInputIdentityInput): SemanticContextInputId => id<SemanticContextInputId>('analysis', 'context-input', 'JAN-CSAA-TS-CONTEXT', preimage);

export function programRecipeDigest(recipe: Omit<ProgramRecipe, 'projectResolutionDigest'>): string {
	return sha256(canonicalJson(recipe));
}

export function compilerInputClosureDigest(observations: readonly CompilerInputObservation[]): string {
	return sha256(canonicalSemanticJson([...observations]
		.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
		.map(({ id, ...observation }) => ({ id, ...observation }))));
}

export function compilerInputResultDigest(observation: Omit<CompilerInputObservation, 'id' | 'resultDigest'>): string {
	return sha256(canonicalSemanticJson(observation));
}

export function hasSemanticIdPrefix(value: string, prefix: string, family: string): boolean {
	return new RegExp(`^${prefix}:${family}-[a-f0-9]{64}$`, 'u').test(value);
}
