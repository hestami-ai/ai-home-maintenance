import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	utimesSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION,
	GENERATED_CONTEXT_SVELTE_KIT_SYNC_GENERATOR_ID,
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type GeneratedContextExecutionManifest,
	type ResolveSubjectRequest
} from '../contracts/subject.js';
import { collectInventory } from '../inventory/collect-inventory.js';
import { canonicalJson, compareText, sha256 } from '../inventory/canonical.js';
import { projectSubjectForInventory } from '../inventory/project-subject-for-inventory.js';
import { renderInventoryMarkdown } from '../inventory/render-inventory.js';
import { classifyArtifact } from './artifacts.js';
import { captureSubject } from './capture.js';
import type { SubjectCapture } from './capture-model.js';
import {
	assessGeneratedContextFreshness,
	createGeneratedContextEvidenceRecord
} from './generated-context.js';
import { readFrozenSubjectArtifact } from './frozen-store.js';
import {
	assertCanonicalRelativePath,
	assertNoCanonicalPathCollisions,
	assertSafeExistingPath,
	canonicalPathKey,
	repositoryRelativePath,
	resolveRepositoryRoot
} from './paths.js';
import {
	globMatches,
	isRequestedPath,
	sensitiveOrLocalStateExclusion,
	subjectFilterPolicyId,
	validateBoundedPattern
} from './policy.js';
import {
	discoverProjects,
	ProjectDiscoveryFailure,
	recordProjectDirectoryQueries
} from './projects.js';
import { resolveSubject } from './resolve-subject.js';
import { verifyFrozenSubject } from './freshness.js';
import { generatedContextExecutionManifestDigest } from './svelte-kit-execution-closure.js';
import {
	discoverTestPopulations,
	JPWB_VITEST_PROJECT_DISCOVERY_SYNTAX_DIGEST,
	vitestProjectDiscoverySyntaxDigest
} from './test-populations.js';
import { discoverWorkspaces, WorkspaceDiscoveryFailure } from './workspaces.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const temporaryRoots: string[] = [];

function write(root: string, path: string, content: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-subject-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'subject-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/demo',
		private: true,
		version: '0.0.0'
	});
	write(root, 'packages/demo/src/index.ts', 'export const value = 1;\n');
	write(
		root,
		'packages/demo/tsconfig.json',
		'{ // JSONC\n "compilerOptions": { "strict": true },\n "include": ["src"]\n}\n'
	);
	json(root, 'tsconfig.json', { files: [], include: [] });
	write(root, 'bun.lock', 'fixture lock\n');
	return root;
}

function copyRepositoryFile(root: string, path: string): void {
	write(root, path, readFileSync(join(REPOSITORY_ROOT, ...path.split('/')), 'utf8'));
}

function testPopulationFixture(): string {
	const root = fixture();
	const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<
		string,
		unknown
	>;
	manifest.workspaces = ['packages/*', 'apps/*'];
	json(root, 'package.json', manifest);
	json(root, 'apps/demo/package.json', { name: '@fixture/app', private: true });
	json(root, 'apps/demo/tsconfig.json', { include: ['src'] });
	write(root, 'packages/demo/src/value.test.ts', 'export const packageTest = true;\n');
	write(root, 'apps/demo/src/view.test.ts', 'export const appTest = true;\n');
	write(root, 'verif/proof.test.ts', 'export const verificationTest = true;\n');
	write(root, 'docs/other.test.ts', 'export const unconfiguredTest = true;\n');
	copyRepositoryFile(root, 'vitest.config.ts');
	copyRepositoryFile(root, 'vitest.dist.config.ts');
	copyRepositoryFile(root, 'vitest.projects.ts');
	write(
		root,
		'apps/demo/playwright.config.ts',
		"import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: './scenarios', testMatch: '**/*.journey.ts' });\n"
	);
	write(
		root,
		'apps/demo/playwright.live.config.ts',
		"import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: './e2e-live', testMatch: '**/*.live.ts' });\n"
	);
	write(root, 'apps/demo/scenarios/first.journey.ts', 'export const journey = true;\n');
	write(root, 'apps/demo/scenarios/support.ts', 'export const support = true;\n');
	write(root, 'apps/demo/e2e-live/network.live.ts', 'export const live = true;\n');
	return root;
}

function request(
	root: string,
	overrides: Partial<ResolveSubjectRequest> = {}
): ResolveSubjectRequest {
	return {
		budgets: {
			maxBytes: 32 * 1024 * 1024,
			maxConfigDepth: 32,
			maxDiagnostics: 100,
			maxDurationMs: 30_000,
			maxFiles: 10_000,
			maxProjects: 100
		},
		filters: { exclude: [], include: [] },
		operationVersion: 'subject-test/1',
		outputs: [],
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: root,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'REPOSITORY' },
		subjectKind: 'WORKTREE',
		...overrides
	};
}

function resolved(root: string, overrides: Partial<ResolveSubjectRequest> = {}) {
	const outcome = resolveSubject(request(root, overrides));
	if (outcome.outcome !== 'resolved') throw new Error(JSON.stringify(outcome));
	return outcome;
}

function outcomeArtifact(subject: ReturnType<typeof resolved>['subject'], path: string) {
	return subject.artifacts.find((artifact) => artifact.path === path);
}

function workspaceCapture(
	files: Readonly<Record<string, string>>,
	directoryPaths: readonly string[] = []
): SubjectCapture {
	return {
		artifacts: [],
		bytesByPath: new Map(
			Object.entries(files).map(([path, contents]) => [path, new TextEncoder().encode(contents)])
		),
		diagnostics: [],
		directoryPaths,
		discoveredArtifactCount: Object.keys(files).length,
		excludedArtifacts: [],
		fingerprints: new Map(),
		realRoot: 'C:/workspace-fixture',
		typescriptDirectoryRecordings: new Map()
	};
}

function workspaceFailure(capture: SubjectCapture): WorkspaceDiscoveryFailure {
	try {
		discoverWorkspaces(capture);
		throw new Error('Expected workspace discovery to fail.');
	} catch (error) {
		expect(error).toBeInstanceOf(WorkspaceDiscoveryFailure);
		return error as WorkspaceDiscoveryFailure;
	}
}

function projectFailure(run: () => unknown): ProjectDiscoveryFailure {
	try {
		run();
		throw new Error('Expected project discovery to fail.');
	} catch (error) {
		expect(error).toBeInstanceOf(ProjectDiscoveryFailure);
		return error as ProjectDiscoveryFailure;
	}
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('repository path and artifact policy', () => {
	it('keeps display case, applies injected case rules, and rejects dot/backslash/collisions', () => {
		expect(canonicalPathKey('Packages/Demo.ts', false)).toBe('packages/demo.ts');
		expect(canonicalPathKey('Packages/Demo.ts', true)).toBe('Packages/Demo.ts');
		expect(assertCanonicalRelativePath('packages/demo.ts')).toBe('packages/demo.ts');
		expect(() => assertCanonicalRelativePath('packages\\demo.ts')).toThrow('Non-canonical');
		expect(() => assertCanonicalRelativePath('packages/./demo.ts')).toThrow('Non-canonical');
		expect(() => assertCanonicalRelativePath('../demo.ts')).toThrow('Non-canonical');
		expect(() => assertNoCanonicalPathCollisions(['Src/A.ts', 'src/a.ts'], false)).toThrow(
			'collision'
		);
		expect(() => assertNoCanonicalPathCollisions(['Src/A.ts', 'src/a.ts'], true)).not.toThrow();
	});

	it('fails closed across repository-root, physical-path, glob, and sensitive-state boundaries', () => {
		const root = fixture();
		const outside = mkdtempSync(join(tmpdir(), 'csaa-path-outside-'));
		temporaryRoots.push(outside);

		expect(() => resolveRepositoryRoot('relative/root')).toThrow('must be absolute');
		expect(() => resolveRepositoryRoot(join(root, 'package.json'))).toThrow('not a directory');
		expect(() => repositoryRelativePath(root, outside)).toThrow('escapes repository root');
		const escape = join(root, 'physical-escape');
		symlinkSync(outside, escape, process.platform === 'win32' ? 'junction' : 'dir');
		expect(() => assertSafeExistingPath(root, 'physical-escape')).toThrow(
			'escapes repository root'
		);
		expect(() => assertNoCanonicalPathCollisions(['src/index.ts', 'src/index.ts'], true)).toThrow(
			'Duplicate repository path'
		);

		for (const pattern of ['', '\\absolute', '/absolute', 'src/[name].ts']) {
			expect(() => validateBoundedPattern(pattern)).toThrow();
		}
		expect(globMatches('packages/demo/src/index.ts', '**/*.ts')).toBe(true);
		expect(globMatches('packages/demo/src/index.ts', 'packages/?emo/**')).toBe(true);
		expect(
			isRequestedPath(
				'packages/demo/src/index.ts',
				request(root, {
					filters: { exclude: ['**/index.ts'], include: ['**/*.ts'] }
				})
			)
		).toBe(false);
		expect(
			sensitiveOrLocalStateExclusion('packages/demo/vite.config.ts.timestamp-123')
		).toMatchObject({ policyId: 'jan-csaa-exclude-local-state/1' });
		expect(sensitiveOrLocalStateExclusion('packages/demo/.env.local')).toMatchObject({
			reason: 'Environment/secrets files are never ingested.'
		});
		expect(sensitiveOrLocalStateExclusion('packages/demo/client-credentials.json')).toMatchObject({
			reason: 'Credential or private-key material is never ingested.'
		});
		expect(sensitiveOrLocalStateExclusion('apps/rph-demo/harness/session.json')).toMatchObject({
			primaryClass: 'CACHE'
		});
	});

	it('classifies tests, source-bearing JSON, generated outputs, framework candidates, and authored tmp files truthfully', () => {
		expect(classifyArtifact('apps/demo/e2e/journey.ts')).toMatchObject({
			primaryClass: 'TEST_SOURCE',
			roles: expect.arrayContaining(['TEST'])
		});
		expect(classifyArtifact('apps/demo/e2e-live/journey.live.ts')).toMatchObject({
			primaryClass: 'TEST_SOURCE',
			roles: expect.arrayContaining(['TEST'])
		});
		expect(classifyArtifact('packages/demo/src/connection.live.ts')).toMatchObject({
			primaryClass: 'PRODUCTION_SOURCE',
			roles: expect.not.arrayContaining(['TEST'])
		});
		expect(classifyArtifact('verif/proof.test.ts')).toMatchObject({
			primaryClass: 'VERIFICATION',
			roles: expect.arrayContaining(['TEST', 'VERIFICATION'])
		});
		expect(classifyArtifact('packages/demo/src/gen/gen-schema.ts')).toMatchObject({
			primaryClass: 'GENERATOR_SOURCE',
			roles: expect.arrayContaining(['GENERATOR'])
		});
		expect(
			classifyArtifact('packages/demo/src/schema.ts', '// GENERATED FILE — do not edit.\n')
		).toMatchObject({
			primaryClass: 'GENERATED_SOURCE',
			roles: expect.arrayContaining(['GENERATED'])
		});
		expect(classifyArtifact('apps/demo/src/Page.svelte')).toMatchObject({
			disposition: 'INVENTORY_ONLY',
			roles: expect.arrayContaining(['FRAMEWORK_CANDIDATE'])
		});
		expect(classifyArtifact('vitest.config.ts')).toMatchObject({
			primaryClass: 'TOOL_CONFIGURATION',
			roles: expect.arrayContaining(['COMPILER_CANDIDATE', 'CONFIGURATION'])
		});
		expect(classifyArtifact('apps/demo/playwright.config.ts')).toMatchObject({
			primaryClass: 'TOOL_CONFIGURATION',
			roles: expect.arrayContaining(['COMPILER_CANDIDATE', 'CONFIGURATION'])
		});
		expect(classifyArtifact('packages/csaa/src/subject/svelte-kit-generator.ts')).toMatchObject({
			primaryClass: 'PRODUCTION_SOURCE',
			roles: expect.arrayContaining(['COMPILER_CANDIDATE', 'PRODUCTION'])
		});
		expect(
			classifyArtifact('verif/csaa/rph-demo.svelte-kit.generated-context.evidence.json')
		).toMatchObject({
			disposition: 'ANALYZED',
			primaryClass: 'VERIFICATION',
			roles: expect.arrayContaining(['ANALYSIS_INPUT', 'VERIFICATION'])
		});
		expect(classifyArtifact('scripts/csaa-generated-context.ts')).toMatchObject({
			primaryClass: 'GENERATOR_SOURCE',
			roles: expect.arrayContaining(['GENERATOR', 'SCRIPT'])
		});
		expect(
			classifyArtifact(
				'packages/csaa/src/providers/dependency-cruiser/schema/cruise-result-16.10.4.schema.json'
			)
		).toMatchObject({
			disposition: 'ANALYZED',
			primaryClass: 'PRODUCTION_SOURCE',
			roles: expect.arrayContaining(['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION'])
		});
		for (const path of [
			'packages/demo/src/gen/schema.json',
			'packages/demo/src/generated/schema.json',
			'packages/demo/src/schema.generated.json'
		]) {
			expect(classifyArtifact(path)).toMatchObject({
				disposition: 'ANALYZED',
				primaryClass: 'GENERATED_SOURCE',
				roles: expect.arrayContaining(['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'GENERATED'])
			});
		}
		expect(classifyArtifact('packages/demo/schemas/schema.json')).toMatchObject({
			disposition: 'INVENTORY_ONLY',
			primaryClass: 'OTHER',
			roles: []
		});
		expect(classifyArtifact('packages/demo/src/foo.tmp')).toMatchObject({
			disposition: 'INVENTORY_ONLY',
			primaryClass: 'OTHER'
		});
	});

	it('rejects invalid filters, outputs, scopes, versions, and budgets without leaking the root', () => {
		const root = fixture();
		for (const invalid of [
			{ filters: { include: ['../outside/**'], exclude: [] } },
			{ outputs: ['packages/demo/*.json'] },
			{ scope: { kind: 'EXPLICIT_PROJECTS', projects: [] } },
			{ operationVersion: '' },
			{ budgets: { ...request(root).budgets, maxFiles: 0 } }
		] as Partial<ResolveSubjectRequest>[]) {
			const outcome = resolveSubject(request(root, invalid));
			expect(outcome.outcome).toBe('forbidden');
			expect(JSON.stringify(outcome)).not.toContain(root);
		}
	});

	it('maps unsupported envelopes, invalid roots, root-manifest failures, and exclusion-budget exhaustion exactly', () => {
		const root = fixture();
		const unsupported = {
			...request(root),
			schemaVersion:
				'jan-csaa-subject-request/unsupported' as ResolveSubjectRequest['schemaVersion']
		};
		expect(resolveSubject(unsupported)).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'UNSUPPORTED_REQUEST_VERSION', phase: 'CAPTURE' })
			],
			outcome: 'incompatible'
		});

		const invalidRoot = resolveSubject(request(join(root, 'package.json')));
		expect(invalidRoot).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'REPOSITORY_ROOT_INVALID', phase: 'CAPTURE' })],
			outcome: 'not-found'
		});
		expect(JSON.stringify(invalidRoot)).not.toContain(root.replaceAll('\\', '/'));

		const missingManifest = mkdtempSync(join(tmpdir(), 'csaa-missing-manifest-'));
		temporaryRoots.push(missingManifest);
		expect(resolveSubject(request(missingManifest))).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'CONFIG_REQUIRED_MISSING', path: 'package.json' })
			],
			outcome: 'not-found'
		});

		const malformedManifest = mkdtempSync(join(tmpdir(), 'csaa-malformed-manifest-'));
		temporaryRoots.push(malformedManifest);
		write(malformedManifest, 'package.json', '{ malformed');
		expect(resolveSubject(request(malformedManifest))).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'CONFIG_MALFORMED', path: 'package.json' })],
			outcome: 'incompatible'
		});

		const exclusionBudget = resolveSubject(
			request(root, {
				budgets: { ...request(root).budgets, maxFiles: 1 },
				outputs: ['packages/demo/first.out', 'packages/demo/second.out']
			})
		);
		expect(exclusionBudget).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'BUDGET_EXCEEDED',
					message: 'Subject capture exceeded its file budget.'
				})
			],
			outcome: 'unavailable'
		});
	});
});

