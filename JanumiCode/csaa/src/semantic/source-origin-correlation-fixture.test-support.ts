import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import ts from 'typescript';

import {
	SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION,
	SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION,
	SOURCE_ORIGIN_CORRELATION_SELECTION,
	type SourceOriginCorrelationBudgets,
	type SourceOriginCorrelationBuildInputs,
	type SourceOriginCorrelationRequest
} from '../contracts/source-origin-correlation.js';
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
import { resolveSubject } from '../subject/resolve-subject.js';
import { buildStaticSemanticSnapshot } from './build-static-semantic-snapshot.js';
import { validateStaticSemanticSnapshot } from './validate-snapshot.js';

export const SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH =
	'packages/origin/tsconfig.json' as const;
export const SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH =
	'packages/origin/src/index.ts' as const;
export const SOURCE_ORIGIN_CORRELATION_FIXTURE_TARGET_PATH =
	'packages/origin/dist/index.d.ts' as const;
export const SOURCE_ORIGIN_CORRELATION_FIXTURE_MAP_PATH =
	'packages/origin/dist/index.d.ts.map' as const;

const SOURCE_TEXT = `export const CAP014_FIXTURE_VALUE = 'fixture' as const;

export interface Cap014FixtureRecord {
	readonly value: string;
}

export type Cap014FixtureAlias = Cap014FixtureRecord;

export function readCap014Fixture(record: Cap014FixtureRecord): string {
	return record.value;
}
`;

interface IndependentDeclarationOutput {
	readonly bytes: Uint8Array;
	readonly logicalPath: string;
}

