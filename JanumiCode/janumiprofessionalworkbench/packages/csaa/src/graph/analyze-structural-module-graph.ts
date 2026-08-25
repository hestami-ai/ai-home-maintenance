import type {
	ModuleDependencyGraphEdgeId,
	ModuleDependencyGraphLimitation,
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import { compareText } from '../inventory/canonical.js';
import { isUnicodeScalarString } from '../semantic/canonical.js';
import { structuralSccNodeGroups } from './build-structural-scc-analysis.js';

/**
 * Implementation-local graph kernel. A registered slice/orphan report contract and package-root
 * export deliberately remain outside this module.
 */
export const STRUCTURAL_MODULE_GRAPH_ANALYSIS_STATUS = 'IMPLEMENTATION_LOCAL_UNREGISTERED' as const;

export const STRUCTURAL_MODULE_GRAPH_ANALYSIS_NONCLAIMS = [
	'BEHAVIORAL_REACHABILITY',
	'DEAD_CODE',
	'FINDING_OR_GATE_EFFECT',
	'FULL_JAN_CSAA_003_SLICE_CONFORMANCE',
	'POLICY_VIOLATION',
	'SAFE_REMOVAL'
] as const;

export type StructuralModuleSliceDirection = 'CHOP' | 'FORWARD' | 'REVERSE';

export interface StructuralModuleGraphAnalysisBudgets {
	readonly maxComponents: number;
	readonly maxEdges: number;
	readonly maxNodes: number;
	readonly maxSliceNodes: number;
	readonly maxTraversalSteps: number;
	readonly maxWitnessEdges: number;
}

export interface StructuralModuleGraphAnalysisRequest {
	readonly budgets: StructuralModuleGraphAnalysisBudgets;
	/**
	 * Completeness of the separately declared structural entry population. This is not inferred
	 * from graph shape.
	 */
	readonly entrySurfaceClosure: 'CLOSED' | 'OPEN';
	/** Required and nonempty when the entry surface is open; empty when it is closed. */
	readonly entrySurfaceFrontierReasons: readonly string[];
	readonly entryNodeIds: readonly ModuleDependencyGraphNodeId[];
	readonly slice: {
		readonly direction: StructuralModuleSliceDirection;
		/** Required only for FORWARD and CHOP. */
		readonly sourceNodeIds: readonly ModuleDependencyGraphNodeId[];
		/** Required only for REVERSE and CHOP. */
		readonly targetNodeIds: readonly ModuleDependencyGraphNodeId[];
	};
}

export interface StructuralModuleGraphAnalysisInputs {
	readonly graph: ModuleDependencyGraphSnapshot;
	readonly request: StructuralModuleGraphAnalysisRequest;
}

export type StructuralModuleGraphAnalysisDiagnosticCode =
	| 'BUDGET_EXHAUSTED'
	| 'CRITERION_NOT_FOUND'
	| 'EDGE_ENDPOINT_NOT_FOUND'
	| 'FORWARD_INDEX_MISMATCH'
	| 'REQUEST_INVALID'
	| 'REVERSE_INDEX_MISMATCH'
	| 'SOURCE_GRAPH_INVALID';

export interface StructuralModuleGraphAnalysisDiagnostic {
	readonly code: StructuralModuleGraphAnalysisDiagnosticCode;
	readonly message: string;
	readonly path: string | null;
	readonly phase: 'PROJECT' | 'REQUEST' | 'TRAVERSE';
}

export interface StructuralModuleGraphCanonicalIndexEntry {
	readonly edgeIds: readonly ModuleDependencyGraphEdgeId[];
	readonly nodeId: ModuleDependencyGraphNodeId;
}

export interface StructuralModuleGraphComponent {
	readonly cycleKind: 'ACYCLIC_SINGLETON' | 'MULTI_NODE' | 'SELF_LOOP_SINGLETON';
	readonly internalEdgeIds: readonly ModuleDependencyGraphEdgeId[];
	readonly nodeIds: readonly ModuleDependencyGraphNodeId[];
	readonly ordinal: number;
}

export interface StructuralModuleGraphWitness {
	/** Exact criterion from which this canonical shortest witness was selected. */
	readonly criterionNodeId: ModuleDependencyGraphNodeId;
	/** Edge order follows the original graph direction, including for a reverse slice. */
	readonly edgeIds: readonly ModuleDependencyGraphEdgeId[];
	/**
	 * Ambiguity is retained whenever any witness step has multiple equal-length predecessor
	 * candidates. The canonical witness never implies that the path is unique.
	 */
	readonly pathSelection: 'CANONICAL_AMONG_EQUAL_LENGTH' | 'UNIQUE_SHORTEST';
	/** Node order follows the original graph direction, including for a reverse slice. */
	readonly nodeIds: readonly ModuleDependencyGraphNodeId[];
}

export interface StructuralModuleGraphSliceMember {
	readonly forwardWitness: StructuralModuleGraphWitness | null;
	readonly nodeId: ModuleDependencyGraphNodeId;
	readonly reverseWitness: StructuralModuleGraphWitness | null;
}

export interface StructuralModuleGraphAnalysis {
	readonly capabilityStatus: typeof STRUCTURAL_MODULE_GRAPH_ANALYSIS_STATUS;
	readonly components: readonly StructuralModuleGraphComponent[];
	readonly coverage: {
		readonly chargedTraversalSteps: number;
		readonly componentPartitionReconciles: true;
		readonly forwardIndexReconciles: true;
		readonly inputEdges: number;
		readonly inputNodes: number;
		readonly reverseIndexReconciles: true;
		readonly witnessEdges: number;
	};
	readonly forwardIndex: readonly StructuralModuleGraphCanonicalIndexEntry[];
	readonly graphClosure: 'CLOSED' | 'OPEN';
	readonly graphId: ModuleDependencyGraphSnapshot['id'];
	readonly nonclaims: typeof STRUCTURAL_MODULE_GRAPH_ANALYSIS_NONCLAIMS;
	readonly orphanAssessment: {
		/** Present only when graph and declared entry surfaces are both closed. */
		readonly candidateComponentOrdinals: readonly number[];
		/** Present only when graph and declared entry surfaces are both closed. */
		readonly candidateNodeIds: readonly ModuleDependencyGraphNodeId[];
		readonly entryNodeIds: readonly ModuleDependencyGraphNodeId[];
		readonly entrySurfaceClosure: 'CLOSED' | 'OPEN';
		readonly entrySurfaceFrontierReasons: readonly string[];
		/** Nodes not reached from the declared entry population, regardless of closure. */
		readonly unreachedNodeIds: readonly ModuleDependencyGraphNodeId[];
		readonly state: 'BOUNDED_CANDIDATES_AVAILABLE' | 'INCONCLUSIVE_OPEN_SURFACE';
	};
	readonly reverseIndex: readonly StructuralModuleGraphCanonicalIndexEntry[];
	readonly slice: {
		readonly boundaryEdgeIds: readonly ModuleDependencyGraphEdgeId[];
		readonly direction: StructuralModuleSliceDirection;
		readonly edgeIds: readonly ModuleDependencyGraphEdgeId[];
		readonly excludedNodeIds: readonly ModuleDependencyGraphNodeId[];
		readonly members: readonly StructuralModuleGraphSliceMember[];
		readonly sourceNodeIds: readonly ModuleDependencyGraphNodeId[];
		readonly targetNodeIds: readonly ModuleDependencyGraphNodeId[];
		/** Terminal non-source nodes encountered in the selected structural projection. */
		readonly terminalFrontierNodeIds: readonly ModuleDependencyGraphNodeId[];
	};
	readonly sourceGraphLimitations: readonly ModuleDependencyGraphLimitation[];
}

export type StructuralModuleGraphAnalysisOutcome =
	| {
			readonly analysis: StructuralModuleGraphAnalysis;
			readonly diagnostics: readonly [];
			readonly outcome: 'complete' | 'partial';
	  }
	| {
			readonly analysis?: never;
			readonly diagnostics: readonly [StructuralModuleGraphAnalysisDiagnostic];
			readonly outcome: 'unavailable';
	  };

interface Arc {
	readonly edgeId: ModuleDependencyGraphEdgeId;
	readonly neighborNodeId: ModuleDependencyGraphNodeId;
}

interface Projection {
	readonly edgeById: ReadonlyMap<ModuleDependencyGraphEdgeId, ProjectedEdge>;
	readonly forward: ReadonlyMap<ModuleDependencyGraphNodeId, readonly Arc[]>;
	readonly forwardIndex: readonly StructuralModuleGraphCanonicalIndexEntry[];
	readonly nodeIds: readonly ModuleDependencyGraphNodeId[];
	readonly reverse: ReadonlyMap<ModuleDependencyGraphNodeId, readonly Arc[]>;
	readonly reverseIndex: readonly StructuralModuleGraphCanonicalIndexEntry[];
}

interface ProjectedEdge {
	readonly id: ModuleDependencyGraphEdgeId;
	readonly sourceNodeId: ModuleDependencyGraphNodeId;
	readonly targetNodeId: ModuleDependencyGraphNodeId;
}

interface PredecessorChoice {
	readonly ambiguous: boolean;
	readonly edgeId: ModuleDependencyGraphEdgeId;
	readonly predecessorNodeId: ModuleDependencyGraphNodeId;
}

interface TraversalResult {
	readonly distanceByNode: ReadonlyMap<ModuleDependencyGraphNodeId, number>;
	readonly predecessorByNode: ReadonlyMap<ModuleDependencyGraphNodeId, PredecessorChoice>;
	readonly rootByNode: ReadonlyMap<ModuleDependencyGraphNodeId, ModuleDependencyGraphNodeId>;
}

const BUDGET_KEYS = [
	'maxComponents',
	'maxEdges',
	'maxNodes',
	'maxSliceNodes',
	'maxTraversalSteps',
	'maxWitnessEdges'
] as const;

class BudgetExhausted extends Error {}

class TraversalLedger {
	steps = 0;
	witnessEdges = 0;

	constructor(private readonly budgets: StructuralModuleGraphAnalysisBudgets) {}

	chargeSteps(amount = 1): void {
		if (amount > this.budgets.maxTraversalSteps - this.steps) throw new BudgetExhausted();
		this.steps += amount;
	}

	chargeWitnessEdges(amount: number): void {
		if (amount > this.budgets.maxWitnessEdges - this.witnessEdges) throw new BudgetExhausted();
		this.witnessEdges += amount;
	}
}

function deepFreeze<T>(value: T, active = new WeakSet<object>()): T {
	if (value === null || typeof value !== 'object' || active.has(value)) return value;
	active.add(value);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, active);
	}
	return Object.freeze(value);
}

