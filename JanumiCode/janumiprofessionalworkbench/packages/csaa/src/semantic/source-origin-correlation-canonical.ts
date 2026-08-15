import { createHash } from 'node:crypto';

import {
	SOURCE_ORIGIN_CORRELATION_CANONICAL_PROFILE,
	SOURCE_ORIGIN_CORRELATION_METHOD,
	SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION,
	SOURCE_ORIGIN_CORRELATION_SCHEMA_VERSION,
	type SourceOriginArtifactId,
	type SourceOriginAuthoredArtifactRecord,
	type SourceOriginCorrelationBuildInputs,
	type SourceOriginCorrelationId,
	type SourceOriginCorrelationRecordId,
	type SourceOriginCorrelationSnapshot,
	type SourceOriginDeclarationMapArtifactRecord,
	type SourceOriginEmissionId,
	type SourceOriginEmissionWitness,
	type SourceOriginExactCorrelationRecord,
	type SourceOriginLocationId,
	type SourceOriginLocationRecord,
	type SourceOriginMapSegmentId,
	type SourceOriginMapSegmentRecord,
	type SourceOriginMappingHealthId,
	type SourceOriginMappingHealthRecord,
	type SourceOriginProgramSourceIdentity,
	type SourceOriginSourceMapId,
	type SourceOriginSourceMapRecord,
	type SourceOriginTargetDeclarationArtifactRecord,
	type SourceOriginUnmappedGeneratedLineId,
	type SourceOriginUnmappedGeneratedLineRecord
} from '../contracts/source-origin-correlation.js';
import type { CompilerProjectProgramInputRecord } from './compiler-project-program-capability.js';
import { canonicalSemanticJsonPrefixedSha256 } from './canonical.js';

const ID_ALGORITHM_VERSION = '1';
const BYTE_HASH_CHUNK_SIZE = 64 * 1024;

function identity<Kind extends string>(
	prefix: string,
	domain: string,
	preimage: unknown,
	onProgress?: () => void
): Kind {
	return `${prefix}-${canonicalSemanticJsonPrefixedSha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0`,
		preimage,
		onProgress
	)}` as Kind;
}

function digest(domain: string, preimage: unknown, onProgress?: () => void): string {
	return canonicalSemanticJsonPrefixedSha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0`,
		preimage,
		onProgress
	);
}

function capturedBytesIdentity(
	bytes: Readonly<Uint8Array>,
	onProgress?: () => void
): { readonly contentBytes: number; readonly contentSha256: string } {
	onProgress?.();
	const hash = createHash('sha256');
	for (let offset = 0; offset < bytes.byteLength; offset += BYTE_HASH_CHUNK_SIZE) {
		onProgress?.();
		hash.update((bytes as Uint8Array).subarray(offset, offset + BYTE_HASH_CHUNK_SIZE));
	}
	onProgress?.();
	return { contentBytes: bytes.byteLength, contentSha256: hash.digest('hex') };
}

/**
 * Binds the exact request, compact FrozenSubject and semantic-snapshot identities, and the actual
 * caller-captured declaration and declaration-map bytes. No compiler-native object is hash input.
 */