describe('configured test population discovery', () => {
	function discovered(root: string) {
		return discoverTestPopulations(captureSubject(request(root)));
	}

	it('derives exact source, artifact, deterministic, and live selections from captured configuration', () => {
		const result = discovered(testPopulationFixture());
		const source = result.populations.find(
			(population) => population.provider === 'VITEST' && population.profile === 'SOURCE'
		)!;
		const dist = result.populations.find(
			(population) => population.provider === 'VITEST' && population.profile === 'DIST'
		)!;
		expect(source).toMatchObject({
			populationClosure: 'CLOSED_FOR_CAPTURED_TEST_ARTIFACTS',
			reconciles: true,
			status: 'COMPLETE'
		});
		expect(source.includedPaths).toEqual([
			'apps/demo/src/view.test.ts',
			'packages/demo/src/value.test.ts',
			'verif/proof.test.ts'
		]);
		expect(dist.includedPaths).toEqual(source.includedPaths);
		expect(source.excludedPaths).toContain('apps/demo/e2e-live/network.live.ts');

		const deterministic = result.populations.find(
			(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'DETERMINISTIC'
		)!;
		const live = result.populations.find(
			(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'LIVE'
		)!;
		expect(deterministic).toMatchObject({
			includedPaths: ['apps/demo/scenarios/first.journey.ts'],
			status: 'COMPLETE'
		});
		expect(live).toMatchObject({
			includedPaths: ['apps/demo/e2e-live/network.live.ts'],
			status: 'COMPLETE'
		});
	});

	it('binds discovered populations and partial diagnostics into repository and explicit-project subjects', () => {
		const root = testPopulationFixture();
		const repository = resolved(root);
		expect(repository.subject.testPopulations).toHaveLength(4);
		expect(
			repository.subject.testPopulations.every((population) => population.status === 'COMPLETE')
		).toBe(true);
		const scoped = resolved(root, {
			scope: { kind: 'EXPLICIT_PROJECTS', projects: ['apps/demo/tsconfig.json'] }
		});
		expect(
			scoped.subject.testPopulations.find(
				(population) =>
					population.provider === 'PLAYWRIGHT' && population.profile === 'DETERMINISTIC'
			)
		).toMatchObject({
			includedPaths: ['apps/demo/scenarios/first.journey.ts'],
			status: 'COMPLETE'
		});
		expect(
			scoped.subject.testPopulations.find(
				(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'LIVE'
			)
		).toMatchObject({
			includedPaths: ['apps/demo/e2e-live/network.live.ts'],
			status: 'COMPLETE'
		});

		write(
			root,
			'apps/demo/playwright.config.ts',
			"import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: './scenarios', testMatch: '**/*.{journey,spec}.ts' });\n"
		);
		const partial = resolved(root);
		expect(partial.completeness).toBe('PARTIAL');
		expect(partial.diagnostics).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'TEST_POPULATION_PARTIAL' })])
		);
	});

	it('pins the JPWB dynamic Vitest discovery implementation by semantic tokens', () => {
		const source = readFileSync(join(REPOSITORY_ROOT, 'vitest.projects.ts'), 'utf8');
		expect(vitestProjectDiscoverySyntaxDigest(source)).toBe(
			JPWB_VITEST_PROJECT_DISCOVERY_SYNTAX_DIGEST
		);
		expect(vitestProjectDiscoverySyntaxDigest(`// harmless comment\n${source}`)).toBe(
			JPWB_VITEST_PROJECT_DISCOVERY_SYNTAX_DIGEST
		);
		expect(
			vitestProjectDiscoverySyntaxDigest(source.replace('return n;', 'return n + 1;'))
		).not.toBe(JPWB_VITEST_PROJECT_DISCOVERY_SYNTAX_DIGEST);
	});

	it('fails open for decoy factory calls and changed dynamic workspace discovery', () => {
		const decoyRoot = testPopulationFixture();
		const config = readFileSync(join(decoyRoot, 'vitest.config.ts'), 'utf8');
		write(
			decoyRoot,
			'vitest.config.ts',
			`${config.replace('projects: projectsFor(true)', 'projects: projectsFor(false)')}\nconst decoy = { projects: projectsFor(true) };\n`
		);
		const decoy = discovered(decoyRoot).populations.find(
			(population) => population.provider === 'VITEST' && population.profile === 'SOURCE'
		)!;
		expect(decoy).toMatchObject({
			limitations: expect.arrayContaining(['VITEST_PROJECT_FACTORY_NOT_BOUND_WITH_EXTENDS_TRUE']),
			populationClosure: 'OPEN',
			status: 'PARTIAL'
		});

		const changedFactoryRoot = testPopulationFixture();
		const projects = readFileSync(join(changedFactoryRoot, 'vitest.projects.ts'), 'utf8');
		write(
			changedFactoryRoot,
			'vitest.projects.ts',
			projects.replace(
				"const pkgDir = join(ROOT, 'packages');",
				"return [];\n\tconst pkgDir = join(ROOT, 'packages');"
			)
		);
		const changedFactory = discovered(changedFactoryRoot).populations.find(
			(population) => population.provider === 'VITEST' && population.profile === 'SOURCE'
		)!;
		expect(changedFactory).toMatchObject({
			limitations: expect.arrayContaining(['VITEST_PROJECT_DISCOVERY_IMPLEMENTATION_UNRECOGNIZED']),
			populationClosure: 'OPEN',
			status: 'PARTIAL'
		});

		const fakeDefineConfigRoot = testPopulationFixture();
		const fakeConfig = readFileSync(join(fakeDefineConfigRoot, 'vitest.config.ts'), 'utf8');
		write(
			fakeDefineConfigRoot,
			'vitest.config.ts',
			fakeConfig.replace("from 'vitest/config'", "from 'fixture-vitest/config'")
		);
		const fakeDefineConfig = discovered(fakeDefineConfigRoot).populations.find(
			(population) => population.provider === 'VITEST' && population.profile === 'SOURCE'
		)!;
		expect(fakeDefineConfig).toMatchObject({
			limitations: expect.arrayContaining(['VITEST_DEFINE_CONFIG_EXPORT_NOT_STATIC_AND_UNIQUE']),
			populationClosure: 'OPEN',
			status: 'PARTIAL'
		});

		const typeOnlyProjectsRoot = testPopulationFixture();
		const typeOnlyConfig = readFileSync(join(typeOnlyProjectsRoot, 'vitest.config.ts'), 'utf8');
		write(
			typeOnlyProjectsRoot,
			'vitest.config.ts',
			typeOnlyConfig.replace(
				"import { projectsFor } from './vitest.projects.js';",
				"import type { projectsFor } from './vitest.projects.js';"
			)
		);
		const typeOnlyProjects = discovered(typeOnlyProjectsRoot).populations.find(
			(population) => population.provider === 'VITEST' && population.profile === 'SOURCE'
		)!;
		expect(typeOnlyProjects).toMatchObject({
			limitations: expect.arrayContaining([
				'VITEST_PROJECT_CONFIGURATION_IMPORT_NOT_RESOLVED',
				'VITEST_PROJECT_FACTORY_NOT_BOUND_WITH_EXTENDS_TRUE'
			]),
			populationClosure: 'OPEN',
			status: 'PARTIAL'
		});
	});

	it('changes the resolved selection identity for configured glob and exclusion changes', () => {
		const root = testPopulationFixture();
		const baseline = discovered(root).populations.find(
			(population) => population.provider === 'VITEST' && population.profile === 'SOURCE'
		)!;
		write(root, 'packages/demo/src/value.spec.ts', 'export const packageSpec = true;\n');
		const projects = readFileSync(join(root, 'vitest.projects.ts'), 'utf8');
		write(
			root,
			'vitest.projects.ts',
			projects.replace("include: ['src/**/*.test.ts']", "include: ['src/**/*.spec.ts']")
		);
		const changed = discovered(root).populations.find(
			(population) => population.provider === 'VITEST' && population.profile === 'SOURCE'
		)!;
		expect(changed.selectionDigest).not.toBe(baseline.selectionDigest);
		expect(changed.includedPaths).toContain('packages/demo/src/value.spec.ts');
		expect(changed.includedPaths).not.toContain('packages/demo/src/value.test.ts');
		expect(changed).toMatchObject({
			limitations: expect.arrayContaining(['VITEST_PROJECT_DISCOVERY_IMPLEMENTATION_UNRECOGNIZED']),
			status: 'PARTIAL'
		});
	});

	it('models Playwright ignores and arbitrary profiles while rejecting unsupported or overriding syntax', () => {
		const root = testPopulationFixture();
		write(root, 'apps/demo/scenarios/skip.journey.ts', 'export const skipped = true;\n');
		write(
			root,
			'apps/demo/playwright.config.ts',
			"import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: './scenarios', testMatch: '**/*.journey.ts', testIgnore: '**/skip.journey.ts' });\n"
		);
		write(
			root,
			'playwright.smoke.config.ts',
			"import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: './verif/root-scenarios', testMatch: '**/*.smoke.ts' });\n"
		);
		write(root, 'verif/root-scenarios/root.smoke.ts', 'export const smoke = true;\n');
		const result = discovered(root);
		const deterministic = result.populations.find(
			(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'DETERMINISTIC'
		)!;
		expect(deterministic).toMatchObject({
			excludePatterns: ['apps/demo/scenarios/**/skip.journey.ts'],
			includedPaths: ['apps/demo/scenarios/first.journey.ts'],
			status: 'COMPLETE'
		});
		expect(
			result.populations.find(
				(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'SMOKE'
			)
		).toMatchObject({
			includedPaths: ['verif/root-scenarios/root.smoke.ts'],
			status: 'COMPLETE'
		});

		write(
			root,
			'apps/demo/playwright.config.ts',
			"import { defineConfig } from '@playwright/test';\nconst dynamic = {};\nexport default defineConfig({ testDir: './scenarios', testMatch: '**/*.{journey,spec}.ts', ...dynamic });\n"
		);
		const unsupported = discovered(root).populations.find(
			(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'DETERMINISTIC'
		)!;
		expect(unsupported).toMatchObject({ populationClosure: 'OPEN', status: 'PARTIAL' });

		write(
			root,
			'apps/demo/playwright.config.ts',
			"import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: './scenarios', testMatch: '**/*.journey.ts', projects: [{ name: 'override', testMatch: '**/*.spec.ts' }] });\n"
		);
		const projectOverride = discovered(root).populations.find(
			(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'DETERMINISTIC'
		)!;
		expect(projectOverride).toMatchObject({
			limitations: expect.arrayContaining(['PLAYWRIGHT_PROJECT_SELECTION_OVERRIDE_UNMODELED']),
			populationClosure: 'OPEN',
			status: 'PARTIAL'
		});
	});
});

describe('workspace manifest discovery', () => {
	it('accepts object-form workspace packages and flattens nested export arrays without losing conditions', () => {
		const root = fixture();
		json(root, 'package.json', {
			name: 'subject-fixture',
			private: true,
			workspaces: { packages: ['packages/*'] }
		});
		json(root, 'packages/demo/package.json', {
			exports: {
				'.': [
					{ import: './dist/index.js', types: './dist/index.d.ts' },
					'./dist/fallback.js',
					null
				],
				'./feature': [{ types: './dist/feature.d.ts' }, './dist/feature.js']
			},
			name: '@fixture/demo',
			private: true
		});

		const workspace = resolved(root).subject.workspaces.find(
			(candidate) => candidate.name === '@fixture/demo'
		)!;
		expect(workspace).toMatchObject({
			path: 'packages/demo',
			private: true,
			workspacePatterns: ['packages/*']
		});
		expect(workspace.exports).toHaveLength(6);
		expect(workspace.exports).toEqual(
			expect.arrayContaining([
				{ conditions: ['[0]', 'import'], exportName: '.', target: './dist/index.js' },
				{ conditions: ['[0]', 'types'], exportName: '.', target: './dist/index.d.ts' },
				{ conditions: ['[1]'], exportName: '.', target: './dist/fallback.js' },
				{ conditions: ['[2]'], exportName: '.', target: null },
				{ conditions: ['[0]', 'types'], exportName: './feature', target: './dist/feature.d.ts' },
				{ conditions: ['[1]'], exportName: './feature', target: './dist/feature.js' }
			])
		);
	});

	it('fails each malformed, unsupported, missing, and ambiguous workspace-manifest form at its exact boundary', () => {
		const encoded = (value: unknown): string => JSON.stringify(value);
		const cases: readonly {
			capture: SubjectCapture;
			message: string;
			outcome: WorkspaceDiscoveryFailure['outcome'];
		}[] = [
			{
				capture: workspaceCapture({}),
				message: 'Required captured manifest is absent: package.json',
				outcome: 'not-found'
			},
			{
				capture: workspaceCapture({ 'package.json': '{ malformed' }),
				message: 'Workspace manifest is malformed: package.json',
				outcome: 'incompatible'
			},
			{
				capture: workspaceCapture({ 'package.json': encoded({ workspaces: ['packages/*', 1] }) }),
				message: 'Root workspace patterns must all be strings.',
				outcome: 'incompatible'
			},
			{
				capture: workspaceCapture({ 'package.json': encoded({ workspaces: ['packages/**'] }) }),
				message: 'Unsupported workspace pattern',
				outcome: 'incompatible'
			},
			{
				capture: workspaceCapture({
					'package.json': encoded({ workspaces: { packages: ['packages/*', 1] } })
				}),
				message: 'Root workspace package patterns must all be strings.',
				outcome: 'incompatible'
			},
			{
				capture: workspaceCapture({
					'package.json': encoded({ workspaces: { packages: ['packages/**'] } })
				}),
				message: 'Unsupported workspace pattern',
				outcome: 'incompatible'
			},
			{
				capture: workspaceCapture({ 'package.json': encoded({ workspaces: 'packages/*' }) }),
				message: 'Unsupported root workspaces declaration.',
				outcome: 'incompatible'
			},
			{
				capture: workspaceCapture({ 'package.json': encoded({ workspaces: ['packages/*'] }) }),
				message: 'Workspace pattern has no captured member: packages/*',
				outcome: 'not-found'
			},
			{
				capture: workspaceCapture({ 'package.json': encoded({ workspaces: ['packages/*'] }) }, [
					'packages/demo'
				]),
				message: 'Workspace member has no captured package.json: packages/demo',
				outcome: 'not-found'
			},
			{
				capture: workspaceCapture(
					{
						'package.json': encoded({ workspaces: ['packages/*'] }),
						'packages/demo/package.json': encoded({ name: 'invalid/name/segment', private: true })
					},
					['packages/demo']
				),
				message: 'Workspace manifest has invalid name/private fields',
				outcome: 'incompatible'
			},
			{
				capture: workspaceCapture(
					{
						'package.json': encoded({ workspaces: ['packages/*'] }),
						'packages/a/package.json': encoded({ name: '@fixture/duplicate', private: true }),
						'packages/b/package.json': encoded({ name: '@fixture/duplicate', private: true })
					},
					['packages/a', 'packages/b']
				),
				message: 'Workspace name @fixture/duplicate is ambiguous',
				outcome: 'ambiguous'
			}
		];

		for (const probe of cases) {
			const failure = workspaceFailure(probe.capture);
			expect(failure.outcome).toBe(probe.outcome);
			expect(failure.message).toContain(probe.message);
		}
	});

	it('maps live workspace incompatibility, absence, and ambiguity through the public resolution boundary', () => {
		const malformed = fixture();
		write(malformed, 'packages/demo/package.json', '{ malformed');
		expect(resolveSubject(request(malformed))).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'CONFIG_MALFORMED', phase: 'RESOLVE' })],
			outcome: 'incompatible'
		});

		const missing = fixture();
		write(missing, 'packages/missing/src/index.ts', 'export const missing = true;\n');
		expect(resolveSubject(request(missing))).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'CONFIG_REQUIRED_MISSING', phase: 'RESOLVE' })],
			outcome: 'not-found'
		});

		const ambiguous = fixture();
		json(ambiguous, 'packages/other/package.json', { name: '@fixture/demo', private: true });
		write(ambiguous, 'packages/other/src/index.ts', 'export const other = true;\n');
		expect(resolveSubject(request(ambiguous))).toMatchObject({
			diagnostics: [expect.objectContaining({ code: 'PROJECT_AMBIGUOUS', phase: 'RESOLVE' })],
			outcome: 'ambiguous'
		});
	});
});