function unavailable(
	code: StructuralModuleGraphAnalysisDiagnosticCode,
	message: string,
	phase: StructuralModuleGraphAnalysisDiagnostic['phase'],
	path: string | null = null
): StructuralModuleGraphAnalysisOutcome {
	return deepFreeze({ diagnostics: [{ code, message, path, phase }], outcome: 'unavailable' });
}

function isSafeBudget(value: unknown): value is number {
	return (
		typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
	);
}

function isIdentifier(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && isUnicodeScalarString(value);
}

function validBudgets(value: unknown): value is StructuralModuleGraphAnalysisBudgets {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const keys = Reflect.ownKeys(value);
	if (
		keys.length !== BUDGET_KEYS.length ||
		keys.some((key) => !(BUDGET_KEYS as readonly PropertyKey[]).includes(key))
	)
		return false;
	return BUDGET_KEYS.every((key) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		return (
			descriptor !== undefined &&
			'value' in descriptor &&
			descriptor.enumerable &&
			isSafeBudget(descriptor.value)
		);
	});
}

function canonicalIdentifiers(
	values: readonly ModuleDependencyGraphNodeId[]
): ModuleDependencyGraphNodeId[] | null {
	if (!Array.isArray(values)) return null;
	const result = [...values];
	if (result.some((value) => !isIdentifier(value))) return null;
	result.sort(compareText);
	if (result.some((value, index) => index > 0 && value === result[index - 1])) return null;
	return result;
}

