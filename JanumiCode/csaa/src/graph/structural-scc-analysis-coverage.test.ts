import { beforeAll, describe, expect, it } from 'vitest';

import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import {
	STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_SCC_ANALYSIS_SELECTION,
	type StructuralSccAnalysisInputs,
	type StructuralSccAnalysisRequest,
	type StructuralSccAnalysisSnapshot,
	type StructuralSccDiagnostic,
	type StructuralSccValidationOptions
} from '../contracts/structural-scc-analysis.js';
import { buildModuleDependencyGraph } from './build-module-dependency-graph.js';
import { buildStructuralSccAnalysis } from './build-structural-scc-analysis.js';
import { moduleDependencyGraphContentDigest } from './module-dependency-content.js';
import { structuralSccAnalysisContentDigest } from './structural-scc-analysis-canonical.js';
import {
	createStructuralSccGraphFixture,
	type StructuralSccGraphFixture
} from './structural-scc-analysis-fixture.test-support.js';
import { validateStructuralSccAnalysis } from './validate-structural-scc-analysis.js';

let fixture: StructuralSccGraphFixture;
let request: StructuralSccAnalysisRequest;
let inputs: StructuralSccAnalysisInputs;
let base: StructuralSccAnalysisSnapshot;

function requestFor(
	graph: ModuleDependencyGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	budgets: Partial<StructuralSccAnalysisRequest['budgets']> = {}
): StructuralSccAnalysisRequest {
	return {
		budgets: {
			maxComponents: graph.nodes.length,
			maxDiagnostics: 100,
			maxEdges: graph.edges.length,
			maxInputRecords: 1_000_000,
			maxInputStringCharacters: 10_000_000,
			maxNodes: graph.nodes.length,
			maxTraversalSteps: graph.nodes.length + graph.edges.length,
			...budgets
		},
		operationVersion: STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
		selection: STRUCTURAL_SCC_ANALYSIS_SELECTION,
		semanticSnapshotId: snapshot.id,
		sourceGraph: {
			contentDigest: graph.contentDigest,
			graphId: graph.id,
			graphInputDigest: graph.graphInputDigest,
			graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY'
		},
		subjectId: snapshot.subjectId
	};
}

function analysisFor(candidate: StructuralSccAnalysisInputs): StructuralSccAnalysisSnapshot {
	const outcome = buildStructuralSccAnalysis(candidate);
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	return outcome.analysis;
}

function expectUnavailable(candidate: unknown, code: StructuralSccDiagnostic['code']): void {
	expect(buildStructuralSccAnalysis(candidate as StructuralSccAnalysisInputs)).toMatchObject({
		diagnostics: [expect.objectContaining({ code })],
		outcome: 'unavailable'
	});
}

function graphFor(snapshot: StaticSemanticSnapshot): ModuleDependencyGraphSnapshot {
	const outcome = buildModuleDependencyGraph(
		{
			operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
			schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
			semanticSnapshotId: snapshot.id,
			subjectId: snapshot.subjectId
		},
		snapshot
	);
	if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
	return outcome.graph;
}

function invalidButRedigestedInputs(): StructuralSccAnalysisInputs {
	const graph = structuredClone(fixture.graph) as ModuleDependencyGraphSnapshot;
	(graph.coverage as { expectedSources: number }).expectedSources += 1;
	(graph as { contentDigest: string }).contentDigest = moduleDependencyGraphContentDigest(graph);
	return {
		graph,
		request: requestFor(graph, fixture.snapshot),
		semanticSnapshot: fixture.snapshot
	};
}

beforeAll(() => {
	fixture = createStructuralSccGraphFixture();
	request = requestFor(fixture.graph, fixture.snapshot);
	inputs = { graph: fixture.graph, request, semanticSnapshot: fixture.snapshot };
	base = analysisFor(inputs);
});