describe('captured TypeScript project resolution', () => {
	it('uses JSONC, extends arrays/package specifiers, allowJs, include/exclude, and captured closure bytes', () => {
		const root = fixture();
		json(root, 'packages/config/package.json', {
			name: '@fixture/config',
			private: true,
			exports: { './base.json': './base.json' }
		});
		json(root, 'packages/config/base.json', { compilerOptions: { allowJs: true, strict: true } });
		json(root, 'packages/demo/other.json', { compilerOptions: { checkJs: true } });
		write(root, 'packages/demo/src/accepted.js', 'export const accepted = true;\n');
		write(root, 'packages/demo/src/ignored.js', 'export const ignored = true;\n');
		write(
			root,
			'packages/demo/tsconfig.json',
			'{\n // inherited contexts\n "extends": ["@fixture/config/base.json", "./other.json"],\n "include": ["src/**/*"],\n "exclude": ["src/ignored.js"]\n}\n'
		);
		const outcome = resolved(root);
		const project = outcome.subject.projects.find(
			(item) => item.configPath === 'packages/demo/tsconfig.json'
		)!;
		expect(project.rawExtends).toEqual(['@fixture/config/base.json', './other.json']);
		expect(project.rawCompilerOptions).toEqual({});
		expect(project.effectiveCompilerOptions).toMatchObject({
			allowJs: true,
			checkJs: true,
			strict: true
		});
		expect(project.fileNames).toEqual([
			'packages/demo/src/accepted.js',
			'packages/demo/src/index.ts'
		]);
		expect(project.configClosure.map((item) => item.path)).toEqual(
			expect.arrayContaining([
				'packages/config/base.json',
				'packages/config/package.json',
				'packages/demo/other.json',
				'packages/demo/tsconfig.json'
			])
		);
		expect(project.programRecipe.projectResolutionDigest).toMatch(/^[a-f0-9]{64}$/u);
		expect(project.programRecipe.provider).toEqual({ id: 'typescript', version: '5.9.3' });
		const baseArtifact = outcomeArtifact(outcome.subject, 'packages/config/base.json');
		expect(baseArtifact).toMatchObject({
			disposition: 'ANALYZED',
			primaryClass: 'PROJECT_CONFIGURATION',
			roles: expect.arrayContaining(['CONFIGURATION'])
		});
		expect(
			outcome.subject.workspaces.find((workspace) => workspace.name === '@fixture/config')?.exports
		).toEqual([{ conditions: [], exportName: './base.json', target: './base.json' }]);
	});

	it('resolves bare workspace packages, extensionless relatives, and exact JSON extends into one frozen closure', () => {
		const root = fixture();
		json(root, 'packages/config/package.json', {
			name: '@fixture/config',
			private: true,
			tsconfig: './base.json'
		});
		json(root, 'packages/config/base.json', { compilerOptions: { allowJs: true } });
		json(root, 'packages/demo/local.json', { compilerOptions: { checkJs: true } });
		json(root, 'packages/demo/exact.json', { compilerOptions: { noImplicitAny: true } });
		json(root, 'packages/demo/tsconfig.json', {
			extends: ['@fixture/config', './local', './exact.json'],
			include: ['src']
		});

		const project = resolved(root).subject.projects.find(
			(candidate) => candidate.configPath === 'packages/demo/tsconfig.json'
		)!;
		expect(project.rawExtends).toEqual(['@fixture/config', './local', './exact.json']);
		expect(project.effectiveCompilerOptions).toMatchObject({
			allowJs: true,
			checkJs: true,
			noImplicitAny: true
		});
		expect(project.configClosure.map((entry) => entry.path)).toEqual(
			expect.arrayContaining([
				'packages/config/base.json',
				'packages/config/package.json',
				'packages/demo/exact.json',
				'packages/demo/local.json',
				'packages/demo/tsconfig.json'
			])
		);
	});

	it('adds compiler-candidate standing to tool configuration selected as a project root', () => {
		const root = fixture();
		write(root, 'packages/demo/vite.config.ts', 'export default { fixture: true };\n');
		json(root, 'packages/demo/tsconfig.json', { files: ['src/index.ts', 'vite.config.ts'] });
		const outcome = resolved(root);
		expect(outcomeArtifact(outcome.subject, 'packages/demo/vite.config.ts')).toMatchObject({
			disposition: 'ANALYZED',
			primaryClass: 'TOOL_CONFIGURATION',
			roles: expect.arrayContaining(['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'CONFIGURATION'])
		});
	});

	it('preserves absent versus explicit-empty raw roots and rejects malformed raw declarations', () => {
		const root = fixture();
		const outcome = resolved(root);
		const project = outcome.subject.projects.find(
			(item) => item.configPath === 'packages/demo/tsconfig.json'
		)!;
		const solution = outcome.subject.projects.find((item) => item.configPath === 'tsconfig.json')!;
		expect(project.rawFiles).toBeNull();
		expect(project.rawExclude).toBeNull();
		expect(project.rawInclude).toEqual(['src']);
		expect(solution.rawFiles).toEqual([]);
		expect(solution.rawInclude).toEqual([]);
		json(root, 'packages/demo/tsconfig.json', { include: 'src' });
		expect(resolveSubject(request(root))).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'CONFIG_MALFORMED' })]
		});
	});

	it('keeps root, build, and solution projects distinct and does not union references into roots', () => {
		const root = fixture();
		json(root, 'packages/demo/tsconfig.build.json', {
			extends: './tsconfig.json',
			compilerOptions: { declaration: true },
			include: ['src/index.ts']
		});
		json(root, 'tsconfig.json', {
			files: [],
			include: [],
			references: [{ path: './packages/demo' }]
		});
		const outcome = resolved(root);
		const solution = outcome.subject.projects.find((item) => item.configPath === 'tsconfig.json')!;
		const build = outcome.subject.projects.find(
			(item) => item.configPath === 'packages/demo/tsconfig.build.json'
		)!;
		expect(solution).toMatchObject({
			kind: 'SOLUTION',
			rootDisposition: 'INTENTIONAL_EMPTY_SOLUTION',
			fileNames: [],
			status: 'COMPLETE'
		});
		expect(solution.projectReferences).toEqual(['packages/demo/tsconfig.json']);
		expect(build.kind).toBe('BUILD');
	});

	it('follows a diamond reference graph as separate projects', () => {
		const root = fixture();
		for (const name of ['a', 'b', 'shared']) {
			json(root, `packages/${name}/package.json`, { name: `@fixture/${name}`, private: true });
			write(root, `packages/${name}/src/index.ts`, `export const ${name} = true;\n`);
		}
		json(root, 'packages/shared/tsconfig.json', { include: ['src'] });
		json(root, 'packages/a/tsconfig.json', { files: [], references: [{ path: '../shared' }] });
		json(root, 'packages/b/tsconfig.json', { files: [], references: [{ path: '../shared' }] });
		json(root, 'tsconfig.json', {
			files: [],
			references: [{ path: 'packages/a' }, { path: 'packages/b' }]
		});
		const outcome = resolved(root);
		expect(
			outcome.subject.projects.filter((item) =>
				[
					'packages/a/tsconfig.json',
					'packages/b/tsconfig.json',
					'packages/shared/tsconfig.json'
				].includes(item.configPath)
			)
		).toHaveLength(3);
		expect(
			outcome.subject.projects.find((item) => item.configPath === 'packages/a/tsconfig.json')
				?.fileNames
		).toEqual([]);
	});

	it('fails closed for missing/cyclic references and missing explicit compiler roots', () => {
		const missing = fixture();
		json(missing, 'tsconfig.json', { files: [], references: [{ path: './packages/absent' }] });
		expect(resolveSubject(request(missing))).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'REFERENCE_REQUIRED_MISSING' })]
		});

		const cyclic = fixture();
		json(cyclic, 'packages/demo/tsconfig.json', {
			files: [],
			references: [{ path: '../../tsconfig.json' }]
		});
		json(cyclic, 'tsconfig.json', { files: [], references: [{ path: './packages/demo' }] });
		expect(resolveSubject(request(cyclic))).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'REFERENCE_CYCLE' })]
		});

		const rootMissing = fixture();
		json(rootMissing, 'packages/demo/tsconfig.json', { files: ['src/absent.ts'] });
		expect(resolveSubject(request(rootMissing))).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'CONFIG_REQUIRED_MISSING' })]
		});

		const extendsCycle = fixture();
		json(extendsCycle, 'packages/demo/a.json', { extends: './b.json' });
		json(extendsCycle, 'packages/demo/b.json', { extends: './a.json' });
		json(extendsCycle, 'packages/demo/tsconfig.json', { extends: './a.json', include: ['src'] });
		expect(resolveSubject(request(extendsCycle))).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'CONFIG_CLOSURE_CYCLE' })]
		});

		const deep = fixture();
		json(deep, 'packages/demo/a.json', { extends: './b.json' });
		json(deep, 'packages/demo/b.json', { compilerOptions: { strict: true } });
		json(deep, 'packages/demo/tsconfig.json', { extends: './a.json', include: ['src'] });
		expect(
			resolveSubject(request(deep, { budgets: { ...request(deep).budgets, maxConfigDepth: 1 } }))
		).toMatchObject({
			outcome: 'unavailable',
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })]
		});

		const missingPackage = fixture();
		json(missingPackage, 'packages/demo/tsconfig.json', {
			extends: '@missing/config/base.json',
			include: ['src']
		});
		expect(resolveSubject(request(missingPackage))).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'CONFIG_REQUIRED_MISSING' })]
		});

		const packageDepth = fixture();
		json(packageDepth, 'packages/config/package.json', {
			name: '@fixture/config',
			private: true,
			tsconfig: './a.json'
		});
		json(packageDepth, 'packages/config/a.json', { extends: './b.json' });
		json(packageDepth, 'packages/config/b.json', { compilerOptions: { strict: true } });
		json(packageDepth, 'packages/demo/tsconfig.json', {
			extends: '@fixture/config',
			include: ['src']
		});
		expect(
			resolveSubject(
				request(packageDepth, { budgets: { ...request(packageDepth).budgets, maxConfigDepth: 1 } })
			)
		).toMatchObject({
			outcome: 'unavailable',
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })]
		});
	});

	it('rejects malformed, escaping, and externally rooted project declarations at their owning boundary', () => {
		const malformedExtends = fixture();
		json(malformedExtends, 'packages/demo/tsconfig.json', { extends: 42, include: ['src'] });
		expect(resolveSubject(request(malformedExtends))).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'CONFIG_MALFORMED', path: 'packages/demo/tsconfig.json' })
			],
			outcome: 'incompatible'
		});

		const escapingExtends = fixture();
		json(escapingExtends, 'packages/demo/tsconfig.json', {
			extends: '../../../outside',
			include: ['src']
		});
		expect(resolveSubject(request(escapingExtends))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'PATH_ESCAPE',
					message: 'Configuration extends target escapes the repository.'
				})
			],
			outcome: 'forbidden'
		});

		const nonCanonicalExtends = fixture();
		json(nonCanonicalExtends, 'packages/demo/tsconfig.json', {
			extends: '..\\base.json',
			include: ['src']
		});
		expect(resolveSubject(request(nonCanonicalExtends))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'PATH_ESCAPE',
					message: expect.stringContaining('not repository-relative')
				})
			],
			outcome: 'forbidden'
		});

		const escapingReference = fixture();
		json(escapingReference, 'packages/demo/tsconfig.json', {
			files: [],
			references: [{ path: '../../../outside' }]
		});
		expect(resolveSubject(request(escapingReference))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'PATH_ESCAPE',
					message: 'Project reference escapes the repository.'
				})
			],
			outcome: 'forbidden'
		});

		const externalCompilerOption = fixture();
		json(externalCompilerOption, 'packages/demo/tsconfig.json', {
			compilerOptions: { outFile: '../../../outside.js' },
			include: ['src']
		});
		expect(resolveSubject(request(externalCompilerOption))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'PATH_ESCAPE',
					message: expect.stringContaining('external absolute path')
				})
			],
			outcome: 'forbidden'
		});

		const malformedOptions = fixture();
		json(malformedOptions, 'packages/demo/tsconfig.json', {
			compilerOptions: null,
			include: ['src']
		});
		expect(resolveSubject(request(malformedOptions))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'CONFIG_MALFORMED',
					message: expect.stringContaining('#/compilerOptions')
				})
			],
			outcome: 'incompatible'
		});
	});

	it('enforces explicit-project, project-count, reference-depth, diagnostic, and wildcard perimeters', () => {
		const missingExplicit = fixture();
		expect(
			resolveSubject(
				request(missingExplicit, {
					scope: { kind: 'EXPLICIT_PROJECTS', projects: ['packages/demo/missing.json'] }
				})
			)
		).toMatchObject({
			diagnostics: [
				expect.objectContaining({ code: 'PROJECT_NOT_FOUND', path: 'packages/demo/missing.json' })
			],
			outcome: 'not-found'
		});

		const projectCount = fixture();
		expect(
			resolveSubject(
				request(projectCount, {
					budgets: { ...request(projectCount).budgets, maxProjects: 1 }
				})
			)
		).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'BUDGET_EXCEEDED',
					message: expect.stringContaining('capturing TypeScript directory queries')
				})
			],
			outcome: 'unavailable'
		});

		const referenceDepth = fixture();
		for (const name of ['a', 'b']) {
			json(referenceDepth, `packages/${name}/package.json`, {
				name: `@fixture/${name}`,
				private: true
			});
			write(referenceDepth, `packages/${name}/src/index.ts`, `export const ${name} = true;\n`);
		}
		json(referenceDepth, 'packages/b/tsconfig.json', { include: ['src'] });
		json(referenceDepth, 'packages/a/tsconfig.json', { files: [], references: [{ path: '../b' }] });
		json(referenceDepth, 'tsconfig.json', { files: [], references: [{ path: 'packages/a' }] });
		expect(
			resolveSubject(
				request(referenceDepth, {
					budgets: { ...request(referenceDepth).budgets, maxConfigDepth: 1 },
					scope: { kind: 'EXPLICIT_PROJECTS', projects: ['tsconfig.json'] }
				})
			)
		).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'BUDGET_EXCEEDED',
					message: expect.stringContaining('Project/config depth')
				})
			],
			outcome: 'unavailable'
		});

		const diagnostics = fixture();
		json(diagnostics, 'packages/demo/tsconfig.json', {
			compilerOptions: { firstUnknownOption: true, secondUnknownOption: true },
			include: ['src']
		});
		expect(
			resolveSubject(
				request(diagnostics, {
					budgets: { ...request(diagnostics).budgets, maxDiagnostics: 1 }
				})
			)
		).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'BUDGET_EXCEEDED',
					message: expect.stringContaining('diagnostics exceeded')
				})
			],
			outcome: 'unavailable'
		});

		const wildcardTraversal = fixture();
		json(wildcardTraversal, 'packages/demo/tsconfig.json', { include: ['src/*/../outside.ts'] });
		expect(resolveSubject(request(wildcardTraversal))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'PATH_ESCAPE',
					message: expect.stringContaining('pattern traverses')
				})
			],
			outcome: 'forbidden'
		});
	});

	it('retains filtered compiler roots as explicit partiality and rejects an absent exact closure member', () => {
		const filtered = fixture();
		write(filtered, 'packages/demo/src/kept.ts', 'export const kept = true;\n');
		write(filtered, 'packages/demo/src/filtered.ts', 'export const filtered = true;\n');
		json(filtered, 'packages/demo/tsconfig.json', { include: ['src/**/*.ts'] });
		const outcome = resolved(filtered, {
			filters: { exclude: [], include: ['packages/demo/src/kept.ts'] }
		});
		const project = outcome.subject.projects.find(
			(candidate) => candidate.configPath === 'packages/demo/tsconfig.json'
		)!;
		expect(project).toMatchObject({ rootDisposition: 'COMPILER_ROOTS', status: 'PARTIAL' });
		expect(project.fileNames).toEqual([
			'packages/demo/src/filtered.ts',
			'packages/demo/src/index.ts',
			'packages/demo/src/kept.ts'
		]);
		expect(outcome.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'TYPESCRIPT_PROJECT_PARTIAL',
					path: 'packages/demo/src/filtered.ts',
					severity: 'WARNING'
				}),
				expect.objectContaining({
					code: 'TYPESCRIPT_PROJECT_PARTIAL',
					path: 'packages/demo/src/index.ts',
					severity: 'WARNING'
				})
			])
		);
		expect(outcome.subject.excludedArtifacts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: 'packages/demo/src/filtered.ts',
					policyId: expect.stringMatching(/^jan-csaa-filter\/1:/u)
				}),
				expect.objectContaining({
					path: 'packages/demo/src/index.ts',
					policyId: expect.stringMatching(/^jan-csaa-filter\/1:/u)
				})
			])
		);

		const missingClosure = fixture();
		json(missingClosure, 'packages/demo/tsconfig.json', {
			extends: './required-base.json',
			include: ['src']
		});
		expect(resolveSubject(request(missingClosure))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'CONFIG_REQUIRED_MISSING',
					path: 'packages/demo/required-base.json'
				})
			],
			outcome: 'incompatible'
		});
	});

	it('fails malformed configs, permits intentional empty subjects, and rejects hostile include traversal', () => {
		const malformed = fixture();
		write(malformed, 'packages/demo/tsconfig.json', '{ bad-json');
		expect(resolveSubject(request(malformed))).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'CONFIG_MALFORMED' })]
		});

		const empty = mkdtempSync(join(tmpdir(), 'csaa-empty-'));
		temporaryRoots.push(empty);
		json(empty, 'package.json', { name: 'empty', private: true });
		expect(resolveSubject(request(empty))).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'EMPTY_SUBJECT' })]
		});
		expect(resolveSubject(request(empty, { expectEmpty: true }))).toMatchObject({
			outcome: 'resolved',
			completeness: 'COMPLETE'
		});

		const hostile = fixture();
		json(hostile, 'packages/demo/tsconfig.json', { include: ['../../../outside/**/*.ts'] });
		expect(resolveSubject(request(hostile))).toMatchObject({
			outcome: 'forbidden',
			diagnostics: [expect.objectContaining({ code: 'PATH_ESCAPE' })]
		});
	});

	it('refuses missing, escaping, uncaptured, and unrecorded TypeScript directory evidence', () => {
		const root = fixture();
		const capture = captureSubject(request(root));
		const workspaces = discoverWorkspaces(capture).workspaces;

		const unrecorded = projectFailure(() =>
			discoverProjects(
				{
					...capture,
					typescriptDirectoryRecordings: new Map()
				},
				request(root),
				workspaces
			)
		);
		expect(unrecorded).toMatchObject({
			diagnostic: expect.objectContaining({
				code: 'CONFIG_DIAGNOSTIC',
				message: expect.stringContaining('unrecorded directory query')
			}),
			outcome: 'incompatible'
		});

		const noReader = projectFailure(() =>
			recordProjectDirectoryQueries(
				capture,
				request(root),
				workspaces,
				undefined as unknown as typeof ts.sys.readDirectory
			)
		);
		expect(noReader).toMatchObject({
			diagnostic: expect.objectContaining({
				code: 'RECONCILIATION_FAILED',
				message: expect.stringContaining('reader is absent')
			}),
			outcome: 'incompatible'
		});

		const outside = mkdtempSync(join(tmpdir(), 'csaa-directory-result-outside-'));
		temporaryRoots.push(outside);
		const escapingReader = (() => [join(outside, 'escaped.ts')]) as typeof ts.sys.readDirectory;
		const escaped = projectFailure(() =>
			recordProjectDirectoryQueries(capture, request(root), workspaces, escapingReader)
		);
		expect(escaped).toMatchObject({
			diagnostic: expect.objectContaining({
				code: 'PATH_ESCAPE',
				message: expect.stringContaining('directory result escapes')
			}),
			outcome: 'forbidden'
		});

		const uncapturedReader = (() => [
			join(root, 'packages/demo/src/phantom.ts')
		]) as typeof ts.sys.readDirectory;
		const uncaptured = projectFailure(() =>
			recordProjectDirectoryQueries(capture, request(root), workspaces, uncapturedReader)
		);
		expect(uncaptured).toMatchObject({
			diagnostic: expect.objectContaining({
				code: 'SUBJECT_CHANGED_DURING_RESOLUTION',
				path: 'packages/demo/src/phantom.ts'
			}),
			outcome: 'unavailable'
		});
	});

	it('binds package-based extends and project discovery to exact captured evidence', () => {
		const root = fixture();
		json(root, 'packages/config/package.json', {
			name: '@fixture/config',
			private: true,
			tsconfig: './base.json'
		});
		json(root, 'packages/config/base.json', { compilerOptions: { strict: true } });
		json(root, 'packages/demo/tsconfig.json', { extends: '@fixture/config', include: ['src'] });
		const capture = captureSubject(request(root));
		const workspaces = discoverWorkspaces(capture).workspaces;
		const manifestPath = 'packages/config/package.json';

		const absentBytes = new Map(capture.bytesByPath);
		absentBytes.delete(manifestPath);
		const absent = projectFailure(() =>
			discoverProjects({ ...capture, bytesByPath: absentBytes }, request(root), workspaces)
		);
		expect(absent).toMatchObject({
			diagnostic: expect.objectContaining({ code: 'CONFIG_REQUIRED_MISSING', path: manifestPath }),
			outcome: 'incompatible'
		});

		for (const [bytes, message] of [
			[new TextEncoder().encode('{ malformed'), 'manifest is malformed'],
			[
				new TextEncoder().encode(
					JSON.stringify({ name: '@fixture/config', private: true, tsconfig: 42 })
				),
				'#/tsconfig must be a string'
			]
		] as const) {
			const changedBytes = new Map(capture.bytesByPath);
			changedBytes.set(manifestPath, bytes);
			const changed = projectFailure(() =>
				discoverProjects({ ...capture, bytesByPath: changedBytes }, request(root), workspaces)
			);
			expect(changed.diagnostic).toMatchObject({ code: 'CONFIG_MALFORMED', path: manifestPath });
			expect(changed.message).toContain(message);
		}

		const unbound = projectFailure(() =>
			discoverProjects(
				{
					...capture,
					artifacts: capture.artifacts.filter((artifact) => artifact.path !== manifestPath)
				},
				request(root),
				workspaces
			)
		);
		expect(unbound).toMatchObject({
			diagnostic: expect.objectContaining({
				code: 'CONFIG_REQUIRED_MISSING',
				message: expect.stringContaining('not content-bound'),
				path: manifestPath
			}),
			outcome: 'incompatible'
		});

		const bounded = projectFailure(() =>
			discoverProjects(
				capture,
				request(root, {
					budgets: { ...request(root).budgets, maxProjects: 1 }
				}),
				workspaces
			)
		);
		expect(bounded).toMatchObject({
			diagnostic: expect.objectContaining({
				code: 'BUDGET_EXCEEDED',
				message: 'Project count exceeded the request budget.'
			}),
			outcome: 'unavailable'
		});
	});
});