function validRequest(request: StructuralModuleGraphAnalysisRequest): {
	readonly entries: ModuleDependencyGraphNodeId[];
	readonly sources: ModuleDependencyGraphNodeId[];
	readonly targets: ModuleDependencyGraphNodeId[];
} | null {
	if (
		request === null ||
		typeof request !== 'object' ||
		!Array.isArray(request.entrySurfaceFrontierReasons)
	)
		return null;
	if (!validBudgets(request.budgets)) return null;
	const entries = canonicalIdentifiers(request.entryNodeIds);
	const sources = canonicalIdentifiers(request.slice?.sourceNodeIds);
	const targets = canonicalIdentifiers(request.slice?.targetNodeIds);
	if (entries === null || sources === null || targets === null) return null;
	if (
		request.entrySurfaceFrontierReasons.some((reason) => !isIdentifier(reason)) ||
		new Set(request.entrySurfaceFrontierReasons).size !==
			request.entrySurfaceFrontierReasons.length ||
		(request.entrySurfaceClosure === 'CLOSED' &&
			request.entrySurfaceFrontierReasons.length !== 0) ||
		(request.entrySurfaceClosure === 'OPEN' && request.entrySurfaceFrontierReasons.length === 0)
	)
		return null;
	if (request.slice.direction === 'FORWARD' && (sources.length === 0 || targets.length !== 0))
		return null;
	if (request.slice.direction === 'REVERSE' && (targets.length === 0 || sources.length !== 0))
		return null;
	if (request.slice.direction === 'CHOP' && (sources.length === 0 || targets.length === 0))
		return null;
	return ['CHOP', 'FORWARD', 'REVERSE'].includes(request.slice.direction)
		? { entries, sources, targets }
		: null;
}

