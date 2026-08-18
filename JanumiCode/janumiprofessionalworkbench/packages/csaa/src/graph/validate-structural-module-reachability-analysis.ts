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
	type StructuralModuleReachabilityAnalysisInputs,
	type StructuralModuleReachabilityAnalysisSnapshot,
	type StructuralModuleReachabilityEncounteredFrontier,
	type StructuralModuleReachabilityMember,
	type StructuralModuleReachabilityValidationIssue,
	type StructuralModuleReachabilityValidationOptions,
	type StructuralModuleReachabilityValidationResult
} from '../contracts/structural-module-reachability-analysis.js';
import { compareText } from '../inventory/canonical.js';
import {
	canonicalSemanticJson,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import {
	structuralModuleReachabilityAnalysisContentDigest,
	structuralModuleReachabilityAnalysisId,
	structuralModuleReachabilityAnalysisInputDigest,
	structuralModuleReachabilityFrontierId,
	structuralModuleReachabilityLayerId,
	structuralModuleReachabilityMemberId
} from './structural-module-reachability-analysis-canonical.js';
import { validateModuleDependencyGraph } from './validate-graph.js';

interface ClosedOptions {
	readonly maxDepth: number;
	readonly maxInputRecords: number;
	readonly maxInputStringCharacters: number;
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

const DEFAULT_OPTIONS: ClosedOptions = {
	maxDepth: 64,
	maxInputRecords: 2_000_000,
	maxInputStringCharacters: 20_000_000,
	maxIssues: 100,
	maxRecords: 1_000_000,
	maxStringCharacters: 10_000_000
};

const SNAPSHOT_KEYS = [
	'authorityTransfer',
	'budgets',
	'canonicalProfile',
	'capability',
	'capabilityStatus',
	'contentDigest',
	'coverage',
	'criterion',
	'direction',
	'encounteredFrontiers',
	'fullJanCsaa007Conformance',
	'fullJanCsaa008Conformance',
	'gateEffect',
	'graphAuthority',
	'health',
	'id',
	'inputDigest',
	'layers',
	'members',
	'method',
	'nonclaims',
	'operationVersion',
	'schemaVersion',
	'selection',
	'semanticSnapshotId',
	'sourceGraph',
	'structuralClosure',
	'subjectId',
	'truncation',
	'upstreamClosure',
	'upstreamLimitations'
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

function issue(
	code: StructuralModuleReachabilityValidationIssue['code'],
	message: string,
	path = '$'
): StructuralModuleReachabilityValidationIssue {
	return { code, message, path };
}

function plainRecord(value: unknown): value is Record<string, unknown> {
	return (
		value !== null &&
		typeof value === 'object' &&
		!isProxyValue(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

function safePositive(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function safeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);
}

function safeNonnegative(value: unknown): value is number {
	return safeInteger(value) && value >= 0;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const keys = Reflect.ownKeys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => typeof key === 'string' && expected.includes(key)) &&
		keys.every((key) => {
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			return descriptor !== undefined && 'value' in descriptor && descriptor.enumerable;
		})
	);
}

function closeOptions(
	value: StructuralModuleReachabilityValidationOptions | undefined
): ClosedOptions | null {
	if (value === undefined) return DEFAULT_OPTIONS;
	if (!plainRecord(value)) return null;
	const allowed = new Set([
		'maxDepth',
		'maxInputRecords',
		'maxInputStringCharacters',
		'maxIssues',
		'maxRecords',
		'maxStringCharacters'
	]);
	if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.has(key)))
		return null;
	const closed: Record<string, number> = { ...DEFAULT_OPTIONS };
	for (const key of allowed) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined) continue;
		if (!('value' in descriptor) || !descriptor.enumerable || !safePositive(descriptor.value))
			return null;
		closed[key] = descriptor.value;
	}
	if (closed.maxIssues! > 100_000) return null;
	return closed as unknown as ClosedOptions;
}

interface PlainTreeVisit {
	readonly depth: number;
	readonly kind: 'VISIT';
	readonly path: string;
	readonly value: unknown;
}

type PlainTreeItem = PlainTreeVisit | { readonly kind: 'LEAVE'; readonly value: object };

type PlainLeafOutcome =
	| { readonly characters: number; readonly kind: 'CONTINUE' }
	| { readonly issue: StructuralModuleReachabilityValidationIssue; readonly kind: 'ISSUE' }
	| { readonly kind: 'DESCEND'; readonly value: object };

// Decides whether visiting this item has already exhausted a traversal budget.
function plainVisitBudgetIssue(
	item: PlainTreeVisit,
	records: number,
	limits: ClosedOptions
): StructuralModuleReachabilityValidationIssue | null {
	if (records > limits.maxRecords)
		return issue('BUDGET_EXHAUSTED', 'The record budget was exhausted.', item.path);
	if (item.depth > limits.maxDepth)
		return issue('BUDGET_EXHAUSTED', 'The validation depth budget was exhausted.', item.path);
	return null;
}