describe('generated context and subject identity', () => {
	function svelteFixture(withGenerated: boolean): string {
		const root = fixture();
		const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<
			string,
			unknown
		>;
		manifest.workspaces = ['packages/*', 'apps/*'];
		json(root, 'package.json', manifest);
		json(root, 'apps/demo/package.json', { name: '@fixture/app', private: true });
		write(root, 'apps/demo/svelte.config.js', 'export default {};\n');
		write(root, 'apps/demo/src/page.svelte', '<script lang="ts">let value = 1;</script>\n');
		write(root, 'apps/demo/src/index.ts', 'export const app = true;\n');
		json(root, 'apps/demo/tsconfig.json', {
			extends: './.svelte-kit/tsconfig.json',
			compilerOptions: { allowJs: true }
		});
		if (withGenerated) {
			json(root, 'apps/demo/.svelte-kit/tsconfig.json', {
				compilerOptions: { noEmit: true },
				include: ['../src/**/*.ts', '../src/**/*.svelte', './types/**/$types.d.ts']
			});
			write(
				root,
				'apps/demo/.svelte-kit/types/route/$types.d.ts',
				'export type RouteParams = Record<string, never>;\n'
			);
		}
		return root;
	}

	function fixtureGenerator(root: string): {
		readonly executionManifest: GeneratedContextExecutionManifest;
		readonly generator: {
			readonly id: typeof GENERATED_CONTEXT_SVELTE_KIT_SYNC_GENERATOR_ID;
			readonly implementationDigest: string;
			readonly version: '2.69.2';
		};
	} {
		const executionManifest: GeneratedContextExecutionManifest = {
			containmentPolicy:
				'node-permission-declared-input-absence-and-bound-package-read-empty-generated-and-scratch-read-write-bound-addons-and-child-process/2.0.0',
			configurationEntrypoints: [
				{
					imports: [],
					path: 'apps/demo/svelte.config.js',
					sha256: sha256(readFileSync(join(root, 'apps/demo/svelte.config.js')))
				}
			],
			environment: [
				{ name: 'CI', value: '1' },
				{ name: 'FORCE_COLOR', value: '0' },
				{ name: 'MODE', value: 'production' },
				{ name: 'NODE_ENV', value: 'production' },
				{ name: 'NODE_NO_WARNINGS', value: '1' },
				{ name: 'NO_COLOR', value: '1' },
				{ name: 'TZ', value: 'UTC' }
			].sort((left, right) => compareText(left.name, right.name)),
			environmentPolicy: 'closed-svelte-kit-sync-environment/1.0.0',
			executionLimitations: [
				'CHILD_PROCESS_EXECUTABLE_IDENTITY_AND_EFFECTS_NOT_BOUND_OR_OS_SANDBOXED',
				'NATIVE_ADDON_EFFECTS_NOT_FILESYSTEM_NETWORK_MEMORY_OR_OS_SANDBOXED',
				'NETWORK_DENIAL_NOT_ENFORCED_BY_NODE_PERMISSION_MODEL'
			],
			generatedOutputRoot: {
				access: 'READ_WRITE',
				baseline: 'EMPTY_PHYSICAL_DIRECTORY',
				path: 'apps/demo/.svelte-kit',
				replay: 'RESET_TO_EMPTY_BEFORE_EACH_SYNCHRONIZATION'
			},
			invocation: ['svelte-kit.js', 'sync', '--mode', 'production'],
			lockfile: { path: 'bun.lock', sha256: sha256(readFileSync(join(root, 'bun.lock'))) },
			missingOptionalPackages: [],
			packages: [
				{
					bytes: 1,
					fileCount: 1,
					integrity: `sha512-${'A'.repeat(86)}==`,
					locator: 'node_modules/@sveltejs/kit',
					lockKey: '@sveltejs/kit',
					manifestSha256: 'c'.repeat(64),
					name: '@sveltejs/kit',
					treeSha256: 'd'.repeat(64),
					version: '2.69.2'
				},
				{
					bytes: 1,
					fileCount: 1,
					integrity: `sha512-${'A'.repeat(86)}==`,
					locator: 'node_modules/typescript',
					lockKey: 'typescript',
					manifestSha256: '1'.repeat(64),
					name: 'typescript',
					treeSha256: '2'.repeat(64),
					version: '5.9.2'
				},
				{
					bytes: 1,
					fileCount: 1,
					integrity: `sha512-${'A'.repeat(86)}==`,
					locator: 'node_modules/vite',
					lockKey: 'vite',
					manifestSha256: '3'.repeat(64),
					name: 'vite',
					treeSha256: '4'.repeat(64),
					version: '7.1.5'
				}
			],
			readGrantProfile: 'svelte-kit-sync-project-defaults/1.0.0',
			repositoryReadGrants: [
				...[
					'apps/demo/.env',
					'apps/demo/.env.local',
					'apps/demo/.env.production',
					'apps/demo/.env.production.local',
					'apps/demo/static',
					'apps/demo/svelte.config.ts',
					'apps/demo/vite.config.cjs',
					'apps/demo/vite.config.cts',
					'apps/demo/vite.config.js',
					'apps/demo/vite.config.mjs',
					'apps/demo/vite.config.mts',
					'apps/demo/vite.config.ts'
				].map((path) => ({ kind: 'ABSENT_PATH' as const, path })),
				...[
					'apps/demo/package.json',
					'apps/demo/svelte.config.js',
					'apps/demo/tsconfig.json',
					'bun.lock',
					'package.json'
				].map((path) => ({ kind: 'FILE' as const, path })),
				{ kind: 'DIRECTORY' as const, path: 'apps/demo/src' },
				{ kind: 'DIRECTORY' as const, path: 'node_modules/@sveltejs/kit' },
				{ kind: 'DIRECTORY' as const, path: 'node_modules/typescript' },
				{ kind: 'DIRECTORY' as const, path: 'node_modules/vite' }
			].sort((left, right) => compareText(left.path, right.path)),
			runtime: {
				architecture: 'x64',
				engine: 'node',
				executableBytes: 1,
				executableSha256: 'e'.repeat(64),
				platform: 'linux',
				version: 'v24.0.0',
				versionsDigest: 'f'.repeat(64)
			},
			scratchRoots: [
				{
					access: 'READ_WRITE',
					baseline: 'EMPTY_PHYSICAL_DIRECTORY',
					lifecycle: 'RESET_BEFORE_EACH_SYNCHRONIZATION_AND_RESTORE_AFTER_OPERATION',
					path: 'node_modules/.vite-temp'
				}
			],
			schemaVersion: GENERATED_CONTEXT_EXECUTION_MANIFEST_SCHEMA_VERSION
		};
		return {
			executionManifest,
			generator: {
				id: GENERATED_CONTEXT_SVELTE_KIT_SYNC_GENERATOR_ID,
				implementationDigest: generatedContextExecutionManifestDigest(executionManifest),
				version: '2.69.2'
			}
		};
	}

	it('retains Svelte compiler roots and reports present generated context UNKNOWN/PARTIAL', () => {
		const outcome = resolved(svelteFixture(true));
		const app = outcome.subject.projects.find(
			(item) => item.configPath === 'apps/demo/tsconfig.json'
		)!;
		expect(outcome.completeness).toBe('PARTIAL');
		expect(app.fileNames).toContain('apps/demo/src/page.svelte');
		expect(app.frameworkCandidates).toEqual(['apps/demo/src/page.svelte']);
		expect(outcome.subject.generatedContexts).toEqual([
			expect.objectContaining({ freshness: 'UNKNOWN', path: 'apps/demo/.svelte-kit/tsconfig.json' })
		]);
	});

	it('degrades only an absent generated Svelte config and fails a malformed present one', () => {
		const absent = resolveSubject(request(svelteFixture(false)));
		expect(absent).toMatchObject({ outcome: 'resolved', completeness: 'PARTIAL' });
		if (absent.outcome === 'resolved')
			expect(absent.diagnostics).toEqual(
				expect.arrayContaining([expect.objectContaining({ code: 'GENERATED_CONTEXT_ABSENT' })])
			);

		const malformed = svelteFixture(true);
		write(malformed, 'apps/demo/.svelte-kit/tsconfig.json', '{ malformed');
		expect(resolveSubject(request(malformed))).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'CONFIG_MALFORMED' })]
		});
	});

	it('derives CURRENT and STALE from a captured canonical generation record', () => {
		expect(assessGeneratedContextFreshness()).toMatchObject({ freshness: 'UNKNOWN' });
		const root = svelteFixture(true);
		const fixtureIdentity = fixtureGenerator(root);
		const evidenceBase = {
			generator: fixtureIdentity.generator,
			path: 'apps/demo/.svelte-kit/tsconfig.json',
			source: 'verif/generated-context-record.json'
		};
		const record = createGeneratedContextEvidenceRecord({
			evidenceSource: evidenceBase.source,
			executionManifest: fixtureIdentity.executionManifest,
			generatedContextPath: evidenceBase.path,
			generator: evidenceBase.generator,
			subject: resolved(root).subject
		});
		write(root, evidenceBase.source, canonicalJson(record));
		const current = resolved(root, { generatedContextEvidence: [evidenceBase] }).subject;
		expect(current.generatedContexts[0]?.freshness).toBe('CURRENT');
		expect(current.generatedContexts[0]?.freshnessEvidence).toEqual([
			evidenceBase.source,
			fixtureIdentity.generator.id,
			fixtureIdentity.generator.implementationDigest,
			fixtureIdentity.generator.version,
			record.inputManifestDigest,
			record.generatedOutputManifestDigest
		]);
		expect(record.generatedOutputManifest.map((output) => output.path)).toEqual([
			'apps/demo/.svelte-kit/tsconfig.json',
			'apps/demo/.svelte-kit/types/route/$types.d.ts'
		]);

		write(root, 'apps/demo/src/index.ts', 'export const app = false;\n');
		const stale = resolved(root, { generatedContextEvidence: [evidenceBase] }).subject;
		expect(stale.generatedContexts[0]?.freshness).toBe('STALE');
		write(root, 'apps/demo/src/index.ts', 'export const app = true;\n');
		write(
			root,
			'apps/demo/.svelte-kit/types/route/$types.d.ts',
			'export type RouteParams = { changed: true };\n'
		);
		const staleOutput = resolved(root, { generatedContextEvidence: [evidenceBase] }).subject;
		expect(staleOutput.generatedContexts[0]?.freshness).toBe('STALE');
	});

	it('cannot manufacture generated-context CURRENT from an absent or malformed evidence source', () => {
		const root = svelteFixture(true);
		const fixtureIdentity = fixtureGenerator(root);
		const evidence = {
			generator: fixtureIdentity.generator,
			path: 'apps/demo/.svelte-kit/tsconfig.json',
			source: 'verif/generated-context-record.json'
		};
		const absent = resolved(root, { generatedContextEvidence: [evidence] });
		expect(absent.subject.generatedContexts[0]?.freshness).toBe('UNKNOWN');
		expect(absent.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'GENERATED_CONTEXT_EVIDENCE_INVALID' })
			])
		);

		write(root, evidence.source, '{"schemaVersion":"fabricated"}\n');
		const malformed = resolved(root, { generatedContextEvidence: [evidence] });
		expect(malformed.subject.generatedContexts[0]?.freshness).toBe('UNKNOWN');
		expect(malformed.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'GENERATED_CONTEXT_EVIDENCE_INVALID' })
			])
		);
	});

	it('rejects evidence whose generator identity differs from the declared generator', () => {
		const root = svelteFixture(true);
		const fixtureIdentity = fixtureGenerator(root);
		const source = 'verif/generated-context-record.json';
		const record = createGeneratedContextEvidenceRecord({
			evidenceSource: source,
			executionManifest: fixtureIdentity.executionManifest,
			generatedContextPath: 'apps/demo/.svelte-kit/tsconfig.json',
			generator: fixtureIdentity.generator,
			subject: resolved(root).subject
		});
		write(root, source, canonicalJson(record));
		const outcome = resolved(root, {
			generatedContextEvidence: [
				{
					generator: { ...fixtureIdentity.generator, version: '2.0.0' },
					path: record.generatedContext.path,
					source
				}
			]
		});
		expect(outcome.subject.generatedContexts[0]?.freshness).toBe('UNKNOWN');
		expect(outcome.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'GENERATED_CONTEXT_EVIDENCE_INVALID',
					message: 'Generated-context evidence record names a different generator identity.'
				})
			])
		);
	});

	it.runIf(process.platform === 'win32')(
		'matches generated-context evidence by canonical Windows path identity',
		() => {
			const root = svelteFixture(true);
			const fixtureIdentity = fixtureGenerator(root);
			const source = 'verif/generated-context-record.json';
			const record = createGeneratedContextEvidenceRecord({
				evidenceSource: source,
				executionManifest: fixtureIdentity.executionManifest,
				generatedContextPath: 'apps/demo/.svelte-kit/tsconfig.json',
				generator: fixtureIdentity.generator,
				subject: resolved(root).subject
			});
			write(root, source, canonicalJson(record));
			const subject = resolved(root, {
				generatedContextEvidence: [
					{
						generator: fixtureIdentity.generator,
						path: 'APPS/DEMO/.SVELTE-KIT/TSCONFIG.JSON',
						source: 'VERIF/GENERATED-CONTEXT-RECORD.JSON'
					}
				]
			}).subject;
			expect(subject.generatedContexts[0]?.freshness).toBe('CURRENT');
		}
	);

	it('changes identity for material bytes but not mtime, caches, or declared output bytes', () => {
		const root = fixture();
		const outputs = ['verif/csaa/result.json'];
		const initial = resolved(root, { outputs }).subject;
		const sourcePath = join(root, 'packages/demo/src/index.ts');
		const now = new Date(Date.now() + 60_000);
		utimesSync(sourcePath, now, now);
		write(root, 'packages/demo/dist/cache.ts', 'export const cache = true;\n');
		write(root, outputs[0]!, '{"generated":1}\n');
		expect(resolved(root, { outputs }).subject.descriptor.subjectId).toBe(
			initial.descriptor.subjectId
		);

		write(root, 'packages/demo/src/index.ts', 'export const value = 2;\n');
		const sourceChanged = resolved(root, { outputs }).subject;
		expect(sourceChanged.descriptor.subjectId).not.toBe(initial.descriptor.subjectId);
		write(root, 'bun.lock', 'fixture lock changed\n');
		expect(resolved(root, { outputs }).subject.descriptor.subjectId).not.toBe(
			sourceChanged.descriptor.subjectId
		);
	});

	it('binds exact output and explicit-project scope policy and retains authored foo.tmp', () => {
		const root = fixture();
		write(root, 'packages/demo/src/foo.tmp', 'authored temporary-named content\n');
		json(root, 'packages/other/package.json', { name: '@fixture/other', private: true });
		write(root, 'packages/other/src/index.ts', 'export const other = true;\n');
		json(root, 'packages/other/tsconfig.json', { include: ['src'] });
		const all = resolved(root).subject;
		const scoped = resolved(root, {
			scope: { kind: 'EXPLICIT_PROJECTS', projects: ['packages/demo/tsconfig.json'] }
		}).subject;
		expect(all.artifacts.some((item) => item.path === 'packages/demo/src/foo.tmp')).toBe(true);
		expect(scoped.artifacts.some((item) => item.path === 'packages/other/src/index.ts')).toBe(
			false
		);
		expect(scoped.descriptor.subjectId).not.toBe(all.descriptor.subjectId);
		expect(resolved(root, { outputs: ['verif/a.json'] }).subject.descriptor.subjectId).not.toBe(
			resolved(root, { outputs: ['verif/b.json'] }).subject.descriptor.subjectId
		);
	});

	it('retains exact additional evidence beside an explicit project closure', () => {
		const root = fixture();
		write(root, 'verif/retained-evidence.ts', 'export const evidence = true;\n');
		write(root, 'verif/not-requested.ts', 'export const omitted = true;\n');
		const outcome = resolved(root, {
			scope: {
				additionalArtifacts: ['verif/retained-evidence.ts'],
				kind: 'EXPLICIT_PROJECTS',
				projects: ['packages/demo/tsconfig.json']
			}
		});
		const paths = outcome.subject.artifacts.map((artifact) => artifact.path);
		expect(paths).toContain('packages/demo/src/index.ts');
		expect(paths).toContain('verif/retained-evidence.ts');
		expect(paths).not.toContain('verif/not-requested.ts');
		const beforeId = outcome.subject.descriptor.subjectId;
		write(root, 'verif/retained-evidence.ts', 'export const evidence = false;\n');
		const after = resolved(root, {
			scope: {
				additionalArtifacts: ['verif/retained-evidence.ts'],
				kind: 'EXPLICIT_PROJECTS',
				projects: ['packages/demo/tsconfig.json']
			}
		});
		expect(after.subject.descriptor.subjectId).not.toBe(beforeId);
		expect(after.subject.descriptor.perimeter).toContain('verif/retained-evidence.ts');
	});

	it('canonicalizes additional evidence order while preserving ordinary explicit-scope policy identity', () => {
		const root = fixture();
		write(root, 'verif/a-evidence.ts', 'export const a = true;\n');
		write(root, 'verif/b-evidence.ts', 'export const b = true;\n');
		const ordinaryScope = {
			kind: 'EXPLICIT_PROJECTS' as const,
			projects: ['packages/demo/tsconfig.json']
		};
		const ordinaryRequest = request(root, { scope: ordinaryScope });
		const emptyRequest = request(root, {
			scope: { ...ordinaryScope, additionalArtifacts: [] }
		});
		const expectedOrdinaryPolicyId = `jan-csaa-filter/1:${sha256(
			canonicalJson({
				exclude: [],
				include: [],
				scope: {
					kind: 'EXPLICIT_PROJECTS',
					projects: [canonicalPathKey('packages/demo/tsconfig.json')]
				}
			})
		)}`;
		expect(subjectFilterPolicyId(ordinaryRequest)).toBe(expectedOrdinaryPolicyId);
		expect(subjectFilterPolicyId(emptyRequest)).toBe(expectedOrdinaryPolicyId);
		const ordinary = resolved(root, { scope: ordinaryScope }).subject;
		const empty = resolved(root, {
			scope: { ...ordinaryScope, additionalArtifacts: [] }
		}).subject;
		expect(empty.descriptor.subjectId).toBe(ordinary.descriptor.subjectId);
		expect(empty.request.scope).toEqual(ordinary.request.scope);

		const first = resolved(root, {
			scope: {
				...ordinaryScope,
				additionalArtifacts: ['verif/b-evidence.ts', 'verif/a-evidence.ts']
			}
		}).subject;
		const second = resolved(root, {
			scope: {
				...ordinaryScope,
				additionalArtifacts: ['verif/a-evidence.ts', 'verif/b-evidence.ts']
			}
		}).subject;
		expect(first.descriptor.subjectId).toBe(second.descriptor.subjectId);
		expect(first.descriptor.perimeter).toEqual(second.descriptor.perimeter);
		expect(first.request.scope).toMatchObject({
			additionalArtifacts: ['verif/a-evidence.ts', 'verif/b-evidence.ts']
		});
	});

	it('fails closed when exact additional evidence is absent, filtered, or declared output', () => {
		const root = fixture();
		write(root, 'verif/evidence.ts', 'export const evidence = true;\n');
		const scope = {
			additionalArtifacts: ['verif/evidence.ts'],
			kind: 'EXPLICIT_PROJECTS' as const,
			projects: ['packages/demo/tsconfig.json']
		};
		for (const overrides of [
			{ filters: { exclude: ['verif/evidence.ts'], include: [] }, scope },
			{ outputs: ['verif/evidence.ts'], scope },
			{
				scope: {
					...scope,
					additionalArtifacts: ['verif/missing.ts']
				}
			}
		]) {
			const outcome = resolveSubject(request(root, overrides));
			expect(outcome).toMatchObject({
				diagnostics: [expect.objectContaining({ code: 'ADDITIONAL_ARTIFACT_REQUIRED_MISSING' })],
				outcome: 'not-found'
			});
		}
	});

	it('isolates explicit-project identity from unrelated source and project-config mutations', () => {
		const root = fixture();
		json(root, 'packages/other/package.json', { name: '@fixture/other', private: true });
		write(root, 'packages/other/src/index.ts', 'export const other = 1;\n');
		json(root, 'packages/other/tsconfig.json', {
			compilerOptions: { strict: true },
			include: ['src']
		});
		const scope = { kind: 'EXPLICIT_PROJECTS' as const, projects: ['packages/demo/tsconfig.json'] };
		const before = resolved(root, { scope }).subject;
		write(root, 'packages/other/src/index.ts', 'export const other = 2;\n');
		json(root, 'packages/other/tsconfig.json', {
			compilerOptions: { strict: false },
			include: ['src']
		});
		json(root, 'packages/other/package.json', {
			name: '@fixture/other',
			private: false,
			version: '2.0.0'
		});
		const after = resolved(root, { scope }).subject;
		expect(after.descriptor.subjectId).toBe(before.descriptor.subjectId);
		expect(
			after.artifacts.some((artifact) => artifact.path === 'packages/other/tsconfig.json')
		).toBe(false);
		expect(
			after.artifacts.some((artifact) => artifact.path === 'packages/other/package.json')
		).toBe(false);
		expect(after.workspaces.some((workspace) => workspace.path === 'packages/other')).toBe(false);
	});

	it('canonicalizes duplicate filters and does not count an absent output as a discovered file', () => {
		const root = fixture();
		const once = resolved(root, { filters: { exclude: [], include: ['packages/**'] } }).subject;
		const duplicate = resolved(root, {
			filters: { exclude: [], include: ['packages/**', 'packages/**'] }
		}).subject;
		expect(duplicate.descriptor.subjectId).toBe(once.descriptor.subjectId);
		const baseline = resolved(root).subject;
		const absentOutput = resolved(root, { outputs: ['verif/absent-output.json'] }).subject;
		expect(absentOutput.population.discovered).toBe(baseline.population.discovered);
		expect(
			absentOutput.excludedArtifacts.find(
				(artifact) => artifact.path === 'verif/absent-output.json'
			)?.physicalFileCount
		).toBe('UNKNOWN');
		expect(absentOutput.population.discovered).toBe(
			absentOutput.population.included +
				absentOutput.population.excluded +
				absentOutput.population.failed
		);
		expect(absentOutput.population).toMatchObject({
			excludedPhysicalFiles: 'UNKNOWN',
			physicalPopulationReconciles: 'UNKNOWN',
			reconciles: true,
			reconciliationScope: 'CAPTURED_RECORDS_ONLY'
		});
	});

	it('does not project collapsed excluded directories as an exact physical population', () => {
		const root = fixture();
		write(root, 'packages/demo/dist/one.js', 'export const one = 1;\n');
		write(root, 'packages/demo/dist/nested/two.js', 'export const two = 2;\n');
		const subject = resolved(root).subject;
		expect(subject.excludedArtifacts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: 'packages/demo/dist',
					physicalFileCount: 'UNKNOWN'
				})
			])
		);
		expect(subject.population).toMatchObject({
			excludedPhysicalFiles: 'UNKNOWN',
			physicalPopulationReconciles: 'UNKNOWN',
			reconciles: true,
			reconciliationScope: 'CAPTURED_RECORDS_ONLY'
		});
	});

	it.runIf(process.platform === 'win32')(
		'treats case-equivalent output, filter, project, and additional-artifact inputs identically on Windows',
		() => {
			const root = fixture();
			write(root, 'verif/result.json', '{"generated":true}\n');
			write(root, 'verif/evidence.ts', 'export const evidence = true;\n');
			const canonical = resolved(root, {
				filters: {
					exclude: [],
					include: ['packages/demo/src/**', 'verif/evidence.ts']
				},
				outputs: ['verif/result.json'],
				scope: {
					additionalArtifacts: ['verif/evidence.ts'],
					kind: 'EXPLICIT_PROJECTS',
					projects: ['packages/demo/tsconfig.json']
				}
			});
			const outcome = resolved(root, {
				filters: {
					include: ['PACKAGES/DEMO/SRC/**', 'VERIF/EVIDENCE.TS'],
					exclude: []
				},
				outputs: ['VERIF/RESULT.JSON'],
				scope: {
					additionalArtifacts: ['VERIF/EVIDENCE.TS'],
					kind: 'EXPLICIT_PROJECTS',
					projects: ['PACKAGES/DEMO/TSCONFIG.JSON']
				}
			});
			expect(outcome.subject.descriptor.subjectId).toBe(canonical.subject.descriptor.subjectId);
			expect(outcome.subject.projects.map((project) => project.configPath)).toEqual([
				'packages/demo/tsconfig.json'
			]);
			expect(outcome.subject.request.scope).toMatchObject({
				additionalArtifacts: ['verif/evidence.ts']
			});
			expect(outcome.subject.descriptor.perimeter).toContain('verif/evidence.ts');
			expect(
				outcome.subject.artifacts.some((artifact) => artifact.path === 'verif/evidence.ts')
			).toBe(true);
			expect(
				outcome.subject.artifacts.some(
					(artifact) => artifact.path.toLowerCase() === 'verif/result.json'
				)
			).toBe(false);
			expect(
				outcome.subject.artifacts.some((artifact) => artifact.path === 'packages/demo/src/index.ts')
			).toBe(true);
		}
	);
});