export function sourceOriginCorrelationInputDigest(
	inputs: SourceOriginCorrelationBuildInputs,
	onProgress?: () => void
): string {
	const targetDeclarationCapture = capturedBytesIdentity(inputs.targetDeclarationBytes, onProgress);
	const declarationMapCapture = capturedBytesIdentity(inputs.declarationMapBytes, onProgress);
	return digest(
		'JAN-CSAA-SOURCE-ORIGIN-CORRELATION-INPUT',
		{
			callerCaptures: {
				declarationMap: declarationMapCapture,
				targetDeclaration: targetDeclarationCapture
			},
			frozenSubject: {
				fileManifestDigest: inputs.frozenSubject.descriptor.fileManifestDigest,
				operationVersion: inputs.frozenSubject.descriptor.operationVersion,
				policyVersion: inputs.frozenSubject.descriptor.policyVersion,
				schemaVersion: inputs.frozenSubject.descriptor.schemaVersion,
				subjectId: inputs.frozenSubject.descriptor.subjectId,
				subjectKind: inputs.frozenSubject.descriptor.subjectKind
			},
			request: inputs.request,
			semanticSnapshot: {
				canonicalProfile: inputs.semanticSnapshot.canonicalProfile,
				contextDigest: inputs.semanticSnapshot.contextDigest,
				extractionVersion: inputs.semanticSnapshot.extractionVersion,
				id: inputs.semanticSnapshot.id,
				operationVersion: inputs.semanticSnapshot.operationVersion,
				provider: inputs.semanticSnapshot.provider,
				schemaVersion: inputs.semanticSnapshot.schemaVersion,
				subjectId: inputs.semanticSnapshot.subjectId
			}
		},
		onProgress
	);
}

export function sourceOriginCorrelationId(
	input: {
		readonly inputDigest: string;
		readonly semanticProgramId: string;
		readonly semanticProjectId: string;
		readonly semanticSnapshotId: string;
		readonly semanticSourceId: string;
		readonly subjectId: string;
	},
	onProgress?: () => void
): SourceOriginCorrelationId {
	return identity<SourceOriginCorrelationId>(
		'source-origin-correlation',
		'JAN-CSAA-SOURCE-ORIGIN-CORRELATION',
		{
			canonicalProfile: SOURCE_ORIGIN_CORRELATION_CANONICAL_PROFILE,
			inputDigest: input.inputDigest,
			method: SOURCE_ORIGIN_CORRELATION_METHOD,
			operationVersion: SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION,
			schemaVersion: SOURCE_ORIGIN_CORRELATION_SCHEMA_VERSION,
			semanticProgramId: input.semanticProgramId,
			semanticProjectId: input.semanticProjectId,
			semanticSnapshotId: input.semanticSnapshotId,
			semanticSourceId: input.semanticSourceId,
			subjectId: input.subjectId
		},
		onProgress
	);
}

export type SourceOriginArtifactRecordWithoutId =
	| Omit<SourceOriginTargetDeclarationArtifactRecord, 'id'>
	| Omit<SourceOriginDeclarationMapArtifactRecord, 'id'>
	| Omit<SourceOriginAuthoredArtifactRecord, 'id'>;

export function sourceOriginArtifactId(
	analysisId: SourceOriginCorrelationId,
	record: SourceOriginArtifactRecordWithoutId,
	onProgress?: () => void
): SourceOriginArtifactId {
	return identity<SourceOriginArtifactId>(
		'source-origin-artifact',
		'JAN-CSAA-SOURCE-ORIGIN-ARTIFACT',
		{ analysisId, ...record },
		onProgress
	);
}

export function sourceOriginEmissionId(
	analysisId: SourceOriginCorrelationId,
	record: Omit<SourceOriginEmissionWitness, 'id'>,
	onProgress?: () => void
): SourceOriginEmissionId {
	return identity<SourceOriginEmissionId>(
		'source-origin-emission',
		'JAN-CSAA-SOURCE-ORIGIN-EMISSION',
		{ analysisId, ...record },
		onProgress
	);
}

/** Child IDs are excluded so map identity can be established before its child populations. */
export type SourceOriginSourceMapIdentityRecord = Omit<
	SourceOriginSourceMapRecord,
	'id' | 'segmentIds' | 'unmappedGeneratedLineIds'
>;

export function sourceOriginSourceMapId(
	analysisId: SourceOriginCorrelationId,
	record: SourceOriginSourceMapIdentityRecord,
	onProgress?: () => void
): SourceOriginSourceMapId {
	return identity<SourceOriginSourceMapId>(
		'source-origin-source-map',
		'JAN-CSAA-SOURCE-ORIGIN-SOURCE-MAP',
		{ analysisId, ...record },
		onProgress
	);
}