function compareArc(left: Arc, right: Arc): number {
	return (
		compareText(left.neighborNodeId, right.neighborNodeId) || compareText(left.edgeId, right.edgeId)
	);
}

function canonicalIndex(
	nodeIds: readonly ModuleDependencyGraphNodeId[],
	adjacency: ReadonlyMap<ModuleDependencyGraphNodeId, readonly Arc[]>
): readonly StructuralModuleGraphCanonicalIndexEntry[] {
	return nodeIds.map((nodeId) => ({
		edgeIds: adjacency
			.get(nodeId)!
			.map((arc) => arc.edgeId)
			.sort(compareText),
		nodeId
	}));
}

function providedIndexMatches(
	provided: ModuleDependencyGraphSnapshot['forwardIndex'],
	expected: readonly StructuralModuleGraphCanonicalIndexEntry[]
): boolean {
	if (!Array.isArray(provided) || provided.length !== expected.length) return false;
	const byNode = new Map<ModuleDependencyGraphNodeId, readonly ModuleDependencyGraphEdgeId[]>();
	for (const entry of provided) {
		if (
			!isIdentifier(entry?.nodeId) ||
			!Array.isArray(entry.edgeIds) ||
			byNode.has(entry.nodeId) ||
			entry.edgeIds.some((edgeId: unknown) => !isIdentifier(edgeId)) ||
			new Set(entry.edgeIds).size !== entry.edgeIds.length
		)
			return false;
		byNode.set(entry.nodeId, [...entry.edgeIds].sort(compareText));
	}
	return expected.every((entry) => {
		const actual = byNode.get(entry.nodeId);
		return (
			actual !== undefined &&
			actual.length === entry.edgeIds.length &&
			actual.every((id, index) => id === entry.edgeIds[index])
		);
	});
}

