import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
	ModuleDependencyGraphNodeId,
	ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import { createLogicalGraphCompositionFixture } from '../graph/logical-graph-composition-fixture.test-support.js';
import {
	createStructuralSccGraphFixture,
	type StructuralSccGraphFixture
} from '../graph/structural-scc-analysis-fixture.test-support.js';
import {
	MODULE_CODE_SLICE_NONCLAIMS,
	MODULE_CODE_SLICE_OPERATION_VERSION,
	MODULE_CODE_SLICE_POLICY,
	MODULE_CODE_SLICE_REQUEST_SCHEMA_VERSION,
	buildModuleCodeSlice,
	validateModuleCodeSliceOutcome,
	type ModuleCodeSliceBudgets,
	type ModuleCodeSliceOutcome,
	type ModuleCodeSliceRequest
} from './module-code-slice.js';

interface Fixture {
	readonly cleanup: () => void;
	readonly graph: ModuleDependencyGraphSnapshot;
	readonly indexNodeId: ModuleDependencyGraphNodeId;
	readonly libraryNodeId: ModuleDependencyGraphNodeId;
	readonly snapshot: StaticSemanticSnapshot;
}

const defaultBudgets: ModuleCodeSliceBudgets = {
	maxDepth: 100,
	maxFrontiers: 100,
	maxInputEdges: 10_000,
	maxInputNodes: 10_000,
	maxMembers: 10_000,
	maxResultBytes: 16 * 1024 * 1024,
	maxTraversalSteps: 100_000,
	maxWitnessEdges: 100_000
};

let fixture: Fixture;
let structuralFixture: StructuralSccGraphFixture;

beforeAll(() => {
	const created = createLogicalGraphCompositionFixture();
	const sources = created.moduleDependencyGraph.nodes.filter(
		(
			node
		): node is Extract<(typeof created.moduleDependencyGraph.nodes)[number], { kind: 'SOURCE' }> =>
			node.kind === 'SOURCE'
	);
	const indexNode = sources.find((node) => node.logicalPath.endsWith('/src/index.ts'));
	const libraryNode = sources.find((node) => node.logicalPath.endsWith('/src/library.ts'));
	if (indexNode === undefined || libraryNode === undefined)
		throw new Error('Expected both fixture source nodes.');
	fixture = {
		cleanup: created.cleanup,
		graph: created.moduleDependencyGraph,
		indexNodeId: indexNode.id,
		libraryNodeId: libraryNode.id,
		snapshot: created.snapshot
	};
	structuralFixture = createStructuralSccGraphFixture();
});

afterAll(() => fixture.cleanup());

function request(
	direction: ModuleCodeSliceRequest['direction'],
	overrides: Partial<ModuleCodeSliceRequest> = {}
): ModuleCodeSliceRequest {
	return {
		budgets: defaultBudgets,
		direction,
		edgeFamilies: ['IMPORT_OCCURRENCE'],
		fromNodeId: fixture.indexNodeId,
		graphId: fixture.graph.id,
		operationVersion: MODULE_CODE_SLICE_OPERATION_VERSION,
		policy: { ...MODULE_CODE_SLICE_POLICY },
		schemaVersion: MODULE_CODE_SLICE_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: fixture.snapshot.id,
		subjectId: fixture.snapshot.subjectId,
		toNodeId: direction === 'CHOP' ? fixture.libraryNodeId : null,
		...overrides
	};
}

function available(outcome: ModuleCodeSliceOutcome) {
	if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
	return outcome;
}

