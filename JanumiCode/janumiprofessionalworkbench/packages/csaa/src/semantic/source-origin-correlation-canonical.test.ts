import { describe, expect, it } from 'vitest';

import {
	SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION,
	SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION,
	SOURCE_ORIGIN_CORRELATION_SELECTION,
	type SourceOriginCorrelationBuildInputs,
	type SourceOriginCorrelationSnapshot,
	type SourceOriginEmissionWitness,
	type SourceOriginExactCorrelationRecord,
	type SourceOriginLocationRecord,
	type SourceOriginMapSegmentRecord,
	type SourceOriginMappingHealthRecord,
	type SourceOriginProgramSourceIdentity,
	type SourceOriginUnmappedGeneratedLineRecord
} from '../contracts/source-origin-correlation.js';
import type { FrozenSubject } from '../contracts/subject.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { CompilerProjectProgramInputRecord } from './compiler-project-program-capability.js';
import {
	sourceOriginArtifactId,
	sourceOriginCorrelationContentDigest,
	sourceOriginCorrelationId,
	sourceOriginCorrelationInputDigest,
	sourceOriginEmissionId,
	sourceOriginExactCorrelationId,
	sourceOriginLocationId,
	sourceOriginMapSegmentId,
	sourceOriginMappingHealthId,
	sourceOriginProgramInputAttemptPopulationDigest,
	sourceOriginProgramSourcePopulationDigest,
	sourceOriginSourceMapId,
	sourceOriginUnmappedGeneratedLineId,
	type SourceOriginArtifactRecordWithoutId,
	type SourceOriginSourceMapIdentityRecord
} from './source-origin-correlation-canonical.js';

function buildInputs(): SourceOriginCorrelationBuildInputs {
	const request = {
		budgets: {
			maxCallerCaptureBytes: 1_000,
			maxCompilerInputAttempts: 1_000,
			maxCorrelations: 1_000,
			maxDecodedMapLines: 1_000,
			maxDecodedMapSegments: 1_000,
			maxDiagnostics: 100,
			maxDurationMs: 10_000,
			maxEmitBytes: 1_000,
			maxEmitOutputs: 2,
			maxEmitStringCharacters: 1_000,
			maxInputRecords: 10_000,
			maxInputStringCharacters: 1_000_000,
			maxLocations: 2_000,
			maxMappingsCharacters: 1_000,
			maxOutputRecords: 10_000,
			maxPathCharacters: 1_000,
			maxProgramReadBytes: 1_000_000,
			maxProgramSourceFiles: 100,
			maxReadBytes: 1_001_000,
			maxSourceMapJsonDepth: 16,
			maxSourceMapJsonRecords: 100,
			maxSourceTextCodeUnits: 10_000,
			maxTraversalSteps: 100_000,
			maxUnmappedGeneratedLines: 10
		},
		declarationMap: {
			contentBytes: 4,
			contentSha256: 'map-request-sha',
			logicalPath: 'packages/example/dist/index.d.ts.map'
		},
		operationVersion: SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION,
		schemaVersion: SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION,
		selection: SOURCE_ORIGIN_CORRELATION_SELECTION,
		semanticProgramId: 'semantic-program-1',
		semanticProjectId: 'semantic-project-1',
		semanticSnapshotId: 'semantic-snapshot-1',
		semanticSourceId: 'semantic-source-1',
		subjectId: 'subject-1',
		targetDeclaration: {
			contentBytes: 4,
			contentSha256: 'target-request-sha',
			logicalPath: 'packages/example/dist/index.d.ts'
		}
	} as SourceOriginCorrelationBuildInputs['request'];
	const frozenSubject = {
		descriptor: {
			fileManifestDigest: 'manifest-1',
			operationVersion: 'subject-operation-1',
			policyVersion: 'subject-policy-1',
			schemaVersion: 'subject-schema-1',
			subjectId: 'subject-1',
			subjectKind: 'WORKTREE'
		}
	} as unknown as FrozenSubject;
	const semanticSnapshot = {
		canonicalProfile: 'semantic-canonical-1',
		contextDigest: 'semantic-context-1',
		extractionVersion: 'semantic-extraction-1',
		id: 'semantic-snapshot-1',
		operationVersion: 'semantic-operation-1',
		provider: { id: 'typescript', version: '5.9.3' },
		schemaVersion: 'semantic-schema-1',
		subjectId: 'subject-1'
	} as unknown as StaticSemanticSnapshot;
	return {
		declarationMapBytes: Uint8Array.from([5, 6, 7, 8]),
		frozenSubject,
		request,
		semanticSnapshot,
		targetDeclarationBytes: Uint8Array.from([1, 2, 3, 4])
	};
}