function projectGraph(graph: ModuleDependencyGraphSnapshot):
	| { readonly projection: Projection }
	| {
			readonly code: StructuralModuleGraphAnalysisDiagnosticCode;
			readonly message: string;
			readonly path: string;
	  } {
	if (!Array.isArray(graph?.nodes) || !Array.isArray(graph.edges))
		return {
			code: 'SOURCE_GRAPH_INVALID',
			message: 'The graph node and edge populations must be arrays.',
			path: '$inputs.graph'
		};
	const nodeIds = graph.nodes.map((node) => node?.id);
	if (nodeIds.some((nodeId) => !isIdentifier(nodeId)) || new Set(nodeIds).size !== nodeIds.length)
		return {
			code: 'SOURCE_GRAPH_INVALID',
			message: 'Graph node identities must be unique nonempty scalar strings.',
			path: '$inputs.graph.nodes'
		};
	const sortedNodeIds = [...nodeIds].sort(compareText) as ModuleDependencyGraphNodeId[];
	const nodeSet = new Set(sortedNodeIds);
	const forward = new Map(sortedNodeIds.map((nodeId) => [nodeId, [] as Arc[]]));
	const reverse = new Map(sortedNodeIds.map((nodeId) => [nodeId, [] as Arc[]]));
	const edgeById = new Map<ModuleDependencyGraphEdgeId, ProjectedEdge>();
	for (const edge of graph.edges) {
		if (!isIdentifier(edge?.id) || edgeById.has(edge.id))
			return {
				code: 'SOURCE_GRAPH_INVALID',
				message: 'Graph edge identities must be unique nonempty scalar strings.',
				path: '$inputs.graph.edges'
			};
		if (!nodeSet.has(edge.source?.nodeId) || !nodeSet.has(edge.target?.nodeId))
			return {
				code: 'EDGE_ENDPOINT_NOT_FOUND',
				message: 'Every structural edge endpoint must name an input graph node.',
				path: '$inputs.graph.edges'
			};
		const projected = {
			id: edge.id,
			sourceNodeId: edge.source.nodeId,
			targetNodeId: edge.target.nodeId
		};
		edgeById.set(edge.id, projected);
		forward
			.get(projected.sourceNodeId)!
			.push({ edgeId: edge.id, neighborNodeId: projected.targetNodeId });
		reverse
			.get(projected.targetNodeId)!
			.push({ edgeId: edge.id, neighborNodeId: projected.sourceNodeId });
	}
	for (const arcs of [...forward.values(), ...reverse.values()]) arcs.sort(compareArc);
	const forwardIndex = canonicalIndex(sortedNodeIds, forward);
	const reverseIndex = canonicalIndex(sortedNodeIds, reverse);
	if (!providedIndexMatches(graph.forwardIndex, forwardIndex))
		return {
			code: 'FORWARD_INDEX_MISMATCH',
			message: 'The declared forward index does not reconcile with the edge population.',
			path: '$inputs.graph.forwardIndex'
		};
	if (!providedIndexMatches(graph.reverseIndex, reverseIndex))
		return {
			code: 'REVERSE_INDEX_MISMATCH',
			message: 'The declared reverse index does not reconcile with the edge population.',
			path: '$inputs.graph.reverseIndex'
		};
	return {
		projection: { edgeById, forward, forwardIndex, nodeIds: sortedNodeIds, reverse, reverseIndex }
	};
}

function ensureCriteriaExist(
	projection: Projection,
	criteria: readonly ModuleDependencyGraphNodeId[]
): boolean {
	return criteria.every((nodeId) => projection.forward.has(nodeId));
}

function traverse(
	adjacency: ReadonlyMap<ModuleDependencyGraphNodeId, readonly Arc[]>,
	roots: readonly ModuleDependencyGraphNodeId[],
	ledger: TraversalLedger
): TraversalResult {
	const distanceByNode = new Map<ModuleDependencyGraphNodeId, number>();
	const queue: ModuleDependencyGraphNodeId[] = [];
	for (const root of roots) {
		distanceByNode.set(root, 0);
		queue.push(root);
	}
	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const nodeId = queue[cursor]!;
		ledger.chargeSteps();
		for (const arc of adjacency.get(nodeId)!) {
			ledger.chargeSteps();
			if (distanceByNode.has(arc.neighborNodeId)) continue;
			distanceByNode.set(arc.neighborNodeId, distanceByNode.get(nodeId)! + 1);
			queue.push(arc.neighborNodeId);
		}
	}
	const incoming = new Map(
		[...adjacency.keys()].map((nodeId) => [
			nodeId,
			[] as { readonly arc: Arc; readonly predecessor: ModuleDependencyGraphNodeId }[]
		])
	);
	for (const [predecessor, arcs] of adjacency)
		for (const arc of arcs) incoming.get(arc.neighborNodeId)!.push({ arc, predecessor });
	const predecessorByNode = new Map<ModuleDependencyGraphNodeId, PredecessorChoice>();
	const rootByNode = new Map<ModuleDependencyGraphNodeId, ModuleDependencyGraphNodeId>(
		roots.map((root) => [root, root])
	);
	const reached = [...distanceByNode.entries()].sort(
		(left, right) => left[1] - right[1] || compareText(left[0], right[0])
	);
	for (const [nodeId, distance] of reached) {
		if (distance === 0) continue;
		const candidates = incoming
			.get(nodeId)!
			.filter(({ predecessor }) => distanceByNode.get(predecessor) === distance - 1)
			.sort(
				(left, right) =>
					compareText(left.predecessor, right.predecessor) ||
					compareText(left.arc.edgeId, right.arc.edgeId)
			);
		ledger.chargeSteps(incoming.get(nodeId)!.length);
		const selected = candidates[0]!;
		predecessorByNode.set(nodeId, {
			ambiguous: candidates.length > 1,
			edgeId: selected.arc.edgeId,
			predecessorNodeId: selected.predecessor
		});
		rootByNode.set(nodeId, rootByNode.get(selected.predecessor)!);
	}
	return { distanceByNode, predecessorByNode, rootByNode };
}

