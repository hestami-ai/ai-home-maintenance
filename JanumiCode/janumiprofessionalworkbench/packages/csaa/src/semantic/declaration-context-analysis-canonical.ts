import {
	DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE,
	DECLARATION_CONTEXT_ANALYSIS_METHOD,
	DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
	DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION,
	type DeclarationContextAnalysisBuildInputs,
	type DeclarationContextAnalysisId,
	type DeclarationContextAnalysisSnapshot,
	type DeclarationContextArtifactId,
	type DeclarationContextArtifactRecord,
	type DeclarationContextDeclarationId,
	type DeclarationContextDeclarationRecord,
	type DeclarationContextExportBindingId,
	type DeclarationContextExportBindingRecord,
	type DeclarationContextMergeId,
	type DeclarationContextMergeRecord,
	type DeclarationContextParseWitnessId,
	type DeclarationContextParseWitnessRecord,
	type DeclarationContextProgramInputAttemptId,
	type DeclarationContextProgramInputAttemptRecord,
	type DeclarationContextProgramSourceIdentity,
	type DeclarationContextRelationId,
	type DeclarationContextRelationRecordWithoutId,
	type DeclarationContextTerminalSymbolId,
	type DeclarationContextTerminalSymbolRecord
} from '../contracts/declaration-context-analysis.js';
import {
	canonicalSemanticJsonPrefixedSha256,
	compareCanonicalSemanticJsonStrings
} from './canonical.js';

const ID_ALGORITHM_VERSION = '1';

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

/**
 * Binds the exact request, predecessor requests, compact validated predecessor
 * results, FrozenSubject identity, and CAP-001 carrier identity. Complete
 * predecessor populations are validated separately and represented by their
 * contract-owned IDs and content digests; no compiler-native object is hashed.
 */
