import {
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CANONICAL_PROFILE,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY_STATUS,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_METHOD,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION,
	STRUCTURAL_MODULE_REACHABILITY_TERMINAL_FRONTIER_REASON,
	type StructuralModuleReachabilityAnalysisBuildOutcome,
	type StructuralModuleReachabilityAnalysisInputs,
	type StructuralModuleReachabilityAnalysisRequest,
	type StructuralModuleReachabilityAnalysisSnapshot,
	type StructuralModuleReachabilityDiagnostic,
	type StructuralModuleReachabilityEncounteredFrontier,
	type StructuralModuleReachabilityMember
} from '../contracts/structural-module-reachability-analysis.js';
import { compareText } from '../inventory/canonical.js';
import { isProxyValue, isUnicodeScalarString } from '../semantic/canonical.js';
import {
	structuralModuleReachabilityAnalysisContentDigest,
	structuralModuleReachabilityAnalysisId,
	structuralModuleReachabilityAnalysisInputDigest,
	structuralModuleReachabilityFrontierId,
	structuralModuleReachabilityLayerId,
	structuralModuleReachabilityMemberId
} from './structural-module-reachability-analysis-canonical.js';
import { validateModuleDependencyGraph } from './validate-graph.js';
import { validateConstructedStructuralModuleReachabilityAnalysis } from './validate-structural-module-reachability-analysis.js';

const REQUEST_KEYS = [
	'budgets',
	'criterion',
	'direction',
	'operationVersion',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'sourceGraph',
	'subjectId'
] as const;
const BUDGET_KEYS = [
	'maxDiagnostics',
	'maxEdges',
	'maxFrontierRecords',
	'maxInputRecords',
	'maxInputStringCharacters',
	'maxNodes',
	'maxReachableNodes',
	'maxTraversalSteps',
	'maxWitnessEdges'
] as const;
const CRITERION_KEYS = ['nodeId'] as const;
const SOURCE_GRAPH_KEYS = ['contentDigest', 'graphId', 'graphInputDigest', 'graphKind'] as const;
const SELECTION_KEYS = [
	'edgePopulation',
	'nodePopulation',
	'parallelEdges',
	'witnessPolicy'
] as const;
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

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxyValue(value) ||
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

