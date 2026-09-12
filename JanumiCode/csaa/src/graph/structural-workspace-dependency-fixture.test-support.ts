import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
	DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
	DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_PROVIDER_ID,
	DEPENDENCY_CRUISER_PROVIDER_VERSION,
	DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
	type DependencyCruiserInvocationBinding,
	type DependencyCruiserObservation
} from '../contracts/dependency-cruiser.js';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type BuildModuleDependencyGraphRequest,
	type ModuleDependencyGraphNodeId,
	type ModuleDependencyGraphSnapshot
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
	type FrozenSubject,
	type ResolveSubjectRequest
} from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { normalizeDependencyCruiserOutput } from '../providers/dependency-cruiser/normalize-output.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import { buildModuleDependencyGraph } from './build-module-dependency-graph.js';

export interface StructuralWorkspaceDependencyFixture {
	readonly cleanup: () => void;
	readonly frozenSubject: FrozenSubject;
	readonly graph: ModuleDependencyGraphSnapshot;
	readonly root: string;
	readonly semanticSnapshot: StaticSemanticSnapshot;
	readonly sourceNodeId: (logicalPath: string) => ModuleDependencyGraphNodeId;
}

export interface StructuralWorkspaceObservationOptions {
	readonly configSha256?: string;
	readonly firstTargetPath?: string;
	readonly ignoredModuleField?: boolean;
	readonly inputPaths?: readonly string[];
	readonly startedAt?: string;
}

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function writeJson(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
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
		operationVersion: 'structural-workspace-dependency-fixture/1',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'EXPLICIT_PROJECTS', projects: ['tsconfig.json'] },
		subjectKind: 'WORKTREE'
	};
}

function semanticBudgets(): SemanticBudgets {
	return {
		maxAstDepth: 256,
		maxAstNodes: 100_000,
		maxCompilerFacts: 100_000,
		maxCompilerInputMetadataBytes: 16 * 1024 * 1024,
		maxCompilerQueries: 100_000,
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

export function createStructuralWorkspaceDependencyFixture(): StructuralWorkspaceDependencyFixture {
	const root = mkdtempSync(join(tmpdir(), 'csaa-structural-workspace-dependency-'));
	writeJson(root, 'package.json', {
		name: 'structural-workspace-dependency-fixture',
		private: true,
		workspaces: ['apps/*', 'packages/*']
	});
	for (const [path, name] of [
		['packages/a', '@fixture/a'],
		['packages/b', '@fixture/b'],
		['apps/demo', '@fixture/demo']
	] as const)
		writeJson(root, `${path}/package.json`, { name, private: true, version: '0.0.0' });
	writeJson(root, 'tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: [
			'packages/a/src/a.ts',
			'packages/b/src/b.ts',
			'apps/demo/src/main.ts'
		]
	});
	write(
		root,
		'packages/a/src/a.ts',
		"import type { B } from '../../b/src/b.js';\nexport interface A { readonly b?: B }\n"
	);
	write(
		root,
		'packages/b/src/b.ts',
		"import type { A } from '../../a/src/a.js';\nexport interface B { readonly a?: A }\n"
	);
	write(
		root,
		'apps/demo/src/main.ts',
		"import type { A } from '../../../packages/a/src/a.js';\nexport const marker: A | null = null;\n"
	);
	write(root, '.dependency-cruiser.cjs', 'fixture dependency-cruiser configuration\n');
	write(root, 'bun.lock', 'fixture lock\n');

	const subjectOutcome = resolveSubject(subjectRequest(root));
	if (subjectOutcome.outcome !== 'resolved') throw new Error(JSON.stringify(subjectOutcome));
	const frozenSubject = subjectOutcome.subject;
	const semanticRequest: BuildStaticSemanticSnapshotRequest = {
		assignabilityRequests: [],
		budgets: semanticBudgets(),
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: root,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: frozenSubject.descriptor.subjectId
	};
	const semanticOutcome = buildStaticSemanticSnapshot(semanticRequest, { subject: frozenSubject });
	if (semanticOutcome.outcome === 'unavailable' || semanticOutcome.outcome === 'incompatible')
		throw new Error(JSON.stringify(semanticOutcome));
	const semanticSnapshot = semanticOutcome.snapshot;
	const graphRequest: BuildModuleDependencyGraphRequest = {
		operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
		schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: semanticSnapshot.id,
		subjectId: semanticSnapshot.subjectId
	};
	const graphOutcome = buildModuleDependencyGraph(graphRequest, semanticSnapshot);
	if (graphOutcome.outcome === 'unavailable') throw new Error(JSON.stringify(graphOutcome));
	const graph = graphOutcome.graph;
	return {
		cleanup: () => rmSync(root, { force: true, recursive: true }),
		frozenSubject,
		graph,
		root,
		semanticSnapshot,
		sourceNodeId: (logicalPath: string) => {
			const matches = graph.nodes.filter(
				(node) => node.kind === 'SOURCE' && node.logicalPath === logicalPath
			);
			if (matches.length !== 1) throw new Error(`Expected one source node for ${logicalPath}.`);
			return matches[0]!.id;
		}
	};
}