describe('capture safety, immutability, freshness, and reconciliation', () => {
	it('redacts unexpected hook failures and enforces the shared resolution deadline between phases', () => {
		const root = fixture();
		const unexpected = resolveSubject(request(root), {
			afterCapture() {
				throw new Error(`unexpected failure at ${root}`);
			}
		});
		expect(unexpected).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'READ_FAILED',
					message: expect.stringContaining('unexpected failure at <runtime>'),
					phase: 'RESOLVE'
				})
			],
			outcome: 'unavailable'
		});
		expect(JSON.stringify(unexpected)).not.toContain(root.replaceAll('\\', '/'));

		let now = 1_000;
		const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
		try {
			const expired = resolveSubject(
				request(root, {
					budgets: { ...request(root).budgets, maxDurationMs: 10 }
				}),
				{
					afterCapture() {
						now += 11;
					}
				}
			);
			expect(expired).toMatchObject({
				diagnostics: [
					expect.objectContaining({
						code: 'BUDGET_EXCEEDED',
						message: 'Subject resolution exceeded its duration budget.',
						phase: 'RESOLVE'
					})
				],
				outcome: 'unavailable'
			});
		} finally {
			clock.mockRestore();
		}
	});

	it('confines configured, nested, and top-level repository links to physical in-root targets', () => {
		const outside = mkdtempSync(join(tmpdir(), 'csaa-link-outside-'));
		temporaryRoots.push(outside);
		write(outside, 'package.json', '{"name":"outside"}\n');

		const configuredRoot = mkdtempSync(join(tmpdir(), 'csaa-configured-link-'));
		temporaryRoots.push(configuredRoot);
		json(configuredRoot, 'package.json', {
			name: 'configured-link',
			private: true,
			workspaces: ['code/*']
		});
		symlinkSync(
			outside,
			join(configuredRoot, 'code'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expect(resolveSubject(request(configuredRoot))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'SYMLINK_ESCAPE',
					message: expect.stringContaining('Configured subject root escapes')
				})
			],
			outcome: 'forbidden'
		});

		const nestedEscape = fixture();
		symlinkSync(
			outside,
			join(nestedEscape, 'packages/demo/escape'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expect(resolveSubject(request(nestedEscape))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'SYMLINK_ESCAPE',
					message: expect.stringContaining('Repository link escapes root')
				})
			],
			outcome: 'forbidden'
		});

		const dangling = fixture();
		symlinkSync(
			join(dangling, 'absent-target'),
			join(dangling, 'packages/demo/dangling'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expect(resolveSubject(request(dangling))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'READ_FAILED',
					message: expect.stringContaining('Cannot resolve repository link')
				})
			],
			outcome: 'unavailable'
		});

		const topLevelEscape = fixture();
		symlinkSync(
			outside,
			join(topLevelEscape, 'archive-link'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expect(resolveSubject(request(topLevelEscape))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'SYMLINK_ESCAPE',
					message: expect.stringContaining('Top-level repository link escapes root')
				})
			],
			outcome: 'forbidden'
		});

		const topLevelAlias = fixture();
		write(topLevelAlias, 'node_modules/contained/tool.ts', 'export const tool = true;\n');
		symlinkSync(
			join(topLevelAlias, 'node_modules/contained'),
			join(topLevelAlias, 'perimeter-link'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const aliasOutcome = resolved(topLevelAlias);
		expect(aliasOutcome.subject.excludedArtifacts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: 'perimeter-link',
					physicalFileCount: 'UNKNOWN',
					policyId: 'jan-csaa-exclude-perimeter/1'
				})
			])
		);
	});

	it('does not ingest directory or dangling-link masquerades as selected root files', () => {
		const directoryMasquerade = fixture();
		symlinkSync(
			join(directoryMasquerade, 'packages/demo/src'),
			join(directoryMasquerade, '.eslintignore-extra'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		const outcome = resolved(directoryMasquerade);
		expect(
			outcome.subject.artifacts.some((artifact) => artifact.path === '.eslintignore-extra')
		).toBe(false);

		const danglingMasquerade = fixture();
		symlinkSync(
			join(danglingMasquerade, 'absent-target'),
			join(danglingMasquerade, '.eslintignore-extra'),
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expect(resolveSubject(request(danglingMasquerade))).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					code: 'SYMLINK_ESCAPE',
					message: expect.stringContaining('Cannot safely resolve')
				})
			],
			outcome: 'forbidden'
		});
	});

	it('retries one concurrent mutation and fails when every attempt changes', () => {
		const root = fixture();
		const source = join(root, 'packages/demo/src/index.ts');
		const retried = resolveSubject(request(root), {
			afterCapture(attempt) {
				if (attempt === 1) writeFileSync(source, 'export const value = 2;\n');
			}
		});
		expect(retried).toMatchObject({ outcome: 'resolved' });
		let mutation = 2;
		const failed = resolveSubject(request(root), {
			afterCapture() {
				mutation += 1;
				writeFileSync(source, `export const value = ${mutation};\n`);
			}
		});
		expect(failed).toMatchObject({
			outcome: 'unavailable',
			diagnostics: [expect.objectContaining({ code: 'SUBJECT_CHANGED_DURING_RESOLUTION' })]
		});
	});

	it('enforces one operation-wide time budget', () => {
		const root = fixture();
		const outcome = resolveSubject(
			request(root, { budgets: { ...request(root).budgets, maxDurationMs: 1 } }),
			{
				afterCapture() {
					const until = Date.now() + 5;
					while (Date.now() < until) {
						/* bounded test delay */
					}
				}
			}
		);
		expect(outcome).toMatchObject({
			outcome: 'unavailable',
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })]
		});
		expect(
			resolveSubject(request(root, { budgets: { ...request(root).budgets, maxBytes: 1 } }))
		).toMatchObject({
			outcome: 'unavailable',
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })]
		});
		expect(
			resolveSubject(request(root, { budgets: { ...request(root).budgets, maxFiles: 2 } }))
		).toMatchObject({
			outcome: 'unavailable',
			diagnostics: [expect.objectContaining({ code: 'BUDGET_EXCEEDED' })]
		});
	});

	it('follows an in-root directory link through the selected workspace without widening the top-level perimeter', () => {
		const root = fixture();
		write(root, 'vault/safe/index.ts', 'export const linked = true;\n');
		const linkedDirectory = join(root, 'packages/demo/linked');
		symlinkSync(
			join(root, 'vault/safe'),
			linkedDirectory,
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		json(root, 'packages/demo/tsconfig.json', { include: ['src', 'linked'] });

		const outcome = resolved(root);
		const project = outcome.subject.projects.find(
			(candidate) => candidate.configPath === 'packages/demo/tsconfig.json'
		)!;
		expect(project.fileNames).toContain('packages/demo/linked/index.ts');
		expect(outcomeArtifact(outcome.subject, 'packages/demo/linked/index.ts')).toMatchObject({
			disposition: 'ANALYZED',
			primaryClass: 'PRODUCTION_SOURCE'
		});
		expect(outcome.subject.excludedArtifacts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: 'vault',
					physicalFileCount: 'UNKNOWN',
					policyId: 'jan-csaa-exclude-perimeter/1'
				})
			])
		);
	});

	it('returns copied bytes, detects post-freeze byte and membership changes, and reconciles exact counts', () => {
		const root = fixture();
		const subject = resolved(root).subject;
		const first = readFrozenSubjectArtifact(subject, 'package.json')!;
		first[0] = first[0] === 123 ? 91 : 123;
		expect(readFrozenSubjectArtifact(subject, 'package.json')).toEqual(
			new Uint8Array(readFileSync(join(root, 'package.json')))
		);
		expect(subject.population.discovered).toBe(
			subject.population.included + subject.population.excluded + subject.population.failed
		);
		expect(subject.population.included).toBe(
			subject.population.analyzed + subject.population.inventoryOnly
		);
		expect(subject.population).toMatchObject({
			excludedPhysicalFiles: 0,
			physicalPopulationReconciles: true,
			reconciles: true,
			reconciliationScope: 'EXACT_PHYSICAL_POPULATION'
		});
		expect(verifyFrozenSubject(subject, { rootLocator: root }).state).toBe('CURRENT');
		write(root, 'packages/demo/src/new.ts', 'export const added = true;\n');
		const freshness = verifyFrozenSubject(subject, { rootLocator: root });
		expect(freshness.state).toBe('STALE');
		expect(freshness.changedPaths).toContain('packages/demo/src/new.ts');
	});

	it('rejects an output beneath an escaping symlink and duplicate in-root aliases', () => {
		const root = fixture();
		const outside = mkdtempSync(join(tmpdir(), 'csaa-outside-'));
		temporaryRoots.push(outside);
		const outputParent = join(root, 'packages/demo/out');
		symlinkSync(outside, outputParent, process.platform === 'win32' ? 'junction' : 'dir');
		expect(
			resolveSubject(request(root, { outputs: ['packages/demo/out/result.json'] }))
		).toMatchObject({
			outcome: 'forbidden',
			diagnostics: [expect.objectContaining({ code: 'SYMLINK_ESCAPE' })]
		});

		rmSync(outputParent, { recursive: true, force: true });
		const alias = join(root, 'packages/demo/alias');
		symlinkSync(
			join(root, 'packages/demo/src'),
			alias,
			process.platform === 'win32' ? 'junction' : 'dir'
		);
		expect(resolveSubject(request(root))).toMatchObject({
			outcome: 'incompatible',
			diagnostics: [expect.objectContaining({ code: 'CANONICAL_PATH_COLLISION' })]
		});
	});

	it.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)(
		'fails an unreadable selected file with a typed diagnostic',
		() => {
			const root = fixture();
			const source = join(root, 'packages/demo/src/index.ts');
			chmodSync(source, 0o000);
			try {
				expect(resolveSubject(request(root))).toMatchObject({
					outcome: 'unavailable',
					diagnostics: [expect.objectContaining({ code: 'READ_FAILED' })]
				});
			} finally {
				chmodSync(source, 0o600);
			}
		}
	);
});

