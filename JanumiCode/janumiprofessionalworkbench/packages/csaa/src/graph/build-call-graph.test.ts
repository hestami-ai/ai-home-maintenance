import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION,
	type BuildCallGraphRequest,
	type CallGraphCallSiteNode,
	type CallGraphEdge,
	type CallGraphNode,
	type CallGraphSnapshot
} from '../contracts/call-graph.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type SemanticBudgets,
	type SemanticNodeId,
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
import { buildCallGraph } from './build-call-graph.js';
import { callGraphContentDigest } from './call-graph-content.js';
import { callGraphEdgeId } from './call-graph-ids.js';
import { validateCallGraph } from './validate-call-graph.js';

const temporaryRoots: string[] = [];

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(kind: 'CALLS' | 'ZERO'): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-call-graph-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'call-graph-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/call-graph',
		private: true,
		version: '0.0.0'
	});
	if (kind === 'ZERO') {
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
		write(root, 'packages/demo/src/index.ts', 'export const value = 1;\n');
		write(root, 'bun.lock', 'fixture lock\n');
		return root;
	}

	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/external.d.ts', 'src/library.ts', 'src/runtime.ts', 'src/index.ts']
	});
	write(
		root,
		'packages/demo/src/external.d.ts',
		"declare module 'external-fixture' { export function externalCall(): void; }\n"
	);
	write(
		root,
		'packages/demo/src/library.ts',
		[
			'export function importedDirect(value: number): number { return value + 1; }',
			'export function overloaded(value: string): string;',
			'export function overloaded(value: number): number;',
			'export function overloaded(value: string | number): string | number { return value; }',
			'export class Widget {',
			'  constructor(readonly value: number = 1) {}',
			'  method(): number { return this.value; }',
			'}',
			'export function tag(_parts: unknown): string { return "tag"; }',
			''
		].join('\n')
	);
	write(root, 'packages/demo/src/runtime.ts', 'export const loaded = true;\n');
	write(
		root,
		'packages/demo/src/index.ts',
		[
			"import { importedDirect as importedAlias, overloaded, tag, Widget } from './library.js';",
			"import { externalCall } from 'external-fixture';",
			'',
			'function localDirect(): number { return 1; }',
			'function factory(): () => number { return localDirect; }',
			'const localAlias = (value: number): number => importedAlias(value);',
			'let reassigned = (): number => 1;',
			'reassigned = (): number => 2;',
			'const receiver = new Widget();',
			"const computedKey: string = 'method';",
			'',
			'export function owner(callback: () => void, maybeCallback?: () => void): Widget {',
			'  localDirect();',
			'  (localDirect as () => number)();',
			'  (factory())();',
			'  importedAlias(1);',
			'  localAlias(2);',
			'  reassigned();',
			"  overloaded('value');",
			'  receiver.method();',
			'  receiver.method?.();',
			"  receiver['method']();",
			'  externalCall();',
			'  callback();',
			'  maybeCallback?.();',
			'  missingCall();',
			'  receiver[computedKey]();',
			"  eval('0');",
			"  void import('./runtime.js');",
			'  (() => importedAlias(3))();',
			'  (function inlineFunction() { return importedAlias(4); })();',
			'  tag`value`;',
			'  return new Widget(2);',
			'}',
			'',
			'owner(() => undefined);',
			''
		].join('\n')
	);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function fixtureFromSource(source: string): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-call-graph-scenario-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'call-graph-scenario-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/call-graph-scenario',
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
		operationVersion: 'call-graph-test/1',
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
	const semanticOutcome = buildStaticSemanticSnapshot(request, {
		subject: subjectOutcome.subject
	});
	if (semanticOutcome.outcome === 'unavailable' || semanticOutcome.outcome === 'incompatible')
		throw new Error(JSON.stringify(semanticOutcome));
	return semanticOutcome.snapshot;
}

function graphRequest(semanticSnapshot: StaticSemanticSnapshot): BuildCallGraphRequest {
	return {
		operationVersion: CALL_GRAPH_OPERATION_VERSION,
		schemaVersion: CALL_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: semanticSnapshot.id,
		subjectId: semanticSnapshot.subjectId
	};
}

function callSites(graph: CallGraphSnapshot): CallGraphCallSiteNode[] {
	return graph.nodes.filter((node): node is CallGraphCallSiteNode => node.kind === 'CALL_SITE');
}

function expectIndexReconciliation(graph: CallGraphSnapshot): void {
	expect(graph.forwardIndex).toHaveLength(graph.nodes.length);
	expect(graph.reverseIndex).toHaveLength(graph.nodes.length);
	const forwardByNode = new Map(graph.forwardIndex.map((entry) => [entry.nodeId, entry.edgeIds]));
	const reverseByNode = new Map(graph.reverseIndex.map((entry) => [entry.nodeId, entry.edgeIds]));
	for (const node of graph.nodes) {
		expect(forwardByNode.get(node.id)).toEqual(
			graph.edges
				.filter((edge) => edge.source.nodeId === node.id)
				.map((edge) => edge.id)
				.sort()
		);
		expect(reverseByNode.get(node.id)).toEqual(
			graph.edges
				.filter((edge) => edge.target.nodeId === node.id)
				.map((edge) => edge.id)
				.sort()
		);
	}
}

function repairedIndexes(
	nodes: readonly CallGraphNode[],
	edges: readonly CallGraphEdge[],
	direction: 'FORWARD' | 'REVERSE'
): CallGraphSnapshot['forwardIndex'] {
	const byNode = new Map(nodes.map((node) => [node.id, [] as CallGraphEdge['id'][]]));
	for (const edge of edges) {
		const nodeId = direction === 'FORWARD' ? edge.source.nodeId : edge.target.nodeId;
		byNode.get(nodeId)?.push(edge.id);
	}
	return [...byNode.entries()]
		.map(([nodeId, edgeIds]) => ({ edgeIds: edgeIds.sort(), nodeId }))
		.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
}

function repairedGraph(
	graph: CallGraphSnapshot,
	options: {
		readonly edges?: readonly CallGraphEdge[];
		readonly entryMechanismCoverage?: CallGraphSnapshot['entryMechanismCoverage'];
		readonly nodes?: readonly CallGraphNode[];
		readonly relationLaneCoverage?: CallGraphSnapshot['relationLaneCoverage'];
	}
): CallGraphSnapshot {
	const nodes = [...(options.nodes ?? graph.nodes)].sort((left, right) =>
		left.id.localeCompare(right.id)
	);
	const edges = [...(options.edges ?? graph.edges)].sort((left, right) =>
		left.id.localeCompare(right.id)
	);
	const sites = nodes.filter((node): node is CallGraphCallSiteNode => node.kind === 'CALL_SITE');
	const ownershipEdges = edges.filter((edge) => edge.relationKind === 'CALL_SITE_OWNERSHIP');
	const targetEdges = edges.filter((edge) => edge.relationKind !== 'CALL_SITE_OWNERSHIP');
	const count = (resolutionClass: CallGraphCallSiteNode['resolutionClass']): number =>
		sites.filter((site) => site.resolutionClass === resolutionClass).length;
	const coverage: CallGraphSnapshot['coverage'] = {
		candidateSetCallSites: count('CANDIDATE_SET'),
		candidateTargetEdges: edges.filter((edge) => edge.relationKind === 'CANDIDATE_CALL_TARGET')
			.length,
		closure: 'OPEN',
		exactCallSites: count('EXACT'),
		expectedCallSites: graph.coverage.expectedCallSites,
		externalDispatchCallSites: count('EXTERNAL_DISPATCH'),
		frontierNodes: nodes.filter((node) => node.kind === 'FRONTIER').length,
		ownershipEdges: ownershipEdges.length,
		reconciles:
			sites.length === graph.coverage.expectedCallSites &&
			new Set(sites.map((site) => site.invocationId)).size === graph.coverage.expectedCallSites &&
			ownershipEdges.length === sites.length &&
			targetEdges.length >= sites.length &&
			sites.every((site) => site.targetNodeIds.length >= 1),
		representedCallSites: sites.length,
		targetEdges: targetEdges.length,
		unresolvedCallSites: count('UNRESOLVED'),
		unsupportedCallSites: count('UNSUPPORTED'),
		wholeProgramReachability: 'NOT_CLAIMED'
	};
	const entryMechanismCoverage = options.entryMechanismCoverage ?? graph.entryMechanismCoverage;
	const relationLaneCoverage = options.relationLaneCoverage ?? graph.relationLaneCoverage;
	const layer = {
		...graph.layers[0],
		coverage,
		edgeIds: edges.map((edge) => edge.id),
		entryMechanismCoverage,
		nodeIds: nodes.map((node) => node.id),
		provenanceIds: [
			...new Set(
				nodes
					.flatMap((node) => [...node.provenanceIds])
					.concat(edges.flatMap((edge) => [...edge.provenanceIds]))
			)
		].sort(),
		relationLaneCoverage
	};
	const repaired = {
		...graph,
		coverage,
		edges,
		entryMechanismCoverage,
		forwardIndex: repairedIndexes(nodes, edges, 'FORWARD'),
		layers: [layer],
		nodes,
		relationLaneCoverage,
		reverseIndex: repairedIndexes(nodes, edges, 'REVERSE')
	} as CallGraphSnapshot;
	return { ...repaired, contentDigest: callGraphContentDigest(repaired) };
}

