import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import ts from 'typescript';
import type { ProgramRecipe } from '../../contracts/subject.js';
import { TYPESCRIPT_PROVIDER_VERSION } from '../../contracts/semantic.js';
import { programRecipeDigest } from '../../semantic/ids.js';
import { materializeProgramRecipe, ProgramRecipeMaterializationError } from './materialize-program-recipe.js';

const temporaryRoots: string[] = [];

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function repository(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-materializer-'));
	temporaryRoots.push(root);
	mkdirSync(join(root, 'packages/example/src'), { recursive: true });
	mkdirSync(join(root, 'packages/base'), { recursive: true });
	writeFileSync(join(root, 'packages/example/tsconfig.json'), '{}');
	writeFileSync(join(root, 'packages/example/src/index.ts'), 'export {};\n');
	writeFileSync(join(root, 'packages/base/tsconfig.json'), '{}');
	return root;
}

function recipe(compilerOptions: Readonly<Record<string, unknown>>, overrides: Readonly<Record<string, unknown>> = {}): ProgramRecipe {
	const input = {
		compilerOptions,
		configClosureDigest: '1'.repeat(64),
		configPath: 'packages/example/tsconfig.json',
		kind: 'PROJECT' as const,
		projectReferences: ['packages/base/tsconfig.json'],
		provider: { id: 'typescript' as const, version: TYPESCRIPT_PROVIDER_VERSION },
		rootNames: ['packages/example/src/index.ts'],
		...overrides
	};
	return { ...input, projectResolutionDigest: programRecipeDigest(input as Omit<ProgramRecipe, 'projectResolutionDigest'>) } as ProgramRecipe;
}

function expectTypedFailure(action: () => unknown, code: ProgramRecipeMaterializationError['code'] = 'INVALID_RECIPE'): void {
	try {
		action();
		throw new Error('Expected materialization to fail.');
	} catch (error) {
		expect(error).toBeInstanceOf(ProgramRecipeMaterializationError);
		expect((error as ProgramRecipeMaterializationError).code).toBe(code);
	}
}