describe('structural SCC public defensive coverage', () => {
	it('rejects every inexact nested request shell without conflating it with identity', () => {
		const { subjectId, ...requestWithoutSubject } = request;
		for (const malformedRequest of [
			{ ...requestWithoutSubject, unexpected: subjectId },
			{ ...request, budgets: { ...request.budgets, unexpected: true } },
			{ ...request, sourceGraph: { ...request.sourceGraph, unexpected: true } },
			{ ...request, selection: { ...request.selection, unexpected: true } }
		])
			expectUnavailable({ ...inputs, request: malformedRequest }, 'REQUEST_INVALID');
	});

	it('fails closed on hostile graph arrays, records, endpoints, and coverage shells', () => {
		const alienNodes = [...fixture.graph.nodes];
		Object.setPrototypeOf(alienNodes, null);
		expectUnavailable(
			{ ...inputs, graph: { ...fixture.graph, nodes: alienNodes } },
			'SOURCE_GRAPH_INVALID'
		);

		const sparseNodes = new Array(fixture.graph.nodes.length);
		expectUnavailable(
			{ ...inputs, graph: { ...fixture.graph, nodes: sparseNodes } },
			'SOURCE_GRAPH_INVALID'
		);
		expectUnavailable(
			{
				...inputs,
				graph: {
					...fixture.graph,
					nodes: [null, ...fixture.graph.nodes.slice(1)]
				}
			},
			'SOURCE_GRAPH_INVALID'
		);
		expectUnavailable(
			{
				...inputs,
				graph: {
					...fixture.graph,
					nodes: [{ ...fixture.graph.nodes[0], id: 1 }, ...fixture.graph.nodes.slice(1)]
				}
			},
			'SOURCE_GRAPH_INVALID'
		);

		const sparseEdges = new Array(fixture.graph.edges.length);
		expectUnavailable(
			{ ...inputs, graph: { ...fixture.graph, edges: sparseEdges } },
			'SOURCE_GRAPH_INVALID'
		);
		expectUnavailable(
			{
				...inputs,
				graph: {
					...fixture.graph,
					edges: [null, ...fixture.graph.edges.slice(1)]
				}
			},
			'SOURCE_GRAPH_INVALID'
		);
		expectUnavailable(
			{
				...inputs,
				graph: {
					...fixture.graph,
					edges: [{ ...fixture.graph.edges[0], source: null }, ...fixture.graph.edges.slice(1)]
				}
			},
			'SOURCE_GRAPH_INVALID'
		);
		expectUnavailable(
			{
				...inputs,
				graph: {
					...fixture.graph,
					edges: [{ ...fixture.graph.edges[0], source: {} }, ...fixture.graph.edges.slice(1)]
				}
			},
			'SOURCE_GRAPH_INVALID'
		);

		expectUnavailable(
			{ ...inputs, graph: { ...fixture.graph, coverage: null } },
			'SOURCE_GRAPH_INVALID'
		);
		expectUnavailable(
			{
				...inputs,
				graph: { ...fixture.graph, coverage: { ...fixture.graph.coverage, closure: 'UNKNOWN' } }
			},
			'SOURCE_GRAPH_INVALID'
		);
	});

	it('rejects missing and non-plain predecessor shells before traversal', () => {
		const { nodes: _nodes, ...graphWithoutNodes } = fixture.graph;
		expectUnavailable({ ...inputs, graph: graphWithoutNodes }, 'REQUEST_INVALID');

		const nullPrototypeGraph = Object.assign(Object.create(null), fixture.graph);
		expectUnavailable({ ...inputs, graph: nullPrototypeGraph }, 'REQUEST_INVALID');
	});

	it('distinguishes an independently invalid predecessor from a traversal budget failure', () => {
		const invalidInputs = invalidButRedigestedInputs();
		expectUnavailable(invalidInputs, 'SOURCE_GRAPH_INVALID');

		const hostileLayer = new Proxy(fixture.graph.layers, {
			getPrototypeOf() {
				throw new Error('hostile predecessor');
			}
		});
		expectUnavailable(
			{ ...inputs, graph: { ...fixture.graph, layers: hostileLayer } },
			'SOURCE_GRAPH_INVALID'
		);
	});

	it('validates option records without invoking hostile accessors', () => {
		for (const invalidOptions of [null, { unexpected: 1 }, { maxDepth: 0 }])
			expect(
				validateStructuralSccAnalysis(
					base,
					inputs,
					invalidOptions as unknown as StructuralSccValidationOptions
				)
			).toMatchObject({
				issues: [expect.objectContaining({ code: 'SHAPE_INVALID', path: '$options' })],
				state: 'INVALID'
			});

		let hits = 0;
		const hostileOptions = {} as Record<string, unknown>;
		Object.defineProperty(hostileOptions, 'maxDepth', {
			enumerable: true,
			get() {
				hits += 1;
				return 64;
			}
		});
		expect(
			validateStructuralSccAnalysis(base, inputs, hostileOptions as StructuralSccValidationOptions)
		).toMatchObject({ state: 'INVALID' });
		expect(hits).toBe(0);
	});

	it('bounds candidate depth, characters, arrays, and record populations', () => {
		for (const [candidate, validationOptions] of [
			[{ nested: { value: true } }, { maxDepth: 1 }],
			['too long', { maxStringCharacters: 1 }],
			[[0], { maxRecords: 1 }],
			[{ value: 0 }, { maxRecords: 1 }]
		] as const)
			expect(validateStructuralSccAnalysis(candidate, inputs, validationOptions)).toMatchObject({
				issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
				state: 'BUDGET_EXHAUSTED'
			});
	});

	it('budgets the complete consumed predecessor projection before delegated validation', () => {
		for (const validationOptions of [
			{ maxInputRecords: 1 },
			{ maxInputStringCharacters: 1 }
		] as const)
			expect(validateStructuralSccAnalysis(base, inputs, validationOptions)).toMatchObject({
				issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
				state: 'BUDGET_EXHAUSTED'
			});
	});

	it('rejects non-JSON, aliased, sparse, accessor, and exotic candidate trees', () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const shared: Record<string, unknown> = {};
		const alienArray: unknown[] = [];
		Object.setPrototypeOf(alienArray, null);
		const sparseArray = new Array(1);
		let arrayGetterHits = 0;
		const accessorArray = [0];
		Object.defineProperty(accessorArray, '0', {
			enumerable: true,
			get() {
				arrayGetterHits += 1;
				return 0;
			}
		});
		const alienRecord = Object.create(null) as Record<string, unknown>;
		const symbolic = { [Symbol('hostile')]: true };
		let recordGetterHits = 0;
		const accessorRecord = {} as Record<string, unknown>;
		Object.defineProperty(accessorRecord, 'value', {
			enumerable: true,
			get() {
				recordGetterHits += 1;
				return true;
			}
		});

		for (const candidate of [
			null,
			true,
			'not a snapshot',
			undefined,
			Number.NaN,
			Number.MAX_SAFE_INTEGER + 1,
			'\ud800',
			cyclic,
			{ left: shared, right: shared },
			alienArray,
			sparseArray,
			accessorArray,
			alienRecord,
			symbolic,
			accessorRecord
		])
			expect(validateStructuralSccAnalysis(candidate, inputs)).toMatchObject({
				issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })],
				state: 'INVALID'
			});
		expect(arrayGetterHits).toBe(0);
		expect(recordGetterHits).toBe(0);
	});

	it('rejects Proxy shells without triggering their reflection traps', () => {
		let traps = 0;
		const hostileInputs = new Proxy(inputs, {
			ownKeys() {
				traps += 1;
				throw new Error('must not enumerate');
			}
		});
		const hostileCandidate = new Proxy(base, {
			getPrototypeOf() {
				traps += 1;
				throw new Error('must not inspect prototype');
			}
		});
		expectUnavailable(hostileInputs, 'REQUEST_INVALID');
		expect(validateStructuralSccAnalysis(base, hostileInputs)).toMatchObject({
			state: 'INVALID'
		});
		expect(validateStructuralSccAnalysis(hostileCandidate, inputs)).toMatchObject({
			issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })],
			state: 'INVALID'
		});
		expect(traps).toBe(0);
	});

	it('fails closed for malformed input shells without invoking predecessor accessors', () => {
		expect(
			validateStructuralSccAnalysis(base, null as unknown as StructuralSccAnalysisInputs)
		).toMatchObject({ issues: [expect.objectContaining({ code: 'INPUT_INVALID' })] });
		expect(
			validateStructuralSccAnalysis(base, {
				...inputs,
				unexpected: true
			} as unknown as StructuralSccAnalysisInputs)
		).toMatchObject({ issues: [expect.objectContaining({ code: 'INPUT_INVALID' })] });

		let requestGetterHits = 0;
		const selection = { ...request.selection } as Record<string, unknown>;
		Object.defineProperty(selection, 'direction', {
			enumerable: true,
			get() {
				requestGetterHits += 1;
				return request.selection.direction;
			}
		});
		expect(
			validateStructuralSccAnalysis(base, {
				...inputs,
				request: { ...request, selection } as StructuralSccAnalysisRequest
			})
		).toMatchObject({ issues: [expect.objectContaining({ code: 'INPUT_INVALID' })] });
		expect(requestGetterHits).toBe(0);

		let budgetsGetterHits = 0;
		const hostileRequest = { ...request } as unknown as Record<string, unknown>;
		Object.defineProperty(hostileRequest, 'budgets', {
			enumerable: true,
			get() {
				budgetsGetterHits += 1;
				return request.budgets;
			}
		});
		expect(
			validateStructuralSccAnalysis(base, {
				...inputs,
				request: hostileRequest as unknown as StructuralSccAnalysisRequest
			})
		).toMatchObject({ issues: [expect.objectContaining({ code: 'INPUT_INVALID' })] });
		expect(budgetsGetterHits).toBe(0);

		expect(
			validateStructuralSccAnalysis(base, {
				...inputs,
				graph: null as unknown as ModuleDependencyGraphSnapshot
			})
		).toMatchObject({ issues: [expect.objectContaining({ code: 'INPUT_INVALID' })] });

		let graphGetterHits = 0;
		const graph = { ...fixture.graph } as Record<string, unknown>;
		Object.defineProperty(graph, 'contentDigest', {
			enumerable: true,
			get() {
				graphGetterHits += 1;
				return fixture.graph.contentDigest;
			}
		});
		expect(
			validateStructuralSccAnalysis(base, {
				...inputs,
				graph: graph as unknown as ModuleDependencyGraphSnapshot
			})
		).toMatchObject({ issues: [expect.objectContaining({ code: 'INPUT_INVALID' })] });
		expect(graphGetterHits).toBe(0);
	});

	it('separates malformed request, identity, operation-budget, and component-budget failures', () => {
		for (const malformedRequest of [
			[] as unknown as StructuralSccAnalysisRequest,
			{ ...request, unexpected: true } as unknown as StructuralSccAnalysisRequest,
			{ ...request, schemaVersion: 'wrong' } as unknown as StructuralSccAnalysisRequest,
			{
				...request,
				budgets: { ...request.budgets, maxDiagnostics: 100_001 }
			} as StructuralSccAnalysisRequest,
			{
				...request,
				budgets: { ...request.budgets, maxNodes: -0 }
			} as StructuralSccAnalysisRequest,
			{
				...request,
				selection: { ...request.selection, direction: '\ud800' }
			} as unknown as StructuralSccAnalysisRequest
		]) {
			expectUnavailable({ ...inputs, request: malformedRequest }, 'REQUEST_INVALID');
			expect(
				validateStructuralSccAnalysis(base, { ...inputs, request: malformedRequest })
			).toMatchObject({
				issues: [expect.objectContaining({ code: 'INPUT_INVALID' })],
				state: 'INVALID'
			});
		}

		expect(
			validateStructuralSccAnalysis(base, {
				...inputs,
				request: { ...request, subjectId: `stale-${request.subjectId}` }
			})
		).toMatchObject({ issues: [expect.objectContaining({ code: 'INPUT_INVALID' })] });

		expect(
			validateStructuralSccAnalysis(base, {
				...inputs,
				request: requestFor(fixture.graph, fixture.snapshot, {
					maxNodes: fixture.graph.nodes.length - 1
				})
			})
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
			state: 'BUDGET_EXHAUSTED'
		});

		expect(
			validateStructuralSccAnalysis(base, {
				...inputs,
				request: requestFor(fixture.graph, fixture.snapshot, { maxComponents: 0 })
			})
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
			state: 'BUDGET_EXHAUSTED'
		});
	});

	it('reports digest-correct analysis identity tampering as an identity mismatch', () => {
		const candidate = structuredClone(base) as StructuralSccAnalysisSnapshot;
		(candidate as { id: string }).id = `${base.id}-stale`;
		(candidate as { contentDigest: string }).contentDigest =
			structuralSccAnalysisContentDigest(candidate);
		expect(validateStructuralSccAnalysis(candidate, inputs)).toMatchObject({
			issues: [expect.objectContaining({ code: 'IDENTITY_MISMATCH' })],
			state: 'INVALID'
		});
	});

	it('independently rejects invalid predecessors and stale candidate digests', () => {
		expect(validateStructuralSccAnalysis(base, invalidButRedigestedInputs())).toMatchObject({
			issues: [expect.objectContaining({ code: 'INPUT_INVALID', path: '$inputs.graph' })],
			state: 'INVALID'
		});

		const stale = structuredClone(base) as StructuralSccAnalysisSnapshot;
		(stale as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expect(validateStructuralSccAnalysis(stale, inputs)).toMatchObject({
			issues: [expect.objectContaining({ code: 'CONTENT_DIGEST_MISMATCH' })],
			state: 'INVALID'
		});
	});
});