function expectIndependentIssue(
	graph: CallGraphSnapshot,
	snapshot: StaticSemanticSnapshot,
	text: string
): void {
	const validation = validateCallGraph(graph, snapshot);
	expect(validation.state).toBe('INVALID');
	expect(validation.issues.some((issue) => issue.message.includes(text))).toBe(true);
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('buildCallGraph', () => {
	it('projects every invocation once without collapsing candidate, external, unresolved, or unsupported targets', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		expect(new Set(semanticSnapshot.invocations.map((entry) => entry.invocationKind))).toEqual(
			new Set(['CALL', 'NEW', 'TAGGED_TEMPLATE'])
		);

		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const sites = callSites(graph);
		const ownershipEdges = graph.edges.filter(
			(edge) => edge.relationKind === 'CALL_SITE_OWNERSHIP'
		);
		const targetEdges = graph.edges.filter((edge) => edge.relationKind !== 'CALL_SITE_OWNERSHIP');

		expect(sites).toHaveLength(semanticSnapshot.invocations.length);
		expect(new Set(sites.map((site) => site.invocationId)).size).toBe(
			semanticSnapshot.invocations.length
		);
		expect(ownershipEdges).toHaveLength(semanticSnapshot.invocations.length);
		for (const invocation of semanticSnapshot.invocations) {
			expect(sites.filter((site) => site.invocationId === invocation.id)).toHaveLength(1);
			expect(ownershipEdges.filter((edge) => edge.invocationId === invocation.id)).toHaveLength(1);
			expect(
				targetEdges.filter((edge) => edge.invocationId === invocation.id).length
			).toBeGreaterThanOrEqual(1);
		}

		const representedClasses = new Set(sites.map((site) => site.resolutionClass));
		expect(representedClasses).toEqual(
			new Set(['CANDIDATE_SET', 'EXTERNAL_DISPATCH', 'UNRESOLVED', 'UNSUPPORTED'])
		);
		expect(sites.some((site) => site.resolutionClass === 'EXACT')).toBe(false);
		expect(graph.coverage).toMatchObject({
			candidateSetCallSites: sites.filter((site) => site.resolutionClass === 'CANDIDATE_SET')
				.length,
			closure: 'OPEN',
			exactCallSites: 0,
			expectedCallSites: semanticSnapshot.invocations.length,
			externalDispatchCallSites: sites.filter(
				(site) => site.resolutionClass === 'EXTERNAL_DISPATCH'
			).length,
			ownershipEdges: semanticSnapshot.invocations.length,
			reconciles: true,
			representedCallSites: semanticSnapshot.invocations.length,
			targetEdges: targetEdges.length,
			unresolvedCallSites: sites.filter((site) => site.resolutionClass === 'UNRESOLVED').length,
			unsupportedCallSites: sites.filter((site) => site.resolutionClass === 'UNSUPPORTED').length,
			wholeProgramReachability: 'NOT_CLAIMED'
		});
		expect(
			graph.coverage.exactCallSites +
				graph.coverage.candidateSetCallSites +
				graph.coverage.externalDispatchCallSites +
				graph.coverage.unresolvedCallSites +
				graph.coverage.unsupportedCallSites
		).toBe(semanticSnapshot.invocations.length);

		const semanticNodeById = new Map(semanticSnapshot.astNodes.map((node) => [node.id, node]));
		const childrenByParent = new Map<SemanticNodeId, SemanticNodeId[]>();
		for (const node of semanticSnapshot.astNodes) {
			if (node.parentId === null) continue;
			const children = childrenByParent.get(node.parentId) ?? [];
			children.push(node.id);
			childrenByParent.set(node.parentId, children);
		}
		const subtreeIds = (rootId: SemanticNodeId): Set<SemanticNodeId> => {
			const ids = new Set<SemanticNodeId>();
			const pending = [rootId];
			while (pending.length > 0) {
				const nodeId = pending.pop()!;
				if (ids.has(nodeId)) continue;
				ids.add(nodeId);
				pending.push(...(childrenByParent.get(nodeId) ?? []));
			}
			return ids;
		};
		const directSites = (identifier: string): CallGraphCallSiteNode[] =>
			sites.filter(
				(site) => semanticNodeById.get(site.calleeNodeId)?.syntacticIdentifierText === identifier
			);
		expect(directSites('localDirect')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dispatchClass: 'DIRECT_REFERENCE',
					resolutionClass: 'CANDIDATE_SET'
				})
			])
		);
		expect(directSites('importedAlias')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dispatchClass: 'DIRECT_REFERENCE',
					resolutionClass: 'CANDIDATE_SET'
				})
			])
		);
		expect(directSites('localAlias')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dispatchClass: 'DIRECT_REFERENCE',
					resolutionClass: 'CANDIDATE_SET'
				})
			])
		);
		expect(directSites('factory')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dispatchClass: 'DIRECT_REFERENCE',
					resolutionClass: 'CANDIDATE_SET'
				})
			])
		);
		expect(directSites('overloaded')).toEqual(
			expect.arrayContaining([expect.objectContaining({ resolutionClass: 'CANDIDATE_SET' })])
		);
		expect(directSites('Widget')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					invocationKind: 'NEW',
					resolutionClass: 'CANDIDATE_SET'
				})
			])
		);
		expect(directSites('tag')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					invocationKind: 'TAGGED_TEMPLATE',
					resolutionClass: 'CANDIDATE_SET'
				})
			])
		);
		expect(sites).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					dispatchClass: 'MEMBER_REFERENCE',
					resolutionClass: 'CANDIDATE_SET'
				}),
				expect.objectContaining({
					optional: true,
					resolutionClass: expect.stringMatching(/^(CANDIDATE_SET|EXTERNAL_DISPATCH)$/)
				}),
				expect.objectContaining({
					dispatchClass: 'INLINE_CALLABLE',
					reasonCode: 'INLINE_CALLABLE_WITHOUT_RESOLVED_SIGNATURE',
					resolutionClass: 'CANDIDATE_SET'
				}),
				expect.objectContaining({
					reasonCode: 'RESOLVED_EXTERNAL_OR_CONTEXT_ONLY_SYMBOL',
					resolutionClass: 'EXTERNAL_DISPATCH'
				}),
				expect.objectContaining({
					reasonCode: 'CALLABLE_VALUE_FLOW_NOT_MODELED',
					resolutionClass: 'EXTERNAL_DISPATCH'
				}),
				expect.objectContaining({
					reasonCode: 'REFERENCE_UNRESOLVED',
					resolutionClass: 'UNRESOLVED'
				}),
				expect.objectContaining({
					reasonCode: 'COMPUTED_ELEMENT_DISPATCH',
					resolutionClass: 'UNSUPPORTED'
				}),
				expect.objectContaining({
					reasonCode: 'DYNAMIC_IMPORT_CALL',
					resolutionClass: 'UNSUPPORTED'
				}),
				expect.objectContaining({
					reasonCode: 'DYNAMIC_CALLEE_EXPRESSION',
					resolutionClass: 'UNSUPPORTED'
				})
			])
		);

		const invocationNodeIds = new Set(
			semanticSnapshot.invocations.map((invocation) => invocation.nodeId)
		);
		const nestedCallWrappers = sites.filter(
			(site) =>
				site.dispatchClass !== 'INLINE_CALLABLE' &&
				[...subtreeIds(site.calleeNodeId)].some((nodeId) => invocationNodeIds.has(nodeId))
		);
		expect(nestedCallWrappers).toEqual([
			expect.objectContaining({
				dispatchClass: 'UNSUPPORTED_EXPRESSION',
				reasonCode: 'DYNAMIC_CALLEE_EXPRESSION',
				referenceIds: [],
				resolutionClass: 'UNSUPPORTED',
				resolvedSymbolIds: []
			})
		]);
		const wrappedDirectSite = sites.find((site) => {
			if (
				site.dispatchClass !== 'DIRECT_REFERENCE' ||
				site.resolutionClass !== 'CANDIDATE_SET' ||
				semanticNodeById.get(site.calleeNodeId)?.kindName === 'Identifier'
			)
				return false;
			return [...subtreeIds(site.calleeNodeId)].some(
				(nodeId) => semanticNodeById.get(nodeId)?.syntacticIdentifierText === 'localDirect'
			);
		});
		expect(wrappedDirectSite).toBeDefined();

		const localAliasSite = directSites('localAlias').find(
			(site) => site.resolutionClass === 'CANDIDATE_SET'
		)!;
		const localAliasAssignment = semanticSnapshot.assignments.find((assignment) => {
			if (
				assignment.valueNodeId === null ||
				semanticNodeById.get(assignment.valueNodeId)?.kindName !== 'ArrowFunction'
			)
				return false;
			return semanticSnapshot.references.some(
				(reference) =>
					reference.nodeId === assignment.targetNodeId &&
					reference.resolvedSymbolId !== null &&
					localAliasSite.resolvedSymbolIds.includes(reference.resolvedSymbolId)
			);
		})!;
		expect(localAliasAssignment).toBeDefined();
		const localAliasCandidateEdge = targetEdges.find(
			(edge) =>
				edge.relationKind === 'CANDIDATE_CALL_TARGET' &&
				edge.invocationId === localAliasSite.invocationId
		);
		expect(localAliasCandidateEdge).toMatchObject({ relationKind: 'CANDIDATE_CALL_TARGET' });
		if (localAliasCandidateEdge?.relationKind !== 'CANDIDATE_CALL_TARGET')
			throw new Error('Missing local-alias candidate edge.');
		expect(localAliasCandidateEdge.inferenceBasis.inputIds).toEqual(
			expect.arrayContaining([
				localAliasAssignment.nodeId,
				localAliasAssignment.targetNodeId,
				localAliasAssignment.valueNodeId
			])
		);
		const localDirectSite = directSites('localDirect').find(
			(site) => site.resolutionClass === 'CANDIDATE_SET'
		)!;
		const localDirectCandidateEdge = targetEdges.find(
			(edge) =>
				edge.relationKind === 'CANDIDATE_CALL_TARGET' &&
				edge.invocationId === localDirectSite.invocationId
		);
		if (localDirectCandidateEdge?.relationKind !== 'CANDIDATE_CALL_TARGET')
			throw new Error('Missing local-direct candidate edge.');
		expect(localDirectCandidateEdge.inferenceBasis.inputIds).not.toContain(
			localAliasAssignment.nodeId
		);

		const candidateRanksByInvocation = new Map<string, number[]>();
		for (const edge of targetEdges) {
			if (edge.relationKind !== 'CANDIDATE_CALL_TARGET') continue;
			const ranks = candidateRanksByInvocation.get(edge.invocationId) ?? [];
			ranks.push(edge.candidateRank);
			candidateRanksByInvocation.set(edge.invocationId, ranks);
		}
		for (const ranks of candidateRanksByInvocation.values())
			expect(ranks.sort((left, right) => left - right)).toEqual(
				ranks.map((_rank, index) => index + 1)
			);
		const sourceById = new Map(semanticSnapshot.sources.map((source) => [source.id, source]));
		const referenceById = new Map(
			semanticSnapshot.references.map((reference) => [reference.id, reference])
		);
		const graphNodeById = new Map(graph.nodes.map((node) => [node.id, node]));
		for (const site of sites.filter((entry) => entry.resolutionClass === 'CANDIDATE_SET')) {
			const source = sourceById.get(site.sourceId)!;
			const expectedCallSiteProvenance = [
				...new Set([
					source.provenanceId,
					...(source.syntaxProvenanceId === null ? [] : [source.syntaxProvenanceId]),
					...site.referenceIds.flatMap((referenceId) => {
						const reference = referenceById.get(referenceId)!;
						return [reference.resolutionProvenanceId, reference.structuralProvenanceId];
					})
				])
			].sort();
			expect(site.provenanceIds).toEqual(expectedCallSiteProvenance);
			for (const edge of targetEdges.filter(
				(entry) =>
					entry.relationKind === 'CANDIDATE_CALL_TARGET' && entry.invocationId === site.invocationId
			)) {
				const target = graphNodeById.get(edge.target.nodeId)!;
				expect(edge.provenanceIds).toEqual(
					[...new Set([...site.provenanceIds, ...target.provenanceIds])].sort()
				);
			}
		}
		expectIndexReconciliation(graph);
		expect(graph.entryMechanismCoverage.every((entry) => entry.state === 'NOT_ANALYZED')).toBe(
			true
		);
		expect(graph).toMatchObject({
			coverage: { closure: 'OPEN', wholeProgramReachability: 'NOT_CLAIMED' },
			health: 'PARTIAL'
		});
		expect(graph.limitations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					invocationId: null,
					kind: 'CALLER_CONTEXT_COARSENED',
					sourceId: null
				})
			])
		);

		const repeated = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (repeated.outcome === 'unavailable') throw new Error(JSON.stringify(repeated));
		expect(canonicalSemanticJson(repeated.graph)).toBe(canonicalSemanticJson(graph));
	});

	it('projects accessor, static-block, inline-class, super, transparent, and unsupported-reference scenarios', () => {
		const semanticSnapshot = snapshot(
			fixtureFromSource(`
function helper(): void {}

class AccessorOwner {
  private current = 0;
  get value(): number { helper(); return this.current; }
  set value(next: number) { helper(); this.current = next; }
}

class StaticOwner {
  static { helper(); }
}

class Base {
  constructor() { helper(); }
  method(): void { helper(); }
}

class Derived extends Base {
  constructor(public callback: () => void) {
    super();
    callback();
    this.callback();
  }
  invokeBase(): void { super.method(); }
}

const chain = { nested: { invoke(): void { helper(); } } };
chain.nested.invoke();
(0 as unknown as () => void)();
new (class { constructor() { helper(); } })();
new (class {})();
new Derived(() => undefined);
void AccessorOwner;
void StaticOwner;
`)
		);
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const sites = callSites(graph);
		const semanticNodeById = new Map(semanticSnapshot.astNodes.map((node) => [node.id, node]));
		const callableTargets = graph.nodes.filter(
			(node): node is Extract<CallGraphNode, { kind: 'CALLABLE_TARGET' }> =>
				node.kind === 'CALLABLE_TARGET'
		);
		const callableById = new Map(callableTargets.map((node) => [node.id, node]));

		expect(callableTargets).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ bodyState: 'BLOCK_BODY', callableKind: 'GET_ACCESSOR' }),
				expect.objectContaining({ bodyState: 'BLOCK_BODY', callableKind: 'SET_ACCESSOR' }),
				expect.objectContaining({ bodyState: 'STATIC_BLOCK', callableKind: 'CLASS_STATIC_BLOCK' }),
				expect.objectContaining({ bodyState: 'IMPLICIT', callableKind: 'CLASS_EXPRESSION' })
			])
		);
		const helperOwnerKinds = new Set(
			sites
				.filter(
					(site) => semanticNodeById.get(site.calleeNodeId)?.syntacticIdentifierText === 'helper'
				)
				.map((site) => callableById.get(site.ownerNodeId)?.callableKind)
		);
		expect(helperOwnerKinds).toEqual(
			new Set([
				'CONSTRUCTOR',
				'GET_ACCESSOR',
				'METHOD_DECLARATION',
				'SET_ACCESSOR',
				'CLASS_STATIC_BLOCK'
			])
		);

		const inlineNewSites = sites.filter(
			(site) => site.invocationKind === 'NEW' && site.dispatchClass === 'INLINE_CALLABLE'
		);
		expect(inlineNewSites).toHaveLength(2);
		expect(
			inlineNewSites.flatMap((site) =>
				site.targetNodeIds.map((nodeId) => callableById.get(nodeId)?.callableKind)
			)
		).toEqual(expect.arrayContaining(['CONSTRUCTOR', 'CLASS_EXPRESSION']));
		expect(sites).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					reasonCode: 'THIS_OR_SUPER_DISPATCH',
					resolutionClass: 'UNSUPPORTED'
				}),
				expect.objectContaining({
					dispatchClass: 'DIRECT_REFERENCE',
					reasonCode: 'CALLEE_REFERENCE_NOT_RECONCILED',
					referenceIds: [],
					resolutionClass: 'UNRESOLVED'
				}),
				expect.objectContaining({
					reasonCode: 'MULTIPLE_CALLEE_REFERENCE_CANDIDATES',
					resolutionClass: 'UNSUPPORTED'
				}),
				expect.objectContaining({
					reasonCode: 'REFERENCE_UNSUPPORTED',
					resolutionClass: 'UNSUPPORTED'
				})
			])
		);
		const multipleReferences = sites.find(
			(site) => site.reasonCode === 'MULTIPLE_CALLEE_REFERENCE_CANDIDATES'
		);
		expect(multipleReferences?.referenceIds.length).toBeGreaterThan(1);
		expect(
			sites.filter((site) => site.reasonCode === 'REFERENCE_UNSUPPORTED').length
		).toBeGreaterThanOrEqual(2);
		expect(graph.epistemic).toMatchObject({
			inferenceState: 'MIXED',
			supportBasis: 'COMPILER_BOUND_STATIC_CANDIDATE'
		});
		expect(validateCallGraph(graph, semanticSnapshot)).toEqual({ issues: [], state: 'VALID' });
	});

	it('derives aggregate epistemic state from all-candidate, all-unsupported, and unresolved-only fixtures', () => {
		const cases = [
			{
				expectedResolution: 'CANDIDATE_SET',
				expectedState: 'CANDIDATE',
				expectedSupport: 'COMPILER_BOUND_STATIC_CANDIDATE',
				name: 'all candidate',
				source: 'function target(): void {}\ntarget();'
			},
			{
				expectedResolution: 'UNSUPPORTED',
				expectedState: 'UNRESOLVED',
				expectedSupport: 'UNSUPPORTED',
				name: 'all unsupported',
				source: "eval('0');"
			},
			{
				expectedResolution: 'UNRESOLVED',
				expectedState: 'UNRESOLVED',
				expectedSupport: 'NO_TARGET_EVIDENCE',
				name: 'unresolved only',
				source: 'missingCall();'
			}
		] as const;

		for (const scenario of cases) {
			const semanticSnapshot = snapshot(fixtureFromSource(scenario.source));
			const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
			if (outcome.outcome === 'unavailable')
				throw new Error(`${scenario.name}: ${JSON.stringify(outcome)}`);
			expect(callSites(outcome.graph), scenario.name).toHaveLength(1);
			expect(callSites(outcome.graph)[0], scenario.name).toMatchObject({
				resolutionClass: scenario.expectedResolution
			});
			expect(outcome.graph.epistemic, scenario.name).toEqual({
				capabilityCoverage: 'PARTIAL',
				conflictState: 'NOT_EVALUATED',
				executionHealth: 'PARTIAL',
				freshness: 'SNAPSHOT_BOUND',
				inferenceState: scenario.expectedState,
				supportBasis: scenario.expectedSupport
			});
			expect(outcome.graph.layers[0].epistemic, scenario.name).toEqual(outcome.graph.epistemic);
		}
	});

	it('keeps a zero-invocation subject explicit and reconciled without inventing calls', () => {
		const semanticSnapshot = snapshot(fixture('ZERO'));
		expect(semanticSnapshot.invocations).toHaveLength(0);
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		expect(callSites(outcome.graph)).toHaveLength(0);
		expect(outcome.graph.edges).toHaveLength(0);
		expect(outcome.graph.coverage).toMatchObject({
			candidateSetCallSites: 0,
			exactCallSites: 0,
			expectedCallSites: 0,
			externalDispatchCallSites: 0,
			frontierNodes: 0,
			ownershipEdges: 0,
			reconciles: true,
			representedCallSites: 0,
			targetEdges: 0,
			unresolvedCallSites: 0,
			unsupportedCallSites: 0,
			wholeProgramReachability: 'NOT_CLAIMED'
		});
		expect(outcome.graph.epistemic).toEqual({
			capabilityCoverage: 'PARTIAL',
			conflictState: 'NOT_EVALUATED',
			executionHealth: semanticSnapshot.health === 'COMPLETE' ? 'SUCCEEDED' : 'PARTIAL',
			freshness: 'SNAPSHOT_BOUND',
			inferenceState: 'NONE',
			supportBasis: 'COMPILER_CONFIRMED'
		});
		expect(outcome.graph.layers[0].epistemic).toEqual(outcome.graph.epistemic);
		expect(outcome.graph.limitations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					invocationId: null,
					kind: 'CALLER_CONTEXT_COARSENED',
					sourceId: null
				})
			])
		);
		expectIndexReconciliation(outcome.graph);
	});

	it('fails closed across the request and required-capability trust boundary', () => {
		const semanticSnapshot = snapshot(fixture('ZERO'));
		const valid = graphRequest(semanticSnapshot);
		const missingField = { ...valid } as Record<string, unknown>;
		Reflect.deleteProperty(missingField, 'subjectId');
		const extraField = { ...valid, unexpected: 'field' };
		const accessorField = { ...valid } as Record<string, unknown>;
		Object.defineProperty(accessorField, 'subjectId', {
			configurable: true,
			enumerable: true,
			get: () => valid.subjectId
		});
		const nonenumerableField = { ...valid } as Record<string, unknown>;
		Object.defineProperty(nonenumerableField, 'subjectId', {
			configurable: true,
			enumerable: false,
			value: valid.subjectId
		});
		const requestCases: readonly [name: string, value: unknown, message: string][] = [
			['null', null, 'plain data object'],
			['array', [], 'plain data object'],
			['proxy', new Proxy({ ...valid }, {}), 'plain data object'],
			[
				'non-plain prototype',
				Object.assign(Object.create({ inherited: true }) as Record<string, unknown>, valid),
				'plain prototype'
			],
			['symbol key', { ...valid, [Symbol('hidden')]: true }, 'rejects symbol keys'],
			['missing field', missingField, 'requires exactly'],
			['extra field', extraField, 'requires exactly'],
			['accessor field', accessorField, 'must be data'],
			['non-enumerable field', nonenumerableField, 'must be data'],
			['empty field', { ...valid, subjectId: '' }, 'must be nonempty text'],
			['non-string field', { ...valid, subjectId: 7 }, 'must be nonempty text'],
			['schema version', { ...valid, schemaVersion: 'unsupported' }, 'request schema version'],
			['operation version', { ...valid, operationVersion: 'unsupported' }, 'operation version']
		];
		for (const [name, value, message] of requestCases) {
			expect(buildCallGraph(value, semanticSnapshot), name).toMatchObject({
				diagnostics: [
					{
						code: 'REQUEST_INVALID',
						message: expect.stringContaining(message),
						phase: 'REQUEST'
					}
				],
				outcome: 'unavailable'
			});
		}

		const nullPrototypeRequest = Object.assign(
			Object.create(null) as Record<string, unknown>,
			valid
		);
		expect(buildCallGraph(nullPrototypeRequest, semanticSnapshot).outcome).toBe('partial');

		for (const capability of ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL', 'TS_TYPE'] as const) {
			const withoutCapability = {
				...semanticSnapshot,
				capabilities: semanticSnapshot.capabilities.filter(
					(record) => record.capability !== capability
				)
			} as StaticSemanticSnapshot;
			expect(buildCallGraph(valid, withoutCapability), `missing ${capability}`).toMatchObject({
				diagnostics: [
					{
						code: 'SEMANTIC_CAPABILITY_UNAVAILABLE',
						message: expect.stringContaining(capability)
					}
				],
				outcome: 'unavailable'
			});
		}
		const unsupportedType = {
			...semanticSnapshot,
			capabilities: semanticSnapshot.capabilities.map((record) =>
				record.capability === 'TS_TYPE' ? { ...record, state: 'UNSUPPORTED' as const } : record
			)
		} as StaticSemanticSnapshot;
		expect(buildCallGraph(valid, unsupportedType)).toMatchObject({
			diagnostics: [{ code: 'SEMANTIC_CAPABILITY_UNAVAILABLE' }],
			outcome: 'unavailable'
		});
	});

	it('fails closed on malformed semantic populations before projecting graph identities', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const childNode = semanticSnapshot.astNodes.find((node) => node.parentId !== null)!;
		const boundDeclaration = semanticSnapshot.declarations.find(
			(declaration) => declaration.nodeId !== null && declaration.symbolId !== null
		)!;
		const declaredSymbol = semanticSnapshot.symbols.find(
			(symbol) => symbol.declarationIds.length > 0
		)!;
		const resolvedReference = semanticSnapshot.references.find(
			(reference) => reference.resolvedSymbolId !== null
		)!;
		expect(childNode).toBeDefined();
		expect(boundDeclaration).toBeDefined();
		expect(declaredSymbol).toBeDefined();
		expect(resolvedReference).toBeDefined();

		const cases: readonly {
			message: string;
			mutate: (value: StaticSemanticSnapshot) => unknown;
			name: string;
		}[] = [
			{
				message: 'population contains duplicate IDs',
				mutate: (value) => ({ ...value, astNodes: [...value.astNodes, value.astNodes[0]!] }),
				name: 'duplicate AST node'
			},
			{
				message: 'has a missing source',
				mutate: (value) => ({
					...value,
					astNodes: value.astNodes.map((node, index) =>
						index === 0 ? { ...node, sourceId: 'semantic:source-missing' } : node
					)
				}),
				name: 'AST node source'
			},
			{
				message: 'has an invalid parent',
				mutate: (value) => ({
					...value,
					astNodes: value.astNodes.map((node) =>
						node.id === childNode.id ? { ...node, parentId: 'semantic:node-missing' } : node
					)
				}),
				name: 'AST node parent'
			},
			{
				message: 'has a missing source',
				mutate: (value) => ({
					...value,
					declarations: value.declarations.map((declaration) =>
						declaration.id === boundDeclaration.id
							? { ...declaration, sourceId: 'semantic:source-missing' }
							: declaration
					)
				}),
				name: 'declaration source'
			},
			{
				message: 'has an invalid node',
				mutate: (value) => ({
					...value,
					declarations: value.declarations.map((declaration) =>
						declaration.id === boundDeclaration.id
							? { ...declaration, nodeId: 'semantic:node-missing' }
							: declaration
					)
				}),
				name: 'declaration node'
			},
			{
				message: 'has a missing symbol',
				mutate: (value) => ({
					...value,
					declarations: value.declarations.map((declaration) =>
						declaration.id === boundDeclaration.id
							? { ...declaration, symbolId: 'semantic:symbol-missing' }
							: declaration
					)
				}),
				name: 'declaration symbol'
			},
			{
				message: 'has a missing declaration',
				mutate: (value) => ({
					...value,
					symbols: value.symbols.map((symbol) =>
						symbol.id === declaredSymbol.id
							? { ...symbol, declarationIds: ['semantic:declaration-missing'] }
							: symbol
					)
				}),
				name: 'symbol declaration'
			},
			{
				message: 'has an invalid node',
				mutate: (value) => ({
					...value,
					references: value.references.map((reference) =>
						reference.id === resolvedReference.id
							? { ...reference, nodeId: 'semantic:node-missing' }
							: reference
					)
				}),
				name: 'reference node'
			},
			{
				message: 'has a missing resolved symbol',
				mutate: (value) => ({
					...value,
					references: value.references.map((reference) =>
						reference.id === resolvedReference.id
							? { ...reference, resolvedSymbolId: 'semantic:symbol-missing' }
							: reference
					)
				}),
				name: 'reference symbol'
			}
		];
		for (const scenario of cases) {
			const outcome = buildCallGraph(
				graphRequest(semanticSnapshot),
				scenario.mutate(semanticSnapshot) as StaticSemanticSnapshot
			);
			expect(outcome, scenario.name).toMatchObject({
				diagnostics: [
					{
						code: 'DANGLING_SEMANTIC_REFERENCE',
						message: expect.stringContaining(scenario.message),
						phase: 'PROJECT'
					}
				],
				outcome: 'unavailable'
			});
		}
	});

	it('fails closed on request mismatches and mutation of consumed semantic endpoints', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		expect(
			buildCallGraph(
				{ ...graphRequest(semanticSnapshot), subjectId: 'wrong-subject' },
				semanticSnapshot
			)
		).toMatchObject({
			diagnostics: [{ code: 'SUBJECT_ID_MISMATCH' }],
			outcome: 'unavailable'
		});
		expect(
			buildCallGraph(
				{ ...graphRequest(semanticSnapshot), semanticSnapshotId: 'wrong-snapshot' },
				semanticSnapshot
			)
		).toMatchObject({
			diagnostics: [{ code: 'SEMANTIC_SNAPSHOT_ID_MISMATCH' }],
			outcome: 'unavailable'
		});

		const firstInvocation = semanticSnapshot.invocations[0]!;
		const mutated = {
			...semanticSnapshot,
			invocations: [
				{ ...firstInvocation, calleeNodeId: 'semantic:node-missing' },
				...semanticSnapshot.invocations.slice(1)
			]
		} as StaticSemanticSnapshot;
		expect(buildCallGraph(graphRequest(semanticSnapshot), mutated)).toMatchObject({
			diagnostics: [{ code: 'DANGLING_SEMANTIC_REFERENCE' }],
			outcome: 'unavailable'
		});
	});

	it('independently rejects population, candidate-rank, index, and exact-target overclaims', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;

		const badCoverage = {
			...graph,
			coverage: { ...graph.coverage, representedCallSites: graph.coverage.representedCallSites + 1 }
		} as CallGraphSnapshot;
		expect(validateCallGraph(badCoverage, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'POPULATION_MISMATCH' })]),
			state: 'INVALID'
		});

		const candidateEdge = graph.edges.find(
			(edge) => edge.relationKind === 'CANDIDATE_CALL_TARGET'
		)!;
		const badRank = {
			...graph,
			edges: graph.edges.map((edge) =>
				edge.id === candidateEdge.id ? { ...edge, candidateRank: 99 } : edge
			)
		} as CallGraphSnapshot;
		expect(validateCallGraph(badRank, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'POPULATION_MISMATCH' })]),
			state: 'INVALID'
		});

		const badIndex = { ...graph, forwardIndex: graph.forwardIndex.slice(1) } as CallGraphSnapshot;
		expect(validateCallGraph(badIndex, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'POPULATION_MISMATCH' })]),
			state: 'INVALID'
		});

		const firstSite = callSites(graph)[0]!;
		const exactOverclaim = {
			...graph,
			nodes: graph.nodes.map((node) =>
				node.id === firstSite.id ? { ...node, resolutionClass: 'EXACT' } : node
			)
		} as CallGraphSnapshot;
		expect(validateCallGraph(exactOverclaim, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'CONFORMANCE_OVERCLAIM' })]),
			state: 'INVALID'
		});
	});

	it('rejects malformed call-graph wire records through a bounded shape matrix', () => {
		const semanticSnapshot = snapshot(fixtureFromSource('function target(): void {}\ntarget();'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const nodeIndex = graph.nodes.findIndex((node) => node.sourceLocations.length > 0);
		const edgeIndex = graph.edges.findIndex(
			(edge) => edge.relationKind === 'CANDIDATE_CALL_TARGET'
		);
		const limitationIndex = 0;
		const entryIndex = 0;
		const laneIndex = 0;
		const indexEntry = 0;
		expect(nodeIndex).toBeGreaterThanOrEqual(0);
		expect(edgeIndex).toBeGreaterThanOrEqual(0);
		expect(graph.limitations.length).toBeGreaterThan(0);

		const cases: readonly {
			code: string;
			mutate: (value: CallGraphSnapshot) => unknown;
			name: string;
			path: string;
		}[] = [
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({ ...value, unexpected: true }),
				name: 'top-level exact fields',
				path: '$'
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					epistemic: { ...value.epistemic, inferenceState: 'IMPOSSIBLE' }
				}),
				name: 'epistemic enum',
				path: '$.epistemic'
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({ ...value, producer: { ...value.producer, api: 'PRIVATE_API' } }),
				name: 'provider identity',
				path: '$.producer'
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					coverage: { ...value.coverage, expectedCallSites: -1 }
				}),
				name: 'coverage primitive',
				path: '$.coverage'
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					limitations: value.limitations.map((entry, index) =>
						index === limitationIndex ? { ...entry, reason: '' } : entry
					)
				}),
				name: 'limitation record',
				path: `$.limitations[${limitationIndex}]`
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					entryMechanismCoverage: value.entryMechanismCoverage.map((entry, index) =>
						index === entryIndex ? { ...entry, state: 'UNKNOWN' } : entry
					)
				}),
				name: 'entry-mechanism coverage',
				path: `$.entryMechanismCoverage[${entryIndex}]`
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					relationLaneCoverage: value.relationLaneCoverage.map((entry, index) =>
						index === laneIndex ? { ...entry, state: 'UNKNOWN' } : entry
					)
				}),
				name: 'relation-lane coverage',
				path: `$.relationLaneCoverage[${laneIndex}]`
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					forwardIndex: value.forwardIndex.map((entry, index) =>
						index === indexEntry ? { ...entry, edgeIds: 'not-an-array' } : entry
					)
				}),
				name: 'index entry',
				path: `$.forwardIndex[${indexEntry}]`
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					nodes: value.nodes.map((node, index) => (index === nodeIndex ? null : node))
				}),
				name: 'non-object node',
				path: `$.nodes[${nodeIndex}]`
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					nodes: value.nodes.map((node, index) =>
						index === nodeIndex ? { ...node, kind: 'UNKNOWN_NODE' } : node
					)
				}),
				name: 'unknown node kind',
				path: `$.nodes[${nodeIndex}].kind`
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					nodes: value.nodes.map((node, index) => {
						if (index !== nodeIndex) return node;
						const location = node.sourceLocations[0]!;
						return {
							...node,
							sourceLocations: [{ ...location, start: location.end + 1 }]
						};
					})
				}),
				name: 'source location',
				path: `$.nodes[${nodeIndex}].sourceLocations[0]`
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					edges: value.edges.map((edge, index) => (index === edgeIndex ? null : edge))
				}),
				name: 'non-object edge',
				path: `$.edges[${edgeIndex}]`
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					edges: value.edges.map((edge, index) =>
						index === edgeIndex
							? { ...edge, source: { ...edge.source, kind: 'UNKNOWN_ENDPOINT' } }
							: edge
					)
				}),
				name: 'edge endpoint',
				path: `$.edges[${edgeIndex}].source`
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					edges: value.edges.map((edge, index) =>
						index === edgeIndex && edge.relationKind === 'CANDIDATE_CALL_TARGET'
							? { ...edge, inferenceBasis: { ...edge.inferenceBasis, rationale: '' } }
							: edge
					)
				}),
				name: 'candidate inference basis',
				path: `$.edges[${edgeIndex}]`
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => {
					const layer = { ...value.layers[0] } as Record<string, unknown>;
					Reflect.deleteProperty(layer, 'method');
					return { ...value, layers: [layer] };
				},
				name: 'layer exact fields',
				path: '$.layers[0]'
			}
		];

		for (const scenario of cases) {
			const validation = validateCallGraph(scenario.mutate(graph), semanticSnapshot, {
				maxIssues: 8
			});
			expect(validation.state, scenario.name).toBe('INVALID');
			expect(validation.issues, scenario.name).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: scenario.code, path: scenario.path })
				])
			);
		}

		for (const maxIssues of [0, 1.5, 100_001]) {
			expect(validateCallGraph(graph, semanticSnapshot, { maxIssues })).toEqual({
				issues: [
					{
						code: 'INVALID_VALUE',
						message: 'maxIssues must be a positive safe integer no greater than 100000.',
						path: '$validationOptions.maxIssues'
					}
				],
				state: 'INVALID'
			});
		}
	});

	it('bounds hostile call-graph populations and stops at the issue budget', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const candidateEdge = graph.edges.find((edge) => edge.relationKind === 'CANDIDATE_CALL_TARGET');
		expect(candidateEdge).toBeDefined();
		if (candidateEdge?.relationKind !== 'CANDIDATE_CALL_TARGET')
			throw new Error('Missing candidate edge fixture.');

		const overlong = <T>(seed: readonly T[], length: number): T[] =>
			Array.from({ length }, (_, index) => seed[index % seed.length]!);
		const cases: readonly {
			mutate: (value: CallGraphSnapshot) => unknown;
			path: string;
		}[] = [
			{
				mutate: (value) => ({ ...value, nodes: overlong(value.nodes, value.nodes.length + 1_000) }),
				path: '$.nodes'
			},
			{
				mutate: (value) => ({
					...value,
					nodes: value.nodes.map((node, index) =>
						index === 0
							? {
									...node,
									provenanceIds: overlong(
										semanticSnapshot.provenances.map((record) => record.id),
										semanticSnapshot.provenances.length + 1
									)
								}
							: node
					)
				}),
				path: '$.nodes[0].provenanceIds'
			},
			{
				mutate: (value) => ({
					...value,
					edges: value.edges.map((edge) =>
						edge.id === candidateEdge.id
							? {
									...candidateEdge,
									inferenceBasis: {
										...candidateEdge.inferenceBasis,
										limitationKinds: overlong(candidateEdge.inferenceBasis.limitationKinds, 100)
									}
								}
							: edge
					)
				}),
				path: `$.edges[${graph.edges.findIndex((edge) => edge.id === candidateEdge.id)}].inferenceBasis.limitationKinds`
			},
			{
				mutate: (value) => ({
					...value,
					layers: [
						{
							...value.layers[0],
							entryMechanismCoverage: overlong(value.entryMechanismCoverage, 100)
						}
					]
				}),
				path: '$.layers[0].entryMechanismCoverage'
			},
			{
				mutate: (value) => ({
					...value,
					forwardIndex: value.forwardIndex.map((entry, index) =>
						index === 0
							? {
									...entry,
									edgeIds: overlong(
										value.edges.map((edge) => edge.id),
										value.edges.length + 1
									)
								}
							: entry
					)
				}),
				path: '$.forwardIndex[0].edgeIds'
			}
		];

		for (const scenario of cases)
			expect(validateCallGraph(scenario.mutate(graph), semanticSnapshot).issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: 'POPULATION_BUDGET_EXCEEDED', path: scenario.path })
				])
			);

		const malformed = {
			...graph,
			nodes: graph.nodes.map(() => null),
			producer: null
		};
		expect(validateCallGraph(malformed, semanticSnapshot, { maxIssues: 1 })).toMatchObject({
			issues: [expect.objectContaining({ code: 'INVALID_SHAPE' })],
			state: 'BUDGET_EXHAUSTED'
		});
	});

	it('rejects noncanonical, duplicate, missing-layer, and nested wire populations', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const nodeWithSeveralProvenances = graph.nodes.find((node) => node.provenanceIds.length > 1);
		expect(nodeWithSeveralProvenances).toBeDefined();
		if (nodeWithSeveralProvenances === undefined)
			throw new Error('Missing node with multiple provenance records.');

		const cases: readonly {
			code: string;
			mutate: (value: CallGraphSnapshot) => unknown;
			path: string;
		}[] = [
			{
				code: 'INVALID_SHAPE',
				mutate: () => null,
				path: '$'
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => ({
					...value,
					layers: [{ ...value.layers[0], epistemic: null }]
				}),
				path: '$.layers[0].epistemic'
			},
			{
				code: 'NONCANONICAL_ORDER',
				mutate: (value) => ({ ...value, nodes: [...value.nodes].reverse() }),
				path: '$.nodes'
			},
			{
				code: 'DUPLICATE_ID',
				mutate: (value) => ({
					...value,
					nodes: [value.nodes[0], value.nodes[0], ...value.nodes.slice(2)]
				}),
				path: '$.nodes[1].id'
			},
			{
				code: 'NONCANONICAL_ORDER',
				mutate: (value) => ({
					...value,
					nodes: value.nodes.map((node) =>
						node.id === nodeWithSeveralProvenances.id
							? { ...node, provenanceIds: [...node.provenanceIds].reverse() }
							: node
					)
				}),
				path: `$.nodes[${graph.nodes.findIndex((node) => node.id === nodeWithSeveralProvenances.id)}].provenanceIds`
			},
			{
				code: 'DUPLICATE_ID',
				mutate: (value) => ({
					...value,
					nodes: value.nodes.map((node) =>
						node.id === nodeWithSeveralProvenances.id
							? { ...node, provenanceIds: [node.provenanceIds[0], node.provenanceIds[0]] }
							: node
					)
				}),
				path: `$.nodes[${graph.nodes.findIndex((node) => node.id === nodeWithSeveralProvenances.id)}].provenanceIds`
			},
			{
				code: 'POPULATION_MISMATCH',
				mutate: (value) => ({ ...value, layers: [] }),
				path: '$.layers'
			},
			{
				code: 'POPULATION_MISMATCH',
				mutate: (value) => ({
					...value,
					entryMechanismCoverage: value.entryMechanismCoverage.slice(1)
				}),
				path: '$.entryMechanismCoverage'
			},
			{
				code: 'POPULATION_MISMATCH',
				mutate: (value) => ({
					...value,
					relationLaneCoverage: value.relationLaneCoverage.slice(1)
				}),
				path: '$.relationLaneCoverage'
			}
		];

		for (const scenario of cases) {
			const result = validateCallGraph(scenario.mutate(graph), semanticSnapshot, { maxIssues: 20 });
			expect(result.state).not.toBe('VALID');
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: scenario.code, path: scenario.path })
				])
			);
		}
	});

	it('fails closed when bound semantic identities and extents no longer support graph evidence', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const changed = <T extends string>(value: T): T => `${value}-changed` as T;
		const cases: readonly {
			message: string;
			mutate: (value: StaticSemanticSnapshot) => StaticSemanticSnapshot;
		}[] = [
			{
				message: 'Absent semantic provenance.',
				mutate: (value) =>
					({
						...value,
						provenances: value.provenances.map((record) => ({
							...record,
							id: changed(record.id)
						}))
					}) as StaticSemanticSnapshot
			},
			{
				message: 'Provenance does not belong to the bound semantic snapshot and subject.',
				mutate: (value) =>
					({
						...value,
						provenances: value.provenances.map((record) => ({
							...record,
							subjectId: changed(record.subjectId)
						}))
					}) as StaticSemanticSnapshot
			},
			{
				message: 'Provenance project is absent.',
				mutate: (value) =>
					({
						...value,
						projects: value.projects.map((record) => ({ ...record, id: changed(record.id) }))
					}) as StaticSemanticSnapshot
			},
			{
				message: 'Absent semantic source.',
				mutate: (value) =>
					({
						...value,
						sources: value.sources.map((record) => ({ ...record, id: changed(record.id) }))
					}) as StaticSemanticSnapshot
			},
			{
				message: 'Location exceeds its source.',
				mutate: (value) =>
					({
						...value,
						sources: value.sources.map((record) => ({ ...record, textLength: 0 }))
					}) as StaticSemanticSnapshot
			},
			{
				message: 'Absent callable AST node.',
				mutate: (value) =>
					({
						...value,
						astNodes: value.astNodes.map((record) => ({ ...record, id: changed(record.id) }))
					}) as StaticSemanticSnapshot
			},
			{
				message: 'Absent semantic invocation.',
				mutate: (value) =>
					({
						...value,
						invocations: value.invocations.map((record) => ({ ...record, id: changed(record.id) }))
					}) as StaticSemanticSnapshot
			},
			{
				message: 'Absent declaration.',
				mutate: (value) =>
					({
						...value,
						declarations: value.declarations.map((record) => ({
							...record,
							id: changed(record.id)
						}))
					}) as StaticSemanticSnapshot
			},
			{
				message: 'Absent callable symbol.',
				mutate: (value) =>
					({
						...value,
						symbols: value.symbols.map((record) => ({ ...record, id: changed(record.id) }))
					}) as StaticSemanticSnapshot
			}
		];

		for (const scenario of cases) {
			const result = validateCallGraph(graph, scenario.mutate(semanticSnapshot));
			expect(result.state).not.toBe('VALID');
			if (!result.issues.some((issue) => issue.message === scenario.message))
				throw new Error(
					`Missing validator issue '${scenario.message}'; received ${JSON.stringify(result.issues)}`
				);
		}
	});

	it('rejects independently mutated graph and layer metadata through a bounded matrix', () => {
		const semanticSnapshot = snapshot(fixture('ZERO'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const cases: readonly {
			code: string;
			mutate: (value: CallGraphSnapshot) => unknown;
			name: string;
			path: string;
		}[] = [
			{
				code: 'UNSUPPORTED_SCHEMA_VERSION',
				mutate: (value) => ({ ...value, schemaVersion: 'unsupported' }),
				name: 'schema version',
				path: '$.schemaVersion'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ({ ...value, operationVersion: 'unsupported' }),
				name: 'operation version',
				path: '$.operationVersion'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ({ ...value, canonicalProfile: 'unsupported' }),
				name: 'canonical profile',
				path: '$.canonicalProfile'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ({ ...value, method: 'unsupported' }),
				name: 'method',
				path: '$.method'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ({ ...value, capability: 'unsupported' }),
				name: 'capability',
				path: '$.capability'
			},
			{
				code: 'CONFORMANCE_OVERCLAIM',
				mutate: (value) => ({ ...value, fullJanCsaa007Conformance: 'CLAIMED' }),
				name: 'full conformance',
				path: '$.fullJanCsaa007Conformance'
			},
			{
				code: 'CONFORMANCE_OVERCLAIM',
				mutate: (value) => ({ ...value, health: 'COMPLETE' }),
				name: 'health overclaim',
				path: '$.health'
			},
			{
				code: 'CONFORMANCE_OVERCLAIM',
				mutate: (value) => ({
					...value,
					coverage: { ...value.coverage, closure: 'CLOSED_WITHIN_DECLARED_METHOD' }
				}),
				name: 'closure overclaim',
				path: '$.coverage'
			},
			{
				code: 'DANGLING_REFERENCE',
				mutate: (value) => ({ ...value, semanticSnapshotId: 'semantic:snapshot-other' }),
				name: 'semantic snapshot binding',
				path: '$.semanticSnapshotId'
			},
			{
				code: 'DANGLING_REFERENCE',
				mutate: (value) => ({ ...value, subjectId: 'subject:other' }),
				name: 'subject binding',
				path: '$.subjectId'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ({ ...value, semanticExtractionVersion: 'other' }),
				name: 'semantic extraction version',
				path: '$.semanticExtractionVersion'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ({ ...value, semanticSchemaVersion: 'other' }),
				name: 'semantic schema version',
				path: '$.semanticSchemaVersion'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ({
					...value,
					producer: { ...value.producer, version: 'other' }
				}),
				name: 'producer binding',
				path: '$.producer'
			},
			{
				code: 'GRAPH_INPUT_MISMATCH',
				mutate: (value) => ({ ...value, graphInputDigest: '0'.repeat(64) }),
				name: 'graph input digest',
				path: '$.graphInputDigest'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ({ ...value, contentDigest: 'not-a-digest' }),
				name: 'content digest wire form',
				path: '$.contentDigest'
			},
			{
				code: 'IDENTITY_MISMATCH',
				mutate: (value) => ({ ...value, id: 'call-graph:other' }),
				name: 'graph identity',
				path: '$.id'
			},
			{
				code: 'IDENTITY_MISMATCH',
				mutate: (value) => ({
					...value,
					layers: [{ ...value.layers[0], id: 'call-graph-layer:other' }]
				}),
				name: 'layer identity',
				path: '$.layers[0].id'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ({
					...value,
					layers: [
						{
							...value.layers[0],
							producer: { ...value.layers[0].producer, version: 'other' }
						}
					]
				}),
				name: 'layer producer',
				path: '$.layers[0].producer'
			}
		];

		for (const scenario of cases) {
			const validation = validateCallGraph(scenario.mutate(graph), semanticSnapshot, {
				maxIssues: 20
			});
			expect(validation.state, scenario.name).toBe('INVALID');
			expect(validation.issues, scenario.name).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: scenario.code, path: scenario.path })
				])
			);
		}
	});

	it('rejects coordinated semantic-evidence mutations after producer outputs and digests are repaired', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const sites = callSites(graph);

		const multiCandidate = sites.find(
			(site) => site.resolutionClass === 'CANDIDATE_SET' && site.targetNodeIds.length > 1
		);
		expect(multiCandidate).toBeDefined();
		if (multiCandidate === undefined) throw new Error('Missing multi-candidate fixture call.');
		const droppedTargetId = multiCandidate.targetNodeIds.at(-1)!;
		const droppedEdge = graph.edges.find(
			(edge) =>
				edge.relationKind === 'CANDIDATE_CALL_TARGET' &&
				edge.invocationId === multiCandidate.invocationId &&
				edge.target.nodeId === droppedTargetId
		);
		expect(droppedEdge).toBeDefined();
		if (droppedEdge === undefined) throw new Error('Missing candidate edge selected for removal.');
		const candidateDrop = repairedGraph(graph, {
			edges: graph.edges.filter((edge) => edge.id !== droppedEdge.id),
			nodes: graph.nodes.map((node) =>
				node.id === multiCandidate.id
					? { ...multiCandidate, targetNodeIds: multiCandidate.targetNodeIds.slice(0, -1) }
					: node
			)
		});
		expectIndependentIssue(
			candidateDrop,
			semanticSnapshot,
			'complete independently derived target set'
		);

		const reasonMutation = repairedGraph(graph, {
			nodes: graph.nodes.map((node) =>
				node.id === multiCandidate.id ? { ...node, reasonCode: 'DYNAMIC_IMPORT_CALL' } : node
			)
		});
		expectIndependentIssue(reasonMutation, semanticSnapshot, 'Call-site dispatch, reason');

		const referencedCandidate = sites.find(
			(site) => site.resolutionClass === 'CANDIDATE_SET' && site.referenceIds.length === 1
		);
		expect(referencedCandidate).toBeDefined();
		if (referencedCandidate === undefined) throw new Error('Missing referenced candidate call.');
		const unrelatedReference = semanticSnapshot.references.find(
			(reference) =>
				reference.sourceId === referencedCandidate.sourceId &&
				!referencedCandidate.referenceIds.includes(reference.id)
		);
		expect(unrelatedReference).toBeDefined();
		if (unrelatedReference === undefined) throw new Error('Missing unrelated valid reference.');
		const referenceMutation = repairedGraph(graph, {
			nodes: graph.nodes.map((node) =>
				node.id === referencedCandidate.id
					? { ...node, referenceIds: [unrelatedReference.id] }
					: node
			)
		});
		expectIndependentIssue(referenceMutation, semanticSnapshot, 'references, symbols');

		const unrelatedSymbol = semanticSnapshot.symbols.find(
			(symbol) => !referencedCandidate.resolvedSymbolIds.includes(symbol.id)
		);
		expect(unrelatedSymbol).toBeDefined();
		if (unrelatedSymbol === undefined) throw new Error('Missing unrelated valid symbol.');
		const symbolMutation = repairedGraph(graph, {
			nodes: graph.nodes.map((node) =>
				node.id === referencedCandidate.id
					? { ...node, resolvedSymbolIds: [unrelatedSymbol.id] }
					: node
			)
		});
		expectIndependentIssue(symbolMutation, semanticSnapshot, 'references, symbols');

		const singleCandidate = sites.find(
			(site) => site.resolutionClass === 'CANDIDATE_SET' && site.targetNodeIds.length === 1
		);
		expect(singleCandidate).toBeDefined();
		if (singleCandidate === undefined) throw new Error('Missing single-candidate call.');
		const wrongTarget = graph.nodes.find(
			(node) => node.kind === 'CALLABLE_TARGET' && !singleCandidate.targetNodeIds.includes(node.id)
		);
		expect(wrongTarget).toBeDefined();
		if (wrongTarget?.kind !== 'CALLABLE_TARGET')
			throw new Error('Missing alternate callable target.');
		const originalEdge = graph.edges.find(
			(edge) =>
				edge.relationKind === 'CANDIDATE_CALL_TARGET' &&
				edge.invocationId === singleCandidate.invocationId
		);
		expect(originalEdge).toBeDefined();
		if (originalEdge?.relationKind !== 'CANDIDATE_CALL_TARGET')
			throw new Error('Missing original candidate edge.');
		const wrongEndpoint = { kind: 'CALLABLE_TARGET' as const, nodeId: wrongTarget.id };
		const wrongTargetEdge: CallGraphEdge = {
			...originalEdge,
			id: callGraphEdgeId({
				candidateRank: originalEdge.candidateRank,
				graph: graph.id,
				invocationId: originalEdge.invocationId,
				relationKind: originalEdge.relationKind,
				source: originalEdge.source,
				target: wrongEndpoint
			}),
			inferenceBasis: {
				...originalEdge.inferenceBasis,
				inputIds: [
					...new Set([
						singleCandidate.invocationId,
						...singleCandidate.referenceIds,
						...singleCandidate.resolvedSymbolIds,
						wrongTarget.semanticNodeId,
						...wrongTarget.declarationIds
					])
				].sort()
			},
			provenanceIds: [
				...new Set([...singleCandidate.provenanceIds, ...wrongTarget.provenanceIds])
			].sort(),
			target: wrongEndpoint
		};
		const targetMutation = repairedGraph(graph, {
			edges: graph.edges.map((edge) => (edge.id === originalEdge.id ? wrongTargetEdge : edge)),
			nodes: graph.nodes.map((node) =>
				node.id === singleCandidate.id ? { ...node, targetNodeIds: [wrongTarget.id] } : node
			)
		});
		expectIndependentIssue(
			targetMutation,
			semanticSnapshot,
			'complete independently derived target set'
		);

		const frontier = graph.nodes.find((node) => node.kind === 'FRONTIER');
		expect(frontier).toBeDefined();
		if (frontier?.kind !== 'FRONTIER') throw new Error('Missing frontier fixture node.');
		const frontierMutation = repairedGraph(graph, {
			nodes: graph.nodes.map((node) =>
				node.id === frontier.id ? { ...node, reasonCode: 'REFERENCE_UNSUPPORTED' } : node
			)
		});
		expectIndependentIssue(frontierMutation, semanticSnapshot, 'Frontier class, reason');

		const entryOverclaim = graph.entryMechanismCoverage.map((entry, index) =>
			index === 0 ? { ...entry, state: 'PARTIAL' as const } : entry
		);
		const entryMutation = repairedGraph(graph, { entryMechanismCoverage: entryOverclaim });
		expectIndependentIssue(entryMutation, semanticSnapshot, 'exact NOT_ANALYZED');

		const laneOverclaim = graph.relationLaneCoverage.map((lane) =>
			lane.lane === 'INFERRED' ? { ...lane, state: 'SUPPORTED' as const } : lane
		);
		const laneMutation = repairedGraph(graph, { relationLaneCoverage: laneOverclaim });
		expectIndependentIssue(laneMutation, semanticSnapshot, 'exact bounded relation-lane');

		const inflatedProvenanceId = semanticSnapshot.provenances.find(
			(provenance) => !referencedCandidate.provenanceIds.includes(provenance.id)
		)?.id;
		expect(inflatedProvenanceId).toBeDefined();
		if (inflatedProvenanceId === undefined) throw new Error('Missing unrelated valid provenance.');
		const provenanceMutation = repairedGraph(graph, {
			edges: graph.edges.map((edge) =>
				edge.source.nodeId === referencedCandidate.id ||
				edge.target.nodeId === referencedCandidate.id
					? {
							...edge,
							provenanceIds: [...new Set([...edge.provenanceIds, inflatedProvenanceId])].sort()
						}
					: edge
			),
			nodes: graph.nodes.map((node) =>
				node.id === referencedCandidate.id
					? {
							...node,
							provenanceIds: [...new Set([...node.provenanceIds, inflatedProvenanceId])].sort()
						}
					: node
			)
		});
		expectIndependentIssue(provenanceMutation, semanticSnapshot, 'provenance differs');
		expectIndependentIssue(
			provenanceMutation,
			semanticSnapshot,
			'Edge provenance must exactly equal the independently derived union of endpoint evidence.'
		);
	});

	// --- Per-validator refusal assertions -------------------------------------------------
	// A no-op probe stubbed each (): void function in the validator and re-ran the whole csaa
	// project; these validators could be gutted with every test still green. The cause is that a
	// single issue CODE is emitted by many functions while the assertions matched the code alone,
	// so another emitter always satisfied them. Each test below names the MESSAGE, which is the
	// only per-validator discriminator.
	it('refuses a callable target whose declaration associations no longer match the semantic snapshot', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const callable = graph.nodes.find(
			(node) => node.kind === 'CALLABLE_TARGET' && node.declarationIds.length >= 1
		);
		expect(callable).toBeDefined();
		if (callable?.kind !== 'CALLABLE_TARGET') throw new Error('Missing callable-target fixture.');
		const strippedAssociations = repairedGraph(graph, {
			nodes: graph.nodes.map((node) =>
				node.id === callable.id ? { ...callable, declarationIds: [] } : node
			)
		});
		expect(validateCallGraph(strippedAssociations, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					message:
						'Callable declaration, symbol, or provenance associations do not exactly match the semantic snapshot.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('refuses a call site whose extent or owner no longer cites its invocation AST node', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const sites = callSites(graph);
		const wideSite = sites.find(
			(site) => site.sourceLocations[0]!.end - site.sourceLocations[0]!.start > 2
		);
		expect(wideSite).toBeDefined();
		if (wideSite === undefined) throw new Error('Missing multi-character call-site extent.');
		const shrunkExtent = repairedGraph(graph, {
			nodes: graph.nodes.map((node) =>
				node.id === wideSite.id
					? {
							...wideSite,
							sourceLocations: [
								{ ...wideSite.sourceLocations[0]!, end: wideSite.sourceLocations[0]!.end - 1 }
							]
						}
					: node
			)
		});
		expect(validateCallGraph(shrunkExtent, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', message: 'Call-site location mismatch.' })
			]),
			state: 'INVALID'
		});

		const reparentedSite = sites[0]!;
		const foreignOwner = graph.nodes.find(
			(node) => node.kind === 'CALLABLE_TARGET' && node.id !== reparentedSite.ownerNodeId
		);
		expect(foreignOwner).toBeDefined();
		if (foreignOwner === undefined) throw new Error('Missing alternate callable owner.');
		const reparented = repairedGraph(graph, {
			nodes: graph.nodes.map((node) =>
				node.id === reparentedSite.id ? { ...reparentedSite, ownerNodeId: foreignOwner.id } : node
			)
		});
		expect(validateCallGraph(reparented, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Call-site owner is not its nearest runtime callable or source region.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('refuses node populations that no longer project every source, callable, program, and project', () => {
		const zeroSnapshot = snapshot(fixture('ZERO'));
		const zeroOutcome = buildCallGraph(graphRequest(zeroSnapshot), zeroSnapshot);
		if (zeroOutcome.outcome === 'unavailable') throw new Error(JSON.stringify(zeroOutcome));
		const zeroGraph = zeroOutcome.graph;
		const droppedSourceRegion = repairedGraph(zeroGraph, {
			nodes: zeroGraph.nodes.filter((node) => node.kind !== 'SOURCE_REGION')
		});
		expect(validateCallGraph(droppedSourceRegion, zeroSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					message: 'Every semantic source must have exactly one SOURCE_REGION node.'
				})
			]),
			state: 'INVALID'
		});

		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const callable = graph.nodes.find((node) => node.kind === 'CALLABLE_TARGET');
		expect(callable).toBeDefined();
		if (callable?.kind !== 'CALLABLE_TARGET') throw new Error('Missing callable-target fixture.');
		const rebound = repairedGraph(graph, {
			nodes: graph.nodes.map((node) =>
				node.id === callable.id
					? { ...callable, semanticNodeId: semanticSnapshot.invocations[0]!.nodeId }
					: node
			)
		});
		expect(validateCallGraph(rebound, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					message:
						'Every derivable deep-indexed runtime callable AST node must have exactly one CALLABLE_TARGET node.'
				})
			]),
			state: 'INVALID'
		});

		const changed = <T extends string>(value: T): T => `${value}-changed` as T;
		const renamedProjects = {
			...semanticSnapshot,
			projects: semanticSnapshot.projects.map((project) => ({
				...project,
				id: changed(project.id)
			}))
		} as StaticSemanticSnapshot;
		expect(validateCallGraph(graph, renamedProjects)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Semantic source has an absent project or program.'
				})
			]),
			state: 'INVALID'
		});

		const reparentedPrograms = {
			...semanticSnapshot,
			programs: semanticSnapshot.programs.map((program) => ({
				...program,
				projectId: changed(program.projectId)
			}))
		} as StaticSemanticSnapshot;
		expect(validateCallGraph(graph, reparentedPrograms)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Semantic source program/project pair is inconsistent.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('refuses an edge whose extent or invocation AST node no longer cites its exact invocation', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const wideEdge = graph.edges.find(
			(edge) => edge.sourceLocations[0]!.end - edge.sourceLocations[0]!.start > 2
		);
		expect(wideEdge).toBeDefined();
		if (wideEdge === undefined) throw new Error('Missing multi-character edge extent.');
		const shrunkEdgeExtent = repairedGraph(graph, {
			edges: graph.edges.map((edge) =>
				edge.id === wideEdge.id
					? {
							...wideEdge,
							sourceLocations: [
								{ ...wideEdge.sourceLocations[0]!, end: wideEdge.sourceLocations[0]!.end - 1 }
							]
						}
					: edge
			)
		});
		expect(validateCallGraph(shrunkEdgeExtent, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: 'Edge location does not cite its exact invocation.'
				})
			]),
			state: 'INVALID'
		});

		const changed = <T extends string>(value: T): T => `${value}-changed` as T;
		const renamedAstNodes = {
			...semanticSnapshot,
			astNodes: semanticSnapshot.astNodes.map((record) => ({ ...record, id: changed(record.id) }))
		} as StaticSemanticSnapshot;
		expect(validateCallGraph(graph, renamedAstNodes)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Invocation AST node is absent.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a frontier node whose class no longer matches its unresolved call site', () => {
		const semanticSnapshot = snapshot(fixtureFromSource('missingCall();'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const site = callSites(graph)[0]!;
		expect(site.resolutionClass).toBe('UNRESOLVED');
		const frontier = graph.nodes.find(
			(node) => node.kind === 'FRONTIER' && node.invocationId === site.invocationId
		);
		if (frontier?.kind !== 'FRONTIER') throw new Error('Missing frontier fixture node.');

		const classMismatch = {
			...graph,
			nodes: graph.nodes.map((node) =>
				node.id === frontier.id ? { ...frontier, frontierKind: 'UNSUPPORTED' as const } : node
			)
		} as CallGraphSnapshot;

		expect(validateCallGraph(classMismatch, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					message: `Invocation ${site.invocationId} must have exactly one matching frontier node.`,
					path: '$.nodes'
				}),
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: `Invocation ${site.invocationId} frontier class mismatch.`,
					path: '$.nodes'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a call-site population keyed by an invocation the semantic snapshot does not carry', () => {
		const semanticSnapshot = snapshot(fixtureFromSource('function target(): void {}\ntarget();'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const site = callSites(graph)[0]!;

		const unknownInvocation = {
			...graph,
			nodes: graph.nodes.map((node) =>
				node.id === site.id ? { ...site, invocationId: `${site.invocationId}-absent` } : node
			)
		} as CallGraphSnapshot;

		expect(validateCallGraph(unknownInvocation, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Call-site population contains an unknown invocation.',
					path: '$.nodes'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects layer node and edge manifests that no longer list the exact graph populations', () => {
		const semanticSnapshot = snapshot(fixtureFromSource('missingCall();'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		expect(graph.layers[0].nodeIds.length).toBeGreaterThan(1);
		expect(graph.layers[0].edgeIds.length).toBeGreaterThan(1);

		const droppedNode = {
			...graph,
			layers: [{ ...graph.layers[0], nodeIds: graph.layers[0].nodeIds.slice(1) }]
		} as CallGraphSnapshot;
		expect(validateCallGraph(droppedNode, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					message: 'Layer node manifest mismatch.',
					path: '$.layers[0].nodeIds'
				})
			]),
			state: 'INVALID'
		});

		const droppedEdge = {
			...graph,
			layers: [{ ...graph.layers[0], edgeIds: graph.layers[0].edgeIds.slice(1) }]
		} as CallGraphSnapshot;
		expect(validateCallGraph(droppedEdge, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					message: 'Layer edge manifest mismatch.',
					path: '$.layers[0].edgeIds'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects forward-index entries that reference an absent node or an absent edge', () => {
		const semanticSnapshot = snapshot(fixtureFromSource('missingCall();'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;

		const absentNode = {
			...graph,
			forwardIndex: graph.forwardIndex.map((entry, index) =>
				index === 0 ? { ...entry, nodeId: 'graph-node:absent' } : entry
			)
		} as CallGraphSnapshot;
		expect(validateCallGraph(absentNode, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Index references an absent node.',
					path: '$.forwardIndex[0].nodeId'
				})
			]),
			state: 'INVALID'
		});

		const navigable = graph.forwardIndex.findIndex((entry) => entry.edgeIds.length === 1);
		expect(navigable).toBeGreaterThanOrEqual(0);
		const absentEdge = {
			...graph,
			forwardIndex: graph.forwardIndex.map((entry, index) =>
				index === navigable ? { ...entry, edgeIds: ['graph-edge:absent'] } : entry
			)
		} as CallGraphSnapshot;
		expect(validateCallGraph(absentEdge, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Index references an absent edge.',
					path: `$.forwardIndex[${navigable}].edgeIds[0]`
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the duplicated canonical source-location object on node and edge arrays', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const nodeLocation = graph.nodes[0]!.sourceLocations[0]!;
		const edgeLocation = graph.edges[0]!.sourceLocations[0]!;
		const cases: readonly {
			readonly message: string;
			readonly mutate: (value: CallGraphSnapshot) => unknown;
			readonly path: string;
		}[] = [
			{
				message: `Duplicate identity ${canonicalSemanticJson(nodeLocation)}.`,
				mutate: (value) => ({
					...value,
					nodes: value.nodes.map((node, index) =>
						index === 0 ? { ...node, sourceLocations: [nodeLocation, nodeLocation] } : node
					)
				}),
				path: '$.nodes[0].sourceLocations'
			},
			{
				message: `Duplicate identity ${canonicalSemanticJson(edgeLocation)}.`,
				mutate: (value) => ({
					...value,
					edges: value.edges.map((edge, index) =>
						index === 0 ? { ...edge, sourceLocations: [edgeLocation, edgeLocation] } : edge
					)
				}),
				path: '$.edges[0].sourceLocations'
			}
		];

		for (const scenario of cases) {
			const result = validateCallGraph(scenario.mutate(graph), semanticSnapshot, {
				maxIssues: 200
			});
			expect(result.state, scenario.path).toBe('INVALID');
			expect(result.issues, scenario.path).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: 'DUPLICATE_ID',
						message: scenario.message,
						path: scenario.path
					})
				])
			);
		}
	});

	it('names every graph-wide reference a layer, node, or edge can misbind', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const cases: readonly {
			readonly message: string;
			readonly mutate: (value: CallGraphSnapshot) => unknown;
			readonly path: string;
		}[] = [
			{
				message: 'Record references another graph.',
				mutate: (value) => ({
					...value,
					layers: [{ ...value.layers[0], graphId: 'call-graph:other' }]
				}),
				path: '$.layers[0].graphId'
			},
			{
				message: 'Record references another graph layer.',
				mutate: (value) => ({
					...value,
					nodes: value.nodes.map((node, index) =>
						index === 0 ? { ...node, layerId: 'call-graph-layer:other' } : node
					)
				}),
				path: '$.nodes[0].layerId'
			},
			{
				message: 'Record references another semantic snapshot.',
				mutate: (value) => ({
					...value,
					edges: value.edges.map((edge, index) =>
						index === 0 ? { ...edge, semanticSnapshotId: 'semantic:snapshot-other' } : edge
					)
				}),
				path: '$.edges[0].semanticSnapshotId'
			},
			{
				message: 'Record references another subject.',
				mutate: (value) => ({
					...value,
					nodes: value.nodes.map((node, index) =>
						index === 0 ? { ...node, subjectId: 'subject:other' } : node
					)
				}),
				path: '$.nodes[0].subjectId'
			}
		];

		for (const scenario of cases) {
			const result = validateCallGraph(scenario.mutate(graph), semanticSnapshot, {
				maxIssues: 200
			});
			expect(result.state, scenario.message).toBe('INVALID');
			expect(result.issues, scenario.message).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: 'DANGLING_REFERENCE',
						message: scenario.message,
						path: scenario.path
					})
				])
			);
		}
	});

	it('names each way a source-region node can stop binding its semantic source', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const sourceRegionIndex = graph.nodes.findIndex((node) => node.kind === 'SOURCE_REGION');
		const sourceRegion = graph.nodes[sourceRegionIndex];
		if (sourceRegion?.kind !== 'SOURCE_REGION') throw new Error('Missing source-region node.');
		const sourceRegionLocation = sourceRegion.sourceLocations[0]!;
		const unrelatedProvenanceId = semanticSnapshot.provenances.find(
			(provenance) => !sourceRegion.provenanceIds.includes(provenance.id)
		)?.id;
		expect(unrelatedProvenanceId).toBeDefined();
		if (unrelatedProvenanceId === undefined) throw new Error('Missing unrelated valid provenance.');
		const nodePath = `$.nodes[${sourceRegionIndex}]`;
		const cases: readonly {
			readonly code: string;
			readonly message: string;
			readonly patch: Record<string, unknown>;
			readonly path: string;
		}[] = [
			{
				code: 'INVALID_VALUE',
				message: 'Source-region fields differ from the semantic source.',
				patch: { analysisDisposition: 'CONTEXT_ONLY' },
				path: nodePath
			},
			{
				code: 'IDENTITY_MISMATCH',
				message: 'Source-region identity mismatch.',
				patch: { id: `${sourceRegion.id}-other` },
				path: `${nodePath}.id`
			},
			{
				code: 'DANGLING_REFERENCE',
				message: 'Source-region provenance mismatch.',
				patch: { provenanceIds: [unrelatedProvenanceId] },
				path: `${nodePath}.provenanceIds`
			},
			{
				code: 'INVALID_VALUE',
				message: 'Source-region extent mismatch.',
				patch: {
					sourceLocations: [{ ...sourceRegionLocation, end: sourceRegionLocation.end - 1 }]
				},
				path: `${nodePath}.sourceLocations`
			},
			{
				code: 'ABSOLUTE_PATH',
				message: 'Source-region path is not canonical relative.',
				patch: { logicalPath: `/${sourceRegion.logicalPath}` },
				path: `${nodePath}.logicalPath`
			}
		];

		for (const scenario of cases) {
			const result = validateCallGraph(
				{
					...graph,
					nodes: graph.nodes.map((node, index) =>
						index === sourceRegionIndex ? { ...node, ...scenario.patch } : node
					)
				},
				semanticSnapshot,
				{ maxIssues: 200 }
			);
			expect(result.state, scenario.message).toBe('INVALID');
			expect(result.issues, scenario.message).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: scenario.code,
						message: scenario.message,
						path: scenario.path
					})
				])
			);
		}
	});

	it('names the callable-target population and topology expectations it is held to', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const callableIndex = graph.nodes.findIndex((node) => node.kind === 'CALLABLE_TARGET');
		const callable = graph.nodes[callableIndex];
		if (callable?.kind !== 'CALLABLE_TARGET') throw new Error('Missing callable-target node.');
		const nodePath = `$.nodes[${callableIndex}]`;
		const cases: readonly {
			readonly code: string;
			readonly message: string;
			readonly patch: Record<string, unknown>;
			readonly path: string;
		}[] = [
			{
				code: 'POPULATION_MISMATCH',
				message:
					'Callable target is outside the derivable deep-indexed runtime callable population.',
				patch: { semanticNodeId: 'semantic:node-other' },
				path: `${nodePath}.semanticNodeId`
			},
			{
				code: 'INVALID_VALUE',
				message:
					'Callable kind, body state, source, program, or project differs from semantic AST topology.',
				patch: {
					bodyState: callable.bodyState === 'BLOCK_BODY' ? 'EXPRESSION_BODY' : 'BLOCK_BODY'
				},
				path: nodePath
			}
		];

		for (const scenario of cases) {
			const result = validateCallGraph(
				{
					...graph,
					nodes: graph.nodes.map((node, index) =>
						index === callableIndex ? { ...node, ...scenario.patch } : node
					)
				},
				semanticSnapshot,
				{ maxIssues: 200 }
			);
			expect(result.state, scenario.message).toBe('INVALID');
			expect(result.issues, scenario.message).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: scenario.code,
						message: scenario.message,
						path: scenario.path
					})
				])
			);
		}
	});

	it('names the independently derived basis a candidate edge must reproduce', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const candidateEdge = graph.edges.find((edge) => edge.relationKind === 'CANDIDATE_CALL_TARGET');
		expect(candidateEdge).toBeDefined();
		if (candidateEdge?.relationKind !== 'CANDIDATE_CALL_TARGET')
			throw new Error('Missing candidate call-target edge.');
		const rationaleMutation = repairedGraph(graph, {
			edges: graph.edges.map((edge) =>
				edge.id === candidateEdge.id
					? {
							...candidateEdge,
							inferenceBasis: {
								...candidateEdge.inferenceBasis,
								rationale: 'A rationale the producer never derived.'
							}
						}
					: edge
			)
		});
		expectIndependentIssue(
			rationaleMutation,
			semanticSnapshot,
			'Candidate inference basis does not exactly match independently derived invocation, reference, symbol, assignment, declaration, limitation, method, and rationale evidence.'
		);
	});

	it('names the candidate evidence a candidate edge epistemic state must match', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const candidateEdge = graph.edges.find((edge) => edge.relationKind === 'CANDIDATE_CALL_TARGET');
		expect(candidateEdge).toBeDefined();
		if (candidateEdge?.relationKind !== 'CANDIDATE_CALL_TARGET')
			throw new Error('Missing candidate call-target edge.');
		const epistemicMutation = repairedGraph(graph, {
			edges: graph.edges.map((edge) =>
				edge.id === candidateEdge.id
					? { ...candidateEdge, epistemic: { ...candidateEdge.epistemic, inferenceState: 'NONE' } }
					: edge
			)
		});
		expectIndependentIssue(
			epistemicMutation,
			semanticSnapshot,
			'Candidate-edge epistemic dimensions do not match independently derived candidate evidence.'
		);
	});

	it('names the resolution class a frontier edge epistemic state must match', () => {
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const frontierEdge = graph.edges.find((edge) => edge.relationKind === 'UNRESOLVED_CALL_TARGET');
		expect(frontierEdge).toBeDefined();
		if (frontierEdge?.relationKind !== 'UNRESOLVED_CALL_TARGET')
			throw new Error('Missing unresolved call-target edge.');
		const epistemicMutation = repairedGraph(graph, {
			edges: graph.edges.map((edge) =>
				edge.id === frontierEdge.id
					? { ...frontierEdge, epistemic: { ...frontierEdge.epistemic, inferenceState: 'NONE' } }
					: edge
			)
		});
		expectIndependentIssue(
			epistemicMutation,
			semanticSnapshot,
			'Frontier-edge epistemic dimensions do not match its resolution class.'
		);
	});

	// A no-op probe turned validateLimitationRecord into `return;` and every csaa test stayed green.
	// Its four refusals reuse DANGLING_REFERENCE and LIMITATION_MISMATCH, which many other emitters
	// in this validator also raise, so matching on the code alone proves nothing: one mutated
	// limitation is dedicated to each branch and every message is named.
	it('rejects limitation records that stop degrading closure or stop citing their own invocation and source', () => {
		type LimitationRecord = CallGraphSnapshot['limitations'][number];
		const semanticSnapshot = snapshot(fixture('CALLS'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const bound = graph.limitations.filter(
			(limitation) => limitation.invocationId !== null && limitation.sourceId !== null
		);
		expect(bound.length).toBeGreaterThanOrEqual(4);
		const [degrades, absentInvocation, absentSource, mismatchedSource] = bound;
		if (mismatchedSource === undefined) throw new Error('Missing invocation-bound limitations.');
		// A real source that is not the one the bound invocation lives in, so `Absent limitation
		// source.` stays silent and only the invocation/source disagreement is refused.
		const otherSource = semanticSnapshot.sources.find(
			(source) => source.id !== mismatchedSource.sourceId
		);
		expect(otherSource).toBeDefined();
		if (otherSource === undefined) throw new Error('Missing a second semantic source.');
		const limitations: LimitationRecord[] = graph.limitations.map((limitation) =>
			limitation === degrades
				? { ...limitation, closureEffect: 'NONE' as const }
				: limitation === absentInvocation
					? {
							...limitation,
							invocationId:
								`semantic:invocation-${'0'.repeat(64)}` as LimitationRecord['invocationId']
						}
					: limitation === absentSource
						? {
								...limitation,
								sourceId: `semantic:source-${'0'.repeat(64)}` as LimitationRecord['sourceId']
							}
						: limitation === mismatchedSource
							? { ...limitation, sourceId: otherSource.id }
							: limitation
		);
		const draft = {
			...graph,
			layers: [{ ...graph.layers[0], limitations }],
			limitations
		} as CallGraphSnapshot;
		const mutated = { ...draft, contentDigest: callGraphContentDigest(draft) };
		expect(validateCallGraph(mutated, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'LIMITATION_MISMATCH',
					message: 'Every limitation emitted by producer 0.1.0 degrades closure.'
				}),
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Absent limitation invocation.'
				}),
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Absent limitation source.'
				}),
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Limitation invocation and source differ.'
				})
			]),
			state: 'INVALID'
		});
	});

	// validateLimitations survived the same probe: its LIMITATION_MISMATCH is shared with the layer
	// parity check and with validateLimitationRecord, so the message is the only discriminator.
	it('rejects a limitation population that no longer reconciles with semantic health and every call-site class', () => {
		const semanticSnapshot = snapshot(fixture('ZERO'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		// Dropped from the layer as well, so the surviving refusal is the reconciliation itself and
		// not the layer-parity check that would otherwise mask it.
		const limitations = graph.limitations.slice(1);
		expect(limitations).toHaveLength(graph.limitations.length - 1);
		const draft = {
			...graph,
			layers: [{ ...graph.layers[0], limitations }],
			limitations
		} as CallGraphSnapshot;
		const mutated = { ...draft, contentDigest: callGraphContentDigest(draft) };
		expect(validateCallGraph(mutated, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'LIMITATION_MISMATCH',
					message:
						'Limitation categories do not exactly reconcile semantic health and every call-site class.'
				})
			]),
			state: 'INVALID'
		});
	});

	// validateLayerProvenance survived the same probe: POPULATION_MISMATCH is raised by the layer
	// node, edge, coverage and index checks too, so the message is named here.
	it('rejects a layer provenance manifest that is not exactly the node and edge provenance union', () => {
		const semanticSnapshot = snapshot(fixture('ZERO'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		const layer = graph.layers[0];
		if (layer === undefined) throw new Error('Missing the static-call layer.');
		// A real provenance of the bound snapshot, so the dangling-reference checks stay silent and
		// only the inflated manifest is refused.
		const unrelated = semanticSnapshot.provenances.find(
			(provenance) => !layer.provenanceIds.includes(provenance.id)
		);
		expect(unrelated).toBeDefined();
		if (unrelated === undefined) throw new Error('Missing an unrelated valid provenance.');
		const provenanceIds = [...layer.provenanceIds, unrelated.id].sort();
		const draft = { ...graph, layers: [{ ...layer, provenanceIds }] } as CallGraphSnapshot;
		const mutated = { ...draft, contentDigest: callGraphContentDigest(draft) };
		expect(validateCallGraph(mutated, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					message: 'Layer provenance manifest mismatch.'
				})
			]),
			state: 'INVALID'
		});
	});

	// validateDuplicateIdentities survived the same probe: the repeated node is already reported by
	// validateIdPopulation under the same DUPLICATE_ID code, but with the repeated identity itself as
	// the message, so only naming this message pins the population-size check.
	it('rejects call-graph populations that repeat a node identity', () => {
		const semanticSnapshot = snapshot(fixture('ZERO'));
		const outcome = buildCallGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		expect(graph.nodes).toHaveLength(1);
		const sourceRegion = graph.nodes[0];
		if (sourceRegion === undefined) throw new Error('Missing the projected source-region node.');
		// Repeated adjacently so the population stays in canonical order and the size check, not the
		// ordering check, is what refuses it.
		const draft = { ...graph, nodes: [sourceRegion, sourceRegion] } as CallGraphSnapshot;
		const mutated = { ...draft, contentDigest: callGraphContentDigest(draft) };
		expect(validateCallGraph(mutated, semanticSnapshot)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DUPLICATE_ID',
					message: 'Call-graph populations contain duplicate identities.'
				})
			]),
			state: 'INVALID'
		});
	});
});
