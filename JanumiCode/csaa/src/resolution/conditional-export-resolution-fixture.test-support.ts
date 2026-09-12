import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
	CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
	type ConditionalExportResolutionBudgets,
	type ConditionalExportResolutionBuildInputs,
	type ConditionalExportResolutionRequest
} from '../contracts/conditional-export-resolution.js';
import type { ProjectContextGraphSnapshot } from '../contracts/project-context-graph.js';
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
import { buildProjectContextGraph } from '../graph/build-project-context-graph.js';
import {
	projectContextGraphInputs,
	projectContextGraphRequest
} from '../graph/project-context-graph-fixture.test-support.js';
import { validateProjectContextGraph } from '../graph/validate-project-context-graph.js';
import { buildStaticSemanticSnapshot } from '../semantic/build-static-semantic-snapshot.js';
import { validateStaticSemanticSnapshot } from '../semantic/validate-snapshot.js';
import { resolveSubject } from '../subject/resolve-subject.js';

export const CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME = '@fixture/conditional-exports';
export const CONDITIONAL_EXPORT_FIXTURE_MANIFEST_PATH = 'packages/conditional-exports/package.json';
export const CONDITIONAL_EXPORT_FIXTURE_CONSUMER_SOURCE = 'packages/consumer/src/index.ts';

export function supportedConditionalExportManifest(
	conditionOrder: readonly ('default' | 'import' | 'source' | 'types')[] = [
		'source',
		'types',
		'import',
		'default'
	]
): string {
	const targets = {
		default: './dist/index.js',
		import: {
			browser: './dist/browser.js',
			default: './dist/index.js'
		},
		source: './src/index.ts',
		types: './dist/index.d.ts'
	} as const;
	const rootEntry = Object.fromEntries(
		conditionOrder.map((condition) => [condition, targets[condition]])
	);
	return `${JSON.stringify(
		{
			name: CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME,
			private: true,
			type: 'module',
			version: '0.0.0',
			exports: {
				'.': rootEntry,
				'./blocked': { source: null, default: './dist/blocked.js' },
				'./feature': {
					source: './src/feature.ts',
					types: './dist/feature.d.ts',
					import: './dist/feature.js',
					default: './dist/feature.js'
				},
				'./no-match': { browser: './dist/browser-only.js' }
			}
		},
		null,
		2
	)}\n`;
}

export function duplicateConditionalExportManifest(): string {
	return `{
  "name": "${CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME}",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "\\u0073ource": "./src/duplicate.ts",
      "default": "./dist/index.js"
    }
  }
}\n`;
}

export function unsupportedConditionalExportManifest(): string {
	return `{
  "name": "${CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME}",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "imports": { "#internal": "./src/index.ts" },
  "exports": {
    ".": ["./src/index.ts", "./dist/index.js"],
    "./feature": { "source": "./src/feature.ts" },
    "./pattern/*": "./dist/*.js"
  }
}\n`;
}