function witness(
	nodeId: ModuleDependencyGraphNodeId,
	direction: 'FORWARD' | 'REVERSE',
	traversal: TraversalResult,
	ledger: TraversalLedger
): StructuralModuleGraphWitness {
	const traversalNodes = [nodeId];
	const traversalEdges: ModuleDependencyGraphEdgeId[] = [];
	let cursor = nodeId;
	let ambiguous = false;
	while (traversal.predecessorByNode.has(cursor)) {
		const predecessor = traversal.predecessorByNode.get(cursor)!;
		ambiguous ||= predecessor.ambiguous;
		traversalEdges.push(predecessor.edgeId);
		traversalNodes.push(predecessor.predecessorNodeId);
		cursor = predecessor.predecessorNodeId;
	}
	traversalNodes.reverse();
	traversalEdges.reverse();
	ledger.chargeWitnessEdges(traversalEdges.length);
	return {
		criterionNodeId: traversal.rootByNode.get(nodeId)!,
		edgeIds: direction === 'FORWARD' ? traversalEdges : [...traversalEdges].reverse(),
		nodeIds: direction === 'FORWARD' ? traversalNodes : [...traversalNodes].reverse(),
		pathSelection: ambiguous ? 'CANONICAL_AMONG_EQUAL_LENGTH' : 'UNIQUE_SHORTEST'
	};
}

function stronglyConnectedComponents(
	projection: Projection,
	ledger: TraversalLedger
): readonly StructuralModuleGraphComponent[] {
	ledger.chargeSteps(projection.nodeIds.length + projection.edgeById.size);
	const groups = structuralSccNodeGroups({
		edges: [...projection.edgeById.values()].map((edge) => ({
			id: edge.id,
			source: edge.sourceNodeId,
			target: edge.targetNodeId
		})),
		nodeIds: projection.nodeIds
	}).map((group) => group as readonly ModuleDependencyGraphNodeId[]);
	const componentByNode = new Map<ModuleDependencyGraphNodeId, number>();
	groups.forEach((nodes, ordinal) =>
		nodes.forEach((nodeId) => componentByNode.set(nodeId, ordinal))
	);
	const internalByComponent = groups.map(() => [] as ModuleDependencyGraphEdgeId[]);
	const selfLoopComponents = new Set<number>();
	for (const edge of projection.edgeById.values()) {
		const sourceComponent = componentByNode.get(edge.sourceNodeId)!;
		if (sourceComponent !== componentByNode.get(edge.targetNodeId)) continue;
		internalByComponent[sourceComponent]!.push(edge.id);
		if (edge.sourceNodeId === edge.targetNodeId) selfLoopComponents.add(sourceComponent);
	}
	return groups.map((nodeIds, ordinal) => ({
		cycleKind:
			nodeIds.length > 1
				? 'MULTI_NODE'
				: selfLoopComponents.has(ordinal)
					? 'SELF_LOOP_SINGLETON'
					: 'ACYCLIC_SINGLETON',
		internalEdgeIds: internalByComponent[ordinal]!.sort(compareText),
		nodeIds,
		ordinal
	}));
}

