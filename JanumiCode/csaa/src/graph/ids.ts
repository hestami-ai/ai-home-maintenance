import type {
	ModuleDependencyGraphEdgeId,
	ModuleDependencyGraphEndpoint,
	ModuleDependencyGraphId,
	ModuleDependencyGraphLayerId,
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphRelationKind
} from '../contracts/graph.js';
import type {
	SemanticModuleResolutionId,
	SemanticSnapshotId,
	SemanticSourceId
} from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';

const GRAPH_ID_ALGORITHM_VERSION = '1';

function graphId<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${GRAPH_ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

export interface ModuleDependencyGraphIdentityInput {
	readonly canonicalProfile: string;
	readonly graphInputDigest: string;
	readonly graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY';
	readonly method: string;
	readonly operationVersion: string;
	readonly schemaVersion: string;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export const moduleDependencyGraphId = (
	input: ModuleDependencyGraphIdentityInput
): ModuleDependencyGraphId =>
	graphId<ModuleDependencyGraphId>(
		'graph:module-dependency',
		'JAN-CSAA-MODULE-DEPENDENCY-GRAPH',
		input
	);

export const moduleDependencyGraphLayerId = (
	graph: ModuleDependencyGraphId,
	kind: 'TYPESCRIPT_MODULE_RESOLUTION',
	ordinal: 0
): ModuleDependencyGraphLayerId =>
	graphId<ModuleDependencyGraphLayerId>('graph-layer:module-resolution', 'JAN-CSAA-GRAPH-LAYER', {
		graph,
		kind,
		ordinal
	});

export const moduleDependencyGraphSourceNodeId = (
	graph: ModuleDependencyGraphId,
	semanticSourceId: SemanticSourceId
): ModuleDependencyGraphNodeId =>
	graphId<ModuleDependencyGraphNodeId>('graph-node:source', 'JAN-CSAA-GRAPH-SOURCE-NODE', {
		graph,
		semanticSourceId
	});

export const moduleDependencyGraphResolutionTargetNodeId = (
	graph: ModuleDependencyGraphId,
	moduleResolutionId: SemanticModuleResolutionId
): ModuleDependencyGraphNodeId =>
	graphId<ModuleDependencyGraphNodeId>(
		'graph-node:resolution-target',
		'JAN-CSAA-GRAPH-RESOLUTION-TARGET-NODE',
		{ graph, moduleResolutionId }
	);

export interface ModuleDependencyGraphEdgeIdentityInput {
	readonly graph: ModuleDependencyGraphId;
	readonly moduleResolutionId: SemanticModuleResolutionId;
	readonly relationKind: ModuleDependencyGraphRelationKind;
	readonly source: ModuleDependencyGraphEndpoint;
	readonly target: ModuleDependencyGraphEndpoint;
}

export const moduleDependencyGraphEdgeId = (
	input: ModuleDependencyGraphEdgeIdentityInput
): ModuleDependencyGraphEdgeId =>
	graphId<ModuleDependencyGraphEdgeId>(
		'graph-edge:module-occurrence',
		'JAN-CSAA-GRAPH-MODULE-OCCURRENCE-EDGE',
		input
	);
