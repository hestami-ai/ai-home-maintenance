import { isProxy } from 'node:util/types';

import {
	STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER,
	STRUCTURAL_SCC_ANALYSIS_CANONICAL_PROFILE,
	STRUCTURAL_SCC_ANALYSIS_CAPABILITY,
	STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS,
	STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT,
	STRUCTURAL_SCC_ANALYSIS_METHOD,
	STRUCTURAL_SCC_ANALYSIS_NONCLAIMS,
	STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_SCC_ANALYSIS_SCHEMA_VERSION,
	STRUCTURAL_SCC_ANALYSIS_SELECTION,
	type StructuralSccAnalysisBudgets,
	type StructuralSccAnalysisInputs,
	type StructuralSccAnalysisOutcome,
	type StructuralSccAnalysisRequest,
	type StructuralSccAnalysisSnapshot,
	type StructuralSccComponent,
	type StructuralSccComponentIndexEntry,
	type StructuralSccDiagnostic
} from '../contracts/structural-scc-analysis.js';
import { compareText } from '../inventory/canonical.js';
import { isUnicodeScalarString } from '../semantic/canonical.js';
import {
	structuralSccAnalysisContentDigest,
	structuralSccAnalysisId,
	structuralSccAnalysisInputDigest,
	structuralSccComponentId,
	structuralSccLayerId
} from './structural-scc-analysis-canonical.js';
import { validateModuleDependencyGraph } from './validate-graph.js';
import { validateConstructedStructuralSccAnalysis } from './validate-structural-scc-analysis.js';

const REQUEST_KEYS = [
	'budgets',
	'operationVersion',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'sourceGraph',
	'subjectId'
] as const;
const BUDGET_KEYS = [
	'maxComponents',
	'maxDiagnostics',
	'maxEdges',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxNodes',
	'maxTraversalSteps'
] as const;
const SOURCE_GRAPH_KEYS = ['contentDigest', 'graphId', 'graphInputDigest', 'graphKind'] as const;
const SELECTION_KEYS = [
	'direction',
	'edgePopulation',
	'nodePopulation',
	'parallelEdges',
	'selfLoops'
] as const;

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxy(value) ||
		Object.getPrototypeOf(value) !== Object.prototype
	)
		return false;
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.some((key) => typeof key !== 'string') || ownKeys.length !== keys.length)
		return false;
	const sorted = ownKeys.slice().sort((left, right) => compareText(String(left), String(right)));
	const expected = keys.slice().sort(compareText);
	if (sorted.some((key, index) => key !== expected[index])) return false;
	return ownKeys.every((key) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		return descriptor !== undefined && 'value' in descriptor && descriptor.enumerable;
	});
}

function safeInteger(value: unknown, positive = false): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		!Object.is(value, -0) &&
		(positive ? value > 0 : value >= 0)
	);
}