// Decides whether this item is an accepted scalar leaf (carrying the running
// character count forward), a refusal, or an object that must be descended into.
function plainLeafOutcome(
	item: PlainTreeVisit,
	characters: number,
	limits: ClosedOptions
): PlainLeafOutcome {
	if (typeof item.value === 'string') {
		if (!isUnicodeScalarString(item.value))
			return {
				issue: issue('SHAPE_INVALID', 'Strings must contain Unicode scalar text.', item.path),
				kind: 'ISSUE'
			};
		const accumulated = characters + item.value.length;
		if (accumulated > limits.maxStringCharacters)
			return {
				issue: issue('BUDGET_EXHAUSTED', 'The string-character budget was exhausted.', item.path),
				kind: 'ISSUE'
			};
		return { characters: accumulated, kind: 'CONTINUE' };
	}
	if (
		item.value === null ||
		typeof item.value === 'boolean' ||
		(typeof item.value === 'number' && safeInteger(item.value))
	)
		return { characters, kind: 'CONTINUE' };
	const descendant: object | null = typeof item.value === 'object' ? item.value : null;
	if (descendant === null)
		return {
			issue: issue(
				'SHAPE_INVALID',
				'Only JSON-compatible data properties are accepted.',
				item.path
			),
			kind: 'ISSUE'
		};
	return { kind: 'DESCEND', value: descendant };
}

// Decides whether the object being entered is an accepted, unaliased, acyclic node.
function plainObjectEntryIssue(
	item: PlainTreeVisit,
	target: object,
	active: WeakSet<object>,
	seen: WeakSet<object>,
	allowSharedAliases: boolean
): StructuralModuleReachabilityValidationIssue | null {
	if (isProxyValue(target))
		return issue('SHAPE_INVALID', 'Proxy values are not accepted.', item.path);
	if (active.has(target)) return issue('SHAPE_INVALID', 'Cycles are not accepted.', item.path);
	if (!allowSharedAliases && seen.has(target))
		return issue('SHAPE_INVALID', 'Shared object aliases are not accepted.', item.path);
	return null;
}

function plainArrayItemsIssue(
	item: PlainTreeVisit,
	target: readonly unknown[],
	records: number,
	limits: ClosedOptions,
	pending: PlainTreeItem[]
): StructuralModuleReachabilityValidationIssue | null {
	if (Object.getPrototypeOf(target) !== Array.prototype)
		return issue('SHAPE_INVALID', 'Arrays must use Array.prototype.', item.path);
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(target, 'length');
	const lengthValue =
		lengthDescriptor !== undefined && 'value' in lengthDescriptor
			? lengthDescriptor.value
			: undefined;
	if (!safeNonnegative(lengthValue))
		return issue('SHAPE_INVALID', 'Array length is invalid.', item.path);
	const length = lengthValue;
	if (records + length > limits.maxRecords)
		return issue('BUDGET_EXHAUSTED', 'The array population exceeds the record budget.', item.path);
	const keys = Reflect.ownKeys(target);
	if (keys.length !== length + 1 || keys.some((key) => typeof key === 'symbol'))
		return issue('SHAPE_INVALID', 'Arrays must be dense exact data arrays.', item.path);
	for (let index = length - 1; index >= 0; index -= 1) {
		const descriptor = Reflect.getOwnPropertyDescriptor(target, String(index));
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			return issue('SHAPE_INVALID', 'Arrays must contain enumerable data elements.', item.path);
		pending.push({
			depth: item.depth + 1,
			kind: 'VISIT',
			path: `${item.path}[${index}]`,
			value: descriptor.value
		});
	}
	return null;
}

function plainRecordEntriesIssue(
	item: PlainTreeVisit,
	target: object,
	records: number,
	limits: ClosedOptions,
	pending: PlainTreeItem[]
): StructuralModuleReachabilityValidationIssue | null {
	if (Object.getPrototypeOf(target) !== Object.prototype)
		return issue('SHAPE_INVALID', 'Records must use Object.prototype.', item.path);
	const keys = Reflect.ownKeys(target);
	if (keys.some((key) => typeof key !== 'string'))
		return issue('SHAPE_INVALID', 'Symbol record keys are not accepted.', item.path);
	if (records + keys.length > limits.maxRecords)
		return issue(
			'BUDGET_EXHAUSTED',
			'The property population exceeds the record budget.',
			item.path
		);
	keys.reverse();
	for (const key of keys) {
		if (typeof key !== 'string' || !isUnicodeScalarString(key))
			return issue('SHAPE_INVALID', 'Record keys must contain Unicode scalar text.', item.path);
		const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			return issue('SHAPE_INVALID', 'Records must contain enumerable data properties.', item.path);
		pending.push({
			depth: item.depth + 1,
			kind: 'VISIT',
			path: `${item.path}.${key}`,
			value: descriptor.value
		});
	}
	return null;
}

