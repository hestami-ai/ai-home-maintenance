import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
	CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION,
	CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
	type ConditionalExportResolutionRequest,
	type ConditionalExportResolutionSnapshot
} from '../contracts/conditional-export-resolution.js';
import {
	MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
	MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_SELECTION,
	type ModuleResolutionTraceBudgets,
	type ModuleResolutionTraceBuildInputs,
	type ModuleResolutionTraceRequest
} from '../contracts/module-resolution-trace.js';
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
import { buildConditionalExportResolution } from './build-conditional-export-resolution.js';
import { conditionalExportResolutionBudgets } from './conditional-export-resolution-fixture.test-support.js';
import { validateConditionalExportResolution } from './validate-conditional-export-resolution.js';

export const MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME = '@fixture/module-target';
export const MODULE_RESOLUTION_FIXTURE_MANIFEST_PATH = 'packages/module-target/package.json';
export const MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH = 'packages/consumer/src/index.ts';
export const MODULE_RESOLUTION_FIXTURE_TARGET_PATH = 'packages/module-target/dist/index.d.ts';

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

export interface ModuleResolutionTraceFixtureOptions {
	readonly consumerCompilerOptions?: Readonly<Record<string, unknown>>;
	readonly consumerPackageType?: 'commonjs' | 'module';
	readonly consumerProjectReferences?: readonly string[];
	readonly consumerSourceEncoding?: 'UTF16BE' | 'UTF16LE' | 'UTF8';
	readonly targetDeclarationExtension?: 'd.cts' | 'd.mts' | 'd.ts';
}

function compilerTextBytes(text: string, encoding: 'UTF16BE' | 'UTF16LE' | 'UTF8'): Uint8Array {
	if (encoding === 'UTF8') return new TextEncoder().encode(text);
	const bytes = new Uint8Array(2 + text.length * 2);
	bytes[0] = encoding === 'UTF16LE' ? 0xff : 0xfe;
	bytes[1] = encoding === 'UTF16LE' ? 0xfe : 0xff;
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		bytes[2 + index * 2] = encoding === 'UTF16LE' ? code & 0xff : code >>> 8;
		bytes[3 + index * 2] = encoding === 'UTF16LE' ? code >>> 8 : code & 0xff;
	}
	return bytes;
}

function repository(options: ModuleResolutionTraceFixtureOptions): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-module-resolution-trace-'));
	const targetExtension = options.targetDeclarationExtension ?? 'd.ts';
	const targetPath = `packages/module-target/dist/index.${targetExtension}`;
	const importerPath = MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH;
	json(root, 'package.json', {
		name: 'module-resolution-trace-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, MODULE_RESOLUTION_FIXTURE_MANIFEST_PATH, {
		exports: {
			'.': {
				types: `./dist/index.${targetExtension}`,
				import: './dist/index.js',
				default: './dist/index.js'
			}
		},
		name: MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME,
		private: true,
		type: 'module',
		version: '0.0.0'
	});
	json(root, 'packages/module-target/tsconfig.json', {
		compilerOptions: {
			composite: true,
			declaration: true,
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			outDir: 'dist',
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts']
	});
	write(root, 'packages/module-target/src/index.ts', 'export const target = 7 as const;\n');
	write(root, targetPath, 'export declare const target: 7;\n');
	write(root, 'packages/module-target/dist/index.js', 'export const target = 7;\n');
	json(root, 'packages/consumer/package.json', {
		name: '@fixture/module-consumer',
		private: true,
		type: options.consumerPackageType ?? 'module',
		version: '0.0.0'
	});
	json(root, 'packages/consumer/tsconfig.json', {
		compilerOptions: {
			...options.consumerCompilerOptions,
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: [importerPath.slice('packages/consumer/'.length)],
		...(options.consumerProjectReferences === undefined
			? {}
			: {
					references: options.consumerProjectReferences.map((path) => ({ path }))
				})
	});
	const importerText = `import { target } from '${MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME}';\nexport const value = target;\n`;
	const importerAbsolute = join(root, ...importerPath.split('/'));
	mkdirSync(dirname(importerAbsolute), { recursive: true });
	writeFileSync(
		importerAbsolute,
		compilerTextBytes(importerText, options.consumerSourceEncoding ?? 'UTF8')
	);
	json(root, 'tsconfig.json', {
		files: [],
		include: [],
		references: [{ path: './packages/module-target' }, { path: './packages/consumer' }]
	});
	write(root, 'bun.lock', 'fixture lock\n');
	mkdirSync(join(root, 'node_modules/@fixture'), { recursive: true });
	symlinkSync(
		join(root, 'packages/module-target'),
		join(root, 'node_modules/@fixture/module-target'),
		process.platform === 'win32' ? 'junction' : 'dir'
	);
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
		operationVersion: 'module-resolution-trace-fixture/1.0.0',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: {
			kind: 'EXPLICIT_PROJECTS',
			projects: ['tsconfig.json']
		},
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
		maxPathCharacters: 4_096,
		maxProjects: 10,
		maxScopes: 100_000,
		maxSnapshotBytes: 64 * 1024 * 1024,
		maxSources: 10_000
	};
}

