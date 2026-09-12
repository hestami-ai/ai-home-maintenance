import { beforeAll, describe, expect, it } from 'vitest';

import type { ModuleDependencyGraphNodeId } from '../contracts/graph.js';
import {
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION,
	STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION,
	type StructuralModuleReachabilityAnalysisInputs,
	type StructuralModuleReachabilityAnalysisRequest,
	type StructuralModuleReachabilityAnalysisSnapshot,
	type StructuralModuleReachabilityDiagnostic
} from '../contracts/structural-module-reachability-analysis.js';
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

let fixture: StructuralSccGraphFixture;

function nodeId(logicalPath: string): ModuleDependencyGraphNodeId {
	const matches = fixture.graph.nodes.filter(
		(node) => node.kind === 'SOURCE' && node.logicalPath === logicalPath
	);
	if (matches.length !== 1) throw new Error(`Expected one fixture source for ${logicalPath}.`);
	return matches[0]!.id;
}

function unresolvedNodeId(): ModuleDependencyGraphNodeId {
	const matches = fixture.graph.nodes.filter((node) => node.kind === 'RESOLUTION_TARGET');
	if (matches.length !== 1) throw new Error('Expected one fixture resolution target.');
	return matches[0]!.id;
}

function requestFor(
	criterionNodeId: ModuleDependencyGraphNodeId,
	direction: StructuralModuleReachabilityAnalysisRequest['direction'] = 'FORWARD',
	budgets: Partial<StructuralModuleReachabilityAnalysisRequest['budgets']> = {}
): StructuralModuleReachabilityAnalysisRequest {
	return {
		budgets: {
			maxDiagnostics: 100,
			maxEdges: fixture.graph.edges.length,
			maxFrontierRecords: fixture.graph.nodes.length,
			maxInputRecords: 1_000_000,
			maxInputStringCharacters: 10_000_000,
			maxNodes: fixture.graph.nodes.length,
			maxReachableNodes: fixture.graph.nodes.length,
			maxTraversalSteps: fixture.graph.nodes.length + fixture.graph.edges.length,
			maxWitnessEdges: fixture.graph.nodes.length,
			...budgets
		},
		criterion: { nodeId: criterionNodeId },
		direction,
		operationVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_REQUEST_SCHEMA_VERSION,
		selection: STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_SELECTION,
		semanticSnapshotId: fixture.snapshot.id,
		sourceGraph: {
			contentDigest: fixture.graph.contentDigest,
			graphId: fixture.graph.id,
			graphInputDigest: fixture.graph.graphInputDigest,
			graphKind: 'TYPESCRIPT_MODULE_DEPENDENCY'
		},
		subjectId: fixture.snapshot.subjectId
	};
}

function inputsFor(
	criterionNodeId: ModuleDependencyGraphNodeId,
	direction: StructuralModuleReachabilityAnalysisRequest['direction'] = 'FORWARD',
	budgets: Partial<StructuralModuleReachabilityAnalysisRequest['budgets']> = {}
): StructuralModuleReachabilityAnalysisInputs {
	return {
		graph: fixture.graph,
		request: requestFor(criterionNodeId, direction, budgets),
		semanticSnapshot: fixture.snapshot
	};
}

function analysisFor(inputs: StructuralModuleReachabilityAnalysisInputs) {
	const outcome = buildStructuralModuleReachabilityAnalysis(inputs);
	if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
	return outcome.analysis;
}