// Enqueues the children of an entered object, refusing any non-plain shape.
function plainChildrenIssue(
	item: PlainTreeVisit,
	target: object,
	records: number,
	limits: ClosedOptions,
	pending: PlainTreeItem[]
): StructuralModuleReachabilityValidationIssue | null {
	if (Array.isArray(target)) return plainArrayItemsIssue(item, target, records, limits, pending);
	return plainRecordEntriesIssue(item, target, records, limits, pending);
}

function plainTreeIssue(
	value: unknown,
	limits: ClosedOptions,
	allowSharedAliases = false
): StructuralModuleReachabilityValidationIssue | null {
	const pending: PlainTreeItem[] = [{ depth: 0, kind: 'VISIT', path: '$', value }];
	const active = new WeakSet<object>();
	const seen = new WeakSet<object>();
	let records = 0;
	let characters = 0;
	while (pending.length > 0) {
		const item = pending.pop()!;
		if (item.kind === 'LEAVE') {
			active.delete(item.value);
			continue;
		}
		records += 1;
		const budgetIssue = plainVisitBudgetIssue(item, records, limits);
		if (budgetIssue !== null) return budgetIssue;
		const leaf = plainLeafOutcome(item, characters, limits);
		if (leaf.kind === 'ISSUE') return leaf.issue;
		if (leaf.kind === 'CONTINUE') {
			characters = leaf.characters;
			continue;
		}
		const target = leaf.value;
		const entryIssue = plainObjectEntryIssue(item, target, active, seen, allowSharedAliases);
		if (entryIssue !== null) return entryIssue;
		seen.add(target);
		active.add(target);
		pending.push({ kind: 'LEAVE', value: target });
		const childrenIssue = plainChildrenIssue(item, target, records, limits, pending);
		if (childrenIssue !== null) return childrenIssue;
	}
	return null;
}

function inputShellIssue(
	value: unknown,
	limits: ClosedOptions
): StructuralModuleReachabilityValidationIssue | null {
	if (!plainRecord(value)) return issue('INPUT_INVALID', 'The input shell is invalid.', '$inputs');
	if (!exactKeys(value, ['graph', 'request', 'semanticSnapshot']))
		return issue('INPUT_INVALID', 'The input shell must be exact data.', '$inputs');
	const graphDescriptor = Reflect.getOwnPropertyDescriptor(value, 'graph')!;
	const requestDescriptor = Reflect.getOwnPropertyDescriptor(value, 'request')!;
	const semanticDescriptor = Reflect.getOwnPropertyDescriptor(value, 'semanticSnapshot')!;
	if (!plainRecord(graphDescriptor.value) || !plainRecord(semanticDescriptor.value))
		return issue('INPUT_INVALID', 'The predecessor shells are invalid.', '$inputs');
	const semanticProjection: Record<string, unknown> = {};
	for (const key of CONSUMED_SEMANTIC_KEYS) {
		const descriptor = Reflect.getOwnPropertyDescriptor(semanticDescriptor.value, key);
		if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable)
			return issue(
				'INPUT_INVALID',
				'The consumed semantic projection must contain enumerable data properties.',
				`$inputs.semanticSnapshot.${key}`
			);
		semanticProjection[key] = descriptor.value;
	}
	const treeIssue = plainTreeIssue(
		{
			graph: graphDescriptor.value,
			request: requestDescriptor.value,
			semanticSnapshot: semanticProjection
		},
		{
			...limits,
			maxRecords: limits.maxInputRecords,
			maxStringCharacters: limits.maxInputStringCharacters
		},
		true
	);
	if (treeIssue === null) return null;
	return {
		...treeIssue,
		code: treeIssue.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INPUT_INVALID',
		path: treeIssue.path.replace('$', '$inputs')
	};
}

