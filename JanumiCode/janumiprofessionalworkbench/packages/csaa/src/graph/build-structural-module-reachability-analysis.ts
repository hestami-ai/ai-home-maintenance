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

function consumedInputBudgetState(
	inputs: StructuralModuleReachabilityAnalysisInputs,
	request: StructuralModuleReachabilityAnalysisRequest
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
		if (typeof item.value !== 'object' || isProxyValue(item.value)) return 'INVALID';
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
	for (let index = 0; index < nodeLength; index += 1) {
		const record = dataDescriptor(inputs.graph.nodes, String(index))?.value;
		if (!exactDataShell(record, ['id', 'kind'])) return 'INVALID';
		const id = dataDescriptor(record, 'id')?.value;
		const kind = dataDescriptor(record, 'kind')?.value;
		if (typeof id !== 'string' || (kind !== 'SOURCE' && kind !== 'RESOLUTION_TARGET'))
			return 'INVALID';
		let moduleResolutionId: ProjectedNode['moduleResolutionId'] = null;
		let resolutionState: ProjectedNode['resolutionState'] = null;
		if (kind === 'RESOLUTION_TARGET') {
			const moduleResolution = dataDescriptor(record, 'moduleResolutionId')?.value;
			const state = dataDescriptor(record, 'resolutionState')?.value;
			if (
				typeof moduleResolution !== 'string' ||
				(state !== 'RESOLVED_AMBIENT' &&
					state !== 'RESOLVED_EXTERNAL' &&
					state !== 'UNRESOLVED' &&
					state !== 'UNSUPPORTED')
			)
				return 'INVALID';
			moduleResolutionId = moduleResolution as ProjectedNode['moduleResolutionId'];
			resolutionState = state;
		}
		nodes.push({
			id: id as ProjectedNode['id'],
			kind,
			moduleResolutionId,
			resolutionState
		});
		adjacency.set(id as ProjectedNode['id'], []);
	}
	for (let index = 0; index < edgeLength; index += 1) {
		const record = dataDescriptor(inputs.graph.edges, String(index))?.value;
		if (!exactDataShell(record, ['id', 'source', 'target'])) return 'INVALID';
		const edgeId = dataDescriptor(record, 'id')?.value;
		const source = dataDescriptor(record, 'source')?.value;
		const target = dataDescriptor(record, 'target')?.value;
		if (
			typeof edgeId !== 'string' ||
			!exactDataShell(source, ['nodeId']) ||
			!exactDataShell(target, ['nodeId'])
		)
			return 'INVALID';
		const sourceNodeId = dataDescriptor(source, 'nodeId')?.value;
		const targetNodeId = dataDescriptor(target, 'nodeId')?.value;
		if (typeof sourceNodeId !== 'string' || typeof targetNodeId !== 'string') return 'INVALID';
		const currentNodeId = (
			request.direction === 'FORWARD' ? sourceNodeId : targetNodeId
		) as ProjectedNode['id'];
		const neighborNodeId = (
			request.direction === 'FORWARD' ? targetNodeId : sourceNodeId
		) as ProjectedNode['id'];
		const arcs = adjacency.get(currentNodeId);
		if (arcs === undefined || !adjacency.has(neighborNodeId)) return 'INVALID';
		arcs.push({
			edgeId: edgeId as ProjectedArc['edgeId'],
			neighborNodeId: neighborNodeId as ProjectedArc['neighborNodeId']
		});
	}
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
	const upstreamLimitations: ModuleDependencyGraphLimitationClone[] = [];
	for (let index = 0; index < limitationLength; index += 1) {
		const limitation = dataDescriptor(inputs.graph.limitations, String(index))?.value;
		if (
			!exactDataShell(limitation, [
				'closureEffect',
				'kind',
				'moduleResolutionId',
				'reason',
				'sourceId'
			])
		)
			return 'INVALID';
		upstreamLimitations.push({
			closureEffect: dataDescriptor(limitation, 'closureEffect')!.value,
			kind: dataDescriptor(limitation, 'kind')!.value,
			moduleResolutionId: dataDescriptor(limitation, 'moduleResolutionId')!.value,
			reason: dataDescriptor(limitation, 'reason')!.value,
			sourceId: dataDescriptor(limitation, 'sourceId')!.value
		} as ModuleDependencyGraphLimitationClone);
	}
	return { adjacency, nodes, upstreamClosure: closure, upstreamLimitations };
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

function traverse(
	projection: GraphProjection,
	request: StructuralModuleReachabilityAnalysisRequest
): Traversal | null {
	const seed = request.criterion.nodeId;
	if (!projection.adjacency.has(seed)) return null;
	if (request.budgets.maxReachableNodes < 1 || request.budgets.maxTraversalSteps < 1)
		throw new RangeError('A structural reachability traversal budget was exceeded.');
	const queue: ProjectedNode['id'][] = [seed];
	const distanceByNode = new Map<ProjectedNode['id'], number>([[seed, 0]]);
	const predecessorByNode = new Map<
		ProjectedNode['id'],
		{ readonly edgeId: ProjectedArc['edgeId']; readonly nodeId: ProjectedNode['id'] }
	>();
	let examinedEdges = 0;
	let chargedTraversalSteps = 0;
	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const nodeId = queue[cursor]!;
		chargedTraversalSteps += 1;
		if (chargedTraversalSteps > request.budgets.maxTraversalSteps)
			throw new RangeError('maxTraversalSteps exceeded.');
		for (const arc of projection.adjacency.get(nodeId)!) {
			examinedEdges += 1;
			chargedTraversalSteps += 1;
			if (chargedTraversalSteps > request.budgets.maxTraversalSteps)
				throw new RangeError('maxTraversalSteps exceeded.');
			if (distanceByNode.has(arc.neighborNodeId)) continue;
			if (distanceByNode.size >= request.budgets.maxReachableNodes)
				throw new RangeError('maxReachableNodes exceeded.');
			if (predecessorByNode.size >= request.budgets.maxWitnessEdges)
				throw new RangeError('maxWitnessEdges exceeded.');
			distanceByNode.set(arc.neighborNodeId, distanceByNode.get(nodeId)! + 1);
			predecessorByNode.set(arc.neighborNodeId, { edgeId: arc.edgeId, nodeId });
			queue.push(arc.neighborNodeId);
		}
	}
	return { distanceByNode, examinedEdges, predecessorByNode };
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
	const projection = projectGraph(boundInputs, request);
	if (projection === 'INVALID')
		return unavailable(
			'SOURCE_GRAPH_INVALID',
			'The source graph does not expose a safe structural reachability projection.',
			'BIND'
		);
	if (projection === 'BUDGET_EXCEEDED')
		return unavailable(
			'BUDGET_EXCEEDED',
			'The graph population exceeds a node or edge budget.',
			'BIND'
		);
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
	const requiredSteps = analysis.coverage.chargedTraversalSteps;
	const validation = validateConstructedStructuralModuleReachabilityAnalysis(
		analysis,
		boundInputs,
		{
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
		}
	);
	if (validation.state !== 'VALID')
		return unavailable(
			validation.state === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXCEEDED' : 'ANALYSIS_VALIDATION_FAILED',
			validation.state === 'BUDGET_EXHAUSTED'
				? 'Independent validation exhausted a construction budget.'
				: 'The constructed structural module reachability analysis failed independent validation.',
			validation.state === 'BUDGET_EXHAUSTED' ? 'BIND' : 'VALIDATE'
		);
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
