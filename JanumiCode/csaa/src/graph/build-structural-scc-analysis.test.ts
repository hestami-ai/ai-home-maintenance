import { beforeAll, describe, expect, it } from 'vitest';

import {
	STRUCTURAL_SCC_ANALYSIS_NONCLAIMS,
	STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_SCC_ANALYSIS_SELECTION,
	type StructuralSccAnalysisInputs,
	type StructuralSccAnalysisRequest,
	type StructuralSccAnalysisSnapshot,
	type StructuralSccDiagnostic
} from '../contracts/structural-scc-analysis.js';
import { buildStructuralSccAnalysis } from './build-structural-scc-analysis.js';
import { structuralSccAnalysisContentDigest } from './structural-scc-analysis-canonical.js';
import {
	createStructuralSccGraphFixture,
	type StructuralSccGraphFixture
} from './structural-scc-analysis-fixture.test-support.js';
import { validateStructuralSccAnalysis } from './validate-structural-scc-analysis.js';

let fixture: StructuralSccGraphFixture;
let request: StructuralSccAnalysisRequest;
let inputs: StructuralSccAnalysisInputs;

beforeAll(() => {
	fixture = createStructuralSccGraphFixture();
	request = {
		budgets: {
			maxComponents: fixture.graph.nodes.length,
			maxDiagnostics: 100,
			maxEdges: fixture.graph.edges.length,
			maxInputRecords: 1_000_000,
			maxInputStringCharacters: 10_000_000,
			maxNodes: fixture.graph.nodes.length,
			maxTraversalSteps: fixture.graph.nodes.length + fixture.graph.edges.length
		},
		operationVersion: STRUCTURAL_SCC_ANALYSIS_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_SCC_ANALYSIS_REQUEST_SCHEMA_VERSION,
		selection: STRUCTURAL_SCC_ANALYSIS_SELECTION,
		semanticSnapshotId: fixture.snapshot.id,
		sourceGraph: {
			contentDigest: fixture.graph.contentDigest,
			graphId: fixture.graph.id,
			graphInputDigest: fixture.graph.graphInputDigest,
			graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY'
		},
		subjectId: fixture.snapshot.subjectId
	};
	inputs = { graph: fixture.graph, request, semanticSnapshot: fixture.snapshot };
});

function build(candidate: unknown = inputs) {
	return buildStructuralSccAnalysis(candidate as StructuralSccAnalysisInputs);
}

function analysis(): StructuralSccAnalysisSnapshot {
	const outcome = build();
	if (outcome.outcome !== 'partial')
		throw new Error(`Fixture SCC construction failed: ${JSON.stringify(outcome)}`);
	return outcome.analysis;
}

function expectUnavailable(candidate: unknown, code: StructuralSccDiagnostic['code']): void {
	const outcome = build(candidate);
	expect(outcome).toMatchObject({
		diagnostics: [expect.objectContaining({ code })],
		outcome: 'unavailable'
	});
}

function redigested(
	base: StructuralSccAnalysisSnapshot,
	mutate: (draft: StructuralSccAnalysisSnapshot) => void
): StructuralSccAnalysisSnapshot {
	const draft = structuredClone(base) as StructuralSccAnalysisSnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest = structuralSccAnalysisContentDigest(draft);
	return draft;
}

function expectDeeplyFrozen(value: unknown, visited = new WeakSet<object>()): void {
	if (value === null || typeof value !== 'object' || visited.has(value)) return;
	visited.add(value);
	expect(Object.isFrozen(value)).toBe(true);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor)
			expectDeeplyFrozen(descriptor.value, visited);
	}
}

