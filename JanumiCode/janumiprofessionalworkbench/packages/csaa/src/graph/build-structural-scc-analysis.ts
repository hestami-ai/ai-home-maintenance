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
	const nodeIds: StructuralSccAnalysisInputs['graph']['nodes'][number]['id'][] = [];
	for (let index = 0; index < nodeLength; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(inputs.graph.nodes, String(index));
		if (descriptor === undefined || !('value' in descriptor) || !dataObject(descriptor.value))
			return { state: 'INVALID' };
		const node =
			descriptor.value as unknown as StructuralSccAnalysisInputs['graph']['nodes'][number];
		const idDescriptor = Reflect.getOwnPropertyDescriptor(node, 'id');
		if (
			idDescriptor === undefined ||
			!('value' in idDescriptor) ||
			typeof idDescriptor.value !== 'string'
		)
			return { state: 'INVALID' };
		nodeIds.push(idDescriptor.value as (typeof nodeIds)[number]);
	}
	const edges: AdjacencyProjection['edges'][number][] = [];
	for (let index = 0; index < edgeLength; index += 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(inputs.graph.edges, String(index));
		if (descriptor === undefined || !('value' in descriptor) || !dataObject(descriptor.value))
			return { state: 'INVALID' };
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
			return { state: 'INVALID' };
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
			return { state: 'INVALID' };
		edges.push({
			id: idDescriptor.value as AdjacencyProjection['edges'][number]['id'],
			source: sourceId.value as AdjacencyProjection['edges'][number]['source'],
			target: targetId.value as AdjacencyProjection['edges'][number]['target']
		});
	}
	const coverageDescriptor = Reflect.getOwnPropertyDescriptor(inputs.graph, 'coverage');
	if (
		coverageDescriptor === undefined ||
		!('value' in coverageDescriptor) ||
		!dataObject(coverageDescriptor.value)
	)
		return { state: 'INVALID' };
	const closureDescriptor = Reflect.getOwnPropertyDescriptor(coverageDescriptor.value, 'closure');
	if (
		closureDescriptor === undefined ||
		!('value' in closureDescriptor) ||
		(closureDescriptor.value !== 'CLOSED' && closureDescriptor.value !== 'OPEN')
	)
		return { state: 'INVALID' };
	return {
		projection: {
			edges: edges.map((edge) => Object.freeze({ ...edge })),
			nodeIds: [...nodeIds].sort(compareText),
			upstreamClosure: closureDescriptor.value
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
	type Item =
		| { readonly kind: 'LEAVE'; readonly value: object }
		| { readonly kind: 'VISIT'; readonly value: unknown };
	const pending: Item[] = [
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
		if (typeof item.value === 'string') {
			if (!isUnicodeScalarString(item.value)) return 'INVALID';
			characters += item.value.length;
			if (characters > request.budgets.maxInputStringCharacters) return 'BUDGET_EXCEEDED';
			continue;
		}
		if (
			item.value === null ||
			typeof item.value === 'boolean' ||
			(typeof item.value === 'number' &&
				Number.isSafeInteger(item.value) &&
				!Object.is(item.value, -0))
		)
			continue;
		if (typeof item.value !== 'object' || isProxy(item.value)) return 'INVALID';
		if (active.has(item.value)) return 'INVALID';
		active.add(item.value);
		pending.push({ kind: 'LEAVE', value: item.value });
		if (Array.isArray(item.value)) {
			if (Object.getPrototypeOf(item.value) !== Array.prototype) return 'INVALID';
			const length = arrayLength(item.value);
			if (length === null) return 'INVALID';
			if (records + length > request.budgets.maxInputRecords) return 'BUDGET_EXCEEDED';
			const keys = Reflect.ownKeys(item.value);
			if (keys.length !== length + 1 || keys.some((key) => typeof key === 'symbol'))
				return 'INVALID';
			for (let index = length - 1; index >= 0; index -= 1) {
				const descriptor = Reflect.getOwnPropertyDescriptor(item.value, String(index));
				if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
					return 'INVALID';
				pending.push({ kind: 'VISIT', value: descriptor.value });
			}
			continue;
		}
		if (Object.getPrototypeOf(item.value) !== Object.prototype) return 'INVALID';
		const keys = Reflect.ownKeys(item.value);
		if (keys.some((key) => typeof key !== 'string')) return 'INVALID';
		if (records + keys.length > request.budgets.maxInputRecords) return 'BUDGET_EXCEEDED';
		for (const key of keys) {
			if (typeof key !== 'string') return 'INVALID';
			const descriptor = Reflect.getOwnPropertyDescriptor(item.value, key);
			if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
				return 'INVALID';
			pending.push({ kind: 'VISIT', value: descriptor.value });
		}
	}
	return 'VALID';
}

function tarjan(projection: AdjacencyProjection): readonly (readonly string[])[] {
	const adjacency = new Map<string, string[]>(
		projection.nodeIds.map((nodeId) => [nodeId, [] as string[]])
	);
	for (const edge of projection.edges) adjacency.get(edge.source)?.push(edge.target);
	for (const neighbors of adjacency.values()) neighbors.sort(compareText);
	const indexByNode = new Map<string, number>();
	const lowByNode = new Map<string, number>();
	const active: string[] = [];
	const onActive = new Set<string>();
	const components: string[][] = [];
	let nextIndex = 0;
	type Frame = { nodeId: string; nextNeighbor: number; parent: string | null };
	for (const root of projection.nodeIds) {
		if (indexByNode.has(root)) continue;
		const frames: Frame[] = [{ nodeId: root, nextNeighbor: 0, parent: null }];
		while (frames.length > 0) {
			const frame = frames[frames.length - 1]!;
			if (!indexByNode.has(frame.nodeId)) {
				indexByNode.set(frame.nodeId, nextIndex);
				lowByNode.set(frame.nodeId, nextIndex);
				nextIndex += 1;
				active.push(frame.nodeId);
				onActive.add(frame.nodeId);
			}
			const neighbors = adjacency.get(frame.nodeId)!;
			if (frame.nextNeighbor < neighbors.length) {
				const neighbor = neighbors[frame.nextNeighbor++]!;
				if (!indexByNode.has(neighbor)) {
					frames.push({ nodeId: neighbor, nextNeighbor: 0, parent: frame.nodeId });
					continue;
				}
				if (onActive.has(neighbor))
					lowByNode.set(
						frame.nodeId,
						Math.min(lowByNode.get(frame.nodeId)!, indexByNode.get(neighbor)!)
					);
				continue;
			}
			frames.pop();
			if (frame.parent !== null)
				lowByNode.set(
					frame.parent,
					Math.min(lowByNode.get(frame.parent)!, lowByNode.get(frame.nodeId)!)
				);
			if (lowByNode.get(frame.nodeId) === indexByNode.get(frame.nodeId)) {
				const component: string[] = [];
				while (active.length > 0) {
					const member = active.pop()!;
					onActive.delete(member);
					component.push(member);
					if (member === frame.nodeId) break;
				}
				components.push(component.sort(compareText));
			}
		}
	}
	return components.sort((left, right) => compareText(left.join('\0'), right.join('\0')));
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
			cycleKind:
				nodeIds.length > 1
					? 'MULTI_NODE'
					: selfLoopComponents.has(id)
						? 'SELF_LOOP_SINGLETON'
						: 'ACYCLIC_SINGLETON',
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
		return unavailable(
			'REQUEST_INVALID',
			error instanceof Error ? error.message : String(error),
			'REQUEST'
		);
	}
	if (
		closedInputs.graph.id !== request.sourceGraph.graphId ||
		closedInputs.graph.contentDigest !== request.sourceGraph.contentDigest ||
		closedInputs.graph.graphInputDigest !== request.sourceGraph.graphInputDigest ||
		closedInputs.graph.subjectId !== request.subjectId ||
		closedInputs.graph.semanticSnapshotId !== request.semanticSnapshotId ||
		closedInputs.semanticSnapshot.id !== request.semanticSnapshotId ||
		closedInputs.semanticSnapshot.subjectId !== request.subjectId
	)
		return unavailable(
			'INPUT_IDENTITY_MISMATCH',
			'The request, graph, and semantic snapshot identities differ.',
			'BIND'
		);
	const boundInputs = { ...closedInputs, request };
	const inputBudgetState = consumedInputBudgetState(boundInputs, request);
	if (inputBudgetState !== 'VALID')
		return unavailable(
			inputBudgetState === 'BUDGET_EXCEEDED' ? 'BUDGET_EXCEEDED' : 'SOURCE_GRAPH_INVALID',
			inputBudgetState === 'BUDGET_EXCEEDED'
				? 'The consumed predecessor projection exceeds an input budget.'
				: 'The consumed predecessor projection is not safe plain data.',
			'BIND'
		);
	const projectionResult = adjacencyProjection(boundInputs);
	if (projectionResult.state !== 'VALID')
		return unavailable(
			projectionResult.state === 'BUDGET_EXCEEDED' ? 'BUDGET_EXCEEDED' : 'SOURCE_GRAPH_INVALID',
			projectionResult.state === 'BUDGET_EXCEEDED'
				? 'The graph population exceeds a node, edge, or traversal budget.'
				: 'The source graph does not expose a valid node and edge projection.',
			'BIND'
		);
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
	if (validation.state !== 'VALID')
		return unavailable(
			validation.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'ANALYSIS_VALIDATION_FAILED',
			validation.state === 'BUDGET_EXHAUSTED'
				? 'Independent validation exhausted a construction budget.'
				: 'The constructed SCC analysis failed independent validation.',
			validation.state === 'BUDGET_EXHAUSTED' ? 'BIND' : 'VALIDATE'
		);
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