function requestIssue(
	inputs: StructuralModuleReachabilityAnalysisInputs
): StructuralModuleReachabilityValidationIssue | null {
	const request = inputs.request;
	if (
		!plainRecord(request) ||
		!plainRecord(request.budgets) ||
		!plainRecord(request.criterion) ||
		!plainRecord(request.selection) ||
		!plainRecord(request.sourceGraph)
	)
		return issue('INPUT_INVALID', 'The request shell is invalid.', '$inputs.request');
	if (
		!exactKeys(request, [
			'budgets',
			'criterion',
			'direction',
			'operationVersion',
			'schemaVersion',
			'selection',
			'semanticSnapshotId',
			'sourceGraph',
			'subjectId'
		]) ||
		!exactKeys(request.budgets, [
			'maxDiagnostics',
			'maxEdges',
			'maxFrontierRecords',
			'maxInputRecords',
			'maxInputStringCharacters',
			'maxNodes',
			'maxReachableNodes',
			'maxTraversalSteps',
			'maxWitnessEdges'
		]) ||
		!exactKeys(request.criterion, ['nodeId']) ||
		!exactKeys(request.selection, [
			'edgePopulation',
			'nodePopulation',
			'parallelEdges',
			'witnessPolicy'
		]) ||
		!exactKeys(request.sourceGraph, ['contentDigest', 'graphId', 'graphInputDigest', 'graphKind'])
	)
		return issue(
			'INPUT_INVALID',
			'The request must contain exact data properties.',
			'$inputs.request'
		);
	const boundedPopulations = [
		request.budgets.maxEdges,
		request.budgets.maxFrontierRecords,
		request.budgets.maxNodes,
		request.budgets.maxReachableNodes,
		request.budgets.maxTraversalSteps,
		request.budgets.maxWitnessEdges
	];
	if (
		boundedPopulations.some((value) => !safeNonnegative(value)) ||
		!safePositive(request.budgets.maxDiagnostics) ||
		!safePositive(request.budgets.maxInputRecords) ||
		!safePositive(request.budgets.maxInputStringCharacters) ||
		request.budgets.maxDiagnostics > 100_000 ||
		(request.direction !== 'FORWARD' && request.direction !== 'REVERSE') ||
		request.operationVersion !== STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION ||
		request.schemaVersion !== STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION ||
		request.selection.edgePopulation !==
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.edgePopulation ||
		request.selection.nodePopulation !==
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.nodePopulation ||
		request.selection.parallelEdges !==
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.parallelEdges ||
		request.selection.witnessPolicy !==
			STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION.witnessPolicy
	)
		return issue(
			'INPUT_INVALID',
			'The request constants or budgets are invalid.',
			'$inputs.request'
		);
	if (
		request.sourceGraph.graphKind !== 'TYPESCRIPT_MODULE_DEPENDENCY' ||
		inputs.graph.id !== request.sourceGraph.graphId ||
		inputs.graph.contentDigest !== request.sourceGraph.contentDigest ||
		inputs.graph.graphInputDigest !== request.sourceGraph.graphInputDigest ||
		inputs.graph.subjectId !== request.subjectId ||
		inputs.graph.semanticSnapshotId !== request.semanticSnapshotId ||
		inputs.semanticSnapshot.id !== request.semanticSnapshotId ||
		inputs.semanticSnapshot.subjectId !== request.subjectId
	)
		return issue('INPUT_INVALID', 'The request and predecessor identities differ.', '$inputs');
	if (!Array.isArray(inputs.graph.nodes) || !Array.isArray(inputs.graph.edges))
		return issue('INPUT_INVALID', 'The graph populations are invalid.', '$inputs.graph');
	if (
		inputs.graph.nodes.length > request.budgets.maxNodes ||
		inputs.graph.edges.length > request.budgets.maxEdges
	)
		return issue('BUDGET_EXHAUSTED', 'The graph exceeds an operation budget.', '$inputs.graph');
	if (!inputs.graph.nodes.some((node) => node.id === request.criterion.nodeId))
		return issue(
			'INPUT_INVALID',
			'The criterion node is not present in the selected graph.',
			'$inputs.request.criterion.nodeId'
		);
	return null;
}

interface TraversalArc {
	readonly edgeId: StructuralModuleReachabilityAnalysisInputs['graph']['edges'][number]['id'];
	readonly from: StructuralModuleReachabilityAnalysisInputs['graph']['nodes'][number]['id'];
	readonly to: StructuralModuleReachabilityAnalysisInputs['graph']['nodes'][number]['id'];
}

type TraversalNodeId = TraversalArc['from'];

interface DerivationBudgetFailure {
	readonly path: string;
	readonly state: 'BUDGET_EXHAUSTED';
}

interface DerivationSuccess {
	readonly analysis: StructuralModuleReachabilityAnalysisSnapshot;
	readonly state: 'VALID';
}

type DerivationResult = DerivationBudgetFailure | DerivationSuccess;

type TraversalBudgets = StructuralModuleReachabilityAnalysisInputs['request']['budgets'];

type ReachabilityGraphNode = StructuralModuleReachabilityAnalysisInputs['graph']['nodes'][number];

type ReachabilityAnalysisId = ReturnType<typeof structuralModuleReachabilityAnalysisId>;

type ArcRelaxation =
	| { readonly discovered: boolean; readonly kind: 'RELAX' }
	| { readonly kind: 'BUDGET'; readonly path: string }
	| { readonly kind: 'SKIP' };

