import {
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CANONICAL_PROFILE,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_METHOD,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SCHEMA_VERSION,
	type StructuralModuleReachabilityAnalysisId,
	type StructuralModuleReachabilityAnalysisInputs,
	type StructuralModuleReachabilityAnalysisSnapshot,
	type StructuralModuleReachabilityFrontierId,
	type StructuralModuleReachabilityLayerId,
	type StructuralModuleReachabilityMemberId
} from '../contracts/structural-module-reachability-analysis.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';

const ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

export function structuralModuleReachabilityAnalysisInputDigest(
	inputs: StructuralModuleReachabilityAnalysisInputs
): string {
	return canonicalSemanticJsonWitness({
		graph: {
			contentDigest: inputs.graph.contentDigest,
			graphInputDigest: inputs.graph.graphInputDigest,
			id: inputs.graph.id,
			schemaVersion: inputs.graph.schemaVersion,
			semanticSnapshotId: inputs.graph.semanticSnapshotId,
			subjectId: inputs.graph.subjectId
		},
		request: inputs.request,
		semanticSnapshot: {
			extractionVersion: inputs.semanticSnapshot.extractionVersion,
			id: inputs.semanticSnapshot.id,
			schemaVersion: inputs.semanticSnapshot.schemaVersion,
			subjectId: inputs.semanticSnapshot.subjectId
		}
	}).sha256;
}

export function structuralModuleReachabilityAnalysisId(input: {
	readonly inputDigest: string;
	readonly semanticSnapshotId: string;
	readonly subjectId: string;
}): StructuralModuleReachabilityAnalysisId {
	return identity<StructuralModuleReachabilityAnalysisId>(
		'analysis:structural-module-reachability',
		'JAN-CSAA-STRUCTURAL-MODULE-REACHABILITY',
		{
			canonicalProfile: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CANONICAL_PROFILE,
			inputDigest: input.inputDigest,
			method: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_METHOD,
			operationVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
			schemaVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SCHEMA_VERSION,
			semanticSnapshotId: input.semanticSnapshotId,
			subjectId: input.subjectId
		}
	);
}

export function structuralModuleReachabilityMemberId(
	analysisId: StructuralModuleReachabilityAnalysisId,
	nodeId: string
): StructuralModuleReachabilityMemberId {
	return identity<StructuralModuleReachabilityMemberId>(
		'structural-module-reachability-member',
		'JAN-CSAA-STRUCTURAL-MODULE-REACHABILITY-MEMBER',
		{ analysisId, nodeId }
	);
}

export function structuralModuleReachabilityFrontierId(
	analysisId: StructuralModuleReachabilityAnalysisId,
	nodeId: string
): StructuralModuleReachabilityFrontierId {
	return identity<StructuralModuleReachabilityFrontierId>(
		'structural-module-reachability-frontier',
		'JAN-CSAA-STRUCTURAL-MODULE-REACHABILITY-FRONTIER',
		{ analysisId, nodeId, reason: 'REACHED_GRAPH_NATIVE_RESOLUTION_TARGET' }
	);
}

export function structuralModuleReachabilityLayerId(
	analysisId: StructuralModuleReachabilityAnalysisId
): StructuralModuleReachabilityLayerId {
	return identity<StructuralModuleReachabilityLayerId>(
		'structural-module-reachability-layer',
		'JAN-CSAA-STRUCTURAL-MODULE-REACHABILITY-LAYER',
		{ analysisId, kind: 'DERIVATION' }
	);
}

export type StructuralModuleReachabilityAnalysisContent = Omit<
	StructuralModuleReachabilityAnalysisSnapshot,
	'contentDigest'
>;

export function structuralModuleReachabilityAnalysisContentDigest(
	analysis:
		StructuralModuleReachabilityAnalysisSnapshot | StructuralModuleReachabilityAnalysisContent
): string {
	const { contentDigest: _contentDigest, ...content } =
		analysis as StructuralModuleReachabilityAnalysisSnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}