function analysisId() {
	return sourceOriginCorrelationId({
		inputDigest: 'input-digest-1',
		semanticProgramId: 'semantic-program-1',
		semanticProjectId: 'semantic-project-1',
		semanticSnapshotId: 'semantic-snapshot-1',
		semanticSourceId: 'semantic-source-1',
		subjectId: 'subject-1'
	});
}

describe('source-origin correlation canonical identities', () => {
	it('binds request, compact carriers, and actual caller capture bytes with progress', () => {
		const inputs = buildInputs();
		let progress = 0;
		const first = sourceOriginCorrelationInputDigest(inputs, () => {
			progress += 1;
		});
		const equivalent = sourceOriginCorrelationInputDigest({
			...inputs,
			declarationMapBytes: Uint8Array.from(inputs.declarationMapBytes),
			targetDeclarationBytes: Uint8Array.from(inputs.targetDeclarationBytes)
		});
		expect(first).toMatch(/^[a-f0-9]{64}$/u);
		expect(equivalent).toBe(first);
		expect(progress).toBeGreaterThan(0);

		const changedTarget = Uint8Array.from(inputs.targetDeclarationBytes);
		changedTarget[0] = 9;
		expect(
			sourceOriginCorrelationInputDigest({ ...inputs, targetDeclarationBytes: changedTarget })
		).not.toBe(first);
		expect(
			sourceOriginCorrelationInputDigest({
				...inputs,
				request: {
					...inputs.request,
					targetDeclaration: {
						...inputs.request.targetDeclaration,
						contentSha256: 'different-request-sha'
					}
				}
			})
		).not.toBe(first);
	});

	it('uses separate stable domains for every public CAP-014 record identity', () => {
		const parent = analysisId();
		let progress = 0;
		const artifactRecord = {
			artifactClass: 'GENERATED_DECLARATION',
			bytes: 10,
			captureDescriptorReconciliation: 'EXACT_LOGICAL_PATH_LENGTH_AND_SHA256',
			captureMethod: 'CALLER_SUPPLIED_IMMUTABLE_BYTE_COPY',
			contentSha256: 'target-sha',
			declarationFile: true,
			emissionReconciliation: 'EXACT_BYTE_EQUAL',
			logicalPath: 'packages/example/dist/index.d.ts',
			ordinal: 0,
			origin: 'GENERATED_DECLARATION',
			role: 'TARGET_DECLARATION'
		} as const satisfies SourceOriginArtifactRecordWithoutId;
		const artifact = sourceOriginArtifactId(parent, artifactRecord, () => {
			progress += 1;
		});
		const map = sourceOriginSourceMapId(parent, {
			decodedLines: 1,
			decodedSegments: 1,
			file: 'index.d.ts',
			format: 'SOURCE_MAP_V3',
			mapArtifactId: 'artifact-map',
			mappingEncoding: 'BASE64_VLQ',
			mappingsCharacters: 4,
			mappingsSha256: 'mappings-sha',
			names: [],
			ordinal: 0,
			rawSources: ['../src/index.ts'],
			resolvedSourceArtifactIds: ['artifact-source'],
			sourceRoot: '',
			sourcesContent: 'ABSENT',
			targetArtifactId: artifact,
			version: 3
		} as unknown as SourceOriginSourceMapIdentityRecord);
		const health = sourceOriginMappingHealthId(parent, {
			ordinal: 0,
			state: 'EXACT'
		} as Omit<SourceOriginMappingHealthRecord, 'id'>);
		const segment = sourceOriginMapSegmentId(parent, {
			ordinal: 0,
			mapId: map,
			state: 'MAPPED'
		} as Omit<SourceOriginMapSegmentRecord, 'id'>);
		const generated = sourceOriginLocationId(parent, {
			ordinal: 0,
			role: 'GENERATED_TARGET',
			segmentId: segment
		} as Omit<SourceOriginLocationRecord, 'id'>);
		const authored = sourceOriginLocationId(parent, {
			ordinal: 1,
			role: 'AUTHORED_ORIGIN',
			segmentId: segment
		} as Omit<SourceOriginLocationRecord, 'id'>);
		const correlation = sourceOriginExactCorrelationId(parent, {
			authoredLocationId: authored,
			generatedLocationId: generated,
			mapId: map,
			mappingHealthId: health,
			ordinal: 0,
			segmentId: segment
		} as Omit<SourceOriginExactCorrelationRecord, 'id'>);
		const unmapped = sourceOriginUnmappedGeneratedLineId(parent, {
			line: 1,
			mapId: map,
			ordinal: 0,
			targetArtifactId: artifact
		} as Omit<SourceOriginUnmappedGeneratedLineRecord, 'id'>);
		const emissionRecord = {
			declarationEmitCallbacksUseOnlyAttributedQueries: true,
			declarationEmitCompilerInputAttempts: 2,
			declarationEmitReadBytes: 20,
			ordinal: 0
		} as unknown as Omit<SourceOriginEmissionWitness, 'id'>;
		const emission = sourceOriginEmissionId(parent, emissionRecord);

		expect(artifact).toMatch(/^source-origin-artifact-[a-f0-9]{64}$/u);
		expect(map).toMatch(/^source-origin-source-map-[a-f0-9]{64}$/u);
		expect(health).toMatch(/^source-origin-mapping-health-[a-f0-9]{64}$/u);
		expect(segment).toMatch(/^source-origin-map-segment-[a-f0-9]{64}$/u);
		expect(generated).toMatch(/^source-origin-location-[a-f0-9]{64}$/u);
		expect(correlation).toMatch(/^source-origin-correlation-record-[a-f0-9]{64}$/u);
		expect(unmapped).toMatch(/^source-origin-unmapped-generated-line-[a-f0-9]{64}$/u);
		expect(emission).toMatch(/^source-origin-emission-[a-f0-9]{64}$/u);
		expect(
			new Set([
				artifact,
				map,
				health,
				segment,
				generated,
				authored,
				correlation,
				unmapped,
				emission
			])
		).toHaveLength(9);
		expect(progress).toBeGreaterThan(0);
		expect(sourceOriginArtifactId(parent, artifactRecord)).toBe(artifact);
		expect(sourceOriginArtifactId(parent, { ...artifactRecord, bytes: 11 })).not.toBe(artifact);
		expect(
			sourceOriginEmissionId(parent, {
				...emissionRecord,
				declarationEmitCompilerInputAttempts: 3
			})
		).not.toBe(emission);
	});

	it('hashes program populations in caller-supplied canonical order without mutation', () => {
		const sources = Object.freeze([
			Object.freeze({
				bytes: 10,
				contentSha256: 'a-sha',
				declarationFile: false,
				logicalPath: 'packages/example/src/a.ts',
				origin: 'AUTHORED',
				semanticSourceId: 'source-a'
			}),
			Object.freeze({
				bytes: 20,
				contentSha256: 'b-sha',
				declarationFile: false,
				logicalPath: 'packages/example/src/b.ts',
				origin: 'AUTHORED',
				semanticSourceId: 'source-b'
			})
		] as const) as unknown as readonly SourceOriginProgramSourceIdentity[];
		const attempt = Object.freeze({
			attributedInvocationCount: 1,
			invocationOrdinal: 1,
			observation: Object.freeze({
				id: 'context-input-1',
				invocationCount: 1,
				logicalPath: '.',
				operation: 'CURRENT_DIRECTORY',
				origin: 'CONFIGURATION',
				resolvedLogicalPath: '.',
				result: 'RESOLVED',
				resultDigest: 'result-1'
			}),
			ordinal: 0,
			query: Object.freeze({ logicalPath: '.', operation: 'CURRENT_DIRECTORY' }),
			stage: 'PROGRAM_CONSTRUCTION'
		}) as CompilerProjectProgramInputRecord;
		const attempts = Object.freeze([attempt]);
		let progress = 0;
		const sourceDigest = sourceOriginProgramSourcePopulationDigest(sources, () => {
			progress += 1;
		});
		const attemptDigest = sourceOriginProgramInputAttemptPopulationDigest(attempts, () => {
			progress += 1;
		});
		expect(sourceDigest).toMatch(/^[a-f0-9]{64}$/u);
		expect(attemptDigest).toMatch(/^[a-f0-9]{64}$/u);
		expect(sourceOriginProgramSourcePopulationDigest([...sources].reverse())).not.toBe(
			sourceDigest
		);
		expect(
			sourceOriginProgramInputAttemptPopulationDigest([{ ...attempt, invocationOrdinal: 2 }])
		).not.toBe(attemptDigest);
		expect(sources[0]?.logicalPath).toBe('packages/example/src/a.ts');
		expect(attempts[0]?.ordinal).toBe(0);
		expect(progress).toBeGreaterThan(0);
	});

	it('excludes only contentDigest from the final content identity', () => {
		const analysis = {
			contentDigest: 'placeholder-a',
			id: analysisId(),
			subjectId: 'subject-1'
		} as SourceOriginCorrelationSnapshot;
		const first = sourceOriginCorrelationContentDigest(analysis);
		expect(
			sourceOriginCorrelationContentDigest({ ...analysis, contentDigest: 'placeholder-b' })
		).toBe(first);
		expect(sourceOriginCorrelationContentDigest({ ...analysis, subjectId: 'subject-2' })).not.toBe(
			first
		);
	});
});