interface ArcSweep {
	readonly discovered: TraversalNodeId[];
	readonly examinedEdges: number;
	readonly failurePath: string | null;
}

interface DistanceComputation {
	readonly distanceByNode: Map<TraversalNodeId, number>;
	readonly examinedEdges: number;
	readonly state: 'COMPUTED';
}

interface LayerWitness {
	readonly arc: TraversalArc;
	readonly nodeId: TraversalNodeId;
}

interface WitnessSelection {
	readonly maxDistance: number;
	readonly predecessorByNode: Map<TraversalNodeId, TraversalNodeId>;
	readonly witnessByNode: Map<TraversalNodeId, TraversalArc['edgeId']>;
}

// Decides, for a single arc, whether relaxing it is skipped, refused for a
// budget, or admitted (and whether it discovers a previously unreached node).
function arcRelaxation(
	arc: TraversalArc,
	candidateDistance: number,
	distanceByNode: Map<TraversalNodeId, number>,
	budgets: TraversalBudgets
): ArcRelaxation {
	const priorDistance = distanceByNode.get(arc.to);
	if (priorDistance !== undefined && priorDistance <= candidateDistance) return { kind: 'SKIP' };
	if (distanceByNode.size >= budgets.maxReachableNodes)
		return { kind: 'BUDGET', path: '$inputs.request.budgets.maxReachableNodes' };
	if (distanceByNode.size - 1 >= budgets.maxWitnessEdges)
		return { kind: 'BUDGET', path: '$inputs.request.budgets.maxWitnessEdges' };
	return { discovered: priorDistance === undefined, kind: 'RELAX' };
}

// Relaxes every outgoing arc of one node, mutating the distance map in place and
// reporting the nodes newly discovered so the caller can enqueue them in order.
function sweepOutgoingArcs(
	arcs: readonly TraversalArc[],
	currentDistance: number,
	cursor: number,
	examinedEdges: number,
	distanceByNode: Map<TraversalNodeId, number>,
	budgets: TraversalBudgets
): ArcSweep {
	const discovered: TraversalNodeId[] = [];
	let sweptEdges = examinedEdges;
	for (const arc of arcs) {
		sweptEdges += 1;
		if (cursor + sweptEdges > budgets.maxTraversalSteps)
			return {
				discovered,
				examinedEdges: sweptEdges,
				failurePath: '$inputs.request.budgets.maxTraversalSteps'
			};
		const candidateDistance = currentDistance + 1;
		const relaxation = arcRelaxation(arc, candidateDistance, distanceByNode, budgets);
		if (relaxation.kind === 'BUDGET')
			return { discovered, examinedEdges: sweptEdges, failurePath: relaxation.path };
		if (relaxation.kind === 'SKIP') continue;
		distanceByNode.set(arc.to, candidateDistance);
		if (relaxation.discovered) discovered.push(arc.to);
	}
	return { discovered, examinedEdges: sweptEdges, failurePath: null };
}

function shortestDistances(
	criterionNodeId: TraversalNodeId,
	outgoing: Map<TraversalNodeId, TraversalArc[]>,
	budgets: TraversalBudgets
): DerivationBudgetFailure | DistanceComputation {
	const distanceByNode = new Map<TraversalNodeId, number>([[criterionNodeId, 0]]);
	const pending: TraversalNodeId[] = [criterionNodeId];
	let cursor = 0;
	let examinedEdges = 0;
	while (cursor < pending.length) {
		const current = pending[cursor++]!;
		if (cursor + examinedEdges > budgets.maxTraversalSteps)
			return {
				path: '$inputs.request.budgets.maxTraversalSteps',
				state: 'BUDGET_EXHAUSTED'
			};
		const currentDistance = distanceByNode.get(current)!;
		const sweep = sweepOutgoingArcs(
			outgoing.get(current)!,
			currentDistance,
			cursor,
			examinedEdges,
			distanceByNode,
			budgets
		);
		examinedEdges = sweep.examinedEdges;
		if (sweep.failurePath !== null) return { path: sweep.failurePath, state: 'BUDGET_EXHAUSTED' };
		for (const nodeId of sweep.discovered) pending.push(nodeId);
	}
	return { distanceByNode, examinedEdges, state: 'COMPUTED' };
}

