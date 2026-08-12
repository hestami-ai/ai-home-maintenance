import type {
	CallGraphEdgeId,
	CallGraphEndpoint,
	CallGraphFrontierNode,
	CallGraphId,
	CallGraphLayer,
	CallGraphLayerId,
	CallGraphNodeId,
	CallGraphEdge
} from '../contracts/call-graph.js';
import type {
	SemanticInvocationSiteId,
	SemanticNodeId,
	SemanticSnapshotId,
	SemanticSourceId
} from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';

const CALL_GRAPH_ID_ALGORITHM_VERSION = '1';

function graphId<Kind extends string>(prefix: string, domain: string, preimage: unknown): Kind {
	return `${prefix}-${sha256(
		`${domain}\0${CALL_GRAPH_ID_ALGORITHM_VERSION}\0${canonicalSemanticJson(preimage)}`
	)}` as Kind;
}

export interface CallGraphIdentityInput {
	readonly canonicalProfile: string;
	readonly graphInputDigest: string;
	readonly graphKind: 'TYPESCRIPT_CALL';
	readonly method: string;
	readonly operationVersion: string;
	readonly schemaVersion: string;
	readonly semanticSnapshotId: SemanticSnapshotId;
	readonly subjectId: string;
}

export const callGraphId = (input: CallGraphIdentityInput): CallGraphId =>
	graphId<CallGraphId>('graph:call', 'JAN-CSAA-CALL-GRAPH', input);

export const callGraphLayerId = (
	graph: CallGraphId,
	kind: CallGraphLayer['kind'],
	ordinal: CallGraphLayer['ordinal']
): CallGraphLayerId =>
	graphId<CallGraphLayerId>('graph-layer:call', 'JAN-CSAA-CALL-GRAPH-LAYER', {
		graph,
		kind,
		ordinal
	});

export const callGraphSourceRegionNodeId = (
	graph: CallGraphId,
	semanticSourceId: SemanticSourceId
): CallGraphNodeId =>
	graphId<CallGraphNodeId>('graph-node:source-region', 'JAN-CSAA-CALL-GRAPH-SOURCE-REGION', {
		graph,
		semanticSourceId
	});

export const callGraphCallableTargetNodeId = (
	graph: CallGraphId,
	semanticNodeId: SemanticNodeId
): CallGraphNodeId =>
	graphId<CallGraphNodeId>('graph-node:callable-target', 'JAN-CSAA-CALL-GRAPH-CALLABLE-TARGET', {
		graph,
		semanticNodeId
	});

export const callGraphCallSiteNodeId = (
	graph: CallGraphId,
	invocationId: SemanticInvocationSiteId
): CallGraphNodeId =>
	graphId<CallGraphNodeId>('graph-node:call-site', 'JAN-CSAA-CALL-GRAPH-CALL-SITE', {
		graph,
		invocationId
	});

export const callGraphFrontierNodeId = (
	graph: CallGraphId,
	invocationId: SemanticInvocationSiteId,
	frontierKind: CallGraphFrontierNode['frontierKind']
): CallGraphNodeId =>
	graphId<CallGraphNodeId>('graph-node:frontier', 'JAN-CSAA-CALL-GRAPH-FRONTIER', {
		frontierKind,
		graph,
		invocationId
	});

export interface CallGraphEdgeIdentityInput {
	readonly candidateRank: number | null;
	readonly graph: CallGraphId;
	readonly invocationId: SemanticInvocationSiteId;
	readonly relationKind: CallGraphEdge['relationKind'];
	readonly source: CallGraphEndpoint;
	readonly target: CallGraphEndpoint;
}

export const callGraphEdgeId = (input: CallGraphEdgeIdentityInput): CallGraphEdgeId =>
	graphId<CallGraphEdgeId>('graph-edge:call', 'JAN-CSAA-CALL-GRAPH-EDGE', input);