describe('structural SCC graph-shape cases', () => {
	it('partitions a closed graph without promoting graph closure to behavioral closure', () => {
		const unresolved = fixture.snapshot.moduleResolutions.find(
			(resolution) => resolution.resolutionState === 'UNRESOLVED'
		)!;
		const snapshot = {
			...fixture.snapshot,
			astNodes: fixture.snapshot.astNodes.filter((node) => node.id !== unresolved.nodeId),
			moduleResolutions: fixture.snapshot.moduleResolutions.filter(
				(resolution) => resolution.id !== unresolved.id
			),
			provenances: fixture.snapshot.provenances.filter(
				(provenance) => provenance.id !== unresolved.provenanceId
			)
		} as StaticSemanticSnapshot;
		const graph = graphFor(snapshot);
		const closedInputs = {
			graph,
			request: requestFor(graph, snapshot),
			semanticSnapshot: snapshot
		};
		const result = analysisFor(closedInputs);

		expect(graph.coverage.closure).toBe('CLOSED');
		expect(result.upstreamClosure).toBe('CLOSED');
		expect(result.structuralClosure).toBe('EXACT_FOR_SELECTED_VALIDATED_GRAPH');
		expect(result.health).toBe('PARTIAL');
		expect(validateStructuralSccAnalysis(result, closedInputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('returns an exact empty partition for a valid empty predecessor graph', () => {
		const snapshot = {
			...fixture.snapshot,
			astNodes: [],
			expectedEmpty: true,
			moduleResolutions: [],
			provenances: [],
			sources: []
		} as unknown as StaticSemanticSnapshot;
		const graph = graphFor(snapshot);
		const emptyInputs = {
			graph,
			request: requestFor(graph, snapshot),
			semanticSnapshot: snapshot
		};
		const result = analysisFor(emptyInputs);

		expect(graph.nodes).toEqual([]);
		expect(graph.edges).toEqual([]);
		expect(result.components).toEqual([]);
		expect(result.componentIndex).toEqual([]);
		expect(result.coverage).toMatchObject({
			chargedTraversalSteps: 0,
			components: 0,
			inputEdges: 0,
			inputNodes: 0,
			partitionReconciles: true
		});
		expect(validateStructuralSccAnalysis(result, emptyInputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('preserves parallel edges while assigning their endpoints to one component', () => {
		const original = fixture.snapshot.moduleResolutions.find(
			(resolution) => resolution.resolutionState === 'RESOLVED_SOURCE'
		)!;
		const originalNode = fixture.snapshot.astNodes.find((node) => node.id === original.nodeId)!;
		const originalProvenance = fixture.snapshot.provenances.find(
			(provenance) => provenance.id === original.provenanceId
		)!;
		const parallelNodeId = `${original.nodeId}-parallel` as typeof original.nodeId;
		const parallelProvenanceId =
			`${original.provenanceId}-parallel` as typeof original.provenanceId;
		const snapshot = {
			...fixture.snapshot,
			astNodes: [
				...fixture.snapshot.astNodes,
				{
					...originalNode,
					id: parallelNodeId,
					start: originalNode.end + 1,
					end: originalNode.end + 2
				}
			],
			moduleResolutions: [
				...fixture.snapshot.moduleResolutions,
				{
					...original,
					id: `${original.id}-parallel` as typeof original.id,
					nodeId: parallelNodeId,
					provenanceId: parallelProvenanceId
				}
			],
			provenances: [
				...fixture.snapshot.provenances,
				{ ...originalProvenance, id: parallelProvenanceId }
			]
		} as StaticSemanticSnapshot;
		const graph = graphFor(snapshot);
		const parallelInputs = {
			graph,
			request: requestFor(graph, snapshot),
			semanticSnapshot: snapshot
		};
		const result = analysisFor(parallelInputs);
		const endpointCounts = new Map<string, number>();
		for (const edge of graph.edges) {
			const key = `${edge.source.nodeId}\0${edge.target.nodeId}`;
			endpointCounts.set(key, (endpointCounts.get(key) ?? 0) + 1);
		}

		expect(Math.max(...endpointCounts.values())).toBe(2);
		expect(result.coverage.inputEdges).toBe(fixture.graph.edges.length + 1);
		expect(result.coverage.internalEdges).toBe(4);
		expect(validateStructuralSccAnalysis(result, parallelInputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});
});
