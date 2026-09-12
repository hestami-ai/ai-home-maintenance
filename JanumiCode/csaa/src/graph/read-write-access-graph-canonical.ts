import type {
	ReadWriteAccessGraphEdge,
	ReadWriteAccessGraphEdgeId,
	ReadWriteAccessGraphEndpoint,
	ReadWriteAccessGraphId,
	ReadWriteAccessGraphLayer,
	ReadWriteAccessGraphLayerId,
	ReadWriteAccessGraphNodeId,
	ReadWriteAccessGraphSnapshot
} from '../contracts/read-write-access-graph.js';
import type {
	SemanticDeclarationId,
	SemanticNodeId,
	SemanticReferenceId,
	SemanticSymbolId,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';

const ID_ALGORITHM_VERSION = '1';

function identity<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

export function readWriteAccessGraphInputDigest(snapshot: StaticSemanticSnapshot): string {
	return canonicalSemanticJsonWitness({
		assignments: snapshot.assignments,
		astNodes: snapshot.astNodes.map((node) => ({
			end: node.end,
			id: node.id,
			kind: node.kind,
			kindName: node.kindName,
			operatorKind: node.operatorKind,
			operatorName: node.operatorName,
			parentId: node.parentId,
			siblingOrdinal: node.siblingOrdinal,
			sourceId: node.sourceId,
			start: node.start,
			structuralRoles: node.structuralRoles
		})),
		capabilities: snapshot.capabilities,
		declarationCandidates: snapshot.declarationCandidates,
		declarations: snapshot.declarations,
		expectedEmpty: snapshot.expectedEmpty,
		extractionVersion: snapshot.extractionVersion,
		health: snapshot.health,
		operationVersion: snapshot.operationVersion,
		provider: snapshot.provider,
		provenances: snapshot.provenances,
		references: snapshot.references,
		schemaVersion: snapshot.schemaVersion,
		semanticSnapshotId: snapshot.id,
		sources: snapshot.sources.map((source) => ({
			analysisDisposition: source.analysisDisposition,
			id: source.id,
			programId: source.programId,
			projectId: source.projectId,
			provenanceId: source.provenanceId,
			syntaxProvenanceId: source.syntaxProvenanceId
		})),
		subjectId: snapshot.subjectId,
		symbols: snapshot.symbols
	}).sha256;
}

export function readWriteAccessGraphId(input: {
	readonly canonicalProfile: string;
	readonly graphInputDigest: string;
	readonly method: string;
	readonly operationVersion: string;
	readonly schemaVersion: string;
	readonly semanticSnapshotId: string;
	readonly subjectId: string;
}): ReadWriteAccessGraphId {
	return identity<ReadWriteAccessGraphId>(
		'graph:read-write-access',
		'JAN-CSAA-READ-WRITE-ACCESS-GRAPH',
		input
	);
}

export function readWriteAccessGraphLayerId(
	graphId: ReadWriteAccessGraphId
): ReadWriteAccessGraphLayerId {
	return identity<ReadWriteAccessGraphLayerId>(
		'graph-layer:read-write-access',
		'JAN-CSAA-READ-WRITE-ACCESS-GRAPH-LAYER',
		{ graphId, kind: 'TYPESCRIPT_READ_WRITE_ACCESS', ordinal: 0 }
	);
}

export function readWriteAccessSymbolNodeId(
	graphId: ReadWriteAccessGraphId,
	symbolId: SemanticSymbolId
): ReadWriteAccessGraphNodeId {
	return identity<ReadWriteAccessGraphNodeId>(
		'graph-node:read-write-symbol',
		'JAN-CSAA-READ-WRITE-ACCESS-SYMBOL',
		{ graphId, symbolId }
	);
}

export function readWriteAccessOccurrenceNodeId(
	graphId: ReadWriteAccessGraphId,
	input: {
		readonly declarationId: SemanticDeclarationId | null;
		readonly referenceId: SemanticReferenceId | null;
	}
): ReadWriteAccessGraphNodeId {
	return identity<ReadWriteAccessGraphNodeId>(
		'graph-node:read-write-access',
		'JAN-CSAA-READ-WRITE-ACCESS-OCCURRENCE',
		{ graphId, ...input }
	);
}

export function readWriteAccessFrontierNodeId(
	graphId: ReadWriteAccessGraphId,
	input: {
		readonly assignmentNodeId: SemanticNodeId | null;
		readonly frontierKind: string;
		readonly occurrenceNodeId: SemanticNodeId;
		readonly referenceId: SemanticReferenceId | null;
	}
): ReadWriteAccessGraphNodeId {
	return identity<ReadWriteAccessGraphNodeId>(
		'graph-node:read-write-frontier',
		'JAN-CSAA-READ-WRITE-ACCESS-FRONTIER',
		{ graphId, ...input }
	);
}

export function readWriteAccessEdgeId(input: {
	readonly graphId: ReadWriteAccessGraphId;
	readonly relationKind: ReadWriteAccessGraphEdge['relationKind'];
	readonly source: ReadWriteAccessGraphEndpoint;
	readonly target: ReadWriteAccessGraphEndpoint;
}): ReadWriteAccessGraphEdgeId {
	return identity<ReadWriteAccessGraphEdgeId>(
		'graph-edge:read-write-access',
		'JAN-CSAA-READ-WRITE-ACCESS-EDGE',
		input
	);
}

export type ReadWriteAccessGraphContent = Omit<ReadWriteAccessGraphSnapshot, 'contentDigest'>;

export function readWriteAccessGraphContentDigest(
	graph: ReadWriteAccessGraphSnapshot | ReadWriteAccessGraphContent
): string {
	const { contentDigest: _contentDigest, ...content } = graph as ReadWriteAccessGraphSnapshot;
	return canonicalSemanticJsonWitness(content).sha256;
}

export function layerIdentityInput(layer: ReadWriteAccessGraphLayer): unknown {
	return { graphId: layer.graphId, kind: layer.kind, ordinal: layer.ordinal };
}