describe('live JPWB and inventory projection', () => {
	it('matches the confirmed public TypeScript root populations', () => {
		const subject = projectSubjectForInventory(REPOSITORY_ROOT);
		const counts = new Map(
			subject.projects.map((project) => [project.configPath, project.fileNames.length])
		);
		expect(counts.get('tsconfig.json')).toBe(0);
		expect(counts.get('packages/rph-contracts/tsconfig.json')).toBe(28);
		expect(counts.get('packages/rph-contracts/tsconfig.build.json')).toBe(10);
		// Re-derived from the same live compiler-root projection used by JAN-CSAA-005. The report commands
		// import their bounded implementation closures into the scripts program; the verification program also
		// grows with the public report contract and root-surface assertions.
		expect(counts.get('scripts/tsconfig.json')).toBe(36);
		expect(counts.get('verif/tsconfig.json')).toBe(48);
		expect(counts.get('apps/rph-demo/tsconfig.json')).toBe(95);
		expect(
			subject.projects.find((project) => project.configPath === 'apps/rph-demo/tsconfig.json')
				?.frameworkCandidates
		).toHaveLength(11);
		const unitPaths = subject.artifacts
			.map((artifact) => artifact.path)
			.filter((path) =>
				['apps/*/src/**/*.test.ts', 'packages/*/src/**/*.test.ts', 'verif/**/*.test.ts'].some(
					(pattern) => globMatches(path, pattern)
				)
			);
		const source = subject.testPopulations.find(
			(population) => population.provider === 'VITEST' && population.profile === 'SOURCE'
		)!;
		const dist = subject.testPopulations.find(
			(population) => population.provider === 'VITEST' && population.profile === 'DIST'
		)!;
		expect(source).toMatchObject({ reconciles: true, status: 'COMPLETE' });
		expect(source.includedPaths).toEqual(unitPaths);
		expect(dist.includedPaths).toEqual(source.includedPaths);
		const deterministic = subject.testPopulations.find(
			(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'DETERMINISTIC'
		)!;
		const live = subject.testPopulations.find(
			(population) => population.provider === 'PLAYWRIGHT' && population.profile === 'LIVE'
		)!;
		expect(deterministic).toMatchObject({
			includedPaths: subject.artifacts
				.map((artifact) => artifact.path)
				.filter((path) => globMatches(path, 'apps/rph-demo/e2e/**/*.e2e.ts')),
			status: 'COMPLETE'
		});
		expect(live).toMatchObject({
			includedPaths: subject.artifacts
				.map((artifact) => artifact.path)
				.filter((path) => globMatches(path, 'apps/rph-demo/e2e-live/**/*.live.ts')),
			status: 'COMPLETE'
		});
	}, 30_000);

	it('projects the same subject paths, classes, hashes, roots, and identity into JAN-CSAA-005', () => {
		const subject = projectSubjectForInventory(REPOSITORY_ROOT);
		const inventory = collectInventory({
			repositoryRoot: REPOSITORY_ROOT,
			requireJpwbPopulations: true
		});
		expect(inventory.subject.subjectId).toBe(subject.descriptor.subjectId);
		expect(inventory.assuranceSurfaces.testPopulations).toEqual(subject.testPopulations);
		expect(inventory.assuranceSurfaces.unitTests.files).toEqual(
			subject.testPopulations.find(
				(population) => population.provider === 'VITEST' && population.profile === 'SOURCE'
			)?.includedPaths
		);
		expect(inventory.assuranceSurfaces.e2e.deterministicFiles).toEqual(
			subject.testPopulations.find(
				(population) =>
					population.provider === 'PLAYWRIGHT' && population.profile === 'DETERMINISTIC'
			)?.includedPaths
		);
		expect(
			inventory.subject.selectedFiles.map(({ bytes, path, sha256 }) => ({ bytes, path, sha256 }))
		).toEqual(subject.artifacts.map(({ bytes, path, sha256 }) => ({ bytes, path, sha256 })));
		expect(
			inventory.typescriptProjects.map((project) => [project.path, project.resolvedRootFiles])
		).toEqual(subject.projects.map((project) => [project.configPath, project.fileNames]));
		expect(
			inventory.typescriptProjects.map((project) => [
				project.path,
				project.exclude,
				project.files,
				project.include
			])
		).toEqual(
			subject.projects.map((project) => [
				project.configPath,
				project.rawExclude,
				project.rawFiles,
				project.rawInclude
			])
		);
		expect(inventory.typescriptProjects).toHaveLength(subject.projects.length);
		for (const project of subject.projects) {
			const projected = inventory.typescriptProjects.find(
				(item) => item.path === project.configPath
			);
			expect(projected).toBeDefined();
			expect(projected).toMatchObject({
				diagnostics: project.typescriptDiagnostics,
				frameworkCandidates: project.frameworkCandidates,
				rootDisposition: project.rootDisposition,
				status: project.status
			});
			expect(projected?.resolvedRootFiles).toEqual(project.fileNames);
			expect(projected?.references).toEqual(project.projectReferences);
			if (project.status === 'PARTIAL')
				expect(projected?.partialityReasons.length).toBeGreaterThan(0);
		}
		expect(
			inventory.typescriptProjects.every(
				(project) => project.resolvedRootState === 'RESOLVED_DWP002'
			)
		).toBe(true);
		const filePreimage = inventory.subject.selectedFiles.map(
			({ bytes, path, sha256: digest, subjectArtifactClass }) => ({
				artifactClass: subjectArtifactClass,
				bytes,
				path,
				sha256: digest
			})
		);
		expect(sha256(canonicalJson(filePreimage))).toBe(inventory.subject.fileManifestDigest);
		expect(sha256(canonicalJson(inventory.subject.configurationPreimage))).toBe(
			inventory.subject.configurationDigest
		);
		const identityPreimage = {
			schemaVersion: inventory.subject.schemaVersion,
			subjectKind: inventory.subject.subjectKind,
			revision: null,
			parentRevision: null,
			perimeter: inventory.subject.perimeter,
			fileManifestDigest: inventory.subject.fileManifestDigest,
			configurationDigest: inventory.subject.configurationDigest,
			exclusionPolicyIds: inventory.subject.exclusionPolicyIds
		};
		expect(sha256(`JAN-CSAA-SUBJECT\0${'1\0'}${canonicalJson(identityPreimage)}`)).toBe(
			inventory.subject.subjectId
		);
		expect(inventory.subject.resolutionCompleteness).toBe('PARTIAL');
		expect(inventory.subject.generatedContexts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					freshness: 'CURRENT',
					generator: expect.objectContaining({ id: '@sveltejs/kit:svelte-kit-sync' })
				})
			])
		);
		const app = inventory.typescriptProjects.find(
			(project) => project.path === 'apps/rph-demo/tsconfig.json'
		);
		expect(app).toMatchObject({
			generatedContexts: [expect.objectContaining({ freshness: 'CURRENT' })],
			rootDisposition: 'COMPILER_ROOTS',
			status: 'PARTIAL'
		});
		expect(app?.partialityReasons.map((reason) => reason.code)).toEqual([
			'FRAMEWORK_CANDIDATES_PRESENT'
		]);
		const markdown = renderInventoryMarkdown(inventory);
		expect(markdown).toContain('| `apps/rph-demo/tsconfig.json` | `PARTIAL` | `COMPILER_ROOTS` |');
		expect(markdown).toContain('`CURRENT: apps/rph-demo/.svelte-kit/tsconfig.json`');
		expect(markdown).not.toContain('`GENERATED_CONTEXT_FRESHNESS_UNKNOWN`');
	}, 30_000);
});