function exactDataShell(
	value: unknown,
	requiredKeys: readonly string[]
): value is Record<PropertyKey, unknown> {
	if (
		value === null ||
		typeof value !== 'object' ||
		isProxyValue(value) ||
		Object.getPrototypeOf(value) !== Object.prototype
	)
		return false;
	return requiredKeys.every((key) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		return descriptor !== undefined && 'value' in descriptor;
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

function materializeRequest(value: unknown): StructuralModuleReachabilityAnalysisRequest {
	if (!exactRecord(value, REQUEST_KEYS))
		throw new TypeError('The structural module reachability request must be exact.');
	if (!exactRecord(value.budgets, BUDGET_KEYS))
		throw new TypeError('The structural module reachability budgets must be exact.');
	if (!exactRecord(value.criterion, CRITERION_KEYS))
		throw new TypeError('The structural module reachability criterion must be exact.');
	if (!exactRecord(value.sourceGraph, SOURCE_GRAPH_KEYS))
		throw new TypeError('The structural module reachability source-graph reference must be exact.');
	if (!exactRecord(value.selection, SELECTION_KEYS))
		throw new TypeError('The structural module reachability selection must be exact.');
	const budgets = value.budgets;
	if (
		!safeInteger(budgets.maxDiagnostics, true) ||
		budgets.maxDiagnostics > 100_000 ||
		!safeInteger(budgets.maxEdges) ||
		!safeInteger(budgets.maxFrontierRecords) ||
		!safeInteger(budgets.maxInputRecords, true) ||
		!safeInteger(budgets.maxInputStringCharacters, true) ||
		!safeInteger(budgets.maxNodes) ||
		!safeInteger(budgets.maxReachableNodes) ||
		!safeInteger(budgets.maxTraversalSteps) ||
		!safeInteger(budgets.maxWitnessEdges)
	)
		throw new TypeError(
			'The structural module reachability budgets must be nonnegative safe integers; maxDiagnostics, maxInputRecords, and maxInputStringCharacters are positive.'
		);
	if (
		value.operationVersion !== STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION ||
		value.schemaVersion !== STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION ||
		(value.direction !== 'FORWARD' && value.direction !== 'REVERSE') ||
		typeof value.subjectId !== 'string' ||
		!isUnicodeScalarString(value.subjectId) ||
		value.subjectId.length === 0 ||
		typeof value.semanticSnapshotId !== 'string' ||
		!isUnicodeScalarString(value.semanticSnapshotId) ||
		value.semanticSnapshotId.length === 0 ||
		typeof value.criterion.nodeId !== 'string' ||
		!isUnicodeScalarString(value.criterion.nodeId) ||
		value.criterion.nodeId.length === 0 ||
		value.sourceGraph.graphKind !== 'TYPESCRIPT_MODULE_DEPENDENCY' ||
		![
			value.sourceGraph.graphId,
			value.sourceGraph.contentDigest,
			value.sourceGraph.graphInputDigest
		].every((item) => typeof item === 'string' && isUnicodeScalarString(item) && item.length > 0) ||
		Object.keys(STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION).some(
			(key) =>
				(value.selection as Record<string, unknown>)[key] !==
				STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION[
					key as keyof typeof STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION
				]
		)
	)
		throw new TypeError(
			'The structural module reachability request identity or selection is invalid.'
		);
	return {
		budgets: { ...budgets } as unknown as StructuralModuleReachabilityAnalysisRequest['budgets'],
		criterion: {
			nodeId: value.criterion
				.nodeId as StructuralModuleReachabilityAnalysisRequest['criterion']['nodeId']
		},
		direction: value.direction,
		operationVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION,
		selection: { ...STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION },
		semanticSnapshotId:
			value.semanticSnapshotId as StructuralModuleReachabilityAnalysisRequest['semanticSnapshotId'],
		sourceGraph: {
			contentDigest: value.sourceGraph.contentDigest as string,
			graphId: value.sourceGraph
				.graphId as StructuralModuleReachabilityAnalysisRequest['sourceGraph']['graphId'],
			graphInputDigest: value.sourceGraph.graphInputDigest as string,
			graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY'
		},
		subjectId: value.subjectId
	};
}

function unavailable(
	code: StructuralModuleReachabilityDiagnostic['code'],
	message: string,
	phase: StructuralModuleReachabilityDiagnostic['phase'],
	path: string | null = null
): StructuralModuleReachabilityAnalysisBuildOutcome {
	return deepFreeze({ diagnostics: [{ code, message, path, phase }], outcome: 'unavailable' });
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

function arrayLength(value: unknown): number | null {
	if (
		isProxyValue(value) ||
		!Array.isArray(value) ||
		Object.getPrototypeOf(value) !== Array.prototype
	)
		return null;
	const descriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	return descriptor !== undefined && 'value' in descriptor && safeInteger(descriptor.value)
		? descriptor.value
		: null;
}

function essentialInputShell(value: unknown): StructuralModuleReachabilityAnalysisInputs | null {
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
			'limitations',
			'nodes',
			'semanticSnapshotId',
			'subjectId'
		]) ||
		!exactDataShell(snapshot.value, ['extractionVersion', 'id', 'schemaVersion', 'subjectId'])
	)
		return null;
	return {
		graph: graph.value as unknown as StructuralModuleReachabilityAnalysisInputs['graph'],
		request: request.value as StructuralModuleReachabilityAnalysisInputs['request'],
		semanticSnapshot:
			snapshot.value as unknown as StructuralModuleReachabilityAnalysisInputs['semanticSnapshot']
	};
}

type ConsumedInputItem =
	| { readonly kind: 'LEAVE'; readonly value: object }
	| { readonly kind: 'VISIT'; readonly value: unknown };

function projectConsumedSemanticKeys(
	semanticSnapshot: StructuralModuleReachabilityAnalysisInputs['semanticSnapshot']
): Record<string, unknown> | null {
	const semanticProjection: Record<string, unknown> = {};
	for (const key of CONSUMED_SEMANTIC_KEYS) {
		const descriptor = Reflect.getOwnPropertyDescriptor(semanticSnapshot, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable) return null;
		semanticProjection[key] = descriptor.value;
	}
	return semanticProjection;
}

/** Outcome of one consumed-input admission step. Aliased because five helpers return it. */
type ConsumedInputState = 'BUDGET_EXCEEDED' | 'INVALID' | 'VALID';

function consumedStringState(
	value: string,
	characters: number,
	maxInputStringCharacters: number
): ConsumedInputState {
	if (!isUnicodeScalarString(value)) return 'INVALID';
	if (characters + value.length > maxInputStringCharacters) return 'BUDGET_EXCEEDED';
	return 'VALID';
}