export function sourceOriginMappingHealthId(
	analysisId: SourceOriginCorrelationId,
	record: Omit<SourceOriginMappingHealthRecord, 'id'>,
	onProgress?: () => void
): SourceOriginMappingHealthId {
	return identity<SourceOriginMappingHealthId>(
		'source-origin-mapping-health',
		'JAN-CSAA-SOURCE-ORIGIN-MAPPING-HEALTH',
		{ analysisId, ...record },
		onProgress
	);
}

export function sourceOriginMapSegmentId(
	analysisId: SourceOriginCorrelationId,
	record: Omit<SourceOriginMapSegmentRecord, 'id'>,
	onProgress?: () => void
): SourceOriginMapSegmentId {
	return identity<SourceOriginMapSegmentId>(
		'source-origin-map-segment',
		'JAN-CSAA-SOURCE-ORIGIN-MAP-SEGMENT',
		{ analysisId, ...record },
		onProgress
	);
}

export function sourceOriginLocationId(
	analysisId: SourceOriginCorrelationId,
	record: Omit<SourceOriginLocationRecord, 'id'>,
	onProgress?: () => void
): SourceOriginLocationId {
	return identity<SourceOriginLocationId>(
		'source-origin-location',
		'JAN-CSAA-SOURCE-ORIGIN-LOCATION',
		{ analysisId, ...record },
		onProgress
	);
}

export function sourceOriginExactCorrelationId(
	analysisId: SourceOriginCorrelationId,
	record: Omit<SourceOriginExactCorrelationRecord, 'id'>,
	onProgress?: () => void
): SourceOriginCorrelationRecordId {
	return identity<SourceOriginCorrelationRecordId>(
		'source-origin-correlation-record',
		'JAN-CSAA-SOURCE-ORIGIN-CORRELATION-RECORD',
		{ analysisId, ...record },
		onProgress
	);
}

export function sourceOriginUnmappedGeneratedLineId(
	analysisId: SourceOriginCorrelationId,
	record: Omit<SourceOriginUnmappedGeneratedLineRecord, 'id'>,
	onProgress?: () => void
): SourceOriginUnmappedGeneratedLineId {
	return identity<SourceOriginUnmappedGeneratedLineId>(
		'source-origin-unmapped-generated-line',
		'JAN-CSAA-SOURCE-ORIGIN-UNMAPPED-GENERATED-LINE',
		{ analysisId, ...record },
		onProgress
	);
}

/**
 * The caller supplies this population in its already-canonical fieldwise order. The function
 * hashes that order directly and deliberately performs no population copy or sort.
 */
export function sourceOriginProgramSourcePopulationDigest(
	sources: readonly SourceOriginProgramSourceIdentity[],
	onProgress?: () => void
): string {
	return digest('JAN-CSAA-SOURCE-ORIGIN-PROGRAM-SOURCE-POPULATION', sources, onProgress);
}

/**
 * Compact witness for the exact callback stream. Records remain private operational evidence;
 * their contiguous ordinal order is hashed directly without materializing an output population.
 */
export function sourceOriginProgramInputAttemptPopulationDigest(
	attempts: readonly CompilerProjectProgramInputRecord[],
	onProgress?: () => void
): string {
	return digest('JAN-CSAA-SOURCE-ORIGIN-PROGRAM-INPUT-ATTEMPT-POPULATION', attempts, onProgress);
}

export type SourceOriginCorrelationContent = Omit<SourceOriginCorrelationSnapshot, 'contentDigest'>;

export function sourceOriginCorrelationContentDigest(
	analysis: SourceOriginCorrelationSnapshot | SourceOriginCorrelationContent,
	onProgress?: () => void
): string {
	const { contentDigest: _contentDigest, ...content } = analysis as SourceOriginCorrelationSnapshot;
	return digest('JAN-CSAA-SOURCE-ORIGIN-CORRELATION-CONTENT', content, onProgress);
}