export function declarationContextAnalysisInputDigest(
	inputs: DeclarationContextAnalysisBuildInputs,
	onProgress?: () => void
): string {
	return digest(
		'JAN-CSAA-DECLARATION-CONTEXT-ANALYSIS-INPUT',
		{
			conditionalExportRequest: inputs.conditionalExportRequest,
			conditionalExportResolution: {
				canonicalProfile: inputs.conditionalExportResolution.canonicalProfile,
				contentDigest: inputs.conditionalExportResolution.contentDigest,
				decision: inputs.conditionalExportResolution.decision,
				id: inputs.conditionalExportResolution.id,
				inputDigest: inputs.conditionalExportResolution.inputDigest,
				manifestWitness: inputs.conditionalExportResolution.manifestWitness,
				method: inputs.conditionalExportResolution.method,
				operationVersion: inputs.conditionalExportResolution.operationVersion,
				requestReference: inputs.request.conditionalExportResolution,
				schemaVersion: inputs.conditionalExportResolution.schemaVersion,
				semanticSnapshotId: inputs.conditionalExportResolution.semanticSnapshotId,
				subjectId: inputs.conditionalExportResolution.subjectId
			},
			frozenSubject: {
				fileManifestDigest: inputs.frozenSubject.descriptor.fileManifestDigest,
				operationVersion: inputs.frozenSubject.descriptor.operationVersion,
				policyVersion: inputs.frozenSubject.descriptor.policyVersion,
				schemaVersion: inputs.frozenSubject.descriptor.schemaVersion,
				subjectId: inputs.frozenSubject.descriptor.subjectId,
				subjectKind: inputs.frozenSubject.descriptor.subjectKind
			},
			moduleResolutionRequest: inputs.moduleResolutionRequest,
			moduleResolutionTrace: {
				canonicalProfile: inputs.moduleResolutionTrace.canonicalProfile,
				captureWitness: inputs.moduleResolutionTrace.captureWitness,
				contentDigest: inputs.moduleResolutionTrace.contentDigest,
				id: inputs.moduleResolutionTrace.id,
				importerWitness: inputs.moduleResolutionTrace.importerWitness,
				inputDigest: inputs.moduleResolutionTrace.inputDigest,
				method: inputs.moduleResolutionTrace.method,
				operationVersion: inputs.moduleResolutionTrace.operationVersion,
				requestReference: inputs.request.moduleResolutionTrace,
				resolverEnvironment: inputs.moduleResolutionTrace.resolverEnvironment,
				schemaVersion: inputs.moduleResolutionTrace.schemaVersion,
				semanticSnapshotId: inputs.moduleResolutionTrace.semanticSnapshotId,
				subjectId: inputs.moduleResolutionTrace.subjectId,
				targetWitness: inputs.moduleResolutionTrace.targetWitness
			},
			projectContextGraph: {
				canonicalProfile: inputs.projectContextGraph.canonicalProfile,
				contentDigest: inputs.projectContextGraph.contentDigest,
				id: inputs.projectContextGraph.id,
				inputDigest: inputs.projectContextGraph.inputDigest,
				method: inputs.projectContextGraph.method,
				operationVersion: inputs.projectContextGraph.operationVersion,
				requestReference: inputs.request.projectContextGraph,
				schemaVersion: inputs.projectContextGraph.schemaVersion,
				semanticSnapshotId: inputs.projectContextGraph.semanticSnapshotId,
				subjectId: inputs.projectContextGraph.subjectId
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

export function declarationContextAnalysisId(
	input: {
		readonly conditionalExportResolutionId: string;
		readonly inputDigest: string;
		readonly moduleResolutionTraceId: string;
		readonly semanticSnapshotId: string;
		readonly subjectId: string;
	},
	onProgress?: () => void
): DeclarationContextAnalysisId {
	return identity<DeclarationContextAnalysisId>(
		'declaration-context-analysis',
		'JAN-CSAA-DECLARATION-CONTEXT-ANALYSIS',
		{
			canonicalProfile: DECLARATION_CONTEXT_ANALYSIS_CANONICAL_PROFILE,
			conditionalExportResolutionId: input.conditionalExportResolutionId,
			inputDigest: input.inputDigest,
			method: DECLARATION_CONTEXT_ANALYSIS_METHOD,
			moduleResolutionTraceId: input.moduleResolutionTraceId,
			operationVersion: DECLARATION_CONTEXT_ANALYSIS_OPERATION_VERSION,
			schemaVersion: DECLARATION_CONTEXT_ANALYSIS_SCHEMA_VERSION,
			semanticSnapshotId: input.semanticSnapshotId,
			subjectId: input.subjectId
		},
		onProgress
	);
}

export function declarationContextProgramInputAttemptId(
	analysisId: DeclarationContextAnalysisId,
	record: Omit<DeclarationContextProgramInputAttemptRecord, 'id'>,
	onProgress?: () => void
): DeclarationContextProgramInputAttemptId {
	return identity<DeclarationContextProgramInputAttemptId>(
		'declaration-context-program-input-attempt',
		'JAN-CSAA-DECLARATION-CONTEXT-PROGRAM-INPUT-ATTEMPT',
		{ analysisId, ...record },
		onProgress
	);
}

export function declarationContextParseWitnessId(
	analysisId: DeclarationContextAnalysisId,
	record: Omit<DeclarationContextParseWitnessRecord, 'id'>,
	onProgress?: () => void
): DeclarationContextParseWitnessId {
	return identity<DeclarationContextParseWitnessId>(
		'declaration-context-parse-witness',
		'JAN-CSAA-DECLARATION-CONTEXT-PARSE-WITNESS',
		{ analysisId, ...record },
		onProgress
	);
}

export function declarationContextArtifactId(
	analysisId: DeclarationContextAnalysisId,
	record: Omit<DeclarationContextArtifactRecord, 'id'>,
	onProgress?: () => void
): DeclarationContextArtifactId {
	return identity<DeclarationContextArtifactId>(
		'declaration-context-artifact',
		'JAN-CSAA-DECLARATION-CONTEXT-ARTIFACT',
		{ analysisId, ...record },
		onProgress
	);
}

export function declarationContextDeclarationId(
	analysisId: DeclarationContextAnalysisId,
	record: Omit<DeclarationContextDeclarationRecord, 'id'>,
	onProgress?: () => void
): DeclarationContextDeclarationId {
	return identity<DeclarationContextDeclarationId>(
		'declaration-context-declaration',
		'JAN-CSAA-DECLARATION-CONTEXT-DECLARATION',
		{ analysisId, ...record },
		onProgress
	);
}

export function declarationContextTerminalSymbolId(
	analysisId: DeclarationContextAnalysisId,
	record: Omit<DeclarationContextTerminalSymbolRecord, 'id'>,
	onProgress?: () => void
): DeclarationContextTerminalSymbolId {
	return identity<DeclarationContextTerminalSymbolId>(
		'declaration-context-terminal-symbol',
		'JAN-CSAA-DECLARATION-CONTEXT-TERMINAL-SYMBOL',
		{ analysisId, ...record },
		onProgress
	);
}

export function declarationContextExportBindingId(
	analysisId: DeclarationContextAnalysisId,
	record: Omit<DeclarationContextExportBindingRecord, 'id'>,
	onProgress?: () => void
): DeclarationContextExportBindingId {
	return identity<DeclarationContextExportBindingId>(
		'declaration-context-export-binding',
		'JAN-CSAA-DECLARATION-CONTEXT-EXPORT-BINDING',
		{ analysisId, ...record },
		onProgress
	);
}

export function declarationContextMergeId(
	analysisId: DeclarationContextAnalysisId,
	record: Omit<DeclarationContextMergeRecord, 'id'>,
	onProgress?: () => void
): DeclarationContextMergeId {
	return identity<DeclarationContextMergeId>(
		'declaration-context-merge',
		'JAN-CSAA-DECLARATION-CONTEXT-MERGE',
		{ analysisId, ...record },
		onProgress
	);
}

export function declarationContextRelationId(
	analysisId: DeclarationContextAnalysisId,
	record: DeclarationContextRelationRecordWithoutId,
	onProgress?: () => void
): DeclarationContextRelationId {
	return identity<DeclarationContextRelationId>(
		'declaration-context-relation',
		'JAN-CSAA-DECLARATION-CONTEXT-RELATION',
		{ analysisId, ...record },
		onProgress
	);
}

/** Deterministic census digest of every source admitted to the fresh Program. */
export function declarationContextProgramSourcePopulationDigest(
	sources: readonly DeclarationContextProgramSourceIdentity[],
	onProgress?: () => void
): string {
	onProgress?.();
	const sorted: DeclarationContextProgramSourceIdentity[] = [];
	for (const source of sources) {
		onProgress?.();
		sorted.push(source);
	}
	sorted.sort((left, right) => {
		onProgress?.();
		const leftBytes = String(left.bytes);
		const rightBytes = String(right.bytes);
		if (leftBytes !== rightBytes) return leftBytes < rightBytes ? -1 : 1;
		const content = compareCanonicalSemanticJsonStrings(
			left.contentSha256,
			right.contentSha256,
			onProgress
		);
		if (content !== 0) return content;
		if (left.declarationFile !== right.declarationFile) return left.declarationFile ? 1 : -1;
		const logicalPath = compareCanonicalSemanticJsonStrings(
			left.logicalPath,
			right.logicalPath,
			onProgress
		);
		if (logicalPath !== 0) return logicalPath;
		const origin = compareCanonicalSemanticJsonStrings(left.origin, right.origin, onProgress);
		if (origin !== 0) return origin;
		return compareCanonicalSemanticJsonStrings(
			left.semanticSourceId,
			right.semanticSourceId,
			onProgress
		);
	});
	return digest('JAN-CSAA-DECLARATION-CONTEXT-PROGRAM-SOURCE-POPULATION', sorted, onProgress);
}

export type DeclarationContextAnalysisContent = Omit<
	DeclarationContextAnalysisSnapshot,
	'contentDigest'
>;

export function declarationContextAnalysisContentDigest(
	analysis: DeclarationContextAnalysisSnapshot | DeclarationContextAnalysisContent,
	onProgress?: () => void
): string {
	const { contentDigest: _contentDigest, ...content } =
		analysis as DeclarationContextAnalysisSnapshot;
	return digest('JAN-CSAA-DECLARATION-CONTEXT-ANALYSIS-CONTENT', content, onProgress);
}
