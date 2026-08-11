import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type SemanticBudgets,
	type SemanticDiagnosticMessage,
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
import { buildStaticSemanticSnapshot, collectStaticDiagnosticFamily } from './build-static-semantic-snapshot.js';
import { attachFrozenSubjectBytes, readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import { validateStaticSemanticSnapshot } from './validate-snapshot.js';

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
	json(root, 'package.json', { name: 'semantic-builder-fixture', private: true, workspaces: ['packages/*'] });
	json(root, 'packages/demo/package.json', { name: '@fixture/demo', private: true, version: '0.0.0' });
	json(root, 'packages/demo/tsconfig.json', {
		compilerOptions: { module: 'ESNext', noEmit: true, noLib: true, strict: true, target: 'ES2022' },
		files: ['src/index.ts']
	});
	write(root, 'packages/demo/src/index.ts', [
		'/** A callable fixture. */',
		'export function twice(value: number): number { return value * 2; }',
		'export const answer = twice(21);',
		'let mutable = 1;',
		'mutable += answer;',
		'export const text = `answer:${answer}`;',
		''
	].join('\n'));
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function referencedFixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-semantic-references-'));
	temporaryRoots.push(root);
	json(root, 'package.json', { name: 'semantic-reference-fixture', private: true, workspaces: ['packages/*'] });
	json(root, 'packages/base/package.json', { name: '@fixture/base', private: true, version: '0.0.0' });
	json(root, 'packages/base/tsconfig.json', {
		compilerOptions: { composite: true, declaration: true, module: 'ESNext', noEmit: true, noLib: true, strict: true, target: 'ES2022' },
		files: ['src/index.ts']
	});
	write(root, 'packages/base/src/index.ts', 'export const base = 7 as const;\n');
	json(root, 'packages/app/package.json', { name: '@fixture/app', private: true, version: '0.0.0' });
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
	write(root, 'packages/app/src/index.ts', "import { base } from '@fixture/base';\nexport const result = base + 1;\n");
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function subjectRequest(root: string, projects: readonly string[] = ['packages/demo/tsconfig.json']): ResolveSubjectRequest {
	return {
		budgets: { maxBytes: 32 * 1024 * 1024, maxConfigDepth: 32, maxDiagnostics: 1_000, maxDurationMs: 30_000, maxFiles: 10_000, maxProjects: 10 },
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

function semanticRequest(root: string, subjectId: string, budgetOverrides: Partial<SemanticBudgets> = {}): BuildStaticSemanticSnapshotRequest {
	return {
		budgets: {
			maxAstDepth: 256,
			maxAstNodes: 100_000,
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
			maxSnapshotBytes: 32 * 1024 * 1024,
			maxSources: 10_000,
			...budgetOverrides
		},
		capabilities: ['TS_PROJECT', 'TS_SYNTAX'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: root,
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId
	};
}

function diagnosticMessageCharacters(message: SemanticDiagnosticMessage): number {
	return message.textLength + message.next.reduce((total, next) => total + diagnosticMessageCharacters(next), 0);
}

function diagnosticCharactersByProject(snapshot: StaticSemanticSnapshot): ReadonlyMap<string, number> {
	const counts = new Map<string, number>();
	for (const diagnostic of snapshot.diagnostics) {
		const perOccurrence = diagnosticMessageCharacters(diagnostic.message)
			+ diagnostic.related.reduce((total, related) => total + diagnosticMessageCharacters(related.message), 0);
		counts.set(diagnostic.projectId, (counts.get(diagnostic.projectId) ?? 0) + perOccurrence * diagnostic.multiplicity);
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
	attachFrozenSubjectBytes(clone, new Map(subject.artifacts.flatMap((artifact) => {
		if (omitted.has(artifact.path)) return [];
		const bytes = readFrozenSubjectArtifact(subject, artifact.path);
		return bytes === undefined ? [] : [[artifact.path, bytes] as const];
	})));
	return clone;
}

function reviseRecipe(recipe: ProgramRecipe, overrides: Partial<Omit<ProgramRecipe, 'projectResolutionDigest'>>): ProgramRecipe {
	const { projectResolutionDigest: _digest, ...base } = recipe;
	const revised = { ...base, ...overrides };
	return { ...revised, projectResolutionDigest: programRecipeDigest(revised) };
}

function withProjectRecipe(subject: FrozenSubject, revise: (recipe: ProgramRecipe) => ProgramRecipe): FrozenSubject {
	return cloneSubjectCapability(subject, {
		projects: subject.projects.map((project, index) => index === 0 ? { ...project, programRecipe: revise(project.programRecipe) } : project)
	});
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('buildStaticSemanticSnapshot', () => {
	it('represents an isolated compiler diagnostic-family failure as bounded coverage', () => {
		expect(collectStaticDiagnosticFamily('SEMANTIC', () => [], () => undefined)).toEqual({
			diagnostics: [],
			family: 'SEMANTIC',
			reason: 'Family ran and returned zero diagnostics.',
			state: 'RUN'
		});
		expect(collectStaticDiagnosticFamily('SEMANTIC', () => { throw new Error('provider failure'); }, () => undefined)).toEqual({
			diagnostics: [],
			family: 'SEMANTIC',
			reason: 'SEMANTIC diagnostic execution failed without usable results.',
			state: 'FAILED'
		});
	});

	it('constructs, rechecks, replays, validates, and freezes a deterministic real-Program snapshot', () => {
		const root = fixture();
		const subject = resolved(root);
		const request = semanticRequest(root, subject.descriptor.subjectId);
		const first = buildStaticSemanticSnapshot(request, { subject });
		expect(first.outcome, JSON.stringify(first)).toBe('complete');
		if (first.outcome !== 'complete') throw new Error(JSON.stringify(first));
		expect(validateStaticSemanticSnapshot(first.snapshot, {}, { frozenSubject: subject })).toEqual({ issues: [], state: 'VALID' });
		expect(first.snapshot.projects).toHaveLength(1);
		expect(first.snapshot.sources.some((source) => source.analysisDisposition === 'DEEP_INDEXED')).toBe(true);
		expect(first.snapshot.astNodes.length).toBeGreaterThan(1);
		expect(first.snapshot.declarationCandidates.length).toBeGreaterThan(0);
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

	it('rejects unsupported capabilities and accessor-bearing requests without touching accessors', () => {
		const root = fixture();
		const subject = resolved(root);
		const unsupported = { ...semanticRequest(root, subject.descriptor.subjectId), capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] };
		expect(buildStaticSemanticSnapshot(unsupported, { subject })).toMatchObject({ outcome: 'incompatible', diagnostics: [expect.objectContaining({ code: 'CAPABILITY_UNSUPPORTED' })] });

		let accesses = 0;
		const hostile = Object.create(null) as Record<string, unknown>;
		Object.defineProperty(hostile, 'schemaVersion', { enumerable: true, get() { accesses += 1; return SEMANTIC_REQUEST_SCHEMA_VERSION; } });
		expect(buildStaticSemanticSnapshot(hostile, { subject })).toMatchObject({ outcome: 'incompatible' });
		expect(accesses).toBe(0);

		const forgedSubject = Object.create(null) as Record<string, unknown>;
		Object.defineProperty(forgedSubject, 'descriptor', { enumerable: true, get() { accesses += 1; throw new Error('must not execute'); } });
		expect(buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId), { subject: forgedSubject as never })).toMatchObject({ outcome: 'incompatible' });
		expect(accesses).toBe(0);
	});

	it('rejects non-plain, expanded, sparse, cyclic, proxied, and non-finite request data at the request boundary', () => {
		const root = fixture();
		const subject = resolved(root);
		const base = semanticRequest(root, subject.descriptor.subjectId);
		let traps = 0;
		const trap = (): never => { traps += 1; throw new TypeError('request trap executed'); };
		const proxied = new Proxy(base, { get: trap, getOwnPropertyDescriptor: trap, getPrototypeOf: trap, ownKeys: trap });
		const inherited = Object.assign(Object.create({ inherited: true }), base);
		const symbolExpanded = { ...base, [Symbol('expanded')]: true };
		const fieldExpanded = { ...base, unexpected: true };
		const sparseCapabilities = new Array(2) as unknown[];
		sparseCapabilities[0] = 'TS_PROJECT';
		const expandedCapabilities = ['TS_PROJECT', 'TS_SYNTAX'] as string[] & { extra?: boolean };
		expandedCapabilities.extra = true;
		const cyclicCapabilities: unknown[] = ['TS_PROJECT'];
		cyclicCapabilities.push(cyclicCapabilities);
		const accessorCapabilities = ['TS_PROJECT', 'TS_SYNTAX'];
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
			{ ...base, budgets: { ...base.budgets, maxAstNodes: Number.POSITIVE_INFINITY } },
			{ ...base, budgets: { ...base.budgets, maxAstNodes: Number.MAX_SAFE_INTEGER + 1 } },
			{ ...base, expectEmpty: 'false' },
			{ ...base, rootLocator: 'relative/repository' },
			{ ...base, subjectId: 'not-a-digest' }
		];

		for (const invalid of invalidRequests) {
			expect(buildStaticSemanticSnapshot(invalid, { subject })).toMatchObject({
				diagnostics: [expect.objectContaining({ code: 'SEMANTIC_VALIDATION_FAILED', phase: 'REQUEST' })],
				outcome: 'incompatible'
			});
		}
		expect(traps).toBe(0);
	});

	it('emits no snapshot when the supplied FrozenSubject has become stale', () => {
		const root = fixture();
		const subject = resolved(root);
		write(root, 'packages/demo/src/index.ts', 'export const changed = true;\n');
		const outcome = buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId), { subject });
		expect(outcome).toMatchObject({ outcome: 'unavailable' });
		expect('snapshot' in outcome).toBe(false);
	});

	it('reproduces referenced projects and path-mapped compiler options from frozen recipes', () => {
		const root = referencedFixture();
		const subject = resolved(root, ['packages/app/tsconfig.json']);
		expect(subject.projects.map((project) => project.configPath)).toEqual([
			'packages/app/tsconfig.json',
			'packages/base/tsconfig.json'
		]);
		const outcome = buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId), { subject });
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('complete');
		if (outcome.outcome !== 'complete') throw new Error(JSON.stringify(outcome));
		expect(validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject: subject })).toEqual({ issues: [], state: 'VALID' });
		expect(outcome.snapshot.projects).toHaveLength(2);
		expect(outcome.snapshot.programs).toHaveLength(2);
		expect(diagnosticCharactersByProject(outcome.snapshot).size).toBe(2);
		expect(outcome.snapshot.projects.find((project) => project.configPath === 'packages/app/tsconfig.json')?.projectReferences).toEqual(['packages/base/tsconfig.json']);
		expect(outcome.snapshot.sources.some((source) => source.logicalPath === 'packages/base/src/index.ts')).toBe(true);
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
		expect(baseline.snapshot.projects[0]?.programRecipe.compilerOptions).toMatchObject({ rootDirs: ['packages/demo/generated', 'packages/demo/src'] });

		const original = subject.projects[0]!.programRecipe;
		const probes: readonly { message: string; subject: FrozenSubject }[] = [
			{
				message: 'roots do not reproduce',
				subject: withProjectRecipe(subject, (recipe) => reviseRecipe(recipe, { rootNames: [] }))
			},
			{
				message: 'references do not reproduce',
				subject: withProjectRecipe(subject, (recipe) => reviseRecipe(recipe, { projectReferences: ['packages/demo/missing-reference.json'] }))
			},
			{
				message: 'mismatched keys: strict',
				subject: withProjectRecipe(subject, (recipe) => reviseRecipe(recipe, { compilerOptions: { ...recipe.compilerOptions, strict: false } }))
			},
			{
				message: 'could not reproduce parsed configuration',
				subject: withProjectRecipe(subject, (recipe) => reviseRecipe(recipe, {
					compilerOptions: { ...recipe.compilerOptions, configFilePath: 'packages/demo/missing-config.json' },
					configPath: 'packages/demo/missing-config.json'
				}))
			}
		];
		for (const probe of probes) {
			const outcome = buildStaticSemanticSnapshot(request, { subject: probe.subject });
			expect(outcome).toMatchObject({
				diagnostics: [expect.objectContaining({ code: 'PROGRAM_RECIPE_MISMATCH', message: expect.stringContaining(probe.message), phase: 'PROGRAM' })],
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
		symlinkSync(outside, join(root, 'node_modules/escape'), process.platform === 'win32' ? 'junction' : 'dir');
		const subject = resolved(root);
		const request = semanticRequest(root, subject.descriptor.subjectId);
		const original = subject.projects[0]!.programRecipe;

		const invalidDigest = withProjectRecipe(subject, (recipe) => ({ ...recipe, projectResolutionDigest: 'not-a-digest' }));
		expect(buildStaticSemanticSnapshot(request, { subject: invalidDigest })).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'PROGRAM_RECIPE_MISMATCH', phase: 'MATERIALIZE' })],
			outcome: 'incompatible'
		});

		const escaping = withProjectRecipe(subject, (recipe) => reviseRecipe(recipe, { rootNames: ['node_modules/escape/outside.ts'] }));
		expect(buildStaticSemanticSnapshot(request, { subject: escaping })).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'COMPILER_CONTEXT_FORBIDDEN', phase: 'MATERIALIZE' })],
			outcome: 'unavailable'
		});

		const nonFiniteOptions = { ...original.compilerOptions, maxNodeModuleJsDepth: Number.POSITIVE_INFINITY };
		const nonFinite = withProjectRecipe(subject, (recipe) => ({ ...recipe, compilerOptions: nonFiniteOptions }));
		expect(buildStaticSemanticSnapshot(request, { subject: nonFinite })).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'PROGRAM_RECIPE_MISMATCH', phase: 'MATERIALIZE' })],
			outcome: 'incompatible'
		});

		const cyclicOptions = { ...original.compilerOptions } as Record<string, unknown>;
		cyclicOptions.strict = cyclicOptions;
		const cyclic = withProjectRecipe(subject, (recipe) => ({ ...recipe, compilerOptions: cyclicOptions } as ProgramRecipe));
		expect(buildStaticSemanticSnapshot(request, { subject: cyclic })).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'PROGRAM_RECIPE_MISMATCH', phase: 'MATERIALIZE' })],
			outcome: 'incompatible'
		});

		const missingBytes = cloneSubjectCapability(subject, {}, ['packages/demo/src/index.ts']);
		expect(buildStaticSemanticSnapshot(request, { subject: missingBytes })).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'FROZEN_BYTES_UNAVAILABLE', phase: 'PROGRAM' })],
			outcome: 'unavailable'
		});
	});

	it('returns an honestly partial snapshot for retained unsupported framework syntax', () => {
		const root = fixture();
		write(root, 'packages/demo/src/View.svelte', '<script lang="ts">export let value: number;</script>\n');
		const subject = resolved(root);
		const outcome = buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId), { subject });
		expect(outcome.outcome, JSON.stringify(outcome)).toBe('partial');
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(validateStaticSemanticSnapshot(outcome.snapshot, {}, { frozenSubject: subject })).toEqual({ issues: [], state: 'VALID' });
		expect(outcome.snapshot.capabilities.find((capability) => capability.capability === 'TS_PROJECT')?.state).toBe('SUPPORTED');
		expect(outcome.snapshot.capabilities.find((capability) => capability.capability === 'TS_SYNTAX')?.state).toBe('PARTIAL');
		expect(outcome.snapshot.projects[0]?.frameworkCandidates).toContain('packages/demo/src/View.svelte');
		expect(outcome.diagnostics).toContainEqual(expect.objectContaining({ code: 'CAPABILITY_UNSUPPORTED', severity: 'WARNING' }));
	});

	it('fails closed without a snapshot when semantic extraction exceeds a requested budget', () => {
		const root = fixture();
		const subject = resolved(root);
		const outcome = buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId, { maxAstNodes: 1 }), { subject });
		expect(outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SEMANTIC_BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});
		expect('snapshot' in outcome).toBe(false);
	});

	it('accepts exact semantic record ceilings without confusing validator traversal with domain populations', () => {
		const root = fixture();
		const subject = resolved(root);
		const initial = buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId), { subject });
		expect(initial.outcome, JSON.stringify(initial)).toBe('complete');
		if (initial.outcome !== 'complete') throw new Error(JSON.stringify(initial));
		const exact = buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId, {
			maxAstNodes: initial.snapshot.astNodes.length,
			maxCompilerQueries: initial.snapshot.compilerInputs.length,
			maxSources: initial.snapshot.sources.length
		}), { subject });
		expect(exact.outcome, JSON.stringify(exact)).toBe('complete');
	});

	it('reports snapshot byte exhaustion as a budget refusal rather than validator failure', () => {
		const root = fixture();
		const subject = resolved(root);
		const outcome = buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId, { maxSnapshotBytes: 100 }), { subject });
		expect(outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SEMANTIC_BUDGET_EXCEEDED', phase: 'VALIDATE' })],
			outcome: 'unavailable'
		});
		expect('snapshot' in outcome).toBe(false);
	});

	it('enforces diagnostic-character ceilings across the whole multi-project snapshot', () => {
		const root = referencedFixture();
		const subject = resolved(root, ['packages/app/tsconfig.json']);
		const initial = buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId), { subject });
		expect(initial.outcome, JSON.stringify(initial)).toBe('complete');
		if (initial.outcome !== 'complete') throw new Error(JSON.stringify(initial));
		const byProject = diagnosticCharactersByProject(initial.snapshot);
		expect(byProject.size).toBe(2);
		const total = [...byProject.values()].reduce((sum, value) => sum + value, 0);
		const largestProject = Math.max(...byProject.values());
		expect(total).toBeGreaterThan(largestProject);
		const outcome = buildStaticSemanticSnapshot(semanticRequest(root, subject.descriptor.subjectId, { maxDiagnosticCharacters: total - 1 }), { subject });
		expect(outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'SEMANTIC_BUDGET_EXCEEDED' })],
			outcome: 'unavailable'
		});
		expect('snapshot' in outcome).toBe(false);
	});
});
