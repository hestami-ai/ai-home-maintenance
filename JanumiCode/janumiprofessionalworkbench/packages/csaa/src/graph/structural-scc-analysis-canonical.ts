import {
	STRUCTURAL_SCC_ANALYSIS_CANONICAL_PROFILE,
	STRUCTURAL_SCC_ANALYSIS_METHOD,
	STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_SCC_ANALYSIS_SCHEMA_VERSION,
	type StructuralSccAnalysisId,
	type StructuralSccAnalysisInputs,
	type StructuralSccAnalysisSnapshot,
	type StructuralSccComponentId,
	type StructuralSccLayerId
} from '../contracts/structural-scc-analysis.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';

const ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

export function structuralSccAnalysisInputDigest(inputs: StructuralSccAnalysisInputs): string {
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

export function structuralSccAnalysisId(input: {
	readonly inputDigest: string;
	readonly semanticSnapshotId: string;
	readonly subjectId: string;
}): StructuralSccAnalysisId {
	return identity<StructuralSccAnalysisId>('analysis:structural-scc', 'JAN-CSAA-STRUCTURAL-SCC', {
		canonicalProfile: STRUCTURAL_SCC_ANALYSIS_CANONICAL_PROFILE,
		inputDigest: input.inputDigest,
		method: STRUCTURAL_SCC_ANALYSIS_METHOD,
		operationVersion: STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_SCC_ANALYSIS_SCHEMA_VERSION,
		semanticSnapshotId: input.semanticSnapshotId,
		subjectId: input.subjectId
	});
}

export function structuralSccComponentId(
	analysisId: StructuralSccAnalysisId,
	nodeIds: readonly string[]
): StructuralSccComponentId {
	return identity<StructuralSccComponentId>(
		'structural-scc-component',
		'JAN-CSAA-STRUCTURAL-SCC-COMPONENT',
		{ analysisId, nodeIds }
	);
}

export function structuralSccLayerId(analysisId: StructuralSccAnalysisId): StructuralSccLayerId {
	return identity<StructuralSccLayerId>('structural-scc-layer', 'JAN-CSAA-STRUCTURAL-SCC-LAYER', {
		analysisId,
		kind: 'DERIVATION'
	});
}

export type StructuralSccAnalysisContent = Omit<StructuralSccAnalysisSnapshot, 'contentDigest'>;

export function structuralSccAnalysisContentDigest(
	analysis: StructuralSccAnalysisSnapshot | StructuralSccAnalysisContent
): string {
	const { contentDigest: _contentDigest, ...content } = analysis as StructuralSccAnalysisSnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}