describe('ProgramRecipe runtime materialization', () => {
	it('materializes the complete permitted path allowlist and preserves semantic string options', () => {
		const repositoryRoot = repository();
		const input = recipe({
			configFilePath: 'packages/example/tsconfig.json',
			customConditions: ['browser'],
			lib: ['lib.es2022.d.ts'],
			moduleSuffixes: ['.native', ''],
			out: 'packages/example/legacy.js',
			outDir: 'packages/example/dist',
			outFile: 'packages/example/bundle.js',
			paths: { '@example/*': ['packages/example/src/*'] },
			pathsBasePath: '.',
			rootDir: 'packages/example/src',
			rootDirs: ['packages/example/generated', 'packages/example/src'],
			types: ['node']
		});
		const materialized = materializeProgramRecipe(input, repositoryRoot);
		expect(materialized.rootNames).toEqual([join(repositoryRoot, 'packages/example/src/index.ts')]);
		expect(materialized.projectReferences).toEqual([{ path: join(repositoryRoot, 'packages/base/tsconfig.json') }]);
		expect(materialized.compilerOptions).toMatchObject({
			configFilePath: join(repositoryRoot, 'packages/example/tsconfig.json'),
			customConditions: ['browser'],
			lib: ['lib.es2022.d.ts'],
			moduleSuffixes: ['.native', ''],
			out: join(repositoryRoot, 'packages/example/legacy.js'),
			outDir: join(repositoryRoot, 'packages/example/dist'),
			outFile: join(repositoryRoot, 'packages/example/bundle.js'),
			paths: { '@example/*': ['packages/example/src/*'] },
			pathsBasePath: repositoryRoot,
			rootDir: join(repositoryRoot, 'packages/example/src'),
			rootDirs: [join(repositoryRoot, 'packages/example/generated'), join(repositoryRoot, 'packages/example/src')],
			types: ['node']
		});
		expect(isAbsolute(materialized.configFilePath)).toBe(true);
		expect(input.compilerOptions.paths).toEqual({ '@example/*': ['packages/example/src/*'] });
	});

	it('preserves bounded Svelte paths substitutions and rejects lexical escape from the effective base', () => {
		const repositoryRoot = repository();
		mkdirSync(join(repositoryRoot, 'apps/rph-demo/.svelte-kit'), { recursive: true });
		mkdirSync(join(repositoryRoot, 'apps/rph-demo/src/lib'), { recursive: true });
		const sveltePaths = { '$app/types': ['./types/index.d.ts'], '$lib': ['../src/lib'], '$lib/*': ['../src/lib/*'] };
		const input = recipe({ paths: sveltePaths, pathsBasePath: 'apps/rph-demo/.svelte-kit' });
		expect(materializeProgramRecipe(input, repositoryRoot).compilerOptions.paths).toEqual(sveltePaths);
		expectTypedFailure(() => materializeProgramRecipe(recipe({ paths: { x: ['../../../../outside/*'] }, pathsBasePath: 'packages/example' }), repositoryRoot), 'PATH_ESCAPE');
	});

	it('synthesizes a runtime-only config-directory paths base and resolves with public TypeScript semantics', () => {
		const repositoryRoot = repository();
		mkdirSync(join(repositoryRoot, 'apps/rph-demo/src'), { recursive: true });
		writeFileSync(join(repositoryRoot, 'apps/rph-demo/src/app.d.ts'), 'export declare const app: true;\n');
		const input = recipe({ moduleResolution: ts.ModuleResolutionKind.Node10, paths: { 'x/*': ['./src/*'] } }, { configPath: 'apps/rph-demo/tsconfig.json' });
		const materialized = materializeProgramRecipe(input, repositoryRoot);
		expect(materialized.compilerOptions.pathsBasePath).toBe(join(repositoryRoot, 'apps/rph-demo'));
		expect(input.compilerOptions.pathsBasePath).toBeUndefined();
		const resolution = ts.resolveModuleName('x/app', join(repositoryRoot, 'apps/rph-demo/src/use.ts'), materialized.compilerOptions, {
			fileExists: existsSync,
			readFile: (path) => existsSync(path) ? readFileSync(path, 'utf8') : undefined
		});
		expect(resolution.resolvedModule?.resolvedFileName.replaceAll('\\', '/')).toBe(join(repositoryRoot, 'apps/rph-demo/src/app.d.ts').replaceAll('\\', '/'));
	});

	it.each(['generateCpuProfile', 'generateTrace', 'project'])('rejects command-line path option %s even under a recomputed valid digest', (key) => {
		const repositoryRoot = repository();
		expectTypedFailure(() => materializeProgramRecipe(recipe({ [key]: 'packages/example/output' }), repositoryRoot));
	});

	it('rejects digest drift, traversal, internal dot segments, and unknown path-like options', () => {
		const repositoryRoot = repository();
		expectTypedFailure(() => materializeProgramRecipe({ ...recipe({}), projectResolutionDigest: '0'.repeat(64) }, repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ rootDir: '../escape' }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ rootDir: 'packages/./example' }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ mysteryPath: 'relative' }), repositoryRoot));
	});

	it('rejects noncanonical roots, references, and config path mirrors', () => {
		const repositoryRoot = repository();
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { configPath: '.' }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { rootNames: ['.'] }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { projectReferences: ['.'] }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { rootNames: ['z.ts', 'a.ts'] }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { rootNames: ['a.ts', 'a.ts'] }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { rootNames: ['A.ts', 'a.ts'] }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { projectReferences: ['z.json', 'a.json'] }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ configFilePath: 'packages/base/tsconfig.json' }), repositoryRoot));
	});

	it('validates top-level fields and compiler-option shapes without leaking raw exceptions', () => {
		const repositoryRoot = repository();
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { kind: 'UNKNOWN' }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { configClosureDigest: 'not-a-digest' }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { provider: null }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { rootNames: null }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({}, { projectReferences: null }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe(null as unknown as Readonly<Record<string, unknown>>), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe([] as unknown as Readonly<Record<string, unknown>>), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ rootDir: 7 }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ lib: 'es2022' }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ paths: [] }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ strict: 'yes' }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ jsxFactory: '\ud800' }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ module: 'ESNext' }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(recipe({ mysteryFile: 'packages/example/input.ts' }), repositoryRoot));
		expectTypedFailure(() => materializeProgramRecipe(null as unknown as ProgramRecipe, repositoryRoot));

		const hostile = new Proxy(recipe({}), { ownKeys() { throw new TypeError('hostile proxy'); } });
		expectTypedFailure(() => materializeProgramRecipe(hostile, repositoryRoot));
	});

	it('requires an absolute existing directory repository root', () => {
		const input = recipe({});
		expectTypedFailure(() => materializeProgramRecipe(input, 'relative-root'));
		expectTypedFailure(() => materializeProgramRecipe(input, resolve('missing-materializer-root')));
		const root = repository();
		expectTypedFailure(() => materializeProgramRecipe(input, `${root}${sep}packages${sep}..`));
		const file = join(root, 'not-a-directory');
		writeFileSync(file, 'x');
		expectTypedFailure(() => materializeProgramRecipe(input, file));
	});

	it('rejects an existing or prospective path escaping through a junction or symlink', () => {
		const repositoryRoot = repository();
		const outside = mkdtempSync(join(tmpdir(), 'csaa-materializer-outside-'));
		temporaryRoots.push(outside);
		const alias = join(repositoryRoot, 'packages/example/escape');
		symlinkSync(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');
		expectTypedFailure(() => materializeProgramRecipe(recipe({ rootDir: 'packages/example/escape' }), repositoryRoot), 'PATH_ESCAPE');
		expectTypedFailure(() => materializeProgramRecipe(recipe({ outDir: 'packages/example/escape/not-created' }), repositoryRoot), 'PATH_ESCAPE');
	});
});