function expandConsumedArray(
	value: unknown[],
	pending: ConsumedInputItem[],
	records: number,
	maxInputRecords: number
): ConsumedInputState {
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
	pending: ConsumedInputItem[],
	records: number,
	maxInputRecords: number
): ConsumedInputState {
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

function visitConsumedComposite(
	value: unknown,
	pending: ConsumedInputItem[],
	active: WeakSet<object>,
	records: number,
	maxInputRecords: number
): ConsumedInputState {
	if (
		value === null ||
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0))
	)
		return 'VALID';
	if (typeof value !== 'object' || isProxyValue(value)) return 'INVALID';
	if (active.has(value)) return 'INVALID';
	active.add(value);
	pending.push({ kind: 'LEAVE', value });
	if (Array.isArray(value)) return expandConsumedArray(value, pending, records, maxInputRecords);
	return expandConsumedObject(value, pending, records, maxInputRecords);
}

function consumedInputBudgetState(
	inputs: StructuralModuleReachabilityAnalysisInputs,
	request: StructuralModuleReachabilityAnalysisRequest
): ConsumedInputState {
	const semanticProjection = projectConsumedSemanticKeys(inputs.semanticSnapshot);
	if (semanticProjection === null) return 'INVALID';
	const pending: ConsumedInputItem[] = [
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
			const stringState = consumedStringState(
				item.value,
				characters,
				request.budgets.maxInputStringCharacters
			);
			if (stringState !== 'VALID') return stringState;
			characters += item.value.length;
			continue;
		}
		const compositeState = visitConsumedComposite(
			item.value,
			pending,
			active,
			records,
			request.budgets.maxInputRecords
		);
		if (compositeState !== 'VALID') return compositeState;
	}
	return 'VALID';
}

interface ProjectedNode {
	readonly id: StructuralModuleReachabilityAnalysisInputs['graph']['nodes'][number]['id'];
	readonly kind: 'RESOLUTION_TARGET' | 'SOURCE';
	readonly moduleResolutionId:
		StructuralModuleReachabilityEncounteredFrontier['moduleResolutionId'] | null;
	readonly resolutionState:
		StructuralModuleReachabilityEncounteredFrontier['resolutionState'] | null;
}

interface ProjectedArc {
	readonly edgeId: StructuralModuleReachabilityAnalysisInputs['graph']['edges'][number]['id'];
	readonly neighborNodeId: StructuralModuleReachabilityAnalysisInputs['graph']['nodes'][number]['id'];
}

interface GraphProjection {
	readonly adjacency: ReadonlyMap<ProjectedNode['id'], readonly ProjectedArc[]>;
	readonly nodes: readonly ProjectedNode[];
	readonly upstreamClosure: 'CLOSED' | 'OPEN';
	readonly upstreamLimitations: StructuralModuleReachabilityAnalysisSnapshot['upstreamLimitations'];
}

function dataDescriptor(value: object, key: PropertyKey): PropertyDescriptor | null {
	const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
	return descriptor !== undefined && 'value' in descriptor ? descriptor : null;
}

interface ProjectedResolutionFacets {
	readonly moduleResolutionId: ProjectedNode['moduleResolutionId'];
	readonly resolutionState: ProjectedNode['resolutionState'];
}

interface OrientedArcEndpoints {
	readonly currentNodeId: ProjectedNode['id'];
	readonly neighborNodeId: ProjectedNode['id'];
}

function projectResolutionFacets(
	record: Record<PropertyKey, unknown>
): ProjectedResolutionFacets | null {
	const moduleResolution = dataDescriptor(record, 'moduleResolutionId')?.value;
	const state = dataDescriptor(record, 'resolutionState')?.value;
	if (
		typeof moduleResolution !== 'string' ||
		(state !== 'RESOLVED_AMBIENT' &&
			state !== 'RESOLVED_EXTERNAL' &&
			state !== 'UNRESOLVED' &&
			state !== 'UNSUPPORTED')
	)
		return null;
	return {
		moduleResolutionId: moduleResolution as ProjectedNode['moduleResolutionId'],
		resolutionState: state
	};
}