// Picks the canonical witness arc for every node at one distance layer, in the
// canonical emission order of that layer.
function canonicalLayerWitnesses(
	layerNodeIds: readonly TraversalNodeId[],
	distance: number,
	distanceByNode: Map<TraversalNodeId, number>,
	incoming: Map<TraversalNodeId, TraversalArc[]>,
	discoveryRank: Map<TraversalNodeId, number>
): LayerWitness[] {
	return layerNodeIds
		.map((nodeId) => {
			const candidates = incoming
				.get(nodeId)!
				.filter((arc) => distanceByNode.get(arc.from) === distance - 1)
				.sort((left, right) => {
					const rankOrder = discoveryRank.get(left.from)! - discoveryRank.get(right.from)!;
					return rankOrder !== 0 ? rankOrder : compareText(left.edgeId, right.edgeId);
				});
			return { arc: candidates[0]!, nodeId };
		})
		.sort((left, right) => {
			const rankOrder = discoveryRank.get(left.arc.from)! - discoveryRank.get(right.arc.from)!;
			if (rankOrder !== 0) return rankOrder;
			const nodeOrder = compareText(left.nodeId, right.nodeId);
			return nodeOrder !== 0 ? nodeOrder : compareText(left.arc.edgeId, right.arc.edgeId);
		});
}

function canonicalWitnessSelection(
	criterionNodeId: TraversalNodeId,
	distanceByNode: Map<TraversalNodeId, number>,
	incoming: Map<TraversalNodeId, TraversalArc[]>
): WitnessSelection {
	let maxDistance = 0;
	for (const distance of distanceByNode.values()) maxDistance = Math.max(maxDistance, distance);
	const nodesByDistance: TraversalNodeId[][] = Array.from({ length: maxDistance + 1 }, () => []);
	for (const [nodeId, distance] of distanceByNode) nodesByDistance[distance]!.push(nodeId);
	const discoveryRank = new Map<TraversalNodeId, number>([[criterionNodeId, 0]]);
	const predecessorByNode = new Map<TraversalNodeId, TraversalNodeId>();
	const witnessByNode = new Map<TraversalNodeId, TraversalArc['edgeId']>();
	let nextRank = 1;
	for (let distance = 1; distance <= maxDistance; distance += 1) {
		const selected = canonicalLayerWitnesses(
			nodesByDistance[distance]!,
			distance,
			distanceByNode,
			incoming,
			discoveryRank
		);
		for (const { arc, nodeId } of selected) {
			discoveryRank.set(nodeId, nextRank++);
			predecessorByNode.set(nodeId, arc.from);
			witnessByNode.set(nodeId, arc.edgeId);
		}
	}
	return { maxDistance, predecessorByNode, witnessByNode };
}

function orderedReachedNodeIds(distanceByNode: Map<TraversalNodeId, number>): TraversalNodeId[] {
	return [...distanceByNode.entries()]
		.sort((left, right) => {
			const distanceOrder = left[1] - right[1];
			return distanceOrder !== 0 ? distanceOrder : compareText(left[0], right[0]);
		})
		.map(([nodeId]) => nodeId);
}

function reachabilityMembers(
	analysisId: ReachabilityAnalysisId,
	criterionNodeId: TraversalNodeId,
	orderedReachedNodes: readonly TraversalNodeId[],
	nodeById: Map<TraversalNodeId, ReachabilityGraphNode>,
	distanceByNode: Map<TraversalNodeId, number>,
	selection: WitnessSelection
): StructuralModuleReachabilityMember[] {
	return orderedReachedNodes.map((nodeId, ordinal) => {
		const node = nodeById.get(nodeId)!;
		const criterion = nodeId === criterionNodeId;
		return {
			criterion,
			distance: distanceByNode.get(nodeId)!,
			id: structuralModuleReachabilityMemberId(analysisId, nodeId),
			nodeId: node.id,
			nodeKind: node.kind,
			ordinal,
			predecessorNodeId: criterion
				? null
				: (selection.predecessorByNode.get(nodeId)! as typeof node.id),
			witnessEdgeId: criterion ? null : selection.witnessByNode.get(nodeId)!
		};
	});
}

function encounteredFrontierRecords(
	analysisId: ReachabilityAnalysisId,
	nodeById: Map<TraversalNodeId, ReachabilityGraphNode>,
	terminalMembers: readonly StructuralModuleReachabilityMember[]
): StructuralModuleReachabilityEncounteredFrontier[] {
	return terminalMembers.map((member, ordinal) => {
		const node = nodeById.get(member.nodeId)!;
		if (node.kind !== 'RESOLUTION_TARGET')
			throw new Error('The validated node-kind projection became inconsistent.');
		return {
			id: structuralModuleReachabilityFrontierId(analysisId, member.nodeId),
			memberId: member.id,
			moduleResolutionId: node.moduleResolutionId,
			nodeId: member.nodeId,
			ordinal,
			reason: STRUCTURAL_MODULE_REACHABILITY_TERMINAL_FRONTIER_REASON,
			resolutionState: node.resolutionState,
			witnessEdgeId: member.witnessEdgeId
		};
	});
}