export function rootConditionSugarManifest(): string {
	return `{
  "name": "${CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME}",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "exports": {
    "source": "./src/index.ts",
    "default": "./dist/index.js"
  }
}\n`;
}

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function repository(packageManifest: string): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-conditional-export-'));
	json(root, 'package.json', {
		name: 'conditional-export-resolution-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	write(root, CONDITIONAL_EXPORT_FIXTURE_MANIFEST_PATH, packageManifest);
	json(root, 'packages/conditional-exports/tsconfig.json', {
		compilerOptions: {
			composite: true,
			module: 'ESNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts', 'src/feature.ts']
	});
	write(root, 'packages/conditional-exports/src/index.ts', "export const root = 'root';\n");
	write(root, 'packages/conditional-exports/src/feature.ts', "export const feature = 'feature';\n");
	write(
		root,
		'packages/conditional-exports/src/duplicate.ts',
		"export const duplicate = 'duplicate';\n"
	);
	write(
		root,
		'packages/conditional-exports/dist/index.d.ts',
		'export declare const root: string;\n'
	);
	write(root, 'packages/conditional-exports/dist/index.js', "export const root = 'root';\n");
	write(root, 'packages/conditional-exports/dist/browser.js', "export const root = 'browser';\n");
	write(
		root,
		'packages/conditional-exports/dist/blocked.js',
		"export const blocked = 'blocked';\n"
	);
	write(
		root,
		'packages/conditional-exports/dist/feature.d.ts',
		'export declare const feature: string;\n'
	);
	write(
		root,
		'packages/conditional-exports/dist/feature.js',
		"export const feature = 'feature';\n"
	);
	write(
		root,
		'packages/conditional-exports/dist/browser-only.js',
		"export const browserOnly = 'browser-only';\n"
	);
	json(root, 'packages/consumer/package.json', {
		name: '@fixture/consumer',
		private: true,
		type: 'module',
		version: '0.0.0'
	});
	json(root, 'packages/consumer/tsconfig.json', {
		compilerOptions: {
			composite: true,
			module: 'ESNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts']
	});
	write(root, CONDITIONAL_EXPORT_FIXTURE_CONSUMER_SOURCE, "export const consumer = 'consumer';\n");
	json(root, 'tsconfig.json', {
		files: [],
		include: [],
		references: [{ path: './packages/conditional-exports' }, { path: './packages/consumer' }]
	});
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function materializeTypeScriptOraclePackage(root: string, packageManifest: string): void {
	write(root, 'node_modules/@fixture/conditional-exports/package.json', packageManifest);
	write(
		root,
		'node_modules/@fixture/conditional-exports/src/index.ts',
		"export const root = 'root';\n"
	);
	write(
		root,
		'node_modules/@fixture/conditional-exports/dist/index.d.ts',
		'export declare const root: string;\n'
	);
	write(
		root,
		'node_modules/@fixture/conditional-exports/dist/index.js',
		"export const root = 'root';\n"
	);
	write(
		root,
		'node_modules/@fixture/conditional-exports/dist/browser.js',
		"export const root = 'browser';\n"
	);
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
		operationVersion: 'conditional-export-resolution-fixture/1.0.0',
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

export interface ConditionalExportResolutionFixture {
	readonly cleanup: () => void;
	readonly consumerProgramId: string;
	readonly consumerSourceId: string;
	readonly frozenSubject: FrozenSubject;
	readonly projectContextGraph: ProjectContextGraphSnapshot;
	readonly root: string;
	readonly semanticSnapshot: StaticSemanticSnapshot;
}

export function conditionalExportResolutionBudgets(
	overrides: Partial<ConditionalExportResolutionBudgets> = {}
): ConditionalExportResolutionBudgets {
	return {
		maxAstNodes: 100_000,
		maxBranches: 10_000,
		maxConditionChecks: 10_000,
		maxDiagnostics: 1_000,
		maxFrontiers: 10_000,
		maxInputRecords: 1_000_000,
		maxInputStringCharacters: 64 * 1024 * 1024,
		maxManifestBytes: 4 * 1024 * 1024,
		maxOutputRecords: 20_001,
		maxTraversalSteps: 1_000_000,
		...overrides
	};
}

export function conditionalExportResolutionRequest(
	fixture: ConditionalExportResolutionFixture,
	requestOverrides: Partial<
		Omit<ConditionalExportResolutionRequest, 'budgets' | 'consumer' | 'projectContextGraph'>
	> = {},
	budgetOverrides: Partial<ConditionalExportResolutionBudgets> = {}
): ConditionalExportResolutionRequest {
	const source = fixture.projectContextGraph.sources.find(
		(candidate) => candidate.semanticSourceId === fixture.consumerSourceId
	);
	const program = fixture.projectContextGraph.programs.find(
		(candidate) => candidate.semanticProgramId === fixture.consumerProgramId
	);
	if (source === undefined || program === undefined)
		throw new Error('The CAP-010 fixture does not contain the selected consumer context.');
	return {
		budgets: conditionalExportResolutionBudgets(budgetOverrides),
		conditions: ['source', 'types', 'browser'],
		consumer: {
			projectContextProgramId: program.id,
			projectContextSourceId: source.id,
			semanticProgramId: program.semanticProgramId,
			semanticSourceId: source.semanticSourceId
		},
		exportSubpath: '.',
		manifestPath: CONDITIONAL_EXPORT_FIXTURE_MANIFEST_PATH,
		moduleMode: 'IMPORT',
		operationVersion: CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
		packageName: CONDITIONAL_EXPORT_FIXTURE_PACKAGE_NAME,
		platform: 'NODE',
		projectContextGraph: {
			contentDigest: fixture.projectContextGraph.contentDigest,
			graphId: fixture.projectContextGraph.id,
			inputDigest: fixture.projectContextGraph.inputDigest
		},
		schemaVersion: CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION,
		selection: CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
		semanticSnapshotId: fixture.semanticSnapshot.id,
		subjectId: fixture.frozenSubject.descriptor.subjectId,
		...requestOverrides
	};
}

export function conditionalExportResolutionInputs(
	fixture: ConditionalExportResolutionFixture,
	requestOverrides: Partial<
		Omit<ConditionalExportResolutionRequest, 'budgets' | 'consumer' | 'projectContextGraph'>
	> = {},
	budgetOverrides: Partial<ConditionalExportResolutionBudgets> = {}
): ConditionalExportResolutionBuildInputs {
	return {
		frozenSubject: fixture.frozenSubject,
		projectContextGraph: fixture.projectContextGraph,
		request: conditionalExportResolutionRequest(fixture, requestOverrides, budgetOverrides),
		semanticSnapshot: fixture.semanticSnapshot
	};
}

export function createConditionalExportResolutionFixture(
	packageManifest = supportedConditionalExportManifest()
): ConditionalExportResolutionFixture {
	const root = repository(packageManifest);
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
		const frozenSubject = subjectOutcome.subject;
		const snapshot = semanticSnapshot(root, frozenSubject);
		const contextInputs = projectContextGraphInputs({ frozenSubject, semanticSnapshot: snapshot });
		const contextOutcome = buildProjectContextGraph(contextInputs);
		if (contextOutcome.outcome !== 'partial')
			throw new Error(
				`Project-context fixture construction failed: ${JSON.stringify(contextOutcome)}`
			);
		const contextValidation = validateProjectContextGraph(contextOutcome.graph, {
			...contextInputs,
			request: projectContextGraphRequest({ frozenSubject, semanticSnapshot: snapshot })
		});
		if (contextValidation.state !== 'VALID')
			throw new Error(
				`Project-context fixture validation failed: ${JSON.stringify(contextValidation)}`
			);
		const consumerSource = snapshot.sources.find(
			(source) => source.logicalPath === CONDITIONAL_EXPORT_FIXTURE_CONSUMER_SOURCE
		);
		if (consumerSource === undefined)
			throw new Error('The conditional-export fixture consumer source was not projected.');
		materializeTypeScriptOraclePackage(root, packageManifest);
		return {
			cleanup,
			consumerProgramId: consumerSource.programId,
			consumerSourceId: consumerSource.id,
			frozenSubject,
			projectContextGraph: contextOutcome.graph,
			root,
			semanticSnapshot: snapshot
		};
	} catch (error) {
		cleanup();
		throw error;
	}
}
