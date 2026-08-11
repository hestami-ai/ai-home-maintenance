import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type BuildModuleDependencyGraphRequest
} from '../contracts/graph.js';
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
import { buildModuleDependencyGraph } from './build-module-dependency-graph.js';

const temporaryRoots: string[] = [];

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(kind: 'COMPLETE' | 'MIXED'): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-module-graph-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'module-graph-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/module-graph',
		private: true,
		version: '0.0.0'
	});
	const files =
		kind === 'COMPLETE'
			? ['src/index.ts', 'src/local.ts']
			: ['src/ambient.d.ts', 'src/index.ts', 'src/local.ts', 'src/runtime.ts', 'src/types.ts'];
	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files
	});
	write(root, 'packages/demo/src/local.ts', 'export const local = 1;\n');
	if (kind === 'COMPLETE') {
		write(
			root,
			'packages/demo/src/index.ts',
			"import { local } from './local.js';\nexport const result = local;\n"
		);
	} else {
		write(
			root,
			'packages/demo/src/index.ts',
			[
				"import { ambient } from 'ambient-pkg';",
				"import { local } from './local.js';",
				"import localAlias = require('./local.js');",
				"import { missing } from './missing.js';",
				"export { local as again } from './local.js';",
				"export type Imported = import('./types.js').Thing;",
				"void import('./runtime.js');",
				"const runtimeName = './runtime.js';",
				'void import(runtimeName);',
				'export const result = ambient + local + localAlias.local + missing;',
				''
			].join('\n')
		);
		write(
			root,
			'packages/demo/src/ambient.d.ts',
			"declare module 'ambient-pkg' { export const ambient: number; }\n"
		);
		write(root, 'packages/demo/src/runtime.ts', 'export const runtime = true;\n');
		write(root, 'packages/demo/src/types.ts', 'export interface Thing { value: string }\n');
	}
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
		operationVersion: 'module-graph-test/1',
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
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
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

function graphRequest(snapshot: StaticSemanticSnapshot): BuildModuleDependencyGraphRequest {
	return {
		operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
		schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	};
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('buildModuleDependencyGraph', () => {
	it('projects every compiler module occurrence with explicit non-source targets and indexes', () => {
		const semanticSnapshot = snapshot(fixture('MIXED'));
		const outcome = buildModuleDependencyGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		expect(outcome.outcome).toBe('partial');
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		const graph = outcome.graph;
		expect(graph.coverage).toMatchObject({
			closure: 'OPEN',
			expectedModuleResolutions: semanticSnapshot.moduleResolutions.length,
			expectedSources: semanticSnapshot.sources.length,
			reconciles: true,
			representedModuleResolutions: semanticSnapshot.moduleResolutions.length,
			representedSources: semanticSnapshot.sources.length
		});
		expect(new Set(graph.edges.map((edge) => edge.relationKind))).toEqual(
			new Set([
				'DYNAMIC_IMPORT_OCCURRENCE',
				'EXPORT_OCCURRENCE',
				'IMPORT_EQUALS_OCCURRENCE',
				'IMPORT_OCCURRENCE',
				'IMPORT_TYPE_OCCURRENCE'
			])
		);
		const resolutionById = new Map(
			semanticSnapshot.moduleResolutions.map((record) => [record.id, record])
		);
		const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
		for (const edge of graph.edges) {
			const resolution = resolutionById.get(edge.moduleResolutionId)!;
			expect(edge.resolutionState).toBe(resolution.resolutionState);
			expect(nodeById.get(edge.source.nodeId)?.kind).toBe('SOURCE');
			expect(nodeById.get(edge.target.nodeId)?.kind).toBe(
				resolution.resolutionState === 'RESOLVED_SOURCE' ? 'SOURCE' : 'RESOLUTION_TARGET'
			);
		}
		expect(graph.forwardIndex).toHaveLength(graph.nodes.length);
		expect(graph.reverseIndex).toHaveLength(graph.nodes.length);
		expect(graph.limitations.filter((entry) => entry.kind === 'DEPCRUISE_NOT_RUN')).toHaveLength(1);
		expect(graph.nodes.filter((node) => node.kind === 'RESOLUTION_TARGET')).toHaveLength(
			graph.coverage.graphNativeTargets
		);

		const repeated = buildModuleDependencyGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		if (repeated.outcome === 'unavailable') throw new Error(JSON.stringify(repeated));
		expect(canonicalSemanticJson(repeated.graph)).toBe(canonicalSemanticJson(graph));
	});

	it('reports a closed compiler projection when every occurrence resolves to a source', () => {
		const semanticSnapshot = snapshot(fixture('COMPLETE'));
		const outcome = buildModuleDependencyGraph(graphRequest(semanticSnapshot), semanticSnapshot);
		expect(outcome.outcome).toBe('complete');
		if (outcome.outcome === 'unavailable') throw new Error(JSON.stringify(outcome));
		expect(outcome.graph).toMatchObject({
			coverage: { closure: 'CLOSED', graphNativeTargets: 0, reconciles: true },
			epistemic: 'SUPPORTED',
			health: 'COMPLETE'
		});
		expect(outcome.graph.limitations).toEqual([
			expect.objectContaining({ closureEffect: 'NONE', kind: 'DEPCRUISE_NOT_RUN' })
		]);
	});

	it('fails closed on request and consumed semantic-reference mismatches', () => {
		const semanticSnapshot = snapshot(fixture('COMPLETE'));
		expect(
			buildModuleDependencyGraph(
				{ ...graphRequest(semanticSnapshot), subjectId: 'wrong-subject' },
				semanticSnapshot
			)
		).toMatchObject({
			diagnostics: [{ code: 'SUBJECT_ID_MISMATCH' }],
			outcome: 'unavailable'
		});
		const firstResolution = semanticSnapshot.moduleResolutions[0]!;
		const mutated = {
			...semanticSnapshot,
			moduleResolutions: [
				{ ...firstResolution, targetSourceId: 'semantic:source-missing' },
				...semanticSnapshot.moduleResolutions.slice(1)
			]
		} as StaticSemanticSnapshot;
		expect(buildModuleDependencyGraph(graphRequest(semanticSnapshot), mutated)).toMatchObject({
			diagnostics: [{ code: 'DANGLING_SEMANTIC_REFERENCE' }],
			outcome: 'unavailable'
		});
	});
});