function independentAnalysis(inputs: StructuralModuleReachabilityAnalysisInputs): DerivationResult {
	const request = inputs.request;
	const nodeById = new Map(inputs.graph.nodes.map((node) => [node.id, node]));
	const traversalArcs: TraversalArc[] = inputs.graph.edges.map((edge) =>
		request.direction === 'FORWARD'
			? { edgeId: edge.id, from: edge.source.nodeId, to: edge.target.nodeId }
			: { edgeId: edge.id, from: edge.target.nodeId, to: edge.source.nodeId }
	);
	const outgoing = new Map(inputs.graph.nodes.map((node) => [node.id, [] as TraversalArc[]]));
	const incoming = new Map(inputs.graph.nodes.map((node) => [node.id, [] as TraversalArc[]]));
	for (const arc of traversalArcs) {
		outgoing.get(arc.from)!.push(arc);
		incoming.get(arc.to)!.push(arc);
	}

	// Compute only shortest distances here. Witness selection is deliberately a
	// separate canonical reconstruction below rather than an artifact of queue order.
	const computed = shortestDistances(request.criterion.nodeId, outgoing, request.budgets);
	if (computed.state === 'BUDGET_EXHAUSTED') return computed;
	const distanceByNode = computed.distanceByNode;
	const examinedEdges = computed.examinedEdges;
	const reachedNodes = distanceByNode.size;
	const witnessEdges = Math.max(0, reachedNodes - 1);
	const chargedTraversalSteps = reachedNodes + examinedEdges;
	if (reachedNodes > request.budgets.maxReachableNodes)
		return {
			path: '$inputs.request.budgets.maxReachableNodes',
			state: 'BUDGET_EXHAUSTED'
		};
	if (witnessEdges > request.budgets.maxWitnessEdges)
		return {
			path: '$inputs.request.budgets.maxWitnessEdges',
			state: 'BUDGET_EXHAUSTED'
		};
	if (chargedTraversalSteps > request.budgets.maxTraversalSteps)
		return {
			path: '$inputs.request.budgets.maxTraversalSteps',
			state: 'BUDGET_EXHAUSTED'
		};

	const selection = canonicalWitnessSelection(request.criterion.nodeId, distanceByNode, incoming);
	const maxDistance = selection.maxDistance;

	const inputDigest = structuralModuleReachabilityAnalysisInputDigest(inputs);
	const analysisId = structuralModuleReachabilityAnalysisId({
		inputDigest,
		semanticSnapshotId: request.semanticSnapshotId,
		subjectId: request.subjectId
	});
	const orderedReachedNodes = orderedReachedNodeIds(distanceByNode);
	const members: StructuralModuleReachabilityMember[] = reachabilityMembers(
		analysisId,
		request.criterion.nodeId,
		orderedReachedNodes,
		nodeById,
		distanceByNode,
		selection
	);
	const terminalMembers = members.filter((member) => member.nodeKind === 'RESOLUTION_TARGET');
	if (terminalMembers.length > request.budgets.maxFrontierRecords)
		return {
			path: '$inputs.request.budgets.maxFrontierRecords',
			state: 'BUDGET_EXHAUSTED'
		};
	const encounteredFrontiers: StructuralModuleReachabilityEncounteredFrontier[] =
		encounteredFrontierRecords(analysisId, nodeById, terminalMembers);
	const sourceMembers = members.filter((member) => member.nodeKind === 'SOURCE').length;
	const resolutionTargetMembers = members.length - sourceMembers;
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
				members[0]?.nodeId === request.criterion.nodeId,
			encounteredFrontiers: encounteredFrontiers.length,
			examinedEdges,
			inputEdges: inputs.graph.edges.length,
			inputNodes: inputs.graph.nodes.length,
			maxDistance,
			memberAccountingReconciles: sourceMembers + resolutionTargetMembers === reachedNodes,
			reachedNodes,
			resolutionTargetMembers,
			sourceMembers,
			traversalReconciles:
				reachedNodes + (inputs.graph.nodes.length - reachedNodes) === inputs.graph.nodes.length &&
				examinedEdges <= inputs.graph.edges.length,
			unvisitedNodes: inputs.graph.nodes.length - reachedNodes,
			witnessAccountingReconciles: witnessEdges === Math.max(0, reachedNodes - 1),
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
				id: structuralModuleReachabilityLayerId(analysisId),
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
		upstreamClosure: inputs.graph.coverage.closure,
		upstreamLimitations: inputs.graph.limitations.map((limitation) => ({ ...limitation }))
	};
	return {
		analysis: {
			...withoutDigest,
			contentDigest: structuralModuleReachabilityAnalysisContentDigest(withoutDigest)
		},
		state: 'VALID'
	};
}

function issueResult(
	found: StructuralModuleReachabilityValidationIssue
): StructuralModuleReachabilityValidationResult {
	return {
		issues: [found],
		state: found.code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
	};
}

