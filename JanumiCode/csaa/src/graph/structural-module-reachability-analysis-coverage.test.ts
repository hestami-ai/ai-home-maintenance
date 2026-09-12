import { beforeAll, describe, expect, it } from 'vitest';

import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type ModuleDependencyGraphNodeId
} from '../contracts/graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import {
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION,
	type StructuralModuleReachabilityAnalysisInputs,
	type StructuralModuleReachabilityAnalysisRequest,
	type StructuralModuleReachabilityAnalysisSnapshot,
	type StructuralModuleReachabilityDiagnostic,
	type StructuralModuleReachabilityValidationOptions
} from '../contracts/structural-module-reachability-analysis.js';
import { buildModuleDependencyGraph } from './build-module-dependency-graph.js';
import {
	buildStructuralModuleReachabilityAnalysis,
	buildStructuralModuleReachabilityAnalysisWithConsumedInputUsage
} from './build-structural-module-reachability-analysis.js';
import { structuralModuleReachabilityAnalysisContentDigest } from './structural-module-reachability-analysis-canonical.js';
import {
	createStructuralSccGraphFixture,
	type StructuralSccGraphFixture
} from './structural-scc-analysis-fixture.test-support.js';
import { validateStructuralModuleReachabilityAnalysis } from './validate-structural-module-reachability-analysis.js';

let baseFixture: StructuralSccGraphFixture;

beforeAll(() => {
	baseFixture = createStructuralSccGraphFixture();
});

function nodeId(
	value: StructuralSccGraphFixture,
	logicalPath: string
): ModuleDependencyGraphNodeId {
	const matches = value.graph.nodes.filter(
		(node) => node.kind === 'SOURCE' && node.logicalPath === logicalPath
	);
	if (matches.length !== 1) throw new Error(`Expected one fixture source for ${logicalPath}.`);
	return matches[0]!.id;
}

function requestFor(
	value: StructuralSccGraphFixture,
	criterionNodeId: ModuleDependencyGraphNodeId,
	direction: StructuralModuleReachabilityAnalysisRequest['direction'] = 'FORWARD',
	budgets: Partial<StructuralModuleReachabilityAnalysisRequest['budgets']> = {}
): StructuralModuleReachabilityAnalysisRequest {
	return {
		budgets: {
			maxDiagnostics: 100,
			maxEdges: value.graph.edges.length,
			maxFrontierRecords: value.graph.nodes.length,
			maxInputRecords: 1_000_000,
			maxInputStringCharacters: 10_000_000,
			maxNodes: value.graph.nodes.length,
			maxReachableNodes: value.graph.nodes.length,
			maxTraversalSteps: value.graph.nodes.length + value.graph.edges.length,
			maxWitnessEdges: value.graph.nodes.length,
			...budgets
		},
		criterion: { nodeId: criterionNodeId },
		direction,
		operationVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION,
		selection: { ...STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION },
		semanticSnapshotId: value.snapshot.id,
		sourceGraph: {
			contentDigest: value.graph.contentDigest,
			graphId: value.graph.id,
			graphInputDigest: value.graph.graphInputDigest,
			graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY'
		},
		subjectId: value.snapshot.subjectId
	};
}

function inputsFor(
	value: StructuralSccGraphFixture,
	criterionNodeId = nodeId(value, 'src/d.ts'),
	direction: StructuralModuleReachabilityAnalysisRequest['direction'] = 'FORWARD',
	budgets: Partial<StructuralModuleReachabilityAnalysisRequest['budgets']> = {}
): StructuralModuleReachabilityAnalysisInputs {
	return {
		graph: value.graph,
		request: requestFor(value, criterionNodeId, direction, budgets),
		semanticSnapshot: value.snapshot
	};
}

function analysisFor(
	inputs: StructuralModuleReachabilityAnalysisInputs
): StructuralModuleReachabilityAnalysisSnapshot {
	const outcome = buildStructuralModuleReachabilityAnalysis(inputs);
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	return outcome.analysis;
}

function expectUnavailable(
	inputs: unknown,
	code: StructuralModuleReachabilityDiagnostic['code'],
	message?: string
): void {
	expect(
		buildStructuralModuleReachabilityAnalysis(inputs as StructuralModuleReachabilityAnalysisInputs)
	).toMatchObject({
		diagnostics: [expect.objectContaining({ code, ...(message === undefined ? {} : { message }) })],
		outcome: 'unavailable'
	});
}

