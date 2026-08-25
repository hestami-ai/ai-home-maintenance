import { describe, expect, it } from 'vitest';
import type {
	ModuleDependencyGraphEdge,
	ModuleDependencyGraphEdgeId,
	ModuleDependencyGraphIndexEntry,
	ModuleDependencyGraphNode,
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import {
	analyzeStructuralModuleGraph,
	type StructuralModuleGraphAnalysisBudgets,
	type StructuralModuleGraphAnalysisRequest
} from './analyze-structural-module-graph.js';
import { createStructuralSccGraphFixture } from './structural-scc-analysis-fixture.test-support.js';

const generousBudgets: StructuralModuleGraphAnalysisBudgets = {
	maxComponents: 100,
	maxEdges: 100,
	maxNodes: 100,
	maxSliceNodes: 100,
	maxTraversalSteps: 10_000,
	maxWitnessEdges: 10_000
};

function nodeByPath(
	graph: ModuleDependencyGraphSnapshot,
	logicalPath: string
): ModuleDependencyGraphNode {
	const node = graph.nodes.find(
		(candidate) => candidate.kind === 'SOURCE' && candidate.logicalPath === logicalPath
	);
	if (node === undefined) throw new Error(`Fixture node ${logicalPath} is absent.`);
	return node;
}

function graphIndexes(
	nodes: readonly ModuleDependencyGraphNode[],
	edges: readonly ModuleDependencyGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): ModuleDependencyGraphIndexEntry[] {
	return nodes
		.map((node) => ({
			edgeIds: edges
				.filter((edge) =>
					direction === 'FORWARD' ? edge.source.nodeId === node.id : edge.target.nodeId === node.id
				)
				.map((edge) => edge.id)
				.sort(),
			nodeId: node.id
		}))
		.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
}

/**
 * The kernel consumes the structural projection of an already validated predecessor. This helper
 * intentionally rebuilds that projection after each graph-shape mutation.
 */
function structuralGraph(
	base: ModuleDependencyGraphSnapshot,
	nodes: readonly ModuleDependencyGraphNode[],
	edges: readonly ModuleDependencyGraphEdge[],
	closure: 'CLOSED' | 'OPEN' = 'CLOSED'
): ModuleDependencyGraphSnapshot {
	return {
		...base,
		coverage: { ...base.coverage, closure },
		edges,
		forwardIndex: graphIndexes(nodes, edges, 'FORWARD'),
		limitations: closure === 'CLOSED' ? [] : base.limitations,
		nodes,
		reverseIndex: graphIndexes(nodes, edges, 'REVERSE')
	};
}

function closedFixtureGraph(): ModuleDependencyGraphSnapshot {
	const base = createStructuralSccGraphFixture().graph;
	const nodes = base.nodes.filter((node) => node.kind === 'SOURCE');
	const nodeIds = new Set(nodes.map((node) => node.id));
	const edges = base.edges.filter(
		(edge) => nodeIds.has(edge.source.nodeId) && nodeIds.has(edge.target.nodeId)
	);
	return structuralGraph(base, nodes, edges);
}

function request(
	graph: ModuleDependencyGraphSnapshot,
	input: {
		readonly budgets?: Partial<StructuralModuleGraphAnalysisBudgets>;
		readonly direction?: StructuralModuleGraphAnalysisRequest['slice']['direction'];
		readonly entries?: readonly ModuleDependencyGraphNodeId[];
		readonly entryClosure?: StructuralModuleGraphAnalysisRequest['entrySurfaceClosure'];
		readonly entryReasons?: readonly string[];
		readonly sources?: readonly ModuleDependencyGraphNodeId[];
		readonly targets?: readonly ModuleDependencyGraphNodeId[];
	} = {}
): StructuralModuleGraphAnalysisRequest {
	const d = nodeByPath(graph, 'src/d.ts').id;
	const direction = input.direction ?? 'CHOP';
	const sources =
		input.sources ?? (direction === 'REVERSE' ? [] : [nodeByPath(graph, 'src/d.ts').id]);
	const targets =
		input.targets ?? (direction === 'FORWARD' ? [] : [nodeByPath(graph, 'src/e.ts').id]);
	return {
		budgets: { ...generousBudgets, ...input.budgets },
		entryNodeIds: input.entries ?? [d],
		entrySurfaceClosure: input.entryClosure ?? 'CLOSED',
		entrySurfaceFrontierReasons:
			input.entryReasons ?? (input.entryClosure === 'OPEN' ? ['ENTRY_SURFACE_INCOMPLETE'] : []),
		slice: {
			direction,
			sourceNodeIds: sources,
			targetNodeIds: targets
		}
	};
}

function successful(graph: ModuleDependencyGraphSnapshot, analysisRequest = request(graph)) {
	const outcome = analyzeStructuralModuleGraph({ graph, request: analysisRequest });
	if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
	return outcome;
}

function syntheticEdge(
	template: ModuleDependencyGraphEdge,
	id: string,
	source: ModuleDependencyGraphNode,
	target: ModuleDependencyGraphNode
): ModuleDependencyGraphEdge {
	return {
		...template,
		id: id as ModuleDependencyGraphEdgeId,
		source: { kind: 'SOURCE', nodeId: source.id },
		target: { kind: 'SOURCE', nodeId: target.id }
	};
}

describe('analyzeStructuralModuleGraph', () => {
	it('reconciles deterministic indexes, SCCs, chop witnesses, and bounded orphan candidates', () => {
		const graph = closedFixtureGraph();
		const first = successful(graph);
		const permuted = structuralGraph(graph, [...graph.nodes].reverse(), [...graph.edges].reverse());
		const second = successful(permuted);

		expect(second).toEqual(first);
		expect(first.outcome).toBe('complete');
		expect(first.analysis.coverage).toMatchObject({
			componentPartitionReconciles: true,
			forwardIndexReconciles: true,
			reverseIndexReconciles: true
		});
		expect(
			first.analysis.components.filter((component) => component.cycleKind === 'MULTI_NODE')
		).toHaveLength(1);
		expect(
			first.analysis.components.filter((component) => component.cycleKind === 'SELF_LOOP_SINGLETON')
		).toHaveLength(1);
		expect(
			first.analysis.slice.members.map(
				(member) =>
					(graph.nodes.find((node) => node.id === member.nodeId) as { logicalPath: string })
						.logicalPath
			)
		).toEqual(['src/d.ts', 'src/e.ts']);
		expect(first.analysis.orphanAssessment.state).toBe('BOUNDED_CANDIDATES_AVAILABLE');
		expect(first.analysis.orphanAssessment.candidateNodeIds).toHaveLength(4);
		expect(first.analysis.nonclaims).toContain('DEAD_CODE');
		expect(first.analysis.nonclaims).toContain('SAFE_REMOVAL');
		expect(Object.isFrozen(first.analysis)).toBe(true);
	});

	it('supports forward and reverse bounded slices with original-direction witnesses', () => {
		const graph = closedFixtureGraph();
		const d = nodeByPath(graph, 'src/d.ts').id;
		const e = nodeByPath(graph, 'src/e.ts').id;
		const forward = successful(graph, request(graph, { direction: 'FORWARD' })).analysis;
		const reverse = successful(graph, request(graph, { direction: 'REVERSE' })).analysis;

		expect(forward.slice.members.map((member) => member.nodeId)).toEqual([d, e]);
		expect(reverse.slice.members.map((member) => member.nodeId)).toEqual([d, e]);
		expect(
			forward.slice.members.find((member) => member.nodeId === e)?.forwardWitness?.nodeIds
		).toEqual([d, e]);
		expect(
			reverse.slice.members.find((member) => member.nodeId === d)?.reverseWitness?.nodeIds
		).toEqual([d, e]);
		expect(forward.slice.members.every((member) => member.reverseWitness === null)).toBe(true);
		expect(reverse.slice.members.every((member) => member.forwardWitness === null)).toBe(true);
	});

	it('retains equal-length and parallel-edge witness ambiguity while selecting canonically', () => {
		const base = closedFixtureGraph();
		const nodes = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'].map((path) =>
			nodeByPath(base, path)
		);
		const [a, b, c, d] = nodes;
		const template = base.edges[0]!;
		const edges = [
			syntheticEdge(template, 'edge:a-b', a!, b!),
			syntheticEdge(template, 'edge:a-c', a!, c!),
			syntheticEdge(template, 'edge:b-d-1', b!, d!),
			syntheticEdge(template, 'edge:b-d-2', b!, d!),
			syntheticEdge(template, 'edge:c-d', c!, d!)
		];
		const graph = structuralGraph(base, nodes, edges);
		const result = successful(
			graph,
			request(graph, { entries: [a!.id], sources: [a!.id], targets: [d!.id] })
		).analysis;
		const dMember = result.slice.members.find((member) => member.nodeId === d!.id)!;
		const aMember = result.slice.members.find((member) => member.nodeId === a!.id)!;
		const canonicalMiddle = b!.id < c!.id ? b! : c!;
		const canonicalEdges =
			canonicalMiddle === b
				? ['edge:a-b', 'edge:b-d-1']
				: ['edge:a-c', 'edge:c-d'];

		expect(dMember.forwardWitness).toMatchObject({
			edgeIds: canonicalEdges,
			pathSelection: 'CANONICAL_AMONG_EQUAL_LENGTH'
		});
		expect(aMember.reverseWitness).toMatchObject({
			nodeIds: [a!.id, canonicalMiddle.id, d!.id],
			pathSelection: 'CANONICAL_AMONG_EQUAL_LENGTH'
		});
		expect(result.slice.edgeIds).toHaveLength(5);
	});

	it('changes the SCC partition when a cycle edge is mutated away', () => {
		const graph = closedFixtureGraph();
		const cyclic = successful(graph).analysis;
		const a = nodeByPath(graph, 'src/a.ts').id;
		const b = nodeByPath(graph, 'src/b.ts').id;
		const mutation = structuralGraph(
			graph,
			graph.nodes,
			graph.edges.filter((edge) => !(edge.source.nodeId === b && edge.target.nodeId === a))
		);
		const acyclic = successful(mutation).analysis;

		expect(
			cyclic.components.some(
				(component) => component.nodeIds.includes(a) && component.nodeIds.includes(b)
			)
		).toBe(true);
		expect(
			acyclic.components.some(
				(component) => component.nodeIds.includes(a) && component.nodeIds.includes(b)
			)
		).toBe(false);
	});

	it('rejects forward and reverse index mutations independently', () => {
		const graph = closedFixtureGraph();
		const forwardEntry = graph.forwardIndex.find((entry) => entry.edgeIds.length > 0)!;
		const reverseEntry = graph.reverseIndex.find((entry) => entry.edgeIds.length > 0)!;
		const missingForward = {
			...graph,
			forwardIndex: graph.forwardIndex.map((entry) =>
				entry.nodeId === forwardEntry.nodeId ? { ...entry, edgeIds: entry.edgeIds.slice(1) } : entry
			)
		};
		const missingReverse = {
			...graph,
			reverseIndex: graph.reverseIndex.map((entry) =>
				entry.nodeId === reverseEntry.nodeId ? { ...entry, edgeIds: entry.edgeIds.slice(1) } : entry
			)
		};

		expect(
			analyzeStructuralModuleGraph({ graph: missingForward, request: request(graph) })
		).toMatchObject({
			diagnostics: [{ code: 'FORWARD_INDEX_MISMATCH' }],
			outcome: 'unavailable'
		});
		expect(
			analyzeStructuralModuleGraph({ graph: missingReverse, request: request(graph) })
		).toMatchObject({
			diagnostics: [{ code: 'REVERSE_INDEX_MISMATCH' }],
			outcome: 'unavailable'
		});
	});

	it('keeps unreached nodes inconclusive when graph or entry coverage is open', () => {
		const closed = closedFixtureGraph();
		const openEntries = successful(
			closed,
			request(closed, {
				entryClosure: 'OPEN',
				entryReasons: ['FRAMEWORK_REGISTRATION_NOT_ANALYZED']
			})
		);
		expect(openEntries.outcome).toBe('partial');
		expect(openEntries.analysis.orphanAssessment).toMatchObject({
			candidateComponentOrdinals: [],
			candidateNodeIds: [],
			state: 'INCONCLUSIVE_OPEN_SURFACE'
		});
		expect(openEntries.analysis.orphanAssessment.unreachedNodeIds.length).toBeGreaterThan(0);

		const upstreamOpen = createStructuralSccGraphFixture().graph;
		const partial = successful(
			upstreamOpen,
			request(upstreamOpen, { direction: 'FORWARD', entryClosure: 'CLOSED' })
		);
		expect(partial.outcome).toBe('partial');
		expect(partial.analysis.orphanAssessment.candidateNodeIds).toEqual([]);
		expect(partial.analysis.sourceGraphLimitations.length).toBeGreaterThan(0);
		expect(partial.analysis.slice.terminalFrontierNodeIds.length).toBeGreaterThan(0);
	});

	it('enforces node, edge, component, slice, traversal, and witness budgets', () => {
		const graph = closedFixtureGraph();
		const baseline = successful(graph).analysis;
		const cases: readonly Partial<StructuralModuleGraphAnalysisBudgets>[] = [
			{ maxNodes: graph.nodes.length - 1 },
			{ maxEdges: graph.edges.length - 1 },
			{ maxComponents: baseline.components.length - 1 },
			{ maxSliceNodes: baseline.slice.members.length - 1 },
			{ maxTraversalSteps: baseline.coverage.chargedTraversalSteps - 1 },
			{ maxWitnessEdges: baseline.coverage.witnessEdges - 1 }
		];
		for (const budgets of cases)
			expect(
				analyzeStructuralModuleGraph({ graph, request: request(graph, { budgets }) })
			).toMatchObject({ diagnostics: [{ code: 'BUDGET_EXHAUSTED' }], outcome: 'unavailable' });
	});

	it('refuses absent criteria, duplicate roots, and undisclosed open entry surfaces', () => {
		const graph = closedFixtureGraph();
		const d = nodeByPath(graph, 'src/d.ts').id;
		const absent = 'graph-node:absent' as ModuleDependencyGraphNodeId;
		expect(
			analyzeStructuralModuleGraph({
				graph,
				request: request(graph, { sources: [absent] })
			})
		).toMatchObject({ diagnostics: [{ code: 'CRITERION_NOT_FOUND' }], outcome: 'unavailable' });
		expect(
			analyzeStructuralModuleGraph({
				graph,
				request: request(graph, { entries: [d, d] })
			})
		).toMatchObject({ diagnostics: [{ code: 'REQUEST_INVALID' }], outcome: 'unavailable' });
		expect(
			analyzeStructuralModuleGraph({
				graph,
				request: request(graph, { entryClosure: 'OPEN', entryReasons: [] })
			})
		).toMatchObject({ diagnostics: [{ code: 'REQUEST_INVALID' }], outcome: 'unavailable' });
		const missingBudget = { ...request(graph).budgets } as Record<string, unknown>;
		delete missingBudget.maxTraversalSteps;
		const extraBudget = { ...request(graph).budgets, unexpected: 1 };
		for (const budgets of [missingBudget, extraBudget])
			expect(
				analyzeStructuralModuleGraph({
					graph,
					request: { ...request(graph), budgets } as StructuralModuleGraphAnalysisRequest
				})
			).toMatchObject({ diagnostics: [{ code: 'REQUEST_INVALID' }], outcome: 'unavailable' });
	});

	it('accepts valid non-BMP frontier text without accepting an unpaired surrogate', () => {
		const graph = closedFixtureGraph();
		expect(
			successful(
				graph,
				request(graph, { entryClosure: 'OPEN', entryReasons: ['dynamic frontier 🧩'] })
			).outcome
		).toBe('partial');
		expect(
			analyzeStructuralModuleGraph({
				graph,
				request: request(graph, { entryClosure: 'OPEN', entryReasons: ['\uD800'] })
			})
		).toMatchObject({ diagnostics: [{ code: 'REQUEST_INVALID' }], outcome: 'unavailable' });
	});
});
