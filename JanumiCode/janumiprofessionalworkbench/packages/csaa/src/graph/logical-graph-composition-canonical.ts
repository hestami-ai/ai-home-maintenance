import {
	LOGICAL_GRAPH_COMPOSITION_CANONICAL_PROFILE,
	LOGICAL_GRAPH_COMPOSITION_METHOD,
	LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
	LOGICAL_GRAPH_COMPOSITION_SCHEMA_VERSION,
	type LogicalGraphCompositionCrossLinkId,
	type LogicalGraphCompositionId,
	type LogicalGraphCompositionInputs,
	type LogicalGraphCompositionLayerId,
	type LogicalGraphCompositionSnapshot
} from '../contracts/logical-graph-composition.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';

const ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

export function logicalGraphCompositionInputDigest(inputs: LogicalGraphCompositionInputs): string {
	return canonicalSemanticJsonWitness({
		callGraph: {
			canonicalProfile: inputs.callGraph.canonicalProfile,
			contentDigest: inputs.callGraph.contentDigest,
			graphInputDigest: inputs.callGraph.graphInputDigest,
			graphKind: inputs.callGraph.graphKind,
			id: inputs.callGraph.id,
			layerId: inputs.callGraph.layers[0].id,
			method: inputs.callGraph.method,
			operationVersion: inputs.callGraph.operationVersion,
			producer: inputs.callGraph.producer,
			schemaVersion: inputs.callGraph.schemaVersion,
			semanticExtractionVersion: inputs.callGraph.semanticExtractionVersion,
			semanticSchemaVersion: inputs.callGraph.semanticSchemaVersion,
			semanticSnapshotId: inputs.callGraph.semanticSnapshotId,
			subjectId: inputs.callGraph.subjectId
		},
		moduleDependencyGraph: {
			canonicalProfile: inputs.moduleDependencyGraph.canonicalProfile,
			contentDigest: inputs.moduleDependencyGraph.contentDigest,
			graphInputDigest: inputs.moduleDependencyGraph.graphInputDigest,
			graphKind: inputs.moduleDependencyGraph.graphKind,
			id: inputs.moduleDependencyGraph.id,
			layerId: inputs.moduleDependencyGraph.layers[0].id,
			method: inputs.moduleDependencyGraph.method,
			operationVersion: inputs.moduleDependencyGraph.operationVersion,
			producer: inputs.moduleDependencyGraph.producer,
			schemaVersion: inputs.moduleDependencyGraph.schemaVersion,
			semanticExtractionVersion: inputs.moduleDependencyGraph.semanticExtractionVersion,
			semanticSchemaVersion: inputs.moduleDependencyGraph.semanticSchemaVersion,
			semanticSnapshotId: inputs.moduleDependencyGraph.semanticSnapshotId,
			subjectId: inputs.moduleDependencyGraph.subjectId
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

export function logicalGraphCompositionId(input: {
	readonly inputDigest: string;
	readonly semanticSnapshotId: string;
	readonly subjectId: string;
}): LogicalGraphCompositionId {
	return identity<LogicalGraphCompositionId>(
		'logical-graph-composition',
		'JAN-CSAA-LOGICAL-GRAPH-COMPOSITION',
		{
			canonicalProfile: LOGICAL_GRAPH_COMPOSITION_CANONICAL_PROFILE,
			inputDigest: input.inputDigest,
			method: LOGICAL_GRAPH_COMPOSITION_METHOD,
			operationVersion: LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
			schemaVersion: LOGICAL_GRAPH_COMPOSITION_SCHEMA_VERSION,
			semanticSnapshotId: input.semanticSnapshotId,
			subjectId: input.subjectId
		}
	);
}

export function logicalGraphCompositionLayerId(
	compositionId: LogicalGraphCompositionId,
	role: 'CALL' | 'MODULE_DEPENDENCY'
): LogicalGraphCompositionLayerId {
	return identity<LogicalGraphCompositionLayerId>(
		'logical-graph-composition-layer',
		'JAN-CSAA-LOGICAL-GRAPH-COMPOSITION-LAYER',
		{ compositionId, role }
	);
}

export function logicalGraphCompositionCrossLinkId(
	compositionId: LogicalGraphCompositionId,
	semanticSourceId: string
): LogicalGraphCompositionCrossLinkId {
	return identity<LogicalGraphCompositionCrossLinkId>(
		'logical-graph-composition-link',
		'JAN-CSAA-LOGICAL-GRAPH-COMPOSITION-LINK',
		{
			compositionId,
			relationKind: 'SAME_SEMANTIC_SOURCE_OCCURRENCE',
			semanticSourceId
		}
	);
}

export type LogicalGraphCompositionContent = Omit<LogicalGraphCompositionSnapshot, 'contentDigest'>;

export function logicalGraphCompositionContentDigest(
	composition: LogicalGraphCompositionSnapshot | LogicalGraphCompositionContent
): string {
	const { contentDigest: _contentDigest, ...content } =
		composition as LogicalGraphCompositionSnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}