describe('buildStructuralSccAnalysis', () => {
	it('partitions the exact seven-node fixture and independently validates the result', () => {
		const outcome = build();
		expect(outcome).toMatchObject({ diagnostics: [], outcome: 'partial' });
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		const result = outcome.analysis;

		expect(fixture.graph.nodes).toHaveLength(7);
		expect(fixture.graph.edges).toHaveLength(5);
		expect(result.components).toHaveLength(6);
		expect(result.coverage).toEqual({
			chargedTraversalSteps: 12,
			components: 6,
			crossComponentEdges: 2,
			cyclicComponents: 2,
			edgeAccountingReconciles: true,
			inputEdges: 5,
			inputNodes: 7,
			internalEdges: 3,
			isolatedSingletons: 1,
			multiNodeComponents: 1,
			partitionReconciles: true,
			selfLoopSingletons: 1
		});
		expect(
			result.components.filter((component) => component.cycleKind === 'MULTI_NODE')
		).toHaveLength(1);
		expect(
			result.components.filter((component) => component.cycleKind === 'SELF_LOOP_SINGLETON')
		).toHaveLength(1);
		expect(result.componentIndex).toHaveLength(7);
		expect(result.layers[0].componentIds).toEqual(
			result.components.map((component) => component.id)
		);
		expect(result.nonclaims).toEqual(STRUCTURAL_SCC_ANALYSIS_NONCLAIMS);
		expect(result.contentDigest).toBe(structuralSccAnalysisContentDigest(result));
		expect(validateStructuralSccAnalysis(result, inputs)).toEqual({ issues: [], state: 'VALID' });
	});

	it('is deterministic and deeply freezes every returned record and population', () => {
		const first = build();
		const second = build();
		expect(second).toEqual(first);
		expectDeeplyFrozen(first);
	});

	it('enforces each exact one-below materialization and traversal budget', () => {
		const result = analysis();
		for (const [key, actual] of [
			['maxComponents', result.components.length],
			['maxEdges', fixture.graph.edges.length],
			['maxNodes', fixture.graph.nodes.length],
			['maxTraversalSteps', fixture.graph.nodes.length + fixture.graph.edges.length]
		] as const) {
			expect(actual).toBeGreaterThan(0);
			expectUnavailable(
				{
					...inputs,
					request: { ...request, budgets: { ...request.budgets, [key]: actual - 1 } }
				},
				'BUDGET_EXCEEDED'
			);
		}
	});

	it('fails closed for malformed request shells and constants', () => {
		for (const candidate of [
			null,
			{ ...inputs, request: { ...request, unexpected: true } },
			{ ...inputs, request: { ...request, schemaVersion: 'wrong' } },
			{ ...inputs, request: { ...request, operationVersion: 'wrong' } },
			{
				...inputs,
				request: {
					...request,
					budgets: { ...request.budgets, maxDiagnostics: 0 }
				}
			},
			{
				...inputs,
				request: {
					...request,
					selection: { ...request.selection, direction: 'REVERSE' }
				}
			}
		])
			expectUnavailable(candidate, 'REQUEST_INVALID');
	});

	it('fails closed for every request-to-predecessor identity mismatch', () => {
		for (const staleRequest of [
			{ ...request, subjectId: `stale-${request.subjectId}` },
			{
				...request,
				semanticSnapshotId:
					`${request.semanticSnapshotId}-stale` as typeof request.semanticSnapshotId
			},
			{
				...request,
				sourceGraph: {
					...request.sourceGraph,
					graphId: `${request.sourceGraph.graphId}-stale` as typeof request.sourceGraph.graphId
				}
			},
			{
				...request,
				sourceGraph: { ...request.sourceGraph, contentDigest: '0'.repeat(64) }
			},
			{
				...request,
				sourceGraph: { ...request.sourceGraph, graphInputDigest: '0'.repeat(64) }
			}
		])
			expectUnavailable({ ...inputs, request: staleRequest }, 'INPUT_IDENTITY_MISMATCH');
	});

	it('rejects hostile getter candidates and request inputs without invoking them', () => {
		const base = analysis();
		let inputGetterHits = 0;
		const hostileRequest = { ...request } as Record<string, unknown>;
		Object.defineProperty(hostileRequest, 'subjectId', {
			enumerable: true,
			get() {
				inputGetterHits += 1;
				return request.subjectId;
			}
		});
		expectUnavailable({ ...inputs, request: hostileRequest }, 'REQUEST_INVALID');
		expect(inputGetterHits).toBe(0);

		let candidateGetterHits = 0;
		const hostileCandidate = { ...base } as Record<string, unknown>;
		Object.defineProperty(hostileCandidate, 'components', {
			enumerable: true,
			get() {
				candidateGetterHits += 1;
				return [];
			}
		});
		expect(validateStructuralSccAnalysis(hostileCandidate, inputs)).toMatchObject({
			issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })],
			state: 'INVALID'
		});
		expect(candidateGetterHits).toBe(0);

		let validatorInputGetterHits = 0;
		const hostileInputs = { ...inputs } as Record<string, unknown>;
		Object.defineProperty(hostileInputs, 'request', {
			enumerable: true,
			get() {
				validatorInputGetterHits += 1;
				return request;
			}
		});
		expect(
			validateStructuralSccAnalysis(base, hostileInputs as unknown as StructuralSccAnalysisInputs)
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'INPUT_INVALID' })],
			state: 'INVALID'
		});
		expect(validatorInputGetterHits).toBe(0);
	});

	it('rejects redigested population, index, layer, coverage, and nonclaim tampering', () => {
		const base = analysis();
		for (const candidate of [
			redigested(base, (draft) => {
				(draft as unknown as { components: unknown[] }).components = [];
			}),
			redigested(base, (draft) => {
				(draft as unknown as { componentIndex: unknown[] }).componentIndex = [];
			}),
			redigested(base, (draft) => {
				(draft.layers[0].componentIds as unknown as string[]).splice(0);
			}),
			redigested(base, (draft) => {
				(draft.coverage as { components: number }).components = 0;
			}),
			redigested(base, (draft) => {
				(draft as unknown as { nonclaims: string[] }).nonclaims = [];
			})
		])
			expect(validateStructuralSccAnalysis(candidate, inputs)).toMatchObject({
				issues: [expect.objectContaining({ code: 'POPULATION_MISMATCH' })],
				state: 'INVALID'
			});
	});
});