function boundedInputShellIssue(
	inputs: StructuralModuleReachabilityAnalysisInputs,
	limits: ClosedOptions
): StructuralModuleReachabilityValidationIssue | null {
	if (
		inputs.request.budgets.maxInputRecords < limits.maxInputRecords ||
		inputs.request.budgets.maxInputStringCharacters < limits.maxInputStringCharacters
	)
		return inputShellIssue(inputs, {
			...limits,
			maxInputRecords: Math.min(limits.maxInputRecords, inputs.request.budgets.maxInputRecords),
			maxInputStringCharacters: Math.min(
				limits.maxInputStringCharacters,
				inputs.request.budgets.maxInputStringCharacters
			)
		});
	return null;
}

function validateInternal(
	value: unknown,
	inputs: StructuralModuleReachabilityAnalysisInputs,
	validationOptions?: StructuralModuleReachabilityValidationOptions
): StructuralModuleReachabilityValidationResult {
	const limits = closeOptions(validationOptions);
	if (limits === null)
		return {
			issues: [issue('SHAPE_INVALID', 'Validation options are invalid.', '$options')],
			state: 'INVALID'
		};
	const candidateTreeIssue = plainTreeIssue(value, limits);
	if (candidateTreeIssue !== null) return issueResult(candidateTreeIssue);
	if (!plainRecord(value) || !exactKeys(value, SNAPSHOT_KEYS))
		return {
			issues: [
				issue(
					'SHAPE_INVALID',
					'The structural module reachability analysis snapshot shell must be exact.'
				)
			],
			state: 'INVALID'
		};
	const shellIssue = inputShellIssue(inputs, limits);
	if (shellIssue !== null) return issueResult(shellIssue);
	const closedRequestIssue = requestIssue(inputs);
	if (closedRequestIssue !== null) return issueResult(closedRequestIssue);
	const boundedInputIssue = boundedInputShellIssue(inputs, limits);
	if (boundedInputIssue !== null) return issueResult(boundedInputIssue);
	const graphValidation = validateModuleDependencyGraph(inputs.graph, inputs.semanticSnapshot, {
		maxIssues: Math.min(limits.maxIssues, inputs.request.budgets.maxDiagnostics)
	});
	if (graphValidation.state !== 'VALID')
		return {
			issues: [
				issue('INPUT_INVALID', 'The source graph is not independently valid.', '$inputs.graph')
			],
			state: 'INVALID'
		};
	const expected = independentAnalysis(inputs);
	if (expected.state === 'BUDGET_EXHAUSTED')
		return {
			issues: [
				issue(
					'BUDGET_EXHAUSTED',
					'The complete structural reachability derivation exceeds an operation budget.',
					expected.path
				)
			],
			state: 'BUDGET_EXHAUSTED'
		};
	const candidate = value as unknown as StructuralModuleReachabilityAnalysisSnapshot;
	if (
		candidate.inputDigest !== expected.analysis.inputDigest ||
		candidate.id !== expected.analysis.id
	)
		return {
			issues: [
				issue(
					'IDENTITY_MISMATCH',
					'The candidate analysis identity does not match its inputs.',
					'$.id'
				)
			],
			state: 'INVALID'
		};
	if (candidate.contentDigest !== structuralModuleReachabilityAnalysisContentDigest(candidate))
		return {
			issues: [
				issue(
					'CONTENT_DIGEST_MISMATCH',
					'The candidate content digest is invalid.',
					'$.contentDigest'
				)
			],
			state: 'INVALID'
		};
	if (canonicalSemanticJson(candidate) !== canonicalSemanticJson(expected.analysis))
		return {
			issues: [
				issue(
					'POPULATION_MISMATCH',
					'The candidate differs from the independently derived structural module reachability analysis.'
				)
			],
			state: 'INVALID'
		};
	return { issues: [], state: 'VALID' };
}

export function validateStructuralModuleReachabilityAnalysis(
	value: unknown,
	inputs: StructuralModuleReachabilityAnalysisInputs,
	validationOptions?: StructuralModuleReachabilityValidationOptions
): StructuralModuleReachabilityValidationResult {
	if (arguments.length < 2 || arguments.length > 3)
		return {
			issues: [
				issue(
					'SHAPE_INVALID',
					'The validator requires exactly two or three arguments.',
					'$arguments'
				)
			],
			state: 'INVALID'
		};
	try {
		return validateInternal(value, inputs, validationOptions);
	} catch {
		return {
			issues: [
				issue(
					'SHAPE_INVALID',
					'Structural module reachability validation failed closed on hostile input.'
				)
			],
			state: 'INVALID'
		};
	}
}

export const validateConstructedStructuralModuleReachabilityAnalysis =
	validateStructuralModuleReachabilityAnalysis;