function collectProjectedNodes(
	nodeRecords: object,
	nodeLength: number,
	nodes: ProjectedNode[],
	adjacency: Map<ProjectedNode['id'], ProjectedArc[]>
): boolean {
	for (let index = 0; index < nodeLength; index += 1) {
		const record = dataDescriptor(nodeRecords, String(index))?.value;
		if (!exactDataShell(record, ['id', 'kind'])) return false;
		const id = dataDescriptor(record, 'id')?.value;
		const kind = dataDescriptor(record, 'kind')?.value;
		if (typeof id !== 'string') return false;
		if (kind !== 'SOURCE' && kind !== 'RESOLUTION_TARGET') return false;
		let moduleResolutionId: ProjectedNode['moduleResolutionId'] = null;
		let resolutionState: ProjectedNode['resolutionState'] = null;
		if (kind === 'RESOLUTION_TARGET') {
			const facets = projectResolutionFacets(record);
			if (facets === null) return false;
			moduleResolutionId = facets.moduleResolutionId;
			resolutionState = facets.resolutionState;
		}
		nodes.push({
			id: id as ProjectedNode['id'],
			kind,
			moduleResolutionId,
			resolutionState
		});
		adjacency.set(id as ProjectedNode['id'], []);
	}
	return true;
}

function orientedArcEndpoints(
	direction: StructuralModuleReachabilityAnalysisRequest['direction'],
	sourceNodeId: string,
	targetNodeId: string
): OrientedArcEndpoints {
	if (direction === 'FORWARD')
		return {
			currentNodeId: sourceNodeId as ProjectedNode['id'],
			neighborNodeId: targetNodeId as ProjectedNode['id']
		};
	return {
		currentNodeId: targetNodeId as ProjectedNode['id'],
		neighborNodeId: sourceNodeId as ProjectedNode['id']
	};
}

function collectProjectedArcs(
	edgeRecords: object,
	edgeLength: number,
	adjacency: Map<ProjectedNode['id'], ProjectedArc[]>,
	direction: StructuralModuleReachabilityAnalysisRequest['direction']
): boolean {
	for (let index = 0; index < edgeLength; index += 1) {
		const record = dataDescriptor(edgeRecords, String(index))?.value;
		if (!exactDataShell(record, ['id', 'source', 'target'])) return false;
		const edgeId = dataDescriptor(record, 'id')?.value;
		const source = dataDescriptor(record, 'source')?.value;
		const target = dataDescriptor(record, 'target')?.value;
		if (
			typeof edgeId !== 'string' ||
			!exactDataShell(source, ['nodeId']) ||
			!exactDataShell(target, ['nodeId'])
		)
			return false;
		const sourceNodeId = dataDescriptor(source, 'nodeId')?.value;
		const targetNodeId = dataDescriptor(target, 'nodeId')?.value;
		if (typeof sourceNodeId !== 'string' || typeof targetNodeId !== 'string') return false;
		const { currentNodeId, neighborNodeId } = orientedArcEndpoints(
			direction,
			sourceNodeId,
			targetNodeId
		);
		const arcs = adjacency.get(currentNodeId);
		if (arcs === undefined || !adjacency.has(neighborNodeId)) return false;
		arcs.push({
			edgeId: edgeId as ProjectedArc['edgeId'],
			neighborNodeId: neighborNodeId as ProjectedArc['neighborNodeId']
		});
	}
	return true;
}

function collectUpstreamLimitations(
	limitationRecords: object,
	limitationLength: number
): ModuleDependencyGraphLimitationClone[] | null {
	const upstreamLimitations: ModuleDependencyGraphLimitationClone[] = [];
	for (let index = 0; index < limitationLength; index += 1) {
		const limitation = dataDescriptor(limitationRecords, String(index))?.value;
		if (
			!exactDataShell(limitation, [
				'closureEffect',
				'kind',
				'moduleResolutionId',
				'reason',
				'sourceId'
			])
		)
			return null;
		upstreamLimitations.push({
			closureEffect: dataDescriptor(limitation, 'closureEffect')!.value,
			kind: dataDescriptor(limitation, 'kind')!.value,
			moduleResolutionId: dataDescriptor(limitation, 'moduleResolutionId')!.value,
			reason: dataDescriptor(limitation, 'reason')!.value,
			sourceId: dataDescriptor(limitation, 'sourceId')!.value
		} as ModuleDependencyGraphLimitationClone);
	}
	return upstreamLimitations;
}

