import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

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

export interface SemanticSnapshotComparisonFixture {
	readonly after: StaticSemanticSnapshot;
	readonly afterSubject: FrozenSubject;
	readonly before: StaticSemanticSnapshot;
	readonly beforeSubject: FrozenSubject;
	readonly cleanup: () => void;
}

const BEFORE_FILES = Object.freeze({
	'packages/demo/src/ambiguous-a.ts': 'export const ambiguous = 1;\n',
	'packages/demo/src/ambiguous-b.ts': 'export const ambiguous = 1;\n',
	'packages/demo/src/modified.ts': 'export const modified = 1;\n',
	'packages/demo/src/modified-reclassified.ts': 'export const modifiedReclassified = 1;\n',
	'packages/demo/src/move-and-rename-old.ts': 'export const combinedLineage = 1;\n',
	'packages/demo/src/old/moved.ts': 'export const moved = 1;\n',
	'packages/demo/src/reclassified.ts': 'const reclassified = 1;\n',
	'packages/demo/src/removed.ts': 'export const removed = 1;\n',
	'packages/demo/src/rename-old.ts': 'export const renamed = 1;\n',
	'packages/demo/src/unchanged.ts': 'export const unchanged = 1;\n'
});

const AFTER_FILES = Object.freeze({
	'packages/demo/src/added.ts': 'export const added = 1;\n',
	'packages/demo/src/ambiguous-c.ts': 'export const ambiguous = 1;\n',
	'packages/demo/src/ambiguous-d.ts': 'export const ambiguous = 1;\n',
	'packages/demo/src/modified.ts': 'export const modified = 2;\n',
	'packages/demo/src/modified-reclassified.ts': 'const modifiedReclassified = 2;\n',
	'packages/demo/src/new/moved.ts': 'export const moved = 1;\n',
	'packages/demo/src/other/move-and-rename-new.ts': 'export const combinedLineage = 1;\n',
	'packages/demo/src/reclassified.ts': 'const reclassified = 1;\n',
	'packages/demo/src/rename-new.ts': 'export const renamed = 1;\n',
	'packages/demo/src/unchanged.ts': 'export const unchanged = 1;\n'
});

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function repository(
	files: Readonly<Record<string, string>>,
	moduleDetection: 'auto' | 'force',
	packageType: 'commonjs' | 'module'
): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-snapshot-comparison-'));
	json(root, 'package.json', {
		name: 'snapshot-comparison-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/snapshot-comparison',
		private: true,
		type: packageType,
		version: '0.0.0'
	});
	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleDetection,
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: Object.keys(files)
			.map((path) => path.replace('packages/demo/', ''))
			.sort()
	});
	for (const [path, contents] of Object.entries(files)) write(root, path, contents);
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
		operationVersion: 'semantic-snapshot-comparison-fixture/1.0.0',
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
		maxAstNodes: 200_000,
		maxCompilerFacts: 200_000,
		maxCompilerInputMetadataBytes: 8 * 1024 * 1024,
		maxCompilerQueries: 200_000,
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
		maxScopes: 200_000,
		maxSnapshotBytes: 64 * 1024 * 1024,
		maxSources: 10_000
	};
}

function capture(root: string): {
	readonly snapshot: StaticSemanticSnapshot;
	readonly subject: FrozenSubject;
} {
	const subjectOutcome = resolveSubject(subjectRequest(root));
	if (subjectOutcome.outcome !== 'resolved') throw new Error(JSON.stringify(subjectOutcome));
	const subject = subjectOutcome.subject;
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
		throw new Error(JSON.stringify(outcome));
	const validation = validateStaticSemanticSnapshot(
		outcome.snapshot,
		{},
		{ frozenSubject: subject }
	);
	if (validation.state !== 'VALID') throw new Error(JSON.stringify(validation));
	return { snapshot: outcome.snapshot, subject };
}

export function createSemanticSnapshotComparisonFixture(): SemanticSnapshotComparisonFixture {
	const beforeRoot = repository(BEFORE_FILES, 'force', 'module');
	const afterRoot = repository(AFTER_FILES, 'auto', 'commonjs');
	try {
		const before = capture(beforeRoot);
		const after = capture(afterRoot);
		return {
			after: after.snapshot,
			afterSubject: after.subject,
			before: before.snapshot,
			beforeSubject: before.subject,
			cleanup: () => {
				rmSync(beforeRoot, { force: true, recursive: true });
				rmSync(afterRoot, { force: true, recursive: true });
			}
		};
	} catch (error) {
		rmSync(beforeRoot, { force: true, recursive: true });
		rmSync(afterRoot, { force: true, recursive: true });
		throw error;
	}
}
