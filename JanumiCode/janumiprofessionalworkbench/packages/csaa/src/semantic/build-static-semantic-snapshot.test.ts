import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type SemanticAssignabilityRelationRecord,
	type SemanticBudgets,
	type SemanticDiagnosticMessage,
	type SemanticFactProvenanceRecord,
	type StaticSemanticSnapshot
} from '../contracts/semantic.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject,
	type ProgramRecipe,
	type ResolveSubjectRequest
} from '../contracts/subject.js';
import { programRecipeDigest } from './ids.js';
import { canonicalSemanticJson } from './canonical.js';
import { semanticPopulation } from './population.js';
import { CompilerInputCaptureError } from '../providers/typescript/compiler-input-journal.js';
import * as staticRawExtraction from '../providers/typescript/extract-static-raw.js';
import { ProgramRecipeMaterializationError } from '../providers/typescript/materialize-program-recipe.js';
import {
	buildStaticSemanticSnapshot,
	collectStaticDiagnosticFamily,
	type BuildStaticSemanticSnapshotRuntimeOptions,
	type StaticSemanticSnapshotProgressEvent
} from './build-static-semantic-snapshot.js';
import { attachFrozenSubjectBytes, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import { validateStaticSemanticSnapshot } from './validate-snapshot.js';
import * as semanticNormalization from './normalize-semantic-snapshot.js';
import * as semanticValidation from './validate-snapshot.js';

const temporaryRoots: string[] = [];

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-semantic-builder-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'semantic-builder-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/demo',
		private: true,
		version: '0.0.0'
	});
	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			module: 'ESNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts']
	});
	write(
		root,
		'packages/demo/src/index.ts',
		[
			'/** A callable fixture. */',
			'export function twice(value: number): number { return value * 2; }',
			'export const answer = twice(21);',
			'let mutable = 1;',
			'mutable += answer;',
			'export const text = `answer:${answer}`;',
			''
		].join('\n')
	);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function jsonModuleFixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-semantic-json-module-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'semantic-json-module-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/json-module',
		private: true,
		version: '0.0.0'
	});
	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			allowSyntheticDefaultImports: true,
			module: 'ESNext',
			moduleResolution: 'Bundler',
			noEmit: true,
			noLib: true,
			resolveJsonModule: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts']
	});
	write(
		root,
		'packages/demo/src/index.ts',
		"import data from './data.json';\nexport const answer: number = data.answer;\n"
	);
	json(root, 'packages/demo/src/data.json', { answer: 42, label: 'frozen JSON module' });
	json(root, 'packages/demo/data/unimported.json', { ignored: true });
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function typeFixture(): { readonly root: string; readonly useText: string } {
	const root = mkdtempSync(join(tmpdir(), 'csaa-semantic-types-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'semantic-types-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/types',
		private: true,
		version: '0.0.0'
	});
	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			module: 'ESNext',
			moduleResolution: 'Bundler',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/model.ts', 'src/use.ts']
	});
	write(
		root,
		'packages/demo/src/model.ts',
		[
			'export interface Named { name: string }',
			'export interface Tagged { tag: string }',
			'export type Choice = Named | Tagged;',
			'export type Both = Named & Tagged;',
			'export type LiteralPath = "C:/literal/not-a-module";',
			'export interface Box<T extends Named> { value: T }',
			'export interface Pair<T extends Named, U extends Tagged> { left: T; right: U }',
			'export interface Callable {',
			'  (value: string): string;',
			'  (value: number): number;',
			'}',
			'export interface Constructable {',
			'  new (value: string): Named;',
			'  new (value: number): Tagged;',
			'}',
			'export function project(value: Named): string;',
			'export function project(value: Tagged): number;',
			'export function project(value: Named | Tagged): string | number {',
			"  return 'name' in value ? value.name : 1;",
			'}',
			''
		].join('\n')
	);
	const useText = [
		"import type { Both, Box, Named } from './model.js';",
		'export type Used = Box<Both>;',
		'export type Target = Named;',
		''
	].join('\n');
	write(root, 'packages/demo/src/use.ts', useText);
	write(root, 'bun.lock', 'fixture lock\n');
	return { root, useText };
}

function referencedFixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-semantic-references-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'semantic-reference-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/base/package.json', {
		name: '@fixture/base',
		private: true,
		version: '0.0.0'
	});
	json(root, 'packages/base/tsconfig.json', {
		compilerOptions: {
			composite: true,
			declaration: true,
			module: 'ESNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts']
	});
	write(root, 'packages/base/src/index.ts', 'export const base = 7 as const;\n');
	json(root, 'packages/app/package.json', {
		name: '@fixture/app',
		private: true,
		version: '0.0.0'
	});
	json(root, 'packages/app/tsconfig.json', {
		compilerOptions: {
			baseUrl: '.',
			module: 'ESNext',
			moduleResolution: 'Bundler',
			noEmit: true,
			noLib: true,
			paths: { '@fixture/base': ['../base/src/index.ts'] },
			strict: true,
			target: 'ES2022'
		},
		files: ['src/index.ts'],
		references: [{ path: '../base' }]
	});
	write(
		root,
		'packages/app/src/index.ts',
		"import { base } from '@fixture/base';\nexport { base };\nexport const result = base + 1;\n"
	);
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function subjectRequest(
	root: string,
	projects: readonly string[] = ['packages/demo/tsconfig.json']
): ResolveSubjectRequest {
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
		operationVersion: 'semantic-builder-test/1',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'EXPLICIT_PROJECTS', projects },
		subjectKind: 'WORKTREE'
	};
}

function resolved(root: string, projects?: readonly string[]) {
	const outcome = resolveSubject(subjectRequest(root, projects));
	if (outcome.outcome !== 'resolved') throw new Error(JSON.stringify(outcome));
	return outcome.subject;
}

function resolvedRepository(root: string) {
	const outcome = resolveSubject({ ...subjectRequest(root), scope: { kind: 'REPOSITORY' } });
	if (outcome.outcome !== 'resolved') throw new Error(JSON.stringify(outcome));
	return outcome.subject;
}

function semanticRequest(
	root: string,
	subjectId: string,
	budgetOverrides: Partial<SemanticBudgets> = {}
): BuildStaticSemanticSnapshotRequest {
	return {
		assignabilityRequests: [],
		budgets: {
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
			maxSnapshotBytes: 32 * 1024 * 1024,
			maxScopes: 100_000,
			maxSources: 10_000,
			...budgetOverrides
		},
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: root,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId
	};
}

function diagnosticMessageCharacters(message: SemanticDiagnosticMessage): number {
	return (
		message.textLength +
		message.next.reduce((total, next) => total + diagnosticMessageCharacters(next), 0)
	);
}

function diagnosticCharactersByProject(
	snapshot: StaticSemanticSnapshot
): ReadonlyMap<string, number> {
	const counts = new Map<string, number>();
	for (const diagnostic of snapshot.diagnostics) {
		const perOccurrence =
			diagnosticMessageCharacters(diagnostic.message) +
			diagnostic.related.reduce(
				(total, related) => total + diagnosticMessageCharacters(related.message),
				0
			);
		counts.set(
			diagnostic.projectId,
			(counts.get(diagnostic.projectId) ?? 0) + perOccurrence * diagnostic.multiplicity
		);
	}
	return counts;
}

function cloneSubjectCapability(
	subject: FrozenSubject,
	overrides: Partial<FrozenSubject> = {},
	omitBytes: readonly string[] = []
): FrozenSubject {
	const clone = { ...subject, ...overrides } as FrozenSubject;
	const omitted = new Set(omitBytes);
	attachFrozenSubjectBytes(
		clone,
		new Map(
			subject.artifacts.flatMap((artifact) => {
				if (omitted.has(artifact.path)) return [];
				const bytes = readFrozenSubjectArtifact(subject, artifact.path);
				return bytes === undefined ? [] : [[artifact.path, bytes] as const];
			})
		)
	);
	return clone;
}

function reviseRecipe(
	recipe: ProgramRecipe,
	overrides: Partial<Omit<ProgramRecipe, 'projectResolutionDigest'>>
): ProgramRecipe {
	const { projectResolutionDigest: _digest, ...base } = recipe;
	const revised = { ...base, ...overrides };
	return { ...revised, projectResolutionDigest: programRecipeDigest(revised) };
}