function cachedTraversal(
	cache: Map<string, TraversalResult>,
	direction: 'FORWARD' | 'REVERSE',
	roots: readonly ModuleDependencyGraphNodeId[],
	projection: Projection,
	ledger: TraversalLedger
): TraversalResult {
	const key = `${direction}\0${roots.join('\0')}`;
	const existing = cache.get(key);
	if (existing !== undefined) return existing;
	const result = traverse(
		direction === 'FORWARD' ? projection.forward : projection.reverse,
		roots,
		ledger
	);
	cache.set(key, result);
	return result;
}

function sourceLimitations(
	graph: ModuleDependencyGraphSnapshot
): readonly ModuleDependencyGraphLimitation[] {
	return [...graph.limitations]
		.map((limitation) => ({ ...limitation }))
		.sort((left, right) =>
			compareText(
				`${left.kind}\0${left.moduleResolutionId ?? ''}\0${left.sourceId ?? ''}\0${left.reason}`,
				`${right.kind}\0${right.moduleResolutionId ?? ''}\0${right.sourceId ?? ''}\0${right.reason}`
			)
		);
}

function analyzeInternal(
	inputs: StructuralModuleGraphAnalysisInputs
): StructuralModuleGraphAnalysisOutcome {
	const normalized = validRequest(inputs?.request);
	if (normalized === null)
		return unavailable(
			'REQUEST_INVALID',
			'The structural graph analysis request is invalid.',
			'REQUEST',
			'$inputs.request'
		);
	const graph = inputs.graph;
	if (graph?.coverage?.closure !== 'CLOSED' && graph?.coverage?.closure !== 'OPEN')
		return unavailable(
			'SOURCE_GRAPH_INVALID',
			'The source graph closure is invalid.',
			'PROJECT',
			'$inputs.graph.coverage.closure'
		);
	if (
		graph.nodes.length > inputs.request.budgets.maxNodes ||
		graph.edges.length > inputs.request.budgets.maxEdges
	)
		return unavailable(
			'BUDGET_EXHAUSTED',
			'The graph exceeds a node or edge budget.',
			'PROJECT',
			'$inputs.request.budgets'
		);
	const projected = projectGraph(graph);
	if ('code' in projected)
		return unavailable(projected.code, projected.message, 'PROJECT', projected.path);
	const { projection } = projected;
	const criteria = [...normalized.entries, ...normalized.sources, ...normalized.targets];
	if (!ensureCriteriaExist(projection, criteria))
		return unavailable(
			'CRITERION_NOT_FOUND',
			'Every entry and slice criterion must name a graph node.',
			'REQUEST',
			'$inputs.request'
		);
	const ledger = new TraversalLedger(inputs.request.budgets);
	try {
		const components = stronglyConnectedComponents(projection, ledger);
		if (components.length > inputs.request.budgets.maxComponents) throw new BudgetExhausted();
		const cache = new Map<string, TraversalResult>();
		const entryTraversal = cachedTraversal(
			cache,
			'FORWARD',
			normalized.entries,
			projection,
			ledger
		);
		const forwardTraversal =
			inputs.request.slice.direction === 'REVERSE'
				? null
				: cachedTraversal(cache, 'FORWARD', normalized.sources, projection, ledger);
		const reverseTraversal =
			inputs.request.slice.direction === 'FORWARD'
				? null
				: cachedTraversal(cache, 'REVERSE', normalized.targets, projection, ledger);
		const includedNodeIds = projection.nodeIds.filter((nodeId) => {
			if (inputs.request.slice.direction === 'FORWARD')
				return forwardTraversal!.distanceByNode.has(nodeId);
			if (inputs.request.slice.direction === 'REVERSE')
				return reverseTraversal!.distanceByNode.has(nodeId);
			return (
				forwardTraversal!.distanceByNode.has(nodeId) && reverseTraversal!.distanceByNode.has(nodeId)
			);
		});
		if (includedNodeIds.length > inputs.request.budgets.maxSliceNodes) throw new BudgetExhausted();
		const included = new Set(includedNodeIds);
		const members = includedNodeIds.map((nodeId) => ({
			forwardWitness:
				forwardTraversal === null ? null : witness(nodeId, 'FORWARD', forwardTraversal, ledger),
			nodeId,
			reverseWitness:
				reverseTraversal === null ? null : witness(nodeId, 'REVERSE', reverseTraversal, ledger)
		}));
		const includedEdgeIds: ModuleDependencyGraphEdgeId[] = [];
		const boundaryEdgeIds: ModuleDependencyGraphEdgeId[] = [];
		for (const edge of projection.edgeById.values()) {
			const sourceIncluded = included.has(edge.sourceNodeId);
			const targetIncluded = included.has(edge.targetNodeId);
			if (sourceIncluded && targetIncluded) includedEdgeIds.push(edge.id);
			else if (sourceIncluded !== targetIncluded) boundaryEdgeIds.push(edge.id);
		}
		includedEdgeIds.sort(compareText);
		boundaryEdgeIds.sort(compareText);
		const unreachedNodeIds = projection.nodeIds.filter(
			(nodeId) => !entryTraversal.distanceByNode.has(nodeId)
		);
		const candidateState =
			graph.coverage.closure === 'CLOSED' && inputs.request.entrySurfaceClosure === 'CLOSED';
		const componentByNode = new Map<ModuleDependencyGraphNodeId, number>();
		components.forEach((component) =>
			component.nodeIds.forEach((nodeId) => componentByNode.set(nodeId, component.ordinal))
		);
		const candidateComponentOrdinals = candidateState
			? [...new Set(unreachedNodeIds.map((nodeId) => componentByNode.get(nodeId)!))].sort(
					(left, right) => left - right
				)
			: [];
		const terminalFrontierNodeIds = graph.nodes
			.filter((node) => included.has(node.id) && node.kind === 'RESOLUTION_TARGET')
			.map((node) => node.id)
			.sort(compareText);
		const analysis: StructuralModuleGraphAnalysis = {
			capabilityStatus: STRUCTURAL_MODULE_GRAPH_ANALYSIS_STATUS,
			components,
			coverage: {
				chargedTraversalSteps: ledger.steps,
				componentPartitionReconciles: true,
				forwardIndexReconciles: true,
				inputEdges: graph.edges.length,
				inputNodes: graph.nodes.length,
				reverseIndexReconciles: true,
				witnessEdges: ledger.witnessEdges
			},
			forwardIndex: projection.forwardIndex,
			graphClosure: graph.coverage.closure,
			graphId: graph.id,
			nonclaims: STRUCTURAL_MODULE_GRAPH_ANALYSIS_NONCLAIMS,
			orphanAssessment: {
				candidateComponentOrdinals,
				candidateNodeIds: candidateState ? unreachedNodeIds : [],
				entryNodeIds: normalized.entries,
				entrySurfaceClosure: inputs.request.entrySurfaceClosure,
				entrySurfaceFrontierReasons: [...inputs.request.entrySurfaceFrontierReasons].sort(
					compareText
				),
				state: candidateState ? 'BOUNDED_CANDIDATES_AVAILABLE' : 'INCONCLUSIVE_OPEN_SURFACE',
				unreachedNodeIds
			},
			reverseIndex: projection.reverseIndex,
			slice: {
				boundaryEdgeIds,
				direction: inputs.request.slice.direction,
				edgeIds: includedEdgeIds,
				excludedNodeIds: projection.nodeIds.filter((nodeId) => !included.has(nodeId)),
				members,
				sourceNodeIds: normalized.sources,
				targetNodeIds: normalized.targets,
				terminalFrontierNodeIds
			},
			sourceGraphLimitations: sourceLimitations(graph)
		};
		return deepFreeze({
			analysis,
			diagnostics: [],
			outcome:
				graph.coverage.closure === 'CLOSED' && inputs.request.entrySurfaceClosure === 'CLOSED'
					? 'complete'
					: 'partial'
		});
	} catch (error) {
		if (error instanceof BudgetExhausted)
			return unavailable(
				'BUDGET_EXHAUSTED',
				'The structural graph analysis exceeds a traversal, component, slice, or witness budget.',
				'TRAVERSE',
				'$inputs.request.budgets'
			);
		throw error;
	}
}

export function analyzeStructuralModuleGraph(
	inputs: StructuralModuleGraphAnalysisInputs
): StructuralModuleGraphAnalysisOutcome {
	try {
		return analyzeInternal(inputs);
	} catch {
		return unavailable(
			'SOURCE_GRAPH_INVALID',
			'The structural graph analysis failed closed on invalid input.',
			'PROJECT'
		);
	}
}
