import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION,
	type BuildCallGraphRequest,
	type CallGraphSnapshot
} from '../contracts/call-graph.js';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	type BuildModuleDependencyGraphRequest,
	type ModuleDependencyGraphSnapshot
} from '../contracts/graph.js';
import {
	LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_SELECTION,
	type BuildLogicalGraphCompositionRequest,
	type LogicalGraphCompositionInputs
} from '../contracts/logical-graph-composition.js';
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
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import { validateStaticSemanticSnapshot } from '../semantic/validate-snapshot.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import { buildCallGraph } from './build-call-graph.js';
import { buildModuleDependencyGraph } from './build-module-dependency-graph.js';
import { validateCallGraph } from './validate-call-graph.js';
import { validateModuleDependencyGraph } from './validate-graph.js';

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function repository(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-logical-composition-'));
	json(root, 'package.json', {
		name: 'logical-graph-composition-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/logical-composition',
		private: true,
		type: 'module',
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
		files: ['src/library.ts', 'src/index.ts']
	});
	write(
		root,
		'packages/demo/src/library.ts',
		'export function increment(value: number): number { return value + 1; }\n'
	);
	write(
		root,
		'packages/demo/src/index.ts',
		"import { increment } from './library.js';\nexport const answer = increment(41);\n"
	);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function subjectRequest(root: string): ResolveSubjectRequest {
	return {
		budgets: {
			maxBytes: 16 * 1024 * 1024,
			maxConfigDepth: 32,
			maxDiagnostics: 1_000,
			maxDurationMs: 30_000,
			maxFiles: 10_000,
			maxProjects: 10
		},
		filters: { exclude: [], include: [] },
		operationVersion: 'logical-graph-composition-fixture/1.0.0',
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
		maxAstDepth: 128,
		maxAstNodes: 100_000,
		maxCompilerInputMetadataBytes: 8 * 1024 * 1024,
		maxCompilerQueries: 100_000,
		maxCompilerFacts: 100_000,
		maxCompilerQueryInvocations: 1_000_000,
		maxContextBytes: 16 * 1024 * 1024,
		maxContextFileBytes: 4 * 1024 * 1024,
		maxContextFiles: 10_000,
		maxDiagnosticCharacters: 1_000_000,
		maxDiagnostics: 10_000,
		maxDirectoryEntries: 100_000,
		maxDurationMs: 60_000,
		maxLiteralCharacters: 10_000,
		maxPathCharacters: 2_000,
		maxProjects: 10,
		maxScopes: 100_000,
		maxSnapshotBytes: 64 * 1024 * 1024,
		maxSources: 10_000
	};
}

function semanticSnapshot(root: string, subject: FrozenSubject): StaticSemanticSnapshot {
	const request: BuildStaticSemanticSnapshotRequest = {
		assignabilityRequests: [],
		budgets: semanticBudgets(),
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: root,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: subject.descriptor.subjectId
	};
	const outcome = buildStaticSemanticSnapshot(request, { subject });
	if (outcome.outcome === 'unavailable' || outcome.outcome === 'incompatible')
		throw new Error(`Semantic fixture construction failed: ${JSON.stringify(outcome)}`);
	const validation = validateStaticSemanticSnapshot(
		outcome.snapshot,
		{},
		{ frozenSubject: subject }
	);
	if (validation.state !== 'VALID')
		throw new Error(`Semantic fixture validation failed: ${JSON.stringify(validation)}`);
	return outcome.snapshot;
}

function moduleRequest(snapshot: StaticSemanticSnapshot): BuildModuleDependencyGraphRequest {
	return {
		operationVersion: MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
		schemaVersion: MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	};
}

function callRequest(snapshot: StaticSemanticSnapshot): BuildCallGraphRequest {
	return {
		operationVersion: CALL_GRAPH_OPERATION_VERSION,
		schemaVersion: CALL_GRAPH_REQUEST_SCHEMA_VERSION,
		semanticSnapshotId: snapshot.id,
		subjectId: snapshot.subjectId
	};
}

function sourceLayers(
	moduleGraph: ModuleDependencyGraphSnapshot,
	callGraph: CallGraphSnapshot
): BuildLogicalGraphCompositionRequest['sourceLayers'] {
	return [
		{
			canonicalProfile: moduleGraph.canonicalProfile,
			contentDigest: moduleGraph.contentDigest,
			graphId: moduleGraph.id,
			graphInputDigest: moduleGraph.graphInputDigest,
			graphKind: moduleGraph.graphKind,
			layerId: moduleGraph.layers[0].id,
			method: moduleGraph.method,
			operationVersion: moduleGraph.operationVersion,
			ordinal: 0,
			producer: moduleGraph.producer,
			role: 'MODULE_DEPENDENCY',
			schemaVersion: moduleGraph.schemaVersion,
			semanticExtractionVersion: moduleGraph.semanticExtractionVersion,
			semanticSchemaVersion: moduleGraph.semanticSchemaVersion,
			semanticSnapshotId: moduleGraph.semanticSnapshotId,
			subjectId: moduleGraph.subjectId
		},
		{
			canonicalProfile: callGraph.canonicalProfile,
			contentDigest: callGraph.contentDigest,
			graphId: callGraph.id,
			graphInputDigest: callGraph.graphInputDigest,
			graphKind: callGraph.graphKind,
			layerId: callGraph.layers[0].id,
			method: callGraph.method,
			operationVersion: callGraph.operationVersion,
			ordinal: 1,
			producer: callGraph.producer,
			role: 'CALL',
			schemaVersion: callGraph.schemaVersion,
			semanticExtractionVersion: callGraph.semanticExtractionVersion,
			semanticSchemaVersion: callGraph.semanticSchemaVersion,
			semanticSnapshotId: callGraph.semanticSnapshotId,
			subjectId: callGraph.subjectId
		}
	];
}

export interface LogicalGraphCompositionFixture {
	readonly callGraph: CallGraphSnapshot;
	readonly callRequest: BuildCallGraphRequest;
	readonly cleanup: () => void;
	readonly inputs: LogicalGraphCompositionInputs;
	readonly moduleDependencyGraph: ModuleDependencyGraphSnapshot;
	readonly moduleRequest: BuildModuleDependencyGraphRequest;
	readonly request: BuildLogicalGraphCompositionRequest;
	readonly root: string;
	readonly snapshot: StaticSemanticSnapshot;
	readonly subject: FrozenSubject;
}

/**
 * One exact compiler-backed subject and semantic snapshot feed both validated graph layers.
 * The composition treats that shared snapshot as the identity/source-coordinate context for two
 * independently validated graphs; it does not claim a third standalone semantic validation.
 */
export function createLogicalGraphCompositionFixture(): LogicalGraphCompositionFixture {
	const root = repository();
	let cleaned = false;
	const cleanup = (): void => {
		if (cleaned) return;
		cleaned = true;
		rmSync(root, { force: true, recursive: true });
	};
	try {
		const subjectOutcome = resolveSubject(subjectRequest(root));
		if (subjectOutcome.outcome !== 'resolved')
			throw new Error(`Subject fixture construction failed: ${JSON.stringify(subjectOutcome)}`);
		const subject = subjectOutcome.subject;
		const snapshot = semanticSnapshot(root, subject);
		const moduleGraphRequest = moduleRequest(snapshot);
		const moduleOutcome = buildModuleDependencyGraph(moduleGraphRequest, snapshot);
		if (moduleOutcome.outcome === 'unavailable')
			throw new Error(`Module graph fixture construction failed: ${JSON.stringify(moduleOutcome)}`);
		const moduleDependencyGraph = moduleOutcome.graph;
		const moduleValidation = validateModuleDependencyGraph(moduleDependencyGraph, snapshot);
		if (moduleValidation.state !== 'VALID')
			throw new Error(
				`Module graph fixture validation failed: ${JSON.stringify(moduleValidation)}`
			);
		const callGraphRequest = callRequest(snapshot);
		const callOutcome = buildCallGraph(callGraphRequest, snapshot);
		if (callOutcome.outcome === 'unavailable')
			throw new Error(`Call graph fixture construction failed: ${JSON.stringify(callOutcome)}`);
		const callGraph = callOutcome.graph;
		const callValidation = validateCallGraph(callGraph, snapshot);
		if (callValidation.state !== 'VALID')
			throw new Error(`Call graph fixture validation failed: ${JSON.stringify(callValidation)}`);
		const request: BuildLogicalGraphCompositionRequest = {
			budgets: {
				maxCallEdges: 10_000,
				maxCallNodes: 10_000,
				maxConflictRecords: 0,
				maxDiagnostics: 1_000,
				maxEligibleSourceNodes: 10_000,
				maxInputRecords: 100_000,
				maxInputStringCharacters: 100_000_000,
				maxLinks: 10_000,
				maxModuleDependencyEdges: 10_000,
				maxModuleDependencyNodes: 10_000,
				maxOutputRecords: 100_000,
				maxTraversalSteps: 100_000,
				maxUnmatchedRecords: 0
			},
			operationVersion: LOGICAL_GRAPH_COMPOSITION_OPERATION_VERSION,
			schemaVersion: LOGICAL_GRAPH_COMPOSITION_REQUEST_SCHEMA_VERSION,
			selection: LOGICAL_GRAPH_COMPOSITION_SELECTION,
			semanticSnapshotId: snapshot.id,
			sourceLayers: sourceLayers(moduleDependencyGraph, callGraph),
			subjectId: snapshot.subjectId
		};
		const inputs: LogicalGraphCompositionInputs = {
			callGraph,
			moduleDependencyGraph,
			request,
			semanticSnapshot: snapshot
		};
		return {
			callGraph,
			callRequest: callGraphRequest,
			cleanup,
			inputs,
			moduleDependencyGraph,
			moduleRequest: moduleGraphRequest,
			request,
			root,
			snapshot,
			subject
		};
	} catch (error) {
		cleanup();
		throw error;
	}
}