function materializeRequest(value: unknown): StructuralSccAnalysisRequest {
	if (!exactRecord(value, REQUEST_KEYS)) throw new TypeError('The SCC request must be exact.');
	if (!exactRecord(value.budgets, BUDGET_KEYS))
		throw new TypeError('The SCC budgets must be exact.');
	if (!exactRecord(value.sourceGraph, SOURCE_GRAPH_KEYS))
		throw new TypeError('The SCC source-graph reference must be exact.');
	if (!exactRecord(value.selection, SELECTION_KEYS))
		throw new TypeError('The SCC selection must be exact.');
	const budgets = value.budgets;
	if (
		!safeInteger(budgets.maxComponents) ||
		!safeInteger(budgets.maxDiagnostics, true) ||
		budgets.maxDiagnostics > 100_000 ||
		!safeInteger(budgets.maxEdges) ||
		!safeInteger(budgets.maxInputRecords, true) ||
		!safeInteger(budgets.maxInputStringCharacters, true) ||
		!safeInteger(budgets.maxNodes) ||
		!safeInteger(budgets.maxTraversalSteps)
	)
		throw new TypeError(
			'The SCC budgets must be nonnegative safe integers; maxDiagnostics is positive.'
		);
	if (
		value.operationVersion !== STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION ||
		value.schemaVersion !== STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION ||
		typeof value.subjectId !== 'string' ||
		value.subjectId.length === 0 ||
		typeof value.semanticSnapshotId !== 'string' ||
		value.semanticSnapshotId.length === 0 ||
		value.sourceGraph.graphKind !== 'TYPESCRIPT_MODULE_DEPENDENCY' ||
		![
			value.sourceGraph.graphId,
			value.sourceGraph.contentDigest,
			value.sourceGraph.graphInputDigest
		].every((item) => typeof item === 'string' && item.length > 0) ||
		Object.keys(STRUCTURAL_SCC_ANALYSIS_SELECTION).some(
			(key) =>
				(value.selection as Record<string, unknown>)[key] !==
				STRUCTURAL_SCC_ANALYSIS_SELECTION[key as keyof typeof STRUCTURAL_SCC_ANALYSIS_SELECTION]
		)
	)
		throw new TypeError('The SCC request identity or fixed selection is invalid.');
	return {
		budgets: { ...(budgets as unknown as StructuralSccAnalysisBudgets) },
		operationVersion: STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
		selection: { ...STRUCTURAL_SCC_ANALYSIS_SELECTION },
		semanticSnapshotId:
			value.semanticSnapshotId as StructuralSccAnalysisRequest['semanticSnapshotId'],
		sourceGraph: {
			contentDigest: value.sourceGraph.contentDigest as string,
			graphId: value.sourceGraph.graphId as StructuralSccAnalysisRequest['sourceGraph']['graphId'],
			graphInputDigest: value.sourceGraph.graphInputDigest as string,
			graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY'
		},
		subjectId: value.subjectId
	};
}

function arrayLength(value: unknown): number | null {
	if (isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
		return null;
	const descriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	return descriptor !== undefined && 'value' in descriptor && safeInteger(descriptor.value)
		? descriptor.value
		: null;
}

function unavailable(
	code: StructuralSccDiagnostic['code'],
	message: string,
	phase: StructuralSccDiagnostic['phase'],
	path: string | null = null
): StructuralSccAnalysisOutcome {
	return { diagnostics: [{ code, message, path, phase }], outcome: 'unavailable' };
}

function deepFreeze<T>(value: T, active = new WeakSet<object>()): T {
	if (value === null || typeof value !== 'object') return value;
	if (active.has(value)) return value;
	active.add(value);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, active);
	}
	return Object.freeze(value);
}

interface AdjacencyProjection {
	readonly edges: readonly {
		readonly id: StructuralSccAnalysisInputs['graph']['edges'][number]['id'];
		readonly source: StructuralSccAnalysisInputs['graph']['nodes'][number]['id'];
		readonly target: StructuralSccAnalysisInputs['graph']['nodes'][number]['id'];
	}[];
	readonly nodeIds: readonly StructuralSccAnalysisInputs['graph']['nodes'][number]['id'][];
	readonly upstreamClosure: 'CLOSED' | 'OPEN';
}

type AdjacencyProjectionResult =
	| { readonly projection: AdjacencyProjection; readonly state: 'VALID' }
	| { readonly state: 'BUDGET_EXCEEDED' | 'INVALID' };