function expectValidation(
	candidate: unknown,
	inputs: StructuralModuleReachabilityAnalysisInputs,
	code: string,
	state: 'BUDGET_EXHAUSTED' | 'INVALID' = 'INVALID',
	options?: StructuralModuleReachabilityValidationOptions
): void {
	expect(validateStructuralModuleReachabilityAnalysis(candidate, inputs, options)).toMatchObject({
		issues: [expect.objectContaining({ code })],
		state
	});
}

function cloneInputs(
	inputs: StructuralModuleReachabilityAnalysisInputs
): StructuralModuleReachabilityAnalysisInputs {
	return structuredClone(inputs) as StructuralModuleReachabilityAnalysisInputs;
}

function redigested(
	base: StructuralModuleReachabilityAnalysisSnapshot,
	mutate: (draft: StructuralModuleReachabilityAnalysisSnapshot) => void
): StructuralModuleReachabilityAnalysisSnapshot {
	const draft = structuredClone(base) as StructuralModuleReachabilityAnalysisSnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest =
		structuralModuleReachabilityAnalysisContentDigest(draft);
	return draft;
}

function parallelTieFixture(): StructuralSccGraphFixture {
	const snapshot = structuredClone(baseFixture.snapshot) as StaticSemanticSnapshot;
	const sources = new Map(
		snapshot.sources.map((source) => [source.logicalPath, source.id] as const)
	);
	const template = snapshot.moduleResolutions.find(
		(resolution) =>
			resolution.sourceId === sources.get('src/d.ts') &&
			resolution.targetSourceId === sources.get('src/e.ts')
	);
	if (template === undefined) throw new Error('Expected the fixture d-to-e resolution.');
	const templateNode = snapshot.astNodes.find((node) => node.id === template.nodeId);
	if (templateNode === undefined) throw new Error('Expected the fixture d-to-e occurrence.');
	const templateProvenance = snapshot.provenances.find(
		(provenance) => provenance.id === template.provenanceId
	);
	if (templateProvenance === undefined) throw new Error('Expected the fixture d-to-e provenance.');

	const additions = [
		['d-e-parallel', 'src/d.ts', 'src/e.ts'],
		['d-a', 'src/d.ts', 'src/a.ts'],
		['d-b', 'src/d.ts', 'src/b.ts'],
		['a-c', 'src/a.ts', 'src/c.ts'],
		['b-c', 'src/b.ts', 'src/c.ts'],
		['a-missing', 'src/a.ts', null],
		['b-missing', 'src/b.ts', null]
	] as const;
	const astNodes = [...snapshot.astNodes];
	const provenances = [...snapshot.provenances];
	const resolutions = [...snapshot.moduleResolutions];
	for (const [ordinal, [name, fromPath, toPath]] of additions.entries()) {
		const sourceId = sources.get(fromPath);
		const targetSourceId = toPath === null ? null : sources.get(toPath);
		if (sourceId === undefined || targetSourceId === undefined)
			throw new Error(`Fixture source is absent for ${name}.`);
		const nodeId = `semantic:structural-reachability-${name}-node` as typeof template.nodeId;
		const provenanceId =
			`semantic:structural-reachability-${name}-provenance` as typeof template.provenanceId;
		astNodes.push({
			...templateNode,
			end: 64 + ordinal * 5,
			id: nodeId,
			sourceId,
			start: 60 + ordinal * 5
		});
		provenances.push({ ...templateProvenance, id: provenanceId });
		resolutions.push({
			...template,
			id: `semantic:structural-reachability-${name}-resolution` as typeof template.id,
			nodeId,
			provenanceId,
			resolutionState: toPath === null ? 'UNRESOLVED' : 'RESOLVED_SOURCE',
			sourceId,
			specifier: toPath === null ? `./${name}.js` : `./${toPath.slice(4)}`,
			targetSourceId
		});
	}
	(snapshot as unknown as { astNodes: typeof astNodes }).astNodes = astNodes;
	(snapshot as unknown as { provenances: typeof provenances }).provenances = provenances;
	(snapshot as unknown as { moduleResolutions: typeof resolutions }).moduleResolutions =
		resolutions;
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
	return { graph: outcome.graph, snapshot };
}