function withProjectRecipe(
	subject: FrozenSubject,
	revise: (recipe: ProgramRecipe) => ProgramRecipe
): FrozenSubject {
	return cloneSubjectCapability(subject, {
		projects: subject.projects.map((project, index) =>
			index === 0 ? { ...project, programRecipe: revise(project.programRecipe) } : project
		)
	});
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('buildStaticSemanticSnapshot', () => {
	it('represents an isolated compiler diagnostic-family failure as bounded coverage', () => {
		expect(
			collectStaticDiagnosticFamily(
				'SEMANTIC',
				() => [],
				() => undefined
			)
		).toEqual({
			diagnostics: [],
			family: 'SEMANTIC',
			reason: 'Family ran and returned zero diagnostics.',
			state: 'RUN'
		});
		expect(
			collectStaticDiagnosticFamily(
				'SEMANTIC',
				() => {
					throw new Error('provider failure');
				},
				() => undefined
			)
		).toEqual({
			diagnostics: [],
			family: 'SEMANTIC',
			reason: 'SEMANTIC diagnostic execution failed without usable results.',
			state: 'FAILED'
		});

		for (const failure of [
			new CompilerInputCaptureError('CONTEXT_CHANGED', 'capture changed'),
			new ProgramRecipeMaterializationError('INVALID_RECIPE', 'recipe changed')
		]) {
			expect(() =>
				collectStaticDiagnosticFamily(
					'SEMANTIC',
					() => {
						throw failure;
					},
					() => undefined
				)
			).toThrow(failure);
		}
	});

	it('constructs, rechecks, replays, validates, and freezes a deterministic real-Program snapshot', () => {
		const root = fixture();
		const subject = resolved(root);
		const request = semanticRequest(root, subject.descriptor.subjectId);
		const first = buildStaticSemanticSnapshot(request, { subject });
		expect(first.outcome, JSON.stringify(first)).toBe('complete');
		if (first.outcome !== 'complete') throw new Error(JSON.stringify(first));
		expect(validateStaticSemanticSnapshot(first.snapshot, {}, { frozenSubject: subject })).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(first.snapshot.projects).toHaveLength(1);
		expect(
			first.snapshot.sources.some((source) => source.analysisDisposition === 'DEEP_INDEXED')
		).toBe(true);
		expect(first.snapshot.astNodes.length).toBeGreaterThan(1);
		expect(first.snapshot.declarationCandidates.length).toBeGreaterThan(0);
		expect(first.snapshot.declarations.length).toBeGreaterThan(0);
		expect(first.snapshot.symbols.length).toBeGreaterThan(0);
		expect(first.snapshot.references.length).toBeGreaterThan(0);
		expect(first.snapshot.moduleExports.length).toBeGreaterThan(0);
		expect(first.snapshot.literals.length).toBeGreaterThan(0);
		expect(first.snapshot.invocations.length).toBeGreaterThan(0);
		expect(first.snapshot.assignments.length).toBeGreaterThan(0);
		expect(Object.isFrozen(first.snapshot)).toBe(true);
		expect(Object.isFrozen(first.snapshot.astNodes)).toBe(true);

		const second = buildStaticSemanticSnapshot(request, { subject });
		expect(second.outcome, JSON.stringify(second)).toBe('complete');
		if (second.outcome !== 'complete') throw new Error(JSON.stringify(second));
		expect(canonicalSemanticJson(second.snapshot)).toBe(canonicalSemanticJson(first.snapshot));
	});

	it('emits ordered phase and per-project progress without leaking absolute locators', () => {
		const root = referencedFixture();
		const subject = resolved(root, ['packages/app/tsconfig.json']);
		const request = semanticRequest(root, subject.descriptor.subjectId);
		const events: StaticSemanticSnapshotProgressEvent[] = [];
		const outcome = buildStaticSemanticSnapshot(
			request,
			{ subject },
			{
				onProgress: (event) => events.push(event)
			}
		);
		expect(['complete', 'partial']).toContain(outcome.outcome);

		const projectKeys = subject.projects
			.map((project) => project.configPath)
			.sort((left, right) => left.localeCompare(right));
		const paired = (phase: StaticSemanticSnapshotProgressEvent['phase']) => [
			[phase, 'STARTED'],
			[phase, 'COMPLETED']
		];
		expect(events.map((event) => [event.phase, event.state])).toEqual([
			...paired('REQUEST_BIND'),
			...paired('INITIAL_FRESHNESS'),
			...paired('RECIPE_MATERIALIZATION'),
			...paired('CAPTURE_PREPARATION'),
			...projectKeys.flatMap(() => paired('CAPTURE_PROJECT')),
			...paired('CAPTURE_FINALIZATION'),
			...paired('CAPTURE_RECHECK'),
			...paired('REPLAY_PREPARATION'),
			...projectKeys.flatMap(() => paired('REPLAY_PROJECT')),
			...paired('REPLAY_FINALIZATION'),
			...paired('PROJECTION_RECONCILIATION'),
			...paired('NORMALIZE'),
			...paired('FREEZE'),
			...paired('SERIALIZE'),
			...paired('VALIDATE'),
			...paired('FINAL_FRESHNESS'),
			...paired('FINALIZE')
		]);
		expect(
			events
				.filter((event) => event.phase === 'CAPTURE_PROJECT' && event.state === 'STARTED')
				.map((event) => event.project)
		).toEqual(
			projectKeys.map((projectKey, index) => ({
				index: index + 1,
				projectKey,
				total: projectKeys.length
			}))
		);
		expect(
			events
				.filter((event) => event.phase === 'REPLAY_PROJECT' && event.state === 'STARTED')
				.map((event) => event.project)
		).toEqual(
			projectKeys.map((projectKey, index) => ({
				index: index + 1,
				projectKey,
				total: projectKeys.length
			}))
		);

		for (const [index, event] of events.entries()) {
			expect(event.sequence).toBe(index + 1);
			expect(Number.isFinite(event.elapsedMs)).toBe(true);
			expect(event.elapsedMs).toBeGreaterThanOrEqual(
				index === 0 ? 0 : events[index - 1]!.elapsedMs
			);
			expect(Number.isFinite(event.durationMs)).toBe(true);
			expect(event.durationMs).toBeGreaterThanOrEqual(0);
			expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
			expect(Object.isFrozen(event)).toBe(true);
			expect(Object.isFrozen(event.counts)).toBe(true);
			for (const count of Object.values(event.counts)) {
				expect(Number.isSafeInteger(count)).toBe(true);
				expect(count).toBeGreaterThanOrEqual(0);
			}
			for (const bytes of Object.values(event.memoryUsage)) {
				expect(Number.isSafeInteger(bytes)).toBe(true);
				expect(bytes).toBeGreaterThanOrEqual(0);
			}
		}
		const final = events.at(-1)!;
		expect(final).toMatchObject({
			counts: {
				canonicalBytes: expect.any(Number),
				captureProjectsCompleted: projectKeys.length,
				materializedProjects: projectKeys.length,
				replayProjectsCompleted: projectKeys.length,
				semanticProjects: projectKeys.length,
				subjectProjects: projectKeys.length
			},
			phase: 'FINALIZE',
			state: 'COMPLETED'
		});
		expect(final.counts.canonicalBytes).toBeGreaterThan(0);
		expect(JSON.stringify(events)).not.toContain(root);
		expect(JSON.stringify(events)).not.toContain('export const result');
	});

	it('keeps output deterministic when the progress sink throws and inspects sink accessors inertly', () => {
		const root = fixture();
		const subject = resolved(root);
		const request = semanticRequest(root, subject.descriptor.subjectId);
		const baseline = buildStaticSemanticSnapshot(request, { subject });
		let throwingCalls = 0;
		const withThrowingSink = buildStaticSemanticSnapshot(
			request,
			{ subject },
			{
				onProgress() {
					throwingCalls += 1;
					throw new Error('telemetry sink failure');
				}
			}
		);
		expect(throwingCalls).toBeGreaterThan(0);
		expect(canonicalSemanticJson(withThrowingSink)).toBe(canonicalSemanticJson(baseline));

		let accessorCalls = 0;
		const accessorOptions = Object.create(null) as BuildStaticSemanticSnapshotRuntimeOptions;
		Object.defineProperty(accessorOptions, 'onProgress', {
			enumerable: true,
			get() {
				accessorCalls += 1;
				return () => undefined;
			}
		});
		const withAccessor = buildStaticSemanticSnapshot(request, { subject }, accessorOptions);
		expect(accessorCalls).toBe(0);
		expect(canonicalSemanticJson(withAccessor)).toBe(canonicalSemanticJson(baseline));

		const failureEvents: StaticSemanticSnapshotProgressEvent[] = [];
		const refused = buildStaticSemanticSnapshot(
			{ ...request, operationVersion: 'unsupported-operation' },
			{ subject },
			{ onProgress: (event) => failureEvents.push(event) }
		);
		expect(refused.outcome).toBe('incompatible');
		expect(failureEvents.map((event) => [event.phase, event.state, event.detailCode])).toEqual([
			['REQUEST_BIND', 'STARTED', null],
			['REQUEST_BIND', 'FAILED', 'COMPILER_VERSION_MISMATCH'],
			['FINALIZE', 'SKIPPED', 'BUILD_FAILED']
		]);
	});

	it('deep-indexes an imported frozen JSON module without promoting unimported JSON', () => {
		const root = jsonModuleFixture();
		const subject = resolvedRepository(root);
		const jsonPath = 'packages/demo/src/data.json';
		const outsidePath = 'packages/demo/data/unimported.json';
		const jsonArtifact = subject.artifacts.find((artifact) => artifact.path === jsonPath);
		const outsideArtifact = subject.artifacts.find((artifact) => artifact.path === outsidePath);

		expect(
			subject.artifacts.map((artifact) => artifact.path),
			JSON.stringify(subject.excludedArtifacts, null, 2)
		).toEqual(expect.arrayContaining([jsonPath, outsidePath]));
		expect(jsonArtifact).toMatchObject({
			disposition: 'ANALYZED',
			primaryClass: 'PRODUCTION_SOURCE',
			roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION']
		});
		expect(outsideArtifact).toMatchObject({
			disposition: 'INVENTORY_ONLY',
			primaryClass: 'OTHER',
			roles: []
		});
		if (jsonArtifact === undefined) throw new Error('Imported JSON artifact was not frozen.');

		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(outcome.outcome, JSON.stringify(outcome.diagnostics)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome.diagnostics));
		expect(
			validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject: subject })
		).toEqual({
			issues: [],
			state: 'VALID'
		});

		const jsonSource = outcome.snapshot.sources.find((source) => source.logicalPath === jsonPath);
		expect(jsonSource).toMatchObject({
			analysisDisposition: 'DEEP_INDEXED',
			artifactClass: jsonArtifact.primaryClass,
			artifactRoles: jsonArtifact.roles,
			bytes: jsonArtifact.bytes,
			contentSha256: jsonArtifact.sha256,
			declarationFile: false,
			languageVariant: 'Standard',
			logicalPath: jsonPath,
			origin: 'AUTHORED',
			rootFile: false,
			rootNodeId: expect.any(String),
			scriptKind: ts.ScriptKind.JSON,
			scriptKindName: 'JSON',
			syntaxProvenanceId: expect.any(String)
		});
		expect(outcome.snapshot.sources.some((source) => source.logicalPath === outsidePath)).toBe(
			false
		);

		expect(
			outcome.snapshot.compilerInputs.find(
				(input) =>
					input.operation === 'READ_FILE' &&
					input.result === 'PRESENT' &&
					input.logicalPath === jsonPath
			)
		).toMatchObject({
			byteBudgetClass: 'FROZEN_SUBJECT',
			contentBytes: jsonArtifact.bytes,
			contentSha256: jsonArtifact.sha256,
			logicalPath: jsonPath,
			operation: 'READ_FILE',
			origin: 'AUTHORED',
			result: 'PRESENT'
		});
	});

	it('builds deterministic checker-bound types, signatures, overloads, and requested assignability', () => {
		const { root, useText } = typeFixture();
		const subject = resolved(root);
		const bothStart = useText.indexOf('Both>');
		const namedStart = useText.lastIndexOf('Named;');
		expect(bothStart).toBeGreaterThanOrEqual(0);
		expect(namedStart).toBeGreaterThanOrEqual(0);
		const base = semanticRequest(root, subject.descriptor.subjectId);
		const request: BuildStaticSemanticSnapshotRequest = {
			...base,
			assignabilityRequests: [
				{
					requestId: 'both-to-named',
					requesterRef: 'test:both-to-named',
					source: {
						end: bothStart + 'Both'.length,
						logicalPath: 'packages/demo/src/use.ts',
						queryMode: 'TYPE_AT_LOCATION',
						start: bothStart,
						syntaxKind: ts.SyntaxKind.Identifier
					},
					target: {
						end: namedStart + 'Named'.length,
						logicalPath: 'packages/demo/src/use.ts',
						queryMode: 'TYPE_AT_LOCATION',
						start: namedStart,
						syntaxKind: ts.SyntaxKind.Identifier
					}
				}
			],
			capabilities: [...base.capabilities, 'TS_TYPE']
		};

		const first = buildStaticSemanticSnapshot(request, { subject });
		expect(first.outcome, JSON.stringify(first)).toBe('partial');
		if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));
		expect(validateStaticSemanticSnapshot(first.snapshot, {}, { frozenSubject: subject })).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(first.snapshot.types.length).toBeGreaterThan(0);
		expect(first.snapshot.typeParameters.length).toBeGreaterThan(0);
		const typeParameterOrdinalsByOwner = new Map<string, number[]>();
		for (const parameter of first.snapshot.typeParameters) {
			const owner = canonicalSemanticJson(parameter.owner);
			const ordinals = typeParameterOrdinalsByOwner.get(owner) ?? [];
			ordinals.push(parameter.ordinal);
			typeParameterOrdinalsByOwner.set(owner, ordinals);
		}
		expect(
			[...typeParameterOrdinalsByOwner.values()].some(
				(ordinals) =>
					canonicalSemanticJson(ordinals.sort((left, right) => left - right)) === '[0,1]'
			)
		).toBe(true);
		expect(first.snapshot.signatures.length).toBeGreaterThan(0);
		expect(first.snapshot.signatureParameters.length).toBeGreaterThan(0);
		expect(first.snapshot.overloadSets.length).toBeGreaterThan(0);
		expect(
			first.snapshot.capabilities.find((entry) => entry.capability === 'TS_TYPE')
		).toMatchObject({ state: 'SUPPORTED' });
		expect(
			first.snapshot.capabilities.find((entry) => entry.capability === 'TS_SYMBOL')
		).toMatchObject({ state: 'PARTIAL' });
		expect(
			first.snapshot.signatures.filter(
				(signature) =>
					signature.declarationRole === 'CALL_SIGNATURE' &&
					signature.semanticKind === 'OVERLOAD_SIGNATURE'
			)
		).toHaveLength(2);
		expect(
			first.snapshot.signatures.filter(
				(signature) =>
					signature.declarationRole === 'CONSTRUCT_SIGNATURE' &&
					signature.semanticKind === 'OVERLOAD_SIGNATURE'
			)
		).toHaveLength(2);
		const relationKinds = new Set(first.snapshot.typeRelations.map((relation) => relation.kind));
		expect(
			first.snapshot.typeRelations.filter(
				(relation) => relation.kind === 'OVERLOAD_MEMBERSHIP' && relation.role === 'CALL_SIGNATURE'
			)
		).toHaveLength(2);
		expect(
			first.snapshot.typeRelations.filter(
				(relation) =>
					relation.kind === 'OVERLOAD_MEMBERSHIP' && relation.role === 'CONSTRUCT_SIGNATURE'
			)
		).toHaveLength(2);
		for (const kind of [
			'UNION_CONSTITUENT',
			'INTERSECTION_CONSTITUENT',
			'GENERIC_INSTANTIATION',
			'PARAMETER_CONSTRAINT',
			'OVERLOAD_MEMBERSHIP',
			'ASSIGNABILITY'
		] as const)
			expect(relationKinds.has(kind), kind).toBe(true);
		expect(
			first.snapshot.typeRelations.find(
				(relation) => relation.kind === 'ASSIGNABILITY' && relation.requestId === 'both-to-named'
			)
		).toMatchObject({ result: true, state: 'CONFIRMED' });

		const second = buildStaticSemanticSnapshot(request, { subject });
		expect(second.outcome, JSON.stringify(second)).toBe('partial');
		if (second.outcome !== 'partial') throw new Error(JSON.stringify(second));
		expect(canonicalSemanticJson(second.snapshot)).toBe(canonicalSemanticJson(first.snapshot));
	});

	it('retains an explicit unresolved type-parameter constraint without claiming confirmation', () => {
		const root = fixture();
		write(root, 'packages/demo/src/index.ts', 'export type Recursive<T extends T> = T;\n');
		const subject = resolved(root);
		const base = semanticRequest(root, subject.descriptor.subjectId);
		const outcome = buildStaticSemanticSnapshot(
			{ ...base, capabilities: [...base.capabilities, 'TS_TYPE'] },
			{ subject }
		);
		expect(['complete', 'partial'], JSON.stringify(outcome)).toContain(outcome.outcome);
		if (outcome.outcome !== 'complete' && outcome.outcome !== 'partial')
			throw new Error(JSON.stringify(outcome));
		expect(
			validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject: subject })
		).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(
			outcome.snapshot.typeRelations.find(
				(relation) =>
					relation.kind === 'PARAMETER_CONSTRAINT' && relation.constraintState === 'UNRESOLVED'
			)
		).toMatchObject({
			constraintState: 'UNRESOLVED',
			constraintTypeId: null,
			state: 'UNRESOLVED'
		});
	});

	it('keeps TS_TYPE snapshot bytes and identities independent of the absolute repository root', () => {
		const firstFixture = typeFixture();
		const secondFixture = typeFixture();
		const firstSubject = resolved(firstFixture.root);
		const secondSubject = resolved(secondFixture.root);
		expect(secondSubject.descriptor.subjectId).toBe(firstSubject.descriptor.subjectId);
		const firstBase = semanticRequest(firstFixture.root, firstSubject.descriptor.subjectId);
		const secondBase = semanticRequest(secondFixture.root, secondSubject.descriptor.subjectId);
		const first = buildStaticSemanticSnapshot(
			{ ...firstBase, capabilities: [...firstBase.capabilities, 'TS_TYPE'] },
			{ subject: firstSubject }
		);
		const second = buildStaticSemanticSnapshot(
			{ ...secondBase, capabilities: [...secondBase.capabilities, 'TS_TYPE'] },
			{ subject: secondSubject }
		);
		expect(first.outcome, JSON.stringify(first)).toBe('partial');
		expect(second.outcome, JSON.stringify(second)).toBe('partial');
		if (first.outcome !== 'partial' || second.outcome !== 'partial')
			throw new Error(JSON.stringify({ first, second }));
		expect(second.snapshot.id).toBe(first.snapshot.id);
		expect(canonicalSemanticJson(second.snapshot)).toBe(canonicalSemanticJson(first.snapshot));
		const canonical = canonicalSemanticJson(first.snapshot);
		expect(canonical).not.toContain(firstFixture.root.replaceAll('\\', '/'));
		expect(canonical).not.toContain(secondFixture.root.replaceAll('\\', '/'));
		expect(canonical).toContain('C:/literal/not-a-module');
	});

	it('distinguishes instantiated generic signature views from source overload membership', () => {
		const root = fixture();
		write(
			root,
			'packages/demo/src/index.ts',
			[
				'export interface GenericCall<T> {',
				'  (value: T): T;',
				'  (value: T[]): T[];',
				'}',
				'export type StringCall = GenericCall<string>;',
				'export interface GenericConstruct<T> {',
				'  new (value: T): { value: T };',
				'  new (value: T[]): { value: T[] };',
				'}',
				'export type StringConstruct = GenericConstruct<string>;',
				''
			].join('\n')
		);
		const subject = resolved(root);
		const base = semanticRequest(root, subject.descriptor.subjectId);
		const outcome = buildStaticSemanticSnapshot(
			{ ...base, capabilities: [...base.capabilities, 'TS_TYPE'] },
			{ subject }
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(
			validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject: subject })
		).toEqual({ issues: [], state: 'VALID' });

		for (const role of ['CALL_SIGNATURE', 'CONSTRUCT_SIGNATURE'] as const) {
			const signatures = outcome.snapshot.signatures.filter(
				(signature) => signature.declarationRole === role
			);
			expect(signatures.length).toBeGreaterThanOrEqual(4);
			expect(new Set(signatures.map((signature) => signature.declarationId)).size).toBe(2);
			expect(new Set(signatures.map((signature) => signature.identityBasis))).toEqual(
				new Set(['DECLARATION_ANCHORED', 'OWNER_ORDINAL'])
			);
			const declared = signatures.filter(
				(signature) => signature.identityBasis === 'DECLARATION_ANCHORED'
			);
			const instantiated = signatures.filter(
				(signature) => signature.identityBasis === 'OWNER_ORDINAL'
			);
			expect(declared).toHaveLength(2);
			expect(declared.every((signature) => signature.semanticKind === 'OVERLOAD_SIGNATURE')).toBe(
				true
			);
			expect(instantiated.length).toBeGreaterThanOrEqual(2);
			expect(instantiated.every((signature) => signature.semanticKind === 'SIGNATURE')).toBe(true);
			const declaredIds = new Set(declared.map((signature) => signature.id));
			const memberships = outcome.snapshot.typeRelations.filter(
				(relation) => relation.kind === 'OVERLOAD_MEMBERSHIP' && relation.role === role
			);
			expect(memberships).toHaveLength(2);
			expect(
				memberships.every(
					(membership) =>
						membership.kind === 'OVERLOAD_MEMBERSHIP' && declaredIds.has(membership.signatureId)
				)
			).toBe(true);
		}
		expect(outcome.snapshot.overloadSets).toHaveLength(2);
	});

	it('keeps standard-library synthetic type parameters within the represented constraint surface', () => {
		const root = fixture();
		json(root, 'packages/demo/tsconfig.json', {
			compilerOptions: {
				lib: ['ES5'],
				module: 'ESNext',
				noEmit: true,
				strict: true,
				target: 'ES2022'
			},
			files: ['src/index.ts']
		});
		write(root, 'packages/demo/src/index.ts', 'export const values: string[] = [];\n');
		const subject = resolved(root);
		const base = semanticRequest(root, subject.descriptor.subjectId, {
			maxAstNodes: 500_000,
			maxCompilerFacts: 500_000,
			maxCompilerQueries: 500_000,
			maxCompilerQueryInvocations: 5_000_000,
			maxDurationMs: 120_000,
			maxSnapshotBytes: 256 * 1024 * 1024,
			maxScopes: 500_000
		});
		const outcome = buildStaticSemanticSnapshot(
			{ ...base, capabilities: [...base.capabilities, 'TS_TYPE'] },
			{ subject }
		);
		expect(['complete', 'partial'], JSON.stringify(outcome)).toContain(outcome.outcome);
		if (outcome.outcome !== 'complete' && outcome.outcome !== 'partial')
			throw new Error(JSON.stringify(outcome));
		expect(
			validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject: subject })
		).toEqual({ issues: [], state: 'VALID' });
	});

	it('keeps structural declaration scopes closed when transient union symbols make binding identity unsupported', () => {
		const root = fixture();
		write(
			root,
			'packages/demo/src/index.ts',
			[
				'interface Left { value: string }',
				'interface Right { value: number }',
				'declare const subject: Left | Right;',
				'void subject.value;',
				''
			].join('\n')
		);
		const subject = resolved(root);
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		const snapshot = outcome.snapshot;
		expect(validateStaticSemanticSnapshot(snapshot, {}, { frozenSubject: subject })).toEqual({
			issues: [],
			state: 'VALID'
		});
		const valueDeclarations = snapshot.declarations.filter(
			(record) => record.kindName === 'PropertySignature' && record.name === 'value'
		);
		const scopeById = new Map(snapshot.scopes.map((scope) => [scope.id, scope]));
		const declarationPopulation = snapshot.populations.find(
			(population) => population.kind === 'DECLARATION'
		)!;

		expect(valueDeclarations).toHaveLength(2);
		for (const declaration of valueDeclarations) {
			expect(declaration).toMatchObject({
				scopeLinkState: 'RESOLVED',
				symbolBindingState: 'UNSUPPORTED',
				symbolId: null
			});
			expect(declaration.declaringScopeId).not.toBeNull();
			expect(scopeById.get(declaration.declaringScopeId!)).toMatchObject({
				kind: 'TYPE',
				ownerKindName: 'InterfaceDeclaration'
			});
			expect(declarationPopulation.members.analyzed).toContain(declaration.id);
			expect(declarationPopulation.members.unsupported).toContain(declaration.id);
			expect(declaration.bindingProvenanceId).not.toBe(declaration.structuralProvenanceId);
			expect(
				snapshot.provenances.find((record) => record.id === declaration.bindingProvenanceId)
					?.epistemic.supportBasis.method
			).toBe('typescript-public-type-checker-binding');
			expect(
				snapshot.provenances.find((record) => record.id === declaration.structuralProvenanceId)
					?.epistemic.supportBasis.method
			).toBe('typescript-public-ast-binding-rules');
		}
	});

	it('closes static-block, transparent-eval, parameter-property, and strictness scope claims against source-derived mutations', () => {
		const root = fixture();
		json(root, 'packages/demo/tsconfig.json', {
			compilerOptions: {
				alwaysStrict: false,
				module: 'ESNext',
				noEmit: true,
				noLib: true,
				strict: false,
				target: 'ES2022'
			},
			files: ['src/strict.ts', 'src/sloppy.ts', 'src/escaped.ts']
		});
		write(
			root,
			'packages/demo/src/strict.ts',
			[
				'"use strict";',
				'declare const eval: any;',
				'declare const marker: any;',
				'class Box {',
				'  static { var local = 1; void local; }',
				'  constructor(public value: number) { void value; void this.value; }',
				'}',
				'{ function strictBlock() {} void strictBlock; }',
				'function risky() { (eval as any)(""); void marker; }',
				''
			].join('\n')
		);
		write(
			root,
			'packages/demo/src/sloppy.ts',
			[
				'{ function sloppyBlock() {} void sloppyBlock; }',
				'function outer() { function bodyLocal() {} void bodyLocal; }',
				''
			].join('\n')
		);
		write(
			root,
			'packages/demo/src/escaped.ts',
			'"use\\x20strict"; { function escapedBlock() {} void escapedBlock; }\n'
		);
		const subject = resolved(root);
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		const snapshot = outcome.snapshot;
		expect(validateStaticSemanticSnapshot(snapshot, {}, { frozenSubject: subject })).toEqual({
			issues: [],
			state: 'VALID'
		});

		const staticVar = snapshot.declarations.find(
			(record) => record.kindName === 'VariableDeclaration' && record.name === 'local'
		)!;
		const parameterProperty = snapshot.declarations.find(
			(record) => record.kindName === 'Parameter' && record.name === 'value'
		)!;
		const strictBlock = snapshot.declarations.find((record) => record.name === 'strictBlock')!;
		const sloppyBlock = snapshot.declarations.find((record) => record.name === 'sloppyBlock')!;
		const escapedBlock = snapshot.declarations.find((record) => record.name === 'escapedBlock')!;
		const bodyLocal = snapshot.declarations.find((record) => record.name === 'bodyLocal')!;
		const scopeById = new Map(snapshot.scopes.map((scope) => [scope.id, scope]));
		const markerReference = snapshot.references.find((reference) => {
			const node = snapshot.astNodes.find((candidate) => candidate.id === reference.nodeId);
			return reference.role === 'SYMBOL_USE' && node?.syntacticIdentifierText === 'marker';
		})!;

		expect(scopeById.get(staticVar.declaringScopeId!)).toMatchObject({
			kind: 'BLOCK',
			ownerKindName: 'ClassStaticBlockDeclaration'
		});
		expect(scopeById.get(strictBlock.declaringScopeId!)).toMatchObject({ kind: 'BLOCK' });
		expect(scopeById.get(bodyLocal.declaringScopeId!)).toMatchObject({ kind: 'FUNCTION' });
		expect(sloppyBlock).toMatchObject({
			declaringScopeId: null,
			scopeLinkState: 'UNSUPPORTED',
			symbolBindingState: 'RESOLVED'
		});
		expect(escapedBlock).toMatchObject({
			declaringScopeId: null,
			scopeLinkState: 'UNSUPPORTED',
			symbolBindingState: 'RESOLVED'
		});
		expect(parameterProperty).toMatchObject({
			declaringScopeId: null,
			scopeLinkState: 'UNSUPPORTED',
			symbolBindingState: 'UNSUPPORTED',
			symbolId: null
		});
		expect(markerReference).toMatchObject({
			containingScopeId: null,
			scopeLinkState: 'UNSUPPORTED'
		});
		const declarationPopulation = snapshot.populations.find(
			(population) => population.kind === 'DECLARATION'
		)!;
		expect(declarationPopulation.members.analyzed).toEqual(
			expect.arrayContaining([parameterProperty.id, sloppyBlock.id, escapedBlock.id])
		);
		expect(declarationPopulation.members.unsupported).toEqual(
			expect.arrayContaining([parameterProperty.id, sloppyBlock.id, escapedBlock.id])
		);

		const bindingProvenance = snapshot.provenances.find(
			(record) => record.id === parameterProperty.bindingProvenanceId
		)!;
		const structuralProvenance = snapshot.provenances.find(
			(record) => record.id === parameterProperty.structuralProvenanceId
		)!;
		expect(parameterProperty.bindingProvenanceId).not.toBe(
			parameterProperty.structuralProvenanceId
		);
		expect(bindingProvenance.epistemic.supportBasis.method).toBe(
			'typescript-public-type-checker-binding'
		);
		expect(structuralProvenance.epistemic.supportBasis.method).toBe(
			'typescript-public-ast-binding-rules'
		);

		const sourceScopeFor = (sourceId: string) =>
			snapshot.scopes.find(
				(scope) =>
					scope.sourceId === sourceId &&
					(scope.kind === 'SOURCE_SCRIPT' || scope.kind === 'SOURCE_MODULE')
			)!;
		const declarationMutation = (
			target: (typeof snapshot.declarations)[number],
			replacement: (typeof snapshot.declarations)[number]
		): StaticSemanticSnapshot => ({
			...snapshot,
			declarations: snapshot.declarations.map((record) =>
				record.id === target.id ? replacement : record
			)
		});
		for (const target of [staticVar, strictBlock, sloppyBlock]) {
			const mutation = declarationMutation(target, {
				...target,
				declaringScopeId: sourceScopeFor(target.sourceId).id,
				scopeLinkState: 'RESOLVED'
			});
			const index = snapshot.declarations.indexOf(target);
			expect(
				validateStaticSemanticSnapshot(mutation, {}, { frozenSubject: subject }).issues
			).toContainEqual(
				expect.objectContaining({
					message:
						'Scope link must reproduce the independently recomputed supported binding boundary.',
					path: `$.declarations[${index}].declaringScopeId`
				})
			);
		}
		const escapedLexicalBlock = snapshot.scopes.find(
			(scope) =>
				scope.sourceId === escapedBlock.sourceId &&
				scope.kind === 'BLOCK' &&
				scope.start !== null &&
				scope.end !== null &&
				scope.start <= escapedBlock.start &&
				scope.end >= escapedBlock.end
		)!;
		const escapedMutation = declarationMutation(escapedBlock, {
			...escapedBlock,
			declaringScopeId: escapedLexicalBlock.id,
			scopeLinkState: 'RESOLVED'
		});
		expect(
			validateStaticSemanticSnapshot(escapedMutation, {}, { frozenSubject: subject }).issues
		).toContainEqual(
			expect.objectContaining({
				message:
					'Scope link must reproduce the independently recomputed supported binding boundary.',
				path: `$.declarations[${snapshot.declarations.indexOf(escapedBlock)}].declaringScopeId`
			})
		);
		const parameterMutation = declarationMutation(parameterProperty, {
			...parameterProperty,
			symbolBindingState: 'RESOLVED'
		});
		expect(
			validateStaticSemanticSnapshot(parameterMutation, {}, { frozenSubject: subject }).issues
		).toContainEqual(
			expect.objectContaining({
				message:
					'Declaration symbol-binding state must agree exactly with nullable symbol identity.',
				path: `$.declarations[${snapshot.declarations.indexOf(parameterProperty)}].symbolBindingState`
			})
		);
		const markerMutation: StaticSemanticSnapshot = {
			...snapshot,
			references: snapshot.references.map((reference) =>
				reference.id === markerReference.id
					? {
							...reference,
							containingScopeId: sourceScopeFor(reference.sourceId).id,
							scopeLinkState: 'RESOLVED'
						}
					: reference
			)
		};
		expect(
			validateStaticSemanticSnapshot(markerMutation, {}, { frozenSubject: subject }).issues
		).toContainEqual(
			expect.objectContaining({
				message:
					'Scope link must reproduce the independently recomputed supported binding boundary.',
				path: `$.references[${snapshot.references.indexOf(markerReference)}].containingScopeId`
			})
		);
	});

	it('retains direct-eval-only scope degradation as independently limited TS_SYMBOL partiality', () => {
		const root = fixture();
		json(root, 'packages/demo/tsconfig.json', {
			compilerOptions: {
				alwaysStrict: false,
				module: 'ESNext',
				noEmit: true,
				noLib: true,
				strict: false,
				target: 'ES2022'
			},
			files: ['src/index.ts']
		});
		write(
			root,
			'packages/demo/src/index.ts',
			[
				'declare const eval: any;',
				'declare const marker: any;',
				'function risky() { (eval as any)(""); void marker; }',
				''
			].join('\n')
		);
		const subject = resolved(root);
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		const snapshot = outcome.snapshot;
		expect(validateStaticSemanticSnapshot(snapshot, {}, { frozenSubject: subject })).toEqual({
			issues: [],
			state: 'VALID'
		});

		expect(
			snapshot.declarations.every(
				(record) => record.scopeLinkState === 'RESOLVED' && record.symbolBindingState === 'RESOLVED'
			)
		).toBe(true);
		expect(
			snapshot.projects[0]?.partialityReasons.filter((reason) => reason.capability === 'TS_SYMBOL')
		).toEqual([]);
		const markerReference = snapshot.references.find((reference) => {
			const node = snapshot.astNodes.find((candidate) => candidate.id === reference.nodeId);
			return reference.role === 'SYMBOL_USE' && node?.syntacticIdentifierText === 'marker';
		})!;
		expect(markerReference).toMatchObject({
			containingScopeId: null,
			resolutionState: 'RESOLVED_DIRECT',
			scopeLinkState: 'UNSUPPORTED'
		});
		const referencePopulation = snapshot.populations.find(
			(population) => population.kind === 'REFERENCE'
		)!;
		expect(referencePopulation.members.unsupported).toContain(markerReference.id);
		const structuralProvenance = snapshot.provenances.find(
			(record) => record.id === markerReference.structuralProvenanceId
		)!;
		expect(structuralProvenance.epistemic.capabilityCoverage).toBe('partial');
		expect(structuralProvenance.limitations).toContainEqual(
			expect.objectContaining({
				capability: 'TS_SYMBOL',
				closureEffect: 'DEGRADES_CLOSURE',
				reason: expect.stringContaining('scope-link')
			})
		);
		expect(
			snapshot.capabilities.find((capability) => capability.capability === 'TS_SYMBOL')?.state
		).toBe('PARTIAL');
	});

	it('retains malformed-source recovery as explicit syntax and symbol partiality and rejects dishonest mutations', () => {
		const root = fixture();
		write(root, 'packages/demo/src/index.ts', 'export const broken = ;\nexport const after = 1;\n');
		const subject = resolved(root);
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));

		expect(
			validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject: subject })
		).toEqual({ issues: [], state: 'VALID' });
		expect(outcome.snapshot.diagnostics).toContainEqual(
			expect.objectContaining({
				category: 'ERROR',
				family: 'SYNTACTIC',
				path: 'packages/demo/src/index.ts'
			})
		);
		expect(
			outcome.snapshot.programs[0]?.diagnosticFamilies.find(
				(family) => family.family === 'SYNTACTIC'
			)
		).toMatchObject({ coverage: 'COMPLETE', state: 'RUN' });
		expect(
			outcome.snapshot.projects[0]?.partialityReasons.filter(
				(reason) => reason.code === 'TYPESCRIPT_PROJECT_PARTIAL'
			)
		).toEqual([
			expect.objectContaining({
				capability: 'TS_SYMBOL',
				message: expect.stringContaining('parser recovery'),
				path: 'packages/demo/src/index.ts'
			}),
			expect.objectContaining({
				capability: 'TS_SYNTAX',
				message: expect.stringContaining('parser recovery'),
				path: 'packages/demo/src/index.ts'
			})
		]);
		for (const capability of ['TS_SYMBOL', 'TS_SYNTAX'] as const)
			expect(
				outcome.snapshot.capabilities.find((entry) => entry.capability === capability)?.state
			).toBe('PARTIAL');
		expect(outcome.snapshot.astNodes).toContainEqual(
			expect.objectContaining({
				syntacticIdentifierText: 'after'
			})
		);

		for (const missingCapability of ['TS_SYMBOL', 'TS_SYNTAX'] as const) {
			const withoutRequiredReason: StaticSemanticSnapshot = {
				...outcome.snapshot,
				projects: outcome.snapshot.projects.map((project) => ({
					...project,
					partialityReasons: project.partialityReasons.filter(
						(reason) =>
							reason.code !== 'TYPESCRIPT_PROJECT_PARTIAL' ||
							reason.capability !== missingCapability
					)
				}))
			};
			expect(
				validateStaticSemanticSnapshot(withoutRequiredReason, {}, { frozenSubject: subject }).issues
			).toContainEqual(
				expect.objectContaining({
					message: expect.stringContaining(
						`explicit ${missingCapability} TYPESCRIPT_PROJECT_PARTIAL parser-recovery reason`
					),
					path: '$.projects[0].partialityReasons'
				})
			);

			const dishonestCapabilityRollup: StaticSemanticSnapshot = {
				...outcome.snapshot,
				capabilities: outcome.snapshot.capabilities.map((entry) =>
					entry.capability === missingCapability ? { ...entry, state: 'SUPPORTED' as const } : entry
				)
			};
			expect(
				validateStaticSemanticSnapshot(dishonestCapabilityRollup, {}, { frozenSubject: subject })
					.issues
			).toContainEqual(
				expect.objectContaining({
					message: `${missingCapability} state must exactly roll up its capability-specific facts and closure losses.`,
					path: '$.capabilities'
				})
			);
		}
	});

	it('rejects unsupported capabilities and accessor-bearing requests without touching accessors', () => {
		const root = fixture();
		const subject = resolved(root);
		const unsupported = {
			...semanticRequest(root, subject.descriptor.subjectId),
			capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_CALL']
		};
		expect(buildStaticSemanticSnapshot(unsupported, { subject })).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'CAPABILITY_UNSUPPORTED' })]
		});

		let accesses = 0;
		const hostile = Object.create(null) as Record<string, unknown>;
		Object.defineProperty(hostile, 'schemaVersion', {
			enumerable: true,
			get() {
				accesses += 1;
				return SEMANTIC_REQUEST_SCHEMA_VERSION;
			}
		});
		expect(buildStaticSemanticSnapshot(hostile, { subject })).toMatchObject({
			outcome: 'incompatible'
		});
		expect(accesses).toBe(0);

		const forgedSubject = Object.create(null) as Record<string, unknown>;
		Object.defineProperty(forgedSubject, 'descriptor', {
			enumerable: true,
			get() {
				accesses += 1;
				throw new Error('must not execute');
			}
		});
		expect(
			buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId), {
				subject: forgedSubject as never
			})
		).toMatchObject({ outcome: 'incompatible' });
		expect(accesses).toBe(0);
	});

	it('rejects non-plain, expanded, sparse, cyclic, proxied, and non-finite request data at the request boundary', () => {
		const root = fixture();
		const subject = resolved(root);
		const base = semanticRequest(root, subject.descriptor.subjectId);
		let traps = 0;
		const trap = (): never => {
			traps += 1;
			throw new TypeError('request trap executed');
		};
		const proxied = new Proxy(base, {
			get: trap,
			getOwnPropertyDescriptor: trap,
			getPrototypeOf: trap,
			ownKeys: trap
		});
		const inherited = Object.assign(Object.create({ inherited: true }), base);
		const symbolExpanded = { ...base, [Symbol('expanded')]: true };
		const fieldExpanded = { ...base, unexpected: true };
		const sparseCapabilities = new Array(2) as unknown[];
		sparseCapabilities[0] = 'TS_PROJECT';
		const expandedCapabilities = ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as string[] & {
			extra?: boolean;
		};
		expandedCapabilities.extra = true;
		const cyclicCapabilities: unknown[] = ['TS_PROJECT'];
		cyclicCapabilities.push(cyclicCapabilities);
		const accessorCapabilities = ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'];
		Object.defineProperty(accessorCapabilities, '1', { enumerable: true, get: trap });
		const invalidRequests: readonly unknown[] = [
			null,
			[],
			proxied,
			inherited,
			symbolExpanded,
			fieldExpanded,
			{ ...base, capabilities: sparseCapabilities },
			{ ...base, capabilities: expandedCapabilities },
			{ ...base, capabilities: cyclicCapabilities },
			{ ...base, capabilities: accessorCapabilities },
			{
				...base,
				budgets: Object.fromEntries(
					Object.entries(base.budgets).filter(([key]) => key !== 'maxCompilerFacts')
				)
			},
			{ ...base, budgets: { ...base.budgets, unexpectedCompilerBudget: 1 } },
			{ ...base, budgets: { ...base.budgets, maxAstNodes: Number.POSITIVE_INFINITY } },
			{ ...base, budgets: { ...base.budgets, maxAstNodes: Number.MAX_SAFE_INTEGER + 1 } },
			{ ...base, expectEmpty: 'false' },
			{ ...base, rootLocator: 'relative/repository' },
			{ ...base, subjectId: 'not-a-digest' }
		];

		for (const invalid of invalidRequests) {
			expect(buildStaticSemanticSnapshot(invalid, { subject })).toMatchObject({
				diagnostics: [
					expect.objectContaining({ code: 'SEMANTIC_VALIDATION_FAILED', phase: 'REQUEST' })
				],
				outcome: 'incompatible'
			});
		}
		expect(traps).toBe(0);
	});

	it('closes capability/version inspection and subject-binding request failures', () => {
		const root = fixture();
		const subject = resolved(root);
		const base = semanticRequest(root, subject.descriptor.subjectId);
		const alienPrototype = Object.setPrototypeOf(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'], null);
		const probes = [
			{ ...base, capabilities: alienPrototype },
			{
				...base,
				capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_PROJECT', 'TS_SYMBOL']
			},
			{ ...base, capabilities: ['TS_PROJECT', 'UNKNOWN', 'TS_SYNTAX'] },
			{ ...base, capabilities: ['TS_PROJECT', 'TS_SYNTAX'] },
			{ ...base, operationVersion: 'unsupported-operation/1' }
		];
		for (const request of probes) {
			expect(buildStaticSemanticSnapshot(request, { subject })).toMatchObject({
				outcome: 'incompatible'
			});
		}

		expect(
			buildStaticSemanticSnapshot({ ...base, subjectId: 'f'.repeat(64) }, { subject })
		).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SUBJECT_ID_MISMATCH', phase: 'REQUEST' })],
			outcome: 'incompatible'
		});

		const requestInspectionFailure = { ...base };
		const actualOwnKeys = Reflect.ownKeys;
		const ownKeys = vi.spyOn(Reflect, 'ownKeys').mockImplementation((value) => {
			if (value === requestInspectionFailure) throw new Error('request keys unavailable');
			return actualOwnKeys(value);
		});
		try {
			expect(buildStaticSemanticSnapshot(requestInspectionFailure, { subject })).toMatchObject({
				outcome: 'incompatible'
			});
		} finally {
			ownKeys.mockRestore();
		}

		const capabilitiesInspectionFailure = [...base.capabilities];
		const request = { ...base, capabilities: capabilitiesInspectionFailure };
		const actualGetPrototypeOf = Reflect.getPrototypeOf;
		const getPrototypeOf = vi.spyOn(Reflect, 'getPrototypeOf').mockImplementation((value) => {
			if (value === capabilitiesInspectionFailure)
				throw new Error('capability prototype unavailable');
			return actualGetPrototypeOf(value);
		});
		try {
			expect(buildStaticSemanticSnapshot(request, { subject })).toMatchObject({
				outcome: 'incompatible'
			});
		} finally {
			getPrototypeOf.mockRestore();
		}
	});

	it('refuses a project population larger than the operation project budget', () => {
		const root = referencedFixture();
		const subject = resolved(root, ['packages/app/tsconfig.json']);
		expect(subject.projects).toHaveLength(2);
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId, { maxProjects: 1 }),
			{ subject }
		);
		expect(outcome).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'SEMANTIC_BUDGET_EXCEEDED', phase: 'MATERIALIZE' })
			],
			outcome: 'unavailable'
		});
	});

	it('emits no snapshot when the supplied FrozenSubject has become stale', () => {
		const root = fixture();
		const subject = resolved(root);
		write(root, 'packages/demo/src/index.ts', 'export const changed = true;\n');
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(outcome).toMatchObject({ outcome: 'unavailable' });
		expect('snapshot' in outcome).toBe(false);
	});

	it('reproduces referenced projects and path-mapped compiler options while retaining unresolved cross-Program bindings', () => {
		const root = referencedFixture();
		const subject = resolved(root, ['packages/app/tsconfig.json']);
		expect(subject.projects.map((project) => project.configPath)).toEqual([
			'packages/app/tsconfig.json',
			'packages/base/tsconfig.json'
		]);
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(
			validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject: subject })
		).toEqual({ issues: [], state: 'VALID' });
		expect(outcome.snapshot.projects).toHaveLength(2);
		expect(outcome.snapshot.programs).toHaveLength(2);
		expect(
			outcome.snapshot.capabilities.find((entry) => entry.capability === 'TS_SYMBOL')?.state
		).toBe('PARTIAL');
		expect(outcome.snapshot.aliases.some((alias) => alias.state === 'UNRESOLVED')).toBe(true);
		expect(diagnosticCharactersByProject(outcome.snapshot).size).toBe(2);
		expect(
			outcome.snapshot.projects.find(
				(project) => project.configPath === 'packages/app/tsconfig.json'
			)?.projectReferences
		).toEqual(['packages/base/tsconfig.json']);
		expect(
			outcome.snapshot.sources.some((source) => source.logicalPath === 'packages/base/src/index.ts')
		).toBe(true);
		const appSource = outcome.snapshot.sources.find(
			(source) => source.logicalPath === 'packages/app/src/index.ts'
		);
		const baseSource = outcome.snapshot.sources.find(
			(source) => source.logicalPath === 'packages/base/src/index.ts'
		);
		const baseImport = outcome.snapshot.moduleResolutions.find(
			(resolution) =>
				resolution.sourceId === appSource?.id && resolution.specifier === '@fixture/base'
		);
		expect(baseImport).toMatchObject({
			occurrenceKind: 'IMPORT',
			resolutionState: 'UNRESOLVED',
			targetSourceId: null
		});
		expect(baseSource?.id).toBeDefined();
		expect(outcome.snapshot.aliases.length).toBeGreaterThan(0);
		expect(
			outcome.snapshot.references.some(
				(reference) =>
					reference.sourceId === appSource?.id &&
					reference.resolutionState === 'UNRESOLVED' &&
					reference.symbolId !== null &&
					reference.resolvedSymbolId === null
			)
		).toBe(true);
		expect(
			outcome.snapshot.moduleExports.some(
				(record) => record.sourceId === baseSource?.id && record.exportName === 'base'
			)
		).toBe(true);
		const unresolvedExport = outcome.snapshot.moduleExports.find(
			(record) => record.sourceId === appSource?.id && record.state === 'UNRESOLVED'
		);
		expect(unresolvedExport).toBeDefined();

		const population = (kind: string) =>
			outcome.snapshot.populations.find((record) => record.kind === kind)!;
		expect(population('DECLARATION').members.analyzed).toEqual(
			outcome.snapshot.declarations.map((record) => record.id).sort()
		);
		expect(population('DECLARATION').members.unsupported).toEqual(
			outcome.snapshot.declarations
				.filter((record) => record.scopeLinkState === 'UNSUPPORTED')
				.map((record) => record.id)
				.sort()
		);
		expect(population('ALIAS').members.analyzed).toEqual(
			outcome.snapshot.aliases.map((record) => record.id).sort()
		);
		expect(population('ALIAS').members.unknown).toEqual(
			outcome.snapshot.aliases
				.filter((record) => record.state === 'UNRESOLVED' || record.state === 'CIRCULAR')
				.map((record) => record.id)
				.sort()
		);
		expect(population('ALIAS').members.unsupported).toEqual(
			outcome.snapshot.aliases
				.filter((record) => record.state === 'UNSUPPORTED')
				.map((record) => record.id)
				.sort()
		);
		expect(population('REFERENCE').members.analyzed).toEqual(
			outcome.snapshot.references.map((record) => record.id).sort()
		);
		expect(population('REFERENCE').members.unsupported).toEqual(
			outcome.snapshot.references
				.filter(
					(record) =>
						record.scopeLinkState === 'UNSUPPORTED' || record.resolutionState === 'UNSUPPORTED'
				)
				.map((record) => record.id)
				.sort()
		);
		expect(population('REFERENCE').members.unknown).toEqual(
			outcome.snapshot.references
				.filter(
					(record) =>
						record.resolutionState === 'UNRESOLVED' && record.scopeLinkState !== 'UNSUPPORTED'
				)
				.map((record) => record.id)
				.sort()
		);
		expect(population('MODULE_RESOLUTION').members.analyzed).toEqual(
			outcome.snapshot.moduleResolutions.map((record) => record.id).sort()
		);
		expect(population('MODULE_RESOLUTION').members.unsupported).toEqual(
			outcome.snapshot.moduleResolutions
				.filter((record) => record.resolutionState === 'UNSUPPORTED')
				.map((record) => record.id)
				.sort()
		);
		expect(population('MODULE_RESOLUTION').members.unknown).toEqual(
			outcome.snapshot.moduleResolutions
				.filter((record) => record.resolutionState === 'UNRESOLVED')
				.map((record) => record.id)
				.sort()
		);
		expect(population('MODULE_EXPORT').members.analyzed).toEqual(
			outcome.snapshot.moduleExports.map((record) => record.id).sort()
		);
		expect(population('MODULE_EXPORT').members.unknown).toEqual(
			outcome.snapshot.moduleExports
				.filter((record) => record.state === 'UNRESOLVED')
				.map((record) => record.id)
				.sort()
		);
		for (const kind of ['ALIAS', 'REFERENCE', 'MODULE_RESOLUTION', 'MODULE_EXPORT'] as const) {
			const current = population(kind);
			expect(current.members.unknown.length + current.members.unsupported.length).toBeGreaterThan(
				0
			);
			const dishonestPopulation: StaticSemanticSnapshot = {
				...outcome.snapshot,
				populations: outcome.snapshot.populations.map((record) =>
					record.kind === kind
						? semanticPopulation(kind, {
								...record.members,
								unknown: [],
								unsupported: []
							})
						: record
				)
			};
			expect(
				validateStaticSemanticSnapshot(dishonestPopulation, {}, { frozenSubject: subject }).issues
			).toContainEqual(
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					path: `$.populations.${kind}`
				})
			);
		}

		const degradedFacts = [
			...outcome.snapshot.aliases.flatMap((fact, index) =>
				fact.state === 'RESOLVED'
					? []
					: [{ path: `$.aliases[${index}].provenanceId`, provenanceId: fact.provenanceId }]
			),
			...outcome.snapshot.references.flatMap((fact, index) => [
				...(fact.scopeLinkState === 'UNSUPPORTED'
					? [
							{
								path: `$.references[${index}].structuralProvenanceId`,
								provenanceId: fact.structuralProvenanceId
							}
						]
					: []),
				...(fact.resolutionState === 'UNRESOLVED' || fact.resolutionState === 'UNSUPPORTED'
					? [
							{
								path: `$.references[${index}].resolutionProvenanceId`,
								provenanceId: fact.resolutionProvenanceId
							}
						]
					: [])
			]),
			...outcome.snapshot.moduleResolutions.flatMap((fact, index) =>
				fact.resolutionState === 'UNRESOLVED' || fact.resolutionState === 'UNSUPPORTED'
					? [
							{
								path: `$.moduleResolutions[${index}].provenanceId`,
								provenanceId: fact.provenanceId
							}
						]
					: []
			),
			...outcome.snapshot.moduleExports.flatMap((fact, index) =>
				fact.state === 'UNRESOLVED'
					? [
							{
								path: `$.moduleExports[${index}].provenanceId`,
								provenanceId: fact.provenanceId
							}
						]
					: []
			)
		];
		expect(new Set(degradedFacts.map(({ path }) => path.slice(2, path.indexOf('['))))).toEqual(
			new Set(['aliases', 'references', 'moduleResolutions', 'moduleExports'])
		);
		const degradedMessage =
			'Degraded symbol facts require partial TS_SYMBOL provenance with a closure-degrading limitation bound to an unresolved region.';
		const mutateProvenance = (
			provenanceId: string,
			mutate: (record: SemanticFactProvenanceRecord) => SemanticFactProvenanceRecord
		): StaticSemanticSnapshot => ({
			...outcome.snapshot,
			provenances: outcome.snapshot.provenances.map((record) =>
				record.id === provenanceId ? mutate(record) : record
			)
		});
		for (const { path, provenanceId } of degradedFacts) {
			const factProvenance = outcome.snapshot.provenances.find(
				(record) => record.id === provenanceId
			)!;
			expect(factProvenance.epistemic.capabilityCoverage).toBe('partial');
			expect(
				factProvenance.limitations.some(
					(limitation) =>
						limitation.capability === 'TS_SYMBOL' &&
						limitation.closureEffect === 'DEGRADES_CLOSURE' &&
						factProvenance.epistemic.unresolvedRegions.includes(limitation.region)
				)
			).toBe(true);
			for (const mutation of [
				mutateProvenance(provenanceId, (record) => ({
					...record,
					epistemic: { ...record.epistemic, capabilityCoverage: 'supported' }
				})),
				mutateProvenance(provenanceId, (record) => ({
					...record,
					epistemic: { ...record.epistemic, unresolvedRegions: [] },
					limitations: []
				}))
			])
				expect(
					validateStaticSemanticSnapshot(mutation, {}, { frozenSubject: subject }).issues
				).toContainEqual(expect.objectContaining({ message: degradedMessage, path }));
		}
	});

	it('binds requested assignability independently to each Program context in a referenced project graph', () => {
		const root = referencedFixture();
		const subject = resolved(root, ['packages/app/tsconfig.json']);
		const appText =
			"import { base } from '@fixture/base';\nexport { base };\nexport const result = base + 1;\n";
		const baseStart = appText.lastIndexOf('base +');
		const resultStart = appText.indexOf('result');
		const base = semanticRequest(root, subject.descriptor.subjectId);
		const request: BuildStaticSemanticSnapshotRequest = {
			...base,
			assignabilityRequests: [
				{
					requestId: 'base-to-result',
					requesterRef: 'test:multi-program-assignability',
					source: {
						end: baseStart + 'base'.length,
						logicalPath: 'packages/app/src/index.ts',
						queryMode: 'TYPE_AT_LOCATION',
						start: baseStart,
						syntaxKind: ts.SyntaxKind.Identifier
					},
					target: {
						end: resultStart + 'result'.length,
						logicalPath: 'packages/app/src/index.ts',
						queryMode: 'TYPE_AT_LOCATION',
						start: resultStart,
						syntaxKind: ts.SyntaxKind.Identifier
					}
				}
			],
			capabilities: [...base.capabilities, 'TS_TYPE']
		};

		const outcome = buildStaticSemanticSnapshot(request, { subject });
		expect(['complete', 'partial'], JSON.stringify(outcome)).toContain(outcome.outcome);
		if (outcome.outcome !== 'complete' && outcome.outcome !== 'partial')
			throw new Error(JSON.stringify(outcome));
		expect(
			validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject: subject })
		).toEqual({
			issues: [],
			state: 'VALID'
		});
		const relations = outcome.snapshot.typeRelations.filter(
			(relation): relation is SemanticAssignabilityRelationRecord =>
				relation.kind === 'ASSIGNABILITY' && relation.requestId === 'base-to-result'
		);
		expect(relations).toHaveLength(2);
		expect(relations.filter((relation) => relation.state === 'CONFIRMED')).toHaveLength(1);
		expect(relations.filter((relation) => relation.state === 'UNRESOLVED')).toHaveLength(1);
		for (const relation of relations) {
			const program = outcome.snapshot.programs.find(
				(candidate) => candidate.id === relation.programId
			);
			expect(program?.projectId).toBe(relation.projectId);
			expect(relation.checkerContextDigest).toBe(program?.contextDigest);
		}
	});

	it('reproduces array-valued paths and distinguishes root, reference, option, and parse recipe mismatches', () => {
		const root = fixture();
		write(root, 'packages/demo/generated/placeholder.ts', 'export const generated = true;\n');
		json(root, 'packages/demo/tsconfig.json', {
			compilerOptions: {
				module: 'ESNext',
				noEmit: true,
				noLib: true,
				rootDirs: ['generated', 'src'],
				strict: true,
				target: 'ES2022'
			},
			files: ['src/index.ts']
		});
		const subject = resolved(root);
		const request = semanticRequest(root, subject.descriptor.subjectId);
		const baseline = buildStaticSemanticSnapshot(request, { subject });
		expect(baseline.outcome, JSON.stringify(baseline)).toBe('complete');
		if (baseline.outcome !== 'complete') throw new Error(JSON.stringify(baseline));
		expect(baseline.snapshot.projects[0]?.programRecipe.compilerOptions).toMatchObject({
			rootDirs: ['packages/demo/generated', 'packages/demo/src']
		});

		const original = subject.projects[0]!.programRecipe;
		const probes: readonly { message: string; subject: FrozenSubject }[] = [
			{
				message: 'roots do not reproduce',
				subject: withProjectRecipe(subject, (recipe) => reviseRecipe(recipe, { rootNames: [] }))
			},
			{
				message: 'references do not reproduce',
				subject: withProjectRecipe(subject, (recipe) =>
					reviseRecipe(recipe, { projectReferences: ['packages/demo/missing-reference.json'] })
				)
			},
			{
				message: 'mismatched keys: strict',
				subject: withProjectRecipe(subject, (recipe) =>
					reviseRecipe(recipe, { compilerOptions: { ...recipe.compilerOptions, strict: false } })
				)
			},
			{
				message: 'could not reproduce parsed configuration',
				subject: withProjectRecipe(subject, (recipe) =>
					reviseRecipe(recipe, {
						compilerOptions: {
							...recipe.compilerOptions,
							configFilePath: 'packages/demo/missing-config.json'
						},
						configPath: 'packages/demo/missing-config.json'
					})
				)
			}
		];
		for (const probe of probes) {
			const outcome = buildStaticSemanticSnapshot(request, { subject: probe.subject });
			expect(outcome).toMatchObject({
				diagnostics: [
					expect.objectContaining({
						code: 'PROGRAM_RECIPE_MISMATCH',
						message: expect.stringContaining(probe.message),
						phase: 'PROGRAM'
					})
				],
				outcome: 'incompatible'
			});
		}
		expect(original.rootNames).toEqual(['packages/demo/src/index.ts']);
	});

	it('maps invalid, cyclic, non-finite, escaping, and byte-incomplete recipes to their exact public failures', () => {
		const root = fixture();
		const outside = mkdtempSync(join(tmpdir(), 'csaa-semantic-builder-outside-'));
		temporaryRoots.push(outside);
		write(outside, 'outside.ts', 'export const outside = true;\n');
		mkdirSync(join(root, 'node_modules'), { recursive: true });
		symlinkSync(
			outside,
			join(root, 'node_modules/escape'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const subject = resolved(root);
		const request = semanticRequest(root, subject.descriptor.subjectId);
		const original = subject.projects[0]!.programRecipe;

		const invalidDigest = withProjectRecipe(subject, (recipe) => ({
			...recipe,
			projectResolutionDigest: 'not-a-digest'
		}));
		expect(buildStaticSemanticSnapshot(request, { subject: invalidDigest })).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'PROGRAM_RECIPE_MISMATCH', phase: 'MATERIALIZE' })
			],
			outcome: 'incompatible'
		});

		const escaping = withProjectRecipe(subject, (recipe) =>
			reviseRecipe(recipe, { rootNames: ['node_modules/escape/outside.ts'] })
		);
		expect(buildStaticSemanticSnapshot(request, { subject: escaping })).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'COMPILER_CONTEXT_FORBIDDEN', phase: 'MATERIALIZE' })
			],
			outcome: 'unavailable'
		});

		const nonFiniteOptions = {
			...original.compilerOptions,
			maxNodeModuleJsDepth: Number.POSITIVE_INFINITY
		};
		const nonFinite = withProjectRecipe(subject, (recipe) => ({
			...recipe,
			compilerOptions: nonFiniteOptions
		}));
		expect(buildStaticSemanticSnapshot(request, { subject: nonFinite })).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'PROGRAM_RECIPE_MISMATCH', phase: 'MATERIALIZE' })
			],
			outcome: 'incompatible'
		});

		const cyclicOptions = { ...original.compilerOptions } as Record<string, unknown>;
		cyclicOptions.strict = cyclicOptions;
		const cyclic = withProjectRecipe(
			subject,
			(recipe) => ({ ...recipe, compilerOptions: cyclicOptions }) as ProgramRecipe
		);
		expect(buildStaticSemanticSnapshot(request, { subject: cyclic })).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'PROGRAM_RECIPE_MISMATCH', phase: 'MATERIALIZE' })
			],
			outcome: 'incompatible'
		});

		const missingBytes = cloneSubjectCapability(subject, {}, ['packages/demo/src/index.ts']);
		expect(buildStaticSemanticSnapshot(request, { subject: missingBytes })).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'FROZEN_BYTES_UNAVAILABLE', phase: 'PROGRAM' })
			],
			outcome: 'unavailable'
		});
	});

	it('returns an honestly partial snapshot for retained unsupported framework syntax', () => {
		const root = fixture();
		write(
			root,
			'packages/demo/src/View.svelte',
			'<script lang="ts">export let value: number;</script>\n'
		);
		const subject = resolved(root);
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(
			validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject: subject })
		).toEqual({ issues: [], state: 'VALID' });
		expect(
			outcome.snapshot.capabilities.find((capability) => capability.capability === 'TS_PROJECT')
				?.state
		).toBe('SUPPORTED');
		expect(
			outcome.snapshot.capabilities.find((capability) => capability.capability === 'TS_SYMBOL')
				?.state
		).toBe('SUPPORTED');
		expect(
			outcome.snapshot.capabilities.find((capability) => capability.capability === 'TS_SYNTAX')
				?.state
		).toBe('PARTIAL');
		expect(outcome.snapshot.projects[0]?.frameworkCandidates).toContain(
			'packages/demo/src/View.svelte'
		);
		expect(outcome.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'CAPABILITY_UNSUPPORTED', severity: 'WARNING' })
		);
	});

	it('fails closed without a snapshot when semantic extraction exceeds a requested budget', () => {
		const root = fixture();
		const subject = resolved(root);
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId, { maxAstNodes: 1 }),
			{ subject }
		);
		expect(outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SEMANTIC_BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});
		expect('snapshot' in outcome).toBe(false);
	});

	it('accepts exact semantic record ceilings without confusing validator traversal with domain populations', () => {
		const root = fixture();
		const subject = resolved(root);
		const initial = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(initial.outcome, JSON.stringify(initial)).toBe('complete');
		if (initial.outcome !== 'complete') throw new Error(JSON.stringify(initial));
		const exactCompilerFacts =
			initial.snapshot.aliases.length +
			initial.snapshot.declarations.length +
			initial.snapshot.moduleExports.length +
			initial.snapshot.moduleResolutions.length +
			initial.snapshot.references.length +
			initial.snapshot.symbols.length;
		expect(initial.snapshot.compilerInputs.length).toBeGreaterThan(0);
		expect(exactCompilerFacts).toBeGreaterThan(1);
		const exact = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId, {
				maxAstNodes: initial.snapshot.astNodes.length,
				maxCompilerFacts: exactCompilerFacts,
				maxSources: initial.snapshot.sources.length
			}),
			{ subject }
		);
		expect(exact.outcome, JSON.stringify(exact)).toBe('complete');
		const belowFactCeiling = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId, {
				maxCompilerFacts: exactCompilerFacts - 1
			}),
			{ subject }
		);
		expect(belowFactCeiling).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SEMANTIC_BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});
		expect('snapshot' in belowFactCeiling).toBe(false);
	});

	it('enforces compiler-query ceilings over the host and TypeChecker operation-wide union', () => {
		const root = fixture();
		const subject = resolved(root);
		const initial = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(initial.outcome, JSON.stringify(initial)).toBe('complete');
		if (initial.outcome !== 'complete') throw new Error(JSON.stringify(initial));
		const capturedInvocations = initial.snapshot.compilerInputs.reduce(
			(total, observation) => total + observation.invocationCount,
			0
		);
		expect(initial.snapshot.compilerInputs.length).toBeGreaterThan(0);
		expect(capturedInvocations).toBeGreaterThan(0);

		for (const budgets of [
			{ maxCompilerQueries: initial.snapshot.compilerInputs.length },
			{ maxCompilerQueryInvocations: capturedInvocations }
		]) {
			const outcome = buildStaticSemanticSnapshot(
				semanticRequest(root, subject.descriptor.subjectId, budgets),
				{ subject }
			);
			expect(outcome).toMatchObject({
				diagnostics: [
					expect.objectContaining({ code: 'SEMANTIC_BUDGET_EXCEEDED', phase: 'CAPTURE' })
				],
				outcome: 'unavailable'
			});
			expect('snapshot' in outcome).toBe(false);
		}
	});

	it('reports snapshot byte exhaustion as a budget refusal rather than validator failure', () => {
		const root = fixture();
		const subject = resolved(root);
		const baseline = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(baseline.outcome, JSON.stringify(baseline)).toBe('complete');
		if (baseline.outcome !== 'complete') throw new Error(JSON.stringify(baseline));
		const canonicalBytes = new TextEncoder().encode(
			canonicalSemanticJson(baseline.snapshot)
		).byteLength;
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId, {
				maxSnapshotBytes: canonicalBytes - 1_024
			}),
			{ subject }
		);
		expect(outcome).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'SEMANTIC_BUDGET_EXCEEDED', phase: 'VALIDATE' })
			],
			outcome: 'unavailable'
		});
		expect('snapshot' in outcome).toBe(false);
	});

	it('enforces diagnostic-character ceilings across the whole multi-project snapshot', () => {
		const root = referencedFixture();
		const subject = resolved(root, ['packages/app/tsconfig.json']);
		const initial = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId),
			{ subject }
		);
		expect(initial.outcome, JSON.stringify(initial)).toBe('partial');
		if (initial.outcome !== 'partial') throw new Error(JSON.stringify(initial));
		const byProject = diagnosticCharactersByProject(initial.snapshot);
		expect(byProject.size).toBe(2);
		const total = [...byProject.values()].reduce((sum, value) => sum + value, 0);
		const largestProject = Math.max(...byProject.values());
		expect(total).toBeGreaterThan(largestProject);
		const outcome = buildStaticSemanticSnapshot(
			semanticRequest(root, subject.descriptor.subjectId, { maxDiagnosticCharacters: total - 1 }),
			{ subject }
		);
		expect(outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SEMANTIC_BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});
		expect('snapshot' in outcome).toBe(false);
	});

	it('closes assignability request selectors, identities, ordering, and capability prerequisites', () => {
		const root = fixture();
		const subject = resolved(root);
		const base = semanticRequest(root, subject.descriptor.subjectId);
		const selector = {
			end: 1,
			logicalPath: 'a.ts',
			queryMode: 'TYPE_AT_LOCATION' as const,
			start: 0,
			syntaxKind: ts.SyntaxKind.Identifier
		};
		const request = {
			requestId: 'a',
			requesterRef: 'test',
			source: selector,
			target: selector
		};
		const expectRequestRefusal = (value: unknown): void => {
			expect(buildStaticSemanticSnapshot(value, { subject })).toMatchObject({
				diagnostics: [expect.objectContaining({ code: expect.any(String), phase: 'REQUEST' })],
				outcome: 'incompatible'
			});
		};

		for (const assignabilityRequest of [
			{ ...request, requestId: '' },
			{ ...request, requesterRef: '' },
			{ ...request, source: { ...selector, logicalPath: 'longer-than-bound.ts' } },
			{ ...request, source: { ...selector, logicalPath: '../outside.ts' } },
			{ ...request, source: { ...selector, start: -1 } },
			{ ...request, source: { ...selector, end: -1 } },
			{ ...request, source: { ...selector, syntaxKind: -1 } },
			{ ...request, source: { ...selector, queryMode: 'UNKNOWN_QUERY' } }
		]) {
			expectRequestRefusal({
				...base,
				assignabilityRequests: [assignabilityRequest],
				budgets: { ...base.budgets, maxPathCharacters: 16 }
			});
		}

		const later = { ...request, requestId: 'z' };
		expectRequestRefusal({ ...base, assignabilityRequests: [later, request] });
		expectRequestRefusal({ ...base, assignabilityRequests: [request, { ...request }] });

		const actualSort = Array.prototype.sort;
		const sort = vi.spyOn(Array.prototype, 'sort').mockImplementation(function (
			this: unknown[],
			compareFn?: (left: unknown, right: unknown) => number
		) {
			if (
				this.length === 3 &&
				this.includes('TS_PROJECT') &&
				this.includes('TS_SYMBOL') &&
				this.includes('TS_SYNTAX')
			)
				throw new Error('capability ordering unavailable');
			return actualSort.call(this, compareFn);
		});
		try {
			expectRequestRefusal(base);
		} finally {
			sort.mockRestore();
		}
	});

	it('fails closed when the operation deadline expires or its clock throws between checkpoints', () => {
		const root = fixture();
		const subject = resolved(root);
		const request = semanticRequest(root, subject.descriptor.subjectId, { maxDurationMs: 1 });

		const expiredWallClock = vi.spyOn(Date, 'now').mockReturnValue(1_000);
		const expiredClock = vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(2);
		let expired;
		try {
			expired = buildStaticSemanticSnapshot(request, { subject });
		} finally {
			expiredClock.mockRestore();
			expiredWallClock.mockRestore();
		}
		expect(expired).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SEMANTIC_BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});

		const failingWallClock = vi.spyOn(Date, 'now').mockReturnValue(2_000);
		const failingClock = vi
			.spyOn(performance, 'now')
			.mockReturnValueOnce(0)
			.mockImplementation(() => {
				throw new Error('clock unavailable');
			});
		let failed;
		try {
			failed = buildStaticSemanticSnapshot(request, { subject });
		} finally {
			failingClock.mockRestore();
			failingWallClock.mockRestore();
		}
		expect(failed).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'SEMANTIC_VALIDATION_FAILED',
					message: expect.stringContaining('clock failed closed'),
					phase: 'REQUEST'
				})
			],
			outcome: 'unavailable'
		});
	});

	it('refuses replay drift and downstream normalization or validation disagreement', () => {
		const root = fixture();
		const subject = resolved(root);
		const request = semanticRequest(root, subject.descriptor.subjectId);
		const actualExtract = staticRawExtraction.extractStaticRaw;

		let extractionCalls = 0;
		const changedSymbol = vi
			.spyOn(staticRawExtraction, 'extractStaticRaw')
			.mockImplementation((input) => {
				const raw = actualExtract(input);
				extractionCalls += 1;
				if (extractionCalls !== 2) return raw;
				return {
					...raw,
					symbols: raw.symbols.map((symbol, index) =>
						index === 0 ? { ...symbol, name: `${symbol.name}-replay-drift` } : symbol
					)
				};
			});
		let symbolDrift;
		try {
			symbolDrift = buildStaticSemanticSnapshot(request, { subject });
		} finally {
			changedSymbol.mockRestore();
		}
		expect(symbolDrift).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'COMPILER_CONTEXT_CHANGED',
					message: expect.stringContaining('symbols.name'),
					phase: 'RECHECK'
				})
			],
			outcome: 'unavailable'
		});

		extractionCalls = 0;
		const changedProject = vi
			.spyOn(staticRawExtraction, 'extractStaticRaw')
			.mockImplementation((input) => {
				const raw = actualExtract(input);
				extractionCalls += 1;
				return extractionCalls === 2
					? {
							...raw,
							project: { ...raw.project, configPath: 'unexpected/tsconfig.json' }
						}
					: raw;
			});
		let projectDrift;
		try {
			projectDrift = buildStaticSemanticSnapshot(request, { subject });
		} finally {
			changedProject.mockRestore();
		}
		expect(projectDrift).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'COMPILER_CONTEXT_CHANGED',
					message: expect.stringMatching(/missing-project.*unexpected-project/u),
					phase: 'RECHECK'
				})
			],
			outcome: 'unavailable'
		});

		const normalizationFailure = vi
			.spyOn(semanticNormalization, 'normalizeStaticSemanticSnapshot')
			.mockImplementation(() => {
				throw new semanticNormalization.SemanticNormalizationError(
					'INVALID_RAW_MODEL',
					'forced normalization disagreement'
				);
			});
		let normalizationOutcome;
		try {
			normalizationOutcome = buildStaticSemanticSnapshot(request, { subject });
		} finally {
			normalizationFailure.mockRestore();
		}
		expect(normalizationOutcome).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'SEMANTIC_VALIDATION_FAILED',
					message: 'forced normalization disagreement',
					phase: 'VALIDATE'
				})
			],
			outcome: 'unavailable'
		});

		const validationFailure = vi
			.spyOn(semanticValidation, 'validateStaticSemanticSnapshotWithBudgetEvidence')
			.mockReturnValue({
				evidence: null,
				validation: {
					issues: [
						{
							code: 'INVALID_VALUE',
							message: 'forced validator disagreement',
							path: '$.forced'
						}
					],
					state: 'INVALID'
				}
			});
		let invalidOutcome;
		try {
			invalidOutcome = buildStaticSemanticSnapshot(request, { subject });
		} finally {
			validationFailure.mockRestore();
		}
		expect(invalidOutcome).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'SEMANTIC_VALIDATION_FAILED',
					message: expect.stringContaining('forced validator disagreement'),
					phase: 'VALIDATE'
				})
			],
			outcome: 'unavailable'
		});

		const missingEvidence = vi
			.spyOn(semanticValidation, 'validateStaticSemanticSnapshotWithBudgetEvidence')
			.mockReturnValue({
				evidence: null,
				validation: { issues: [] as const, state: 'VALID' }
			} as never);
		let missingEvidenceOutcome;
		try {
			missingEvidenceOutcome = buildStaticSemanticSnapshot(request, { subject });
		} finally {
			missingEvidence.mockRestore();
		}
		expect(missingEvidenceOutcome).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'SEMANTIC_VALIDATION_FAILED',
					message: expect.stringContaining('validator-owned budget evidence'),
					phase: 'VALIDATE'
				})
			],
			outcome: 'unavailable'
		});
	});
});
