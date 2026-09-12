import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
	PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
	PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_GRAPH_SELECTION,
	type ProjectContextGraphBuildInputs,
	type ProjectContextGraphBudgets,
	type ProjectContextGraphRequest
} from '../contracts/project-context-graph.js';
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

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function repository(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-project-context-'));
	json(root, 'package.json', {
		name: 'project-context-graph-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	for (const name of ['left', 'right'] as const) {
		const sourcePaths =
			name === 'left'
				? (['src/zeta.ts', 'src/alpha.ts', 'src/middle.ts'] as const)
				: (['src/index.ts'] as const);
		json(root, `packages/${name}/package.json`, {
			name: `@fixture/${name}`,
			private: true,
			type: 'module',
			version: '0.0.0'
		});
		json(root, `packages/${name}/tsconfig.json`, {
			compilerOptions: {
				composite: true,
				module: 'ESNext',
				noEmit: true,
				noLib: true,
				strict: true,
				target: 'ES2022'
			},
			files: sourcePaths
		});
		for (const [ordinal, sourcePath] of sourcePaths.entries())
			write(
				root,
				`packages/${name}/${sourcePath}`,
				`export const ${name}${ordinal} = '${name}-${ordinal}';\n`
			);
	}
	json(root, 'tsconfig.json', {
		files: [],
		include: [],
		references: [{ path: './packages/left' }, { path: './packages/right' }]
	});
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function subjectRequest(
	root: string,
	projects: readonly string[] = ['tsconfig.json']
): ResolveSubjectRequest {
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
		operationVersion: 'project-context-graph-fixture/1.0.0',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'EXPLICIT_PROJECTS', projects },
		subjectKind: 'WORKTREE'
	};
}

function semanticBudgets(): SemanticBudgets {
	return {
		maxAstDepth: 128,
		maxAstNodes: 100_000,
		maxCompilerFacts: 100_000,
		maxCompilerInputMetadataBytes: 8 * 1024 * 1024,
		maxCompilerQueries: 100_000,
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

function semanticSnapshot(root: string, frozenSubject: FrozenSubject): StaticSemanticSnapshot {
	const request: BuildStaticSemanticSnapshotRequest = {
		assignabilityRequests: [],
		budgets: semanticBudgets(),
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: root,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: frozenSubject.descriptor.subjectId
	};
	const outcome = buildStaticSemanticSnapshot(request, { subject: frozenSubject });
	if (outcome.outcome === 'unavailable' || outcome.outcome === 'incompatible')
		throw new Error(`Semantic fixture construction failed: ${JSON.stringify(outcome)}`);
	const validation = validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject });
	if (validation.state !== 'VALID')
		throw new Error(`Semantic fixture validation failed: ${JSON.stringify(validation)}`);
	return outcome.snapshot;
}

export interface ProjectContextGraphFixture {
	readonly cleanup: () => void;
	readonly frozenSubject: FrozenSubject;
	readonly root: string;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export function projectContextGraphBudgets(
	fixture: Pick<ProjectContextGraphFixture, 'frozenSubject' | 'semanticSnapshot'>,
	overrides: Partial<ProjectContextGraphBudgets> = {}
): ProjectContextGraphBudgets {
	const projects = fixture.semanticSnapshot.projects.length;
	const programs = fixture.semanticSnapshot.programs.length;
	const sources = fixture.semanticSnapshot.sources.length;
	const references = fixture.semanticSnapshot.projects.reduce(
		(total, project) => total + project.projectReferences.length,
		0
	);
	const configurationClosureRecords = fixture.frozenSubject.projects.reduce(
		(total, project) => total + project.configClosure.length,
		0
	);
	const memberships = programs + sources;
	return {
		maxConfigurationClosureRecords: configurationClosureRecords,
		maxDiagnostics: 1_000,
		maxInputRecords: 1_000_000,
		maxInputStringCharacters: 16 * 1024 * 1024,
		maxMemberships: memberships,
		maxOutputRecords: 1 + projects + programs + sources + memberships + references,
		maxPrograms: programs,
		maxProjectReferences: references,
		maxProjects: projects,
		maxSources: sources,
		maxTraversalSteps: projects + programs + sources + references + configurationClosureRecords,
		...overrides
	};
}

export function projectContextGraphRequest(
	fixture: Pick<ProjectContextGraphFixture, 'frozenSubject' | 'semanticSnapshot'>,
	overrides: Partial<ProjectContextGraphBudgets> = {}
): ProjectContextGraphRequest {
	return {
		budgets: projectContextGraphBudgets(fixture, overrides),
		operationVersion: PROJECT_CONTEXT_GRAPH_OPERATION_VERSION,
		schemaVersion: PROJECT_CONTEXT_GRAPH_REQUEST_SCHEMA_VERSION,
		selection: PROJECT_CONTEXT_GRAPH_SELECTION,
		semanticSnapshotId: fixture.semanticSnapshot.id,
		subjectId: fixture.frozenSubject.descriptor.subjectId
	};
}

export function projectContextGraphInputs(
	fixture: Pick<ProjectContextGraphFixture, 'frozenSubject' | 'semanticSnapshot'>,
	overrides: Partial<ProjectContextGraphBudgets> = {}
): ProjectContextGraphBuildInputs {
	return {
		frozenSubject: fixture.frozenSubject,
		request: projectContextGraphRequest(fixture, overrides),
		semanticSnapshot: fixture.semanticSnapshot
	};
}

function createFixture(projects?: readonly string[]): ProjectContextGraphFixture {
	const root = repository();
	let cleaned = false;
	const cleanup = (): void => {
		if (cleaned) return;
		cleaned = true;
		rmSync(root, { force: true, recursive: true });
	};
	try {
		const subjectOutcome = resolveSubject(subjectRequest(root, projects));
		if (subjectOutcome.outcome !== 'resolved')
			throw new Error(`Subject fixture construction failed: ${JSON.stringify(subjectOutcome)}`);
		const frozenSubject = subjectOutcome.subject;
		const snapshot = semanticSnapshot(root, frozenSubject);
		return { cleanup, frozenSubject, root, semanticSnapshot: snapshot };
	} catch (error) {
		cleanup();
		throw error;
	}
}

export function createProjectContextGraphFixture(): ProjectContextGraphFixture {
	return createFixture();
}

export function createProjectContextGraphFixtureWithoutProjectReferences(): ProjectContextGraphFixture {
	return createFixture(['packages/left/tsconfig.json', 'packages/right/tsconfig.json']);
}