describe('structural module reachability boundary coverage', { timeout: 60_000 }, () => {
	it('rejects every malformed nested request population and predecessor shell without access', () => {
		const inputs = inputsFor(baseFixture);
		for (const request of [
			{ ...inputs.request, budgets: { ...inputs.request.budgets, extra: 1 } },
			{ ...inputs.request, criterion: { ...inputs.request.criterion, extra: true } },
			{ ...inputs.request, sourceGraph: { ...inputs.request.sourceGraph, extra: true } },
			{ ...inputs.request, selection: { ...inputs.request.selection, extra: true } }
		])
			expectUnavailable({ ...inputs, request }, 'REQUEST_INVALID');

		const inheritedGraph = Object.assign(Object.create({ hostile: true }), inputs.graph);
		expectUnavailable(
			{ ...inputs, graph: inheritedGraph },
			'REQUEST_INVALID',
			'The structural module reachability input shell must contain exact data properties.'
		);
	});

	it('rejects unsafe consumed input populations and enforces both input budgets', () => {
		const base = inputsFor(baseFixture);
		const measuredBase = buildStructuralModuleReachabilityAnalysisWithConsumedInputUsage(base);
		expect(measuredBase.outcome).toMatchObject({ outcome: 'partial' });
		expect(measuredBase.consumedInputUsage).toEqual({
			basis: 'EXACT',
			records: 692,
			stringUtf16CodeUnits: 17_240
		});
		// Exact consumed-record and UTF-16 code-unit populations of the frozen fixture.
		for (const budgets of [{ maxInputRecords: 692 }, { maxInputStringCharacters: 17_240 }])
			expect(
				buildStructuralModuleReachabilityAnalysis({
					...base,
					request: {
						...base.request,
						budgets: { ...base.request.budgets, ...budgets }
					}
				})
			).toMatchObject({ outcome: 'partial' });
		const nonEnumerableSemantic = cloneInputs(base);
		Object.defineProperty(nonEnumerableSemantic.semanticSnapshot, 'extractionVersion', {
			enumerable: false,
			value: nonEnumerableSemantic.semanticSnapshot.extractionVersion
		});
		expectUnavailable(nonEnumerableSemantic, 'SOURCE_GRAPH_INVALID');

		const sparse = cloneInputs(base);
		const sparseNodes = [...sparse.graph.nodes];
		delete sparseNodes[0];
		(sparse.graph as unknown as { nodes: unknown[] }).nodes = sparseNodes;
		expectUnavailable(sparse, 'SOURCE_GRAPH_INVALID');

		const accessorElement = cloneInputs(base);
		const accessorNodes = [...accessorElement.graph.nodes];
		Object.defineProperty(accessorNodes, '0', {
			enumerable: true,
			get: () => accessorElement.graph.nodes[0]
		});
		(accessorElement.graph as unknown as { nodes: unknown[] }).nodes = accessorNodes;
		expectUnavailable(accessorElement, 'SOURCE_GRAPH_INVALID');

		const accessorProperty = cloneInputs(base);
		const firstNode = { ...accessorProperty.graph.nodes[0]! } as Record<string, unknown>;
		Object.defineProperty(firstNode, 'id', {
			enumerable: true,
			get: () => accessorProperty.graph.nodes[0]!.id
		});
		(accessorProperty.graph as unknown as { nodes: unknown[] }).nodes = [
			firstNode,
			...accessorProperty.graph.nodes.slice(1)
		];
		expectUnavailable(accessorProperty, 'SOURCE_GRAPH_INVALID');

		for (const [key, limit] of [
			['maxInputRecords', 691],
			['maxInputStringCharacters', 17_239]
		] as const) {
			const measured = buildStructuralModuleReachabilityAnalysisWithConsumedInputUsage({
				...base,
				request: {
					...base.request,
					budgets: { ...base.request.budgets, [key]: limit }
				}
			});
			expect(measured.outcome).toMatchObject({
				diagnostics: [
					expect.objectContaining({
						code: 'BUDGET_EXCEEDED',
						message: 'The consumed predecessor projection exceeds an input budget.'
					})
				],
				outcome: 'unavailable'
			});
			expect(measured.consumedInputUsage).toMatchObject({ basis: 'LOWER_BOUND' });
			const measuredValue =
				key === 'maxInputRecords'
					? measured.consumedInputUsage?.records
					: measured.consumedInputUsage?.stringUtf16CodeUnits;
			expect(measuredValue).toBeGreaterThan(0);
			expect(measuredValue).toBeLessThanOrEqual(key === 'maxInputRecords' ? 692 : 17_240);
			if (key === 'maxInputStringCharacters') expect(measuredValue).toBeGreaterThan(limit);
		}
	});

	it('classifies scalar, cycle, prototype, key, and array-population hostility in consumed input', () => {
		const base = inputsFor(baseFixture);
		expectUnavailable(
			{ ...base, request: { ...base.request, subjectId: '\ud800' } },
			'REQUEST_INVALID'
		);
		const sameCardinalityWrongKey = { ...base.request.budgets } as Record<string, unknown>;
		delete sameCardinalityWrongKey.maxEdges;
		sameCardinalityWrongKey.notMaxEdges = base.request.budgets.maxEdges;
		expectUnavailable(
			{ ...base, request: { ...base.request, budgets: sameCardinalityWrongKey } },
			'REQUEST_INVALID'
		);

		const unicode = cloneInputs(base);
		const sourceNode = unicode.graph.nodes.find((node) => node.kind === 'SOURCE')!;
		(sourceNode as { logicalPath: string }).logicalPath = '\ud800';
		expectUnavailable(unicode, 'SOURCE_GRAPH_INVALID');

		const primitive = cloneInputs(base);
		(primitive.graph.coverage as unknown as { closure: undefined }).closure = undefined;
		expectUnavailable(primitive, 'SOURCE_GRAPH_INVALID');

		const cycle = cloneInputs(base);
		(cycle.graph.coverage as unknown as { self: unknown }).self = cycle.graph.coverage;
		expectUnavailable(cycle, 'SOURCE_GRAPH_INVALID');

		class HostileNodes extends Array<(typeof base.graph.nodes)[number]> {}
		const inheritedArray = cloneInputs(base);
		(inheritedArray.graph as unknown as { nodes: unknown[] }).nodes = new HostileNodes(
			...inheritedArray.graph.nodes
		);
		expectUnavailable(inheritedArray, 'SOURCE_GRAPH_INVALID');

		const oversizedArray = cloneInputs(base);
		(oversizedArray.graph as unknown as { nodes: unknown[] }).nodes = Array.from(
			{ length: 2_000 },
			() => oversizedArray.graph.nodes[0]
		);
		(
			oversizedArray as unknown as { request: StructuralModuleReachabilityAnalysisRequest }
		).request = {
			...oversizedArray.request,
			budgets: { ...oversizedArray.request.budgets, maxInputRecords: 1_000 }
		};
		const oversizedMeasured =
			buildStructuralModuleReachabilityAnalysisWithConsumedInputUsage(oversizedArray);
		expect(oversizedMeasured.outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});
		expect(oversizedMeasured.consumedInputUsage).toMatchObject({ basis: 'LOWER_BOUND' });
		expect(oversizedMeasured.consumedInputUsage?.records).toBeGreaterThan(0);
		expect(oversizedMeasured.consumedInputUsage?.records).toBeLessThanOrEqual(1_000);

		const sparseOversizedArray = cloneInputs(base);
		const sparseOversizedNodes = new Array(2_000) as unknown[];
		sparseOversizedNodes[0] = sparseOversizedArray.graph.nodes[0];
		(sparseOversizedArray.graph as unknown as { nodes: unknown[] }).nodes = sparseOversizedNodes;
		(
			sparseOversizedArray as unknown as {
				request: StructuralModuleReachabilityAnalysisRequest;
			}
		).request = {
			...sparseOversizedArray.request,
			budgets: { ...sparseOversizedArray.request.budgets, maxInputRecords: 1_000 }
		};
		const sparseOversizedMeasured =
			buildStructuralModuleReachabilityAnalysisWithConsumedInputUsage(sparseOversizedArray);
		expect(sparseOversizedMeasured.outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});
		expect(sparseOversizedMeasured.consumedInputUsage).toMatchObject({ basis: 'LOWER_BOUND' });
		expect(sparseOversizedMeasured.consumedInputUsage?.records).toBeGreaterThan(0);
		expect(sparseOversizedMeasured.consumedInputUsage?.records).toBeLessThanOrEqual(1_000);

		const inheritedRecord = cloneInputs(base);
		(inheritedRecord.graph as unknown as { coverage: object }).coverage = Object.assign(
			Object.create(null),
			inheritedRecord.graph.coverage
		);
		expectUnavailable(inheritedRecord, 'SOURCE_GRAPH_INVALID');

		const symbolKey = cloneInputs(base);
		(symbolKey.graph.coverage as unknown as Record<symbol, unknown>)[Symbol('hostile')] = true;
		expectUnavailable(symbolKey, 'SOURCE_GRAPH_INVALID');
	});

	it('honors zero-capacity result budgets and distinguishes traversal edge charging', () => {
		const isolated = inputsFor(baseFixture, nodeId(baseFixture, 'src/f.ts'), 'FORWARD', {
			maxFrontierRecords: 0,
			maxReachableNodes: 1,
			maxTraversalSteps: 1,
			maxWitnessEdges: 0
		});
		const isolatedAnalysis = analysisFor(isolated);
		expect(isolatedAnalysis).toMatchObject({
			coverage: { chargedTraversalSteps: 1, reachedNodes: 1, witnessEdges: 0 },
			encounteredFrontiers: []
		});

		for (const budgets of [{ maxReachableNodes: 0 }, { maxTraversalSteps: 0 }])
			expectUnavailable(
				inputsFor(baseFixture, nodeId(baseFixture, 'src/d.ts'), 'FORWARD', budgets),
				'BUDGET_EXCEEDED'
			);
		expectUnavailable(
			inputsFor(baseFixture, nodeId(baseFixture, 'src/d.ts'), 'FORWARD', {
				maxTraversalSteps: 1
			}),
			'BUDGET_EXCEEDED',
			'The structural module reachability traversal exceeds a traversal, reachable-node, or witness budget.'
		);
	});

	it('rejects stale graph identities and an independently invalid predecessor', () => {
		const inputs = inputsFor(baseFixture);
		for (const sourceGraph of [
			{ ...inputs.request.sourceGraph, graphId: `${inputs.request.sourceGraph.graphId}-stale` },
			{
				...inputs.request.sourceGraph,
				graphInputDigest: `${inputs.request.sourceGraph.graphInputDigest}-stale`
			}
		])
			expectUnavailable(
				{ ...inputs, request: { ...inputs.request, sourceGraph } },
				'INPUT_IDENTITY_MISMATCH'
			);

		const invalid = cloneInputs(inputs);
		(invalid.graph.coverage as { reconciles: boolean }).reconciles = false;
		expectUnavailable(
			invalid,
			'SOURCE_GRAPH_INVALID',
			'The source graph is not independently valid.'
		);
	});

	it('fails closed on hostile array population and property access before predecessor validation', () => {
		const inputs = inputsFor(baseFixture);
		const hostileArray = cloneInputs(inputs);
		(hostileArray.graph as unknown as { nodes: unknown }).nodes = new Proxy(
			[...hostileArray.graph.nodes],
			{}
		);
		expectUnavailable(
			hostileArray,
			'SOURCE_GRAPH_INVALID',
			'The consumed predecessor projection is not safe plain data.'
		);

		const throwingGraph = { ...inputs.graph } as Record<string, unknown>;
		Object.defineProperty(throwingGraph, 'nodes', {
			enumerable: true,
			value: new Proxy([...inputs.graph.nodes], {
				getOwnPropertyDescriptor() {
					throw new Error('hostile descriptor');
				}
			})
		});
		expectUnavailable(
			{ ...inputs, graph: throwingGraph },
			'SOURCE_GRAPH_INVALID',
			'The consumed predecessor projection is not safe plain data.'
		);
	});

	it('validates canonical witnesses for parallel edges and equal-distance predecessor ties', () => {
		const value = parallelTieFixture();
		const inputs = inputsFor(value, nodeId(value, 'src/d.ts'));
		const first = analysisFor(inputs);
		const second = analysisFor(inputs);
		expect(second).toEqual(first);

		const d = nodeId(value, 'src/d.ts');
		const e = nodeId(value, 'src/e.ts');
		const a = nodeId(value, 'src/a.ts');
		const b = nodeId(value, 'src/b.ts');
		const c = nodeId(value, 'src/c.ts');
		const parallelEdges = value.graph.edges
			.filter((edge) => edge.source.nodeId === d && edge.target.nodeId === e)
			.map((edge) => edge.id)
			.sort();
		expect(parallelEdges).toHaveLength(2);
		expect(first.members.find((member) => member.nodeId === e)).toMatchObject({
			predecessorNodeId: d,
			witnessEdgeId: parallelEdges[0]
		});
		expect(first.members.find((member) => member.nodeId === c)).toMatchObject({
			distance: 2,
			predecessorNodeId: [a, b].sort()[0]
		});
		expect(validateStructuralModuleReachabilityAnalysis(first, inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});

		const reverseInputs = inputsFor(value, c, 'REVERSE');
		const reverse = analysisFor(reverseInputs);
		expect(new Set(reverse.members.map((member) => member.nodeId))).toEqual(new Set([a, b, c, d]));
		expect(validateStructuralModuleReachabilityAnalysis(reverse, reverseInputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('bounds hostile validation trees before inspecting candidate semantics', () => {
		const inputs = inputsFor(baseFixture);
		const shared = { leaf: 1 };
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		class HostileArray extends Array<unknown> {}
		const accessorArray: unknown[] = [1];
		Object.defineProperty(accessorArray, '0', { enumerable: true, get: () => 1 });
		const symbolRecord = { [Symbol('hostile')]: true };
		const unicodeKeyRecord = { ['\ud800']: true };

		for (const [candidate, code, state, options] of [
			[{ a: shared, b: shared }, 'BUDGET_EXHAUSTED', 'BUDGET_EXHAUSTED', { maxRecords: 3 }],
			[{ a: { b: true } }, 'BUDGET_EXHAUSTED', 'BUDGET_EXHAUSTED', { maxDepth: 1 }],
			['\ud800', 'SHAPE_INVALID', 'INVALID', undefined],
			['long', 'BUDGET_EXHAUSTED', 'BUDGET_EXHAUSTED', { maxStringCharacters: 1 }],
			[undefined, 'SHAPE_INVALID', 'INVALID', undefined],
			[new Proxy({}, {}), 'SHAPE_INVALID', 'INVALID', undefined],
			[cycle, 'SHAPE_INVALID', 'INVALID', undefined],
			[{ a: shared, b: shared }, 'SHAPE_INVALID', 'INVALID', undefined],
			[new HostileArray(), 'SHAPE_INVALID', 'INVALID', undefined],
			[[1], 'BUDGET_EXHAUSTED', 'BUDGET_EXHAUSTED', { maxRecords: 1 }],
			[new Array(1), 'SHAPE_INVALID', 'INVALID', undefined],
			[accessorArray, 'SHAPE_INVALID', 'INVALID', undefined],
			[Object.create(null), 'SHAPE_INVALID', 'INVALID', undefined],
			[symbolRecord, 'SHAPE_INVALID', 'INVALID', undefined],
			[{ property: true }, 'BUDGET_EXHAUSTED', 'BUDGET_EXHAUSTED', { maxRecords: 1 }],
			[unicodeKeyRecord, 'SHAPE_INVALID', 'INVALID', undefined]
		] as const)
			expectValidation(
				candidate,
				inputs,
				code,
				state,
				options as StructuralModuleReachabilityValidationOptions | undefined
			);
	});

	it('rejects hostile options, candidate shells, input shells, and request boundaries', () => {
		const inputs = inputsFor(baseFixture);
		const analysis = analysisFor(inputs);
		for (const options of [
			{ extra: 1 },
			{ maxRecords: 0 },
			{ maxIssues: 100_001 },
			Object.assign(Object.create({ hostile: true }), { maxRecords: 100 })
		])
			expectValidation(analysis, inputs, 'SHAPE_INVALID', 'INVALID', options as never);

		expectValidation({ ...analysis, extra: true }, inputs, 'SHAPE_INVALID');
		expectValidation(analysis, null as never, 'INPUT_INVALID');
		expectValidation(analysis, { ...inputs, extra: true } as never, 'INPUT_INVALID');

		const inheritedGraphInputs = cloneInputs(inputs);
		(inheritedGraphInputs as unknown as { graph: object }).graph = Object.assign(
			Object.create({ hostile: true }),
			inheritedGraphInputs.graph
		);
		expectValidation(analysis, inheritedGraphInputs, 'INPUT_INVALID');

		const nonEnumerableSemantic = cloneInputs(inputs);
		Object.defineProperty(nonEnumerableSemantic.semanticSnapshot, 'health', {
			enumerable: false,
			value: nonEnumerableSemantic.semanticSnapshot.health
		});
		expectValidation(analysis, nonEnumerableSemantic, 'INPUT_INVALID');

		const sparseInput = cloneInputs(inputs);
		const sparseNodes = [...sparseInput.graph.nodes];
		delete sparseNodes[0];
		(sparseInput.graph as unknown as { nodes: unknown[] }).nodes = sparseNodes;
		expectValidation(analysis, sparseInput, 'INPUT_INVALID');

		const invalidRequestShell = { ...inputs, request: [] as never };
		expectValidation(analysis, invalidRequestShell, 'INPUT_INVALID');
		expectValidation(
			analysis,
			{
				...inputs,
				request: { ...inputs.request, criterion: { ...inputs.request.criterion, extra: 1 } }
			} as unknown as StructuralModuleReachabilityAnalysisInputs,
			'INPUT_INVALID'
		);
		expectValidation(
			analysis,
			{
				...inputs,
				request: {
					...inputs.request,
					selection: { ...inputs.request.selection, witnessPolicy: 'QUEUE_ORDER' as never }
				}
			},
			'INPUT_INVALID'
		);
		expectValidation(
			analysis,
			{ ...inputs, request: { ...inputs.request, subjectId: `${inputs.request.subjectId}-stale` } },
			'INPUT_INVALID'
		);
		expectValidation(
			analysis,
			{
				...inputs,
				graph: { ...inputs.graph, nodes: {} as never }
			},
			'INPUT_INVALID'
		);
		expectValidation(
			analysis,
			{
				...inputs,
				request: { ...inputs.request, budgets: { ...inputs.request.budgets, maxNodes: 0 } }
			},
			'BUDGET_EXHAUSTED',
			'BUDGET_EXHAUSTED'
		);
		expectValidation(
			analysis,
			{
				...inputs,
				request: {
					...inputs.request,
					criterion: { nodeId: 'graph-node:absent' as ModuleDependencyGraphNodeId }
				}
			},
			'INPUT_INVALID'
		);
	});

	it('applies request input ceilings and independently rejects invalid predecessors', () => {
		const inputs = inputsFor(baseFixture);
		const analysis = analysisFor(inputs);
		expectValidation(
			analysis,
			{
				...inputs,
				request: {
					...inputs.request,
					budgets: { ...inputs.request.budgets, maxInputRecords: 1 }
				}
			},
			'BUDGET_EXHAUSTED',
			'BUDGET_EXHAUSTED'
		);

		const invalid = cloneInputs(inputs);
		(invalid.graph.coverage as { reconciles: boolean }).reconciles = false;
		expectValidation(analysis, invalid, 'INPUT_INVALID');
	});

	it('independently exhausts each traversal and frontier budget at its exact boundary', () => {
		const inputs = inputsFor(baseFixture);
		const analysis = analysisFor(inputs);
		for (const budgets of [
			{ maxTraversalSteps: 0 },
			{ maxTraversalSteps: 1 },
			{ maxReachableNodes: 1 },
			{ maxWitnessEdges: 0 },
			{ maxFrontierRecords: 0 }
		])
			expectValidation(
				analysis,
				{
					...inputs,
					request: { ...inputs.request, budgets: { ...inputs.request.budgets, ...budgets } }
				},
				'BUDGET_EXHAUSTED',
				'BUDGET_EXHAUSTED'
			);
	});

	it('distinguishes redigested identity drift from a stale content digest', () => {
		const inputs = inputsFor(baseFixture);
		const analysis = analysisFor(inputs);
		const identityDrift = redigested(analysis, (draft) => {
			(draft as { id: string }).id = `${draft.id}-drift`;
		});
		expectValidation(identityDrift, inputs, 'IDENTITY_MISMATCH');

		const staleDigest = structuredClone(analysis) as StructuralModuleReachabilityAnalysisSnapshot;
		(staleDigest.coverage as { reachedNodes: number }).reachedNodes += 1;
		expectValidation(staleDigest, inputs, 'CONTENT_DIGEST_MISMATCH');
	});

	it('requires the validator public API argument cardinality', () => {
		const inputs = inputsFor(baseFixture);
		const analysis = analysisFor(inputs);
		const call = validateStructuralModuleReachabilityAnalysis as unknown as (
			...args: readonly unknown[]
		) => unknown;
		expect(call(analysis)).toMatchObject({
			issues: [expect.objectContaining({ code: 'SHAPE_INVALID', path: '$arguments' })],
			state: 'INVALID'
		});
		expect(call(analysis, inputs, undefined, {})).toMatchObject({
			issues: [expect.objectContaining({ code: 'SHAPE_INVALID', path: '$arguments' })],
			state: 'INVALID'
		});
	});
});
