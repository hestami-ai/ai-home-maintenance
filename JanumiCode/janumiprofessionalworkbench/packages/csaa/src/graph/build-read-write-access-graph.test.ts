import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW,
	READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
	READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
	type BuildReadWriteAccessGraphRequest,
	type ReadWriteAccessGraphSnapshot
} from '../contracts/read-write-access-graph.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type SemanticBudgets,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type ResolveSubjectRequest
} from '../contracts/subject.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import { buildReadWriteAccessGraph } from './build-read-write-access-graph.js';
import {
	layerIdentityInput,
	readWriteAccessGraphContentDigest
} from './read-write-access-graph-canonical.js';
import { validateReadWriteAccessGraph } from './validate-read-write-access-graph.js';

const temporaryRoots: string[] = [];

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(source: string): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-read-write-access-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'read-write-access-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/read-write-access',
		private: true,
		version: '0.0.0'
	});
	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts']
	});
	write(root, 'packages/demo/src/index.ts', `${source.trim()}\n`);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function subjectRequest(root: string): ResolveSubjectRequest {
	return {
		budgets: {
			maxBytes: 32 * 1024 * 1024,
			maxConfigDepth: 32,
			maxDiagnostics: 1_000,
			maxDurationMs: 30_000,
			maxFiles: 10_000,
			maxProjects: 10
		},
		filters: { exclude: [], include: [] },
		operationVersion: 'read-write-access-test/1',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'EXPLICIT_PROJECTS', projects: ['packages/demo/tsconfig.json'] },
		subjectKind: 'WORKTREE'
	};
}

function semanticBudgets(): SemanticBudgets {
	return {
		maxAstDepth: 256,
		maxAstNodes: 100_000,
		maxCompilerInputMetadataBytes: 16 * 1024 * 1024,
		maxCompilerQueries: 100_000,
		maxCompilerFacts: 100_000,
		maxCompilerQueryInvocations: 1_000_000,
		maxContextBytes: 32 * 1024 * 1024,
		maxContextFileBytes: 8 * 1024 * 1024,
		maxContextFiles: 10_000,
		maxDiagnosticCharacters: 1_000_000,
		maxDiagnostics: 10_000,
		maxDirectoryEntries: 1_000_000,
		maxDurationMs: 60_000,
		maxLiteralCharacters: 10_000,
		maxPathCharacters: 2_000,
		maxProjects: 10,
		maxScopes: 100_000,
		maxSnapshotBytes: 64 * 1024 * 1024,
		maxSources: 10_000
	};
}

function snapshot(root: string): StaticSemanticSnapshot {
	const subjectOutcome = resolveSubject(subjectRequest(root));
	if (subjectOutcome.outcome !== 'resolved') throw new Error(JSON.stringify(subjectOutcome));
	const request: BuildStaticSemanticSnapshotRequest = {
		assignabilityRequests: [],
		budgets: semanticBudgets(),
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: root,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: subjectOutcome.subject.descriptor.subjectId
	};
	const outcome = buildStaticSemanticSnapshot(request, { subject: subjectOutcome.subject });
	if (outcome.outcome === 'unavailable' || outcome.outcome === 'incompatible')
		throw new Error(JSON.stringify(outcome));
	return outcome.snapshot;
}

function request(semantic: StaticSemanticSnapshot): BuildReadWriteAccessGraphRequest {
	return {
		budgets: {
			maxAccesses: 100_000,
			maxEdges: 200_000,
			maxFrontiers: 100_000,
			maxNodes: 300_000
		},
		operationVersion: READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
		schemaVersion: READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: semantic.id,
		subjectId: semantic.subjectId
	};
}