function rawDependency(module: string, resolved: string): Record<string, unknown> {
	return {
		circular: false,
		coreModule: false,
		couldNotResolve: false,
		dependencyTypes: ['import', 'local', 'type-import', 'type-only'],
		dynamic: false,
		exoticallyRequired: false,
		followable: true,
		module,
		moduleSystem: 'es6',
		resolved,
		typeOnly: true,
		valid: true
	};
}

export function createStructuralWorkspaceDependencyObservation(
	fixture: StructuralWorkspaceDependencyFixture,
	options: StructuralWorkspaceObservationOptions = {}
): DependencyCruiserObservation {
	const modules: Record<string, unknown>[] = [
		{
			dependencies: [
				rawDependency('../../b/src/b.js', options.firstTargetPath ?? 'packages/b/src/b.ts')
			],
			source: 'packages/a/src/a.ts',
			valid: true
		},
		{
			dependencies: [rawDependency('../../a/src/a.js', 'packages/a/src/a.ts')],
			source: 'packages/b/src/b.ts',
			valid: true
		},
		{
			dependencies: [
				rawDependency('../../../packages/a/src/a.js', 'packages/a/src/a.ts')
			],
			source: 'apps/demo/src/main.ts',
			valid: true
		}
	];
	if (options.ignoredModuleField === true) modules[0]!.license = 'MIT';
	const raw = JSON.stringify({
		modules,
		summary: {
			error: 0,
			ignore: 0,
			info: 0,
			optionsUsed: { baseDir: '.' },
			totalCruised: modules.length,
			totalDependenciesCruised: 3,
			violations: [],
			warn: 0
		}
	});
	const inputPaths = options.inputPaths ?? ['apps', 'packages'];
	const startedAt = options.startedAt ?? '2026-08-25T12:00:00-04:00';
	const configArtifact = fixture.frozenSubject.artifacts.find(
		(artifact) => artifact.path === '.dependency-cruiser.cjs'
	);
	if (configArtifact === undefined) throw new Error('Missing fixture dependency-cruiser config.');
	const binding: DependencyCruiserInvocationBinding = {
		argvGrammarVersion: DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
		baseDir: '.',
		budgets: {
			maxCommandArgs: 100,
			maxDependencies: 100,
			maxDependents: 100,
			maxInputPaths: 100,
			maxIssues: 100,
			maxJsonDepth: 32,
			maxModules: 100,
			maxPathLength: 1_000,
			maxRawBytes: 1_000_000,
			maxRules: 100,
			maxStringLength: 10_000,
			maxSummaryViolations: 100,
			maxTotalStringCharacters: 1_000_000
		},
		command: {
			args: [...inputPaths, '--config', '.dependency-cruiser.cjs', '--output-type', 'json'],
			exitStatus: 0,
			finishedAt: startedAt.replace('00-04:00', '01-04:00'),
			startedAt
		},
		config: {
			path: '.dependency-cruiser.cjs',
			sha256: options.configSha256 ?? configArtifact.sha256
		},
		inputPaths,
		provider: { id: DEPENDENCY_CRUISER_PROVIDER_ID, version: DEPENDENCY_CRUISER_PROVIDER_VERSION },
		providerReportedBaseDir: {
			bytes: Buffer.byteLength('.', 'utf8'),
			representation: 'CANONICAL_RELATIVE',
			sha256: sha256('.'),
			state: 'PRESENT'
		},
		raw: { bytes: Buffer.byteLength(raw, 'utf8'), sha256: sha256(raw) },
		rawSchemaId: DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
		schemaVersion: DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
		subjectRoot: { bytes: Buffer.byteLength('.', 'utf8'), sha256: sha256('.') },
		subjectId: fixture.frozenSubject.descriptor.subjectId
	};
	const outcome = normalizeDependencyCruiserOutput(raw, binding);
	if (outcome.outcome !== 'complete') throw new Error(JSON.stringify(outcome));
	return outcome.observation;
}
