import { afterEach, describe, expect, it } from 'vitest';
import type { FrozenSubject, WorkspaceSubjectRecord } from '../contracts/subject.js';
import {
	STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	buildStructuralWorkspaceDependencyGraph,
	type StructuralWorkspaceDependencyGraphRequest
} from './build-structural-workspace-dependency-graph.js';
import {
	createStructuralWorkspaceDependencyFixture,
	type StructuralWorkspaceDependencyFixture
} from './structural-workspace-dependency-fixture.test-support.js';

const fixtures: StructuralWorkspaceDependencyFixture[] = [];

function fixture(): StructuralWorkspaceDependencyFixture {
	const created = createStructuralWorkspaceDependencyFixture();
	fixtures.push(created);
	return created;
}

function request(
	value: StructuralWorkspaceDependencyFixture
): StructuralWorkspaceDependencyGraphRequest {
	const entry = value.sourceNodeId('apps/demo/src/main.ts');
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
			maxFrontiers: 100,
			maxResultBytes: 2_000_000,
			maxValidationIssues: 100,
			maxWorkspaceEdges: 100,
			maxWorkspaces: 100
		},
		expectCrossWorkspaceEdges: true,
		moduleAnalysis: {
			entryNodeIds: [entry],
			entrySurfaceClosure: 'CLOSED',
			entrySurfaceFrontierReasons: [],
			slice: { direction: 'FORWARD', sourceNodeIds: [entry], targetNodeIds: [] }
		},
		operationVersion: STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_OPERATION_VERSION,
		schemaVersion: STRUCTURAL_WORKSPACE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION
	};
}

afterEach(() => {
	for (const value of fixtures.splice(0)) value.cleanup();
});

describe('buildStructuralWorkspaceDependencyGraph', () => {
	it('closes the module, workspace, and package structural projections with shared SCC authority', () => {
		const value = fixture();
		const first = buildStructuralWorkspaceDependencyGraph(
			request(value),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph
		);
		const second = buildStructuralWorkspaceDependencyGraph(
			request(value),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph
		);
		expect(first).toEqual(second);
		expect(first.outcome).toBe('complete');
		if (first.outcome === 'unavailable') throw new Error(JSON.stringify(first));
		expect(first.graph.coverage).toMatchObject({
			crossWorkspaceModuleEdges: 3,
			frontierModuleEdges: 0,
			internalWorkspaceModuleEdges: 0,
			moduleEdgePartitionReconciles: true,
			packageEdges: 2,
			packageNodes: 2,
			workspaceEdges: 3,
			workspaceNodes: 3
		});
		expect(first.graph.moduleAnalysis.coverage).toMatchObject({
			componentPartitionReconciles: true,
			forwardIndexReconciles: true,
			reverseIndexReconciles: true
		});
		expect(first.graph.packageComponents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ cycleKind: 'MULTI_NODE', nodeIds: expect.any(Array) })
			])
		);
		expect(
			first.graph.packageComponents.find((component) => component.cycleKind === 'MULTI_NODE')
				?.nodeIds
		).toHaveLength(2);
		expect(first.graph.workspaceForwardIndex).toHaveLength(3);
		expect(first.graph.workspaceReverseIndex).toHaveLength(3);
		expect(first.graph.nonclaims).toContain('G4_PASS');
		expect(first.graph.gateEffect).toBe('NONE');
		expect(Object.isFrozen(first.graph)).toBe(true);
	});

	it('fails closed when one source has ambiguous nested workspace ownership', () => {
		const value = fixture();
		const subject = structuredClone(value.frozenSubject) as FrozenSubject;
		const workspace = subject.workspaces.find((entry) => entry.path === 'packages/a')!;
		(subject.workspaces as WorkspaceSubjectRecord[]).push({
			...workspace,
			manifestPath: 'packages/a/src/package.json',
			name: '@fixture/a-nested',
			path: 'packages/a/src'
		});
		const outcome = buildStructuralWorkspaceDependencyGraph(
			request(value),
			subject,
			value.semanticSnapshot,
			value.graph
		);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'AMBIGUOUS_WORKSPACE_OWNERSHIP' }],
			outcome: 'unavailable'
		});
	});

	it('rejects a reverse-index mutation through the canonical module analysis path', () => {
		const value = fixture();
		const populated = value.graph.reverseIndex.find((entry) => entry.edgeIds.length > 0)!;
		const graph = {
			...value.graph,
			reverseIndex: value.graph.reverseIndex.map((entry) =>
				entry.nodeId === populated.nodeId
					? { ...entry, edgeIds: entry.edgeIds.slice(0, -1) }
					: entry
			)
		};
		const outcome = buildStructuralWorkspaceDependencyGraph(
			request(value),
			value.frozenSubject,
			value.semanticSnapshot,
			graph
		);
		expect(outcome).toMatchObject({
			diagnostics: [
				{
					code: 'SOURCE_GRAPH_INVALID',
					message: expect.stringContaining('reverse index')
				}
			],
			outcome: 'unavailable'
		});
	});

	it('refuses truncation when the workspace-edge budget is smaller than the population', () => {
		const value = fixture();
		const base = request(value);
		const bounded = {
			...base,
			budgets: { ...base.budgets, maxWorkspaceEdges: 1 }
		};
		const outcome = buildStructuralWorkspaceDependencyGraph(
			bounded,
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph
		);
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXHAUSTED' }],
			outcome: 'unavailable'
		});
	});
});