function buildSemanticSnapshot(root: string, frozenSubject: FrozenSubject): StaticSemanticSnapshot {
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

function buildContextGraph(
	frozenSubject: FrozenSubject,
	semanticSnapshot: StaticSemanticSnapshot
): ProjectContextGraphSnapshot {
	const inputs = projectContextGraphInputs({ frozenSubject, semanticSnapshot });
	const outcome = buildProjectContextGraph(inputs);
	if (outcome.outcome !== 'partial')
		throw new Error(`CAP-010 fixture construction failed: ${JSON.stringify(outcome)}`);
	const validation = validateProjectContextGraph(outcome.graph, {
		...inputs,
		request: projectContextGraphRequest({ frozenSubject, semanticSnapshot })
	});
	if (validation.state !== 'VALID')
		throw new Error(`CAP-010 fixture validation failed: ${JSON.stringify(validation)}`);
	return outcome.graph;
}

function conditionalExportRequest(
	frozenSubject: FrozenSubject,
	semanticSnapshot: StaticSemanticSnapshot,
	projectContextGraph: ProjectContextGraphSnapshot,
	semanticProgramId: StaticSemanticSnapshot['programs'][number]['id'],
	semanticSourceId: StaticSemanticSnapshot['sources'][number]['id']
): ConditionalExportResolutionRequest {
	const program = projectContextGraph.programs.find(
		(candidate) => candidate.semanticProgramId === semanticProgramId
	);
	const source = projectContextGraph.sources.find(
		(candidate) => candidate.semanticSourceId === semanticSourceId
	);
	if (program === undefined || source === undefined)
		throw new Error('CAP-010 lacks the selected module-resolution consumer.');
	return {
		budgets: conditionalExportResolutionBudgets(),
		conditions: ['types'],
		consumer: {
			projectContextProgramId: program.id,
			projectContextSourceId: source.id,
			semanticProgramId: program.semanticProgramId,
			semanticSourceId: source.semanticSourceId
		},
		exportSubpath: '.',
		manifestPath: MODULE_RESOLUTION_FIXTURE_MANIFEST_PATH,
		moduleMode: 'IMPORT',
		operationVersion: CONDITIONAL_EXPORT_RESOLUTION_OPERATION_VERSION,
		packageName: MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME,
		platform: 'NODE',
		projectContextGraph: {
			contentDigest: projectContextGraph.contentDigest,
			graphId: projectContextGraph.id,
			inputDigest: projectContextGraph.inputDigest
		},
		schemaVersion: CONDITIONAL_EXPORT_RESOLUTION_REQUEST_SCHEMA_VERSION,
		selection: CONDITIONAL_EXPORT_RESOLUTION_SELECTION,
		semanticSnapshotId: semanticSnapshot.id,
		subjectId: frozenSubject.descriptor.subjectId
	};
}

export interface ModuleResolutionTraceFixture {
	readonly cleanup: () => void;
	readonly conditionalExportRequest: ConditionalExportResolutionRequest;
	readonly conditionalExportResolution: ConditionalExportResolutionSnapshot;
	readonly frozenSubject: FrozenSubject;
	readonly importerModuleResolutionId: StaticSemanticSnapshot['moduleResolutions'][number]['id'];
	readonly importerProgramId: StaticSemanticSnapshot['programs'][number]['id'];
	readonly importerSourceId: StaticSemanticSnapshot['sources'][number]['id'];
	readonly importerSpecifierNodeId: StaticSemanticSnapshot['astNodes'][number]['id'];
	readonly importerPath: string;
	readonly projectContextGraph: ProjectContextGraphSnapshot;
	readonly root: string;
	readonly semanticSnapshot: StaticSemanticSnapshot;
	readonly targetPath: string;
}

export function moduleResolutionTraceBudgets(
	overrides: Partial<ModuleResolutionTraceBudgets> = {}
): ModuleResolutionTraceBudgets {
	return {
		maxAstNodes: 10_000,
		maxAttempts: 1_000,
		maxCandidates: 1_000,
		maxDiagnostics: 100,
		maxInputRecords: 1_000_000,
		maxInputStringCharacters: 64 * 1024 * 1024,
		maxOutputRecords: 2_001,
		maxReadBytes: 16 * 1024 * 1024,
		maxTraversalSteps: 100_000,
		...overrides
	};
}

export function moduleResolutionTraceRequest(
	fixture: ModuleResolutionTraceFixture,
	requestOverrides: Partial<
		Omit<
			ModuleResolutionTraceRequest,
			'budgets' | 'conditionalExportResolution' | 'importer' | 'projectContextGraph'
		>
	> = {},
	budgetOverrides: Partial<ModuleResolutionTraceBudgets> = {}
): ModuleResolutionTraceRequest {
	const contextSource = fixture.projectContextGraph.sources.find(
		(candidate) => candidate.semanticSourceId === fixture.importerSourceId
	);
	const contextProgram = fixture.projectContextGraph.programs.find(
		(candidate) => candidate.semanticProgramId === fixture.importerProgramId
	);
	if (contextSource === undefined || contextProgram === undefined)
		throw new Error('CAP-010 lacks the selected module-resolution importer.');
	return {
		budgets: moduleResolutionTraceBudgets(budgetOverrides),
		conditionalExportResolution: {
			contentDigest: fixture.conditionalExportResolution.contentDigest,
			id: fixture.conditionalExportResolution.id,
			inputDigest: fixture.conditionalExportResolution.inputDigest
		},
		importer: {
			projectContextProgramId: contextProgram.id,
			projectContextSourceId: contextSource.id,
			semanticModuleResolutionId: fixture.importerModuleResolutionId,
			semanticProgramId: fixture.importerProgramId,
			semanticSourceId: fixture.importerSourceId,
			specifierNodeId: fixture.importerSpecifierNodeId
		},
		operationVersion: MODULE_RESOLUTION_TRACE_OPERATION_VERSION,
		packageName: MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME,
		projectContextGraph: {
			contentDigest: fixture.projectContextGraph.contentDigest,
			graphId: fixture.projectContextGraph.id,
			inputDigest: fixture.projectContextGraph.inputDigest
		},
		schemaVersion: MODULE_RESOLUTION_TRACE_REQUEST_SCHEMA_VERSION,
		selection: MODULE_RESOLUTION_TRACE_SELECTION,
		semanticSnapshotId: fixture.semanticSnapshot.id,
		specifier: MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME,
		subjectId: fixture.frozenSubject.descriptor.subjectId,
		...requestOverrides
	};
}

export function moduleResolutionTraceInputs(
	fixture: ModuleResolutionTraceFixture,
	requestOverrides: Parameters<typeof moduleResolutionTraceRequest>[1] = {},
	budgetOverrides: Partial<ModuleResolutionTraceBudgets> = {}
): ModuleResolutionTraceBuildInputs {
	return {
		conditionalExportRequest: fixture.conditionalExportRequest,
		conditionalExportResolution: fixture.conditionalExportResolution,
		frozenSubject: fixture.frozenSubject,
		projectContextGraph: fixture.projectContextGraph,
		request: moduleResolutionTraceRequest(fixture, requestOverrides, budgetOverrides),
		semanticSnapshot: fixture.semanticSnapshot
	};
}

export function createModuleResolutionTraceFixture(
	options: ModuleResolutionTraceFixtureOptions = {}
): ModuleResolutionTraceFixture {
	const root = repository(options);
	const importerPath = MODULE_RESOLUTION_FIXTURE_IMPORTER_PATH;
	const targetPath = `packages/module-target/dist/index.${
		options.targetDeclarationExtension ?? 'd.ts'
	}`;
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
		const semanticSnapshot = buildSemanticSnapshot(root, frozenSubject);
		const importerSource = semanticSnapshot.sources.find(
			(source) => source.logicalPath === importerPath
		);
		if (importerSource === undefined)
			throw new Error('Semantic fixture lacks the selected importer source.');
		const moduleResolution = semanticSnapshot.moduleResolutions.find(
			(resolution) =>
				resolution.sourceId === importerSource.id &&
				resolution.occurrenceKind === 'IMPORT' &&
				resolution.specifier === MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME
		);
		if (moduleResolution === undefined)
			throw new Error('Semantic fixture lacks the selected exact module resolution.');
		const projectContextGraph = buildContextGraph(frozenSubject, semanticSnapshot);
		const exportRequest = conditionalExportRequest(
			frozenSubject,
			semanticSnapshot,
			projectContextGraph,
			importerSource.programId,
			importerSource.id
		);
		const exportInputs = {
			frozenSubject,
			projectContextGraph,
			request: exportRequest,
			semanticSnapshot
		};
		const exportOutcome = buildConditionalExportResolution(exportInputs);
		if (exportOutcome.outcome !== 'partial')
			throw new Error(`CAP-012 fixture construction failed: ${JSON.stringify(exportOutcome)}`);
		const exportValidation = validateConditionalExportResolution(
			exportOutcome.resolution,
			exportInputs
		);
		if (exportValidation.state !== 'VALID')
			throw new Error(`CAP-012 fixture validation failed: ${JSON.stringify(exportValidation)}`);
		return {
			cleanup,
			conditionalExportRequest: exportRequest,
			conditionalExportResolution: exportOutcome.resolution,
			frozenSubject,
			importerModuleResolutionId: moduleResolution.id,
			importerProgramId: importerSource.programId,
			importerPath,
			importerSourceId: importerSource.id,
			importerSpecifierNodeId: moduleResolution.nodeId,
			projectContextGraph,
			root,
			semanticSnapshot,
			targetPath
		};
	} catch (error) {
		cleanup();
		throw error;
	}
}