function projectGraph(
	inputs: StructuralModuleReachabilityAnalysisInputs,
	request: StructuralModuleReachabilityAnalysisRequest
): GraphProjection | 'BUDGET_EXCEEDED' | 'INVALID' {
	const nodeLength = arrayLength(inputs.graph.nodes);
	const edgeLength = arrayLength(inputs.graph.edges);
	if (nodeLength === null || edgeLength === null) return 'INVALID';
	if (nodeLength > request.budgets.maxNodes || edgeLength > request.budgets.maxEdges)
		return 'BUDGET_EXCEEDED';
	const nodes: ProjectedNode[] = [];
	const adjacency = new Map<ProjectedNode['id'], ProjectedArc[]>();
	if (!collectProjectedNodes(inputs.graph.nodes, nodeLength, nodes, adjacency)) return 'INVALID';
	if (!collectProjectedArcs(inputs.graph.edges, edgeLength, adjacency, request.direction))
		return 'INVALID';
	for (const arcs of adjacency.values())
		arcs.sort(
			(left, right) =>
				compareText(left.neighborNodeId, right.neighborNodeId) ||
				compareText(left.edgeId, right.edgeId)
		);
	const coverage = dataDescriptor(inputs.graph, 'coverage')?.value;
	const closure =
		exactDataShell(coverage, ['closure']) && dataDescriptor(coverage, 'closure')?.value;
	if (closure !== 'CLOSED' && closure !== 'OPEN') return 'INVALID';
	const limitationLength = arrayLength(inputs.graph.limitations);
	if (limitationLength === null) return 'INVALID';
	const limitations = collectUpstreamLimitations(inputs.graph.limitations, limitationLength);
	if (limitations === null) return 'INVALID';
	return { adjacency, nodes, upstreamClosure: closure, upstreamLimitations: limitations };
}

type ModuleDependencyGraphLimitationClone =
	StructuralModuleReachabilityAnalysisSnapshot['upstreamLimitations'][number];

interface Traversal {
	readonly distanceByNode: ReadonlyMap<ProjectedNode['id'], number>;
	readonly examinedEdges: number;
	readonly predecessorByNode: ReadonlyMap<
		ProjectedNode['id'],
		{ readonly edgeId: ProjectedArc['edgeId']; readonly nodeId: ProjectedNode['id'] }
	>;
}

class FrontierBudgetExceeded extends Error {}

interface TraversalPredecessor {
	readonly edgeId: ProjectedArc['edgeId'];
	readonly nodeId: ProjectedNode['id'];
}

interface TraversalState {
	chargedTraversalSteps: number;
	readonly distanceByNode: Map<ProjectedNode['id'], number>;
	examinedEdges: number;
	readonly predecessorByNode: Map<ProjectedNode['id'], TraversalPredecessor>;
	readonly queue: ProjectedNode['id'][];
}

function expandTraversalNode(
	nodeId: ProjectedNode['id'],
	projection: GraphProjection,
	request: StructuralModuleReachabilityAnalysisRequest,
	state: TraversalState
): void {
	for (const arc of projection.adjacency.get(nodeId)!) {
		state.examinedEdges += 1;
		state.chargedTraversalSteps += 1;
		if (state.chargedTraversalSteps > request.budgets.maxTraversalSteps)
			throw new RangeError('maxTraversalSteps exceeded.');
		if (state.distanceByNode.has(arc.neighborNodeId)) continue;
		if (state.distanceByNode.size >= request.budgets.maxReachableNodes)
			throw new RangeError('maxReachableNodes exceeded.');
		if (state.predecessorByNode.size >= request.budgets.maxWitnessEdges)
			throw new RangeError('maxWitnessEdges exceeded.');
		state.distanceByNode.set(arc.neighborNodeId, state.distanceByNode.get(nodeId)! + 1);
		state.predecessorByNode.set(arc.neighborNodeId, { edgeId: arc.edgeId, nodeId });
		state.queue.push(arc.neighborNodeId);
	}
}

function traverse(
	projection: GraphProjection,
	request: StructuralModuleReachabilityAnalysisRequest
): Traversal | null {
	const seed = request.criterion.nodeId;
	if (!projection.adjacency.has(seed)) return null;
	if (request.budgets.maxReachableNodes < 1 || request.budgets.maxTraversalSteps < 1)
		throw new RangeError('A structural reachability traversal budget was exceeded.');
	const state: TraversalState = {
		chargedTraversalSteps: 0,
		distanceByNode: new Map<ProjectedNode['id'], number>([[seed, 0]]),
		examinedEdges: 0,
		predecessorByNode: new Map<ProjectedNode['id'], TraversalPredecessor>(),
		queue: [seed]
	};
	for (const nodeId of state.queue) {
		state.chargedTraversalSteps += 1;
		if (state.chargedTraversalSteps > request.budgets.maxTraversalSteps)
			throw new RangeError('maxTraversalSteps exceeded.');
		expandTraversalNode(nodeId, projection, request, state);
	}
	return {
		distanceByNode: state.distanceByNode,
		examinedEdges: state.examinedEdges,
		predecessorByNode: state.predecessorByNode
	};
}