function build(semantic: StaticSemanticSnapshot): ReadWriteAccessGraphSnapshot {
	const outcome = buildReadWriteAccessGraph(request(semantic), semantic);
	if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
	return outcome.graph;
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('bounded TypeScript read/write access graph', () => {
	it('projects compiler-bound reads, writes, updates, declarations, and explicit frontiers', () => {
		const semantic = snapshot(
			fixture(`
				export interface Shape { value: number }
				export function exercise(input: number): number {
					let local = input;
					local += 1;
					const shape: Shape = { value: local };
					shape.value = input;
					shape.value++;
					const key = 'value';
					shape[key] = local;
					return shape.value;
				}
			`)
		);
		const outcome = buildReadWriteAccessGraph(request(semantic), semantic);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		expect(validateReadWriteAccessGraph(graph, semantic)).toEqual({ issues: [], state: 'VALID' });
		expect(graph.coverage.reconciles).toBe(true);
		expect(graph.coverage.readAccesses).toBeGreaterThan(0);
		expect(graph.coverage.writeAccesses).toBeGreaterThan(0);
		expect(graph.coverage.readWriteAccesses).toBeGreaterThan(0);
		expect(graph.coverage.frontierAssignments).toBeGreaterThan(0);
		expect(graph.coverage.excludedTypePositionReferences).toBeGreaterThan(0);
		expect(graph.fullJanCsaaCapability007DataFlow).toBe(FULL_JAN_CSAA_CAPABILITY_007_DATA_FLOW);
		expect(
			graph.nodes.some(
				(node) => node.kind === 'FRONTIER' && node.frontierKind === 'DYNAMIC_ELEMENT_WRITE_TARGET'
			)
		).toBe(true);
		const localSlot = graph.nodes.find(
			(node) => node.kind === 'SYMBOL_SLOT' && node.name === 'local'
		);
		expect(localSlot).toBeDefined();
		const localRelations = graph.edges
			.filter((edge) => edge.target.nodeId === localSlot?.id)
			.map((edge) => edge.relationKind);
		expect(localRelations).toContain('READS');
		expect(localRelations).toContain('WRITES');
		expect(graph.forwardIndex).toHaveLength(graph.nodes.length);
		expect(graph.reverseIndex).toHaveLength(graph.nodes.length);
	});

	it('is deterministic and validates indexes, identities, coverage, and content', () => {
		const semantic = snapshot(fixture('export let count = 0; count++; export const read = count;'));
		const first = build(semantic);
		const second = build(semantic);
		expect(canonicalSemanticJson(second)).toBe(canonicalSemanticJson(first));
		expect(layerIdentityInput(first.layers[0])).toEqual({
			graphId: first.id,
			kind: 'TYPESCRIPT_READ_WRITE_ACCESS',
			ordinal: 0
		});

		const mutated = structuredClone(first) as ReadWriteAccessGraphSnapshot;
		(mutated as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expect(validateReadWriteAccessGraph(mutated, semantic)).toMatchObject({ state: 'INVALID' });

		const indexMutation = structuredClone(first) as ReadWriteAccessGraphSnapshot;
		(indexMutation as { forwardIndex: ReadWriteAccessGraphSnapshot['forwardIndex'] }).forwardIndex =
			[];
		(indexMutation as { contentDigest: string }).contentDigest =
			readWriteAccessGraphContentDigest(indexMutation);
		expect(validateReadWriteAccessGraph(indexMutation, semantic)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'INDEX_MISMATCH' })]),
			state: 'INVALID'
		});

		const semanticMutation = structuredClone(first) as ReadWriteAccessGraphSnapshot;
		const slot = semanticMutation.nodes.find((node) => node.kind === 'SYMBOL_SLOT');
		if (slot === undefined || slot.kind !== 'SYMBOL_SLOT') throw new Error('Expected symbol slot.');
		(slot as { name: string }).name = `${slot.name}-forged`;
		(semanticMutation as { contentDigest: string }).contentDigest =
			readWriteAccessGraphContentDigest(semanticMutation);
		expect(validateReadWriteAccessGraph(semanticMutation, semantic)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'IDENTITY_MISMATCH' })]),
			state: 'INVALID'
		});

		const erased = structuredClone(first) as ReadWriteAccessGraphSnapshot;
		const emptyCoverage = {
			accessOccurrences: 0,
			closure: 'OPEN' as const,
			discoveredAssignments: 0,
			discoveredCandidateReferences: 0,
			edges: 0,
			excludedTypePositionReferences: 0,
			frontierAssignments: 0,
			frontierNodes: 0,
			frontierReferences: 0,
			readAccesses: 0,
			readWriteAccesses: 0,
			reconciles: true,
			representedAssignmentTargets: 0,
			representedReferences: 0,
			symbolSlots: 0,
			writeAccesses: 0
		};
		(erased as unknown as { nodes: ReadWriteAccessGraphSnapshot['nodes'] }).nodes = [];
		(erased as unknown as { edges: ReadWriteAccessGraphSnapshot['edges'] }).edges = [];
		(
			erased as unknown as { forwardIndex: ReadWriteAccessGraphSnapshot['forwardIndex'] }
		).forwardIndex = [];
		(
			erased as unknown as { reverseIndex: ReadWriteAccessGraphSnapshot['reverseIndex'] }
		).reverseIndex = [];
		(erased as { coverage: typeof emptyCoverage }).coverage = emptyCoverage;
		(erased as { layers: ReadWriteAccessGraphSnapshot['layers'] }).layers = [
			{
				...erased.layers[0],
				coverage: emptyCoverage,
				edgeIds: [],
				nodeIds: [],
				provenanceIds: []
			}
		];
		(erased as { contentDigest: string }).contentDigest = readWriteAccessGraphContentDigest(erased);
		expect(validateReadWriteAccessGraph(erased, semantic)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'COVERAGE_MISMATCH' })]),
			state: 'INVALID'
		});
		expect(validateReadWriteAccessGraph(first, semantic, { maxRecords: 1 })).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })],
			state: 'INVALID'
		});
		expect(validateReadWriteAccessGraph(first, semantic, { maxStringCharacters: 1 })).toMatchObject(
			{
				issues: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })],
				state: 'INVALID'
			}
		);
	});

	it('rejects hostile graph shapes and binding mutations with bounded diagnostics', () => {
		const semantic = snapshot(
			fixture('export let first = 1; export let second = first; first += second;')
		);
		const graph = build(semantic);
		const finalized = (mutate: (draft: ReadWriteAccessGraphSnapshot) => void) => {
			const draft = structuredClone(graph) as ReadWriteAccessGraphSnapshot;
			mutate(draft);
			(draft as { contentDigest: string }).contentDigest = readWriteAccessGraphContentDigest(draft);
			return draft;
		};
		const expectInvalid = (value: unknown, code: string) =>
			expect(validateReadWriteAccessGraph(value, semantic)).toMatchObject({
				issues: expect.arrayContaining([expect.objectContaining({ code })]),
				state: 'INVALID'
			});

		expectInvalid(null, 'SHAPE_INVALID');
		expectInvalid({ ...graph, unexpected: true }, 'FIELD_SET_INVALID');
		expectInvalid({ ...graph, nodes: null }, 'SHAPE_INVALID');
		expectInvalid(
			finalized((draft) => ((draft as { capability: string }).capability = 'forged')),
			'SHAPE_INVALID'
		);
		expectInvalid(
			finalized(
				(draft) =>
					((draft as { semanticSnapshotId: string }).semanticSnapshotId =
						'semantic-snapshot:forged')
			),
			'SNAPSHOT_BINDING_MISMATCH'
		);
		expectInvalid(
			finalized(
				(draft) => ((draft as { graphInputDigest: string }).graphInputDigest = '0'.repeat(64))
			),
			'IDENTITY_MISMATCH'
		);
		expectInvalid(
			finalized((draft) => {
				(draft as unknown as { coverage: Record<string, unknown> }).coverage = {
					...draft.coverage,
					unexpected: true
				};
			}),
			'FIELD_SET_INVALID'
		);
		expectInvalid(
			finalized((draft) => {
				(draft as unknown as { nodes: ReadWriteAccessGraphSnapshot['nodes'] }).nodes = [
					...draft.nodes
				].reverse();
			}),
			'ORDER_INVALID'
		);
		expectInvalid(
			finalized((draft) => {
				(draft as unknown as { limitations: [] }).limitations = [];
			}),
			'SHAPE_INVALID'
		);
		expectInvalid(
			finalized((draft) => {
				(draft as { id: string }).id = `${draft.id}-forged`;
			}),
			'IDENTITY_MISMATCH'
		);
		expectInvalid(
			finalized((draft) => {
				(draft as unknown as { nodes: ReadWriteAccessGraphSnapshot['nodes'] }).nodes = [
					...draft.nodes,
					draft.nodes[0]!
				];
			}),
			'DUPLICATE_ID'
		);
		expectInvalid(
			finalized((draft) => {
				(draft as unknown as { edges: ReadWriteAccessGraphSnapshot['edges'] }).edges = [
					...draft.edges,
					draft.edges[0]!
				];
			}),
			'DUPLICATE_ID'
		);
		expectInvalid(
			finalized((draft) => {
				(draft.nodes[0] as unknown as Record<string, unknown>).unexpected = true;
			}),
			'FIELD_SET_INVALID'
		);
		const accessIndex = graph.nodes.findIndex((node) => node.kind === 'ACCESS_OCCURRENCE');
		const slotIndexes = graph.nodes
			.map((node, index) => ({ index, node }))
			.filter((entry) => entry.node.kind === 'SYMBOL_SLOT');
		expect(accessIndex).toBeGreaterThanOrEqual(0);
		expect(slotIndexes.length).toBeGreaterThan(1);
		expectInvalid(
			finalized((draft) => {
				const access = draft.nodes[accessIndex];
				if (access?.kind !== 'ACCESS_OCCURRENCE') throw new Error('Expected access.');
				const replacement = slotIndexes
					.map((entry) => draft.nodes[entry.index])
					.find((node) => node?.kind === 'SYMBOL_SLOT' && node.id !== access.slotNodeId);
				if (replacement?.kind !== 'SYMBOL_SLOT') throw new Error('Expected replacement slot.');
				(access as { slotNodeId: string }).slotNodeId = replacement.id;
			}),
			'DANGLING_SEMANTIC_REFERENCE'
		);
		expectInvalid(
			finalized((draft) => {
				const access = draft.nodes.find((node) => node.kind === 'ACCESS_OCCURRENCE');
				if (access?.kind !== 'ACCESS_OCCURRENCE') throw new Error('Expected access.');
				(access as { epistemic: string }).epistemic = 'UNKNOWN';
			}),
			'SHAPE_INVALID'
		);
		expectInvalid(
			finalized((draft) => {
				const access = draft.nodes.find((node) => node.kind === 'ACCESS_OCCURRENCE');
				if (access?.kind !== 'ACCESS_OCCURRENCE') throw new Error('Expected access.');
				(access as unknown as { provenanceIds: string[] }).provenanceIds = ['forged'];
			}),
			'DANGLING_SEMANTIC_REFERENCE'
		);
		expectInvalid(
			finalized((draft) => {
				const access = draft.nodes.find((node) => node.kind === 'ACCESS_OCCURRENCE');
				if (access?.kind !== 'ACCESS_OCCURRENCE') throw new Error('Expected access.');
				(access as unknown as { occurrenceNodeId: string }).occurrenceNodeId =
					'semantic-node:forged';
			}),
			'DANGLING_SEMANTIC_REFERENCE'
		);
		expectInvalid(
			finalized((draft) => {
				const access = draft.nodes.find(
					(node) => node.kind === 'ACCESS_OCCURRENCE' && node.referenceId !== null
				);
				if (access?.kind !== 'ACCESS_OCCURRENCE') throw new Error('Expected reference access.');
				(access as unknown as { referenceId: string }).referenceId = 'semantic-reference:forged';
			}),
			'DANGLING_SEMANTIC_REFERENCE'
		);
		expectInvalid(
			finalized((draft) => {
				const access = draft.nodes.find(
					(node) => node.kind === 'ACCESS_OCCURRENCE' && node.declarationId !== null
				);
				if (access?.kind !== 'ACCESS_OCCURRENCE') throw new Error('Expected declaration access.');
				(access as unknown as { declarationId: string }).declarationId =
					'semantic-declaration:forged';
			}),
			'DANGLING_SEMANTIC_REFERENCE'
		);
		expectInvalid(
			finalized((draft) => {
				const edge = draft.edges[0];
				if (edge === undefined) throw new Error('Expected edge.');
				(edge.source as unknown as Record<string, unknown>).unexpected = true;
			}),
			'FIELD_SET_INVALID'
		);
		expectInvalid(
			finalized((draft) => {
				const edge = draft.edges[0];
				if (edge === undefined) throw new Error('Expected edge.');
				(edge as unknown as Record<string, unknown>).unexpected = true;
			}),
			'FIELD_SET_INVALID'
		);
		expectInvalid(
			finalized((draft) => {
				const edge = draft.edges[0];
				if (edge === undefined) throw new Error('Expected edge.');
				(edge as { method: string }).method = 'forged';
			}),
			'SNAPSHOT_BINDING_MISMATCH'
		);
		expectInvalid(
			finalized((draft) => {
				const edge = draft.edges[0];
				if (edge === undefined) throw new Error('Expected edge.');
				(edge.source as unknown as { nodeId: string }).nodeId = 'graph-node:absent';
			}),
			'DANGLING_ENDPOINT'
		);
		expectInvalid(
			finalized((draft) => {
				(draft as unknown as { edges: ReadWriteAccessGraphSnapshot['edges'] }).edges =
					draft.edges.slice(1);
			}),
			'COVERAGE_MISMATCH'
		);
		expectInvalid(
			finalized((draft) => {
				const write = draft.nodes.find(
					(node) =>
						node.kind === 'ACCESS_OCCURRENCE' &&
						node.accessKind !== 'READ' &&
						node.assignmentNodeId !== null
				);
				if (write?.kind !== 'ACCESS_OCCURRENCE') throw new Error('Expected assignment write.');
				(write as unknown as { assignmentNodeId: null }).assignmentNodeId = null;
			}),
			'COVERAGE_MISMATCH'
		);
		expectInvalid(
			finalized((draft) => {
				(draft.forwardIndex[0] as unknown as Record<string, unknown>).unexpected = true;
			}),
			'FIELD_SET_INVALID'
		);
		expectInvalid(
			finalized((draft) => {
				(draft as unknown as { reverseIndex: [] }).reverseIndex = [];
			}),
			'INDEX_MISMATCH'
		);
		expectInvalid(
			finalized((draft) => {
				(draft as unknown as { layers: [] }).layers = [];
			}),
			'FIELD_SET_INVALID'
		);
		expectInvalid(
			finalized((draft) => {
				(draft.layers[0] as { ordinal: number }).ordinal = 1;
			}),
			'IDENTITY_MISMATCH'
		);
		expect(validateReadWriteAccessGraph(graph, semantic, { maxIssues: 0 })).toMatchObject({
			state: 'INVALID'
		});
	});

	it('binds atomic, nested, and destructured initializer writes to exact declaration names', () => {
		const semantic = snapshot(
			fixture(`
				export let nested = 0;
				export const outer = (nested = 1);
				const source = { item: 2 };
				export const { item = 3 } = source;
			`)
		);
		const graph = build(semantic);
		expect(validateReadWriteAccessGraph(graph, semantic)).toEqual({ issues: [], state: 'VALID' });
		for (const name of ['nested', 'outer', 'item']) {
			const slot = graph.nodes.find((node) => node.kind === 'SYMBOL_SLOT' && node.name === name);
			expect(slot, `Expected symbol slot for ${name}.`).toBeDefined();
			expect(
				graph.nodes.some(
					(node) =>
						node.kind === 'ACCESS_OCCURRENCE' &&
						node.slotNodeId === slot?.id &&
						node.accessKind !== 'READ'
				)
			).toBe(true);
		}
		expect(graph.coverage.frontierAssignments).toBeGreaterThan(0);
	});

	it('frontiers unsupported scope linkage and unmodeled write-capable syntax', () => {
		const semantic = snapshot(
			fixture(`
				declare function eval(code: string): unknown;
				export function exercise(values: number[]): number {
					let item = 0;
					eval('item');
					for (item of values) item;
					return item;
				}
			`)
		);
		const graph = build(semantic);
		const unsupportedScopeReferences = semantic.references.filter(
			(reference) =>
				(reference.role === 'MEMBER_NAME' || reference.role === 'SYMBOL_USE') &&
				reference.scopeLinkState === 'UNSUPPORTED'
		);
		expect(unsupportedScopeReferences.length).toBeGreaterThan(0);
		for (const reference of unsupportedScopeReferences)
			expect(
				graph.nodes.some((node) => node.kind === 'FRONTIER' && node.referenceId === reference.id)
			).toBe(true);
		expect(
			graph.nodes.some(
				(node) =>
					node.kind === 'FRONTIER' &&
					node.reason.includes('outside the normalized assignment taxonomy')
			)
		).toBe(true);
	});

	it('frontiers unresolved references and references inside unsupported assignment targets', () => {
		const semantic = snapshot(
			fixture(`
				export let target = 0;
				[target] = [1];
				notDeclared;
			`)
		);
		const graph = build(semantic);
		expect(
			graph.nodes.some(
				(node) => node.kind === 'FRONTIER' && node.frontierKind === 'UNSUPPORTED_ASSIGNMENT_TARGET'
			)
		).toBe(true);
		expect(
			graph.nodes.some(
				(node) => node.kind === 'FRONTIER' && node.frontierKind === 'UNRESOLVED_REFERENCE'
			)
		).toBe(true);
		const identityMutation = structuredClone(graph) as ReadWriteAccessGraphSnapshot;
		const frontier = identityMutation.nodes.find((node) => node.kind === 'FRONTIER');
		if (frontier?.kind !== 'FRONTIER') throw new Error('Expected frontier.');
		(frontier as unknown as { id: string }).id = `${frontier.id}-forged`;
		(identityMutation as { contentDigest: string }).contentDigest =
			readWriteAccessGraphContentDigest(identityMutation);
		expect(validateReadWriteAccessGraph(identityMutation, semantic)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'IDENTITY_MISMATCH' })]),
			state: 'INVALID'
		});
		const classificationMutation = structuredClone(graph) as ReadWriteAccessGraphSnapshot;
		const classifiedFrontier = classificationMutation.nodes.find(
			(node) => node.kind === 'FRONTIER'
		);
		if (classifiedFrontier?.kind !== 'FRONTIER') throw new Error('Expected frontier.');
		(classifiedFrontier as unknown as { frontierKind: string }).frontierKind = 'forged';
		(classificationMutation as { contentDigest: string }).contentDigest =
			readWriteAccessGraphContentDigest(classificationMutation);
		expect(validateReadWriteAccessGraph(classificationMutation, semantic)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'SHAPE_INVALID' })]),
			state: 'INVALID'
		});
	});

	it('fails closed for invalid bindings, unavailable capabilities, and exhausted budgets', () => {
		const semantic = snapshot(
			fixture(`
				export interface Shape { value: number }
				export let value = 1;
				value += 1;
				const key = 'value';
				const shape: Shape = { value };
				shape[key] = value;
			`)
		);
		expect(
			buildReadWriteAccessGraph({ ...request(semantic), subjectId: 'wrong-subject' }, semantic)
		).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SUBJECT_ID_MISMATCH' })],
			outcome: 'unavailable'
		});
		expect(
			buildReadWriteAccessGraph(
				{ ...request(semantic), budgets: { ...request(semantic).budgets, maxNodes: 1 } },
				semantic
			)
		).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});
		const withoutSymbols = {
			...semantic,
			capabilities: semantic.capabilities.map((capability) =>
				capability.capability === 'TS_SYMBOL'
					? { ...capability, state: 'UNSUPPORTED' as const }
					: capability
			)
		};
		expect(buildReadWriteAccessGraph(request(semantic), withoutSymbols)).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SEMANTIC_CAPABILITY_UNAVAILABLE' })],
			outcome: 'unavailable'
		});
		for (const budget of ['maxAccesses', 'maxEdges', 'maxFrontiers', 'maxNodes'] as const) {
			const constrained = {
				...request(semantic).budgets,
				[budget]: 1
			};
			expect(
				buildReadWriteAccessGraph({ ...request(semantic), budgets: constrained }, semantic),
				budget
			).toMatchObject({
				diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })],
				outcome: 'unavailable'
			});
		}
		expect(
			buildReadWriteAccessGraph(
				{ ...request(semantic), unexpected: true } as BuildReadWriteAccessGraphRequest,
				semantic
			)
		).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'REQUEST_INVALID' })],
			outcome: 'unavailable'
		});
		expect(buildReadWriteAccessGraph(new Proxy(request(semantic), {}), semantic)).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'REQUEST_INVALID' })],
			outcome: 'unavailable'
		});
		const requestTemplate = request(semantic);
		const inheritedRequest = Object.assign(Object.create({ inherited: true }), requestTemplate);
		const inheritedBudgets = Object.assign(
			Object.create({ inherited: true }),
			requestTemplate.budgets
		);
		const invalidRequests: unknown[] = [
			null,
			inheritedRequest,
			{ ...requestTemplate, budgets: null },
			{ ...requestTemplate, budgets: { ...requestTemplate.budgets, unexpected: true } },
			{ ...requestTemplate, budgets: inheritedBudgets },
			{ ...requestTemplate, budgets: { ...requestTemplate.budgets, maxAccesses: 0 } },
			{ ...requestTemplate, operationVersion: 'wrong' },
			{ ...requestTemplate, schemaVersion: 'wrong' },
			{ ...requestTemplate, semanticSnapshotId: '' },
			{ ...requestTemplate, subjectId: '' }
		];
		for (const invalidRequest of invalidRequests)
			expect(
				buildReadWriteAccessGraph(invalidRequest as BuildReadWriteAccessGraphRequest, semantic)
			).toMatchObject({
				diagnostics: [expect.objectContaining({ code: 'REQUEST_INVALID' })],
				outcome: 'unavailable'
			});
	});

	it('keeps an honestly empty access population partial rather than claiming data-flow completeness', () => {
		const semantic = snapshot(fixture('export {};'));
		const graph = build(semantic);
		expect(graph.coverage).toMatchObject({
			accessOccurrences: 0,
			discoveredCandidateReferences: 0,
			reconciles: true
		});
		expect(graph.health).toBe('PARTIAL');
		expect(graph.fullJanCsaaCapability007DataFlow).toBe('NOT_CLAIMED');
	});
});