function expectUnavailable(
	inputs: unknown,
	code: StructuralModuleReachabilityDiagnostic['code']
): void {
	expect(
		buildStructuralModuleReachabilityAnalysis(inputs as StructuralModuleReachabilityAnalysisInputs)
	).toMatchObject({
		diagnostics: [expect.objectContaining({ code })],
		outcome: 'unavailable'
	});
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

beforeAll(() => {
	fixture = createStructuralSccGraphFixture();
});

describe('buildStructuralModuleReachabilityAnalysis', () => {
	it('derives an exact forward closure and terminal frontier from the validated fixture graph', () => {
		const inputs = inputsFor(nodeId('src/d.ts'));
		const outcome = buildStructuralModuleReachabilityAnalysis(inputs);
		expect(outcome).toMatchObject({ diagnostics: [], outcome: 'partial' });
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		const analysis = outcome.analysis;

		expect(new Set(analysis.members.map((member) => member.nodeId))).toEqual(
			new Set([nodeId('src/d.ts'), nodeId('src/e.ts'), unresolvedNodeId()])
		);
		expect(analysis.members.filter((member) => member.criterion)).toHaveLength(1);
		expect(analysis.members.find((member) => member.criterion)).toMatchObject({
			distance: 0,
			nodeId: nodeId('src/d.ts'),
			predecessorNodeId: null,
			witnessEdgeId: null
		});
		expect(analysis.coverage).toEqual({
			chargedTraversalSteps: 5,
			criterionReconciles: true,
			encounteredFrontiers: 1,
			examinedEdges: 2,
			inputEdges: 5,
			inputNodes: 7,
			maxDistance: 1,
			memberAccountingReconciles: true,
			reachedNodes: 3,
			resolutionTargetMembers: 1,
			sourceMembers: 2,
			traversalReconciles: true,
			unvisitedNodes: 4,
			witnessAccountingReconciles: true,
			witnessEdges: 2
		});
		expect(analysis.encounteredFrontiers).toHaveLength(1);
		expect(analysis.encounteredFrontiers[0]).toMatchObject({
			nodeId: unresolvedNodeId(),
			reason: 'REACHED_GRAPH_NATIVE_RESOLUTION_TARGET',
			resolutionState: 'UNRESOLVED'
		});
		expect(analysis.upstreamLimitations).toEqual(fixture.graph.limitations);
		expect(analysis.nonclaims).toEqual(STRUCTURAL_MODULE_REACHABILITY_ANALYSIS_NONCLAIMS);
		expect(analysis.truncation).toEqual({ reason: null, state: 'NOT_TRUNCATED' });
		expect(analysis.layers[0].memberIds).toEqual(analysis.members.map((member) => member.id));
		expect(analysis.layers[0].encounteredFrontierIds).toEqual(
			analysis.encounteredFrontiers.map((frontier) => frontier.id)
		);
		expect(analysis.contentDigest).toBe(
			structuralModuleReachabilityAnalysisContentDigest(analysis)
		);
		expect(validateStructuralModuleReachabilityAnalysis(analysis, inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('supports reverse, cyclic, isolated, and resolution-target criteria deterministically', () => {
		for (const [criterion, direction, expected] of [
			[nodeId('src/e.ts'), 'REVERSE', [nodeId('src/d.ts'), nodeId('src/e.ts')]],
			[nodeId('src/a.ts'), 'FORWARD', [nodeId('src/a.ts'), nodeId('src/b.ts')]],
			[nodeId('src/f.ts'), 'FORWARD', [nodeId('src/f.ts')]],
			[unresolvedNodeId(), 'FORWARD', [unresolvedNodeId()]]
		] as const) {
			const inputs = inputsFor(criterion, direction);
			const first = buildStructuralModuleReachabilityAnalysis(inputs);
			const second = buildStructuralModuleReachabilityAnalysis(inputs);
			expect(second).toEqual(first);
			if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));
			expect(new Set(first.analysis.members.map((member) => member.nodeId))).toEqual(
				new Set(expected)
			);
			expect(validateStructuralModuleReachabilityAnalysis(first.analysis, inputs)).toEqual({
				issues: [],
				state: 'VALID'
			});
			expectDeeplyFrozen(first);
		}
	});

	it('keeps consumed-input usage outside the canonical outcome and analysis identity', () => {
		const inputs = inputsFor(nodeId('src/d.ts'));
		const legacy = buildStructuralModuleReachabilityAnalysis(inputs);
		const first = buildStructuralModuleReachabilityAnalysisWithConsumedInputUsage(inputs);
		const second = buildStructuralModuleReachabilityAnalysisWithConsumedInputUsage(inputs);
		expect(first).toEqual(second);
		expect(first.outcome).toEqual(legacy);
		expect(first.consumedInputUsage).toMatchObject({ basis: 'EXACT' });
		expect(Object.isFrozen(first)).toBe(true);
		expect(Object.isFrozen(first.consumedInputUsage)).toBe(true);
		expect(first.outcome).not.toHaveProperty('consumedInputUsage');
		if (first.outcome.outcome !== 'partial') throw new Error(JSON.stringify(first));
		expect(first.outcome.analysis).not.toHaveProperty('consumedInputUsage');
		expect(first.outcome.analysis.contentDigest).toBe(
			structuralModuleReachabilityAnalysisContentDigest(first.outcome.analysis)
		);
	});

	it('refuses every one-below graph, traversal, materialization, witness, and frontier budget', () => {
		const baseInputs = inputsFor(nodeId('src/d.ts'));
		const base = analysisFor(baseInputs);
		for (const [key, actual] of [
			['maxEdges', fixture.graph.edges.length],
			['maxFrontierRecords', base.encounteredFrontiers.length],
			['maxNodes', fixture.graph.nodes.length],
			['maxReachableNodes', base.members.length],
			['maxTraversalSteps', base.coverage.chargedTraversalSteps],
			['maxWitnessEdges', base.coverage.witnessEdges]
		] as const) {
			expect(actual).toBeGreaterThan(0);
			expectUnavailable(
				{
					...baseInputs,
					request: {
						...baseInputs.request,
						budgets: { ...baseInputs.request.budgets, [key]: actual - 1 }
					}
				},
				'BUDGET_EXCEEDED'
			);
		}
	});

	it('fails closed for malformed requests, stale identities, and absent criteria', () => {
		const inputs = inputsFor(nodeId('src/d.ts'));
		for (const candidate of [
			null,
			{ ...inputs, request: { ...inputs.request, unexpected: true } },
			{ ...inputs, request: { ...inputs.request, direction: 'BOTH' } },
			{ ...inputs, request: { ...inputs.request, schemaVersion: 'wrong' } },
			{
				...inputs,
				request: {
					...inputs.request,
					budgets: { ...inputs.request.budgets, maxDiagnostics: 0 }
				}
			}
		])
			expectUnavailable(candidate, 'REQUEST_INVALID');

		for (const staleRequest of [
			{ ...inputs.request, subjectId: `stale-${inputs.request.subjectId}` },
			{
				...inputs.request,
				semanticSnapshotId:
					`${inputs.request.semanticSnapshotId}-stale` as typeof inputs.request.semanticSnapshotId
			},
			{
				...inputs.request,
				sourceGraph: { ...inputs.request.sourceGraph, contentDigest: '0'.repeat(64) }
			}
		])
			expectUnavailable({ ...inputs, request: staleRequest }, 'INPUT_IDENTITY_MISMATCH');

		expectUnavailable(
			{
				...inputs,
				request: {
					...inputs.request,
					criterion: { nodeId: 'graph-node:absent' as ModuleDependencyGraphNodeId }
				}
			},
			'CRITERION_INVALID'
		);
	});

	it('rejects hostile builder and validator shells without invoking accessors', () => {
		const inputs = inputsFor(nodeId('src/d.ts'));
		const base = analysisFor(inputs);
		let requestGetterHits = 0;
		const hostileRequest = { ...inputs.request } as Record<string, unknown>;
		Object.defineProperty(hostileRequest, 'criterion', {
			enumerable: true,
			get() {
				requestGetterHits += 1;
				return inputs.request.criterion;
			}
		});
		expectUnavailable({ ...inputs, request: hostileRequest }, 'REQUEST_INVALID');
		expect(requestGetterHits).toBe(0);

		let candidateGetterHits = 0;
		const hostileCandidate = { ...base } as Record<string, unknown>;
		Object.defineProperty(hostileCandidate, 'members', {
			enumerable: true,
			get() {
				candidateGetterHits += 1;
				return [];
			}
		});
		expect(validateStructuralModuleReachabilityAnalysis(hostileCandidate, inputs)).toMatchObject({
			issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })],
			state: 'INVALID'
		});
		expect(candidateGetterHits).toBe(0);
	});

	it('rejects redigested member, frontier, coverage, layer, limitation, and authority tampering', () => {
		const inputs = inputsFor(nodeId('src/d.ts'));
		const base = analysisFor(inputs);
		for (const candidate of [
			redigested(base, (draft) => {
				(draft as unknown as { members: unknown[] }).members = [];
			}),
			redigested(base, (draft) => {
				(draft as unknown as { encounteredFrontiers: unknown[] }).encounteredFrontiers = [];
			}),
			redigested(base, (draft) => {
				(draft.coverage as { reachedNodes: number }).reachedNodes = 0;
			}),
			redigested(base, (draft) => {
				(draft.layers[0] as unknown as { memberIds: readonly [] }).memberIds = [];
			}),
			redigested(base, (draft) => {
				(draft as unknown as { upstreamLimitations: unknown[] }).upstreamLimitations = [];
			}),
			redigested(base, (draft) => {
				(draft as unknown as { graphAuthority: string }).graphAuthority = 'ASSERTED';
			})
		])
			expect(validateStructuralModuleReachabilityAnalysis(candidate, inputs)).toMatchObject({
				issues: [expect.objectContaining({ code: 'POPULATION_MISMATCH' })],
				state: 'INVALID'
			});
	});
});
