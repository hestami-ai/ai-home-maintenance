import {
	MODULE_RESOLUTION_TRACE_CANONICAL_PROFILE,
	MODULE_RESOLUTION_TRACE_METHOD,
	MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
	MODULE_RESOLUTION_TRACE_SCHEMA_VERSION,
	type ModuleResolutionAttemptId,
	type ModuleResolutionAttemptRecord,
	type ModuleResolutionCandidateId,
	type ModuleResolutionCandidateRecord,
	type ModuleResolutionRelationId,
	type ModuleResolutionTargetInputWitness,
	type ModuleResolutionTargetWitness,
	type ModuleResolutionTraceBuildInputs,
	type ModuleResolutionTraceCanonicalBinding,
	type ModuleResolutionTraceId,
	type ModuleResolutionTraceSnapshot
} from '../contracts/module-resolution-trace.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';

const ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

function digest(domain: string, preimage: unknown): string {
	return sha256(`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`);
}

/** Removes the two trace-derived IDs so input identity has no derivation cycle. */
export function moduleResolutionTargetInputBinding(
	target: ModuleResolutionTargetWitness
): ModuleResolutionTargetInputWitness {
	const {
		candidateId: _candidateId,
		selectedFileExistsAttemptId: _selectedFileExistsAttemptId,
		...inputBinding
	} = target;
	return inputBinding;
}

/**
 * Binds compact independently validated predecessors and the exact selected
 * importer, target, resolver, and capture witnesses. Complete predecessor
 * snapshots and the FrozenSubject are intentionally not serialized here.
 */
export function moduleResolutionTraceInputDigest(
	inputs: ModuleResolutionTraceBuildInputs,
	binding: ModuleResolutionTraceCanonicalBinding
): string {
	return digest('JAN-CSAA-MODULE-RESOLUTION-TRACE-INPUT', {
		conditionalExportRequest: inputs.conditionalExportRequest,
		conditionalExportResolution: {
			contentDigest: inputs.conditionalExportResolution.contentDigest,
			decision: inputs.conditionalExportResolution.decision,
			id: inputs.conditionalExportResolution.id,
			inputDigest: inputs.conditionalExportResolution.inputDigest,
			manifestWitness: inputs.conditionalExportResolution.manifestWitness,
			requestReference: inputs.request.conditionalExportResolution
		},
		frozenSubject: {
			fileManifestDigest: inputs.frozenSubject.descriptor.fileManifestDigest,
			policyVersion: inputs.frozenSubject.descriptor.policyVersion,
			schemaVersion: inputs.frozenSubject.descriptor.schemaVersion,
			subjectId: inputs.frozenSubject.descriptor.subjectId
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
		selectedWitnesses: {
			captureWitness: binding.captureWitness,
			importerWitness: binding.importerWitness,
			resolverEnvironment: binding.resolverEnvironment,
			targetWitness: binding.targetWitness
		},
		semanticSnapshot: {
			contextDigest: inputs.semanticSnapshot.contextDigest,
			extractionVersion: inputs.semanticSnapshot.extractionVersion,
			id: inputs.semanticSnapshot.id,
			operationVersion: inputs.semanticSnapshot.operationVersion,
			provider: inputs.semanticSnapshot.provider,
			schemaVersion: inputs.semanticSnapshot.schemaVersion,
			subjectId: inputs.semanticSnapshot.subjectId
		}
	});
}

export function moduleResolutionTraceId(input: {
	readonly conditionalExportResolutionId: string;
	readonly inputDigest: string;
	readonly semanticSnapshotId: string;
	readonly subjectId: string;
}): ModuleResolutionTraceId {
	return identity<ModuleResolutionTraceId>(
		'module-resolution-trace',
		'JAN-CSAA-MODULE-RESOLUTION-TRACE',
		{
			canonicalProfile: MODULE_RESOLUTION_TRACE_CANONICAL_PROFILE,
			conditionalExportResolutionId: input.conditionalExportResolutionId,
			inputDigest: input.inputDigest,
			method: MODULE_RESOLUTION_TRACE_METHOD,
			operationVersion: MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
			schemaVersion: MODULE_RESOLUTION_TRACE_SCHEMA_VERSION,
			semanticSnapshotId: input.semanticSnapshotId,
			subjectId: input.subjectId
		}
	);
}

export function moduleResolutionAttemptId(
	traceId: ModuleResolutionTraceId,
	record: Omit<ModuleResolutionAttemptRecord, 'id'>
): ModuleResolutionAttemptId {
	return identity<ModuleResolutionAttemptId>(
		'module-resolution-attempt',
		'JAN-CSAA-MODULE-RESOLUTION-ATTEMPT',
		{ traceId, ...record }
	);
}

export function moduleResolutionCandidateId(
	traceId: ModuleResolutionTraceId,
	record: Omit<ModuleResolutionCandidateRecord, 'id'>
): ModuleResolutionCandidateId {
	return identity<ModuleResolutionCandidateId>(
		'module-resolution-candidate',
		'JAN-CSAA-MODULE-RESOLUTION-CANDIDATE',
		{ traceId, ...record }
	);
}

export function moduleResolutionRelationId(input: {
	readonly importerSourceId: string;
	readonly semanticModuleResolutionId: string;
	readonly specifierNodeId: string;
	readonly targetSourceId: string;
	readonly traceId: ModuleResolutionTraceId;
}): ModuleResolutionRelationId {
	return identity<ModuleResolutionRelationId>(
		'module-resolution-relation',
		'JAN-CSAA-MODULE-RESOLUTION-RELATION',
		{
			kind: 'EXACT_LITERAL_IMPORT_RESOLVES_TO_DECLARATION_BUILD_OUTPUT',
			...input
		}
	);
}

export type ModuleResolutionTraceContent = Omit<ModuleResolutionTraceSnapshot, 'contentDigest'>;

export function moduleResolutionTraceContentDigest(
	trace: ModuleResolutionTraceSnapshot | ModuleResolutionTraceContent
): string {
	const { contentDigest: _contentDigest, ...content } = trace as ModuleResolutionTraceSnapshot;
	return digest('JAN-CSAA-MODULE-RESOLUTION-TRACE-CONTENT', content);
}