function dataObject(value: unknown): value is Record<PropertyKey, unknown> {
	return (
		value !== null &&
		typeof value === 'object' &&
		!isProxy(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

function projectedNodeIds(
	graphNodes: StructuralSccAnalysisInputs['graph']['nodes'],
	nodeLength: number
): StructuralSccAnalysisInputs['graph']['nodes'][number]['id'][] | null {
	const nodeIds: StructuralSccAnalysisInputs['graph']['nodes'][number]['id'][] = [];
	for (let index = 0; index < nodeLength; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(graphNodes, String(index));
		if (descriptor === undefined || !('value' in descriptor) || !dataObject(descriptor.value))
			return null;
		const node =
			descriptor.value as unknown as StructuralSccAnalysisInputs['graph']['nodes'][number];
		const idDescriptor = Reflect.getOwnPropertyDescriptor(node, 'id');
		if (
			idDescriptor === undefined ||
			!('value' in idDescriptor) ||
			typeof idDescriptor.value !== 'string'
		)
			return null;
		nodeIds.push(idDescriptor.value as (typeof nodeIds)[number]);
	}
	return nodeIds;
}

function projectedEdges(
	graphEdges: StructuralSccAnalysisInputs['graph']['edges'],
	edgeLength: number
): AdjacencyProjection['edges'][number][] | null {
	const edges: AdjacencyProjection['edges'][number][] = [];
	for (let index = 0; index < edgeLength; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(graphEdges, String(index));
		if (descriptor === undefined || !('value' in descriptor) || !dataObject(descriptor.value))
			return null;
		const edge =
			descriptor.value as unknown as StructuralSccAnalysisInputs['graph']['edges'][number];
		const idDescriptor = Reflect.getOwnPropertyDescriptor(edge, 'id');
		const sourceDescriptor = Reflect.getOwnPropertyDescriptor(edge, 'source');
		const targetDescriptor = Reflect.getOwnPropertyDescriptor(edge, 'target');
		if (
			idDescriptor === undefined ||
			!('value' in idDescriptor) ||
			typeof idDescriptor.value !== 'string' ||
			sourceDescriptor === undefined ||
			!('value' in sourceDescriptor) ||
			!dataObject(sourceDescriptor.value) ||
			targetDescriptor === undefined ||
			!('value' in targetDescriptor) ||
			!dataObject(targetDescriptor.value)
		)
			return null;
		const sourceId = Reflect.getOwnPropertyDescriptor(sourceDescriptor.value as object, 'nodeId');
		const targetId = Reflect.getOwnPropertyDescriptor(targetDescriptor.value as object, 'nodeId');
		if (
			sourceId === undefined ||
			!('value' in sourceId) ||
			typeof sourceId.value !== 'string' ||
			targetId === undefined ||
			!('value' in targetId) ||
			typeof targetId.value !== 'string'
		)
			return null;
		edges.push({
			id: idDescriptor.value as AdjacencyProjection['edges'][number]['id'],
			source: sourceId.value as AdjacencyProjection['edges'][number]['source'],
			target: targetId.value as AdjacencyProjection['edges'][number]['target']
		});
	}
	return edges;
}

function projectedUpstreamClosure(
	graph: StructuralSccAnalysisInputs['graph']
): AdjacencyProjection['upstreamClosure'] | null {
	const coverageDescriptor = Reflect.getOwnPropertyDescriptor(graph, 'coverage');
	if (
		coverageDescriptor === undefined ||
		!('value' in coverageDescriptor) ||
		!dataObject(coverageDescriptor.value)
	)
		return null;
	const closureDescriptor = Reflect.getOwnPropertyDescriptor(coverageDescriptor.value, 'closure');
	if (
		closureDescriptor === undefined ||
		!('value' in closureDescriptor) ||
		(closureDescriptor.value !== 'CLOSED' && closureDescriptor.value !== 'OPEN')
	)
		return null;
	return closureDescriptor.value;
}

function adjacencyProjection(inputs: StructuralSccAnalysisInputs): AdjacencyProjectionResult {
	const nodeLength = arrayLength(inputs.graph.nodes);
	const edgeLength = arrayLength(inputs.graph.edges);
	if (nodeLength === null || edgeLength === null) return { state: 'INVALID' };
	if (
		nodeLength > inputs.request.budgets.maxNodes ||
		edgeLength > inputs.request.budgets.maxEdges ||
		nodeLength + edgeLength > inputs.request.budgets.maxTraversalSteps
	)
		return { state: 'BUDGET_EXCEEDED' };
	const nodeIds = projectedNodeIds(inputs.graph.nodes, nodeLength);
	if (nodeIds === null) return { state: 'INVALID' };
	const edges = projectedEdges(inputs.graph.edges, edgeLength);
	if (edges === null) return { state: 'INVALID' };
	const upstreamClosure = projectedUpstreamClosure(inputs.graph);
	if (upstreamClosure === null) return { state: 'INVALID' };
	return {
		projection: {
			edges: edges.map((edge) => Object.freeze({ ...edge })),
			nodeIds: [...nodeIds].sort(compareText),
			upstreamClosure
		},
		state: 'VALID'
	};
}

function essentialInputShell(value: unknown): StructuralSccAnalysisInputs | null {
	if (!exactRecord(value, ['graph', 'request', 'semanticSnapshot'])) return null;
	const graph = Reflect.getOwnPropertyDescriptor(value, 'graph');
	const request = Reflect.getOwnPropertyDescriptor(value, 'request');
	const snapshot = Reflect.getOwnPropertyDescriptor(value, 'semanticSnapshot');
	if (
		graph === undefined ||
		!('value' in graph) ||
		request === undefined ||
		!('value' in request) ||
		snapshot === undefined ||
		!('value' in snapshot) ||
		!exactDataShell(graph.value, [
			'contentDigest',
			'coverage',
			'edges',
			'graphInputDigest',
			'id',
			'nodes',
			'semanticSnapshotId',
			'subjectId'
		]) ||
		!exactDataShell(snapshot.value, ['extractionVersion', 'id', 'schemaVersion', 'subjectId'])
	)
		return null;
	return {
		graph: graph.value as StructuralSccAnalysisInputs['graph'],
		request: request.value as StructuralSccAnalysisInputs['request'],
		semanticSnapshot: snapshot.value as StructuralSccAnalysisInputs['semanticSnapshot']
	};
}

function exactDataShell(value: unknown, requiredKeys: readonly string[]): boolean {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxy(value) ||
		Object.getPrototypeOf(value) !== Object.prototype
	)
		return false;
	return requiredKeys.every((key) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		return descriptor !== undefined && 'value' in descriptor;
	});
}

const CONSUMED_SEMANTIC_KEYS = [
	'astNodes',
	'capabilities',
	'expectedEmpty',
	'extractionVersion',
	'health',
	'id',
	'moduleResolutions',
	'provenances',
	'provider',
	'schemaVersion',
	'sources',
	'subjectId'
] as const;

type ConsumedItem =
	| { readonly kind: 'LEAVE'; readonly value: object }
	| { readonly kind: 'VISIT'; readonly value: unknown };

type ConsumedExpansion = 'BUDGET_EXCEEDED' | 'INVALID' | 'VALID';

type ConsumedVisit =
	| { readonly characters: number; readonly state: 'VALID' }
	| { readonly state: 'BUDGET_EXCEEDED' | 'INVALID' };

function expandConsumedArray(
	value: readonly unknown[],
	records: number,
	maxInputRecords: number,
	pending: ConsumedItem[]
): ConsumedExpansion {
	if (Object.getPrototypeOf(value) !== Array.prototype) return 'INVALID';
	const length = arrayLength(value);
	if (length === null) return 'INVALID';
	if (records + length > maxInputRecords) return 'BUDGET_EXCEEDED';
	const keys = Reflect.ownKeys(value);
	if (keys.length !== length + 1) return 'INVALID';
	if (keys.some((key) => typeof key === 'symbol')) return 'INVALID';
	for (let index = length - 1; index >= 0; index -= 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			return 'INVALID';
		pending.push({ kind: 'VISIT', value: descriptor.value });
	}
	return 'VALID';
}

function expandConsumedObject(
	value: object,
	records: number,
	maxInputRecords: number,
	pending: ConsumedItem[]
): ConsumedExpansion {
	if (Object.getPrototypeOf(value) !== Object.prototype) return 'INVALID';
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== 'string')) return 'INVALID';
	if (records + keys.length > maxInputRecords) return 'BUDGET_EXCEEDED';
	for (const key of keys) {
		if (typeof key !== 'string') return 'INVALID';
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			return 'INVALID';
		pending.push({ kind: 'VISIT', value: descriptor.value });
	}
	return 'VALID';
}