function materialize(
	inputs: StructuralModuleReachabilityAnalysisInputs,
	request: StructuralModuleReachabilityAnalysisRequest,
	projection: GraphProjection,
	traversal: Traversal
): StructuralModuleReachabilityAnalysisSnapshot {
	const inputDigest = structuralModuleReachabilityAnalysisInputDigest({ ...inputs, request });
	const analysisId = structuralModuleReachabilityAnalysisId({
		inputDigest,
		semanticSnapshotId: request.semanticSnapshotId,
		subjectId: request.subjectId
	});
	const nodeById = new Map(projection.nodes.map((node) => [node.id, node]));
	const reached = [...traversal.distanceByNode.entries()].sort(
		([leftNodeId, leftDistance], [rightNodeId, rightDistance]) =>
			leftDistance - rightDistance || compareText(leftNodeId, rightNodeId)
	);
	const members: StructuralModuleReachabilityMember[] = reached.map(
		([nodeId, distance], ordinal) => {
			const node = nodeById.get(nodeId)!;
			const predecessor = traversal.predecessorByNode.get(nodeId);
			return {
				criterion: nodeId === request.criterion.nodeId,
				distance,
				id: structuralModuleReachabilityMemberId(analysisId, nodeId),
				nodeId: node.id,
				nodeKind: node.kind,
				ordinal,
				predecessorNodeId: predecessor?.nodeId ?? null,
				witnessEdgeId: predecessor?.edgeId ?? null
			};
		}
	);
	const memberByNode = new Map(members.map((member) => [member.nodeId, member]));
	const terminalMembers = members.filter((member) => member.nodeKind === 'RESOLUTION_TARGET');
	if (terminalMembers.length > request.budgets.maxFrontierRecords)
		throw new FrontierBudgetExceeded('maxFrontierRecords exceeded.');
	const encounteredFrontiers: StructuralModuleReachabilityEncounteredFrontier[] =
		terminalMembers.map((member, ordinal) => {
			const node = nodeById.get(member.nodeId)!;
			return {
				id: structuralModuleReachabilityFrontierId(analysisId, member.nodeId),
				memberId: memberByNode.get(member.nodeId)!.id,
				moduleResolutionId: node.moduleResolutionId!,
				nodeId: member.nodeId,
				ordinal,
				reason: STRUCTURAL_MODULE_REACHABILITY_TERMINAL_FRONTIER_REASON,
				resolutionState: node.resolutionState!,
				witnessEdgeId: member.witnessEdgeId
			};
		});
	const sourceMembers = members.filter((member) => member.nodeKind === 'SOURCE').length;
	const resolutionTargetMembers = members.length - sourceMembers;
	let maxDistance = 0;
	for (const member of members) maxDistance = Math.max(maxDistance, member.distance);
	const witnessEdges = traversal.predecessorByNode.size;
	const chargedTraversalSteps = members.length + traversal.examinedEdges;
	const layerId = structuralModuleReachabilityLayerId(analysisId);
	const withoutDigest = {
		authorityTransfer: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_AUTHORITY_TRANSFER,
		budgets: { ...request.budgets },
		canonicalProfile: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CANONICAL_PROFILE,
		capability: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY,
		capabilityStatus: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY_STATUS,
		coverage: {
			chargedTraversalSteps,
			criterionReconciles:
				members.filter((member) => member.criterion).length === 1 &&
				members[0]?.nodeId === request.criterion.nodeId &&
				members[0]?.distance === 0 &&
				members[0]?.predecessorNodeId === null &&
				members[0]?.witnessEdgeId === null,
			encounteredFrontiers: encounteredFrontiers.length,
			examinedEdges: traversal.examinedEdges,
			inputEdges: inputs.graph.edges.length,
			inputNodes: inputs.graph.nodes.length,
			maxDistance,
			memberAccountingReconciles:
				sourceMembers + resolutionTargetMembers === members.length &&
				members.length + (inputs.graph.nodes.length - members.length) === inputs.graph.nodes.length,
			reachedNodes: members.length,
			resolutionTargetMembers,
			sourceMembers,
			traversalReconciles: chargedTraversalSteps === members.length + traversal.examinedEdges,
			unvisitedNodes: inputs.graph.nodes.length - members.length,
			witnessAccountingReconciles: witnessEdges === members.length - 1,
			witnessEdges
		},
		criterion: { ...request.criterion },
		direction: request.direction,
		encounteredFrontiers,
		fullJanCsaa007Conformance:
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_007_CONFORMANCE,
		fullJanCsaa008Conformance:
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_FULL_JAN_CSAA_008_CONFORMANCE,
		gateEffect: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GATE_EFFECT,
		graphAuthority: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_GRAPH_AUTHORITY,
		health: 'PARTIAL' as const,
		id: analysisId,
		inputDigest,
		layers: [
			{
				analysisId,
				capability: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY,
				capabilityStatus: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_CAPABILITY_STATUS,
				encounteredFrontierIds: encounteredFrontiers.map((frontier) => frontier.id),
				id: layerId,
				kind: 'STRUCTURAL_MODULE_REACHABILITY' as const,
				memberIds: members.map((member) => member.id),
				ordinal: 0 as const,
				sourceGraph: { ...request.sourceGraph }
			}
		] as const,
		members,
		method: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_METHOD,
		nonclaims: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS,
		operationVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SCHEMA_VERSION,
		selection: { ...STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION },
		semanticSnapshotId: request.semanticSnapshotId,
		sourceGraph: { ...request.sourceGraph },
		structuralClosure: 'EXACT_FOR_SELECTED_VALIDATED_GRAPH_AND_CRITERION' as const,
		subjectId: request.subjectId,
		truncation: { reason: null, state: 'NOT_TRUNCATED' as const },
		upstreamClosure: projection.upstreamClosure,
		upstreamLimitations: projection.upstreamLimitations.map((limitation) => ({ ...limitation }))
	};
	return {
		...withoutDigest,
		contentDigest: structuralModuleReachabilityAnalysisContentDigest(withoutDigest)
	};
}

function refusalMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function inputIdentitiesReconcile(
	inputs: StructuralModuleReachabilityAnalysisInputs,
	request: StructuralModuleReachabilityAnalysisRequest
): boolean {
	return (
		inputs.graph.id === request.sourceGraph.graphId &&
		inputs.graph.contentDigest === request.sourceGraph.contentDigest &&
		inputs.graph.graphInputDigest === request.sourceGraph.graphInputDigest &&
		inputs.graph.subjectId === request.subjectId &&
		inputs.graph.semanticSnapshotId === request.semanticSnapshotId &&
		inputs.semanticSnapshot.id === request.semanticSnapshotId &&
		inputs.semanticSnapshot.subjectId === request.subjectId
	);
}

function consumedInputUnavailable(
	state: 'BUDGET_EXCEEDED' | 'INVALID'
): StructuralModuleReachabilityAnalysisBuildOutcome {
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

function bindPreconditionFailure(
	boundInputs: StructuralModuleReachabilityAnalysisInputs,
	request: StructuralModuleReachabilityAnalysisRequest
): StructuralModuleReachabilityAnalysisBuildOutcome | null {
	if (!inputIdentitiesReconcile(boundInputs, request))
		return unavailable(
			'INPUT_IDENTITY_MISMATCH',
			'The request, graph, and semantic snapshot identities differ.',
			'BIND'
		);
	const inputBudgetState = consumedInputBudgetState(boundInputs, request);
	if (inputBudgetState !== 'VALID') return consumedInputUnavailable(inputBudgetState);
	const inputNodeCount = arrayLength(boundInputs.graph.nodes);
	const inputEdgeCount = arrayLength(boundInputs.graph.edges);
	if (inputNodeCount === null || inputEdgeCount === null)
		return unavailable(
			'SOURCE_GRAPH_INVALID',
			'The source graph populations are not safe plain arrays.',
			'BIND'
		);
	if (inputNodeCount > request.budgets.maxNodes || inputEdgeCount > request.budgets.maxEdges)
		return unavailable(
			'BUDGET_EXCEEDED',
			'The graph population exceeds a node or edge budget.',
			'BIND'
		);
	return null;
}

function sourceGraphValidationFailure(
	boundInputs: StructuralModuleReachabilityAnalysisInputs,
	request: StructuralModuleReachabilityAnalysisRequest
): StructuralModuleReachabilityAnalysisBuildOutcome | null {
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
	return null;
}

function projectionUnavailable(
	projection: 'BUDGET_EXCEEDED' | 'INVALID'
): StructuralModuleReachabilityAnalysisBuildOutcome {
	if (projection === 'INVALID')
		return unavailable(
			'SOURCE_GRAPH_INVALID',
			'The source graph does not expose a safe structural reachability projection.',
			'BIND'
		);
	return unavailable(
		'BUDGET_EXCEEDED',
		'The graph population exceeds a node or edge budget.',
		'BIND'
	);
}

function materializationUnavailable(
	error: unknown
): StructuralModuleReachabilityAnalysisBuildOutcome {
	if (!(error instanceof FrontierBudgetExceeded))
		return unavailable(
			'ANALYSIS_VALIDATION_FAILED',
			'The structural module reachability result could not be materialized safely.',
			'VALIDATE'
		);
	return unavailable(
		'BUDGET_EXCEEDED',
		'The structural module reachability result exceeds a frontier-record budget.',
		'TRAVERSE'
	);
}

function constructionValidationOptions(
	analysis: StructuralModuleReachabilityAnalysisSnapshot,
	request: StructuralModuleReachabilityAnalysisRequest
): NonNullable<Parameters<typeof validateConstructedStructuralModuleReachabilityAnalysis>[2]> {
	const requiredSteps = analysis.coverage.chargedTraversalSteps;
	return {
		maxDepth: 64,
		maxInputRecords: request.budgets.maxInputRecords,
		maxInputStringCharacters: request.budgets.maxInputStringCharacters,
		maxIssues: request.budgets.maxDiagnostics,
		maxRecords: Math.max(
			512,
			requiredSteps * 64 +
				analysis.members.length * 16 +
				analysis.encounteredFrontiers.length * 16 +
				analysis.upstreamLimitations.length * 16
		),
		maxStringCharacters: Math.max(
			16_384,
			Math.min(
				Number.MAX_SAFE_INTEGER,
				request.budgets.maxInputStringCharacters + requiredSteps * 4_096
			)
		)
	};
}

function constructionValidationUnavailable(
	state: 'BUDGET_EXHAUSTED' | 'INVALID'
): StructuralModuleReachabilityAnalysisBuildOutcome {
	if (state === 'BUDGET_EXHAUSTED')
		return unavailable(
			'BUDGET_EXCEEDED',
			'Independent validation exhausted a construction budget.',
			'BIND'
		);
	return unavailable(
		'ANALYSIS_VALIDATION_FAILED',
		'The constructed structural module reachability analysis failed independent validation.',
		'VALIDATE'
	);
}

function buildInternal(
	inputs: StructuralModuleReachabilityAnalysisInputs
): StructuralModuleReachabilityAnalysisBuildOutcome {
	const closedInputs = essentialInputShell(inputs);
	if (closedInputs === null)
		return unavailable(
			'REQUEST_INVALID',
			'The structural module reachability input shell must contain exact data properties.',
			'REQUEST'
		);
	let request: StructuralModuleReachabilityAnalysisRequest;
	try {
		request = materializeRequest(closedInputs.request);
	} catch (error) {
		return unavailable('REQUEST_INVALID', refusalMessage(error), 'REQUEST');
	}
	const boundInputs = { ...closedInputs, request };
	const bindFailure = bindPreconditionFailure(boundInputs, request);
	if (bindFailure !== null) return bindFailure;
	const graphFailure = sourceGraphValidationFailure(boundInputs, request);
	if (graphFailure !== null) return graphFailure;
	const projection = projectGraph(boundInputs, request);
	if (typeof projection === 'string') return projectionUnavailable(projection);
	let traversal: Traversal | null;
	try {
		traversal = traverse(projection, request);
	} catch {
		return unavailable(
			'BUDGET_EXCEEDED',
			'The structural module reachability traversal exceeds a traversal, reachable-node, or witness budget.',
			'TRAVERSE'
		);
	}
	if (traversal === null)
		return unavailable(
			'CRITERION_INVALID',
			'The structural module reachability criterion does not name a validated graph node.',
			'BIND',
			'$.request.criterion.nodeId'
		);
	let analysis: StructuralModuleReachabilityAnalysisSnapshot;
	try {
		analysis = materialize(boundInputs, request, projection, traversal);
	} catch (error) {
		return materializationUnavailable(error);
	}
	const validation = validateConstructedStructuralModuleReachabilityAnalysis(
		analysis,
		boundInputs,
		constructionValidationOptions(analysis, request)
	);
	if (validation.state !== 'VALID') return constructionValidationUnavailable(validation.state);
	return deepFreeze({ analysis, diagnostics: [], outcome: 'partial' });
}

export function buildStructuralModuleReachabilityAnalysis(
	inputs: StructuralModuleReachabilityAnalysisInputs
): StructuralModuleReachabilityAnalysisBuildOutcome {
	try {
		return buildInternal(inputs);
	} catch {
		return unavailable(
			'SOURCE_GRAPH_INVALID',
			'The structural module reachability inputs could not be inspected safely.',
			'BIND'
		);
	}
}