function expectUnavailable(candidate: unknown, code: string): void {
	expect(buildModuleCodeSlice(candidate, fixture.graph, fixture.snapshot)).toMatchObject({
		diagnostics: [{ code }],
		outcome: 'unavailable'
	});
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

function structuralNode(logicalPath: string): ModuleDependencyGraphNodeId {
	const matches = structuralFixture.graph.nodes.filter(
		(node) => node.kind === 'SOURCE' && node.logicalPath === logicalPath
	);
	if (matches.length !== 1)
		throw new Error(`Expected one structural fixture node for ${logicalPath}.`);
	return matches[0]!.id;
}

function structuralRequest(
	fromNodeId: ModuleDependencyGraphNodeId,
	overrides: Partial<ModuleCodeSliceRequest> = {}
): ModuleCodeSliceRequest {
	return {
		...request('FORWARD'),
		fromNodeId,
		graphId: structuralFixture.graph.id,
		semanticSnapshotId: structuralFixture.snapshot.id,
		subjectId: structuralFixture.snapshot.subjectId,
		...overrides
	};
}

describe('module code slice', () => {
	it('builds deterministic forward and backward may-slices with canonical witnesses', () => {
		const forward = available(
			buildModuleCodeSlice(request('FORWARD'), fixture.graph, fixture.snapshot)
		);
		const repeated = available(
			buildModuleCodeSlice(request('FORWARD'), fixture.graph, fixture.snapshot)
		);
		expect(repeated.result).toEqual(forward.result);
		expect(Object.isFrozen(forward)).toBe(true);
		expect(Object.isFrozen(forward.result)).toBe(true);
		expect(Object.isFrozen(forward.result.members)).toBe(true);
		expect(Object.isFrozen(forward.result.members[0]?.witness)).toBe(true);
		expect(forward.result.members.map((member) => member.nodeId)).toEqual(
			[fixture.indexNodeId, fixture.libraryNodeId].sort()
		);
		const library = forward.result.members.find(
			(member) => member.nodeId === fixture.libraryNodeId
		);
		expect(library?.witness.nodeIds).toEqual([fixture.indexNodeId, fixture.libraryNodeId]);
		expect(library?.witness.edgeIds).toHaveLength(1);
		expect(library?.epistemic).toBe('CONFIRMED');
		expect(library?.provenanceIds.length).toBeGreaterThan(0);

		const backward = available(
			buildModuleCodeSlice(
				request('BACKWARD', { fromNodeId: fixture.libraryNodeId }),
				fixture.graph,
				fixture.snapshot
			)
		);
		const importer = backward.result.members.find(
			(member) => member.nodeId === fixture.indexNodeId
		);
		expect(importer?.witness.nodeIds).toEqual([fixture.libraryNodeId, fixture.indexNodeId]);
		expect(importer?.witness.edgeIds).toHaveLength(1);
	});

	it('builds a directed chop whose member witnesses each cover the full criterion path', () => {
		const outcome = available(
			buildModuleCodeSlice(request('CHOP'), fixture.graph, fixture.snapshot)
		);
		expect(outcome.result.members.map((member) => member.nodeId)).toEqual(
			[fixture.indexNodeId, fixture.libraryNodeId].sort()
		);
		for (const member of outcome.result.members) {
			expect(member.witness.nodeIds).toEqual([fixture.indexNodeId, fixture.libraryNodeId]);
			expect(member.witness.edgeIds).toHaveLength(1);
			expect(member.distanceToTerminal).not.toBeNull();
		}
	});

	it('declares selected-graph closure while retaining the explicit non-safety boundary', () => {
		const outcome = available(
			buildModuleCodeSlice(request('FORWARD'), fixture.graph, fixture.snapshot)
		);
		expect(outcome.outcome).toBe('complete');
		expect(outcome.result.closure).toBe('CLOSED_FOR_SELECTED_GRAPH');
		expect(outcome.result.frontiers).toEqual([]);
		expect(outcome.diagnostics).toEqual([]);
		expect(outcome.result.nonclaims).toBe(MODULE_CODE_SLICE_NONCLAIMS);
		expect(outcome.result.nonclaims).toContain('NOT_REACHED_IS_NOT_IRRELEVANT_OR_SAFE_TO_REMOVE');
	});

	it('makes depth and member truncation visible as typed deterministic frontiers', () => {
		const depth = available(
			buildModuleCodeSlice(
				request('FORWARD', { budgets: { ...defaultBudgets, maxDepth: 0 } }),
				fixture.graph,
				fixture.snapshot
			)
		);
		expect(depth.result.members.map((member) => member.nodeId)).toEqual([fixture.indexNodeId]);
		expect(depth.result.truncation).toEqual({ reasons: ['DEPTH'], state: 'TRUNCATED' });
		expect(depth.result.frontiers).toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: 'DEPTH_BOUNDARY' })])
		);

		const members = available(
			buildModuleCodeSlice(
				request('FORWARD', { budgets: { ...defaultBudgets, maxMembers: 1 } }),
				fixture.graph,
				fixture.snapshot
			)
		);
		expect(members.result.truncation).toEqual({ reasons: ['MEMBERS'], state: 'TRUNCATED' });
		expect(members.result.frontiers).toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: 'MEMBER_BOUNDARY' })])
		);
	});

	it('terminates cycles and preserves unresolved resolution targets as open frontiers', () => {
		const cyclic = available(
			buildModuleCodeSlice(
				structuralRequest(structuralNode('src/a.ts')),
				structuralFixture.graph,
				structuralFixture.snapshot
			)
		);
		expect(cyclic.result.members.map((member) => member.nodeId)).toEqual(
			[structuralNode('src/a.ts'), structuralNode('src/b.ts')].sort()
		);
		expect(cyclic.result.truncation.state).toBe('NOT_TRUNCATED');

		const unresolved = available(
			buildModuleCodeSlice(
				structuralRequest(structuralNode('src/d.ts')),
				structuralFixture.graph,
				structuralFixture.snapshot
			)
		);
		expect(unresolved.outcome).toBe('partial');
		expect(unresolved.result.closure).toBe('OPEN');
		expect(unresolved.result.frontiers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'GRAPH_COVERAGE' }),
				expect.objectContaining({ kind: 'RESOLUTION_TARGET' })
			])
		);
		expect(unresolved.diagnostics).toEqual([expect.objectContaining({ code: 'OPEN_FRONTIER' })]);
	});

	it('reports traversal-step exhaustion per stopped arc without mislabeling other frontiers', () => {
		const outcome = available(
			buildModuleCodeSlice(
				structuralRequest(structuralNode('src/d.ts'), {
					budgets: { ...defaultBudgets, maxTraversalSteps: 1 }
				}),
				structuralFixture.graph,
				structuralFixture.snapshot
			)
		);
		expect(outcome.result.truncation).toEqual({ reasons: ['TRAVERSAL_STEPS'], state: 'TRUNCATED' });
		expect(outcome.result.frontiers).toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: 'TRAVERSAL_BOUNDARY' })])
		);
		expect(
			outcome.result.frontiers.filter((frontier) => frontier.kind === 'DEPTH_BOUNDARY')
		).toEqual([]);
		expect(
			outcome.result.frontiers.filter((frontier) => frontier.kind === 'MEMBER_BOUNDARY')
		).toEqual([]);
	});

	it('enforces every population and serialized-result bound before returning a slice', () => {
		expectUnavailable(
			request('FORWARD', {
				budgets: { ...defaultBudgets, maxInputNodes: fixture.graph.nodes.length - 1 }
			}),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			request('CHOP', { budgets: { ...defaultBudgets, maxWitnessEdges: 1 } }),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			request('CHOP', { budgets: { ...defaultBudgets, maxFrontiers: 1, maxDepth: 0 } }),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			request('FORWARD', { budgets: { ...defaultBudgets, maxResultBytes: 1 } }),
			'RESULT_BUDGET_EXCEEDED'
		);
	});

	it('rejects identity drift and graph mutation before analysis', () => {
		expectUnavailable(request('FORWARD', { subjectId: 'different-subject' }), 'IDENTITY_MISMATCH');
		const graph = clone(fixture.graph) as unknown as {
			edges: Array<{ relationKind: string }>;
		};
		graph.edges[0]!.relationKind = 'EXPORT_OCCURRENCE';
		expect(
			buildModuleCodeSlice(
				request('FORWARD'),
				graph as unknown as ModuleDependencyGraphSnapshot,
				fixture.snapshot
			)
		).toMatchObject({
			diagnostics: [{ code: 'GRAPH_INVALID' }],
			outcome: 'unavailable'
		});
	});

	it('revalidates canonical outcome bytes and rejects mutation or hostile values', () => {
		const accepted = request('FORWARD');
		const outcome = buildModuleCodeSlice(accepted, fixture.graph, fixture.snapshot);
		expect(
			validateModuleCodeSliceOutcome(accepted, outcome, fixture.graph, fixture.snapshot)
		).toEqual({
			issues: [],
			state: 'VALID'
		});
		const mutated = clone(outcome) as unknown as { result: { closure: string } };
		mutated.result.closure = 'OPEN';
		expect(
			validateModuleCodeSliceOutcome(accepted, mutated, fixture.graph, fixture.snapshot)
		).toMatchObject({ issues: [{ code: 'OUTCOME_MISMATCH' }], state: 'INVALID' });
		expect(
			validateModuleCodeSliceOutcome(accepted, new Proxy({}, {}), fixture.graph, fixture.snapshot)
		).toMatchObject({ issues: [{ code: 'OUTCOME_INVALID' }], state: 'INVALID' });
	});

	it('rejects malformed, hostile, noncanonical, and semantically inconsistent requests', () => {
		expectUnavailable({ ...request('FORWARD'), extra: true }, 'REQUEST_INVALID');
		expectUnavailable(
			{ ...request('FORWARD'), edgeFamilies: ['IMPORT_OCCURRENCE', 'IMPORT_OCCURRENCE'] },
			'REQUEST_INVALID'
		);
		expectUnavailable(
			{ ...request('FORWARD'), edgeFamilies: ['IMPORT_TYPE_OCCURRENCE', 'IMPORT_OCCURRENCE'] },
			'REQUEST_INVALID'
		);
		expectUnavailable(
			{ ...request('FORWARD'), toNodeId: fixture.libraryNodeId },
			'REQUEST_INVALID'
		);
		expectUnavailable({ ...request('CHOP'), toNodeId: null }, 'REQUEST_INVALID');
		expectUnavailable(
			{ ...request('FORWARD'), policy: { ...MODULE_CODE_SLICE_POLICY, asyncTreatment: 'MODELED' } },
			'REQUEST_INVALID'
		);
		const sparse = new Array(2);
		sparse[0] = 'IMPORT_OCCURRENCE';
		expectUnavailable({ ...request('FORWARD'), edgeFamilies: sparse }, 'REQUEST_INVALID');
		const accessor = { ...request('FORWARD') } as Record<string, unknown>;
		Object.defineProperty(accessor, 'subjectId', {
			enumerable: true,
			get: () => fixture.snapshot.subjectId
		});
		expectUnavailable(accessor, 'REQUEST_INVALID');
		expectUnavailable(new Proxy(request('FORWARD'), {}), 'REQUEST_INVALID');
		expectUnavailable(
			{ ...request('FORWARD'), edgeFamilies: new Proxy(['IMPORT_OCCURRENCE'], {}) },
			'REQUEST_INVALID'
		);
	});
});