function visitConsumedValue(
	value: unknown,
	records: number,
	characters: number,
	budgets: StructuralSccAnalysisBudgets,
	active: WeakSet<object>,
	pending: ConsumedItem[]
): ConsumedVisit {
	if (typeof value === 'string') {
		if (!isUnicodeScalarString(value)) return { state: 'INVALID' };
		const total = characters + value.length;
		if (total > budgets.maxInputStringCharacters) return { state: 'BUDGET_EXCEEDED' };
		return { characters: total, state: 'VALID' };
	}
	if (
		value === null ||
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0))
	)
		return { characters, state: 'VALID' };
	if (typeof value !== 'object' || isProxy(value)) return { state: 'INVALID' };
	if (active.has(value)) return { state: 'INVALID' };
	active.add(value);
	pending.push({ kind: 'LEAVE', value });
	const expansion = Array.isArray(value)
		? expandConsumedArray(value, records, budgets.maxInputRecords, pending)
		: expandConsumedObject(value, records, budgets.maxInputRecords, pending);
	if (expansion !== 'VALID') return { state: expansion };
	return { characters, state: 'VALID' };
}

function consumedInputBudgetState(
	inputs: StructuralSccAnalysisInputs,
	request: StructuralSccAnalysisRequest
): 'BUDGET_EXCEEDED' | 'INVALID' | 'VALID' {
	const semanticProjection: Record<string, unknown> = {};
	for (const key of CONSUMED_SEMANTIC_KEYS) {
		const descriptor = Reflect.getOwnPropertyDescriptor(inputs.semanticSnapshot, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			return 'INVALID';
		semanticProjection[key] = descriptor.value;
	}
	const pending: ConsumedItem[] = [
		{
			kind: 'VISIT',
			value: { graph: inputs.graph, request, semanticSnapshot: semanticProjection }
		}
	];
	const active = new WeakSet<object>();
	let records = 0;
	let characters = 0;
	while (pending.length > 0) {
		const item = pending.pop()!;
		if (item.kind === 'LEAVE') {
			active.delete(item.value);
			continue;
		}
		records += 1;
		if (records > request.budgets.maxInputRecords) return 'BUDGET_EXCEEDED';
		const visit = visitConsumedValue(
			item.value,
			records,
			characters,
			request.budgets,
			active,
			pending
		);
		if (visit.state !== 'VALID') return visit.state;
		characters = visit.characters;
	}
	return 'VALID';
}

interface TarjanFrame {
	nodeId: string;
	nextNeighbor: number;
	parent: string | null;
}

interface TarjanTraversal {
	readonly active: string[];
	readonly adjacency: ReadonlyMap<string, string[]>;
	readonly indexByNode: Map<string, number>;
	readonly lowByNode: Map<string, number>;
	readonly onActive: Set<string>;
}

function tarjanAdjacency(projection: AdjacencyProjection): Map<string, string[]> {
	const adjacency = new Map<string, string[]>(
		projection.nodeIds.map((nodeId) => [nodeId, [] as string[]])
	);
	for (const edge of projection.edges) adjacency.get(edge.source)?.push(edge.target);
	for (const neighbors of adjacency.values()) neighbors.sort(compareText);
	return adjacency;
}

function enterTarjanNode(nodeId: string, nextIndex: number, traversal: TarjanTraversal): number {
	if (traversal.indexByNode.has(nodeId)) return nextIndex;
	traversal.indexByNode.set(nodeId, nextIndex);
	traversal.lowByNode.set(nodeId, nextIndex);
	traversal.active.push(nodeId);
	traversal.onActive.add(nodeId);
	return nextIndex + 1;
}

function advanceTarjanNeighbor(
	frame: TarjanFrame,
	neighbors: readonly string[],
	frames: TarjanFrame[],
	traversal: TarjanTraversal
): void {
	const neighbor = neighbors[frame.nextNeighbor++]!;
	if (!traversal.indexByNode.has(neighbor)) {
		frames.push({ nodeId: neighbor, nextNeighbor: 0, parent: frame.nodeId });
		return;
	}
	if (traversal.onActive.has(neighbor))
		traversal.lowByNode.set(
			frame.nodeId,
			Math.min(traversal.lowByNode.get(frame.nodeId)!, traversal.indexByNode.get(neighbor)!)
		);
}

function popTarjanComponent(rootNodeId: string, traversal: TarjanTraversal): string[] {
	const component: string[] = [];
	while (traversal.active.length > 0) {
		const member = traversal.active.pop()!;
		traversal.onActive.delete(member);
		component.push(member);
		if (member === rootNodeId) break;
	}
	component.sort(compareText);
	return component;
}

function finishTarjanFrame(
	frame: TarjanFrame,
	frames: TarjanFrame[],
	components: string[][],
	traversal: TarjanTraversal
): void {
	frames.pop();
	if (frame.parent !== null)
		traversal.lowByNode.set(
			frame.parent,
			Math.min(traversal.lowByNode.get(frame.parent)!, traversal.lowByNode.get(frame.nodeId)!)
		);
	if (traversal.lowByNode.get(frame.nodeId) === traversal.indexByNode.get(frame.nodeId))
		components.push(popTarjanComponent(frame.nodeId, traversal));
}

function tarjan(projection: AdjacencyProjection): readonly (readonly string[])[] {
	const traversal: TarjanTraversal = {
		active: [],
		adjacency: tarjanAdjacency(projection),
		indexByNode: new Map<string, number>(),
		lowByNode: new Map<string, number>(),
		onActive: new Set<string>()
	};
	const components: string[][] = [];
	let nextIndex = 0;
	for (const root of projection.nodeIds) {
		if (traversal.indexByNode.has(root)) continue;
		const frames: TarjanFrame[] = [{ nodeId: root, nextNeighbor: 0, parent: null }];
		while (frames.length > 0) {
			const frame = frames.at(-1)!;
			nextIndex = enterTarjanNode(frame.nodeId, nextIndex, traversal);
			const neighbors = traversal.adjacency.get(frame.nodeId)!;
			if (frame.nextNeighbor < neighbors.length)
				advanceTarjanNeighbor(frame, neighbors, frames, traversal);
			else finishTarjanFrame(frame, frames, components, traversal);
		}
	}
	return components.sort((left, right) => compareText(left.join('\0'), right.join('\0')));
}

function componentCycleKind(
	nodeIds: readonly string[],
	id: StructuralSccComponent['id'],
	selfLoopComponents: ReadonlySet<StructuralSccComponent['id']>
): StructuralSccComponent['cycleKind'] {
	if (nodeIds.length > 1) return 'MULTI_NODE';
	if (selfLoopComponents.has(id)) return 'SELF_LOOP_SINGLETON';
	return 'ACYCLIC_SINGLETON';
}

function materialize(
	inputs: StructuralSccAnalysisInputs,
	request: StructuralSccAnalysisRequest,
	projection: AdjacencyProjection
): StructuralSccAnalysisSnapshot | null {
	const inputDigest = structuralSccAnalysisInputDigest({ ...inputs, request });
	const analysisId = structuralSccAnalysisId({
		inputDigest,
		semanticSnapshotId: request.semanticSnapshotId,
		subjectId: request.subjectId
	});
	const nodeGroups = tarjan(projection);
	if (nodeGroups.length > request.budgets.maxComponents) return null;
	const componentIdByNode = new Map<string, ReturnType<typeof structuralSccComponentId>>();
	const componentIds = nodeGroups.map((nodeIds) => structuralSccComponentId(analysisId, nodeIds));
	for (const [index, nodeIds] of nodeGroups.entries())
		for (const nodeId of nodeIds) componentIdByNode.set(nodeId, componentIds[index]!);
	const internalEdgeIdsByComponent = new Map(
		componentIds.map((componentId) => [
			componentId,
			[] as AdjacencyProjection['edges'][number]['id'][]
		])
	);
	const selfLoopComponents = new Set<(typeof componentIds)[number]>();
	const incidentNodes = new Set<string>();
	let internalEdges = 0;
	for (const edge of projection.edges) {
		incidentNodes.add(edge.source);
		incidentNodes.add(edge.target);
		const sourceComponent = componentIdByNode.get(edge.source)!;
		if (sourceComponent !== componentIdByNode.get(edge.target)) continue;
		internalEdgeIdsByComponent.get(sourceComponent)!.push(edge.id);
		internalEdges += 1;
		if (edge.source === edge.target) selfLoopComponents.add(sourceComponent);
	}
	const components: StructuralSccComponent[] = nodeGroups.map((nodeIds, ordinal) => {
		const id = componentIds[ordinal]!;
		const internalEdgeIds = internalEdgeIdsByComponent.get(id)!.sort(compareText);
		return {
			cycleKind: componentCycleKind(nodeIds, id, selfLoopComponents),
			id,
			internalEdgeIds,
			nodeIds: nodeIds as StructuralSccComponent['nodeIds'],
			ordinal
		};
	});
	const componentIndex: StructuralSccComponentIndexEntry[] = projection.nodeIds.map((nodeId) => ({
		componentId: componentIdByNode.get(nodeId)!,
		nodeId
	}));
	const layerId = structuralSccLayerId(analysisId);
	const withoutDigest = {
		authorityTransfer: STRUCTURAL_SCC_ANALYSIS_AUTHORITY_TRANSFER,
		budgets: { ...request.budgets },
		canonicalProfile: STRUCTURAL_SCC_ANALYSIS_CANONICAL_PROFILE,
		capability: STRUCTURAL_SCC_ANALYSIS_CAPABILITY,
		capabilityStatus: STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS,
		componentIndex,
		components,
		coverage: {
			chargedTraversalSteps: projection.nodeIds.length + projection.edges.length,
			components: components.length,
			crossComponentEdges: projection.edges.length - internalEdges,
			cyclicComponents: components.filter(
				(component) => component.cycleKind !== 'ACYCLIC_SINGLETON'
			).length,
			edgeAccountingReconciles:
				internalEdges + (projection.edges.length - internalEdges) === projection.edges.length,
			inputEdges: projection.edges.length,
			inputNodes: projection.nodeIds.length,
			internalEdges,
			isolatedSingletons: components.filter(
				(component) => component.nodeIds.length === 1 && !incidentNodes.has(component.nodeIds[0]!)
			).length,
			multiNodeComponents: components.filter((component) => component.cycleKind === 'MULTI_NODE')
				.length,
			partitionReconciles:
				new Set(components.flatMap((component) => component.nodeIds)).size ===
				projection.nodeIds.length,
			selfLoopSingletons: components.filter(
				(component) => component.cycleKind === 'SELF_LOOP_SINGLETON'
			).length
		},
		fullJanCsaa007Conformance: 'NOT_CLAIMED' as const,
		fullJanCsaa008Conformance: 'NOT_CLAIMED' as const,
		gateEffect: STRUCTURAL_SCC_ANALYSIS_GATE_EFFECT,
		graphAuthority: 'NONE' as const,
		health: 'PARTIAL' as const,
		id: analysisId,
		inputDigest,
		layers: [
			{
				analysisId,
				capability: STRUCTURAL_SCC_ANALYSIS_CAPABILITY,
				capabilityStatus: STRUCTURAL_SCC_ANALYSIS_CAPABILITY_STATUS,
				componentIds: components.map((component) => component.id),
				id: layerId,
				kind: 'STRUCTURAL_STRONG_CONNECTIVITY' as const,
				ordinal: 0 as const,
				sourceGraph: { ...request.sourceGraph }
			}
		] as const,
		method: STRUCTURAL_SCC_ANALYSIS_METHOD,
		nonclaims: STRUCTURAL_SCC_ANALYSIS_NONCLAIMS,
		operationVersion: STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_SCC_ANALYSIS_SCHEMA_VERSION,
		selection: { ...STRUCTURAL_SCC_ANALYSIS_SELECTION },
		semanticSnapshotId: request.semanticSnapshotId,
		sourceGraph: { ...request.sourceGraph },
		structuralClosure: 'EXACT_FOR_SELECTED_VALIDATED_GRAPH' as const,
		subjectId: request.subjectId,
		upstreamClosure: projection.upstreamClosure
	};
	return {
		...withoutDigest,
		contentDigest: structuralSccAnalysisContentDigest(withoutDigest)
	};
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function boundIdentitiesAgree(
	closedInputs: StructuralSccAnalysisInputs,
	request: StructuralSccAnalysisRequest
): boolean {
	return (
		closedInputs.graph.id === request.sourceGraph.graphId &&
		closedInputs.graph.contentDigest === request.sourceGraph.contentDigest &&
		closedInputs.graph.graphInputDigest === request.sourceGraph.graphInputDigest &&
		closedInputs.graph.subjectId === request.subjectId &&
		closedInputs.graph.semanticSnapshotId === request.semanticSnapshotId &&
		closedInputs.semanticSnapshot.id === request.semanticSnapshotId &&
		closedInputs.semanticSnapshot.subjectId === request.subjectId
	);
}

function consumedInputUnavailable(
	state: 'BUDGET_EXCEEDED' | 'INVALID'
): StructuralSccAnalysisOutcome {
	if (state === 'BUDGET_EXCEEDED')
		return unavailable(
			'BUDGET_EXCEEDED',
			'The consumed predecessor projection exceeds an input budget.',
			'BIND'
		);
	return unavailable(
		'SOURCE_GRAPH_INVALID',
		'The consumed predecessor projection is not safe plain data.',
		'BIND'
	);
}

function adjacencyProjectionUnavailable(
	state: 'BUDGET_EXCEEDED' | 'INVALID'
): StructuralSccAnalysisOutcome {
	if (state === 'BUDGET_EXCEEDED')
		return unavailable(
			'BUDGET_EXCEEDED',
			'The graph population exceeds a node, edge, or traversal budget.',
			'BIND'
		);
	return unavailable(
		'SOURCE_GRAPH_INVALID',
		'The source graph does not expose a valid node and edge projection.',
		'BIND'
	);
}

function analysisValidationUnavailable(
	state: 'BUDGET_EXHAUSTED' | 'INVALID'
): StructuralSccAnalysisOutcome {
	if (state === 'BUDGET_EXHAUSTED')
		return unavailable(
			'BUDGET_EXCEEDED',
			'Independent validation exhausted a construction budget.',
			'BIND'
		);
	return unavailable(
		'ANALYSIS_VALIDATION_FAILED',
		'The constructed SCC analysis failed independent validation.',
		'VALIDATE'
	);
}

function buildStructuralSccAnalysisInternal(
	inputs: StructuralSccAnalysisInputs
): StructuralSccAnalysisOutcome {
	const closedInputs = essentialInputShell(inputs);
	if (closedInputs === null)
		return unavailable(
			'REQUEST_INVALID',
			'The SCC input shell must contain exact data properties.',
			'REQUEST'
		);
	let request: StructuralSccAnalysisRequest;
	try {
		request = materializeRequest(closedInputs.request);
	} catch (error) {
		return unavailable('REQUEST_INVALID', errorMessage(error), 'REQUEST');
	}
	if (!boundIdentitiesAgree(closedInputs, request))
		return unavailable(
			'INPUT_IDENTITY_MISMATCH',
			'The request, graph, and semantic snapshot identities differ.',
			'BIND'
		);
	const boundInputs = { ...closedInputs, request };
	const inputBudgetState = consumedInputBudgetState(boundInputs, request);
	if (inputBudgetState !== 'VALID') return consumedInputUnavailable(inputBudgetState);
	const projectionResult = adjacencyProjection(boundInputs);
	if (projectionResult.state !== 'VALID')
		return adjacencyProjectionUnavailable(projectionResult.state);
	const projection = projectionResult.projection;
	const requiredSteps = projection.nodeIds.length + projection.edges.length;
	let graphValidation: ReturnType<typeof validateModuleDependencyGraph>;
	try {
		graphValidation = validateModuleDependencyGraph(
			boundInputs.graph,
			boundInputs.semanticSnapshot,
			{ maxIssues: request.budgets.maxDiagnostics }
		);
	} catch {
		return unavailable(
			'SOURCE_GRAPH_INVALID',
			'The source graph could not be validated safely.',
			'BIND'
		);
	}
	if (graphValidation.state !== 'VALID')
		return unavailable(
			'SOURCE_GRAPH_INVALID',
			'The source graph is not independently valid.',
			'BIND'
		);
	const analysis = materialize(boundInputs, request, projection);
	if (analysis === null)
		return unavailable(
			'BUDGET_EXCEEDED',
			'The component population exceeds maxComponents.',
			'TRAVERSE'
		);
	const validation = validateConstructedStructuralSccAnalysis(analysis, boundInputs, {
		maxDepth: 64,
		maxInputRecords: request.budgets.maxInputRecords,
		maxInputStringCharacters: request.budgets.maxInputStringCharacters,
		maxIssues: request.budgets.maxDiagnostics,
		maxRecords: Math.max(128, requiredSteps * 32 + analysis.components.length * 8),
		maxStringCharacters: Math.max(4_096, requiredSteps * 4_096)
	});
	if (validation.state !== 'VALID') return analysisValidationUnavailable(validation.state);
	return deepFreeze({ analysis, diagnostics: [], outcome: 'partial' });
}

export function buildStructuralSccAnalysis(
	inputs: StructuralSccAnalysisInputs
): StructuralSccAnalysisOutcome {
	try {
		return buildStructuralSccAnalysisInternal(inputs);
	} catch {
		return unavailable(
			'SOURCE_GRAPH_INVALID',
			'The SCC inputs could not be inspected safely.',
			'BIND'
		);
	}
}