export interface SourceOriginCorrelationFixture {
	readonly cleanup: () => void;
	readonly declarationMapBytes: Uint8Array;
	readonly frozenSubject: FrozenSubject;
	readonly mapPath: typeof SOURCE_ORIGIN_CORRELATION_FIXTURE_MAP_PATH;
	readonly root: string;
	readonly semanticProgramId: StaticSemanticSnapshot['programs'][number]['id'];
	readonly semanticProjectId: StaticSemanticSnapshot['projects'][number]['id'];
	readonly semanticSnapshot: StaticSemanticSnapshot;
	readonly semanticSourceId: StaticSemanticSnapshot['sources'][number]['id'];
	readonly sourcePath: typeof SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH;
	readonly targetDeclarationBytes: Uint8Array;
	readonly targetPath: typeof SOURCE_ORIGIN_CORRELATION_FIXTURE_TARGET_PATH;
}

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function writeJson(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function repository(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-source-origin-correlation-'));
	writeJson(root, 'package.json', {
		name: 'source-origin-correlation-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	writeJson(root, 'packages/origin/package.json', {
		name: '@fixture/source-origin',
		private: true,
		type: 'module',
		version: '0.0.0'
	});
	writeJson(root, SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH, {
		compilerOptions: {
			declaration: true,
			declarationMap: true,
			emitDeclarationOnly: true,
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noLib: true,
			outDir: 'dist',
			rootDir: 'src',
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts']
	});
	write(root, SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH, SOURCE_TEXT);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function logicalPath(root: string, absolutePath: string): string {
	return relative(root, absolutePath).replaceAll('\\', '/');
}

function emitIndependentCaptures(root: string): {
	readonly declaration: IndependentDeclarationOutput;
	readonly map: IndependentDeclarationOutput;
} {
	const configPath = join(root, ...SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH.split('/'));
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	if (config.error !== undefined)
		throw new Error(`CAP-014 fixture config read failed: ${JSON.stringify(config.error)}`);
	const parsed = ts.parseJsonConfigFileContent(
		config.config,
		ts.sys,
		dirname(configPath),
		undefined,
		configPath
	);
	if (parsed.errors.length !== 0)
		throw new Error(`CAP-014 fixture config parse failed: ${JSON.stringify(parsed.errors)}`);
	const program = ts.createProgram({
		options: parsed.options,
		projectReferences: parsed.projectReferences,
		rootNames: parsed.fileNames
	});
	const sourcePath = join(root, ...SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH.split('/'));
	const source = program.getSourceFile(sourcePath);
	if (source === undefined)
		throw new Error('CAP-014 fixture Program lacks its exact authored source.');
	const outputs: IndependentDeclarationOutput[] = [];
	const result = program.emit(
		source,
		(fileName, data, writeByteOrderMark) => {
			if (writeByteOrderMark)
				throw new Error('CAP-014 fixture unexpectedly emitted a byte-order mark.');
			const bytes = new TextEncoder().encode(data);
			outputs.push({
				bytes,
				logicalPath: logicalPath(root, fileName)
			});
		},
		undefined,
		true
	);
	if (result.emitSkipped || result.diagnostics.length !== 0)
		throw new Error(
			`CAP-014 fixture declaration emit failed: ${JSON.stringify(result.diagnostics)}`
		);
	const declarations = outputs.filter(
		(output) => output.logicalPath === SOURCE_ORIGIN_CORRELATION_FIXTURE_TARGET_PATH
	);
	const maps = outputs.filter(
		(output) => output.logicalPath === SOURCE_ORIGIN_CORRELATION_FIXTURE_MAP_PATH
	);
	if (outputs.length !== 2 || declarations.length !== 1 || maps.length !== 1)
		throw new Error(`CAP-014 fixture emitted an unexpected population: ${JSON.stringify(outputs)}`);
	return { declaration: declarations[0]!, map: maps[0]! };
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
		operationVersion: 'source-origin-correlation-fixture/1.0.0',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: {
			kind: 'EXPLICIT_PROJECTS',
			projects: [SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH]
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
		throw new Error(`CAP-014 semantic fixture construction failed: ${JSON.stringify(outcome)}`);
	const validation = validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject });
	if (validation.state !== 'VALID')
		throw new Error(`CAP-014 semantic fixture validation failed: ${JSON.stringify(validation)}`);
	return outcome.snapshot;
}

export function sourceOriginCorrelationBudgets(
	overrides: Partial<SourceOriginCorrelationBudgets> = {}
): SourceOriginCorrelationBudgets {
	return {
		maxCallerCaptureBytes: 2 * 1024 * 1024,
		maxCompilerInputAttempts: 1_000_000,
		maxCorrelations: 100_000,
		maxDecodedMapLines: 100_000,
		maxDecodedMapSegments: 100_000,
		maxDiagnostics: 1_000,
		maxDurationMs: 60_000,
		maxEmitBytes: 2 * 1024 * 1024,
		maxEmitOutputs: 2,
		maxEmitStringCharacters: 2 * 1024 * 1024,
		maxInputRecords: 1_000_000,
		maxInputStringCharacters: 32 * 1024 * 1024,
		maxLocations: 200_000,
		maxMappingsCharacters: 2 * 1024 * 1024,
		maxOutputRecords: 500_000,
		maxPathCharacters: 4_096,
		maxProgramReadBytes: 32 * 1024 * 1024,
		maxProgramSourceFiles: 10_000,
		maxReadBytes: 64 * 1024 * 1024,
		maxSourceMapJsonDepth: 16,
		maxSourceMapJsonRecords: 1_000,
		maxSourceTextCodeUnits: 2 * 1024 * 1024,
		maxTraversalSteps: 10_000_000,
		maxUnmappedGeneratedLines: 10_000,
		...overrides
	};
}

export function sourceOriginCorrelationRequest(
	fixture: SourceOriginCorrelationFixture,
	requestOverrides: Partial<
		Omit<SourceOriginCorrelationRequest, 'budgets' | 'declarationMap' | 'targetDeclaration'>
	> = {},
	budgetOverrides: Partial<SourceOriginCorrelationBudgets> = {}
): SourceOriginCorrelationRequest {
	return {
		budgets: sourceOriginCorrelationBudgets(budgetOverrides),
		declarationMap: {
			contentBytes: fixture.declarationMapBytes.byteLength,
			contentSha256: sha256(fixture.declarationMapBytes),
			logicalPath: fixture.mapPath
		},
		operationVersion: SOURCE_ORIGIN_CORRELATION_OPERATION_VERSION,
		schemaVersion: SOURCE_ORIGIN_CORRELATION_REQUEST_SCHEMA_VERSION,
		selection: SOURCE_ORIGIN_CORRELATION_SELECTION,
		semanticProgramId: fixture.semanticProgramId,
		semanticProjectId: fixture.semanticProjectId,
		semanticSnapshotId: fixture.semanticSnapshot.id,
		semanticSourceId: fixture.semanticSourceId,
		subjectId: fixture.frozenSubject.descriptor.subjectId,
		targetDeclaration: {
			contentBytes: fixture.targetDeclarationBytes.byteLength,
			contentSha256: sha256(fixture.targetDeclarationBytes),
			logicalPath: fixture.targetPath
		},
		...requestOverrides
	};
}

export function sourceOriginCorrelationInputs(
	fixture: SourceOriginCorrelationFixture,
	requestOverrides: Parameters<typeof sourceOriginCorrelationRequest>[1] = {},
	budgetOverrides: Partial<SourceOriginCorrelationBudgets> = {}
): SourceOriginCorrelationBuildInputs {
	return {
		declarationMapBytes: fixture.declarationMapBytes,
		frozenSubject: fixture.frozenSubject,
		request: sourceOriginCorrelationRequest(fixture, requestOverrides, budgetOverrides),
		semanticSnapshot: fixture.semanticSnapshot,
		targetDeclarationBytes: fixture.targetDeclarationBytes
	};
}

export function createSourceOriginCorrelationFixture(): SourceOriginCorrelationFixture {
	const root = repository();
	let cleaned = false;
	const cleanup = (): void => {
		if (cleaned) return;
		cleaned = true;
		rmSync(root, { force: true, recursive: true });
	};
	try {
		const captures = emitIndependentCaptures(root);
		const subjectOutcome = resolveSubject(subjectRequest(root));
		if (subjectOutcome.outcome !== 'resolved')
			throw new Error(
				`CAP-014 subject fixture construction failed: ${JSON.stringify(subjectOutcome)}`
			);
		const frozenSubject = subjectOutcome.subject;
		if (
			frozenSubject.artifacts.some(
				(artifact) =>
					artifact.path === SOURCE_ORIGIN_CORRELATION_FIXTURE_TARGET_PATH ||
					artifact.path === SOURCE_ORIGIN_CORRELATION_FIXTURE_MAP_PATH
			)
		)
			throw new Error('CAP-014 caller captures must remain outside the FrozenSubject manifest.');
		const semanticSnapshot = buildSemanticSnapshot(root, frozenSubject);
		const project = semanticSnapshot.projects.find(
			(candidate) => candidate.configPath === SOURCE_ORIGIN_CORRELATION_FIXTURE_CONFIG_PATH
		);
		const source = semanticSnapshot.sources.find(
			(candidate) => candidate.logicalPath === SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH
		);
		if (project === undefined || source === undefined)
			throw new Error('CAP-014 semantic fixture lacks its exact root authored source.');
		if (
			source.projectId !== project.id ||
			source.programId !== project.programId ||
			!source.rootFile ||
			source.declarationFile ||
			source.origin !== 'AUTHORED'
		)
			throw new Error('CAP-014 semantic fixture lacks its exact root authored source.');
		return {
			cleanup,
			declarationMapBytes: captures.map.bytes,
			frozenSubject,
			mapPath: SOURCE_ORIGIN_CORRELATION_FIXTURE_MAP_PATH,
			root,
			semanticProgramId: project.programId,
			semanticProjectId: project.id,
			semanticSnapshot,
			semanticSourceId: source.id,
			sourcePath: SOURCE_ORIGIN_CORRELATION_FIXTURE_SOURCE_PATH,
			targetDeclarationBytes: captures.declaration.bytes,
			targetPath: SOURCE_ORIGIN_CORRELATION_FIXTURE_TARGET_PATH
		};
	} catch (error) {
		cleanup();
		throw error;
	}
}
