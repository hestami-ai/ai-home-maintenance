import { describe, expect, it } from 'vitest';
import type {
	ModuleDependencyGraphEdge,
	ModuleDependencyGraphIndexEntry,
	ModuleDependencyGraphNode,
	ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import { canonicalSemanticJson, canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import { createStructuralSccGraphFixture } from './structural-scc-analysis-fixture.test-support.js';
import {
	STRUCTURAL_MODULE_GRAPH_REPORT_NONCLAIMS,
	STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION,
	STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS,
	STRUCTURAL_MODULE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_MODULE_GRAPH_REPORT_SAFETY_CEILINGS,
	runStructuralModuleGraphReport,
	validateStructuralModuleGraphReport,
	type StructuralModuleGraphReportPartialOutcome,
	type StructuralModuleGraphReportRequest
} from './structural-module-graph-report.js';

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

function structuralGraph(
	base: ModuleDependencyGraphSnapshot,
	nodes: readonly ModuleDependencyGraphNode[],
	edges: readonly ModuleDependencyGraphEdge[],
	closure: 'CLOSED' | 'OPEN'
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
	return structuralGraph(base, nodes, edges, 'CLOSED');
}

function requestFor(
	graph: ModuleDependencyGraphSnapshot,
	overrides: {
		readonly entryClosure?: 'CLOSED' | 'OPEN';
		readonly entryReasons?: readonly string[];
		readonly maxResultBytes?: number;
	} = {}
): StructuralModuleGraphReportRequest {
	const d = nodeByPath(graph, 'src/d.ts').id;
	const e = nodeByPath(graph, 'src/e.ts').id;
	return {
		budgets: {
			analysis: {
				maxComponents: 100,
				maxEdges: 100,
				maxNodes: 100,
				maxSliceNodes: 100,
				maxTraversalSteps: 10_000,
				maxWitnessEdges: 10_000
			},
			maxEntrySurfaceFrontierReasons: 100,
			maxRequestStringUtf16CodeUnits: 1_000_000,
			maxResultBytes: overrides.maxResultBytes ?? 64 * 1024 * 1024
		},
		entryNodeIds: [d],
		entrySurfaceClosure: overrides.entryClosure ?? 'CLOSED',
		entrySurfaceFrontierReasons:
			overrides.entryReasons ??
			(overrides.entryClosure === 'OPEN' ? ['ENTRY_SURFACE_INCOMPLETE'] : []),
		operationVersion: STRUCTURAL_MODULE_GRAPH_REPORT_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_MODULE_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
		slice: { direction: 'CHOP', sourceNodeIds: [d], targetNodeIds: [e] },
		sourceGraph: {
			contentDigest: graph.contentDigest,
			graphId: graph.id,
			graphInputDigest: graph.graphInputDigest,
			graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY',
			graphSchemaVersion: graph.schemaVersion,
			semanticSnapshotId: graph.semanticSnapshotId,
			subjectId: graph.subjectId
		}
	};
}

function partialReport(
	graph: ModuleDependencyGraphSnapshot,
	request = requestFor(graph)
): StructuralModuleGraphReportPartialOutcome {
	const outcome = runStructuralModuleGraphReport(request, graph);
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	return outcome;
}

function redigestResult(value: { result: Record<string, unknown> }): void {
	const { contentDigest: _contentDigest, ...content } = value.result;
	value.result.contentDigest = canonicalSemanticJsonWitness(content).sha256;
}

describe('structural module graph report facade', () => {
	it('emits a byte-deterministic exact wire envelope and independently validates it', () => {
		const graph = createStructuralSccGraphFixture().graph;
		const request = requestFor(graph);
		const first = partialReport(graph, request);
		const permuted = structuralGraph(
			graph,
			[...graph.nodes].reverse(),
			[...graph.edges].reverse(),
			'OPEN'
		);
		const second = partialReport(permuted, request);

		expect(canonicalSemanticJson(second)).toBe(canonicalSemanticJson(first));
		expect(validateStructuralModuleGraphReport(first, request, graph)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(first).toMatchObject({
			outcome: 'partial',
			registryStatus: 'IMPLEMENTATION_LOCAL_UNREGISTERED',
			result: {
				analysisOutcome: 'partial',
				authority: 'NONE',
				currentness: {
					basis: 'SOURCE_GRAPH_REFERENCE_ONLY',
					state: 'NOT_EVALUATED'
				},
				gateEffect: 'NONE',
				wireShape: 'CLOSED_EXACT'
			}
		});
		expect(first.result.facadeNonclaims).toEqual(STRUCTURAL_MODULE_GRAPH_REPORT_NONCLAIMS);
		expect(first.result.facadeNonclaims).toContain('REGISTERED_JAN_CSAA_007_OPERATION');
		expect(Object.isFrozen(first.result.analysis.slice.members)).toBe(true);
	});

	it('keeps the facade partial even when the bounded structural analysis is complete', () => {
		const graph = closedFixtureGraph();
		const outcome = partialReport(graph);

		expect(outcome.result.analysisOutcome).toBe('complete');
		expect(outcome.result.analysis.orphanAssessment.state).toBe('BOUNDED_CANDIDATES_AVAILABLE');
		expect(outcome.outcome).toBe('partial');
		expect(outcome.registryStatus).toBe(STRUCTURAL_MODULE_GRAPH_REPORT_REGISTRY_STATUS);
	});

	it('rejects inexact, accessor, and proxy request shells without invoking getters', () => {
		const graph = closedFixtureGraph();
		const request = requestFor(graph);
		expect(runStructuralModuleGraphReport({ ...request, unexpected: true }, graph)).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID' }],
			outcome: 'unavailable',
			state: 'incompatible'
		});

		let getterHits = 0;
		const accessorRequest = { ...request } as Record<string, unknown>;
		Object.defineProperty(accessorRequest, 'slice', {
			enumerable: true,
			get() {
				getterHits += 1;
				return request.slice;
			}
		});
		expect(runStructuralModuleGraphReport(accessorRequest, graph)).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID' }],
			outcome: 'unavailable'
		});
		expect(getterHits).toBe(0);

		const proxy = new Proxy(request, {
			ownKeys() {
				throw new Error('must not inspect proxy keys');
			}
		});
		expect(runStructuralModuleGraphReport(proxy, graph)).toMatchObject({
			diagnostics: [{ code: 'REQUEST_INVALID' }],
			outcome: 'unavailable'
		});
	});

	it('distinguishes schema, operation, graph-reference, analysis, and result budgets', () => {
		const graph = closedFixtureGraph();
		const request = requestFor(graph);
		for (const [field, code] of [
			['schemaVersion', 'SCHEMA_VERSION_UNSUPPORTED'],
			['operationVersion', 'OPERATION_VERSION_UNSUPPORTED']
		] as const)
			expect(
				runStructuralModuleGraphReport({ ...request, [field]: 'unsupported' }, graph)
			).toMatchObject({ diagnostics: [{ code }], outcome: 'unavailable', state: 'incompatible' });

		expect(
			runStructuralModuleGraphReport(
				{
					...request,
					sourceGraph: { ...request.sourceGraph, contentDigest: 'different' }
				},
				graph
			)
		).toMatchObject({
			diagnostics: [{ code: 'SOURCE_GRAPH_REFERENCE_MISMATCH' }],
			outcome: 'unavailable',
			state: 'incompatible'
		});

		expect(
			runStructuralModuleGraphReport(
				{
					...request,
					budgets: {
						...request.budgets,
						analysis: { ...request.budgets.analysis, maxNodes: graph.nodes.length - 1 }
					}
				},
				graph
			)
		).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXHAUSTED' }],
			outcome: 'unavailable',
			state: 'resource-refused'
		});

		expect(
			runStructuralModuleGraphReport(requestFor(graph, { maxResultBytes: 0 }), graph)
		).toMatchObject({
			diagnostics: [{ code: 'MAX_RESULT_BYTES_EXCEEDED' }],
			outcome: 'unavailable',
			state: 'resource-refused'
		});
	});

	it('enforces report safety, request-string, and frontier-population ceilings', () => {
		const graph = closedFixtureGraph();
		const request = requestFor(graph);
		expect(
			runStructuralModuleGraphReport(
				{
					...request,
					budgets: {
						...request.budgets,
						analysis: {
							...request.budgets.analysis,
							maxNodes: STRUCTURAL_MODULE_GRAPH_REPORT_SAFETY_CEILINGS.analysis.maxNodes + 1
						}
					}
				},
				graph
			)
		).toMatchObject({
			diagnostics: [{ code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING' }],
			outcome: 'unavailable',
			state: 'resource-refused'
		});

		expect(
			runStructuralModuleGraphReport(
				{
					...request,
					budgets: { ...request.budgets, maxRequestStringUtf16CodeUnits: 1 }
				},
				graph
			)
		).toMatchObject({
			diagnostics: [{ code: 'REQUEST_STRING_BUDGET_EXHAUSTED' }],
			outcome: 'unavailable',
			state: 'resource-refused'
		});

		const openRequest = requestFor(graph, {
			entryClosure: 'OPEN',
			entryReasons: ['FRAMEWORK_ENTRY_UNKNOWN']
		});
		expect(
			runStructuralModuleGraphReport(
				{
					...openRequest,
					budgets: { ...openRequest.budgets, maxEntrySurfaceFrontierReasons: 0 }
				},
				graph
			)
		).toMatchObject({
			diagnostics: [{ code: 'REQUEST_POPULATION_BUDGET_EXHAUSTED' }],
			outcome: 'unavailable',
			state: 'resource-refused'
		});
	});

	it('classifies shape, digest, identity, population, and validation-budget mutations', () => {
		const graph = closedFixtureGraph();
		const request = requestFor(graph);
		const baseline = partialReport(graph, request);

		const extra = { ...structuredClone(baseline), unexpected: true };
		expect(validateStructuralModuleGraphReport(extra, request, graph)).toMatchObject({
			issues: [{ code: 'SHAPE_INVALID' }],
			state: 'INVALID'
		});

		const staleDigest = structuredClone(baseline) as unknown as {
			result: Record<string, unknown>;
		};
		staleDigest.result.analysisOutcome = 'partial';
		expect(validateStructuralModuleGraphReport(staleDigest, request, graph)).toMatchObject({
			issues: [{ code: 'CONTENT_DIGEST_MISMATCH' }],
			state: 'INVALID'
		});

		const identity = structuredClone(baseline) as unknown as {
			result: Record<string, unknown>;
		};
		identity.result.id = 'structural-module-graph-report-result:tampered';
		redigestResult(identity);
		expect(validateStructuralModuleGraphReport(identity, request, graph)).toMatchObject({
			issues: [{ code: 'IDENTITY_MISMATCH' }],
			state: 'INVALID'
		});

		const population = structuredClone(baseline) as unknown as {
			result: Record<string, unknown>;
		};
		population.result.analysisOutcome = 'partial';
		redigestResult(population);
		expect(validateStructuralModuleGraphReport(population, request, graph)).toMatchObject({
			issues: [{ code: 'POPULATION_MISMATCH' }],
			state: 'INVALID'
		});

		expect(
			validateStructuralModuleGraphReport(baseline, requestFor(graph, { maxResultBytes: 1 }), graph)
		).toMatchObject({ issues: [{ code: 'RESULT_BUDGET_EXHAUSTED' }], state: 'RESOURCE_REFUSED' });
	});

	it('independently validates deterministic incompatible and resource-refused envelopes', () => {
		const graph = closedFixtureGraph();
		const request = requestFor(graph);
		const unsupported = { ...request, schemaVersion: 'unsupported' };
		const incompatible = runStructuralModuleGraphReport(unsupported, graph);
		expect(incompatible).toMatchObject({ outcome: 'unavailable', state: 'incompatible' });
		expect(validateStructuralModuleGraphReport(incompatible, unsupported, graph)).toEqual({
			issues: [],
			state: 'VALID'
		});

		const tiny = requestFor(graph, { maxResultBytes: 0 });
		const refused = runStructuralModuleGraphReport(tiny, graph);
		expect(refused).toMatchObject({ outcome: 'unavailable', state: 'resource-refused' });
		expect(validateStructuralModuleGraphReport(refused, tiny, graph)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('binds report identity to every request and source-graph identity field', () => {
		const graph = closedFixtureGraph();
		const baselineRequest = requestFor(graph);
		const baseline = partialReport(graph, baselineRequest);
		const openRequest = requestFor(graph, {
			entryClosure: 'OPEN',
			entryReasons: ['DYNAMIC_ENTRY_UNRESOLVED']
		});
		const changed = partialReport(graph, openRequest);

		expect(changed.result.requestDigest).not.toBe(baseline.result.requestDigest);
		expect(changed.result.analysisInputDigest).not.toBe(baseline.result.analysisInputDigest);
		expect(changed.result.id).not.toBe(baseline.result.id);
		expect(changed.result.contentDigest).not.toBe(baseline.result.contentDigest);
	});

	it('canonicalizes set-like request populations and rejects duplicates', () => {
		const graph = closedFixtureGraph();
		const base = requestFor(graph, {
			entryClosure: 'OPEN',
			entryReasons: ['Z_FRONTIER', 'A_FRONTIER']
		});
		const a = nodeByPath(graph, 'src/a.ts').id;
		const d = nodeByPath(graph, 'src/d.ts').id;
		const left = {
			...base,
			entryNodeIds: [d, a],
			entrySurfaceFrontierReasons: ['Z_FRONTIER', 'A_FRONTIER'],
			slice: { ...base.slice, sourceNodeIds: [d, a] }
		};
		const right = {
			...base,
			entryNodeIds: [a, d],
			entrySurfaceFrontierReasons: ['A_FRONTIER', 'Z_FRONTIER'],
			slice: { ...base.slice, sourceNodeIds: [a, d] }
		};
		expect(canonicalSemanticJson(runStructuralModuleGraphReport(left, graph))).toBe(
			canonicalSemanticJson(runStructuralModuleGraphReport(right, graph))
		);
		expect(
			runStructuralModuleGraphReport(
				{ ...base, entrySurfaceFrontierReasons: ['DUPLICATE', 'DUPLICATE'] },
				graph
			)
		).toMatchObject({ diagnostics: [{ code: 'REQUEST_INVALID' }], outcome: 'unavailable' });
	});
});
